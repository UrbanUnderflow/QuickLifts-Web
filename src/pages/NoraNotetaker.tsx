import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
  GoogleAuthProvider,
  OAuthProvider,
  User,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  LogOut,
  Mail,
  Mic2,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react';
import { simpBudgetAuth, simpBudgetDb } from '../api/firebase/simpBudgetConfig';

type MessageTone = 'success' | 'error' | 'info';
type MeetingPlatform = 'zoom' | 'google-meet' | 'teams' | 'other';
type MeetingStatus = 'scheduled' | 'queued' | 'needs-review' | 'notes-ready';

interface NoraMeetingDraft {
  title: string;
  meetingUrl: string;
  platform: MeetingPlatform;
  startsAt: string;
  attendeesText: string;
  agenda: string;
}

interface NoraNoteDraft {
  rawTranscript: string;
  summary: string;
  decisionsText: string;
  actionItemsText: string;
  followUpsText: string;
}

interface NoraMeetingRecord {
  id: string;
  title: string;
  meetingUrl: string;
  platform: MeetingPlatform;
  startsAt: string;
  attendees: string[];
  agenda: string;
  status: MeetingStatus;
  rawTranscript: string;
  summary: string;
  decisions: string[];
  actionItems: string[];
  followUps: string[];
  botName: string;
  productName: string;
  consentMode: string;
  workerJobId?: string;
  workerMode?: string;
  workerStatus?: string;
  workerError?: string;
  calendarEventId?: string;
  calendarHtmlLink?: string;
  source?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

type GoogleCalendarEvent = {
  id?: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
  }>;
  conferenceData?: {
    entryPoints?: Array<{
      uri?: string;
      entryPointType?: string;
    }>;
  };
};

const SIMPBUDGET_USERS_COLLECTION = 'simpbudget-users';
const NORA_MEETINGS_SUBCOLLECTION = 'noraNotetakerMeetings';
const MAGIC_LINK_EMAIL_STORAGE_KEY = 'nora.notetaker.pendingMagicEmail';
const BOT_NAME = 'Nora';
const PRODUCT_NAME = 'NoraNotetaker';
const GOOGLE_CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_CALENDAR_SYNC_DAYS = 14;

const PLATFORM_OPTIONS: Array<{ value: MeetingPlatform; label: string }> = [
  { value: 'zoom', label: 'Zoom' },
  { value: 'google-meet', label: 'Google Meet' },
  { value: 'teams', label: 'Teams' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  queued: 'Queued',
  'needs-review': 'Needs review',
  'notes-ready': 'Notes ready',
};

const fieldClassName =
  'w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

const actionButtonClassName =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

const createDefaultStartsAt = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 60);
  date.setSeconds(0, 0);
  return toDatetimeLocalInput(date);
};

const createEmptyMeetingDraft = (): NoraMeetingDraft => ({
  title: '',
  meetingUrl: '',
  platform: 'zoom',
  startsAt: createDefaultStartsAt(),
  attendeesText: '',
  agenda: '',
});

const createEmptyNoteDraft = (): NoraNoteDraft => ({
  rawTranscript: '',
  summary: '',
  decisionsText: '',
  actionItemsText: '',
  followUpsText: '',
});

function toDatetimeLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const splitLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
};

const normalizePlatform = (value: unknown): MeetingPlatform => {
  if (value === 'zoom' || value === 'google-meet' || value === 'teams' || value === 'other') return value;
  return 'other';
};

const normalizeStatus = (value: unknown): MeetingStatus => {
  if (value === 'scheduled' || value === 'queued' || value === 'needs-review' || value === 'notes-ready') return value;
  return 'scheduled';
};

const detectPlatform = (url: string): MeetingPlatform => {
  const normalized = url.toLowerCase();
  if (normalized.includes('zoom.us')) return 'zoom';
  if (normalized.includes('meet.google.com')) return 'google-meet';
  if (normalized.includes('teams.microsoft.com')) return 'teams';
  return 'other';
};

const stripHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractMeetingUrl = (event: GoogleCalendarEvent) => {
  const conferenceUrl = event.conferenceData?.entryPoints?.find((entryPoint) => {
    const uri = typeof entryPoint.uri === 'string' ? entryPoint.uri : '';
    return uri && detectPlatform(uri) !== 'other';
  })?.uri;

  const candidates = [
    event.hangoutLink,
    conferenceUrl,
    event.location,
    stripHtml(event.description || ''),
  ]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join('\n');

  const urlMatches = candidates.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  return urlMatches.find((url) => detectPlatform(url) !== 'other') || '';
};

const calendarEventStartsAt = (event: GoogleCalendarEvent) => {
  const raw = event.start?.dateTime || event.start?.date || '';
  if (!raw) return createDefaultStartsAt();
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? createDefaultStartsAt() : toDatetimeLocalInput(date);
};

