import React, { useState, useEffect } from 'react';
import { FaUser, FaHeart, FaComments, FaCalendar, FaChartLine, FaSync } from 'react-icons/fa';
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
  sentimentScore?: number; // -1 to 1, where 1 is very positive
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
  onViewDetails, 
  onMessageAthlete 
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

  // Load existing sentiment data on component mount
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
      console.log(`Refreshing sentiment for athlete: ${athlete.displayName}`);
      
      // Process the last 28 days of sentiment data
      const newSentimentData = await coachService.processSentimentForAthlete(athlete.id, 28);
      
      // Update the state with the new data
      setSentimentHistory(newSentimentData);
      
      console.log(`Sentiment refresh complete for ${athlete.displayName}:`, newSentimentData);
    } catch (error) {
      console.error('Error refreshing sentiment:', error);
      alert(`Error refreshing sentiment for ${athlete.displayName}. Check console for details.`);
    } finally {
      setIsRefreshing(false);
    }
  };
  const getSentimentColor = (score?: number): string => {
    if (!score) return 'text-gray-400';
    if (score >= 0.5) return 'text-green-400';
    if (score >= 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSentimentColorHex = (score: number): string => {
    if (score >= 0.3) return '#10B981'; // Green
    if (score >= -0.3) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
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
    // dateString is in YYYY-MM-DD format, parse it correctly
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    
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

  return (
    <div className="bg-zinc-900 rounded-xl p-6 hover:bg-zinc-800 transition-colors border border-zinc-800 hover:border-zinc-700">
      {/* Header with Profile */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            {athlete.profileImageUrl ? (
              <img
                src={athlete.profileImageUrl}
                alt={athlete.displayName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                <FaUser className="text-zinc-400 text-lg" />
              </div>
            )}
            {/* Online status indicator */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-zinc-900"></div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{athlete.displayName}</h3>
            <p className="text-sm text-zinc-400">{athlete.email}</p>
          </div>
        </div>
        

      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div 
          className="bg-zinc-800 rounded-lg p-3 cursor-pointer hover:bg-zinc-700 transition-colors"
          onClick={() => setIsConversationModalOpen(true)}
          title="Click to view conversations"
        >
          <div className="flex items-center space-x-2 mb-1">
            <FaComments className="text-blue-400 text-sm" />
            <span className="text-xs text-zinc-400">Conversations</span>
          </div>
          <div className="text-lg font-bold text-white">
            {athlete.conversationCount || 0}
          </div>
        </div>

        <div className="bg-zinc-800 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <FaCalendar className="text-purple-400 text-sm" />
            <span className="text-xs text-zinc-400">Sessions</span>
          </div>
          <div className="text-lg font-bold text-white">
            {athlete.totalSessions || 0}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {athlete.weeklyGoalProgress !== undefined && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Weekly Goal</span>
            <span className="text-sm text-white">{Math.round(athlete.weeklyGoalProgress)}%</span>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2">
            <div
              className="bg-[#E0FE10] h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(athlete.weeklyGoalProgress, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Sentiment Graph */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Mood Analysis</span>
          <button
            onClick={handleRefreshSentiment}
            disabled={isRefreshing}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
              isRefreshing 
                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
            title="Refresh sentiment analysis for the last 28 days"
          >
            <FaSync className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
        
        {!sentimentLoaded ? (
          <div className="bg-zinc-800 rounded-lg p-4 text-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#E0FE10] mx-auto mb-2"></div>
            <span className="text-xs text-zinc-400">Loading sentiment data...</span>
          </div>
        ) : isRefreshing ? (
          <div className="bg-zinc-800 rounded-lg p-4 text-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#E0FE10] mx-auto mb-2"></div>
            <span className="text-xs text-zinc-400">Processing sentiment analysis...</span>
          </div>
        ) : (
          <div className="bg-zinc-800 rounded-lg p-3">
            {sentimentHistory.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-400">28-Day Mood Cycle</span>
                  <span className="text-xs text-zinc-400">
                    {getSentimentLabel(sentimentHistory[sentimentHistory.length - 1]?.sentimentScore ?? 0)}
                  </span>
                </div>
                
                {/* 28-Day Sentiment Grid with Date Indicators */}
                <div className="mb-3">
                  {/* 4 rows of 7 days each - showing past 28 days */}
                  <div className="space-y-1">
                    {[0, 1, 2, 3].map((weekIndex) => (
                      <div key={weekIndex} className="flex justify-between items-center gap-1">
                        {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                          // Calculate the correct index for grid display
                          // Week 0 = oldest week (28 days ago), Week 3 = newest week (today)
                          const dataIndex = weekIndex * 7 + dayIndex;
                          // sentimentHistory is newest first, so we need to reverse access
                          const record = sentimentHistory[27 - dataIndex];
                          const isCurrentBlock = weekIndex >= 2; // Last 2 weeks = 14 days
                          
                          if (!record) {
                            return (
                              <div key={dataIndex} className="w-8 h-8 rounded-lg border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                                <span className="text-xs text-zinc-600">-</span>
                              </div>
                            );
                          }
                          
                          const color = getSentimentColorHex(record.sentimentScore);
                          const hasData = record.messageCount > 0;
                          const hasSentimentData = hasData; // Only show sentiment color if there are actual messages
                          
                          // Extract day from date string (YYYY-MM-DD format)
                          const dayOfMonth = record.date ? record.date.split('-')[2] : '';
                          
                          return (
                            <div
                              key={record.id}
                              className={`w-8 h-8 rounded-lg cursor-pointer hover:scale-105 transition-all duration-200 flex items-center justify-center relative ${
                                isCurrentBlock 
                                  ? 'ring-1 ring-[#E0FE10] shadow-sm shadow-[#E0FE10]/20' 
                                  : 'border border-zinc-600'
                              }`}
                              style={{ backgroundColor: hasSentimentData ? color : '#4B5563' }}
                              onMouseEnter={(e) => handleDotHover(record, e)}
                              onMouseLeave={handleDotLeave}
                            >
                              <span className={`text-xs font-medium ${
                                hasSentimentData 
                                  ? (record.sentimentScore > 0.1 ? 'text-white' : 'text-zinc-200')
                                  : 'text-zinc-400'
                              }`}>
                                {dayOfMonth}
                              </span>
                              {isCurrentBlock && (
                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  
                  {/* Last 14 days indicator */}
                  <div className="flex items-center justify-center mt-3 text-xs">
                    <div className="flex items-center space-x-1 bg-zinc-800/50 px-2 py-1 rounded-full">
                      <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                      <span className="text-[#E0FE10]">Last 14 days</span>
                    </div>
                  </div>
                </div>
                
                {/* Compact Legend */}
                <div className="flex items-center justify-center space-x-4 text-xs bg-zinc-800/30 rounded-full px-3 py-1.5">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-zinc-400">Positive</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="text-zinc-400">Moderate</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-zinc-400">Negative</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                    <span className="text-zinc-400">No Data</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-400 py-4">
                <span className="text-xs">No sentiment data available</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Last Active */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-zinc-400">Last Active</span>
        <span className="text-sm text-white">{formatLastActive(athlete.lastActiveDate)}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={() => setIsDetailsModalOpen(true)}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <FaChartLine className="text-xs" />
          <span>View Details</span>
        </button>
        <button
          onClick={() => setIsMessagingModalOpen(true)}
          className="flex-1 bg-[#E0FE10] hover:bg-lime-400 text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <FaComments className="text-xs" />
          <span>Message</span>
        </button>
      </div>

      {/* Sentiment Tooltip */}
      {hoveredDot && (
        <div
          className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg pointer-events-none"
          style={{
            left: tooltipPosition.x - 100, // Center the tooltip
            top: tooltipPosition.y - 120, // Position above the dot
            minWidth: '200px'
          }}
        >
          <div className="text-sm font-medium text-white mb-2">
            {formatDate(hoveredDot.date)}
          </div>
          
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Messages:</span>
              <span className="text-white">{hoveredDot.messageCount}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-zinc-400">Sentiment:</span>
              <span 
                className="font-medium"
                style={{ color: hoveredDot.messageCount > 0 ? getSentimentColorHex(hoveredDot.sentimentScore) : '#6B7280' }}
              >
                {hoveredDot.messageCount > 0 ? getSentimentLabel(hoveredDot.sentimentScore) : 'No Data'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-zinc-400">Score:</span>
              <span className="text-white">
                {hoveredDot.messageCount > 0 ? hoveredDot.sentimentScore.toFixed(2) : '-'}
              </span>
            </div>
            
            {hoveredDot.messageCount === 0 && (
              <div className="text-zinc-500 text-center mt-2 italic">
                No messages this day
              </div>
            )}
          </div>
          
          {/* Tooltip arrow */}
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900"
          >          </div>
        </div>
      )}

      {/* Conversation Modal */}
      <ConversationModal
        isOpen={isConversationModalOpen}
        onClose={() => setIsConversationModalOpen(false)}
        athleteId={athlete.id}
        athleteName={athlete.displayName}
      />

      {/* Coach-Athlete Messaging Modal */}
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

      {/* Athlete Details Modal */}
      <AthleteDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        athleteId={athlete.id}
        athleteName={athlete.displayName}
        onStartMessaging={() => setIsMessagingModalOpen(true)}
      />
    </div>
  );
};

export default AthleteCard;
