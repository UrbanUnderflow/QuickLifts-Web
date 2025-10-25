import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { db } from '../../api/firebase/config';
import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { convertFirestoreTimestamp } from '../../utils/formatDate';
import { FaBars, FaTimes } from 'react-icons/fa';
import { signOut } from 'firebase/auth';
import { auth } from '../../api/firebase/config';

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
  const [chats, setChats] = useState<Array<{
    id: string;
    title: string;
    lastMessage: string;
    lastMessageTime: Date;
    avatarUrl?: string;
    otherUserId?: string;
  }>>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      try { localStorage.removeItem('pulse_has_seen_marketing'); } catch (_) {}
      router.replace('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

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

  // Load direct message chats for the coach (from chats collection)
  useEffect(() => {
    const loadChats = async () => {
      if (userLoading) return;
      if (!currentUser?.id) return;
      try {
        const chatsRef = collection(db, 'chats');
        const chatsQuery = query(
          chatsRef,
          where('participantIds', 'array-contains', currentUser.id),
          orderBy('lastMessageTimestamp', 'desc')
        );
        const snap = await getDocs(chatsQuery);
        const rows: Array<{ id: string; title: string; lastMessage: string; lastMessageTime: Date; avatarUrl?: string; otherUserId?: string; }> = [];
        snap.docs.forEach(d => {
          const data: any = d.data();
          const participants = Array.isArray(data.participants) ? data.participants : [];
          const other = participants.find((p: any) => p && p.id !== currentUser.id);
          rows.push({
            id: d.id,
            title: (other?.displayName || other?.username || 'Conversation') as string,
            lastMessage: (data.lastMessage || 'No messages yet') as string,
            lastMessageTime: convertFirestoreTimestamp(data.lastMessageTimestamp),
            avatarUrl: other?.profileImage?.profileImageURL,
            otherUserId: other?.id,
          });
        });
        setChats(rows);
      } catch (_) {
        setChats([]);
      }
    };
    loadChats();
  }, [currentUser?.id, userLoading]);

  // Debug: scan recent messages in each chat to find the connection confirmation
  useEffect(() => {
    const scanForConnectionMessages = async () => {
      if (!currentUser?.id || chats.length === 0) return;
      const needle = 'connected with you via PulseCheck';
      try {
        for (const chat of chats.slice(0, 10)) { // limit to 10 chats for debug
          try {
            const msgsRef = collection(db, 'chats', chat.id, 'messages');
            const q = query(msgsRef, orderBy('timestamp', 'desc'), limit(25));
            const snap = await getDocs(q);
            const contents = snap.docs.map(d => (d.data() as any)?.content || '').filter(Boolean);
            const found = contents.some(c => typeof c === 'string' && c.includes(needle));
            console.log('[CoachInbox][Debug] Scan chat', {
              chatId: chat.id,
              checkedCount: snap.docs.length,
              foundConnectionText: found,
              sample: contents.slice(0, 5),
            });
          } catch (err) {
            console.warn('[CoachInbox][Debug] Scan failed for chat', chat.id, err);
          }
        }
      } catch (err) {
        console.warn('[CoachInbox][Debug] Scan loop error', err);
      }
    };
    scanForConnectionMessages();
  }, [chats, currentUser?.id]);

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
              { href: '/coach/revenue', label: 'Earnings' },
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

        {/* Mobile slide-over navigation */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute top-0 right-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 shadow-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="text-lg font-semibold text-white">Menu</div>
                <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800">
                  <FaTimes />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { href: '/coach/dashboard', label: 'Dashboard' },
                  { href: '/coach/referrals', label: 'Referrals' },
                  { href: '/coach/revenue', label: 'Earnings' },
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
              <div className="mt-auto pt-6 border-t border-zinc-800">
                <button
                  onClick={() => { setMobileNavOpen(false); handleSignOut(); }}
                  className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* Messages (from chats) */}
        <div>
          <h3 className="text-xl font-semibold mb-3">Messages</h3>
          {chats.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-zinc-400">Messages will appear here soon.</div>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => router.push(`/messages/dm/${chat.id}`)}
                  className="w-full flex items-start gap-4 p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {chat.avatarUrl ? (
                      <img src={chat.avatarUrl} alt={chat.title} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600">
                        <span className="text-white font-semibold text-lg">{chat.title?.[0]?.toUpperCase() || 'U'}</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-white truncate">{chat.title}</h4>
                      <span className="text-xs text-gray-500 ml-2">{chat.lastMessageTime.toLocaleDateString?.() || ''}</span>
                    </div>
                    <p className="text-sm text-gray-400 truncate">{chat.lastMessage}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {toast && (
          <div className="fixed bottom-5 right-5 bg-zinc-900 border border-zinc-700 text-white px-4 py-2 rounded-lg text-sm">{toast}</div>
        )}
      </div>
    </div>
  );
};

export default InboxPage;
