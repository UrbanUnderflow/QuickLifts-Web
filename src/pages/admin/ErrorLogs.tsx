import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, limit, doc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { AlertTriangle, User, Calendar, Search, Filter, Trash2, Copy, Eye, XCircle, CheckCircle, Loader2, AlertCircle, Clock, Bug } from 'lucide-react';
import { convertFirestoreTimestamp } from '../../utils/formatDate';

// Define interfaces for display
interface ErrorLogDisplay {
  id: string;
  username: string;
  userId: string;
  errorMessage: string;
  createdAt: Date;
  timestamp?: Date;
  context?: {
    source?: string;
    prizeId?: string;
    challengeId?: string;
    challengeTitle?: string;
    rankTried?: number;
    prizeAmountTriedCents?: number;
    stripeAccountId?: string;
    [key: string]: any;
  };
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

const ErrorLogs: React.FC = () => {
  const [errorLogs, setErrorLogs] = useState<ErrorLogDisplay[]>([]);
  const [filteredErrorLogs, setFilteredErrorLogs] = useState<ErrorLogDisplay[]>([]);
  const [loadingErrorLogs, setLoadingErrorLogs] = useState(true);
  const [totalErrorCount, setTotalErrorCount] = useState<number>(0);
  
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const [selectedError, setSelectedError] = useState<ErrorLogDisplay | null>(null);
  const [deletingErrors, setDeletingErrors] = useState<{[errorId: string]: boolean}>({});
  const [resolvingErrors, setResolvingErrors] = useState<{[errorId: string]: boolean}>({});

  // Search states
  const [errorSearchTerm, setErrorSearchTerm] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showResolvedOnly, setShowResolvedOnly] = useState(false);
  const [showUnresolvedOnly, setShowUnresolvedOnly] = useState(false);

  // Show/hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Filter error logs based on search terms and filters
  useEffect(() => {
    let filtered = errorLogs;

    if (errorSearchTerm) {
      filtered = filtered.filter(log =>
        log.errorMessage.toLowerCase().includes(errorSearchTerm.toLowerCase()) ||
        log.id.toLowerCase().includes(errorSearchTerm.toLowerCase()) ||
        log.context?.challengeTitle?.toLowerCase().includes(errorSearchTerm.toLowerCase())
      );
    }

    if (usernameFilter) {
      filtered = filtered.filter(log =>
        log.username.toLowerCase().includes(usernameFilter.toLowerCase()) ||
        log.userId.toLowerCase().includes(usernameFilter.toLowerCase())
      );
    }

    if (sourceFilter) {
      filtered = filtered.filter(log =>
        log.context?.source?.toLowerCase().includes(sourceFilter.toLowerCase())
      );
    }

    if (showResolvedOnly) {
      filtered = filtered.filter(log => log.resolved === true);
    } else if (showUnresolvedOnly) {
      filtered = filtered.filter(log => log.resolved !== true);
    }

    setFilteredErrorLogs(filtered);
  }, [errorLogs, errorSearchTerm, usernameFilter, sourceFilter, showResolvedOnly, showUnresolvedOnly]);

