import React, { useEffect, useRef, useState, useCallback } from 'react';

type Props = {
  onJoinWaitlist?: () => void;
  onOpenApp?: () => void;
  appLabel?: string;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

const SCAN_ITEMS = [
  { name: 'Grilled Chicken', qty: '6 oz', kcal: 284, p: 53, c: 0, f: 6, emoji: '🍗', tint: '#E0FE10' },
  { name: 'Jasmine Rice', qty: '1 cup', kcal: 205, p: 4, c: 45, f: 0, emoji: '🍚', tint: '#06B6D4' },
  { name: 'Broccoli', qty: '1 cup', kcal: 55, p: 4, c: 11, f: 1, emoji: '🥦', tint: '#22C55E' },
  { name: 'Avocado', qty: '½ med', kcal: 160, p: 2, c: 9, f: 15, emoji: '🥑', tint: '#8B5CF6' },
] as const;

const MacraMarketingLanding: React.FC<Props> = ({
  onJoinWaitlist,
  onOpenApp,
  appLabel = 'Open App',
}) => {
  const [scrollY, setScrollY] = useState(0);
  const [scanStep, setScanStep] = useState(0); // 0 camera, 1 grid, 2 lock, 3 recognize, 4 macros, 5 logged
  const [activeScanItem, setActiveScanItem] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const currentScrollRef = useRef(0);
  const targetScrollRef = useRef(0);

  // RAF parallax
  const tick = useCallback(() => {
    targetScrollRef.current = typeof window !== 'undefined' ? window.scrollY : 0;
    currentScrollRef.current = lerp(currentScrollRef.current, targetScrollRef.current, 0.06);
    const s = currentScrollRef.current;
    setScrollY(s);

    const wrapper = wrapperRef.current;
    if (wrapper) {
      const parallaxAmt = s * 0.25;
      const cards = wrapper.querySelectorAll<HTMLElement>(
        '.mc2-float-card--tl, .mc2-float-card--r, .mc2-float-card--bl, .mc2-float-card--ml'
      );
      cards.forEach((card, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        card.style.transform = `translateY(${parallaxAmt * 0.12 * dir * (i + 1)}px)`;
      });
      const phone = wrapper.querySelector<HTMLElement>('.mc2-phone');
      if (phone) phone.style.transform = `translateY(${-s * 0.08}px)`;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    const wrapper = wrapperRef.current;

    // Threshold-triggered bg morph
    const DARK_BG = 'rgb(6,8,6)';
    const LIGHT_BG = 'rgb(246,248,240)';
    const visibilityMap = new Map<Element, number>();
    const bgObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visibilityMap.set(e.target, e.intersectionRatio);
          else visibilityMap.delete(e.target);
        });
        if (!wrapper) return;
        let dominant: Element | null = null;
        let best = 0;
        visibilityMap.forEach((ratio, el) => {
          if (ratio > best) {
            best = ratio;
            dominant = el;
          }
        });
        if (dominant) {
          const isLight = (dominant as HTMLElement).dataset.bg === 'light';
          wrapper.style.setProperty('--mc2-bg', isLight ? LIGHT_BG : DARK_BG);
          wrapper.style.setProperty('--mc2-nav-dark', isLight ? '1' : '0');
        }
      },
      { threshold: [0, 0.15, 0.5, 1.0] }
    );
    document.querySelectorAll<HTMLElement>('[data-bg]').forEach((el) => bgObserver.observe(el));

    // Reveal
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('mc2-visible');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.mc2-reveal').forEach((el) => io.observe(el));

    return () => {
      cancelAnimationFrame(rafRef.current);
      io.disconnect();
      bgObserver.disconnect();
    };
  }, [tick]);

  // Scan sequence loop — each step advances on a timer
  useEffect(() => {
    const durations = [900, 900, 900, 1100, 1800, 1600]; // ms per step
    const t = setTimeout(() => {
      if (scanStep < 5) {
        setScanStep((s) => s + 1);
      } else {
        setActiveScanItem((i) => (i + 1) % SCAN_ITEMS.length);
        setScanStep(0);
      }
    }, durations[scanStep]);
    return () => clearTimeout(t);
  }, [scanStep]);

  const item = SCAN_ITEMS[activeScanItem];
  const navScrolled = scrollY > 60;

  return (
    <div
      className="mc2"
      ref={wrapperRef}
      style={{ '--mc2-bg': 'rgb(6,8,6)', '--mc2-nav-dark': '0' } as React.CSSProperties}
    >
      {/* ── NAV ── */}
      <nav className={`mc2-nav ${navScrolled ? 'mc2-nav--scrolled' : ''}`}>
        <a href="#top" className="mc2-logo">
          <span className="mc2-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </span>
          Macra
        </a>
        <div className="mc2-nav-links">
          <a href="#scan">Food Scan</a>
          <a href="#nora">Nora</a>
          <a href="#macros">Macros</a>
          <a href="#label">Labels</a>
          {onOpenApp && (
            <button type="button" className="mc2-nav-login" onClick={onOpenApp}>
              {appLabel}
            </button>
          )}
          <a href="#waitlist" className="mc2-nav-cta">
            Join Waitlist
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="mc2-hero" id="top" data-bg="dark">
        <div className="mc2-hero-glow" />
        <div className="mc2-hero-grid" />
        <div className="mc2-hero-inner">
          <div className="mc2-hero-text">
            <div className="mc2-badge">
              <span className="mc2-badge-dot" />
              Macra · Nutrition AI · iOS
            </div>
            <h1 className="mc2-h1">
              Point your phone at food.<br />
              <em>Get your macros, instantly.</em>
            </h1>
            <p className="mc2-hero-sub">
              Macra turns any meal into a complete macro breakdown in seconds — then Nora builds
              your daily meal plan around the goals you set. No weighing. No guessing.
            </p>
            <div className="mc2-hero-ctas">
              <a href="#waitlist" className="mc2-btn-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                Join the Waitlist
              </a>
              <a href="#scan" className="mc2-btn-secondary">
                See How It Works →
              </a>
            </div>
            <div className="mc2-hero-proof">
              <span className="mc2-proof-label">Part of the Pulse Intelligence ecosystem</span>
              <div className="mc2-proof-logos">
                {['PULSE', 'QUICKLIFTS', 'PULSECHECK', 'NORA AI'].map((l) => (
                  <span key={l} className="mc2-proof-logo">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Phone + floating cards */}
          <div className="mc2-hero-visual">
            {/* Floating — Calorie budget */}
            <div className="mc2-float-card mc2-float-card--tl">
              <div
                className="mc2-fc-icon"
                style={{ background: 'rgba(224,254,16,0.18)', color: '#E0FE10', position: 'relative' }}
              >
                🔥
                <span className="mc2-fc-ping" />
              </div>
              <div>
                <strong>Daily Budget</strong>
                <span>
                  Calories · <span className="mc2-ticker">1,847 / 2,400</span>
                </span>
                <div className="mc2-fc-bar-wrap">
                  <div
                    className="mc2-fc-bar"
                    style={{ background: 'linear-gradient(90deg,#E0FE10,#06B6D4)', animationDelay: '0s' }}
                  />
                </div>
              </div>
            </div>

            {/* Floating — Protein ring */}
            <div className="mc2-float-card mc2-float-card--r">
              <div className="mc2-fc-ring-wrap">
                <svg viewBox="0 0 44 44" width="44" height="44" className="mc2-fc-ring-svg">
                  <circle cx="22" cy="22" r="17" stroke="rgba(224,254,16,0.18)" strokeWidth="4" fill="none" />
                  <circle
                    cx="22"
                    cy="22"
                    r="17"
                    stroke="#E0FE10"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="106.8"
                    className="mc2-fc-ring-arc"
                  />
                </svg>
                <span className="mc2-fc-ring-label">172</span>
              </div>
              <div>
                <strong>Protein</strong>
                <span className="mc2-fc-elite">g · on target ↑</span>
              </div>
            </div>

            {/* Floating — Streak / Nora plan */}
            <div className="mc2-float-card mc2-float-card--ml">
              <div
                className="mc2-fc-icon"
                style={{ background: 'rgba(139,92,246,0.18)', color: '#C084FC', position: 'relative' }}
              >
                ✨
              </div>
              <div>
                <strong>Nora's Plan</strong>
                <span>
                  3 meals · <span style={{ color: '#C084FC', fontWeight: 600 }}>built for you</span>
                </span>
                <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                  {['M1', 'M2', 'M3'].map((m, i) => (
                    <span
                      key={m}
                      style={{
                        fontSize: 9,
                        padding: '3px 7px',
                        borderRadius: 6,
                        background: 'rgba(139,92,246,0.12)',
                        color: '#C084FC',
                        fontWeight: 600,
                        animation: `mcFadeUp 0.6s ease ${2 + i * 0.15}s both`,
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating — Streak fire */}
            <div className="mc2-float-card mc2-float-card--bl">
              <div className="mc2-fc-streak-wrap">
                <div className="mc2-fc-streak-ring" />
                <span className="mc2-fc-streak-icon">📈</span>
              </div>
              <div>
                <strong>14 Day Streak</strong>
                <span>
                  Protein <span className="mc2-up">↑ 22%</span> · Consistent
                </span>
                <div className="mc2-fc-bar-wrap" style={{ marginTop: 5 }}>
                  <div
                    className="mc2-fc-bar"
                    style={{ background: 'linear-gradient(90deg,#E0FE10,#22C55E)', width: '100%', animationDelay: '0.4s' }}
                  />
                </div>
              </div>
            </div>

            {/* Phone */}
            <div className="mc2-phone">
              <div className="mc2-phone-notch" />
              <div className="mc2-phone-screen">
                {/* Top bar */}
                <div className="mc2-app-header">
                  <div className="mc2-app-logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2.5" width="14" height="14">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    Macra
                  </div>
                  <div className="mc2-app-live">● SCANNING</div>
                </div>

                {/* Camera viewport — scan stage */}
                <div className="mc2-scan-stage">
                  {/* Food emoji subject */}
                  <div className={`mc2-scan-subject mc2-scan-subject--step${scanStep}`} key={activeScanItem}>
                    <span className="mc2-scan-emoji">{item.emoji}</span>
                    {/* particle burst on step 4 */}
                    <div className="mc2-scan-particles">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <span
                          key={i}
                          className="mc2-scan-particle"
                          style={
                            {
                              '--angle': `${(360 / 12) * i}deg`,
                              '--tint': item.tint,
                              animationDelay: `${i * 0.025}s`,
                            } as React.CSSProperties
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Scan grid */}
                  <div
                    className={`mc2-scan-grid ${scanStep >= 1 ? 'mc2-scan-grid--on' : ''} ${
                      scanStep >= 2 ? 'mc2-scan-grid--lock' : ''
                    }`}
                  >
                    <div className="mc2-scan-line" />
                    <span className="mc2-scan-corner mc2-scan-corner--tl" />
                    <span className="mc2-scan-corner mc2-scan-corner--tr" />
                    <span className="mc2-scan-corner mc2-scan-corner--bl" />
                    <span className="mc2-scan-corner mc2-scan-corner--br" />
                  </div>

                  {/* Recognition label */}
                  {scanStep >= 3 && (
                    <div className="mc2-scan-label">
                      <span className="mc2-scan-label-dot" style={{ background: item.tint }} />
                      <strong>{item.name}</strong>
                      <span>· {item.qty}</span>
                    </div>
                  )}

                  {/* Macro readout */}
                  {scanStep >= 4 && (
                    <div className="mc2-scan-macros">
                      <div className="mc2-scan-kcal">
                        <span className="mc2-scan-kcal-val">{item.kcal}</span>
                        <span className="mc2-scan-kcal-label">kcal</span>
                      </div>
                      <div className="mc2-scan-macro-grid">
                        <Macro label="P" value={item.p} tint="#E0FE10" />
                        <Macro label="C" value={item.c} tint="#06B6D4" />
                        <Macro label="F" value={item.f} tint="#8B5CF6" />
                      </div>
                    </div>
                  )}

                  {/* Logged toast */}
                  {scanStep >= 5 && (
                    <div className="mc2-scan-toast">
                      <span>✓</span>
                      Logged to today
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 1 — Food Scan deep dive (light) ── */}
      <section className="mc2-section mc2-section--light" id="scan" data-bg="light">
        <div className="mc2-section-inner mc2-section-inner--flip">
          <div className="mc2-section-text mc2-reveal">
            <span className="mc2-section-label">📸 Vision Food Scan</span>
            <h2 className="mc2-h2">
              A plate in.
              <br />
              <em>Full macros out.</em>
            </h2>
            <p className="mc2-section-sub">
              Point the camera. Macra locks the frame, segments each item on the plate, and returns
              calories, protein, carbs, and fat per component — not one vague total. Adjust
              portions with a pinch. Log in one tap.
            </p>
            <ul className="mc2-checklist">
              {[
                'Multi-item recognition — plate-level breakdown, not a single guess',
                'Per-ingredient macros (chicken vs. rice vs. sauce)',
                'Portion slider tuned to what your camera actually sees',
                'Learns your go-to meals so the second log is instant',
              ].map((t) => (
                <li key={t}>
                  <span className="mc2-check">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="mc2-section-visual mc2-reveal">
            <div className="mc2-mockup mc2-mockup--scan">
              <div className="mc2-mockup-bar">
                <div className="mc2-mockup-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="mc2-mockup-title">Macra · Live Scan · Bowl #247</span>
              </div>
              <div className="mc2-scan-board">
                <div className="mc2-scan-board-plate">
                  <span className="mc2-scan-board-plate-emoji">🍲</span>
                  {[
                    { t: 'Chicken', l: 18, top: 22 },
                    { t: 'Rice', l: 56, top: 32 },
                    { t: 'Broccoli', l: 30, top: 62 },
                    { t: 'Avocado', l: 68, top: 68 },
                  ].map((m, i) => (
                    <div
                      key={m.t}
                      className="mc2-scan-pin"
                      style={{ left: `${m.l}%`, top: `${m.top}%`, animationDelay: `${0.4 + i * 0.25}s` }}
                    >
                      <span className="mc2-scan-pin-dot" />
                      <span className="mc2-scan-pin-label">{m.t}</span>
                    </div>
                  ))}
                </div>
                <div className="mc2-scan-items">
                  {SCAN_ITEMS.map((si, i) => (
                    <div
                      key={si.name}
                      className="mc2-scan-item"
                      style={{ animationDelay: `${0.8 + i * 0.18}s`, borderLeftColor: si.tint }}
                    >
                      <span className="mc2-scan-item-emoji">{si.emoji}</span>
                      <div>
                        <strong>{si.name}</strong>
                        <span>{si.qty}</span>
                      </div>
                      <div className="mc2-scan-item-macros">
                        <em style={{ color: '#0a0a0a' }}>{si.kcal}</em>
                        <span>
                          <b style={{ color: '#0a0a0a' }}>{si.p}</b>p · <b style={{ color: '#0a0a0a' }}>{si.c}</b>c ·{' '}
                          <b style={{ color: '#0a0a0a' }}>{si.f}</b>f
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="mc2-scan-total">
                    <span>Plate Total</span>
                    <strong>704 kcal · 63p · 65c · 22f</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — Nora builds your plan (off-white) ── */}
      <section className="mc2-section mc2-section--offwhite" id="nora" data-bg="light">
        <div className="mc2-section-inner">
          <div className="mc2-section-text mc2-reveal">
            <span className="mc2-section-label" style={{ color: '#8B5CF6', background: 'rgba(139,92,246,0.08)' }}>
              ✨ Nora AI · Meal Planning
            </span>
            <h2 className="mc2-h2">
              Nora writes your day.
              <br />
              <em>Before you open the fridge.</em>
            </h2>
            <p className="mc2-section-sub">
              Tell Nora your goals. She builds <strong>Meal 1, Meal 2, Meal 3</strong> around your
              exact targets — protein, calories, budget, time — and adapts the plan as you log. You
              see her reason in real time, not a static PDF.
            </p>
            <ul className="mc2-checklist">
              {[
                'Numbered meals (Meal 1 / 2 / 3) — no rigid breakfast/lunch/dinner boxes',
                'Every gram traced back to your daily macro target',
                'Re-plans the day the moment you log something off-plan',
                'Grocery list auto-generated per week',
              ].map((t) => (
                <li key={t}>
                  <span className="mc2-check" style={{ color: '#8B5CF6' }}>
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="mc2-section-visual mc2-reveal">
            <div className="mc2-mockup mc2-mockup--nora">
              <div className="mc2-mockup-bar">
                <div className="mc2-mockup-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="mc2-mockup-title">Nora · Drafting today's plan</span>
              </div>
              <div className="mc2-nora-chat">
                <div className="mc2-nora-typing">
                  <span className="mc2-nora-avatar">N</span>
                  <div className="mc2-nora-bubble">
                    Building a 2,400 kcal plan · 180p / 240c / 70f · lean-bulk mode
                    <div className="mc2-nora-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>

                {[
                  {
                    m: 'Meal 1',
                    name: 'Overnight oats + whey + berries',
                    kcal: 612,
                    p: 42,
                    c: 78,
                    f: 14,
                    tint: '#E0FE10',
                  },
                  {
                    m: 'Meal 2',
                    name: 'Grilled chicken bowl · rice · avocado',
                    kcal: 840,
                    p: 62,
                    c: 92,
                    f: 24,
                    tint: '#06B6D4',
                  },
                  {
                    m: 'Meal 3',
                    name: 'Salmon · sweet potato · green beans',
                    kcal: 948,
                    p: 76,
                    c: 70,
                    f: 32,
                    tint: '#8B5CF6',
                  },
                ].map((mm, i) => (
                  <div
                    key={mm.m}
                    className="mc2-nora-meal"
                    style={{ animationDelay: `${1.2 + i * 0.55}s`, borderLeftColor: mm.tint }}
                  >
                    <div className="mc2-nora-meal-head">
                      <span className="mc2-nora-meal-tag" style={{ background: `${mm.tint}22`, color: mm.tint }}>
                        {mm.m}
                      </span>
                      <strong>{mm.name}</strong>
                    </div>
                    <div className="mc2-nora-meal-macros">
                      <span>
                        <em>{mm.kcal}</em> kcal
                      </span>
                      <span style={{ color: '#E0FE10' }}>
                        <em>{mm.p}</em>p
                      </span>
                      <span style={{ color: '#06B6D4' }}>
                        <em>{mm.c}</em>c
                      </span>
                      <span style={{ color: '#8B5CF6' }}>
                        <em>{mm.f}</em>f
                      </span>
                    </div>
                    <div className="mc2-nora-meal-bar">
                      <div
                        className="mc2-nora-meal-bar-fill"
                        style={{
                          background: mm.tint,
                          animationDelay: `${1.4 + i * 0.55}s`,
                          width: `${(mm.kcal / 948) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}

                <div className="mc2-nora-summary">
                  <strong>Day Total</strong>
                  <span>2,400 kcal · 180p · 240c · 70f</span>
                  <span className="mc2-nora-match">✓ Exact match</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — Macro rings (light) ── */}
      <section className="mc2-section mc2-section--light" id="macros" data-bg="light">
        <div className="mc2-section-inner mc2-section-inner--flip">
          <div className="mc2-section-text mc2-reveal">
            <span className="mc2-section-label">🎯 Macro Command Center</span>
            <h2 className="mc2-h2">
              Three rings.
              <br />
              <em>One honest answer.</em>
            </h2>
            <p className="mc2-section-sub">
              Macra collapses the whole day into three living rings — protein, carbs, fat — that
              fill as you log. No spreadsheets, no decimals. A glance tells you what's left.
            </p>
            <ul className="mc2-checklist">
              {[
                'Protein · Carbs · Fat rings always visible on home',
                'Trend lines show your 7-day macro consistency',
                'Over / under alerts tuned to your goal — not a generic target',
                'Weekly insights that recommend next-week adjustments',
              ].map((t) => (
                <li key={t}>
                  <span className="mc2-check">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="mc2-section-visual mc2-reveal">
            <div className="mc2-mockup mc2-mockup--rings">
              <div className="mc2-mockup-bar">
                <div className="mc2-mockup-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="mc2-mockup-title">Macra · Today</span>
              </div>
              <div className="mc2-rings-top">
                <BigRing label="Protein" unit="g" value={172} goal={180} tint="#E0FE10" />
                <BigRing label="Carbs" unit="g" value={198} goal={240} tint="#06B6D4" />
                <BigRing label="Fat" unit="g" value={58} goal={70} tint="#8B5CF6" />
              </div>
              <div className="mc2-rings-kcal">
                <div>
                  <span className="mc2-rings-kcal-val">1,847</span>
                  <span className="mc2-rings-kcal-unit"> / 2,400 kcal</span>
                </div>
                <div className="mc2-rings-kcal-bar">
                  <div className="mc2-rings-kcal-fill" />
                </div>
              </div>
              <div className="mc2-rings-week">
                <span className="mc2-rings-week-label">This Week</span>
                <div className="mc2-rings-week-bars">
                  {[0.82, 0.95, 0.71, 0.88, 0.93, 0.78, 0.9].map((h, i) => (
                    <div
                      key={i}
                      className="mc2-rings-week-bar"
                      style={{ height: `${24 + h * 52}px`, animationDelay: `${0.4 + i * 0.08}s` }}
                    >
                      <span>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — Label scan (dark) ── */}
      <section className="mc2-section mc2-section--dark" id="label" data-bg="dark">
        <div className="mc2-section-inner">
          <div className="mc2-section-text mc2-reveal">
            <span
              className="mc2-section-label"
              style={{ color: '#E0FE10', background: 'rgba(224,254,16,0.08)' }}
            >
              🏷 Label OCR
            </span>
            <h2 className="mc2-h2 mc2-h2--light">
              Any nutrition label.
              <br />
              <em>Structured in a second.</em>
            </h2>
            <p className="mc2-section-sub mc2-section-sub--light">
              Scan a packaged product, a supplement jar, even a handwritten menu. Macra's OCR reads
              the Nutrition Facts panel, cross-checks the ingredient list, and pours everything
              into your log — with serving-size math already done.
            </p>
            <ul className="mc2-checklist mc2-checklist--dark">
              {[
                'Reads Nutrition Facts panels at any angle',
                'Unit-aware: grams, mL, ounces, cups — all normalized',
                'Flags hidden sugars, seed oils, and problem ingredients',
                'Saves the barcode so re-scans are a tap',
              ].map((t) => (
                <li key={t}>
                  <span className="mc2-check" style={{ color: '#E0FE10' }}>
                    ✓
                  </span>
                  <span style={{ color: '#a1a7a1' }}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mc2-section-visual mc2-reveal">
            <div className="mc2-mockup mc2-mockup--label">
              <div className="mc2-mockup-bar mc2-mockup-bar--dark">
                <div className="mc2-mockup-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="mc2-mockup-title mc2-mockup-title--dark">Label Scan · Protein Bar</span>
              </div>
              <div className="mc2-label-inner">
                <div className="mc2-label-panel">
                  <div className="mc2-label-title">Nutrition Facts</div>
                  <div className="mc2-label-serv">Serving 1 bar (60g)</div>
                  {[
                    { k: 'Calories', v: '240' },
                    { k: 'Total Fat', v: '8 g' },
                    { k: 'Carbs', v: '22 g' },
                    { k: '  Sugars', v: '2 g', sub: true },
                    { k: 'Protein', v: '20 g' },
                  ].map((row, i) => (
                    <div
                      key={row.k}
                      className={`mc2-label-row ${row.sub ? 'mc2-label-row--sub' : ''}`}
                      style={{ animationDelay: `${0.4 + i * 0.12}s` }}
                    >
                      <span>{row.k}</span>
                      <em>{row.v}</em>
                      <span className="mc2-label-ghost" />
                    </div>
                  ))}
                </div>
                <div className="mc2-label-extract">
                  <strong>Extracted</strong>
                  <div className="mc2-label-tokens">
                    {[
                      { l: 'kcal', v: 240, tint: '#FFAD30' },
                      { l: 'P', v: 20, tint: '#E0FE10' },
                      { l: 'C', v: 22, tint: '#06B6D4' },
                      { l: 'F', v: 8, tint: '#8B5CF6' },
                      { l: 'Sugar', v: 2, tint: '#EF4444' },
                    ].map((t, i) => (
                      <div
                        key={t.l}
                        className="mc2-label-token"
                        style={{
                          borderColor: `${t.tint}55`,
                          background: `${t.tint}14`,
                          color: t.tint,
                          animationDelay: `${1 + i * 0.1}s`,
                        }}
                      >
                        <em>{t.v}</em>
                        {t.l}
                      </div>
                    ))}
                  </div>
                  <div className="mc2-label-flag">
                    <span>⚠</span> Seed-oil flagged in ingredients
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="mc2-stats">
        {[
          { v: '2 sec', l: 'from photo to full macro breakdown' },
          { v: '3 meals', l: 'Nora designs around your exact daily target' },
          { v: '0 grams', l: 'of food you need to weigh manually' },
        ].map((s) => (
          <div key={s.l} className="mc2-stat">
            <div className="mc2-stat-val">{s.v}</div>
            <div className="mc2-stat-label">{s.l}</div>
          </div>
        ))}
      </section>

      {/* ── CTA ── */}
      <section className="mc2-cta" id="waitlist">
        <div className="mc2-cta-glow" />
        <div className="mc2-cta-inner">
          <h2 className="mc2-cta-h2">
            Ready to stop guessing your <em>food?</em>
          </h2>
          <p>
            Macra is rolling out to early iOS testers. Get on the list and you'll be first in when
            we open the door.
          </p>
          <div className="mc2-cta-actions">
            <a
              href="mailto:pulsefitnessapp@gmail.com?subject=Macra%20Waitlist"
              className="mc2-btn-primary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Join Waitlist
            </a>
            {onJoinWaitlist && (
              <button type="button" className="mc2-btn-secondary" onClick={onJoinWaitlist}>
                Sign Up Early →
              </button>
            )}
          </div>
          <p className="mc2-cta-note">Free during beta · iOS first · Android coming soon</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="mc2-footer">
        <div className="mc2-footer-inner">
          <div>
            <div className="mc2-logo" style={{ marginBottom: 12 }}>
              <span className="mc2-logo-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </span>
              Macra
            </div>
            <p style={{ fontSize: 14, color: '#5a5d55', maxWidth: 280, lineHeight: 1.6 }}>
              The nutrition companion from Pulse Intelligence Labs. Scan anything. Plan everything.
            </p>
          </div>
          <div className="mc2-footer-col">
            <h4>Product</h4>
            <a href="#scan">Food Scan</a>
            <a href="#nora">Nora Planner</a>
            <a href="#macros">Macros</a>
            <a href="#label">Label OCR</a>
          </div>
          <div className="mc2-footer-col">
            <h4>Pulse</h4>
            <a href="/PulseCheck">PulseCheck</a>
            <a href="/">Fit With Pulse</a>
            <a href="/about">About</a>
          </div>
        </div>
        <div className="mc2-footer-bottom">© 2026 Pulse Intelligence Labs, Inc. All rights reserved.</div>
      </footer>

      {/* ============ STYLES ============ */}
      <style>{`
        .mc2 {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          background: var(--mc2-bg, rgb(6,8,6));
          color: #111;
          overflow-x: hidden;
          transition: background 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mc2 *, .mc2 *::before, .mc2 *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── NAV ── */
        .mc2-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 56px;
          transition: padding 0.4s cubic-bezier(0.16,1,0.3,1),
                      background 0.5s cubic-bezier(0.16,1,0.3,1),
                      border-color 0.5s;
        }
        .mc2-nav--scrolled {
          background: rgba(255,255,255,calc(var(--mc2-nav-dark,0) * 0.88 + (1 - var(--mc2-nav-dark,0)) * 0.08));
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-bottom: 1px solid rgba(255,255,255,calc(0.1 - var(--mc2-nav-dark,0) * 0.06));
          padding: 14px 56px;
          box-shadow: 0 1px 0 rgba(0,0,0,calc(var(--mc2-nav-dark,0) * 0.08));
        }
        .mc2-logo {
          display: flex; align-items: center; gap: 10px;
          font-weight: 700; font-size: 18px; text-decoration: none;
          color: rgb(
            calc(255 - var(--mc2-nav-dark,0) * 249),
            calc(255 - var(--mc2-nav-dark,0) * 249),
            calc(255 - var(--mc2-nav-dark,0) * 247)
          );
          transition: color 0.4s;
        }
        .mc2-logo-mark {
          width: 32px; height: 32px; border-radius: 9px;
          background: linear-gradient(135deg, rgba(224,254,16,0.22), rgba(6,182,212,0.18));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 1px rgba(224,254,16,0.25), 0 4px 18px rgba(224,254,16,0.12);
        }
        .mc2-logo-mark svg { width: 16px; height: 16px; stroke: #E0FE10; }
        .mc2-nav-links { display: flex; align-items: center; gap: 28px; }
        .mc2-nav-links a {
          text-decoration: none; font-size: 14px; font-weight: 500;
          transition: color 0.5s;
          color: rgba(
            calc(255 - var(--mc2-nav-dark,0) * 199),
            calc(255 - var(--mc2-nav-dark,0) * 199),
            calc(255 - var(--mc2-nav-dark,0) * 199),
            0.75
          );
        }
        .mc2-nav-links a:hover { opacity: 1; color:#E0FE10; }
        .mc2-nav-login {
          border: 0; background: transparent; padding: 0;
          font-size: 14px; font-weight: 500; cursor: pointer;
          transition: color 0.5s, opacity 0.2s;
          color: rgba(
            calc(255 - var(--mc2-nav-dark,0) * 199),
            calc(255 - var(--mc2-nav-dark,0) * 199),
            calc(255 - var(--mc2-nav-dark,0) * 199),
            0.75
          );
        }
        .mc2-nav-login:hover { opacity: 1; color:#E0FE10; }
        .mc2-nav-cta {
          background: linear-gradient(135deg,#E0FE10,#06B6D4) !important;
          color: #06131a !important; padding: 9px 20px !important;
          border-radius: 8px; font-weight: 700 !important;
          opacity: 1 !important;
          box-shadow: 0 4px 20px rgba(224,254,16,0.35);
        }

        /* ── HERO ── */
        .mc2-hero {
          min-height: 100vh;
          background: transparent;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column;
        }
        .mc2-hero::before {
          content: '';
          position: absolute; top: -20%; left: 50%; transform: translateX(-50%);
          width: 1100px; height: 800px;
          background: radial-gradient(ellipse, rgba(224,254,16,0.10) 0%, transparent 65%);
          pointer-events: none;
        }
        .mc2-hero-glow {
          position: absolute; top: 40%; left: 50%;
          transform: translate(-50%,-50%);
          width: 1100px; height: 800px;
          background: radial-gradient(ellipse,
            rgba(6,182,212,0.08) 0%,
            rgba(139,92,246,0.05) 40%,
            transparent 70%);
          pointer-events: none;
          animation: mcGlowPulse 5s ease-in-out infinite;
        }
        .mc2-hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(224,254,16,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(224,254,16,0.035) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
          pointer-events: none;
          animation: mcGridDrift 24s linear infinite;
        }
        @keyframes mcGridDrift {
          from { background-position: 0 0, 0 0; }
          to   { background-position: 48px 48px, 48px 48px; }
        }
        @keyframes mcGlowPulse {
          0%,100% { opacity:0.8; transform:translate(-50%,-50%) scale(1); }
          50%      { opacity:1;   transform:translate(-50%,-50%) scale(1.08); }
        }
        .mc2-hero-inner {
          flex: 1; max-width: 1280px; margin: 0 auto; width: 100%;
          padding: 140px 56px 60px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
          position: relative; z-index: 1;
        }

        .mc2-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 7px 16px;
          border: 1px solid rgba(224,254,16,0.18); border-radius: 100px;
          font-size: 12px; color: #dfe4d6;
          background: rgba(224,254,16,0.04);
          margin-bottom: 28px;
          opacity: 0; animation: mcFadeUp 0.8s ease 0.2s forwards;
          backdrop-filter: blur(8px);
        }
        .mc2-badge-dot {
          width: 6px; height: 6px; background: #E0FE10; border-radius: 50%;
          animation: mcPulseDot 2s ease infinite;
          box-shadow: 0 0 0 0 rgba(224,254,16,0.8);
        }
        @keyframes mcPulseDot {
          0%,100% { box-shadow: 0 0 0 0 rgba(224,254,16,0.6); }
          50%      { box-shadow: 0 0 0 8px transparent; }
        }

        .mc2-h1 {
          font-size: clamp(40px,4.8vw,68px); line-height: 1.04;
          font-weight: 700; letter-spacing: -0.03em; color: #fff;
          margin-bottom: 24px;
          opacity: 0; animation: mcFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.4s forwards;
        }
        .mc2-h1 em {
          font-style: italic;
          background: linear-gradient(135deg,#E0FE10,#06B6D4 55%,#8B5CF6);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .mc2-hero-sub {
          font-size: 18px; color: rgba(255,255,255,0.6); line-height: 1.75;
          margin-bottom: 40px; max-width: 500px;
          opacity: 0; animation: mcFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.55s forwards;
        }
        .mc2-hero-ctas {
          display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 52px;
          opacity: 0; animation: mcFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.7s forwards;
        }
        .mc2-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg,#E0FE10,#06B6D4);
          color: #06131a; padding: 14px 28px; border-radius: 12px;
          font-weight: 700; font-size: 15px; text-decoration: none;
          border: none; cursor: pointer;
          box-shadow: 0 4px 24px rgba(224,254,16,0.30), 0 0 0 1px rgba(224,254,16,0.35) inset;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .mc2-btn-primary:hover { transform:translateY(-2px); box-shadow:0 12px 40px rgba(224,254,16,0.45); }
        .mc2-btn-primary svg { width: 16px; height: 16px; flex-shrink: 0; stroke: #06131a; }
        .mc2-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          color: rgba(255,255,255,0.7); background: transparent;
          padding: 14px 24px; border: 1px solid rgba(255,255,255,0.15);
          border-radius: 12px; font-size: 15px; font-weight: 500;
          text-decoration: none; cursor: pointer;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .mc2-btn-secondary:hover { color:#E0FE10; border-color:rgba(224,254,16,0.4); background:rgba(224,254,16,0.05); }
        .mc2-hero-proof {
          opacity: 0; animation: mcFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.9s forwards;
        }
        .mc2-proof-label {
          display: block; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.12em; color: rgba(255,255,255,0.35); margin-bottom: 14px;
        }
        .mc2-proof-logos { display: flex; gap: 32px; flex-wrap: wrap; }
        .mc2-proof-logo {
          font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
          color: rgba(224,254,16,0.35);
        }

        /* HERO VISUAL */
        .mc2-hero-visual {
          position: relative; display: flex; justify-content: center; align-items: center;
          opacity: 0; animation: mcFadeUp 1.1s cubic-bezier(0.16,1,0.3,1) 0.5s forwards;
          overflow: visible;
          padding: 60px 120px;
        }
        .mc2-phone {
          width: 300px; height: 620px;
          background: linear-gradient(180deg,#111214 0%,#0c0d0f 100%);
          border-radius: 44px;
          border: 1.5px solid rgba(224,254,16,0.12);
          box-shadow:
            0 0 0 1px rgba(224,254,16,0.05),
            0 40px 80px rgba(0,0,0,0.7),
            0 0 60px rgba(224,254,16,0.08),
            inset 0 1px 0 rgba(255,255,255,0.08);
          position: relative; overflow: hidden; z-index: 2;
          will-change: transform;
        }
        .mc2-phone-notch {
          width: 100px; height: 28px; background: #111214;
          border-radius: 0 0 18px 18px;
          position: absolute; top: 0; left: 50%; transform: translateX(-50%); z-index: 3;
        }
        .mc2-phone-screen {
          position: absolute; inset: 12px 8px 8px;
          border-radius: 34px; overflow: hidden;
          background: radial-gradient(ellipse at 50% 30%, rgba(224,254,16,0.06), #05080a 60%);
          display: flex; flex-direction: column;
          padding: 36px 14px 14px;
        }
        .mc2-app-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .mc2-app-logo { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#fff; }
        .mc2-app-live { font-size:9px; color:#E0FE10; font-weight:800; letter-spacing:0.09em; animation: mcPulseDot 1.6s ease infinite; }

        /* Scan stage */
        .mc2-scan-stage {
          flex: 1; position: relative; border-radius: 22px;
          background:
            radial-gradient(circle at 50% 40%, rgba(224,254,16,0.08), transparent 55%),
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005));
          border: 1px solid rgba(224,254,16,0.10);
          overflow: hidden;
          display: flex; flex-direction: column;
        }
        .mc2-scan-subject {
          position: absolute; top: 32%; left: 50%;
          transform: translate(-50%,-50%) scale(1);
          font-size: 92px;
          transition: transform 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.4s;
          z-index: 2;
        }
        .mc2-scan-emoji { display: inline-block; filter: drop-shadow(0 6px 20px rgba(0,0,0,0.6)); }
        .mc2-scan-subject--step4 .mc2-scan-emoji { animation: mcPop 0.5s ease; }
        .mc2-scan-subject--step5 { transform: translate(-50%,-50%) scale(0.75); opacity: 0.6; }
        @keyframes mcPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.2); filter: drop-shadow(0 0 22px #E0FE10); }
          100% { transform: scale(1); }
        }
        .mc2-scan-particles { position: absolute; inset: 0; pointer-events: none; }
        .mc2-scan-particle {
          position: absolute; top: 50%; left: 50%;
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--tint,#E0FE10);
          opacity: 0;
        }
        .mc2-scan-subject--step4 .mc2-scan-particle {
          animation: mcBurst 0.9s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes mcBurst {
          0%   { opacity: 0; transform: translate(-50%,-50%) rotate(var(--angle)) translate(0); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%,-50%) rotate(var(--angle)) translate(68px); }
        }

        /* Scan grid overlay */
        .mc2-scan-grid {
          position: absolute; left: 14%; right: 14%; top: 12%; bottom: 38%;
          border: 1px dashed rgba(224,254,16,0.25);
          border-radius: 14px;
          opacity: 0;
          transition: opacity 0.35s, inset 0.5s cubic-bezier(0.22,1,0.36,1), border-color 0.3s;
          z-index: 3;
        }
        .mc2-scan-grid::before,
        .mc2-scan-grid::after {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(224,254,16,0.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(224,254,16,0.14) 1px, transparent 1px);
          background-size: 22px 22px;
          border-radius: 14px;
          opacity: 0.8;
        }
        .mc2-scan-grid--on { opacity: 1; }
        .mc2-scan-grid--lock {
          left: 20%; right: 20%; top: 18%; bottom: 44%;
          border-color: #E0FE10;
          box-shadow: 0 0 0 2px rgba(224,254,16,0.12), 0 0 24px rgba(224,254,16,0.25);
        }
        .mc2-scan-line {
          position: absolute; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #E0FE10, transparent);
          box-shadow: 0 0 12px rgba(224,254,16,0.8);
          animation: mcScanLine 1.8s cubic-bezier(0.45,0,0.55,1) infinite;
          z-index: 2;
        }
        @keyframes mcScanLine {
          0%   { top: 0;    opacity: 0; }
          10%  { opacity: 1; }
          50%  { top: 100%; opacity: 1; }
          60%  { opacity: 0; }
          100% { top: 100%; opacity: 0; }
        }
        .mc2-scan-corner {
          position: absolute; width: 14px; height: 14px;
          border-color: #E0FE10; border-style: solid; border-width: 0;
        }
        .mc2-scan-corner--tl { top:-2px; left:-2px; border-top-width:2px; border-left-width:2px; border-top-left-radius:4px; }
        .mc2-scan-corner--tr { top:-2px; right:-2px; border-top-width:2px; border-right-width:2px; border-top-right-radius:4px; }
        .mc2-scan-corner--bl { bottom:-2px; left:-2px; border-bottom-width:2px; border-left-width:2px; border-bottom-left-radius:4px; }
        .mc2-scan-corner--br { bottom:-2px; right:-2px; border-bottom-width:2px; border-right-width:2px; border-bottom-right-radius:4px; }

        .mc2-scan-label {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          background: rgba(8,12,10,0.85); backdrop-filter: blur(12px);
          border: 1px solid rgba(224,254,16,0.35);
          color: #fff; font-size: 11px; padding: 6px 12px; border-radius: 100px;
          display: flex; align-items: center; gap: 6px; white-space: nowrap;
          z-index: 4;
          animation: mcFadeUp 0.5s ease forwards;
        }
        .mc2-scan-label strong { color: #E0FE10; font-weight: 700; }
        .mc2-scan-label span:last-child { color: rgba(255,255,255,0.45); }
        .mc2-scan-label-dot { width: 7px; height: 7px; border-radius: 50%; }

        .mc2-scan-macros {
          position: absolute; left: 14px; right: 14px; bottom: 50px;
          background: rgba(12,15,13,0.85); backdrop-filter: blur(12px);
          border: 1px solid rgba(224,254,16,0.15);
          border-radius: 16px; padding: 12px;
          display: flex; gap: 12px; align-items: center;
          animation: mcFadeUp 0.6s ease forwards;
          z-index: 4;
        }
        .mc2-scan-kcal { display: flex; flex-direction: column; align-items: center; min-width: 60px;
          padding-right: 12px; border-right: 1px solid rgba(255,255,255,0.08); }
        .mc2-scan-kcal-val { font-size: 22px; font-weight: 700; color: #E0FE10; line-height: 1; }
        .mc2-scan-kcal-label { font-size: 9px; color: rgba(255,255,255,0.45); margin-top: 2px; letter-spacing: 0.08em; }
        .mc2-scan-macro-grid { flex: 1; display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }

        .mc2-scan-toast {
          position: absolute; bottom: 12px; left: 14px; right: 14px;
          background: linear-gradient(90deg, rgba(224,254,16,0.15), rgba(34,197,94,0.15));
          border: 1px solid rgba(34,197,94,0.35);
          color: #d5ffab; font-size: 11px; font-weight: 600;
          padding: 8px 12px; border-radius: 10px;
          display: flex; align-items: center; gap: 8px;
          animation: mcFadeUp 0.4s ease forwards;
          z-index: 4;
        }
        .mc2-scan-toast span { color: #22C55E; font-weight: 800; }

        /* macro mini bar */
        .mc2-macro {
          display: flex; flex-direction: column; align-items: center;
          padding: 4px;
        }
        .mc2-macro-label { font-size: 9px; color: rgba(255,255,255,0.5); font-weight: 700; letter-spacing: 0.1em; }
        .mc2-macro-val { font-size: 14px; font-weight: 700; }
        .mc2-macro-bar { height: 3px; width: 100%; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 4px; overflow: hidden; }
        .mc2-macro-bar-fill { height: 100%; border-radius: 2px; animation: mcBarFillAny 1s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes mcBarFillAny { from { width: 0%; } }

        /* ── Float cards ── */
        .mc2-float-card {
          position: absolute;
          background: rgba(10,14,11,0.7);
          backdrop-filter: blur(32px) saturate(180%);
          -webkit-backdrop-filter: blur(32px) saturate(180%);
          border: 1px solid rgba(224,254,16,0.12);
          border-radius: 18px; padding: 13px 18px;
          display: flex; align-items: center; gap: 13px;
          box-shadow: 0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
          z-index: 10; white-space: nowrap;
          will-change: transform;
          opacity: 0; animation: mcFadeUp 1.2s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .mc2-float-card strong { display:block; font-size:13px; color:#fff; font-weight:600; }
        .mc2-float-card span { font-size:11px; color:rgba(255,255,255,0.5); }
        .mc2-fc-icon { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; overflow:hidden; }
        .mc2-float-card--tl { top: -18px;   left: -120px; animation-delay: 0.9s; }
        .mc2-float-card--r  { top: 36%;     right: -60px; animation-delay: 1.15s; }
        .mc2-float-card--ml { top: 42%;     left: -120px; animation-delay: 1.3s; }
        .mc2-float-card--bl { bottom: 120px;left: -115px; animation-delay: 1.55s; }

        .mc2-fc-bar-wrap { height:3px; background:rgba(255,255,255,0.08); border-radius:4px; margin-top:7px; width:130px; overflow:hidden; }
        .mc2-fc-bar { height:100%; border-radius:4px; width:0%; animation: mcBarFill 2s cubic-bezier(0.22,1,0.36,1) 1.8s forwards; }
        @keyframes mcBarFill { to { width:78%; } }

        .mc2-fc-ping {
          position:absolute; top:5px; right:5px;
          width:7px; height:7px; border-radius:50%; background:#E0FE10;
          animation: mcPingDot 2s ease-in-out infinite;
        }
        @keyframes mcPingDot {
          0%,100% { box-shadow:0 0 0 0 rgba(224,254,16,0.7); }
          50%      { box-shadow:0 0 0 6px rgba(224,254,16,0); }
        }
        .mc2-ticker { color: #E0FE10; font-weight: 700; }

        .mc2-fc-ring-wrap { position:relative; width:44px; height:44px; flex-shrink:0; }
        .mc2-fc-ring-svg  { position:absolute; top:0; left:0; transform:rotate(-90deg); }
        .mc2-fc-ring-arc  {
          stroke-dashoffset: 106.8;
          animation: mcRingFill 2.2s cubic-bezier(0.22,1,0.36,1) 1.9s forwards;
        }
        @keyframes mcRingFill { to { stroke-dashoffset: 18; } }
        .mc2-fc-ring-label {
          position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
          font-size:13px; font-weight:700; color:#E0FE10;
        }
        .mc2-fc-elite { font-size:11px; color:#E0FE10; display:block; margin-top:2px; font-weight:500; }

        .mc2-fc-streak-wrap { position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .mc2-fc-streak-ring {
          position:absolute; inset:0; border-radius:50%;
          border:2px solid rgba(224,254,16,0.4);
          animation: mcBreath 4s ease-in-out infinite;
        }
        @keyframes mcBreath {
          0%,100% { transform:scale(1);   box-shadow: 0 0 0 0   rgba(224,254,16,0.3); border-color:rgba(224,254,16,0.4); }
          50%      { transform:scale(1.28); box-shadow: 0 0 16px 4px rgba(224,254,16,0.15); border-color:rgba(224,254,16,0.85); }
        }
        .mc2-fc-streak-icon { font-size:18px; position:relative; z-index:1; }
        .mc2-up { color:#E0FE10; font-weight:700; }

        @keyframes mcFadeUp {
          from { opacity:0; transform:translateY(22px); }
          to   { opacity:1; transform:translateY(0); }
        }

        /* ── SECTIONS ── */
        .mc2-section { padding: 110px 56px; position: relative; }
        .mc2-section--light::before,
        .mc2-section--offwhite::before {
          content: ''; position: absolute; inset: 0;
          background: rgba(255,255,255,0.60);
          pointer-events: none; z-index: 0;
        }
        .mc2-section--light::after {
          content: ''; position: absolute; top: -80px; left: 0; right: 0; height: 80px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.55));
          pointer-events: none; z-index: 0;
        }
        .mc2-section--offwhite::before { background: rgba(244,247,238,0.6); }
        .mc2-section--offwhite::after {
          content: ''; position: absolute; top: -80px; left: 0; right: 0; height: 80px;
          background: linear-gradient(to bottom, transparent, rgba(244,247,238,0.6));
          pointer-events: none; z-index: 0;
        }
        .mc2-section--dark::before {
          content: ''; position: absolute; top: -100px; left: 0; right: 0; height: 100px;
          background: linear-gradient(to bottom, transparent, rgba(6,8,6,0.65));
          pointer-events: none; z-index: 0;
        }
        .mc2-section-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
          position: relative; z-index: 1;
        }
        .mc2-section-inner--flip .mc2-section-text { order:2; }
        .mc2-section-inner--flip .mc2-section-visual { order:1; }

        .mc2-section-label {
          display: inline-block; padding: 5px 12px;
          background: rgba(224,254,16,0.09); color:#0b8f20; border-radius: 20px;
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; margin-bottom: 20px;
        }
        .mc2-h2 {
          font-size: clamp(30px,3.4vw,52px); line-height: 1.08; font-weight: 700;
          letter-spacing: -0.025em; color: #0a0d08; margin-bottom: 20px;
        }
        .mc2-h2 em {
          font-style:italic;
          background: linear-gradient(135deg,#16a34a,#06B6D4 60%,#8B5CF6);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .mc2-h2--light { color:#fff; }
        .mc2-h2--light em {
          background: linear-gradient(135deg,#E0FE10,#06B6D4 55%,#8B5CF6);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .mc2-section-sub { font-size:17px; color:#3f4a3a; line-height:1.75; margin-bottom:32px; }
        .mc2-section-sub--light { color:rgba(255,255,255,0.6); }
        .mc2-checklist { list-style:none; display:flex; flex-direction:column; gap:13px; }
        .mc2-checklist li { display:flex; align-items:flex-start; gap:10px; font-size:15px; color:#223; line-height:1.55; }
        .mc2-checklist--dark li { color:rgba(255,255,255,0.65); }
        .mc2-check { font-size:14px; color:#16a34a; font-weight:800; flex-shrink:0; margin-top:2px; }

        .mc2-reveal {
          opacity: 0;
          transform: translateY(36px) scale(0.98);
          transition:
            opacity 0.85s cubic-bezier(0.16,1,0.3,1),
            transform 0.85s cubic-bezier(0.16,1,0.3,1);
        }
        .mc2-reveal:nth-child(2) { transition-delay: 0.1s; }
        .mc2-reveal:nth-child(3) { transition-delay: 0.2s; }
        .mc2-visible { opacity:1; transform:translateY(0) scale(1); }

        /* ── MOCKUPS ── */
        .mc2-mockup {
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(180,195,175,0.5);
          border-radius: 20px; overflow: hidden;
          box-shadow:
            0 2px 0 rgba(255,255,255,0.8) inset,
            0 30px 80px rgba(0,0,0,0.12),
            0 6px 20px rgba(0,0,0,0.06);
        }
        .mc2-mockup-bar {
          display:flex; align-items:center; gap:8px;
          padding:12px 18px; border-bottom:1px solid rgba(0,0,0,0.06);
          background: rgba(250,253,245,0.9);
        }
        .mc2-mockup-dots { display:flex; gap:6px; }
        .mc2-mockup-dots span { width:11px; height:11px; border-radius:50%; }
        .mc2-mockup-dots span:nth-child(1){background:#ff5f57;}
        .mc2-mockup-dots span:nth-child(2){background:#febc2e;}
        .mc2-mockup-dots span:nth-child(3){background:#28c840;}
        .mc2-mockup-title { font-size:11px; color:#9aa293; margin-left:6px; font-family:ui-monospace,monospace; }
        .mc2-mockup-bar--dark { background:rgba(12,14,12,0.95); border-bottom-color:rgba(255,255,255,0.05); }
        .mc2-mockup-title--dark { color:rgba(224,254,16,0.5); }
        .mc2-mockup--label { background:rgba(10,12,10,0.95); border-color:rgba(224,254,16,0.08); }

        /* ── Scan mockup (Section 1) ── */
        .mc2-scan-board { display: grid; grid-template-columns: 1.1fr 1fr; gap: 0; min-height: 420px; }
        .mc2-scan-board-plate {
          position: relative;
          background:
            radial-gradient(ellipse at 50% 50%, rgba(224,254,16,0.06), transparent 55%),
            linear-gradient(135deg, #f5f9ed, #e9f0dc);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .mc2-scan-board-plate::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(16,185,129,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.08) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .mc2-scan-board-plate-emoji { font-size: 170px; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.12)); position: relative; z-index: 1; }
        .mc2-scan-pin {
          position: absolute;
          display: flex; align-items: center; gap: 6px;
          background: rgba(10,14,10,0.92);
          color: #fff; font-size: 10px; font-weight: 600;
          padding: 4px 8px; border-radius: 100px;
          border: 1px solid rgba(224,254,16,0.4);
          transform: translate(-50%,-50%) scale(0.6); opacity: 0;
          animation: mcPinIn 0.6s cubic-bezier(0.22,1,0.36,1) forwards;
          z-index: 2;
          box-shadow: 0 6px 20px rgba(0,0,0,0.25);
        }
        @keyframes mcPinIn {
          to { transform: translate(-50%,-50%) scale(1); opacity: 1; }
        }
        .mc2-scan-pin-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #E0FE10;
          box-shadow: 0 0 0 3px rgba(224,254,16,0.3);
          animation: mcPulseDot 2s ease infinite;
        }
        .mc2-scan-items { display: flex; flex-direction: column; }
        .mc2-scan-item {
          display: grid; grid-template-columns: 36px 1fr auto; gap: 12px;
          align-items: center; padding: 14px 18px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          border-left: 3px solid;
          opacity: 0; transform: translateX(12px);
          animation: mcScanItemIn 0.6s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes mcScanItemIn { to { opacity: 1; transform: translateX(0); } }
        .mc2-scan-item-emoji { font-size: 28px; }
        .mc2-scan-item strong { display: block; font-size: 14px; font-weight: 600; color: #0a0d08; }
        .mc2-scan-item span { font-size: 11px; color: #6b7a63; }
        .mc2-scan-item-macros { text-align: right; font-size: 11px; color: #6b7a63; }
        .mc2-scan-item-macros em { display: block; font-size: 17px; font-weight: 700; font-style: normal; color: #0a0d08; line-height: 1; margin-bottom: 2px; }
        .mc2-scan-total {
          margin-top: auto;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px;
          background: linear-gradient(90deg, rgba(224,254,16,0.12), rgba(6,182,212,0.08));
          border-top: 1px solid rgba(224,254,16,0.25);
        }
        .mc2-scan-total span { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #4a5a42; font-weight: 700; }
        .mc2-scan-total strong { font-size: 14px; font-weight: 700; color: #0a0d08; }

        /* ── Nora mockup ── */
        .mc2-nora-chat { padding: 22px; display: flex; flex-direction: column; gap: 14px; }
        .mc2-nora-typing { display: flex; align-items: flex-start; gap: 10px; }
        .mc2-nora-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg,#8B5CF6,#06B6D4);
          color: #fff; font-weight: 800; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(139,92,246,0.18);
        }
        .mc2-nora-bubble {
          background: rgba(139,92,246,0.08);
          border: 1px solid rgba(139,92,246,0.2);
          border-radius: 14px; border-top-left-radius: 4px;
          padding: 12px 14px;
          font-size: 13px; color: #3a2f55; font-weight: 500;
          display: flex; flex-direction: column; gap: 8px;
        }
        .mc2-nora-dots { display: flex; gap: 4px; }
        .mc2-nora-dots span {
          width: 6px; height: 6px; border-radius: 50%; background: #8B5CF6;
          opacity: 0.3;
          animation: mcTypeDot 1.3s ease infinite;
        }
        .mc2-nora-dots span:nth-child(2) { animation-delay: 0.15s; }
        .mc2-nora-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes mcTypeDot {
          0%,60%,100% { opacity: 0.3; transform: scale(1); }
          30%         { opacity: 1;   transform: scale(1.3); }
        }
        .mc2-nora-meal {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.05);
          border-left: 4px solid;
          border-radius: 12px;
          padding: 14px 16px;
          opacity: 0; transform: translateY(12px);
          animation: mcScanItemIn 0.6s cubic-bezier(0.22,1,0.36,1) forwards;
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
        }
        .mc2-nora-meal-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .mc2-nora-meal-tag {
          font-size: 10px; font-weight: 800;
          padding: 3px 9px; border-radius: 6px;
          letter-spacing: 0.06em;
        }
        .mc2-nora-meal-head strong { font-size: 14px; font-weight: 600; color: #0a0d08; }
        .mc2-nora-meal-macros { display: flex; gap: 14px; align-items: baseline; font-size: 11px; color: #6b7a63; font-weight: 600; }
        .mc2-nora-meal-macros em { font-size: 16px; font-weight: 700; font-style: normal; color: #0a0d08; margin-right: 2px; }
        .mc2-nora-meal-bar { height: 4px; background: rgba(0,0,0,0.05); border-radius: 2px; margin-top: 10px; overflow: hidden; }
        .mc2-nora-meal-bar-fill {
          height: 100%;
          width: 0%; border-radius: 2px;
          animation: mcMealBar 1.2s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes mcMealBar {
          from { width: 0%; }
        }
        .mc2-nora-summary {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; margin-top: 6px;
          background: linear-gradient(90deg, rgba(224,254,16,0.12), rgba(139,92,246,0.08));
          border: 1px solid rgba(224,254,16,0.35);
          border-radius: 12px;
          font-size: 13px; color: #0a0d08;
        }
        .mc2-nora-summary strong { font-weight: 700; }
        .mc2-nora-summary span:nth-child(2) { color: #4a5a42; flex: 1; font-weight: 500; }
        .mc2-nora-match { color: #16a34a; font-weight: 700; font-size: 12px; }

        /* ── Rings mockup ── */
        .mc2-rings-top {
          display: grid; grid-template-columns: repeat(3,1fr);
          gap: 14px; padding: 28px 22px 18px;
        }
        .mc2-big-ring {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        .mc2-big-ring-wrap { position: relative; width: 120px; height: 120px; }
        .mc2-big-ring-svg { transform: rotate(-90deg); }
        .mc2-big-ring-label {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .mc2-big-ring-label-val { font-size: 24px; font-weight: 700; color: #0a0d08; line-height: 1; }
        .mc2-big-ring-label-unit { font-size: 10px; color: #6b7a63; margin-top: 4px; letter-spacing: 0.08em; text-transform: uppercase; }
        .mc2-big-ring-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
        .mc2-big-ring-goal { font-size: 11px; color: #6b7a63; }

        .mc2-rings-kcal {
          margin: 0 22px;
          padding: 16px 18px;
          background: linear-gradient(90deg, rgba(224,254,16,0.08), rgba(6,182,212,0.04));
          border: 1px solid rgba(224,254,16,0.2);
          border-radius: 12px;
        }
        .mc2-rings-kcal-val { font-size: 28px; font-weight: 700; color: #0a0d08; }
        .mc2-rings-kcal-unit { font-size: 13px; color: #6b7a63; font-weight: 500; }
        .mc2-rings-kcal-bar { height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden; margin-top: 10px; }
        .mc2-rings-kcal-fill {
          height: 100%;
          background: linear-gradient(90deg,#E0FE10,#06B6D4);
          border-radius: 3px;
          width: 0;
          animation: mcKcalFill 2s cubic-bezier(0.22,1,0.36,1) 0.4s forwards;
        }
        @keyframes mcKcalFill { to { width: 77%; } }

        .mc2-rings-week { padding: 18px 22px 26px; }
        .mc2-rings-week-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7a63; }
        .mc2-rings-week-bars { display: grid; grid-template-columns: repeat(7,1fr); gap: 8px; margin-top: 12px; align-items: end; height: 90px; }
        .mc2-rings-week-bar {
          position: relative;
          background: linear-gradient(180deg,#E0FE10,#06B6D4);
          border-radius: 4px;
          opacity: 0;
          transform-origin: bottom;
          animation: mcBarH 0.8s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        .mc2-rings-week-bar span {
          position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%);
          font-size: 10px; color: #6b7a63; font-weight: 700;
        }
        @keyframes mcBarH {
          from { opacity: 0; transform: scaleY(0); }
          to   { opacity: 1; transform: scaleY(1); }
        }

        /* ── Label mockup ── */
        .mc2-label-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .mc2-label-panel {
          padding: 20px 22px;
          background: rgba(18,22,18,0.9);
          border-right: 1px solid rgba(224,254,16,0.08);
          position: relative;
        }
        .mc2-label-title { font-family: 'Helvetica Neue', Helvetica, sans-serif; font-weight: 900; font-size: 18px; color: #E0FE10; letter-spacing: -0.01em; padding-bottom: 6px; border-bottom: 4px solid #E0FE10; margin-bottom: 10px; }
        .mc2-label-serv { font-size: 11px; color: rgba(255,255,255,0.45); margin-bottom: 12px; }
        .mc2-label-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.08);
          font-size: 13px; color: rgba(255,255,255,0.8);
          position: relative;
          opacity: 0;
          animation: mcFadeUp 0.5s ease forwards;
        }
        .mc2-label-row em { font-style: normal; font-weight: 700; color: #fff; }
        .mc2-label-row--sub { padding-left: 12px; font-size: 12px; color: rgba(255,255,255,0.55); }
        .mc2-label-ghost {
          position: absolute; right: -6px; top: 50%; width: 6px; height: 6px;
          border-radius: 50%; background: #E0FE10;
          transform: translateY(-50%);
          box-shadow: 0 0 0 3px rgba(224,254,16,0.25);
          animation: mcPingDot 1.6s ease infinite;
        }
        .mc2-label-extract {
          padding: 20px 22px;
          background: rgba(10,12,10,0.95);
        }
        .mc2-label-extract strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(224,254,16,0.75); margin-bottom: 14px; }
        .mc2-label-tokens { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
        .mc2-label-token {
          padding: 12px 14px; border-radius: 12px; border: 1px solid;
          font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
          display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
          opacity: 0; transform: translateY(8px);
          animation: mcScanItemIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        .mc2-label-token em { font-size: 20px; font-weight: 800; font-style: normal; line-height: 1; }
        .mc2-label-flag {
          margin-top: 14px; padding: 10px 14px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px;
          font-size: 12px; color: #fca5a5;
          display: flex; align-items: center; gap: 8px;
        }
        .mc2-label-flag span { font-size: 14px; }

        /* STATS */
        .mc2-stats {
          display: grid; grid-template-columns: repeat(3,1fr);
          gap: 1px; background: rgba(224,254,16,0.06);
          position: relative; z-index: 1;
        }
        .mc2-stat { padding:64px 40px; text-align:center; background: var(--mc2-bg, rgb(6,8,6)); }
        .mc2-stat-val { font-size:54px; font-weight:700; color:#E0FE10; line-height:1; margin-bottom:16px; letter-spacing:-0.02em; text-shadow: 0 0 30px rgba(224,254,16,0.35); }
        .mc2-stat-label { font-size:14px; color:rgba(255,255,255,0.4); max-width:240px; margin:0 auto; line-height:1.6; }

        /* CTA */
        .mc2-cta { padding: 130px 56px; text-align: center; position: relative; overflow: hidden; }
        .mc2-cta-glow {
          position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
          width:900px; height:600px;
          background:radial-gradient(ellipse,rgba(224,254,16,0.12) 0%,rgba(6,182,212,0.05) 40%,transparent 70%);
          pointer-events:none; animation:mcGlowPulse 5s ease-in-out infinite;
        }
        .mc2-cta-inner { position:relative; max-width:680px; margin:0 auto; }
        .mc2-cta-h2 { font-size:clamp(30px,4vw,54px); font-weight:700; color:#fff; line-height:1.1; letter-spacing:-0.025em; margin-bottom:20px; }
        .mc2-cta-h2 em { font-style:italic; background:linear-gradient(135deg,#E0FE10,#06B6D4); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .mc2-cta p { font-size:18px; color:rgba(255,255,255,0.5); margin-bottom:40px; line-height:1.75; }
        .mc2-cta-actions { display:flex; justify-content:center; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
        .mc2-cta-note { font-size:13px; color:rgba(255,255,255,0.3); }

        /* FOOTER */
        .mc2-footer { padding:72px 56px 40px; border-top:1px solid rgba(224,254,16,0.08); }
        .mc2-footer-inner { max-width:1100px; margin:0 auto; display:grid; grid-template-columns:2fr 1fr 1fr; gap:48px; margin-bottom:48px; }
        .mc2-footer-col h4 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:rgba(224,254,16,0.5); margin-bottom:16px; }
        .mc2-footer-col a { display:block; font-size:14px; color:rgba(255,255,255,0.4); text-decoration:none; margin-bottom:10px; transition:color 0.2s; }
        .mc2-footer-col a:hover { color:#E0FE10; }
        .mc2-footer-bottom { max-width:1100px; margin:0 auto; padding-top:24px; border-top:1px solid rgba(224,254,16,0.05); font-size:13px; color:rgba(255,255,255,0.25); text-align:center; }

        /* RESPONSIVE */
        @media(max-width:1000px){
          .mc2-hero-inner{grid-template-columns:1fr;gap:40px;padding:120px 32px 80px;}
          .mc2-hero-visual{ display:flex; justify-content:center; padding:0; margin-bottom:60px; }
          .mc2-float-card--tl,
          .mc2-float-card--r,
          .mc2-float-card--ml,
          .mc2-float-card--bl { display: none; }
          .mc2-phone { width:280px; height:580px; }
          .mc2-section-inner{grid-template-columns:1fr;}
          .mc2-section-inner--flip .mc2-section-text,.mc2-section-inner--flip .mc2-section-visual{order:unset;}
          .mc2-stats{grid-template-columns:1fr;}
          .mc2-footer-inner{grid-template-columns:1fr 1fr;}
          .mc2-scan-board { grid-template-columns: 1fr; }
          .mc2-label-inner { grid-template-columns: 1fr; }
        }
        @media(max-width:700px){
          .mc2-nav{padding:14px 20px;}
          .mc2-nav--scrolled{padding:12px 20px;}
          .mc2-nav-links a:not(.mc2-nav-cta){display:none;}
          .mc2-nav-login{display:none;}
          .mc2-section{padding:80px 24px;}
          .mc2-hero-inner{padding:90px 24px 60px;}
          .mc2-phone { width:240px; height:500px; }
          .mc2-cta{padding:90px 24px;}
          .mc2-footer{padding:48px 24px 32px;}
          .mc2-footer-inner{grid-template-columns:1fr;gap:32px;}
          .mc2-rings-top { gap: 6px; padding: 20px 14px; }
          .mc2-big-ring-wrap { width: 96px; height: 96px; }
        }
      `}</style>
    </div>
  );
};

/* ── inline subcomponents ── */
const Macro: React.FC<{ label: string; value: number; tint: string }> = ({ label, value, tint }) => (
  <div className="mc2-macro">
    <span className="mc2-macro-label" style={{ color: tint }}>
      {label}
    </span>
    <span className="mc2-macro-val" style={{ color: '#fff' }}>
      {value}
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>g</span>
    </span>
    <div className="mc2-macro-bar">
      <div
        className="mc2-macro-bar-fill"
        style={{ background: tint, width: `${Math.min(100, (value / 60) * 100)}%` }}
      />
    </div>
  </div>
);

const BigRing: React.FC<{ label: string; unit: string; value: number; goal: number; tint: string }> = ({
  label,
  unit,
  value,
  goal,
  tint,
}) => {
  const pct = Math.min(1, value / goal);
  const C = 2 * Math.PI * 52;
  const offset = C * (1 - pct);
  return (
    <div className="mc2-big-ring">
      <div className="mc2-big-ring-wrap">
        <svg width="120" height="120" className="mc2-big-ring-svg">
          <circle cx="60" cy="60" r="52" stroke="rgba(0,0,0,0.06)" strokeWidth="10" fill="none" />
          <circle
            cx="60"
            cy="60"
            r="52"
            stroke={tint}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1.6s cubic-bezier(0.22,1,0.36,1)',
              filter: `drop-shadow(0 0 6px ${tint}55)`,
            }}
          />
        </svg>
        <div className="mc2-big-ring-label">
          <span className="mc2-big-ring-label-val">{value}</span>
          <span className="mc2-big-ring-label-unit">{unit}</span>
        </div>
      </div>
      <span className="mc2-big-ring-title" style={{ color: tint }}>
        {label}
      </span>
      <span className="mc2-big-ring-goal">of {goal}g</span>
    </div>
  );
};

export default MacraMarketingLanding;
