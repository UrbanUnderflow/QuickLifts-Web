import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, ChevronDown, ChevronUp, ShieldCheck, Star, MessageSquare } from 'lucide-react';
import { pulseCheckPilotDashboardService } from '../../../api/firebase/pulsecheckPilotDashboard/service';
import type { PulseCheckPilotOutcomeTrustBatteryItemKey } from '../../../api/firebase/pulsecheckPilotDashboard/types';

type StaffSurveyRole = 'coach' | 'clinician';

interface StaffPilotSurveyModalProps {
  isOpen: boolean;
  role: StaffSurveyRole;
  pilotId: string;
  pilotName: string;
  organizationId: string;
  teamId: string;
  cohortId?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

const TRUST_BATTERY_ITEMS: Array<{ key: PulseCheckPilotOutcomeTrustBatteryItemKey; label: string; helper: string }> = [
  {
    key: 'credibility',
    label: 'Credibility',
    helper: 'The guidance feels informed and believable.',
  },
  {
    key: 'reliability',
    label: 'Reliability',
    helper: 'The guidance feels consistent and dependable.',
  },
  {
    key: 'honesty_safety',
    label: 'Honesty and safety',
    helper: 'It feels safe to be honest in the workflow.',
  },
  {
    key: 'athlete_interest',
    label: 'Athlete interest',
    helper: "PulseCheck feels aligned with the athlete's best interests.",
  },
  {
    key: 'practical_usefulness',
    label: 'Practical usefulness',
    helper: 'The guidance is actually usable in the real world.',
  },
];

type StaffTrustBatteryScores = Partial<Record<PulseCheckPilotOutcomeTrustBatteryItemKey, number>>;

const defaultBatteryScores = (): StaffTrustBatteryScores => ({});

const scoreLabel = (value: number) => `${value}/10`;

export const StaffPilotSurveyModal: React.FC<StaffPilotSurveyModalProps> = ({
  isOpen,
  role,
  pilotId,
  pilotName,
  organizationId,
  teamId,
  cohortId,
  onClose,
  onSubmitted,
}) => {
  const [trustScore, setTrustScore] = useState(8);
  const [npsScore, setNpsScore] = useState(8);
  const [comment, setComment] = useState('');
  const [includeBattery, setIncludeBattery] = useState(false);
  const [batteryScores, setBatteryScores] = useState<StaffTrustBatteryScores>(defaultBatteryScores());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const title = useMemo(() => (role === 'coach' ? 'Coach Feedback' : 'Clinician Feedback'), [role]);

  useEffect(() => {
    if (!isOpen) return;
    setTrustScore(8);
    setNpsScore(8);
    setComment('');
    setIncludeBattery(false);
    setBatteryScores(defaultBatteryScores());
    setSubmitting(false);
    setError(null);
    setSubmitted(false);
  }, [isOpen, role]);

  if (!isOpen) {
    return null;
  }

  const updateBatteryScore = (key: PulseCheckPilotOutcomeTrustBatteryItemKey, value: number) => {
    setBatteryScores((current) => ({ ...current, [key]: value }));
  };

  const clearBatteryScore = (key: PulseCheckPilotOutcomeTrustBatteryItemKey) => {
    setBatteryScores((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const trustBattery = includeBattery
        ? {
            version: 'athlete_trust_battery_v1' as const,
            items: TRUST_BATTERY_ITEMS.map((item) => ({
              key: item.key,
              score: batteryScores[item.key] ?? null,
              completed: typeof batteryScores[item.key] === 'number',
              prompt: item.label,
            })),
          }
        : null;

      await pulseCheckPilotDashboardService.recordPilotSurveyResponse({
        pilotId,
        pilotEnrollmentId: undefined,
        cohortId: cohortId || undefined,
        teamId,
        organizationId,
        respondentRole: role,
        surveyKind: 'trust',
        score: trustScore,
        comment,
        trustBattery,
        source: 'web-admin',
      });

      await pulseCheckPilotDashboardService.recordPilotSurveyResponse({
        pilotId,
        pilotEnrollmentId: undefined,
        cohortId: cohortId || undefined,
        teamId,
        organizationId,
        respondentRole: role,
        surveyKind: 'nps',
        score: npsScore,
        comment,
        source: 'web-admin',
      });

      setSubmitted(true);
      onSubmitted?.();
      window.setTimeout(onClose, 900);
    } catch (submissionError: any) {
      setError(submissionError?.message || 'Failed to submit pilot feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1420] shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400" />
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Staff feedback</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{pilotName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close staff feedback modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {submitted ? (
            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-emerald-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-medium">Feedback submitted</span>
              </div>
              <p className="mt-2 text-sm text-emerald-100/80">Thanks. The survey has been recorded and the outcome rollups will refresh automatically.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Star className="h-4 w-4 text-amber-300" />
                    Trust
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={trustScore}
                    onChange={(event) => setTrustScore(Number(event.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="text-sm text-zinc-300">{scoreLabel(trustScore)}</div>
                </label>

                <label className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <MessageSquare className="h-4 w-4 text-cyan-300" />
                    NPS
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={npsScore}
                    onChange={(event) => setNpsScore(Number(event.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="text-sm text-zinc-300">{scoreLabel(npsScore)}</div>
                </label>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <button
                  type="button"
                  onClick={() => setIncludeBattery((current) => !current)}
                  className="flex w-full items-center justify-between text-left text-sm font-medium text-white"
                >
                  <span>Include diagnostic trust battery</span>
                  {includeBattery ? <ChevronUp className="h-4 w-4 text-zinc-300" /> : <ChevronDown className="h-4 w-4 text-zinc-300" />}
                </button>
                {includeBattery ? (
                  <div className="mt-4 space-y-4">
                    {TRUST_BATTERY_ITEMS.map((item) => (
                      <label key={item.key} className="block space-y-2 rounded-2xl border border-white/5 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-white">{item.label}</div>
                            <div className="mt-1 text-xs text-zinc-500">{item.helper}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-sm text-zinc-300">
                              {typeof batteryScores[item.key] === 'number' ? scoreLabel(batteryScores[item.key] as number) : 'Optional'}
                            </div>
                            {typeof batteryScores[item.key] === 'number' ? (
                              <button
                                type="button"
                                onClick={() => clearBatteryScore(item.key)}
                                className="text-xs text-zinc-500 transition hover:text-zinc-200"
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={batteryScores[item.key] ?? 5}
                          onChange={(event) => updateBatteryScore(item.key, Number(event.target.value))}
                          className="w-full accent-emerald-400"
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <label className="block space-y-2">
                <div className="text-sm font-medium text-white">Shared comment</div>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={4}
                  className="w-full rounded-3xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-400/50 focus:outline-none"
                  placeholder="Add a quick note about what is helping or hurting trust."
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
          >
            Close
          </button>
          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit feedback
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