const buildCalendarMeetingPayload = (event: GoogleCalendarEvent, meetingUrl: string, ownerEmail: string) => {
  const platform = detectPlatform(meetingUrl);
  const attendees = (event.attendees || [])
    .map((attendee) => attendee.displayName || attendee.email || '')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    title: event.summary?.trim() || `${formatPlatform(platform)} meeting`,
    meetingUrl,
    platform,
    startsAt: calendarEventStartsAt(event),
    attendees,
    agenda: stripHtml(event.description || ''),
    status: 'scheduled' as MeetingStatus,
    rawTranscript: '',
    summary: '',
    decisions: [],
    actionItems: [],
    followUps: [],
    botName: BOT_NAME,
    productName: PRODUCT_NAME,
    consentMode: 'host-approved',
    worker: {
      status: 'not-queued',
      provider: 'nora-owned-worker',
      targetDisplayName: BOT_NAME,
      requestedPlatforms: ['google-meet', 'zoom', 'teams'],
    },
    source: 'google-calendar',
    calendarEventId: event.id || '',
    calendarHtmlLink: event.htmlLink || '',
    ownerEmail,
    updatedAt: serverTimestamp(),
  };
};

const formatMeetingTime = (value: string) => {
  if (!value) return 'Time not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatPlatform = (platform: MeetingPlatform) =>
  PLATFORM_OPTIONS.find((option) => option.value === platform)?.label || 'Other';

const readAuthError = (error: unknown, fallbackMessage: string) => {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  if (code === 'auth/unauthorized-domain') {
    const host =
      typeof window !== 'undefined' && window.location.hostname
        ? window.location.hostname
        : 'this site';

    return `Firebase Auth is not allowing ${host}. Add ${host} in the SimpBudget Firebase project authorized domains, then try again.`;
  }

  return error instanceof Error ? error.message : fallbackMessage;
};

const readFirestoreError = (error: unknown, fallbackMessage: string) => {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  if (code === 'permission-denied') {
    return 'The standalone Firebase project is rejecting this write. Deploy the SimpBudget rules so signed-in users can manage their own simpbudget-users/{uid} tree.';
  }

  return error instanceof Error ? error.message : fallbackMessage;
};

const normalizeMeetingRecord = (id: string, raw: Record<string, unknown>): NoraMeetingRecord => ({
  id,
  title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Untitled meeting',
  meetingUrl: typeof raw.meetingUrl === 'string' ? raw.meetingUrl : '',
  platform: normalizePlatform(raw.platform),
  startsAt: typeof raw.startsAt === 'string' ? raw.startsAt : '',
  attendees: normalizeStringArray(raw.attendees),
  agenda: typeof raw.agenda === 'string' ? raw.agenda : '',
  status: normalizeStatus(raw.status),
  rawTranscript: typeof raw.rawTranscript === 'string' ? raw.rawTranscript : '',
  summary: typeof raw.summary === 'string' ? raw.summary : '',
  decisions: normalizeStringArray(raw.decisions),
  actionItems: normalizeStringArray(raw.actionItems),
  followUps: normalizeStringArray(raw.followUps),
  botName: typeof raw.botName === 'string' && raw.botName.trim() ? raw.botName : BOT_NAME,
  productName:
    typeof raw.productName === 'string' && raw.productName.trim() ? raw.productName : PRODUCT_NAME,
  consentMode:
    typeof raw.consentMode === 'string' && raw.consentMode.trim()
      ? raw.consentMode
      : 'host-approved',
  workerJobId: typeof raw.workerJobId === 'string' ? raw.workerJobId : undefined,
  workerMode: typeof raw.workerMode === 'string' ? raw.workerMode : undefined,
  workerStatus: typeof raw.workerStatus === 'string' ? raw.workerStatus : undefined,
  workerError: typeof raw.workerError === 'string' ? raw.workerError : undefined,
  calendarEventId: typeof raw.calendarEventId === 'string' ? raw.calendarEventId : undefined,
  calendarHtmlLink: typeof raw.calendarHtmlLink === 'string' ? raw.calendarHtmlLink : undefined,
  source: typeof raw.source === 'string' ? raw.source : undefined,
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
});

const buildMeetingPayload = (draft: NoraMeetingDraft, ownerEmail: string) => {
  const meetingUrl = draft.meetingUrl.trim();
  const platform = draft.platform === 'other' ? detectPlatform(meetingUrl) : draft.platform;

  return {
    title: draft.title.trim() || `${formatPlatform(platform)} meeting`,
    meetingUrl,
    platform,
    startsAt: draft.startsAt,
    attendees: splitLines(draft.attendeesText),
    agenda: draft.agenda.trim(),
    status: 'scheduled' as MeetingStatus,
    rawTranscript: '',
    summary: '',
    decisions: [],
    actionItems: [],
    followUps: [],
    botName: BOT_NAME,
    productName: PRODUCT_NAME,
    consentMode: 'host-approved',
    worker: {
      status: 'not-queued',
      provider: 'nora-owned-worker',
      targetDisplayName: BOT_NAME,
      requestedPlatforms: ['google-meet', 'zoom', 'teams'],
    },
    source: 'manual',
    ownerEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

const createNoteDraftFromMeeting = (meeting: NoraMeetingRecord | null): NoraNoteDraft =>
  meeting
    ? {
        rawTranscript: meeting.rawTranscript,
        summary: meeting.summary,
        decisionsText: meeting.decisions.join('\n'),
        actionItemsText: meeting.actionItems.join('\n'),
        followUpsText: meeting.followUps.join('\n'),
      }
    : createEmptyNoteDraft();

const createDraftNotesFromTranscript = (transcript: string): NoraNoteDraft => {
  const lines = transcript
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const sentenceCandidates = transcript
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
  const summary = sentenceCandidates.slice(0, 3).join(' ');
  const actionItems = lines.filter((line) => /(action|todo|follow up|owner|due)/i.test(line)).slice(0, 8);
  const decisions = lines.filter((line) => /(decision|decided|agreed|approved)/i.test(line)).slice(0, 8);
  const followUps = lines.filter((line) => /(send|schedule|confirm|circle back|next step)/i.test(line)).slice(0, 8);

  return {
    rawTranscript: transcript,
    summary: summary || lines.slice(0, 3).join(' '),
    decisionsText: decisions.join('\n'),
    actionItemsText: actionItems.join('\n'),
    followUpsText: followUps.join('\n'),
  };
};

const readApiError = (payload: unknown, fallbackMessage: string) => {
  if (payload && typeof payload === 'object') {
    const candidate = payload as Record<string, unknown>;
    if (typeof candidate.error === 'string' && candidate.error.trim()) return candidate.error;
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
  }

  return fallbackMessage;
};

const NoraNotetakerPage: React.FC = () => {
  const [authReady, setAuthReady] = useState(false);
  const [authReadyTimedOut, setAuthReadyTimedOut] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authMessage, setAuthMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [appMessage, setAppMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [magicEmail, setMagicEmail] = useState('');
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [meetingDraft, setMeetingDraft] = useState<NoraMeetingDraft>(createEmptyMeetingDraft);
  const [noteDraft, setNoteDraft] = useState<NoraNoteDraft>(createEmptyNoteDraft);
  const [meetings, setMeetings] = useState<NoraMeetingRecord[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');

  const canAttemptAuth = authReady || authReadyTimedOut;
  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedMeetingId) || null;
  const upcomingMeetings = useMemo(
    () =>
      meetings.filter((meeting) => {
        if (!meeting.startsAt) return true;
        const startsAt = new Date(meeting.startsAt).getTime();
        return Number.isNaN(startsAt) || startsAt >= Date.now() - 1000 * 60 * 60 * 2;
      }),
    [meetings]
  );
  const notesReadyCount = meetings.filter((meeting) => meeting.status === 'notes-ready').length;

  const userDocRef = (uid: string) => doc(simpBudgetDb, SIMPBUDGET_USERS_COLLECTION, uid);
  const meetingsCollectionRef = (uid: string) =>
    collection(simpBudgetDb, SIMPBUDGET_USERS_COLLECTION, uid, NORA_MEETINGS_SUBCOLLECTION);

  const loadMeetings = async (uid: string) => {
    setLoadingData(true);

    try {
      const snapshot = await getDocs(query(meetingsCollectionRef(uid), orderBy('startsAt', 'desc')));
      const loadedMeetings = snapshot.docs.map((meetingDoc) =>
        normalizeMeetingRecord(meetingDoc.id, meetingDoc.data() as Record<string, unknown>)
      );

      setMeetings(loadedMeetings);
      setSelectedMeetingId((currentId) => {
        if (currentId && loadedMeetings.some((meeting) => meeting.id === currentId)) return currentId;
        return loadedMeetings[0]?.id || '';
      });
      setAppMessage(null);
    } catch (error) {
      console.error('Unable to load NoraNotetaker meetings:', error);
      setAppMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to load NoraNotetaker meetings.'),
      });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setAuthReadyTimedOut(true), 2500);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(simpBudgetAuth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);

      if (currentUser) {
        try {
          await setDoc(
            userDocRef(currentUser.uid),
            {
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              noraNotetaker: {
                botName: BOT_NAME,
                productName: PRODUCT_NAME,
                lastSeenAt: serverTimestamp(),
              },
              lastSeenAt: serverTimestamp(),
            },
            { merge: true }
          );
          await loadMeetings(currentUser.uid);
        } catch (error) {
          console.error('Unable to initialize NoraNotetaker user:', error);
          setMeetings([]);
          setSelectedMeetingId('');
          setAppMessage({
            type: 'error',
            text: readFirestoreError(error, 'Unable to initialize NoraNotetaker.'),
          });
        }
      } else {
        setMeetings([]);
        setSelectedMeetingId('');
        setNoteDraft(createEmptyNoteDraft());
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isSignInWithEmailLink(simpBudgetAuth, window.location.href)) return;

    const completeEmailLinkSignIn = async () => {
      const storedEmail = window.localStorage.getItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
      const email = storedEmail || window.prompt('Confirm your email for NoraNotetaker sign-in') || '';
      if (!email) return;

      try {
        await signInWithEmailLink(simpBudgetAuth, email, window.location.href);
        window.localStorage.removeItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
        setAuthMessage({ type: 'success', text: 'Signed in with magic link.' });
      } catch (error) {
        console.error('Magic link sign-in failed:', error);
        setAuthMessage({
          type: 'error',
          text: readAuthError(error, 'Unable to finish magic link sign-in.'),
        });
      }
    };

    completeEmailLinkSignIn();
  }, []);

  useEffect(() => {
    setNoteDraft(createNoteDraftFromMeeting(selectedMeeting));
  }, [selectedMeetingId]);

  const handleGoogleSignIn = async () => {
    setAuthMessage(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(simpBudgetAuth, provider);
    } catch (error) {
      console.error('Google sign-in failed:', error);
      setAuthMessage({
        type: 'error',
        text: readAuthError(error, 'Unable to sign in with Google.'),
      });
    }
  };

  const handleAppleSignIn = async () => {
    setAuthMessage(null);
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');

    try {
      await signInWithPopup(simpBudgetAuth, provider);
    } catch (error) {
      console.error('Apple sign-in failed:', error);
      setAuthMessage({
        type: 'error',
        text: readAuthError(error, 'Unable to sign in with Apple.'),
      });
    }
  };

  const sendMagicLink = async () => {
    const email = magicEmail.trim();
    if (!email) {
      setAuthMessage({ type: 'error', text: 'Enter an email address first.' });
      return;
    }

    setSendingMagicLink(true);
    setAuthMessage(null);

    try {
      const actionCodeSettings = {
        url:
          typeof window !== 'undefined'
            ? window.location.origin + '/NoraNotetaker'
            : 'https://fitwithpulse.ai/NoraNotetaker',
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(simpBudgetAuth, email, actionCodeSettings);
      window.localStorage.setItem(MAGIC_LINK_EMAIL_STORAGE_KEY, email);
      setAuthMessage({ type: 'success', text: 'Magic link sent. Open it on this device to finish sign-in.' });
    } catch (error) {
      console.error('Unable to send magic link:', error);
      setAuthMessage({
        type: 'error',
        text: readAuthError(error, 'Unable to send magic link.'),
      });
    } finally {
      setSendingMagicLink(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(simpBudgetAuth);
  };

  const syncGoogleCalendar = async () => {
    if (!user) return;

    setSyncingCalendar(true);
    setAppMessage(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope(GOOGLE_CALENDAR_READONLY_SCOPE);
      provider.setCustomParameters({ prompt: 'consent select_account' });

      const result = await signInWithPopup(simpBudgetAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      const syncUser = result.user || user;

      if (!accessToken) {
        throw new Error('Google did not return Calendar access. Please approve calendar read access and try again.');
      }

      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + GOOGLE_CALENDAR_SYNC_DAYS);
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '100',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        fields:
          'items(id,htmlLink,summary,description,location,hangoutLink,start,attendees(email,displayName),conferenceData(entryPoints(uri,entryPointType)))',
      });

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(readApiError(payload, 'Unable to read Google Calendar events.'));
      }

      const events = Array.isArray(payload?.items) ? (payload.items as GoogleCalendarEvent[]) : [];
      const existingMeetingsSnapshot = await getDocs(meetingsCollectionRef(syncUser.uid));
      const existingKeys = new Set<string>();
      existingMeetingsSnapshot.docs.forEach((meetingDoc) => {
        const data = meetingDoc.data() as Record<string, unknown>;
        if (typeof data.calendarEventId === 'string' && data.calendarEventId) {
          existingKeys.add(`event:${data.calendarEventId}`);
        }
        if (typeof data.meetingUrl === 'string' && data.meetingUrl) {
          existingKeys.add(`url:${data.meetingUrl}`);
        }
      });

      let importedCount = 0;
      let skippedCount = 0;

      for (const event of events) {
        const meetingUrl = extractMeetingUrl(event);
        if (!meetingUrl) {
          skippedCount += 1;
          continue;
        }

        const eventKey = event.id ? `event:${event.id}` : '';
        const urlKey = `url:${meetingUrl}`;
        if ((eventKey && existingKeys.has(eventKey)) || existingKeys.has(urlKey)) {
          skippedCount += 1;
          continue;
        }

        const meetingPayload = {
          ...buildCalendarMeetingPayload(event, meetingUrl, syncUser.email || user.email || ''),
          createdAt: serverTimestamp(),
        };
        await addDoc(meetingsCollectionRef(syncUser.uid), meetingPayload);
        if (eventKey) existingKeys.add(eventKey);
        existingKeys.add(urlKey);
        importedCount += 1;
      }

      await setDoc(
        userDocRef(syncUser.uid),
        {
          noraNotetaker: {
            googleCalendar: {
              lastApprovedSync: true,
              accessMode: 'popup-readonly-token',
              scope: GOOGLE_CALENDAR_READONLY_SCOPE,
              lastSyncedAt: serverTimestamp(),
              syncWindowDays: GOOGLE_CALENDAR_SYNC_DAYS,
            },
          },
        },
        { merge: true }
      );

      await loadMeetings(syncUser.uid);
      setAppMessage({
        type: importedCount ? 'success' : 'info',
        text: importedCount
          ? `Imported ${importedCount} calendar meeting${importedCount === 1 ? '' : 's'} for Nora.`
          : `No new video meetings found. Nora skipped ${skippedCount} calendar event${skippedCount === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      console.error('Unable to sync Google Calendar:', error);
      setAppMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to sync Google Calendar.',
      });
    } finally {
      setSyncingCalendar(false);
    }
  };

  const updateMeetingDraft = (field: keyof NoraMeetingDraft, value: string) => {
    setMeetingDraft((currentDraft) => {
      const nextDraft = { ...currentDraft, [field]: value };
      if (field === 'meetingUrl') {
        nextDraft.platform = detectPlatform(value);
      }
      return nextDraft;
    });
  };

  const createMeeting = async () => {
    if (!user) return;
    const meetingUrl = meetingDraft.meetingUrl.trim();

    if (!meetingUrl) {
      setAppMessage({ type: 'error', text: 'Add the meeting link first.' });
      return;
    }

    setSaving(true);
    setAppMessage(null);

    try {
      const created = await addDoc(
        meetingsCollectionRef(user.uid),
        buildMeetingPayload(meetingDraft, user.email || '')
      );
      setMeetingDraft(createEmptyMeetingDraft());
      await loadMeetings(user.uid);
      setSelectedMeetingId(created.id);
      setAppMessage({ type: 'success', text: 'Nora meeting saved.' });
    } catch (error) {
      console.error('Unable to save Nora meeting:', error);
      setAppMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to save this meeting.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const queueSelectedMeeting = async () => {
    if (!user || !selectedMeeting) return;

    setSaving(true);
    setAppMessage(null);

    try {
      const idToken = await simpBudgetAuth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Please sign in again before sending Nora to this meeting.');
      }

      const response = await fetch('/api/nora-notetaker/queue-bot', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId: selectedMeeting.id,
          meetingUrl: selectedMeeting.meetingUrl,
          startsAt: selectedMeeting.startsAt,
          title: selectedMeeting.title,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(readApiError(payload, 'Nora could not be sent to this meeting.'));
      }

      await setDoc(
        doc(meetingsCollectionRef(user.uid), selectedMeeting.id),
        {
          status: 'queued',
          worker: {
            status: 'queued',
            provider: payload.provider || 'nora-owned-worker',
            targetDisplayName: BOT_NAME,
            mode: payload.workerMode || 'caption-browser',
            requestedPlatforms: ['google-meet', 'zoom', 'teams'],
            queuePath: typeof payload.workerQueuePath === 'string' ? payload.workerQueuePath : '',
          },
          workerJobId: typeof payload.workerJobId === 'string' ? payload.workerJobId : selectedMeeting.id,
          workerMode: typeof payload.workerMode === 'string' ? payload.workerMode : 'caption-browser',
          workerStatus: typeof payload.workerStatus === 'string' ? payload.workerStatus : 'queued',
          workerJoinAt: typeof payload.workerJoinAt === 'string' ? payload.workerJoinAt : '',
          workerError: '',
          queuedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await loadMeetings(user.uid);
      setAppMessage({ type: 'success', text: 'Nora is queued to join this meeting.' });
    } catch (error) {
      console.error('Unable to queue Nora meeting:', error);
      setAppMessage({
        type: 'error',
        text: error instanceof Error ? error.message : readFirestoreError(error, 'Unable to queue this meeting.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const syncSelectedMeeting = async () => {
    if (!user || !selectedMeeting) return;
    if (!selectedMeeting.workerJobId) {
      setAppMessage({ type: 'error', text: 'Queue Nora before refreshing worker notes.' });
      return;
    }

    setSaving(true);
    setAppMessage(null);

    try {
      const idToken = await simpBudgetAuth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Please sign in again before syncing Nora notes.');
      }

      const response = await fetch('/api/nora-notetaker/sync-bot', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId: selectedMeeting.id,
          workerJobId: selectedMeeting.workerJobId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(readApiError(payload, 'Nora could not sync this meeting yet.'));
      }

      const refreshedSnapshot = await getDoc(doc(meetingsCollectionRef(user.uid), selectedMeeting.id));
      const refreshedMeeting = refreshedSnapshot.exists()
        ? normalizeMeetingRecord(refreshedSnapshot.id, refreshedSnapshot.data() as Record<string, unknown>)
        : selectedMeeting;
      const rawTranscript = refreshedMeeting.rawTranscript || '';
      if (rawTranscript) {
        const draftedNotes = createDraftNotesFromTranscript(rawTranscript);
        setNoteDraft(draftedNotes);
      }
      await loadMeetings(user.uid);
      setAppMessage({
        type: rawTranscript ? 'success' : 'info',
        text: rawTranscript
          ? 'Nora transcript refreshed and drafted.'
          : payload?.message || 'Nora has not written a transcript yet.',
      });
    } catch (error) {
      console.error('Unable to sync Nora meeting:', error);
      setAppMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to sync Nora notes.',
      });
    } finally {
      setSaving(false);
    }
  };

  const draftNotes = () => {
    if (!noteDraft.rawTranscript.trim()) {
      setAppMessage({ type: 'error', text: 'Paste a transcript before drafting notes.' });
      return;
    }
    setNoteDraft(createDraftNotesFromTranscript(noteDraft.rawTranscript));
    setAppMessage({ type: 'info', text: 'Draft notes created for review.' });
  };

  const saveNotes = async () => {
    if (!user || !selectedMeeting) return;

    setSaving(true);
    setAppMessage(null);

    try {
      const hasNotes = Boolean(
        noteDraft.rawTranscript.trim() ||
          noteDraft.summary.trim() ||
          noteDraft.decisionsText.trim() ||
          noteDraft.actionItemsText.trim() ||
          noteDraft.followUpsText.trim()
      );

      await setDoc(
        doc(meetingsCollectionRef(user.uid), selectedMeeting.id),
        {
          rawTranscript: noteDraft.rawTranscript.trim(),
          summary: noteDraft.summary.trim(),
          decisions: splitLines(noteDraft.decisionsText),
          actionItems: splitLines(noteDraft.actionItemsText),
          followUps: splitLines(noteDraft.followUpsText),
          status: hasNotes ? 'notes-ready' : 'needs-review',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await loadMeetings(user.uid);
      setAppMessage({ type: 'success', text: 'Nora notes saved.' });
    } catch (error) {
      console.error('Unable to save Nora notes:', error);
      setAppMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to save these notes.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedMeeting = async () => {
    if (!user || !selectedMeeting) return;
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm(`Delete ${selectedMeeting.title}? This removes the meeting and notes from NoraNotetaker.`);
    if (!confirmed) return;

    setSaving(true);
    setAppMessage(null);

    try {
      await deleteDoc(doc(meetingsCollectionRef(user.uid), selectedMeeting.id));
      await loadMeetings(user.uid);
      setAppMessage({ type: 'success', text: 'Meeting deleted.' });
    } catch (error) {
      console.error('Unable to delete Nora meeting:', error);
      setAppMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to delete this meeting.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const renderMessage = (message: { type: MessageTone; text: string } | null) => {
    if (!message) return null;
    const toneClassName =
      message.type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : message.type === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-sky-200 bg-sky-50 text-sky-900';

    return (
      <div className={`rounded-md border px-3 py-2 text-sm ${toneClassName}`}>
        {message.text}
      </div>
    );
  };

  if (!authReady && !authReadyTimedOut) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <Head>
          <title>NoraNotetaker | Pulse</title>
        </Head>
        <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center text-center">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-300" />
          <div className="mt-4 text-lg font-semibold">Loading NoraNotetaker...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f7f5ef] text-zinc-950">
        <Head>
          <title>NoraNotetaker | Pulse</title>
        </Head>
        <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[1fr_420px] lg:items-center lg:px-8">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-semibold text-emerald-800">
              <Bot className="h-4 w-4" />
              NoraNotetaker
            </div>
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">
                Meeting memory, carried by Nora.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-600">
                Save Zoom, Google Meet, and Teams sessions into the same standalone workspace used by SimpBudget and PipeLists.
              </p>
            </div>
            <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                { label: 'Bot name', value: BOT_NAME },
                { label: 'Database', value: 'SimpBudget Firebase' },
                { label: 'Route', value: '/NoraNotetaker' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.label}</div>
                  <div className="mt-2 text-lg font-semibold text-zinc-950">{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-600 text-white">
                <Mic2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Sign in</h2>
                <p className="text-sm text-zinc-500">Use the standalone Firebase account.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={!canAttemptAuth}
                className={`${actionButtonClassName} bg-zinc-950 text-white hover:bg-zinc-800`}
              >
                <Sparkles className="h-4 w-4" />
                Continue with Google
              </button>
              <button
                type="button"
                onClick={handleAppleSignIn}
                disabled={!canAttemptAuth}
                className={`${actionButtonClassName} border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Continue with Apple
              </button>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="email"
                  value={magicEmail}
                  onChange={(event) => setMagicEmail(event.target.value)}
                  placeholder="Email address"
                  className={fieldClassName}
                />
                <button
                  type="button"
                  onClick={sendMagicLink}
                  disabled={!canAttemptAuth || sendingMagicLink}
                  className={`${actionButtonClassName} border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50`}
                >
                  {sendingMagicLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Magic link
                </button>
              </div>
              {renderMessage(authMessage)}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-zinc-950">
      <Head>
        <title>NoraNotetaker | Pulse</title>
      </Head>
      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <Bot className="h-4 w-4" />
              NoraNotetaker
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-zinc-950">Nora meeting notes</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={syncGoogleCalendar}
              disabled={syncingCalendar}
              className={`${actionButtonClassName} bg-emerald-700 text-white hover:bg-emerald-800`}
            >
              {syncingCalendar ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Sync Google Calendar
            </button>
            <button
              type="button"
              onClick={() => loadMeetings(user.uid)}
              disabled={loadingData}
              className={`${actionButtonClassName} border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50`}
            >
              {loadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className={`${actionButtonClassName} border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50`}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>

        <section className="grid gap-3 py-5 sm:grid-cols-3">
          {[
            { label: 'Upcoming', value: String(upcomingMeetings.length), icon: CalendarClock },
            { label: 'Notes ready', value: String(notesReadyCount), icon: FileText },
            { label: 'Bot display', value: BOT_NAME, icon: Bot },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{item.value}</div>
                </div>
                <item.icon className="h-5 w-5 text-emerald-700" />
              </div>
            </div>
          ))}
        </section>

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-5">
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-700" />
                <h2 className="text-lg font-semibold">Add meeting</h2>
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  value={meetingDraft.title}
                  onChange={(event) => updateMeetingDraft('title', event.target.value)}
                  placeholder="Meeting title"
                  className={fieldClassName}
                />
                <input
                  value={meetingDraft.meetingUrl}
                  onChange={(event) => updateMeetingDraft('meetingUrl', event.target.value)}
                  placeholder="Meeting link"
                  className={fieldClassName}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={meetingDraft.platform}
                    onChange={(event) => updateMeetingDraft('platform', event.target.value)}
                    className={fieldClassName}
                  >
                    {PLATFORM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    value={meetingDraft.startsAt}
                    onChange={(event) => updateMeetingDraft('startsAt', event.target.value)}
                    className={fieldClassName}
                  />
                </div>
                <textarea
                  value={meetingDraft.attendeesText}
                  onChange={(event) => updateMeetingDraft('attendeesText', event.target.value)}
                  rows={3}
                  placeholder="Attendees, one per line"
                  className={fieldClassName}
                />
                <textarea
                  value={meetingDraft.agenda}
                  onChange={(event) => updateMeetingDraft('agenda', event.target.value)}
                  rows={3}
                  placeholder="Agenda"
                  className={fieldClassName}
                />
                <button
                  type="button"
                  onClick={createMeeting}
                  disabled={saving}
                  className={`${actionButtonClassName} bg-emerald-700 text-white hover:bg-emerald-800`}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  Save for Nora
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Meetings</h2>
              <div className="mt-3 grid gap-2">
                {loadingData ? (
                  <div className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-3 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading meetings...
                  </div>
                ) : meetings.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500">
                    No meetings saved yet.
                  </div>
                ) : (
                  meetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => setSelectedMeetingId(meeting.id)}
                      className={`rounded-md border p-3 text-left transition ${
                        selectedMeetingId === meeting.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-zinc-950">{meeting.title}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {formatPlatform(meeting.platform)} · {formatMeetingTime(meeting.startsAt)}
                          </div>
                        </div>
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600">
                          {STATUS_LABELS[meeting.status]}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>

          <section className="space-y-5">
            {renderMessage(appMessage)}

            {selectedMeeting ? (
              <>
                <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Video className="h-4 w-4" />
                          {formatPlatform(selectedMeeting.platform)}
                        </span>
                        <span>{formatMeetingTime(selectedMeeting.startsAt)}</span>
                        <span>{STATUS_LABELS[selectedMeeting.status]}</span>
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold tracking-normal">{selectedMeeting.title}</h2>
                      {selectedMeeting.meetingUrl ? (
                        <a
                          href={selectedMeeting.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex max-w-full text-sm font-semibold text-emerald-700 underline decoration-emerald-200 underline-offset-4"
                        >
                          Open meeting link
                        </a>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={queueSelectedMeeting}
                        disabled={saving}
                        className={`${actionButtonClassName} bg-zinc-950 text-white hover:bg-zinc-800`}
                      >
                        <Bot className="h-4 w-4" />
                        Queue Nora
                      </button>
                      <button
                        type="button"
                        onClick={syncSelectedMeeting}
                        disabled={saving || !selectedMeeting.workerJobId}
                        className={`${actionButtonClassName} border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50`}
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Sync notes
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedMeeting}
                        disabled={saving}
                        className={`${actionButtonClassName} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md bg-zinc-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Worker</div>
                      <div className="mt-2 text-sm text-zinc-700">
                        {selectedMeeting.workerJobId
                          ? selectedMeeting.workerStatus || 'Queued'
                          : 'Not queued'}
                      </div>
                      {selectedMeeting.workerError ? (
                        <div className="mt-1 text-xs text-rose-700">{selectedMeeting.workerError}</div>
                      ) : null}
                    </div>
                    <div className="rounded-md bg-zinc-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Attendees</div>
                      <div className="mt-2 text-sm text-zinc-700">
                        {selectedMeeting.attendees.length ? selectedMeeting.attendees.join(', ') : 'None added'}
                      </div>
                    </div>
                    <div className="rounded-md bg-zinc-50 p-3 md:col-span-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Agenda</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
                        {selectedMeeting.agenda || 'No agenda added'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                  <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-lg font-semibold">Transcript and summary</h2>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={draftNotes}
                          disabled={saving}
                          className={`${actionButtonClassName} border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50`}
                        >
                          <Sparkles className="h-4 w-4" />
                          Draft notes
                        </button>
                        <button
                          type="button"
                          onClick={saveNotes}
                          disabled={saving}
                          className={`${actionButtonClassName} bg-emerald-700 text-white hover:bg-emerald-800`}
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                          Save notes
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4">
                      <textarea
                        value={noteDraft.rawTranscript}
                        onChange={(event) =>
                          setNoteDraft((currentDraft) => ({
                            ...currentDraft,
                            rawTranscript: event.target.value,
                          }))
                        }
                        rows={10}
                        placeholder="Transcript"
                        className={fieldClassName}
                      />
                      <textarea
                        value={noteDraft.summary}
                        onChange={(event) =>
                          setNoteDraft((currentDraft) => ({
                            ...currentDraft,
                            summary: event.target.value,
                          }))
                        }
                        rows={5}
                        placeholder="Summary"
                        className={fieldClassName}
                      />
                    </div>
                  </section>

                  <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold">Structured notes</h2>
                    <div className="mt-4 grid gap-4">
                      <textarea
                        value={noteDraft.decisionsText}
                        onChange={(event) =>
                          setNoteDraft((currentDraft) => ({
                            ...currentDraft,
                            decisionsText: event.target.value,
                          }))
                        }
                        rows={5}
                        placeholder="Decisions"
                        className={fieldClassName}
                      />
                      <textarea
                        value={noteDraft.actionItemsText}
                        onChange={(event) =>
                          setNoteDraft((currentDraft) => ({
                            ...currentDraft,
                            actionItemsText: event.target.value,
                          }))
                        }
                        rows={5}
                        placeholder="Action items"
                        className={fieldClassName}
                      />
                      <textarea
                        value={noteDraft.followUpsText}
                        onChange={(event) =>
                          setNoteDraft((currentDraft) => ({
                            ...currentDraft,
                            followUpsText: event.target.value,
                          }))
                        }
                        rows={5}
                        placeholder="Follow-ups"
                        className={fieldClassName}
                      />
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
                <Bot className="mx-auto h-10 w-10 text-emerald-700" />
                <h2 className="mt-3 text-xl font-semibold">No meeting selected</h2>
                <p className="mt-2 text-sm text-zinc-500">Add a meeting to start a NoraNotetaker record.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default NoraNotetakerPage;
