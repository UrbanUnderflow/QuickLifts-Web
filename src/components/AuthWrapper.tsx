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

  const publicRoutes = [
    '/about', 
    '/creator', 
    '/rounds', 
    '/privacyPolicy', 
    '/starter-pack', 
    '/stacks', 
    '/moves',
    '/terms',,
  ].map(route => route?.toLowerCase());  // Normalize all routes
  
  const publicPathPatterns = [
    '/round-invitation', 
    '/profile', 
    '/challenge',
  ].map(pattern => pattern.toLowerCase());  // Normalize all patterns
  
  const isPublicRoute = (path: string) => {
    const normalizedPath = path.toLowerCase();
    
    // Check exact matches
    if (publicRoutes.includes(normalizedPath)) {
      return true;
    }
    
    // Check patterns
    return publicPathPatterns.some(pattern => normalizedPath.startsWith(pattern));
  };

  useEffect(() => {
    // Add error boundary
    try {
      dispatch(setLoading(true));
      
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          if (firebaseUser) {
            const firestoreUser = await userService.fetchUserFromFirestore(firebaseUser.uid);
            dispatch(setUser(firestoreUser));
            userService.currentUser = firestoreUser;
            setShowSignInModal(false);
          } else {
            dispatch(setUser(null));
            userService.currentUser = null;
            const isPublic = isPublicRoute(router.pathname);
            console.log('Route is public:', isPublic);
            setShowSignInModal(!isPublic);
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          dispatch(setUser(null));
        } finally {
          dispatch(setLoading(false));
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Auth wrapper error:', error);
      dispatch(setLoading(false));
    }
  }, [dispatch, auth, router.pathname]);

  const handleSignInSuccess = (user: any) => {
    setShowSignInModal(false);
  };

  const handleSignInError = (error: Error) => {
    console.error('Sign in error:', error);
  };

  if (isLoading) {
    console.log('Auth wrapper is loading');
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zinc-900"></div>
    </div>;
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