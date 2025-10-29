import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, addDoc, getDocs, orderBy, query, updateDoc, doc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Check, User, Mail, Globe, Users, Target, Loader2, Filter } from 'lucide-react';
import { convertFirestoreTimestamp, formatDate } from '../../utils/formatDate';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { showToast } from '../../redux/toastSlice';

type ProspectStatus =
  | 'new'
  | 'contacted'
  | 'interviewing'
  | 'approved'
  | 'onboarded'
  | 'paused'
  | 'rejected';

type ProspectPriority = 'low' | 'medium' | 'high';

interface CreatorProspect {
  id?: string;
  displayName: string;
  handle: string; // @username
  email: string;
  niche: string; // primary category
  country: string;
  ethnicity?: string; // optional diversity tracking
  modality?: string; // content modality (e.g., long form, shorts, streams)
  platforms: {
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    twitter?: string;
  };
  followers: {
    instagram?: number;
    youtube?: number;
    tiktok?: number;
    twitter?: number;
  };
  engagement?: {
    engagementRate?: number; // percent
    avgViews?: number;
    avgLikes?: number;
    avgComments?: number;
  };
  leadSource: string;
  pastLaunchHistory?: string; // notes about past challenges/launches
  priority: ProspectPriority;
  status: ProspectStatus;
  notes: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  lastUpdatedBy?: string;
}

const emptyProspect: CreatorProspect = {
  displayName: '',
  handle: '',
  email: '',
  niche: '',
  country: '',
  ethnicity: '',
  modality: '',
  platforms: {},
  followers: {},
  engagement: {},
  leadSource: '',
  pastLaunchHistory: '',
  priority: 'medium',
  status: 'new',
  notes: ''
};

const statuses: { value: ProspectStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'approved', label: 'Approved' },
  { value: 'onboarded', label: 'Onboarded' },
  { value: 'paused', label: 'Paused' },
  { value: 'rejected', label: 'Rejected' }
];

const priorities: { value: ProspectPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

const CreatorProspectsPage: React.FC = () => {
  const LOG_PREFIX = '[CreatorProspects]';
  const [form, setForm] = useState<CreatorProspect>(emptyProspect);
  const [saving, setSaving] = useState(false);

  const [prospects, setProspects] = useState<CreatorProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('new');
  const [priorityFilter, setPriorityFilter] = useState<ProspectPriority | 'all'>('all');
  const currentUser = useSelector((s: RootState) => s.user.currentUser);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<CreatorProspect | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState<CreatorProspect | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailProspect, setEmailProspect] = useState<CreatorProspect | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  // For creators we copy a DM template instead of sending email
  const [proposedSlots, setProposedSlots] = useState('Monday, Tuesday and Thursday before 12:45pm EST');
  const [senderType, setSenderType] = useState<'tremaine' | 'brand'>('tremaine');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const dispatch = useDispatch();
  const [initialDraft, setInitialDraft] = useState<{ body: string; slots: string; sender: 'tremaine'|'brand' } | null>(null);
  const [revPrompt, setRevPrompt] = useState('');
  const [revLoading, setRevLoading] = useState(false);
  const [revText, setRevText] = useState('');

  useEffect(() => {
    if (emailOpen && emailProspect) {
      setInitialDraft({ body: emailBody, slots: proposedSlots, sender: senderType });
      setRevPrompt('');
      setRevText('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailOpen]);

  const isDirty = !!initialDraft && (initialDraft.body !== emailBody || initialDraft.slots !== proposedSlots || initialDraft.sender !== senderType);

  // Detect unsaved quick-add inputs
  const isQuickAddDirty = useMemo(() => {
    try { return JSON.stringify(form) !== JSON.stringify(emptyProspect); }
    catch { return false; }
  }, [form]);

  const generateRevision = async () => {
    if (!revPrompt.trim()) return;
    setRevLoading(true);
    try {
      const res = await fetch('/api/gpt/revise-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: revPrompt,
          currentBody: emailBody,
          context: {
            creator: emailProspect?.displayName || emailProspect?.handle,
            niche: emailProspect?.niche,
            platforms: emailProspect?.platforms
          }
        })
      });
      const json = await res.json();
      if (!res.ok || !json.revisedBody) throw new Error(json.error || 'Failed to generate revision');
      setRevText(json.revisedBody);
      dispatch(showToast({ message: 'Revision generated', type: 'success' }));
    } catch (e) {
      console.error('[DM Revise] error', e);
      dispatch(showToast({ message: 'Failed to generate revision', type: 'error' }));
    } finally {
      setRevLoading(false);
    }
  };

  const replaceWithRevision = () => {
    if (!revText) return;
    setEmailBody(revText);
    setRevText('');
    setRevPrompt('');
  };

  // Warn before closing tab if unsaved work exists
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Progress will be lost.';
    };
    if (isQuickAddDirty || (emailOpen && isDirty)) {
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [isQuickAddDirty, emailOpen, isDirty]);

  const requestCloseDm = async () => {
    if (isDirty) {
      const shouldSave = window.confirm('You have unsaved changes. Click OK to save as a draft, or Cancel to discard.');
      if (shouldSave) {
        await saveEmailDraft();
      }
    }
    setEmailOpen(false);
  };

  // Remove undefined recursively so Firestore doesn't receive invalid values
  const cleanForFirestore = (input: any): any => {
    if (input === undefined) return undefined;
    if (input === null) return null;
    if (input instanceof Date) return input; // preserve timestamps
    if (Array.isArray(input)) return input.map(cleanForFirestore);
    if (typeof input === 'object') {
      const out: any = {};
      Object.entries(input).forEach(([k, v]) => {
        const cleaned = cleanForFirestore(v);
        // Keep all values except undefined. Do NOT strip empty objects because
        // Firestore sentinel values (e.g., serverTimestamp) can appear as objects
        // without enumerable keys and would otherwise be removed.
        if (cleaned !== undefined) {
          out[k] = cleaned;
        }
      });
      return out;
    }
    return input;
  };

  const filtered = useMemo(() => {
    let rows = prospects;
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
    if (priorityFilter !== 'all') rows = rows.filter(r => r.priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.displayName || '').toLowerCase().includes(q) ||
        (r.handle || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.niche || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [prospects, search, statusFilter, priorityFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: prospects.length };
    statuses.forEach(s => { counts[s.value] = prospects.filter(p => p.status === s.value).length; });
    return counts;
  }, [prospects]);

  const pickPrimaryPlatform = (p: CreatorProspect) => {
    if (p.platforms?.instagram) return 'Instagram';
    if (p.platforms?.youtube) return 'YouTube';
    if (p.platforms?.tiktok) return 'TikTok';
    if (p.platforms?.twitter) return 'X';
    return 'your audience';
  };

  // Make niche phrases read naturally in sentences
  const humanizeNiche = (raw?: string): string => {
    if (!raw || !raw.trim()) return 'fitness and wellness';
    let s = raw.replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
    // If it starts with "Help"/"Helps", convert to a gerund phrase
    if (/^help(s)?\b/i.test(s)) {
      s = 'helping ' + s.replace(/^help(s)?\b/i, '').trim();
    }
    // Lowercase the first letter for smoother mid-sentence usage
    s = s.charAt(0).toLowerCase() + s.slice(1);
    return s;
  };

  const generateEmail = (p: CreatorProspect, slots: string, from: 'tremaine' | 'brand'): { subject: string; body: string } => {
    const name = (p.displayName || p.handle || 'there').split(' ')[0];
    const subject = 'Creator outreach'; // unused for DM copy
    const timeText = slots || 'before 12:45 PM most weekdays';
    const platform = pickPrimaryPlatform(p);
    const body = from === 'tremaine'
      ? `Hey ${name}! I’m Tremaine—loving your content. I’d love to hear more about how you’re building community and what your goals beyond ${platform} are. I’m a creator myself and I’m trying to be more intentional about building community among fitness creators, coaches, and trainers.\n\nI’m the founder of Pulse, a fitness app where creators, coaches, and instructors can create structured programs that turn into a kind of gamified, multiplayer group training. Your community can compete and connect with you through the program. They’re fully monetizable and a great way to identify your core people. We’ve already helped a couple of SoulCycle instructors launch their own Rounds and they each brought around 50 people into their first Round.\n\nWe’re still early and looking for like‑minded creators to grow with us. Would you be open to a conversation?`
      : `Hi ${name}! 👋\n\nWe’re the team at Pulse Fitness Collective. We’ve been watching you share your expertise and we love your energy and the community you’re building. We see you make content generally geared toward ${humanizeNiche(p.niche)}, and we think your messaging really resonates with our community as well.\n\nPulse is a platform built for creators to monetize and gamify their content through something we call Rounds. We’ve launched a few this year in partnership with SoulCycle, and we’ve got more in the works with a diverse set of creators.\n\nWe’re still early and bringing on like‑minded creators who want to grow with us. If you’re curious about how Pulse could support what you’re already doing, we’d love to chat and learn more about your goals. Just let us know a good time and we’ll make it work!`;
    return { subject, body };
  };

  const openEmail = (row: CreatorProspect) => {
    setEmailProspect(row);
    const { subject, body } = generateEmail(row, proposedSlots, senderType);
    setEmailSubject(subject);
    setEmailBody(body);
    setEmailOpen(true);
  };

  const saveEmailDraft = async () => {
    if (!emailProspect?.id) return;
    setSavingDraft(true);
    try {
      const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
      const now = new Date();
      await updateDoc(doc(db, 'creator-prospects', emailProspect.id), {
        emailDraftSubject: emailSubject,
        emailDraftBody: emailBody,
        proposedSlots,
        updatedAt: now,
        lastUpdatedBy: actor
      } as any);
      setProspects(prev => prev.map(p => p.id === emailProspect.id ? { ...p, updatedAt: now, lastUpdatedBy: actor } : p));
      setDraftSavedAt(now);
      setTimeout(() => setDraftSavedAt(null), 2000);
    } finally {
      setSavingDraft(false);
    }
  };

  const copyMessage = async () => {
    try {
      const text = emailBody;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      // Mark as contacted after copying so it moves out of "New"
      if (emailProspect?.id) {
        const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
        await updateDoc(doc(db, 'creator-prospects', emailProspect.id), {
          status: 'contacted',
          updatedAt: serverTimestamp(),
          lastUpdatedBy: actor
        });
        setProspects(prev => prev.map(p => p.id === emailProspect.id ? { ...p, status: 'contacted', updatedAt: serverTimestamp(), lastUpdatedBy: actor } : p));
      }
      dispatch(showToast({ message: 'Message copied to clipboard', type: 'success' }));
      setEmailOpen(false);
    } catch (_) {
      dispatch(showToast({ message: 'Unable to copy. Please try again.', type: 'error' }));
    }
  };

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const path = 'creator-prospects';
      console.info(`${LOG_PREFIX} Fetch starting (NO ORDERBY)`, { path });

      const snap = await getDocs(collection(db, path));
      const rows: CreatorProspect[] = [];
      const missing: string[] = [];

      snap.forEach(d => {
        const data = d.data() as any;
        const hasUpdated = data.updatedAt !== undefined && data.updatedAt !== null;
        if (!hasUpdated) missing.push(d.id);
        console.log(`${LOG_PREFIX} Fetch doc`, { id: d.id, updatedAt: data.updatedAt, hasUpdated, displayName: data.displayName, updatedAtType: typeof data.updatedAt });
        rows.push({ id: d.id, ...(data as CreatorProspect) });
      });

      if (missing.length) {
        console.warn(`${LOG_PREFIX} Backfilling missing updatedAt`, { count: missing.length, ids: missing });
        const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
        await Promise.all(missing.map(id => updateDoc(doc(db, path, id), { updatedAt: serverTimestamp(), lastUpdatedBy: actor })));
      }

      // Local sort by updatedAt (fallback to createdAt), desc
      const toMs = (v: any) => {
        try {
          const d = convertFirestoreTimestamp(v as any);
          return d instanceof Date ? d.valueOf() : 0;
        } catch { return 0; }
      };
      rows.sort((a, b) => (toMs((b as any).updatedAt || (b as any).createdAt) - toMs((a as any).updatedAt || (a as any).createdAt)));

      console.info(`${LOG_PREFIX} Fetch complete`, { count: rows.length, ids: rows.slice(0, 10).map(r => r.id) });
      console.log(`${LOG_PREFIX} All fetched IDs`, { allIds: rows.map(r => r.id) });
      setProspects(rows);
      console.log(`${LOG_PREFIX} State updated`, { prospectsLength: rows.length });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const saveProspect = async () => {
    setSaving(true);
    try {
      const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
      // Use Firestore server timestamps for consistent ordering across clients
      const payload: any = {
        ...form,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: actor,
        lastUpdatedBy: actor
      } as CreatorProspect;
      const path = 'creator-prospects';
      const cleaned = cleanForFirestore(payload) as any;
      console.info(`${LOG_PREFIX} Save starting`, { path, payloadBeforeClean: payload, payloadAfterClean: cleaned });
      console.log(`${LOG_PREFIX} Save payload details`, {
        hasCreatedAt: cleaned.createdAt !== undefined,
        hasUpdatedAt: cleaned.updatedAt !== undefined,
        createdAtType: typeof cleaned.createdAt,
        updatedAtType: typeof cleaned.updatedAt,
        createdAtValue: cleaned.createdAt,
        updatedAtValue: cleaned.updatedAt
      });
      const docRef = await addDoc(collection(db, path), cleaned);
      console.info(`${LOG_PREFIX} Save complete`, { newId: docRef.id, path: docRef.path });
      try {
        const createdSnap = await getDoc(docRef);
        const createdData = createdSnap.exists() ? createdSnap.data() : null;
        console.info(`${LOG_PREFIX} Verify created`, { 
          exists: createdSnap.exists(), 
          data: createdData,
          hasUpdatedAt: createdData?.updatedAt !== undefined,
          updatedAtType: typeof createdData?.updatedAt,
          updatedAtValue: createdData?.updatedAt
        });
      } catch (e) {
        console.warn(`${LOG_PREFIX} Verify created failed`, e);
      }
      // Refresh the list to get the new item with proper ordering
      console.log(`${LOG_PREFIX} Triggering refresh to include new doc`);
      await fetchProspects();
      dispatch(showToast({ message: 'Prospect saved', type: 'success' }));
      setForm(emptyProspect);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (row: CreatorProspect, status: ProspectStatus) => {
    if (!row.id) return;
    const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
    await updateDoc(doc(db, 'creator-prospects', row.id), {
      status,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: actor
    });
    setProspects(prev => prev.map(p => (p.id === row.id ? { ...p, status, lastUpdatedBy: actor, updatedAt: serverTimestamp() } : p)));
  };

  const openDetail = (row: CreatorProspect) => {
    setEditing(row);
    setDetailOpen(true);
  };

  const deleteCurrent = async () => {
    if (!editing?.id) return;
    const id = editing.id;
    const label = editing.displayName || editing.handle || id;
    if (!window.confirm(`Delete ${label}? This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'creator-prospects', id));
      setProspects(prev => prev.filter(p => p.id !== id));
      dispatch(showToast({ message: 'Prospect deleted', type: 'success' }));
      setDetailOpen(false);
    } catch (e) {
      console.error(`${LOG_PREFIX} Delete failed`, e);
      dispatch(showToast({ message: 'Failed to delete prospect. Please try again.', type: 'error' }));
    } finally {
      setDeleting(false);
    }
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    const { id, ...rest } = editing;
    const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
    console.info(`${LOG_PREFIX} Edit starting`, { id, updates: rest });
    await updateDoc(doc(db, 'creator-prospects', id), cleanForFirestore({
      ...rest,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: actor
    }) as any);
    console.info(`${LOG_PREFIX} Edit complete`, { id });
    setProspects(prev => prev.map(p => (p.id === id ? { ...p, ...rest, lastUpdatedBy: actor, updatedAt: serverTimestamp() } : p)));
    setDetailOpen(false);
  };

  const openNotes = (row: CreatorProspect) => {
    setNotesEditing(row);
    setNotesOpen(true);
  };

  const saveNotes = async () => {
    if (!notesEditing?.id) return;
    const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
    console.info(`${LOG_PREFIX} Notes save`, { id: notesEditing.id });
    await updateDoc(doc(db, 'creator-prospects', notesEditing.id), {
      notes: notesEditing.notes || '',
      updatedAt: serverTimestamp(),
      lastUpdatedBy: actor
    });
    setProspects(prev => prev.map(p => (p.id === notesEditing.id ? { ...p, notes: notesEditing.notes, lastUpdatedBy: actor, updatedAt: serverTimestamp() } : p)));
    setNotesOpen(false);
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Creator Prospects | Admin</title>
      </Head>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Creator Prospects</h1>
            <p className="text-zinc-400">Manage inbound and outbound creator opportunities.</p>
          </div>

          {/* Quick Add Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-[#E0FE10]" /> Add Prospect</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Display Name"
                     value={form.displayName} onChange={e=>setForm({...form, displayName:e.target.value})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="@handle"
                     value={form.handle} onChange={e=>setForm({...form, handle:e.target.value})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Email"
                     value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />

              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Niche (e.g., Fitness, Wellness)"
                     value={form.niche} onChange={e=>setForm({...form, niche:e.target.value})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Country"
                     value={form.country} onChange={e=>setForm({...form, country:e.target.value})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Ethnicity (optional)"
                     value={form.ethnicity || ''} onChange={e=>setForm({...form, ethnicity:e.target.value})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Lead Source"
                     value={form.leadSource} onChange={e=>setForm({...form, leadSource:e.target.value})} />

              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Modality (e.g., long form, shorts, streams)"
                     value={form.modality || ''} onChange={e=>setForm({...form, modality:e.target.value})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Followers: IG"
                     value={form.followers.instagram || ''} onChange={e=>setForm({...form, followers:{...form.followers, instagram: Number(e.target.value) || undefined}})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Followers: YT"
                     value={form.followers.youtube || ''} onChange={e=>setForm({...form, followers:{...form.followers, youtube: Number(e.target.value) || undefined}})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Followers: TikTok"
                     value={form.followers.tiktok || ''} onChange={e=>setForm({...form, followers:{...form.followers, tiktok: Number(e.target.value) || undefined}})} />

              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Engagement Rate (%)"
                     value={form.engagement?.engagementRate || ''} onChange={e=>setForm({...form, engagement:{...form.engagement, engagementRate: Number(e.target.value) || undefined}})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Avg Views"
                     value={form.engagement?.avgViews || ''} onChange={e=>setForm({...form, engagement:{...form.engagement, avgViews: Number(e.target.value) || undefined}})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Avg Likes"
                     value={form.engagement?.avgLikes || ''} onChange={e=>setForm({...form, engagement:{...form.engagement, avgLikes: Number(e.target.value) || undefined}})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Avg Comments"
                     value={form.engagement?.avgComments || ''} onChange={e=>setForm({...form, engagement:{...form.engagement, avgComments: Number(e.target.value) || undefined}})} />

              <input className="bg-zinc-800 rounded-lg px-3 py-2 md:col-span-2" placeholder="Past Challenge/Launch History"
                     value={form.pastLaunchHistory || ''} onChange={e=>setForm({...form, pastLaunchHistory:e.target.value})} />

              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Instagram URL"
                     value={form.platforms.instagram || ''} onChange={e=>setForm({...form, platforms:{...form.platforms, instagram:e.target.value}})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="YouTube URL"
                     value={form.platforms.youtube || ''} onChange={e=>setForm({...form, platforms:{...form.platforms, youtube:e.target.value}})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="TikTok URL"
                     value={form.platforms.tiktok || ''} onChange={e=>setForm({...form, platforms:{...form.platforms, tiktok:e.target.value}})} />

              <select className="bg-zinc-800 rounded-lg px-3 py-2" value={form.priority} onChange={e=>setForm({...form, priority:e.target.value as ProspectPriority})}>
                {priorities.map(p=> <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select className="bg-zinc-800 rounded-lg px-3 py-2" value={form.status} onChange={e=>setForm({...form, status:e.target.value as ProspectStatus})}>
                {statuses.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <textarea
                className="bg-zinc-800 rounded-lg px-3 py-3 md:col-span-3 h-32 resize-y"
                placeholder="Notes"
                value={form.notes}
                onChange={e=>setForm({...form, notes:e.target.value})}
                rows={5}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={saveProspect} disabled={saving} className="inline-flex items-center gap-2 bg-[#E0FE10] text-black font-semibold px-5 py-2 rounded-lg hover:bg-lime-400 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" /> Save Prospect
              </button>
            </div>
          </div>

          {/* Filters and Status Tabs */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-2 overflow-x-auto">
              {(['all', ...statuses.map(s => s.value)] as Array<'all'|ProspectStatus>).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full border text-sm whitespace-nowrap ${statusFilter===s ? 'bg-[#E0FE10] text-black border-[#E0FE10]' : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800'}`}
                >
                  {s === 'all' ? 'All' : statuses.find(x=>x.value===s)?.label} ({statusCounts[s] || 0})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-zinc-400"><Filter className="w-4 h-4" />Filters</div>
              <input placeholder="Search name, handle, email..." className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex-1 min-w-[240px]"
                     value={search} onChange={e=>setSearch(e.target.value)} />
              <select className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value as any)}>
                <option value="all">All Priorities</option>
                {priorities.map(p=> <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800">
                  <th className="text-left p-3">Creator</th>
                  <th className="text-left p-3">Niche</th>
                  <th className="text-left p-3">Country</th>
                  <th className="text-left p-3">Ethnicity</th>
                  <th className="text-left p-3">Platforms</th>
                  <th className="text-left p-3">Priority</th>
                  <th className="text-left p-3">Notes</th>
                  <th className="text-left p-3">Created By</th>
                  <th className="text-left p-3">Updated By</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td className="p-4 text-zinc-400" colSpan={10}>Loading…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td className="p-4 text-zinc-400" colSpan={10}>No prospects found.</td></tr>
                )}
                {!loading && filtered.map(row => {
                  const updated = convertFirestoreTimestamp(row.updatedAt as any);
                  const p = row.platforms || {};
                  return (
                    <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                      <td className="p-3">
                        <div className="font-medium text-white">{row.displayName} <span className="text-zinc-400">{row.handle && `(${row.handle})`}</span></div>
                        <div className="text-zinc-400 text-xs">{row.email}</div>
                      </td>
                  <td className="p-3 text-zinc-300">{row.niche} {row.modality ? `• ${row.modality}` : ''}</td>
                      <td className="p-3 text-zinc-300">{row.country}</td>
                      <td className="p-3 text-zinc-300">{row.ethnicity || '—'}</td>
                      <td className="p-3 text-zinc-300">
                        <div className="flex flex-wrap gap-2">
                          {p.instagram && (
                            <a className="px-2 py-1 text-xs rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/30 hover:bg-pink-500/20" href={p.instagram} target="_blank" rel="noopener noreferrer">IG</a>
                          )}
                          {p.youtube && (
                            <a className="px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20" href={p.youtube} target="_blank" rel="noopener noreferrer">YT</a>
                          )}
                          {p.tiktok && (
                            <a className="px-2 py-1 text-xs rounded-full bg-white/5 text-white border border-white/20 hover:bg-white/10" href={p.tiktok} target="_blank" rel="noopener noreferrer">TT</a>
                          )}
                          {p.twitter && (
                            <a className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20" href={p.twitter} target="_blank" rel="noopener noreferrer">X</a>
                          )}
                          {!p.instagram && !p.youtube && !p.tiktok && !p.twitter && '—'}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${row.priority === 'high' ? 'bg-red-500/10 text-red-400' : row.priority === 'low' ? 'bg-zinc-700 text-zinc-200' : 'bg-yellow-500/10 text-yellow-400'}`}>{row.priority}</span>
                      </td>
                      <td className="p-3 text-zinc-300">
                        {row.notes ? (
                          <button onClick={() => openNotes(row)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20">Has notes</button>
                        ) : (
                          <span className="text-zinc-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-zinc-300">{row.createdBy || '—'}</td>
                      <td className="p-3 text-zinc-300">{row.lastUpdatedBy || '—'}</td>
                      <td className="p-3">
                        <select className="bg-zinc-800 rounded-md px-2 py-1" value={row.status} onChange={e=>changeStatus(row, e.target.value as ProspectStatus)}>
                          {statuses.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="p-3 text-zinc-400 flex items-center justify-between gap-2">
                        <span>{formatDate(updated)}</span>
                        <div className="flex gap-2">
                          <button onClick={() => openDetail(row)} className="px-3 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700">View</button>
                          <button onClick={() => openEmail(row)} className="px-3 py-1 rounded-md bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 flex items-center gap-1">
                            <Mail className="w-4 h-4" /> DM
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detail/Edit Modal */}
          {detailOpen && editing && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailOpen(false)}>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Edit Prospect</h3>
                  <button className="text-zinc-400 hover:text-white" onClick={() => setDetailOpen(false)}>✕</button>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Display Name" value={editing.displayName} onChange={e=>setEditing({...editing, displayName:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="@handle" value={editing.handle} onChange={e=>setEditing({...editing, handle:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Email" value={editing.email} onChange={e=>setEditing({...editing, email:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Niche" value={editing.niche} onChange={e=>setEditing({...editing, niche:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Modality" value={editing.modality || ''} onChange={e=>setEditing({...editing, modality:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Country" value={editing.country} onChange={e=>setEditing({...editing, country:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Ethnicity (optional)" value={editing.ethnicity || ''} onChange={e=>setEditing({...editing, ethnicity:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Lead Source" value={editing.leadSource} onChange={e=>setEditing({...editing, leadSource:e.target.value})} />

                  <input className="bg-zinc-800 rounded-lg px-3 py-2 md:col-span-2" placeholder="Instagram URL" value={editing.platforms?.instagram || ''} onChange={e=>setEditing({...editing, platforms:{...editing.platforms, instagram:e.target.value}})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="YouTube URL" value={editing.platforms?.youtube || ''} onChange={e=>setEditing({...editing, platforms:{...editing.platforms, youtube:e.target.value}})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="TikTok URL" value={editing.platforms?.tiktok || ''} onChange={e=>setEditing({...editing, platforms:{...editing.platforms, tiktok:e.target.value}})} />

                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Engagement Rate (%)" value={editing.engagement?.engagementRate || ''} onChange={e=>setEditing({...editing, engagement:{...editing.engagement, engagementRate: Number(e.target.value) || undefined}})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Avg Views" value={editing.engagement?.avgViews || ''} onChange={e=>setEditing({...editing, engagement:{...editing.engagement, avgViews: Number(e.target.value) || undefined}})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Avg Likes" value={editing.engagement?.avgLikes || ''} onChange={e=>setEditing({...editing, engagement:{...editing.engagement, avgLikes: Number(e.target.value) || undefined}})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Avg Comments" value={editing.engagement?.avgComments || ''} onChange={e=>setEditing({...editing, engagement:{...editing.engagement, avgComments: Number(e.target.value) || undefined}})} />

                  <input className="bg-zinc-800 rounded-lg px-3 py-2 md:col-span-2" placeholder="Past Challenge/Launch History" value={editing.pastLaunchHistory || ''} onChange={e=>setEditing({...editing, pastLaunchHistory:e.target.value})} />

                  <select className="bg-zinc-800 rounded-lg px-3 py-2" value={editing.priority} onChange={e=>setEditing({...editing!, priority: e.target.value as ProspectPriority})}>
                    {priorities.map(p=> <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <select className="bg-zinc-800 rounded-lg px-3 py-2" value={editing.status} onChange={e=>setEditing({...editing!, status: e.target.value as ProspectStatus})}>
                    {statuses.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <textarea className="bg-zinc-800 rounded-lg px-3 py-3 md:col-span-2 h-32 resize-y" placeholder="Notes" value={editing.notes} onChange={e=>setEditing({...editing, notes:e.target.value})} />
                </div>
                <div className="p-4 border-t border-zinc-800 flex justify-between gap-3">
                  <button className="px-4 py-2 rounded-md bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30" onClick={deleteCurrent} disabled={deleting}>Delete</button>
                  <button className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300" onClick={()=>setDetailOpen(false)}>Close</button>
                  <button className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400" onClick={saveEdit}>Save Changes</button>
                </div>
              </div>
            </div>
          )}

          {/* Email Modal */}
          {emailOpen && emailProspect && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl" onClick={e=>e.stopPropagation()}>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">DM {emailProspect.displayName}</h3>
                  <button className="text-zinc-400 hover:text-white" onClick={requestCloseDm}>✕</button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400">Proposed Slots</label>
                      <input className="w-full bg-zinc-800 rounded-lg px-3 py-2" value={proposedSlots} onChange={e=>{setProposedSlots(e.target.value); if (emailProspect) { const g = generateEmail(emailProspect, e.target.value, senderType); setEmailSubject(g.subject); setEmailBody(g.body);} }} />
                    </div>
                  </div>
                  {/* Sender tabs */}
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={()=>{setSenderType('tremaine'); if (emailProspect){ const g = generateEmail(emailProspect, proposedSlots, 'tremaine'); setEmailSubject(g.subject); setEmailBody(g.body);} }} className={`px-3 py-1 rounded-full text-sm border ${senderType==='tremaine' ? 'bg-[#E0FE10] text-black border-[#E0FE10]' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>Tremaine</button>
                    <button onClick={()=>{setSenderType('brand'); if (emailProspect){ const g = generateEmail(emailProspect, proposedSlots, 'brand'); setEmailSubject(g.subject); setEmailBody(g.body);} }} className={`px-3 py-1 rounded-full text-sm border ${senderType==='brand' ? 'bg-[#E0FE10] text-black border-[#E0FE10]' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>Brand Account</button>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Body</label>
                    <textarea className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-72 resize-y" value={emailBody} onChange={e=>setEmailBody(e.target.value)} />
                  </div>
                  <div className="pt-2">
                    <label className="text-xs text-zinc-400">Revision Prompt (optional)</label>
                    <div className="flex gap-2 items-start">
                      <textarea className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-24 resize-y" value={revPrompt} onChange={e=>setRevPrompt(e.target.value)} placeholder="Describe how you’d like to revise the message (tone, details, emphasis)…" />
                      <button onClick={generateRevision} disabled={revLoading || !revPrompt.trim()} className="px-4 py-2 rounded-md bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 whitespace-nowrap">{revLoading ? 'Thinking…' : 'Generate'}</button>
                    </div>
                  </div>
                  {revText && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 my-2 text-zinc-400 text-xs">
                        <div className="flex-1 h-px bg-zinc-700" />
                        <span>Revisions</span>
                        <div className="flex-1 h-px bg-zinc-700" />
                      </div>
                      <textarea className="w-full bg-zinc-900 rounded-lg px-3 py-3 h-64 resize-y" value={revText} onChange={e=>setRevText(e.target.value)} />
                      <div className="mt-2 flex justify-end">
                        <button onClick={replaceWithRevision} className="px-4 py-2 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30">Replace Body</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-zinc-800 flex justify-between gap-3">
                  <div className="text-xs text-zinc-500">This is a DM template. Copy and paste into the platform. {draftSavedAt ? <span className="text-green-400">Draft saved</span> : null}</div>
                  <div className="flex gap-2">
                    <button disabled={savingDraft} className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 disabled:opacity-60" onClick={saveEmailDraft}>
                      {savingDraft ? 'Saving…' : (draftSavedAt ? 'Saved' : 'Save Draft')}
                    </button>
                    <button className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400 inline-flex items-center gap-2" onClick={copyMessage}>
                      Copy Message
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes Modal */}
          {notesOpen && notesEditing && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setNotesOpen(false)}>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-xl" onClick={e=>e.stopPropagation()}>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Notes for {notesEditing.displayName}</h3>
                  <button className="text-zinc-400 hover:text-white" onClick={() => setNotesOpen(false)}>✕</button>
                </div>
                <div className="p-4">
                  <textarea className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-48 resize-y" value={notesEditing.notes || ''} onChange={e=>setNotesEditing({...notesEditing, notes: e.target.value})} />
                </div>
                <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
                  <button className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300" onClick={()=>setNotesOpen(false)}>Close</button>
                  <button className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400" onClick={saveNotes}>Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default CreatorProspectsPage;


