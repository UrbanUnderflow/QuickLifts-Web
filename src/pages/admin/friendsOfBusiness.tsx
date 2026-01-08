import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, addDoc, getDocs, orderBy, query, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Check, User, Mail, Loader2, X } from 'lucide-react';
import { convertFirestoreTimestamp, formatDate } from '../../utils/formatDate';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { showToast } from '../../redux/toastSlice';

interface FriendOfBusiness {
  id?: string;
  name: string;
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
}

const emptyFriend: FriendOfBusiness = {
  name: '',
  email: '',
  titleOrCompany: '',
  notes: ''
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

  // Email template state
  const [emailTemplateSubject, setEmailTemplateSubject] = useState('');
  const [emailTemplateBody, setEmailTemplateBody] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(true);

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
        (r.name || '').toLowerCase().includes(q) ||
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
    return template
      .replace(/\{\{name\}\}/g, friend.name || 'there')
      .replace(/\{\{firstName\}\}/g, (friend.name || 'there').split(/\s+/)[0] || 'there')
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
      const res = await fetch('/api/admin/send-friend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: { email: emailFriend.email, name: emailFriend.name || emailFriend.email },
          subject: emailSubject,
          textContent: emailBody
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to send');
      if (emailFriend.id) {
        const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
        await updateDoc(doc(db, 'friends-of-business', emailFriend.id), {
          lastEmailSubject: emailSubject,
          lastEmailBody: emailBody,
          lastEmailSentAt: new Date(),
          lastEmailMessageId: json.messageId || null,
          updatedAt: new Date(),
          lastUpdatedBy: actor
        } as any);
        setFriends(prev => prev.map(p => p.id === emailFriend.id ? { ...p, updatedAt: new Date(), lastUpdatedBy: actor } : p));
      }
      dispatch(showToast({ message: 'Email sent successfully', type: 'success' }));
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
      const res = await fetch('/api/admin/send-friend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: { email: emailFriend.email, name: emailFriend.name || emailFriend.email },
          subject: emailSubject,
          textContent: emailBody,
          scheduledAt: when.toISOString()
        })
      });
      const json = await res.json();
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
    const confirmed = window.confirm(`Are you sure you want to delete ${friend.name}?`);
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

          {/* Email Template Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#E0FE10]" /> Email Template
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              Create an email template that will be personalized for each friend. Use placeholders: {'{{'}name{'}}'}, {'{{'}firstName{'}}'}, {'{{'}email{'}}'}, {'{{'}titleOrCompany{'}}'}
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
                    <label className="text-xs text-zinc-400 mb-1 block">Body Template</label>
                    <textarea
                      className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-48 resize-y"
                      placeholder="Hi {{firstName}},&#10;&#10;This is a template email...&#10;&#10;Best,&#10;Tremaine"
                      value={emailTemplateBody}
                      onChange={e => setEmailTemplateBody(e.target.value)}
                    />
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
                placeholder="Name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
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

          {/* Search */}
          <div className="mb-4">
            <input
              placeholder="Search name, email, title..."
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full max-w-md"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Title/Company</th>
                  <th className="text-left p-3">Notes</th>
                  <th className="text-left p-3">Created By</th>
                  <th className="text-left p-3">Updated By</th>
                  <th className="text-left p-3">Updated</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="p-4 text-zinc-400" colSpan={8}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td className="p-4 text-zinc-400" colSpan={8}>
                      No friends found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map(row => {
                    const updated = convertFirestoreTimestamp(row.updatedAt as any);
                    return (
                      <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                        <td className="p-3 font-medium text-white">{row.name}</td>
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
                    placeholder="Name"
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
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
                  <h3 className="text-xl font-semibold">Email {emailFriend.name}</h3>
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
                        value={`${emailFriend.name || ''} <${emailFriend.email}>`}
                        readOnly
                      />
                    </div>
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
                  <h3 className="text-xl font-semibold">Notes for {notesEditing.name}</h3>
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
