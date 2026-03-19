import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import admin from '../../../../../lib/firebase-admin';
import { requireAdminRequest } from '../../_auth';
import {
  buildGroupMeetCandidateKey,
  computeGroupMeetAnalysis,
  formatMinutesAsTime,
  normalizeGroupMeetAvailabilitySlots,
  type GroupMeetAiRecommendation,
  type GroupMeetAiRecommendationCandidate,
  type GroupMeetInviteDetail,
} from '../../../../../lib/groupMeet';

const REQUESTS_COLLECTION = 'groupMeetRequests';
const INVITES_SUBCOLLECTION = 'groupMeetInvites';
const DEFAULT_MODEL = 'gpt-4.1';

const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) =>
  value?.toDate?.().toISOString?.() || null;

function sanitizeModelName(raw: string | undefined) {
  const candidate = (raw || DEFAULT_MODEL).trim();
  if (!candidate) return DEFAULT_MODEL;
  return candidate.replace(/^openai\//i, '');
}

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

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
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

    if (!analysis.bestCandidates.length) {
      return res.status(400).json({ error: 'No candidate windows available to recommend yet.' });
    }

    const candidatePool = analysis.bestCandidates.slice(0, 8).map((candidate) => ({
      candidateKey: buildGroupMeetCandidateKey(candidate.date, candidate.suggestedStartMinutes),
      label: `${candidate.date} ${formatMinutesAsTime(candidate.suggestedStartMinutes)}-${formatMinutesAsTime(candidate.suggestedEndMinutes)}`,
      participantCount: candidate.participantCount,
      totalParticipants: candidate.totalParticipants,
      allAvailable: candidate.allAvailable,
      participantNames: candidate.participantNames,
      missingParticipantNames: candidate.missingParticipantNames,
      flexibilityMinutes: candidate.flexibilityMinutes,
    }));

    const model = sanitizeModelName(process.env.GROUP_MEET_RECOMMENDATION_MODEL);
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_completion_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are helping an internal scheduling admin tool. ' +
            'Recommend a few candidate meeting windows based on deterministic overlap data. ' +
            'Do not invent times or participants. ' +
            'Prefer windows that work for everyone. If no full-group match exists, say that clearly. ' +
            'Return JSON only with exactly this shape: ' +
            '{"summary":"...","caveats":["..."],"recommendations":[{"candidateKey":"...","rank":1,"reason":"..."}]}',
        },
        {
          role: 'user',
          content:
            `Request title: ${requestData.title || 'Group Meet'}\n` +
            `Target month: ${targetMonth}\n` +
            `Meeting duration: ${meetingDurationMinutes} minutes\n` +
            `Total participants: ${analysis.totalParticipants}\n` +
            `Responded participants: ${analysis.respondedParticipantNames.join(', ') || 'None'}\n` +
            `Pending participants: ${analysis.pendingParticipantNames.join(', ') || 'None'}\n` +
            `Candidate pool:\n${JSON.stringify(candidatePool, null, 2)}\n\n` +
            'Write a short host-facing summary and recommend up to 3 candidate windows from the candidate pool.',
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'No AI recommendation content returned.' });
    }

    const parsed = JSON.parse(content) as {
      summary?: string;
      caveats?: string[];
      recommendations?: Array<{ candidateKey?: string; rank?: number; reason?: string }>;
    };

    const recommendationMap = new Map(
      analysis.bestCandidates.map((candidate) => [
        buildGroupMeetCandidateKey(candidate.date, candidate.suggestedStartMinutes),
        candidate,
      ])
    );

    const recommendations: GroupMeetAiRecommendationCandidate[] = (Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : []
    )
      .map((item, index) => {
        const candidateKey = typeof item?.candidateKey === 'string' ? item.candidateKey : '';
        const candidate = recommendationMap.get(candidateKey);
        if (!candidate) return null;

        return {
          rank: Number(item?.rank) || index + 1,
          candidateKey,
          date: candidate.date,
          startMinutes: candidate.suggestedStartMinutes,
          endMinutes: candidate.suggestedEndMinutes,
          participantCount: candidate.participantCount,
          totalParticipants: candidate.totalParticipants,
          allAvailable: candidate.allAvailable,
          participantNames: candidate.participantNames,
          missingParticipantNames: candidate.missingParticipantNames,
          reason: typeof item?.reason === 'string' && item.reason.trim()
            ? item.reason.trim()
            : 'Strong overlap candidate based on submitted availability.',
        };
      })
      .filter((item): item is GroupMeetAiRecommendationCandidate => Boolean(item))
      .sort((left, right) => left.rank - right.rank)
      .slice(0, 3);

    const recommendation: GroupMeetAiRecommendation = {
      generatedAt: new Date().toISOString(),
      model,
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : 'AI recommendation generated.',
      caveats: Array.isArray(parsed.caveats)
        ? parsed.caveats.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 5)
        : [],
      recommendations,
    };

    await requestRef.set(
      {
        aiRecommendation: recommendation,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        aiRecommendationGeneratedByEmail: adminUser.email,
      },
      { merge: true }
    );

    return res.status(200).json({ recommendation });
  } catch (error: any) {
    console.error('[group-meet-ai-recommend] Failed to generate recommendation:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate AI recommendation.' });
  }
}

