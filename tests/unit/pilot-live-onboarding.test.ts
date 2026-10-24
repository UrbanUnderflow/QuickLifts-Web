import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLiveOnboarding } from '../../src/api/firebase/pulsecheckPilotDashboard/onboarding';
const member: any = { id:'m', userId:'u', teamId:'golf', role:'athlete', athleteOnboarding: { entryOnboardingStep:'complete', productConsentAccepted:true, baselinePathStatus:'complete', researchConsentStatus:'declined' } };
const saved: any = { mentalSkillsBaseline: { completedAt:123 } };
test('membership completion alone does not confirm a saved baseline', () => {
  assert.equal(summarizeLiveOnboarding(member,'golf','research',null,true).complete,false);
});
test('declining optional research still permits operational completion', () => {
  assert.equal(summarizeLiveOnboarding(member,'golf','research',saved,true).complete,true);
});
test('cached baseline, wrong team, and removed memberships cannot complete', () => {
  assert.equal(summarizeLiveOnboarding(member,'golf','research',saved,false).complete,false);
  assert.equal(summarizeLiveOnboarding(member,'bowling','research',saved,true).complete,false);
  assert.equal(summarizeLiveOnboarding({...member,status:'removed'},'golf','research',saved,true).complete,false);
});
test('unfinished entry onboarding stays incomplete even with a saved baseline', () => {
  assert.equal(summarizeLiveOnboarding({...member,athleteOnboarding:{...member.athleteOnboarding,entryOnboardingStep:'name'}},'golf','research',saved,true).complete,false);
});
