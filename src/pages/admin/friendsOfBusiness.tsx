import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, addDoc, getDocs, orderBy, query, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Check, User, Mail, Loader2, X, Sparkles, Link, Eye, MousePointer, AlertTriangle, Clock, Send } from 'lucide-react';
import { convertFirestoreTimestamp, formatDate } from '../../utils/formatDate';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { showToast } from '../../redux/toastSlice';

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
  emailDraftSubject?: string;
  emailDraftBody?: string;
  lastEmailSubject?: string;
  lastEmailBody?: string;
  lastEmailSentAt?: any;
  lastEmailMessageId?: string;
  // Email tracking fields (updated via Brevo webhook)
  emailStatus?: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'unsubscribed';
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

// Email status display component
const EmailStatusBadge: React.FC<{ friend: FriendOfBusiness; filterPeriod?: string }> = ({ friend, filterPeriod }) => {
  // If filtering by a specific update period, show that period's status
  const updateRecord = filterPeriod && friend.emailUpdates?.[filterPeriod];
  
  const emailStatus = updateRecord ? updateRecord.status : friend.emailStatus;
  const lastEmailSentAt = updateRecord ? updateRecord.sentAt : friend.lastEmailSentAt;
  const emailOpenCount = updateRecord ? updateRecord.openCount : friend.emailOpenCount;
  const emailClickCount = updateRecord ? updateRecord.clickCount : friend.emailClickCount;
  
  // If no email has been sent (for this period if filtering)
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

// Review periods for investor update generator
const reviewPeriods = [
  {
    id: 'jan-26',
    label: 'January 2026 Update',
    url: 'fitwithpulse.ai/review/jan-26',
    month: 'January',
    highlights: [
      'New year kickoff',
      'Q1 goals',
      'Product roadmap'
    ]
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
    ]
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
    ]
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
    ]
  }
];

