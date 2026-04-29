import React, { useCallback, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../api/firebase/config';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  ShieldAlert,
  Sparkles,
  Terminal,
} from 'lucide-react';

// =====================================================================
// Lever framework
// =====================================================================

type LogLine = { ts: number; level: 'info' | 'warn' | 'err'; text: string };

type LeverHandle = {
  log: (text: string, level?: LogLine['level']) => void;
  setProgress: (current: number, total: number) => void;
};

type LeverResult = {
  summary: string;
  changed: number;
  skipped: number;
  total: number;
};

type Lever = {
  id: string;
  title: string;
  description: string;
  destructive?: boolean;
  supportsDryRun: boolean;
  run: (args: { dryRun: boolean; handle: LeverHandle }) => Promise<LeverResult>;
};

// =====================================================================
// Levers
// =====================================================================

// Same alphabet as the iOS client (no I, L, O, 0, 1).
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');

function makeCandidateJoinCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return out;
}

async function isJoinCodeFree(code: string, claimedThisRun: Set<string>): Promise<boolean> {
  if (claimedThisRun.has(code)) return false;
  const snap = await getDocs(query(collection(db, 'clubs'), where('joinCode', '==', code)));
  return snap.empty;
}

async function generateUniqueJoinCode(claimedThisRun: Set<string>): Promise<string> {
  let length = 6;
  let attempts = 0;
  // Cap iterations to avoid runaways; pad length on repeated collisions.
  while (attempts < 50) {
    const candidate = makeCandidateJoinCode(length);
    // eslint-disable-next-line no-await-in-loop
    if (await isJoinCodeFree(candidate, claimedThisRun)) {
      claimedThisRun.add(candidate);
      return candidate;
    }
    attempts += 1;
    if (attempts > 0 && attempts % 4 === 0) length += 2;
  }
  throw new Error('Could not allocate a unique join code after 50 attempts');
}

const backfillClubJoinCodes: Lever = {
  id: 'backfill-club-join-codes',
  title: 'Backfill Club Join Codes',
  description:
    'Scans every club document, generates a unique 6-char joinCode (alphabet excludes 0, 1, I, L, O), and writes it back. Skips clubs that already have one. Idempotent — safe to re-run.',
  supportsDryRun: true,
  async run({ dryRun, handle }) {
    handle.log(`Starting backfill${dryRun ? ' (dry run)' : ''}…`);

    const clubsSnap = await getDocs(collection(db, 'clubs'));
    const total = clubsSnap.size;
    handle.log(`Found ${total} club document(s).`);
    handle.setProgress(0, total);

    // Track existing codes so we never propose a duplicate, plus codes we
    // claim during this run so a single batch can't double-assign.
    const claimed = new Set<string>();
    clubsSnap.forEach((d) => {
      const existing = ((d.data().joinCode as string | undefined) || '').trim().toUpperCase();
      if (existing) claimed.add(existing);
    });

    let changed = 0;
    let skipped = 0;
    let processed = 0;

    for (const d of clubsSnap.docs) {
      const data = d.data();
      const existing = ((data.joinCode as string | undefined) || '').trim().toUpperCase();
      if (existing) {
        skipped += 1;
        processed += 1;
        handle.setProgress(processed, total);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const code = await generateUniqueJoinCode(claimed);
      handle.log(`${d.id} (${data.name || '<unnamed>'}) → ${code}`);

      if (!dryRun) {
        // eslint-disable-next-line no-await-in-loop
        await updateDoc(doc(db, 'clubs', d.id), {
          joinCode: code,
          updatedAt: serverTimestamp(),
        });
      }

      changed += 1;
      processed += 1;
      handle.setProgress(processed, total);
    }

    return {
      summary: dryRun
        ? `Would assign ${changed} code(s); skipped ${skipped} already-coded clubs.`
        : `Assigned ${changed} code(s); skipped ${skipped} already-coded clubs.`,
      changed,
      skipped,
      total,
    };
  },
};

// ---------------------------------------------------------------------
// Lever 2: Reclassify Legacy Challenge Types
// ---------------------------------------------------------------------

type ChallengeTypeValue =
  | 'lift'
  | 'run'
  | 'bike'
  | 'burn'
  | 'stretch'
  | 'hybrid'
  | 'nutrition';

const VALID_CHALLENGE_TYPES: ChallengeTypeValue[] = [
  'lift',
  'run',
  'bike',
  'burn',
  'stretch',
  'hybrid',
  'nutrition',
];

// Treat anything outside this set as "needs reclassification". The legacy
// fallback in iOS (`init(fromLegacy:)`) silently coerces these to .lift on
// read but never writes the field back, so the source-of-truth doc is wrong.
const LEGACY_TYPE_VALUES = new Set(['workout', 'steps', 'calories', '']);

interface ClassificationResponse {
  challengeId: string;
  inferredType: ChallengeTypeValue;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  model: string;
}

async function classifyChallengeViaApi(args: {
  challengeId: string;
  challengeTitle: string;
  challengeSubtitle?: string;
  workoutTitles: string[];
}): Promise<ClassificationResponse> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Not signed in');

  const res = await fetch('/.netlify/functions/classify-challenge-type', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Classifier ${res.status}: ${text.slice(0, 240)}`);
  }
  return (await res.json()) as ClassificationResponse;
}

const reclassifyLegacyChallengeTypes: Lever = {
  id: 'reclassify-legacy-challenge-types',
  title: 'Reclassify Legacy Challenge Types',
  description:
    'Finds challenges whose challenge.challengeType is missing or set to a legacy value (workout/steps/calories), then asks Claude Haiku to pick the right canonical enum based on the challenge title and the denormalized workout names. In live mode, writes the inferred value plus an audit trail (challengeTypeInferredAt + challengeTypeInferredFrom).',
  supportsDryRun: true,
  async run({ dryRun, handle }) {
    handle.log(`Scanning sweatlist-collection${dryRun ? ' (dry run)' : ''}…`);

    const allSnap = await getDocs(collection(db, 'sweatlist-collection'));
    handle.log(`Total docs: ${allSnap.size}`);

    type Candidate = {
      docId: string;
      challengeTitle: string;
      challengeSubtitle: string;
      workoutTitles: string[];
      currentType: string | undefined;
      reason: 'missing' | 'legacy';
    };

    const candidates: Candidate[] = [];
    allSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const challenge = (data.challenge as Record<string, unknown> | undefined) || undefined;
      if (!challenge) return; // Some sweatlist-collection docs don't carry a challenge at all.

      const rawType = challenge.challengeType;
      const currentType =
        typeof rawType === 'string' ? rawType.trim().toLowerCase() : undefined;

      const isMissing = !currentType;
      const isLegacy = !!currentType && LEGACY_TYPE_VALUES.has(currentType);
      const isUnknownNonLegacy =
        !!currentType &&
        !VALID_CHALLENGE_TYPES.includes(currentType as ChallengeTypeValue) &&
        !isLegacy;
      if (!isMissing && !isLegacy && !isUnknownNonLegacy) return;

      const challengeTitle =
        typeof challenge.title === 'string'
          ? challenge.title
          : typeof data.title === 'string'
          ? (data.title as string)
          : '';
      const challengeSubtitle =
        typeof challenge.subtitle === 'string' ? (challenge.subtitle as string) : '';

      const sweatlistIds = Array.isArray(data.sweatlistIds)
        ? (data.sweatlistIds as Array<Record<string, unknown>>)
        : [];
      const workoutTitles = sweatlistIds
        .map((s) => (typeof s.sweatlistName === 'string' ? s.sweatlistName : ''))
        .filter((t) => !!t);

      candidates.push({
        docId: d.id,
        challengeTitle,
        challengeSubtitle,
        workoutTitles,
        currentType,
        reason: isMissing ? 'missing' : 'legacy',
      });
    });

    handle.log(`Candidates needing reclassification: ${candidates.length}`);
    handle.setProgress(0, candidates.length);

    let changed = 0;
    let skipped = 0;
    let processed = 0;

    // Helper: produce a one-line "fingerprint" for log readability — leads
    // with the human-readable challenge title, then a small sample of
    // workout names so the admin can sanity-check the AI's call against
    // real data without leaving the lever.
    const fingerprint = (cand: Candidate): string => {
      const titleSnippet = cand.challengeTitle ? `"${cand.challengeTitle}"` : '<no title>';
      const sample = cand.workoutTitles
        .slice(0, 2)
        .map((t) => `"${t.length > 40 ? t.slice(0, 37) + '…' : t}"`)
        .join(', ');
      const more = cand.workoutTitles.length > 2 ? `, +${cand.workoutTitles.length - 2} more` : '';
      const sampleText = cand.workoutTitles.length > 0 ? `: ${sample}${more}` : '';
      return `${titleSnippet} (${cand.workoutTitles.length} wks${sampleText}) [${cand.docId}]`;
    };

    for (const cand of candidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await classifyChallengeViaApi({
          challengeId: cand.docId,
          challengeTitle: cand.challengeTitle,
          challengeSubtitle: cand.challengeSubtitle,
          workoutTitles: cand.workoutTitles,
        });

        const fromLabel = cand.currentType ? `"${cand.currentType}"` : 'missing';
        handle.log(
          `${fingerprint(cand)} ${fromLabel} → ${result.inferredType} [${result.confidence}] — ${result.reasoning}`
        );

        if (!dryRun) {
          // eslint-disable-next-line no-await-in-loop
          await updateDoc(doc(db, 'sweatlist-collection', cand.docId), {
            'challenge.challengeType': result.inferredType,
            'challenge.challengeTypeInferredAt': serverTimestamp(),
            'challenge.challengeTypeInferredFrom': `${result.model}:v1`,
            'challenge.challengeTypeInferredConfidence': result.confidence,
          });
        }
        changed += 1;
      } catch (e: any) {
        handle.log(`${fingerprint(cand)} FAILED: ${e?.message || String(e)}`, 'err');
        skipped += 1;
      }
      processed += 1;
      handle.setProgress(processed, candidates.length);
    }

    return {
      summary: dryRun
        ? `Would reclassify ${changed} challenge(s); ${skipped} failed during inference.`
        : `Reclassified ${changed} challenge(s); ${skipped} failed during inference.`,
      changed,
      skipped,
      total: candidates.length,
    };
  },
};

const LEVERS: Lever[] = [backfillClubJoinCodes, reclassifyLegacyChallengeTypes];

// =====================================================================
// UI
// =====================================================================

const AdminLevers: React.FC = () => (
  <AdminRouteGuard>
    <Head>
      <title>Admin · Levers</title>
    </Head>
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <ShieldAlert className="text-yellow-400" />
          <h1 className="text-3xl font-bold tracking-tight">Admin Levers</h1>
        </div>
        <p className="text-zinc-400 text-sm mb-8">
          Heavy-duty operations. Each lever runs as the signed-in admin against the live
          Firestore project that this build is pointed at. Use dry-run first when available.
        </p>

        <div className="space-y-6">
          {LEVERS.map((lever) => (
            <LeverCard key={lever.id} lever={lever} />
          ))}
        </div>
      </div>
    </div>
  </AdminRouteGuard>
);

const LeverCard: React.FC<{ lever: Lever }> = ({ lever }) => {
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<LeverResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle: LeverHandle = useMemo(
    () => ({
      log: (text, level = 'info') => {
        setLogs((prev) => [...prev, { ts: Date.now(), level, text }]);
      },
      setProgress: (current, total) => {
        setProgress({ current, total });
      },
    }),
    []
  );

  const onRun = useCallback(async () => {
    if (running) return;
    if (!dryRun) {
      const ok = window.confirm(
        `Run "${lever.title}" against the LIVE Firestore project?\n\n` +
          `This will write to production data. Click Cancel to abort.`
      );
      if (!ok) return;
    }
    setLogs([]);
    setProgress(null);
    setResult(null);
    setError(null);
    setRunning(true);
    try {
      const r = await lever.run({ dryRun, handle });
      setResult(r);
      handle.log(r.summary, 'info');
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      handle.log(`Failed: ${msg}`, 'err');
    } finally {
      setRunning(false);
    }
  }, [running, dryRun, lever, handle]);

  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start gap-3 mb-2">
        <Sparkles className="text-yellow-400 mt-1" size={18} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{lever.title}</h2>
            {lever.destructive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-red-400 bg-red-400/10 border border-red-400/30 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} /> DESTRUCTIVE
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{lever.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        {lever.supportsDryRun && (
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="accent-yellow-400"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={running}
            />
            Dry run
          </label>
        )}
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            running
              ? 'bg-zinc-800 text-zinc-400 cursor-wait'
              : dryRun
              ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
              : 'bg-yellow-400 text-black hover:bg-yellow-300'
          }`}
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? 'Running…' : dryRun ? 'Run dry' : 'Run live'}
        </button>
      </div>

      {progress && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>
              {progress.current} / {progress.total}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {result && !error && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={14} />
          {result.summary}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-black/60 max-h-72 overflow-auto">
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] tracking-wider text-zinc-500 border-b border-zinc-800">
            <Terminal size={12} /> LOG
          </div>
          <div className="px-3 py-2 font-mono text-xs leading-relaxed">
            {logs.map((line, i) => (
              <div
                key={i}
                className={
                  line.level === 'err'
                    ? 'text-red-300'
                    : line.level === 'warn'
                    ? 'text-yellow-300'
                    : 'text-zinc-300'
                }
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLevers;
