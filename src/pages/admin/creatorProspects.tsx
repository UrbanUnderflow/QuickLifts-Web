import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, addDoc, getDocs, orderBy, query, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Check, User, Mail, Globe, Users, Target, Loader2, Filter } from 'lucide-react';
import { convertFirestoreTimestamp, formatDate } from '../../utils/formatDate';

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
  leadSource: string;
  priority: ProspectPriority;
  status: ProspectStatus;
  notes: string;
  createdAt?: any;
  updatedAt?: any;
}

const emptyProspect: CreatorProspect = {
  displayName: '',
  handle: '',
  email: '',
  niche: '',
  country: '',
  platforms: {},
  followers: {},
  leadSource: '',
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
  const [form, setForm] = useState<CreatorProspect>(emptyProspect);
  const [saving, setSaving] = useState(false);

  const [prospects, setProspects] = useState<CreatorProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ProspectPriority | 'all'>('all');

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

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const qy = query(collection(db, 'creator-prospects'), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(qy);
      const rows: CreatorProspect[] = [];
      snap.forEach(d => {
        const data = d.data() as any;
        rows.push({ id: d.id, ...(data as CreatorProspect) });
      });
      setProspects(rows);
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
      const payload = {
        ...form,
        createdAt: new Date(),
        updatedAt: new Date()
      } as CreatorProspect;
      await addDoc(collection(db, 'creator-prospects'), payload as any);
      setForm(emptyProspect);
      await fetchProspects();
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (row: CreatorProspect, status: ProspectStatus) => {
    if (!row.id) return;
    await updateDoc(doc(db, 'creator-prospects', row.id), {
      status,
      updatedAt: new Date()
    });
    setProspects(prev => prev.map(p => (p.id === row.id ? { ...p, status } : p)));
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
              <input className="bg-zinc-800 rounded-lg px-3 py-2" placeholder="Lead Source"
                     value={form.leadSource} onChange={e=>setForm({...form, leadSource:e.target.value})} />

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

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2 text-zinc-400"><Filter className="w-4 h-4" />Filters</div>
            <input placeholder="Search name, handle, email..." className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex-1 min-w-[240px]"
                   value={search} onChange={e=>setSearch(e.target.value)} />
            <select className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)}>
              <option value="all">All Statuses</option>
              {statuses.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value as any)}>
              <option value="all">All Priorities</option>
              {priorities.map(p=> <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800">
                  <th className="text-left p-3">Creator</th>
                  <th className="text-left p-3">Niche</th>
                  <th className="text-left p-3">Country</th>
                  <th className="text-left p-3">Platforms</th>
                  <th className="text-left p-3">Priority</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td className="p-4 text-zinc-400" colSpan={7}>Loading…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td className="p-4 text-zinc-400" colSpan={7}>No prospects found.</td></tr>
                )}
                {!loading && filtered.map(row => {
                  const updated = convertFirestoreTimestamp(row.updatedAt as any);
                  const platformBadges = [
                    row.platforms.instagram && 'IG',
                    row.platforms.youtube && 'YT',
                    row.platforms.tiktok && 'TT',
                    row.platforms.twitter && 'X'
                  ].filter(Boolean).join(' · ');
                  return (
                    <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                      <td className="p-3">
                        <div className="font-medium text-white">{row.displayName} <span className="text-zinc-400">{row.handle && `(${row.handle})`}</span></div>
                        <div className="text-zinc-400 text-xs">{row.email}</div>
                      </td>
                      <td className="p-3 text-zinc-300">{row.niche}</td>
                      <td className="p-3 text-zinc-300">{row.country}</td>
                      <td className="p-3 text-zinc-300">{platformBadges || '—'}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${row.priority === 'high' ? 'bg-red-500/10 text-red-400' : row.priority === 'low' ? 'bg-zinc-700 text-zinc-200' : 'bg-yellow-500/10 text-yellow-400'}`}>{row.priority}</span>
                      </td>
                      <td className="p-3">
                        <select className="bg-zinc-800 rounded-md px-2 py-1" value={row.status} onChange={e=>changeStatus(row, e.target.value as ProspectStatus)}>
                          {statuses.map(s=> <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="p-3 text-zinc-400">{formatDate(updated)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default CreatorProspectsPage;


