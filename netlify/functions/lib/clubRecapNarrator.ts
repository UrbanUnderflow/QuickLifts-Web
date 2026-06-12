// Nora authors the FitClub nightly-recap line.
//
// The nightly cron knows the *facts* (X of Y showed up, the trend vs
// yesterday, the club's active-day streak). This turns those facts into
// one short, coach-voice sentence — the line members read on the
// lockscreen push and on the club-home recap card.
//
// Nora's voice here mirrors the athlete-voice doctrine used elsewhere:
// coach not clinician, short and directional, athletic not medical, one
// idea. If Claude errors or returns something unusable, we fall back to
// the deterministic template so the recap NEVER fails to send.

import {
  buildAdminAuditLogger,
  callAnthropic,
} from '../../../src/api/anthropic/serverBridge';
import { FITCLUB_NIGHTLY_RECAP } from '../../../src/api/anthropic/featureRouting';
import { db } from '../config/firebase';

export interface RecapNarrationInput {
  clubName: string;
  showedUp: number;
  totalMembers: number;
  weekday: string; // e.g. "Monday"
  yesterdayShowedUp?: number | null;
  activeStreakDays?: number; // consecutive days (incl. today) with > 0 activity
}

export interface RecapNarration {
  body: string;
  authoredBy: 'nora' | 'template';
}

const MAX_BODY_CHARS = 180;

/** The deterministic line — also the fallback when Nora is unavailable. */
export function templateRecapBody(input: RecapNarrationInput): string {
  const { showedUp, totalMembers } = input;
  const strong = totalMembers > 0 && showedUp >= totalMembers * 0.7;
  return `${showedUp} of ${totalMembers} showed up today. ${strong ? 'Big day.' : 'Keep it going.'}`;
}

const SYSTEM_PROMPT = [
  'You are Nora, the FitClub team coach. Every night you drop one short line',
  'in the club celebrating how the crew showed up that day — the way a coach',
  'texts the group chat.',
  '',
  'Voice:',
  '- Coach, not clinician. Warm, athletic, direct.',
  '- One sentence. Hard max 140 characters.',
  '- No emoji, no hashtags, no exclamation-mark spam (one at most).',
  '- Talk to the whole club ("you all", "the crew"), never to one person.',
  '',
  'Truth rules:',
  '- Use only the numbers you are given. Never invent names, stats, or events.',
  '- The headline fact is how many of the members trained today.',
  '- If today beat yesterday, you can nod to the momentum. If it dipped, stay',
  '  encouraging — never shame a quiet day or a low number.',
  '- If there is an active-day streak, you may rally around keeping it alive.',
  '',
  'Return ONLY the single line of copy. No quotes, no preamble, no label.',
].join('\n');

function buildFactBlock(input: RecapNarrationInput): string {
  const lines: string[] = [];
  lines.push(`Club: ${input.clubName}`);
  lines.push(`Day: ${input.weekday}`);
  lines.push(`Showed up today: ${input.showedUp} of ${input.totalMembers} members`);
  if (typeof input.yesterdayShowedUp === 'number') {
    const delta = input.showedUp - input.yesterdayShowedUp;
    const trend = delta > 0 ? `up ${delta} from yesterday` : delta < 0 ? `down ${-delta} from yesterday` : 'same as yesterday';
    lines.push(`Yesterday: ${input.yesterdayShowedUp} showed up (${trend})`);
  }
  if (typeof input.activeStreakDays === 'number' && input.activeStreakDays >= 2) {
    lines.push(`The club has had activity ${input.activeStreakDays} days in a row`);
  }
  return lines.join('\n');
}

/**
 * Compose the recap line. Always returns something usable: Nora's line
 * when the call succeeds and looks sane, otherwise the template.
 */
export async function narrateRecap(input: RecapNarrationInput): Promise<RecapNarration> {
  try {
    const result = await callAnthropic(
      {
        featureId: FITCLUB_NIGHTLY_RECAP.featureId,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Tonight's facts:\n${buildFactBlock(input)}` }],
        callerContext: { caller: 'fitclub.nightly-recap', transport: 'server-direct' },
      },
      { auditLogger: buildAdminAuditLogger(db) },
    );

    const text = (result.text || '')
      .trim()
      .replace(/^["'“”]|["'“”]$/g, '') // strip wrapping quotes
      .trim();

    // Guard against empty / runaway output — fall back to the template.
    if (text.length === 0 || text.length > MAX_BODY_CHARS) {
      return { body: templateRecapBody(input), authoredBy: 'template' };
    }
    return { body: text, authoredBy: 'nora' };
  } catch (err) {
    console.warn('[clubRecapNarrator] Nora unavailable, using template:', (err as Error)?.message || err);
    return { body: templateRecapBody(input), authoredBy: 'template' };
  }
}
