import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { setUser, setLoading } from '../redux/userSlice';
import { userService } from '../api/firebase/user';
import SignInModal from './SignInModal';
import type { RootState } from '../redux/store'; // Make sure this path is correct

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const dispatch = useDispatch();
  const auth = getAuth();
  const [showSignInModal, setShowSignInModal] = useState(false);
  const router = useRouter();
  
  // Update selector to match your state structure
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isLoading = useSelector((state: RootState) => state.user.loading);

  const publicRoutes = ['/about', '/creator', '/rounds', '/terms', '/privacyPolicy'];
  const publicPathPatterns = ['/round-invitation', '/profile']; // Paths that start with these are public

  const isPublicRoute = (path: string) => {
    // Check exact matches
    if (publicRoutes.includes(path)) return true;
    
    // Check if the path starts with any of the public patterns
    return publicPathPatterns.some(pattern => path.startsWith(pattern));
  };

  useEffect(() => {
    dispatch(setLoading(true));

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const firestoreUser = await userService.fetchUserFromFirestore(firebaseUser.uid);
          dispatch(setUser(firestoreUser));
          userService.currentUser = firestoreUser;
          setShowSignInModal(false);
        } catch (error) {
          console.error('Error fetching user data:', error);
          dispatch(setUser(null));
          setShowSignInModal(true);
        }
      } else {
        dispatch(setUser(null));
        userService.currentUser = null;
        // Use the new isPublicRoute function
        setShowSignInModal(!isPublicRoute(router.pathname));
      }
      dispatch(setLoading(false));
    });

    return () => unsubscribe();
  }, [dispatch, auth, router.pathname]);

  const handleSignInSuccess = (user: any) => {
    setShowSignInModal(false);
  };

  const handleSignInError = (error: Error) => {
    console.error('Sign in error:', error);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  return (
    <>
      {children}
      
      {showSignInModal && !currentUser && (
        <SignInModal
          isVisible={true}
          closable={false}
          onSignInSuccess={handleSignInSuccess}
          onSignInError={handleSignInError}
          onSignUpSuccess={handleSignInSuccess}
          onSignUpError={handleSignInError}
        />
      )}
    </>
  );
};

export default AuthWrapper;