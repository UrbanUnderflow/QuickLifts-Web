import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FaBars, FaTimes } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { useUser } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { db } from '../../api/firebase/config';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { convertFirestoreTimestamp, formatDate } from '../../utils/formatDate';

type StaffMember = {
  id: string;
  email: string;
  role: 'admin' | 'staff';
  status: 'invited' | 'active';
  permission: 'full' | 'limited';
  profileImageUrl?: string;
  addedAt?: number;
  allowedAthletes?: string[];
};

type AthleteSummary = {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  profileImageURL?: string;
};

type Membership = {
  coachId: string;
  coachName: string;
  coachEmail?: string;
  permission: 'full' | 'limited';
  since?: number; // seconds
};

const StaffPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<AthleteSummary[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<StaffMember | null>(null);
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [memberOf, setMemberOf] = useState<Membership[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Load staff from Firestore
  useEffect(() => {
    const load = async () => {
      if (!currentUser?.id) return;
      try {
        const membersRef = collection(db, 'coach-staff', currentUser.id, 'members');
        const snap = await getDocs(membersRef);
        const rows: StaffMember[] = snap.docs.map(d => {
          const data = d.data() as any;
          // Normalize addedAt to seconds since epoch
          const addedDate = data.addedAt ? convertFirestoreTimestamp(data.addedAt) : null;
          const addedAtSec = addedDate ? Math.floor(addedDate.getTime() / 1000) : undefined;
          return {
            id: d.id,
            email: data.email || '',
            role: data.role || 'staff',
            status: data.status || 'invited',
            permission: data.permission || 'limited',
            profileImageUrl: data.profileImageUrl || '',
            addedAt: addedAtSec,
            allowedAthletes: Array.isArray(data.allowedAthletes) ? data.allowedAthletes : []
          };
        });
        setStaff(rows);
      } catch (_) {
        setStaff([]);
      }
    };
    load();
  }, [currentUser?.id]);

  // Load memberships where current user is staff for other coaches
  useEffect(() => {
    const loadMemberships = async () => {
      if (!currentUser?.email) return;
      try {
        const invitesRef = collection(db, 'staff-invites');
        const qInv = query(
          invitesRef,
          where('memberEmail', '==', currentUser.email.toLowerCase()),
          where('status', '==', 'accepted')
        );
        const snap = await getDocs(qInv);
        const rows: Membership[] = [];
        for (const d of snap.docs) {
          const data = d.data() as any;
          let coachName = 'Coach';
          let coachEmail: string | undefined = undefined;
          try {
            const uref = doc(db, 'users', data.coachId);
            const usnap = await getDoc(uref);
            if (usnap.exists()) {
              const u = usnap.data() as any;
              coachName = u.username || u.displayName || 'Coach';
              coachEmail = u.email;
            }
          } catch (_) {}
          const sinceDate = data.updatedAt ? convertFirestoreTimestamp(data.updatedAt) : (data.createdAt ? convertFirestoreTimestamp(data.createdAt) : null);
          rows.push({
            coachId: data.coachId,
            coachName,
            coachEmail,
            permission: (data.permission as 'full' | 'limited') || 'limited',
            since: sinceDate ? Math.floor(sinceDate.getTime() / 1000) : undefined
          });
        }
        setMemberOf(rows);
      } catch (_) {
        setMemberOf([]);
      }
    };
    loadMemberships();
  }, [currentUser?.email]);

  // Load connected athletes for this coach (once)
  useEffect(() => {
    const loadAthletes = async () => {
      if (!currentUser?.id) return;
      try {
        // Prefer coachService if available, otherwise query coachAthletes + users
        try {
          // If a helper exists, use it (wrapped in try to avoid hard errors)
          const getter: any = (coachService as any).getConnectedAthletes;
          const list = typeof getter === 'function' ? await getter(currentUser.id) : null;
          if (Array.isArray(list) && list.length) {
            const mapped: AthleteSummary[] = list.map((a: any) => ({
              id: a.id || a.userId || '',
              username: a.username || '',
              email: a.email || '',
              displayName: a.displayName || '',
              profileImageURL: a.profileImage?.profileImageURL || a.profileImageURL || ''
            })).filter(a => a.id);
            setAthletes(mapped);
            return;
          }
        } catch (_) {}

        // Fallback: query Firestore directly
        const relQ = query(
          collection(db, 'coachAthletes'),
          where('coachId', '==', currentUser.id)
        );
        const relSnap = await getDocs(relQ);
        const athleteIds = relSnap.docs
          .map(d => (d.data() as any))
          .filter(r => (r.status || 'active') !== 'disconnected')
          .map(r => r.athleteUserId || r.athleteId)
          .filter(Boolean);
        const results: AthleteSummary[] = [];
        await Promise.all(
          athleteIds.map(async (aid: string) => {
            const uref = doc(db, 'users', aid);
            const usnap = await getDoc(uref);
            if (usnap.exists()) {
              const u = usnap.data() as any;
              results.push({
                id: aid,
                username: u.username || '',
                email: u.email || '',
                displayName: u.displayName || '',
                profileImageURL: (u.profileImage && u.profileImage.profileImageURL) || ''
              });
            }
          })
        );
        setAthletes(results.sort((a,b)=> (a.username||'').localeCompare(b.username||'')));
      } catch (_) {
        setAthletes([]);
      }
    };
    loadAthletes();
  }, [currentUser?.id]);

  const filtered = useMemo(
    () => staff.filter(s => s.email.toLowerCase().includes(searchQuery.toLowerCase())),
    [staff, searchQuery]
  );

  const sendInvite = async () => {
    if (!inviteEmail) return;
    setSending(true);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      let referral = '';
      try {
        if (currentUser?.id) {
          const profile = await coachService.getCoachProfile(currentUser.id);
          referral = profile?.referralCode || '';
        }
      } catch (_) {}
      const refParam = referral || (currentUser?.username || '');
      const inviteUrl = `${base}/coach/inbox`;
      const signUpUrl = `${base}/coach/sign-up?ref=${encodeURIComponent(refParam)}`;
      const res = await fetch('/.netlify/functions/send-staff-invite-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: inviteEmail,
          coachName: currentUser?.username || 'a Pulse coach',
          inviteUrl,
          signUpUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to send invite');
      // Persist invited staff to Firestore (coach-staff member)
      if (currentUser?.id) {
        const id = inviteEmail.toLowerCase();
        const memberRef = doc(db, 'coach-staff', currentUser.id, 'members', id);
        await setDoc(memberRef, {
          email: inviteEmail.toLowerCase(),
          role: 'staff',
          status: 'invited',
          permission: 'limited',
          profileImageUrl: '',
          addedAt: serverTimestamp()
        }, { merge: true });

        // Also create a dedicated staff invite record for simpler querying
        try {
          const inviteId = `${currentUser.id}_${id}`;
          const inviteRef = doc(db, 'staff-invites', inviteId);
          await setDoc(inviteRef, {
            id: inviteId,
            coachId: currentUser.id,
            memberEmail: id,
            status: 'invited',
            permission: 'limited',
            allowedAthletes: [],
            invitedBy: currentUser.id,
            coachUsername: currentUser.username || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (_) { /* non-blocking */ }
        // Reflect locally
        setStaff(prev => {
          const exists = prev.find(p => p.id === id);
          const next: StaffMember = {
            id,
            email: inviteEmail.toLowerCase(),
            role: 'staff',
            status: 'invited',
            permission: 'limited',
            profileImageUrl: '',
            addedAt: Math.floor(Date.now() / 1000)
          };
          return exists ? prev.map(p => p.id === id ? next : p) : [next, ...prev];
        });
      }
      setToast('Invite sent');
      setShowModal(false);
      setInviteEmail('');
      setTimeout(()=>setToast(null), 2500);
    } catch (e: any) {
      setToast(e.message || 'Failed to send invite');
      setTimeout(()=>setToast(null), 3500);
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Staff</h1>
            <p className="text-zinc-400">Manage staff coaches and permissions.</p>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            {[
              { href: '/coach/dashboard', label: 'Dashboard' },
              { href: '/coach/referrals', label: 'Referrals' },
              { href: '/coach/staff', label: 'Staff' },
              { href: '/coach/inbox', label: 'Inbox' },
              { href: '/coach/profile', label: 'Profile' }
            ].map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
          >
            <FaBars />
          </button>
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute top-0 right-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 shadow-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="text-lg font-semibold text-white">Menu</div>
                <button
                  aria-label="Close navigation"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { href: '/coach/dashboard', label: 'Dashboard' },
                  { href: '/coach/referrals', label: 'Referrals' },
                  { href: '/coach/staff', label: 'Staff' },
                  { href: '/coach/inbox', label: 'Inbox' },
                  { href: '/coach/profile', label: 'Profile' }
                ].map((item) => {
                  const isActive = router.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <input
            value={searchQuery}
            onChange={(e)=>setSearchQuery(e.target.value)}
            placeholder="Search staff by email..."
            className="w-full max-w-md bg-zinc-900 text-white px-4 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-[#E0FE10]"
          />
          <button
            onClick={()=>setShowModal(true)}
            className="ml-4 bg-[#E0FE10] text-black px-4 py-2 rounded-lg hover:bg-lime-400 transition-colors"
          >
            Add Staff
          </button>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-sm text-zinc-400 border-b border-zinc-800">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Permission</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-500 text-sm" colSpan={5}>No staff yet.</td>
                </tr>
              ) : filtered.map(m => (
                <tr key={m.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={m.profileImageUrl && m.profileImageUrl.length > 0 ? m.profileImageUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(m.email)}&background=E0FE10&color=000000&size=64`}
                        alt={m.email}
                        className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                      />
                      <span>{m.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{m.role}</td>
                  <td className="px-4 py-3 capitalize">
                    <span className={`px-2 py-1 text-xs rounded-full ${m.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-zinc-700/50 text-zinc-200'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.permission}
                      onChange={async (e)=>{
                        const value = e.target.value as 'full' | 'limited';
                        setStaff(prev => prev.map(p => p.id === m.id ? { ...p, permission: value } : p));
                        try {
                          if (currentUser?.id) {
                            const memberRef = doc(db, 'coach-staff', currentUser.id, 'members', m.id);
                            await updateDoc(memberRef, { permission: value, updatedAt: serverTimestamp() });
                            // Mirror permission on staff-invites
                            const inviteRef = doc(db, 'staff-invites', `${currentUser.id}_${m.id}`);
                            await updateDoc(inviteRef, { permission: value, updatedAt: serverTimestamp() });
                          }
                        } catch(_) {}
                      }}
                      className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm"
                    >
                      <option value="full">Full access</option>
                      <option value="limited">Limited</option>
                    </select>
                    {m.permission === 'limited' && (
                      <button
                        onClick={()=>{ setAssignFor(m); setSelectedAthletes(m.allowedAthletes || []); setAssignOpen(true); }}
                        className="ml-2 text-xs px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600"
                      >
                        {m.allowedAthletes && m.allowedAthletes.length > 0 ? `Manage (${m.allowedAthletes.length})` : 'Assign athletes'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{m.addedAt ? formatDate(new Date(m.addedAt * 1000)) : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async ()=>{
                        if (!currentUser?.id) return;
                        const confirmed = window.confirm(`Remove ${m.email} from staff?`);
                        if (!confirmed) return;
                        try {
                          const memberRef = doc(db, 'coach-staff', currentUser.id, 'members', m.id);
                          await deleteDoc(memberRef);
                          // Optional: mark invite as removed/declined
                          try {
                            const inviteRef = doc(db, 'staff-invites', `${currentUser.id}_${m.id}`);
                            await updateDoc(inviteRef, { status: 'declined', updatedAt: serverTimestamp() });
                          } catch (_) {}
                          setStaff(prev => prev.filter(p => p.id !== m.id));
                          setToast('Staff removed'); setTimeout(()=>setToast(null), 2000);
                        } catch (e) {
                          setToast('Failed to remove staff'); setTimeout(()=>setToast(null), 2500);
                        }
                      }}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Memberships Section */}
        <div className="mt-10">
          <h3 className="text-xl font-semibold mb-3">You are a staff member to</h3>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-sm text-zinc-400 border-b border-zinc-800">
                  <th className="px-4 py-3">Coach</th>
                  <th className="px-4 py-3">Permission</th>
                  <th className="px-4 py-3">Since</th>
                </tr>
              </thead>
              <tbody>
                {memberOf.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-zinc-500 text-sm" colSpan={3}>You are not a staff member to any coach.</td>
                  </tr>
                ) : memberOf.map(m => (
                  <tr key={m.coachId} className="border-t border-zinc-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E0FE10] text-black flex items-center justify-center text-xs font-bold border border-zinc-700">
                          {m.coachName.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white">{m.coachName}</div>
                          {m.coachEmail && <div className="text-zinc-500 text-xs">{m.coachEmail}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">{m.permission}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{m.since ? formatDate(new Date(m.since * 1000)) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-zinc-900 w-full max-w-md rounded-xl p-6 border border-zinc-800">
              <h3 className="text-xl font-semibold mb-2">Invite Staff</h3>
              <p className="text-zinc-400 text-sm mb-4">Enter the email of the person you wish to add as staff. They will receive an email invitation.</p>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e)=>setInviteEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-[#E0FE10]"
              />
              <div className="flex items-center justify-end gap-3 mt-5">
                <button onClick={()=>setShowModal(false)} className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700">Cancel</button>
                <button onClick={sendInvite} disabled={sending || !inviteEmail} className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black disabled:opacity-50">
                  {sending ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Athletes Modal */}
        {assignOpen && assignFor && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-zinc-900 w-full max-w-lg rounded-xl p-6 border border-zinc-800">
              <h3 className="text-xl font-semibold mb-2">Assign athletes to {assignFor.email}</h3>
              <p className="text-zinc-400 text-sm mb-4">Only assigned athletes will be visible to this staff member.</p>
              <div className="max-h-72 overflow-auto space-y-2 border border-zinc-800 rounded-md p-3 bg-zinc-900/50">
                {athletes.length === 0 ? (
                  <div className="text-zinc-500 text-sm">No athletes found.</div>
                ) : (
                  athletes.map(a => (
                    <label key={a.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAthletes.includes(a.id)}
                        onChange={(e)=>{
                          const checked = e.target.checked;
                          setSelectedAthletes(prev => checked ? [...prev, a.id] : prev.filter(x=>x!==a.id));
                        }}
                      />
                      <img src={a.profileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.username||a.email)}&background=E0FE10&color=000000&size=64`} className="w-6 h-6 rounded-full border border-zinc-700" />
                      <span className="text-white">{a.username || a.email}</span>
                      {a.email && <span className="text-zinc-500">({a.email})</span>}
                    </label>
                  ))
                )}
              </div>
              <div className="flex items-center justify-end gap-3 mt-5">
                <button onClick={()=>{ setAssignOpen(false); setAssignFor(null); }} className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700">Cancel</button>
                <button
                  onClick={async ()=>{
                    if (!currentUser?.id || !assignFor) return;
                    try {
                      const memberRef = doc(db, 'coach-staff', currentUser.id, 'members', assignFor.id);
                      await updateDoc(memberRef, { allowedAthletes: selectedAthletes, updatedAt: serverTimestamp(), permission: 'limited' });
                      // Also persist to staff-invites record so the member can see shared athletes on their dashboard
                      try {
                        const inviteRef = doc(db, 'staff-invites', `${currentUser.id}_${assignFor.id}`);
                        await updateDoc(inviteRef, { allowedAthletes: selectedAthletes, permission: 'limited', updatedAt: serverTimestamp() });
                      } catch (_) {}
                      setStaff(prev => prev.map(p => p.id === assignFor.id ? { ...p, permission: 'limited', allowedAthletes: [...selectedAthletes] } : p));
                      setAssignOpen(false); setAssignFor(null);
                      setToast('Assignments saved'); setTimeout(()=>setToast(null), 2000);
                    } catch (_) {
                      setToast('Failed to save'); setTimeout(()=>setToast(null), 2500);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black disabled:opacity-50"
                >Save</button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-5 right-5 bg-zinc-900 border border-zinc-700 text-white px-4 py-2 rounded-lg text-sm">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffPage;


