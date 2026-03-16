import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../hooks/useUser';
import SideNav from '../../components/Navigation/SideNav';
import PageHead from '../../components/PageHead';
import { MessageCircle, Clock, Activity, ArrowLeft } from 'lucide-react';
import { coachAthleteMessagingService, CoachAthleteConversation } from '../../api/firebase/messaging/coachAthleteService';
import { motion, AnimatePresence } from 'framer-motion';

interface UnifiedConversation {
  id: string;
  title: string;
  subtitle?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  otherUserId?: string;
  otherUserName?: string;
}

// ─────────────────────────────────────────────
// FLOATING ORB — ambient background
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
      background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
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
// CONVERSATION CARD — PulseCheck glass style
// ─────────────────────────────────────────────
const ConversationCard: React.FC<{
  convo: UnifiedConversation;
  onClick: () => void;
  index: number;
}> = ({ convo, onClick, index }) => {
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
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={onClick}
      className="w-full flex items-start gap-4 p-4 rounded-xl transition-all duration-200 text-left group relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      whileHover={{
        backgroundColor: 'rgba(139,92,246,0.06)',
        borderColor: 'rgba(139,92,246,0.15)',
      }}
    >
      {/* Purple accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ background: 'linear-gradient(180deg, #8B5CF6, #6366F1)' }}
      />

      {/* Avatar */}
      <div
        className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center shadow-lg relative"
        style={{ boxShadow: '0 4px 16px rgba(139,92,246,0.2)' }}
      >
        <span className="text-white font-semibold text-lg">
          {convo.title?.[0]?.toUpperCase() || 'U'}
        </span>
        {/* Unread indicator dot */}
        {convo.unreadCount > 0 && (
          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#E0FE10] border-2 border-[#0a0a0b] flex items-center justify-center">
            <span className="text-[8px] font-bold text-black">{convo.unreadCount}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-white truncate">{convo.title}</h3>
            {convo.subtitle && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider"
                style={{
                  background: 'rgba(139,92,246,0.15)',
                  color: '#A78BFA',
                }}
              >
                {convo.subtitle}
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500 flex items-center gap-1 flex-shrink-0 ml-2">
            <Clock className="w-3 h-3" />
            {formatTimestamp(convo.lastMessageTime)}
          </span>
        </div>

        <p className="text-sm text-zinc-400 truncate">
          {convo.lastMessage}
        </p>
      </div>
    </motion.button>
  );
};

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
const PulseCheckMessagesPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [conversations, setConversations] = useState<UnifiedConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) {
      console.log('[PulseCheck Messages] No current user, skipping load');
      return;
    }

    const loadConversations = async () => {
      try {
        console.log('[PulseCheck Messages] Loading coach-athlete conversations for:', currentUser.id);
        setLoading(true);

        const coachAthleteConvos = await coachAthleteMessagingService.getUserConversations(currentUser.id);
        console.log('[PulseCheck Messages] Found', coachAthleteConvos.length, 'conversations');

        const unified: UnifiedConversation[] = coachAthleteConvos.map((convo: CoachAthleteConversation) => {
          const isCoach = convo.coachId === currentUser.id;
          return {
            id: convo.id,
            title: isCoach ? convo.athleteName : convo.coachName,
            subtitle: isCoach ? 'Athlete' : 'Coach',
            lastMessage: convo.lastMessage || 'No messages yet',
            lastMessageTime: convo.lastMessageTimestamp,
            unreadCount: convo.unreadCount?.[currentUser.id] || 0,
            otherUserId: isCoach ? convo.athleteId : convo.coachId,
            otherUserName: isCoach ? convo.athleteName : convo.coachName,
          };
        });

        // Sort by most recent
        unified.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
        setConversations(unified);
      } catch (error) {
        console.error('[PulseCheck Messages] Error loading conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [currentUser?.id]);

  const handleConversationClick = (convo: UnifiedConversation) => {
    router.push(`/PulseCheck/messages/${convo.id}`);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'pulsecheck-messages',
          pageTitle: 'Messages — PulseCheck',
          metaDescription: 'Coach-athlete conversations in PulseCheck.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/PulseCheck/messages"
      />

      <div className="min-h-screen bg-[#0a0a0b] text-white relative overflow-hidden">
        {/* Ambient orbs */}
        <FloatingOrb color="#8B5CF6" size={500} style={{ top: '-12%', left: '-8%' }} delay={0} />
        <FloatingOrb color="#6366F1" size={350} style={{ bottom: '-8%', right: '-6%' }} delay={3} />
        <FloatingOrb color="#E0FE10" size={250} style={{ top: '60%', right: '25%' }} delay={6} />

        {/* Noise overlay */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=\")",
          }}
        />

        <SideNav />

        <div className="md:ml-20 lg:ml-64 pb-16 md:pb-0 relative z-10">
          <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              {/* Back to PulseCheck */}
              <button
                onClick={() => router.push('/PulseCheck')}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to PulseCheck
              </button>

              <div className="flex items-center gap-4">
                {/* Icon with glow */}
                <div className="relative">
                  <div className="absolute -inset-2 bg-[#8B5CF6]/15 rounded-xl blur-xl" />
                  <div
                    className="relative w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'rgba(139,92,246,0.12)',
                      border: '1px solid rgba(139,92,246,0.2)',
                    }}
                  >
                    <Activity className="w-5 h-5 text-[#A78BFA]" />
                  </div>
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-white">Messages</h1>
                  <p className="text-sm text-zinc-400">
                    Coach–athlete conversations
                    {totalUnread > 0 && (
                      <span className="ml-2 text-[#E0FE10] font-semibold">
                        · {totalUnread} unread
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Conversations */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-3 text-zinc-400">
                  <div className="w-5 h-5 border-2 border-zinc-700 border-t-[#8B5CF6] rounded-full animate-spin" />
                  Loading conversations…
                </div>
              </div>
            ) : conversations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                  style={{
                    background: 'rgba(139,92,246,0.08)',
                    border: '1px solid rgba(139,92,246,0.15)',
                  }}
                >
                  <MessageCircle className="w-7 h-7 text-[#8B5CF6]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No conversations yet</h3>
                <p className="text-zinc-500 max-w-sm text-sm leading-relaxed">
                  When athletes connect with you via PulseCheck, your conversations will appear here.
                </p>
              </motion.div>
            ) : (
              <AnimatePresence>
                <div className="space-y-2">
                  {conversations.map((convo, i) => (
                    <ConversationCard
                      key={convo.id}
                      convo={convo}
                      onClick={() => handleConversationClick(convo)}
                      index={i}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PulseCheckMessagesPage;
