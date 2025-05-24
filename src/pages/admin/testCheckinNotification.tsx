import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { db } from '../../api/firebase/config'; // Firestore instance
import { collection, doc, setDoc, deleteDoc, getDocs, Timestamp, query, orderBy, limit, where } from 'firebase/firestore';
import { User, ShortUser } from '../../api/firebase/user/types';
import { SweatlistCollection, Challenge } from '../../api/firebase/workout/types'; // Added Challenge types
import { workoutService } from '../../api/firebase/workout/service'; // Added workoutService
import { Loader2, Search, CheckCircle, AlertTriangle, XCircle, User as UserIcon, AtSign, RefreshCw, ListChecks, ChevronDown, ChevronUp, Eye, Calendar, ChevronRight, Trash2 } from 'lucide-react'; // Added icons
import { v4 as uuidv4 } from 'uuid';

const USER_CACHE_KEY = 'adminAllUsersCache';
const CHALLENGE_CACHE_KEY = 'adminAllChallengesCache'; // Cache key for challenges

// Simplified Checkin structure for the test form
interface TestCheckinData {
  id: string;
  imageURL?: { downloadURL: string; gsURL: string; storagePath: string };
  caption: string;
  user: Record<string, any>; // Was ShortUser, now plain object from toDictionary()
  gym?: Record<string, any> | null;
  workoutSummary?: { workoutTitle?: string; id?: string };
  roundId?: string;
  dailyPrompt?: Record<string, any> | null;
  promptReply?: string | null;
  calloutUser?: Record<string, any>; // Was ShortUser, now plain object from toDictionary()
  calloutUserFCMToken?: string;
  challengeId?: string; // Added challengeId for the notification payload
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Interface for check-in records displayed in the table
interface CheckinRecord {
  id: string;
  caption: string;
  user: Record<string, any>;
  roundId?: string;
  challengeId?: string;
  calloutUser?: Record<string, any>;
  calloutUserFCMToken?: string;
  createdAt: Timestamp;
  workoutSummary?: {
    workoutTitle?: string;
    id?: string;
  };
  // Add other relevant fields
}

const TestCheckinNotificationPage: React.FC = () => {
  // Form State
  const [caption, setCaption] = useState('');
  const [mockWorkoutTitle, setMockWorkoutTitle] = useState('Test Workout Callout');
  // const [roundId, setRoundId] = useState('test-round-callout'); // Replaced by selectedChallenge.id

  // All Users State
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState(true);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);

  // All Challenges State
  const [allChallenges, setAllChallenges] = useState<SweatlistCollection[]>([]);
  const [isLoadingAllChallenges, setIsLoadingAllChallenges] = useState(true);
  const [isRefreshingChallenges, setIsRefreshingChallenges] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<SweatlistCollection | null>(null);
  const [challengeSearchQuery, setChallengeSearchQuery] = useState('');
  const [challengeSearchResults, setChallengeSearchResults] = useState<SweatlistCollection[]>([]);
  const challengeResultsRef = useRef<HTMLDivElement | null>(null);

  // User Search State
  const [challengerSearchQuery, setChallengerSearchQuery] = useState('');
  const [challengerSearchResults, setChallengerSearchResults] = useState<User[]>([]);
  const [selectedChallenger, setSelectedChallenger] = useState<User | null>(null);

  const [calloutUserSearchQuery, setCalloutUserSearchQuery] = useState('');
  const [calloutUserSearchResults, setCalloutUserSearchResults] = useState<User[]>([]);
  const [selectedCalloutUser, setSelectedCalloutUser] = useState<User | null>(null);

  const challengerResultsRef = useRef<HTMLDivElement | null>(null);
  const calloutUserResultsRef = useRef<HTMLDivElement | null>(null);

  // Add the new refs for the input fields
  const challengerInputRef = useRef<HTMLInputElement | null>(null);
  const calloutUserInputRef = useRef<HTMLInputElement | null>(null);
  const challengeInputRef = useRef<HTMLInputElement | null>(null);

