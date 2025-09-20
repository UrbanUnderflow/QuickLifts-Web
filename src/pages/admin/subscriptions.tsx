import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, documentId, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { convertFirestoreTimestamp } from '../../utils/formatDate';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { Eye, XCircle, RefreshCw, AlertCircle, CheckCircle, Copy, TrendingUp } from 'lucide-react';

type SubscriptionRow = {
  id: string;
  userId: string;
  userEmail?: string | null;
  username?: string | null;
  platform?: string;
  subscriptionType?: string;
  status?: string;
  isTrialing?: boolean;
  trialEndDate?: any;
  expirationHistory?: any[];
  updatedAt?: any;
};

function getLatestExpiration(doc: SubscriptionRow): Date | null {
  const candidates: Date[] = [];
  if (Array.isArray(doc.expirationHistory)) {
    for (const t of doc.expirationHistory) {
      const d = convertFirestoreTimestamp(t);
      if (!isNaN(d.valueOf())) candidates.push(d);
    }
  }
  if (doc.trialEndDate) {
    const d = convertFirestoreTimestamp(doc.trialEndDate);
    if (!isNaN(d.valueOf())) candidates.push(d);
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((max, cur) => (cur > max ? cur : max));
}

const PAGE_SIZE = 100;

const SubscriptionsAdminPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [usernameSearch, setUsernameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [lastCursor, setLastCursor] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionRow | null>(null);
  const [copiedId, setCopiedId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const loadUsernames = useCallback(async (rows: SubscriptionRow[]) => {
    try {
      const missingIds = Array.from(new Set(rows.map(r => r.userId).filter(Boolean))).filter(id => !usernames[id]);
      if (missingIds.length === 0) return;
      const chunkSize = 10;
      const updates: Record<string, string> = {};
      for (let i = 0; i < missingIds.length; i += chunkSize) {
        const chunk = missingIds.slice(i, i + chunkSize);
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          const data = d.data() as any;
          updates[d.id] = data?.username || '';
        });
      }
      if (Object.keys(updates).length > 0) {
        setUsernames(prev => ({ ...prev, ...updates }));
      }
    } catch (_) {}
  }, [db, usernames]);

  const loadPage = useCallback(async (append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const colRef = collection(db, 'subscriptions');
      let q = query(colRef, orderBy('updatedAt', 'desc'), limit(PAGE_SIZE));
      if (append && lastCursor) {
        q = query(colRef, orderBy('updatedAt', 'desc'), startAfter(lastCursor), limit(PAGE_SIZE));
      }
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      if (append) {
        setSubscriptions(prev => [...prev, ...rows]);
        loadUsernames(rows);
      } else {
        setSubscriptions(rows);
        loadUsernames(rows);
      }
      const newLast = snap.docs[snap.docs.length - 1]?.get('updatedAt') || null;
      setLastCursor(newLast);
      setHasMore(snap.size === PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [lastCursor]);

  useEffect(() => {
    loadPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    const usernameLower = usernameSearch.trim().toLowerCase();
    return subscriptions.filter(s => {
      const matchesSearch = !lower ||
        s.id.toLowerCase().includes(lower) ||
        (s.userId || '').toLowerCase().includes(lower) ||
        (s.userEmail || '').toLowerCase().includes(lower) ||
        (s.username || '').toLowerCase().includes(lower) ||
        (s.subscriptionType || '').toLowerCase().includes(lower);
      const matchesUsername = !usernameLower || (s.username || usernames[s.userId] || '').toLowerCase().includes(usernameLower);
      const matchesStatus = !statusFilter || (s.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesPlatform = !platformFilter || (s.platform || '').toLowerCase() === platformFilter.toLowerCase();
      return matchesSearch && matchesUsername && matchesStatus && matchesPlatform;
    });
  }, [subscriptions, search, usernameSearch, statusFilter, platformFilter, usernames]);

  // Copy ID to clipboard and show toast
  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id)
      .then(() => {
        setCopiedId(id);
        setToastMessage({ type: 'success', text: 'ID copied to clipboard' });
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        setToastMessage({ type: 'error', text: 'Error: Failed to copy ID' });
      });
  };

  const handleSyncRevenueCat = async (userId: string) => {
    try {
      setToastMessage({ type: 'info', text: 'Syncing with RevenueCat...' });
      await fetch('/.netlify/functions/sync-revenuecat-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      await loadPage(false);
      setToastMessage({ type: 'success', text: 'RevenueCat sync completed' });
    } catch (_) {
      setToastMessage({ type: 'error', text: 'Failed to sync with RevenueCat' });
    }
  };

  const handleMigrateHistory = async (userId: string) => {
    try {
      setToastMessage({ type: 'info', text: 'Migrating Stripe history...' });
      await fetch('/.netlify/functions/migrate-expiration-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      await loadPage(false);
      setToastMessage({ type: 'success', text: 'Stripe history migration completed' });
    } catch (_) {
      setToastMessage({ type: 'error', text: 'Failed to migrate Stripe history' });
    }
  };

  // Format date helper function
  const formatDate = (date: any): string => {
    if (!date) return 'Not available';
    
    // If it's a Firebase timestamp, use toDate()
    if (date && typeof date.toDate === 'function') {
      date = date.toDate();
    }
      
    return new Date(date).toLocaleString();
  };

  // Add useEffect to hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000); // Hide toast after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Render subscription details for expanded row
  const renderSubscriptionDetails = (subscription: SubscriptionRow) => {
    const latest = getLatestExpiration(subscription);
    const activeState: 'unknown' | 'active' | 'expired' = !latest
      ? 'unknown'
      : (latest > new Date() ? 'active' : 'expired');
    const updated = subscription.updatedAt ? convertFirestoreTimestamp(subscription.updatedAt) : null;
    
    return (
      <div className="bg-[#1d2b3a] border-t border-blue-800 animate-fade-in-up p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-[#d7ff00]" />
            <div>
              <h4 className="text-lg font-medium text-white">Subscription Details</h4>
              <p className="text-gray-400 text-sm font-mono">
                ID: 
                <button 
                  onClick={() => copyToClipboard(subscription.id)} 
                  className="hover:text-blue-400 flex items-center ml-1"
                  title="Copy subscription ID"
                >
                  {subscription.id}
                  <Copy className="h-4 w-4 ml-1" />
                </button>
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedSubscription(null)}
            className="p-1 text-gray-400 hover:text-gray-200 transition"
            title="Close details"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Basic Information */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Basic Information</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">User ID</div>
                <div className="text-gray-300 font-mono text-sm">
                  <button 
                    onClick={() => copyToClipboard(subscription.userId)} 
                    className="hover:text-blue-400 flex items-center"
                    title="Copy user ID"
                  >
                    {subscription.userId}
                    <Copy className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Username</div>
                <div className="text-gray-300">{usernames[subscription.userId] || 'Loading...'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Platform</div>
                <div className="text-gray-300">{subscription.platform || 'Not specified'}</div>
              </div>
            </div>
          </div>
          
          {/* Column 2: Subscription Information */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Subscription Information</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">Type</div>
                <div className="text-gray-300">{subscription.subscriptionType || 'Not specified'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Status</div>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                    subscription.status === 'active' 
                      ? 'bg-green-900/30 text-green-400 border-green-900'
                      : subscription.status === 'canceled'
                      ? 'bg-red-900/30 text-red-400 border-red-900'
                      : 'bg-gray-900/30 text-gray-400 border-gray-700'
                  }`}>
                    {subscription.status || 'Unknown'}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Trial Status</div>
                <div className="mt-1">
                  {subscription.isTrialing ? (
                    <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-900">
                      Trialing
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">
                      Not Trialing
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Column 3: Status Information */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Status Information</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">Active Status</div>
                <div className="mt-1">
                  {activeState === 'active' && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium border bg-green-900/30 text-green-400 border-green-900">Active</span>
                  )}
                  {activeState === 'expired' && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium border bg-red-900/30 text-red-400 border-red-900">Expired</span>
                  )}
                  {activeState === 'unknown' && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium border bg-gray-900/30 text-gray-300 border-gray-700">Unknown</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Latest Expiration</div>
                <div className="text-gray-300">{latest ? formatDate(latest) : 'No expiration found'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Last Updated</div>
                <div className="text-gray-300">{updated ? formatDate(updated) : 'Not available'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Expiration History */}
        {subscription.expirationHistory && subscription.expirationHistory.length > 0 && (
          <div className="mt-6">
            <h5 className="text-gray-400 text-sm font-medium mb-3 border-b border-gray-700 pb-1">Expiration History</h5>
            <div className="bg-[#262a30] rounded-lg p-3 overflow-x-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {subscription.expirationHistory.map((exp: any, index: number) => {
                  const expDate = convertFirestoreTimestamp(exp);
                  const isPast = expDate < new Date();
                  return (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border ${
                        isPast 
                          ? 'bg-red-900/20 border-red-900' 
                          : 'bg-green-900/20 border-green-900'
                      }`}
                    >
                      <div className="text-xs text-gray-400 mb-1">Expiration #{index + 1}</div>
                      <div className={`font-medium ${isPast ? 'text-red-300' : 'text-green-300'}`}>
                        {formatDate(expDate)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => handleSyncRevenueCat(subscription.userId)}
            className="px-3 py-1.5 bg-blue-900/30 text-blue-400 rounded-lg text-xs font-medium border border-blue-900 hover:bg-blue-800/40 transition flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync RevenueCat
          </button>
          <button
            onClick={() => handleMigrateHistory(subscription.userId)}
            className="px-3 py-1.5 bg-purple-900/30 text-purple-400 rounded-lg text-xs font-medium border border-purple-900 hover:bg-purple-800/40 transition flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Migrate Stripe
          </button>
          <button
            onClick={() => copyToClipboard(subscription.id)}
            className="px-3 py-1.5 bg-[#262a30] text-[#d7ff00] rounded-lg text-xs font-medium border border-[#616e00] hover:bg-[#2c3137] transition flex items-center"
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy ID
          </button>
          <button
            onClick={() => setSelectedSubscription(null)}
            className="px-3 py-1.5 bg-gray-700/30 text-gray-300 rounded-lg text-xs font-medium border border-gray-700 hover:bg-gray-700/50 transition flex items-center"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Subscription Management | Pulse Admin</title>
        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in-up {
            animation: fadeInUp 0.3s ease-out forwards;
          }
        `}</style>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 flex items-center">
            <span className="text-[#d7ff00] mr-2">
              <TrendingUp className="w-7 h-7" />
            </span>
            Subscription Management
          </h1>
          
          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Left gradient border */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Top Controls Area */}
            <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
              {/* Search */}
              <div className="flex-grow md:flex-grow-0 md:w-1/2">
                <label className="block text-gray-300 mb-2 text-sm font-medium">Search Subscriptions</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by subscription ID, user ID, or plan type"
                    className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              {/* Action Buttons */}
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => loadPage(false)}
                  className={`bg-[#262a30] text-white px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition flex items-center text-sm
                    ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={loading}
                >
                  <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={async () => {
                    try {
                      setToastMessage({ type: 'info', text: 'Backfilling usernames/emails...' });
                      await fetch('/.netlify/functions/backfill-subscription-user-fields', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ limit: 1000 })
                      });
                      await loadPage(false);
                      setToastMessage({ type: 'success', text: 'Backfill complete' });
                    } catch (e) {
                      setToastMessage({ type: 'error', text: 'Backfill failed' });
                    }
                  }}
                  className={`bg-blue-700/80 hover:bg-blue-600/80 text-white px-4 py-3 rounded-lg font-medium transition flex items-center text-sm`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3V10H6a2 2 0 01-2-2V4zm0 8a2 2 0 012-2h1v3a1 1 0 001.707.707L12.414 10H14a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z" clipRule="evenodd"/></svg>
                  Backfill User Fields
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <input
                className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                placeholder="Search by username"
                value={usernameSearch}
                onChange={e => setUsernameSearch(e.target.value)}
              />
              <input
                className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                placeholder="Filter by status (active, canceled, trialing, ...)"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              />
              <input
                className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                placeholder="Filter by platform (web, ios)"
                value={platformFilter}
                onChange={e => setPlatformFilter(e.target.value)}
              />
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-3 text-red-400 bg-red-900/20 p-4 rounded-lg border border-red-800">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Error loading subscriptions</p>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            )}

            {/* Subscriptions Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-[#262a30] rounded-lg overflow-hidden">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Subscription ID</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">User ID</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Username</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Email</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Platform</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Type</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Status</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Active</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Latest Expiration</th>
                    <th className="py-3 px-4 text-center text-gray-300 font-medium">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const latest = getLatestExpiration(row);
                    const activeState: 'unknown' | 'active' | 'expired' = !latest
                      ? 'unknown'
                      : (latest > new Date() ? 'active' : 'expired');
                    return (
                      <React.Fragment key={row.id}>
                        <tr className={`hover:bg-[#2a2f36] transition-colors ${
                          selectedSubscription?.id === row.id ? 'bg-[#1d2b3a]' : ''
                        }`}>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                            <button 
                              onClick={() => copyToClipboard(row.id)}
                              className="text-blue-400 hover:text-blue-300 font-mono text-sm"
                              title="Click to copy subscription ID"
                            >
                              {row.id.substring(0, 12)}...
                            </button>
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                            {row.userId ? (
                              <button 
                                onClick={() => copyToClipboard(row.userId)}
                                className="text-blue-400 hover:text-blue-300 font-mono text-sm"
                                title="Click to copy user ID"
                              >
                                {row.userId.substring(0, 8)}...
                              </button>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">{row.username || usernames[row.userId] || '-'}</td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">{row.userEmail || '-'}</td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">{row.platform || '-'}</td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">{row.subscriptionType || '-'}</td>
                          <td className="py-3 px-4 border-b border-gray-700">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              row.status === 'active' 
                                ? 'bg-green-900/30 text-green-400 border-green-900'
                                : row.status === 'canceled'
                                ? 'bg-red-900/30 text-red-400 border-red-900'
                                : 'bg-gray-900/30 text-gray-400 border-gray-700'
                            }`}>
                              {row.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700">
                            {activeState === 'active' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium border bg-green-900/30 text-green-400 border-green-900">Active</span>
                            )}
                            {activeState === 'expired' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium border bg-red-900/30 text-red-400 border-red-900">Expired</span>
                            )}
                            {activeState === 'unknown' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium border bg-gray-900/30 text-gray-300 border-gray-700">Unknown</span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300 text-sm">
                            {latest ? latest.toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-center">
                            <button
                              onClick={() => setSelectedSubscription(
                                selectedSubscription?.id === row.id ? null : row
                              )}
                              className={`px-2 py-1 rounded-lg text-xs font-medium border hover:bg-blue-800/40 transition-colors flex items-center mx-auto ${
                                selectedSubscription?.id === row.id 
                                  ? 'bg-blue-800/50 text-blue-300 border-blue-900' 
                                  : 'bg-blue-900/30 text-blue-400 border-blue-900'
                              }`}
                              title="View subscription details"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {selectedSubscription?.id === row.id ? 'Hide' : 'View'}
                            </button>
                          </td>
                        </tr>
                        {selectedSubscription?.id === row.id && (
                          <tr>
                            <td colSpan={9} className="p-0 border-b border-gray-700">
                  {renderSubscriptionDetails(row)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="text-gray-400 text-sm">
                Showing {filtered.length} of {subscriptions.length} subscriptions
              </div>
              {hasMore && (
                <button
                  className="px-4 py-2 bg-blue-700/80 hover:bg-blue-600/80 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                  disabled={loading}
                  onClick={() => loadPage(true)}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-4 right-4 py-2 px-4 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in-up z-50 ${
          toastMessage.type === 'success' 
            ? 'bg-green-800/90 border border-green-700 text-white' 
            : toastMessage.type === 'error'
              ? 'bg-red-800/90 border border-red-700 text-white'
              : 'bg-blue-800/90 border border-blue-700 text-white'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-300" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-red-300" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-300" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default SubscriptionsAdminPage;


