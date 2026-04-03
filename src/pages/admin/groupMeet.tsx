import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { format, parse } from 'date-fns';
import { Calendar, CheckCircle2, Copy, Link as LinkIcon, Mail, RefreshCw, Sparkles, Upload, Users } from 'lucide-react';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import GroupMeetAvailabilityPicker from '../../components/group-meet/GroupMeetAvailabilityPicker';
import { auth, storage } from '../../api/firebase/config';
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

type HostDraft = {
  contactId: string | null;
  name: string;
  email: string;
  imageUrl: string;
};

type ComposerTab = 'create' | 'contacts' | 'requests';

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

type ApiSendInvitesResponse = {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  status: GroupMeetRequestSummary['status'];
};

const buildDefaultDeadlineValue = () => {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  date.setHours(17, 0, 0, 0);
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

const buildDefaultMonthValue = () => format(new Date(), 'yyyy-MM');

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

const shouldUseDevFirebaseForAdminApi = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true') {
    return true;
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const forceDevFirebase = window.localStorage.getItem('forceDevFirebase') === 'true';
  const devMode = window.localStorage.getItem('devMode') === 'true';

  return forceDevFirebase || devMode || isLocalhost;
};

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
  const [activeTab, setActiveTab] = useState<ComposerTab>('create');
  const [title, setTitle] = useState('Group Meet');
  const [targetMonth, setTargetMonth] = useState(buildDefaultMonthValue);
  const [deadlineAt, setDeadlineAt] = useState(buildDefaultDeadlineValue);
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState(30);
  const [timezone, setTimezone] = useState('America/New_York');
  const [host, setHost] = useState<HostDraft>(buildEmptyHost);
  const [hostAvailabilityEntries, setHostAvailabilityEntries] = useState<GroupMeetAvailabilitySlot[]>([]);
  const [selectedParticipantContactIds, setSelectedParticipantContactIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<GroupMeetContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactImageFile, setContactImageFile] = useState<File | null>(null);
  const [contactImagePreviewUrl, setContactImagePreviewUrl] = useState('');
  const [adminAuthReady, setAdminAuthReady] = useState(Boolean(auth.currentUser));
  const [testEmailName, setTestEmailName] = useState('');
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [requests, setRequests] = useState<GroupMeetRequestSummary[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<GroupMeetRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [resendingInviteToken, setResendingInviteToken] = useState<string | null>(null);
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);
  const [hostNoteDraft, setHostNoteDraft] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDeadlineAt, setEditDeadlineAt] = useState('');
  const [editTimezone, setEditTimezone] = useState('America/New_York');
  const [editMeetingDurationMinutes, setEditMeetingDurationMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const contactImageInputRef = useRef<HTMLInputElement>(null);
  const activeAdminEmail = auth.currentUser?.email || host.email || null;

  const selectedParticipantContacts = useMemo(
    () =>
      selectedParticipantContactIds
        .map((contactId) => contacts.find((contact) => contact.id === contactId) || null)
        .filter((contact): contact is GroupMeetContact => Boolean(contact)),
    [contacts, selectedParticipantContactIds]
  );

  const availableGuestContacts = useMemo(
    () => contacts.filter((contact) => contact.id !== host.contactId),
    [contacts, host.contactId]
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
      'x-force-dev-firebase': shouldUseDevFirebaseForAdminApi() ? 'true' : 'false',
      'x-admin-email': currentUser.email || '',
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
    const unsubscribe = auth.onIdTokenChanged((currentUser) => {
      setAdminAuthReady(Boolean(currentUser));

      if (!currentUser) return;

      setHost((current) => ({
        contactId: current.contactId || null,
        name: current.name || currentUser.displayName || 'Host',
        email: current.email || currentUser.email || '',
        imageUrl: current.imageUrl || currentUser.photoURL || '',
      }));
      setTestEmailName((current) => current || currentUser.displayName || 'Test Recipient');
      setTestEmailRecipient((current) => current || currentUser.email || '');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      if (contactImagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(contactImagePreviewUrl);
      }
    };
  }, [contactImagePreviewUrl]);

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
    if (!adminAuthReady) return;
    loadRequests();
  }, [adminAuthReady]);

  useEffect(() => {
    if (!adminAuthReady) return;
    loadContacts();
  }, [adminAuthReady]);

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

  const useContactAsHost = (contact: GroupMeetContact) => {
    setHost({
      contactId: contact.id,
      name: contact.name,
      email: contact.email || '',
      imageUrl: contact.imageUrl || '',
    });
    setSelectedParticipantContactIds((current) => current.filter((contactId) => contactId !== contact.id));
  };

  useEffect(() => {
    if (!contacts.length) {
      setSelectedParticipantContactIds([]);
      setHost((current) => (current.contactId ? buildEmptyHost() : current));
      return;
    }

    setSelectedParticipantContactIds((current) =>
      current.filter((contactId) => contacts.some((contact) => contact.id === contactId && contact.id !== host.contactId))
    );

    const selectedHostContact = host.contactId
      ? contacts.find((contact) => contact.id === host.contactId) || null
      : null;

    if (selectedHostContact) {
      const nextHost = {
        contactId: selectedHostContact.id,
        name: selectedHostContact.name,
        email: selectedHostContact.email || '',
        imageUrl: selectedHostContact.imageUrl || '',
      };

      if (
        host.name !== nextHost.name ||
        host.email !== nextHost.email ||
        host.imageUrl !== nextHost.imageUrl
      ) {
        setHost(nextHost);
      }
      return;
    }

    const currentUserEmail = auth.currentUser?.email?.trim().toLowerCase() || '';
    if (!currentUserEmail) return;

    const matchingContact = contacts.find((contact) => (contact.email || '').toLowerCase() === currentUserEmail);
    if (matchingContact) {
      useContactAsHost(matchingContact);
    }
  }, [contacts, host.contactId, host.email, host.imageUrl, host.name]);

  const toggleParticipantContact = (contactId: string) => {
    setSelectedParticipantContactIds((current) =>
      current.includes(contactId)
        ? current.filter((currentContactId) => currentContactId !== contactId)
        : [...current, contactId]
    );
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
    if (!host.contactId) {
      setMessage({ type: 'error', text: 'Choose the host from your contact list before creating the request.' });
      return;
    }

    if (!hostAvailabilityEntries.length) {
      setMessage({ type: 'error', text: 'Add the host availability before sending the request.' });
      return;
    }

    if (!selectedParticipantContacts.length) {
      setMessage({ type: 'error', text: 'Choose at least one guest from your contact list.' });
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
          host: {
            contactId: host.contactId,
            availabilityEntries: hostAvailabilityEntries,
          },
          participants: selectedParticipantContacts.map((participant) => ({
            contactId: participant.id,
          })),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<ApiCreateResponse> & { error?: string };
      if (!response.ok || !payload.request) {
        throw new Error(payload.error || 'Failed to create Group Meet request.');
      }

      setSelectedRequestId(payload.request.id);
      setActiveTab('requests');
      setMessage({ type: 'success', text: 'Group Meet draft saved. Open Requests to send invitations when you are ready.' });
      setSelectedParticipantContactIds([]);
      setHostAvailabilityEntries([]);
      await loadRequests();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to create Group Meet request.' });
    } finally {
      setCreating(false);
    }
  };

  const sendDraftInvites = async (requestId: string) => {
    setSendingRequestId(requestId);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(`/api/admin/group-meet/${encodeURIComponent(requestId)}/send`, {
        method: 'POST',
        headers,
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<ApiSendInvitesResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send Group Meet invitations.');
      }

      await Promise.all([
        loadRequests(),
        selectedRequestId === requestId ? loadRequestDetail(requestId) : Promise.resolve(),
      ]);

      const sentCount = Number(payload.sentCount) || 0;
      const failedCount = Number(payload.failedCount) || 0;
      const skippedCount = Number(payload.skippedCount) || 0;
      const summary = [
        `${sentCount} sent`,
        failedCount ? `${failedCount} failed` : null,
        skippedCount ? `${skippedCount} skipped` : null,
      ]
        .filter(Boolean)
        .join(' • ');

      setMessage({
        type: failedCount ? 'error' : 'success',
        text: failedCount
          ? `Invite send finished with issues: ${summary}.`
          : `Invitations sent. ${summary}.`,
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to send Group Meet invitations.' });
    } finally {
      setSendingRequestId(null);
    }
  };

  const saveContact = async () => {
    const name = contactName.trim();
    const email = contactEmail.trim();

    if (!name) {
      setMessage({ type: 'error', text: 'Contact name is required.' });
      return;
    }

    if (contactImageFile && !contactImageFile.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Choose a valid image file.' });
      return;
    }

    setSavingContact(true);
    setMessage(null);

    try {
      let imageUrl = '';

      if (contactImageFile) {
        const currentUser = auth.currentUser;
        const ownerKey =
          currentUser?.uid ||
          currentUser?.email?.replace(/[^a-zA-Z0-9]/g, '-') ||
          'admin';
        const safeFileName = contactImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '');
        const filePath = `group-meet/contacts/${ownerKey}/${Date.now()}-${safeFileName}`;
        const imageRef = storageRef(storage, filePath);

        await uploadBytes(imageRef, contactImageFile, {
          contentType: contactImageFile.type || 'image/jpeg',
        });
        imageUrl = await getDownloadURL(imageRef);
      }

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
      setContactName('');
      setContactEmail('');
      if (contactImagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(contactImagePreviewUrl);
      }
      setContactImageFile(null);
      setContactImagePreviewUrl('');
      if (contactImageInputRef.current) {
        contactImageInputRef.current.value = '';
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

  const handleContactImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;

    if (!nextFile) {
      if (contactImagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(contactImagePreviewUrl);
      }
      setContactImageFile(null);
      setContactImagePreviewUrl('');
      return;
    }

    if (!nextFile.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Choose a valid image file.' });
      event.target.value = '';
      return;
    }

    if (contactImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(contactImagePreviewUrl);
    }

    setContactImageFile(nextFile);
    setContactImagePreviewUrl(URL.createObjectURL(nextFile));
  };

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

          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-4 text-sm text-zinc-300">
            Active admin identity: <span className="font-medium text-white">{activeAdminEmail || 'Unknown'}</span>
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'create'
                  ? 'bg-[#E0FE10] text-black'
                  : 'border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              Create request
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contacts')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'contacts'
                  ? 'bg-[#E0FE10] text-black'
                  : 'border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              Contact list
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'requests'
                  ? 'bg-[#E0FE10] text-black'
                  : 'border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              Requests
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-8">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
              {activeTab === 'create' ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl bg-[#E0FE10]/10 text-[#E0FE10] flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Create draft</h2>
                      <p className="text-zinc-400 text-sm">Set up the meeting, save it as a draft, and send invitations later from the Requests tab.</p>
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

                  <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-[#E0FE10]/15 bg-[#E0FE10]/5 px-4 py-4">
                    <div>
                      <div className="font-medium">Draft-first flow</div>
                      <div className="text-sm text-zinc-400">Saving here does not email anyone yet. Drafts move into Requests, where you can review the setup and send invitations when ready.</div>
                    </div>
                    <div className="rounded-full bg-[#E0FE10] px-4 py-2 text-sm font-semibold text-black">
                      Saves as draft
                    </div>
                  </div>

                  <div className="mt-8 rounded-3xl border border-zinc-800 bg-black/50 p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Host</h3>
                        <p className="text-sm text-zinc-400">Pick the organizer from your saved contacts, then lock in their availability before the request goes out.</p>
                      </div>
                      <AvatarBubble name={host.name || 'Host'} imageUrl={host.imageUrl} />
                    </div>

                    {contacts.length ? (
                      <>
                        <label className="block">
                          <span className="block text-sm text-zinc-300 mb-2">Host contact</span>
                          <select
                            value={host.contactId || ''}
                            onChange={(event) => {
                              const nextContact = contacts.find((contact) => contact.id === event.target.value) || null;
                              if (nextContact) {
                                useContactAsHost(nextContact);
                              } else {
                                setHost(buildEmptyHost());
                              }
                            }}
                            className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                          >
                            <option value="">Select a contact</option>
                            {contacts.map((contact) => (
                              <option key={contact.id} value={contact.id}>
                                {contact.name}{contact.email ? ` • ${contact.email}` : ''}
                              </option>
                            ))}
                          </select>
                        </label>

                        {host.contactId && (
                          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                            <div className="flex items-center gap-3">
                              <AvatarBubble name={host.name} imageUrl={host.imageUrl} />
                              <div>
                                <div className="font-medium">{host.name}</div>
                                <div className="text-sm text-zinc-400">{host.email || 'No email on file'}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                        Add your contacts first, then come back here to choose the host.
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => setActiveTab('contacts')}
                            className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                          >
                            Open contact list
                          </button>
                        </div>
                      </div>
                    )}

                    <GroupMeetAvailabilityPicker
                      className="mt-5"
                      targetMonth={targetMonth}
                      availabilityEntries={hostAvailabilityEntries}
                      onChange={setHostAvailabilityEntries}
                      title="Host availability"
                      subtitle={
                        host.contactId
                          ? 'Set the days and time ranges the host can actually do before the request goes out.'
                          : 'Choose a host contact first, then add the organizer availability.'
                      }
                    />
                  </div>

                  <div className="mt-8">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Guests</h3>
                        <p className="text-sm text-zinc-400">Only saved contacts can be invited. Tap the people you want to include in this request.</p>
                      </div>
                      <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                        {selectedParticipantContacts.length} selected
                      </div>
                    </div>

                    {!contacts.length ? (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                        Your guest picker will unlock once you have contacts saved.
                      </div>
                    ) : !availableGuestContacts.length ? (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                        Everyone in your contact list is currently being used as the host, so add more contacts to build the guest list.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableGuestContacts.map((contact) => {
                          const selected = selectedParticipantContactIds.includes(contact.id);
                          return (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => toggleParticipantContact(contact.id)}
                              className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-colors ${
                                selected
                                  ? 'border-[#E0FE10]/40 bg-[#E0FE10]/10'
                                  : 'border-zinc-800 bg-black/60 hover:bg-zinc-900/80'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <AvatarBubble name={contact.name} imageUrl={contact.imageUrl} />
                                <div>
                                  <div className="font-medium">{contact.name}</div>
                                  <div className="text-sm text-zinc-400">{contact.email || 'Manual link only'}</div>
                                </div>
                              </div>
                              <div className={`rounded-full px-3 py-2 text-xs font-semibold ${selected ? 'bg-[#E0FE10] text-black' : 'border border-zinc-700 text-zinc-300'}`}>
                                {selected ? 'Selected' : 'Add guest'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex items-center justify-between gap-4 border-t border-zinc-800 pt-6">
                    <div className="text-sm text-zinc-400">
                      Host availability locked in • {selectedParticipantContacts.length} guest{selectedParticipantContacts.length === 1 ? '' : 's'} ready
                    </div>
                    <button
                      type="button"
                      onClick={createRequest}
                      disabled={creating}
                      className="rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                    >
                      {creating ? 'Saving…' : 'Save draft'}
                    </button>
                  </div>
                </>
              ) : activeTab === 'contacts' ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl bg-white/5 text-white flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Contact list</h2>
                      <p className="text-sm text-zinc-400">Create the reusable profiles here. The meeting builder only pulls from this saved list.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr_auto] gap-3">
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
                    <div className="rounded-xl border border-zinc-800 bg-black px-4 py-3">
                      <input
                        ref={contactImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleContactImageSelection}
                        className="hidden"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarBubble
                            name={contactName || 'Contact'}
                            imageUrl={contactImagePreviewUrl || null}
                            size="h-10 w-10"
                          />
                          <div className="min-w-0">
                            <div className="text-sm text-white truncate">
                              {contactImageFile ? contactImageFile.name : 'Upload contact image'}
                            </div>
                            <div className="text-xs text-zinc-500">
                              PNG, JPG, or WEBP
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {contactImageFile && (
                            <button
                              type="button"
                              onClick={() => {
                                if (contactImagePreviewUrl.startsWith('blob:')) {
                                  URL.revokeObjectURL(contactImagePreviewUrl);
                                }
                                setContactImageFile(null);
                                setContactImagePreviewUrl('');
                                if (contactImageInputRef.current) {
                                  contactImageInputRef.current.value = '';
                                }
                              }}
                              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                            >
                              Clear
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => contactImageInputRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-900"
                          >
                            <Upload className="h-4 w-4" />
                            {contactImageFile ? 'Replace' : 'Choose file'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={saveContact}
                      disabled={savingContact}
                      className="rounded-xl bg-[#E0FE10] px-4 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                    >
                      {savingContact ? 'Saving…' : 'Save contact'}
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 px-4 py-4 text-sm text-zinc-400">
                    Save yourself here too. The host has to be selected from this list before a Group Meet request can be created.
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-zinc-400">
                      {contacts.length} saved contact{contacts.length === 1 ? '' : 's'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('create')}
                      className="rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900"
                    >
                      Back to request builder
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {contacts.map((contact) => {
                      const isHost = host.contactId === contact.id;
                      const isSelectedGuest = selectedParticipantContactIds.includes(contact.id);

                      return (
                        <div key={contact.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-black/40 p-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <AvatarBubble name={contact.name} imageUrl={contact.imageUrl} />
                            <div>
                              <div className="font-medium">{contact.name}</div>
                              <div className="text-sm text-zinc-400">{contact.email || 'No email on file'}</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {isHost && (
                              <span className="rounded-full border border-[#E0FE10]/30 bg-[#E0FE10]/10 px-3 py-2 text-[#E0FE10]">
                                Current host
                              </span>
                            )}
                            {isSelectedGuest && (
                              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300">
                                Selected guest
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {!contacts.length && !contactsLoading && (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                        No saved contacts yet.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-300 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Requests</h2>
                      <p className="text-sm text-zinc-400">Open drafts, send invitations, and monitor replies after the meeting is live.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div key={request.id} className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold text-white">{request.title}</div>
                              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                request.status === 'draft'
                                  ? 'border border-amber-500/30 bg-amber-500/10 text-amber-200'
                                  : request.status === 'closed'
                                    ? 'border border-zinc-700 bg-zinc-900 text-zinc-300'
                                    : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                              }`}>
                                {request.status}
                              </span>
                            </div>
                            <div className="text-sm text-zinc-400 mt-1">
                              Month {request.targetMonth} • Deadline {toReadableDateTime(request.deadlineAt, request.timezone)}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-3 text-xs text-zinc-400">
                              <span>{request.participantCount} participants</span>
                              <span>{request.responseCount} responded</span>
                              <span>{request.meetingDurationMinutes} min</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {request.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => sendDraftInvites(request.id)}
                                disabled={sendingRequestId === request.id}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-3 py-2 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                              >
                                <Mail className="w-4 h-4" />
                                {sendingRequestId === request.id ? 'Sending…' : 'Send invitations'}
                              </button>
                            )}
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
                              Open request
                            </button>
                            <button
                              type="button"
                              onClick={() => copyAllLinks(request)}
                              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-900"
                            >
                              <Copy className="w-4 h-4" />
                              Copy links
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {!requests.length && !loading && (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
                        No Group Meet requests yet.
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="space-y-6">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-200 flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Send test email</h2>
                    <p className="text-sm text-zinc-400">Send a standalone delivery preview without creating a real Group Meet request.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
                  <input
                    value={testEmailName}
                    onChange={(event) => setTestEmailName(event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    placeholder="Recipient name"
                  />
                  <input
                    value={testEmailRecipient}
                    onChange={(event) => setTestEmailRecipient(event.target.value)}
                    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    placeholder="Recipient email"
                  />
                  <button
                    type="button"
                    onClick={sendStandaloneTestEmail}
                    disabled={testEmailSending}
                    className="rounded-xl bg-[#E0FE10] px-4 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                  >
                    {testEmailSending ? 'Sending…' : 'Send test email'}
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 px-4 py-4 text-sm text-zinc-400">
                  This uses the current draft values for title, month, deadline, and timezone. The email is clearly marked as a test and routes back to the internal Group Meet tool.
                </div>
              </div>

              {activeTab !== 'requests' && (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#E0FE10]/10 text-[#E0FE10] flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Draft workflow</h2>
                      <p className="text-sm text-zinc-400">Build first, send later. Once you save a draft, switch to Requests to activate the meeting and track replies.</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-black/40 px-4 py-4 text-sm text-zinc-400">
                    Requests stay inactive until you explicitly send invitations. That keeps your link setup, host availability, and guest list editable while you are still preparing.
                  </div>
                </div>
              )}

              {activeTab === 'requests' && (
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
                          <span className={`rounded-full border px-3 py-1.5 ${
                            selectedRequest.status === 'draft'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                              : selectedRequest.status === 'closed'
                                ? 'border-zinc-800 bg-zinc-900'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          }`}>
                            {selectedRequest.status}
                          </span>
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

                      {selectedRequest.status === 'draft' && (
                        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 md:flex-row md:items-center md:justify-between">
                          <div className="text-sm text-amber-100">
                            This request is still a draft. Guests have not been emailed yet, so responses will not start coming in until you send the invitations.
                          </div>
                          <button
                            type="button"
                            onClick={() => selectedRequestId && sendDraftInvites(selectedRequestId)}
                            disabled={sendingRequestId === selectedRequestId}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                          >
                            <Mail className="w-4 h-4" />
                            {sendingRequestId === selectedRequestId ? 'Sending…' : 'Send invitations'}
                          </button>
                        </div>
                      )}

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
              )}
            </section>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default GroupMeetAdminPage;
