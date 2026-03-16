import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../hooks/useUser';
import SideNav from '../components/Navigation/SideNav';
import { MessageCircle, Clock, Users } from 'lucide-react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../api/firebase/config';
import { convertFirestoreTimestamp } from '../utils/formatDate';

interface ShortUser {
  id: string;
  username: string;
  displayName?: string;
  profileImage?: {
    profileImageURL?: string;
  };
}

interface UnifiedConversation {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  avatarUrl?: string;
  otherUserId?: string;
  otherUserName?: string;
}

const MessagesPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [conversations, setConversations] = useState<UnifiedConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) {
      console.log('[Messages] No current user, skipping load');
      return;
    }

    const loadConversations = async () => {
      try {
        console.log('[Messages] Loading community DMs for user:', currentUser.id);
        setLoading(true);
        const unified: UnifiedConversation[] = [];

        // Load direct messages from Pulse Community (chats collection)
        try {
          const chatsRef = collection(db, 'chats');
          const chatsQuery = query(
            chatsRef,
            where('participantIds', 'array-contains', currentUser.id),
            orderBy('lastMessageTimestamp', 'desc')
          );
          
          const chatsSnapshot = await getDocs(chatsQuery);
          console.log('[Messages] Found', chatsSnapshot.docs.length, 'community DMs');
          
          for (const d of chatsSnapshot.docs) {
            const data = d.data();
            const participants = (data.participants || []) as ShortUser[];
            const otherUser = participants.find(p => p.id !== currentUser.id);
            
            if (otherUser) {
              const lastMsgTime = convertFirestoreTimestamp(data.lastMessageTimestamp);
              const myLastReadRaw = data?.lastReadAt?.[currentUser.id];
              const myLastReadAt = myLastReadRaw ? convertFirestoreTimestamp(myLastReadRaw) : null;
              const fromOther = data?.lastMessageSenderId && data.lastMessageSenderId !== currentUser.id;
              const lastUnread = fromOther && (!myLastReadAt || lastMsgTime.getTime() > myLastReadAt.getTime());
              unified.push({
                id: d.id,
                title: otherUser.displayName || otherUser.username || 'User',
                lastMessage: data.lastMessage || 'No messages yet',
                lastMessageTime: convertFirestoreTimestamp(data.lastMessageTimestamp),
                unreadCount: lastUnread ? 1 : 0,
                otherUserId: otherUser.id,
                otherUserName: otherUser.username,
                avatarUrl: otherUser.profileImage?.profileImageURL
              });
            }
          }
        } catch (error) {
          console.error('[Messages] Error fetching community DMs:', error);
        }

        // Sort by most recent
        unified.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

        console.log('[Messages] Total community conversations loaded:', unified.length);
        setConversations(unified);
      } catch (error) {
        console.error('[Messages] Error loading conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [currentUser?.id]);

  const handleConversationClick = (convo: UnifiedConversation) => {
    router.push(`/messages/dm/${convo.id}`);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SideNav />
      
      <div className="md:ml-20 lg:ml-64 pb-16 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-emerald-400" />
              <h1 className="text-3xl font-bold">Messages</h1>
            </div>
            <p className="text-gray-400">Direct messages from the Pulse community</p>
          </div>

          {/* Conversations List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <div className="w-5 h-5 border-2 border-gray-600 border-t-emerald-400 rounded-full animate-spin" />
                Loading conversations...
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="w-16 h-16 text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No messages yet</h3>
              <p className="text-gray-400 max-w-md">
                Direct messages from the Pulse community will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => handleConversationClick(convo)}
                  className="w-full flex items-start gap-4 p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {convo.avatarUrl ? (
                      <img
                        src={convo.avatarUrl}
                        alt={convo.title}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <span className="text-white font-semibold text-lg">
                          {convo.title?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-white truncate">{convo.title}</h3>
                      <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0 ml-2">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(convo.lastMessageTime)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-400 truncate">{convo.lastMessage}</p>
                      {convo.unreadCount > 0 && (
                        <span className="ml-2 flex-shrink-0 bg-[#E0FE10] text-black text-xs font-bold px-2 py-1 rounded-full">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
