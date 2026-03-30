import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import {
  getPilotDashboardMetricExplanation,
  type PilotDashboardMetricExplanationKey,
} from './noraMetricCatalog';

interface NoraMetricHelpButtonProps {
  metricKey: PilotDashboardMetricExplanationKey;
  className?: string;
  testId?: string;
}

const NoraMetricHelpButton: React.FC<NoraMetricHelpButtonProps> = ({ metricKey, className = '', testId }) => {
  const [isOpen, setIsOpen] = useState(false);

  const explanation = useMemo(
    () =>
      getPilotDashboardMetricExplanation(metricKey) ?? {
        title: 'Pilot metric help',
        whatItMeans: 'An explanation for this metric is not configured yet.',
        whyItMatters: 'The dashboard keeps rendering, but the help copy should be filled in before this metric is used for review.',
      },
    [metricKey]
  );

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Ask Nora about ${explanation.title}`}
        data-testid={testId}
        className={`inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-400/15 ${className}`.trim()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Nora
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Nora on ${explanation.title}`}
          data-testid={testId ? `${testId}-modal` : undefined}
        >
          <div
            className="w-full max-w-2xl rounded-[28px] border border-cyan-400/20 bg-[#101722] p-6 text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Nora on this metric
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">{explanation.title}</h2>
                  <p className="mt-2 max-w-xl text-sm text-zinc-400">
                    A quick research-partner explanation of what this metric says and how to use it inside the pilot.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsOpen(false);
                }}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                aria-label={`Close Nora explanation for ${explanation.title}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">What This Means</div>
                <p className="mt-2 text-sm leading-6 text-zinc-200">{explanation.whatItMeans}</p>
              </div>

              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-100">What It Means For The Pilot</div>
                <p className="mt-2 text-sm leading-6 text-cyan-50">{explanation.whyItMatters}</p>
              </div>

              {explanation.howToReadIt ? (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">How To Read It</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">{explanation.howToReadIt}</p>
                </div>
              ) : null}

              {explanation.watchFor ? (
                <div className="rounded-3xl border border-amber-400/25 bg-amber-400/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-amber-100">What To Watch For</div>
                  <p className="mt-2 text-sm leading-6 text-amber-50">{explanation.watchFor}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default NoraMetricHelpButton;
