import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { GetStaticProps } from 'next';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Brain,
  Check,
  Eye,
  Heart,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Wind,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import PageHead from '../../components/PageHead';

type CheckInOption = {
  id: string;
  emoji: string;
  label: string;
  color: string;
  glow: string;
  response: string;
  probe: string;
  choices: string[];
};

const CHECK_INS: CheckInOption[] = [
  {
    id: 'drained',
    emoji: '🪫',
    label: 'Drained',
    color: '#FF8A65',
    glow: 'rgba(255,138,101,.22)',
    response: 'You said you feel drained today. Thanks for telling me. Your mental skills training is here whenever it fits today.',
    probe: 'What is making today feel heavy: your body, your mind, or school?',
    choices: ['My body', 'My mind', 'School stuff', 'Something else'],
  },
  {
    id: 'off',
    emoji: '😕',
    label: 'Off',
    color: '#FFB84D',
    glow: 'rgba(255,184,77,.20)',
    response: 'You said you feel off today. Thanks for telling me. Your mental skills training is here whenever it fits today.',
    probe: 'What feels off today: sleep, stress, or something at school?',
    choices: ['Sleep', 'Stress', 'School stuff', 'Something else'],
  },
  {
    id: 'okay',
    emoji: '😐',
    label: 'Okay',
    color: '#B8C1D9',
    glow: 'rgba(184,193,217,.18)',
    response: 'You said you feel okay today. Thanks for telling me. Your mental skills training is here whenever it fits today.',
    probe: 'Is anything making today harder: sleep, stress, or focus?',
    choices: ['Sleep', 'Stress', 'Focus', 'Something else'],
  },
  {
    id: 'solid',
    emoji: '💪',
    label: 'Solid',
    color: '#14E7D0',
    glow: 'rgba(20,231,208,.22)',
    response: 'You said you feel good today. Thanks for telling me. Your mental skills training is here whenever it fits today.',
    probe: 'What is helping you feel good today: sleep, mood, or excitement for a game?',
    choices: ['Good sleep', 'Good mood', 'Excited for a game', 'Something else'],
  },
  {
    id: 'locked',
    emoji: '🔥',
    label: 'Locked In',
    color: '#E0FE10',
    glow: 'rgba(224,254,16,.20)',
    response: 'You said you feel locked in today. Thanks for telling me. Your mental skills training is here whenever it fits today.',
    probe: 'What has you locked in: good sleep, confidence, or a big game coming up?',
    choices: ['Good sleep', 'Confidence', 'A big game coming', 'Something else'],
  },
];

const BOX_BREATHING_PHASES = [
  { id: 'inhale', label: 'Breathe in', guide: 'Fill your lungs', color: '#14E7D0' },
  { id: 'hold', label: 'Hold', guide: 'Stay still', color: '#E0FE10' },
  { id: 'exhale', label: 'Breathe out', guide: 'Empty your lungs', color: '#9A7BFF' },
  { id: 'holdEmpty', label: 'Hold empty', guide: 'Stay empty', color: '#FFB84D' },
] as const;

const PHONE_WALKTHROUGH_STEPS = [
  { id: 'home', label: 'Home' },
  { id: 'skill', label: 'Skill' },
  { id: 'start', label: 'Start' },
  { id: 'practice', label: 'Practice' },
] as const;

const TRAINING_SKILL_CATEGORIES = [
  {
    id: 'breathing',
    label: 'Breathing',
    description: 'Use the breath to slow the body down, steady energy, and reset under pressure.',
    examples: ['Box breathing', 'Long exhale reset', 'Steady breath before a game', 'Breathing between plays'],
    color: '#14E7D0',
    icon: Wind,
  },
  {
    id: 'visualization',
    label: 'Visualization',
    description: 'Picture the action, pressure, and response before the real moment begins.',
    examples: ['Perfect rep rehearsal', 'Pressure preview', 'Comeback visualization', 'Competition walkthrough'],
    color: '#9A7BFF',
    icon: Eye,
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'Choose what matters now and return attention to it when distractions show up.',
    examples: ['Find the focus point', 'Next-job cue', 'Noise filter', 'Reset between plays'],
    color: '#22D3EE',
    icon: Target,
  },
  {
    id: 'confidence',
    label: 'Confidence',
    description: 'Build useful self-talk from preparation, effort, and evidence the athlete can trust.',
    examples: ['Evidence bank', 'Confident cue words', 'Pregame self-talk', 'Strength recall'],
    color: '#E0FE10',
    icon: Sparkles,
  },
  {
    id: 'recovery',
    label: 'Mistake recovery',
    description: 'Learn what happened, choose the next useful action, and return to the game.',
    examples: ['Shake it off', 'Next-play reset', 'Five-second recovery', 'Halftime reset'],
    color: '#FFB84D',
    icon: RotateCcw,
  },
  {
    id: 'pressure',
    label: 'Pressure',
    description: 'Practice clear decisions and steady actions while the moment feels difficult.',
    examples: ['Pressure routine', 'Late-game composure', 'Free-throw reset', 'Starting-line focus'],
    color: '#FF6B8A',
    icon: Zap,
  },
  {
    id: 'emotions',
    label: 'Emotional control',
    description: 'Name the feeling, understand what it is doing, and choose how to respond.',
    examples: ['Name the feeling', 'Anger reset', 'Nerves check', 'Ask for support'],
    color: '#FB7185',
    icon: Heart,
  },
  {
    id: 'routines',
    label: 'Preparation',
    description: 'Build repeatable routines for practice, competition, recovery, and sleep.',
    examples: ['Pregame routine', 'Practice arrival', 'Competition checklist', 'Post-game reset'],
    color: '#A3E635',
    icon: Activity,
  },
] as const;

const TEACHING_SCENES = [
  {
    id: 'discover',
    label: 'DISCOVER',
    title: 'Rehearse It in Your Mind',
    body: 'Your imagination gives your brain a preview of the performance you want to create.',
    science: 'Clear details give your brain useful information to rehearse.',
    prompt: 'Tap to build the scene',
    action: 'See How It Works',
    maxInteractions: 1,
  },
  {
    id: 'understand',
    label: 'SEE IT',
    title: 'Build the Moment',
    body: 'When you picture an action, parts of your brain that plan movement begin working. Your brain practices the order, timing, and choices before your body moves.',
    science: 'The imagined rep helps the action feel more familiar when the real moment arrives.',
    prompt: 'Tap to add movement and pressure',
    action: 'Try It Once',
    maxInteractions: 3,
  },
  {
    id: 'practice',
    label: 'TRY IT',
    title: 'Rehearse the Full Action',
    body: 'Picture where you are, the pressure you feel, your first move, one adjustment, and a controlled finish.',
    science: 'The athlete learns a repeatable way to practice a skill before competition.',
    prompt: 'Tap through the start, adjustment, and finish',
    action: 'Replay the Lesson',
    maxInteractions: 3,
  },
] as const;

const WALKTHROUGH_STEPS = [
  {
    id: 'notice',
    number: '01',
    label: 'Notice',
    title: 'Name the moment',
    body: 'The athlete starts with a simple check-in: “I feel off after that mistake.”',
    prompt: 'What feels true right now?',
    response: 'Frustrated and thinking about the last play.',
    takeaway: 'Awareness gives the athlete a place to begin.',
    color: '#14E7D0',
    icon: Eye,
  },
  {
    id: 'understand',
    number: '02',
    label: 'Understand',
    title: 'Make the feeling make sense',
    body: 'Nora connects the feeling to something the athlete can recognize in their mind and body.',
    prompt: 'What is the moment doing?',
    response: 'Your mind is replaying the mistake while the next play is arriving.',
    takeaway: 'Understanding replaces confusion with a clear explanation.',
    color: '#E0FE10',
    icon: Brain,
  },
  {
    id: 'learn',
    number: '03',
    label: 'Learn',
    title: 'Teach one useful idea',
    body: 'The lesson is short, concrete, and connected to the exact moment the athlete is facing.',
    prompt: 'Today’s mental skill',
    response: 'One play can stay one play. Your next job is still available.',
    takeaway: 'Education gives the athlete language they can remember.',
    color: '#9A7BFF',
    icon: Sparkles,
  },
  {
    id: 'practice',
    number: '04',
    label: 'Practice',
    title: 'Rehearse the response',
    body: 'The athlete practices exactly what to do next: notice the thought, take one breath, and name the next job.',
    prompt: 'Three-step reset',
    response: 'Catch the thought → Take one breath → Name the next job',
    takeaway: 'Practice turns an idea into an action.',
    color: '#FFB84D',
    icon: Play,
  },
  {
    id: 'play',
    number: '05',
    label: 'Use it',
    title: 'Carry it back to the game',
    body: 'The athlete returns with one cue, one decision, and a skill they can use again.',
    prompt: 'Your next-play cue',
    response: 'Eyes up. Find my teammate. Win the next five seconds.',
    takeaway: 'The skill becomes part of how the athlete competes.',
    color: '#FF6B8A',
    icon: Zap,
  },
];

const pageMeta = {
  pageId: 'pulsecheck-youth',
  pageTitle: 'PulseCheck Youth: Learn It. Practice It. Use It in the Game.',
  metaDescription:
    'Walk through how PulseCheck Youth helps athletes ages 7–17 notice the moment, understand it, learn a mental skill, practice it, and use it in competition.',
  ogTitle: 'PulseCheck Youth: Mental Skills Become Game Skills',
  ogDescription: 'Notice it. Understand it. Learn it. Practice it. Use it in the game.',
  ogImage: '/pulsecheck-youth-og.png',
  twitterCard: 'summary_large_image',
  lastUpdated: '2026-07-23T00:00:00.000Z',
};

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function BrandMark() {
  return (
    <Link href="/PulseCheck/youth" className="pcy-brand" aria-label="PulseCheck Youth home">
      <img src="/pulseCheckIcon.png" alt="" className="pcy-brand-icon" />
      <span>
        <strong>PulseCheck</strong>
        <small>Youth</small>
      </span>
    </Link>
  );
}

function NoraOrb({ color = '#9A7BFF', compact = false }: { color?: string; compact?: boolean }) {
  return (
    <span
      className={`pcy-nora-orb ${compact ? 'pcy-nora-orb--compact' : ''}`}
      style={{ '--orb-color': color } as React.CSSProperties}
      aria-hidden="true"
    >
      <span />
    </span>
  );
}

