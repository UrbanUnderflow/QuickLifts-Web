import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../../lib/firebase-admin';
import { requireAdminRequest } from '../../_auth';
import {
  buildGroupMeetCandidateKey,
  computeGroupMeetAnalysis,
  normalizeGroupMeetAvailabilitySlots,
  type GroupMeetFinalSelection,
  type GroupMeetInviteDetail,
} from '../../../../../lib/groupMeet';

const REQUESTS_COLLECTION = 'groupMeetRequests';
const INVITES_SUBCOLLECTION = 'groupMeetInvites';

type FinalizeBody = {
  candidateKey?: string;
  hostNote?: string;
};

const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) =>
  value?.toDate?.().toISOString?.() || null;

function mapInvites(
  invitesSnapshot: FirebaseFirestore.QuerySnapshot,
  targetMonth: string
): GroupMeetInviteDetail[] {
  return invitesSnapshot.docs.map((docSnap) => {
    const inviteData = docSnap.data();
    const availabilityEntries = normalizeGroupMeetAvailabilitySlots(inviteData.availabilityEntries, targetMonth);
    return {
      token: docSnap.id,
      name: inviteData.name || '',
      email: inviteData.email || null,
      shareUrl: inviteData.shareUrl || '',
      emailStatus: inviteData.emailStatus || 'not_sent',
      emailError: inviteData.emailError || null,
      respondedAt: toIso(inviteData.responseSubmittedAt),
      availabilityCount: availabilityEntries.length,
      availabilityEntries,
    };
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
  if (!requestId) {
    return res.status(400).json({ error: 'Request id is required.' });
  }

  const body = (req.body || {}) as FinalizeBody;
  const candidateKey = typeof body.candidateKey === 'string' ? body.candidateKey.trim() : '';
  const hostNote = typeof body.hostNote === 'string' ? body.hostNote.trim() : '';

  if (!candidateKey) {
    return res.status(400).json({ error: 'candidateKey is required.' });
  }

  try {
    const requestRef = admin.firestore().collection(REQUESTS_COLLECTION).doc(requestId);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Group Meet request not found.' });
    }

    const requestData = requestDoc.data() || {};
    const targetMonth = typeof requestData.targetMonth === 'string' ? requestData.targetMonth : '';
    const meetingDurationMinutes = Math.max(15, Number(requestData.meetingDurationMinutes) || 30);
    const invitesSnapshot = await requestRef.collection(INVITES_SUBCOLLECTION).orderBy('createdAt', 'asc').get();
    const invites = mapInvites(invitesSnapshot, targetMonth);
    const analysis = computeGroupMeetAnalysis(invites, meetingDurationMinutes);

    const candidate = analysis.bestCandidates.find(
      (item) => buildGroupMeetCandidateKey(item.date, item.suggestedStartMinutes) === candidateKey
    );

    if (!candidate) {
      return res.status(400).json({ error: 'The selected candidate could not be found in the current overlap results.' });
    }

    const finalSelection: GroupMeetFinalSelection = {
      candidateKey,
      date: candidate.date,
      startMinutes: candidate.suggestedStartMinutes,
      endMinutes: candidate.suggestedEndMinutes,
      participantCount: candidate.participantCount,
      totalParticipants: candidate.totalParticipants,
      participantNames: candidate.participantNames,
      missingParticipantNames: candidate.missingParticipantNames,
      selectedAt: new Date().toISOString(),
      selectedByEmail: adminUser.email,
      hostNote: hostNote || null,
    };

    await requestRef.set(
      {
        finalSelection,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({ finalSelection });
  } catch (error: any) {
    console.error('[group-meet-finalize] Failed to save final selection:', error);
    return res.status(500).json({ error: error?.message || 'Failed to save final meeting block.' });
  }
}

