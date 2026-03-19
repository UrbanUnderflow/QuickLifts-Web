import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { format, parse } from 'date-fns';
import { Calendar, CheckCircle2, Copy, Link as LinkIcon, Mail, Plus, RefreshCw, Sparkles, Trash2, Users } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import GroupMeetAvailabilityPicker from '../../components/group-meet/GroupMeetAvailabilityPicker';
import { auth } from '../../api/firebase/config';
import {
  buildGroupMeetCandidateKey,
  formatMinutesAsTime,
  type GroupMeetAvailabilitySlot,
  type GroupMeetCandidateWindow,
  type GroupMeetContact,
  type GroupMeetInviteSummary,
  type GroupMeetRequestDetail,
  type GroupMeetRequestSummary,
} from '../../lib/groupMeet';

type ParticipantDraft = {
  contactId: string | null;
  name: string;
  email: string;
  imageUrl: string;
};

type HostDraft = {
  contactId: string | null;
  name: string;
  email: string;
  imageUrl: string;
};

type ApiRequestListResponse = {
  requests: GroupMeetRequestSummary[];
};

type ApiCreateResponse = {
  request: GroupMeetRequestSummary;
};

type ApiRequestDetailResponse = {
  request: GroupMeetRequestDetail;
};

type ApiUpdateResponse = {
  request: GroupMeetRequestDetail;
  resetDerivedSelections?: boolean;
};

type ApiInviteResponse = {
  invite?: GroupMeetInviteSummary;
};

type ApiContactsResponse = {
  contacts: GroupMeetContact[];
};

type ApiContactSaveResponse = {
  contact: GroupMeetContact;
};

type ApiSimpleSuccessResponse = {
  success?: boolean;
};

const buildDefaultDeadlineValue = () => {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  date.setHours(17, 0, 0, 0);
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

const buildDefaultMonthValue = () => format(new Date(), 'yyyy-MM');

const buildEmptyParticipant = (): ParticipantDraft => ({
  contactId: null,
  name: '',
  email: '',
  imageUrl: '',
});

const buildEmptyHost = (): HostDraft => ({
  contactId: null,
  name: '',
  email: '',
  imageUrl: '',
});

const toDateTimeLocalInputValue = (value: string | null) => {
  if (!value) return '';
  try {
    return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
  } catch (_error) {
    return '';
  }
};

const toReadableDateTime = (value: string | null, timezone: string) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    });
  } catch (_error) {
    return value;
  }
};

const formatMonthDate = (value: string) => {
  try {
    return format(parse(value, 'yyyy-MM-dd', new Date()), 'EEE, MMM d');
  } catch (_error) {
    return value;
  }
};

const buildAvatarUrl = (name: string, imageUrl?: string | null) =>
  imageUrl?.trim() ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Pulse')}&background=111827&color=ffffff&size=96`;

const AvatarBubble: React.FC<{ name: string; imageUrl?: string | null; size?: string }> = ({
  name,
  imageUrl,
  size = 'h-10 w-10',
}) => (
  <img
    src={buildAvatarUrl(name, imageUrl)}
    alt={name}
    className={`${size} rounded-2xl object-cover border border-white/10 bg-zinc-900`}
  />
);

const formatCandidateLabel = (candidate: GroupMeetCandidateWindow) => {
  const start = formatMinutesAsTime(candidate.suggestedStartMinutes);
  const end = formatMinutesAsTime(candidate.suggestedEndMinutes);
  return `${formatMonthDate(candidate.date)} • ${start} - ${end}`;
};

