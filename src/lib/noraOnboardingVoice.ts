// Dynamic Nora voice lines for onboarding. Unlike the fixed narration libraries
// (which pre-generate and store one audio file per cue), these lines insert the
// coach's name at play time, so they're synthesized on the fly via the global
// Nora ElevenLabs voice (see src/utils/tts.ts `speakStep`).

export type NoraDynamicLine = {
  id: string;
  label: string;
  description: string;
  /** Build the spoken text. `name` is the coach's first name (may be empty). */
  build: (name: string) => string;
  /** Example name used for library preview defaults. */
  sampleName: string;
};

/**
 * The line Nora speaks the moment a coach opens their activation link.
 * e.g. "Welcome, Coach Tre! Nora here. Let's get you signed up, and I'll walk
 * you through your setup."
 */
export function buildNoraOnboardingWelcome(coachName?: string): string {
  const name = (coachName || '').trim().split(/\s+/)[0] || '';
  return name
    ? `Welcome, Coach ${name}! Nora here. Let's get you signed up, and I'll walk you through your setup.`
    : `Welcome, Coach! Nora here. Let's get you signed up, and I'll walk you through your setup.`;
}

// Registry of dynamic Nora lines surfaced in the AI voice library (/admin/ai-voice).
export const NORA_DYNAMIC_LINES: NoraDynamicLine[] = [
  {
    id: 'coach-onboarding-welcome',
    label: 'Coach onboarding welcome',
    description: 'Plays when a coach first opens their activation link. Inserts the coach’s first name.',
    build: buildNoraOnboardingWelcome,
    sampleName: 'Tre',
  },
];
