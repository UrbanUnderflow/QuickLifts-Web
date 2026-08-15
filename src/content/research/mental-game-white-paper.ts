import {
  AUNTEDNA_ESCALATION_WHITE_PAPER_CONTENT,
  AUNTEDNA_ESCALATION_WHITE_PAPER_METADATA,
  AUNTEDNA_ESCALATION_WHITE_PAPER_SLUG,
} from './auntedna-escalation-white-paper';

export const TRAINING_MENTAL_GAME_WHITE_PAPER_SLUG =
  'training-the-mental-game-a-simulation-based-architecture-for-mental-performance-in-sport';

export const TRAINING_MENTAL_GAME_WHITE_PAPER_METADATA = {
  title: 'Training the Mental Game: A Protocol and Simulation Architecture for Mental Performance in Sport',
  subtitle:
    'How PulseCheck combines state-regulation protocols, evidence-informed task practice, curriculum planning, and governed validation for athletes.',
  excerpt:
    'A white paper on PulseCheck as a two-lane mental performance system, including the exact task, calculation, minimum-data rule, and evidence boundary for each simulation family.',
  category: 'Performance Science',
  author: 'Tremaine Grant',
  authorTitle: 'Founder of Pulse Intelligence Labs',
  readTime: '42 min read',
  contentType: 'white-paper' as const,
  featured: false,
  status: 'published' as const,
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
  publishedAt: '2026-06-05T00:00:00.000Z',
  featuredImage: '/research-training-mental-game-white-paper.webp',
};

export interface ResearchArticleOverride {
  title: string;
  subtitle: string;
  excerpt: string;
  category: string;
  author: string;
  authorTitle?: string;
  readTime: string;
  contentType: 'article' | 'white-paper';
  featured: boolean;
  visibility?: 'public' | 'unlisted';
  listed?: boolean;
  passwordProtected?: boolean;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  featuredImage?: string;
  content: string;
}

