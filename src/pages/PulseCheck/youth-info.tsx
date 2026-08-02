import React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, HeartPulse, LockKeyhole, Watch } from 'lucide-react';
import PageHead from '../../components/PageHead';

const pageMeta = {
  pageId: 'pulsecheck-youth-info',
  pageTitle: 'PulseCheck Youth | Mental Skills for the Moments That Matter',
  metaDescription:
    'PulseCheck gives young athletes a private daily check-in, wearable context, and short mental skills they can practice before the pressure arrives.',
  ogTitle: 'PulseCheck Youth | Train the Mind for the Game',
  ogDescription:
    'A daily mental performance system built for young athletes, with 200+ skills, wearable context, and human support when a pattern needs attention.',
  ogImage: '/pulsecheck-youth/youth-info-og.png',
  twitterCard: 'summary_large_image',
  lastUpdated: '2026-08-01T00:00:00.000Z',
};

const processSteps = [
  {
    number: '01',
    label: 'CHECK IN',
    title: 'Name how today feels.',
    body: 'Drained, off, okay, good, or locked in. The athlete starts with what feels true.',
  },
  {
    number: '02',
    label: 'ADD CONTEXT',
    title: 'See what the body is saying.',
    body: 'Sleep, heart rate, recovery, and training load add context from a connected wearable.',
  },
  {
    number: '03',
    label: 'TRAIN TODAY',
    title: 'Practice the right skill.',
    body: 'Nora chooses a short plan for the athlete\'s energy, pressure, focus, and schedule.',
  },
];

const skillNames = [
  'Mistake recovery',
  'Focus',
  'Confidence',
  'Pressure',
  'Self-talk',
  'Visualization',
  'Breathing',
  'Game routines',
];

