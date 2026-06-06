import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';

export type GuidedTourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type GuidedTourStep = {
  selector: string;
  title: string;
  body: string;
  placement?: GuidedTourPlacement;
};

type GuidedTourProps = {
  open: boolean;
  steps: GuidedTourStep[];
  accentColor?: string;
  storageKey?: string;
  onClose: (status: 'completed' | 'dismissed') => void;
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getTargetRect = (selector: string): Rect | null => {
  if (typeof document === 'undefined') return null;
  const target = document.querySelector(selector);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const getTooltipPosition = (
  rect: Rect | null,
  placement: GuidedTourPlacement,
  tooltipWidth: number,
  tooltipHeight: number
) => {
  if (typeof window === 'undefined' || !rect || placement === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const margin = 18;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let top = rect.top + rect.height + margin;
  let left = rect.left + rect.width / 2 - tooltipWidth / 2;

  if (placement === 'top') {
    top = rect.top - tooltipHeight - margin;
  }
  if (placement === 'left') {
    top = rect.top + rect.height / 2 - tooltipHeight / 2;
    left = rect.left - tooltipWidth - margin;
  }
  if (placement === 'right') {
    top = rect.top + rect.height / 2 - tooltipHeight / 2;
    left = rect.left + rect.width + margin;
  }

  if (placement === 'top' && top < margin) {
    top = rect.top + rect.height + margin;
  }
  if (placement === 'bottom' && top + tooltipHeight > viewportHeight - margin) {
    top = rect.top - tooltipHeight - margin;
  }
  if ((placement === 'left' && left < margin) || (placement === 'right' && left + tooltipWidth > viewportWidth - margin)) {
    top = rect.top + rect.height + margin;
    left = rect.left + rect.width / 2 - tooltipWidth / 2;
  }

  return {
    top: `${clamp(top, margin, Math.max(margin, viewportHeight - tooltipHeight - margin))}px`,
    left: `${clamp(left, margin, Math.max(margin, viewportWidth - tooltipWidth - margin))}px`,
    transform: 'none',
  };
};

const GuidedTour: React.FC<GuidedTourProps> = ({
  open,
  steps,
  accentColor = '#00d4aa',
  storageKey,
  onClose,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [positionNonce, setPositionNonce] = useState(0);
  const currentStep = steps[stepIndex];
  const tooltipWidth = 380;
  const tooltipHeight = 250;

  const finish = useCallback((status: 'completed' | 'dismissed') => {
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.setItem(storageKey, status);
    }
    onClose(status);
  }, [onClose, storageKey]);

  const updateTarget = useCallback(() => {
    if (!currentStep) return;
    setTargetRect(getTargetRect(currentStep.selector));
    setPositionNonce((current) => current + 1);
  }, [currentStep]);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || !currentStep || typeof window === 'undefined') return;

    const target = document.querySelector(currentStep.selector);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    const timeout = window.setTimeout(updateTarget, 380);
    const secondTimeout = window.setTimeout(updateTarget, 820);
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);

    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(secondTimeout);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [currentStep, open, updateTarget]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        finish('dismissed');
        return;
      }
      if (event.key === 'ArrowRight') {
        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
        return;
      }
      if (event.key === 'ArrowLeft') {
        setStepIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finish, open, steps.length]);

  const tooltipStyle = useMemo(
    () => getTooltipPosition(targetRect, currentStep?.placement || 'bottom', tooltipWidth, tooltipHeight),
    [currentStep?.placement, positionNonce, targetRect]
  );

  if (!open || !currentStep || steps.length === 0) return null;

  const paddedRect = targetRect
    ? {
        top: Math.max(targetRect.top - 8, 8),
        left: Math.max(targetRect.left - 8, 8),
        width: targetRect.width + 16,
        height: targetRect.height + 16,
      }
    : null;
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none" data-tour-overlay="true">
      <div className="absolute inset-0 bg-black/65" />

      {paddedRect ? (
        <div
          className="absolute rounded-2xl border-2 bg-transparent transition-all duration-200"
          style={{
            top: paddedRect.top,
            left: paddedRect.left,
            width: paddedRect.width,
            height: paddedRect.height,
            borderColor: accentColor,
            boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.52), 0 0 0 4px ${accentColor}22, 0 18px 70px rgba(0,0,0,0.45)`,
          }}
        />
      ) : null}

      <div
        className="pointer-events-auto fixed max-w-[calc(100vw-32px)] rounded-3xl border border-white/12 bg-zinc-950/95 p-5 text-white shadow-2xl backdrop-blur-xl"
        data-tour-tooltip="true"
        style={{
          width: tooltipWidth,
          ...tooltipStyle,
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em]" data-tour-step-counter="true" style={{ color: accentColor }}>
              Step {stepIndex + 1} of {steps.length}
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">{currentStep.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => finish('dismissed')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 transition hover:text-white"
            aria-label="Close walkthrough"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-7 text-zinc-300">{currentStep.body}</p>

        {!targetRect ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
            This step is shown without a highlight because the matching section is not available on this screen yet.
          </div>
        ) : null}

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${((stepIndex + 1) / steps.length) * 100}%`,
              backgroundColor: accentColor,
            }}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => finish('dismissed')}
            data-tour-control="skip"
            className="text-sm font-medium text-zinc-400 transition hover:text-white"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
              data-tour-control="back"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  finish('completed');
                  return;
                }
                setStepIndex((current) => Math.min(current + 1, steps.length - 1));
              }}
              aria-label={isLastStep ? 'Finish walkthrough' : 'Next walkthrough step'}
              data-tour-control="primary"
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-105"
              style={{ backgroundColor: accentColor }}
            >
              {isLastStep ? 'Finish' : 'Next'}
              {isLastStep ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
