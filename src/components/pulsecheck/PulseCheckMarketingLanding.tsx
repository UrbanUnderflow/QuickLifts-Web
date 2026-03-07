import React, { useEffect, useRef, useState, useCallback } from 'react';

type Props = { onJoinWaitlist: () => void };

// Lerp helper
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

const PulseCheckMarketingLanding: React.FC<Props> = ({ onJoinWaitlist }) => {
  const [scrollY, setScrollY] = useState(0);
  const [activeTab, setActiveTab] = useState<'preflight' | 'game' | 'coach' | 'clinical'>('preflight');
  const heroRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const currentScrollRef = useRef(0);
  const targetScrollRef = useRef(0);

  // RAF loop — parallax + phone drift only (bg is now threshold-triggered)
  const tick = useCallback(() => {
    targetScrollRef.current = window.scrollY;
    currentScrollRef.current = lerp(currentScrollRef.current, targetScrollRef.current, 0.06);
    const s = currentScrollRef.current;
    setScrollY(s);

    const wrapper = wrapperRef.current;
    if (wrapper) {
      // Parallax on hero float cards
      const parallaxAmt = s * 0.25;
      const cards = wrapper.querySelectorAll<HTMLElement>('.pc2-float-card--tl, .pc2-float-card--r, .pc2-float-card--bl');
      cards.forEach((card, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        card.style.transform = `translateY(${parallaxAmt * 0.12 * dir * (i + 1)}px)`;
      });
      // Hero phone subtle drift up
      const phone = wrapper.querySelector<HTMLElement>('.pc2-phone');
      if (phone) phone.style.transform = `translateY(${-s * 0.08}px)`;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    const wrapper = wrapperRef.current;

    // ── Threshold-triggered background morph ─────────────────────────────────
    // The CSS transition on `background` runs at its own fixed speed (500ms)
    // the instant a [data-bg] section crosses the 15% visibility threshold.
    // This decouples the color change from scroll speed entirely.
    const DARK_BG = 'rgb(6,6,8)';
    const LIGHT_BG = 'rgb(242,242,248)';

    // Track which section is most in-view so rapid scroll picks correctly
    const visibilityMap = new Map<Element, number>();
    const bgObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            visibilityMap.set(e.target, e.intersectionRatio);
          } else {
            visibilityMap.delete(e.target);
          }
        });
        if (!wrapper) return;
        // Pick the most-visible section as the authoritative one
        let dominant: Element | null = null;
        let best = 0;
        visibilityMap.forEach((ratio, el) => {
          if (ratio > best) { best = ratio; dominant = el; }
        });
        if (dominant) {
          const isLight = (dominant as HTMLElement).dataset.bg === 'light';
          wrapper.style.setProperty('--pc2-bg', isLight ? LIGHT_BG : DARK_BG);
          wrapper.style.setProperty('--pc2-nav-dark', isLight ? '1' : '0');
        }
      },
      { threshold: [0, 0.15, 0.5, 1.0] }
    );
    document.querySelectorAll<HTMLElement>('[data-bg]').forEach(el => bgObserver.observe(el));

    // ── Staggered reveal ────────────────────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('pc2-visible');
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.pc2-reveal').forEach(el => io.observe(el));

    return () => {
      cancelAnimationFrame(rafRef.current);
      io.disconnect();
      bgObserver.disconnect();
    };
  }, [tick]);

  const navScrolled = scrollY > 60;

  return (
    <div className="pc2" ref={wrapperRef} style={{ '--pc2-bg': 'rgb(6,6,8)', '--pc2-nav-dark': '0' } as React.CSSProperties}>
      {/* ── NAV ── */}
      <nav className={`pc2-nav ${navScrolled ? 'pc2-nav--scrolled' : ''}`}>
        <a href="#top" className="pc2-logo">
          <img src="/pulsecheck-logo.svg" alt="PulseCheck" className="pc2-logo-img" />
          PulseCheck
        </a>
        <div className="pc2-nav-links">
          <a href="#nora">Nora AI</a>
          <a href="#coach">Coach Dashboard</a>
          <a href="#clinical">Clinical Safety</a>
          <a href="#pilot" className="pc2-nav-cta">Request Pilot</a>
        </div>
      </nav>

      {/* ── HERO — dark ── */}
      <section className="pc2-hero" id="top" ref={heroRef} data-bg="dark">
        <div className="pc2-hero-glow" />
        <div className="pc2-hero-inner">
          <div className="pc2-hero-text">
            <div className="pc2-badge">
              <span className="pc2-badge-dot" />
              Mental Performance OS for Elite Programs
            </div>
            <h1 className="pc2-h1">
              Your athletes are physically ready.<br />
              <em>Are they mentally built to execute?</em>
            </h1>
            <p className="pc2-hero-sub">
              PulseCheck turns a 2-minute daily check-in into real-time readiness intelligence — for athletes, coaches, and clinical staff.
            </p>
            <div className="pc2-hero-ctas">
              <a href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Pilot%20Inquiry" className="pc2-btn-primary">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                Request Department Pilot
              </a>
              <a href="#nora" className="pc2-btn-secondary">See How It Works →</a>
            </div>
            <div className="pc2-hero-proof">
              <span className="pc2-proof-label">Trusted by forward-thinking programs</span>
              <div className="pc2-proof-logos">
                {['ACC', 'LAUNCH', 'FOUNDER UNIVERSITY', 'COOLEY LLP'].map(l => (
                  <span key={l} className="pc2-proof-logo">{l}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Phone + floating cards */}
          <div className="pc2-hero-visual">
            {/* Floating card — Reaction Time (top, slightly left of phone) */}
            <div className="pc2-float-card pc2-float-card--tl">
              <div className="pc2-fc-icon" style={{ background: 'rgba(160,94,248,0.15)', color: '#A05EF8', position: 'relative', overflow: 'hidden' }}>
                ⚡
                <span className="pc2-fc-ping" />
              </div>
              <div>
                <strong>Reaction Time Test</strong>
                <span>Optimal response · <span className="pc2-ticker">0.24s</span></span>
                <div className="pc2-fc-bar-wrap">
                  <div className="pc2-fc-bar" style={{ background: 'linear-gradient(90deg,#A05EF8,#6A9AFA)', animationDelay: '0s' }} />
                </div>
              </div>
            </div>

            {/* Floating card — Focus Score (right, overlapping phone) */}
            <div className="pc2-float-card pc2-float-card--r">
              <div className="pc2-fc-ring-wrap">
                <svg viewBox="0 0 44 44" width="44" height="44" className="pc2-fc-ring-svg">
                  <circle cx="22" cy="22" r="17" stroke="rgba(160,94,248,0.18)" strokeWidth="4" fill="none" />
                  <circle cx="22" cy="22" r="17" stroke="#A05EF8" strokeWidth="4" fill="none"
                    strokeLinecap="round"
                    strokeDasharray="106.8"
                    className="pc2-fc-ring-arc"
                  />
                </svg>
                <span className="pc2-fc-ring-label">94</span>
              </div>
              <div>
                <strong>Focus Score</strong>
                <span className="pc2-fc-elite">Elite Zone ↑</span>
              </div>
            </div>

            {/* Floating card — Box Breathing (bottom left) */}
            <div className="pc2-float-card pc2-float-card--bl">
              <div className="pc2-fc-breath-wrap">
                <div className="pc2-fc-breath-ring" />
                <span className="pc2-fc-breath-icon">🫁</span>
              </div>
              <div>
                <strong>Box Breathing</strong>
                <span>Stress <span className="pc2-stress-down">↓ 18%</span> · Complete</span>
                <div className="pc2-fc-bar-wrap" style={{ marginTop: '5px' }}>
                  <div className="pc2-fc-bar" style={{ background: 'linear-gradient(90deg,#22D3EE,#6A9AFA)', width: '100%', animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>

            {/* Floating card — NEW: Readiness Score (left middle, between TL and BL) */}
            <div className="pc2-float-card pc2-float-card--ml">
              <div className="pc2-fc-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', position: 'relative', overflow: 'hidden' }}>
                📈
              </div>
              <div>
                <strong>Readiness Score</strong>
                <span>Today · <span style={{ color: '#22C55E', fontWeight: 600 }}>91 / 100</span></span>
                <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                  {[1, 1, 1, 1, 0.6, 0.3, 0.2, 0.15, 0.1].map((h, i) => (
                    <div key={i} style={{
                      width: 4, borderRadius: 3,
                      height: `${8 + h * 14}px`,
                      background: h > 0.5 ? '#22C55E' : 'rgba(255,255,255,0.12)',
                      animation: `pcBarH 1.6s cubic-bezier(0.22,1,0.36,1) ${1.8 + i * 0.07}s both`
                    }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Phone frame */}
            <div className="pc2-phone">
              <div className="pc2-phone-notch" />
              <div className="pc2-phone-screen">
                {/* App header */}
                <div className="pc2-app-header">
                  <div className="pc2-app-logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2.5" width="14" height="14"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                    PulseCheck
                  </div>
                  <div className="pc2-app-live">● LIVE</div>
                </div>

                {/* ── Animated chat sequence ────────────────────────── */}
                {/* Step 1: Nora opens (0s) */}
                <div className="pc2-chat-bubble pc2-chat-nora pc2-seq" style={{ animationDelay: '0.2s' }}>
                  Hi Tremaine 👋 Today is game day. How are you feeling?
                </div>
                {/* Step 2: Athlete replies uneasy (0.9s) */}
                <div className="pc2-chat-bubble pc2-chat-user pc2-seq" style={{ animationDelay: '0.9s' }}>
                  I'm feeling <em>really uneasy</em> about today's game. Nervous, can't focus.
                </div>
                {/* Step 3: Nora detects elevated stress (1.8s) */}
                <div className="pc2-chat-bubble pc2-chat-nora pc2-seq" style={{ animationDelay: '1.8s' }}>
                  <span style={{ color: '#F97316', fontWeight: 600 }}>⚠ Elevated cortisol pattern detected.</span> HRV dipped 14%. Let's reset your nervous system right now.
                </div>
                {/* Step 4: Nora prescribes Box Breathing (2.8s) */}
                <div className="pc2-chat-bubble pc2-chat-nora pc2-seq pc2-chat-action" style={{ animationDelay: '2.8s' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#A05EF8' }}>🫁 Box Breathing · 4 rounds</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>Inhale 4s · Hold 4s · Exhale 4s · Hold 4s<br />Used by Navy SEALs to lower acute stress</div>
                  <button className="pc2-chat-btn">Start Now →</button>
                </div>

                {/* Step 5: Box Breathing HUD (4.0s) */}
                <div className="pc2-breath-hud pc2-seq" style={{ animationDelay: '4.0s' }}>
                  <div className="pc2-breath-ring-outer">
                    <div className="pc2-breath-ring-inner" />
                    <span className="pc2-breath-phase">Inhale</span>
                  </div>
                  <div className="pc2-breath-stats">
                    <span className="pc2-breath-stat"><span style={{ color: '#A05EF8' }}>HRV</span> recovering</span>
                    <span className="pc2-breath-stat"><span style={{ color: '#22C55E' }}>Stress</span> ↓ 18%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar like Flighty */}
        <div className="pc2-tabbar">
          {([['preflight', '🧠 Nora Check-in'], ['game', '⚡ Simulations'], ['coach', '📊 Coach View'], ['clinical', '🛡 Clinical Safety']] as const).map(([k, label]) => (
            <button key={k} className={`pc2-tab ${activeTab === k ? 'pc2-tab--active' : ''}`}
              onClick={() => { setActiveTab(k); document.getElementById(k === 'preflight' ? 'nora' : k === 'game' ? 'sims' : k === 'coach' ? 'coach' : 'clinical')?.scrollIntoView({ behavior: 'smooth' }); }}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ── SECTION 1 — light — Nora AI ── */}
      <section className="pc2-section pc2-section--light" id="nora" data-bg="light">
        <div className="pc2-section-inner pc2-section-inner--flip">
          <div className="pc2-section-text pc2-reveal">
            <span className="pc2-section-label" style={{ color: '#A05EF8', background: 'rgba(160,94,248,0.08)' }}>💬 Nora AI Companion</span>
            <h2 className="pc2-h2">An always-on mental performance<br /><em>conversation.</em></h2>
            <p className="pc2-section-sub">Nora runs a frictionless 2-minute daily check-in via iMessage-style chat. She reads biometric context from HealthKit, asks targeted questions, and responds with clinically grounded mental performance drills — all in real time.</p>
            <ul className="pc2-checklist">
              {['Frictionless iMessage-style daily mental reps', 'Real-time response to anxiety, fatigue & focus drops', 'Personalized drills: Box Breathing, Kill Switch, 3-Second Reset', 'Privacy-first — athletes control their coach visibility'].map(t => (
                <li key={t}><span className="pc2-check">✓</span>{t}</li>
              ))}
            </ul>
          </div>
          <div className="pc2-section-visual pc2-reveal">
            {/* Full chat mockup */}
            <div className="pc2-mockup pc2-mockup--chat">
              <div className="pc2-mockup-bar">
                <div className="pc2-mockup-dots"><span /><span /><span /></div>
                <span className="pc2-mockup-title">Nora · Daily Check-in</span>
              </div>
              <div className="pc2-chat-log">
                <div className="pc2-cl-nora">Hi Tremaine, today is game day. How are you feeling?</div>
                <div className="pc2-cl-user">I feel okay, just trying to get locked in.</div>
                <div className="pc2-cl-nora">Your baseline looks great today. RHR at 42 bpm, HRV is high — excellent CNS recovery. Your body is primed for today.</div>
                <div className="pc2-cl-user">I'm not going to lie, I'm a little nervous about today.</div>
                <div className="pc2-cl-nora">Talk to me. What feels different about today?</div>
                <div className="pc2-cl-user">Everything just feels like it's on the line.</div>
                <div className="pc2-cl-nora">OK. Let's slow it down. I want to run you through Box Breathing — the same technique Navy SEALs use during acute stress. Ready?</div>
                <div className="pc2-cl-system">
                  <span>🫁</span> Box Breathing · 4 Rounds Complete
                  <div className="pc2-cl-metrics">
                    <span>HR ↓ 72→58 bpm</span>
                    <span>HRV ↑ +12</span>
                    <span>Calm ↑ 85</span>
                  </div>
                </div>
                <div className="pc2-cl-nora">Great work. How are you feeling now?</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — off-white — Simulations ── */}
      <section className="pc2-section pc2-section--offwhite" id="sims" data-bg="light">
        <div className="pc2-section-inner">
          <div className="pc2-section-text pc2-reveal">
            <span className="pc2-section-label" style={{ color: '#A05EF8', background: 'rgba(160,94,248,0.08)' }}>▶ Mental Simulations</span>
            <h2 className="pc2-h2">Train the mind <em>before</em><br />the clutch moment.</h2>
            <p className="pc2-section-sub">Run pressure scenarios before game day. PulseCheck coaches breathing, attention control, and execution cues in the exact moments athletes unravel.</p>
            <div className="pc2-sim-steps">
              {[
                { icon: '⚠', color: '#FF6B6B', label: 'Trigger', text: 'Missed two free throws. Crowd gets loud. Self-talk turns negative.' },
                { icon: '◉', color: '#6A9AFA', label: 'Nora Prompt', text: '"Reset in 8 seconds: exhale long, eyes on rim center, cue: smooth follow-through."' },
                { icon: '✦', color: '#A05EF8', label: 'Execution', text: 'Athlete slows heart rate, blocks crowd noise, commits to next-shot routine.' },
              ].map(s => (
                <div key={s.label} className="pc2-sim-step" style={{ borderLeftColor: s.color }}>
                  <div className="pc2-sim-step-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
                  <div><strong style={{ color: s.color }}>{s.label}</strong><p>{s.text}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="pc2-section-visual pc2-reveal">
            <div className="pc2-mockup pc2-mockup--sim">
              <div className="pc2-mockup-bar">
                <div className="pc2-mockup-dots"><span /><span /><span /></div>
                <span className="pc2-mockup-title">Simulation State · Q4 01:42 · Down 1</span>
              </div>
              <div className="pc2-sim-meters">
                {[{ label: 'Pressure', val: 87, color: '#FF6B6B' }, { label: 'Focus', val: 62, color: '#ffc107' }, { label: 'Composure', val: 71, color: '#6A9AFA' }].map(m => (
                  <div key={m.label} className="pc2-sim-meter">
                    <div className="pc2-sm-label">{m.label}</div>
                    <div className="pc2-sm-val" style={{ color: m.color }}>{m.val}%</div>
                    <div className="pc2-sm-bar"><div className="pc2-sm-fill" style={{ width: `${m.val}%`, background: m.color }} /></div>
                  </div>
                ))}
              </div>
              <div className="pc2-sim-interventions">
                {[{ i: '⚠', c: '#FF6B6B', t: 'Detect the Spiral', s: 'Negative self-talk flagged' },
                { i: '◉', c: '#22D3EE', t: 'Issue Micro-Reset', s: 'Breath cadence + short cue' },
                { i: '◎', c: '#6A9AFA', t: 'Re-Attach to Task', s: 'Attention narrows to one action' },
                { i: '✦', c: '#A05EF8', t: 'Lock In Confidence', s: 'Reinforcement makes it automatic' },
                ].map(s => (
                  <div key={s.t} className="pc2-intervention">
                    <div className="pc2-int-icon" style={{ background: `${s.c}14`, color: s.c }}>{s.i}</div>
                    <div><strong>{s.t}</strong><span>{s.s}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — light — Coach Dashboard ── */}
      <section className="pc2-section pc2-section--light" id="coach" data-bg="light">
        <div className="pc2-section-inner pc2-section-inner--flip">
          <div className="pc2-section-text pc2-reveal">
            <span className="pc2-section-label" style={{ color: '#A05EF8', background: 'rgba(160,94,248,0.08)' }}>📊 Coach Intelligence</span>
            <h2 className="pc2-h2">Team-wide readiness.<br /><em>Before the tape.</em></h2>
            <p className="pc2-section-sub">The Coach Dashboard gives staff a real-time roster map — Green/Yellow/Orange/Red — with actionable briefings and proactive alerts before athletes even step on the field.</p>
            <ul className="pc2-checklist">
              {['Green/Yellow/Orange/Red roster map at a glance', 'Nora-generated briefing per athlete before each session', 'Proactive alerts when performance risk rises', 'Exportable reports & trend analytics'].map(t => (
                <li key={t}><span className="pc2-check">✓</span>{t}</li>
              ))}
            </ul>
          </div>
          <div className="pc2-section-visual pc2-reveal">
            <div className="pc2-mockup pc2-mockup--dashboard">
              <div className="pc2-mockup-bar">
                <div className="pc2-mockup-dots"><span /><span /><span /></div>
                <span className="pc2-mockup-title">PulseCheck · Coach Dashboard · Game Day</span>
              </div>
              {/* Alert card */}
              <div className="pc2-dash-alert">
                <div className="pc2-dash-alert-icon">⚠</div>
                <div>
                  <strong>Nora Alert — T. Grant · Elevated Anxiety</strong>
                  <p>Physical baseline excellent (RHR 42, 8h sleep). Residual game-day anxiety. Box Breathing completed. Recommend pre-game check-in.</p>
                </div>
              </div>
              {/* Roster */}
              <div className="pc2-dash-label">Team Status · 22/25 Checked In</div>
              <div className="pc2-roster">
                {[
                  { n: 'T. Grant', p: 'DB', s: 'elevated', t: 'Elevated Anxiety' },
                  { n: 'K. Thompson', p: 'LB', s: 'critical', t: 'Escalated — Clinical' },
                  { n: 'J. Rodriguez', p: 'QB', s: 'optimal', t: 'Game Ready' },
                  { n: 'M. Williams', p: 'WR', s: 'optimal', t: 'Optimal' },
                  { n: 'D. Okafor', p: 'DT', s: 'warning', t: 'Low Sleep 4.5h' },
                  { n: 'E. Campbell', p: 'OT', s: 'nocheckin', t: 'No Check-in' },
                ].map(r => (
                  <div key={r.n} className={`pc2-roster-row ${r.s === 'critical' ? 'pc2-roster-row--critical' : ''}`}>
                    <div className={`pc2-roster-dot pc2-roster-dot--${r.s}`} />
                    <span className="pc2-roster-name">{r.n}</span>
                    <span className="pc2-roster-pos">{r.p}</span>
                    <span className={`pc2-roster-status pc2-roster-status--${r.s}`}>{r.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — dark — Clinical Safety ── */}
      <section className="pc2-section pc2-section--dark" id="clinical" data-bg="dark">
        <div className="pc2-section-inner">
          <div className="pc2-section-text pc2-reveal">
            <span className="pc2-section-label" style={{ color: '#A05EF8', background: 'rgba(160,94,248,0.08)' }}>🛡 Clinical Safety Net</span>
            <h2 className="pc2-h2 pc2-h2--light">When it matters most,<br /><em>the system escalates.</em></h2>
            <p className="pc2-section-sub pc2-section-sub--light">When Nora detects clinical-level distress, PulseCheck automatically packages the full context — biometrics, chat sentiment, trend data — and initiates a secure, HIPAA-compliant handoff to AuntEdna, your clinical mental health platform.</p>
            <ul className="pc2-checklist pc2-checklist--dark">
              {['Critical alerts bypass Do Not Disturb on clinician devices', 'Full context snapshot: sleep, HRV, chat sentiment', 'Restricted visibility — HIPAA-sensitive case handling', 'Secure handoff to clinical staff for immediate follow-up'].map(t => (
                <li key={t}><span className="pc2-check" style={{ color: '#A05EF8' }}>✓</span><span style={{ color: '#a1a1aa' }}>{t}</span></li>
              ))}
            </ul>
          </div>
          <div className="pc2-section-visual pc2-reveal">
            <div className="pc2-mockup pc2-mockup--clinical">
              <div className="pc2-mockup-bar pc2-mockup-bar--dark">
                <div className="pc2-mockup-dots"><span /><span /><span /></div>
                <span className="pc2-mockup-title pc2-mockup-title--dark pc2-auntedna-title">
                  Clinical handoff <strong>Powered by AuntEdna</strong>
                </span>
              </div>
              <div className="pc2-clinical-alert">
                <div className="pc2-ca-header">
                  <div className="pc2-ca-icon">🔴</div>
                  <div>
                    <strong>⚠ Critical Alert</strong>
                    <span>K. Thompson #52 · Flagged for immediate attention</span>
                  </div>
                  <span className="pc2-ca-time">now</span>
                </div>
                <p>Critical Alert — Bypasses Do Not Disturb</p>
              </div>
              <div className="pc2-clinical-profile">
                <div className="pc2-cp-avatar">#52</div>
                <div>
                  <strong>K. Thompson</strong>
                  <span>Linebacker · Junior · 21 yrs</span>
                </div>
                <span className="pc2-cp-badge">CRITICAL</span>
              </div>
              <div className="pc2-clinical-stats">
                {[{ l: 'Risk Level', v: 'Critical', c: '#EF4444' }, { l: 'Sleep', v: '3.2h', c: '#F97316' }, { l: 'HRV', v: '↓ Low', c: '#EF4444' }, { l: 'Sentiment', v: 'Distress', c: '#A05EF8' }].map(s => (
                  <div key={s.l} className="pc2-cstat">
                    <div className="pc2-cstat-val" style={{ color: s.c }}>{s.v}</div>
                    <div className="pc2-cstat-label">{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="pc2-clinical-briefing">
                <strong>Nora Briefing</strong>
                <p>Thompson reported acute hopelessness following in-practice injury. Sentiment scoring indicates depression-adjacent language. Sleep has degraded over 5 days (avg 3.2h). Clinical intervention recommended immediately.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS — dark ── */}
      <section className="pc2-stats">
        {[{ v: '85%', l: 'of coaches say mental readiness impacts performance' }, { v: '2 min', l: 'daily check-in that captures what hours of observation miss' }, { v: '0', l: 'tools currently measure it in real time for coaching staff' }].map(s => (
          <div key={s.l} className="pc2-stat">
            <div className="pc2-stat-val">{s.v}</div>
            <div className="pc2-stat-label">{s.l}</div>
          </div>
        ))}
      </section>

      {/* ── CTA ── */}
      <section className="pc2-cta" id="pilot">
        <div className="pc2-cta-glow" />
        <div className="pc2-cta-inner">
          <h2 className="pc2-cta-h2">Ready to see what your athletes <em>aren't telling you?</em></h2>
          <p>Join the programs using PulseCheck to turn mental readiness from a blind spot into a competitive advantage.</p>
          <div className="pc2-cta-actions">
            <a href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Pilot%20Inquiry" className="pc2-btn-primary">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              Request Department Pilot
            </a>
            <button className="pc2-btn-secondary" onClick={onJoinWaitlist}>Join Waitlist →</button>
          </div>
          <p className="pc2-cta-note">Free pilot for qualifying D1 programs · No commitment required</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="pc2-footer">
        <div className="pc2-footer-inner">
          <div>
            <div className="pc2-logo" style={{ marginBottom: 12 }}>
              <div className="pc2-logo-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></div>
              PulseCheck
            </div>
            <p style={{ fontSize: 14, color: '#5a5d65', maxWidth: 260, lineHeight: 1.6 }}>The mental performance OS for elite athletic programs.</p>
          </div>
          <div className="pc2-footer-col"><h4>Product</h4><a href="#nora">For Athletes</a><a href="#coach">For Coaches</a><a href="#clinical">Clinical Safety</a></div>
          <div className="pc2-footer-col"><h4>Company</h4><a href="#top">About</a><a href="#top">Privacy</a><a href="#top">Terms</a></div>
        </div>
        <div className="pc2-footer-bottom">© 2026 Pulse Intelligence Labs, Inc. All rights reserved.</div>
      </footer>

      <style>{`/* ============================================================
         PULSECHECK v2 — Scroll-Driven Dynamic Styles
         All section backgrounds are TRANSPARENT so --pc2-bg flows
         underneath them like a single continuous canvas.
         ============================================================ */

        .pc2 {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          background: var(--pc2-bg, rgb(6,6,8));
          color: #111;
          overflow-x: hidden;
          /* 500ms ease: runs at full speed the instant the IO threshold fires */
          transition: background 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .pc2 *, .pc2 *::before, .pc2 *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── NAV ── */
        .pc2-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 56px;
          transition: padding 0.4s cubic-bezier(0.16,1,0.3,1),
                      background 0.5s cubic-bezier(0.16,1,0.3,1),
                      border-color 0.5s;
        }
        /* JS sets --pc2-nav-dark; use it to blend nav glass */
        .pc2-nav--scrolled {
          background: rgba(255,255,255,calc(var(--pc2-nav-dark,0) * 0.88 + (1 - var(--pc2-nav-dark,0)) * 0.08));
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-bottom: 1px solid rgba(255,255,255,calc(0.1 - var(--pc2-nav-dark,0) * 0.06));
          padding: 14px 56px;
          box-shadow: 0 1px 0 rgba(0,0,0,calc(var(--pc2-nav-dark,0) * 0.08));
        }
        .pc2-logo {
          display: flex; align-items: center; gap: 10px;
          font-weight: 700; font-size: 18px; text-decoration: none;
          /* Blend white→dark as nav-dark progresses */
          color: rgb(
            calc(255 - var(--pc2-nav-dark,0) * 249),
            calc(255 - var(--pc2-nav-dark,0) * 249),
            calc(255 - var(--pc2-nav-dark,0) * 247)
          );
          transition: color 0.4s;
        }
        .pc2-logo-icon {
          width: 32px; height: 32px; background: rgba(224,254,16,0.15);
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
        }
        .pc2-logo-img { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
        .pc2-logo-icon svg { width: 16px; height: 16px; stroke: #A05EF8; }
        .pc2-nav-links { display: flex; align-items: center; gap: 32px; }
        .pc2-nav-links a {
          text-decoration: none; font-size: 14px; font-weight: 500;
          transition: color 0.5s;
          color: rgba(
            calc(255 - var(--pc2-nav-dark,0) * 199),
            calc(255 - var(--pc2-nav-dark,0) * 199),
            calc(255 - var(--pc2-nav-dark,0) * 199),
            0.75
          );
        }
        .pc2-nav-links a:hover { opacity: 1; }
        .pc2-nav-cta {
          background: linear-gradient(135deg,#6A9AFA,#A05EF8) !important;
          color: #fff !important; padding: 9px 20px !important;
          border-radius: 8px; font-weight: 600 !important;
          opacity: 1 !important;
          box-shadow: 0 4px 20px rgba(106,154,250,0.3);
        }

        /* ── HERO ── */
        .pc2-hero {
          min-height: 100vh;
          /* Transparent so --pc2-bg shows through, but keep the radial glows */
          background: transparent;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column;
        }
        /* Keep the dark radial glows always — they look fine even as page lightens because
           they fade out naturally when background reaches white */
        .pc2-hero::before {
          content: '';
          position: absolute; top: -20%; left: 50%; transform: translateX(-50%);
          width: 1100px; height: 800px;
          background: radial-gradient(ellipse, rgba(106,154,250,0.09) 0%, transparent 65%);
          pointer-events: none;
        }
        .pc2-hero-glow {
          position: absolute; top: 38%; left: 50%;
          transform: translate(-50%,-50%);
          width: 1000px; height: 700px;
          background: radial-gradient(ellipse,
            rgba(106,154,250,0.07) 0%,
            rgba(160,94,248,0.04) 40%,
            transparent 70%);
          pointer-events: none;
          animation: pcGlowPulse 5s ease-in-out infinite;
        }
        @keyframes pcGlowPulse {
          0%,100% { opacity:0.8; transform:translate(-50%,-50%) scale(1); }
          50%      { opacity:1;   transform:translate(-50%,-50%) scale(1.08); }
        }
        .pc2-hero-inner {
          flex: 1; max-width: 1280px; margin: 0 auto; width: 100%;
          padding: 140px 56px 60px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
        }

        /* BADGE */
        .pc2-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 7px 16px;
          border: 1px solid rgba(255,255,255,0.1); border-radius: 100px;
          font-size: 12px; color: #aaa;
          margin-bottom: 28px;
          opacity: 0; animation: pcFadeUp 0.8s ease 0.2s forwards;
          backdrop-filter: blur(8px);
        }
        .pc2-badge-dot {
          width: 6px; height: 6px; background: #6A9AFA; border-radius: 50%;
          animation: pcPulseDot 2s ease infinite;
        }
        @keyframes pcPulseDot {
          0%,100% { box-shadow: 0 0 0 0 rgba(106,154,250,0.5); }
          50%      { box-shadow: 0 0 0 7px transparent; }
        }

        /* HEADLINE */
        .pc2-h1 {
          font-size: clamp(38px,4.5vw,64px); line-height: 1.06;
          font-weight: 700; letter-spacing: -0.03em; color: #fff;
          margin-bottom: 24px;
          opacity: 0; animation: pcFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.4s forwards;
        }
        .pc2-h1 em {
          font-style: italic;
          background: linear-gradient(135deg,#6A9AFA,#A05EF8);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .pc2-hero-sub {
          font-size: 18px; color: rgba(255,255,255,0.55); line-height: 1.75;
          margin-bottom: 40px; max-width: 480px;
          opacity: 0; animation: pcFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.55s forwards;
        }
        .pc2-hero-ctas {
          display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 52px;
          opacity: 0; animation: pcFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.7s forwards;
        }
        .pc2-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg,#6A9AFA,#A05EF8);
          color: #fff; padding: 14px 28px; border-radius: 12px;
          font-weight: 600; font-size: 15px; text-decoration: none;
          border: none; cursor: pointer;
          box-shadow: 0 4px 24px rgba(106,154,250,0.35);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .pc2-btn-primary:hover { transform:translateY(-2px); box-shadow:0 10px 36px rgba(106,154,250,0.4); }
        .pc2-btn-primary svg { width: 16px; height: 16px; flex-shrink: 0; }
        .pc2-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          color: rgba(255,255,255,0.6); background: transparent;
          padding: 14px 24px; border: 1px solid rgba(255,255,255,0.15);
          border-radius: 12px; font-size: 15px; font-weight: 500;
          text-decoration: none; cursor: pointer;
          transition: color 0.2s, border-color 0.2s;
        }
        .pc2-btn-secondary:hover { color:#fff; border-color:rgba(255,255,255,0.35); }
        .pc2-hero-proof {
          opacity: 0; animation: pcFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.9s forwards;
        }
        .pc2-proof-label {
          display: block; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.12em; color: rgba(255,255,255,0.3); margin-bottom: 14px;
        }
        .pc2-proof-logos { display: flex; gap: 32px; flex-wrap: wrap; }
        .pc2-proof-logo {
          font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
          color: rgba(255,255,255,0.22);
        }

        /* HERO VISUAL */
        .pc2-hero-visual {
          position: relative; display: flex; justify-content: center; align-items: center;
          opacity: 0; animation: pcFadeUp 1.1s cubic-bezier(0.16,1,0.3,1) 0.5s forwards;
          /* Allow cards to bleed outside without clipping */
          overflow: visible;
          /* Reduced padding — cards are now close to phone so don't need as much room */
          padding: 60px 120px;
        }
        /* Phone */
        .pc2-phone {
          width: 300px; height: 620px;
          background: linear-gradient(180deg,#111214 0%,#0c0d0f 100%);
          border-radius: 44px;
          border: 1.5px solid rgba(255,255,255,0.1);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 40px 80px rgba(0,0,0,0.7),
            inset 0 1px 0 rgba(255,255,255,0.08);
          position: relative; overflow: hidden; z-index: 2;
          will-change: transform;
        }
        .pc2-phone-notch {
          width: 100px; height: 28px; background: #111214;
          border-radius: 0 0 18px 18px;
          position: absolute; top: 0; left: 50%; transform: translateX(-50%); z-index: 3;
        }

        .pc2-app-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .pc2-app-logo { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#fff; }
        .pc2-app-live { font-size:9px; color:#22C55E; font-weight:700; letter-spacing:0.07em; animation: pcPulseDot 2s ease infinite; }
        .pc2-chat-bubble { padding:10px 14px; border-radius:16px; font-size:11px; line-height:1.5; margin-bottom:8px; max-width:85%; }
        .pc2-chat-nora { background:rgba(106,154,250,0.12); color:#c0d0f0; border-bottom-left-radius:4px; }
        .pc2-chat-user { background:rgba(224,254,16,0.1); color:#d0f0a0; border-bottom-right-radius:4px; align-self:flex-end; margin-left:auto; }
        .pc2-bio-row { display:flex; gap:6px; margin-top:8px; }
        .pc2-bio-chip { font-size:9px; padding:4px 8px; border-radius:20px; border:1px solid; color:#aaa; display:flex; align-items:center; gap:4px; }

        /* ── Animated chat sequence inside phone ── */
        /* Phone screen scrolls down as the conversation grows */
        .pc2-phone-screen {
          position: absolute; inset: 12px 8px 8px;
          border-radius: 34px; overflow: hidden;
          background: #0a0b0e;
          display: flex; flex-direction: column;
          padding: 36px 16px 16px;
          /* Auto-scroll to bottom as messages appear */
          justify-content: flex-end;
        }
        /* Each message fades + slides up in sequence */
        .pc2-seq {
          opacity: 0;
          animation: pcSeqIn 0.55s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        @keyframes pcSeqIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        /* Action card bubble (contains breathing prescription) */
        .pc2-chat-action {
          background: rgba(160,94,248,0.08) !important;
          border: 1px solid rgba(160,94,248,0.2);
          border-radius: 14px !important;
          padding: 10px 13px !important;
          margin-bottom: 8px;
        }
        /* "Start Now" button inside chat */
        .pc2-chat-btn {
          display: inline-block; margin-top: 8px;
          background: #A05EF8; color: #fff; border: none;
          border-radius: 8px; padding: 5px 12px;
          font-size: 10px; font-weight: 700; cursor: pointer;
          letter-spacing: 0.03em;
        }

        /* ── Box Breathing HUD (Step 5) ── */
        .pc2-breath-hud {
          display: flex; align-items: center; gap: 12px;
          background: rgba(160,94,248,0.06);
          border: 1px solid rgba(160,94,248,0.18);
          border-radius: 14px; padding: 10px 12px;
          margin-top: 4px;
        }
        .pc2-breath-ring-outer {
          position: relative; width: 46px; height: 46px;
          flex-shrink: 0; display: flex; align-items: center; justify-content: center;
        }
        .pc2-breath-ring-outer::before {
          content: ''; position: absolute; inset: 0;
          border-radius: 50%;
          border: 3px solid rgba(160,94,248,0.15);
        }
        .pc2-breath-ring-inner {
          position: absolute; inset: 0; border-radius: 50%;
          border: 3px solid #A05EF8;
          animation: pcBreath 4s ease-in-out 4.2s infinite alternate;
          transform: scale(0.55);
        }
        @keyframes pcBreath {
          0%   { transform: scale(0.55); opacity: 0.5; border-color: #A05EF8; }
          50%  { transform: scale(1);    opacity: 1;   border-color: #A05EF8; }
          100% { transform: scale(0.55); opacity: 0.5; border-color: #22C55E; }
        }
        .pc2-breath-phase {
          position: absolute; font-size: 8px; font-weight: 700;
          color: #A05EF8; letter-spacing: 0.05em;
          animation: pcBreathLabel 4s ease-in-out 4.2s infinite alternate;
        }
        @keyframes pcBreathLabel {
          0%,49% { content: 'Inhale'; color: #A05EF8; }
          50%,100% { color: #22C55E; }
        }
        .pc2-breath-stats { display: flex; flex-direction: column; gap: 4px; }
        .pc2-breath-stat { font-size: 9px; color: rgba(255,255,255,0.5); }

        /* ── Readiness bar chart sparkline ── */
        @keyframes pcBarH {
          from { opacity: 0; transform: scaleY(0); }
          to   { opacity: 1; transform: scaleY(1); }
        }

        /* Float cards — JS drives the translateY via inline style; base position only here */
        .pc2-float-card {
          position: absolute;
          background: rgba(14,16,22,0.65);
          backdrop-filter: blur(32px) saturate(180%);
          -webkit-backdrop-filter: blur(32px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 18px; padding: 13px 18px;
          display: flex; align-items: center; gap: 13px;
          box-shadow: 0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
          z-index: 10; white-space: nowrap;
          will-change: transform;
          /* Subtle entrance */
          opacity: 0; animation: pcFadeUp 1.2s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .pc2-float-card strong { display:block; font-size:13px; color:#fff; font-weight:600; }
        .pc2-float-card span { font-size:11px; color:rgba(255,255,255,0.45); }
        .pc2-fc-icon { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
        /* Reaction Time — top, sitting just above the upper edge of the phone */
        .pc2-float-card--tl { top: -18px;   left: -120px; animation-delay: 0.9s; }
        /* Focus Score — right side, pulled in so it doesn't clip the viewport */
        .pc2-float-card--r  { top: 36%;    right: -60px; animation-delay: 1.15s; }
        /* Readiness Score — left middle, between TL and BL */
        .pc2-float-card--ml { top: 42%;    left: -120px; animation-delay: 1.3s; }
        /* Box Breathing — bottom-left, raised to stay within the viewport */
        .pc2-float-card--bl { bottom: 130px; left: -115px; animation-delay: 1.55s; }

        /* ── Card: animated progress bar ── */
        .pc2-fc-bar-wrap { height:3px; background:rgba(255,255,255,0.08); border-radius:4px; margin-top:7px; width:130px; overflow:hidden; }
        .pc2-fc-bar { height:100%; border-radius:4px; width:0%; animation: pcBarFill 2s cubic-bezier(0.22,1,0.36,1) 1.8s forwards; }
        @keyframes pcBarFill { to { width:78%; } }

        /* ── Card: ping dot ── */
        .pc2-fc-ping {
          position:absolute; top:5px; right:5px;
          width:7px; height:7px; border-radius:50%; background:#A05EF8;
          animation: pcPingDot 2s ease-in-out infinite;
        }
        @keyframes pcPingDot {
          0%,100% { box-shadow:0 0 0 0 rgba(160,94,248,0.7); }
          50%      { box-shadow:0 0 0 5px rgba(160,94,248,0); }
        }

        /* ── Card: focus ring ── */
        .pc2-fc-ring-wrap { position:relative; width:44px; height:44px; flex-shrink:0; }
        .pc2-fc-ring-svg  { position:absolute; top:0; left:0; transform:rotate(-90deg); }
        .pc2-fc-ring-arc  {
          stroke-dashoffset: 106.8;
          animation: pcRingFill 2.2s cubic-bezier(0.22,1,0.36,1) 1.9s forwards;
        }
        @keyframes pcRingFill { to { stroke-dashoffset: 12; } }
        .pc2-fc-ring-label {
          position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
          font-size:13px; font-weight:700; color:#A05EF8;
        }
        .pc2-fc-elite { font-size:11px; color:#A05EF8; display:block; margin-top:2px; font-weight:500; }

        /* ── Card: breathing ring ── */
        .pc2-fc-breath-wrap { position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .pc2-fc-breath-ring {
          position:absolute; inset:0; border-radius:50%;
          border:2px solid rgba(34,211,238,0.4);
          animation: pcBreath 4s ease-in-out infinite;
        }
        @keyframes pcBreath {
          0%,100% { transform:scale(1);   box-shadow: 0 0 0 0   rgba(34,211,238,0.3); border-color:rgba(34,211,238,0.4); }
          50%      { transform:scale(1.28); box-shadow: 0 0 16px 4px rgba(34,211,238,0.15); border-color:rgba(34,211,238,0.85); }
        }
        .pc2-fc-breath-icon { font-size:18px; position:relative; z-index:1; }
        .pc2-stress-down { color:#22D3EE; font-weight:600; }

        @keyframes pcFadeUp {
          from { opacity:0; transform:translateY(22px); }
          to   { opacity:1; transform:translateY(0); }
        }

        /* ── TAB BAR ── */
        .pc2-tabbar {
          display: flex; align-items: center; justify-content: center;
          gap: 6px; padding: 24px 24px 32px;
          position: relative; z-index: 5;
        }
        .pc2-tab {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 20px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 100px; color: rgba(255,255,255,0.55);
          font-size: 13px; font-weight: 500; cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        .pc2-tab:hover { background:rgba(255,255,255,0.09); color:#fff; }
        .pc2-tab--active {
          background: rgba(106,154,250,0.15);
          border-color: rgba(106,154,250,0.35); color: #6A9AFA;
          box-shadow: 0 0 20px rgba(106,154,250,0.12);
        }

        /* ── SECTIONS ──
           All sections are transparent — the morph lives on .pc2 background.
           We keep very subtle local tints so content remains legible regardless
           of what the bg is doing. */
        .pc2-section { padding: 110px 56px; position: relative; }

        /* Light sections get a faint translucent white "card" feel during dark phase */
        .pc2-section--light::before,
        .pc2-section--offwhite::before {
          content: '';
          position: absolute; inset: 0;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(0px);
          pointer-events: none;
          z-index: 0;
        }
        /* Top gradient bleed — dark section bleeds UP into light */
        .pc2-section--light::after {
          content: '';
          position: absolute; top: -80px; left: 0; right: 0; height: 80px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.55));
          pointer-events: none; z-index: 0;
        }
        .pc2-section--offwhite::before { background: rgba(246,247,250,0.55); }
        .pc2-section--offwhite::after {
          content: '';
          position: absolute; top: -80px; left: 0; right: 0; height: 80px;
          background: linear-gradient(to bottom, transparent, rgba(246,247,250,0.55));
          pointer-events: none; z-index: 0;
        }
        /* Dark section re-darkens — gradient from previous light section */
        .pc2-section--dark::before {
          content: '';
          position: absolute; top: -100px; left: 0; right: 0; height: 100px;
          background: linear-gradient(to bottom, transparent, rgba(6,6,8,0.6));
          pointer-events: none; z-index: 0;
        }
        .pc2-section-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
          position: relative; z-index: 1;
        }
        .pc2-section-inner--flip .pc2-section-text { order:2; }
        .pc2-section-inner--flip .pc2-section-visual { order:1; }

        /* Section typography */
        .pc2-section-label {
          display: inline-block; padding: 5px 12px;
          background: rgba(160,94,248,0.08); border-radius: 20px;
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; margin-bottom: 20px;
        }
        .pc2-h2 {
          font-size: clamp(30px,3.2vw,50px); line-height: 1.1; font-weight: 700;
          letter-spacing: -0.025em; color: #111; margin-bottom: 20px;
        }
        .pc2-h2 em { font-style:italic; color:#A05EF8; }
        .pc2-h2--light { color:#fff; }
        .pc2-h2--light em {
          background: linear-gradient(135deg,#A05EF8,#6A9AFA);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .pc2-section-sub { font-size:17px; color:#555; line-height:1.75; margin-bottom:32px; }
        .pc2-section-sub--light { color:rgba(255,255,255,0.55); }
        .pc2-checklist { list-style:none; display:flex; flex-direction:column; gap:13px; }
        .pc2-checklist li { display:flex; align-items:flex-start; gap:10px; font-size:15px; color:#333; line-height:1.55; }
        .pc2-checklist--dark li { color:rgba(255,255,255,0.6); }
        .pc2-check { font-size:14px; color:#A05EF8; font-weight:700; flex-shrink:0; margin-top:2px; }

        /* ── REVEAL SYSTEM ── (spring feel) */
        .pc2-reveal {
          opacity: 0;
          transform: translateY(36px) scale(0.98);
          transition:
            opacity 0.85s cubic-bezier(0.16,1,0.3,1),
            transform 0.85s cubic-bezier(0.16,1,0.3,1);
        }
        /* Stagger siblings automatically */
        .pc2-reveal:nth-child(2) { transition-delay: 0.1s; }
        .pc2-reveal:nth-child(3) { transition-delay: 0.2s; }
        .pc2-visible { opacity:1; transform:translateY(0) scale(1); }

        /* ── MOCKUPS ── */
        .pc2-mockup {
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(200,205,215,0.6);
          border-radius: 18px; overflow: hidden;
          box-shadow:
            0 2px 0 rgba(255,255,255,0.8) inset,
            0 24px 64px rgba(0,0,0,0.10),
            0 4px 16px rgba(0,0,0,0.06);
          backdrop-filter: blur(12px);
        }
        .pc2-mockup-bar {
          display:flex; align-items:center; gap:8px;
          padding:12px 18px; border-bottom:1px solid rgba(0,0,0,0.06);
          background: rgba(250,251,253,0.9);
        }
        .pc2-mockup-dots { display:flex; gap:6px; }
        .pc2-mockup-dots span { width:11px; height:11px; border-radius:50%; }
        .pc2-mockup-dots span:nth-child(1){background:#ff5f57;} .pc2-mockup-dots span:nth-child(2){background:#febc2e;} .pc2-mockup-dots span:nth-child(3){background:#28c840;}
        .pc2-mockup-title { font-size:11px; color:#bbb; margin-left:6px; font-family:ui-monospace,monospace; }
        .pc2-mockup-bar--dark { background:rgba(17,18,21,0.95); border-bottom-color:rgba(255,255,255,0.05); }
        .pc2-mockup-title--dark { color:#444; }
        .pc2-mockup--clinical { background:rgba(10,10,14,0.95); border-color:rgba(255,255,255,0.05); }

        /* Chat log */
        .pc2-chat-log { padding:20px; display:flex; flex-direction:column; gap:10px; }
        .pc2-cl-nora,.pc2-cl-user,.pc2-cl-system { padding:11px 15px; border-radius:14px; font-size:13px; line-height:1.55; max-width:82%; }
        .pc2-cl-nora { background:#f0f4ff; color:#2a3550; border-bottom-left-radius:4px; }
        .pc2-cl-user { background:#edfff4; color:#1a3326; border-bottom-right-radius:4px; align-self:flex-end; margin-left:auto; }
        .pc2-cl-system {
          background: linear-gradient(135deg,rgba(224,254,16,0.05),rgba(34,211,238,0.05));
          border:1px solid rgba(224,254,16,0.18); color:#444;
          align-self:stretch; max-width:100%;
          display:flex; flex-direction:column; gap:8px;
          border-radius:12px;
        }
        .pc2-cl-system span:first-child { font-size:18px; }
        .pc2-cl-metrics { display:flex; gap:10px; flex-wrap:wrap; }
        .pc2-cl-metrics span { font-size:11px; color:#6A9AFA; font-weight:600; background:rgba(106,154,250,0.1); padding:3px 9px; border-radius:20px; }

        /* Sim steps */
        .pc2-sim-steps { display:flex; flex-direction:column; gap:16px; margin-top:8px; }
        .pc2-sim-step { display:flex; align-items:flex-start; gap:14px; padding:14px 16px; border-left:3px solid; border-radius:0 12px 12px 0; background:rgba(0,0,0,0.015); }
        .pc2-sim-step-icon { width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0; }
        .pc2-sim-step strong { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px; }
        .pc2-sim-step p { font-size:13px; color:#555; line-height:1.55; }

        /* Sim mockup internals */
        .pc2-sim-meters { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:#e8eaee; }
        .pc2-sim-meter { background:#fff; padding:18px 14px; text-align:center; }
        .pc2-sm-label { font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#aaa; margin-bottom:6px; }
        .pc2-sm-val { font-size:30px; font-weight:700; margin-bottom:10px; }
        .pc2-sm-bar { height:3px; background:#f0f0f0; border-radius:2px; overflow:hidden; }
        .pc2-sm-fill { height:100%; border-radius:2px; }
        .pc2-sim-interventions { padding:16px; display:flex; flex-direction:column; gap:12px; }
        .pc2-intervention { display:flex; align-items:flex-start; gap:12px; }
        .pc2-int-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
        .pc2-intervention strong { display:block; font-size:13px; font-weight:600; color:#111; margin-bottom:2px; }
        .pc2-intervention span { font-size:12px; color:#777; }

        /* Dashboard mockup */
        .pc2-dash-alert { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; margin:16px; border-radius:12px; background:rgba(249,115,22,0.05); border:1px solid rgba(249,115,22,0.2); }
        .pc2-dash-alert-icon { font-size:20px; flex-shrink:0; }
        .pc2-dash-alert strong { display:block; font-size:13px; color:#111; margin-bottom:4px; }
        .pc2-dash-alert p { font-size:12px; color:#666; line-height:1.5; }
        .pc2-dash-label { font-size:10px; text-transform:uppercase; letter-spacing:0.1em; color:#aaa; padding:0 16px 10px; font-weight:700; }
        .pc2-roster { padding:0 16px 16px; display:flex; flex-direction:column; gap:4px; }
        .pc2-roster-row { display:grid; grid-template-columns:12px 1fr 40px 1fr; gap:10px; align-items:center; padding:8px 10px; border-radius:8px; font-size:12px; transition:background 0.15s; }
        .pc2-roster-row:hover { background:rgba(0,0,0,0.025); }
        .pc2-roster-row--critical { background:rgba(239,68,68,0.04); }
        .pc2-roster-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .pc2-roster-dot--optimal{background:#22C55E;}
        .pc2-roster-dot--warning{background:#F59E0B;}
        .pc2-roster-dot--elevated{background:#F97316;}
        .pc2-roster-dot--critical{background:#EF4444; animation:pcPulseDot 1.5s ease infinite;}
        .pc2-roster-dot--nocheckin{background:#71717a;}
        .pc2-roster-name { font-weight:600; color:#111; }
        .pc2-roster-pos  { color:#bbb; font-size:11px; }
        .pc2-roster-status { font-size:11px; }
        .pc2-roster-status--optimal{color:#22C55E;}
        .pc2-roster-status--warning{color:#F59E0B;}
        .pc2-roster-status--elevated{color:#F97316;}
        .pc2-roster-status--critical{color:#EF4444;font-weight:700;}
        .pc2-roster-status--nocheckin{color:#71717a;}

        /* Clinical mockup */
        .pc2-clinical-alert { margin:14px; padding:14px; border-radius:13px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); }
        .pc2-ca-header { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
        .pc2-ca-icon { font-size:16px; }
        .pc2-ca-header strong { font-size:13px; color:#f87171; display:block; }
        .pc2-ca-header span { font-size:11px; color:#666; }
        .pc2-ca-time { margin-left:auto; font-size:10px; color:#555; }
        .pc2-clinical-alert p { font-size:10px; color:#EF4444; text-transform:uppercase; letter-spacing:0.1em; opacity:0.65; }
        .pc2-clinical-profile { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.05); }
        .pc2-cp-avatar { width:44px; height:44px; border-radius:12px; background:rgba(239,68,68,0.15); display:flex; align-items:center; justify-content:center; font-weight:700; color:#f87171; font-size:14px; }
        .pc2-clinical-profile strong { display:block; font-size:14px; color:#fff; }
        .pc2-clinical-profile span { font-size:11px; color:#555; }
        .pc2-cp-badge { margin-left:auto; font-size:10px; padding:3px 10px; border-radius:20px; background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3); font-weight:700; animation:pcPulseDot 1.5s ease infinite; }
        .pc2-clinical-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:rgba(255,255,255,0.05); }
        .pc2-cstat { background:rgba(10,11,14,0.95); padding:14px 12px; text-align:center; }
        .pc2-cstat-val { font-size:21px; font-weight:700; margin-bottom:4px; }
        .pc2-cstat-label { font-size:10px; color:#444; text-transform:uppercase; letter-spacing:0.07em; }
        .pc2-clinical-briefing { margin:14px; padding:14px; border-radius:11px; background:rgba(147,51,234,0.08); border:1px solid rgba(147,51,234,0.2); }
        .pc2-clinical-briefing strong { display:block; font-size:11px; color:#A05EF8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:8px; }
        .pc2-clinical-briefing p { font-size:12px; color:#777; line-height:1.65; }

        /* STATS */
        .pc2-stats {
          display: grid; grid-template-columns: repeat(3,1fr);
          gap: 1px; background: rgba(255,255,255,0.05);
          position: relative; z-index: 1;
        }
        .pc2-stat { padding:64px 40px; text-align:center; }
        .pc2-stat-val { font-size:54px; font-weight:700; color:#6A9AFA; line-height:1; margin-bottom:16px; letter-spacing:-0.02em; }
        .pc2-stat-label { font-size:14px; color:rgba(255,255,255,0.35); max-width:220px; margin:0 auto; line-height:1.6; }

        /* CTA */
        .pc2-cta {
          padding: 130px 56px; text-align: center; position: relative; overflow: hidden;
        }
        .pc2-cta-glow {
          position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
          width:800px; height:600px;
          background:radial-gradient(ellipse,rgba(106,154,250,0.08) 0%,rgba(160,94,248,0.04) 40%,transparent 70%);
          pointer-events:none; animation:pcGlowPulse 5s ease-in-out infinite;
        }
        .pc2-cta-inner { position:relative; max-width:680px; margin:0 auto; }
        .pc2-cta-h2 { font-size:clamp(30px,4vw,54px); font-weight:700; color:#fff; line-height:1.1; letter-spacing:-0.025em; margin-bottom:20px; }
        .pc2-cta-h2 em { font-style:italic; background:linear-gradient(135deg,#6A9AFA,#A05EF8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .pc2-cta p { font-size:18px; color:rgba(255,255,255,0.45); margin-bottom:40px; line-height:1.75; }
        .pc2-cta-actions { display:flex; justify-content:center; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
        .pc2-cta-note { font-size:13px; color:rgba(255,255,255,0.25); }

        /* FOOTER */
        .pc2-footer { padding:72px 56px 40px; border-top:1px solid rgba(255,255,255,0.05); }
        .pc2-footer-inner { max-width:1100px; margin:0 auto; display:grid; grid-template-columns:2fr 1fr 1fr; gap:48px; margin-bottom:48px; }
        .pc2-footer-col h4 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.25); margin-bottom:16px; }
        .pc2-footer-col a { display:block; font-size:14px; color:rgba(255,255,255,0.35); text-decoration:none; margin-bottom:10px; transition:color 0.2s; }
        .pc2-footer-col a:hover { color:rgba(255,255,255,0.7); }
        .pc2-footer-bottom { max-width:1100px; margin:0 auto; padding-top:24px; border-top:1px solid rgba(255,255,255,0.05); font-size:13px; color:rgba(255,255,255,0.2); text-align:center; }

        /* RESPONSIVE */
        @media(max-width:1100px){
          .pc2-hero-inner{grid-template-columns:1fr;gap:40px;padding:120px 32px 80px;}
          /* Show phone stacked below text — hide only the side float cards */
          .pc2-hero-visual{
            display:flex;
            justify-content:center;
            padding:0;
            /* Extra bottom space for the Box Breathing card that hugs the bottom */
            margin-bottom:60px;
          }
          /* Hide all side float cards on mobile — they'd overflow */
          .pc2-float-card--tl,
          .pc2-float-card--r,
          .pc2-float-card--ml,
          .pc2-float-card--bl { display: none; }
          /* Scale phone to fit narrower viewport */
          .pc2-phone { width:260px; height:540px; }
          .pc2-section-inner{grid-template-columns:1fr;}
          .pc2-section-inner--flip .pc2-section-text,.pc2-section-inner--flip .pc2-section-visual{order:unset;}
          .pc2-stats{grid-template-columns:1fr;}
          .pc2-footer-inner{grid-template-columns:1fr 1fr;}
        }
        @media(max-width:700px){
          .pc2-nav{padding:14px 20px;}
          .pc2-nav--scrolled{padding:12px 20px;}
          .pc2-nav-links a:not(.pc2-nav-cta){display:none;}
          .pc2-section{padding:80px 24px;}
          .pc2-hero-inner{padding:90px 24px 60px;}
          /* Even smaller phone on tiny screens */
          .pc2-phone { width:220px; height:460px; }
          .pc2-tabbar{flex-wrap:wrap; gap:6px;}
          .pc2-cta{padding:90px 24px;}
          .pc2-footer{padding:48px 24px 32px;}
          .pc2-footer-inner{grid-template-columns:1fr;gap:32px;}
        }
        .pc2-auntedna-title {
          font-size: 12px !important;
          font-weight: 500;
          color: rgba(180,140,255,0.9) !important;
          letter-spacing: 0.03em;
          animation: pcAuntEdnaGlow 3s ease-in-out infinite;
        }
        .pc2-auntedna-title strong {
          font-weight: 700;
          color: #C084FC;
        }
        @keyframes pcAuntEdnaGlow {
          0%,100% {
            text-shadow:
              0 0 6px rgba(192,132,252,0.4),
              0 0 14px rgba(160,94,248,0.2);
            opacity: 0.85;
          }
          50% {
            text-shadow:
              0 0 10px rgba(192,132,252,0.9),
              0 0 24px rgba(160,94,248,0.55),
              0 0 40px rgba(106,154,250,0.2);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default PulseCheckMarketingLanding;
