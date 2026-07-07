import Head from 'next/head';

// Investor update - July 2026 (Q2). Unlisted + noindex; share the URL
// directly. This page is PulseCheck-first, with FitClub and Macra framed
// as self-service products that keep operating while the company focuses.
const PILOT_ACCOUNTS = [
  {
    account: 'Clark Atlanta University',
    type: 'NCAA institution',
    stage: 'Pilot onboarding',
    value: 'Tracked in Q3',
  },
  {
    account: 'University of Maryland Eastern Shore',
    type: 'NCAA institution',
    stage: 'Pilot scoping',
    value: 'Tracked in Q3',
  },
  {
    account: 'Worcester State University',
    type: 'NCAA institution',
    stage: 'Pilot scoping',
    value: 'Tracked in Q3',
  },
  {
    account: '4D Cycling',
    type: 'Team / performance group',
    stage: 'Pilot onboarding',
    value: 'Tracked in Q3',
  },
  {
    account: 'Hypercharge Performance Clinic',
    type: 'Clinical / performance partner',
    stage: 'Pilot onboarding',
    value: 'Tracked in Q3',
  },
];

const PIPELINE_SCOREBOARD = [
  { value: '5', label: 'Total pilots', note: 'Q2 baseline accounts' },
  { value: '2', label: 'Paid contracts', note: 'in the current pipeline' },
  { value: '3', label: 'Free contracts', note: 'research-based pilots' },
  { value: '$25,000', label: 'Total contract value', note: 'in the pipeline', compact: true },
];

const ATHLETE_RISK_STATS = [
  {
    value: '4x',
    before: 'Athletes are ',
    after: ' more likely to face a mental health crisis.',
  },
  {
    value: '60%',
    before: '',
    after: ' of athletes feel elevated anxiety leading up to competition.',
  },
  {
    value: '10%',
    before: 'Only ',
    after: ' of athletes voice it to their coach before it breaks.',
  },
];

const LIME = '#E0FE10';
const CYAN = '#67E8F9';
const VIOLET = '#A78BFA';
const CHARCOAL = 'rgba(17,18,21,0.78)';
const HAIRLINE = '1px solid rgba(255,255,255,0.10)';

