import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import { getLinearCurriculumSnapshot } from '../../api/firebase/dailyCurriculum/linearCurriculum';
import type { ModuleInsight } from '../../api/firebase/dailyCurriculum/moduleInsights';

interface InsightsResponse {
  status: 'complete' | 'partial' | 'unavailable';
  window: { start: number; end: number };
  modules: ModuleInsight[];
  coverage?: { assignments: number; events: number; completions: number; unresolvedLinks: number };
  warnings: string[];
}
const DAY_MS = 86_400_000;
const dateText = (date: Date) => date.toISOString().slice(0, 10);
const percent = (value: number | null) => value === null ? 'Unavailable' : `${Math.round(value * 100)}%`;
const catalog = getLinearCurriculumSnapshot();
const labels = new Map([...catalog.active, ...catalog.candidates].flatMap(entry =>
  [entry.id, ...entry.aliases, ...entry.sourceRefs.map(ref => ref.slice(ref.indexOf('/') + 1))]
    .map(id => [id, { name: entry.name, type: entry.type }] as const)));

export default function ModuleInsightsPanel() {
  const [from, setFrom] = useState(() => dateText(new Date(Date.now() - 29 * DAY_MS)));
  const [to, setTo] = useState(() => dateText(new Date()));
  const [range, setRange] = useState(() => ({ from, to }));
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true); setError(''); setData(null);
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Sign in with an administrator account to view module insights.');
        const token = await user.getIdToken();
        const start = new Date(`${range.from}T00:00:00.000Z`);
        const end = new Date(new Date(`${range.to}T00:00:00.000Z`).getTime() + DAY_MS);
        const query = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
        const response = await fetch(`/api/admin/curriculum/insights?${query}`, {
          headers: { Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders() },
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok && !(response.status === 503 && payload.status === 'unavailable')) throw new Error(typeof payload.error === 'string' ? payload.error : 'Module insights could not be loaded.');
        if (!['complete', 'partial', 'unavailable'].includes(payload.status) || !Array.isArray(payload.modules)) {
          throw new Error('Module insights returned an unexpected response. Please retry.');
        }
        if (!controller.signal.aborted) setData(payload);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Module insights could not be loaded.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [range, attempt]);

  const applyRange = (event: React.FormEvent) => {
    event.preventDefault();
    const start = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`) + DAY_MS;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 93 * DAY_MS) {
      setValidation('Choose a start and end date covering between 1 and 93 days.'); return;
    }
    setValidation(''); setRange({ from, to });
  };
  return <section className="space-y-5" aria-labelledby="module-insights-title">
    <div><h2 id="module-insights-title" className="text-xl font-semibold text-stone-950">Module insights</h2>
      <p className="mt-1 text-sm text-stone-600">Aggregate practice activity and self-reported helpfulness for each skill.</p></div>
    <form onSubmit={applyRange} className="flex flex-wrap items-end gap-3">
      <label className="text-sm text-stone-700">Start date<input type="date" required value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-stone-300 bg-white px-3 py-2" /></label>
      <label className="text-sm text-stone-700">End date<input type="date" required value={to} onChange={e => setTo(e.target.value)} className="mt-1 block rounded-lg border border-stone-300 bg-white px-3 py-2" /></label>
      <button type="submit" disabled={loading} className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Apply dates</button>
      <button type="button" onClick={() => setAttempt(value => value + 1)} disabled={loading} className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className="h-4 w-4" />{error ? 'Retry' : 'Refresh'}</button>
    </form>
    <p className="text-xs text-stone-500">Dates include both selected days in UTC. Maximum window: 93 days. Totals describe observed records; historical recording coverage can vary.</p>
    <p className="text-sm text-stone-600">For individual and team participation, open the <a href="/admin/pulsecheckPilotDashboard" className="font-medium text-stone-900 underline underline-offset-2">pilot dashboard</a>.</p>
    {validation && <p role="alert" className="text-sm text-rose-800">{validation}</p>}
    {loading ? <p role="status" className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-5 text-stone-600"><Loader2 className="h-4 w-4 animate-spin" />Loading module insights…</p> : error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</p> : data && <>
      <div className={`rounded-xl border p-4 text-sm ${data.status === 'complete' ? 'border-stone-200 bg-white text-stone-700' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
        <p className="font-semibold">{data.status === 'complete' ? 'Required activity queries completed' : data.status === 'partial' ? 'Activity coverage is incomplete' : 'Activity coverage is unavailable'}</p>
        {data.status !== 'complete' && <p className="mt-1">Module totals are withheld until the required activity sources can be read completely.</p>}
        {data.coverage && <p className="mt-2 text-xs">Records checked: {data.coverage.assignments} assignments, {data.coverage.events} activity events, {data.coverage.completions} practice completions. Unresolved links: {data.coverage.unresolvedLinks}.</p>}
        {data.warnings?.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      </div>
      {data.status === 'complete' && (data.modules.length === 0 ? <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-600">No linked practice activity was found for these dates.</p> : <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm"><caption className="sr-only">Module activity from {range.from} through {range.to}, UTC</caption>
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-700"><tr>{['Skill', 'Starters', 'Completed among starters', 'Completed assignments', 'Repeat use', 'Helpfulness (self-report)', 'Follow-on assessment'].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{data.modules.map(row => { const label = labels.get(row.moduleId); return <tr key={row.moduleId} className="border-b border-stone-100 last:border-0">
            <th scope="row" className="min-w-48 px-4 py-4 font-medium text-stone-950">{label?.name || row.moduleId}<span className="mt-1 block text-xs font-normal capitalize text-stone-500">{label?.type || 'Catalog label unavailable'}</span></th>
            <td className="px-4 py-4">{row.uniqueStarters}</td>
            <td className="px-4 py-4">{percent(row.completionOfStarters.rate)}<span className="block text-xs text-stone-500">{row.completionOfStarters.numerator} / {row.completionOfStarters.denominator} starters</span></td>
            <td className="px-4 py-4">{row.completedSessions}<span className="block text-xs text-stone-500">{row.uniqueCompleters} distinct completers</span></td>
            <td className="px-4 py-4">{percent(row.repeatUse.rate)}<span className="block text-xs text-stone-500">{row.repeatUse.numerator} / {row.repeatUse.denominator} completers repeated</span><span className="block text-xs text-stone-500">{row.repeatUse.additionalSessions} additional completed assignments</span></td>
            <td className="px-4 py-4">{row.usefulness.average === null ? 'Unavailable' : `${row.usefulness.average.toFixed(1)} / 5`}<span className="block text-xs text-stone-500">{row.usefulness.respondentRecords} rated assignments</span></td>
            <td className="max-w-64 px-4 py-4 text-stone-600">Unavailable<span className="mt-1 block text-xs">{row.followOnAssessment.reason}</span></td>
          </tr>; })}</tbody>
        </table>
      </div>)}
      <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600"><summary className="cursor-pointer font-medium text-stone-900">How to read these measures</summary><div className="mt-3 space-y-2">
        <p>Starters have a recorded practice start. Completion among starters counts those who also completed that assigned practice within the selected window.</p>
        <p>Completed assignments count each assignment once across linked completion records and events. Repeat use counts completers with more than one completed assignment in the window. Unlinked completion records and their ratings are excluded because they cannot be reliably deduplicated.</p>
        <p>Helpfulness is the average recorded 1–5 self-report rating. Its denominator is rated assignments; one person may rate multiple assignments.</p>
        <p>These measures describe participation and self-reported helpfulness. Follow-on assessment remains unavailable until module linkage and eligibility are verified.</p>
      </div></details>
    </>}
  </section>;
}