const GroupMeetAdminPage: React.FC = () => {
  const [title, setTitle] = useState('Group Meet');
  const [targetMonth, setTargetMonth] = useState(buildDefaultMonthValue);
  const [deadlineAt, setDeadlineAt] = useState(buildDefaultDeadlineValue);
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState(30);
  const [timezone, setTimezone] = useState('America/New_York');
  const [sendEmails, setSendEmails] = useState(true);
  const [host, setHost] = useState<HostDraft>(buildEmptyHost);
  const [hostAvailabilityEntries, setHostAvailabilityEntries] = useState<GroupMeetAvailabilitySlot[]>([]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    buildEmptyParticipant(),
    buildEmptyParticipant(),
    buildEmptyParticipant(),
  ]);
  const [contacts, setContacts] = useState<GroupMeetContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactImageUrl, setContactImageUrl] = useState('');
  const [testEmailName, setTestEmailName] = useState('');
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [requests, setRequests] = useState<GroupMeetRequestSummary[]>([]);
  const [createdRequest, setCreatedRequest] = useState<GroupMeetRequestSummary | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<GroupMeetRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [resendingInviteToken, setResendingInviteToken] = useState<string | null>(null);
  const [hostNoteDraft, setHostNoteDraft] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDeadlineAt, setEditDeadlineAt] = useState('');
  const [editTimezone, setEditTimezone] = useState('America/New_York');
  const [editMeetingDurationMinutes, setEditMeetingDurationMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const populatedParticipants = useMemo(
    () => participants.filter((participant) => participant.name.trim()),
    [participants]
  );

  const getAdminHeaders = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in as an admin.');
    }

    const idToken = await currentUser.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    };
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const headers = await getAdminHeaders();
      const response = await fetch('/api/admin/group-meet', { headers });
      const payload = (await response.json().catch(() => ({}))) as Partial<ApiRequestListResponse> & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load Group Meet requests.');
      }
      const nextRequests = Array.isArray(payload.requests) ? payload.requests : [];
      setRequests(nextRequests);
      setSelectedRequestId((current) => current || nextRequests[0]?.id || null);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to load Group Meet requests.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setHost((current) => ({
      contactId: current.contactId || null,
      name: current.name || currentUser.displayName || 'Host',
      email: current.email || currentUser.email || '',
      imageUrl: current.imageUrl || currentUser.photoURL || '',
    }));
    setTestEmailName((current) => current || currentUser.displayName || 'Test Recipient');
    setTestEmailRecipient((current) => current || currentUser.email || '');
  }, []);

  const loadContacts = async () => {
    setContactsLoading(true);
    try {
      const headers = await getAdminHeaders();
      const response = await fetch('/api/admin/group-meet/contacts', { headers });
      const payload = (await response.json().catch(() => ({}))) as Partial<ApiContactsResponse> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load contacts.');
      }
      setContacts(Array.isArray(payload.contacts) ? payload.contacts : []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to load contacts.' });
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const loadRequestDetail = async (requestId: string) => {
    setDetailLoading(true);
    try {
      const headers = await getAdminHeaders();
      const response = await fetch(`/api/admin/group-meet/${encodeURIComponent(requestId)}`, { headers });
      const payload = (await response.json().catch(() => ({}))) as Partial<ApiRequestDetailResponse> & { error?: string };
      if (!response.ok || !payload.request) {
        throw new Error(payload.error || 'Failed to load Group Meet results.');
      }
      setSelectedRequest(payload.request);
      setHostNoteDraft(payload.request.finalSelection?.hostNote || '');
      setEditTitle(payload.request.title || 'Group Meet');
      setEditDeadlineAt(toDateTimeLocalInputValue(payload.request.deadlineAt));
      setEditTimezone(payload.request.timezone || 'America/New_York');
      setEditMeetingDurationMinutes(payload.request.meetingDurationMinutes || 30);
    } catch (error: any) {
      setSelectedRequest(null);
      setMessage({ type: 'error', text: error?.message || 'Failed to load Group Meet results.' });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedRequestId) return;
    loadRequestDetail(selectedRequestId);
  }, [selectedRequestId]);

  const updateParticipant = (index: number, field: keyof ParticipantDraft, value: string) => {
    setParticipants((current) =>
      current.map((participant, participantIndex) =>
        participantIndex === index ? { ...participant, [field]: value } : participant
      )
    );
  };

  const updateHost = (field: keyof HostDraft, value: string | null) => {
    setHost((current) => ({ ...current, [field]: value ?? '' }));
  };

  const addContactToParticipants = (contact: GroupMeetContact) => {
    const comparisonKey =
      (contact.email || '').toLowerCase() || contact.id || contact.name.toLowerCase();
    const hostKey =
      host.email.trim().toLowerCase() || host.contactId || host.name.trim().toLowerCase();

    if (comparisonKey && comparisonKey === hostKey) {
      setMessage({ type: 'error', text: `${contact.name} is already set as the host.` });
      return;
    }

    setParticipants((current) => {
      const hasMatch = current.some((participant) => {
        const participantKey =
          participant.email.trim().toLowerCase() ||
          participant.contactId ||
          participant.name.trim().toLowerCase();
        return participantKey && participantKey === comparisonKey;
      });

      if (hasMatch) {
        return current;
      }

      return [
        ...current.filter((participant) => participant.name.trim() || participant.email.trim()),
        {
          contactId: contact.id,
          name: contact.name,
          email: contact.email || '',
          imageUrl: contact.imageUrl || '',
        },
      ];
    });
  };

  const useContactAsHost = (contact: GroupMeetContact) => {
    setHost({
      contactId: contact.id,
      name: contact.name,
      email: contact.email || '',
      imageUrl: contact.imageUrl || '',
    });
    setParticipants((current) =>
      current.filter((participant) => {
        const participantKey =
          participant.email.trim().toLowerCase() ||
          participant.contactId ||
          participant.name.trim().toLowerCase();
        const contactKey =
          (contact.email || '').toLowerCase() || contact.id || contact.name.toLowerCase();
        return !participantKey || participantKey !== contactKey;
      })
    );
  };

  const removeParticipant = (index: number) => {
    setParticipants((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  const addParticipant = () => {
    setParticipants((current) => [...current, buildEmptyParticipant()]);
  };

  const copyText = async (text: string, successText = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: 'success', text: successText });
    } catch (_error) {
      setMessage({ type: 'error', text: 'Copy failed.' });
    }
  };

  const createRequest = async () => {
    if (!host.name.trim()) {
      setMessage({ type: 'error', text: 'Add the host name before creating the request.' });
      return;
    }

    if (!hostAvailabilityEntries.length) {
      setMessage({ type: 'error', text: 'Add the host availability before sending the request.' });
      return;
    }

    if (!populatedParticipants.length) {
      setMessage({ type: 'error', text: 'Add at least one participant name.' });
      return;
    }

    setCreating(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch('/api/admin/group-meet', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          targetMonth,
          deadlineAt: new Date(deadlineAt).toISOString(),
          timezone,
          meetingDurationMinutes,
          sendEmails,
          host: {
            contactId: host.contactId,
            name: host.name,
            email: host.email,
            imageUrl: host.imageUrl,
            availabilityEntries: hostAvailabilityEntries,
          },
          participants,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<ApiCreateResponse> & { error?: string };
      if (!response.ok || !payload.request) {
        throw new Error(payload.error || 'Failed to create Group Meet request.');
      }

      setCreatedRequest(payload.request);
      setSelectedRequestId(payload.request.id);
      setMessage({ type: 'success', text: 'Group Meet request created.' });
      setParticipants([buildEmptyParticipant(), buildEmptyParticipant(), buildEmptyParticipant()]);
      setHostAvailabilityEntries([]);
      await loadRequests();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to create Group Meet request.' });
    } finally {
      setCreating(false);
    }
  };

  const saveContact = async (prefill?: HostDraft | ParticipantDraft) => {
    const name = (prefill?.name || contactName).trim();
    const email = (prefill?.email || contactEmail).trim();
    const imageUrl = (prefill?.imageUrl || contactImageUrl).trim();

    if (!name) {
      setMessage({ type: 'error', text: 'Contact name is required.' });
      return;
    }

    setSavingContact(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch('/api/admin/group-meet/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, email, imageUrl }),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<ApiContactSaveResponse> & {
        error?: string;
      };
      if (!response.ok || !payload.contact) {
        throw new Error(payload.error || 'Failed to save contact.');
      }

      await loadContacts();
      if (!prefill) {
        setContactName('');
        setContactEmail('');
        setContactImageUrl('');
      }
      setMessage({ type: 'success', text: `${name} saved to Group Meet contacts.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save contact.' });
    } finally {
      setSavingContact(false);
    }
  };

  const copyAllLinks = async (request: GroupMeetRequestSummary) => {
    const text = request.invites.map((invite) => `${invite.name}: ${invite.shareUrl}`).join('\n');
    await copyText(text, 'All participant links copied.');
  };

  const copyCandidateSummary = async (candidate: GroupMeetCandidateWindow) => {
    const text = [
      formatCandidateLabel(candidate),
      `Participants: ${candidate.participantNames.join(', ') || 'None'}`,
      candidate.missingParticipantNames.length
        ? `Missing: ${candidate.missingParticipantNames.join(', ')}`
        : 'Missing: none',
      candidate.flexibilityMinutes > 0
        ? `Start window: ${formatMinutesAsTime(candidate.earliestStartMinutes)} to ${formatMinutesAsTime(candidate.latestStartMinutes)}`
        : `Start window: ${formatMinutesAsTime(candidate.earliestStartMinutes)}`,
    ].join('\n');
    await copyText(text, 'Candidate summary copied.');
  };

  const generateAiRecommendation = async () => {
    if (!selectedRequestId) return;
    setRecommendLoading(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(`/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/recommend`, {
        method: 'POST',
        headers,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate AI recommendation.');
      }
      await loadRequestDetail(selectedRequestId);
      setMessage({ type: 'success', text: 'AI recommendation generated.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to generate AI recommendation.' });
    } finally {
      setRecommendLoading(false);
    }
  };

  const finalizeCandidate = async (candidateKey: string) => {
    if (!selectedRequestId) return;
    setFinalizeLoading(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(`/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/finalize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          candidateKey,
          hostNote: hostNoteDraft,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save final meeting block.');
      }
      await loadRequestDetail(selectedRequestId);
      setMessage({ type: 'success', text: 'Final meeting block saved.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save final meeting block.' });
    } finally {
      setFinalizeLoading(false);
    }
  };

  const scheduleCalendarInvite = async () => {
    if (!selectedRequestId) return;
    setScheduleLoading(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(`/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/schedule`, {
        method: 'POST',
        headers,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create Google Calendar invite.');
      }
      await loadRequestDetail(selectedRequestId);
      setMessage({ type: 'success', text: 'Google Calendar invite created.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to create Google Calendar invite.' });
    } finally {
      setScheduleLoading(false);
    }
  };

  const saveRequestEdits = async () => {
    if (!selectedRequestId) return;
    if (!editDeadlineAt) {
      setMessage({ type: 'error', text: 'Deadline is required.' });
      return;
    }

    setSavingEdits(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(`/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          title: editTitle,
          deadlineAt: editDeadlineAt ? new Date(editDeadlineAt).toISOString() : null,
          timezone: editTimezone,
          meetingDurationMinutes: editMeetingDurationMinutes,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<ApiUpdateResponse> & { error?: string };
      if (!response.ok || !payload.request) {
        throw new Error(payload.error || 'Failed to save request changes.');
      }

      setSelectedRequest(payload.request);
      setHostNoteDraft(payload.request.finalSelection?.hostNote || '');
      await loadRequests();
      setMessage({
        type: 'success',
        text: payload.resetDerivedSelections
          ? 'Request updated. Final selection and calendar invite were cleared because the timing rules changed.'
          : 'Request updated.',
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save request changes.' });
    } finally {
      setSavingEdits(false);
    }
  };

  const resendInvite = async (invite: GroupMeetInviteSummary) => {
    if (!selectedRequestId) return;

    setResendingInviteToken(invite.token);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/invites/${encodeURIComponent(invite.token)}/resend`,
        {
          method: 'POST',
          headers,
        }
      );

      const payload = (await response.json().catch(() => ({}))) as Partial<ApiInviteResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || `Failed to resend ${invite.name}'s invite.`);
      }

      await Promise.all([loadRequestDetail(selectedRequestId), loadRequests()]);
      setMessage({ type: 'success', text: `Invite resent to ${invite.name}.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || `Failed to resend ${invite.name}'s invite.` });
    } finally {
      setResendingInviteToken(null);
    }
  };

  const sendStandaloneTestEmail = async () => {
    if (!testEmailRecipient.trim()) {
      setMessage({ type: 'error', text: 'Add a recipient email for the test send.' });
      return;
    }

    setTestEmailSending(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch('/api/admin/group-meet/test-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipientName: testEmailName || 'Test Recipient',
          recipientEmail: testEmailRecipient,
          requestTitle: title,
          targetMonth,
          deadlineAt: new Date(deadlineAt).toISOString(),
          timezone,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiSimpleSuccessResponse & {
        error?: string;
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to send Group Meet test email.');
      }
      setMessage({ type: 'success', text: `Test Group Meet email sent to ${testEmailRecipient}.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to send Group Meet test email.' });
    } finally {
      setTestEmailSending(false);
    }
  };

  const resolveSelectedInvitesForCandidate = (candidate: GroupMeetCandidateWindow) =>
    (selectedRequest?.invites || []).filter((invite) => candidate.participantTokens.includes(invite.token));

  const resolveSelectedInvitesForDate = (date: string) =>
    (selectedRequest?.invites || []).filter((invite) =>
      invite.availabilityEntries.some((slot) => slot.date === date)
    );

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-black text-white">
        <Head>
          <title>Group Meet | Admin</title>
        </Head>

        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Group Meet</h1>
              <p className="text-zinc-400 text-sm mt-2 max-w-3xl">
                Create a tracked availability request, generate one link per person, and collect responses for a target month.
              </p>
            </div>
            <button
              type="button"
              onClick={loadRequests}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {message && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-red-500/30 bg-red-500/10 text-red-100'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-8">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-[#E0FE10]/10 text-[#E0FE10] flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Create request</h2>
                  <p className="text-zinc-400 text-sm">The host adds their own availability first, then sends tracked links to everyone else.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm text-zinc-300 mb-2">Meeting title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    placeholder="Board sync"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-zinc-300 mb-2">Target month</span>
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={(event) => setTargetMonth(event.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-zinc-300 mb-2">Deadline</span>
                  <input
                    type="datetime-local"
                    value={deadlineAt}
                    onChange={(event) => setDeadlineAt(event.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-zinc-300 mb-2">Meeting length</span>
                  <select
                    value={meetingDurationMinutes}
                    onChange={(event) => setMeetingDurationMinutes(Number(event.target.value))}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                  </select>
                </label>
              </div>

              <label className="block mt-4">
                <span className="block text-sm text-zinc-300 mb-2">Timezone</span>
                <input
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                  placeholder="America/New_York"
                />
              </label>

              <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-black/60 px-4 py-4">
                <div>
                  <div className="font-medium">Email invites now</div>
                  <div className="text-sm text-zinc-400">If an email is present, Group Meet will send the participant their personal link right away.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSendEmails((current) => !current)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    sendEmails ? 'bg-[#E0FE10] text-black' : 'bg-zinc-900 text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {sendEmails ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="mt-8 rounded-3xl border border-zinc-800 bg-black/50 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Host profile</h3>
                    <p className="text-sm text-zinc-400">The host is treated like a real participant, so their availability shapes the meeting options from the start.</p>
                  </div>
                  <AvatarBubble name={host.name || 'Host'} imageUrl={host.imageUrl} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={host.name}
                    onChange={(event) => updateHost('name', event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    placeholder="Host name"
                  />
                  <input
                    value={host.email}
                    onChange={(event) => updateHost('email', event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    placeholder="Host email"
                  />
                  <input
                    value={host.imageUrl}
                    onChange={(event) => updateHost('imageUrl', event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    placeholder="Host image URL"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => saveContact(host)}
                    disabled={savingContact}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {savingContact ? 'Saving…' : 'Save host as contact'}
                  </button>
                  {host.contactId && (
                    <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                      Using saved contact
                    </span>
                  )}
                </div>

                <GroupMeetAvailabilityPicker
                  className="mt-5"
                  targetMonth={targetMonth}
                  availabilityEntries={hostAvailabilityEntries}
                  onChange={setHostAvailabilityEntries}
                  title="Host availability"
                  subtitle="Set the days and time ranges you can actually do before the request goes out."
                />
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Participants</h3>
                    <p className="text-sm text-zinc-400">Pick from saved contacts or add a custom person. Email is optional. Images will show up in the overlap view.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addParticipant}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
                  >
                    <Plus className="w-4 h-4" />
                    Add person
                  </button>
                </div>

                <div className="space-y-3">
                  {participants.map((participant, index) => (
                    <div key={`participant-${index}`} className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 rounded-2xl border border-zinc-800 bg-black/60 p-3">
                      <div className="flex items-center justify-center">
                        <AvatarBubble name={participant.name || 'Guest'} imageUrl={participant.imageUrl} />
                      </div>
                      <input
                        value={participant.name}
                        onChange={(event) => updateParticipant(index, 'name', event.target.value)}
                        className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                        placeholder="Name"
                      />
                      <input
                        value={participant.email}
                        onChange={(event) => updateParticipant(index, 'email', event.target.value)}
                        className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                        placeholder="Email (optional)"
                      />
                      <input
                        value={participant.imageUrl}
                        onChange={(event) => updateParticipant(index, 'imageUrl', event.target.value)}
                        className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                        placeholder="Image URL (optional)"
                      />
                      <button
                        type="button"
                        onClick={() => removeParticipant(index)}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-zinc-300 hover:bg-zinc-900"
                        aria-label={`Remove participant ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-zinc-800 pt-6">
                <div className="text-sm text-zinc-400">
                  Host availability locked in • {populatedParticipants.length} guest{populatedParticipants.length === 1 ? '' : 's'} ready
                </div>
                <button
                  type="button"
                  onClick={createRequest}
                  disabled={creating}
                  className="rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create Group Meet request'}
                </button>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-2xl bg-white/5 text-white flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Contact library</h2>
                    <p className="text-sm text-zinc-400">Save the people you schedule with often, then tap them into the next request.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3">
                  <input
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    placeholder="Contact name"
                  />
                  <input
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    placeholder="Email"
                  />
                  <input
                    value={contactImageUrl}
                    onChange={(event) => setContactImageUrl(event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    placeholder="Image URL"
                  />
                  <button
                    type="button"
                    onClick={() => saveContact()}
                    disabled={savingContact}
                    className="rounded-xl bg-[#E0FE10] px-4 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                  >
                    {savingContact ? 'Saving…' : 'Save contact'}
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-black/40 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <AvatarBubble name={contact.name} imageUrl={contact.imageUrl} />
                        <div>
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-sm text-zinc-400">{contact.email || 'No email on file'}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => useContactAsHost(contact)}
                          className="rounded-lg border border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-900"
                        >
                          Use as host
                        </button>
                        <button
                          type="button"
                          onClick={() => addContactToParticipants(contact)}
                          className="rounded-lg border border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-900"
                        >
                          Add to guests
                        </button>
                      </div>
                    </div>
                  ))}

                  {!contacts.length && !contactsLoading && (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                      No saved contacts yet.
                    </div>
                  )}
                </div>
              </div>

              {createdRequest && (
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-xl font-semibold">Latest request</h2>
                      <p className="text-sm text-emerald-100/80">
                        {createdRequest.title} for {createdRequest.targetMonth}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyAllLinks(createdRequest)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                    >
                      <Copy className="w-4 h-4" />
                      Copy all links
                    </button>
                  </div>

                  <div className="space-y-3">
                    {createdRequest.invites.map((invite) => (
                      <div key={invite.token} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <AvatarBubble name={invite.name} imageUrl={invite.imageUrl} />
                            <div>
                            <div className="font-medium">
                              {invite.name}
                              {invite.participantType === 'host' && (
                                <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-300">
                                  Host
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-zinc-300">{invite.email || 'Manual link only'}</div>
                            <div className="text-xs text-zinc-400 mt-2">
                              {invite.emailStatus === 'sent'
                                ? 'Invite emailed'
                                : invite.emailStatus === 'failed'
                                  ? `Email failed: ${invite.emailError || 'Unknown error'}`
                                  : invite.emailStatus === 'manual_only'
                                    ? 'Email sending disabled for this batch'
                                    : invite.emailStatus === 'no_email'
                                      ? 'No email stored'
                                      : 'Awaiting send'}
                            </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyText(invite.shareUrl, `Copied ${invite.name}'s link`)}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10"
                          >
                            <LinkIcon className="w-4 h-4" />
                            Copy link
                          </button>
                        </div>
                        {invite.email && (
                          <button
                            type="button"
                            onClick={() => resendInvite(invite)}
                            disabled={resendingInviteToken === invite.token}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
                          >
                            <Mail className="w-4 h-4" />
                            {resendingInviteToken === invite.token ? 'Sending…' : 'Resend invite'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-300 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Recent requests</h2>
                    <p className="text-sm text-zinc-400">Quick visibility into deadlines, response counts, and link status.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {requests.map((request) => (
                    <div key={request.id} className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-semibold text-white">{request.title}</div>
                          <div className="text-sm text-zinc-400 mt-1">
                            Month {request.targetMonth} • Deadline {toReadableDateTime(request.deadlineAt, request.timezone)}
                          </div>
                          <div className="flex flex-wrap gap-3 mt-3 text-xs text-zinc-400">
                            <span>{request.participantCount} participants</span>
                            <span>{request.responseCount} responded</span>
                            <span>{request.meetingDurationMinutes} min</span>
                            <span>{request.status}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequestId(request.id);
                            if (request.id !== selectedRequestId) {
                              setSelectedRequest(null);
                            }
                          }}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                            selectedRequestId === request.id
                              ? 'border-[#E0FE10]/40 bg-[#E0FE10]/10 text-[#E0FE10]'
                              : 'border-zinc-800 hover:bg-zinc-900'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          View overlap
                        </button>
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => copyAllLinks(request)}
                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900"
                        >
                          <Copy className="w-4 h-4" />
                          Copy links
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2">
                        {request.invites.map((invite) => (
                          <div key={invite.token} className="flex flex-col gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/80 px-3 py-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                              <AvatarBubble name={invite.name} imageUrl={invite.imageUrl} size="h-9 w-9" />
                              <div>
                              <div className="text-sm font-medium">
                                {invite.name}
                                {invite.participantType === 'host' ? ' • Host' : ''}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {invite.email || 'Manual link'} • {invite.respondedAt ? 'Responded' : 'Waiting'} • {invite.emailStatus}
                              </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {invite.email && <Mail className="w-4 h-4 text-zinc-500" />}
                              {invite.email && (
                                <button
                                  type="button"
                                  onClick={() => resendInvite(invite)}
                                  disabled={resendingInviteToken === invite.token}
                                  className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900 disabled:opacity-50"
                                >
                                  {resendingInviteToken === invite.token ? 'Sending…' : 'Resend'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => copyText(invite.shareUrl, `Copied ${invite.name}'s link`)}
                                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900"
                              >
                                Copy link
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {!requests.length && !loading && (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
                      No Group Meet requests yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Overlap results</h2>
                    <p className="text-sm text-zinc-400">Deterministic candidate windows based on the meeting length and everyone’s submitted ranges.</p>
                  </div>
                </div>

                {detailLoading && (
                  <div className="rounded-2xl border border-zinc-800 px-4 py-10 text-center text-sm text-zinc-400">
                    Loading overlap results…
                  </div>
                )}

                {!detailLoading && !selectedRequest && (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
                    Select a request to inspect the best meeting times.
                  </div>
                )}

                {!detailLoading && selectedRequest && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                          <div className="text-lg font-semibold">{selectedRequest.title}</div>
                          <div className="text-sm text-zinc-400 mt-1">
                            {selectedRequest.targetMonth} • {selectedRequest.meetingDurationMinutes} min • Deadline {toReadableDateTime(selectedRequest.deadlineAt, selectedRequest.timezone)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5">
                            {selectedRequest.analysis.respondedParticipantCount}/{selectedRequest.analysis.totalParticipants} responded
                          </span>
                          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5">
                            {selectedRequest.analysis.fullMatchCandidates.length} full-match windows
                          </span>
                          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5">
                            {selectedRequest.analysis.bestCandidates.length} ranked candidates
                          </span>
                        </div>
                      </div>

                      {selectedRequest.analysis.pendingParticipantNames.length > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                          Waiting on: {selectedRequest.analysis.pendingParticipantNames.join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">Request settings</h3>
                            <p className="text-sm text-zinc-400 mt-1">
                              Update the live request without rebuilding the links. If you change the meeting length or timezone, Group Meet clears the final choice and calendar invite so you can recompute cleanly.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={saveRequestEdits}
                            disabled={savingEdits}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {savingEdits ? 'Saving…' : 'Save request changes'}
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="block">
                            <span className="block text-sm text-zinc-300 mb-2">Meeting title</span>
                            <input
                              value={editTitle}
                              onChange={(event) => setEditTitle(event.target.value)}
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                            />
                          </label>

                          <label className="block">
                            <span className="block text-sm text-zinc-300 mb-2">Deadline</span>
                            <input
                              type="datetime-local"
                              value={editDeadlineAt}
                              onChange={(event) => setEditDeadlineAt(event.target.value)}
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                            />
                          </label>

                          <label className="block">
                            <span className="block text-sm text-zinc-300 mb-2">Timezone</span>
                            <input
                              value={editTimezone}
                              onChange={(event) => setEditTimezone(event.target.value)}
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                              placeholder="America/New_York"
                            />
                          </label>

                          <label className="block">
                            <span className="block text-sm text-zinc-300 mb-2">Meeting length</span>
                            <select
                              value={editMeetingDurationMinutes}
                              onChange={(event) => setEditMeetingDurationMinutes(Number(event.target.value))}
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                            >
                              <option value={15}>15 minutes</option>
                              <option value={30}>30 minutes</option>
                              <option value={45}>45 minutes</option>
                              <option value={60}>60 minutes</option>
                              <option value={90}>90 minutes</option>
                            </select>
                          </label>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">AI recommendation</h3>
                            <p className="text-sm text-zinc-400 mt-1">
                              The AI summarizes the current overlap picture and suggests a few host-ready options. The host still chooses the final block.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={generateAiRecommendation}
                            disabled={recommendLoading || detailLoading || !selectedRequest.analysis.bestCandidates.length}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                          >
                            <Sparkles className={`w-4 h-4 ${recommendLoading ? 'animate-pulse' : ''}`} />
                            {recommendLoading ? 'Generating…' : 'Generate AI recommendation'}
                          </button>
                        </div>

                        {selectedRequest.aiRecommendation ? (
                          <div className="mt-4 space-y-4">
                            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-4">
                              <div className="text-sm text-zinc-200">{selectedRequest.aiRecommendation.summary}</div>
                              <div className="mt-2 text-xs text-zinc-500">
                                {selectedRequest.aiRecommendation.generatedAt
                                  ? `Generated ${toReadableDateTime(selectedRequest.aiRecommendation.generatedAt, selectedRequest.timezone)}`
                                  : 'Generated just now'}
                                {selectedRequest.aiRecommendation.model ? ` • ${selectedRequest.aiRecommendation.model}` : ''}
                              </div>
                            </div>

                            {selectedRequest.aiRecommendation.caveats.length > 0 && (
                              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
                                <div className="text-sm font-medium text-amber-100 mb-2">Caveats</div>
                                <div className="space-y-1 text-sm text-amber-50/90">
                                  {selectedRequest.aiRecommendation.caveats.map((caveat, index) => (
                                    <div key={`caveat-${index}`}>• {caveat}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-3">
                              {selectedRequest.aiRecommendation.recommendations.map((recommendation) => (
                                <div key={recommendation.candidateKey} className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <div className="font-medium">
                                        AI Pick #{recommendation.rank} • {formatMonthDate(recommendation.date)} • {formatMinutesAsTime(recommendation.startMinutes)} - {formatMinutesAsTime(recommendation.endMinutes)}
                                      </div>
                                      <div className="text-sm text-zinc-400 mt-1">
                                        {recommendation.participantCount}/{recommendation.totalParticipants} available
                                        {recommendation.allAvailable ? ' • works for everyone' : ''}
                                      </div>
                                      <div className="text-sm text-zinc-200 mt-3">{recommendation.reason}</div>
                                      <div className="text-xs text-zinc-500 mt-2">
                                        Available: {recommendation.participantNames.join(', ') || 'None'}
                                      </div>
                                      <div className="text-xs text-zinc-500 mt-1">
                                        {recommendation.missingParticipantNames.length
                                          ? `Missing: ${recommendation.missingParticipantNames.join(', ')}`
                                          : 'Missing: none'}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => finalizeCandidate(recommendation.candidateKey)}
                                      disabled={finalizeLoading}
                                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-900 disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      Choose this block
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                            No AI recommendation yet.
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">Host final decision</h3>
                            <p className="text-sm text-zinc-400 mt-1">Save the final block the host wants to move forward with. This is the handoff point before calendar invite automation.</p>
                          </div>
                        </div>

                        <label className="block mt-4">
                          <span className="block text-sm text-zinc-300 mb-2">Host note</span>
                          <textarea
                            value={hostNoteDraft}
                            onChange={(event) => setHostNoteDraft(event.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                            placeholder="Optional note about why this block was chosen"
                          />
                        </label>

                        {selectedRequest.finalSelection ? (
                          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <div className="font-medium text-emerald-100">
                              Final block: {formatMonthDate(selectedRequest.finalSelection.date)} • {formatMinutesAsTime(selectedRequest.finalSelection.startMinutes)} - {formatMinutesAsTime(selectedRequest.finalSelection.endMinutes)}
                            </div>
                            <div className="text-sm text-emerald-50/90 mt-2">
                              Selected by {selectedRequest.finalSelection.selectedByEmail || 'host'} on {toReadableDateTime(selectedRequest.finalSelection.selectedAt, selectedRequest.timezone)}
                            </div>
                            <div className="text-xs text-emerald-50/80 mt-2">
                              Available: {selectedRequest.finalSelection.participantNames.join(', ') || 'None'}
                            </div>
                            <div className="text-xs text-emerald-50/80 mt-1">
                              {selectedRequest.finalSelection.missingParticipantNames.length
                                ? `Missing: ${selectedRequest.finalSelection.missingParticipantNames.join(', ')}`
                                : 'Missing: none'}
                            </div>
                            {selectedRequest.finalSelection.hostNote && (
                              <div className="mt-3 text-sm text-emerald-50/95">
                                Note: {selectedRequest.finalSelection.hostNote}
                              </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={scheduleCalendarInvite}
                                disabled={scheduleLoading || !selectedRequest.calendarSetup.ready}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                              >
                                <Calendar className="w-4 h-4" />
                                {scheduleLoading
                                  ? 'Creating invite…'
                                  : selectedRequest.calendarInvite
                                    ? 'Update Google Calendar invite'
                                    : 'Create Google Calendar invite'}
                              </button>
                              {selectedRequest.calendarInvite?.htmlLink && (
                                <a
                                  href={selectedRequest.calendarInvite.htmlLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-900"
                                >
                                  <LinkIcon className="w-4 h-4" />
                                  Open event
                                </a>
                              )}
                              {selectedRequest.calendarInvite?.meetLink && (
                                <a
                                  href={selectedRequest.calendarInvite.meetLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-900"
                                >
                                  <Mail className="w-4 h-4" />
                                  Open Meet link
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                            No final block selected yet.
                          </div>
                        )}

                        <div
                          className={`mt-4 rounded-2xl border px-4 py-4 ${
                            selectedRequest.calendarSetup.ready
                              ? 'border-emerald-500/20 bg-emerald-500/10'
                              : 'border-amber-500/20 bg-amber-500/10'
                          }`}
                        >
                          <div
                            className={`font-medium ${
                              selectedRequest.calendarSetup.ready ? 'text-emerald-100' : 'text-amber-100'
                            }`}
                          >
                            Calendar setup: {selectedRequest.calendarSetup.ready ? 'ready' : 'needs attention'}
                          </div>
                          <div
                            className={`mt-2 text-sm ${
                              selectedRequest.calendarSetup.ready ? 'text-emerald-50/90' : 'text-amber-50/90'
                            }`}
                          >
                            {selectedRequest.calendarSetup.message}
                          </div>
                          <div
                            className={`mt-2 text-xs ${
                              selectedRequest.calendarSetup.ready ? 'text-emerald-50/80' : 'text-amber-50/80'
                            }`}
                          >
                            Source: {selectedRequest.calendarSetup.source} • Calendar: {selectedRequest.calendarSetup.calendarId || 'primary'} • Delegated user: {selectedRequest.calendarSetup.delegatedUserEmail || 'missing'}
                          </div>
                          {selectedRequest.calendarSetup.secretName && (
                            <div
                              className={`mt-1 text-xs ${
                                selectedRequest.calendarSetup.ready ? 'text-emerald-50/80' : 'text-amber-50/80'
                              }`}
                            >
                              Secret Manager secret: {selectedRequest.calendarSetup.secretName}
                            </div>
                          )}
                        </div>

                        {selectedRequest.calendarInvite && (
                          <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                            <div className="font-medium text-blue-100">
                              Calendar invite {selectedRequest.calendarInvite.status}
                            </div>
                            <div className="text-sm text-blue-50/90 mt-2">
                              Organizer: {selectedRequest.calendarInvite.organizerEmail || 'Configured calendar account'}
                            </div>
                            <div className="text-sm text-blue-50/90 mt-1">
                              Updated: {toReadableDateTime(selectedRequest.calendarInvite.updatedAt, selectedRequest.timezone)}
                            </div>
                            <div className="text-xs text-blue-50/80 mt-2">
                              Attendees emailed: {selectedRequest.calendarInvite.attendeeEmails.join(', ') || 'None'}
                            </div>
                            {selectedRequest.calendarInvite.skippedParticipantNames.length > 0 && (
                              <div className="text-xs text-blue-50/80 mt-1">
                                No email on file: {selectedRequest.calendarInvite.skippedParticipantNames.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                        <h3 className="text-lg font-semibold mb-3">Best candidate windows</h3>
                        <div className="space-y-3">
                          {selectedRequest.analysis.bestCandidates.map((candidate, index) => (
                            <div key={`${candidate.date}-${candidate.earliestStartMinutes}-${index}`} className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <div className="font-medium">
                                    #{index + 1} • {formatCandidateLabel(candidate)}
                                  </div>
                                  <div className="text-sm text-zinc-400 mt-1">
                                    {candidate.participantCount}/{candidate.totalParticipants} participants available
                                    {candidate.flexibilityMinutes > 0
                                      ? ` • start anytime from ${formatMinutesAsTime(candidate.earliestStartMinutes)} to ${formatMinutesAsTime(candidate.latestStartMinutes)}`
                                      : ''}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyCandidateSummary(candidate)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900"
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </button>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {resolveSelectedInvitesForCandidate(candidate).map((invite) => (
                                  <div key={`${candidate.date}-${candidate.earliestStartMinutes}-${invite.token}`} className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs text-zinc-300">
                                    <AvatarBubble name={invite.name} imageUrl={invite.imageUrl} size="h-6 w-6" />
                                    <span>{invite.name}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-3 text-sm text-zinc-300">
                                Available: {candidate.participantNames.join(', ') || 'None'}
                              </div>
                              <div className="mt-1 text-sm text-zinc-500">
                                {candidate.missingParticipantNames.length
                                  ? `Missing: ${candidate.missingParticipantNames.join(', ')}`
                                  : 'Missing: none'}
                              </div>
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => finalizeCandidate(buildGroupMeetCandidateKey(candidate.date, candidate.suggestedStartMinutes))}
                                  disabled={finalizeLoading}
                                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900 disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Select final block
                                </button>
                              </div>
                            </div>
                          ))}

                          {!selectedRequest.analysis.bestCandidates.length && (
                            <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                              No candidate meeting windows yet. We either need more responses or the current ranges do not overlap for the selected duration.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                        <h3 className="text-lg font-semibold mb-3">Best dates by response coverage</h3>
                        <div className="space-y-2">
                          {selectedRequest.analysis.dateSummaries.map((day) => (
                            <div key={day.date} className="rounded-xl border border-zinc-800/70 bg-zinc-950/80 px-4 py-3">
                              <div className="font-medium">{formatMonthDate(day.date)}</div>
                              <div className="text-sm text-zinc-400 mt-1">
                                {day.availableParticipantCount}/{selectedRequest.analysis.totalParticipants} participants added availability
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {resolveSelectedInvitesForDate(day.date).map((invite) => (
                                  <div key={`${day.date}-${invite.token}`} className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs text-zinc-300">
                                    <AvatarBubble name={invite.name} imageUrl={invite.imageUrl} size="h-6 w-6" />
                                    <span>{invite.name}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="text-xs text-zinc-500 mt-2">
                                {day.participantNames.join(', ') || 'No one yet'}
                              </div>
                            </div>
                          ))}

                          {!selectedRequest.analysis.dateSummaries.length && (
                            <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                              No availability has been submitted yet.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                        <h3 className="text-lg font-semibold mb-3">Participant breakdown</h3>
                        <div className="space-y-2">
                          {selectedRequest.invites.map((invite) => (
                            <div key={invite.token} className="rounded-xl border border-zinc-800/70 bg-zinc-950/80 px-4 py-3">
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-3">
                                  <AvatarBubble name={invite.name} imageUrl={invite.imageUrl} />
                                  <div>
                                  <div className="font-medium">
                                    {invite.name}
                                    {invite.participantType === 'host' ? ' • Host' : ''}
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    {invite.email || 'Manual link'} • {invite.respondedAt ? 'Responded' : 'Waiting'} • {invite.availabilityCount} slots
                                  </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => copyText(invite.shareUrl, `Copied ${invite.name}'s link`)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900"
                                  >
                                    <LinkIcon className="w-4 h-4" />
                                    Copy link
                                  </button>
                                  {invite.email && invite.participantType !== 'host' && (
                                    <button
                                      type="button"
                                      onClick={() => resendInvite(invite)}
                                      disabled={resendingInviteToken === invite.token}
                                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900 disabled:opacity-50"
                                    >
                                      <Mail className="w-4 h-4" />
                                      {resendingInviteToken === invite.token ? 'Sending…' : 'Resend invite'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {invite.availabilityEntries.map((slot, slotIndex) => (
                                  <span key={`${invite.token}-${slot.date}-${slot.startMinutes}-${slotIndex}`} className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs text-zinc-300">
                                    {formatMonthDate(slot.date)} • {formatMinutesAsTime(slot.startMinutes)} - {formatMinutesAsTime(slot.endMinutes)}
                                  </span>
                                ))}
                                {!invite.availabilityEntries.length && (
                                  <span className="text-xs text-zinc-500">No availability submitted yet.</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default GroupMeetAdminPage;
