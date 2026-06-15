// =============================================================================
// pulseCheckModuleVisuals — per-module accent colors for PulseCheck curriculum
// modules, mirrored from the iOS library registries so the coach dashboard,
// the iOS toolkit, and the iOS library all map to one another.
//
// LOCKSTEP: keep in sync with
//   PulseCheck/Views/Admin/ProtocolLibraryDemoView.swift (PulseCheckProtocolVisualRegistry)
//   PulseCheck/Views/Admin/SimLibraryDemoView.swift      (PulseCheckSimVisualRegistry)
// and PulseCheck/Design/PulseCheckModuleVisual.swift (the iOS resolver).
//
// The TYPE fallback colors (protocol = #22D3EE, simulation = #8B5CF6) live in
// CURRICULUM_ITEM_META on the dashboard and in PulseCheckColors on iOS.
// =============================================================================

// Protocols carry a PER-MODULE color. Keyed by BOTH protocolId and the legacy
// exerciseId so whichever identifier the assignment carries resolves.
const PROTOCOL_ACCENTS: Record<string, string> = {
  'protocol-478-breathing': '#A78BFA',
  'breathing-478': '#A78BFA',
  'protocol-activation-breathing': '#F59E0B',
  'breathing-activation': '#F59E0B',
  'protocol-body-scan-reset': '#3B82F6',
  'focus-body-scan': '#3B82F6',
  'protocol-box-breathing': '#10B981',
  'breathing-box': '#10B981',
  'protocol-cue-word-anchoring': '#FACC15',
  'focus-cue-word': '#FACC15',
  'protocol-evidence-journal': '#D97706',
  'confidence-evidence-journal': '#D97706',
  'protocol-nerves-to-excitement': '#EC4899',
  'mindset-nerves-excitement': '#EC4899',
  'protocol-perfect-execution-replay': '#A21CAF',
  'viz-perfect-execution': '#A21CAF',
  'protocol-physiological-sigh': '#06B6D4',
  'breathing-physiological-sigh': '#06B6D4',
  'protocol-power-pose': '#EAB308',
  'confidence-power-pose': '#EAB308',
  'protocol-process-over-outcome': '#2563EB',
  'mindset-process-focus': '#2563EB',
  'protocol-recovery-breathing': '#22C55E',
  'breathing-recovery': '#22C55E',
};

// Simulations carry a PER-FAMILY color (matches the iOS sim registry, which is
// keyed by pillar/family rather than per-individual sim).
const SIM_FAMILY_ACCENTS = {
  visualization: '#A21CAF',
  mindset: '#EC4899',
  focus: '#3B82F6',
  decision: '#F59E0B',
  confidence: '#EAB308',
  breathing: '#06B6D4',
  reset: '#10B981',
} as const;

const normalize = (value?: string | null): string =>
  (value || '').trim().toLowerCase();

const includesAny = (haystacks: string[], needles: string[]): boolean =>
  haystacks.some((h) => needles.some((n) => h.includes(n)));

export function resolveProtocolAccent(moduleKey?: string | null): string | null {
  const key = normalize(moduleKey);
  if (!key) return null;
  return PROTOCOL_ACCENTS[key] ?? null;
}

export function resolveSimulationAccent(
  moduleKey?: string | null,
  title?: string | null
): string | null {
  const key = normalize(moduleKey);
  const name = normalize(title);
  const both = [key, name];

  // Name/family-based detection first (mirrors the iOS sim registry order).
  if (includesAny(both, ['brake point', 'brake-point', 'signal window', 'signal-window', 'sequence shift', 'sequence-shift'])) {
    return SIM_FAMILY_ACCENTS.decision;
  }
  if (includesAny(both, ['noise gate', 'noise-gate'])) {
    return SIM_FAMILY_ACCENTS.focus;
  }
  if (includesAny(both, ['reset'])) {
    return SIM_FAMILY_ACCENTS.reset;
  }

  // Then id-prefix detection.
  if (key.startsWith('decision-')) return SIM_FAMILY_ACCENTS.decision;
  if (key.startsWith('focus-')) return SIM_FAMILY_ACCENTS.focus;
  if (key.startsWith('viz-')) return SIM_FAMILY_ACCENTS.visualization;
  if (key.startsWith('mindset-')) return SIM_FAMILY_ACCENTS.mindset;
  if (key.startsWith('confidence-')) return SIM_FAMILY_ACCENTS.confidence;
  if (key.startsWith('breathing-')) return SIM_FAMILY_ACCENTS.breathing;

  return null;
}

/**
 * Per-module accent for a curriculum item, or null when there's no library
 * match (caller should fall back to the TYPE color in CURRICULUM_ITEM_META).
 * Only protocol/simulation modules carry per-module colors; curriculum/program
 * rows keep their own META color.
 */
export function resolveCurriculumItemAccent(
  kind: string,
  moduleKey?: string | null,
  title?: string | null
): string | null {
  if (kind === 'protocol') return resolveProtocolAccent(moduleKey) ?? resolveSimulationAccent(moduleKey, title);
  if (kind === 'simulation') return resolveSimulationAccent(moduleKey, title);
  return null;
}
