import type { NextApiRequest, NextApiResponse } from 'next';
import { BackupError, deleteVerifiedHealthBackup, listHealthBackups, processHealthBackup } from '../../../../lib/questionnaires/cau-backups';

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith('Bearer ')) return res.status(401).json({ error: 'Administrator sign-in required.' });
  const { getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
  const app = getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode'] === 'dev');
  let actor;
  try { actor = await app.auth().verifyIdToken(bearer.slice(7), true); }
  catch { return res.status(401).json({ error: 'Sign in again to manage backups.' }); }
  try {
    const db = app.firestore(), email = typeof actor.email === 'string' ? actor.email.trim() : '';
    if(actor.email_verified!==true || !actor.uid) return res.status(403).json({error:'Verified administrator email required.'});
    const admins = email ? await Promise.all([...new Set([email, email.toLowerCase(), email.toUpperCase()])].map(value => db.collection('admin').doc(value).get())) : [];
    const savedAdmins=admins.filter((document:any)=>document.exists);
    const invalidAdmin=savedAdmins.some((document:any)=>{const record=document.data();return record?.disabled===true || record?.revoked===true || Boolean(record?.revokedAt) || ['disabled','revoked'].includes(record?.status) || record?.uid && record.uid!==actor.uid;});
    if (!savedAdmins.length || invalidAdmin || (await db.collection('account-closure-jobs').doc(actor.uid).get()).exists) return res.status(403).json({ error: 'Administrator access required.' });
    if (req.method === 'GET') return res.json(await listHealthBackups(db, req.query.limit ? Number(req.query.limit) : 50, String(req.query.cursor || '')));
    if (Object.keys(req.body || {}).some(key => !['action', 'backupId'].includes(key))
      || !['retry', 'delete'].includes(req.body?.action) || !/^health_backup_[a-f0-9]{64}$/.test(req.body?.backupId || '')) {
      return res.status(400).json({ error: 'Choose a valid backup action.' });
    }
    const backup = req.body.action === 'delete'
      ? await deleteVerifiedHealthBackup(db, req.body.backupId, actor.uid)
      : await processHealthBackup(db, req.body.backupId, actor.uid);
    return res.json({ backup });
  } catch (error) {
    return res.status(error instanceof BackupError ? error.statusCode : 503).json({ error: error instanceof BackupError ? error.message : 'Backup management is temporarily unavailable. Try again.' });
  }
}
