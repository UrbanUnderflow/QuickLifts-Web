import React, { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import mixpanel from 'mixpanel-browser';

const DEMO_TITLE = 'PulseCheck Tech Demo | Pulse Intelligence Labs';
const DEMO_DESCRIPTION = 'A focused PulseCheck tech demo page for investors and reviewers.';
const VIDEO_SRC = 'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/webassets%2Fpulse-check-tech-demo.mp4?alt=media&token=de71c561-351d-459d-9d06-dc534b80d000';
const VIDEO_DURATION_SECONDS = 1111;
const PITCH_DECK_HREF = '/investor-docs/Pulse_Intelligence_Labs_Deck.pdf';
const PITCH_DECK_FILENAME = 'Pulse_Intelligence_Labs_Deck.pdf';

const resolveDemoHost = (host: string | undefined | string[]) => {
  const normalizedHost = Array.isArray(host) ? host[0] ?? '' : host ?? '';
  const hostName = normalizedHost.toLowerCase().split(':')[0];
  if (hostName === 'pulseintelligencelabs.com' || hostName === 'www.pulseintelligencelabs.com') {
    return 'https://pulseintelligencelabs.com';
  }
  if (hostName === 'pulsecheckmind.ai' || hostName === 'www.pulsecheckmind.ai') {
    return 'https://pulsecheckmind.ai';
  }
  return 'https://fitwithpulse.ai';
};

const chapters = [
  {
    time: '00:00',
    seconds: 0,
    title: 'Athlete Experience',
    desc: 'Game-day notification, Nora check-in, and the athlete-side flow from first tap to emotional signal capture.',
    color: '#a78bfa',
  },
  {
    time: '04:30',
    seconds: 270,
    title: 'Nora Regulation',
    desc: 'Nora moves from conversation into a guided breathing protocol and reads the athlete state in real time.',
    color: '#22d3ee',
  },
  {
    time: '09:00',
    seconds: 540,
    title: 'Coach Experience',
    desc: 'The coach view shows athlete alerts, assigned protocols, risk context, and the team roster.',
    color: '#b794ff',
  },
  {
    time: '11:30',
    seconds: 690,
    title: 'Escalation Protocols',
    desc: 'The system walks through no escalation, monitor-only, elevated risk, and critical risk routing.',
    color: '#c084fc',
  },
  {
    time: '15:30',
    seconds: 930,
    title: 'Clinician Experience',
    desc: 'AuntEDNA receives the handoff with athlete context, conversation excerpts, medical history, and next actions.',
    color: '#f472b6',
  },
  {
    time: '18:30',
    seconds: 1110,
    title: 'Closing Remarks',
    desc: 'The demo closes on the connected support loop across athlete, coach, signal layer, and clinician.',
    color: '#8b5cf6',
  },
] as const;

const stackItems = [
  {
    number: '01 / AI',
    title: 'Nora Coach',
    desc: 'Athlete-facing AI. Sim execution across six locked families with real-time protocol delivery.',
  },
  {
    number: '02 / HARDWARE',
    title: 'Sensor Layer',
    desc: 'Multi-modal biometric capture through Polar hardware. Heart rate, HRV, and behavioral signals.',
  },
  {
    number: '03 / MOAT',
    title: 'Sports Intelligence',
    desc: 'Sport-specific contextualization. The proprietary layer competitors cannot easily replicate.',
  },
  {
    number: '04 / CLINICAL',
    title: 'Clinical Handoff',
    desc: 'Tier 0-3 escalation routing through AuntEDNA.ai as the strategic clinical support partner.',
  },
] as const;

const trackDemoEvent = (eventName: string, props: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;

  try {
    mixpanel.track(eventName, {
      page: 'pulse_check_tech_demo',
      video: 'Pulse Tech Demo 3',
      ...props,
    });
  } catch {
    // Analytics should never interrupt playback.
  }
};

const PulseCheckTechDemoPage: React.FC<PulseCheckTechDemoPageProps> = ({ ogMeta }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackedQuartilesRef = useRef<Set<number>>(new Set());
  const recordedViewRef = useRef(false);
  const [videoError, setVideoError] = useState(false);
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);
  const [isHeroExpanded, setIsHeroExpanded] = useState(false);

  useEffect(() => {
    if (recordedViewRef.current || typeof window === 'undefined') return;
    recordedViewRef.current = true;

    const visitorId = (() => {
      try {
        const key = 'pulse-check-tech-demo-visitor-id';
        let id = window.localStorage.getItem(key);
        if (!id) {
          id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
          window.localStorage.setItem(key, id);
        }
        return id;
      } catch {
        return null;
      }
    })();

    const params = new URLSearchParams(window.location.search);
    const viewerName =
      params.get('viewerName') ||
      params.get('name') ||
      params.get('investor') ||
      params.get('viewer') ||
      params.get('reviewer') ||
      '';
    const viewerEmail = params.get('viewerEmail') || params.get('email') || '';
    const viewerCompany =
      params.get('viewerCompany') || params.get('company') || params.get('org') || params.get('organization') || '';
    const viewerRole = params.get('viewerRole') || params.get('role') || params.get('title') || '';
    const utmSource = params.get('utm_source') || '';
    const referrerHost = (() => {
      try {
        return document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
      } catch {
        return '';
      }
    })();
    const body = {
      ...(visitorId ? { visitorId } : {}),
      pageUrl: window.location.href,
      referrer: document.referrer || '',
      viewerName,
      viewerEmail,
      viewerCompany,
      viewerRole,
      source: params.get('source') || params.get('ref') || params.get('channel') || utmSource || referrerHost || '',
      utmSource,
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      language: navigator.language || '',
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      platform: navigator.platform || '',
      devicePixelRatio: String(window.devicePixelRatio || ''),
      localTimestamp: new Date().toString(),
    };

    fetch('/api/pulse-check-tech-demo/record-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, []);

  const seekToChapter = useCallback((chapter: (typeof chapters)[number]) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = chapter.seconds;
    setIsHeroExpanded(true);
    setShowPlayOverlay(false);
    video.play().catch(() => {});
    trackDemoEvent('Pulse Check Demo Chapter Selected', {
      chapter: chapter.title,
      chapter_time: chapter.time,
      chapter_seconds: chapter.seconds,
    });
  }, []);

  const playDemo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsHeroExpanded(true);
    setShowPlayOverlay(false);
    video.play().catch(() => {
      setIsHeroExpanded(false);
      setShowPlayOverlay(true);
    });
  }, []);

  const closeDemo = useCallback(() => {
    videoRef.current?.pause();
    setIsHeroExpanded(false);
    setShowPlayOverlay(true);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : VIDEO_DURATION_SECONDS;
    const progress = video.currentTime / duration;

    [25, 50, 75].forEach((quartile) => {
      if (progress >= quartile / 100 && !trackedQuartilesRef.current.has(quartile)) {
        trackedQuartilesRef.current.add(quartile);
        trackDemoEvent('Pulse Check Demo Watch Quartile', {
          quartile,
          current_time: Math.round(video.currentTime),
        });
      }
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isHeroExpanded) {
        closeDemo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDemo, isHeroExpanded]);

  return (
    <>
      <Head>
        <title>PulseCheck Tech Demo | Pulse Intelligence Labs</title>
        <meta
          name="description"
          content={DEMO_DESCRIPTION}
        />
        <meta property="og:title" content={ogMeta.title} />
        <meta property="og:description" content={ogMeta.description} />
        <meta property="og:image" content={ogMeta.image} />
        <meta property="og:url" content={ogMeta.url} />
        <meta property="og:type" content={ogMeta.type} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogMeta.title} />
        <meta name="twitter:description" content={ogMeta.description} />
        <meta name="twitter:image" content={ogMeta.image} />
        <link rel="canonical" href={ogMeta.url} />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="demo-shell">
        <div className="grain" />
        <nav className="demo-nav">
          <div className="container nav-inner">
            <a href="/pulseintelligencelabs" className="logo" aria-label="Pulse Intelligence Labs">
              <span className="logo-mark" />
              <span className="logo-text">Pulse Intelligence Labs</span>
            </a>
            <div className="nav-meta">
              <span className="hide-mobile">PulseCheck / Tech Demo</span>
              <a
                href="https://pulsecheckmind.ai"
                className="nav-site-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                PulseCheck Mind
              </a>
              <a
                href={PITCH_DECK_HREF}
                className="nav-deck-link"
                download={PITCH_DECK_FILENAME}
              >
                Download Pitch Deck
              </a>
              <span className="live-indicator">
                <span className="live-dot" />
                Tech Demo
              </span>
            </div>
          </div>
        </nav>

        <main>
          <section className={`hero ${isHeroExpanded ? 'expanded' : ''}`}>
            <div className="hero-left">
              <div className="left-top">
                <div className="episode-marker fade-up delay-1">EP. 01 / Confidential Investor Preview</div>
                <h1 className="hero-title fade-up delay-2">
                  <span>Pulse</span>
                  <span>Check,</span>
                  <span className="live-word">Tech Demo</span>
                </h1>
                <p className="hero-sub fade-up delay-3">
                  The integrated stack that measures and trains <strong>Focus, Composure, and Decisioning</strong>, the
                  three mental skills that decide games.
                </p>
                <button type="button" className="hero-play-cta fade-up delay-4" onClick={playDemo}>
                  <span className="cta-play-icon" />
                  Play the 18-Minute Demo
                </button>
              </div>

              <div className="left-bottom fade-up delay-5">
                <div className="meta-item">
                  <span className="meta-label">Runtime</span>
                  <span className="meta-value lime">18:31</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Founder</span>
                  <span className="meta-value">Tremaine Grant</span>
                </div>
              </div>
            </div>

            <div className="hero-right">
              <div className="video-section fade-up delay-3">
                <div className="video-frame">
                  <video
                    ref={videoRef}
                    className="demo-video"
                    controls
                    playsInline
                    preload="metadata"
                    onPlay={() => {
                      setIsHeroExpanded(true);
                      setShowPlayOverlay(false);
                      trackDemoEvent('Pulse Check Demo Play');
                    }}
                    onPause={() =>
                      trackDemoEvent('Pulse Check Demo Pause', {
                        current_time: Math.round(videoRef.current?.currentTime || 0),
                      })
                    }
                    onEnded={() => {
                      setShowPlayOverlay(true);
                      trackDemoEvent('Pulse Check Demo Completed');
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    onError={() => setVideoError(true)}
                  >
                    <source src={VIDEO_SRC} type="video/mp4" />
                    <a href={VIDEO_SRC}>Download the PulseCheck tech demo video.</a>
                  </video>
                  {showPlayOverlay ? (
                    <button
                      type="button"
                      className="video-play-overlay"
                      aria-label="Play the PulseCheck tech demo"
                      onClick={playDemo}
                    >
                      <span className="play-ring">
                        <span className="play-triangle" />
                      </span>
                      <span className="play-copy">Watch the product walkthrough</span>
                    </button>
                  ) : null}
                  <div className="video-meta">
                    <div className="video-title-overlay">PulseCheck - Full Product Walkthrough</div>
                    <div className="video-runtime">18:31</div>
                  </div>
                  <button
                    type="button"
                    className="video-close"
                    aria-label="Minimize video"
                    onClick={closeDemo}
                  >
                    <span className="close-lines" aria-hidden="true" />
                  </button>
                </div>
                {videoError ? (
                  <div className="video-fallback">
                    This browser could not play the hosted MP4. <a href={VIDEO_SRC}>Download the demo video</a>.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="chapters">
            <div className="container">
              <div className="section-header">
                <h2>Chapters</h2>
                <div>Jump to any section</div>
              </div>

              <div className="chapter-list">
                {chapters.map((chapter) => (
                  <button
                    type="button"
                    key={chapter.time}
                    className="chapter-card"
                    style={{ '--chapter-color': chapter.color } as React.CSSProperties}
                    onClick={() => seekToChapter(chapter)}
                  >
                    <span className="chapter-time">{chapter.time}</span>
                    <span className="chapter-body">
                      <span className="chapter-title">{chapter.title}</span>
                      <span className="chapter-desc">{chapter.desc}</span>
                    </span>
                    <span className="chapter-arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="stack-section">
            <div className="container">
              <div className="section-header">
                <h2>The Four-Part Stack</h2>
                <div>What the demo shows</div>
              </div>
              <div className="stack-grid">
                {stackItems.map((item) => (
                  <div className="stack-item" key={item.number}>
                    <div className="stack-number">{item.number}</div>
                    <div className="stack-title">{item.title}</div>
                    <div className="stack-desc">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="context-section">
            <div className="container">
              <div className="section-header">
                <h2>For Reviewers</h2>
                <div>Stakeholder deck</div>
              </div>

              <div className="context-grid">
                <div className="context-card">
                  <div className="context-card-tag">Recommended Viewing Order</div>
                  <h3>Watch the demo, then the deck.</h3>
                  <p>
                    The video shows the product working live. The deck provides market sizing, unit economics, the path
                    to $100M ARR, and the capital plan. Together they tell the full fundability story.
                  </p>
                  <a
                    href={PITCH_DECK_HREF}
                    className="context-link"
                    download={PITCH_DECK_FILENAME}
                  >
                    View the Deck
                  </a>
                </div>

                <div className="context-card">
                  <div className="context-card-tag">Further Questions</div>
                  <h3>Direct line to the founder.</h3>
                  <p>
                    Pulse Intelligence Labs is raising a $1.4M Pre-Seed at a $10M pre-money valuation. We can walk
                    reviewers through the product, market, or financial plan in greater depth.
                  </p>
                  <a href="mailto:tre@fitwithpulse.ai" className="context-link">
                    Reach Tremaine
                  </a>
                </div>

                <div className="context-card">
                  <div className="context-card-tag">PulseCheck Mind</div>
                  <h3>See the public product site.</h3>
                  <p>
                    The demo walks through the full stack. PulseCheck Mind is the product-facing destination for the
                    mental performance platform, athlete experience, and positioning.
                  </p>
                  <a
                    href="https://pulsecheckmind.ai"
                    className="context-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit PulseCheck Mind
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer>
          <div className="container">
            <div className="footer-inner">
              <div className="footer-cta">
                <h2>
                  Build the <span>human performance</span> company.
                </h2>
                <p>
                  Pulse Intelligence Labs is building the integrated system for measuring and training human performance.
                  PulseCheck is the flagship.
                </p>
              </div>
            </div>

            <div className="footer-meta-strip">
              <span>2026 Pulse Intelligence Labs | Atlanta, GA</span>
              <span>Backed by LAUNCH | Counsel by Cooley LLP</span>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        :global(html),
        :global(body) {
          background: #070707;
        }

        .demo-shell {
          --bg-base: #0a0a0a;
          --bg-elevated: #131313;
          --bg-card: #161616;
          --border-subtle: rgba(255, 255, 255, 0.06);
          --border-card: rgba(255, 255, 255, 0.1);
          --text-primary: #ffffff;
          --text-secondary: rgba(255, 255, 255, 0.64);
          --text-tertiary: rgba(255, 255, 255, 0.4);
          --accent-lime: #a78bfa;
          --accent-lime-glow: rgba(139, 92, 246, 0.24);
          --accent-cyan: #22d3ee;
          --accent-magenta: #f472b6;
          --accent-purple: #8b5cf6;
          --accent-purple-dark: #5b21b6;
          --accent-purple-soft: rgba(167, 139, 250, 0.22);
          --accent-gradient: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 45%, #22d3ee 100%);
          --ease-expand: cubic-bezier(0.65, 0, 0.35, 1);
          --duration-expand: 800ms;
          min-height: 100vh;
          background:
            radial-gradient(circle at 16% 18%, rgba(139, 92, 246, 0.22), transparent 34%),
            radial-gradient(circle at 84% 8%, rgba(34, 211, 238, 0.12), transparent 36%),
            linear-gradient(135deg, rgba(139, 92, 246, 0.12), transparent 40%),
            repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.025) 0, rgba(255, 255, 255, 0.025) 1px, transparent 1px, transparent 88px),
            var(--bg-base);
          color: var(--text-primary);
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        .grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.035;
          z-index: 1;
          background:
            repeating-radial-gradient(circle at 18% 22%, rgba(255, 255, 255, 0.24) 0 1px, transparent 1px 4px),
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0 1px, transparent 1px 6px);
        }

        .container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 32px;
          position: relative;
          z-index: 2;
        }

        .demo-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          border-bottom: 1px solid var(--border-subtle);
          background: rgba(10, 10, 10, 0.78);
          backdrop-filter: blur(20px);
          padding: 18px 0;
        }

        .nav-inner,
        .logo,
        .nav-meta,
        .live-indicator {
          display: flex;
          align-items: center;
        }

        .nav-inner {
          justify-content: space-between;
          gap: 24px;
          max-width: none;
        }

        .logo {
          gap: 12px;
          color: var(--text-primary);
          text-decoration: none;
        }

        .logo-mark {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: var(--accent-lime);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.32);
          position: relative;
        }

        .logo-mark::after {
          content: '';
          position: absolute;
          inset: 5px;
          border-radius: 999px;
          background: var(--bg-base);
        }

        .logo-text,
        .hero-title,
        .meta-value,
        .section-header h2,
        .stack-title,
        .context-card h3,
        .footer-cta h2,
        .video-title-overlay {
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 0;
        }

        .logo-text {
          font-size: 18px;
          text-transform: uppercase;
        }

        .nav-meta {
          gap: 24px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-tertiary);
        }

        .live-indicator {
          gap: 8px;
          color: var(--accent-lime);
        }

        .nav-site-link {
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .nav-site-link:hover {
          color: var(--accent-lime);
        }

        .nav-deck-link {
          display: inline-flex;
          align-items: center;
          min-height: 36px;
          padding: 0 16px;
          border: 1px solid rgba(167, 139, 250, 0.58);
          border-radius: 999px;
          background: rgba(167, 139, 250, 0.08);
          color: var(--accent-lime);
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.24s ease, border-color 0.24s ease, color 0.24s ease, transform 0.24s ease;
        }

        .nav-deck-link:hover {
          border-color: rgba(167, 139, 250, 0.88);
          background: var(--accent-gradient);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--accent-gradient);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.32);
          }
          50% {
            opacity: 0.65;
            box-shadow: 0 0 0 8px rgba(139, 92, 246, 0);
          }
        }

        .hero {
          position: relative;
          min-height: min(calc(100vh - 59px), 760px);
          display: grid;
          grid-template-columns: minmax(380px, 0.85fr) minmax(560px, 1.15fr);
          overflow: hidden;
          padding: 0;
          transition: grid-template-columns var(--duration-expand) var(--ease-expand);
        }

        .hero.expanded {
          grid-template-columns: 0fr 1fr;
        }

        .hero-left {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-width: 0;
          overflow: hidden;
          padding: 64px 56px 48px;
          border-right: 1px solid var(--border-subtle);
          background: var(--bg-base);
          transition:
            padding var(--duration-expand) var(--ease-expand),
            opacity 480ms ease;
        }

        .hero.expanded .hero-left {
          padding-left: 0;
          padding-right: 0;
          opacity: 0;
          pointer-events: none;
        }

        .hero-left::before {
          content: '';
          position: absolute;
          top: 18%;
          left: -34%;
          width: 86%;
          height: 62%;
          background:
            radial-gradient(circle at 45% 45%, rgba(139, 92, 246, 0.32), transparent 58%),
            radial-gradient(circle at 62% 52%, rgba(34, 211, 238, 0.12), transparent 64%);
          filter: blur(40px);
          opacity: 0.62;
          pointer-events: none;
        }

        .left-top,
        .left-bottom {
          position: relative;
          z-index: 2;
        }

        .episode-marker {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
          color: var(--accent-lime);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .episode-marker::before {
          content: '';
          width: 32px;
          height: 1px;
          background: var(--accent-gradient);
        }

        .hero-title {
          font-size: clamp(72px, 8vw, 128px);
          line-height: 0.87;
          margin: 0 0 22px;
          font-weight: 400;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .hero-title span {
          display: block;
          color: var(--text-primary);
        }

        .hero-title .live-word {
          color: var(--accent-lime);
        }

        .hero-title .live-word::after {
          content: '';
          display: inline-block;
          width: 12px;
          height: 12px;
          margin-left: 16px;
          margin-bottom: 0.11em;
          border-radius: 999px;
          background: var(--accent-gradient);
          box-shadow: 0 0 22px rgba(139, 92, 246, 0.55);
          vertical-align: middle;
          animation: liveDot 1.6s ease-in-out infinite;
        }

        @keyframes liveDot {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.86);
          }
        }

        .hero-sub {
          max-width: 450px;
          margin: 0 0 40px;
          color: var(--text-secondary);
          font-size: 18px;
          line-height: 1.5;
        }

        .hero-sub strong {
          color: var(--text-primary);
          font-weight: 500;
        }

        .hero-play-cta {
          display: inline-flex;
          align-items: center;
          gap: 16px;
          min-height: 52px;
          padding: 0 24px;
          border: 0;
          border-radius: 999px;
          background: var(--accent-gradient);
          color: #ffffff;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          white-space: nowrap;
          transition: transform 0.24s ease, box-shadow 0.24s ease;
        }

        .hero-play-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px var(--accent-lime-glow);
        }

        .cta-play-icon {
          width: 0;
          height: 0;
          border-left: 9px solid #ffffff;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          margin-left: 2px;
        }

        .left-bottom {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
          padding-top: 32px;
          border-top: 1px solid var(--border-subtle);
        }

        .left-bottom .meta-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
          padding: 0;
          background: transparent;
        }

        .meta-label,
        .stack-number,
        .context-card-tag,
        .section-header div,
        .footer-meta-strip,
        .contact-link span,
        .chapter-time,
        .video-runtime {
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .meta-label {
          font-size: 10px;
          color: var(--text-tertiary);
          margin-bottom: 0;
        }

        .meta-value {
          font-size: 22px;
          color: var(--text-primary);
        }

        .footer-cta h2 span,
        .lime {
          color: var(--accent-lime);
        }

        .hero-right {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 48px;
          background:
            radial-gradient(circle at 72% 30%, rgba(139, 92, 246, 0.18), transparent 58%),
            radial-gradient(circle at 30% 70%, rgba(34, 211, 238, 0.08), transparent 58%),
            var(--bg-elevated);
          transition: padding var(--duration-expand) var(--ease-expand);
        }

        .hero.expanded .hero-right {
          padding: 0;
        }

        .hero-right::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse at center, black 28%, transparent 82%);
        }

        .video-section {
          position: relative;
          z-index: 2;
          width: 100%;
          margin: 0;
        }

        .hero.expanded .video-section {
          height: calc(100vh - 59px);
        }

        .video-frame {
          position: relative;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border-radius: 8px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-card);
          box-shadow: 0 38px 100px rgba(0, 0, 0, 0.48), 0 0 80px rgba(139, 92, 246, 0.12);
          transition:
            border-radius var(--duration-expand) var(--ease-expand),
            height var(--duration-expand) var(--ease-expand);
        }

        .hero.expanded .video-frame {
          height: calc(100vh - 59px);
          aspect-ratio: auto;
          border: 0;
          border-radius: 0;
          box-shadow: none;
        }

        .demo-video {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #050505;
        }

        .video-play-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          padding: 32px;
          border: 0;
          background:
            radial-gradient(circle at 48% 45%, rgba(139, 92, 246, 0.28), transparent 34%),
            linear-gradient(180deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.68));
          color: var(--text-primary);
          cursor: pointer;
          transition: background 0.24s ease;
        }

        .video-play-overlay:hover {
          background:
            radial-gradient(circle at 48% 45%, rgba(167, 139, 250, 0.34), transparent 36%),
            linear-gradient(180deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.62));
        }

        .play-ring {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 88px;
          height: 88px;
          border-radius: 999px;
          background: var(--accent-gradient);
          box-shadow: 0 0 60px rgba(139, 92, 246, 0.34);
          transition: transform 0.24s ease;
        }

        .video-play-overlay:hover .play-ring {
          transform: scale(1.06);
        }

        .play-triangle {
          width: 0;
          height: 0;
          border-left: 22px solid var(--bg-base);
          border-top: 14px solid transparent;
          border-bottom: 14px solid transparent;
          margin-left: 6px;
        }

        .play-copy {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--accent-lime);
          text-transform: uppercase;
        }

        .video-close {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 8;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border: 1px solid var(--border-card);
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.62);
          color: var(--text-primary);
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          backdrop-filter: blur(10px);
          transition: opacity 0.24s ease, border-color 0.24s ease, background 0.24s ease;
        }

        .hero.expanded .video-close {
          opacity: 1;
          pointer-events: auto;
        }

        .video-close:hover {
          border-color: rgba(167, 139, 250, 0.7);
          background: rgba(0, 0, 0, 0.82);
        }

        .close-lines,
        .close-lines::before {
          display: block;
          width: 18px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
          transform: rotate(45deg);
        }

        .close-lines::before {
          content: '';
          transform: rotate(90deg);
        }

        .video-meta {
          pointer-events: none;
          position: absolute;
          left: 24px;
          right: 24px;
          top: 24px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .video-title-overlay {
          font-size: 24px;
          color: var(--text-primary);
          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
        }

        .video-runtime {
          flex: none;
          font-size: 12px;
          color: var(--text-secondary);
          padding: 7px 12px;
          background: rgba(0, 0, 0, 0.56);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          backdrop-filter: blur(10px);
        }

        .video-fallback {
          margin-top: 14px;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .video-fallback a {
          color: var(--accent-lime);
        }

        .chapters,
        .stack-section,
        .context-section {
          padding: 0 0 80px;
        }

        .section-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 40px;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 24px;
        }

        .section-header h2 {
          font-size: 38px;
          margin: 0;
          font-weight: 400;
        }

        .section-header div {
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .chapter-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .chapter-card {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 20px;
          align-items: center;
          width: 100%;
          min-height: 116px;
          padding: 24px;
          border: 1px solid var(--border-card);
          border-radius: 8px;
          background: var(--bg-card);
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          transition: transform 0.24s ease, border-color 0.24s ease, background 0.24s ease;
          position: relative;
          overflow: hidden;
        }

        .chapter-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--chapter-color);
          opacity: 0;
          transition: opacity 0.24s ease;
        }

        .chapter-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.16);
          background: var(--bg-elevated);
        }

        .chapter-card:hover::before {
          opacity: 1;
        }

        .chapter-time {
          font-size: 14px;
          color: var(--chapter-color);
          min-width: 56px;
          font-weight: 700;
        }

        .chapter-body {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .chapter-title {
          font-size: 16px;
          font-weight: 700;
        }

        .chapter-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .chapter-arrow {
          color: var(--text-tertiary);
          font-size: 20px;
          transition: transform 0.24s ease, color 0.24s ease;
        }

        .chapter-card:hover .chapter-arrow {
          color: var(--chapter-color);
          transform: translateX(4px);
        }

        .stack-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .stack-item,
        .context-card {
          border: 1px solid var(--border-card);
          border-radius: 8px;
          background: var(--bg-card);
        }

        .stack-item {
          min-height: 210px;
          padding: 28px 24px;
          transition: transform 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease;
        }

        .stack-item:hover {
          transform: translateY(-3px);
          border-color: rgba(167, 139, 250, 0.45);
          box-shadow: 0 0 40px rgba(139, 92, 246, 0.12);
        }

        .stack-number {
          font-size: 11px;
          color: var(--text-tertiary);
          margin-bottom: 16px;
        }

        .stack-title {
          font-size: 24px;
          margin-bottom: 9px;
        }

        .stack-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.55;
        }

        .context-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .context-card {
          padding: 32px;
        }

        .context-card-tag {
          font-size: 10px;
          color: var(--accent-lime);
          margin-bottom: 16px;
        }

        .context-card h3 {
          font-size: 30px;
          margin: 0 0 14px;
          font-weight: 400;
        }

        .context-card p {
          font-size: 15px;
          line-height: 1.6;
          color: var(--text-secondary);
          margin: 0 0 24px;
        }

        .context-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          padding: 0 18px;
          border: 1px solid rgba(167, 139, 250, 0.72);
          border-radius: 999px;
          color: var(--accent-lime);
          text-decoration: none;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          text-transform: uppercase;
          transition: background 0.24s ease, color 0.24s ease;
        }

        .context-link:hover {
          background: var(--accent-gradient);
          color: #ffffff;
        }

        footer {
          padding: 64px 0 48px;
          border-top: 1px solid var(--border-subtle);
        }

        .footer-inner {
          display: block;
          margin-bottom: 48px;
        }

        .footer-cta h2 {
          font-size: 56px;
          line-height: 1;
          max-width: 680px;
          margin: 0 0 16px;
          font-weight: 400;
        }

        .footer-cta p {
          max-width: 560px;
          font-size: 17px;
          color: var(--text-secondary);
          line-height: 1.55;
          margin: 0;
        }

        .footer-meta-strip {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding-top: 32px;
          border-top: 1px solid var(--border-subtle);
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .fade-up {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .delay-1 {
          animation-delay: 0.1s;
        }

        .delay-2 {
          animation-delay: 0.25s;
        }

        .delay-3 {
          animation-delay: 0.4s;
        }

        .delay-4 {
          animation-delay: 0.55s;
        }

        .delay-5 {
          animation-delay: 0.7s;
        }

        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 980px) {
          .container {
            padding: 0 20px;
          }

          .hero {
            grid-template-columns: 1fr;
            min-height: auto;
            padding: 0;
          }

          .hero.expanded {
            grid-template-columns: 1fr;
          }

          .hero-left {
            min-height: calc(100vh - 59px);
            padding: 56px 24px;
            border-right: 0;
            border-bottom: 1px solid var(--border-subtle);
          }

          .hero.expanded .hero-left {
            max-height: 0;
            padding: 0;
            border: 0;
          }

          .hero-title {
            font-size: clamp(60px, 14vw, 96px);
          }

          .hero-right {
            min-height: auto;
            padding: 24px;
          }

          .hero.expanded .hero-right {
            padding: 0;
          }

          .hero.expanded .video-section,
          .hero.expanded .video-frame {
            height: calc(100vh - 59px);
          }

          .left-bottom {
            gap: 14px;
          }

          .chapter-list,
          .context-grid {
            grid-template-columns: 1fr;
          }

          .stack-grid {
            grid-template-columns: repeat(2, 1fr);
          }

        }

        @media (max-width: 640px) {
          .hide-mobile {
            display: none;
          }

          .nav-meta {
            gap: 12px;
            font-size: 10px;
          }

          .nav-inner {
            gap: 12px;
          }

          .nav-site-link,
          .live-indicator {
            display: none;
          }

          .nav-deck-link {
            min-height: 32px;
            padding: 0 12px;
          }

          .demo-nav {
            padding: 14px 0;
          }

          .logo-mark {
            width: 18px;
            height: 18px;
          }

          .logo-mark::after {
            inset: 4px;
          }

          .logo-text {
            font-size: 15px;
          }

          .hero-left {
            padding: 48px 20px;
          }

          .episode-marker {
            white-space: normal;
          }

          .hero-title {
            font-size: clamp(54px, 18vw, 76px);
            white-space: normal;
          }

          .hero-sub {
            font-size: 17px;
          }

          .hero-play-cta {
            justify-content: center;
            width: 100%;
            padding: 0 16px;
            font-size: 11px;
          }

          .left-bottom {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .hero-right {
            padding: 18px;
          }

          .play-ring {
            width: 72px;
            height: 72px;
          }

          .play-triangle {
            border-left-width: 18px;
            border-top-width: 11px;
            border-bottom-width: 11px;
          }

          .play-copy {
            font-size: 10px;
          }

          .video-meta {
            left: 14px;
            right: 14px;
            top: 14px;
            align-items: flex-start;
            flex-direction: column;
          }

          .video-title-overlay {
            font-size: 20px;
          }

          .stack-grid {
            grid-template-columns: 1fr;
          }

          .chapter-card {
            grid-template-columns: 1fr auto;
          }

          .chapter-time {
            grid-column: 1 / -1;
          }

          .footer-cta h2 {
            font-size: 44px;
          }

          .footer-meta-strip {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 380px) {
          .logo-text {
            display: none;
          }
        }
      `}</style>
    </>
  );
};

interface PulseCheckTechDemoPageProps {
  ogMeta: {
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
  };
}

export const getServerSideProps: GetServerSideProps<PulseCheckTechDemoPageProps> = async ({ req }) => {
  const origin = resolveDemoHost(req.headers.host);
  return {
    props: {
      ogMeta: {
        title: DEMO_TITLE,
        description: DEMO_DESCRIPTION,
        image: `${origin}/pil-og.png`,
        url: `${origin}/pulse-check-tech-demo`,
        type: 'article',
      },
    },
  };
};

export default PulseCheckTechDemoPage;
