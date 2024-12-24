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

// If you're using Firebase, you might import:
// import { auth } from '../api/firebase/config';
// import { onAuthStateChanged } from 'firebase/auth';

const Dashboard = () => {
  // Track which root tab is selected
  const [selectedTab, setSelectedTab] = useState<SelectedRootTabs>(SelectedRootTabs.Discover);
  const [isWorkoutPanelOpen, setIsWorkoutPanelOpen] = useState(false);


  // Track whether user is signed in
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Control whether to show the sign-in modal
  const [isSignInModalVisible, setIsSignInModalVisible] = useState(true);

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

export default Dashboard;