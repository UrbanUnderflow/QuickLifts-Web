import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Edit,
  HeartPulse,
  Link2,
  Plus,
  Search,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  calculateCustomerSuccessAttention,
  type CustomerHealthStatus,
  type CustomerSuccessAttentionReason,
  type LaunchChecklistStatus,
  type MetricMeasurement,
  type PilotPhase,
  type RenewalOutcome,
  type UniversityCustomerSuccess,
  type UniversitySuccessMeasure,
} from '../../utils/pipelistsCustomerSuccess';

export type PipeListsSuccessAccount = {
  id: string;
  title: string;
  organization: string;
  commercialStage: string;
  value: string;
  success: UniversityCustomerSuccess;
};

type PipeListsCustomerSuccessProps = {
  accounts: PipeListsSuccessAccount[];
  canModify: boolean;
  onEdit: (itemId: string) => void;
  onAddUpdate: (itemId: string) => void;
  onOpenLogs: (itemId: string) => void;
};

type SuccessFilter = 'all' | 'needs-attention';

const phaseLabels: Record<PilotPhase, string> = {
  'not-started': 'Needs setup',
  onboarding: 'Onboarding',
  'launch-ready': 'Launch ready',
  active: 'Active pilot',
  'midpoint-review': 'Midpoint review',
  'final-review': 'Final review',
  complete: 'Pilot complete',
  ongoing: 'Ongoing customer',
  renewal: 'Renewal',
  paused: 'Paused',
};

const healthLabels: Record<CustomerHealthStatus, string> = {
  unknown: 'Health unknown',
  'on-track': 'On track',
  watch: 'Watch',
  'at-risk': 'At risk',
};

const healthStyles: Record<CustomerHealthStatus, string> = {
  unknown: 'border-stone-200 bg-stone-50 text-stone-600',
  'on-track': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  watch: 'border-amber-200 bg-amber-50 text-amber-700',
  'at-risk': 'border-rose-200 bg-rose-50 text-rose-700',
};

const severityStyles: Record<CustomerSuccessAttentionReason['severity'], string> = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-stone-200 bg-stone-50 text-stone-600',
};

const formatDate = (value: string) => {
  if (!value) return 'Unscheduled';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};

const latestUpdateLabel = (value: string) => {
  if (!value) return 'Success update missing';
  return `Last success update ${formatDate(value)}`;
};

