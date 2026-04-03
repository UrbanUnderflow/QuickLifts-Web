import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, addDoc, getDocs, orderBy, query, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Check, User, Mail, Loader2, X, Sparkles, Link, Eye, MousePointer, AlertTriangle, Clock, Send } from 'lucide-react';
import { convertFirestoreTimestamp, formatDate } from '../../utils/formatDate';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { showToast } from '../../redux/toastSlice';

type EmailStatus =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'soft_bounce'
  | 'hard_bounce'
  | 'spam'
  | 'unsubscribed'
  | 'blocked'
  | 'deferred'
  | 'error'
  | 'bounced';

interface EmailUpdateRecord {
  updatePeriodId: string;
  sentAt: any;
  status: EmailStatus;
  deliveredAt?: any;
  openedAt?: any;
  clickedAt?: any;
  openCount?: number;
  clickCount?: number;
  messageId?: string;
  clickedLink?: string | null;
  bounceType?: 'soft_bounce' | 'hard_bounce';
}

interface BusinessUpdate {
  id: string;
  label: string;
  url?: string;
  month?: string;
  highlights: string[];
  templateSubject?: string;
  templateBody?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  legacyOrder?: number;
}

interface FriendOfBusiness {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  titleOrCompany: string;
  notes: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  lastUpdatedBy?: string;
  emailDraftUpdatePeriodId?: string | null;
  emailDraftSubject?: string;
  emailDraftBody?: string;
  lastEmailSubject?: string;
  lastEmailBody?: string;
  lastEmailSentAt?: any;
  lastEmailMessageId?: string;
  // Email tracking fields (updated via Brevo webhook)
  emailStatus?: EmailStatus;
  lastEmailEvent?: string;
  lastEmailEventAt?: any;
  lastEmailDeliveredAt?: any;
  lastEmailOpenedAt?: any;
  lastEmailClickedAt?: any;
  lastEmailClickedLink?: string;
  emailOpenCount?: number;
  emailClickCount?: number;
  // Per-update tracking
  lastEmailUpdatePeriodId?: string; // Which update this email was for
  emailUpdates?: Record<string, EmailUpdateRecord>; // History by update period ID
}

const emptyFriend: FriendOfBusiness = {
  firstName: '',
  lastName: '',
  email: '',
  titleOrCompany: '',
  notes: ''
};

const legacyReviewPeriods: BusinessUpdate[] = [
  {
    id: 'jan-26',
    label: 'January 2026 Update',
    url: 'fitwithpulse.ai/review/jan-26',
    month: 'January',
    highlights: [
      'New year kickoff',
      'Q1 goals',
      'Product roadmap'
    ],
    legacyOrder: 0,
  },
  {
    id: 'year2025',
    label: 'Year 2025 Review',
    url: 'fitwithpulse.ai/review/year2025',
    month: 'December',
    highlights: [
      'Founder University graduate',
      'LAUNCH investment',
      '2K users',
      'AI Round Builder shipped'
    ],
    legacyOrder: 1,
  },
  {
    id: 'q4-25',
    label: 'Q4 2025',
    url: 'fitwithpulse.ai/review/q4-25',
    month: 'December',
    highlights: [
      'Graduated Founder University',
      'Incorporated as Delaware C-Corp',
      'AI Round Builder & Templates shipped'
    ],
    legacyOrder: 2,
  },
  {
    id: 'q3-25',
    label: 'Q3 2025',
    url: 'fitwithpulse.ai/review/q3-25',
    month: 'September',
    highlights: [
      'Product development milestone',
      'User growth',
      'Platform improvements'
    ],
    legacyOrder: 3,
  }
];

const parseHighlights = (value: string): string[] =>
  value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean);

const normalizeHighlights = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return parseHighlights(value);
  }
  return [];
};

