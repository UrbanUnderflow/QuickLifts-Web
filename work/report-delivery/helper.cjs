"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/coach-dashboard/reportDelivery.ts
var reportDelivery_exports = {};
__export(reportDelivery_exports, {
  assertReportAudience: () => assertReportAudience,
  deliveryId: () => deliveryId,
  dueReports: () => dueReports,
  prepareParticipationReport: () => prepareParticipationReport,
  renderParticipationReport: () => renderParticipationReport,
  resolveReportRecipients: () => resolveReportRecipients,
  summarizeParticipation: () => summarizeParticipation,
  validateDeliveryConfig: () => validateDeliveryConfig
});
module.exports = __toCommonJS(reportDelivery_exports);
var import_node_crypto = require("node:crypto");

// src/lib/coach-dashboard/access.ts
var validTeamId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
var DashboardAccessError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var activeRecord = (d) => (d.status == null || d.status === "active") && !d.revokedAt && !d.removedAt && !d.archivedAt && !d.deletedAt && d.revoked !== true;
function dashboardAccess(membership, uid, teamId) {
  const active = membership.userId === uid && membership.teamId === teamId && activeRecord(membership);
  const capabilities = Array.isArray(membership.staffCapabilities) ? membership.staffCapabilities : [];
  const legacyParticipation = !Object.prototype.hasOwnProperty.call(membership, "staffCapabilities") && ["team-admin", "coach", "performance-staff"].includes(membership.role);
  const staff = active && membership.role !== "athlete";
  return { participation: staff && (legacyParticipation || capabilities.some((c) => ["admin", "coaching", "athletic_trainer"].includes(c))), wellbeing: staff && capabilities.includes("athletic_trainer"), athlete: active && membership.role === "athlete" };
}
async function loadTeamAccess(db, uid, teamId) {
  const [member, team] = await Promise.all([db.collection("pulsecheck-team-memberships").doc(`${teamId}_${uid}`).get(), db.collection("pulsecheck-teams").doc(teamId).get()]);
  const membership = member.data() || {};
  const teamData = team.data() || {};
  if (!member.exists || !team.exists || teamData.status !== "active" || !activeRecord(teamData) || !validTeamId(teamData.organizationId) || membership.organizationId !== teamData.organizationId) throw new DashboardAccessError(403, "This team is not available to your account.");
  const organization = await db.collection("pulsecheck-organizations").doc(teamData.organizationId).get();
  if (!organization.exists || organization.data()?.status !== "active" || !activeRecord(organization.data() || {})) throw new DashboardAccessError(403, "This organization is not active.");
  return { membership, team: teamData, access: dashboardAccess(membership, uid, teamId) };
}
function visibleAthlete(membership, athleteId) {
  if (membership.rosterVisibilityScope === "none") return false;
  if (membership.rosterVisibilityScope === "assigned") return Array.isArray(membership.allowedAthleteIds) && membership.allowedAthleteIds.includes(athleteId);
  return membership.rosterVisibilityScope == null || membership.rosterVisibilityScope === "team";
}

