export type GroupMeetAvailabilitySlot = {
  date: string;
  startMinutes: number;
  endMinutes: number;
};

export type GroupMeetGuestCalendarImportProvider = "google";

export type GroupMeetGuestCalendarImportStatus =
  | "connected"
  | "disconnected"
  | "error";

export type GroupMeetGuestCalendarImportSyncStatus =
  | "success"
  | "error"
  | "never";

export type GroupMeetGuestCalendarImportSummary = {
  provider: GroupMeetGuestCalendarImportProvider;
  status: GroupMeetGuestCalendarImportStatus;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: GroupMeetGuestCalendarImportSyncStatus;
  lastSyncError: string | null;
  googleAccountEmail: string | null;
};

export type GroupMeetImportedAvailabilitySuggestion =
  GroupMeetAvailabilitySlot & {
    source: "google_calendar";
    importedAt: string | null;
  };

export type GroupMeetInviteSummary = {
  token: string;
  name: string;
  email: string | null;
  imageUrl?: string | null;
  participantType?: "host" | "participant";
  contactId?: string | null;
  shareUrl: string;
  emailStatus: "sent" | "failed" | "not_sent" | "no_email" | "manual_only";
  emailedAt?: string | null;
  calendarImport?: GroupMeetGuestCalendarImportSummary | null;
  emailError?: string | null;
  respondedAt: string | null;
  availabilityCount: number;
};

export type GroupMeetContact = {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdByEmail: string | null;
};

export type GroupMeetInviteDetail = GroupMeetInviteSummary & {
  availabilityEntries: GroupMeetAvailabilitySlot[];
};

export type GroupMeetSharedAvailabilityParticipant = {
  token: string;
  name: string;
  imageUrl: string | null;
  participantType: "host" | "participant";
  respondedAt: string | null;
  availabilityEntries: GroupMeetAvailabilitySlot[];
};

export type GroupMeetRequestStatus = "draft" | "collecting" | "closed";

export type GroupMeetRequestSummary = {
  id: string;
  title: string;
  targetMonth: string;
  deadlineAt: string | null;
  timezone: string;
  meetingDurationMinutes: number;
  createdByEmail: string | null;
  createdAt: string | null;
  participantCount: number;
  responseCount: number;
  status: GroupMeetRequestStatus;
  invites: GroupMeetInviteSummary[];
};

export type GroupMeetCandidateWindow = {
  date: string;
  earliestStartMinutes: number;
  latestStartMinutes: number;
  suggestedStartMinutes: number;
  suggestedEndMinutes: number;
  participantTokens: string[];
  participantNames: string[];
  missingParticipantTokens: string[];
  missingParticipantNames: string[];
  participantCount: number;
  totalParticipants: number;
  allAvailable: boolean;
  flexibilityMinutes: number;
};

export type GroupMeetDateSummary = {
  date: string;
  availableParticipantCount: number;
  participantNames: string[];
};

export type GroupMeetAnalysis = {
  totalParticipants: number;
  respondedParticipantCount: number;
  pendingParticipantCount: number;
  respondedParticipantNames: string[];
  pendingParticipantNames: string[];
  fullMatchCandidates: GroupMeetCandidateWindow[];
  bestCandidates: GroupMeetCandidateWindow[];
  dateSummaries: GroupMeetDateSummary[];
};

export type GroupMeetAiRecommendationCandidate = {
  rank: number;
  candidateKey: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  participantCount: number;
  totalParticipants: number;
  allAvailable: boolean;
  participantNames: string[];
  missingParticipantNames: string[];
  reason: string;
};

export type GroupMeetAiRecommendation = {
  generatedAt: string | null;
  model: string | null;
  summary: string;
  caveats: string[];
  recommendations: GroupMeetAiRecommendationCandidate[];
};

export type GroupMeetFinalSelection = {
  candidateKey: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  participantCount: number;
  totalParticipants: number;
  participantNames: string[];
  missingParticipantNames: string[];
  selectedAt: string | null;
  selectedByEmail: string | null;
  hostNote: string | null;
};

export type GroupMeetCalendarInvite = {
  status: "scheduled" | "updated";
  eventId: string;
  htmlLink: string | null;
  meetLink: string | null;
  calendarId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  attendeeEmails: string[];
  skippedParticipantNames: string[];
  organizerEmail: string | null;
};

