import React, { useState, useEffect, useRef } from 'react';
import PageHead from '../components/PageHead';
import { GetServerSideProps } from 'next';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
    lastUpdated: string;
}

interface CreatorClubProps {
    metaData: SerializablePageMetaData | null;
}

const CreatorClub = ({ metaData }: CreatorClubProps) => {
    const [activePhone, setActivePhone] = useState(0);
    const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Scroll-triggered visibility
    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
                    }
                });
            },
            { threshold: 0.12 }
        );

        document.querySelectorAll('[data-animate]').forEach((el) => {
            observerRef.current?.observe(el);
        });

        return () => observerRef.current?.disconnect();
    }, []);

    // Auto-rotate phones
    useEffect(() => {
        const timer = setInterval(() => {
            setActivePhone((prev) => (prev + 1) % 3);
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    const phones = [
        {
            name: 'The Pulse Pact',
            handle: '@thetrefecta',
            members: '98',
            active: '12',
            third: '3',
            thirdLabel: 'Challenges',
            bio: 'A training club for people who show up. Lifts. Runs. Challenges. One crew.',
            avatar: 'TG',
            cta: 'Join The Pact',
            tabs: ['Feed', 'Members', 'Challenges'],
            posts: [
                { name: 'Tremaine', time: '2h', body: 'Track Tuesday is back — Lakewood Stadium, 6:30 PM. Bring a friend. Let\'s get it 🏃‍♂️', fire: '24', comments: '8' },
                { name: 'Marcus J.', time: '5h', body: '5K PR following the Pact program. This crew is different 💪', fire: '41', comments: '12' },
            ],
            color: '#C8FF00',
            colorDark: '#7ACC00',
            bgTint: '#070E08',
            heroImg: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80',
            heroPos: '20%',
        },
        {
            name: 'Frens With Benefits',
            nameHtml: <>FRENS WITH<br /><span style={{ color: '#DA7837' }}>BENEFITS</span></>,
            handle: '@nilejones',
            members: '247',
            active: '38',
            third: '5',
            thirdLabel: 'Events',
            bio: 'Culture meets fitness. Track days, strength sessions, and community — rooted in Black joy.',
            avatar: 'NJ',
            cta: 'Join FWB',
            tabs: ['Feed', 'Members', 'Events'],
            pills: ['Black Art', 'Black Joy', 'Black Culture'],
            posts: [
                { name: 'Nile', time: '1h', body: 'Saturday track day at Morris Brown — 400m repeats + core circuit. Bring the energy 🏟️', fire: '67', comments: '23' },
                { name: 'Aja M.', time: '3h', body: 'First week with FWB and I already found my people. The vibes are unmatched 🧡', fire: '89', comments: '15' },
            ],
            color: '#DA7837',
            colorDark: '#B85A20',
            bgTint: '#0E0807',
            heroImg: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80',
            heroPos: '30%',
        },
        {
            name: 'Crown Athletics',
            handle: '@crownfit',
            members: '512',
            active: '74',
            third: '8',
            thirdLabel: 'Programs',
            bio: 'Elevate your training. Premium coaching, group sessions, and a community built on excellence.',
            avatar: 'CA',
            cta: 'Join Crown',
            tabs: ['Feed', 'Members', 'Programs'],
            posts: [
                { name: 'Coach D', time: '30m', body: 'New 8-week strength program just dropped in Programs. Built for intermediate lifters ready to level up 👑', fire: '112', comments: '34' },
                { name: 'Kira T.', time: '2h', body: 'Week 4 of the program complete. Squat PR today. This community holds you accountable 🏆', fire: '78', comments: '19' },
            ],
            color: '#3C82F6',
            colorDark: '#1D5CC8',
            bgTint: '#070A12',
            heroImg: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
            heroPos: '40%',
        },
    ];

    const flowSteps = [
        { num: '01', title: 'They Discover You', desc: 'A potential member finds your club through Instagram, word of mouth, or a link in bio. They land on your branded club page inside Pulse — designed to look and feel like you.', tag: 'Entry Point' },
        { num: '02', title: 'They Join Instantly', desc: 'One tap to join. They see upcoming events, workout content, community posts, and who else is in the crew. It feels like walking into your space.', tag: 'Onboarding' },
        { num: '03', title: 'They Train With You', desc: 'Whether it\'s a run club, a strength session, or a yoga flow — members follow workouts in real time through Pulse. Playlist-style training with social energy built in.', tag: 'Core Experience' },
        { num: '04', title: 'They Stay Connected', desc: 'The workout ends but the community doesn\'t. Members engage through the club feed, share progress, hype each other up, and stay plugged in between sessions.', tag: 'Retention Loop' },
        { num: '05', title: 'They Go Premium', desc: 'Members who want more unlock exclusive content, advanced programs, early access to events, or VIP experiences. Free community becomes the natural funnel to premium.', tag: 'Revenue' },
    ];

    const revenueCards = [
        { badge: 'Free Tier', title: 'Open Community', desc: 'Club feed, event calendar, community posts, and basic workout content. Where everyone starts and your culture lives.', price: '$0', sub: '/ forever' },
        { badge: 'Premium', title: 'Inner Circle', desc: 'Exclusive training programs, early event access, VIP experiences, and direct access to you and your leadership team.', price: '$XX', sub: '/ month', featured: true },
        { badge: 'Events', title: 'Ticketed Experiences', desc: 'Pop-up workouts, cultural collaborations, and partner activations — sold directly through Pulse. Revenue goes straight to you.', price: 'Per event', sub: '' },
        { badge: 'Merch & Collabs', title: 'Brand Extensions', desc: 'Merch drops, partner collaborations, and cross-promotions. Pulse becomes the storefront for your community.', price: 'Variable', sub: '' },
    ];

    const managementFeatures = [
        { title: 'Member Dashboard', desc: 'See who\'s active, who\'s dropping off, and who\'s ready for premium. Real data on your community, not guesswork.' },
        { title: 'Content Management', desc: 'Upload workouts, create training programs, post to the club feed, and schedule content drops. Everything flows through Pulse.' },
        { title: 'Event Coordination', desc: 'Create events, manage RSVPs, send reminders, and track attendance. No more spreadsheets and DMs — it\'s all built in.' },
        { title: 'Revenue Tracking', desc: 'Monthly recurring revenue, premium conversions, ticket sales, and growth trends. Know what\'s working.' },
    ];

    const PhoneMockup = ({ phone, index }: { phone: typeof phones[0]; index: number }) => (
        <div
            style={{
                width: 320,
                height: 693,
                borderRadius: 44,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: `0 0 0 2px #1a1a1a, 0 0 0 4px #111, 0 25px 80px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.03)`,
                transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: activePhone === index ? 'scale(1.04)' : 'scale(0.96)',
                opacity: activePhone === index ? 1 : 0.5,
                cursor: 'pointer',
                flexShrink: 0,
            }}
            onClick={() => setActivePhone(index)}
        >
            <div style={{ width: '100%', height: '100%', overflowY: 'auto', position: 'relative', background: phone.bgTint, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                {/* Hero */}
                <div style={{ position: 'relative', height: 360, overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: `url('${phone.heroImg}') center ${phone.heroPos} / cover no-repeat`,
                        filter: 'saturate(1.2)',
                    }} />
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(180deg, transparent 0%, transparent 25%, ${phone.bgTint}40 40%, ${phone.bgTint}B3 55%, ${phone.bgTint}EA 72%, ${phone.bgTint} 100%)`,
                    }} />
                    <div style={{
                        position: 'absolute', bottom: -20, left: '-20%', right: '-20%', height: 200,
                        background: `radial-gradient(ellipse at 50% 100%, ${phone.color}1A 0%, transparent 65%)`,
                        pointerEvents: 'none',
                    }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px', zIndex: 5 }}>
                        <div style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: 32, fontWeight: 700, lineHeight: 1,
                            textTransform: 'uppercase' as const, letterSpacing: -1,
                            textShadow: '0 2px 30px rgba(0,0,0,0.6)',
                        }}>
                            {phone.nameHtml || phone.name.toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                            by <span style={{ color: phone.color, fontWeight: 600 }}>{phone.handle}</span>
                            <span>•</span>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: phone.color, animation: 'ccPulseDot 2s infinite' }} />
                            <span>{phone.members} members</span>
                        </div>
                        {phone.pills && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                {phone.pills.map((pill) => (
                                    <div key={pill} style={{
                                        padding: '3px 10px', fontSize: 8, fontWeight: 700, letterSpacing: 1,
                                        textTransform: 'uppercase' as const, borderRadius: 20,
                                        background: `${phone.color}26`, color: phone.color,
                                        border: `1px solid ${phone.color}40`,
                                    }}>{pill}</div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div style={{ position: 'relative', paddingBottom: 16 }}>
                    {/* Bio */}
                    <div style={{
                        margin: '14px 14px 0', padding: '12px 16px', borderRadius: 14,
                        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                        background: `${phone.color}0D`, border: `1px solid ${phone.color}1A`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: 13, flexShrink: 0,
                                background: `linear-gradient(135deg, ${phone.color}, ${phone.colorDark})`,
                                color: index === 0 ? '#0A0A0A' : '#fff',
                            }}>{phone.avatar}</div>
                            <div style={{ fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>{phone.bio}</div>
                        </div>
                    </div>

                    {/* CTA */}
                    <div style={{
                        margin: '12px 14px 0', padding: 13, borderRadius: 12,
                        fontWeight: 700, fontSize: 14, textAlign: 'center' as const, cursor: 'pointer',
                        background: phone.color, color: index === 0 ? '#0A0A0A' : '#fff',
                        boxShadow: `0 4px 24px ${phone.color}33, 0 0 60px ${phone.color}0F`,
                        letterSpacing: 0.3,
                    }}>{phone.cta}</div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', margin: '18px 14px 0' }}>
                        {phone.tabs.map((tab, i) => (
                            <div key={tab} style={{
                                flex: 1, textAlign: 'center' as const, padding: '11px 0',
                                fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                                textTransform: 'uppercase' as const,
                                color: i === 0 ? phone.color : 'rgba(255,255,255,0.3)',
                                cursor: 'pointer', position: 'relative',
                                borderBottom: i === 0 ? `2px solid ${phone.color}` : '1px solid rgba(255,255,255,0.04)',
                            }}>{tab}</div>
                        ))}
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 3, margin: '14px 14px 0' }}>
                        {[
                            { n: phone.members, l: 'Members' },
                            { n: phone.active, l: 'Active' },
                            { n: phone.third, l: phone.thirdLabel },
                        ].map((s) => (
                            <div key={s.l} style={{
                                flex: 1, padding: '12px 6px', borderRadius: 10, textAlign: 'center' as const,
                                background: `${phone.color}0A`, border: `1px solid ${phone.color}0F`,
                            }}>
                                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700, color: phone.color }}>{s.n}</div>
                                <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.l}</div>
                            </div>
                        ))}
                    </div>

                    {/* Feed */}
                    <div style={{ margin: '16px 14px' }}>
                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>Recent</div>
                        {phone.posts.map((post, i) => (
                            <div key={i} style={{
                                padding: '12px 14px', borderRadius: 12, marginBottom: 6,
                                border: '1px solid rgba(255,255,255,0.03)',
                                background: `${phone.color}05`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: `linear-gradient(135deg, ${phone.color}, ${phone.colorDark})` }} />
                                    <span style={{ fontWeight: 600, fontSize: 12 }}>{post.name}</span>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>{post.time}</span>
                                </div>
                                <div style={{ fontSize: 12, lineHeight: 1.55, color: 'rgba(255,255,255,0.65)', fontWeight: 300 }}>{post.body}</div>
                                <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                                    <span>🔥 {post.fire}</span>
                                    <span>💬 {post.comments}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <PageHead
                metaData={metaData}
                pageOgUrl="https://fitwithpulse.ai/CreatorClub"
                pageOgImage="/pulse-logo.svg"
            />
            <link
                href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap"
                rel="stylesheet"
            />

            <style jsx global>{`
        .cc-page * { margin: 0; padding: 0; box-sizing: border-box; }

        .cc-page {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #050505;
          color: #fff;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        /* ===== NAV ===== */
        .cc-nav {
          position: fixed;
          top: 0; left: 0; right: 0; z-index: 100;
          padding: 18px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: rgba(5,5,5,0.7);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: all 0.4s ease;
        }

        .cc-nav-logo {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #fff;
        }

        .cc-nav-logo span { color: #C8FF00; }

        .cc-nav-links {
          display: flex;
          gap: 32px;
          list-style: none;
        }

        .cc-nav-links a {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.5px;
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          transition: color 0.3s;
        }

        .cc-nav-links a:hover { color: #fff; }

        .cc-nav-cta {
          padding: 10px 28px;
          background: #C8FF00;
          color: #0A0A0A;
          font-weight: 700;
          font-size: 13px;
          border-radius: 10px;
          text-decoration: none;
          transition: all 0.3s;
          letter-spacing: 0.3px;
        }

        .cc-nav-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(200,255,0,0.25);
        }

        /* ===== HERO ===== */
        .cc-hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 140px 40px 100px;
          position: relative;
          overflow: hidden;
        }

        .cc-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background:
            radial-gradient(ellipse at 30% 40%, rgba(200,255,0,0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%, rgba(60,130,246,0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(218,120,55,0.03) 0%, transparent 40%);
          pointer-events: none;
        }

        .cc-hero-badge {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: #C8FF00;
          margin-bottom: 32px;
          opacity: 0;
          animation: ccFadeUp 0.8s 0.2s forwards;
        }

        .cc-hero h1 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(40px, 6vw, 80px);
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -2px;
          margin-bottom: 24px;
          opacity: 0;
          animation: ccFadeUp 0.8s 0.4s forwards;
        }

        .cc-hero h1 .cc-gradient-text {
          background: linear-gradient(135deg, #C8FF00 0%, #DA7837 50%, #3C82F6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .cc-hero-sub {
          font-size: clamp(16px, 2vw, 20px);
          font-weight: 300;
          color: rgba(255,255,255,0.5);
          line-height: 1.7;
          max-width: 600px;
          margin-bottom: 48px;
          opacity: 0;
          animation: ccFadeUp 0.8s 0.6s forwards;
        }

        .cc-hero-cta {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 18px 44px;
          background: #C8FF00;
          color: #0A0A0A;
          font-weight: 700;
          font-size: 15px;
          border-radius: 14px;
          text-decoration: none;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          letter-spacing: 0.3px;
          opacity: 0;
          animation: ccFadeUp 0.8s 0.8s forwards;
        }

        .cc-hero-cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 40px rgba(200,255,0,0.3);
        }

        .cc-scroll-hint {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          opacity: 0;
          animation: ccFadeUp 0.8s 1.1s forwards;
        }

        .cc-scroll-hint span {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
        }

        .cc-scroll-line {
          width: 1px;
          height: 36px;
          background: linear-gradient(to bottom, #C8FF00, transparent);
          animation: ccScrollPulse 2s infinite;
        }

        /* ===== SECTION SYSTEM ===== */
        .cc-section {
          padding: clamp(60px, 10vw, 120px) 40px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .cc-section-label {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: #C8FF00;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .cc-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(200,255,0,0.15);
        }

        .cc-section-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(28px, 4vw, 48px);
          font-weight: 700;
          line-height: 1.12;
          letter-spacing: -1px;
          margin-bottom: 20px;
        }

        .cc-section-text {
          font-size: 16px;
          font-weight: 300;
          color: rgba(255,255,255,0.5);
          line-height: 1.8;
          max-width: 640px;
        }

        /* ===== PHONE SHOWCASE ===== */
        .cc-showcase {
          padding: 80px 40px 100px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .cc-showcase::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background:
            radial-gradient(ellipse at 50% 50%, rgba(200,255,0,0.03) 0%, transparent 50%);
          pointer-events: none;
        }

        .cc-phones-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 32px;
          margin-top: 48px;
          padding: 0 20px;
        }

        .cc-phone-selector {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-top: 32px;
        }

        .cc-phone-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s;
          border: 1px solid rgba(255,255,255,0.1);
        }

        /* ===== SYSTEM NOTES (How branding works) ===== */
        .cc-system-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 60px;
        }

        .cc-system-card {
          padding: 28px;
          border-radius: 18px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          transition: all 0.4s ease;
        }

        .cc-system-card:hover {
          border-color: rgba(200,255,0,0.15);
          background: rgba(255,255,255,0.03);
          transform: translateY(-2px);
        }

        .cc-system-card h4 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .cc-system-card p {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          line-height: 1.65;
          font-weight: 300;
        }

        .cc-system-highlight {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 10px;
          display: block;
        }

        /* ===== FLOW STEPS ===== */
        .cc-flow-container { margin-top: 60px; }

        .cc-flow-step {
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: 36px;
          padding: 44px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          opacity: 0;
          transform: translateY(24px);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cc-flow-step.cc-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .cc-flow-number {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 42px;
          font-weight: 700;
          color: #C8FF00;
          line-height: 1;
        }

        .cc-flow-content h3 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .cc-flow-content p {
          font-size: 15px;
          font-weight: 300;
          color: rgba(255,255,255,0.45);
          line-height: 1.8;
          max-width: 560px;
        }

        .cc-flow-tag {
          display: inline-block;
          margin-top: 14px;
          padding: 5px 14px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #C8FF00;
          border: 1px solid rgba(200,255,0,0.2);
          border-radius: 4px;
        }

        /* ===== MONETIZATION GRID ===== */
        .cc-money-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          margin-top: 60px;
        }

        .cc-money-card {
          padding: 44px 36px;
          background: rgba(255,255,255,0.02);
          position: relative;
          transition: all 0.4s ease;
        }

        .cc-money-card:hover { background: rgba(200,255,0,0.03); }

        .cc-money-card.cc-featured {
          border: 1px solid rgba(200,255,0,0.2);
          background: rgba(200,255,0,0.02);
        }

        .cc-money-badge {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #C8FF00;
          margin-bottom: 14px;
        }

        .cc-money-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .cc-money-desc {
          font-size: 14px;
          font-weight: 300;
          color: rgba(255,255,255,0.45);
          line-height: 1.7;
        }

        .cc-money-price {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 32px;
          font-weight: 700;
          color: #C8FF00;
          margin-top: 18px;
        }

        .cc-money-price span {
          font-size: 13px;
          font-weight: 400;
          color: rgba(255,255,255,0.35);
        }

        /* ===== MANAGEMENT ===== */
        .cc-manage-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 36px;
          margin-top: 60px;
        }

        .cc-manage-card {
          padding: 32px;
          border-left: 2px solid rgba(200,255,0,0.15);
          transition: all 0.4s ease;
        }

        .cc-manage-card:hover {
          border-left-color: #C8FF00;
          padding-left: 40px;
        }

        .cc-manage-card h4 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .cc-manage-card p {
          font-size: 14px;
          font-weight: 300;
          color: rgba(255,255,255,0.45);
          line-height: 1.7;
        }

        /* ===== CLOSING CTA ===== */
        .cc-closing {
          text-align: center;
          padding: 120px 40px 80px;
          max-width: 800px;
          margin: 0 auto;
          position: relative;
        }

        .cc-closing-divider {
          width: 60px;
          height: 1px;
          background: #C8FF00;
          margin: 0 auto 60px;
          opacity: 0.4;
        }

        .cc-closing-quote {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(24px, 3.5vw, 40px);
          font-weight: 600;
          line-height: 1.3;
          margin-bottom: 24px;
          letter-spacing: -0.5px;
        }

        .cc-closing-quote span { color: #C8FF00; }

        .cc-closing-sub {
          font-size: 16px;
          font-weight: 300;
          color: rgba(255,255,255,0.4);
          margin-bottom: 48px;
          line-height: 1.7;
        }

        .cc-closing-cta {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 20px 56px;
          background: #C8FF00;
          color: #0A0A0A;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 15px;
          border-radius: 14px;
          text-decoration: none;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          letter-spacing: 0.5px;
        }

        .cc-closing-cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 40px rgba(200,255,0,0.3);
        }

        /* ===== FOOTER ===== */
        .cc-footer {
          text-align: center;
          padding: 40px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }

        .cc-footer p {
          font-size: 12px;
          letter-spacing: 1px;
          color: rgba(255,255,255,0.25);
        }

        .cc-footer a {
          color: #C8FF00;
          text-decoration: none;
        }

        /* ===== ANIMATIONS ===== */
        @keyframes ccFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes ccScrollPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }

        @keyframes ccPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.8); }
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 1100px) {
          .cc-phones-row { gap: 20px; }
        }

        @media (max-width: 900px) {
          .cc-phones-row {
            flex-direction: column;
            align-items: center;
          }
          .cc-system-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .cc-nav { padding: 14px 20px; }
          .cc-nav-links { display: none; }
          .cc-section, .cc-showcase, .cc-closing { padding-left: 20px; padding-right: 20px; }
          .cc-money-grid { grid-template-columns: 1fr; }
          .cc-manage-grid { grid-template-columns: 1fr; }
          .cc-flow-step { grid-template-columns: 48px 1fr; gap: 20px; }
          .cc-flow-number { font-size: 32px; }
          .cc-hero { padding: 110px 20px 60px; }
        }
      `}</style>

            <div className="cc-page">
                {/* NAV */}
                <nav className="cc-nav">
                    <div className="cc-nav-logo">
                        <span>Pulse</span> Creator Club
                    </div>
                    <ul className="cc-nav-links">
                        <li><a href="#showcase">Preview</a></li>
                        <li><a href="#branding">Branding</a></li>
                        <li><a href="#experience">Experience</a></li>
                        <li><a href="#monetize">Monetize</a></li>
                        <li><a href="#manage">Manage</a></li>
                    </ul>
                    <a className="cc-nav-cta" href="https://fitwithpulse.ai" target="_blank" rel="noopener noreferrer">
                        Get Started
                    </a>
                </nav>

                {/* HERO */}
                <div className="cc-hero">
                    <div className="cc-hero-badge">Built for Creators, Brands & Communities</div>
                    <h1>
                        Your Fitness Community.<br />
                        <span className="cc-gradient-text">Your Brand. Your Rules.</span>
                    </h1>
                    <p className="cc-hero-sub">
                        Pulse gives creators, brands, and organizations the tools to build fully branded fitness communities — complete with events, content, monetization, and member management. One platform. Infinite identity.
                    </p>
                    <a className="cc-hero-cta" href="https://fitwithpulse.ai" target="_blank" rel="noopener noreferrer">
                        Create Your Club →
                    </a>
                    <div className="cc-scroll-hint">
                        <span>Explore</span>
                        <div className="cc-scroll-line" />
                    </div>
                </div>

                {/* PHONE SHOWCASE */}
                <div className="cc-showcase" id="showcase">
                    <div className="cc-section-label" style={{ justifyContent: 'center', maxWidth: 1200, margin: '0 auto 0' }}>
                        Three Brands. One Platform. Infinite Identity.
                    </div>
                    <h2 className="cc-section-title" style={{ textAlign: 'center', maxWidth: 700, margin: '20px auto 0' }}>
                        Every club is a different world.<br />All powered by Pulse.
                    </h2>
                    <p className="cc-section-text" style={{ textAlign: 'center', margin: '16px auto 0' }}>
                        Set your brand color and hero image. Pulse does the rest — generating a complete, immersive experience that's unmistakably yours.
                    </p>

                    <div className="cc-phones-row">
                        {phones.map((phone, i) => (
                            <PhoneMockup key={i} phone={phone} index={i} />
                        ))}
                    </div>

                    <div className="cc-phone-selector">
                        {phones.map((phone, i) => (
                            <div
                                key={i}
                                className="cc-phone-dot"
                                style={{
                                    background: activePhone === i ? phone.color : 'transparent',
                                    borderColor: activePhone === i ? phone.color : 'rgba(255,255,255,0.15)',
                                    transform: activePhone === i ? 'scale(1.3)' : 'scale(1)',
                                }}
                                onClick={() => setActivePhone(i)}
                            />
                        ))}
                    </div>
                </div>

                {/* BRANDING SYSTEM */}
                <section className="cc-section" id="branding">
                    <div className="cc-section-label">01 — Your Brand, Everywhere</div>
                    <h2 className="cc-section-title">
                        One color. One image.<br />Total brand takeover.
                    </h2>
                    <p className="cc-section-text">
                        You set your primary color and upload a hero image. Pulse automatically generates your entire branded experience — background tints, card styles, button fills, tab indicators, ambient glows, and more. Every pixel is on-brand.
                    </p>

                    <div className="cc-system-grid">
                        <div className="cc-system-card">
                            <span className="cc-system-highlight" style={{ color: '#C8FF00' }}>Photo → Gradient Melt</span>
                            <h4>Cinematic Hero</h4>
                            <p>Your banner photo sits at the top and gradually melts into your brand color. No hard line — just a seamless transition from real photography into your branded atmosphere.</p>
                        </div>
                        <div className="cc-system-card">
                            <span className="cc-system-highlight" style={{ color: '#DA7837' }}>Brand Color Glow</span>
                            <h4>Atmospheric Lighting</h4>
                            <p>A subtle radial glow in your brand color bleeds upward from below the hero. The color feels like it's emanating from the content itself, creating depth and immersion.</p>
                        </div>
                        <div className="cc-system-card">
                            <span className="cc-system-highlight" style={{ color: '#3C82F6' }}>One Color, Full System</span>
                            <h4>Automatic Theming</h4>
                            <p>Input one primary color. The system generates everything: background tint, card borders, button fills, tab indicators, stat numbers, avatar gradients, and ambient glow.</p>
                        </div>
                        <div className="cc-system-card">
                            <h4>Grain Texture</h4>
                            <p>A subtle noise overlay adds analog warmth and depth. Prevents gradients from looking flat. It's the difference between "designed" and "generated."</p>
                        </div>
                        <div className="cc-system-card">
                            <h4>Dynamic Backgrounds</h4>
                            <p>The page background shifts toward your brand hue. Green gets a forest-dark base. Orange gets warm ember. Blue gets midnight. Every pixel is on-brand.</p>
                        </div>
                        <div className="cc-system-card">
                            <h4>Zero Design Skills Needed</h4>
                            <p>You choose a color and an image. Pulse handles the typography, spacing, gradients, glows, and component styling. Professional design, instantly.</p>
                        </div>
                    </div>
                </section>

                {/* MEMBER EXPERIENCE */}
                <section className="cc-section" id="experience">
                    <div className="cc-section-label">02 — The Member Experience</div>
                    <h2 className="cc-section-title">
                        From discovery to loyalty.<br />Every step is designed.
                    </h2>
                    <p className="cc-section-text">
                        From the moment someone discovers your club to the moment they become a loyal member, Pulse creates a seamless experience that keeps people engaged, connected, and coming back.
                    </p>

                    <div className="cc-flow-container">
                        {flowSteps.map((step, i) => (
                            <div
                                key={step.num}
                                id={`cc-flow-${i}`}
                                data-animate
                                className={`cc-flow-step ${isVisible[`cc-flow-${i}`] ? 'cc-visible' : ''}`}
                            >
                                <div className="cc-flow-number">{step.num}</div>
                                <div className="cc-flow-content">
                                    <h3>{step.title}</h3>
                                    <p>{step.desc}</p>
                                    <div className="cc-flow-tag">{step.tag}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* MONETIZATION */}
                <section className="cc-section" id="monetize">
                    <div className="cc-section-label">03 — Monetization</div>
                    <h2 className="cc-section-title">
                        Free to join.<br />Premium to unlock.
                    </h2>
                    <p className="cc-section-text">
                        Your community is free — anyone can join, attend events, and be part of the culture. Premium upsells create recurring revenue without making the community feel gated.
                    </p>

                    <div className="cc-money-grid">
                        {revenueCards.map((card) => (
                            <div key={card.title} className={`cc-money-card ${card.featured ? 'cc-featured' : ''}`}>
                                <div className="cc-money-badge">{card.badge}</div>
                                <div className="cc-money-title">{card.title}</div>
                                <p className="cc-money-desc">{card.desc}</p>
                                <div className="cc-money-price">
                                    {card.price} {card.sub && <span>{card.sub}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* MANAGEMENT */}
                <section className="cc-section" id="manage">
                    <div className="cc-section-label">04 — Club Management</div>
                    <h2 className="cc-section-title">
                        Run your club<br />like a business.
                    </h2>
                    <p className="cc-section-text">
                        Pulse gives you the tools to manage your community without the chaos. Members, content, events, revenue — everything lives in one place.
                    </p>

                    <div className="cc-manage-grid">
                        {managementFeatures.map((feature) => (
                            <div key={feature.title} className="cc-manage-card">
                                <h4>{feature.title}</h4>
                                <p>{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CLOSING */}
                <div className="cc-closing">
                    <div className="cc-closing-divider" />
                    <p className="cc-closing-quote">
                        Your community already exists.<br />Pulse gives it a <span>home</span>.
                    </p>
                    <p className="cc-closing-sub">
                        Whether you're a fitness creator, a brand building culture, or an organization scaling community — Pulse is the platform that makes it real.
                    </p>
                    <a className="cc-closing-cta" href="https://fitwithpulse.ai" target="_blank" rel="noopener noreferrer">
                        Create Your Club →
                    </a>
                </div>

                {/* FOOTER */}
                <footer className="cc-footer">
                    <p>
                        Pulse Intelligence Labs © 2026 — <a href="https://fitwithpulse.ai">fitwithpulse.ai</a>
                    </p>
                </footer>
            </div>
        </>
    );
};

export default CreatorClub;

export const getServerSideProps: GetServerSideProps<CreatorClubProps> = async (_context) => {
    let rawMetaData: FirestorePageMetaData | null = null;
    try {
        rawMetaData = await adminMethods.getPageMetaData('CreatorClub');
    } catch (error) {
        console.error("Error fetching page meta data for CreatorClub page:", error);
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
