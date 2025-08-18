import React, { useState, useEffect } from 'react';
import { FaTimes, FaUser, FaCalendar, FaChartLine, FaHeart, FaComments, FaDumbbell, FaFire, FaClock, FaLock, FaEyeSlash } from 'react-icons/fa';
import { coachService, DailySentimentRecord, ConversationSession } from '../api/firebase/coach/service';
import { coachAthleteMessagingService, CoachAthleteMessage } from '../api/firebase/messaging/coachAthleteService';
import { userService } from '../api/firebase/user/service';
import { privacyService } from '../api/firebase/privacy/service';
import { User } from '../api/firebase/user/types';
import { useUser } from '../hooks/useUser';

interface AthleteDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
  athleteName: string;
  onStartMessaging?: () => void;
}

const AthleteDetailsModal: React.FC<AthleteDetailsModalProps> = ({
  isOpen,
  onClose,
  athleteId,
  athleteName,
  onStartMessaging
}) => {
  const currentUser = useUser();
  const [sentimentHistory, setSentimentHistory] = useState<DailySentimentRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [coachAthleteMessages, setCoachAthleteMessages] = useState<CoachAthleteMessage[]>([]);
  const [athleteProfile, setAthleteProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<any>(null);

  useEffect(() => {
    if (isOpen && athleteId) {
      loadAthleteDetails();
    }
  }, [isOpen, athleteId]);

  const loadAthleteDetails = async () => {
    try {
      setLoading(true);
      console.log(`Loading comprehensive data for athlete: ${athleteId}`);
      
      // Load privacy settings first
      const privacy = await privacyService.getAthletePrivacySettings(athleteId);
      setPrivacySettings(privacy);
      
      // Load data in parallel for better performance
      const [
        sentimentData,
        conversationData,
        profileData
      ] = await Promise.allSettled([
        coachService.getDailySentimentHistory(athleteId, 30, currentUser?.id),
        coachService.getAthleteConversations(athleteId, currentUser?.id),
        userService.fetchUserFromFirestore(athleteId)
      ]);

      // Handle sentiment history
      if (sentimentData.status === 'fulfilled') {
        setSentimentHistory(sentimentData.value);
        console.log(`Loaded ${sentimentData.value.length} sentiment records`);
      } else {
        console.error('Error loading sentiment history:', sentimentData.reason);
        setSentimentHistory([]);
      }

      // Handle conversation data
      if (conversationData.status === 'fulfilled') {
        setConversations(conversationData.value);
        console.log(`Loaded ${conversationData.value.length} conversation sessions`);
      } else {
        console.error('Error loading conversations:', conversationData.reason);
        setConversations([]);
      }

      // Handle profile data
      if (profileData.status === 'fulfilled') {
        setAthleteProfile(profileData.value);
        console.log(`Loaded athlete profile:`, profileData.value?.displayName);
      } else {
        console.error('Error loading athlete profile:', profileData.reason);
        setAthleteProfile(null);
      }

      // Try to load coach-athlete messages if available
      try {
        // This might not exist yet if no direct messages have been sent
        const coachAthleteConversations = await coachAthleteMessagingService.getConversationsForUser(athleteId, 'athlete');
        if (coachAthleteConversations.length > 0) {
          const messages = await coachAthleteMessagingService.getMessages(coachAthleteConversations[0].id);
          setCoachAthleteMessages(messages);
          console.log(`Loaded ${messages.length} coach-athlete messages`);
        }
      } catch (error) {
        console.log('No coach-athlete messages found (this is normal for new connections)');
        setCoachAthleteMessages([]);
      }

    } catch (error) {
      console.error('Error loading athlete details:', error);
      setSentimentHistory([]);
      setConversations([]);
      setAthleteProfile(null);
      setCoachAthleteMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (score: number): string => {
    if (score >= 0.5) return 'text-green-400';
    if (score >= 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSentimentLabel = (score: number): string => {
    if (score >= 0.7) return 'Very Positive';
    if (score >= 0.3) return 'Positive';
    if (score >= -0.3) return 'Neutral';
    if (score >= -0.7) return 'Negative';
    return 'Very Negative';
  };

  const formatDate = (date: Date | string): string => {
    // Handle both Date objects and date strings (YYYY-MM-DD format)
    let dateObj: Date;
    
    if (typeof date === 'string') {
      // If it's a string, parse it as YYYY-MM-DD
      dateObj = new Date(date + 'T00:00:00'); // Add time to avoid timezone issues
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      // Try to create a Date object from whatever we received
      dateObj = new Date(date);
    }
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const averageSentiment = sentimentHistory.length > 0 
    ? sentimentHistory.reduce((sum, record) => sum + record.sentimentScore, 0) / sentimentHistory.length
    : 0;

  // Calculate comprehensive statistics
  const totalAIMessages = sentimentHistory.reduce((sum, record) => sum + record.messageCount, 0);
  const totalCoachMessages = coachAthleteMessages.length;
  const totalAllMessages = totalAIMessages + totalCoachMessages;
  
  const activeDays = sentimentHistory.filter(record => record.messageCount > 0).length;
  const totalConversationSessions = conversations.length;
  
  // Calculate total conversation time
  const totalConversationMinutes = conversations.reduce((total, session) => {
    const duration = session.endTime.getTime() - session.startTime.getTime();
    return total + Math.floor(duration / (1000 * 60));
  }, 0);

  // Get last active date
  const lastActiveDate = athleteProfile?.updatedAt || 
    (sentimentHistory.length > 0 ? new Date(sentimentHistory[0].date) : null) ||
    (conversations.length > 0 ? conversations[0].endTime : null);

  // Calculate streak (consecutive days with activity)
  const calculateStreak = () => {
    if (sentimentHistory.length === 0) return 0;
    
    let streak = 0;
    const sortedHistory = [...sentimentHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    for (const record of sortedHistory) {
      if (record.messageCount > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const currentStreak = calculateStreak();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-[#E0FE10] rounded-full flex items-center justify-center">
              <FaUser className="text-black text-lg" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {athleteProfile?.displayName || athleteName}
              </h2>
              <div className="flex items-center space-x-4 text-sm text-zinc-400">
                <span>@{athleteProfile?.username || 'username'}</span>
                {athleteProfile?.email && (
                  <span>{athleteProfile.email}</span>
                )}
                {lastActiveDate && (
                  <span>Last active: {formatDate(lastActiveDate)}</span>
                )}
              </div>
              {athleteProfile?.bio && (
                <p className="text-sm text-zinc-300 mt-1 max-w-md">
                  {athleteProfile.bio}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-2"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E0FE10]"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <FaComments className="text-[#E0FE10] text-xl" />
                    <div>
                      <p className="text-2xl font-bold text-white">{totalAllMessages}</p>
                      <p className="text-sm text-zinc-400">Total Messages</p>
                      <p className="text-xs text-zinc-500">
                        {totalAIMessages} AI • {totalCoachMessages} Coach
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <FaCalendar className="text-[#E0FE10] text-xl" />
                    <div>
                      <p className="text-2xl font-bold text-white">{activeDays}</p>
                      <p className="text-sm text-zinc-400">Active Days (30d)</p>
                      <p className="text-xs text-zinc-500">
                        {currentStreak} day streak
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <FaClock className="text-[#E0FE10] text-xl" />
                    <div>
                      <p className="text-2xl font-bold text-white">{totalConversationSessions}</p>
                      <p className="text-sm text-zinc-400">Chat Sessions</p>
                      <p className="text-xs text-zinc-500">
                        {Math.floor(totalConversationMinutes / 60)}h {totalConversationMinutes % 60}m total
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <FaHeart className="text-[#E0FE10] text-xl" />
                    <div>
                      <p className={`text-2xl font-bold ${getSentimentColor(averageSentiment)}`}>
                        {getSentimentLabel(averageSentiment)}
                      </p>
                      <p className="text-sm text-zinc-400">Avg Sentiment</p>
                      <p className="text-xs text-zinc-500">
                        Score: {averageSentiment.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Profile Info */}
              {athleteProfile && (
                <div className="bg-zinc-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                    <FaUser className="text-[#E0FE10]" />
                    <span>Profile Information</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    {athleteProfile.subscriptionType && (
                      <div>
                        <span className="text-zinc-400">Subscription:</span>
                        <span className="text-white ml-2 capitalize">{athleteProfile.subscriptionType}</span>
                      </div>
                    )}
                    
                    {athleteProfile.level && (
                      <div>
                        <span className="text-zinc-400">Level:</span>
                        <span className="text-white ml-2">{athleteProfile.level}</span>
                      </div>
                    )}
                    
                    {athleteProfile.goal && athleteProfile.goal.length > 0 && (
                      <div>
                        <span className="text-zinc-400">Goals:</span>
                        <span className="text-white ml-2">{athleteProfile.goal.join(', ')}</span>
                      </div>
                    )}
                    
                    {athleteProfile.homeGym && (
                      <div>
                        <span className="text-zinc-400">Home Gym:</span>
                        <span className="text-white ml-2">{athleteProfile.homeGym.name}</span>
                      </div>
                    )}
                    
                    {athleteProfile.height && (
                      <div>
                        <span className="text-zinc-400">Height:</span>
                        <span className="text-white ml-2">{athleteProfile.height.feet}'{athleteProfile.height.inches}"</span>
                      </div>
                    )}
                    
                    {athleteProfile.bodyWeight && athleteProfile.bodyWeight.length > 0 && (
                      <div>
                        <span className="text-zinc-400">Weight:</span>
                        <span className="text-white ml-2">{athleteProfile.bodyWeight[athleteProfile.bodyWeight.length - 1].newWeight} lbs</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sentiment Chart */}
              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FaChartLine className="text-[#E0FE10]" />
                    <span>30-Day Sentiment Trend</span>
                  </div>
                  {privacySettings && !privacySettings.shareSentimentWithCoach && (
                    <div className="flex items-center space-x-1 text-zinc-400 bg-zinc-700 px-2 py-1 rounded">
                      <FaLock className="text-xs" />
                      <span className="text-xs">Private</span>
                    </div>
                  )}
                </h3>
                
                {sentimentHistory.length > 0 ? (
                  <div className="space-y-4">
                    {/* Chart visualization */}
                    <div className="h-32 flex items-end space-x-1 bg-zinc-900 rounded p-4">
                      {sentimentHistory.slice(-14).map((record, index) => (
                        <div
                          key={index}
                          className="flex-1 flex flex-col items-center space-y-1"
                        >
                          <div
                            className={`w-full rounded-t ${
                              record.messageCount > 0 
                                ? getSentimentColor(record.sentimentScore).replace('text-', 'bg-')
                                : 'bg-zinc-700'
                            }`}
                            style={{
                              height: record.messageCount > 0 
                                ? `${Math.max(10, (record.sentimentScore + 1) * 50)}%`
                                : '10%'
                            }}
                          />
                          <span className="text-xs text-zinc-500 transform rotate-45 origin-left">
                            {formatDate(record.date)}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Legend */}
                    <div className="flex items-center justify-center space-x-6 text-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-400 rounded"></div>
                        <span className="text-zinc-400">Positive</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                        <span className="text-zinc-400">Neutral</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-400 rounded"></div>
                        <span className="text-zinc-400">Negative</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-zinc-700 rounded"></div>
                        <span className="text-zinc-400">No Data</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500">
                    <FaChartLine className="text-4xl mx-auto mb-4 opacity-50" />
                    <p>
                      {privacySettings && !privacySettings.shareSentimentWithCoach 
                        ? "Sentiment data is private" 
                        : "No sentiment data available"
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                
                {sentimentHistory.slice(-7).reverse().map((record, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-zinc-700 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        record.messageCount > 0 
                          ? getSentimentColor(record.sentimentScore).replace('text-', 'bg-')
                          : 'bg-zinc-600'
                      }`} />
                      <span className="text-white">{formatDate(record.date)}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-zinc-400">{record.messageCount} messages</span>
                      <span className={record.messageCount > 0 ? getSentimentColor(record.sentimentScore) : 'text-zinc-500'}>
                        {record.messageCount > 0 ? getSentimentLabel(record.sentimentScore) : 'No activity'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Conversation Sessions */}
              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FaComments className="text-[#E0FE10]" />
                    <span>Recent Chat Sessions</span>
                  </div>
                  {privacySettings && !privacySettings.shareConversationsWithCoach && (
                    <div className="flex items-center space-x-1 text-zinc-400 bg-zinc-700 px-2 py-1 rounded">
                      <FaEyeSlash className="text-xs" />
                      <span className="text-xs">Private</span>
                    </div>
                  )}
                </h3>
                
                {conversations.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {conversations.slice(0, 5).map((session, index) => {
                        const duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60));
                        return (
                          <div key={session.id} className="flex items-center justify-between py-3 border-b border-zinc-700 last:border-b-0">
                            <div className="flex items-center space-x-3">
                              <div className="w-3 h-3 rounded-full bg-[#E0FE10]" />
                              <div>
                                <span className="text-white">{formatDate(session.startTime)}</span>
                                <span className="text-zinc-400 text-sm ml-2">
                                  {session.startTime.toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit', 
                                    hour12: true 
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm">
                              <span className="text-zinc-400">{session.messages.length} messages</span>
                              <span className="text-zinc-400">{duration} min</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {conversations.length > 5 && (
                      <div className="text-center mt-4">
                        <span className="text-zinc-500 text-sm">
                          +{conversations.length - 5} more sessions
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-zinc-500">
                    <FaComments className="text-4xl mx-auto mb-4 opacity-50" />
                    <p>
                      {privacySettings && !privacySettings.shareConversationsWithCoach 
                        ? "Conversations are private" 
                        : "No conversation sessions available"
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Close
          </button>
          {onStartMessaging && (
            <button
              onClick={() => {
                onStartMessaging();
                onClose();
              }}
              className="px-6 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-lime-400 transition-colors flex items-center space-x-2"
            >
              <FaComments className="text-sm" />
              <span>Start Messaging</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AthleteDetailsModal;
