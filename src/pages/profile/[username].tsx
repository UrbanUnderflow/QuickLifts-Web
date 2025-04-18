import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { FollowRequest } from '../../api/firebase/user';
import { User } from '../../api/firebase/user';
import ExerciseGrid from '../../components/ExerciseGrid';
import { Exercise } from '../../api/firebase/exercise/types'; 
import { Challenge } from '../../api/firebase/workout/types';
import { ChallengesTab } from '../../components/ChallengesTab';
import { WorkoutSummary } from '../../api/firebase/workout';
import { StarIcon } from '@heroicons/react/24/outline';
import { ActivityTab } from '../../components/ActivityTab';
import { parseActivityType } from '../../utils/activityParser';
import { UserActivity } from '../../types/Activity';
import FullScreenExerciseView from '../FullscreenExerciseView';
import UserProfileMeta from '../../components/UserProfileMeta';

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

const TABS = {
  // STATS: 'stats',
  ACTIVITY: 'activity',
  EXERICSES: 'moves',
  CHALLENGES: 'challenges',
} as const;

type TabType = typeof TABS[keyof typeof TABS];

export default function ProfileView({ initialUserData, error: serverError }: ProfileViewProps) {
  const router = useRouter();
  const { username } = router.query;

  const [selectedTab, setSelectedTab] = useState<TabType>(TABS.EXERICSES);
  const [user, setUser] = useState<User | null>(initialUserData);
  const [userVideos, setUserVideos] = useState<Exercise[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [followers, setFollowers] = useState<FollowRequest[]>([]);
  const [following, setFollowing] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(!initialUserData);
  const [error, setError] = useState<string | null>(serverError || null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);


  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8888/.netlify/functions'
    : 'https://fitwithpulse.ai/.netlify/functions';

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

  useEffect(() => {
    const fetchChallenges = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/get-challenges?userId=${user.id}`);
        if (!response.ok) throw new Error('Failed to fetch challenges');
        
        const data = await response.json();
        if (data.success) {
          setActiveChallenges(data.challenges);
        }
      } catch (error) {
        console.error('Error fetching challenges:', error);
      }
    };
  
    fetchChallenges();
  }, [user?.id, API_BASE_URL]);

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
              user.id
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

  // Update the jsx for the exercises tab to include the delete functionality
  const renderExercisesTab = () => {
    return (
      <div className="px-5">
        <h2 className="text-xl text-white font-semibold mb-4">
          {user.username}'s Videos ({userVideos.length})
        </h2>
        <ExerciseGrid
          userVideos={userVideos}
          onSelectVideo={(exercise) => setSelectedExercise(exercise)}
        />
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

      <div className="relative">
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
              <h1 className="text-2xl font-bold">{user.displayName}</h1>
              <p className="text-zinc-400">@{user.username}</p>
              
              <div className="mt-2 flex items-center gap-4 text-sm text-zinc-400">
                <span>{followers.length} followers</span>
                <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                <span>{following.length} following</span>
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
                  {Object.values(TABS).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedTab(tab)}
                      className={`pb-4 px-2 text-sm font-medium transition-colors relative flex-shrink-0
                        ${selectedTab === tab ? 'text-white' : 'text-zinc-400 hover:text-zinc-300'}`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {selectedTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                      )}
                    </button>
                  ))}
                </div>
              </nav>
            </div>

            <div className="mt-8">
              {/* {selectedTab === TABS.STATS && (
              <div className="grid grid-cols-2 gap-4 text-white">
                <div className="p-4 bg-zinc-800 rounded-lg">
                  <div className="text-2xl font-bold">
                    {`${stats.bodyWeight || 0} lbs`}
                  </div>
                  <div className="text-zinc-400">Body Weight</div>
                  <div className="text-sm text-zinc-500 mt-1">
                    Last updated: {new Date(stats.date * 1000).toLocaleDateString()}
                  </div>
                </div>
                <div className="p-4 bg-zinc-800 rounded-lg">
                  <div className="text-2xl font-bold">{stats.workoutCount}</div>
                  <div className="text-zinc-400">Workouts</div>
                  {workoutSummaries.length > 0 && (
                    <div className="text-sm text-zinc-500 mt-1">
                      Last workout: {new Date(workoutSummaries[0].completedAt ?? 0).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              )} */}
              {selectedTab === TABS.ACTIVITY && (
                <div className="px-5">
                  {activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8">
                      <StarIcon className="w-12 h-12 text-white/20" />
                      <h3 className="mt-4 text-white font-medium">
                        {user.username} has no activities yet
                      </h3>
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
                        console.log('Selected exercise:', exercise);
                      }}
                      onProfileSelect={(userId) => {
                        console.log('Selected user profile:', userId);
                      }}
                    />
                  )}
                </div>
              )}
              {selectedTab === TABS.EXERICSES && renderExercisesTab()}
              {selectedTab === TABS.CHALLENGES && (
                <ChallengesTab
                  activeChallenges={activeChallenges}
                  onSelectChallenge={(challenge) => {
                    console.log(challenge);
                  }}
                />
              )}
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