function CheckInExperience() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedReply, setSelectedReply] = useState<string | null>(null);
  const selected = CHECK_INS.find((option) => option.id === selectedId) ?? null;

  const chooseLevel = (id: string) => {
    setSelectedId(id);
    setSelectedReply(null);
  };

  const resetCheckIn = () => {
    setSelectedId(null);
    setSelectedReply(null);
  };

  return (
    <section className="pcy-section pcy-checkin-section pcy-checkin-demo-section" id="checkin-demo">
      <div className="pcy-shell">
        <Reveal className="pcy-centered-heading pcy-checkin-demo-heading">
          <span className="pcy-kicker"><Activity size={14} /> Live app demo</span>
          <h2>Try the check-in athletes see each morning.</h2>
          <p>
            Choose an answer below. The card responds the same way the Youth app does.
          </p>
        </Reveal>

        <Reveal className="pcy-checkin-demo-stage" delay={0.1}>
          <div className="pcy-checkin-device">
            <div className="pcy-checkin-device-bar">
              <span>9:41</span>
              <i />
              <span>● ●●</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.article
                key={selected?.id ?? 'pick'}
                className="pcy-live-card pcy-live-card--actual"
                style={
                  {
                    '--selected-color': selected?.color ?? '#14E7D0',
                    '--selected-glow': selected?.glow ?? 'rgba(20,231,208,.18)',
                  } as React.CSSProperties
                }
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                <div className="pcy-live-card-glow" />
                <div className="pcy-actual-checkin-label">
                  <Activity size={14} />
                  <span>NORA · MORNING CHECK-IN</span>
                </div>

                {selected ? (
                  <>
                    <div className="pcy-checkin-saved">
                      <div><span>{selected.emoji}</span><strong>{selected.label}</strong></div>
                      <div><Check size={13} /><strong>Morning saved</strong></div>
                      <button type="button" onClick={resetCheckIn} aria-label="Change today's check-in answer">
                        <RotateCcw size={14} />
                      </button>
                    </div>

                    <div className="pcy-actual-nora-response">
                      <NoraOrb color={selected.color} compact />
                      <div>
                        <p>{selected.response}</p>
                        <strong>{selected.probe}</strong>
                      </div>
                    </div>

                    <div className="pcy-actual-reply-choices" role="group" aria-label="Choose what is affecting today">
                      {selected.choices.map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          className={selectedReply === choice ? 'active' : ''}
                          onClick={() => setSelectedReply(choice)}
                          aria-pressed={selectedReply === choice}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>

                    <AnimatePresence>
                      {selectedReply && (
                        <motion.div
                          className="pcy-actual-reply-result"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                        >
                          <span>{selectedReply}</span>
                          <p>Got it. I’ll keep that in mind for today’s training.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <>
                    <div className="pcy-live-card-top">
                      <div>
                        <h3>How did you wake up feeling?</h3>
                        <p>Think about how rested you feel, your energy, and your mood.</p>
                      </div>
                      <span className="pcy-private-chip"><ShieldCheck size={13} /> Private</span>
                    </div>

                    <div className="pcy-checkin-options" role="group" aria-label="Choose a check-in answer">
                      {CHECK_INS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          style={
                            {
                              '--check-color': option.color,
                              '--check-glow': option.glow,
                            } as React.CSSProperties
                          }
                          onClick={() => chooseLevel(option.id)}
                        >
                          <span>{option.emoji}</span>
                          <small>{option.label}</small>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </motion.article>
            </AnimatePresence>
            <div className="pcy-checkin-device-home" />
          </div>

          <aside className="pcy-checkin-demo-notes">
            <span>THIS IS THE REAL YOUTH FLOW</span>
            <h3>Every answer is a tap.</h3>
            <p>
              Athletes choose from clear options. Their answer changes Nora’s next question and the
              context used for today’s training.
            </p>
            <div>
              <Check size={14} /><span>Five morning choices</span>
            </div>
            <div>
              <Check size={14} /><span>A follow-up that matches the answer</span>
            </div>
            <div>
              <Check size={14} /><span>Clear follow-up choices</span>
            </div>
          </aside>
        </Reveal>
      </div>
    </section>
  );
}

function TeachableMomentExperience() {
  const reduceMotion = useReducedMotion();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const scene = TEACHING_SCENES[sceneIndex];
  const visualProgress = Math.min(interactionCount, scene.maxInteractions);
  const practiceLabels = ['START', 'ADJUST', 'FINISH'];
  const visionHeadlines = [
    'Picture the field. Hear the crowd. See your first move.',
    'Your brain practices the plan before the game starts.',
    'Start the play. Adjust. Finish with control.',
  ];

  const chooseScene = (index: number) => {
    setSceneIndex(index);
    setInteractionCount(0);
  };

  const activateVisual = () => {
    setInteractionCount((current) => (
      current >= scene.maxInteractions ? 0 : current + 1
    ));
  };

  const advanceScene = () => {
    if (sceneIndex === TEACHING_SCENES.length - 1) {
      chooseScene(0);
      return;
    }
    chooseScene(sceneIndex + 1);
  };

  return (
    <section className="pcy-teaching-section" id="teachable-moment">
      <div className="pcy-shell">
        <Reveal className="pcy-teaching-heading">
          <span className="pcy-kicker"><Brain size={14} /> Teachable moment</span>
          <h2>They learn the skill and why it works.</h2>
          <p>
            Every new mental skill includes a short lesson. Athletes see what the skill changes,
            learn what their brain is practicing, and try the skill for themselves.
          </p>
        </Reveal>

        <Reveal className="pcy-teaching-layout" delay={0.1}>
          <aside className="pcy-teaching-explainer">
            <span>MENTAL REHEARSAL</span>
            <div className="pcy-teaching-stage-picker" role="tablist" aria-label="Teachable moment stages">
              {TEACHING_SCENES.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={sceneIndex === index}
                  className={sceneIndex === index ? 'is-active' : ''}
                  onClick={() => chooseScene(index)}
                >
                  <small>0{index + 1}</small>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={scene.id}
                className="pcy-teaching-copy"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                <small>WHAT THE ATHLETE LEARNS</small>
                <h3>{scene.title}</h3>
                <p>{scene.body}</p>
                <div>
                  <Brain size={18} />
                  <span>
                    <strong>WHY IT WORKS</strong>
                    {scene.science}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </aside>

          <article className="pcy-teaching-demo" aria-label="Interactive visualization teaching demo">
            <div className="pcy-teaching-demo-header">
              <span><Sparkles size={13} /> NEW MENTAL SKILL</span>
              <small>VISUALIZATION</small>
            </div>

            <div className="pcy-teaching-demo-progress">
              {TEACHING_SCENES.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={index <= sceneIndex ? 'is-complete' : ''}
                  aria-label={`Open ${item.label} stage`}
                  onClick={() => chooseScene(index)}
                >
                  <i />
                  <span className={index === sceneIndex ? 'is-current' : ''}>{item.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.h3
                key={scene.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                {scene.title}
              </motion.h3>
            </AnimatePresence>

            <button
              type="button"
              className={`pcy-mental-rehearsal-visual pcy-mental-rehearsal-visual--${scene.id}`}
              onClick={activateVisual}
              aria-label={scene.prompt}
            >
              <motion.img
                src="/pulsecheck-youth/teachable-visualization-illustration.webp"
                alt=""
                className="pcy-rehearsal-photo"
                animate={{
                  scale: visualProgress > 0 ? 1.04 : 1.12,
                  filter: visualProgress > 0
                    ? 'saturate(1.12) contrast(1.06) blur(0px)'
                    : 'saturate(.55) contrast(1.05) blur(2px)',
                }}
                transition={{
                  duration: 1.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
              <div className="pcy-rehearsal-cinema" aria-hidden="true" />
              <motion.div
                className="pcy-imagination-beam"
                animate={{
                  opacity: visualProgress > 0 || sceneIndex > 0 ? 1 : 0.2,
                  scaleX: visualProgress > 0 || sceneIndex > 0 ? 1 : 0.4,
                }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden="true"
              />

              <div className="pcy-imagination-rings" aria-hidden="true">
                {[0, 1, 2].map((ring) => (
                  <motion.span
                    key={ring}
                    animate={reduceMotion ? undefined : {
                      scale: visualProgress > 0 ? [0.84, 1.12, 0.84] : 0.82,
                      opacity: visualProgress > 0 ? [0.25, 0.72, 0.25] : 0.18,
                    }}
                    transition={{
                      duration: 3.2,
                      delay: ring * 0.28,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
                <Target size={28} />
              </div>

              <motion.div
                className="pcy-vision-statement"
                initial={false}
                animate={{
                  opacity: 1,
                  y: visualProgress > 0 ? 0 : 8,
                }}
              >
                <span><Eye size={14} /> MENTAL PREVIEW</span>
                <strong>{visionHeadlines[sceneIndex]}</strong>
              </motion.div>

              <AnimatePresence>
                {(visualProgress > 0 || sceneIndex > 0) && (
                  <motion.div
                    className="pcy-rehearsal-scene-details"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <span><small>01</small> SEE THE FIELD</span>
                    <span><small>02</small> FEEL THE PRESSURE</span>
                    <span><small>03</small> CHOOSE THE MOVE</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {sceneIndex === 1 && (
                <div className="pcy-brain-plan" aria-hidden="true">
                  {['SEE', 'CHOOSE', 'MOVE'].map((label, index) => (
                    <motion.span
                      key={label}
                      className={visualProgress > index ? 'is-active' : ''}
                      animate={{
                        scale: visualProgress === index + 1 ? 1.08 : 1,
                        y: visualProgress === index + 1 ? -4 : 0,
                      }}
                    >
                      <i>{index + 1}</i>
                      {label}
                    </motion.span>
                  ))}
                </div>
              )}

              {sceneIndex === 2 && (
                <div className="pcy-practice-beats" aria-hidden="true">
                  {practiceLabels.map((label, index) => (
                    <span key={label} className={visualProgress > index ? 'is-active' : ''}>
                      <i style={{ backgroundPosition: `${18 + (index * 32)}% center` }} />
                      <strong><Check size={11} /> {label}</strong>
                    </span>
                  ))}
                </div>
              )}
            </button>

            <button type="button" className="pcy-teaching-tap" onClick={activateVisual}>
              <Play size={13} fill="currentColor" />
              {visualProgress === scene.maxInteractions ? 'Tap to watch it again' : scene.prompt}
            </button>

            <p className="pcy-teaching-caption">{scene.body}</p>

            <button type="button" className="pcy-teaching-continue" onClick={advanceScene}>
              {scene.action}
              {sceneIndex === TEACHING_SCENES.length - 1
                ? <RotateCcw size={15} />
                : <ArrowRight size={15} />}
            </button>
          </article>
        </Reveal>

        <Reveal className="pcy-teaching-principles" delay={0.15}>
          <div><Eye size={18} /><strong>See the idea</strong><span>A moving picture makes the lesson easier to understand.</span></div>
          <div><Brain size={18} /><strong>Learn the reason</strong><span>Plain language explains what the brain is practicing.</span></div>
          <div><Play size={18} /><strong>Try the skill</strong><span>The athlete uses the idea right away.</span></div>
        </Reveal>
      </div>
    </section>
  );
}

function YouthExperienceRail() {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = WALKTHROUGH_STEPS[activeIndex];

  useEffect(() => {
    if (reduceMotion) return undefined;

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % WALKTHROUGH_STEPS.length);
    }, 3800);

    return () => window.clearTimeout(timer);
  }, [activeIndex, reduceMotion]);

  return (
    <motion.section
      className="pcy-experience-rail"
      id="experience"
      initial={false}
      animate={{ backgroundColor: activeStep.color }}
      transition={{ duration: reduceMotion ? 0 : 0.72, ease: [0.22, 1, 0.36, 1] }}
      style={{ '--active-experience-color': activeStep.color } as React.CSSProperties}
    >
      <motion.div
        key={activeStep.id}
        className="pcy-experience-color-wash"
        aria-hidden="true"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="pcy-shell">
        <Reveal className="pcy-experience-heading">
          <span>THE WHOLE EXPERIENCE</span>
          <h2>A feeling becomes a skill the athlete can use.</h2>
          <p>Five clear moments move the athlete from “something feels wrong” to “I know what to do next.”</p>
        </Reveal>
        <div className="pcy-experience-steps">
          {WALKTHROUGH_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === activeIndex;
            return (
              <Reveal key={step.id} delay={index * 0.08}>
                <button
                  type="button"
                  className={`pcy-experience-step ${isActive ? 'is-active' : ''}`}
                  style={{ '--walk-color': step.color } as React.CSSProperties}
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={isActive}
                  aria-label={`${step.number} ${step.label}: ${step.takeaway}`}
                >
                  <div><Icon size={18} /><small>{step.number}</small></div>
                  <h3>{step.label}</h3>
                  <p>{step.takeaway}</p>
                  {isActive && (
                    <motion.span
                      key={`${step.id}-${activeIndex}`}
                      className="pcy-experience-card-progress"
                      aria-hidden="true"
                      initial={reduceMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: reduceMotion ? 0 : 3.8, ease: 'linear' }}
                    />
                  )}
                </button>
              </Reveal>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

function HomeTeamSection() {
  return (
    <section className="pcy-section pcy-home-team-section">
      <div className="pcy-shell pcy-home-team-grid">
        <Reveal className="pcy-support-photo">
          <motion.img
            src="/pulsecheck-youth/support-team.webp"
            alt="Young athlete speaking with a coach and parent after practice"
            initial={{ scale: 1.06 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="pcy-support-photo-shade" />
          <div className="pcy-support-quote">
            <MessageCircle size={18} />
            <span>ONE SHARED LANGUAGE</span>
            <strong>“I know what happened. I know what I want to do next.”</strong>
          </div>
        </Reveal>

        <Reveal className="pcy-section-copy" delay={0.12}>
          <span className="pcy-kicker"><ShieldCheck size={14} /> Support with trust</span>
          <h2>The athlete finds the words. The adults learn how to help.</h2>
          <p>
            PulseCheck gives parents and coaches useful patterns, shared language, and practical ways
            to reinforce the skills being trained. Personal reflection remains the athlete’s own.
          </p>
          <div className="pcy-trust-grid">
            <div>
              <Eye size={18} />
              <strong>See the learning</strong>
              <p>Understand which skills the athlete is practicing and why they matter.</p>
            </div>
            <div>
              <Heart size={18} />
              <strong>Use better language</strong>
              <p>Receive simple ways to reinforce confidence, focus, and recovery.</p>
            </div>
            <div>
              <ShieldCheck size={18} />
              <strong>Protect trust</strong>
              <p>Share useful patterns while personal answers remain the athlete’s own.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function MentalSkillsPhoneWalkthrough() {
  const reduceMotion = useReducedMotion();
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [launchCount, setLaunchCount] = useState(3);
  const currentPhase = BOX_BREATHING_PHASES[phaseIndex];

  useEffect(() => {
    if (reduceMotion) return undefined;

    const durations = [3600, 3400, 2200, 14200];
    const timer = window.setTimeout(() => {
      setWalkthroughIndex((currentIndex) => (
        (currentIndex + 1) % PHONE_WALKTHROUGH_STEPS.length
      ));
    }, durations[walkthroughIndex]);

    return () => window.clearTimeout(timer);
  }, [reduceMotion, walkthroughIndex]);

  useEffect(() => {
    if (walkthroughIndex === 3) {
      setPhaseIndex(0);
      setSecondsLeft(4);
      setCompletedCycles(0);
      setIsRunning(true);
      return;
    }

    setIsRunning(false);
  }, [walkthroughIndex]);

  useEffect(() => {
    if (walkthroughIndex !== 2) return undefined;

    setLaunchCount(3);
    const timer = window.setInterval(() => {
      setLaunchCount((currentCount) => Math.max(1, currentCount - 1));
    }, 650);

    return () => window.clearInterval(timer);
  }, [walkthroughIndex]);

  useEffect(() => {
    if (!isRunning) return undefined;

    const timer = window.setInterval(() => {
      setSecondsLeft((currentSecond) => {
        if (currentSecond > 1) return currentSecond - 1;

        setPhaseIndex((currentIndex) => {
          const nextIndex = (currentIndex + 1) % BOX_BREATHING_PHASES.length;
          if (nextIndex === 0) {
            setCompletedCycles((currentCycles) => currentCycles + 1);
          }
          return nextIndex;
        });

        return 4;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  const resetDemo = () => {
    setIsRunning(false);
    setPhaseIndex(0);
    setSecondsLeft(4);
    setCompletedCycles(0);
    setWalkthroughIndex(0);
  };

  const tracerPositions = [
    { left: 'calc(100% - 7px)', top: '-7px' },
    { left: 'calc(100% - 7px)', top: 'calc(100% - 7px)' },
    { left: '-7px', top: 'calc(100% - 7px)' },
    { left: '-7px', top: '-7px' },
  ];

  const breathingScale = phaseIndex < 2 ? 1.08 : 0.72;

  return (
    <motion.aside
      className="pcy-breathe-phone"
      aria-label="Interactive mental skills training app walkthrough"
      initial={{ opacity: 0, x: 32, y: 18 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.75, delay: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pcy-phone-shell">
        <div className="pcy-phone-island" aria-hidden="true" />
        <div className="pcy-phone-status" aria-hidden="true">
          <strong>9:41</strong>
          <span>● ◒ ▰</span>
        </div>

        <div className="pcy-phone-tour-progress" aria-label="App walkthrough progress">
          {PHONE_WALKTHROUGH_STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={index === walkthroughIndex ? 'is-active' : ''}
              onClick={() => setWalkthroughIndex(index)}
              aria-label={`Show ${step.label} screen`}
            >
              <i />
              <span>{step.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {walkthroughIndex === 0 && (
            <motion.div
              key="phone-home"
              className="pcy-app-home-screen"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="pcy-app-home-heading">
                <div>
                  <small>MENTAL SKILLS TRAINING</small>
                  <h3>Today&apos;s Training</h3>
                </div>
                <span>AJ</span>
              </div>

              <div className="pcy-app-checkin-mini">
                <div><Activity size={15} /></div>
                <span><small>MORNING CHECK-IN</small><strong>Feeling solid today</strong></span>
                <Check size={14} />
              </div>

              <div className="pcy-app-training-heading">
                <div>
                  <small>TRAIN ALL 3</small>
                  <strong>Three skills. One stronger game.</strong>
                </div>
                <span>0 of 3</span>
              </div>

              <div className="pcy-app-skill-stack">
                <button
                  type="button"
                  className="pcy-app-skill-card pcy-app-skill-card--control is-selecting"
                  onClick={() => setWalkthroughIndex(1)}
                >
                  <span><Wind size={19} /></span>
                  <div>
                    <small>CONTROL</small>
                    <strong>Box Breathing</strong>
                    <p>Calm your body before the next moment.</p>
                  </div>
                  <Play size={16} fill="currentColor" />
                  <motion.i
                    aria-hidden="true"
                    animate={reduceMotion ? undefined : { scale: [0.7, 1.45], opacity: [0.8, 0] }}
                    transition={{ duration: 1.25, repeat: Infinity, ease: 'easeOut' }}
                  />
                </button>

                <button type="button" className="pcy-app-skill-card pcy-app-skill-card--focus">
                  <span><Target size={19} /></span>
                  <div>
                    <small>FOCUS</small>
                    <strong>Find Your Focus Point</strong>
                    <p>Choose what gets your attention now.</p>
                  </div>
                  <Play size={16} fill="currentColor" />
                </button>

                <button type="button" className="pcy-app-skill-card pcy-app-skill-card--mindset">
                  <span><RotateCcw size={19} /></span>
                  <div>
                    <small>MINDSET</small>
                    <strong>Shake It Off</strong>
                    <p>Recover from a mistake and move on.</p>
                  </div>
                  <Play size={16} fill="currentColor" />
                </button>
              </div>

              <div className="pcy-app-bottom-nav" aria-hidden="true">
                <span className="is-active"><Activity size={14} /> Home</span>
                <span><Target size={14} /> Path</span>
                <span><MessageCircle size={14} /> Nora</span>
              </div>
            </motion.div>
          )}

          {walkthroughIndex === 1 && (
            <motion.div
              key="phone-skill"
              className="pcy-app-skill-detail"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <button type="button" className="pcy-app-back" onClick={() => setWalkthroughIndex(0)}>
                <ArrowRight size={14} /> Today&apos;s Training
              </button>

              <div className="pcy-app-skill-detail-hero">
                <motion.div
                  animate={reduceMotion ? undefined : { scale: [1, 1.07, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                >
                  <Wind size={30} />
                </motion.div>
                <small>CONTROL · 1 MIN</small>
                <h3>Box Breathing</h3>
                <p>Follow four timed steps to slow your breathing and help your body settle.</p>
              </div>

              <div className="pcy-app-skill-learn">
                <small>WHAT YOU WILL DO</small>
                <div>
                  {BOX_BREATHING_PHASES.map((phase, index) => (
                    <span key={phase.id}>
                      <i style={{ background: phase.color }}>{index + 1}</i>
                      {phase.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pcy-app-why-box">
                <Brain size={17} />
                <div>
                  <small>WHY IT WORKS</small>
                  <p>Slow, even breathing tells your body it can lower the alarm and think clearly.</p>
                </div>
              </div>

              <button
                type="button"
                className="pcy-app-start-skill"
                onClick={() => setWalkthroughIndex(2)}
              >
                <Play size={17} fill="currentColor" /> Start this skill
                <motion.i
                  aria-hidden="true"
                  animate={reduceMotion ? undefined : { x: [0, 5, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                />
              </button>
            </motion.div>
          )}

          {walkthroughIndex === 2 && (
            <motion.div
              key="phone-launch"
              className="pcy-app-skill-launch"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.34 }}
            >
              <small>BOX BREATHING</small>
              <div className="pcy-app-launch-ring">
                <motion.i
                  animate={reduceMotion ? undefined : { rotate: 360 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                />
                <AnimatePresence mode="wait">
                  <motion.strong
                    key={launchCount}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.25 }}
                  >
                    {launchCount}
                  </motion.strong>
                </AnimatePresence>
              </div>
              <h3>Get ready to breathe</h3>
              <p>Breathe in. Hold. Breathe out. Hold empty.</p>
              <span><Wind size={15} /> The guide will lead every step.</span>
            </motion.div>
          )}

          {walkthroughIndex === 3 && (
            <motion.div
              key="phone-practice"
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.42 }}
            >
              <div className="pcy-breathe-app-header">
                <div>
                  <small>MENTAL SKILLS TRAINING</small>
                  <strong>Box Breathing</strong>
                </div>
                <span>4 × 4</span>
              </div>

              <div
                className="pcy-breathe-screen"
                style={{ '--phase-color': currentPhase.color } as React.CSSProperties}
              >
                <div className="pcy-breathe-title" aria-live="polite">
                  <small>{isRunning ? `STEP ${phaseIndex + 1} OF 4` : 'READY WHEN YOU ARE'}</small>
                  <AnimatePresence mode="wait">
                    <motion.h3
                      key={isRunning ? currentPhase.id : 'ready'}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                    >
                      {isRunning ? currentPhase.label : 'Take one calm minute'}
                    </motion.h3>
                  </AnimatePresence>
                  <p>{isRunning ? currentPhase.guide : 'Four seconds for each part.'}</p>
                </div>

                <div className="pcy-breathe-box-wrap">
                  <span className={`pcy-box-label pcy-box-label--top ${phaseIndex === 0 && isRunning ? 'is-active' : ''}`}>BREATHE IN</span>
                  <span className={`pcy-box-label pcy-box-label--right ${phaseIndex === 1 && isRunning ? 'is-active' : ''}`}>HOLD</span>
                  <span className={`pcy-box-label pcy-box-label--bottom ${phaseIndex === 2 && isRunning ? 'is-active' : ''}`}>BREATHE OUT</span>
                  <span className={`pcy-box-label pcy-box-label--left ${phaseIndex === 3 && isRunning ? 'is-active' : ''}`}>HOLD EMPTY</span>

                  <div className="pcy-breathe-box">
                    <motion.i
                      className="pcy-breathe-tracer"
                      initial={{ left: '-7px', top: '-7px' }}
                      animate={isRunning ? tracerPositions[phaseIndex] : { left: '-7px', top: '-7px' }}
                      transition={{ duration: isRunning ? 4 : 0.35, ease: 'linear' }}
                    />
                    <motion.div
                      className="pcy-breathe-orb"
                      initial={{ scale: 0.72 }}
                      animate={{ scale: isRunning ? breathingScale : 0.72 }}
                      transition={{ duration: isRunning ? 4 : 0.45, ease: 'easeInOut' }}
                    >
                      <Wind size={22} />
                      <strong>{isRunning ? secondsLeft : 4}</strong>
                      <small>SECONDS</small>
                    </motion.div>
                  </div>
                </div>

                <div className="pcy-breathe-progress" aria-label={`Box breathing step ${phaseIndex + 1} of 4`}>
                  {BOX_BREATHING_PHASES.map((phase, index) => (
                    <span
                      key={phase.id}
                      className={index === phaseIndex && isRunning ? 'is-active' : ''}
                      style={{ '--step-color': phase.color } as React.CSSProperties}
                    >
                      <i />
                      {index + 1}
                    </span>
                  ))}
                </div>

                <div className="pcy-breathe-controls">
                  <button type="button" className="pcy-breathe-reset" onClick={resetDemo} aria-label="Replay app walkthrough">
                    <RotateCcw size={17} />
                  </button>
                  <button
                    type="button"
                    className="pcy-breathe-play"
                    onClick={() => setIsRunning((current) => !current)}
                  >
                    {isRunning ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                    {isRunning ? 'Pause' : 'Start breathing'}
                  </button>
                </div>

                <div className="pcy-breathe-cycle-count">
                  <Sparkles size={13} />
                  {completedCycles === 0
                    ? 'Follow the light around the box'
                    : `${completedCycles} ${completedCycles === 1 ? 'cycle' : 'cycles'} complete`}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pcy-phone-home-indicator" aria-hidden="true" />
      </div>
    </motion.aside>
  );
}

function SkillMotionVisual({
  categoryId,
  color,
  Icon,
}: {
  categoryId: string;
  color: string;
  Icon: React.ElementType;
}) {
  const reduceMotion = useReducedMotion();
  const coreAnimation = reduceMotion
    ? undefined
    : categoryId === 'breathing'
      ? { scale: [0.78, 1.12, 0.78] }
      : categoryId === 'visualization'
        ? { scale: [0.94, 1.08, 0.94], rotate: [-5, 5, -5] }
        : categoryId === 'focus'
          ? { scale: [0.82, 1.04, 0.82] }
          : categoryId === 'confidence'
            ? { y: [8, -10, 8], scale: [0.95, 1.07, 0.95] }
            : categoryId === 'recovery'
              ? { rotate: [0, -360] }
              : categoryId === 'pressure'
                ? { scale: [1.14, 0.84, 1.14] }
                : categoryId === 'emotions'
                  ? { y: [-8, 8, -8], rotate: [-4, 4, -4] }
                  : { rotate: [0, 90, 0], scale: [0.92, 1.05, 0.92] };

  return (
    <div
      className={`pcy-skill-motion-visual pcy-skill-motion-visual--${categoryId}`}
      style={{ '--skill-color': color } as React.CSSProperties}
      aria-hidden="true"
    >
      <motion.span
        className="pcy-skill-motion-ring pcy-skill-motion-ring--outer"
        animate={reduceMotion ? undefined : { scale: [0.88, 1.08, 0.88], opacity: [0.2, 0.65, 0.2] }}
        transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="pcy-skill-motion-ring pcy-skill-motion-ring--inner"
        animate={reduceMotion ? undefined : { scale: [1.08, 0.9, 1.08], opacity: [0.55, 0.18, 0.55] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.i
        className="pcy-skill-motion-scan"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 5.2, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="pcy-skill-motion-core"
        animate={coreAnimation}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon size={42} strokeWidth={1.7} />
      </motion.div>
      <div className="pcy-skill-motion-points">
        <motion.span
          animate={reduceMotion ? undefined : { x: [0, 38, 0], opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          animate={reduceMotion ? undefined : { y: [0, -34, 0], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
        />
        <motion.span
          animate={reduceMotion ? undefined : { x: [0, -32, 0], y: [0, 22, 0], opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.45 }}
        />
      </div>
    </div>
  );
}

function SkillsLibrarySection() {
  const reduceMotion = useReducedMotion();
  const [activeCategoryId, setActiveCategoryId] = useState('breathing');
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);
  const activeCategory = TRAINING_SKILL_CATEGORIES.find(
    (category) => category.id === activeCategoryId,
  ) ?? TRAINING_SKILL_CATEGORIES[0];
  const ActiveIcon = activeCategory.icon;
  const activeExample = activeCategory.examples[activeExampleIndex] ?? activeCategory.examples[0];

  useEffect(() => {
    setActiveExampleIndex(0);
  }, [activeCategoryId]);

  useEffect(() => {
    if (reduceMotion) return undefined;

    const timer = window.setTimeout(() => {
      setActiveExampleIndex((current) => (current + 1) % activeCategory.examples.length);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [activeCategory.examples.length, activeExampleIndex, reduceMotion]);

  const moveExample = (direction: number) => {
    setActiveExampleIndex((current) => (
      (current + direction + activeCategory.examples.length) % activeCategory.examples.length
    ));
  };

  return (
    <section className="pcy-section pcy-skills-library-section" id="skill-library">
      <div className="pcy-skills-art-word" aria-hidden="true">SKILLS</div>
      <div className="pcy-shell">
        <Reveal className="pcy-skills-library-heading">
          <span className="pcy-kicker"><Sparkles size={14} /> Mental skills training library</span>
          <h2><strong>200+</strong> skills to learn, practice, and use.</h2>
          <p>
            Athletes build more than one breathing tool or one focus routine. They learn different
            skills for different moments, then practice choosing the one that fits.
          </p>
        </Reveal>

        <div className="pcy-skills-library-layout">
          <Reveal className="pcy-skills-category-grid" delay={0.08}>
            {TRAINING_SKILL_CATEGORIES.map((category) => {
              const CategoryIcon = category.icon;
              const isActive = category.id === activeCategory.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  className={isActive ? 'is-active' : ''}
                  style={{ '--skill-color': category.color } as React.CSSProperties}
                  onClick={() => setActiveCategoryId(category.id)}
                  aria-pressed={isActive}
                >
                  <span><CategoryIcon size={18} /></span>
                  <strong>{category.label}</strong>
                  <ArrowRight size={15} />
                </button>
              );
            })}
          </Reveal>

          <Reveal className="pcy-skills-category-detail" delay={0.16}>
            <div style={{ '--skill-color': activeCategory.color } as React.CSSProperties}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory.id}
                  className="pcy-skills-detail-copy"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <span className="pcy-skills-detail-icon"><ActiveIcon size={29} /></span>
                  <small>{activeCategory.label.toUpperCase()} SKILLS TRAINING</small>
                  <h3>{activeCategory.description}</h3>
                  <p>Each skill includes a clear lesson, guided practice, and a way to use it in sport.</p>
                </motion.div>
              </AnimatePresence>
              <div className="pcy-skills-motion-stage">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCategory.id}
                    className="pcy-skills-motion-visual-wrap"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, scale: 1.06 }}
                    transition={{ duration: 0.28 }}
                  >
                    <SkillMotionVisual
                      categoryId={activeCategory.id}
                      color={activeCategory.color}
                      Icon={ActiveIcon}
                    />
                  </motion.div>
                </AnimatePresence>
                <div className="pcy-skills-motion-caption">
                  <small>SKILL {String(activeExampleIndex + 1).padStart(2, '0')} OF {String(activeCategory.examples.length).padStart(2, '0')}</small>
                  <AnimatePresence mode="wait">
                    <motion.strong
                      key={activeExample}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.24 }}
                    >
                      {activeExample}
                    </motion.strong>
                  </AnimatePresence>
                  <div>
                    <button type="button" onClick={() => moveExample(-1)} aria-label="Previous skill">
                      <ArrowRight size={14} />
                    </button>
                    <span aria-label={`Skill ${activeExampleIndex + 1} of ${activeCategory.examples.length}`}>
                      {activeCategory.examples.map((example, index) => (
                        <button
                          key={example}
                          type="button"
                          className={index === activeExampleIndex ? 'is-active' : ''}
                          onClick={() => setActiveExampleIndex(index)}
                          aria-label={`Show ${example}`}
                        />
                      ))}
                    </span>
                    <button type="button" onClick={() => moveExample(1)} aria-label="Next skill">
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const PulseCheckYouthPage: React.FC = () => {
  return (
    <main className="pcy-page">
      <PageHead
        metaData={pageMeta}
        pageOgUrl="https://fitwithpulse.ai/PulseCheck/youth"
        pageOgImage="/pulsecheck-youth-og.png"
        themeColor="#07080D"
        appleItunesAppArgument="pulsecheck://youth"
      />

      <div className="pcy-noise" aria-hidden="true" />
      <div className="pcy-background-orb pcy-background-orb--one" aria-hidden="true" />
      <div className="pcy-background-orb pcy-background-orb--two" aria-hidden="true" />

      <header className="pcy-nav">
        <div className="pcy-shell pcy-nav-inner">
          <BrandMark />
          <nav aria-label="Page navigation">
            <a href="#experience">The experience</a>
            <a href="#skill-library">200+ skills</a>
            <a href="#checkin-demo">Try the app</a>
          </nav>
          <a
            href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Youth"
            className="pcy-nav-cta"
          >
            Request a Demo <ArrowRight size={15} />
          </a>
        </div>
      </header>

      <section className="pcy-hero pcy-human-hero">
        <motion.img
          className="pcy-human-hero-image"
          src="/pulsecheck-youth/hero-team.webp"
          alt="Three young athletes preparing together before competition"
          initial={{ scale: 1.09, opacity: 0 }}
          animate={{ scale: 1.01, opacity: 1 }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="pcy-human-hero-overlay" />
        <div className="pcy-human-hero-flare" aria-hidden="true" />
        <div className="pcy-human-hero-grid pcy-shell">
          <div className="pcy-hero-copy">
            <motion.div
              className="pcy-eyebrow"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <span /> Guided mental skills training · Ages 7–17
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.78, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              Learn it. Practice it.
              <span>Use it in the game.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.72, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              PulseCheck gives young athletes simple mental skills for mistakes, pressure, focus,
              and confidence. It helps them use those skills when the game gets real.
            </motion.p>
            <motion.div
              className="pcy-hero-actions"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.28 }}
            >
              <a href="#experience" className="pcy-primary-button">
                Walk through the experience <ArrowDown size={17} />
              </a>
              <span className="pcy-age-note">
                <span><Check size={12} /></span>
                Rookie 7–12 · Junior 13–17
              </span>
            </motion.div>
          </div>

          <MentalSkillsPhoneWalkthrough />
        </div>

        <div className="pcy-human-hero-caption">
          <span>THE MOMENT BEFORE THE NEXT PLAY</span>
          <p>Mental skills become part of how the athlete competes.</p>
        </div>
      </section>

      <YouthExperienceRail />

      <div className="pcy-motion-marquee" aria-hidden="true">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 25, ease: 'linear', repeat: Infinity }}
        >
          <span>NOTICE</span><i /> <span>UNDERSTAND</span><i /> <span>LEARN</span><i />
          <span>PRACTICE</span><i /> <span>USE IT</span><i /> <span>LEVEL UP</span><i />
          <span>NOTICE</span><i /> <span>UNDERSTAND</span><i /> <span>LEARN</span><i />
          <span>PRACTICE</span><i /> <span>USE IT</span><i /> <span>LEVEL UP</span><i />
        </motion.div>
      </div>

      <SkillsLibrarySection />
      <CheckInExperience />
      <TeachableMomentExperience />

      <HomeTeamSection />

      <section className="pcy-final-section">
        <div className="pcy-final-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="pcy-shell">
          <Reveal className="pcy-final-content">
            <NoraOrb color="#14E7D0" />
            <span className="pcy-kicker">The next generation trains differently</span>
            <h2>Give every athlete a mental game they know how to use.</h2>
            <p>
              Bring guided mental skills training, daily practice, and a journey that keeps
              growing to your athletes.
            </p>
            <a
              href="mailto:pulsefitnessapp@gmail.com?subject=Bring%20PulseCheck%20Youth%20to%20our%20athletes"
              className="pcy-primary-button"
            >
              Start a conversation <ArrowRight size={17} />
            </a>
          </Reveal>
        </div>
      </section>

      <footer className="pcy-footer">
        <div className="pcy-shell">
          <BrandMark />
          <p>Mindset. Focus. Emotional control. Trained for the moments that matter.</p>
          <div>
            <Link href="/PulseCheck/privacy">Privacy</Link>
            <Link href="/PulseCheck/terms">Terms</Link>
            <span>© {new Date().getFullYear()} Pulse Intelligence Labs</span>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        :root {
          --pcy-bg: #07080d;
          --pcy-panel: #101117;
          --pcy-panel-2: #15161e;
          --pcy-text: #f7f8fb;
          --pcy-muted: #9a9daa;
          --pcy-line: rgba(255, 255, 255, 0.1);
          --pcy-teal: #14e7d0;
          --pcy-lime: #e0fe10;
          --pcy-purple: #9a7bff;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          background: var(--pcy-bg);
        }

        .pcy-page {
          min-height: 100vh;
          overflow: hidden;
          color: var(--pcy-text);
          background:
            radial-gradient(circle at 70% 6%, rgba(91, 64, 203, 0.13), transparent 31rem),
            linear-gradient(180deg, #07080d 0%, #090a10 48%, #07080d 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          isolation: isolate;
        }

        .pcy-page * {
          box-sizing: border-box;
        }

        .pcy-shell {
          width: min(1180px, calc(100% - 40px));
          margin-inline: auto;
        }

        .pcy-noise {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          opacity: 0.14;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.12) 0 0.6px, transparent 0.8px),
            radial-gradient(circle at 70% 60%, rgba(255, 255, 255, 0.08) 0 0.5px, transparent 0.8px);
          background-position: 0 0, 7px 9px;
          background-size: 13px 13px, 17px 17px;
          mix-blend-mode: soft-light;
        }

        .pcy-background-orb {
          position: fixed;
          z-index: -2;
          width: 30rem;
          height: 30rem;
          border-radius: 50%;
          filter: blur(110px);
          opacity: 0.075;
          pointer-events: none;
        }

        .pcy-background-orb--one {
          top: 20%;
          left: -18rem;
          background: var(--pcy-teal);
        }

        .pcy-background-orb--two {
          right: -20rem;
          top: 58%;
          background: var(--pcy-purple);
        }

        .pcy-nav {
          position: fixed;
          z-index: 80;
          top: 0;
          left: 0;
          right: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(7, 8, 13, 0.72);
          backdrop-filter: blur(22px);
        }

        .pcy-nav-inner {
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
        }

        .pcy-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: white;
          text-decoration: none;
          flex: 0 0 auto;
        }

        .pcy-brand-icon {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          box-shadow: 0 0 28px rgba(154, 123, 255, 0.22);
        }

        .pcy-brand > span {
          display: flex;
          align-items: baseline;
          gap: 7px;
        }

        .pcy-brand strong {
          font-size: 14px;
          letter-spacing: -0.02em;
        }

        .pcy-brand small {
          color: var(--pcy-teal);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .pcy-nav nav {
          display: flex;
          align-items: center;
          gap: 30px;
        }

        .pcy-nav nav a,
        .pcy-footer a {
          color: #a8aab5;
          font-size: 12px;
          font-weight: 650;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .pcy-nav nav a:hover,
        .pcy-nav nav a:focus-visible,
        .pcy-footer a:hover,
        .pcy-footer a:focus-visible {
          color: white;
        }

        .pcy-nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(224, 254, 16, 0.25);
          border-radius: 999px;
          padding: 10px 15px;
          background: rgba(224, 254, 16, 0.08);
          color: var(--pcy-lime);
          font-size: 11px;
          font-weight: 800;
          text-decoration: none;
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .pcy-nav-cta:hover {
          transform: translateY(-1px);
          background: rgba(224, 254, 16, 0.14);
        }

        .pcy-hero {
          min-height: 100vh;
          padding: 136px 0 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
        }

        .pcy-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(440px, 0.92fr);
          align-items: center;
          gap: 72px;
        }

        .pcy-hero-copy {
          position: relative;
          z-index: 5;
        }

        .pcy-eyebrow,
        .pcy-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--pcy-teal);
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .pcy-eyebrow > span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--pcy-teal);
          box-shadow: 0 0 16px var(--pcy-teal);
        }

        .pcy-hero h1 {
          margin: 25px 0 22px;
          max-width: 720px;
          font-size: clamp(4.25rem, 7.1vw, 7.15rem);
          line-height: 0.88;
          letter-spacing: -0.07em;
          font-weight: 850;
        }

        .pcy-hero h1 > span {
          display: block;
          padding-bottom: 0.12em;
          margin-bottom: -0.12em;
          color: transparent;
          background: linear-gradient(100deg, #ffffff 0%, #adffe8 43%, #9a7bff 100%);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .pcy-hero-copy > p {
          max-width: 625px;
          margin: 0;
          color: #b7bac5;
          font-size: clamp(1rem, 1.5vw, 1.2rem);
          line-height: 1.72;
        }

        .pcy-hero-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 34px;
        }

        .pcy-primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 51px;
          border-radius: 999px;
          padding: 0 23px;
          background: linear-gradient(110deg, var(--pcy-lime), #aaff35);
          box-shadow: 0 14px 42px rgba(224, 254, 16, 0.14);
          color: #090a0e;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }

        .pcy-primary-button:hover,
        .pcy-primary-button:focus-visible {
          transform: translateY(-2px);
          box-shadow: 0 18px 52px rgba(224, 254, 16, 0.22);
        }

        .pcy-age-note {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: #858894;
          font-size: 11px;
          font-weight: 650;
        }

        .pcy-age-note > span {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: var(--pcy-teal);
          background: rgba(20, 231, 208, 0.1);
          border: 1px solid rgba(20, 231, 208, 0.18);
        }

        .pcy-hero-visual {
          min-height: 620px;
          position: relative;
          display: grid;
          place-items: center;
        }

        .pcy-orbit {
          position: absolute;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 50%;
        }

        .pcy-orbit span {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--pcy-teal);
          box-shadow: 0 0 18px var(--pcy-teal);
        }

        .pcy-orbit--one {
          width: 510px;
          height: 510px;
        }

        .pcy-orbit--one span {
          top: 62px;
          right: 63px;
        }

        .pcy-orbit--two {
          width: 410px;
          height: 410px;
          border-style: dashed;
        }

        .pcy-orbit--two span {
          bottom: 29px;
          left: 95px;
          background: var(--pcy-purple);
          box-shadow: 0 0 18px var(--pcy-purple);
        }

        .pcy-phone {
          position: relative;
          z-index: 4;
          width: 310px;
          min-height: 610px;
          padding: 15px 16px 18px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 42px;
          background: linear-gradient(160deg, #15161e 0%, #090a0e 65%);
          box-shadow:
            0 45px 100px rgba(0, 0, 0, 0.55),
            inset 0 0 0 5px rgba(255, 255, 255, 0.025),
            0 0 90px rgba(154, 123, 255, 0.08);
        }

        .pcy-phone-glow {
          position: absolute;
          width: 200px;
          height: 200px;
          top: -120px;
          right: -80px;
          border-radius: 50%;
          background: rgba(20, 231, 208, 0.15);
          filter: blur(60px);
        }

        .pcy-phone-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 5px 15px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 8px;
          font-weight: 750;
        }

        .pcy-phone-island {
          width: 67px;
          height: 19px;
          border-radius: 999px;
          background: #020203;
        }

        .pcy-phone-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 4px 5px 16px;
        }

        .pcy-phone-heading small,
        .pcy-phone-nora small {
          color: #6f727e;
          font-size: 7px;
          font-weight: 850;
          letter-spacing: 0.14em;
        }

        .pcy-phone-heading h3 {
          margin: 4px 0 0;
          color: white;
          font-size: 23px;
          letter-spacing: -0.045em;
        }

        .pcy-avatar {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: var(--pcy-teal);
          background: rgba(20, 231, 208, 0.1);
          font-size: 10px;
          font-weight: 900;
        }

        .pcy-phone-nora {
          padding: 15px;
          border: 1px solid rgba(154, 123, 255, 0.18);
          border-radius: 18px;
          background: rgba(154, 123, 255, 0.07);
        }

        .pcy-phone-nora-heading,
        .pcy-nora-response-head {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pcy-phone-nora-heading strong {
          font-size: 11px;
        }

        .pcy-phone-nora p {
          margin: 10px 0 0;
          color: #b9bbc5;
          font-size: 10px;
          line-height: 1.5;
        }

        .pcy-nora-orb {
          --orb-color: #9a7bff;
          position: relative;
          width: 40px;
          height: 40px;
          display: inline-grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 50%;
          background:
            radial-gradient(circle at 67% 70%, var(--pcy-teal), transparent 28%),
            radial-gradient(circle at 35% 28%, #d4c8ff, transparent 25%),
            linear-gradient(135deg, var(--orb-color), #4e28ac);
          box-shadow: 0 0 30px color-mix(in srgb, var(--orb-color) 45%, transparent);
        }

        .pcy-nora-orb::after {
          content: "";
          position: absolute;
          inset: -7px;
          border: 1px solid color-mix(in srgb, var(--orb-color) 35%, transparent);
          border-radius: 50%;
          animation: pcy-orb-breathe 2.8s ease-in-out infinite;
        }

        .pcy-nora-orb > span {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.26);
          filter: blur(3px);
        }

        .pcy-nora-orb--compact {
          width: 25px;
          height: 25px;
        }

        .pcy-nora-orb--compact::after {
          inset: -4px;
        }

        @keyframes pcy-orb-breathe {
          0%, 100% { transform: scale(0.92); opacity: 0.35; }
          50% { transform: scale(1.08); opacity: 0.8; }
        }

        .pcy-phone-goal {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 18px 3px 10px;
        }

        .pcy-phone-goal span {
          color: #7c7f8b;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .pcy-phone-goal strong {
          color: var(--pcy-teal);
          font-size: 9px;
        }

        .pcy-phone-skills {
          display: grid;
          gap: 8px;
        }

        .pcy-phone-skill {
          --skill-color: var(--pcy-teal);
          min-height: 66px;
          display: grid;
          grid-template-columns: 37px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid color-mix(in srgb, var(--skill-color) 22%, transparent);
          border-radius: 15px;
          background: color-mix(in srgb, var(--skill-color) 7%, rgba(255, 255, 255, 0.025));
          color: var(--skill-color);
        }

        .pcy-phone-skill-icon {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: color-mix(in srgb, var(--skill-color) 13%, transparent);
        }

        .pcy-phone-skill div {
          min-width: 0;
        }

        .pcy-phone-skill small {
          display: block;
          color: #777a86;
          font-size: 7px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .pcy-phone-skill strong {
          display: block;
          margin-top: 3px;
          color: white;
          font-size: 10px;
        }

        .pcy-phone-tabs {
          position: absolute;
          bottom: 14px;
          left: 15px;
          right: 15px;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: space-around;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          background: rgba(28, 29, 38, 0.92);
        }

        .pcy-phone-tabs span {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          color: #5d606a;
          font-size: 7px;
          font-weight: 750;
        }

        .pcy-phone-tabs .active {
          color: var(--pcy-lime);
        }

        .pcy-float-card {
          position: absolute;
          z-index: 7;
          min-width: 185px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 14px;
          background: rgba(18, 19, 26, 0.88);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(14px);
        }

        .pcy-float-card > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 9px;
        }

        .pcy-float-card small,
        .pcy-assignment small {
          display: block;
          color: #6f727e;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.11em;
        }

        .pcy-float-card strong,
        .pcy-assignment strong {
          display: block;
          margin-top: 3px;
          color: white;
          font-size: 10px;
        }

        .pcy-float-card--gain {
          left: -5px;
          top: 34%;
        }

        .pcy-float-card--gain > span {
          color: var(--pcy-lime);
          background: rgba(224, 254, 16, 0.1);
        }

        .pcy-float-card--next {
          right: -4px;
          bottom: 23%;
        }

        .pcy-float-card--next > span {
          color: var(--pcy-purple);
          background: rgba(154, 123, 255, 0.1);
        }

        .pcy-hero-proof {
          display: flex;
          align-items: center;
          gap: 28px;
          margin-top: 4px;
          padding-top: 22px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pcy-hero-proof > span {
          flex: 0 0 auto;
          color: #5e616c;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .pcy-hero-proof > div {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 17px;
          overflow: hidden;
        }

        .pcy-hero-proof strong {
          flex: 0 0 auto;
          color: #a8abb6;
          font-size: 9px;
          letter-spacing: 0.1em;
        }

        .pcy-hero-proof i {
          width: 3px;
          height: 3px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--pcy-teal);
        }

        .pcy-statement {
          padding: 150px 0;
          background:
            linear-gradient(90deg, transparent, rgba(20, 231, 208, 0.035), transparent);
        }

        .pcy-statement small {
          display: block;
          margin-bottom: 20px;
          color: var(--pcy-teal);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        .pcy-statement p {
          max-width: 960px;
          margin: 0;
          color: #787b87;
          font-size: clamp(2.2rem, 4.8vw, 4.8rem);
          font-weight: 800;
          letter-spacing: -0.055em;
          line-height: 1.05;
        }

        .pcy-statement p span {
          display: block;
          color: white;
        }

        .pcy-section {
          position: relative;
          padding: 128px 0;
        }

        .pcy-checkin-section {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: #090a10;
        }

        .pcy-checkin-grid,
        .pcy-home-team-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.82fr) minmax(520px, 1.18fr);
          align-items: center;
          gap: 82px;
        }

        .pcy-section-copy h2,
        .pcy-centered-heading h2,
        .pcy-outcome-heading h2,
        .pcy-final-content h2 {
          margin: 18px 0;
          font-size: clamp(2.6rem, 4.6vw, 4.6rem);
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        .pcy-section-copy > p,
        .pcy-centered-heading > p,
        .pcy-final-content > p {
          color: #989ba7;
          font-size: 15px;
          line-height: 1.75;
        }

        .pcy-copy-rule {
          display: grid;
          grid-template-columns: 35px 1fr;
          gap: 15px;
          margin-top: 27px;
          padding-top: 21px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pcy-copy-rule > span {
          color: var(--pcy-teal);
          font-size: 10px;
          font-weight: 900;
        }

        .pcy-copy-rule strong {
          display: block;
          font-size: 13px;
        }

        .pcy-copy-rule p {
          margin: 6px 0 0;
          color: #777a86;
          font-size: 12px;
          line-height: 1.55;
        }

        .pcy-live-card {
          position: relative;
          overflow: hidden;
          min-height: 520px;
          padding: 30px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 28px;
          background:
            linear-gradient(150deg, rgba(255, 255, 255, 0.045), transparent 34%),
            #111219;
          box-shadow: 0 35px 80px rgba(0, 0, 0, 0.32);
        }

        .pcy-live-card-glow {
          position: absolute;
          top: -100px;
          right: -90px;
          width: 320px;
          height: 320px;
          pointer-events: none;
          transition: background 0.4s ease;
        }

        .pcy-live-card-top {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
        }

        .pcy-live-card-top small {
          color: var(--pcy-teal);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .pcy-live-card-top h3 {
          margin: 8px 0 0;
          font-size: 25px;
          letter-spacing: -0.035em;
        }

        .pcy-private-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border: 1px solid rgba(20, 231, 208, 0.17);
          border-radius: 999px;
          color: var(--pcy-teal);
          background: rgba(20, 231, 208, 0.07);
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .pcy-checkin-options {
          position: relative;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 9px;
          margin-top: 26px;
        }

        .pcy-checkin-options button {
          min-width: 0;
          min-height: 93px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 15px;
          color: #898c98;
          background: rgba(255, 255, 255, 0.025);
          cursor: pointer;
          transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
        }

        .pcy-checkin-options button:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .pcy-checkin-options button.active {
          border-color: var(--check-color);
          color: white;
          background: var(--check-glow);
          box-shadow: 0 12px 35px var(--check-glow);
        }

        .pcy-checkin-options button span {
          font-size: 21px;
        }

        .pcy-checkin-options button small {
          font-size: 9px;
          font-weight: 800;
        }

        .pcy-nora-response {
          position: relative;
          margin-top: 20px;
          padding: 21px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.18);
        }

        .pcy-nora-response-head strong {
          font-size: 12px;
        }

        .pcy-nora-response-head > span:last-child {
          margin-left: auto;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        .pcy-nora-response > p {
          margin: 14px 0 17px;
          color: #b8bbc5;
          font-size: 12px;
          line-height: 1.6;
        }

        .pcy-assignment {
          min-height: 67px;
          display: grid;
          grid-template-columns: 37px 1fr auto;
          align-items: center;
          gap: 11px;
          padding: 10px 13px;
          border: 1px solid;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.035);
        }

        .pcy-assignment > span {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #090a0e;
          background: white;
        }

        .pcy-pillar-section {
          padding-bottom: 150px;
          background:
            radial-gradient(circle at 50% 40%, rgba(154, 123, 255, 0.06), transparent 36rem);
        }

        .pcy-centered-heading {
          max-width: 850px;
          margin: 0 auto;
          text-align: center;
        }

        .pcy-centered-heading .pcy-kicker {
          justify-content: center;
        }

        .pcy-centered-heading > p {
          max-width: 680px;
          margin: 0 auto;
        }

        .pcy-pillar-picker {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 54px 0 18px;
        }

        .pcy-pillar-picker button {
          --pillar-color: #fff;
          --pillar-soft: rgba(255,255,255,.06);
          min-height: 86px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 17px;
          background: rgba(255, 255, 255, 0.025);
          color: #777a86;
          text-align: left;
          cursor: pointer;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .pcy-pillar-picker button:hover {
          transform: translateY(-2px);
        }

        .pcy-pillar-picker button.active {
          border-color: color-mix(in srgb, var(--pillar-color) 45%, transparent);
          background: var(--pillar-soft);
          box-shadow: 0 18px 50px var(--pillar-glow);
          color: var(--pillar-color);
        }

        .pcy-pillar-picker button > span {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 13px;
          background: var(--pillar-soft);
        }

        .pcy-pillar-picker button small {
          display: block;
          color: currentColor;
          opacity: 0.65;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .pcy-pillar-picker button strong {
          display: block;
          margin-top: 4px;
          color: white;
          font-size: 13px;
        }

        .pcy-pillar-stage {
          --pillar-color: var(--pcy-lime);
          --pillar-soft: rgba(224, 254, 16, 0.1);
          position: relative;
          min-height: 620px;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--pillar-color) 25%, rgba(255,255,255,.08));
          border-radius: 30px;
          background:
            radial-gradient(circle at 75% 45%, var(--pillar-glow), transparent 25rem),
            linear-gradient(145deg, rgba(255, 255, 255, 0.04), transparent 35%),
            #0e0f15;
          box-shadow: 0 45px 90px rgba(0, 0, 0, 0.28);
        }

        .pcy-stage-lines {
          position: absolute;
          inset: 0;
          opacity: 0.12;
          background-image:
            linear-gradient(color-mix(in srgb, var(--pillar-color) 60%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--pillar-color) 60%, transparent) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: linear-gradient(90deg, transparent, black 70%);
        }

        .pcy-pillar-stage-inner {
          position: relative;
          min-height: 620px;
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 60px;
          align-items: center;
          padding: 60px;
        }

        .pcy-pillar-icon {
          width: 53px;
          height: 53px;
          display: grid;
          place-items: center;
          margin-bottom: 30px;
          border: 1px solid color-mix(in srgb, var(--pillar-color) 30%, transparent);
          border-radius: 17px;
          color: var(--pillar-color);
          background: var(--pillar-soft);
          box-shadow: 0 16px 38px var(--pillar-glow);
        }

        .pcy-pillar-story > small {
          color: var(--pillar-color);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .pcy-pillar-story > h3 {
          max-width: 430px;
          margin: 11px 0 34px;
          font-size: clamp(2.4rem, 4vw, 4rem);
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        .pcy-story-step {
          display: grid;
          grid-template-columns: 62px 1fr;
          gap: 18px;
          padding: 17px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pcy-story-step > span {
          padding-top: 2px;
          color: #696c77;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }

        .pcy-story-step p {
          margin: 0;
          color: #a5a8b3;
          font-size: 12px;
          line-height: 1.6;
        }

        .pcy-story-step--gain > span,
        .pcy-story-step--gain p {
          color: var(--pillar-color);
        }

        .pcy-practice-lab {
          max-width: 440px;
          justify-self: end;
          width: 100%;
          padding: 23px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 25px;
          background: rgba(7, 8, 13, 0.68);
          backdrop-filter: blur(12px);
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.38);
        }

        .pcy-practice-lab-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .pcy-practice-lab-head span,
        .pcy-practice-lab-head small {
          color: var(--pillar-color);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }

        .pcy-practice-lab-head small {
          color: #686b76;
        }

        .pcy-practice-visual {
          min-height: 315px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .pcy-practice-pulse {
          width: 102px;
          height: 102px;
          display: grid;
          place-items: center;
          margin-bottom: 26px;
          border: 1px solid color-mix(in srgb, var(--pillar-color) 45%, transparent);
          border-radius: 50%;
          color: #08090c;
          background:
            radial-gradient(circle, white 0 20%, var(--pillar-color) 23% 45%, transparent 47%),
            color-mix(in srgb, var(--pillar-color) 10%, transparent);
          box-shadow:
            0 0 0 18px color-mix(in srgb, var(--pillar-color) 5%, transparent),
            0 0 80px var(--pillar-glow);
        }

        .pcy-practice-pulse span {
          font-size: 12px;
          font-weight: 950;
        }

        .pcy-practice-visual > small {
          color: var(--pillar-color);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }

        .pcy-practice-visual h4 {
          margin: 9px 0;
          font-size: 23px;
          letter-spacing: -0.035em;
        }

        .pcy-practice-visual p {
          max-width: 280px;
          margin: 0;
          color: #858894;
          font-size: 11px;
          line-height: 1.6;
        }

        .pcy-practice-dots {
          display: flex;
          justify-content: center;
          gap: 9px;
          margin-bottom: 17px;
        }

        .pcy-practice-dots button {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          color: #656873;
          background: transparent;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .pcy-practice-dots button.active {
          border-color: var(--pillar-color);
          color: #090a0e;
          background: var(--pillar-color);
        }

        .pcy-practice-dots button.done {
          color: var(--pillar-color);
          background: var(--pillar-soft);
        }

        .pcy-practice-next {
          width: 100%;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 0;
          border-radius: 14px;
          color: #090a0e;
          background: var(--pillar-color);
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .pcy-practice-next:hover {
          transform: translateY(-1px);
        }

        .pcy-outcome-section {
          padding: 120px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          background: #f0f1eb;
          color: #0c0d11;
        }

        .pcy-outcome-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 40px;
          margin-bottom: 52px;
        }

        .pcy-outcome-heading > span {
          color: #6d716c;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .pcy-outcome-heading h2 {
          max-width: 750px;
          margin: 0;
          text-align: right;
        }

        .pcy-outcome-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .pcy-outcome-card {
          --outcome-color: #0c0d11;
          position: relative;
          min-height: 325px;
          padding: 28px;
          overflow: hidden;
          border: 1px solid rgba(12, 13, 17, 0.12);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.52);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .pcy-outcome-card::after {
          content: "";
          position: absolute;
          width: 150px;
          height: 150px;
          right: -60px;
          bottom: -70px;
          border-radius: 50%;
          background: var(--outcome-color);
          filter: blur(65px);
          opacity: 0.2;
        }

        .pcy-outcome-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 24px 50px rgba(12, 13, 17, 0.1);
        }

        .pcy-outcome-card > span {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          color: #08090c;
          background: var(--outcome-color);
        }

        .pcy-outcome-card > small {
          position: absolute;
          top: 29px;
          right: 29px;
          color: #9a9c96;
          font-size: 10px;
          font-weight: 850;
        }

        .pcy-outcome-card h3 {
          margin: 88px 0 13px;
          font-size: 29px;
          letter-spacing: -0.045em;
        }

        .pcy-outcome-card p {
          max-width: 290px;
          margin: 0;
          color: #62655f;
          font-size: 13px;
          line-height: 1.65;
        }

        .pcy-journey-section {
          overflow: hidden;
          padding: 150px 0;
          background: #08090e;
        }

        .pcy-journey-halo {
          position: absolute;
          width: 32rem;
          height: 32rem;
          border-radius: 50%;
          filter: blur(110px);
          opacity: 0.1;
          pointer-events: none;
        }

        .pcy-journey-halo--left {
          left: -20rem;
          top: 20%;
          background: var(--pcy-teal);
        }

        .pcy-journey-halo--right {
          right: -21rem;
          bottom: 6%;
          background: var(--pcy-purple);
        }

        .pcy-journey-map {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px;
          margin: 75px 0 38px;
        }

        .pcy-journey-rail {
          position: absolute;
          top: 24px;
          left: calc(16.666% + 24px);
          right: calc(16.666% + 24px);
          height: 2px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.09);
        }

        .pcy-journey-rail span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, var(--pcy-teal), var(--pcy-lime), var(--pcy-purple));
        }

        .pcy-journey-map button {
          --stage-color: #fff;
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 0;
          background: transparent;
          color: #626570;
          cursor: pointer;
        }

        .pcy-stage-node {
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 50%;
          background: #111219;
          transition: transform 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }

        .pcy-journey-map button.reached .pcy-stage-node {
          color: var(--stage-color);
          border-color: color-mix(in srgb, var(--stage-color) 44%, transparent);
          box-shadow: 0 0 28px color-mix(in srgb, var(--stage-color) 18%, transparent);
        }

        .pcy-journey-map button.active .pcy-stage-node {
          transform: scale(1.12);
          color: #08090c;
          background: var(--stage-color);
        }

        .pcy-journey-map button small {
          margin-top: 15px;
          color: currentColor;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .pcy-journey-map button.active small {
          color: var(--stage-color);
        }

        .pcy-journey-map button strong {
          margin-top: 5px;
          color: white;
          font-size: 14px;
        }

        .pcy-journey-detail {
          min-height: 310px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 28px;
          background:
            linear-gradient(130deg, rgba(255,255,255,.04), transparent 40%),
            #101117;
        }

        .pcy-journey-detail-inner {
          --stage-color: #fff;
          min-height: 310px;
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr) 330px;
          align-items: center;
          gap: 36px;
          padding: 46px;
        }

        .pcy-journey-number {
          color: var(--stage-color);
          font-size: 64px;
          font-weight: 250;
          letter-spacing: -0.06em;
        }

        .pcy-journey-detail-copy > span {
          color: var(--stage-color);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .pcy-journey-detail-copy h3 {
          margin: 10px 0;
          font-size: 31px;
          letter-spacing: -0.04em;
        }

        .pcy-journey-detail-copy p {
          max-width: 530px;
          margin: 0;
          color: #8c8f9a;
          font-size: 13px;
          line-height: 1.65;
        }

        .pcy-journey-gain {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 18px;
          border: 1px solid color-mix(in srgb, var(--stage-color) 25%, transparent);
          border-radius: 17px;
          background: color-mix(in srgb, var(--stage-color) 7%, transparent);
        }

        .pcy-journey-gain > span {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 12px;
          color: var(--stage-color);
          background: color-mix(in srgb, var(--stage-color) 11%, transparent);
        }

        .pcy-journey-gain small {
          display: block;
          color: #656873;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.11em;
        }

        .pcy-journey-gain strong {
          display: block;
          margin-top: 5px;
          font-size: 12px;
        }

        .pcy-home-team-section {
          background:
            linear-gradient(180deg, #eceee8 0%, #f6f7f2 100%);
          color: #101116;
        }

        .pcy-home-team-grid {
          grid-template-columns: 0.85fr 1.15fr;
        }

        .pcy-home-team-section .pcy-section-copy > p {
          color: #686b66;
        }

        .pcy-home-team-orbit {
          position: relative;
          width: min(450px, 100%);
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          margin: 0 auto;
          border: 1px solid rgba(12, 13, 17, 0.11);
          border-radius: 50%;
        }

        .pcy-home-team-orbit::before,
        .pcy-home-team-orbit::after {
          content: "";
          position: absolute;
          border: 1px dashed rgba(12, 13, 17, 0.1);
          border-radius: 50%;
        }

        .pcy-home-team-orbit::before {
          inset: 18%;
        }

        .pcy-home-team-orbit::after {
          inset: 36%;
          background: rgba(20, 231, 208, 0.05);
        }

        .pcy-home-team-center {
          position: relative;
          z-index: 3;
          width: 130px;
          height: 130px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #0b7d70;
          background: white;
          box-shadow: 0 25px 60px rgba(14, 50, 45, 0.12);
        }

        .pcy-home-team-center strong {
          margin-top: 9px;
          color: #101116;
          font-size: 12px;
        }

        .pcy-home-team-center small {
          margin-top: 3px;
          color: #8a8e88;
          font-size: 8px;
        }

        .pcy-support-node {
          position: absolute;
          z-index: 4;
          min-width: 102px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 11px 13px;
          border: 1px solid rgba(12, 13, 17, 0.1);
          border-radius: 999px;
          color: #454943;
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 12px 30px rgba(12, 13, 17, 0.08);
          font-size: 10px;
          font-weight: 800;
        }

        .pcy-support-node--one {
          top: 13%;
          left: 10%;
        }

        .pcy-support-node--two {
          top: 27%;
          right: 1%;
        }

        .pcy-support-node--three {
          bottom: 10%;
          left: 23%;
        }

        .pcy-trust-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 30px;
        }

        .pcy-trust-grid > div {
          padding: 18px;
          border: 1px solid rgba(12, 13, 17, 0.1);
          border-radius: 17px;
          background: rgba(255, 255, 255, 0.48);
        }

        .pcy-trust-grid svg {
          color: #0b8f80;
        }

        .pcy-trust-grid strong {
          display: block;
          margin-top: 20px;
          font-size: 11px;
        }

        .pcy-trust-grid p {
          margin: 8px 0 0;
          color: #777b75;
          font-size: 10px;
          line-height: 1.55;
        }

        .pcy-final-section {
          position: relative;
          min-height: 720px;
          display: grid;
          place-items: center;
          overflow: hidden;
          text-align: center;
          background:
            radial-gradient(circle at 50% 50%, rgba(20, 231, 208, 0.09), transparent 25rem),
            #08090d;
        }

        .pcy-final-content {
          position: relative;
          z-index: 3;
          max-width: 850px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .pcy-final-content > .pcy-kicker {
          margin-top: 33px;
        }

        .pcy-final-content h2 {
          max-width: 850px;
          margin-bottom: 20px;
        }

        .pcy-final-content > p {
          max-width: 630px;
          margin: 0 auto 30px;
        }

        .pcy-final-orbit {
          position: absolute;
          width: 670px;
          height: 670px;
          border: 1px solid rgba(255, 255, 255, 0.055);
          border-radius: 50%;
          animation: pcy-slow-spin 30s linear infinite;
        }

        .pcy-final-orbit::before,
        .pcy-final-orbit::after {
          content: "";
          position: absolute;
          border: 1px solid rgba(255, 255, 255, 0.045);
          border-radius: 50%;
        }

        .pcy-final-orbit::before { inset: 12%; }
        .pcy-final-orbit::after { inset: 27%; }

        .pcy-final-orbit > span {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          box-shadow: 0 0 18px currentColor;
        }

        .pcy-final-orbit > span:nth-child(1) {
          top: 13%;
          left: 17%;
          color: var(--pcy-teal);
          background: var(--pcy-teal);
        }

        .pcy-final-orbit > span:nth-child(2) {
          top: 32%;
          right: -4px;
          color: var(--pcy-lime);
          background: var(--pcy-lime);
        }

        .pcy-final-orbit > span:nth-child(3) {
          bottom: 3%;
          left: 42%;
          color: var(--pcy-purple);
          background: var(--pcy-purple);
        }

        @keyframes pcy-slow-spin {
          to { transform: rotate(360deg); }
        }

        .pcy-footer {
          padding: 40px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
          background: #07080d;
        }

        .pcy-footer .pcy-shell {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 32px;
        }

        .pcy-footer p {
          margin: 0;
          color: #656873;
          font-size: 10px;
          text-align: center;
        }

        .pcy-footer .pcy-shell > div {
          display: flex;
          align-items: center;
          gap: 18px;
          color: #555863;
          font-size: 9px;
        }

        /* Athlete-first walkthrough */
        .pcy-human-hero {
          min-height: 100svh;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          padding: 118px 0 70px;
        }

        .pcy-human-hero-image,
        .pcy-human-hero-overlay,
        .pcy-human-hero-flare {
          position: absolute;
          inset: 0;
        }

        .pcy-human-hero-image {
          z-index: -4;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 58% center;
          filter: saturate(0.94) contrast(1.04);
        }

        .pcy-human-hero-overlay {
          z-index: -3;
          background:
            linear-gradient(90deg, rgba(4, 6, 10, 0.98) 0%, rgba(4, 6, 10, 0.9) 31%, rgba(4, 6, 10, 0.3) 63%, rgba(4, 6, 10, 0.1) 100%),
            linear-gradient(0deg, rgba(4, 6, 10, 0.9) 0%, transparent 37%, rgba(4, 6, 10, 0.25) 100%);
        }

        .pcy-human-hero-flare {
          z-index: -2;
          left: 38%;
          width: 45%;
          background: radial-gradient(circle, rgba(20, 231, 208, 0.14), transparent 64%);
          filter: blur(38px);
        }

        .pcy-human-hero-grid {
          min-height: calc(100svh - 188px);
          display: grid;
          grid-template-columns: minmax(0, 0.94fr) minmax(350px, 0.48fr);
          align-items: center;
          gap: 78px;
        }

        .pcy-human-hero .pcy-hero-copy {
          position: relative;
          z-index: 2;
          max-width: 770px;
        }

        .pcy-human-hero .pcy-hero-copy > p {
          max-width: 650px;
          color: rgba(255, 255, 255, 0.78);
          font-size: clamp(1.04rem, 1.5vw, 1.23rem);
        }

        .pcy-human-hero h1 {
          max-width: 830px;
          font-size: clamp(4.1rem, 6.55vw, 6.9rem);
          text-wrap: balance;
        }

        .pcy-breathe-phone {
          width: min(100%, 362px);
          align-self: center;
          justify-self: end;
          filter: drop-shadow(0 38px 70px rgba(0, 0, 0, 0.55));
        }

        .pcy-phone-shell {
          position: relative;
          height: 686px;
          min-height: 686px;
          overflow: hidden;
          border: 7px solid #1b1e25;
          border-radius: 54px;
          color: white;
          background:
            radial-gradient(circle at 50% 33%, rgba(20, 231, 208, 0.13), transparent 31%),
            linear-gradient(160deg, #10141c 0%, #080a0f 55%, #101018 100%);
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.12),
            inset 0 0 0 3px rgba(0, 0, 0, 0.38);
        }

        .pcy-phone-shell::before,
        .pcy-phone-shell::after {
          content: '';
          position: absolute;
          left: -10px;
          width: 3px;
          border-radius: 3px 0 0 3px;
          background: #30343d;
        }

        .pcy-phone-shell::before {
          top: 124px;
          height: 62px;
        }

        .pcy-phone-shell::after {
          top: 198px;
          height: 88px;
        }

        .pcy-phone-island {
          position: absolute;
          z-index: 4;
          top: 11px;
          left: 50%;
          width: 104px;
          height: 28px;
          border-radius: 999px;
          background: #020304;
          transform: translateX(-50%);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.035);
        }

        .pcy-phone-island::after {
          content: '';
          position: absolute;
          top: 9px;
          right: 12px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #0d1825;
          box-shadow: inset 0 0 3px rgba(82, 135, 206, 0.55);
        }

        .pcy-phone-status {
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 25px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 9px;
          letter-spacing: 0.03em;
        }

        .pcy-phone-status span {
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .pcy-phone-tour-progress {
          height: 35px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 5px;
          padding: 1px 20px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .pcy-phone-tour-progress button {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 4px;
          padding: 0;
          border: 0;
          color: rgba(255, 255, 255, 0.28);
          background: transparent;
          font: inherit;
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .pcy-phone-tour-progress button i {
          height: 2px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.11);
          transition: background 0.25s ease, box-shadow 0.25s ease;
        }

        .pcy-phone-tour-progress button.is-active {
          color: var(--pcy-teal);
        }

        .pcy-phone-tour-progress button.is-active i {
          background: var(--pcy-teal);
          box-shadow: 0 0 9px rgba(20, 231, 208, 0.72);
        }

        .pcy-app-home-screen,
        .pcy-app-skill-detail,
        .pcy-app-skill-launch {
          position: relative;
          height: calc(100% - 83px);
        }

        .pcy-app-home-screen {
          padding: 17px 20px 57px;
          background:
            radial-gradient(circle at 18% 8%, rgba(20, 231, 208, 0.08), transparent 35%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent);
        }

        .pcy-app-home-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .pcy-app-home-heading small,
        .pcy-app-skill-detail-hero > small,
        .pcy-app-skill-learn > small,
        .pcy-app-why-box small,
        .pcy-app-skill-launch > small {
          color: var(--pcy-teal);
          font-size: 6px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .pcy-app-home-heading h3 {
          margin: 4px 0 0;
          font-size: 24px;
          letter-spacing: -0.045em;
        }

        .pcy-app-home-heading > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(20, 231, 208, 0.28);
          border-radius: 50%;
          color: var(--pcy-teal);
          background: rgba(20, 231, 208, 0.08);
          font-size: 8px;
          font-weight: 950;
        }

        .pcy-app-checkin-mini {
          min-height: 52px;
          display: grid;
          grid-template-columns: 31px 1fr auto;
          align-items: center;
          gap: 10px;
          margin: 15px 0 17px;
          padding: 9px 11px;
          border: 1px solid rgba(20, 231, 208, 0.16);
          border-radius: 14px;
          background: rgba(20, 231, 208, 0.055);
        }

        .pcy-app-checkin-mini > div {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: var(--pcy-teal);
          background: rgba(20, 231, 208, 0.12);
        }

        .pcy-app-checkin-mini > span {
          display: grid;
          gap: 2px;
        }

        .pcy-app-checkin-mini small {
          color: rgba(255, 255, 255, 0.38);
          font-size: 5px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .pcy-app-checkin-mini strong {
          font-size: 9px;
        }

        .pcy-app-checkin-mini > svg {
          color: var(--pcy-teal);
        }

        .pcy-app-training-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          margin-bottom: 9px;
        }

        .pcy-app-training-heading > div {
          display: grid;
          gap: 3px;
        }

        .pcy-app-training-heading small {
          color: rgba(255, 255, 255, 0.4);
          font-size: 6px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .pcy-app-training-heading strong {
          font-size: 11px;
        }

        .pcy-app-training-heading > span {
          color: rgba(255, 255, 255, 0.42);
          font-size: 8px;
          font-weight: 900;
        }

        .pcy-app-skill-stack {
          display: grid;
          gap: 8px;
        }

        .pcy-app-skill-card {
          --card-color: var(--pcy-teal);
          position: relative;
          min-height: 81px;
          display: grid;
          grid-template-columns: 38px 1fr 20px;
          align-items: center;
          gap: 10px;
          padding: 10px 11px;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--card-color) 17%, rgba(255, 255, 255, 0.08));
          border-radius: 16px;
          color: white;
          background:
            linear-gradient(105deg, color-mix(in srgb, var(--card-color) 8%, #11141b), #11131a 66%);
          text-align: left;
          font: inherit;
          cursor: pointer;
        }

        .pcy-app-skill-card--control { --card-color: #14e7d0; }
        .pcy-app-skill-card--focus { --card-color: #22d3ee; }
        .pcy-app-skill-card--mindset { --card-color: #e0fe10; }

        .pcy-app-skill-card > span {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: var(--card-color);
          background: color-mix(in srgb, var(--card-color) 12%, transparent);
        }

        .pcy-app-skill-card > div {
          display: grid;
          gap: 2px;
        }

        .pcy-app-skill-card small {
          color: var(--card-color);
          font-size: 5px;
          font-weight: 950;
          letter-spacing: 0.15em;
        }

        .pcy-app-skill-card strong {
          font-size: 11px;
        }

        .pcy-app-skill-card p {
          margin: 0;
          color: rgba(255, 255, 255, 0.44);
          font-size: 7px;
          line-height: 1.35;
        }

        .pcy-app-skill-card > svg {
          color: var(--card-color);
        }

        .pcy-app-skill-card > i {
          position: absolute;
          right: 13px;
          width: 22px;
          height: 22px;
          border: 1px solid var(--card-color);
          border-radius: 50%;
          pointer-events: none;
        }

        .pcy-app-skill-card.is-selecting {
          box-shadow: 0 0 26px color-mix(in srgb, var(--card-color) 13%, transparent);
        }

        .pcy-app-bottom-nav {
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: 12px;
          min-height: 36px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }

        .pcy-app-bottom-nav span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: rgba(255, 255, 255, 0.3);
          font-size: 6px;
          font-weight: 850;
        }

        .pcy-app-bottom-nav span.is-active {
          color: var(--pcy-teal);
        }

        .pcy-app-skill-detail {
          padding: 15px 22px 22px;
          background:
            radial-gradient(circle at 50% 28%, rgba(20, 231, 208, 0.12), transparent 32%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
        }

        .pcy-app-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0;
          border: 0;
          color: rgba(255, 255, 255, 0.48);
          background: none;
          font: inherit;
          font-size: 7px;
          font-weight: 800;
          cursor: pointer;
        }

        .pcy-app-back svg {
          transform: rotate(180deg);
        }

        .pcy-app-skill-detail-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 18px 0 15px;
          text-align: center;
        }

        .pcy-app-skill-detail-hero > div {
          width: 63px;
          height: 63px;
          display: grid;
          place-items: center;
          margin-bottom: 11px;
          border: 1px solid rgba(20, 231, 208, 0.33);
          border-radius: 20px;
          color: var(--pcy-teal);
          background:
            radial-gradient(circle, rgba(20, 231, 208, 0.16), rgba(20, 231, 208, 0.045));
          box-shadow: 0 0 34px rgba(20, 231, 208, 0.13);
        }

        .pcy-app-skill-detail-hero h3 {
          margin: 5px 0 5px;
          font-size: 27px;
          letter-spacing: -0.045em;
        }

        .pcy-app-skill-detail-hero p {
          max-width: 260px;
          margin: 0;
          color: rgba(255, 255, 255, 0.55);
          font-size: 9px;
          line-height: 1.5;
        }

        .pcy-app-skill-learn {
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.035);
        }

        .pcy-app-skill-learn > div {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 5px;
          margin-top: 9px;
        }

        .pcy-app-skill-learn span {
          display: grid;
          justify-items: center;
          gap: 5px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 6px;
          font-weight: 800;
          text-align: center;
        }

        .pcy-app-skill-learn span i {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #07100f;
          font-style: normal;
          font-size: 7px;
          font-weight: 950;
        }

        .pcy-app-why-box {
          display: grid;
          grid-template-columns: 31px 1fr;
          gap: 10px;
          margin-top: 10px;
          padding: 11px 12px;
          border-left: 2px solid var(--pcy-purple);
          border-radius: 0 13px 13px 0;
          background: rgba(154, 123, 255, 0.075);
        }

        .pcy-app-why-box > svg {
          color: var(--pcy-purple);
        }

        .pcy-app-why-box small {
          color: var(--pcy-purple);
        }

        .pcy-app-why-box p {
          margin: 3px 0 0;
          color: rgba(255, 255, 255, 0.58);
          font-size: 7px;
          line-height: 1.45;
        }

        .pcy-app-start-skill {
          position: relative;
          width: 100%;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 13px;
          overflow: hidden;
          border: 0;
          border-radius: 14px;
          color: #07100f;
          background: var(--pcy-teal);
          font: inherit;
          font-size: 10px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 14px 28px rgba(20, 231, 208, 0.16);
        }

        .pcy-app-start-skill > i {
          position: absolute;
          right: 18px;
          width: 6px;
          height: 6px;
          border: 2px solid currentColor;
          border-left: 0;
          border-bottom: 0;
          transform: rotate(45deg);
        }

        .pcy-app-skill-launch {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
          background:
            radial-gradient(circle at 50% 47%, rgba(20, 231, 208, 0.14), transparent 34%),
            linear-gradient(160deg, #0d1419, #090a10 66%);
        }

        .pcy-app-launch-ring {
          position: relative;
          width: 158px;
          height: 158px;
          display: grid;
          place-items: center;
          margin: 22px 0;
          border-radius: 50%;
          background: rgba(20, 231, 208, 0.04);
          box-shadow: inset 0 0 34px rgba(20, 231, 208, 0.08);
        }

        .pcy-app-launch-ring i {
          position: absolute;
          inset: 0;
          border: 2px solid transparent;
          border-top-color: var(--pcy-teal);
          border-right-color: rgba(20, 231, 208, 0.2);
          border-radius: 50%;
          box-shadow: 0 0 28px rgba(20, 231, 208, 0.14);
        }

        .pcy-app-launch-ring strong {
          font-size: 63px;
          letter-spacing: -0.08em;
        }

        .pcy-app-skill-launch h3 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -0.04em;
        }

        .pcy-app-skill-launch p {
          margin: 8px 0 18px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 9px;
        }

        .pcy-app-skill-launch > span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border: 1px solid rgba(20, 231, 208, 0.13);
          border-radius: 999px;
          color: rgba(255, 255, 255, 0.52);
          background: rgba(20, 231, 208, 0.05);
          font-size: 7px;
          font-weight: 800;
        }

        .pcy-app-skill-launch > span svg {
          color: var(--pcy-teal);
        }

        .pcy-breathe-app-header {
          min-height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 24px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        }

        .pcy-breathe-app-header div {
          display: grid;
          gap: 3px;
        }

        .pcy-breathe-app-header small {
          color: var(--pcy-teal);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        .pcy-breathe-app-header strong {
          font-size: 17px;
          letter-spacing: -0.02em;
        }

        .pcy-breathe-app-header > span {
          padding: 7px 9px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.045);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.1em;
        }

        .pcy-breathe-screen {
          padding: 12px 27px 16px;
        }

        .pcy-breathe-title {
          min-height: 76px;
          text-align: center;
        }

        .pcy-breathe-title small {
          color: var(--phase-color);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.18em;
          transition: color 0.3s ease;
        }

        .pcy-breathe-title h3 {
          margin: 7px 0 3px;
          font-size: 28px;
          line-height: 1;
          letter-spacing: -0.045em;
        }

        .pcy-breathe-title p {
          margin: 0;
          color: rgba(255, 255, 255, 0.55);
          font-size: 10px;
        }

        .pcy-breathe-box-wrap {
          position: relative;
          width: 196px;
          height: 196px;
          margin: 8px auto 15px;
        }

        .pcy-breathe-box {
          position: absolute;
          inset: 13px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.17);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.025);
          box-shadow:
            inset 0 0 45px rgba(255, 255, 255, 0.02),
            0 0 38px color-mix(in srgb, var(--phase-color) 10%, transparent);
        }

        .pcy-breathe-box::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          background:
            linear-gradient(90deg, var(--pcy-teal), transparent 38%) top left / 52% 1px no-repeat,
            linear-gradient(180deg, var(--pcy-lime), transparent 38%) top right / 1px 52% no-repeat,
            linear-gradient(270deg, var(--pcy-purple), transparent 38%) bottom right / 52% 1px no-repeat,
            linear-gradient(0deg, #ffb84d, transparent 38%) bottom left / 1px 52% no-repeat;
          opacity: 0.72;
        }

        .pcy-breathe-tracer {
          position: absolute;
          z-index: 3;
          width: 14px;
          height: 14px;
          border: 3px solid rgba(255, 255, 255, 0.9);
          border-radius: 50%;
          background: var(--phase-color);
          box-shadow:
            0 0 10px var(--phase-color),
            0 0 25px var(--phase-color);
        }

        .pcy-breathe-orb {
          width: 126px;
          height: 126px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid color-mix(in srgb, var(--phase-color) 50%, transparent);
          border-radius: 50%;
          color: var(--phase-color);
          background:
            radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.12), transparent 36%),
            color-mix(in srgb, var(--phase-color) 11%, #0b0d13);
          box-shadow:
            0 0 25px color-mix(in srgb, var(--phase-color) 25%, transparent),
            inset 0 0 30px color-mix(in srgb, var(--phase-color) 12%, transparent);
        }

        .pcy-breathe-orb svg {
          margin-bottom: 3px;
        }

        .pcy-breathe-orb strong {
          color: white;
          font-size: 35px;
          line-height: 1;
          letter-spacing: -0.06em;
        }

        .pcy-breathe-orb small {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.42);
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }

        .pcy-box-label {
          position: absolute;
          z-index: 2;
          color: rgba(255, 255, 255, 0.28);
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.13em;
          transition: color 0.25s ease, opacity 0.25s ease;
          white-space: nowrap;
        }

        .pcy-box-label.is-active {
          color: var(--phase-color);
          text-shadow: 0 0 12px var(--phase-color);
        }

        .pcy-box-label--top {
          top: 0;
          left: 50%;
          transform: translateX(-50%);
        }

        .pcy-box-label--right {
          top: 50%;
          right: -12px;
          transform: rotate(90deg) translateX(50%);
          transform-origin: right center;
        }

        .pcy-box-label--bottom {
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
        }

        .pcy-box-label--left {
          top: 50%;
          left: -12px;
          transform: rotate(-90deg) translateX(-50%);
          transform-origin: left center;
        }

        .pcy-breathe-progress {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 7px;
          max-width: 250px;
          margin: 0 auto 18px;
        }

        .pcy-breathe-progress span {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 5px;
          color: rgba(255, 255, 255, 0.3);
          font-size: 7px;
          font-weight: 900;
        }

        .pcy-breathe-progress span i {
          height: 3px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.1);
        }

        .pcy-breathe-progress span.is-active {
          color: var(--step-color);
        }

        .pcy-breathe-progress span.is-active i {
          background: var(--step-color);
          box-shadow: 0 0 10px color-mix(in srgb, var(--step-color) 55%, transparent);
        }

        .pcy-breathe-controls {
          display: grid;
          grid-template-columns: 44px 1fr;
          gap: 9px;
        }

        .pcy-breathe-controls button {
          height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 14px;
          font: inherit;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.2s ease, filter 0.2s ease;
        }

        .pcy-breathe-controls button:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .pcy-breathe-reset {
          color: rgba(255, 255, 255, 0.62);
          background: rgba(255, 255, 255, 0.07);
        }

        .pcy-breathe-play {
          gap: 8px;
          color: #07100f;
          background: var(--phase-color);
          box-shadow: 0 12px 26px color-mix(in srgb, var(--phase-color) 20%, transparent);
        }

        .pcy-breathe-cycle-count {
          min-height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: rgba(255, 255, 255, 0.43);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .pcy-breathe-cycle-count svg {
          color: var(--phase-color);
        }

        .pcy-phone-home-indicator {
          position: absolute;
          bottom: 8px;
          left: 50%;
          width: 108px;
          height: 4px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.76);
          transform: translateX(-50%);
        }

        .pcy-human-hero-caption {
          position: absolute;
          right: 38px;
          bottom: 28px;
          max-width: 350px;
          padding-left: 16px;
          border-left: 2px solid var(--pcy-teal);
        }

        .pcy-human-hero-caption span {
          color: var(--pcy-teal);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }

        .pcy-human-hero-caption p {
          margin: 5px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 10px;
          line-height: 1.5;
        }

        .pcy-experience-rail {
          position: relative;
          z-index: 2;
          padding: 115px 0 125px;
          overflow: hidden;
          color: #101319;
          background-color: var(--active-experience-color);
          background-image:
            linear-gradient(125deg, rgba(255, 255, 255, 0.46), transparent 48%),
            linear-gradient(315deg, rgba(255, 255, 255, 0.18), transparent 52%);
        }

        .pcy-experience-color-wash {
          position: absolute;
          inset: -25%;
          pointer-events: none;
          background:
            radial-gradient(circle at 14% 24%, rgba(255, 255, 255, 0.58), transparent 26rem),
            radial-gradient(circle at 86% 78%, rgba(255, 255, 255, 0.22), transparent 30rem),
            radial-gradient(circle at 50% 115%, color-mix(in srgb, var(--active-experience-color) 65%, white), transparent 31rem);
          filter: blur(2px);
        }

        .pcy-experience-rail .pcy-shell {
          position: relative;
          z-index: 1;
        }

        .pcy-experience-heading {
          max-width: 900px;
          display: grid;
          grid-template-columns: 0.34fr 1fr;
          column-gap: 55px;
          align-items: end;
        }

        .pcy-experience-heading > span {
          grid-row: 1 / 3;
          align-self: start;
          padding-top: 12px;
          color: rgba(8, 18, 22, 0.72);
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.17em;
        }

        .pcy-experience-heading h2,
        .pcy-walkthrough-heading h2 {
          margin: 0;
          font-size: clamp(3rem, 5.25vw, 5.55rem);
          line-height: 0.95;
          letter-spacing: -0.064em;
          text-wrap: balance;
        }

        .pcy-experience-heading p {
          max-width: 620px;
          margin: 20px 0 0;
          color: rgba(12, 20, 24, 0.7);
          font-size: 15px;
          line-height: 1.65;
        }

        .pcy-experience-steps {
          position: relative;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 11px;
          margin-top: 68px;
        }

        .pcy-experience-steps > div {
          height: 100%;
        }

        .pcy-experience-step {
          --walk-color: var(--pcy-teal);
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          min-height: 250px;
          display: block;
          padding: 20px;
          overflow: hidden;
          border: 1px solid rgba(10, 16, 23, 0.09);
          border-radius: 22px;
          color: #101319;
          background: rgba(255, 255, 255, 0.76);
          text-align: left;
          font: inherit;
          cursor: pointer;
          box-shadow: 0 18px 48px rgba(20, 29, 38, 0.08);
          transition:
            transform 0.38s cubic-bezier(.22, 1, .36, 1),
            border-color 0.38s ease,
            color 0.38s ease,
            background-color 0.38s ease,
            box-shadow 0.38s ease;
        }

        .pcy-experience-step:hover {
          transform: translateY(-7px);
          box-shadow: 0 26px 60px rgba(20, 29, 38, 0.14);
        }

        .pcy-experience-step:focus-visible {
          outline: 3px solid #11141a;
          outline-offset: 4px;
        }

        .pcy-experience-step.is-active {
          transform: translateY(-12px);
          border-color: rgba(255, 255, 255, 0.2);
          color: white;
          background: #11141a;
          box-shadow:
            0 32px 70px rgba(15, 20, 26, 0.3),
            0 0 0 1px color-mix(in srgb, var(--walk-color) 65%, transparent);
        }

        .pcy-experience-step.is-active:hover {
          transform: translateY(-14px);
        }

        .pcy-experience-step > div {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          color: color-mix(in srgb, var(--walk-color) 74%, #101319);
        }

        .pcy-experience-step > div > svg {
          width: 43px;
          height: 43px;
          padding: 12px;
          border-radius: 14px;
          color: #071013;
          background: var(--walk-color);
        }

        .pcy-experience-step > div small {
          font-size: 10px;
          font-weight: 950;
        }

        .pcy-experience-step h3 {
          margin: 61px 0 10px;
          font-size: 21px;
          letter-spacing: -0.04em;
        }

        .pcy-experience-step p {
          margin: 0;
          color: #646b68;
          font-size: 11px;
          line-height: 1.62;
          transition: color 0.38s ease;
        }

        .pcy-experience-step.is-active p {
          color: rgba(255, 255, 255, 0.68);
        }

        .pcy-experience-card-progress {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          height: 5px;
          background: var(--walk-color);
          box-shadow: 0 0 18px color-mix(in srgb, var(--walk-color) 72%, transparent);
          transform-origin: left;
        }

        .pcy-motion-marquee {
          width: 100%;
          overflow: hidden;
          background: var(--pcy-lime);
        }

        .pcy-motion-marquee > div {
          width: max-content;
          min-height: 67px;
          display: flex;
          align-items: center;
          gap: 25px;
          color: #0b0e10;
        }

        .pcy-motion-marquee span {
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .pcy-motion-marquee i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #0b0e10;
        }

        .pcy-skills-library-section {
          position: relative;
          scroll-margin-top: 78px;
          padding: 138px 0 150px;
          overflow: hidden;
          color: #111319;
          background:
            radial-gradient(circle at 7% 12%, rgba(154, 123, 255, 0.18), transparent 27rem),
            radial-gradient(circle at 91% 90%, rgba(20, 231, 208, 0.16), transparent 25rem),
            #f3f2eb;
        }

        .pcy-skills-art-word {
          position: absolute;
          top: 44px;
          right: -0.08em;
          color: rgba(15, 18, 24, 0.035);
          font-size: clamp(9rem, 24vw, 24rem);
          font-weight: 950;
          line-height: 0.8;
          letter-spacing: -0.09em;
          pointer-events: none;
          user-select: none;
        }

        .pcy-skills-library-heading {
          position: relative;
          z-index: 1;
          max-width: 900px;
        }

        .pcy-skills-library-heading .pcy-kicker {
          color: #6f4fd6;
        }

        .pcy-skills-library-heading h2 {
          max-width: 870px;
          margin: 23px 0 0;
          font-size: clamp(3.4rem, 6.2vw, 6.65rem);
          line-height: 0.91;
          letter-spacing: -0.073em;
          text-wrap: balance;
        }

        .pcy-skills-library-heading h2 strong {
          display: inline-block;
          color: transparent;
          background: linear-gradient(100deg, #15aa9b, #7456e6 76%);
          -webkit-background-clip: text;
          background-clip: text;
          font-weight: inherit;
        }

        .pcy-skills-library-heading > p {
          max-width: 650px;
          margin: 25px 0 0;
          color: #5e6463;
          font-size: 16px;
          line-height: 1.7;
        }

        .pcy-skills-library-layout {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(300px, 0.76fr) minmax(430px, 1.24fr);
          align-items: stretch;
          gap: 24px;
          margin-top: 68px;
        }

        .pcy-skills-category-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .pcy-skills-category-grid button {
          --skill-color: var(--pcy-teal);
          min-height: 92px;
          display: grid;
          grid-template-columns: 40px 1fr auto;
          align-items: center;
          gap: 11px;
          padding: 15px;
          border: 1px solid rgba(15, 20, 28, 0.09);
          border-radius: 18px;
          color: #171b21;
          background: rgba(255, 255, 255, 0.72);
          text-align: left;
          font: inherit;
          cursor: pointer;
          box-shadow: 0 14px 32px rgba(24, 31, 42, 0.05);
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        }

        .pcy-skills-category-grid button:hover,
        .pcy-skills-category-grid button.is-active {
          transform: translateY(-4px);
          border-color: color-mix(in srgb, var(--skill-color) 58%, transparent);
          box-shadow: 0 20px 42px color-mix(in srgb, var(--skill-color) 13%, rgba(24, 31, 42, 0.08));
        }

        .pcy-skills-category-grid button > span {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          color: color-mix(in srgb, var(--skill-color) 75%, #0e151c);
          background: color-mix(in srgb, var(--skill-color) 13%, white);
        }

        .pcy-skills-category-grid button > strong {
          font-size: 12px;
          line-height: 1.25;
        }

        .pcy-skills-category-grid button > svg {
          color: color-mix(in srgb, var(--skill-color) 80%, #101319);
          opacity: 0.42;
          transition: opacity 0.25s ease, transform 0.25s ease;
        }

        .pcy-skills-category-grid button.is-active > svg {
          opacity: 1;
          transform: translateX(3px);
        }

        .pcy-skills-category-detail {
          min-height: 470px;
        }

        .pcy-skills-category-detail > div {
          --skill-color: var(--pcy-teal);
          position: relative;
          height: 100%;
          display: grid;
          grid-template-columns: minmax(220px, 0.86fr) minmax(260px, 1.14fr);
          gap: clamp(24px, 4vw, 52px);
          align-items: center;
          padding: clamp(30px, 4vw, 52px);
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--skill-color) 28%, rgba(15, 20, 28, 0.08));
          border-radius: 30px;
          background:
            radial-gradient(circle at 87% 14%, color-mix(in srgb, var(--skill-color) 18%, transparent), transparent 18rem),
            linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 42%),
            #11131a;
          box-shadow: 0 30px 75px rgba(17, 23, 31, 0.18);
        }

        .pcy-skills-detail-copy {
          position: relative;
          z-index: 2;
        }

        .pcy-skills-detail-icon {
          width: 60px;
          height: 60px;
          display: grid;
          place-items: center;
          margin-bottom: 28px;
          border: 1px solid color-mix(in srgb, var(--skill-color) 40%, transparent);
          border-radius: 19px;
          color: var(--skill-color);
          background: color-mix(in srgb, var(--skill-color) 10%, transparent);
          box-shadow: 0 0 34px color-mix(in srgb, var(--skill-color) 14%, transparent);
        }

        .pcy-skills-category-detail small {
          color: var(--skill-color);
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .pcy-skills-category-detail h3 {
          max-width: 430px;
          margin: 12px 0 0;
          color: white;
          font-size: clamp(1.8rem, 2.5vw, 2.75rem);
          line-height: 1.02;
          letter-spacing: -0.05em;
        }

        .pcy-skills-detail-copy > p {
          margin: 23px 0 0;
          color: rgba(255, 255, 255, 0.48);
          font-size: 11px;
          line-height: 1.55;
        }

        .pcy-skills-motion-stage {
          min-height: 370px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--skill-color) 32%, rgba(255, 255, 255, 0.09));
          border-radius: 24px;
          background:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
            radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--skill-color) 13%, transparent), transparent 14rem),
            rgba(4, 6, 10, 0.7);
          background-size: 32px 32px, 32px 32px, auto, auto;
          box-shadow: inset 0 0 70px rgba(0, 0, 0, 0.32);
        }

        .pcy-skills-motion-visual-wrap {
          position: absolute;
          inset: 0;
        }

        .pcy-skill-motion-visual {
          --skill-color: var(--pcy-teal);
          position: absolute;
          top: 22px;
          right: 18px;
          left: 18px;
          height: 245px;
          display: grid;
          place-items: center;
        }

        .pcy-skill-motion-ring {
          position: absolute;
          border: 1px solid color-mix(in srgb, var(--skill-color) 50%, transparent);
          border-radius: 50%;
          box-shadow: 0 0 40px color-mix(in srgb, var(--skill-color) 9%, transparent);
        }

        .pcy-skill-motion-ring--outer {
          width: 190px;
          height: 190px;
        }

        .pcy-skill-motion-ring--inner {
          width: 132px;
          height: 132px;
          border-style: dashed;
          opacity: 0.52;
        }

        .pcy-skill-motion-scan {
          position: absolute;
          width: 212px;
          height: 212px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            transparent 0 76%,
            color-mix(in srgb, var(--skill-color) 60%, transparent) 87%,
            transparent 96%
          );
          mask-image: radial-gradient(circle, transparent 0 47%, black 49% 51%, transparent 53%);
        }

        .pcy-skill-motion-core {
          width: 92px;
          height: 92px;
          position: relative;
          z-index: 2;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--skill-color) 54%, transparent);
          border-radius: 28px;
          color: #071013;
          background: var(--skill-color);
          box-shadow:
            0 0 0 12px color-mix(in srgb, var(--skill-color) 8%, transparent),
            0 0 65px color-mix(in srgb, var(--skill-color) 32%, transparent);
        }

        .pcy-skill-motion-visual--focus .pcy-skill-motion-core,
        .pcy-skill-motion-visual--pressure .pcy-skill-motion-core {
          border-radius: 50%;
        }

        .pcy-skill-motion-visual--recovery .pcy-skill-motion-ring,
        .pcy-skill-motion-visual--routines .pcy-skill-motion-ring {
          border-radius: 32px;
        }

        .pcy-skill-motion-points span {
          width: 9px;
          height: 9px;
          position: absolute;
          border-radius: 50%;
          background: var(--skill-color);
          box-shadow: 0 0 18px var(--skill-color);
        }

        .pcy-skill-motion-points span:nth-child(1) { top: 41px; left: 58px; }
        .pcy-skill-motion-points span:nth-child(2) { top: 76px; right: 52px; }
        .pcy-skill-motion-points span:nth-child(3) { right: 75px; bottom: 38px; }

        .pcy-skills-motion-caption {
          position: relative;
          z-index: 4;
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(6, 8, 12, 0.78);
          backdrop-filter: blur(14px);
        }

        .pcy-skills-motion-caption > small {
          display: block;
          margin-bottom: 7px;
        }

        .pcy-skills-motion-caption > strong {
          min-height: 27px;
          display: block;
          color: white;
          font-size: 17px;
          line-height: 1.2;
          letter-spacing: -0.025em;
        }

        .pcy-skills-motion-caption > div {
          display: grid;
          grid-template-columns: 30px 1fr 30px;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
        }

        .pcy-skills-motion-caption > div > button {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 50%;
          color: white;
          background: rgba(255, 255, 255, 0.04);
          cursor: pointer;
        }

        .pcy-skills-motion-caption > div > button:first-child svg {
          transform: rotate(180deg);
        }

        .pcy-skills-motion-caption > div > span {
          display: flex;
          justify-content: center;
          gap: 6px;
        }

        .pcy-skills-motion-caption > div > span button {
          width: 7px;
          height: 7px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          cursor: pointer;
          transition: width 0.25s ease, background 0.25s ease;
        }

        .pcy-skills-motion-caption > div > span button.is-active {
          width: 24px;
          background: var(--skill-color);
          box-shadow: 0 0 12px color-mix(in srgb, var(--skill-color) 55%, transparent);
        }

        .pcy-walkthrough {
          padding: 140px 0;
          background:
            radial-gradient(circle at 12% 15%, rgba(154, 123, 255, 0.1), transparent 25rem),
            #08090d;
        }

        .pcy-walkthrough-heading {
          max-width: 930px;
          margin-bottom: 58px;
        }

        .pcy-walkthrough-heading > span {
          display: block;
          margin-bottom: 18px;
          color: var(--pcy-teal);
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.17em;
        }

        .pcy-walkthrough-heading > p {
          max-width: 690px;
          margin: 22px 0 0;
          color: #90949f;
          font-size: 15px;
          line-height: 1.7;
        }

        .pcy-walkthrough-stage {
          min-height: 720px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 34px;
          box-shadow: 0 45px 110px rgba(0, 0, 0, 0.42);
        }

        .pcy-walkthrough-stage > img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .pcy-walkthrough-shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(4, 6, 10, 0.15), rgba(4, 6, 10, 0.08) 48%, rgba(4, 6, 10, 0.94) 100%),
            linear-gradient(0deg, rgba(4, 6, 10, 0.8), transparent 56%);
        }

        .pcy-walkthrough-nav {
          position: absolute;
          z-index: 3;
          top: 22px;
          left: 22px;
          right: 22px;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          padding: 8px;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 18px;
          background: rgba(7, 9, 14, 0.72);
          backdrop-filter: blur(18px);
        }

        .pcy-walkthrough-nav button {
          --walk-color: var(--pcy-teal);
          min-height: 62px;
          display: grid;
          grid-template-columns: 30px 1fr;
          grid-template-rows: auto auto;
          align-items: center;
          column-gap: 8px;
          padding: 8px 10px;
          border: 1px solid transparent;
          border-radius: 13px;
          color: #6d7480;
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
        }

        .pcy-walkthrough-nav button:hover { transform: translateY(-2px); }
        .pcy-walkthrough-nav button.reached { color: var(--walk-color); }
        .pcy-walkthrough-nav button.active {
          border-color: color-mix(in srgb, var(--walk-color) 38%, transparent);
          color: white;
          background: color-mix(in srgb, var(--walk-color) 12%, rgba(255, 255, 255, 0.025));
        }

        .pcy-walkthrough-nav button > span {
          width: 29px;
          height: 29px;
          grid-row: 1 / 3;
          display: grid;
          place-items: center;
          border-radius: 9px;
          color: var(--walk-color);
          background: color-mix(in srgb, var(--walk-color) 10%, transparent);
        }

        .pcy-walkthrough-nav button.active > span {
          color: #071013;
          background: var(--walk-color);
        }

        .pcy-walkthrough-nav small {
          color: currentColor;
          font-size: 7px;
          font-weight: 950;
        }

        .pcy-walkthrough-nav strong {
          font-size: 9px;
        }

        .pcy-walkthrough-card {
          --walk-color: var(--pcy-teal);
          position: absolute;
          z-index: 3;
          top: 124px;
          right: 28px;
          width: min(420px, 42%);
          padding: 24px;
          border: 1px solid color-mix(in srgb, var(--walk-color) 30%, rgba(255, 255, 255, 0.1));
          border-radius: 22px;
          background: rgba(7, 9, 14, 0.78);
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(18px);
        }

        .pcy-walkthrough-card-head {
          display: grid;
          grid-template-columns: 43px 1fr;
          align-items: center;
          gap: 12px;
        }

        .pcy-walkthrough-card-head > span {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: #071013;
          background: var(--walk-color);
        }

        .pcy-walkthrough-card-head small {
          display: block;
          color: var(--walk-color);
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .pcy-walkthrough-card-head strong {
          display: block;
          margin-top: 4px;
          font-size: 17px;
        }

        .pcy-walkthrough-card > p {
          margin: 20px 0;
          color: #9ba1ad;
          font-size: 12px;
          line-height: 1.62;
        }

        .pcy-walkthrough-response {
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-left-color: var(--walk-color);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.035);
        }

        .pcy-walkthrough-response small {
          display: block;
          color: #747b87;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .pcy-walkthrough-response strong {
          display: block;
          margin-top: 8px;
          font-size: 12px;
          line-height: 1.5;
        }

        .pcy-walkthrough-takeaway {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 16px;
          color: var(--walk-color);
        }

        .pcy-walkthrough-takeaway span {
          color: #a7adb7;
          font-size: 10px;
          line-height: 1.5;
        }

        .pcy-walkthrough-controls {
          display: grid;
          grid-template-columns: 36px 1fr 36px;
          align-items: center;
          gap: 12px;
          margin-top: 22px;
        }

        .pcy-walkthrough-controls > button {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 50%;
          color: white;
          background: rgba(255, 255, 255, 0.04);
          cursor: pointer;
        }

        .pcy-walkthrough-controls > button:first-child svg { transform: rotate(180deg); }

        .pcy-walkthrough-controls > div {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .pcy-walkthrough-controls > div button {
          width: 7px;
          height: 7px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          cursor: pointer;
          transition: width 0.2s ease, background 0.2s ease;
        }

        .pcy-walkthrough-controls > div button.active {
          width: 24px;
          background: var(--walk-color);
        }

        .pcy-walkthrough-moment {
          position: absolute;
          z-index: 3;
          left: 34px;
          bottom: 30px;
          max-width: 470px;
        }

        .pcy-walkthrough-moment span {
          color: var(--pcy-teal);
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.15em;
        }

        .pcy-walkthrough-moment strong {
          display: block;
          margin-top: 8px;
          font-size: clamp(1.8rem, 3vw, 3.2rem);
          line-height: 1;
          letter-spacing: -0.05em;
        }

        .pcy-checkin-demo-section {
          padding: 140px 0;
          border-block: 1px solid rgba(255, 255, 255, 0.07);
          background:
            radial-gradient(circle at 18% 36%, rgba(20, 231, 208, 0.08), transparent 28rem),
            #07090e;
        }

        .pcy-checkin-demo-heading {
          max-width: 900px;
          margin: 0 auto 58px;
          text-align: center;
        }

        .pcy-checkin-demo-heading .pcy-kicker {
          justify-content: center;
        }

        .pcy-checkin-demo-heading > p {
          max-width: 620px;
          margin-inline: auto;
        }

        .pcy-checkin-demo-stage {
          display: grid;
          grid-template-columns: minmax(0, 760px) minmax(260px, 0.48fr);
          align-items: center;
          justify-content: center;
          gap: 58px;
        }

        .pcy-checkin-device {
          position: relative;
          overflow: hidden;
          padding: 14px 14px 22px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 36px;
          background:
            linear-gradient(150deg, rgba(255, 255, 255, 0.05), transparent 32%),
            #0b0d13;
          box-shadow: 0 42px 100px rgba(0, 0, 0, 0.48);
        }

        .pcy-checkin-device-bar {
          min-height: 31px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: start;
          padding: 1px 13px 8px;
          color: rgba(255, 255, 255, 0.75);
          font-size: 8px;
          font-weight: 850;
        }

        .pcy-checkin-device-bar > span:last-child {
          text-align: right;
        }

        .pcy-checkin-device-bar i {
          width: 90px;
          height: 20px;
          border-radius: 999px;
          background: #020203;
        }

        .pcy-checkin-device-home {
          width: 120px;
          height: 4px;
          margin: 14px auto 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.28);
        }

        .pcy-live-card--actual {
          --selected-color: var(--pcy-teal);
          --selected-glow: rgba(20, 231, 208, 0.18);
          min-height: 390px;
          padding: 24px;
          border-color: rgba(20, 231, 208, 0.24);
          border-radius: 23px;
          background:
            linear-gradient(150deg, rgba(255, 255, 255, 0.045), transparent 34%),
            #111219;
        }

        .pcy-live-card--actual .pcy-live-card-glow {
          background: radial-gradient(circle, var(--selected-glow), transparent 68%);
        }

        .pcy-actual-checkin-label {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--pcy-teal);
        }

        .pcy-actual-checkin-label span {
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .pcy-live-card--actual .pcy-live-card-top {
          margin-top: 26px;
        }

        .pcy-live-card--actual .pcy-live-card-top h3 {
          margin: 0;
          font-size: 25px;
          font-weight: 900;
        }

        .pcy-live-card--actual .pcy-live-card-top p {
          margin: 7px 0 0;
          color: rgba(255, 255, 255, 0.55);
          font-size: 13px;
          line-height: 1.5;
        }

        .pcy-live-card--actual .pcy-checkin-options {
          margin-top: 28px;
        }

        .pcy-live-card--actual .pcy-checkin-options button {
          min-height: 108px;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.05);
        }

        .pcy-live-card--actual .pcy-checkin-options button span {
          font-size: 25px;
        }

        .pcy-live-card--actual .pcy-checkin-options button small {
          color: rgba(255, 255, 255, 0.7);
          font-size: 10px;
        }

        .pcy-checkin-saved {
          position: relative;
          display: grid;
          grid-template-columns: 1fr auto 34px;
          align-items: center;
          gap: 12px;
          margin-top: 24px;
        }

        .pcy-checkin-saved > div {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .pcy-checkin-saved > div:first-child span {
          font-size: 22px;
        }

        .pcy-checkin-saved > div:first-child strong {
          font-size: 15px;
        }

        .pcy-checkin-saved > div:nth-child(2) {
          color: var(--pcy-teal);
          font-size: 11px;
        }

        .pcy-checkin-saved > button {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.78);
          background: rgba(255, 255, 255, 0.08);
          cursor: pointer;
        }

        .pcy-actual-nora-response {
          position: relative;
          display: grid;
          grid-template-columns: 28px 1fr;
          align-items: start;
          gap: 11px;
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pcy-actual-nora-response p,
        .pcy-actual-nora-response strong {
          margin: 0;
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          line-height: 1.55;
        }

        .pcy-actual-nora-response strong {
          display: block;
          margin-top: 8px;
          color: white;
        }

        .pcy-actual-reply-choices {
          position: relative;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-top: 19px;
        }

        .pcy-actual-reply-choices button {
          min-height: 42px;
          padding: 8px 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 9px;
          color: rgba(255, 255, 255, 0.84);
          background: rgba(255, 255, 255, 0.05);
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .pcy-actual-reply-choices button.active {
          border-color: var(--selected-color);
          color: #07100f;
          background: var(--selected-color);
        }

        .pcy-actual-reply-result {
          position: relative;
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
        }

        .pcy-actual-reply-result span {
          padding: 7px 10px;
          border-radius: 10px;
          color: #07100f;
          background: var(--selected-color);
          font-size: 10px;
          font-weight: 900;
        }

        .pcy-actual-reply-result p {
          margin: 0;
          color: rgba(255, 255, 255, 0.74);
          font-size: 11px;
          line-height: 1.45;
        }

        .pcy-checkin-demo-notes > span {
          color: var(--pcy-teal);
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.15em;
        }

        .pcy-checkin-demo-notes h3 {
          margin: 12px 0;
          font-size: 32px;
          line-height: 1;
          letter-spacing: -0.05em;
        }

        .pcy-checkin-demo-notes > p {
          margin: 0 0 24px;
          color: #969ca7;
          font-size: 13px;
          line-height: 1.65;
        }

        .pcy-checkin-demo-notes > div {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 13px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--pcy-teal);
        }

        .pcy-checkin-demo-notes > div span {
          color: #a2a8b2;
          font-size: 11px;
          line-height: 1.45;
        }

        .pcy-teaching-section {
          position: relative;
          overflow: hidden;
          padding: 150px 0;
          color: #101319;
          background:
            radial-gradient(circle at 8% 18%, rgba(154, 123, 255, 0.22), transparent 28rem),
            radial-gradient(circle at 94% 82%, rgba(20, 231, 208, 0.19), transparent 30rem),
            #f1f0e9;
        }

        .pcy-teaching-section::before {
          content: 'WHY';
          position: absolute;
          top: 30px;
          right: -20px;
          color: rgba(16, 19, 25, 0.035);
          font-size: clamp(12rem, 28vw, 27rem);
          font-weight: 950;
          line-height: 0.8;
          letter-spacing: -0.09em;
          pointer-events: none;
        }

        .pcy-teaching-heading {
          position: relative;
          z-index: 1;
          max-width: 980px;
          margin-bottom: 64px;
        }

        .pcy-teaching-heading .pcy-kicker {
          color: #6750c9;
        }

        .pcy-teaching-heading h2 {
          max-width: 870px;
          margin: 18px 0 20px;
          color: #101319;
          font-size: clamp(3.8rem, 7.5vw, 7.2rem);
          line-height: 0.88;
          letter-spacing: -0.075em;
        }

        .pcy-teaching-heading > p {
          max-width: 720px;
          margin: 0;
          color: #646972;
          font-size: 16px;
          line-height: 1.65;
        }

        .pcy-teaching-layout {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(310px, 0.72fr) minmax(540px, 1.28fr);
          align-items: stretch;
          gap: 46px;
        }

        .pcy-teaching-explainer {
          display: flex;
          flex-direction: column;
          padding: 26px 0;
        }

        .pcy-teaching-explainer > span {
          color: #6750c9;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.18em;
        }

        .pcy-teaching-stage-picker {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 25px;
        }

        .pcy-teaching-stage-picker button {
          min-height: 68px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 12px;
          border: 1px solid rgba(16, 19, 25, 0.09);
          border-radius: 12px;
          color: #7b7f88;
          background: rgba(255, 255, 255, 0.58);
          text-align: left;
          cursor: pointer;
          transition: color 0.25s ease, background 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
        }

        .pcy-teaching-stage-picker button:hover {
          transform: translateY(-3px);
        }

        .pcy-teaching-stage-picker button.is-active {
          border-color: #9a7bff;
          color: white;
          background: #6f55d8;
          box-shadow: 0 14px 30px rgba(84, 59, 181, 0.2);
        }

        .pcy-teaching-stage-picker small {
          font-size: 8px;
          font-weight: 900;
          opacity: 0.64;
        }

        .pcy-teaching-stage-picker strong {
          font-size: 9px;
          letter-spacing: 0.08em;
        }

        .pcy-teaching-copy {
          display: flex;
          flex: 1;
          flex-direction: column;
          justify-content: center;
          padding: 42px 0 8px;
        }

        .pcy-teaching-copy > small {
          color: #999ca3;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.17em;
        }

        .pcy-teaching-copy h3 {
          max-width: 390px;
          margin: 13px 0 18px;
          color: #101319;
          font-size: clamp(2.5rem, 4.4vw, 4.5rem);
          line-height: 0.94;
          letter-spacing: -0.06em;
        }

        .pcy-teaching-copy > p {
          max-width: 430px;
          margin: 0;
          color: #626872;
          font-size: 14px;
          line-height: 1.72;
        }

        .pcy-teaching-copy > div {
          display: grid;
          grid-template-columns: 40px 1fr;
          gap: 13px;
          margin-top: 31px;
          padding: 19px;
          border: 1px solid rgba(103, 80, 201, 0.18);
          border-radius: 16px;
          color: #6750c9;
          background: rgba(255, 255, 255, 0.62);
          box-shadow: 0 18px 38px rgba(48, 40, 84, 0.06);
        }

        .pcy-teaching-copy > div > svg {
          width: 40px;
          height: 40px;
          padding: 9px;
          border-radius: 12px;
          background: rgba(154, 123, 255, 0.14);
        }

        .pcy-teaching-copy > div span {
          color: #525762;
          font-size: 12px;
          line-height: 1.55;
        }

        .pcy-teaching-copy > div strong {
          display: block;
          margin-bottom: 4px;
          color: #6750c9;
          font-size: 8px;
          letter-spacing: 0.14em;
        }

        .pcy-teaching-demo {
          min-height: 870px;
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 26px;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 34px;
          color: white;
          background:
            radial-gradient(circle at 52% 38%, rgba(154, 123, 255, 0.16), transparent 29rem),
            linear-gradient(150deg, #17141e, #090a0f 68%);
          box-shadow: 0 46px 100px rgba(36, 29, 67, 0.28);
        }

        .pcy-teaching-demo::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(255, 255, 255, 0.045), transparent 28%);
          pointer-events: none;
        }

        .pcy-teaching-demo-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          color: var(--pcy-purple);
        }

        .pcy-teaching-demo-header span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .pcy-teaching-demo-header small {
          padding: 7px 9px;
          border: 1px solid rgba(154, 123, 255, 0.24);
          border-radius: 999px;
          color: rgba(255, 255, 255, 0.52);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .pcy-teaching-demo-progress {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 27px 0 22px;
        }

        .pcy-teaching-demo-progress button {
          display: grid;
          gap: 7px;
          padding: 0;
          border: 0;
          color: rgba(255, 255, 255, 0.25);
          background: transparent;
          cursor: pointer;
        }

        .pcy-teaching-demo-progress i {
          height: 4px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.1);
        }

        .pcy-teaching-demo-progress button.is-complete i {
          background: var(--pcy-purple);
          box-shadow: 0 0 12px rgba(154, 123, 255, 0.38);
        }

        .pcy-teaching-demo-progress span {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.09em;
        }

        .pcy-teaching-demo-progress span.is-current {
          color: var(--pcy-purple);
        }

        .pcy-teaching-demo > h3 {
          position: relative;
          margin: 0;
          font-size: clamp(2rem, 3.4vw, 3.4rem);
          line-height: 0.98;
          letter-spacing: -0.05em;
          text-align: center;
        }

        .pcy-mental-rehearsal-visual {
          position: relative;
          height: 420px;
          overflow: hidden;
          margin-top: 18px;
          padding: 0;
          border: 1px solid rgba(183, 155, 255, 0.36);
          border-radius: 25px;
          color: white;
          background: #080911;
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.04),
            0 24px 58px rgba(0, 0, 0, 0.34);
          cursor: pointer;
        }

        .pcy-mental-rehearsal-visual::after {
          content: '';
          position: absolute;
          z-index: 2;
          inset: 0;
          background:
            linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom, black 15%, transparent 88%);
          pointer-events: none;
        }

        .pcy-rehearsal-photo {
          position: absolute;
          z-index: 0;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 48% center;
        }

        .pcy-rehearsal-cinema {
          position: absolute;
          z-index: 1;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(7, 8, 14, 0.86) 0%, rgba(7, 8, 14, 0.5) 42%, rgba(7, 8, 14, 0.08) 72%),
            linear-gradient(0deg, rgba(7, 8, 14, 0.94) 0%, transparent 45%, rgba(7, 8, 14, 0.32) 100%),
            radial-gradient(circle at 78% 42%, transparent 0%, transparent 10%, rgba(63, 38, 107, 0.34) 35%, transparent 58%);
          pointer-events: none;
        }

        .pcy-imagination-beam {
          position: absolute;
          z-index: 2;
          top: 16%;
          right: 5%;
          width: 68%;
          height: 65%;
          background:
            linear-gradient(90deg, rgba(154, 123, 255, 0), rgba(154, 123, 255, 0.19) 55%, rgba(20, 231, 208, 0.15));
          clip-path: polygon(0 43%, 100% 0, 100% 100%, 0 58%);
          transform-origin: left center;
          filter: blur(1px);
          pointer-events: none;
        }

        .pcy-imagination-rings {
          position: absolute;
          z-index: 4;
          top: 17%;
          right: 10%;
          width: 150px;
          height: 150px;
          display: grid;
          place-items: center;
          color: white;
          filter: drop-shadow(0 0 18px rgba(154, 123, 255, 0.55));
          pointer-events: none;
        }

        .pcy-imagination-rings span {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(189, 165, 255, 0.55);
          border-radius: 50%;
        }

        .pcy-imagination-rings span:nth-child(2) {
          inset: 22px;
        }

        .pcy-imagination-rings span:nth-child(3) {
          inset: 45px;
        }

        .pcy-vision-statement {
          position: absolute;
          z-index: 5;
          left: 26px;
          bottom: 26px;
          width: min(57%, 410px);
          text-align: left;
          pointer-events: none;
        }

        .pcy-vision-statement > span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #c7b4ff;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .pcy-vision-statement strong {
          display: block;
          margin-top: 8px;
          color: white;
          font-size: clamp(1.55rem, 3.2vw, 2.65rem);
          line-height: 0.98;
          letter-spacing: -0.05em;
          text-wrap: balance;
          text-shadow: 0 3px 18px rgba(0, 0, 0, 0.7);
        }

        .pcy-rehearsal-scene-details {
          position: absolute;
          z-index: 6;
          top: 19px;
          left: 20px;
          display: flex;
          gap: 6px;
        }

        .pcy-rehearsal-scene-details span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 999px;
          color: rgba(255, 255, 255, 0.78);
          background: rgba(7, 8, 13, 0.68);
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.08em;
          backdrop-filter: blur(14px);
        }

        .pcy-rehearsal-scene-details small {
          color: var(--pcy-purple);
          font-size: 6px;
        }

        .pcy-brain-plan {
          position: absolute;
          z-index: 7;
          right: 20px;
          bottom: 22px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pcy-brain-plan span {
          position: relative;
          width: 66px;
          height: 66px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 3px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.5);
          background: rgba(7, 8, 13, 0.76);
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.09em;
          backdrop-filter: blur(15px);
          transition: color 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .pcy-brain-plan span::after {
          content: '';
          position: absolute;
          width: 8px;
          height: 1px;
          margin-left: 74px;
          background: rgba(255, 255, 255, 0.2);
        }

        .pcy-brain-plan span:last-child::after {
          display: none;
        }

        .pcy-brain-plan span i {
          color: var(--pcy-purple);
          font-size: 8px;
          font-style: normal;
        }

        .pcy-brain-plan span.is-active {
          border-color: #bba4ff;
          color: white;
          background: rgba(111, 85, 216, 0.86);
          box-shadow: 0 0 28px rgba(154, 123, 255, 0.48);
        }

        .pcy-mental-rehearsal-visual--understand .pcy-vision-statement {
          width: 43%;
        }

        .pcy-practice-beats {
          position: absolute;
          z-index: 7;
          right: 18px;
          bottom: 17px;
          left: 18px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .pcy-practice-beats span {
          position: relative;
          min-height: 96px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 13px;
          color: rgba(255, 255, 255, 0.54);
          background: #090a10;
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.24);
          opacity: 0.62;
          transition: opacity 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
        }

        .pcy-practice-beats span > i {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(0deg, rgba(7, 8, 14, 0.94), transparent 68%),
            url('/pulsecheck-youth/teachable-visualization-illustration.webp');
          background-size: auto, 340% auto;
          background-repeat: no-repeat;
          filter: saturate(0.5);
          transition: filter 0.3s ease;
        }

        .pcy-practice-beats span > strong {
          position: absolute;
          z-index: 2;
          right: 9px;
          bottom: 8px;
          left: 9px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 7px;
          letter-spacing: 0.1em;
        }

        .pcy-practice-beats span.is-active {
          border-color: #c7b4ff;
          color: white;
          opacity: 1;
          transform: translateY(-5px);
          box-shadow: 0 17px 34px rgba(81, 57, 170, 0.34);
        }

        .pcy-practice-beats span.is-active > i {
          filter: saturate(1.15);
        }

        .pcy-mental-rehearsal-visual--practice .pcy-vision-statement {
          top: 72px;
          bottom: auto;
          width: min(62%, 440px);
        }

        .pcy-teaching-tap {
          position: relative;
          align-self: center;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 12px;
          padding: 7px 10px;
          border: 0;
          color: rgba(255, 255, 255, 0.58);
          background: transparent;
          font: inherit;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .pcy-teaching-tap svg {
          color: var(--pcy-purple);
        }

        .pcy-teaching-caption {
          position: relative;
          max-width: 570px;
          min-height: 55px;
          margin: 13px auto 18px;
          color: rgba(255, 255, 255, 0.76);
          font-size: 12px;
          line-height: 1.55;
          text-align: center;
        }

        .pcy-teaching-continue {
          position: relative;
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: auto;
          border: 0;
          border-radius: 12px;
          color: #100d17;
          background: var(--pcy-purple);
          font: inherit;
          font-size: 11px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 15px 30px rgba(154, 123, 255, 0.19);
          transition: transform 0.22s ease, filter 0.22s ease;
        }

        .pcy-teaching-continue:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .pcy-teaching-principles {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 38px;
        }

        .pcy-teaching-principles > div {
          display: grid;
          grid-template-columns: 42px 1fr;
          grid-template-rows: auto auto;
          align-items: center;
          column-gap: 13px;
          padding: 18px;
          border: 1px solid rgba(16, 19, 25, 0.08);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.55);
        }

        .pcy-teaching-principles svg {
          grid-row: 1 / 3;
          width: 42px;
          height: 42px;
          padding: 10px;
          border-radius: 12px;
          color: #6750c9;
          background: rgba(154, 123, 255, 0.12);
        }

        .pcy-teaching-principles strong {
          color: #21242a;
          font-size: 12px;
        }

        .pcy-teaching-principles span {
          margin-top: 3px;
          color: #747983;
          font-size: 10px;
          line-height: 1.45;
        }

        .pcy-support-photo {
          min-height: 590px;
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          box-shadow: 0 38px 90px rgba(16, 31, 28, 0.2);
        }

        .pcy-support-photo > img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pcy-support-photo-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(0deg, rgba(4, 6, 10, 0.82), transparent 62%);
        }

        .pcy-support-quote {
          position: absolute;
          left: 25px;
          right: 25px;
          bottom: 23px;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 17px;
          color: white;
          background: rgba(7, 10, 16, 0.67);
          backdrop-filter: blur(16px);
        }

        .pcy-support-quote > svg { color: var(--pcy-teal); }

        .pcy-support-quote span {
          display: block;
          margin: 8px 0 6px;
          color: var(--pcy-teal);
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .pcy-support-quote strong {
          display: block;
          max-width: 450px;
          font-size: 20px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        @keyframes pcy-walk-travel {
          0% { left: 0%; }
          50% { left: calc(100% - 10px); }
          100% { left: 0%; }
        }

        button:focus-visible,
        a:focus-visible {
          outline: 2px solid var(--pcy-teal);
          outline-offset: 3px;
        }

        @media (max-width: 1040px) {
          .pcy-nav nav {
            display: none;
          }

          .pcy-hero-grid {
            grid-template-columns: 1fr 420px;
            gap: 30px;
          }

          .pcy-hero h1 {
            font-size: clamp(3.8rem, 7.5vw, 5.6rem);
          }

          .pcy-float-card--gain {
            left: -20px;
          }

          .pcy-float-card--next {
            right: -20px;
          }

          .pcy-checkin-grid,
          .pcy-home-team-grid {
            gap: 44px;
          }

          .pcy-checkin-grid {
            grid-template-columns: 0.76fr 1.24fr;
          }

          .pcy-pillar-stage-inner {
            gap: 36px;
            padding: 42px;
          }

          .pcy-journey-detail-inner {
            grid-template-columns: 80px 1fr 260px;
            gap: 26px;
            padding: 36px;
          }

          .pcy-human-hero-grid {
            grid-template-columns: minmax(0, 1fr) 350px;
            gap: 34px;
          }

          .pcy-human-hero h1 {
            font-size: clamp(3.85rem, 7vw, 5.9rem);
          }

          .pcy-skills-library-layout {
            grid-template-columns: minmax(290px, 0.82fr) minmax(390px, 1.18fr);
          }

          .pcy-experience-step {
            min-height: 240px;
            padding: 18px;
          }

          .pcy-walkthrough-card {
            width: 44%;
          }

          .pcy-teaching-layout {
            grid-template-columns: minmax(280px, 0.68fr) minmax(490px, 1.32fr);
            gap: 30px;
          }
        }

        @media (max-width: 820px) {
          .pcy-shell {
            width: min(100% - 30px, 680px);
          }

          .pcy-nav-inner {
            height: 64px;
          }

          .pcy-nav-cta {
            padding: 9px 12px;
          }

          .pcy-nav-cta svg {
            display: none;
          }

          .pcy-hero {
            padding-top: 116px;
          }

          .pcy-hero-grid {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .pcy-hero-copy {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .pcy-hero h1 {
            font-size: clamp(3.8rem, 15vw, 6rem);
          }

          .pcy-hero-copy > p {
            max-width: 570px;
          }

          .pcy-hero-visual {
            min-height: 650px;
          }

          .pcy-skills-library-section {
            padding: 110px 0 120px;
          }

          .pcy-skills-library-layout {
            grid-template-columns: 1fr;
          }

          .pcy-skills-category-grid {
            grid-template-columns: repeat(4, 1fr);
          }

          .pcy-skills-category-grid button {
            min-height: 104px;
            grid-template-columns: 1fr auto;
            grid-template-rows: auto auto;
          }

          .pcy-skills-category-grid button > span {
            grid-column: 1;
          }

          .pcy-skills-category-grid button > strong {
            grid-column: 1 / 3;
          }

          .pcy-skills-category-grid button > svg {
            grid-column: 2;
            grid-row: 1;
          }

          .pcy-float-card--gain {
            left: 6%;
          }

          .pcy-float-card--next {
            right: 5%;
          }

          .pcy-hero-proof {
            display: none;
          }

          .pcy-statement {
            padding: 110px 0;
          }

          .pcy-section {
            padding: 100px 0;
          }

          .pcy-checkin-grid,
          .pcy-home-team-grid {
            grid-template-columns: 1fr;
          }

          .pcy-checkin-grid .pcy-section-copy,
          .pcy-home-team-grid .pcy-section-copy {
            max-width: 620px;
          }

          .pcy-pillar-picker {
            grid-template-columns: 1fr;
          }

          .pcy-pillar-picker button {
            min-height: 72px;
          }

          .pcy-pillar-stage-inner {
            grid-template-columns: 1fr;
            padding: 38px;
          }

          .pcy-pillar-stage,
          .pcy-pillar-stage-inner {
            min-height: auto;
          }

          .pcy-practice-lab {
            max-width: none;
            justify-self: stretch;
          }

          .pcy-outcome-heading {
            display: block;
          }

          .pcy-outcome-heading h2 {
            margin-top: 18px;
            text-align: left;
          }

          .pcy-outcome-grid {
            grid-template-columns: 1fr;
          }

          .pcy-outcome-card {
            min-height: 260px;
          }

          .pcy-outcome-card h3 {
            margin-top: 58px;
          }

          .pcy-journey-detail-inner {
            grid-template-columns: 70px 1fr;
          }

          .pcy-journey-gain {
            grid-column: 1 / -1;
          }

          .pcy-home-team-grid > div:first-child {
            order: 2;
          }

          .pcy-trust-grid {
            grid-template-columns: 1fr;
          }

          .pcy-footer .pcy-shell {
            grid-template-columns: 1fr;
            justify-items: center;
          }

          .pcy-human-hero {
            min-height: 1320px;
          }

          .pcy-human-hero-grid {
            min-height: 1160px;
            grid-template-columns: 1fr;
            align-content: center;
            gap: 54px;
            text-align: left;
          }

          .pcy-human-hero .pcy-hero-copy {
            align-items: flex-start;
            max-width: 650px;
            text-align: left;
          }

          .pcy-human-hero-image {
            object-position: 64% center;
          }

          .pcy-human-hero-overlay {
            background:
              linear-gradient(90deg, rgba(4, 6, 10, 0.96), rgba(4, 6, 10, 0.32)),
              linear-gradient(0deg, rgba(4, 6, 10, 0.9), transparent 52%);
          }

          .pcy-breathe-phone {
            align-self: auto;
            justify-self: start;
            margin: 0;
          }

          .pcy-human-hero-caption {
            right: 24px;
          }

          .pcy-experience-heading {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .pcy-experience-heading > span {
            grid-row: auto;
            padding-top: 0;
          }

          .pcy-experience-steps {
            grid-template-columns: repeat(2, 1fr);
          }

          .pcy-walkthrough-stage {
            min-height: 800px;
          }

          .pcy-walkthrough-shade {
            background:
              linear-gradient(0deg, rgba(4, 6, 10, 0.96), rgba(4, 6, 10, 0.12) 70%),
              linear-gradient(90deg, transparent, rgba(4, 6, 10, 0.3));
          }

          .pcy-walkthrough-nav button {
            grid-template-columns: 28px 1fr;
            padding: 7px;
          }

          .pcy-walkthrough-card {
            top: auto;
            right: 20px;
            bottom: 20px;
            width: 56%;
          }

          .pcy-walkthrough-moment {
            top: 118px;
            bottom: auto;
          }

          .pcy-support-photo {
            order: 2;
          }

          .pcy-checkin-demo-stage {
            grid-template-columns: 1fr;
            gap: 42px;
          }

          .pcy-checkin-device {
            width: min(100%, 700px);
            margin-inline: auto;
          }

          .pcy-checkin-demo-notes {
            max-width: 620px;
          }

          .pcy-teaching-layout {
            grid-template-columns: 1fr;
            gap: 28px;
          }

          .pcy-teaching-explainer {
            padding-bottom: 0;
          }

          .pcy-teaching-copy {
            min-height: 390px;
            padding-bottom: 0;
          }

          .pcy-teaching-copy h3,
          .pcy-teaching-copy > p {
            max-width: 620px;
          }

          .pcy-teaching-demo {
            min-height: 860px;
          }
        }

        @media (max-width: 560px) {
          .pcy-shell {
            width: min(100% - 24px, 480px);
          }

          .pcy-brand > span {
            display: none;
          }

          .pcy-nav-cta {
            font-size: 10px;
          }

          .pcy-hero {
            min-height: auto;
            padding-top: 105px;
          }

          .pcy-hero h1 {
            font-size: clamp(3.55rem, 17vw, 5rem);
          }

          .pcy-hero-copy > p {
            font-size: 15px;
          }

          .pcy-hero-actions {
            justify-content: center;
          }

          .pcy-primary-button {
            min-height: 49px;
            padding: 0 18px;
          }

          .pcy-hero-visual {
            min-height: 600px;
            transform: scale(0.9);
            margin: -20px -30px -40px;
          }

          .pcy-phone {
            width: 300px;
          }

          .pcy-float-card {
            min-width: 165px;
          }

          .pcy-float-card--gain {
            left: 0;
            top: 27%;
          }

          .pcy-float-card--next {
            right: 0;
            bottom: 15%;
          }

          .pcy-statement {
            padding: 86px 0;
          }

          .pcy-section,
          .pcy-outcome-section,
          .pcy-journey-section {
            padding: 84px 0;
          }

          .pcy-section-copy h2,
          .pcy-centered-heading h2,
          .pcy-outcome-heading h2,
          .pcy-final-content h2 {
            font-size: clamp(2.35rem, 11vw, 3.4rem);
          }

          .pcy-live-card {
            min-height: 0;
            padding: 20px;
            border-radius: 22px;
          }

          .pcy-live-card-top {
            display: block;
          }

          .pcy-private-chip {
            margin-top: 13px;
          }

          .pcy-checkin-options {
            grid-template-columns: repeat(5, minmax(58px, 1fr));
            gap: 6px;
            overflow-x: auto;
            padding-bottom: 4px;
          }

          .pcy-checkin-options button {
            min-height: 82px;
          }

          .pcy-pillar-stage-inner {
            padding: 25px 19px;
          }

          .pcy-pillar-story > h3 {
            font-size: 2.75rem;
          }

          .pcy-practice-lab {
            padding: 17px;
          }

          .pcy-practice-visual {
            padding-inline: 10px;
          }

          .pcy-journey-map {
            gap: 8px;
            margin-top: 54px;
          }

          .pcy-journey-map button strong {
            font-size: 11px;
          }

          .pcy-journey-map button small {
            font-size: 6px;
          }

          .pcy-journey-rail {
            left: calc(16.666% + 22px);
            right: calc(16.666% + 22px);
          }

          .pcy-journey-detail-inner {
            display: block;
            padding: 25px;
          }

          .pcy-journey-number {
            margin-bottom: 20px;
            font-size: 45px;
          }

          .pcy-journey-gain {
            margin-top: 24px;
          }

          .pcy-home-team-orbit {
            max-width: 355px;
          }

          .pcy-support-node {
            min-width: auto;
          }

          .pcy-final-section {
            min-height: 650px;
          }

          .pcy-final-orbit {
            width: 560px;
            height: 560px;
          }

          .pcy-footer .pcy-shell > div {
            flex-wrap: wrap;
            justify-content: center;
          }

          .pcy-human-hero {
            min-height: 1310px;
            padding: 98px 0 40px;
          }

          .pcy-human-hero-grid {
            min-height: 1170px;
            align-content: space-between;
            gap: 38px;
          }

          .pcy-human-hero-image {
            object-position: 66% center;
          }

          .pcy-human-hero-overlay {
            background:
              linear-gradient(180deg, rgba(4, 6, 10, 0.95) 0%, rgba(4, 6, 10, 0.72) 43%, rgba(4, 6, 10, 0.36) 66%, rgba(4, 6, 10, 0.94) 100%);
          }

          .pcy-human-hero h1 {
            font-size: clamp(3.3rem, 14.7vw, 4.9rem);
            line-height: 0.91;
          }

          .pcy-human-hero .pcy-hero-copy > p {
            font-size: 0.98rem;
            line-height: 1.58;
          }

          .pcy-human-hero .pcy-hero-actions {
            justify-content: flex-start;
            margin-top: 24px;
          }

          .pcy-breathe-phone {
            width: min(100%, 342px);
          }

          .pcy-phone-shell {
            height: 654px;
            min-height: 654px;
            border-radius: 48px;
          }

          .pcy-breathe-screen {
            padding-inline: 21px;
          }

          .pcy-human-hero-caption {
            display: none;
          }

          .pcy-experience-rail,
          .pcy-walkthrough {
            padding: 88px 0;
          }

          .pcy-experience-heading h2,
          .pcy-walkthrough-heading h2 {
            font-size: clamp(2.6rem, 12.7vw, 3.9rem);
          }

          .pcy-experience-steps {
            grid-template-columns: 1fr;
          }

          .pcy-experience-step {
            min-height: 220px;
          }

          .pcy-experience-step h3 {
            margin-top: 45px;
          }

          .pcy-motion-marquee > div {
            min-height: 58px;
          }

          .pcy-skills-library-section {
            padding: 86px 0 94px;
          }

          .pcy-skills-library-heading h2 {
            font-size: clamp(3.15rem, 15vw, 4.5rem);
          }

          .pcy-skills-library-heading > p {
            font-size: 14px;
          }

          .pcy-skills-library-layout {
            margin-top: 45px;
          }

          .pcy-skills-category-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .pcy-skills-category-detail {
            min-height: 0;
          }

          .pcy-skills-category-detail > div {
            grid-template-columns: 1fr;
            gap: 30px;
            padding: 28px 22px;
            border-radius: 24px;
          }

          .pcy-skills-motion-stage {
            min-height: 390px;
          }

          .pcy-walkthrough-stage {
            min-height: 970px;
            border-radius: 25px;
          }

          .pcy-walkthrough-stage > img {
            height: 46%;
            object-position: 35% center;
          }

          .pcy-walkthrough-shade {
            background: linear-gradient(0deg, #08090d 48%, transparent 67%, rgba(4, 6, 10, 0.18));
          }

          .pcy-walkthrough-nav {
            left: 10px;
            right: 10px;
            top: 10px;
            display: flex;
            overflow-x: auto;
            padding: 6px;
          }

          .pcy-walkthrough-nav button {
            min-width: 104px;
            flex: 0 0 auto;
          }

          .pcy-walkthrough-moment {
            left: 18px;
            right: 18px;
            top: 42%;
          }

          .pcy-walkthrough-moment strong {
            font-size: 1.9rem;
          }

          .pcy-walkthrough-card {
            left: 12px;
            right: 12px;
            bottom: 14px;
            width: auto;
            padding: 19px;
          }

          .pcy-support-photo {
            min-height: 430px;
            border-radius: 24px;
          }

          .pcy-support-photo > img {
            object-position: 50% center;
          }

          .pcy-checkin-demo-section {
            padding: 88px 0;
          }

          .pcy-teaching-section {
            padding: 92px 0;
          }

          .pcy-teaching-section::before {
            top: 18px;
            font-size: 12rem;
          }

          .pcy-teaching-heading {
            margin-bottom: 42px;
          }

          .pcy-teaching-heading h2 {
            font-size: clamp(3.2rem, 15.3vw, 5rem);
          }

          .pcy-teaching-heading > p {
            font-size: 14px;
          }

          .pcy-teaching-stage-picker {
            gap: 5px;
          }

          .pcy-teaching-stage-picker button {
            min-height: 62px;
            padding: 9px;
          }

          .pcy-teaching-copy {
            min-height: 410px;
            padding-top: 32px;
          }

          .pcy-teaching-copy h3 {
            font-size: 3.2rem;
          }

          .pcy-teaching-demo {
            min-height: 810px;
            padding: 18px;
            border-radius: 25px;
          }

          .pcy-teaching-demo-header small {
            display: none;
          }

          .pcy-teaching-demo-progress {
            margin-top: 22px;
          }

          .pcy-mental-rehearsal-visual {
            height: 350px;
          }

          .pcy-rehearsal-scene-details {
            top: 12px;
            left: 12px;
            flex-wrap: wrap;
            max-width: 245px;
          }

          .pcy-imagination-rings {
            top: 22%;
            right: 4%;
            width: 110px;
            height: 110px;
          }

          .pcy-imagination-rings span:nth-child(2) {
            inset: 17px;
          }

          .pcy-imagination-rings span:nth-child(3) {
            inset: 34px;
          }

          .pcy-vision-statement {
            left: 17px;
            bottom: 17px;
            width: 78%;
          }

          .pcy-vision-statement strong {
            font-size: 1.55rem;
          }

          .pcy-brain-plan {
            right: 10px;
            bottom: 13px;
            gap: 4px;
          }

          .pcy-brain-plan span {
            width: 54px;
            height: 54px;
            font-size: 5px;
          }

          .pcy-brain-plan span::after {
            width: 4px;
            margin-left: 58px;
          }

          .pcy-mental-rehearsal-visual--understand .pcy-vision-statement {
            top: 72px;
            bottom: auto;
            width: 80%;
          }

          .pcy-practice-beats {
            right: 10px;
            bottom: 10px;
            left: 10px;
            gap: 5px;
          }

          .pcy-practice-beats span {
            min-height: 82px;
          }

          .pcy-mental-rehearsal-visual--practice .pcy-vision-statement {
            top: 70px;
            width: 84%;
          }

          .pcy-teaching-caption {
            min-height: 76px;
          }

          .pcy-teaching-principles {
            grid-template-columns: 1fr;
          }

          .pcy-checkin-demo-heading {
            margin-bottom: 42px;
            text-align: left;
          }

          .pcy-checkin-demo-heading .pcy-kicker {
            justify-content: flex-start;
          }

          .pcy-checkin-device {
            padding: 8px 8px 15px;
            border-radius: 27px;
          }

          .pcy-live-card--actual {
            min-height: 420px;
            padding: 17px;
            border-radius: 20px;
          }

          .pcy-live-card--actual .pcy-live-card-top {
            display: block;
          }

          .pcy-live-card--actual .pcy-private-chip {
            margin-top: 13px;
          }

          .pcy-live-card--actual .pcy-checkin-options {
            grid-template-columns: repeat(5, minmax(64px, 1fr));
            gap: 6px;
            overflow-x: auto;
            padding-bottom: 5px;
          }

          .pcy-live-card--actual .pcy-checkin-options button {
            min-height: 92px;
          }

          .pcy-checkin-saved {
            grid-template-columns: 1fr auto;
          }

          .pcy-checkin-saved > button {
            grid-column: 2;
            grid-row: 1;
          }

          .pcy-checkin-saved > div:nth-child(2) {
            grid-column: 1 / -1;
          }

          .pcy-actual-reply-choices {
            grid-template-columns: 1fr;
          }

          .pcy-actual-reply-result {
            grid-template-columns: 1fr;
          }

          .pcy-checkin-device-bar i {
            width: 72px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }

          .pcy-page *,
          .pcy-page *::before,
          .pcy-page *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
};

export default PulseCheckYouthPage;

export const getStaticProps: GetStaticProps = async () => ({
  props: {
    ogMeta: {
      title: pageMeta.ogTitle,
      description: pageMeta.ogDescription,
      image: 'https://fitwithpulse.ai/pulsecheck-youth-og.png',
      url: 'https://fitwithpulse.ai/PulseCheck/youth',
      type: 'website',
      siteName: 'PulseCheck Youth',
    },
  },
});
