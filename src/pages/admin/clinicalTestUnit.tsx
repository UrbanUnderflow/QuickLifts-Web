import React, { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  runClinicalBridgeSmokeTest,
  type ClinicalBridgeSmokeAction,
  type ClinicalBridgeSmokeResponse,
  type ClinicalBridgeSmokeResult,
} from '../../api/clinical-bridge';

const ACTIONS: Array<{
  id: ClinicalBridgeSmokeAction;
  label: string;
  description: string;
  writes: boolean;
}> = [
  {
    id: 'health',
    label: 'Health',
    description: 'Checks whether the clinical partner API is reachable.',
    writes: false,
  },
  {
    id: 'smoke-read',
    label: 'Read Smoke',
    description: 'Runs health, athlete status, and care-state checks for a test athlete id.',
    writes: false,
  },
  {
    id: 'status',
    label: 'Athlete Status',
    description: 'Checks the partner-side status endpoint for a test athlete id.',
    writes: false,
  },
  {
    id: 'care-state',
    label: 'Care State',
    description: 'Checks protective app state and return-to-training state for a test athlete id.',
    writes: false,
  },
  {
    id: 'athlete-upsert',
    label: 'Athlete Upsert',
    description: 'Creates or updates a synthetic athlete in the clinical partner sandbox.',
    writes: true,
  },
  {
    id: 'escalation-create',
    label: 'Create Escalation',
    description: 'Creates a synthetic clinical escalation using the bridge packet.',
    writes: true,
  },
  {
    id: 'resolve',
    label: 'Resolve Escalation',
    description: 'Marks a known synthetic escalation id as resolved through the partner endpoint.',
    writes: true,
  },
  {
    id: 'smoke-write',
    label: 'Full Write Smoke',
    description: 'Runs health, reads, synthetic athlete upsert, synthetic escalation, and resolve.',
    writes: true,
  },
];

function makeDefaultExternalId() {
  return `clinical-smoke-${new Date().toISOString().slice(0, 10)}`;
}

function StatusIcon({ result }: { result: ClinicalBridgeSmokeResult }) {
  if (result.skipped) return <AlertTriangle className="h-5 w-5 text-amber-300" />;
  if (result.ok) return <CheckCircle2 className="h-5 w-5 text-emerald-300" />;
  return <XCircle className="h-5 w-5 text-rose-300" />;
}

function ResultRow({ result }: { result: ClinicalBridgeSmokeResult }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusIcon result={result} />
          <div>
            <div className="font-semibold text-white">{result.name}</div>
            <div className="text-xs text-zinc-500">
              {result.endpoint || 'bridge method'} · {result.durationMs ?? 0} ms
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {result.mock ? <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">mock</span> : null}
          {result.httpStatus ? <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">HTTP {result.httpStatus}</span> : null}
          {result.status ? <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">{result.status}</span> : null}
        </div>
      </div>
      {result.error ? (
        <div className="mt-3 rounded border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
          {result.error.code ? <span className="font-semibold">{result.error.code}: </span> : null}
          {result.error.message}
        </div>
      ) : null}
      {result.requestId ? (
        <div className="mt-3 text-xs text-zinc-500">requestId: {result.requestId}</div>
      ) : null}
    </div>
  );
}

const ClinicalTestUnitPage: React.FC = () => {
  const [action, setAction] = useState<ClinicalBridgeSmokeAction>('health');
  const [allowWrites, setAllowWrites] = useState(false);
  const [externalId, setExternalId] = useState(makeDefaultExternalId);
  const [email, setEmail] = useState('');
  const [organizationId, setOrganizationId] = useState('pulsecheck-smoke-org');
  const [teamId, setTeamId] = useState('pulsecheck-smoke-team');
  const [escalationId, setEscalationId] = useState('');
  const [result, setResult] = useState<ClinicalBridgeSmokeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const selectedAction = useMemo(() => ACTIONS.find((item) => item.id === action) || ACTIONS[0], [action]);
  const writeBlocked = selectedAction.writes && !allowWrites;

  const runTest = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await runClinicalBridgeSmokeTest({
        action,
        allowWrites,
        athlete: {
          externalId,
          displayName: 'Clinical Smoke Test Athlete',
          email: email || undefined,
          organizationId,
          teamId,
        },
        escalation: {
          escalationRecordId: `clinical-smoke-escalation-${Date.now()}`,
          tier: 3,
          category: 'clinical_bridge_smoke_test',
        },
        escalationId: escalationId || undefined,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clinical bridge smoke test failed.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Clinical Test Unit | Pulse Admin</title>
      </Head>

      <main className="min-h-screen bg-[#0b0f14] px-6 py-8 text-zinc-100">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link href="/admin" className="text-sm text-zinc-500 transition hover:text-white">
                Admin
              </Link>
              <h1 className="mt-2 text-3xl font-bold text-white">Clinical Test Unit</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Smoke test the clinical bridge without exposing partner API keys in the browser. Read checks are safe by default;
                synthetic write checks require an explicit opt-in.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                Clinical bridge boundary
              </div>
              <div className="mt-1 text-xs text-emerald-200/80">App code calls the bridge, not provider-specific endpoints.</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <section className="rounded-xl border border-white/10 bg-[#151a21] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#262a30] text-[#d7ff00]">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Test setup</h2>
                  <p className="text-xs text-zinc-500">Synthetic ids only. No real athlete data.</p>
                </div>
              </div>

              <label className="mt-5 block text-sm font-medium text-zinc-300">
                Test action
                <select
                  value={action}
                  onChange={(event) => setAction(event.target.value as ClinicalBridgeSmokeAction)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-[#d7ff00]/60"
                >
                  {ACTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <p className="mt-2 text-xs leading-5 text-zinc-500">{selectedAction.description}</p>

              <div className="mt-5 grid gap-3">
                <label className="block text-sm font-medium text-zinc-300">
                  Test athlete id
                  <input
                    value={externalId}
                    onChange={(event) => setExternalId(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-[#d7ff00]/60"
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-300">
                  Test email
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={`${externalId}@example.test`}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-[#d7ff00]/60"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-zinc-300">
                    Org id
                    <input
                      value={organizationId}
                      onChange={(event) => setOrganizationId(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-[#d7ff00]/60"
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-300">
                    Team id
                    <input
                      value={teamId}
                      onChange={(event) => setTeamId(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-[#d7ff00]/60"
                    />
                  </label>
                </div>
                {action === 'resolve' ? (
                  <label className="block text-sm font-medium text-zinc-300">
                    Escalation id to resolve
                    <input
                      value={escalationId}
                      onChange={(event) => setEscalationId(event.target.value)}
                      placeholder="Synthetic escalation id from a prior create test"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-[#d7ff00]/60"
                    />
                  </label>
                ) : null}
              </div>

              <label className="mt-5 flex items-start gap-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                <input
                  type="checkbox"
                  checked={allowWrites}
                  onChange={(event) => setAllowWrites(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold">Allow synthetic write tests</span>
                  <span className="mt-1 block text-xs leading-5 text-amber-100/80">
                    Required for athlete upsert, escalation create, and resolve. Use only against sandbox/test credentials.
                  </span>
                </span>
              </label>

              <button
                onClick={runTest}
                disabled={isRunning}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#d7ff00] px-4 py-3 font-semibold text-black transition hover:bg-[#ecff66] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {writeBlocked ? 'Run guarded test' : 'Run clinical test'}
              </button>
            </section>

            <section className="rounded-xl border border-white/10 bg-[#151a21] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Results</h2>
                  <p className="mt-1 text-sm text-zinc-500">Each row maps to one bridge method or partner endpoint.</p>
                </div>
                {result ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
                    {result.provider} · {result.mock ? 'mock mode' : 'live mode'} · key {result.hasApiKey ? 'configured' : 'missing'}
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className="mt-5 rounded-lg border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              {!result && !error ? (
                <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-6 text-sm leading-6 text-zinc-400">
                  Run a test to see endpoint reachability, response ids, duration, mock/live mode, and any partner errors.
                </div>
              ) : null}

              {result ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                    <div className="font-semibold text-white">Callback URL</div>
                    <div className="mt-1 break-all text-zinc-400">{result.callbackUrl}</div>
                    <div className="mt-3 font-semibold text-white">Base URL</div>
                    <div className="mt-1 break-all text-zinc-400">{result.baseUrl}</div>
                  </div>
                  {result.results.map((item) => (
                    <ResultRow key={`${item.name}-${item.requestId || item.status || item.error?.code || 'row'}`} result={item} />
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </main>
    </AdminRouteGuard>
  );
};

export default ClinicalTestUnitPage;
