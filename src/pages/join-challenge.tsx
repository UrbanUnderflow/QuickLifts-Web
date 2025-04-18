import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { workoutService } from '../api/firebase/workout/service';
import { userService } from '../api/firebase/user';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../api/firebase/config';
import SignInModal from '../components/SignInModal';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../api/firebase/config';
import { ProfileImage } from '../api/firebase/user/types';
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../utils/formatDate';

// Define type for the challenge info
interface ChallengeInfo {
  id: string;
  title: string;
  subtitle: string;
  startDate: Date | null;
  endDate: Date | null;
  originalId?: string;
  createdAt?: Date;
}

// Define type for user info
interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  email: string;
  profileImage?: ProfileImage;
}

// Define type for search result
interface ChallengeSearchResult extends ChallengeInfo {
  displayName: string;
  cohortNumber?: number;
}

export default function JoinChallengePage() {
  const [username, setUsername] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [challengeSearch, setChallengeSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingChallenges, setIsSearchingChallenges] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [challengeInfo, setChallengeInfo] = useState<ChallengeInfo | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [userError, setUserError] = useState('');
  const [searchResults, setSearchResults] = useState<ChallengeSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [useManualId, setUseManualId] = useState(false);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Track if user is signed in
  const [isSignedIn, setIsSignedIn] = useState(false);
  // Control whether to show the sign-in modal
  const [isSignInModalVisible, setIsSignInModalVisible] = useState(false);

  const router = useRouter();

  /**
   * Monitor auth changes
   * If there's a user, fetch Firestore user data & set it.
   * If not, set `isSignedIn` to false & show the SignInModal.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const firestoreUser = await userService.fetchUserFromFirestore(user.uid);
          userService.currentUser = firestoreUser;
          console.log('User data fetched and set:', firestoreUser);
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Error loading user data');
        }
      } else {
        userService.currentUser = null;
        setIsSignedIn(false);
        setIsSignInModalVisible(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle clicks outside of the search results dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Function to search challenges by title
  const searchChallengesByTitle = async (searchText: string) => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearchingChallenges(true);
      
      // Create a query to search for challenges by title
      const challengesRef = collection(db, 'sweatlist-collection');
      
      // We'll get all challenges and filter on the client side
      // since Firestore doesn't have great partial text search capabilities
      const snapshot = await getDocs(challengesRef);
      
      if (snapshot.empty) {
        setSearchResults([]);
        return;
      }

      // Filter challenges where title contains the search text (case insensitive)
      const filteredChallenges = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          const title = data.challenge?.title || '';
          return title.toLowerCase().includes(searchText.toLowerCase());
        })
        .map(doc => {
          const data = doc.data();
          const startDateValue = data.challenge?.startDate;
          const endDateValue = data.challenge?.endDate;
          const createdAtValue = data.createdAt;
          
          return {
            id: doc.id,
            title: data.challenge?.title || 'Untitled Challenge',
            subtitle: data.challenge?.subtitle || '',
            originalId: data.originalId || doc.id,
            startDate: convertFirestoreTimestamp(startDateValue),
            endDate: convertFirestoreTimestamp(endDateValue),
            createdAt: convertFirestoreTimestamp(createdAtValue),
            displayName: data.challenge?.title || 'Untitled Challenge',
          };
        });

      // First, group challenges by originalId for cohort calculation
      const challengesByOriginalId: { [key: string]: ChallengeSearchResult[] } = {};
      
      filteredChallenges.forEach(challenge => {
        const originalId = challenge.originalId || challenge.id;
        if (!challengesByOriginalId[originalId]) {
          challengesByOriginalId[originalId] = [];
        }
        challengesByOriginalId[originalId].push(challenge);
      });

      // For each group, calculate cohort numbers
      const challengesWithCohortNumbers: ChallengeSearchResult[] = [];
      
      Object.values(challengesByOriginalId).forEach(challenges => {
        // Sort by createdAt, then by id for tie-breaker (same as iOS implementation)
        const sortedChallenges = challenges.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            if (a.createdAt < b.createdAt) return -1;
            if (a.createdAt > b.createdAt) return 1;
          }
          return a.id < b.id ? -1 : 1;
        });
        
        // Assign cohort numbers
        sortedChallenges.forEach((challenge, index) => {
          const cohortNumber = index + 1;
          
          // Update display name if it's part of a cohort
          let displayName = challenge.title;
          if (sortedChallenges.length > 1) {
            displayName = `${challenge.title}-Round #${cohortNumber}`;
          }
          
          challengesWithCohortNumbers.push({
            ...challenge,
            displayName,
            cohortNumber: sortedChallenges.length > 1 ? cohortNumber : undefined
          });
        });
      });

      // Limit results to top 10
      setSearchResults(challengesWithCohortNumbers.slice(0, 10));
    } catch (err) {
      console.error('Error searching challenges:', err);
      setSearchResults([]);
    } finally {
      setIsSearchingChallenges(false);
    }
  };

  // Debounced challenge search
  const handleChallengeSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setChallengeSearch(value);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      searchChallengesByTitle(value);
    }, 300);
    
    setShowSearchResults(true);
  };

  const handleSelectChallenge = (challenge: ChallengeSearchResult) => {
    setChallengeId(challenge.id);
    setChallengeSearch(challenge.displayName);
    setChallengeInfo({
      id: challenge.id,
      title: challenge.title,
      subtitle: challenge.subtitle,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      originalId: challenge.originalId,
      createdAt: challenge.createdAt
    });
    setShowSearchResults(false);
  };

  const fetchChallengeInfo = async (id: string): Promise<ChallengeInfo | null> => {
    if (!id.trim()) return null;
    
    try {
      setIsLoading(true);
      const challengeRef = doc(db, 'sweatlist-collection', id);
      const challengeSnap = await getDoc(challengeRef);
      
      if (!challengeSnap.exists()) {
        setError('Challenge not found');
        return null;
      }
      
      const challengeData = challengeSnap.data();
      setError('');
      
      // The dates are stored as Unix timestamps (seconds since 1970)
      // We need to handle different possible formats
      const startDateValue = challengeData.challenge?.startDate;
      const endDateValue = challengeData.challenge?.endDate;
      const createdAtValue = challengeData.createdAt;
      
      return {
        id: challengeSnap.id,
        title: challengeData.challenge?.title || 'Untitled Challenge',
        subtitle: challengeData.challenge?.subtitle || '',
        startDate: convertFirestoreTimestamp(startDateValue),
        endDate: convertFirestoreTimestamp(endDateValue),
        originalId: challengeData.originalId || challengeSnap.id,
        createdAt: convertFirestoreTimestamp(createdAtValue),
      };
    } catch (err) {
      console.error('Error fetching challenge:', err);
      setError('Error fetching challenge information');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserInfo = async (username: string): Promise<UserInfo | null> => {
    if (!username.trim()) return null;
    
    try {
      setIsLoadingUser(true);
      setUserError('');
      
      // Query for the user by username
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('username', '==', username));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        setUserError('User not found');
        return null;
      }
      
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      return {
        id: userDoc.id,
        username: userData.username || '',
        displayName: userData.displayName || userData.username || '',
        email: userData.email || '',
        profileImage: userData.profileImage || {},
      };
    } catch (err) {
      console.error('Error fetching user:', err);
      setUserError('Error fetching user information');
      return null;
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleChallengeIdBlur = async () => {
    if (challengeId.trim()) {
      const info = await fetchChallengeInfo(challengeId);
      setChallengeInfo(info);
    }
  };

  const handleUsernameBlur = async () => {
    if (username.trim()) {
      const info = await fetchUserInfo(username);
      setUserInfo(info);
    }
  };

  const handleJoinChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    if (!challengeId.trim()) {
      setError('Challenge ID is required');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setSuccessMessage('');

      // Fetch challenge info one more time to validate
      const challengeExists = await fetchChallengeInfo(challengeId);
      if (!challengeExists) {
        setError('Challenge not found. Please check the ID and try again.');
        return;
      }

      // Fetch user info one more time to validate
      const userExists = await fetchUserInfo(username);
      if (!userExists) {
        setError('User not found. Please check the username and try again.');
        return;
      }

      // Store the result from joinChallenge method
      const userChallengeResult = await workoutService.joinChallenge({
        username,
        challengeId,
      });

      // Log the entire created user challenge object
      console.log(`🎉 USER CHALLENGE CREATED SUCCESSFULLY:`, {
        timestamp: new Date().toISOString(),
        challengeId,
        challengeTitle: challengeExists.title,
        username,
        userChallengeId: userChallengeResult.id,
        completedWorkouts: userChallengeResult.completedWorkouts,
        joinDate: userChallengeResult.joinDate,
        userId: userChallengeResult.userId,
        // Add the full result for complete debugging information
        fullUserChallengeObject: userChallengeResult
      });

      setSuccessMessage(`Successfully joined user "${username}" to challenge "${challengeExists.title}"!`);
      // Reset form fields after successful join
      setUsername('');
      setChallengeId('');
      setChallengeInfo(null);
      setUserInfo(null);
      setChallengeSearch('');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to join challenge');
      setSuccessMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // If user is NOT signed in, show SignInModal
  if (!isSignedIn) {
    return (
      <SignInModal
        isVisible={isSignInModalVisible}
        onClose={() => setIsSignInModalVisible(false)}
        onSignInSuccess={(user) => {
          console.log('Sign-in successful:', user);
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        }}
        onSignInError={(error) => {
          console.error('Sign-in error:', error);
          alert('Sign-in failed. Please try again.');
        }}
        onSignUpSuccess={(user) => {
          console.log('Sign-up successful:', user);
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        }}
        onSignUpError={(error) => {
          console.error('Sign-up error:', error);
          alert('Sign-up failed. Please try again.');
        }}
        onQuizComplete={() => {
          console.log('Quiz completed successfully');
        }}
        onQuizSkipped={() => {
          console.log('Quiz skipped');
        }}
      />
    );
  }

  // Otherwise, show the admin interface
  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Title Section */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-['Thunder'] mb-4">
            Admin: Join Challenge
          </h1>
          <p className="text-zinc-400 text-lg">Manually join users to challenges</p>
        </div>

        {/* Form */}
        <form onSubmit={handleJoinChallenge} className="mt-8 space-y-6">
          {/* Challenge Search Mode Toggle */}
          <div className="flex items-center justify-end">
            <label className="inline-flex items-center cursor-pointer">
              <span className="mr-3 text-sm font-medium text-zinc-400">
                {useManualId ? "Search by Name" : "Use Manual ID"}
              </span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  checked={useManualId}
                  onChange={() => setUseManualId(!useManualId)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-1 
                  peer-focus:ring-[#E0FE10] rounded-full peer 
                  peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] 
                  after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 
                  after:transition-all peer-checked:bg-[#E0FE10]">
                </div>
              </div>
            </label>
          </div>

          {/* Challenge Search Input (Default) */}
          {!useManualId && (
            <div className="relative">
              <label
                htmlFor="challengeSearch"
                className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']"
              >
                Search Challenge by Name
              </label>
              <input
                id="challengeSearch"
                type="text"
                value={challengeSearch}
                onChange={handleChallengeSearchChange}
                onFocus={() => setShowSearchResults(true)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white
                  placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1
                  focus:ring-[#E0FE10] transition-colors"
                placeholder="Type to search for challenges"
              />
              {isSearchingChallenges && (
                <div className="mt-2 flex items-center">
                  <div className="w-4 h-4 border-2 border-[#E0FE10] border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span className="text-zinc-400 text-xs">Searching challenges...</span>
                </div>
              )}
              
              {/* Dropdown search results */}
              {showSearchResults && searchResults.length > 0 && (
                <div 
                  ref={searchResultsRef}
                  className="absolute z-10 mt-1 w-full bg-zinc-800 border border-zinc-600 rounded-lg shadow-lg max-h-60 overflow-auto"
                >
                  {searchResults.map((result, index) => (
                    <div
                      key={`${result.id}-${index}`}
                      className="p-3 hover:bg-zinc-700 cursor-pointer border-b border-zinc-700 last:border-b-0"
                      onClick={() => handleSelectChallenge(result)}
                    >
                      <div className="font-medium text-[#E0FE10]">{result.displayName}</div>
                      {result.subtitle && (
                        <div className="text-sm text-zinc-400">{result.subtitle}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {showSearchResults && challengeSearch && searchResults.length === 0 && !isSearchingChallenges && (
                <div className="absolute z-10 mt-1 w-full bg-zinc-800 border border-zinc-600 rounded-lg shadow-lg p-3">
                  <p className="text-zinc-400">No challenges found. Try different keywords or use manual ID input.</p>
                </div>
              )}
            </div>
          )}

          {/* Challenge ID Input (Fallback) */}
          {useManualId && (
            <div>
              <label
                htmlFor="challengeId"
                className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']"
              >
                Challenge ID
              </label>
              <input
                id="challengeId"
                type="text"
                value={challengeId}
                onChange={(e) => setChallengeId(e.target.value)}
                onBlur={handleChallengeIdBlur}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white
                  placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1
                  focus:ring-[#E0FE10] transition-colors"
                placeholder="Enter challenge ID"
              />
              {isLoading && (
                <div className="mt-2 flex items-center">
                  <div className="w-4 h-4 border-2 border-[#E0FE10] border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span className="text-zinc-400 text-xs">Loading challenge info...</span>
                </div>
              )}
            </div>
          )}

          {/* Hidden Challenge ID input to ensure it's submitted when using search */}
          {!useManualId && (
            <input type="hidden" value={challengeId} />
          )}

          {/* Challenge Info (if found) */}
          {challengeInfo && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
              <h3 className="text-[#E0FE10] font-semibold text-lg mb-2">{challengeInfo.title}</h3>
              {challengeInfo.subtitle && (
                <p className="text-zinc-300 text-sm mb-2">{challengeInfo.subtitle}</p>
              )}
              <div className="flex flex-col text-xs text-zinc-400 mt-2">
                <span>
                  Start: {challengeInfo.startDate ? challengeInfo.startDate.toLocaleDateString() : 'Not set'}
                </span>
                <span>
                  End: {challengeInfo.endDate ? challengeInfo.endDate.toLocaleDateString() : 'Not set'}
                </span>
                <span className="mt-1 pt-1 border-t border-zinc-700">
                  ID: <span className="font-mono">{challengeInfo.id}</span>
                </span>
              </div>
            </div>
          )}

          {/* Username Input */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={handleUsernameBlur}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white
                placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1
                focus:ring-[#E0FE10] transition-colors"
              placeholder="Enter username to join"
            />
            {isLoadingUser && (
              <div className="mt-2 flex items-center">
                <div className="w-4 h-4 border-2 border-[#E0FE10] border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-zinc-400 text-xs">Loading user info...</span>
              </div>
            )}
          </div>

          {/* User Info (if found) */}
          {userInfo && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden">
                  {userInfo.profileImage && userInfo.profileImage.profileImageURL ? (
                    <img 
                      src={userInfo.profileImage.profileImageURL} 
                      alt={userInfo.displayName}
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-zinc-500 text-lg">
                      {userInfo.displayName.substring(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-[#E0FE10] font-semibold text-lg">
                    {userInfo.displayName}
                  </h3>
                  <p className="text-zinc-300 text-sm">@{userInfo.username}</p>
                  <p className="text-zinc-400 text-xs mt-1">{userInfo.email}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* User Error message */}
          {userError && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <p className="text-red-400 text-sm">{userError}</p>
            </div>
          )}

          {/* Global Error message */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
              <p className="text-green-400 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isLoadingUser || isSearchingChallenges}
            className={`w-full bg-[#E0FE10] text-black font-semibold py-4 px-4 rounded-lg
              hover:bg-[#c8e60e] transition-colors font-['HK Grotesk'] flex items-center justify-center
              ${(isLoading || isLoadingUser || isSearchingChallenges) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading || isLoadingUser || isSearchingChallenges ? (
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Join User to Challenge'
            )}
          </button>
        </form>

        {/* Back Link */}
        <div className="text-center mt-4">
          <button
            onClick={() => router.back()}
            className="text-zinc-400 hover:text-[#E0FE10] transition-colors text-sm"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

