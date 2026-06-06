import type { Course } from './types';

// Coach education courses. Voice: coach English — direct, practical, locker-room, "your athletes" /
// "the athlete" (athlete is fine for coaches). No science-speak. Maps to the coach readiness domains.

const coachingTheNervousSystem: Course = {
  id: 'coaching-the-nervous-system',
  audience: 'coach',
  format: 'live',
  title: 'Coaching the Nervous System',
  tagline: 'Coach the mental game with the same intent as the physical one — pressure, recovery, and the skills that hold up when it matters.',
  price: '$399',
  durationLabel: '3 live sessions + team language guide → certificate',
  forWhom:
    'For coaches who want to build an environment where athletes perform under pressure, grow mental skills, and still feel safe asking for help.',
  domains: ['Coaching the nervous system', 'Building mental skills', 'When to escalate'],
  sessions: [
    {
      id: 's1',
      title: 'Session 1 — The Nervous System Under Pressure',
      duration: '90 min, live',
      objectives: [
        'Understand why fatigue, sleep, and pressure change what an athlete can actually execute.',
        'Use readiness signals — recovery data and the eye test — to plan smarter practices.',
        'Design sessions that build pressure and recovery on purpose.',
      ],
      agenda: [
        { segment: 'Opening (10 min)', detail: 'Why the best programs coach the mind on purpose, not by accident.' },
        { segment: 'State drives skill (30 min)', detail: 'How load, sleep, and pressure change execution — and what to do about it in practice.' },
        { segment: 'Reading readiness (30 min)', detail: 'Turning recovery data and what you see in the room into practice decisions.' },
        { segment: 'Design lab (20 min)', detail: 'Build pressure and recovery into a real session from your week.' },
      ],
    },
    {
      id: 's2',
      title: 'Session 2 — Building the Mental Game',
      duration: '90 min, live',
      objectives: [
        'Treat confidence, focus, and pressure tolerance as skills you can coach.',
        'Reinforce the mental-performance routine your athletes are learning instead of undercutting it.',
        'Give feedback that corrects the behavior without attacking the person.',
      ],
      agenda: [
        { segment: 'Mental skills are coachable (25 min)', detail: 'Pressure inoculation, focus cues, and resets you can build into drills.' },
        { segment: 'Reinforcing the routine (25 min)', detail: 'How your touchpoints support — or quietly kill — the skills they are learning.' },
        { segment: 'Feedback that builds (25 min)', detail: 'The reset-cue-return loop and identity-safe correction after mistakes.' },
        { segment: 'Practice + close (15 min)', detail: 'Run the loop on real film moments from your team.' },
      ],
    },
    {
      id: 's3',
      title: 'Session 3 — Climate, Signs & Safety',
      duration: '90 min, live',
      objectives: [
        'Keep one athlete\'s struggle from setting the tone for the whole locker room.',
        'Handle the pushy-parent conversation without leaving your lane.',
        'Know exactly when to route a concern and how to act in an emergency.',
      ],
      agenda: [
        { segment: 'Team contagion (25 min)', detail: 'Reset the standard and protect the person when a leader is spiraling.' },
        { segment: 'Your lane (20 min)', detail: 'Coach vs. AT vs. clinician vs. parent — what you carry and what you route.' },
        { segment: 'Signs & escalation (30 min)', detail: 'Reading the warning signs, your notification order, and emergency response.' },
        { segment: 'Certification check (15 min)', detail: 'Scenario check; pass to earn the certificate.' },
      ],
    },
  ],
  takeHomeGuide: [
    {
      title: 'Cue cards',
      intro: 'Short language you can use mid-practice.',
      items: [
        'Reset: "Flush it — next play." Then a specific cue for the next action.',
        'Pressure rep: name the stakes out loud, then coach the breath before the rep.',
        'Recovery is training too: say it, so athletes stop hiding fatigue.',
      ],
    },
    {
      title: 'The reset script',
      intro: 'After a visible mistake, run the loop every time.',
      items: [
        '1. Reset — a practiced word or gesture that ends the moment.',
        '2. Cue — one short, specific instruction for the next action.',
        '3. Return — eyes forward, no replay, no identity talk.',
      ],
    },
    {
      title: 'Your lane map',
      intro: 'Print it for your staff.',
      items: [
        'Yours: standards, tactics, playing time, in-sport feedback, team climate.',
        'The AT / clinician\'s: clinical clearance, mental-health treatment, risk decisions.',
        'The parent\'s: home support and unconditional backing.',
        'Bigger than coaching? Route it — and in an emergency, act first.',
      ],
    },
  ],
};

