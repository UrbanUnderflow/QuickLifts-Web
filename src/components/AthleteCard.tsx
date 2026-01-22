import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  MessageCircle, 
  Calendar, 
  TrendingUp, 
  RefreshCw,
  Clock,
  Sparkles,
  ChevronRight,
  Activity
} from 'lucide-react';
import { coachService, DailySentimentRecord } from '../api/firebase/coach/service';
import ConversationModal from './ConversationModal';
import CoachAthleteMessagingModal from './CoachAthleteMessagingModal';
import AthleteDetailsModal from './AthleteDetailsModal';
import { useUser } from '../hooks/useUser';
import { EscalationTier, getTierLabel, getTierColor } from '../api/firebase/escalation/types';

interface AthleteData {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl?: string;
  lastActiveDate?: Date;
  totalSessions?: number;
  weeklyGoalProgress?: number;
  sentimentScore?: number;
  lastConversationDate?: Date;
  conversationCount?: number;
  activeEscalationTier?: number; // 0 = None, 1 = MonitorOnly, 2 = ElevatedRisk, 3 = CriticalRisk
}

interface AthleteCardProps {
  athlete: AthleteData;
  onViewDetails?: (athleteId: string) => void;
  onMessageAthlete?: (athleteId: string) => void;
}

const AthleteCard: React.FC<AthleteCardProps> = ({ 
  athlete, 
  onViewDetails: _onViewDetails, 
  onMessageAthlete: _onMessageAthlete 
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sentimentHistory, setSentimentHistory] = useState<DailySentimentRecord[]>([]);
  const [sentimentLoaded, setSentimentLoaded] = useState(false);
  const [hoveredDot, setHoveredDot] = useState<DailySentimentRecord | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [hoveredDayContext, setHoveredDayContext] = useState<{ sampleMessage?: string; topics?: string[] } | null>(null);
  const [hoveredEscalationBadge, setHoveredEscalationBadge] = useState(false);
  const [escalationBadgePosition, setEscalationBadgePosition] = useState({ x: 0, y: 0 });
  const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
  const [isMessagingModalOpen, setIsMessagingModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const currentUser = useUser();

  // Debug: Log escalation tier when it changes
  useEffect(() => {
    console.log(`🔍 [AthleteCard] ${athlete.displayName} (${athlete.id}) - Escalation tier check:`, {
      activeEscalationTier: athlete.activeEscalationTier,
      isDefined: athlete.activeEscalationTier !== undefined,
      isGreaterThanZero: athlete.activeEscalationTier !== undefined && athlete.activeEscalationTier > 0,
      shouldShowBadge: athlete.activeEscalationTier !== undefined && athlete.activeEscalationTier >= EscalationTier.MonitorOnly
    });
    
    if (athlete.activeEscalationTier !== undefined && athlete.activeEscalationTier > 0) {
      console.log(`✅ [AthleteCard] ${athlete.displayName} HAS active escalation tier:`, athlete.activeEscalationTier);
    } else {
      console.log(`⚠️ [AthleteCard] ${athlete.displayName} has NO escalation (tier: ${athlete.activeEscalationTier})`);
    }
  }, [athlete.activeEscalationTier, athlete.displayName, athlete.id]);

  useEffect(() => {
    loadSentimentHistory();
  }, [athlete.id]);

  const loadSentimentHistory = async () => {
    try {
      // First, try to get existing sentiment history
      let history = await coachService.getDailySentimentHistory(athlete.id, 28);
      console.log(`[AthleteCard] Loaded sentiment history for ${athlete.displayName}:`, {
        count: history.length,
        dates: history.map(r => r.date).slice(0, 10),
        recentDates: history.slice(0, 3).map(r => ({
          date: r.date,
          score: r.sentimentScore,
          messageCount: r.messageCount
        }))
      });
      
      // Check if we have recent days (last 3 days) with conversations but no sentiment
      const today = new Date();
      const recentDates = [];
      for (let i = 0; i < 3; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        recentDates.push(`${year}-${month}-${day}`);
      }
      
      const missingDates = recentDates.filter(dateStr => !history.find(r => r.date === dateStr));
      if (missingDates.length > 0) {
        console.log(`[AthleteCard] Missing sentiment data for recent dates: ${missingDates.join(', ')}. Processing...`);
        // Auto-process sentiment for missing recent days
        try {
          const processed = await coachService.processSentimentForAthlete(athlete.id, 28);
          history = processed;
          console.log(`[AthleteCard] Processed sentiment, now have ${history.length} records`);
        } catch (processError) {
          console.warn('[AthleteCard] Failed to auto-process sentiment (non-blocking):', processError);
        }
      }
      
      // Filter out records with no messages (days without conversations)
      const historyWithMessages = history.filter(r => r.messageCount > 0);
      console.log(`[AthleteCard] Filtered sentiment history: ${history.length} total records, ${historyWithMessages.length} with messages`);
      
      setSentimentHistory(historyWithMessages);
      setSentimentLoaded(true);
    } catch (error) {
      console.error('Error loading sentiment history:', error);
      setSentimentHistory([]);
      setSentimentLoaded(true);
    }
  };

  const handleRefreshSentiment = async () => {
    try {
      setIsRefreshing(true);
      const newSentimentData = await coachService.processSentimentForAthlete(athlete.id, 28);
      setSentimentHistory(newSentimentData);
    } catch (error) {
      console.error('Error refreshing sentiment:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSentimentColorHex = (score: number): string => {
    if (score >= 0.3) return '#10B981';
    if (score >= -0.3) return '#F59E0B';
    return '#EF4444';
  };

  const getSentimentLabel = (score: number): string => {
    if (score >= 0.3) return 'Positive';
    if (score >= -0.3) return 'Moderate';
    return 'Negative';
  };

  // Coach-friendly sentiment level descriptions
  const getSentimentLevel = (score: number): { level: string; description: string; intensity: string } => {
    if (score >= 0.7) {
      return {
        level: 'Very Positive',
        intensity: 'High',
        description: 'Athlete expressed strong positive emotions, enthusiasm, or satisfaction.'
      };
    } else if (score >= 0.3) {
      return {
        level: 'Positive',
        intensity: 'Moderate',
        description: 'Athlete showed generally positive mood and outlook.'
      };
    } else if (score >= 0.1) {
      return {
        level: 'Slightly Positive',
        intensity: 'Low',
        description: 'Athlete had a mildly positive or neutral-positive tone.'
      };
    } else if (score >= -0.1) {
      return {
        level: 'Neutral',
        intensity: 'None',
        description: 'Athlete maintained a balanced, neutral emotional state.'
      };
    } else if (score >= -0.3) {
      return {
        level: 'Slightly Negative',
        intensity: 'Low',
        description: 'Athlete showed mild concerns or slightly negative emotions.'
      };
    } else if (score >= -0.6) {
      return {
        level: 'Moderately Negative',
        intensity: 'Moderate',
        description: 'Athlete expressed notable stress, worry, or negative feelings that may need attention.'
      };
    } else if (score >= -0.8) {
      return {
        level: 'Significantly Negative',
        intensity: 'High',
        description: 'Athlete showed strong negative emotions, distress, or significant concerns requiring support.'
      };
    } else {
      return {
        level: 'Severely Negative',
        intensity: 'Critical',
        description: 'Athlete expressed extreme distress, hopelessness, or critical concerns that need immediate attention.'
      };
    }
  };

  const handleDotHover = async (record: DailySentimentRecord, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate position - center above the dot
    let x = rect.left + rect.width / 2;
    let y = rect.top - 10;
    
    // Adjust if tooltip would go off screen
    if (x < 110) x = 110; // Keep away from left edge (half tooltip width)
    if (x > viewportWidth - 110) x = viewportWidth - 110; // Keep away from right edge
    if (y < 150) {
      // If too close to top, show below instead
      y = rect.bottom + 10;
    }
    
    setTooltipPosition({ x, y });
    setHoveredDot(record);
    
    // Fetch message context for this day to provide coach-friendly insights
    if (record.messageCount > 0) {
      try {
        const messages = await coachService.getMessagesForDate(athlete.id, record.date);
        if (messages.length > 0) {
          // Get a sample message (prefer user messages, not AI responses)
          const userMessages = messages.filter((msg, idx) => idx % 2 === 0 || msg.toLowerCase().includes('i ') || msg.toLowerCase().includes('my '));
          const sampleMessage = userMessages[0] || messages[0];
          
          // Extract key topics/concerns from messages
          const topics: string[] = [];
          const allText = messages.join(' ').toLowerCase();
          
          if (allText.includes('stress') || allText.includes('stressed') || allText.includes('stressing')) topics.push('Stress');
          if (allText.includes('anxious') || allText.includes('anxiety') || allText.includes('worried') || allText.includes('worry')) topics.push('Anxiety');
          if (allText.includes('depress') || allText.includes('sad') || allText.includes('down')) topics.push('Mood');
          if (allText.includes('tired') || allText.includes('exhaust') || allText.includes('fatigue')) topics.push('Fatigue');
          if (allText.includes('injur') || allText.includes('hurt') || allText.includes('pain')) topics.push('Injury');
          if (allText.includes('competition') || allText.includes('compete') || allText.includes('game') || allText.includes('match')) topics.push('Competition');
          if (allText.includes('recover') || allText.includes('heal') || allText.includes('rehab')) topics.push('Recovery');
          if (allText.includes('hopeless') || allText.includes('helpless') || allText.includes('can\'t')) topics.push('Hopelessness');
          
          setHoveredDayContext({
            sampleMessage: sampleMessage.length > 120 ? sampleMessage.substring(0, 120) + '...' : sampleMessage,
            topics: topics.slice(0, 3) // Limit to 3 topics
          });
        } else {
          setHoveredDayContext(null);
        }
      } catch (error) {
        console.warn('[AthleteCard] Failed to fetch message context:', error);
        setHoveredDayContext(null);
      }
    } else {
      setHoveredDayContext(null);
    }
    
    console.log('[AthleteCard] Tooltip hover:', { 
      date: record.date, 
      x, 
      y, 
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      viewport: { width: viewportWidth, height: viewportHeight },
      hoveredDotSet: true
    });
  };

  const handleDotLeave = () => {
    setHoveredDot(null);
    setHoveredDayContext(null);
  };

  const formatDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatLastActive = (date?: Date): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
  };

  const isActiveToday = () => {
    if (!athlete.lastActiveDate) return false;
    const now = new Date();
    const last = new Date(athlete.lastActiveDate);
    return (now.getTime() - last.getTime()) < 86400000;
  };

  // Get escalation tier explanation for coach
  const getEscalationExplanation = (tier: number) => {
    switch (tier) {
      case EscalationTier.MonitorOnly:
        return {
          title: 'Tier 1: Monitor Only',
          description: 'The athlete expressed concerns that warrant your attention but don\'t require immediate clinical intervention.',
          action: 'You\'ve been notified. Please check in with the athlete when convenient.',
          examples: ['Performance stress', 'Fatigue concerns', 'Emotional variability', 'Burnout indicators'],
          color: '#3B82F6'
        };
      case EscalationTier.ElevatedRisk:
        return {
          title: 'Tier 2: Elevated Risk',
          description: 'The athlete showed signs of elevated psychological distress that may benefit from professional support.',
          action: 'A clinical handoff has been initiated (with athlete consent). A mental health professional will reach out.',
          examples: ['Persistent distress', 'Anxiety indicators', 'Injury-related psychological concerns', 'Recurring concerns'],
          color: '#F97316'
        };
      case EscalationTier.CriticalRisk:
        return {
          title: 'Tier 3: Critical Risk',
          description: 'The athlete expressed critical safety concerns requiring immediate professional intervention.',
          action: 'A mandatory clinical handoff has been initiated. A mental health professional is being connected immediately.',
          examples: ['Self-harm indicators', 'Suicidal ideation', 'Imminent safety risk', 'Severe psychological distress'],
          color: '#EF4444'
        };
      default:
        return null;
    }
  };

  return (
    <>
      <motion.div 
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className="relative group"
        style={{ overflow: 'visible' }}
      >
      {/* Chromatic glow background */}
      <div className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-all duration-700 bg-gradient-to-br from-[#E0FE10]/30 via-transparent to-[#3B82F6]/20" />
      
      {/* Card surface - overflow-hidden only for card content, not tooltips */}
      <div 
        className={`relative rounded-2xl backdrop-blur-xl border transition-all duration-500 ${
          athlete.activeEscalationTier && athlete.activeEscalationTier >= EscalationTier.MonitorOnly
            ? athlete.activeEscalationTier === EscalationTier.MonitorOnly
              ? 'bg-zinc-900/70 border-[#3B82F6]/40'
              : 'bg-zinc-900/75 border-[#F97316]/40'
            : 'bg-zinc-900/60 border-white/10'
        }`}
        style={{
          overflow: 'visible',
          ...(athlete.activeEscalationTier && athlete.activeEscalationTier >= EscalationTier.MonitorOnly
            ? athlete.activeEscalationTier === EscalationTier.MonitorOnly
              ? { boxShadow: '0 0 25px rgba(59, 130, 246, 0.15), inset 0 0 30px rgba(59, 130, 246, 0.03)' }
              : { boxShadow: '0 0 25px rgba(249, 115, 22, 0.15), inset 0 0 30px rgba(249, 115, 22, 0.03)' }
            : {})
        }}
      >
        {/* Chromatic top line - blue for Tier 1, warm for Tier 2/3 */}
        <div 
          className="absolute top-0 left-0 right-0 h-[1px] transition-all duration-500"
          style={{
            background: athlete.activeEscalationTier && athlete.activeEscalationTier >= EscalationTier.MonitorOnly
              ? athlete.activeEscalationTier === EscalationTier.MonitorOnly
                ? 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.7), transparent)'
                : 'linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.7), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(224, 254, 16, 0.6), transparent)'
          }}
        />
        
        {/* Escalation Badge */}
        {athlete.activeEscalationTier && athlete.activeEscalationTier >= EscalationTier.MonitorOnly && (() => {
          const tierColors = getTierColor(athlete.activeEscalationTier);
          const tierLabel = athlete.activeEscalationTier === EscalationTier.MonitorOnly 
            ? 'Tier 1 Escalation'
            : athlete.activeEscalationTier === EscalationTier.ElevatedRisk
            ? 'Tier 2 Escalation'
            : 'Tier 3 Escalation';
          
          return (
            <div className="absolute top-3 right-3 z-10">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setEscalationBadgePosition({
                    x: rect.right - 10,
                    y: rect.top + rect.height / 2
                  });
                  setHoveredEscalationBadge(true);
                }}
                onMouseLeave={() => setHoveredEscalationBadge(false)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 shadow-lg backdrop-blur-md cursor-help transition-all hover:scale-105"
                style={{
                  backgroundColor: tierColors.bg,
                  color: tierColors.text,
                  borderColor: tierColors.border,
                }}
              >
                {tierLabel}
              </motion.div>
            </div>
          );
        })()}
        
        {/* Inner highlight */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative p-5">
          {/* Header with Profile */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                {athlete.profileImageUrl ? (
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#E0FE10]/40 to-[#3B82F6]/40 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img
                      src={athlete.profileImageUrl}
                      alt={athlete.displayName}
                      className="relative w-12 h-12 rounded-full object-cover ring-2 ring-white/10"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#E0FE10]/40 to-[#3B82F6]/40 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center ring-2 ring-white/10">
                      <User className="text-zinc-400 w-5 h-5" />
                    </div>
                  </div>
                )}
                {/* Online status indicator */}
                <motion.div 
                  className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-zinc-900 ${
                    isActiveToday() ? 'bg-[#10B981]' : 'bg-zinc-600'
                  }`}
                  animate={isActiveToday() ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{athlete.displayName}</h3>
                <p className="text-sm text-zinc-500 truncate max-w-[180px]">{athlete.email}</p>
              </div>
            </div>
          </div>

          {/* Stats Grid - Glassmorphic */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              onClick={() => setIsConversationModalOpen(true)}
              className="relative cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br from-[#3B82F6]/10 to-[#3B82F6]/5 border border-[#3B82F6]/20 p-3 group/stat"
            >
              <div className="absolute inset-0 bg-[#3B82F6]/5 opacity-0 group-hover/stat:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="w-4 h-4 text-[#3B82F6]" />
                  <span className="text-xs text-zinc-500">Conversations</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {athlete.conversationCount || 0}
                </div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#8B5CF6]/5 border border-[#8B5CF6]/20 p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-xs text-zinc-500">Sessions</span>
              </div>
              <div className="text-xl font-bold text-white">
                {athlete.totalSessions || 0}
              </div>
            </motion.div>
          </div>

          {/* Progress Bar */}
          {athlete.weeklyGoalProgress !== undefined && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500">Weekly Check-Ins</span>
                <span className="text-xs font-medium text-white">{Math.round(athlete.weeklyGoalProgress)}%</span>
              </div>
              <div className="relative w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(athlete.weeklyGoalProgress, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#E0FE10] to-[#10B981]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
            </div>
          )}

          {/* Sentiment Graph */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-zinc-500">Mood Analysis</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefreshSentiment}
                disabled={isRefreshing}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                  isRefreshing 
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
              </motion.button>
            </div>
            
            {!sentimentLoaded || isRefreshing ? (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 rounded-full border-2 border-[#E0FE10] border-t-transparent mb-2"
                  />
                  <span className="text-xs text-zinc-500">
                    {isRefreshing ? 'Processing sentiment...' : 'Loading sentiment data...'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                {sentimentHistory.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">28-Day Mood Cycle</span>
                        <span className="text-xs text-zinc-600">
                          {(() => {
                            const today = new Date();
                            return today.toLocaleDateString('en-US', { month: 'short' });
                          })()}
                        </span>
                      </div>
                      <span 
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ 
                          backgroundColor: `${getSentimentColorHex(sentimentHistory[sentimentHistory.length - 1]?.sentimentScore ?? 0)}20`,
                          color: getSentimentColorHex(sentimentHistory[sentimentHistory.length - 1]?.sentimentScore ?? 0)
                        }}
                      >
                        {getSentimentLabel(sentimentHistory[sentimentHistory.length - 1]?.sentimentScore ?? 0)}
                      </span>
                    </div>
                    
                    {/* 28-Day Sentiment Grid - Count backwards from today */}
                    <div className="space-y-1">
                      {(() => {
                        const today = new Date();
                        const gridDays: Array<{ date: Date; record: DailySentimentRecord | null; isToday: boolean }> = [];
                        
                        // Helper to format date as YYYY-MM-DD in local timezone (not UTC)
                        const formatDateLocal = (d: Date): string => {
                          const year = d.getFullYear();
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const day = String(d.getDate()).padStart(2, '0');
                          return `${year}-${month}-${day}`;
                        };
                        
                        // Build array of last 28 days counting backwards from today
                        for (let i = 0; i < 28; i++) {
                          const date = new Date(today);
                          date.setDate(date.getDate() - i);
                          const dateStr = formatDateLocal(date); // YYYY-MM-DD in local timezone
                          const record = sentimentHistory.find(r => r.date === dateStr) || null;
                          
                          // Debug logging for first few days
                          if (i < 3 && record) {
                            console.log(`[AthleteCard] Day ${i}: ${dateStr} → Found record:`, {
                              date: record.date,
                              score: record.sentimentScore,
                              messageCount: record.messageCount
                            });
                          }
                          
                          gridDays.push({ date, record, isToday: i === 0 });
                        }
                        
                        // Render in 4 rows of 7 days
                        return [0, 1, 2, 3].map((weekIndex) => (
                          <div key={weekIndex} className="flex justify-between items-center gap-1">
                            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                              const gridIndex = weekIndex * 7 + dayIndex;
                              const { date, record, isToday } = gridDays[gridIndex] || { date: new Date(), record: null, isToday: false };
                              
                              if (!record) {
                                return (
                                  <div 
                                    key={gridIndex} 
                                    className="w-7 h-7 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center"
                                  >
                                    <span className="text-[10px] text-zinc-700">{date.getDate()}</span>
                                  </div>
                                );
                              }
                              
                              // Only show color if there were actual conversations that day
                              const hasData = record.messageCount > 0;
                              const color = hasData ? getSentimentColorHex(record.sentimentScore) : '#374151';
                              const dayOfMonth = date.getDate();
                              
                              return (
                                <motion.div
                                  key={record.id || gridIndex}
                                  whileHover={{ scale: 1.15 }}
                                  className={`relative w-7 h-7 rounded-lg cursor-pointer flex items-center justify-center transition-all duration-200 ${
                                    isToday
                                      ? 'ring-1 ring-[#E0FE10]/40 shadow-sm shadow-[#E0FE10]/10' 
                                      : 'border border-zinc-700/50'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  onMouseEnter={(e) => handleDotHover(record, e)}
                                  onMouseLeave={handleDotLeave}
                                >
                                  <span className={`text-[10px] font-medium ${
                                    hasData 
                                      ? (record.sentimentScore > 0.1 ? 'text-white' : 'text-zinc-200')
                                      : 'text-zinc-500'
                                  }`}>
                                    {dayOfMonth}
                                  </span>
                                  {isToday && (
                                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#E0FE10] rounded-full" />
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                    
                    {/* Legend */}
                    <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                        <span className="text-[10px] text-zinc-500">Positive</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                        <span className="text-[10px] text-zinc-500">Moderate</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                        <span className="text-[10px] text-zinc-500">Negative</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Activity className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                    <span className="text-xs text-zinc-500">No sentiment data available</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Last Active */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-xs text-zinc-500">Last Active</span>
            </div>
            <span className={`text-xs font-medium ${
              isActiveToday() ? 'text-[#10B981]' : 'text-zinc-400'
            }`}>
              {formatLastActive(athlete.lastActiveDate)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsDetailsModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 text-sm font-medium transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              View Details
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(224,254,16,0.3)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsMessagingModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E0FE10] text-black text-sm font-semibold transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Message
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>

      {/* Sentiment Tooltip - Render outside card container to avoid overflow clipping */}
      <AnimatePresence>
        {hoveredDot && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ duration: 0.15 }}
            className="fixed pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 99999,
            }}
            onAnimationStart={() => console.log('[AthleteCard] Tooltip animating in:', hoveredDot?.date)}
            onAnimationComplete={() => console.log('[AthleteCard] Tooltip animation complete')}
          >
            <div className="rounded-xl backdrop-blur-xl bg-zinc-900/98 border border-white/20 p-4 shadow-2xl min-w-[280px] max-w-[320px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                <div className="text-sm font-semibold text-white">
                  {formatDate(hoveredDot.date)}
                </div>
                <div 
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ 
                    backgroundColor: `${getSentimentColorHex(hoveredDot.sentimentScore)}20`,
                    color: getSentimentColorHex(hoveredDot.sentimentScore)
                  }}
                >
                  {getSentimentLabel(hoveredDot.sentimentScore)}
                </div>
              </div>
              
              {/* Details */}
              <div className="space-y-3 text-xs">
                {/* Coach-Friendly Sentiment Level */}
                {(() => {
                  const sentimentLevel = getSentimentLevel(hoveredDot.sentimentScore);
                  return (
                    <div className="pb-2 border-b border-white/10">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-zinc-400 text-[10px]">Sentiment Level</span>
                        <span 
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ 
                            backgroundColor: `${getSentimentColorHex(hoveredDot.sentimentScore)}20`,
                            color: getSentimentColorHex(hoveredDot.sentimentScore)
                          }}
                        >
                          {sentimentLevel.level}
                        </span>
                      </div>
                      <p className="text-zinc-300 text-[11px] leading-relaxed mt-1.5">
                        {sentimentLevel.description}
                      </p>
                      {sentimentLevel.intensity !== 'None' && (
                        <div className="mt-1.5 text-[10px] text-zinc-500">
                          Intensity: <span className="text-zinc-400 font-medium">{sentimentLevel.intensity}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                {/* Message Context */}
                {hoveredDayContext && hoveredDayContext.sampleMessage && (
                  <div className="pb-2 border-b border-white/10">
                    <div className="text-zinc-400 text-[10px] mb-1.5">Sample Message:</div>
                    <p className="text-zinc-200 text-[11px] leading-relaxed italic">
                      "{hoveredDayContext.sampleMessage}"
                    </p>
                    {hoveredDayContext.topics && hoveredDayContext.topics.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {hoveredDayContext.topics.map((topic, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800/50 text-zinc-300 border border-zinc-700/50"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Stats */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <MessageCircle className="w-3 h-3" />
                      Messages
                    </span>
                    <span className="text-white font-semibold">{hoveredDot.messageCount}</span>
                  </div>
                  
                  {/* Technical score (collapsed by default, can expand) */}
                  <details className="group">
                    <summary className="cursor-pointer text-zinc-500 text-[10px] hover:text-zinc-400 transition-colors">
                      Technical Details
                    </summary>
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-zinc-500 text-[10px]">Raw Score:</span>
                        <span className="text-zinc-400 text-[10px] font-mono">
                          {hoveredDot.sentimentScore >= 0 ? '+' : ''}{hoveredDot.sentimentScore.toFixed(3)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${((hoveredDot.sentimentScore + 1) / 2) * 100}%`,
                              backgroundColor: getSentimentColorHex(hoveredDot.sentimentScore)
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                        <span>Negative (-1.0)</span>
                        <span>Neutral (0.0)</span>
                        <span>Positive (+1.0)</span>
                      </div>
                    </div>
                  </details>
                </div>
                
                {hoveredDot.messageCount === 0 && (
                  <div className="text-zinc-500 text-center pt-2 italic border-t border-white/5 mt-2 text-[10px]">
                    No conversations this day
                  </div>
                )}
              </div>
              
              {/* Tooltip arrow pointing down */}
              <div 
                className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent"
                style={{ borderTopColor: 'rgba(24, 24, 27, 0.98)' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Escalation Badge Tooltip */}
      <AnimatePresence>
        {hoveredEscalationBadge && athlete.activeEscalationTier && athlete.activeEscalationTier >= EscalationTier.MonitorOnly && (() => {
          const explanation = getEscalationExplanation(athlete.activeEscalationTier);
          if (!explanation) return null;
          
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -10 }}
              transition={{ duration: 0.15 }}
              className="fixed pointer-events-none"
              style={{
                left: `${escalationBadgePosition.x}px`,
                top: `${escalationBadgePosition.y}px`,
                transform: 'translate(-100%, -50%)',
                zIndex: 99999,
              }}
            >
              <div className="rounded-xl backdrop-blur-xl bg-zinc-900/98 border border-white/20 p-4 shadow-2xl min-w-[300px] max-w-[360px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                  <div className="text-sm font-semibold text-white">
                    {explanation.title}
                  </div>
                  <div 
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ 
                      backgroundColor: `${explanation.color}20`,
                      color: explanation.color
                    }}
                  >
                    Active
                  </div>
                </div>
                
                {/* Description */}
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="text-zinc-400 text-[10px] mb-1.5">What This Means:</div>
                    <p className="text-zinc-200 text-[11px] leading-relaxed">
                      {explanation.description}
                    </p>
                  </div>
                  
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-zinc-400 text-[10px] mb-1.5">Action Taken:</div>
                    <p className="text-zinc-200 text-[11px] leading-relaxed">
                      {explanation.action}
                    </p>
                  </div>
                  
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-zinc-400 text-[10px] mb-2">Common Indicators:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {explanation.examples.map((example, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800/50 text-zinc-300 border border-zinc-700/50"
                        >
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Tooltip arrow pointing right */}
                <div 
                  className="absolute right-0 top-1/2 transform translate-x-full -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[6px] border-transparent"
                  style={{ borderLeftColor: 'rgba(24, 24, 27, 0.98)' }}
                />
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Modals */}
      <ConversationModal
        isOpen={isConversationModalOpen}
        onClose={() => setIsConversationModalOpen(false)}
        athleteId={athlete.id}
        athleteName={athlete.displayName}
      />

      {currentUser && (
        <CoachAthleteMessagingModal
          isOpen={isMessagingModalOpen}
          onClose={() => setIsMessagingModalOpen(false)}
          athleteId={athlete.id}
          athleteName={athlete.displayName}
          coachId={currentUser.id}
          coachName={currentUser.displayName || currentUser.username || 'Coach'}
        />
      )}

      <AthleteDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        athleteId={athlete.id}
        athleteName={athlete.displayName}
        onStartMessaging={() => setIsMessagingModalOpen(true)}
      />
    </>
  );
};

export default AthleteCard;
