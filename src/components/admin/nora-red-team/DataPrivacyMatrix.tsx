import { PRIVACY_CASES } from '../../../lib/nora-red-team/privacyCatalog';
import React, { useState } from 'react';
import type { PrivacyResult } from '../../../lib/nora-red-team/privacySimulation';
import styles from './DataPrivacyMatrix.module.css';

const rows = PRIVACY_CASES.map((c) => [
  c.title,
  c.text,
  c.expected === 'performance'
    ? 'Proposed ordinary performance storage with access controls'
    : c.expected === 'restricted'
      ? 'Proposed restricted clinical or reporting storage'
      : 'Protected pending review; clarify purpose and authority',
  c.expected === 'performance'
    ? 'Athlete and specifically authorized roles'
    : 'Designated authorized recipients only',
  `Scenario: ${c.id}. Confirm source, sharing basis, retention and applicable rules.`,
]);

export default function DataPrivacyMatrix({
  runSimulation,
}: {
  runSimulation: (onProgress: (completed: number) => void) => Promise<{
    completedAt: string;
    scope: string;
    results: PrivacyResult[];
    bridge?: {
      verdict: string;
      note: string;
      requestCount: number;
      checks: Array<{ name: string; passed: boolean }>;
    };
  }>;
}) {
  const [completed, setCompleted] = useState(0);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<{
    completedAt: string;
    scope: string;
    results: PrivacyResult[];
    bridge?: {
      verdict: string;
      note: string;
      requestCount: number;
      checks: Array<{ name: string; passed: boolean }>;
    };
  } | null>(null);
  const [error, setError] = useState('');
  async function start() {
    setRunning(true);
    setCompleted(0);
    setError('');
    setReport(null);
    try {
      setReport(await runSimulation(setCompleted));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation could not finish.');
    } finally {
      setRunning(false);
    }
  }
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const visible = rows
    .map((row, index) => ({
      row,
      clinical: PRIVACY_CASES[index].expected !== 'performance',
    }))
    .filter(
      ({ row, clinical }) =>
        (group === 'all' || (group === 'clinical' ? clinical : !clinical)) &&
        row.join(' ').toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <section className={styles.panel} aria-labelledby="privacy-heading">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Safety & Security</p>
          <h2 id="privacy-heading">Data & Privacy matrix</h2>
          <p>What we collect, who can receive it, and what needs review.</p>
        </div>
        <button className={styles.print} onClick={() => window.print()}>
          Print matrix
        </button>
      </div>
      <div className={styles.notice}>
        <strong>
          Draft policy inventory · All {rows.length} entries need review
        </strong>
        <p>
          These are proposed boundaries based on our planning discussion. Actual
          collection and safeguards still need verification. HIPAA applicability
          depends on the organization, purpose and data flow. Each entry starts
          with its legal classification and safeguards unverified.
        </p>
      </div>
      <section aria-label="Privacy simulations" className={styles.notice}>
        <h3>Test the storage boundary</h3>
        <p>
          {PRIVACY_CASES.length} synthetic conversations test model
          classification and a temporary storage prototype. Real Nora
          persistence and AuntEdna delivery require separate integration checks.
        </p>
        <button disabled={running} onClick={() => void start()}>
          {running
            ? 'Running privacy simulations…'
            : '▶ Run privacy simulation'}
        </button>
        <p role="status">
          {running
            ? `Checked ${completed} of ${PRIVACY_CASES.length} conversations. Checking storage and lookup permissions.`
            : report
              ? `${report.results.filter((r) => r.verdict === 'pass').length} passed · ${report.results.filter((r) => r.verdict === 'fail').length} failed · ${report.results.filter((r) => r.verdict === 'error').length} errors`
              : 'Ready. Built-in synthetic examples only.'}
        </p>
        {error && <p role="alert">{error}</p>}
        {report && (
          <>
            <p>{report.scope}</p>
            {report.bridge && (
              <div className={styles.notice}>
                <h4>
                  AuntEdna API wiring: {report.bridge.verdict.toUpperCase()}{' '}
                  (simulation)
                </h4>
                <p>{report.bridge.note}</p>
                <p>
                  {report.bridge.requestCount} requests exercised through the
                  existing bridge.
                </p>
                <ul>
                  {report.bridge.checks.map((c) => (
                    <li key={c.name}>
                      {c.passed ? 'Pass' : 'Fail'}: {c.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p>
              <strong>Reply review required.</strong> Privacy passes cover the
              checks below. Review each reply for usefulness and continuity
              before approving athlete-facing behavior.
            </p>
            <p>
              Results from {new Date(report.completedAt).toLocaleString()}.
              Results remain in this page until reload.
            </p>
            {report.results.map((r) => (
              <details key={r.id} className={styles.details}>
                <summary>
                  {r.title} · {r.verdict.toUpperCase()}
                </summary>
                <p>
                  Matrix category: {r.category}. Expected: {r.expected}. Model:{' '}
                  {r.observed}. Server route: {r.route}.
                </p>
                {r.error && <p>{r.error}</p>}
                <p>Synthetic Nora reply: {r.reply || 'Unavailable'}</p>
                <p>
                  Clinical records: {r.clinicalRecords}. Protected pending
                  records: {r.protectedPendingRecords}.
                </p>
                <strong>Ordinary history</strong>
                <pre
                  style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {r.ordinaryHistory.join('\n') || 'Empty'}
                </pre>
                <p>Mental notes: {r.mentalNotes.join(' · ') || 'Empty'}</p>
                <p>
                  Operational log: {r.operationalLog.join(' · ') || 'Empty'}
                </p>
                <ul>
                  {r.checks.map((c) => (
                    <li key={c.name}>
                      {c.passed ? 'Pass' : 'Fail'}: {c.name}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </>
        )}
      </section>
      <div className={styles.filters}>
        <label>
          Find data
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search data, recipients or next steps"
          />
        </label>
        <label>
          Show
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">All data</option>
            <option value="performance">Performance and coordination</option>
            <option value="clinical">Restricted or unclear data</option>
          </select>
        </label>
        <span>
          {visible.length} of {rows.length} entries
        </span>
      </div>
      <div className={styles.table}>
        <table>
          <caption className={styles.caption}>
            Proposed PulseCheck data boundaries. HIPAA / FERPA applicability:
            needs assessment. Safeguards: unverified. Review owner: unassigned.
          </caption>
          <thead>
            <tr>
              {[
                'Data and examples',
                'Proposed storage',
                'Proposed access',
                'Review status and next step',
              ].map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row }) => (
              <tr key={row[0]}>
                <th scope="row">
                  {row[0]}
                  <small>{row[1]}</small>
                </th>
                <td>{row[2]}</td>
                <td>{row[3]}</td>
                <td>
                  <span className={styles.badge}>Needs review</span>
                  <small>Owner: unassigned</small>
                  {row[4]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p>No entries match. Try a different search or category.</p>
        )}
      </div>
      <details className={styles.details}>
        <summary>How to review an entry</summary>
        <p>
          Trace collection, storage, AI processing, logs, email, recipients and
          deletion. Record the purpose, legal classification, sharing basis,
          agreements, retention, responsible reviewer and supporting tests.
          Track whether HIPAA applies separately from whether safeguards are
          verified.
        </p>
        <p>
          This initial inventory is maintained with the application. Review
          assignments and approvals are pending; the matrix itself grants no
          access to athlete records.
        </p>
      </details>
      <div className={styles.notice}>
        <strong>Unexpected sensitive disclosures</strong>
        <p>
          An athlete can share clinical or assault details in ordinary chat.
          Define restricted handling, permitted sharing and retention or
          preservation before enabling a reporting flow. Automatic deletion
          could remove a report or evidence. Nora testing ownership alone grants
          no safeguarding access.
        </p>
      </div>
      <p className={styles.sources}>
        Review references:{' '}
        <a
          href="https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html"
          target="_blank"
          rel="noreferrer"
        >
          HIPAA roles
        </a>{' '}
        ·{' '}
        <a
          href="https://studentprivacy.ed.gov/resources/joint-guidance-application-ferpa-and-hipaa-student-health-records"
          target="_blank"
          rel="noreferrer"
        >
          FERPA and HIPAA
        </a>{' '}
        ·{' '}
        <a
          href="https://www.hhs.gov/hipaa/for-professionals/faq/2088/does-hipaa-provide-extra-protections-mental-health-information-compared-other-health.html"
          target="_blank"
          rel="noreferrer"
        >
          Psychotherapy notes
        </a>
      </p>
    </section>
  );
}
