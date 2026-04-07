import OpenAI from 'openai';
import {
  buildGroupMeetCandidateKey,
  computeGroupMeetAnalysis,
  formatMinutesAsTime,
  normalizeGroupMeetAvailabilitySlots,
  type GroupMeetAiRecommendation,
  type GroupMeetAiRecommendationCandidate,
  type GroupMeetInviteDetail,
} from './groupMeet';

const DEFAULT_MODEL = 'gpt-4.1';

const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) =>
  value?.toDate?.().toISOString?.() || null;

export function mapGroupMeetInvitesForAnalysis(
  invitesSnapshot: FirebaseFirestore.QuerySnapshot,
  targetMonth: string
): GroupMeetInviteDetail[] {
  return invitesSnapshot.docs.map((docSnap) => {
    const inviteData = docSnap.data() || {};
    const availabilityEntries = normalizeGroupMeetAvailabilitySlots(inviteData.availabilityEntries, targetMonth);

    return {
      token: docSnap.id,
      name: inviteData.name || '',
      email: inviteData.email || null,
      imageUrl: inviteData.imageUrl || null,
      participantType: inviteData.participantType === 'host' ? 'host' : 'participant',
      contactId: inviteData.contactId || null,
      shareUrl: inviteData.shareUrl || '',
      emailStatus: inviteData.emailStatus || 'not_sent',
      emailError: inviteData.emailError || null,
      respondedAt: toIso(inviteData.responseSubmittedAt),
      availabilityCount: availabilityEntries.length,
      availabilityEntries,
      emailedAt: toIso(inviteData.emailedAt),
      calendarImport: null,
    };
  });
}

function sanitizeModelName(raw: string | undefined) {
  const candidate = (raw || DEFAULT_MODEL).trim();
  if (!candidate) return DEFAULT_MODEL;
  return candidate.replace(/^openai\//i, '');
}

function buildFallbackRecommendations(
  invites: GroupMeetInviteDetail[],
  meetingDurationMinutes: number
): GroupMeetAiRecommendation {
  const analysis = computeGroupMeetAnalysis(invites, meetingDurationMinutes);
  const topCandidates = analysis.bestCandidates.slice(0, 3);

  const summary = analysis.fullMatchCandidates.length
    ? 'Everyone has responded. These are the strongest full-group meeting windows based on the submitted availability.'
    : 'Everyone has responded. These are the best available meeting windows based on current overlap, even though no single slot fits everyone.';

  const caveats = analysis.fullMatchCandidates.length
    ? []
    : ['No full-group overlap window is available right now, so the recommendations prioritize the strongest partial match.'];

  const recommendations: GroupMeetAiRecommendationCandidate[] = topCandidates.map((candidate, index) => ({
    rank: index + 1,
    candidateKey: buildGroupMeetCandidateKey(candidate.date, candidate.suggestedStartMinutes),
    date: candidate.date,
    startMinutes: candidate.suggestedStartMinutes,
    endMinutes: candidate.suggestedEndMinutes,
    participantCount: candidate.participantCount,
    totalParticipants: candidate.totalParticipants,
    allAvailable: candidate.allAvailable,
    participantNames: candidate.participantNames,
    missingParticipantNames: candidate.missingParticipantNames,
    reason: candidate.allAvailable
      ? `Works for all ${candidate.totalParticipants} participants and keeps the meeting inside a shared overlap window.`
      : `Works for ${candidate.participantCount} of ${candidate.totalParticipants} participants and is the strongest remaining overlap window.`,
  }));

  return {
    generatedAt: new Date().toISOString(),
    model: 'deterministic-fallback',
    summary,
    caveats,
    recommendations,
  };
}

export async function generateGroupMeetAiRecommendation(args: {
  requestTitle: string;
  targetMonth: string;
  meetingDurationMinutes: number;
  invites: GroupMeetInviteDetail[];
  model?: string;
}): Promise<GroupMeetAiRecommendation> {
  const analysis = computeGroupMeetAnalysis(args.invites, args.meetingDurationMinutes);
  if (!analysis.bestCandidates.length) {
    throw new Error('No candidate windows available to recommend yet.');
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return buildFallbackRecommendations(args.invites, args.meetingDurationMinutes);
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

  const candidateMap = new Map(
    analysis.bestCandidates.map((candidate) => [
      buildGroupMeetCandidateKey(candidate.date, candidate.suggestedStartMinutes),
      candidate,
    ])
  );

  try {
    const openai = new OpenAI({ apiKey });
    const model = sanitizeModelName(args.model || process.env.GROUP_MEET_RECOMMENDATION_MODEL);
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
            `Request title: ${args.requestTitle || 'Group Meet'}\n` +
            `Target month: ${args.targetMonth}\n` +
            `Meeting duration: ${args.meetingDurationMinutes} minutes\n` +
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
      return buildFallbackRecommendations(args.invites, args.meetingDurationMinutes);
    }

    const parsed = JSON.parse(content) as {
      summary?: string;
      caveats?: string[];
      recommendations?: Array<{ candidateKey?: string; rank?: number; reason?: string }>;
    };

    const recommendations: GroupMeetAiRecommendationCandidate[] = (Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : []
    )
      .map((item, index) => {
        const candidateKey = typeof item?.candidateKey === 'string' ? item.candidateKey : '';
        const candidate = candidateMap.get(candidateKey);
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
          reason:
            typeof item?.reason === 'string' && item.reason.trim()
              ? item.reason.trim()
              : 'Strong overlap candidate based on submitted availability.',
        } satisfies GroupMeetAiRecommendationCandidate;
      })
      .filter((item): item is GroupMeetAiRecommendationCandidate => Boolean(item))
      .sort((left, right) => left.rank - right.rank)
      .slice(0, 3);

    if (!recommendations.length) {
      return buildFallbackRecommendations(args.invites, args.meetingDurationMinutes);
    }

    return {
      generatedAt: new Date().toISOString(),
      model,
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : 'AI recommendation generated.',
      caveats: Array.isArray(parsed.caveats)
        ? parsed.caveats
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .slice(0, 5)
        : [],
      recommendations,
    };
  } catch (error) {
    console.error('[group-meet-ai] Falling back to deterministic recommendation:', error);
    return buildFallbackRecommendations(args.invites, args.meetingDurationMinutes);
  }
}
