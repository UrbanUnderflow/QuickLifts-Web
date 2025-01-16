import { useEffect, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import {SweatlistCollection, SweatlistType} from '../../types/SweatlistCollection';
import { ChallengeStatus } from '../../types/ChallengeTypes';
import { StackCard, RestDayCard } from '../../components/Rounds/StackCard';
import { Workout } from '../../api/firebase/workout';
import { BodyZone } from '../../types/BodyZone';
import ParticipantsSection from '../../components/Rounds/ParticipantsSection';
import { UserChallenge } from '../../types/ChallengeTypes';
import RoundChatView from '../../components/Rounds/RoundChatView';
import { UserLevel } from '../../api/firebase/user';
import { BodyPart, ExerciseReference } from '../../api/firebase/exercise';
import  { GroupMessage, MessageMediaType } from '../../types/ChatTypes';
import SignInModal from "../../components/SignInModal"; 



// Create dates for the challenge
const today = new Date();
const startDate = new Date(today);
startDate.setDate(today.getDate() + 1); // Starts tomorrow
const endDate = new Date(startDate);
endDate.setDate(startDate.getDate() + 28); // 4-week challenge

export const mockParticipants: UserChallenge[] = [

  {
    id: "participant-001",
    challengeId: "challenge-001",
    userId: "user-124",
    username: "sarah_fitness",
    profileImage: {
      profileImageURL: "https://example.com/sarah.jpg",
      thumbnailURL: "https://example.com/sarah_thumb.jpg"
    },
    progress: 25,
    completedWorkouts: [],
    isCompleted: false,
    location: {
      latitude: 40.7128,
      longitude: -74.0060
    },
    city: "New York",
    country: "USA",
    timezone: "America/New_York",
    joinDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    pulsePoints: {
      baseCompletion: 100,
      firstCompletion: 50,
      streakBonus: 30,
      checkInBonus: 20,
      effortRating: 40,
      chatParticipation: 10,
      locationCheckin: 5,
      contentEngagement: 15,
      encouragementSent: 25,
      encouragementReceived: 10
    },
    currentStreak: 3,
    encouragedUsers: [],
    encouragedByUsers: [],
    checkIns: [new Date(), new Date(Date.now() - 86400000)]
  },
  {
    id: "participant-002",
    challengeId: "challenge-001",
    userId: "user-125",
    username: "mike_strong",
    profileImage: {
      profileImageURL: "https://example.com/mike.jpg",
      thumbnailURL: "https://example.com/mike_thumb.jpg"
    },
    progress: 30,
    completedWorkouts: [],
    isCompleted: false,
    location: {
      latitude: 34.0522,
      longitude: -118.2437
    },
    city: "Los Angeles",
    country: "USA",
    timezone: "America/Los_Angeles",
    joinDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    pulsePoints: {
      baseCompletion: 120,
      firstCompletion: 60,
      streakBonus: 40,
      checkInBonus: 25,
      effortRating: 45,
      chatParticipation: 15,
      locationCheckin: 10,
      contentEngagement: 20,
      encouragementSent: 30,
      encouragementReceived: 15
    },
    currentStreak: 5,
    encouragedUsers: [],
    encouragedByUsers: [],
    checkIns: [new Date(), new Date(Date.now() - 86400000)]
  }
];

export const mockCollection: SweatlistCollection = {
  id: "mock-challenge-001",
  title: "28-Day Full Body Transform",
  subtitle: "A comprehensive 4-week challenge to transform your body and mind",
  ownerId: "user-123",
  privacy: SweatlistType.Together,
  createdAt: new Date(),
  updatedAt: new Date(),
  sweatlistIds: [
    {
      id: "sweatlist-001",
      sweatlistAuthorId: "user-123",
      sweatlistName: "Week 1: Foundation",
      order: 0
    },
    {
      id: "sweatlist-002",
      sweatlistAuthorId: "user-123",
      sweatlistName: "Week 2: Build",
      order: 1
    },
    {
      id: "sweatlist-003",
      sweatlistAuthorId: "user-123",
      sweatlistName: "Week 3: Intensify",
      order: 2
    },
    {
      id: "sweatlist-004",
      sweatlistAuthorId: "user-123",
      sweatlistName: "Week 4: Peak",
      order: 3
    }
  ],
  challenge: {
    id: "challenge-001",
    title: "28-Day Full Body Transform",
    subtitle: "A comprehensive 4-week challenge to transform your body and mind",
    participants: mockParticipants,
    status: ChallengeStatus.Published,
    startDate: startDate,
    endDate: endDate,
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

// Mock exercise references
// const mockExercises: ExerciseReference[] = [
//   {
//     exercise: {
//       id: 'ex1',
//       name: 'Squat',
//       description: 'Basic squat movement',
//       category: {
//         type: 'weightTraining', // Correct category type
//         details: {
//           reps: "12",
//           sets: 3,
//           weight: 50, // Mock details specific to weight training
//         },
//       },
//       primaryBodyParts: [BodyPart.Chest],
//       secondaryBodyParts: [BodyPart.Biceps],
//       tags: ['Strength', 'Legs', 'Quads'],

//       videos: [{
//         id: 'video1',
//         exerciseId: 'ex1',
//         username: 'demo_user',
//         userId: 'user123',
//         videoURL: 'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/gifs%2FDeadlifts%2F08FD2A37-D139-4DFE-BE1D-316DF059536C_low.gif?alt=media&token=7524d749-d99e-4a34-bdb4-afb142b31c61',
//         fileName: 'squat_demo.mp4',
//         exercise: 'Squat',
//         profileImage: {
//           profileImageURL: "",
//           imageOffsetWidth: 0,
//           imageOffsetHeight: 0,
//         },
//         gifURL: 'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/gifs%2FDeadlifts%2F08FD2A37-D139-4DFE-BE1D-316DF059536C_low.gif?alt=media&token=7524d749-d99e-4a34-bdb4-afb142b31c61',
//         visibility: "private",
//         totalAccountsReached: 0,
//         totalAccountLikes: 0,
//         totalAccountBookmarked: 0,
//         totalAccountUsage: 0,
//         isApproved: true,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       }],
//       steps: ['Step 1', 'Step 2', 'Step 3'],
//       visibility: 'open',
//       currentVideoPosition: 0,
//       sets: 3,
//       reps: "12",
//       weight: 0,
//       author: {
//         userId: 'user123',
//         username: 'demo_user',
//       },
//       createdAt: new Date(),
//       updatedAt: new Date()
//     },
//     groupId: 0
//   },
// ];

// export const mockWorkouts: Workout[] = [
//   {
//     id: "sweatlist-001",
//     title: "Week 1: Foundation",
//     exercises: [...mockExercises],
//     logs: [],
//     duration: 45,
//     useAuthorContent: true,
//     isCompleted: false,
//     author: "user-123",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//     zone: BodyZone.UpperBody,
//     estimatedDuration: () => 45,
//     determineWorkoutZone: () => BodyZone.UpperBody,
//     toDictionary: () => ({
//       id: "sweatlist-001",
//       title: "Week 1: Foundation",
//       author: "user-123",
//       zone: BodyZone.UpperBody
//     })
//   },
//   {
//     id: "sweatlist-002",
//     title: "Week 2: Build",
//     exercises: [...mockExercises],
//     logs: [],
//     duration: 50,
//     useAuthorContent: true,
//     isCompleted: false,
//     author: "user-123",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//     zone: BodyZone.LowerBody,
//     estimatedDuration: () => 50,
//     determineWorkoutZone: () => BodyZone.LowerBody,
//     toDictionary: () => ({
//       id: "sweatlist-002",
//       title: "Week 2: Build",
//       author: "user-123",
//       zone: BodyZone.LowerBody
//     })
//   },
//   {
//     id: "sweatlist-003",
//     title: "Week 3: Intensify",
//     exercises: [...mockExercises],
//     logs: [],
//     duration: 55,
//     useAuthorContent: true,
//     isCompleted: false,
//     author: "user-123",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//     zone: BodyZone.Core,
//     estimatedDuration: () => 55,
//     determineWorkoutZone: () => BodyZone.Core,
//     toDictionary: () => ({
//       id: "sweatlist-003",
//       title: "Week 3: Intensify",
//       author: "user-123",
//       zone: BodyZone.Core
//     })
//   },
//   {
//     id: "sweatlist-004",
//     title: "Week 4: Peak",
//     exercises: [...mockExercises],
//     logs: [],
//     duration: 60,
//     useAuthorContent: true,
//     isCompleted: false,
//     author: "user-123",
//     createdAt: new Date(),
//     updatedAt: new Date(),
//     zone: BodyZone.FullBody,
//     estimatedDuration: () => 60,
//     determineWorkoutZone: () => BodyZone.FullBody,
//     toDictionary: () => ({
//       id: "sweatlist-004",
//       title: "Week 4: Peak",
//       author: "user-123",
//       zone: BodyZone.FullBody
//     })
//   }
// ];

// Example messages for the chat
const mockMessages: GroupMessage[] = [
  {
    id: 'msg1',
    sender: {
      id: 'user-123',
      displayName: 'John Doe',
      email: 'johndoe@example.com',
      fcmToken: null,
      username: 'john_doe',
      level: UserLevel.Novice,
      videoCount: 5,
      profileImage: { profileImageURL: 'https://example.com/profile1.jpg', imageOffsetWidth: 0, imageOffsetHeight: 0 },
    },
    content: 'Hey everyone! Excited for this challenge!',
    checkinId: null,
    timestamp: new Date(),
    readBy: {},
    mediaURL: null,
    mediaType: MessageMediaType.None,
  },
  {
    id: 'msg2',
    sender: {
      id: 'user-124',
      displayName: 'Jane Smith',
      email: 'janesmith@example.com',
      fcmToken: null,
      username: 'jane_smith',
      level: UserLevel.Intermediate,
      videoCount: 8,
      profileImage: { profileImageURL: 'https://example.com/profile2.jpg', imageOffsetWidth: 0, imageOffsetHeight: 0 },
    },
    content: 'Let’s crush it together!',
    checkinId: null,
    timestamp: new Date(),
    readBy: {},
    mediaURL: null,
    mediaType: MessageMediaType.None,
  },
];


const ChallengeDetailView = () => {
const [showMenu, setShowMenu] = useState(false);
const [editMode, setEditMode] = useState(false);
// const [isChatExpanded, setIsChatExpanded] = React.useState(false);
const [isSignedIn, setIsSignedIn] = useState(false);
const [isModalVisible, setIsModalVisible] = useState(true);


const challenge = mockCollection.challenge;

interface DaysCalculation {
  type: 'until-start' | 'remaining' | 'ended';
  days: number;
}

useEffect(() => {
  // const unsubscribe = onAuthStateChanged(auth, (user) => {
  //   setIsSignedIn(!!user);
  //   if (!user) {
  //     setIsModalVisible(true);
  //   }
  // });
  // return () => unsubscribe();
}, []);

// Helper function to format dates
const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

// Calculate days until start or days remaining
const calculateDays = (): DaysCalculation | null => {
  if (!challenge?.startDate || !challenge?.endDate) return null;

  const now = new Date();
  const start = new Date(challenge.startDate);
  const end = new Date(challenge.endDate);

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

// Calculate progress percentage
const calculateProgress = (): number => {
  if (!challenge?.startDate || !challenge?.endDate) return 0;

  const now = new Date();
  const start = new Date(challenge.startDate);
  const end = new Date(challenge.endDate);
  const total = end.getTime() - start.getTime();
  const current = now.getTime() - start.getTime();

  return Math.min(Math.max((current / total) * 100, 0), 100);
};

  const daysInfo = calculateDays();
  const progress = calculateProgress();

  // Handler for swapping stack order
  const handleSwapOrder = (workout: Workout, newOrder: number): void => {
    // Implementation for reordering stacks
    console.log(`Moving workout ${workout.id} to order ${newOrder}`);
  };

  // Handler for calendar tap
  const handleCalendarTap = (workout: Workout, date: Date): void => {
    console.log(`Calendar tapped for workout ${workout.id} on ${date}`);
  };

  const handleSendMessage = (message: string, image?: File) => {
    console.log('Message sent:', { message, image });
    // Add logic to send message to backend or state update
  };

  if (!isSignedIn) {
    return (
      <SignInModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSignInSuccess={(user) => {
          console.log('Sign-in successful:', user);
          setIsSignedIn(true);
          setIsModalVisible(false);
        }}
        onSignInError={(error) => {
          console.error('Sign-in error:', error);
          alert('Sign-in failed. Please try again.');
        }}
        onSignUpSuccess={(user) => {
          console.log('Sign-up successful:', user);
          setIsSignedIn(true);
          setIsModalVisible(false);
        }}
        onSignUpError={(error) => {
          console.error('Sign-up error:', error);
          alert('Sign-up failed. Please try again.');
        }}
        onQuizComplete={() => {
          console.log('Quiz completed successfully');
          // Handle post-quiz completion logic
        }}
        onQuizSkipped={() => {
          console.log('Quiz skipped');
          // Handle logic for skipping the quiz
        }}
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
                <h1 className="text-2xl font-bold">{challenge?.title}</h1>
                <p className="text-zinc-400 mt-1">{challenge?.subtitle}</p>
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
                  {challenge?.startDate ? formatDate(challenge.startDate) : 'TBD'}
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-zinc-400 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Ends</span>
                </div>
                <div className="text-lg font-semibold">
                  {challenge?.endDate ? formatDate(challenge.endDate) : 'TBD'}
                </div>
              </div>
            </div>

            {/* Progress Card */}
            <div className="mt-6 bg-zinc-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Challenge Progress</h2>
                {daysInfo && (
                  <div className="text-sm text-zinc-400">
                    {daysInfo.type === 'until-start' ? (
                      <span>Starts in {daysInfo.days} days</span>
                    ) : daysInfo.type === 'remaining' ? (
                      <span>{daysInfo.days} days remaining</span>
                    ) : (
                      <span>Challenge ended</span>
                    )}
                  </div>
                )}
              </div>

              <div className="relative h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div 
                  className="absolute h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{Math.round(progress)}%</div>
                  <div className="text-sm text-zinc-400">Complete</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{mockCollection.sweatlistIds.length}</div>
                  <div className="text-sm text-zinc-400">Workouts</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{challenge?.participants.length || 0}</div>
                  <div className="text-sm text-zinc-400">Participants</div>
                </div>
              </div>
            </div>

            {/* Participants Section */}
            <ParticipantsSection 
              participants={challenge?.participants as UserChallenge[] || []}
              onParticipantClick={(participant: UserChallenge) => {
                console.log('Participant clicked:', participant.username);
                // Here you would typically navigate to the participant's profile
              }}
            />

            {/* Chat Section */}
            <div className="mt-8">
            <RoundChatView
                participants={mockParticipants}
                messages={mockMessages}
                onSendMessage={handleSendMessage}
                currentUser={{ id: 'user-123', username: 'john_doe' }}
              />
            </div>

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
                {/* {mockWorkouts.map((workout, index) => (
                  <StackCard
                    key={workout.id}
                    workout={workout}
                    gifUrls={workout.exercises.map(ex => ex.exercise.videos[0].videoURL)}
                    selectedOrder={index}
                    maxOrder={mockWorkouts.length}
                    showArrows={editMode}
                    showCalendar={true}
                    workoutDate={new Date()}
                    isComplete={false}
                    isChallengeEnabled={true}
                    onPrimaryAction={() => console.log('Workout clicked:', workout.id)}
                    onCalendarTap={(date) => handleCalendarTap(workout, date)}
                    onUpdateOrder={(newOrder) => handleSwapOrder(workout, newOrder)}
                  />
                ))} */}

                {/* Example of a Rest Day card */}
                {/* <RestDayCard
                  selectedOrder={mockWorkouts.length}
                  maxOrder={mockWorkouts.length + 1}
                  showArrows={editMode}
                  showCalendar={true}
                  workoutDate={new Date()}
                  isComplete={false}
                  onPrimaryAction={() => console.log('Rest day clicked')}
                  onCalendarTap={(date) => console.log('Rest day calendar tapped:', date)}
                  onUpdateOrder={(newOrder) => console.log('Rest day order update:', newOrder)}
                /> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeDetailView;