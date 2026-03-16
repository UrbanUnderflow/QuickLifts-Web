import React, { useMemo, useState } from 'react';
import { ClipboardList, Gauge, Layers3, MapPinned, ScanSearch, ShieldCheck, TestTube2, Trophy, Waypoints, Wrench } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

type VisionProDocId =
  | 'immersive-trial-spec'
  | 'environment-trial-design'
  | 'event-script-metric-mapping'
  | 'pilot-protocol'
  | 'pilot-ops-runbook'
  | 'vision-ui-design-language'
  | 'visionos-test-lane'
  | 'realitykit-implementation-guide'
  | 'noise-gate-design-brief'
  | 'noise-gate-m1-plan';

interface VisionProArtifactDoc {
  id: VisionProDocId;
  label: string;
  sourceFile: string;
  authority: string;
  roleSummary: string;
  keyLocks: string[];
  outOfScope: string[];
  buildImplications: string[];
}

const VISION_PRO_DOCS: VisionProArtifactDoc[] = [
  {
    id: 'immersive-trial-spec',
    label: 'Immersive Trial Spec',
    sourceFile: 'Vision Pro Football Immersive Trial Spec V1.pdf',
    authority: 'Package positioning, trial scope, environment constraints, and the governing transfer logic.',
    roleSummary:
      'Defines what the first Vision Pro package is for: one football environment, two immersive transfer trials, and a strict rule that Vision Pro maps back to existing PulseCheck family metrics rather than inventing a second XR scoring system.',
    keyLocks: [
      'Vision Pro is an immersive transfer-trial layer, not a daily training surface.',
      'First build is football only, one environment only, two trials only.',
      'The two first trials are Reset / Next Play and Signal Window / Spatial Read.',
      'The environment can change realism, pressure, and framing, but cannot change family mechanisms or family metric logic.',
      'Transfer Gap is the key comparison concept between phone/web baseline and immersive performance.',
    ],
    outOfScope: [
      'Full football simulation or tactical playbook logic',
      'Multiplayer or shared-session XR',
      'Body-movement-heavy sport simulation',
      'A brand-new XR-only metric system',
    ],
    buildImplications: [
      'Keep the headset runtime tightly bounded and station-based.',
      'Design all output around same-family comparison back to phone/web baseline.',
      'Treat coach storytelling and measurement clarity as co-equal design constraints.',
    ],
  },
  {
    id: 'environment-trial-design',
    label: 'Environment + Trial Design',
    sourceFile: 'Vision Pro Football Environment + Trial Design Spec V1.pdf',
    authority: 'Build-facing design for the football stadium environment, reusable environment systems, and the exact trial flow structure.',
    roleSummary:
      'Translates the package concept into the first environment blueprint: fixed athlete station, main forward field, peripheral event channels, spatial audio field, reusable pressure systems, and explicit per-trial phase design.',
    keyLocks: [
      'Environment name is Football Stadium / Arena Template v1.',
      'The first build must be fixed-position and low-locomotion.',
      'Reusable systems include crowd pressure, scoreboard/consequence, peripheral distraction, event scripting, and logging.',
      'Reset / Next Play must preserve same-task re-engagement under immersive disruption.',
      'Signal Window must preserve cue discrimination under time pressure while making cues spatial and immersive.',
    ],
    outOfScope: [
      'Avatar gameplay or football movement mechanics',
      'Free locomotion',
      'Full-body play simulation',
      'Long multi-module XR battery designs',
    ],
    buildImplications: [
      'The runtime needs shared environment systems, not two disconnected demos.',
      'Each trial needs explicit phase structure and deterministic timing.',
      'Raw event logs need environment-level metadata, condition tags, and validity flags from the start.',
    ],
  },
  {
    id: 'event-script-metric-mapping',
    label: 'Event Script + Metric Mapping',
    sourceFile: 'Vision Pro Football Event Script + Metric Mapping Spec V1.pdf',
    authority: 'The runtime event schema, condition tags, deterministic script rules, validity flags, and mapping from XR events back to family metrics.',
    roleSummary:
      'This is the most implementation-critical artifact. It defines the shared event object, required event types, condition tag categories, deterministic Trial mode, and exactly how Reset and Signal Window outputs should be computed from immersive runtime events.',
    keyLocks: [
      'Every runtime event needs shared fields like eventType, timestamp, sessionId, trialFamily, blockId, conditionTags, spatialOrigin, validityFlags, and payload.',
      'Reset / Next Play needs block events like disruption_started, reset_signal, athlete_response, and response_validated.',
      'Signal Window needs cue_presented, optional decoy_presented, athlete_response, and response_validated.',
      'Trial mode should be deterministic and versioned.',
      'Validity must exist at event, block, and session level.',
    ],
    outOfScope: [
      'Ad hoc XR telemetry without family meaning',
      'Randomized trial behavior that cannot be reproduced',
      'Coach-facing reports that are disconnected from family metrics',
    ],
    buildImplications: [
      'We need a first-class Vision Pro session/event schema, not just a generic result summary.',
      'The completion payload must carry raw event references, validity rollups, version ids, and baseline references.',
      'This document should drive both backend storage and the headset runtime telemetry contract.',
    ],
  },
  {
    id: 'pilot-protocol',
    label: 'Pilot Protocol',
    sourceFile: 'Vision Pro Football Pilot Protocol V1.pdf',
    authority: 'Participant flow, inclusion and exclusion rules, baseline requirements, calibration rules, session order, timing defaults, and validity posture for the first pilot.',
    roleSummary:
      'Defines how the first football pilot should operate as a controlled measurement program rather than an ad hoc demo. It sets the dual-baseline model, baseline recency window, calibration gate, session timing, abort classification, and required downstream reporting behavior.',
    keyLocks: [
      'The pilot uses a dual-baseline model: required phone/web baseline plus optional Immersive Baseline.',
      'Required baseline recency for Reset and Signal Window is 14 days.',
      'Calibration is a validity gate with pass, pass_with_warning, and fail.',
      'Session order is fixed: setup, calibration, Reset, break, Signal Window, closeout.',
      'Session outcomes are valid, partial, invalid, or aborted.',
    ],
    outOfScope: [
      'Changing family metric definitions',
      'Changing environment design principles during pilot execution',
      'Live adaptive trial timing in Trial mode',
    ],
    buildImplications: [
      'Queueing Vision Pro should eventually enforce baseline recency, enrollment, and escalation readiness.',
      'The system needs first-class Immersive Baseline designation and baseline reference linkage.',
      'Reporting needs validity state, version trail, and baseline references, not just a score.',
    ],
  },
  {
    id: 'pilot-ops-runbook',
    label: 'Pilot Ops Runbook',
    sourceFile: 'Vision Pro Football Pilot Ops Runbook V1.pdf',
    authority: 'Room execution, staff roles, athlete check-in, headset prep, calibration operator steps, incident handling, and post-session data reconciliation.',
    roleSummary:
      'Turns the protocol into an event-day operating runbook. It is calm, athlete-first, and explicit about what staff should do before the athlete enters, what they should say during the session, how they should handle pauses or aborts, and what metadata must be verified after the session.',
    keyLocks: [
      'Staff responsibilities are explicit: session lead, setup operator, calibration operator, observer, and data/reporting owner.',
      'Eligibility, comfort, headset fit, visual clarity, audio route, and environment version must be verified before measured trials.',
      'Calibration failure stops the session before measured trials begin.',
      'Pause, abort, and incident handling must be logged cleanly.',
      'Post-session verification must confirm session record, version trail, baseline linkage, validity state, and event log reference.',
    ],
    outOfScope: [
      'Changing trial design during the session',
      'On-the-fly interpretation theater in front of the athlete',
      'Improvising around missing logging or missing metadata',
    ],
    buildImplications: [
      'The product needs operator-facing surfaces and metadata fields that match how staff are expected to run the room.',
      'The session model needs explicit support for calibration, pause, abort, and data-verification outcomes.',
      'Coach and research routing should be traceable back to one reconciled session record.',
    ],
  },
  {
    id: 'vision-ui-design-language',
    label: 'Vision UI Design Language',
    sourceFile: 'pulsecheck_visionpro_chromatic_glass_ui_spec_v1.2-2.docx',
    authority: 'The interface-language layer for Vision Pro: chromatic-glass posture, phase-based UI authority, HUD limits, kiosk/session chrome, and the boundary between UI and immersive trial content.',
    roleSummary:
      'Defines how PulseCheck should look and behave on visionOS without confusing UI chrome for immersive trial content. This is the companion UI spec that governs kiosk, calibration, ornaments, HUD restraint, and when glass must recede so the environment can own measured trial phases.',
    keyLocks: [
      'This is a companion UI spec, not the primary immersive trial content spec.',
      'The phase-based UI authority system (A/B/C/D) governs when glass owns attention versus when the environment does.',
      'During measured trials, the athlete should feel the environment first and the UI second.',
      'Authority Level C is binding for measured blocks: minimal HUD only, no full glass panels, no Nora visual card, no spectral edge treatment.',
      'V1 should prioritize authority-state correctness and HUD restraint over shader polish and high-cost transitions.',
    ],
    outOfScope: [
      'Defining trial mechanics, stimulus timing, or family measurement logic',
      'Replacing the immersive package specs or event-script specs',
      'Using chromatic glass as the game surface during active measurement',
      'Treating V2 or V3 visual polish as required for pilot readiness',
    ],
    buildImplications: [
      'Use this document as the UI/chrome constraint layer while building Milestone 1 and later immersive families.',
      'When the implementation plan leaves visual room for interpretation, defer to this doc for kiosk, calibration, ornament, and HUD posture.',
      'If a beautiful UI choice conflicts with trial validity, trial validity wins.',
    ],
  },
  {
    id: 'visionos-test-lane',
    label: 'visionOS Test Lane',
    sourceFile: 'scripts/visionos_test_lane.sh',
    authority: 'Build/test verification posture for the headset runtime, including the current Xcode target blocker, the future command lane, and the split between unit, operator, and runtime verification.',
    roleSummary:
      'Defines how we verify the Vision Pro runtime without hand-waving. It captures the current truth that PulseCheckVision is now its own visionOS companion target and locks the exact preflight, build, test, and manual operator checks for that scheme.',
    keyLocks: [
      'A real visionOS lane starts with a project preflight, not with assuming the target already exposes visionOS destinations.',
      'Shared unit logic can remain in PulseCheckTests, but the headset runtime still needs a dedicated visionOS destination build.',
      'Operator flow on Vision Pro must be validated separately from pure unit coverage because kiosk claim/start/runtime/pause/abort are experience-critical.',
      'The first automated visionOS lane should be deterministic and smoke-focused: build, shared tests, runtime launch, and kiosk-flow sanity check.',
      'Manual room verification remains required for comfort, calibration posture, headset fit, and operator language even after the automated lane exists.',
    ],
    outOfScope: [
      'Pretending the current iOS simulator lane is already a Vision Pro lane',
      'Replacing event-day manual ops checks with automation',
      'Building a second test philosophy separate from the existing Xcode/unit strategy',
    ],
    buildImplications: [
      'The repo now has a dedicated PulseCheckVision companion target, Apple Vision Pro simulator destination, and scriptable preflight/build/test lane.',
      'The repo should use one scriptable preflight/build/test entrypoint so the lane stays consistent across local and CI runs.',
      'The handbook should explicitly separate what is currently automated from what is still thin or still manual.',
    ],
  },
  {
    id: 'realitykit-implementation-guide',
    label: 'RealityKit Implementation Guide',
    sourceFile: 'Vision Pro - Immersive Tests chapter',
    authority: 'Internal build guide for turning the locked football package specs into a real RealityKit-powered immersive experience rather than a windowed runtime HUD. Now includes the locked Window Behavior Contract and Milestone 1 architecture.',
    roleSummary:
      'Explains the exact implementation gap between the current Vision Pro runtime and the spec stack, then gives the RealityKit build sequence, Milestone 1 architecture, and the Window Behavior Contract required to make Reset / Next Play the first truly immersive football trial.',
    keyLocks: [
      'The current repo is ahead on infrastructure and behind on immersive content.',
      'A real immersive build requires authored spatial entities, environmental pressure systems, and family-specific interaction surfaces inside RealityKit.',
      'Calibration and operator controls can remain lightweight overlays, but measured trials cannot stay panel-first.',
      'The football package should be built as one reusable environment system with three family-specific trial layers on top of it.',
      'The first immersive milestone should be one spec-faithful RealityKit implementation of Reset / Next Play before broadening to the other families.',
      'The kiosk WindowGroup must stop acting as the primary trial surface during immersion. The athlete task surface is the ImmersiveSpace.',
      'Controller stays as state machine and telemetry owner. A ResetTrialSceneCoordinator bridge object synchronizes state between the controller and the RealityKit scene.',
      'The athlete interacts with RealityKit entities via InputTargetComponent + CollisionComponent + SpatialTapGesture. If the athlete taps a flat SwiftUI panel to continue, the build is not up to spec.',
    ],
    outOfScope: [
      'Changing the spec stack itself',
      'Building more queueing, session, or admin plumbing before the immersive content exists',
      'Adding more variant metadata while the core football environment is still placeholder geometry',
      'Treating SwiftUI control panels as the final immersive interaction layer',
    ],
    buildImplications: [
      'The next meaningful step is a RealityKit content pass, not more infrastructure expansion.',
      'Reset / Next Play should become the first fully spatialized immersive family, then Noise Gate, then Signal Window.',
      'The runtime should separate control-plane UI from content-plane RealityKit entities so trials can feel embodied instead of dashboard-like.',
      'The kiosk window swaps to minimal standby content during immersion. Operator controls move to a bottom ornament on the ImmersiveSpace.',
    ],
  },
  {
    id: 'noise-gate-design-brief',
    label: 'Noise Gate Design Brief',
    sourceFile: 'Vision Pro - Immersive Tests chapter',
    authority: 'Design-first brief for the Crowd Tunnel (Vision Pro) variant: visual direction, task clarity, spatial composition, audio pressure, and the rules for what makes the sim feel premium instead of abstract.',
    roleSummary:
      'Locks the north-star experience for Noise Gate before implementation. This artifact defines how Crowd Tunnel should look, what the athlete should understand immediately, how the target and distractor channels should live in space, and which visual shortcuts are prohibited if we want the build to feel stunning instead of like debug geometry.',
    keyLocks: [
      'Crowd Tunnel should feel like stepping into a living pressure corridor, not a dark room with floating widgets.',
      'The athlete task must be obvious within one second: hold the real signal, ignore the noise, commit only when the lane is clean.',
      'Target and distractor channels must have distinct identities in color, motion, audio, and lane behavior.',
      'The signal lane should feel precious and stable; the noise should feel predatory, invasive, and socially pressurized.',
      'Beauty is not decorative chrome. Beauty comes from composition, atmosphere, readability, and the feeling that the whole environment is reacting to the athlete performance.',
    ],
    outOfScope: [
      'Final metric formulas or family-schema changes',
      'Substituting a polished HUD for a real immersive environment',
      'Turning Noise Gate into a tile-picker or menu-based choice game',
      'Using flat debug rails, placeholder bars, or generic glowing boxes as the finished aesthetic language',
    ],
    buildImplications: [
      'Implementation should begin from the designed moment-to-moment athlete experience, not from generic reusable geometry.',
      'Every runtime decision for Crowd Tunnel should be judged against immediate task clarity and environmental beauty.',
      'The first implementation milestone for Noise Gate should prove one complete stunning rep before broadening into more variants or systems.',
    ],
  },
  {
    id: 'noise-gate-m1-plan',
    label: 'Noise Gate Milestone 1 Plan',
    sourceFile: 'Vision Pro - Immersive Tests chapter',
    authority: 'Execution contract for the first Crowd Tunnel build: one complete immersive rep loop that starts clearly, is playable, ends with a score, and matches the design brief before broader expansion.',
    roleSummary:
      'Turns the Crowd Tunnel brief into a build plan. This milestone is intentionally narrow: one authored tunnel, one target lane, one family-locked noise loop, explicit player action, clear success/failure, and a visible end score. No generic “ambient prototype” work counts as done.',
    keyLocks: [
      'Milestone 1 is one complete playable Noise Gate rep loop, not a reusable framework for every future family.',
      'The athlete must understand the task immediately: hold the true signal lane, resist noise pressure, commit at the right moment.',
      'The environment must own the rep. HUD and ornaments remain subordinate and minimal during measurement.',
      'The milestone is not complete until the sim starts, can be played, ends, and produces a score/result.',
      'If the build looks like debug geometry, placeholder rails, or generic glowing bars, it has failed the design brief even if the code runs.',
    ],
    outOfScope: [
      'Generalizing systems before the first beautiful loop exists',
      'Shipping multiple Noise Gate sub-variants in Milestone 1',
      'Replacing environmental pressure with flat choice UI',
      'Calling the sim done because there is animation without readable play',
    ],
    buildImplications: [
      'The implementation should begin from one authored rep sequence and only broaden once that loop feels premium.',
      'The milestone needs strong visual capture and observation tests so the sim can be reviewed without manual interpretation every pass.',
      'The finish line is a complete athlete loop with score and closeout, not “movement on screen.”',
    ],
  },
];

const STACK_ROWS = [
  ['1', 'Immersive Trial Spec', 'What Vision Pro is for, what the first package contains, and what it should never become.'],
  ['2', 'Environment + Trial Design', 'How the football environment and the two trial surfaces should actually be built.'],
  ['3', 'Event Script + Metric Mapping', 'How runtime events, condition tags, validity flags, and family-metric mapping should work.'],
  ['4', 'Pilot Protocol', 'How the first football pilot should run operationally, including baseline rules and session validity.'],
  ['5', 'Pilot Ops Runbook', 'What staff actually do in the room before, during, and after a live session.'],
  ['6', 'Vision UI Design Language', 'How chromatic-glass UI, authority levels, and HUD restraint should work around the immersive trial package.'],
  ['7', 'RealityKit Implementation Guide', 'How to close the gap between the specs and the current runtime by building the actual immersive football content in RealityKit.'],
  ['8', 'Noise Gate Design Brief', 'The design-first north star for Crowd Tunnel: visual direction, task clarity, and the environmental rules that make it feel stunning.'],
  ['9', 'Noise Gate Milestone 1 Plan', 'The executable build contract for one complete, beautiful, playable Crowd Tunnel loop with score and closeout.'],
];

const CURRENT_ALIGNMENT_ROWS = [
  ['Queue / claim / start / complete flow', 'Present', 'Web, iOS, and visionOS already support session queueing, handoff, claiming, start, and completion.'],
  ['Shared football runtime', 'Present', 'The kiosk now hands claimed sessions into the football runtime with calibration, Reset / Next Play, Signal Window, and closeout flow.'],
  ['Spec-faithful immersive content', 'Partial', 'The repo now has a real immersive scene path, but the measured trials are still too HUD-driven and do not yet match the authored football-stadium experience described in the specs.'],
  ['Calibration gate', 'Present', 'The runtime and session model now support calibration outcome classification rather than treating setup as unstructured preamble.'],
  ['Version trail', 'Present', 'Sessions now carry the environment, package, trial, script, and metric-mapping metadata required for the pilot trail.'],
  ['Raw event schema + condition tags', 'Present', 'The Vision Pro contract now carries the locked event/log metadata instead of only a generic sim summary.'],
  ['Transfer Gap + Immersive Baseline', 'Present', 'Completion now resolves recent family baselines, computes Transfer Gap, and auto-designates the first valid immersive baseline.'],
  ['Coach/research reporting outputs', 'Present', 'Coach-facing review now lives in the legacy mental-games surface, and the admin reporting page now supports filtered session review plus CSV export for research and pilot operations.'],
  ['Protocol enforcement at queue/start', 'Present', 'Queue/start now block on product consent, baseline completion, 14-day family baseline recency, escalation hold, pilot/cohort enrollment state, comfort clearance, and calibration failure.'],
  ['Operator reconciliation surfaces', 'Present', 'The admin Vision Pro reporting surface now includes an operator reconciliation queue, closeout checklist, review status, and follow-up notes tied directly to each session record.'],
  ['visionOS build/test lane', 'Present', 'PulseCheckVision now has its own Apple Vision Pro simulator lane with scriptable preflight, build, and smoke-test coverage.'],
  ['visionOS coverage depth', 'Partial', 'The new lane is real, but it is still smoke-level. Runtime interaction coverage, richer operator-path tests, and CI integration still need to grow.'],
];

const VISIONOS_TEST_POSITION_ROWS = [
  ['Current target posture', '`PulseCheckVision` companion target in the existing PulseCheck project', 'The headset experience now has its own visionOS app target and scheme without breaking shared PulseCheck models and runtime logic.'],
  ['Automated lane owner', 'Xcode command lane', 'The headset lane stays in the native Xcode toolchain rather than inventing a second testing stack.'],
  ['Primary automated checks', 'Preflight -> build -> PulseCheckVisionTests', 'First confirm the Apple Vision Pro destination exists, then build the app, then run the target-specific smoke tests on the simulator.'],
  ['Manual verification role', 'Operator smoke + room QA', 'Kiosk claim/start, headset fit, calibration language, pause/abort behavior, and post-session closeout still need a human walkthrough.'],
];

const VISIONOS_TEST_STEPS = [
  {
    title: 'Run project preflight first',
    body: 'Use the repo script to confirm the PulseCheckVision scheme actually exposes an Apple Vision Pro simulator destination before trying to build or test.',
    owner: 'Engineering',
  },
  {
    title: 'Keep the companion target lean',
    body: 'The visionOS app should stay focused on kiosk pairing, runtime execution, and operator closeout while reusing shared PulseCheck models and services instead of inheriting the whole phone shell.',
    owner: 'Engineering',
  },
  {
    title: 'Run the visionOS simulator build lane',
    body: 'Build the PulseCheckVision scheme for the visionOS simulator to catch target-level compile, linkage, and shared-file membership issues before test execution.',
    owner: 'Xcode',
  },
  {
    title: 'Run the target smoke lane',
    body: 'Execute PulseCheckVisionTests against the Apple Vision Pro simulator so the companion target has a real automated lane instead of only compile confidence.',
    owner: 'Xcode',
  },
  {
    title: 'Finish with operator smoke validation',
    body: 'Manually verify kiosk sign-in state, claim code handoff, runtime start, calibration progression, pause/abort, completion, and post-session metadata in a real operator flow.',
    owner: 'Product + Engineering',
  },
];

const VISIONOS_COMMAND_ROWS = [
  ['Preflight', '`/Users/tremainegrant/Documents/GitHub/iOS/PulseCheck/scripts/visionos_test_lane.sh preflight`', 'Confirms the PulseCheckVision scheme and Apple Vision Pro simulator destination are both available before the lane runs.'],
  ['Show destinations', '`/Users/tremainegrant/Documents/GitHub/iOS/PulseCheck/scripts/visionos_test_lane.sh destinations`', 'Prints the destinations the current scheme exposes so you can confirm when Apple Vision Pro appears.'],
  ['visionOS build', '`/Users/tremainegrant/Documents/GitHub/iOS/PulseCheck/scripts/visionos_test_lane.sh build`', 'Builds the PulseCheckVision companion app for the visionOS simulator using the generic simulator destination.'],
  ['visionOS tests', '`/Users/tremainegrant/Documents/GitHub/iOS/PulseCheck/scripts/visionos_test_lane.sh test`', 'Runs the PulseCheckVision smoke tests on the Apple Vision Pro simulator destination.'],
];

const VISIONOS_MANUAL_ROWS = [
  ['Queue handoff', 'Start from a queued Vision Pro session and confirm the kiosk claim flow still resolves the right athlete and session metadata.'],
  ['Calibration gate', 'Confirm calibration can pass, pass with warning, and fail with the expected operator messaging and measured-trial gating.'],
  ['Runtime progression', 'Walk through Reset / Next Play, controlled break, Signal Window, and closeout in order without improvising around missing state.'],
  ['Pause / abort', 'Trigger a pause and an abort path and confirm the runtime, session outcome, and operator copy all stay coherent.'],
  ['Post-session data check', 'Verify the session record includes version trail, baseline references, transfer-gap summary, immersive baseline mode, and event-log linkage.'],
];

const VISION_UI_AUTHORITY_ROWS = [
  ['A', 'UI-Primary', 'Kiosk and idle session phases. Full chromatic-glass treatment, full panel interactivity, no immersive environment ownership.'],
  ['B', 'UI-Prominent', 'Briefing, calibration, and between-block moments. Glass is visible but reduced while the environment begins to load or remains backgrounded.'],
  ['C', 'Environment-Primary', 'Measured trial blocks. Minimal HUD only, no full glass panels, no Nora visual card, and no spectral edge treatment.'],
  ['D', 'UI-Reclaim', 'Results, debrief, and session management after active measurement. Glass re-emerges and the environment freezes or recedes.'],
];

const VISION_UI_LEVEL_C_ROWS = [
  ['Allowed', 'Timer, block counter, pause affordance', 'Small, restrained, and ignorable during task execution.'],
  ['Prohibited', 'Full glass panels', 'Measured blocks cannot be panel-first.'],
  ['Prohibited', 'Chromatic spectral edge rendering', 'Authority Level C uses no spectral treatment on the HUD.'],
  ['Prohibited', 'Nora text card', 'Nora is voice-only during measured blocks.'],
  ['Prohibited', 'Metric cards or animated UI flourishes', 'Nothing should compete with the trial stimulus for attention.'],
];

const VISION_UI_TIER_ROWS = [
  ['V1 Required', 'Authority system, minimal HUD, segmented code input, kiosk/session chrome basics, simple transitions, warmBias state mapping', 'Needed for validity-safe pilot behavior and coherent Pulse identity.'],
  ['V2 Polish', 'ShaderGraph chromatic edge, parallax spectral shift, shard dissolution, richer secondary-tier glass treatment', 'Useful once the immersive trial runtime is stable and performant.'],
  ['V3 Deferred', 'Particle accents, dynamic chromatic geometry everywhere', 'Not worth the performance or attention cost during pilot-stage runtime work.'],
];

const VISION_UI_BOUNDARY_ROWS = [
  ['This UI doc governs', 'Kiosk, session chrome, ornaments, authority-state transitions, HUD styling, typography, and glass/material posture.'],
  ['Immersive trial specs govern', 'Reset, Signal Window, Noise Gate content behavior, event scripting, condition tags, metric mapping, and 3D RealityKit trial content.'],
  ['Integration rule', 'The UI may scaffold the trial, but it must not become the trial surface during measured phases.'],
];

const REALITYKIT_GAP_ROWS = [
  ['Environment shell', 'Placeholder arena shell exists', 'Spec calls for Football Stadium / Arena Template v1 with authored seating, field focus, crowd-pressure channels, scoreboard/consequence system, and reusable event anchors.'],
  ['Reset / Next Play interaction', 'HUD-style card with button', 'Spec calls for same-task re-engagement under immersive disruption inside the stadium, not a centered control panel.'],
  ['Noise Gate interaction', 'Spatialized choice layout in SwiftUI', 'Spec calls for layered noise pressure and target-channel holding inside the environment, with real spatial competition.'],
  ['Signal Window interaction', 'Spatialized choice layout in SwiftUI', 'Spec calls for cue discrimination in a spatial field with environmental pressure, not only floating choice tiles.'],
  ['Environmental pressure systems', 'Mostly metadata + labels', 'Spec calls for reusable crowd, scoreboard, peripheral distraction, spatial audio, and consequence systems that visibly alter the environment.'],
  ['RealityKit content ownership', 'Not yet separated cleanly from runtime HUD', 'Spec needs content-plane RealityKit entities to own the trial interactions while overlays handle only timing, safety, and control.'],
];

const REALITYKIT_BUILD_STREAM_ROWS = [
  ['1', 'Separate control plane from content plane', 'Kiosk/session/calibration/reporting stay in SwiftUI; the measured family interactions move into RealityKit entities, anchors, and systems.'],
  ['2', 'Build Football Stadium / Arena Template v1', 'Author the fixed athlete station, main forward field, peripheral event channels, scoreboard anchor, crowd/stands layer, and lighting/audio zones as reusable RealityKit content.'],
  ['3', 'Create shared environment systems', 'Add reusable RealityKit systems for crowd surge, scoreboard consequence pulses, peripheral distractions, directional cue routing, and condition-tag-driven event playback.'],
  ['4', 'Implement Reset / Next Play as the first full RealityKit family', 'Translate lock-in, disruption, and re-engagement into authored spatial entities and disruptions so the user recovers inside the environment instead of tapping a panel.'],
  ['5', 'Implement Noise Gate with true spatial competition', 'Make target and distractor channels occupy different lanes/emitters in space, with environment-driven noise pressure rather than button-only choice UI.'],
  ['6', 'Implement Signal Window with spatial cue choreography', 'Drive cue windows with authored field nodes, timing systems, directional emphasis, and environmental decoys that match the spec cadence.'],
  ['7', 'Reduce overlays to lightweight guidance only', 'Keep only minimal status, pause/abort, calibration, and summary overlays. The game surface itself should no longer be the overlay.'],
  ['8', 'Validate against the event script and pilot protocol', 'Make sure RealityKit events still map cleanly into the locked event schema, validity flags, family metrics, and operator workflow.'],
];

const REALITYKIT_SYSTEM_ROWS = [
  ['Athlete station anchor', 'Fixed transform origin for all family trials', 'Keep the build low-locomotion and station-based as required by the environment spec.'],
  ['Forward field anchor', 'Primary focal lane for measured actions', 'Reset and Signal Window should both orient around the same forward field, not disconnected UIs.'],
  ['Peripheral event anchors', 'Distraction and consequence channels', 'Needed for crowd swell, evaluative pressure, motion clutter, and scoreboard-linked consequence pulses.'],
  ['Spatial audio zones', 'Directional signal and noise routing', 'Needed to make Noise Gate and Signal Window feel immersive instead of visually abstract.'],
  ['Condition-driven event system', 'Plays authored pressure events from manifest/script data', 'The environment spec expects reusable pressure systems, not hardcoded one-off view transitions.'],
  ['Telemetry bridge', 'Maps RealityKit events back to locked Vision session events', 'Ensures the immersive content still writes the same family metrics and validity rollups defined by the event spec.'],
];

const REALITYKIT_FAMILY_ROWS = [
  ['Reset / Next Play', 'RealityKit target focus, disruption entity/event, recovery confirm action, same-task lock-in surface', 'This is the first family that should become fully spec-faithful because it is the cleanest bridge from current runtime to true immersive content.'],
  ['Noise Gate', 'Target lane entities, distractor emitters, directional noise pressure, sustained focus channel', 'Should feel like selecting and holding the target signal inside a noisy stadium lane, not pressing one of three tiles.'],
  ['Signal Window / Spatial Read', 'Cue nodes, decoy nodes, timing system, spatial highlight/de-emphasis choreography', 'Should feel like reading a live cue in space under pressure, not choosing from abstract on-screen buttons.'],
];

const REALITYKIT_DELIVERABLE_ROWS = [
  ['Milestone 1', 'Reset / Next Play is fully RealityKit-driven in the football environment', 'Lock-in focus sphere, disruption burst, and recovery beacon are all RealityKit entities. Kiosk window is minimal standby. Operator controls are in an ornament. Telemetry path is preserved through the coordinator bridge.'],
  ['Milestone 2', 'Noise Gate is spatialized and uses environmental pressure systems', 'Target/distractor logic, event tags, and reporting all remain family-locked.'],
  ['Milestone 3', 'Signal Window becomes full Spatial Read in the arena', 'Cue discrimination is authored in space and validated against the locked event script.'],
  ['Milestone 4', 'Overlay layer becomes minimal and operator-safe', 'Pause, abort, and summary remain available without taking over the game surface.'],
  ['Milestone 5', 'Spec-faithful pilot rehearsal', 'The build is ready for an operator walkthrough that matches the handbook protocol and runbook rather than a prototype test harness.'],
];