// Email update history type - tracks status per update period
interface EmailUpdateRecord {
  updatePeriodId: string;
  sentAt: any;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam';
  openedAt?: any;
  clickedAt?: any;
  openCount?: number;
  clickCount?: number;
  messageId?: string;
}

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

  // Email template state
  const [emailTemplateSubject, setEmailTemplateSubject] = useState('');
  const [emailTemplateBody, setEmailTemplateBody] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(true);

  // Investor update generator state
  const [selectedReviewPeriod, setSelectedReviewPeriod] = useState<string>('');
  const [generatingUpdate, setGeneratingUpdate] = useState(false);
  
  // Email update period selection (for tagging emails)
  const [emailUpdatePeriod, setEmailUpdatePeriod] = useState<string>('');
  
  // Table filter by update period
  const [filterUpdatePeriod, setFilterUpdatePeriod] = useState<string>('');

  // Refs for text selection
  const templateBodyRef = React.useRef<HTMLTextAreaElement>(null);

  const dispatch = useDispatch();
  const [initialEmailDraft, setInitialEmailDraft] = useState<{ subject: string; body: string } | null>(null);

  // Load email template from Firestore
  useEffect(() => {
    const loadTemplate = async () => {
      setTemplateLoading(true);
      try {
        const templateDoc = await getDocs(collection(db, 'friends-email-template'));
        if (!templateDoc.empty) {
          const data = templateDoc.docs[0].data();
          setEmailTemplateSubject(data.subject || '');
          setEmailTemplateBody(data.body || '');
        }
      } catch (e) {
        console.error('Failed to load template', e);
      } finally {
        setTemplateLoading(false);
      }
    };
    loadTemplate();
  }, []);

  // Save email template to Firestore
  const saveTemplate = async () => {
    setTemplateSaving(true);
    try {
      const templateCollection = collection(db, 'friends-email-template');
      const existing = await getDocs(templateCollection);
      
      if (!existing.empty) {
        // Update existing template
        await updateDoc(doc(db, 'friends-email-template', existing.docs[0].id), {
          subject: emailTemplateSubject,
          body: emailTemplateBody,
          updatedAt: new Date()
        });
      } else {
        // Create new template
        await addDoc(templateCollection, {
          subject: emailTemplateSubject,
          body: emailTemplateBody,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      dispatch(showToast({ message: 'Email template saved', type: 'success' }));
    } catch (e) {
      console.error('Save template failed', e);
      dispatch(showToast({ message: 'Failed to save template', type: 'error' }));
    } finally {
      setTemplateSaving(false);
    }
  };

  useEffect(() => {
    if (emailOpen && emailFriend) {
      setInitialEmailDraft({ subject: emailSubject, body: emailBody });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailOpen]);

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
    // Prefer previously saved draft values if present
    const savedSubject = row.emailDraftSubject;
    const savedBody = row.emailDraftBody;
    if (savedSubject && savedBody) {
      setEmailSubject(savedSubject);
      setEmailBody(savedBody);
    } else {
      const { subject, body } = generateEmail(row);
      setEmailSubject(subject);
      setEmailBody(body);
    }
    // Auto-select the update period if one was selected in the generator
    setEmailUpdatePeriod(selectedReviewPeriod || '');
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
        updatedAt: now,
        lastUpdatedBy: actor
      } as any);
      setFriends(prev => prev.map(p => p.id === emailFriend.id ? { ...p, emailDraftSubject: emailSubject, emailDraftBody: emailBody, lastUpdatedBy: actor, updatedAt: now } : p));
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
          friendId: emailFriend.id, // Pass friendId for tracking
          updatePeriodId: emailUpdatePeriod || null // Pass update period for filtering
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
        
        // Build update data
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
        
        // If tagged with an update period, also save to emailUpdates map
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
        
        // Update local state
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
      const periodLabel = emailUpdatePeriod ? ` (${reviewPeriods.find(p => p.id === emailUpdatePeriod)?.label})` : '';
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
          friendId: emailFriend.id // Pass friendId for tracking
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
      dispatch(showToast({ message: 'Email scheduled successfully', type: 'success' }));
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
    const period = reviewPeriods.find(p => p.id === selectedReviewPeriod);
    if (!period) return;

    const subject = `Pulse ${period.month} Update – ${period.label}`;
    const body = `Hi {{firstName}},

Our ${period.label.toLowerCase()} is live with Q4 metrics, product launches, and 2026 roadmap.

View here: https://${period.url}

Highlights: ${period.highlights.join(', ')}.

Best,
Tremaine`;

    setEmailTemplateSubject(subject);
    setEmailTemplateBody(body);
    setGeneratingUpdate(true);
    
    // Show feedback
    dispatch(showToast({ 
      message: `Generated investor update for ${period.label}`, 
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

          {/* Investor Update Generator */}
          <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-6 mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> Investor Update Generator
            </h2>
            <p className="text-sm text-zinc-300 mb-4">
              Automatically generate concise investor update emails from your monthly review pages.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Select Review Period</label>
                <select
                  className="w-full md:w-96 bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-700"
                  value={selectedReviewPeriod}
                  onChange={e => setSelectedReviewPeriod(e.target.value)}
                >
                  <option value="">Choose a review period...</option>
                  {reviewPeriods.map(period => (
                    <option key={period.id} value={period.id}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedReviewPeriod && (
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                  <h4 className="text-sm font-semibold text-white mb-2">Preview</h4>
                  {(() => {
                    const period = reviewPeriods.find(p => p.id === selectedReviewPeriod);
                    if (!period) return null;
                    return (
                      <div className="text-sm text-zinc-300 space-y-2">
                        <p><strong>Subject:</strong> Pulse {period.month} Update – {period.label}</p>
                        <p className="text-xs text-zinc-400 mt-2">
                          <strong>Body:</strong><br/>
                          Our {period.label.toLowerCase()} is live with Q4 metrics, product launches, and 2026 roadmap.<br/>
                          View here: {period.url}<br/>
                          Highlights: {period.highlights.join(', ')}.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              <div className="flex justify-end">
                <button
                  onClick={generateInvestorUpdate}
                  disabled={!selectedReviewPeriod || generatingUpdate}
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
                      Generate Email Template
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Email Template Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#E0FE10]" /> Email Template
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              Create an email template that will be personalized for each friend. Use placeholders: {'{{'}name{'}}'}, {'{{'}firstName{'}}'}, {'{{'}lastName{'}}'}, {'{{'}email{'}}'}, {'{{'}titleOrCompany{'}}'}
            </p>
            {templateLoading ? (
              <div className="text-zinc-400">Loading template...</div>
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

          {/* Search and Filter */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <input
              placeholder="Search name, email, title..."
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full max-w-md"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-400 whitespace-nowrap">Filter by Update:</label>
              <select
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm min-w-[200px]"
                value={filterUpdatePeriod}
                onChange={e => setFilterUpdatePeriod(e.target.value)}
              >
                <option value="">All emails (latest status)</option>
                {reviewPeriods.map(period => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
              </select>
              {filterUpdatePeriod && (
                <button
                  onClick={() => setFilterUpdatePeriod('')}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 border border-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          {/* Filter indicator */}
          {filterUpdatePeriod && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300">
                Showing email status for: <strong>{reviewPeriods.find(p => p.id === filterUpdatePeriod)?.label}</strong>
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
                          <EmailStatusBadge friend={row} filterPeriod={filterUpdatePeriod} />
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
                    <label className="text-xs text-zinc-400 mb-2 block">Tag this email with an update period (for tracking)</label>
                    <select
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                      value={emailUpdatePeriod}
                      onChange={e => setEmailUpdatePeriod(e.target.value)}
                    >
                      <option value="">No tag (general email)</option>
                      {reviewPeriods.map(period => (
                        <option key={period.id} value={period.id}>
                          📊 {period.label}
                        </option>
                      ))}
                    </select>
                    {emailUpdatePeriod && (
                      <p className="text-xs text-green-400 mt-2">
                        ✓ This email will be tracked under "{reviewPeriods.find(p => p.id === emailUpdatePeriod)?.label}"
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
