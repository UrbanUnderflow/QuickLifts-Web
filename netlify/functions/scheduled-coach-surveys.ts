import { schedule } from '@netlify/functions';
import { DELIVERY_RELEASE_APPROVED } from '../../src/lib/coachSurveys/delivery';
// Deliberately no Firebase/provider imports or operations while release is held.
// Enable only after recipient, lifecycle, opt-out, message and deployment review.
export const handler = schedule('0 * * * *', async () => {
  if (!DELIVERY_RELEASE_APPROVED || process.env.COACH_SURVEY_DELIVERY_ENABLED !== 'true') return { statusCode: 200, body: JSON.stringify({ enabled: false, status: 'awaiting-release-review' }) };
  const { getFirestore } = await import('./utils/getServiceAccount');
  const { runCoachSurveyDeliveries } = await import('../../src/lib/coachSurveys/delivery');
  const { coachSurveyProviders } = await import('../../src/lib/coachSurveys/providers');
  const db = await getFirestore();
  const result = await runCoachSurveyDeliveries(db, new Date(), 'https://fitwithpulse.ai', coachSurveyProviders(db));
  return { statusCode: 200, body: JSON.stringify(result) };
});
