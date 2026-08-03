import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, HeartPulse, LockKeyhole, Watch, X } from 'lucide-react';
import PageHead from '../../components/PageHead';

const pageMeta = {
  pageId: 'pulsecheck-youth-info',
  pageTitle: 'PulseCheck Youth | Mental Skills for the Moments That Matter',
  metaDescription:
    'PulseCheck gives young athletes a private daily check-in, wearable context, and short mental skills they can practice before the pressure arrives.',
  ogTitle: 'PulseCheck Youth | Train the Mind for the Game',
  ogDescription:
    'A daily mental performance system built for young athletes, with 200+ skills, wearable context, and human support when repeated check-ins need a closer look.',
  ogImage: '/pulsecheck-youth/youth-info-og-branded.png',
  twitterCard: 'summary_large_image',
  lastUpdated: '2026-08-01T00:00:00.000Z',
};

const proPageMeta = {
  pageId: 'pulsecheck-pro-info',
  pageTitle: 'PulseCheck Pro | Train the Mind Like the Body.',
  metaDescription:
    'PulseCheck helps competitive athletes build focus, confidence, breathing, self-talk, and reset skills for the moments that decide performance.',
  ogTitle: 'PulseCheck Pro | Train the Mind Like the Body.',
  ogDescription:
    'An athlete-first mental performance system with 200+ skills, a structured curriculum, wearable context, and qualified support when several hard days need a closer look.',
  ogImage: '/pulsecheck-pro-og-clean.png',
  twitterCard: 'summary_large_image',
  lastUpdated: '2026-08-02T00:00:00.000Z',
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
    title: 'See what sleep and recovery add.',
    body: 'Sleep, heart rate, recovery, and training load add context from a connected wearable.',
  },
  {
    number: '03',
    label: 'TRAIN TODAY',
    title: 'Practice the priority skill.',
    body: 'Nora uses the athlete\'s curriculum, check-in, and body context to bring forward the skill that matters most for that athlete.',
  },
];

const proProcessSteps = [
  {
    number: '01',
    label: 'CHECK IN',
    title: 'Say what is true.',
    body: 'Name your energy, stress, confidence, and focus before training or competition.',
  },
  {
    number: '02',
    label: 'ADD CONTEXT',
    title: 'See what the body has handled.',
    body: 'Sleep, heart rate, recovery, and training load add context from a connected wearable.',
  },
  {
    number: '03',
    label: 'PRACTICE',
    title: 'Work on the priority skill.',
    body: 'Nora uses your curriculum, check-in, and body context to bring forward the skill that matters most.',
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

const proSkillNames = [
  'Mistake recovery',
  'Focus under pressure',
  'Confidence',
  'Competitive intensity',
  'Self-talk',
  'Visualization',
  'Breathing',
  'Pre-game routines',
];

const wearableDevices = [
  { name: 'WHOOP', image: '/pulsecheck-youth/wearables/whoop.png' },
  { name: 'Oura Ring', image: '/pulsecheck-youth/wearables/oura-ring.png' },
  { name: 'Fitbit Air', image: '/pulsecheck-youth/wearables/fitbit.png' },
  { name: 'Apple Watch', image: '/pulsecheck-youth/wearables/apple-watch.png' },
  { name: 'Polar 360', image: '/pulsecheck-youth/wearables/polar-360.png' },
];

type EducationStory = {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{
    number: string;
    title: string;
    body: string;
  }>;
  callout?: string;
  citation?: {
    label: string;
    href: string;
  };
};

const educationStories: EducationStory[] = [
  {
    id: 'skill-learning',
    eyebrow: 'How one skill gets learned',
    title: 'From a new idea to something an athlete can use.',
    intro:
      'PulseCheck teaches one clear skill at a time. The athlete learns what it is, sees it in a real sports moment, practices it with guidance, and carries it into the day.',
    sections: [
      {
        number: '01',
        title: 'Name it.',
        body: 'Give the skill a short name the athlete can remember when the moment gets loud.',
      },
      {
        number: '02',
        title: 'Understand it.',
        body: 'Explain what the skill changes and when it can help during practice, recovery, or competition.',
      },
      {
        number: '03',
        title: 'See it.',
        body: 'Show what the skill looks and sounds like when an athlete uses it well.',
      },
      {
        number: '04',
        title: 'Practice it calmly.',
        body: 'Follow a short guided activity before pressure makes the choice harder.',
      },
      {
        number: '05',
        title: 'Use it in the moment.',
        body: 'Take one short phrase or action into training or competition and return to it when it matters.',
      },
    ],
    callout:
      'Nora brings a skill back when the athlete\'s curriculum, check-in, and body context show it should come next.',
  },
  {
    id: 'five-minutes',
    eyebrow: 'What a day looks like',
    title: 'A short plan built around today.',
    intro:
      'The exact skills can change from day to day. The structure stays familiar, so the athlete always knows what comes next.',
    sections: [
      {
        number: '01',
        title: 'Check in.',
        body: 'The athlete names how they arrived: drained, off, okay, good, or locked in.',
      },
      {
        number: '02',
        title: 'Add body context.',
        body: 'A connected wearable can add sleep, heart rate, recovery, and training load.',
      },
      {
        number: '03',
        title: 'Get the priority skill.',
        body: 'Nora uses the athlete\'s curriculum, check-in, and body context to bring forward the skill that matters most.',
      },
      {
        number: '04',
        title: 'Follow the guidance.',
        body: 'The athlete practices breathing, focus, confidence, self-talk, or another useful skill.',
      },
      {
        number: '05',
        title: 'Take one action forward.',
        body: 'The session ends with something simple the athlete can remember later that day.',
      },
    ],
    callout: 'Most daily plans are designed to take about five minutes.',
  },
  {
    id: 'wearable-context',
    eyebrow: 'How wearable context works',
    title: 'The athlete speaks first. Sleep and recovery add another clue.',
    intro:
      'PulseCheck starts with the athlete\'s own answer. Wearable information helps Nora understand whether that answer lines up with sleep, recovery, heart rate, and recent training.',
    sections: [
      {
        number: '01',
        title: 'The athlete leads.',
        body: 'Mood, stress, energy, and confidence come directly from the person wearing the device.',
      },
      {
        number: '02',
        title: 'The body adds context.',
        body: 'Sleep, heart rate, recovery, and training load can show how much the body has handled lately.',
      },
      {
        number: '03',
        title: 'Nora looks at both.',
        body: 'A good mood with poor sleep may call for a calmer plan. Feeling off with steady sleep and recovery may call for focus or confidence work.',
      },
      {
        number: '04',
        title: 'The priority skill becomes a clear plan.',
        body: 'The athlete receives a short activity from their curriculum.',
      },
    ],
    callout:
      'Wearable information guides mental performance education. Medical decisions stay with qualified people.',
  },
  {
    id: 'research-explained',
    eyebrow: 'The research in plain language',
    title: 'What the 66% figure actually means.',
    intro:
      'In this study, one group physically trained a finger muscle and improved its strength by 53%. Another group only imagined making the same forceful movement and improved by 35%. That means the imagining group gained about two-thirds as much strength as the physical training group.',
    sections: [
      {
        number: '01',
        title: 'What the researchers did.',
        body: 'Eight adults imagined pushing their little finger as hard as possible. Six adults physically trained the same movement over the same 12 weeks.',
      },
      {
        number: '02',
        title: 'What changed.',
        body: 'The imagined-movement group became 35% stronger. The physical-training group became about 53% stronger.',
      },
      {
        number: '03',
        title: 'What it suggests.',
        body: 'The brain can improve how strongly it tells a muscle to work, even while the body stays still.',
      },
      {
        number: '04',
        title: 'Limits to keep in mind.',
        body: 'This was a small study of healthy young adults and a simple finger movement. The takeaway is general: mental practice can help train the brain-body connection.',
      },
    ],
    callout:
      'The study supports focused mental practice as one part of physical performance training.',
    citation: {
      label: 'Read Ranganathan et al. in Neuropsychologia',
      href: 'https://doi.org/10.1016/j.neuropsychologia.2003.11.018',
    },
  },
  {
    id: 'clinical-support',
    eyebrow: 'AuntEdna clinical support',
    title: 'When several hard days need a closer look.',
    intro:
      'One hard day can happen to any athlete. When difficult check-ins, poor sleep, or concerning answers keep showing up, the program can bring a qualified clinician into the review.',
    sections: [
      {
        number: '01',
        title: 'Several hard days appear.',
        body: 'The system looks for repeated changes and answers that suggest extra support may be needed.',
      },
      {
        number: '02',
        title: 'Program rules guide the handoff.',
        body: 'Each organization sets consent, safety, and escalation rules for the athletes it supports.',
      },
      {
        number: '03',
        title: 'A clinician reviews it.',
        body: 'A qualified person looks at the repeated changes and uses human judgment to understand what may be happening.',
      },
      {
        number: '04',
        title: 'The athlete connects to care.',
        body: 'The next step can be a check-in, a conversation with a trusted adult, or a connection to the right care.',
      },
    ],
    callout: 'PulseCheck can flag repeated changes. A qualified person decides what care is appropriate.',
  },
  {
    id: 'parent-trust',
    eyebrow: 'What parents should know',
    title: 'Clear roles help athletes feel safe.',
    intro:
      'PulseCheck is a guided mental performance system with structured lessons, private check-ins, and human support when repeated check-ins need review.',
    sections: [
      {
        number: '01',
        title: 'Nora follows a structured library.',
        body: 'Athletes receive guided lessons and activities written for specific mental skills and sports moments.',
      },
      {
        number: '02',
        title: 'Private answers receive protection.',
        body: 'The athlete can answer honestly. Parents and coaches see themes and next steps based on their role.',
      },
      {
        number: '03',
        title: 'Clinicians handle clinical care.',
        body: 'Diagnosis, treatment, and clinical decisions belong to qualified professionals.',
      },
      {
        number: '04',
        title: 'Caring adults stay involved.',
        body: 'Parents, coaches, and clinicians keep their responsibilities for the athlete and the choices around them.',
      },
    ],
    callout: 'A learning system for athletes, with clear roles and real people involved.',
  },
  {
    id: 'return-to-sport',
    eyebrow: 'For injured athletes',
    title: 'Support while they heal. Skills that stay useful after clearance.',
    intro:
      'An injury changes more than the body. PulseCheck can help an athlete stay engaged with the home plan, work through fear, and build skills that still matter when competition returns.',
    sections: [
      {
        number: '01',
        title: 'Keep the home plan moving.',
        body: 'A daily check-in can reveal changes in sleep, mood, energy, or motivation before the athlete begins the day\'s work.',
      },
      {
        number: '02',
        title: 'Practice confidence safely.',
        body: 'Guided visualization, breathing, and self-talk can help the athlete prepare for the drills, games, and return-to-play moments ahead.',
      },
      {
        number: '03',
        title: 'Return with useful skills.',
        body: 'The same focus, reset, and confidence skills can help after a mistake, before a whistle, or late in a close game.',
      },
      {
        number: '04',
        title: 'Leave with a habit.',
        body: 'A short daily practice can continue after discharge, giving the athlete a routine they already know how to use.',
      },
    ],
    callout:
      'Rehabilitation professionals guide physical clearance. PulseCheck supports the mental skills around the return.',
  },
];

const proEducationStories: EducationStory[] = [
  ...educationStories.map((story): EducationStory => {
    if (story.id === 'skill-learning') {
      return {
        ...story,
        eyebrow: 'How a skill becomes part of your game',
        title: 'Learn it clearly. Use it when the moment gets hard.',
        intro:
          'PulseCheck teaches one clear skill at a time. You learn what it is, see where it belongs in your sport, practice it with guidance, and take one useful action into the day.',
        callout:
          'Nora brings a skill forward when your curriculum, check-in, and body context show it should come next.',
      };
    }

    if (story.id === 'five-minutes') {
      return {
        ...story,
        eyebrow: 'What your daily plan looks like',
        title: 'A short plan connected to your goal.',
        intro:
          'The priority skill can change as you move through the curriculum. The structure stays familiar, so you always know what comes next.',
        sections: story.sections.map((section) => {
          if (section.number === '03') {
            return {
              ...section,
              body: 'Nora uses your curriculum, check-in, and body context to bring forward the skill that matters most.',
            };
          }
          return section;
        }),
      };
    }

    if (story.id === 'parent-trust') {
      return {
        id: story.id,
        eyebrow: 'For athletes and coaches',
        title: 'The athlete owns the work. The coach supports the environment.',
        intro:
          'Athletes need a private place to answer honestly and a clear reason to use each skill. Coaches need useful themes and shared language that help the work carry into practice.',
        sections: [
          {
            number: '01',
            title: 'The athlete sets the direction.',
            body: 'Goals, pressure moments, and the athlete\'s curriculum shape the work inside PulseCheck.',
          },
          {
            number: '02',
            title: 'Private answers stay protected.',
            body: 'Athletes can be honest. Coaches see themes and practical ways to support the team based on their role.',
          },
          {
            number: '03',
            title: 'The skill travels to practice.',
            body: 'Athletes leave with a short phrase or action they can use in a drill, game, or pressure moment.',
          },
          {
            number: '04',
            title: 'The coach creates room for the work.',
            body: 'A few protected minutes, consistent language, and follow-through help athletes build the habit.',
          },
        ],
        callout: 'Athlete buy-in grows when every skill connects to a goal the athlete cares about.',
      };
    }

    if (story.id === 'return-to-sport') {
      return {
        ...story,
        eyebrow: 'For injured athletes',
        title: 'Build confidence through the return.',
        intro:
          'Visualization, breathing, self-talk, and confidence work can help an athlete stay engaged during rehabilitation and prepare for the drills, games, and pressure that return after clearance.',
      };
    }

    return story;
  }),
  {
    id: 'competitive-edge',
    eyebrow: 'Competitive intensity',
    title: 'Catch the thought. Choose the next action.',
    intro:
      'A mindset change becomes useful when an athlete can name the thought that follows a mistake or pressure moment, choose a better message, and act on it right away.',
    sections: [
      {
        number: '01',
        title: 'The moment hits.',
        body: 'A mistake, a bad call, a slow start, or a big possession creates pressure fast.',
      },
      {
        number: '02',
        title: 'Catch the first thought.',
        body: 'The athlete notices the exact message running through the mind, such as “I blew it” or “I cannot miss again.”',
      },
      {
        number: '03',
        title: 'Choose a useful message.',
        body: 'A short cue such as “next ball,” “strong hands,” or “attack the space” points attention toward the next job.',
      },
      {
        number: '04',
        title: 'Put it into action.',
        body: 'One breath, one clear target, and one committed movement turn the new message into the next action.',
      },
    ],
    callout: 'Competitive intensity works best when the athlete can aim it at a clear action.',
  },
];

const boxBreathingPhases = [
  {
    key: 'inhale',
    label: 'Slowly inhale through your nose',
    shortLabel: 'Inhale',
    orbClass: 'yi-breathing-orb--inhale',
  },
  {
    key: 'hold-top',
    label: 'Hold it steady',
    shortLabel: 'Hold',
    orbClass: 'yi-breathing-orb--hold-top',
  },
  {
    key: 'exhale',
    label: 'Slowly exhale through your mouth',
    shortLabel: 'Exhale',
    orbClass: 'yi-breathing-orb--exhale',
  },
  {
    key: 'hold-bottom',
    label: 'Hold the calm',
    shortLabel: 'Hold',
    orbClass: 'yi-breathing-orb--hold-bottom',
  },
] as const;

const phaseSeconds = 4;
const boxBreathingCycles = 5;

const BoxBreathingPhoneDemo: React.FC = () => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const totalSeconds = boxBreathingPhases.length * phaseSeconds * boxBreathingCycles;

  useEffect(() => {
    if (isPaused) return undefined;
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => (current + 1) % totalSeconds);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPaused, totalSeconds]);

  const state = useMemo(() => {
    const loopSecond = elapsedSeconds % totalSeconds;
    const phaseIndex = Math.floor(loopSecond / phaseSeconds) % boxBreathingPhases.length;
    const cycle = Math.floor(loopSecond / (phaseSeconds * boxBreathingPhases.length)) + 1;
    const secondInPhase = loopSecond % phaseSeconds;
    const count = phaseSeconds - secondInPhase;
    const phase = boxBreathingPhases[phaseIndex];

    return {
      phase,
      phaseIndex,
      cycle,
      count,
      hr: Math.max(68, 74 - Math.floor(loopSecond / 18)),
      stability: Math.min(93, 86 + Math.floor(loopSecond / 13)),
      calm: Math.min(92, 80 + Math.floor(loopSecond / 10) + (phase.key === 'exhale' ? 1 : 0)),
    };
  }, [elapsedSeconds, totalSeconds]);

  const skipForward = () => {
    setElapsedSeconds((current) => {
      const currentPhaseStart = Math.floor(current / phaseSeconds) * phaseSeconds;
      return (currentPhaseStart + phaseSeconds) % totalSeconds;
    });
  };

  return (
    <div className="yi-breathing-phone-screen" aria-label="Live Box Breathing module demo">
      <div className="yi-breathing-status">
        <span>9:41</span>
        <div aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>

      <div className="yi-breathing-topbar" aria-hidden="true">
        <span>×</span>
        <span>⌁</span>
      </div>

      <div className="yi-breathing-metrics" aria-label="Current body readings">
        <div className="yi-breathing-metric yi-breathing-metric--hr">
          <span>♥ HR</span>
          <strong>{state.hr}<small> bpm</small></strong>
          <em>Steady</em>
        </div>
        <div className="yi-breathing-metric yi-breathing-metric--stability">
          <span>⌁ Stability</span>
          <strong>{state.stability}<small>/100</small></strong>
          <em>Steady</em>
        </div>
        <div className="yi-breathing-metric yi-breathing-metric--calm">
          <span>◐ Calm</span>
          <strong>{state.calm}<small>/100</small></strong>
          <em>Steady</em>
        </div>
      </div>

      <div className="yi-breathing-progress" aria-label={`Cycle ${state.cycle} of ${boxBreathingCycles}`}>
        {Array.from({ length: boxBreathingCycles }).map((_, index) => (
          <span
            key={index}
            className={index + 1 === state.cycle ? 'is-active' : index + 1 < state.cycle ? 'is-complete' : ''}
          />
        ))}
      </div>

      <div className="yi-breathing-stage" aria-live="polite">
        <div className={`yi-breathing-orb ${state.phase.orbClass}`}>
          <span>{state.count}</span>
        </div>
        <div className="yi-breathing-phase-track" aria-hidden="true">
          {boxBreathingPhases.map((phase, index) => (
            <span key={phase.key} className={index === state.phaseIndex ? 'is-active' : ''}>
              {phase.shortLabel}
            </span>
          ))}
        </div>
        <h2>{state.phase.label}</h2>
        <p>Cycle {state.cycle} of {boxBreathingCycles}</p>
      </div>

      <div className="yi-breathing-controls">
        <button
          type="button"
          aria-label={isPaused ? 'Resume Box Breathing' : 'Pause Box Breathing'}
          onClick={() => setIsPaused((current) => !current)}
        >
          {isPaused ? '▶' : 'Ⅱ'}
        </button>
        <button type="button" aria-label="Skip to next breath phase" onClick={skipForward}>
          ▶▶
        </button>
      </div>
    </div>
  );
};

