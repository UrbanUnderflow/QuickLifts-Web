import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { setUser, setLoading } from '../redux/userSlice';
import { userService, SubscriptionType } from '../api/firebase/user';
import { subscriptionService } from '../api/firebase/subscription/service';
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
    '/starter-pack', '/one-on-one', '/train-your-client', '/stacks', '/moves', '/terms', '/press', '/100trainers',
    '/subscribe', '/download', '/morning-mobility-challenge', '/review', '/MoveAndFuelATL', '/investor', '/invest', '/GetInTouch', '/PulseCheck', '/coach/dashboard', '/secure',
    // Public onboarding/marketing entry points
    '/sign-up', '/coach', '/coach/sign-up'
  ].map(route => route?.toLowerCase());
 
  const publicPathPatterns = [
    '/round-invitation', '/round', '/profile', '/challenge', '/review', '/programming', '/press', '/100trainers', '/MoveAndFuelATL', '/investor', '/invest'
  ].map(pattern => pattern.toLowerCase());
 
  const isPublicRoute = (path: string) => {
    // Normalize: prefer asPath, strip query/hash, lowercase, remove trailing slash
    const raw = (path || '').split('?')[0].split('#')[0];
    const normalizedPath = raw.replace(/\/$/, '').toLowerCase();
    const isPublic = publicRoutes.includes(normalizedPath) || 
           publicPathPatterns.some(pattern => normalizedPath.startsWith(pattern));
    
    // Add debugging for starter-pack specifically
    if (normalizedPath.includes('starter-pack')) {
      console.log('[AuthWrapper] Starter-pack route check:', {
        originalPath: path,
        normalizedPath,
        isPublic,
        publicRoutes: publicRoutes.filter(route => route.includes('starter')),
        allPublicRoutes: publicRoutes
      });
    }
    
    // Add debugging for subscribe page specifically
    if (normalizedPath.includes('subscribe')) {
      console.log('[AuthWrapper] Subscribe route check:', {
        originalPath: path,
        normalizedPath,
        isPublic,
        isInPublicRoutes: publicRoutes.includes(normalizedPath),
        publicRoutes: publicRoutes,
        environment: typeof window !== 'undefined' ? window.location.hostname : 'server'
      });
    }
    if (normalizedPath.includes('100trainers')) {
      console.log('[AuthWrapper] 100Trainers route check:', {
        originalPath: path,
        normalizedPath,
        isPublic,
        publicRoutes,
        publicPathPatterns
      });
    }
    
    return isPublic;
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

            // Background: ensure subscription record is fresh on every app open
            try {
              const uid = firestoreUser?.id || firebaseUser.uid;
              console.log('[AuthWrapper] ensureActiveOrSync kickoff', { uid });
              subscriptionService.ensureActiveOrSync(uid)
                .then(r => console.log('[AuthWrapper] ensureActiveOrSync result', { isActive: r.isActive, latest: r.latestExpiration?.toISOString() }))
                .catch(e => console.warn('[AuthWrapper] ensureActiveOrSync error', e));
            } catch (e) {
              console.warn('[AuthWrapper] ensureActiveOrSync try/catch error', e);
            }

            if (!isPublicRoute(router.asPath || router.pathname)) {
              if (firestoreUser && (!firestoreUser.username || firestoreUser.username === '')) {
                console.log('[AuthWrapper] User needs to complete registration - showing modal');
                setShowSignInModal(true);
              } else if (!firestoreUser || firestoreUser.subscriptionType === SubscriptionType.unsubscribed) {
                // Drive access by subscription record expirations instead of user field
                try {
                  const userIdForCheck = firestoreUser?.id || firebaseUser.uid;
                  const status = await subscriptionService.ensureActiveOrSync(userIdForCheck);
                  if (!status.isActive && !router.pathname.startsWith('/payment/')) {
                    console.log(`[AuthWrapper] Expired or no active subscription on protected route (${router.pathname}). Redirecting to /subscribe.`);
                    if (router.pathname.toLowerCase() !== '/subscribe') {
                      router.push('/subscribe');
                    }
                    setShowSignInModal(false);
                  } else {
                    console.log('[AuthWrapper] Active subscription via subscription record.');
                    setShowSignInModal(false);
                  }
                } catch (e) {
                  console.warn('[AuthWrapper] Subscription status check failed, defaulting to subscribe page on protected route.');
                  if (!router.pathname.startsWith('/payment/') && router.pathname.toLowerCase() !== '/subscribe') {
                    router.push('/subscribe');
                  }
                  setShowSignInModal(false);
                }
              } else {
                console.log('[AuthWrapper] User onboarded and subscribed. Hiding modal if shown.');
                setShowSignInModal(false);
              }
            } else {
              console.log(`[AuthWrapper] User authenticated on public route: ${router.pathname}. No authentication checks needed.`);
              setShowSignInModal(false);
            }
          } else {
            console.log('No firebase user, clearing state');
            dispatch(setUser(null));
            userService.nonUICurrentUser = null;
            if (!isPublicRoute(router.asPath || router.pathname)) {
              console.log(`[AuthWrapper] User not authenticated on protected route: ${router.asPath}. Setting redirect path and showing modal.`);
              dispatch(setLoginRedirectPath(router.asPath));
              setShowSignInModal(true);
            } else {
              console.log(`[AuthWrapper] User not authenticated but on public route: ${router.pathname}. No modal needed.`);
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