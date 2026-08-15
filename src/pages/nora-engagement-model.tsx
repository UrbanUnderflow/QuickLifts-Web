import type { NextPage } from 'next';
import React from 'react';
import {
  ArrowRight,
  Brain,
  Check,
  CircleAlert,
  ExternalLink,
  Eye,
  Gauge,
  Hand,
  HeartHandshake,
  MessageCircle,
  Route,
  Scale,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  Target,
  UserRoundCheck,
} from 'lucide-react';
import PageHead from '../components/PageHead';

const PAGE_TITLE = 'The Nora Engagement Model | Pulse Intelligence Labs';
const PAGE_DESCRIPTION =
  'How Nora uses an evidence-informed, athlete-led mental-performance conversation model with explicit clinical, safety, health-data and consent boundaries.';
const PAGE_URL = 'https://pulseintelligencelabs.com/nora-engagement-model';
const PAGE_IMAGE = 'https://pulseintelligencelabs.com/pulsecheck-pro-og-clean.png';

const lanes = [
  {
    number: '01',
    label: 'Performance',
    title: 'Stay with the sport moment',
    body: 'Nora supports focus, confidence, motivation, composure, routines and decisions tied to practice or competition.',
    limit: 'No diagnosis, hidden-emotion inference, physical programming or unrelated health-data pivot.',
    icon: Target,
    tone: 'green',
  },
  {
    number: '02',
    label: 'Health data',
    title: 'Read only what was requested',
    body: 'When an athlete asks about sleep, activity, recovery, heart rate, HRV, calories or nutrition, Nora answers that domain.',
    limit: 'Missing, partial and stale data are labeled. One value never becomes a judgment about the athlete or the day.',
    icon: Gauge,
    tone: 'blue',
  },
  {
    number: '03',
    label: 'Clinical care',
    title: 'Hand off to licensed care',
    body: 'Mental-health care and loss of daily function route to a licensed mental-health professional. Concerning physical symptoms route to an athletic trainer or medical clinician.',
    limit: 'Nora does not probe, diagnose, treat, medically assess or clear participation.',
    icon: Stethoscope,
    tone: 'orange',
  },
  {
    number: '04',
    label: 'Critical safety',
    title: 'Act on immediate risk',
    body: 'Suicide, self-harm or immediate-danger language receives direct 911 and 988 guidance and activates the configured support path.',
    limit: 'Performance coaching stops.',
    icon: Siren,
    tone: 'red',
  },
  {
    number: '05',
    label: 'Closure',
    title: 'Let the exchange end',
    body: 'A thank-you or clear close gets a brief, warm response.',
    limit: 'No new question, assignment, advice or topic.',
    icon: Hand,
    tone: 'gray',
  },
];

const loop = [
  ['Notice', 'Name the exact sport detail the athlete gave.'],
  ['Reflect', 'Restate it in one grounded sentence without inventing a hidden feeling.'],
  ['Clarify', 'Ask at most one question, and only when one missing detail matters.'],
  ['Connect', 'Tie the athlete\'s words to their goal, sport context, saved pattern or explicit data request.'],
  ['Offer', 'With permission when appropriate, offer one bounded mental-performance option.'],
  ['Track', 'Save or combine a recurring performance pattern only after athlete approval.'],
];

const rubric = [
  ['Scope boundary', 'Factual reflection only: no therapy, diagnosis, treatment, inferred state or new feeling label.'],
  ['Lane fit', 'The response follows the behavior required by the active lane.'],
  ['Topic continuity', 'Nora stays with the topic the athlete selected.'],
  ['Question discipline', 'One question at most.'],
  ['Health data pull-only', 'Requested data stays in its domain, and Nora adds no physical or nutrition prescription.'],
  ['Non-shaming', 'No poor, lazy, failed, weak or lose-your-gains framing.'],
  ['Autonomy support', 'No you-have-to, you-must, just-push-through or no-excuses language.'],
  ['Plain language', 'Concrete wording an athlete can understand while moving through a real day.'],
  ['No repetition', 'Each turn adds something instead of replaying Nora\'s last message.'],
  ['Consent and tracking', 'No note is changed without approval, and a request not to track is explicitly honored.'],
];

const evidence = [
  {
    title: 'Autonomy-supportive coaching',
    use: 'Permission, bounded choices, athlete-owned goals and non-controlling language.',
    limit: 'These principles inform communication. Nora does not claim to deliver Motivational Interviewing or psychotherapy.',
    source: 'Autonomy-supportive coaching review',
    href: 'https://selfdeterminationtheory.org/wp-content/uploads/2022/02/InPress_MossmanSlempEtAl_Autonomy.pdf',
  },
  {
    title: 'Self-determination theory',
    use: 'Support autonomy, competence and connection while keeping the athlete in control of the next step.',
    limit: 'A theory-informed product rule is not proof that the complete Nora system changes outcomes.',
    source: 'SDT and exercise review',
    href: 'https://pubmed.ncbi.nlm.nih.gov/22726453/',
  },
  {
    title: 'Psychological skills training',
    use: 'Bounded imagery, self-talk, attention routines and pre-performance plans for named sport moments.',
    limit: 'Evidence for a technique does not establish clinical efficacy or validate every generated conversation.',
    source: 'Sport intervention meta-analysis',
    href: 'https://pubmed.ncbi.nlm.nih.gov/37812334/',
  },
  {
    title: 'Implementation intentions',
    use: 'Turn an athlete-selected goal into a simple if-then plan tied to an observable sport trigger.',
    limit: 'An if-then performance plan is not a treatment plan.',
    source: 'Implementation-intention meta-analysis',
    href: 'https://pubmed.ncbi.nlm.nih.gov/31923898/',
  },
  {
    title: 'Subjective athlete monitoring',
    use: 'Treat the athlete\'s own report as meaningful context and compare it carefully with available data.',
    limit: 'A Nora check-in is not a clinical screen unless an approved, separately identified validated instrument is being administered.',
    source: 'Athlete-monitoring review',
    href: 'https://pubmed.ncbi.nlm.nih.gov/26423706/',
  },
  {
    title: 'Imagery and self-talk',
    use: 'Offer one specific rehearsal or athlete-chosen phrase linked to a named competition or practice moment.',
    limit: 'Nora offers a performance skill, not CBT, ACT or another clinical treatment.',
    source: 'Self-talk meta-analysis',
    href: 'https://pubmed.ncbi.nlm.nih.gov/26167788/',
  },
];

const sources = [
  ['Illinois Public Act 104-0054', 'https://ilga.gov/Legislation/PublicActs/View/104-0054'],
  ['NCAA Mental Health Best Practices', 'https://www.ncaa.org/what-we-do/health-safety-and-performance/mental-health/best-practices/'],
  ['Elite athlete wellbeing interventions review', 'https://pubmed.ncbi.nlm.nih.gov/39815135/'],
  ['Sport performance intervention meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/37812334/'],
  ['Imagery practice meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/40426460/'],
];

const NoraEngagementModelPage: NextPage = () => (
  <>
    <PageHead
      metaData={{
        pageId: 'nora-engagement-model',
        pageTitle: PAGE_TITLE,
        metaDescription: PAGE_DESCRIPTION,
        ogTitle: PAGE_TITLE,
        ogDescription: PAGE_DESCRIPTION,
        ogImage: PAGE_IMAGE,
        ogUrl: PAGE_URL,
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: PAGE_TITLE,
        twitterDescription: PAGE_DESCRIPTION,
        twitterImage: PAGE_IMAGE,
        lastUpdated: '2026-08-14T00:00:00.000Z',
      }}
      pageOgUrl={PAGE_URL}
      pageOgImage="/pulsecheck-pro-og-clean.png"
      themeColor="#0b0f0e"
    />

    <main className="nora-page">
      <header className="site-header">
        <a href="/PIL" className="brand" aria-label="Pulse Intelligence Labs home">
          <img src="/pulse-logo-green.svg" alt="" />
          <span>Pulse Intelligence Labs</span>
        </a>
        <nav aria-label="Page navigation">
          <a href="/Nora">Meet Nora</a>
          <a href="#scope">Scope</a>
          <a href="#loop">Engagement loop</a>
          <a href="#rubric">Rubric</a>
          <a href="#evidence">Evidence</a>
        </nav>
        <a className="header-link" href="mailto:tre@pulseintelligencelabs.com?subject=Nora%20Methods%20Review">
          Discuss with our team <ArrowRight size={16} />
        </a>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div className="hero-aurora" />
        <div className="hero-grid" />
        <div className="hero-scanlines" />
        <div className="hero-content">
          <p className="eyebrow">Methods and governance · Version 2026.08.14</p>
          <h1 id="page-title">The Nora Engagement Model</h1>
          <p>
            An athlete-led conversation system for sport mental performance, with explicit boundaries for health
            data, licensed care, critical safety and athlete consent.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#scope">See how it works <ArrowRight size={17} /></a>
            <a className="button secondary" href="#evidence">Review the evidence <ArrowRight size={17} /></a>
          </div>
        </div>
        <div className="hero-orb-stage" aria-hidden="true">
          <div className="hero-orb-rings" />
          <div className="hero-orb" />
          <div className="hero-mini-card card-a">
            <span>Lane</span>
            <strong>Performance</strong>
          </div>
          <div className="hero-mini-card card-b">
            <span>Rubric</span>
            <strong>10/10</strong>
          </div>
        </div>
        <div className="hero-rule">
          <ShieldCheck size={22} />
          <div>
            <span>Product boundary</span>
            <strong>AI mental-performance coaching for sport. Clinical care stays with licensed professionals.</strong>
          </div>
        </div>
      </section>

      <section className="boundary-band" id="scope" aria-labelledby="scope-title">
        <div className="section-heading">
          <p className="eyebrow ink">The boundary comes first</p>
          <h2 id="scope-title">What Nora is built to do, and where Nora stops.</h2>
        </div>
        <div className="boundary-columns">
          <article>
            <UserRoundCheck size={25} />
            <h3>Nora supports</h3>
            <ul>
              <li><Check size={17} /> Sport-performance reflection</li>
              <li><Check size={17} /> Focus, confidence, motivation and composure</li>
              <li><Check size={17} /> Pre-performance routines, imagery, self-talk and if-then plans</li>
              <li><Check size={17} /> Athlete-requested health-data explanation</li>
              <li><Check size={17} /> Navigation to university support</li>
            </ul>
          </article>
          <article className="stop-list">
            <CircleAlert size={25} />
            <h3>Nora does not provide</h3>
            <ul>
              <li><span>×</span> Therapy, psychotherapy or counseling</li>
              <li><span>×</span> Diagnosis, clinical assessment or emotion detection</li>
              <li><span>×</span> Treatment, treatment plans or medication guidance</li>
              <li><span>×</span> Clinical decision-making or return-to-participation clearance</li>
              <li><span>×</span> Physical training or nutrition prescriptions</li>
            </ul>
          </article>
        </div>
        <p className="boundary-note">
          This boundary is implemented in prompts, deterministic routing, response scoring, safety classification
          and tests. It is a product-control statement, not a legal opinion or certification.
        </p>
      </section>

      <section className="lanes-section" aria-labelledby="lanes-title">
        <div className="section-heading light">
          <p className="eyebrow">The scope gate</p>
          <h2 id="lanes-title">Every athlete turn enters one lane before Nora answers.</h2>
          <p>Clear mental-health, medical and critical-safety language is handled before a generative response is requested.</p>
        </div>
        <div className="lane-list">
          {lanes.map((lane) => {
            const Icon = lane.icon;
            return (
              <article key={lane.label} className={`lane ${lane.tone}`}>
                <span className="lane-number">{lane.number}</span>
                <div className="lane-icon"><Icon size={22} /></div>
                <div className="lane-copy">
                  <p>{lane.label}</p>
                  <h3>{lane.title}</h3>
                  <span>{lane.body}</span>
                </div>
                <div className="lane-limit"><ShieldCheck size={17} /><span>{lane.limit}</span></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="loop-section" id="loop" aria-labelledby="loop-title">
        <div className="loop-heading">
          <div>
            <p className="eyebrow ink">The conversation method</p>
            <h2 id="loop-title">The Nora Engagement Loop</h2>
          </div>
          <p>
            Nora uses only the steps the current turn needs. The loop is a decision model, not a six-part script
            pasted into every response.
          </p>
        </div>
        <div className="loop-track">
          {loop.map(([title, body], index) => (
            <article key={title}>
              <div><span>{index + 1}</span>{index < loop.length - 1 ? <ArrowRight size={18} /> : <Check size={18} />}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <div className="loop-example">
          <div className="phone-visual" aria-label="PulseCheck Nora conversation screen">
            <img src="/pulsecheck-media/full/02-nora-chat.png" alt="Nora conversation inside the PulseCheck app" />
          </div>
          <div className="example-copy">
            <p className="eyebrow">Example: motivation and needing a break</p>
            <h3>Stay with what the athlete actually said.</h3>
            <div className="chat-line athlete">I&apos;m tired and my motivation has been low. I feel like I need a break, but I&apos;m worried about losing my progress.</div>
            <div className="chat-line nora">You said motivation is low and you want space to reset. Would it help to define what a useful mental reset needs to give you right now?</div>
            <ul>
              <li><Check size={16} /> Reflects the low motivation and need for a reset</li>
              <li><Check size={16} /> Asks one permission-based question</li>
              <li><Check size={16} /> Does not introduce food, calorie burn, activity or a poor label</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rubric-section" id="rubric" aria-labelledby="rubric-title">
        <div className="rubric-intro">
          <div>
            <p className="eyebrow ink">Runtime quality gate</p>
            <h2 id="rubric-title">Ten checks. Ten required passes.</h2>
          </div>
          <div className="score-display" aria-label="Ten out of ten required">
            <strong>10<span>/10</span></strong>
            <p>required before delivery</p>
          </div>
        </div>
        <div className="rubric-grid">
          {rubric.map(([title, body], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{title}</h3><p>{body}</p></div>
              <Check size={18} />
            </article>
          ))}
        </div>
        <div className="runtime-flow">
          <Route size={24} />
          <p><strong>Generated response fails:</strong> Nora revises it up to two times using the failed dimensions.</p>
          <ArrowRight size={20} />
          <p><strong>Still below 10:</strong> a deterministic lane-safe fallback replaces it.</p>
        </div>
      </section>

      <section className="evidence-section" id="evidence" aria-labelledby="evidence-title">
        <div className="section-heading light">
          <p className="eyebrow">Scientific basis</p>
          <h2 id="evidence-title">Evidence-informed methods, with the claim limits shown.</h2>
          <p>
            The research supports principles and individual performance techniques used by Nora. It does not establish
            that Nora is clinically validated, therapeutic or proven as a complete intervention.
          </p>
        </div>
        <div className="evidence-table" role="table" aria-label="Evidence used by Nora and claim limits">
          <div className="evidence-header" role="row">
            <span role="columnheader">Evidence area</span>
            <span role="columnheader">How it appears in Nora</span>
            <span role="columnheader">What we do not claim</span>
          </div>
          {evidence.map((item) => (
            <article key={item.title} role="row">
              <div role="cell"><Brain size={19} /><strong>{item.title}</strong></div>
              <p role="cell">{item.use}</p>
              <div role="cell" className="limit-cell"><p>{item.limit}</p><a href={item.href} target="_blank" rel="noreferrer">{item.source} <ExternalLink size={14} /></a></div>
            </article>
          ))}
        </div>
      </section>

      <section className="notes-section" aria-labelledby="notes-title">
        <div className="notes-copy">
          <p className="eyebrow ink">Athlete-controlled memory</p>
          <h2 id="notes-title">Performance patterns, not inferred clinical records.</h2>
          <p>
            Mental notes help an athlete compare recurring sport moments. The system uses recurrence, semantic
            matching and explicit consent to prevent duplicate or surprise notes.
          </p>
        </div>
        <ol className="notes-rules">
          <li><span>1</span><div><strong>Require recurrence</strong><p>At least two athlete statements must describe the same recurring sport pattern, not merely the same broad category.</p></div></li>
          <li><span>2</span><div><strong>Exclude clinical content</strong><p>Clinical, safety, body or food distress, one-off mood and ambiguous content do not become proactive candidates.</p></div></li>
          <li><span>3</span><div><strong>Match meaning</strong><p>Trigger, sport moment, goal, behavior and time horizon matter more than title wording.</p></div></li>
          <li><span>4</span><div><strong>Ask before changing anything</strong><p>Create, update and combine actions require athlete approval.</p></div></li>
          <li><span>5</span><div><strong>Honor no</strong><p>A typed request not to track is never treated as consent and suppresses a proactive suggestion for that exchange.</p></div></li>
        </ol>
      </section>

      <section className="governance-section" aria-labelledby="governance-title">
        <div className="governance-heading">
          <Scale size={27} />
          <div><p className="eyebrow">Governance and legal alignment</p><h2 id="governance-title">Front-load the boundary. Verify the real deployment.</h2></div>
        </div>
        <div className="governance-grid">
          <article>
            <ShieldCheck size={22} />
            <h3>Illinois boundary</h3>
            <p>
              Illinois Public Act 104-0054 is part of the deployment review. PulseCheck is designed for sport
              mental-performance coaching, while mental-health and medical concerns route to the appropriate licensed professionals.
            </p>
          </article>
          <article>
            <HeartHandshake size={22} />
            <h3>University clinical ownership</h3>
            <p>
              NCAA guidance keeps formal evaluation and treatment with qualified providers. University clinical and
              athletics health-care teams own care pathways and emergency procedures.
            </p>
          </article>
          <article>
            <Eye size={22} />
            <h3>Observable controls</h3>
            <p>
              Lane, rubric score, failures, revisions and fallback use are logged. Clinical and critical-safety copy is
              changed only with human review.
            </p>
          </article>
        </div>
        <div className="legal-callout">
          <CircleAlert size={21} />
          <p>
            This page describes product design and evidence framing. It does not certify legal compliance, determine
            whether a specific deployment is regulated, or replace review by university counsel, clinical leadership,
            privacy leadership and athletics health-care leadership.
          </p>
        </div>
      </section>

      <section className="sources-section" aria-labelledby="sources-title">
        <div><p className="eyebrow ink">Review the record</p><h2 id="sources-title">Primary and research sources</h2></div>
        <div className="source-links">
          {sources.map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noreferrer">{label}<ExternalLink size={15} /></a>
          ))}
        </div>
      </section>

      <section className="closing-section">
        <Sparkles size={25} />
        <h2>Bring Nora&apos;s methods into the review room.</h2>
        <p>We can walk university medical, counseling, legal, privacy and athletics teams through the model and its controls.</p>
        <a className="button primary" href="mailto:tre@pulseintelligencelabs.com?subject=Nora%20Methods%20Review">Schedule a methods review <ArrowRight size={17} /></a>
      </section>

      <footer className="page-footer">
        <a href="/PIL" className="brand" aria-label="Pulse Intelligence Labs home"><img src="/pulse-logo-green.svg" alt="" /><span>Pulse Intelligence Labs</span></a>
        <a href="/NCAA-Compliance">University mental-health operations</a>
        <span>© 2026 Pulse Intelligence Labs, Inc.</span>
      </footer>

      <style jsx>{`
        .nora-page {
          --ink: #e9ecef;
          --muted: rgba(255,255,255,.58);
          --panel: rgba(255,255,255,.028);
          --panel-strong: rgba(255,255,255,.045);
          --line: rgba(190,242,100,.13);
          --green: #d8ff24;
          --mint: #50d3a2;
          --blue: #6ab6ff;
          --orange: #ffb25d;
          --red: #ff6b66;
          min-height: 100vh;
          color: var(--ink);
          background:
            radial-gradient(ellipse at 20% 0%, rgba(190,242,100,.07), transparent 42%),
            radial-gradient(ellipse at 80% 20%, rgba(120,120,255,.06), transparent 45%),
            #05070a;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Inter, sans-serif;
          overflow-x: hidden;
        }
        * { box-sizing: border-box; }
        h1, h2, h3, p { letter-spacing: 0; }
        .site-header {
          position: fixed;
          top: 0;
          right: 0;
          left: 0;
          z-index: 20;
          min-height: 74px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 24px;
          padding: 0 48px;
          color: white;
          background: rgba(5,7,10,.68);
          border-bottom: 1px solid rgba(255,255,255,.08);
          backdrop-filter: blur(18px) saturate(170%);
          -webkit-backdrop-filter: blur(18px) saturate(170%);
        }
        .brand { display: inline-flex; align-items: center; gap: 11px; color: inherit; font-weight: 800; text-decoration: none; }
        .brand img { width: 29px; height: 29px; object-fit: contain; filter: drop-shadow(0 0 12px rgba(216,255,36,.35)); }
        nav { display: flex; align-items: center; gap: 23px; }
        nav a, .header-link { color: rgba(255,255,255,.62); font-size: 13px; font-weight: 700; text-decoration: none; transition: color .2s; }
        nav a:hover, .header-link:hover { color: hsl(140,90%,72%); }
        .header-link { justify-self: end; display: inline-flex; align-items: center; gap: 7px; padding: 10px 14px; border: 1px solid rgba(190,242,100,.18); border-radius: 12px; background: rgba(190,242,100,.055); }
        .hero {
          position: relative;
          min-height: 100svh;
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(320px, .72fr);
          align-items: center;
          gap: 54px;
          padding: 132px 7vw 132px;
          overflow: hidden;
          color: white;
          background: #05070a;
        }
        .hero-aurora {
          position: absolute; inset: -24% -12%;
          background: conic-gradient(from 180deg at 50% 50%, rgba(190,242,100,.16), rgba(80,211,162,.1), rgba(106,182,255,.08), rgba(160,105,255,.08), rgba(190,242,100,.16));
          filter: blur(110px);
          opacity: .7;
          animation: heroSpin 32s linear infinite;
        }
        @keyframes heroSpin { to { transform: rotate(360deg); } }
        .hero-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(190,242,100,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(190,242,100,.035) 1px, transparent 1px);
          background-size: 62px 62px;
          mask-image: radial-gradient(ellipse at center, black 24%, transparent 72%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 24%, transparent 72%);
          pointer-events: none;
        }
        .hero-scanlines {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.014) 2px, rgba(255,255,255,.014) 3px);
          pointer-events: none;
        }
        .hero-content { position: relative; z-index: 1; max-width: 820px; }
        .eyebrow {
          display: inline-flex;
          margin: 0 0 18px;
          padding: 6px 14px;
          color: hsl(100,80%,75%);
          background: rgba(190,242,100,.07);
          border: 1px solid rgba(190,242,100,.22);
          border-radius: 999px;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .18em;
          text-transform: uppercase;
        }
        .eyebrow.ink { color: hsl(100,80%,75%); }
        .hero h1 { max-width: 800px; margin: 0; font-size: clamp(48px, 6vw, 86px); line-height: 1.02; font-weight: 760; letter-spacing: -.04em; }
        .hero h1::after {
          content: '';
          display: block;
          width: min(360px, 70%);
          height: 2px;
          margin-top: 24px;
          background: linear-gradient(90deg, var(--green), rgba(80,211,162,.7), transparent);
        }
        .hero-content > p:not(.eyebrow) { max-width: 710px; margin: 22px 0 0; color: rgba(255,255,255,.66); font-size: 20px; line-height: 1.65; }
        .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
        .button { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 20px; border: 1px solid transparent; border-radius: 12px; font-size: 14px; font-weight: 800; text-decoration: none; transition: transform .2s, border-color .2s, background .2s; }
        .button:hover { transform: translateY(-2px); }
        .button.primary { color: #07120d; background: linear-gradient(135deg, hsl(95,92%,58%), hsl(160,80%,45%)); box-shadow: 0 6px 28px hsla(120,85%,60%,.24); }
        .button.secondary { color: rgba(255,255,255,.78); background: rgba(255,255,255,.025); border-color: rgba(255,255,255,.14); }
        .hero-orb-stage { position: relative; z-index: 1; width: min(420px, 100%); aspect-ratio: 1; justify-self: center; display: grid; place-items: center; }
        .hero-orb-rings { position: absolute; inset: 38px; border: 1px dashed rgba(216,255,36,.35); border-radius: 50%; box-shadow: 0 0 80px rgba(216,255,36,.16), inset 0 0 80px rgba(80,211,162,.08); animation: heroSpin 22s linear infinite reverse; }
        .hero-orb-rings::before, .hero-orb-rings::after { content: ''; position: absolute; inset: 34px; border: 1px solid rgba(80,211,162,.18); border-radius: 50%; }
        .hero-orb-rings::after { inset: -28px; border-style: dashed; border-color: rgba(106,182,255,.13); }
        .hero-orb {
          width: 118px; height: 118px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.65), hsl(95,90%,58%) 43%, hsl(150,80%,30%));
          box-shadow: 0 0 42px rgba(216,255,36,.55), 0 0 110px rgba(80,211,162,.24), inset 0 0 30px rgba(255,255,255,.18);
          animation: orbPulse 3.4s ease-in-out infinite;
        }
        @keyframes orbPulse { 50% { transform: scale(1.07); box-shadow: 0 0 58px rgba(216,255,36,.7), 0 0 135px rgba(80,211,162,.34), inset 0 0 34px rgba(255,255,255,.24); } }
        .hero-mini-card { position: absolute; min-width: 150px; padding: 14px 16px; border: 1px solid rgba(255,255,255,.11); border-radius: 18px; background: rgba(18,22,24,.58); backdrop-filter: blur(18px) saturate(170%); -webkit-backdrop-filter: blur(18px) saturate(170%); box-shadow: 0 18px 50px rgba(0,0,0,.22); }
        .hero-mini-card span { display: block; margin-bottom: 4px; color: rgba(255,255,255,.42); font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        .hero-mini-card strong { color: white; font-size: 17px; }
        .hero-mini-card.card-a { top: 18%; left: 0; }
        .hero-mini-card.card-b { right: 0; bottom: 18%; }
        .hero-rule { position: absolute; z-index: 2; right: 7vw; bottom: 0; left: 7vw; min-height: 90px; display: flex; align-items: center; gap: 15px; padding: 18px 24px; color: white; background: rgba(15, 20, 18, .72); border: 1px solid rgba(190,242,100,.18); border-bottom: 0; border-radius: 22px 22px 0 0; backdrop-filter: blur(18px) saturate(170%); -webkit-backdrop-filter: blur(18px) saturate(170%); }
        .hero-rule svg { flex: 0 0 auto; color: var(--green); }
        .hero-rule span, .hero-rule strong { display: block; }
        .hero-rule span { margin-bottom: 4px; color: rgba(255,255,255,.45); font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        .hero-rule strong { font-size: 15px; line-height: 1.4; }
        .boundary-band, .loop-section, .rubric-section, .evidence-section, .notes-section, .governance-section, .sources-section { padding: 110px 7vw; }
        .section-heading { display: grid; grid-template-columns: .9fr 1.1fr; gap: 35px 80px; align-items: end; }
        .section-heading .eyebrow { grid-column: 1 / -1; margin-bottom: -14px; }
        .section-heading h2, .loop-heading h2, .rubric-intro h2, .notes-copy h2, .governance-heading h2, .sources-section h2 { margin: 0; color: white; font-size: clamp(36px, 4.2vw, 58px); line-height: 1.06; letter-spacing: -.035em; }
        .section-heading > p:not(.eyebrow), .loop-heading > p, .notes-copy > p:not(.eyebrow) { margin: 0; color: var(--muted); font-size: 17px; line-height: 1.7; }
        .boundary-band, .loop-section, .rubric-section, .evidence-section, .notes-section, .governance-section, .sources-section, .lanes-section { color: white; background: transparent; }
        .boundary-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 52px; }
        .boundary-columns article, .lane, .rubric-grid article, .governance-grid article, .notes-rules li, .source-links a, .runtime-flow, .legal-callout, .evidence-table, .closing-section, .phone-visual, .chat-line, .score-display {
          background: var(--panel);
          border: 1px solid rgba(255,255,255,.075);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
        }
        .boundary-columns article { padding: 34px; border-radius: 22px; }
        .boundary-columns article > svg { color: var(--green); }
        .boundary-columns h3 { margin: 16px 0 20px; color: white; font-size: 24px; }
        .boundary-columns ul, .example-copy ul { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
        .boundary-columns li, .example-copy li { display: flex; align-items: flex-start; gap: 10px; color: rgba(255,255,255,.66); font-size: 15px; line-height: 1.55; }
        .boundary-columns li svg { flex: 0 0 auto; margin-top: 3px; color: var(--mint); }
        .boundary-columns .stop-list > svg, .stop-list li span { color: var(--red); }
        .stop-list li span { font-size: 20px; line-height: 1; }
        .boundary-note { margin: 22px 0 0; padding: 18px 20px; color: rgba(255,255,255,.58); background: rgba(190,242,100,.05); border: 1px solid rgba(190,242,100,.14); border-radius: 18px; font-size: 14px; line-height: 1.6; }
        .lanes-section { padding: 110px 7vw; }
        .section-heading.light > p:not(.eyebrow) { color: var(--muted); }
        .lane-list { display: grid; gap: 14px; margin-top: 52px; }
        .lane { display: grid; grid-template-columns: 46px 52px minmax(230px, .9fr) minmax(280px, 1.1fr); align-items: center; gap: 18px; min-height: 145px; padding: 24px; border-radius: 22px; }
        .lane-number { color: rgba(255,255,255,.34); font-size: 13px; font-weight: 900; }
        .lane-icon { width: 46px; height: 46px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 50%; }
        .lane.green .lane-icon, .lane.green .lane-copy p { color: var(--mint); }
        .lane.blue .lane-icon, .lane.blue .lane-copy p { color: var(--blue); }
        .lane.orange .lane-icon, .lane.orange .lane-copy p { color: var(--orange); }
        .lane.red .lane-icon, .lane.red .lane-copy p { color: var(--red); }
        .lane.gray .lane-icon, .lane.gray .lane-copy p { color: #d4d9d7; }
        .lane-copy p { margin: 0 0 5px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 11px; font-weight: 900; letter-spacing: .15em; text-transform: uppercase; }
        .lane-copy h3 { margin: 0 0 8px; color: white; font-size: 22px; }
        .lane-copy span, .lane-limit { color: rgba(255,255,255,.64); font-size: 14px; line-height: 1.55; }
        .lane-limit { display: flex; align-items: flex-start; gap: 10px; }
        .lane-limit svg { flex: 0 0 auto; margin-top: 2px; color: var(--green); }
        .loop-heading { display: grid; grid-template-columns: 1fr .8fr; gap: 70px; align-items: end; }
        .loop-track { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1px; margin-top: 52px; overflow: hidden; border: 1px solid rgba(255,255,255,.075); border-radius: 22px; background: rgba(255,255,255,.07); }
        .loop-track article { min-width: 0; padding: 24px 18px 26px; background: rgba(255,255,255,.028); }
        .loop-track article > div { display: flex; align-items: center; justify-content: space-between; color: rgba(255,255,255,.42); }
        .loop-track article > div span { width: 30px; height: 30px; display: grid; place-items: center; color: #07120d; background: var(--green); border-radius: 50%; font-size: 12px; font-weight: 900; }
        .loop-track h3 { margin: 24px 0 8px; color: white; font-size: 18px; }
        .loop-track p, .rubric-grid p, .notes-rules p, .governance-grid p, .evidence-table p { margin: 0; color: rgba(255,255,255,.58); font-size: 14px; line-height: 1.6; }
        .loop-example { display: grid; grid-template-columns: .7fr 1.3fr; gap: 70px; align-items: center; margin-top: 76px; }
        .phone-visual { width: min(330px, 100%); aspect-ratio: .462; justify-self: center; overflow: hidden; border-radius: 42px; border-color: rgba(190,242,100,.18); box-shadow: 0 30px 80px rgba(0,0,0,.45), 0 0 60px rgba(216,255,36,.1); }
        .phone-visual img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
        .example-copy h3 { margin: 0 0 24px; color: white; font-size: 34px; line-height: 1.16; letter-spacing: -.02em; }
        .chat-line { max-width: 640px; margin: 14px 0; padding: 18px 20px; border-radius: 18px; color: white; font-size: 15px; line-height: 1.55; }
        .chat-line.athlete { margin-left: auto; background: rgba(32,55,28,.52); border-color: rgba(216,255,36,.32); }
        .chat-line.nora { background: rgba(255,255,255,.045); }
        .example-copy ul { margin-top: 24px; }
        .example-copy li svg, .rubric-grid svg { flex: 0 0 auto; margin-top: 3px; color: var(--green); }
        .rubric-intro { display: grid; grid-template-columns: 1fr auto; gap: 50px; align-items: end; }
        .score-display { min-width: 210px; padding: 24px; border-radius: 22px; }
        .score-display strong { display: block; color: var(--green); font-size: 62px; line-height: 1; letter-spacing: -.05em; }
        .score-display strong span { color: rgba(255,255,255,.44); font-size: 25px; }
        .score-display p { margin: 9px 0 0; color: rgba(255,255,255,.5); font-size: 13px; }
        .rubric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 52px; }
        .rubric-grid article { min-height: 120px; display: grid; grid-template-columns: 42px 1fr 22px; gap: 16px; align-items: start; padding: 24px; border-radius: 18px; }
        .rubric-grid article > span { color: rgba(255,255,255,.34); font-size: 12px; font-weight: 900; }
        .rubric-grid h3 { margin: 0 0 7px; color: white; font-size: 18px; }
        .runtime-flow { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 18px; align-items: center; margin-top: 28px; padding: 22px 24px; color: white; border-radius: 22px; }
        .runtime-flow > svg:first-child { color: var(--green); }
        .runtime-flow p { margin: 0; color: rgba(255,255,255,.64); font-size: 14px; line-height: 1.5; }
        .runtime-flow strong { color: white; }
        .evidence-table { margin-top: 52px; overflow: hidden; border-radius: 22px; }
        .evidence-header, .evidence-table article { display: grid; grid-template-columns: .7fr 1fr 1.2fr; }
        .evidence-header { min-height: 48px; align-items: center; color: rgba(255,255,255,.38); border-bottom: 1px solid rgba(255,255,255,.09); font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 10px; font-weight: 900; letter-spacing: .15em; text-transform: uppercase; }
        .evidence-header span, .evidence-table article > * { padding: 18px 20px; }
        .evidence-table article { min-height: 148px; border-bottom: 1px solid rgba(255,255,255,.09); }
        .evidence-table article:last-child { border-bottom: 0; }
        .evidence-table article > * { margin: 0; border-right: 1px solid rgba(255,255,255,.09); }
        .evidence-table article > *:last-child { border-right: 0; }
        .evidence-table article > div:first-child { display: flex; align-items: flex-start; gap: 12px; color: white; }
        .evidence-table article > div:first-child svg { flex: 0 0 auto; color: var(--green); }
        .limit-cell a { display: inline-flex; align-items: center; gap: 6px; margin-top: 13px; color: var(--green); font-size: 12px; font-weight: 800; text-decoration: none; }
        .notes-section, .sources-section { display: grid; grid-template-columns: .8fr 1.2fr; gap: 80px; }
        .notes-rules { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
        .notes-rules li { display: grid; grid-template-columns: 46px 1fr; gap: 15px; padding: 21px; border-radius: 18px; }
        .notes-rules li > span { width: 32px; height: 32px; display: grid; place-items: center; color: #102019; background: var(--green); border-radius: 50%; font-size: 12px; font-weight: 900; }
        .notes-rules strong { display: block; margin-bottom: 6px; color: white; }
        .governance-heading { display: flex; align-items: flex-start; gap: 18px; }
        .governance-heading > svg { flex: 0 0 auto; margin-top: 36px; color: var(--green); }
        .governance-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 50px; }
        .governance-grid article { min-height: 245px; padding: 28px; border-radius: 22px; }
        .governance-grid svg { color: var(--green); }
        .governance-grid h3 { margin: 22px 0 10px; color: white; font-size: 20px; }
        .legal-callout { display: flex; gap: 13px; margin-top: 24px; padding: 20px 22px; color: white; background: rgba(255,178,93,.12); border-color: rgba(255,178,93,.28); border-radius: 18px; }
        .legal-callout svg { flex: 0 0 auto; margin-top: 2px; color: var(--orange); }
        .legal-callout p { margin: 0; color: rgba(255,255,255,.7); font-size: 13px; line-height: 1.6; }
        .source-links { display: grid; gap: 12px; }
        .source-links a { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 18px; color: rgba(255,255,255,.76); padding: 0 18px; border-radius: 16px; font-size: 14px; font-weight: 800; text-decoration: none; transition: transform .2s, border-color .2s; }
        .source-links a:hover { transform: translateY(-2px); border-color: rgba(190,242,100,.26); color: white; }
        .source-links svg { flex: 0 0 auto; color: var(--green); }
        .closing-section { display: flex; flex-direction: column; align-items: center; margin: 0 7vw 90px; padding: 82px 7vw; text-align: center; color: white; border-radius: 28px; background: radial-gradient(ellipse at 50% 0%, rgba(190,242,100,.13), transparent 60%), rgba(255,255,255,.028); }
        .closing-section > svg { color: var(--green); }
        .closing-section h2 { max-width: 800px; margin: 20px 0 10px; color: white; font-size: clamp(36px, 4.4vw, 58px); line-height: 1.07; letter-spacing: -.035em; }
        .closing-section p { max-width: 700px; margin: 0; color: rgba(255,255,255,.65); font-size: 16px; line-height: 1.6; }
        .closing-section .button { margin-top: 26px; }
        .page-footer { min-height: 84px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 24px; padding: 0 48px; color: rgba(255,255,255,.42); background: rgba(0,0,0,.3); border-top: 1px solid rgba(255,255,255,.08); font-size: 12px; }
        .page-footer > a:not(.brand) { color: rgba(255,255,255,.62); text-decoration: none; }
        .page-footer > span { justify-self: end; }
        @media (max-width: 980px) {
          .site-header { grid-template-columns: 1fr auto; padding: 0 28px; }
          .site-header nav { display: none; }
          .hero { grid-template-columns: 1fr; padding-right: 7vw; padding-left: 7vw; }
          .hero-content { width: 100%; }
          .hero-orb-stage { width: min(340px, 88vw); margin: -24px auto 0; }
          .section-heading, .loop-heading, .loop-example, .notes-section, .sources-section { grid-template-columns: 1fr; }
          .section-heading .eyebrow { margin-bottom: -12px; }
          .lane { grid-template-columns: 38px 46px 1fr; }
          .lane-limit { grid-column: 3; }
          .loop-track { grid-template-columns: repeat(3, 1fr); }
          .loop-track article:nth-child(3) { border-right: 0; }
          .loop-track article:nth-child(-n+3) { border-bottom: 1px solid #bdc9c2; }
          .rubric-grid { grid-template-columns: 1fr; }
          .evidence-header, .evidence-table article { grid-template-columns: .7fr 1fr 1fr; }
          .governance-grid { grid-template-columns: 1fr; }
          .governance-grid article { min-height: 0; }
        }
        @media (max-width: 680px) {
          .site-header { min-height: 68px; padding: 0 18px; }
          .brand span { display: none; }
          .header-link { font-size: 12px; }
          .hero { min-height: 100svh; align-items: flex-start; padding: 108px 20px 120px; }
          .hero h1 { font-size: 46px; }
          .hero-content > p:not(.eyebrow) { font-size: 17px; }
          .hero-orb-stage { display: none; }
          .hero-rule { right: 20px; left: 20px; min-height: 78px; padding: 14px 16px; }
          .hero-rule strong { font-size: 13px; }
          .boundary-band, .loop-section, .rubric-section, .evidence-section, .notes-section, .governance-section, .sources-section, .lanes-section { padding: 64px 20px; }
          .section-heading h2, .loop-heading h2, .rubric-intro h2, .notes-copy h2, .governance-heading h2, .sources-section h2 { font-size: 36px; }
          .boundary-columns { grid-template-columns: 1fr; }
          .boundary-columns article { padding: 26px 22px; }
          .lane { grid-template-columns: 34px 42px 1fr; gap: 12px; padding: 20px 16px; }
          .lane-icon { width: 40px; height: 40px; }
          .lane-copy h3 { font-size: 18px; }
          .lane-copy span, .lane-limit { font-size: 13px; }
          .loop-track { grid-template-columns: 1fr; }
          .loop-track article { border-right: 0; border-bottom: 1px solid rgba(255,255,255,.08); }
          .loop-track article:last-child { border-bottom: 0; }
          .loop-example { gap: 48px; }
          .phone-visual { width: 270px; border-width: 6px; border-radius: 34px; }
          .example-copy h3 { font-size: 28px; }
          .rubric-intro { grid-template-columns: 1fr; }
          .score-display { padding: 20px; border-left: 1px solid rgba(255,255,255,.075); }
          .rubric-grid article { grid-template-columns: 34px 1fr 20px; padding: 20px 16px; }
          .runtime-flow { grid-template-columns: auto 1fr; }
          .runtime-flow > svg:nth-of-type(2) { display: none; }
          .evidence-header { display: none; }
          .evidence-table article { grid-template-columns: 1fr; }
          .evidence-table article > * { border-right: 0; border-bottom: 1px solid rgba(255,255,255,.1); }
          .evidence-table article > *:last-child { border-bottom: 0; }
          .notes-section { gap: 38px; }
          .governance-heading { display: block; }
          .governance-heading > svg { margin: 0 0 16px; }
          .sources-section { gap: 35px; }
          .page-footer { min-height: 116px; grid-template-columns: 1fr; gap: 10px; padding: 24px 20px; text-align: center; }
          .page-footer .brand, .page-footer > span { justify-self: center; }
          .page-footer .brand span { display: inline; }
        }
      `}</style>
    </main>
  </>
);

export default NoraEngagementModelPage;
