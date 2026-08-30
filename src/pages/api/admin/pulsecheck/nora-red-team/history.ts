import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import { NoraRedTeamHistoryStore } from '../../../../../lib/nora-red-team/historyStore';
import { getNoraRedTeamScenario } from '../../../../../lib/nora-red-team/scenarios';
import { NoraRedTeamSuiteStore } from '../../../../../lib/nora-red-team/suiteStore';
import type {
  NoraRedTeamHistoryRecord,
  NoraRedTeamHistoryResponse,
  NoraRedTeamRegressionCase,
} from '../../../../../lib/nora-red-team/types';
import { requireAdminRequest } from '../../_auth';

type ErrorResponse = { error: string; code: string };
type MutationResponse = {
  history?: NoraRedTeamHistoryRecord;
  regression?: NoraRedTeamRegressionCase;
};

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function usesDevelopmentFirebase(req: NextApiRequest): boolean {
  return firstHeader(req.headers['x-pulsecheck-firebase-mode']).toLowerCase() === 'dev'
    || ['true', '1'].includes(firstHeader(req.headers['x-pulsecheck-dev-firebase']).toLowerCase());
}

function validRunId(value: unknown): value is string {
  return typeof value === 'string' && /^nrt-[a-f0-9-]{36}$/i.test(value);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NoraRedTeamHistoryResponse | MutationResponse | ErrorResponse>,
) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'GET, PATCH, POST');
  if (!['GET', 'PATCH', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const adminIdentity = await requireAdminRequest(req);
  if (!adminIdentity) {
    return res.status(401).json({ error: 'Admin authorization is required.', code: 'ADMIN_AUTH_REQUIRED' });
  }

  try {
    const forceDevProject = usesDevelopmentFirebase(req);
    const firestore = getFirebaseAdminApp(forceDevProject).firestore();
    const store = new NoraRedTeamHistoryStore(firestore);

    if (req.method === 'GET') {
      const [history, latestSuite] = await Promise.all([
        store.list(Number(req.query.limit) || 100),
        new NoraRedTeamSuiteStore(firestore).latest(),
      ]);
      return res.status(200).json({
        history,
        openCriticalBlockers: history.filter((record) => record.releaseStatus === 'blocking'
          && record.run.releaseBlocking
          && record.run.severity === 'critical').length,
        promotedRegressionCount: history.filter((record) => record.promotedRegression).length,
        latestSuite,
      });
    }

    const runId = req.body?.runId;
    if (!validRunId(runId)) {
      return res.status(400).json({ error: 'Choose a valid red-team run.', code: 'INVALID_RUN' });
    }

    if (req.method === 'PATCH') {
      const status = req.body?.status;
      if (!['confirmed', 'inconclusive'].includes(status)) {
        return res.status(400).json({ error: 'Choose a valid review decision.', code: 'INVALID_REVIEW' });
      }
      const history = await store.updateReview({
        runId,
        status,
        reviewerEmail: adminIdentity.email,
      });
      if (!history) {
        return res.status(404).json({ error: 'The red-team run was not found.', code: 'RUN_NOT_FOUND' });
      }
      return res.status(200).json({ history });
    }

    if (req.body?.action !== 'promote_regression') {
      return res.status(400).json({ error: 'Choose a valid history action.', code: 'INVALID_ACTION' });
    }
    const scenario = getNoraRedTeamScenario(String(req.body?.scenarioId || ''));
    if (!scenario) {
      return res.status(400).json({ error: 'Choose a valid red-team scenario.', code: 'INVALID_SCENARIO' });
    }
    const regression = await store.promoteRegression({
      runId,
      scenario,
      reviewerEmail: adminIdentity.email,
    });
    if (!regression) {
      return res.status(404).json({ error: 'The red-team run was not found.', code: 'RUN_NOT_FOUND' });
    }
    return res.status(200).json({ regression });
  } catch (error) {
    console.error('[nora-red-team] History request failed.', {
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    });
    return res.status(500).json({ error: 'The protected red-team history is unavailable.', code: 'HISTORY_UNAVAILABLE' });
  }
}