type PulseCheckInfoPageProps = {
  audience?: 'youth' | 'pro';
};

export const PulseCheckYouthInfoPage: React.FC<PulseCheckInfoPageProps> = ({ audience = 'youth' }) => {
  const isPro = audience === 'pro';
  const [activeEducationId, setActiveEducationId] = useState<string | null>(null);
  const closeEducationButtonRef = useRef<HTMLButtonElement>(null);
  const lastEducationTriggerRef = useRef<HTMLButtonElement | null>(null);

  const activeEducationStories = isPro ? proEducationStories : educationStories;
  const activeProcessSteps = isPro ? proProcessSteps : processSteps;
  const activeSkillNames = isPro ? proSkillNames : skillNames;
  const activeEducation = activeEducationStories.find((story) => story.id === activeEducationId) ?? null;

  const openEducation = (id: string, trigger: HTMLButtonElement) => {
    lastEducationTriggerRef.current = trigger;
    setActiveEducationId(id);
  };

  const closeEducation = () => {
    setActiveEducationId(null);
    window.setTimeout(() => lastEducationTriggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!activeEducationId) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeEducationButtonRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveEducationId(null);
        window.setTimeout(() => lastEducationTriggerRef.current?.focus(), 0);
        return;
      }

      if (event.key !== 'Tab') return;
      const panel = closeEducationButtonRef.current?.closest('.yi-education-panel');
      const focusable = panel?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeEducationId]);

  return (
    <main className={`youth-info ${isPro ? 'pro-info' : ''}`}>
      <PageHead
        metaData={isPro ? proPageMeta : pageMeta}
        pageOgUrl={isPro ? 'https://pulsecheckmind.ai/pro-info' : 'https://pulsecheckmind.ai/youth-info'}
        pageOgImage={isPro ? '/pulsecheck-pro-og-clean.png' : '/pulsecheck-youth/youth-info-og-branded.png'}
        themeColor={isPro ? '#0b0b0e' : '#101015'}
        appleItunesAppArgument={isPro ? 'pulsecheck://pro' : 'pulsecheck://youth'}
      />
      <header className="yi-nav">
        <Link href={isPro ? '/pro-info' : '/youth-info'} className="yi-brand" aria-label={isPro ? 'PulseCheck Pro information' : 'PulseCheck Youth home'}>
          <img src="/pulsecheck-youth/pulsecheck-wordmark.png" alt="PulseCheck" />
        </Link>
        <span className="yi-nav-label">{isPro ? 'PRO / MENTAL PERFORMANCE' : 'YOUTH / MENTAL PERFORMANCE'}</span>
        <a className="yi-nav-link" href="#how-it-works">
          See how it works <ArrowDown size={15} />
        </a>
      </header>

      <section className="yi-hero">
        <img
          className="yi-hero-image"
          src={isPro ? '/pulsecheck-pro/hero-athletes.webp' : '/pulsecheck-youth/next-play.webp'}
          alt={isPro ? 'Two competitive athletes preparing before competition' : 'A young athlete focused on the field before the next play'}
        />
        <div className="yi-hero-shade" aria-hidden="true" />
        <div className="yi-grain" aria-hidden="true" />
        <div className="yi-hero-copy">
          <p className="yi-kicker yi-kicker--light">A DAILY MENTAL PERFORMANCE SYSTEM</p>
          <h1>
            TRAIN THE MIND<br />
            <span>LIKE THE BODY.</span>
          </h1>
          <p className="yi-hero-deck">
            {isPro
              ? 'Learn how to reset after mistakes, stay steady under pressure, and make the next decision with confidence.'
              : 'Short mental skills for mistakes, pressure, focus, and confidence.'}
          </p>
          <a className="yi-button yi-button--light" href="#dashboard">
            See the athlete experience <ArrowRight size={17} />
          </a>
        </div>
        <figure className="yi-hero-phone">
          <div className="yi-hero-phone-frame">
            <BoxBreathingPhoneDemo />
          </div>
          <figcaption>BOX BREATHING / LIVE PRACTICE</figcaption>
        </figure>
        <div className="yi-hero-caption" aria-hidden="true">
          <span>{isPro ? 'YOUR EDGE' : 'THE NEXT PLAY'}</span>
          <span>{isPro ? 'IS BUILT BEFORE THE MOMENT.' : 'STARTS BEFORE THE WHISTLE.'}</span>
        </div>
      </section>

      <section className="yi-system" id="dashboard">
        <div className="yi-system-copy">
          <p className="yi-kicker">{isPro ? 'PULSECHECK / PRO' : 'PULSECHECK / YOUTH'}</p>
          <h2>
            <span className="yi-number">200+</span>
            MENTAL SKILLS.<br />
            {isPro ? 'ONE PRIORITY AT A TIME.' : 'ONE CLEAR PLAN.'}
          </h2>
          <p className="yi-intro">
            {isPro
              ? 'You check in. PulseCheck uses that answer, your curriculum, and wearable context to bring forward the mental skill that matters most.'
              : <>Every day begins with a simple question: how do you feel? PulseCheck uses that answer,
                  sleep, recovery, heart rate, and the athlete&apos;s curriculum to bring forward the skill
                  that matters most.</>}
          </p>
          <div className="yi-skill-list" aria-label="Examples from the mental skills library">
            {activeSkillNames.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
          <button
            type="button"
            className="yi-learn-link"
            onClick={(event) => openEducation('skill-learning', event.currentTarget)}
          >
            <span>See how one skill gets learned</span>
            <i aria-hidden="true">+</i>
          </button>
          {isPro && (
            <figure className="yi-trust-photo">
              <img
                src="/pulsecheck-pro/team-conversation.webp"
                alt="Competitive athletes and a coach talking after training"
              />
              <figcaption>THE ATHLETE OWNS THE WORK / THE COACH SUPPORTS THE ENVIRONMENT</figcaption>
            </figure>
          )}
        </div>

        <figure className="yi-phone-figure">
          <div className="yi-phone-halo" aria-hidden="true" />
          {isPro ? (
            <img
              className="yi-pro-home-screenshot"
              src="/pulsecheck-pro/pro-home.png"
              alt="PulseCheck Pro dashboard showing today's mental training, the athlete check-in, and Nora's guidance"
            />
          ) : (
            <img
              src="/pulsecheck-youth/youth-dashboard.png"
              alt="PulseCheck youth dashboard showing a daily check-in and today's mental skill"
            />
          )}
          <figcaption>PULSECHECK / DASHBOARD</figcaption>
        </figure>
      </section>

      <section className="yi-process" id="how-it-works">
        <div className="yi-section-heading">
          <p className="yi-kicker">{isPro ? 'CHECK IN. ADD CONTEXT. PRACTICE.' : 'FEELING. BODY. SKILL.'}</p>
          <div>
            <h2>{isPro ? <>ONE CHECK-IN.<br />ONE PRIORITY SKILL.</> : <>ONE CHECK-IN.<br />A BETTER PLAN FOR TODAY.</>}</h2>
            <button
              type="button"
              className="yi-learn-link yi-learn-link--light"
              onClick={(event) => openEducation('five-minutes', event.currentTarget)}
            >
              <span>What happens in five minutes</span>
              <i aria-hidden="true">+</i>
            </button>
          </div>
        </div>
        <div className="yi-process-grid">
          {activeProcessSteps.map((step) => (
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
            src={isPro ? '/pulsecheck-pro/hero-athletes.webp' : '/pulsecheck-youth/hero-team.webp'}
            alt={isPro ? 'Two competitive athletes preparing together before competition' : 'Three young athletes preparing together before competition'}
          />
          <div className="yi-wearables-photo-shade" aria-hidden="true" />
          <div className="yi-wearables-story">
            <Watch size={34} strokeWidth={1.6} aria-hidden="true" />
            <p className="yi-kicker yi-kicker--light">WEARABLE CONTEXT</p>
            <h2>HOW YOU FEEL,<br /><em>WITH CONTEXT.</em></h2>
            <p>
              {isPro
                ? 'Your check-in leads. Sleep, heart rate, recovery, and training load add context so Nora can bring forward the skill that matters most.'
                : <>The athlete&apos;s check-in leads. Sleep, heart rate, recovery, and training load add
                    another clue so Nora can bring forward the skill that matters most for that athlete.</>}
            </p>
            <button
              type="button"
              className="yi-learn-link yi-learn-link--light"
              onClick={(event) => openEducation('wearable-context', event.currentTarget)}
            >
              <span>What does the wearable change?</span>
              <i aria-hidden="true">+</i>
            </button>
          </div>
        </div>
        <div className="yi-wearables-copy">
          <p className="yi-kicker">COMPATIBLE DEVICES</p>
          <h3>Works with the devices athletes already wear.</h3>
          <div className="yi-device-render" aria-hidden="true">
            <div className="yi-device-orbit" />
            <div className="yi-device-core">
              <span>PulseCheck</span>
              <strong>Daily Check-In</strong>
            </div>
            {wearableDevices.map((device, index) => (
              <span className={`yi-device-chip yi-device-chip--${index + 1}`} key={device.name}>
                {device.name}
              </span>
            ))}
          </div>
          <ul className="yi-device-list" aria-label="Compatible wearable devices">
            {wearableDevices.map((device) => (
              <li key={device.name}>
                <img src={device.image} alt="" aria-hidden="true" />
                <span>{device.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="yi-privacy">
        <div className="yi-privacy-mark"><LockKeyhole size={34} strokeWidth={1.45} /></div>
        <p className="yi-kicker">{isPro ? 'START WITH THE ATHLETE' : 'PRIVATE BY DESIGN'}</p>
        <h2>{isPro ? <>BUY-IN STARTS<br />WITH THEM.</> : <>HONESTY NEEDS<br />A SAFE PLACE.</>}</h2>
        <p className="yi-privacy-copy">
          {isPro
            ? 'Athletes use PulseCheck when each skill helps them reach a goal, handle pressure, or move toward the next level.'
            : <>Nora protects the athlete&apos;s private answers. Coaches see themes and clear ways to help.</>}
        </p>
        <div className="yi-privacy-rule" aria-hidden="true"><span>{isPro ? 'ATHLETE GOALS' : 'ATHLETE TRUST'}</span><i /><span>{isPro ? 'SKILLS FOR THE MOMENT' : 'USEFUL SUPPORT'}</span></div>
      </section>

      <section className="yi-trust" aria-labelledby="yi-trust-title">
        <div className="yi-trust-heading">
          <p className="yi-kicker">{isPro ? 'ATHLETE OWNERSHIP. COACH SUPPORT.' : 'CLEAR ROLES. REAL PEOPLE INVOLVED.'}</p>
          <h2 id="yi-trust-title">{isPro ? <>BUILT FOR<br />ATHLETES.</> : <>WHAT FAMILIES<br />CAN EXPECT.</>}</h2>
          <button
            type="button"
            className="yi-learn-link"
            onClick={(event) => openEducation('parent-trust', event.currentTarget)}
          >
            <span>{isPro ? 'See how athletes and coaches work together' : 'Read the parent guide'}</span>
            <i aria-hidden="true">+</i>
          </button>
        </div>
        <div className="yi-trust-grid">
          {isPro ? (
            <>
              <article>
                <span>01</span>
                <h3>Your goals lead</h3>
                <p>Each skill connects to a moment the athlete wants to handle better.</p>
              </article>
              <article>
                <span>02</span>
                <h3>Private space</h3>
                <p>Athletes answer honestly. Coaches see team themes based on their role.</p>
              </article>
              <article>
                <span>03</span>
                <h3>Skills transfer</h3>
                <p>A short phrase or action travels from the app into practice and competition.</p>
              </article>
              <article>
                <span>04</span>
                <h3>Coaches support</h3>
                <p>Shared language helps coaches reinforce the work while athlete ownership stays clear.</p>
              </article>
            </>
          ) : (
            <>
              <article>
                <span>01</span>
                <h3>Structured lessons</h3>
                <p>Nora guides athletes through a clear mental skills library.</p>
              </article>
              <article>
                <span>02</span>
                <h3>Private check-ins</h3>
                <p>Athletes can answer honestly. Parents and coaches see themes and next steps based on their role.</p>
              </article>
              <article>
                <span>03</span>
                <h3>Qualified review</h3>
                <p>Clinical questions and care decisions stay with qualified people.</p>
              </article>
              <article>
                <span>04</span>
                <h3>Adults stay involved</h3>
                <p>Parents, coaches, and clinicians keep caring for the athlete.</p>
              </article>
            </>
          )}
        </div>
      </section>

      <section className="yi-research">
        <div className="yi-research-story">
          <p className="yi-kicker">THE SURPRISING RESEARCH</p>
          <h2>{isPro ? <>THE BRAIN CAN TRAIN<br />THE MOVEMENT<br /><em>WHILE THE BODY STAYS STILL.</em></> : <>PICTURING THE MOVEMENT<br />MADE THE MUSCLE<br /><em>STRONGER.</em></>}</h2>
          <p className="yi-research-explainer">
            {isPro
              ? 'In one small 12-week study, adults who imagined a forceful finger movement gained 35% strength. The physical-training group gained 53%. The result suggests focused mental practice can strengthen the brain\'s command to the body.'
              : <>Every physical practice also teaches the brain. The surprise is that the brain can
                  practice the command while the body stays still. In one small 12-week study, imagined
                  finger movement produced 35% strength gains, compared with 53% from physical training.</>}
          </p>
          <div className="yi-research-actions">
            <button
              type="button"
              className="yi-learn-link"
              onClick={(event) => openEducation('research-explained', event.currentTarget)}
            >
              <span>Explain this research</span>
              <i aria-hidden="true">+</i>
            </button>
            <a
              className="yi-text-link"
              href="https://doi.org/10.1016/j.neuropsychologia.2003.11.018"
              target="_blank"
              rel="noreferrer"
            >
              Read the study <ArrowRight size={16} />
            </a>
          </div>
        </div>
        <div className="yi-research-stat">
          <strong>66%</strong>
          <p>THE IMAGINING GROUP GAINED ABOUT TWO-THIRDS AS MUCH STRENGTH AS THE PHYSICAL TRAINING GROUP</p>
          <a
            className="yi-research-citation"
            href="https://doi.org/10.1016/j.neuropsychologia.2003.11.018"
            target="_blank"
            rel="noreferrer"
          >
            IMAGINED MOVEMENT: 35% STRENGTH GAIN / PHYSICAL TRAINING: 53% / RANGANATHAN ET AL., 2004
          </a>
        </div>
      </section>

      <section className="yi-support">
        {!isPro && (
          <img
            className="yi-support-image"
            src="/pulsecheck-youth/support-team.webp"
            alt="A young athlete speaking with trusted adults in a gym"
          />
        )}
        <div className="yi-support-overlay" aria-hidden="true" />
        <div className="yi-support-content">
          <div className="yi-auntedna">
            <img src="/auntedna-mark.png" alt="AuntEdna" />
            <span>AUNTEDNA / CLINICAL SUPPORT</span>
          </div>
          <h2>{isPro ? <>WHEN SEVERAL HARD DAYS<br />KEEP SHOWING UP.</> : <>WHEN SEVERAL HARD DAYS<br />NEED A CLOSER LOOK.</>}</h2>
          <p>
            {isPro
              ? 'When difficult check-ins, poor sleep, or concerning answers continue, a qualified clinician can review what is happening and help connect the athlete to care.'
              : <>When difficult check-ins or poor sleep keep showing up, AuntEdna helps a qualified
                  clinician review what is happening and connect the athlete to care.</>}
          </p>
          <div className="yi-support-path" aria-label="Support path">
            <span><b>01</b>Check-ins</span>
            <i />
            <span><b>02</b>Review</span>
            <i />
            <span><b>03</b>Care</span>
          </div>
          <button
            type="button"
            className="yi-learn-link yi-learn-link--light"
            onClick={(event) => openEducation('clinical-support', event.currentTarget)}
          >
            <span>When does a clinician step in?</span>
            <i aria-hidden="true">+</i>
          </button>
        </div>
      </section>

      <section className="yi-recovery" aria-labelledby="yi-recovery-title">
        <div>
          <p className="yi-kicker">{isPro ? 'COMPETITIVE INTENSITY' : 'FOR INJURED ATHLETES'}</p>
          <h2 id="yi-recovery-title">{isPro ? <>BRING OUT THE DOG.<br /><em>TURN THAT EDGE INTO ACTION.</em></> : <>GETTING BACK.<br /><em>THEN GETTING BETTER.</em></>}</h2>
        </div>
        <div className="yi-recovery-copy">
          <p>
            {isPro
              ? 'That edge shows up in a decision: reset after a mistake, choose a clear target, and commit to the next action. PulseCheck teaches the breathing, self-talk, focus, and reset skills behind that response.'
              : <>During rehabilitation, PulseCheck can help an athlete stay engaged with the home plan,
                  work through fear, and prepare for the return. After clearance, those same skills help
                  with mistakes, focus, pressure, and confidence.</>}
          </p>
          <button
            type="button"
            className="yi-learn-link"
            onClick={(event) => openEducation(isPro ? 'competitive-edge' : 'return-to-sport', event.currentTarget)}
          >
            <span>{isPro ? 'See how mindset changes the next action' : 'See support through recovery'}</span>
            <i aria-hidden="true">+</i>
          </button>
        </div>
      </section>

      <section className="yi-close">
        <HeartPulse size={34} strokeWidth={1.5} aria-hidden="true" />
        <p className="yi-kicker">{isPro ? 'BUILT FOR THE ATHLETE' : 'BUILT FOR THE WHOLE ATHLETE'}</p>
        <h2>TRAIN THE MIND<br />LIKE THE BODY.</h2>
        <p>{isPro ? 'Give athletes a daily way to build focus, confidence, and a response they can use when competition gets hard.' : 'Give young athletes a skill they can practice today and use when practice or the game gets hard.'}</p>
        <a
          className="yi-button yi-button--dark"
          href={isPro ? 'mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Pro%20Demo' : 'mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Youth'}
        >
          Request a demo <ArrowRight size={17} />
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

      {activeEducation && (
        <div
          className="yi-education-layer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEducation();
          }}
        >
          <aside
            className="yi-education-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`yi-education-title-${activeEducation.id}`}
          >
            <header className="yi-education-panel-header">
              <span>{isPro ? 'PULSECHECK / DEEPER LOOK' : 'PULSECHECK / PARENT NOTES'}</span>
              <button
                ref={closeEducationButtonRef}
                type="button"
                aria-label={isPro ? 'Close deeper look' : 'Close parent notes'}
                onClick={closeEducation}
              >
                <X size={22} />
              </button>
            </header>
            <div className="yi-education-panel-body">
              <p className="yi-kicker">{activeEducation.eyebrow}</p>
              <h2 id={`yi-education-title-${activeEducation.id}`}>{activeEducation.title}</h2>
              <p className="yi-education-intro">{activeEducation.intro}</p>
              <div className="yi-education-sections">
                {activeEducation.sections.map((section) => (
                  <article key={section.number}>
                    <span>{section.number}</span>
                    <div>
                      <h3>{section.title}</h3>
                      <p>{section.body}</p>
                    </div>
                  </article>
                ))}
              </div>
              {activeEducation.callout && (
                <blockquote>{activeEducation.callout}</blockquote>
              )}
              {activeEducation.citation && (
                <a
                  className="yi-education-citation"
                  href={activeEducation.citation.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {activeEducation.citation.label} <ArrowRight size={16} />
                </a>
              )}
            </div>
          </aside>
        </div>
      )}

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
          width: min(700px, calc(100% - 42px));
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
        .yi-learn-link {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 13px;
          margin-top: 34px;
          padding: 0 0 8px;
          border: 0;
          border-bottom: 1px solid currentColor;
          color: var(--yi-ink);
          background: transparent;
          font: 700 12px/1.3 'DM Sans', Arial, sans-serif;
          text-align: left;
          cursor: pointer;
        }
        .yi-learn-link i {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border: 1px solid currentColor;
          border-radius: 50%;
          font-size: 16px;
          font-style: normal;
          font-weight: 400;
          line-height: 1;
          transition: color .2s ease, background .2s ease, transform .2s ease;
        }
        .yi-learn-link:hover i {
          color: var(--yi-paper);
          background: var(--yi-ink);
          transform: rotate(90deg);
        }
        .yi-learn-link--light { color: #fff; }
        .yi-learn-link--light:hover i { color: var(--yi-ink); background: #fff; }
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
        .yi-hero-phone {
          position: absolute;
          z-index: 3;
          right: clamp(34px, 8vw, 144px);
          top: clamp(110px, 15vh, 160px);
          width: clamp(260px, 22vw, 340px);
          margin: 0;
          color: #fff;
        }
        .yi-hero-phone::before {
          content: "";
          position: absolute;
          inset: 9% -18% 7%;
          z-index: 0;
          border-radius: 999px;
          background: rgba(111, 85, 238, .18);
          filter: blur(34px);
        }
        .yi-hero-phone-frame {
          position: relative;
          z-index: 1;
          padding: 8px;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 45px;
          background: rgba(6,7,10,.78);
          box-shadow: 0 55px 90px rgba(0,0,0,.52);
          overflow: hidden;
        }
        .yi-breathing-phone-screen {
          position: relative;
          width: 100%;
          aspect-ratio: 864 / 1824;
          display: flex;
          flex-direction: column;
          padding: 24px 16px 22px;
          border-radius: 37px;
          border: 1px solid rgba(255,255,255,.12);
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 48%, rgba(40, 214, 232, .22), transparent 28%),
            radial-gradient(circle at 55% 34%, rgba(111, 85, 238, .14), transparent 36%),
            linear-gradient(180deg, #071823 0%, #05171d 43%, #061219 100%);
          color: #eef3f5;
          font-family: 'DM Sans', Arial, sans-serif;
        }
        .yi-breathing-phone-screen::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(255,255,255,.04), transparent 28%, rgba(255,255,255,.05) 55%, transparent),
            radial-gradient(circle at 50% 42%, rgba(43, 218, 235, .18), transparent 24%);
          opacity: .82;
        }
        .yi-breathing-status,
        .yi-breathing-topbar,
        .yi-breathing-metrics,
        .yi-breathing-progress,
        .yi-breathing-stage,
        .yi-breathing-controls {
          position: relative;
          z-index: 2;
        }
        .yi-breathing-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          font-size: 14px;
          font-weight: 800;
        }
        .yi-breathing-status div {
          display: flex;
          align-items: end;
          gap: 4px;
        }
        .yi-breathing-status i {
          display: block;
          width: 4px;
          height: 8px;
          border-radius: 99px;
          background: rgba(255,255,255,.92);
        }
        .yi-breathing-status i:nth-child(2) { height: 11px; }
        .yi-breathing-status i:nth-child(3) {
          width: 18px;
          height: 9px;
          border: 1px solid rgba(255,255,255,.84);
          background: #d9ff2f;
        }
        .yi-breathing-topbar {
          display: flex;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .yi-breathing-topbar span,
        .yi-breathing-controls button {
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          color: rgba(255,255,255,.9);
          background: rgba(255,255,255,.1);
          cursor: pointer;
        }
        .yi-breathing-topbar span {
          width: 42px;
          height: 42px;
          font-size: 24px;
          line-height: 1;
        }
        .yi-breathing-topbar span:last-child {
          font-size: 18px;
        }
        .yi-breathing-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 7px;
        }
        .yi-breathing-metric {
          min-height: 76px;
          padding: 10px 8px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 11px;
          background: rgba(10, 32, 40, .72);
          box-shadow: inset 0 -18px 25px rgba(30, 220, 232, .04);
        }
        .yi-breathing-metric--hr { border-color: rgba(255, 64, 102, .64); }
        .yi-breathing-metric--stability { border-color: rgba(54, 132, 255, .62); }
        .yi-breathing-metric--calm { border-color: rgba(197, 255, 39, .55); }
        .yi-breathing-metric span {
          display: block;
          margin-bottom: 12px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .yi-breathing-metric strong {
          display: block;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: -.02em;
        }
        .yi-breathing-metric small {
          color: rgba(255,255,255,.68);
          font-size: 10px;
          font-weight: 800;
        }
        .yi-breathing-metric em {
          display: block;
          margin-top: 7px;
          color: rgba(255,255,255,.45);
          font-size: 9px;
          font-style: normal;
          font-weight: 700;
        }
        .yi-breathing-progress {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin: auto 0 30px;
        }
        .yi-breathing-progress span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(40, 214, 232, .22);
          transition: transform .25s ease, background .25s ease, box-shadow .25s ease;
        }
        .yi-breathing-progress span.is-active {
          background: #2ad7e8;
          box-shadow: 0 0 14px rgba(42, 215, 232, .84);
          transform: scale(1.1);
        }
        .yi-breathing-progress span.is-complete {
          background: rgba(42, 215, 232, .5);
        }
        .yi-breathing-stage {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .yi-breathing-orb {
          width: 142px;
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background:
            radial-gradient(circle at 38% 30%, rgba(255,255,255,.42), transparent 23%),
            linear-gradient(180deg, #43e2ef, #1fb7cf);
          box-shadow:
            0 0 0 22px rgba(43, 218, 235, .06),
            0 0 55px rgba(43, 218, 235, .42),
            inset 0 -18px 26px rgba(0,0,0,.08);
          transition: transform 1s ease-in-out, box-shadow 1s ease-in-out;
        }
        .yi-breathing-orb span {
          color: #fff;
          font-size: 58px;
          font-weight: 900;
          line-height: 1;
        }
        .yi-breathing-orb--inhale {
          transform: scale(1.12);
          box-shadow:
            0 0 0 34px rgba(43, 218, 235, .08),
            0 0 76px rgba(43, 218, 235, .54),
            inset 0 -18px 26px rgba(0,0,0,.08);
        }
        .yi-breathing-orb--hold-top {
          transform: scale(1.16);
        }
        .yi-breathing-orb--exhale {
          transform: scale(.82);
          box-shadow:
            0 0 0 13px rgba(43, 218, 235, .05),
            0 0 34px rgba(43, 218, 235, .34),
            inset 0 -18px 26px rgba(0,0,0,.08);
        }
        .yi-breathing-orb--hold-bottom {
          transform: scale(.86);
        }
        .yi-breathing-phase-track {
          display: grid;
          grid-template-columns: repeat(4, auto);
          gap: 9px;
          margin: 27px 0 16px;
        }
        .yi-breathing-phase-track span {
          color: rgba(255,255,255,.33);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
          transition: color .25s ease;
        }
        .yi-breathing-phase-track span.is-active {
          color: #fff;
        }
        .yi-breathing-stage h2 {
          max-width: 260px;
          margin: 0;
          color: #fff;
          font: 800 17px/1.25 'DM Sans', Arial, sans-serif;
          letter-spacing: -.04em;
        }
        .yi-breathing-stage p {
          margin: 13px 0 0;
          color: rgba(255,255,255,.5);
          font-size: 12px;
          font-weight: 700;
        }
        .yi-breathing-controls {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: auto;
        }
        .yi-breathing-controls button {
          width: 48px;
          height: 48px;
          font-size: 18px;
          font-weight: 900;
          transition: transform .2s ease, background .2s ease;
        }
        .yi-breathing-controls button:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,.15);
        }
        .yi-hero-phone figcaption {
          position: relative;
          z-index: 2;
          margin-top: 13px;
          text-align: center;
          color: rgba(255,255,255,.78);
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

        .yi-phone-figure > img.yi-pro-home-screenshot {
          overflow: hidden;
          border: 8px solid #1c1e24;
          border-radius: 11%;
          background: #050608;
          box-shadow: 0 55px 89px rgba(15, 12, 18, .32);
          filter: none;
        }

        .yi-process { padding: 144px clamp(34px, 7vw, 110px); color: #fff; background: var(--yi-ink); }
        .yi-section-heading { display: grid; grid-template-columns: .45fr 1fr; gap: 55px; align-items: end; margin-bottom: 89px; }
        .yi-section-heading > div { max-width: 850px; }
        .yi-section-heading h2 { max-width: 850px; margin: 0; font-size: clamp(64px, 7.2vw, 118px); line-height: .88; }
        .yi-process-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid rgba(255,255,255,.28); }
        .yi-process-card { min-height: 360px; padding: 34px; border-right: 1px solid rgba(255,255,255,.28); }
        .yi-process-card:first-child { border-left: 1px solid rgba(255,255,255,.28); }
        .yi-process-index { display: flex; align-items: baseline; gap: 13px; margin-bottom: 89px; }
        .yi-process-index span { color: #a987ff; font: 400 55px/1 'Bebas Neue', sans-serif; }
        .yi-process-index small { font-size: 9px; font-weight: 700; letter-spacing: .18em; }
        .yi-process-card h3 { margin: 0 0 13px; font: 400 clamp(34px, 3vw, 48px)/1 'Bebas Neue', sans-serif; }
        .yi-process-card p { max-width: 340px; margin: 0; color: #aaa7a2; font-size: 15px; line-height: 1.65; }

        .yi-wearables { display: grid; grid-template-columns: 1.08fr .92fr; min-height: 820px; background: var(--yi-ink); }
        .yi-wearables-photo { position: relative; min-height: 640px; overflow: hidden; color: #fff; }
        .yi-wearables-photo img { width: 100%; height: 100%; object-fit: cover; filter: saturate(.32) sepia(.18) contrast(1.05); }
        .yi-wearables-photo-shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(8,8,11,.86) 0%, rgba(8,8,11,.53) 46%, rgba(8,8,11,.2) 76%),
            linear-gradient(0deg, rgba(8,8,11,.84) 0%, rgba(8,8,11,.16) 62%);
        }
        .yi-wearables-story {
          position: absolute;
          left: clamp(34px, 7vw, 110px);
          right: clamp(34px, 7vw, 110px);
          bottom: clamp(55px, 8vw, 110px);
          max-width: 660px;
        }
        .yi-wearables-story > svg { margin-bottom: 34px; }
        .yi-wearables h2 { margin: 0 0 34px; font-size: clamp(64px, 6.4vw, 105px); line-height: .86; }
        .yi-wearables h2 em, .yi-research h2 em { font-family: 'Playfair Display', Georgia, serif; font-weight: 600; }
        .yi-wearables-story > p:not(.yi-kicker) { max-width: 560px; margin: 0; color: rgba(255,255,255,.82); font-size: 17px; line-height: 1.72; }
        .yi-wearables-copy {
          align-self: stretch;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 89px clamp(34px, 7vw, 110px) 89px clamp(34px, 6vw, 89px);
          color: var(--yi-ink);
          background: #d9d0f1;
        }
        .yi-wearables-copy h3 {
          max-width: 570px;
          margin: 0;
          font: 400 clamp(52px, 5.4vw, 86px)/.9 'Bebas Neue', Impact, sans-serif;
          letter-spacing: -.02em;
          text-wrap: balance;
        }
        .yi-device-render {
          position: relative;
          width: min(100%, 520px);
          aspect-ratio: 1.12;
          margin: 55px 0 34px;
          border: 1px solid rgba(17,17,21,.2);
          background:
            radial-gradient(circle at 50% 47%, rgba(111,85,238,.26), transparent 31%),
            radial-gradient(circle at 50% 50%, rgba(255,255,255,.58), transparent 48%);
          overflow: hidden;
        }
        .yi-device-render::before {
          content: "";
          position: absolute;
          inset: 21px;
          border: 1px solid rgba(17,17,21,.13);
        }
        .yi-device-orbit {
          position: absolute;
          inset: 21%;
          border: 1px solid rgba(17,17,21,.24);
          border-radius: 50%;
        }
        .yi-device-orbit::before,
        .yi-device-orbit::after {
          content: "";
          position: absolute;
          inset: 19%;
          border: 1px solid rgba(17,17,21,.14);
          border-radius: 50%;
        }
        .yi-device-orbit::after {
          inset: -34%;
          border-style: dashed;
          opacity: .52;
        }
        .yi-device-core {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 34%;
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 50%;
          color: #fff;
          background: var(--yi-ink);
          box-shadow: 0 21px 55px rgba(17,17,21,.22);
          transform: translate(-50%, -50%);
        }
        .yi-device-core span { font-size: 9px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
        .yi-device-core strong { font: 400 34px/.9 'Bebas Neue', Impact, sans-serif; letter-spacing: -.02em; }
        .yi-device-chip {
          position: absolute;
          min-width: 110px;
          padding: 10px 14px;
          border: 1px solid rgba(17,17,21,.28);
          border-radius: 999px;
          color: var(--yi-ink);
          background: rgba(245,242,234,.7);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .11em;
          text-align: center;
          text-transform: uppercase;
          box-shadow: 0 13px 34px rgba(17,17,21,.09);
          animation: yiDeviceFloat 8s ease-in-out infinite;
        }
        .yi-device-chip--1 { left: 8%; top: 16%; animation-delay: -.7s; }
        .yi-device-chip--2 { right: 7%; top: 17%; animation-delay: -2.2s; }
        .yi-device-chip--3 { right: 6%; top: 58%; animation-delay: -3.4s; }
        .yi-device-chip--4 { left: 11%; bottom: 13%; animation-delay: -4.6s; }
        .yi-device-chip--5 { left: 50%; bottom: 6%; transform: translateX(-50%); animation-name: yiDeviceFloatCenter; animation-delay: -1.5s; }
        @keyframes yiDeviceFloat {
          0%, 100% { transform: translate3d(0,0,0); }
          50% { transform: translate3d(0,-7px,0); }
        }
        @keyframes yiDeviceFloatCenter {
          0%, 100% { transform: translate3d(-50%,0,0); }
          50% { transform: translate3d(-50%,-7px,0); }
        }
        .yi-device-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          width: min(100%, 520px);
          margin: 0;
          padding: 0;
          border-top: 1px solid rgba(17,17,21,.22);
          list-style: none;
        }
        .yi-device-list li {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 17px 0;
          border-bottom: 1px solid rgba(17,17,21,.22);
          color: #2f2a35;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .yi-device-list img {
          width: 72px;
          height: 55px;
          object-fit: contain;
          flex: 0 0 auto;
          filter: drop-shadow(0 8px 11px rgba(17,17,21,.16));
        }
        .yi-device-list li:nth-child(even) { padding-left: 21px; border-left: 1px solid rgba(17,17,21,.16); }

        .yi-privacy { position: relative; padding: 144px clamp(34px, 8vw, 144px); background: var(--yi-paper); }
        .yi-privacy-mark { width: 55px; height: 55px; display: grid; place-items: center; margin-bottom: 34px; border: 1px solid var(--yi-ink); border-radius: 50%; }
        .yi-privacy h2 { max-width: 1020px; margin: 0; font-size: clamp(82px, 11vw, 180px); line-height: .81; }
        .yi-privacy-copy { max-width: 630px; margin: 55px 0 0 auto; font: 600 italic clamp(22px, 2.3vw, 34px)/1.4 'Playfair Display', Georgia, serif; }
        .yi-privacy-rule { display: flex; align-items: center; gap: 21px; margin-top: 89px; font-size: 10px; font-weight: 700; letter-spacing: .16em; }
        .yi-privacy-rule i { height: 1px; flex: 1; background: var(--yi-line); }

        .yi-trust {
          display: grid;
          grid-template-columns: minmax(310px, .76fr) minmax(0, 1.24fr);
          gap: clamp(55px, 7vw, 110px);
          padding: 110px clamp(34px, 7vw, 110px);
          border-top: 1px solid var(--yi-line);
          color: var(--yi-ink);
          background: #d9d0f1;
        }
        .yi-trust-heading h2 {
          margin: 0;
          font: 400 clamp(66px, 6.4vw, 102px)/.84 'Bebas Neue', Impact, sans-serif;
          letter-spacing: -.025em;
        }
        .yi-trust-photo {
          margin: 55px 0 0;
          overflow: hidden;
          border: 1px solid rgba(16,16,21,.28);
          background: var(--yi-ink);
        }
        .yi-trust-photo img {
          width: 100%;
          aspect-ratio: 16 / 10;
          object-fit: cover;
          object-position: center;
          filter: saturate(.4) sepia(.12) contrast(1.08);
        }
        .yi-trust-photo figcaption {
          padding: 13px;
          color: #fff;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .13em;
          line-height: 1.5;
        }
        .yi-trust-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          border-top: 1px solid rgba(16,16,21,.28);
          border-left: 1px solid rgba(16,16,21,.28);
        }
        .yi-trust-grid article {
          min-height: 220px;
          padding: 34px;
          border-right: 1px solid rgba(16,16,21,.28);
          border-bottom: 1px solid rgba(16,16,21,.28);
        }
        .yi-trust-grid article > span {
          display: block;
          margin-bottom: 34px;
          color: var(--yi-purple);
          font: 400 36px/1 'Bebas Neue', Impact, sans-serif;
        }
        .yi-trust-grid h3 {
          margin: 0 0 13px;
          font: 400 31px/1 'Bebas Neue', Impact, sans-serif;
          letter-spacing: -.01em;
        }
        .yi-trust-grid p {
          max-width: 290px;
          margin: 0;
          color: #56505d;
          font-size: 14px;
          line-height: 1.55;
        }

        .yi-research { display: grid; grid-template-columns: 1.12fr .88fr; min-height: 780px; border-top: 1px solid var(--yi-line); background: var(--yi-paper); }
        .yi-research-story { padding: 110px clamp(34px, 7vw, 110px); }
        .yi-research h2 { margin: 0 0 34px; font-size: clamp(64px, 7.2vw, 116px); line-height: .86; }
        .yi-research-explainer { max-width: 640px; margin: 0 0 34px; color: #4d4943; font-size: 17px; line-height: 1.72; }
        .yi-text-link { display: inline-flex; align-items: center; gap: 8px; padding-bottom: 6px; border-bottom: 1px solid currentColor; text-decoration: none; font-size: 12px; font-weight: 700; }
        .yi-research-actions { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 21px 34px; }
        .yi-research-actions .yi-learn-link { margin-top: 0; }
        .yi-research-stat { display: flex; flex-direction: column; justify-content: center; padding: 89px; color: #fff; background: var(--yi-purple); }
        .yi-research-stat strong { font: 400 clamp(150px, 17vw, 300px)/.78 'Bebas Neue', sans-serif; letter-spacing: -.04em; }
        .yi-research-stat p { max-width: 480px; margin: 55px 0 89px; font: 400 clamp(30px, 3vw, 48px)/1 'Bebas Neue', sans-serif; }
        .yi-research-citation {
          width: fit-content;
          color: rgba(255,255,255,.84);
          border-bottom: 1px solid rgba(255,255,255,.36);
          padding-bottom: 6px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .15em;
          text-decoration: none;
          transition: color .2s ease, border-color .2s ease;
        }
        .yi-research-citation:hover {
          color: #fff;
          border-color: #fff;
        }

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

        .yi-recovery {
          display: grid;
          grid-template-columns: minmax(0, 1.16fr) minmax(340px, .84fr);
          align-items: end;
          gap: clamp(55px, 8vw, 144px);
          padding: 110px clamp(34px, 7vw, 110px);
          color: var(--yi-ink);
          background: #d9d0f1;
        }
        .yi-recovery h2 {
          margin: 0;
          font: 400 clamp(68px, 7.4vw, 118px)/.85 'Bebas Neue', Impact, sans-serif;
          letter-spacing: -.025em;
        }
        .yi-recovery h2 em {
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 600;
        }
        .yi-recovery-copy > p {
          max-width: 610px;
          margin: 0;
          color: #4f4956;
          font-size: 17px;
          line-height: 1.72;
        }

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

        .yi-education-layer {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: flex;
          justify-content: flex-end;
          background: rgba(6, 6, 9, .72);
          backdrop-filter: blur(10px);
          animation: yiEducationFade .24s ease both;
        }
        .yi-education-panel {
          width: min(660px, 48vw);
          height: 100svh;
          overflow-y: auto;
          color: var(--yi-ink);
          background: var(--yi-paper);
          box-shadow: -34px 0 89px rgba(0,0,0,.28);
          animation: yiEducationPanelIn .42s cubic-bezier(.22,.8,.26,1) both;
          overscroll-behavior: contain;
        }
        .yi-education-panel-header {
          position: sticky;
          z-index: 2;
          top: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 76px;
          padding: 13px clamp(21px, 4vw, 55px);
          border-bottom: 1px solid var(--yi-line);
          background: rgba(240,237,228,.94);
          backdrop-filter: blur(14px);
        }
        .yi-education-panel-header > span {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .18em;
        }
        .yi-education-panel-header button {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid var(--yi-ink);
          border-radius: 50%;
          color: var(--yi-ink);
          background: transparent;
          cursor: pointer;
          transition: color .2s ease, background .2s ease, transform .2s ease;
        }
        .yi-education-panel-header button:hover {
          color: var(--yi-paper);
          background: var(--yi-ink);
          transform: rotate(90deg);
        }
        .yi-education-panel-body { padding: 89px clamp(34px, 5vw, 76px) 110px; }
        .yi-education-panel-body > h2 {
          max-width: 570px;
          margin: 0;
          font: 400 clamp(58px, 5.2vw, 82px)/.88 'Bebas Neue', Impact, sans-serif;
          letter-spacing: -.025em;
        }
        .yi-education-intro {
          max-width: 550px;
          margin: 34px 0 55px;
          color: #47433d;
          font-size: 18px;
          line-height: 1.7;
        }
        .yi-education-sections { border-top: 1px solid var(--yi-line); }
        .yi-education-sections article {
          display: grid;
          grid-template-columns: 55px 1fr;
          gap: 21px;
          padding: 34px 0;
          border-bottom: 1px solid var(--yi-line);
        }
        .yi-education-sections article > span {
          color: var(--yi-purple);
          font: 400 34px/1 'Bebas Neue', Impact, sans-serif;
        }
        .yi-education-sections h3 {
          margin: 0 0 8px;
          font: 400 29px/1 'Bebas Neue', Impact, sans-serif;
          letter-spacing: -.01em;
        }
        .yi-education-sections p {
          margin: 0;
          color: #5f5a53;
          font-size: 15px;
          line-height: 1.65;
        }
        .yi-education-panel blockquote {
          position: relative;
          margin: 55px 0 0;
          padding: 34px 34px 34px 55px;
          color: #fff;
          background: var(--yi-ink);
          font: 600 italic 22px/1.5 'Playfair Display', Georgia, serif;
        }
        .yi-education-panel blockquote::before {
          content: "";
          position: absolute;
          left: 21px;
          top: 34px;
          bottom: 34px;
          width: 3px;
          background: var(--yi-purple);
        }
        .yi-education-citation {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 34px;
          padding-bottom: 6px;
          border-bottom: 1px solid currentColor;
          color: var(--yi-ink);
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }
        @keyframes yiEducationFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes yiEducationPanelIn {
          from { transform: translate3d(100%,0,0); }
          to { transform: translate3d(0,0,0); }
        }

        .pro-info {
          --yi-ink: #090a0e;
          --yi-paper: #e9e5dc;
          --yi-lavender: #c8c2b9;
          --yi-purple: #6b2f3f;
          --yi-muted: #716e72;
          --yi-line: rgba(9, 10, 14, .22);
        }
        .pro-info .yi-hero-image {
          object-position: 50% center;
          filter: saturate(.46) sepia(.2) contrast(1.1) brightness(.78);
        }
        .pro-info .yi-hero-shade {
          background:
            linear-gradient(90deg, rgba(5,6,9,.91) 0%, rgba(5,6,9,.58) 45%, rgba(5,6,9,.08) 76%),
            linear-gradient(0deg, rgba(5,6,9,.86) 0%, transparent 52%);
        }
        .pro-info .yi-hero-phone::before { background: rgba(107, 47, 63, .28); }
        .pro-info .yi-system { background: #e9e5dc; }
        .pro-info .yi-system .yi-intro,
        .pro-info .yi-research-explainer,
        .pro-info .yi-close > p:not(.yi-kicker) { color: #4b4845; }
        .pro-info .yi-phone-halo { background: #cbc2b7; }
        .pro-info .yi-process-index span { color: #c995a2; }
        .pro-info .yi-process-card p { color: #aaa7a2; }
        .pro-info .yi-wearables-photo img {
          object-position: 64% center;
          filter: saturate(.42) sepia(.12) contrast(1.08) brightness(.76);
        }
        .pro-info .yi-wearables-copy { background: #c8c2b9; }
        .pro-info .yi-device-render {
          background:
            radial-gradient(circle at 50% 47%, rgba(107,47,63,.28), transparent 31%),
            radial-gradient(circle at 50% 50%, rgba(255,255,255,.46), transparent 48%);
        }
        .pro-info .yi-trust { background: #c8c2b9; }
        .pro-info .yi-trust-grid p { color: #454149; }
        .pro-info .yi-research-stat { background: #6b2f3f; }
        .pro-info .yi-support-image { object-position: 58% center; }
        .pro-info .yi-support-overlay {
          background:
            linear-gradient(90deg, rgba(7,7,10,.98) 0%, rgba(7,7,10,.9) 49%, rgba(7,7,10,.24) 82%),
            linear-gradient(0deg, rgba(7,7,10,.78), transparent 60%);
        }
        .pro-info .yi-support {
          background:
            radial-gradient(circle at 82% 28%, rgba(107,47,63,.3), transparent 28rem),
            linear-gradient(135deg, #090a0e 0%, #17121b 100%);
        }
        .pro-info .yi-recovery {
          color: #f5f2ec;
          background: #28202f;
        }
        .pro-info .yi-recovery h2 em { color: #d7c4c8; }
        .pro-info .yi-recovery-copy > p { color: #d0cbd3; }
        .pro-info .yi-recovery .yi-learn-link { color: #fff; }
        .pro-info .yi-recovery .yi-learn-link:hover i { color: #28202f; background: #fff; }
        .pro-info .yi-education-panel-header { background: rgba(233,229,220,.94); }
        .pro-info .yi-education-intro { color: #47433d; }
        .pro-info .yi-education-sections p { color: #5b5650; }

        @media (max-width: 900px) {
          .yi-nav { grid-template-columns: 1fr auto; min-height: 76px; }
          .yi-nav-label { display: none; }
          .yi-system { grid-template-columns: 1fr 320px; gap: 34px; padding-inline: 34px; }
          .yi-process-card { padding: 26px 21px; }
          .yi-wearables { grid-template-columns: 1fr; }
          .yi-wearables-photo { min-height: 560px; }
          .yi-wearables-copy { max-width: none; }
          .yi-device-render { width: min(100%, 560px); }
          .yi-trust, .yi-recovery { grid-template-columns: 1fr; }
          .yi-research { grid-template-columns: 1fr; }
          .yi-research-stat { min-height: 620px; }
        }

        @media (max-width: 680px) {
          .yi-nav { padding: 17px 21px; }
          .yi-brand { width: 154px; }
          .yi-nav-link { font-size: 9px; letter-spacing: .11em; }
          .yi-hero { display: block; min-height: auto; padding-bottom: 55px; }
          .yi-hero-image { object-position: 57% 50%; }
          .pro-info .yi-hero-image { object-position: 38% 50%; }
          .yi-hero-shade { background: linear-gradient(0deg, rgba(7,7,10,.97) 0%, rgba(7,7,10,.72) 58%, rgba(7,7,10,.25) 100%); }
          .yi-hero-copy { width: calc(100% - 42px); margin: 0 21px; padding: 126px 0 0; }
          .yi-hero h1 { font-size: clamp(67px, 22vw, 94px); line-height: .82; }
          .yi-mobile-break { display: block; }
          .yi-hero-deck { max-width: 320px; margin: 26px 0; font-size: 16px; }
          .yi-button { width: 100%; }
          .yi-hero-phone {
            position: relative;
            right: auto;
            top: auto;
            bottom: auto;
            width: min(76vw, 300px);
            margin: 55px auto 0;
            transform: none;
          }
          .yi-hero-phone-frame {
            padding: 6px;
            border-radius: 34px;
          }
          .yi-breathing-phone-screen {
            padding: 20px 13px 18px;
            border-radius: 29px;
          }
          .yi-breathing-status {
            margin-bottom: 13px;
            font-size: 12px;
          }
          .yi-breathing-topbar {
            margin-bottom: 18px;
          }
          .yi-breathing-topbar span {
            width: 36px;
            height: 36px;
            font-size: 21px;
          }
          .yi-breathing-metrics { gap: 5px; }
          .yi-breathing-metric {
            min-height: 65px;
            padding: 8px 6px;
            border-radius: 10px;
          }
          .yi-breathing-metric span {
            margin-bottom: 9px;
            font-size: 7px;
          }
          .yi-breathing-metric strong { font-size: 13px; }
          .yi-breathing-metric small { font-size: 8px; }
          .yi-breathing-metric em { font-size: 8px; }
          .yi-breathing-progress {
            gap: 6px;
            margin-bottom: 23px;
          }
          .yi-breathing-progress span {
            width: 7px;
            height: 7px;
          }
          .yi-breathing-orb { width: 118px; }
          .yi-breathing-orb span { font-size: 48px; }
          .yi-breathing-phase-track {
            gap: 7px;
            margin: 22px 0 12px;
          }
          .yi-breathing-phase-track span { font-size: 7px; }
          .yi-breathing-stage h2 { font-size: 15px; }
          .yi-breathing-stage p { font-size: 11px; }
          .yi-breathing-controls {
            gap: 16px;
          }
          .yi-breathing-controls button {
            width: 42px;
            height: 42px;
            font-size: 16px;
          }
          .yi-hero-phone figcaption { font-size: 8px; letter-spacing: .13em; }
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

          .yi-wearables-photo { min-height: 620px; }
          .yi-wearables-photo img { object-position: 60% center; }
          .yi-wearables-photo-shade {
            background:
              linear-gradient(0deg, rgba(8,8,11,.94) 0%, rgba(8,8,11,.72) 52%, rgba(8,8,11,.2) 100%),
              linear-gradient(90deg, rgba(8,8,11,.58), rgba(8,8,11,.05));
          }
          .yi-wearables-story { left: 21px; right: 21px; bottom: 55px; }
          .yi-wearables-copy { padding: 89px 21px; }
          .yi-wearables h2 { font-size: 64px; }
          .yi-wearables-copy h3 { font-size: 54px; }
          .yi-device-render { aspect-ratio: .9; margin: 34px 0; }
          .yi-device-core { width: 42%; }
          .yi-device-core strong { font-size: 28px; }
          .yi-device-chip { min-width: 92px; padding: 9px 10px; font-size: 9px; letter-spacing: .08em; }
          .yi-device-chip--1 { left: 6%; top: 12%; }
          .yi-device-chip--2 { right: 5%; top: 15%; }
          .yi-device-chip--3 { right: 5%; top: 64%; }
          .yi-device-chip--4 { left: 6%; bottom: 17%; }
          .yi-device-chip--5 { bottom: 6%; }
          .yi-device-list { grid-template-columns: 1fr; }
          .yi-device-list li:nth-child(even) { padding-left: 0; border-left: 0; }

          .yi-privacy { padding: 89px 21px; }
          .yi-privacy h2 { font-size: 77px; }
          .yi-privacy-copy { margin-top: 34px; font-size: 22px; }
          .yi-privacy-rule { margin-top: 55px; gap: 8px; font-size: 8px; letter-spacing: .1em; }

          .yi-trust { gap: 55px; padding: 89px 21px; }
          .yi-trust-heading h2 { font-size: 64px; }
          .yi-trust-grid { grid-template-columns: 1fr; }
          .yi-trust-grid article { min-height: auto; padding: 34px 21px; }
          .yi-trust-grid article > span { margin-bottom: 21px; }

          .yi-research-story { padding: 89px 21px; }
          .yi-research h2 { font-size: 62px; }
          .yi-research-stat { min-height: 520px; padding: 55px 21px; }
          .yi-research-stat strong { font-size: 178px; }
          .yi-research-stat p { margin: 34px 0 55px; font-size: 34px; }
          .yi-research-citation { line-height: 1.6; }

          .yi-support { min-height: 820px; }
          .yi-support-image { object-position: 58% center; }
          .yi-support-overlay { background: linear-gradient(0deg, rgba(9,9,13,.98) 0%, rgba(9,9,13,.78) 64%, rgba(9,9,13,.3) 100%); }
          .yi-support-content { width: calc(100% - 42px); margin: 0 21px; padding: 89px 0; }
          .yi-support h2 { font-size: 66px; }
          .yi-support-content > p { font-size: 16px; }
          .yi-support-path { align-items: stretch; gap: 8px; }
          .yi-support-path span { flex-direction: column; align-items: flex-start; gap: 3px; }
          .yi-support-path i { margin: 14px 4px 0; }

          .yi-recovery { gap: 34px; padding: 89px 21px; }
          .yi-recovery h2 { font-size: 62px; }
          .yi-recovery-copy > p { font-size: 16px; }

          .yi-close { padding: 110px 21px; }
          .yi-close h2 { font-size: 76px; }
          .yi-footer { flex-direction: column; align-items: flex-start; padding: 34px 21px; }
          .yi-footer > div { flex-wrap: wrap; }

          .yi-education-layer { align-items: flex-end; }
          .yi-education-panel {
            width: 100%;
            height: auto;
            max-height: 92svh;
            border-radius: 26px 26px 0 0;
            animation-name: yiEducationSheetIn;
          }
          .yi-education-panel-header { min-height: 68px; padding: 13px 21px; }
          .yi-education-panel-body { padding: 55px 21px 89px; }
          .yi-education-panel-body > h2 { font-size: 55px; }
          .yi-education-intro { margin: 26px 0 34px; font-size: 16px; }
          .yi-education-sections article { grid-template-columns: 42px 1fr; gap: 13px; padding: 26px 0; }
          .yi-education-sections article > span { font-size: 29px; }
          .yi-education-sections h3 { font-size: 27px; }
          .yi-education-sections p { font-size: 14px; }
          .yi-education-panel blockquote { margin-top: 34px; padding: 26px 21px 26px 42px; font-size: 19px; }
          .yi-education-panel blockquote::before { left: 17px; top: 26px; bottom: 26px; }
        }

        @keyframes yiEducationSheetIn {
          from { transform: translate3d(0,100%,0); }
          to { transform: translate3d(0,0,0); }
        }

        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .yi-button { transition: none; }
          .yi-device-chip { animation: none; }
          .yi-education-layer, .yi-education-panel { animation: none; }
          .yi-learn-link i, .yi-education-panel-header button { transition: none; }
          .yi-breathing-orb,
          .yi-breathing-progress span,
          .yi-breathing-phase-track span,
          .yi-breathing-controls button { transition: none; }
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
      image: 'https://pulsecheckmind.ai/pulsecheck-youth/youth-info-og-branded.png',
      url: 'https://pulsecheckmind.ai/youth-info',
      type: 'website',
      siteName: 'PulseCheck',
    },
  },
});
