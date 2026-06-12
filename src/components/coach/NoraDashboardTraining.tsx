import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Check, RotateCcw, X, Volume2 } from 'lucide-react';

// A Nora-guided, click-through training overlay for the coach dashboard.
// Each step plays a narration clip and shows a grounding card (bottom-right)
// with a Next button. Advancement is user-driven (not auto-chained), so the
// coach moves at their own pace.
//
// To add a step: drop a clip in /public/audio/nora and append to TRAINING_STEPS.
// Optional `target` (CSS selector) scrolls/▸highlights a dashboard element when
// the step opens.

export type DashboardTrainingStep = {
  id: string;
  audio: string;
  title: string;
  body: string;
  target?: string;
  // Timed cues fired as the clip crosses `atFrac` of its duration. Default kind
  // 'highlight' rings the `selector`. The interactive kinds drive the FIRST
  // athlete readiness card so Nora can demonstrate hovers + the acknowledge press.
  highlights?: {
    atFrac: number;
    selector?: string;
    kind?: 'highlight' | 'nav' | 'click' | 'card' | 'mood' | 'checkin' | 'escalation' | 'ack';
  }[];
};

export const TRAINING_STEPS: DashboardTrainingStep[] = [
  {
    id: 'welcome',
    audio: '/audio/nora/nora-dashboard-welcome.mp3',
    title: 'Welcome to your dashboard',
    body:
      "Your window into how the whole team is doing, day to day — readiness, mood, and check-ins, all in one place. I'll walk you through it.",
  },
  {
    id: 'readiness',
    audio: '/audio/nora/nora-dashboard-readiness.mp3',
    title: 'The Readiness Dashboard',
    body:
      "Your home base — the full scope of your roster, plus an at-a-glance read on overall readiness, from athletes who are optimal to the ones who need attention.",
    highlights: [
      { atFrac: 0.0, selector: '[data-nav="home"]' },
      { atFrac: 0.3, selector: '#tile-total' },
      { atFrac: 0.58, selector: '#tile-optimal' },
      { atFrac: 0.8, selector: '#tile-attention' },
    ],
  },
  {
    id: 'adherence',
    audio: '/audio/nora/nora-dashboard-adherence.mp3',
    title: 'Adherence — the metric that moves the needle',
    body:
      "We can't train the mind if athletes aren't doing the work. Athletes who stay above 80% adherence see roughly a 30% lift in readiness over a season — so when it dips, that's your cue to step in.",
    highlights: [{ atFrac: 0.0, selector: '#tile-adherence' }],
  },
  {
    id: 'athlete-card',
    audio: '/audio/nora/nora-dashboard-athlete-card.mp3',
    title: 'The Athlete Readiness card',
    body:
      "Each athlete's full read: 14-day mood, check-in frequency, what's driving it, escalation status, and a one-tap acknowledge. Hover any day for the detail.",
    highlights: [
      { atFrac: 0.0, kind: 'card' },
      { atFrac: 0.18, kind: 'mood' },
      { atFrac: 0.45, kind: 'checkin' },
      { atFrac: 0.72, kind: 'escalation' },
      { atFrac: 0.9, kind: 'ack' },
    ],
  },
  {
    id: 'staff',
    audio: '/audio/nora/nora-dashboard-staff.mp3',
    title: 'Your staff',
    body:
      "The people who support your athletes. Every staffer gets a role — and that role sets what they can see. Coaches and trainers get full visibility; a team manager gets administrative access without the athlete data.",
    highlights: [
      { atFrac: 0.0, kind: 'nav', selector: '[data-nav="staff"]' },
      { atFrac: 0.5, kind: 'highlight', selector: '[data-staff-card]' },
      { atFrac: 0.82, kind: 'highlight', selector: '[data-staff-perms]' },
    ],
  },
  {
    id: 'staff-invite',
    audio: '/audio/nora/nora-dashboard-staff-invite.mp3',
    title: 'Inviting staff',
    body:
      "Invite a member by email, or copy a link to share directly. Either way it opens a panel where you set exactly what they can access — before the invitation ever goes out.",
    highlights: [
      { atFrac: 0.0, kind: 'highlight', selector: '[data-invite-trigger]' },
      { atFrac: 0.42, kind: 'click', selector: '[data-invite-trigger]' },
      { atFrac: 0.62, kind: 'highlight', selector: '[data-invite-perms]' },
      { atFrac: 0.85, kind: 'highlight', selector: '[data-invite-copy]' },
    ],
  },
  {
    id: 'train-nora',
    audio: '/audio/nora/nora-dashboard-train-intro.mp3',
    title: 'Train Nora',
    body:
      "Teach me just about anything — your practice plan, the schedule, meeting times, team rules, even \"pack competition shoes the night before a game.\" Whatever you teach me, your athletes can ask me about.",
    highlights: [
      { atFrac: 0.0, kind: 'nav', selector: '[data-nav="nora"]' },
      { atFrac: 0.22, kind: 'highlight', selector: '[data-nora-explainer]' },
    ],
  },
  {
    id: 'train-nora-modalities',
    audio: '/audio/nora/nora-dashboard-train-modalities.mp3',
    title: 'However it suits you',
    body:
      "Drag and drop PDFs and images right onto the vault, jot down a quick note, or just start a chat with me directly. Whatever's easiest for you.",
    highlights: [
      { atFrac: 0.2, kind: 'highlight', selector: '[data-nora-dropzone]' },
      { atFrac: 0.5, kind: 'highlight', selector: '[data-nora-note]' },
      { atFrac: 0.7, kind: 'highlight', selector: '[data-nora-chat]' },
    ],
  },
  {
    id: 'schedule',
    audio: '/audio/nora/nora-dashboard-schedule.mp3',
    title: 'Schedule',
    body:
      "A dedicated tab for your calendar. Paste a link to your team schedule, drag and drop a schedule PDF, or connect the scheduling tool your department already uses — our team wires that up during pilot setup.",
    highlights: [
      { atFrac: 0.0, kind: 'nav', selector: '[data-nav="schedule"]' },
      { atFrac: 0.28, kind: 'highlight', selector: '[data-schedule-url]' },
      { atFrac: 0.46, kind: 'highlight', selector: '[data-schedule-dropzone]' },
      { atFrac: 0.62, kind: 'highlight', selector: '[data-schedule-integrations]' },
    ],
  },
  {
    id: 'reports',
    audio: '/audio/nora/nora-dashboard-reports-intro.mp3',
    title: 'Reports',
    body:
      "I send a report on whatever cadence fits — weekly or daily — straight to your inbox. Come to this tab anytime to read the current one or look back through past reports.",
    highlights: [
      { atFrac: 0.0, kind: 'nav', selector: '[data-nav="reports"]' },
      { atFrac: 0.4, kind: 'highlight', selector: '[data-report-row]' },
    ],
  },
  {
    id: 'reports-detail',
    audio: '/audio/nora/nora-dashboard-reports-detail.mp3',
    title: 'The Sports Intelligence layer',
    body:
      "These aren't generic sport-psychology tips. The insights are shaped by your athletes' sport, your team dynamics, your training style, and how they behave — plus their physiology from their performance devices: recovery and training load. That's how I connect body to mind, so this work carries over to competition.",
    highlights: [
      // Open the latest report so the detail narration has it on screen.
      { atFrac: 0.0, kind: 'click', selector: '[data-report-row]' },
    ],
  },
  {
    id: 'wrap-up',
    audio: '/audio/nora/nora-dashboard-wrapup.mp3',
    title: "You're all set",
    body:
      "That's your dashboard at a glance. Look around — and if you ever get stuck, tap the chat bubble down here to ask me anything, or to have me walk through this again. Looking forward to getting your athletes mentally prepared to dominate.",
    highlights: [
      { atFrac: 0.0, kind: 'nav', selector: '[data-nav="home"]' },
      { atFrac: 0.36, kind: 'highlight', selector: '[data-nora-chat-fab]' },
    ],
  },
];

const PURPLE = '#a78bfa';

const NoraDashboardTraining: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cueIndexRef = useRef(0);
  // Set when the browser's autoplay policy rejects play() (no user gesture yet);
  // the next gesture anywhere on the page retries the current step's clip.
  const pendingAutoplayRef = useRef(false);
  const highlightedElRef = useRef<Element | null>(null);
  const hoveredElRef = useRef<Element | null>(null);

  // --- Voice-reactive orb -----------------------------------------------------
  // The orb's glow + ripple track the live amplitude of Nora's clip (via a Web
  // Audio analyser), so it flashes on syllables and settles in the gaps —
  // cadence-locked to her speech instead of a constant ping.
  const orbCoreRef = useRef<HTMLSpanElement | null>(null);
  const orbRingRef = useRef<HTMLSpanElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const meterBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelRef = useRef(0);

  const step = TRAINING_STEPS[stepIndex];
  const isLast = stepIndex === TRAINING_STEPS.length - 1;

  const clearHighlight = useCallback(() => {
    if (highlightedElRef.current) {
      highlightedElRef.current.classList.remove('nora-train-highlight');
      highlightedElRef.current = null;
    }
  }, []);

  // Programmatic hover: React derives onMouseEnter/Leave from mouseover/out, so
  // dispatching those triggers the card's real hover panels.
  const clearHover = useCallback(() => {
    if (hoveredElRef.current) {
      hoveredElRef.current.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      hoveredElRef.current = null;
    }
  }, []);

  const applyHighlight = useCallback(
    (selector: string) => {
      if (typeof document === 'undefined') return;
      const el = document.querySelector(selector);
      if (!el) return;
      clearHighlight();
      el.classList.add('nora-train-highlight');
      highlightedElRef.current = el;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    },
    [clearHighlight]
  );

  // Paint the orb for a given amplitude level (0..1). Direct DOM writes (no
  // React state) so it can update every animation frame cheaply.
  const paintOrb = useCallback((lvl: number) => {
    const core = orbCoreRef.current;
    const ring = orbRingRef.current;
    if (core) {
      core.style.transform = `scale(${(1 + lvl * 0.16).toFixed(3)})`;
      core.style.boxShadow = `0 0 ${(8 + lvl * 30).toFixed(1)}px rgba(167,139,250,${(0.38 + lvl * 0.5).toFixed(3)})`;
    }
    if (ring) {
      ring.style.transform = `scale(${(1 + lvl * 1.5).toFixed(3)})`;
      ring.style.opacity = `${(lvl * 0.6).toFixed(3)}`;
    }
  }, []);

  // Lazily build audio context → source → analyser. Routing the element through
  // a MediaElementSource silences it while the context is suspended, so we only
  // wire it once the context is actually running (after a gesture/resume). Until
  // then the clip plays normally with the static glow; the next play retries.
  const ensureAudioGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || typeof window === 'undefined' || sourceRef.current) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new Ctx();
      } catch {
        return;
      }
    }
    const ctx = audioCtxRef.current;
    const build = () => {
      if (sourceRef.current || ctx.state !== 'running') return;
      try {
        const src = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = src;
        analyserRef.current = analyser;
        meterBufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      } catch {
        // Already wired or blocked — keep the static glow.
      }
    };
    if (ctx.state === 'running') build();
    else ctx.resume().then(build).catch(() => {});
  }, []);

  const stopMeter = useCallback(
    (reset = true) => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      levelRef.current = 0;
      if (reset) paintOrb(0);
    },
    [paintOrb]
  );

  const runMeter = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = meterBufRef.current;
    if (analyser && buf) {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const x = (buf[i] - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / buf.length); // ~0..0.4 for speech
      const target = Math.min(1, rms * 3.4); // normalize into a lively range
      // Fast attack on syllable onsets, slower release through the gaps.
      const prev = levelRef.current;
      const next = target > prev ? prev + (target - prev) * 0.6 : prev + (target - prev) * 0.14;
      levelRef.current = next;
      paintOrb(next);
    }
    rafRef.current = requestAnimationFrame(runMeter);
  }, [paintOrb]);

  const startMeter = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(runMeter);
  }, [runMeter]);

  const playStep = useCallback(
    (s: DashboardTrainingStep) => {
      const audio = audioRef.current;
      if (!audio) return;
      cueIndexRef.current = 0;
      clearHighlight();
      clearHover();
      try {
        audio.src = s.audio;
        audio.currentTime = 0;
        const played = audio.play();
        if (played && typeof played.then === 'function') {
          played
            .then(() => {
              pendingAutoplayRef.current = false;
              setSpeaking(true);
            })
            .catch(() => {
              pendingAutoplayRef.current = true;
              setSpeaking(false);
            });
        }
      } catch {
        pendingAutoplayRef.current = true;
        setSpeaking(false);
      }
    },
    [clearHighlight, clearHover]
  );

  const hoverEl = useCallback(
    (el: Element | null | undefined) => {
      if (!el) return;
      clearHover();
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      hoveredElRef.current = el;
    },
    [clearHover]
  );

  const isColored = (el: Element) => {
    const bg = getComputedStyle(el).backgroundColor;
    return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
  };

  // Run a single cue: ring an element, or drive the first athlete card's
  // interactive states (hover panels + acknowledge press) for the demo.
  const runCue = useCallback(
    (cue: { selector?: string; kind?: string }) => {
      if (typeof document === 'undefined') return;
      const kind = cue.kind || 'highlight';
      if (kind === 'highlight') {
        if (cue.selector) applyHighlight(cue.selector);
        return;
      }
      // Switch dashboard tabs (the nav buttons own the view state), then ring it.
      if (kind === 'nav') {
        if (!cue.selector) return;
        (document.querySelector(cue.selector) as HTMLElement | null)?.click();
        applyHighlight(cue.selector);
        return;
      }
      // Fire a real click (e.g. open the invite modal) without ringing.
      if (kind === 'click') {
        if (cue.selector) (document.querySelector(cue.selector) as HTMLElement | null)?.click();
        return;
      }
      const card = document.querySelector('[data-athlete-card]');
      if (!card) return;
      if (kind === 'card') {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        clearHighlight();
        card.classList.add('nora-train-highlight');
        highlightedElRef.current = card;
        return;
      }
      if (kind === 'mood') {
        const squares = Array.from(card.querySelectorAll('[data-mood-square]'));
        hoverEl(squares.find(isColored) || squares[Math.floor(squares.length / 2)]);
        return;
      }
      if (kind === 'checkin') {
        const dots = Array.from(card.querySelectorAll('[data-checkin-dot]'));
        hoverEl(dots.find(isColored) || dots[dots.length - 1]);
        return;
      }
      if (kind === 'escalation') {
        hoverEl(card.querySelector('[data-escalation]'));
        return;
      }
      if (kind === 'ack') {
        clearHover();
        (card.querySelector('[data-acknowledge]') as HTMLElement | null)?.click();
      }
    },
    [applyHighlight, clearHighlight, hoverEl, clearHover]
  );

  // Fire a step's cues as the clip plays past each `atFrac`.
  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const a = e.currentTarget;
      const cues = step.highlights;
      if (!cues || !cues.length) return;
      if (!a.duration || !Number.isFinite(a.duration)) return;
      while (cueIndexRef.current < cues.length && a.currentTime >= a.duration * cues[cueIndexRef.current].atFrac) {
        runCue(cues[cueIndexRef.current]);
        cueIndexRef.current += 1;
      }
    },
    [step, runCue]
  );

  // When the step changes, optionally focus a dashboard element, then narrate.
  useEffect(() => {
    if (dismissed) return;
    if (step.target && typeof document !== 'undefined') {
      document.querySelector(step.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    playStep(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, dismissed]);

  // Autoplay rescue: if the browser blocked the initial play() (no user gesture
  // yet), start the current step's narration on the first gesture anywhere —
  // the coach shouldn't have to find the Replay button to hear Nora.
  useEffect(() => {
    if (dismissed || typeof window === 'undefined') return;
    const resume = () => {
      if (!pendingAutoplayRef.current) return;
      pendingAutoplayRef.current = false;
      playStep(step);
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
    return () => {
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
    };
  }, [dismissed, playStep, step]);

  // Clean up any lingering highlight + audio graph on unmount.
  useEffect(
    () => () => {
      clearHighlight();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
    },
    [clearHighlight]
  );

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    setSpeaking(false);
    stopMeter();
    clearHighlight();
    clearHover();
  }, [clearHighlight, clearHover, stopMeter]);

  const handleNext = useCallback(() => {
    if (isLast) {
      stop();
      setDismissed(true);
      onComplete?.();
      return;
    }
    stop();
    setStepIndex((i) => Math.min(i + 1, TRAINING_STEPS.length - 1));
  }, [isLast, stop, onComplete]);

  const handleClose = useCallback(() => {
    stop();
    setDismissed(true);
    onComplete?.();
  }, [stop, onComplete]);

  if (dismissed) return null;

  return (
    <>
      <audio
        ref={audioRef}
        playsInline
        onPlay={() => {
          setSpeaking(true);
          ensureAudioGraph();
          startMeter();
        }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          setSpeaking(false);
          stopMeter();
        }}
        onPause={() => {
          setSpeaking(false);
          stopMeter();
        }}
        onError={() => {
          setSpeaking(false);
          stopMeter();
        }}
      />
      <style>{`
        .nora-train-highlight {
          outline: 2px solid #a78bfa !important;
          outline-offset: 3px;
          border-radius: 12px;
          box-shadow: 0 0 0 4px rgba(167,139,250,0.22), 0 0 26px rgba(167,139,250,0.55) !important;
          transition: outline-color 0.2s ease, box-shadow 0.2s ease;
          position: relative;
          z-index: 5;
        }
      `}</style>
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] w-[360px] max-w-[calc(100vw-2.5rem)]">
        <div className="pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d1a]/95 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
            <span className="relative flex h-7 w-7 flex-none items-center justify-center">
              {/* Ripple ring — scale + opacity driven by live voice amplitude. */}
              <span
                ref={orbRingRef}
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'rgba(167,139,250,0.5)',
                  opacity: 0,
                  transform: 'scale(1)',
                  transformOrigin: 'center',
                  willChange: 'transform, opacity',
                }}
              />
              {/* Core orb — glow + subtle scale pulse on each syllable. */}
              <span
                ref={orbCoreRef}
                className="relative h-7 w-7 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), #a78bfa 45%, #6d28d9 100%)',
                  boxShadow: '0 0 8px rgba(167,139,250,0.35)',
                  transformOrigin: 'center',
                  willChange: 'transform, box-shadow',
                }}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-none text-white">Nora</p>
              <p className="mt-1 text-[11px] leading-none text-zinc-500">
                {speaking ? 'Walking you through it…' : 'Dashboard training'}
              </p>
            </div>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              {stepIndex + 1} / {TRAINING_STEPS.length}
            </span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close training"
              className="rounded-md p-1 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4">
            <h3 className="text-[15px] font-semibold tracking-tight text-white">{step.title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-zinc-400">{step.body}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => playStep(step)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
            >
              {speaking ? <Volume2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {speaking ? 'Playing' : 'Replay'}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-[#1a1330] transition hover:brightness-110"
              style={{ background: PURPLE }}
            >
              {isLast ? (
                <>
                  Finish
                  <Check className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NoraDashboardTraining;
