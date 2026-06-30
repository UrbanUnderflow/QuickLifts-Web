import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CalendarDays, Dumbbell, Sparkles, Trophy, Users, Utensils } from 'lucide-react';
import PageHead from '../PageHead';

type ProductLandingFeature = {
  title: string;
  body: string;
  Icon: React.ComponentType<{ className?: string }>;
};

type ProductLandingProps = {
  productName: string;
  eyebrow: string;
  headline: string;
  body: string;
  accent: string;
  pageTitle: string;
  metaDescription: string;
  pageOgUrl: string;
  heroMedia: {
    src: string;
    type: 'image' | 'video';
  };
  screenshots: Array<{
    src: string;
    alt: string;
  }>;
  features: ProductLandingFeature[];
  primaryHref: string;
  primaryLabel: string;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

const ProductLandingShell: React.FC<ProductLandingProps> = ({
  productName,
  eyebrow,
  headline,
  body,
  accent,
  pageTitle,
  metaDescription,
  pageOgUrl,
  heroMedia,
  screenshots,
  features,
  primaryHref,
  primaryLabel,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const currentScrollRef = useRef(0);
  const targetScrollRef = useRef(0);
  const [scrollY, setScrollY] = useState(0);
  const isPrimaryExternal = primaryHref.startsWith('http') || primaryHref.startsWith('mailto:');
  const primaryClassName = 'pl-btn-primary';
  const primaryStyle = { backgroundColor: accent };
  const navScrolled = scrollY > 60;
  const FirstFeatureIcon = features[0]?.Icon || Sparkles;

  const tick = useCallback(() => {
    targetScrollRef.current = typeof window !== 'undefined' ? window.scrollY : 0;
    currentScrollRef.current = lerp(currentScrollRef.current, targetScrollRef.current, 0.06);
    const nextScroll = currentScrollRef.current;
    setScrollY(nextScroll);

    const wrapper = wrapperRef.current;
    if (wrapper) {
      const phone = wrapper.querySelector<HTMLElement>('.pl-phone');
      if (phone) phone.style.transform = `translateY(${-nextScroll * 0.055}px) rotate(-1.5deg)`;

      wrapper.querySelectorAll<HTMLElement>('.pl-float-card').forEach((card, index) => {
        const direction = index % 2 === 0 ? -1 : 1;
        card.style.transform = `translateY(${nextScroll * 0.035 * direction * (index + 1)}px)`;
      });
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('pl-visible');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.pl-reveal').forEach((element) => observer.observe(element));

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [tick]);

  const primaryContent = (
    <>
      {primaryLabel}
      <ArrowUpRight className="h-4 w-4" />
    </>
  );

  return (
    <div
      ref={wrapperRef}
      className="pl-shell min-h-screen overflow-x-hidden text-white selection:bg-white/20"
      style={{
        '--pl-accent': accent,
        '--pl-accent-soft': `${accent}24`,
        '--pl-accent-faint': `${accent}12`,
      } as React.CSSProperties}
    >
      <PageHead
        metaData={{
          pageId: productName.toLowerCase().replace(/\s+/g, '-'),
          pageTitle,
          metaDescription,
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl={pageOgUrl}
        pageOgImage="/pil-og.png"
        themeColor="#050505"
      />

      <header className={`pl-nav ${navScrolled ? 'pl-nav--scrolled' : ''}`}>
        <div className="pl-nav-inner">
          <Link href="/" className="pl-back-link">
            <ArrowLeft className="h-4 w-4" />
            Pulse Intelligence Labs
          </Link>
          <nav className="pl-nav-links" aria-label={`${productName} navigation`}>
            <a href="#how-it-works">How it works</a>
            <a href="#screens">Screens</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="pl-hero">
          {heroMedia.type === 'video' ? (
            <video
              className="pl-hero-media"
              src={heroMedia.src}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
            />
          ) : (
            <img
              src={heroMedia.src}
              alt=""
              className="pl-hero-media"
              draggable={false}
            />
          )}
          <div className="pl-hero-scrim" />
          <div className="pl-hero-grid" />
          <div className="pl-hero-glow" />

          <div className="pl-hero-inner">
            <div className="pl-hero-text">
              <div className="pl-badge">
                <span className="pl-badge-dot" />
                {eyebrow}
              </div>
              <h1 className="pl-h1">
                {headline}
              </h1>
              <p className="pl-hero-sub">
                {body}
              </p>
              <div className="pl-hero-ctas">
                {isPrimaryExternal ? (
                  <a href={primaryHref} className={primaryClassName} style={primaryStyle}>
                    {primaryContent}
                  </a>
                ) : (
                  <Link href={primaryHref} className={primaryClassName} style={primaryStyle}>
                    {primaryContent}
                  </Link>
                )}
                <a
                  href="mailto:hello@fitwithpulse.ai?subject=Demo%20Request"
                  className="pl-btn-secondary"
                >
                  Request a Demo
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="pl-hero-visual" aria-hidden="true">
              <div className="pl-float-card pl-float-card--top">
                <div className="pl-float-icon">
                  <FirstFeatureIcon className="h-5 w-5" />
                </div>
                <div>
                  <strong>{features[0].title}</strong>
                  <span>{productName}</span>
                </div>
              </div>
              <div className="pl-phone">
                <div className="pl-phone-notch" />
                <div className="pl-phone-screen">
                  <img src={screenshots[0].src} alt="" draggable={false} />
                </div>
              </div>
              <div className="pl-float-card pl-float-card--right">
                <div className="pl-ring">
                  <svg viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="17" />
                    <circle cx="22" cy="22" r="17" />
                  </svg>
                  <span>94</span>
                </div>
                <div>
                  <strong>Ready</strong>
                  <span>Built for daily use</span>
                </div>
              </div>
              <div className="pl-float-card pl-float-card--bottom">
                <div className="pl-mini-bars">
                  {[70, 88, 56, 92].map((height, index) => (
                    <span key={height} style={{ height: `${height}%`, animationDelay: `${1.2 + index * 0.08}s` }} />
                  ))}
                </div>
                <div>
                  <strong>{features[1].title}</strong>
                  <span>Momentum rising</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="pl-section">
          <div className="pl-section-inner">
            <div className="pl-section-heading pl-reveal">
              <p>How it helps</p>
              <h2>Simple tools that make the next step obvious.</h2>
            </div>
            <div className="pl-feature-grid">
              {features.map((feature, index) => (
                <article key={feature.title} className="pl-feature-card pl-reveal" style={{ transitionDelay: `${index * 90}ms` }}>
                  <feature.Icon className="pl-feature-icon" />
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="screens" className="pl-section pl-section--screens">
          <div className="pl-screens-inner">
            <div className="pl-section-heading pl-reveal">
              <p>{productName} in the app</p>
              <h2>
                Built to be simple the first time and useful every day.
              </h2>
              <span>
                The product is made for people who want to move, train, organize, and keep going without needing a complicated setup.
              </span>
            </div>
            <div className="pl-screen-rail pl-reveal">
              {screenshots.map((screen, index) => (
                <div
                  key={screen.src}
                  className={`pl-screen-shot ${index === 1 ? 'pl-screen-shot--lift' : ''}`}
                >
                  <img
                    src={screen.src}
                    alt={screen.alt}
                    className="aspect-[9/19] h-full w-full object-cover object-top"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <style jsx global>{`
        .pl-shell {
          --pl-bg: #050506;
          background:
            radial-gradient(circle at 12% 18%, var(--pl-accent-faint), transparent 28%),
            radial-gradient(circle at 86% 22%, rgba(255,255,255,0.05), transparent 30%),
            var(--pl-bg);
        }
        .pl-nav {
          position: fixed;
          inset: 0 0 auto;
          z-index: 40;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(22px) saturate(180%);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          transition: background 260ms ease, border-color 260ms ease;
        }
        .pl-nav--scrolled {
          background: rgba(5,5,6,0.82);
          border-color: rgba(255,255,255,0.12);
        }
        .pl-nav-inner {
          max-width: 1180px;
          height: 68px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .pl-back-link, .pl-nav-links a {
          color: rgba(255,255,255,0.72);
          transition: color 180ms ease;
        }
        .pl-back-link {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          font-size: 14px;
          font-weight: 700;
        }
        .pl-back-link:hover, .pl-nav-links a:hover { color: #fff; }
        .pl-nav-links {
          display: flex;
          gap: 26px;
          font-size: 14px;
          font-weight: 650;
        }
        .pl-hero {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          padding-top: 68px;
        }
        .pl-hero-media {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.42;
          transform: scale(1.02);
        }
        .pl-hero-scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(0,0,0,0.92), rgba(0,0,0,0.48) 48%, rgba(0,0,0,0.78)),
            linear-gradient(180deg, rgba(0,0,0,0.62), rgba(0,0,0,0.3) 48%, #050506);
        }
        .pl-hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse at 58% 45%, black 18%, transparent 72%);
          -webkit-mask-image: radial-gradient(ellipse at 58% 45%, black 18%, transparent 72%);
          animation: plGridDrift 24s linear infinite;
        }
        .pl-hero-glow {
          position: absolute;
          width: 70vw;
          height: 44vw;
          right: -18vw;
          top: 12vh;
          background: radial-gradient(ellipse, var(--pl-accent-soft) 0%, transparent 68%);
          filter: blur(28px);
          animation: plGlowPulse 5s ease-in-out infinite;
        }
        .pl-hero-inner {
          position: relative;
          z-index: 2;
          min-height: calc(100vh - 68px);
          max-width: 1180px;
          margin: 0 auto;
          padding: 90px 24px 72px;
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(360px, 0.8fr);
          align-items: center;
          gap: 56px;
        }
        .pl-hero-text { max-width: 760px; }
        .pl-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.78);
          font-size: 13px;
          font-weight: 700;
          backdrop-filter: blur(8px);
          opacity: 0;
          animation: plFadeUp 0.8s ease 0.15s forwards;
        }
        .pl-badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--pl-accent);
          box-shadow: 0 0 20px var(--pl-accent);
          animation: plPulseDot 2s ease infinite;
        }
        .pl-h1 {
          margin-top: 24px;
          font-size: clamp(52px, 7vw, 92px);
          line-height: 0.94;
          letter-spacing: 0;
          font-weight: 760;
          color: #fff;
          opacity: 0;
          animation: plFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.32s forwards;
        }
        .pl-h1::selection { background: var(--pl-accent-soft); }
        .pl-hero-sub {
          margin-top: 24px;
          max-width: 650px;
          color: rgba(255,255,255,0.74);
          font-size: clamp(19px, 2vw, 24px);
          line-height: 1.52;
          opacity: 0;
          animation: plFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.48s forwards;
        }
        .pl-hero-ctas {
          margin-top: 32px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          opacity: 0;
          animation: plFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.64s forwards;
        }
        .pl-btn-primary,
        .pl-btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 48px;
          border-radius: 12px;
          padding: 13px 18px;
          font-size: 14px;
          font-weight: 800;
          transition: transform 180ms ease, opacity 180ms ease, background 180ms ease;
        }
        .pl-btn-primary { color: #020202; }
        .pl-btn-secondary {
          color: #fff;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
        }
        .pl-btn-primary:hover,
        .pl-btn-secondary:hover {
          transform: translateY(-1px);
        }
        .pl-hero-visual {
          position: relative;
          min-height: 620px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          animation: plFadeUp 1.1s cubic-bezier(0.16,1,0.3,1) 0.45s forwards;
        }
        .pl-phone {
          position: relative;
          width: 285px;
          height: 590px;
          padding: 10px;
          border-radius: 46px;
          border: 1px solid rgba(255,255,255,0.18);
          background: linear-gradient(180deg,#141519 0%,#07080a 100%);
          box-shadow: 0 40px 120px rgba(0,0,0,0.58), 0 0 70px var(--pl-accent-soft);
          transition: transform 80ms linear;
        }
        .pl-phone-notch {
          position: absolute;
          top: 19px;
          left: 50%;
          z-index: 3;
          width: 84px;
          height: 22px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: #060608;
        }
        .pl-phone-screen {
          height: 100%;
          overflow: hidden;
          border-radius: 37px;
          background: #050506;
        }
        .pl-phone-screen img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top;
        }
        .pl-float-card {
          position: absolute;
          z-index: 5;
          min-width: 210px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(10,10,13,0.72);
          box-shadow: 0 18px 60px rgba(0,0,0,0.36);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
          opacity: 0;
          animation: plFloatIn 1s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .pl-float-card strong {
          display: block;
          color: #fff;
          font-size: 13px;
          line-height: 1.2;
        }
        .pl-float-card span {
          display: block;
          margin-top: 3px;
          color: rgba(255,255,255,0.56);
          font-size: 12px;
        }
        .pl-float-card--top { top: 78px; left: 4px; animation-delay: 0.9s; }
        .pl-float-card--right { top: 42%; right: -30px; animation-delay: 1.08s; }
        .pl-float-card--bottom { bottom: 98px; left: -18px; animation-delay: 1.26s; }
        .pl-float-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 14px;
          color: var(--pl-accent);
          background: var(--pl-accent-soft);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
        }
        .pl-ring {
          position: relative;
          width: 46px;
          height: 46px;
        }
        .pl-ring svg {
          width: 46px;
          height: 46px;
          transform: rotate(-90deg);
        }
        .pl-ring circle {
          fill: none;
          stroke-width: 4;
        }
        .pl-ring circle:first-child { stroke: rgba(255,255,255,0.12); }
        .pl-ring circle:last-child {
          stroke: var(--pl-accent);
          stroke-linecap: round;
          stroke-dasharray: 106.8;
          stroke-dashoffset: 106.8;
          animation: plRingFill 2s cubic-bezier(0.22,1,0.36,1) 1.25s forwards;
        }
        .pl-ring span {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          margin: 0;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
        }
        .pl-mini-bars {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 4px;
          padding: 7px;
          border-radius: 14px;
          background: var(--pl-accent-soft);
        }
        .pl-mini-bars span {
          width: 5px;
          margin: 0;
          border-radius: 999px;
          background: var(--pl-accent);
          transform-origin: bottom;
          transform: scaleY(0);
          animation: plBarRise 0.7s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        .pl-section {
          position: relative;
          border-top: 1px solid rgba(255,255,255,0.1);
          background: #070708;
        }
        .pl-section::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at 22% 20%, var(--pl-accent-faint), transparent 32%);
        }
        .pl-section-inner,
        .pl-screens-inner {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto;
          padding: 96px 24px;
        }
        .pl-section-heading {
          max-width: 760px;
        }
        .pl-section-heading p {
          color: rgba(255,255,255,0.42);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .pl-section-heading h2 {
          margin-top: 14px;
          color: #fff;
          font-size: clamp(36px, 4vw, 58px);
          line-height: 1.02;
          font-weight: 760;
          letter-spacing: 0;
        }
        .pl-section-heading span {
          display: block;
          margin-top: 20px;
          max-width: 640px;
          color: rgba(255,255,255,0.62);
          font-size: 18px;
          line-height: 1.6;
        }
        .pl-feature-grid {
          margin-top: 34px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 16px;
        }
        .pl-feature-card {
          min-height: 230px;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.045);
          padding: 24px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
          backdrop-filter: blur(16px);
        }
        .pl-feature-icon {
          width: 28px;
          height: 28px;
          color: var(--pl-accent);
        }
        .pl-feature-card h3 {
          margin-top: 28px;
          color: #fff;
          font-size: 22px;
          font-weight: 760;
        }
        .pl-feature-card p {
          margin-top: 12px;
          color: rgba(255,255,255,0.58);
          font-size: 15px;
          line-height: 1.65;
        }
        .pl-section--screens { background: #020203; }
        .pl-screens-inner {
          display: grid;
          grid-template-columns: 0.82fr 1.18fr;
          gap: 56px;
          align-items: center;
        }
        .pl-screen-rail {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .pl-screen-shot {
          overflow: hidden;
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,0.12);
          background: #070708;
          box-shadow: 0 34px 90px rgba(0,0,0,0.46);
        }
        .pl-screen-shot--lift { transform: translateY(32px); }
        .pl-screen-shot img {
          width: 100%;
          height: 100%;
          aspect-ratio: 9 / 19;
          object-fit: cover;
          object-position: top;
        }
        .pl-reveal {
          opacity: 0;
          transform: translateY(28px);
          filter: blur(6px);
          transition: opacity 850ms cubic-bezier(0.16,1,0.3,1), transform 850ms cubic-bezier(0.16,1,0.3,1), filter 850ms cubic-bezier(0.16,1,0.3,1);
        }
        .pl-visible {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
        }
        @keyframes plFadeUp {
          from { opacity: 0; transform: translateY(26px); filter: blur(6px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes plFloatIn {
          from { opacity: 0; transform: translateY(22px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes plGlowPulse {
          0%, 100% { opacity: 0.72; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes plGridDrift {
          to { background-position: 56px 56px; }
        }
        @keyframes plPulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.45); opacity: 0.7; }
        }
        @keyframes plRingFill {
          to { stroke-dashoffset: 14; }
        }
        @keyframes plBarRise {
          to { transform: scaleY(1); }
        }
        @media (max-width: 980px) {
          .pl-nav-links { display: none; }
          .pl-hero-inner {
            grid-template-columns: 1fr;
            gap: 28px;
            padding-top: 92px;
          }
          .pl-hero-visual {
            min-height: 520px;
          }
          .pl-phone {
            width: 245px;
            height: 510px;
          }
          .pl-float-card--top { left: 6%; top: 36px; }
          .pl-float-card--right { right: 4%; }
          .pl-float-card--bottom { left: 4%; bottom: 52px; }
          .pl-feature-grid,
          .pl-screens-inner {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .pl-nav-inner { padding: 0 16px; }
          .pl-hero-inner,
          .pl-section-inner,
          .pl-screens-inner {
            padding-left: 18px;
            padding-right: 18px;
          }
          .pl-h1 { font-size: 48px; }
          .pl-hero-visual { display: none; }
          .pl-screen-rail { gap: 8px; }
          .pl-screen-shot { border-radius: 18px; }
        }
      `}</style>
    </div>
  );
};

export const fitClubLandingProps: ProductLandingProps = {
  productName: 'Fit Club',
  eyebrow: 'For clubs, crews, coaches, and communities',
  headline: 'Find your people. Keep moving together.',
  body:
    'Fit Club gives every fitness community a home for events, challenges, updates, and the moments that keep members coming back.',
  accent: '#5EEAD4',
  pageTitle: 'Fit Club — Fitness communities that keep moving',
  metaDescription:
    'Fit Club helps fitness communities run events, challenges, updates, and member activity in one place.',
  pageOgUrl: 'https://fitwithpulse.ai/fitclub',
  heroMedia: {
    src: '/fitclub-media/the-pact-banner.jpg',
    type: 'image',
  },
  screenshots: [
    { src: '/fitclub-media/02-club-home.png', alt: 'Fit Club home screen' },
    { src: '/fitclub-media/10-event-detail-rsvp.png', alt: 'Fit Club event RSVP screen' },
    { src: '/fitclub-media/14-club-calendar.png', alt: 'Fit Club calendar screen' },
  ],
  features: [
    {
      title: 'Run events',
      body: 'Share what is happening, collect RSVPs, and give members one place to check the plan.',
      Icon: CalendarDays,
    },
    {
      title: 'Start challenges',
      body: 'Give members a reason to train together, compete a little, and stay consistent.',
      Icon: Trophy,
    },
    {
      title: 'Keep the group close',
      body: 'Members can see updates, join activities, and feel like they are part of something real.',
      Icon: Users,
    },
  ],
  primaryHref: '/CreatorClub',
  primaryLabel: 'See club tools',
};

export const fwpLandingProps: ProductLandingProps = {
  productName: 'Fit With Pulse',
  eyebrow: 'For people who want workouts that fit their life',
  headline: 'Workouts that meet you where you are.',
  body:
    'Fit With Pulse helps people find workouts, follow creators, and choose training that matches their energy, goals, and recovery.',
  accent: '#E0FE10',
  pageTitle: 'Fit With Pulse — Workouts that meet you where you are',
  metaDescription:
    'Fit With Pulse helps people find workouts, follow creator-led training, and choose workouts based on their goals and recovery.',
  pageOgUrl: 'https://fitwithpulse.ai/FWP',
  heroMedia: {
    src: '/move.mp4',
    type: 'video',
  },
  screenshots: [
    { src: '/fwp-media/01-today-home.png', alt: 'Fit With Pulse today screen' },
    { src: '/fwp-media/03-workout-preview-built-for-you.png', alt: 'Fit With Pulse workout preview' },
    { src: '/fwp-media/04-immersive-player.png', alt: 'Fit With Pulse workout player' },
  ],
  features: [
    {
      title: 'Pick the right workout',
      body: 'Find a session that matches your goal, time, and how your body feels today.',
      Icon: Dumbbell,
    },
    {
      title: 'Follow real creators',
      body: 'Train with people who teach movement in a clear, practical, and motivating way.',
      Icon: Sparkles,
    },
    {
      title: 'Build better habits',
      body: 'Track progress and keep showing up without making fitness feel complicated.',
      Icon: Utensils,
    },
  ],
  primaryHref: '/creators',
  primaryLabel: 'See creator tools',
};

export default ProductLandingShell;
