import React, { useEffect, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { SweatlistCollection, SweatlistType } from '../../types/SweatlistCollection';
import { ChallengeStatus, UserChallenge } from '../../types/ChallengeTypes';
import { StackCard, RestDayCard } from '../../components/Rounds/StackCard';
import { Workout, WorkoutStatus, BodyZone } from '../../api/firebase/workout/types';
import ParticipantsSection from '../../components/Rounds/ParticipantsSection';
import RoundChatView from '../../components/Rounds/RoundChatView';
import { GroupMessage, MessageMediaType } from '../../types/ChatTypes';
import SignInModal from "../../components/SignInModal";
import { workoutService } from '../../api/firebase/workout/service';
import { userService } from '../../api/firebase/user';
import { useRouter } from 'next/router';

const ChallengeDetailView = () => {
  const router = useRouter();
  const { id } = router.query;
  
  const [collection, setCollection] = useState<SweatlistCollection | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(true);
  const [userChallenges, setUserChallenge] = useState<UserChallenge[] | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        // Fetch collection data
        const collectionData = await workoutService.getCollectionById(id as string);
        if (!collectionData || !collectionData.challenge) {
          throw new Error('Invalid challenge data received');
        }
        
        console.log(collectionData);
        setCollection(collectionData);
        await fetchWorkouts(collectionData);

        // Fetch user challenge
        await fetchUserChallenge(collection?.challenge?.id ?? "0");

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (router.isReady && id) {
      fetchData();
    }
  }, [id, router.isReady]);

  const fetchUserChallenge = async (challengeId: string) => {
    if (!id) return;
  
    try {
      console.log("This is the challenge ID: " + challengeId);

      const userChallenges = await workoutService.fetchUserChallengesByChallengeId(challengeId);
      console.log("UserChallenge: " + userChallenges);
      setUserChallenge(userChallenges);
    } catch (error) {
      console.error('Error fetching user challenge:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const fetchWorkouts = async (collection: SweatlistCollection) => {
    let sweatlistIds = collection.sweatlistIds;

    // Handle rest workouts
    sweatlistIds = sweatlistIds.map(sweatlistId => {
      if (sweatlistId.id === "rest" && !sweatlistId.sweatlistAuthorId) {
        return {
          ...sweatlistId,
          sweatlistAuthorId: userService.currentUser?.id || "default_author"
        };
      }
      return sweatlistId;
    });

    // Group by author
    const groupedByAuthor = sweatlistIds.reduce((acc, curr) => {
      const authorId = curr.sweatlistAuthorId;
      if (!acc[authorId]) {
        acc[authorId] = [];
      }
      acc[authorId].push(curr);
      return acc;
    }, {} as { [key: string]: typeof sweatlistIds });

    try {
      let allWorkouts: Workout[] = [];
      
      // Fetch workouts for each author
      await Promise.all(Object.entries(groupedByAuthor).map(async ([authorId, sweatlistGroup]) => {
        if (!authorId) return;

        const sweatlists = await workoutService.getAllSweatlists(authorId);
        
        sweatlistGroup.forEach(sweatlistId => {
          if (sweatlistId.sweatlistName === "Rest") {
            // Create rest workout placeholder
            const restWorkout: Workout = {
              id: "rest",
              roundWorkoutId: "rest", // Add roundWorkoutId
              title: "Rest Day",
              description: "Recovery day",
              author: sweatlistId.sweatlistAuthorId,
              exercises: [],
              logs: [],
              duration: 0,
              useAuthorContent: true,
              isCompleted: false,
              workoutStatus: WorkoutStatus.QueuedUp, // Add workoutStatus
              createdAt: new Date(),
              updatedAt: new Date(),
              zone: BodyZone.FullBody, // Add zone
              collectionId: [], // Optional property
              challenge: undefined, // Optional property
              startTime: undefined, // Optional property
              order: 0, // Optional property
              workoutRating: undefined // Optional property
            };
            allWorkouts.push(restWorkout);
          } else {
            const workout = sweatlists?.find(sl => sl.id === sweatlistId.id);
            if (workout) {
              allWorkouts.push(workout);
            }
          }
        });
      }));

      setWorkouts(allWorkouts);
    } catch (error) {
      console.error('Error fetching workouts:', error);
      setError('Failed to fetch workouts');
    }
  };

  const formatDate = (date: Date | string | number): string => {
    // If it's a timestamp (number), convert to milliseconds if needed
    const dateObj = typeof date === 'number' 
      ? new Date(date * 1000) // Convert seconds to milliseconds
      : new Date(date);
  
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateProgress = (): number => {
    if (!collection?.challenge?.startDate || !collection?.challenge?.endDate) return 0;
    
    const start = new Date(collection.challenge.startDate);
    const end = new Date(collection.challenge.endDate);
    const now = new Date();
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    return Math.min(Math.max(elapsed / totalDuration, 0), 1);
  };
  
  // And update the daysInfo calculation too
  // Then use it for daysInfo calculation
  const calculateDays = () => {
    if (!collection?.challenge?.startDate || !collection?.challenge?.endDate) return null;
  
    const start = new Date(collection.challenge.startDate);
    const end = new Date(collection.challenge.endDate);
    const now = new Date();
  
    if (now < start) {
      const days = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { type: 'until-start', days };
    } else if (now < end) {
      const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { type: 'remaining', days };
    } else {
      return { type: 'ended', days: 0 };
    }
  };

  const handleSwapOrder = async (workout: Workout, newOrder: number) => {
    // Implement workout reordering logic
    try {
      // Update order in backend
      // await workoutService.updateWorkoutOrder(workout.id, newOrder);
      // Refetch workouts to show updated order
      if (collection) {
        await fetchWorkouts(collection);
      }
    } catch (error) {
      console.error('Failed to update workout order:', error);
    }
  };

  const handleCalendarTap = async (workout: Workout, date: Date) => {
    // Implement calendar scheduling logic
    try {
      // await workoutService.scheduleWorkout(workout.id, date);
      // Optionally refresh data
    } catch (error) {
      console.error('Failed to schedule workout:', error);
    }
  };

  const handleSendMessage = async (message: string, image?: File) => {
    if (!collection?.id || !userService.currentUser) return;

    try {
      let mediaUrl = '';
      if (image) {
        // Upload image if provided
        // mediaUrl = await workoutService.uploadChatImage(image);
      }

      const messageData = {
        content: message,
        mediaURL: mediaUrl,
        mediaType: image ? MessageMediaType.Image : MessageMediaType.None,
        sender: userService.currentUser,
        timestamp: new Date(),
      };

      // await workoutService.sendChallengeMessage(collection.id, messageData);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;
  }

  if (!isSignedIn) {
    return (
      <SignInModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSignInSuccess={(user) => {
          setIsSignedIn(true);
          setIsModalVisible(false);
        }}
        onSignInError={(error) => {
          console.error('Sign-in error:', error);
          alert('Sign-in failed. Please try again.');
        }}
        onSignUpSuccess={(user) => {
          setIsSignedIn(true);
          setIsModalVisible(false);
        }}
        onSignUpError={(error) => {
          console.error('Sign-up error:', error);
          alert('Sign-up failed. Please try again.');
        }}
        onQuizComplete={() => {
          console.log('Quiz completed');
        }}
        onQuizSkipped={() => {
          console.log('Quiz skipped');
        }}
      />
    );
  }

  const daysInfo = calculateDays();
  const progress = calculateProgress();

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="h-48 bg-gradient-to-b from-zinc-800 to-zinc-900" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-24">
          {/* Header Section */}
          <div className="mt-4 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold">{collection?.challenge?.title}</h1>
                <p className="text-zinc-400 mt-1">{collection?.challenge?.subtitle}</p>
              </div>
              
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <ChevronDown className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Date Range Cards */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-zinc-400 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Starts</span>
                </div>
                <div className="text-lg font-semibold">
                  {collection?.challenge?.startDate ? formatDate(collection.challenge.startDate) : 'TBD'}
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-zinc-400 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Ends</span>
                </div>
                <div className="text-lg font-semibold">
                  {collection?.challenge?.endDate ? formatDate(collection.challenge.endDate) : 'TBD'}
                </div>
              </div>
            </div>

            {/* Progress Card */}
            <div className="mt-6 bg-zinc-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Challenge Progress</h2>
                {daysInfo && (
                  <div className="text-sm text-[#E0FE10]">
                    {daysInfo.type === 'until-start' ? (
                      <span>Starts in {daysInfo.days}d</span>
                    ) : daysInfo.type === 'remaining' ? (
                      <span>{daysInfo.days}d left</span>
                    ) : (
                      <span>Challenge ended</span>
                    )}
                  </div>
                )}
              </div>

              <div className="relative h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-[#E0FE10] rounded-full transition-all duration-500 ease-in-out"
                  style={{ width: `${calculateProgress() * 100}%` }}
                 />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{Math.round(calculateProgress() * 100)}%</div>
                  <div className="text-sm text-zinc-400">Complete</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{workouts.length}</div>
                  <div className="text-sm text-zinc-400">Workouts</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {userChallenges?.length || 0}
                  </div>
                  <div className="text-sm text-zinc-400">Participants</div>
                </div>
              </div>
            </div>

            {/* Participants Section */}
            <ParticipantsSection
                participants={userChallenges || []} // Provide an empty array if userChallenges is null
                onParticipantClick={(participant: UserChallenge) => {
                  router.push(`/profile/${participant.username}`);
                }}
              />

            {/* Chat Section */}
            {collection && (
              <div className="mt-8">
                <RoundChatView
                  participants={collection.challenge?.participants || []}
                  messages={[]} // Messages would be fetched and updated in real-time
                  onSendMessage={handleSendMessage}
                  currentUser={userService.currentUser}
                />
              </div>
            )}

            {/* Stacks Section */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Stacks in this Round</h2>
                <button 
                  onClick={() => setEditMode(!editMode)}
                  className="px-3 py-1 text-sm bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors"
                >
                  {editMode ? 'Done' : 'Edit'}
                </button>
              </div>

              <div className="space-y-4">
                {workouts.map((workout, index) => (
                  workout.id === "rest" ? (
                    <RestDayCard
                      key={`rest-${index}`}
                      selectedOrder={index}
                      maxOrder={workouts.length}
                      showArrows={editMode}
                      showCalendar={true}
                      workoutDate={new Date()}
                      isComplete={false}
                      onPrimaryAction={() => console.log('Rest day clicked')}
                      onCalendarTap={(date) => console.log('Rest day calendar tapped:', date)}
                      onUpdateOrder={(newOrder) => handleSwapOrder(workout, newOrder)}
                    />
                  ) : (
                    <StackCard
                      key={workout.id}
                      workout={workout}
                      gifUrls={workout.exercises?.map(ex => ex.exercise?.videos?.[0]?.gifURL || '') || []}
                      selectedOrder={index}
                      maxOrder={workouts.length}
                      showArrows={editMode}
                      showCalendar={true}
                      workoutDate={new Date()}
                      isComplete={false}
                      isChallengeEnabled={true}
                      onPrimaryAction={() => {
                        // Assuming the workout's author is the username we want to use
                        const username = workout.author;
                        router.push(`/workout/${username}/${workout.id}`);
                      }}
                      onCalendarTap={(date) => handleCalendarTap(workout, date)}
                      onUpdateOrder={(newOrder) => handleSwapOrder(workout, newOrder)}
                    />
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeDetailView;