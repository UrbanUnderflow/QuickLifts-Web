import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { db } from '../../api/firebase/config';
import { adminMethods } from '../../api/firebase/admin/methods';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import {
  CLINICAL_ESCALATIONS_COLLECTION,
  acknowledgeClinicalEscalation,
  resolveClinicalEscalation,
  type ClinicalEscalationRecord,
  type EscalationDeliveryStatus,
} from '../../api/firebase/pulsecheckClinicalEscalation';
import CrisisResources from '../../components/clinical-escalation/CrisisResources';

// =============================================================================
// /staff/clinical-escalations — clinician acknowledgement + resolve surface.
//
// Two entry points:
//   1. Clinician arrives via deep link from the email/SMS:
//      `/staff/clinical-escalations?ack=<escalationId>` — auto-loads the
//      single record and shows acknowledge / resolve controls.
//   2. Admin/clinician opens the page directly to see the active queue.
//
// Auth: page-level permission gate. Either (a) the signed-in user is a
// Pulse admin, or (b) the user has a `clinician` team membership on the
// team that owns the escalation. Non-admin clinicians can only see /
// act on records for teams where they hold a clinician seat. Why not
// AdminRouteGuard? On-staff clinicians at pilot sites are not Pulse
// admins — they sign in with their own accounts and need to reach
// this page from email deep links.
// =============================================================================

const STATUS_TONE: Record<EscalationDeliveryStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-amber-700/50 bg-amber-950/30 text-amber-200' },
  clinician_paged: { label: 'Clinician paged', className: 'border-amber-700/50 bg-amber-950/30 text-amber-100' },
  clinician_acknowledged: {
    label: 'Acknowledged',
    className: 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200',
  },
  resolved: { label: 'Resolved', className: 'border-zinc-700 bg-black/30 text-zinc-300' },
  failed: { label: 'Delivery failed', className: 'border-rose-700/60 bg-rose-950/40 text-rose-200' },
};

const formatTimestamp = (value: unknown): string => {
  if (!value) return '—';
  const ms =
    typeof (value as { toMillis?: () => number }).toMillis === 'function'
      ? (value as { toMillis: () => number }).toMillis()
      : typeof value === 'number'
        ? value * (value < 1e12 ? 1000 : 1)
        : Date.parse(String(value));
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString();
};

type PermissionState =
  | { status: 'loading' }
  | { status: 'denied'; reason: string }
  | { status: 'granted'; isAdmin: boolean; allowedTeamIds: Set<string> | 'all' };

const ClinicalEscalationsPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const userLoading = useUserLoading();

  const [permission, setPermission] = useState<PermissionState>({ status: 'loading' });
  const [activeRecord, setActiveRecord] = useState<ClinicalEscalationRecord | null>(null);
  const [queue, setQueue] = useState<ClinicalEscalationRecord[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingActive, setLoadingActive] = useState(false);
  const [ackInProgress, setAckInProgress] = useState(false);
  const [resolveInProgress, setResolveInProgress] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [clearWall, setClearWall] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ackParam = typeof router.query.ack === 'string' ? router.query.ack : '';

  // Permission resolution: admin OR clinician on at least one team.
  // We capture the set of teamIds the user can act on so we can filter
  // the queue + active record below.
  useEffect(() => {
    if (userLoading) return;
    if (!currentUser?.id || !currentUser.email) {
      setPermission({
        status: 'denied',
        reason: 'Sign in to a Pulse account that has been added as a clinician on a team.',
      });
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const isAdmin = await adminMethods.isAdmin(currentUser.email);
        if (cancelled) return;
        if (isAdmin) {
          setPermission({ status: 'granted', isAdmin: true, allowedTeamIds: 'all' });
          return;
        }
        const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id);
        if (cancelled) return;
        const clinicianTeamIds = memberships
          .filter((m) => m.role === 'clinician')
          .map((m) => m.teamId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (clinicianTeamIds.length === 0) {
          setPermission({
            status: 'denied',
            reason:
              'This page is for Pulse admins and on-staff clinicians. Your account does not have a clinician team membership.',
          });
          return;
        }
        setPermission({
          status: 'granted',
          isAdmin: false,
          allowedTeamIds: new Set(clinicianTeamIds),
        });
      } catch (err) {
        if (!cancelled) {
          setPermission({
            status: 'denied',
            reason: err instanceof Error ? err.message : 'Could not verify access.',
          });
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.email, userLoading]);

  // Live subscription to the active queue (most-recent N), filtered to
  // teams the current user is permitted to see.
  useEffect(() => {
    if (permission.status !== 'granted') return;
    setLoadingQueue(true);
    const constraints = [
      where('deliveryStatus', 'in', ['pending', 'clinician_paged', 'clinician_acknowledged'] satisfies EscalationDeliveryStatus[]),
      orderBy('detectedAt', 'desc'),
      limit(50),
    ];
    const allowed = permission.allowedTeamIds;
    const unsub = onSnapshot(
      query(collection(db, CLINICAL_ESCALATIONS_COLLECTION), ...constraints),
      (snap) => {
        const rows = snap.docs
          .map((docSnap) => ({
            ...(docSnap.data() as ClinicalEscalationRecord),
            id: docSnap.id,
          }))
          .filter((row) => allowed === 'all' || (row.teamId && allowed.has(row.teamId)));
        setQueue(rows);
        setLoadingQueue(false);
      },
      (err) => {
        console.error('[ClinicalEscalationsPage] queue listener failed:', err);
        setError(err?.message || 'Could not load active escalations.');
        setLoadingQueue(false);
      },
    );
    return () => unsub();
  }, [permission]);

  // Single-record load when arriving via ?ack=<id> deep link. Enforces
  // the same team-scope permission so a clinician at School A can't open
  // a record for School B by guessing the id.
  useEffect(() => {
    if (!router.isReady || !ackParam) return;
    if (permission.status !== 'granted') return;
    let cancelled = false;
    const load = async () => {
      setLoadingActive(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, CLINICAL_ESCALATIONS_COLLECTION, ackParam));
        if (cancelled) return;
        if (!snap.exists()) {
          setError(`No escalation found for id ${ackParam}.`);
          setActiveRecord(null);
          return;
        }
        const record = { ...(snap.data() as ClinicalEscalationRecord), id: snap.id };
        const allowed = permission.allowedTeamIds;
        if (allowed !== 'all' && (!record.teamId || !allowed.has(record.teamId))) {
          setError('You do not have access to this escalation.');
          setActiveRecord(null);
          return;
        }
        setActiveRecord(record);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load escalation.');
        }
      } finally {
        if (!cancelled) setLoadingActive(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [ackParam, router.isReady, permission]);

  const handleAcknowledge = async (record: ClinicalEscalationRecord) => {
    if (!currentUser?.id) {
      setError('Sign in is required to acknowledge an escalation.');
      return;
    }
    setAckInProgress(true);
    setError(null);
    setNotice(null);
    try {
      await acknowledgeClinicalEscalation(record.id, currentUser.id);
      setNotice(
        `Acknowledged. The escalation is on your queue until you mark it resolved. Reach out to the athlete or their emergency contact per your protocol.`,
      );
      // Refresh active record if loaded
      const fresh = await getDoc(doc(db, CLINICAL_ESCALATIONS_COLLECTION, record.id));
      if (fresh.exists()) {
        setActiveRecord({ ...(fresh.data() as ClinicalEscalationRecord), id: fresh.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not acknowledge escalation.');
    } finally {
      setAckInProgress(false);
    }
  };

  const handleResolve = async (record: ClinicalEscalationRecord) => {
    if (!currentUser?.id) {
      setError('Sign in is required to resolve an escalation.');
      return;
    }
    if (!resolutionNote.trim()) {
      setError('Add a short resolution note before marking resolved.');
      return;
    }
    setResolveInProgress(true);
    setError(null);
    setNotice(null);
    try {
      await resolveClinicalEscalation(record.id, {
        resolvedByUserId: currentUser.id,
        resolutionNote: resolutionNote.trim(),
        clearCrisisWallForAthleteUserId: clearWall ? record.athleteUserId : undefined,
      });
      setNotice(
        `Resolved. ${
          clearWall
            ? 'The athlete\'s crisis wall has been cleared.'
            : 'The athlete\'s crisis wall remains active until you clear it manually.'
        }`,
      );
      const fresh = await getDoc(doc(db, CLINICAL_ESCALATIONS_COLLECTION, record.id));
      if (fresh.exists()) {
        setActiveRecord({ ...(fresh.data() as ClinicalEscalationRecord), id: fresh.id });
      }
      setResolutionNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve escalation.');
    } finally {
      setResolveInProgress(false);
    }
  };

  const visibleRecord = activeRecord;

  if (permission.status === 'loading' || userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a14] text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">Verifying access…</span>
      </div>
    );
  }

  if (permission.status === 'denied') {
    return (
      <>
        <Head>
          <title>Clinical escalations | Pulse</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <div className="flex min-h-screen items-center justify-center bg-[#080a14] px-6 text-zinc-100">
          <div className="max-w-md rounded-2xl border border-rose-700/60 bg-rose-950/30 p-6 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-rose-300" />
            <h1 className="mt-3 text-lg font-semibold">Access required</h1>
            <p className="mt-2 text-sm text-rose-100/85">{permission.reason}</p>
            <p className="mt-4 text-xs text-zinc-500">
              If you believe this is an error, contact your team admin or the Pulse team.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Clinical escalations | Pulse</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-[#080a14] px-6 py-10 text-zinc-100">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-700/40 bg-rose-950/30 text-rose-200">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Clinical escalations</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Tier 3 routing surface. Acknowledge to capture audit, resolve when the athlete is in care.
                Pulse never auto-dials emergency services — the athlete must initiate any 988 / 911 call themselves.
              </p>
            </div>
          </header>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>{notice}</span>
            </div>
          )}

          {ackParam && (
            <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Linked escalation</h2>
                <span className="text-xs text-zinc-500">id: {ackParam}</span>
              </div>
              {loadingActive ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading escalation…
                </div>
              ) : visibleRecord ? (
                <EscalationDetail
                  record={visibleRecord}
                  onAcknowledge={() => handleAcknowledge(visibleRecord)}
                  onResolve={() => handleResolve(visibleRecord)}
                  ackInProgress={ackInProgress}
                  resolveInProgress={resolveInProgress}
                  resolutionNote={resolutionNote}
                  setResolutionNote={setResolutionNote}
                  clearWall={clearWall}
                  setClearWall={setClearWall}
                />
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  No record loaded. Check the link in your email or page through the active queue below.
                </p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Active queue</h2>
              <span className="text-xs text-zinc-500">
                {loadingQueue ? 'Loading…' : `${queue.length} active escalation${queue.length === 1 ? '' : 's'}`}
              </span>
            </div>
            {loadingQueue ? (
              <div className="flex items-center gap-2 py-12 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading active queue…
              </div>
            ) : queue.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                No active escalations. The queue is clean.
              </p>
            ) : (
              <ul className="space-y-3">
                {queue.map((record) => (
                  <li
                    key={record.id}
                    className="rounded-xl border border-zinc-800 bg-black/25 p-4"
                  >
                    <EscalationRow
                      record={record}
                      onOpen={() => router.push(`/staff/clinical-escalations?ack=${record.id}`)}
                      isOpen={activeRecord?.id === record.id}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <CrisisResources variant="full" />
          </section>
        </div>
      </div>
    </>
  );
};

interface EscalationRowProps {
  record: ClinicalEscalationRecord;
  onOpen: () => void;
  isOpen: boolean;
}

const EscalationRow: React.FC<EscalationRowProps> = ({ record, onOpen, isOpen }) => {
  const tone = STATUS_TONE[record.deliveryStatus] || STATUS_TONE.pending;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start justify-between gap-4 text-left transition ${
        isOpen ? 'opacity-90' : 'hover:opacity-95'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-100">
          Tier {record.tier} · {record.athleteUserId.slice(0, 12)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {record.signalSource} · detected {formatTimestamp(record.detectedAt)}
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          Team {record.teamId.slice(0, 12)} · {record.evidence.length} evidence ref{record.evidence.length === 1 ? '' : 's'}
        </p>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${tone.className}`}>
        {tone.label}
      </span>
    </button>
  );
};

interface EscalationDetailProps {
  record: ClinicalEscalationRecord;
  onAcknowledge: () => void;
  onResolve: () => void;
  ackInProgress: boolean;
  resolveInProgress: boolean;
  resolutionNote: string;
  setResolutionNote: (value: string) => void;
  clearWall: boolean;
  setClearWall: (value: boolean) => void;
}

const EscalationDetail: React.FC<EscalationDetailProps> = ({
  record,
  onAcknowledge,
  onResolve,
  ackInProgress,
  resolveInProgress,
  resolutionNote,
  setResolutionNote,
  clearWall,
  setClearWall,
}) => {
  const isAcknowledged = Boolean(record.acknowledgedAt);
  const isResolved = record.deliveryStatus === 'resolved';
  const tone = STATUS_TONE[record.deliveryStatus] || STATUS_TONE.pending;

  return (
    <div className="mt-4 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <DetailField label="Athlete" value={record.athleteUserId} />
        <DetailField label="Team" value={record.teamId} />
        <DetailField label="Tier" value={`Tier ${record.tier}`} />
        <DetailField label="Detected" value={formatTimestamp(record.detectedAt)} />
        <DetailField label="Recorded" value={formatTimestamp(record.recordedAt)} />
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Status</p>
          <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${tone.className}`}>
            {tone.label}
          </span>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Signal evidence</p>
        <ul className="mt-2 space-y-2">
          {record.evidence.map((entry, idx) => (
            <li
              key={idx}
              className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-200"
            >
              <p className="font-semibold">{entry.label}</p>
              {entry.excerpt && (
                <p className="mt-1 italic text-zinc-400">"{entry.excerpt}"</p>
              )}
              {entry.confidence && (
                <p className="mt-1 text-[10px] text-zinc-500">confidence: {entry.confidence}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isAcknowledged && (
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100">
          Acknowledged at {formatTimestamp(record.acknowledgedAt)} by{' '}
          <span className="font-mono">{record.acknowledgedByUserId || '—'}</span>.
        </div>
      )}

      {isResolved ? (
        <div className="rounded-xl border border-zinc-800 bg-black/30 px-3 py-3 text-xs text-zinc-300">
          <p className="font-semibold text-zinc-200">Resolved</p>
          <p className="mt-1">
            Resolved at {formatTimestamp(record.resolvedAt)} by{' '}
            <span className="font-mono">{record.resolvedByUserId || '—'}</span>.
          </p>
          {record.resolutionNote && (
            <p className="mt-2 italic text-zinc-400">"{record.resolutionNote}"</p>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-black/30 p-4">
          {!isAcknowledged && (
            <button
              type="button"
              onClick={onAcknowledge}
              disabled={ackInProgress}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-700/60 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-900/40 disabled:opacity-50"
            >
              {ackInProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              I have received this and am responding
            </button>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
              Resolution note (required to mark resolved)
            </label>
            <textarea
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="What you did, who you reached, current state. This is part of the audit record."
              className="mt-1 min-h-[88px] w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={clearWall}
              onChange={(event) => setClearWall(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-black"
            />
            Clear the athlete's crisis wall on resolve
          </label>

          <button
            type="button"
            onClick={onResolve}
            disabled={resolveInProgress || !resolutionNote.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-700/60 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-900/40 disabled:opacity-50"
          >
            {resolveInProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Mark resolved
          </button>
        </div>
      )}
    </div>
  );
};

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
    <p className="mt-1 truncate text-sm text-zinc-200" title={value}>
      {value}
    </p>
  </div>
);

export default ClinicalEscalationsPage;
