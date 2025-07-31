import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { setUser, setLoading } from '../redux/userSlice';
import { userService, SubscriptionType } from '../api/firebase/user';
import SignInModal from './SignInModal';
import type { RootState } from '../redux/store';
import { useUser } from '../hooks/useUser';
import { setLoginRedirectPath } from '../redux/tempRedirectSlice';

interface AuthWrapperProps {
 children: React.ReactNode;
}

// Utility for shallow comparison
function shallowEqual(objA: any, objB: any): boolean {
  if (objA === objB) return true;
  if (!objA || !objB) return false;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  const ignoreKeys = ['createdAt', 'updatedAt', 'bodyWeight', 'macros', 'profileImage'];

  for (let key of keysA) {
    if (ignoreKeys.includes(key)) continue;

    const valA = objA[key];
    const valB = objB[key];

    const areObjects = typeof valA === 'object' && typeof valB === 'object';

    if (areObjects) {
      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        return false;
      }
    } else if (valA !== valB) {
      return false;
    }
  }
  return true;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  console.log('AuthWrapper component mounting...');

  const dispatch = useDispatch();
  const auth = getAuth();
  const [showSignInModal, setShowSignInModal] = useState(false);
  const router = useRouter();
  
  const currentUser = useUser();
  const isLoading = useSelector((state: RootState) => state.user.loading);
  const [authChecked, setAuthChecked] = useState(false);
  const prevUserRef = React.useRef<any>(null);

  console.log('AuthWrapper setup complete, before useEffect');

  // Add subscription routes to public routes
  const publicRoutes = [
    '/', '/about', '/creator', '/rounds', '/privacyPolicy', '/programming', '/100trainers', 
    '/starter-pack', '/stacks', '/moves', '/terms', '/press', '100Trainers',
    '/subscribe', '/download', '/morning-mobility-challenge', 'review', '/MoveAndFuelATL', '/investor', '/invest', '/GetInTouch', '/PulseCheck' // Add subscription page
  ].map(route => route?.toLowerCase());
 
  const publicPathPatterns = [
    '/round-invitation', '/profile', '/challenge', '/review', '/programming', '/press', '/100trainers', '/MoveAndFuelATL', '/investor', '/invest'
  ].map(pattern => pattern.toLowerCase());
 
  const isPublicRoute = (path: string) => {
    const normalizedPath = path.toLowerCase();
    return publicRoutes.includes(normalizedPath) || 
           publicPathPatterns.some(pattern => normalizedPath.startsWith(pattern));
  };
 
    // Add debug useEffect to track currentUser changes with Safari-specific logging
  useEffect(() => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log('🔍 [AuthWrapper] Current User State:', {
      user: currentUser,
      subscription: currentUser?.subscriptionType,
      isNull: currentUser === null,
      isSafari,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });

    // Safari-specific user state validation
    if (isSafari && currentUser === null) {
      console.warn('🚨 [AuthWrapper] Safari user state is null - checking Firebase auth state...');
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        console.log('🔄 [AuthWrapper] Safari: Firebase user exists but Redux state is null, triggering re-fetch');
        userService.fetchUserFromFirestore(firebaseUser.uid).then(firestoreUser => {
          if (firestoreUser) {
            console.log('✅ [AuthWrapper] Safari: Re-fetched user successfully');
            dispatch(setUser(firestoreUser.toDictionary()));
          }
        }).catch(error => {
          console.error('❌ [AuthWrapper] Safari: Error re-fetching user:', error);
        });
      }
    }

  }, [currentUser, auth, dispatch]);
    
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

            const newUserDict = firestoreUser ? firestoreUser.toDictionary() : null;
            if (!shallowEqual(prevUserRef.current, newUserDict)) {
              console.warn('[AuthWrapper] shallowEqual failed. Dispatching setUser. Differences:', {
                prev: prevUserRef.current,
                next: newUserDict,
                diffKeys: newUserDict ? Object.keys(newUserDict).filter(key => 
                  key !== 'createdAt' && key !== 'updatedAt' && 
                  (!prevUserRef.current || prevUserRef.current[key] !== newUserDict[key])
                ) : ['prev was object, next is null'],
                timestamp: new Date().toISOString()
              });
              dispatch(setUser(newUserDict));
              prevUserRef.current = newUserDict;
            }
            userService.nonUICurrentUser = firestoreUser;

            if (!isPublicRoute(router.pathname)) {
              if (firestoreUser && (!firestoreUser.username || firestoreUser.username === '')) {
                console.log('[AuthWrapper] User needs to complete registration - showing modal');
                setShowSignInModal(true);
              } else if (firestoreUser?.subscriptionType === SubscriptionType.unsubscribed) {
                console.log(`[AuthWrapper] User onboarded but unsubscribed on protected route (${router.pathname}). Redirecting to /subscribe.`);
                if (router.pathname.toLowerCase() !== '/subscribe') {
                  router.push('/subscribe');
                }
                setShowSignInModal(false);
              } else {
                console.log('[AuthWrapper] User onboarded and subscribed. Hiding modal if shown.');
                setShowSignInModal(false);
              }
            }
          } else {
            console.log('No firebase user, clearing state');
            dispatch(setUser(null));
            userService.nonUICurrentUser = null;
            if (!isPublicRoute(router.pathname)) {
              console.log(`[AuthWrapper] User not authenticated on protected route: ${router.asPath}. Setting redirect path and showing modal.`);
              dispatch(setLoginRedirectPath(router.asPath));
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
  }, [auth, dispatch, router.pathname, router]);

 const handleSignInSuccess = () => {
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

 // Final Render
 return (
   <>
     {children}
     {/* Render SignInModal only if needed (unauthenticated on protected route, or onboarding incomplete) */}
     {showSignInModal && (
         <SignInModal
           isVisible={showSignInModal} // Controlled by state
           onClose={() => {
               console.log('[AuthWrapper] Closing SignInModal');
               setShowSignInModal(false);
           }}
           // Pass necessary handlers
           onSignInSuccess={handleSignInSuccess} 
           onSignInError={handleSignInError}
           onRegistrationComplete={() => { // Ensure this hides modal too
               console.log('[AuthWrapper] Registration complete from modal');
               setShowSignInModal(false);
           }}
           onQuizComplete={() => { // Ensure this hides modal too
               console.log('[AuthWrapper] Quiz complete from modal');
               setShowSignInModal(false);
           }}
            // Add any other handlers SignInModal expects that might trigger a close/state change
         />
     )}
   </>
 );
};

export default AuthWrapper;