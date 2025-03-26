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
import { firebaseStorageService, UploadImageType } from '../../../api/firebase/storage/service';
import { Camera, Trash2, CheckCircle } from 'lucide-react';
import Spacer from '../../../components/Spacer';
import { videoProcessorService } from '../../../api/firebase/video-processor/service';

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
}

const StackGrid: React.FC<StackGridProps> = ({ 
  stacks, 
  isSelecting,
  selectedStacks,
  onToggleSelection,
  onSelectStack 
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
                const username = userService.currentUser?.username;
                router.push(`/workout/${username}/${stack.id}`);
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
  const [selectedTab, setSelectedTab] = useState<TabType>(TABS.EXERCISES);
  const [userVideos, setUserVideos] = useState<Exercise[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);
  const [userStacks, setUserStacks] = useState<Workout[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [followers, setFollowers] = useState<FollowRequest[]>([]);
  const [following, setFollowing] = useState<FollowRequest[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const currentUser = userService.currentUser;

  const [isImageUploading, setIsImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedStacks, setSelectedStacks] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [isProcessingGifs, setIsProcessingGifs] = useState(false);

const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    try {
      setIsImageUploading(true);
      
      const uploadResult = await firebaseStorageService.uploadImage(
        file, 
        UploadImageType.Profile
      );

      // Update user's profile image in Firestore
      if (currentUser) {
        const updatedUser = new User(currentUser.id, {
          ...currentUser.toDictionary(),
          profileImage: {
            profileImageURL: uploadResult.downloadURL,
            imageOffsetWidth: 0,
            imageOffsetHeight: 0
          },
          updatedAt: new Date()
        });

        await userService.updateUser(currentUser.id, updatedUser);
        
        // Optionally, update the current user in the service
        userService.currentUser = updatedUser;
      }
    } catch (error) {
      console.error('Profile image upload failed', error);
      // Optionally show an error toast
    } finally {
      setIsImageUploading(false);
    }
  }
};

const handleToggleSelection = (exercise: Exercise) => {
  setSelectedExercises(prev => {
    // Check if exercise is already selected
    const alreadySelected = prev.find((ex) => ex.id === exercise.id);
    if (alreadySelected) {
      // Remove it
      return prev.filter((ex) => ex.id !== exercise.id);
    } else {
      // Add it
      return [...prev, exercise];
    }
  });
};

const handleDelete = async () => {
  if (selectedTab === TABS.EXERCISES && selectedExercises.length > 0) {
    try {
      await Promise.all(
        selectedExercises.map(ex => userService.deleteUserVideo(ex.id))
      );
      setUserVideos(prev => prev.filter(v => !selectedExercises.some(se => se.id === v.id)));
      setSelectedExercises([]);
    } catch (error) {
      console.error('Error deleting videos:', error);
    }
  } else if (selectedTab === TABS.STACKS && selectedStacks.size > 0) {
    try {
      await Promise.all(
        Array.from(selectedStacks).map(id => userService.deleteStack(id))
      );
      setUserStacks(prev => prev.filter(s => !selectedStacks.has(s.id)));
      setSelectedStacks(new Set());
    } catch (error) {
      console.error('Error deleting stacks:', error);
    }
  }
  setIsSelecting(false);
};

// Function to process all videos without GIFs
const handleProcessVideosWithoutGifs = async () => {
  if (isProcessingGifs) return;
  
  setIsProcessingGifs(true);
  try {
    await videoProcessorService.processAllUserVideosWithoutGifs();
    // After processing, refresh the user videos
    if (currentUser?.id) {
      const videos = await userService.fetchUserVideos();
      setUserVideos(videos);
    }
  } catch (error) {
    console.error('Error processing videos without GIFs:', error);
  } finally {
    setIsProcessingGifs(false);
  }
};

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser?.id) return;
  
      try {
        // Fetch followers and following
        const [followers, following, challenges, summaries] = await Promise.all([
          userService.fetchFollowers(),
          userService.fetchFollowing(),
          workoutService.fetchCollections(currentUser.id),
          workoutService.fetchAllWorkoutSummaries()
        ]);
  
        setFollowers(followers);
        setFollowing(following);
        
        // Convert challenges
        const activeChallenges = challenges
          .map(uc => uc.challenge)
          .filter(c => c !== undefined);
          setActiveChallenges(activeChallenges.filter((challenge): challenge is Challenge => challenge !== null));
  
        setWorkoutSummaries(summaries);
  
        // Parsing activities
        const parsedActivities = parseActivityType(
          summaries, 
          userVideos, 
          [...followers, ...following], 
          currentUser.id
        );

        setActivities(parsedActivities);
  
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
  
    fetchUserData();
  }, [currentUser?.id]);

  useEffect(() => {
    const fetchUserStacks = async () => {
      if (!currentUser?.id) return;
      
      try {
        const stacks = await userService.fetchUserStacks();
        setUserStacks(stacks);
        console.log("stacks: ", stacks);
      } catch (error) {
        console.error('Error fetching stacks:', error);
      }
    };

    fetchUserStacks();
  }, [currentUser?.id]);

  useEffect(() => {
    const fetchUserVideos = async () => {
      if (!currentUser?.id) return;
      
      try {
        console.log('[DEBUG-PROFILE-COMPONENT] Starting to fetch user videos for:', currentUser.id);
        const videos = await userService.fetchUserVideos();
        console.log('[DEBUG-PROFILE-COMPONENT] Received videos count:', videos.length);
        
        // Count total unique videos
        const uniqueVideoIds = new Set<string>();
        videos.forEach(exercise => {
          exercise.videos.forEach(video => {
            uniqueVideoIds.add(video.id);
          });
        });
        
        console.log('[DEBUG-PROFILE-COMPONENT] Total unique videos:', uniqueVideoIds.size);
        console.log('[DEBUG-PROFILE-COMPONENT] Video details:', videos.map(v => ({
          id: v.id,
          name: v.name,
          videoCount: v.videos.length,
          videoIds: v.videos.map(vid => vid.id)
        })));
        
        // Check for specific video
        const hasTargetVideo = videos.some(v => 
          v.videos.some(video => video.id === 'UYpNnfGmw9xyPA6dOv2D')
        );
        console.log('[DEBUG-PROFILE-COMPONENT] Contains target video (UYpNnfGmw9xyPA6dOv2D):', hasTargetVideo);
        
        if (hasTargetVideo) {
          const targetExercise = videos.find(v => 
            v.videos.some(video => video.id === 'UYpNnfGmw9xyPA6dOv2D')
          );
          console.log('[DEBUG-PROFILE-COMPONENT] Target video is in exercise:', 
            targetExercise?.name, 
            'with videoCount:', targetExercise?.videos.length
          );
        }
        
        setUserVideos(videos);
      } catch (error) {
        console.error('[DEBUG-PROFILE-COMPONENT] Error fetching user videos:', error);
      }
    };
  
    fetchUserVideos();
  }, [currentUser?.id]);

  const socialLinks = {
    instagram: currentUser.creator?.instagramHandle,
    twitter: currentUser.creator?.twitterHandle,
    youtube: currentUser.creator?.youtubeUrl
  };

  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="relative">
        <div className="h-48 bg-gradient-to-b from-zinc-800 to-zinc-900" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-24">
            

          <div className="relative inline-block">
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleProfileImageUpload}
              className="hidden"
            />
            <div className="relative">
              <img 
                src={currentUser.profileImage?.profileImageURL || "/api/placeholder/96/96"}
                alt={currentUser.displayName}
                className={`w-24 h-24 rounded-full border-4 border-zinc-900 ${isImageUploading ? 'opacity-50' : ''}`}
              />
              {isImageUploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="loader border-t-transparent border-4 border-white rounded-full w-8 h-8 animate-spin"></div>
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-[#E0FE10] text-black p-1 rounded-full shadow-lg hover:bg-[#c8e60e] transition-colors"
                disabled={isImageUploading}
              >
                <Camera size={16} />
              </button>
            </div>
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
                    multiSelection={isSelecting}
                    selectedExercises={selectedExercises}
                    onToggleSelection={handleToggleSelection}
                    onSelectVideo={(exercise) => {
                      if (!isSelecting) {
                        setSelectedExercise(exercise);
                      }
                    }}
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
            user={currentUser}
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