export default function InvestorUpdateQ226() {
  return (
    <>
      <Head>
        <title>Pulse Intelligence Labs - Q2 2026 Investor Update</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div style={styles.page}>
        <section style={styles.hero}>
          <div style={styles.heroGrade} />
          <a href="/review" style={styles.backlink}>
            &larr; All Investor Updates
          </a>
          <div style={styles.heroInner}>
            <div style={styles.kicker}>
              PULSE INTELLIGENCE LABS · INVESTOR UPDATE · JULY 3, 2026
            </div>
            <h1 style={styles.h1}>The Pivot.</h1>
            <p style={styles.heroSub} data-description="true">
              Q2 2026: Pulse became <strong style={{ color: '#fff' }}>FitClub</strong>,
              and PulseCheck became the priority.
            </p>
          </div>
        </section>

        <main style={styles.main}>
          <Section
            num="01"
            kicker="THE BIG SWING"
            title="We are focused on PulseCheck."
            body={
              <>
                <p style={styles.p}>
                  This quarter, the market taught us our most important lesson yet: the
                  strongest pull is coming from PulseCheck. So we made a strategic call
                  and put the company&apos;s weight there.
                </p>
                <p style={styles.p}>
                  Over the past few months, we have sat across from universities,
                  professional sports teams, collegiate athletes, US Olympians, and
                  investors and run the{' '}
                  <a href="/pulse-check-tech-demo" style={styles.inlineLink}>
                    same demo
                  </a>{' '}
                  again and again. We noticed something we had never experienced before.
                  Our audience&apos;s response does not change. People get it. They clearly
                  understand the product. They know the challenge. And they are excited by
                  the solution. In the first few minutes, we keep hearing, &ldquo;This is so
                  needed,&rdquo; &ldquo;I wish I had this when I was playing,&rdquo; and &ldquo;I
                  have goosebumps.&rdquo;
                </p>
                <p style={styles.sourceNote}>
                  Product context:{' '}
                  <a href="/pulse-check-tech-demo" style={styles.inlineLink}>
                    View the PulseCheck tech demo
                  </a>
                  .
                </p>
                <p style={styles.p}>
                  This is a strong signal. We feel it in the room, and it is palpable.
                  PulseCheck sits in a gap nobody has filled. Mental health and sports
                  performance have lived as two sides of the same coin, kept apart,
                  handled by different people in different buildings. We bring them
                  together in one place, end to end, from the daily check-in to the
                  moment an athlete needs real clinical care.
                </p>
              </>
            }
          />

          <AthleteProofPoint />

          <Section
            num="02"
            kicker="OUR BEACHHEAD"
            title="Our beachhead: NCAA institutions"
            accent={CYAN}
            body={
              <>
                <p style={styles.p}>
                  Our beachhead is NCAA institutions, and for them PulseCheck is not a
                  nice-to-have. It is a need-to-have.{' '}
                  <a
                    href="https://ncaaorg.s3.amazonaws.com/governance/ncaa/constitution/NCAAGov_Constitution121421.pdf"
                    style={styles.inlineLink}
                  >
                    The NCAA Constitution
                  </a>
                  , Section D on Student-Athlete Well-Being, requires it.
                </p>
                <p style={styles.p}>
                  <a
                    href="https://www.ncaa.org/news/2024/1/10/media-center-new-ncaa-mental-health-best-practices-approved-for-all-schools-to-follow.aspx"
                    style={styles.inlineLink}
                  >
                    The NCAA constitution, adopted in January 2022
                  </a>
                  , requires every member school, across all divisions, to ensure access
                  to mental health resources and support consistent with the NCAA Mental
                  Health Best Practices. The second edition became legislatively
                  effective in August 2024. The first Division I attestation deadline
                  landed in November 2025, when schools had to formally attest that they
                  provide services consistent with the best practices.
                </p>
                <p style={styles.p}>
                  The best practices name four required competencies:
                </p>
                <ul style={styles.obligationList}>
                  <li style={styles.obligationItem}>
                    A healthy environment that supports mental health
                  </li>
                  <li style={styles.obligationItem}>Screening for psychological distress</li>
                  <li style={styles.obligationItem}>
                    Action plans for mental health emergencies
                  </li>
                  <li style={styles.obligationItem}>Care from licensed providers</li>
                </ul>
                <p style={styles.p}>
                  This is the infrastructure PulseCheck and AuntEDNA provide together.
                  We help schools meet these obligations. Our product ensures a regular
                  readiness check-in for every athlete, a clear escalation path when
                  something changes with an athlete, and a routed handoff to licensed
                  care by licensed providers. Schools are not deciding whether to offer
                  this. They are required to.
                </p>
                <p style={styles.sourceNote}>
                  Source context:{' '}
                  <a
                    href="https://www.ncaa.org/sports/2021/2/10/sport-science-institute-mental-health.aspx"
                    style={styles.inlineLink}
                  >
                    NCAA Mental Health Best Practices
                  </a>
                  .
                </p>
              </>
            }
          />

          <Section
            num="03"
            kicker="PULSECHECK, UP CLOSE"
            title="The product the market is reaching for."
            body={
              <>
                <p style={styles.p}>
                  PulseCheck is a performance AI layer between athletes and coaches that
                  helps assess, train, and improve mental readiness. Athletes run short,
                  regular check-ins about mood, temperament, and performance readiness.
                  They train their minds with the same frequency as their physical bodies
                  through our mental performance simulations and protocols. Coaches get a
                  holistic read on patterns across the team and a snapshot read on how
                  every player shows up for the day, the practice, and the game. If there
                  is a clinical need that goes beyond coaching, the athlete is escalated
                  to a human clinician for timely support. The point is to support the
                  athlete&apos;s mental performance and to help coaches and support staff
                  notice patterns earlier and create better interventions for care.
                </p>
                <h3 style={styles.subhead}>The escalation model is the spine</h3>
                <p style={styles.p}>
                  This is what makes institutions trust us. Tier 1 is monitor-only, a
                  normal dip a coach can simply notice. Tier 2 is consent-based, where a
                  coach has a private conversation and, with the athlete&apos;s okay,
                  loops in support. Tier 3 is mandatory, routing self-harm, safety risk,
                  or abuse disclosures straight into clinical care through our partner,
                  AuntEDNA.ai. A non-clinical coach never has to carry a clinical
                  response they were never trained for.
                </p>
              </>
            }
          />

          <PhoneRail
            shots={[
              { src: '/pulsecheck-media/01-today-checkin.png', caption: 'Daily athlete check-in' },
              { src: '/pulsecheck-media/03-sports-intel.png', caption: 'Sports Intelligence layer' },
              { src: '/pulsecheck-media/09-critical-signal.png', caption: 'Critical signal routing' },
            ]}
          />

          <Section
            num="04"
            kicker="WHAT SHIPPED"
            title="What shipped this quarter"
            accent={VIOLET}
            body={
              <>
                <ul style={styles.shippedList}>
                  <li style={styles.shippedItem}>
                    <strong style={styles.strong}>Native Android shipped:</strong> feature
                    parity with iOS across monitoring, Nora chat, training curriculum,
                    coach messaging, and crisis support.
                  </li>
                  <li style={styles.shippedItem}>
                    <strong style={styles.strong}>Device coverage expanded:</strong> Polar,
                    Fitbit, Oura, Whoop, and Apple Health now feed one Sports Intelligence
                    layer.
                  </li>
                  <li style={styles.shippedItem}>
                    <strong style={styles.strong}>Coach language, not science-speak:</strong>{' '}
                    biometric data is translated into reports staff can understand and act
                    on quickly.
                  </li>
                  <li style={styles.shippedItem}>
                    <strong style={styles.strong}>Staff tooling rebuilt:</strong> coach
                    dashboard, role-based provisioning, and Train Nora for each program&apos;s
                    coaching philosophy.
                  </li>
                </ul>
                <h3 style={styles.subhead}>Into the field</h3>
                <ul style={styles.shippedList}>
                  <li style={styles.shippedItem}>
                    <strong style={styles.strong}>Demos are becoming programs:</strong>{' '}
                    first pilots are onboarding with Clark Atlanta University, UMES,
                    Worcester State University, 4D Cycling, and Hypercharge Performance
                    Clinic.
                  </li>
                  <li style={styles.shippedItem}>
                    <strong style={styles.strong}>Full loop pilots:</strong> each pilot
                    runs from athlete check-in to coach dashboard to clinical handoff.
                  </li>
                  <li style={styles.shippedItem}>
                    <strong style={styles.strong}>Next update gets measurable:</strong> Q3
                    opens with what those pilots produced.
                  </li>
                </ul>
              </>
            }
          />

          <section style={styles.scoreboard}>
            <div style={styles.sectionHead}>
              <span style={{ ...styles.sectionNum, color: CYAN }}>05</span>
              <span style={styles.sectionKicker}>NEW INVESTOR METRICS</span>
            </div>
            <h2 style={styles.h2}>The PulseCheck sales pipeline becomes the scoreboard.</h2>
            <p style={styles.p}>
              Because PulseCheck is now the company priority, future quarterly updates
              will lead with pipeline metrics that show whether institutional demand is
              turning into paid deployment. Q2 is the baseline quarter. Q3 is where this
              section moves to the top of the update.
            </p>

            <div style={styles.pipelineScorecards} aria-label="PulseCheck pipeline metrics">
              {PIPELINE_SCOREBOARD.map((m) => (
                <div key={m.label} style={styles.metric}>
                  <div style={{ ...styles.metricValue, ...(m.compact ? styles.metricValueCompact : null) }}>
                    {m.value}
                  </div>
                  <div style={styles.metricLabel}>{m.label}</div>
                  <div style={styles.metricNote}>{m.note}</div>
                </div>
              ))}
            </div>

            <div style={styles.pipelineGrid}>
              <div style={styles.pipelinePanel}>
                <div style={styles.panelTitle}>Q2 baseline accounts</div>
                <div style={styles.accountTable}>
                  {PILOT_ACCOUNTS.map((pilot) => (
                    <div key={pilot.account} style={styles.accountRow}>
                      <div>
                        <div style={styles.accountName}>{pilot.account}</div>
                        <div style={styles.accountType}>{pilot.type}</div>
                      </div>
                      <div style={styles.accountStage}>{pilot.stage}</div>
                      <div style={styles.accountValue}>{pilot.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <Section
            num="06"
            kicker="THE ATHLETIC MIND COUNCIL"
            title="The people who move the field."
            body={
              <>
                <p style={styles.p}>
                  This spring we convened the Athletic Mind Council with our clinical
                  partner, AuntEDNA.ai. The Council is a founding group of clinicians,
                  athletes, coaches, researchers, technologists, and cultural voices
                  brought together to shape the mental performance and clinical care
                  infrastructure athletes deserve.
                </p>
                <p style={styles.p}>
                  The Council exists because of a real gap. Mental performance training
                  and mental health care still sit in separate silos. Wearables read the
                  body without having a holistic context of an athlete and team. Coaches
                  and clinicians work from different vocabularies and different data. The
                  handoff between performance support and clinical care happens in a
                  single moment in an athlete&apos;s life. We believe the people who shape
                  that moment should be in the same room, covering the athlete from all
                  sides.
                </p>
                <p style={styles.p}>
                  We convened at the founding stage on purpose. PulseCheck is moving from
                  live product into university deployment, and the research, the roadmap,
                  and the language of this field are still early enough for the right
                  voices to shape what comes next. We would rather build this field in
                  public than watch the category harden without the people closest to
                  athletes.
                </p>
                <p style={styles.p}>
                  The Council pressure-tests the product, helps design pilots inside real
                  programs, co-authors research, opens doors across athletic departments
                  and clinical networks, and helps lead the public conversation. It brings
                  together the advisor networks behind Pulse Intelligence Labs and
                  AuntEDNA.ai while keeping each company&apos;s board distinct, under
                  Founding Executive Director Arionne Allen.
                </p>
                <p style={styles.p}>
                  See the full council, its members, and its charter here:{' '}
                  <a href="/athletic-mind-hub" style={styles.inlineLink}>
                    The Athletic Mind Council
                  </a>
                </p>
              </>
            }
          />

          <FeatureImage
            src="/athletic-mind-council-og-v4.png"
            caption="The Athletic Mind Council connects the athlete, coach, clinical, and research perspectives around one system."
          />

          <Section
            num="07"
            kicker="THE REST OF THE LAB"
            title="Pulse is now FitClub."
            body={
              <>
                <p style={styles.p}>
                  Our refined focus did not mean shelving what we built. It meant
                  changing how we operate and optimize. FitClub is a prime example of
                  this. We took our consumer fitness app and turned it into infrastructure
                  for fitness creators, the people who build clubs, content, and coaching
                  businesses on our app. We renamed it FitClub to fit that shift and made
                  it self-service, so creators run it without us. Macra, our macro and
                  calorie nutrition AI, works the same way: low lift for us, low touch for
                  the user. Both products earn on their own.
                </p>
              </>
            }
          />

          <div style={styles.productSplit}>
            <figure style={styles.productCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fitclub-media/02-club-home.png" alt="FitClub club home" style={styles.productImg} />
              <figcaption style={styles.caption}>FitClub - self-service clubs</figcaption>
            </figure>
            <figure style={styles.productCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/macra-og.png" alt="Macra nutrition AI" style={styles.productImgContained} />
              <figcaption style={styles.caption}>Macra - self-service nutrition AI</figcaption>
            </figure>
          </div>

          <Section
            num="08"
            kicker="WHAT'S NEXT · Q3"
            title="What’s Next."
            body={
              <ul style={styles.list}>
                <li style={styles.li}>
                  <strong style={styles.strong}>PulseCheck pilots go live:</strong> named
                  schools and teams run the full loop, with adherence as the lead metric.
                </li>
                <li style={styles.li}>
                  <strong style={styles.strong}>Fundraising:</strong> we have officially
                  started our raise.
                </li>
                <li style={styles.li}>
                  <strong style={styles.strong}>Growth:</strong> our goal is to add more
                  pilots in Q3.
                </li>
                <li style={styles.li}>
                  <strong style={styles.strong}>Refine and learn:</strong> based on what
                  we&apos;re learning, we&apos;re excited to keep refining the product.
                </li>
                <li style={styles.li}>
                  <strong style={styles.strong}>Activations:</strong> We are looking for
                  community engagement opportunities within spaces and brands we want to
                  build with. The Nike Store in Lenox Square Mall will be our first.
                </li>
              </ul>
            }
          />

          <section style={styles.nameNote}>
            <div style={styles.kicker}>A NOTE ON THE NAME</div>
            <h2 style={styles.closingTitle}>Why we call it a lab.</h2>
            <p style={{ ...styles.p, maxWidth: 720, margin: '18px auto 0', textAlign: 'center' }}>
              You may have noticed our banner and pages now read Pulse Intelligence Labs.
              That is on purpose. The name is an umbrella built to hold everything we make.
              It sharpens what our business, our mission, and our value are: we are not
              just a company with an app. We are a lab that specializes in human
              performance and AI. We center human capacity and use AI to inform fitness
              and well-being.
            </p>
          </section>

          <section style={styles.closing}>
            <div style={styles.kicker}>THANK YOU</div>
            <h2 style={styles.closingTitle}>The Ask.</h2>
            <p style={{ ...styles.p, maxWidth: 680, margin: '18px auto 0', textAlign: 'center' }}>
              Grateful, as always, for your backing and your time. We need introductions to:
            </p>
            <ul style={styles.askList}>
              <li style={styles.askItem}>
                <strong style={styles.strong}>Decision makers in athletic programs:</strong>{' '}
                athletic directors, heads of athlete development, coaches, and anyone
                with knowledge of athletic departments and decision makers at
                universities, in or adjacent to athletic performance.
              </li>
              <li style={styles.askItem}>
                <strong style={styles.strong}>Brand sponsors:</strong> not only athletic
                brands, but any brand or grant with funding to sponsor activations and
                pilots for under-resourced schools that need help funding this program.
              </li>
              <li style={styles.askItem}>
                <strong style={styles.strong}>Clinical partners:</strong> sports
                psychologists, team doctors, or anyone in the medical field who works
                with athletes.
              </li>
            </ul>
            <div style={styles.signature}>
              <div style={{ fontWeight: 800, color: '#fff', fontSize: 16 }}>Tremaine Grant</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 }}>
                Founder &amp; CEO · Pulse Intelligence Labs
              </div>
              <a href="mailto:tre@fitwithpulse.ai" style={styles.mail}>
                tre@fitwithpulse.ai
              </a>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

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

function FeatureImage({ src, caption }: { src: string; caption: string }) {
  return (
    <figure style={styles.featureFigure}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={caption} style={styles.featureImg} loading="lazy" />
      <figcaption style={styles.caption}>{caption}</figcaption>
    </figure>
  );
}

function AthleteProofPoint() {
  return (
    <section style={styles.athleteProof}>
      <figure style={styles.athletePhotoCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nakyala-cau.jpg"
          alt="Nakyala of Clark Atlanta Women's Volleyball"
          style={styles.athleteImg}
          loading="lazy"
        />
        <figcaption style={styles.athleteCaption}>
          Nakyala, team captain of Clark Atlanta Women&apos;s Volleyball, our first pilot team.
        </figcaption>
      </figure>

      <div style={styles.athleteStats}>
        {ATHLETE_RISK_STATS.map((stat) => (
          <div key={stat.value} style={styles.athleteStatCard}>
            <p style={styles.athleteStatSentence}>
              {stat.before}
              <span style={styles.athleteStatValue}>{stat.value}</span>
              {stat.after}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhoneRail({ shots }: { shots: { src: string; caption: string }[] }) {
  return (
    <div style={styles.rail}>
      {shots.map((s) => (
        <figure key={s.src} style={styles.phone}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.src} alt={s.caption} style={styles.phoneImg} loading="lazy" />
          <figcaption style={styles.caption}>{s.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

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
    color: 'rgba(255,255,255,0.78)',
    textDecoration: 'none',
    padding: '10px 16px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(10,11,13,0.50)',
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
    backgroundImage: 'url(/investor/july-2026/hero-basketball-huddle.png)',
    backgroundSize: 'cover',
    backgroundPosition: '58% 50%',
  },
  heroGrade: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(to bottom, rgba(2,4,8,0.66) 0%, rgba(2,4,8,0.28) 34%, rgba(2,4,8,0.74) 72%, #020408 100%)',
  },
  heroInner: {
    position: 'relative',
    maxWidth: 980,
    margin: '0 auto',
    padding: '0 28px 92px',
    width: '100%',
  },
  kicker: {
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.30em',
    color: 'rgba(255,255,255,0.62)',
    textTransform: 'uppercase',
  },
  h1: {
    fontSize: 'clamp(58px, 11vw, 132px)',
    lineHeight: 0.92,
    letterSpacing: '-0.025em',
    fontWeight: 900,
    color: '#fff',
    margin: '24px 0 0',
  },
  heroSub: {
    fontSize: 'clamp(18px, 2.2vw, 24px)',
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.78)',
    maxWidth: 680,
    marginTop: 28,
  },
  main: { maxWidth: 980, margin: '0 auto', padding: '0 28px 120px' },
  pipelineScorecards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 14,
    margin: '42px 0 28px',
  },
  metric: {
    background: CHARCOAL,
    border: HAIRLINE,
    borderRadius: 8,
    minHeight: 184,
    padding: '32px 20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 46,
    fontWeight: 900,
    letterSpacing: '-0.02em',
    color: LIME,
  },
  metricValueCompact: {
    fontSize: 36,
    letterSpacing: '-0.01em',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: 800,
    color: '#fff',
    marginTop: 26,
    lineHeight: 1.28,
  },
  metricNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.42)',
    lineHeight: 1.35,
    marginTop: 10,
  },
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
    letterSpacing: '0.25em',
    color: 'rgba(255,255,255,0.48)',
    textTransform: 'uppercase',
  },
  h2: {
    fontSize: 'clamp(34px, 5vw, 56px)',
    lineHeight: 1.04,
    letterSpacing: '-0.02em',
    fontWeight: 900,
    color: '#fff',
    margin: '18px 0 26px',
  },
  p: {
    fontSize: 17,
    lineHeight: 1.75,
    color: 'rgba(255,255,255,0.72)',
    maxWidth: 720,
    margin: '0 0 20px',
  },
  subhead: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.25,
    margin: '28px 0 14px',
    maxWidth: 720,
  },
  sourceNote: {
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 12,
    lineHeight: 1.6,
    color: 'rgba(255,255,255,0.48)',
    maxWidth: 720,
    marginTop: 18,
  },
  inlineLink: {
    color: CYAN,
    textDecoration: 'none',
    borderBottom: `1px solid ${CYAN}66`,
    paddingBottom: 2,
  },
  strong: { color: '#fff', fontWeight: 700 },
  shippedList: {
    margin: '0 0 6px',
    padding: 0,
    listStyle: 'none',
    maxWidth: 780,
  },
  shippedItem: {
    fontSize: 17,
    lineHeight: 1.6,
    color: 'rgba(255,255,255,0.72)',
    padding: '14px 0 14px 30px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    position: 'relative',
    backgroundImage: `radial-gradient(circle, ${VIOLET} 0%, ${VIOLET} 35%, transparent 40%)`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '12px 12px',
    backgroundPosition: '2px 23px',
  },
  list: { margin: 0, padding: 0, listStyle: 'none', maxWidth: 760 },
  li: {
    fontSize: 17,
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.72)',
    padding: '16px 0 16px 30px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    position: 'relative',
    backgroundImage: `radial-gradient(circle, ${LIME} 0%, ${LIME} 35%, transparent 40%)`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '14px 14px',
    backgroundPosition: '2px 27px',
  },
  obligationList: {
    margin: '4px 0 24px',
    padding: 0,
    listStyle: 'none',
    maxWidth: 720,
  },
  obligationItem: {
    fontSize: 17,
    lineHeight: 1.55,
    color: 'rgba(255,255,255,0.76)',
    padding: '10px 0 10px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    backgroundImage: `radial-gradient(circle, ${CYAN} 0%, ${CYAN} 35%, transparent 40%)`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '10px 10px',
    backgroundPosition: '2px 19px',
  },
  featureFigure: {
    margin: '48px 0 0',
  },
  featureImg: {
    width: '100%',
    borderRadius: 8,
    border: HAIRLINE,
    boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
    display: 'block',
  },
  athleteProof: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
    gap: 24,
    alignItems: 'start',
    marginTop: 50,
  },
  athletePhotoCard: {
    margin: 0,
  },
  athleteImg: {
    width: '100%',
    height: 'auto',
    maxHeight: 720,
    objectFit: 'cover',
    objectPosition: 'center 35%',
    borderRadius: 8,
    border: HAIRLINE,
    boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
    display: 'block',
  },
  athleteCaption: {
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 11,
    letterSpacing: '0.14em',
    lineHeight: 1.55,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 16,
  },
  athleteStats: {
    display: 'grid',
    gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
    gap: 14,
  },
  athleteStatCard: {
    background: CHARCOAL,
    border: HAIRLINE,
    borderRadius: 8,
    padding: '30px 28px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  athleteStatSentence: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 'clamp(23px, 3.1vw, 34px)',
    lineHeight: 1.18,
    fontWeight: 850,
    letterSpacing: '-0.01em',
    margin: 0,
  },
  athleteStatValue: {
    color: LIME,
    fontWeight: 900,
    letterSpacing: '-0.02em',
  },
  rail: {
    display: 'flex',
    gap: 26,
    marginTop: 50,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  phone: { margin: 0, flex: '1 1 220px', maxWidth: 260 },
  phoneImg: {
    width: '100%',
    borderRadius: 8,
    border: HAIRLINE,
    boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
    display: 'block',
  },
  caption: {
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 11,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 16,
  },
  ctaLink: {
    display: 'inline-block',
    color: LIME,
    fontWeight: 800,
    fontSize: 14,
    textDecoration: 'none',
    borderBottom: `1px solid ${LIME}66`,
    paddingBottom: 3,
    marginTop: 6,
  },
  productSplit: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 24,
    marginTop: 46,
  },
  productCard: {
    margin: 0,
    padding: 16,
    background: CHARCOAL,
    border: HAIRLINE,
    borderRadius: 8,
  },
  productImg: {
    width: '100%',
    aspectRatio: '4 / 3',
    objectFit: 'cover',
    objectPosition: 'top center',
    borderRadius: 6,
    display: 'block',
  },
  productImgContained: {
    width: '100%',
    aspectRatio: '4 / 3',
    objectFit: 'contain',
    objectPosition: 'center center',
    borderRadius: 6,
    display: 'block',
    background: '#020408',
  },
  scoreboard: {
    marginTop: 120,
    padding: '42px 0 0',
    borderTop: HAIRLINE,
  },
  pipelineGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 18,
    marginTop: 22,
  },
  pipelinePanel: {
    background: CHARCOAL,
    border: HAIRLINE,
    borderRadius: 8,
    padding: 22,
  },
  panelTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    marginBottom: 18,
  },
  metricList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  metricPill: {
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 999,
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    lineHeight: 1.35,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
  },
  accountTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  accountRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(100px, 0.8fr) minmax(92px, 0.7fr)',
    gap: 12,
    alignItems: 'center',
    paddingBottom: 12,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  accountName: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 800,
    lineHeight: 1.3,
  },
  accountType: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11.5,
    lineHeight: 1.35,
    marginTop: 3,
  },
  accountStage: {
    color: CYAN,
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 11.5,
    lineHeight: 1.4,
  },
  accountValue: {
    color: 'rgba(255,255,255,0.52)',
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 11.5,
    lineHeight: 1.4,
    textAlign: 'right',
  },
  nameNote: {
    marginTop: 130,
    textAlign: 'center',
    borderTop: HAIRLINE,
    paddingTop: 84,
  },
  askList: {
    margin: '28px auto 0',
    padding: 0,
    listStyle: 'none',
    maxWidth: 760,
    textAlign: 'left',
  },
  askItem: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    lineHeight: 1.65,
    padding: '16px 0 16px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    backgroundImage: `radial-gradient(circle, ${LIME} 0%, ${LIME} 35%, transparent 40%)`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '10px 10px',
    backgroundPosition: '2px 25px',
  },
  closing: {
    marginTop: 120,
    textAlign: 'center',
    borderTop: HAIRLINE,
    paddingTop: 84,
  },
  closingTitle: {
    fontSize: 'clamp(36px, 6vw, 64px)',
    fontWeight: 900,
    letterSpacing: '-0.02em',
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