const coachingTheMind: Course = {
  id: 'coaching-the-mind-in-practice',
  audience: 'coach',
  format: 'self-paced',
  title: 'Coaching the Mind in Practice',
  tagline: 'Applied reps for the everyday moments — reading the room, building mental skills, staying in your lane, and acting on safety.',
  price: '$199',
  durationLabel: '~45 min · self-paced + scenario lab',
  forWhom:
    'For coaches who want the practical playbook without the full certification — what to do in the real moments your season throws at you.',
  domains: ['Load & readiness', 'Reading the warning signs', 'Feedback that builds', 'Staying in your lane'],
  modules: [
    {
      id: 'm1-reading-the-room',
      title: 'Module 1 — Reading the room',
      summary: 'Use the data and your eyes to coach the athlete in front of you, not the one on the plan.',
      lessons: [
        {
          id: 'm1-l1',
          title: 'Load and readiness',
          duration: '6 min',
          bigIdea: 'The schedule says go hard. The data and the room tell you whether to.',
          body: [
            'Recovery markers — sleep, resting heart rate, readiness scores — are not the whole story, but they are real information. When several athletes are under-recovered after a heavy week, running the planned grind anyway buys you fatigue, not fitness, and raises injury and burnout risk.',
            'Pair the numbers with the eye test: how they warm up, how they talk, how crisp they look early. When the data and the room disagree with the plan, adjust the plan — and tell them why. Coaching to readiness builds trust and keeps your best athletes available.',
          ],
          keyPoints: [
            'Readiness data + the eye test beats the plan on paper.',
            'Under-recovered grind = fatigue and risk, not gains.',
            'Adjust and explain — athletes trust a coach who reads the room.',
          ],
          tryThis: 'Pick one upcoming heavy day. Decide in advance what you\'ll change if half the group shows up under-recovered.',
        },
        {
          id: 'm1-l2',
          title: 'Reading the warning signs',
          duration: '6 min',
          bigIdea: 'Output can stay high while something underneath is changing — watch the behavior, not just the box score.',
          body: [
            'A starter can keep performing while quietly pulling away: stops sitting with teammates, avoids film, goes flat in the group, withdraws over a couple of weeks. Production lags behind well-being, so by the time the numbers drop, the change has often been there a while.',
            'You are not diagnosing anything. You are noticing a pattern — new, lasting, spreading across more of their life — and deciding it deserves a closer look. That might mean a quiet check-in, easing a demand, or looping in your support staff.',
          ],
          keyPoints: [
            'Behavior change shows up before the stats do.',
            'New + lasting + spreading = look closer.',
            'A two-week change in a normally engaged athlete is worth a move.',
          ],
        },
      ],
    },
    {
      id: 'm2-coaching-the-mind',
      title: 'Module 2 — Coaching the mind',
      summary: 'Build mental skills into practice and protect athletes from feeling like the mistake defines them.',
      lessons: [
        {
          id: 'm2-l1',
          title: 'Mental skills are coachable',
          duration: '6 min',
          bigIdea: 'Confidence, focus, and handling pressure are trainable — build them into drills, don\'t just hope for them.',
          body: [
            'The same way you build a skill physically — reps, feedback, progression — you build the mental side. Put athletes under manufactured pressure in practice (stakes, consequences, a crowd), then coach the focus cue and the breath so the skill holds when it counts.',
            'Pair pressure with recovery on purpose. Naming recovery as part of training — not weakness — is how you keep athletes from hiding fatigue and burning out chasing your approval.',
          ],
          keyPoints: [
            'Manufacture pressure in practice, then coach the response.',
            'Focus cues and resets are reps, not pep talks.',
            'Make recovery a normal, coached part of the week.',
          ],
        },
        {
          id: 'm2-l2',
          title: 'Reinforcing the routine',
          duration: '6 min',
          bigIdea: 'When your athletes are learning a mental routine, your job is to reinforce it — not undercut it.',
          body: [
            'If athletes are learning a pre-performance reset — a breath, a focus cue — you control the environment where they actually use it. Build moments into practice where they rehearse it under pressure. Prompt it. Notice it. Feed back what you see to whoever runs the mental-performance side.',
            'The fastest way to kill a skill is to call it overthinking. Even a throwaway "stop with all that and just play" tells the team the routine is optional. Reinforce it consistently and it becomes how your program competes.',
          ],
          keyPoints: [
            'Create reps of the routine inside practice.',
            'Never call the routine a distraction — that ends it.',
            'Share what you see with the mental-performance team.',
          ],
          tryThis: 'Add one "reset rep" to a drill this week — a moment where athletes run their routine before a high-stakes attempt.',
        },
        {
          id: 'm2-l3',
          title: 'Feedback that builds',
          duration: '6 min',
          bigIdea: 'Correct the play without making it about who they are.',
          body: [
            'After a visible mistake, run the same loop every time: reset, cue, return. End the moment, give one specific instruction for the next action, and move forward — no replay, no identity talk. The athlete learns the play and learns that one error is not a verdict on them.',
            'Public shaming feels like accountability and reads like a threat. It teaches athletes to hide mistakes and play not-to-lose. Identity-safe correction keeps standards high and keeps them competing freely.',
          ],
          keyPoints: [
            'Reset → cue → return, every time.',
            'Correct the behavior, never the person.',
            'Shame breeds hiding; safety breeds risk-taking.',
          ],
          sayThis: [
            {
              avoid: '"What was that?! You\'re killing us out there."',
              say: '"Reset. Next ball, feet set, take the simple read." Then move on.',
              why: 'The first makes the mistake about them. The second fixes the play and keeps them in the game.',
            },
          ],
        },
      ],
    },
    {
      id: 'm3-lane-and-safety',
      title: 'Module 3 — Lane and safety',
      summary: 'Know what you carry, what you route, and how to act when it crosses into an emergency.',
      lessons: [
        {
          id: 'm3-l1',
          title: 'Staying in your lane',
          duration: '6 min',
          bigIdea: 'Your relationship and their growth both depend on knowing what is yours to carry.',
          body: [
            'You own standards, tactics, playing time, in-sport feedback, and team climate. You do not own clinical clearance, mental-health treatment, or risk decisions — those belong to the AT, a clinician, or emergency services. When an athlete trusts you with something heavy, support them and route it; do not try to be the therapist.',
            'The pushy-parent conversation is a lane test too. You can hear a parent out and hold your coaching decision at the same time. Decline to settle playing time in the parking lot, set a real time to talk, and keep the focus on what helps the athlete.',
          ],
          keyPoints: [
            'Support and route — don\'t carry clinical weight alone.',
            'Hold coaching decisions; move them to a proper meeting.',
            'Steer parent conflict back to the athlete\'s growth.',
          ],
          sayThis: [
            {
              avoid: 'Arguing playing time with a parent right after the game.',
              say: '"I hear you. I won\'t settle this in the parking lot — let\'s set a time. My focus is what helps [athlete] get better."',
              why: 'Holds the boundary, protects the relationship, and keeps the athlete at the center.',
            },
          ],
        },
        {
          id: 'm3-l2',
          title: 'When to escalate',
          duration: '6 min',
          bigIdea: 'Some moments leave coaching entirely — know the line and act without delay.',
          body: [
            'If an athlete discloses panic, scary thoughts, or that they can\'t cope, that is bigger than coaching. Support them, be honest that you want to get the right help involved, and route it to the AT or your support path per your protocol — even if they ask you to keep it between you.',
            'If an athlete says they have a plan to hurt themselves, treat it as an emergency. Do not leave them alone, follow your emergency steps, bring in the AT or clinical contact immediately, and hand off to the right care. Acting fast is never the overreaction here.',
          ],
          keyPoints: [
            'Panic / scary thoughts / can\'t cope → support and route now.',
            'A plan to hurt themselves → emergency: don\'t leave them alone, act immediately.',
            'Know your notification order before the season, not during a crisis.',
          ],
        },
      ],
    },
  ],
  scenarioLab: [
    {
      id: 'lab-1',
      prompt: 'A respected senior is openly spiraling after a benching, and you can feel it spreading through the locker room. Best first move?',
      options: [
        { label: 'Make an example of them in front of the team', feedback: 'Public shaming hardens the mood and breaks trust with the rest of the room.' },
        { label: 'Talk to the athlete one-on-one, then reset the team standard', feedback: 'Right. Handle the source privately, protect the person, then re-set the norm for everyone.', best: true },
        { label: 'Ignore it and hope it passes', feedback: 'Letting a leader\'s frustration set the tone lets it become the culture.' },
      ],
    },
    {
      id: 'lab-2',
      prompt: 'A parent corners you after a game, furious about playing time and demanding you change the rotation. What keeps you in your lane?',
      options: [
        { label: 'Promise a change to calm them down', feedback: 'Giving in to end the conflict undercuts your decision and your authority.' },
        { label: 'Argue your rotation right there', feedback: 'Debating in the moment rarely lands and damages the relationship.' },
        { label: 'Hold the boundary, set a real time to talk, keep it on the athlete', feedback: 'Yes. Decline to decide on the spot and redirect to what helps the athlete.', best: true },
      ],
    },
    {
      id: 'lab-3',
      prompt: 'A starter is still performing well but has stopped sitting with teammates and avoids film for two weeks. First move?',
      options: [
        { label: 'Leave it — the numbers are fine', feedback: 'Output lags well-being. A two-week behavior change deserves a look even when stats hold.' },
        { label: 'Ease a demand and loop in your support staff', feedback: 'Right. Treat the pattern as a signal and bring in the AT / support path.', best: true },
        { label: 'Call them out for being distant', feedback: 'Public pressure pushes a withdrawing athlete further away.' },
      ],
    },
    {
      id: 'lab-4',
      prompt: 'An athlete tells you they have a plan to hurt themselves after practice. Next move?',
      options: [
        { label: 'Finish practice, then check in', feedback: 'A stated plan is an emergency — it cannot wait until later.' },
        { label: 'Don\'t leave them alone; follow emergency steps and bring in the AT/clinical contact now', feedback: 'Yes. Stay with them, act immediately, hand off to the right care.', best: true },
        { label: 'Tell them it\'ll pass and send them home', feedback: 'Reassurance without action leaves an at-risk athlete alone.' },
      ],
    },
  ],
};

export const coachCourses: Course[] = [coachingTheNervousSystem, coachingTheMind];