export type GroupMeetCalendarSetup = {
  ready: boolean;
  source: "oauth" | "env_json" | "secret_manager" | "split_env" | "missing";
  message: string;
  secretName: string | null;
  delegatedUserEmail: string | null;
  organizerEmail: string | null;
  calendarId: string | null;
};

export type GroupMeetRequestDetail = Omit<
  GroupMeetRequestSummary,
  "invites"
> & {
  invites: GroupMeetInviteDetail[];
  analysis: GroupMeetAnalysis;
  aiRecommendation: GroupMeetAiRecommendation | null;
  finalSelection: GroupMeetFinalSelection | null;
  calendarInvite: GroupMeetCalendarInvite | null;
  calendarSetup: GroupMeetCalendarSetup;
};

export function isValidGroupMeetMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test((value || "").trim());
}

export function resolveGroupMeetStatus(
  deadlineAt: string | null,
  rawStatus?: string | null,
  options?: {
    finalSelection?: unknown;
    calendarInvite?: unknown;
  },
): GroupMeetRequestStatus {
  if (rawStatus === "draft") {
    return "draft";
  }

  if (
    rawStatus === "closed" &&
    (options?.finalSelection || options?.calendarInvite)
  ) {
    return "closed";
  }

  return "collecting";
}

export function hasGroupMeetInviteBeenSent(invite: {
  emailStatus?: string | null;
  emailedAt?: string | null;
}) {
  return (
    Boolean((invite.emailedAt || "").trim()) || invite.emailStatus === "sent"
  );
}

export function resolveGroupMeetStatusFromInvites(
  deadlineAt: string | null,
  rawStatus: string | null | undefined,
  invites: Array<{
    emailStatus?: string | null;
    emailedAt?: string | null;
  }>,
  options?: {
    finalSelection?: unknown;
    calendarInvite?: unknown;
  },
): GroupMeetRequestStatus {
  if (
    rawStatus === "closed" &&
    (options?.finalSelection || options?.calendarInvite)
  ) {
    return "closed";
  }

  const hasSentInvite = invites.some((invite) =>
    hasGroupMeetInviteBeenSent(invite),
  );
  if (hasSentInvite) {
    return resolveGroupMeetStatus(deadlineAt, "collecting", options);
  }

  return resolveGroupMeetStatus(deadlineAt, rawStatus, options);
}

