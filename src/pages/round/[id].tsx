import React, { useEffect, useState } from 'react';
import { Calendar, ChevronDown, Users, Clock, Flag } from 'lucide-react';
import { SweatlistCollection, SweatlistIdentifiers } from '../../api/firebase/workout/types';
import { ChallengeStatus, UserChallenge, Challenge } from '../../api/firebase/workout/types';
import { StackCard, RestDayCard } from '../../components/Rounds/StackCard';
import { Workout, WorkoutStatus, BodyZone } from '../../api/firebase/workout/types';
import ParticipantsSection from '../../components/Rounds/ParticipantsSection';
import RoundChatView from '../../components/Rounds/RoundChatView';
import { GroupMessage, MessageMediaType } from '../../api/firebase/chat/types';
import { workoutService } from '../../api/firebase/workout/service';
import { userService, User } from '../../api/firebase/user';
import { useRouter } from 'next/router';
import { RootState } from '../../redux/store';
import { useSelector } from 'react-redux';

import { ChatService } from '../../api/firebase/chat/service';
import { ChallengeWaitingRoomView, ChallengeWaitingRoomViewModel } from '../../components/Rounds/ChallengeWaitingRoomView'

const ChallengeDetailView = () => {
  const router = useRouter();
  const { id } = router.query;
  
  const [collection, setCollection] = useState<SweatlistCollection | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[] | null>(null);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatExpanded, setChatExpanded] = useState(true);

  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [hosts, setHosts] = useState<User[]>([]);

  const { currentUser } = useSelector((state: RootState) => state.user);

  // 2. Fetch the host users using the collection.ownerId once the collection is loaded:
  useEffect(() => {
    if (collection && collection.ownerId && collection.ownerId.length > 0) {
      userService.getUsersByIds(collection.ownerId)
        .then(setHosts)
        .catch(err => console.error("Error fetching hosts:", err));
    }
  }, [collection]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (collection?.challenge?.id) {
        try {
          const messages = await ChatService.getInstance().fetchChallengeMessages(collection.challenge.id);
          setMessages(messages);
          calculateUnread(messages);
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      }
    };
    
    fetchMessages();
    const unsubscribe = setupRealtimeUpdates();
    return () => unsubscribe();
  }, [collection?.challenge?.id]);

  useEffect(() => {
    if (collection?.challenge?.id && currentUser) {
      const unreadMessages = messages.filter(msg => !msg.readBy[currentUser.id]);
      if (unreadMessages.length > 0) {
        ChatService.getInstance().markMessagesAsRead(
          collection.challenge.id,
          currentUser.id,
          unreadMessages.map(msg => msg.id)
        );
      }
    }
  }, [messages, collection?.challenge?.id, currentUser]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        const collectionData = await workoutService.getCollectionById(id as string);

        console.log("this is the collection data:", {...collectionData});
        if (!collectionData || !collectionData.challenge) {
          throw new Error('Invalid challenge data received');
        }
        
        setCollection(collectionData);
        await fetchWorkouts(collectionData);

        if (collectionData.challenge.id) {
          await fetchUserChallenge(collectionData.challenge.id);
        }
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

  const setupRealtimeUpdates = () => {
    return ChatService.getInstance().subscribeToMessages(collection?.challenge?.id || '', (newMessages) => {
      setMessages(newMessages);
      calculateUnread(newMessages);
    });
  };
  
  const calculateUnread = (messages: GroupMessage[]) => {
    const count = messages.filter(msg => 
      !msg.readBy[currentUser?.id || '']
    ).length;
    setUnreadCount(count);
  };

  const fetchUserChallenge = async (challengeId: string) => {
    if (!challengeId) return;

    setParticipantsLoading(true);
    const maxRetries = 3;
    let retries = 0;

    const tryFetch = async (): Promise<void> => {
      try {
        const userChallenges = await workoutService.fetchUserChallengesByChallengeId(challengeId);
        setUserChallenges(userChallenges);
      } catch (error) {
        console.error(`Error fetching user challenge (attempt ${retries + 1}):`, error);
        if (retries < maxRetries) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          await tryFetch();
        } else {
          console.error('Max retries reached. Failed to fetch user challenge.');
          setError('Failed to load participants. Please try refreshing the page.');
        }
      } finally {
        setParticipantsLoading(false);
      }
    };

    await tryFetch();
  };

  const fetchWorkouts = async (collection: SweatlistCollection) => {
    let sweatlistIds = collection.sweatlistIds;
   
    // Handle rest workouts
    sweatlistIds = sweatlistIds.map((sweatlistId: SweatlistIdentifiers) => {
      if (sweatlistId.id === "rest" && !sweatlistId.sweatlistAuthorId) {
        return {
          ...sweatlistId,
          sweatlistAuthorId: userService.currentUser?.id || "default_author"
        };
      }
      return sweatlistId;
    });
   
    // Group by author 
    const groupedByAuthor = sweatlistIds.reduce((acc: { [key: string]: SweatlistIdentifiers[] }, curr: SweatlistIdentifiers) => {
      const authorId = curr.sweatlistAuthorId;
      if (!acc[authorId]) {
        acc[authorId] = [];
      }
      acc[authorId].push(curr);
      return acc;
    }, {});
   
    try {
      let allWorkouts: Workout[] = [];
      
      await Promise.all(Object.entries(groupedByAuthor).map(async ([authorId, sweatlistGroup]: [string, SweatlistIdentifiers[]]) => {
        if (!authorId) return;
   
        const sweatlists = await workoutService.getAllSweatlists(authorId);
        
        sweatlistGroup.forEach(sweatlistId => {
          if (sweatlistId.sweatlistName === "Rest") {
            // Create rest workout placeholder
            const restWorkout = new Workout({
              id: "rest",
              roundWorkoutId: "rest", 
              title: "Rest Day",
              description: "Recovery day",
              author: sweatlistId.sweatlistAuthorId,
              exercises: [],
              logs: [],
              duration: 0,
              useAuthorContent: true,
              isCompleted: false,
              workoutStatus: WorkoutStatus.QueuedUp,
              createdAt: new Date(),
              updatedAt: new Date(),
              zone: BodyZone.FullBody,
              collectionId: [],
              challenge: undefined,
              startTime: undefined,
              order: 0,
              workoutRating: undefined
            });
            allWorkouts.push(restWorkout);
          } else {
            const workout = sweatlists?.find(sl => sl.id === sweatlistId.id);
            if (workout) {
              if (Array.isArray(workout.exercises)) {
                workout.exercises.forEach((exercise, index) => {
                  if (exercise && exercise.exercise) {
                    // Exercise validation if needed
                  }
                });
              }
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

  const toggleChatExpansion = () => {
    setChatExpanded(!chatExpanded);
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
    if (!collection?.challenge?.id || !currentUser) return;
  
    try {
      let mediaUrl: string | null = null;
      if (image) {
        mediaUrl = await ChatService.getInstance().uploadMedia(image);
        if (!mediaUrl) {
          console.error('Failed to upload image');
          return; // Or handle this case as appropriate for your app
        }
      }
  
      const messageData: Omit<GroupMessage, 'id'> = {
        sender: User.toShortUser(currentUser), // Assuming you've added the toShortUser method to your User class
        content: message,
        timestamp: new Date(),
        readBy: {},
        mediaURL: mediaUrl,
        mediaType: image ? MessageMediaType.Image : MessageMediaType.None,
        checkinId: null,
        gymName: null
      };
  
      await ChatService.getInstance().sendMessage(collection.challenge.id, messageData);
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

  const daysInfo = calculateDays();
  const progress = calculateProgress();

  // Determine if the challenge has started
  const challengeHasStarted = collection?.challenge?.startDate
  ? new Date() >= new Date(collection.challenge.startDate)
  : false;

  // Determine if the waiting room should be shown:
  // Show waiting room if:
  //   - A collection exists,
  //   - A current user exists,
  //   - The current user is NOT an owner,
  //   - AND either the challenge is still in Draft status OR it hasn't started yet.
  const shouldShowWaitingRoom =
  collection &&
  currentUser &&
  // !collection.ownerId.includes(currentUser.id) &&
  (collection.challenge?.status === ChallengeStatus.Draft || !challengeHasStarted);

  if (shouldShowWaitingRoom) {
    // Create a minimal waiting room view model:
    const waitingRoomVM: ChallengeWaitingRoomViewModel = {
      challenge: collection!.challenge, // safe to assert because waiting room shows only when collection exists
      challengeDetailViewModel: { collection: collection! },
      fetchChatMessages: () => {
        ChatService.getInstance()
          .fetchChallengeMessages(collection!.challenge!.id)
          .then(() => {})
          .catch((err: any) => console.error(err));
      },
      joinChallenge: (challenge: Challenge, completion: (uc: UserChallenge | null) => void) => {
        workoutService.joinChallenge({ username: currentUser!.username, challengeId: challenge.id })
          .then(() => {
            // After joining, pass a dummy value (or re-fetch as needed)
            completion(null);
          })
          .catch((err: any) => {
            console.error(err);
            completion(null);
          });
      },
      // If you need to include appCoordinator, add it here.
    };
  
    return (
      <ChallengeWaitingRoomView 
        viewModel={waitingRoomVM}
        initialParticipants={userChallenges || []}
      />
    );
  }

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

            {hosts.length > 0 && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold text-white">Hosted by</h2>
                <div className="flex space-x-4 mt-2 overflow-x-auto">
                  {hosts.map((host) => (
                    <div key={host.id} className="flex flex-col items-center">
                      <img
                        src={host.profileImage.profileImageURL}
                        alt={host.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <span className="text-sm text-gray-300">@{host.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                {chatExpanded ? (
                  <RoundChatView
                    participants={collection.challenge?.participants || []}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    currentUser={currentUser}
                    onCollapse={toggleChatExpansion}
                  />
                ) : (
                  <></>
                  // <ChatPreviewCard
                  //   messages={messages}
                  //   unreadCount={unreadCount}
                  //   onExpand={toggleChatExpansion}
                  // />
                )}
              </div>
            )}

            {/* Stacks Section */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Stacks in this Round</h2>
                {/* <button 
                  onClick={() => setEditMode(!editMode)}
                  className="px-3 py-1 text-sm bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors"
                >
                  {editMode ? 'Done' : 'Edit'}
                </button> */}
              </div>

              <div className="space-y-4">
              {workouts.map((workout, index) => {
                // Calculate workout date based on challenge start date and index
                const workoutDate = collection?.challenge?.startDate 
                  ? new Date(new Date(collection.challenge.startDate).getTime() + (index * 24 * 60 * 60 * 1000))
                  : new Date();

                // Get current day index based on challenge start date
                const currentDayIndex = collection?.challenge?.startDate ? (() => {
                  const startDate = new Date(collection.challenge.startDate);
                  startDate.setHours(0, 0, 0, 0);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const diffTime = Math.abs(today.getTime() - startDate.getTime());
                  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
                })() : 0;

                return workout.id === "rest" ? (
                  <RestDayCard
                    key={`rest-${index}`}
                    selectedOrder={index}
                    maxOrder={workouts.length}
                    showArrows={editMode}
                    showCalendar={true}
                    workoutDate={workoutDate}
                    isComplete={false}
                    challengeStartDate={collection?.challenge?.startDate}
                    challengeHasStarted={
                      collection?.challenge?.status === ChallengeStatus.Published && 
                      new Date() >= new Date(collection?.challenge?.startDate || 0)
                    }
                    currentDayIndex={currentDayIndex}
                    index={index}
                    onPrimaryAction={() => console.log('Rest day clicked')}
                    onCalendarTap={(date) => console.log('Rest day calendar tapped:', date)}
                    onUpdateOrder={(newOrder) => handleSwapOrder(workout, newOrder)}
                  />
                ) : (
                  <StackCard
                    key={workout.id}
                    workout={workout}
                    gifUrls={workout.exercises?.map(ex => {
                      return ex.exercise?.videos?.[0]?.gifURL || '';
                    }) || []}
                    selectedOrder={index}
                    maxOrder={workouts.length}
                    showArrows={editMode}
                    showCalendar={true}
                    workoutDate={workoutDate}
                    isComplete={false}
                    isChallengeEnabled={true}
                    challengeStartDate={collection?.challenge?.startDate}
                    challengeHasStarted={
                      collection?.challenge?.status === ChallengeStatus.Published && 
                      new Date() >= new Date(collection?.challenge?.startDate || 0)
                    }
                    currentDayIndex={currentDayIndex}
                    userChallenge={userChallenges?.find(uc => uc.userId === currentUser?.id)}
                    allWorkoutSummaries={[]} // Replace with actual workout summaries
                    index={index}
                    onPrimaryAction={() => {
                      const username = workout.author;
                      router.push(`/workout/${username}/${workout.id}`);
                    }}
                    onCalendarTap={(date) => handleCalendarTap(workout, date)}
                    onUpdateOrder={(newOrder) => handleSwapOrder(workout, newOrder)}
                  />
                );
              })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeDetailView;