import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const TRIGGERS = [
  { title: 'Athlete message', body: 'Language opens the safety check.', accent: '#8B5CF6' },
  { title: 'Nora examines', body: 'HRV, sleep, sentiment, biometrics.', accent: '#06B6D4' },
  { title: 'Tier decision', body: 'Signal severity routes 0 to 3.', accent: '#94A3B8' },
] as const;

const TIERS = [
  {
    number: 0,
    title: 'No escalation',
    summary: 'Routine signal. Normal routing stays active.',
    chips: ['Routine', 'Stable metrics', 'Normal state'],
    example: '"I am a little tight before the game, but I should settle in after warmups."',
    routeTitle: 'No escalation route',
    routeBody: 'Context saved, routing continues.',
    accent: '#A1A1AA',
    glow: 'rgba(161,161,170,0.08)',
    tint: 'rgba(255,255,255,0.035)',
  },
  {
    number: 1,
    title: 'Monitor-only',
    summary: 'Low-risk strain. Coach stays quietly aware.',
    chips: ['Low-risk strain', 'Athlete stable', 'Coach aware'],
    example: '"I have been off all week and barely slept last night, but I am still trying to lock in."',
    routeTitle: 'Coach-aware',
    routeBody: 'Pulse flags, response stays silent.',
    accent: '#84CC16',
    glow: 'rgba(132,204,22,0.09)',
    tint: 'rgba(132,204,22,0.055)',
  },
  {
    number: 2,
    title: 'Elevated risk',
    summary: 'Normal programming pauses. Consent opens trainer and clinician escalation.',
    chips: ['Risk language', 'Flow pauses', 'Trainer + clinician'],
    example: '"I do not feel like myself right now. I think I need more help than this chat can give me."',
    routeTitle: 'Consent flow',
    routeBody: 'Athletic trainers and clinicians are brought in.',
    accent: '#F59E0B',
    glow: 'rgba(245,158,11,0.09)',
    tint: 'rgba(245,158,11,0.06)',
  },
  {
    number: 3,
    title: 'Critical risk',
    summary: 'Immediate safety mode. Clinician-only handoff takes over.',
    chips: ['Immediate risk', 'Nora exits', 'Clinician-only'],
    example: '"Maybe everyone would be better off without me. I do not want to be here today."',
    routeTitle: 'Mandatory escalation',
    routeBody: 'AuntEdna clinicians notified immediately.',
    accent: '#EF4444',
    glow: 'rgba(239,68,68,0.10)',
    tint: 'rgba(239,68,68,0.065)',
  },
] as const;

type EscalationDiagramProps = {
  step: number;
  onAdvance: () => void;
  onSequenceComplete?: () => void;
};

const EscalationDiagram: React.FC<EscalationDiagramProps> = ({ step, onAdvance, onSequenceComplete }) => {
  const activeTier = TIERS[Math.min(Math.max(step, 0), TIERS.length - 1)];
  const accent = activeTier.accent;
  const glow = activeTier.glow;
  const tint = activeTier.tint;

  const advance = () => {
    if (step >= TIERS.length - 1) {
      onSequenceComplete?.();
      return;
    }

    onAdvance();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Advance escalation sequence"
      onClick={advance}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          advance();
        }
      }}
      className="relative w-full cursor-pointer outline-none"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[42px]">
        <div
          className="absolute left-[8%] top-[12%] h-40 w-40 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 72%)' }}
        />
        <div
          className="absolute right-[12%] top-[18%] h-40 w-40 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 72%)' }}
        />
        <div
          className="absolute left-1/2 top-[56%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 72%)` }}
        />
        <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
      </div>

      <div className="relative mx-auto max-w-[1120px] px-4 py-5 md:px-8 md:py-8">
        <div className="mb-5 flex items-center justify-end gap-6">
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((index) => {
              const active = step === index;
              const passed = step > index;

              return (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${active ? 'w-8' : 'w-1.5'}`}
                  style={{
                    backgroundColor: active || passed ? '#E0FE10' : 'rgba(255,255,255,0.12)',
                    boxShadow: active ? '0 0 10px rgba(224,254,16,0.16)' : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>

        <GlassShell accent={accent}>
          <div className="space-y-8 md:space-y-10">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
              {TRIGGERS.map((trigger, index) => (
                <React.Fragment key={trigger.title}>
                  <TriggerNode
                    title={trigger.title}
                    body={trigger.body}
                    accent={trigger.accent}
                    muted={step > 0}
                    emphasize={step === 0 && index === 0}
                  />
                  {index < TRIGGERS.length - 1 && <FlowLink accent={trigger.accent} />}
                </React.Fragment>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_72px_minmax(320px,0.52fr)] lg:items-center">
              <div
                className="relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/20 p-6 md:p-8"
                style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 42px ${glow}` }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${tint} 0%, rgba(255,255,255,0.015) 100%)`,
                  }}
                />
                <div
                  className="absolute top-0 left-0 right-0 h-px opacity-80"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}90, transparent)` }}
                />

                <div className="relative min-h-[280px] md:min-h-[320px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`tier-${activeTier.number}`}
                      initial={{ opacity: 0, y: 26, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -18, scale: 0.985 }}
                      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                      className="flex h-full flex-col justify-between"
                    >
                      <div className="flex items-start gap-5">
                        <div
                          className="relative flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-[26px] border"
                          style={{
                            background: `linear-gradient(180deg, ${activeTier.tint} 0%, rgba(255,255,255,0.02) 100%)`,
                            borderColor: `${activeTier.accent}55`,
                            boxShadow: `0 10px 26px ${activeTier.glow}`,
                          }}
                        >
                          <span className="text-[46px] font-black leading-none text-white">{activeTier.number}</span>
                          <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: activeTier.accent }}>
                            Tier
                          </span>
                        </div>

                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">
                            Tier {activeTier.number}
                          </p>
                          <h2 className="text-[40px] md:text-[64px] font-semibold tracking-[-0.04em] leading-[0.92] text-white">
                            {activeTier.title}
                          </h2>
                          <p className="mt-4 max-w-2xl text-lg md:text-[24px] leading-[1.2] text-zinc-300">
                            {activeTier.summary}
                          </p>
                        </div>
                      </div>

                      <div className="mt-8 flex flex-wrap gap-2.5">
                        {activeTier.chips.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border px-3.5 py-1.5 text-sm font-medium"
                            style={{
                              backgroundColor: `${activeTier.accent}12`,
                              borderColor: `${activeTier.accent}22`,
                              color: activeTier.accent,
                            }}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>

                      <div className="mt-8 max-w-2xl rounded-[24px] border border-white/8 bg-black/15 px-5 py-4 backdrop-blur-md">
                        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3">
                          Example message
                        </p>
                        <p className="text-base md:text-[20px] leading-[1.35] text-zinc-200 italic">
                          {activeTier.example}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="hidden lg:flex items-center justify-center">
                <div
                  className="relative h-px w-full"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}70, transparent)` }}
                >
                  <motion.div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
                    animate={{ x: ['0%', '85%', '0%'] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              </div>

              <div
                className="relative overflow-hidden rounded-[30px] border border-white/10 bg-zinc-950/18 p-6 md:p-7"
                style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 28px ${glow}` }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(135deg, ${tint} 0%, rgba(255,255,255,0.012) 100%)` }}
                />
                <div
                  className="absolute top-0 left-0 right-0 h-px opacity-80"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}90, transparent)` }}
                />

                <div className="relative min-h-[180px] flex flex-col justify-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`route-${activeTier.number}`}
                      initial={{ opacity: 0, y: 22 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -14 }}
                      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">
                        Route
                      </p>
                      <h3 className="text-[30px] md:text-[42px] font-semibold tracking-[-0.04em] leading-[0.95] text-white">
                        {activeTier.routeTitle}
                      </h3>
                      <p className="mt-4 text-base md:text-[22px] leading-[1.2] text-zinc-300">
                        {activeTier.routeBody}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </GlassShell>

      </div>
    </div>
  );
};

const GlassShell: React.FC<{
  children: React.ReactNode;
  accent: string;
}> = ({ children, accent }) => (
  <div className="relative">
    <div
      className="pointer-events-none absolute -inset-2 rounded-[40px] blur-3xl"
      style={{ background: `radial-gradient(circle at 20% 20%, ${accent}08 0%, transparent 58%)` }}
    />
    <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-zinc-900/30 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-75"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative p-5 md:p-7">{children}</div>
    </div>
  </div>
);

const TriggerNode: React.FC<{
  title: string;
  body: string;
  accent: string;
  muted?: boolean;
  emphasize?: boolean;
}> = ({ title, body, accent, muted = false, emphasize = false }) => (
  <div
    className={`relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl transition-all duration-400 ${
      muted ? 'opacity-65' : ''
    } ${emphasize ? 'scale-[1.01]' : ''}`}
    style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 40px ${accent}10` }}
  >
    <div
      className="absolute top-0 left-0 right-0 h-px opacity-75"
      style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
    />
    <p className="text-sm font-semibold text-white mb-2">{title}</p>
    <p className="text-sm leading-snug" style={{ color: accent }}>
      {body}
    </p>
  </div>
);

const FlowLink: React.FC<{
  accent: string;
}> = ({ accent }) => (
  <div className="hidden md:flex items-center justify-center">
    <div className="relative h-px w-full min-w-[52px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}66, transparent)` }}>
      <motion.div
        className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: accent, boxShadow: `0 0 14px ${accent}` }}
        animate={{ x: ['0%', '75%', '0%'] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  </div>
);

export default EscalationDiagram;
