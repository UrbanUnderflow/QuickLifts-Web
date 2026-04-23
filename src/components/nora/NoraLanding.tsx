import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import NoraBoxBreathingPhone, { type NoraBoxBreathingPhoneHandle } from './NoraBoxBreathingPhone';

type VoiceSample = {
  id: string;
  src: string;
  title: string;
  script: string;
  ctx: string;
};

// Narrative focus — drives which product sections render and what copy shows.
// Reading order:
//   /Nora                        → 'all'        (full three-product story)
//   /Nora?focus=PulseCheck       → 'pulsecheck'
//   /Nora?focus=Macra            → 'macra'
//   /Nora?focus=FitWithPulse     → 'fwp'
// Also accepts ?product=<name> and the bare ?=<name> syntax.
type Focus = 'all' | 'pulsecheck' | 'macra' | 'fwp';

function normalizeFocus(raw: string | null | undefined): Focus {
  if (!raw) return 'all';
  const slug = raw.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (slug === 'pulsecheck' || slug === 'pc' || slug === 'mental') return 'pulsecheck';
  if (slug === 'macra') return 'macra';
  if (slug === 'fitwithpulse' || slug === 'fwp' || slug === 'pulse' || slug === 'training')
    return 'fwp';
  return 'all';
}

function readFocusFromLocation(): Focus {
  if (typeof window === 'undefined') return 'all';
  const params = new URLSearchParams(window.location.search);
  const candidate =
    params.get('focus') ||
    params.get('product') ||
    // handle the bare `?=PulseCheck` form where the key is empty
    params.get('') ||
    null;
  return normalizeFocus(candidate);
}

// Played by the hero orb/button only — not shown in the voice-bank grid below.
const HERO_SAMPLE: VoiceSample = {
  id: 'hero',
  src: '/audio/nora/nora-hero.mp3',
  title: 'Her thesis',
  script:
    '"I notice things. That your sleep dropped before your bench stalled. That the days you skip breakfast are the days your voice goes quiet. I\'m Nora. I pay attention — so you don\'t have to carry it alone."',
  ctx: "Nora's first-contact line — the voice behind every Pulse product.",
};

const VOICE_SAMPLES: VoiceSample[] = [
  {
    id: 'intro',
    src: '/audio/nora/nora-intro.mp3',
    title: 'Daily check-in',
    script: '"Hi Tremaine, today is game day. How are you feeling?"',
    ctx: 'How Nora opens a daily check-in — simple, direct, human.',
  },
  {
    id: 'baseline',
    src: '/audio/nora/nora-baseline.mp3',
    title: 'Morning baseline read',
    script:
      '"Your baseline looks great today. 8 hours of sleep, RHR at 42 bpm, HRV is high — excellent CNS recovery. Your body is primed for today."',
    ctx: 'Nora reading biometrics back in plain language.',
  },
];

// Per-focus copy + gating. Kept tight — only the strings that need to shift.
const FOCUS_NARRATIVE: Record<
  Focus,
  {
    heroEmphasis: React.ReactNode;
    heroSub: string;
    showFwp: boolean;
    showPulseCheck: boolean;
    showMacra: boolean;
    showWhereSection: boolean;
    showMemory: boolean;
    insideLabel: string;
    insideTitleEm: string;
    insideSub: string;
    ctaEye: string;
    ctaTitle: string;
    ctaTitleEm: string;
    ctaSub: string;
    ctaPrimaryHref: string;
    ctaPrimaryLabel: string;
    ctaSecondaryHref: string | null;
    ctaSecondaryLabel: string | null;
  }
> = {
  all: {
    heroEmphasis: <em>every Pulse product.</em>,
    heroSub:
      "Nora is the AI companion inside Fit With Pulse, PulseCheck, and Macra. She listens before she speaks, reads your biometrics like a coach reads a room, and meets you where you are — whether it's 3\u00A0AM or game day.",
    showFwp: true,
    showPulseCheck: true,
    showMacra: true,
    showWhereSection: true,
    showMemory: true,
    insideLabel: 'Inside each product',
    insideTitleEm: 'Three different jobs.',
    insideSub:
      "She doesn't change personalities when you open a different app. She just pulls a different thread — training, mind, food — from the same woven story of you.",
    ctaEye: 'Ready when you are',
    ctaTitle: 'Say hi to ',
    ctaTitleEm: 'Nora.',
    ctaSub:
      'Tap into the daily check-in inside PulseCheck, or point Macra at your plate to let her write your day.',
    ctaPrimaryHref: '/PulseCheck',
    ctaPrimaryLabel: 'Open PulseCheck →',
    ctaSecondaryHref: '/Macra',
    ctaSecondaryLabel: 'Try Macra →',
  },
  pulsecheck: {
    heroEmphasis: <em>PulseCheck.</em>,
    heroSub:
      "Inside PulseCheck, Nora is a sport-psychology-informed coach on call. Two-minute check-ins in the morning. A reset script before you walk into a hard conversation. She reads your HRV like a coach reads a room — and escalates to a human clinician when it matters.",
    showFwp: false,
    showPulseCheck: true,
    showMacra: false,
    showWhereSection: false,
    showMemory: false,
    insideLabel: 'Inside PulseCheck',
    insideTitleEm: 'before the spiral.',
    insideSub:
      "Here's how Nora shows up on the mental-performance side — the 2-minute check-in, the in-the-moment reset, the clinical escalation.",
    ctaEye: 'Ready when you are',
    ctaTitle: 'Meet ',
    ctaTitleEm: 'Nora inside PulseCheck.',
    ctaSub:
      'Open the 2-minute check-in. Nora reads your readiness, runs the reset if you need one, and routes to a human clinician when it crosses the line.',
    ctaPrimaryHref: '/PulseCheck',
    ctaPrimaryLabel: 'Open PulseCheck →',
    ctaSecondaryHref: null,
    ctaSecondaryLabel: null,
  },
  macra: {
    heroEmphasis: <em>Macra.</em>,
    heroSub:
      "Inside Macra, Nora turns any plate into macros and writes your day in food — Meal 1, Meal 2, Meal 3 — built around your target, your training, and your taste. Miss a meal? She re-plans the rest of the day in seconds.",
    showFwp: false,
    showPulseCheck: false,
    showMacra: true,
    showWhereSection: false,
    showMemory: false,
    insideLabel: 'Inside Macra',
    insideTitleEm: 'your day in food.',
    insideSub:
      'Snap a plate, hit your macros, keep rolling when real life hits. Nora writes Meal 1/2/3 and re-plans when you go off script.',
    ctaEye: 'Ready when you are',
    ctaTitle: 'Meet ',
    ctaTitleEm: 'Nora inside Macra.',
    ctaSub: 'Point Macra at your plate and let Nora write the rest of your day.',
    ctaPrimaryHref: '/Macra',
    ctaPrimaryLabel: 'Open Macra →',
    ctaSecondaryHref: null,
    ctaSecondaryLabel: null,
  },
  fwp: {
    heroEmphasis: <em>Fit With Pulse.</em>,
    heroSub:
      "Inside Fit With Pulse, Nora is your training-floor companion. She builds Routines with you — not generic plans — watches volume, RPE, and recovery, and keeps your club on beat.",
    showFwp: true,
    showPulseCheck: false,
    showMacra: false,
    showWhereSection: false,
    showMemory: false,
    insideLabel: 'Inside Fit With Pulse',
    insideTitleEm: 'with your club.',
    insideSub:
      "Routines that adapt, clubs that stay in rhythm, and a coach that sees the patterns no one else does.",
    ctaEye: 'Ready when you are',
    ctaTitle: 'Meet ',
    ctaTitleEm: 'Nora inside Fit With Pulse.',
    ctaSub: 'Open Fit With Pulse and let Nora write your next Routine with you.',
    ctaPrimaryHref: '/',
    ctaPrimaryLabel: 'Open Fit With Pulse →',
    ctaSecondaryHref: null,
    ctaSecondaryLabel: null,
  },
};

const NoraLanding: React.FC = () => {
  // ── Narrative focus (driven by ?focus= / ?product= / ?=<name> ) ──
  const router = useRouter();
  const [focus, setFocus] = useState<Focus>('all');
  useEffect(() => {
    const apply = () => setFocus(readFocusFromLocation());
    apply();
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, [router.asPath]);
  const narrative = useMemo(() => FOCUS_NARRATIVE[focus], [focus]);

  // Update document title to reflect focus — helps stakeholders who skim tabs.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const suffix =
      focus === 'pulsecheck'
        ? 'The mental-performance voice inside PulseCheck.'
        : focus === 'macra'
          ? 'The nutrition voice inside Macra.'
          : focus === 'fwp'
            ? 'The training voice inside Fit With Pulse.'
            : 'The coach inside every Pulse product.';
    document.title = `Nora AI — ${suffix}`;
  }, [focus]);

  // ── Voice + orb state ─────────────────────────────────────
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBoxBreathingActive, setIsBoxBreathingActive] = useState(false);
  const [intensity, setIntensity] = useState(0.08);
  const [pitch, setPitch] = useState(0.22);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const freqRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const boxBreathingPhoneRef = useRef<NoraBoxBreathingPhoneHandle | null>(null);

  const stopOrb = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIntensity(0.08);
    setPitch(0.22);
  }, []);

  const attachAnalyser = useCallback((audio: HTMLAudioElement) => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = ctxRef.current ?? new AudioCtx();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);

      if (!sourceRef.current) {
        const src = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = src;
        analyserRef.current = analyser;
        freqRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        timeRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      }

      const tick = () => {
        const analyser = analyserRef.current;
        const freq = freqRef.current;
        const time = timeRef.current;
        if (!analyser || !freq || !time) return;

        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(time);

        let rmsT = 0;
        for (let i = 0; i < time.length; i += 1) {
          const n = (time[i] - 128) / 128;
          rmsT += n * n;
        }
        const rms = Math.sqrt(rmsT / time.length);

        let wf = 0;
        let tf = 0;
        for (let i = 0; i < freq.length; i += 1) {
          wf += freq[i] * i;
          tf += freq[i];
        }
        const centroid = tf > 0 ? wf / tf / freq.length : 0;

        setIntensity((p) => p * 0.72 + Math.min(1, rms * 4.6 + 0.04) * 0.28);
        setPitch((p) => p * 0.7 + centroid * 0.3);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (_e) {
      stopOrb();
    }
  }, [stopOrb]);

  const playSample = useCallback(
    (sample: VoiceSample) => {
      const audio = audioRef.current;
      if (!audio) return;

      // toggle off if tapping the same playing sample
      if (activeSampleId === sample.id && isPlaying) {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
        setActiveSampleId(null);
        stopOrb();
        return;
      }

      if (audio.src !== window.location.origin + sample.src) {
        audio.src = sample.src;
      }
      setActiveSampleId(sample.id);
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
      attachAnalyser(audio);
    },
    [activeSampleId, isPlaying, attachAnalyser]
  );

  // ── Autoplay the hero sample on landing ──
  // Browser autoplay policies block unmuted audio until a user gesture, so we
  // try once on mount (succeeds when the user came from a same-origin nav or
  // has a recent interaction) and otherwise fire on the first pointer/key/scroll
  // event anywhere on the page.
  useEffect(() => {
    let fired = false;
    const tryPlay = () => {
      if (fired) return;
      const audio = audioRef.current;
      if (!audio) return;
      fired = true;
      playSample(HERO_SAMPLE);
    };

    // Attempt immediately — most browsers will block without a gesture.
    const immediate = window.setTimeout(() => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.src !== window.location.origin + HERO_SAMPLE.src) {
        audio.src = HERO_SAMPLE.src;
      }
      audio.currentTime = 0;
      audio.play()
        .then(() => {
          fired = true;
          setActiveSampleId(HERO_SAMPLE.id);
          attachAnalyser(audio);
        })
        .catch(() => undefined); // blocked → wait for gesture below
    }, 150);

    // Fallback: first gesture anywhere kicks it off.
    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'touchstart',
      'keydown',
      'scroll',
      'wheel',
    ];
    events.forEach((ev) => window.addEventListener(ev, tryPlay, { once: true, passive: true }));

    return () => {
      window.clearTimeout(immediate);
      events.forEach((ev) => window.removeEventListener(ev, tryPlay));
    };
    // Intentionally excluded: playSample (stable enough) — we only want this
    // to run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPulseCheckBoxBreathing = useCallback(() => {
    if (isBoxBreathingActive) {
      boxBreathingPhoneRef.current?.stop();
      return;
    }

    audioRef.current?.pause();
    boxBreathingPhoneRef.current?.start();
  }, [isBoxBreathingActive]);

  useEffect(() => {
    return () => {
      stopOrb();
      ctxRef.current?.close().catch(() => undefined);
    };
  }, [stopOrb]);

  // ── Nav scroll effect ────────────────────────────────────
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Reveal observer ──────────────────────────────────────
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('nr-visible');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.nr-reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // ── Orb geometry (pitch → hue, intensity → scale/glow) ──
  const accentHue = 68 + pitch * 22; // lime→teal range
  const coreScale = 1 + intensity * 0.22;
  const glowSize = isPlaying ? 60 + intensity * 140 : 40;
  const ringStroke = 2 + intensity * 3;
  const ringOpacity = 0.35 + intensity * 0.5;

  // Telemetry status
  const telemetry = isPlaying ? 'SPEAKING' : activeSampleId ? 'READY' : 'IDLE';

  return (
    <div className="nr">
      {/* hidden audio element — analyser binds to it */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          setIsPlaying(false);
          stopOrb();
        }}
        onEnded={() => {
          setIsPlaying(false);
          setActiveSampleId(null);
          stopOrb();
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setProgress(a.currentTime);
          setDuration(a.duration || 0);
        }}
        preload="none"
        playsInline
      />

      {/* ── NAV ── */}
      <nav className={`nr-nav ${scrolled ? 'nr-nav--scrolled' : ''}`}>
        <a href="#top" className="nr-logo">
          <span className="nr-logo-orb" />
          Nora<span className="nr-logo-sub">AI</span>
        </a>
        <div className="nr-nav-links">
          <a href="#voice">Voice</a>
          <a href="#who">Who she is</a>
          <a href="#inside">{focus === 'all' ? 'Inside each app' : narrative.insideLabel}</a>
          {narrative.showMemory && <a href="#memory">One memory</a>}
          <a href="#reach" className="nr-nav-cta">
            Talk to Nora
          </a>
        </div>
      </nav>

      {/* ── HERO ORB ── */}
      <section className="nr-hero" id="top">
        {/* animated grid + scan lines + aurora */}
        <div className="nr-aurora" />
        <div className="nr-grid" />
        <div className="nr-scanlines" />

        {/* constellation dots */}
        <div className="nr-stars">
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className="nr-star"
              style={{
                left: `${(i * 97) % 100}%`,
                top: `${(i * 53) % 100}%`,
                animationDelay: `${(i % 11) * 0.4}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        <div className="nr-hero-inner">
          <div className="nr-eyebrow">
            <span className="nr-eyebrow-dot" />
            Nora · Always-on AI coach
          </div>

          <h1 className="nr-h1">
            The voice behind<br />
            {narrative.heroEmphasis}
          </h1>

          <p className="nr-hero-sub">{narrative.heroSub}</p>

          {/* THE ORB */}
          <div className="nr-orb-stage">
            {/* Halo rings */}
            <svg
              className="nr-orb-rings"
              viewBox="0 0 400 400"
              width="400"
              height="400"
              aria-hidden
            >
              {[0, 1, 2, 3].map((i) => (
                <circle
                  key={i}
                  cx="200"
                  cy="200"
                  r={110 + i * 20 + intensity * 12}
                  fill="none"
                  stroke={`hsla(${accentHue}, 90%, 62%, ${ringOpacity / (i + 1)})`}
                  strokeWidth={ringStroke / (i + 1)}
                  strokeDasharray={`${4 + i * 2} ${10 + i * 3}`}
                  style={{
                    transform: 'rotate(0deg)',
                    transformOrigin: '200px 200px',
                    animation: `nrRingSpin ${18 + i * 7}s linear infinite ${i % 2 ? 'reverse' : ''}`,
                    transition: 'r 0.12s linear, stroke 0.3s',
                  }}
                />
              ))}
            </svg>

            {/* Ambient glow */}
            <div
              className="nr-orb-glow"
              style={{
                background: `radial-gradient(circle, hsla(${accentHue}, 92%, 60%, 0.55) 0%, transparent 70%)`,
                filter: `blur(${glowSize}px)`,
                transform: `scale(${0.8 + intensity * 0.6})`,
              }}
            />

            {/* Core orb */}
            <button
              type="button"
              className="nr-orb"
              onClick={() =>
                playSample(HERO_SAMPLE)
              }
              aria-label={isPlaying ? 'Stop Nora' : 'Play Nora intro'}
              style={{
                transform: `scale(${coreScale})`,
                background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.55) 0%, hsla(${accentHue}, 88%, 60%, 0.95) 45%, hsla(${accentHue}, 82%, 32%, 0.98) 100%)`,
                boxShadow: `0 0 ${glowSize * 0.6}px hsla(${accentHue}, 92%, 62%, 0.55), inset 0 0 40px rgba(255,255,255,0.15)`,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#0a0f0a" aria-hidden>
                {isPlaying ? (
                  <rect x="7" y="7" width="10" height="10" rx="1.6" />
                ) : (
                  <path d="M8 5v14l11-7z" />
                )}
              </svg>
            </button>

            {/* Spectrum bars */}
            <div className="nr-spectrum">
              {Array.from({ length: 32 }).map((_, i) => {
                const wave = Math.sin((i + intensity * 30) * 0.35) * 0.5 + 0.5;
                const h = 6 + (wave * (0.35 + intensity)) * 56;
                return (
                  <span
                    key={i}
                    className="nr-spec-bar"
                    style={{
                      height: `${h}px`,
                      background: `linear-gradient(180deg, hsla(${accentHue}, 92%, 65%, 0.95), hsla(${accentHue + 20}, 88%, 48%, 0.6))`,
                      opacity: 0.4 + intensity * 0.7,
                    }}
                  />
                );
              })}
            </div>

            {/* Telemetry tag */}
            <div className="nr-telemetry">
              <span className="nr-tel-dot" style={{ background: `hsl(${accentHue}, 92%, 62%)` }} />
              <span className="nr-tel-k">STATUS</span>
              <span className="nr-tel-v">{telemetry}</span>
              <span className="nr-tel-sep">·</span>
              <span className="nr-tel-k">HUE</span>
              <span className="nr-tel-v">{Math.round(accentHue)}°</span>
              <span className="nr-tel-sep">·</span>
              <span className="nr-tel-k">I</span>
              <span className="nr-tel-v">{intensity.toFixed(2)}</span>
            </div>

            {/* scrub */}
            {duration > 0 && (
              <div className="nr-scrub">
                <div
                  className="nr-scrub-fill"
                  style={{
                    width: `${(progress / duration) * 100}%`,
                    background: `linear-gradient(90deg, hsl(${accentHue}, 90%, 60%), hsl(${accentHue + 24}, 90%, 55%))`,
                  }}
                />
              </div>
            )}
          </div>

          <div className="nr-hero-ctas">
            <button
              type="button"
              className="nr-btn-primary"
              onClick={() =>
                playSample(HERO_SAMPLE)
              }
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                {isPlaying ? (
                  <rect x="7" y="7" width="10" height="10" rx="1.6" />
                ) : (
                  <path d="M8 5v14l11-7z" />
                )}
              </svg>
              {isPlaying ? 'Stop Nora' : 'Hear Nora speak'}
            </button>
            <a href="#voice" className="nr-btn-secondary">
              More voice samples ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── VOICE BANK ── */}
      <section className="nr-section" id="voice">
        <div className="nr-section-inner">
          <div className="nr-reveal">
            <span className="nr-label">Her Voice</span>
            <h2 className="nr-h2">
              Warm, precise,<br />
              <em>never in a hurry.</em>
            </h2>
            <p className="nr-section-sub">
              Nora's voice was tuned to feel like a coach who actually listens — not a bot. Low
              affect, clear diction, confident pauses. Tap any sample; the orb above will respond
              to her in real time.
            </p>
          </div>

          <div className="nr-voice-grid nr-reveal">
            {VOICE_SAMPLES.map((s) => {
              const active = activeSampleId === s.id;
              const playing = active && isPlaying;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`nr-voice-card ${playing ? 'nr-voice-card--active' : ''}`}
                  onClick={() => playSample(s)}
                >
                  <div className="nr-voice-head">
                    <span className="nr-voice-play">
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        {playing ? (
                          <rect x="7" y="7" width="10" height="10" rx="1.6" />
                        ) : (
                          <path d="M8 5v14l11-7z" />
                        )}
                      </svg>
                    </span>
                    <div>
                      <strong>{s.title}</strong>
                      <span>{s.ctx}</span>
                    </div>
                    {playing && (
                      <div className="nr-voice-wave">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span key={i} style={{ animationDelay: `${i * 0.1}s` }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="nr-voice-script">{s.script}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── WHO SHE IS ── */}
      <section className="nr-section nr-section--offset" id="who">
        <div className="nr-section-inner">
          <div className="nr-who-grid">
            <div className="nr-reveal">
              <span className="nr-label">Who she is</span>
              <h2 className="nr-h2">
                Built for the moment<br />
                <em>you'd call a friend.</em>
              </h2>
              <p className="nr-section-sub">
                Nora isn't a chatbot layer. She's a sport-psychology-informed companion with eyes
                on your biometrics, your training, your nutrition, and your mental check-ins —
                continuously, quietly, and privately.
              </p>
            </div>
            <div className="nr-dossier nr-reveal">
              {[
                { k: 'Role', v: 'AI mental performance coach' },
                { k: 'Trained on', v: 'Elite sport psychology · CBT fundamentals · IPAP frameworks' },
                { k: 'Always-on', v: '2-minute check-ins · game-day jitters · reset scripts' },
                { k: 'Reads', v: 'HealthKit · WHOOP · Oura · training data · meal logs' },
                { k: 'Privacy', v: 'Athlete-controlled. Nora shares trends, not transcripts.' },
                { k: 'Escalates', v: 'Routes to human clinicians when needed' },
              ].map((row, i) => (
                <div
                  key={row.k}
                  className="nr-dossier-row"
                  style={{ animationDelay: `${0.3 + i * 0.08}s` }}
                >
                  <span className="nr-dossier-k">{row.k}</span>
                  <span className="nr-dossier-v">{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CAPABILITIES GRID ── */}
      <section className="nr-section" id="capabilities">
        <div className="nr-section-inner">
          <div className="nr-caps-head nr-reveal">
            <span className="nr-label">What she does</span>
            <h2 className="nr-h2">
              Three loops.<br />
              <em>Running in the background of your life.</em>
            </h2>
          </div>
          <div className="nr-caps-grid">
            {[
              {
                i: '🎧',
                k: 'LISTEN',
                t: 'Low-friction daily check-in',
                d: 'Two minutes. No forms. Nora talks, you answer. She pulls in sleep, HRV, stress, and training load automatically.',
                tint: 180,
              },
              {
                i: '🧭',
                k: 'COACH',
                t: 'Real-time sport psychology',
                d: 'Box breathing, reset scripts, confidence anchoring — delivered the moment your biometrics or words signal the need.',
                tint: 280,
              },
              {
                i: '🛡',
                k: 'ESCALATE',
                t: 'Hands off when it matters',
                d: 'If Nora detects clinical-level distress, she packages the context and routes you to a human professional.',
                tint: 0,
              },
            ].map((c) => (
              <div key={c.k} className="nr-cap nr-reveal">
                <div
                  className="nr-cap-icon"
                  style={{
                    background: `hsla(${c.tint}, 80%, 60%, 0.14)`,
                    color: `hsl(${c.tint}, 85%, 65%)`,
                  }}
                >
                  {c.i}
                </div>
                <span className="nr-cap-k" style={{ color: `hsl(${c.tint}, 85%, 65%)` }}>
                  {c.k}
                </span>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
                <span
                  className="nr-cap-glow"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, hsla(${c.tint}, 90%, 60%, 0.25), transparent 70%)`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHERE SHE LIVES ── */}
      {narrative.showWhereSection && (
      <section className="nr-section" id="where">
        <div className="nr-section-inner">
          <div className="nr-reveal">
            <span className="nr-label">Where she lives</span>
            <h2 className="nr-h2">
              One Nora.<br />
              <em>Three products.</em>
            </h2>
            <p className="nr-section-sub">
              Nora is the connective tissue across Pulse Intelligence Labs. Same memory, same
              voice, three different jobs.
            </p>
          </div>
          <div className="nr-surfaces">
            {[
              {
                href: '/',
                name: 'Fit With Pulse',
                tag: 'Clubs · Training',
                desc: 'Builds your workouts with you. Spots progression patterns. Keeps your club on beat.',
                hue: 100,
              },
              {
                href: '/PulseCheck',
                name: 'PulseCheck',
                tag: 'Mental performance',
                desc: 'The 2-minute mental check-in for athletes. Reads readiness, coaches in-the-moment, escalates when it has to.',
                hue: 270,
              },
              {
                href: '/Macra',
                name: 'Macra',
                tag: 'Nutrition AI',
                desc: 'Turns any plate into macros. Writes Meal 1, 2, 3 around your daily target and re-plans when you go off script.',
                hue: 210,
              },
            ].map((s) => (
              <a key={s.name} href={s.href} className="nr-surface nr-reveal">
                <span
                  className="nr-surface-glow"
                  style={{
                    background: `radial-gradient(circle at 30% 0%, hsla(${s.hue},90%,60%,0.18), transparent 70%)`,
                  }}
                />
                <span className="nr-surface-tag" style={{ color: `hsl(${s.hue},85%,65%)` }}>
                  {s.tag}
                </span>
                <strong>{s.name}</strong>
                <p>{s.desc}</p>
                <span className="nr-surface-arrow" style={{ color: `hsl(${s.hue},85%,65%)` }}>
                  Visit →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── INSIDE EACH PRODUCT — intro ── */}
      <section className="nr-section nr-section--offset" id="inside">
        <div className="nr-section-inner">
          <div className="nr-inside-head nr-reveal">
            <span className="nr-label">{narrative.insideLabel}</span>
            <h2 className="nr-h2">
              {focus === 'all' ? 'Same Nora.' : 'One Nora.'}<br />
              <em>{narrative.insideTitleEm}</em>
            </h2>
            <p className="nr-section-sub nr-inside-sub">{narrative.insideSub}</p>
          </div>

          {/* ── PRODUCT 1 — Fit With Pulse ── */}
          {narrative.showFwp && (
          <div className="nr-product nr-reveal" style={{ ['--p-hue' as string]: '95' }}>
            <div className="nr-product-copy">
              <span className="nr-product-tag">
                <span className="nr-product-dot" />
                Fit With Pulse · Clubs &amp; Routines
              </span>
              <h3 className="nr-product-h">
                She trains<br />
                <em>with your club.</em>
              </h3>
              <p className="nr-product-p">
                Inside Fit With Pulse, Nora is your training-floor companion. She builds Routines
                with you — not generic plans — watching volume, RPE, and recovery across the week.
                She keeps your club on beat: shout-outs after a PR, a nudge when somebody's gone
                quiet, a recap the morning after.
              </p>
              <ul className="nr-product-list">
                <li>
                  <span>Writes &amp; adapts Routines</span>
                  <em>Spots progression patterns no one else sees — bench stalled three sessions? She knows.</em>
                </li>
                <li>
                  <span>Keeps the club in rhythm</span>
                  <em>Celebrates PRs, checks on quiet members, surfaces the week's most-logged lifts.</em>
                </li>
                <li>
                  <span>Reads the full picture</span>
                  <em>Training load, sleep, HRV — so the next session is the right session.</em>
                </li>
              </ul>
              <a href="/" className="nr-product-cta">
                See Nora inside Fit With Pulse →
              </a>
            </div>
            <div className="nr-product-scene">
              <div className="nr-phone">
                <div className="nr-phone-notch" />
                <div className="nr-phone-inner">
                  <div className="nr-phone-head">
                    <span className="nr-phone-orb" />
                    <div>
                      <strong>Nora</strong>
                      <span>Fit With Pulse · Club: Morning Lift</span>
                    </div>
                  </div>
                  <div className="nr-phone-msg nr-phone-msg--nora">
                    "Your bench has held at 225 for three sessions. Want to switch to pause reps
                    this week and retest Friday?"
                  </div>
                  <div className="nr-phone-card">
                    <div className="nr-phone-card-row">
                      <span>TODAY · PUSH A</span>
                      <em>4 movements · 38 min</em>
                    </div>
                    <div className="nr-phone-card-row">
                      <span>VOLUME · 7 DAYS</span>
                      <em>+12% vs last week</em>
                    </div>
                    <div className="nr-phone-card-row">
                      <span>CLUB · 6 ACTIVE</span>
                      <em>2 new PRs · Nora sent kudos</em>
                    </div>
                  </div>
                  <div className="nr-phone-msg nr-phone-msg--user">
                    Yeah, let's do pause reps.
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ── PRODUCT 2 — PulseCheck ── */}
          {narrative.showPulseCheck && (
          <div
            className={`nr-product nr-reveal${focus === 'all' ? ' nr-product--reverse' : ''}`}
            style={{ ['--p-hue' as string]: '270' }}
          >
            <div className="nr-product-copy">
              <span className="nr-product-tag">
                <span className="nr-product-dot" />
                PulseCheck · Mental Performance
              </span>
              <h3 className="nr-product-h">
                She listens<br />
                <em>before the spiral.</em>
              </h3>
              <p className="nr-product-p">
                Inside PulseCheck, Nora is a sport-psychology-informed coach on call. Two-minute
                check-ins in the morning. A reset script before you walk into a hard conversation.
                She reads your HRV like a coach reads a room — and escalates to a human clinician
                when it matters.
              </p>
              <ul className="nr-product-list">
                <li>
                  <span>2-minute daily check-ins</span>
                  <em>Voice-first. No forms. She asks, you answer — she translates into readiness.</em>
                </li>
                <li>
                  <span>In-the-moment coaching</span>
                  <em>Box breathing, confidence anchoring, reset scripts the moment your signals shift.</em>
                </li>
                <li>
                  <span>Clinical-grade escalation</span>
                  <em>If distress crosses a threshold, she routes to a human with context intact.</em>
                </li>
              </ul>
              <div className={`nr-product-protocol-card ${isBoxBreathingActive ? 'nr-product-protocol-card--active' : ''}`}>
                <div className="nr-product-protocol-head">
                  <button
                    type="button"
                    className="nr-product-protocol-icon"
                    onClick={startPulseCheckBoxBreathing}
                    aria-label={isBoxBreathingActive ? 'Stop Box Breathing Protocol' : 'Start Box Breathing Protocol'}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      {isBoxBreathingActive ? (
                        <rect x="7" y="7" width="10" height="10" rx="1.6" />
                      ) : (
                        <path d="M9 6.5v11l8.5-5.5z" />
                      )}
                    </svg>
                  </button>
                  <div>
                    <strong>Nora Delivers Box Breathing Protocol</strong>
                    <span>Exercise dropped into chat the moment readiness signals shift.</span>
                  </div>
                  {isBoxBreathingActive && (
                    <div className="nr-product-protocol-wave" aria-hidden>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} style={{ animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                  )}
                </div>
                <p>
                  "I want to run you through Box Breathing. Four rounds: inhale for 4, hold for 4,
                  exhale for 4, hold for 4. Stay with the circle and let your system settle."
                </p>
              </div>
            </div>
            <div className="nr-product-scene nr-product-scene--pc">
              <NoraBoxBreathingPhone
                ref={boxBreathingPhoneRef}
                audioSrc="/audio/pulsecheckdemo/act1-04-box-breathing.mp3"
                onSessionActiveChange={setIsBoxBreathingActive}
              />
            </div>
          </div>
          )}

          {/* ── PRODUCT 3 — Macra ── */}
          {narrative.showMacra && (
          <div className="nr-product nr-reveal" style={{ ['--p-hue' as string]: '210' }}>
            <div className="nr-product-copy">
              <span className="nr-product-tag">
                <span className="nr-product-dot" />
                Macra · Nutrition AI
              </span>
              <h3 className="nr-product-h">
                She writes<br />
                <em>your day in food.</em>
              </h3>
              <p className="nr-product-p">
                Inside Macra, Nora turns any plate into macros and turns your day into Meal 1, Meal
                2, Meal 3 — built around your target, your training, your taste. Miss a meal? She
                re-plans the rest of the day in seconds. Go off script? She absorbs it and keeps
                you on target.
              </p>
              <ul className="nr-product-list">
                <li>
                  <span>Plate → macros instantly</span>
                  <em>Snap it. She reads it. Your day ledger updates before you've put the fork down.</em>
                </li>
                <li>
                  <span>Writes Meal 1, 2, 3</span>
                  <em>Built for your daily target — and the lift, practice, or recovery day ahead.</em>
                </li>
                <li>
                  <span>Rolls with real life</span>
                  <em>Pizza on Friday? Fine. She rebalances Saturday. No shame, just math.</em>
                </li>
              </ul>
              <a href="/Macra" className="nr-product-cta">
                See Nora inside Macra →
              </a>
            </div>
            <div className="nr-product-scene">
              <div className="nr-phone">
                <div className="nr-phone-notch" />
                <div className="nr-phone-inner">
                  <div className="nr-phone-head">
                    <span className="nr-phone-orb" />
                    <div>
                      <strong>Nora</strong>
                      <span>Macra · Today · 1,840 / 2,400 kcal</span>
                    </div>
                  </div>
                  <div className="nr-phone-msg nr-phone-msg--nora">
                    "You skipped Meal 1 and lift is at 5. I'll front-load protein on Meal 2 and
                    shift carbs closer to the warm-up."
                  </div>
                  <div className="nr-phone-meals">
                    <div className="nr-phone-meal nr-phone-meal--done">
                      <strong>Meal 1</strong>
                      <span>skipped · rolled into Meal 2</span>
                    </div>
                    <div className="nr-phone-meal nr-phone-meal--now">
                      <strong>Meal 2 · 2:30 pm</strong>
                      <span>46P · 58C · 14F · pre-lift fuel</span>
                    </div>
                    <div className="nr-phone-meal">
                      <strong>Meal 3 · 8:00 pm</strong>
                      <span>38P · 62C · 18F · recovery</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </section>

      {/* ── ONE MEMORY — continuity ── */}
      {narrative.showMemory && (
      <section className="nr-memory" id="memory">
        <div className="nr-memory-bg" />
        <div className="nr-section-inner">
          <div className="nr-memory-head nr-reveal">
            <span className="nr-label">One memory</span>
            <h2 className="nr-h2">
              What she learns<br />
              <em>travels with her.</em>
            </h2>
            <p className="nr-section-sub nr-memory-sub">
              Nora doesn't start cold inside each product. Whatever she knows about you in one
              place, she knows everywhere. The lift you just crushed shows up in your Macra plan.
              The bad night's sleep you flagged in PulseCheck shows up as a lighter Routine. One
              continuous picture — with your permission, and always private.
            </p>
          </div>

          <div className="nr-constellation nr-reveal">
            <svg
              className="nr-constellation-lines"
              viewBox="0 0 600 360"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <linearGradient id="nr-line-a" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="hsl(95,90%,65%)" />
                  <stop offset="1" stopColor="hsl(270,85%,72%)" />
                </linearGradient>
                <linearGradient id="nr-line-b" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="hsl(270,85%,72%)" />
                  <stop offset="1" stopColor="hsl(210,90%,68%)" />
                </linearGradient>
                <linearGradient id="nr-line-c" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stopColor="hsl(210,90%,68%)" />
                  <stop offset="1" stopColor="hsl(95,90%,65%)" />
                </linearGradient>
              </defs>
              <path d="M 120 90 Q 300 20 480 90" stroke="url(#nr-line-a)" strokeWidth="1.5" fill="none" strokeDasharray="4 6" />
              <path d="M 480 90 Q 560 220 300 300" stroke="url(#nr-line-b)" strokeWidth="1.5" fill="none" strokeDasharray="4 6" />
              <path d="M 300 300 Q 40 220 120 90" stroke="url(#nr-line-c)" strokeWidth="1.5" fill="none" strokeDasharray="4 6" />
            </svg>

            <div className="nr-node nr-node--fwp">
              <span className="nr-node-orb" />
              <strong>Fit With Pulse</strong>
              <em>Training · Clubs · Routines</em>
            </div>
            <div className="nr-node nr-node--pc">
              <span className="nr-node-orb" />
              <strong>PulseCheck</strong>
              <em>Mind · Readiness · Check-ins</em>
            </div>
            <div className="nr-node nr-node--macra">
              <span className="nr-node-orb" />
              <strong>Macra</strong>
              <em>Fuel · Meal 1/2/3 · Macros</em>
            </div>

            <div className="nr-node nr-node--center">
              <span className="nr-node-core" />
              <strong>Nora</strong>
              <em>One mind · one memory</em>
            </div>
          </div>

          <div className="nr-cross-grid">
            {[
              {
                from: 'Fit With Pulse',
                to: 'Macra',
                fromHue: 95,
                toHue: 210,
                body:
                  'Heavy lift this morning? Macra raises today\'s protein target and shifts carbs closer to training.',
              },
              {
                from: 'PulseCheck',
                to: 'Fit With Pulse',
                fromHue: 270,
                toHue: 95,
                body:
                  'Poor sleep and high stress? Your next Routine auto-deloads — Nora flags it in the club so no one pushes you.',
              },
              {
                from: 'Macra',
                to: 'PulseCheck',
                fromHue: 210,
                toHue: 270,
                body:
                  'Under-fueled three days running? PulseCheck expects the mood dip and opens the check-in a little softer.',
              },
            ].map((c) => (
              <div key={c.from + c.to} className="nr-cross nr-reveal">
                <div className="nr-cross-head">
                  <span className="nr-cross-pill" style={{ color: `hsl(${c.fromHue},85%,70%)`, borderColor: `hsla(${c.fromHue},85%,60%,0.35)` }}>
                    {c.from}
                  </span>
                  <span className="nr-cross-arrow">→</span>
                  <span className="nr-cross-pill" style={{ color: `hsl(${c.toHue},85%,70%)`, borderColor: `hsla(${c.toHue},85%,60%,0.35)` }}>
                    {c.to}
                  </span>
                </div>
                <p>{c.body}</p>
              </div>
            ))}
          </div>

          <div className="nr-memory-foot nr-reveal">
            <span className="nr-memory-lock">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
              </svg>
              Yours, always
            </span>
            <p>
              Nora's memory is athlete-controlled. Cross-product signals move between surfaces, not
              out of them. You can pause, inspect, or wipe what she remembers at any time.
            </p>
          </div>
        </div>
      </section>
      )}

      {/* ── CTA ── */}
      <section className="nr-cta" id="reach">
        <div className="nr-cta-glow" />
        <div className="nr-cta-inner">
          <span className="nr-cta-eye">{narrative.ctaEye}</span>
          <h2 className="nr-cta-h2">
            {narrative.ctaTitle}
            <em>{narrative.ctaTitleEm}</em>
          </h2>
          <p>{narrative.ctaSub}</p>
          <div className="nr-cta-btns">
            <a href={narrative.ctaPrimaryHref} className="nr-btn-primary">
              {narrative.ctaPrimaryLabel}
            </a>
            {narrative.ctaSecondaryHref && narrative.ctaSecondaryLabel && (
              <a href={narrative.ctaSecondaryHref} className="nr-btn-secondary">
                {narrative.ctaSecondaryLabel}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="nr-footer">
        <div className="nr-footer-inner">
          <div>
            <div className="nr-logo" style={{ marginBottom: 10 }}>
              <span className="nr-logo-orb" />
              Nora<span className="nr-logo-sub">AI</span>
            </div>
            <p className="nr-footer-p">
              The coach inside every Pulse surface — from Pulse Intelligence Labs.
            </p>
          </div>
          <div>
            <h4>Products</h4>
            <a href="/">Fit With Pulse</a>
            <a href="/PulseCheck">PulseCheck</a>
            <a href="/Macra">Macra</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="/about">About</a>
            <a href="/PulseCheck">Clinical safety</a>
            <a href="mailto:pulsefitnessapp@gmail.com">Contact</a>
          </div>
        </div>
        <div className="nr-footer-bottom">
          © 2026 Pulse Intelligence Labs, Inc. · Nora is a registered companion of Pulse.
        </div>
      </footer>

      <style>{`
        .nr {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          background: #05070a;
          color: #e9ecef;
          overflow-x: hidden;
          min-height: 100vh;
        }
        .nr *, .nr *::before, .nr *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── NAV ── */
        .nr-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 56px;
          transition: padding 0.35s cubic-bezier(0.16,1,0.3,1), background 0.35s, border-color 0.35s;
        }
        .nr-nav--scrolled {
          background: rgba(5,7,10,0.72);
          backdrop-filter: blur(18px) saturate(180%);
          -webkit-backdrop-filter: blur(18px) saturate(180%);
          border-bottom: 1px solid rgba(120,200,255,0.1);
          padding: 12px 56px;
        }
        .nr-logo {
          display: flex; align-items: center; gap: 10px;
          color: #fff; font-weight: 700; font-size: 18px; text-decoration: none;
          letter-spacing: -0.01em;
        }
        .nr-logo-orb {
          width: 22px; height: 22px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.65), hsl(95,90%,55%) 45%, hsl(150,80%,30%));
          box-shadow: 0 0 12px hsla(120,90%,60%,0.55), inset 0 0 8px rgba(255,255,255,0.2);
          animation: nrOrbIdle 3s ease-in-out infinite;
        }
        .nr-logo-sub {
          font-size: 10px; letter-spacing: 0.14em;
          color: hsl(140,80%,65%);
          font-weight: 600;
          margin-left: 2px;
          text-transform: uppercase;
        }
        @keyframes nrOrbIdle {
          0%,100% { transform: scale(1); box-shadow: 0 0 12px hsla(120,90%,60%,0.5), inset 0 0 8px rgba(255,255,255,0.2); }
          50%      { transform: scale(1.08); box-shadow: 0 0 18px hsla(130,95%,65%,0.7), inset 0 0 10px rgba(255,255,255,0.25); }
        }
        .nr-nav-links { display: flex; align-items: center; gap: 28px; }
        .nr-nav-links a {
          text-decoration: none; font-size: 14px; font-weight: 500;
          color: rgba(255,255,255,0.55);
          transition: color 0.2s;
        }
        .nr-nav-links a:hover { color: hsl(140,85%,72%); }
        .nr-nav-cta {
          background: linear-gradient(135deg, hsl(95,90%,58%), hsl(160,80%,45%));
          color: #062018 !important;
          padding: 9px 18px;
          border-radius: 8px;
          font-weight: 700 !important;
          font-size: 13px !important;
          box-shadow: 0 4px 16px hsla(120,85%,60%,0.28);
        }
        .nr-nav-cta:hover { transform: translateY(-1px); }

        /* ── HERO ── */
        .nr-hero {
          position: relative; min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          padding: 140px 32px 80px;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 50% 20%, rgba(72,220,180,0.08), transparent 70%),
            radial-gradient(ellipse at 30% 80%, rgba(70,150,240,0.06), transparent 70%),
            radial-gradient(ellipse at 70% 70%, rgba(180,100,255,0.05), transparent 70%),
            #05070a;
        }
        .nr-aurora {
          position: absolute; inset: -20% -10%;
          background:
            conic-gradient(from 180deg at 50% 50%,
              hsla(90,95%,60%,0.18),
              hsla(165,85%,55%,0.12),
              hsla(210,80%,60%,0.10),
              hsla(280,75%,55%,0.08),
              hsla(90,95%,60%,0.18));
          filter: blur(100px);
          animation: nrAurora 30s linear infinite;
          opacity: 0.55;
          pointer-events: none;
        }
        @keyframes nrAurora { to { transform: rotate(360deg); } }
        .nr-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(120,220,180,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,220,180,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
          pointer-events: none;
          animation: nrGridDrift 40s linear infinite;
        }
        @keyframes nrGridDrift { from { background-position: 0 0, 0 0; } to { background-position: 60px 60px, 60px 60px; } }
        .nr-scanlines {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px);
          pointer-events: none;
          mix-blend-mode: overlay;
        }
        .nr-stars { position: absolute; inset: 0; pointer-events: none; }
        .nr-star {
          position: absolute; width: 2px; height: 2px; border-radius: 50%;
          background: hsla(140,90%,75%,0.8);
          box-shadow: 0 0 6px hsla(140,90%,75%,0.6);
          animation: nrTwinkle 4s ease-in-out infinite;
        }
        @keyframes nrTwinkle {
          0%,100% { opacity: 0.15; transform: scale(0.8); }
          50%      { opacity: 1;    transform: scale(1.2); }
        }

        .nr-hero-inner {
          position: relative; z-index: 2;
          max-width: 900px; width: 100%;
          text-align: center;
          display: flex; flex-direction: column; align-items: center;
        }

        .nr-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 7px 16px; border-radius: 100px;
          background: rgba(190,242,100,0.06);
          border: 1px solid rgba(190,242,100,0.18);
          color: rgba(220,240,205,0.85);
          font-size: 12px; font-weight: 500;
          letter-spacing: 0.03em;
          margin-bottom: 28px;
          backdrop-filter: blur(8px);
          animation: nrFadeUp 0.8s ease 0.2s both;
        }
        .nr-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: hsl(100,90%,60%);
          box-shadow: 0 0 10px hsl(100,90%,60%);
          animation: nrPulseDot 2s ease infinite;
        }
        @keyframes nrPulseDot {
          0%,100% { box-shadow: 0 0 0 0 hsla(100,90%,60%,0.8); }
          50%      { box-shadow: 0 0 0 8px transparent; }
        }

        .nr-h1 {
          font-size: clamp(42px, 5.5vw, 84px);
          line-height: 1.02;
          font-weight: 700;
          letter-spacing: -0.035em;
          color: #fff;
          margin-bottom: 22px;
          animation: nrFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.35s both;
        }
        .nr-h1 em {
          font-style: italic;
          background: linear-gradient(135deg, hsl(85,95%,65%) 0%, hsl(170,85%,55%) 55%, hsl(280,75%,70%) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nr-hero-sub {
          font-size: 17px;
          color: rgba(255,255,255,0.58);
          line-height: 1.7;
          max-width: 640px;
          margin-bottom: 48px;
          animation: nrFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.5s both;
        }

        /* ── ORB STAGE ── */
        .nr-orb-stage {
          position: relative;
          width: 100%; max-width: 420px;
          height: 420px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 44px;
          animation: nrFadeUp 1.1s cubic-bezier(0.16,1,0.3,1) 0.6s both;
        }
        .nr-orb-rings {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: transform;
        }
        @keyframes nrRingSpin { to { transform: rotate(360deg); } }

        .nr-orb-glow {
          position: absolute;
          top: 50%; left: 50%;
          width: 260px; height: 260px;
          margin-left: -130px; margin-top: -130px;
          border-radius: 50%;
          pointer-events: none;
          transition: transform 0.12s ease, filter 0.2s ease;
          will-change: transform, filter;
        }
        .nr-orb {
          position: relative; z-index: 2;
          width: 110px; height: 110px;
          border-radius: 50%; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.1s ease, box-shadow 0.25s ease;
          will-change: transform;
        }
        .nr-orb svg {
          display: block;
          filter: drop-shadow(0 1px 4px rgba(255,255,255,0.45));
        }
        .nr-orb:hover { filter: brightness(1.08); }
        .nr-orb::after {
          content: '';
          position: absolute; inset: -6px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.25);
          animation: nrOrbPulse 2.4s ease-out infinite;
          pointer-events: none;
        }
        @keyframes nrOrbPulse {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        .nr-spectrum {
          position: absolute;
          left: 50%; bottom: 6%;
          transform: translateX(-50%);
          display: flex; align-items: flex-end;
          gap: 3px;
          height: 60px;
          pointer-events: none;
        }
        .nr-spec-bar {
          width: 3px;
          border-radius: 2px;
          transition: height 0.08s ease-out, opacity 0.2s;
        }

        .nr-telemetry {
          position: absolute;
          top: 12px; left: 50%;
          transform: translateX(-50%);
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px;
          background: rgba(10,14,10,0.6);
          border: 1px solid rgba(190,242,100,0.18);
          border-radius: 100px;
          backdrop-filter: blur(14px);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }
        .nr-tel-dot {
          width: 7px; height: 7px; border-radius: 50%;
          box-shadow: 0 0 8px currentColor;
          animation: nrPulseDot 1.2s ease infinite;
        }
        .nr-tel-k { color: rgba(255,255,255,0.38); font-weight: 600; }
        .nr-tel-v { color: hsl(140,90%,72%); font-weight: 700; }
        .nr-tel-sep { color: rgba(255,255,255,0.18); }

        .nr-scrub {
          position: absolute;
          left: 50%; bottom: -8px;
          transform: translateX(-50%);
          width: 220px; height: 2px;
          background: rgba(255,255,255,0.08);
          border-radius: 2px;
          overflow: hidden;
        }
        .nr-scrub-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.12s linear;
        }

        /* ── HERO CTAS ── */
        .nr-hero-ctas {
          display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
          animation: nrFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.85s both;
        }
        .nr-btn-primary {
          display: inline-flex; align-items: center; gap: 9px;
          background: linear-gradient(135deg, hsl(95,92%,58%), hsl(160,80%,45%));
          color: #062018; padding: 14px 26px;
          border-radius: 12px; border: none; cursor: pointer;
          font-weight: 700; font-size: 15px; text-decoration: none;
          box-shadow: 0 6px 28px hsla(120,85%,60%,0.3), 0 0 0 1px hsla(120,90%,60%,0.35) inset;
          transition: transform 0.2s, box-shadow 0.2s;
          font-family: inherit;
        }
        .nr-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 40px hsla(120,85%,60%,0.45); }
        .nr-btn-primary svg { width: 16px; height: 16px; flex-shrink: 0; }
        .nr-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent;
          color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.15);
          padding: 14px 22px;
          border-radius: 12px;
          font-size: 15px; font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .nr-btn-secondary:hover { color: hsl(120,90%,72%); border-color: hsla(120,90%,60%,0.4); background: hsla(120,90%,60%,0.04); }

        /* ── SECTIONS ── */
        .nr-section { padding: 140px 56px; position: relative; }
        .nr-section--offset { background: rgba(255,255,255,0.015); }
        .nr-section-inner { max-width: 1180px; margin: 0 auto; position: relative; z-index: 1; }

        .nr-label {
          display: inline-block;
          padding: 6px 14px;
          background: rgba(190,242,100,0.07);
          border: 1px solid rgba(190,242,100,0.22);
          color: hsl(100,80%,75%);
          border-radius: 20px;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 11px; font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          margin-bottom: 20px;
        }
        .nr-h2 {
          font-size: clamp(30px, 3.8vw, 56px);
          line-height: 1.04;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #fff;
          margin-bottom: 20px;
        }
        .nr-h2 em {
          font-style: italic;
          background: linear-gradient(135deg, hsl(85,95%,65%), hsl(170,85%,55%), hsl(280,75%,70%));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nr-section-sub {
          font-size: 17px;
          color: rgba(255,255,255,0.58);
          line-height: 1.7;
          max-width: 560px;
          margin-bottom: 44px;
        }

        .nr-reveal {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1);
        }
        .nr-visible { opacity: 1; transform: translateY(0); }

        /* ── VOICE BANK ── */
        .nr-voice-grid {
          display: grid; grid-template-columns: repeat(2,1fr); gap: 18px;
          margin-top: 12px;
        }
        .nr-voice-card {
          text-align: left;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(190,242,100,0.1);
          border-radius: 18px;
          padding: 22px 24px;
          color: #fff;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.25s, border-color 0.25s, transform 0.25s;
          position: relative;
          overflow: hidden;
        }
        .nr-voice-card:hover {
          transform: translateY(-2px);
          border-color: hsla(120,90%,60%,0.28);
          background: rgba(190,242,100,0.04);
        }
        .nr-voice-card--active {
          border-color: hsla(120,90%,60%,0.55);
          background: rgba(190,242,100,0.06);
          box-shadow: 0 0 0 1px hsla(120,90%,60%,0.2), 0 20px 50px hsla(120,90%,50%,0.1);
        }
        .nr-voice-head {
          display: flex; align-items: center; gap: 14px;
          margin-bottom: 14px;
        }
        .nr-voice-play {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, hsl(95,92%,58%), hsl(160,80%,45%));
          color: #062018;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px hsla(120,85%,60%,0.28);
        }
        .nr-voice-play svg {
          display: block;
          width: 17px;
          height: 17px;
          filter: drop-shadow(0 1px 3px rgba(255,255,255,0.32));
        }
        .nr-voice-head strong { display: block; font-size: 14px; color: #fff; font-weight: 700; }
        .nr-voice-head span { font-size: 11px; color: rgba(255,255,255,0.45); }
        .nr-voice-wave {
          margin-left: auto;
          display: flex; align-items: center; gap: 3px;
          height: 20px;
        }
        .nr-voice-wave span {
          display: block; width: 3px; border-radius: 2px;
          background: hsl(140,90%,65%);
          animation: nrVoiceBar 0.9s ease-in-out infinite;
        }
        @keyframes nrVoiceBar {
          0%,100% { height: 4px; }
          50%     { height: 18px; }
        }
        .nr-voice-script {
          font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.75);
          font-style: italic;
          border-left: 2px solid rgba(190,242,100,0.2);
          padding-left: 14px;
        }

        /* ── WHO SHE IS dossier ── */
        .nr-who-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 64px;
          align-items: center;
        }
        .nr-dossier {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(190,242,100,0.1);
          border-radius: 20px;
          padding: 8px;
          position: relative;
          overflow: hidden;
        }
        .nr-dossier::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, hsl(120,90%,60%), transparent);
        }
        .nr-dossier-row {
          display: grid; grid-template-columns: 110px 1fr;
          gap: 18px; align-items: baseline;
          padding: 14px 18px;
          border-radius: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          opacity: 0;
          animation: nrFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .nr-dossier-row:last-child { border-bottom: 0; }
        .nr-dossier-row:hover { background: rgba(190,242,100,0.03); }
        .nr-dossier-k {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 10px; font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: hsl(140,80%,65%);
        }
        .nr-dossier-v {
          font-size: 14px; color: rgba(255,255,255,0.78); line-height: 1.55;
        }

        /* ── CAPABILITIES ── */
        .nr-caps-head { text-align: center; margin-bottom: 56px; }
        .nr-caps-head .nr-section-sub { margin-left: auto; margin-right: auto; margin-bottom: 0; }
        .nr-caps-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 22px; }
        .nr-cap {
          position: relative;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 32px 26px 30px;
          overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.3s, background 0.3s;
        }
        .nr-cap:hover {
          transform: translateY(-6px);
          border-color: rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.035);
        }
        .nr-cap-glow {
          position: absolute; top: 0; left: 0; right: 0; height: 200px;
          opacity: 0.6; pointer-events: none;
        }
        .nr-cap-icon {
          position: relative;
          width: 54px; height: 54px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px;
          margin-bottom: 22px;
        }
        .nr-cap-k {
          position: relative;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 11px; font-weight: 800;
          letter-spacing: 0.18em;
          display: block; margin-bottom: 10px;
        }
        .nr-cap h3 {
          position: relative;
          font-size: 22px; font-weight: 700; color: #fff;
          letter-spacing: -0.02em;
          margin-bottom: 12px; line-height: 1.2;
        }
        .nr-cap p {
          position: relative;
          font-size: 14px; color: rgba(255,255,255,0.55);
          line-height: 1.7;
        }

        /* ── SURFACES ── */
        .nr-surfaces {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 20px;
          margin-top: 16px;
        }
        .nr-surface {
          position: relative;
          display: block; text-decoration: none;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 22px;
          padding: 32px 28px;
          overflow: hidden;
          color: #fff;
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.3s;
        }
        .nr-surface:hover {
          transform: translateY(-4px);
          border-color: rgba(190,242,100,0.3);
        }
        .nr-surface-glow {
          position: absolute; top: 0; left: 0; right: 0; height: 140px;
          pointer-events: none; opacity: 0.8;
        }
        .nr-surface-tag {
          position: relative;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 11px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.14em;
          display: block; margin-bottom: 12px;
        }
        .nr-surface strong {
          position: relative;
          display: block;
          font-size: 26px; font-weight: 700;
          letter-spacing: -0.025em;
          margin-bottom: 12px;
        }
        .nr-surface p {
          position: relative;
          font-size: 14px; line-height: 1.6;
          color: rgba(255,255,255,0.55);
          margin-bottom: 18px;
        }
        .nr-surface-arrow {
          position: relative;
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 13px; font-weight: 700;
        }

        /* ── CTA ── */
        .nr-cta {
          padding: 160px 40px 140px;
          text-align: center;
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, transparent, rgba(190,242,100,0.025));
        }
        .nr-cta-glow {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          width: 900px; height: 600px;
          background: radial-gradient(ellipse, hsla(120,90%,60%,0.12) 0%, hsla(170,80%,55%,0.05) 40%, transparent 70%);
          pointer-events: none;
          animation: nrGlowPulse 5s ease-in-out infinite;
        }
        @keyframes nrGlowPulse {
          0%,100% { opacity: 0.75; transform: translate(-50%,-50%) scale(1); }
          50%      { opacity: 1;    transform: translate(-50%,-50%) scale(1.1); }
        }
        .nr-cta-inner { position: relative; max-width: 640px; margin: 0 auto; }
        .nr-cta-eye {
          display: inline-block;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: hsl(140,80%,65%);
          padding: 6px 14px;
          background: rgba(190,242,100,0.08);
          border: 1px solid rgba(190,242,100,0.22);
          border-radius: 100px;
          margin-bottom: 24px;
        }
        .nr-cta-h2 {
          font-size: clamp(36px, 5vw, 68px);
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.032em;
          line-height: 1.05;
          margin-bottom: 18px;
        }
        .nr-cta-h2 em {
          font-style: italic;
          background: linear-gradient(135deg, hsl(85,95%,65%), hsl(170,85%,55%));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nr-cta p {
          font-size: 17px;
          color: rgba(255,255,255,0.55);
          line-height: 1.7;
          margin-bottom: 36px;
        }
        .nr-cta-btns {
          display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;
        }

        /* ── FOOTER ── */
        .nr-footer {
          padding: 72px 56px 40px;
          border-top: 1px solid rgba(190,242,100,0.08);
        }
        .nr-footer-inner {
          max-width: 1100px; margin: 0 auto 40px;
          display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 48px;
        }
        .nr-footer-p { font-size: 14px; color: rgba(255,255,255,0.4); max-width: 280px; line-height: 1.6; }
        .nr-footer h4 {
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.12em;
          color: hsla(140,80%,65%,0.7);
          margin-bottom: 14px;
        }
        .nr-footer a {
          display: block;
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          margin-bottom: 10px;
          transition: color 0.2s;
        }
        .nr-footer a:hover { color: hsl(140,90%,72%); }
        .nr-footer-bottom {
          max-width: 1100px; margin: 0 auto;
          padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.04);
          font-size: 12px; color: rgba(255,255,255,0.22);
          text-align: center;
        }

        @keyframes nrFadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── INSIDE EACH PRODUCT ── */
        .nr-inside-head { text-align: center; max-width: 720px; margin: 0 auto 96px; }
        .nr-inside-sub { margin: 0 auto; }

        .nr-product {
          --p-hue: 95;
          position: relative;
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 80px;
          align-items: center;
          padding: 72px 0;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .nr-product:first-of-type { border-top: 0; }
        .nr-product--reverse .nr-product-copy { order: 2; }
        .nr-product--reverse .nr-product-scene { order: 1; }

        .nr-product::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(
            ellipse at var(--p-edge, 10%) 40%,
            hsla(var(--p-hue), 85%, 55%, 0.09),
            transparent 55%);
          pointer-events: none;
          border-radius: 36px;
          z-index: 0;
        }
        .nr-product--reverse::before { --p-edge: 90%; }
        .nr-product > * { position: relative; z-index: 1; }

        .nr-product-tag {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 7px 14px;
          border-radius: 100px;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 11px; font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: hsl(var(--p-hue), 85%, 75%);
          background: hsla(var(--p-hue), 85%, 55%, 0.08);
          border: 1px solid hsla(var(--p-hue), 85%, 55%, 0.28);
          margin-bottom: 22px;
        }
        .nr-product-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: hsl(var(--p-hue), 90%, 65%);
          box-shadow: 0 0 10px hsla(var(--p-hue), 90%, 60%, 0.85);
          animation: nrPulseDot 2s ease infinite;
        }
        .nr-product-h {
          font-size: clamp(30px, 3.4vw, 48px);
          line-height: 1.04;
          font-weight: 700;
          letter-spacing: -0.028em;
          color: #fff;
          margin-bottom: 20px;
        }
        .nr-product-h em {
          font-style: italic;
          background: linear-gradient(
            135deg,
            hsl(var(--p-hue), 92%, 72%),
            hsl(calc(var(--p-hue) + 30), 88%, 62%));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nr-product-p {
          font-size: 16px;
          line-height: 1.7;
          color: rgba(255,255,255,0.62);
          margin-bottom: 24px;
          max-width: 520px;
        }
        .nr-product-list {
          list-style: none;
          margin: 0 0 28px; padding: 0;
          display: flex; flex-direction: column; gap: 10px;
        }
        .nr-product-list li {
          position: relative;
          padding: 14px 18px 14px 38px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          transition: border-color 0.25s, background 0.25s, transform 0.25s;
        }
        .nr-product-list li::before {
          content: '';
          position: absolute;
          left: 14px; top: 20px;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%,
            rgba(255,255,255,0.6),
            hsl(var(--p-hue), 90%, 60%) 55%,
            hsl(var(--p-hue), 85%, 35%));
          box-shadow: 0 0 10px hsla(var(--p-hue), 92%, 60%, 0.6);
        }
        .nr-product-list li:hover {
          transform: translateX(4px);
          border-color: hsla(var(--p-hue), 85%, 55%, 0.32);
          background: hsla(var(--p-hue), 85%, 55%, 0.04);
        }
        .nr-product-list span {
          display: block;
          font-size: 14px; font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }
        .nr-product-list em {
          display: block;
          font-style: normal;
          font-size: 13px; line-height: 1.55;
          color: rgba(255,255,255,0.5);
        }
        .nr-product-cta {
          display: inline-flex; align-items: center; gap: 6px;
          color: hsl(var(--p-hue), 90%, 72%);
          font-size: 14px; font-weight: 700;
          text-decoration: none;
          padding: 10px 16px;
          border-radius: 10px;
          background: hsla(var(--p-hue), 85%, 55%, 0.06);
          border: 1px solid hsla(var(--p-hue), 85%, 55%, 0.28);
          transition: transform 0.2s, background 0.2s, border-color 0.2s;
        }
        .nr-product-cta:hover {
          transform: translateY(-2px);
          background: hsla(var(--p-hue), 85%, 55%, 0.14);
          border-color: hsla(var(--p-hue), 85%, 55%, 0.55);
        }
        .nr-product-protocol-card {
          max-width: 520px;
          padding: 22px 24px;
          border-radius: 18px;
          background:
            linear-gradient(135deg, hsla(var(--p-hue), 86%, 56%, 0.13), rgba(255,255,255,0.025)),
            rgba(255,255,255,0.025);
          border: 1px solid hsla(var(--p-hue), 86%, 58%, 0.34);
          box-shadow:
            0 22px 54px hsla(var(--p-hue), 85%, 45%, 0.12),
            inset 0 1px 0 rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
        }
        .nr-product-protocol-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 18% 18%, hsla(var(--p-hue), 90%, 66%, 0.2), transparent 38%);
          pointer-events: none;
        }
        .nr-product-protocol-card--active {
          border-color: hsla(var(--p-hue), 92%, 66%, 0.75);
          background:
            linear-gradient(135deg, hsla(var(--p-hue), 90%, 58%, 0.18), rgba(255,255,255,0.035)),
            rgba(255,255,255,0.03);
          box-shadow:
            0 0 0 1px hsla(var(--p-hue), 92%, 66%, 0.24),
            0 24px 64px hsla(var(--p-hue), 88%, 48%, 0.2),
            inset 0 1px 0 rgba(255,255,255,0.07);
        }
        .nr-product-protocol-head {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }
        .nr-product-protocol-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 0;
          padding: 0;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          background:
            radial-gradient(circle at 34% 28%, rgba(255,255,255,0.4), transparent 28%),
            linear-gradient(135deg, hsl(var(--p-hue), 94%, 70%), hsl(calc(var(--p-hue) + 18), 92%, 58%));
          box-shadow:
            0 0 24px hsla(var(--p-hue), 88%, 60%, 0.34),
            inset 0 0 0 1px rgba(255,255,255,0.18);
          transition: transform 0.2s, filter 0.2s, box-shadow 0.2s;
        }
        .nr-product-protocol-icon:hover {
          transform: translateY(-1px) scale(1.04);
          filter: brightness(1.1);
          box-shadow:
            0 0 32px hsla(var(--p-hue), 88%, 60%, 0.5),
            inset 0 0 0 1px rgba(255,255,255,0.24);
        }
        .nr-product-protocol-icon svg {
          display: block;
          width: 18px;
          height: 18px;
          filter: drop-shadow(0 1px 4px rgba(32,8,56,0.45));
        }
        .nr-product-protocol-card:not(.nr-product-protocol-card--active) .nr-product-protocol-icon svg {
          transform: translateX(1px);
        }
        .nr-product-protocol-wave {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 4px;
          height: 28px;
          padding-left: 8px;
        }
        .nr-product-protocol-wave span {
          display: block;
          width: 4px;
          border-radius: 999px;
          background: hsl(var(--p-hue), 94%, 68%);
          box-shadow: 0 0 10px hsla(var(--p-hue), 92%, 66%, 0.42);
          animation: nrVoiceBar 0.9s ease-in-out infinite;
        }
        .nr-product-protocol-head strong {
          display: block;
          font-size: 15px;
          line-height: 1.25;
          color: #fff;
          margin-bottom: 5px;
        }
        .nr-product-protocol-head span {
          display: block;
          font-size: 12px;
          line-height: 1.45;
          color: rgba(255,255,255,0.52);
        }
        .nr-product-protocol-card p {
          position: relative;
          padding-left: 16px;
          border-left: 2px solid hsla(var(--p-hue), 88%, 66%, 0.36);
          font-size: 15px;
          line-height: 1.65;
          color: rgba(255,255,255,0.76);
          font-style: italic;
        }

        /* ── PRODUCT SCENE — the phone mockup ── */
        .nr-product-scene {
          display: flex; align-items: center; justify-content: center;
          position: relative;
        }
        .nr-product-scene::before {
          content: '';
          position: absolute; inset: -40px;
          background: radial-gradient(circle at 50% 50%,
            hsla(var(--p-hue), 85%, 55%, 0.16), transparent 65%);
          filter: blur(40px);
          pointer-events: none;
        }
        .nr-phone {
          position: relative;
          width: 300px;
          background: linear-gradient(180deg, #0b1014, #050709);
          border: 1px solid hsla(var(--p-hue), 85%, 55%, 0.28);
          border-radius: 38px;
          padding: 18px;
          box-shadow:
            0 40px 80px rgba(0,0,0,0.55),
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 0 60px hsla(var(--p-hue), 90%, 55%, 0.18);
          transition: transform 0.5s cubic-bezier(0.16,1,0.3,1);
        }
        .nr-product:hover .nr-phone { transform: translateY(-6px); }
        .nr-phone-notch {
          position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
          width: 72px; height: 6px;
          border-radius: 100px;
          background: rgba(255,255,255,0.08);
        }
        .nr-phone-inner {
          margin-top: 10px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .nr-phone-head {
          display: flex; align-items: center; gap: 12px;
          padding: 6px 4px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .nr-phone-orb {
          width: 28px; height: 28px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%,
            rgba(255,255,255,0.65),
            hsl(var(--p-hue), 90%, 60%) 45%,
            hsl(var(--p-hue), 80%, 32%));
          box-shadow: 0 0 14px hsla(var(--p-hue), 90%, 60%, 0.7);
          flex-shrink: 0;
          animation: nrOrbIdle 3s ease-in-out infinite;
        }
        .nr-phone-head strong {
          display: block;
          font-size: 13px; font-weight: 700; color: #fff;
        }
        .nr-phone-head span {
          display: block;
          font-size: 10px;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.02em;
        }
        .nr-phone-msg {
          font-size: 13px;
          line-height: 1.5;
          padding: 11px 14px;
          border-radius: 16px;
          max-width: 90%;
        }
        .nr-phone-msg--nora {
          align-self: flex-start;
          background: hsla(var(--p-hue), 85%, 55%, 0.12);
          border: 1px solid hsla(var(--p-hue), 85%, 55%, 0.3);
          color: rgba(255,255,255,0.92);
          border-bottom-left-radius: 4px;
        }
        .nr-phone-msg--user {
          align-self: flex-end;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.88);
          border-bottom-right-radius: 4px;
        }
        .nr-phone-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 4px;
        }
        .nr-phone-card-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 10px;
        }
        .nr-phone-card-row:last-child { border-bottom: 0; }
        .nr-phone-card-row span {
          color: hsl(var(--p-hue), 85%, 72%);
          letter-spacing: 0.08em;
          font-weight: 700;
        }
        .nr-phone-card-row em {
          font-style: normal;
          color: rgba(255,255,255,0.72);
          font-weight: 600;
        }
        .nr-phone-card--stats {
          display: grid; grid-template-columns: repeat(3,1fr);
          padding: 10px;
          gap: 6px;
        }
        .nr-phone-stat {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 10px 6px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px;
        }
        .nr-phone-stat span {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 9px; letter-spacing: 0.14em;
          color: rgba(255,255,255,0.4); font-weight: 700;
        }
        .nr-phone-stat em {
          font-style: normal;
          font-size: 14px; font-weight: 700;
          color: #fff;
        }
        .nr-phone-stat i {
          font-style: normal;
          font-size: 9px;
          color: hsl(var(--p-hue), 85%, 70%);
          font-weight: 600;
        }
        .nr-phone-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .nr-phone-chips span {
          font-size: 11px;
          padding: 7px 12px;
          border-radius: 100px;
          background: hsla(var(--p-hue), 85%, 55%, 0.08);
          border: 1px solid hsla(var(--p-hue), 85%, 55%, 0.24);
          color: hsl(var(--p-hue), 85%, 78%);
          font-weight: 600;
        }
        .nr-phone-chips span:first-child {
          background: hsla(var(--p-hue), 85%, 55%, 0.25);
          color: #fff;
          border-color: hsla(var(--p-hue), 85%, 60%, 0.5);
        }
        .nr-phone-meals { display: flex; flex-direction: column; gap: 6px; }
        .nr-phone-meal {
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .nr-phone-meal strong {
          display: block;
          font-size: 12px; color: #fff; font-weight: 700; margin-bottom: 2px;
        }
        .nr-phone-meal span {
          font-size: 10px;
          color: rgba(255,255,255,0.45);
        }
        .nr-phone-meal--done {
          opacity: 0.55;
          border-style: dashed;
        }
        .nr-phone-meal--now {
          background: hsla(var(--p-hue), 85%, 55%, 0.1);
          border-color: hsla(var(--p-hue), 85%, 55%, 0.38);
          box-shadow: 0 0 0 1px hsla(var(--p-hue), 85%, 55%, 0.15) inset;
        }
        .nr-phone-meal--now strong { color: hsl(var(--p-hue), 85%, 82%); }

        /* ── MEMORY / CONTINUITY ── */
        .nr-memory {
          position: relative;
          padding: 160px 56px;
          overflow: hidden;
        }
        .nr-memory-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 20% 30%, hsla(95,85%,55%,0.10), transparent 60%),
            radial-gradient(ellipse at 80% 70%, hsla(270,85%,55%,0.10), transparent 60%),
            radial-gradient(ellipse at 50% 50%, hsla(210,85%,55%,0.08), transparent 65%);
          pointer-events: none;
        }
        .nr-memory-head {
          max-width: 720px; margin: 0 auto 72px;
          text-align: center;
        }
        .nr-memory-sub { margin: 0 auto; }

        .nr-constellation {
          position: relative;
          max-width: 760px;
          height: 380px;
          margin: 0 auto 80px;
        }
        .nr-constellation-lines {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          opacity: 0.75;
          animation: nrDashDrift 18s linear infinite;
        }
        @keyframes nrDashDrift { to { stroke-dashoffset: -80; } }

        .nr-node {
          position: absolute;
          display: flex; flex-direction: column; align-items: center;
          text-align: center;
          transform: translate(-50%, -50%);
        }
        .nr-node strong {
          display: block;
          font-size: 14px; font-weight: 700;
          color: #fff;
          margin-top: 12px;
          letter-spacing: -0.01em;
        }
        .nr-node em {
          display: block;
          font-style: normal;
          font-size: 11px;
          color: rgba(255,255,255,0.42);
          margin-top: 2px;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .nr-node-orb {
          width: 56px; height: 56px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%,
            rgba(255,255,255,0.55),
            var(--c-a, hsl(95,90%,55%)) 45%,
            var(--c-b, hsl(150,80%,30%)));
          box-shadow: 0 0 24px var(--c-shadow, hsla(120,90%,60%,0.55)),
            inset 0 0 10px rgba(255,255,255,0.2);
          animation: nrOrbIdle 3s ease-in-out infinite;
        }
        .nr-node--fwp {
          top: 25%; left: 20%;
          --c-a: hsl(95,90%,55%);
          --c-b: hsl(150,80%,30%);
          --c-shadow: hsla(120,90%,60%,0.55);
        }
        .nr-node--pc {
          top: 25%; left: 80%;
          --c-a: hsl(270,85%,65%);
          --c-b: hsl(290,70%,35%);
          --c-shadow: hsla(270,90%,65%,0.55);
        }
        .nr-node--macra {
          top: 82%; left: 50%;
          --c-a: hsl(210,90%,60%);
          --c-b: hsl(230,75%,32%);
          --c-shadow: hsla(210,95%,60%,0.55);
        }
        .nr-node--center {
          top: 50%; left: 50%;
        }
        .nr-node-core {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            hsl(95,90%,60%),
            hsl(170,85%,55%),
            hsl(210,90%,60%),
            hsl(270,85%,65%),
            hsl(95,90%,60%));
          box-shadow:
            0 0 40px rgba(255,255,255,0.15),
            0 0 80px hsla(170,90%,55%,0.35),
            inset 0 0 20px rgba(255,255,255,0.2);
          animation: nrCoreSpin 14s linear infinite;
          position: relative;
        }
        .nr-node-core::after {
          content: '';
          position: absolute; inset: 10px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 30%,
            rgba(255,255,255,0.85),
            rgba(255,255,255,0.1) 40%,
            rgba(0,0,0,0.4) 80%);
        }
        @keyframes nrCoreSpin { to { transform: rotate(360deg); } }
        .nr-node--center strong {
          font-size: 16px;
        }

        .nr-cross-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          max-width: 1100px;
          margin: 0 auto 56px;
        }
        .nr-cross {
          position: relative;
          padding: 26px 24px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.3s;
          overflow: hidden;
        }
        .nr-cross::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg,
            transparent,
            rgba(255,255,255,0.25),
            transparent);
        }
        .nr-cross:hover {
          transform: translateY(-4px);
          border-color: rgba(255,255,255,0.18);
        }
        .nr-cross-head {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .nr-cross-pill {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 10px; font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          padding: 5px 10px;
          border-radius: 100px;
          border: 1px solid rgba(255,255,255,0.2);
        }
        .nr-cross-arrow {
          color: rgba(255,255,255,0.3);
          font-weight: 700;
        }
        .nr-cross p {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255,255,255,0.68);
        }

        .nr-memory-foot {
          max-width: 640px; margin: 0 auto;
          text-align: center;
          padding: 28px 32px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
        }
        .nr-memory-lock {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: hsl(140,85%,72%);
          padding: 5px 12px;
          border-radius: 100px;
          background: rgba(190,242,100,0.08);
          border: 1px solid rgba(190,242,100,0.22);
          margin-bottom: 14px;
        }
        .nr-memory-foot p {
          font-size: 14px; line-height: 1.65;
          color: rgba(255,255,255,0.55);
        }

        /* RESPONSIVE */
        @media (max-width: 1000px) {
          .nr-nav, .nr-nav--scrolled { padding: 14px 24px; }
          .nr-nav-links a:not(.nr-nav-cta) { display: none; }
          .nr-section { padding: 90px 28px; }
          .nr-voice-grid, .nr-caps-grid, .nr-surfaces { grid-template-columns: 1fr; gap: 14px; }
          .nr-who-grid { grid-template-columns: 1fr; gap: 36px; }
          .nr-footer { padding: 56px 28px 32px; }
          .nr-footer-inner { grid-template-columns: 1fr 1fr; gap: 28px; }
          .nr-orb-stage { height: 340px; max-width: 320px; }
          .nr-product {
            grid-template-columns: 1fr;
            gap: 48px;
            padding: 56px 0;
          }
          .nr-product--reverse .nr-product-copy { order: 1; }
          .nr-product--reverse .nr-product-scene { order: 2; }
          .nr-inside-head { margin-bottom: 64px; }
          .nr-memory { padding: 100px 28px; }
          .nr-cross-grid { grid-template-columns: 1fr; gap: 14px; }
          .nr-constellation { height: 340px; max-width: 420px; }
          .nr-node--fwp { top: 22%; left: 18%; }
          .nr-node--pc { top: 22%; left: 82%; }
          .nr-node--macra { top: 85%; left: 50%; }
        }
        @media (max-width: 600px) {
          .nr-hero { padding: 120px 20px 60px; }
          .nr-footer-inner { grid-template-columns: 1fr; }
          .nr-orb-rings { width: 300px; height: 300px; }
          .nr-dossier-row { grid-template-columns: 90px 1fr; gap: 12px; padding: 12px 14px; }
          .nr-phone { width: 100%; max-width: 320px; }
          .nr-constellation { height: 300px; }
          .nr-node strong { font-size: 12px; }
          .nr-node em { font-size: 9px; }
          .nr-node-orb { width: 44px; height: 44px; }
          .nr-node-core { width: 60px; height: 60px; }
          .nr-memory-foot { padding: 22px 20px; }
        }
      `}</style>
    </div>
  );
};

export default NoraLanding;
