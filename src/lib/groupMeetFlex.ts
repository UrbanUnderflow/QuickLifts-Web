import { createHmac, timingSafeEqual } from 'crypto';
import {
  buildGroupMeetCandidateKey,
  type GroupMeetAnalysis,
  type GroupMeetAvailabilitySlot,
  type GroupMeetInviteDetail,
} from './groupMeet';

const GROUP_MEET_FLEX_ACTION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 21;
const GROUP_MEET_FLEX_TIMEZONE = 'America/New_York';

export type GroupMeetFlexPromptOption = GroupMeetAvailabilitySlot & {
  candidateKey: string;
  participantCount: number;
  totalParticipants: number;
  participantNames: string[];
  missingParticipantNames: string[];
};

export type GroupMeetFlexPromptRecipient = {
  inviteToken: string;
  name: string;
  email: string;
  imageUrl: string | null;
  participantType: 'host' | 'participant';
  shareUrl: string;
  options: GroupMeetFlexPromptOption[];
};

export type GroupMeetFlexActionPayload = {
  requestId: string;
  inviteToken: string;
  candidateKey: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  issuedAt: number;
};

function roundToQuarterHour(minutes: number) {
  return Math.round(minutes / 15) * 15;
}

function buildFlexStartOptions(args: {
  earliestStartMinutes: number;
  latestStartMinutes: number;
  defaultStartMinutes: number;
  maxOptions: number;
}) {
  const starts = [
    args.earliestStartMinutes,
    roundToQuarterHour((args.earliestStartMinutes + args.latestStartMinutes) / 2),
    args.latestStartMinutes,
    args.defaultStartMinutes,
  ]
    .filter((value) => value >= args.earliestStartMinutes && value <= args.latestStartMinutes)
    .filter((value, index, collection) => collection.indexOf(value) === index)
    .sort((left, right) => left - right);

  return starts.slice(0, args.maxOptions);
}

function base64UrlEncode(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function getGroupMeetFlexActionSecret() {
  return (
    process.env.GROUP_MEET_FLEX_ACTION_SECRET ||
    process.env.GROUP_MEET_HOST_ACTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET ||
    process.env.FIREBASE_SECRET_KEY ||
    process.env.GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
    'development-group-meet-flex-action-secret'
  );
}

function getEasternParts(value: Date | string | number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: GROUP_MEET_FLEX_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));

  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const year = lookup.get('year') || '0000';
  const month = lookup.get('month') || '00';
  const day = lookup.get('day') || '00';
  const hour = Number(lookup.get('hour') || '0');

  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
  };
}

export function getGroupMeetEasternDateKey(value: Date | string | number) {
  return getEasternParts(value).dateKey;
}

export function isGroupMeetFlexDispatchTime(value: Date | string | number) {
  return getEasternParts(value).hour === 8;
}

export function createGroupMeetFlexActionToken(
  payload: Omit<GroupMeetFlexActionPayload, 'issuedAt'>
) {
  const fullPayload: GroupMeetFlexActionPayload = {
    ...payload,
    issuedAt: Date.now(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', getGroupMeetFlexActionSecret()).update(encodedPayload).digest();
  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export function verifyGroupMeetFlexActionToken(token: string): GroupMeetFlexActionPayload {
  const [encodedPayload, encodedSignature] = (token || '').split('.');
  if (!encodedPayload || !encodedSignature) {
    throw new Error('The flex link is invalid.');
  }

  const expectedSignature = createHmac('sha256', getGroupMeetFlexActionSecret())
    .update(encodedPayload)
    .digest();
  const actualSignature = base64UrlDecode(encodedSignature);
  const expectedView = new Uint8Array(expectedSignature);
  const actualView = new Uint8Array(actualSignature);

  if (expectedView.length !== actualView.length || !timingSafeEqual(expectedView, actualView)) {
    throw new Error('The flex link could not be verified.');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as GroupMeetFlexActionPayload;
  if (
    !payload?.requestId ||
    !payload?.inviteToken ||
    !payload?.candidateKey ||
    !payload?.date ||
    !Number.isInteger(payload?.startMinutes) ||
    !Number.isInteger(payload?.endMinutes) ||
    !Number.isFinite(payload?.issuedAt)
  ) {
    throw new Error('The flex link is incomplete.');
  }

  if (Date.now() - payload.issuedAt > GROUP_MEET_FLEX_ACTION_TOKEN_TTL_MS) {
    throw new Error('This flex link has expired.');
  }

  return payload;
}

export function buildGroupMeetFlexSelectionUrl(baseUrl: string, token: string) {
  const trimmedBaseUrl = (baseUrl || '').replace(/\/+$/, '');
  return `${trimmedBaseUrl}/group-meet/flex/${encodeURIComponent(token)}`;
}

export function buildGroupMeetFlexPromptRecipients(args: {
  analysis: GroupMeetAnalysis;
  invites: GroupMeetInviteDetail[];
  maxOptionsPerRecipient?: number;
  includeHost?: boolean;
}) {
  const maxOptionsPerRecipient = Math.max(1, Number(args.maxOptionsPerRecipient) || 3);
  const inviteByToken = new Map(args.invites.map((invite) => [invite.token, invite] as const));
  const recipients = new Map<string, GroupMeetFlexPromptRecipient>();

  for (const candidate of args.analysis.bestCandidates) {
    if (candidate.missingParticipantTokens.length !== 1) {
      continue;
    }

    if (candidate.participantCount !== Math.max(candidate.totalParticipants - 1, 0)) {
      continue;
    }

    const inviteToken = candidate.missingParticipantTokens[0];
    const invite = inviteByToken.get(inviteToken);
    if (!invite?.email) {
      continue;
    }

    if (!args.includeHost && invite.participantType === 'host') {
      continue;
    }

    const option: GroupMeetFlexPromptOption = {
      candidateKey: buildGroupMeetCandidateKey(candidate.date, candidate.suggestedStartMinutes),
      date: candidate.date,
      startMinutes: candidate.suggestedStartMinutes,
      endMinutes: candidate.suggestedEndMinutes,
      participantCount: candidate.participantCount,
      totalParticipants: candidate.totalParticipants,
      participantNames: [...candidate.participantNames],
      missingParticipantNames: [...candidate.missingParticipantNames],
    };

    const existing = recipients.get(invite.token) || {
      inviteToken: invite.token,
      name: invite.name || 'Guest',
      email: invite.email,
      imageUrl: invite.imageUrl || null,
      participantType: invite.participantType || 'participant',
      shareUrl: invite.shareUrl,
      options: [],
    };

    const durationMinutes = candidate.suggestedEndMinutes - candidate.suggestedStartMinutes;
    const remainingCapacity = Math.max(0, maxOptionsPerRecipient - existing.options.length);
    const startOptions = buildFlexStartOptions({
      earliestStartMinutes: candidate.earliestStartMinutes,
      latestStartMinutes: candidate.latestStartMinutes,
      defaultStartMinutes: option.startMinutes,
      maxOptions: remainingCapacity,
    });

    for (const startMinutes of startOptions) {
      const candidateKey = buildGroupMeetCandidateKey(candidate.date, startMinutes);
      if (existing.options.some((entry) => entry.candidateKey === candidateKey)) {
        continue;
      }

      if (existing.options.length >= maxOptionsPerRecipient) {
        break;
      }

      existing.options.push({
        candidateKey,
        date: candidate.date,
        startMinutes,
        endMinutes: startMinutes + durationMinutes,
        participantCount: candidate.participantCount,
        totalParticipants: candidate.totalParticipants,
        participantNames: [...candidate.participantNames],
        missingParticipantNames: [...candidate.missingParticipantNames],
      });
    }

    recipients.set(invite.token, existing);
  }

  return Array.from(recipients.values())
    .filter((recipient) => recipient.options.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildGroupMeetFlexRoundOptions(args: {
  analysis: GroupMeetAnalysis;
  maxOptions?: number;
}) {
  const maxOptions = Math.max(1, Number(args.maxOptions) || 3);
  const options: GroupMeetFlexPromptOption[] = [];

  const prioritizedCandidates = [
    ...args.analysis.bestCandidates.filter(
      (candidate) => candidate.participantCount >= Math.max(candidate.totalParticipants - 1, 1)
    ),
    ...args.analysis.bestCandidates.filter(
      (candidate) => candidate.participantCount < Math.max(candidate.totalParticipants - 1, 1)
    ),
  ];

  for (const candidate of prioritizedCandidates) {
    if (options.length >= maxOptions) {
      break;
    }

    const durationMinutes = candidate.suggestedEndMinutes - candidate.suggestedStartMinutes;
    const remainingCapacity = Math.max(0, maxOptions - options.length);
    const startOptions = buildFlexStartOptions({
      earliestStartMinutes: candidate.earliestStartMinutes,
      latestStartMinutes: candidate.latestStartMinutes,
      defaultStartMinutes: candidate.suggestedStartMinutes,
      maxOptions: remainingCapacity,
    });

    for (const startMinutes of startOptions) {
      const candidateKey = buildGroupMeetCandidateKey(candidate.date, startMinutes);
      if (options.some((entry) => entry.candidateKey === candidateKey)) {
        continue;
      }

      if (options.length >= maxOptions) {
        break;
      }

      options.push({
        candidateKey,
        date: candidate.date,
        startMinutes,
        endMinutes: startMinutes + durationMinutes,
        participantCount: candidate.participantCount,
        totalParticipants: candidate.totalParticipants,
        participantNames: [...candidate.participantNames],
        missingParticipantNames: [...candidate.missingParticipantNames],
      });
    }
  }

  return options;
}
