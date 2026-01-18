import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { db } from '../../api/firebase/config';
import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { convertFirestoreTimestamp } from '../../utils/formatDate';
import CoachLayout from '../../components/CoachLayout';
import { motion } from 'framer-motion';

type Invite = {
  coachId: string;
  coachName?: string;
  permission: 'full' | 'limited';
  allowedAthletes?: string[];
};

// Glass Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`relative rounded-2xl backdrop-blur-md bg-zinc-900/60 border border-white/10 overflow-hidden ${className}`}>
    {/* Top reflection line */}
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E0FE10]/40 to-transparent" />
    {children}
  </div>
);

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
      <CoachLayout title="Inbox" subtitle="See invites and messages" requiresActiveSubscription={false}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <GlassCard className="p-8 text-center">
            <div className="text-zinc-400">Loading...</div>
          </GlassCard>
        </div>
      </CoachLayout>
    );
  }

  return (
    <CoachLayout title="Inbox" subtitle="See invites and messages" requiresActiveSubscription={false}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Staff Invites */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-xl font-semibold mb-4 text-white">Staff Invites</h3>
          {acceptedCoachId && (
            <div className="mb-3 bg-green-600/15 border border-green-700 text-green-300 px-4 py-2 rounded-lg text-sm">
              You're now connected to the coach who invited you.
            </div>
          )}
          {connectedCoaches.length > 0 && (
            <div className="mb-3 bg-green-600/10 border border-green-700/50 text-green-300 px-4 py-2 rounded-lg text-sm">
              Connected to {connectedCoaches.length} coach{connectedCoaches.length > 1 ? 'es' : ''}. Visit the Dashboard to see shared athletes.
            </div>
          )}
          {invites.length === 0 ? (
            <GlassCard className="p-6">
              <div className="text-zinc-400">No invites.</div>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {invites.map((inv) => (
                <GlassCard key={inv.coachId} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white">Invitation to join {inv.coachName || 'a coach'}'s staff</div>
                      <div className="text-zinc-400 text-sm">Permission: {inv.permission === 'full' ? 'Full access' : 'Limited'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={()=>acceptInvite(inv)} 
                        className="bg-[#E0FE10] text-black px-4 py-2 rounded-xl font-medium"
                      >
                        Accept
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={()=>declineInvite(inv)} 
                        className="bg-zinc-800/60 border border-zinc-700/50 text-white px-4 py-2 rounded-xl"
                      >
                        Decline
                      </motion.button>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </motion.div>

        {/* Messages (from chats) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-xl font-semibold mb-4 text-white">Messages</h3>
          {chats.length === 0 ? (
            <GlassCard className="p-6">
              <div className="text-zinc-400">Messages will appear here soon.</div>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {chats.map((chat, idx) => (
                <motion.button
                  key={chat.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => router.push(`/messages/dm/${chat.id}`)}
                  className="w-full"
                >
                  <GlassCard className="p-4 hover:bg-zinc-800/40 transition-colors">
                    <div className="flex items-start gap-4 text-left">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {chat.avatarUrl ? (
                          <img src={chat.avatarUrl} alt={chat.title} className="w-12 h-12 rounded-full object-cover border border-zinc-700/50" />
                        ) : (
                          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E0FE10] to-green-500">
                            <span className="text-black font-semibold text-lg">{chat.title?.[0]?.toUpperCase() || 'U'}</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-white truncate">{chat.title}</h4>
                          <span className="text-xs text-zinc-500 ml-2">{chat.lastMessageTime.toLocaleDateString?.() || ''}</span>
                        </div>
                        <p className="text-sm text-zinc-400 truncate">{chat.lastMessage}</p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>

        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-5 right-5 bg-zinc-900/90 backdrop-blur-lg border border-zinc-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            {toast}
          </motion.div>
        )}
      </div>
    </CoachLayout>
  );
};

export default InboxPage;
