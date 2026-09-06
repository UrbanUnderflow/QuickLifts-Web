import ChatSimulation from './ChatSimulation';
import { PRIVACY_CASES } from '../../../lib/nora-red-team/privacyCatalog';
import DataPrivacyMatrix from './DataPrivacyMatrix';
import { NORA_EVERYDAY_SCENARIOS } from '../../../lib/nora-red-team/everydayScenarios';
import type { NoraTestingMember } from '../../../lib/nora-red-team/access';
import { relatedScenarios } from '../../../lib/nora-red-team/relatedScenarios';
import { NORA_OPERATIONAL_SCENARIOS } from '../../../lib/nora-red-team/operationalScenarios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Play,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  auth,
  getFirebaseModeRequestHeaders,
  isUsingDevFirebase,
} from '../../../api/firebase/config';
import { NORA_RED_TEAM_SCENARIOS } from '../../../lib/nora-red-team/scenarios';
import type { ScenarioDraft } from '../../../lib/nora-red-team/library';
import { NORA_RED_TEAM_VERSION } from '../../../lib/nora-red-team/types';
import type {
  NoraRedTeamHistoryRecord,
  NoraRedTeamJob,
  NoraRedTeamScenario,
  NoraRedTeamSuiteRecord,
  NoraRedTeamTarget,
} from '../../../lib/nora-red-team/types';
import styles from './NoraTesting.module.css';

type Answer = 'yes' | 'no' | 'unsure' | '';
const apiRoot = '/api/admin/pulsecheck/nora-red-team';
const when = (date: string) =>
  new Date(date).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
const targetLabel = (platform: string) =>
  platform === 'web-staging-chat' ? 'Real staging chat' : 'Policy sandbox';
const needsReview = (record: NoraRedTeamHistoryRecord) =>
  !record.review || record.review.state === 'needs_owner';
const concern = (record: NoraRedTeamHistoryRecord) =>
  record.run.usefulness?.turns.find((t) => !t.helpful || !t.appropriate)
    ?.concern ||
  record.run.judge.findings[0]?.title ||
  record.run.checkResults.find((c) => !c.passed)?.label ||
  (record.run.humanReviewRequired
    ? 'Owner review required'
    : 'Passing conversation sample');

export default function NoraRedTeamConsole() {
  const [email, setEmail] = useState('');
  const [history, setHistory] = useState<NoraRedTeamHistoryRecord[]>([]);
  const [drafts, setDrafts] = useState<ScenarioDraft[]>([]);
  const [suite, setSuite] = useState<NoraRedTeamSuiteRecord | null>(null);
  const [owner, setOwner] = useState('');
  const [selected, setSelected] = useState(NORA_RED_TEAM_SCENARIOS[0].id);
  const [selectedRun, setSelectedRun] = useState('');
  const [tab, setTab] = useState<
    'scenarios' | 'history' | 'coverage' | 'safety' | 'chat'
  >('scenarios');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<NoraRedTeamTarget>('staging_chat');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [job, setJob] = useState<NoraRedTeamJob | null>(null);
  const [jobId, setJobId] = useState('');
  const [safe, setSafe] = useState<Answer>('');
  const [helpful, setHelpful] = useState<Answer>('');
  const [note, setNote] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<ScenarioDraft | null>(null);
  const [newOwner, setNewOwner] = useState('');
  const [members, setMembers] = useState<NoraTestingMember[]>([]);
  const [teamRevision, setTeamRevision] = useState(0);
  const [memberRole, setMemberRole] = useState<'owner' | 'reviewer'>(
    'reviewer',
  );
  const [canManageOwners, setCanManageOwners] = useState(false);
  const [globalAdmin, setGlobalAdmin] = useState(false);
  const [devicePlatform, setDevicePlatform] = useState('ios');
  const [deviceBuild, setDeviceBuild] = useState('');
  const [deviceNote, setDeviceNote] = useState('');
  const [devicePassed, setDevicePassed] = useState(false);
  const [devices, setDevices] = useState<
    Array<{
      platform: string;
      build: string;
      passed: boolean;
      reviewedAt: string;
      note: string;
    }>
  >([]);
  useEffect(() => {
    if (!showAdd) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea, select, summary, [tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAdd(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [showAdd]);
  const dev = isUsingDevFirebase();
  const storageKey = `nora-review:${email}:${dev ? 'dev' : 'prod'}`;
  const request = useCallback(
    async (path: string, body?: unknown, method = 'POST') => {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in to load Nora testing.');
      const response = await fetch(`${apiRoot}/${path}`, {
        method: body === undefined ? 'GET' : method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
          ...getFirebaseModeRequestHeaders(),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'The request could not finish.');
      return data;
    },
    [],
  );
  const refresh = useCallback(async () => {
    const [h, l, d, access] = await Promise.all([
      request('history?limit=250'),
      request('library'),
      request('devices'),
      request('access'),
    ]);
    setDevices(d.evidence);
    setMembers(access.members);
    setCanManageOwners(Boolean(access.canManageOwners));
    setTeamRevision(access.revision);
    setGlobalAdmin(access.identity.isGlobalAdmin);
    setHistory(h.history);
    setSuite(h.latestSuite);
    setDrafts(l.drafts);
    setOwner(l.ownerEmail);
    setLoading(false);
  }, [request]);
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        setEmail(user?.email?.toLowerCase() || '');
        if (user)
          void refresh().catch((e) => {
            setError(e.message);
            setLoading(false);
          });
      }),
    [refresh],
  );
  useEffect(() => {
    if (!email) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (saved.selected) setSelected(saved.selected);
      if (saved.selectedRun) setSelectedRun(saved.selectedRun);
      if (saved.jobId) setJobId(saved.jobId);
    } catch {}
  }, [email, storageKey]);
  useEffect(() => {
    if (email)
      localStorage.setItem(
        storageKey,
        JSON.stringify({ selected, selectedRun, jobId }),
      );
  }, [selected, selectedRun, jobId, email, storageKey]);
  useEffect(() => {
    if (!email) return;
    const timer = setInterval(() => {
      void refresh().catch((e) => setError(e.message));
    }, 15000);
    return () => clearInterval(timer);
  }, [email, refresh]);
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const data = await request(`run?jobId=${encodeURIComponent(jobId)}`);
        if (stopped) return;
        setJob(data.job);
        if (['completed', 'failed', 'cancelled'].includes(data.job.status)) {
          setJobId('');
          if (data.job.error) setError(data.job.error.message);
          if (data.job.run) setSelectedRun(data.job.run.runId);
          await refresh();
        }
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          setJobId('');
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [jobId, request, refresh]);
  const scenarios = useMemo(
    () => [
      ...NORA_RED_TEAM_SCENARIOS,
      ...NORA_EVERYDAY_SCENARIOS,
      ...NORA_OPERATIONAL_SCENARIOS,
      ...drafts.map((d) => d.scenario),
    ],
    [drafts],
  );
  const current =
    scenarios.find((s) => s.id === selected) ||
    history.find((h) => h.scenarioId === selected)?.run.scenarioSnapshot ||
    scenarios[0];
  const isOwner = members.some((m) => m.email === email && m.role === 'owner');
  const currentDraft = drafts.find((d) => d.id === current.id);
  const targetHistory = history.filter(
    (h) =>
      h.run.platform ===
      (target === 'policy_sandbox'
        ? 'web-admin-policy-sandbox'
        : 'web-staging-chat'),
  );
  const latest = new Map<string, NoraRedTeamHistoryRecord>();
  for (const h of targetHistory)
    if (!latest.has(h.scenarioId)) latest.set(h.scenarioId, h);
  const scenarioHistory = targetHistory.filter(
    (h) => h.scenarioId === current.id,
  );
  const record =
    scenarioHistory.find((h) => h.runId === selectedRun) || scenarioHistory[0];
  const flagged = [...latest.values()].filter(
    (h) =>
      h.verdict !== 'pass' ||
      h.run.humanReviewRequired ||
      h.review?.state === 'needs_fix',
  );
  const passing = [...latest.values()]
    .filter((h) => h.verdict === 'pass' && !h.run.humanReviewRequired)
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  const offset = passing.length
    ? Math.floor(Date.now() / 86400000) % passing.length
    : 0;
  const samples = passing.length
    ? [
        passing[offset],
        ...(passing.length > 1 ? [passing[(offset + 1) % passing.length]] : []),
      ]
    : [];
  const unresolved = targetHistory.filter(
    (h) =>
      h.releaseStatus !== 'resolved' &&
      (h.verdict !== 'pass' || h.review?.state === 'needs_fix'),
  );
  const reviewSet = Array.from(
    new Map(
      [...unresolved, ...flagged, ...samples].map((h) => [h.runId, h]),
    ).values(),
  );
  const pending = reviewSet.filter(needsReview);
  const openIssues = history.filter(
    (h) =>
      h.releaseStatus !== 'resolved' &&
      (h.verdict === 'fail' || h.review?.state === 'needs_fix'),
  );
  const visible = scenarios
    .filter((s) =>
      `${s.title} ${s.familyLabel} ${s.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (s) =>
        filter === 'all' ||
        (filter === 'review'
          ? pending.some((h) => h.scenarioId === s.id)
          : !latest.has(s.id)),
    );
  const suiteRunning = !!suite && ['queued', 'running'].includes(suite.status);
  const working = busy || !!jobId || suiteRunning;
  useEffect(() => {
    setSafe(record?.review?.safe || '');
    setHelpful(record?.review?.helpful || '');
    setNote(record?.review?.note || '');
  }, [record?.runId, record?.updatedAt]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const select = (id: string) => {
    setSelected(id);
    setSelectedRun('');
    setShowPast(false);
  };
  const run = async (scenario: NoraRedTeamScenario) => {
    await act(async () => {
      const data = await request('run', {
        scenarioId: scenario.id,
        randomSeed:
          (crypto.getRandomValues(new Uint32Array(1))[0] % 2147483646) + 1,
        target: drafts.some((d) => d.id === scenario.id && d.status === 'draft')
          ? 'policy_sandbox'
          : target,
      });
      setTarget(
        drafts.some((d) => d.id === scenario.id && d.status === 'draft')
          ? 'policy_sandbox'
          : target,
      );
      setJob(data.job);
      setJobId(data.job.jobId);
      select(scenario.id);
      setShowAdd(false);
    });
  };
  const saveReview = () =>
    act(async () => {
      if (!record || !safe || !helpful) return;
      const data = await request(
        'history',
        {
          runId: record.runId,
          expectedUpdatedAt: record.updatedAt,
          safe,
          helpful,
          note,
        },
        'PATCH',
      );
      await refresh();
      setNotice(
        data.history.review.state === 'needs_owner'
          ? `Saved for ${owner || 'the designated owner'}.`
          : data.history.review.state === 'needs_fix'
            ? 'Review saved. This issue stays open for a fix and retest.'
            : 'Review saved.',
      );
      const next = pending.find((h) => h.runId !== record.runId);
      if (next) {
        select(next.scenarioId);
        setSelectedRun(next.runId);
      }
    });
  const saveDraft = () =>
    act(async () => {
      if (!editing) return;
      const data = await request(
        'library',
        {
          id: editing.id,
          revision: editing.revision,
          resolution: editing.resolution,
          scenario: {
            title: editing.scenario.title,
            situation: editing.scenario.description,
            athleteMessage: editing.scenario.seedAthleteMessage,
            followUp: editing.scenario.fixedFinalAthleteMessage,
          },
        },
        'PATCH',
      );
      setEditing(data.draft);
      await refresh();
      setNotice('Draft saved. Run a fresh trial after edits.');
    });
  const updateDraft = (field: keyof NoraRedTeamScenario, value: string) =>
    setEditing((d) =>
      d ? { ...d, scenario: { ...d.scenario, [field]: value } } : d,
    );
  const familyRows = Array.from(
    new Set(scenarios.map((s) => s.familyLabel)),
  ).map((family) => {
    const cases = scenarios.filter(
      (s) =>
        s.familyLabel === family &&
        !drafts.some((d) => d.id === s.id && d.status === 'draft'),
    );
    const evidence = cases.map((s) => latest.get(s.id));
    return {
      family,
      cases,
      status: evidence.some(
        (h) => h && (h.verdict !== 'pass' || h.review?.state === 'needs_fix'),
      )
        ? 'Needs attention'
        : cases.length &&
            evidence.every(
              (h) =>
                h &&
                h.run.version === NORA_RED_TEAM_VERSION &&
                Date.now() - Date.parse(h.completedAt) < 2 * 86400000 &&
                h.run.usefulness &&
                h.verdict === 'pass' &&
                (!h.run.humanReviewRequired || h.review?.state === 'complete'),
            )
          ? 'Covered'
          : 'Needs testing',
    };
  });
  const similar = relatedScenarios(description, scenarios);
  const savedDraft = editing ? drafts.find((d) => d.id === editing.id) : null;
  const draftDirty = Boolean(
    editing &&
      savedDraft &&
      (JSON.stringify(editing.scenario) !==
        JSON.stringify(savedDraft.scenario) ||
        editing.resolution !== savedDraft.resolution),
  );

  return (
    <div className={styles.root}>
      <header className={styles.top}>
        <Link
          href={globalAdmin ? '/admin' : '/admin/noraRedTeam'}
          className={styles.brand}
        >
          <ArrowLeft size={16} /> pulse <span>/ Nora Testing</span>
        </Link>
        <nav aria-label="Nora testing">
          {(['scenarios', 'chat', 'history', 'coverage', 'safety'] as const).map(
            (t) => (
              <button
                key={t}
                aria-current={tab === t ? 'page' : undefined}
                className={tab === t ? styles.active : ''}
                onClick={() => setTab(t)}
              >
                {t === 'safety'
                  ? 'Safety & Security'
                  : t === 'chat' ? 'Chat Simulation' : t[0].toUpperCase() + t.slice(1)}
              </button>
            ),
          )}
        </nav>
        <span className={styles.environment}>
          {dev ? 'Development' : 'Production'} evidence
        </span>
      </header>
      <main className={styles.main}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>
              A daily habit. A better Nora.
            </span>
            <h1>Test Nora</h1>
            <p>Choose a scenario, run a check, and review Nora’s response.</p>
          </div>
          <div className={styles.actions}>
            <button
              onClick={() => {
                setShowAdd(true);
                setEditing(null);
              }}
            >
              <Plus size={16} /> Add a situation
            </button>
            <button
              className={styles.primary}
              disabled={working}
              onClick={() =>
                void act(async () => {
                  await request('suite', { target });
                  await refresh();
                  setNotice(
                    'Daily check started. You can return later to review the results.',
                  );
                })
              }
            >
              <Play size={16} />
              {suiteRunning ? 'Daily check running' : 'Run daily check'}
            </button>
          </div>
        </div>
        {error && (
          <div className={styles.error} role="alert">
            {error}
            <button onClick={() => void act(refresh)}>Try again</button>
          </div>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
        <section className={styles.summary} aria-label="Latest check">
          <div>
            <CheckCircle2 size={20} />
            <div>
              <strong>
                {suite
                  ? suiteRunning
                    ? 'Daily check in progress'
                    : suite.status === 'failed'
                      ? 'Daily check could not finish'
                      : suite.scheduled &&
                          suite.version !== NORA_RED_TEAM_VERSION
                        ? 'Earlier scheduled check'
                        : 'Latest daily check'
                  : 'Ready for your first daily check'}
              </strong>
              <p>
                {suite
                  ? `${when(suite.createdAt)} · ${suite.completedScenarioIds.length} of ${suite.scenarioIds.length} scenarios attempted`
                  : 'The daily check runs the approved library and saved regressions.'}
              </p>
              {suite?.error && (
                <p className={styles.warning}>{suite.error.slice(0, 180)}</p>
              )}
            </div>
          </div>
          <div>
            <strong>{pending.length} to review</strong>
            <p>
              {reviewSet.length - pending.length} reviewed · {openIssues.length}{' '}
              open issues
            </p>
          </div>
          <button
            onClick={() => {
              setTab('scenarios');
              setFilter('review');
              if (pending[0]) {
                select(pending[0].scenarioId);
                setSelectedRun(pending[0].runId);
              }
            }}
          >
            Review results <ChevronRight size={16} />
          </button>
        </section>
        {!owner && (
          <p className={styles.warning}>
            Choose a review owner in Team settings below. Sensitive results and
            draft approvals need an owner.
          </p>
        )}
        {tab === 'scenarios' && (
          <div className={styles.workspace}>
            <aside className={styles.sidebar}>
              <div className={styles.listHeader}>
                <h2>
                  Scenarios <span>{scenarios.length}</span>
                </h2>
                <label className={styles.search}>
                  <Search size={16} />
                  <input
                    aria-label="Search scenarios"
                    placeholder="Find a situation…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className={styles.filters}>
                  {[
                    ['all', 'All'],
                    ['review', 'Needs review'],
                    ['notrun', 'Not run'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={filter === id}
                      className={filter === id ? styles.active : ''}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.scenarioList}>
                {visible.map((s) => {
                  const h = latest.get(s.id);
                  const draft = drafts.find((d) => d.id === s.id);
                  return (
                    <button
                      key={s.id}
                      className={`${styles.scenario} ${current.id === s.id ? styles.selected : ''}`}
                      onClick={() => {
                        select(s.id);
                        if (filter === 'review')
                          setSelectedRun(
                            pending.find((h) => h.scenarioId === s.id)?.runId ||
                              '',
                          );
                      }}
                    >
                      <span className={styles.eyebrow}>{s.familyLabel}</span>
                      <strong>{s.title}</strong>
                      <span
                        className={
                          h && h.verdict !== 'pass'
                            ? styles.warning
                            : styles.muted
                        }
                      >
                        {jobId && job?.scenarioId === s.id
                          ? 'Running…'
                          : draft?.status === 'draft'
                            ? 'Draft'
                            : h
                              ? h.review?.state === 'needs_owner'
                                ? 'With owner'
                                : h.verdict === 'pass'
                                  ? 'Passed'
                                  : h.verdict === 'fail'
                                    ? 'Needs a fix'
                                    : 'Needs review'
                              : 'Not run'}
                      </span>
                      {h &&
                        (h.verdict !== 'pass' ||
                          pending.some((r) => r.runId === h.runId)) && (
                          <small>{concern(h)}</small>
                        )}
                    </button>
                  );
                })}
                {!visible.length && (
                  <p className={styles.empty}>No scenarios match this view.</p>
                )}
              </div>
            </aside>
            <section className={styles.detail} aria-label="Selected scenario">
              <div className={styles.detailHeading}>
                <div>
                  <span className={styles.eyebrow}>
                    {current.familyLabel}
                    {currentDraft?.status === 'draft' ? ' · Draft' : ''}
                  </span>
                  <h2>{current.title}</h2>
                  <p>{current.description}</p>
                </div>
                <button
                  disabled={working}
                  className={styles.primary}
                  onClick={() => void run(current)}
                >
                  <Play size={15} />
                  {currentDraft?.status === 'draft'
                    ? 'Try this test'
                    : 'Run this scenario'}
                </button>
              </div>
              <button
                onClick={() => {
                  setDescription(
                    `A variation of: ${current.title}. ${current.description}`,
                  );
                  setEditing(null);
                  setShowAdd(true);
                }}
              >
                Create a variation
              </button>
              <details className={styles.expectations}>
                <summary>What Nora should do</summary>
                <ul>
                  {current.contractRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </details>
              {currentDraft?.status === 'draft' && (
                <button
                  onClick={() => {
                    setEditing(currentDraft);
                    setShowAdd(true);
                  }}
                >
                  Edit draft and review approval
                </button>
              )}
              {jobId && job?.scenarioId === current.id && (
                <div className={styles.notice} role="status">
                  <RefreshCw size={15} /> {job.progress.message}
                  <progress max={100} value={job.progress.percent} />
                  <button
                    onClick={() =>
                      void act(async () => {
                        await request('run', { jobId }, 'DELETE');
                        setNotice('Stopping this scenario.');
                      })
                    }
                  >
                    Stop run
                  </button>
                </div>
              )}
              {loading ? (
                <p className={styles.empty}>Loading protected results…</p>
              ) : record ? (
                <>
                  {(record.run.version !== NORA_RED_TEAM_VERSION ||
                    !record.run.usefulness) && (
                    <p className={styles.warning}>
                      Earlier test version. Run this scenario again to include
                      the new usefulness and review checks.
                    </p>
                  )}
                  <div className={styles.resultHeading}>
                    <strong>
                      {record.verdict === 'pass'
                        ? 'Automated checks passed'
                        : record.verdict === 'fail'
                          ? 'A concern needs a fix'
                          : 'Review this result'}
                    </strong>
                    <span>
                      {when(record.completedAt)} ·{' '}
                      {targetLabel(record.run.platform)}
                    </span>
                    <button onClick={() => setShowPast(!showPast)}>
                      Past runs ({scenarioHistory.length})
                    </button>
                  </div>
                  {showPast && (
                    <div className={styles.past}>
                      {scenarioHistory.map((h) => (
                        <button
                          key={h.runId}
                          onClick={() => setSelectedRun(h.runId)}
                        >
                          {when(h.completedAt)} · {h.verdict}{' '}
                          {h.review
                            ? `· ${h.review.state.replace(/_/g, ' ')}`
                            : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  {(record.verdict !== 'pass' ||
                    pending.some((h) => h.runId === record.runId)) && (
                    <div className={styles.concern}>
                      <AlertTriangle size={18} />
                      <div>
                        <strong>
                          {record.verdict === 'pass'
                            ? 'Why this is in your review'
                            : 'What to look for'}
                        </strong>
                        <p>{concern(record)}</p>
                      </div>
                    </div>
                  )}
                  <h3>
                    Test conversation{' '}
                    <span className={styles.muted}>Synthetic athlete</span>
                  </h3>
                  <div className={styles.conversation}>
                    {record.run.turns.map((t) => (
                      <article key={t.turn}>
                        <div className={styles.athlete}>
                          <span>Athlete · Turn {t.turn}</span>
                          <p>{t.athleteMessage}</p>
                        </div>
                        <div className={styles.nora}>
                          <span>Nora</span>
                          <p>{t.noraResponse}</p>
                        </div>
                        {record.run.usefulness?.turns.find(
                          (u) =>
                            u.turn === t.turn && (!u.helpful || !u.appropriate),
                        ) && (
                          <p className={styles.warning}>
                            {
                              record.run.usefulness.turns.find(
                                (u) => u.turn === t.turn,
                              )?.concern
                            }
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                  <section className={styles.review}>
                    <h3>Your review</h3>
                    <p>
                      Read the full exchange. Confirm safety and whether Nora
                      helped.
                    </p>
                    {(
                      [
                        ['Appropriate and safe?', safe, setSafe],
                        ['Helpful?', helpful, setHelpful],
                      ] as const
                    ).map(([label, value, setter]) => (
                      <fieldset key={label}>
                        <legend>{label}</legend>
                        {(['yes', 'no', 'unsure'] as const).map((answer) => (
                          <label key={answer}>
                            <input
                              type="radio"
                              name={label}
                              checked={value === answer}
                              onChange={() => setter(answer)}
                            />
                            {answer[0].toUpperCase() + answer.slice(1)}
                          </label>
                        ))}
                      </fieldset>
                    ))}
                    <label className={styles.field}>
                      Note{' '}
                      {safe === 'no' ||
                      safe === 'unsure' ||
                      helpful === 'no' ||
                      helpful === 'unsure'
                        ? '(describe the concern)'
                        : '(optional)'}
                      <textarea
                        value={note}
                        maxLength={2000}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What should the next reviewer know?"
                      />
                    </label>
                    <div className={styles.actions}>
                      <span className={styles.muted}>
                        {record.review?.state === 'needs_owner'
                          ? `Assigned to ${owner || 'review owner'}`
                          : 'Saved reviews remain linked to this result.'}
                      </span>
                      <button
                        className={styles.primary}
                        disabled={busy || !safe || !helpful}
                        onClick={() => void saveReview()}
                      >
                        Save and review next <ChevronRight size={16} />
                      </button>
                    </div>
                  </section>
                  {(record.verdict !== 'pass' ||
                    record.review?.state === 'needs_fix') &&
                    record.releaseStatus !== 'resolved' && (
                      <section className={styles.followUp}>
                        <h3>Fix and retest</h3>
                        <p>
                          Owner: {owner || 'Choose an owner in Team settings'}.
                          Keep this case, rerun it after the fix, and review the
                          new result.
                        </p>
                        <div className={styles.actions}>
                          <button
                            disabled={busy || record.promotedRegression}
                            onClick={() =>
                              void act(async () => {
                                await request('history', {
                                  action: 'promote_regression',
                                  runId: record.runId,
                                  scenarioId: current.id,
                                });
                                await refresh();
                              })
                            }
                          >
                            {record.promotedRegression
                              ? 'Saved as regression'
                              : 'Keep as regression'}
                          </button>
                          <button
                            disabled={working}
                            onClick={() => void run(current)}
                          >
                            Retest this scenario
                          </button>
                          {isOwner && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void act(async () => {
                                  const retest = scenarioHistory.find(
                                    (h) =>
                                      h.completedAt > record.completedAt &&
                                      h.verdict === 'pass' &&
                                      h.review?.state === 'complete',
                                  );
                                  if (!retest)
                                    throw new Error(
                                      'Complete and review a passing retest first.',
                                    );
                                  await request('history', {
                                    action: 'resolve',
                                    runId: record.runId,
                                    retestId: retest.runId,
                                  });
                                  await refresh();
                                  setNotice(
                                    'Issue closed with a reviewed retest.',
                                  );
                                })
                              }
                            >
                              Close with passing retest
                            </button>
                          )}
                        </div>
                      </section>
                    )}
                  <details className={styles.technical}>
                    <summary>Technical evidence</summary>
                    <p>
                      Build: {record.run.build} · Rules:{' '}
                      {record.run.contractVersion}
                    </p>
                    <p>Original judge scores and findings remain preserved.</p>
                    <pre>
                      {JSON.stringify(
                        {
                          checks: record.run.checkResults,
                          judge: record.run.judge,
                          adjudication: record.run.adjudication,
                          usefulness: record.run.usefulness,
                          staging: record.run.stagingEvidence,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </>
              ) : (
                <div className={styles.empty}>
                  <Play size={28} />
                  <h3>See how Nora handles this situation</h3>
                  <p>
                    Run the scenario to create a conversation, then review the
                    result here.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
        {tab === 'history' && (
          <section className={styles.panel}>
            <h2>Run history</h2>
            <p>
              Latest {history.length} saved results. Select a result to read the
              conversation and its review.
            </p>
            <div className={styles.history}>
              {history.map((h) => (
                <button
                  key={h.runId}
                  onClick={() => {
                    setTarget(
                      h.run.platform === 'web-staging-chat'
                        ? 'staging_chat'
                        : 'policy_sandbox',
                    );
                    select(h.scenarioId);
                    setSelectedRun(h.runId);
                    setTab('scenarios');
                  }}
                >
                  <span>
                    <strong>{h.scenarioTitle}</strong>
                    <small>
                      {when(h.completedAt)} · {targetLabel(h.run.platform)}
                    </small>
                  </span>
                  <span>
                    {h.verdict} ·{' '}
                    {h.releaseStatus === 'resolved'
                      ? 'Resolved'
                      : h.review?.state.replace(/_/g, ' ') || 'Unreviewed'}{' '}
                    <ChevronRight size={16} />
                  </span>
                </button>
              ))}
            </div>
            {!history.length && (
              <p className={styles.empty}>
                Your completed runs will appear here.
              </p>
            )}
          </section>
        )}
        <div hidden={tab !== 'chat'}><ChatSimulation retryReview={(messages,reply)=>request('chat-simulation',{messages,reply,syntheticOnly:true,reviewOnly:true})} send={(messages) => request('chat-simulation', { messages, syntheticOnly: true })} /></div>
        {tab === 'safety' && (
          <DataPrivacyMatrix
            runSimulation={async (onProgress) => {
              const batches = [];
              for (let offset = 0; offset < PRIVACY_CASES.length; offset += 10) {
                batches.push(await request('privacy', { offset }));
                onProgress(batches.reduce((total, batch) => total + batch.results.length, 0));
              }
              return {
                ...batches[batches.length - 1],
                results: batches.flatMap((batch) => batch.results),
              };
            }}
          />
        )}
        {tab === 'coverage' && (
          <section className={styles.panel}>
            <h2>Coverage</h2>
            <p>
              Coverage reflects the latest saved results for the selected
              target. It shows tested responsibilities, not every possible
              conversation.
            </p>
            <div className={styles.coverage}>
              {familyRows.map((row) => (
                <button
                  key={row.family}
                  onClick={() => {
                    setQuery(row.family);
                    setFilter('all');
                    setTab('scenarios');
                  }}
                >
                  <strong>{row.family}</strong>
                  <span>{row.cases.length} approved scenarios</span>
                  <span
                    className={
                      row.status === 'Needs attention' ? styles.warning : ''
                    }
                  >
                    {row.status}
                  </span>
                </button>
              ))}
            </div>
            <h3>Device and workflow checks</h3>
            <p>
              Native screens, reminders and completion saves need direct device
              or integration evidence. Conversation checks alone leave these
              areas pending.
            </p>
            <ul>
              <li>iOS and Android consent and support routing</li>
              <li>Unavailable support contacts and delivery recovery</li>
              <li>
                Completion saves, stale assignments and duplicate reminders
              </li>
            </ul>
            <button
              onClick={() => {
                setShowAdd(true);
                setEditing(null);
              }}
            >
              Add a missing situation
            </button>
            <details className={styles.settings}>
              <summary>Record a completed device check</summary>
              <p>
                The production review owner records direct device evidence.
                Check consent, support routing, completion persistence,
                assignment freshness and reminder duplication.
              </p>
              <label className={styles.field}>
                Platform
                <select
                  value={devicePlatform}
                  onChange={(e) => setDevicePlatform(e.target.value)}
                >
                  <option value="ios">iOS</option>
                  <option value="android">Android</option>
                </select>
              </label>
              <label className={styles.field}>
                Release commit
                <input
                  value={deviceBuild}
                  onChange={(e) => setDeviceBuild(e.target.value)}
                  placeholder="Full commit of the tested release"
                />
              </label>
              <label className={styles.field}>
                Evidence notes
                <textarea
                  value={deviceNote}
                  onChange={(e) => setDeviceNote(e.target.value)}
                  placeholder="Device and app version, steps checked, observed outcome, and evidence reference"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={devicePassed}
                  onChange={(e) => setDevicePassed(e.target.checked)}
                />{' '}
                All listed workflow checks passed
              </label>
              <button
                disabled={busy || deviceNote.length < 20}
                onClick={() =>
                  void act(async () => {
                    await request('devices', {
                      platform: devicePlatform,
                      build: deviceBuild,
                      note: deviceNote,
                      passed: devicePassed,
                    });
                    await refresh();
                    setNotice('Device evidence saved.');
                  })
                }
              >
                Save device evidence
              </button>
            </details>
            {devices.map((d, i) => (
              <p key={i}>
                {d.platform.toUpperCase()} ·{' '}
                {d.passed ? 'Passed' : 'Needs attention'} · {when(d.reviewedAt)}{' '}
                · {d.note}
              </p>
            ))}
          </section>
        )}
        <details className={styles.settings}>
          <summary>Team settings and test setup</summary>
          <label className={styles.field}>
            Test target
            <select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value as NoraRedTeamTarget);
                setSelectedRun('');
              }}
              disabled={working}
            >
              <option value="policy_sandbox">Draft policy experiment (separate model)</option>
              <option value="staging_chat" disabled={!dev}>
                Real staging chat (development database)
              </option>
            </select>
          </label>
          <p>
            Daily checks run the approved library plus regressions. Two passing
            conversations rotate into the review list alongside flagged results.
            Automated completion and human review are tracked separately.
          </p>
          <h3>Testing team</h3>
          <p>
            Add each person by their exact sign-in email. Company and external
            email addresses work the same way. Reviewers can run and review
            tests. Owners approve scenarios and manage reviewers. Only the
            primary account can add or remove owners.
          </p>
          {members.map((member) => (
            <div className={styles.teamMember} key={member.email}>
              <span>{member.email}</span>
              <strong>{member.role === 'owner' ? 'Owner' : 'Reviewer'}</strong>
              {isOwner && (member.role === 'reviewer' || canManageOwners) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await request(
                        'access',
                        {
                          members: members.filter(
                            (m) => m.email !== member.email,
                          ),
                          revision: teamRevision,
                        },
                        'PUT',
                      );
                      await refresh();
                    })
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {!members.length && globalAdmin && canManageOwners && (
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await request(
                    'access',
                    {
                      members: [{ email, role: 'owner' }],
                      revision: teamRevision,
                    },
                    'PUT',
                  );
                  await refresh();
                  setNotice('Your account is now a Nora testing owner.');
                })
              }
            >
              Make me the first owner
            </button>
          )}
          {isOwner && (
            <>
              <label className={styles.field}>
                Team member’s sign-in email
                <input
                  type="email"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  placeholder="name@company.com or external email"
                />
              </label>
              <label className={styles.field}>
                Role
                <select
                  value={memberRole}
                  onChange={(e) =>
                    setMemberRole(e.target.value as 'owner' | 'reviewer')
                  }
                >
                  <option value="reviewer">Reviewer</option>
                  {canManageOwners && <option value="owner">Owner</option>}
                </select>
              </label>
              <button
                disabled={busy || !newOwner}
                onClick={() =>
                  void act(async () => {
                    await request(
                      'access',
                      {
                        members: [
                          ...members,
                          { email: newOwner, role: memberRole },
                        ],
                        revision: teamRevision,
                      },
                      'PUT',
                    );
                    await refresh();
                    setNewOwner('');
                    setNotice(
                      'Access added. Share the Nora Testing page with this person; they must sign in with that verified email.',
                    );
                  })
                }
              >
                Add team member
              </button>
            </>
          )}
          <p>
            Access is limited to Nora Testing. Domains are never added
            automatically. Removing someone takes effect on their next request.
            Keep at least one owner.
          </p>
        </details>
      </main>
      {showAdd && (
        <div className={styles.overlay}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-title"
          >
            <div className={styles.detailHeading}>
              <h2 id="draft-title">
                {editing ? 'Review scenario draft' : 'Add a situation'}
              </h2>
              <button
                aria-label="Close scenario editor"
                onClick={() => setShowAdd(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p className={styles.eyebrow}>
              Describe → Review draft → Try → Approve
            </p>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {notice && <p className={styles.notice}>{notice}</p>}
            {!editing ? (
              <>
                <label className={styles.field}>
                  What do you want to test?
                  <textarea
                    autoFocus
                    value={description}
                    maxLength={2000}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="An athlete agrees to send a coach message, then changes their mind before it sends."
                  />
                </label>
                <p>
                  Use invented people and details. AI drafts the situation using
                  the approved Nora rules.
                </p>
                {similar.length > 0 && (
                  <div className={styles.past}>
                    <strong>
                      Related scenarios. You may already have a starting point.
                    </strong>
                    {similar.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          select(s.id);
                          setShowAdd(false);
                          setTab('scenarios');
                        }}
                      >
                        {s.title}
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className={styles.primary}
                  disabled={busy || description.trim().length < 12}
                  onClick={() =>
                    void act(async () => {
                      const data = await request('library', { description });
                      setEditing(data.draft);
                      await refresh();
                    })
                  }
                >
                  {busy ? 'Creating draft…' : 'Create draft'}
                </button>
                <h3>Saved drafts</h3>
                {drafts
                  .filter((d) => d.status === 'draft')
                  .map((d) => (
                    <button key={d.id} onClick={() => setEditing(d)}>
                      {d.scenario.title}
                    </button>
                  ))}
              </>
            ) : (
              <>
                {(
                  [
                    ['Title', 'title'],
                    ['Situation', 'description'],
                    ['Athlete’s first message', 'seedAthleteMessage'],
                    ['Follow-up message', 'fixedFinalAthleteMessage'],
                  ] as const
                ).map(([label, field]) => (
                  <label key={field} className={styles.field}>
                    {label}
                    <textarea
                      value={editing.scenario[field] || ''}
                      maxLength={field === 'title' ? 140 : 2000}
                      onChange={(e) => updateDraft(field, e.target.value)}
                    />
                  </label>
                ))}
                <h3>Expected behavior from the approved rules</h3>
                <ul>
                  {editing.scenario.contractRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
                <details>
                  <summary>Failure criteria</summary>
                  <ul>
                    {editing.scenario.checks.map((c) => (
                      <li key={c.id}>{c.label}</li>
                    ))}
                  </ul>
                </details>
                {editing.questions.length > 0 && (
                  <>
                    <h3>Questions for the owner</h3>
                    <ul>
                      {editing.questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                    <label className={styles.field}>
                      How do the approved rules address these questions?
                      <textarea
                        value={editing.resolution}
                        onChange={(e) =>
                          setEditing({ ...editing, resolution: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                <p>
                  Save edits, try the test, and review its result. The owner can
                  then approve the saved version into the library.
                </p>
                <div className={styles.actions}>
                  <button disabled={busy} onClick={() => void saveDraft()}>
                    Save draft
                  </button>
                  <button
                    disabled={working || draftDirty}
                    onClick={() => void run(editing.scenario)}
                  >
                    Try saved draft
                  </button>
                  <button
                    className={styles.primary}
                    disabled={busy || !isOwner || draftDirty}
                    onClick={() =>
                      void act(async () => {
                        await request(
                          'library',
                          {
                            id: editing.id,
                            revision: editing.revision,
                            action: 'approve',
                          },
                          'PATCH',
                        );
                        await refresh();
                        setShowAdd(false);
                        setNotice(
                          'Scenario approved and included in future daily checks.',
                        );
                      })
                    }
                  >
                    Approve for library
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
