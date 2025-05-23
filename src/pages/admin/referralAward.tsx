import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { db } from '../../api/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { User } from '../../api/firebase/user/types';
import { SweatlistCollection } from '../../api/firebase/workout/types';
import { workoutService } from '../../api/firebase/workout/service';
import { Loader2, Search, CheckCircle, AlertTriangle, XCircle, User as UserIcon, AtSign, RefreshCw, ListChecks, Users, Gift } from 'lucide-react';

const USER_CACHE_KEY = 'adminAllUsersCache';
const CHALLENGE_CACHE_KEY = 'adminAllChallengesCache';

// Import components from testCheckinNotification
interface UserSearchInputProps {
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

interface ChallengeSearchInputProps {
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

const UserSearchInput: React.FC<UserSearchInputProps> = React.memo(({
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

const ChallengeSearchInput: React.FC<ChallengeSearchInputProps> = React.memo(({
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

const ReferralAwardPage: React.FC = () => {
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

  // User Search State for Referrer
  const [referrerSearchQuery, setReferrerSearchQuery] = useState('');
  const [referrerSearchResults, setReferrerSearchResults] = useState<User[]>([]);
  const [selectedReferrer, setSelectedReferrer] = useState<User | null>(null);

  // User Search State for Referee
  const [refereeSearchQuery, setRefereeSearchQuery] = useState('');
  const [refereeSearchResults, setRefereeSearchResults] = useState<User[]>([]);
  const [selectedReferee, setSelectedReferee] = useState<User | null>(null);

  const referrerResultsRef = useRef<HTMLDivElement | null>(null);
  const refereeResultsRef = useRef<HTMLDivElement | null>(null);

  // Input refs
  const referrerInputRef = useRef<HTMLInputElement | null>(null);
  const refereeInputRef = useRef<HTMLInputElement | null>(null);
  const challengeInputRef = useRef<HTMLInputElement | null>(null);

  // Operation State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const usersData = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(usersData));
      console.log(`[User Cache] ${usersData.length} users fetched from Firestore and cached in localStorage.`);
      
      const instantiatedUsers = usersData.map((data: any) => new User(data.id, data));
      setAllUsers(instantiatedUsers);
      console.log('[User Cache] All users state updated with Firestore data:', instantiatedUsers);
      setErrorMessage(null);
      if (fromRefreshButton) setSuccessMessage("User list refreshed from Firestore.");
    } catch (error) {
      console.error('[User Cache] Error fetching users from Firestore:', error);
      setErrorMessage('Failed to fetch user list from Firestore. Previous cache (if any) might be used.');
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
        localStorage.removeItem(USER_CACHE_KEY);
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

  const handleReferrerQueryChange = useCallback((newQuery: string) => {
    setReferrerSearchQuery(newQuery);
    console.log(`[Typing - Referrer] Query changed to: "${newQuery}"`);
    handleUserSearchLogic(newQuery, setReferrerSearchResults, 'Referrer');
  }, [handleUserSearchLogic]);

  const handleRefereeQueryChange = useCallback((newQuery: string) => {
    setRefereeSearchQuery(newQuery);
    console.log(`[Typing - Referee] Query changed to: "${newQuery}"`);
    handleUserSearchLogic(newQuery, setRefereeSearchResults, 'Referee');
  }, [handleUserSearchLogic]);

  // Clear functions
  const handleClearReferrerSearch = useCallback(() => {
    setSelectedReferrer(null);
    setReferrerSearchQuery('');
    setReferrerSearchResults([]);
  }, []);

  const handleClearRefereeSearch = useCallback(() => {
    setSelectedReferee(null);
    setRefereeSearchQuery('');
    setRefereeSearchResults([]);
  }, []);

  const handleClearChallengeSearch = useCallback(() => {
    setSelectedChallenge(null);
    setChallengeSearchQuery('');
    setChallengeSearchResults([]);
  }, []);

  // Challenge logic
  const fetchAndCacheChallenges = useCallback(async (fromRefreshButton = false) => {
    if (!fromRefreshButton) setIsLoadingAllChallenges(true);
    else setIsRefreshingChallenges(true);

    console.log('[Challenge Cache] Attempting to fetch challenges from Firestore...');
    try {
      const collections = await workoutService.fetchAllAdminCollections();
      const challengesData = collections.map(c => c.toDictionary());
      
      localStorage.setItem(CHALLENGE_CACHE_KEY, JSON.stringify(challengesData));
      console.log(`[Challenge Cache] ${challengesData.length} challenges fetched and cached in localStorage.`);
      
      setAllChallenges(collections);
      console.log('[Challenge Cache] All challenges state updated with Firestore data:', collections);
      setErrorMessage(null);
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
        const instantiatedChallenges = cachedData.map((data: any) => new SweatlistCollection(data));
        setAllChallenges(instantiatedChallenges);
        setIsLoadingAllChallenges(false);
        console.log('[Challenge Cache] Loaded challenges from localStorage:', instantiatedChallenges);
      } catch (e) {
        console.error("[Challenge Cache] Error parsing challenges from localStorage, fetching from Firestore.", e);
        localStorage.removeItem(CHALLENGE_CACHE_KEY);
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

  // Effect to close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        referrerResultsRef.current && 
        !referrerResultsRef.current.contains(event.target as Node) &&
        referrerInputRef.current !== event.target &&
        !referrerInputRef.current?.contains(event.target as Node)
      ) {
        setReferrerSearchResults([]);
      }
      
      if (
        refereeResultsRef.current && 
        !refereeResultsRef.current.contains(event.target as Node) &&
        refereeInputRef.current !== event.target &&
        !refereeInputRef.current?.contains(event.target as Node)
      ) {
        setRefereeSearchResults([]);
      }
      
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!selectedReferrer || !selectedReferee || !selectedChallenge) {
      setErrorMessage('Please select a referrer, referee, and challenge.');
      return;
    }

    if (selectedReferrer.id === selectedReferee.id) {
      setErrorMessage('Referrer and referee cannot be the same person.');
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8888/.netlify/functions'
        : 'https://fitwithpulse.ai/.netlify/functions';

      console.log(`[Submit] Linking referral: ${selectedReferrer.username} -> ${selectedReferee.username} in challenge ${selectedChallenge.challenge?.title}`);
      
      const response = await fetch(`${apiUrl}/link-referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referrerId: selectedReferrer.id,
          referrerUsername: selectedReferrer.username,
          refereeId: selectedReferee.id,
          refereeUsername: selectedReferee.username,
          challengeId: selectedChallenge.id,
          challengeTitle: selectedChallenge.challenge?.title || selectedChallenge.id
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccessMessage(`Successfully linked referral! ${selectedReferrer.username} has been awarded 25 points and notified.`);
        console.log(`[Submit] Successfully linked referral for ${selectedReferrer.username} -> ${selectedReferee.username}`);
        
        // Clear form
        setSelectedReferrer(null);
        setSelectedReferee(null);
        setSelectedChallenge(null);
        setReferrerSearchQuery('');
        setRefereeSearchQuery('');
        setChallengeSearchQuery('');
      } else {
        setErrorMessage(result.error || 'Failed to link referral. Please try again.');
        console.error('[Submit] Error linking referral:', result.error);
      }

    } catch (error) {
      console.error('[Submit] Error linking referral:', error);
      setErrorMessage('Failed to link referral. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Referral Award | Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-[#d7ff00] flex items-center">
              <Gift className="mr-3" size={28} />
              Manual Referral Award
            </h1>
            <div className="flex gap-2">
              <button
                onClick={handleRefreshUserCache}
                disabled={isLoadingAllUsers || isRefreshingUsers}
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-[#262a30] text-[#d7ff00] hover:bg-[#31363c] border border-gray-700 transition disabled:opacity-70"
              >
                {isRefreshingUsers ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw size={16} className="mr-2"/>}
                {isRefreshingUsers ? 'Refreshing Users...' : 'Refresh Users'}
              </button>
              <button
                onClick={() => fetchAndCacheChallenges(true)}
                disabled={isLoadingAllChallenges || isRefreshingChallenges}
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-[#262a30] text-[#d7ff00] hover:bg-[#31363c] border border-gray-700 transition disabled:opacity-70"
              >
                {isRefreshingChallenges ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw size={16} className="mr-2"/>}
                {isRefreshingChallenges ? 'Refreshing Challenges...' : 'Refresh Challenges'}
              </button>
            </div>
          </div>

          <div className="bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl">
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
              <h3 className="text-blue-400 font-medium mb-2">ℹ️ How This Works</h3>
              <p className="text-blue-200 text-sm">
                This tool manually links referrals for cases where the referral chain wasn't properly set up. 
                Select the person who shared the link (referrer), the person who joined (referee), and the challenge. 
                This will update the referee's referral chain and award 25 points to the referrer with a notification.
              </p>
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

            <form onSubmit={handleSubmit} className="space-y-5">
              <UserSearchInput 
                label="Referrer (Person who shared the link)"
                searchQuery={referrerSearchQuery}
                onQueryChange={handleReferrerQueryChange}
                searchResults={referrerSearchResults}
                setSelectedUser={setSelectedReferrer}
                selectedUser={selectedReferrer}
                isOverallLoading={isLoadingAllUsers || isRefreshingUsers}
                resultsRef={referrerResultsRef}
                inputRef={referrerInputRef}
                clearSelectedUserAndQuery={handleClearReferrerSearch}
                allUsersCount={allUsers.length}
              />

              <UserSearchInput 
                label="Referee (Person who joined using the link)"
                searchQuery={refereeSearchQuery}
                onQueryChange={handleRefereeQueryChange}
                searchResults={refereeSearchResults}
                setSelectedUser={setSelectedReferee}
                selectedUser={selectedReferee}
                isOverallLoading={isLoadingAllUsers || isRefreshingUsers}
                resultsRef={refereeResultsRef}
                inputRef={refereeInputRef}
                clearSelectedUserAndQuery={handleClearRefereeSearch}
                allUsersCount={allUsers.length}
              />

              <ChallengeSearchInput
                label="Challenge"
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

              {selectedReferrer && selectedReferee && selectedChallenge && (
                <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                  <h4 className="text-green-400 font-medium mb-2">✅ Ready to Process</h4>
                  <p className="text-green-200 text-sm">
                    <strong>{selectedReferrer.username}</strong> will be awarded 25 points for referring{' '}
                    <strong>{selectedReferee.username}</strong> to the challenge{' '}
                    <strong>"{selectedChallenge.challenge?.title || selectedChallenge.id}"</strong>.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !selectedReferrer || !selectedReferee || !selectedChallenge ||
                          (isLoadingAllUsers && allUsers.length === 0) || isRefreshingUsers || 
                          (isLoadingAllChallenges && allChallenges.length === 0) || isRefreshingChallenges}
                className="w-full flex justify-center items-center px-4 py-3 rounded-lg font-medium bg-[#d7ff00] text-black hover:bg-[#b8cc00] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Gift className="h-5 w-5 mr-2" />}
                {isSubmitting ? 'Linking Referral...' : 'Link Referral & Award Points'}
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

export default ReferralAwardPage; 