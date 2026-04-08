import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCcw, Wrench, X } from 'lucide-react';

type StudyMetricsScopeStatus = {
  status?: string | null;
  startedAt?: any;
  completedAt?: any;
  updatedAt?: any;
  lastError?: string | null;
};

type StudyMetricsStatusModalProps = {
  isOpen: boolean;
  pilotName?: string;
  healthLevel: 'healthy' | 'stale' | 'broken';
  refreshScope?: StudyMetricsScopeStatus | null;
  repairScope?: StudyMetricsScopeStatus | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
};

const toDateValue = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  return null;
};

const formatTimeValue = (value: any) => {
  const nextDate = toDateValue(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleString();
  }
  return nextDate ? nextDate.toLocaleString() : 'Not recorded';
};

const normalizeStatusLabel = (value: string | null | undefined) => {
  const nextValue = (value || '').trim();
  if (!nextValue) return 'No status recorded';
  return nextValue
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const STATUS_TONE: Record<
  StudyMetricsStatusModalProps['healthLevel'],
  { badgeClassName: string; label: string; helper: string; icon: React.ReactNode }
> = {
  healthy: {
    badgeClassName: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    label: 'Healthy',
    helper: 'The latest recorded study-metrics refresh looks current and error-free.',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  stale: {
    badgeClassName: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    label: 'Stale',
    helper: 'The last recorded study-metrics refresh is missing or old enough to review.',
    icon: <Clock3 className="h-5 w-5" />,
  },
  broken: {
    badgeClassName: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    label: 'Needs attention',
    helper: 'A recent study-metrics refresh or repair recorded a non-success status or error.',
    icon: <AlertTriangle className="h-5 w-5" />,
  },
};

const ScopeCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  scope: StudyMetricsScopeStatus | null | undefined;
}> = ({ title, icon, scope }) => (
  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-zinc-200">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{title}</div>
        <div className="mt-2 text-lg font-semibold text-white">{normalizeStatusLabel(scope?.status)}</div>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-zinc-300 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Started</div>
            <div className="mt-2 text-white">{formatTimeValue(scope?.startedAt || scope?.updatedAt)}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Completed</div>
            <div className="mt-2 text-white">{formatTimeValue(scope?.completedAt)}</div>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-zinc-300">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Last issue</div>
          <div className="mt-2 text-white">{scope?.lastError || 'No recorded issue'}</div>
        </div>
      </div>
    </div>
  </div>
);

const StudyMetricsStatusModal: React.FC<StudyMetricsStatusModalProps> = ({
  isOpen,
  pilotName,
  healthLevel,
  refreshScope,
  repairScope,
  refreshing = false,
  onRefresh,
  onClose,
}) => {
  const tone = STATUS_TONE[healthLevel];

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-4xl overflow-hidden rounded-[30px] border border-white/10 bg-[#0f1420] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="study-metrics-status-title"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.08),_transparent_28%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Admin-only status</div>
                  <h2 id="study-metrics-status-title" className="mt-2 text-2xl font-semibold text-white">
                    Study Metrics Refresh Status
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                    This is the background refresh record for the pilot&apos;s study metrics summary. It shows when the last
                    metrics refresh ran and whether the repair pass recorded any issues.
                    {pilotName ? ` Current pilot: ${pilotName}.` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close study metrics status modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
                <div className={`flex flex-col gap-3 rounded-3xl border p-5 sm:flex-row sm:items-center sm:justify-between ${tone.badgeClassName}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{tone.icon}</div>
                    <div>
                      <div className="text-sm font-semibold">{tone.label}</div>
                      <div className="mt-1 text-sm leading-6 text-inherit/90">{tone.helper}</div>
                    </div>
                  </div>
                  {onRefresh ? (
                    <button
                      type="button"
                      onClick={onRefresh}
                      disabled={refreshing}
                      className="inline-flex items-center gap-2 rounded-2xl border border-current/20 bg-black/10 px-4 py-3 text-sm font-medium transition hover:bg-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                      {refreshing ? 'Refreshing Metrics...' : 'Refresh Metrics'}
                    </button>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <ScopeCard title="Metrics refresh" icon={<RefreshCcw className="h-5 w-5" />} scope={refreshScope} />
                  <ScopeCard title="Scheduled repair" icon={<Wrench className="h-5 w-5" />} scope={repairScope} />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default StudyMetricsStatusModal;
