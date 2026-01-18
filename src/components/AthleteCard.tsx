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
  const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
  const [isMessagingModalOpen, setIsMessagingModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const currentUser = useUser();

  useEffect(() => {
    loadSentimentHistory();
  }, [athlete.id]);

  const loadSentimentHistory = async () => {
    try {
      const history = await coachService.getDailySentimentHistory(athlete.id, 28);
      setSentimentHistory(history);
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

  const handleDotHover = (record: DailySentimentRecord, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setHoveredDot(record);
  };

  const handleDotLeave = () => {
    setHoveredDot(null);
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

  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="relative group"
    >
      {/* Chromatic glow background */}
      <div className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-all duration-700 bg-gradient-to-br from-[#E0FE10]/30 via-transparent to-[#3B82F6]/20" />
      
      {/* Card surface */}
      <div className="relative rounded-2xl overflow-hidden backdrop-blur-xl bg-zinc-900/60 border border-white/10">
        {/* Chromatic top line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E0FE10]/60 to-transparent" />
        
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
                <span className="text-xs text-zinc-500">Weekly Goal</span>
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
                      <span className="text-xs text-zinc-500">28-Day Mood Cycle</span>
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
                    
                    {/* 28-Day Sentiment Grid */}
                    <div className="space-y-1">
                      {[0, 1, 2, 3].map((weekIndex) => (
                        <div key={weekIndex} className="flex justify-between items-center gap-1">
                          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                            const dataIndex = weekIndex * 7 + dayIndex;
                            const record = sentimentHistory[27 - dataIndex];
                            const isCurrentBlock = weekIndex >= 2;
                            
                            if (!record) {
                              return (
                                <div 
                                  key={dataIndex} 
                                  className="w-7 h-7 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center"
                                >
                                  <span className="text-[10px] text-zinc-700">-</span>
                                </div>
                              );
                            }
                            
                            const color = getSentimentColorHex(record.sentimentScore);
                            const hasData = record.messageCount > 0;
                            const dayOfMonth = record.date ? record.date.split('-')[2] : '';
                            
                            return (
                              <motion.div
                                key={record.id}
                                whileHover={{ scale: 1.15 }}
                                className={`relative w-7 h-7 rounded-lg cursor-pointer flex items-center justify-center transition-all duration-200 ${
                                  isCurrentBlock 
                                    ? 'ring-1 ring-[#E0FE10]/40 shadow-sm shadow-[#E0FE10]/10' 
                                    : 'border border-zinc-700/50'
                                }`}
                                style={{ backgroundColor: hasData ? color : '#374151' }}
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
                                {isCurrentBlock && (
                                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#E0FE10] rounded-full" />
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      ))}
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

      {/* Sentiment Tooltip */}
      <AnimatePresence>
        {hoveredDot && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltipPosition.x - 100,
              top: tooltipPosition.y - 120,
              minWidth: '200px'
            }}
          >
            <div className="rounded-xl backdrop-blur-xl bg-zinc-900/95 border border-white/10 p-3 shadow-2xl">
              <div className="text-sm font-medium text-white mb-2">
                {formatDate(hoveredDot.date)}
              </div>
              
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Messages:</span>
                  <span className="text-white font-medium">{hoveredDot.messageCount}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Sentiment:</span>
                  <span 
                    className="font-medium px-2 py-0.5 rounded-full text-[10px]"
                    style={{ 
                      backgroundColor: hoveredDot.messageCount > 0 ? `${getSentimentColorHex(hoveredDot.sentimentScore)}20` : '#374151',
                      color: hoveredDot.messageCount > 0 ? getSentimentColorHex(hoveredDot.sentimentScore) : '#6B7280'
                    }}
                  >
                    {hoveredDot.messageCount > 0 ? getSentimentLabel(hoveredDot.sentimentScore) : 'No Data'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-zinc-500">Score:</span>
                  <span className="text-white font-medium">
                    {hoveredDot.messageCount > 0 ? hoveredDot.sentimentScore.toFixed(2) : '-'}
                  </span>
                </div>
                
                {hoveredDot.messageCount === 0 && (
                  <div className="text-zinc-600 text-center pt-2 italic border-t border-white/5 mt-2">
                    No messages this day
                  </div>
                )}
              </div>
              
              {/* Tooltip arrow */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900/95" />
            </div>
          </motion.div>
        )}
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
    </motion.div>
  );
};

export default AthleteCard;
