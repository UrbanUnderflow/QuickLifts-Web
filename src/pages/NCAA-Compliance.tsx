import type { GetStaticProps, NextPage } from 'next';
import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Brain,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  HeartHandshake,
  LockKeyhole,
  Printer,
  Radar,
  Route,
  ShieldCheck,
  Siren,
  Stethoscope,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react';
import PageHead from '../components/PageHead';

type Requirement = {
  id: string;
  number: string;
  title: string;
  source: string;
  school: string;
  pulse: string;
  clinical: string;
  record: string;
};

type ReadinessItem = {
  requirement: string;
  owner: string;
  status: 'Ready' | 'Review needed';
  record: string;
};

const PAGE_TITLE = 'NCAA Mental Health Compliance | PulseCheck + AuntEdna.ai';
const PAGE_DESCRIPTION =
  'PulseCheck and AuntEdna.ai make NCAA mental-health compliance easier to manage by connecting athlete education, screening, early detection, clinical care and documentation.';
const PAGE_URL = 'https://pulseintelligencelabs.com/NCAA-Compliance';
const PAGE_OG_IMAGE = 'https://fitwithpulse.ai/ncaa-mental-health-compliance-og.png';

const requirements: Requirement[] = [
  {
    id: 'services-education',
    number: '01',
    title: 'Services, resources and education',
    source: 'NCAA Bylaw 16.4.1',
    school:
      'Make mental-health services and resources available. Tell athletes, coaches and athletics staff what support exists and how to access it throughout the year.',
    pulse:
      'Builds mental-health skills into the part athletes already care about: performance. AI turns focus, confidence, recovery and emotional control into sport-specific module exercises called Skills. Authorized university stakeholders can see which Skills each athlete receives and completes.',
    clinical:
      'Clinical staff keep services, provider coverage and referral routes current in AuntEdna.ai. When PulseCheck raises a clinical concern, the platform creates a case, routes it to the right clinician and records who owns the next step.',
    record: 'Assigned curriculum, completion history, resource delivery and support access',
  },
  {
    id: 'written-plan',
    number: '02',
    title: 'Written mental-health plan',
    source: 'Mental Health Best Practice 1',
    school:
      'Create a written mental-health promotion plan with a licensed provider. The plan should cover athletes, teams, athletics, campus and community support.',
    pulse:
      'Turns the written plan into real work: athlete training, staff responsibilities, response rules, practice dates and follow-up steps. Leaders can see what is active, what is complete and what still needs an owner.',
    clinical:
      'Clinical leaders build and approve the clinical part of the plan in AuntEdna.ai. They set screening, referral, emergency, follow-up and return-to-training rules, assign owners and keep each approved version on file.',
    record: 'Current plan, clinical approval, assigned owners, review dates and changes',
  },
  {
    id: 'screening',
    number: '03',
    title: 'Annual mental-health screening',
    source: 'Mental Health Best Practice 2',
    school:
      'Screen all student-athletes at least once each year using a validated tool in consultation with an athletics health-care or licensed mental-health provider.',
    pulse:
      'Delivers the required annual provider-approved screen, explains it clearly and tracks every athlete through completion. PulseCheck then goes beyond the once-a-year screen with daily check-ins, Nora sentiment analysis, training behavior, readiness patterns and permitted health data that help staff see meaningful changes sooner.',
    clinical:
      'Clinical staff choose the validated annual screen and control what happens after it. In AuntEdna.ai, they see who completed it, review results that need attention, document the review, assign follow-up and keep the screening record ready for compliance reports.',
    record: 'Annual completion, daily signal history, provider review and documented follow-up',
  },
  {
    id: 'action-plans',
    number: '04',
    title: 'Routine and emergency action plans',
    source: 'Mental Health Best Practice 3',
    school:
      'Write and rehearse clear steps for routine concerns and emergencies, including identification, referral, treatment, follow-up and reentry.',
    pulse:
      'Runs the early-detection layer between annual screens. Check-ins, Nora conversations, training behavior, recent performance and available health data help the system notice changes, raise the right level of concern and pause normal training when safety rules require it.',
    clinical:
      'Clinical staff receive a prioritized case in AuntEdna.ai with the concern summary, required action and assigned owner. The platform automates routing, reminders and status tracking while recording each handoff, response and follow-up step.',
    record: 'Signal history, response path, staff action, clinical handoff and follow-up status',
  },
  {
    id: 'licensed-care',
    number: '05',
    title: 'Licensed clinical care',
    source: 'Mental Health Best Practice 4',
    school:
      'Keep formal mental-health evaluation and treatment with qualified providers acting within the scope of their licenses.',
    pulse:
      'Separates performance coaching, staff support and clinical care. PulseCheck sends only the minimum context needed for a handoff, keeps private conversations out of general staff views and stops performance programming during a critical safety event.',
    clinical:
      'Clinicians manage intake, notes, treatment, crisis actions, ongoing monitoring and return-to-training from one AuntEdna.ai workspace. They control every care decision; PulseCheck receives only the approved status needed to protect the athlete.',
    record: 'Handoff time, accepted status, care status and follow-up without clinical notes',
  },
  {
    id: 'review-cycle',
    number: '06',
    title: 'Annual attestation and four-year review',
    source: 'NCAA Bylaws 20.2.4.25 and 20.2.4.23',
    school:
      'Review the work behind the annual attestation. At least every four years, complete the broader review of mental and physical health, safety and performance services.',
    pulse:
      'Builds one review-ready record from education, screening, early-detection rules, action-plan practice, staff response, clinical handoffs, follow-up and open gaps. Leaders can review it on screen or export it.',
    clinical:
      'Clinical leaders can export screening completion, documented reviews, referrals, response times, follow-up and plan approvals from one place. Compliance exports show the process without including private clinical notes.',
    record: 'Annual readiness report, evidence index and four-year mental-health review file',
  },
];

const readinessItems: ReadinessItem[] = [
  {
    requirement: 'Services and education',
    owner: 'Student-athlete development',
    status: 'Ready',
    record: 'Sport-specific curriculum assigned; 87% weekly completion',
  },
  {
    requirement: 'Written mental-health plan',
    owner: 'Athletics health care administrator',
    status: 'Ready',
    record: 'Response rules and clinical routing approved July 30',
  },
  {
    requirement: 'Annual screening',
    owner: 'Sports medicine',
    status: 'Review needed',
    record: '94% complete; 23 athletes remaining',
  },
  {
    requirement: 'Routine and emergency plans',
    owner: 'Sports medicine and counseling',
    status: 'Ready',
    record: 'Response drill and clinical handoff completed Oct. 2',
  },
  {
    requirement: 'Licensed clinical care',
    owner: 'AuntEdna.ai clinical team',
    status: 'Ready',
    record: 'Clinical route, provider coverage and care-state connection confirmed',
  },
  {
    requirement: 'Leadership review',
    owner: 'President, AD and health care administrator',
    status: 'Review needed',
    record: 'Final review scheduled Oct. 28',
  },
];

const annualFlow = [
  {
    label: 'First setup + each new year',
    title: 'Configure once. Review and carry forward.',
    body: 'PulseCheck and AuntEdna.ai guide your team through resources, owners, early-detection rules and clinical routes. Change anything when needed; approved settings carry into the next year for review.',
  },
  {
    label: 'During the year',
    title: 'Educate, screen and practice',
    body: 'Run sport-specific mental training, complete annual screening and rehearse routine and emergency response plans.',
  },
  {
    label: 'When support is needed',
    title: 'Refer, coordinate and follow up',
    body: 'PulseCheck chooses the response path. Clinical staff manage the case and follow-up in AuntEdna.ai. Approved status returns to PulseCheck.',
  },
  {
    label: 'Before the annual form',
    title: 'Review records and close gaps',
    body: 'Give university leaders one export of completed work, open items and the records behind the attestation.',
  },
];

const fourYearFlow = [
  {
    label: 'Set the scope',
    title: 'See every area the review must cover',
    body: 'A guided checklist organizes mental health, physical health, safety and performance services, then assigns an owner and due date to each area.',
    icon: ClipboardCheck,
  },
  {
    label: 'Bring records together',
    title: 'Build one evidence library',
    body: 'Annual records already in PulseCheck and AuntEdna.ai carry forward. Other university records can be uploaded or linked to the same review workspace.',
    icon: FileText,
  },
  {
    label: 'Find the gaps',
    title: 'Know what still needs attention',
    body: 'The workspace flags missing owners, incomplete records, expired plans and open follow-up before university leaders begin their review.',
    icon: Radar,
  },
  {
    label: 'Prepare the review',
    title: 'Export an organized review package',
    body: 'Leaders receive a status summary, evidence index, open-action list and supporting records organized by review area.',
    icon: Download,
  },
];

const detectionLanes = [
  {
    label: 'Performance',
    title: 'Keep training',
    body: 'A normal performance need becomes the next sport-specific lesson, game, simulation or recovery exercise.',
    owner: 'PulseCheck',
    icon: Brain,
  },
  {
    label: 'Support',
    title: 'Bring in a person',
    body: 'Repeated low-readiness patterns raise staff visibility, lower training intensity and create a human follow-up action.',
    owner: 'PulseCheck + university staff + AuntEdna.ai',
    icon: UserCheck,
  },
  {
    label: 'Clinical',
    title: 'Move into licensed care',
    body: 'An elevated concern pauses normal training. With athlete consent, the minimum needed context moves to AuntEdna.ai, where clinical staff review it and choose the next step.',
    owner: 'PulseCheck + AuntEdna.ai',
    icon: Stethoscope,
  },
  {
    label: 'Critical safety',
    title: 'Act now',
    body: 'A critical safety concern activates the immediate response path, blocks normal training and keeps protection active until clinical staff clear it.',
    owner: 'Immediate safety pathway',
    icon: Siren,
  },
];

const NcaaCompliancePage: NextPage = () => {
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!showReport) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowReport(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [showReport]);

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'ncaa-compliance',
          pageTitle: PAGE_TITLE,
          metaDescription: PAGE_DESCRIPTION,
          ogTitle: PAGE_TITLE,
          ogDescription: PAGE_DESCRIPTION,
          ogImage: PAGE_OG_IMAGE,
          ogUrl: PAGE_URL,
          ogType: 'website',
          twitterCard: 'summary_large_image',
          twitterTitle: PAGE_TITLE,
          twitterDescription: PAGE_DESCRIPTION,
          twitterImage: PAGE_OG_IMAGE,
          lastUpdated: '2026-08-14T00:00:00.000Z',
        }}
        pageOgUrl={PAGE_URL}
        themeColor="#101716"
      />

      <main className="compliance-page">
        <header className="site-header">
          <a href="/PIL" className="brand" aria-label="Pulse Intelligence Labs home">
            <img src="/pulse-logo-green.svg" alt="" />
            <span>Pulse Intelligence Labs</span>
          </a>
          <nav aria-label="Page navigation">
            <a href="#requirements">Requirements</a>
            <a href="#early-detection">Early detection</a>
            <a href="#four-year-review">Four-year review</a>
          </nav>
          <a className="header-action" href="mailto:tre@pulseintelligencelabs.com?subject=University%20Compliance%20Walkthrough">
            Schedule walkthrough <ArrowRight size={16} />
          </a>
        </header>

        <section className="hero" id="overview">
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="eyebrow">NCAA mental-health compliance</p>
            <h1>NCAA mental-health compliance, made easier to manage.</h1>
            <p className="hero-summary">
              PulseCheck and AuntEdna.ai connect athlete education, annual screening, early detection, licensed care
              and documentation in one clear university process.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="mailto:tre@pulseintelligencelabs.com?subject=University%20Compliance%20Walkthrough">
                Schedule walkthrough <ArrowRight size={17} />
              </a>
              <a href="#requirements" className="button button-secondary">
                View compliance map <ArrowRight size={17} />
              </a>
            </div>
          </div>
          <div className="hero-facts" aria-label="NCAA compliance dates and scope">
            <article>
              <GraduationCap size={20} />
              <div>
                <span>Who this applies to</span>
                <strong>Division I and schools with a Division I sport</strong>
              </div>
            </article>
            <article>
              <CalendarDays size={20} />
              <div>
                <span>Annual attestation due</span>
                <strong>November 6, 2026</strong>
              </div>
            </article>
            <article>
              <ClipboardCheck size={20} />
              <div>
                <span>Four-year review due</span>
                <strong>November 3, 2028</strong>
              </div>
            </article>
          </div>
        </section>

        <section className="accountability-band" aria-labelledby="accountability-title">
          <div className="band-heading">
            <p className="eyebrow dark">The problem</p>
            <h2 id="accountability-title">Three leaders sign. The work lives across the university.</h2>
          </div>
          <div className="signer-list">
            <article>
              <Building2 size={22} />
              <span>President or chancellor</span>
            </article>
            <article>
              <UsersRound size={22} />
              <span>Director of athletics</span>
            </article>
            <article>
              <UserCheck size={22} />
              <span>Campus athletics health care administrator</span>
            </article>
          </div>
          <p className="band-note">
            These leaders need one clear view of education, screening, response plans, clinical care and follow-up.
            PulseCheck and AuntEdna.ai connect work that would otherwise be spread across athletics, sports medicine,
            counseling and outside providers.
          </p>
        </section>

        <section className="requirements-section" id="requirements">
          <div className="section-intro">
            <p className="eyebrow dark">The plan</p>
            <h2>See every requirement, who handles it and what proves it happened.</h2>
            <p>
              Each row shows what the NCAA expects, what the university sets, what PulseCheck runs, what AuntEdna.ai
              handles and what record leaders can review.
            </p>
          </div>

          <div className="map-key" aria-hidden="true">
            <span>University responsibility</span>
            <span>PulseCheck</span>
            <span>AuntEdna.ai</span>
            <span>Review record</span>
          </div>

          <div className="requirement-list">
            {requirements.map((requirement) => (
              <article className="requirement" id={requirement.id} key={requirement.id}>
                <header>
                  <span className="requirement-number">{requirement.number}</span>
                  <div>
                    <p>{requirement.source}</p>
                    <h3>{requirement.title}</h3>
                  </div>
                </header>
                <div className="requirement-columns">
                  <div data-label="University responsibility">
                    <Building2 size={20} />
                    <p>{requirement.school}</p>
                  </div>
                  <div data-label="PulseCheck">
                    <ShieldCheck size={20} />
                    <p>{requirement.pulse}</p>
                  </div>
                  <div data-label="AuntEdna.ai">
                    <Stethoscope size={20} />
                    <p>{requirement.clinical}</p>
                  </div>
                  <div className="record-output" data-label="Review record">
                    <FileText size={20} />
                    <strong>{requirement.record}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="detection-section" id="early-detection" aria-labelledby="detection-title">
          <div className="detection-heading">
            <div>
              <p className="eyebrow dark">Between annual screens</p>
              <h2 id="detection-title">One annual screen cannot see the other 364 days.</h2>
            </div>
            <p>
              PulseCheck stays close to the athlete through daily performance training. It can notice a change across
              check-ins, Nora conversations, training behavior, recent performance and permitted health data, then
              move that concern into the right response path.
            </p>
          </div>

          <div className="detection-system">
            <div className="signal-side">
              <figure className="signal-phone">
                <img src="/pulsecheck-media/full/01-today-checkin.png" alt="PulseCheck daily athlete check-in" />
              </figure>
              <div className="signal-list">
                <span><Activity size={18} /> Daily check-ins</span>
                <span><Brain size={18} /> Nora conversations</span>
                <span><Route size={18} /> Training behavior</span>
                <span><Radar size={18} /> Performance and health context</span>
              </div>
            </div>

            <div className="signal-engine" aria-label="PulseCheck early-detection engine">
              <Radar size={30} />
              <span>PulseCheck early detection</span>
              <strong>Notice the change. Choose the right response.</strong>
              <small>Safety rules always outrank performance programming.</small>
            </div>

            <div className="detection-lanes">
              {detectionLanes.map((lane, index) => {
                const Icon = lane.icon;
                return (
                  <article key={lane.label} className={`detection-lane lane-${index + 1}`}>
                    <div className="lane-icon"><Icon size={20} /></div>
                    <div>
                      <p>{lane.label}</p>
                      <h3>{lane.title}</h3>
                      <span>{lane.body}</span>
                      <small>{lane.owner}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="detection-boundary">
            <ShieldCheck size={21} />
            <p>
              Early detection does not diagnose an athlete and does not replace the annual validated screen. It helps
              the university notice patterns between screens, act on defined concerns and show what happened next.
            </p>
          </div>
        </section>

        <section className="journey-section" id="journey">
          <div className="journey-copy">
            <p className="eyebrow">Clinician-controlled care</p>
            <h2>PulseCheck raises the concern. Clinical staff control what happens next.</h2>
            <p>
              When a concern becomes clinical, AuntEdna.ai gives medical staff one place to review the handoff, assign
              a provider, choose the next action, document follow-up and control training status. PulseCheck receives
              only the limited status needed to keep the athlete&apos;s experience safe.
            </p>
            <div className="journey-steps">
              <article>
                <span>1</span>
                <div><strong>The athlete trains, checks in or talks with Nora</strong><p>Everyday athlete experience</p></div>
              </article>
              <article>
                <span>2</span>
                <div><strong>PulseCheck notices the change and chooses the response lane</strong><p>Performance, support, clinical or critical safety</p></div>
              </article>
              <article>
                <span>3</span>
                <div><strong>AuntEdna.ai creates and routes the clinical case</strong><p>Clinical staff review the context, assign an owner and choose the next action</p></div>
              </article>
              <article>
                <span>4</span>
                <div><strong>The clinician controls follow-up and training status</strong><p>Care records stay in AuntEdna.ai; PulseCheck receives approved status only</p></div>
              </article>
            </div>
          </div>
          <div className="journey-visual" aria-label="PulseCheck to AuntEdna.ai support flow">
            <figure className="phone-shot primary-phone">
              <img src="/pulsecheck-media/full/10-welfare-check.png" alt="PulseCheck urgent welfare check screen" />
            </figure>
            <div className="clinical-mark">
              <img src="/auntedna-mark.png" alt="AuntEdna.ai" />
              <span>Clinician-controlled workspace</span>
            </div>
            <div className="status-panel">
              <span>Clinical work queue</span>
              <strong>Review assigned</strong>
              <small>Next action due today</small>
            </div>
          </div>
        </section>

        <section className="year-section" aria-labelledby="year-title">
          <div className="section-intro compact">
            <p className="eyebrow dark">The year-round plan</p>
            <h2 id="year-title">Run the work as it happens. Review the record before leaders sign.</h2>
          </div>
          <div className="annual-flow">
            {annualFlow.map((step, index) => (
              <article key={step.label}>
                <div className="flow-marker"><span>{index + 1}</span></div>
                <p>{step.label}</p>
                <h3>{step.title}</h3>
                <span>{step.body}</span>
              </article>
            ))}
          </div>
          <div className="deadline-row">
            <article>
              <CalendarDays size={24} />
              <div><span>Annual attestation</span><strong>Due November 6, 2026</strong></div>
            </article>
            <ArrowRight size={24} aria-hidden="true" />
            <article>
              <ClipboardCheck size={24} />
              <div><span>Broader four-year review</span><strong>Due November 3, 2028</strong></div>
            </article>
            <p>
              This page maps the mental-health portion. The broader four-year review also covers physical health,
              safety and performance services across the institution.
            </p>
          </div>
        </section>

        <section className="four-year-section" id="four-year-review" aria-labelledby="four-year-title">
          <div className="four-year-heading">
            <div>
              <p className="eyebrow dark">NCAA Bylaw 20.2.4.23 · Comprehensive institutional review</p>
              <h2 id="four-year-title">
                Every four years, the NCAA requires your university to review its full athlete health, safety and
                performance system.
              </h2>
            </div>
            <div className="four-year-intro">
              <span><CalendarDays size={18} /> Due November 3, 2028</span>
              <p>
                This is separate from the annual attestation. The university completes the broader review, then its
                president or chancellor, athletics director and campus athletics health care administrator confirm it
                was completed. PulseCheck and AuntEdna.ai keep the mental-health evidence organized year after year.
              </p>
            </div>
          </div>

          <div className="review-comparison" aria-label="Annual attestation compared with the four-year comprehensive review">
            <article>
              <span>Every year</span>
              <strong>Annual attestation</strong>
              <p>Confirm that care, education and services follow NCAA consensus-based guidance.</p>
            </article>
            <div className="comparison-arrow" aria-hidden="true">
              <ArrowRight size={22} />
              <span>Broader scope</span>
            </div>
            <article>
              <span>At least every four years</span>
              <strong>Comprehensive institutional review</strong>
              <p>Examine mental and physical health, safety and performance support services across the university.</p>
            </article>
          </div>

          <div className="four-year-flow">
            {fourYearFlow.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.label}>
                  <div className="four-year-step-top">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <Icon size={22} />
                  </div>
                  <p>{step.label}</p>
                  <h3>{step.title}</h3>
                  <div>{step.body}</div>
                </article>
              );
            })}
          </div>

          <div className="four-year-output">
            <div>
              <ShieldCheck size={24} />
              <span>What PulseCheck + AuntEdna.ai make ready</span>
            </div>
            <strong>Mental-health evidence, clinical records, assigned actions and review status</strong>
            <p>
              University teams can add physical-health, safety and performance-service records to the same
              comprehensive review workspace.
            </p>
          </div>
        </section>

        <section className="records-section" id="records">
          <div className="records-copy">
            <p className="eyebrow">The result</p>
            <h2>Walk into the annual review knowing what is ready.</h2>
            <p>
              Instead of searching across email, spreadsheets and separate departments, the university gets one
              review-ready view of responsibilities, completed work and open gaps.
            </p>
            <ul>
              <li><Check size={17} /> Sport-specific curriculum delivery and completion</li>
              <li><Check size={17} /> Annual screening, daily signal monitoring and documented provider review</li>
              <li><Check size={17} /> Early-detection alerts, assigned actions and response drills</li>
              <li><Check size={17} /> Clinical work queue, case owner, follow-up and care status</li>
            </ul>
            <div className="records-actions">
              <button type="button" className="button button-primary" onClick={() => setShowReport(true)}>
                <FileText size={17} /> Preview sample report
              </button>
              <a className="button button-outline" href="/sample-ncaa-mental-health-readiness-report.csv" download>
                <Download size={17} /> Export sample CSV
              </a>
            </div>
          </div>

          <div className="workspace-preview" aria-label="Sample NCAA mental health readiness dashboard">
            <header>
              <div>
                <span>2026 mental-health readiness</span>
                <strong>4 of 6 areas ready</strong>
              </div>
              <div className="progress-ring" aria-label="67 percent ready">67%</div>
            </header>
            <div className="workspace-summary">
              <span><CheckCircle2 size={17} /> 4 ready</span>
              <span><Clock3 size={17} /> 2 need review</span>
              <span><FileText size={17} /> 18 records</span>
            </div>
            <div className="workspace-rows">
              {readinessItems.map((item) => (
                <article key={item.requirement}>
                  <div>
                    <strong>{item.requirement}</strong>
                    <span>{item.owner}</span>
                  </div>
                  <span className={item.status === 'Ready' ? 'status ready' : 'status review'}>{item.status}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="confidence-section" aria-labelledby="confidence-title">
          <div className="section-intro compact">
            <p className="eyebrow dark">Clear responsibilities</p>
            <h2 id="confidence-title">One connected process. Different roles stay protected.</h2>
          </div>
          <div className="confidence-grid">
            <article>
              <HeartHandshake size={24} />
              <h3>Everyday athlete use</h3>
              <p>Performance training creates regular contact, so the system can notice changes without making every check-in a clinical record.</p>
            </article>
            <article>
              <LockKeyhole size={24} />
              <h3>Limited staff access</h3>
              <p>University staff see the actions and follow-up status they need, not private clinical notes.</p>
            </article>
            <article>
              <Stethoscope size={24} />
              <h3>Clinical authority</h3>
              <p>Clinical staff choose the screen, review results, document actions, manage care and control return-to-training in AuntEdna.ai.</p>
            </article>
            <article>
              <Download size={24} />
              <h3>Exportable records</h3>
              <p>Leaders can review and export education, screening, response, handoff and follow-up records from one place.</p>
            </article>
          </div>
        </section>

        <section className="closing-section">
          <div>
            <p className="eyebrow">Your next step</p>
            <h2>Make mental-health compliance easier to run this year.</h2>
            <p>
              See how PulseCheck and AuntEdna.ai map your current university process, close operating gaps and prepare
              the mental-health record for annual and four-year review.
            </p>
          </div>
          <a className="button button-primary" href="mailto:tre@pulseintelligencelabs.com?subject=University%20Compliance%20Walkthrough">
            Schedule a compliance walkthrough <ArrowRight size={17} />
          </a>
        </section>

        <section className="sources-section" id="sources">
          <div>
            <h2>Official NCAA sources</h2>
            <p>This page focuses on the mental-health portion of the NCAA health, safety and performance guidance.</p>
          </div>
          <div className="source-links">
            <a href="https://www.ncaa.org/governance/legislation-policy/membership-attestation-requirements/" target="_blank" rel="noreferrer">
              Membership attestation requirements <ExternalLink size={15} />
            </a>
            <a href="https://www.ncaa.org/what-we-do/health-safety-and-performance/mental-health/best-practices/" target="_blank" rel="noreferrer">
              Mental Health Best Practices <ExternalLink size={15} />
            </a>
            <a href="https://ncaaorg.s3.amazonaws.com/ssi/mental/SSI_MentalHealthBestPracticesChecklist.pdf" target="_blank" rel="noreferrer">
              Mental Health Best Practices Checklist <ExternalLink size={15} />
            </a>
            <a href="https://web3.ncaa.org/lsdbi/reports/getReport/90010" target="_blank" rel="noreferrer">
              NCAA Manual, Bylaw 16.4.1 <ExternalLink size={15} />
            </a>
          </div>
          <p className="legal-note">
            PulseCheck and AuntEdna.ai support implementation and documentation. They do not replace university
            policy, legal review, emergency procedures, the complete four-year institutional review or independent
            decisions made by licensed providers.
          </p>
        </section>

        <footer className="page-footer">
          <a href="/PIL" className="brand" aria-label="Pulse Intelligence Labs home">
            <img src="/pulse-logo-green.svg" alt="" />
            <span>Pulse Intelligence Labs</span>
          </a>
          <span>PulseCheck + AuntEdna.ai</span>
          <span>© 2026 Pulse Intelligence Labs, Inc.</span>
        </footer>

        {showReport ? (
          <div className="report-layer" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <button type="button" className="report-backdrop" aria-label="Close report" onClick={() => setShowReport(false)} />
            <section className="report-panel">
              <header className="report-toolbar">
                <div>
                  <span>Sample university report</span>
                  <strong id="report-title">NCAA mental-health readiness</strong>
                </div>
                <div>
                  <a href="/sample-ncaa-mental-health-readiness-report.csv" download><Download size={18} /> Export CSV</a>
                  <button type="button" onClick={() => window.print()}><Printer size={18} /> Print / save PDF</button>
                  <button type="button" className="icon-button" aria-label="Close report" onClick={() => setShowReport(false)}><X size={20} /></button>
                </div>
              </header>
              <div className="report-body">
                <div className="report-title-block">
                  <div>
                    <p>Example University Athletics</p>
                    <h2>2026 Mental-Health Readiness Report</h2>
                    <span>Prepared for annual NCAA attestation review</span>
                  </div>
                  <div className="report-score"><strong>4/6</strong><span>areas ready</span></div>
                </div>
                <div className="report-meta">
                  <span><strong>Annual due date</strong> Nov. 6, 2026</span>
                  <span><strong>Four-year review</strong> Nov. 3, 2028</span>
                  <span><strong>Open actions</strong> 2</span>
                </div>
                <div className="report-table" role="table" aria-label="Sample readiness report details">
                  <div className="report-row report-heading" role="row">
                    <span>Requirement</span><span>Owner</span><span>Status</span><span>Latest record</span>
                  </div>
                  {readinessItems.map((item) => (
                    <div className="report-row" role="row" key={item.requirement}>
                      <strong>{item.requirement}</strong>
                      <span>{item.owner}</span>
                      <span className={item.status === 'Ready' ? 'status ready' : 'status review'}>{item.status}</span>
                      <span>{item.record}</span>
                    </div>
                  ))}
                </div>
                <div className="report-boundary">
                  <ShieldCheck size={22} />
                  <p>
                    This readiness report supports university review. It does not certify NCAA compliance and does
                    not include private clinical notes or replace licensed-provider judgment.
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <style jsx>{`
          .compliance-page {
            --ink: #111816;
            --ink-soft: #1c2925;
            --paper: #f5f3ed;
            --paper-deep: #e7e2d8;
            --white: #ffffff;
            --green: #d8ff52;
            --teal: #3ec7b4;
            --coral: #e66f51;
            --gold: #d9a83e;
            --muted: #5d6964;
            --line: rgba(17, 24, 22, .15);
            min-height: 100vh;
            overflow-x: hidden;
            color: var(--ink);
            background: var(--paper);
            font-family: 'DM Sans', Arial, sans-serif;
          }

          .compliance-page * {
            box-sizing: border-box;
            letter-spacing: 0;
          }

          .site-header {
            position: sticky;
            top: 0;
            z-index: 50;
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            min-height: 68px;
            padding: 0 48px;
            color: var(--white);
            background: rgba(17, 24, 22, .96);
            border-bottom: 1px solid rgba(255, 255, 255, .12);
            backdrop-filter: blur(14px);
          }

          .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            width: max-content;
            color: inherit;
            text-decoration: none;
            font-size: 14px;
            font-weight: 800;
          }

          .brand img {
            width: 26px;
            height: 26px;
          }

          .site-header nav {
            display: flex;
            align-items: center;
            gap: 28px;
          }

          .site-header nav a {
            color: rgba(255, 255, 255, .72);
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
          }

          .site-header nav a:hover,
          .site-header nav a:focus-visible {
            color: var(--white);
          }

          .header-action {
            justify-self: end;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: var(--ink);
            background: var(--green);
            padding: 11px 14px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 900;
            border-radius: 4px;
          }

          .hero {
            position: relative;
            display: flex;
            align-items: center;
            height: calc(100svh - 160px);
            min-height: 580px;
            max-height: 700px;
            padding: 54px 64px 118px;
            overflow: hidden;
            color: var(--white);
            background: #101716 url('/pulsecheck-pro/team-conversation.webp') center 42% / cover no-repeat;
          }

          .hero-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, rgba(10, 16, 14, .97) 0%, rgba(10, 16, 14, .88) 44%, rgba(10, 16, 14, .38) 72%, rgba(10, 16, 14, .2) 100%);
          }

          .hero-content {
            position: relative;
            z-index: 2;
            max-width: 760px;
          }

          .eyebrow {
            margin: 0 0 14px;
            color: var(--green);
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .eyebrow.dark {
            color: #41675e;
          }

          .hero h1 {
            max-width: 760px;
            margin: 0;
            font-size: 62px;
            line-height: 1.03;
            font-weight: 750;
          }

          .hero-summary {
            max-width: 700px;
            margin: 20px 0 0;
            color: rgba(255, 255, 255, .9);
            font-size: 20px;
            line-height: 1.5;
          }

          .hero-boundary {
            max-width: 700px;
            margin: 8px 0 0;
            color: rgba(255, 255, 255, .66);
            font-size: 16px;
            line-height: 1.5;
          }

          .hero-actions,
          .records-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 24px;
          }

          .button {
            min-height: 48px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            padding: 0 18px;
            border: 1px solid transparent;
            border-radius: 4px;
            font: inherit;
            font-size: 14px;
            font-weight: 900;
            text-decoration: none;
            cursor: pointer;
          }

          .button-primary {
            color: var(--ink);
            background: var(--green);
          }

          .button-secondary {
            color: var(--white);
            background: rgba(17, 24, 22, .6);
            border-color: rgba(255, 255, 255, .38);
          }

          .button-outline {
            color: var(--ink);
            background: transparent;
            border-color: rgba(17, 24, 22, .35);
          }

          .hero-facts {
            position: absolute;
            z-index: 3;
            right: 48px;
            bottom: 0;
            left: 48px;
            display: grid;
            grid-template-columns: 1.35fr 1fr 1fr;
            background: rgba(17, 24, 22, .94);
            border: 1px solid rgba(255, 255, 255, .18);
            border-bottom: 0;
            border-radius: 8px 8px 0 0;
          }

          .hero-facts article {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 14px;
            min-height: 88px;
            padding: 18px 22px;
            border-right: 1px solid rgba(255, 255, 255, .14);
          }

          .hero-facts article:last-child {
            border-right: 0;
          }

          .hero-facts svg {
            flex: 0 0 auto;
            color: var(--green);
          }

          .hero-facts div {
            min-width: 0;
          }

          .hero-facts span,
          .hero-facts strong {
            display: block;
          }

          .hero-facts span {
            margin-bottom: 4px;
            color: rgba(255, 255, 255, .58);
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .hero-facts strong {
            color: var(--white);
            font-size: 15px;
            line-height: 1.35;
          }

          .accountability-band,
          .requirements-section,
          .detection-section,
          .year-section,
          .four-year-section,
          .confidence-section,
          .sources-section {
            padding-right: 64px;
            padding-left: 64px;
          }

          .accountability-band {
            display: grid;
            grid-template-columns: 1.05fr 1.5fr;
            gap: 42px 70px;
            padding-top: 76px;
            padding-bottom: 76px;
            background: var(--paper);
            border-bottom: 1px solid var(--line);
          }

          .band-heading h2,
          .section-intro h2,
          .detection-heading h2,
          .journey-copy h2,
          .four-year-heading h2,
          .records-copy h2,
          .closing-section h2 {
            margin: 0;
            font-size: 48px;
            line-height: 1.08;
          }

          .signer-list {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            border: 1px solid var(--line);
            border-radius: 8px;
          }

          .signer-list article {
            min-height: 130px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 24px;
            padding: 22px;
            border-right: 1px solid var(--line);
          }

          .signer-list article:last-child {
            border-right: 0;
          }

          .signer-list svg {
            color: #41675e;
          }

          .signer-list span {
            font-size: 15px;
            font-weight: 800;
            line-height: 1.35;
          }

          .band-note {
            grid-column: 1 / -1;
            max-width: 920px;
            margin: 0;
            color: var(--muted);
            font-size: 17px;
            line-height: 1.65;
          }

          .requirements-section {
            padding-top: 108px;
            padding-bottom: 116px;
            background: #ece8df;
          }

          .section-intro {
            display: grid;
            grid-template-columns: 1.15fr .85fr;
            gap: 18px 72px;
            align-items: end;
            margin-bottom: 54px;
          }

          .section-intro .eyebrow {
            grid-column: 1 / -1;
            margin-bottom: 0;
          }

          .section-intro > p:not(.eyebrow) {
            margin: 0;
            color: var(--muted);
            font-size: 17px;
            line-height: 1.6;
          }

          .section-intro.compact {
            display: block;
            max-width: 900px;
          }

          .map-key {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            margin-left: 300px;
            border: 1px solid var(--line);
            border-bottom: 0;
            background: rgba(255, 255, 255, .45);
          }

          .map-key span {
            padding: 13px 16px;
            color: var(--muted);
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            border-right: 1px solid var(--line);
          }

          .map-key span:last-child {
            border-right: 0;
          }

          .requirement-list {
            border-top: 1px solid var(--ink);
          }

          .requirement {
            display: grid;
            grid-template-columns: 300px minmax(0, 1fr);
            border-bottom: 1px solid var(--ink);
          }

          .requirement > header {
            display: grid;
            grid-template-columns: 46px 1fr;
            gap: 16px;
            align-content: start;
            padding: 26px 26px 26px 0;
          }

          .requirement-number {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            color: var(--ink);
            background: var(--green);
            border-radius: 50%;
            font-size: 12px;
            font-weight: 900;
          }

          .requirement header p {
            margin: 1px 0 7px;
            color: #527068;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .requirement h3 {
            margin: 0;
            font-size: 24px;
            line-height: 1.15;
          }

          .requirement-columns {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .requirement-columns > div {
            min-width: 0;
            min-height: 210px;
            padding: 26px 18px;
            border-left: 1px solid var(--line);
          }

          .requirement-columns svg {
            margin-bottom: 18px;
            color: #41675e;
          }

          .requirement-columns > div:nth-child(2) svg {
            color: #447d1f;
          }

          .requirement-columns > div:nth-child(3) svg {
            color: #77547b;
          }

          .requirement-columns p,
          .requirement-columns strong {
            margin: 0;
            font-size: 14px;
            line-height: 1.58;
          }

          .record-output {
            background: rgba(255, 255, 255, .52);
          }

          .record-output strong {
            display: block;
          }

          .detection-section {
            padding-top: 112px;
            padding-bottom: 112px;
            background: #f7f5ef;
          }

          .detection-heading {
            display: grid;
            grid-template-columns: 1.15fr .85fr;
            gap: 72px;
            align-items: end;
          }

          .detection-heading h2 {
            max-width: 760px;
            margin: 0;
            font-size: 52px;
            line-height: 1.07;
          }

          .detection-heading > p {
            margin: 0;
            color: var(--muted);
            font-size: 17px;
            line-height: 1.65;
          }

          .detection-system {
            display: grid;
            grid-template-columns: minmax(250px, .8fr) minmax(190px, .55fr) minmax(420px, 1.35fr);
            gap: 24px;
            align-items: center;
            margin-top: 62px;
            padding: 34px;
            color: var(--white);
            background: var(--ink);
            border-radius: 8px;
          }

          .signal-side {
            display: grid;
            grid-template-columns: 132px 1fr;
            gap: 18px;
            align-items: center;
            min-width: 0;
          }

          .signal-phone {
            width: 132px;
            height: 268px;
            margin: 0;
            overflow: hidden;
            background: #060908;
            border: 5px solid #323a37;
            border-radius: 22px;
            box-shadow: 0 18px 42px rgba(0, 0, 0, .3);
          }

          .signal-phone img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: top;
          }

          .signal-list {
            display: grid;
            gap: 4px;
          }

          .signal-list span {
            display: flex;
            align-items: center;
            gap: 9px;
            min-height: 48px;
            padding: 9px 0;
            color: rgba(255, 255, 255, .78);
            border-bottom: 1px solid rgba(255, 255, 255, .13);
            font-size: 12px;
            font-weight: 800;
            line-height: 1.3;
          }

          .signal-list span:last-child {
            border-bottom: 0;
          }

          .signal-list svg {
            flex: 0 0 auto;
            color: var(--teal);
          }

          .signal-engine {
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 230px;
            padding: 24px;
            background: #26332f;
            border: 1px solid rgba(216, 255, 82, .34);
            border-radius: 8px;
          }

          .signal-engine::before,
          .signal-engine::after {
            position: absolute;
            top: 50%;
            width: 24px;
            height: 1px;
            background: rgba(216, 255, 82, .55);
            content: '';
          }

          .signal-engine::before {
            left: -25px;
          }

          .signal-engine::after {
            right: -25px;
          }

          .signal-engine svg {
            color: var(--green);
          }

          .signal-engine span,
          .signal-engine strong,
          .signal-engine small {
            display: block;
          }

          .signal-engine span {
            margin-top: 22px;
            color: var(--green);
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .signal-engine strong {
            margin-top: 7px;
            font-size: 20px;
            line-height: 1.25;
          }

          .signal-engine small {
            margin-top: 18px;
            color: rgba(255, 255, 255, .58);
            font-size: 11px;
            line-height: 1.5;
          }

          .detection-lanes {
            display: grid;
            gap: 8px;
          }

          .detection-lane {
            display: grid;
            grid-template-columns: 38px 1fr;
            gap: 14px;
            min-width: 0;
            padding: 15px 16px;
            background: rgba(255, 255, 255, .06);
            border-left: 3px solid var(--teal);
          }

          .detection-lane.lane-2 {
            border-left-color: var(--gold);
          }

          .detection-lane.lane-3 {
            border-left-color: #b79bd0;
          }

          .detection-lane.lane-4 {
            border-left-color: var(--coral);
          }

          .lane-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            color: var(--ink);
            background: var(--teal);
            border-radius: 50%;
          }

          .lane-2 .lane-icon {
            background: var(--gold);
          }

          .lane-3 .lane-icon {
            background: #b79bd0;
          }

          .lane-4 .lane-icon {
            background: var(--coral);
          }

          .detection-lane p,
          .detection-lane h3,
          .detection-lane span,
          .detection-lane small {
            display: block;
            margin: 0;
          }

          .detection-lane p {
            color: rgba(255, 255, 255, .5);
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .detection-lane h3 {
            margin-top: 3px;
            font-size: 17px;
          }

          .detection-lane span {
            margin-top: 6px;
            color: rgba(255, 255, 255, .68);
            font-size: 12px;
            line-height: 1.45;
          }

          .detection-lane small {
            margin-top: 7px;
            color: var(--green);
            font-size: 10px;
            font-weight: 800;
          }

          .detection-boundary {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-top: 18px;
            padding: 18px 20px;
            color: var(--muted);
            background: #e9eee8;
            border-left: 4px solid #41675e;
          }

          .detection-boundary svg {
            flex: 0 0 auto;
            color: #41675e;
          }

          .detection-boundary p {
            margin: 0;
            font-size: 13px;
            line-height: 1.55;
          }

          .journey-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 88px;
            align-items: center;
            padding: 112px 64px;
            color: var(--white);
            background: var(--ink);
          }

          .journey-copy > p:not(.eyebrow) {
            max-width: 650px;
            margin: 22px 0 0;
            color: rgba(255, 255, 255, .68);
            font-size: 17px;
            line-height: 1.65;
          }

          .journey-steps {
            margin-top: 42px;
            border-top: 1px solid rgba(255, 255, 255, .2);
          }

          .journey-steps article {
            display: grid;
            grid-template-columns: 34px 1fr;
            gap: 16px;
            padding: 18px 0;
            border-bottom: 1px solid rgba(255, 255, 255, .2);
          }

          .journey-steps article > span {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            color: var(--ink);
            background: var(--green);
            border-radius: 50%;
            font-size: 12px;
            font-weight: 900;
          }

          .journey-steps strong,
          .journey-steps p {
            display: block;
            margin: 0;
          }

          .journey-steps strong {
            font-size: 16px;
            line-height: 1.4;
          }

          .journey-steps p {
            margin-top: 3px;
            color: var(--teal);
            font-size: 12px;
            font-weight: 800;
          }

          .journey-visual {
            position: relative;
            min-height: 650px;
          }

          .phone-shot {
            position: absolute;
            top: 0;
            left: 50%;
            width: 306px;
            height: 620px;
            margin: 0;
            overflow: hidden;
            transform: translateX(-64%);
            background: #050706;
            border: 8px solid #252b29;
            border-radius: 42px;
            box-shadow: 0 28px 70px rgba(0, 0, 0, .36);
          }

          .phone-shot img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: top;
          }

          .clinical-mark,
          .status-panel {
            position: absolute;
            right: 0;
            width: 250px;
            padding: 20px;
            background: #252321;
            border: 1px solid rgba(255, 255, 255, .18);
            border-radius: 8px;
            box-shadow: 0 18px 50px rgba(0, 0, 0, .28);
          }

          .clinical-mark {
            top: 170px;
          }

          .clinical-mark img {
            width: 54px;
            height: 54px;
            object-fit: contain;
          }

          .clinical-mark span,
          .status-panel span,
          .status-panel strong,
          .status-panel small {
            display: block;
          }

          .clinical-mark span {
            margin-top: 18px;
            font-size: 14px;
            font-weight: 900;
          }

          .status-panel {
            top: 350px;
            border-left: 4px solid var(--teal);
          }

          .status-panel span {
            color: rgba(255, 255, 255, .55);
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .status-panel strong {
            margin-top: 9px;
            font-size: 20px;
          }

          .status-panel small {
            margin-top: 18px;
            color: var(--teal);
            font-size: 12px;
          }

          .year-section {
            padding-top: 110px;
            padding-bottom: 110px;
            background: var(--paper);
          }

          .annual-flow {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            margin-top: 54px;
            border-top: 1px solid var(--ink);
            border-bottom: 1px solid var(--ink);
          }

          .annual-flow article {
            min-height: 300px;
            padding: 26px;
            border-right: 1px solid var(--line);
          }

          .annual-flow article:last-child {
            border-right: 0;
          }

          .flow-marker span {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            color: var(--ink);
            background: var(--green);
            border-radius: 50%;
            font-size: 12px;
            font-weight: 900;
          }

          .annual-flow article > p {
            margin: 44px 0 9px;
            color: #527068;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .annual-flow h3 {
            margin: 0 0 14px;
            font-size: 23px;
            line-height: 1.2;
          }

          .annual-flow article > span {
            color: var(--muted);
            font-size: 14px;
            line-height: 1.6;
          }

          .deadline-row {
            display: grid;
            grid-template-columns: auto 28px auto 1fr;
            gap: 24px;
            align-items: center;
            margin-top: 34px;
            padding: 24px;
            color: var(--white);
            background: var(--ink);
            border-radius: 8px;
          }

          .deadline-row article {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .deadline-row article > svg {
            color: var(--green);
          }

          .deadline-row span,
          .deadline-row strong {
            display: block;
          }

          .deadline-row span {
            color: rgba(255, 255, 255, .55);
            font-size: 11px;
            text-transform: uppercase;
          }

          .deadline-row strong {
            margin-top: 3px;
            font-size: 15px;
          }

          .deadline-row > p {
            margin: 0;
            padding-left: 24px;
            color: rgba(255, 255, 255, .68);
            border-left: 1px solid rgba(255, 255, 255, .18);
            font-size: 13px;
            line-height: 1.55;
          }

          .four-year-section {
            padding-top: 112px;
            padding-bottom: 112px;
            background: #dfe8e2;
            border-top: 1px solid var(--line);
          }

          .four-year-heading {
            display: grid;
            grid-template-columns: 1.1fr .9fr;
            gap: 86px;
            align-items: end;
          }

          .four-year-intro > span {
            display: flex;
            align-items: center;
            gap: 10px;
            padding-bottom: 14px;
            color: #355c53;
            border-bottom: 1px solid rgba(17, 24, 22, .24);
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .four-year-intro p {
            margin: 18px 0 0;
            color: #465650;
            font-size: 16px;
            line-height: 1.65;
          }

          .review-comparison {
            display: grid;
            grid-template-columns: 1fr 120px 1.25fr;
            margin-top: 48px;
            border-top: 1px solid var(--ink);
            border-bottom: 1px solid var(--ink);
          }

          .review-comparison article {
            min-height: 172px;
            padding: 24px 26px;
          }

          .review-comparison article:last-child {
            background: rgba(216, 255, 82, .25);
          }

          .review-comparison article > span,
          .review-comparison article > strong {
            display: block;
          }

          .review-comparison article > span {
            color: #527068;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .review-comparison article > strong {
            margin-top: 10px;
            font-size: 22px;
            line-height: 1.25;
          }

          .review-comparison article > p {
            margin: 12px 0 0;
            color: #52605b;
            font-size: 14px;
            line-height: 1.55;
          }

          .comparison-arrow {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 10px;
            color: var(--green);
            background: var(--ink);
          }

          .comparison-arrow span {
            color: rgba(255, 255, 255, .62);
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .four-year-flow {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            margin-top: 42px;
            border-top: 1px solid var(--ink);
            border-bottom: 1px solid var(--ink);
          }

          .four-year-flow article {
            min-height: 330px;
            padding: 26px;
            border-right: 1px solid rgba(17, 24, 22, .18);
          }

          .four-year-flow article:last-child {
            border-right: 0;
          }

          .four-year-step-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .four-year-step-top > span {
            color: #527068;
            font-size: 12px;
            font-weight: 900;
          }

          .four-year-step-top svg {
            color: #355c53;
          }

          .four-year-flow article > p {
            margin: 56px 0 10px;
            color: #527068;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .four-year-flow h3 {
            margin: 0 0 14px;
            font-size: 22px;
            line-height: 1.25;
          }

          .four-year-flow article > div:last-child {
            color: #52605b;
            font-size: 14px;
            line-height: 1.6;
          }

          .four-year-output {
            display: grid;
            grid-template-columns: .8fr 1.1fr 1.3fr;
            gap: 28px;
            align-items: center;
            margin-top: 34px;
            padding: 26px;
            color: var(--white);
            background: var(--ink);
            border-radius: 8px;
          }

          .four-year-output > div {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .four-year-output svg {
            flex: 0 0 auto;
            color: var(--green);
          }

          .four-year-output span {
            color: rgba(255, 255, 255, .62);
            font-size: 11px;
            font-weight: 900;
            line-height: 1.4;
            text-transform: uppercase;
          }

          .four-year-output strong {
            font-size: 16px;
            line-height: 1.45;
          }

          .four-year-output p {
            margin: 0;
            padding-left: 28px;
            color: rgba(255, 255, 255, .68);
            border-left: 1px solid rgba(255, 255, 255, .18);
            font-size: 13px;
            line-height: 1.55;
          }

          .records-section {
            display: grid;
            grid-template-columns: .85fr 1.15fr;
            gap: 86px;
            align-items: center;
            padding: 112px 64px;
            color: var(--white);
            background: #17221f;
          }

          .records-copy > p:not(.eyebrow) {
            margin: 22px 0 0;
            color: rgba(255, 255, 255, .68);
            font-size: 17px;
            line-height: 1.65;
          }

          .records-copy ul {
            display: grid;
            gap: 12px;
            margin: 28px 0 0;
            padding: 0;
            list-style: none;
          }

          .records-copy li {
            display: flex;
            align-items: center;
            gap: 10px;
            color: rgba(255, 255, 255, .82);
            font-size: 14px;
          }

          .records-copy li svg {
            color: var(--green);
          }

          .records-copy .button-outline {
            color: var(--white);
            border-color: rgba(255, 255, 255, .36);
          }

          .workspace-preview {
            overflow: hidden;
            color: var(--ink);
            background: var(--white);
            border: 1px solid rgba(255, 255, 255, .25);
            border-radius: 8px;
            box-shadow: 0 32px 80px rgba(0, 0, 0, .28);
          }

          .workspace-preview > header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 26px;
            background: #f1efe9;
            border-bottom: 1px solid var(--line);
          }

          .workspace-preview header span,
          .workspace-preview header strong {
            display: block;
          }

          .workspace-preview header span {
            color: var(--muted);
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .workspace-preview header strong {
            margin-top: 5px;
            font-size: 28px;
          }

          .progress-ring {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 70px;
            height: 70px;
            flex: 0 0 auto;
            border: 8px solid var(--green);
            border-right-color: #d7d7d0;
            border-radius: 50%;
            font-size: 15px;
            font-weight: 900;
          }

          .workspace-summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            border-bottom: 1px solid var(--line);
          }

          .workspace-summary span {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 15px 20px;
            color: var(--muted);
            border-right: 1px solid var(--line);
            font-size: 12px;
            font-weight: 800;
          }

          .workspace-summary span:last-child {
            border-right: 0;
          }

          .workspace-rows article {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 18px 22px;
            border-bottom: 1px solid var(--line);
          }

          .workspace-rows article:last-child {
            border-bottom: 0;
          }

          .workspace-rows strong,
          .workspace-rows article div > span {
            display: block;
          }

          .workspace-rows strong {
            font-size: 14px;
          }

          .workspace-rows article div > span {
            margin-top: 4px;
            color: var(--muted);
            font-size: 11px;
          }

          .status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 96px;
            min-height: 28px;
            padding: 4px 9px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 900;
            white-space: nowrap;
          }

          .status.ready {
            color: #214814;
            background: #dff3d5;
          }

          .status.review {
            color: #6a381d;
            background: #f5dfcd;
          }

          .confidence-section {
            padding-top: 105px;
            padding-bottom: 110px;
            background: var(--paper);
          }

          .confidence-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            margin-top: 50px;
            border: 1px solid var(--line);
            border-radius: 8px;
          }

          .confidence-grid article {
            min-height: 245px;
            padding: 26px;
            border-right: 1px solid var(--line);
          }

          .confidence-grid article:last-child {
            border-right: 0;
          }

          .confidence-grid svg {
            color: #41675e;
          }

          .confidence-grid h3 {
            margin: 54px 0 10px;
            font-size: 20px;
          }

          .confidence-grid p {
            margin: 0;
            color: var(--muted);
            font-size: 14px;
            line-height: 1.6;
          }

          .closing-section {
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 70px;
            padding: 94px 64px;
            color: var(--white);
            background: #301f2b;
          }

          .closing-section > div {
            max-width: 800px;
          }

          .closing-section > div > p:not(.eyebrow) {
            max-width: 700px;
            margin: 20px 0 0;
            color: rgba(255, 255, 255, .7);
            font-size: 17px;
            line-height: 1.6;
          }

          .closing-section > .button {
            flex: 0 0 auto;
          }

          .sources-section {
            display: grid;
            grid-template-columns: .8fr 1.2fr;
            gap: 48px 80px;
            padding-top: 68px;
            padding-bottom: 68px;
            color: var(--white);
            background: var(--ink);
            border-bottom: 1px solid rgba(255, 255, 255, .14);
          }

          .sources-section h2 {
            margin: 0;
            font-size: 25px;
          }

          .sources-section > div > p {
            margin: 12px 0 0;
            color: rgba(255, 255, 255, .58);
            font-size: 13px;
            line-height: 1.6;
          }

          .source-links {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .source-links a {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            min-height: 48px;
            padding: 12px 14px;
            color: rgba(255, 255, 255, .82);
            text-decoration: none;
            background: rgba(255, 255, 255, .05);
            border: 1px solid rgba(255, 255, 255, .16);
            border-radius: 4px;
            font-size: 12px;
            font-weight: 800;
          }

          .legal-note {
            grid-column: 1 / -1;
            margin: 0;
            padding-top: 28px;
            color: rgba(255, 255, 255, .52);
            border-top: 1px solid rgba(255, 255, 255, .14);
            font-size: 12px;
            line-height: 1.65;
          }

          .page-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            min-height: 84px;
            padding: 0 64px;
            color: rgba(255, 255, 255, .6);
            background: #0a0f0e;
            font-size: 12px;
          }

          .page-footer .brand {
            color: var(--white);
          }

          .report-layer {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px;
          }

          .report-backdrop {
            position: absolute;
            inset: 0;
            width: 100%;
            border: 0;
            background: rgba(7, 11, 10, .78);
            cursor: pointer;
          }

          .report-panel {
            position: relative;
            z-index: 1;
            width: min(1120px, 96vw);
            max-height: 92vh;
            overflow: auto;
            color: var(--ink);
            background: var(--paper);
            border-radius: 8px;
            box-shadow: 0 32px 90px rgba(0, 0, 0, .45);
          }

          .report-toolbar {
            position: sticky;
            top: 0;
            z-index: 3;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            padding: 16px 20px;
            color: var(--white);
            background: var(--ink);
          }

          .report-toolbar span,
          .report-toolbar strong {
            display: block;
          }

          .report-toolbar span {
            color: rgba(255, 255, 255, .56);
            font-size: 10px;
            text-transform: uppercase;
          }

          .report-toolbar strong {
            margin-top: 2px;
            font-size: 16px;
          }

          .report-toolbar > div:last-child {
            display: flex;
            gap: 8px;
          }

          .report-toolbar button,
          .report-toolbar a {
            min-height: 38px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 0 12px;
            color: var(--white);
            background: rgba(255, 255, 255, .08);
            border: 1px solid rgba(255, 255, 255, .2);
            border-radius: 4px;
            font: inherit;
            font-size: 11px;
            font-weight: 800;
            text-decoration: none;
            cursor: pointer;
          }

          .report-toolbar .icon-button {
            width: 38px;
            padding: 0;
          }

          .report-body {
            padding: 38px;
          }

          .report-title-block {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 30px;
          }

          .report-title-block p {
            margin: 0 0 8px;
            color: #41675e;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .report-title-block h2 {
            margin: 0;
            font-size: 36px;
          }

          .report-title-block > div > span {
            display: block;
            margin-top: 8px;
            color: var(--muted);
            font-size: 13px;
          }

          .report-score {
            min-width: 130px;
            padding: 18px;
            text-align: center;
            background: var(--green);
            border-radius: 8px;
          }

          .report-score strong,
          .report-score span {
            display: block;
          }

          .report-score strong {
            font-size: 34px;
          }

          .report-score span {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .report-meta {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            margin-top: 30px;
            border: 1px solid var(--line);
          }

          .report-meta span {
            padding: 15px;
            border-right: 1px solid var(--line);
            font-size: 12px;
          }

          .report-meta span:last-child {
            border-right: 0;
          }

          .report-meta strong {
            display: block;
            margin-bottom: 4px;
            font-size: 10px;
            text-transform: uppercase;
          }

          .report-table {
            margin-top: 28px;
            border-top: 1px solid var(--ink);
          }

          .report-row {
            display: grid;
            grid-template-columns: 1.15fr 1fr 120px 1.35fr;
            gap: 16px;
            align-items: center;
            min-height: 64px;
            padding: 12px 10px;
            border-bottom: 1px solid var(--line);
            font-size: 12px;
          }

          .report-heading {
            min-height: 40px;
            color: var(--muted);
            background: #ebe7de;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .report-boundary {
            display: flex;
            align-items: flex-start;
            gap: 14px;
            margin-top: 26px;
            padding: 18px;
            color: var(--muted);
            background: #e8eee9;
            border-left: 4px solid #41675e;
          }

          .report-boundary p {
            margin: 0;
            font-size: 12px;
            line-height: 1.6;
          }

          @media (max-width: 1180px) {
            .site-header {
              grid-template-columns: 1fr auto;
              padding: 0 28px;
            }

            .site-header nav {
              display: none;
            }

            .hero h1 {
              font-size: 52px;
            }

            .accountability-band,
            .requirements-section,
            .detection-section,
            .year-section,
            .four-year-section,
            .confidence-section,
            .sources-section {
              padding-right: 36px;
              padding-left: 36px;
            }

            .accountability-band,
            .section-intro,
            .detection-heading,
            .four-year-heading,
            .journey-section,
            .records-section,
            .sources-section {
              grid-template-columns: 1fr;
            }

            .four-year-flow {
              grid-template-columns: 1fr 1fr;
            }

            .four-year-flow article:nth-child(2) {
              border-right: 0;
            }

            .four-year-flow article:nth-child(-n + 2) {
              border-bottom: 1px solid rgba(17, 24, 22, .18);
            }

            .four-year-output {
              grid-template-columns: 1fr 1.5fr;
            }

            .four-year-output p {
              grid-column: 1 / -1;
              padding: 18px 0 0;
              border-top: 1px solid rgba(255, 255, 255, .18);
              border-left: 0;
            }

            .detection-heading > p {
              max-width: 760px;
            }

            .detection-system {
              grid-template-columns: 1fr 1fr;
            }

            .detection-lanes {
              grid-column: 1 / -1;
              grid-template-columns: 1fr 1fr;
            }

            .signal-engine::after {
              display: none;
            }

            .map-key {
              display: none;
            }

            .requirement {
              grid-template-columns: 1fr;
            }

            .requirement > header {
              padding-right: 0;
            }

            .requirement-columns > div:first-child {
              border-left: 0;
            }

            .journey-section,
            .records-section {
              padding-right: 36px;
              padding-left: 36px;
            }

            .journey-visual {
              width: min(650px, 100%);
              margin: 0 auto;
            }

            .deadline-row {
              grid-template-columns: 1fr 24px 1fr;
            }

            .deadline-row > p {
              grid-column: 1 / -1;
              padding: 18px 0 0;
              border-top: 1px solid rgba(255, 255, 255, .18);
              border-left: 0;
            }

            .closing-section {
              align-items: flex-start;
              flex-direction: column;
              padding-right: 36px;
              padding-left: 36px;
            }
          }

          @media (max-width: 760px) {
            .site-header {
              grid-template-columns: 1fr auto;
              min-height: 64px;
              padding: 0 16px;
            }

            .brand span {
              font-size: 12px;
            }

            .header-action {
              padding: 9px 10px;
              font-size: 11px;
            }

            .header-action svg {
              display: none;
            }

            .hero {
              height: auto;
              min-height: 680px;
              max-height: none;
              padding: 42px 18px 175px;
              background-position: 58% center;
            }

            .hero-overlay {
              background: linear-gradient(180deg, rgba(10, 16, 14, .98) 0%, rgba(10, 16, 14, .9) 63%, rgba(10, 16, 14, .58) 100%);
            }

            .hero h1 {
              font-size: 38px;
              line-height: 1.06;
            }

            .hero-summary {
              font-size: 17px;
            }

            .hero-boundary {
              font-size: 14px;
            }

            .hero-actions {
              display: grid;
              grid-template-columns: 1fr 1fr;
              width: 100%;
            }

            .hero-actions .button {
              min-width: 0;
              padding-right: 10px;
              padding-left: 10px;
              font-size: 11px;
              white-space: nowrap;
            }

            .hero-facts {
              right: 14px;
              left: 14px;
              grid-template-columns: 1fr;
            }

            .hero-facts article {
              min-height: 58px;
              padding: 11px 14px;
              border-right: 0;
              border-bottom: 1px solid rgba(255, 255, 255, .14);
            }

            .hero-facts article:last-child {
              border-bottom: 0;
            }

            .hero-facts span {
              margin-bottom: 2px;
              font-size: 9px;
            }

            .hero-facts strong {
              font-size: 12px;
            }

            .accountability-band,
            .requirements-section,
            .detection-section,
            .year-section,
            .four-year-section,
            .confidence-section,
            .sources-section,
            .journey-section,
            .records-section,
            .closing-section {
              padding-right: 18px;
              padding-left: 18px;
            }

            .accountability-band {
              padding-top: 72px;
              padding-bottom: 72px;
            }

            .band-heading h2,
            .section-intro h2,
            .detection-heading h2,
            .journey-copy h2,
            .four-year-heading h2,
            .records-copy h2,
            .closing-section h2 {
              font-size: 34px;
            }

            .detection-section {
              padding-top: 84px;
              padding-bottom: 84px;
            }

            .detection-heading {
              display: block;
            }

            .detection-heading > p {
              margin-top: 18px;
            }

            .detection-system {
              grid-template-columns: 1fr;
              margin-top: 40px;
              padding: 18px;
            }

            .signal-side {
              grid-template-columns: 112px 1fr;
            }

            .signal-phone {
              width: 112px;
              height: 228px;
            }

            .signal-list span {
              min-height: 42px;
              font-size: 11px;
            }

            .signal-engine {
              min-height: 190px;
            }

            .signal-engine::before,
            .signal-engine::after {
              display: none;
            }

            .detection-lanes {
              grid-column: auto;
              grid-template-columns: 1fr;
            }

            .detection-boundary {
              align-items: flex-start;
            }

            .signer-list,
            .requirement-columns,
            .annual-flow,
            .confidence-grid,
            .source-links {
              grid-template-columns: 1fr;
            }

            .signer-list article,
            .confidence-grid article {
              min-height: auto;
              border-right: 0;
              border-bottom: 1px solid var(--line);
            }

            .signer-list article:last-child,
            .confidence-grid article:last-child {
              border-bottom: 0;
            }

            .requirements-section {
              padding-top: 84px;
              padding-bottom: 84px;
            }

            .section-intro {
              display: block;
              margin-bottom: 40px;
            }

            .section-intro > p:not(.eyebrow) {
              margin-top: 18px;
            }

            .requirement {
              padding: 18px 0;
            }

            .requirement > header {
              grid-template-columns: 42px 1fr;
              padding: 0 0 22px;
            }

            .requirement h3 {
              font-size: 22px;
            }

            .requirement-columns > div {
              min-height: auto;
              padding: 20px 0;
              border-top: 1px solid var(--line);
              border-left: 0;
            }

            .requirement-columns > div::before {
              content: attr(data-label);
              display: block;
              margin-bottom: 15px;
              color: #527068;
              font-size: 10px;
              font-weight: 900;
              text-transform: uppercase;
            }

            .requirement-columns svg {
              display: none;
            }

            .record-output {
              margin: 0 -10px;
              padding: 20px 10px !important;
            }

            .journey-section {
              gap: 58px;
              padding-top: 84px;
              padding-bottom: 84px;
            }

            .journey-visual {
              min-height: 540px;
            }

            .phone-shot {
              left: 0;
              width: 240px;
              height: 500px;
              transform: none;
              border-radius: 34px;
            }

            .clinical-mark,
            .status-panel {
              width: 178px;
              padding: 15px;
            }

            .clinical-mark {
              top: 130px;
            }

            .status-panel {
              top: 290px;
            }

            .status-panel strong {
              font-size: 16px;
            }

            .year-section {
              padding-top: 84px;
              padding-bottom: 84px;
            }

            .annual-flow article {
              min-height: auto;
              padding: 24px 0;
              border-right: 0;
              border-bottom: 1px solid var(--line);
            }

            .annual-flow article:last-child {
              border-bottom: 0;
            }

            .annual-flow article > p {
              margin-top: 24px;
            }

            .deadline-row {
              grid-template-columns: 1fr;
              gap: 18px;
            }

            .deadline-row > svg {
              transform: rotate(90deg);
            }

            .four-year-section {
              padding-top: 84px;
              padding-bottom: 84px;
            }

            .four-year-heading {
              display: block;
            }

            .four-year-intro {
              margin-top: 28px;
            }

            .review-comparison {
              grid-template-columns: 1fr;
              margin-top: 36px;
            }

            .review-comparison article {
              min-height: auto;
              padding: 22px 0;
            }

            .review-comparison article:last-child {
              padding-right: 18px;
              padding-left: 18px;
            }

            .comparison-arrow {
              min-height: 64px;
              flex-direction: row;
            }

            .comparison-arrow svg {
              transform: rotate(90deg);
            }

            .four-year-flow {
              grid-template-columns: 1fr;
              margin-top: 42px;
            }

            .four-year-flow article {
              min-height: auto;
              padding: 24px 0;
              border-right: 0;
              border-bottom: 1px solid rgba(17, 24, 22, .18);
            }

            .four-year-flow article:nth-child(2) {
              border-right: 0;
            }

            .four-year-flow article:last-child {
              border-bottom: 0;
            }

            .four-year-flow article > p {
              margin-top: 26px;
            }

            .four-year-output {
              grid-template-columns: 1fr;
              gap: 18px;
            }

            .four-year-output p {
              grid-column: auto;
            }

            .records-section {
              gap: 56px;
              padding-top: 84px;
              padding-bottom: 84px;
            }

            .records-actions,
            .records-actions .button {
              width: 100%;
            }

            .workspace-preview > header {
              padding: 20px;
            }

            .workspace-preview header strong {
              font-size: 22px;
            }

            .workspace-summary {
              grid-template-columns: 1fr;
            }

            .workspace-summary span {
              border-right: 0;
              border-bottom: 1px solid var(--line);
            }

            .workspace-summary span:last-child {
              border-bottom: 0;
            }

            .workspace-rows article {
              align-items: flex-start;
              padding: 15px;
            }

            .workspace-rows strong {
              font-size: 12px;
            }

            .status {
              min-width: 82px;
            }

            .confidence-section {
              padding-top: 84px;
              padding-bottom: 84px;
            }

            .confidence-grid h3 {
              margin-top: 24px;
            }

            .closing-section {
              padding-top: 76px;
              padding-bottom: 76px;
            }

            .closing-section > .button {
              width: 100%;
            }

            .sources-section {
              padding-top: 58px;
              padding-bottom: 58px;
            }

            .page-footer {
              align-items: flex-start;
              flex-direction: column;
              padding: 30px 18px;
            }

            .report-layer {
              align-items: flex-end;
              padding: 0;
            }

            .report-panel {
              width: 100%;
              max-height: 94vh;
              border-radius: 8px 8px 0 0;
            }

            .report-toolbar {
              align-items: flex-start;
            }

            .report-toolbar button:not(.icon-button),
            .report-toolbar a {
              width: 38px;
              padding: 0;
              font-size: 0;
            }

            .report-body {
              padding: 24px 16px;
            }

            .report-title-block {
              align-items: flex-start;
              flex-direction: column;
            }

            .report-title-block h2 {
              font-size: 28px;
            }

            .report-score {
              width: 100%;
            }

            .report-meta {
              grid-template-columns: 1fr;
            }

            .report-meta span {
              border-right: 0;
              border-bottom: 1px solid var(--line);
            }

            .report-meta span:last-child {
              border-bottom: 0;
            }

            .report-heading {
              display: none;
            }

            .report-row {
              grid-template-columns: 1fr;
              gap: 7px;
              padding: 16px 4px;
            }

            .report-row .status {
              width: max-content;
            }
          }

          @media print {
            .site-header,
            .hero,
            .accountability-band,
            .requirements-section,
            .detection-section,
            .journey-section,
            .year-section,
            .four-year-section,
            .records-section,
            .confidence-section,
            .closing-section,
            .sources-section,
            .page-footer,
            .report-backdrop,
            .report-toolbar {
              display: none !important;
            }

            .report-layer,
            .report-panel {
              position: static;
              width: 100%;
              max-height: none;
              overflow: visible;
              padding: 0;
              box-shadow: none;
            }

            .report-body {
              padding: 0;
            }
          }
        `}</style>
      </main>
    </>
  );
};

export const getStaticProps: GetStaticProps = async () => ({
  props: {
    ogMeta: {
      title: 'NCAA Mental Health Compliance — PulseCheck + AuntEdna.ai',
      description: PAGE_DESCRIPTION,
      image: PAGE_OG_IMAGE,
      url: PAGE_URL,
      type: 'website',
      siteName: 'Pulse Intelligence Labs',
    },
  },
});

export default NcaaCompliancePage;