const PulseCheckYouthInfoPage: React.FC = () => {
  return (
    <main className="youth-info">
      <PageHead
        metaData={pageMeta}
        pageOgUrl="https://fitwithpulse.ai/PulseCheck/youth-info"
        pageOgImage="/pulsecheck-youth/youth-info-og.png"
        themeColor="#101015"
        appleItunesAppArgument="pulsecheck://youth"
      />
      <header className="yi-nav">
        <Link href="/PulseCheck/youth" className="yi-brand" aria-label="PulseCheck Youth home">
          <img src="/pulsecheck-youth/pulsecheck-wordmark.png" alt="PulseCheck" />
        </Link>
        <span className="yi-nav-label">YOUTH / MENTAL PERFORMANCE</span>
        <a className="yi-nav-link" href="#how-it-works">
          See how it works <ArrowDown size={15} />
        </a>
      </header>

      <section className="yi-hero">
        <img
          className="yi-hero-image"
          src="/pulsecheck-youth/next-play.webp"
          alt="A young athlete focused on the field before the next play"
        />
        <div className="yi-hero-shade" aria-hidden="true" />
        <div className="yi-grain" aria-hidden="true" />
        <div className="yi-hero-copy">
          <p className="yi-kicker yi-kicker--light">A DAILY MENTAL PERFORMANCE SYSTEM</p>
          <h1>
            LEARN IT.<br />
            PRACTICE IT.<br />
            <span>USE IT IN<br className="yi-mobile-break" /> THE GAME.</span>
          </h1>
          <p className="yi-hero-deck">
            Short mental skills for mistakes, pressure, focus, and confidence.
          </p>
          <a className="yi-button yi-button--light" href="#dashboard">
            See the athlete experience <ArrowRight size={17} />
          </a>
        </div>
        <div className="yi-hero-caption" aria-hidden="true">
          <span>THE NEXT PLAY</span>
          <span>STARTS BEFORE THE WHISTLE.</span>
        </div>
      </section>

      <section className="yi-system" id="dashboard">
        <div className="yi-system-copy">
          <p className="yi-kicker">PULSECHECK / YOUTH</p>
          <h2>
            <span className="yi-number">200+</span>
            MENTAL SKILLS.<br />
            ONE CLEAR PLAN.
          </h2>
          <p className="yi-intro">
            Every day begins with a simple question: how do you feel? PulseCheck uses that answer,
            body signals, and the athlete&apos;s schedule to choose a short practice for today.
          </p>
          <div className="yi-skill-list" aria-label="Examples from the mental skills library">
            {skillNames.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </div>

        <figure className="yi-phone-figure">
          <div className="yi-phone-halo" aria-hidden="true" />
          <img
            src="/pulsecheck-youth/youth-dashboard.png"
            alt="PulseCheck youth dashboard showing a daily check-in and today's mental skill"
          />
          <figcaption>PULSECHECK / DASHBOARD</figcaption>
        </figure>
      </section>

      <section className="yi-process" id="how-it-works">
        <div className="yi-section-heading">
          <p className="yi-kicker">FEELING. BODY. SKILL.</p>
          <h2>ONE CHECK-IN.<br />A BETTER PLAN FOR TODAY.</h2>
        </div>
        <div className="yi-process-grid">
          {processSteps.map((step) => (
            <article className="yi-process-card" key={step.number}>
              <div className="yi-process-index">
                <span>{step.number}</span>
                <small>{step.label}</small>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="yi-wearables">
        <div className="yi-wearables-photo">
          <img
            src="/pulsecheck-youth/hero-team.webp"
            alt="Three young athletes preparing together before competition"
          />
          <div aria-hidden="true" />
        </div>
        <div className="yi-wearables-copy">
          <Watch size={34} strokeWidth={1.6} aria-hidden="true" />
          <p className="yi-kicker">WEARABLE CONTEXT</p>
          <h2>HOW YOU FEEL,<br /><em>WITH CONTEXT.</em></h2>
          <p>
            The athlete&apos;s check-in leads. Wearable signals add another clue. Together they help
            Nora understand whether today calls for recovery, focus, confidence, or a harder challenge.
          </p>
          <dl>
            <div><dt>ATHLETE</dt><dd>Mood · stress · energy · confidence</dd></div>
            <div><dt>BODY</dt><dd>Sleep · heart rate · recovery · training load</dd></div>
            <div><dt>TODAY</dt><dd>One clear mental skills plan</dd></div>
          </dl>
        </div>
      </section>

      <section className="yi-privacy">
        <div className="yi-privacy-mark"><LockKeyhole size={34} strokeWidth={1.45} /></div>
        <p className="yi-kicker">PRIVATE BY DESIGN</p>
        <h2>HONESTY NEEDS<br />A SAFE PLACE.</h2>
        <p className="yi-privacy-copy">
          Nora protects the athlete&apos;s private words. Coaches see broad patterns and clear ways to help.
        </p>
        <div className="yi-privacy-rule" aria-hidden="true"><span>ATHLETE TRUST</span><i /><span>USEFUL SUPPORT</span></div>
      </section>

      <section className="yi-research">
        <div className="yi-research-story">
          <p className="yi-kicker">THE SURPRISING RESEARCH</p>
          <h2>MENTAL PRACTICE<br />MADE THE MUSCLE<br /><em>STRONGER.</em></h2>
          <p className="yi-research-explainer">
            One small 12-week study asked people to imagine moving a finger with full effort. Their
            finger strength increased 35%, compared with 53% in the physical-training group.
          </p>
          <a
            className="yi-text-link"
            href="https://doi.org/10.1016/j.neuropsychologia.2003.11.018"
            target="_blank"
            rel="noreferrer"
          >
            Read the study <ArrowRight size={16} />
          </a>
        </div>
        <div className="yi-research-stat">
          <strong>66%</strong>
          <p>OF THE STRENGTH GAIN ACHIEVED BY THE PHYSICAL-TRAINING GROUP</p>
          <span>RANGANATHAN ET AL. / NEUROPSYCHOLOGIA / 2004</span>
        </div>
      </section>

      <section className="yi-support">
        <img
          className="yi-support-image"
          src="/pulsecheck-youth/support-team.webp"
          alt="A young athlete speaking with trusted adults in a gym"
        />
        <div className="yi-support-overlay" aria-hidden="true" />
        <div className="yi-support-content">
          <div className="yi-auntedna">
            <img src="/auntedna-mark.png" alt="AuntEdna" />
            <span>AUNTEDNA / CLINICAL SUPPORT</span>
          </div>
          <h2>WHEN THE PATTERN<br />NEEDS A PERSON.</h2>
          <p>
            When difficult check-ins or poor sleep keep showing up, AuntEdna helps a qualified
            clinician review what is happening and connect the athlete to care.
          </p>
          <div className="yi-support-path" aria-label="Support path">
            <span><b>01</b>Pattern</span>
            <i />
            <span><b>02</b>Review</span>
            <i />
            <span><b>03</b>Care</span>
          </div>
        </div>
      </section>

      <section className="yi-close">
        <HeartPulse size={34} strokeWidth={1.5} aria-hidden="true" />
        <p className="yi-kicker">BUILT FOR THE WHOLE ATHLETE</p>
        <h2>TRAIN THE MIND<br />LIKE THE BODY.</h2>
        <p>Give young athletes a skill they can practice today and use when the next moment arrives.</p>
        <a
          className="yi-button yi-button--dark"
          href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Youth"
        >
          Start a conversation <ArrowRight size={17} />
        </a>
      </section>

      <footer className="yi-footer">
        <img src="/pulsecheck-youth/pulsecheck-wordmark.png" alt="PulseCheck" />
        <div>
          <Link href="/PulseCheck/privacy">Privacy</Link>
          <Link href="/PulseCheck/terms">Terms</Link>
          <span>© {new Date().getFullYear()} Pulse Intelligence Labs</span>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,600&display=swap');

        :root {
          --yi-ink: #101015;
          --yi-paper: #f0ede4;
          --yi-lavender: #dcd3f5;
          --yi-purple: #6f55ee;
          --yi-muted: #6c6963;
          --yi-line: rgba(16, 16, 21, 0.22);
        }

        html { scroll-behavior: smooth; }
        body { margin: 0; background: var(--yi-paper); }
        .youth-info, .youth-info * { box-sizing: border-box; }
        .youth-info {
          min-height: 100vh;
          overflow: hidden;
          color: var(--yi-ink);
          background: var(--yi-paper);
          font-family: 'DM Sans', Arial, sans-serif;
        }
        .youth-info a { color: inherit; }
        .youth-info img { display: block; max-width: 100%; }

        .yi-nav {
          position: absolute;
          z-index: 20;
          top: 0;
          left: 0;
          right: 0;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 21px;
          min-height: 89px;
          padding: 21px clamp(21px, 5vw, 89px);
          color: #fff;
          border-bottom: 1px solid rgba(255,255,255,.35);
        }
        .yi-brand { width: clamp(172px, 16vw, 242px); }
        .yi-brand img { width: 100%; filter: brightness(0) invert(1); }
        .yi-nav-label, .yi-nav-link {
          font: 600 11px/1 'DM Sans', sans-serif;
          letter-spacing: .15em;
        }
        .yi-nav-link { justify-self: end; display: flex; align-items: center; gap: 8px; text-decoration: none; }

        .yi-hero {
          position: relative;
          min-height: clamp(760px, 100svh, 980px);
          display: flex;
          align-items: flex-end;
          color: #fff;
          background: #111;
        }
        .yi-hero-image, .yi-hero-shade, .yi-grain { position: absolute; inset: 0; width: 100%; height: 100%; }
        .yi-hero-image { object-fit: cover; object-position: 52% 50%; filter: saturate(.55) sepia(.12) contrast(1.05); }
        .yi-hero-shade {
          background:
            linear-gradient(90deg, rgba(7,7,10,.88) 0%, rgba(7,7,10,.55) 43%, rgba(7,7,10,.05) 74%),
            linear-gradient(0deg, rgba(7,7,10,.78) 0%, transparent 47%);
        }
        .yi-grain {
          opacity: .19;
          pointer-events: none;
          mix-blend-mode: soft-light;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(255,255,255,.7) 0 .6px, transparent .8px),
            radial-gradient(circle at 70% 60%, rgba(255,255,255,.5) 0 .5px, transparent .8px);
          background-position: 0 0, 7px 9px;
          background-size: 13px 13px, 17px 17px;
        }
        .yi-hero-copy {
          position: relative;
          z-index: 2;
          width: min(780px, calc(100% - 42px));
          margin-left: clamp(21px, 7vw, 110px);
          padding: 144px 0 clamp(89px, 10vh, 144px);
        }
        .yi-kicker {
          margin: 0 0 21px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .18em;
        }
        .yi-kicker--light { color: rgba(255,255,255,.78); }
        .yi-hero h1, .yi-system h2, .yi-section-heading h2, .yi-wearables h2,
        .yi-privacy h2, .yi-research h2, .yi-support h2, .yi-close h2 {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-weight: 400;
          letter-spacing: -.025em;
          text-wrap: balance;
        }
        .yi-hero h1 {
          max-width: 760px;
          margin: 0;
          font-size: clamp(82px, 9.4vw, 154px);
          line-height: .79;
        }
        .yi-hero h1 span { color: #fff; }
        .yi-mobile-break { display: none; }
        .yi-hero-deck {
          max-width: 510px;
          margin: 34px 0;
          font-size: clamp(17px, 1.4vw, 21px);
          line-height: 1.5;
        }
        .yi-button {
          width: fit-content;
          min-height: 55px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          padding: 0 25px;
          border: 1px solid currentColor;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          transition: background .2s ease, color .2s ease, transform .2s ease;
        }
        .yi-button:hover { transform: translateY(-2px); }
        .yi-button--light:hover { color: var(--yi-ink); background: #fff; }
        .yi-hero-caption {
          position: absolute;
          z-index: 2;
          right: clamp(21px, 5vw, 89px);
          bottom: 34px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .18em;
        }

        .yi-system {
          min-height: 980px;
          display: grid;
          grid-template-columns: minmax(0, 1.03fr) minmax(380px, .97fr);
          align-items: center;
          gap: clamp(55px, 8vw, 144px);
          padding: 144px clamp(34px, 7vw, 110px);
          background: var(--yi-paper);
        }
        .yi-system-copy { max-width: 690px; }
        .yi-system h2 { margin: 0 0 34px; font-size: clamp(62px, 7vw, 112px); line-height: .88; }
        .yi-number { display: block; margin-bottom: 13px; color: var(--yi-purple); font-size: 1.22em; }
        .yi-intro { max-width: 620px; margin: 0; color: #47453f; font-size: clamp(17px, 1.5vw, 21px); line-height: 1.65; }
        .yi-skill-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 34px; }
        .yi-skill-list span {
          padding: 9px 13px;
          border: 1px solid var(--yi-line);
          border-radius: 99px;
          font-size: 12px;
          font-weight: 600;
        }
        .yi-phone-figure { position: relative; width: min(100%, 460px); justify-self: center; margin: 0; }
        .yi-phone-figure > img {
          position: relative;
          z-index: 2;
          width: 100%;
          filter: drop-shadow(0 42px 48px rgba(35,26,69,.25));
        }
        .yi-phone-halo {
          position: absolute;
          z-index: 1;
          width: 115%;
          aspect-ratio: 1;
          left: -7.5%;
          top: 19%;
          border-radius: 50%;
          background: #d9cff7;
        }
        .yi-phone-figure figcaption { position: relative; z-index: 3; margin-top: 21px; text-align: center; font-size: 10px; font-weight: 700; letter-spacing: .18em; }

        .yi-process { padding: 144px clamp(34px, 7vw, 110px); color: #fff; background: var(--yi-ink); }
        .yi-section-heading { display: grid; grid-template-columns: .45fr 1fr; gap: 55px; align-items: end; margin-bottom: 89px; }
        .yi-section-heading h2 { max-width: 850px; margin: 0; font-size: clamp(64px, 7.2vw, 118px); line-height: .88; }
        .yi-process-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid rgba(255,255,255,.28); }
        .yi-process-card { min-height: 360px; padding: 34px; border-right: 1px solid rgba(255,255,255,.28); }
        .yi-process-card:first-child { border-left: 1px solid rgba(255,255,255,.28); }
        .yi-process-index { display: flex; align-items: baseline; gap: 13px; margin-bottom: 89px; }
        .yi-process-index span { color: #a987ff; font: 400 55px/1 'Bebas Neue', sans-serif; }
        .yi-process-index small { font-size: 9px; font-weight: 700; letter-spacing: .18em; }
        .yi-process-card h3 { margin: 0 0 13px; font: 400 clamp(34px, 3vw, 48px)/1 'Bebas Neue', sans-serif; }
        .yi-process-card p { max-width: 340px; margin: 0; color: #aaa7a2; font-size: 15px; line-height: 1.65; }

        .yi-wearables { display: grid; grid-template-columns: 1.08fr .92fr; min-height: 820px; background: #d9d0f1; }
        .yi-wearables-photo { position: relative; min-height: 640px; overflow: hidden; }
        .yi-wearables-photo img { width: 100%; height: 100%; object-fit: cover; filter: saturate(.3) sepia(.18); }
        .yi-wearables-photo > div { position: absolute; inset: 0; background: linear-gradient(90deg, transparent 70%, rgba(217,208,241,.45)); }
        .yi-wearables-copy { align-self: center; max-width: 650px; padding: 89px clamp(34px, 7vw, 110px) 89px clamp(34px, 6vw, 89px); }
        .yi-wearables-copy > svg { margin-bottom: 34px; }
        .yi-wearables h2 { margin: 0 0 34px; font-size: clamp(64px, 6.4vw, 105px); line-height: .86; }
        .yi-wearables h2 em, .yi-research h2 em { font-family: 'Playfair Display', Georgia, serif; font-weight: 600; }
        .yi-wearables-copy > p:not(.yi-kicker) { margin: 0; color: #4d494f; font-size: 17px; line-height: 1.7; }
        .yi-wearables dl { margin: 34px 0 0; border-top: 1px solid var(--yi-line); }
        .yi-wearables dl div { display: grid; grid-template-columns: 90px 1fr; gap: 21px; padding: 17px 0; border-bottom: 1px solid var(--yi-line); }
        .yi-wearables dt { font-size: 10px; font-weight: 700; letter-spacing: .14em; }
        .yi-wearables dd { margin: 0; color: #4d494f; font-size: 13px; }

        .yi-privacy { position: relative; padding: 144px clamp(34px, 8vw, 144px); background: var(--yi-paper); }
        .yi-privacy-mark { width: 55px; height: 55px; display: grid; place-items: center; margin-bottom: 34px; border: 1px solid var(--yi-ink); border-radius: 50%; }
        .yi-privacy h2 { max-width: 1020px; margin: 0; font-size: clamp(82px, 11vw, 180px); line-height: .81; }
        .yi-privacy-copy { max-width: 630px; margin: 55px 0 0 auto; font: 600 italic clamp(22px, 2.3vw, 34px)/1.4 'Playfair Display', Georgia, serif; }
        .yi-privacy-rule { display: flex; align-items: center; gap: 21px; margin-top: 89px; font-size: 10px; font-weight: 700; letter-spacing: .16em; }
        .yi-privacy-rule i { height: 1px; flex: 1; background: var(--yi-line); }

        .yi-research { display: grid; grid-template-columns: 1.12fr .88fr; min-height: 780px; border-top: 1px solid var(--yi-line); background: var(--yi-paper); }
        .yi-research-story { padding: 110px clamp(34px, 7vw, 110px); }
        .yi-research h2 { margin: 0 0 34px; font-size: clamp(64px, 7.2vw, 116px); line-height: .86; }
        .yi-research-explainer { max-width: 640px; margin: 0 0 34px; color: #4d4943; font-size: 17px; line-height: 1.72; }
        .yi-text-link { display: inline-flex; align-items: center; gap: 8px; padding-bottom: 6px; border-bottom: 1px solid currentColor; text-decoration: none; font-size: 12px; font-weight: 700; }
        .yi-research-stat { display: flex; flex-direction: column; justify-content: center; padding: 89px; color: #fff; background: var(--yi-purple); }
        .yi-research-stat strong { font: 400 clamp(150px, 17vw, 300px)/.78 'Bebas Neue', sans-serif; letter-spacing: -.04em; }
        .yi-research-stat p { max-width: 480px; margin: 55px 0 89px; font: 400 clamp(30px, 3vw, 48px)/1 'Bebas Neue', sans-serif; }
        .yi-research-stat span { font-size: 9px; font-weight: 700; letter-spacing: .15em; }

        .yi-support { position: relative; min-height: 790px; display: flex; align-items: flex-end; color: #fff; background: #0c0c10; }
        .yi-support-image, .yi-support-overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
        .yi-support-image { object-fit: cover; object-position: center; filter: saturate(.42) contrast(1.06); }
        .yi-support-overlay { background: linear-gradient(90deg, rgba(9,9,13,.97) 0%, rgba(9,9,13,.82) 47%, rgba(9,9,13,.28) 78%), linear-gradient(0deg, rgba(9,9,13,.75), transparent 60%); }
        .yi-support-content { position: relative; z-index: 2; width: min(760px, calc(100% - 68px)); margin-left: clamp(34px, 7vw, 110px); padding: 110px 0; }
        .yi-auntedna { display: flex; align-items: center; gap: 17px; margin-bottom: 34px; color: #e890c4; font-size: 10px; font-weight: 700; letter-spacing: .16em; }
        .yi-auntedna img { width: 46px; height: 46px; object-fit: contain; border-radius: 8px; background: #f5ddeb; }
        .yi-support h2 { margin: 0 0 34px; font-size: clamp(70px, 8vw, 124px); line-height: .83; }
        .yi-support-content > p { max-width: 610px; margin: 0; color: #d1ced2; font-size: 17px; line-height: 1.7; }
        .yi-support-path { display: flex; align-items: center; max-width: 560px; margin-top: 55px; }
        .yi-support-path span { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .yi-support-path b { color: #e890c4; font-size: 9px; letter-spacing: .12em; }
        .yi-support-path i { height: 1px; flex: 1; margin: 0 13px; background: rgba(255,255,255,.32); }

        .yi-close { display: flex; flex-direction: column; align-items: center; padding: 144px 34px; text-align: center; background: var(--yi-paper); }
        .yi-close > svg { margin-bottom: 34px; }
        .yi-close h2 { margin: 0; font-size: clamp(82px, 11vw, 170px); line-height: .8; }
        .yi-close > p:not(.yi-kicker) { max-width: 620px; margin: 34px 0; color: #4d4943; font-size: 18px; line-height: 1.65; }
        .yi-button--dark { color: #fff !important; background: var(--yi-ink); border-color: var(--yi-ink); }
        .yi-button--dark:hover { color: var(--yi-ink) !important; background: transparent; }

        .yi-footer { min-height: 110px; display: flex; justify-content: space-between; align-items: center; gap: 34px; padding: 34px clamp(34px, 7vw, 110px); color: #fff; background: var(--yi-ink); }
        .yi-footer > img { width: 190px; filter: brightness(0) invert(1); }
        .yi-footer > div { display: flex; align-items: center; gap: 21px; color: #aaa7a2; font-size: 10px; }
        .yi-footer a { text-decoration: none; }

        @media (max-width: 900px) {
          .yi-nav { grid-template-columns: 1fr auto; min-height: 76px; }
          .yi-nav-label { display: none; }
          .yi-system { grid-template-columns: 1fr 320px; gap: 34px; padding-inline: 34px; }
          .yi-process-card { padding: 26px 21px; }
          .yi-wearables { grid-template-columns: 1fr; }
          .yi-wearables-photo { min-height: 560px; }
          .yi-wearables-copy { max-width: none; }
          .yi-research { grid-template-columns: 1fr; }
          .yi-research-stat { min-height: 620px; }
        }

        @media (max-width: 680px) {
          .yi-nav { padding: 17px 21px; }
          .yi-brand { width: 154px; }
          .yi-nav-link { font-size: 9px; letter-spacing: .11em; }
          .yi-hero { min-height: 820px; }
          .yi-hero-image { object-position: 57% 50%; }
          .yi-hero-shade { background: linear-gradient(0deg, rgba(7,7,10,.94) 0%, rgba(7,7,10,.55) 60%, rgba(7,7,10,.18) 100%); }
          .yi-hero-copy { width: calc(100% - 42px); margin: 0 21px; padding: 140px 0 89px; }
          .yi-hero h1 { font-size: clamp(67px, 22vw, 94px); line-height: .82; }
          .yi-mobile-break { display: block; }
          .yi-hero-deck { max-width: 320px; margin: 26px 0; font-size: 16px; }
          .yi-button { width: 100%; }
          .yi-hero-caption { display: none; }

          .yi-system { display: flex; flex-direction: column; min-height: auto; gap: 55px; padding: 89px 21px; }
          .yi-system h2 { font-size: 64px; }
          .yi-intro { font-size: 16px; }
          .yi-phone-figure { width: min(100%, 350px); }

          .yi-process { padding: 89px 21px; }
          .yi-section-heading { display: block; margin-bottom: 55px; }
          .yi-section-heading h2 { font-size: 62px; }
          .yi-process-grid { grid-template-columns: 1fr; border-top: 1px solid rgba(255,255,255,.28); }
          .yi-process-card, .yi-process-card:first-child { min-height: auto; padding: 34px 0 55px; border: 0; border-bottom: 1px solid rgba(255,255,255,.28); }
          .yi-process-index { margin-bottom: 34px; }

          .yi-wearables-photo { min-height: 420px; }
          .yi-wearables-photo img { object-position: 60% center; }
          .yi-wearables-copy { padding: 89px 21px; }
          .yi-wearables h2 { font-size: 64px; }
          .yi-wearables dl div { grid-template-columns: 75px 1fr; }

          .yi-privacy { padding: 89px 21px; }
          .yi-privacy h2 { font-size: 77px; }
          .yi-privacy-copy { margin-top: 34px; font-size: 22px; }
          .yi-privacy-rule { margin-top: 55px; gap: 8px; font-size: 8px; letter-spacing: .1em; }

          .yi-research-story { padding: 89px 21px; }
          .yi-research h2 { font-size: 62px; }
          .yi-research-stat { min-height: 520px; padding: 55px 21px; }
          .yi-research-stat strong { font-size: 178px; }
          .yi-research-stat p { margin: 34px 0 55px; font-size: 34px; }

          .yi-support { min-height: 820px; }
          .yi-support-image { object-position: 58% center; }
          .yi-support-overlay { background: linear-gradient(0deg, rgba(9,9,13,.98) 0%, rgba(9,9,13,.78) 64%, rgba(9,9,13,.3) 100%); }
          .yi-support-content { width: calc(100% - 42px); margin: 0 21px; padding: 89px 0; }
          .yi-support h2 { font-size: 66px; }
          .yi-support-content > p { font-size: 16px; }
          .yi-support-path { align-items: stretch; gap: 8px; }
          .yi-support-path span { flex-direction: column; align-items: flex-start; gap: 3px; }
          .yi-support-path i { margin: 14px 4px 0; }

          .yi-close { padding: 110px 21px; }
          .yi-close h2 { font-size: 76px; }
          .yi-footer { flex-direction: column; align-items: flex-start; padding: 34px 21px; }
          .yi-footer > div { flex-wrap: wrap; }
        }

        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .yi-button { transition: none; }
        }
      `}</style>
    </main>
  );
};

export default PulseCheckYouthInfoPage;

export const getStaticProps = async () => ({
  props: {
    ogMeta: {
      title: pageMeta.ogTitle,
      description: pageMeta.ogDescription,
      image: 'https://fitwithpulse.ai/pulsecheck-youth/youth-info-og.png',
      url: 'https://fitwithpulse.ai/PulseCheck/youth-info',
      type: 'website',
      siteName: 'PulseCheck',
    },
  },
});