const NOISE_GATE_NORTH_STAR_ROWS = [
  ['Experience name', 'Crowd Tunnel', 'A pressure corridor where one luminous signal lane survives inside a living storm of crowd noise, decoys, and evaluative threat.'],
  ['Athlete feeling', 'Locked, hunted, selective', 'The player should feel like the environment is trying to steal their attention while they protect the real channel.'],
  ['Visual promise', 'Beautiful under pressure', 'The scene should feel cinematic and premium, not like debug geometry in a dark room.'],
  ['Design litmus test', 'One-second comprehension', 'Within one second, the athlete should understand where the real signal lives and what they must ignore.'],
];

const NOISE_GATE_TASK_LOOP_ROWS = [
  ['1', 'Acquire the real lane', 'A single target channel ahead resolves in a clean, precious visual language. It reads as the thing to protect.'],
  ['2', 'Hold signal under noise', 'Distractors flood the side channels, audio field, and peripheral depth, but the athlete keeps attention on the live lane.'],
  ['3', 'Commit when the lane is clean', 'A decisive action window appears only when the real signal is available. The athlete commits once, not constantly.'],
  ['4', 'Read success or miss instantly', 'The environment should immediately communicate whether the athlete held the true signal or got baited by noise.'],
  ['5', 'Reset into the next wave', 'The tunnel inhales, recomposes, and drops the athlete into the next pressure wave without menu interruption.'],
];

const NOISE_GATE_VISUAL_ROWS = [
  ['Signal lane', 'Electric cyan-white, narrow, stable, clean geometry', 'Should feel precious, trustworthy, and readable even under pressure.'],
  ['Distractor channels', 'Warm amber, toxic magenta, blood-red intrusions', 'They should feel invasive, louder, and less disciplined than the signal lane.'],
  ['Tunnel body', 'Brutalist stadium corridor with atmospheric fog and distant bowl light', 'Not a blank black box. The world should imply scale, crowd, and consequence.'],
  ['Score/consequence layer', 'Scoreboard pulse, crowd flare, evaluative flash', 'Pressure should feel social and performative, not just mechanical.'],
  ['Depth language', 'Real parallax lanes and layered emitters', 'Noise should occupy real volume in space rather than sliding across a flat pane.'],
];

const NOISE_GATE_STUNNING_ROWS = [
  ['Do', 'Build a striking corridor composition', 'Use strong symmetry, a disciplined signal lane, and a cinematic vanishing point so the scene feels authored.'],
  ['Do', 'Make audio and lighting part of the gameplay', 'Directional crowd swells, side-channel hiss, scoreboard pulses, and pressure lighting should make the environment feel alive.'],
  ['Do', 'Give success and failure emotional weight', 'A correct filter should feel sharp and satisfying; a baited miss should feel like the room punished you.'],
  ['Avoid', 'Generic glowing bars and debug rails', 'If it looks like placeholder scaffolding, it is not stunning.'],
  ['Avoid', 'Too much HUD or ornamental glass during the rep', 'The environment must carry the beauty and the tension.'],
  ['Avoid', 'Abstract movement without meaning', 'Every motion should answer: signal, noise, consequence, or recovery.'],
];

const NOISE_GATE_BUILD_ROWS = [
  ['Spatial composition first', 'Author the tunnel, focal lane, side emitters, and scoreboard presence before writing generic systems.'],
  ['Task clarity second', 'Prove that a new tester can answer “what am I supposed to do?” instantly from the scene alone.'],
  ['Pressure choreography third', 'Layer crowd, clutter, audio, and bait events so noise feels predatory rather than decorative.'],
  ['Commit window fourth', 'Make the actual player action explicit and satisfying before chasing broader feature scope.'],
  ['Score + closeout fifth', 'Only after the rep feels beautiful and readable should we lock the result surface and reporting handoff.'],
];

const NOISE_GATE_M1_OUTCOME_ROWS = [
  ['Start', 'The athlete enters Crowd Tunnel and sees the true signal lane immediately.', 'No ambiguity about what to protect.'],
  ['Play', 'The athlete holds signal under rising noise pressure, then commits in a clean action window.', 'A real rep, not ambient animation.'],
  ['Finish', 'The loop ends visibly and the athlete gets a score/result.', 'The sim has a beginning, middle, and end.'],
  ['Quality bar', 'The experience feels authored and premium.', 'Not a placeholder shell, not debug geometry, not tile UI.'],
];

const NOISE_GATE_M1_PHASE_ROWS = [
  ['1', 'Acquire Signal', 'The signal lane resolves ahead in clean cyan-white. Side channels stay dormant enough for instant comprehension.'],
  ['2', 'Noise Swell', 'Peripheral emitters wake up with directional crowd and visual clutter. The athlete must keep the real lane stable in attention.'],
  ['3', 'Bait Pressure', 'Distractor lanes begin to mimic the signal with brighter, warmer, more seductive pulses.'],
  ['4', 'Commit Window', 'The real lane clarifies and asks for one decisive action. The user commits only when the lane is clean.'],
  ['5', 'Outcome', 'The tunnel either rewards a correct filter or punishes a baited/late miss with unmistakable environmental consequence.'],
  ['6', 'Score + Reset', 'The rep resolves into a visible score/result panel and can continue or close cleanly.'],
];

const NOISE_GATE_M1_SCENE_ROWS = [
  ['Tunnel shell', 'A brutalist corridor with layered stadium depth, volumetric haze, and a cinematic vanishing point.', 'No black-box emptiness.'],
  ['Signal lane', 'One narrow protected channel in the center lane with disciplined geometry and quiet confidence.', 'This is the truth channel.'],
  ['Distractor emitters', 'Left/right side emitters with predatory motion and warmer toxic palette.', 'Noise should try to steal attention.'],
  ['Scoreboard presence', 'A distant evaluative layer that flashes consequence under pressure or miss.', 'Pressure should feel social, not abstract.'],
  ['Audio zones', 'Directional signal clarity forward, crowd/noise pressure from side and rear quadrants.', 'Needed so Noise Gate feels like Noise Gate.'],
];

const NOISE_GATE_M1_INTERACTION_ROWS = [
  ['Task prompt', 'Immediate in-scene teaching', 'The athlete should know “hold the real lane” without reading a panel.'],
  ['Sustained hold', 'Scene response to maintained focus', 'Signal lane should stabilize/strengthen when the athlete is locked correctly.'],
  ['Commit action', 'Single clear tap/gesture moment', 'The athlete acts once in the clean window, not spam-taps through chaos.'],
  ['Miss behavior', 'Bait or late response is obvious', 'The room should punish a miss with visual and evaluative consequence.'],
  ['Success behavior', 'Correct filter feels sharp and satisfying', 'Not just a tiny label change; the environment should acknowledge the win.'],
];

const NOISE_GATE_M1_IMPLEMENT_ROWS = [
  ['1', 'Author Crowd Tunnel environment', 'Build the composition first: corridor, signal lane, distractor emitters, scoreboard, atmospheric lighting, and audio anchors.'],
  ['2', 'Build one true rep state machine', 'Implement acquire -> swell -> bait -> commit -> outcome -> score as a single authored sequence.'],
  ['3', 'Wire one concrete player action', 'Use one input path for the commit window and route it into the family-locked telemetry path.'],
  ['4', 'Add result surface', 'Show score, distractor-filtering result, validity, and replay/continue controls at the end of the loop.'],
  ['5', 'Add visual observation harness', 'Create debug-forced phases and screenshot capture for Crowd Tunnel so the sim can be reviewed without manual narration.'],
  ['6', 'Only then broaden', 'Do not generalize to more variants, systems, or polish tiers until the first loop is beautiful and fully playable.'],
];

const NOISE_GATE_M1_FILE_ROWS = [
  ['NEW', 'NoiseGateTunnelScene.swift', 'Author the Crowd Tunnel entities: signal lane, distractor emitters, scoreboard layer, pressure fog, and commit target.'],
  ['NEW', 'NoiseGateSceneCoordinator.swift', 'Own the rep sequence, scene snapshot state, and bridge to the existing controller/telemetry path.'],
  ['NEW', 'NoiseGatePressureDriver.swift', 'Map pressure tags into concrete visual/audio changes for the tunnel.'],
  ['MODIFY', 'VisionProKioskView.swift', 'Add Noise Gate local preview launch, immersive HUD/ornament posture, and closeout wiring for the new family.'],
  ['MODIFY', 'VisionProFootballRuntimeView.swift', 'Add a family-specific Noise Gate playable loop with clear start/finish and score handoff.'],
  ['MODIFY', 'PulseCheckVisionTests.swift', 'Add controller + scene snapshot tests for Crowd Tunnel phases, commit action, score, and completion.'],
  ['NEW', 'visionos_capture_noise_gate.sh', 'Create a visual capture harness for forced phases and summary screenshots just like Reset needed.'],
];

