export const TRAINING_MENTAL_GAME_WHITE_PAPER_SLUG =
  'training-the-mental-game-a-simulation-based-architecture-for-mental-performance-in-sport';

export const TRAINING_MENTAL_GAME_WHITE_PAPER_METADATA = {
  title: 'Training the Mental Game: A Protocol and Simulation Architecture for Mental Performance in Sport',
  subtitle:
    'How Pulse Check combines state-regulation protocols, pressure simulations, curriculum planning, and automaticity science to build a structured mental training system for athletes.',
  excerpt:
    'A white paper on Pulse Check as a two-lane mental performance system: protocols for regulation, simulations for sharpening, and curriculum that builds automaticity over time.',
  category: 'Performance Science',
  readTime: '34 min read',
  contentType: 'white-paper' as const,
  featuredImage: '/research-training-mental-game-white-paper.webp',
};

export const TRAINING_MENTAL_GAME_WHITE_PAPER_CONTENT = `
:::abstract
Mental performance is widely acknowledged as a critical factor in athletic competition, yet the tools available to train it have not kept pace with the systems used to develop physical capacity. Most existing approaches fall into one of two categories: clinical sport psychology delivered through conversation, or consumer-facing brain training apps built on generic cognitive tasks with limited evidence of transfer to sport-specific contexts. Neither approach provides athletes and coaches with a structured, measurable, progressive training system for the cognitive-perceptual and state-regulation skills that determine performance under pressure.

This paper introduces Pulse Check as a protocol and simulation architecture for mental performance training. The system operates through two coordinated lanes. Protocols are bounded mental regulation, priming, and recovery interventions that help an athlete change state before, between, or after demanding performance moments. Simulations are instrumented pressure-training environments that sharpen and measure Focus, Composure, and Decision skills under controlled challenge. Nora, the adaptive planning engine, reads state signals, profile history, protocol responsiveness, simulation outcomes, and curriculum progress before assigning the next useful action.

The core thesis is that athletes do not need a one-day competition trick. They need a curriculum that builds automaticity over time. Pulse Check therefore keeps a small active slate of protocols and simulations in flight, rotates them as mastery emerges, and uses repeated, state-aware practice to make useful responses easier to retrieve when pressure taxes attention. This paper describes the scientific foundations, system architecture, protocol and simulation design principles, curriculum model, automaticity framework, physiology-cognition roadmap, and validation discipline that govern Pulse Check.
:::

# 1. The Problem: Mental Performance Without a Training System

Every serious athlete knows that the mental side of competition matters. Coaches say it constantly. Commentators invoke it after every collapse or comeback. Athletes feel it in the body: the tight chest before a decisive attempt, the tunnel vision after a mistake, the noisy mind when a simple choice suddenly feels expensive.

But when you ask a practical question, the answer is often vague. How, exactly, do you train focus? How do you build composure so it appears under pressure, not just during calm reflection? How do you make a reset response available when the athlete has seconds, not minutes? How does a coach know whether mental training is progressing?

Physical performance has mature training systems. Strength coaches operate within periodized blocks. Speed development follows technical progressions. Conditioning programs are built around energy systems, load, recovery, and adaptation. There is a shared language, a structured methodology, measurable outputs, and a progression model that adapts to the individual athlete.

The mental side of sport is usually less organized. Sport psychology has produced decades of valuable research on attentional control, anxiety, stress inoculation, executive function, imagery, self-talk, and pressure performance. But the translation of that research into daily, accessible, measurable training has been uneven. Most athletes encounter mental performance support in one of three ways: periodic conversation with a professional, coach-delivered motivational language, or generic cognitive tasks packaged as performance training.

None of those approaches, by themselves, create a complete training system. A conversation can be powerful, but it is not the same as instrumented practice. A breathing exercise can help, but it does not automatically become available under pressure unless it is rehearsed and embedded into the athlete's performance routine. A generic reaction game may improve performance on that game without teaching the athlete how to regulate state or execute inside sport-relevant pressure.

Pulse Check addresses that gap by combining two complementary forms of training. Simulations create serious mental training environments that target and measure cognitive-perceptual skills under controlled stress. Protocols provide bounded mental interventions that help athletes regulate, prime, recover, and apply the right state before a simulation, trial, practice exposure, or competition moment.

Pulse Check is a protocol and simulation system. Protocols help the athlete change state. Simulations test and sharpen execution under pressure. Curriculum ties both together over time so the athlete is not hoping to remember a tool on competition day; they are building a practiced response that has already been rehearsed, measured, and refined.

# 2. Scientific Foundations

Pulse Check is not built on one theory. It draws from several research traditions that collectively describe how attention, control, state, pressure, learning, and automaticity interact in athletic performance. The system does not claim that its full implementation has already been validated through randomized controlled trials. That work must be earned. What the system does claim is that its design choices are grounded in established science and that its evidence model separates mechanism support from implementation validation.

## 2.1 Attentional Control Theory

Attentional Control Theory, developed by Eysenck, Derakshan, Santos, and Calvo, provides one of the primary theoretical backbones of Pulse Check. The theory argues that anxiety disrupts the balance between two attentional systems: a goal-directed system that keeps attention on task-relevant information, and a stimulus-driven system that pulls attention toward threat, distraction, and irrelevant cues. [cite:1,2]

Under pressure, the stimulus-driven system gains influence. The athlete may know what matters, but attention becomes easier to capture. The mind searches for threat, the body reacts to urgency, and execution quality can degrade. This is not a lack of character. It is a predictable shift in cognitive control.

Pulse Check simulations train this directly. Noise Gate asks whether an athlete can keep the right signal active while irrelevant stimuli compete for attention. Reset asks whether the athlete can return to goal-directed focus after disruption. Signal Window and Sequence Shift ask whether the athlete can read, update, and act while time and ambiguity compress the decision window.

## 2.2 Stress Inoculation Training

Stress Inoculation Training, associated with Meichenbaum, provides the pedagogical logic for pressure exposure. The core principle is that controlled, graduated exposure to stressors, paired with skill rehearsal, can build more stable performance when real stressors appear. [cite:3]

In Pulse Check, this appears through modifiers and curriculum progression. The system does not simply make tasks harder. It changes the psychological context: time pressure, evaluative threat, ambiguity, distraction, consequence, and fatigue load. The goal is not to eliminate stress. The goal is to build the capacity to perform through it.

This matters because competition does not wait until the athlete feels perfectly calm. A useful mental training system has to teach athletes how to regulate when regulation is needed, and how to execute when stress remains present.

## 2.3 Executive Function Research

The executive function framework, particularly the model proposed by Miyake and colleagues, identifies inhibition, shifting, and updating as core cognitive control processes. These are directly relevant to sport. [cite:4]

Inhibition helps an athlete resist the wrong response, ignore a tempting decoy, or stop an error from cascading. Shifting helps attention move from disruption back to the next useful target. Updating helps the athlete refresh working memory when rules, reads, or conditions change. Pulse Check maps these functions into trainable skill families instead of treating cognition as one generic score.

## 2.4 Automaticity and Procedural Learning

Automaticity is the process by which a skill moves from slow, deliberate, attention-heavy control into fast, efficient, cue-triggered execution. In early learning, the athlete has to think through each step. With practice, the response becomes more fluent. The relevant cue appears, and the trained action or mental response becomes easier to access without consuming the same amount of working memory.

This is not magic and it is not mindlessness. Automaticity is learned efficiency. Schneider and Shiffrin's work on controlled and automatic processing showed that consistent practice can change how much conscious control a task requires. Logan's instance theory argues that automaticity develops as repeated encounters build stored instances that can be retrieved quickly. Motor learning models, including Fitts and Posner's stages of skill acquisition, similarly describe movement from cognitive effort to more autonomous execution. [cite:9,10,11,12]

For athletes, this is critical because pressure taxes working memory and attention. When a skill still requires heavy conscious control, pressure can interfere with execution. When a skill has become more automatic, the athlete has more attentional capacity available for reading the environment, adapting, and staying present.

Mental skills can follow a similar pattern. A breathing pattern, reframe, cue word, visualization sequence, or reset routine is not most useful when the athlete can explain it calmly. It is most useful when the body and mind can access it quickly under pressure. Pulse Check curriculum exists to build that availability.

## 2.5 Choking, Explicit Monitoring, and Pressure

Research on choking under pressure adds a warning. Well-learned skills can break down when athletes over-monitor them. Beilock and Carr's work on skilled performance and Masters' work on explicit versus implicit knowledge both support the idea that pressure can pull attention inward, causing athletes to consciously control processes that usually run more fluidly. [cite:13,14]

Pulse Check does not want athletes to memorize long scripts in the middle of competition. It wants them to build compact, practiced responses. A cue word should point attention toward the right target. Box breathing should steady the body without turning into a complicated counting task. A reset sequence should help the athlete return to execution, not trap them in self-analysis. [cite:15,18]

This is why the system pairs protocols and simulations. Protocols teach the response. Simulations test whether the response survives pressure, distraction, and time compression.

## 2.6 Sport-Specific Attention Research

Posner and Petersen's model of attention supports the idea that attention is not one thing. It includes alerting, orienting, and executive control. Applied sport psychology work, including Nideffer and Sagal's attention-control framing and USOC mental training materials, reinforces that attention in sport is directional, contextual, and trainable. [cite:5,6,7,8]

Pulse Check's Focus, Composure, and Decision pillars translate those ideas into product architecture. The system uses coaching-friendly language at the top, but keeps research-grounded skill definitions and raw metrics underneath.

# 3. The Pulse Check System Architecture

Pulse Check is organized around a formal architecture that defines what is being trained, how state is interpreted, how assignments are selected, how progress is measured, and how evidence claims are governed.

## 3.1 Two Sibling Lanes: Protocols and Simulations

The central architectural principle is the separation between protocols and simulations.

Protocols are bounded state interventions. They are not lightweight content cards and they are not simulation variants. A protocol exists to change athlete state so a following action becomes more useful. It may regulate overactivation, prime readiness, narrow attention, build confidence, rehearse imagery, or support recovery. Each protocol needs a mechanism, use window, expected state shift, contraindications, evidence posture, and runtime eligibility.

Simulations are instrumented mental performance challenges. They create controlled environments where Focus, Composure, and Decision skills can be sharpened and measured. Each simulation has a family, variants, mechanics, score outputs, modifier compatibility, difficulty rules, and evidence status.

The two lanes are siblings. Protocols regulate or prepare the state. Simulations challenge and measure execution. Nora can assign one alone or sequence them together when the athlete needs both.

## 3.2 Protocol System

The protocol system uses a family, variant, and runtime record model. A protocol family defines the conceptual intervention lane, such as steady regulation, cognitive reframe, imagery priming, or focus narrowing. A protocol variant defines a designed expression of that family, such as Box Breathing, Nerves to Excitement, Perfect Execution Replay, or Cue-Word Anchoring. A published runtime record defines what Nora is actually allowed to assign.

This distinction matters because a protocol should not become available simply because someone wrote good copy. It must be structured, reviewed, bounded, and governed. The protocol governance model tracks evidence, misuse risk, target state shift, trigger tags, avoid windows, publish status, revision lineage, and effectiveness signals.

In practice, this means Nora does not invent interventions at runtime. Nora chooses from a bounded registry of published protocols that the system knows how to deliver and audit.

## 3.3 Simulation System

The simulation system is organized around six locked initial families:

- Reset: mental recovery after disruption, measuring how quickly and cleanly the athlete returns to goal-directed execution.
- Noise Gate: selective attention under escalating irrelevant stimuli.
- Brake Point: response inhibition and cancellation of the wrong action.
- Signal Window: signal discrimination under compressed time and incomplete information.
- Sequence Shift: working-memory updating and task switching under load.
- Endurance Lock: sustained attention, fatigability, and late-session deterioration.

Each family can have variants, sport-context expressions, pressure modifiers, and assessment modes. The system can expand, but expansion is governed. Additional families must demonstrate that they are meaningfully distinct from established families rather than merely a different visual wrapper.

## 3.4 Three Pillars: Focus, Composure, Decision

At the coaching layer, Pulse Check organizes mental performance into three durable pillars.

Focus is the ability to direct, sustain, and shift attention toward task-relevant information while resisting distraction or internal noise.

Composure is the ability to maintain execution quality under pressure, recover quickly from disruption, and prevent emotional load from degrading performance.

Decision is the ability to process information, inhibit the wrong response, update priorities, and act under uncertainty and time pressure.

These pillars are intentionally stable. They give athletes and coaches a shared vocabulary while allowing the underlying skill map and measurement model to remain more granular.

## 3.5 State Signal Layer

Pulse Check does not assign work from profile history alone. It reads current state first.

The State Signal Layer collects self-report, conversation signals, performance patterns, context, biometrics when available, execution events, and coach constraints. It then builds a shared state snapshot that captures activation, focus readiness, emotional load, cognitive fatigue, overall readiness, confidence, freshness, and recommended routing posture.

This is important because two athletes can both look "Yellow" but need different actions. One may be overactivated and need regulation. Another may be flat and need priming. A third may be cognitively depleted and need recovery or a lower-load assignment. The state layer preserves the underlying pattern instead of collapsing everything into one readiness label.

## 3.6 Score Architecture and Modifiers

Pulse Check's score system operates in layers. At the top are pillar composites for Focus, Composure, and Decision. Beneath them are skill scores, such as selective attention, error recovery speed, pressure stability, response inhibition, working-memory updating, and signal discrimination. Beneath those are raw metrics: response time, accuracy, false starts, recovery latency, variance, degradation slope, and modifier-stratified performance.

Modifiers change the psychological context of a simulation without changing the underlying target skill. Time pressure, evaluative threat, ambiguity, distraction, fatigue load, and consequence allow the system to distinguish baseline ability from pressure-sensitive performance.

# 4. Protocol Design Principles

Protocols are the mental regulation side of Pulse Check. They teach athletes what to do with state.

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

Simulations are the mental sharpening side of Pulse Check. They create controlled, instrumented challenges that let the system train and measure cognitive-perceptual skills under pressure.

## 5.1 The Sim Specification Template

Every simulation is authored against a specification template. A valid simulation must define its primary pillar, target skills, underlying mechanism, scientific basis, game flow, scoring model, raw metrics, modifier compatibility, difficulty progression, session validity rules, and evidence status.

This prevents the most common failure mode in cognitive training products: building something that feels engaging but has no clear connection to a trainable mechanism or no way to evaluate transfer. Pulse Check simulations should feel like training, not entertainment with a performance label.

## 5.2 Example: The Reset Switch

The Reset Switch is the flagship Reset-family simulation. It is a mental recovery training simulation that asks one essential question: how fast and how cleanly can the athlete recover after something goes wrong?

The simulation follows a three-phase loop.

Lock In establishes a sustained attention task. The athlete narrows attention and performs a simple but measurable action with rhythm, target tracking, or sequence control.

Disruption breaks that focus without warning. The system may introduce visual noise, audio interference, cognitive provocation, rule change, or combined pressure.

Reset asks the athlete to re-engage with the task as quickly and accurately as possible. The key output is not whether disruption happens. Disruption is expected. The key output is recovery quality: recovery time, first-post-reset accuracy, false starts, pattern confirmation, missed recovery, and stability across repeated disruptions.

The scientific basis comes from attentional control, stress inoculation, refocusing-speed literature, and applied distraction-refocusing practice. The athlete is not just practicing calm. They are building a measurable recovery response that can become faster, cleaner, and more reliable over time. [cite:1,3,6]

## 5.3 The Initial Simulation Portfolio

The initial simulation library covers the three pillars with a small, coherent set of serious simulation families.

Reset targets error recovery, attentional shifting, and composure under disruption.

Noise Gate targets selective attention and interference filtering.

Brake Point targets response inhibition and premature action control.

Signal Window targets signal discrimination and decision quality under incomplete information.

Sequence Shift targets working-memory updating and flexible rule switching.

Endurance Lock targets sustained attention and cognitive fatigability over time.

Together, these families give the system enough coverage to train and measure the major mental performance skills without turning the library into an unfocused collection of mini-games.

# 6. Curriculum, Mastery, and Automaticity

Pulse Check is not a one-day recommendation engine. It is a curriculum model.

## 6.1 The Six-Exercise Active Slate

The curriculum layer keeps six active exercises in flight for each athlete:

- Three protocols for mental regulation, priming, or recovery.
- Three simulations for mental sharpening and measurement.

This slate gives the athlete a living toolkit. They are not waiting until a competition day to try breathing, reframing, visualization, cue-word anchoring, Reset, Noise Gate, or Signal Window for the first time. They are training the same tools across days and weeks until the tools become familiar, fast, and available.

The slate also solves a practical coaching problem. If the system assigns only one protocol and one simulation at a time, the athlete may become too narrow. They might improve one skill while neglecting the broader toolkit needed for competition. A six-exercise slate keeps mental training broad enough to build range while still focused enough to avoid overload.

## 6.2 Mastery and Rotation

Each active exercise has a mastery model. Mastery does not mean perfection. It means the athlete has shown enough reliable performance, completion quality, and state-fit evidence that the exercise can graduate from active curriculum emphasis.

For protocols, mastery may include completion consistency, technique fidelity, athlete-reported state shift, state snapshot movement, and improved downstream simulation quality.

For simulations, mastery may include stable skill score improvement, raw metric reliability, lower variance, improved performance under modifiers, and reduced degradation across time.

When an exercise reaches mastery, Nora rotates the mastered exercise into maintenance or periodic reassessment and brings in the next best protocol or simulation. This keeps the curriculum alive. The athlete's toolkit expands, and the active slate continues to match current needs.

## 6.3 How Automaticity Develops

Automaticity develops through repeated, context-linked practice. A response becomes easier to retrieve when the athlete has encountered the cue many times and practiced the response in enough relevant conditions. [cite:9,10,11,12]

Pulse Check supports this in three ways.

First, protocols create compact state-response mappings. Box Breathing maps a steadying need to a known breathing cadence. Cognitive Reframing maps pressure sensations to challenge language. Visualization maps a coming action to a refreshed internal model. Cue-Word Anchoring maps a short phrase to a trained attentional target.

Second, simulations create pressure-context exposure. It is not enough to practice a reset response in a calm environment. The athlete has to practice returning to task focus after disruption, noise, time pressure, ambiguity, and fatigue load. Simulations let the system introduce those conditions gradually and measure whether the response holds.

Third, curriculum creates spacing and recurrence. Skills become more durable when they are revisited across time instead of crammed into one intense session. The six-exercise slate gives Nora a way to balance repetition, variation, state fit, and progression.

The goal is not to make the athlete robotic. The goal is to make useful responses more available. When pressure reduces working memory and increases attentional capture, the athlete should not have to search for a strategy from scratch. The body and mind should recognize the cue and move toward the practiced response.

## 6.4 Competition-Day Retrieval

Competition day is not the best time to learn a mental tool. It is the time to retrieve one.

That is why a curriculum matters. A breathing protocol becomes useful because the athlete has already practiced it. A reframe becomes useful because the athlete has already attached pressure sensations to challenge language. A visualization sequence becomes useful because the athlete has already rehearsed the desired action. A cue word becomes useful because it has already been connected to focus.

The same principle applies to simulations. Reset trains recovery after disruption before the disruption carries real competitive cost. Noise Gate trains filtering before the environment becomes loud. Brake Point trains inhibition before a false action matters. Endurance Lock trains late-session stability before fatigue arrives in competition.

The curriculum is therefore not a content schedule. It is an automaticity engine. It turns protocols and simulations into practiced responses that the athlete can retrieve under load.

# 7. Nora Planning and Training Plan Architecture

Nora is the adaptive planning engine for Pulse Check. Nora operates as a bounded planner: it reads state, profile, curriculum, protocol responsiveness, simulation outcomes, coach constraints, and candidate availability, then chooses the next useful action from approved protocol and simulation inventory.

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

Assessment plans are used for baseline, reassessment, or diagnostic calibration windows.

The six-exercise active slate sits inside this larger plan architecture. A plan defines the development goal. The slate defines the active toolkit Nora is building and rotating as mastery emerges.

# 8. Physiology-Cognition Roadmap

The physiology-cognition correlation engine connects body-state evidence with mental performance evidence.

The product edge is not simply that Pulse Check can connect wearable data. Wearables can see aspects of the body. Simulations can measure aspects of mental performance. The differentiated opportunity is joining those evidence streams to learn how a specific athlete's mental performance behaves under different body states.

The engine models personal thresholds, confidence, freshness, and state-performance relationships. It asks questions like:

- Does this athlete's focus stability change when sleep is short?
- Does reset speed degrade when recovery markers are below personal baseline?
- Does pressure sensitivity increase when resting heart rate is elevated?
- Which protocol tends to help when the athlete is in a specific physiological posture?

No single wearable is the engine. Polar is the signature sports-performance lane because its direct device path can contribute training, exertion, live heart-rate or RR evidence, activity samples, and session context. Apple Watch and HealthKit provide the baseline iOS wearable and health-platform lane. Oura contributes a strong sleep and recovery lane through direct API support or HealthKit fallback. Fitbit Air and the broader Fitbit lane contribute post-sync sleep, heart-rate, activity, biometrics, and recovery context through Google Health. Each source has different strengths, timing, freshness, and limitations, so Pulse Check normalizes them into the same health-context record model before the correlation engine uses them.

The language must stay honest. These are correlations unless stronger evidence supports causal claims. Pulse Check may learn that an athlete usually performs better inside a certain recovery band, or that a specific protocol tends to help under a specific body-state pattern. It should not pretend that wearable data alone decides training. Body-state evidence informs interpretation; Pulse Check still needs simulation outcomes, protocol evidence, athlete feedback, and coaching context.

# 9. Scientific Evidence Framework and Validation

Pulse Check uses an evidence framework because citations alone are not enough. A scientific paper can support a mechanism without validating a specific product implementation.

The system distinguishes between:

- Mechanism support: published evidence supports the underlying cognitive, physiological, or behavioral mechanism.
- Internal validity: Pulse Check's implementation reliably measures what it claims to measure inside the platform.
- Transfer validity: improvements generalize to higher-fidelity environments or real-world performance contexts.
- Protocol effectiveness: a protocol produces the intended state shift and improves the usefulness of downstream execution.
- Curriculum effectiveness: the system's plan structure improves durability, adherence, automaticity, and performance over time.

Validation must also include pilot outcome metrics. Enrollment, adherence, mental performance improvement, escalations, speed to care, trust, and recommendation intent all matter. A mental training system that produces scores but loses athlete trust is not succeeding.

For research readouts, Pulse Check uses frozen evidence frames. A readout locks to one pilot, one date window, one cohort filter, one read-model version, and one set of metrics. Claims are tagged as observed, inferred, or speculative. Unsupported sections are suppressed rather than dressed up with confident language. Human review remains the authority before stronger claims become official.

This is not just legal caution. It is scientific discipline. The system earns its claims.

# 10. Why This Architecture Over Alternatives

The decision to build Pulse Check as protocols plus simulations reflects a belief about what mental performance training actually needs.

A content library can teach concepts, but it does not know whether the athlete can apply them under pressure.

A meditation app can support calm, but competition often requires usable activation, not simply relaxation.

A chatbot can personalize language, but conversation alone does not create measurable skill acquisition.

A generic brain-training game can improve the practiced task, but may not train state regulation or sport-relevant pressure response.

Pulse Check combines the missing pieces. Protocols give the athlete concrete state tools. Simulations create measurable pressure practice. Nora ties both to state, profile, and curriculum. The active slate turns one-off assignments into repeated practice. The validation layer keeps claims constrained by evidence.

# 11. What We Are Not Claiming

Pulse Check is not claiming that the full system has already been validated through randomized controlled trials. The claims in this paper are structural and mechanistic. Efficacy claims must follow data.

Pulse Check is not claiming that simulation gains automatically transfer to competition. Transfer is a real problem in cognitive training. The system is designed with transfer in mind, but transfer has to be tested.

Pulse Check is not claiming that protocols replace sport psychology, therapy, medical care, or human coaching. Protocols are performance-state interventions. They can complement professional support, but they do not replace clinical or relational work.

Pulse Check is not claiming that wearable data determines athlete readiness by itself. Physiology informs the model. It does not own the decision.

Pulse Check is not claiming that all mental performance reduces to cognition. Sleep, nutrition, identity, environment, coaching, team dynamics, injury, stress, and life context all matter. Pulse Check trains a defined layer: state regulation, cognitive-perceptual skill, pressure response, and curriculum-based automaticity.

# 12. Looking Ahead

Pulse Check is designed as a curriculum-based mental performance system. It keeps a balanced active slate of protocols and simulations, rotates exercises as mastery emerges, learns protocol responsiveness by athlete, connects state and body-context signals carefully, and validates claims through governed pilot evidence.

The long-term vision is not a mental performance content app. It is a training operating system for the mental side of sport.

Athletes do not only need insight. They need practiced responses. They need state tools that are ready before competition. They need simulations that reveal whether those tools hold under pressure. They need a curriculum that builds automaticity without overloading them. And they need a system honest enough to say what it knows, what it suspects, and what it has not proven yet.

Mental performance training deserves the same rigor as physical performance training. Pulse Check is an attempt to provide it.

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
[16] Ma, X., Yue, Z. Q., Gong, Z. Q., Zhang, H., Duan, N. Y., Shi, Y. T., Wei, G. X., & Li, Y. F. (2023). The effect of slow-paced breathing on cardiovascular and emotion functions: A meta-analysis and systematic review. Mindfulness.
[17] Brooks, A. W. (2014). Get excited: Reappraising pre-performance anxiety as excitement. Journal of Experimental Psychology: General, 143(3), 1144-1158.
[18] Hatzigeorgiadis, A., Zourbanos, N., Galanis, E., & Theodorakis, Y. (2011). Self-talk and sports performance: A meta-analysis. Perspectives on Psychological Science, 6(4), 348-356.
[19] Liu, Y., Li, D., Liu, C., & Liu, J. (2025). The effects of imagery practice on athletes' performance: A multilevel meta-analysis with systematic review. Behavioral Sciences.
:::
`;

export const getResearchArticleOverride = (slug: string) => {
  if (slug !== TRAINING_MENTAL_GAME_WHITE_PAPER_SLUG) return null;

  return {
    ...TRAINING_MENTAL_GAME_WHITE_PAPER_METADATA,
    content: TRAINING_MENTAL_GAME_WHITE_PAPER_CONTENT,
  };
};

export const applyResearchArticleListOverride = <T extends { slug: string }>(article: T): T => {
  const override = getResearchArticleOverride(article.slug);
  if (!override) return article;

  const { content: _content, ...metadata } = override;
  return {
    ...article,
    ...metadata,
  };
};
