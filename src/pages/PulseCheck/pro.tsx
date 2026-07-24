import React, { useState } from 'react';
import Link from 'next/link';
import type { GetStaticProps } from 'next';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BarChart3,
  Brain,
  CalendarDays,
  Check,
  Gauge,
  Layers3,
  MessageCircle,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Waves,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import PageHead from '../../components/PageHead';

type ReadinessSignal = {
  id: 'restore' | 'steady' | 'primed';
  label: string;
  score: number;
  color: string;
  glow: string;
  headline: string;
  message: string;
  focus: string;
  protocol: string;
  simulation: string;
  duration: string;
};

type SlateMode = 'protocols' | 'simulations';

type Pathway = {
  name: string;
  short: string;
  eyebrow: string;
  description: string;
  gain: string;
  unlock: string;
  color: string;
};

const READINESS_SIGNALS: ReadinessSignal[] = [
  {
    id: 'restore',
    label: 'Restore',
    score: 54,
    color: '#FFB84D',
    glow: 'rgba(255, 184, 77, 0.22)',
    headline: 'Build control before intensity.',
    message:
      'Sleep and energy are below your normal range. Today starts with a body reset, then tests calm decisions under light pressure.',
    focus: 'Energy control',
    protocol: 'Downshift breathing',
    simulation: 'Reset after contact',
    duration: '8 min',
  },
  {
    id: 'steady',
    label: 'Steady',
    score: 76,
    color: '#46E7F2',
    glow: 'rgba(70, 231, 242, 0.22)',
    headline: 'Turn steady energy into sharp attention.',
    message:
      'Your baseline is holding. Today tightens the cue you use to find focus and asks you to recover it when the environment gets loud.',
    focus: 'Focus recovery',
    protocol: 'Signal lock',
    simulation: 'Noise under pressure',
    duration: '11 min',
  },
  {
    id: 'primed',
    label: 'Primed',
    score: 91,
    color: '#A68BFF',
    glow: 'rgba(166, 139, 255, 0.24)',
    headline: 'Use today’s capacity for a harder rep.',
    message:
      'Your energy, recent work, and check-in point toward a challenge day. Today tests execution when time and pressure close in.',
    focus: 'Pressure performance',
    protocol: 'Competition cue stack',
    simulation: 'Final possession',
    duration: '14 min',
  },
];

const SLATES: Record<
  SlateMode,
  Array<{ number: string; title: string; type: string; time: string; detail: string; color: string }>
> = {
  protocols: [
    {
      number: '01',
      title: 'Signal lock',
      type: 'Focus protocol',
      time: '3 min',
      detail: 'Choose one useful cue and bring your attention back to it.',
      color: '#46E7F2',
    },
    {
      number: '02',
      title: 'Pressure breath',
      type: 'Control protocol',
      time: '2 min',
      detail: 'Slow the rush without losing competitive energy.',
      color: '#FFB84D',
    },
    {
      number: '03',
      title: 'Evidence stack',
      type: 'Confidence protocol',
      time: '3 min',
      detail: 'Build confidence from proof you have already earned.',
      color: '#A68BFF',
    },
  ],
  simulations: [
    {
      number: '04',
      title: 'Noise under pressure',
      type: 'Focus simulation',
      time: '60 sec',
      detail: 'Track the right signal while distractions fight for attention.',
      color: '#46E7F2',
    },
    {
      number: '05',
      title: 'Next-play window',
      type: 'Recovery simulation',
      time: '75 sec',
      detail: 'Recover from a mistake before the next decision arrives.',
      color: '#A68BFF',
    },
    {
      number: '06',
      title: 'Clock-down choice',
      type: 'Pressure simulation',
      time: '90 sec',
      detail: 'Make the right call while time and stakes rise together.',
      color: '#FF6B8A',
    },
  ],
};

const BLOCK_MOMENTS = [
  {
    day: '01',
    label: 'Set the focus',
    title: 'The block starts with one clear target.',
    body: 'Your baseline, goals, recent work, and current challenge shape the first two weeks.',
    metric: 'Focus recovery',
    value: 'Primary target',
    color: '#46E7F2',
  },
  {
    day: '05',
    label: 'Build the rep',
    title: 'Practice returns with more pressure.',
    body: 'The same mental skill shows up in new situations, so the athlete learns how to use it beyond one exercise.',
    metric: '4 of 6',
    value: 'Sessions trained',
    color: '#A68BFF',
  },
  {
    day: '10',
    label: 'Read the pattern',
    title: 'Results reveal what is holding.',
    body: 'Check-ins, completion, and simulation choices show where the skill is becoming reliable and where another rep can help.',
    metric: '82%',
    value: 'Block adherence',
    color: '#FFB84D',
  },
  {
    day: '14',
    label: 'Earn the decision',
    title: 'The next move follows the work.',
    body: 'Strong follow-through advances the pathway. A lighter block continues long enough to build honest evidence.',
    metric: 'Advance',
    value: 'Next decision',
    color: '#7DF2B8',
  },
];

const PATHWAYS: Pathway[] = [
  {
    name: 'Foundation',
    short: 'Foundation',
    eyebrow: 'Level 01',
    description: 'Build a working base across confidence, focus, and emotional control.',
    gain: 'A complete mental-performance toolkit',
    unlock: 'State Control',
    color: '#46E7F2',
  },
  {
    name: 'State Control',
    short: 'Control',
    eyebrow: 'Level 02',
    description: 'Learn how to bring energy down, bring it up, and meet the moment on purpose.',
    gain: 'Energy that matches the demand',
    unlock: 'Focus Mastery',
    color: '#65F0C2',
  },
  {
    name: 'Focus Mastery',
    short: 'Focus',
    eyebrow: 'Level 03',
    description: 'Hold attention through noise and recover it quickly when it slips.',
    gain: 'A reliable way back to the signal',
    unlock: 'Confidence & Resilience',
    color: '#8EA6FF',
  },
  {
    name: 'Confidence & Resilience',
    short: 'Confidence',
    eyebrow: 'Level 04',
    description: 'Build confidence from evidence and create a faster response after setbacks.',
    gain: 'Belief that survives hard moments',
    unlock: 'Pressure Performance',
    color: '#A68BFF',
  },
  {
    name: 'Pressure Performance',
    short: 'Pressure',
    eyebrow: 'Level 05',
    description: 'Choose, commit, and execute when the moment becomes fast, loud, and important.',
    gain: 'Clear decisions when the stakes rise',
    unlock: 'Elite Refinement',
    color: '#FF8AA5',
  },
  {
    name: 'Elite Refinement',
    short: 'Refinement',
    eyebrow: 'Level 06',
    description: 'Sharpen the smallest details that separate strong performance from repeatable excellence.',
    gain: 'Precision that keeps improving',
    unlock: 'The next performance edge',
    color: '#FFB84D',
  },
];

const pageMeta = {
  pageId: 'pulsecheck-pro',
  pageTitle: 'PulseCheck Pro: Your Mind Gets a Game Plan, Too',
  metaDescription:
    'See how PulseCheck Pro helps adult athletes check in, get a clear mental game plan, train under pressure, and unlock what comes next.',
  ogTitle: 'PulseCheck Pro: Your Mind Gets a Game Plan, Too',
  ogDescription: 'Check in. Train the skill. Test it under pressure. Unlock what comes next.',
  ogImage: '/pulsecheck-pro-og.png',
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
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function BrandMark() {
  return (
    <Link href="/PulseCheck/pro" className="pcp-brand" aria-label="PulseCheck Pro home">
      <img src="/pulseCheckIcon.png" alt="" className="pcp-brand-icon" />
      <span>
        <strong>PulseCheck</strong>
        <small>Pro</small>
      </span>
    </Link>
  );
}

function SignalOrb({ color = '#46E7F2', compact = false }: { color?: string; compact?: boolean }) {
  return (
    <span
      className={`pcp-signal-orb ${compact ? 'pcp-signal-orb--compact' : ''}`}
      style={{ '--signal-color': color } as React.CSSProperties}
      aria-hidden="true"
    >
      <span />
    </span>
  );
}

function HeroConsole() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="pcp-hero-console" aria-label="PulseCheck Pro daily prescription preview">
      <motion.div
        className="pcp-console-orbit pcp-console-orbit--outer"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
      >
        <span />
      </motion.div>
      <motion.div
        className="pcp-console-orbit pcp-console-orbit--inner"
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      >
        <span />
      </motion.div>

      <motion.div
        className="pcp-console"
        initial={reduceMotion ? false : { opacity: 0, y: 28, rotateX: 7 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pcp-console-head">
          <div>
            <small>THURSDAY · COMPETITION WEEK</small>
            <h3>Today’s prescription</h3>
          </div>
          <span className="pcp-live-chip"><i /> LIVE</span>
        </div>

        <div className="pcp-readiness-card">
          <div className="pcp-score-ring">
            <span>76</span>
            <small>READY</small>
          </div>
          <div>
            <small>TODAY’S SIGNAL</small>
            <strong>Steady capacity</strong>
            <p>Your baseline is holding. Today tightens focus recovery under noise.</p>
          </div>
        </div>

        <div className="pcp-block-progress">
          <div>
            <span>ACTIVE BLOCK</span>
            <strong>Focus Mastery</strong>
          </div>
          <div>
            <span>DAY 10 OF 14</span>
            <strong>82% trained</strong>
          </div>
          <div className="pcp-block-bar"><span /></div>
        </div>

        <div className="pcp-console-label">
          <span>YOUR NEXT REPS</span>
          <small>3 protocols · 3 simulations</small>
        </div>
        <div className="pcp-console-reps">
          {[
            { icon: Target, label: 'PROTOCOL', title: 'Signal lock', time: '3 min', color: '#46E7F2' },
            { icon: Waves, label: 'PROTOCOL', title: 'Pressure breath', time: '2 min', color: '#FFB84D' },
            { icon: Zap, label: 'SIMULATION', title: 'Noise under pressure', time: '60 sec', color: '#A68BFF' },
          ].map((rep, index) => {
            const Icon = rep.icon;
            return (
              <motion.div
                key={rep.title}
                className="pcp-console-rep"
                style={{ '--rep-color': rep.color } as React.CSSProperties}
                animate={reduceMotion ? undefined : { x: [0, index === 1 ? 3 : 1, 0] }}
                transition={{ duration: 4 + index, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span><Icon size={16} /></span>
                <div>
                  <small>{rep.label}</small>
                  <strong>{rep.title}</strong>
                </div>
                <em>{rep.time}</em>
                <Play size={13} fill="currentColor" />
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        className="pcp-float-card pcp-float-card--signal"
        initial={reduceMotion ? false : { opacity: 0, x: -22 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: 0, y: [0, -7, 0] }}
        transition={{
          opacity: { duration: 0.7, delay: 0.75 },
          x: { duration: 0.7, delay: 0.75 },
          y: { duration: 4.4, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <span><Activity size={15} /></span>
        <div><small>SIGNAL READ</small><strong>Ready for pressure</strong></div>
      </motion.div>

      <motion.div
        className="pcp-float-card pcp-float-card--unlock"
        initial={reduceMotion ? false : { opacity: 0, x: 22 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: 0, y: [0, 7, 0] }}
        transition={{
          opacity: { duration: 0.7, delay: 0.95 },
          x: { duration: 0.7, delay: 0.95 },
          y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <span><TrendingUp size={15} /></span>
        <div><small>ON TRACK</small><strong>Next level in view</strong></div>
      </motion.div>
    </div>
  );
}

function SignalSection() {
  const [selectedId, setSelectedId] = useState<ReadinessSignal['id']>('steady');
  const selected = READINESS_SIGNALS.find((signal) => signal.id === selectedId) ?? READINESS_SIGNALS[1];

  return (
    <section className="pcp-section pcp-signal-section" id="signal">
      <div className="pcp-shell pcp-signal-grid">
        <Reveal className="pcp-section-copy">
          <span className="pcp-kicker"><Activity size={14} /> Start with today</span>
          <h2>Your day becomes a training decision.</h2>
          <p>
            PulseCheck reads the athlete’s check-in beside recent practice, performance goals, and
            personal patterns. The result is a useful next rep for the day in front of them.
          </p>
          <div className="pcp-copy-points">
            <div><span>01</span><p><strong>Read the moment</strong>Energy, confidence, focus, and pressure become useful context.</p></div>
            <div><span>02</span><p><strong>Choose the right demand</strong>The work can restore, sharpen, or stretch the athlete.</p></div>
            <div><span>03</span><p><strong>Explain the reason</strong>Nora tells the athlete why today’s rep belongs here.</p></div>
          </div>
        </Reveal>

        <Reveal className="pcp-signal-lab" delay={0.12}>
          <div
            className="pcp-signal-lab-glow"
            style={{ background: `radial-gradient(circle, ${selected.glow}, transparent 68%)` }}
          />
          <div className="pcp-signal-lab-head">
            <div>
              <small>READINESS LAB</small>
              <h3>Change today’s signal</h3>
            </div>
            <span><Gauge size={15} /> Athlete-relative</span>
          </div>

          <div className="pcp-signal-options" role="group" aria-label="Choose an example readiness signal">
            {READINESS_SIGNALS.map((signal) => {
              const active = signal.id === selected.id;
              return (
                <button
                  type="button"
                  key={signal.id}
                  className={active ? 'active' : ''}
                  style={
                    {
                      '--option-color': signal.color,
                      '--option-glow': signal.glow,
                    } as React.CSSProperties
                  }
                  aria-pressed={active}
                  onClick={() => setSelectedId(signal.id)}
                >
                  <span>{signal.score}</span>
                  <small>{signal.label}</small>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              className="pcp-signal-result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              style={{ '--result-color': selected.color } as React.CSSProperties}
            >
              <div className="pcp-nora-line">
                <SignalOrb color={selected.color} compact />
                <div><small>NORA’S READ</small><strong>{selected.headline}</strong></div>
              </div>
              <p>{selected.message}</p>
              <div className="pcp-result-grid">
                <div><small>BLOCK FOCUS</small><strong>{selected.focus}</strong></div>
                <div><small>PROTOCOL</small><strong>{selected.protocol}</strong></div>
                <div><small>SIMULATION</small><strong>{selected.simulation}</strong></div>
                <div><small>TOTAL WORK</small><strong>{selected.duration}</strong></div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}

function SlateSection() {
  const [mode, setMode] = useState<SlateMode>('protocols');
  const current = SLATES[mode];

  return (
    <section className="pcp-section pcp-slate-section" id="prescription">
      <div className="pcp-shell">
        <Reveal className="pcp-centered-heading">
          <span className="pcp-kicker"><Layers3 size={14} /> The daily prescription</span>
          <h2>Learn the move. Then prove it under pressure.</h2>
          <p>
            Each slate pairs guided protocols with scored simulations. Athletes understand the skill,
            rehearse it, and test it while the system learns what should come next.
          </p>
        </Reveal>

        <Reveal className="pcp-slate-stage" delay={0.1}>
          <div className="pcp-slate-nav" role="tablist" aria-label="Daily prescription type">
            <button
              type="button"
              className={mode === 'protocols' ? 'active' : ''}
              aria-pressed={mode === 'protocols'}
              onClick={() => setMode('protocols')}
            >
              <Brain size={17} />
              <span><small>LEARN + REHEARSE</small><strong>3 protocols</strong></span>
            </button>
            <button
              type="button"
              className={mode === 'simulations' ? 'active' : ''}
              aria-pressed={mode === 'simulations'}
              onClick={() => setMode('simulations')}
            >
              <Target size={17} />
              <span><small>TEST + SCORE</small><strong>3 simulations</strong></span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              className="pcp-slate-content"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32 }}
            >
              <div className="pcp-slate-intro">
                <span>{mode === 'protocols' ? 'UNDERSTAND THE SKILL' : 'USE IT WHEN THE MOMENT MOVES'}</span>
                <h3>
                  {mode === 'protocols'
                    ? 'Three short practices prepare the mental move.'
                    : 'Three scored moments show what holds under pressure.'}
                </h3>
              </div>
              <div className="pcp-rep-grid">
                {current.map((rep, index) => (
                  <motion.article
                    key={rep.title}
                    className="pcp-rep-card"
                    style={{ '--rep-color': rep.color } as React.CSSProperties}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                  >
                    <div className="pcp-rep-card-top">
                      <span>{rep.number}</span>
                      <small>{rep.time}</small>
                    </div>
                    <i />
                    <small>{rep.type}</small>
                    <h4>{rep.title}</h4>
                    <p>{rep.detail}</p>
                    <button type="button" aria-label={`Preview ${rep.title}`}>
                      Preview the rep <Play size={13} fill="currentColor" />
                    </button>
                  </motion.article>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="pcp-slate-reason">
            <SignalOrb compact />
            <p>
              <strong>Why this slate:</strong> Focus recovery is the clearest opportunity in your
              current block. Today adds noise while your readiness is steady.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function AdaptiveBlockSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = BLOCK_MOMENTS[activeIndex];

  return (
    <section className="pcp-section pcp-block-section" id="adaptation">
      <div className="pcp-block-halo" aria-hidden="true" />
      <div className="pcp-shell">
        <Reveal className="pcp-block-heading">
          <span className="pcp-kicker"><RotateCcw size={14} /> A system that keeps learning</span>
          <h2>Two weeks of work create a better next decision.</h2>
          <p>
            The block gives the athlete enough repetition to build a skill and enough variation to
            reveal whether it holds. Follow-through, choices, and scores shape the next move.
          </p>
        </Reveal>

        <div className="pcp-block-layout">
          <Reveal className="pcp-block-rail" delay={0.08}>
            <div className="pcp-block-line"><motion.span animate={{ width: `${activeIndex * 33.333}%` }} /></div>
            {BLOCK_MOMENTS.map((moment, index) => (
              <button
                type="button"
                key={moment.day}
                className={`${index === activeIndex ? 'active' : ''} ${index <= activeIndex ? 'reached' : ''}`}
                style={{ '--moment-color': moment.color } as React.CSSProperties}
                onClick={() => setActiveIndex(index)}
                aria-pressed={index === activeIndex}
              >
                <span>{moment.day}</span>
                <small>DAY</small>
                <strong>{moment.label}</strong>
              </button>
            ))}
          </Reveal>

          <Reveal className="pcp-block-detail" delay={0.15}>
            <AnimatePresence mode="wait">
              <motion.div
                key={current.day}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.3 }}
                style={{ '--moment-color': current.color } as React.CSSProperties}
              >
                <div className="pcp-block-detail-head">
                  <span>DAY {current.day} · {current.label.toUpperCase()}</span>
                  <div><small>{current.value}</small><strong>{current.metric}</strong></div>
                </div>
                <h3>{current.title}</h3>
                <p>{current.body}</p>
                <div className="pcp-block-decision">
                  <TrendingUp size={18} />
                  <div>
                    <small>THE ENGINE’S JOB</small>
                    <strong>Match the next challenge to evidence the athlete has earned.</strong>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </Reveal>
        </div>

        <Reveal className="pcp-loop-strip" delay={0.12}>
          {[
            { icon: CalendarDays, label: 'Daily slate', detail: '3 protocols + 3 simulations' },
            { icon: Layers3, label: '14-day block', detail: 'One useful focus' },
            { icon: BarChart3, label: 'Adherence read', detail: '80% guides advancement' },
            { icon: RotateCcw, label: 'Monthly reassessment', detail: 'The next gap becomes the target' },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={item.label}>
                <div>
                  <span><Icon size={18} /></span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
                {index < 3 && <ArrowRight size={16} />}
              </React.Fragment>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}

function PathwaySection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const pathway = PATHWAYS[activeIndex];

  return (
    <section className="pcp-section pcp-pathway-section" id="pathway">
      <div className="pcp-shell">
        <Reveal className="pcp-centered-heading">
          <span className="pcp-kicker"><Trophy size={14} /> The long game</span>
          <h2>Every level reveals the next performance edge.</h2>
          <p>
            The athlete can see where the work is going. Each pathway adds a deeper demand while
            preserving the skills already earned.
          </p>
        </Reveal>

        <Reveal className="pcp-pathway-map" delay={0.08}>
          <div className="pcp-pathway-buttons" role="group" aria-label="Explore the Pro pathway">
            {PATHWAYS.map((item, index) => (
              <React.Fragment key={item.name}>
                <button
                  type="button"
                  className={`${index === activeIndex ? 'active' : ''} ${index <= activeIndex ? 'reached' : ''}`}
                  style={{ '--path-color': item.color } as React.CSSProperties}
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={index === activeIndex}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item.short}</strong>
                </button>
                {index < PATHWAYS.length - 1 && <i />}
              </React.Fragment>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={pathway.name}
              className="pcp-pathway-detail"
              style={{ '--path-color': pathway.color } as React.CSSProperties}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32 }}
            >
              <div className="pcp-pathway-index">0{activeIndex + 1}</div>
              <div className="pcp-pathway-copy">
                <span>{pathway.eyebrow}</span>
                <h3>{pathway.name}</h3>
                <p>{pathway.description}</p>
              </div>
              <div className="pcp-pathway-gain">
                <div>
                  <small>WHAT THE ATHLETE GAINS</small>
                  <strong>{pathway.gain}</strong>
                </div>
                <div>
                  <small>NEXT UNLOCK</small>
                  <strong>{pathway.unlock}</strong>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}

type DeepDiveKey = 'today' | 'training' | 'growth';

function ExperienceRail() {
  const steps = [
    {
      icon: Activity,
      number: '01',
      title: 'Check in',
      body: 'Tell PulseCheck how your mind and body are showing up today.',
      color: '#46E7F2',
    },
    {
      icon: Target,
      number: '02',
      title: 'Get the game plan',
      body: 'See one clear mental focus built for today’s demand.',
      color: '#7DF2B8',
    },
    {
      icon: Play,
      number: '03',
      title: 'Train + test',
      body: 'Practice the skill, then use it in a pressure simulation.',
      color: '#A68BFF',
    },
    {
      icon: Trophy,
      number: '04',
      title: 'Level up',
      body: 'Your work shapes the next challenge and opens the next level.',
      color: '#FFB84D',
    },
  ];

  return (
    <section className="pcp-experience-rail" id="experience">
      <div className="pcp-shell">
        <Reveal className="pcp-experience-heading">
          <span>THE WHOLE EXPERIENCE</span>
          <h2>Four beats. One clear path forward.</h2>
          <p>An athlete can understand the day in seconds and feel the progress every time they return.</p>
        </Reveal>
        <div className="pcp-experience-steps">
          <motion.div
            className="pcp-experience-line"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span />
          </motion.div>
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={index * 0.1}>
                <article
                  className="pcp-experience-step"
                  style={{ '--step-color': step.color } as React.CSSProperties}
                >
                  <div className="pcp-experience-step-top">
                    <span><Icon size={19} /></span>
                    <small>{step.number}</small>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AthleteDaySection() {
  const moments = [
    {
      label: 'BEFORE PRACTICE',
      title: 'How are you showing up?',
      detail: 'A fast check-in reads energy, focus, and pressure.',
      color: '#46E7F2',
    },
    {
      label: 'TODAY’S FOCUS',
      title: 'Recover your attention',
      detail: 'A short protocol gives the athlete a cue they can use now.',
      color: '#A68BFF',
    },
    {
      label: 'AFTER THE REP',
      title: 'The next challenge updates',
      detail: 'Practice and simulation results shape what comes next.',
      color: '#FFB84D',
    },
  ];

  return (
    <section className="pcp-athlete-story" id="athlete-day">
      <div className="pcp-shell">
        <Reveal className="pcp-athlete-story-heading">
          <span>ONE DAY WITH PULSECHECK</span>
          <h2>Meet the athlete where the moment is.</h2>
          <p>
            A hard rep. A noisy mind. A chance to reset. PulseCheck turns that moment into something
            the athlete can understand, practice, and carry back into performance.
          </p>
        </Reveal>

        <motion.div
          className="pcp-athlete-scene"
          initial={{ opacity: 0, y: 38 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.img
            src="/pulsecheck-pro/next-rep.webp"
            alt="Track athlete regaining her breath and focus between demanding repetitions"
            initial={{ scale: 1.08 }}
            whileInView={{ scale: 1.01 }}
            viewport={{ once: true }}
            transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="pcp-athlete-scene-shade" />
          <div className="pcp-athlete-scene-copy">
            <span>THE NEXT REP</span>
            <blockquote>“I know what I’m training. I know why it matters today.”</blockquote>
            <p>From a feeling the athlete can name to a skill the athlete can use.</p>
          </div>
          <div className="pcp-athlete-moments">
            {moments.map((moment, index) => (
              <motion.article
                key={moment.title}
                className="pcp-athlete-moment"
                style={{ '--moment-color': moment.color } as React.CSSProperties}
                initial={{ opacity: 0, x: 34 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.28 + index * 0.16, duration: 0.58 }}
              >
                <i>{index + 1}</i>
                <div>
                  <small>{moment.label}</small>
                  <strong>{moment.title}</strong>
                  <p>{moment.detail}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ValueAtGlance() {
  const values = [
    {
      label: 'FOR THE ATHLETE',
      title: 'A mental routine they can use',
      body: 'Clear language, short training, and proof that the skill is growing.',
      icon: Brain,
      color: '#46E7F2',
    },
    {
      label: 'FOR THE COACH',
      title: 'Better performance conversations',
      body: 'Useful patterns and shared language help the coach support the next step.',
      icon: MessageCircle,
      color: '#A68BFF',
    },
    {
      label: 'FOR THE PROGRAM',
      title: 'A pathway that keeps opening',
      body: 'Daily work connects to focused blocks, new levels, and long-term development.',
      icon: TrendingUp,
      color: '#FFB84D',
    },
  ];

  return (
    <section className="pcp-value-section" id="value">
      <div className="pcp-shell">
        <Reveal className="pcp-value-heading">
          <small>WHAT CHANGES</small>
          <h2>Everyone can see where the work is going.</h2>
        </Reveal>
        <div className="pcp-value-grid">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <Reveal key={value.label} delay={index * 0.1}>
                <article
                  className="pcp-value-card"
                  style={{ '--value-color': value.color } as React.CSSProperties}
                >
                  <div><Icon size={22} /></div>
                  <small>{value.label}</small>
                  <h3>{value.title}</h3>
                  <p>{value.body}</p>
                  <span><Check size={13} /> Easy to understand at a glance</span>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DeepDiveSection() {
  const [activeDive, setActiveDive] = useState<DeepDiveKey | null>(null);
  const options: Array<{
    id: DeepDiveKey;
    icon: typeof Activity;
    eyebrow: string;
    title: string;
    body: string;
    action: string;
    color: string;
  }> = [
    {
      id: 'today',
      icon: Activity,
      eyebrow: 'TODAY',
      title: 'How the game plan changes',
      body: 'See how a check-in turns into one useful focus for the day.',
      action: 'Try the check-in',
      color: '#46E7F2',
    },
    {
      id: 'training',
      icon: Play,
      eyebrow: 'THE WORK',
      title: 'What the athlete trains',
      body: 'Explore the short protocols and pressure simulations inside a session.',
      action: 'Open the workout',
      color: '#A68BFF',
    },
    {
      id: 'growth',
      icon: TrendingUp,
      eyebrow: 'THE JOURNEY',
      title: 'How the next level unlocks',
      body: 'Follow the 14-day rhythm and the pathway that keeps growing.',
      action: 'See the pathway',
      color: '#FFB84D',
    },
  ];

  return (
    <section className="pcp-deep-dive" id="explore">
      <div className="pcp-shell">
        <Reveal className="pcp-deep-heading">
          <span>WANT TO SEE HOW IT WORKS?</span>
          <h2>Start with the story. Dig into the system when you’re ready.</h2>
          <p>Each interactive view opens a different part of the PulseCheck Pro experience.</p>
        </Reveal>
        <div className="pcp-deep-options">
          {options.map((option, index) => {
            const Icon = option.icon;
            const isActive = activeDive === option.id;
            return (
              <Reveal key={option.id} delay={index * 0.08}>
                <button
                  type="button"
                  className={isActive ? 'active' : ''}
                  onClick={() => setActiveDive(isActive ? null : option.id)}
                  aria-expanded={isActive}
                  style={{ '--deep-color': option.color } as React.CSSProperties}
                >
                  <div><Icon size={20} /><small>{option.eyebrow}</small></div>
                  <h3>{option.title}</h3>
                  <p>{option.body}</p>
                  <span>{isActive ? 'Close view' : option.action}<ArrowRight size={15} /></span>
                </button>
              </Reveal>
            );
          })}
        </div>
      </div>
      <AnimatePresence mode="wait">
        {activeDive && (
          <motion.div
            key={activeDive}
            className="pcp-deep-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeDive === 'today' && (
              <>
                <div className="pcp-shell pcp-deep-console-preview"><HeroConsole /></div>
                <SignalSection />
              </>
            )}
            {activeDive === 'training' && <SlateSection />}
            {activeDive === 'growth' && (
              <>
                <AdaptiveBlockSection />
                <PathwaySection />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const PulseCheckProPage: React.FC = () => {
  return (
    <main className="pcp-page">
      <PageHead
        metaData={pageMeta}
        pageOgUrl="https://fitwithpulse.ai/PulseCheck/pro"
        pageOgImage="/pulsecheck-pro-og.png"
        themeColor="#05070C"
        appleItunesAppArgument="pulsecheck://pro"
      />

      <div className="pcp-texture" aria-hidden="true" />
      <div className="pcp-background-glow pcp-background-glow--one" aria-hidden="true" />
      <div className="pcp-background-glow pcp-background-glow--two" aria-hidden="true" />

      <header className="pcp-nav">
        <div className="pcp-shell pcp-nav-inner">
          <BrandMark />
          <nav aria-label="Page navigation">
            <a href="#experience">The experience</a>
            <a href="#athlete-day">A day with Pro</a>
            <a href="#value">What changes</a>
            <a href="#explore">Explore the system</a>
          </nav>
          <a
            href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Pro"
            className="pcp-nav-cta"
          >
            Bring Pro to your athletes <ArrowRight size={15} />
          </a>
        </div>
      </header>

      <section className="pcp-hero pcp-human-hero">
        <motion.img
          className="pcp-human-hero-image"
          src="/pulsecheck-pro/hero-athletes.webp"
          alt="Two elite athletes centering themselves before competition"
          initial={{ scale: 1.09, opacity: 0 }}
          animate={{ scale: 1.01, opacity: 1 }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="pcp-human-hero-overlay" />
        <div className="pcp-human-hero-flare" aria-hidden="true" />
        <div className="pcp-shell pcp-human-hero-grid">
          <div className="pcp-hero-copy">
            <motion.div
              className="pcp-eyebrow"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <span /> Adaptive mental-performance training · Ages 18+
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.78, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              Your mind gets
              <span>a game plan, too.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.72, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              Check in. Get one clear focus. Practice the skill. Test it under pressure. Then unlock
              what comes next.
            </motion.p>
            <motion.div
              className="pcp-hero-actions"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.28 }}
            >
              <a href="#experience" className="pcp-primary-button">
                See the full experience <ArrowDown size={17} />
              </a>
              <span className="pcp-hero-note"><span><Check size={12} /></span>Built for adult and elite athletes</span>
            </motion.div>
          </div>

          <motion.aside
            className="pcp-hero-gameplan"
            initial={{ opacity: 0, x: 34, y: 18 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.75, delay: 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pcp-hero-gameplan-head">
              <span><Activity size={15} /> TODAY’S GAME PLAN</span>
              <small>11 MIN</small>
            </div>
            <div className="pcp-hero-gameplan-focus">
              <small>MENTAL FOCUS</small>
              <strong>Recover attention under pressure</strong>
            </div>
            <div className="pcp-hero-gameplan-steps">
              <div><span><Waves size={15} /></span><p><small>LEARN</small><strong>Signal lock</strong></p><em>3 min</em></div>
              <div><span><Play size={14} /></span><p><small>TEST</small><strong>Noise under pressure</strong></p><em>60 sec</em></div>
              <div><span><TrendingUp size={15} /></span><p><small>BUILD</small><strong>Focus pathway</strong></p><em>Level 3</em></div>
            </div>
            <div className="pcp-hero-gameplan-footer"><span><Sparkles size={13} /> Built from today’s check-in</span><ArrowRight size={15} /></div>
          </motion.aside>
        </div>

        <div className="pcp-human-hero-caption">
          <span>THE MOMENT BEFORE THE MOMENT</span>
          <p>Mental performance becomes part of how the athlete prepares.</p>
        </div>
      </section>

      <ExperienceRail />

      <div className="pcp-motion-marquee" aria-hidden="true">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 24, ease: 'linear', repeat: Infinity }}
        >
          <span>CHECK IN</span><i /> <span>GET THE PLAN</span><i /> <span>TRAIN</span><i />
          <span>TEST</span><i /> <span>LEVEL UP</span><i /> <span>CHECK IN</span><i />
          <span>GET THE PLAN</span><i /> <span>TRAIN</span><i /> <span>TEST</span><i />
          <span>LEVEL UP</span><i />
        </motion.div>
      </div>

      <AthleteDaySection />
      <ValueAtGlance />
      <DeepDiveSection />

      <section className="pcp-trust-section">
        <div className="pcp-shell pcp-trust-grid">
          <Reveal className="pcp-team-photo">
            <motion.img
              src="/pulsecheck-pro/team-conversation.webp"
              alt="Coach and adult athletes having a focused conversation after training"
              initial={{ scale: 1.06 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="pcp-team-photo-shade" />
            <div className="pcp-team-quote">
              <MessageCircle size={18} />
              <span>ONE SHARED LANGUAGE</span>
              <strong>“Here’s what I need for the next rep.”</strong>
            </div>
          </Reveal>

          <Reveal className="pcp-section-copy" delay={0.12}>
            <span className="pcp-kicker"><MessageCircle size={14} /> The coach connection</span>
            <h2>The athlete finds the words. The coach gains a clearer way to support the work.</h2>
            <p>
              Private reflection gives athletes room to be honest. Coaches see useful patterns,
              shared language, and the moments where support can help.
            </p>
            <div className="pcp-trust-list">
              <div><Check size={14} /><span><strong>Athlete-owned reflection</strong> creates room for honest check-ins.</span></div>
              <div><Check size={14} /><span><strong>Useful performance patterns</strong> give coaches real context.</span></div>
              <div><Check size={14} /><span><strong>Shared mental-skill language</strong> travels from the app to practice.</span></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="pcp-final-section">
        <div className="pcp-final-rings" aria-hidden="true"><span /><span /><span /></div>
        <div className="pcp-shell">
          <Reveal className="pcp-final-content">
            <SignalOrb color="#A68BFF" />
            <span className="pcp-kicker">Mental performance that keeps moving</span>
            <h2>Give every athlete a next rep worth doing.</h2>
            <p>
              Bring adaptive protocols, scored simulations, focused training blocks, and a pathway
              that grows with performance to your athletes.
            </p>
            <a
              href="mailto:pulsefitnessapp@gmail.com?subject=Bring%20PulseCheck%20Pro%20to%20our%20athletes"
              className="pcp-primary-button"
            >
              Start a conversation <ArrowRight size={17} />
            </a>
          </Reveal>
        </div>
      </section>

      <footer className="pcp-footer">
        <div className="pcp-shell">
          <BrandMark />
          <p>Readiness. Practice. Pressure. Progress.</p>
          <div>
            <Link href="/PulseCheck/privacy">Privacy</Link>
            <Link href="/PulseCheck/terms">Terms</Link>
            <span>© {new Date().getFullYear()} Pulse Intelligence Labs</span>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        :root {
          --pcp-bg: #05070c;
          --pcp-panel: #0c1018;
          --pcp-panel-2: #111722;
          --pcp-text: #f8fafc;
          --pcp-muted: #8d96a7;
          --pcp-line: rgba(255, 255, 255, 0.09);
          --pcp-cyan: #46e7f2;
          --pcp-violet: #a68bff;
          --pcp-amber: #ffb84d;
        }

        html { scroll-behavior: smooth; }
        body { background: var(--pcp-bg); }

        .pcp-page {
          min-height: 100vh;
          overflow: hidden;
          color: var(--pcp-text);
          background:
            radial-gradient(circle at 72% 8%, rgba(49, 91, 180, 0.13), transparent 34rem),
            linear-gradient(180deg, #05070c 0%, #080b12 46%, #05070c 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          isolation: isolate;
        }

        .pcp-page * { box-sizing: border-box; }

        .pcp-shell {
          width: min(1200px, calc(100% - 40px));
          margin-inline: auto;
        }

        .pcp-texture {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          opacity: 0.12;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: radial-gradient(circle at 50% 30%, black, transparent 76%);
        }

        .pcp-background-glow {
          position: fixed;
          z-index: -2;
          width: 32rem;
          height: 32rem;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          opacity: 0.07;
        }

        .pcp-background-glow--one { top: 18%; left: -20rem; background: var(--pcp-cyan); }
        .pcp-background-glow--two { top: 58%; right: -20rem; background: var(--pcp-violet); }

        .pcp-nav {
          position: fixed;
          z-index: 80;
          inset: 0 0 auto;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(5, 7, 12, 0.76);
          backdrop-filter: blur(22px);
        }

        .pcp-nav-inner {
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 26px;
        }

        .pcp-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: white;
          text-decoration: none;
          flex: 0 0 auto;
        }

        .pcp-brand-icon {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          box-shadow: 0 0 28px rgba(166, 139, 255, 0.22);
        }

        .pcp-brand > span { display: flex; align-items: baseline; gap: 7px; }
        .pcp-brand strong { font-size: 14px; letter-spacing: -0.02em; }
        .pcp-brand small {
          color: var(--pcp-cyan);
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .pcp-nav nav { display: flex; align-items: center; gap: 26px; }

        .pcp-nav nav a,
        .pcp-footer a {
          color: #99a1af;
          font-size: 11px;
          font-weight: 700;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .pcp-nav nav a:hover,
        .pcp-nav nav a:focus-visible,
        .pcp-footer a:hover,
        .pcp-footer a:focus-visible { color: white; }

        .pcp-nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 15px;
          border: 1px solid rgba(70, 231, 242, 0.25);
          border-radius: 999px;
          color: var(--pcp-cyan);
          background: rgba(70, 231, 242, 0.07);
          font-size: 11px;
          font-weight: 850;
          text-decoration: none;
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .pcp-nav-cta:hover { transform: translateY(-1px); background: rgba(70, 231, 242, 0.12); }

        .pcp-hero {
          min-height: 100vh;
          padding: 132px 0 38px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
        }

        .pcp-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(520px, 1.08fr);
          align-items: center;
          gap: 64px;
        }

        .pcp-hero-copy { position: relative; z-index: 5; }

        .pcp-eyebrow,
        .pcp-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--pcp-cyan);
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .pcp-eyebrow > span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--pcp-cyan);
          box-shadow: 0 0 16px var(--pcp-cyan);
        }

        .pcp-hero h1 {
          max-width: 700px;
          margin: 25px 0 22px;
          font-size: clamp(4.3rem, 7.1vw, 7.4rem);
          line-height: 0.86;
          letter-spacing: -0.075em;
          font-weight: 870;
        }

        .pcp-hero h1 span {
          display: block;
          color: transparent;
          background: linear-gradient(100deg, #ffffff 0%, #a9f6ff 40%, #a68bff 100%);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .pcp-hero-copy > p {
          max-width: 610px;
          margin: 0;
          color: #adb5c3;
          font-size: clamp(1rem, 1.45vw, 1.18rem);
          line-height: 1.72;
        }

        .pcp-hero-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 34px;
        }

        .pcp-primary-button {
          min-height: 52px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 0 23px;
          border-radius: 999px;
          color: #041014;
          background: linear-gradient(110deg, #8af7ff, var(--pcp-cyan));
          box-shadow: 0 16px 44px rgba(70, 231, 242, 0.15);
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }

        .pcp-primary-button:hover,
        .pcp-primary-button:focus-visible {
          transform: translateY(-2px);
          box-shadow: 0 20px 56px rgba(70, 231, 242, 0.24);
        }

        .pcp-hero-note {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: #818a99;
          font-size: 11px;
          font-weight: 700;
        }

        .pcp-hero-note > span {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(70, 231, 242, 0.18);
          border-radius: 50%;
          color: var(--pcp-cyan);
          background: rgba(70, 231, 242, 0.08);
        }

        .pcp-hero-console {
          min-height: 640px;
          position: relative;
          display: grid;
          place-items: center;
          perspective: 1100px;
        }

        .pcp-console-orbit {
          position: absolute;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 50%;
        }

        .pcp-console-orbit span {
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--pcp-cyan);
          box-shadow: 0 0 18px var(--pcp-cyan);
        }

        .pcp-console-orbit--outer { width: 590px; height: 590px; }
        .pcp-console-orbit--outer span { top: 75px; right: 72px; }
        .pcp-console-orbit--inner { width: 455px; height: 455px; border-style: dashed; }
        .pcp-console-orbit--inner span {
          bottom: 38px;
          left: 92px;
          background: var(--pcp-violet);
          box-shadow: 0 0 18px var(--pcp-violet);
        }

        .pcp-console {
          position: relative;
          z-index: 4;
          width: 470px;
          min-height: 560px;
          padding: 25px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 28px;
          background:
            linear-gradient(150deg, rgba(255, 255, 255, 0.055), transparent 30%),
            rgba(10, 14, 22, 0.94);
          box-shadow:
            0 45px 110px rgba(0, 0, 0, 0.52),
            inset 0 0 0 1px rgba(255, 255, 255, 0.025),
            0 0 100px rgba(58, 118, 255, 0.07);
          backdrop-filter: blur(18px);
        }

        .pcp-console::after {
          content: "";
          position: absolute;
          width: 220px;
          height: 220px;
          top: -140px;
          right: -90px;
          border-radius: 50%;
          background: rgba(70, 231, 242, 0.16);
          filter: blur(60px);
        }

        .pcp-console-head {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .pcp-console-head small,
        .pcp-readiness-card small,
        .pcp-block-progress span,
        .pcp-console-label span,
        .pcp-console-rep small,
        .pcp-float-card small {
          color: #687283;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }

        .pcp-console-head h3 { margin: 6px 0 0; font-size: 24px; letter-spacing: -0.04em; }

        .pcp-live-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border: 1px solid rgba(70, 231, 242, 0.18);
          border-radius: 999px;
          color: var(--pcp-cyan);
          background: rgba(70, 231, 242, 0.07);
          font-size: 7px;
          font-weight: 900;
        }

        .pcp-live-chip i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 10px currentColor;
        }

        .pcp-readiness-card {
          display: grid;
          grid-template-columns: 92px 1fr;
          align-items: center;
          gap: 19px;
          margin-top: 24px;
          padding: 18px;
          border: 1px solid rgba(70, 231, 242, 0.14);
          border-radius: 20px;
          background: rgba(70, 231, 242, 0.045);
        }

        .pcp-score-ring {
          width: 82px;
          height: 82px;
          display: grid;
          place-items: center;
          align-content: center;
          border: 6px solid rgba(70, 231, 242, 0.12);
          border-top-color: var(--pcp-cyan);
          border-right-color: var(--pcp-cyan);
          border-radius: 50%;
          box-shadow: 0 0 38px rgba(70, 231, 242, 0.1);
        }

        .pcp-score-ring span { font-size: 24px; font-weight: 900; line-height: 1; }
        .pcp-score-ring small { margin-top: 4px; color: var(--pcp-cyan); }
        .pcp-readiness-card strong { display: block; margin-top: 5px; font-size: 14px; }
        .pcp-readiness-card p { margin: 7px 0 0; color: #8f98a8; font-size: 10px; line-height: 1.5; }

        .pcp-block-progress {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
          padding: 15px 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.025);
        }

        .pcp-block-progress > div:nth-child(2) { text-align: right; }
        .pcp-block-progress strong { display: block; margin-top: 4px; font-size: 10px; }
        .pcp-block-bar {
          grid-column: 1 / -1;
          height: 4px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
        }
        .pcp-block-bar span {
          width: 71%;
          height: 100%;
          display: block;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--pcp-cyan), var(--pcp-violet));
          box-shadow: 0 0 18px rgba(70, 231, 242, 0.35);
        }

        .pcp-console-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 21px 2px 10px;
        }
        .pcp-console-label small { color: #646d7d; font-size: 8px; }

        .pcp-console-reps { display: grid; gap: 8px; }
        .pcp-console-rep {
          --rep-color: var(--pcp-cyan);
          min-height: 58px;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid color-mix(in srgb, var(--rep-color) 22%, transparent);
          border-radius: 14px;
          color: var(--rep-color);
          background: color-mix(in srgb, var(--rep-color) 6%, rgba(255, 255, 255, 0.018));
        }
        .pcp-console-rep > span {
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: color-mix(in srgb, var(--rep-color) 12%, transparent);
        }
        .pcp-console-rep div { min-width: 0; }
        .pcp-console-rep strong { display: block; margin-top: 3px; color: white; font-size: 10px; }
        .pcp-console-rep em { color: #778091; font-size: 8px; font-style: normal; }

        .pcp-float-card {
          position: absolute;
          z-index: 7;
          min-width: 185px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 14px;
          background: rgba(12, 16, 25, 0.9);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
          backdrop-filter: blur(14px);
        }
        .pcp-float-card > span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 9px;
        }
        .pcp-float-card strong { display: block; margin-top: 3px; color: white; font-size: 10px; }
        .pcp-float-card--signal { left: -10px; top: 30%; }
        .pcp-float-card--signal > span { color: var(--pcp-cyan); background: rgba(70, 231, 242, 0.09); }
        .pcp-float-card--unlock { right: -8px; bottom: 21%; }
        .pcp-float-card--unlock > span { color: var(--pcp-violet); background: rgba(166, 139, 255, 0.1); }

        .pcp-hero-proof {
          display: flex;
          align-items: center;
          gap: 28px;
          margin-top: 5px;
          padding-top: 22px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .pcp-hero-proof > span {
          flex: 0 0 auto;
          color: #596171;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }
        .pcp-hero-proof > div {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 15px;
          overflow: hidden;
        }
        .pcp-hero-proof strong {
          flex: 0 0 auto;
          color: #a5adba;
          font-size: 8px;
          letter-spacing: 0.12em;
        }
        .pcp-hero-proof i { width: 3px; height: 3px; flex: 0 0 auto; border-radius: 50%; background: var(--pcp-cyan); }

        .pcp-statement {
          padding: 150px 0;
          background: linear-gradient(90deg, transparent, rgba(70, 231, 242, 0.03), transparent);
        }
        .pcp-statement small {
          display: block;
          margin-bottom: 20px;
          color: var(--pcp-cyan);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }
        .pcp-statement p {
          max-width: 1000px;
          margin: 0;
          color: #727b8a;
          font-size: clamp(2.3rem, 4.9vw, 5rem);
          font-weight: 850;
          letter-spacing: -0.06em;
          line-height: 1.03;
        }
        .pcp-statement p span { display: block; color: white; }

        .pcp-section { position: relative; padding: 130px 0; }

        .pcp-signal-section {
          border-block: 1px solid rgba(255, 255, 255, 0.06);
          background: #070a10;
        }

        .pcp-signal-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(550px, 1.2fr);
          align-items: center;
          gap: 82px;
        }

        .pcp-section-copy h2,
        .pcp-centered-heading h2,
        .pcp-block-heading h2,
        .pcp-outcomes-heading h2,
        .pcp-final-content h2 {
          margin: 18px 0;
          font-size: clamp(2.7rem, 4.7vw, 4.8rem);
          line-height: 0.97;
          letter-spacing: -0.058em;
        }

        .pcp-section-copy > p,
        .pcp-centered-heading > p,
        .pcp-block-heading > p,
        .pcp-final-content > p {
          color: #929baa;
          font-size: 15px;
          line-height: 1.75;
        }

        .pcp-copy-points { margin-top: 30px; border-top: 1px solid var(--pcp-line); }
        .pcp-copy-points > div {
          display: grid;
          grid-template-columns: 32px 1fr;
          gap: 13px;
          padding: 18px 0;
          border-bottom: 1px solid var(--pcp-line);
        }
        .pcp-copy-points span { color: var(--pcp-cyan); font-size: 9px; font-weight: 900; }
        .pcp-copy-points p { margin: 0; color: #7c8594; font-size: 11px; line-height: 1.55; }
        .pcp-copy-points strong { display: block; margin-bottom: 3px; color: white; font-size: 12px; }

        .pcp-signal-lab {
          position: relative;
          min-height: 560px;
          overflow: hidden;
          padding: 30px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 28px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.045), transparent 34%),
            #0d121b;
          box-shadow: 0 38px 88px rgba(0, 0, 0, 0.34);
        }
        .pcp-signal-lab-glow {
          position: absolute;
          width: 350px;
          height: 350px;
          top: -120px;
          right: -110px;
          pointer-events: none;
          transition: background 0.4s ease;
        }
        .pcp-signal-lab-head {
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }
        .pcp-signal-lab-head small {
          color: var(--pcp-cyan);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }
        .pcp-signal-lab-head h3 { margin: 7px 0 0; font-size: 25px; letter-spacing: -0.04em; }
        .pcp-signal-lab-head > span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          color: #8f98a7;
          font-size: 8px;
          font-weight: 800;
        }

        .pcp-signal-options {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 28px;
        }
        .pcp-signal-options button {
          min-height: 105px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 17px;
          color: #798291;
          background: rgba(255, 255, 255, 0.025);
          cursor: pointer;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .pcp-signal-options button:hover { transform: translateY(-2px); }
        .pcp-signal-options button.active {
          border-color: var(--option-color);
          color: white;
          background: var(--option-glow);
          box-shadow: 0 15px 40px var(--option-glow);
        }
        .pcp-signal-options button span { font-size: 25px; font-weight: 900; }
        .pcp-signal-options button small { color: var(--option-color); font-size: 9px; font-weight: 850; text-transform: uppercase; }

        .pcp-signal-result {
          --result-color: var(--pcp-cyan);
          position: relative;
          margin-top: 20px;
          padding: 22px;
          border: 1px solid color-mix(in srgb, var(--result-color) 22%, transparent);
          border-radius: 19px;
          background: rgba(2, 4, 8, 0.28);
        }
        .pcp-nora-line { display: flex; align-items: center; gap: 11px; }
        .pcp-nora-line small,
        .pcp-result-grid small {
          display: block;
          color: #697282;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }
        .pcp-nora-line strong { display: block; margin-top: 3px; color: var(--result-color); font-size: 12px; }
        .pcp-signal-result > p { margin: 17px 0; color: #aeb6c3; font-size: 12px; line-height: 1.62; }
        .pcp-result-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.07);
        }
        .pcp-result-grid > div { min-width: 0; padding: 11px; background: #0c1119; }
        .pcp-result-grid strong {
          display: block;
          overflow: hidden;
          margin-top: 5px;
          color: white;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pcp-centered-heading { max-width: 880px; margin: 0 auto; text-align: center; }
        .pcp-centered-heading .pcp-kicker { justify-content: center; }
        .pcp-centered-heading > p { max-width: 710px; margin-inline: auto; }

        .pcp-slate-section {
          background: radial-gradient(circle at 50% 55%, rgba(70, 231, 242, 0.045), transparent 37rem);
        }

        .pcp-slate-stage {
          margin-top: 58px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 30px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.035), transparent 34%),
            #0a0e16;
          box-shadow: 0 45px 95px rgba(0, 0, 0, 0.3);
        }

        .pcp-slate-nav {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.018);
        }
        .pcp-slate-nav button {
          min-height: 92px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          border: 0;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          color: #707988;
          background: transparent;
          cursor: pointer;
        }
        .pcp-slate-nav button:last-child { border-right: 0; }
        .pcp-slate-nav button.active {
          color: var(--pcp-cyan);
          background: linear-gradient(180deg, rgba(70, 231, 242, 0.08), transparent);
          box-shadow: inset 0 -2px var(--pcp-cyan);
        }
        .pcp-slate-nav button span { text-align: left; }
        .pcp-slate-nav button small {
          display: block;
          color: currentColor;
          opacity: 0.68;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }
        .pcp-slate-nav button strong { display: block; margin-top: 4px; color: white; font-size: 13px; }

        .pcp-slate-content { padding: 42px; }
        .pcp-slate-intro { max-width: 670px; }
        .pcp-slate-intro span { color: var(--pcp-cyan); font-size: 8px; font-weight: 900; letter-spacing: 0.16em; }
        .pcp-slate-intro h3 {
          margin: 9px 0 0;
          font-size: clamp(2rem, 3.2vw, 3.1rem);
          line-height: 1;
          letter-spacing: -0.05em;
        }

        .pcp-rep-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px; margin-top: 34px; }
        .pcp-rep-card {
          --rep-color: var(--pcp-cyan);
          min-height: 300px;
          padding: 22px;
          border: 1px solid color-mix(in srgb, var(--rep-color) 20%, rgba(255, 255, 255, 0.06));
          border-radius: 20px;
          background:
            radial-gradient(circle at 80% 0%, color-mix(in srgb, var(--rep-color) 14%, transparent), transparent 11rem),
            rgba(255, 255, 255, 0.022);
        }
        .pcp-rep-card-top { display: flex; align-items: center; justify-content: space-between; }
        .pcp-rep-card-top span { color: var(--rep-color); font-size: 11px; font-weight: 900; }
        .pcp-rep-card-top small { color: #717a89; font-size: 9px; font-weight: 800; }
        .pcp-rep-card > i {
          width: 36px;
          height: 2px;
          display: block;
          margin: 31px 0 21px;
          background: var(--rep-color);
          box-shadow: 0 0 14px var(--rep-color);
        }
        .pcp-rep-card > small { color: var(--rep-color); font-size: 8px; font-weight: 900; letter-spacing: 0.13em; text-transform: uppercase; }
        .pcp-rep-card h4 { margin: 8px 0 10px; font-size: 18px; letter-spacing: -0.03em; }
        .pcp-rep-card p { margin: 0; color: #8b94a3; font-size: 11px; line-height: 1.58; }
        .pcp-rep-card button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 24px;
          padding: 0;
          border: 0;
          color: var(--rep-color);
          background: transparent;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
        }

        .pcp-slate-reason {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 18px 42px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.018);
        }
        .pcp-slate-reason p { margin: 0; color: #828b99; font-size: 11px; line-height: 1.5; }
        .pcp-slate-reason strong { color: white; }

        .pcp-signal-orb {
          --signal-color: var(--pcp-cyan);
          position: relative;
          width: 42px;
          height: 42px;
          display: inline-grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 50%;
          background:
            radial-gradient(circle at 68% 70%, #65f0c2, transparent 25%),
            radial-gradient(circle at 34% 28%, white, transparent 21%),
            linear-gradient(135deg, var(--signal-color), #4933a4);
          box-shadow: 0 0 34px color-mix(in srgb, var(--signal-color) 40%, transparent);
        }
        .pcp-signal-orb::after {
          content: "";
          position: absolute;
          inset: -7px;
          border: 1px solid color-mix(in srgb, var(--signal-color) 34%, transparent);
          border-radius: 50%;
          animation: pcp-orb-pulse 3s ease-in-out infinite;
        }
        .pcp-signal-orb > span {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.28);
          filter: blur(3px);
        }
        .pcp-signal-orb--compact { width: 26px; height: 26px; }
        .pcp-signal-orb--compact::after { inset: -4px; }
        @keyframes pcp-orb-pulse {
          0%, 100% { transform: scale(0.92); opacity: 0.32; }
          50% { transform: scale(1.09); opacity: 0.82; }
        }

        .pcp-block-section {
          border-block: 1px solid rgba(255, 255, 255, 0.06);
          background: #070a11;
        }
        .pcp-block-halo {
          position: absolute;
          width: 700px;
          height: 700px;
          top: 80px;
          right: -380px;
          border-radius: 50%;
          background: rgba(166, 139, 255, 0.05);
          filter: blur(90px);
        }
        .pcp-block-heading { max-width: 850px; }
        .pcp-block-heading > p { max-width: 690px; }
        .pcp-block-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(440px, 0.8fr);
          align-items: stretch;
          gap: 26px;
          margin-top: 58px;
        }

        .pcp-block-rail {
          position: relative;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          padding: 25px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 23px;
          background: rgba(255, 255, 255, 0.02);
        }
        .pcp-block-line {
          position: absolute;
          top: 62px;
          left: calc(12.5% + 25px);
          right: calc(12.5% + 25px);
          height: 2px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.08);
        }
        .pcp-block-line span {
          height: 100%;
          display: block;
          background: linear-gradient(90deg, var(--pcp-cyan), var(--pcp-violet));
        }
        .pcp-block-rail button {
          position: relative;
          z-index: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 5px;
          border: 0;
          color: #5f6877;
          background: transparent;
          text-align: center;
          cursor: pointer;
        }
        .pcp-block-rail button > span {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 50%;
          color: #707989;
          background: #0b0f17;
          font-size: 15px;
          font-weight: 900;
          transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }
        .pcp-block-rail button.reached > span { border-color: var(--moment-color); color: var(--moment-color); }
        .pcp-block-rail button.active > span {
          color: #05070c;
          background: var(--moment-color);
          box-shadow: 0 0 40px color-mix(in srgb, var(--moment-color) 28%, transparent);
          transform: scale(1.06);
        }
        .pcp-block-rail button small { margin-top: 13px; font-size: 7px; font-weight: 900; letter-spacing: 0.15em; }
        .pcp-block-rail button strong { margin-top: 5px; color: #a7afbd; font-size: 9px; }
        .pcp-block-rail button.active strong { color: white; }

        .pcp-block-detail {
          min-height: 330px;
          padding: 32px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 23px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.04), transparent 35%),
            #0c111a;
        }
        .pcp-block-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
        .pcp-block-detail-head > span { color: var(--moment-color); font-size: 8px; font-weight: 900; letter-spacing: 0.15em; }
        .pcp-block-detail-head > div { text-align: right; }
        .pcp-block-detail-head small { display: block; color: #697282; font-size: 7px; font-weight: 850; letter-spacing: 0.12em; }
        .pcp-block-detail-head strong { display: block; margin-top: 4px; color: var(--moment-color); font-size: 12px; }
        .pcp-block-detail h3 { max-width: 440px; margin: 32px 0 14px; font-size: 27px; line-height: 1.05; letter-spacing: -0.045em; }
        .pcp-block-detail > div > p { margin: 0; color: #9099a8; font-size: 12px; line-height: 1.65; }
        .pcp-block-decision {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 27px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--moment-color);
        }
        .pcp-block-decision small { display: block; color: #636c7a; font-size: 7px; font-weight: 900; letter-spacing: 0.13em; }
        .pcp-block-decision strong { display: block; margin-top: 4px; color: #d8dde5; font-size: 10px; line-height: 1.5; }

        .pcp-loop-strip {
          display: grid;
          grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
          align-items: center;
          gap: 18px;
          margin-top: 24px;
          padding: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.018);
        }
        .pcp-loop-strip > div { display: grid; grid-template-columns: 36px 1fr; column-gap: 10px; align-items: center; }
        .pcp-loop-strip > div > span {
          width: 35px;
          height: 35px;
          grid-row: 1 / 3;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: var(--pcp-cyan);
          background: rgba(70, 231, 242, 0.08);
        }
        .pcp-loop-strip strong { font-size: 10px; }
        .pcp-loop-strip small { margin-top: 3px; color: #687180; font-size: 8px; line-height: 1.4; }
        .pcp-loop-strip > svg { color: #3f4754; }

        .pcp-outcomes-section { padding: 130px 0; }
        .pcp-outcomes-heading { display: grid; grid-template-columns: 0.35fr 1fr; align-items: end; gap: 70px; }
        .pcp-outcomes-heading > span { padding-bottom: 12px; color: var(--pcp-cyan); font-size: 9px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; }
        .pcp-outcomes-heading h2 { margin: 0; }
        .pcp-outcomes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 56px; }
        .pcp-outcome-card {
          --outcome-color: var(--pcp-cyan);
          min-height: 260px;
          padding: 26px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 21px;
          background:
            radial-gradient(circle at 90% 0%, color-mix(in srgb, var(--outcome-color) 12%, transparent), transparent 12rem),
            rgba(255, 255, 255, 0.02);
        }
        .pcp-outcome-card > div { display: flex; align-items: center; justify-content: space-between; color: var(--outcome-color); }
        .pcp-outcome-card > div > span { color: #5c6574; font-size: 9px; font-weight: 900; }
        .pcp-outcome-card h3 { margin: 72px 0 11px; font-size: 21px; letter-spacing: -0.035em; }
        .pcp-outcome-card p { margin: 0; color: #858e9d; font-size: 12px; line-height: 1.62; }

        .pcp-pathway-section {
          border-block: 1px solid rgba(255, 255, 255, 0.06);
          background:
            radial-gradient(circle at 50% 54%, rgba(166, 139, 255, 0.06), transparent 36rem),
            #070a10;
        }
        .pcp-pathway-map { margin-top: 62px; }
        .pcp-pathway-buttons {
          display: grid;
          grid-template-columns: repeat(11, auto);
          align-items: center;
          justify-content: center;
          gap: 9px;
        }
        .pcp-pathway-buttons button {
          min-width: 94px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          padding: 0;
          border: 0;
          color: #596271;
          background: transparent;
          cursor: pointer;
        }
        .pcp-pathway-buttons button > span {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          background: #0c1018;
          font-size: 9px;
          font-weight: 900;
          transition: all 0.2s ease;
        }
        .pcp-pathway-buttons button.reached > span { border-color: var(--path-color); color: var(--path-color); }
        .pcp-pathway-buttons button.active > span {
          color: #05070c;
          background: var(--path-color);
          box-shadow: 0 0 38px color-mix(in srgb, var(--path-color) 28%, transparent);
          transform: scale(1.08);
        }
        .pcp-pathway-buttons button strong { color: #8a93a2; font-size: 8px; line-height: 1.25; }
        .pcp-pathway-buttons button.active strong { color: white; }
        .pcp-pathway-buttons > i { width: 36px; height: 1px; background: rgba(255, 255, 255, 0.1); }

        .pcp-pathway-detail {
          min-height: 300px;
          display: grid;
          grid-template-columns: 150px minmax(0, 1fr) minmax(300px, 0.75fr);
          align-items: center;
          gap: 42px;
          margin-top: 46px;
          padding: 45px;
          border: 1px solid color-mix(in srgb, var(--path-color) 20%, rgba(255, 255, 255, 0.07));
          border-radius: 27px;
          background:
            radial-gradient(circle at 85% 30%, color-mix(in srgb, var(--path-color) 11%, transparent), transparent 18rem),
            #0c1018;
        }
        .pcp-pathway-index {
          color: transparent;
          -webkit-text-stroke: 1px var(--path-color);
          font-size: 92px;
          font-weight: 900;
          letter-spacing: -0.08em;
          opacity: 0.6;
        }
        .pcp-pathway-copy > span { color: var(--path-color); font-size: 8px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; }
        .pcp-pathway-copy h3 { margin: 9px 0 13px; font-size: 35px; letter-spacing: -0.05em; }
        .pcp-pathway-copy p { margin: 0; color: #919aa9; font-size: 13px; line-height: 1.65; }
        .pcp-pathway-gain { display: grid; gap: 1px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 15px; background: rgba(255, 255, 255, 0.08); }
        .pcp-pathway-gain > div { padding: 15px; background: #0a0e15; }
        .pcp-pathway-gain small { color: #616a79; font-size: 7px; font-weight: 900; letter-spacing: 0.12em; }
        .pcp-pathway-gain strong { display: block; margin-top: 6px; color: white; font-size: 10px; line-height: 1.45; }
        .pcp-pathway-gain > div:last-child strong { color: var(--path-color); }

        .pcp-trust-section { padding: 150px 0; }
        .pcp-trust-grid {
          display: grid;
          grid-template-columns: minmax(500px, 1fr) minmax(0, 0.85fr);
          align-items: center;
          gap: 90px;
        }
        .pcp-trust-visual { min-height: 520px; position: relative; display: grid; place-items: center; }
        .pcp-trust-core {
          position: relative;
          z-index: 3;
          width: 190px;
          height: 190px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid rgba(70, 231, 242, 0.22);
          border-radius: 50%;
          background: #0b1018;
          box-shadow: 0 0 90px rgba(70, 231, 242, 0.09);
        }
        .pcp-trust-core small { margin-top: 13px; color: var(--pcp-cyan); font-size: 7px; font-weight: 900; letter-spacing: 0.15em; }
        .pcp-trust-core strong { font-size: 13px; }
        .pcp-trust-ring { position: absolute; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 50%; }
        .pcp-trust-ring--one { width: 350px; height: 350px; }
        .pcp-trust-ring--two { width: 500px; height: 500px; border-style: dashed; }
        .pcp-trust-ring span { position: absolute; width: 7px; height: 7px; border-radius: 50%; background: var(--pcp-violet); box-shadow: 0 0 15px var(--pcp-violet); }
        .pcp-trust-ring--one span { top: 40px; right: 60px; }
        .pcp-trust-ring--two span { bottom: 65px; left: 70px; background: var(--pcp-cyan); }
        .pcp-trust-node {
          position: absolute;
          z-index: 4;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 13px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #bcc4cf;
          background: rgba(12, 16, 24, 0.92);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
          font-size: 9px;
          font-weight: 800;
        }
        .pcp-trust-node svg { color: var(--pcp-cyan); }
        .pcp-trust-node--coach { top: 57px; right: 18px; }
        .pcp-trust-node--system { bottom: 62px; right: 3px; }
        .pcp-trust-node--privacy { left: 0; top: 46%; }

        .pcp-trust-list { display: grid; gap: 12px; margin-top: 28px; }
        .pcp-trust-list > div { display: flex; align-items: flex-start; gap: 10px; color: var(--pcp-cyan); }
        .pcp-trust-list span { color: #858e9c; font-size: 11px; line-height: 1.55; }
        .pcp-trust-list strong { color: white; }

        .pcp-final-section {
          min-height: 690px;
          position: relative;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          background:
            radial-gradient(circle at 50% 50%, rgba(70, 231, 242, 0.08), transparent 27rem),
            #05070c;
        }
        .pcp-final-rings { position: absolute; inset: 0; display: grid; place-items: center; }
        .pcp-final-rings span { position: absolute; border: 1px solid rgba(255, 255, 255, 0.055); border-radius: 50%; }
        .pcp-final-rings span:nth-child(1) { width: 360px; height: 360px; }
        .pcp-final-rings span:nth-child(2) { width: 620px; height: 620px; }
        .pcp-final-rings span:nth-child(3) { width: 900px; height: 900px; border-style: dashed; }
        .pcp-final-content { position: relative; z-index: 2; max-width: 850px; margin: 0 auto; text-align: center; }
        .pcp-final-content > .pcp-signal-orb { margin-bottom: 28px; }
        .pcp-final-content .pcp-kicker { justify-content: center; }
        .pcp-final-content > p { max-width: 650px; margin: 0 auto 30px; }

        .pcp-footer { border-top: 1px solid rgba(255, 255, 255, 0.07); background: #04060a; }
        .pcp-footer > div {
          min-height: 105px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 30px;
        }
        .pcp-footer p { margin: 0; color: #626b79; font-size: 9px; text-align: center; }
        .pcp-footer > div > div { display: flex; align-items: center; gap: 17px; }
        .pcp-footer > div > div span { color: #59616e; font-size: 9px; }

        /* Athlete-first story */
        .pcp-human-hero {
          min-height: 100svh;
          isolation: isolate;
          overflow: hidden;
          padding: 120px 0 70px;
        }

        .pcp-human-hero-image,
        .pcp-human-hero-overlay,
        .pcp-human-hero-flare {
          position: absolute;
          inset: 0;
        }

        .pcp-human-hero-image {
          z-index: -4;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 57% center;
          filter: saturate(0.92) contrast(1.04);
        }

        .pcp-human-hero-overlay {
          z-index: -3;
          background:
            linear-gradient(90deg, rgba(3, 5, 9, 0.98) 0%, rgba(3, 5, 9, 0.88) 31%, rgba(3, 5, 9, 0.28) 64%, rgba(3, 5, 9, 0.18) 100%),
            linear-gradient(0deg, rgba(3, 5, 9, 0.9) 0%, transparent 34%, rgba(3, 5, 9, 0.25) 100%);
        }

        .pcp-human-hero-flare {
          z-index: -2;
          left: 38%;
          width: 44%;
          background: radial-gradient(circle, rgba(70, 231, 242, 0.15), transparent 63%);
          filter: blur(35px);
        }

        .pcp-human-hero-grid {
          min-height: calc(100svh - 190px);
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(340px, 0.5fr);
          align-items: center;
          gap: 90px;
        }

        .pcp-human-hero .pcp-hero-copy { max-width: 760px; }
        .pcp-human-hero .pcp-hero-copy > p {
          max-width: 610px;
          color: rgba(255, 255, 255, 0.76);
          font-size: clamp(1.05rem, 1.5vw, 1.25rem);
        }

        .pcp-human-hero h1 {
          max-width: 770px;
          font-size: clamp(4.3rem, 6.8vw, 7rem);
          line-height: 0.94;
          text-wrap: balance;
        }

        .pcp-human-hero h1 span {
          padding-bottom: 0.09em;
        }

        .pcp-hero-gameplan {
          width: min(100%, 390px);
          align-self: end;
          justify-self: end;
          margin-bottom: 42px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 24px;
          background: rgba(7, 10, 16, 0.76);
          box-shadow: 0 32px 100px rgba(0, 0, 0, 0.48);
          backdrop-filter: blur(22px);
        }

        .pcp-hero-gameplan-head,
        .pcp-hero-gameplan-footer {
          min-height: 47px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 0 18px;
        }

        .pcp-hero-gameplan-head {
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
          color: var(--pcp-cyan);
        }

        .pcp-hero-gameplan-head span,
        .pcp-hero-gameplan-footer span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .pcp-hero-gameplan-head small {
          color: white;
          font-size: 8px;
          font-weight: 900;
        }

        .pcp-hero-gameplan-focus { padding: 21px 18px 18px; }
        .pcp-hero-gameplan-focus small,
        .pcp-hero-gameplan-steps small {
          color: #747f90;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }
        .pcp-hero-gameplan-focus strong {
          display: block;
          max-width: 290px;
          margin-top: 7px;
          font-size: 19px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        .pcp-hero-gameplan-steps { padding: 0 12px 12px; }
        .pcp-hero-gameplan-steps > div {
          display: grid;
          grid-template-columns: 34px 1fr auto;
          align-items: center;
          gap: 10px;
          min-height: 54px;
          padding: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }
        .pcp-hero-gameplan-steps > div > span {
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: var(--pcp-cyan);
          background: rgba(70, 231, 242, 0.09);
        }
        .pcp-hero-gameplan-steps > div:nth-child(2) > span {
          color: var(--pcp-violet);
          background: rgba(166, 139, 255, 0.1);
        }
        .pcp-hero-gameplan-steps > div:nth-child(3) > span {
          color: var(--pcp-amber);
          background: rgba(255, 184, 77, 0.1);
        }
        .pcp-hero-gameplan-steps p { margin: 0; }
        .pcp-hero-gameplan-steps strong { display: block; margin-top: 3px; font-size: 10px; }
        .pcp-hero-gameplan-steps em { color: #87909e; font-size: 8px; font-style: normal; }
        .pcp-hero-gameplan-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.09);
          color: #9ba5b3;
          background: rgba(255, 255, 255, 0.025);
        }
        .pcp-hero-gameplan-footer svg { color: var(--pcp-cyan); }

        .pcp-human-hero-caption {
          position: absolute;
          right: 38px;
          bottom: 28px;
          max-width: 330px;
          padding-left: 16px;
          border-left: 2px solid var(--pcp-cyan);
        }
        .pcp-human-hero-caption span {
          color: var(--pcp-cyan);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }
        .pcp-human-hero-caption p {
          margin: 5px 0 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 10px;
          line-height: 1.5;
        }

        .pcp-experience-rail {
          position: relative;
          z-index: 2;
          padding: 116px 0 125px;
          color: #10151d;
          background:
            radial-gradient(circle at 9% 9%, rgba(70, 231, 242, 0.22), transparent 22rem),
            radial-gradient(circle at 90% 85%, rgba(166, 139, 255, 0.16), transparent 24rem),
            #f1f0eb;
        }

        .pcp-experience-heading {
          max-width: 790px;
          display: grid;
          grid-template-columns: 0.42fr 1fr;
          column-gap: 58px;
          align-items: end;
        }
        .pcp-experience-heading > span {
          grid-row: 1 / 3;
          align-self: start;
          padding-top: 12px;
          color: #157b84;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.17em;
        }
        .pcp-experience-heading h2,
        .pcp-athlete-story-heading h2,
        .pcp-value-heading h2,
        .pcp-deep-heading h2 {
          margin: 0;
          font-size: clamp(3rem, 5.3vw, 5.6rem);
          line-height: 0.95;
          letter-spacing: -0.065em;
          text-wrap: balance;
        }
        .pcp-experience-heading p {
          max-width: 560px;
          margin: 20px 0 0;
          color: #56606b;
          font-size: 15px;
          line-height: 1.65;
        }

        .pcp-experience-steps {
          position: relative;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 68px;
        }

        .pcp-experience-line {
          position: absolute;
          z-index: 0;
          top: -24px;
          left: 6%;
          right: 6%;
          height: 2px;
          transform-origin: left;
          background: linear-gradient(90deg, #46e7f2, #7df2b8, #a68bff, #ffb84d);
        }
        .pcp-experience-line span {
          position: absolute;
          top: -4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 0 0 5px rgba(70, 231, 242, 0.25), 0 0 20px #46e7f2;
          animation: pcp-travel 4.8s ease-in-out infinite;
        }

        .pcp-experience-step {
          --step-color: var(--pcp-cyan);
          position: relative;
          z-index: 1;
          min-height: 285px;
          padding: 23px;
          overflow: hidden;
          border: 1px solid rgba(9, 17, 27, 0.09);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.76);
          box-shadow: 0 20px 54px rgba(22, 31, 45, 0.08);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .pcp-experience-step::after {
          content: "";
          position: absolute;
          width: 160px;
          height: 160px;
          right: -95px;
          bottom: -100px;
          border-radius: 50%;
          background: var(--step-color);
          filter: blur(45px);
          opacity: 0.16;
        }
        .pcp-experience-step:hover {
          transform: translateY(-8px);
          box-shadow: 0 28px 68px rgba(22, 31, 45, 0.14);
        }
        .pcp-experience-step-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }
        .pcp-experience-step-top > span {
          width: 47px;
          height: 47px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          color: #071117;
          background: var(--step-color);
          box-shadow: 0 10px 28px color-mix(in srgb, var(--step-color) 33%, transparent);
        }
        .pcp-experience-step-top small {
          color: color-mix(in srgb, var(--step-color) 75%, #10151d);
          font-size: 11px;
          font-weight: 950;
        }
        .pcp-experience-step h3 {
          margin: 72px 0 11px;
          font-size: 23px;
          letter-spacing: -0.04em;
        }
        .pcp-experience-step p {
          margin: 0;
          color: #616a74;
          font-size: 12px;
          line-height: 1.65;
        }

        .pcp-motion-marquee {
          width: 100%;
          overflow: hidden;
          border-block: 1px solid rgba(255, 255, 255, 0.1);
          background: #46e7f2;
        }
        .pcp-motion-marquee > div {
          width: max-content;
          min-height: 68px;
          display: flex;
          align-items: center;
          gap: 26px;
          color: #061014;
        }
        .pcp-motion-marquee span {
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }
        .pcp-motion-marquee i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #061014;
        }

        .pcp-athlete-story {
          padding: 140px 0;
          background:
            radial-gradient(circle at 12% 20%, rgba(166, 139, 255, 0.09), transparent 25rem),
            #070a10;
        }
        .pcp-athlete-story-heading {
          max-width: 940px;
          margin-bottom: 58px;
        }
        .pcp-athlete-story-heading > span,
        .pcp-value-heading small,
        .pcp-deep-heading > span {
          display: block;
          margin-bottom: 18px;
          color: var(--pcp-cyan);
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.17em;
        }
        .pcp-athlete-story-heading > p {
          max-width: 690px;
          margin: 22px 0 0;
          color: #919aa8;
          font-size: 15px;
          line-height: 1.7;
        }

        .pcp-athlete-scene {
          min-height: 680px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 34px;
          box-shadow: 0 45px 110px rgba(0, 0, 0, 0.42);
        }
        .pcp-athlete-scene > img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .pcp-athlete-scene-shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(4, 6, 10, 0.15), rgba(4, 6, 10, 0.1) 45%, rgba(4, 6, 10, 0.94) 100%),
            linear-gradient(0deg, rgba(4, 6, 10, 0.78), transparent 55%);
        }
        .pcp-athlete-scene-copy {
          position: absolute;
          left: 38px;
          bottom: 36px;
          max-width: 470px;
        }
        .pcp-athlete-scene-copy > span {
          color: var(--pcp-cyan);
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }
        .pcp-athlete-scene-copy blockquote {
          margin: 10px 0 8px;
          font-size: clamp(1.8rem, 3vw, 3.4rem);
          font-weight: 850;
          line-height: 1;
          letter-spacing: -0.05em;
        }
        .pcp-athlete-scene-copy p {
          margin: 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
        }
        .pcp-athlete-moments {
          position: absolute;
          top: 50%;
          right: 28px;
          width: min(390px, 38%);
          display: grid;
          gap: 11px;
          transform: translateY(-50%);
        }
        .pcp-athlete-moment {
          --moment-color: var(--pcp-cyan);
          display: grid;
          grid-template-columns: 36px 1fr;
          gap: 12px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-left-color: var(--moment-color);
          border-radius: 16px;
          background: rgba(7, 10, 16, 0.74);
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.27);
          backdrop-filter: blur(16px);
        }
        .pcp-athlete-moment > i {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #071014;
          background: var(--moment-color);
          font-size: 10px;
          font-style: normal;
          font-weight: 950;
        }
        .pcp-athlete-moment small {
          display: block;
          color: var(--moment-color);
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }
        .pcp-athlete-moment strong {
          display: block;
          margin-top: 4px;
          font-size: 12px;
        }
        .pcp-athlete-moment p {
          margin: 5px 0 0;
          color: #9aa3b0;
          font-size: 9px;
          line-height: 1.45;
        }

        .pcp-value-section {
          padding: 120px 0 130px;
          background:
            linear-gradient(180deg, #0b0f17, #070a10);
        }
        .pcp-value-heading {
          max-width: 880px;
          display: grid;
          grid-template-columns: 0.32fr 1fr;
          align-items: start;
          gap: 45px;
        }
        .pcp-value-heading small { margin-top: 13px; }
        .pcp-value-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 62px;
        }
        .pcp-value-card {
          --value-color: var(--pcp-cyan);
          min-height: 365px;
          position: relative;
          overflow: hidden;
          padding: 27px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 25px;
          background:
            radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--value-color) 18%, transparent), transparent 16rem),
            rgba(255, 255, 255, 0.025);
          transition: transform 0.3s ease, border-color 0.3s ease;
        }
        .pcp-value-card:hover {
          transform: translateY(-7px);
          border-color: color-mix(in srgb, var(--value-color) 40%, rgba(255, 255, 255, 0.1));
        }
        .pcp-value-card > div {
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          margin-bottom: 70px;
          border-radius: 16px;
          color: #061014;
          background: var(--value-color);
        }
        .pcp-value-card > small {
          color: var(--value-color);
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }
        .pcp-value-card h3 {
          margin: 10px 0 12px;
          font-size: 24px;
          line-height: 1.07;
          letter-spacing: -0.04em;
        }
        .pcp-value-card p {
          margin: 0;
          color: #929baa;
          font-size: 12px;
          line-height: 1.62;
        }
        .pcp-value-card > span {
          position: absolute;
          left: 27px;
          bottom: 25px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #788291;
          font-size: 8px;
          font-weight: 800;
        }
        .pcp-value-card > span svg { color: var(--value-color); }

        .pcp-deep-dive {
          position: relative;
          padding: 125px 0 0;
          color: #0d131b;
          background:
            radial-gradient(circle at 94% 10%, rgba(255, 184, 77, 0.17), transparent 22rem),
            #f1f0eb;
        }
        .pcp-deep-heading {
          max-width: 900px;
        }
        .pcp-deep-heading > span { color: #157b84; }
        .pcp-deep-heading > p {
          max-width: 650px;
          margin: 20px 0 0;
          color: #5d6670;
          font-size: 15px;
          line-height: 1.65;
        }
        .pcp-deep-options {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-top: 55px;
          padding-bottom: 120px;
        }
        .pcp-deep-options button {
          --deep-color: var(--pcp-cyan);
          min-height: 315px;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 24px;
          border: 1px solid rgba(13, 19, 27, 0.1);
          border-radius: 23px;
          color: #0d131b;
          background: rgba(255, 255, 255, 0.7);
          box-shadow: 0 18px 45px rgba(20, 29, 41, 0.07);
          text-align: left;
          cursor: pointer;
          transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease;
        }
        .pcp-deep-options button:hover,
        .pcp-deep-options button.active {
          transform: translateY(-5px);
          border-color: var(--deep-color);
          background: white;
        }
        .pcp-deep-options button > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: color-mix(in srgb, var(--deep-color) 80%, #0d131b);
        }
        .pcp-deep-options button > div small {
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }
        .pcp-deep-options h3 {
          margin: 62px 0 11px;
          font-size: 23px;
          line-height: 1.1;
          letter-spacing: -0.04em;
        }
        .pcp-deep-options p {
          margin: 0;
          color: #67717c;
          font-size: 12px;
          line-height: 1.62;
        }
        .pcp-deep-options button > span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: auto;
          padding-top: 22px;
          color: color-mix(in srgb, var(--deep-color) 73%, #0d131b);
          font-size: 10px;
          font-weight: 900;
        }
        .pcp-deep-content {
          overflow: hidden;
          color: var(--pcp-text);
          background: var(--pcp-bg);
        }
        .pcp-deep-console-preview {
          min-height: 720px;
          display: grid;
          place-items: center;
          padding-top: 60px;
        }
        .pcp-deep-content .pcp-section:first-child { border-top: 0; }

        .pcp-team-photo {
          min-height: 590px;
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          box-shadow: 0 38px 90px rgba(0, 0, 0, 0.36);
        }
        .pcp-team-photo > img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .pcp-team-photo-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(0deg, rgba(4, 6, 10, 0.82), transparent 63%);
        }
        .pcp-team-quote {
          position: absolute;
          left: 26px;
          right: 26px;
          bottom: 24px;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 17px;
          background: rgba(7, 10, 16, 0.68);
          backdrop-filter: blur(16px);
        }
        .pcp-team-quote > svg { color: var(--pcp-cyan); }
        .pcp-team-quote span {
          display: block;
          margin: 8px 0 6px;
          color: var(--pcp-cyan);
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }
        .pcp-team-quote strong {
          display: block;
          max-width: 430px;
          font-size: 20px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        @keyframes pcp-travel {
          0% { left: 0%; }
          50% { left: calc(100% - 10px); }
          100% { left: 0%; }
        }

        @media (max-width: 1100px) {
          .pcp-nav nav { display: none; }
          .pcp-hero-grid { grid-template-columns: minmax(0, 0.9fr) minmax(470px, 1.1fr); gap: 34px; }
          .pcp-console { width: 430px; }
          .pcp-console-orbit--outer { width: 520px; height: 520px; }
          .pcp-signal-grid { grid-template-columns: 1fr 1.15fr; gap: 48px; }
          .pcp-block-layout { grid-template-columns: 1fr; }
          .pcp-pathway-buttons { grid-template-columns: repeat(6, 1fr); gap: 8px; }
          .pcp-pathway-buttons > i { display: none; }
          .pcp-pathway-buttons button { min-width: 0; }
          .pcp-pathway-detail { grid-template-columns: 120px 1fr; }
          .pcp-pathway-gain { grid-column: 1 / -1; grid-template-columns: repeat(2, 1fr); }
          .pcp-trust-grid { gap: 45px; }
          .pcp-human-hero-grid { grid-template-columns: minmax(0, 1fr) 350px; gap: 35px; }
          .pcp-human-hero h1 { font-size: clamp(4rem, 7vw, 6rem); }
          .pcp-experience-step { min-height: 270px; padding: 20px; }
          .pcp-athlete-moments { width: 42%; }
        }

        @media (max-width: 860px) {
          .pcp-section { padding: 104px 0; }
          .pcp-hero { min-height: auto; padding-top: 120px; }
          .pcp-hero-grid { grid-template-columns: 1fr; }
          .pcp-hero-copy { max-width: 720px; }
          .pcp-hero h1 { font-size: clamp(4rem, 12vw, 6.8rem); }
          .pcp-hero-console { min-height: 660px; }
          .pcp-signal-grid,
          .pcp-trust-grid { grid-template-columns: 1fr; }
          .pcp-signal-grid { gap: 50px; }
          .pcp-trust-grid { gap: 40px; }
          .pcp-outcomes-heading { grid-template-columns: 1fr; gap: 12px; }
          .pcp-outcomes-grid { grid-template-columns: 1fr; }
          .pcp-outcome-card { min-height: 220px; }
          .pcp-outcome-card h3 { margin-top: 50px; }
          .pcp-loop-strip { grid-template-columns: 1fr 1fr; }
          .pcp-loop-strip > svg { display: none; }
          .pcp-footer > div { grid-template-columns: 1fr; justify-items: center; padding: 28px 0; gap: 18px; }
          .pcp-human-hero { min-height: 920px; }
          .pcp-human-hero-grid { grid-template-columns: 1fr; align-content: center; }
          .pcp-human-hero-image { object-position: 64% center; }
          .pcp-human-hero-overlay {
            background:
              linear-gradient(90deg, rgba(3, 5, 9, 0.96), rgba(3, 5, 9, 0.32)),
              linear-gradient(0deg, rgba(3, 5, 9, 0.88), transparent 50%);
          }
          .pcp-hero-gameplan { align-self: auto; justify-self: start; margin: 0; }
          .pcp-human-hero-caption { right: 24px; }
          .pcp-experience-heading,
          .pcp-value-heading { grid-template-columns: 1fr; gap: 12px; }
          .pcp-experience-heading > span { grid-row: auto; padding-top: 0; }
          .pcp-experience-steps,
          .pcp-value-grid { grid-template-columns: repeat(2, 1fr); }
          .pcp-experience-line { display: none; }
          .pcp-athlete-scene { min-height: 760px; }
          .pcp-athlete-scene-shade {
            background:
              linear-gradient(0deg, rgba(4, 6, 10, 0.96) 0%, rgba(4, 6, 10, 0.16) 68%),
              linear-gradient(90deg, transparent, rgba(4, 6, 10, 0.34));
          }
          .pcp-athlete-moments {
            top: auto;
            right: 20px;
            bottom: 22px;
            width: 52%;
            transform: none;
          }
          .pcp-athlete-scene-copy { top: 28px; bottom: auto; }
          .pcp-deep-options { grid-template-columns: 1fr; }
          .pcp-deep-options button { min-height: 240px; }
          .pcp-deep-options h3 { margin-top: 38px; }
        }

        @media (max-width: 640px) {
          .pcp-shell { width: min(100% - 28px, 1200px); }
          .pcp-nav-inner { min-height: 66px; }
          .pcp-nav-cta { width: 40px; height: 40px; justify-content: center; padding: 0; font-size: 0; }
          .pcp-brand > span { align-items: center; }
          .pcp-brand small { font-size: 8px; }
          .pcp-hero { padding-top: 105px; }
          .pcp-hero h1 { margin-top: 20px; font-size: clamp(3.8rem, 17vw, 5.6rem); }
          .pcp-eyebrow { line-height: 1.5; }
          .pcp-primary-button { width: 100%; }
          .pcp-hero-note { width: 100%; justify-content: center; }
          .pcp-hero-console { min-height: 590px; margin-inline: -7px; }
          .pcp-console { width: 100%; min-height: 535px; padding: 20px; border-radius: 24px; }
          .pcp-console-orbit--outer { width: 440px; height: 440px; }
          .pcp-console-orbit--inner { width: 340px; height: 340px; }
          .pcp-float-card { min-width: 158px; padding: 10px; }
          .pcp-float-card--signal { left: -4px; top: 24%; }
          .pcp-float-card--unlock { right: -4px; bottom: 17%; }
          .pcp-readiness-card { grid-template-columns: 76px 1fr; gap: 12px; padding: 14px; }
          .pcp-score-ring { width: 70px; height: 70px; }
          .pcp-console-head h3 { font-size: 21px; }
          .pcp-hero-proof { display: block; overflow: hidden; }
          .pcp-hero-proof > div { margin-top: 14px; }
          .pcp-statement { padding: 105px 0; }
          .pcp-statement p { font-size: clamp(2.5rem, 12vw, 4rem); }
          .pcp-section-copy h2,
          .pcp-centered-heading h2,
          .pcp-block-heading h2,
          .pcp-outcomes-heading h2,
          .pcp-final-content h2 { font-size: clamp(2.55rem, 12vw, 4rem); }
          .pcp-signal-lab { min-height: 590px; padding: 20px; border-radius: 22px; }
          .pcp-signal-lab-head > span { display: none; }
          .pcp-signal-options button { min-height: 88px; }
          .pcp-result-grid { grid-template-columns: repeat(2, 1fr); }
          .pcp-slate-stage { border-radius: 23px; }
          .pcp-slate-nav button { min-height: 82px; padding: 10px; }
          .pcp-slate-content { padding: 25px 18px; }
          .pcp-rep-grid { grid-template-columns: 1fr; }
          .pcp-rep-card { min-height: 245px; }
          .pcp-slate-reason { align-items: flex-start; padding: 17px 18px; }
          .pcp-block-rail { grid-template-columns: repeat(2, 1fr); row-gap: 26px; }
          .pcp-block-line { display: none; }
          .pcp-block-detail { padding: 23px; }
          .pcp-block-detail h3 { font-size: 24px; }
          .pcp-loop-strip { grid-template-columns: 1fr; }
          .pcp-outcomes-section { padding: 104px 0; }
          .pcp-pathway-buttons { grid-template-columns: repeat(3, 1fr); row-gap: 23px; }
          .pcp-pathway-detail { grid-template-columns: 1fr; gap: 22px; padding: 27px 22px; }
          .pcp-pathway-index { font-size: 68px; }
          .pcp-pathway-gain { grid-column: auto; grid-template-columns: 1fr; }
          .pcp-trust-visual { min-height: 410px; transform: scale(0.82); margin: -35px; }
          .pcp-final-section { min-height: 650px; }
          .pcp-footer > div > div { flex-wrap: wrap; justify-content: center; }
          .pcp-human-hero { min-height: 850px; padding: 98px 0 42px; }
          .pcp-human-hero-grid { min-height: 710px; align-content: space-between; gap: 25px; }
          .pcp-human-hero-image { object-position: 67% center; }
          .pcp-human-hero-overlay {
            background:
              linear-gradient(180deg, rgba(3, 5, 9, 0.94) 0%, rgba(3, 5, 9, 0.72) 42%, rgba(3, 5, 9, 0.38) 65%, rgba(3, 5, 9, 0.92) 100%);
          }
          .pcp-human-hero h1 { font-size: clamp(3.45rem, 15.2vw, 5.2rem); line-height: 0.95; }
          .pcp-human-hero .pcp-hero-copy > p { font-size: 1rem; line-height: 1.58; }
          .pcp-human-hero .pcp-hero-actions { margin-top: 24px; }
          .pcp-hero-gameplan { width: 100%; margin-bottom: 0; }
          .pcp-human-hero-caption { display: none; }
          .pcp-experience-rail,
          .pcp-athlete-story,
          .pcp-value-section { padding: 90px 0; }
          .pcp-experience-heading h2,
          .pcp-athlete-story-heading h2,
          .pcp-value-heading h2,
          .pcp-deep-heading h2 { font-size: clamp(2.7rem, 13vw, 4rem); }
          .pcp-experience-steps,
          .pcp-value-grid { grid-template-columns: 1fr; }
          .pcp-experience-step { min-height: 230px; }
          .pcp-experience-step h3 { margin-top: 52px; }
          .pcp-motion-marquee > div { min-height: 58px; }
          .pcp-athlete-scene { min-height: 825px; border-radius: 25px; }
          .pcp-athlete-scene > img { height: 46%; object-position: 43% center; }
          .pcp-athlete-scene-shade {
            background: linear-gradient(0deg, #070a10 42%, transparent 66%, rgba(4, 6, 10, 0.14));
          }
          .pcp-athlete-scene-copy { left: 20px; right: 20px; top: 39%; }
          .pcp-athlete-scene-copy blockquote { font-size: 2rem; }
          .pcp-athlete-moments {
            left: 14px;
            right: 14px;
            bottom: 16px;
            width: auto;
          }
          .pcp-athlete-moment { padding: 13px; }
          .pcp-value-card { min-height: 330px; }
          .pcp-deep-dive { padding-top: 90px; }
          .pcp-deep-options { padding-bottom: 90px; }
          .pcp-team-photo { min-height: 440px; border-radius: 24px; }
          .pcp-team-photo > img { object-position: 54% center; }
          .pcp-trust-grid { gap: 48px; }
        }

        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .pcp-page *,
          .pcp-page *::before,
          .pcp-page *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
};

export default PulseCheckProPage;

export const getStaticProps: GetStaticProps = async () => ({
  props: {
    ogMeta: {
      title: pageMeta.ogTitle,
      description: pageMeta.ogDescription,
      image: 'https://fitwithpulse.ai/pulsecheck-pro-og.png',
      url: 'https://fitwithpulse.ai/PulseCheck/pro',
      type: 'website',
      siteName: 'PulseCheck Pro',
    },
  },
});
