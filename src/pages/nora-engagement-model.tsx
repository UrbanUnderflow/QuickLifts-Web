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
        <div className="hero-shade" />
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
          --ink: #101513;
          --paper: #f3f5f0;
          --white: #ffffff;
          --green: #d8ff24;
          --mint: #50d3a2;
          --blue: #6ab6ff;
          --orange: #ffb25d;
          --red: #ff6b66;
          min-height: 100vh;
          color: var(--ink);
          background: var(--paper);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        * { box-sizing: border-box; }
        .site-header {
          min-height: 76px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 24px;
          padding: 0 48px;
          color: white;
          background: #080b0a;
          border-bottom: 1px solid rgba(255,255,255,.1);
        }
        .brand { display: inline-flex; align-items: center; gap: 11px; color: inherit; font-weight: 800; text-decoration: none; }
        .brand img { width: 29px; height: 29px; object-fit: contain; }
        nav { display: flex; align-items: center; gap: 25px; }
        nav a, .header-link { color: rgba(255,255,255,.72); font-size: 13px; font-weight: 750; text-decoration: none; }
        nav a:hover, .header-link:hover { color: white; }
        .header-link { justify-self: end; display: inline-flex; align-items: center; gap: 7px; }
        .hero {
          position: relative;
          min-height: min(680px, calc(100svh - 128px));
          display: flex;
          align-items: center;
          padding: 74px 7vw 112px;
          overflow: hidden;
          color: white;
          background: url('/pulsecheck-pro/hero-athletes.webp') center 42% / cover no-repeat;
        }
        .hero-shade { position: absolute; inset: 0; background: rgba(2, 7, 5, .62); }
        .hero-content { position: relative; z-index: 1; width: min(820px, 82%); }
        .eyebrow { margin: 0 0 14px; color: var(--green); font-size: 12px; font-weight: 900; text-transform: uppercase; }
        .eyebrow.ink { color: #397261; }
        h1, h2, h3, p { letter-spacing: 0; }
        .hero h1 { max-width: 800px; margin: 0; font-size: clamp(48px, 6vw, 78px); line-height: 1.02; font-weight: 780; }
        .hero-content > p:not(.eyebrow) { max-width: 710px; margin: 22px 0 0; color: rgba(255,255,255,.88); font-size: 21px; line-height: 1.55; }
        .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
        .button { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; border: 1px solid transparent; border-radius: 4px; font-size: 14px; font-weight: 900; text-decoration: none; }
        .button.primary { color: #0a0d0c; background: var(--green); }
        .button.secondary { color: white; background: rgba(10, 14, 13, .68); border-color: rgba(255,255,255,.35); }
        .hero-rule { position: absolute; z-index: 1; right: 7vw; bottom: 0; left: 7vw; min-height: 86px; display: flex; align-items: center; gap: 15px; padding: 17px 23px; color: white; background: rgba(10, 15, 13, .92); border: 1px solid rgba(255,255,255,.18); border-bottom: 0; border-radius: 8px 8px 0 0; }
        .hero-rule svg { flex: 0 0 auto; color: var(--green); }
        .hero-rule span, .hero-rule strong { display: block; }
        .hero-rule span { margin-bottom: 4px; color: rgba(255,255,255,.55); font-size: 11px; font-weight: 900; text-transform: uppercase; }
        .hero-rule strong { font-size: 15px; line-height: 1.4; }
        .boundary-band, .loop-section, .rubric-section, .evidence-section, .notes-section, .governance-section, .sources-section { padding: 88px 7vw; }
        .section-heading { display: grid; grid-template-columns: .9fr 1.1fr; gap: 35px 80px; align-items: end; }
        .section-heading .eyebrow { grid-column: 1 / -1; margin-bottom: -18px; }
        .section-heading h2, .loop-heading h2, .rubric-intro h2, .notes-copy h2, .governance-heading h2, .sources-section h2 { margin: 0; font-size: clamp(36px, 4.2vw, 56px); line-height: 1.07; }
        .section-heading > p:not(.eyebrow), .loop-heading > p { margin: 0; color: #56615d; font-size: 17px; line-height: 1.65; }
        .boundary-band { background: #f4f6f1; }
        .boundary-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin-top: 52px; background: #cfd6d1; border: 1px solid #cfd6d1; }
        .boundary-columns article { padding: 34px; background: white; }
        .boundary-columns article > svg { color: #2f7963; }
        .boundary-columns h3 { margin: 16px 0 20px; font-size: 24px; }
        .boundary-columns ul, .example-copy ul { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
        .boundary-columns li, .example-copy li { display: flex; align-items: flex-start; gap: 10px; color: #45504c; font-size: 15px; line-height: 1.55; }
        .boundary-columns li svg { flex: 0 0 auto; margin-top: 3px; color: #2f8c6d; }
        .boundary-columns .stop-list > svg { color: #b34e4b; }
        .stop-list li span { color: #c44842; font-size: 20px; line-height: 1; }
        .boundary-note { margin: 22px 0 0; padding-left: 18px; color: #5b6561; border-left: 3px solid #81a69a; font-size: 14px; line-height: 1.6; }
        .lanes-section { padding: 88px 7vw; color: white; background: #0c1110; }
        .section-heading.light > p:not(.eyebrow) { color: rgba(255,255,255,.62); }
        .lane-list { margin-top: 52px; border-top: 1px solid rgba(255,255,255,.16); }
        .lane { display: grid; grid-template-columns: 46px 52px minmax(230px, .9fr) minmax(280px, 1.1fr); align-items: center; gap: 18px; min-height: 145px; padding: 25px 0; border-bottom: 1px solid rgba(255,255,255,.16); }
        .lane-number { color: rgba(255,255,255,.34); font-size: 13px; font-weight: 900; }
        .lane-icon { width: 46px; height: 46px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 50%; }
        .lane.green .lane-icon, .lane.green .lane-copy p { color: var(--mint); }
        .lane.blue .lane-icon, .lane.blue .lane-copy p { color: var(--blue); }
        .lane.orange .lane-icon, .lane.orange .lane-copy p { color: var(--orange); }
        .lane.red .lane-icon, .lane.red .lane-copy p { color: var(--red); }
        .lane.gray .lane-icon, .lane.gray .lane-copy p { color: #d4d9d7; }
        .lane-copy p { margin: 0 0 5px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
        .lane-copy h3 { margin: 0 0 8px; font-size: 22px; }
        .lane-copy span { color: rgba(255,255,255,.64); font-size: 14px; line-height: 1.55; }
        .lane-limit { display: flex; align-items: flex-start; gap: 10px; color: rgba(255,255,255,.78); font-size: 14px; line-height: 1.55; }
        .lane-limit svg { flex: 0 0 auto; margin-top: 2px; color: var(--green); }
        .loop-section { background: #e9eee8; }
        .loop-heading { display: grid; grid-template-columns: 1fr .8fr; gap: 70px; align-items: end; }
        .loop-track { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); margin-top: 52px; border: 1px solid #bdc9c2; }
        .loop-track article { min-width: 0; padding: 22px 18px 25px; border-right: 1px solid #bdc9c2; }
        .loop-track article:last-child { border-right: 0; }
        .loop-track article > div { display: flex; align-items: center; justify-content: space-between; color: #5c6b65; }
        .loop-track article > div span { width: 30px; height: 30px; display: grid; place-items: center; color: #16211d; background: var(--green); border-radius: 50%; font-size: 12px; font-weight: 900; }
        .loop-track h3 { margin: 24px 0 8px; font-size: 18px; }
        .loop-track p { margin: 0; color: #5a6561; font-size: 13px; line-height: 1.55; }
        .loop-example { display: grid; grid-template-columns: .7fr 1.3fr; gap: 70px; align-items: center; margin-top: 76px; }
        .phone-visual { width: min(330px, 100%); aspect-ratio: .462; justify-self: center; overflow: hidden; background: #050706; border: 8px solid #171c1a; border-radius: 42px; box-shadow: 0 24px 50px rgba(13,22,18,.22); }
        .phone-visual img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
        .example-copy h3 { margin: 0 0 24px; font-size: 34px; line-height: 1.16; }
        .chat-line { max-width: 640px; margin: 14px 0; padding: 18px 20px; border-radius: 8px; font-size: 15px; line-height: 1.55; }
        .chat-line.athlete { margin-left: auto; color: white; background: #20371c; border: 1px solid #779420; }
        .chat-line.nora { color: white; background: #171c1a; }
        .example-copy ul { margin-top: 24px; }
        .example-copy li svg { flex: 0 0 auto; margin-top: 3px; color: #2f8c6d; }
        .rubric-section { background: white; }
        .rubric-intro { display: grid; grid-template-columns: 1fr auto; gap: 50px; align-items: end; }
        .score-display { min-width: 190px; padding-left: 28px; border-left: 1px solid #cbd3ce; }
        .score-display strong { display: block; font-size: 60px; line-height: 1; }
        .score-display strong span { color: #718079; font-size: 25px; }
        .score-display p { margin: 9px 0 0; color: #66716c; font-size: 13px; }
        .rubric-grid { display: grid; grid-template-columns: 1fr 1fr; margin-top: 52px; border-top: 1px solid #ced5d1; border-left: 1px solid #ced5d1; }
        .rubric-grid article { min-height: 120px; display: grid; grid-template-columns: 42px 1fr 22px; gap: 16px; align-items: start; padding: 24px; border-right: 1px solid #ced5d1; border-bottom: 1px solid #ced5d1; }
        .rubric-grid article > span { color: #718079; font-size: 12px; font-weight: 900; }
        .rubric-grid h3 { margin: 0 0 7px; font-size: 18px; }
        .rubric-grid p { margin: 0; color: #5c6762; font-size: 14px; line-height: 1.55; }
        .rubric-grid svg { color: #2c8b69; }
        .runtime-flow { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 18px; align-items: center; margin-top: 28px; padding: 22px 24px; color: white; background: #121817; border-radius: 8px; }
        .runtime-flow > svg:first-child { color: var(--green); }
        .runtime-flow p { margin: 0; color: rgba(255,255,255,.7); font-size: 14px; line-height: 1.5; }
        .runtime-flow strong { color: white; }
        .evidence-section { color: white; background: #101817; }
        .evidence-table { margin-top: 52px; border: 1px solid rgba(255,255,255,.17); }
        .evidence-header, .evidence-table article { display: grid; grid-template-columns: .7fr 1fr 1.2fr; }
        .evidence-header { min-height: 48px; align-items: center; color: rgba(255,255,255,.42); border-bottom: 1px solid rgba(255,255,255,.17); font-size: 11px; font-weight: 900; text-transform: uppercase; }
        .evidence-header span, .evidence-table article > * { padding: 18px 20px; }
        .evidence-table article { min-height: 148px; border-bottom: 1px solid rgba(255,255,255,.14); }
        .evidence-table article:last-child { border-bottom: 0; }
        .evidence-table article > * { margin: 0; border-right: 1px solid rgba(255,255,255,.14); }
        .evidence-table article > *:last-child { border-right: 0; }
        .evidence-table article > div:first-child { display: flex; align-items: flex-start; gap: 12px; }
        .evidence-table article > div:first-child svg { flex: 0 0 auto; color: var(--green); }
        .evidence-table p { color: rgba(255,255,255,.67); font-size: 14px; line-height: 1.6; }
        .limit-cell a { display: inline-flex; align-items: center; gap: 6px; margin-top: 13px; color: var(--green); font-size: 12px; font-weight: 800; text-decoration: none; }
        .notes-section { display: grid; grid-template-columns: .8fr 1.2fr; gap: 80px; background: #eef0ea; }
        .notes-copy > p:not(.eyebrow) { color: #5b6661; font-size: 17px; line-height: 1.65; }
        .notes-rules { display: grid; margin: 0; padding: 0; border-top: 1px solid #bec7c1; list-style: none; }
        .notes-rules li { display: grid; grid-template-columns: 46px 1fr; gap: 15px; padding: 21px 0; border-bottom: 1px solid #bec7c1; }
        .notes-rules li > span { width: 32px; height: 32px; display: grid; place-items: center; color: #102019; background: var(--green); border-radius: 50%; font-size: 12px; font-weight: 900; }
        .notes-rules strong { display: block; margin-bottom: 6px; }
        .notes-rules p { margin: 0; color: #5f6a65; font-size: 14px; line-height: 1.55; }
        .governance-section { color: white; background: #1a211f; }
        .governance-heading { display: flex; align-items: flex-start; gap: 18px; }
        .governance-heading > svg { flex: 0 0 auto; margin-top: 36px; color: var(--green); }
        .governance-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 50px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.16); }
        .governance-grid article { min-height: 245px; padding: 28px; background: #151b19; }
        .governance-grid svg { color: var(--green); }
        .governance-grid h3 { margin: 22px 0 10px; font-size: 20px; }
        .governance-grid p { margin: 0; color: rgba(255,255,255,.63); font-size: 14px; line-height: 1.65; }
        .legal-callout { display: flex; gap: 13px; margin-top: 24px; padding: 20px 22px; color: #1d2924; background: var(--orange); border-radius: 8px; }
        .legal-callout svg { flex: 0 0 auto; margin-top: 2px; }
        .legal-callout p { margin: 0; font-size: 13px; line-height: 1.6; }
        .sources-section { display: grid; grid-template-columns: .8fr 1.2fr; gap: 70px; background: #f7f8f5; }
        .source-links { display: grid; border-top: 1px solid #c9d0cc; }
        .source-links a { min-height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 18px; color: #21302a; border-bottom: 1px solid #c9d0cc; font-size: 14px; font-weight: 800; text-decoration: none; }
        .source-links svg { flex: 0 0 auto; color: #487363; }
        .closing-section { display: flex; flex-direction: column; align-items: center; padding: 82px 7vw; text-align: center; color: white; background: #0a0e0d; }
        .closing-section > svg { color: var(--green); }
        .closing-section h2 { max-width: 800px; margin: 20px 0 10px; font-size: clamp(36px, 4.4vw, 58px); line-height: 1.07; }
        .closing-section p { max-width: 700px; margin: 0; color: rgba(255,255,255,.65); font-size: 16px; line-height: 1.6; }
        .closing-section .button { margin-top: 26px; }
        .page-footer { min-height: 84px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 24px; padding: 0 48px; color: rgba(255,255,255,.55); background: #070908; border-top: 1px solid rgba(255,255,255,.1); font-size: 12px; }
        .page-footer > a:not(.brand) { color: rgba(255,255,255,.7); text-decoration: none; }
        .page-footer > span { justify-self: end; }
        @media (max-width: 980px) {
          .site-header { grid-template-columns: 1fr auto; padding: 0 28px; }
          .site-header nav { display: none; }
          .hero { padding-right: 7vw; padding-left: 7vw; }
          .hero-content { width: 100%; }
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
          .hero { min-height: calc(100svh - 112px); align-items: flex-start; padding: 68px 20px 108px; background-position: 58% center; }
          .hero h1 { font-size: 46px; }
          .hero-content > p:not(.eyebrow) { font-size: 17px; }
          .hero-rule { right: 20px; left: 20px; min-height: 78px; padding: 14px 16px; }
          .hero-rule strong { font-size: 13px; }
          .boundary-band, .loop-section, .rubric-section, .evidence-section, .notes-section, .governance-section, .sources-section, .lanes-section { padding: 64px 20px; }
          .section-heading h2, .loop-heading h2, .rubric-intro h2, .notes-copy h2, .governance-heading h2, .sources-section h2 { font-size: 36px; }
          .boundary-columns { grid-template-columns: 1fr; }
          .boundary-columns article { padding: 26px 22px; }
          .lane { grid-template-columns: 34px 42px 1fr; gap: 12px; padding: 23px 0; }
          .lane-icon { width: 40px; height: 40px; }
          .lane-copy h3 { font-size: 18px; }
          .lane-copy span, .lane-limit { font-size: 13px; }
          .loop-track { grid-template-columns: 1fr; }
          .loop-track article { border-right: 0; border-bottom: 1px solid #bdc9c2; }
          .loop-track article:last-child { border-bottom: 0; }
          .loop-example { gap: 48px; }
          .phone-visual { width: 270px; border-width: 6px; border-radius: 34px; }
          .example-copy h3 { font-size: 28px; }
          .rubric-intro { grid-template-columns: 1fr; }
          .score-display { padding: 20px 0 0; border-top: 1px solid #cbd3ce; border-left: 0; }
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