const NOISE_GATE_M1_TEST_ROWS = [
  ['Automated loop test', 'Acquire -> swell -> bait -> commit -> outcome -> summary', 'Proves the sim has a full start/play/end loop.'],
  ['Scene readability snapshots', 'Signal, noise, commit, success, miss, score', 'Lets us visually review the sim without asking the user every pass.'],
  ['Action-window test', 'Commit is only accepted in the correct window', 'Protects the family mechanic from becoming spam input.'],
  ['Score-closeout test', 'Score/result panel appears with validity + continue/close controls', 'Required for “complete simulation” status.'],
  ['Manual quality review', 'One beautiful playable rep in simulator', 'Confirms the build is stunning, not merely functional.'],
];

const WINDOW_BEHAVIOR_ROWS = [
  ['WindowGroup during immersion', 'Stays alive but swaps to minimal standby view', 'Title: "Immersive trial active", small session status, Re-open and End Trial buttons only. No measured-trial controls.'],
  ['Operator controls', 'Bottom ornament on ImmersiveSpace (operator-only)', 'Pause, Abort, End Trial. Intentionally visually quiet — small, muted, edge-anchored. Immersive-only; does not appear in panel fallback. In panel fallback, operator controls stay in the kiosk window.'],
  ['Athlete interaction', 'RealityKit entities only', 'The athlete interacts with spatial entities via InputTargetComponent + SpatialTapGesture. If a panel tap is needed, the build is wrong.'],
  ['Immersive space failure', 'Panel fallback', 'Stay in WindowGroup, show existing card UI, display status note. Full Reset trial remains functional.'],
  ['Unexpected dismissal', 'Recovery', 'Window returns, session state preserved, operator can re-open immersive or end trial.'],
  ['Lifecycle: WindowGroup', 'App lifecycle, recovery, fail-safe', 'Owns app stability and non-immersive fallback.'],
  ['Lifecycle: ImmersiveSpace', 'Trial presentation + athlete interaction', 'Owns measured trials, athlete-facing entities, and operator ornament.'],
];

const M1_ARCHITECTURE_ROWS = [
  ['Controller ↔ Scene bridge', 'ResetTrialSceneCoordinator (@Observable)', 'Controller publishes state → coordinator drives ResetTrialComponent. Scene gestures → coordinator → controller. ECS system never calls back to controller.'],
  ['Input model', 'InputTargetComponent + CollisionComponent + SpatialTapGesture', 'Recovery beacon entity gets .indirect input + sphere collision. Gesture routed via .targetedToEntity(). One concrete path.'],
  ['Transition semantics', 'stageEnteredAt: Date on ResetTrialComponent', 'RenderSystem checks if stageEnteredAt changed → fires one-shot (spawn disruption, activate beacon). Otherwise → per-frame continuous animation. No replay/flicker.'],
  ['Component ownership', 'resetTrialRoot entity carries ResetTrialComponent', 'Single authoritative component. Child entities (lockInTarget, disruptionBurst, recoveryBeacon) are render targets only.'],
  ['Telemetry', 'Controller is single telemetry owner', 'RealityKit never logs events. All telemetry: scene gesture → coordinator → controller → event log.'],
  ['Coordinator lifecycle', 'attachScene() / detachScene() / isSceneReady', 'Idempotent. Buffers controller state changes until entities exist. Calling attachScene with same root is a no-op.'],
  ['Sync call sites', 'Specific state transitions, not broad publishing', 'Called on stage transitions, awaitingUserInput changes, blockIndex changes, and abortSession(). Not on every published property.'],
  ['Pressure scope', 'ResetPressureDriver (struct, not ECS)', 'Handles 7 Reset-relevant tags. apply() and reset(). Reset fires on stage exit, block transition, and abort.'],
];

const M1_FILE_MANIFEST_ROWS = [
  ['NEW', 'FootballStadiumEnvironment.swift', 'Named entity hierarchy with canonical defaults struct. Defaults capture initial transform, scale, material, opacity for every entity. Single source of truth for visual reset.'],
  ['NEW', 'ResetTrialScene.swift', 'Reset entities: resetTrialRoot (with component), lockInTarget, disruptionBurst, recoveryBeacon (with input/collision), blockTransition.'],
  ['NEW', 'ResetTrialSceneCoordinator.swift', '@Observable bridge with attachScene/detachScene lifecycle, syncFromController(), onRecoveryBeaconTapped().'],
  ['NEW', 'ResetTrialRenderSystem.swift', 'RealityKit System: reads ResetTrialComponent, drives on-enter one-shots + per-frame animations. Read-only.'],
  ['NEW', 'ResetPressureDriver.swift', 'Struct with apply(tags:to:intensity:) and reset(environment:). Reset-relevant pressure only.'],
  ['MODIFY', 'PulseCheckVisionApp.swift', 'Add .persistentSystemOverlays(.hidden) for system chrome during immersion.'],
  ['MODIFY', 'VisionProKioskView.swift', 'Arena shell → FootballStadiumEnvironment. Immersive view → ResetTrialScene + gesture + ornament + coordinator.'],
  ['MODIFY', 'VisionProFootballRuntimeView.swift', 'immersiveResetTrialContent → lightweight HUD. submitResetResponseFromScene() is a direct alias to submitResetResponse() — no fork.'],
  ['MODIFY', 'PulseCheckVisionTests.swift', '7 new tests: anchors, entities, input components, coordinator transitions, beacon-tap-to-telemetry, pressure-reset-on-abort, idempotent-attachScene.'],
];