export function hasGroupMeetDeadlinePassed(deadlineAt: string | null) {
  if (!deadlineAt) return false;
  const timestamp = new Date(deadlineAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

export function buildGroupMeetShareUrl(baseUrl: string, token: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/group-meet/${encodeURIComponent(token)}`;
}

export function formatMinutesAsTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 || 12;
  return `${normalizedHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function buildGroupMeetCandidateKey(
  date: string,
  startMinutes: number,
): string {
  return `${date}|${startMinutes}`;
}

export function minutesToTimeInputValue(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeInputValueToMinutes(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return NaN;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

export function normalizeGroupMeetAvailabilitySlots(
  rawSlots: unknown,
  targetMonth: string,
): GroupMeetAvailabilitySlot[] {
  if (!Array.isArray(rawSlots)) return [];

  const deduped = new Map<string, GroupMeetAvailabilitySlot>();

  for (const rawSlot of rawSlots) {
    const slot = rawSlot as
      | Partial<GroupMeetAvailabilitySlot>
      | null
      | undefined;
    const date = typeof slot?.date === "string" ? slot.date.trim() : "";
    const startMinutes = Number(slot?.startMinutes);
    const endMinutes = Number(slot?.endMinutes);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!date.startsWith(`${targetMonth}-`)) continue;
    if (!Number.isInteger(startMinutes) || !Number.isInteger(endMinutes))
      continue;
    if (startMinutes < 0 || endMinutes > 24 * 60 || startMinutes >= endMinutes)
      continue;

    const key = `${date}:${startMinutes}:${endMinutes}`;
    deduped.set(key, { date, startMinutes, endMinutes });
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.startMinutes !== b.startMinutes)
      return a.startMinutes - b.startMinutes;
    return a.endMinutes - b.endMinutes;
  });
}

type CandidateAccumulator = GroupMeetCandidateWindow & {
  participantKey: string;
};

export function computeGroupMeetAnalysis(
  invites: GroupMeetInviteDetail[],
  meetingDurationMinutes: number,
): GroupMeetAnalysis {
  const totalParticipants = invites.length;
  const respondedInvites = invites.filter(
    (invite) => invite.respondedAt || invite.availabilityEntries.length > 0,
  );
  const pendingInvites = invites.filter(
    (invite) =>
      !respondedInvites.some(
        (respondedInvite) => respondedInvite.token === invite.token,
      ),
  );
  const minimumCandidateParticipants = totalParticipants > 1 ? 2 : 1;
  const stepMinutes = 15;
  const allDates = Array.from(
    new Set(
      invites.flatMap((invite) =>
        invite.availabilityEntries.map((slot) => slot.date),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const candidates: CandidateAccumulator[] = [];

  for (const date of allDates) {
    let previousCandidate: CandidateAccumulator | null = null;

    for (
      let startMinutes = 0;
      startMinutes <= 24 * 60 - meetingDurationMinutes;
      startMinutes += stepMinutes
    ) {
      const endMinutes = startMinutes + meetingDurationMinutes;
      const availableInvites = invites.filter((invite) =>
        invite.availabilityEntries.some(
          (slot) =>
            slot.date === date &&
            slot.startMinutes <= startMinutes &&
            slot.endMinutes >= endMinutes,
        ),
      );

      if (availableInvites.length < minimumCandidateParticipants) {
        previousCandidate = null;
        continue;
      }

      const participantTokens = availableInvites
        .map((invite) => invite.token)
        .sort((a, b) => a.localeCompare(b));
      const participantKey = participantTokens.join("|");
      const participantNames = invites
        .filter((invite) => participantTokens.includes(invite.token))
        .map((invite) => invite.name);
      const missingInvites = invites.filter(
        (invite) => !participantTokens.includes(invite.token),
      );

      if (
        previousCandidate &&
        previousCandidate.date === date &&
        previousCandidate.participantKey === participantKey &&
        previousCandidate.latestStartMinutes + stepMinutes === startMinutes
      ) {
        previousCandidate.latestStartMinutes = startMinutes;
        previousCandidate.flexibilityMinutes =
          previousCandidate.latestStartMinutes -
          previousCandidate.earliestStartMinutes;
        previousCandidate.suggestedEndMinutes =
          previousCandidate.suggestedStartMinutes + meetingDurationMinutes;
        continue;
      }

      const nextCandidate: CandidateAccumulator = {
        date,
        earliestStartMinutes: startMinutes,
        latestStartMinutes: startMinutes,
        suggestedStartMinutes: startMinutes,
        suggestedEndMinutes: endMinutes,
        participantTokens,
        participantNames,
        missingParticipantTokens: missingInvites.map((invite) => invite.token),
        missingParticipantNames: missingInvites.map((invite) => invite.name),
        participantCount: participantTokens.length,
        totalParticipants,
        allAvailable: participantTokens.length === totalParticipants,
        flexibilityMinutes: 0,
        participantKey,
      };

      candidates.push(nextCandidate);
      previousCandidate = nextCandidate;
    }
  }

  const sortedCandidates = candidates
    .map(({ participantKey: _participantKey, ...candidate }) => candidate)
    .sort((left, right) => {
      if (left.allAvailable !== right.allAvailable) {
        return left.allAvailable ? -1 : 1;
      }
      if (left.participantCount !== right.participantCount) {
        return right.participantCount - left.participantCount;
      }
      if (left.flexibilityMinutes !== right.flexibilityMinutes) {
        return right.flexibilityMinutes - left.flexibilityMinutes;
      }
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      return left.earliestStartMinutes - right.earliestStartMinutes;
    });

  const dateSummaries = allDates
    .map((date) => {
      const availableInvites = invites.filter((invite) =>
        invite.availabilityEntries.some((slot) => slot.date === date),
      );
      return {
        date,
        availableParticipantCount: availableInvites.length,
        participantNames: availableInvites.map((invite) => invite.name),
      };
    })
    .sort((left, right) => {
      if (left.availableParticipantCount !== right.availableParticipantCount) {
        return right.availableParticipantCount - left.availableParticipantCount;
      }
      return left.date.localeCompare(right.date);
    });

  return {
    totalParticipants,
    respondedParticipantCount: respondedInvites.length,
    pendingParticipantCount: pendingInvites.length,
    respondedParticipantNames: respondedInvites.map((invite) => invite.name),
    pendingParticipantNames: pendingInvites.map((invite) => invite.name),
    fullMatchCandidates: sortedCandidates
      .filter((candidate) => candidate.allAvailable)
      .slice(0, 12),
    bestCandidates: sortedCandidates.slice(0, 20),
    dateSummaries: dateSummaries.slice(0, 12),
  };
}
