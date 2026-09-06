import type { NextApiRequest } from 'next';
import { getFirebaseAdminApp } from '../firebase-admin';
export const LOCAL_TESTER_UID = 'nora-local-synthetic-tester';
export function isLocalTestingRequest(req: Pick<NextApiRequest, 'headers' | 'socket'>): boolean {
  if (process.env.NODE_ENV !== 'development' || process.env.NORA_LOCAL_TESTING !== 'true') return false;
  const remote = req.socket.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote || '')) return false;
  const host = String(req.headers.host || '');
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
  return req.headers.origin === `http://${host}` && (!req.headers['x-forwarded-host'] || req.headers['x-forwarded-host'] === host);
}
export function localTestingApp() {
  const app = getFirebaseAdminApp(true);
  if (app.options.projectId !== 'quicklifts-dev-01') throw new Error('Development project required');
  return app;
}
export async function requireLocalTester(req: NextApiRequest) {
  if (!isLocalTestingRequest(req)) return null;
  try {
    const token = await localTestingApp().auth().verifyIdToken(req.cookies['nora-local-session'] || '', true);
    return token.uid === LOCAL_TESTER_UID && token.noraLocalTester === true ? token : null;
  } catch { return null; }
}