export const TRAINING_MENTAL_GAME_WHITE_PAPER_CONTENT = `
:::abstract
Mental performance is widely acknowledged as a critical factor in athletic competition, yet the tools available to train it have not kept pace with the systems used to develop physical capacity. Most existing approaches fall into one of two categories: clinical sport psychology delivered through conversation, or consumer-facing brain training apps built on generic cognitive tasks with limited evidence of transfer to sport-specific contexts. Neither approach provides athletes and coaches with a structured, measurable, progressive training system for the cognitive-perceptual and state-regulation skills that determine performance under pressure.

This paper introduces PulseCheck as a protocol and simulation architecture for mental performance training. The system operates through two coordinated lanes. Protocols are bounded mental regulation, priming, and recovery interventions that help an athlete change state before, between, or after demanding performance moments. Simulations are instrumented, evidence-informed tasks designed to rehearse specific cognitive-perceptual demands and observe behavior under controlled conditions. They do not, by themselves, establish a stable trait, neural change, clinical condition, readiness state, or transfer to competition. Nora, the adaptive planning engine, reads state signals, profile history, protocol responsiveness, simulation outcomes, and curriculum progress before assigning the next useful action.

The core thesis is that athletes do not need a one-day competition trick. They need a curriculum that builds automaticity over time. PulseCheck therefore keeps a small active slate of protocols and simulations in flight, rotates them as mastery emerges, and uses repeated, state-aware practice to make useful responses easier to retrieve when pressure taxes attention. This paper describes the scientific foundations, system architecture, protocol and simulation design principles, curriculum model, automaticity framework, physiology-cognition roadmap, and validation discipline that govern PulseCheck.
:::

# 1. The Problem: Mental Performance Without a Training System

Every serious athlete knows that the mental side of competition matters. Coaches say it constantly. Commentators invoke it after every collapse or comeback. Athletes feel it in the body: the tight chest before a decisive attempt, the tunnel vision after a mistake, the noisy mind when a simple choice suddenly feels expensive.

But when you ask a practical question, the answer is often vague. How, exactly, do you train focus? How do you build composure so it appears under pressure, not just during calm reflection? How do you make a reset response available when the athlete has seconds, not minutes? How does a coach know whether mental training is progressing?

Physical performance has mature training systems. Strength coaches operate within periodized blocks. Speed development follows technical progressions. Conditioning programs are built around energy systems, load, recovery, and adaptation. There is a shared language, a structured methodology, measurable outputs, and a progression model that adapts to the individual athlete.

The mental side of sport is usually less organized. Sport psychology has produced decades of valuable research on attentional control, anxiety, stress inoculation, executive function, imagery, self-talk, and pressure performance. But the translation of that research into daily, accessible, measurable training has been uneven. Most athletes encounter mental performance support in one of three ways: periodic conversation with a professional, coach-delivered motivational language, or generic cognitive tasks packaged as performance training.

None of those approaches, by themselves, create a complete training system. A conversation can be powerful, but it is not the same as instrumented practice. A breathing exercise can help, but it does not automatically become available under pressure unless it is rehearsed and embedded into the athlete's performance routine. A generic reaction game may improve performance on that game without teaching the athlete how to regulate state or execute inside sport-relevant pressure.

PulseCheck addresses that gap by combining two complementary forms of training. Simulations create repeatable task environments that engage defined cognitive-perceptual processes and record task-specific behavior under controlled challenge. Protocols provide bounded mental interventions that help athletes regulate, prime, recover, and apply the right state before a simulation, trial, practice exposure, or competition moment.

PulseCheck is a protocol and simulation system. Protocols help the athlete work with state. Simulations provide structured practice and task-specific observations. Curriculum ties both together over time so the athlete is not hoping to remember a tool on competition day; they are building a response that has already been rehearsed and reviewed.

## 1.1 What This Looks Like in Practice

Consider an athlete who opens PulseCheck after a difficult practice. They report feeling keyed up, frustrated by a mistake, and unsure whether they should push into another pressure challenge. If a connected device is available, the state layer may also see that recovery markers are below that athlete's recent baseline. A generic app might serve a relaxation clip or a reaction game. PulseCheck should do something more specific.

Nora first reads the current state pattern. If the athlete wants help with overactivation, Nora may offer a short regulation protocol such as Box Breathing or Nerves to Excitement. The athlete practices the intervention inside a bounded exchange, and the system records whether the athlete can name the body signal, apply the technique, and describe a useful shift. If the athlete wants a task afterward, Nora can offer The Reset Switch to practice returning to the same left-right classification task after a controlled interruption.

The output is not a vague claim that the athlete "worked on mindset." The system can preserve the athlete's pre-protocol report, protocol completion, condition accuracy, premature responses, timeouts, and the median within-pair response-time difference between matched reference and post-interruption trials. Those observations can support a coaching conversation. They do not prove emotional recovery, resilience, or the cause of a change.

That is the product thesis in miniature: read state, choose a bounded intervention, test execution under pressure, and use the result to shape the next training decision.

# 2. Scientific Foundations

PulseCheck is not built on one theory. It draws from several research traditions that collectively describe how attention, control, state, pressure, learning, and automaticity interact in athletic performance. The system does not claim that its full implementation has already been validated through randomized controlled trials. That work must be earned. What the system does claim is that its design choices are grounded in established science and that its evidence model separates mechanism support from implementation validation.

## 2.1 Attentional Control Theory

Attentional Control Theory, developed by Eysenck, Derakshan, Santos, and Calvo, provides one of the primary theoretical backbones of PulseCheck. The theory argues that anxiety disrupts the balance between two attentional systems: a goal-directed system that keeps attention on task-relevant information, and a stimulus-driven system that pulls attention toward threat, distraction, and irrelevant cues. [cite:1,2]

Under pressure, the stimulus-driven system gains influence. The athlete may know what matters, but attention becomes easier to capture. The mind searches for threat, the body reacts to urgency, and execution quality can degrade. This is not a lack of character. It is a predictable shift in cognitive control.

PulseCheck translates this theory into bounded task hypotheses. Noise Gate compares performance in matched visible-target fields with and without an added distractor. Reset compares the same left-right classification task after a neutral hold and after a controlled interruption. Signal Window varies the strength of perceptual evidence while holding its response window constant. Sequence Shift compares cued rule-repeat and rule-switch trials. These are evidence-informed task designs, not proof that the product has measured a general attention capacity.

## 2.2 Stress Inoculation Training

Stress Inoculation Training, associated with Meichenbaum, provides the pedagogical logic for pressure exposure. The core principle is that controlled, graduated exposure to stressors, paired with skill rehearsal, can build more stable performance when real stressors appear. [cite:3]

In PulseCheck, this appears through carefully bounded modifiers and curriculum progression. A modifier is allowed only when it preserves the family's canonical rule, timing contract, response mapping, and core calculation. Modifier conditions are labeled and analyzed separately; the system does not silently tighten timing, add visual load, or change scoring and then attribute a difference to pressure or fatigue. The goal is not to eliminate stress. The design hypothesis is that graduated, well-specified practice may help athletes apply useful responses while stress remains present, a transfer claim that must be tested rather than assumed.

This matters because competition does not wait until the athlete feels perfectly calm. A useful mental training system has to teach athletes how to regulate when regulation is needed, and how to execute when stress remains present.

## 2.3 Executive Function Research

The executive function framework, particularly the model proposed by Miyake and colleagues, identifies inhibition, shifting, and updating as core cognitive control processes. These are directly relevant to sport. [cite:4]

Inhibition helps an athlete resist the wrong response, ignore a tempting decoy, or stop an error from cascading. Shifting helps attention move from disruption back to the next useful target. Updating helps the athlete refresh working memory when rules, reads, or conditions change. PulseCheck maps these functions into trainable skill families instead of treating cognition as one generic score.

## 2.4 Automaticity and Procedural Learning

Automaticity is the process by which a skill moves from slow, deliberate, attention-heavy control into fast, efficient, cue-triggered execution. In early learning, the athlete has to think through each step. With practice, the response becomes more fluent. The relevant cue appears, and the trained action or mental response becomes easier to access without consuming the same amount of working memory.

This is not magic and it is not mindlessness. Automaticity is learned efficiency. Schneider and Shiffrin's work on controlled and automatic processing showed that consistent practice can change how much conscious control a task requires. Logan's instance theory argues that automaticity develops as repeated encounters build stored instances that can be retrieved quickly. Motor learning models, including Fitts and Posner's stages of skill acquisition, similarly describe movement from cognitive effort to more autonomous execution. [cite:9,10,11,12]

For athletes, this is critical because pressure taxes working memory and attention. When a skill still requires heavy conscious control, pressure can interfere with execution. When a skill has become more automatic, the athlete has more attentional capacity available for reading the environment, adapting, and staying present.

Mental skills can follow a similar pattern. A breathing pattern, reframe, cue word, visualization sequence, or reset routine is not most useful when the athlete can explain it calmly. It is most useful when the body and mind can access it quickly under pressure. PulseCheck curriculum exists to build that availability.

## 2.5 Choking, Explicit Monitoring, and Pressure

Research on choking under pressure adds a warning. Well-learned skills can break down when athletes over-monitor them. Beilock and Carr's work on skilled performance and Masters' work on explicit versus implicit knowledge both support the idea that pressure can pull attention inward, causing athletes to consciously control processes that usually run more fluidly. [cite:13,14]

PulseCheck does not want athletes to memorize long scripts in the middle of competition. It wants them to build compact, practiced responses. A cue word should point attention toward the right target. Box breathing should steady the body without turning into a complicated counting task. A reset sequence should help the athlete return to execution, not trap them in self-analysis. [cite:15,18]

This is why the system pairs protocols and simulations. Protocols teach the response. Simulations test whether the response survives pressure, distraction, and time compression.

## 2.6 Sport-Specific Attention Research

Posner and Petersen's model of attention supports the idea that attention is not one thing. It includes alerting, orienting, and executive control. Applied sport psychology work, including Nideffer and Sagal's attention-control framing and USOC mental training materials, reinforces that attention in sport is directional, contextual, and trainable. [cite:5,6,7,8]

PulseCheck's Focus, Composure, and Decision pillars translate those ideas into product architecture. The system uses coaching-friendly language at the top, but keeps research-grounded skill definitions and raw metrics underneath.

# 3. The PulseCheck System Architecture

PulseCheck is organized around a formal architecture that defines what is being trained, how state is interpreted, how assignments are selected, how progress is measured, and how evidence claims are governed.

## 3.1 Two Sibling Lanes: Protocols and Simulations

The central architectural principle is the separation between protocols and simulations.

Protocols are bounded state interventions. They are not lightweight content cards and they are not simulation variants. A protocol exists to change athlete state so a following action becomes more useful. It may regulate overactivation, prime readiness, narrow attention, build confidence, rehearse imagery, or support recovery. Each protocol needs a mechanism, use window, expected state shift, contraindications, evidence posture, and runtime eligibility.

Simulations are instrumented mental performance tasks. They create controlled environments where athletes can practice a defined demand and where PulseCheck can record task-specific behavior. Each simulation has a family, variants, mechanics, observed outputs, modifier compatibility, minimum-data rules, exclusion rules, and evidence status.

The two lanes are siblings. Protocols regulate or prepare the state. Simulations challenge and measure execution. Nora can assign one alone or sequence them together when the athlete needs both.

## 3.2 Protocol System

The protocol system uses a family, variant, and runtime record model. A protocol family defines the conceptual intervention lane, such as steady regulation, cognitive reframe, imagery priming, or focus narrowing. A protocol variant defines a designed expression of that family, such as Box Breathing, Nerves to Excitement, Perfect Execution Replay, or Cue-Word Anchoring. A published runtime record defines what Nora is actually allowed to assign.

This distinction matters because a protocol should not become available simply because someone wrote good copy. It must be structured, reviewed, bounded, and governed. The protocol governance model tracks evidence, misuse risk, target state shift, trigger tags, avoid windows, publish status, revision lineage, and effectiveness signals.

In practice, this means Nora does not invent interventions at runtime. Nora chooses from a bounded registry of published protocols that the system knows how to deliver and audit.

## 3.3 Simulation System

The simulation system is organized around six locked initial families:

- Reset: matched left-right classification before and after one controlled interruption, observing task re-entry without labeling it emotional recovery.
- Noise Gate: matched visible-target search with and without a defined distractor, observing a task-specific distraction effect.
- Brake Point: left-right go responses with a delayed stop signal on a minority of trials, observing go behavior and stop success.
- Signal Window: majority-direction decisions across balanced levels of visual evidence, observing accuracy and correct response time separately.
- Sequence Shift: cued switching between stable letter and number rules, observing repeat-versus-switch differences.
- Endurance Lock: one constant visual response task across six blocks, observing within-session change without assigning fatigue as the cause.

Each family can have variants, sport-context expressions, pressure modifiers, and assessment modes. The system can expand, but expansion is governed. Additional families must demonstrate that they are meaningfully distinct from established families rather than merely a different visual wrapper.

## 3.4 Three Pillars: Focus, Composure, Decision

At the coaching layer, PulseCheck organizes mental performance into three durable pillars.

Focus is the ability to direct, sustain, and shift attention toward task-relevant information while resisting distraction or internal noise.

Composure is the ability to maintain execution quality under pressure, recover quickly from disruption, and prevent emotional load from degrading performance.

Decision is the ability to process information, inhibit the wrong response, update priorities, and act under uncertainty and time pressure.

These pillars are intentionally stable. They give athletes and coaches a shared vocabulary while allowing the underlying skill map and measurement model to remain more granular.

## 3.5 State Signal Layer

PulseCheck does not assign work from profile history alone. It reads current state first.

The State Signal Layer collects self-report, conversation signals, performance patterns, context, biometrics when available, execution events, and coach constraints. It then builds a shared state snapshot that captures activation, focus readiness, emotional load, cognitive fatigue, overall readiness, confidence, freshness, and recommended routing posture.

This is important because two athletes can both look "Yellow" but need different actions. One may be overactivated and need regulation. Another may be flat and need priming. A third may be cognitively depleted and need recovery or a lower-load assignment. The state layer preserves the underlying pattern instead of collapsing everything into one readiness label.

## 3.6 Score Architecture and Modifiers

PulseCheck's score system operates in layers. At the top are coaching-facing pillar composites for Focus, Composure, and Decision. Beneath them are construct hypotheses that require validation. Beneath those are the observed task measures: correct and incorrect responses, response time on valid correct trials, premature responses, false starts, timeouts, within-condition variability, and prespecified condition differences. The raw observations remain available so a composite never hides what was actually recorded.

Modifiers may change the psychological context of a simulation only when they leave its measurement contract intact. A supported comparison can describe performance in the labeled task conditions; it cannot distinguish a general baseline ability from pressure sensitivity until reliability, construct validity, and transfer have been established.

# 4. Protocol Design Principles

Protocols are the mental regulation side of PulseCheck. They teach athletes what to do with state.

## 4.1 Protocols Are State Interventions

A protocol is defined by mechanism, not by surface wording. It should answer:

- What state bottleneck is this protocol trying to address?
- What mechanism is expected to create the shift?
- What window is it designed for?
- When should Nora avoid assigning it?
- What evidence supports the mechanism?
- How will the system know whether it helped?

This keeps protocols from becoming generic wellness content. The goal is not to give the athlete something pleasant to read or listen to. The goal is to teach and rehearse a state intervention that can be used before, during, or after performance demands.

## 4.2 Example Protocols

Box Breathing is a steady-regulation protocol. It uses equal inhale, hold, exhale, and hold phases to stabilize breathing rhythm and support composure. In the curriculum model, Box Breathing is not only a relaxation tool. It is a practiced state-control pattern the athlete can deploy between attempts, before a high-pressure action, or during a transition window. [cite:16]

Cognitive Reframing is a regulation protocol that changes the meaning of arousal. The athlete learns to interpret pressure signals as readiness rather than danger. This matters because the same elevated heart rate or body tension can either become threat language or performance energy depending on appraisal. [cite:17]

Visualization is an imagery-priming protocol. The athlete mentally rehearses a desired action, rhythm, or state before execution. The goal is to refresh the internal model of what good performance should feel like and look like before the body has to execute. [cite:19]

Cue-Word Anchoring is a priming and focus-narrowing protocol. The athlete trains a compact phrase that points attention toward the next controllable target. This is especially important for automaticity because the cue becomes a retrieval trigger. Instead of searching through a long mental script under pressure, the athlete has one trained anchor that compresses the response. [cite:18]

## 4.3 Teach, Practice, Evaluate

A protocol does not end when Nora explains it. The protocol practice model has three layers.

First, Nora teaches the protocol: what it is, when to use it, and what state shift it is designed to create.

Second, the athlete practices it through a bounded Nora-guided exchange. This can include naming body signals, applying the technique, rehearsing the phrase, describing the desired shift, or speaking a competition-ready line.

Third, Nora evaluates the practice using protocol-specific dimensions such as signal awareness, technique fidelity, language quality, shift quality, and coachability. Completion alone is weak evidence. The system needs to know whether the athlete actually applied the protocol well enough to count.

## 4.4 Protocol Responsiveness

Not every athlete responds to the same protocol in the same way. One athlete may settle quickly with steady breathing. Another may respond better to cue-word anchoring. A third may need cognitive reframing because the state problem is not arousal itself, but the meaning attached to arousal.

The protocol responsiveness model tracks which families and variants tend to help, do nothing, or backfire for a specific athlete. It uses completion, athlete response, state snapshot movement, downstream simulation quality, negative-response signals, freshness, and confidence. Responsiveness is not preference only. A favorite protocol and an effective protocol are not always the same.

Responsiveness also stays subordinate to current state. If the latest state snapshot strongly indicates a different need, Nora should not overrule it just because an older protocol pattern once looked useful. Personalization refines bounded choice; it does not ignore the present moment.

# 5. Simulation Design Principles

Simulations are the structured task-practice side of PulseCheck. They create controlled, instrumented challenges that let athletes rehearse defined demands and let the system observe task-specific behavior. Whether that practice changes a broader cognitive construct or transfers to sport is a research question, not an assumption built into the score.

## 5.1 The Sim Specification Template

Every simulation is authored against a specification template. A valid simulation must define its primary pillar, target skills, underlying mechanism, scientific basis, game flow, scoring model, raw metrics, modifier compatibility, difficulty progression, session validity rules, and evidence status.

This prevents the most common failure mode in cognitive training products: building something that feels engaging but has no clear connection to a trainable mechanism or no way to evaluate transfer. PulseCheck simulations should feel like training, not entertainment with a performance label.

## 5.2 Example: The Reset Switch

The Reset Switch is the flagship Reset-family task. It asks a narrower, answerable question: within this session, how does performance on the same left-right arrow classification differ after a controlled interruption compared with a neutral hold?

Two unscored practice trials come first. Scored trials are counterbalanced matched pairs. Both conditions use the same arrow task, response keys, 1,700 millisecond pre-target interval, and 1,500 millisecond response window. In the post-interruption condition, a 900 millisecond interruption replaces part of the neutral hold and is followed by a fixed 800 millisecond reset interval. The task therefore changes the interruption condition while preserving total pre-target time.

The core result is the median within-pair difference between valid correct responses: post-interruption response time minus reference response time. It is unavailable until the session contains at least six valid correct matched pairs. Condition accuracy, the accuracy difference, first post-interruption correctness, premature responses, timeouts, and the observed reset interval remain separate.

This design is informed by attentional-control and task-reorientation research, including evidence that post-error slowing can reflect orienting or response caution rather than one simple recovery mechanism. [cite:1,29,30] PulseCheck can describe task re-entry after this controlled interruption. It cannot infer emotional recovery, resilience, mental toughness, neural recovery, or competition behavior from this task alone.

## 5.3 Canonical Measurement Contracts

Every family uses one canonical contract across web, iOS, and Android. A family name is not treated as evidence that a psychological construct was measured. Each contract keeps four layers separate:

- **Task:** what appears and what the athlete does.
- **Observed measure:** what is calculated from recorded behavior.
- **Construct hypothesis:** the process the task is intended to engage.
- **Transfer hypothesis:** a possibility that requires a separate sport-relevant study.

Practice trials do not enter scored results. Accuracy, correct-response time, wrong responses, premature responses, false starts, and timeouts remain separate. Responses below the 150 millisecond artifact floor do not enter response-time estimates. A result can be unavailable when its minimum-data or quality rules are not met; the product does not manufacture a score from insufficient observations.

| Family | Canonical task | Standard core result | Minimum-data rule | Interpretation boundary |
| --- | --- | --- | --- | --- |
| Noise Gate | Find one visible called number in matched reference and distraction fields. | Reference accuracy minus distraction accuracy. | Core reporting requires equal condition counts and at least five rounds per condition; response-time shift requires three valid correct matched pairs. | Task-specific distraction effect, not a general attention trait. |
| Reset | Classify matched left-right arrows before or after one controlled interruption and fixed reset interval. | Median post-interruption minus reference response-time difference. | Requires six valid correct matched pairs. | Task re-entry observation, not emotional recovery or resilience. |
| Brake Point | Make left-right go responses and withhold when a delayed STOP signal appears. | Stop success beside go accuracy and correct go response time. | Core reporting requires the standard 48 go and 16 stop trials; a stop-time estimate requires 150 valid go trials, 50 stop trials, and all quality checks. | Stop-signal task behavior, not trait impulsivity. |
| Signal Window | Choose the majority direction in a balanced nine-arrow field. | Decision accuracy beside correct response time. | Reporting requires all 24 scored trials; overall response time requires six valid correct responses and each evidence level requires two. | Brief perceptual decision, not sport vision or tactical intelligence. |
| Sequence Shift | Switch between cued Letter and Number rules with stable response keys. | Switch minus repeat correct-response-time difference, with accuracy beside it. | Requires eight valid correct repeat and eight valid correct switch trials. | Cued task switching, not broad flexibility or working-memory capacity. |
| Endurance Lock | Tap for one constant visual signal after unpredictable foreperiods across six blocks. | Fitted response-time change per elapsed minute. | Requires 24 valid responses and at least three in every block. | This session's sustained-attention behavior, not proof of fatigue or its cause. |

### Noise Gate

Noise Gate is a visible-target visual-search task, not a word-memory game. A number remains visible at the top while the athlete finds that same number in a field. Each scored target appears once in a reference condition and once in the configured distraction condition. In the visual condition, one wrong option may be highlighted; the correct option is never highlighted. Audio and combined variants preserve the same search rule and must use separately balanced channel conditions.

The standard core result is the reference accuracy minus distraction accuracy. Program and evidence-layer reporting requires equal condition counts and at least five scored rounds per condition. A secondary correct-response-time shift is the median distraction-minus-reference latency within valid correct matched pairs and remains unavailable below three pairs. Wrong taps, highlighted-distractor taps, timeouts, input method, device class, and channel are kept separate. Attentional-control and visual-search research support the interference hypothesis, not a claim that one mobile session measures a general filtering ability or predicts performance under sport pressure. [cite:1,5,9]

### Brake Point

Brake Point follows the stop-signal structure. Most trials require a left or right response to an arrow. On 25 percent of trials, STOP appears after the arrow has begun and the athlete must withhold the response. There is no Brake button. Four unscored practice trials precede the standard 64 scored trials. The stop-signal delay begins at 250 milliseconds, moves in 50 millisecond steps, and remains between 100 and 700 milliseconds. Successful withholding makes the next stop harder by increasing the delay; any failed stop response, including a premature response, decreases it. [cite:24,25]

The standard training result is stop success, reported beside go accuracy and correct go response time. Program and evidence-layer reporting requires the standard 48 go and 16 stop trials. That is an implementation-completeness rule, not a claim of individual reliability. PulseCheck does not report a stop-signal reaction-time estimate from the standard rep. A research-length stop-time estimate requires at least 150 valid go trials and 50 stop trials, complete stop-delay capture, stop success between 25 and 75 percent, no more than 10 percent go omissions, at least 80 percent go accuracy, and failed-stop responses that are faster on average than correct go responses. Even when those checks pass, the estimate is task-specific and may not support reliable individual inference without additional validation. It does not establish impulsivity, diagnosis, safety risk, readiness, or on-field inhibition. [cite:24,25]

### Signal Window

Signal Window presents nine arrows for 650 milliseconds. Five, six, or seven arrows agree with the target direction, and the athlete chooses whether the majority points left or right. Direction and evidence count are balanced, the clock begins at field onset, and the 1,600 millisecond response window remains fixed. This avoids revealing the answer through option order and avoids confounding weaker evidence with a shorter deadline.

Decision accuracy and correct response time are co-primary task observations; they are not collapsed into an arbitrary speed-accuracy score. Program and evidence-layer reporting accepts decision accuracy only when all 24 scored trials are present. That is an implementation-completeness rule, not validation evidence. Overall correct response time is unavailable below six valid correct responses, and evidence-level response time is unavailable below two valid correct responses at that level. Wrong choices, premature responses, and timeouts remain separate. Psychophysical evidence supports the expectation that stimulus strength can affect decision speed and accuracy. It does not make this a measure of sport vision, tactical intelligence, readiness, or game-day decision quality. [cite:26]

### Sequence Shift

Sequence Shift uses stable keys and changing rules. A neutral Letter or Number cue appears 400 milliseconds before a letter-number pair. Left always means vowel or odd; right always means consonant or even. Six practice trials teach the mapping. Scored trials balance repeat-versus-switch status, active rule, response side, and congruency under one 1,800 millisecond response window.

The core result is mean valid correct switch response time minus repeat response time and remains unavailable below eight valid correct trials in either condition. Repeat accuracy, switch accuracy, the accuracy difference, premature responses, and timeouts remain separate. An old-rule response is counted as perseveration only on an eligible incongruent switch trial. Classic task-switching research supports this repeat-versus-switch comparison. The task does not establish working-memory capacity, broad cognitive flexibility, readiness, sport intelligence, or transfer to play changes. [cite:27,28]

### Endurance Lock

Endurance Lock holds the task constant from start to finish. After four practice trials, the athlete responds to the same center visual signal across six scored blocks. The rule, display load, 1,500 millisecond response window, scoring, and feedback remain constant. Only the foreperiod varies unpredictably between 1,500 and 3,500 milliseconds. Legacy profile names cannot introduce tighter cadence, shorter windows, extra visual load, or late-session stakes and then call the resulting difference fatigue.

The core result is a fitted change in valid response time, expressed in milliseconds per elapsed minute. It remains unavailable below 24 valid responses or when any block contains fewer than three. Median response time, variability, responses at or above the declared 500 millisecond threshold, false starts, timeouts, and valid counts by block remain separate. Vigilance research supports response-time distributions and time-on-task trends as observations. A short mobile run cannot determine whether a change came from sleep, fatigue, motivation, boredom, context, or device input, and it does not establish a stable endurance trait or late-game transfer. [cite:31,32]

## 5.4 The Initial Simulation Portfolio

The initial simulation library covers the three pillars with a small, coherent set of serious simulation families.

Reset rehearses and observes task re-entry after a controlled interruption.

Noise Gate rehearses visible-target search with a controlled distractor.

Brake Point rehearses go responses and stopping after a delayed signal.

Signal Window rehearses perceptual majority decisions at balanced evidence levels.

Sequence Shift rehearses switching between two cued classification rules.

Endurance Lock observes performance across time while the visual task remains constant.

Together, these families provide a bounded starting portfolio of cognitive-perceptual task practice. Their construct and sport-transfer hypotheses remain subject to reliability, validity, and transfer studies; breadth of family coverage is not evidence of efficacy.

# 6. Curriculum, Mastery, and Automaticity

PulseCheck is not a one-day recommendation engine. It is a curriculum model.

## 6.1 The Six-Exercise Active Slate

The curriculum layer keeps six active exercises in flight for each athlete:

- Three protocols for mental regulation, priming, or recovery.
- Three simulations for mental sharpening and measurement.

This slate gives the athlete a living toolkit. They are not waiting until a competition day to try breathing, reframing, visualization, cue-word anchoring, Reset, Noise Gate, or Signal Window for the first time. They are training the same tools across days and weeks until the tools become familiar, fast, and available.

The slate also solves a practical coaching problem. If the system assigns only one protocol and one simulation at a time, the athlete may become too narrow. They might improve one skill while neglecting the broader toolkit needed for competition. A six-exercise slate keeps mental training broad enough to build range while still focused enough to avoid overload.

Six is a design constraint, not a claim that the number is biologically magic. Working-memory research suggests that people can hold only a small number of active items in attention at once, and choice-overload research shows that large option sets can reduce follow-through when the decision context is uncertain. [cite:20,21] At the same time, skill durability depends on revisiting material across time rather than cramming it into a single exposure. [cite:22]

The six-exercise slate therefore balances three demands. It is small enough for an athlete and coach to understand quickly. It is broad enough to keep regulation, priming, recovery, and cognitive-perceptual challenge in the same training plan. And it is stable enough for repeated exposure, so Nora can observe whether practice is producing mastery instead of constantly chasing novelty.

## 6.2 Mastery and Rotation

Each active exercise has a mastery model. Mastery does not mean perfection. It means the athlete has shown enough reliable performance, completion quality, and state-fit evidence that the exercise can graduate from active curriculum emphasis.

For protocols, mastery may include completion consistency, technique fidelity, athlete-reported state shift, state snapshot movement, and improved downstream simulation quality.

For simulations, mastery may include stable skill score improvement, raw metric reliability, lower variance, improved performance under modifiers, and reduced degradation across time.

When an exercise reaches mastery, Nora rotates the mastered exercise into maintenance or periodic reassessment and brings in the next best protocol or simulation. This keeps the curriculum alive. The athlete's toolkit expands, and the active slate continues to match current needs.

## 6.3 How Automaticity Develops

Automaticity develops through repeated, context-linked practice. A response becomes easier to retrieve when the athlete has encountered the cue many times and practiced the response in enough relevant conditions. [cite:9,10,11,12]

PulseCheck supports this in three ways.

First, protocols create compact state-response mappings. Box Breathing maps a steadying need to a known breathing cadence. Cognitive Reframing maps pressure sensations to challenge language. Visualization maps a coming action to a refreshed internal model. Cue-Word Anchoring maps a short phrase to a trained attentional target.

Second, simulations can create labeled context exposure while preserving the canonical task contract. An athlete can practice the same response in a reference condition and in a compatible challenge condition. PulseCheck can compare behavior within those specified conditions; it cannot assume that a task difference represents pressure tolerance or that improvement will transfer to competition.

Third, curriculum creates spacing and recurrence. Skills become more durable when they are revisited across time instead of crammed into one intense session. The six-exercise slate gives Nora a way to balance repetition, variation, state fit, and progression.

The goal is not to make the athlete robotic. The goal is to make useful responses more available. When pressure reduces working memory and increases attentional capture, the athlete should not have to search for a strategy from scratch. The body and mind should recognize the cue and move toward the practiced response.

## 6.4 Competition-Day Retrieval

Competition day is not the best time to learn a mental tool. It is the time to retrieve one.

That is why a curriculum matters. A breathing protocol becomes useful because the athlete has already practiced it. A reframe becomes useful because the athlete has already attached pressure sensations to challenge language. A visualization sequence becomes useful because the athlete has already rehearsed the desired action. A cue word becomes useful because it has already been connected to focus.

The same principle applies to simulations as a practice hypothesis. Reset rehearses re-entry into the same task after interruption. Noise Gate rehearses locating a visible target while a distractor competes for attention. Brake Point rehearses withholding after a delayed stop signal. Endurance Lock repeats one constant visual response rule across time. These tasks can make the demand familiar; whether that familiarity improves competitive execution must be tested in representative sport tasks.

The curriculum is therefore not a content schedule. It is an automaticity engine. It turns protocols and simulations into practiced responses that the athlete can retrieve under load.

# 7. Nora Planning and Training Plan Architecture

Nora is the adaptive planning engine for PulseCheck. Nora operates as a bounded planner: it reads state, profile, curriculum, protocol responsiveness, simulation outcomes, coach constraints, and candidate availability, then chooses the next useful action from approved protocol and simulation inventory.

## 7.1 Assignment Outcomes

The six-exercise active slate remains the curriculum backbone. Nora's assignment outcomes describe the real-time chat layer that sits alongside that curriculum. When an athlete talks with Nora before practice, after a difficult session, during competition prep, or inside a coach-defined training window, Nora can assign an additional immediate action based on real-time need.

That chat-time decision leans on what the system already knows about the athlete: which protocols have felt effective, which simulations reveal pressure bottlenecks, where protocol responsiveness is strongest, how recent simulation and protocol work has trended, what the athlete is saying in the conversation, what biometric markers are available from connected sports performance devices, and what context coaches have provided about competition schedule, training load, team rules, and situational constraints.

Inside that real-time layer, Nora can choose several assignment outcomes:

- Protocol only, when current state is the primary bottleneck.
- Simulation only, when state is workable and skill challenge is the right next action.
- Trial only, when standardized assessment timing and state fit are both appropriate.
- Protocol into simulation, when a short state intervention is likely to improve the quality of the following challenge.
- Simulation into protocol, when the challenge remains useful but a downshift or recovery step should follow.
- Defer or alternate path, when safety, support, state, or context makes normal training inappropriate.

This matters because the curriculum gives the athlete a stable training base, while the chat layer lets Nora respond to the moment. The system avoids forcing a high-pressure simulation when the athlete is not in a usable state, and it avoids deferral when a bounded protocol can still create a productive path.

## 7.2 DailyTask and TrainingPlan

The runtime separates date-specific execution from longer-horizon programming.

DailyTask is the execution truth. It answers what the athlete is doing on a specific date, what state the assignment is in, why Nora assigned it, and what happened when it was completed.

TrainingPlan is the programming truth. It answers what Nora is building over time, where the athlete is in the sequence, and how the current block should progress.

This separation prevents a common product problem: daily recommendations can feel coherent while the broader training room feels hollow. A true mental training system needs both the daily assignment and the authored curriculum block.

## 7.3 Plan Types

The plan model supports four plan types.

Sim-focused plans are used when the athlete is stable enough to train skill directly and the primary bottleneck is executional.

Protocol-focused plans are used when regulation, priming, or recovery must stabilize the athlete before harder skill work can be useful.

Mixed plans are used when state and skill both matter and the athlete needs protocol-to-simulation sequencing.

Assessment plans are used for baseline, reassessment, or measurement-calibration windows. They are not diagnostic evaluations.

The six-exercise active slate sits inside this larger plan architecture. A plan defines the development goal. The slate defines the active toolkit Nora is building and rotating as mastery emerges.

# 8. Physiology-Cognition Roadmap

The physiology-cognition correlation engine connects body-state evidence with mental performance evidence.

The product edge is not simply that PulseCheck can connect wearable data. Wearables can see aspects of the body. Simulations can measure aspects of mental performance. The differentiated opportunity is joining those evidence streams to learn how a specific athlete's mental performance behaves under different body states.

The engine models personal thresholds, confidence, freshness, and state-performance relationships. It asks questions like:

- Does this athlete's focus stability change when sleep is short?
- Does reset speed degrade when recovery markers are below personal baseline?
- Does pressure sensitivity increase when resting heart rate is elevated?
- Which protocol tends to help when the athlete is in a specific physiological posture?

No single wearable is the engine. Polar is the signature sports-performance lane because its direct device path can contribute training, exertion, live heart-rate or RR evidence, activity samples, and session context. Apple Watch and HealthKit provide the baseline iOS wearable and health-platform lane. Oura contributes a strong sleep and recovery lane through direct API support or HealthKit fallback. Fitbit Air and the broader Fitbit lane contribute post-sync sleep, heart-rate, activity, biometrics, and recovery context through Google Health. Each source has different strengths, timing, freshness, and limitations, so PulseCheck normalizes them into the same health-context record model before the correlation engine uses them.

The language must stay honest. These are correlations unless stronger evidence supports causal claims. PulseCheck may learn that an athlete usually performs better inside a certain recovery band, or that a specific protocol tends to help under a specific body-state pattern. It should not pretend that wearable data alone decides training. Body-state evidence informs interpretation; PulseCheck still needs simulation outcomes, protocol evidence, athlete feedback, and coaching context.

# 9. Scientific Evidence Framework and Validation

PulseCheck uses an evidence framework because citations alone are not enough. A scientific paper can support a mechanism without validating a specific product implementation.

The system distinguishes between:

- Mechanism support: published evidence supports the underlying cognitive, physiological, or behavioral mechanism.
- Implementation conformance: the released task follows its locked schedule, timing, event, exclusion, and calculation contract.
- Measurement validity: reliability and construct-validity studies support the interpretation of a PulseCheck task result.
- Transfer validity: improvements generalize to higher-fidelity environments or real-world performance contexts.
- Protocol effectiveness: a protocol produces the intended state shift and improves the usefulness of downstream execution.
- Curriculum effectiveness: the system's plan structure improves durability, adherence, automaticity, and performance over time.

## 9.1 Evidence Map

The evidence posture should be visible at the level of each major product claim. This keeps the paper from blending established science, plausible design translation, and unproven implementation outcomes into one overconfident story.

| Product claim | Mechanism support | PulseCheck implementation | Current evidence posture | Next validation step |
| --- | --- | --- | --- | --- |
| Protocols can help athletes shift state before or after demanding moments. | Slow breathing, reappraisal, self-talk, and imagery have mechanism-level and intervention support. [cite:16,17,18,19] | Published protocol registry, target state shifts, bounded practice, pre/post state capture, downstream simulation comparison. | Mechanism-supported. Product-specific effectiveness still needs pilot data. | Compare protocol-to-simulation sequences against simulation-only assignments within similar state windows. |
| Simulations can create repeatable task practice and task-specific behavioral observations. | Attentional control, visual search, stop-signal, perceptual-decision, task-switching, and vigilance research support the family hypotheses, while cognitive-training research warns that transfer is not automatic. [cite:1,5,9,23,24,25,26,27,28,29,30,31,32,33] | Six locked task contracts with practice exclusion, balanced or matched schedules, a 150 millisecond response-time artifact floor, explicit minimum-data rules, and separate accuracy, timing, premature-response, and timeout metrics. | Implementation-conformant and evidence-informed. Product-specific reliability, construct validity, and transfer validity are not yet established. | Run cross-platform timing calibration, shared golden fixtures, test-retest studies, convergent-validity studies, and representative sport-transfer studies. |
| A small active slate can support automaticity without overwhelming the athlete. | Automatic processing, working-memory limits, choice-overload findings, and distributed practice support compact recurring practice. [cite:9,10,11,12,20,21,22] | Three active protocols plus three active simulations, with mastery, maintenance, and rotation. | Design-supported. The exact slate size should remain adjustable if pilot evidence shows a better operating range. | Track adherence, mastery speed, retention, and athlete-reported usability across different slate sizes. |
| State-aware planning should improve assignment fit. | Self-regulation and pressure-performance research support matching interventions to state, but assignment logic must be validated. [cite:2,3,17] | Nora reads state snapshots, profile history, protocol responsiveness, simulation outcomes, and coach constraints before choosing from approved inventory. | Strong product hypothesis. It should not be framed as proven personalization until compared against simpler rules. | Compare state-aware planning against static curriculum and coach-selected assignment baselines. |
| Physiology can improve interpretation of mental performance data. | Wearables can inform body-state context, but body-state relationships should be treated as correlations unless stronger designs support causal claims. | Health-context records, source freshness, personal thresholds, simulation outcomes, and protocol responsiveness feed the correlation roadmap. | Correlation-only roadmap. Useful for interpretation, not standalone readiness authority. | Run preregistered pilot analyses that control for sleep, training load, injury status, sport, and schedule context. |

Validation must also include pilot outcome metrics. Enrollment, adherence, mental performance improvement, escalations, speed to care, trust, and recommendation intent all matter. A mental training system that produces scores but loses athlete trust is not succeeding.

For research readouts, PulseCheck uses frozen evidence frames. A readout locks to one pilot, one date window, one cohort filter, one read-model version, and one set of metrics. Claims are tagged as observed, inferred, or speculative. Unsupported sections are suppressed rather than dressed up with confident language. Human review remains the authority before stronger claims become official.

This is not just legal caution. It is scientific discipline. The system earns its claims.

## 9.2 Cross-Platform Implementation Status

The six canonical tasks and their calculation rules are implemented on web, iOS, and Android. Source-level agreement and automated fixtures verify that the intended formulas and minimum-data rules are represented in each codebase. They do not prove that browser and device timing are equivalent or that the tasks have psychometric validity.

Noise Gate's visual condition is implemented across all three platforms. Web and iOS also support separately labeled audio and combined conditions; Android audio and combined-channel parity remains future work. Until a shared device-timing study and cross-platform golden-fixture program are complete, platform and input method remain part of the recorded context and cross-platform scores should not be treated as interchangeable.

# 10. Why This Architecture Over Alternatives

The decision to build PulseCheck as protocols plus simulations reflects a belief about what mental performance training actually needs.

A content library can teach concepts, but it does not know whether the athlete can apply them under pressure.

A meditation app can support calm, but competition often requires usable activation, not simply relaxation.

A chatbot can personalize language, but conversation alone does not create measurable skill acquisition.

A generic brain-training game can improve the practiced task, but may not train state regulation or sport-relevant pressure response.

PulseCheck combines the missing pieces. Protocols give the athlete concrete state tools. Simulations create instrumented task practice. Nora ties both to state, profile, and curriculum. The active slate turns one-off assignments into repeated practice. The validation layer keeps claims constrained by evidence.

# 11. What We Are Not Claiming

PulseCheck is not claiming that the full system has already been validated through randomized controlled trials. The claims in this paper are structural and mechanistic. Efficacy claims must follow data.

PulseCheck is not claiming that simulation gains automatically transfer to competition. Transfer is a documented limitation in cognitive training. The system is designed with transfer studies in mind, but transfer has to be tested in representative sport tasks. [cite:23,33]

PulseCheck is not claiming that a simulation result diagnoses a condition, measures brain change, reveals a stable personality or cognitive trait, or determines readiness. The family names are training language; the task-level observations and their limits govern interpretation.

PulseCheck is not claiming that the standard Brake Point rep produces a valid individual stop-time estimate. Its core result is stop success alongside go accuracy and correct go response time. Research-length estimates remain gated by trial-count and quality requirements.

PulseCheck is not claiming that an Endurance Lock trend proves fatigue. It is a within-session performance trend on a constant visual task, and the task cannot determine why behavior changed.

PulseCheck is not claiming that protocols replace sport psychology, therapy, medical care, or human coaching. Protocols are performance-state interventions. They can complement professional support, but they do not replace clinical or relational work.

PulseCheck is not claiming that wearable data determines athlete readiness by itself. Physiology informs the model. It does not own the decision.

PulseCheck is not claiming that all mental performance reduces to cognition. Sleep, nutrition, identity, environment, coaching, team dynamics, injury, stress, and life context all matter. PulseCheck trains a defined layer: state regulation, cognitive-perceptual skill, pressure response, and curriculum-based automaticity.

# 12. Looking Ahead

PulseCheck is designed as a curriculum-based mental performance system. It keeps a balanced active slate of protocols and simulations, rotates exercises as mastery emerges, learns protocol responsiveness by athlete, connects state and body-context signals carefully, and validates claims through governed pilot evidence.

The long-term vision is not a mental performance content app. It is a training operating system for the mental side of sport.

Athletes do not only need insight. They need practiced responses. They need state tools that are ready before competition. They need simulations that reveal whether those tools hold under pressure. They need a curriculum that builds automaticity without overloading them. And they need a system honest enough to say what it knows, what it suspects, and what it has not proven yet.

Mental performance training deserves the same rigor as physical performance training. PulseCheck is an attempt to provide it.

:::references
[1] Eysenck, M. W., Derakshan, N., Santos, R., & Calvo, M. G. (2007). Anxiety and cognitive performance: Attentional control theory. Emotion, 7(2), 336-353.
[2] Eysenck, M. W., & Calvo, M. G. (1992). Anxiety and performance: The processing efficiency theory. Cognition & Emotion, 6(6), 409-434.
[3] Meichenbaum, D. (1985). Stress Inoculation Training. Pergamon Press.
[4] Miyake, A., Friedman, N. P., Emerson, M. J., Witzki, A. H., Howerter, A., & Wager, T. D. (2000). The unity and diversity of executive functions and their contributions to complex frontal lobe tasks: A latent variable analysis. Cognitive Psychology, 41(1), 49-100.
[5] Posner, M. I., & Petersen, S. E. (1990). The attention system of the human brain. Annual Review of Neuroscience, 13, 25-42.
[6] Nideffer, R., & Sagal, M. (2006). Concentration and attention control training. In J. M. Williams (Ed.), Applied Sport Psychology (pp. 382-403). McGraw-Hill.
[7] APA Division 47. (2014). Concentration and Attention in Sport. Sport Psychology Works Fact Sheet.
[8] United States Olympic Committee, Performance Services Division. (2008). Sport Psychology Mental Training Manual.
[9] Schneider, W., & Shiffrin, R. M. (1977). Controlled and automatic human information processing: I. Detection, search, and attention. Psychological Review, 84(1), 1-66.
[10] Shiffrin, R. M., & Schneider, W. (1977). Controlled and automatic human information processing: II. Perceptual learning, automatic attending, and a general theory. Psychological Review, 84(2), 127-190.
[11] Logan, G. D. (1988). Toward an instance theory of automatization. Psychological Review, 95(4), 492-527.
[12] Fitts, P. M., & Posner, M. I. (1967). Human Performance. Brooks/Cole.
[13] Beilock, S. L., & Carr, T. H. (2001). On the fragility of skilled performance: What governs choking under pressure? Journal of Experimental Psychology: General, 130(4), 701-725.
[14] Masters, R. S. W. (1992). Knowledge, knerves and know-how: The role of explicit versus implicit knowledge in the breakdown of a complex motor skill under pressure. British Journal of Psychology, 83(3), 343-358.
[15] Wulf, G., & Prinz, W. (2001). Directing attention to movement effects enhances learning: A review. Psychonomic Bulletin & Review, 8(4), 648-660.
[16] Ma, X., Yue, Z. Q., Gong, Z. Q., Zhang, H., Duan, N. Y., Shi, Y. T., Wei, G. X., & Li, Y. F. (2024). The effect of slow-paced breathing on cardiovascular and emotion functions: A meta-analysis and systematic review. Mindfulness, 15, 1-18.
[17] Brooks, A. W. (2014). Get excited: Reappraising pre-performance anxiety as excitement. Journal of Experimental Psychology: General, 143(3), 1144-1158.
[18] Hatzigeorgiadis, A., Zourbanos, N., Galanis, E., & Theodorakis, Y. (2011). Self-talk and sports performance: A meta-analysis. Perspectives on Psychological Science, 6(4), 348-356.
[19] Liu, Y., Zhao, S., Zhang, X., Zhang, X., Liang, T., & Ning, Z. (2025). The effects of imagery practice on athletes' performance: A multilevel meta-analysis with systematic review. Behavioral Sciences, 15(5), 685.
[20] Cowan, N. (2001). The magical number 4 in short-term memory: A reconsideration of mental storage capacity. Behavioral and Brain Sciences, 24(1), 87-185.
[21] Iyengar, S. S., & Lepper, M. R. (2000). When choice is demotivating: Can one desire too much of a good thing? Journal of Personality and Social Psychology, 79(6), 995-1006.
[22] Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. Psychological Bulletin, 132(3), 354-380.
[23] Harris, D. J., Wilson, M. R., & Vine, S. J. (2018). A systematic review of commercial cognitive training devices: Implications for use in sport. Frontiers in Psychology, 9, 709.
[24] Verbruggen, F., Aron, A. R., Band, G. P. H., Beste, C., Bissett, P. G., Brockett, A. T., et al. (2019). A consensus guide to capturing the ability to inhibit actions and impulsive behaviors in the stop-signal task. eLife, 8, e46323.
[25] Logan, G. D., Cowan, W. B., & Davis, K. A. (1984). On the ability to inhibit simple and choice reaction time responses: A model and a method. Journal of Experimental Psychology: Human Perception and Performance, 10(2), 276-291.
[26] Palmer, J., Huk, A. C., & Shadlen, M. N. (2005). The effect of stimulus strength on the speed and accuracy of a perceptual decision. Journal of Vision, 5(5), 376-404.
[27] Rogers, R. D., & Monsell, S. (1995). Costs of a predictable switch between simple cognitive tasks. Journal of Experimental Psychology: General, 124(2), 207-231.
[28] Meiran, N. (1996). Reconfiguration of processing mode prior to task performance. Journal of Experimental Psychology: Learning, Memory, and Cognition, 22(6), 1423-1442.
[29] Notebaert, W., Houtman, F., Van Opstal, F., Gevers, W., Fias, W., & Verguts, T. (2009). Post-error slowing: An orienting account. Cognition, 111(2), 275-279.
[30] Dutilh, G., Vandekerckhove, J., Forstmann, B. U., Keuleers, E., Brysbaert, M., & Wagenmakers, E.-J. (2012). Testing theories of post-error slowing. Attention, Perception, & Psychophysics, 74(2), 454-465.
[31] Dinges, D. F., & Powell, J. W. (1985). Microcomputer analyses of performance on a portable, simple visual response-time task during sustained operations. Behavior Research Methods, Instruments, & Computers, 17, 652-655.
[32] Van Dongen, H. P. A., Maislin, G., Mullington, J. M., & Dinges, D. F. (2003). The cumulative cost of additional wakefulness: Dose-response effects on neurobehavioral functions and sleep physiology from chronic sleep restriction and total sleep deprivation. Sleep, 26(2), 117-126.
[33] Owen, A. M., Hampshire, A., Grahn, J. A., Stenton, R., Dajani, S., Burns, A. S., et al. (2010). Putting brain training to the test. Nature, 465, 775-778.
:::
`;

