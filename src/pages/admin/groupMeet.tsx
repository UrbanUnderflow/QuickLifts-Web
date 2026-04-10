import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Calendar,
  CheckCircle2,
  Copy,
  Link as LinkIcon,
  Mail,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import AdminRouteGuard from "../../components/auth/AdminRouteGuard";
import GroupMeetAvailabilityPicker from "../../components/group-meet/GroupMeetAvailabilityPicker";
import { auth, storage } from "../../api/firebase/config";
import {
  buildGroupMeetCalendarEventOpenUrl,
  buildGroupMeetCandidateKey,
  formatMinutesAsTime,
  hasGroupMeetDeadlinePassed,
  hasGroupMeetInviteBeenSent,
  resolveGroupMeetStatusFromInvites,
  type GroupMeetAvailabilitySlot,
  type GroupMeetCandidateWindow,
  type GroupMeetContact,
  type GroupMeetInviteSummary,
  type GroupMeetRequestDetail,
  type GroupMeetRequestSummary,
} from "../../lib/groupMeet";

type HostDraft = {
  contactId: string | null;
  name: string;
  email: string;
  imageUrl: string;
};

type ComposerTab = "create" | "contacts" | "requests";

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
  status?: GroupMeetRequestSummary["status"];
};

type ApiRemoveInviteResponse = {
  success?: boolean;
  removedInviteName?: string;
  participantCount?: number;
  responseCount?: number;
  calendarInviteUpdated?: boolean;
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
  status: GroupMeetRequestSummary["status"];
  invites: GroupMeetInviteSummary[];
};

type ApiPreviewEmailResponse = {
  success?: boolean;
  skipped?: boolean;
  messageId?: string | null;
};

type ApiConfirmationEmailResponse = {
  success?: boolean;
  skipped?: boolean;
  messageId?: string | null;
  mode?: "preview" | "live";
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
  recipientCount?: number;
  confirmationEmail?: {
    attempted: boolean;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    recipientCount: number;
    mode: "automatic";
  };
  errors?: string[];
};

type ApiManualFlexPreviewResponse = {
  success?: boolean;
  skipped?: boolean;
  messageId?: string | null;
  strategy: "blocker" | "group_options" | "none";
  options: Array<{
    candidateKey: string;
    date: string;
    startMinutes: number;
    endMinutes: number;
    participantCount: number;
    totalParticipants: number;
    participantNames: string[];
    missingParticipantNames: string[];
  }>;
  detailText: string;
  invite: {
    token: string;
    name: string;
    email: string | null;
    participantType: "host" | "participant";
  };
  lastManualFlexSentAt: string | null;
  lastManualFlexStrategy: string | null;
};

const buildDefaultDeadlineValue = () => {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  date.setHours(17, 0, 0, 0);
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

const buildDefaultMonthValue = () => format(new Date(), "yyyy-MM");

const buildEmptyHost = (): HostDraft => ({
  contactId: null,
  name: "",
  email: "",
  imageUrl: "",
});

const toDateTimeLocalInputValue = (value: string | null) => {
  if (!value) return "";
  try {
    return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
  } catch (_error) {
    return "";
  }
};

const toReadableDateTime = (value: string | null, timezone: string) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    });
  } catch (_error) {
    return value;
  }
};

const formatMonthDate = (value: string) => {
  try {
    return format(parse(value, "yyyy-MM-dd", new Date()), "EEE, MMM d");
  } catch (_error) {
    return value;
  }
};

const buildCalendarDays = (targetMonth: string) => {
  const firstDay = startOfMonth(
    parse(`${targetMonth}-01`, "yyyy-MM-dd", new Date()),
  );
  const lastDay = endOfMonth(firstDay);
  const calendarStart = startOfWeek(firstDay, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(lastDay, { weekStartsOn: 0 });
  const days: Date[] = [];

  for (
    let current = calendarStart;
    current <= calendarEnd;
    current = addDays(current, 1)
  ) {
    days.push(current);
  }

  return days;
};

const buildAvatarUrl = (name: string, imageUrl?: string | null) =>
  imageUrl?.trim() ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Pulse")}&background=111827&color=ffffff&size=96`;

const shouldUseDevFirebaseForAdminApi = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === "true") {
    return true;
  }

  const forceDevFirebase =
    window.localStorage.getItem("forceDevFirebase") === "true";
  const devMode = window.localStorage.getItem("devMode") === "true";

  return forceDevFirebase || devMode;
};

const AvatarBubble: React.FC<{
  name: string;
  imageUrl?: string | null;
  size?: string;
}> = ({ name, imageUrl, size = "h-10 w-10" }) => (
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

const getRequestStatusLabel = (status: GroupMeetRequestSummary["status"]) =>
  status === "collecting" ? "active" : status;

const getRequestStatusClassName = (
  status: GroupMeetRequestSummary["status"],
) =>
  status === "draft"
    ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
    : status === "closed"
      ? "border border-zinc-700 bg-zinc-900 text-zinc-300"
      : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200";

const getInviteActionLabel = (
  invite: Pick<GroupMeetInviteSummary, "emailStatus" | "emailedAt">,
) => (hasGroupMeetInviteBeenSent(invite) ? "Resend invite" : "Send invite");

const getFinalSelectionDisplayEmail = (
  request: Pick<GroupMeetRequestDetail, "invites" | "finalSelection">,
) =>
  request.invites.find((invite) => invite.participantType === "host")?.email ||
  request.finalSelection?.selectedByEmail ||
  "host";

const getFinalConfirmationStatusLabel = (
  request: Pick<GroupMeetRequestDetail, "finalConfirmationEmail" | "timezone">,
) => {
  const sentAt = request.finalConfirmationEmail?.sentAt;
  if (!sentAt) {
    return null;
  }

  const recipientCount = Math.max(
    0,
    Number(request.finalConfirmationEmail?.recipientCount) || 0,
  );
  const mode = request.finalConfirmationEmail?.sendMode;
  const modeLabel =
    mode === "automatic"
      ? "automatically"
      : mode === "manual"
        ? "manually"
        : null;
  const sentLabel = toReadableDateTime(sentAt, request.timezone);
  const countLabel =
    recipientCount > 0
      ? ` to ${recipientCount} guest${recipientCount === 1 ? "" : "s"}`
      : "";

  return `Confirmation email sent ${modeLabel || ""}${countLabel} on ${sentLabel}.`
    .replace(/\s+/g, " ")
    .replace("sent on", "sent on")
    .trim();
};

const getFinalReminderStatusLabel = (
  request: Pick<GroupMeetRequestDetail, "finalReminderEmail" | "timezone">,
) => {
  const sentAt = request.finalReminderEmail?.sentAt;
  if (!sentAt) {
    return null;
  }

  const recipientCount = Math.max(
    0,
    Number(request.finalReminderEmail?.recipientCount) || 0,
  );
  const mode = request.finalReminderEmail?.sendMode;
  const modeLabel =
    mode === "automatic"
      ? "automatically"
      : mode === "manual"
        ? "manually"
        : null;
  const sentLabel = toReadableDateTime(sentAt, request.timezone);
  const countLabel =
    recipientCount > 0
      ? ` to ${recipientCount} guest${recipientCount === 1 ? "" : "s"}`
      : "";

  return `One-hour reminder sent ${modeLabel || ""}${countLabel} on ${sentLabel}.`
    .replace(/\s+/g, " ")
    .trim();
};

const getInviteDeliveryMeta = (
  invite: Pick<
    GroupMeetInviteSummary,
    "email" | "emailStatus" | "emailedAt" | "emailError"
  >,
  timezone: string,
) => {
  if (!invite.email) {
    return {
      badgeText: "No email",
      badgeClassName: "border-zinc-700 bg-zinc-900 text-zinc-300",
      detailText: "No email on file",
    };
  }

  if (hasGroupMeetInviteBeenSent(invite)) {
    const sentDetail = invite.emailedAt
      ? `Invite sent ${toReadableDateTime(invite.emailedAt, timezone)}`
      : "Invite sent";

    return {
      badgeText: "Invite sent",
      badgeClassName:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      detailText:
        invite.emailStatus === "failed" && invite.emailError
          ? `${sentDetail} • latest resend failed`
          : sentDetail,
    };
  }

  if (invite.emailStatus === "failed") {
    return {
      badgeText: "Send failed",
      badgeClassName: "border-red-500/30 bg-red-500/10 text-red-200",
      detailText: invite.emailError
        ? `Send failed: ${invite.emailError}`
        : "Invite send failed",
    };
  }

  if (invite.emailStatus === "manual_only") {
    return {
      badgeText: "Host link only",
      badgeClassName: "border-zinc-700 bg-zinc-900 text-zinc-300",
      detailText: "Host link only",
    };
  }

  return {
    badgeText: "Invite pending",
    badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    detailText: "Invite not sent yet",
  };
};

const getManualFlexStrategyLabel = (
  strategy: ApiManualFlexPreviewResponse["strategy"],
) => {
  if (strategy === "blocker") return "Targeted blocker";
  if (strategy === "group_options") return "Shared group options";
  return "No flex options";
};

const GroupMeetAdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ComposerTab>("create");
  const [title, setTitle] = useState("Group Meet");
  const [targetMonth, setTargetMonth] = useState(buildDefaultMonthValue);
  const [deadlineAt, setDeadlineAt] = useState(buildDefaultDeadlineValue);
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState(30);
  const [timezone, setTimezone] = useState("America/New_York");
  const [host, setHost] = useState<HostDraft>(buildEmptyHost);
  const [hostAvailabilityEntries, setHostAvailabilityEntries] = useState<
    GroupMeetAvailabilitySlot[]
  >([]);
  const [selectedParticipantContactIds, setSelectedParticipantContactIds] =
    useState<string[]>([]);
  const [contacts, setContacts] = useState<GroupMeetContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactImageFile, setContactImageFile] = useState<File | null>(null);
  const [contactImagePreviewUrl, setContactImagePreviewUrl] = useState("");
  const [adminAuthReady, setAdminAuthReady] = useState(
    Boolean(auth.currentUser),
  );
  const [testEmailName, setTestEmailName] = useState("");
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [requests, setRequests] = useState<GroupMeetRequestSummary[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [selectedRequest, setSelectedRequest] =
    useState<GroupMeetRequestDetail | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<
    string | null
  >(null);
  const [calendarDayModalDate, setCalendarDayModalDate] = useState<
    string | null
  >(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [confirmationEmailSending, setConfirmationEmailSending] =
    useState(false);
  const [confirmationPreviewSending, setConfirmationPreviewSending] =
    useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [resendingInviteToken, setResendingInviteToken] = useState<
    string | null
  >(null);
  const [removingInviteToken, setRemovingInviteToken] = useState<string | null>(
    null,
  );
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);
  const [previewInviteToken, setPreviewInviteToken] = useState("");
  const [previewRecipientName, setPreviewRecipientName] = useState("");
  const [previewRecipientEmail, setPreviewRecipientEmail] = useState("");
  const [previewSending, setPreviewSending] = useState(false);
  const [manualFlexInvite, setManualFlexInvite] =
    useState<GroupMeetInviteSummary | null>(null);
  const [manualFlexPreview, setManualFlexPreview] =
    useState<ApiManualFlexPreviewResponse | null>(null);
  const [manualFlexLoading, setManualFlexLoading] = useState(false);
  const [manualFlexSending, setManualFlexSending] = useState(false);
  const [manualFlexError, setManualFlexError] = useState<string | null>(null);
  const [calendarDayActionCandidateKey, setCalendarDayActionCandidateKey] =
    useState<string | null>(null);
  const [calendarDayModalError, setCalendarDayModalError] = useState<
    string | null
  >(null);
  const [requestModalMessage, setRequestModalMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [hostNoteDraft, setHostNoteDraft] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDeadlineAt, setEditDeadlineAt] = useState("");
  const [editTimezone, setEditTimezone] = useState("America/New_York");
  const [editMeetingDurationMinutes, setEditMeetingDurationMinutes] =
    useState(30);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const contactImageInputRef = useRef<HTMLInputElement>(null);
  const activeAdminEmail = auth.currentUser?.email || host.email || null;

  const selectedParticipantContacts = useMemo(
    () =>
      selectedParticipantContactIds
        .map(
          (contactId) =>
            contacts.find((contact) => contact.id === contactId) || null,
        )
        .filter((contact): contact is GroupMeetContact => Boolean(contact)),
    [contacts, selectedParticipantContactIds],
  );

  const availableGuestContacts = useMemo(
    () => contacts.filter((contact) => contact.id !== host.contactId),
    [contacts, host.contactId],
  );

  const requestCalendarDays = useMemo(() => {
    if (
      !selectedRequest?.targetMonth ||
      !/^\d{4}-\d{2}$/.test(selectedRequest.targetMonth)
    ) {
      return [];
    }

    return buildCalendarDays(selectedRequest.targetMonth);
  }, [selectedRequest?.targetMonth]);

  const respondedInvites = useMemo(
    () =>
      (selectedRequest?.invites || []).filter(
        (invite) =>
          Boolean(invite.respondedAt) || invite.availabilityEntries.length > 0,
      ),
    [selectedRequest],
  );

  const calendarDayModalParticipants = useMemo(() => {
    if (!selectedRequest || !calendarDayModalDate) {
      return [];
    }

    return selectedRequest.invites
      .map((invite) => {
        const daySlots = invite.availabilityEntries.filter(
          (slot) => slot.date === calendarDayModalDate,
        );
        return daySlots.length
          ? {
              ...invite,
              daySlots,
            }
          : null;
      })
      .filter(
        (
          invite,
        ): invite is GroupMeetRequestDetail["invites"][number] & {
          daySlots: GroupMeetAvailabilitySlot[];
        } => Boolean(invite),
      )
      .sort((left, right) => {
        if (
          (left.participantType === "host") !==
          (right.participantType === "host")
        ) {
          return left.participantType === "host" ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      });
  }, [calendarDayModalDate, selectedRequest]);

  const calendarDayModalCandidates = useMemo(() => {
    if (!selectedRequest || !calendarDayModalDate) {
      return [];
    }

    return selectedRequest.analysis.bestCandidates.filter(
      (candidate) => candidate.date === calendarDayModalDate,
    );
  }, [calendarDayModalDate, selectedRequest]);

  const previewGuestInvites = useMemo(
    () =>
      (selectedRequest?.invites || []).filter(
        (invite) => invite.participantType !== "host",
      ),
    [selectedRequest],
  );

  const getAdminHeaders = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("You must be signed in as an admin.");
    }

    const idToken = await currentUser.getIdToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      "x-force-dev-firebase": shouldUseDevFirebaseForAdminApi()
        ? "true"
        : "false",
      "x-admin-email": currentUser.email || "",
    };
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const headers = await getAdminHeaders();
      const response = await fetch("/api/admin/group-meet", { headers });
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiRequestListResponse> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load Group Meet requests.");
      }
      const nextRequests = Array.isArray(payload.requests)
        ? payload.requests
        : [];
      setRequests(nextRequests);
      setSelectedRequestId((current) => current || nextRequests[0]?.id || null);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to load Group Meet requests.",
      });
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
        name: current.name || currentUser.displayName || "Host",
        email: current.email || currentUser.email || "",
        imageUrl: current.imageUrl || currentUser.photoURL || "",
      }));
      setTestEmailName(
        (current) => current || currentUser.displayName || "Test Recipient",
      );
      setTestEmailRecipient((current) => current || currentUser.email || "");
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      if (contactImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(contactImagePreviewUrl);
      }
    };
  }, [contactImagePreviewUrl]);

  const loadContacts = async () => {
    setContactsLoading(true);
    try {
      const headers = await getAdminHeaders();
      const response = await fetch("/api/admin/group-meet/contacts", {
        headers,
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiContactsResponse> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load contacts.");
      }
      setContacts(Array.isArray(payload.contacts) ? payload.contacts : []);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to load contacts.",
      });
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
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(requestId)}`,
        { headers },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiRequestDetailResponse> & {
        error?: string;
      };
      if (!response.ok || !payload.request) {
        throw new Error(payload.error || "Failed to load Group Meet results.");
      }
      setSelectedRequest(payload.request);
      setHostNoteDraft(payload.request.finalSelection?.hostNote || "");
      setEditTitle(payload.request.title || "Group Meet");
      setEditDeadlineAt(toDateTimeLocalInputValue(payload.request.deadlineAt));
      setEditTimezone(payload.request.timezone || "America/New_York");
      setEditMeetingDurationMinutes(
        payload.request.meetingDurationMinutes || 30,
      );
    } catch (error: any) {
      setSelectedRequest(null);
      setMessage({
        type: "error",
        text: error?.message || "Failed to load Group Meet results.",
      });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedRequestId) return;
    loadRequestDetail(selectedRequestId);
  }, [selectedRequestId]);

  useEffect(() => {
    if (!selectedRequest || !requestCalendarDays.length) {
      setSelectedCalendarDate(null);
      return;
    }

    setSelectedCalendarDate((current) => {
      if (
        current &&
        requestCalendarDays.some((day) => format(day, "yyyy-MM-dd") === current)
      ) {
        return current;
      }

      const firstWithAvailability = requestCalendarDays.find((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        return (
          isSameMonth(
            day,
            parse(
              `${selectedRequest.targetMonth}-01`,
              "yyyy-MM-dd",
              new Date(),
            ),
          ) &&
          selectedRequest.invites.some((invite) =>
            invite.availabilityEntries.some((slot) => slot.date === dateKey),
          )
        );
      });

      if (firstWithAvailability) {
        return format(firstWithAvailability, "yyyy-MM-dd");
      }

      const firstTargetMonthDay = requestCalendarDays.find((day) =>
        isSameMonth(
          day,
          parse(`${selectedRequest.targetMonth}-01`, "yyyy-MM-dd", new Date()),
        ),
      );

      return firstTargetMonthDay
        ? format(firstTargetMonthDay, "yyyy-MM-dd")
        : null;
    });
  }, [requestCalendarDays, selectedRequest]);

  useEffect(() => {
    if (!selectedRequest) return;

    const defaultInvite =
      selectedRequest.invites.find(
        (invite) => invite.participantType !== "host",
      ) || null;
    setPreviewInviteToken((current) =>
      current &&
      selectedRequest.invites.some((invite) => invite.token === current)
        ? current
        : defaultInvite?.token || "",
    );
    setPreviewRecipientName(
      auth.currentUser?.displayName || "Preview Recipient",
    );
    setPreviewRecipientEmail(auth.currentUser?.email || "");
  }, [selectedRequest]);

  const useContactAsHost = (contact: GroupMeetContact) => {
    setHost({
      contactId: contact.id,
      name: contact.name,
      email: contact.email || "",
      imageUrl: contact.imageUrl || "",
    });
    setSelectedParticipantContactIds((current) =>
      current.filter((contactId) => contactId !== contact.id),
    );
  };

  useEffect(() => {
    if (!contacts.length) {
      setSelectedParticipantContactIds([]);
      setHost((current) => (current.contactId ? buildEmptyHost() : current));
      return;
    }

    setSelectedParticipantContactIds((current) =>
      current.filter((contactId) =>
        contacts.some(
          (contact) =>
            contact.id === contactId && contact.id !== host.contactId,
        ),
      ),
    );

    const selectedHostContact = host.contactId
      ? contacts.find((contact) => contact.id === host.contactId) || null
      : null;

    if (selectedHostContact) {
      const nextHost = {
        contactId: selectedHostContact.id,
        name: selectedHostContact.name,
        email: selectedHostContact.email || "",
        imageUrl: selectedHostContact.imageUrl || "",
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

    const currentUserEmail =
      auth.currentUser?.email?.trim().toLowerCase() || "";
    if (!currentUserEmail) return;

    const matchingContact = contacts.find(
      (contact) => (contact.email || "").toLowerCase() === currentUserEmail,
    );
    if (matchingContact) {
      useContactAsHost(matchingContact);
    }
  }, [contacts, host.contactId, host.email, host.imageUrl, host.name]);

  const toggleParticipantContact = (contactId: string) => {
    setSelectedParticipantContactIds((current) =>
      current.includes(contactId)
        ? current.filter((currentContactId) => currentContactId !== contactId)
        : [...current, contactId],
    );
  };

  const copyText = async (
    text: string,
    successText = "Copied to clipboard",
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: "success", text: successText });
    } catch (_error) {
      setMessage({ type: "error", text: "Copy failed." });
    }
  };

  const applyInviteSummariesToRequestState = (
    requestId: string,
    inviteSummaries: GroupMeetInviteSummary[],
    nextStatus?: GroupMeetRequestSummary["status"],
  ) => {
    const inviteByToken = new Map(
      inviteSummaries.map((invite) => [invite.token, invite]),
    );

    setRequests((current) =>
      current.map((request) =>
        request.id === requestId
          ? (() => {
              const nextInvites = request.invites.map((invite) => {
                const updatedInvite = inviteByToken.get(invite.token);
                return updatedInvite ? { ...invite, ...updatedInvite } : invite;
              });

              return {
                ...request,
                status:
                  nextStatus ||
                  resolveGroupMeetStatusFromInvites(
                    request.deadlineAt,
                    request.status,
                    nextInvites,
                  ),
                invites: nextInvites,
              };
            })()
          : request,
      ),
    );

    setSelectedRequest((current) =>
      current && current.id === requestId
        ? (() => {
            const nextInvites = current.invites.map((invite) => {
              const updatedInvite = inviteByToken.get(invite.token);
              return updatedInvite ? { ...invite, ...updatedInvite } : invite;
            });

            return {
              ...current,
              status:
                nextStatus ||
                resolveGroupMeetStatusFromInvites(
                  current.deadlineAt,
                  current.status,
                  nextInvites,
                  {
                    finalSelection: current.finalSelection,
                    calendarInvite: current.calendarInvite,
                  },
                ),
              invites: nextInvites,
            };
          })()
        : current,
    );
  };

  const openRequestModal = (requestId: string) => {
    setSelectedRequestId(requestId);
    if (requestId !== selectedRequestId) {
      setSelectedRequest(null);
    }
    setRequestModalMessage(null);
    setCalendarDayModalDate(null);
    setCalendarDayModalError(null);
    setCalendarDayActionCandidateKey(null);
    setRequestModalOpen(true);
  };

  const closeRequestModal = () => {
    setRequestModalOpen(false);
    setRequestModalMessage(null);
    setCalendarDayModalDate(null);
    setCalendarDayModalError(null);
    setCalendarDayActionCandidateKey(null);
    closeManualFlexModal();
  };

  const createRequest = async () => {
    if (!host.contactId) {
      setMessage({
        type: "error",
        text: "Choose the host from your contact list before creating the request.",
      });
      return;
    }

    if (!hostAvailabilityEntries.length) {
      setMessage({
        type: "error",
        text: "Add the host availability before sending the request.",
      });
      return;
    }

    if (!selectedParticipantContacts.length) {
      setMessage({
        type: "error",
        text: "Choose at least one guest from your contact list.",
      });
      return;
    }

    setCreating(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch("/api/admin/group-meet", {
        method: "POST",
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

      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiCreateResponse> & { error?: string };
      if (!response.ok || !payload.request) {
        throw new Error(
          payload.error || "Failed to create Group Meet request.",
        );
      }

      setSelectedRequestId(payload.request.id);
      setActiveTab("requests");
      setMessage({
        type: "success",
        text: "Group Meet draft saved. Open Requests to send invitations when you are ready.",
      });
      setSelectedParticipantContactIds([]);
      setHostAvailabilityEntries([]);
      await loadRequests();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to create Group Meet request.",
      });
    } finally {
      setCreating(false);
    }
  };

  const sendDraftInvites = async (requestId: string) => {
    setSendingRequestId(requestId);
    setMessage(null);
    setRequestModalMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(requestId)}/send`,
        {
          method: "POST",
          headers,
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiSendInvitesResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "Failed to send Group Meet invitations.",
        );
      }

      applyInviteSummariesToRequestState(
        requestId,
        Array.isArray(payload.invites) ? payload.invites : [],
        payload.status,
      );

      const sentCount = Number(payload.sentCount) || 0;
      const failedCount = Number(payload.failedCount) || 0;
      const skippedCount = Number(payload.skippedCount) || 0;
      const summary = [
        `${sentCount} sent`,
        failedCount ? `${failedCount} failed` : null,
        skippedCount ? `${skippedCount} skipped` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      setMessage({
        type: failedCount ? "error" : "success",
        text: failedCount
          ? `Invite send finished with issues: ${summary}.`
          : `Invitations sent. ${summary}.`,
      });
      setRequestModalMessage({
        type: failedCount ? "error" : "success",
        text: failedCount
          ? `Invite send finished with issues: ${summary}.`
          : `Invitations sent. ${summary}.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to send Group Meet invitations.",
      });
      setRequestModalMessage({
        type: "error",
        text: error?.message || "Failed to send Group Meet invitations.",
      });
    } finally {
      setSendingRequestId(null);
    }
  };

  const sendPreviewEmail = async () => {
    if (!selectedRequestId) return;

    if (!previewInviteToken) {
      setMessage({ type: "error", text: "Choose a guest link to preview." });
      setRequestModalMessage({
        type: "error",
        text: "Choose a guest link to preview.",
      });
      return;
    }

    if (!previewRecipientEmail.trim()) {
      setMessage({
        type: "error",
        text: "Add an email address for the preview send.",
      });
      setRequestModalMessage({
        type: "error",
        text: "Add an email address for the preview send.",
      });
      return;
    }

    setPreviewSending(true);
    setMessage(null);
    setRequestModalMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/preview-email`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            recipientName: previewRecipientName || "Preview Recipient",
            recipientEmail: previewRecipientEmail,
            inviteToken: previewInviteToken,
          }),
        },
      );

      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiPreviewEmailResponse & { error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to send preview email.");
      }

      const successText = payload.skipped
        ? `Preview email was skipped for ${previewRecipientEmail}.`
        : `Preview email sent to ${previewRecipientEmail}.`;
      setMessage({ type: "success", text: successText });
      setRequestModalMessage({ type: "success", text: successText });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to send preview email.",
      });
      setRequestModalMessage({
        type: "error",
        text: error?.message || "Failed to send preview email.",
      });
    } finally {
      setPreviewSending(false);
    }
  };

  const closeManualFlexModal = () => {
    setManualFlexInvite(null);
    setManualFlexPreview(null);
    setManualFlexError(null);
    setManualFlexLoading(false);
    setManualFlexSending(false);
  };

  const openManualFlexModal = async (invite: GroupMeetInviteSummary) => {
    if (!selectedRequestId) return;

    setCalendarDayModalDate(null);
    setCalendarDayModalError(null);
    setManualFlexInvite(invite);
    setManualFlexPreview(null);
    setManualFlexError(null);
    setManualFlexLoading(true);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/invites/${encodeURIComponent(invite.token)}/flex`,
        {
          headers,
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiManualFlexPreviewResponse> & {
        error?: string;
      };

      if (!response.ok || !payload.strategy || !payload.invite) {
        throw new Error(
          payload.error || `Failed to load flex options for ${invite.name}.`,
        );
      }

      setManualFlexPreview(payload as ApiManualFlexPreviewResponse);
    } catch (error: any) {
      const errorText =
        error?.message || `Failed to load flex options for ${invite.name}.`;
      setManualFlexError(errorText);
      setMessage({ type: "error", text: errorText });
      setRequestModalMessage({ type: "error", text: errorText });
    } finally {
      setManualFlexLoading(false);
    }
  };

  const sendManualFlexEmail = async () => {
    if (!selectedRequestId || !manualFlexInvite) return;

    setManualFlexSending(true);
    setManualFlexError(null);
    setMessage(null);
    setRequestModalMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/invites/${encodeURIComponent(manualFlexInvite.token)}/flex`,
        {
          method: "POST",
          headers,
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiManualFlexPreviewResponse> & {
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ||
            `Failed to send flex request to ${manualFlexInvite.name}.`,
        );
      }

      const successText = payload.skipped
        ? `Flex request was skipped for ${manualFlexInvite.name}.`
        : `Flex request sent to ${manualFlexInvite.name}.`;
      setMessage({ type: "success", text: successText });
      setRequestModalMessage({ type: "success", text: successText });
      closeManualFlexModal();
    } catch (error: any) {
      const errorText =
        error?.message ||
        `Failed to send flex request to ${manualFlexInvite.name}.`;
      setManualFlexError(errorText);
      setMessage({ type: "error", text: errorText });
      setRequestModalMessage({ type: "error", text: errorText });
    } finally {
      setManualFlexSending(false);
    }
  };

  const saveContact = async () => {
    const name = contactName.trim();
    const email = contactEmail.trim();

    if (!name) {
      setMessage({ type: "error", text: "Contact name is required." });
      return;
    }

    if (contactImageFile && !contactImageFile.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Choose a valid image file." });
      return;
    }

    setSavingContact(true);
    setMessage(null);

    try {
      let imageUrl = "";

      if (contactImageFile) {
        const currentUser = auth.currentUser;
        const ownerKey =
          currentUser?.uid ||
          currentUser?.email?.replace(/[^a-zA-Z0-9]/g, "-") ||
          "admin";
        const safeFileName = contactImageFile.name.replace(
          /[^a-zA-Z0-9.-]/g,
          "",
        );
        const filePath = `group-meet/contacts/${ownerKey}/${Date.now()}-${safeFileName}`;
        const imageRef = storageRef(storage, filePath);

        await uploadBytes(imageRef, contactImageFile, {
          contentType: contactImageFile.type || "image/jpeg",
        });
        imageUrl = await getDownloadURL(imageRef);
      }

      const headers = await getAdminHeaders();
      const response = await fetch("/api/admin/group-meet/contacts", {
        method: "POST",
        headers,
        body: JSON.stringify({ name, email, imageUrl }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiContactSaveResponse> & {
        error?: string;
      };
      if (!response.ok || !payload.contact) {
        throw new Error(payload.error || "Failed to save contact.");
      }

      await loadContacts();
      setContactName("");
      setContactEmail("");
      if (contactImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(contactImagePreviewUrl);
      }
      setContactImageFile(null);
      setContactImagePreviewUrl("");
      if (contactImageInputRef.current) {
        contactImageInputRef.current.value = "";
      }
      setMessage({
        type: "success",
        text: `${name} saved to Group Meet contacts.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to save contact.",
      });
    } finally {
      setSavingContact(false);
    }
  };

  const copyAllLinks = async (request: GroupMeetRequestSummary) => {
    const text = request.invites
      .map((invite) => `${invite.name}: ${invite.shareUrl}`)
      .join("\n");
    await copyText(text, "All participant links copied.");
  };

  const copyCandidateSummary = async (candidate: GroupMeetCandidateWindow) => {
    const text = [
      formatCandidateLabel(candidate),
      `Participants: ${candidate.participantNames.join(", ") || "None"}`,
      candidate.missingParticipantNames.length
        ? `Missing: ${candidate.missingParticipantNames.join(", ")}`
        : "Missing: none",
      candidate.flexibilityMinutes > 0
        ? `Start window: ${formatMinutesAsTime(candidate.earliestStartMinutes)} to ${formatMinutesAsTime(candidate.latestStartMinutes)}`
        : `Start window: ${formatMinutesAsTime(candidate.earliestStartMinutes)}`,
    ].join("\n");
    await copyText(text, "Candidate summary copied.");
  };

  const generateAiRecommendation = async () => {
    if (!selectedRequestId) return;
    setRecommendLoading(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/recommend`,
        {
          method: "POST",
          headers,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          payload.error || "Failed to generate AI recommendation.",
        );
      }
      await loadRequestDetail(selectedRequestId);
      setMessage({ type: "success", text: "AI recommendation generated." });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to generate AI recommendation.",
      });
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
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/finalize`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            candidateKey,
            hostNote: hostNoteDraft,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save final meeting block.");
      }
      await loadRequestDetail(selectedRequestId);
      setMessage({ type: "success", text: "Final meeting block saved." });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to save final meeting block.",
      });
    } finally {
      setFinalizeLoading(false);
    }
  };

  const closeCalendarDayModal = () => {
    setCalendarDayModalDate(null);
    setCalendarDayModalError(null);
    setCalendarDayActionCandidateKey(null);
  };

  const finalizeCandidateAndScheduleInvite = async (candidateKey: string) => {
    if (!selectedRequestId || !selectedRequest) return;

    const hadCalendarInvite = Boolean(selectedRequest.calendarInvite);
    setCalendarDayActionCandidateKey(candidateKey);
    setCalendarDayModalError(null);
    setMessage(null);
    setRequestModalMessage(null);

    try {
      const headers = await getAdminHeaders();
      const finalizeResponse = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/finalize`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            candidateKey,
            hostNote: hostNoteDraft,
          }),
        },
      );
      const finalizePayload = (await finalizeResponse
        .json()
        .catch(() => ({}))) as { error?: string };
      if (!finalizeResponse.ok) {
        throw new Error(
          finalizePayload.error || "Failed to save final meeting block.",
        );
      }

      const scheduleResponse = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/schedule`,
        {
          method: "POST",
          headers,
        },
      );
      const schedulePayload = (await scheduleResponse
        .json()
        .catch(() => ({}))) as ApiConfirmationEmailResponse & {
        error?: string;
      };
      if (!scheduleResponse.ok) {
        await loadRequestDetail(selectedRequestId);
        throw new Error(
          schedulePayload.error ||
            "Final block saved, but failed to create the Google Calendar invite.",
        );
      }

      await loadRequestDetail(selectedRequestId);
      const confirmationEmail = schedulePayload.confirmationEmail || null;
      const successText =
        confirmationEmail && confirmationEmail.sentCount > 0
          ? hadCalendarInvite
            ? `Meeting time selected, Google Calendar invite updated, and confirmation email sent to ${confirmationEmail.sentCount} guest${confirmationEmail.sentCount === 1 ? "" : "s"}.`
            : `Meeting time selected, Google Calendar invite sent, and confirmation email sent to ${confirmationEmail.sentCount} guest${confirmationEmail.sentCount === 1 ? "" : "s"}.`
          : confirmationEmail && confirmationEmail.failedCount > 0
            ? "Meeting time selected and Google Calendar invite created, but the Group Meet confirmation email needs a manual resend."
            : hadCalendarInvite
              ? "Meeting time selected and Google Calendar invite updated."
              : "Meeting time selected and Google Calendar invite sent.";
      setMessage({ type: "success", text: successText });
      setRequestModalMessage({ type: "success", text: successText });
      closeCalendarDayModal();
    } catch (error: any) {
      const errorText =
        error?.message ||
        "Failed to select the time and send the Google Calendar invite.";
      setCalendarDayModalError(errorText);
      setMessage({ type: "error", text: errorText });
      setRequestModalMessage({ type: "error", text: errorText });
    } finally {
      setCalendarDayActionCandidateKey(null);
    }
  };

  const scheduleCalendarInvite = async () => {
    if (!selectedRequestId || !selectedRequest?.finalSelection) return;
    setScheduleLoading(true);
    setMessage(null);
    setRequestModalMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/schedule`,
        {
          method: "POST",
          headers,
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiConfirmationEmailResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          payload.error || "Failed to create Google Calendar invite.",
        );
      }
      await loadRequestDetail(selectedRequestId);
      const confirmationEmail = payload.confirmationEmail || null;
      const successText =
        confirmationEmail && confirmationEmail.sentCount > 0
          ? `Google Calendar invite created and confirmation email sent to ${confirmationEmail.sentCount} guest${confirmationEmail.sentCount === 1 ? "" : "s"}.`
          : confirmationEmail && confirmationEmail.failedCount > 0
            ? "Google Calendar invite created, but the Group Meet confirmation email needs a manual resend."
            : "Google Calendar invite created.";
      setMessage({ type: "success", text: successText });
      setRequestModalMessage({ type: "success", text: successText });
    } catch (error: any) {
      const errorText =
        error?.message || "Failed to create Google Calendar invite.";
      setMessage({
        type: "error",
        text: errorText,
      });
      setRequestModalMessage({
        type: "error",
        text: errorText,
      });
    } finally {
      setScheduleLoading(false);
    }
  };

  const sendFinalConfirmationEmail = async (mode: "preview" | "live") => {
    if (!selectedRequestId || !selectedRequest?.finalSelection) return;

    if (mode === "preview" && !activeAdminEmail) {
      const errorText =
        "Sign in with an email address before sending a preview confirmation email.";
      setMessage({ type: "error", text: errorText });
      setRequestModalMessage({ type: "error", text: errorText });
      return;
    }

    if (mode === "preview") {
      setConfirmationPreviewSending(true);
    } else {
      setConfirmationEmailSending(true);
    }
    setMessage(null);
    setRequestModalMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/confirmation-email`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            mode,
            recipientName: auth.currentUser?.displayName || "Preview Recipient",
            recipientEmail: activeAdminEmail || "",
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiConfirmationEmailResponse & {
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error || "Failed to send the Group Meet confirmation email.",
        );
      }

      await loadRequestDetail(selectedRequestId);

      let successText = "Confirmation email sent.";
      if (mode === "preview") {
        successText = payload.skipped
          ? `Confirmation preview email was skipped for ${activeAdminEmail}.`
          : `Confirmation preview email sent to ${activeAdminEmail}.`;
      } else {
        const sentCount = Number(payload.sentCount) || 0;
        const failedCount = Number(payload.failedCount) || 0;
        const skippedCount = Number(payload.skippedCount) || 0;
        const summary = [
          `${sentCount} sent`,
          failedCount ? `${failedCount} failed` : null,
          skippedCount ? `${skippedCount} skipped` : null,
        ]
          .filter(Boolean)
          .join(" • ");
        successText = failedCount
          ? `Confirmation email send finished with issues: ${summary}.`
          : `Confirmation email sent. ${summary}.`;
      }

      setMessage({ type: "success", text: successText });
      setRequestModalMessage({ type: "success", text: successText });
    } catch (error: any) {
      const errorText =
        error?.message || "Failed to send the Group Meet confirmation email.";
      setMessage({ type: "error", text: errorText });
      setRequestModalMessage({ type: "error", text: errorText });
    } finally {
      if (mode === "preview") {
        setConfirmationPreviewSending(false);
      } else {
        setConfirmationEmailSending(false);
      }
    }
  };

  const saveRequestEdits = async () => {
    if (!selectedRequestId) return;
    if (!editDeadlineAt) {
      setMessage({ type: "error", text: "Deadline is required." });
      return;
    }

    setSavingEdits(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            title: editTitle,
            deadlineAt: editDeadlineAt
              ? new Date(editDeadlineAt).toISOString()
              : null,
            timezone: editTimezone,
            meetingDurationMinutes: editMeetingDurationMinutes,
          }),
        },
      );

      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiUpdateResponse> & { error?: string };
      if (!response.ok || !payload.request) {
        throw new Error(payload.error || "Failed to save request changes.");
      }

      setSelectedRequest(payload.request);
      setHostNoteDraft(payload.request.finalSelection?.hostNote || "");
      await loadRequests();
      setMessage({
        type: "success",
        text: payload.resetDerivedSelections
          ? "Request updated. Final selection and calendar invite were cleared because the timing rules changed."
          : "Request updated.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to save request changes.",
      });
    } finally {
      setSavingEdits(false);
    }
  };

  const resendInvite = async (invite: GroupMeetInviteSummary) => {
    if (!selectedRequestId) return;

    setResendingInviteToken(invite.token);
    setMessage(null);
    setRequestModalMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/invites/${encodeURIComponent(invite.token)}/resend`,
        {
          method: "POST",
          headers,
        },
      );

      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ApiInviteResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || `Failed to resend ${invite.name}'s invite.`,
        );
      }

      if (payload.invite) {
        applyInviteSummariesToRequestState(
          selectedRequestId,
          [payload.invite],
          payload.status,
        );
      }

      const actionLabel = hasGroupMeetInviteBeenSent(invite)
        ? "resent"
        : "sent";
      const successText = `Invite ${actionLabel} to ${invite.name}.`;
      setMessage({ type: "success", text: successText });
      setRequestModalMessage({ type: "success", text: successText });
    } catch (error: any) {
      const errorText =
        error?.message || `Failed to send ${invite.name}'s invite.`;
      setMessage({ type: "error", text: errorText });
      setRequestModalMessage({ type: "error", text: errorText });
    } finally {
      setResendingInviteToken(null);
    }
  };

  const removeInvite = async (invite: GroupMeetInviteSummary) => {
    if (!selectedRequestId || invite.participantType === "host") return;

    const confirmed = window.confirm(
      selectedRequest?.calendarInvite
        ? `Remove ${invite.name} from this Group Meet? This will also update the live Google Calendar invite attendee list.`
        : `Remove ${invite.name} from this Group Meet?`,
    );
    if (!confirmed) {
      return;
    }

    setRemovingInviteToken(invite.token);
    setMessage(null);
    setRequestModalMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch(
        `/api/admin/group-meet/${encodeURIComponent(selectedRequestId)}/invites/${encodeURIComponent(invite.token)}`,
        {
          method: "DELETE",
          headers,
        },
      );

      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiRemoveInviteResponse & { error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error || `Failed to remove ${invite.name} from Group Meet.`,
        );
      }

      await Promise.all([loadRequests(), loadRequestDetail(selectedRequestId)]);

      const successText = payload.calendarInviteUpdated
        ? `${invite.name} was removed and the Google Calendar invite was updated.`
        : `${invite.name} was removed from the Group Meet request.`;
      setMessage({ type: "success", text: successText });
      setRequestModalMessage({ type: "success", text: successText });
    } catch (error: any) {
      const errorText =
        error?.message || `Failed to remove ${invite.name} from Group Meet.`;
      setMessage({ type: "error", text: errorText });
      setRequestModalMessage({ type: "error", text: errorText });
    } finally {
      setRemovingInviteToken(null);
    }
  };

  const sendStandaloneTestEmail = async () => {
    if (!testEmailRecipient.trim()) {
      setMessage({
        type: "error",
        text: "Add a recipient email for the test send.",
      });
      return;
    }

    setTestEmailSending(true);
    setMessage(null);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch("/api/admin/group-meet/test-email", {
        method: "POST",
        headers,
        body: JSON.stringify({
          recipientName: testEmailName || "Test Recipient",
          recipientEmail: testEmailRecipient,
          requestTitle: title,
          targetMonth,
          deadlineAt: new Date(deadlineAt).toISOString(),
          timezone,
        }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiSimpleSuccessResponse & {
        error?: string;
      };
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error || "Failed to send Group Meet test email.",
        );
      }
      setMessage({
        type: "success",
        text: `Test Group Meet email sent to ${testEmailRecipient}.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to send Group Meet test email.",
      });
    } finally {
      setTestEmailSending(false);
    }
  };

  const resolveSelectedInvitesForCandidate = (
    candidate: GroupMeetCandidateWindow,
  ) =>
    (selectedRequest?.invites || []).filter((invite) =>
      candidate.participantTokens.includes(invite.token),
    );

  const resolveSelectedInvitesForDate = (date: string) =>
    (selectedRequest?.invites || []).filter((invite) =>
      invite.availabilityEntries.some((slot) => slot.date === date),
    );

  const handleContactImageSelection = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const nextFile = event.target.files?.[0] || null;

    if (!nextFile) {
      if (contactImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(contactImagePreviewUrl);
      }
      setContactImageFile(null);
      setContactImagePreviewUrl("");
      return;
    }

    if (!nextFile.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Choose a valid image file." });
      event.target.value = "";
      return;
    }

    if (contactImagePreviewUrl.startsWith("blob:")) {
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
                Create a tracked availability request, generate one link per
                person, and collect responses for a target month.
              </p>
            </div>
            <button
              type="button"
              onClick={loadRequests}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {message && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                message.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-red-500/30 bg-red-500/10 text-red-100"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-4 text-sm text-zinc-300">
            Active admin identity:{" "}
            <span className="font-medium text-white">
              {activeAdminEmail || "Unknown"}
            </span>
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "create"
                  ? "bg-[#E0FE10] text-black"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              Create request
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "contacts"
                  ? "bg-[#E0FE10] text-black"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              Contact list
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "requests"
                  ? "bg-[#E0FE10] text-black"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              Requests
            </button>
          </div>

          <div>
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6">
              {activeTab === "create" ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl bg-[#E0FE10]/10 text-[#E0FE10] flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Create draft</h2>
                      <p className="text-zinc-400 text-sm">
                        Set up the meeting, save it as a draft, and send
                        invitations later from the Requests tab.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="block text-sm text-zinc-300 mb-2">
                        Meeting title
                      </span>
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                        placeholder="Board sync"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-sm text-zinc-300 mb-2">
                        Target month
                      </span>
                      <input
                        type="month"
                        value={targetMonth}
                        onChange={(event) => setTargetMonth(event.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-sm text-zinc-300 mb-2">
                        Deadline
                      </span>
                      <input
                        type="datetime-local"
                        value={deadlineAt}
                        onChange={(event) => setDeadlineAt(event.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-sm text-zinc-300 mb-2">
                        Meeting length
                      </span>
                      <select
                        value={meetingDurationMinutes}
                        onChange={(event) =>
                          setMeetingDurationMinutes(Number(event.target.value))
                        }
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
                    <span className="block text-sm text-zinc-300 mb-2">
                      Timezone
                    </span>
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
                      <div className="text-sm text-zinc-400">
                        Saving here does not email anyone yet. Drafts move into
                        Requests, where you can review the setup and send
                        invitations when ready.
                      </div>
                    </div>
                    <div className="rounded-full bg-[#E0FE10] px-4 py-2 text-sm font-semibold text-black">
                      Saves as draft
                    </div>
                  </div>

                  <div className="mt-8 rounded-3xl border border-zinc-800 bg-black/50 p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Host</h3>
                        <p className="text-sm text-zinc-400">
                          Pick the organizer from your saved contacts, then lock
                          in their availability before the request goes out.
                        </p>
                      </div>
                      <AvatarBubble
                        name={host.name || "Host"}
                        imageUrl={host.imageUrl}
                      />
                    </div>

                    {contacts.length ? (
                      <>
                        <label className="block">
                          <span className="block text-sm text-zinc-300 mb-2">
                            Host contact
                          </span>
                          <select
                            value={host.contactId || ""}
                            onChange={(event) => {
                              const nextContact =
                                contacts.find(
                                  (contact) =>
                                    contact.id === event.target.value,
                                ) || null;
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
                                {contact.name}
                                {contact.email ? ` • ${contact.email}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        {host.contactId && (
                          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                            <div className="flex items-center gap-3">
                              <AvatarBubble
                                name={host.name}
                                imageUrl={host.imageUrl}
                              />
                              <div>
                                <div className="font-medium">{host.name}</div>
                                <div className="text-sm text-zinc-400">
                                  {host.email || "No email on file"}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                        Add your contacts first, then come back here to choose
                        the host.
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => setActiveTab("contacts")}
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
                          ? "Set the days and time ranges the host can actually do before the request goes out."
                          : "Choose a host contact first, then add the organizer availability."
                      }
                    />
                  </div>

                  <div className="mt-8">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Guests</h3>
                        <p className="text-sm text-zinc-400">
                          Only saved contacts can be invited. Tap the people you
                          want to include in this request.
                        </p>
                      </div>
                      <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                        {selectedParticipantContacts.length} selected
                      </div>
                    </div>

                    {!contacts.length ? (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                        Your guest picker will unlock once you have contacts
                        saved.
                      </div>
                    ) : !availableGuestContacts.length ? (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                        Everyone in your contact list is currently being used as
                        the host, so add more contacts to build the guest list.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableGuestContacts.map((contact) => {
                          const selected =
                            selectedParticipantContactIds.includes(contact.id);
                          return (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() =>
                                toggleParticipantContact(contact.id)
                              }
                              className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-colors ${
                                selected
                                  ? "border-[#E0FE10]/40 bg-[#E0FE10]/10"
                                  : "border-zinc-800 bg-black/60 hover:bg-zinc-900/80"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <AvatarBubble
                                  name={contact.name}
                                  imageUrl={contact.imageUrl}
                                />
                                <div>
                                  <div className="font-medium">
                                    {contact.name}
                                  </div>
                                  <div className="text-sm text-zinc-400">
                                    {contact.email || "Manual link only"}
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`rounded-full px-3 py-2 text-xs font-semibold ${selected ? "bg-[#E0FE10] text-black" : "border border-zinc-700 text-zinc-300"}`}
                              >
                                {selected ? "Selected" : "Add guest"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex items-center justify-between gap-4 border-t border-zinc-800 pt-6">
                    <div className="text-sm text-zinc-400">
                      Host availability locked in •{" "}
                      {selectedParticipantContacts.length} guest
                      {selectedParticipantContacts.length === 1 ? "" : "s"}{" "}
                      ready
                    </div>
                    <button
                      type="button"
                      onClick={createRequest}
                      disabled={creating}
                      className="rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                    >
                      {creating ? "Saving…" : "Save draft"}
                    </button>
                  </div>
                </>
              ) : activeTab === "contacts" ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl bg-white/5 text-white flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Contact list</h2>
                      <p className="text-sm text-zinc-400">
                        Create the reusable profiles here. The meeting builder
                        only pulls from this saved list.
                      </p>
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
                            name={contactName || "Contact"}
                            imageUrl={contactImagePreviewUrl || null}
                            size="h-10 w-10"
                          />
                          <div className="min-w-0">
                            <div className="text-sm text-white truncate">
                              {contactImageFile
                                ? contactImageFile.name
                                : "Upload contact image"}
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
                                if (
                                  contactImagePreviewUrl.startsWith("blob:")
                                ) {
                                  URL.revokeObjectURL(contactImagePreviewUrl);
                                }
                                setContactImageFile(null);
                                setContactImagePreviewUrl("");
                                if (contactImageInputRef.current) {
                                  contactImageInputRef.current.value = "";
                                }
                              }}
                              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                            >
                              Clear
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              contactImageInputRef.current?.click()
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-900"
                          >
                            <Upload className="h-4 w-4" />
                            {contactImageFile ? "Replace" : "Choose file"}
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
                      {savingContact ? "Saving…" : "Save contact"}
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 px-4 py-4 text-sm text-zinc-400">
                    Save yourself here too. The host has to be selected from
                    this list before a Group Meet request can be created.
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-zinc-400">
                      {contacts.length} saved contact
                      {contacts.length === 1 ? "" : "s"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("create")}
                      className="rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900"
                    >
                      Back to request builder
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {contacts.map((contact) => {
                      const isHost = host.contactId === contact.id;
                      const isSelectedGuest =
                        selectedParticipantContactIds.includes(contact.id);

                      return (
                        <div
                          key={contact.id}
                          className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-black/40 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <AvatarBubble
                              name={contact.name}
                              imageUrl={contact.imageUrl}
                            />
                            <div>
                              <div className="font-medium">{contact.name}</div>
                              <div className="text-sm text-zinc-400">
                                {contact.email || "No email on file"}
                              </div>
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
                      <p className="text-sm text-zinc-400">
                        Open drafts, send invitations, and monitor replies after
                        the meeting is live.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-zinc-800 bg-black/40 p-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            {(() => {
                              const deadlinePassed = hasGroupMeetDeadlinePassed(
                                request.deadlineAt,
                              );

                              return (
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="font-semibold text-white">
                                    {request.title}
                                  </div>
                                  <span
                                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getRequestStatusClassName(
                                      request.status,
                                    )}`}
                                  >
                                    {getRequestStatusLabel(request.status)}
                                  </span>
                                  {deadlinePassed &&
                                    request.status !== "closed" && (
                                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                                        Past deadline
                                      </span>
                                    )}
                                </div>
                              );
                            })()}
                            <div className="text-sm text-zinc-400 mt-1">
                              Month {request.targetMonth} • Deadline{" "}
                              {toReadableDateTime(
                                request.deadlineAt,
                                request.timezone,
                              )}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-3 text-xs text-zinc-400">
                              <span>
                                {request.participantCount} participants
                              </span>
                              <span>{request.responseCount} responded</span>
                              <span>{request.meetingDurationMinutes} min</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {request.status === "draft" && (
                              <button
                                type="button"
                                onClick={() => sendDraftInvites(request.id)}
                                disabled={sendingRequestId === request.id}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-3 py-2 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                              >
                                <Mail className="w-4 h-4" />
                                {sendingRequestId === request.id
                                  ? "Sending…"
                                  : "Send invitations"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openRequestModal(request.id)}
                              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                                selectedRequestId === request.id &&
                                requestModalOpen
                                  ? "border-[#E0FE10]/40 bg-[#E0FE10]/10 text-[#E0FE10]"
                                  : "border-zinc-800 hover:bg-zinc-900"
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
          </div>

          {requestModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 p-4 sm:p-6">
              <div className="mx-auto flex h-full max-w-[1500px] flex-col overflow-hidden rounded-[32px] border border-zinc-800 bg-[#090c11] shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Request detail
                    </div>
                    <h2 className="mt-2 text-3xl font-semibold text-white">
                      {selectedRequest?.title || "Loading request…"}
                    </h2>
                    {selectedRequest && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                          {selectedRequest.targetMonth}
                        </span>
                        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                          {selectedRequest.meetingDurationMinutes} min
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1.5 ${getRequestStatusClassName(
                            selectedRequest.status,
                          )}`}
                        >
                          {getRequestStatusLabel(selectedRequest.status)}
                        </span>
                        {hasGroupMeetDeadlinePassed(
                          selectedRequest.deadlineAt,
                        ) &&
                          selectedRequest.status !== "closed" && (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-100">
                              Past deadline
                            </span>
                          )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={closeRequestModal}
                    className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                  {requestModalMessage && (
                    <div
                      className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                        requestModalMessage.type === "success"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                          : "border-red-500/30 bg-red-500/10 text-red-100"
                      }`}
                    >
                      {requestModalMessage.text}
                    </div>
                  )}

                  {detailLoading && (
                    <div className="rounded-2xl border border-zinc-800 px-4 py-10 text-center text-sm text-zinc-400">
                      Loading request details…
                    </div>
                  )}

                  {!detailLoading && !selectedRequest && (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
                      Select a request to inspect the full scheduling view.
                    </div>
                  )}

                  {!detailLoading && selectedRequest && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="text-sm text-zinc-400">
                              Deadline{" "}
                              {toReadableDateTime(
                                selectedRequest.deadlineAt,
                                selectedRequest.timezone,
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                                {
                                  selectedRequest.analysis
                                    .respondedParticipantCount
                                }
                                /{selectedRequest.analysis.totalParticipants}{" "}
                                responded
                              </span>
                              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                                {
                                  selectedRequest.analysis.fullMatchCandidates
                                    .length
                                }{" "}
                                full-match windows
                              </span>
                              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                                {selectedRequest.analysis.bestCandidates.length}{" "}
                                ranked candidates
                              </span>
                              {hasGroupMeetDeadlinePassed(
                                selectedRequest.deadlineAt,
                              ) &&
                                selectedRequest.status !== "closed" && (
                                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-100">
                                    Deadline passed
                                  </span>
                                )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {selectedRequest.status === "draft" && (
                              <button
                                type="button"
                                onClick={() =>
                                  selectedRequestId &&
                                  sendDraftInvites(selectedRequestId)
                                }
                                disabled={
                                  sendingRequestId === selectedRequestId
                                }
                                className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                              >
                                <Mail className="w-4 h-4" />
                                {sendingRequestId === selectedRequestId
                                  ? "Sending…"
                                  : "Send invitations"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => copyAllLinks(selectedRequest)}
                              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-900"
                            >
                              <Copy className="w-4 h-4" />
                              Copy all links
                            </button>
                          </div>
                        </div>

                        {selectedRequest.status === "draft" && (
                          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                            This request is still a draft. Guests have not been
                            emailed yet, so nothing is live until you click
                            send.
                          </div>
                        )}

                        {selectedRequest.analysis.pendingParticipantNames
                          .length > 0 && (
                          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                            Waiting on:{" "}
                            {selectedRequest.analysis.pendingParticipantNames.join(
                              ", ",
                            )}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <h3 className="text-xl font-semibold">
                              Send preview email
                            </h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              Email yourself a real guest link so you can walk
                              through the recipient flow before you send the
                              full batch.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1.1fr_auto]">
                          <input
                            value={previewRecipientName}
                            onChange={(event) =>
                              setPreviewRecipientName(event.target.value)
                            }
                            className="rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                            placeholder="Preview recipient name"
                          />
                          <input
                            value={previewRecipientEmail}
                            onChange={(event) =>
                              setPreviewRecipientEmail(event.target.value)
                            }
                            className="rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                            placeholder="Preview recipient email"
                          />
                          <select
                            value={previewInviteToken}
                            onChange={(event) =>
                              setPreviewInviteToken(event.target.value)
                            }
                            className="rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                          >
                            <option value="">
                              Choose guest link to preview
                            </option>
                            {previewGuestInvites.map((invite) => (
                              <option key={invite.token} value={invite.token}>
                                {invite.name}
                                {invite.email ? ` • ${invite.email}` : ""}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={sendPreviewEmail}
                            disabled={previewSending}
                            className="rounded-xl bg-[#E0FE10] px-4 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                          >
                            {previewSending ? "Sending…" : "Send preview"}
                          </button>
                        </div>

                        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-4 text-sm text-zinc-400">
                          The preview email uses the selected participant’s real
                          scheduling link. If you submit availability through
                          it, that response will count for that guest on this
                          request.
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <h3 className="text-xl font-semibold">
                          Everyone who has entered availability
                        </h3>
                        <div className="mt-1 text-sm text-zinc-400">
                          These are the people currently contributing to the
                          overlap view.
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {respondedInvites.map((invite) => (
                            <div
                              key={invite.token}
                              className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3"
                            >
                              <AvatarBubble
                                name={invite.name}
                                imageUrl={invite.imageUrl}
                              />
                              <div>
                                <div className="font-medium">
                                  {invite.name}
                                  {invite.participantType === "host"
                                    ? " • Host"
                                    : ""}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {invite.availabilityCount} slot
                                  {invite.availabilityCount === 1 ? "" : "s"}
                                </div>
                              </div>
                            </div>
                          ))}

                          {!respondedInvites.length && (
                            <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                              No one has submitted availability yet.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-semibold">
                              Full availability calendar
                            </h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              Each date shows the people who have supplied
                              availability for that day. Click a day to inspect
                              the exact submitted times and choose a final
                              meeting block from that date.
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.18em] text-zinc-500">
                          {[
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                          ].map((day) => (
                            <div key={day} className="py-2">
                              {day}
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 grid grid-cols-7 gap-2">
                          {requestCalendarDays.map((day) => {
                            const dateKey = format(day, "yyyy-MM-dd");
                            const inTargetMonth = isSameMonth(
                              day,
                              parse(
                                `${selectedRequest.targetMonth}-01`,
                                "yyyy-MM-dd",
                                new Date(),
                              ),
                            );
                            const dayInvites =
                              resolveSelectedInvitesForDate(dateKey);

                            return (
                              <button
                                type="button"
                                key={dateKey}
                                onClick={() => {
                                  if (!inTargetMonth) return;
                                  setSelectedCalendarDate(dateKey);
                                  setCalendarDayModalDate(dateKey);
                                  setCalendarDayModalError(null);
                                }}
                                disabled={!inTargetMonth}
                                className={`min-h-[145px] rounded-2xl border p-3 text-left transition-colors ${
                                  inTargetMonth
                                    ? dayInvites.length
                                      ? "border-[#E0FE10]/30 bg-[#E0FE10]/6"
                                      : "border-zinc-800 bg-zinc-950/60"
                                    : "border-zinc-900 bg-zinc-950/30 text-zinc-700"
                                } ${
                                  inTargetMonth
                                    ? selectedCalendarDate === dateKey
                                      ? "ring-2 ring-[#E0FE10]/70"
                                      : "hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer"
                                    : "cursor-default"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm font-medium">
                                    {format(day, "d")}
                                  </div>
                                  {inTargetMonth && dayInvites.length > 0 && (
                                    <div className="rounded-full border border-zinc-800 bg-black px-2 py-1 text-[10px] text-zinc-300">
                                      {dayInvites.length}/
                                      {
                                        selectedRequest.analysis
                                          .totalParticipants
                                      }
                                    </div>
                                  )}
                                </div>

                                {inTargetMonth && dayInvites.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {dayInvites.slice(0, 6).map((invite) => (
                                      <AvatarBubble
                                        key={`${dateKey}-${invite.token}`}
                                        name={invite.name}
                                        imageUrl={invite.imageUrl}
                                        size="h-8 w-8"
                                      />
                                    ))}
                                    {dayInvites.length > 6 && (
                                      <div className="flex h-8 min-w-[32px] items-center justify-center rounded-full border border-zinc-800 bg-black px-2 text-xs text-zinc-300">
                                        +{dayInvites.length - 6}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {inTargetMonth && dayInvites.length > 0 && (
                                  <div className="mt-3 text-[11px] text-zinc-400">
                                    {dayInvites
                                      .map((invite) => invite.name)
                                      .join(", ")}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-xl font-semibold">
                              Request settings
                            </h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              Update the live request without rebuilding the
                              links. If you change the meeting length or
                              timezone, Group Meet clears the final choice and
                              calendar invite so you can recompute cleanly.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={saveRequestEdits}
                            disabled={savingEdits}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {savingEdits ? "Saving…" : "Save request changes"}
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                          <label className="block">
                            <span className="block text-sm text-zinc-300 mb-2">
                              Meeting title
                            </span>
                            <input
                              value={editTitle}
                              onChange={(event) =>
                                setEditTitle(event.target.value)
                              }
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                            />
                          </label>

                          <label className="block">
                            <span className="block text-sm text-zinc-300 mb-2">
                              Deadline
                            </span>
                            <input
                              type="datetime-local"
                              value={editDeadlineAt}
                              onChange={(event) =>
                                setEditDeadlineAt(event.target.value)
                              }
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                            />
                          </label>

                          <label className="block">
                            <span className="block text-sm text-zinc-300 mb-2">
                              Timezone
                            </span>
                            <input
                              value={editTimezone}
                              onChange={(event) =>
                                setEditTimezone(event.target.value)
                              }
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                              placeholder="America/New_York"
                            />
                          </label>

                          <label className="block">
                            <span className="block text-sm text-zinc-300 mb-2">
                              Meeting length
                            </span>
                            <select
                              value={editMeetingDurationMinutes}
                              onChange={(event) =>
                                setEditMeetingDurationMinutes(
                                  Number(event.target.value),
                                )
                              }
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

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-xl font-semibold">
                              AI recommendation
                            </h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              The AI summarizes the current overlap picture and
                              suggests a few host-ready options. The host still
                              chooses the final block.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={generateAiRecommendation}
                            disabled={
                              recommendLoading ||
                              detailLoading ||
                              !selectedRequest.analysis.bestCandidates.length
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                          >
                            <Sparkles
                              className={`w-4 h-4 ${recommendLoading ? "animate-pulse" : ""}`}
                            />
                            {recommendLoading
                              ? "Generating…"
                              : "Generate AI recommendation"}
                          </button>
                        </div>

                        {selectedRequest.aiRecommendation ? (
                          <div className="mt-4 space-y-4">
                            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-4">
                              <div className="text-sm text-zinc-200">
                                {selectedRequest.aiRecommendation.summary}
                              </div>
                              <div className="mt-2 text-xs text-zinc-500">
                                {selectedRequest.aiRecommendation.generatedAt
                                  ? `Generated ${toReadableDateTime(selectedRequest.aiRecommendation.generatedAt, selectedRequest.timezone)}`
                                  : "Generated just now"}
                                {selectedRequest.aiRecommendation.model
                                  ? ` • ${selectedRequest.aiRecommendation.model}`
                                  : ""}
                              </div>
                            </div>

                            {selectedRequest.aiRecommendation.caveats.length >
                              0 && (
                              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
                                <div className="text-sm font-medium text-amber-100 mb-2">
                                  Caveats
                                </div>
                                <div className="space-y-1 text-sm text-amber-50/90">
                                  {selectedRequest.aiRecommendation.caveats.map(
                                    (caveat, index) => (
                                      <div key={`caveat-${index}`}>
                                        • {caveat}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                            No AI recommendation yet.
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <h3 className="text-xl font-semibold mb-3">
                          Best candidate windows
                        </h3>
                        <div className="space-y-3">
                          {selectedRequest.analysis.bestCandidates.map(
                            (candidate, index) => (
                              <div
                                key={`${candidate.date}-${candidate.earliestStartMinutes}-${index}`}
                                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-4"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <div className="font-medium">
                                      #{index + 1} •{" "}
                                      {formatCandidateLabel(candidate)}
                                    </div>
                                    <div className="text-sm text-zinc-400 mt-1">
                                      {candidate.participantCount}/
                                      {candidate.totalParticipants} participants
                                      available
                                      {candidate.flexibilityMinutes > 0
                                        ? ` • start anytime from ${formatMinutesAsTime(candidate.earliestStartMinutes)} to ${formatMinutesAsTime(candidate.latestStartMinutes)}`
                                        : ""}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copyCandidateSummary(candidate)
                                      }
                                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900"
                                    >
                                      <Copy className="w-4 h-4" />
                                      Copy
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        finalizeCandidate(
                                          buildGroupMeetCandidateKey(
                                            candidate.date,
                                            candidate.suggestedStartMinutes,
                                          ),
                                        )
                                      }
                                      disabled={finalizeLoading}
                                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900 disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      Select final block
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {resolveSelectedInvitesForCandidate(
                                    candidate,
                                  ).map((invite) => (
                                    <div
                                      key={`${candidate.date}-${candidate.earliestStartMinutes}-${invite.token}`}
                                      className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs text-zinc-300"
                                    >
                                      <AvatarBubble
                                        name={invite.name}
                                        imageUrl={invite.imageUrl}
                                        size="h-6 w-6"
                                      />
                                      <span>{invite.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ),
                          )}

                          {!selectedRequest.analysis.bestCandidates.length && (
                            <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                              No candidate meeting windows yet. We either need
                              more responses or the current ranges do not
                              overlap for the selected duration.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-xl font-semibold">
                              Host final decision
                            </h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              Save the final block the host wants to move
                              forward with. This is the handoff point before
                              calendar invite automation.
                            </p>
                          </div>
                        </div>

                        <label className="block mt-4">
                          <span className="block text-sm text-zinc-300 mb-2">
                            Host note
                          </span>
                          <textarea
                            value={hostNoteDraft}
                            onChange={(event) =>
                              setHostNoteDraft(event.target.value)
                            }
                            rows={3}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-white"
                            placeholder="Optional note about why this block was chosen"
                          />
                        </label>

                        {selectedRequest.finalSelection ? (
                          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <div className="font-medium text-emerald-100">
                              Final block:{" "}
                              {formatMonthDate(
                                selectedRequest.finalSelection.date,
                              )}{" "}
                              •{" "}
                              {formatMinutesAsTime(
                                selectedRequest.finalSelection.startMinutes,
                              )}{" "}
                              -{" "}
                              {formatMinutesAsTime(
                                selectedRequest.finalSelection.endMinutes,
                              )}
                            </div>
                            <div className="text-sm text-emerald-50/90 mt-2">
                              Selected by{" "}
                              {getFinalSelectionDisplayEmail(selectedRequest)}{" "}
                              on{" "}
                              {toReadableDateTime(
                                selectedRequest.finalSelection.selectedAt,
                                selectedRequest.timezone,
                              )}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={scheduleCalendarInvite}
                                disabled={
                                  scheduleLoading ||
                                  !selectedRequest.calendarSetup.ready
                                }
                                className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                              >
                                <Calendar className="w-4 h-4" />
                                {scheduleLoading
                                  ? "Creating invite…"
                                  : selectedRequest.calendarInvite
                                    ? "Update Google Calendar invite"
                                    : "Create Google Calendar invite"}
                              </button>
                              {selectedRequest.calendarInvite?.htmlLink && (
                                <a
                                  href={
                                    buildGroupMeetCalendarEventOpenUrl(
                                      selectedRequest.calendarInvite,
                                    ) || selectedRequest.calendarInvite.htmlLink
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-900"
                                >
                                  <LinkIcon className="w-4 h-4" />
                                  Open event
                                </a>
                              )}
                              {selectedRequest.calendarInvite && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      sendFinalConfirmationEmail("preview")
                                    }
                                    disabled={confirmationPreviewSending}
                                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-900 disabled:opacity-50"
                                  >
                                    <Mail className="w-4 h-4" />
                                    {confirmationPreviewSending
                                      ? "Sending preview…"
                                      : "Preview confirmation email"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      sendFinalConfirmationEmail("live")
                                    }
                                    disabled={confirmationEmailSending}
                                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-50"
                                  >
                                    <Mail className="w-4 h-4" />
                                    {confirmationEmailSending
                                      ? "Sending confirmation…"
                                      : selectedRequest.finalConfirmationEmail
                                            ?.sentAt
                                        ? "Resend confirmation"
                                        : "Send confirmation email"}
                                  </button>
                                </>
                              )}
                            </div>
                            {selectedRequest.calendarInvite?.organizerEmail && (
                              <div className="mt-3 text-xs text-emerald-50/80">
                                Calendar event organizer:{" "}
                                {selectedRequest.calendarInvite.organizerEmail}
                              </div>
                            )}
                            {selectedRequest.finalConfirmationEmail?.sentAt && (
                              <div className="mt-2 text-xs text-emerald-50/80">
                                {getFinalConfirmationStatusLabel(
                                  selectedRequest,
                                )}
                              </div>
                            )}
                            {selectedRequest.finalReminderEmail?.sentAt && (
                              <div className="mt-1 text-xs text-emerald-50/70">
                                {getFinalReminderStatusLabel(selectedRequest)}
                              </div>
                            )}
                            {selectedRequest.finalConfirmationEmail
                              ?.previewSentAt &&
                              selectedRequest.finalConfirmationEmail
                                ?.previewRecipientEmail && (
                                <div className="mt-1 text-xs text-emerald-50/70">
                                  Preview last sent to{" "}
                                  {
                                    selectedRequest.finalConfirmationEmail
                                      .previewRecipientEmail
                                  }{" "}
                                  on{" "}
                                  {toReadableDateTime(
                                    selectedRequest.finalConfirmationEmail
                                      .previewSentAt,
                                    selectedRequest.timezone,
                                  )}
                                  .
                                </div>
                              )}
                            {!selectedRequest.calendarSetup.ready && (
                              <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                                {selectedRequest.calendarSetup.message ||
                                  "Google Calendar is not configured for this request yet."}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                            No final block selected yet.
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <h3 className="text-xl font-semibold mb-3">
                          Participant breakdown
                        </h3>
                        <div className="space-y-2">
                          {selectedRequest.invites.map((invite) => {
                            const inviteDelivery = getInviteDeliveryMeta(
                              invite,
                              selectedRequest.timezone,
                            );
                            const inviteActionLabel =
                              getInviteActionLabel(invite);

                            return (
                              <div
                                key={invite.token}
                                className="rounded-xl border border-zinc-800/70 bg-zinc-950/80 px-4 py-3"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <div className="flex items-center gap-3">
                                    <AvatarBubble
                                      name={invite.name}
                                      imageUrl={invite.imageUrl}
                                    />
                                    <div>
                                      <div className="font-medium">
                                        {invite.name}
                                        {invite.participantType === "host"
                                          ? " • Host"
                                          : ""}
                                      </div>
                                      <div className="text-xs text-zinc-500">
                                        {invite.email || "Manual link"} •{" "}
                                        {invite.respondedAt
                                          ? "Responded"
                                          : "Waiting"}{" "}
                                        • {invite.availabilityCount} slots •{" "}
                                        {inviteDelivery.detailText}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <div
                                      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs ${inviteDelivery.badgeClassName}`}
                                    >
                                      {inviteDelivery.badgeText}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copyText(
                                          invite.shareUrl,
                                          `Copied ${invite.name}'s link`,
                                        )
                                      }
                                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900"
                                    >
                                      <LinkIcon className="w-4 h-4" />
                                      Copy link
                                    </button>
                                    {invite.email &&
                                      invite.participantType !== "host" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openManualFlexModal(invite)
                                          }
                                          disabled={
                                            manualFlexLoading ||
                                            manualFlexSending
                                          }
                                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900 disabled:opacity-50"
                                        >
                                          <Sparkles className="w-4 h-4" />
                                          {manualFlexInvite?.token ===
                                            invite.token && manualFlexLoading
                                            ? "Loading flex…"
                                            : manualFlexInvite?.token ===
                                                  invite.token &&
                                                manualFlexSending
                                              ? "Sending flex…"
                                              : "Flex request"}
                                        </button>
                                      )}
                                    {invite.email &&
                                      invite.participantType !== "host" && (
                                        <button
                                          type="button"
                                          onClick={() => resendInvite(invite)}
                                          disabled={
                                            resendingInviteToken ===
                                            invite.token
                                          }
                                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900 disabled:opacity-50"
                                        >
                                          <Mail className="w-4 h-4" />
                                          {resendingInviteToken === invite.token
                                            ? "Sending…"
                                            : inviteActionLabel}
                                        </button>
                                      )}
                                    {invite.participantType !== "host" && (
                                      <button
                                        type="button"
                                        onClick={() => removeInvite(invite)}
                                        disabled={
                                          removingInviteToken === invite.token
                                        }
                                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/10 disabled:opacity-50"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        {removingInviteToken === invite.token
                                          ? "Removing…"
                                          : "Remove guest"}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {invite.availabilityEntries.map(
                                    (slot, slotIndex) => (
                                      <span
                                        key={`${invite.token}-${slot.date}-${slot.startMinutes}-${slotIndex}`}
                                        className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs text-zinc-300"
                                      >
                                        {formatMonthDate(slot.date)} •{" "}
                                        {formatMinutesAsTime(slot.startMinutes)}{" "}
                                        - {formatMinutesAsTime(slot.endMinutes)}
                                      </span>
                                    ),
                                  )}
                                  {!invite.availabilityEntries.length && (
                                    <span className="text-xs text-zinc-500">
                                      No availability submitted yet.
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {calendarDayModalDate && selectedRequest && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 sm:p-6">
                  <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-[#090c11] shadow-2xl">
                    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          Availability detail
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold text-white">
                          {formatMonthDate(calendarDayModalDate)}
                        </h3>
                        <div className="mt-2 text-sm text-zinc-400">
                          Review the submitted time ranges for this day and
                          choose a final meeting block right here.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={closeCalendarDayModal}
                        className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                      >
                        Close
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="text-sm font-medium text-white">
                                {calendarDayModalParticipants.length
                                  ? `${calendarDayModalParticipants.length} participant${calendarDayModalParticipants.length === 1 ? "" : "s"} added time on this day`
                                  : "No submitted availability on this day yet"}
                              </div>
                              <div className="mt-2 text-sm text-zinc-400">
                                {calendarDayModalCandidates.length
                                  ? `${calendarDayModalCandidates.length} candidate meeting window${calendarDayModalCandidates.length === 1 ? "" : "s"} can be selected from this date.`
                                  : "There are no ranked overlap windows on this date yet, but you can still inspect the submitted times below."}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-300">
                                {calendarDayModalParticipants.length}/
                                {selectedRequest.analysis.totalParticipants}{" "}
                                available
                              </span>
                              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-300">
                                {selectedRequest.calendarInvite
                                  ? "Will update invite"
                                  : "Will send invite"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {calendarDayModalError && (
                          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-100">
                            {calendarDayModalError}
                          </div>
                        )}

                        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <h4 className="text-lg font-semibold text-white">
                                Meeting windows you can choose right now
                              </h4>
                              <div className="mt-1 text-sm text-zinc-400">
                                Selecting one of these times will save the final
                                block and{" "}
                                {selectedRequest.calendarInvite
                                  ? "update"
                                  : "send"}{" "}
                                the Google Calendar invite immediately.
                              </div>
                            </div>
                            {!selectedRequest.calendarSetup.ready && (
                              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                                {selectedRequest.calendarSetup.message ||
                                  "Google Calendar setup is not ready for this request."}
                              </div>
                            )}
                          </div>

                          {calendarDayModalCandidates.length ? (
                            <div className="mt-4 space-y-3">
                              {calendarDayModalCandidates.map(
                                (candidate, index) => {
                                  const candidateKey =
                                    buildGroupMeetCandidateKey(
                                      candidate.date,
                                      candidate.suggestedStartMinutes,
                                    );
                                  const isSubmitting =
                                    calendarDayActionCandidateKey ===
                                    candidateKey;
                                  const isCurrentFinalSelection =
                                    selectedRequest.finalSelection
                                      ?.candidateKey === candidateKey;

                                  return (
                                    <div
                                      key={`${candidateKey}-${index}`}
                                      className={`rounded-2xl border p-4 ${
                                        isCurrentFinalSelection
                                          ? "border-emerald-500/30 bg-emerald-500/10"
                                          : "border-zinc-800 bg-zinc-950/80"
                                      }`}
                                    >
                                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                          <div className="font-medium text-white">
                                            {formatMinutesAsTime(
                                              candidate.suggestedStartMinutes,
                                            )}{" "}
                                            -{" "}
                                            {formatMinutesAsTime(
                                              candidate.suggestedEndMinutes,
                                            )}
                                          </div>
                                          <div className="mt-2 text-sm text-zinc-400">
                                            {candidate.participantCount}/
                                            {candidate.totalParticipants}{" "}
                                            participants available
                                            {candidate.flexibilityMinutes > 0
                                              ? ` • start anytime from ${formatMinutesAsTime(candidate.earliestStartMinutes)} to ${formatMinutesAsTime(candidate.latestStartMinutes)}`
                                              : ""}
                                          </div>
                                          {candidate.missingParticipantNames
                                            .length > 0 && (
                                            <div className="mt-2 text-xs text-zinc-500">
                                              Missing:{" "}
                                              {candidate.missingParticipantNames.join(
                                                ", ",
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                          {isCurrentFinalSelection && (
                                            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100">
                                              Current final block
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              finalizeCandidateAndScheduleInvite(
                                                candidateKey,
                                              )
                                            }
                                            disabled={
                                              isSubmitting ||
                                              !selectedRequest.calendarSetup
                                                .ready
                                            }
                                            className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                                          >
                                            <Calendar className="h-4 w-4" />
                                            {isSubmitting
                                              ? "Saving and sending…"
                                              : selectedRequest.calendarInvite
                                                ? "Choose time + update invite"
                                                : "Choose time + send invite"}
                                          </button>
                                        </div>
                                      </div>

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {resolveSelectedInvitesForCandidate(
                                          candidate,
                                        ).map((invite) => (
                                          <div
                                            key={`${candidateKey}-${invite.token}`}
                                            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs text-zinc-300"
                                          >
                                            <AvatarBubble
                                              name={invite.name}
                                              imageUrl={invite.imageUrl}
                                              size="h-6 w-6"
                                            />
                                            <span>{invite.name}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                              No ranked candidate meeting windows are available
                              on this date yet.
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
                          <h4 className="text-lg font-semibold text-white">
                            Submitted availability on this day
                          </h4>
                          <div className="mt-1 text-sm text-zinc-400">
                            These are the exact time ranges people entered for{" "}
                            {formatMonthDate(calendarDayModalDate)}.
                          </div>

                          {calendarDayModalParticipants.length ? (
                            <div className="mt-4 space-y-3">
                              {calendarDayModalParticipants.map((invite) => (
                                <div
                                  key={`${calendarDayModalDate}-${invite.token}`}
                                  className="rounded-2xl border border-zinc-800/80 bg-black/50 px-4 py-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <AvatarBubble
                                      name={invite.name}
                                      imageUrl={invite.imageUrl}
                                    />
                                    <div>
                                      <div className="font-medium text-white">
                                        {invite.name}
                                        {invite.participantType === "host"
                                          ? " • Host"
                                          : ""}
                                      </div>
                                      <div className="text-xs text-zinc-500">
                                        {invite.daySlots.length} time slot
                                        {invite.daySlots.length === 1
                                          ? ""
                                          : "s"}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {invite.daySlots.map((slot, slotIndex) => (
                                      <span
                                        key={`${invite.token}-${calendarDayModalDate}-${slot.startMinutes}-${slotIndex}`}
                                        className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300"
                                      >
                                        {formatMinutesAsTime(slot.startMinutes)}{" "}
                                        - {formatMinutesAsTime(slot.endMinutes)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                              No one has submitted availability on this day yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {manualFlexInvite && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4">
                  <div className="w-full max-w-3xl rounded-[28px] border border-zinc-800 bg-[#090c11] shadow-2xl">
                    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          Manual flex request
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold text-white">
                          {manualFlexInvite.name}
                        </h3>
                        <div className="mt-2 text-sm text-zinc-400">
                          Preview the exact times we’ll suggest before sending
                          the flex email.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={closeManualFlexModal}
                        className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                      >
                        Close
                      </button>
                    </div>

                    <div className="max-h-[80vh] overflow-y-auto px-6 py-6">
                      {manualFlexLoading && (
                        <div className="rounded-2xl border border-zinc-800 px-4 py-10 text-center text-sm text-zinc-400">
                          Loading flex suggestions…
                        </div>
                      )}

                      {!manualFlexLoading && manualFlexError && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-100">
                          {manualFlexError}
                        </div>
                      )}

                      {!manualFlexLoading &&
                        !manualFlexError &&
                        manualFlexPreview && (
                          <div className="space-y-5">
                            <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <div className="text-sm text-zinc-300">
                                    {manualFlexPreview.invite.email ||
                                      "No email on file"}
                                  </div>
                                  <div className="mt-2 text-sm text-zinc-400">
                                    {manualFlexPreview.detailText}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-300">
                                    {getManualFlexStrategyLabel(
                                      manualFlexPreview.strategy,
                                    )}
                                  </span>
                                  {manualFlexPreview.lastManualFlexSentAt && (
                                    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-300">
                                      Last sent{" "}
                                      {toReadableDateTime(
                                        manualFlexPreview.lastManualFlexSentAt,
                                        selectedRequest?.timezone ||
                                          "America/New_York",
                                      )}
                                    </span>
                                  )}
                                  <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-300">
                                    info@fitwithpulse.ai BCC
                                  </span>
                                </div>
                              </div>
                            </div>

                            {manualFlexPreview.options.length ? (
                              <div className="space-y-3">
                                {manualFlexPreview.options.map(
                                  (option, index) => (
                                    <div
                                      key={`${option.candidateKey}-${index}`}
                                      className="rounded-2xl border border-zinc-800 bg-black/40 p-4"
                                    >
                                      <div className="font-medium text-white">
                                        {formatMonthDate(option.date)} •{" "}
                                        {formatMinutesAsTime(
                                          option.startMinutes,
                                        )}{" "}
                                        -{" "}
                                        {formatMinutesAsTime(option.endMinutes)}
                                      </div>
                                      <div className="mt-2 text-sm text-zinc-400">
                                        Works for {option.participantCount} of{" "}
                                        {option.totalParticipants} participants
                                        right now.
                                      </div>
                                      {option.missingParticipantNames.length >
                                        0 && (
                                        <div className="mt-2 text-xs text-zinc-500">
                                          Still needed from:{" "}
                                          {option.missingParticipantNames.join(
                                            ", ",
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
                                There are no strong flex options to send for
                                this participant right now.
                              </div>
                            )}

                            <div className="flex flex-col-reverse gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-sm text-zinc-400">
                                The email will contain these one-click time
                                buttons and add the selected time directly to
                                the guest’s availability.
                              </div>
                              <button
                                type="button"
                                onClick={sendManualFlexEmail}
                                disabled={
                                  manualFlexSending ||
                                  !manualFlexPreview.options.length
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                              >
                                <Mail className="w-4 h-4" />
                                {manualFlexSending
                                  ? "Sending…"
                                  : "Send flex request"}
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default GroupMeetAdminPage;
