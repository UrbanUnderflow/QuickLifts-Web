import OpenAI from 'openai';
import { convertLocalDateMinutesToUtcIso, getGoogleCalendarAuth, getGoogleCalendarId } from './googleCalendar';
import {
  buildGroupMeetCandidateKey,
  computeGroupMeetAnalysis,
  formatMinutesAsTime,
  normalizeGroupMeetAvailabilitySlots,
  type GroupMeetAiRecommendation,
  type GroupMeetAiRecommendationCandidate,
  type GroupMeetAnalysis,
  type GroupMeetCalendarInvite,
  type GroupMeetFinalSelection,
  type GroupMeetInviteDetail,
} from './groupMeet';

const DEFAULT_MODEL = 'gpt-4.1';

type GoogleCalendarEventResponse = {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
  error?: {
    message?: string;
  };
};

const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) =>
  value?.toDate?.().toISOString?.() || null;

function sanitizeModelName(raw: string | undefined) {
  const candidate = (raw || DEFAULT_MODEL).trim();
  if (!candidate) return DEFAULT_MODEL;
  return candidate.replace(/^openai\//i, '');
}

function buildDeterministicRecommendation(args: {
  analysis: GroupMeetAnalysis;
  requestTitle: string;
  targetMonth: string;
}): GroupMeetAiRecommendation {
  const recommendations: GroupMeetAiRecommendationCandidate[] = args.analysis.bestCandidates
    .slice(0, 3)
    .map((candidate, index) => ({
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
        ? 'This window keeps the full group together based on the submitted availability.'
        : `This window gives the strongest current overlap, covering ${candidate.participantCount} of ${candidate.totalParticipants} participants.`,
    }));

  const firstRecommendation = recommendations[0] || null;
  const firstLabel = firstRecommendation
    ? `${firstRecommendation.date} ${formatMinutesAsTime(firstRecommendation.startMinutes)}-${formatMinutesAsTime(firstRecommendation.endMinutes)}`
    : null;

  const summary = firstRecommendation
    ? firstRecommendation.allAvailable
      ? `Everyone has responded. The strongest option is ${firstLabel}, which works for the full group.`
      : `Everyone has responded. No single window works for everyone, so Group Meet ranked the best overlap options, led by ${firstLabel}.`
    : `Group Meet reviewed the submitted availability for ${args.requestTitle || 'this request'} and found no recommended windows yet.`;

  const caveats: string[] = [];
  if (args.analysis.pendingParticipantCount > 0) {
    caveats.push(
      `${args.analysis.pendingParticipantCount} participant${args.analysis.pendingParticipantCount === 1 ? '' : 's'} still have not responded.`
    );
  }
  if (!args.analysis.fullMatchCandidates.length && firstRecommendation) {
    caveats.push('No single window currently works for everyone, so the list below maximizes overlap.');
  }

  return {
    generatedAt: new Date().toISOString(),
    model: 'deterministic-fallback',
    summary,
    caveats,
    recommendations,
  };
}

export function mapGroupMeetInviteDocs(
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
      emailedAt: toIso(inviteData.emailedAt),
      emailError: inviteData.emailError || null,
      respondedAt: toIso(inviteData.responseSubmittedAt),
      availabilityCount: availabilityEntries.length,
      availabilityEntries,
    };
  });
}

export async function computeGroupMeetAiRecommendation(args: {
  requestTitle: string;
  targetMonth: string;
  meetingDurationMinutes: number;
  invites: GroupMeetInviteDetail[];
  apiKey?: string | null;
  model?: string | null;
  allowFallback?: boolean;
}): Promise<{ analysis: GroupMeetAnalysis; recommendation: GroupMeetAiRecommendation }> {
  const meetingDurationMinutes = Math.max(15, Number(args.meetingDurationMinutes) || 30);
  const analysis = computeGroupMeetAnalysis(args.invites, meetingDurationMinutes);

  if (!analysis.bestCandidates.length) {
    throw new Error('No candidate windows available to recommend yet.');
  }

  const allowFallback = args.allowFallback !== false;
  const apiKey = (args.apiKey || process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY || '').trim();
  const model = sanitizeModelName(args.model || process.env.GROUP_MEET_RECOMMENDATION_MODEL);

  if (!apiKey) {
    if (!allowFallback) {
      throw new Error('OpenAI API key not configured');
    }
    return {
      analysis,
      recommendation: buildDeterministicRecommendation({
        analysis,
        requestTitle: args.requestTitle,
        targetMonth: args.targetMonth,
      }),
    };
  }

  try {
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
            `Request title: ${args.requestTitle || 'Group Meet'}\n` +
            `Target month: ${args.targetMonth}\n` +
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
      throw new Error('No AI recommendation content returned.');
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
          reason:
            typeof item?.reason === 'string' && item.reason.trim()
              ? item.reason.trim()
              : 'Strong overlap candidate based on submitted availability.',
        };
      })
      .filter((item): item is GroupMeetAiRecommendationCandidate => Boolean(item))
      .sort((left, right) => left.rank - right.rank)
      .slice(0, 3);

    return {
      analysis,
      recommendation: {
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
        recommendations: recommendations.length
          ? recommendations
          : buildDeterministicRecommendation({
              analysis,
              requestTitle: args.requestTitle,
              targetMonth: args.targetMonth,
            }).recommendations,
      },
    };
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }

    return {
      analysis,
      recommendation: buildDeterministicRecommendation({
        analysis,
        requestTitle: args.requestTitle,
        targetMonth: args.targetMonth,
      }),
    };
  }
}

export function buildGroupMeetFinalSelection(args: {
  analysis: GroupMeetAnalysis;
  candidateKey: string;
  selectedByEmail: string | null;
  hostNote?: string | null;
}): GroupMeetFinalSelection {
  const candidate = args.analysis.bestCandidates.find(
    (item) => buildGroupMeetCandidateKey(item.date, item.suggestedStartMinutes) === args.candidateKey
  );

  if (!candidate) {
    throw new Error('The selected candidate could not be found in the current overlap results.');
  }

  return {
    candidateKey: args.candidateKey,
    date: candidate.date,
    startMinutes: candidate.suggestedStartMinutes,
    endMinutes: candidate.suggestedEndMinutes,
    participantCount: candidate.participantCount,
    totalParticipants: candidate.totalParticipants,
    participantNames: candidate.participantNames,
    missingParticipantNames: candidate.missingParticipantNames,
    selectedAt: new Date().toISOString(),
    selectedByEmail: args.selectedByEmail,
    hostNote: (args.hostNote || '').trim() || null,
  };
}

function buildEventDescription(args: {
  title: string;
  timezone: string;
  finalSelection: GroupMeetFinalSelection;
  aiSummary: string | null;
}) {
  const lines = [
    `${args.title}`,
    '',
    'Scheduled in Group Meet',
    `Timezone: ${args.timezone}`,
    `Selected window: ${args.finalSelection.date} ${formatMinutesAsTime(args.finalSelection.startMinutes)} -> ${formatMinutesAsTime(args.finalSelection.endMinutes)}`,
  ];

  if (args.aiSummary) {
    lines.push('', `AI summary: ${args.aiSummary}`);
  }

  if (args.finalSelection.hostNote) {
    lines.push('', `Host note: ${args.finalSelection.hostNote}`);
  }

  lines.push(
    '',
    `Included participants: ${args.finalSelection.participantNames.join(', ') || 'None'}`,
    `Missing participants: ${args.finalSelection.missingParticipantNames.join(', ') || 'None'}`
  );

  return lines.join('\n');
}

export async function scheduleGroupMeetCalendarInvite(args: {
  requestId: string;
  title: string;
  timezone: string;
  finalSelection: GroupMeetFinalSelection;
  aiSummary?: string | null;
  invites: GroupMeetInviteDetail[];
  existingInvite?: GroupMeetCalendarInvite | null;
}): Promise<GroupMeetCalendarInvite> {
  const calendarId = getGoogleCalendarId();
  const { accessToken, organizerEmail } = await getGoogleCalendarAuth();
  const attendeeEmails = Array.from(
    new Set(
      args.invites
        .map((invite) => (typeof invite.email === 'string' ? invite.email.trim().toLowerCase() : ''))
        .filter(Boolean)
    )
  );
  const skippedParticipantNames = args.invites
    .filter((invite) => !invite.email)
    .map((invite) => invite.name || 'Unknown');

  const startDateTime = convertLocalDateMinutesToUtcIso(
    args.finalSelection.date,
    args.finalSelection.startMinutes,
    args.timezone
  );
  const endDateTime = convertLocalDateMinutesToUtcIso(
    args.finalSelection.date,
    args.finalSelection.endMinutes,
    args.timezone
  );

  const eventPayload: Record<string, unknown> = {
    summary: args.title,
    description: buildEventDescription({
      title: args.title,
      timezone: args.timezone,
      finalSelection: args.finalSelection,
      aiSummary: args.aiSummary || null,
    }),
    start: {
      dateTime: startDateTime,
      timeZone: args.timezone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: args.timezone,
    },
    attendees: attendeeEmails.map((email) => ({ email })),
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    guestsCanSeeOtherGuests: true,
    reminders: { useDefault: true },
  };

  const existingInvite = args.existingInvite || null;
  let requestUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  let method = 'POST';

  if (existingInvite?.eventId) {
    requestUrl = `${requestUrl}/${encodeURIComponent(existingInvite.eventId)}?sendUpdates=all`;
    method = 'PATCH';
  } else {
    requestUrl = `${requestUrl}?conferenceDataVersion=1&sendUpdates=all`;
    eventPayload.conferenceData = {
      createRequest: {
        requestId: `${args.requestId}-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const response = await fetch(requestUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  const payload = (await response.json().catch(() => ({}))) as GoogleCalendarEventResponse;
  if (!response.ok || !payload.id) {
    throw new Error(payload?.error?.message || `Google Calendar error (${response.status})`);
  }

  const meetLink =
    payload.hangoutLink ||
    payload.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === 'video')?.uri ||
    existingInvite?.meetLink ||
    null;

  return {
    status: existingInvite?.eventId ? 'updated' : 'scheduled',
    eventId: payload.id,
    htmlLink: payload.htmlLink || existingInvite?.htmlLink || null,
    meetLink,
    calendarId,
    createdAt: existingInvite?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attendeeEmails,
    skippedParticipantNames,
    organizerEmail,
  };
}
