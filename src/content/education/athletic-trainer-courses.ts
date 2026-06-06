import type { Course } from './types';

// Athletic trainer education. Voice: clinical register kept (ATs are credentialed) — biopsychosocial,
// HRV, scope of practice, minimum necessary, return-to-play. Reframed toward performance neuroscience.
// NOTE: do NOT advertise CEU credit until BOC-accredited.

const performanceNeuroscience: Course = {
  id: 'performance-neuroscience-for-sports-medicine',
  audience: 'athleticTrainer',
  format: 'live',
  title: 'Performance Neuroscience for Sports Medicine',
  tagline: 'Extend your clinical expertise into performance neuroscience and the mental-performance side of supporting an elite athlete.',
  price: '$399',
  durationLabel: '3 live modules + clinical toolkit → certificate',
  forWhom:
    'For athletic trainers and sports medicine staff who want to bridge their clinical foundation into mental-readiness, return-to-play confidence, and performance-vs-clinical triage.',
  domains: ['Performance neuroscience', 'Mind-body in injury and return', 'Safety and escalation'],
  sessions: [
    {
      id: 'm1',
      title: 'Module 1 — Performance Neuroscience',
      duration: '90 min, live lab',
      objectives: [
        'Apply arousal regulation, stress-recovery, and autonomic balance to how skill shows up under load.',
        'Read HRV, sleep, and training load as signals of mental readiness, not just physical recovery.',
        'Integrate objective data with athlete presentation to guide session decisions.',
      ],
      agenda: [
        { segment: 'Framing (10 min)', detail: 'Why mental readiness is the next layer of the AT role — and where it sits beside clinical care.' },
        { segment: 'State and skill (35 min)', detail: 'How arousal, sleep, and recovery change pain, adherence, and execution.' },
        { segment: 'Biometrics into readiness (30 min)', detail: 'Turning HRV, sleep, and load trends into actionable readiness reads.' },
        { segment: 'Case lab (15 min)', detail: 'Work a real under-recovered athlete where the data and self-report disagree.' },
      ],
    },
    {
      id: 'm2',
      title: 'Module 2 — Mind-Body in Injury & Return',
      duration: '90 min, live lab',
      objectives: [
        'Recognize fear of reinjury and pain-mood loops as part of the recovery picture.',
        'Build return-to-play confidence alongside physical clearance.',
        'Reinforce the athlete\'s mental-performance curriculum at treatment touchpoints.',
      ],
      agenda: [
        { segment: 'The psychology of injury (30 min)', detail: 'Biopsychosocial recovery: why a cleared athlete can still freeze.' },
        { segment: 'Graded confidence return (30 min)', detail: 'Pairing graded exposure with the mental-performance team to rebuild trust in the movement.' },
        { segment: 'Reinforcing the curriculum (20 min)', detail: 'Using your daily touchpoints to support — not undercut — the skills the athlete is learning.' },
        { segment: 'Case lab (10 min)', detail: 'Plan a confidence-building return for a post-injury athlete.' },
      ],
    },
    {
      id: 'm3',
      title: 'Module 3 — Triage, Scope & Safety',
      duration: '90 min, live lab',
      objectives: [
        'Tell a performance-psychology pattern apart from a clinical concern, and route accordingly.',
        'Hold scope while partnering with the mental-performance and clinical team.',
        'Run safe escalation and minimum-necessary documentation for concern and crisis events.',
      ],
      agenda: [
        { segment: 'Performance vs. clinical triage (30 min)', detail: 'Reading convergence — mood, sleep, eating — and when it crosses clinical.' },
        { segment: 'Scope & collaboration (20 min)', detail: 'What clearance is yours to give, what belongs to the licensed clinician.' },
        { segment: 'Escalation & documentation (25 min)', detail: 'Emergency response, notification order, and the minimum-necessary event record.' },
        { segment: 'Certification check (15 min)', detail: 'Scenario check; pass to earn the certificate.' },
      ],
    },
  ],
  takeHomeGuide: [
    {
      title: 'Readiness review checklist',
      intro: 'Run it when data and presentation disagree.',
      items: [
        'HRV / resting HR trend over the last several days.',
        'Sleep quantity and quality vs. baseline.',
        'Training load and accumulated fatigue.',
        'How the athlete presents and self-reports — then reconcile and adjust.',
      ],
    },
    {
      title: 'Return-to-play confidence cues',
      intro: 'Confidence is part of the clearance, not after it.',
      items: [
        'Name fear of reinjury openly rather than coaching it away.',
        'Use graded exposure to the feared movement at game speed.',
        'Coordinate the psychological side with the mental-performance team.',
      ],
    },
    {
      title: 'Scope & escalation quick-reference',
      intro: 'Keep it where your team can find it fast.',
      items: [
        'Clinical / mental clearance: licensed clinician owns it.',
        'Concern (panic, persistent change): support, then route per protocol.',
        'Crisis (intent + means): do not leave alone, activate EAP/crisis, notify clinical owner.',
        'Document the minimum necessary: trigger, tier, timestamp, route, consent or safety basis, status.',
      ],
    },
  ],
};

