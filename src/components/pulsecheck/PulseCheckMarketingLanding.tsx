import React, { useEffect } from 'react';
import Head from 'next/head';

type PulseCheckMarketingLandingProps = {
    onJoinWaitlist: () => void;
};

const PulseBoltIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
);

const CheckIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const PulseCheckMarketingLanding: React.FC<PulseCheckMarketingLandingProps> = ({ onJoinWaitlist }) => {
    useEffect(() => {
        const reveals = Array.from(document.querySelectorAll<HTMLElement>('.pc-landing .reveal'));

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
        );

        reveals.forEach((el) => observer.observe(el));

        const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('.pc-landing a[href^="#"]'));
        const handlers: Array<{ el: HTMLAnchorElement; fn: (e: Event) => void }> = [];

        anchors.forEach((anchor) => {
            const fn = (e: Event) => {
                const href = anchor.getAttribute('href');
                if (!href || href.length < 2) return;
                const target = document.querySelector<HTMLElement>(href);
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
            anchor.addEventListener('click', fn);
            handlers.push({ el: anchor, fn });
        });

        return () => {
            observer.disconnect();
            handlers.forEach(({ el, fn }) => el.removeEventListener('click', fn));
        };
    }, []);

    return (
        <div className="pc-landing" id="top">
            <Head>
                <title>PulseCheck — The Mental Performance OS for Elite Programs</title>
            </Head>

            <nav>
                <a href="#top" className="nav-logo">
                    <div className="nav-logo-icon">
                        <PulseBoltIcon className="w-[18px] h-[18px]" />
                    </div>
                    PulseCheck
                </a>
                <div className="nav-links">
                    <a href="#how-it-works">How It Works</a>
                    <a href="#platform">Platform</a>
                    <a href="#proof">Results</a>
                    <a href="#pilot" className="nav-cta">Request Pilot</a>
                </div>
            </nav>

            <section className="hero">
                <div className="hero-badge">
                    <span className="hero-badge-dot"></span>
                    The Complete Readiness Triad for Elite Programs
                </div>
                <h1>Your athletes are physically ready. <em>Are they mentally built to execute?</em></h1>
                <p className="hero-sub">PulseCheck is the mental performance OS that gives coaches real-time readiness signals, intervention tools, and clinical safety nets — before it shows on the scoreboard.</p>
                <div className="hero-ctas">
                    <a href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Pilot%20Inquiry" className="btn-primary">
                        <PulseBoltIcon className="w-4 h-4" />
                        Request Department Pilot
                    </a>
                    <a href="#how-it-works" className="btn-secondary">See How It Works →</a>
                </div>
                <div className="hero-proof">
                    <span className="hero-proof-label">Trusted by forward-thinking programs</span>
                    <div className="hero-proof-logos">
                        <span className="proof-logo">ACC</span>
                        <span className="proof-logo">LAUNCH</span>
                        <span className="proof-logo">FOUNDER UNIVERSITY</span>
                        <span className="proof-logo">COOLEY LLP</span>
                    </div>
                </div>
            </section>

            <section className="terminal-section">
                <div className="terminal-wrapper">
                    <div className="terminal">
                        <div className="terminal-header">
                            <div className="terminal-dot red"></div>
                            <div className="terminal-dot yellow"></div>
                            <div className="terminal-dot green"></div>
                            <span className="terminal-title">PulseCheck · Daily Check-in</span>
                        </div>
                        <div className="terminal-body">
                            <div className="terminal-line">
                                <span className="terminal-prompt">nora ›</span>
                                <span className="terminal-text">What was the <span className="highlight">hardest mental moment</span> in yesterday&apos;s practice?</span>
                            </div>
                            <div className="terminal-line">
                                <span className="terminal-prompt">athlete ›</span>
                                <span className="terminal-text">Coach pulled me from the drill in front of everyone. Couldn&apos;t stop replaying it after.<span className="terminal-cursor"></span></span>
                            </div>
                            <div className="terminal-response">
                                <div className="status">
                                    <PulseBoltIcon className="w-3 h-3" />
                                    NORA ANALYSIS
                                </div>
                                <p>Elevated rumination pattern detected. Readiness score adjusted. Coach briefing updated with context-appropriate framing. Suggested micro-drill: 3-second reset protocol before next session.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="problem" id="how-it-works">
                <div className="problem-inner reveal">
                    <span className="section-label">⚡ The Invisible Gap</span>
                    <h2>Mental performance is the last unquantified variable in elite athletics</h2>
                    <p>Coaches track every rep, every split, every calorie. But the factor that determines execution under pressure — the mind — is still managed by gut feel.</p>
                </div>
                <div className="problem-stats reveal">
                    <div className="problem-stat">
                        <div className="problem-stat-number">85%</div>
                        <div className="problem-stat-label">of coaches say mental readiness impacts game-day performance</div>
                    </div>
                    <div className="problem-stat">
                        <div className="problem-stat-number">0</div>
                        <div className="problem-stat-label">tools currently measure it in real time for coaching staff</div>
                    </div>
                    <div className="problem-stat">
                        <div className="problem-stat-number">2 min</div>
                        <div className="problem-stat-label">daily check-in that captures what hours of observation miss</div>
                    </div>
                </div>
            </section>

            <section className="simulation" id="simulation">
                <div className="simulation-inner">
                    <div className="simulation-header reveal">
                        <span className="section-label">▶ Simulated Mental Game</span>
                        <h2>Train the mind <em>before the clutch moment</em></h2>
                        <p>Run pressure scenarios before game day. PulseCheck coaches breathing, attention control, and execution cues in the exact moments athletes unravel.</p>
                    </div>
                    <div className="sim-grid reveal">
                        <div className="sim-left">
                            <div className="sim-status">
                                <div className="sim-status-left">
                                    <div className="sim-status-dot"></div>
                                    <span className="sim-status-label">Simulation State</span>
                                </div>
                                <span className="sim-context">Q4 · 01:42 · Down 1</span>
                            </div>
                            <div className="sim-meters">
                                <div className="sim-meter">
                                    <div className="sim-meter-label">Pressure</div>
                                    <div className="sim-meter-value meter-high">87%</div>
                                </div>
                                <div className="sim-meter">
                                    <div className="sim-meter-label">Focus</div>
                                    <div className="sim-meter-value meter-mid">62%</div>
                                </div>
                                <div className="sim-meter">
                                    <div className="sim-meter-label">Composure</div>
                                    <div className="sim-meter-value meter-ok">71%</div>
                                </div>
                            </div>
                            <div className="sim-flow">
                                <div className="sim-flow-step trigger">
                                    <div className="sim-flow-step-label">Trigger Event</div>
                                    <p>Missed two free throws, crowd gets loud, hands feel tight, self-talk turns negative.</p>
                                </div>
                                <div className="sim-flow-step prompt">
                                    <div className="sim-flow-step-label">Nora Prompt</div>
                                    <p>&quot;Reset in 8 seconds: exhale long, eyes on rim center, cue: smooth follow-through.&quot;</p>
                                </div>
                                <div className="sim-flow-step result">
                                    <div className="sim-flow-step-label">Execution Result</div>
                                    <p>Athlete slows heart rate, blocks crowd noise, and commits to next-shot routine.</p>
                                </div>
                            </div>
                        </div>
                        <div className="sim-right">
                            <h3>Mental Intervention Sequence</h3>
                            <p>A repeatable workflow used in late-game stress spikes.</p>
                            <div className="intervention-steps">
                                <div className="intervention-step">
                                    <div className="intervention-icon detect">⚠</div>
                                    <div className="intervention-content">
                                        <h4>1. Detect the Spiral</h4>
                                        <p>Negative self-talk and rushed decision patterns are flagged instantly.</p>
                                    </div>
                                </div>
                                <div className="intervention-step">
                                    <div className="intervention-icon reset">◉</div>
                                    <div className="intervention-content">
                                        <h4>2. Issue a Micro-Reset</h4>
                                        <p>Breath cadence and short cue are tailored to role and situation.</p>
                                    </div>
                                </div>
                                <div className="intervention-step">
                                    <div className="intervention-icon reattach">◎</div>
                                    <div className="intervention-content">
                                        <h4>3. Re-Attach to Task</h4>
                                        <p>Attention narrows to one controllable action for the next play.</p>
                                    </div>
                                </div>
                                <div className="intervention-step">
                                    <div className="intervention-icon lock">✦</div>
                                    <div className="intervention-content">
                                        <h4>4. Lock In Confidence</h4>
                                        <p>Immediate reinforcement makes the clutch routine more automatic next time.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="pillars" id="platform">
                <div className="pillars-inner">
                    <div className="pillars-header reveal">
                        <span className="section-label">⬡ The 3-Pillar Engine</span>
                        <h2>One platform, <em>three surfaces</em></h2>
                        <p>For athletic programs that need signal, not intuition. Each pillar serves a different stakeholder with the right intelligence at the right time.</p>
                    </div>
                    <div className="pillars-grid reveal">
                        <div className="pillar-card">
                            <div className="pillar-icon">💬</div>
                            <h3>Nora</h3>
                            <div className="pillar-subtitle">For Athletes</div>
                            <p>24/7 private, stigma-free AI support that turns daily check-ins into trainable mental habits.</p>
                            <div className="pillar-features">
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Frictionless iMessage-style daily mental reps</div>
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Real-time response to anxiety, fatigue &amp; focus drops</div>
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Personalized drills like Box Breathing &amp; 3-Second Reset</div>
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Privacy-first design — athletes control visibility</div>
                            </div>
                        </div>
                        <div className="pillar-card">
                            <div className="pillar-icon">📊</div>
                            <h3>Coach Dashboard</h3>
                            <div className="pillar-subtitle">For Coaches</div>
                            <p>Actionable intelligence before the tape and before the locker room conversation.</p>
                            <div className="pillar-features">
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Green/Yellow/Orange/Red roster map at a glance</div>
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Actionable coaching recommendations by athlete</div>
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Proactive alerts when performance risk rises</div>
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Exportable reports &amp; analytics</div>
                            </div>
                        </div>
                        <div className="pillar-card">
                            <div className="pillar-icon">🛡</div>
                            <h3>Clinical Oversight</h3>
                            <div className="pillar-subtitle">Powered by Aunt Edna</div>
                            <p>Clinical handoff automation from routine performance coaching to safety when it matters most.</p>
                            <div className="pillar-features">
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Escalation triggers with objective context snapshots</div>
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>HIPAA-sensitive case handling</div>
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Restricted visibility controls</div>
                                <div className="pillar-feature"><div className="pillar-feature-dot"></div>Secure handoff to clinical staff for immediate follow-up</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="proof" id="proof">
                <div className="proof-inner">
                    <div className="reveal">
                        <h2>Built with coaches. Validated by athletes.</h2>
                    </div>
                </div>
            </section>

            <section className="workflow">
                <div className="workflow-inner">
                    <div className="workflow-header reveal">
                        <h2>Built for your workflow</h2>
                        <p>The right experience, optimized for how you actually work.</p>
                    </div>
                    <div className="workflow-grid reveal">
                        <div className="workflow-card">
                            <div className="workflow-card-icon">💙</div>
                            <h3>For Athletes</h3>
                            <p>Native integration with your existing Pulse app. No friction, maximum insight.</p>
                            <div className="workflow-features">
                                <div className="workflow-feature"><CheckIcon /> Seamless HealthKit sync</div>
                                <div className="workflow-feature"><CheckIcon /> Instant workout history &amp; PR analysis</div>
                                <div className="workflow-feature"><CheckIcon /> Comprehensive technique explanations</div>
                                <div className="workflow-feature"><CheckIcon /> Smart push notifications</div>
                                <div className="workflow-feature"><CheckIcon /> Privacy-first design</div>
                            </div>
                        </div>

                        <div className="workflow-card">
                            <div className="workflow-card-icon">📈</div>
                            <h3>For Coaches</h3>
                            <p>Comprehensive web dashboard built for managing teams and making data-driven decisions.</p>
                            <div className="workflow-features">
                                <div className="workflow-feature"><CheckIcon /> Team Pulse Board overview</div>
                                <div className="workflow-feature"><CheckIcon /> Proactive intervention alerts</div>
                                <div className="workflow-feature"><CheckIcon /> Exportable reports &amp; analytics</div>
                                <div className="workflow-feature"><CheckIcon /> Real-time athlete alerts</div>
                            </div>
                            <div className="mini-dash">
                                <div className="mini-dash-header">
                                    <span className="mini-dash-title">🏋️ Team Pulse Board</span>
                                    <span className="mini-dash-live">Live</span>
                                </div>
                                <div className="mini-dash-stats">
                                    <div className="mini-stat"><div className="mini-stat-value">12</div><div className="mini-stat-label">Athletes</div></div>
                                    <div className="mini-stat"><div className="mini-stat-value score-yellow">3</div><div className="mini-stat-label">Alerts</div></div>
                                    <div className="mini-stat"><div className="mini-stat-value score-green">89%</div><div className="mini-stat-label">Readiness</div></div>
                                </div>
                                <div className="mini-roster">
                                    <div className="roster-row">
                                        <div className="roster-left">
                                            <div className="roster-avatar" style={{ background: 'var(--coral)' }}>JS</div>
                                            <div className="roster-info">
                                                <span className="roster-name">Jessica Smith</span>
                                                <span className="roster-status">High stress · Poor sleep</span>
                                            </div>
                                        </div>
                                        <span className="roster-score score-red">⚠ Alert</span>
                                    </div>
                                    <div className="roster-row">
                                        <div className="roster-left">
                                            <div className="roster-avatar" style={{ background: 'var(--lime)' }}>MJ</div>
                                            <div className="roster-info">
                                                <span className="roster-name">Mike Johnson</span>
                                                <span className="roster-status">Ready · Good recovery</span>
                                            </div>
                                        </div>
                                        <span className="roster-score score-green">92%</span>
                                    </div>
                                    <div className="roster-row">
                                        <div className="roster-left">
                                            <div className="roster-avatar" style={{ background: 'var(--cyan)' }}>AL</div>
                                            <div className="roster-info">
                                                <span className="roster-name">Alex Lee</span>
                                                <span className="roster-status">Fatigue trend · Monitor</span>
                                            </div>
                                        </div>
                                        <span className="roster-score score-yellow">76%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="conversion" id="pilot">
                <div className="conversion-inner">
                    <div className="reveal">
                        <span className="section-label">🚀 Get Started</span>
                        <h2>Ready to see what your athletes <em>aren&apos;t telling you?</em></h2>
                        <p>Join the programs already using PulseCheck to turn mental readiness from a blind spot into a competitive advantage.</p>
                        <div className="conversion-ctas">
                            <a href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Pilot%20Inquiry" className="btn-primary" style={{ fontSize: '16px', padding: '18px 36px' }}>
                                <PulseBoltIcon className="w-4 h-4" />
                                Request Department Pilot
                            </a>
                            <button type="button" className="btn-secondary" onClick={onJoinWaitlist}>Join Waitlist →</button>
                        </div>
                        <p className="conversion-note">Free pilot for qualifying D1 programs · No commitment required</p>
                    </div>
                </div>
            </section>

            <footer>
                <div className="footer-inner">
                    <div className="footer-brand">
                        <a href="#top" className="nav-logo" style={{ marginBottom: '4px' }}>
                            <div className="nav-logo-icon"><PulseBoltIcon className="w-[18px] h-[18px]" /></div>
                            PulseCheck
                        </a>
                        <p>Building the future of athletic mental performance through AI, sports psychology, and real-time intelligence.</p>
                        <div className="footer-socials">
                            <a href="#top" className="footer-social">𝕏</a>
                            <a href="#top" className="footer-social">in</a>
                            <a href="#top" className="footer-social">ig</a>
                            <a href="#top" className="footer-social">▶</a>
                        </div>
                    </div>
                    <div className="footer-col">
                        <h4>Product</h4>
                        <a href="#top">For Athletes</a>
                        <a href="#top">For Coaches</a>
                        <a href="#top">Clinical Safety</a>
                        <a href="#top">Research</a>
                    </div>
                    <div className="footer-col">
                        <h4>Company</h4>
                        <a href="#top">About</a>
                        <a href="#top">Press Kit</a>
                        <a href="#top">Privacy</a>
                        <a href="#top">Terms</a>
                    </div>
                    <div className="footer-col">
                        <h4>Stay Connected</h4>
                        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>Get updates on new features, community challenges, and athlete content.</p>
                        <div className="footer-subscribe-input">
                            <input type="email" placeholder="you@program.edu" />
                            <button type="button">Subscribe</button>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">© 2026 Pulse Intelligence Labs, Inc. All rights reserved.</div>
            </footer>

            <style>{`
              :root {
                --bg-primary: #0a0b0d;
                --bg-secondary: #111215;
                --bg-card: #16181c;
                --bg-card-hover: #1c1f24;
                --lime: #c8ff00;
                --lime-dim: #c8ff0020;
                --lime-mid: #c8ff0040;
                --cyan: #00e5ff;
                --purple: #b388ff;
                --coral: #ff6b6b;
                --text-primary: #f0f0f2;
                --text-secondary: #8a8d95;
                --text-tertiary: #5a5d65;
                --border: #1e2028;
                --border-light: #2a2d35;
                --font-display: 'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                --font-body: 'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
              }

              .pc-landing * { margin: 0; padding: 0; box-sizing: border-box; }

              html {
                scroll-behavior: smooth;
                scrollbar-width: thin;
                scrollbar-color: var(--border-light) var(--bg-primary);
              }

              body {
                font-family: var(--font-body);
                background: var(--bg-primary);
                color: var(--text-primary);
                line-height: 1.6;
                overflow-x: hidden;
                -webkit-font-smoothing: antialiased;
              }

              body::before {
                content: '';
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
                pointer-events: none;
                z-index: 9999;
              }

              .pc-landing nav {
                position: fixed;
                top: 0; left: 0; right: 0;
                z-index: 100;
                padding: 20px 48px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                backdrop-filter: blur(20px);
                background: rgba(10,11,13,0.8);
                border-bottom: 1px solid var(--border);
              }

              .pc-landing .nav-logo {
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: var(--font-body);
                font-weight: 700;
                font-size: 18px;
                text-decoration: none;
                color: var(--text-primary);
              }

              .pc-landing .nav-logo-icon {
                width: 32px; height: 32px;
                background: var(--lime);
                border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
              }

              .pc-landing .nav-links {
                display: flex;
                align-items: center;
                gap: 36px;
              }

              .pc-landing .nav-links a {
                color: var(--text-secondary);
                text-decoration: none;
                font-size: 14px;
                font-weight: 500;
                transition: color 0.2s;
                letter-spacing: 0.01em;
              }

              .pc-landing .nav-links a:hover { color: var(--text-primary); }

              .pc-landing .nav-cta {
                background: var(--lime) !important;
                color: var(--bg-primary) !important;
                padding: 10px 24px !important;
                border-radius: 8px;
                font-weight: 600 !important;
                font-size: 14px !important;
                transition: opacity 0.2s !important;
              }

              .pc-landing .nav-cta:hover { opacity: 0.9; }

              .pc-landing .hero {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 140px 24px 80px;
                position: relative;
              }

              .pc-landing .hero::before {
                content: '';
                position: absolute;
                top: -20%; left: 50%; transform: translateX(-50%);
                width: 800px; height: 800px;
                background: radial-gradient(ellipse, var(--lime-dim) 0%, transparent 70%);
                pointer-events: none;
              }

              .pc-landing .hero-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 18px;
                border: 1px solid var(--border-light);
                border-radius: 100px;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-secondary);
                margin-bottom: 32px;
                opacity: 0;
                animation: fadeUp 0.8s ease 0.2s forwards;
              }

              .pc-landing .hero-badge-dot {
                width: 6px; height: 6px;
                background: var(--lime);
                border-radius: 50%;
                animation: pulse-dot 2s ease infinite;
              }

              @keyframes pulse-dot {
                0%, 100% { box-shadow: 0 0 0 0 var(--lime-mid); }
                50% { box-shadow: 0 0 0 6px transparent; }
              }

              .pc-landing .hero h1 {
                font-family: var(--font-display);
                font-size: clamp(48px, 7vw, 88px);
                line-height: 1.05;
                font-weight: 400;
                letter-spacing: -0.02em;
                max-width: 900px;
                margin-bottom: 28px;
                opacity: 0;
                animation: fadeUp 0.8s ease 0.4s forwards;
              }

              .pc-landing .hero h1 em {
                font-style: italic;
                color: var(--lime);
              }

              .pc-landing .hero-sub {
                font-size: 19px;
                color: var(--text-secondary);
                max-width: 560px;
                line-height: 1.7;
                margin-bottom: 48px;
                opacity: 0;
                animation: fadeUp 0.8s ease 0.6s forwards;
              }

              .pc-landing .hero-ctas {
                display: flex;
                gap: 16px;
                align-items: center;
                opacity: 0;
                animation: fadeUp 0.8s ease 0.8s forwards;
              }

              .pc-landing .btn-primary {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                background: var(--lime);
                color: var(--bg-primary);
                padding: 16px 32px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 15px;
                text-decoration: none;
                transition: all 0.25s;
                border: none;
                cursor: pointer;
              }

              .pc-landing .btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 8px 30px var(--lime-dim);
              }

              .pc-landing .btn-secondary {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: var(--text-secondary);
                padding: 16px 28px;
                font-weight: 500;
                font-size: 15px;
                text-decoration: none;
                transition: color 0.2s;
                border: 1px solid var(--border);
                border-radius: 12px;
                background: transparent;
                cursor: pointer;
              }

              .pc-landing .btn-secondary:hover { color: var(--text-primary); border-color: var(--border-light); }

              .pc-landing .hero-proof {
                margin-top: 72px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 20px;
                opacity: 0;
                animation: fadeUp 0.8s ease 1s forwards;
              }

              .pc-landing .hero-proof-label {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.12em;
                color: var(--text-tertiary);
                font-weight: 600;
              }

              .pc-landing .hero-proof-logos {
                display: flex;
                gap: 48px;
                align-items: center;
              }

              .pc-landing .proof-logo {
                font-family: var(--font-body);
                font-weight: 700;
                font-size: 15px;
                color: var(--text-tertiary);
                letter-spacing: 0.05em;
                opacity: 0.6;
                transition: opacity 0.2s;
              }

              .pc-landing .proof-logo:hover { opacity: 1; }

              .pc-landing .terminal-section {
                padding: 40px 24px 120px;
                display: flex;
                justify-content: center;
              }

              .pc-landing .terminal-wrapper { max-width: 680px; width: 100%; opacity: 0; animation: fadeUp 0.8s ease 1.2s forwards; }
              .pc-landing .terminal { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px var(--border); }
              .pc-landing .terminal-header { display: flex; align-items: center; gap: 8px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
              .pc-landing .terminal-dot { width: 12px; height: 12px; border-radius: 50%; }
              .pc-landing .terminal-dot.red { background: #ff5f57; }
              .pc-landing .terminal-dot.yellow { background: #febc2e; }
              .pc-landing .terminal-dot.green { background: #28c840; }
              .pc-landing .terminal-title { margin-left: 12px; font-family: var(--font-mono); font-size: 12px; color: var(--text-tertiary); }
              .pc-landing .terminal-body { padding: 24px; }
              .pc-landing .terminal-line { display: flex; gap: 12px; margin-bottom: 16px; font-family: var(--font-mono); font-size: 13px; line-height: 1.6; }
              .pc-landing .terminal-prompt { color: var(--lime); user-select: none; flex-shrink: 0; }
              .pc-landing .terminal-text { color: var(--text-secondary); }
              .pc-landing .terminal-text .highlight { color: var(--text-primary); }
              .pc-landing .terminal-response { padding: 16px; background: rgba(200,255,0,0.04); border: 1px solid rgba(200,255,0,0.1); border-radius: 10px; margin-top: 8px; }
              .pc-landing .terminal-response p { font-family: var(--font-mono); font-size: 13px; color: var(--text-secondary); line-height: 1.7; }
              .pc-landing .terminal-response .status { display: inline-flex; align-items: center; gap: 6px; color: var(--lime); font-weight: 500; margin-bottom: 8px; font-size: 12px; }
              .pc-landing .terminal-cursor { display: inline-block; width: 8px; height: 16px; background: var(--lime); animation: blink 1s step-end infinite; vertical-align: text-bottom; margin-left: 2px; }
              @keyframes blink { 50% { opacity: 0; } }

              .pc-landing .problem,
              .pc-landing .simulation,
              .pc-landing .pillars,
              .pc-landing .workflow,
              .pc-landing .conversion { padding: 120px 24px; }

              .pc-landing .proof { padding: 120px 24px; position: relative; background: var(--bg-secondary); }

              .pc-landing .problem,
              .pc-landing .simulation,
              .pc-landing .pillars,
              .pc-landing .proof,
              .pc-landing .workflow,
              .pc-landing .conversion { position: relative; }

              .pc-landing .simulation::before,
              .pc-landing .pillars::before,
              .pc-landing .proof::before,
              .pc-landing .workflow::before,
              .pc-landing .conversion::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 1px;
                background: linear-gradient(90deg, transparent, var(--border-light), transparent);
              }

              .pc-landing .problem-inner,
              .pc-landing .simulation-inner,
              .pc-landing .pillars-inner,
              .pc-landing .proof-inner,
              .pc-landing .workflow-inner,
              .pc-landing .conversion-inner { max-width: 1100px; margin: 0 auto; }

              .pc-landing .problem-inner { max-width: 800px; text-align: center; }

              .pc-landing .section-label {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.14em;
                color: var(--lime);
                font-weight: 600;
                margin-bottom: 24px;
                font-family: var(--font-mono);
              }

              .pc-landing .problem h2,
              .pc-landing .simulation-header h2,
              .pc-landing .pillars-header h2,
              .pc-landing .proof h2,
              .pc-landing .workflow-header h2,
              .pc-landing .conversion h2 {
                font-family: var(--font-display);
                font-size: clamp(36px, 4.5vw, 56px);
                line-height: 1.15;
                font-weight: 400;
              }

              .pc-landing .problem h2 { margin-bottom: 24px; }
              .pc-landing .problem p { font-size: 18px; color: var(--text-secondary); max-width: 600px; margin: 0 auto 64px; line-height: 1.75; }
              .pc-landing .problem-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; background: var(--border); border-radius: 16px; overflow: hidden; }
              .pc-landing .problem-stat { background: var(--bg-secondary); padding: 48px 32px; text-align: center; }
              .pc-landing .problem-stat-number { font-family: var(--font-display); font-size: 52px; color: var(--lime); line-height: 1; margin-bottom: 12px; }
              .pc-landing .problem-stat-label { font-size: 14px; color: var(--text-secondary); max-width: 200px; margin: 0 auto; line-height: 1.5; }

              .pc-landing .simulation-inner,
              .pc-landing .pillars-inner,
              .pc-landing .workflow-inner { max-width: 1100px; }

              .pc-landing .simulation-header,
              .pc-landing .pillars-header,
              .pc-landing .workflow-header { text-align: center; margin-bottom: 64px; }

              .pc-landing .simulation-header h2 em,
              .pc-landing .pillars-header h2 em,
              .pc-landing .proof h2 em,
              .pc-landing .conversion h2 em { font-style: italic; color: var(--lime); }

              .pc-landing .simulation-header p,
              .pc-landing .pillars-header p,
              .pc-landing .workflow-header p { font-size: 17px; color: var(--text-secondary); max-width: 550px; margin: 0 auto; line-height: 1.7; }

              .pc-landing .sim-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }
              .pc-landing .sim-left,
              .pc-landing .sim-right,
              .pc-landing .pillar-card,
              .pc-landing .testimonial,
              .pc-landing .workflow-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; }

              .pc-landing .sim-left { overflow: hidden; }
              .pc-landing .sim-status { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); }
              .pc-landing .sim-status-left { display: flex; align-items: center; gap: 10px; }
              .pc-landing .sim-status-dot { width: 8px; height: 8px; background: var(--lime); border-radius: 50%; animation: pulse-dot 2s ease infinite; }
              .pc-landing .sim-status-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-secondary); font-weight: 500; }
              .pc-landing .sim-context { font-family: var(--font-mono); font-size: 12px; color: var(--text-tertiary); }
              .pc-landing .sim-meters { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--border); }
              .pc-landing .sim-meter { background: var(--bg-card); padding: 24px; text-align: center; }
              .pc-landing .sim-meter-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-tertiary); margin-bottom: 8px; }
              .pc-landing .sim-meter-value { font-family: var(--font-display); font-size: 36px; font-weight: 400; }
              .pc-landing .meter-high { color: var(--coral); }
              .pc-landing .meter-mid { color: #ffc107; }
              .pc-landing .meter-ok { color: var(--lime); }
              .pc-landing .sim-flow { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
              .pc-landing .sim-flow-step { padding: 16px 20px; border-radius: 10px; border-left: 3px solid; }
              .pc-landing .sim-flow-step.trigger { background: rgba(255,107,107,0.06); border-color: var(--coral); }
              .pc-landing .sim-flow-step.prompt { background: rgba(200,255,0,0.04); border-color: var(--lime); }
              .pc-landing .sim-flow-step.result { background: rgba(0,229,255,0.04); border-color: var(--cyan); }
              .pc-landing .sim-flow-step-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; font-weight: 600; }
              .pc-landing .trigger .sim-flow-step-label { color: var(--coral); }
              .pc-landing .prompt .sim-flow-step-label { color: var(--lime); }
              .pc-landing .result .sim-flow-step-label { color: var(--cyan); }
              .pc-landing .sim-flow-step p { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }
              .pc-landing .sim-right { padding: 32px; }
              .pc-landing .sim-right h3 { font-family: var(--font-display); font-size: 28px; font-weight: 400; margin-bottom: 8px; }
              .pc-landing .sim-right > p { font-size: 14px; color: var(--text-tertiary); margin-bottom: 32px; }
              .pc-landing .intervention-steps { display: flex; flex-direction: column; gap: 20px; }
              .pc-landing .intervention-step { display: flex; gap: 16px; align-items: flex-start; }
              .pc-landing .intervention-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; }
              .pc-landing .intervention-icon.detect { background: rgba(255,107,107,0.12); }
              .pc-landing .intervention-icon.reset { background: rgba(0,229,255,0.12); }
              .pc-landing .intervention-icon.reattach { background: rgba(200,255,0,0.12); }
              .pc-landing .intervention-icon.lock { background: rgba(179,136,255,0.12); }
              .pc-landing .intervention-content h4 { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary); }
              .pc-landing .intervention-content p { font-size: 13px; color: var(--text-tertiary); line-height: 1.5; }

              .pc-landing .pillars-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
              .pc-landing .pillar-card { padding: 36px 28px; transition: all 0.3s; position: relative; overflow: hidden; }
              .pc-landing .pillar-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; }
              .pc-landing .pillar-card:nth-child(1)::after { background: var(--cyan); }
              .pc-landing .pillar-card:nth-child(2)::after { background: var(--lime); }
              .pc-landing .pillar-card:nth-child(3)::after { background: var(--purple); }
              .pc-landing .pillar-card:hover { background: var(--bg-card-hover); border-color: var(--border-light); transform: translateY(-4px); }
              .pc-landing .pillar-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; font-size: 22px; }
              .pc-landing .pillar-card:nth-child(1) .pillar-icon { background: rgba(0,229,255,0.12); }
              .pc-landing .pillar-card:nth-child(2) .pillar-icon { background: rgba(200,255,0,0.12); }
              .pc-landing .pillar-card:nth-child(3) .pillar-icon { background: rgba(179,136,255,0.12); }
              .pc-landing .pillar-card h3 { font-size: 20px; font-weight: 600; margin-bottom: 6px; }
              .pc-landing .pillar-card .pillar-subtitle { font-size: 13px; color: var(--text-tertiary); font-family: var(--font-mono); margin-bottom: 16px; }
              .pc-landing .pillar-card > p { font-size: 14px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 24px; }
              .pc-landing .pillar-features { display: flex; flex-direction: column; gap: 10px; }
              .pc-landing .pillar-feature { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-secondary); }
              .pc-landing .pillar-feature-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
              .pc-landing .pillar-card:nth-child(1) .pillar-feature-dot { background: var(--cyan); }
              .pc-landing .pillar-card:nth-child(2) .pillar-feature-dot { background: var(--lime); }
              .pc-landing .pillar-card:nth-child(3) .pillar-feature-dot { background: var(--purple); }

              .pc-landing .proof-inner { max-width: 1000px; text-align: center; }
              .pc-landing .proof h2 { margin-bottom: 0; }
              .pc-landing .testimonials { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; text-align: left; }
              .pc-landing .testimonial { padding: 36px; transition: all 0.3s; }
              .pc-landing .testimonial:hover { border-color: var(--border-light); }
              .pc-landing .testimonial-quote { font-size: 16px; line-height: 1.75; color: var(--text-secondary); margin-bottom: 24px; font-style: italic; }
              .pc-landing .testimonial-author { display: flex; align-items: center; gap: 14px; }
              .pc-landing .testimonial-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; color: var(--bg-primary); }
              .pc-landing .testimonial:nth-child(1) .testimonial-avatar { background: var(--cyan); }
              .pc-landing .testimonial:nth-child(2) .testimonial-avatar { background: var(--lime); }
              .pc-landing .testimonial:nth-child(3) .testimonial-avatar { background: var(--purple); }
              .pc-landing .testimonial:nth-child(4) .testimonial-avatar { background: var(--coral); }
              .pc-landing .testimonial-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
              .pc-landing .testimonial-role { font-size: 13px; color: var(--text-tertiary); }

              .pc-landing .workflow-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
              .pc-landing .workflow-card { padding: 40px 36px; position: relative; overflow: hidden; }
              .pc-landing .workflow-card-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; font-size: 24px; }
              .pc-landing .workflow-card:nth-child(1) .workflow-card-icon { background: rgba(0,229,255,0.12); }
              .pc-landing .workflow-card:nth-child(2) .workflow-card-icon { background: rgba(200,255,0,0.12); }
              .pc-landing .workflow-card h3 { font-size: 24px; font-weight: 600; margin-bottom: 12px; }
              .pc-landing .workflow-card > p { font-size: 15px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 28px; }
              .pc-landing .workflow-features { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
              .pc-landing .workflow-feature { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text-secondary); }
              .pc-landing .workflow-feature svg { flex-shrink: 0; color: var(--lime); }
              .pc-landing .mini-dash { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-top: 8px; }
              .pc-landing .mini-dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
              .pc-landing .mini-dash-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
              .pc-landing .mini-dash-live { font-family: var(--font-mono); font-size: 10px; color: var(--lime); display: flex; align-items: center; gap: 5px; }
              .pc-landing .mini-dash-live::before { content: ''; width: 6px; height: 6px; background: var(--lime); border-radius: 50%; }
              .pc-landing .mini-dash-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
              .pc-landing .mini-stat { text-align: center; padding: 12px 8px; background: var(--bg-card); border-radius: 8px; }
              .pc-landing .mini-stat-value { font-size: 22px; font-weight: 700; }
              .pc-landing .mini-stat-label { font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
              .pc-landing .mini-roster { display: flex; flex-direction: column; gap: 8px; }
              .pc-landing .roster-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg-card); border-radius: 8px; font-size: 13px; }
              .pc-landing .roster-left { display: flex; align-items: center; gap: 10px; }
              .pc-landing .roster-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: var(--bg-primary); }
              .pc-landing .roster-info { display: flex; flex-direction: column; }
              .pc-landing .roster-name { font-weight: 500; font-size: 13px; }
              .pc-landing .roster-status { font-size: 11px; color: var(--text-tertiary); }
              .pc-landing .roster-score { font-family: var(--font-mono); font-weight: 600; font-size: 13px; }
              .pc-landing .score-green { color: var(--lime); }
              .pc-landing .score-yellow { color: #ffc107; }
              .pc-landing .score-red { color: var(--coral); }

              .pc-landing .conversion-inner { max-width: 760px; text-align: center; position: relative; }
              .pc-landing .conversion-inner::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; height: 400px; background: radial-gradient(ellipse, var(--lime-dim) 0%, transparent 70%); pointer-events: none; }
              .pc-landing .conversion h2 { margin-bottom: 20px; position: relative; }
              .pc-landing .conversion > .conversion-inner > p { font-size: 18px; color: var(--text-secondary); max-width: 480px; margin: 0 auto 48px; line-height: 1.75; position: relative; }
              .pc-landing .conversion-ctas { display: flex; gap: 16px; justify-content: center; position: relative; margin-bottom: 48px; }
              .pc-landing .conversion-note { font-size: 13px; color: var(--text-tertiary); position: relative; }

              .pc-landing footer { padding: 80px 48px 40px; border-top: 1px solid var(--border); }
              .pc-landing .footer-inner { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 48px; }
              .pc-landing .footer-brand p { font-size: 14px; color: var(--text-tertiary); margin-top: 16px; line-height: 1.6; max-width: 280px; }
              .pc-landing .footer-socials { display: flex; gap: 12px; margin-top: 20px; }
              .pc-landing .footer-social { width: 36px; height: 36px; border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); text-decoration: none; font-size: 14px; transition: all 0.2s; }
              .pc-landing .footer-social:hover { border-color: var(--border-light); color: var(--text-primary); }
              .pc-landing .footer-col h4 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-tertiary); margin-bottom: 20px; }
              .pc-landing .footer-col a { display: block; color: var(--text-secondary); text-decoration: none; font-size: 14px; margin-bottom: 12px; transition: color 0.2s; }
              .pc-landing .footer-col a:hover { color: var(--text-primary); }
              .pc-landing .footer-subscribe-input { display: flex; gap: 8px; margin-top: 12px; }
              .pc-landing .footer-subscribe-input input { flex: 1; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--text-primary); font-family: var(--font-body); outline: none; transition: border-color 0.2s; }
              .pc-landing .footer-subscribe-input input:focus { border-color: var(--lime); }
              .pc-landing .footer-subscribe-input input::placeholder { color: var(--text-tertiary); }
              .pc-landing .footer-subscribe-input button { background: var(--lime); color: var(--bg-primary); border: none; border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--font-body); transition: opacity 0.2s; }
              .pc-landing .footer-subscribe-input button:hover { opacity: 0.9; }
              .pc-landing .footer-bottom { max-width: 1100px; margin: 48px auto 0; padding-top: 24px; border-top: 1px solid var(--border); text-align: center; font-size: 13px; color: var(--text-tertiary); }

              @keyframes fadeUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }

              .pc-landing .reveal {
                opacity: 0;
                transform: translateY(30px);
                transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1);
              }

              .pc-landing .reveal.visible {
                opacity: 1;
                transform: translateY(0);
              }

              @media (max-width: 900px) {
                .pc-landing nav { padding: 16px 24px; }
                .pc-landing .nav-links a:not(.nav-cta) { display: none; }
                .pc-landing .problem-stats { grid-template-columns: 1fr; }
                .pc-landing .sim-grid { grid-template-columns: 1fr; }
                .pc-landing .pillars-grid { grid-template-columns: 1fr; }
                .pc-landing .testimonials { grid-template-columns: 1fr; }
                .pc-landing .workflow-grid { grid-template-columns: 1fr; }
                .pc-landing .footer-inner { grid-template-columns: 1fr 1fr; gap: 36px; }
                .pc-landing .hero-proof-logos { flex-wrap: wrap; justify-content: center; gap: 28px; }
                .pc-landing .hero-ctas,
                .pc-landing .conversion-ctas { flex-direction: column; align-items: stretch; }
              }
            `}</style>
        </div>
    );
};

export default PulseCheckMarketingLanding;
