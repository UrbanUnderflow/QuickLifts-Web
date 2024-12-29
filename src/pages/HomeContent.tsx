import React, { useEffect, useState } from 'react';
import BottomNav from '../components/App/BottomNav';
import Discover from '../../src/components/App/RootScreens/Discover';
import Search from '../../src/components/App/RootScreens/Search';
import Create from '../../src/components/App/RootScreens/Create';
import Message from '../../src/components/App/RootScreens/Message';
import Profile from '../../src/components/App/RootScreens/Profile';
import SignInModal from "../components/SignInModal";
import { SelectedRootTabs } from '../types/DashboardTypes';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../api/firebase/config'; 
import { userService } from '../api/firebase/user';
import WorkoutPanel from '../components/App/Dashboard/WorkoutPanel';
import InProgressExercise from '../components/App/InProgressExercise/InProgressExercise';
import { ExerciseLog, Exercise } from '../api/firebase/exercise/types';
import Link from 'next/link';

// If you're using Firebase, you might import:
// import { auth } from '../api/firebase/config';
// import { onAuthStateChanged } from 'firebase/auth';

const HomeContent = () => {
  // Track which root tab is selected
  const [selectedTab, setSelectedTab] = useState<SelectedRootTabs>(SelectedRootTabs.Discover);
  const [isWorkoutPanelOpen, setIsWorkoutPanelOpen] = useState(false);


  // Track whether user is signed in
  const [isSignedIn, setIsSignedIn] = useState(false);

  const [isWorkoutInProgress, setIsWorkoutInProgress] = useState(false); // Set to true for testing
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  // Control whether to show the sign-in modal
  const [isSignInModalVisible, setIsSignInModalVisible] = useState(true);

  const mockExercises = [
    new ExerciseLog({
      id: 'log1',
      workoutId: 'workout1',
      userId: 'user123',
      exercise: new Exercise({
        id: 'ex1',
        name: 'Push-ups',
        description: 'A basic push-up exercise targeting chest, shoulders, and triceps.',
        category: {
          type: 'bodyWeight',
          details: {
            reps: ['10'],
            sets: 3,
            weight: 0,
            screenTime: 45, 
          },
        },
        primaryBodyParts: ['chest', 'triceps'],
        secondaryBodyParts: ['shoulders'],
        tags: ['strength', 'bodyweight'],
        videos: [

          { id: 'pushVid1',
            videoURL: 'https://firebasestorage.googleapis.com:443/v0/b/quicklifts-dd3f1.appspot.com/o/videos%2FBench%20Press%2FBench%20Press_iNCW0VxnG3SAtr0IKIAoB3n3EF33%2B1719675103.2404962.mp4?alt=media&token=d38ee8d1-a60b-4966-9999-05d601edc7b6', 
            gifURL: 'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/gifs%2FBench%20Press%2F2D817A73-68FC-4E4D-93A3-D360554CE8EE_low.gif?alt=media&token=68da2b3f-0fad-4da7-98db-51b17f23e3b8'
            },
        ],
        steps: ['Get into plank position', 'Lower your body', 'Push back up'],
        visibility: 'public',
        currentVideoPosition: 0,
        sets: 3,
        reps: '10',
        weight: 0,
        author: {
          uid: 'author1',
          displayName: 'Pulse Trainer',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      logs: [],
      feedback: '',
      note: '',
      recommendedWeight: '',
      isSplit: false,
      isBodyWeight: true,
      logSubmitted: false,
      logIsEditing: false,
      isCompleted: false,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  
    new ExerciseLog({
      id: 'log2',
      workoutId: 'workout1',
      userId: 'user123',
      exercise: new Exercise({
        id: 'ex2',
        name: 'Squats',
        description: 'A compound movement focusing on the lower body.',
        category: {
          type: 'weightTraining',
          details: {
            reps: ['8'],
            sets: 4,
            weight: 50,
            screenTime: 60,
          },
        },
        primaryBodyParts: ['quadriceps', 'glutes'],
        secondaryBodyParts: ['hamstrings', 'core'],
        tags: ['strength', 'compound'],
        videos: [

          { id: 'pushVid2',
            videoURL: 'https://firebasestorage.googleapis.com:443/v0/b/quicklifts-dd3f1.appspot.com/o/videos%2FBench%20Press%2FBench%20Press_iNCW0VxnG3SAtr0IKIAoB3n3EF33%2B1719675103.2404962.mp4?alt=media&token=d38ee8d1-a60b-4966-9999-05d601edc7b6', 
            gifURL: 'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/gifs%2FBench%20Press%2F2D817A73-68FC-4E4D-93A3-D360554CE8EE_low.gif?alt=media&token=68da2b3f-0fad-4da7-98db-51b17f23e3b8'
            },
        ],
        steps: ['Stand with feet shoulder-width apart', 'Lower hips', 'Drive through heels'],
        visibility: 'public',
        currentVideoPosition: 0,
        sets: 4,
        reps: '8',
        weight: 50,
        author: {
          uid: 'author1',
          displayName: 'Pulse Trainer',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      logs: [],
      feedback: '',
      note: '',
      recommendedWeight: '50 lbs',
      isSplit: false,
      isBodyWeight: false,
      logSubmitted: false,
      logIsEditing: false,
      isCompleted: false,
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  
    new ExerciseLog({
      id: 'log3',
      workoutId: 'workout1',
      userId: 'user123',
      exercise: new Exercise({
        id: 'ex3',
        name: 'Planks',
        description: 'An isometric core strength exercise.',
        category: {
          type: 'bodyWeight',
          details: {
            reps: ['30s'], 
            sets: 3,
            weight: 0,
            screenTime: 30,
          },
        },
        primaryBodyParts: ['core'],
        secondaryBodyParts: ['shoulders', 'back'],
        tags: ['endurance', 'bodyweight'],
        videos: [

          { id: 'pushVid1',
            videoURL: 'https://firebasestorage.googleapis.com:443/v0/b/quicklifts-dd3f1.appspot.com/o/videos%2FBench%20Press%2FBench%20Press_iNCW0VxnG3SAtr0IKIAoB3n3EF33%2B1719675103.2404962.mp4?alt=media&token=d38ee8d1-a60b-4966-9999-05d601edc7b6', 
            gifURL: 'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/gifs%2FBench%20Press%2F2D817A73-68FC-4E4D-93A3-D360554CE8EE_low.gif?alt=media&token=68da2b3f-0fad-4da7-98db-51b17f23e3b8'
            },
        ],
        steps: ['Assume push-up position', 'Keep body straight', 'Hold as long as possible'],
        visibility: 'public',
        currentVideoPosition: 0,
        sets: 3,
        reps: '30s',
        weight: 0,
        author: {
          uid: 'author2',
          displayName: 'Core Specialist',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      logs: [],
      feedback: '',
      note: '',
      recommendedWeight: '',
      isSplit: false,
      isBodyWeight: true,
      logSubmitted: false,
      logIsEditing: false,
      isCompleted: false,
      order: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ];

  // Example: if using Firebase, you'd watch the auth state:
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch user data from Firestore and set it in userService
          const firestoreUser = await userService.fetchUserFromFirestore(user.uid);
          userService.currentUser = firestoreUser;
          
          console.log('User data fetched and set:', firestoreUser); // Debug log
          
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Handle error appropriately
        }
      } else {
        userService.currentUser = null; // Clear the current user
        setIsSignedIn(false);
        setIsSignInModalVisible(true);
      }
    });
  
    return () => unsubscribe();
  }, []);

  // For now, we can do some mock logic:
  useEffect(() => {
    // Suppose we discover the user is not signed in:
    setIsSignedIn(false);
    setIsSignInModalVisible(true);
  }, []);

  useEffect(() => {
    // Find the first incomplete exercise
    const firstIncomplete = mockExercises.findIndex((log) => !log.isCompleted);
  
    // If found, set currentExerciseIndex to that
    if (firstIncomplete !== -1) {
      setCurrentExerciseIndex(firstIncomplete);
    }
  }, [mockExercises]);

  // Render the selected tab's content
  const renderContent = () => {
    switch (selectedTab) {
      case SelectedRootTabs.Discover:
        return <Discover />;
      case SelectedRootTabs.Search:
        return <Search />;
      case SelectedRootTabs.Create:
        return <Create />;
      case SelectedRootTabs.Message:
        return <Message />;
      case SelectedRootTabs.Profile:
        return <Profile />;
      default:
        return null;
    }
  };

  if (isWorkoutInProgress) {
    return (
      <InProgressExercise
        exercises={mockExercises}
        currentExerciseIndex={currentExerciseIndex}
        onComplete={() => {
          if (currentExerciseIndex < mockExercises.length - 1) {
            setCurrentExerciseIndex((prev) => prev + 1);
          } else {
            setIsWorkoutInProgress(false);
          }
        }}
        onClose={() => {
          if (window.confirm('Are you sure you want to end your workout?')) {
            setIsWorkoutInProgress(false);
          }
        }}
      />
    );
  }

  // If signed in, show coming soon overlay
  if (isSignedIn) {
    return <ComingSoonOverlay />;
  }

  // If not signed in, show SignInModal
  if (!isSignedIn) {
    return (
      <SignInModal
        isVisible={isSignInModalVisible}
        // The following onClose could be omitted if you *require* sign in
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

  // If user is signed in, display the actual dashboard
  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Top Navigation */}
      <nav className="px-4 py-4 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10 flex justify-between items-center">
        <img src="/pulse-logo-white.svg" alt="Pulse" className="h-8" />

        {/* "Start Workout" button */}
        <button
        className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg"
        onClick={() => setIsWorkoutPanelOpen(true)}
      >
        Start Workout
      </button>
      </nav>

      {/* Main Content */}
      <div className="max-w-xl mx-auto px-4 py-6">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <BottomNav selectedTab={selectedTab} onTabChange={setSelectedTab} />

      {/* Render the panel */}
      <WorkoutPanel
        isVisible={isWorkoutPanelOpen}
        onClose={() => setIsWorkoutPanelOpen(false)}
      />
    </div>
  );
};

export default HomeContent;


const ComingSoonOverlay = () => {
  const handleContactClick = () => {
    window.location.href = 'mailto:pulsefitnessapp@gmail.com';
  };

  return (
    <div className="fixed inset-0 bg-zinc-900 flex flex-col justify-between min-h-screen z-50">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md mx-auto p-8 text-center">
          <img 
            src="/pulse-logo-white.svg" 
            alt="Pulse" 
            className="h-12 mx-auto mb-8"
          />
          
          <h1 className="text-3xl font-bold text-white mb-4">
            Web App Coming Soon
          </h1>
          
          <p className="text-zinc-300 mb-6">
            We're working hard to bring the Pulse experience to your browser. 
            In the meantime, download our mobile app to start your fitness journey!
          </p>
          
          <div className="space-y-4">
            <a 
              href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-[#E0FE10] text-black font-semibold py-3 px-6 rounded-lg hover:bg-opacity-90 transition-all"
            >
              Download iOS App
            </a>
            
            <p className="text-zinc-400 text-sm">
              We'll notify you via email when the web app is ready to use.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Primary Links */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 text-zinc-400 mb-6">
            <Link 
              href="/about" 
              className="hover:text-[#E0FE10] transition-colors"
            >
              About Pulse
            </Link>
            <div className="hidden sm:block w-1 h-1 bg-zinc-700 rounded-full"></div>
            <Link 
              href="/creator" 
              className="hover:text-[#E0FE10] transition-colors"
            >
              Creator Program
            </Link>
            <div className="hidden sm:block w-1 h-1 bg-zinc-700 rounded-full"></div>
            <Link 
              href="/rounds" 
              className="hover:text-[#E0FE10] transition-colors"
            >
              Rounds Feature
            </Link>
          </div>

          {/* Secondary Links */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 text-zinc-500 text-sm mb-8">
            <Link 
              href="/terms" 
              className="hover:text-[#E0FE10] transition-colors"
            >
              Terms & Conditions
            </Link>
            <div className="hidden sm:block w-1 h-1 bg-zinc-700 rounded-full"></div>
            <Link 
              href="/privacyPolicy" 
              className="hover:text-[#E0FE10] transition-colors"
            >
              Privacy Policy
            </Link>
            <div className="hidden sm:block w-1 h-1 bg-zinc-700 rounded-full"></div>
            <button 
              onClick={handleContactClick}
              className="hover:text-[#E0FE10] transition-colors"
            >
              Contact Us
            </button>
          </div>

          {/* Social Icons */}
          <div className="flex justify-center gap-6 mb-6">
            <a 
              href="https://www.instagram.com/fitwithpulse/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-[#E0FE10] transition-colors"
            >
              <img src="/instagram.svg" alt="Instagram" className="w-6 h-6" />
            </a>
            <a 
              href="https://twitter.com/fitwithpulse" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-[#E0FE10] transition-colors"
            >
              <img src="/twitter.svg" alt="Twitter" className="w-6 h-6" />
            </a>
            <a 
              href="https://www.tiktok.com/@fitwithpulse" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-[#E0FE10] transition-colors"
            >
              <img src="/tiktok.svg" alt="TikTok" className="w-6 h-6" />
            </a>
          </div>
          
          {/* Copyright */}
          <div className="text-center text-sm text-zinc-500">
            © {new Date().getFullYear()} Pulse. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};