  const fetchErrorLogs = useCallback(async () => {
    console.log('[ErrorLogs] Fetching error logs...');
    setLoadingErrorLogs(true);
    setError(null);
    try {
      const errorLogsRef = collection(db, 'errorLogs');
      // Get more logs for better analysis - limit to 500 most recent
      const q = query(errorLogsRef, orderBy('createdAt', 'desc'), limit(500));
      const snapshot = await getDocs(q);
      
      const fetchedLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('[ErrorLogs] Fetched error log:', data);
        
        return {
          id: doc.id,
          username: data.username || 'Unknown',
          userId: data.userId || 'Unknown',
          errorMessage: data.errorMessage || 'No error message',
          createdAt: convertFirestoreTimestamp(data.createdAt || data.timestamp),
          timestamp: data.timestamp ? convertFirestoreTimestamp(data.timestamp) : undefined,
          context: data.context || {},
          resolved: data.resolved || false,
          resolvedAt: data.resolvedAt ? convertFirestoreTimestamp(data.resolvedAt) : undefined,
          resolvedBy: data.resolvedBy || undefined,
        } as ErrorLogDisplay;
      });

      setErrorLogs(fetchedLogs);
      setFilteredErrorLogs(fetchedLogs);
      setTotalErrorCount(fetchedLogs.length);
      console.log(`[ErrorLogs] Fetched ${fetchedLogs.length} error logs.`);
    } catch (err) {
      console.error('[ErrorLogs] Error fetching error logs:', err);
      setError(`Failed to load error logs. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setErrorLogs([]);
      setFilteredErrorLogs([]);
    } finally {
      setLoadingErrorLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchErrorLogs();
  }, [fetchErrorLogs]);

  const handleDeleteError = async (errorId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this error log? This action cannot be undone.")) {
      return;
    }

    setDeletingErrors(prev => ({ ...prev, [errorId]: true }));
    setToastMessage({ type: 'info', text: 'Deleting error log...' });
    
    try {
      const errorRef = doc(db, 'errorLogs', errorId);
      await deleteDoc(errorRef);

      // Remove from state
      setErrorLogs(prevLogs => prevLogs.filter(log => log.id !== errorId));
      setFilteredErrorLogs(prevLogs => prevLogs.filter(log => log.id !== errorId));

      // Update total count
      setTotalErrorCount(prev => Math.max(0, prev - 1));

      setToastMessage({ type: 'success', text: 'Error log deleted successfully.' });
    } catch (err) {
      console.error('[ErrorLogs] Error deleting error log:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error.';
      setToastMessage({ type: 'error', text: `Failed to delete error log: ${errorMessage}` });
    } finally {
      setDeletingErrors(prev => ({ ...prev, [errorId]: false }));
    }
  };

  const handleMarkAsResolved = async (errorId: string) => {
    setResolvingErrors(prev => ({ ...prev, [errorId]: true }));
    setToastMessage({ type: 'info', text: 'Marking error as resolved...' });
    
    try {
      const errorRef = doc(db, 'errorLogs', errorId);
      await updateDoc(errorRef, {
        resolved: true,
        resolvedAt: serverTimestamp(),
        resolvedBy: 'admin', // You could get the actual admin user here
      });

      // Update state
      setErrorLogs(prevLogs => 
        prevLogs.map(log => 
          log.id === errorId 
            ? { ...log, resolved: true, resolvedAt: new Date(), resolvedBy: 'admin' }
            : log
        )
      );

      setToastMessage({ type: 'success', text: 'Error marked as resolved.' });
    } catch (err) {
      console.error('[ErrorLogs] Error marking as resolved:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error.';
      setToastMessage({ type: 'error', text: `Failed to mark as resolved: ${errorMessage}` });
    } finally {
      setResolvingErrors(prev => ({ ...prev, [errorId]: false }));
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage({ type: 'success', text: `${label} copied to clipboard!` });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setToastMessage({ type: 'error', text: `Failed to copy ${label.toLowerCase()}` });
    }
  };

  // Format date helper
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    try {
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      if (date instanceof Date && !isNaN(date.getTime())) {
        return date.toLocaleString();
      }
      return 'Invalid Date';
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // Get time ago string
  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Render Error Details Modal
  const renderErrorDetailsModal = () => {
    if (!selectedError) return null;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in-up">
        <div className="bg-[#1a1e24] rounded-xl p-6 shadow-xl border border-[#d7ff00]/30 max-w-4xl w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Bug className="h-6 w-6 text-red-400" />
              <div>
                <h3 className="text-xl font-semibold text-white">Error Details</h3>
                <p className="text-sm text-gray-400">ID: {selectedError.id}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedError(null)}
              className="p-1 text-gray-400 hover:text-white transition"
              title="Close error details"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
          
          <div className="flex-grow overflow-y-auto pr-2 space-y-4">
            {/* Basic Info */}
            <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
              <h4 className="text-lg font-semibold text-white mb-3">Basic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Username</p>
                  <p className="text-white font-mono">{selectedError.username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">User ID</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-mono text-sm">{selectedError.userId}</p>
                    <button
                      onClick={() => handleCopyToClipboard(selectedError.userId, 'User ID')}
                      className="p-1 text-gray-400 hover:text-[#d7ff00] transition-colors"
                      title="Copy User ID"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Created At</p>
                  <p className="text-white">{formatDate(selectedError.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedError.resolved 
                      ? 'bg-green-500/80 text-white' 
                      : 'bg-red-500/80 text-white'
                  }`}>
                    {selectedError.resolved ? 'Resolved' : 'Unresolved'}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
              <h4 className="text-lg font-semibold text-white mb-3">Error Message</h4>
              <div className="bg-[#1a1e24] rounded p-3 border border-gray-600">
                <pre className="text-red-300 text-sm whitespace-pre-wrap break-words">
                  {selectedError.errorMessage}
                </pre>
              </div>
            </div>

            {/* Context Information */}
            {selectedError.context && Object.keys(selectedError.context).length > 0 && (
              <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
                <h4 className="text-lg font-semibold text-white mb-3">Context Information</h4>
                <div className="bg-[#1a1e24] rounded p-3 border border-gray-600">
                  <pre className="text-gray-300 text-sm whitespace-pre-wrap">
                    {JSON.stringify(selectedError.context, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Resolution Info */}
            {selectedError.resolved && (
              <div className="bg-green-900/20 rounded-lg p-4 border border-green-700">
                <h4 className="text-lg font-semibold text-green-300 mb-3">Resolution Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-green-400">Resolved At</p>
                    <p className="text-green-300">{formatDate(selectedError.resolvedAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-400">Resolved By</p>
                    <p className="text-green-300">{selectedError.resolvedBy || 'Unknown'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between">
            <div className="flex gap-2">
              {!selectedError.resolved && (
                <button
                  onClick={() => {
                    handleMarkAsResolved(selectedError.id);
                    setSelectedError(null);
                  }}
                  disabled={resolvingErrors[selectedError.id]}
                  className="px-4 py-2 bg-green-700/80 hover:bg-green-600/80 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                >
                  {resolvingErrors[selectedError.id] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Mark as Resolved
                </button>
              )}
              <button
                onClick={() => handleCopyToClipboard(selectedError.errorMessage, 'Error Message')}
                className="px-4 py-2 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Error
              </button>
            </div>
            <button
              onClick={() => setSelectedError(null)}
              className="px-4 py-2 bg-gray-700/30 text-gray-300 rounded-lg text-sm font-medium border border-gray-700 hover:bg-gray-700/50 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Error Logs | Pulse Admin</title>
        <style>{`
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
        `}</style>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold flex items-center">
              <Bug className="text-red-400 mr-3 h-7 w-7" />
              Error Logs
            </h1>
            <button
              onClick={fetchErrorLogs}
              className="px-4 py-2 bg-blue-700/80 hover:bg-blue-600/80 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              Refresh Logs
            </button>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Total Errors */}
            <div className="p-6 bg-[#262a30] rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-300">
                <Bug className="text-red-400 h-5 w-5"/> Total Errors
              </h3>
              {loadingErrorLogs ? (
                <div className="h-10 w-24 bg-gray-700 rounded animate-pulse"></div>
              ) : (
                <p className="text-4xl font-bold text-red-400">{totalErrorCount}</p>
              )}
            </div>

            {/* Unresolved Errors */}
            <div className="p-6 bg-[#262a30] rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-300">
                <AlertTriangle className="text-orange-400 h-5 w-5" /> Unresolved
              </h3>
              {loadingErrorLogs ? (
                <div className="h-10 w-24 bg-gray-700 rounded animate-pulse"></div>
              ) : (
                <p className="text-4xl font-bold text-orange-400">
                  {errorLogs.filter(log => !log.resolved).length}
                </p>
              )}
            </div>

            {/* Resolved Errors */}
            <div className="p-6 bg-[#262a30] rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-300">
                <CheckCircle className="text-green-400 h-5 w-5" /> Resolved
              </h3>
              {loadingErrorLogs ? (
                <div className="h-10 w-24 bg-gray-700 rounded animate-pulse"></div>
              ) : (
                <p className="text-4xl font-bold text-green-400">
                  {errorLogs.filter(log => log.resolved).length}
                </p>
              )}
            </div>

            {/* Recent Errors (last 24h) */}
            <div className="p-6 bg-[#262a30] rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-300">
                <Clock className="text-blue-400 h-5 w-5" /> Last 24h
              </h3>
              {loadingErrorLogs ? (
                <div className="h-10 w-24 bg-gray-700 rounded animate-pulse"></div>
              ) : (
                <p className="text-4xl font-bold text-blue-400">
                  {errorLogs.filter(log => {
                    const dayAgo = new Date();
                    dayAgo.setDate(dayAgo.getDate() - 1);
                    return log.createdAt > dayAgo;
                  }).length}
                </p>
              )}
            </div>
          </div>

          {/* Search and Filter Section */}
          <div className="mb-6 p-4 bg-[#262a30] rounded-xl border border-gray-700">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-5 w-5 text-[#d7ff00]" />
                <h3 className="text-lg font-semibold text-white">Search & Filter Error Logs</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Search Error Message</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search error messages..."
                      value={errorSearchTerm}
                      onChange={(e) => setErrorSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Filter by User</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Username or User ID..."
                      value={usernameFilter}
                      onChange={(e) => setUsernameFilter(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Source</label>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Error source..."
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              {/* Status Filters */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showUnresolvedOnly}
                    onChange={(e) => {
                      setShowUnresolvedOnly(e.target.checked);
                      if (e.target.checked) setShowResolvedOnly(false);
                    }}
                    className="mr-2 h-4 w-4 text-[#d7ff00] bg-[#1a1e24] border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Show unresolved only</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showResolvedOnly}
                    onChange={(e) => {
                      setShowResolvedOnly(e.target.checked);
                      if (e.target.checked) setShowUnresolvedOnly(false);
                    }}
                    className="mr-2 h-4 w-4 text-[#d7ff00] bg-[#1a1e24] border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Show resolved only</span>
                </label>
              </div>

              {(errorSearchTerm || usernameFilter || sourceFilter || showResolvedOnly || showUnresolvedOnly) && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                  <p className="text-sm text-gray-400">
                    Showing {filteredErrorLogs.length} of {errorLogs.length} error logs
                  </p>
                  <button
                    onClick={() => {
                      setErrorSearchTerm('');
                      setUsernameFilter('');
                      setSourceFilter('');
                      setShowResolvedOnly(false);
                      setShowUnresolvedOnly(false);
                    }}
                    className="text-sm text-[#d7ff00] hover:text-[#b8d400] transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-900/20 p-4 rounded-lg border border-red-800 text-red-300 flex items-center gap-3 mb-6">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Error Logs Table */}
          {loadingErrorLogs ? (
            <div className="flex justify-center items-center py-20"><Loader2 className="h-10 w-10 text-[#d7ff00] animate-spin" /></div>
          ) : filteredErrorLogs.length === 0 && errorLogs.length === 0 && !error ? (
            <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center">
              <Bug className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 text-lg">No error logs found in the database.</p>
            </div>
          ) : filteredErrorLogs.length === 0 && errorLogs.length > 0 ? (
            <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 text-lg">No error logs match your search criteria.</p>
              <p className="text-gray-500 text-sm mt-2">Try adjusting your search terms or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-[#1a1e24] rounded-xl shadow-xl border border-gray-800">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">User</th>
                    <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Error Message</th>
                    <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Source</th>
                    <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Status</th>
                    <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Created</th>
                    <th className="py-3 px-5 text-center text-xs text-gray-400 font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredErrorLogs.map((log) => (
                    <tr key={log.id} className={`hover:bg-[#20252c] transition-colors ${!log.resolved ? 'bg-red-800/5' : ''}`}>
                      <td className="py-4 px-5">
                        <div>
                          <p className="text-sm text-white font-medium">{log.username}</p>
                          <p className="text-xs text-gray-400 font-mono">{log.userId.substring(0, 8)}...</p>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="max-w-md">
                          <p className="text-sm text-gray-300 truncate" title={log.errorMessage}>
                            {log.errorMessage}
                          </p>
                          {log.context?.challengeTitle && (
                            <p className="text-xs text-blue-400 mt-1">
                              Challenge: {log.context.challengeTitle}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-sm text-gray-300">
                        {log.context?.source || 'Unknown'}
                      </td>
                      <td className="py-4 px-5 text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          log.resolved 
                            ? 'bg-green-500/80 text-white' 
                            : 'bg-red-500/80 text-white'
                        }`}>
                          {log.resolved ? 'Resolved' : 'Unresolved'}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div>
                          <p className="text-sm text-gray-300">{getTimeAgo(log.createdAt)}</p>
                          <p className="text-xs text-gray-500">{formatDate(log.createdAt)}</p>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setSelectedError(log)}
                            className="p-1.5 rounded-md transition-colors bg-blue-700/80 hover:bg-blue-600/80 text-white"
                            title="View error details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {!log.resolved && (
                            <button
                              onClick={() => handleMarkAsResolved(log.id)}
                              disabled={resolvingErrors[log.id]}
                              className="p-1.5 rounded-md transition-colors bg-green-700/80 hover:bg-green-600/80 text-white"
                              title="Mark as resolved"
                            >
                              {resolvingErrors[log.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleCopyToClipboard(log.errorMessage, 'Error Message')}
                            className="p-1.5 rounded-md transition-colors bg-gray-700/80 hover:bg-gray-600/80 text-white"
                            title="Copy error message"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteError(log.id)}
                            disabled={deletingErrors[log.id]}
                            className="p-1.5 rounded-md transition-colors bg-red-700/80 hover:bg-red-600/80 text-white"
                            title="Delete error log"
                          >
                            {deletingErrors[log.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Error Details Modal */}
      {selectedError && renderErrorDetailsModal()}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 py-2.5 px-5 rounded-lg shadow-xl flex items-center gap-2.5 animate-fade-in-up z-[100] ${
          toastMessage.type === 'success' 
            ? 'bg-green-700/95 border border-green-600 text-white'
            : toastMessage.type === 'error'
              ? 'bg-red-700/95 border border-red-600 text-white'
              : 'bg-blue-700/95 border border-blue-600 text-white'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" /> </svg>
          )}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default ErrorLogs;