const reinforcingTheCurriculum: Course = {
  id: 'reinforcing-the-mental-performance-curriculum',
  audience: 'athleticTrainer',
  format: 'self-paced',
  title: 'Reinforcing the Mental-Performance Curriculum',
  tagline: 'The applied playbook for partnering with an athlete already in a mental-performance program — at every treatment-room touchpoint.',
  price: '$149',
  durationLabel: '~50 min · self-paced + scenario lab',
  forWhom:
    'For athletic trainers who want the practical layer: reading readiness, supporting return-to-play confidence, triaging performance vs. clinical, and clean handoffs.',
  domains: ['Biometrics → readiness', 'Reinforcing the curriculum', 'Performance vs. clinical triage', 'Documentation & handoff'],
  modules: [
    {
      id: 'm1-state-readiness',
      title: 'Module 1 — Reading state and readiness',
      summary: 'Use physiology and presentation together to read where the athlete actually is.',
      lessons: [
        {
          id: 'm1-l1',
          title: 'State drives recovery and performance',
          duration: '6 min',
          bigIdea: 'Psychological state changes pain, adherence, and how trained skills show up — recovery is biopsychosocial, not just tissue.',
          body: [
            'Arousal regulation, stress-recovery balance, and sleep all shape how an athlete heals and performs. An athlete who is dysregulated reports more pain, adheres less to rehab, and executes worse under load — even when the tissue is on track. Reading the physical exam alone misses half the picture.',
            'Holding this frame keeps you from labeling a struggling athlete as unmotivated. It is usually state, not character. That reframe changes how you coach the session and when you loop in the mental-performance side.',
          ],
          keyPoints: [
            'State affects pain, adherence, and execution — not just mood.',
            'A biopsychosocial read beats a tissue-only read.',
            '"Unmotivated" is often dysregulation — treat the state.',
          ],
        },
        {
          id: 'm1-l2',
          title: 'Biometrics into readiness',
          duration: '6 min',
          bigIdea: 'HRV, sleep, and load are mental-readiness signals — integrate them with how the athlete presents.',
          body: [
            'Several days of suppressed HRV and poor sleep heading into a heavy block is a readiness signal, not noise — and not a reason to ignore the athlete who says they feel fine. When the data and self-report disagree, you integrate: weigh the markers, the load, and how they present, then adjust and flag the trend.',
            'The goal is not to be ruled by a number. It is to add objective signal to clinical judgment so you make a better call and document why.',
          ],
          keyPoints: [
            'Data + presentation + load, reconciled — not data alone, not vibe alone.',
            'Suppressed recovery into a heavy block warrants an adjustment.',
            'Flag the trend so the team sees the pattern.',
          ],
          tryThis: 'Define, in advance, what readiness markers would change your session plan for a key athlete this week.',
        },
      ],
    },
    {
      id: 'm2-mindbody-curriculum',
      title: 'Module 2 — Mind-body and the curriculum',
      summary: 'Support return-to-play confidence and reinforce the skills the athlete is learning.',
      lessons: [
        {
          id: 'm2-l1',
          title: 'The psychology of injury and return',
          duration: '6 min',
          bigIdea: 'A physically cleared athlete can still be limited by fear — treat confidence as part of the plan.',
          body: [
            'Fear of reinjury, pain-mood loops, and a hit to identity are normal parts of recovery. An athlete cleared on imaging who freezes in game-speed drills or avoids the mechanism of injury is not failing rehab — they are showing you the psychological half of the return.',
            'Address it directly: name the fear, use graded exposure to the feared movement, and coordinate the psychological side with the mental-performance team. Confidence built alongside the physical return holds up better than confidence assumed after it.',
          ],
          keyPoints: [
            'Cleared tissue does not mean a confident athlete.',
            'Graded exposure rebuilds trust in the movement.',
            'Coordinate the psychological return, do not coach the fear away.',
          ],
        },
        {
          id: 'm2-l2',
          title: 'Reinforcing the curriculum at touchpoints',
          duration: '6 min',
          bigIdea: 'You see the athlete daily — reinforce their mental-performance routine instead of undercutting it.',
          body: [
            'If an athlete is learning a pre-performance reset — breathing, an attention cue — your treatment room is one of the places they will actually use it. Prompt it, reinforce it, and notice when it helps. Even a casual "you don\'t need all that" undermines the curriculum and the team running it.',
            'Then close the loop: feed back what you observe to the mental-performance team. You become part of the system that makes the skill stick, not a leak in it.',
          ],
          keyPoints: [
            'Cue and reinforce the routine during your touchpoints.',
            'Never dismiss it as overthinking.',
            'Report observations back to the mental-performance team.',
          ],
          tryThis: 'Pick one athlete in a mental-performance program and reinforce their routine at your next two sessions.',
        },
      ],
    },
    {
      id: 'm3-triage-scope-safety',
      title: 'Module 3 — Triage, scope, and safety',
      summary: 'Sort performance from clinical, hold scope, and act safely when it crosses the line.',
      lessons: [
        {
          id: 'm3-l1',
          title: 'Performance vs. clinical triage',
          duration: '7 min',
          bigIdea: 'Convergence across mood, sleep, and eating is the signal that a dip has crossed into clinical.',
          body: [
            'A dip in performance with low mood, poor sleep, and weight loss over two weeks could be overtraining — or it could be clinically relevant. The tell is convergence and duration: several changes, in the same direction, that persist. Screen the pattern and refer when it points past performance.',
            'You are not diagnosing. You are recognizing that the pattern has crossed a threshold and routing it into the appropriate clinical or support lane without waiting for it to worsen. Any direct safety statement overrides all of this and goes straight to the crisis pathway.',
          ],
          keyPoints: [
            'Convergence + duration moves it from performance to clinical.',
            'Screen and refer; do not wait for it to get worse.',
            'Any safety statement overrides triage and escalates immediately.',
          ],
        },
        {
          id: 'm3-l2',
          title: 'Scope and collaboration',
          duration: '6 min',
          bigIdea: 'Clinical and mental clearance sit with the licensed clinician — protect the process while staying useful.',
          body: [
            'When a coach asks you to "just tell them they are fine to play," the right answer protects both the athlete and your scope. You can share what is yours to share — observations, readiness, physical status — while making clear that mental clearance belongs to the licensed clinician, and routing the decision there.',
            'Share the minimum necessary, follow the pathway, and document the basis. Holding scope is not unhelpful; it is what keeps the athlete safe and the system trustworthy.',
          ],
          keyPoints: [
            'Mental clearance is the clinician\'s call, not yours.',
            'Share minimum necessary; route the decision.',
            'Document the consent or safety basis for what you share.',
          ],
          sayThis: [
            {
              avoid: '"Yeah, they seem fine to me — go ahead and play them."',
              say: '"I can share what I\'m seeing physically and on readiness. Mental clearance sits with [clinician] — let me route that so we get the right call."',
              why: 'The first gives clearance you do not own. The second stays useful and protects the athlete and your scope.',
            },
          ],
        },
        {
          id: 'm3-l3',
          title: 'Safety, escalation, and documentation',
          duration: '7 min',
          bigIdea: 'For intent plus means, act immediately — then document the minimum necessary.',
          body: [
            'If an athlete discloses current suicidal intent and access to means, treat it as an emergency: do not leave them alone, activate emergency services or your EAP per protocol, notify the clinical owner, and hand off to the right care. Scheduling a later referral is not enough for an acute disclosure.',
            'For any escalation event, document the minimum necessary — trigger, tier, timestamp, route, consent or safety basis, and status. Keep clinical notes on the clinical side. A clean, minimal record protects the athlete\'s trust and preserves the handoff trail.',
          ],
          keyPoints: [
            'Intent + means = emergency: do not leave alone, activate EAP/crisis, notify clinical owner.',
            'A later referral is not enough for an acute disclosure.',
            'Document minimum necessary: trigger, tier, timestamp, route, basis, status.',
          ],
        },
      ],
    },
  ],
  scenarioLab: [
    {
      id: 'lab-1',
      prompt: 'An athlete\'s HRV is suppressed for several days and sleep is down, but they feel fine and want a full session before a heavy block. Best call?',
      options: [
        { label: 'Trust how they feel and run the full plan', feedback: 'Self-report alone ignores a real readiness signal heading into load.' },
        { label: 'Integrate the data, load, and presentation, then adjust and flag it', feedback: 'Right. Reconcile the signals, modify the session, and document the trend.', best: true },
        { label: 'Dismiss the data as noise', feedback: 'Several days of suppressed recovery is signal, not noise.' },
      ],
    },
    {
      id: 'lab-2',
      prompt: 'An athlete is physically cleared after a long injury but freezes in game-speed drills and avoids the mechanism of injury. Right read?',
      options: [
        { label: 'Treat it as an unresolved physical problem only', feedback: 'The tissue is cleared — this is the psychological half of the return.' },
        { label: 'Tell them to stop hesitating and push through', feedback: 'Pushing past fear of reinjury without addressing it tends to backfire.' },
        { label: 'Address fear of reinjury with graded exposure and the mental-performance team', feedback: 'Yes. Build return-to-play confidence alongside the physical clearance.', best: true },
      ],
    },
    {
      id: 'lab-3',
      prompt: 'An athlete shows dropping performance, low mood, poor sleep, and weight loss over two weeks. How do you handle it?',
      options: [
        { label: 'Assume overtraining and deload', feedback: 'Convergence across mood, sleep, and weight may have crossed past performance.' },
        { label: 'Watch one more week before doing anything', feedback: 'A persistent, converging pattern warrants action now, not more waiting.' },
        { label: 'Screen the pattern and refer into the clinical/support lane', feedback: 'Right. Treat convergence + duration as clinically relevant and route per protocol.', best: true },
      ],
    },
    {
      id: 'lab-4',
      prompt: 'During treatment, an athlete discloses current suicidal intent and access to means. What happens?',
      options: [
        { label: 'Finish the session, then schedule a referral', feedback: 'An acute disclosure with means cannot wait for a scheduled referral.' },
        { label: 'Do not leave them alone, activate EAP/crisis, notify the clinical owner, document', feedback: 'Yes. Immediate protective action, then the minimum-necessary record.', best: true },
        { label: 'Reassure them and send them home', feedback: 'Reassurance without action leaves an at-risk athlete unprotected.' },
      ],
    },
  ],
};

export const athleticTrainerCourses: Course[] = [performanceNeuroscience, reinforcingTheCurriculum];
