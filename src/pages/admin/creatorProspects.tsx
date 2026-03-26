import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, addDoc, getDocs, updateDoc, doc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Check, User, Mail, Loader2, Filter, Search, ArrowUpDown } from 'lucide-react';
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
type SortOption = 'recently-added' | 'followers-most' | 'followers-least';

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

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'recently-added', label: 'Recently added' },
  { value: 'followers-most', label: 'Followers most' },
  { value: 'followers-least', label: 'Followers least' }
];

const surfaceClassName = 'rounded-2xl border border-zinc-800 bg-[#1a1e24] shadow-[0_18px_60px_rgba(0,0,0,0.24)]';
const inputClassName = 'w-full rounded-xl border border-zinc-700 bg-[#262a30] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:outline-none focus:border-[#d7ff00] focus:ring-2 focus:ring-[#d7ff00]/20';
const textareaClassName = `${inputClassName} py-3`;
const secondaryButtonClassName = 'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-[#262a30] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-[#2c3138] disabled:cursor-not-allowed disabled:opacity-60';
const primaryButtonClassName = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#d7ff00] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#c5e600] disabled:cursor-not-allowed disabled:opacity-60';
const accentButtonClassName = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#d7ff00]/30 bg-[#d7ff00]/10 px-4 py-2.5 text-sm font-medium text-[#d7ff00] transition hover:bg-[#d7ff00]/20 disabled:cursor-not-allowed disabled:opacity-60';
const tableHeaderClassName = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500';
const tableCellClassName = 'px-4 py-4 align-top';
const compactNumberFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const tableColumnCount = 13;

const getTimestampMs = (value: any) => {
  try {
    const date = convertFirestoreTimestamp(value as any);
    return date instanceof Date ? date.valueOf() : 0;
  } catch {
    return 0;
  }
};

const getTotalFollowers = (prospect: CreatorProspect) =>
  Object.values(prospect.followers || {}).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);

const formatFollowerCount = (value: number) => (value > 0 ? compactNumberFormatter.format(value) : '—');

const CreatorProspectsPage: React.FC = () => {
  const LOG_PREFIX = '[CreatorProspects]';
  const [form, setForm] = useState<CreatorProspect>(emptyProspect);
  const [saving, setSaving] = useState(false);

  const [prospects, setProspects] = useState<CreatorProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('new');
  const [priorityFilter, setPriorityFilter] = useState<ProspectPriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recently-added');
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
  // Bulk paste import state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<Array<CreatorProspect & { __duplicate?: boolean; __selected?: boolean }>>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const emailDraftWasOpen = useRef(false);

  useEffect(() => {
    if (emailOpen && emailProspect && !emailDraftWasOpen.current) {
      setInitialDraft({ body: emailBody, slots: proposedSlots, sender: senderType });
      setRevPrompt('');
      setRevText('');
    }
    emailDraftWasOpen.current = emailOpen;
  }, [emailOpen, emailProspect, emailBody, proposedSlots, senderType]);

  const computeDuplicate = (p: Partial<CreatorProspect>) => {
    const byEmail = p.email?.toLowerCase().trim();
    const byHandle = p.handle?.toLowerCase().trim();
    return prospects.some(ex => {
      const exEmail = (ex.email || '').toLowerCase().trim();
      const exHandle = (ex.handle || '').toLowerCase().trim();
      return (byEmail && exEmail && byEmail === exEmail) || (byHandle && exHandle && byHandle === exHandle);
    });
  };

  const parseBulk = async () => {
    if (!bulkText.trim()) return;
    setBulkParsing(true);
    try {
      const res = await fetch('/api/admin/extract-creator-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkText })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to parse');
      const items: any[] = Array.isArray(json.prospects) ? json.prospects : [];
      const preview = items.map((raw) => {
        const p: CreatorProspect = {
          displayName: (raw.displayName || '').toString(),
          handle: (raw.handle || '').toString(),
          email: (raw.email || '').toString(),
          niche: (raw.niche || '').toString(),
          country: (raw.country || '').toString(),
          ethnicity: raw.ethnicity || '',
          modality: raw.modality || '',
          platforms: raw.platforms || {},
          followers: raw.followers || {},
          engagement: raw.engagement || {},
          leadSource: 'bulk_text',
          pastLaunchHistory: '',
          priority: 'medium',
          status: 'new',
          notes: raw.notes || ''
        };
        const dup = computeDuplicate(p);
        return { ...p, __duplicate: dup, __selected: !dup };
      });
      setBulkPreview(preview);
      dispatch(showToast({ message: `Parsed ${preview.length} prospects`, type: 'success' }));
    } catch (e) {
      console.error('[CreatorProspects] bulk parse error', e);
      dispatch(showToast({ message: 'Failed to parse pasted data', type: 'error' }));
    } finally {
      setBulkParsing(false);
    }
  };

  const saveBulk = async () => {
    const toSave = bulkPreview.filter(p => p.__selected && !p.__duplicate);
    if (toSave.length === 0) { dispatch(showToast({ message: 'Nothing to save', type: 'error' })); return; }
    setBulkSaving(true);
    try {
      const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
      const batch = toSave.map(async (p) => {
        const payload: any = cleanForFirestore({
          ...p,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: actor,
          lastUpdatedBy: actor
        });
        delete payload.__duplicate; delete payload.__selected;
        await addDoc(collection(db, 'creator-prospects'), payload);
      });
      await Promise.all(batch);
      await fetchProspects();
      dispatch(showToast({ message: `Saved ${toSave.length} prospects`, type: 'success' }));
      setBulkOpen(false);
      setBulkText('');
      setBulkPreview([]);
    } catch (e) {
      console.error('[CreatorProspects] bulk save error', e);
      dispatch(showToast({ message: 'Failed to save some prospects', type: 'error' }));
    } finally {
      setBulkSaving(false);
    }
  };

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
    let rows = [...prospects];
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
    rows.sort((a, b) => {
      if (sortBy === 'followers-most') {
        const followerDelta = getTotalFollowers(b) - getTotalFollowers(a);
        if (followerDelta !== 0) return followerDelta;
      }

      if (sortBy === 'followers-least') {
        const followerDelta = getTotalFollowers(a) - getTotalFollowers(b);
        if (followerDelta !== 0) return followerDelta;
      }

      return getTimestampMs((b as any).createdAt || (b as any).updatedAt) - getTimestampMs((a as any).createdAt || (a as any).updatedAt);
    });
    return rows;
  }, [prospects, search, statusFilter, priorityFilter, sortBy]);

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

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('new');
    setPriorityFilter('all');
    setSortBy('recently-added');
  };

  const hasToolbarChanges = search.trim() || statusFilter !== 'new' || priorityFilter !== 'all' || sortBy !== 'recently-added';

  return (
    <AdminRouteGuard>
      <Head>
        <title>Creator Prospects | Admin</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white">
        <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d7ff00]/20 bg-[#d7ff00]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#d7ff00]">
                Creator pipeline
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Creator Prospects</h1>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                Manage inbound and outbound creator opportunities with the same full-width admin treatment used across the rest of the dashboard.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setBulkOpen(true)} className={accentButtonClassName}>Bulk Paste Import</button>
            </div>
          </div>

          {/* Quick Add Form */}
          <div className={`${surfaceClassName} mb-8 p-6 lg:p-8`}>
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                  <User className="h-5 w-5 text-[#d7ff00]" />
                  Add Prospect
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Capture a new creator record with contact details, audience size, and launch context.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#111417] px-4 py-3 text-sm text-zinc-400">
                New prospects save into the <span className="font-medium text-white">New</span> queue by default so outreach can move quickly.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <input className={inputClassName} placeholder="Display Name" value={form.displayName} onChange={e=>setForm({...form, displayName:e.target.value})} />
              <input className={inputClassName} placeholder="@handle" value={form.handle} onChange={e=>setForm({...form, handle:e.target.value})} />
              <input className={inputClassName} type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
              <input className={inputClassName} placeholder="Lead Source" value={form.leadSource} onChange={e=>setForm({...form, leadSource:e.target.value})} />

              <input className={inputClassName} placeholder="Niche (e.g. Fitness, Wellness)" value={form.niche} onChange={e=>setForm({...form, niche:e.target.value})} />
              <input className={inputClassName} placeholder="Country" value={form.country} onChange={e=>setForm({...form, country:e.target.value})} />
              <input className={inputClassName} placeholder="Ethnicity (optional)" value={form.ethnicity || ''} onChange={e=>setForm({...form, ethnicity:e.target.value})} />
              <input className={inputClassName} placeholder="Modality (e.g. long form, shorts, streams)" value={form.modality || ''} onChange={e=>setForm({...form, modality:e.target.value})} />

              <input className={inputClassName} inputMode="numeric" placeholder="Followers: IG" value={form.followers.instagram || ''} onChange={e=>setForm({...form, followers:{...form.followers, instagram: Number(e.target.value) || undefined}})} />
              <input className={inputClassName} inputMode="numeric" placeholder="Followers: YT" value={form.followers.youtube || ''} onChange={e=>setForm({...form, followers:{...form.followers, youtube: Number(e.target.value) || undefined}})} />
              <input className={inputClassName} inputMode="numeric" placeholder="Followers: TikTok" value={form.followers.tiktok || ''} onChange={e=>setForm({...form, followers:{...form.followers, tiktok: Number(e.target.value) || undefined}})} />
              <input className={inputClassName} inputMode="numeric" placeholder="Engagement Rate (%)" value={form.engagement?.engagementRate || ''} onChange={e=>setForm({...form, engagement:{...form.engagement, engagementRate: Number(e.target.value) || undefined}})} />

              <input className={inputClassName} inputMode="numeric" placeholder="Avg Views" value={form.engagement?.avgViews || ''} onChange={e=>setForm({...form, engagement:{...form.engagement, avgViews: Number(e.target.value) || undefined}})} />
              <input className={inputClassName} inputMode="numeric" placeholder="Avg Likes" value={form.engagement?.avgLikes || ''} onChange={e=>setForm({...form, engagement:{...form.engagement, avgLikes: Number(e.target.value) || undefined}})} />
              <input className={inputClassName} inputMode="numeric" placeholder="Avg Comments" value={form.engagement?.avgComments || ''} onChange={e=>setForm({...form, engagement:{...form.engagement, avgComments: Number(e.target.value) || undefined}})} />
              <select className={inputClassName} value={form.priority} onChange={e=>setForm({...form, priority:e.target.value as ProspectPriority})}>
                {priorities.map(p=> <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>

              <input className={`${inputClassName} md:col-span-2`} placeholder="Past Challenge/Launch History" value={form.pastLaunchHistory || ''} onChange={e=>setForm({...form, pastLaunchHistory:e.target.value})} />
              <input className={inputClassName} placeholder="Instagram URL" value={form.platforms.instagram || ''} onChange={e=>setForm({...form, platforms:{...form.platforms, instagram:e.target.value}})} />
              <input className={inputClassName} placeholder="YouTube URL" value={form.platforms.youtube || ''} onChange={e=>setForm({...form, platforms:{...form.platforms, youtube:e.target.value}})} />
              <input className={inputClassName} placeholder="TikTok URL" value={form.platforms.tiktok || ''} onChange={e=>setForm({...form, platforms:{...form.platforms, tiktok:e.target.value}})} />

              <select className={inputClassName} value={form.status} onChange={e=>setForm({...form, status:e.target.value as ProspectStatus})}>
                {statuses.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <textarea className={`${textareaClassName} md:col-span-2 xl:col-span-4 h-32 resize-y`} placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} rows={5} />
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={saveProspect} disabled={saving} className={primaryButtonClassName}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <Check className="h-4 w-4" /> Save Prospect
              </button>
            </div>
          </div>

          {/* Filters and Status Tabs */}
          <div className={`${surfaceClassName} mb-6 p-5`}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {(['all', ...statuses.map(s => s.value)] as Array<'all'|ProspectStatus>).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap transition ${statusFilter===s ? 'border-[#d7ff00] bg-[#d7ff00] text-black' : 'border-zinc-700 bg-[#262a30] text-zinc-300 hover:border-zinc-600 hover:bg-[#2c3138]'}`}
                    >
                      {s === 'all' ? 'All' : statuses.find(x=>x.value===s)?.label} ({statusCounts[s] || 0})
                    </button>
                  ))}
                </div>
                <div className="text-sm text-zinc-400">
                  Showing <span className="font-semibold text-white">{filtered.length}</span> of <span className="font-semibold text-white">{prospects.length}</span> prospects
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_220px_240px_auto]">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
                    <Filter className="h-4 w-4 text-zinc-500" />
                    Filters
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      placeholder="Search name, handle, email, niche..."
                      className={`${inputClassName} pl-10`}
                      value={search}
                      onChange={e=>setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">Priority</label>
                  <select className={inputClassName} value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value as ProspectPriority | 'all')}>
                    <option value="all">All Priorities</option>
                    {priorities.map(p=> <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
                    <ArrowUpDown className="h-4 w-4 text-zinc-500" />
                    Sort by
                  </label>
                  <select className={inputClassName} value={sortBy} onChange={e=>setSortBy(e.target.value as SortOption)}>
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button onClick={resetFilters} disabled={!hasToolbarChanges} className={secondaryButtonClassName}>
                    Reset filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className={`${surfaceClassName} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-[1480px] w-full text-sm">
                <thead className="bg-[#161a20]">
                  <tr className="border-b border-zinc-800">
                    <th className={tableHeaderClassName}>Creator</th>
                    <th className={tableHeaderClassName}>Niche</th>
                    <th className={tableHeaderClassName}>Country</th>
                    <th className={tableHeaderClassName}>Ethnicity</th>
                    <th className={tableHeaderClassName}>Platforms</th>
                    <th className={tableHeaderClassName}>Followers</th>
                    <th className={tableHeaderClassName}>Priority</th>
                    <th className={tableHeaderClassName}>Notes</th>
                    <th className={tableHeaderClassName}>Created By</th>
                    <th className={tableHeaderClassName}>Updated By</th>
                    <th className={tableHeaderClassName}>Status</th>
                    <th className={tableHeaderClassName}>Updated</th>
                    <th className={tableHeaderClassName}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td className="px-4 py-10 text-center text-zinc-400" colSpan={tableColumnCount}>Loading…</td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td className="px-4 py-10 text-center text-zinc-400" colSpan={tableColumnCount}>No prospects found.</td></tr>
                  )}
                  {!loading && filtered.map(row => {
                    const updated = convertFirestoreTimestamp(row.updatedAt as any);
                    const platforms = row.platforms || {};
                    const followerTotal = getTotalFollowers(row);
                    const followerBadges = [
                      ['IG', row.followers?.instagram],
                      ['YT', row.followers?.youtube],
                      ['TT', row.followers?.tiktok],
                      ['X', row.followers?.twitter]
                    ].filter(([, value]) => typeof value === 'number' && value > 0) as Array<[string, number]>;

                    return (
                      <tr key={row.id} className="border-b border-zinc-800/80 transition-colors hover:bg-[#20252d]">
                        <td className={tableCellClassName}>
                          <div className="font-medium text-white">
                            {row.displayName || 'Unnamed prospect'}{' '}
                            <span className="text-zinc-400">{row.handle && `(${row.handle})`}</span>
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">{row.email || 'No email added'}</div>
                          {row.leadSource && <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500">{row.leadSource}</div>}
                        </td>
                        <td className={`${tableCellClassName} text-zinc-300`}>
                          {row.niche || '—'} {row.modality ? <span className="text-zinc-500">• {row.modality}</span> : null}
                        </td>
                        <td className={`${tableCellClassName} text-zinc-300`}>{row.country || '—'}</td>
                        <td className={`${tableCellClassName} text-zinc-300`}>{row.ethnicity || '—'}</td>
                        <td className={tableCellClassName}>
                          <div className="flex flex-wrap gap-2">
                            {platforms.instagram && (
                              <a className="rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-1 text-xs text-pink-300 transition hover:bg-pink-500/20" href={platforms.instagram} target="_blank" rel="noopener noreferrer">IG</a>
                            )}
                            {platforms.youtube && (
                              <a className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/20" href={platforms.youtube} target="_blank" rel="noopener noreferrer">YT</a>
                            )}
                            {platforms.tiktok && (
                              <a className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-xs text-white transition hover:bg-white/10" href={platforms.tiktok} target="_blank" rel="noopener noreferrer">TT</a>
                            )}
                            {platforms.twitter && (
                              <a className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs text-blue-300 transition hover:bg-blue-500/20" href={platforms.twitter} target="_blank" rel="noopener noreferrer">X</a>
                            )}
                            {!platforms.instagram && !platforms.youtube && !platforms.tiktok && !platforms.twitter && <span className="text-zinc-500">—</span>}
                          </div>
                        </td>
                        <td className={tableCellClassName}>
                          <div className="font-semibold text-white">{formatFollowerCount(followerTotal)}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {followerBadges.length > 0 ? followerBadges.map(([label, value]) => (
                              <span key={label} className="rounded-full border border-zinc-700 bg-[#262a30] px-2 py-1 text-[11px] text-zinc-300">
                                {label} {formatFollowerCount(value)}
                              </span>
                            )) : <span className="text-xs text-zinc-500">No follower data</span>}
                          </div>
                        </td>
                        <td className={tableCellClassName}>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.priority === 'high' ? 'bg-red-500/10 text-red-300' : row.priority === 'low' ? 'bg-zinc-700 text-zinc-200' : 'bg-yellow-500/10 text-yellow-300'}`}>{row.priority}</span>
                        </td>
                        <td className={tableCellClassName}>
                          {row.notes ? (
                            <button onClick={() => openNotes(row)} className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300 transition hover:bg-blue-500/20">
                              Has notes
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-500">—</span>
                          )}
                        </td>
                        <td className={`${tableCellClassName} text-zinc-300`}>{row.createdBy || '—'}</td>
                        <td className={`${tableCellClassName} text-zinc-300`}>{row.lastUpdatedBy || '—'}</td>
                        <td className={tableCellClassName}>
                          <select className={`${inputClassName} min-w-[150px] py-2`} value={row.status} onChange={e=>changeStatus(row, e.target.value as ProspectStatus)}>
                            {statuses.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className={`${tableCellClassName} text-zinc-400`}>{formatDate(updated)}</td>
                        <td className={tableCellClassName}>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openDetail(row)} className={secondaryButtonClassName}>View</button>
                            <button onClick={() => openEmail(row)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20">
                              <Mail className="h-4 w-4" /> DM
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

      {/* Bulk Paste Modal */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setBulkOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl" onClick={e=>e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Bulk Paste Import</h3>
              <button className="text-zinc-400 hover:text-white" onClick={() => setBulkOpen(false)}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-white">Paste a list, table, or freeform text. We’ll extract creator details (name, email, niche, handles) and prepare a preview.</p>
              <textarea className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-48 resize-y text-white" placeholder="Paste data here..." value={bulkText} onChange={e=>setBulkText(e.target.value)} />
              <div className="flex justify-end">
                <button onClick={parseBulk} disabled={bulkParsing || !bulkText.trim()} className="px-4 py-2 rounded-md bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30">{bulkParsing ? 'Parsing…' : 'Parse'}</button>
              </div>
              {bulkPreview.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm text-white mb-2">Preview ({bulkPreview.length}). Duplicates are disabled.</div>
                  <div className="max-h-72 overflow-y-auto border border-zinc-800 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white border-b border-zinc-800">
                          <th className="p-2 text-left">Add</th>
                          <th className="p-2 text-left">Name</th>
                          <th className="p-2 text-left">Handle</th>
                          <th className="p-2 text-left">Email</th>
                          <th className="p-2 text-left">Niche</th>
                          <th className="p-2 text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPreview.map((p, idx) => (
                          <tr key={idx} className="border-b border-zinc-800">
                            <td className="p-2">
                              <input type="checkbox" checked={!!p.__selected && !p.__duplicate} disabled={p.__duplicate} onChange={(e)=>{
                                setBulkPreview(prev=>prev.map((x,i)=> i===idx ? { ...x, __selected: e.target.checked } : x));
                              }} />
                              {p.__duplicate && <span className="ml-2 text-xs text-orange-400">duplicate</span>}
                            </td>
                            <td className="p-2 text-white">{p.displayName || '—'}</td>
                            <td className="p-2 text-white">{p.handle || '—'}</td>
                            <td className="p-2 text-white">{p.email || '—'}</td>
                            <td className="p-2 text-white">{p.niche || '—'}</td>
                            <td className="p-2 text-white">{p.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-zinc-800 flex justify-between gap-3">
              <div className="text-xs text-zinc-500">We’ll mark created records with status "new" and lead source "bulk_text".</div>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300" onClick={()=>setBulkOpen(false)}>Close</button>
                <button className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400 disabled:opacity-60" disabled={bulkSaving || bulkPreview.filter(p=>p.__selected && !p.__duplicate).length===0} onClick={saveBulk}>
                  {bulkSaving ? 'Saving…' : `Add ${bulkPreview.filter(p=>p.__selected && !p.__duplicate).length} Prospects`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default CreatorProspectsPage;
