import routing from '../../content/questionnaires/cau-routing.json';
export const OWNERSHIP_VERSION = routing.version;
export function routingFor(id: string) {
  const rule = routing.questions.find(q => q.questionId === id);
  if (!rule) throw Error('Question has no routing decision.');
  return rule;
}
export function questionCustodian(id: string): 'auntEDNA' | 'PulseCheck' {
  return routingFor(id).custodian as 'auntEDNA' | 'PulseCheck';
}
export function questionVisible(id: string, answers: Record<string, unknown>) {
  const condition = routingFor(id).showWhen;
  return !condition || answers[condition.questionId] === condition.equals;
}
