import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
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
  MessageSquare
} from 'lucide-react';
import { convertFirestoreTimestamp } from '../../utils/formatDate';

// Define interface for meal macro data
interface MealMacroRequest {
  id: string;
  image?: string;
  macros?: string;
  status?: any; // Changed from string to any to handle Firebase types
  completeTime?: Date | null;
  startTime?: Date | null;
  state?: any; // Changed from string to any to handle Firebase types
  updateTime?: Date | null;
}

// Define interface for generate AI responses
interface GenerateRequest {
  id: string;
  prompt?: string;
  output?: string;
  status?: any;
  completeTime?: Date | null;
  startTime?: Date | null;
  state?: any;
  updateTime?: Date | null;
}

const GenerateManagement: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'mealMacros' | 'generate'>('mealMacros');
  
  // Meal Macros state
  const [mealMacroRequests, setMealMacroRequests] = useState<MealMacroRequest[]>([]);
  const [filteredMealMacroRequests, setFilteredMealMacroRequests] = useState<MealMacroRequest[]>([]);
  const [mealMacroLoading, setMealMacroLoading] = useState(true);
  const [mealMacroSearchTerm, setMealMacroSearchTerm] = useState('');
  const [selectedMealMacroRequest, setSelectedMealMacroRequest] = useState<MealMacroRequest | null>(null);

  // Generate AI state
  const [generateRequests, setGenerateRequests] = useState<GenerateRequest[]>([]);
  const [filteredGenerateRequests, setFilteredGenerateRequests] = useState<GenerateRequest[]>([]);
  const [generateLoading, setGenerateLoading] = useState(true);
  const [generateSearchTerm, setGenerateSearchTerm] = useState('');
  const [selectedGenerateRequest, setSelectedGenerateRequest] = useState<GenerateRequest | null>(null);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // Debounced search function for meal macros
  const debouncedMealMacroSearch = useMemo(
    () => debounce((term: string) => {
      if (!term.trim()) {
        setFilteredMealMacroRequests(mealMacroRequests);
        return;
      }

      const filtered = mealMacroRequests.filter(request => 
        (request.id && request.id.toLowerCase().includes(term.toLowerCase())) ||
        (request.status && typeof request.status === 'string' && request.status.toLowerCase().includes(term.toLowerCase())) ||
        (request.state && typeof request.state === 'string' && request.state.toLowerCase().includes(term.toLowerCase())) ||
        (request.macros && typeof request.macros === 'string' && request.macros.toLowerCase().includes(term.toLowerCase()))
      );
      setFilteredMealMacroRequests(filtered);
    }, 300),
    [mealMacroRequests]
  );

  // Debounced search function for generate requests
  const debouncedGenerateSearch = useMemo(
    () => debounce((term: string) => {
      if (!term.trim()) {
        setFilteredGenerateRequests(generateRequests);
        return;
      }

      const filtered = generateRequests.filter(request => 
        (request.id && request.id.toLowerCase().includes(term.toLowerCase())) ||
        (request.status && typeof request.status === 'string' && request.status.toLowerCase().includes(term.toLowerCase())) ||
        (request.state && typeof request.state === 'string' && request.state.toLowerCase().includes(term.toLowerCase())) ||
        (request.prompt && typeof request.prompt === 'string' && request.prompt.toLowerCase().includes(term.toLowerCase())) ||
        (request.output && typeof request.output === 'string' && request.output.toLowerCase().includes(term.toLowerCase()))
      );
      setFilteredGenerateRequests(filtered);
    }, 300),
    [generateRequests]
  );

  // Effect for meal macro search
  useEffect(() => {
    debouncedMealMacroSearch(mealMacroSearchTerm);
    return () => {
      debouncedMealMacroSearch.cancel();
    };
  }, [mealMacroSearchTerm, debouncedMealMacroSearch]);

  // Effect for generate search
  useEffect(() => {
    debouncedGenerateSearch(generateSearchTerm);
    return () => {
      debouncedGenerateSearch.cancel();
    };
  }, [generateSearchTerm, debouncedGenerateSearch]);

  // Load all meal macro requests
  const loadAllMealMacroRequests = async () => {
    try {
      setMealMacroLoading(true);
      console.log('[GenerateMealMacros] Starting to load meal macro requests...');
      
      const requestsRef = collection(db, 'generateMealMacros');
      console.log('[GenerateMealMacros] Collection reference created:', requestsRef);
      
      // Fetch all documents without orderBy to avoid index requirements
      console.log('[GenerateMealMacros] Executing getDocs without orderBy...');
      const snapshot = await getDocs(requestsRef);
      console.log('[GenerateMealMacros] Query successful');
      
      console.log('[GenerateMealMacros] Snapshot received:', {
        empty: snapshot.empty,
        size: snapshot.size,
        docs: snapshot.docs.length
      });
      
      if (snapshot.empty) {
        console.log('[GenerateMealMacros] No documents found in collection');
        setMealMacroRequests([]);
        setFilteredMealMacroRequests([]);
        setMealMacroLoading(false);
        return;
      }
      
      const requests = snapshot.docs.map((doc, index) => {
        const data = doc.data();
        console.log(`[GenerateMealMacros] Processing doc ${index + 1}/${snapshot.docs.length}:`, {
          id: doc.id,
          dataKeys: Object.keys(data),
          hasUpdateTime: !!data.updateTime,
          hasStartTime: !!data.startTime,
          updateTime: data.updateTime,
          startTime: data.startTime,
          rawData: data // Add full raw data to see structure
        });
        
        // Log specific field values and types
        console.log(`[GenerateMealMacros] Field analysis for doc ${doc.id}:`, {
          status: { value: data.status, type: typeof data.status },
          state: { value: data.state, type: typeof data.state },
          image: { value: data.image, type: typeof data.image },
          macros: { value: data.macros, type: typeof data.macros },
          updateTime: { value: data.updateTime, type: typeof data.updateTime },
          startTime: { value: data.startTime, type: typeof data.startTime },
          completeTime: { value: data.completeTime, type: typeof data.completeTime }
        });
        
        // Convert timestamps properly
        const request: MealMacroRequest = {
          id: doc.id,
          image: data.image || '',
          macros: data.macros || '',
          status: data.status?.state || '', // Extract state from status object
          completeTime: data.status?.completeTime ? (() => {
            console.log(`[GenerateMealMacros] Converting completeTime:`, data.status.completeTime);
            try {
              return convertFirestoreTimestamp(data.status.completeTime);
            } catch (e) {
              console.error(`[GenerateMealMacros] Error converting completeTime:`, e);
              return null;
            }
          })() : null,
          startTime: data.status?.startTime ? (() => {
            console.log(`[GenerateMealMacros] Converting startTime:`, data.status.startTime);
            try {
              return convertFirestoreTimestamp(data.status.startTime);
            } catch (e) {
              console.error(`[GenerateMealMacros] Error converting startTime:`, e);
              return null;
            }
          })() : null,
          state: data.status?.state || '', // Same as status for now
          updateTime: data.status?.updateTime ? (() => {
            console.log(`[GenerateMealMacros] Converting updateTime:`, data.status.updateTime);
            try {
              return convertFirestoreTimestamp(data.status.updateTime);
            } catch (e) {
              console.error(`[GenerateMealMacros] Error converting updateTime:`, e);
              return null;
            }
          })() : null,
        };
        
        console.log(`[GenerateMealMacros] Converted request ${index + 1}:`, {
          id: request.id,
          status: request.status,
          state: request.state,
          updateTime: request.updateTime,
          startTime: request.startTime,
          hasImage: !!request.image,
          hasMacros: !!request.macros
        });
        return request;
      });

      // Sort in JavaScript by updateTime descending (most recent first)
      const sortedRequests = requests.sort((a, b) => {
        const aTime = a.updateTime || a.startTime || new Date(0);
        const bTime = b.updateTime || b.startTime || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });

      console.log('[GenerateMealMacros] All requests processed and sorted:', {
        totalRequests: sortedRequests.length,
        firstFew: sortedRequests.slice(0, 3).map(r => ({
          id: r.id,
          status: r.status,
          state: r.state,
          updateTime: r.updateTime
        }))
      });

      setMealMacroRequests(sortedRequests);
      setFilteredMealMacroRequests(sortedRequests);
      setMealMacroLoading(false);
      
      console.log('[GenerateMealMacros] State updated successfully');
    } catch (error) {
      console.error('[GenerateMealMacros] Error loading meal macro requests:', error);
      console.error('[GenerateMealMacros] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      setToastMessage({ type: 'error', text: `Error loading meal macro requests: ${(error as Error).message}` });
      setMealMacroLoading(false);
    }
  };

  // Load all generate requests
  const loadAllGenerateRequests = async () => {
    try {
      setGenerateLoading(true);
      console.log('[Generate] Starting to load generate requests...');
      
      const requestsRef = collection(db, 'generate');
      console.log('[Generate] Collection reference created:', requestsRef);
      
      // Fetch all documents without orderBy to avoid index requirements
      console.log('[Generate] Executing getDocs without orderBy...');
      const snapshot = await getDocs(requestsRef);
      console.log('[Generate] Query successful');
      
      console.log('[Generate] Snapshot received:', {
        empty: snapshot.empty,
        size: snapshot.size,
        docs: snapshot.docs.length
      });
      
      if (snapshot.empty) {
        console.log('[Generate] No documents found in collection');
        setGenerateRequests([]);
        setFilteredGenerateRequests([]);
        setGenerateLoading(false);
        return;
      }
      
      const requests = snapshot.docs.map((doc, index) => {
        const data = doc.data();
        console.log(`[Generate] Processing doc ${index + 1}/${snapshot.docs.length}:`, {
          id: doc.id,
          dataKeys: Object.keys(data),
          hasUpdateTime: !!data.status?.updateTime,
          hasStartTime: !!data.status?.startTime,
          rawData: data
        });
        
        // Convert timestamps properly
        const request: GenerateRequest = {
          id: doc.id,
          prompt: data.prompt || '',
          output: data.output || '',
          status: data.status?.state || '',
          completeTime: data.status?.completeTime ? (() => {
            console.log(`[Generate] Converting completeTime:`, data.status.completeTime);
            try {
              return convertFirestoreTimestamp(data.status.completeTime);
            } catch (e) {
              console.error(`[Generate] Error converting completeTime:`, e);
              return null;
            }
          })() : null,
          startTime: data.status?.startTime ? (() => {
            console.log(`[Generate] Converting startTime:`, data.status.startTime);
            try {
              return convertFirestoreTimestamp(data.status.startTime);
            } catch (e) {
              console.error(`[Generate] Error converting startTime:`, e);
              return null;
            }
          })() : null,
          state: data.status?.state || '',
          updateTime: data.status?.updateTime ? (() => {
            console.log(`[Generate] Converting updateTime:`, data.status.updateTime);
            try {
              return convertFirestoreTimestamp(data.status.updateTime);
            } catch (e) {
              console.error(`[Generate] Error converting updateTime:`, e);
              return null;
            }
          })() : null,
        };
        
        console.log(`[Generate] Converted request ${index + 1}:`, {
          id: request.id,
          status: request.status,
          state: request.state,
          updateTime: request.updateTime,
          startTime: request.startTime,
          hasPrompt: !!request.prompt,
          hasOutput: !!request.output
        });
        return request;
      });

      // Sort in JavaScript by updateTime descending (most recent first)
      const sortedRequests = requests.sort((a, b) => {
        const aTime = a.updateTime || a.startTime || new Date(0);
        const bTime = b.updateTime || b.startTime || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });

      console.log('[Generate] All requests processed and sorted:', {
        totalRequests: sortedRequests.length,
        firstFew: sortedRequests.slice(0, 3).map(r => ({
          id: r.id,
          status: r.status,
          state: r.state,
          updateTime: r.updateTime
        }))
      });

      setGenerateRequests(sortedRequests);
      setFilteredGenerateRequests(sortedRequests);
      setGenerateLoading(false);
      
      console.log('[Generate] State updated successfully');
    } catch (error) {
      console.error('[Generate] Error loading generate requests:', error);
      console.error('[Generate] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      setToastMessage({ type: 'error', text: `Error loading generate requests: ${(error as Error).message}` });
      setGenerateLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    console.log('[GenerateMealMacros] Component mounted, checking Firebase connection...');
    console.log('[GenerateMealMacros] Database instance:', db);
    console.log('[GenerateMealMacros] Database app:', db.app);
    console.log('[GenerateMealMacros] Database app name:', db.app.name);
    console.log('[GenerateMealMacros] Database app options:', db.app.options);
    
    loadAllMealMacroRequests();
    loadAllGenerateRequests();
  }, []);

  // Format date helper
  const formatDate = (date: Date | null | undefined): string => {
    if (!date || !(date instanceof Date)) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    loadAllMealMacroRequests();
    loadAllGenerateRequests();
  };

  // Get status icon and color
  const getStatusDisplay = (status: any, state: any) => {
    const statusLower = (typeof status === 'string' ? status.toLowerCase() : '') || '';
    const stateLower = (typeof state === 'string' ? state.toLowerCase() : '') || '';
    
    if (stateLower === 'completed' || statusLower === 'completed') {
      return {
        icon: <CheckCircle className="w-4 h-4" />,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500/30'
      };
    } else if (stateLower === 'failed' || statusLower === 'failed' || statusLower === 'error') {
      return {
        icon: <XCircle className="w-4 h-4" />,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/30'
      };
    } else if (stateLower === 'processing' || statusLower === 'processing' || stateLower === 'running') {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/30'
      };
    } else {
      return {
        icon: <Clock className="w-4 h-4" />,
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/20',
        borderColor: 'border-gray-500/30'
      };
    }
  };

  // Render meal macros tab
  const renderMealMacrosTab = () => (
    <>
      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by ID, status, state, or macros..."
            value={mealMacroSearchTerm}
            onChange={(e) => setMealMacroSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={mealMacroLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${mealMacroLoading ? 'animate-spin' : ''}`} />
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
              <p className="text-2xl font-bold text-white">{filteredMealMacroRequests.length}</p>
              <p className="text-sm text-gray-400">Total Requests</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {filteredMealMacroRequests.filter(r => 
                  (r.state && typeof r.state === 'string' && r.state.toLowerCase() === 'completed') || 
                  (r.status && typeof r.status === 'string' && r.status.toLowerCase() === 'completed')
                ).length}
              </p>
              <p className="text-sm text-gray-400">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {filteredMealMacroRequests.filter(r => 
                  (r.state && typeof r.state === 'string' && (r.state.toLowerCase() === 'processing' || r.state.toLowerCase() === 'running'))
                ).length}
              </p>
              <p className="text-sm text-gray-400">Processing</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {filteredMealMacroRequests.filter(r => 
                  (r.state && typeof r.state === 'string' && r.state.toLowerCase() === 'failed') || 
                  (r.status && typeof r.status === 'string' && r.status.toLowerCase() === 'failed')
                ).length}
              </p>
              <p className="text-sm text-gray-400">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-[#1a1e24] rounded-lg border border-zinc-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#262a30] border-b border-zinc-700">
              <tr>
                <th className="text-left p-4 text-gray-300 font-medium">Request ID</th>
                <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                <th className="text-left p-4 text-gray-300 font-medium">State</th>
                <th className="text-left p-4 text-gray-300 font-medium">Start Time</th>
                <th className="text-left p-4 text-gray-300 font-medium">Update Time</th>
                <th className="text-left p-4 text-gray-300 font-medium">Has Image</th>
                <th className="text-left p-4 text-gray-300 font-medium">Has Macros</th>
                <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mealMacroLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading meal macro requests...
                    </div>
                  </td>
                </tr>
              ) : filteredMealMacroRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    No meal macro requests found
                  </td>
                </tr>
              ) : (
                filteredMealMacroRequests.map((request) => {
                  const statusDisplay = getStatusDisplay(request.status, request.state);
                  return (
                    <tr key={request.id} className="border-b border-zinc-700 hover:bg-[#262a30] transition-colors">
                      <td className="p-4">
                        <span className="text-white font-mono text-sm">{request.id}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${statusDisplay.bgColor} ${statusDisplay.color} border ${statusDisplay.borderColor}`}>
                          {statusDisplay.icon}
                          {request.status || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300">{request.state || 'N/A'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300 text-sm">{formatDate(request.startTime)}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300 text-sm">{formatDate(request.updateTime)}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          request.image ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {request.image ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          request.macros ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {request.macros ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setSelectedMealMacroRequest(request)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // Render generate tab
  const renderGenerateTab = () => (
    <>
      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by ID, status, prompt, or output..."
            value={generateSearchTerm}
            onChange={(e) => setGenerateSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={generateLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${generateLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{filteredGenerateRequests.length}</p>
              <p className="text-sm text-gray-400">Total Requests</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {filteredGenerateRequests.filter(r => 
                  (r.state && typeof r.state === 'string' && r.state.toLowerCase() === 'completed') || 
                  (r.status && typeof r.status === 'string' && r.status.toLowerCase() === 'completed')
                ).length}
              </p>
              <p className="text-sm text-gray-400">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {filteredGenerateRequests.filter(r => 
                  (r.state && typeof r.state === 'string' && (r.state.toLowerCase() === 'processing' || r.state.toLowerCase() === 'running'))
                ).length}
              </p>
              <p className="text-sm text-gray-400">Processing</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {filteredGenerateRequests.filter(r => 
                  (r.state && typeof r.state === 'string' && r.state.toLowerCase() === 'failed') || 
                  (r.status && typeof r.status === 'string' && r.status.toLowerCase() === 'failed')
                ).length}
              </p>
              <p className="text-sm text-gray-400">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-[#1a1e24] rounded-lg border border-zinc-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#262a30] border-b border-zinc-700">
              <tr>
                <th className="text-left p-4 text-gray-300 font-medium">Request ID</th>
                <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                <th className="text-left p-4 text-gray-300 font-medium">State</th>
                <th className="text-left p-4 text-gray-300 font-medium">Start Time</th>
                <th className="text-left p-4 text-gray-300 font-medium">Update Time</th>
                <th className="text-left p-4 text-gray-300 font-medium">Has Prompt</th>
                <th className="text-left p-4 text-gray-300 font-medium">Has Output</th>
                <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {generateLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading generate requests...
                    </div>
                  </td>
                </tr>
              ) : filteredGenerateRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    No generate requests found
                  </td>
                </tr>
              ) : (
                filteredGenerateRequests.map((request) => {
                  const statusDisplay = getStatusDisplay(request.status, request.state);
                  return (
                    <tr key={request.id} className="border-b border-zinc-700 hover:bg-[#262a30] transition-colors">
                      <td className="p-4">
                        <span className="text-white font-mono text-sm">{request.id}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${statusDisplay.bgColor} ${statusDisplay.color} border ${statusDisplay.borderColor}`}>
                          {statusDisplay.icon}
                          {request.status || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300">{request.state || 'N/A'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300 text-sm">{formatDate(request.startTime)}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300 text-sm">{formatDate(request.updateTime)}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          request.prompt ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {request.prompt ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          request.output ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {request.output ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setSelectedGenerateRequest(request)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // Render meal macro request details modal
  const renderMealMacroDetails = (request: MealMacroRequest) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1e24] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-zinc-700">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Meal Macro Request Details</h3>
                <p className="text-gray-400">Request ID: {request.id}</p>
              </div>
              <button
                onClick={() => setSelectedMealMacroRequest(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Status and Timing Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Status</span>
                </div>
                <p className="text-white font-semibold">{request.status || 'N/A'}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-400">State</span>
                </div>
                <p className="text-white font-semibold">{request.state || 'N/A'}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">Start Time</span>
                </div>
                <p className="text-white font-semibold">{formatDate(request.startTime)}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm text-gray-400">Complete Time</span>
                </div>
                <p className="text-white font-semibold">{formatDate(request.completeTime)}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-400">Update Time</span>
                </div>
                <p className="text-white font-semibold">{formatDate(request.updateTime)}</p>
              </div>
            </div>

            {/* Image */}
            {request.image && (
              <div className="bg-[#262a30] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Meal Image
                </h4>
                <div className="flex justify-center">
                  <img 
                    src={request.image} 
                    alt="Meal" 
                    className="max-w-full max-h-96 rounded-lg object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            {/* Macros */}
            {request.macros && (
              <div className="bg-[#262a30] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Utensils className="w-4 h-4" />
                  Generated Macros
                </h4>
                <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
                  <pre className="text-gray-300 whitespace-pre-wrap text-sm overflow-x-auto">
                    {request.macros}
                  </pre>
                </div>
              </div>
            )}

            {/* Request ID */}
            <div className="bg-[#262a30] rounded-lg p-4">
              <h4 className="text-white font-semibold mb-3">Request Information</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Request ID:</span>
                  <span className="text-white ml-2 font-mono">{request.id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render generate request details modal
  const renderGenerateDetails = (request: GenerateRequest) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1e24] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-zinc-700">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">AI Generate Request Details</h3>
                <p className="text-gray-400">Request ID: {request.id}</p>
              </div>
              <button
                onClick={() => setSelectedGenerateRequest(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Status and Timing Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Status</span>
                </div>
                <p className="text-white font-semibold">{request.status || 'N/A'}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-400">State</span>
                </div>
                <p className="text-white font-semibold">{request.state || 'N/A'}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">Start Time</span>
                </div>
                <p className="text-white font-semibold">{formatDate(request.startTime)}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm text-gray-400">Complete Time</span>
                </div>
                <p className="text-white font-semibold">{formatDate(request.completeTime)}</p>
              </div>

              <div className="bg-[#262a30] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-400">Update Time</span>
                </div>
                <p className="text-white font-semibold">{formatDate(request.updateTime)}</p>
              </div>
            </div>

            {/* Prompt */}
            {request.prompt && (
              <div className="bg-[#262a30] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Input Prompt
                </h4>
                <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
                  <pre className="text-gray-300 whitespace-pre-wrap text-sm overflow-x-auto">
                    {request.prompt}
                  </pre>
                </div>
              </div>
            )}

            {/* Output */}
            {request.output && (
              <div className="bg-[#262a30] rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  AI Generated Output
                </h4>
                <div className="bg-[#1a1e24] rounded-lg p-4 border border-zinc-700">
                  <pre className="text-gray-300 whitespace-pre-wrap text-sm overflow-x-auto">
                    {request.output}
                  </pre>
                </div>
              </div>
            )}

            {/* Request ID */}
            <div className="bg-[#262a30] rounded-lg p-4">
              <h4 className="text-white font-semibold mb-3">Request Information</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Request ID:</span>
                  <span className="text-white ml-2 font-mono">{request.id}</span>
                </div>
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
          <title>Generate Management - Pulse Admin</title>
          <meta name="description" content="Manage AI generation requests" />
        </Head>

        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Generate Management</h1>
            <p className="text-gray-400">View and monitor AI generation requests</p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="border-b border-zinc-700">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('mealMacros')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'mealMacros'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4" />
                    Meal Macros ({filteredMealMacroRequests.length})
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('generate')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'generate'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    AI Generate ({filteredGenerateRequests.length})
                  </div>
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'mealMacros' ? renderMealMacrosTab() : renderGenerateTab()}
        </div>

        {/* Request Details Modals */}
        {selectedMealMacroRequest && renderMealMacroDetails(selectedMealMacroRequest)}
        {selectedGenerateRequest && renderGenerateDetails(selectedGenerateRequest)}

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

export default GenerateManagement; 