import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { FollowRequest, CheckinsPrivacy } from '../../api/firebase/user';
import { User, userService } from '../../api/firebase/user';
import ExerciseGrid from '../../components/ExerciseGrid';
import { Exercise } from '../../api/firebase/exercise/types'; 
import { Challenge, Workout, SweatlistCollection, ChallengeType } from '../../api/firebase/workout/types';
import { workoutService } from '../../api/firebase/workout/service';
import { ChallengesTab } from '../../components/ChallengesTab';
import { WorkoutSummary } from '../../api/firebase/workout';
import { StarIcon, EllipsisHorizontalIcon, ShareIcon, FlagIcon, NoSymbolIcon, ScaleIcon, FireIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { ActivityTab } from '../../components/ActivityTab';
import { parseActivityType } from '../../utils/activityParser';
import { UserActivity } from '../../types/Activity';
import FullScreenExerciseView from '../FullscreenExerciseView';
import UserProfileMeta from '../../components/UserProfileMeta';
import Link from 'next/link';
import { db } from '../../api/firebase/config';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import FollowButton from '../../components/FollowButton';
import SideNav from '../../components/Navigation/SideNav';
import { StackCard } from '../../components/Rounds/StackCard';

// Body weight check-in type
interface BodyWeightCheckin {
  id: string;
  oldWeight: number;
  newWeight: number;
  frontUrl?: string;
  backUrl?: string;
  sideUrl?: string;
  createdAt: number;
  updatedAt: number;
}

interface ProfileViewProps {
  initialUserData: User | null;
  error: string | null; // Changed from optional to required, can be null
}

// Add this interface with your other interfaces
// interface UserStats {
//   bodyWeight: number;
//   workoutCount: number;
//   date: number;
// }

// Tabs matching iOS: Moves, Timeline, Rounds, Weigh-ins
const TABS = {
  MOVES: 'moves',
  TIMELINE: 'timeline',
  ROUNDS: 'rounds',
  WEIGHINS: 'weigh-ins',
} as const;

type TabType = typeof TABS[keyof typeof TABS];

// Round status helper
const getRoundStatus = (round: SweatlistCollection): 'upcoming' | 'active' | 'completed' => {
  const challenge = round.challenge;
  if (!challenge) return 'completed';
  
  const now = new Date();
  const startDate = challenge.startDate ? new Date(challenge.startDate) : null;
  const endDate = challenge.endDate ? new Date(challenge.endDate) : null;

  if (startDate && endDate) {
    if (now >= startDate && now <= endDate) return 'active';
    if (now > endDate) return 'completed';
  }
  return 'upcoming';
};

export default function ProfileView({ initialUserData, error: serverError }: ProfileViewProps) {
  const router = useRouter();
  const { username } = router.query;

  // Redux state for current authenticated user
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isAuthLoading = useSelector((state: RootState) => state.user.loading);

  // Determine if current user is viewing their own profile
  const isOwnProfile = currentUser && initialUserData && currentUser.id === initialUserData.id;

  const [selectedTab, setSelectedTab] = useState<TabType>(TABS.MOVES);
  const [user, setUser] = useState<User | null>(initialUserData);
  const [userVideos, setUserVideos] = useState<Exercise[]>([]);
  const [userStacks, setUserStacks] = useState<Workout[]>([]);
  const [stackSearchQuery, setStackSearchQuery] = useState('');
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [followers, setFollowers] = useState<FollowRequest[]>([]);
  const [following, setFollowing] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(!initialUserData);
  const [error, setError] = useState<string | null>(serverError || null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);
  const [resolvedUsername, setResolvedUsername] = useState<string | null>(null);
  
  // New state for iOS-matching features
  const [userRounds, setUserRounds] = useState<SweatlistCollection[]>([]);
  const [checkins, setCheckins] = useState<BodyWeightCheckin[]>([]);
  const [canViewCheckins, setCanViewCheckins] = useState(false);
  const [checkinsLoading, setCheckinsLoading] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');


  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8888/.netlify/functions'
    : 'https://fitwithpulse.ai/.netlify/functions';

  // Resolve username - use from URL if available, otherwise fetch from user object
  useEffect(() => {
    const resolveUsername = async () => {
      console.log('[Username Resolution] Starting...');
      console.log('[Username Resolution] username from query:', username);
      console.log('[Username Resolution] user object:', user);
      
      // If we have username from URL, use it
      if (username && typeof username === 'string') {
        console.log('[Username Resolution] Using username from URL:', username);
        setResolvedUsername(username);
        return;
      }
      
      // If no username in URL but we have user object, use user.username
      if (user?.username) {
        console.log('[Username Resolution] Using username from user object:', user.username);
        setResolvedUsername(user.username);
        return;
      }
      
      // If we have user ID but no username, fetch the user to get username
      if (user?.id) {
        console.log('[Username Resolution] Fetching user by ID to get username:', user.id);
        try {
          const fetchedUser = await userService.getUserById(user.id);
          if (fetchedUser?.username) {
            console.log('[Username Resolution] Fetched username:', fetchedUser.username);
            setResolvedUsername(fetchedUser.username);
          } else {
            console.error('[Username Resolution] Fetched user has no username');
          }
        } catch (error) {
          console.error('[Username Resolution] Error fetching user:', error);
        }
      }
    };
    
    resolveUsername();
  }, [username, user?.id, user?.username]);

  // In your ProfileView component, update the stats state initialization
  // Initial state setup
  // const [stats, setStats] = useState<UserStats>({
  //   bodyWeight: initialUserData?.bodyWeight?.[0]?.newWeight || 0,
  //   workoutCount: initialUserData?.workoutCount || 0,
  //   date: initialUserData?.bodyWeight?.[0]?.createdAt || 0
  // });

  useEffect(() => {
    const fetchUserProfile = async () => { 
      if (!username || initialUserData) return;

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/get-user-profile?username=${username}`);
        if (!response.ok) {
          throw new Error('Profile not found');
        }
        const data = await response.json();
        if (data.success) {
          setUser(data.user);
        } else {
          throw new Error(data.error || 'Failed to load profile');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [username, API_BASE_URL, initialUserData])

// Update the fetchBodyWeight useEffect
useEffect(() => {
  const fetchBodyWeight = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_BASE_URL}/get-body-weight?userId=${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch body weight data');
      
      const data = await response.json();
      if (data.success) {
        // Assuming the API returns an array and we want the latest entry
        // const latestWeight = data.bodyWeight[0];
        // if (latestWeight) {
        //   setStats(prevStats => ({
        //     ...prevStats,
        //     bodyWeight: latestWeight.newWeight,
        //     date: latestWeight.createdAt
        //   }));
        // }
      }
    } catch (error) {
      console.error('Error fetching body weight:', error);
    }
  };

  fetchBodyWeight();
}, [user?.id, API_BASE_URL]);

  // Fetch user's rounds (SweatlistCollections) - matching iOS
  useEffect(() => {
    const fetchUserRounds = async () => {
      if (!user?.id) return;
      
      try {
        const collections = await workoutService.fetchCollections(user.id);
        // Filter to rounds where user is owner or cohort author (like iOS)
        const userCreatedRounds = collections.filter(collection => {
          const isOwner = collection.ownerId?.includes(user.id);
          const isCohortAuthor = collection.challenge?.cohortAuthor?.includes(user.id);
          return (isOwner || isCohortAuthor) && collection.challenge;
        });
        setUserRounds(userCreatedRounds);
        
        // Also set activeChallenges for backward compatibility
        const challenges = userCreatedRounds.map(c => c.challenge).filter((c): c is Challenge => !!c);
        setActiveChallenges(challenges);
      } catch (error) {
        console.error('Error fetching user rounds:', error);
      }
    };

    fetchUserRounds();
  }, [user?.id]);

  // Check if viewer can see check-ins (privacy check like iOS)
  useEffect(() => {
    const checkCheckinAccess = () => {
      if (!user) return;
      
      // If viewing own profile, always allow
      if (isOwnProfile) {
        setCanViewCheckins(true);
        return;
      }
      
      const privacy = user.checkinsPrivacy || CheckinsPrivacy.privateOnly;
      
      switch (privacy) {
        case CheckinsPrivacy.publicAccess:
          setCanViewCheckins(true);
          break;
        case CheckinsPrivacy.followersOnly:
          // Check if current user follows this profile
          if (currentUser?.id) {
            const isFollowing = followers.some(f => 
              f.fromUser?.id === currentUser.id && f.status === 'accepted'
            ) || following.some(f => 
              f.toUser?.id === user.id && f.status === 'accepted'
            );
            // Also check explicit access list
            const hasExplicitAccess = user.checkinsAccessList?.includes(currentUser.id);
            setCanViewCheckins(isFollowing || hasExplicitAccess);
          } else {
            setCanViewCheckins(false);
          }
          break;
        case CheckinsPrivacy.privateOnly:
        default:
          // Check explicit access list
          if (currentUser?.id && user.checkinsAccessList?.includes(currentUser.id)) {
            setCanViewCheckins(true);
          } else {
            setCanViewCheckins(false);
          }
          break;
      }
    };

    checkCheckinAccess();
  }, [user, currentUser, isOwnProfile, followers, following]);

  // Fetch check-ins if allowed
  useEffect(() => {
    const fetchCheckins = async () => {
      if (!user?.id || !canViewCheckins) return;
      
      setCheckinsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/get-body-weight?userId=${user.id}&limit=50`);
        if (!response.ok) throw new Error('Failed to fetch check-ins');
        
        const data = await response.json();
        if (data.success) {
          // Sort by date, newest first
          const sortedCheckins = (data.bodyWeight || []).sort(
            (a: BodyWeightCheckin, b: BodyWeightCheckin) => b.createdAt - a.createdAt
          );
          setCheckins(sortedCheckins);
        }
      } catch (error) {
        console.error('Error fetching check-ins:', error);
      } finally {
        setCheckinsLoading(false);
      }
    };

    fetchCheckins();
  }, [user?.id, canViewCheckins, API_BASE_URL]);

  useEffect(() => {
    const fetchUserVideos = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/get-user-videos?userId=${user.id}`);
        if (!response.ok) throw new Error('Failed to fetch videos');
        
        const data = await response.json();
        if (data.success) {
          setUserVideos(data.exercises);
        }
      } catch (error) {
        console.error('Error fetching user videos:', error);
      }
    };

    fetchUserVideos();
  }, [user?.id, API_BASE_URL]);

  useEffect(() => {
    const fetchUserStacks = async () => {
      if (!user?.id) {
        console.log('[Fetch Stacks] No user ID available yet');
        return;
      }
      
      console.log('[Fetch Stacks] Fetching stacks for user ID:', user.id);
      console.log('[Fetch Stacks] User username:', user.username);
      
      try {
        const stacks = await userService.fetchUserStacks(user.id);
        console.log('[Fetch Stacks] Fetched stacks count:', stacks.length);
        if (stacks.length > 0) {
          console.log('[Fetch Stacks] First stack:', {
            id: stacks[0].id,
            roundWorkoutId: stacks[0].roundWorkoutId,
            title: stacks[0].title,
            author: stacks[0].author
          });
        }
        setUserStacks(stacks);
      } catch (error) {
        console.error('[Fetch Stacks] Error fetching user stacks:', error);
      }
    };

    fetchUserStacks();
  }, [user?.id]);

  useEffect(() => {
    const fetchFollowData = async (userId: string) => {
      try {
        const fetchOptions = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
        };
  
        const [followersRes, followingRes] = await Promise.all([
          fetch(`${API_BASE_URL}/get-followers?userId=${userId}`, fetchOptions),
          fetch(`${API_BASE_URL}/get-following?userId=${userId}`, fetchOptions)
        ]);
  
        if (!followersRes.ok || !followingRes.ok) {
          throw new Error('Failed to fetch follow data');
        }
  
        const followersData = await followersRes.json();
        const followingData = await followingRes.json();
  
        if (followersData.success && followingData.success) {
          setFollowers(followersData.followers);
          setFollowing(followingData.following);
        }
      } catch (error) {
        console.error('Error fetching follow data:', error);
      }
    };
  
    if (user?.id) {
      fetchFollowData(user.id);
    }
  }, [user?.id, API_BASE_URL]);

  useEffect(() => {
    const fetchWorkoutSummaries = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/get-workout-summaries?userId=${user.id}`);
        if (!response.ok) throw new Error('Failed to fetch workout summaries');
        
        const data = await response.json();
        if (data.success) {
          const summaries = data.summaries.map((summary: any) =>
            new WorkoutSummary(summary)
          );
          setWorkoutSummaries(summaries);
          
          if (userVideos.length > 0 || followers.length > 0 || following.length > 0) {
            const followRequests = [...followers, ...following];
            
            const parsedActivities = parseActivityType(
              summaries,
              userVideos,
              followRequests,
              user.id,
              user.username
            );
            setActivities(parsedActivities);
          }
        }
      } catch (error) {
        console.error('Error fetching workout summaries:', error);
      }
    };
  
    fetchWorkoutSummaries();
  }, [user?.id, API_BASE_URL, followers, following, userVideos]);

  if (loading || error || !user) {
    const defaultMetaData = {
      displayName: 'Pulse Profile',
      bio: 'Discover fitness profiles on Pulse',
      username: username as string || '',
      profileImage: {
        profileImageURL: 'https://fitwithpulse.ai/default-profile.png'
      }
    };

    return (
      <>
        <UserProfileMeta 
          userData={defaultMetaData}
          bio={defaultMetaData.bio}
          username={defaultMetaData.username}
        />
        <div className="flex items-center justify-center min-h-screen">
          {loading ? 'Loading...' : 'Profile not found'}
        </div>
      </>
    );
  }

  const socialLinks = {
    instagram: user.creator?.instagramHandle,
    twitter: user.creator?.twitterHandle,
    youtube: user.creator?.youtubeUrl
  };

  // Get featured rounds (filtered by featuredRoundIds like iOS)
  const featuredRounds = React.useMemo(() => {
    if (!user?.featuredRoundIds?.length) {
      // If no featured rounds set, show nothing (matches iOS behavior)
      return [];
    }
    return userRounds.filter(round => user.featuredRoundIds?.includes(round.id));
  }, [userRounds, user?.featuredRoundIds]);

  // Get visible tabs based on check-in access
  const visibleTabs = React.useMemo((): TabType[] => {
    const tabs: TabType[] = [TABS.MOVES, TABS.TIMELINE, TABS.ROUNDS];
    if (canViewCheckins) {
      tabs.push(TABS.WEIGHINS);
    }
    return tabs;
  }, [canViewCheckins]);

  // Update the jsx for the exercises tab to include the delete functionality
  const renderExercisesTab = () => {
    return (
      <div className="px-5">
        <h2 className="text-xl text-white font-semibold mb-4">
          {user.username}'s Moves ({userVideos.length})
        </h2>
        <ExerciseGrid
          userVideos={userVideos}
          onSelectVideo={(exercise) => setSelectedExercise(exercise)}
        />
      </div>
    );
  };

  // Render rounds tab with featured rounds (matching iOS - no Host/Participant toggle)
  const renderRoundsTab = () => {
    // Type config for round cards (matching Create.tsx styling)
    const typeConfig: Record<string, { gradient: string; iconBg: string; iconColor: string; label: string }> = {
      workout: { gradient: 'from-rose-500/20 via-pink-500/20 to-orange-500/20', iconBg: 'bg-rose-500/30', iconColor: 'text-rose-300', label: 'Workout' },
      steps: { gradient: 'from-blue-500/20 via-cyan-500/20 to-teal-500/20', iconBg: 'bg-blue-500/30', iconColor: 'text-blue-300', label: 'Steps' },
      calories: { gradient: 'from-orange-500/20 via-amber-500/20 to-yellow-500/20', iconBg: 'bg-orange-500/30', iconColor: 'text-orange-300', label: 'Calories' },
      hybrid: { gradient: 'from-purple-500/20 via-violet-500/20 to-indigo-500/20', iconBg: 'bg-purple-500/30', iconColor: 'text-purple-300', label: 'Hybrid' },
    };

    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'steps': return <TrophyIcon className="w-4 h-4" />;
        case 'calories': return <FireIcon className="w-4 h-4" />;
        case 'hybrid': return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
        default: return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v12H4zM16 6h4v12h-4zM8 10h8v4H8z" />
          </svg>
        );
      }
    };

    return (
      <div className="px-5">
        {featuredRounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-zinc-800/50 rounded-xl">
            <StarIcon className="w-16 h-16 text-zinc-600 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {userRounds.length > 0 ? 'No Featured Rounds' : 'No Rounds Yet'}
            </h3>
            <p className="text-zinc-400 text-center text-sm">
              {userRounds.length > 0 
                ? `${user.username} hasn't featured any rounds on their profile`
                : `${user.username} hasn't created any rounds yet`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Featured Rounds</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredRounds.map((round) => {
                const status = getRoundStatus(round);
                const challengeType = (round.challenge as any)?.challengeType?.toLowerCase() || 'workout';
                const config = typeConfig[challengeType] || typeConfig.workout;
                
                return (
                  <button
                    key={round.id}
                    onClick={() => router.push(`/round/${round.id}`)}
                    className={`group relative overflow-hidden rounded-xl border border-zinc-700/50 hover:border-zinc-600 transition-all duration-300 text-left bg-gradient-to-br ${config.gradient}`}
                  >
                    <div className="p-4">
                      {/* Type Badge & Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className={`flex items-center gap-2 ${config.iconBg} px-3 py-1.5 rounded-lg`}>
                          <span className={config.iconColor}>{getTypeIcon(challengeType)}</span>
                          <span className={`text-xs font-medium ${config.iconColor}`}>{config.label}</span>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          status === 'active' ? 'bg-green-500/20 text-green-400' :
                          status === 'upcoming' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-zinc-500/20 text-zinc-400'
                        }`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                      
                      {/* Title & Description */}
                      <h4 className="text-white font-semibold mb-1 line-clamp-1">
                        {round.challenge?.title || 'Untitled Round'}
                      </h4>
                      <p className="text-zinc-400 text-sm line-clamp-2 mb-3">
                        {round.challenge?.subtitle || ''}
                      </p>
                      
                      {/* Date Range */}
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {round.challenge?.startDate 
                            ? new Date(round.challenge.startDate).toLocaleDateString() 
                            : 'TBD'}
                          {' → '}
                          {round.challenge?.endDate 
                            ? new Date(round.challenge.endDate).toLocaleDateString() 
                            : 'TBD'}
                        </span>
                      </div>
                      
                      {/* Participants */}
                      {round.challenge?.participants && round.challenge.participants.length > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {round.challenge.participants.slice(0, 3).map((p: any, i: number) => (
                              <div key={i} className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-800 overflow-hidden">
                                {p.profileImage?.profileImageURL ? (
                                  <img src={p.profileImage.profileImageURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                                    {p.username?.[0]?.toUpperCase() || '?'}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <span className="text-xs text-zinc-500">
                            {round.challenge.participants.length} participant{round.challenge.participants.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render weigh-ins/check-ins tab (matching iOS)
  const renderWeighinsTab = () => {
    if (checkinsLoading) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E0FE10]"></div>
        </div>
      );
    }

    if (checkins.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-800/50 rounded-xl mx-5">
          <ScaleIcon className="w-16 h-16 text-zinc-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Weigh-ins Yet</h3>
          <p className="text-zinc-400 text-center text-sm">
            Weigh-ins will appear here when {user.username} shares their progress
          </p>
        </div>
      );
    }

    return (
      <div className="px-5 space-y-4">
        {checkins.map((checkin) => {
          const change = checkin.newWeight - checkin.oldWeight;
          const hasPhotos = checkin.frontUrl || checkin.backUrl || checkin.sideUrl;
          
          return (
            <div 
              key={checkin.id}
              className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-zinc-500 text-sm">
                    {new Date(checkin.createdAt * 1000).toLocaleDateString('en-US', { 
                      month: 'short', day: 'numeric', year: 'numeric' 
                    })}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-2xl font-bold text-white">
                      {checkin.newWeight.toFixed(1)} lbs
                    </span>
                    {Math.abs(change) > 0.1 && (
                      <span className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full ${
                        change > 0 
                          ? 'bg-orange-500/20 text-orange-400' 
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        <svg className={`w-3 h-3 ${change > 0 ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l5-5 5 5" />
                        </svg>
                        {Math.abs(change).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                
                {hasPhotos && (
                  <span className="flex items-center gap-1 text-xs text-[#E0FE10] bg-[#E0FE10]/10 px-2 py-1 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Photos
                  </span>
                )}
              </div>
              
              {/* Progress Photos */}
              {hasPhotos && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {checkin.frontUrl && (
                    <div className="flex-shrink-0 w-20">
                      <img 
                        src={checkin.frontUrl} 
                        alt="Front" 
                        className="w-20 h-24 object-cover rounded-lg"
                      />
                      <p className="text-xs text-zinc-500 text-center mt-1">Front</p>
                    </div>
                  )}
                  {checkin.sideUrl && (
                    <div className="flex-shrink-0 w-20">
                      <img 
                        src={checkin.sideUrl} 
                        alt="Side" 
                        className="w-20 h-24 object-cover rounded-lg"
                      />
                      <p className="text-xs text-zinc-500 text-center mt-1">Side</p>
                    </div>
                  )}
                  {checkin.backUrl && (
                    <div className="flex-shrink-0 w-20">
                      <img 
                        src={checkin.backUrl} 
                        alt="Back" 
                        className="w-20 h-24 object-cover rounded-lg"
                      />
                      <p className="text-xs text-zinc-500 text-center mt-1">Back</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      <UserProfileMeta 
        userData={{
          displayName: user.displayName,
          bio: user.bio || 'User bio goes here',
          username: user.username,
          profileImage: user.profileImage
        }}
        bio={user.bio || 'User bio goes here'}
        username={user.username}
      />

      {/* Side/Bottom Navigation */}
      <SideNav />

      <div className="relative md:ml-20 lg:ml-64 pb-16 md:pb-0">
        <div className="h-48 bg-gradient-to-b from-zinc-800 to-zinc-900" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-24">
            <div className="relative inline-block">
              <img 
                src={user.profileImage?.profileImageURL || "/api/placeholder/96/96"}
                alt={user.displayName}
                className="w-24 h-24 rounded-full border-4 border-zinc-900"
                onClick={() => setShowProfileImageModal(true)}
              />
            </div>

            <div className="mt-4 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{user.displayName}</h1>
                  <p className="text-zinc-400">@{user.username}</p>
                  
                  <div className="mt-2 flex items-center gap-4 text-sm text-zinc-400">
                    <span>{followers.length} followers</span>
                    <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                    <span>{following.length} following</span>
                  </div>
                </div>
                
                {/* Follow / Message / Options Actions */}
                <div className="mt-2 flex items-center gap-2">
                  <FollowButton 
                    targetUser={user}
                    onFollowSuccess={(isFollowing) => {
                      // Update followers count optimistically
                      if (isFollowing) {
                        setFollowers(prev => [...prev, {} as any]);
                      } else {
                        setFollowers(prev => prev.slice(0, -1));
                      }
                    }}
                  />
                  {!isOwnProfile && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            if (!currentUser?.id) {
                              router.push('/messages');
                              return;
                            }
                            // 1) Find existing chat between current user and profile user
                            const chatsRef = collection(db, 'chats');
                            const q = query(chatsRef, where('participantIds', 'array-contains', currentUser.id));
                            const snap = await getDocs(q);
                            let chatId: string | null = null;
                            for (const d of snap.docs) {
                              const data: any = d.data();
                              if (Array.isArray(data.participantIds) && data.participantIds.includes(user.id)) {
                                chatId = d.id; break;
                              }
                            }
                            // 2) If none, create
                            if (!chatId) {
                              const participants = [
                                { id: currentUser.id, username: currentUser.username || '', profileImage: currentUser.profileImage || null },
                                { id: user.id, username: user.username || '', profileImage: user.profileImage || null },
                              ];
                              const newChat = await addDoc(chatsRef, {
                                participantIds: [currentUser.id, user.id],
                                participants,
                                lastMessage: 'New conversation',
                                lastMessageTimestamp: serverTimestamp(),
                                lastMessageSenderId: currentUser.id,
                              });
                              chatId = newChat.id;
                            }
                            if (chatId) router.push(`/messages/dm/${chatId}`);
                          } catch (err) {
                            console.warn('[Profile] Failed to open DM, routing to messages list', err);
                            router.push('/messages');
                          }
                        }}
                        className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                        title="Send Message"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                      
                      {/* Options Menu Button */}
                      <div className="relative">
                        <button
                          onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                          className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                          title="Options"
                        >
                          <EllipsisHorizontalIcon className="w-5 h-5" />
                        </button>
                        
                        {/* Options Dropdown */}
                        {showOptionsMenu && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setShowOptionsMenu(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-800 rounded-xl border border-zinc-700 shadow-xl z-50 overflow-hidden">
                              <button
                                onClick={() => {
                                  // Share contact card
                                  const profileUrl = `https://fitwithpulse.ai/profile/${user.username}`;
                                  if (navigator.share) {
                                    navigator.share({
                                      title: `${user.displayName || user.username}'s Profile`,
                                      text: `Check out ${user.username}'s profile on Pulse`,
                                      url: profileUrl,
                                    });
                                  } else {
                                    navigator.clipboard.writeText(profileUrl);
                                    alert('Profile link copied to clipboard!');
                                  }
                                  setShowOptionsMenu(false);
                                }}
                                className="w-full px-4 py-3 flex items-center gap-3 text-left text-white hover:bg-zinc-700 transition-colors"
                              >
                                <ShareIcon className="w-5 h-5 text-zinc-400" />
                                <div>
                                  <p className="font-medium">Share Profile</p>
                                  <p className="text-xs text-zinc-500">Share {user.username}'s profile</p>
                                </div>
                              </button>
                              
                              <button
                                onClick={() => {
                                  setShowReportModal(true);
                                  setShowOptionsMenu(false);
                                }}
                                className="w-full px-4 py-3 flex items-center gap-3 text-left text-white hover:bg-zinc-700 transition-colors border-t border-zinc-700"
                              >
                                <FlagIcon className="w-5 h-5 text-zinc-400" />
                                <div>
                                  <p className="font-medium">Report User</p>
                                  <p className="text-xs text-zinc-500">Report inappropriate behavior</p>
                                </div>
                              </button>
                              
                              <button
                                onClick={async () => {
                                  if (!currentUser?.id) return;
                                  if (window.confirm(`Are you sure you want to block ${user.username}? You won't see their content and they won't be able to message you.`)) {
                                    try {
                                      // Add to blocked users
                                      const userRef = doc(db, 'users', currentUser.id);
                                      const userDoc = await getDoc(userRef);
                                      if (userDoc.exists()) {
                                        const blockedUsers = userDoc.data().blockedUsers || [];
                                        if (!blockedUsers.includes(user.id)) {
                                          await userService.updateUser(currentUser.id, {
                                            ...currentUser,
                                            blockedUsers: [...blockedUsers, user.id],
                                          } as User);
                                          alert(`${user.username} has been blocked.`);
                                          router.push('/');
                                        }
                                      }
                                    } catch (err) {
                                      console.error('Error blocking user:', err);
                                      alert('Failed to block user. Please try again.');
                                    }
                                  }
                                  setShowOptionsMenu(false);
                                }}
                                className="w-full px-4 py-3 flex items-center gap-3 text-left text-red-400 hover:bg-zinc-700 transition-colors border-t border-zinc-700"
                              >
                                <NoSymbolIcon className="w-5 h-5" />
                                <div>
                                  <p className="font-medium">Block User</p>
                                  <p className="text-xs text-zinc-500">Hide their content</p>
                                </div>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <p className="mt-4 text-zinc-300">{user.bio}</p>

              <div className="mt-4 flex gap-6">
                {Object.entries(socialLinks).map(([platform, handle]) => {
                  if (!handle) return null;

                  return (
                    <a 
                      key={platform}
                      href={getSocialLink(platform, handle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-white transition-colors"
                    >
                      <img 
                        src={`/${platform}.svg`}
                        alt={platform}
                        className="w-6 h-6 hover:opacity-80"
                      />
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 border-b border-zinc-700 overflow-x-auto">
              <nav className="flex whitespace-nowrap min-w-full sm:min-w-0 px-4 sm:px-0">
                <div className="flex gap-8 pb-2 sm:pb-0">
                  {visibleTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedTab(tab)}
                      className={`pb-4 px-2 text-sm font-medium transition-colors relative flex-shrink-0
                        ${selectedTab === tab ? 'text-white' : 'text-zinc-400 hover:text-zinc-300'}`}
                    >
                      {tab === 'weigh-ins' ? 'Weigh-ins' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {selectedTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                      )}
                    </button>
                  ))}
                </div>
              </nav>
            </div>

            <div className="mt-8">
              {/* Moves Tab */}
              {selectedTab === TABS.MOVES && renderExercisesTab()}
              
              {/* Timeline/Activity Tab */}
              {selectedTab === TABS.TIMELINE && (
                <div className="px-5">
                  {activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-zinc-800/50 rounded-xl">
                      <StarIcon className="w-16 h-16 text-zinc-600 mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">
                        No Activity Yet
                      </h3>
                      <p className="text-zinc-400 text-center text-sm">
                        {user.username} hasn't logged any activity yet
                      </p>
                    </div>
                  ) : (
                    <ActivityTab
                      activities={activities}
                      workoutSummaries={workoutSummaries}
                      userVideos={userVideos}
                      username={user.username}
                      isPublicProfile={true}
                      onWorkoutSelect={(summary) => {
                        console.log('Selected workout summary:', summary);
                      }}
                      onVideoSelect={(exercise) => {
                        setSelectedExercise(exercise);
                      }}
                      onProfileSelect={(userId) => {
                        console.log('Selected user profile:', userId);
                      }}
                    />
                  )}
                </div>
              )}
              
              {/* Rounds Tab */}
              {selectedTab === TABS.ROUNDS && renderRoundsTab()}
              
              {/* Weigh-ins Tab */}
              {selectedTab === TABS.WEIGHINS && renderWeighinsTab()}
              
              {/* Legacy Stacks Tab - keeping for backward compatibility but hidden */}
              {false && (() => {
                console.log('[Stacks Tab] Current username from router.query:', username);
                console.log('[Stacks Tab] Resolved username:', resolvedUsername);
                console.log('[Stacks Tab] User object:', user);
                console.log('[Stacks Tab] User.username:', user?.username);
                console.log('[Stacks Tab] Total userStacks:', userStacks.length);
                
                const filteredStacks = userStacks.filter(stack => 
                  stack.title.toLowerCase().includes(stackSearchQuery.toLowerCase()) ||
                  stack.description.toLowerCase().includes(stackSearchQuery.toLowerCase())
                );

                console.log('[Stacks Tab] Filtered stacks:', filteredStacks.length);
                if (filteredStacks.length > 0) {
                  console.log('[Stacks Tab] First stack sample:', {
                    id: filteredStacks[0].id,
                    roundWorkoutId: filteredStacks[0].roundWorkoutId,
                    title: filteredStacks[0].title,
                    author: filteredStacks[0].author
                  });
                }

                // Use resolvedUsername with fallback chain
                const usernameForUrl = resolvedUsername || username || user?.username || 'unknown';
                console.log('[Stacks Tab] Username that will be used for URLs:', usernameForUrl);

                return (
                  <div className="px-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl text-white font-semibold">
                        {user?.username}'s Movelists ({userStacks.length})
                      </h2>
                    </div>

                    {/* Search Input */}
                    <div className="mb-6">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search Movelists..."
                          value={stackSearchQuery}
                          onChange={(e) => setStackSearchQuery(e.target.value)}
                          className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] placeholder-zinc-500"
                        />
                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        {stackSearchQuery && (
                          <button
                            onClick={() => setStackSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {stackSearchQuery && (
                        <p className="text-sm text-zinc-400 mt-2">
                          Found {filteredStacks.length} of {userStacks.length} Movelists
                        </p>
                      )}
                    </div>

                    {userStacks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-xl">
                        <div className="text-6xl mb-4">🏋️</div>
                        <p className="text-zinc-400 text-center">
                          No Movelists yet
                        </p>
                      </div>
                    ) : filteredStacks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-xl">
                        <div className="text-6xl mb-4">🔍</div>
                        <p className="text-zinc-400 text-center">
                          No Movelists match "{stackSearchQuery}"
                        </p>
                        <button
                          onClick={() => setStackSearchQuery('')}
                          className="mt-4 text-[#E0FE10] hover:underline"
                        >
                          Clear search
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredStacks.map((stack) => (
                          <StackCard
                            key={stack.id}
                            workout={stack}
                            gifUrls={[]}
                            onPrimaryAction={() => {
                              const targetUrl = `/workout/${usernameForUrl}/${stack.roundWorkoutId}`;
                              console.log('[Stack Click] Navigating to:', targetUrl);
                              console.log('[Stack Click] Resolved username:', resolvedUsername);
                              console.log('[Stack Click] Username from query:', username);
                              console.log('[Stack Click] User.username:', user?.username);
                              console.log('[Stack Click] Final username used:', usernameForUrl);
                              console.log('[Stack Click] Stack roundWorkoutId:', stack.roundWorkoutId);
                              console.log('[Stack Click] Stack author:', stack.author);
                              console.log('[Stack Click] Full stack object:', stack);
                              router.push(targetUrl);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {selectedExercise && (
          <FullScreenExerciseView
            exercise={selectedExercise}
            user={user}
            onBack={() => setSelectedExercise(null)}
            onProfileClick={() => {
              console.log('Profile clicked');
            }}
          />
        )}

        {showProfileImageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="relative bg-zinc-800 p-4 rounded shadow-md max-w-2xl w-full mx-2">
              <button
                onClick={() => setShowProfileImageModal(false)}
                className="absolute top-2 right-2 text-zinc-300 hover:text-white"
              >
                ✕
              </button>
              <img
                src={user.profileImage?.profileImageURL || "/api/placeholder/96/96"}
                alt={user.displayName}
                className="max-w-full max-h-[80vh] object-contain mx-auto"
              />
            </div>
          </div>
        )}

        {/* Report User Modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 rounded-2xl max-w-md w-full border border-zinc-700 shadow-xl">
              <div className="p-6 border-b border-zinc-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Report User</h3>
                  <button
                    onClick={() => {
                      setShowReportModal(false);
                      setReportReason('');
                    }}
                    className="text-zinc-400 hover:text-white"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <p className="text-zinc-400 mb-4">
                  Why are you reporting {user.username}?
                </p>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full h-32 bg-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] placeholder-zinc-500 resize-none"
                />
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowReportModal(false);
                      setReportReason('');
                    }}
                    className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!currentUser?.id || !reportReason.trim()) return;
                      
                      try {
                        // Create report in Firestore
                        const reportsRef = collection(db, 'user-reports');
                        await addDoc(reportsRef, {
                          reportedUserId: user.id,
                          reportedUsername: user.username,
                          reportedBy: currentUser.id,
                          reporterUsername: currentUser.username,
                          message: reportReason.trim(),
                          status: 'pending',
                          createdAt: serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        });
                        
                        alert('Report submitted. Thank you for helping keep our community safe.');
                        setShowReportModal(false);
                        setReportReason('');
                      } catch (err) {
                        console.error('Error submitting report:', err);
                        alert('Failed to submit report. Please try again.');
                      }
                    }}
                    disabled={!reportReason.trim()}
                    className="flex-1 px-4 py-3 bg-[#E0FE10] text-black font-semibold rounded-xl hover:bg-[#c8e60e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<ProfileViewProps> = async (context) => {
  const { username } = context.params || {};

  if (!username || typeof username !== 'string') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  // List of reserved paths that should not be treated as usernames
  const reservedPaths = ['checklist', 'support', 'privacy', 'terms'];
  if (reservedPaths.includes(username.toLowerCase())) {
    return {
      redirect: {
        destination: `/${username}`,
        permanent: false,
      },
    };
  }

  try {
    const API_BASE_URL = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8888/.netlify/functions'
      : 'https://fitwithpulse.ai/.netlify/functions';

    const response = await fetch(`${API_BASE_URL}/get-user-profile?username=${username}`);
    
    if (!response.ok) {
      throw new Error('Profile not found');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load profile');
    }

    return {
      props: {
        initialUserData: data.user,
        error: null
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        initialUserData: null,
        error: error instanceof Error ? error.message : 'Failed to load profile'
      }
    };
  }
};

function getSocialLink(platform: string, handle: string): string {
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'youtube':
      return handle; // Assuming full URL is stored
    default:
      return '#';
  }
}