export const getResearchArticleOverride = (slug: string): ResearchArticleOverride | null => {
  if (slug === AUNTEDNA_ESCALATION_WHITE_PAPER_SLUG) {
    return {
      ...AUNTEDNA_ESCALATION_WHITE_PAPER_METADATA,
      content: AUNTEDNA_ESCALATION_WHITE_PAPER_CONTENT,
    };
  }

  if (slug !== TRAINING_MENTAL_GAME_WHITE_PAPER_SLUG) return null;

  return {
    ...TRAINING_MENTAL_GAME_WHITE_PAPER_METADATA,
    content: TRAINING_MENTAL_GAME_WHITE_PAPER_CONTENT,
  };
};

export const getLocalResearchArticleListItems = () => [
  {
    slug: AUNTEDNA_ESCALATION_WHITE_PAPER_SLUG,
    ...AUNTEDNA_ESCALATION_WHITE_PAPER_METADATA,
  },
  {
    slug: TRAINING_MENTAL_GAME_WHITE_PAPER_SLUG,
    ...TRAINING_MENTAL_GAME_WHITE_PAPER_METADATA,
  },
];

export const applyResearchArticleListOverride = <T extends { slug: string }>(article: T): T => {
  const override = getResearchArticleOverride(article.slug);
  if (!override) return article;

  const {
    content: _content,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    publishedAt: _publishedAt,
    status: _status,
    featured: _featured,
    ...metadata
  } = override;
  return {
    ...article,
    ...metadata,
  };
};
