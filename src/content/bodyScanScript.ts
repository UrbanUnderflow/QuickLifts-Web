export type BodyScanScriptStep = {
  label: string;
  text: string;
  holdWeight: number;
};

export const BODY_SCAN_SETTLE_TEXT =
  'Lie on your back if that is comfortable, or sit with your back supported. Put the phone down. Close your eyes if that feels comfortable, and take two normal breaths. The next instruction will play automatically. You do not need to tap the screen until the scan ends.';

export const BODY_SCAN_SCRIPT: BodyScanScriptStep[] = [
  {
    label: 'Settle',
    text: BODY_SCAN_SETTLE_TEXT,
    holdWeight: 0.25,
  },
  {
    label: 'Breathing',
    text: 'Notice how fast you are breathing. Notice whether your chest, ribs, or stomach moves with each breath. Keep breathing normally. Do not make your breaths deeper.',
    holdWeight: 1,
  },
  {
    label: 'Head and Face',
    text: 'Notice your forehead, eyes, and jaw. If your forehead is wrinkled, stop squeezing those muscles. If your eyes are squeezed shut, let your eyelids close without squeezing. If your teeth are touching, separate them slightly and unclench your jaw.',
    holdWeight: 1,
  },
  {
    label: 'Neck and Shoulders',
    text: 'Notice your neck and shoulders. Lower your shoulders away from your ears. Keep your jaw unclenched. Relax the muscles around your eyes and forehead.',
    holdWeight: 1.15,
  },
  {
    label: 'Arms and Hands',
    text: 'Notice your upper arms, elbows, forearms, wrists, hands, and fingers. If your hands are clenched, open them. If your fingers are curled tightly, straighten them and let your hands rest.',
    holdWeight: 1,
  },
  {
    label: 'Chest and Stomach',
    text: 'Notice your chest, ribs, stomach, and lower back. Check whether you are squeezing your stomach or holding your breath. If you are, stop squeezing and return to normal breathing.',
    holdWeight: 1.2,
  },
  {
    label: 'Hips and Legs',
    text: 'Notice your hips, thighs, knees, calves, ankles, and feet. Check whether your thighs, buttocks, or calves are tight. Stop squeezing those muscles and let your legs rest against the floor, chair, or bed.',
    holdWeight: 1.2,
  },
  {
    label: 'Check Again',
    text: 'Scan from your head to your feet one more time. Find the area that feels tightest. As you breathe out, reduce the muscle tension in that area. It does not need to become fully relaxed.',
    holdWeight: 1.1,
  },
  {
    label: 'Finish',
    text: 'Take two normal breaths. Notice whether any area feels less tight than it did at the start. Open your eyes. As you move into your next activity, use only the muscle tension that action requires.',
    holdWeight: 0.9,
  },
];

const AMBIGUOUS_BODY_SCAN_PATTERNS = [
  /\bquiet(?:er)?\b/i,
  /\bsoften\b/i,
  /\bget heavy\b/i,
  /\bbeing held\b/i,
  /\bholding effort\b/i,
  /\bbreathe (?:toward|into)\b/i,
  /\blet the breath move\b/i,
  /\bexhale take\b/i,
  /\bhidden tension\b/i,
  /\blet it go\b/i,
];

export function bodyScanInstructionsAreDirect(instructions: string[]): boolean {
  return instructions.length >= 8
    && instructions.every((instruction) =>
      AMBIGUOUS_BODY_SCAN_PATTERNS.every((pattern) => !pattern.test(instruction)),
    );
}

export const BODY_SCAN_INSTRUCTIONS = BODY_SCAN_SCRIPT.map((step) => step.text);
