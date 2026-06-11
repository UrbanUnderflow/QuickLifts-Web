import Head from 'next/head';

// Investor update — July 2026 (Q2). Unlisted + noindex; share the URL
// directly. Editorial system matches the FitClub app redesign: deep
// charcoal, one lime accent, big black-weight type, photography.
//
// >>> METRICS: fill these in before sending. Em-dashes render as
// >>> placeholders so nothing fabricated ships by accident.
const METRICS = [
  { value: '—', label: 'MRR', note: 'vs last quarter' },
  { value: '—', label: 'Active members', note: 'across clubs' },
  { value: '—', label: 'Clubs created', note: 'this quarter' },
  { value: '—', label: 'Coaching GMV', note: 'paid 1-on-1' },
  { value: '—', label: 'Athletes monitored', note: 'PulseCheck' },
];

const LIME = '#E0FE10';
const CHARCOAL = 'rgba(17,18,21,0.78)';
const HAIRLINE = '1px solid rgba(255,255,255,0.10)';

export default function InvestorUpdateQ226() {
  return (
    <>
      <Head>
        <title>Pulse Intelligence Labs — Investor Update · July 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={styles.page}>
        {/* ---------- HERO ---------- */}
        <section style={styles.hero}>
          <div style={styles.heroGrade} />
          <a href="/review" style={styles.backlink}>← All Investor Updates</a>
          <div style={styles.heroInner}>
            <div style={styles.kicker}>
              PULSE INTELLIGENCE LABS · INVESTOR UPDATE · JULY 2026
            </div>
            <h1 style={styles.h1}>
              The quarter we<br />
              found our <span style={{ color: LIME }}>crew.</span>
            </h1>
            <p style={styles.heroSub} data-description="true">
              Q2 2026: Pulse became <strong style={{ color: '#fff' }}>FitClub</strong>, fitness
              became social, and the platform grew two new revenue engines.
            </p>
          </div>
        </section>

        <main style={styles.main}>
          {/* ---------- METRICS BAND ---------- */}
          <section style={styles.metricsBand}>
            {METRICS.map((m) => (
              <div key={m.label} style={styles.metric}>
                <div style={styles.metricValue}>{m.value}</div>
                <div style={styles.metricLabel}>{m.label}</div>
                <div style={styles.metricNote}>{m.note}</div>
              </div>
            ))}
          </section>

          {/* ---------- 01 FITCLUB ---------- */}
          <Section
            num="01"
            kicker="THE BIG SWING"
            title="Pulse is now FitClub."
            body={
              <>
                <p style={styles.p}>
                  We rebuilt the flagship app around a simple conviction: people don&apos;t quit
                  fitness — they quit doing it alone. QuickLifts became{' '}
                  <strong style={styles.strong}>FitClub</strong>, a clubs-first product where every
                  workout, challenge, and streak happens inside a crew that notices when you
                  don&apos;t show up.
                </p>
                <p style={styles.p}>
                  The rebrand came with a ground-up visual redesign — an editorial,
                  photography-forward system we now ship across every surface — and a rebuilt App
                  Store presence to match. Every screen below is live product, not concept.
                </p>
              </>
            }
          />
          <PhoneRail
            shots={[
              { src: '/investor/july-2026/01-splash.png', caption: 'The new front door' },
              { src: '/investor/july-2026/02-club-home.png', caption: 'Club home — The Pact' },
              { src: '/investor/july-2026/07b-run-challenge-type-accent.png', caption: 'Run challenges' },
            ]}
          />

          {/* ---------- 02 COACHING ---------- */}
          <Section
            num="02"
            kicker="NEW REVENUE ENGINE"
            title="Paid 1-on-1 coaching, end to end."
            body={
              <>
                <p style={styles.p}>
                  Creators can now sell private coaching directly inside their clubs — one-time
                  packages or recurring auto-pay subscriptions — settled through Stripe Connect
                  with a platform fee on every transaction. The full loop shipped this quarter:
                  paid room creation, member checkout on web, deep-link entry into a private
                  training room, and an <strong style={styles.strong}>adherence engine</strong>{' '}
                  that closes the loop — assigned lifts, cardio, and meals auto-complete from
                  workouts and wearable detection, and coaches watch the week fill in live.
                </p>
                <p style={styles.p}>
                  This is the supply-side moat: coaches who run their business on FitClub
                  don&apos;t leave FitClub.
                </p>
              </>
            }
          />
          <PhoneRail
            shots={[
              { src: '/investor/july-2026/03-training-1on1.png', caption: 'The 1-on-1 training room' },
            ]}
            wide
          />

          {/* ---------- 03 TWO-APP STRATEGY ---------- */}
          <Section
            num="03"
            kicker="PLATFORM ARCHITECTURE"
            title="One catalog, two apps."
            body={
              <>
                <p style={styles.p}>
                  This quarter we split the platform into a two-sided architecture.{' '}
                  <strong style={styles.strong}>FitClub</strong> is the studio — where creators
                  build clubs, content, and coaching businesses.{' '}
                  <strong style={styles.strong}>Fit With Pulse</strong> (launching Q3) is the
                  consumer app — a streaming-style experience that assembles personalized workouts
                  from the same creator catalog, the way a listener meets artists through a
                  playlist.
                </p>
                <p style={styles.p}>
                  Same content library, same Firebase backbone, two distinct audiences — supply
                  and demand, each with an app built for how they actually behave.
                </p>
              </>
            }
          />

          {/* ---------- 04 PULSECHECK ---------- */}
          <Section
            num="04"
            kicker="PULSECHECK"
            title="Athlete intelligence went cross-platform."
            accent="#A78BFA"
            body={
              <>
                <p style={styles.p}>
                  PulseCheck — our athlete mental-performance platform for schools, institutions,
                  and pro programs — shipped its{' '}
                  <strong style={styles.strong}>native Android app</strong> this quarter: feature
                  parity with iOS across monitoring, Nora chat, training curriculum, coach
                  messaging, and crisis support. Device coverage now spans Polar, Fitbit, Oura,
                  and Apple Health, unified behind a device-agnostic Sports Intelligence layer
                  that reports in coach language, not science-speak.
                </p>
                <p style={styles.p}>
                  On the staff side: a rebuilt coach dashboard, role-based provisioning for
                  organizations, and Train Nora — a vault that lets each program teach our AI its
                  own coaching philosophy.
                </p>
              </>
            }
          />

          {/* ---------- 05 EVENTS ---------- */}
          <Section
            num="05"
            kicker="JUST SHIPPED"
            title="Clubs became calendars."
            body={
              <>
                <p style={styles.p}>
                  The newest layer turns every club from a feed into a calendar: scheduled club
                  events with RSVP (&ldquo;Sunday Long Run · 6:00 AM · 23 going&rdquo;), countdown
                  cards, automatic reminders, QR + geofence check-in for real-world meetups, live
                  &ldquo;mid-workout right now&rdquo; presence, and one-tap cheers that land as
                  push notifications mid-set.
                </p>
                <p style={styles.p}>
                  Anticipation, shared moments, afterglow — the mechanics that make a club a club.
                </p>
              </>
            }
          />
          <PhoneRail
            shots={[
              { src: '/investor/july-2026/09-club-home-happening.png', caption: 'The Happening rail' },
              { src: '/investor/july-2026/10-event-detail-rsvp.png', caption: 'Events with RSVP' },
            ]}
          />

          {/* ---------- 06 NEXT ---------- */}
          <Section
            num="06"
            kicker="WHAT'S NEXT · Q3"
            title="Launch season."
            body={
              <ul style={styles.list}>
                <li style={styles.li}>
                  <strong style={styles.strong}>Fit With Pulse consumer launch</strong> — the
                  demand-side app meets the creator catalog.
                </li>
                <li style={styles.li}>
                  <strong style={styles.strong}>The recap engine</strong> — cycle podiums, weekly
                  club recaps, and milestone celebrations, written by Nora.
                </li>
                <li style={styles.li}>
                  <strong style={styles.strong}>The daily drop</strong> — club workouts that post
                  at an hour, not sit in a list.
                </li>
                <li style={styles.li}>
                  <strong style={styles.strong}>Creator monetization depth</strong> — club
                  subscriptions and event ticketing on the Stripe rails we just laid.
                </li>
              </ul>
            }
          />

          {/* ---------- CLOSING ---------- */}
          <section style={styles.closing}>
            <div style={styles.kicker}>THANK YOU</div>
            <h2 style={styles.closingTitle}>
              Fitness is <span style={{ color: LIME }}>better together.</span>
            </h2>
            <p style={{ ...styles.p, maxWidth: 560, margin: '18px auto 0', textAlign: 'center' }}>
              As always — grateful for your backing and your time. Replies, questions, and intros
              to club operators, college athletic programs, and creator-economy talent are always
              welcome.
            </p>
            <div style={styles.signature}>
              <div style={{ fontWeight: 800, color: '#fff', fontSize: 16 }}>Tremaine Grant</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 }}>
                Founder &amp; CEO · Pulse Intelligence Labs
              </div>
              <a href="mailto:tremaine@fitwithpulse.ai" style={styles.mail}>
                tremaine@fitwithpulse.ai
              </a>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

/* ---------- components ---------- */

function Section({
  num,
  kicker,
  title,
  body,
  accent = LIME,
}: {
  num: string;
  kicker: string;
  title: string;
  body: React.ReactNode;
  accent?: string;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHead}>
        <span style={{ ...styles.sectionNum, color: accent }}>{num}</span>
        <span style={styles.sectionKicker}>{kicker}</span>
      </div>
      <h2 style={styles.h2}>{title}</h2>
      {body}
    </section>
  );
}

function PhoneRail({
  shots,
  wide = false,
}: {
  shots: { src: string; caption: string }[];
  wide?: boolean;
}) {
  return (
    <div style={styles.rail}>
      {shots.map((s) => (
        <figure key={s.src} style={{ ...styles.phone, maxWidth: wide ? 320 : 260 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.src} alt={s.caption} style={styles.phoneImg} loading="lazy" />
          <figcaption style={styles.caption}>{s.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  backlink: {
    position: 'absolute',
    top: 24,
    left: 28,
    zIndex: 2,
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    padding: '10px 16px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(10,11,13,0.45)',
    backdropFilter: 'blur(12px)',
  },
  page: {
    background: '#020408',
    minHeight: '100vh',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Helvetica, Arial, sans-serif',
    color: 'rgba(255,255,255,0.85)',
  },
  hero: {
    position: 'relative',
    minHeight: '88vh',
    display: 'flex',
    alignItems: 'flex-end',
    backgroundImage: 'url(/investor/july-2026/hero.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: '50% 35%',
  },
  heroGrade: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(to bottom, rgba(2,4,8,0.55) 0%, rgba(2,4,8,0.15) 30%, rgba(2,4,8,0.55) 65%, #020408 100%)',
  },
  heroInner: {
    position: 'relative',
    maxWidth: 980,
    margin: '0 auto',
    padding: '0 28px 90px',
    width: '100%',
  },
  kicker: {
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.32em',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
  },
  h1: {
    fontSize: 'clamp(52px, 9vw, 104px)',
    lineHeight: 0.98,
    letterSpacing: '-0.03em',
    fontWeight: 900,
    color: '#fff',
    margin: '26px 0 0',
  },
  heroSub: {
    fontSize: 'clamp(17px, 2.2vw, 22px)',
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.75)',
    maxWidth: 620,
    marginTop: 28,
  },
  main: { maxWidth: 980, margin: '0 auto', padding: '0 28px 120px' },
  metricsBand: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 14,
    margin: '70px 0 30px',
  },
  metric: {
    background: CHARCOAL,
    border: HAIRLINE,
    borderRadius: 20,
    padding: '26px 20px',
  },
  metricValue: {
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: '-0.02em',
    color: LIME,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    marginTop: 8,
  },
  metricNote: { fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
  section: { marginTop: 110 },
  sectionHead: { display: 'flex', alignItems: 'baseline', gap: 16 },
  sectionNum: {
    fontSize: 15,
    fontWeight: 900,
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
  },
  sectionKicker: {
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: '0.28em',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase' as const,
  },
  h2: {
    fontSize: 'clamp(34px, 5vw, 56px)',
    lineHeight: 1.04,
    letterSpacing: '-0.025em',
    fontWeight: 900,
    color: '#fff',
    margin: '18px 0 26px',
  },
  p: {
    fontSize: 17,
    lineHeight: 1.75,
    color: 'rgba(255,255,255,0.7)',
    maxWidth: 700,
    margin: '0 0 20px',
  },
  strong: { color: '#fff', fontWeight: 700 },
  list: { margin: 0, padding: 0, listStyle: 'none', maxWidth: 700 },
  li: {
    fontSize: 17,
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.7)',
    padding: '16px 0 16px 30px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    position: 'relative' as const,
    backgroundImage:
      'radial-gradient(circle, #E0FE10 0%, #E0FE10 35%, transparent 40%)',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '14px 14px',
    backgroundPosition: '2px 27px',
  },
  rail: {
    display: 'flex',
    gap: 26,
    marginTop: 50,
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
  phone: { margin: 0, flex: '1 1 220px' },
  phoneImg: {
    width: '100%',
    borderRadius: 28,
    border: HAIRLINE,
    boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
    display: 'block',
  },
  caption: {
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center' as const,
    marginTop: 16,
  },
  closing: {
    marginTop: 140,
    textAlign: 'center' as const,
    borderTop: HAIRLINE,
    paddingTop: 90,
  },
  closingTitle: {
    fontSize: 'clamp(36px, 6vw, 64px)',
    fontWeight: 900,
    letterSpacing: '-0.025em',
    color: '#fff',
    margin: '22px 0 0',
  },
  signature: { marginTop: 56 },
  mail: {
    display: 'inline-block',
    marginTop: 18,
    color: LIME,
    fontWeight: 700,
    fontSize: 14,
    textDecoration: 'none',
    borderBottom: `1px solid ${LIME}55`,
    paddingBottom: 2,
  },
};