const PulseCheckVisionProImmersiveTestsTab: React.FC = () => {
  const [activeDocId, setActiveDocId] = useState<VisionProDocId>('immersive-trial-spec');

  const activeDoc = useMemo(
    () => VISION_PRO_DOCS.find((doc) => doc.id === activeDocId) || VISION_PRO_DOCS[0],
    [activeDocId]
  );

  return (
    <div className="space-y-8">
      <DocHeader
        eyebrow="PulseCheck Vision Pro"
        title="Vision Pro - Immersive Tests"
        version="Spec Stack v1"
        summary="Source-of-truth chapter for the first Vision Pro immersive transfer package. This section locks in the five football pilot artifacts as one coherent stack: package positioning, environment design, event schema, pilot protocol, and room operations."
        highlights={[
          {
            title: 'Vision Pro Has One Job',
            body: 'The spec stack is consistent that Vision Pro is the immersive transfer-trial layer between phone/web training and field testing. It is not a daily training surface.',
          },
          {
            title: 'One Package, Two Trials',
            body: 'The first package is intentionally tight: one football stadium environment, Reset / Next Play, and Signal Window / Spatial Read.',
          },
          {
            title: 'Measurement Must Stay Family-Locked',
            body: 'Every immersive event should map back to existing family metrics, validity rules, and baseline comparisons rather than creating a separate XR scoring universe.',
          },
          {
            title: 'The Biggest Remaining Gap Is Content',
            body: 'Queueing, schema, reporting, and testing have advanced quickly. The remaining work is building the actual RealityKit football experience so the headset runtime matches the spec instead of feeling like a floating dashboard.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Cross-artifact reference chapter for the Vision Pro immersive trial stack. This page is the place to review the specs together, understand how they fit, and keep implementation aligned as the runtime is built."
        sourceOfTruth="This chapter is authoritative for which artifact governs which layer of the Vision Pro build. Use the individual document views below to understand what each spec locks, and use the stack order to avoid mixing operational rules with runtime-schema rules or substituting control-plane progress for immersive content progress."
        masterReference="Read this section before changing the Vision Pro session model, event schema, pilot flow, visionOS runtime, or RealityKit content layer. The stack is ordered from package strategy down to operator execution, then closes with the implementation guide for building the actual immersive content."
        relatedDocs={[
          'PulseCheck Runtime Architecture',
          'Simulation Taxonomy',
          'Variant Registry',
          'Reset family spec',
          'Signal Window family spec',
        ]}
      />

      <SectionBlock icon={Layers3} title="How The Stack Fits Together">
        <DataTable columns={['Order', 'Artifact', 'What It Governs']} rows={STACK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Current Implementation Alignment">
        <DataTable columns={['Capability', 'Status', 'What This Means']} rows={CURRENT_ALIGNMENT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={MapPinned} title="Document Artifacts">
        <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
          <div className="flex flex-wrap gap-2">
            {VISION_PRO_DOCS.map((doc) => {
              const isActive = doc.id === activeDoc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveDocId(doc.id)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
                      : 'border-zinc-700 bg-black/20 text-zinc-300 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  {doc.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-black/20 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Active Artifact</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{activeDoc.label}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">{activeDoc.roleSummary}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-[#090f1c] px-4 py-3 text-xs text-zinc-400">
                  <p className="font-semibold text-white">Source file</p>
                  <p className="mt-1">{activeDoc.sourceFile}</p>
                </div>
              </div>
            </div>

            <CardGrid columns="xl:grid-cols-2">
              <InfoCard title="Authority" accent="blue" body={activeDoc.authority} />
              <InfoCard title="Build Implication" accent="amber" body={activeDoc.buildImplications[0]} />
            </CardGrid>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  What This Doc Locks
                </h4>
                <div className="mt-4">
                  <BulletList items={activeDoc.keyLocks} />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ScanSearch className="h-4 w-4 text-amber-400" />
                  What It Does Not Cover
                </h4>
                <div className="mt-4">
                  <BulletList items={activeDoc.outOfScope} />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Gauge className="h-4 w-4 text-green-400" />
                  Implementation Consequences
                </h4>
                <div className="mt-4">
                  <BulletList items={activeDoc.buildImplications} />
                </div>
              </div>
            </div>

            {activeDoc.id === 'visionos-test-lane' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <TestTube2 className="h-4 w-4 text-cyan-400" />
                      Strategic Position
                    </h4>
                    <div className="mt-4">
                      <DataTable columns={['Decision Area', 'Position', 'Why']} rows={VISIONOS_TEST_POSITION_ROWS} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Wrench className="h-4 w-4 text-amber-400" />
                      Repo Entry Point
                    </h4>
                    <div className="mt-4 space-y-4">
                      <InfoCard
                        title="Canonical Script"
                        accent="green"
                        body="Use `/Users/tremainegrant/Documents/GitHub/iOS/PulseCheck/scripts/visionos_test_lane.sh` as the single entrypoint for PulseCheckVision preflight, build, and test commands."
                      />
                      <InfoCard
                        title="Current Truth"
                        accent="blue"
                        body="PulseCheckVision now builds against the visionOS simulator SDK and exposes an Apple Vision Pro simulator destination. The next hardening move is expanding the smoke tests and operator walkthrough lane."
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ClipboardList className="h-4 w-4 text-purple-400" />
                    Lane Sequence
                  </h4>
                  <div className="mt-4">
                    <StepRail steps={VISIONOS_TEST_STEPS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Gauge className="h-4 w-4 text-green-400" />
                    Canonical Commands
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Action', 'Command', 'Use']} rows={VISIONOS_COMMAND_ROWS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck className="h-4 w-4 text-cyan-400" />
                    Manual Operator Checks
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Check', 'What To Confirm']} rows={VISIONOS_MANUAL_ROWS} />
                  </div>
                </div>
              </div>
            ) : null}

            {activeDoc.id === 'vision-ui-design-language' ? (
              <div className="space-y-6">
                <CardGrid columns="xl:grid-cols-2">
                  <InfoCard
                    title="Cardinal Rule"
                    accent="green"
                    body="During measured trials, the athlete should feel the environment first and the UI second. If the glass panels compete with the stimulus, the UI is too prominent."
                  />
                  <InfoCard
                    title="How To Use This Doc"
                    accent="blue"
                    body="Treat this artifact as the UI/chrome constraint layer. The implementation plan decides architecture; this doc decides how kiosk, calibration, ornaments, and HUD should feel while that architecture is built."
                  />
                </CardGrid>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Layers3 className="h-4 w-4 text-cyan-400" />
                    Phase-Based UI Authority System
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Level', 'Name', 'Build Meaning']} rows={VISION_UI_AUTHORITY_ROWS} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <ShieldCheck className="h-4 w-4 text-green-400" />
                      Authority Level C Guardrails
                    </h4>
                    <div className="mt-4">
                      <DataTable columns={['Rule Type', 'Element', 'Why']} rows={VISION_UI_LEVEL_C_ROWS} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Trophy className="h-4 w-4 text-purple-400" />
                      Feature Tiering
                    </h4>
                    <div className="mt-4">
                      <DataTable columns={['Tier', 'Includes', 'Interpretation']} rows={VISION_UI_TIER_ROWS} />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ScanSearch className="h-4 w-4 text-amber-400" />
                    Interaction Boundary
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Boundary', 'What It Means']} rows={VISION_UI_BOUNDARY_ROWS} />
                  </div>
                </div>
              </div>
            ) : null}

            {activeDoc.id === 'realitykit-implementation-guide' ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ScanSearch className="h-4 w-4 text-amber-400" />
                    Why The Current Runtime Still Feels Wrong
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Layer', 'Current State', 'Spec Gap']} rows={REALITYKIT_GAP_ROWS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck className="h-4 w-4 text-cyan-400" />
                    Window Behavior Contract
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    Locked contract for what the athlete and operator see during immersive Reset / Next Play. The kiosk window stops being the primary trial surface. The ImmersiveSpace owns the athlete task.
                  </p>
                  <div className="mt-4">
                    <DataTable columns={['Surface', 'Posture', 'Detail']} rows={WINDOW_BEHAVIOR_ROWS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Wrench className="h-4 w-4 text-green-400" />
                    Milestone 1 Architecture Decisions
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    Locked architecture for the first RealityKit-driven family. These decisions govern how the controller, coordinator, entities, and input model connect.
                  </p>
                  <div className="mt-4">
                    <DataTable columns={['Decision', 'Choice', 'Why']} rows={M1_ARCHITECTURE_ROWS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ClipboardList className="h-4 w-4 text-purple-400" />
                    Milestone 1 File Manifest
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    The exact files to create and modify for Milestone 1. Five new Swift files, four modified files.
                  </p>
                  <div className="mt-4">
                    <DataTable columns={['Action', 'File', 'What It Does']} rows={M1_FILE_MANIFEST_ROWS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ClipboardList className="h-4 w-4 text-purple-400" />
                    RealityKit Build Sequence
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Order', 'Workstream', 'Instruction']} rows={REALITYKIT_BUILD_STREAM_ROWS} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Waypoints className="h-4 w-4 text-cyan-400" />
                      Environment Systems To Build In RealityKit
                    </h4>
                    <div className="mt-4">
                      <DataTable columns={['System', 'Why It Exists', 'Spec Reason']} rows={REALITYKIT_SYSTEM_ROWS} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Layers3 className="h-4 w-4 text-green-400" />
                      Family-By-Family Translation
                    </h4>
                    <div className="mt-4">
                      <DataTable columns={['Family', 'RealityKit Requirements', 'Build Note']} rows={REALITYKIT_FAMILY_ROWS} />
                    </div>
                  </div>
                </div>

                <CardGrid columns="xl:grid-cols-2">
                  <InfoCard
                    title="RealityKit Ownership Rule"
                    accent="blue"
                    body="RealityKit should own the environment, trial cues, disruptions, and spatial response targets. SwiftUI should only own operator-safe overlays like calibration controls, pause/abort, timing summaries, and post-session closeout."
                  />
                  <InfoCard
                    title="What To Build First"
                    accent="green"
                    body="Build Reset / Next Play first as the first fully spec-faithful immersive family. It is the clearest proof that the runtime has crossed the line from dashboard prototype to authored immersive content."
                  />
                  <InfoCard
                    title="What Not To Do"
                    accent="amber"
                    body="Do not keep layering more registry, package, or reporting features while the measured trial is still mostly a panel. That creates the illusion of progress while the core product remains unbuilt."
                  />
                  <InfoCard
                    title="Definition Of Done"
                    accent="purple"
                    body="The Vision build is up to spec when the athlete experiences authored football-space interactions inside RealityKit, while telemetry, validity, and operator flow still map cleanly back to the locked event script and pilot protocol."
                  />
                </CardGrid>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Trophy className="h-4 w-4 text-green-400" />
                    Milestones That Prove The Build Is Catching Up To The Spec
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Milestone', 'Outcome', 'Acceptance']} rows={REALITYKIT_DELIVERABLE_ROWS} />
                  </div>
                </div>
              </div>
            ) : null}

            {activeDoc.id === 'noise-gate-design-brief' ? (
              <div className="space-y-6">
                <CardGrid columns="xl:grid-cols-2">
                  <InfoCard
                    title="North Star"
                    accent="blue"
                    body="Crowd Tunnel should feel like a living pressure corridor with one truthful signal lane fighting to stay readable while noise, crowd, and consequence try to steal the athlete attention."
                  />
                  <InfoCard
                    title="Design Rule"
                    accent="green"
                    body="If a first-time viewer cannot explain the task immediately, the build is not ready. Noise Gate must be legible before it is clever."
                  />
                </CardGrid>

                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Trophy className="h-4 w-4 text-cyan-400" />
                    Crowd Tunnel North Star
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Decision', 'Target', 'Why']} rows={NOISE_GATE_NORTH_STAR_ROWS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ClipboardList className="h-4 w-4 text-purple-400" />
                    Player Task Loop
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    Noise Gate only works if the athlete can feel the rep loop clearly: find the real lane, hold it under pressure, commit at the right moment, then read whether they filtered well or got baited.
                  </p>
                  <div className="mt-4">
                    <DataTable columns={['Step', 'Moment', 'What The Athlete Should Feel']} rows={NOISE_GATE_TASK_LOOP_ROWS} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Layers3 className="h-4 w-4 text-green-400" />
                      Visual Language
                    </h4>
                    <div className="mt-4">
                      <DataTable columns={['Layer', 'Treatment', 'Meaning']} rows={NOISE_GATE_VISUAL_ROWS} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <ShieldCheck className="h-4 w-4 text-amber-400" />
                      Stunning vs. Cheap
                    </h4>
                    <div className="mt-4">
                      <DataTable columns={['Rule', 'Instruction', 'Interpretation']} rows={NOISE_GATE_STUNNING_ROWS} />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Wrench className="h-4 w-4 text-purple-400" />
                    Design-First Build Order
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    Build Crowd Tunnel from composition and athlete understanding outward. Do not start from generic reusable geometry and hope it becomes beautiful later.
                  </p>
                  <div className="mt-4">
                    <DataTable columns={['Order', 'What To Build']} rows={NOISE_GATE_BUILD_ROWS} />
                  </div>
                </div>

                <CardGrid columns="xl:grid-cols-3">
                  <InfoCard
                    title="Signal Identity"
                    accent="blue"
                    body="The real lane should feel disciplined, clean, and trustworthy. It must visually separate itself from every distractor system so the athlete always knows what is worth protecting."
                  />
                  <InfoCard
                    title="Noise Identity"
                    accent="red"
                    body="Noise should feel invasive, seductive, and slightly hostile. It should not just float around; it should try to steal attention from the signal lane."
                  />
                  <InfoCard
                    title="Beauty Standard"
                    accent="green"
                    body="The sim should feel authored like a premium sports title reveal moment: strong symmetry, cinematic depth, disciplined color hierarchy, and environmental consequence."
                  />
                </CardGrid>
              </div>
            ) : null}

            {activeDoc.id === 'noise-gate-m1-plan' ? (
              <div className="space-y-6">
                <CardGrid columns="xl:grid-cols-2">
                  <InfoCard
                    title="Milestone Scope"
                    accent="purple"
                    body="One complete playable Crowd Tunnel loop. The athlete starts the sim, understands the task, plays a real rep, finishes, and receives a score. Nothing less counts as done."
                  />
                  <InfoCard
                    title="Execution Rule"
                    accent="green"
                    body="This milestone is design-first and loop-first. Do not build generic systems ahead of the first beautiful rep."
                  />
                </CardGrid>

                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Trophy className="h-4 w-4 text-green-400" />
                    Definition Of Done
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Milestone', 'Required Outcome', 'Why It Matters']} rows={NOISE_GATE_M1_OUTCOME_ROWS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ClipboardList className="h-4 w-4 text-cyan-400" />
                    First Playable Rep Sequence
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    Milestone 1 should build one authored rep from beginning to score. If any phase is vague, indefinite, or decorative, the sim is not ready.
                  </p>
                  <div className="mt-4">
                    <DataTable columns={['Step', 'Phase', 'What Must Happen']} rows={NOISE_GATE_M1_PHASE_ROWS} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Layers3 className="h-4 w-4 text-blue-400" />
                      Scene Composition
                    </h4>
                    <div className="mt-4">
                      <DataTable columns={['Layer', 'What To Build', 'Interpretation']} rows={NOISE_GATE_M1_SCENE_ROWS} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <ShieldCheck className="h-4 w-4 text-amber-400" />
                      Interaction Contract
                    </h4>
                    <div className="mt-4">
                      <DataTable columns={['Moment', 'Requirement', 'Why']} rows={NOISE_GATE_M1_INTERACTION_ROWS} />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Wrench className="h-4 w-4 text-purple-400" />
                    Build Order
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Order', 'Workstream', 'Instruction']} rows={NOISE_GATE_M1_IMPLEMENT_ROWS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ClipboardList className="h-4 w-4 text-purple-400" />
                    File Manifest
                  </h4>
                  <div className="mt-4">
                    <DataTable columns={['Action', 'File', 'What It Owns']} rows={NOISE_GATE_M1_FILE_ROWS} />
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <TestTube2 className="h-4 w-4 text-cyan-400" />
                    Verification Contract
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    This milestone should ship with visual self-observation from day one. We should be able to prove the sim is starting, playable, ending, and scoring without relying on the user to describe every frame.
                  </p>
                  <div className="mt-4">
                    <DataTable columns={['Check', 'What To Verify', 'Purpose']} rows={NOISE_GATE_M1_TEST_ROWS} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="What The Runtime Still Needs To Match The Stack">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Protocol Enforcement"
            accent="purple"
            body="The session model is much closer to the spec now. The next gap is enforcing pilot rules at queue/start time: baseline recency, eligibility, escalation hold posture, cohort enrollment, and comfort screening."
          />
          <InfoCard
            title="visionOS Runtime Build"
            accent="purple"
            body="The signed-out kiosk flow and football runtime now compile inside the dedicated PulseCheckVision target. The next implementation layer is building the spec-faithful RealityKit environment and measured family interactions inside that runtime."
          />
          <InfoCard
            title="Measurement And Reporting"
            accent="purple"
            body="Transfer Gap, Immersive Baseline designation, and session-level athlete/coach report summaries are now in the contract. Dedicated rendering surfaces and exports still need to catch up."
          />
          <InfoCard
            title="Operator-Safe Session Controls"
            accent="purple"
            body="Pause, abort, comfort handling, session outcome classification, and post-session reconciliation should be represented in product state so the ops runbook is enforceable instead of purely manual."
          />
          <InfoCard
            title="visionOS Verification Lane"
            accent="purple"
            body="The dedicated visionOS lane now exists and runs against the Apple Vision Pro simulator. The next hardening move is expanding beyond smoke coverage into richer runtime, operator, and regression checks."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Trophy} title="Why This Matters">
        <BulletList
          items={[
            'The docs tell a tighter and more mature story than the current implementation, which is good because they give us a clear target rather than fuzzy Vision Pro ambition.',
            'The strongest principle in the stack is that Vision Pro should deepen measurement fidelity without breaking family continuity. That should govern every schema and runtime decision we make next.',
            'This package succeeds only if coaches understand it, athletes can tolerate it, and the resulting data is valid enough to compare back to phone/web baselines.',
          ]}
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckVisionProImmersiveTestsTab;
