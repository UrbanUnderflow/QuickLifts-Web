import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../lib/coach-dashboard/auth';
import { activeRecord, DashboardAccessError, loadTeamAccess, validTeamId } from '../../../lib/coach-dashboard/access';
import { trainerSharingChoices, TRAINER_SHARING_FIELDS, TRAINER_SHARING_VERSION, TRAINER_SHARING_TEXT, type TrainerSharingChoices } from '../../../lib/coach-dashboard/types';
export const emptyChoices = (): TrainerSharingChoices => ({ mood: false, recovery: false, wearables: false, journaling: false });
export const sharingRef = (db: Awaited<ReturnType<typeof authorizeDashboardRequest>>['db'], teamId: string, uid: string) => db.collection('pulsecheck-trainer-sharing').doc(`${teamId}_${uid}`);
export const createTrainerSharingHandler = (deps: { authorize?: typeof authorizeDashboardRequest } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  let identity; try { identity = await (deps.authorize || authorizeDashboardRequest)(req); } catch { return res.status(401).json({ error: 'Sign in to manage sharing.' }); }
  try {
    const { db, uid } = identity;
    if (req.method === 'POST') {
      const { teamId, version, choices } = req.body || {};
      if (!validTeamId(teamId) || version !== TRAINER_SHARING_VERSION || !choices || Object.keys(choices).length !== 4 || !TRAINER_SHARING_FIELDS.every(key => typeof choices[key] === 'boolean')) return res.status(400).json({ error: 'Review all four sharing choices.' });
      const { access } = await loadTeamAccess(db, uid, teamId);
      if (!access.athlete) return res.status(403).json({ error: 'Only an athlete can set their own team sharing choices.' });
      const clean = Object.fromEntries(TRAINER_SHARING_FIELDS.map(key => [key, choices[key]]));
      await sharingRef(db, teamId, uid).set({ teamId, athleteId: uid, version, choices: clean, disclosure: TRAINER_SHARING_TEXT, updatedAt: new Date().toISOString() });
      return res.status(200).json({ saved: true, choices: clean });
    }
    const members = await db.collection('pulsecheck-team-memberships').where('userId', '==', uid).get();
    const teams = [];
    for (const doc of members.docs) {
      const member = doc.data(); if (member.role !== 'athlete' || !activeRecord(member) || !validTeamId(member.teamId)) continue;
      try {
        const { team, access } = await loadTeamAccess(db, uid, member.teamId); if (!access.athlete) continue;
        const grant = (await sharingRef(db, member.teamId, uid).get()).data();
        const choices = trainerSharingChoices(grant, uid, member.teamId);
        teams.push({ teamId: member.teamId, displayName: String(team.displayName || 'Team'), choices, updatedAt: grant?.updatedAt || null });
      } catch (error) { if (!(error instanceof DashboardAccessError)) throw error; }
    }
    return res.status(200).json({ teams });
  } catch (error) { return res.status(error instanceof DashboardAccessError ? error.status : 503).json({ error: error instanceof DashboardAccessError ? error.message : 'Sharing choices are unavailable. Please try again.' }); }
};
export default createTrainerSharingHandler();
