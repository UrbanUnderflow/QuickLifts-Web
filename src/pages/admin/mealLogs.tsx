import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import debounce from 'lodash.debounce';
import { 
  Clock, 
  Calendar, 
  Eye, 
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Image as ImageIcon,
  Utensils,
  User,
  RotateCcw as Sync,
  Database,
  Zap,
  BarChart2,
  Copy,
  Check,
  MessageSquare
} from 'lucide-react';
import { convertFirestoreTimestamp } from '../../utils/formatDate';
import { MealData } from '../../api/firebase/meal/types';

// Define interface for meal log data from root collection
interface MealLogEntry {
  id: string;
  userId: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  ingredients: string[];
  image?: string;
  entryMethod?: string;
  createdAt: Date;
  updatedAt: Date;
  // User info (fetched separately)
  userDisplayName?: string;
  userEmail?: string;
}

const MealLogsManagement: React.FC = () => {
  const [mealLogs, setMealLogs] = useState<MealLogEntry[]>([]);
  const [filteredMealLogs, setFilteredMealLogs] = useState<MealLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMealLog, setSelectedMealLog] = useState<MealLogEntry | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((term: string) => {
      if (!term.trim()) {
        setFilteredMealLogs(mealLogs);
        return;
      }

      const filtered = mealLogs.filter(meal => 
        (meal.name && meal.name.toLowerCase().includes(term.toLowerCase())) ||
        (meal.userId && meal.userId.toLowerCase().includes(term.toLowerCase())) ||
        (meal.userDisplayName && meal.userDisplayName.toLowerCase().includes(term.toLowerCase())) ||
        (meal.userEmail && meal.userEmail.toLowerCase().includes(term.toLowerCase())) ||
        (meal.entryMethod && meal.entryMethod.toLowerCase().includes(term.toLowerCase()))
      );
      setFilteredMealLogs(filtered);
    }, 300),
    [mealLogs]
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    loadAllMealLogs();
  }, []);

  const loadAllMealLogs = async () => {
    setLoading(true);
    try {
      console.log('[MealLogs] Loading meal logs from root collection...');
      
      // Fetch from root collection 'meals-logged'
      const mealsRef = collection(db, 'meals-logged');
      const q = query(mealsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      console.log(`[MealLogs] Found ${snapshot.docs.length} meal logs`);

      const mealLogsData: MealLogEntry[] = [];
      const userCache = new Map<string, { displayName: string; email: string }>();

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data() as MealData;
        
        // Fetch user info if not cached
        let userInfo = { displayName: 'Unknown User', email: '' };
        if (data.userId && !userCache.has(data.userId)) {
          try {
            const userRef = doc(db, 'users', data.userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              userInfo = {
                displayName: userData.displayName || userData.username || 'Unknown User',
                email: userData.email || ''
              };
              userCache.set(data.userId, userInfo);
            }
          } catch (error) {
            console.warn(`[MealLogs] Could not fetch user info for ${data.userId}:`, error);
          }
        } else if (data.userId) {
          userInfo = userCache.get(data.userId) || userInfo;
        }

        const mealLog: MealLogEntry = {
          id: docSnapshot.id,
          userId: data.userId || '',
          name: data.name || '',
          calories: data.calories || 0,
          protein: data.protein || 0,
          fat: data.fat || 0,
          carbs: data.carbs || 0,
          ingredients: data.ingredients || [],
          image: data.image,
          entryMethod: data.entryMethod,
          createdAt: convertFirestoreTimestamp(data.createdAt),
          updatedAt: convertFirestoreTimestamp(data.updatedAt),
          userDisplayName: userInfo.displayName,
          userEmail: userInfo.email
        };

        mealLogsData.push(mealLog);
      }

      console.log(`[MealLogs] Processed ${mealLogsData.length} meal logs with user info`);

      setMealLogs(mealLogsData);
      setFilteredMealLogs(mealLogsData);
      setLoading(false);
      
    } catch (error) {
      console.error('[MealLogs] Error loading meal logs:', error);
      setToastMessage({ type: 'error', text: `Error loading meal logs: ${(error as Error).message}` });
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncLoading(true);
    try {
      console.log('[MealLogs] Starting manual sync via Netlify function...');
      
      // Call Netlify function instead of Firebase Cloud Function
      const response = await fetch('/.netlify/functions/manual-sync-meal-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // Empty body, function doesn't need parameters
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('[MealLogs] Manual sync result:', data);
      
      if (data.success) {
        setToastMessage({ 
          type: 'success', 
          text: `Sync completed! ${data.mealsSynced} new meals synced, ${data.mealsSkipped} existing meals skipped from ${data.usersProcessed} users.` 
        });
        // Reload the data to show newly synced meals
        await loadAllMealLogs();
      } else {
        setToastMessage({ type: 'error', text: data.error || 'Sync failed. Check console for details.' });
      }
    } catch (error) {
      console.error('[MealLogs] Manual sync error:', error);
      setToastMessage({ 
        type: 'error', 
        text: `Sync failed: ${(error as Error).message}` 
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleRefresh = () => {
    loadAllMealLogs();
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatMacros = (protein: number, carbs: number, fat: number): string => {
    return `P: ${protein}g | C: ${carbs}g | F: ${fat}g`;
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setToastMessage({ type: 'error', text: 'Failed to copy to clipboard' });
    }
  };

  // Render meal log details modal
  const renderMealLogDetails = (mealLog: MealLogEntry) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1e24] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Utensils className="w-6 h-6 text-[#d7ff00]" />
                Meal Log Details
              </h2>
              <button
                onClick={() => setSelectedMealLog(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Utensils className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Meal Name</span>
                </div>
                <p className="text-white font-semibold">{mealLog.name || 'Unnamed Meal'}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">User</span>
                </div>
                <p className="text-white font-semibold">{mealLog.userDisplayName}</p>
                <p className="text-gray-400 text-sm">{mealLog.userEmail}</p>
                <p className="text-gray-500 text-xs font-mono">{mealLog.userId}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-gray-400">Calories</span>
                </div>
                <p className="text-white font-semibold text-2xl">{mealLog.calories}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-400">Entry Method</span>
                </div>
                <p className="text-white font-semibold capitalize">{mealLog.entryMethod || 'Unknown'}</p>
              </div>
            </div>

            {/* Macros */}
            <div className="bg-[#262a30] rounded-lg p-4 mb-6">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4" />
                Macronutrients
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-400">{mealLog.protein}g</p>
                  <p className="text-sm text-gray-400">Protein</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{mealLog.carbs}g</p>
                  <p className="text-sm text-gray-400">Carbs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">{mealLog.fat}g</p>
                  <p className="text-sm text-gray-400">Fat</p>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">Created At</span>
                </div>
                <p className="text-white font-semibold">{formatDate(mealLog.createdAt)}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-400">Updated At</span>
                </div>
                <p className="text-white font-semibold">{formatDate(mealLog.updatedAt)}</p>
              </div>
            </div>

            {/* Ingredients */}
            {mealLog.ingredients && mealLog.ingredients.length > 0 && (
              <div className="bg-[#262a30] rounded-lg p-4 mb-6">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Ingredients ({mealLog.ingredients.length})
                </h4>
                <div className="space-y-2">
                  {mealLog.ingredients.map((ingredient, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#d7ff00] rounded-full flex-shrink-0"></div>
                      <span className="text-gray-300">{ingredient}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Image */}
            {mealLog.image && (
              <div className="bg-[#262a30] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Meal Image
                </h4>
                <div className="flex justify-center">
                  <img 
                    src={mealLog.image} 
                    alt="Meal" 
                    className="max-w-full max-h-96 rounded-lg object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Meal Logs Management - Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
            <Utensils className="w-8 h-8 text-[#d7ff00]" />
            Meal Logs Management
          </h1>

          {/* Controls */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by meal name, user, or entry method..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleManualSync}
                disabled={syncLoading}
                className="flex items-center gap-2 px-4 py-2 bg-[#d7ff00] hover:bg-[#c5e600] disabled:bg-[#8a9900] text-black rounded-lg transition-colors font-medium"
              >
                <Sync className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
                {syncLoading ? 'Syncing...' : 'Manual Sync'}
              </button>
              
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Utensils className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{filteredMealLogs.length}</p>
                  <p className="text-sm text-gray-400">Total Meals</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {filteredMealLogs.filter(m => m.image).length}
                  </p>
                  <p className="text-sm text-gray-400">With Images</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {Math.round(filteredMealLogs.reduce((sum, m) => sum + m.calories, 0) / filteredMealLogs.length) || 0}
                  </p>
                  <p className="text-sm text-gray-400">Avg Calories</p>
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
                    {new Set(filteredMealLogs.map(m => m.userId)).size}
                  </p>
                  <p className="text-sm text-gray-400">Unique Users</p>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#1a1e24] rounded-lg border border-zinc-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#262a30]">
                  <tr>
                    <th className="text-left p-4 text-gray-300 font-medium">ID</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Meal Name</th>
                    <th className="text-left p-4 text-gray-300 font-medium">User</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Calories</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Macros</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Entry Method</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Created</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Image</th>
                    <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading meal logs...
                      </td>
                    </tr>
                  ) : filteredMealLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        No meal logs found
                      </td>
                    </tr>
                  ) : (
                    filteredMealLogs.map((mealLog) => (
                      <tr key={mealLog.id} className="border-b border-zinc-700 hover:bg-[#262a30] transition-colors">
                        <td className="p-4">
                          <button
                            onClick={() => copyToClipboard(mealLog.id, mealLog.id)}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                            title="Click to copy ID"
                          >
                            <span className="font-mono text-sm truncate max-w-[120px]">
                              {mealLog.id}
                            </span>
                            {copiedId === mealLog.id ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </button>
                        </td>
                        <td className="p-4">
                          <span className="text-white font-medium">{mealLog.name || 'Unnamed Meal'}</span>
                        </td>
                        <td className="p-4">
                          <div>
                            <span className="text-white">{mealLog.userDisplayName}</span>
                            <br />
                            <span className="text-gray-400 text-sm">{mealLog.userEmail}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-orange-400 font-semibold">{mealLog.calories}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-300 text-sm">{formatMacros(mealLog.protein, mealLog.carbs, mealLog.fat)}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                            mealLog.entryMethod === 'photo' ? 'bg-blue-500/20 text-blue-300' :
                            mealLog.entryMethod === 'text' ? 'bg-green-500/20 text-green-300' :
                            mealLog.entryMethod === 'voice' ? 'bg-purple-500/20 text-purple-300' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {mealLog.entryMethod || 'unknown'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-300 text-sm">{formatDate(mealLog.createdAt)}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            mealLog.image ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {mealLog.image ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => setSelectedMealLog(mealLog)}
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

        {/* Meal Log Details Modal */}
        {selectedMealLog && renderMealLogDetails(selectedMealLog)}

        {/* Toast Message */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className={`px-4 py-2 rounded-lg text-white ${
              toastMessage.type === 'success' ? 'bg-green-600' :
              toastMessage.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
            }`}>
              {toastMessage.text}
              <button
                onClick={() => setToastMessage(null)}
                className="ml-2 text-white hover:text-gray-200"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
};

export default MealLogsManagement; 