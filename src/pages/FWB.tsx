import React, { useState, useEffect, useRef } from 'react';
import PageHead from '../components/PageHead';
import Header from '../components/Header';
import { GetServerSideProps } from 'next';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

// Serializable version of PageMetaData for SSR props
interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string;
}

interface FWBProps {
  metaData: SerializablePageMetaData | null;
}

const FWB_PASSCODE = 'BLACKJOY';
const FWB_UNLOCK_KEY = 'fwb-unlocked';

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
          pageOgUrl="https://fitwithpulse.ai/FWB"
          pageOgImage="/pulse-logo.svg"
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
        pageOgUrl="https://fitwithpulse.ai/FWB"
        pageOgImage="/pulse-logo.svg"
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
            <li><a href="#experience">Experience</a></li>
            <li><a href="#monetize">Monetize</a></li>
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
            Your culture in motion.<br />A digital home for the heartbeat of Atlanta.
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



        {/* MONETIZATION */}
        <section className="fwb-section" id="monetize">
          <div className="fwb-section-label">03 — Monetization</div>
          <h2 className="fwb-section-title">
            Free to join.<br />Premium to unlock.
          </h2>
          <p className="fwb-section-text">
            Grow your community organically, then offer exclusive value to the members who want more. FWB becomes a self-sustaining engine.
          </p>

          <div className="fwb-money-grid">
            <div className="fwb-money-card">
              <div className="fwb-money-badge">Free Tier</div>
              <div className="fwb-money-title">The Open Community</div>
              <p className="fwb-money-desc">Access to the club feed, event calendar, and basic workouts. Where anyone can start and where the culture lives.</p>
              <div className="fwb-money-price">$0 <span>/ forever</span></div>
            </div>
            <div className="fwb-money-card featured">
              <div className="fwb-money-badge">Premium</div>
              <div className="fwb-money-title">FWB Inner Circle</div>
              <p className="fwb-money-desc">Exclusive programs, early event access, and direct connection to leadership. Recurring revenue from your most loyal members.</p>
              <div className="fwb-money-price">$XX <span>/ month</span></div>
            </div>
            <div className="fwb-money-card">
              <div className="fwb-money-badge">Events</div>
              <div className="fwb-money-title">Ticketed Experiences</div>
              <p className="fwb-money-desc">Pop-up workouts and partner activations—sold straight through Pulse. Revenue flows directly to FWB.</p>
              <div className="fwb-money-price">Variable</div>
            </div>
            <div className="fwb-money-card">
              <div className="fwb-money-badge">Merch & Collabs</div>
              <div className="fwb-money-title">Brand Extensions</div>
              <p className="fwb-money-desc">Merch drops and partner cross-promotions. Pulse becomes the streamlined storefront for your community.</p>
              <div className="fwb-money-price">Variable</div>
            </div>
          </div>
        </section>

        {/* MANAGEMENT */}
        <section className="fwb-section" id="manage">
          <div className="fwb-section-label">04 — Club Management</div>
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
          <a className="fwb-closing-cta" href="mailto:tre@fitwithpulse.ai">
            Let's Build This →
          </a>
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

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};
