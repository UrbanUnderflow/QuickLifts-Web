import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, addDoc, getDocs, orderBy, query, updateDoc, doc } from 'firebase/firestore';
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
type ProgramSize =
  | '0-5000'
  | '5000 - 10000'
  | '10000 - 15,000'
  | '15000 - 25000'
  | '25000 - 50000'
  | '50000 - 100000'
  | '100000+';

interface UniversityProspect {
  id?: string;
  university: string;
  sport: string;
  decisionMaker: string;
  title: string;
  email: string;
  programSize: ProgramSize;
  priority: ProspectPriority;
  status: ProspectStatus;
  notes: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  lastUpdatedBy?: string;
}

const emptyProspect: UniversityProspect = {
  university: '',
  sport: '',
  decisionMaker: '',
  title: '',
  email: '',
  programSize: '0-5000',
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

const UniversityProspectsPage: React.FC = () => {
  const [form, setForm] = useState<UniversityProspect>(emptyProspect);
  const [saving, setSaving] = useState(false);

  const [prospects, setProspects] = useState<UniversityProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('new');
  const [priorityFilter, setPriorityFilter] = useState<ProspectPriority | 'all'>('all');
  const currentUser = useSelector((s: RootState) => s.user.currentUser);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<UniversityProspect | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState<UniversityProspect | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailProspect, setEmailProspect] = useState<UniversityProspect | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [pilotLength, setPilotLength] = useState('8–12 weeks');
  const [proposedSlots, setProposedSlots] = useState('Monday, Tuesday and Thursday before 12:45pm EST');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const PROGRAM_SIZE_OPTIONS: ProgramSize[] = ['0-5000','5000 - 10000','10000 - 15,000','15000 - 25000','25000 - 50000','50000 - 100000','100000+'];
  const dispatch = useDispatch();
  const [initialEmailDraft, setInitialEmailDraft] = useState<{ subject: string; body: string; pilot: string; slots: string } | null>(null);

  useEffect(() => {
    if (emailOpen && emailProspect) {
      setInitialEmailDraft({ subject: emailSubject, body: emailBody, pilot: pilotLength, slots: proposedSlots });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailOpen]);

  const emailDirty = !!initialEmailDraft && (
    initialEmailDraft.subject !== emailSubject ||
    initialEmailDraft.body !== emailBody ||
    initialEmailDraft.pilot !== pilotLength ||
    initialEmailDraft.slots !== proposedSlots
  );

  const requestCloseEmail = async () => {
    if (emailDirty) {
      const shouldSave = window.confirm('You have unsaved changes. Click OK to save as a draft, or Cancel to discard.');
      if (shouldSave) {
        await saveEmailDraft();
      }
    }
    setEmailOpen(false);
  };

  const filtered = useMemo(() => {
    let rows = prospects;
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
    if (priorityFilter !== 'all') rows = rows.filter(r => r.priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.university || '').toLowerCase().includes(q) ||
        (r.sport || '').toLowerCase().includes(q) ||
        (r.decisionMaker || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [prospects, search, statusFilter, priorityFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: prospects.length };
    statuses.forEach(s => { counts[s.value] = prospects.filter(p => p.status === s.value).length; });
    return counts;
  }, [prospects]);

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const qy = query(collection(db, 'university-prospects'), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(qy);
      const rows: UniversityProspect[] = [];
      snap.forEach(d => {
        const data = d.data() as any;
        rows.push({ id: d.id, ...(data as UniversityProspect) });
      });
      setProspects(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const pickPrimarySport = (sportText: string): string => {
    if (!sportText) return 'Athletics';
    const normalized = sportText.replace(/\//g, ',');
    const parts = normalized.split(',').map(s => s.trim()).filter(Boolean);
    return parts[0] || 'Athletics';
  };

  const generateEmail = (p: UniversityProspect, pilot: string, slots: string): { subject: string; body: string } => {
    const sportPrimary = pickPrimarySport(p.sport);
    const slotsText = slots || 'Monday, Tuesday and Thursday before 12:45pm EST';
    const body = `Hi ${p.decisionMaker.split(' ')[0] || 'there'},\n\nI'm Tremaine Grant, founder of Pulse Fitness Collective. We built PulseCheck, a lightweight, always‑on sport‑psych companion and simple CRM that helps coaches track mood, RPE and readiness across large rosters. I know how hard it is for staffs to keep a close pulse on every athlete’s mental readiness, which is tightly linked to performance.\n\nPulseCheck improves session intent and adherence and gives coaches a centralized dashboard that flags athletes who might need extra attention. We can start a ${pilot || '8–12 weeks'} pilot with 1–3 teams (e.g., ${p.sport}). During the pilot we’ll track adherence, session‑intent and readiness trends and deliver a short impact report. If it’s a fit, scaling to more teams or department‑wide is straightforward, with the same workflows and flexible licensing. It’s turnkey: Pulse handles onboarding, daily check‑ins and weekly insight briefs. Data exports cleanly to CSV/Sheets.\n\nIf you’re open, I can share a brief overview and learn how you support your teams today. ${slotsText} could work on my end, but I’m happy to adjust to whatever’s easiest. Feel free to loop in performance or sport‑psych staff.\n\nBest,\nTremaine\nFounder & CEO, Pulse Fitness Collective\ntre@fitwithpulse.ai`;
    // Concise subject: prefer short, readable formats. If the full variant is long, fall back to a shorter pilot-oriented version.
    const fullSubject = `PulseCheck for ${sportPrimary} at ${p.university}`;
    const shortSubject = `PulseCheck pilot for ${sportPrimary}`;
    const subject = fullSubject.length <= 60 ? fullSubject : shortSubject;
    return { subject, body };
  };

  const openEmail = (row: UniversityProspect) => {
    setEmailProspect(row);
    const { subject, body } = generateEmail(row, pilotLength, proposedSlots);
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
      await updateDoc(doc(db, 'university-prospects', emailProspect.id), {
        emailDraftSubject: emailSubject,
        emailDraftBody: emailBody,
        pilotLength,
        proposedSlots,
        updatedAt: now,
        lastUpdatedBy: actor
      } as any);
      // reflect in local list so Updated column shows immediately
      setProspects(prev => prev.map(p => p.id === emailProspect.id ? { ...p, lastUpdatedBy: actor, updatedAt: now } : p));
      setDraftSavedAt(now);
      setTimeout(() => setDraftSavedAt(null), 2000);
    } catch (e) {
      console.error('Save draft failed', e);
      alert('Failed to save draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const sendEmail = async () => {
    if (!emailProspect?.email) return;
    setEmailSending(true);
    try {
      const res = await fetch('/api/admin/send-university-prospect-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: { email: emailProspect.email, name: emailProspect.decisionMaker || emailProspect.university },
          subject: emailSubject,
          textContent: emailBody
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to send');
      // persist send metadata
      if (emailProspect.id) {
        const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
        await updateDoc(doc(db, 'university-prospects', emailProspect.id), {
          lastEmailSubject: emailSubject,
          lastEmailBody: emailBody,
          lastEmailSentAt: new Date(),
          lastEmailMessageId: json.messageId || null,
          status: 'contacted',
          updatedAt: new Date(),
          lastUpdatedBy: actor
        } as any);
        // reflect locally in UI
        setProspects(prev => prev.map(p => p.id === emailProspect.id ? { ...p, status: 'contacted', updatedAt: new Date(), lastUpdatedBy: actor } : p));
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

  const saveProspect = async () => {
    setSaving(true);
    try {
      const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
      const payload = {
        ...form,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: actor,
        lastUpdatedBy: actor
      } as UniversityProspect;
      await addDoc(collection(db, 'university-prospects'), payload as any);
      setForm(emptyProspect);
      await fetchProspects();
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (row: UniversityProspect, status: ProspectStatus) => {
    if (!row.id) return;
    const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
    await updateDoc(doc(db, 'university-prospects', row.id), {
      status,
      updatedAt: new Date(),
      lastUpdatedBy: actor
    });
    setProspects(prev => prev.map(p => (p.id === row.id ? { ...p, status, lastUpdatedBy: actor, updatedAt: new Date() } : p)));
  };

  const openDetail = (row: UniversityProspect) => {
    setEditing(row);
    setDetailOpen(true);
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    const { id, ...rest } = editing;
    const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
    await updateDoc(doc(db, 'university-prospects', id), {
      ...rest,
      updatedAt: new Date(),
      lastUpdatedBy: actor
    } as any);
    setProspects(prev => prev.map(p => (p.id === id ? { ...p, ...rest, lastUpdatedBy: actor, updatedAt: new Date() } : p)));
    setDetailOpen(false);
  };

  const openNotes = (row: UniversityProspect) => {
    setNotesEditing(row);
    setNotesOpen(true);
  };

  const saveNotes = async () => {
    if (!notesEditing?.id) return;
    const actor = (currentUser?.username || currentUser?.displayName || currentUser?.email || 'admin') as string;
    await updateDoc(doc(db, 'university-prospects', notesEditing.id), {
      notes: notesEditing.notes || '',
      updatedAt: new Date(),
      lastUpdatedBy: actor
    });
    setProspects(prev => prev.map(p => (p.id === notesEditing.id ? { ...p, notes: notesEditing.notes, lastUpdatedBy: actor, updatedAt: new Date() } : p)));
    setNotesOpen(false);
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>University Prospects | Admin</title>
      </Head>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">University Prospects</h1>
            <p className="text-zinc-400">Manage decision makers at universities.</p>
          </div>

          {/* Quick Add Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-[#E0FE10]" /> Add Prospect</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="University"
                     value={form.university} onChange={e=>setForm({...form, university:e.target.value})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Sport (e.g., Basketball/Track/Swimming)"
                     value={form.sport} onChange={e=>setForm({...form, sport:e.target.value})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Decision Maker"
                     value={form.decisionMaker} onChange={e=>setForm({...form, decisionMaker:e.target.value})} />

              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Title (e.g., Director of Athletics)"
                     value={form.title} onChange={e=>setForm({...form, title:e.target.value})} />
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Email"
                     value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
              <select className="bg-zinc-800 rounded-lg px-3 py-2" value={form.programSize} onChange={e=>setForm({...form, programSize:e.target.value as ProgramSize})}>
                {PROGRAM_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

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
              <input placeholder="Search name, email..." className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex-1 min-w-[240px]"
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
                  <th className="text-left p-3">University</th>
                  <th className="text-left p-3">Sport</th>
                  <th className="text-left p-3">Decision Maker</th>
                  <th className="text-left p-3">Title</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Student Body Range</th>
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
                  return (
                    <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                      <td className="p-3">
                        <div className="font-medium text-white">{row.university}</div>
                      </td>
                      <td className="p-3 text-zinc-300">{row.sport}</td>
                      <td className="p-3 text-zinc-300">{row.decisionMaker}</td>
                      <td className="p-3 text-zinc-300">{row.title}</td>
                      <td className="p-3 text-zinc-300">{row.email}</td>
                      <td className="p-3 text-zinc-300">{row.programSize}</td>
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
                            <Mail className="w-4 h-4" /> Email
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
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="University" value={editing.university} onChange={e=>setEditing({...editing, university:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Sport" value={editing.sport} onChange={e=>setEditing({...editing, sport:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Decision Maker" value={editing.decisionMaker} onChange={e=>setEditing({...editing, decisionMaker:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Title" value={editing.title} onChange={e=>setEditing({...editing, title:e.target.value})} />
                  <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Email" value={editing.email} onChange={e=>setEditing({...editing, email:e.target.value})} />
                  <select className="bg-zinc-800 rounded-lg px-3 py-2" value={editing.programSize} onChange={e=>setEditing({...editing!, programSize: e.target.value as ProgramSize})}>
                    {PROGRAM_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <select className="bg-zinc-800 rounded-lg px-3 py-2" value={editing.priority} onChange={e=>setEditing({...editing!, priority: e.target.value as ProspectPriority})}>
                    {priorities.map(p=> <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <select className="bg-zinc-800 rounded-lg px-3 py-2" value={editing.status} onChange={e=>setEditing({...editing!, status: e.target.value as ProspectStatus})}>
                    {statuses.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <textarea className="bg-zinc-800 rounded-lg px-3 py-3 md:col-span-2 h-32 resize-y" placeholder="Notes" value={editing.notes} onChange={e=>setEditing({...editing, notes:e.target.value})} />
                </div>
                <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
                  <button className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300" onClick={()=>setDetailOpen(false)}>Close</button>
                  <button className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400" onClick={saveEdit}>Save Changes</button>
                </div>
              </div>
            </div>
          )}

          {/* Email Generation & Send Modal */}
          {emailOpen && emailProspect && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl" onClick={e=>e.stopPropagation()}>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Email {emailProspect.decisionMaker || emailProspect.university}</h3>
                  <button className="text-zinc-400 hover:text-white" onClick={requestCloseEmail}>✕</button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400">From</label>
                      <input className="w-full bg-zinc-800 rounded-lg px-3 py-2" value={'tre@fitwithpulse.ai'} readOnly />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400">To</label>
                      <input className="w-full bg-zinc-800 rounded-lg px-3 py-2" value={`${emailProspect.decisionMaker || ''} <${emailProspect.email}>`} readOnly />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400">Pilot Length</label>
                      <input className="w-full bg-zinc-800 rounded-lg px-3 py-2" value={pilotLength} onChange={e=>{setPilotLength(e.target.value); if (emailProspect) { const g = generateEmail(emailProspect, e.target.value, proposedSlots); setEmailSubject(g.subject); setEmailBody(g.body);} }} />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400">Proposed Slots</label>
                      <input className="w-full bg-zinc-800 rounded-lg px-3 py-2" value={proposedSlots} onChange={e=>{setProposedSlots(e.target.value); if (emailProspect) { const g = generateEmail(emailProspect, pilotLength, e.target.value); setEmailSubject(g.subject); setEmailBody(g.body);} }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Subject</label>
                    <input className="w-full bg-zinc-800 rounded-lg px-3 py-2" value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Body</label>
                    <textarea className="w-full bg-zinc-800 rounded-lg px-3 py-3 h-72 resize-y" value={emailBody} onChange={e=>setEmailBody(e.target.value)} />
                  </div>
                </div>
                <div className="p-4 border-t border-zinc-800 flex justify-between gap-3">
                  <div className="text-xs text-zinc-500">
                    {draftSavedAt ? <span className="text-green-400">Draft saved</span> : 'This email will be sent via Brevo.'}
                  </div>
                  <div className="flex gap-2">
                    <button disabled={savingDraft} className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 disabled:opacity-60" onClick={saveEmailDraft}>
                      {savingDraft ? 'Saving…' : (draftSavedAt ? 'Saved' : 'Save Draft')}
                    </button>
                    <button disabled={emailSending} className="px-4 py-2 rounded-md bg-[#E0FE10] text-black font-semibold hover:bg-lime-400 inline-flex items-center gap-2" onClick={sendEmail}>
                      {emailSending && <Loader2 className="w-4 h-4 animate-spin" />} Send
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
                  <h3 className="text-xl font-semibold">Notes for {notesEditing.decisionMaker || notesEditing.university}</h3>
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

export default UniversityProspectsPage;


