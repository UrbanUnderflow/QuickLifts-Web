import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../../hooks/useUser';
import SideNav from '../../../components/Navigation/SideNav';
import PageHead from '../../../components/PageHead';
import { ArrowLeft, Send, Activity, Clock } from 'lucide-react';
import { db } from '../../../api/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { 
  coachAthleteMessagingService, 
  CoachAthleteMessage, 
  CoachAthleteConversation 
} from '../../../api/firebase/messaging/coachAthleteService';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────
// FLOATING ORB (Shared)
// ─────────────────────────────────────────────
const FloatingOrb: React.FC<{
  color: string;
  size: number;
  style: React.CSSProperties;
  delay?: number;
}> = ({ color, size, style, delay = 0 }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size,
      height: size,
      background: `radial-gradient(circle, ${color}2A 0%, transparent 70%)`,
      filter: 'blur(60px)',
      ...style,
    }}
    animate={{
      scale: [1, 1.15, 1],
      opacity: [0.3, 0.5, 0.3],
    }}
    transition={{
      duration: 8,
      repeat: Infinity,
      delay,
      ease: 'easeInOut',
    }}
  />
);

// ─────────────────────────────────────────────
// FORMATTING TIMESTAMPS
// ─────────────────────────────────────────────
const formatMessageTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const formatMessageDate = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
};

// ─────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────
const PulseCheckMessageThread: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const conversationId = id as string;
  const currentUser = useUser();

  const [conversation, setConversation] = useState<CoachAthleteConversation | null>(null);
  const [messages, setMessages] = useState<CoachAthleteMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = currentUser?.id;

  // Derive my role and the other person's exact name
  const isMeCoach = conversation?.coachId === currentUserId;
  const otherName = isMeCoach ? conversation?.athleteName : conversation?.coachName;
  const otherRole = isMeCoach ? 'Athlete' : 'Coach';

  // 1. Fetch Conversation Info
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const loadConversationInfo = async () => {
      try {
        setLoading(true);
        const ref = doc(db, 'coach-athlete-conversations', conversationId);
        const snap = await getDoc(ref);
        
        if (snap.exists()) {
          const data = snap.data();
          setConversation({
            id: snap.id,
            coachId: data.coachId,
            athleteId: data.athleteId,
            coachName: data.coachName || 'Coach',
            athleteName: data.athleteName || 'Athlete',
            lastMessage: data.lastMessage,
            lastMessageTimestamp: data.lastMessageTimestamp?.toDate() || new Date(),
            lastMessageSenderId: data.lastMessageSenderId || '',
            unreadCount: data.unreadCount || {},
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          });
        }
      } catch (err) {
        console.error('Error fetching conversation', err);
      } finally {
        setLoading(false);
      }
    };
    loadConversationInfo();
  }, [conversationId, currentUserId]);

  // 2. Subscribe to Messages
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const unsubscribe = coachAthleteMessagingService.subscribeToMessages(
      conversationId,
      (newMessages) => {
        setMessages(newMessages);
        
        // Auto mark as read
        if (newMessages.length > 0) {
          coachAthleteMessagingService.markMessagesAsRead(conversationId, currentUserId);
        }
      }
    );

    return () => unsubscribe();
  }, [conversationId, currentUserId]);

  // 3. Scroll to Bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ─────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !currentUserId || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      await coachAthleteMessagingService.sendMessage(
        conversationId,
        currentUserId,
        isMeCoach ? 'coach' : 'athlete',
        content
      );
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(content); // restore if failed
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

  // Group messages
  const groupedMessages = messages.reduce((groups, message) => {
    const dateKey = message.timestamp.toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(message);
    return groups;
  }, {} as { [date: string]: CoachAthleteMessage[] });

  return (
    <>
      <PageHead
        metaData={{
          pageId: `pulsecheck-messages-${conversationId}`,
          pageTitle: `Message ${otherName || ''} — PulseCheck`,
          metaDescription: 'Coach-athlete direct message.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl={`https://fitwithpulse.ai/PulseCheck/messages/${conversationId}`}
      />

      <div className="min-h-screen bg-[#0a0a0b] text-white relative flex flex-col">
        {/* Ambient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <FloatingOrb color="#8B5CF6" size={600} style={{ top: '-10%', left: '5%' }} />
          <FloatingOrb color="#6366F1" size={400} style={{ bottom: '-5%', right: '10%' }} delay={2} />
          <div
            className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
            style={{
              backgroundImage: "url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=\")"
            }}
          />
        </div>

        <SideNav />

        {/* Chat Interface */}
        <div className="md:ml-20 lg:ml-64 flex-1 flex flex-col h-screen relative z-10 p-0 md:p-4 pb-[80px] md:pb-4">
          <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col h-full bg-[#0d0d0f] md:rounded-2xl border-x md:border border-white/5 overflow-hidden shadow-2xl relative">
            
            {/* Header */}
            <div className="h-[72px] flex items-center justify-between px-6 border-b border-white/10 relative shrink-0">
              <div 
                className="absolute inset-x-0 bottom-0 h-px opacity-40"
                style={{ background: 'linear-gradient(90deg, transparent, #8B5CF6, transparent)' }}
              />
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/PulseCheck/messages')}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors -ml-2"
                >
                  <ArrowLeft className="w-5 h-5 text-zinc-400" />
                </button>

                {loading ? (
                  <div className="w-48 h-10 bg-white/5 animate-pulse rounded-lg" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.25)] relative">
                      <span className="text-white font-semibold">{otherName?.[0] || 'U'}</span>
                      <div className="absolute -bottom-1 -right-1 bg-[#10B981] w-3.5 h-3.5 border-2 border-[#0d0d0f] rounded-full" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-white tracking-wide">{otherName}</h2>
                      <div className="flex items-center gap-1.5 text-xs text-[#A78BFA] font-medium tracking-wider uppercase">
                        <Activity className="w-3 h-3" />
                        {otherRole}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
              {loading ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-[#8B5CF6] animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-80">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Activity className="w-6 h-6 text-zinc-400" />
                  </div>
                  <p className="text-white font-medium mb-1">Secure Coach Connection</p>
                  <p className="text-sm text-center max-w-[250px]">
                    This is the start of your encrypted conversation with {otherName}.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedMessages).map(([dateKey, dayMsgs]) => (
                    <div key={dateKey}>
                      {/* Date Separator */}
                      <div className="flex justify-center mb-6 mt-4">
                        <span className="text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full bg-white/5 text-zinc-400 border border-white/5">
                          {formatMessageDate(new Date(dateKey))}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {dayMsgs.map((msg, idx) => {
                          const isMine = msg.senderId === currentUserId;
                          
                          // Determine border radius logic for stacked messages
                          const prevMsg = idx > 0 ? dayMsgs[idx - 1] : null;
                          const nextMsg = idx < dayMsgs.length - 1 ? dayMsgs[idx + 1] : null;
                          const isConsecutiveTop = prevMsg?.senderId === msg.senderId;
                          const isConsecutiveBottom = nextMsg?.senderId === msg.senderId;

                          return (
                            <div key={msg.id} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] md:max-w-[65%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                
                                {/* Bubble */}
                                <div
                                  className={`px-4 py-2.5 shadow-sm overflow-hidden relative group/bubble ${
                                    isMine 
                                      ? 'bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] text-white' 
                                      : 'bg-white/10 border border-white/5 text-[#f4f4f5]'
                                  }`}
                                  style={{
                                    borderTopLeftRadius: !isMine && isConsecutiveTop ? '4px' : '18px',
                                    borderBottomLeftRadius: !isMine && isConsecutiveBottom ? '4px' : '18px',
                                    borderTopRightRadius: isMine && isConsecutiveTop ? '4px' : '18px',
                                    borderBottomRightRadius: isMine && isConsecutiveBottom ? '4px' : '18px',
                                  }}
                                >
                                  {isMine && (
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/bubble:opacity-100 transition-opacity pointer-events-none" />
                                  )}
                                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                    {msg.content}
                                  </p>
                                </div>
                                
                                {/* Timestamp inside tiny label underneath */}
                                {!isConsecutiveBottom && (
                                  <div className={`text-[10px] text-zinc-500 font-medium mt-1.5 flex items-center gap-1 opacity-60 px-1 ${
                                    isMine ? 'justify-end' : 'justify-start'
                                  }`}>
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatMessageTime(msg.timestamp)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} className="h-4" />
                </div>
              )}
            </div>

            {/* Input Box */}
            <div className="p-4 bg-zinc-950/40 backdrop-blur-md border-t border-white/10 sticky bottom-0 z-20">
              <div className="max-w-3xl mx-auto flex items-end gap-3 rounded-2xl bg-zinc-900 border border-white/10 p-2 shadow-inner focus-within:border-[#8B5CF6]/50 focus-within:ring-1 focus-within:ring-[#8B5CF6]/30 transition-all">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type a message..."
                  className="w-full bg-transparent text-white px-3 py-2.5 text-[15px] placeholder-zinc-500 max-h-32 min-h-[44px] resize-none outline-none leading-relaxed"
                  rows={1}
                  onInput={(e) => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = 'auto';
                    t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
                  }}
                />
                
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-md group ${
                    newMessage.trim() && !sending
                      ? 'bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] text-white hover:shadow-[#8B5CF6]/30 hover:shadow-lg active:scale-95 cursor-pointer'
                      : 'bg-white/5 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <Send className={`w-5 h-5 ${newMessage.trim() && !sending ? '-translate-y-0.5 translate-x-0.5 group-hover:-translate-y-1 group-hover:translate-x-1' : ''} transition-transform`} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default PulseCheckMessageThread;
