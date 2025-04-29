import React, { useState, useEffect, useRef } from 'react';
import { userService, FollowRequest, User } from '../../../api/firebase/user';
import { Exercise } from '../../../api/firebase/exercise/types';
import { Challenge, Workout } from '../../../api/firebase/workout/types';
import { WorkoutSummary } from '../../../api/firebase/workout/types';
import { workoutService } from '../../../api/firebase/workout/service'
import { UserActivity } from '../../../types/Activity';
import { StarIcon } from '@heroicons/react/24/outline';
import { ActivityTab } from '../../ActivityTab';
import { ChallengesTab } from '../../ChallengesTab';
import ExerciseGrid from '../../ExerciseGrid';
import FullScreenExerciseView from '../../../pages/FullscreenExerciseView';
import { parseActivityType } from '../../../utils/activityParser';
import { StackCard } from '../../../components/Rounds/StackCard';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { setUser } from '../../../redux/userSlice';
import { firebaseStorageService, UploadImageType } from '../../../api/firebase/storage/service';
import { Camera, Trash2, CheckCircle, User as UserIcon } from 'lucide-react';
import Spacer from '../../../components/Spacer';
import { videoProcessorService } from '../../../api/firebase/video-processor/service';
import { exerciseService } from '../../../api/firebase/exercise/service';
import { useUser } from '../../../hooks/useUser';

interface StackGridProps {
  stacks: Workout[];
  onSelectStack: (stack: Workout) => void;
}

interface StackGridProps {
  stacks: Workout[];
  isSelecting?: boolean;
  selectedStacks?: Set<string>;
  onToggleSelection?: (stack: Workout) => void;
  onSelectStack: (stack: Workout) => void;
  username?: string;
}

const StackGrid: React.FC<StackGridProps> = ({ 
  stacks, 
  isSelecting,
  selectedStacks,
  onToggleSelection,
  onSelectStack,
  username
}) => {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-4">
      {stacks.map((stack, index) => (
        <div 
          key={stack.id}
          className={`relative ${
            isSelecting ? 'cursor-pointer' : ''
          }`}
          onClick={() => {
            if (isSelecting && onToggleSelection) {
              onToggleSelection(stack);
            }
          }}
        >
          {isSelecting && (
            <div className={`absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 z-10
              ${selectedStacks?.has(stack.id) 
                ? 'bg-[#E0FE10] border-[#E0FE10]' 
                : 'border-zinc-500'
              }`}
            />
          )}
          <StackCard
            workout={stack}
            gifUrls={stack.exercises?.map(ex => ex.exercise.videos?.[0]?.gifURL || '') || []}
            maxOrder={index}
            showArrows={false}
            showCalendar={true}
            onPrimaryAction={() => {
              if (!isSelecting) {
                router.push(`/workout/${username || 'unknown'}/${stack.id}`);
              }
            }}
          />
        </div>
      ))}
    </div>
  );
};

const TABS = {
  ACTIVITY: 'activity',
  EXERCISES: 'moves',
  STACKS: 'stacks',
  CHALLENGES: 'rounds',
} as const;

type TabType = typeof TABS[keyof typeof TABS];

const Profile: React.FC = () => {
  // --- Define ALL hooks FIRST ---
  const [selectedTab, setSelectedTab] = useState<TabType>(TABS.EXERCISES);
  const [userData, setUserData] = useState<User | null>(null);
  const [userVideos, setUserVideos] = useState<Exercise[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [followers, setFollowers] = useState<FollowRequest[]>([]);
  const [following, setFollowing] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true); // Start loading true
  const [error, setError] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedStacks, setSelectedStacks] = useState<Set<string>>(new Set());
  const [userStacks, setUserStacks] = useState<Workout[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isProcessingGifs, setIsProcessingGifs] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Keep this one for overall loading
  const [isCurrentUserProfile, setIsCurrentUserProfile] = useState(false);
  const hookCurrentUser = useUser();
  const router = useRouter();
  const dispatch = useDispatch();
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);

  console.log('[Profile Component Render] Rendering component. Current User ID:', hookCurrentUser?.id);

  // ... Event handlers (handleProfileImageUpload, handleToggleSelection, handleDelete, etc.) ...
  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && hookCurrentUser) {
      try {
        setIsImageUploading(true);
        const uploadResult = await firebaseStorageService.uploadImage(file, UploadImageType.Profile);
        const updatedUser = new User(hookCurrentUser.id, {
          ...hookCurrentUser.toDictionary(),
          profileImage: { profileImageURL: uploadResult.downloadURL, imageOffsetWidth: 0, imageOffsetHeight: 0 },
          updatedAt: new Date()
        });
        await userService.updateUser(hookCurrentUser.id, updatedUser);
        userService.nonUICurrentUser = updatedUser;
        // Dispatch update to Redux only if it's the current user's profile being viewed (which it always is here)
        dispatch(setUser(updatedUser.toDictionary()));
         // Manually update local state if needed, or rely on hookCurrentUser update via Redux
         setUserData(updatedUser);
      } catch (error) {
        console.error('Profile image upload failed', error);
        setError('Failed to upload profile image.');
      } finally {
        setIsImageUploading(false);
      }
    }
  };

  const handleToggleSelection = (exercise: Exercise) => {
    setSelectedExercises(prev => {
      const alreadySelected = prev.find((ex) => ex.id === exercise.id);
      if (alreadySelected) {
        return prev.filter((ex) => ex.id !== exercise.id);
      } else {
        return [...prev, exercise];
      }
    });
  };

  const handleDelete = async () => {
    // ... (keep existing handleDelete logic) ...
    if (!hookCurrentUser) return;
    if (selectedTab === TABS.EXERCISES && selectedExercises.length > 0) {
      try {
        // Assuming deleteUserVideo needs user ID implicitly or is handled in service
        await Promise.all(
          selectedExercises.map(ex => userService.deleteUserVideo(ex.id)) // Check if this needs userId
        );
        setUserVideos(prev => prev.filter(v => !selectedExercises.some(se => se.id === v.id)));
        setSelectedExercises([]);
      } catch (error) {
        console.error('Error deleting videos:', error);
        setError('Failed to delete selected videos.');
      }
    } else if (selectedTab === TABS.STACKS && selectedStacks.size > 0) {
      try {
        await Promise.all(
          Array.from(selectedStacks).map(id => userService.deleteStack(id)) // Check if this needs userId
        );
        setUserStacks(prev => prev.filter(s => !selectedStacks.has(s.id)));
        setSelectedStacks(new Set());
      } catch (error) {
        console.error('Error deleting stacks:', error);
        setError('Failed to delete selected stacks.');
      }
    }
    setIsSelecting(false);
  };

  const handleProcessVideosWithoutGifs = async () => {
     // ... (keep existing handleProcessVideosWithoutGifs logic) ...
    if (isProcessingGifs || !isCurrentUserProfile) return;
    setIsProcessingGifs(true);
    try {
      await videoProcessorService.processAllUserVideosWithoutGifs();
      if (hookCurrentUser?.id) {
        const videos = await userService.fetchUserVideos(hookCurrentUser.id);
        setUserVideos(videos);
      }
    } catch (error) {
      console.error('Error processing videos without GIFs:', error);
      setError('Failed to process videos.');
    } finally {
      setIsProcessingGifs(false);
    }
  };

  const handleDeleteSpecificVideo = async (videoId: string, exerciseId: string) => {
     // ... (keep existing handleDeleteSpecificVideo logic) ...
    if (!window.confirm('Are you sure you want to delete this video?')) {
      return;
    }
    const userId = hookCurrentUser?.id;
    if (!userId) {
      console.error('User not logged in');
      setError('You must be logged in to delete videos.');
      return;
    }
    try {
      await exerciseService.deleteSpecificExerciseVideo(exerciseId, videoId, userId);
      console.log(`Successfully deleted video ${videoId}`);
      const videos = await userService.fetchUserVideos(userId);
      setUserVideos(videos);
    } catch (error) {
      console.error('Failed to delete video:', error);
       setError('Failed to delete the video.');
    }
  };

  // --- Define ALL useEffect hooks NEXT ---
  useEffect(() => {
    const fetchUserData = async () => {
      const currentUserId = hookCurrentUser?.id;
      const currentUsername = hookCurrentUser?.username;
      console.log('[Profile useEffect] Effect triggered. Current User ID:', currentUserId);
      if (!currentUserId) {
        console.log('[Profile useEffect] No current user ID available, exiting.');
        // If no user ID, we probably shouldn't be showing this component, or should show a different state.
        // For now, we just exit, but isLoading might stay true indefinitely.
        // Consider setting isLoading false and showing an error/login prompt.
        // setIsLoading(false);
        return;
      }

      // Only set loading true if we are actually going to fetch
      // and if userData is not already loaded (to avoid flicker on hook changes)
      if (!userData) {
           console.log('[Profile useEffect] Setting isLoading to true for user ID:', currentUserId);
           setIsLoading(true);
      }

      try {
        if (!currentUsername) {
            console.error('[Profile useEffect] Current user username is missing, cannot fetch profile by username.');
            setError('Failed to load profile: Missing username.');
            setIsLoading(false); // Stop loading on error
            return;
        }
        console.log('[Profile useEffect] Fetching user data for username:', currentUsername);
        const profileUser = await userService.getUserByUsername(currentUsername);
        console.log('[Profile useEffect] Fetched profileUser object:', profileUser);
        if (!profileUser) {
          console.warn('[Profile useEffect] No profileUser found for current user ID:', currentUserId);
          setError('Failed to load your profile data.');
          setUserData(null);
          // No return here, finally will set isLoading false
        } else {
            setUserData(profileUser);
            setIsCurrentUserProfile(true); // Always the current user in this component

            // --- Fetch related data only after profileUser is confirmed ---
            console.log('[Profile useEffect] Fetching followers, following, challenges, summaries for user ID:', profileUser.id);
            const [followersData, followingData, challengesData, summariesData] = await Promise.all([
              userService.fetchFollowers(),
              userService.fetchFollowing(),
              workoutService.fetchCollections(profileUser.id),
              workoutService.fetchAllWorkoutSummaries() // Still might need filtering
            ]);
            console.log('[Profile useEffect] Fetched counts:', { followers: followersData.length, following: followingData.length, challenges: challengesData.length, summaries: summariesData.length });
            setFollowers(followersData);
            setFollowing(followingData);
            const activeChallenges = challengesData
              .map(uc => uc.challenge)
              .filter((c): c is Challenge => !!c);
            setActiveChallenges(activeChallenges);
            setWorkoutSummaries(summariesData);

            // --- Parse activities after other data is ready --- 
            // (Still depends on userVideos from the *other* effect, which might not be ready yet)
            console.log('[Profile useEffect] Parsing activities (depends on userVideos state)...');
            const userActivities = parseActivityType(
                summariesData,
                userVideos, // <<<<<< PROBLEM: userVideos state might be stale here
                [...followersData, ...followingData],
                profileUser.id
            );
            setActivities(userActivities);
            console.log('[Profile useEffect] Data processing complete.');
        }
      } catch (error) {
        console.error('[Profile useEffect] Error fetching user data:', error);
        setUserData(null);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        console.log('[Profile useEffect] Setting isLoading to false in finally block.');
        setIsLoading(false);
      }
    };
    fetchUserData();
    // Dependency: Re-run if user ID changes. Avoid depending on userVideos here.
  }, [hookCurrentUser?.id, hookCurrentUser?.username]);

  // Separate useEffect for fetching user videos
  useEffect(() => {
    const fetchUserVideos = async () => {
      const userId = hookCurrentUser?.id; // Use current user ID directly
      if (!userId) return;
      console.log('[Profile Videos useEffect] Fetching videos for user ID:', userId);
      try {
        // Consider setting a specific loading state for videos?
        const videos = await userService.fetchUserVideos(userId);
        console.log('[Profile Videos useEffect] Fetched videos count:', videos.length);
        setUserVideos(videos);
      } catch (error) {
        console.error('[Profile Videos useEffect] Error fetching user videos:', error);
        setError('Failed to load your videos.'); // Set specific error
      }
    };
    fetchUserVideos();
  }, [hookCurrentUser?.id]); // Depend on current user ID

  // Separate useEffect for fetching user stacks
  useEffect(() => {
    const fetchUserStacks = async () => {
       const userId = hookCurrentUser?.id; // Use current user ID directly
       if (!userId) return;
       console.log('[Profile Stacks useEffect] Fetching stacks for user ID:', userId);
      try {
        // Consider setting a specific loading state for stacks?
        const stacks = await userService.fetchUserStacks(userId);
        console.log('[Profile Stacks useEffect] Fetched stacks count:', stacks.length);
        setUserStacks(stacks);
      } catch (error) {
        console.error('[Profile Stacks useEffect] Error fetching stacks:', error);
        setError('Failed to load your stacks.'); // Set specific error
      }
    };
    fetchUserStacks();
  }, [hookCurrentUser?.id]); // Depend on current user ID

  // Conditional returns moved here
  if (isLoading) {
    console.log('[Profile Component Render] Showing loading state (initial or main data fetch).');
    return <div className="flex items-center justify-center min-h-screen">Loading Profile...</div>;
  }
  if (error) {
     console.log('[Profile Component Render] Error state is set:', error);
     return <div className="flex items-center justify-center min-h-screen text-red-500">Error: {error}</div>;
  }
  if (!userData) {
    console.log('[Profile Component Render] No userData and not loading/error, showing User not found.');
    return <div className="flex items-center justify-center min-h-screen">User data could not be loaded.</div>;
  }

  // --- Now safe to render the main component body ---
  const socialLinks = {
      instagram: userData.creator?.instagramHandle,
      twitter: userData.creator?.twitterHandle,
      youtube: userData.creator?.youtubeUrl
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="relative">
        <div className="h-48 bg-gradient-to-b from-zinc-800 to-zinc-900" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-24">
            

          <div className="relative inline-block group">
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleProfileImageUpload}
              className="hidden"
            />
            <div className="relative">
              {userData.profileImage?.profileImageURL ? (
                <img 
                  src={userData.profileImage.profileImageURL}
                  alt={userData.displayName || userData.username}
                  className={`w-24 h-24 rounded-full border-4 border-zinc-900 object-cover ${isImageUploading ? 'opacity-50' : ''}`}
                />
              ) : (
                <div className={`w-24 h-24 rounded-full border-4 border-zinc-900 bg-zinc-800 flex items-center justify-center ${isImageUploading ? 'opacity-50' : ''}`}>
                  <UserIcon className="w-12 h-12 text-zinc-400" />
                </div>
              )}
              {isImageUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="loader border-t-transparent border-4 border-[#E0FE10] rounded-full w-8 h-8 animate-spin"></div>
                </div>
              )}
              {isCurrentUserProfile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-[#E0FE10] text-black p-1 rounded-full shadow-lg hover:bg-[#c8e60e] transition-colors"
                  disabled={isImageUploading}
                  aria-label="Upload profile picture"
                >
                  <Camera size={16} />
                </button>
              )}
            </div>
          </div>

            <div className="mt-4 text-white">
              <h1 className="text-2xl font-bold">{userData.displayName || `@${userData.username}`}</h1>
              <p className="text-zinc-400">@{userData.username}</p>
              
              <div className="mt-2 flex items-center gap-4 text-sm text-zinc-400">
                <span>{followers.length} followers</span>
                <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                <span>{following.length} following</span>
              </div>

              <p className="mt-4 text-zinc-300">{userData.bio}</p>

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
                      username={userData.username}
                      isPublicProfile={false}
                      onWorkoutSelect={(summary) => {
                        //select summary
                      }}
                      onVideoSelect={(exercise) => {
                        setSelectedExercise(exercise);
                      }}
                      onProfileSelect={(userId) => {
                        //oprofile view
                      }}
                    />
                  )}
                </div>
              )}

              {selectedTab === TABS.STACKS && (
                <div className="px-5">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl text-white font-semibold">
                        Your Stacks ({userStacks.length})
                      </h2>
                      <button
                        onClick={() => router.push('/createStack')}
                        className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg hover:bg-[#c8e60e] transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Create a Stack
                      </button>
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setIsSelecting(!isSelecting)}
                        className="text-zinc-400 hover:text-white"
                      >
                        {isSelecting ? 'Cancel' : 'Select'}
                      </button>
                      {isSelecting && selectedStacks.size > 0 && (
                        <button
                          onClick={handleDelete}
                          className="text-red-500 hover:text-red-400"
                        >
                          Delete ({selectedStacks.size})
                        </button>
                      )}
                    </div>
                  </div>
                  <StackGrid
                    stacks={[...userStacks].sort(
                      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )}
                    isSelecting={isSelecting}
                    selectedStacks={selectedStacks}
                    onToggleSelection={(stack) => {
                      setSelectedStacks((prev) => {                        
                        const next = new Set(prev);
                        if (next.has(stack.id)) {
                          next.delete(stack.id);
                        } else {
                          next.add(stack.id);
                        }
                        return next;
                      });
                    }}
                    onSelectStack={(stack) => {
                      if (!isSelecting) {
                        // Handle normal stack selection
                      }
                    }}
                    username={hookCurrentUser?.username}
                  />
                </div>
              )}


              {selectedTab === TABS.EXERCISES && (
                <div className="px-5">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-xl text-white font-semibold">
                        Your Moves ({userVideos.length})
                      </h2>
                      <p className="text-sm text-zinc-400 mt-1">
                        {userVideos.reduce((total, ex) => total + ex.videos.length, 0)} total videos • Multiple videos per move
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setIsSelecting(!isSelecting)}
                        className="text-zinc-400 hover:text-white"
                      >
                        {isSelecting ? 'Cancel' : 'Select'}
                      </button>
                      {isSelecting && selectedExercises.length > 0 && (
                        <button
                          onClick={handleDelete}
                          className="text-red-500 hover:text-red-400 flex items-center gap-2"
                        >
                          <Trash2 size={16} />
                          <span>Delete ({selectedExercises.length})</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <ExerciseGrid
                    userVideos={userVideos}
                    onSelectVideo={(exercise) => {
                      if (!isSelecting) {
                        setSelectedExercise(exercise);
                      }
                    }}
                    onDeleteVideo={handleDeleteSpecificVideo}
                  />
                </div>
              )}

              {selectedTab === TABS.CHALLENGES && (
                <div className="px-5">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl text-white font-semibold">
                        Your Rounds ({activeChallenges.length})
                      </h2>
                      <button
                        onClick={() => router.push('/createRound')}
                        className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg hover:bg-[#c8e60e] transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Create a Round
                      </button>
                    </div>
                  </div>
                  <ChallengesTab
                    activeChallenges={activeChallenges}
                    onSelectChallenge={(challenge) => {
                      console.log('Selected challenge:', challenge.startDate);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <Spacer size={100}></Spacer>
        </div>

        {selectedExercise && (
          <FullScreenExerciseView
            exercise={selectedExercise}
            user={userData}
            onBack={() => setSelectedExercise(null)}
            onProfileClick={() => {
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