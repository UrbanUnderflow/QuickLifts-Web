import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import debounce from 'lodash.debounce';
import { 
  Activity, 
  Clock, 
  Calendar, 
  Dumbbell, 
  Eye, 
  Search,
  RefreshCw,
  User,
  Trophy,
  Target,
  Zap
} from 'lucide-react';
import { WorkoutSummary } from '../../api/firebase/workout/types';
import { convertFirestoreTimestamp } from '../../utils/formatDate';

// Define interface for display data
interface WorkoutSummaryDisplay {
  id: string;
  userId: string;
  username?: string;
  workoutTitle: string;
  workoutId: string;
  roundWorkoutId?: string;
  duration: number;
  caloriesBurned: number;
  isCompleted: boolean;
  startTime: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  pulsePoints?: {
    totalPoints: number;
    workoutBonus?: number;
    consistencyBonus?: number;
    peerChallengeBonus?: number;
    referralBonus?: number;
  };
  exercisesCompleted?: any[];
  bodyParts?: string[];
  workoutRating?: string;
  aiInsight?: string;
  recommendations?: string[];
}

const WorkoutSummariesManagement: React.FC = () => {
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummaryDisplay[]>([]);
  const [filteredSummaries, setFilteredSummaries] = useState<WorkoutSummaryDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSummary, setSelectedSummary] = useState<WorkoutSummaryDisplay | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((term: string) => {
      if (!term.trim()) {
        setFilteredSummaries(workoutSummaries);
        return;
      }

      const filtered = workoutSummaries.filter(summary => 
        summary.username?.toLowerCase().includes(term.toLowerCase()) ||
        summary.workoutTitle?.toLowerCase().includes(term.toLowerCase()) ||
        summary.userId?.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredSummaries(filtered);
    }, 300),
    [workoutSummaries]
  );

  // Effect for search
  useEffect(() => {
    debouncedSearch(searchTerm);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchTerm, debouncedSearch]);

  // Load all workout summaries from root collection
  const loadAllWorkoutSummaries = async () => {
    try {
      setLoading(true);
      const summariesRef = collection(db, 'workout-summaries');
      const q = query(summariesRef, orderBy('createdAt', 'desc'));

      const snapshot = await getDocs(q);
      
      // Get unique user IDs to fetch usernames
      const userIds = new Set<string>();
      snapshot.docs.forEach(doc => {
        const userId = doc.data().userId;
        if (userId) userIds.add(userId);
      });

      // Fetch usernames for all unique user IDs
      const usernameMap = new Map<string, string>();
      if (userIds.size > 0) {
        const userPromises = Array.from(userIds).map(async (userId) => {
          try {
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              usernameMap.set(userId, userData.username || userData.displayName || 'Unknown User');
            } else {
              usernameMap.set(userId, 'Unknown User');
            }
          } catch (error) {
            console.warn(`Failed to fetch username for user ${userId}:`, error);
            usernameMap.set(userId, 'Unknown User');
          }
        });
        await Promise.all(userPromises);
      }
      
      const summaries = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Convert timestamps properly
        const summary: WorkoutSummaryDisplay = {
          id: doc.id,
          userId: data.userId || '',
          username: usernameMap.get(data.userId) || data.username || 'Unknown User',
          workoutTitle: data.workoutTitle || 'Untitled Workout',
          workoutId: data.workoutId || '',
          roundWorkoutId: data.roundWorkoutId || '',
          duration: data.duration || 0,
          caloriesBurned: data.caloriesBurned || 0,
          isCompleted: data.isCompleted || false,
          startTime: convertFirestoreTimestamp(data.startTime),
          createdAt: convertFirestoreTimestamp(data.createdAt),
          updatedAt: convertFirestoreTimestamp(data.updatedAt),
          completedAt: data.completedAt ? convertFirestoreTimestamp(data.completedAt) : null,
          pulsePoints: data.pulsePoints || { totalPoints: 0 },
          exercisesCompleted: data.exercisesCompleted || [],
          bodyParts: data.bodyParts || [],
          workoutRating: data.workoutRating || '',
          aiInsight: data.aiInsight || '',
          recommendations: data.recommendations || []
        };
        
        return summary;
      });

      setWorkoutSummaries(summaries);
      setFilteredSummaries(summaries);
      setLoading(false);
    } catch (error) {
      console.error('Error loading workout summaries:', error);
      setToastMessage({ type: 'error', text: 'Error loading workout summaries' });
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadAllWorkoutSummaries();
  }, []);

  // Format date helper
  const formatDate = (date: Date): string => {
    if (!date || !(date instanceof Date)) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format duration helper
  const formatDuration = (durationInMinutes: number): string => {
    if (durationInMinutes < 60) {
      return `${durationInMinutes}m`;
    }
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  // Handle refresh
  const handleRefresh = () => {
    loadAllWorkoutSummaries();
  };

  // Render workout summary details
  const renderSummaryDetails = (summary: WorkoutSummaryDisplay) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1e24] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-zinc-700">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{summary.workoutTitle}</h3>
                <p className="text-gray-400">User: {summary.username} ({summary.userId})</p>
              </div>
              <button
                onClick={() => setSelectedSummary(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Duration</span>
                </div>
                <p className="text-white font-semibold">{formatDuration(summary.duration)}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-400">Calories</span>
                </div>
                <p className="text-white font-semibold">{summary.caloriesBurned}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">Pulse Points</span>
                </div>
                <p className="text-white font-semibold">{summary.pulsePoints?.totalPoints || 0}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-400">Exercises</span>
                </div>
                <p className="text-white font-semibold">{summary.exercisesCompleted?.length || 0}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm text-gray-400">Completed</span>
                </div>
                <p className="text-white font-semibold">
                  {summary.completedAt ? formatDate(summary.completedAt) : 'Not completed'}
                </p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-gray-400">Status</span>
                </div>
                <p className={`font-semibold ${summary.isCompleted ? 'text-green-400' : 'text-yellow-400'}`}>
                  {summary.isCompleted ? 'Completed' : 'In Progress'}
                </p>
              </div>
            </div>

            {/* Pulse Points Breakdown */}
            {summary.pulsePoints && (
              <div className="bg-[#262a30] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">Pulse Points Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Workout Bonus</p>
                    <p className="text-white">{summary.pulsePoints.workoutBonus || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Consistency</p>
                    <p className="text-white">{summary.pulsePoints.consistencyBonus || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Peer Challenge</p>
                    <p className="text-white">{summary.pulsePoints.peerChallengeBonus || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Referral</p>
                    <p className="text-white">{summary.pulsePoints.referralBonus || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Body Parts */}
            {summary.bodyParts && summary.bodyParts.length > 0 && (
              <div className="bg-[#262a30] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">Body Parts Targeted</h4>
                <div className="flex flex-wrap gap-2">
                  {summary.bodyParts.map((bodyPart, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
                    >
                      {bodyPart}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insight */}
            {summary.aiInsight && (
              <div className="bg-[#262a30] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">AI Insight</h4>
                <p className="text-gray-300">{summary.aiInsight}</p>
              </div>
            )}

            {/* Recommendations */}
            {summary.recommendations && summary.recommendations.length > 0 && (
              <div className="bg-[#262a30] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">Recommendations</h4>
                <ul className="space-y-2">
                  {summary.recommendations.map((rec, index) => (
                    <li key={index} className="text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Workout IDs */}
            <div className="bg-[#262a30] rounded-lg p-4">
              <h4 className="text-white font-semibold mb-3">Workout IDs</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Summary ID:</span>
                  <span className="text-white ml-2 font-mono">{summary.id}</span>
                </div>
                <div>
                  <span className="text-gray-400">Workout ID:</span>
                  <span className="text-white ml-2 font-mono">{summary.workoutId}</span>
                </div>
                {summary.roundWorkoutId && (
                  <div>
                    <span className="text-gray-400">Round Workout ID:</span>
                    <span className="text-white ml-2 font-mono">{summary.roundWorkoutId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-[#0f1419] text-white">
        <Head>
          <title>Workout Summaries Management - Pulse Admin</title>
          <meta name="description" content="Manage workout summaries" />
        </Head>

        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Workout Summaries Management</h1>
            <p className="text-gray-400">View and search all workout summaries from the root collection</p>
          </div>

          {/* Controls */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by username, workout title, or user ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{filteredSummaries.length}</p>
                  <p className="text-sm text-gray-400">Total Summaries</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {filteredSummaries.filter(s => s.isCompleted).length}
                  </p>
                  <p className="text-sm text-gray-400">Completed</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {new Set(filteredSummaries.map(s => s.userId)).size}
                  </p>
                  <p className="text-sm text-gray-400">Unique Users</p>
                </div>
              </div>
            </div>
          </div>

          {/* Workout Summaries Table */}
          <div className="bg-[#1a1e24] rounded-lg border border-zinc-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#262a30] border-b border-zinc-700">
                  <tr>
                    <th className="text-left p-4 text-gray-300 font-medium">User</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Workout</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Duration</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Points</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Completed</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Loading workout summaries...
                        </div>
                      </td>
                    </tr>
                  ) : filteredSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        No workout summaries found
                      </td>
                    </tr>
                  ) : (
                    filteredSummaries.map((summary) => (
                      <tr key={summary.id} className="border-b border-zinc-700 hover:bg-[#262a30] transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="text-white font-medium">{summary.username}</p>
                            <p className="text-xs text-gray-400 font-mono">{summary.userId}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="text-white">{summary.workoutTitle}</p>
                            <p className="text-xs text-gray-400">{summary.exercisesCompleted?.length || 0} exercises</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-white">{formatDuration(summary.duration)}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-green-400 font-semibold">
                            {summary.pulsePoints?.totalPoints || 0}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            summary.isCompleted 
                              ? 'bg-green-500/20 text-green-300' 
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {summary.isCompleted ? 'Completed' : 'In Progress'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-300 text-sm">
                            {summary.completedAt ? formatDate(summary.completedAt) : 'Not completed'}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => setSelectedSummary(summary)}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Summary Details Modal */}
        {selectedSummary && renderSummaryDetails(selectedSummary)}

        {/* Toast Message */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className={`px-4 py-2 rounded-lg text-white ${
              toastMessage.type === 'success' ? 'bg-green-600' :
              toastMessage.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
            }`}>
              {toastMessage.text}
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
};

export default WorkoutSummariesManagement; 