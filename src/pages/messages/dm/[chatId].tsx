import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../../hooks/useUser';
import SideNav from '../../../components/Navigation/SideNav';
import { Send, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../../api/firebase/config';
import { convertFirestoreTimestamp } from '../../../utils/formatDate';
import { userService } from '../../../api/firebase/user/service';
import { workoutService } from '../../../api/firebase/workout/service';
// import { Exercise } from '../../../api/firebase/exercise/types'; // Not required for flexible move search rendering
import { Workout, Challenge } from '../../../api/firebase/workout/types';
import { X } from 'lucide-react';

interface ShortUser {
  id: string;
  username: string;
  displayName?: string;
  profileImage?: {
    profileImageURL?: string;
  };
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  readBy: { [userId: string]: Date };
  workout?: any; // Chain letter workout
  request?: any; // Follow request
  mediaType?: string; // 'none' | 'image' | 'video' | 'workout'
  mediaURL?: string;
  peerChallengeData?: any;
}

interface DirectMessageConversation {
  id: string;
  participants: ShortUser[];
  participantIds: string[];
  lastMessage: string;
  lastMessageTimestamp: Date;
}

const DirectMessagePage: React.FC = () => {
  const router = useRouter();
  const { chatId } = router.query;
  const currentUser = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<DirectMessageConversation | null>(null);
  const [otherUser, setOtherUser] = useState<ShortUser | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSendMenu, setShowSendMenu] = useState(false);
  const [sendModalType, setSendModalType] = useState<'move' | 'stack' | 'round' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation details
  useEffect(() => {
    if (!chatId || typeof chatId !== 'string' || !currentUser?.id) return;

    const loadConversation = async () => {
      try {
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (chatDoc.exists()) {
          const data = chatDoc.data();
          const conv: DirectMessageConversation = {
            id: chatDoc.id,
            participants: data.participants || [],
            participantIds: data.participantIds || [],
            lastMessage: data.lastMessage || '',
            lastMessageTimestamp: convertFirestoreTimestamp(data.lastMessageTimestamp)
          };
          setConversation(conv);

          // Find the other user
          const other = conv.participants.find(p => p.id !== currentUser.id);
          setOtherUser(other || null);
        }
      } catch (error) {
        console.error('[DM] Error loading conversation:', error);
      }
    };

    loadConversation();
  }, [chatId, currentUser?.id]);

  // Subscribe to messages in real-time
  useEffect(() => {
    if (!chatId || typeof chatId !== 'string') return;

    console.log('[DM] Setting up real-time listener for chat:', chatId);
    
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(
      messagesRef,
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      console.log('[DM] Received', snapshot.docs.length, 'messages');
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          senderId: data.senderId,
          content: data.content || '',
          timestamp: convertFirestoreTimestamp(data.timestamp),
          readBy: Object.keys(data.readBy || {}).reduce((acc, userId) => {
            acc[userId] = convertFirestoreTimestamp(data.readBy[userId]);
            return acc;
          }, {} as { [userId: string]: Date }),
          workout: data.workout,
          request: data.request,
          mediaType: data.mediaType || 'none',
          mediaURL: data.mediaURL,
          peerChallengeData: data.peerChallengeData
        };
      });
      
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      console.error('[DM] Error listening to messages:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser?.id || !chatId || typeof chatId !== 'string' || sending) return;

    try {
      setSending(true);
      
      // Add message to subcollection
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.id,
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        readBy: { [currentUser.id]: serverTimestamp() }
      });

      // Update parent chat document
      const chatRef = doc(db, 'chats', chatId);
      await getDoc(chatRef).then(async (chatDoc) => {
        if (chatDoc.exists()) {
          const { updateDoc } = await import('firebase/firestore');
          await updateDoc(chatRef, {
            lastMessage: newMessage.trim(),
            lastMessageTimestamp: serverTimestamp()
          });
        }
      });

      setNewMessage('');
    } catch (error) {
      console.error('[DM] Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleOpenSendModal = (type: 'move' | 'stack' | 'round') => {
    setSendModalType(type);
    setSearchQuery('');
    setSearchResults([]);
    setShowSendMenu(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim() || !currentUser?.id) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (sendModalType === 'move') {
        const exercises = await userService.fetchUserVideos(currentUser.id) as any[];
        const filtered = exercises.filter((ex: any) => {
          const name = (ex?.exerciseName || ex?.title || ex?.name || '').toString();
          return name.toLowerCase().includes(query.toLowerCase());
        });
        setSearchResults(filtered as any[]);
      } else if (sendModalType === 'stack') {
        const stacks = await userService.fetchUserStacks(currentUser.id) as any[];
        const filtered = stacks.filter((stack: any) => {
          const title = (stack?.title || '').toString();
          const desc = (stack?.description || stack?.subtitle || '').toString();
          return title.toLowerCase().includes(query.toLowerCase()) || desc.toLowerCase().includes(query.toLowerCase());
        });
        setSearchResults(filtered as any[]);
      } else if (sendModalType === 'round') {
        const rounds = await workoutService.fetchCollections(currentUser.id) as any[];
        const filtered = rounds.filter((round: any) => {
          const title = (round?.title || '').toString();
          const desc = (round?.description || round?.subtitle || '').toString();
          return title.toLowerCase().includes(query.toLowerCase()) || desc.toLowerCase().includes(query.toLowerCase());
        });
        setSearchResults(filtered as any[]);
      }
    } catch (error) {
      console.error('[DM] Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendItem = async (item: any) => {
    if (!currentUser?.id || !chatId || typeof chatId !== 'string') return;

    try {
      setSending(true);
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      const messageData: any = {
        senderId: currentUser.id,
        content: '',
        timestamp: serverTimestamp(),
        readBy: { [currentUser.id]: serverTimestamp() }
      };

      if (sendModalType === 'move') {
        // For moves, derive a safe display name from available fields
        const name = (item?.exerciseName || item?.title || item?.name || 'exercise').toString();
        messageData.content = `Shared exercise: ${name}`;
        messageData.mediaType = 'none';
      } else if (sendModalType === 'stack') {
        messageData.workout = item;
      } else if (sendModalType === 'round') {
        messageData.peerChallengeData = item;
      }

      await addDoc(messagesRef, messageData);

      // Update parent chat
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: sendModalType === 'move' ? messageData.content : `Sent a ${sendModalType}`,
        lastMessageTimestamp: serverTimestamp()
      });

      setSendModalType(null);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('[DM] Error sending item:', error);
    } finally {
      setSending(false);
    }
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

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <SideNav />
      
      <div className="md:ml-20 lg:ml-64 flex-1 flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b border-zinc-800 bg-black sticky top-0 z-10">
          <button
            onClick={() => router.push('/messages')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {otherUser && (
            <>
              {otherUser.profileImage?.profileImageURL ? (
                <img
                  src={otherUser.profileImage.profileImageURL}
                  alt={otherUser.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {otherUser.username?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
              <div>
                <h1 className="font-semibold">{otherUser.displayName || otherUser.username}</h1>
                <p className="text-sm text-gray-400">@{otherUser.username}</p>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <p className="text-gray-400 mb-2">No messages yet</p>
                <p className="text-sm text-gray-500">Send a message to start the conversation</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isCurrentUser = message.senderId === currentUser.id;
                const hasWorkout = message.workout;
                const hasChallenge = message.peerChallengeData;
                const hasRequest = message.request;
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] ${isCurrentUser ? 'order-2' : 'order-1'}`}>
                      {/* Workout Message */}
                      {hasWorkout ? (
                        <div>
                          <div className={`p-4 rounded-xl ${isCurrentUser ? 'bg-zinc-900' : 'bg-[#C5E30F]'} border ${isCurrentUser ? 'border-zinc-700' : 'border-[#B8D50E]'}`}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1">
                                <h3 className={`font-bold text-lg mb-1 ${isCurrentUser ? 'text-white' : 'text-black'}`}>
                                  {message.workout.title || 'Workout'}
                                </h3>
                                {message.workout.exercises && (
                                  <p className={`text-sm font-medium ${isCurrentUser ? 'text-gray-400' : 'text-black/70'}`}>
                                    {message.workout.exercises.length} Exercise{message.workout.exercises.length !== 1 ? 's' : ''}
                                  </p>
                                )}
                              </div>
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${isCurrentUser ? 'bg-zinc-800' : 'bg-black/10'}`}>
                                <svg className={`w-7 h-7 ${isCurrentUser ? 'text-[#E0FE10]' : 'text-black'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                console.log('[DM Workout Click] Workout object:', message.workout);
                                console.log('[DM Workout Click] Author field:', message.workout.author);
                                console.log('[DM Workout Click] Workout ID:', message.workout.id);
                                console.log('[DM Workout Click] Round Workout ID:', message.workout.roundWorkoutId);
                                
                                // The author field might be a user ID, so we need to fetch the username
                                let username = message.workout.author;
                                
                                // Check if author is a user ID (contains letters and numbers, typically longer)
                                if (username && username.length > 15 && !username.includes('_')) {
                                  console.log('[DM Workout Click] Author looks like user ID, fetching username...');
                                  try {
                                    const authorUser = await userService.getUserById(username);
                                    if (authorUser?.username) {
                                      username = authorUser.username;
                                      console.log('[DM Workout Click] Resolved username:', username);
                                    }
                                  } catch (error) {
                                    console.error('[DM Workout Click] Error fetching author user:', error);
                                  }
                                }
                                
                                const workoutId = message.workout.roundWorkoutId || message.workout.id;
                                const targetUrl = `/workout/${username}/${workoutId}`;
                                console.log('[DM Workout Click] Final URL:', targetUrl);
                                router.push(targetUrl);
                              }}
                              className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                                isCurrentUser
                                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                                  : 'bg-black hover:bg-black/90 text-[#E0FE10]'
                              }`}
                            >
                              View Workout
                            </button>
                          </div>
                          {message.content && (
                            <div
                              className={`rounded-2xl px-4 py-3 mt-2 ${
                                isCurrentUser
                                  ? 'bg-[#E0FE10] text-black'
                                  : 'bg-zinc-800 text-white'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                          )}
                          <p className={`text-xs text-gray-500 mt-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                            {formatTimestamp(message.timestamp)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div
                            className={`rounded-2xl px-4 py-3 ${
                              isCurrentUser
                                ? 'bg-[#E0FE10] text-black'
                                : 'bg-zinc-800 text-white'
                            }`}
                          >
                            {/* Peer Challenge */}
                            {hasChallenge && (
                              <div className="mb-2 p-3 rounded-lg bg-black/20 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg">⚔️</span>
                                  <span className="font-semibold">Challenge</span>
                                </div>
                                <p className="text-sm opacity-90">
                                  {message.peerChallengeData.title || 'Workout Challenge'}
                                </p>
                              </div>
                            )}
                            
                            {/* Follow Request */}
                            {hasRequest && (
                              <div className="mb-2 p-3 rounded-lg bg-black/20 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg">👥</span>
                                  <span className="font-semibold">Follow Request</span>
                                </div>
                              </div>
                            )}
                            
                            {/* Image/Media */}
                            {message.mediaType === 'image' && message.mediaURL && (
                              <div className="mb-2">
                                <img 
                                  src={message.mediaURL} 
                                  alt="Shared image" 
                                  className="rounded-lg max-w-full"
                                />
                              </div>
                            )}
                            
                            {/* Regular text content */}
                            {message.content && (
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            )}
                          </div>
                          <p className={`text-xs text-gray-500 mt-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                            {formatTimestamp(message.timestamp)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-zinc-800 bg-black">
          <div className="max-w-4xl mx-auto">
            {/* Send Menu Buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => handleOpenSendModal('stack')}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Send Stack</span>
              </button>
              <button
                onClick={() => handleOpenSendModal('round')}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span>Send Round</span>
              </button>
              <button
                onClick={() => handleOpenSendModal('move')}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Send Move</span>
              </button>
            </div>

            <div className="flex gap-2 items-end">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message..."
                rows={1}
                className="flex-1 bg-zinc-900 text-white rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#E0FE10] max-h-32"
                style={{
                  minHeight: '44px',
                  height: 'auto',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
                className={`p-3 rounded-full transition-colors flex-shrink-0 ${
                  newMessage.trim() && !sending
                    ? 'bg-[#E0FE10] text-black hover:bg-[#d0ee00]'
                    : 'bg-zinc-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Send Modal */}
        {sendModalType && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h2 className="text-xl font-bold">
                  Send {sendModalType === 'move' ? 'a Move' : sendModalType === 'stack' ? 'a Stack' : 'a Round'}
                </h2>
                <button
                  onClick={() => {
                    setSendModalType(null);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Input */}
              <div className="p-4 border-b border-zinc-800">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={`Search your ${sendModalType}s...`}
                  className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#E0FE10]"
                  autoFocus
                />
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto p-4">
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-400">Searching...</div>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-400 text-center">
                      {searchQuery ? `No ${sendModalType}s found` : `Type to search your ${sendModalType}s`}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSendItem(item)}
                        className="w-full p-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-left"
                      >
                        <h3 className="font-semibold text-white mb-1">
                          {sendModalType === 'move' ? (item?.exerciseName || item?.title || item?.name || 'Exercise') : item.title}
                        </h3>
                        {sendModalType !== 'move' && (
                          <p className="text-sm text-gray-400">
                            {sendModalType === 'stack' 
                              ? `${item.exercises?.length || 0} exercises` 
                              : item.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectMessagePage;

