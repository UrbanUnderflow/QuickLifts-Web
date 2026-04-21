import React, { useCallback, useEffect, useRef, useState } from 'react';

type VoiceSample = {
  id: string;
  src: string;
  title: string;
  script: string;
  ctx: string;
};

const VOICE_SAMPLES: VoiceSample[] = [
  {
    id: 'intro',
    src: '/audio/nora/nora-intro.mp3',
    title: 'First contact',
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

const NoraLanding: React.FC = () => {
  // ── Voice + orb state ─────────────────────────────────────
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
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
    } catch (e) {
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
          <a href="#where">Where she lives</a>
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
            <em>every Pulse product.</em>
          </h1>

          <p className="nr-hero-sub">
            Nora is the AI companion inside Fit With Pulse, PulseCheck, and Macra. She listens
            before she speaks, reads your biometrics like a coach reads a room, and meets you where
            you are — whether it's 3&nbsp;AM or game day.
          </p>

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
                playSample(VOICE_SAMPLES.find((s) => s.id === 'intro') ?? VOICE_SAMPLES[0])
              }
              aria-label={isPlaying ? 'Pause Nora' : 'Play Nora intro'}
              style={{
                transform: `scale(${coreScale})`,
                background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.55) 0%, hsla(${accentHue}, 88%, 60%, 0.95) 45%, hsla(${accentHue}, 82%, 32%, 0.98) 100%)`,
                boxShadow: `0 0 ${glowSize * 0.6}px hsla(${accentHue}, 92%, 62%, 0.55), inset 0 0 40px rgba(255,255,255,0.15)`,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#0a0f0a" aria-hidden>
                {isPlaying ? (
                  <>
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </>
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
                playSample(VOICE_SAMPLES.find((s) => s.id === 'intro') ?? VOICE_SAMPLES[0])
              }
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                {isPlaying ? (
                  <>
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </>
                ) : (
                  <path d="M8 5v14l11-7z" />
                )}
              </svg>
              {isPlaying ? 'Pause Nora' : 'Hear Nora speak'}
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
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`nr-voice-card ${active ? 'nr-voice-card--active' : ''}`}
                  onClick={() => playSample(s)}
                >
                  <div className="nr-voice-head">
                    <span className="nr-voice-play">
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        {active && isPlaying ? (
                          <>
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                          </>
                        ) : (
                          <path d="M8 5v14l11-7z" />
                        )}
                      </svg>
                    </span>
                    <div>
                      <strong>{s.title}</strong>
                      <span>{s.ctx}</span>
                    </div>
                    {active && (
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
                { k: 'Always-on', v: '2-minute check-ins · 3 AM spirals · game-day jitters' },
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

      {/* ── CTA ── */}
      <section className="nr-cta" id="reach">
        <div className="nr-cta-glow" />
        <div className="nr-cta-inner">
          <span className="nr-cta-eye">Ready when you are</span>
          <h2 className="nr-cta-h2">
            Say hi to <em>Nora.</em>
          </h2>
          <p>
            Tap into the daily check-in inside PulseCheck, or point Macra at your plate to let her
            write your day.
          </p>
          <div className="nr-cta-btns">
            <a href="/PulseCheck" className="nr-btn-primary">
              Open PulseCheck →
            </a>
            <a href="/Macra" className="nr-btn-secondary">
              Try Macra →
            </a>
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
        .nr-voice-play svg { width: 16px; height: 16px; }
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
        }
        @media (max-width: 600px) {
          .nr-hero { padding: 120px 20px 60px; }
          .nr-footer-inner { grid-template-columns: 1fr; }
          .nr-orb-rings { width: 300px; height: 300px; }
          .nr-dossier-row { grid-template-columns: 90px 1fr; gap: 12px; padding: 12px 14px; }
        }
      `}</style>
    </div>
  );
};

export default NoraLanding;