// src/api/firebase/dailyCurriculum/linearCurriculumSeed.json
var linearCurriculumSeed_default = {
  active: [
    {
      id: "protocol-478-breathing",
      name: "4-7-8 Relaxation Breathing",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "First by explicit user requirement; introduce Learn, independent Practice, then Use it with journaling inside Use it through one guided technique.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-478-breathing",
        "sim-modules/breathing-478",
        "mental-exercises/breathing-478",
        "pulsecheck-protocol-variants/recovery-recovery_downregulation--4-7-8-relaxation-breathing",
        "pulsecheck-protocol-families/recovery-recovery_downregulation"
      ],
      aliases: [
        "breathing-478",
        "protocol-478-breathing"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "protocol-physiological-sigh",
      name: "Physiological Sigh",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Introduce one simple timed breathing or attention instruction before longer reflection, changing rules or layered distractions.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-physiological-sigh",
        "sim-modules/breathing-physiological-sigh",
        "mental-exercises/breathing-physiological-sigh",
        "pulsecheck-protocol-variants/regulation-acute_downshift--physiological-sigh",
        "pulsecheck-protocol-families/regulation-acute_downshift"
      ],
      aliases: [
        "breathing-physiological-sigh",
        "protocol-physiological-sigh"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "protocol-box-breathing",
      name: "Box Breathing",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Introduce one simple timed breathing or attention instruction before longer reflection, changing rules or layered distractions.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-box-breathing",
        "sim-modules/breathing-box",
        "mental-exercises/breathing-box",
        "pulsecheck-protocol-variants/regulation-steady_regulation--box-breathing",
        "pulsecheck-protocol-families/regulation-steady_regulation"
      ],
      aliases: [
        "breathing-box",
        "protocol-box-breathing"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "protocol-recovery-breathing",
      name: "Recovery Breathing",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Introduce one simple timed breathing or attention instruction before longer reflection, changing rules or layered distractions.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-recovery-breathing",
        "sim-modules/breathing-recovery",
        "mental-exercises/breathing-recovery",
        "pulsecheck-protocol-variants/recovery-recovery_downregulation--recovery-breathing",
        "pulsecheck-protocol-families/recovery-recovery_downregulation"
      ],
      aliases: [
        "breathing-recovery",
        "protocol-recovery-breathing"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "focus-single-point",
      name: "Single-Point Focus",
      type: "protocol",
      readiness: "classification review guided activity in simulation catalog",
      rationale: "Introduce one simple timed breathing or attention instruction before longer reflection, changing rules or layered distractions. Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation.",
      sourceRefs: [
        "sim-modules/focus-single-point",
        "mental-exercises/focus-single-point"
      ],
      aliases: [
        "focus-single-point"
      ],
      catalogType: "simulation",
      classificationReason: "Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation."
    },
    {
      id: "protocol-body-scan-reset",
      name: "Body Scan Awareness",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Introduce one simple timed breathing or attention instruction before longer reflection, changing rules or layered distractions.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-body-scan-reset",
        "sim-modules/focus-body-scan",
        "mental-exercises/focus-body-scan",
        "pulsecheck-protocol-variants/regulation-focus_narrowing--body-scan-awareness",
        "pulsecheck-protocol-families/regulation-focus_narrowing"
      ],
      aliases: [
        "focus-body-scan",
        "protocol-body-scan-reset"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "protocol-cue-word-anchoring",
      name: "Cue Word Anchoring",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Introduce one simple timed breathing or attention instruction before longer reflection, changing rules or layered distractions.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-cue-word-anchoring",
        "sim-modules/focus-cue-word",
        "mental-exercises/focus-cue-word",
        "pulsecheck-protocol-variants/priming-focus_narrowing--cue-word-anchoring",
        "pulsecheck-protocol-families/priming-focus_narrowing"
      ],
      aliases: [
        "focus-cue-word",
        "protocol-cue-word-anchoring"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "confidence-affirmations",
      name: "Sport-Specific Affirmations",
      type: "protocol",
      readiness: "classification review guided activity in simulation catalog",
      rationale: "Add one concrete cue, self-statement, evidence recall or brief imagery/reflection after the basic session pattern is familiar. Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation.",
      sourceRefs: [
        "sim-modules/confidence-affirmations",
        "mental-exercises/confidence-affirmations"
      ],
      aliases: [
        "confidence-affirmations"
      ],
      catalogType: "simulation",
      classificationReason: "Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation."
    },
    {
      id: "protocol-evidence-journal",
      name: "Evidence Journal",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Add one concrete cue, self-statement, evidence recall or brief imagery/reflection after the basic session pattern is familiar.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-evidence-journal",
        "sim-modules/confidence-evidence-journal",
        "mental-exercises/confidence-evidence-journal",
        "pulsecheck-protocol-variants/recovery-recovery_reflection--evidence-journal",
        "pulsecheck-protocol-families/recovery-recovery_reflection"
      ],
      aliases: [
        "confidence-evidence-journal",
        "protocol-evidence-journal"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "mindset-growth",
      name: "Growth Mindset Self-Talk",
      type: "simulation",
      readiness: "active base requires dispatch and copy review",
      rationale: "Add one concrete cue, self-statement, evidence recall or brief imagery/reflection after the basic session pattern is familiar.",
      sourceRefs: [
        "sim-modules/mindset-growth",
        "mental-exercises/mindset-growth"
      ],
      aliases: [
        "mindset-growth"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "protocol-process-over-outcome",
      name: "Process Over Outcome",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Add one concrete cue, self-statement, evidence recall or brief imagery/reflection after the basic session pattern is familiar.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-process-over-outcome",
        "sim-modules/mindset-process-focus",
        "mental-exercises/mindset-process-focus",
        "pulsecheck-protocol-variants/recovery-recovery_reflection--process-over-outcome",
        "pulsecheck-protocol-families/recovery-recovery_reflection"
      ],
      aliases: [
        "mindset-process-focus",
        "protocol-process-over-outcome"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "viz-highlight-reel",
      name: "Highlight Reel",
      type: "protocol",
      readiness: "classification review guided activity in simulation catalog",
      rationale: "Add one concrete cue, self-statement, evidence recall or brief imagery/reflection after the basic session pattern is familiar. Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation.",
      sourceRefs: [
        "sim-modules/viz-highlight-reel",
        "mental-exercises/viz-highlight-reel"
      ],
      aliases: [
        "viz-highlight-reel"
      ],
      catalogType: "simulation",
      classificationReason: "Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation."
    },
    {
      id: "protocol-perfect-execution-replay",
      name: "Perfect Execution Replay",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Add one concrete cue, self-statement, evidence recall or brief imagery/reflection after the basic session pattern is familiar.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-perfect-execution-replay",
        "sim-modules/viz-perfect-execution",
        "mental-exercises/viz-perfect-execution",
        "pulsecheck-protocol-variants/priming-imagery_priming--perfect-execution-replay",
        "pulsecheck-protocol-families/priming-imagery_priming"
      ],
      aliases: [
        "protocol-perfect-execution-replay",
        "viz-perfect-execution"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "protocol-nerves-to-excitement",
      name: "Nerves to Excitement Reframe",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Add one concrete cue, self-statement, evidence recall or brief imagery/reflection after the basic session pattern is familiar.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-nerves-to-excitement",
        "sim-modules/mindset-nerves-excitement",
        "mental-exercises/mindset-nerves-excitement",
        "pulsecheck-protocol-variants/regulation-cognitive_reframe--nerves-to-excitement-reframe",
        "pulsecheck-protocol-families/regulation-cognitive_reframe"
      ],
      aliases: [
        "mindset-nerves-excitement",
        "protocol-nerves-to-excitement"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "mindset-pressure-privilege",
      name: "Pressure to Privilege Reframe",
      type: "simulation",
      readiness: "active base requires dispatch and copy review",
      rationale: "Add longer preparation, meaning selection, body priming or scenario choice; content copy and platform behavior need review, not an efficacy claim.",
      sourceRefs: [
        "sim-modules/mindset-pressure-privilege",
        "mental-exercises/mindset-pressure-privilege"
      ],
      aliases: [
        "mindset-pressure-privilege"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "protocol-power-pose",
      name: "Power Posing",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Add longer preparation, meaning selection, body priming or scenario choice; content copy and platform behavior need review, not an efficacy claim.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-power-pose",
        "sim-modules/confidence-power-pose",
        "mental-exercises/confidence-power-pose",
        "pulsecheck-protocol-variants/priming-confidence_priming--power-posing",
        "pulsecheck-protocol-families/priming-confidence_priming"
      ],
      aliases: [
        "confidence-power-pose",
        "protocol-power-pose"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "confidence-inventory",
      name: "Confidence Inventory",
      type: "protocol",
      readiness: "classification review guided activity in simulation catalog",
      rationale: "Add longer preparation, meaning selection, body priming or scenario choice; content copy and platform behavior need review, not an efficacy claim. Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation.",
      sourceRefs: [
        "sim-modules/confidence-inventory",
        "mental-exercises/confidence-inventory"
      ],
      aliases: [
        "confidence-inventory"
      ],
      catalogType: "simulation",
      classificationReason: "Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation."
    },
    {
      id: "protocol-activation-breathing",
      name: "Activation Breathing",
      type: "protocol",
      readiness: "active protocol requires copy and platform review",
      rationale: "Add longer preparation, meaning selection, body priming or scenario choice; content copy and platform behavior need review, not an efficacy claim.",
      sourceRefs: [
        "pulsecheck-protocols/protocol-activation-breathing",
        "sim-modules/breathing-activation",
        "mental-exercises/breathing-activation",
        "pulsecheck-protocol-variants/priming-activation_upshift--activation-breathing",
        "pulsecheck-protocol-families/priming-activation_upshift"
      ],
      aliases: [
        "breathing-activation",
        "protocol-activation-breathing"
      ],
      catalogType: "protocol",
      classificationReason: ""
    },
    {
      id: "viz-competition-walkthrough",
      name: "Competition Walkthrough",
      type: "protocol",
      readiness: "classification review guided activity in simulation catalog",
      rationale: "Add longer preparation, meaning selection, body priming or scenario choice; content copy and platform behavior need review, not an efficacy claim. Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation.",
      sourceRefs: [
        "sim-modules/viz-competition-walkthrough",
        "mental-exercises/viz-competition-walkthrough"
      ],
      aliases: [
        "viz-competition-walkthrough"
      ],
      catalogType: "simulation",
      classificationReason: "Guided dwell/imagery or timed attention technique, not a scored skill game; reclassified as Protocol under user definition while preserving current catalogKind=simulation."
    },
    {
      id: "viz-adversity-response",
      name: "Adversity Response Imagery",
      type: "simulation",
      readiness: "active base requires dispatch and copy review",
      rationale: "Add longer preparation, meaning selection, body priming or scenario choice; content copy and platform behavior need review, not an efficacy claim.",
      sourceRefs: [
        "sim-modules/viz-adversity-response",
        "mental-exercises/viz-adversity-response"
      ],
      aliases: [
        "viz-adversity-response"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "focus-3-second-reset",
      name: "Reset",
      type: "simulation",
      readiness: "active base requires dispatch and copy review",
      rationale: "Introduce the reset task with its task-specific score before named expressions. This is a bounded task observation, not sport-transfer validation.",
      sourceRefs: [
        "sim-modules/focus-3-second-reset",
        "mental-exercises/focus-3-second-reset"
      ],
      aliases: [
        "focus-3-second-reset"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-branch-short-daily-reset",
      name: "Short Daily Reset",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named reset expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/reset-branch-short-daily-reset",
        "sim-variants/reset-branch-short-daily-reset"
      ],
      aliases: [
        "reset-branch-short-daily-reset"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-library-recovery-chain",
      name: "Recovery Chain",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named reset expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/reset-library-recovery-chain",
        "sim-variants/reset-library-recovery-chain"
      ],
      aliases: [
        "reset-library-recovery-chain"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-library-reset-window",
      name: "Reset Window",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named reset expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/reset-library-reset-window",
        "sim-variants/reset-library-reset-window"
      ],
      aliases: [
        "reset-library-reset-window"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-library-restart",
      name: "Restart",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named reset expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/reset-library-restart",
        "sim-variants/reset-library-restart"
      ],
      aliases: [
        "reset-library-restart"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-library-second-chance",
      name: "Second Chance",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named reset expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/reset-library-second-chance",
        "sim-variants/reset-library-second-chance"
      ],
      aliases: [
        "reset-library-second-chance"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "focus-noise-gate",
      name: "Noise Gate",
      type: "simulation",
      readiness: "active base requires dispatch and copy review",
      rationale: "Introduce the noise_gate task with its task-specific score before named expressions. This is a bounded task observation, not sport-transfer validation.",
      sourceRefs: [
        "sim-modules/focus-noise-gate",
        "mental-exercises/focus-noise-gate"
      ],
      aliases: [
        "focus-noise-gate"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-library-channel-filter",
      name: "Channel Filter",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named noise_gate expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/noise-gate-library-channel-filter",
        "sim-variants/noise-gate-library-channel-filter"
      ],
      aliases: [
        "noise-gate-library-channel-filter"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "decision-brake-point",
      name: "Brake Point",
      type: "simulation",
      readiness: "active base requires dispatch and copy review",
      rationale: "Introduce the brake_point task with its task-specific score before named expressions. This is a bounded task observation, not sport-transfer validation.",
      sourceRefs: [
        "sim-modules/decision-brake-point",
        "mental-exercises/decision-brake-point"
      ],
      aliases: [
        "decision-brake-point"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-branch-high-stakes-inhibition-brake-point",
      name: "High-Stakes Inhibition Brake Point",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named brake_point expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/brake-point-branch-high-stakes-inhibition-brake-point",
        "sim-variants/brake-point-branch-high-stakes-inhibition-brake-point"
      ],
      aliases: [
        "brake-point-branch-high-stakes-inhibition-brake-point"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-branch-spatial-cancel-brake-point",
      name: "Spatial Cancel Brake Point",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named brake_point expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/brake-point-branch-spatial-cancel-brake-point",
        "sim-variants/brake-point-branch-spatial-cancel-brake-point"
      ],
      aliases: [
        "brake-point-branch-spatial-cancel-brake-point"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "decision-signal-window",
      name: "Signal Window",
      type: "simulation",
      readiness: "active base requires dispatch and copy review",
      rationale: "Introduce the signal_window task with its task-specific score before named expressions. This is a bounded task observation, not sport-transfer validation.",
      sourceRefs: [
        "sim-modules/decision-signal-window",
        "mental-exercises/decision-signal-window"
      ],
      aliases: [
        "decision-signal-window"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-branch-rapid-recognition-signal-window",
      name: "Rapid Recognition Signal Window",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named signal_window expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/signal-window-branch-rapid-recognition-signal-window",
        "sim-variants/signal-window-branch-rapid-recognition-signal-window"
      ],
      aliases: [
        "signal-window-branch-rapid-recognition-signal-window"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "decision-sequence-shift",
      name: "Sequence Shift",
      type: "simulation",
      readiness: "active base requires dispatch and copy review",
      rationale: "Introduce the sequence_shift task with its task-specific score before named expressions. This is a bounded task observation, not sport-transfer validation.",
      sourceRefs: [
        "sim-modules/decision-sequence-shift",
        "mental-exercises/decision-sequence-shift"
      ],
      aliases: [
        "decision-sequence-shift"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-branch-dual-rule-sequence-shift",
      name: "Dual-Rule Sequence Shift",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named sequence_shift expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/sequence-shift-branch-dual-rule-sequence-shift",
        "sim-variants/sequence-shift-branch-dual-rule-sequence-shift"
      ],
      aliases: [
        "sequence-shift-branch-dual-rule-sequence-shift"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-branch-pattern-change-sequence-shift",
      name: "Pattern-Change Sequence Shift",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named sequence_shift expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/sequence-shift-branch-pattern-change-sequence-shift",
        "sim-variants/sequence-shift-branch-pattern-change-sequence-shift"
      ],
      aliases: [
        "sequence-shift-branch-pattern-change-sequence-shift"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-branch-sequence-memory-sequence-shift",
      name: "Sequence-Memory Sequence Shift",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named sequence_shift expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/sequence-shift-branch-sequence-memory-sequence-shift",
        "sim-variants/sequence-shift-branch-sequence-memory-sequence-shift"
      ],
      aliases: [
        "sequence-shift-branch-sequence-memory-sequence-shift"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-library-audible",
      name: "Audible",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named sequence_shift expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/sequence-shift-library-audible",
        "sim-variants/sequence-shift-library-audible"
      ],
      aliases: [
        "sequence-shift-library-audible"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-library-rule-break",
      name: "Rule Break",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named sequence_shift expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/sequence-shift-library-rule-break",
        "sim-variants/sequence-shift-library-rule-break"
      ],
      aliases: [
        "sequence-shift-library-rule-break"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "focus-endurance-lock",
      name: "Endurance Lock",
      type: "simulation",
      readiness: "active base requires dispatch and copy review",
      rationale: "Introduce the endurance_lock task with its task-specific score before named expressions. This is a bounded task observation, not sport-transfer validation.",
      sourceRefs: [
        "sim-modules/focus-endurance-lock",
        "mental-exercises/focus-endurance-lock"
      ],
      aliases: [
        "focus-endurance-lock"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-library-grind-line",
      name: "Grind Line",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named endurance_lock expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/endurance-lock-library-grind-line",
        "sim-variants/endurance-lock-library-grind-line"
      ],
      aliases: [
        "endurance-lock-library-grind-line"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-library-sharpness-drop",
      name: "Sharpness Drop",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named endurance_lock expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/endurance-lock-library-sharpness-drop",
        "sim-variants/endurance-lock-library-sharpness-drop"
      ],
      aliases: [
        "endurance-lock-library-sharpness-drop"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-library-stay-clean",
      name: "Stay Clean",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named endurance_lock expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/endurance-lock-library-stay-clean",
        "sim-variants/endurance-lock-library-stay-clean"
      ],
      aliases: [
        "endurance-lock-library-stay-clean"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-library-volatility-curve",
      name: "Volatility Curve",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Retain this separately named endurance_lock expression; stored archetype is simple/short. Native engines may not implement its named variation; no additional ability inferred.",
      sourceRefs: [
        "sim-modules/endurance-lock-library-volatility-curve",
        "sim-variants/endurance-lock-library-volatility-curve"
      ],
      aliases: [
        "endurance-lock-library-volatility-curve"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-branch-visual-disruption-reset",
      name: "Visual Disruption Reset",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared visual_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/reset-branch-visual-disruption-reset",
        "sim-variants/reset-branch-visual-disruption-reset"
      ],
      aliases: [
        "reset-branch-visual-disruption-reset"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-branch-peripheral-bait-noise-gate",
      name: "Peripheral Bait Noise Gate",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared visual_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/noise-gate-branch-peripheral-bait-noise-gate",
        "sim-variants/noise-gate-branch-peripheral-bait-noise-gate"
      ],
      aliases: [
        "noise-gate-branch-peripheral-bait-noise-gate"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-branch-visual-clutter-noise-gate",
      name: "Visual Clutter Noise Gate",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared visual_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/noise-gate-branch-visual-clutter-noise-gate",
        "sim-variants/noise-gate-branch-visual-clutter-noise-gate"
      ],
      aliases: [
        "noise-gate-branch-visual-clutter-noise-gate"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-library-spotlight",
      name: "Spotlight",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared visual_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/noise-gate-library-spotlight",
        "sim-variants/noise-gate-library-spotlight"
      ],
      aliases: [
        "noise-gate-library-spotlight"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-branch-clutter-fatigue-endurance-lock",
      name: "Clutter-Fatigue Endurance Lock",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared visual_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/endurance-lock-branch-clutter-fatigue-endurance-lock",
        "sim-variants/endurance-lock-branch-clutter-fatigue-endurance-lock"
      ],
      aliases: [
        "endurance-lock-branch-clutter-fatigue-endurance-lock"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-branch-audio-disruption-reset",
      name: "Audio Disruption Reset",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared audio_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/reset-branch-audio-disruption-reset",
        "sim-variants/reset-branch-audio-disruption-reset"
      ],
      aliases: [
        "reset-branch-audio-disruption-reset"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-branch-crowd-noise-noise-gate",
      name: "Crowd-Noise Noise Gate",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared audio_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/noise-gate-branch-crowd-noise-noise-gate",
        "sim-variants/noise-gate-branch-crowd-noise-noise-gate"
      ],
      aliases: [
        "noise-gate-branch-crowd-noise-noise-gate"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-library-crowd-control",
      name: "Crowd Control",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared audio_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/noise-gate-library-crowd-control",
        "sim-variants/noise-gate-library-crowd-control"
      ],
      aliases: [
        "noise-gate-library-crowd-control"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-branch-fakeout-brake-point",
      name: "Fakeout Brake Point",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared decoy_discrimination expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/brake-point-branch-fakeout-brake-point",
        "sim-variants/brake-point-branch-fakeout-brake-point"
      ],
      aliases: [
        "brake-point-branch-fakeout-brake-point"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-branch-false-start-brake-point",
      name: "False-Start Brake Point",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared decoy_discrimination expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/brake-point-branch-false-start-brake-point",
        "sim-variants/brake-point-branch-false-start-brake-point"
      ],
      aliases: [
        "brake-point-branch-false-start-brake-point"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-branch-go-no-go-brake-point",
      name: "Go/No-Go Brake Point",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared decoy_discrimination expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/brake-point-branch-go-no-go-brake-point",
        "sim-variants/brake-point-branch-go-no-go-brake-point"
      ],
      aliases: [
        "brake-point-branch-go-no-go-brake-point"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-branch-decoy-cue-signal-window",
      name: "Decoy Cue Signal Window",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared decoy_discrimination expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/signal-window-branch-decoy-cue-signal-window",
        "sim-variants/signal-window-branch-decoy-cue-signal-window"
      ],
      aliases: [
        "signal-window-branch-decoy-cue-signal-window"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-branch-combined-channel-reset",
      name: "Combined-Channel Reset",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared combined_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/reset-branch-combined-channel-reset",
        "sim-variants/reset-branch-combined-channel-reset"
      ],
      aliases: [
        "reset-branch-combined-channel-reset"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-branch-mixed-channel-noise-gate",
      name: "Mixed-Channel Noise Gate",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared combined_channel expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/noise-gate-branch-mixed-channel-noise-gate",
        "sim-variants/noise-gate-branch-mixed-channel-noise-gate"
      ],
      aliases: [
        "noise-gate-branch-mixed-channel-noise-gate"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-branch-cognitive-provocation-reset",
      name: "Cognitive-Provocation Reset",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared cognitive_pressure expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/reset-branch-cognitive-provocation-reset",
        "sim-variants/reset-branch-cognitive-provocation-reset"
      ],
      aliases: [
        "reset-branch-cognitive-provocation-reset"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-branch-ambiguous-cue-signal-window",
      name: "Ambiguous Cue Signal Window",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared cognitive_pressure expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/signal-window-branch-ambiguous-cue-signal-window",
        "sim-variants/signal-window-branch-ambiguous-cue-signal-window"
      ],
      aliases: [
        "signal-window-branch-ambiguous-cue-signal-window"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-branch-shot-clock-signal-window",
      name: "Shot-Clock Signal Window",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared sport_context expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/signal-window-branch-shot-clock-signal-window",
        "sim-variants/signal-window-branch-shot-clock-signal-window"
      ],
      aliases: [
        "signal-window-branch-shot-clock-signal-window"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-branch-sport-playbook-sequence-shift",
      name: "Sport-Playbook Sequence Shift",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared sport_context expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/sequence-shift-branch-sport-playbook-sequence-shift",
        "sim-variants/sequence-shift-branch-sport-playbook-sequence-shift"
      ],
      aliases: [
        "sequence-shift-branch-sport-playbook-sequence-shift"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-branch-late-audible-sequence-shift",
      name: "Late-Audible Sequence Shift",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared fatigue_load expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/sequence-shift-branch-late-audible-sequence-shift",
        "sim-variants/sequence-shift-branch-late-audible-sequence-shift"
      ],
      aliases: [
        "sequence-shift-branch-late-audible-sequence-shift"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-branch-late-pressure-endurance-lock",
      name: "Late-Pressure Endurance Lock",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared fatigue_load expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/endurance-lock-branch-late-pressure-endurance-lock",
        "sim-variants/endurance-lock-branch-late-pressure-endurance-lock"
      ],
      aliases: [
        "endurance-lock-branch-late-pressure-endurance-lock"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-branch-long-reset-endurance-lock",
      name: "Long-Reset Endurance Lock",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared fatigue_load expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/endurance-lock-branch-long-reset-endurance-lock",
        "sim-variants/endurance-lock-branch-long-reset-endurance-lock"
      ],
      aliases: [
        "endurance-lock-branch-long-reset-endurance-lock"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-branch-sustained-focus-endurance-lock",
      name: "Sustained-Focus Endurance Lock",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared fatigue_load expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/endurance-lock-branch-sustained-focus-endurance-lock",
        "sim-variants/endurance-lock-branch-sustained-focus-endurance-lock"
      ],
      aliases: [
        "endurance-lock-branch-sustained-focus-endurance-lock"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-library-burn-rate",
      name: "Burn Rate",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared fatigue_load expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/endurance-lock-library-burn-rate",
        "sim-variants/endurance-lock-library-burn-rate"
      ],
      aliases: [
        "endurance-lock-library-burn-rate"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-library-fatigue-filter",
      name: "Fatigue Filter",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared fatigue_load expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/endurance-lock-library-fatigue-filter",
        "sim-variants/endurance-lock-library-fatigue-filter"
      ],
      aliases: [
        "endurance-lock-library-fatigue-filter"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-library-late-clock",
      name: "Late Clock",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared fatigue_load expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/endurance-lock-library-late-clock",
        "sim-variants/endurance-lock-library-late-clock"
      ],
      aliases: [
        "endurance-lock-library-late-clock"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-library-long-reset",
      name: "Long Reset",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared fatigue_load expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/endurance-lock-library-long-reset",
        "sim-variants/endurance-lock-library-long-reset"
      ],
      aliases: [
        "endurance-lock-library-long-reset"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-branch-extended-trial-reset",
      name: "Extended Trial Reset",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared trial expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/reset-branch-extended-trial-reset",
        "sim-variants/reset-branch-extended-trial-reset"
      ],
      aliases: [
        "reset-branch-extended-trial-reset"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-branch-field-read-trial-signal-window",
      name: "Field-Read Trial Signal Window",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared trial expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/signal-window-branch-field-read-trial-signal-window",
        "sim-variants/signal-window-branch-field-read-trial-signal-window"
      ],
      aliases: [
        "signal-window-branch-field-read-trial-signal-window"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-branch-trial-only-fatigability-probe",
      name: "Trial-Only Fatigability Probe",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared trial expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/endurance-lock-branch-trial-only-fatigability-probe",
        "sim-variants/endurance-lock-branch-trial-only-fatigability-probe"
      ],
      aliases: [
        "endurance-lock-branch-trial-only-fatigability-probe"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-branch-immersive-reset-chamber",
      name: "Immersive Reset Chamber",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared immersive expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/reset-branch-immersive-reset-chamber",
        "sim-variants/reset-branch-immersive-reset-chamber"
      ],
      aliases: [
        "reset-branch-immersive-reset-chamber"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-library-reset-chamber",
      name: "Reset Chamber",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared immersive expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/reset-library-reset-chamber",
        "sim-variants/reset-library-reset-chamber"
      ],
      aliases: [
        "reset-library-reset-chamber"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-library-tunnel-line",
      name: "Tunnel Line",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared immersive expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/noise-gate-library-tunnel-line",
        "sim-variants/noise-gate-library-tunnel-line"
      ],
      aliases: [
        "noise-gate-library-tunnel-line"
      ],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-branch-immersive-spatial-brake",
      name: "Immersive Spatial Brake",
      type: "simulation",
      readiness: "active named variant requires mechanics adaptation",
      rationale: "Declared immersive expression follows the relevant family introduction and simpler expressions. Preserve its name/order while flagging engine/config mismatch; title is not proof of implemented complexity or efficacy.",
      sourceRefs: [
        "sim-modules/brake-point-branch-immersive-spatial-brake",
        "sim-variants/brake-point-branch-immersive-spatial-brake"
      ],
      aliases: [
        "brake-point-branch-immersive-spatial-brake"
      ],
      catalogType: "simulation",
      classificationReason: ""
    }
  ],
  candidates: [
    {
      id: "blind-commit-branch-confidence-calibration",
      name: "Confidence Calibration",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/blind-commit-branch-confidence-calibration"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "blind-commit-branch-forced-commit-under-timer",
      name: "Forced-Commit Under Timer",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/blind-commit-branch-forced-commit-under-timer"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "blind-commit-branch-late-reveal",
      name: "Late Reveal",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/blind-commit-branch-late-reveal"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "blind-commit-branch-partial-information-commit",
      name: "Partial-Information Commit",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/blind-commit-branch-partial-information-commit"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-library-decoy-lane",
      name: "Decoy Lane",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/brake-point-library-decoy-lane"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-library-false-key",
      name: "False Key",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/brake-point-library-false-key"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-library-false-start",
      name: "False Start",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/brake-point-library-false-start"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-library-red-light",
      name: "Red Light",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/brake-point-library-red-light"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "brake-point-library-spatial-brake",
      name: "Spatial Brake",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/brake-point-library-spatial-brake"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "chaos-read-branch-blindside",
      name: "Blindside",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/chaos-read-branch-blindside"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "chaos-read-branch-compressed-chaos",
      name: "Compressed Chaos",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/chaos-read-branch-compressed-chaos"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "chaos-read-branch-noise-to-choice",
      name: "Noise to Choice",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/chaos-read-branch-noise-to-choice"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "chaos-read-branch-reset-and-read",
      name: "Reset and Read",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/chaos-read-branch-reset-and-read"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "chaos-read-hybrid-noise-to-choice-hybrid",
      name: "Noise to Choice (Hybrid)",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/chaos-read-hybrid-noise-to-choice-hybrid"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-hybrid-last-rep",
      name: "Last Rep",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/endurance-lock-hybrid-last-rep"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "endurance-lock-hybrid-two-minute-drill",
      name: "Two-Minute Drill",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/endurance-lock-hybrid-two-minute-drill"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "fault-line-branch-bounce-back",
      name: "Bounce Back",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/fault-line-branch-bounce-back"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "fault-line-branch-error-spiral",
      name: "Error Spiral",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/fault-line-branch-error-spiral"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "fault-line-branch-next-play",
      name: "Next Play",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/fault-line-branch-next-play"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "fault-line-branch-post-miss-reset",
      name: "Post-Miss Reset",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/fault-line-branch-post-miss-reset"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "fault-line-branch-tilt-test",
      name: "Tilt Test",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/fault-line-branch-tilt-test"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "heat-check-branch-coach-watch-mode",
      name: "Coach-Watch Mode",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/heat-check-branch-coach-watch-mode"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "heat-check-branch-last-play",
      name: "Last Play",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/heat-check-branch-last-play"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "heat-check-branch-public-eye",
      name: "Public Eye",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/heat-check-branch-public-eye"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "heat-check-branch-ranking-pressure",
      name: "Ranking Pressure",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/heat-check-branch-ranking-pressure"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "heat-check-branch-score-on-the-line",
      name: "Score-On-The-Line",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/heat-check-branch-score-on-the-line"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "heat-check-hybrid-pressure-room",
      name: "Pressure Room",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/heat-check-hybrid-pressure-room"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-branch-fatigue-state-noise-gate",
      name: "Fatigue-State Noise Gate",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/noise-gate-branch-fatigue-state-noise-gate"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-branch-immersive-crowd-tunnel",
      name: "Immersive Crowd Tunnel",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/noise-gate-branch-immersive-crowd-tunnel"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-library-crowd-tunnel",
      name: "Crowd Tunnel",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/noise-gate-library-crowd-tunnel"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "noise-gate-library-peripheral-fade",
      name: "Peripheral Fade",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/noise-gate-library-peripheral-fade"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "quiet-eye-branch-anticipatory-anchor",
      name: "Anticipatory Anchor",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/quiet-eye-branch-anticipatory-anchor"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "quiet-eye-branch-fixation-under-pressure",
      name: "Fixation Under Pressure",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/quiet-eye-branch-fixation-under-pressure"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "quiet-eye-branch-gaze-hold",
      name: "Gaze Hold",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/quiet-eye-branch-gaze-hold"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "quiet-eye-branch-pre-shot-lock",
      name: "Pre-Shot Lock",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/quiet-eye-branch-pre-shot-lock"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-branch-sport-context-reset",
      name: "Sport-Context Reset",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/reset-branch-sport-context-reset"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-hybrid-overload",
      name: "Overload",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/reset-hybrid-overload"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-hybrid-recovery-chain",
      name: "Recovery Chain",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/reset-hybrid-recovery-chain"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "reset-library-aftershock",
      name: "Aftershock",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/reset-library-aftershock"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-library-broken-play",
      name: "Broken Play",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/sequence-shift-library-broken-play"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-library-pattern-shift",
      name: "Pattern Shift",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/sequence-shift-library-pattern-shift"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "sequence-shift-library-switchboard",
      name: "Switchboard",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/sequence-shift-library-switchboard"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-branch-ambiguous-signal-window",
      name: "Ambiguous Signal Window",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-branch-ambiguous-signal-window"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-branch-decoy-signal-window",
      name: "Decoy Signal Window",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-branch-decoy-signal-window"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-branch-spatial-read-signal-window",
      name: "Spatial Read Signal Window",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-branch-spatial-read-signal-window"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-hybrid-field-mirror",
      name: "Field Mirror",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-hybrid-field-mirror"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-library-check-down",
      name: "Check Down",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-library-check-down"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-library-shot-clock",
      name: "Shot Clock",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-library-shot-clock"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-library-snap-read",
      name: "Snap Read",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-library-snap-read"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-library-spatial-read",
      name: "Spatial Read",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-library-spatial-read"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-library-split-second",
      name: "Split Second",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-library-split-second"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "signal-window-library-window-close",
      name: "Window Close",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/signal-window-library-window-close"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "split-stream-branch-dual-channel-monitoring",
      name: "Dual-Channel Monitoring",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/split-stream-branch-dual-channel-monitoring"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "split-stream-branch-multi-source",
      name: "Multi-Source",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/split-stream-branch-multi-source"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "split-stream-branch-priority-stack",
      name: "Priority Stack",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/split-stream-branch-priority-stack"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    },
    {
      id: "split-stream-branch-rotating-source-load",
      name: "Rotating-Source Load",
      type: "simulation",
      readiness: "hold",
      rationale: "No active published module exists. Listed separately without curricular activation or invented transfer capability.",
      sourceRefs: [
        "sim-variants/split-stream-branch-rotating-source-load"
      ],
      aliases: [],
      catalogType: "simulation",
      classificationReason: ""
    }
  ]
};

// src/api/firebase/dailyCurriculum/linearCurriculum.ts
var text = (value) => typeof value === "string" ? value : "";
var seedActive = linearCurriculumSeed_default.active;
var seedCandidates = linearCurriculumSeed_default.candidates;
var known = new Map([...seedActive, ...seedCandidates].map((entry) => [entry.id, entry]));
var buildLinearCurriculumCatalog = (records) => {
  const active = /* @__PURE__ */ new Map();
  const aliasToCanonical = /* @__PURE__ */ new Map();
  const makeEntry = (record2, type, collection) => {
    const prior = known.get(record2.id);
    return {
      id: record2.id,
      name: text(record2.label) || text(record2.name) || text(record2.variantName) || prior?.name || record2.id,
      type: prior?.type || type,
      readiness: prior?.readiness || "New catalog entry: review gameplay, classification and position",
      rationale: prior?.rationale || "New active skill. Review its place before adopting this curriculum.",
      sourceRefs: [...prior?.sourceRefs || [], `${collection}/${record2.id}`].filter((v, i, all) => all.indexOf(v) === i),
      aliases: [...new Set([record2.id, ...prior?.aliases || [], text(record2.legacyExerciseId)].filter(Boolean))],
      catalogType: type,
      classificationReason: prior?.classificationReason || "Classification follows the source until reviewed."
    };
  };
  for (const record2 of records["pulsecheck-protocols"] || []) {
    if (record2.isActive !== true) continue;
    const entry = makeEntry(record2, "protocol", "pulsecheck-protocols");
    if (record2.publishStatus !== "published") entry.readiness = "Active protocol is unpublished: review only";
    active.set(entry.id, entry);
    if (text(record2.legacyExerciseId)) aliasToCanonical.set(text(record2.legacyExerciseId), entry.id);
  }
  for (const collection of ["sim-modules", "mental-exercises"]) {
    for (const record2 of records[collection] || []) {
      if (record2.isActive !== true) continue;
      const id = aliasToCanonical.get(record2.id) || record2.id;
      const existing = active.get(id);
      if (existing) {
        existing.sourceRefs = [.../* @__PURE__ */ new Set([...existing.sourceRefs, `${collection}/${record2.id}`])];
        existing.aliases = [.../* @__PURE__ */ new Set([...existing.aliases, record2.id])];
      } else active.set(id, makeEntry(record2, "simulation", collection));
    }
  }
  const proposedOrder = [
    ...seedActive.map((entry) => entry.id).filter((id) => active.has(id)),
    ...[...active.keys()].filter((id) => !seedActive.some((entry) => entry.id === id)).sort()
  ];
  for (const collection of ["sim-variants", "pulsecheck-protocol-variants"]) {
    for (const record2 of records[collection] || []) {
      const linkedId = text(record2.publishedModuleId) || text(record2.legacyExerciseId);
      const canonical = aliasToCanonical.get(linkedId) || linkedId;
      const entry = active.get(canonical);
      if (entry) entry.sourceRefs = [.../* @__PURE__ */ new Set([...entry.sourceRefs, `${collection}/${record2.id}`])];
    }
  }
  const candidates = /* @__PURE__ */ new Map();
  for (const collection of ["sim-variants", "pulsecheck-protocol-variants", "pulsecheck-protocols", "sim-modules", "mental-exercises"]) {
    for (const record2 of records[collection] || []) {
      const canonical = aliasToCanonical.get(record2.id) || record2.id;
      if (active.has(canonical)) continue;
      const entry = makeEntry(record2, collection.startsWith("pulsecheck-protocol") ? "protocol" : "simulation", collection);
      entry.readiness = "Unpublished or inactive: outside active sequence";
      candidates.set(record2.id, entry);
    }
  }
  for (const entry of active.values()) {
    for (const ref of entry.sourceRefs) {
      const [collection, id] = ref.split("/");
      if (collection === "sim-variants" || collection === "pulsecheck-protocol-variants") candidates.delete(id);
    }
  }
  const entries = proposedOrder.map((id) => active.get(id));
  const fingerprint = JSON.stringify(entries.map((entry) => [entry.id, entry.type, entry.name, entry.sourceRefs.slice().sort()]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  return { active: entries, candidates: [...candidates.values()].sort((a, b) => a.name.localeCompare(b.name)), proposedOrder, fingerprint };
};

// src/lib/coach-dashboard/curriculumOutline.ts
function outlineRows(skills, athletes, next = /* @__PURE__ */ new Map()) {
  return skills.map((skill) => ({ id: skill.id, name: skill.name, type: skill.type, currentCount: athletes.filter((a) => a.currentSkill && [skill.id, ...skill.aliases || []].includes(a.currentSkill.id)).length, nextCount: next.get(skill.id) || 0 }));
}
async function loadCoachCurriculumOutline(db, athletes) {
  try {
    const names = ["pulsecheck-protocols", "sim-modules", "mental-exercises"];
    const snaps = await Promise.all(names.map((name) => db.collection(name).where("isActive", "==", true).select("label", "name", "variantName", "isActive", "publishStatus", "legacyExerciseId").limit(2001).get()));
    if (snaps.some((s) => s.size > 2e3)) return { status: "unavailable", sequences: [] };
    const catalog = buildLinearCurriculumCatalog(Object.fromEntries(snaps.map((s, i) => [names[i], s.docs.map((d) => ({ ...d.data(), id: d.id }))])));
    const lookup = new Map(catalog.active.map((skill) => [skill.id, skill]));
    const ordered = catalog.proposedOrder.flatMap((id) => lookup.has(id) ? [lookup.get(id)] : []);
    return { status: "available", sequences: [{ id: "full-library", title: "Full skill list", description: "All active skills in the curriculum library. Current assignments are marked below. This list does not change athlete assignments.", skills: outlineRows(ordered, athletes) }] };
  } catch {
    return { status: "unavailable", sequences: [] };
  }
}

// src/lib/coach-dashboard/lifetimeParticipation.ts
var import_firebase_admin = require("firebase-admin");

// netlify/functions/utils/teamShowingUpScore.ts
var numberValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return void 0;
};
var dictionaryValue = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
var normalizedString = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
var hasMorningCheckIn = (checkIn) => normalizedString(checkIn?.level).length > 0;
var hasEveningCheckIn = (checkIn) => normalizedString(checkIn?.eveningCheckIn?.level).length > 0;
var wearableSourceFamilies = /* @__PURE__ */ new Set([
  "oura",
  "apple_health",
  "healthkit",
  "health_kit",
  "apple_watch",
  "healthconnect",
  "health_connect",
  "google_wearables",
  "google-wearables",
  "polar",
  "fitbit",
  "whoop",
  "garmin"
]);
var nonWearableSourceFamilies = /* @__PURE__ */ new Set([
  "quicklifts",
  "fit_with_pulse",
  "pulsecheck_self_report",
  "coach_entered",
  "manual"
]);
var mergeBlockData = (block) => {
  const source = dictionaryValue(block);
  const nestedData = dictionaryValue(source.data);
  const nestedPayload = dictionaryValue(source.payload);
  const nestedRollup = dictionaryValue(source.rollup);
  const direct = Object.fromEntries(
    Object.entries(source).filter(([key]) => ![
      "data",
      "payload",
      "rollup",
      "freshness",
      "provenance",
      "sourceStatus",
      "generatedAt",
      "updatedAt"
    ].includes(key))
  );
  return { ...direct, ...nestedData, ...nestedPayload, ...nestedRollup };
};
var normalizedSourceFamily = (value) => normalizedString(value).replace(/-/g, "_");
var sourceFamilyForDomain = (snapshot, domain, block) => normalizedSourceFamily(
  block.provenance?.primarySource || snapshot.provenance?.domainWinners?.[domain] || block.sourceFamily || snapshot.provenance?.sourcesUsed?.[0] || snapshot.sourceFamily
);
var sourceCanRepresentWearable = (sourceFamily) => {
  if (!sourceFamily) return true;
  if (nonWearableSourceFamilies.has(sourceFamily)) return false;
  return wearableSourceFamilies.has(sourceFamily) || sourceFamily.includes("wearable");
};
var freshnessIsUsable = (value) => {
  const freshness = normalizedString(value);
  return !freshness || !["missing", "stale", "error", "permission_denied", "not_connected"].includes(freshness);
};
var hasUsableMetric = (data, keys) => {
  const normalizedData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key.toLowerCase(), value])
  );
  for (const key of keys) {
    const value = normalizedData[key.toLowerCase()];
    const numeric = numberValue(value);
    if (numeric !== void 0 && numeric > 0) return true;
    if (typeof value === "string" && value.trim()) return true;
    if (Array.isArray(value) && value.length > 0) return true;
  }
  return false;
};
var resolveWearableCoverageFromSnapshot = (snapshot) => {
  if (!snapshot) return { hasDaytime: false, hasOvernight: false };
  const domains = dictionaryValue(snapshot.domains);
  const freshness = dictionaryValue(snapshot.freshness);
  const perDomainFreshness = dictionaryValue(freshness.perDomain);
  const result = { hasDaytime: false, hasOvernight: false };
  const daytimeMetricKeys = [
    "steps",
    "activeCalories",
    "activecalories",
    "totalCalories",
    "totalcalories",
    "distance",
    "distanceMeters",
    "exerciseMinutes",
    "activeMinutes",
    "standHours",
    "workoutCount",
    "heartRateAvg",
    "avgHeartRate",
    "averageHeartRate",
    "heartRateAverage",
    "heartRateBpm",
    "liveHeartRateBpm",
    "sampleCount",
    "heartRateSamples"
  ];
  const overnightMetricKeys = [
    "sleepDuration",
    "sleepDurationHours",
    "totalSleepHours",
    "totalSleepMin",
    "totalSleepMinutes",
    "sleepEfficiency",
    "sleepScore",
    "timeInBedHours",
    "bedtimeStart",
    "bedtimeEnd",
    "sleepMidpoint",
    "recoveryScore",
    "readinessScore",
    "heartRateVariability",
    "hrv",
    "hrvMs",
    "hrvRmssd",
    "rmssdMs",
    "restingHeartRate",
    "heartRateResting",
    "restingHeartRateBpm"
  ];
  for (const domain of ["activity", "training", "workout", "biometrics", "cardio", "heart"]) {
    const block = dictionaryValue(domains[domain] || snapshot[domain]);
    if (!Object.keys(block).length) continue;
    const sourceFamily = sourceFamilyForDomain(snapshot, domain, block);
    if (!sourceCanRepresentWearable(sourceFamily)) continue;
    if (!freshnessIsUsable(block.freshness || perDomainFreshness[domain] || freshness[domain])) continue;
    if (hasUsableMetric(mergeBlockData(block), daytimeMetricKeys)) result.hasDaytime = true;
  }
  for (const domain of ["recovery", "sleep"]) {
    const block = dictionaryValue(domains[domain] || snapshot[domain]);
    if (!Object.keys(block).length) continue;
    const sourceFamily = sourceFamilyForDomain(snapshot, domain, block);
    if (!sourceCanRepresentWearable(sourceFamily)) continue;
    if (!freshnessIsUsable(block.freshness || perDomainFreshness[domain] || freshness[domain])) continue;
    if (hasUsableMetric(mergeBlockData(block), overnightMetricKeys)) result.hasOvernight = true;
  }
  return result;
};

// src/lib/coach-dashboard/participationSources.ts
var families = ["oura", "apple_health", "healthkit", "health_kit", "apple_watch", "healthconnect", "google_health", "polar", "fitbit", "whoop", "garmin"];
var connected = /* @__PURE__ */ new Set(["connected", "synced", "stale", "connectedsynced", "connectedwaitingdata", "connectedstale", "connectederror"]);
var record = (value) => value && typeof value === "object" ? value : {};
function participationTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value > 1e12 ? value : value * 1e3;
  if (typeof value === "string") {
    const date = Date.parse(value);
    return Number.isFinite(date) ? date : null;
  }
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.seconds === "number") return value.seconds * 1e3;
  return null;
}
function scheduledParticipationDates(dates, user, member) {
  const activation = participationTimestamp(user.activatedAt ?? user.joinedAt ?? user.createdAt);
  const joined = participationTimestamp(member.grantedAt ?? member.joinedAt ?? member.createdAt);
  const starts = [activation, joined].filter((v) => v !== null);
  const start = starts.length ? new Date(Math.max(...starts)).toISOString().slice(0, 10) : null;
  return dates.filter((date) => !start || date >= start);
}
function coverageForDays(completed, expected) {
  const count = expected.filter((d) => completed.has(d)).length;
  return { completed: count, expected: expected.length, rate: expected.length ? Math.round(count / expected.length * 100) : null, status: "available" };
}
async function loadCurrentLinearSkill(db, athleteId, state) {
  if (state.optedIn !== true || state.athleteId !== athleteId) return null;
  const pin = record(state.currentSkill);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(pin.skillId || "") || !/^[A-Za-z0-9_-]{1,128}$/.test(pin.versionId || "")) return null;
  const [version, latest] = await Promise.all([
    db.collection("pulsecheck-linear-curriculum").doc("versions").collection("items").doc(pin.versionId).get(),
    db.collection("pulsecheck-linear-curriculum").doc("states").collection("items").doc(athleteId).collection("assignments").orderBy("sourceDate", "desc").limit(30).select("skillId", "versionId", "skillName", "phase").get()
  ]);
  const definition = (version.data()?.skills || []).find((skill) => skill.id === pin.skillId);
  const assignment = latest.docs.map((d) => d.data()).find((d) => d.skillId === pin.skillId && d.versionId === pin.versionId);
  const name = definition?.name || assignment?.skillName;
  if (!name) return null;
  const content = version.data()?.contentSnapshots?.[pin.skillId] || (await db.collection("pulsecheck-linear-curriculum").doc("versions").collection("items").doc(pin.versionId).collection("content").doc(pin.skillId).get()).data()?.contentSnapshot;
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return { id: pin.skillId, name: String(name).slice(0, 160), phase: assignment?.phase || null, ...content && definition ? { preview: { id: `preview-${pin.versionId}-${pin.skillId}`, versionId: pin.versionId, skillId: pin.skillId, skillName: String(name), skillType: definition.type, phase: definition.type === "simulation" ? "practice" : "learn", sourceDate: today, timezone: "UTC", windowStart: today, windowEnd: today, completedDayCount: 0, requiredDays: 5, phaseCompletedToday: false, contentSnapshot: content, clientContractVersion: 1 } } : {} };
}
var normalizeWearableFamily = (value) => {
  const family = String(value || "").toLowerCase().replace(/-/g, "_");
  if (["apple_health", "healthkit", "health_kit", "apple_watch"].includes(family)) return "healthkit";
  if (["healthconnect", "google_health"].includes(family)) return "healthconnect";
  return family;
};
var sourceScope = (data, athleteId, teamId, organizationId) => (!data.teamId || data.teamId === teamId) && (!data.organizationId || data.organizationId === organizationId) && (!data.athleteUserId || data.athleteUserId === athleteId);
async function loadWearableLifecycle(db, athleteId, teamId, organizationId) {
  const documents = await db.getAll(db.collection("health-context-source-status").doc(athleteId), db.collection("athletes").doc(athleteId).collection("health-context-source-status").doc("current"), ...families.map((f) => db.collection("health-context-source-status").doc(`${athleteId}_${f}`)));
  const statuses = documents.flatMap((doc, i) => {
    const data = doc.data();
    if (!data || !sourceScope(data, athleteId, teamId, organizationId)) return [];
    if (i > 1) return [{ ...data, family: normalizeWearableFamily(families[i - 2]) }];
    const map = record(data.sourceStatuses || data);
    return families.flatMap((f) => map[f] ? [{ ...typeof map[f] === "string" ? { status: map[f] } : record(map[f]), family: normalizeWearableFamily(f) }] : []);
  }).filter((d) => sourceScope(d, athleteId, teamId, organizationId));
  const blocked = new Set(statuses.filter((d) => d.revokedAt || d.disconnectedAt || ["disconnected", "not_connected", "notconnected", "revoked", "disabled"].includes(String(d.lifecycleState || d.status || d.connectionState || "").toLowerCase().replace(/-/g, "_"))).map((d) => d.family));
  const current = statuses.filter((d) => {
    const state = String(d.lifecycleState || d.status || d.connectionState || "").toLowerCase().replace(/-/g, "_");
    return !blocked.has(d.family) && (connected.has(state) || state.startsWith("connected_"));
  });
  return { allowed: new Set(current.map((d) => d.family)), blocked, current };
}
function snapshotFromAllowedSources(snapshot, allowed) {
  const domains = {};
  for (const domain of ["activity", "training", "workout", "biometrics", "cardio", "heart", "recovery", "sleep"]) {
    const block = record(snapshot.domains?.[domain] || snapshot[domain]);
    const source = normalizeWearableFamily(block.provenance?.primarySource || snapshot.provenance?.domainWinners?.[domain] || block.sourceFamily || (snapshot.provenance?.sourcesUsed?.length === 1 ? snapshot.provenance.sourcesUsed[0] : null) || snapshot.sourceFamily);
    if (source && allowed.has(source)) domains[domain] = block;
  }
  return { domains, freshness: snapshot.freshness, provenance: snapshot.provenance, sourceFamily: snapshot.sourceFamily };
}
async function loadWearableParticipation(db, athleteId, teamId, organizationId, dates) {
  const [snapshots, lifecycle] = await Promise.all([
    dates.length ? db.getAll(...dates.map((d) => db.collection("health-context-snapshots").doc(`${athleteId}_daily_${d}`))) : Promise.resolve([]),
    loadWearableLifecycle(db, athleteId, teamId, organizationId)
  ]);
  const days = /* @__PURE__ */ new Set();
  const periods = {};
  if (!lifecycle.allowed.size) return { days, periods, metric: { completed: 0, expected: null, rate: null, status: lifecycle.blocked.size ? "not_connected" : "unavailable", reason: lifecycle.blocked.size ? "No currently connected wearable source." : "Current wearable connection has not been verified." } };
  snapshots.forEach((snapshot, i) => {
    const data = snapshot.data();
    if (data && sourceScope(data, athleteId, teamId, organizationId)) {
      const coverage = resolveWearableCoverageFromSnapshot(snapshotFromAllowedSources(data, lifecycle.allowed));
      periods[dates[i]] = { daytime: coverage.hasDaytime, overnight: coverage.hasOvernight };
      if (coverage.hasDaytime || coverage.hasOvernight) days.add(dates[i]);
    }
  });
  const connectionDates = lifecycle.current.map((d) => participationTimestamp(d.connectedAt)).filter((v) => v !== null);
  const start = connectionDates.length ? new Date(Math.min(...connectionDates)).toISOString().slice(0, 10) : null;
  const expected = dates.filter((date) => !start || date >= start);
  const metric2 = coverageForDays(days, expected);
  if (!days.size) {
    metric2.status = "sync_pending";
    metric2.reason = "A wearable is connected. Measured data has not arrived for this window.";
  } else metric2.reason = "Measured days from currently connected wearable sources.";
  return { metric: metric2, days, periods };
}

// src/lib/coach-dashboard/noraParticipation.ts
function countNoraThreads(rows, from, to) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + 864e5;
  const active = /* @__PURE__ */ new Set();
  for (const { id, source, data } of rows) {
    if (data.syntheticRedTeam === true) continue;
    const turns = source === "chat" ? data.messages : data.turns;
    if (!Array.isArray(turns)) return null;
    for (const turn of turns) {
      const authored = source === "chat" ? turn.isFromUser === true : turn.role === "athlete-reply";
      if (!authored) continue;
      const at = participationTimestamp(source === "chat" ? turn.timestamp : turn.createdAt);
      if (at === null) return null;
      if (at >= start && at < end) {
        active.add(`${source}:${id}`);
        break;
      }
    }
  }
  return active.size;
}
async function loadNoraConversationCount(db, athleteId, from, to) {
  try {
    const [chats, prompts] = await Promise.all([
      db.collection("conversations").where("userId", "==", athleteId).select("messages", "syntheticRedTeam").limit(1001).get(),
      db.collection("pulsecheck-nora-conversations").where("athleteUserId", "==", athleteId).select("turns", "syntheticRedTeam").limit(1001).get()
    ]);
    if (chats.size > 1e3 || prompts.size > 1e3) return null;
    return countNoraThreads([
      ...chats.docs.map((doc) => ({ id: doc.id, source: "chat", data: doc.data() })),
      ...prompts.docs.map((doc) => ({ id: doc.id, source: "prompt", data: doc.data() }))
    ], from, to);
  } catch {
    return null;
  }
}

// src/lib/coach-dashboard/lifetimeParticipation.ts
function lifetimeCheckIns(canonical, legacy) {
  const morning = /* @__PURE__ */ new Set(), recovery = /* @__PURE__ */ new Set(), evening = /* @__PURE__ */ new Set();
  for (const { date, data } of canonical) {
    if (hasMorningCheckIn(data)) morning.add(date);
    if (hasEveningCheckIn(data)) evening.add(date);
    if (typeof data.subjectiveRecoveryLevel === "number" && data.subjectiveRecoveryLevel >= 1 && data.subjectiveRecoveryLevel <= 5) recovery.add(date);
  }
  for (const data of legacy) if (typeof data.date === "string" && typeof data.subjectiveRecoveryScore === "number" && data.subjectiveRecoveryScore >= 1 && data.subjectiveRecoveryScore <= 5) recovery.add(data.date);
  return { morning: morning.size, recovery: recovery.size, evening: evening.size };
}
async function loadLifetimeParticipation(db, athleteId, teamId, organizationId) {
  const empty = { morning: null, recovery: null, evening: null, skills: null, wearableDays: null, conversations: null };
  const prefix = (collection, start) => db.collection(collection).orderBy(import_firebase_admin.firestore.FieldPath.documentId()).startAt(start).endAt(start + "\uF8FF").limit(10001).get();
  const [checks, skills, wearables, conversations] = await Promise.allSettled([
    Promise.all([prefix("pulsecheck-morning-checkins", athleteId + "_"), db.collection("mental-check-ins").doc(athleteId).collection("check-ins").select("date", "subjectiveRecoveryScore").limit(10001).get()]).then(([a, b]) => a.size > 1e4 || b.size > 1e4 ? null : lifetimeCheckIns(a.docs.map((d) => ({ date: d.id.slice(athleteId.length + 1), data: d.data() })), b.docs.map((d) => d.data()))),
    Promise.all([db.collection("pulsecheck-daily-assignments").where("athleteId", "==", athleteId).select("status").limit(10001).get(), db.collection("pulsecheck-linear-curriculum").doc("states").collection("items").doc(athleteId).collection("assignments").select("completedAt").limit(10001).get()]).then(([a, b]) => a.size > 1e4 || b.size > 1e4 ? null : a.docs.filter((d) => d.data().status === "completed").length + b.docs.filter((d) => !!d.data().completedAt).length),
    prefix("health-context-snapshots", athleteId + "_daily_").then(async (s) => {
      if (s.size > 1e4) return null;
      const dates = s.docs.map((d) => d.id.slice((athleteId + "_daily_").length)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      let total = 0;
      for (let i = 0; i < Math.max(1, dates.length); i += 200) {
        const w = await loadWearableParticipation(db, athleteId, teamId, organizationId, dates.slice(i, i + 200));
        if (w.metric.status === "unavailable" || w.metric.status === "not_connected") return null;
        total += w.days.size;
      }
      return total;
    }),
    loadNoraConversationCount(db, athleteId, "1970-01-01", (/* @__PURE__ */ new Date()).toISOString().slice(0, 10))
  ]);
  return { ...empty, ...checks.status === "fulfilled" ? checks.value : {}, skills: skills.status === "fulfilled" ? skills.value : null, wearableDays: wearables.status === "fulfilled" ? wearables.value : null, conversations: conversations.status === "fulfilled" ? conversations.value : null };
}

// src/lib/coach-dashboard/skillParticipation.ts
var excluded = /* @__PURE__ */ new Set(["cancelled", "superseded", "deferred"]);
function assignmentSkillId(row) {
  const id = row.skillId || row.protocolId || row.legacyExerciseId || row.exerciseId || row.simSpecId || row.simId;
  return typeof id === "string" && id ? id : null;
}
function latestAssignedSkill(rows, teamId, from, today) {
  const active = rows.filter((row2) => row2.teamId === teamId && row2.sourceDate >= from && row2.sourceDate <= today && !excluded.has(row2.status) && row2.actionType !== "defer").sort((a, b) => String(b.sourceDate).localeCompare(String(a.sourceDate)) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  if (!active.length) return null;
  const latest = active.filter((row2) => row2.sourceDate === active[0].sourceDate);
  const row = latest.find((row2) => row2.isPrimaryForDate !== false) || latest[0];
  const id = assignmentSkillId(row);
  const name = row.protocolLabel || row.simName || row.exerciseTitle || row.moduleTitle;
  return id && typeof name === "string" && name.trim() ? { id, name: name.slice(0, 160), phase: null, assignedDate: row.sourceDate } : null;
}
function skillCompletion(rows, skillId) {
  const assigned = rows.filter((row) => assignmentSkillId(row) === skillId && !excluded.has(row.status));
  const completed = assigned.filter((row) => row.completedAt || row.status === "completed").length;
  return { completed, expected: assigned.length, rate: assigned.length ? Math.round(completed / assigned.length * 100) : null };
}

// src/lib/coach-dashboard/types.ts
var TRAINER_SHARING_VERSION = "team-trainer-aggregates-v1";
var TRAINER_SHARING_FIELDS = ["mood", "recovery", "wearables", "journaling"];
function trainerSharingChoices(grant, athleteId, teamId) {
  if (grant === void 0) return { mood: true, recovery: true, wearables: true, journaling: true };
  const valid = grant.athleteId === athleteId && grant.teamId === teamId && grant.version === TRAINER_SHARING_VERSION;
  return Object.fromEntries(TRAINER_SHARING_FIELDS.map((field) => [field, valid && grant.choices?.[field] === true]));
}

// src/lib/coach-dashboard/data.ts
var DAY = 864e5;
var MIN_CONTRIBUTORS = 1;
var deviceFamilies = /* @__PURE__ */ new Set(["oura", "apple_health", "healthkit", "health_kit", "apple_watch", "healthconnect", "google_health", "polar", "fitbit", "whoop", "garmin"]);
var metric = (completed, expected, reason) => ({ completed, expected, rate: expected && expected > 0 ? Math.round(completed / expected * 100) : null, status: expected == null ? "unavailable" : "available", ...reason ? { reason } : {} });
var boundedText = (v, fallback) => typeof v === "string" && v.trim() ? v.trim().slice(0, 160) : fallback;
function sharingAllows(grant, uid, teamId, field) {
  return TRAINER_SHARING_FIELDS.includes(field) && trainerSharingChoices(grant, uid, teamId)[field];
}
function aggregateCard(rows, eligible, source, asOf, units) {
  const contributors = rows.length;
  if (contributors < MIN_CONTRIBUTORS) return { status: contributors ? "insufficient_responses" : "unavailable", reason: "No shared measurements were recorded in the last 7 days.", contributors: 0, eligible, source, asOf, values: [] };
  const values = Object.keys(units).flatMap((label) => {
    const samples = rows.map((r) => r[label]).filter(Number.isFinite);
    return samples.length >= MIN_CONTRIBUTORS ? [{ label, value: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length * 10) / 10, unit: units[label] }] : [];
  });
  return { status: values.length ? "available" : "insufficient_responses", contributors, eligible, source, asOf, values };
}
async function loadDashboard(db, uid, teamId, view, now = Date.now(), historicalSkills = false) {
  const { membership, team, access } = await loadTeamAccess(db, uid, teamId);
  if (!(view === "wellbeing" ? access.wellbeing : access.participation)) throw new DashboardAccessError(403, view === "wellbeing" ? "An explicit athletic trainer permission is required." : "Team participation access is required.");
  const to = new Date(now - DAY).toISOString().slice(0, 10);
  const from = new Date(now - DAY * 7).toISOString().slice(0, 10);
  const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * DAY).toISOString().slice(0, 10));
  const roster = await db.collection("pulsecheck-team-memberships").where("teamId", "==", teamId).get();
  const athletes = roster.docs.map((d) => d.data()).filter((d) => d.role === "athlete" && d.organizationId === team.organizationId && activeRecord(d) && validTeamId(d.userId) && visibleAthlete(membership, d.userId));
  if (athletes.length > 250) throw new DashboardAccessError(503, "This team needs a paginated dashboard before it can be displayed.");
  if (view === "wellbeing" && membership.rosterVisibilityScope !== "team" && membership.rosterVisibilityScope != null) throw new DashboardAccessError(403, "Team-wide trainer scope is required for aggregate wellbeing.");
  const asOf = new Date(now).toISOString();
  const daily = dates.map((date) => ({ date, checkIns: 0, skillTraining: 0, wearables: 0 }));
  const moodRows = [], recoveryRows = [], wearableRows = [], journalRows = [];
  const result = [];
  for (let offset = 0; offset < athletes.length; offset += 10) {
    const batch = await Promise.all(athletes.slice(offset, offset + 10).map(async (member) => {
      const athleteId = member.userId;
      if (view === "wellbeing") {
        const grant = (await db.collection("pulsecheck-trainer-sharing").doc(`${teamId}_${athleteId}`).get()).data();
        if (sharingAllows(grant, athleteId, teamId, "mood") || sharingAllows(grant, athleteId, teamId, "recovery")) {
          const checkins2 = await db.collection("mental-check-ins").doc(athleteId).collection("check-ins").where("date", ">=", from).where("date", "<=", to).select("date", "moodWord", "subjectiveRecoveryScore").get();
          const perDay = /* @__PURE__ */ new Map();
          for (const doc of checkins2.docs) perDay.set(doc.data().date, doc.data());
          const canonical2 = await db.getAll(...dates.map((date) => db.collection("pulsecheck-morning-checkins").doc(`${athleteId}_${date}`)));
          canonical2.forEach((doc, index) => {
            const d = doc.data();
            if (!d) return;
            const existing = perDay.get(dates[index]) || {};
            perDay.set(dates[index], { ...existing, subjectiveRecoveryScore: d.subjectiveRecoveryLevel ?? existing.subjectiveRecoveryScore });
          });
          const values = [...perDay.values()];
          const moodScores = { tough: 1, drained: 1, heavy: 2, low: 2, okay: 3, ok: 3, good: 4, solid: 4, great: 5, locked: 5 };
          const moods = values.map((d) => moodScores[String(d.moodWord || "").trim().toLowerCase()]).filter(Number.isFinite);
          if (sharingAllows(grant, athleteId, teamId, "mood") && moods.length) moodRows.push({ "Reported mood": moods.reduce((a, b) => a + b, 0) / moods.length });
          if (sharingAllows(grant, athleteId, teamId, "recovery")) {
            const row = {};
            for (const [field, label] of [["subjectiveRecoveryScore", "Reported recovery"]]) {
              const n = values.map((d) => d[field]).filter((v) => typeof v === "number" && v >= 1 && v <= 5);
              if (n.length) row[label] = n.reduce((a, b) => a + b, 0) / n.length;
            }
            if (Object.keys(row).length) recoveryRows.push(row);
          }
        }
        if (sharingAllows(grant, athleteId, teamId, "wearables")) {
          const lifecycle = await loadWearableLifecycle(db, athleteId, teamId, team.organizationId);
          const records = await db.collection("health-context-source-records").where("athleteUserId", "==", athleteId).where("status", "==", "active").where("observedAt", ">=", Date.parse(`${from}T00:00:00Z`) / 1e3).where("observedAt", "<", Date.parse(`${to}T00:00:00Z`) / 1e3 + 86400).orderBy("observedAt", "desc").select("observedAt", "status", "sourceFamily", "payload", "provenance").get();
          const rows = records.docs.map((d) => d.data()).filter((d) => d.status === "active" && deviceFamilies.has(d.sourceFamily) && lifecycle.allowed.has(normalizeWearableFamily(d.sourceFamily)) && d.provenance?.mode === "direct" && d.observedAt >= Date.parse(`${from}T00:00:00Z`) / 1e3 && d.observedAt < Date.parse(`${to}T00:00:00Z`) / 1e3 + 86400);
          const row = {};
          for (const [label, min, max] of [["Sleep duration", 0, 24], ["Resting heart rate", 25, 220]]) {
            const vals = rows.map((d) => {
              const p = d.payload || {};
              const first = (keys) => keys.map((k) => p[k]).find((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
              return label === "Sleep duration" ? first(["sleepDuration", "sleepDurationHours", "totalSleepHours"]) ?? (first(["totalSleepMin", "totalSleepMinutes", "sleepDurationMinutes"]) ?? NaN) / 60 : first(["restingHeartRate", "heartRateResting"]);
            }).filter((v) => typeof v === "number" && v > min && v <= max);
            if (vals.length) row[label] = vals.reduce((a, b) => a + b, 0) / vals.length;
          }
          if (Object.keys(row).length) wearableRows.push(row);
        }
        if (sharingAllows(grant, athleteId, teamId, "journaling")) {
          const entries = await db.collection("pulsecheck-evidence-journals").doc(athleteId).collection("entries").where("createdAt", ">=", Date.parse(`${from}T00:00:00Z`)).where("createdAt", "<", Date.parse(`${to}T00:00:00Z`) + DAY).select("createdAt").get();
          journalRows.push({ "Entries per sharing athlete": entries.size });
        }
        return null;
      }
      const [user, checkins, canonical, state, assignments, noraConversationCount, lifetime] = await Promise.all([
        db.collection("users").doc(athleteId).get(),
        db.collection("mental-check-ins").doc(athleteId).collection("check-ins").where("date", ">=", from).where("date", "<=", to).select("date", "subjectiveRecoveryScore").get(),
        db.getAll(...dates.map((d) => db.collection("pulsecheck-morning-checkins").doc(`${athleteId}_${d}`))),
        db.collection("pulsecheck-linear-curriculum").doc("states").collection("items").doc(athleteId).get(),
        db.collection("pulsecheck-daily-assignments").where("athleteId", "==", athleteId).select("sourceDate", "status", "teamId", "moduleTitle", "exerciseTitle", "exerciseId", "simId", "actionType", "protocolId", "protocolLabel", "simSpecId", "simName", "legacyExerciseId", "isPrimaryForDate", "updatedAt", "createdAt").get(),
        loadNoraConversationCount(db, athleteId, from, to),
        loadLifetimeParticipation(db, athleteId, teamId, team.organizationId)
      ]);
      const checkDays = new Set(checkins.docs.map((d) => d.data().date));
      canonical.forEach((d, i) => {
        if (d.exists && (hasMorningCheckIn(d.data()) || hasEveningCheckIn(d.data()))) checkDays.add(dates[i]);
      });
      const stateData = state.data();
      let currentSkill = null;
      let assigned = [];
      if (stateData?.optedIn === true && stateData.athleteId === athleteId) {
        if (!historicalSkills) currentSkill = await loadCurrentLinearSkill(db, athleteId, stateData);
        const history = await state.ref.collection("assignments").where("sourceDate", ">=", from).where("sourceDate", "<=", to).select("sourceDate", "completedAt", "phase", "skillId", "skillName").get();
        assigned = history.docs.map((d) => d.data());
      } else {
        const legacyAssignments = assignments.docs.map((d) => d.data());
        assigned = legacyAssignments.filter((d) => d.teamId === teamId && dates.includes(d.sourceDate) && !["cancelled", "superseded", "deferred"].includes(d.status));
        if (!historicalSkills) currentSkill = latestAssignedSkill(legacyAssignments, teamId, from, new Date(now).toISOString().slice(0, 10));
      }
      if (currentSkill) currentSkill = { ...currentSkill, progress: skillCompletion(assigned, currentSkill.id) };
      if (historicalSkills) {
        const latest = [...assigned].sort((a, b) => String(b.sourceDate).localeCompare(String(a.sourceDate))).find((a) => a.skillName || a.exerciseTitle || a.moduleTitle);
        if (latest) currentSkill = { id: String(latest.skillId || latest.exerciseId || latest.simId || "assigned-skill"), name: boundedText(latest.skillName || latest.exerciseTitle || latest.moduleTitle, "Assigned skill"), phase: typeof latest.phase === "string" ? latest.phase : null };
      }
      const completed = assigned.filter((d) => d.completedAt || d.status === "completed");
      dates.forEach((d, i) => {
        if (checkDays.has(d)) daily[i].checkIns++;
        if (completed.some((a) => a.sourceDate === d)) daily[i].skillTraining++;
      });
      const u = user.data() || {};
      const expectedDates = scheduledParticipationDates(dates, u, member);
      const wearable = await loadWearableParticipation(db, athleteId, teamId, team.organizationId, expectedDates);
      dates.forEach((d, i) => {
        if (wearable.days.has(d)) daily[i].wearables++;
      });
      const image = u.profileImage?.profileImageURL || u.profileImageUrl;
      return { id: athleteId, lifetime, noraConversationCount, displayName: boundedText(u.displayName || u.username, "Athlete"), avatarUrl: typeof image === "string" && image.startsWith("https://") ? image : null, checkIns: coverageForDays(checkDays, expectedDates), skillTraining: metric(completed.length, assigned.length), wearables: wearable.metric, currentSkill, dailyParticipation: dates.map((date, index) => ({ date, morningCompleted: hasMorningCheckIn(canonical[index]?.data()), eveningCompleted: hasEveningCheckIn(canonical[index]?.data()), recoveryCompleted: [canonical[index]?.data()?.subjectiveRecoveryLevel, ...checkins.docs.filter((d) => d.data().date === date).map((d) => d.data().subjectiveRecoveryScore)].some((value) => typeof value === "number" && value >= 1 && value <= 5), wearableDaytime: wearable.periods[date]?.daytime, wearableOvernight: wearable.periods[date]?.overnight, wearableRecorded: wearable.days.has(date), checkIn: checkDays.has(date), scheduled: expectedDates.includes(date), skillAssigned: assigned.filter((a) => a.sourceDate === date).length, skillCompleted: completed.filter((a) => a.sourceDate === date).length })) };
    }));
    result.push(...batch.filter((r) => r !== null));
  }
  if (view === "wellbeing") return { teamId, asOf, minimumContributors: MIN_CONTRIBUTORS, mood: aggregateCard(moodRows, athletes.length, "Reported check-ins", asOf, { "Reported mood": "/5" }), recovery: aggregateCard(recoveryRows, athletes.length, "Self-reported check-ins", asOf, { "Reported recovery": "/5" }), wearables: aggregateCard(wearableRows, athletes.length, "Consented connected wearable records", asOf, { "Sleep duration": "hours", "Resting heart rate": "bpm" }), journaling: aggregateCard(journalRows, athletes.length, "Journal activity counts only", asOf, { "Entries per sharing athlete": "entries" }) };
  const skills = [];
  for (const athlete of result) if (athlete.currentSkill) {
    let group = skills.find((s) => s.id === athlete.currentSkill.id);
    if (!group) {
      group = { ...athlete.currentSkill, athleteCount: 0, phases: {}, progress: { completed: 0, expected: 0, rate: null } };
      skills.push(group);
    }
    group.athleteCount++;
    if (athlete.currentSkill.progress && group.progress) {
      group.progress.completed += athlete.currentSkill.progress.completed;
      group.progress.expected += athlete.currentSkill.progress.expected;
      group.progress.rate = group.progress.expected ? Math.round(group.progress.completed / group.progress.expected * 100) : null;
    }
    const phase = athlete.currentSkill.phase || "Unknown";
    group.phases[phase] = (group.phases[phase] || 0) + 1;
  }
  const curriculum = await loadCoachCurriculumOutline(db, result);
  return { curriculum, teamId, asOf, from, to, canViewWellbeing: access.wellbeing, athletes: result, adherence: { checkIns: metric(result.reduce((s, a) => s + a.checkIns.completed, 0), result.reduce((s, a) => s + (a.checkIns.expected || 0), 0)), skillTraining: metric(result.reduce((s, a) => s + a.skillTraining.completed, 0), result.reduce((s, a) => s + (a.skillTraining.expected || 0), 0)), wearables: metric(result.reduce((s, a) => s + a.wearables.completed, 0), result.some((a) => a.wearables.expected !== null) ? result.reduce((s, a) => s + (a.wearables.expected || 0), 0) : null, "Measured days among verified connected sources; unavailable connections are excluded.") }, daily, skills: skills.sort((a, b) => b.athleteCount - a.athleteCount), limitations: ["Seven completed UTC days.", "Daily check-in schedule starts at account activation or team joining.", "Wearable coverage excludes unavailable and disconnected sources; missing sync remains separate from completion."] };
}

// src/lib/coach-dashboard/reportDelivery.ts
var DAY2 = 864e5;
function validateDeliveryConfig(v) {
  if (!v || !validTeamId(v.teamId) || typeof v.dailyEnabled !== "boolean" || typeof v.weeklyEnabled !== "boolean" || !Number.isInteger(v.sendHour) || v.sendHour < 0 || v.sendHour > 23) throw new Error("Choose a team, report types, and valid delivery hour.");
  if (typeof v.timeZone !== "string") throw new Error("Choose a time zone.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v.timeZone }).format();
  } catch {
    throw new Error("Choose a valid time zone.");
  }
  if (typeof v.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.startDate) || !Number.isFinite(Date.parse(v.startDate)) || new Date(v.startDate).toISOString().slice(0, 10) !== v.startDate) throw new Error("Choose a valid start date.");
  if (!Array.isArray(v.recipientUids) || v.recipientUids.length > 30 || v.recipientUids.some((id) => !validTeamId(id))) throw new Error("Choose valid team recipients.");
  const recipientUids = [...new Set(v.recipientUids)];
  if ((v.dailyEnabled || v.weeklyEnabled) && !recipientUids.length) throw new Error("Choose at least one authorized recipient.");
  return { teamId: v.teamId, dailyEnabled: v.dailyEnabled, weeklyEnabled: v.weeklyEnabled, timeZone: v.timeZone, sendHour: v.sendHour, startDate: v.startDate, recipientUids };
}
async function resolveReportRecipients(db, teamId, uids) {
  const results = [];
  for (const uid of [...new Set(uids)]) {
    if ((await db.collection("account-closure-jobs").doc(uid).get()).exists) throw new Error("Recipient account is unavailable.");
    const { access } = await loadTeamAccess(db, uid, teamId);
    if (!access.participation) throw new Error("A selected recipient no longer has team participation access.");
    const user = (await db.collection("users").doc(uid).get()).data();
    const email = String(user?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A selected recipient has no valid account email.");
    results.push({ uid, email, name: String(user?.displayName || user?.username || email) });
  }
  return results;
}
function dueReports(config, now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const p = Object.fromEntries(parts.map((p2) => [p2.type, p2.value]));
  const today = `${p.year}-${p.month}-${p.day}`;
  if (today < config.startDate || Number(p.hour) < config.sendHour) return [];
  const midnight = Date.parse(today + "T00:00:00Z"), reportDate = new Date(midnight - DAY2).toISOString().slice(0, 10);
  return [...config.dailyEnabled ? [{ kind: "daily", reportDate }] : [], ...config.weeklyEnabled && new Date(midnight).getUTCDay() === 1 ? [{ kind: "weekly", reportDate }] : []];
}
var deliveryId = (teamId, uid, kind, date) => (0, import_node_crypto.createHash)("sha256").update(JSON.stringify([teamId, uid, kind, date])).digest("hex");
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function summarizeParticipation(data, from, to) {
  return data.athletes.map((a) => {
    const days = (a.dailyParticipation || []).filter((d) => d.date >= from && d.date <= to && d.scheduled);
    return { id: a.id, name: a.displayName, days: days.filter((d) => d.checkIn).length, expected: days.length, practices: days.reduce((n, d) => n + d.skillCompleted, 0), evening: days.filter((d) => d.eveningCompleted).length };
  }).filter((a) => a.expected > 0);
}
function renderParticipationReport(input) {
  const { teamName, brand, kind, to, current, previous, url } = input;
  const from = kind === "daily" ? to : new Date(Date.parse(to) - 6 * DAY2).toISOString().slice(0, 10);
  const rows = summarizeParticipation(current, from, to).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));
  const active = rows.filter((a) => a.days), missing = rows.filter((a) => !a.days), practices = rows.reduce((n, a) => n + a.practices, 0);
  const names = (list) => list.map((a) => esc(a.name)).join(", ");
  const dateLabel = (v) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(/* @__PURE__ */ new Date(v + "T12:00:00Z"));
  const period = kind === "daily" ? dateLabel(to) : `${dateLabel(from)} to ${dateLabel(to)}`;
  let body = `<h2>${active.length} of ${rows.length} athletes checked in ${kind === "daily" ? "yesterday" : "last week"}.</h2>`;
  if (kind === "daily") body += `<p><strong>Checked in:</strong> ${active.length ? names(active) : "No recorded check-ins."}</p><p><strong>${missing.length} athletes</strong> had no recorded check-in.</p><p><strong>Yesterday\u2019s assigned practices:</strong> ${practices ? `${practices} recorded as complete.` : "None recorded as complete."}</p>`;
  else {
    body += `<h3>Who is showing up</h3>${active.length ? `<table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left;padding:10px">Athlete</th><th style="text-align:left;padding:10px">Check-in routine</th></tr>${active.map((a) => `<tr><td style="padding:10px;border-bottom:1px solid #ddd">${esc(a.name)}</td><td style="padding:10px;border-bottom:1px solid #ddd">Checked in on ${a.days} of ${a.expected} days</td></tr>`).join("")}</table>` : "<p>No check-ins were recorded this week.</p>"}`;
    body += `<h3>Who to reconnect with</h3><p>${missing.length ? `${names(missing)} had no recorded check-ins during the week.` : "Every eligible athlete recorded at least one check-in."}</p>`;
    if (previous) {
      const old = summarizeParticipation(previous, previous.from, previous.to);
      body += `<h3>What changed</h3><p>${active.length} of ${rows.length} athletes checked in this week, compared with ${old.filter((a) => a.days).length} of ${old.length} last week. ${rows.filter((a) => a.days >= 3).length} checked in on at least three days, compared with ${old.filter((a) => a.days >= 3).length} last week.</p><p>Evening check-ins: ${rows.reduce((n, a) => n + a.evening, 0)} recorded this week, compared with ${old.reduce((n, a) => n + a.evening, 0)} last week.</p>`;
    }
    body += `<h3>Skill practice</h3><p>${practices ? `${practices} practices assigned for this week are recorded as complete. ${rows.filter((a) => a.practices).map((a) => `${esc(a.name)}: ${a.practices}`).join("; ")}.` : "No practices assigned for this week are recorded as complete."}</p><h3>One focus for this week</h3><p>${missing.length ? "Agree on one check-in time tied to practice. Privately ask athletes with no recorded activity whether timing or access is getting in the way." : "Keep the agreed check-in time consistent and ask the team what is helping them participate."}</p><p><strong>Next week, review:</strong> How many athletes checked in, and how many checked in on at least three days?</p>`;
  }
  const subject = `${teamName} | ${kind === "daily" ? "Daily participation" : "Weekly coach report"} | ${period}`;
  const content = `<p style="font-size:12px;letter-spacing:2px">${esc(brand.toUpperCase())} \xB7 ${kind === "daily" ? "DAILY PARTICIPATION" : "WEEKLY COACH REPORT"}</p><h1>${esc(teamName)}</h1><p>${esc(period)}</p>${body}`;
  const foot = '<p style="font-size:12px;color:#555">Recorded participation uses UTC dates. Practice counts follow the assignment date. Historical summaries reflect current team access. Names are dashboard display names. A check-in day means at least one recorded check-in. Missing activity alone does not establish how an athlete is feeling. Private responses and conversations stay private.</p>';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f1eb;color:#222;font:16px/1.6 Arial,sans-serif"><main style="max-width:640px;margin:28px auto;background:white;padding:32px;border-radius:16px">${content}<p><a href="${esc(url)}" style="display:inline-block;background:#222;color:white;padding:12px 20px;text-decoration:none;border-radius:8px">View ${kind === "daily" ? "daily" : "weekly"} report</a></p>${foot}</main></body></html>`;
  return { subject, html, contentHtml: content + foot, from, to, athleteIds: rows.map((a) => a.id) };
}
async function prepareParticipationReport(db, uid, teamId, kind, to, id) {
  const asOf = Date.parse(to + "T00:00:00Z") + DAY2;
  if (!Number.isFinite(asOf) || new Date(asOf - DAY2).toISOString().slice(0, 10) !== to || asOf > Date.now()) throw new Error("Choose a completed reporting date.");
  if (kind === "weekly" && new Date(asOf - DAY2).getUTCDay() !== 0) throw new Error("Weekly reports end on Sunday.");
  const { team } = await loadTeamAccess(db, uid, teamId);
  const org = (await db.collection("pulsecheck-organizations").doc(team.organizationId).get()).data() || {};
  const brand = org.productBrand === "athleticmind" ? "AthleticMind" : "PulseCheck";
  const current = await loadDashboard(db, uid, teamId, "participation", asOf, true);
  const previous = kind === "weekly" ? await loadDashboard(db, uid, teamId, "participation", asOf - 7 * DAY2, true) : void 0;
  return renderParticipationReport({ teamName: [org.displayName, team.displayName].filter(Boolean).join(" \xB7 ") || "Your team", brand, kind, to, current, previous, url: `https://fitwithpulse.ai/coach/participation-report?id=${encodeURIComponent(id)}` });
}
async function assertReportAudience(db, uid, teamId, athleteIds) {
  const { access, membership, team } = await loadTeamAccess(db, uid, teamId);
  if (!access.participation) throw new Error("Report access changed.");
  const roster = await db.collection("pulsecheck-team-memberships").where("teamId", "==", teamId).get();
  const permitted = new Set(roster.docs.map((d) => d.data()).filter((d) => d.role === "athlete" && d.organizationId === team.organizationId && activeRecord(d) && visibleAthlete(membership, d.userId)).map((d) => d.userId));
  if (athleteIds.some((id) => !permitted.has(id))) throw new Error("Report audience changed during preparation.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  assertReportAudience,
  deliveryId,
  dueReports,
  prepareParticipationReport,
  renderParticipationReport,
  resolveReportRecipients,
  summarizeParticipation,
  validateDeliveryConfig
});
