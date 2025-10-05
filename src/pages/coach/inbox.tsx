import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { db } from '../../api/firebase/config';
import { collection, getDocs, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';

type Invite = {
  coachId: string;
  coachName?: string;
  permission: 'full' | 'limited';
  allowedAthletes?: string[];
};

const InboxPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const userLoading = useUserLoading();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [acceptedCoachId, setAcceptedCoachId] = useState<string | null>(null);
  const [connectedCoaches, setConnectedCoaches] = useState<string[]>([]);

  // Manual accept only; no auto-accept from URL

  useEffect(() => {
    const loadInvites = async () => {
      if (userLoading) return;
      if (!currentUser?.email) {
        setLoading(false);
        return;
      }
      try {
        // Query dedicated staff-invites collection
        const invitesRef = collection(db, 'staff-invites');
        const qInv = query(invitesRef, where('memberEmail', '==', currentUser.email.toLowerCase()), where('status', '==', 'invited'));
        const snap = await getDocs(qInv);
        const rows: Invite[] = [];
        for (const d of snap.docs) {
          const data: any = d.data();
          let coachName: string | undefined = undefined;
          try {
            const cRef = doc(db, 'users', data.coachId);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
              const c = cSnap.data() as any;
              coachName = c.username || c.displayName || 'Coach';
            }
          } catch (_) {}
          rows.push({ coachId: data.coachId, coachName, permission: data.permission || 'limited', allowedAthletes: Array.isArray(data.allowedAthletes) ? data.allowedAthletes : [] });
        }
        setInvites(rows);
        // Also compute connected coaches
        const acceptedQ = query(invitesRef, where('memberEmail', '==', currentUser.email.toLowerCase()), where('status', '==', 'accepted'));
        const acceptedSnap = await getDocs(acceptedQ);
        setConnectedCoaches(acceptedSnap.docs.map(doc=> (doc.data() as any).coachId));
      } catch (_) {
        setInvites([]);
        setConnectedCoaches([]);
      } finally {
        setLoading(false);
      }
    };
    loadInvites();
  }, [currentUser?.email, userLoading]);

  const acceptInvite = async (inv: Invite) => {
    if (!currentUser?.email) return;
    try {
      // Update coach-staff member doc
      const memberRef = doc(db, 'coach-staff', inv.coachId, 'members', currentUser.email.toLowerCase());
      await updateDoc(memberRef, { status: 'accepted' });
      // Update invite record
      const inviteRef = doc(db, 'staff-invites', `${inv.coachId}_${currentUser.email.toLowerCase()}`);
      await updateDoc(inviteRef, { status: 'accepted' });
      setInvites(prev => prev.filter(i => i.coachId !== inv.coachId));
      setToast('Invite accepted'); setTimeout(()=>setToast(null), 2000);
    } catch (_) {
      setToast('Failed to accept invite'); setTimeout(()=>setToast(null), 2500);
    }
  };

  const declineInvite = async (inv: Invite) => {
    if (!currentUser?.email) return;
    try {
      const memberRef = doc(db, 'coach-staff', inv.coachId, 'members', currentUser.email.toLowerCase());
      await updateDoc(memberRef, { status: 'declined' });
      const inviteRef = doc(db, 'staff-invites', `${inv.coachId}_${currentUser.email.toLowerCase()}`);
      await updateDoc(inviteRef, { status: 'declined' });
      setInvites(prev => prev.filter(i => i.coachId !== inv.coachId));
      setToast('Invite declined'); setTimeout(()=>setToast(null), 2000);
    } catch (_) {
      setToast('Failed to decline invite'); setTimeout(()=>setToast(null), 2500);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Inbox</h1>
            <p className="text-zinc-400">See invites and messages</p>
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
        </div>

        {/* Staff Invites */}
        <div className="mb-10">
          <h3 className="text-xl font-semibold mb-3">Staff Invites</h3>
          {acceptedCoachId && (
            <div className="mb-3 bg-green-600/15 border border-green-700 text-green-300 px-4 py-2 rounded-lg text-sm">
              You’re now connected to the coach who invited you.
            </div>
          )}
          {connectedCoaches.length > 0 && (
            <div className="mb-3 bg-green-600/10 border border-green-700/50 text-green-300 px-4 py-2 rounded-lg text-sm">
              Connected to {connectedCoaches.length} coach{connectedCoaches.length > 1 ? 'es' : ''}. Visit the Dashboard to see shared athletes.
            </div>
          )}
          {invites.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-zinc-400">No invites.</div>
          ) : (
            <div className="space-y-3">
              {invites.map((inv) => (
                <div key={inv.coachId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-white">Invitation to join {inv.coachName || 'a coach'}'s staff</div>
                    <div className="text-zinc-400 text-sm">Permission: {inv.permission === 'full' ? 'Full access' : 'Limited'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>acceptInvite(inv)} className="bg-[#E0FE10] text-black px-3 py-1.5 rounded-md">Accept</button>
                    <button onClick={()=>declineInvite(inv)} className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-md">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages Placeholder */}
        <div>
          <h3 className="text-xl font-semibold mb-3">Messages</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-zinc-400">Messages will appear here soon.</div>
        </div>

        {toast && (
          <div className="fixed bottom-5 right-5 bg-zinc-900 border border-zinc-700 text-white px-4 py-2 rounded-lg text-sm">{toast}</div>
        )}
      </div>
    </div>
  );
};

export default InboxPage;
