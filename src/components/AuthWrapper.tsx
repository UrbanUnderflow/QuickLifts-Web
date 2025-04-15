import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { setUser, setLoading } from '../redux/userSlice';
import { userService, SubscriptionType } from '../api/firebase/user';
import SignInModal from './SignInModal';
import type { RootState } from '../redux/store';
import SubscriptionModal from '../components/SignInModal';
import { useUser } from '../hooks/useUser';

interface AuthWrapperProps {
 children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  console.log('AuthWrapper component mounting...');

  const dispatch = useDispatch();
  const auth = getAuth();
  const [showSignInModal, setShowSignInModal] = useState(false);
  const router = useRouter();
  
  const currentUser = useUser();
  const isLoading = useSelector((state: RootState) => state.user.loading);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  console.log('AuthWrapper setup complete, before useEffect');

  // Add subscription routes to public routes
  const publicRoutes = [
    '/about', '/creator', '/rounds', '/privacyPolicy', 
    '/starter-pack', '/stacks', '/moves', '/terms',
    '/subscribe', '/download' // Add subscription page
  ].map(route => route?.toLowerCase());
 
  const publicPathPatterns = [
    '/round-invitation', '/profile', '/challenge'
  ].map(pattern => pattern.toLowerCase());
 
  const isPublicRoute = (path: string) => {
    const normalizedPath = path.toLowerCase();
    return publicRoutes.includes(normalizedPath) || 
           publicPathPatterns.some(pattern => normalizedPath.startsWith(pattern));
  };
 
    // Add debug useEffect to track currentUser changes
  useEffect(() => {
    console.log('Current User State:', {
      user: currentUser,
      subscription: currentUser?.subscriptionType,
      isNull: currentUser === null,
      timestamp: new Date().toISOString()
    });

  }, [currentUser]);
    
  // This is the main auth effect that should contain our logs
  useEffect(() => {
    console.log('Auth effect starting...', {
      pathname: router.pathname,
      hasCurrentUser: !!currentUser,
      timestamp: new Date().toISOString()
    });

    try {
      dispatch(setLoading(true));
      
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log('Auth state changed:', {
          hasFirebaseUser: !!firebaseUser,
          email: firebaseUser?.email,
          timestamp: new Date().toISOString()
        });

        try {
          if (firebaseUser) {
            const firestoreUser = await userService.fetchUserFromFirestore(firebaseUser.uid);
            console.log('Initial Firestore user:', {
              userId: firestoreUser?.id,
              hasUsername: !!firestoreUser?.username,
              username: firestoreUser?.username || 'undefined',
              registrationComplete: !!firestoreUser?.registrationComplete,
              subscription: firestoreUser?.subscriptionType,
              timestamp: new Date().toISOString()
            });

            dispatch(setUser(firestoreUser ? firestoreUser.toDictionary() : null));
            userService.currentUser = firestoreUser;

            if (!isPublicRoute(router.pathname)) {
              if (firestoreUser && (!firestoreUser.username || firestoreUser.username === '')) {
                console.log('[AuthWrapper] User needs to complete registration - missing username');
                setShowSignInModal(true);
              } else if (firestoreUser?.subscriptionType === SubscriptionType.unsubscribed) {
                setShowSubscriptionModal(true);
              }
            }
          } else {
            console.log('No firebase user, clearing state');
            dispatch(setUser(null));
            userService.currentUser = null;
            if (!isPublicRoute(router.pathname)) {
              setShowSignInModal(true);
            }
          }
        } catch (error) {
          console.error('Error in auth process:', error);
          dispatch(setUser(null));
        } finally {
          dispatch(setLoading(false));
          setAuthChecked(true);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Auth wrapper error:', error);
      dispatch(setLoading(false));
      setAuthChecked(true);
    }
  }, [auth, dispatch, router.pathname]);

 const handleSignInSuccess = (user: any) => {
   // Modal will auto-close based on Redux state
 };

 const handleSignInError = (error: Error) => {
   console.error('Sign in error:', error);
 };

 // Don't render anything until initial auth check is complete
 if (!authChecked || isLoading) {
   return <div className="flex items-center justify-center min-h-screen">
     <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zinc-900"></div>
   </div>;
 }

 return (
   <>
     {children}
     {!isPublicRoute(router.pathname) && (
       <>
         {currentUser?.subscriptionType === SubscriptionType.unsubscribed ? (
           <SubscriptionModal 
             isVisible={showSubscriptionModal}
             onClose={() => {
               console.log('[AuthWrapper] Closing subscription modal');
               setShowSubscriptionModal(false);
             }}
           />
         ) : (!currentUser || !currentUser.username || currentUser.username === '') ? (
           <SignInModal
             isVisible={showSignInModal}
             closable={false}
             onClose={() => {
               console.log('[AuthWrapper] Closing sign in modal');
               setShowSignInModal(false);
             }}
             onSignInSuccess={(user) => {
               console.log('[AuthWrapper] Sign in success');
               setShowSignInModal(false);
             }}
             onSignInError={(error) => {
               console.error('[AuthWrapper] Sign in error:', error);
             }}
             onRegistrationComplete={() => {
               console.log('[AuthWrapper] Registration complete');
               setShowSignInModal(false);
             }}
           />
         ) : null}
       </>
     )}
   </>
 );
};

export default AuthWrapper;