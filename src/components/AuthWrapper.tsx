import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { setUser, setLoading } from '../redux/userSlice';
import { userService } from '../api/firebase/user';
import SignInModal from './SignInModal';
import type { RootState } from '../redux/store';
import SubscriptionModal from '../components/SignInModal';

interface AuthWrapperProps {
 children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const dispatch = useDispatch();
  const auth = getAuth();
  const [showSignInModal, setShowSignInModal] = useState(false);
  const router = useRouter();
  
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isLoading = useSelector((state: RootState) => state.user.loading);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

 
  // Add subscription routes to public routes
  const publicRoutes = [
    '/about', '/creator', '/rounds', '/privacyPolicy', 
    '/starter-pack', '/stacks', '/moves', '/terms',
    '/subscribe' // Add subscription page
  ].map(route => route?.toLowerCase());
 
  const publicPathPatterns = [
    '/round-invitation', '/profile', '/challenge'
  ].map(pattern => pattern.toLowerCase());
 
  const isPublicRoute = (path: string) => {
    const normalizedPath = path.toLowerCase();
    console.log('Checking route access:', { path: normalizedPath, isPublic: publicRoutes.includes(normalizedPath) });
    return publicRoutes.includes(normalizedPath) || 
           publicPathPatterns.some(pattern => normalizedPath.startsWith(pattern));
  };
 
  useEffect(() => {
    try {
      dispatch(setLoading(true));
      
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log('Auth state changed:', { userId: firebaseUser?.uid });
        
        try {
          if (firebaseUser) {
            const firestoreUser = await userService.fetchUserFromFirestore(firebaseUser.uid);
            console.log('Fetched user data:', { 
              userId: firestoreUser?.id,
              subscription: firestoreUser?.subscriptionType,
              currentPath: router.pathname
            });
 
            dispatch(setUser(firestoreUser));
            userService.currentUser = firestoreUser;
 
            // Check subscription status
            if (firestoreUser?.subscriptionType === 'Unsubscribed' && 
              !isPublicRoute(router.pathname)) {
              console.log('Showing subscription modal for unsubscribed user');
              setShowSubscriptionModal(true);
            }
          } else {
            console.log('No user logged in');
            dispatch(setUser(null));
            userService.currentUser = null;
            const isPublic = isPublicRoute(router.pathname);
            setShowSignInModal(!isPublic);
          }
        } catch (error) {
          console.error('User data fetch error:', error);
          dispatch(setUser(null));
        } finally {
          dispatch(setLoading(false));
        }
      });
 
      return () => unsubscribe();
    } catch (error) {
      console.error('Auth wrapper initialization error:', error);
      dispatch(setLoading(false));
    }
  }, [dispatch, auth, router.pathname]);

 const handleSignInSuccess = (user: any) => {
   // Modal will auto-close based on Redux state
 };

 const handleSignInError = (error: Error) => {
   console.error('Sign in error:', error);
 };

 if (isLoading) {
   return <div className="flex items-center justify-center min-h-screen">
     <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zinc-900"></div>
   </div>;
 }

 return (
   <>
     {children}
     {currentUser?.subscriptionType === 'Unsubscribed' && !isPublicRoute(router.pathname) ? (
      <SubscriptionModal 
        isVisible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    ) : (!currentUser || !currentUser.username) && !isPublicRoute(router.pathname) ? (
      <SignInModal
        isVisible={true}
        closable={false}
        onSignInSuccess={handleSignInSuccess}
        onSignInError={handleSignInError}
        onSignUpSuccess={handleSignInSuccess}
        onSignUpError={handleSignInError}
      />
    ) : null}
   </>
 );
};

export default AuthWrapper;