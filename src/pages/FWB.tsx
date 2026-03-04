import React, { useState, useEffect, useRef } from 'react';
import PageHead from '../components/PageHead';
import { GetServerSideProps } from 'next';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

// Serializable version of PageMetaData for SSR props
interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string;
}

interface FWBProps {
  metaData: SerializablePageMetaData | null;
  ogMeta: {
    title: string;
    description: string;
    image: string;
    url: string;
  };
}

const FWB_PASSCODE = 'BLACKJOY';
const FWB_UNLOCK_KEY = 'fwb-unlocked';
const FWB_OG_URL = 'https://fitwithpulse.ai/FWB';
const FWB_OG_IMAGE = 'https://fitwithpulse.ai/fwb-hero-crew.png';
const FWB_DEFAULT_TITLE = 'Frens With Benefits x Pulse';
const FWB_DEFAULT_DESCRIPTION = 'A private proposal for Frens With Benefits to launch a branded digital community experience on Pulse.';

const FWB = ({ metaData }: FWBProps) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Check sessionStorage for existing unlock (client-side only)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const unlocked = sessionStorage.getItem(FWB_UNLOCK_KEY) === 'true';
      setIsUnlocked(!!unlocked);
    } catch {
      setIsUnlocked(false);
    }
  }, []);

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    const trimmed = passcodeInput.trim().toUpperCase();
    if (trimmed === FWB_PASSCODE) {
      try {
        sessionStorage.setItem(FWB_UNLOCK_KEY, 'true');
      } catch {
        // ignore
      }
      setIsUnlocked(true);
      setPasscodeInput('');
    } else {
      setPasscodeError('Incorrect passcode. Please try again.');
    }
  };

  // Scroll animation observer
  const flowStepsRef = useRef<(HTMLDivElement | null)[]>([]);
  const clubCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const journeyRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!isUnlocked) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.15 }
    );
    flowStepsRef.current.forEach((step) => {
      if (step) observer.observe(step);
    });
    clubCardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });
    journeyRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isUnlocked]);

  // Nav background on scroll
  useEffect(() => {
    if (!isUnlocked) return;
    const handleScroll = () => {
      const nav = document.getElementById('fwb-nav');
      if (!nav) return;
      if (window.scrollY > 100) {
        nav.style.background = 'rgba(10,10,10,0.95)';
      } else {
        nav.style.background = 'rgba(10,10,10,0.7)';
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isUnlocked]);

  // ─── Passcode Gate ───
  if (!isUnlocked) {
    return (
      <div style={{
        background: '#0A0A0A',
        color: '#F5F0EB',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <PageHead
          metaData={metaData}
          pageOgUrl={FWB_OG_URL}
          pageOgImage="/fwb-hero-crew.png"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <img src="/PulseWhite.png" alt="Pulse" style={{ height: 56, width: 'auto', marginBottom: 24 }} />
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 24,
          fontWeight: 700,
          color: '#F5F0EB',
          marginBottom: 4,
        }}>
          Frens With Benefits
        </h1>
        <p style={{
          color: '#8A8178',
          fontSize: 14,
          marginBottom: 24,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Enter passcode to view the proposal
        </p>
        <form onSubmit={handlePasscodeSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: '100%',
          maxWidth: 240,
        }}>
          <input
            type="password"
            value={passcodeInput}
            onChange={(e) => {
              setPasscodeInput(e.target.value.toUpperCase());
              setPasscodeError('');
            }}
            placeholder="Passcode"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              background: '#1A1A1A',
              border: '1px solid #333',
              color: '#F5F0EB',
              fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
              textTransform: 'uppercase',
              outline: 'none',
            }}
            autoComplete="off"
            autoFocus
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              background: '#C8A45E',
              color: '#0A0A0A',
              fontWeight: 700,
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              letterSpacing: 2,
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#D4B876')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#C8A45E')}
          >
            Enter
          </button>
          {passcodeError && (
            <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{passcodeError}</p>
          )}
        </form>
        <p style={{
          color: '#555',
          fontSize: 11,
          marginTop: 48,
          fontFamily: "'Space Mono', monospace",
          letterSpacing: 2,
        }}>
          fitwithpulse.ai
        </p>
      </div>
    );
  }

  // ─── Main Proposal ───
  return (
    <>
      <PageHead
        metaData={metaData}
        pageOgUrl={FWB_OG_URL}
        pageOgImage="/fwb-hero-crew.png"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <style jsx global>{`
        :root {
          --fwb-black: #0A0A0A;
          --fwb-white: #F5F0EB;
          --fwb-cream: #EDE7DF;
          --fwb-gold: #C8A45E;
          --fwb-gold-light: #D4B876;
          --fwb-warm-gray: #8A8178;
          --fwb-charcoal: #1A1A1A;
          --fwb-green: #C8FF00;
          --fwb-section-pad: clamp(60px, 10vw, 120px);
        }

        .fwb-page * { margin: 0; padding: 0; box-sizing: border-box; }

        .fwb-page {
          font-family: 'DM Sans', sans-serif;
          background: var(--fwb-black);
          color: var(--fwb-white);
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        /* ===== NAV ===== */
        .fwb-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          padding: 20px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          background: rgba(10,10,10,0.55);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: all 0.4s ease;
        }

        .fwb-nav-logo {
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--fwb-gold);
        }

        .fwb-nav-links {
          display: flex;
          gap: 32px;
          list-style: none;
        }

        .fwb-nav-links a {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--fwb-warm-gray);
          text-decoration: none;
          transition: color 0.3s;
        }

        .fwb-nav-links a:hover { color: var(--fwb-gold); }

        /* ===== HERO ===== */
        .fwb-hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 120px 40px 80px;
          position: relative;
          overflow: hidden;
        }

        .fwb-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(200,164,94,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(200,164,94,0.05) 0%, transparent 50%);
          pointer-events: none;
        }

        .fwb-hero-badge {
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--fwb-gold);
          margin-bottom: 40px;
          padding: 8px 20px;
          border-radius: 20px;
          background: rgba(200,164,94,0.06);
          border: 1px solid rgba(200,164,94,0.15);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          opacity: 0;
          animation: fwbFadeUp 0.8s 0.3s forwards;
        }

        .fwb-hero h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(42px, 7vw, 96px);
          font-weight: 900;
          line-height: 1.05;
          margin-bottom: 12px;
          opacity: 0;
          animation: fwbFadeUp 0.8s 0.5s forwards;
        }

        .fwb-hero h1 span {
          color: var(--fwb-gold);
          font-style: italic;
        }

        .fwb-hero-sub {
          font-family: 'Playfair Display', serif;
          font-size: clamp(20px, 3vw, 36px);
          font-weight: 400;
          font-style: italic;
          color: var(--fwb-green);
          margin-bottom: 40px;
          opacity: 0;
          animation: fwbFadeUp 0.8s 0.7s forwards;
        }

        .fwb-hero-intro {
          max-width: 600px;
          font-size: 16px;
          font-weight: 300;
          color: var(--fwb-warm-gray);
          line-height: 1.8;
          opacity: 0;
          animation: fwbFadeUp 0.8s 0.9s forwards;
        }

        .fwb-scroll-indicator {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          opacity: 0;
          animation: fwbFadeUp 0.8s 1.2s forwards;
        }

        .fwb-scroll-indicator span {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--fwb-warm-gray);
        }

        .fwb-scroll-line {
          width: 1px;
          height: 40px;
          background: linear-gradient(to bottom, var(--fwb-gold), transparent);
          animation: fwbScrollPulse 2s infinite;
        }

        /* ===== SECTIONS ===== */
        .fwb-section {
          padding: var(--fwb-section-pad) 40px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .fwb-section-label {
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--fwb-gold);
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .fwb-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }

        .fwb-section-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(28px, 4vw, 52px);
          font-weight: 700;
          line-height: 1.15;
          margin-bottom: 24px;
        }

        .fwb-section-text {
          font-size: 16px;
          font-weight: 300;
          color: var(--fwb-warm-gray);
          line-height: 1.8;
          max-width: 680px;
        }

        /* ===== PILLARS ===== */
        .fwb-pillars-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 60px;
        }

        .fwb-pillar-card {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 48px 36px;
          position: relative;
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: default;
        }

        .fwb-pillar-card:hover {
          background: rgba(200,164,94,0.06);
          border-color: rgba(200,164,94,0.15);
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }

        .fwb-pillar-number {
          font-family: 'Playfair Display', serif;
          font-size: 72px;
          font-weight: 900;
          color: rgba(200,164,94,0.08);
          position: absolute;
          top: 16px;
          right: 24px;
          line-height: 1;
        }

        .fwb-pillar-title {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 16px;
          color: var(--fwb-gold);
        }

        .fwb-pillar-desc {
          font-size: 14px;
          font-weight: 300;
          color: var(--fwb-warm-gray);
          line-height: 1.7;
        }

        /* ===== EXPERIENCE FLOW ===== */
        .fwb-flow-container {
          margin-top: 60px;
        }

        .fwb-flow-step {
          display: grid;
          grid-template-columns: 80px 1fr;
          gap: 40px;
          padding: 48px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          opacity: 0;
          transform: translateY(30px);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fwb-flow-step.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .fwb-flow-number {
          font-family: 'Playfair Display', serif;
          font-size: 48px;
          font-weight: 900;
          color: var(--fwb-gold);
          line-height: 1;
        }

        .fwb-flow-content h3 {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .fwb-flow-content p {
          font-size: 15px;
          font-weight: 300;
          color: var(--fwb-warm-gray);
          line-height: 1.8;
          max-width: 600px;
        }

        .fwb-flow-tag {
          display: inline-block;
          margin-top: 16px;
          padding: 6px 16px;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--fwb-gold);
          border: 1px solid rgba(200,164,94,0.2);
          border-radius: 20px;
          background: rgba(200,164,94,0.04);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        /* ===== FUNNEL ===== */
        .fwb-funnel-visual {
          margin-top: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .fwb-funnel-stage {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
          text-align: center;
          position: relative;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: default;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          background: rgba(255,255,255,0.02);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .fwb-funnel-stage:hover {
          border-color: rgba(200,164,94,0.25);
          background: rgba(200,164,94,0.05);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }

        .fwb-funnel-stage:nth-child(1) { width: 100%; }
        .fwb-funnel-stage:nth-child(3) { width: 85%; }
        .fwb-funnel-stage:nth-child(5) { width: 70%; }
        .fwb-funnel-stage:nth-child(7) { width: 55%; }
        .fwb-funnel-stage:nth-child(9) { width: 42%; }

        .fwb-funnel-stage-label {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--fwb-gold);
          margin-bottom: 6px;
        }

        .fwb-funnel-stage-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 700;
        }

        .fwb-funnel-stage-desc {
          font-size: 13px;
          font-weight: 300;
          color: var(--fwb-warm-gray);
          margin-top: 4px;
        }

        .fwb-funnel-arrow {
          color: var(--fwb-gold);
          font-size: 20px;
          opacity: 0.4;
        }

        /* ===== MONETIZATION ===== */
        .fwb-money-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 60px;
        }

        .fwb-money-card {
          padding: 48px 40px;
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          position: relative;
          transition: all 0.4s ease;
        }

        .fwb-money-card:hover {
          background: rgba(200,164,94,0.05);
          border-color: rgba(200,164,94,0.15);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }

        .fwb-money-card.featured {
          border: 1px solid rgba(200,164,94,0.25);
          background: rgba(200,164,94,0.04);
          box-shadow: 0 0 60px rgba(200,164,94,0.04);
        }

        .fwb-money-badge {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--fwb-gold);
          margin-bottom: 16px;
        }

        .fwb-money-title {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .fwb-money-desc {
          font-size: 14px;
          font-weight: 300;
          color: var(--fwb-warm-gray);
          line-height: 1.7;
        }

        .fwb-money-price {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          font-weight: 900;
          color: var(--fwb-gold);
          margin-top: 20px;
        }

        .fwb-money-price span {
          font-size: 14px;
          font-weight: 400;
          color: var(--fwb-warm-gray);
        }

        /* ===== PREMIER CLUB CTA ===== */
        .fwb-premier-section {
          text-align: center;
          padding: var(--fwb-section-pad) 40px;
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
        }

        .fwb-premier-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          height: 80px;
          background: linear-gradient(to bottom, transparent, var(--fwb-gold));
        }

        .fwb-premier-box {
          margin-top: 40px;
          padding: 60px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          background: rgba(255,255,255,0.02);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
        }

        .fwb-premier-box::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(ellipse at center, rgba(200,164,94,0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        .fwb-premier-box h3 {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 16px;
          position: relative;
        }

        .fwb-premier-box p {
          font-size: 16px;
          font-weight: 300;
          color: var(--fwb-warm-gray);
          line-height: 1.8;
          max-width: 550px;
          margin: 0 auto 32px;
          position: relative;
        }

        .fwb-btn-premier {
          display: inline-block;
          padding: 16px 48px;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--fwb-black);
          background: var(--fwb-gold);
          border-radius: 14px;
          text-decoration: none;
          transition: all 0.4s ease;
          cursor: pointer;
          position: relative;
        }

        .fwb-btn-premier:hover {
          background: var(--fwb-gold-light);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(200,164,94,0.3);
        }

        /* ===== MANAGEMENT ===== */
        .fwb-manage-features {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-top: 60px;
        }

        .fwb-manage-feature {
          padding: 36px;
          border-radius: 20px;
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          transition: all 0.4s ease;
        }

        .fwb-manage-feature:hover {
          border-color: rgba(200,164,94,0.15);
          background: rgba(200,164,94,0.04);
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }

        .fwb-manage-feature h4 {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .fwb-manage-feature p {
          font-size: 14px;
          font-weight: 300;
          color: var(--fwb-warm-gray);
          line-height: 1.7;
        }

        /* ===== CLOSING ===== */
        .fwb-closing {
          text-align: center;
          padding: 120px 40px;
          max-width: 800px;
          margin: 0 auto;
          position: relative;
        }

        .fwb-closing-quote {
          font-family: 'Playfair Display', serif;
          font-size: clamp(24px, 3.5vw, 42px);
          font-weight: 400;
          font-style: italic;
          line-height: 1.4;
          margin-bottom: 32px;
          color: var(--fwb-white);
        }

        .fwb-closing-quote span {
          color: var(--fwb-gold);
        }

        .fwb-closing-attribution {
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--fwb-warm-gray);
          margin-bottom: 60px;
        }

        .fwb-closing-cta {
          display: inline-block;
          padding: 20px 60px;
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--fwb-black);
          background: var(--fwb-gold);
          border-radius: 14px;
          text-decoration: none;
          transition: all 0.4s ease;
          cursor: pointer;
        }

        .fwb-closing-cta:hover {
          background: var(--fwb-gold-light);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(200,164,94,0.3);
        }

        /* ===== FOOTER ===== */
        .fwb-footer {
          text-align: center;
          padding: 40px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .fwb-footer p {
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          letter-spacing: 2px;
          color: var(--fwb-warm-gray);
        }

        .fwb-footer a {
          color: var(--fwb-gold);
          text-decoration: none;
        }

        /* ===== DIVIDER ===== */
        .fwb-divider {
          width: 60px;
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 0 auto;
        }

        /* ===== PHONE MOCKUP ===== */
        .fwb-preview-layout {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 80px;
          margin-top: 60px;
        }

        .fwb-preview-text {
          max-width: 440px;
          text-align: left;
        }

        .fwb-preview-text h3 {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 16px;
          line-height: 1.2;
        }

        .fwb-preview-text p {
          font-size: 16px;
          font-weight: 300;
          color: var(--fwb-warm-gray);
          line-height: 1.8;
          margin-bottom: 32px;
        }

        .fwb-phone-frame {
          width: 340px;
          height: 735px;
          border-radius: 46px;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08),
            0 0 0 3px rgba(10,10,10,0.9),
            0 0 40px rgba(200,164,94,0.08),
            0 30px 90px rgba(0,0,0,0.7),
            inset 0 0 0 1px rgba(255,255,255,0.04);
        }

        .fwb-phone-screen {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          position: relative;
          background: #0E0807;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .fwb-phone-screen::-webkit-scrollbar { display: none; }

        @keyframes fwbPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.8); }
        }

        /* ===== ANIMATIONS ===== */
        @keyframes fwbFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fwbScrollPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 960px) {
          .fwb-preview-layout {
            flex-direction: column !important;
            gap: 48px !important;
          }
          .fwb-preview-text {
            text-align: center !important;
            max-width: 600px !important;
          }
        }

        @media (max-width: 768px) {
          .fwb-nav { padding: 16px 24px !important; }
          .fwb-nav-links { display: none !important; }
          .fwb-section,
          .fwb-premier-section,
          .fwb-closing { padding-left: 24px !important; padding-right: 24px !important; }
          .fwb-pillars-grid { grid-template-columns: 1fr !important; }
          .fwb-money-grid { grid-template-columns: 1fr !important; }
          .fwb-manage-features { grid-template-columns: 1fr !important; }
          .fwb-flow-step { grid-template-columns: 50px 1fr !important; gap: 24px !important; }
          .fwb-flow-number { font-size: 36px !important; }
          .fwb-premier-box { padding: 40px 24px !important; }
          .fwb-hero { padding: 100px 24px 60px !important; }
          .fwb-phone-frame {
            width: 300px !important;
            height: 650px !important;
            border-radius: 40px !important;
          }
        }
      `}</style>

      <div className="fwb-page">
        {/* NAV */}
        <nav className="fwb-nav" id="fwb-nav">
          <div className="fwb-nav-logo">Pulse × FWB</div>
          <ul className="fwb-nav-links">
            <li><a href="#preview">Preview</a></li>
            <li><a href="#vision">Vision</a></li>
            <li><a href="#journey">Journey</a></li>
            <li><a href="#clubs">Clubs</a></li>
            <li><a href="#monetize">Platform</a></li>
            <li><a href="#manage">Manage</a></li>
          </ul>
        </nav>

        {/* HERO */}
        <div className="fwb-hero">
          <div className="fwb-hero-badge">Partnership Proposal</div>
          <h1>Frens With <span>Benefits</span></h1>
          <div className="fwb-hero-sub">Powered by Pulse</div>
          <p className="fwb-hero-intro">
            A proposal for Nile Jones and the FWB community — bringing Black Art, Black Joy, and Black Culture to the digital fitness experience. This is what your club looks like on Pulse.
          </p>
          <div className="fwb-scroll-indicator">
            <span>Explore</span>
            <div className="fwb-scroll-line"></div>
          </div>
        </div>

        {/* YOUR CLUB ON PULSE — PHONE MOCKUP */}
        <div className="fwb-premier-section" id="preview">
          <div className="fwb-section-label" style={{ justifyContent: 'center' }}>Your Club on Pulse</div>
          <h2 className="fwb-section-title">
            This is what FWB<br />looks like on Pulse.
          </h2>

          <div className="fwb-preview-layout">
            {/* FWB Phone Mockup */}
            <div className="fwb-phone-frame">
              <div className="fwb-phone-screen">
                {/* Hero with photo melt */}
                <div style={{ position: 'relative', height: 400, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: "url('/fwb-hero-crew.png') center 30% / cover no-repeat",
                    filter: 'saturate(1.1) brightness(0.95)',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, transparent 0%, transparent 25%, rgba(14,8,7,0.25) 40%, rgba(14,8,7,0.65) 55%, rgba(14,8,7,0.9) 72%, #0E0807 100%)',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: -20, left: '-20%', right: '-20%', height: 250,
                    background: 'radial-gradient(ellipse at 50% 100%, rgba(218,120,55,0.12) 0%, transparent 65%)',
                    pointerEvents: 'none',
                  }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 24px', zIndex: 5 }}>
                    <div style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 36, fontWeight: 700, lineHeight: 1,
                      textTransform: 'uppercase' as const, letterSpacing: -1,
                    }}>
                      FRENS WITH<br /><span style={{ color: '#DA7837' }}>BENEFITS</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                      by <span style={{ color: '#DA7837', fontWeight: 600 }}>@nilejones</span>
                      <span>•</span>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DA7837', animation: 'fwbPulseDot 2s infinite' }} />
                      <span>247 members</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                      {['Black Art', 'Black Joy', 'Black Culture'].map((pill) => (
                        <div key={pill} style={{
                          padding: '4px 11px', fontSize: 9, fontWeight: 700, letterSpacing: 1,
                          textTransform: 'uppercase' as const, borderRadius: 20,
                          background: 'rgba(218,120,55,0.15)', color: '#DA7837',
                          border: '1px solid rgba(218,120,55,0.25)',
                        }}>{pill}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{
                  position: 'relative', paddingBottom: 20,
                  background: 'radial-gradient(ellipse at 50% 0%, rgba(218,120,55,0.06) 0%, transparent 50%), linear-gradient(180deg, #0E0807 0%, #0A0605 100%)',
                }}>
                  {/* Bio Card */}
                  <div style={{
                    margin: '16px 16px 0', padding: '14px 18px', borderRadius: 16,
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    background: 'rgba(218,120,55,0.05)', border: '1px solid rgba(218,120,55,0.1)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 15, flexShrink: 0,
                        background: 'linear-gradient(135deg, #DA7837, #B85A20)', color: '#fff',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}>NJ</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', fontWeight: 400, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        Culture meets fitness. Track days, strength sessions, and community — rooted in Black joy.
                      </div>
                    </div>
                  </div>

                  {/* Join Button */}
                  <div style={{
                    margin: '14px 16px 0', padding: 15, borderRadius: 14,
                    fontWeight: 700, fontSize: 15, textAlign: 'center' as const,
                    background: '#DA7837', color: '#fff',
                    boxShadow: '0 4px 24px rgba(218,120,55,0.2), 0 0 60px rgba(218,120,55,0.06)',
                    letterSpacing: 0.3, fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}>Join FWB</div>

                  {/* Tabs */}
                  <div style={{ display: 'flex', margin: '22px 16px 0' }}>
                    {['Feed', 'Members', 'Events'].map((tab, i) => (
                      <div key={tab} style={{
                        flex: 1, textAlign: 'center' as const, padding: '13px 0',
                        fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
                        textTransform: 'uppercase' as const,
                        color: i === 0 ? '#DA7837' : 'rgba(255,255,255,0.3)',
                        position: 'relative',
                        borderBottom: i === 0 ? '2px solid #DA7837' : '1px solid rgba(255,255,255,0.04)',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}>{tab}</div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 3, margin: '18px 16px 0' }}>
                    {[
                      { n: '247', l: 'Members' },
                      { n: '38', l: 'Active' },
                      { n: '5', l: 'Events' },
                    ].map((s) => (
                      <div key={s.l} style={{
                        flex: 1, padding: '14px 8px', borderRadius: 12, textAlign: 'center' as const,
                        background: 'rgba(218,120,55,0.04)', border: '1px solid rgba(218,120,55,0.06)',
                      }}>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: '#DA7837' }}>{s.n}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Feed */}
                  <div style={{ margin: '20px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.25)', marginBottom: 10, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Recent</div>
                    {[
                      { name: 'Nile', time: '1h', body: 'Saturday track day at Morris Brown — 400m repeats + core circuit. Bring the energy 🏟️', fire: '67', comments: '23' },
                      { name: 'Aja M.', time: '3h', body: 'First week with FWB and I already found my people. The vibes are unmatched 🧡', fire: '89', comments: '15' },
                    ].map((post, i) => (
                      <div key={i} style={{
                        padding: '14px 16px', borderRadius: 14, marginBottom: 8,
                        border: '1px solid rgba(255,255,255,0.03)',
                        background: 'rgba(218,120,55,0.02)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg, #DA7837, #B85A20)' }} />
                          <span style={{ fontWeight: 600, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{post.name}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>{post.time}</span>
                        </div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.65)', fontWeight: 300, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{post.body}</div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                          <span>🔥 {post.fire}</span>
                          <span>💬 {post.comments}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 32px' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 300, flexShrink: 0, background: '#DA7837', color: '#fff',
                    }}>+</div>
                    <div style={{
                      flex: 1, padding: '10px 16px', borderRadius: 20,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)',
                      fontSize: 13, color: 'rgba(255,255,255,0.25)', fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}>Message...</div>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0, background: 'rgba(218,120,55,0.1)', color: '#DA7837',
                    }}>🎤</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Text content */}
            <div className="fwb-preview-text">
              <h3>This is what your club can look like.</h3>
              <p>
                Every detail — from the hero image to the terra cotta brand color, the member feed, stats, and event tabs — is designed around FWB's identity. Your members get a premium, branded experience from the moment they open it.
              </p>
              <p>
                Your brand color, your content, your community — all in one app. Scroll through to see the full experience.
              </p>
            </div>
          </div>
        </div>

        {/* VISION */}
        <section className="fwb-section" id="vision">
          <div className="fwb-section-label">01 — The Vision</div>
          <h2 className="fwb-section-title">
            Your movement,<br />amplified.
          </h2>
          <p className="fwb-section-text">
            FWB gives people a reason to come together that isn't just another night out. Pulse gives your movement a premium digital home where the energy, connection, and growth live on beyond the physical track.
          </p>

          <div className="fwb-pillars-grid">
            <div className="fwb-pillar-card">
              <div className="fwb-pillar-number">01</div>
              <div className="fwb-pillar-title">Black Art</div>
              <p className="fwb-pillar-desc">Your creative identity seamlessly embedded. A dedicated space that looks, feels, and acts as a true extension of your brand.</p>
            </div>
            <div className="fwb-pillar-card">
              <div className="fwb-pillar-number">02</div>
              <div className="fwb-pillar-title">Black Joy</div>
              <p className="fwb-pillar-desc">Translate that in-person electricity into a digital space where the vibe never drops between track days.</p>
            </div>
            <div className="fwb-pillar-card">
              <div className="fwb-pillar-number">03</div>
              <div className="fwb-pillar-title">Black Culture</div>
              <p className="fwb-pillar-desc">Community first, always. A platform built to cultivate connection and put your people front and center.</p>
            </div>
          </div>
        </section>

        {/* EXPERIENCE FLOW */}
        <section className="fwb-section" id="experience">
          <div className="fwb-section-label">02 — The FWB Experience</div>
          <h2 className="fwb-section-title">
            How your crew moves<br />on Pulse.
          </h2>
          <p className="fwb-section-text">
            From discovering FWB to becoming a loyal member, we make the journey effortless. Build an inclusive community that funnels naturally into premium experiences.
          </p>

          <div className="fwb-flow-container">
            {[
              {
                num: '01',
                title: 'Discover & Join',
                desc: "A link in your bio drops them into a customized FWB experience. One tap, and they're instantly plugged into your community.",
                tag: 'Entry Point',
              },
              {
                num: '02',
                title: 'Train Together',
                desc: "Track days and programmed strength sessions live on Pulse. Members follow the workout in real time and hit their PRs as a unit.",
                tag: 'Core Experience',
              },
              {
                num: '03',
                title: 'Keep the Vibe Alive',
                desc: "The workout ends, but the chat keeps going. Feed posts, member highlights, and event RSVPs create a social loop that brings them back.",
                tag: 'Engagement Loop',
              },
              {
                num: '04',
                title: 'Level Up to Premium',
                desc: "Offer VIP events, specialized programs, and exclusive content to members who want more. The free community feeds the premium tier organically.",
                tag: 'Upsell',
              },
            ].map((step, i) => (
              <div
                key={step.num}
                className="fwb-flow-step"
                ref={(el) => { flowStepsRef.current[i] = el; }}
              >
                <div className="fwb-flow-number">{step.num}</div>
                <div className="fwb-flow-content">
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                  <div className="fwb-flow-tag">{step.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </section>



        <style>{`
          .fwb-clubs-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 60px;
          }
          .fwb-club-showcase-card {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 32px;
            padding: 40px;
            transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
            transform: translateY(30px);
          }
          .fwb-club-showcase-card.visible {
            opacity: 1;
            transform: translateY(0);
          }
          .fwb-club-showcase-phone {
            width: 320px;
            height: 680px;
            background: #000;
            border-radius: 46px;
            border: 12px solid #1A1A1A;
            box-shadow: 0 40px 100px rgba(0,0,0,0.4), inset 0 0 0 2px rgba(255,255,255,0.1);
            position: relative;
            overflow: hidden;
            margin: 0 auto;
          }
          .fwb-club-showcase-phone-inner {
            height: 100%;
            overflow-y: auto;
            scrollbar-width: none;
            position: relative;
          }
          .fwb-club-showcase-phone-inner::-webkit-scrollbar {
            display: none;
          }
          .pulse-chat-msg {
            display: flex; gap: 12px; margin-bottom: 20px;
          }
          .pulse-chat-avatar {
            width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700; color: #fff;
          }
          .pulse-chat-bubble {
            background: #1A1A1A; border-radius: 12px; padding: 12px 14px;
            font-size: 13px; line-height: 1.5; color: #EEE; border: 1px solid #222;
          }
          @media (max-width: 768px) {
            .fwb-clubs-grid { grid-template-columns: 1fr; }
            .fwb-club-showcase-phone { width: 100%; max-width: 320px; height: 600px; }
          }
        `}</style>

        {/* THE MEMBER JOURNEY */}
        <section className="fwb-section" id="journey">
          <div className="fwb-section-label">02 — The Member Journey</div>
          <h2 className="fwb-section-title">
            From tap <br />to obsession.
          </h2>
          <p className="fwb-section-text">
            This isn't just a group chat. It's a fully immersive community experience designed to activate members, gamify growth, and keep them coming back.
          </p>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 120, marginTop: 80
          }}>
            {/* Step 1: Join */}
            <div className={`fwb-club-showcase-card ${isUnlocked ? 'visible' : ''}`} ref={(el) => { journeyRefs.current[0] = el; }} style={{ background: 'transparent', border: 'none', padding: 0, opacity: 1, transform: 'none' }}>
              <div style={{ display: 'flex', gap: 60, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ color: 'var(--fwb-gold)', fontFamily: "'Space Mono', monospace", fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>Step 01: Activation</div>
                  <h3 style={{ fontSize: 32, fontFamily: "'Playfair Display', serif", marginBottom: 16 }}>They drop in.</h3>
                  <p style={{ color: 'var(--fwb-warm-gray)', fontSize: 16, lineHeight: 1.7 }}>
                    Your link in bio leads to a premium landing page. They read the vision, select a tier, and securely join. No friction.
                  </p>
                </div>
                <div style={{ flex: '1 1 300px' }}>
                  {/* Reuse existing phone frame from head for illustration if needed, or simple mock */}
                  <div style={{
                    padding: 30, background: 'rgba(255,255,255,0.03)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', justifyContent: 'center'
                  }}>
                    <div style={{ width: '100%', maxWidth: 260, padding: 24, background: '#111', borderRadius: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', border: '1px solid #222' }}>
                      <div style={{ width: 60, height: 60, background: '#DA7837', borderRadius: 16, marginBottom: 20 }} />
                      <div style={{ height: 24, background: '#333', borderRadius: 4, width: '80%', marginBottom: 12 }} />
                      <div style={{ height: 16, background: '#222', borderRadius: 4, width: '100%', marginBottom: 8 }} />
                      <div style={{ height: 16, background: '#222', borderRadius: 4, width: '90%', marginBottom: 32 }} />
                      <div style={{ height: 48, background: '#DA7837', borderRadius: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>Join Club</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Chat */}
            <div className={`fwb-club-showcase-card`} ref={(el) => { journeyRefs.current[1] = el; }} style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <div style={{ display: 'flex', gap: 60, alignItems: 'center', flexWrap: 'wrap', flexDirection: 'row-reverse' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ color: 'var(--fwb-gold)', fontFamily: "'Space Mono', monospace", fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>Step 02: Connection</div>
                  <h3 style={{ fontSize: 32, fontFamily: "'Playfair Display', serif", marginBottom: 16 }}>They tap in.</h3>
                  <p style={{ color: 'var(--fwb-warm-gray)', fontSize: 16, lineHeight: 1.7 }}>
                    The Pulse Club Chat organizes conversations elegantly. Threaded replies, challenge drops directly in-stream, and a UI that feels like home.
                  </p>
                </div>
                <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
                  <div className="fwb-club-showcase-phone" style={{ borderColor: '#DA7837' }}>
                    <div className="fwb-club-showcase-phone-inner" style={{ background: '#070E08', padding: '50px 16px 20px' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 30, fontFamily: "'Playfair Display', serif" }}>Pulse Chat</div>

                      <div className="pulse-chat-msg">
                        <div className="pulse-chat-avatar" style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)' }}>JT</div>
                        <div>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Jason • 9:41 AM</div>
                          <div className="pulse-chat-bubble">Just finished the morning track session. Legs are dead.</div>
                        </div>
                      </div>

                      <div className="pulse-chat-msg" style={{ flexDirection: 'row-reverse' }}>
                        <div className="pulse-chat-avatar" style={{ background: '#DA7837' }}>Me</div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>You • 9:45 AM</div>
                          <div className="pulse-chat-bubble" style={{ background: 'rgba(218,120,55,0.15)', borderColor: 'rgba(218,120,55,0.4)', color: '#fff' }}>Good stuff bro! Make sure to log it on the leaderboard.</div>
                        </div>
                      </div>

                      {/* System Message / Challenge */}
                      <div style={{ margin: '30px 0', padding: 16, background: '#111', borderRadius: 16, border: '1px solid #222' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <div style={{ width: 8, height: 8, background: '#DA7837', borderRadius: '50%' }} />
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#DA7837' }}>New Challenge</div>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>The 10k Weekend</div>
                        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Log 10,000 meters before Sunday night. Top 3 get pinned.</div>
                        <div style={{ padding: '10px 0', background: '#222', borderRadius: 8, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#fff' }}>Accept Challenge</div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Leaderboard */}
            <div className={`fwb-club-showcase-card`} ref={(el) => { journeyRefs.current[2] = el; }} style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <div style={{ display: 'flex', gap: 60, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ color: 'var(--fwb-gold)', fontFamily: "'Space Mono', monospace", fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>Step 03: Engagement</div>
                  <h3 style={{ fontSize: 32, fontFamily: "'Playfair Display', serif", marginBottom: 16 }}>They compete.</h3>
                  <p style={{ color: 'var(--fwb-warm-gray)', fontSize: 16, lineHeight: 1.7 }}>
                    Gamification is baked in. Members track workouts and nutrition, earning points that climb the live club leaderboard. Friendly competition drives insane retention.
                  </p>
                </div>
                <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
                  <div className="fwb-club-showcase-phone" style={{ borderColor: '#DA7837' }}>
                    <div className="fwb-club-showcase-phone-inner" style={{ background: '#070E08', padding: '50px 16px 20px' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 20, fontFamily: "'Playfair Display', serif" }}>Leaderboard</div>

                      {/* Toggles */}
                      <div style={{ display: 'flex', background: '#111', borderRadius: 12, padding: 4, marginBottom: 30 }}>
                        <div style={{ flex: 1, padding: '8px 0', background: '#222', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 600 }}>Workouts</div>
                        <div style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#888' }}>Nutrition</div>
                      </div>

                      {/* Podium */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 40, height: 140 }}>
                        {/* 2nd */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#333', marginBottom: 8, border: '2px solid silver' }} />
                          <div style={{ width: '100%', height: 70, background: 'linear-gradient(to top, rgba(255,255,255,0.05), transparent)', borderTopLeftRadius: 8, borderTopRightRadius: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8 }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: 'silver' }}>2</span>
                          </div>
                        </div>
                        {/* 1st */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#DA7837', marginBottom: 8, border: '2px solid gold' }} />
                          <div style={{ width: '100%', height: 100, background: 'linear-gradient(to top, rgba(218,120,55,0.15), transparent)', borderTopLeftRadius: 8, borderTopRightRadius: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8 }}>
                            <span style={{ fontSize: 24, fontWeight: 800, color: 'gold' }}>1</span>
                          </div>
                        </div>
                        {/* 3rd */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#333', marginBottom: 8, border: '2px solid #cd7f32' }} />
                          <div style={{ width: '100%', height: 50, background: 'linear-gradient(to top, rgba(255,255,255,0.05), transparent)', borderTopLeftRadius: 8, borderTopRightRadius: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8 }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: '#cd7f32' }}>3</span>
                          </div>
                        </div>
                      </div>

                      {/* List */}
                      {[4, 5, 6].map(rank => (
                        <div key={rank} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1A1A1A' }}>
                          <div style={{ width: 24, fontSize: 13, fontWeight: 700, color: '#888' }}>{rank}</div>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#222', marginRight: 12 }} />
                          <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Member {rank}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#DA7837' }}>{1200 - (rank * 100)} pts</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Retention */}
            <div className={`fwb-club-showcase-card`} ref={(el) => { journeyRefs.current[3] = el; }} style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <div style={{ display: 'flex', gap: 60, alignItems: 'center', flexWrap: 'wrap', flexDirection: 'row-reverse' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ color: 'var(--fwb-gold)', fontFamily: "'Space Mono', monospace", fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>Step 04: Retention</div>
                  <h3 style={{ fontSize: 32, fontFamily: "'Playfair Display', serif", marginBottom: 16 }}>They stay.</h3>
                  <p style={{ color: 'var(--fwb-warm-gray)', fontSize: 16, lineHeight: 1.7 }}>
                    Through push notifications, daily habits, and pure social gravity, FWB members build a routine on Pulse. They don't just consume your content; they belong to your eco-system.
                  </p>
                </div>
                <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    padding: 30, background: 'rgba(255,255,255,0.03)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 260
                  }}>
                    <div style={{ padding: 16, background: '#111', borderRadius: 16, border: '1px solid #222', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(218,120,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔥</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>3 Day Daily Streak!</div>
                        <div style={{ fontSize: 11, color: '#888' }}>You're on fire. Keep going.</div>
                      </div>
                    </div>
                    <div style={{ padding: 16, background: '#111', borderRadius: 16, border: '1px solid #222', display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,200,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💧</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Hydration Goal Met</div>
                        <div style={{ fontSize: 11, color: '#888' }}>+50 Club Points</div>
                      </div>
                    </div>
                    <div style={{ padding: 16, background: '#111', borderRadius: 16, border: '1px solid #222', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(200,255,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💬</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>New post in FWB</div>
                        <div style={{ fontSize: 11, color: '#888' }}>Nile just dropped a new video.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* CLUBS ALREADY ON PULSE */}
        <section className="fwb-section" id="clubs">
          <div className="fwb-section-label">03 — Clubs Already on Pulse</div>
          <h2 className="fwb-section-title">
            The platform is live.<br />The energy is real.
          </h2>
          <p className="fwb-section-text">
            Pulse isn't an idea. It's a living ecosystem powering real communities right now. Take a look at clubs currently mobilizing their members on the platform.
          </p>

          <div className="fwb-clubs-grid">

            {/* THE PACT */}
            <div
              className={`fwb-club-showcase-card`}
              ref={(el) => { clubCardRefs.current[0] = el; }}
              style={{
                background: 'rgba(200,255,0,0.03)',
                border: '1px solid rgba(200,255,0,0.1)',
              }}
            >
              <div className="fwb-club-showcase-phone">
                <div className="fwb-club-showcase-phone-inner" style={{ background: '#070E08' }}>
                  {/* Hero — matching iOS ClubDetailView exactly */}
                  <div style={{ position: 'relative', height: 340, overflow: 'hidden' }}>
                    {/* Cover image — group running scene */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: "url('https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80') center 20% / cover no-repeat",
                      filter: 'saturate(1.15)',
                    }} />
                    {/* Accent color overlay blend */}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(200,255,0,0.10)', mixBlendMode: 'overlay' }} />
                    {/* Radial vignette */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'radial-gradient(circle at center, transparent 30%, rgba(7,14,8,0.6) 75%)',
                    }} />
                    {/* The Melt — dissolves photo into brand background */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 12%, transparent 20%, rgba(7,14,8,0.05) 28%, rgba(7,14,8,0.14) 36%, rgba(7,14,8,0.35) 44%, rgba(7,14,8,0.55) 52%, rgba(7,14,8,0.75) 60%, rgba(7,14,8,0.90) 70%, rgba(7,14,8,0.97) 80%, #070E08 88%)',
                    }} />
                    {/* Accent glow at bottom */}
                    <div style={{
                      position: 'absolute', bottom: -30, left: '10%', right: '10%', height: 100,
                      background: 'radial-gradient(ellipse at 50% 100%, rgba(200,255,0,0.08) 0%, transparent 60%)',
                    }} />
                    {/* Text overlay — bottom-left anchored */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px', zIndex: 5 }}>
                      {/* Club type badge pill */}
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
                        padding: '5px 12px', borderRadius: 20,
                        background: 'rgba(200,255,0,0.15)', border: '1px solid rgba(200,255,0,0.4)',
                        fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: '#C8FF00',
                      }}>💪 TRAINING CLUB</div>
                      {/* Club name — ALL CAPS HEAVY */}
                      <h3 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5, textTransform: 'uppercase', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>THE PACT</h3>
                      {/* Tagline — italic, actual text */}
                      <p style={{ fontSize: 13, fontWeight: 500, fontStyle: 'italic', color: 'rgba(255,255,255,0.65)', margin: '0 0 8px' }}>We lift. We run. We honor The Pact</p>
                      {/* by @username • pulsing dot • member count + logo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>by</span>
                        <span style={{ color: '#C8FF00', fontWeight: 700 }}>@thetrefecta</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#C8FF00', boxShadow: '0 0 6px rgba(200,255,0,0.6)', animation: 'fwbPulseDot 2s infinite' }} />
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>98 members</span>
                        {/* Logo circle on right */}
                        <div style={{ marginLeft: 'auto' }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%', background: '#fff',
                            border: '1px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Body — Bio card + Tabs + Stats */}
                  <div style={{ padding: '0 16px', background: '#070E08' }}>
                    {/* Bio Card */}
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 18px', borderRadius: 16, marginTop: 16,
                      background: 'rgba(200,255,0,0.05)', border: '1px solid rgba(200,255,0,0.1)',
                    }}>
                      {/* Profile photo placeholder — rounded square */}
                      <div style={{
                        width: 42, height: 42, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
                        background: 'linear-gradient(135deg, #C8FF00, #96BF00)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{
                          width: '100%', height: '100%',
                          background: "url('https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&q=80') center / cover no-repeat",
                          borderRadius: 12,
                        }} />
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
                        The Pact isn't just a training club—it's a commitment. We are a crew built on the non-negotiable principle of showing up. Whether we're lifting heavy, logging miles, or tackling grueling weekly challenges, we do it as one.
                      </div>
                    </div>
                    {/* Tab Bar — PULSE | MEMBERS | CHALLENGES */}
                    <div style={{ display: 'flex', marginTop: 22 }}>
                      {['Pulse', 'Members', 'Challenges'].map((tab, i) => (
                        <div key={tab} style={{
                          flex: 1, textAlign: 'center', paddingBottom: 12,
                          fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase',
                          color: i === 1 ? '#C8FF00' : 'rgba(255,255,255,0.3)',
                          borderBottom: i === 1 ? '2px solid #C8FF00' : '1px solid rgba(255,255,255,0.04)',
                          boxShadow: i === 1 ? '0 2px 10px rgba(200,255,0,0.3)' : 'none',
                        }}>{tab}</div>
                      ))}
                    </div>
                    {/* Stats Row — 98 MEMBERS | 98 ACTIVE | 1 CHALLENGES */}
                    <div style={{ display: 'flex', gap: 3, marginTop: 16, paddingBottom: 16 }}>
                      {[
                        { val: '98', label: 'MEMBERS' },
                        { val: '98', label: 'ACTIVE' },
                        { val: '1', label: 'CHALLENGES' },
                      ].map((stat) => (
                        <div key={stat.label} style={{
                          flex: 1, textAlign: 'center', padding: '14px 0',
                          borderRadius: 12,
                          background: 'rgba(200,255,0,0.025)',
                          border: '0.5px solid rgba(200,255,0,0.035)',
                        }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#C8FF00' }}>{stat.val}</div>
                          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <h4 style={{ fontSize: 20, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>The Pact</h4>
                <p style={{ fontSize: 14, color: 'var(--fwb-warm-gray)', lineHeight: 1.6 }}>
                  98 members strong and growing. A high-intensity crew using Pulse to run brutal weekly challenges and hold each other accountable.
                </p>
                <p style={{
                  marginTop: 16, fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--fwb-green)'
                }}>
                  "Pulse gave us a home base."
                </p>
              </div>
            </div>

            {/* BULK UP */}
            <div
              className={`fwb-club-showcase-card`}
              ref={(el) => { clubCardRefs.current[1] = el; }}
              style={{
                background: 'rgba(192,57,43,0.03)',
                border: '1px solid rgba(192,57,43,0.1)',
              }}
            >
              <div className="fwb-club-showcase-phone">
                <div className="fwb-club-showcase-phone-inner" style={{ background: '#100606' }}>
                  {/* Hero — dark red/coral accent like screenshot */}
                  <div style={{ position: 'relative', height: 340, overflow: 'hidden' }}>
                    {/* Cover image — dark gym with barbells */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80') center 30% / cover no-repeat",
                      filter: 'saturate(1.1) brightness(0.85)',
                    }} />
                    {/* Red accent overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(192,57,43,0.10)', mixBlendMode: 'overlay' }} />
                    {/* Radial vignette */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'radial-gradient(circle at center, transparent 30%, rgba(16,6,6,0.6) 75%)',
                    }} />
                    {/* The Melt — red-tinted dark */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 12%, transparent 20%, rgba(16,6,6,0.05) 28%, rgba(16,6,6,0.14) 36%, rgba(16,6,6,0.35) 44%, rgba(16,6,6,0.55) 52%, rgba(16,6,6,0.75) 60%, rgba(16,6,6,0.90) 70%, rgba(16,6,6,0.97) 80%, #100606 88%)',
                    }} />
                    {/* Accent glow */}
                    <div style={{
                      position: 'absolute', bottom: -30, left: '10%', right: '10%', height: 100,
                      background: 'radial-gradient(ellipse at 50% 100%, rgba(192,57,43,0.08) 0%, transparent 60%)',
                    }} />
                    {/* Text overlay */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px', zIndex: 5 }}>
                      {/* Club type badge */}
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
                        padding: '5px 12px', borderRadius: 20,
                        background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.4)',
                        fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: '#E74C3C',
                      }}>🏋️ LIFT CLUB</div>
                      <h3 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5, textTransform: 'uppercase', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>BULK UP</h3>
                      <p style={{ fontSize: 13, fontWeight: 500, fontStyle: 'italic', color: 'rgba(255,255,255,0.65)', margin: '0 0 8px' }}>Lift Big. Eat heavy, Grow Together!</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>by</span>
                        <span style={{ color: '#E74C3C', fontWeight: 700 }}>@thetrefecta</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E74C3C', boxShadow: '0 0 6px rgba(231,76,60,0.6)', animation: 'fwbPulseDot 2s infinite' }} />
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>1 member</span>
                      </div>
                    </div>
                  </div>
                  {/* Body */}
                  <div style={{ padding: '0 16px', background: '#100606' }}>
                    {/* Bio Card */}
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 18px', borderRadius: 16, marginTop: 16,
                      background: 'rgba(192,57,43,0.05)', border: '1px solid rgba(192,57,43,0.1)',
                    }}>
                      {/* Profile photo */}
                      <div style={{
                        width: 42, height: 42, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
                        background: 'linear-gradient(135deg, #E74C3C, #C0392B)',
                      }}>
                        <div style={{
                          width: '100%', height: '100%',
                          background: "url('https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&q=80') center / cover no-repeat",
                          borderRadius: 12,
                        }} />
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
                        Ready to put on real size? Bulk Up is a training club built for lifters chasing muscle and weight gain — with a full workout program, a bulking meal plan, weekly challenges, and a crew that's all grinding toward the same goal.
                      </div>
                    </div>
                    {/* Tab Bar — PULSE | MEMBERS | CHALLENGES */}
                    <div style={{ display: 'flex', marginTop: 22 }}>
                      {['Pulse', 'Members', 'Challenges'].map((tab, i) => (
                        <div key={tab} style={{
                          flex: 1, textAlign: 'center', paddingBottom: 12,
                          fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase',
                          color: i === 0 ? '#E74C3C' : 'rgba(255,255,255,0.3)',
                          borderBottom: i === 0 ? '2px solid #E74C3C' : '1px solid rgba(255,255,255,0.04)',
                          boxShadow: i === 0 ? '0 2px 10px rgba(231,76,60,0.3)' : 'none',
                        }}>{tab}</div>
                      ))}
                    </div>
                    {/* Message Input Bar */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      marginTop: 16, paddingBottom: 16,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: '#E74C3C',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>+</div>
                      <div style={{
                        flex: 1, padding: '10px 16px', borderRadius: 20,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        fontSize: 13, color: 'rgba(255,255,255,0.3)',
                      }}>Message...</div>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(231,76,60,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, flexShrink: 0,
                      }}>🎙️</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <h4 style={{ fontSize: 20, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, marginBottom: 8, color: '#fff' }}>Bulk Up</h4>
                <p style={{ fontSize: 14, color: 'var(--fwb-warm-gray)', lineHeight: 1.6 }}>
                  A training club built for lifters chasing muscle and weight gain, with full workout programs and bulking meal plans on Pulse.
                </p>
                <p style={{
                  marginTop: 16, fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#E74C3C'
                }}>
                  "The platform makes it easy."
                </p>
              </div>
            </div>

          </div>

          <p style={{
            textAlign: 'center',
            marginTop: 60,
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(18px, 2.5vw, 24px)',
            fontWeight: 400,
            fontStyle: 'italic',
            color: 'var(--fwb-white)',
            lineHeight: 1.5,
          }}>
            Every club has its own energy.
            <span style={{ color: 'var(--fwb-gold)' }}> Yours will too.</span>
          </p>
        </section>

        {/* YOUR CLUB YOUR RULES */}
        <section className="fwb-section" id="monetize">
          <div className="fwb-section-label">04 — Your Club, Your Rules</div>
          <h2 className="fwb-section-title">
            Free to use.<br />Flexible by design.
          </h2>
          <p className="fwb-section-text">
            Pulse Clubs is completely free for hosts. No subscriptions, no platform fees. You decide how your community runs — offer everything for free, create paid challenges, gate premium content, or mix and match. The model is yours.
          </p>

          <div className="fwb-money-grid">
            <div className="fwb-money-card featured">
              <div className="fwb-money-badge">The Platform</div>
              <div className="fwb-money-title">100% Free to Host</div>
              <p className="fwb-money-desc">Create your club, invite your people, post content, run challenges, and manage members — all at no cost. Pulse gives you the infrastructure. You bring the community.</p>
            </div>
            <div className="fwb-money-card">
              <div className="fwb-money-badge">Your Choice</div>
              <div className="fwb-money-title">Challenges & Upsells</div>
              <p className="fwb-money-desc">Want to monetize? Offer paid challenges, exclusive programs, or ticketed events through the club. Or keep everything free — it's entirely up to you.</p>
            </div>
            <div className="fwb-money-card">
              <div className="fwb-money-badge">Organize</div>
              <div className="fwb-money-title">Your Digital Center</div>
              <p className="fwb-money-desc">Think of it as your community's home base. Organize track days, mobilize your crew, share workouts, and keep the energy alive between meetups.</p>
            </div>
            <div className="fwb-money-card">
              <div className="fwb-money-badge">Gamify</div>
              <div className="fwb-money-title">Leaderboards & Challenges</div>
              <p className="fwb-money-desc">Turn participation into friendly competition. Workout leaderboards, nutrition tracking, and weekly challenges keep your members engaged and coming back.</p>
            </div>
          </div>
        </section>

        {/* MANAGEMENT */}
        <section className="fwb-section" id="manage">
          <div className="fwb-section-label">05 — Club Management</div>
          <h2 className="fwb-section-title">
            Run the club,<br />effortlessly.
          </h2>
          <p className="fwb-section-text">
            All the tools you need—content, events, and revenue—in a single powerful dashboard. Manage the business without the chaos.
          </p>

          <div className="fwb-manage-features">
            <div className="fwb-manage-feature">
              <h4>Member Insights</h4>
              <p>Real data on your community. See who's active and who's ready for premium without the guesswork.</p>
            </div>
            <div className="fwb-manage-feature">
              <h4>Content Hub</h4>
              <p>Drop workouts, programs, and feed updates to your members directly. You own the content flow.</p>
            </div>
            <div className="fwb-manage-feature">
              <h4>Event Coordination</h4>
              <p>Handle RSVPs, reminders, and attendance without the stress of managing DMs and spreadsheets.</p>
            </div>
            <div className="fwb-manage-feature">
              <h4>Revenue Tracking</h4>
              <p>Monitor ticket sales, premium conversions, and monthly growth in real-time. Know exactly what's working.</p>
            </div>
          </div>
        </section>

        {/* CLOSING */}
        <div className="fwb-closing">
          <div className="fwb-divider" style={{ marginBottom: 60 }}></div>
          <p className="fwb-closing-quote">
            FWB is already building something special in Atlanta. Pulse is the platform that makes it <span>scale</span>.
          </p>
          <p className="fwb-closing-attribution">
            Built for Nile Jones &amp; Frens With Benefits
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <a className="fwb-closing-cta" href="mailto:tre@fitwithpulse.ai">
              Let's Build This →
            </a>
            <a
              className="fwb-closing-cta"
              href="https://calendly.com/tre-aqo7/30min"
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: 'transparent', border: '1px solid var(--fwb-gold)', color: 'var(--fwb-gold)' }}
            >
              Schedule a Call →
            </a>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="fwb-footer">
          <p>
            Pulse Intelligence Labs © 2026 — <a href="https://fitwithpulse.ai">fitwithpulse.ai</a>
          </p>
        </footer>
      </div>
    </>
  );
};

export default FWB;

export const getServerSideProps: GetServerSideProps<FWBProps> = async (_context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('FWB');
  } catch (error) {
    console.error("Error fetching page meta data for FWB page:", error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  const ogTitle = rawMetaData?.ogTitle || rawMetaData?.pageTitle || FWB_DEFAULT_TITLE;
  const ogDescription = rawMetaData?.ogDescription || rawMetaData?.metaDescription || FWB_DEFAULT_DESCRIPTION;
  const ogUrl = rawMetaData?.ogUrl || FWB_OG_URL;

  const rawOgImage = rawMetaData?.ogImage || rawMetaData?.twitterImage || FWB_OG_IMAGE;
  const ogImage = rawOgImage.startsWith('http')
    ? rawOgImage
    : `https://fitwithpulse.ai${rawOgImage}`;

  return {
    props: {
      metaData: serializableMetaData,
      ogMeta: {
        title: ogTitle,
        description: ogDescription,
        image: ogImage,
        url: ogUrl,
      },
    },
  };
};
