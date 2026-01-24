import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaUser, FaCalendar, FaChartLine, FaHeart, FaComments, FaClock, FaLock, FaEyeSlash, FaDumbbell, FaWeight, FaBrain } from 'react-icons/fa';
import { coachService, DailySentimentRecord, ConversationSession } from '../api/firebase/coach/service';
import { coachAthleteMessagingService, CoachAthleteMessage } from '../api/firebase/messaging/coachAthleteService';
import { userService } from '../api/firebase/user/service';
import { privacyService } from '../api/firebase/privacy/service';
import { User } from '../api/firebase/user/types';
import { useUser } from '../hooks/useUser';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../api/firebase/config';
import { WorkoutSummary } from '../api/firebase/workout/types';

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
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);

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
        profileData,
        workoutData
      ] = await Promise.allSettled([
        coachService.getDailySentimentHistory(athleteId, 30, currentUser?.id),
        coachService.getAthleteConversations(athleteId, currentUser?.id),
        userService.fetchUserFromFirestore(athleteId),
        fetchWorkoutSummaries(athleteId)
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

      // Handle workout data
      if (workoutData.status === 'fulfilled') {
        setWorkoutSummaries(workoutData.value);
        console.log(`Loaded ${workoutData.value.length} workout summaries`);
      } else {
        console.error('Error loading workout summaries:', workoutData.reason);
        setWorkoutSummaries([]);
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
      } catch (_error) {
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

  // Fetch workout summaries for athlete
  const fetchWorkoutSummaries = async (userId: string): Promise<WorkoutSummary[]> => {
    try {
      const summariesRef = collection(db, 'users', userId, 'workoutSummary');
      const q = query(summariesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as WorkoutSummary));
    } catch (error) {
      console.error('Error fetching workout summaries:', error);
      return [];
    }
  };

  // Calculate workout frequency (workouts per week)
  const calculateWorkoutFrequency = (): number => {
    if (workoutSummaries.length === 0) return 0;
    
    const completedWorkouts = workoutSummaries.filter(w => w.isCompleted);
    if (completedWorkouts.length === 0) return 0;
    
    const sortedWorkouts = [...completedWorkouts].sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.createdAt).getTime();
      return dateA - dateB;
    });
    
    const firstWorkout = sortedWorkouts[0];
    const lastWorkout = sortedWorkouts[sortedWorkouts.length - 1];
    
    const firstDate = firstWorkout.completedAt ? new Date(firstWorkout.completedAt) : new Date(firstWorkout.createdAt);
    const lastDate = lastWorkout.completedAt ? new Date(lastWorkout.completedAt) : new Date(lastWorkout.createdAt);
    
    const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    const weeks = daysDiff / 7;
    
    return weeks > 0 ? Number((completedWorkouts.length / weeks).toFixed(1)) : completedWorkouts.length;
  };

  // Calculate workouts in last 30 days
  const calculateWorkoutsLast30Days = (): number => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return workoutSummaries.filter(w => {
      if (!w.isCompleted) return false;
      const workoutDate = w.completedAt ? new Date(w.completedAt) : new Date(w.createdAt);
      return workoutDate >= thirtyDaysAgo;
    }).length;
  };

  // Get last weigh-in information
  const getLastWeighIn = () => {
    if (!athleteProfile?.bodyWeight || athleteProfile.bodyWeight.length === 0) {
      return null;
    }
    
    const sortedWeights = [...athleteProfile.bodyWeight].sort((a, b) => {
      const dateA = a.createdAt ? (typeof a.createdAt === 'number' ? a.createdAt * 1000 : new Date(a.createdAt).getTime()) : 0;
      const dateB = b.createdAt ? (typeof b.createdAt === 'number' ? b.createdAt * 1000 : new Date(b.createdAt).getTime()) : 0;
      return dateB - dateA;
    });
    
    return sortedWeights[0];
  };

  // Calculate archetype based on chat sentiment and patterns
  const calculateArchetype = (): { type: string; description: string; confidence: string } => {
    if (sentimentHistory.length === 0 && conversations.length === 0) {
      return {
        type: 'Unknown',
        description: 'Insufficient data to determine archetype',
        confidence: 'Low'
      };
    }

    // Analyze sentiment patterns
    const positiveDays = sentimentHistory.filter(r => r.sentimentScore > 0.3).length;
    const negativeDays = sentimentHistory.filter(r => r.sentimentScore < -0.3).length;
    const neutralDays = sentimentHistory.filter(r => r.sentimentScore >= -0.3 && r.sentimentScore <= 0.3).length;
    
    // Analyze engagement patterns
    const avgMessagesPerDay = totalAIMessages / Math.max(activeDays, 1);
    const avgSessionDuration = totalConversationMinutes / Math.max(totalConversationSessions, 1);
    const workoutFrequency = calculateWorkoutFrequency();
    
    // Calculate sentiment consistency
    const sentimentVariance = sentimentHistory.length > 1
      ? sentimentHistory.reduce((sum, r) => sum + Math.pow(r.sentimentScore - averageSentiment, 2), 0) / sentimentHistory.length
      : 0;
    const isConsistent = sentimentVariance < 0.2;

    // Determine archetype based on patterns
    let archetype = 'Balanced';
    let description = 'Shows balanced engagement across chat and workouts';
    let confidence = 'Medium';

    // High engagement, positive sentiment, consistent workouts
    if (avgMessagesPerDay > 5 && averageSentiment > 0.3 && workoutFrequency > 3 && isConsistent) {
      archetype = 'The Champion';
      description = 'Highly engaged, consistently positive, and maintains regular workout routine. Shows strong commitment and motivation.';
      confidence = 'High';
    }
    // High engagement, variable sentiment, moderate workouts
    else if (avgMessagesPerDay > 3 && sentimentVariance > 0.3 && workoutFrequency > 2) {
      archetype = 'The Grinder';
      description = 'Highly engaged but experiences emotional ups and downs. Maintains workout consistency despite challenges.';
      confidence = 'High';
    }
    // Low engagement, positive sentiment, sporadic workouts
    else if (avgMessagesPerDay < 2 && averageSentiment > 0.2 && workoutFrequency < 2) {
      archetype = 'The Optimist';
      description = 'Generally positive but less engaged in chat. Prefers to work out independently with minimal interaction.';
      confidence = 'Medium';
    }
    // High engagement, negative sentiment, low workouts
    else if (avgMessagesPerDay > 4 && averageSentiment < -0.2 && workoutFrequency < 1.5) {
      archetype = 'The Struggler';
      description = 'Highly engaged in chat but experiencing challenges. May need additional support and motivation.';
      confidence = 'High';
    }
    // Low engagement, neutral sentiment, moderate workouts
    else if (avgMessagesPerDay < 2 && Math.abs(averageSentiment) < 0.2 && workoutFrequency > 2) {
      archetype = 'The Independent';
      description = 'Prefers to work out independently with minimal chat interaction. Self-motivated and consistent.';
      confidence = 'Medium';
    }
    // High engagement, very positive, low workouts
    else if (avgMessagesPerDay > 4 && averageSentiment > 0.5 && workoutFrequency < 1) {
      archetype = 'The Enthusiast';
      description = 'Very engaged in chat and positive, but needs help building consistent workout habits.';
      confidence = 'Medium';
    }
    // Moderate engagement, neutral sentiment, high workouts
    else if (avgMessagesPerDay >= 2 && avgMessagesPerDay <= 4 && Math.abs(averageSentiment) < 0.3 && workoutFrequency > 4) {
      archetype = 'The Athlete';
      description = 'Focused on training with moderate chat engagement. Prioritizes physical performance.';
      confidence = 'High';
    }

    return { type: archetype, description, confidence };
  };

  const archetype = calculateArchetype();
  const workoutFrequency = calculateWorkoutFrequency();
  const workoutsLast30Days = calculateWorkoutsLast30Days();
  const lastWeighIn = getLastWeighIn();
  const totalWeighIns = athleteProfile?.bodyWeight?.length || 0;

  if (!isOpen) return null;

  // Use portal to render modal outside of any transformed parent (like AthleteCard with Framer Motion)
  // This prevents the modal from being affected by parent CSS transforms that break fixed positioning
  const modalContent = (
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

              {/* Workout & Weigh-in Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <FaDumbbell className="text-[#E0FE10] text-xl" />
                    <div>
                      <p className="text-2xl font-bold text-white">{workoutSummaries.filter(w => w.isCompleted).length}</p>
                      <p className="text-sm text-zinc-400">Total Workouts</p>
                      <p className="text-xs text-zinc-500">
                        {workoutsLast30Days} in last 30 days
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <FaDumbbell className="text-[#E0FE10] text-xl" />
                    <div>
                      <p className="text-2xl font-bold text-white">{workoutFrequency.toFixed(1)}</p>
                      <p className="text-sm text-zinc-400">Workouts/Week</p>
                      <p className="text-xs text-zinc-500">
                        {workoutFrequency >= 4 ? 'Very Active' : workoutFrequency >= 2 ? 'Active' : workoutFrequency >= 1 ? 'Moderate' : 'Low'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <FaWeight className="text-[#E0FE10] text-xl" />
                    <div>
                      <p className="text-2xl font-bold text-white">{totalWeighIns}</p>
                      <p className="text-sm text-zinc-400">Total Weigh-ins</p>
                      <p className="text-xs text-zinc-500">
                        {lastWeighIn 
                          ? `Last: ${formatDate(new Date(lastWeighIn.createdAt * 1000))}`
                          : 'No weigh-ins yet'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <FaWeight className="text-[#E0FE10] text-xl" />
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {lastWeighIn ? `${lastWeighIn.newWeight.toFixed(1)}` : 'N/A'}
                      </p>
                      <p className="text-sm text-zinc-400">Current Weight</p>
                      <p className="text-xs text-zinc-500">
                        {lastWeighIn && athleteProfile?.bodyWeight && athleteProfile.bodyWeight.length > 1
                          ? (() => {
                              const sorted = [...athleteProfile.bodyWeight].sort((a, b) => {
                                const dateA = a.createdAt ? (typeof a.createdAt === 'number' ? a.createdAt * 1000 : new Date(a.createdAt).getTime()) : 0;
                                const dateB = b.createdAt ? (typeof b.createdAt === 'number' ? b.createdAt * 1000 : new Date(b.createdAt).getTime()) : 0;
                                return dateB - dateA;
                              });
                              const previous = sorted[1];
                              const change = lastWeighIn.newWeight - previous.newWeight;
                              return change > 0 ? `+${change.toFixed(1)} lbs` : `${change.toFixed(1)} lbs`;
                            })()
                          : 'No change data'}
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
                  
                  <div className="space-y-4">
                    {/* Archetype Section */}
                    <div className="bg-zinc-900 rounded-lg p-4 border border-[#E0FE10]/20">
                      <div className="flex items-start space-x-3">
                        <FaBrain className="text-[#E0FE10] text-xl mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-zinc-400 text-sm">Archetype:</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              archetype.confidence === 'High' ? 'bg-green-500/20 text-green-400' :
                              archetype.confidence === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-zinc-500/20 text-zinc-400'
                            }`}>
                              {archetype.confidence} Confidence
                            </span>
                          </div>
                          <p className="text-lg font-semibold text-white mb-1">{archetype.type}</p>
                          <p className="text-sm text-zinc-300">{archetype.description}</p>
                        </div>
                      </div>
                    </div>

                    {/* Other Profile Info */}
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
                          <span className="text-zinc-400">Latest Weight:</span>
                          <span className="text-white ml-2">{athleteProfile.bodyWeight[athleteProfile.bodyWeight.length - 1].newWeight} lbs</span>
                        </div>
                      )}

                      {athleteProfile.sport && (
                        <div>
                          <span className="text-zinc-400">Sport:</span>
                          <span className="text-white ml-2">{athleteProfile.sport}</span>
                        </div>
                      )}

                      {athleteProfile.mentalPerformanceGoals && athleteProfile.mentalPerformanceGoals.length > 0 && (
                        <div>
                          <span className="text-zinc-400">Mental Goals:</span>
                          <span className="text-white ml-2">{athleteProfile.mentalPerformanceGoals.join(', ')}</span>
                        </div>
                      )}
                    </div>
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
                      {conversations.slice(0, 5).map((session) => {
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

  // Render to document.body via portal to escape any transformed parent containers
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  
  return modalContent;
};

export default AthleteDetailsModal;
