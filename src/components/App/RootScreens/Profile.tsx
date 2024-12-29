import React, { useState, useEffect } from 'react';
import { userService } from '../../../api/firebase/user';
import { Exercise } from '../../../api/firebase/exercise/types';
import { Challenge } from '../../../types/Challenge';
import { FollowRequest } from '../../../types/FollowRequest';
import { WorkoutSummary } from '../../../types/WorkoutSummary';
import { UserActivity } from '../../../types/Activity';
import { StarIcon } from '@heroicons/react/24/outline';
import { ActivityTab } from '../../ActivityTab';
import { ChallengesTab } from '../../ChallengesTab';
import ExerciseGrid from '../../ExerciseGrid';
import FullScreenExerciseView from '../../../pages/FullscreenExerciseView';
import { parseActivityType } from '../../../utils/activityParser';

const TABS = {
  ACTIVITY: 'activity',
  EXERCISES: 'moves',
  CHALLENGES: 'rounds',
} as const;

type TabType = typeof TABS[keyof typeof TABS];

const Profile: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<TabType>(TABS.EXERCISES);
  const [userVideos, setUserVideos] = useState<Exercise[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [followers, setFollowers] = useState<FollowRequest[]>([]);
  const [following, setFollowing] = useState<FollowRequest[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8888/.netlify/functions'
    : 'https://fitwithpulse.ai/.netlify/functions';

  const currentUser = userService.currentUser;

  useEffect(() => {
    const fetchUserVideos = async () => {
      if (!currentUser?.id) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/get-user-videos?userId=${currentUser.id}`);
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
  }, [currentUser?.id]);

  useEffect(() => {
    const fetchChallenges = async () => {
      if (!currentUser?.id) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/get-challenges?userId=${currentUser.id}`);
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
  }, [currentUser?.id]);

  useEffect(() => {
    const fetchFollowData = async () => {
      if (!currentUser?.id) return;

      try {
        const [followersRes, followingRes] = await Promise.all([
          fetch(`${API_BASE_URL}/get-followers?userId=${currentUser.id}`),
          fetch(`${API_BASE_URL}/get-following?userId=${currentUser.id}`)
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

    fetchFollowData();
  }, [currentUser?.id]);

  useEffect(() => {
    const fetchWorkoutSummaries = async () => {
      if (!currentUser?.id) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/get-workout-summaries?userId=${currentUser.id}`);
        if (!response.ok) throw new Error('Failed to fetch workout summaries');
        
        const data = await response.json();
        if (data.success) {
          const summaries = data.summaries.map((summary: any) =>
            WorkoutSummary.fromFirebase(summary)
          );
          setWorkoutSummaries(summaries);
          
          if (userVideos.length > 0 || followers.length > 0 || following.length > 0) {
            const followRequests = [...followers, ...following];
            const parsedActivities = parseActivityType(
              summaries,
              userVideos,
              followRequests,
              currentUser.id
            );
            setActivities(parsedActivities);
          }
        }
      } catch (error) {
        console.error('Error fetching workout summaries:', error);
      }
    };

    fetchWorkoutSummaries();
  }, [currentUser?.id, followers, following, userVideos]);

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  const socialLinks = {
    instagram: currentUser.creator?.instagramHandle,
    twitter: currentUser.creator?.twitterHandle,
    youtube: currentUser.creator?.youtubeUrl
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="relative">
        <div className="h-48 bg-gradient-to-b from-zinc-800 to-zinc-900" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-24">
            <div className="relative inline-block">
              <img 
                src={currentUser.profileImage?.profileImageURL || "/api/placeholder/96/96"}
                alt={currentUser.displayName}
                className="w-24 h-24 rounded-full border-4 border-zinc-900"
              />
            </div>

            <div className="mt-4 text-white">
              <h1 className="text-2xl font-bold">{currentUser.displayName}</h1>
              <p className="text-zinc-400">@{currentUser.username}</p>
              
              <div className="mt-2 flex items-center gap-4 text-sm text-zinc-400">
                <span>{followers.length} followers</span>
                <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                <span>{following.length} following</span>
              </div>

              <p className="mt-4 text-zinc-300">{currentUser.bio}</p>

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

            {/* Tabs Navigation */}
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

            {/* Tab Content */}
            <div className="mt-8">
              {selectedTab === TABS.ACTIVITY && (
                <div className="px-5">
                  {activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8">
                      <StarIcon className="w-12 h-12 text-white/20" />
                      <h3 className="mt-4 text-white font-medium">
                        No activities yet
                      </h3>
                    </div>
                  ) : (
                    <ActivityTab
                      activities={activities}
                      workoutSummaries={workoutSummaries}
                      userVideos={userVideos}
                      username={currentUser.username}
                      isPublicProfile={false}
                      onWorkoutSelect={(summary) => {
                        console.log('Selected workout summary:', summary);
                      }}
                      onVideoSelect={(exercise) => {
                        console.log('Selected exercise:', exercise);
                        setSelectedExercise(exercise);
                      }}
                      onProfileSelect={(userId) => {
                        console.log('Selected user profile:', userId);
                      }}
                    />
                  )}
                </div>
              )}

              {selectedTab === TABS.EXERCISES && (
                <div className="px-5">
                  <h2 className="text-xl text-white font-semibold mb-4">
                    Your Videos ({userVideos.length})
                  </h2>
                  <ExerciseGrid
                    userVideos={userVideos}
                    onSelectVideo={(exercise) => {
                      setSelectedExercise(exercise);
                    }}
                  />
                </div>
              )}

              {selectedTab === TABS.CHALLENGES && (
                <ChallengesTab
                  activeChallenges={activeChallenges}
                  onSelectChallenge={(challenge) => {
                    console.log('Selected challenge:', challenge);
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {selectedExercise && (
          <FullScreenExerciseView
            exercise={selectedExercise}
            user={currentUser}
            onBack={() => setSelectedExercise(null)}
            onProfileClick={() => {
              console.log('Profile clicked');
            }}
          />
        )}
      </div>
    </div>
  );
};

function getSocialLink(platform: string, handle: string): string {
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'youtube':
      return handle;
    default:
      return '#';
  }
}

export default Profile;