const attentionSortRank: Record<CustomerSuccessAttentionReason['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const accountAttention = (account: PipeListsSuccessAccount) =>
  calculateCustomerSuccessAttention(account.success, { staleAfterDays: 14, renewalWindowDays: 60 });

export default function PipeListsCustomerSuccess({
  accounts,
  canModify,
  onEdit,
  onAddUpdate,
  onOpenLogs,
}: PipeListsCustomerSuccessProps) {
  const [filter, setFilter] = useState<SuccessFilter>('all');
  const [search, setSearch] = useState('');

  const preparedAccounts = useMemo(
    () =>
      accounts
        .map((account) => ({ account, attention: accountAttention(account) }))
        .sort((left, right) => {
          const leftRank = left.attention.length > 0 ? attentionSortRank[left.attention[0].severity] : 3;
          const rightRank = right.attention.length > 0 ? attentionSortRank[right.attention[0].severity] : 3;
          if (leftRank !== rightRank) return leftRank - rightRank;
          const leftDue = left.account.success.nextAction.dueDate || '9999-12-31';
          const rightDue = right.account.success.nextAction.dueDate || '9999-12-31';
          if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
          return (left.account.organization || left.account.title).localeCompare(
            right.account.organization || right.account.title,
          );
        }),
    [accounts],
  );

  const visibleAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return preparedAccounts.filter(({ account, attention }) => {
      if (filter === 'needs-attention' && attention.length === 0) return false;
      if (!query) return true;
      return [
        account.title,
        account.organization,
        account.commercialStage,
        account.success.nextAction.summary,
        account.success.nextAction.owner,
        account.success.ownership.customerSuccessOwner,
        account.success.ownership.executiveSponsor,
        account.success.ownership.champion,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [filter, preparedAccounts, search]);

  const needsAttention = preparedAccounts.filter(({ attention }) => attention.length > 0).length;
  const liveAccounts = accounts.filter((account) =>
    ['active', 'midpoint-review', 'final-review', 'ongoing'].includes(account.success.pilotPhase),
  ).length;
  const renewalAccounts = preparedAccounts.filter(({ account, attention }) =>
    account.success.pilotPhase === 'renewal' ||
    attention.some((reason) =>
      ['renewal-decision-overdue', 'renewal-decision-upcoming', 'renewal-decision-date-missing'].includes(reason.code),
    ),
  ).length;

  return (
    <div className="space-y-4" data-testid="pipelists-customer-success">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Customer accounts', accounts.length, 'Pilot agreed through renewal', <HeartPulse key="accounts" className="h-4 w-4" />],
          ['Needs attention', needsAttention, 'Clear action, launch, evidence, or renewal reasons', <AlertTriangle key="attention" className="h-4 w-4" />],
          ['Live relationships', liveAccounts, 'Active pilots and ongoing customers', <CheckCircle2 key="live" className="h-4 w-4" />],
          ['Renewal window', renewalAccounts, 'Decision work due inside 60 days', <Calendar key="renewal" className="h-4 w-4" />],
        ].map(([label, value, detail, icon]) => (
          <section key={String(label)} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
                <p className="mt-1 text-2xl font-bold text-stone-950">{value}</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                {icon}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-stone-500">{detail}</p>
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-[220px] flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full rounded-md border border-stone-200 bg-[#FAFAF7] pl-9 pr-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
            placeholder="Search customer accounts"
          />
        </div>
        <div className="inline-flex self-start rounded-full border border-stone-200 bg-[#FAFAF7] p-1">
          {[
            ['all', 'All accounts'],
            ['needs-attention', 'Needs attention'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id as SuccessFilter)}
              className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                filter === id ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visibleAccounts.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleAccounts.map(({ account, attention }) => {
            const success = account.success;
            const requiredLaunchItems = success.launchChecklist.filter((item) => item.required);
            const completedLaunchItems = requiredLaunchItems.filter(
              (item) => item.status === 'complete' || item.status === 'not-applicable',
            );
            const nextActionOwner = success.nextAction.owner || success.ownership.customerSuccessOwner || 'Owner needed';

            return (
              <article key={account.id} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-stone-950">{account.organization || account.title}</h3>
                    {account.organization && account.title !== account.organization && (
                      <p className="mt-0.5 truncate text-xs text-stone-500">{account.title}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {account.commercialStage}
                      </span>
                      <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        {phaseLabels[success.pilotPhase]}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${healthStyles[success.health.status]}`}>
                        {healthLabels[success.health.status]}
                      </span>
                    </div>
                  </div>
                  {account.value && <span className="shrink-0 text-sm font-semibold text-stone-700">{account.value}</span>}
                </div>

                <section className="mt-4 rounded-lg border border-stone-200 bg-[#FAFAF7] p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-stone-700 ring-1 ring-stone-200">
                      <Target className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Next customer action</p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-stone-950">
                        {success.nextAction.summary || 'Add the next customer action'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5" />
                          {nextActionOwner}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(success.nextAction.dueDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {attention.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Attention reasons">
                    {attention.slice(0, 4).map((reason) => (
                      <span
                        key={`${reason.code}-${reason.dueDate}`}
                        title={reason.detail}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severityStyles[reason.severity]}`}
                      >
                        {reason.label}{reason.dueDate ? ` · ${formatDate(reason.dueDate)}` : ''}
                      </span>
                    ))}
                    {attention.length > 4 && (
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-600">
                        +{attention.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-md border border-stone-100 bg-white px-3 py-2">
                    <p className="font-semibold text-stone-700">Launch</p>
                    <p className="mt-1 text-stone-500">
                      {completedLaunchItems.length} of {requiredLaunchItems.length} required steps complete
                    </p>
                  </div>
                  <div className="rounded-md border border-stone-100 bg-white px-3 py-2">
                    <p className="font-semibold text-stone-700">Success evidence</p>
                    <p className="mt-1 text-stone-500">
                      {success.successMeasures.length > 0
                        ? `${success.successMeasures.length} ${success.successMeasures.length === 1 ? 'measure' : 'measures'} · ${latestUpdateLabel(success.lastSuccessUpdateAt)}`
                        : 'Measures and evidence source missing'}
                    </p>
                  </div>
                  <div className="rounded-md border border-stone-100 bg-white px-3 py-2">
                    <p className="font-semibold text-stone-700">Next review</p>
                    <p className="mt-1 text-stone-500">{formatDate(success.nextReviewDate)}</p>
                  </div>
                  <div className="rounded-md border border-stone-100 bg-white px-3 py-2">
                    <p className="font-semibold text-stone-700">PulseCheck data</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-stone-500">
                      <Link2 className="h-3.5 w-3.5" />
                      Connection required; manual evidence only
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 pt-3">
                  <button
                    type="button"
                    onClick={() => onOpenLogs(account.id)}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 px-3 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    History
                  </button>
                  {canModify && (
                    <>
                      <button
                        type="button"
                        onClick={() => onAddUpdate(account.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 px-3 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Success update
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(account.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-full bg-stone-900 px-3 text-xs font-semibold text-white transition hover:bg-stone-700"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Success plan
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-stone-200 bg-white px-5 py-14 text-center">
          <ClipboardCheck className="mx-auto h-6 w-6 text-stone-300" />
          <p className="mt-3 text-sm font-semibold text-stone-900">No customer accounts match this view</p>
          <p className="mt-1 text-sm text-stone-500">
            Customer Success begins when a university reaches Pilot Agreed.
          </p>
        </div>
      )}
    </div>
  );
}

type PipeListsSuccessPlanEditorProps = {
  value: UniversityCustomerSuccess;
  editorName: string;
  onChange: (value: UniversityCustomerSuccess) => void;
};

const measurementInputValue = (measurement: MetricMeasurement) =>
  measurement.state === 'measured' && measurement.value !== null ? String(measurement.value) : '';

const updateMeasurementValue = (measurement: MetricMeasurement, rawValue: string): MetricMeasurement => {
  if (rawValue.trim() === '') return { ...measurement, state: 'missing', value: null };
  const value = Number(rawValue);
  return Number.isFinite(value)
    ? { ...measurement, state: 'measured', value }
    : { ...measurement, state: 'missing', value: null };
};

const emptyMeasurement = (): MetricMeasurement => ({
  state: 'missing',
  value: null,
  asOf: '',
  periodStart: '',
  periodEnd: '',
});

const makeMeasureId = () => `success-measure-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const newSuccessMeasure = (): UniversitySuccessMeasure => ({
  id: makeMeasureId(),
  label: '',
  unit: '',
  baseline: emptyMeasurement(),
  target: emptyMeasurement(),
  latestResult: emptyMeasurement(),
  source: '',
  sourceKind: 'manual',
  owner: '',
  deadline: '',
  notes: '',
});

const inputClassName =
  'h-10 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white';
const labelClassName = 'mb-1.5 block text-xs font-semibold uppercase text-stone-400';

export function PipeListsSuccessPlanEditor({ value, editorName, onChange }: PipeListsSuccessPlanEditorProps) {
  const setSuccess = (recipe: (current: UniversityCustomerSuccess) => UniversityCustomerSuccess) => onChange(recipe(value));

  const updateMeasure = (measureId: string, recipe: (measure: UniversitySuccessMeasure) => UniversitySuccessMeasure) => {
    setSuccess((current) => ({
      ...current,
      successMeasures: current.successMeasures.map((measure) => (measure.id === measureId ? recipe(measure) : measure)),
    }));
  };

  return (
    <section className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4" data-testid="pipelists-success-plan-editor">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">University customer success</p>
        <h3 className="mt-1 text-base font-bold text-stone-950">Guided success plan</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">
          Keep delivery, customer health, proof, and renewal work separate from the commercial stage above.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="block" htmlFor="success-pilot-phase">
          <span className={labelClassName}>Delivery phase</span>
          <select
            id="success-pilot-phase"
            value={value.pilotPhase}
            onChange={(event) => setSuccess((current) => ({ ...current, pilotPhase: event.target.value as PilotPhase }))}
            className={inputClassName}
          >
            {(Object.keys(phaseLabels) as PilotPhase[]).map((phase) => (
              <option key={phase} value={phase}>{phaseLabels[phase]}</option>
            ))}
          </select>
        </label>

        <label className="block" htmlFor="success-health">
          <span className={labelClassName}>Customer health</span>
          <select
            id="success-health"
            value={value.health.status}
            onChange={(event) =>
              setSuccess((current) => ({
                ...current,
                health: {
                  ...current.health,
                  status: event.target.value as CustomerHealthStatus,
                  updatedAt: new Date().toISOString(),
                  updatedBy: editorName,
                },
              }))
            }
            className={inputClassName}
          >
            {(Object.keys(healthLabels) as CustomerHealthStatus[]).map((health) => (
              <option key={health} value={health}>{healthLabels[health]}</option>
            ))}
          </select>
        </label>

        {[
          ['customerSuccessOwner', 'Customer success owner', 'Person accountable for adoption'],
          ['executiveSponsor', 'Executive sponsor', 'University sponsor'],
          ['champion', 'Day-to-day champion', 'Primary working contact'],
        ].map(([key, label, placeholder]) => (
          <label key={key} className="block">
            <span className={labelClassName}>{label}</span>
            <input
              value={value.ownership[key as keyof UniversityCustomerSuccess['ownership']]}
              onChange={(event) =>
                setSuccess((current) => ({
                  ...current,
                  ownership: { ...current.ownership, [key]: event.target.value },
                }))
              }
              className={inputClassName}
              placeholder={placeholder}
            />
          </label>
        ))}

        <label className="block" htmlFor="success-review-date">
          <span className={labelClassName}>Next review date</span>
          <input
            id="success-review-date"
            type="date"
            value={value.nextReviewDate}
            onChange={(event) => setSuccess((current) => ({ ...current, nextReviewDate: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="block md:col-span-2 xl:col-span-4" htmlFor="success-health-reason">
          <span className={labelClassName}>Health context</span>
          <textarea
            id="success-health-reason"
            value={value.health.reason}
            onChange={(event) =>
              setSuccess((current) => ({
                ...current,
                health: { ...current.health, reason: event.target.value },
              }))
            }
            className="min-h-20 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
            placeholder="What evidence supports this health assessment?"
          />
        </label>
      </div>

      <div className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-stone-950">Next customer action</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="block md:col-span-2">
            <span className={labelClassName}>Action</span>
            <input
              value={value.nextAction.summary}
              onChange={(event) =>
                setSuccess((current) => ({
                  ...current,
                  nextAction: { ...current.nextAction, summary: event.target.value, status: 'open' },
                }))
              }
              className={inputClassName}
              placeholder="One concrete action"
            />
          </label>
          <label className="block">
            <span className={labelClassName}>Responsible owner</span>
            <input
              value={value.nextAction.owner}
              onChange={(event) =>
                setSuccess((current) => ({
                  ...current,
                  nextAction: { ...current.nextAction, owner: event.target.value },
                }))
              }
              className={inputClassName}
              placeholder="Owner"
            />
          </label>
          <label className="block">
            <span className={labelClassName}>Due date</span>
            <input
              type="date"
              value={value.nextAction.dueDate}
              onChange={(event) =>
                setSuccess((current) => ({
                  ...current,
                  nextAction: { ...current.nextAction, dueDate: event.target.value },
                }))
              }
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className={labelClassName}>Action status</span>
            <select
              value={value.nextAction.status}
              onChange={(event) =>
                setSuccess((current) => ({
                  ...current,
                  nextAction: {
                    ...current.nextAction,
                    status: event.target.value as UniversityCustomerSuccess['nextAction']['status'],
                  },
                }))
              }
              className={inputClassName}
            >
              <option value="open">Open</option>
              <option value="complete">Complete</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-stone-950">Launch checklist</h4>
            <p className="mt-1 text-xs text-stone-500">Owners and dates make the handoff operational.</p>
          </div>
          <span className="text-xs font-semibold text-stone-500">
            {value.launchChecklist.filter((item) => item.status === 'complete' || item.status === 'not-applicable').length}
            /{value.launchChecklist.length}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {value.launchChecklist.map((item) => (
            <div key={item.id} className="grid gap-2 rounded-md border border-stone-100 bg-[#FAFAF7] p-2 md:grid-cols-[minmax(220px,1fr)_150px_160px_150px]">
              <input
                value={item.label}
                onChange={(event) =>
                  setSuccess((current) => ({
                    ...current,
                    launchChecklist: current.launchChecklist.map((entry) =>
                      entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                    ),
                  }))
                }
                className={inputClassName}
                aria-label="Launch task"
              />
              <select
                value={item.status}
                onChange={(event) => {
                  const status = event.target.value as LaunchChecklistStatus;
                  setSuccess((current) => ({
                    ...current,
                    launchChecklist: current.launchChecklist.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, status, completedAt: status === 'complete' ? new Date().toISOString() : '' }
                        : entry,
                    ),
                  }));
                }}
                className={inputClassName}
                aria-label={`${item.label} status`}
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In progress</option>
                <option value="complete">Complete</option>
                <option value="not-applicable">N/A</option>
              </select>
              <input
                value={item.owner}
                onChange={(event) =>
                  setSuccess((current) => ({
                    ...current,
                    launchChecklist: current.launchChecklist.map((entry) =>
                      entry.id === item.id ? { ...entry, owner: event.target.value } : entry,
                    ),
                  }))
                }
                className={inputClassName}
                placeholder="Owner"
                aria-label={`${item.label} owner`}
              />
              <input
                type="date"
                value={item.dueDate}
                onChange={(event) =>
                  setSuccess((current) => ({
                    ...current,
                    launchChecklist: current.launchChecklist.map((entry) =>
                      entry.id === item.id ? { ...entry, dueDate: event.target.value } : entry,
                    ),
                  }))
                }
                className={inputClassName}
                aria-label={`${item.label} due date`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-stone-950">Success measures</h4>
            <p className="mt-1 text-xs text-stone-500">
              A blank result means missing. Entering 0 records a measured zero.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSuccess((current) => ({ ...current, successMeasures: [...current.successMeasures, newSuccessMeasure()] }))}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-stone-200 px-3 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
          >
            <Plus className="h-3.5 w-3.5" />
            Add measure
          </button>
        </div>

        {value.successMeasures.length > 0 ? (
          <div className="mt-3 space-y-3">
            {value.successMeasures.map((measure, index) => (
              <article key={measure.id} className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Measure {index + 1}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setSuccess((current) => ({
                        ...current,
                        successMeasures: current.successMeasures.filter((entry) => entry.id !== measure.id),
                      }))
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 text-stone-400 transition hover:border-rose-200 hover:text-rose-600"
                    title="Remove measure"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block md:col-span-2">
                    <span className={labelClassName}>Outcome or behavior</span>
                    <input
                      value={measure.label}
                      onChange={(event) => updateMeasure(measure.id, (current) => ({ ...current, label: event.target.value }))}
                      className={inputClassName}
                      placeholder="Weekly athlete check-in rate"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Unit</span>
                    <input
                      value={measure.unit}
                      onChange={(event) => updateMeasure(measure.id, (current) => ({ ...current, unit: event.target.value }))}
                      className={inputClassName}
                      placeholder="%, count, score"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Measure owner</span>
                    <input
                      value={measure.owner}
                      onChange={(event) => updateMeasure(measure.id, (current) => ({ ...current, owner: event.target.value }))}
                      className={inputClassName}
                      placeholder="Owner"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Baseline</span>
                    <input
                      type="number"
                      step="any"
                      value={measurementInputValue(measure.baseline)}
                      onChange={(event) =>
                        updateMeasure(measure.id, (current) => ({
                          ...current,
                          baseline: updateMeasurementValue(current.baseline, event.target.value),
                        }))
                      }
                      className={inputClassName}
                      placeholder="Missing"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Target</span>
                    <input
                      type="number"
                      step="any"
                      value={measurementInputValue(measure.target)}
                      onChange={(event) =>
                        updateMeasure(measure.id, (current) => ({
                          ...current,
                          target: updateMeasurementValue(current.target, event.target.value),
                        }))
                      }
                      className={inputClassName}
                      placeholder="Missing"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Latest result</span>
                    <input
                      type="number"
                      step="any"
                      value={measurementInputValue(measure.latestResult)}
                      onChange={(event) =>
                        updateMeasure(measure.id, (current) => ({
                          ...current,
                          latestResult: updateMeasurementValue(current.latestResult, event.target.value),
                        }))
                      }
                      className={inputClassName}
                      placeholder="Missing"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Result date</span>
                    <input
                      type="date"
                      value={measure.latestResult.asOf.slice(0, 10)}
                      onChange={(event) =>
                        updateMeasure(measure.id, (current) => ({
                          ...current,
                          latestResult: { ...current.latestResult, asOf: event.target.value },
                        }))
                      }
                      className={inputClassName}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className={labelClassName}>Evidence source</span>
                    <input
                      value={measure.source}
                      onChange={(event) => updateMeasure(measure.id, (current) => ({ ...current, source: event.target.value }))}
                      className={inputClassName}
                      placeholder="Customer report, roster export, PulseCheck aggregate"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Evidence mode</span>
                    <select
                      value={measure.sourceKind}
                      onChange={(event) =>
                        updateMeasure(measure.id, (current) => ({
                          ...current,
                          sourceKind: event.target.value as UniversitySuccessMeasure['sourceKind'],
                        }))
                      }
                      className={inputClassName}
                    >
                      <option value="manual">Manual evidence</option>
                      <option value="unconnected">Product source unconnected</option>
                      {measure.sourceKind === 'connected' && (
                        <option value="connected" disabled>Connected aggregate managed by PulseCheck</option>
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Deadline</span>
                    <input
                      type="date"
                      value={measure.deadline}
                      onChange={(event) => updateMeasure(measure.id, (current) => ({ ...current, deadline: event.target.value }))}
                      className={inputClassName}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-dashed border-stone-200 px-4 py-6 text-center text-sm text-stone-500">
            Add the outcomes the university agreed to use when judging the pilot.
          </div>
        )}
      </div>

      <div className="mt-5">
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-stone-950">Contract and renewal</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              ['contractStartDate', 'Contract start'],
              ['contractEndDate', 'Contract end'],
              ['decisionDate', 'Renewal decision date'],
              ['outcomeDate', 'Outcome date'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className={labelClassName}>{label}</span>
                <input
                  type="date"
                  value={value.renewal[key as keyof UniversityCustomerSuccess['renewal']] as string}
                  onChange={(event) =>
                    setSuccess((current) => ({
                      ...current,
                      renewal: { ...current.renewal, [key]: event.target.value },
                    }))
                  }
                  className={inputClassName}
                />
              </label>
            ))}
            <label className="block">
              <span className={labelClassName}>Renewal owner</span>
              <input
                value={value.renewal.owner}
                onChange={(event) => setSuccess((current) => ({ ...current, renewal: { ...current.renewal, owner: event.target.value } }))}
                className={inputClassName}
                placeholder="Owner"
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Renewal outcome</span>
              <select
                value={value.renewal.outcome}
                onChange={(event) =>
                  setSuccess((current) => ({
                    ...current,
                    renewal: { ...current.renewal, outcome: event.target.value as RenewalOutcome },
                  }))
                }
                className={inputClassName}
              >
                <option value="unknown">Unknown</option>
                <option value="pending">Pending</option>
                <option value="renewed">Renewed</option>
                <option value="expanded">Expanded</option>
                <option value="non-renewed">Non-renewed</option>
                <option value="paused">Paused</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className={labelClassName}>Renewal notes</span>
            <textarea
              value={value.renewal.notes}
              onChange={(event) => setSuccess((current) => ({ ...current, renewal: { ...current.renewal, notes: event.target.value } }))}
              className="min-h-20 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
              placeholder="Decision criteria, expansion path, blockers"
            />
          </label>
        </section>
      </div>
    </section>
  );
}
