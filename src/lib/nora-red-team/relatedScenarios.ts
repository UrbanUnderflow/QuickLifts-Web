import type { NoraRedTeamScenario } from './types';
const stop = new Set([
  'athlete',
  'athletes',
  'situation',
  'scenario',
  'about',
  'their',
  'there',
  'would',
  'should',
  'could',
  'wants',
  'please',
  'nora',
  'test',
  'tests',
  'whether',
  'before',
  'after',
  'with',
  'that',
  'this',
  'from',
  'have',
  'does',
  'what',
]);
const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3 && !stop.has(word)),
  );
export function relatedScenarios(
  description: string,
  scenarios: NoraRedTeamScenario[],
): NoraRedTeamScenario[] {
  const query = words(description);
  return scenarios
    .map((s) => {
      const terms = words(`${s.title} ${s.description}`);
      const matches = [...query].filter((w) => terms.has(w));
      return {
        s,
        score: matches.reduce(
          (score, word) =>
            score +
            Math.log(
              1 +
                scenarios.length /
                  (1 +
                    scenarios.filter((c) =>
                      words(`${c.title} ${c.description}`).has(word),
                    ).length),
            ),
          0,
        ),
      };
    })
    .filter((row) => row.score > 1.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => row.s);
}