const buildUpdateId = (label: string, existingIds: string[]) => {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `update-${Date.now()}`;

  let candidate = base;
  let suffix = 2;
  while (existingIds.includes(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const timestampToMs = (value: any): number => {
  const converted = convertFirestoreTimestamp(value);
  if (converted instanceof Date && !Number.isNaN(converted.getTime())) return converted.getTime();
  return 0;
};

const ensureAbsoluteUrl = (value?: string) => {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

const mergeBusinessUpdates = (remoteUpdates: BusinessUpdate[]) => {
  const byId = new Map(remoteUpdates.map(update => [update.id, update]));
  const mergedLegacy = legacyReviewPeriods.map((legacy, index) => ({
    ...legacy,
    ...byId.get(legacy.id),
    highlights: normalizeHighlights(byId.get(legacy.id)?.highlights ?? legacy.highlights),
    legacyOrder: index,
  }));

  const legacyIds = new Set(legacyReviewPeriods.map(update => update.id));
  const extras = remoteUpdates
    .filter(update => !legacyIds.has(update.id))
    .map((update, index) => ({
      ...update,
      highlights: normalizeHighlights(update.highlights),
      legacyOrder: legacyReviewPeriods.length + index,
    }));

  return [...mergedLegacy, ...extras].sort((a, b) => {
    const timeDiff = timestampToMs(b.updatedAt || b.createdAt) - timestampToMs(a.updatedAt || a.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return (a.legacyOrder ?? Number.MAX_SAFE_INTEGER) - (b.legacyOrder ?? Number.MAX_SAFE_INTEGER);
  });
};

// Email status display component
const EmailStatusBadge: React.FC<{ friend: FriendOfBusiness; selectedUpdateId?: string }> = ({ friend, selectedUpdateId }) => {
  const updateRecord = selectedUpdateId ? friend.emailUpdates?.[selectedUpdateId] : undefined;
  const selectedMatchesLatest = !!selectedUpdateId && friend.lastEmailUpdatePeriodId === selectedUpdateId;
  const scopedRecord = updateRecord || (selectedMatchesLatest
    ? {
        status: friend.emailStatus,
        sentAt: friend.lastEmailSentAt,
        openCount: friend.emailOpenCount,
        clickCount: friend.emailClickCount,
      }
    : undefined);
  
  const emailStatus = selectedUpdateId ? scopedRecord?.status : friend.emailStatus;
  const lastEmailSentAt = selectedUpdateId ? scopedRecord?.sentAt : friend.lastEmailSentAt;
  const emailOpenCount = selectedUpdateId ? scopedRecord?.openCount : friend.emailOpenCount;
  const emailClickCount = selectedUpdateId ? scopedRecord?.clickCount : friend.emailClickCount;
  
  // In an update view, only show statuses that belong to that update.
  if (!lastEmailSentAt && !emailStatus) {
    return <span className="text-zinc-500 text-xs">—</span>;
  }

  const getStatusConfig = () => {
    switch (emailStatus) {
      case 'clicked':
        return {
          icon: <MousePointer className="w-3 h-3" />,
          label: 'Clicked',
          bgColor: 'bg-purple-500/20',
          textColor: 'text-purple-400',
          borderColor: 'border-purple-500/30',
        };
      case 'opened':
        return {
          icon: <Eye className="w-3 h-3" />,
          label: 'Opened',
          bgColor: 'bg-green-500/20',
          textColor: 'text-green-400',
          borderColor: 'border-green-500/30',
        };
      case 'delivered':
        return {
          icon: <Check className="w-3 h-3" />,
          label: 'Delivered',
          bgColor: 'bg-blue-500/20',
          textColor: 'text-blue-400',
          borderColor: 'border-blue-500/30',
        };
      case 'soft_bounce':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Soft Bounce',
          bgColor: 'bg-yellow-500/20',
          textColor: 'text-yellow-400',
          borderColor: 'border-yellow-500/30',
        };
      case 'hard_bounce':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Hard Bounce',
          bgColor: 'bg-red-500/20',
          textColor: 'text-red-400',
          borderColor: 'border-red-500/30',
        };
      case 'bounced':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Bounced',
          bgColor: 'bg-red-500/20',
          textColor: 'text-red-400',
          borderColor: 'border-red-500/30',
        };
      case 'spam':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Spam',
          bgColor: 'bg-orange-500/20',
          textColor: 'text-orange-400',
          borderColor: 'border-orange-500/30',
        };
      case 'unsubscribed':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Unsubscribed',
          bgColor: 'bg-gray-500/20',
          textColor: 'text-gray-400',
          borderColor: 'border-gray-500/30',
        };
      case 'blocked':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Blocked',
          bgColor: 'bg-orange-500/20',
          textColor: 'text-orange-400',
          borderColor: 'border-orange-500/30',
        };
      case 'deferred':
        return {
          icon: <Clock className="w-3 h-3" />,
          label: 'Deferred',
          bgColor: 'bg-yellow-500/20',
          textColor: 'text-yellow-400',
          borderColor: 'border-yellow-500/30',
        };
      case 'error':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Error',
          bgColor: 'bg-red-500/20',
          textColor: 'text-red-400',
          borderColor: 'border-red-500/30',
        };
      case 'sent':
      default:
        return {
          icon: <Send className="w-3 h-3" />,
          label: 'Sent',
          bgColor: 'bg-zinc-500/20',
          textColor: 'text-zinc-400',
          borderColor: 'border-zinc-500/30',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
        {config.icon}
        {config.label}
      </span>
      {(emailOpenCount && emailOpenCount > 0) && (
        <span className="text-[10px] text-zinc-500">
          {emailOpenCount} open{emailOpenCount > 1 ? 's' : ''}
          {emailClickCount && emailClickCount > 0 ? `, ${emailClickCount} click${emailClickCount > 1 ? 's' : ''}` : ''}
        </span>
      )}
    </div>
  );
};

const FriendsOfBusinessPage: React.FC = () => {
  const [form, setForm] = useState<FriendOfBusiness>(emptyFriend);
  const [saving, setSaving] = useState(false);

  const [friends, setFriends] = useState<FriendOfBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const currentUser = useSelector((s: RootState) => s.user.currentUser);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<FriendOfBusiness | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState<FriendOfBusiness | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailFriend, setEmailFriend] = useState<FriendOfBusiness | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [updates, setUpdates] = useState<BusinessUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string>('');
  const [createUpdateOpen, setCreateUpdateOpen] = useState(false);
  const [creatingUpdate, setCreatingUpdate] = useState(false);
  const [newUpdateForm, setNewUpdateForm] = useState({
    label: '',
    month: '',
    url: '',
    highlights: '',
  });

  // Email template state
  const [emailTemplateSubject, setEmailTemplateSubject] = useState('');
  const [emailTemplateBody, setEmailTemplateBody] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);

  // Investor update generator state
  const [generatingUpdate, setGeneratingUpdate] = useState(false);
  
  // Email update period selection (for tagging emails)
  const [emailUpdatePeriod, setEmailUpdatePeriod] = useState<string>('');

  // Refs for text selection
  const templateBodyRef = React.useRef<HTMLTextAreaElement>(null);

  const dispatch = useDispatch();
  const [initialEmailDraft, setInitialEmailDraft] = useState<{ subject: string; body: string } | null>(null);
  const emailDraftWasOpen = useRef(false);
  const selectedUpdate = useMemo(
    () => updates.find(update => update.id === selectedUpdateId) ?? null,
    [updates, selectedUpdateId]
  );
  const templateLoading = updatesLoading;

  useEffect(() => {
    const fetchUpdates = async () => {
      setUpdatesLoading(true);
      try {
        const snap = await getDocs(collection(db, 'friends-business-updates'));
        const rows: BusinessUpdate[] = snap.docs.map(updateDoc => {
          const data = updateDoc.data() as any;
          return {
            id: updateDoc.id,
            label: data.label || updateDoc.id,
            url: data.url || '',
            month: data.month || '',
            highlights: normalizeHighlights(data.highlights),
            templateSubject: data.templateSubject || '',
            templateBody: data.templateBody || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy,
          };
        });
        setUpdates(mergeBusinessUpdates(rows));
      } catch (e) {
        console.error('Failed to load updates', e);
        setUpdates(mergeBusinessUpdates([]));
      } finally {
        setUpdatesLoading(false);
      }
    };
    fetchUpdates();
  }, []);

  useEffect(() => {
    if (!selectedUpdateId && updates.length > 0) {
      setSelectedUpdateId(updates[0].id);
      return;
    }
    if (selectedUpdateId && !updates.some(update => update.id === selectedUpdateId) && updates.length > 0) {
      setSelectedUpdateId(updates[0].id);
    }
  }, [updates, selectedUpdateId]);

  useEffect(() => {
    if (!selectedUpdate) {
      setEmailTemplateSubject('');
      setEmailTemplateBody('');
      return;
    }
    setEmailTemplateSubject(selectedUpdate.templateSubject || '');
    setEmailTemplateBody(selectedUpdate.templateBody || '');
  }, [selectedUpdate?.id, selectedUpdate?.templateSubject, selectedUpdate?.templateBody]);

  const saveTemplate = async () => {
    if (!selectedUpdate) {
      dispatch(showToast({ message: 'Select an update view first', type: 'error' }));
      return;
    }

    setTemplateSaving(true);
    try {
      const now = new Date();
      await setDoc(doc(db, 'friends-business-updates', selectedUpdate.id), {
        label: selectedUpdate.label,
        url: selectedUpdate.url || '',
        month: selectedUpdate.month || '',
        highlights: selectedUpdate.highlights || [],
        templateSubject: emailTemplateSubject,
        templateBody: emailTemplateBody,
        updatedAt: now,
        createdAt: selectedUpdate.createdAt || now,
        createdBy: selectedUpdate.createdBy || (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin'),
      }, { merge: true });

      setUpdates(prev => prev.map(update => update.id === selectedUpdate.id
        ? {
            ...update,
            templateSubject: emailTemplateSubject,
            templateBody: emailTemplateBody,
            updatedAt: now,
          }
        : update));
      dispatch(showToast({ message: `Template saved for ${selectedUpdate.label}`, type: 'success' }));
    } catch (e) {
      console.error('Save template failed', e);
      dispatch(showToast({ message: 'Failed to save template', type: 'error' }));
    } finally {
      setTemplateSaving(false);
    }
  };

  const createUpdate = async () => {
    if (!newUpdateForm.label.trim()) {
      dispatch(showToast({ message: 'Add a name for the update', type: 'error' }));
      return;
    }

    setCreatingUpdate(true);
    try {
      const now = new Date();
      const id = buildUpdateId(newUpdateForm.label, updates.map(update => update.id));
      const payload: BusinessUpdate = {
        id,
        label: newUpdateForm.label.trim(),
        month: newUpdateForm.month.trim(),
        url: newUpdateForm.url.trim(),
        highlights: parseHighlights(newUpdateForm.highlights),
        templateSubject: '',
        templateBody: '',
        createdAt: now,
        updatedAt: now,
        createdBy: (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string,
      };

      await setDoc(doc(db, 'friends-business-updates', id), {
        label: payload.label,
        month: payload.month,
        url: payload.url,
        highlights: payload.highlights,
        templateSubject: '',
        templateBody: '',
        createdAt: now,
        updatedAt: now,
        createdBy: payload.createdBy,
      });

      setUpdates(prev => mergeBusinessUpdates([...prev.filter(update => update.id !== id), payload]));
      setSelectedUpdateId(id);
      setCreateUpdateOpen(false);
      setNewUpdateForm({ label: '', month: '', url: '', highlights: '' });
      dispatch(showToast({ message: `${payload.label} added`, type: 'success' }));
    } catch (e) {
      console.error('Create update failed', e);
      dispatch(showToast({ message: 'Failed to create update', type: 'error' }));
    } finally {
      setCreatingUpdate(false);
    }
  };

  useEffect(() => {
    if (emailOpen && emailFriend && !emailDraftWasOpen.current) {
      setInitialEmailDraft({ subject: emailSubject, body: emailBody });
    }
    emailDraftWasOpen.current = emailOpen;
  }, [emailOpen, emailFriend, emailSubject, emailBody]);

  const emailDirty = !!initialEmailDraft && (
    initialEmailDraft.subject !== emailSubject ||
    initialEmailDraft.body !== emailBody
  );

  const isQuickAddDirty = useMemo(() => {
    try { return JSON.stringify(form) !== JSON.stringify(emptyFriend); }
    catch { return false; }
  }, [form]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Progress will be lost.';
    };
    if (isQuickAddDirty || (emailOpen && emailDirty)) {
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [isQuickAddDirty, emailOpen, emailDirty]);

  const requestCloseEmail = async () => {
    if (emailDirty) {
      const discard = window.confirm('You have unsaved changes. Click OK to discard and close, or Cancel to keep editing.');
      if (!discard) return;
    }
    setEmailOpen(false);
  };

  const filtered = useMemo(() => {
    let rows = friends;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.firstName || '').toLowerCase().includes(q) ||
        (r.lastName || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.titleOrCompany || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [friends, search]);

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const qy = query(collection(db, 'friends-of-business'), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(qy);
      const rows: FriendOfBusiness[] = [];
      snap.forEach(d => {
        const data = d.data() as any;
        rows.push({ id: d.id, ...(data as FriendOfBusiness) });
      });
      setFriends(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  // Replace template placeholders with actual values
  const personalizeEmail = (template: string, friend: FriendOfBusiness): string => {
    if (!template) return '';
    const fullName = `${friend.firstName || ''} ${friend.lastName || ''}`.trim() || 'there';
    return template
      .replace(/\{\{name\}\}/g, fullName)
      .replace(/\{\{firstName\}\}/g, friend.firstName || 'there')
      .replace(/\{\{lastName\}\}/g, friend.lastName || '')
      .replace(/\{\{email\}\}/g, friend.email || '')
      .replace(/\{\{titleOrCompany\}\}/g, friend.titleOrCompany || '');
  };

  const generateEmail = (friend: FriendOfBusiness): { subject: string; body: string } => {
    const subject = personalizeEmail(emailTemplateSubject, friend);
    const body = personalizeEmail(emailTemplateBody, friend);
    return { subject, body };
  };

  const openEmail = (row: FriendOfBusiness) => {
    setEmailFriend(row);
    const savedSubject = row.emailDraftSubject;
    const savedBody = row.emailDraftBody;
    const draftMatchesCurrentUpdate =
      !selectedUpdateId || !row.emailDraftUpdatePeriodId || row.emailDraftUpdatePeriodId === selectedUpdateId;

    if (savedSubject && savedBody && draftMatchesCurrentUpdate) {
      setEmailSubject(savedSubject);
      setEmailBody(savedBody);
    } else {
      const { subject, body } = generateEmail(row);
      setEmailSubject(subject);
      setEmailBody(body);
    }
    setEmailUpdatePeriod(selectedUpdateId || '');
    setEmailOpen(true);
  };

  const saveEmailDraft = async () => {
    if (!emailFriend?.id) return;
    setSavingDraft(true);
    try {
      const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
      const now = new Date();
      await updateDoc(doc(db, 'friends-of-business', emailFriend.id), {
        emailDraftSubject: emailSubject,
        emailDraftBody: emailBody,
        emailDraftUpdatePeriodId: emailUpdatePeriod || null,
        updatedAt: now,
        lastUpdatedBy: actor
      } as any);
      setFriends(prev => prev.map(p => p.id === emailFriend.id
        ? {
            ...p,
            emailDraftSubject: emailSubject,
            emailDraftBody: emailBody,
            emailDraftUpdatePeriodId: emailUpdatePeriod || null,
            lastUpdatedBy: actor,
            updatedAt: now,
          }
        : p));
      setDraftSavedAt(now);
      setInitialEmailDraft({ subject: emailSubject, body: emailBody });
      setTimeout(() => setDraftSavedAt(null), 2000);
    } catch (e) {
      console.error('Save draft failed', e);
      alert('Failed to save draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const sendEmail = async () => {
    if (!emailFriend?.email) return;
    setEmailSending(true);
    try {
      const res = await fetch('/.netlify/functions/send-friend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: { email: emailFriend.email, name: `${emailFriend.firstName || ''} ${emailFriend.lastName || ''}`.trim() || emailFriend.email },
          subject: emailSubject,
          textContent: emailBody,
          friendId: emailFriend.id,
          updatePeriodId: emailUpdatePeriod || null
        })
      });
      const raw = await res.text();
      const json = (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })();
      if (!json) throw new Error('Failed to send (invalid server response)');
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to send');
      if (emailFriend.id) {
        const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
        const now = new Date();
        
        const updateData: any = {
          lastEmailSubject: emailSubject,
          lastEmailBody: emailBody,
          lastEmailSentAt: now,
          lastEmailMessageId: json.messageId || null,
          emailStatus: 'sent',
          emailOpenCount: 0,
          emailClickCount: 0,
          updatedAt: now,
          lastUpdatedBy: actor
        };
        
        if (emailUpdatePeriod) {
          updateData.lastEmailUpdatePeriodId = emailUpdatePeriod;
          updateData[`emailUpdates.${emailUpdatePeriod}`] = {
            updatePeriodId: emailUpdatePeriod,
            sentAt: now,
            status: 'sent',
            openCount: 0,
            clickCount: 0,
            messageId: json.messageId || null
          };
        }
        
        await updateDoc(doc(db, 'friends-of-business', emailFriend.id), updateData);
        
        setFriends(prev => prev.map(p => {
          if (p.id !== emailFriend.id) return p;
          const updated = { 
            ...p, 
            updatedAt: now, 
            lastUpdatedBy: actor,
            emailStatus: 'sent' as const,
            lastEmailSentAt: now,
            emailOpenCount: 0,
            emailClickCount: 0,
            lastEmailUpdatePeriodId: emailUpdatePeriod || p.lastEmailUpdatePeriodId
          };
          if (emailUpdatePeriod) {
            updated.emailUpdates = {
              ...p.emailUpdates,
              [emailUpdatePeriod]: {
                updatePeriodId: emailUpdatePeriod,
                sentAt: now,
                status: 'sent',
                openCount: 0,
                clickCount: 0,
                messageId: json.messageId || null
              }
            };
          }
          return updated;
        }));
      }
      const periodLabel = emailUpdatePeriod ? ` (${updates.find(update => update.id === emailUpdatePeriod)?.label})` : '';
      dispatch(showToast({ message: `Email sent successfully${periodLabel}`, type: 'success' }));
      setEmailOpen(false);
    } catch (e) {
      console.error('Send email failed', e);
      dispatch(showToast({ message: 'Failed to send email. Please try again.', type: 'error' }));
    } finally {
      setEmailSending(false);
    }
  };

  const scheduleEmail = async () => {
    if (!emailFriend?.email) return;
    if (!scheduleDate || !scheduleTime) { alert('Choose a date and time'); return; }
    const [hh, mm] = scheduleTime.split(':');
    const when = new Date(scheduleDate + 'T' + (hh || '00') + ':' + (mm || '00') + ':00');
    if (isNaN(when.getTime())) { alert('Invalid schedule time'); return; }
    setEmailSending(true);
    try {
      const res = await fetch('/.netlify/functions/send-friend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: { email: emailFriend.email, name: `${emailFriend.firstName || ''} ${emailFriend.lastName || ''}`.trim() || emailFriend.email },
          subject: emailSubject,
          textContent: emailBody,
          scheduledAt: when.toISOString(),
          friendId: emailFriend.id,
          updatePeriodId: emailUpdatePeriod || null
        })
      });
      const raw = await res.text();
      const json = (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })();
      if (!json) throw new Error('Failed to schedule (invalid server response)');
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to schedule');
      const periodLabel = emailUpdatePeriod ? ` (${updates.find(update => update.id === emailUpdatePeriod)?.label})` : '';
      dispatch(showToast({ message: `Email scheduled successfully${periodLabel}`, type: 'success' }));
      setEmailOpen(false);
      setScheduleOpen(false);
    } catch (e) {
      console.error('Schedule email failed', e);
      dispatch(showToast({ message: 'Failed to schedule email. Please try again.', type: 'error' }));
    } finally {
      setEmailSending(false);
    }
  };

  const saveFriend = async () => {
    setSaving(true);
    try {
      const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
      const payload = {
        ...form,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: actor,
        lastUpdatedBy: actor
      } as FriendOfBusiness;
      await addDoc(collection(db, 'friends-of-business'), payload as any);
      setForm(emptyFriend);
      await fetchFriends();
      dispatch(showToast({ message: 'Friend added successfully', type: 'success' }));
    } catch (e) {
      console.error('Save friend failed', e);
      dispatch(showToast({ message: 'Failed to save friend', type: 'error' }));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = (row: FriendOfBusiness) => {
    setEditing(row);
    setDetailOpen(true);
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    const { id, ...rest } = editing;
    const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
    await updateDoc(doc(db, 'friends-of-business', id), {
      ...rest,
      updatedAt: new Date(),
      lastUpdatedBy: actor
    } as any);
    setFriends(prev => prev.map(p => (p.id === id ? { ...p, ...rest, lastUpdatedBy: actor, updatedAt: new Date() } : p)));
    setDetailOpen(false);
    dispatch(showToast({ message: 'Friend updated successfully', type: 'success' }));
  };

  const openNotes = (row: FriendOfBusiness) => {
    setNotesEditing(row);
    setNotesOpen(true);
  };

  const saveNotes = async () => {
    if (!notesEditing?.id) return;
    const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
    await updateDoc(doc(db, 'friends-of-business', notesEditing.id), {
      notes: notesEditing.notes || '',
      updatedAt: new Date(),
      lastUpdatedBy: actor
    });
    setFriends(prev => prev.map(p => (p.id === notesEditing.id ? { ...p, notes: notesEditing.notes, lastUpdatedBy: actor, updatedAt: new Date() } : p)));
    setNotesOpen(false);
    dispatch(showToast({ message: 'Notes saved successfully', type: 'success' }));
  };

  const deleteFriend = async (friend: FriendOfBusiness) => {
    if (!friend.id) return;
    const fullName = `${friend.firstName || ''} ${friend.lastName || ''}`.trim() || 'this friend';
    const confirmed = window.confirm(`Are you sure you want to delete ${fullName}?`);
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'friends-of-business', friend.id));
      setFriends(prev => prev.filter(p => p.id !== friend.id));
      dispatch(showToast({ message: 'Friend deleted successfully', type: 'success' }));
    } catch (e) {
      console.error('Delete friend failed', e);
      dispatch(showToast({ message: 'Failed to delete friend', type: 'error' }));
    }
  };

  const generateInvestorUpdate = () => {
    if (!selectedUpdate) {
      dispatch(showToast({ message: 'Select an update before generating a template', type: 'error' }));
      return;
    }

    const monthLabel = selectedUpdate.month?.trim() || 'Investor';
    const reviewUrl = ensureAbsoluteUrl(selectedUpdate.url);
    const highlightsLine = selectedUpdate.highlights.length
      ? `Highlights: ${selectedUpdate.highlights.join(', ')}.`
      : 'Highlights: Product progress, momentum, and next milestones.';
    const viewLine = reviewUrl ? `View here: ${reviewUrl}` : '';

    const subject = `Pulse ${monthLabel} Update – ${selectedUpdate.label}`;
    const body = `Hi {{firstName}},

Our ${selectedUpdate.label.toLowerCase()} is live with traction, product progress, and what is coming next.

${viewLine}

${highlightsLine}

Best,
Tremaine`.replace(/\n{3,}/g, '\n\n');

    setEmailTemplateSubject(subject);
    setEmailTemplateBody(body);
    setGeneratingUpdate(true);
    
    dispatch(showToast({ 
      message: `Generated investor update for ${selectedUpdate.label}`, 
      type: 'success' 
    }));
    
    setTimeout(() => setGeneratingUpdate(false), 2000);
  };

  const makeHyperlink = () => {
    const textarea = templateBodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = emailTemplateBody.substring(start, end);

    if (!selectedText) {
      alert('Please select text first');
      return;
    }

    const url = prompt('Enter URL (e.g., https://fitwithpulse.ai/review/year2025):');
    if (!url) return;

    // Create HTML anchor tag - text will be rendered as link in the preview
    const htmlLink = `<a href="${url}">${selectedText}</a>`;
    
    // Replace selected text with link
    const newBody = emailTemplateBody.substring(0, start) + htmlLink + emailTemplateBody.substring(end);
    setEmailTemplateBody(newBody);

    // Show feedback
    dispatch(showToast({ 
      message: 'Hyperlink created', 
      type: 'success' 
    }));
  };

  // Render HTML content with proper link styling
  const renderEmailContent = (content: string) => {
    return content.replace(
      /<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g,
      '<a href="$1" style="color: #3B82F6; text-decoration: underline;">$2</a>'
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Friends of the Business | Admin</title>
      </Head>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Friends of the Business</h1>
            <p className="text-zinc-400">Manage friends and send personalized emails.</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div>
                  <h2 className="text-xl font-semibold">Update View</h2>
                  <p className="text-sm text-zinc-400">
                    Pick the update you want to work in. Template editing, delivery status, and email tracking all follow this selection.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-2 block">Current Update</label>
                    <select
                      className="w-full sm:w-80 bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-700"
                      value={selectedUpdateId}
                      onChange={e => setSelectedUpdateId(e.target.value)}
                      disabled={updatesLoading || updates.length === 0}
                    >
                      {updates.length === 0 ? (
                        <option value="">No updates yet</option>
                      ) : (
                        updates.map(update => (
                          <option key={update.id} value={update.id}>
                            {update.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => setCreateUpdateOpen(true)}
                      className="inline-flex items-center gap-2 bg-[#E0FE10] text-black font-semibold px-4 py-2 rounded-lg hover:bg-lime-400"
                    >
                      <Check className="w-4 h-4" /> New Update
                    </button>
                  </div>
                </div>
              </div>

              {selectedUpdate && (
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 min-w-[280px]">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500 mb-2">Current View</div>
                  <div className="text-lg font-semibold text-white">{selectedUpdate.label}</div>
                  <div className="text-sm text-zinc-400 mt-1">
                    {selectedUpdate.month || 'No month set'}
                    {selectedUpdate.url ? ` • ${selectedUpdate.url}` : ''}
                  </div>
                  <div className="text-xs text-zinc-500 mt-3">
                    {selectedUpdate.highlights.length > 0
                      ? selectedUpdate.highlights.join(' • ')
                      : 'No highlights added yet'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Investor Update Generator */}
          <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-6 mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> Investor Update Generator
            </h2>
            <p className="text-sm text-zinc-300 mb-4">
              Generate the working email template for the selected update view.
            </p>
            
            {selectedUpdate ? (
              <div className="space-y-4">
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                  <h4 className="text-sm font-semibold text-white mb-2">Preview</h4>
                  <div className="text-sm text-zinc-300 space-y-2">
                    <p><strong>Update:</strong> {selectedUpdate.label}</p>
                    <p><strong>Subject:</strong> Pulse {selectedUpdate.month || 'Investor'} Update – {selectedUpdate.label}</p>
                    <p className="text-xs text-zinc-400 mt-2">
                      <strong>Body:</strong><br/>
                      Our {selectedUpdate.label.toLowerCase()} is live with traction, product progress, and what is coming next.<br/>
                      {selectedUpdate.url ? `View here: ${ensureAbsoluteUrl(selectedUpdate.url)}\n` : ''}
                      Highlights: {selectedUpdate.highlights.length > 0 ? selectedUpdate.highlights.join(', ') : 'Product progress, momentum, and next milestones'}.
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={generateInvestorUpdate}
                    disabled={!selectedUpdate || generatingUpdate}
                    className="inline-flex items-center gap-2 bg-purple-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingUpdate ? (
                      <>
                        <Check className="w-4 h-4" />
                        Generated!
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Template for This Update
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-400">Create or select an update to generate its template.</div>
            )}
          </div>

          {/* Email Template Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#E0FE10]" /> Email Template
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              {selectedUpdate
                ? `This template is attached to ${selectedUpdate.label}. Use placeholders: {{name}}, {{firstName}}, {{lastName}}, {{email}}, {{titleOrCompany}}`
                : 'Select an update to attach and edit its template.'}
            </p>
            {templateLoading ? (
              <div className="text-zinc-400">Loading template...</div>
            ) : !selectedUpdate ? (
              <div className="text-zinc-400">No update selected.</div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Subject Template</label>
                    <input
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2"
                      placeholder="e.g., Hello {{name}}, let's connect!"
                      value={emailTemplateSubject}
                      onChange={e => setEmailTemplateSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-zinc-400 block">Body Template</label>
                      <button
                        onClick={makeHyperlink}
                        className="inline-flex items-center gap-1.5 text-xs bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 px-2.5 py-1 rounded transition-colors"
                      >
                        <Link className="w-3.5 h-3.5" />
                        Make Hyperlink
                      </button>
                    </div>
                    <div className="relative">
                      <textarea
                        ref={templateBodyRef}
                        className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-48 resize-y font-mono text-sm"
                        placeholder="Hi {{firstName}},&#10;&#10;This is a template email...&#10;&#10;Best,&#10;Tremaine"
                        value={emailTemplateBody}
                        onChange={e => setEmailTemplateBody(e.target.value)}
                      />
                    </div>
                    {emailTemplateBody && emailTemplateBody.includes('<a href=') && (
                      <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <p className="text-xs text-zinc-400 mb-2 font-semibold">Preview:</p>
                        <div 
                          className="text-sm text-white whitespace-pre-wrap"
                          style={{ lineHeight: '1.6' }}
                          dangerouslySetInnerHTML={{ __html: renderEmailContent(emailTemplateBody) }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-zinc-500 mt-2">
                      Tip: Select text, then click "Make Hyperlink" to add a clickable link
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={saveTemplate}
                    disabled={templateSaving}
                    className="inline-flex items-center gap-2 bg-[#E0FE10] text-black font-semibold px-5 py-2 rounded-lg hover:bg-lime-400 disabled:opacity-50"
                  >
                    {templateSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Check className="w-4 h-4" /> Save Template
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Quick Add Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-[#E0FE10]" /> Add Friend
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                className="bg-zinc-800 rounded-lg px-3 py-2"
                placeholder="First Name"
                value={form.firstName}
                onChange={e => setForm({ ...form, firstName: e.target.value })}
              />
              <input
                className="bg-zinc-800 rounded-lg px-3 py-2"
                placeholder="Last Name"
                value={form.lastName}
                onChange={e => setForm({ ...form, lastName: e.target.value })}
              />
              <input
                className="bg-zinc-800 rounded-lg px-3 py-2"
                placeholder="Email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="bg-zinc-800 rounded-lg px-3 py-2"
                placeholder="Title or Company"
                value={form.titleOrCompany}
                onChange={e => setForm({ ...form, titleOrCompany: e.target.value })}
              />
              <textarea
                className="bg-zinc-800 rounded-lg px-3 py-3 md:col-span-2 h-32 resize-y"
                placeholder="Notes"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={5}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={saveFriend}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-[#E0FE10] text-black font-semibold px-5 py-2 rounded-lg hover:bg-lime-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" /> Save Friend
              </button>
            </div>
          </div>

          {/* Search and Update View */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <input
              placeholder="Search name, email, title..."
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full max-w-md"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-400 whitespace-nowrap">Showing Update:</label>
              <select
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm min-w-[200px]"
                value={selectedUpdateId}
                onChange={e => setSelectedUpdateId(e.target.value)}
                disabled={updatesLoading || updates.length === 0}
              >
                {updates.map(update => (
                  <option key={update.id} value={update.id}>
                    {update.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setCreateUpdateOpen(true)}
                className="text-xs text-zinc-300 hover:text-white px-3 py-2 rounded bg-zinc-800 border border-zinc-700"
              >
                New Update
              </button>
            </div>
          </div>
          
          {/* View indicator */}
          {selectedUpdate && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300">
                Viewing delivery status for: <strong>{selectedUpdate.label}</strong>
              </span>
            </div>
          )}

          {/* Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                  <tr className="text-zinc-400 border-b border-zinc-800">
                  <th className="text-left p-3">First Name</th>
                  <th className="text-left p-3">Last Name</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Title/Company</th>
                  <th className="text-left p-3">Notes</th>
                  <th className="text-left p-3">Email Status</th>
                  <th className="text-left p-3">Created By</th>
                  <th className="text-left p-3">Updated By</th>
                  <th className="text-left p-3">Updated</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="p-4 text-zinc-400" colSpan={10}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td className="p-4 text-zinc-400" colSpan={10}>
                      No friends found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map(row => {
                    const updated = convertFirestoreTimestamp(row.updatedAt as any);
                    return (
                      <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                        <td className="p-3 font-medium text-white">{row.firstName}</td>
                        <td className="p-3 text-zinc-300">{row.lastName}</td>
                        <td className="p-3 text-zinc-300">{row.email}</td>
                        <td className="p-3 text-zinc-300">{row.titleOrCompany}</td>
                        <td className="p-3 text-zinc-300">
                          {row.notes ? (
                            <button
                              onClick={() => openNotes(row)}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
                            >
                              Has notes
                            </button>
                          ) : (
                            <span className="text-zinc-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <EmailStatusBadge friend={row} selectedUpdateId={selectedUpdateId} />
                        </td>
                        <td className="p-3 text-zinc-300">{row.createdBy || '—'}</td>
                        <td className="p-3 text-zinc-300">{row.lastUpdatedBy || '—'}</td>
                        <td className="p-3 text-zinc-400">{formatDate(updated)}</td>
                        <td className="p-3 flex items-center gap-2">
                          <button
                            onClick={() => openDetail(row)}
                            className="px-3 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                          >
                            View
                          </button>
                          <button
                            onClick={() => openEmail(row)}
                            className="px-3 py-1 rounded-md bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 flex items-center gap-1"
                          >
                            <Mail className="w-4 h-4" /> Email
                          </button>
                          <button
                            onClick={() => deleteFriend(row)}
                            className="px-3 py-1 rounded-md bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {createUpdateOpen && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setCreateUpdateOpen(false)}
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Add Update View</h3>
                  <button className="text-zinc-400 hover:text-white" onClick={() => setCreateUpdateOpen(false)}>
                    ✕
                  </button>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs text-zinc-400 mb-1 block">Update Name</label>
                    <input
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2"
                      placeholder="Q1 Update 2026"
                      value={newUpdateForm.label}
                      onChange={e => setNewUpdateForm(prev => ({ ...prev, label: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Month / Period Label</label>
                    <input
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2"
                      placeholder="March"
                      value={newUpdateForm.month}
                      onChange={e => setNewUpdateForm(prev => ({ ...prev, month: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Review URL</label>
                    <input
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2"
                      placeholder="fitwithpulse.ai/review/q1-2026"
                      value={newUpdateForm.url}
                      onChange={e => setNewUpdateForm(prev => ({ ...prev, url: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-zinc-400 mb-1 block">Highlights</label>
                    <textarea
                      className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-32 resize-y"
                      placeholder={'One highlight per line\nOr separate with commas'}
                      value={newUpdateForm.highlights}
                      onChange={e => setNewUpdateForm(prev => ({ ...prev, highlights: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
                  <button
                    className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300"
                    onClick={() => setCreateUpdateOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400 inline-flex items-center gap-2 disabled:opacity-60"
                    onClick={createUpdate}
                    disabled={creatingUpdate}
                  >
                    {creatingUpdate && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Update
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Detail/Edit Modal */}
          {detailOpen && editing && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setDetailOpen(false)}
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Edit Friend</h3>
                  <button className="text-zinc-400 hover:text-white" onClick={() => setDetailOpen(false)}>
                    ✕
                  </button>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    className="bg-zinc-800 rounded-lg px-3 py-2"
                    placeholder="First Name"
                    value={editing.firstName}
                    onChange={e => setEditing({ ...editing, firstName: e.target.value })}
                  />
                  <input
                    className="bg-zinc-800 rounded-lg px-3 py-2"
                    placeholder="Last Name"
                    value={editing.lastName}
                    onChange={e => setEditing({ ...editing, lastName: e.target.value })}
                  />
                  <input
                    className="bg-zinc-800 rounded-lg px-3 py-2"
                    placeholder="Email"
                    value={editing.email}
                    onChange={e => setEditing({ ...editing, email: e.target.value })}
                  />
                  <input
                    className="bg-zinc-800 rounded-lg px-3 py-2 md:col-span-2"
                    placeholder="Title or Company"
                    value={editing.titleOrCompany}
                    onChange={e => setEditing({ ...editing, titleOrCompany: e.target.value })}
                  />
                  <textarea
                    className="bg-zinc-800 rounded-lg px-3 py-3 md:col-span-2 h-32 resize-y"
                    placeholder="Notes"
                    value={editing.notes}
                    onChange={e => setEditing({ ...editing, notes: e.target.value })}
                  />
                </div>
                <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
                  <button
                    className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300"
                    onClick={() => setDetailOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400"
                    onClick={saveEdit}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Generation & Send Modal */}
          {emailOpen && emailFriend && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Email {`${emailFriend.firstName || ''} ${emailFriend.lastName || ''}`.trim() || emailFriend.email}</h3>
                  <button className="text-zinc-400 hover:text-white" onClick={requestCloseEmail}>
                    ✕
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400">From</label>
                      <input className="w-full bg-zinc-800 rounded-lg px-3 py-2" value="tre@fitwithpulse.ai" readOnly />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400">To</label>
                      <input
                        className="w-full bg-zinc-800 rounded-lg px-3 py-2"
                        value={(() => {
                          const fullName = `${emailFriend.firstName || ''} ${emailFriend.lastName || ''}`.trim() || emailFriend.email;
                          return `${fullName} <${emailFriend.email}>`;
                        })()}
                        readOnly
                      />
                    </div>
                  </div>
                  
                  {/* Update Period Tag */}
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <label className="text-xs text-zinc-400 mb-2 block">Track this email under an update</label>
                    <select
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                      value={emailUpdatePeriod}
                      onChange={e => setEmailUpdatePeriod(e.target.value)}
                    >
                      <option value="">No tag (general email)</option>
                      {updates.map(update => (
                        <option key={update.id} value={update.id}>
                          {update.label}
                        </option>
                      ))}
                    </select>
                    {emailUpdatePeriod && (
                      <p className="text-xs text-green-400 mt-2">
                        ✓ This email will be tracked under "{updates.find(update => update.id === emailUpdatePeriod)?.label}"
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-xs text-zinc-400">Subject</label>
                    <input
                      className="w-full bg-zinc-800 rounded-lg px-3 py-2"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Body</label>
                    <textarea
                      className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-72 resize-y"
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                    />
                  </div>
                </div>
                <div className="p-4 border-t border-zinc-800 flex justify-between gap-3">
                  <div className="text-xs text-zinc-500">
                    {draftSavedAt ? <span className="text-green-400">Draft saved</span> : 'This email will be sent via Brevo.'}
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300"
                      onClick={() => setScheduleOpen(true)}
                    >
                      Schedule
                    </button>
                    <button
                      disabled={savingDraft}
                      className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 disabled:opacity-60"
                      onClick={saveEmailDraft}
                    >
                      {savingDraft ? 'Saving…' : draftSavedAt ? 'Saved' : 'Save Draft'}
                    </button>
                    <button
                      disabled={emailSending}
                      className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400 inline-flex items-center gap-2"
                      onClick={sendEmail}
                    >
                      {emailSending && <Loader2 className="w-4 h-4 animate-spin" />} Send
                    </button>
                  </div>
                </div>
                {/* Schedule modal */}
                {scheduleOpen && (
                  <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setScheduleOpen(false)}
                  >
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                        <h4 className="text-lg font-semibold">Schedule Email</h4>
                        <button className="text-zinc-400 hover:text-white" onClick={() => setScheduleOpen(false)}>
                          ✕
                        </button>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-zinc-400">Date</label>
                          <input
                            type="date"
                            className="w-full bg-zinc-800 rounded-lg px-3 py-2"
                            value={scheduleDate}
                            onChange={e => setScheduleDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400">Time</label>
                          <input
                            type="time"
                            className="w-full bg-zinc-800 rounded-lg px-3 py-2"
                            value={scheduleTime}
                            onChange={e => setScheduleTime(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
                        <button
                          className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300"
                          onClick={() => setScheduleOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400"
                          onClick={scheduleEmail}
                        >
                          Schedule
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes Modal */}
          {notesOpen && notesEditing && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setNotesOpen(false)}
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Notes for {`${notesEditing.firstName || ''} ${notesEditing.lastName || ''}`.trim() || notesEditing.email}</h3>
                  <button className="text-zinc-400 hover:text-white" onClick={() => setNotesOpen(false)}>
                    ✕
                  </button>
                </div>
                <div className="p-4">
                  <textarea
                    className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-48 resize-y"
                    value={notesEditing.notes || ''}
                    onChange={e => setNotesEditing({ ...notesEditing, notes: e.target.value })}
                  />
                </div>
                <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
                  <button
                    className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300"
                    onClick={() => setNotesOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400"
                    onClick={saveNotes}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default FriendsOfBusinessPage;