  // Operation State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add new state for check-ins table
  const [allCheckins, setAllCheckins] = useState<CheckinRecord[]>([]);
  const [isLoadingCheckins, setIsLoadingCheckins] = useState(false);
  const [checkinLimit, setCheckinLimit] = useState(20);
  const [expandedCheckin, setExpandedCheckin] = useState<string | null>(null);
  const [checkinSearchQuery, setCheckinSearchQuery] = useState('');
  const [filteredCheckins, setFilteredCheckins] = useState<CheckinRecord[]>([]);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);

  const resetMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const fetchAndCacheUsers = useCallback(async (fromRefreshButton = false) => {
    if (!fromRefreshButton) setIsLoadingAllUsers(true);
    else setIsRefreshingUsers(true);

    console.log('[User Cache] Attempting to fetch users from Firestore...');
    try {
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      // Convert raw data to plain objects for caching, then instantiate User class
      const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(usersData));
      console.log(`[User Cache] ${usersData.length} users fetched from Firestore and cached in localStorage.`);
      
      const instantiatedUsers = usersData.map(data => new User(data.id, data));
      setAllUsers(instantiatedUsers);
      console.log('[User Cache] All users state updated with Firestore data:', instantiatedUsers);
      setErrorMessage(null);
      if (fromRefreshButton) setSuccessMessage("User list refreshed from Firestore.");
    } catch (error) {
      console.error('[User Cache] Error fetching users from Firestore:', error);
      setErrorMessage('Failed to fetch user list from Firestore. Previous cache (if any) might be used.');
      // Don't clear allUsers here if we want to fall back to potentially stale cache
    } finally {
      if (!fromRefreshButton) setIsLoadingAllUsers(false);
      else setIsRefreshingUsers(false);
    }
  }, []);

  // Effect to load users from cache or Firestore on mount
  useEffect(() => {
    console.log('[User Cache] Component did mount. Checking localStorage for cached users...');
    const cachedUsersJSON = localStorage.getItem(USER_CACHE_KEY);
    if (cachedUsersJSON) {
      try {
        const cachedUsersData = JSON.parse(cachedUsersJSON);
        const instantiatedUsers = cachedUsersData.map((data: any) => new User(data.id, data));
        setAllUsers(instantiatedUsers);
        setIsLoadingAllUsers(false);
        console.log('[User Cache] Loaded users from localStorage:', instantiatedUsers);
      } catch (e) {
        console.error("[User Cache] Error parsing users from localStorage, fetching from Firestore.", e);
        localStorage.removeItem(USER_CACHE_KEY); // Clear corrupted cache
        fetchAndCacheUsers();
      }
    } else {
      console.log('[User Cache] No users found in localStorage. Fetching from Firestore...');
      fetchAndCacheUsers();
    }
  }, [fetchAndCacheUsers]);
  
  const handleRefreshUserCache = () => {
    resetMessages();
    fetchAndCacheUsers(true);
  };

  const handleUserSearchLogic = useCallback((
    searchQuery: string,
    setResults: React.Dispatch<React.SetStateAction<User[]>>,
    inputName: string
  ) => {
    console.log(`[Search Logic - ${inputName}] Query: "${searchQuery}"`);
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    if (isLoadingAllUsers && allUsers.length === 0) {
      console.log(`[Search Logic - ${inputName}] Initial user list still loading.`);
      setResults([]);
      return;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredUsers = allUsers.filter(user =>
      (user.username?.toLowerCase().includes(lowerCaseQuery)) ||
      (user.displayName?.toLowerCase().includes(lowerCaseQuery)) ||
      (user.email?.toLowerCase().includes(lowerCaseQuery))
    ).slice(0, 10);
    console.log(`[Search Logic - ${inputName}] Filtered results:`, filteredUsers.map(u => u.username));
    setResults(filteredUsers);
  }, [allUsers, isLoadingAllUsers]);

  const handleChallengerQueryChange = useCallback((newQuery: string) => {
    setChallengerSearchQuery(newQuery);
    console.log(`[Typing - Challenger] Query changed to: "${newQuery}"`);
    handleUserSearchLogic(newQuery, setChallengerSearchResults, 'Challenger');
  }, [handleUserSearchLogic]);

  const handleCalloutUserQueryChange = useCallback((newQuery: string) => {
    setCalloutUserSearchQuery(newQuery);
    console.log(`[Typing - Callout User] Query changed to: "${newQuery}"`);
    handleUserSearchLogic(newQuery, setCalloutUserSearchResults, 'Callout User');
  }, [handleUserSearchLogic]);

  // Stable clear functions
  const handleClearChallengerSearch = useCallback(() => {
    setSelectedChallenger(null);
    setChallengerSearchQuery(''); // Directly set the query to empty
    setChallengerSearchResults([]); // Clear results immediately
  }, []); // Dependencies: setSelectedChallenger, setChallengerSearchQuery, setChallengerSearchResults (stable setters)

  const handleClearCalloutUserSearch = useCallback(() => {
    setSelectedCalloutUser(null);
    setCalloutUserSearchQuery('');
    setCalloutUserSearchResults([]);
  }, []);

  const handleClearChallengeSearch = useCallback(() => {
    setSelectedChallenge(null);
    setChallengeSearchQuery('');
    setChallengeSearchResults([]);
  }, []);

  // Effect to close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // For challenger search
      if (
        challengerResultsRef.current && 
        !challengerResultsRef.current.contains(event.target as Node) &&
        challengerInputRef.current !== event.target &&
        !challengerInputRef.current?.contains(event.target as Node)
      ) {
        setChallengerSearchResults([]);
      }
      
      // For callout user search
      if (
        calloutUserResultsRef.current && 
        !calloutUserResultsRef.current.contains(event.target as Node) &&
        calloutUserInputRef.current !== event.target &&
        !calloutUserInputRef.current?.contains(event.target as Node)
      ) {
        setCalloutUserSearchResults([]);
      }
      
      // For challenge search
      if (
        challengeResultsRef.current && 
        !challengeResultsRef.current.contains(event.target as Node) &&
        challengeInputRef.current !== event.target &&
        !challengeInputRef.current?.contains(event.target as Node)
      ) {
        setChallengeSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAndCacheChallenges = useCallback(async (fromRefreshButton = false) => {
    if (!fromRefreshButton) setIsLoadingAllChallenges(true);
    else setIsRefreshingChallenges(true);

    console.log('[Challenge Cache] Attempting to fetch challenges from Firestore...');
    try {
      const collections = await workoutService.fetchAllAdminCollections();
      // Convert to plain objects for caching, then instantiate SweatlistCollection class
      const challengesData = collections.map(c => c.toDictionary()); // Assuming toDictionary() exists and is appropriate
      
      localStorage.setItem(CHALLENGE_CACHE_KEY, JSON.stringify(challengesData));
      console.log(`[Challenge Cache] ${challengesData.length} challenges fetched and cached in localStorage.`);
      
      setAllChallenges(collections); // Already instantiated by fetchAllAdminCollections
      console.log('[Challenge Cache] All challenges state updated with Firestore data:', collections);
      setErrorMessage(null); // Clear any previous error message
      if (fromRefreshButton) setSuccessMessage("Challenge list refreshed from Firestore.");

    } catch (error) {
      console.error('[Challenge Cache] Error fetching challenges from Firestore:', error);
      setErrorMessage('Failed to fetch challenge list from Firestore. Previous cache (if any) might be used.');
    } finally {
      if (!fromRefreshButton) setIsLoadingAllChallenges(false);
      else setIsRefreshingChallenges(false);
    }
  }, []);

  useEffect(() => {
    console.log('[Challenge Cache] Component did mount. Checking localStorage for cached challenges...');
    const cachedChallengesJSON = localStorage.getItem(CHALLENGE_CACHE_KEY);
    if (cachedChallengesJSON) {
      try {
        const cachedData = JSON.parse(cachedChallengesJSON);
        // Ensure data is correctly revived into SweatlistCollection instances
        // This might require a static fromDictionary or similar if constructor needs specific handling for dates/nested objects
        const instantiatedChallenges = cachedData.map((data: any) => new SweatlistCollection(data));
        setAllChallenges(instantiatedChallenges);
        setIsLoadingAllChallenges(false);
        console.log('[Challenge Cache] Loaded challenges from localStorage:', instantiatedChallenges);
      } catch (e) {
        console.error("[Challenge Cache] Error parsing challenges from localStorage, fetching from Firestore.", e);
        localStorage.removeItem(CHALLENGE_CACHE_KEY); // Clear corrupted cache
        fetchAndCacheChallenges();
      }
    } else {
      console.log('[Challenge Cache] No challenges found in localStorage. Fetching from Firestore...');
      fetchAndCacheChallenges();
    }
  }, [fetchAndCacheChallenges]);

  const handleChallengeSearchLogic = useCallback((
    searchQuery: string,
    setResults: React.Dispatch<React.SetStateAction<SweatlistCollection[]>>,
  ) => {
    console.log(`[Challenge Search Logic] Query: "${searchQuery}"`);
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    if (isLoadingAllChallenges && allChallenges.length === 0) {
      console.log(`[Challenge Search Logic] Initial challenge list still loading.`);
      setResults([]);
      return;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredChallenges = allChallenges.filter(collection =>
      (collection.id.toLowerCase().includes(lowerCaseQuery)) ||
      (collection.challenge?.title?.toLowerCase().includes(lowerCaseQuery)) ||
      (collection.challenge?.status?.toLowerCase().includes(lowerCaseQuery))
    ).slice(0, 10);
    console.log(`[Challenge Search Logic] Filtered results:`, filteredChallenges.map(c => c.challenge?.title || c.id));
    setResults(filteredChallenges);
  }, [allChallenges, isLoadingAllChallenges]);

  const handleChallengeQueryChange = useCallback((newQuery: string) => {
    setChallengeSearchQuery(newQuery);
    console.log(`[Typing - Challenge] Query changed to: "${newQuery}"`);
    handleChallengeSearchLogic(newQuery, setChallengeSearchResults);
  }, [handleChallengeSearchLogic]);

  // Function to fetch check-ins from Firestore
  const fetchCheckins = useCallback(async () => {
    setIsLoadingCheckins(true);
    try {
      console.log('[Checkins] Fetching check-ins from Firestore...');
      const checkinsRef = collection(db, 'checkins');
      const checkinsQuery = query(checkinsRef, orderBy('createdAt', 'desc'), limit(checkinLimit));
      const querySnapshot = await getDocs(checkinsQuery);
      
      const checkinsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
        } as CheckinRecord;
      });
      
      setAllCheckins(checkinsData);
      setFilteredCheckins(checkinsData);
      console.log(`[Checkins] ${checkinsData.length} check-ins fetched from Firestore.`);
      setErrorMessage(null);
    } catch (error) {
      console.error('[Checkins] Error fetching check-ins from Firestore:', error);
      setErrorMessage('Failed to fetch check-ins from Firestore.');
    } finally {
      setIsLoadingCheckins(false);
    }
  }, [checkinLimit]);
  
  // Effect to fetch check-ins on mount
  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);
  
  // Function to filter check-ins based on search query
  useEffect(() => {
    if (!checkinSearchQuery.trim()) {
      setFilteredCheckins(allCheckins);
      return;
    }
    
    const lowerCaseQuery = checkinSearchQuery.toLowerCase();
    const filtered = allCheckins.filter(checkin => 
      checkin.id.toLowerCase().includes(lowerCaseQuery) ||
      checkin.caption.toLowerCase().includes(lowerCaseQuery) ||
      checkin.user?.username?.toLowerCase().includes(lowerCaseQuery) ||
      checkin.calloutUser?.username?.toLowerCase().includes(lowerCaseQuery) ||
      checkin.roundId?.toLowerCase().includes(lowerCaseQuery) ||
      checkin.challengeId?.toLowerCase().includes(lowerCaseQuery)
    );
    
    setFilteredCheckins(filtered);
  }, [checkinSearchQuery, allCheckins]);
  
  // Function to toggle expanded view for a check-in
  const toggleExpandedCheckin = (checkinId: string) => {
    if (expandedCheckin === checkinId) {
      setExpandedCheckin(null);
    } else {
      setExpandedCheckin(checkinId);
    }
  };

  // Function to delete a check-in
  const deleteCheckin = async (checkinId: string) => {
    if (!checkinId) return;
    
    setDeleteLoading(checkinId);
    setDeleteResult(null);
    
    try {
      console.log(`[Delete Checkin] Attempting to delete checkin: ${checkinId}`);
      
      // Delete the checkin document from Firestore
      await deleteDoc(doc(db, 'checkins', checkinId));
      
      console.log(`[Delete Checkin] Successfully deleted checkin: ${checkinId}`);
      
      setDeleteResult({
        success: true,
        message: `Check-in ${checkinId.substring(0, 8)}... deleted successfully`
      });
      
      // Refresh the checkins list
      await fetchCheckins();
      
      // Clear any expanded view if we deleted the expanded checkin
      if (expandedCheckin === checkinId) {
        setExpandedCheckin(null);
      }
      
      // Clear delete result message after 5 seconds
      setTimeout(() => {
        setDeleteResult(null);
      }, 5000);
      
    } catch (error) {
      console.error(`[Delete Checkin] Error deleting checkin ${checkinId}:`, error);
      setDeleteResult({
        success: false,
        message: `Failed to delete check-in: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      // Clear delete result message after 5 seconds
      setTimeout(() => {
        setDeleteResult(null);
      }, 5000);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!selectedChallenger || !selectedCalloutUser) {
      setErrorMessage('Please select both a challenger and a callout user.');
      return;
    }

    if (!selectedCalloutUser.fcmToken) {
      setErrorMessage(`Selected callout user (${selectedCalloutUser.username}) does not have an FCM token. Notification cannot be sent.`);
      return;
    }

    if (!selectedChallenge) {
      setErrorMessage('Please select a challenge for the notification.');
      return;
    }

    setIsSubmitting(true);
    const testCheckinId = `test_checkin_${uuidv4()}`;
    const now = Timestamp.now();

    const checkinData: TestCheckinData = {
      id: testCheckinId,
      imageURL: { 
        downloadURL: 'https://via.placeholder.com/150',
        gsURL: 'gs://placeholder/test_image.jpg',
        storagePath: 'test_images/test_image.jpg',
      },
      caption: caption.trim() || `Test callout from ${selectedChallenger.username} to ${selectedCalloutUser.username}`,
      user: selectedChallenger.toShortUser().toDictionary(),
      gym: null,
      workoutSummary: { 
        workoutTitle: mockWorkoutTitle,
        id: `test_summary_${uuidv4()}`
      },
      roundId: selectedChallenge.id, // This assumes SweatlistCollection ID is the round/challenge ID
      dailyPrompt: null,
      promptReply: null,
      calloutUser: selectedCalloutUser.toShortUser().toDictionary(),
      calloutUserFCMToken: selectedCalloutUser.fcmToken,
      challengeId: selectedChallenge.challenge?.id || selectedChallenge.id, // Prefer nested challenge.id if available
      createdAt: now,
      updatedAt: now,
    };

    console.log("[Submit] Creating test check-in (with plain objects for users and challengeId):", checkinData);
    try {
      const checkinRef = doc(db, 'checkins', testCheckinId);
      await setDoc(checkinRef, checkinData);
      setSuccessMessage(`Test check-in ${testCheckinId} created successfully. It will be auto-deleted in ~20 seconds.`);
      console.log(`[Submit] Test check-in ${testCheckinId} created successfully.`);

      // Auto-delete the test document after ~20 seconds
      setTimeout(async () => {
        try {
          await deleteDoc(doc(db, 'checkins', testCheckinId));
          console.log(`[Submit] Test check-in ${testCheckinId} deleted successfully after timeout.`);
          setSuccessMessage(prev => prev ? prev.replace('Cleaning up in ~20 seconds...', 'Cleanup complete.') : 'Test check-in created and then deleted.');
        } catch (deleteError) {
          console.error(`[Submit] Error deleting test check-in ${testCheckinId}:`, deleteError);
          setErrorMessage(`Failed to delete test check-in ${testCheckinId}. Please delete it manually.`);
        }
      }, 20000);

    } catch (error) {
      console.error('[Submit] Error creating test check-in:', error);
      setErrorMessage('Failed to create test check-in. See console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <AdminRouteGuard>
      <Head>
        <title>Test Check-in Callout Notification | Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-[#d7ff00] flex items-center">
              Test Check-in Callout Notification
            </h1>
            <div className="flex gap-2">
              <button
                onClick={handleRefreshUserCache}
                disabled={isLoadingAllUsers || isRefreshingUsers}
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-[#262a30] text-[#d7ff00] hover:bg-[#31363c] border border-gray-700 transition disabled:opacity-70"
              >
                {isRefreshingUsers ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw size={16} className="mr-2"/>}
                {isRefreshingUsers ? 'Refreshing Users...' : 'Refresh User List'}
              </button>
              <button
                onClick={() => fetchAndCacheChallenges(true)}
                disabled={isLoadingAllChallenges || isRefreshingChallenges}
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-[#262a30] text-[#d7ff00] hover:bg-[#31363c] border border-gray-700 transition disabled:opacity-70"
              >
                {isRefreshingChallenges ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw size={16} className="mr-2"/>}
                {isRefreshingChallenges ? 'Refreshing Challenges...' : 'Refresh Challenge List'}
              </button>
              <button
                onClick={fetchCheckins}
                disabled={isLoadingCheckins}
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-[#262a30] text-[#d7ff00] hover:bg-[#31363c] border border-gray-700 transition disabled:opacity-70"
              >
                {isLoadingCheckins ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw size={16} className="mr-2"/>}
                {isLoadingCheckins ? 'Refreshing Check-ins...' : 'Refresh Check-ins'}
              </button>
            </div>
          </div>
          
          {(isLoadingAllUsers && allUsers.length === 0) && (
            <div className="my-4 p-3 bg-blue-900/30 text-blue-400 border border-blue-700 rounded-lg flex items-center animate-fadeIn">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading initial user list from cache/Firestore...
            </div>
          )}
          {(isLoadingAllChallenges && allChallenges.length === 0) && (
            <div className="my-4 p-3 bg-purple-900/30 text-purple-400 border border-purple-700 rounded-lg flex items-center animate-fadeIn">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading initial challenge list from cache/Firestore...
            </div>
          )}

          <div className="bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              <UserSearchInput 
                label="Challenger User (Performing Check-in)"
                searchQuery={challengerSearchQuery}
                onQueryChange={handleChallengerQueryChange}
                searchResults={challengerSearchResults}
                setSelectedUser={setSelectedChallenger}
                selectedUser={selectedChallenger}
                isOverallLoading={isLoadingAllUsers || isRefreshingUsers}
                resultsRef={challengerResultsRef}
                inputRef={challengerInputRef}
                clearSelectedUserAndQuery={handleClearChallengerSearch}
                allUsersCount={allUsers.length}
              />

              <UserSearchInput 
                label="Callout User (Receiving Notification)"
                searchQuery={calloutUserSearchQuery}
                onQueryChange={handleCalloutUserQueryChange}
                searchResults={calloutUserSearchResults}
                setSelectedUser={setSelectedCalloutUser}
                selectedUser={selectedCalloutUser}
                isOverallLoading={isLoadingAllUsers || isRefreshingUsers}
                resultsRef={calloutUserResultsRef}
                inputRef={calloutUserInputRef}
                clearSelectedUserAndQuery={handleClearCalloutUserSearch}
                allUsersCount={allUsers.length}
              />

              <ChallengeSearchInput
                label="Challenge to Link (for Notification Click)"
                searchQuery={challengeSearchQuery}
                onQueryChange={handleChallengeQueryChange}
                searchResults={challengeSearchResults}
                setSelectedChallenge={setSelectedChallenge}
                selectedChallenge={selectedChallenge}
                isOverallLoading={isLoadingAllChallenges || isRefreshingChallenges}
                resultsRef={challengeResultsRef}
                inputRef={challengeInputRef}
                clearSelectedChallengeAndQuery={handleClearChallengeSearch}
                allChallengesCount={allChallenges.length}
              />

              <div>
                <label htmlFor="caption" className="block text-gray-300 mb-2 text-sm font-medium">Caption (Optional)</label>
                <textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="E.g., Great workout today! Calling you out!"
                  rows={3}
                  className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                />
              </div>
              
              <div>
                <label htmlFor="mockWorkoutTitle" className="block text-gray-300 mb-2 text-sm font-medium">Mock Workout Title</label>
                 <input
                  id="mockWorkoutTitle"
                  type="text"
                  value={mockWorkoutTitle}
                  onChange={(e) => setMockWorkoutTitle(e.target.value)}
                  className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (isLoadingAllUsers && allUsers.length === 0) || isRefreshingUsers || 
                          (isLoadingAllChallenges && allChallenges.length === 0) || isRefreshingChallenges || 
                          !selectedChallenger || !selectedCalloutUser || !selectedCalloutUser.fcmToken || !selectedChallenge}
                className="w-full flex justify-center items-center px-4 py-3 rounded-lg font-medium bg-[#d7ff00] text-black hover:bg-[#b8cc00] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(isSubmitting || (isLoadingAllUsers && allUsers.length === 0) || isRefreshingUsers || (isLoadingAllChallenges && allChallenges.length === 0) || isRefreshingChallenges) ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
                Send Test Check-in & Notify
              </button>
              
              {successMessage && (
                <div className="mt-4 p-3 bg-green-900/30 text-green-400 border border-green-700 rounded-lg flex items-center animate-fadeIn">
                  <CheckCircle size={20} className="mr-2" /> {successMessage}
                </div>
              )}
              {errorMessage && (
                <div className="mt-4 p-3 bg-red-900/30 text-red-400 border border-red-700 rounded-lg flex items-center animate-fadeIn">
                  <AlertTriangle size={20} className="mr-2" /> {errorMessage}
                </div>
              )}
            </form>
          </div>
          
          {/* Check-ins Table */}
          <div className="bg-[#1a1e24] rounded-xl p-6 shadow-xl mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#d7ff00]">Recent Check-ins</h2>
              <div className="flex items-center">
                <div className="relative flex-1 mr-2">
                  <input
                    type="text"
                    value={checkinSearchQuery}
                    onChange={(e) => setCheckinSearchQuery(e.target.value)}
                    placeholder="Search check-ins..."
                    className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                  />
                  <Search size={16} className="absolute right-3 top-3 text-gray-500" />
                </div>
                <select 
                  value={checkinLimit}
                  onChange={(e) => setCheckinLimit(Number(e.target.value))}
                  className="bg-[#262a30] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white"
                >
                  <option value={10}>10 rows</option>
                  <option value={20}>20 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </div>
            </div>
            
            {isLoadingCheckins ? (
              <div className="flex justify-center p-10">
                <Loader2 size={30} className="animate-spin text-[#d7ff00]" />
              </div>
            ) : filteredCheckins.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-700 text-left text-gray-400 text-sm">
                      <th className="p-3"></th>
                      <th className="p-3">ID</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Callout User</th>
                      <th className="p-3">Challenge ID</th>
                      <th className="p-3">FCM Token</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCheckins.map((checkin) => (
                      <React.Fragment key={checkin.id}>
                        <tr 
                          className={`border-b border-gray-800 hover:bg-[#262a30] ${expandedCheckin === checkin.id ? 'bg-[#262a30]' : ''}`}
                        >
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleExpandedCheckin(checkin.id)}
                              className="text-gray-500 hover:text-[#d7ff00] transition"
                            >
                              {expandedCheckin === checkin.id ? (
                                <ChevronUp size={16} className="text-[#d7ff00]" />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          </td>
                          <td className="p-3 font-mono text-sm text-gray-300">{checkin.id.substring(0, 10)}...</td>
                          <td className="p-3">{checkin.user?.username || 'N/A'}</td>
                          <td className="p-3">{checkin.calloutUser?.username || 'None'}</td>
                          <td className="p-3 font-mono text-sm text-gray-300">
                            {checkin.challengeId ? checkin.challengeId.substring(0, 8) + '...' : 'None'}
                          </td>
                          <td className="p-3">
                            {checkin.calloutUserFCMToken ? (
                              <CheckCircle size={16} className="text-green-500" />
                            ) : (
                              <XCircle size={16} className="text-red-500" />
                            )}
                          </td>
                          <td className="p-3 text-sm text-gray-300">
                            {checkin.createdAt && checkin.createdAt.toDate 
                              ? checkin.createdAt.toDate().toLocaleString() 
                              : 'Invalid date'}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Are you sure you want to delete check-in ${checkin.id.substring(0, 8)}...?`)) {
                                  deleteCheckin(checkin.id);
                                }
                              }}
                              disabled={deleteLoading === checkin.id}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 transition text-white"
                              title="Delete check-in"
                            >
                              {deleteLoading === checkin.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </td>
                        </tr>
                        {expandedCheckin === checkin.id && (
                          <tr className="bg-[#262a30]">
                            <td colSpan={8} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-[#d7ff00] font-medium mb-2">Basic Info</h4>
                                  <div className="space-y-2 text-sm">
                                    <div><span className="text-gray-400">ID:</span> {checkin.id}</div>
                                    <div><span className="text-gray-400">Caption:</span> {checkin.caption || 'None'}</div>
                                    <div><span className="text-gray-400">Round ID:</span> {checkin.roundId || 'None'}</div>
                                    <div><span className="text-gray-400">Challenge ID:</span> {checkin.challengeId || 'None'}</div>
                                    {checkin.workoutSummary && (
                                      <div>
                                        <span className="text-gray-400">Workout:</span> {checkin.workoutSummary.workoutTitle || 'N/A'} 
                                        {checkin.workoutSummary.id && <span className="text-xs text-gray-500 ml-1">({checkin.workoutSummary.id})</span>}
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-gray-400">Created:</span> {checkin.createdAt && checkin.createdAt.toDate 
                                        ? checkin.createdAt.toDate().toLocaleString() 
                                        : 'Invalid date'}
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-[#d7ff00] font-medium mb-2">User Info</h4>
                                  <div className="space-y-2 text-sm">
                                    <div><span className="text-gray-400">User:</span> {checkin.user?.username || 'N/A'} {checkin.user?.displayName ? `(${checkin.user.displayName})` : ''}</div>
                                    <div><span className="text-gray-400">User ID:</span> {checkin.user?.id || 'N/A'}</div>
                                    {checkin.calloutUser && (
                                      <>
                                        <div className="border-t border-gray-700 pt-2 mt-2"></div>
                                        <div><span className="text-gray-400">Callout User:</span> {checkin.calloutUser?.username || 'None'} {checkin.calloutUser?.displayName ? `(${checkin.calloutUser.displayName})` : ''}</div>
                                        <div><span className="text-gray-400">Callout User ID:</span> {checkin.calloutUser?.id || 'None'}</div>
                                        <div>
                                          <span className="text-gray-400">FCM Token:</span> 
                                          {checkin.calloutUserFCMToken ? (
                                            <span className="text-green-500 font-medium ml-1">Present</span>
                                          ) : (
                                            <span className="text-red-500 font-medium ml-1">Missing</span>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Raw Data Section */}
                              <div className="mt-4">
                                <details className="text-sm">
                                  <summary className="cursor-pointer text-gray-400 hover:text-white focus:outline-none py-1">
                                    <span className="flex items-center">
                                      <ChevronRight size={16} className="mr-1" />
                                      View Raw Data
                                    </span>
                                  </summary>
                                  <pre className="mt-2 p-3 bg-[#1f2327] rounded overflow-x-auto text-xs text-gray-300">
                                    {JSON.stringify(checkin, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                {checkinSearchQuery ? (
                  <>No check-ins match your search query "<span className="text-white">{checkinSearchQuery}</span>".</>
                ) : (
                  <>No check-ins found. Try refreshing or increasing the limit.</>
                )}
              </div>
            )}
            
            <div className="mt-4 text-right text-sm text-gray-400">
              Showing {filteredCheckins.length} of {allCheckins.length} check-ins
              {checkinSearchQuery && <span> (filtered by search)</span>}
            </div>
            
            {/* Delete result message */}
            {deleteResult && (
              <div className={`mt-4 p-3 border rounded-lg flex items-center animate-fadeIn ${
                deleteResult.success 
                  ? 'bg-green-900/30 text-green-400 border-green-700' 
                  : 'bg-red-900/30 text-red-400 border-red-700'
              }`}>
                {deleteResult.success ? (
                  <CheckCircle size={20} className="mr-2" />
                ) : (
                  <AlertTriangle size={20} className="mr-2" />
                )}
                {deleteResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AdminRouteGuard>
  );
};

export default TestCheckinNotificationPage;

/* UserSearchInput.tsx (or above TestCheckinNotificationPage) */
export interface UserSearchInputProps {
  label: string;
  searchQuery: string;
  onQueryChange: (newQuery: string) => void;
  searchResults: User[];
  setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>;
  selectedUser: User | null;
  isOverallLoading: boolean;
  resultsRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  clearSelectedUserAndQuery: () => void;
  allUsersCount: number;
}

export const UserSearchInput: React.FC<UserSearchInputProps> = React.memo(({
  label,
  searchQuery,
  onQueryChange,
  searchResults,
  setSelectedUser,
  selectedUser,
  isOverallLoading,
  resultsRef,
  inputRef,
  clearSelectedUserAndQuery,
  allUsersCount
}) => {
  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    onQueryChange('');
  };

  return (
    <div>
      <label className="block text-gray-300 mb-2 text-sm font-medium">{label}</label>
      {selectedUser ? (
        <div className="flex items-center w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 text-white">
          <UserIcon size={18} className="mr-2 text-[#d7ff00]" />
          <span className="flex-1">{selectedUser.displayName || selectedUser.username}</span>
          {selectedUser.fcmToken && <AtSign size={16} className="ml-2 text-green-500" aria-label="FCM Token Present"/>}
          <button type="button" onClick={clearSelectedUserAndQuery} className="ml-2 text-gray-400 hover:text-white">
            <XCircle size={18} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center w-full bg-[#262a30] border border-gray-700 rounded-lg overflow-hidden">
            <input
              type="text"
              ref={inputRef} 
              value={searchQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={`Search for ${label.toLowerCase()}...`}
              className="flex-1 bg-transparent px-4 py-3 focus:outline-none text-white placeholder-gray-500"
              disabled={isOverallLoading && allUsersCount === 0}
            />
            {(isOverallLoading && allUsersCount === 0) && (
              <div className="px-4 py-3"><Loader2 className="animate-spin h-5 w-5 text-gray-400" /></div>
            )}
          </div>
          {searchResults.length > 0 && (
            <div ref={resultsRef} className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-[#262a30] border border-gray-700 rounded-lg shadow-lg">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="p-3 hover:bg-[#31363c] cursor-pointer border-b border-gray-700 last:border-b-0"
                >
                  <div className="text-white font-medium">{user.displayName || user.username}</div>
                  <div className="text-gray-400 text-xs">{user.email} {user.fcmToken ? "(Has FCM)" : "(No FCM)"}</div>
                </div>
              ))}
            </div>
          )}
          {(searchQuery && searchResults.length === 0 && !(isOverallLoading && allUsersCount === 0)) && (
            <div className="absolute z-10 w-full mt-1 bg-[#262a30] border border-gray-700 rounded-lg shadow-lg p-3 text-gray-400 text-sm">
              No users found matching "{searchQuery}".
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/* ChallengeSearchInput.tsx (or above TestCheckinNotificationPage) */
export interface ChallengeSearchInputProps {
  label: string;
  searchQuery: string;
  onQueryChange: (newQuery: string) => void;
  searchResults: SweatlistCollection[];
  setSelectedChallenge: React.Dispatch<React.SetStateAction<SweatlistCollection | null>>;
  selectedChallenge: SweatlistCollection | null;
  isOverallLoading: boolean;
  resultsRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  clearSelectedChallengeAndQuery: () => void;
  allChallengesCount: number;
}

export const ChallengeSearchInput: React.FC<ChallengeSearchInputProps> = React.memo(({
  label,
  searchQuery,
  onQueryChange,
  searchResults,
  setSelectedChallenge,
  selectedChallenge,
  isOverallLoading,
  resultsRef,
  inputRef,
  clearSelectedChallengeAndQuery,
  allChallengesCount
}) => {
  const handleSelectChallenge = (challenge: SweatlistCollection) => {
    setSelectedChallenge(challenge);
    onQueryChange('');
  };

  return (
    <div>
      <label className="block text-gray-300 mb-2 text-sm font-medium">{label}</label>
      {selectedChallenge ? (
        <div className="flex items-center w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 text-white">
          <ListChecks size={18} className="mr-2 text-[#d7ff00]" />
          <span className="flex-1">{selectedChallenge.challenge?.title || selectedChallenge.id} (Status: {selectedChallenge.challenge?.status || 'N/A'})</span>
          <button type="button" onClick={clearSelectedChallengeAndQuery} className="ml-2 text-gray-400 hover:text-white">
            <XCircle size={18} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center w-full bg-[#262a30] border border-gray-700 rounded-lg overflow-hidden">
            <input
              type="text"
              ref={inputRef} 
              value={searchQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={`Search for ${label.toLowerCase()} by title, ID, or status...`}
              className="flex-1 bg-transparent px-4 py-3 focus:outline-none text-white placeholder-gray-500"
              disabled={isOverallLoading && allChallengesCount === 0}
            />
            {(isOverallLoading && allChallengesCount === 0) && (
              <div className="px-4 py-3"><Loader2 className="animate-spin h-5 w-5 text-gray-400" /></div>
            )}
          </div>
          {searchResults.length > 0 && (
            <div ref={resultsRef} className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-[#262a30] border border-gray-700 rounded-lg shadow-lg">
              {searchResults.map((challengeColl) => (
                <div
                  key={challengeColl.id}
                  onClick={() => handleSelectChallenge(challengeColl)}
                  className="p-3 hover:bg-[#31363c] cursor-pointer border-b border-gray-700 last:border-b-0"
                >
                  <div className="text-white font-medium">{challengeColl.challenge?.title || challengeColl.id}</div>
                  <div className="text-gray-400 text-xs">ID: {challengeColl.id} | Status: {challengeColl.challenge?.status || 'N/A'}</div>
                </div>
              ))}
            </div>
          )}
          {(searchQuery && searchResults.length === 0 && !(isOverallLoading && allChallengesCount === 0)) && (
            <div className="absolute z-10 w-full mt-1 bg-[#262a30] border border-gray-700 rounded-lg shadow-lg p-3 text-gray-400 text-sm">
              No challenges found matching "{searchQuery}".
            </div>
          )}
        </div>
      )}
    </div>
  );
}); 