import React, { useState, useEffect } from "react";
import {
  getRedirectResult,
  signInWithRedirect,
  signInWithPopup,
  OAuthProvider,
  UserCredential,
  AuthError,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { Camera, X, Eye, EyeOff } from "lucide-react";
import { FitnessGoal, QuizData, SignUpStep } from "../types/AuthTypes";
import { Gender, WorkoutGoal, } from "../api/firebase/user";
import { SubscriptionType } from "../api/firebase/user";
import authService, { SignUpData } from "../api/firebase/auth";
import { userService, User, UserLevel, BodyWeight } from "../api/firebase/user";
import { auth } from "../api/firebase/config";
import { useRouter } from 'next/router';
import { firebaseStorageService, UploadImageType } from '../api/firebase/storage/service';

import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { toggleDevMode } from '../redux/devModeSlice';
import { initializeFirebase } from '../api/firebase/config';
import { useUser } from '../hooks/useUser';
import { clearRoundIdRedirect, clearLoginRedirectPath } from '../redux/tempRedirectSlice'; // Import clear actions
import { showToast } from '../redux/toastSlice'; // Import showToast
import { workoutService } from '../api/firebase/workout/service'; // Import workout service
import { Challenge, SweatlistCollection, UserChallenge } from '../api/firebase/workout/types'; // Import workout types

interface SignInModalProps {
  isVisible: boolean;
  closable?: boolean;
  onClose?: () => void;
  onSignInSuccess?: (user: any) => void;
  onSignInError?: (error: Error) => void;
  onSignUpSuccess?: (user: any) => void;
  onSignUpError?: (error: Error) => void;
  onQuizComplete?: () => void;
  onQuizSkipped?: () => void;
  onRegistrationComplete?: () => void;
}

const DevModeToggle: React.FC = () => {
  const dispatch = useDispatch();
  const isDevelopment = useSelector((state: RootState) => state.devMode.isDevelopment);
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  // On component mount, check if we should be in dev mode
  useEffect(() => {
    const savedMode = window.localStorage.getItem('devMode') === 'true';
    if (savedMode !== isDevelopment) {
      console.log('[DevMode] Initializing with saved mode:', {
        savedMode,
        currentMode: isDevelopment,
        isLocalhost,
        timestamp: new Date().toISOString()
      });
      dispatch(toggleDevMode());
      initializeFirebase(savedMode);
    }
  }, []);

  const handleToggle = () => {
    const newMode = !isDevelopment;
    console.log('[DevMode] Toggling mode:', {
      from: isDevelopment ? 'development' : 'production',
      to: newMode ? 'development' : 'production',
      isLocalhost,
      source: isLocalhost ? '.env.local' : (newMode ? 'firebaseConfigs' : 'Netlify'),
      timestamp: new Date().toISOString()
    });
    window.localStorage.setItem('devMode', String(newMode));
    dispatch(toggleDevMode());
    initializeFirebase(newMode);
    
    // Add a slight delay before reloading to ensure Firebase initialization completes
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  return (
    <button
      onClick={handleToggle}
      className="absolute top-4 left-4 px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-2"
      style={{
        background: isDevelopment ? '#E0FE10' : '#3f3f46',
        color: isDevelopment ? 'black' : 'white'
      }}
      title={`Using ${isDevelopment ? 'development' : 'production'} configuration from ${isLocalhost ? '.env.local' : (isDevelopment ? 'firebaseConfigs' : 'Netlify')}`}
    >
      {isDevelopment ? '🔧 Dev' : '🚀 Prod'}{isLocalhost ? ' (Local)' : ''}
    </button>
  );
};

const SignInModal: React.FC<SignInModalProps> = ({
  isVisible,
  closable = false,
  onClose,
  onSignInSuccess,
  onSignInError,
  onSignUpSuccess,
  onSignUpError,
  onQuizComplete,
  onQuizSkipped,
  onRegistrationComplete,
}) => {
  const [email, setEmail] = useState("");
  console.log('[SignInModal] Component rendering or re-rendering.'); // Simple render log
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpStep, setSignUpStep] = useState<SignUpStep>("initial");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const currentUser = useUser();
  const dispatch = useDispatch();
  const router = useRouter();
  const [isIphone, setIsIphone] = useState(false);
  // Added state for password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    username?: string;
  }>({});
  const { roundIdRedirect, loginRedirectPath } = useSelector((state: RootState) => state.tempRedirect);

  // Detect if the user is on an iPhone
  useEffect(() => {
    if (typeof window !== 'undefined' && window.navigator) {
      const ua = window.navigator.userAgent || window.navigator.vendor || '';
      setIsIphone(/iPhone/i.test(ua));
    }
  }, []);

  // Add effect to check if we need to show registration
  useEffect(() => {
    if (currentUser) {
      console.log('[SignInModal Onboarding Check Effect] Running. Current User:', JSON.parse(JSON.stringify(currentUser)));

      console.log('[SignInModal] Checking user onboarding status:', {
        userId: currentUser.id,
        hasUsername: !!currentUser.username,
        username: currentUser.username,
        registrationComplete: !!currentUser.registrationComplete,
        height: currentUser.height,
        birthdate: currentUser.birthdate,
        onboardingComplete: isOnboardingComplete(currentUser),
        timestamp: new Date().toISOString()
      });

      const onboardingStatus = isOnboardingComplete(currentUser);
      console.log('[SignInModal Onboarding Check Effect] isOnboardingComplete result:', onboardingStatus);

      if (!onboardingStatus) {
        console.log('[SignInModal Onboarding Check Effect] Onboarding NOT complete. Checking fields...');

        const missing = [];
        if (!currentUser.username) missing.push('username');
        if (!currentUser.height || !currentUser.height.feet) missing.push('height');
        if (!currentUser.birthdate) missing.push('birthdate');
        if (!currentUser.registrationComplete) missing.push('registrationComplete');
        console.log('[SignInModal] User missing onboarding fields:', missing);

        setIsSignUp(true); // Ensure we are in signup mode

        // Only force the step if not already in the correct onboarding step
        if (!currentUser.username) { // Highest priority is username
          // Only set back to profile if we aren't already trying to move forward
          if (signUpStep !== 'quiz-prompt' && signUpStep !== 'quiz') {
            console.log('[SignInModal Onboarding Check Effect] Setting step to profile (username missing and not already progressing)');
            setSignUpStep('profile');
          } else {
            console.log('[SignInModal Onboarding Check Effect] Username missing, but step is already quiz/quiz-prompt. Allowing progression.', { currentStep: signUpStep });
          }
        } else if (
          currentUser.username &&
          signUpStep !== 'quiz' &&
          signUpStep !== 'quiz-prompt'
        ) {
          console.log('[SignInModal Onboarding Check Effect] Setting step to quiz-prompt (username exists, onboarding incomplete)');
          setSignUpStep('quiz-prompt');
        } else {
          console.log('[SignInModal Onboarding Check Effect] Conditions met, but not changing step from:', signUpStep);
        }
      } else {
        console.log('[SignInModal Onboarding Check Effect] Onboarding IS complete. User should be okay. Current step:', signUpStep);
        // Potentially add logic here if needed when onboarding IS complete upon check
      }
    } else {
      // User signed out, reset form fields
      console.log('[SignInModal] User signed out, resetting form state.');
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError(null);
      setErrors({});
      setIsSignUp(false); // Reset to sign-in view
      setSignUpStep('initial'); // Reset step
      setIsForgotPassword(false); // Reset forgot password state
      setResetEmailSent(false);
    }
  }, [currentUser]); // Dependency is currentUser

  // Password validation states
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasMinLength = password.length >= 8;
  const passwordsMatch = password === confirmPassword;

  // Quiz states
  const [quizStep, setQuizStep] = useState<number>(0);
  const [quizData, setQuizData] = useState<QuizData>({
    gender: null,
    height: { feet: 0, inches: 0 },
    weight: 0,
    level: null,
    goal: [],
    birthdate: null,
  });

  // --- NEW: Subscription check function ---
  // After sign in/up, call this to fetch subscription data from Stripe (via your endpoint)
  // and update the user document. If the user is unsubscribed, redirect to /subscribe.
  const checkSubscriptionAndProceed = async (user: any) => {
    try {
      console.log('[SignInModal] Checking subscription:', {
        email: user.email,
        timestamp: new Date().toISOString()
      });

      const firestoreUser = await userService.fetchUserFromFirestore(user.uid);
      
      if (firestoreUser) {
        console.log('[SignInModal] User profile check:', {
          hasUsername: !!firestoreUser.username,
          username: firestoreUser.username,
          subscriptionType: firestoreUser.subscriptionType,
          timestamp: new Date().toISOString()
        });

        // --- Onboarding completeness check ---
        if (!isOnboardingComplete(firestoreUser)) {
          console.log('[SignInModal] User missing onboarding data, starting onboarding flow');
          setIsSignUp(true);
          setSignUpStep('profile');
          setIsLoading(false);
          return;
        }
        // --- End onboarding check ---

        const betaUserHasAccess = await userService.getBetaUserAccess(firestoreUser.email, firestoreUser);
        console.log('[SignInModal] Access check results:', {
          betaAccess: betaUserHasAccess,
          subscriptionType: firestoreUser.subscriptionType,
          timestamp: new Date().toISOString()
        });

        // If user has beta access or valid subscription
        if (betaUserHasAccess || firestoreUser.subscriptionType !== SubscriptionType.unsubscribed) {
          console.log('[SignInModal] User has access, closing modal');
          onSignInSuccess?.(user);
          onClose?.();
          return;
        }

        // If user is unsubscribed and not beta
        if (firestoreUser.subscriptionType === SubscriptionType.unsubscribed) {
          console.log('[SignInModal] Unsubscribed user, closing modal and redirecting');
          onClose?.();
          router.push('/subscribe');
          return;
        }
      }
    } catch (err) {
      console.error("[SignInModal] Error in subscription check:", err);
    }
  };

  const handleSocialAuth = async (provider: "google" | "apple") => {
    try {
      console.log(`[SignInModal] Starting ${provider} auth:`, {
        timestamp: new Date().toISOString()
      });
      
      setIsLoading(true);
      setError(null);
      setActiveProvider(provider);
   
      if (provider === "apple") {
        // Initialize Apple OAuth provider
        const appleProvider = new OAuthProvider("apple.com");
        appleProvider.addScope("email");
        appleProvider.addScope("name");
   
        try {
          // Sign in with popup
          const result: UserCredential = await signInWithPopup(auth, appleProvider);
          const user = result.user;
          // Fetch or create user in Firestore
          let firestoreUser = await userService.fetchUserFromFirestore(user.uid);
          if (!firestoreUser) {
            firestoreUser = new User(user.uid, {
              id: user.uid,
              email: user.email || "",
              displayName: user.displayName || "",
            });
            await userService.updateUser(user.uid, firestoreUser);
          }
          
          userService.nonUICurrentUser = firestoreUser; // Use nonUICurrentUser

          // If missing username, start registration flow (mirror Google path)
          if (!firestoreUser.username) {
            console.log('[SignInModal] Apple sign-in: Username missing, opening profile step');
            setIsSignUp(true);
            setSignUpStep('profile');
            setIsLoading(false);
            return;
          }

          // If unsubscribed, show subscription step
          if (firestoreUser.subscriptionType === SubscriptionType.unsubscribed) {
            setSignUpStep('subscription');
            return;
          }

          // Otherwise proceed with normal flow
          await checkSubscriptionAndProceed(user);
        } catch (error: unknown) {
          console.error("Apple sign-in error:", error);
          if (error instanceof Error) {
            setError(error.message);
            if (isSignUp) {
              onSignUpError?.(error);
            } else {
              onSignInError?.(error);
            }
          } else {
            const genericError = new Error("An unknown error occurred during Apple sign-in");
            setError(genericError.message);
            if (isSignUp) {
              onSignUpError?.(genericError);
            } else {
              onSignInError?.(genericError);
            }
          }
        }
      } else if (provider === 'google') {
        const result = await authService.signInWithGoogle();
        const user = result.user;
        // Strict email check
        if (!user || !user.email) {
          console.error('[SignInModal] Google sign-in completed but no email was provided. Cannot create user.');
          setError('Sign-in failed: Email address is required.');
          setIsLoading(false);
          setActiveProvider(null);
          return; // Stop execution
        }
        console.log('Google Sign In - Initial User:', user);
        console.log('Google Sign In - Firebase User:', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          metadata: user.metadata,
          providerData: user.providerData
        });
        let firestoreUser = await userService.fetchUserFromFirestore(user.uid);
        console.log('Google Sign In - Firestore User:', firestoreUser);
        if (firestoreUser) {
          // Log all user properties for debugging
          console.log('[SignInModal] Full Firestore user object after sign in:', JSON.parse(JSON.stringify(firestoreUser)));
        }
        if (!firestoreUser) {
          // Email exists, proceed with creation
          console.log('[SignInModal] Creating new Firestore user after Google Sign-In');
          firestoreUser = new User(user.uid, {
            id: user.uid,
            email: user.email,
            displayName: user.displayName || "",
            registrationComplete: false,
            subscriptionType: SubscriptionType.unsubscribed
          });
          await userService.updateUser(user.uid, firestoreUser);
          console.log('Google Sign In - Created New User:', firestoreUser);
        } else if (!firestoreUser.email && user.email) {
          // If user exists but email is missing, update it
          console.log('[SignInModal] Firestore user missing email, updating with Firebase user email');
          firestoreUser.email = user.email;
          await userService.updateUser(user.uid, firestoreUser);
        }
        userService.nonUICurrentUser = firestoreUser; // Use nonUICurrentUser
        console.log('Google Sign In - Current User Set:', userService.nonUICurrentUser); // Use nonUICurrentUser
        // Fix: Check if username is missing (using truthy check) instead of empty string comparison
        console.log("Username check:", {
          username: firestoreUser.username,
          isEmpty: !firestoreUser.username,
          typeOf: typeof firestoreUser.username
        });
        if (!firestoreUser.username) {
          console.log("Starting registration - username missing");
          setIsSignUp(true);
          setSignUpStep("profile");
          setIsLoading(false);
          return;
        }
        if (firestoreUser.subscriptionType === SubscriptionType.unsubscribed) {
          console.log("User is unsubscribed, showing subscription step");
          setSignUpStep('subscription');
          return;
        }
        // --- Onboarding completeness check ---
        if (!isOnboardingComplete(firestoreUser)) {
          console.log('[SignInModal] Google sign-in: User missing onboarding data, starting onboarding flow');
          setIsSignUp(true);
          setSignUpStep('profile');
          setIsLoading(false);
          return;
        }
        // --- End onboarding check ---
        console.log("Checking Subs");
        await checkSubscriptionAndProceed(user);
      }
    } catch (error: unknown) {
      // Keep your existing error handling
      console.error(`[SignInModal] ${provider} auth error:`, error);
      let errorMessage = "An unexpected error occurred";
      
      if (error instanceof Error) {
        // Handle specific Firebase Auth error codes
        switch ((error as any).code) {
          case 'auth/popup-blocked':
            errorMessage = "Please enable popups for this site and try again";
            break;
          case 'auth/popup-closed-by-user':
            errorMessage = "Sign-in cancelled. Please try again";
            break;
          case 'auth/cancelled-popup-request':
            errorMessage = "Another sign-in attempt is already in progress";
            break;
          case 'auth/account-exists-with-different-credential':
            errorMessage = "An account already exists with the same email address but different sign-in credentials. Please sign in using the original account method.";
            break;
          case 'auth/network-request-failed':
            errorMessage = "Network error. Please check your internet connection and try again";
            break;
          case 'auth/user-disabled':
            errorMessage = "This account has been disabled. Please contact support";
            break;
          case 'auth/operation-not-allowed':
            errorMessage = "This sign-in method is not enabled. Please contact support";
            break;
          default:
            errorMessage = error.message;
        }
        
        setError(errorMessage);
        
        if (isSignUp) {
          onSignUpError?.(error);
        } else {
          onSignInError?.(error);
        }
      } else {
        setError(errorMessage);
        const genericError = new Error(errorMessage);
        if (isSignUp) {
          onSignUpError?.(genericError);
        } else {
          onSignInError?.(genericError);
        }
      }
    } finally {
      setIsLoading(false);
      setActiveProvider(null);
    }
   };

  const addLog = (log: string) => {
    const currentLogs = JSON.parse(localStorage.getItem("authFlowLogs") || "[]");
    currentLogs.push(`[${new Date().toISOString()}] ${log}`);
    localStorage.setItem("authFlowLogs", JSON.stringify(currentLogs));
  };

  useEffect(() => {
    const logs = localStorage.getItem("authFlowLogs");
    if (logs) {
      console.log("Auth Flow Logs:");
      console.log("------------------------");
      JSON.parse(logs).forEach((log: string) => console.log(log));
      console.log("------------------------");
      localStorage.removeItem("authFlowLogs");
    }
   
    let isMounted = true;
   
    const handleRedirect = async () => {
      addLog("Starting redirect handler");
   
      if (!isVisible) {
        addLog("Modal not visible, skipping redirect handling");
        return;
      }
   
      const urlParams = new URLSearchParams(window.location.search);
      const isRedirecting = urlParams.has("state") || window.location.href.includes("__/auth/handler");
      addLog(`Redirect detected: ${isRedirecting}`);
      addLog(`Current URL: ${window.location.href}`);
   
      if (!isRedirecting) {
        addLog("No redirect parameters detected, exiting redirect handler");
        return;
      }
   
      try {
        setIsLoading(true);
        addLog("Calling getRedirectResult...");
        const result = await getRedirectResult(auth);
        addLog(`getRedirectResult result: ${JSON.stringify(result)}`);
   
        if (!result) {
          addLog("No result returned by getRedirectResult, checking pending redirect...");
          const pendingResult = await getRedirectResult(auth).catch((e) => {
            addLog(`Pending redirect error: ${e.message}`);
            return null;
          });
          addLog(`Pending redirect result: ${JSON.stringify(pendingResult)}`);
   
          if (!pendingResult) {
            addLog("No pending redirect result, exiting handler");
            return;
          }
        }
   
        if (!isMounted) {
          addLog("Component unmounted during redirect, exiting handler");
          return;
        }
   
        const credential = result as UserCredential;
        if (!credential || !credential.user) {
          throw new Error("No user credential found in redirect result");
        }
   
        const { user } = credential;
        addLog(`User info: providerId=${credential.providerId}, email=${user.email}, isNewUser=${user.metadata.creationTime === user.metadata.lastSignInTime}`);
   
        const isAppleSignIn = credential.providerId === "apple.com" || user.providerData.some((provider) => provider.providerId === "apple.com");
        let firestoreUser = await userService.fetchUserFromFirestore(user.uid);
   
        if (!firestoreUser && user.metadata.creationTime === user.metadata.lastSignInTime) {
          addLog("New user detected, creating Firestore document");
          
          // CRITICAL CHECK: Ensure email exists before creating user
          if (!user.email) {
            console.error('[SignInModal] Redirect sign-in completed but no email was provided. Cannot create user.');
            addLog("Redirect sign-in failed: Email address is required.");
            setError('Sign-in failed: Email address is required.');
            setIsLoading(false);
            setActiveProvider(null);
            return; // Stop execution
          }
          
          // Email exists, proceed with creation
          firestoreUser = new User(user.uid, {
            id: user.uid,
            email: user.email,
            displayName: user.displayName || "",
          });
          await userService.updateUser(user.uid, firestoreUser);
          addLog(`Created new Firestore user: ${firestoreUser.id}`);
        } else if (firestoreUser) {
          // Check if username is missing - highest priority
          if (!firestoreUser.username) {
            setIsSignUp(true);
            setSignUpStep('profile');
            addLog("User missing username, starting registration flow");
            setIsLoading(false);
            return;
          }
          
          // Check subscription status
          if (firestoreUser.subscriptionType === SubscriptionType.unsubscribed) {
            setSignUpStep('subscription');
            addLog("User unsubscribed, showing subscription step");
          } else if (user.metadata.creationTime === user.metadata.lastSignInTime) {
            onSignUpSuccess?.(user);
            addLog("New user signup successful");
          } else {
            onSignInSuccess?.(user);
            addLog("Existing user signin successful");
          }
        }
      } catch (error) {
        addLog(`Redirect handler error: ${error instanceof Error ? error.message : error}`);
        if (!isMounted) return;
   
        setError(error instanceof Error ? error.message : "Authentication failed");
        isSignUp ? onSignUpError?.(error as Error) : onSignInError?.(error as Error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          addLog("Redirect handler complete");
        }
      }
    };
   
    handleRedirect();
   
    return () => {
      isMounted = false;
    };
   }, [isVisible, onSignInSuccess, onSignUpSuccess, onSignInError, onSignUpError, onClose]);

   const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[SignInModal] Form submission started:', {
      isSignUp,
      signUpStep,
      isInitialStep: signUpStep === "initial",
      isPasswordStep: signUpStep === "password",
      isProfileStep: signUpStep === "profile",
      signUpStepType: typeof signUpStep,
      currentEmail: email,
      hasPassword: !!password,
      passwordLength: password.length,
      currentUser: auth.currentUser?.email,
      timestamp: new Date().toISOString()
    });
  
    if (signUpStep === "profile") {
      try {
        setIsLoading(true);
        setError(null);
        const userId = auth.currentUser?.uid;
        if (!userId) {
          throw new Error("No authenticated user found for profile update");
        }

        // --- Fetch current data first --- 
        const currentUserData = await userService.fetchUserFromFirestore(userId);
        if (!currentUserData) {
            throw new Error("Could not load current user data for profile update.");
        }
        console.log('[SignInModal Profile Step] Fetched current user data before update');
        // --- End Fetch ---

        // Email fallback: Ensure email is included
        const currentEmail = currentUserData.email || auth.currentUser?.email;
        if (!currentEmail) {
          console.error('[SignInModal Registration Profile]: Email is missing, cannot complete registration.');
          throw new Error("Email is missing, cannot complete registration.");
        }

        // Prepare the updated user data, merging with fetched data
        const updatedUser = new User(userId, {
          ...currentUserData.toDictionary(), // Base on fetched data
          username: username,                // Add new username
          email: currentEmail,               // Ensure email is present
          registrationComplete: true,      // Mark registration complete
          updatedAt: new Date()              // Update timestamp
        });

        console.log('[SignInModal Profile Step] Attempting to update user with:', JSON.parse(JSON.stringify(updatedUser.toDictionary())));
        await userService.updateUser(userId, updatedUser);
        console.log('[SignInModal Profile Step] User update successful. Moving to quiz prompt.');
        
        // Update local state immediately
        userService.nonUICurrentUser = updatedUser;
        
        // NEW: Check if we need to auto-join a challenge after profile completion
        if (roundIdRedirect) {
          console.log('[SignInModal Profile Step] Profile complete with username. Found roundIdRedirect. Attempting auto-join:', roundIdRedirect);
          
          // Check subscription status for auto-join decision
          if (updatedUser.subscriptionType !== SubscriptionType.unsubscribed) {
            await autoJoinChallenge(roundIdRedirect); // Await the join attempt
            dispatch(clearRoundIdRedirect()); // Clear the redirect ID after join attempt
            
            // Still continue to quiz-prompt regardless of join success/failure
            setSignUpStep("quiz-prompt");
          } else {
            console.log('[SignInModal Profile Step] User is unsubscribed. Moving to quiz-prompt first, deferring join.');
            // Set the next step but keep roundIdRedirect for later
            setSignUpStep("quiz-prompt");
          }
        } else {
          // Normal flow - no pending challenge join
          setSignUpStep("quiz-prompt");
        }

      } catch (err) {
        console.error("[SignInModal Profile Step] Error updating username:", err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
      return; // Important: Stop handleSubmit execution after profile step
    }

    if (!isSignUp) {
      try {
        setIsLoading(true);
        setError(null);
        
        const result = await authService.signInWithEmail(email, password);
        const userDoc = await userService.fetchUserFromFirestore(result.user.uid);
        userService.nonUICurrentUser = userDoc; // Use nonUICurrentUser

        console.log('[SignInModal] User document:', {
          hasUsername: !!userDoc?.username,
          subscriptionType: userDoc?.subscriptionType,
          timestamp: new Date().toISOString()
        });

        if (userDoc) {
          // Check if username is missing
          if (!userDoc.username) {
            console.log('[SignInModal] User missing username, starting registration');
            setIsSignUp(true);
            setSignUpStep('profile');
            setIsLoading(false);
            return;
          }

          const betaUserHasAccess = await userService.getBetaUserAccess(userDoc.email, userDoc);
          console.log('[SignInModal] Beta access check:', {
            hasAccess: betaUserHasAccess,
            timestamp: new Date().toISOString()
          });

          if (betaUserHasAccess || userDoc.subscriptionType !== SubscriptionType.unsubscribed) {
            console.log('[SignInModal] User has access, attempting to close modal');
            handleSignInSuccess(result.user);
            return;
          }

          if (userDoc.subscriptionType === SubscriptionType.unsubscribed) {
            console.log('[SignInModal] Unsubscribed user, redirecting');
            onClose?.();
            router.push('/subscribe');
            return;
          }
        }
      } catch (err) {
        console.error("[SignInModal] Error during sign-in:", err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        onSignInError?.(err instanceof Error ? err : new Error('An error occurred'));
      } finally {
        setIsLoading(false);
      }
    } else {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('[SignInModal] In sign-up flow with step:', {
          signUpStep,
          email,
          hasPassword: !!password,
          passwordLength: password ? password.length : 0,
          timestamp: new Date().toISOString()
        });
        
        // If we're at the initial step, just validate the email and move to password step
        if (signUpStep === "initial") {
          console.log('[SignInModal] Moving from initial to password step:', {
            email,
            timestamp: new Date().toISOString()
          });
          
          // Validate email
          if (!email) {
            setError("Please enter your email address");
            setIsLoading(false);
            return;
          }
          
          // Move to password step
          setSignUpStep("password");
          setShowError(false);
          setIsLoading(false);
          return;
        }
        
        // If we're at the password step, create the account with email and password
        if (signUpStep === "password") {
          console.log('[SignInModal] Creating account with email/password:', {
            email,
            passwordLength: password.length,
            timestamp: new Date().toISOString()
          });
          
          // Validate password
          if (!password) {
            setError("Please enter a password");
            setIsLoading(false);
            return;
          }
          
          if (!hasUppercase || !hasNumber || !hasMinLength || !passwordsMatch) {
            setError("Please ensure your password meets all requirements");
            setShowError(true);
            setIsLoading(false);
            return;
          }
          
          try {
            // Create the Firebase Auth user
            const { user } = await createUserWithEmailAndPassword(auth, email, password);
            console.log('[SignInModal] Auth User created successfully:', { uid: user.uid, email: user.email });

            if (user) {
              if (!user.email) {
                  console.error('[SignInModal] Email/Password sign-up completed but no email was provided. This should not happen.');
                  setError('Sign-up failed: An unexpected error occurred (missing email).');
                  setIsLoading(false);
                  return; // Stop execution
              }

              // Create a new local User object for Firestore
              const newUser = new User(user.uid, {
                id: user.uid,
                email: user.email,
                subscriptionType: SubscriptionType.unsubscribed, // Default for new user
                registrationComplete: false, // Explicitly false initially
                createdAt: new Date(), // Add createdAt
                updatedAt: new Date()  // Add updatedAt
                // Other fields will be default/null
              });

              // *** IMMEDIATELY CREATE FIRESTORE DOC ***
              console.log('[SignInModal] Attempting to create initial Firestore document...');
              try {
                  await userService.updateUser(user.uid, newUser);
                  console.log('[SignInModal] Initial Firestore document created/updated successfully.');
              } catch (firestoreError) {
                  console.error('[SignInModal] FATAL: Failed to create initial Firestore document:', firestoreError);
                  // Handle this critical error appropriately
                  setError('Failed to initialize user profile. Please try again or contact support.');
                  setIsLoading(false);
                  return; // Stop execution if Firestore creation fails
              }
              // *** --- ***

              // Update local/Redux state - AuthWrapper will pick this up via onAuthStateChanged
              userService.nonUICurrentUser = newUser;
              console.log('[SignInModal] New user state set locally. AuthWrapper should take over.');

              // No need to setSignUpStep here - AuthWrapper handles it

              setShowError(false);

              // Optional: Notify parent immediately if needed, though AuthWrapper's logic might suffice
              // onSignUpSuccess?.(user);
            }
          } catch (createUserError: any) {
              // ... (existing error handling, including email-already-in-use) ...
               console.error("[SignInModal] Error creating user:", createUserError);
              // Specific handling for email-already-in-use
              if (createUserError.code === 'auth/email-already-in-use') {
                  setError('This email is already in use. Please sign in or use a different email.');
                  setSignUpStep('initial'); // Go back to the email step
              } else {
                  // Handle other errors generically
                  setError(createUserError instanceof Error ? createUserError.message : 'Error creating account');
              }
             // Keep loading spinner active on error? Maybe only set false on success?
             // setIsLoading(false); // Commented out - let finally handle it?
          } finally {
              // Reset loading state only if it hasn't been reset by a specific error case above
              // Or simply always reset it here? Let's always reset for simplicity for now.
              setIsLoading(false); 
          }
        }
      } catch (err) {
        const error = err as Error;
        console.error("Error during sign-up:", error);
        setError(error.message);
        onSignUpError?.(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // ** Auto Join Challenge Function **
  const autoJoinChallenge = async (roundId: string) => {
    console.log('[SignInModal] autoJoinChallenge triggered for roundId:', roundId);
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('[SignInModal] autoJoinChallenge: No authenticated user found.');
      dispatch(showToast({ message: 'Authentication error, cannot join round.', type: 'error' }));
      return;
    }
    if (!currentUser.email) {
        console.error('[SignInModal] autoJoinChallenge: User email is missing.');
        dispatch(showToast({ message: 'User email missing, cannot join round.', type: 'error' }));
        return;
    }

    // ENHANCED VERIFICATION: Directly check for username in Firestore
    try {
      const firestoreUser = await userService.fetchUserFromFirestore(currentUser.uid);
      if (!firestoreUser || !firestoreUser.username) {
        console.error('[SignInModal] autoJoinChallenge: Username missing in Firestore document');
        dispatch(showToast({ message: 'Please complete your profile before joining this round.', type: 'warning' }));
        
        // Force profile completion flow
        setIsSignUp(true);
        setSignUpStep('profile');
        return;
      }

      // ** Check if user already joined this challenge **
      console.log(`[SignInModal] autoJoinChallenge: Checking if user ${currentUser.uid} already joined challenge ${roundId}`);
      const existingUserChallenges = await workoutService.fetchUserChallengesByUserId(currentUser.uid);
      const alreadyJoined = existingUserChallenges.some(uc => uc.challengeId === roundId);

      if (alreadyJoined) {
        console.log(`[SignInModal] autoJoinChallenge: User ${currentUser.uid} already has a UserChallenge for round ${roundId}. Skipping join.`);
        dispatch(showToast({ 
          message: 'You are already a challenger for this round. Hop in the chat and talk some smack!', 
          type: 'info', // Use info type for this message
          duration: 5000 // Longer duration
        }));
        return; // Stop execution
      }
      // **********************************************

      // Fetch the full challenge/collection data using the ID
      console.log(`[SignInModal] autoJoinChallenge: User not joined yet. Fetching collection for ID: ${roundId}`);
      const collection = await workoutService.getCollectionById(roundId);
      if (!collection || !collection.challenge) {
        console.error('[SignInModal] autoJoinChallenge: Challenge/Collection not found for ID:', roundId);
        dispatch(showToast({ message: 'Challenge details not found.', type: 'error' }));
        return;
      }

      const challengeToJoin = collection.challenge as Challenge; // Use the challenge object

      // ENHANCED VERIFICATION: Use the Firestore username instead of relying on local state
      const username = firestoreUser.username;
      console.log('[SignInModal] autoJoinChallenge: Using verified username from Firestore:', username);
      
      console.log('[SignInModal] autoJoinChallenge: Calling workoutService.joinChallenge with:', { username, challengeId: challengeToJoin.id });
      await workoutService.joinChallenge({ username, challengeId: challengeToJoin.id });
      
      console.log('[SignInModal] autoJoinChallenge: Successfully joined challenge:', challengeToJoin.id);
      dispatch(showToast({ message: 'Successfully joined challenge!', type: 'success' }));

    } catch (error) {
      console.error('[SignInModal] autoJoinChallenge: Error joining challenge:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to automatically join challenge.';
      dispatch(showToast({ message: errorMessage, type: 'error' }));
    }
  };

  const handleCompleteQuiz = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("No user found");

      console.log('[Quiz Debug - handleCompleteQuiz] State at start (local):', JSON.parse(JSON.stringify(userService.nonUICurrentUser)));

      const refreshedUser = await userService.fetchUserFromFirestore(userId);
      console.log('[Quiz Debug - handleCompleteQuiz] State after refresh from Firestore:', JSON.parse(JSON.stringify(refreshedUser)));
      onQuizComplete?.(); // Notify parent - Restore this line

      if (!refreshedUser) {
        throw new Error("User data missing after quiz completion.");
      }

      // Enhanced verification - explicitly check for username
      if (!refreshedUser.username) {
        console.log('[SignInModal] handleCompleteQuiz: Username is missing after quiz. Forcing profile step.');
        setIsSignUp(true);
        setSignUpStep('profile');
        setIsLoading(false);
        // Keep roundIdRedirect preserved
        return;
      }

      // ** Auto-join check **
      if (roundIdRedirect) {
        // Only auto-join if the user is subscribed AND has a username
        if (refreshedUser.subscriptionType !== SubscriptionType.unsubscribed) {
          console.log(`[SignInModal] handleCompleteQuiz: User is subscribed and has username. Attempting auto-join for round: ${roundIdRedirect}`);
          await autoJoinChallenge(roundIdRedirect); // Await the join process
          dispatch(clearRoundIdRedirect()); // Clear the ID after attempting join
        } else {
          console.log(`[SignInModal] handleCompleteQuiz: User is unsubscribed. Deferring auto-join for round: ${roundIdRedirect}`);
          // Do NOT clear roundIdRedirect here - needed after subscription
        }
      }

      // Determine next step *after* potential auto-join attempt or deferral
      if (refreshedUser.subscriptionType === SubscriptionType.unsubscribed) {
        console.log('[SignInModal] Quiz complete. Unsubscribed. Redirecting to /subscribe');
        router.push('/subscribe'); // Navigate directly if unsubscribed
      } else {
        console.log('[SignInModal] Quiz complete. Closing modal.');
        onClose?.(); // Close modal for subscribed users (no redirect needed)
      }

    } catch (err) {
       // ... (existing catch block)
       const error = err as Error;
       console.error("Error completing quiz and redirecting:", error);
       setError(error.message);
    } finally {
       setIsLoading(false);
    }
  };

  const renderSubscriptionStep = () => (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          Join The Fitness Collective
        </h2>
        <p className="text-zinc-400 text-sm mb-6">
          Subscribe to unlock all premium features and join our fitness community.
        </p>
      </div>
  
      <div className="space-y-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex-shrink-0 bg-[#E0FE10] rounded-full flex items-center justify-center">
            <span className="text-black text-sm">✓</span>
          </div>
          <span className="text-zinc-400">Access to Rounds - Train and compete with the community</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex-shrink-0 bg-[#E0FE10] rounded-full flex items-center justify-center">
            <span className="text-black text-sm">✓</span>
          </div>
          <span className="text-zinc-400">AI-powered workout recommendations</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex-shrink-0 bg-[#E0FE10] rounded-full flex items-center justify-center">
            <span className="text-black text-sm">✓</span>
          </div>
          <span className="text-zinc-400">Unlimited workout history and progress tracking</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex-shrink-0 bg-[#E0FE10] rounded-full flex items-center justify-center">
            <span className="text-black text-sm">✓</span>
          </div>
          <span className="text-zinc-400">Access to trainer-created content and exercises</span>
        </div>
      </div>
  
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-800 p-6 rounded-xl">
          <div className="text-white text-2xl font-bold mb-1">$4.99/mo</div>
          <p className="text-zinc-400 text-sm mb-4">Flexible monthly plan</p>
          <button 
            onClick={() => window.open('https://buy.stripe.com/9AQaFieX9bv26fSfYY', '_blank')}
            className="w-full bg-[#E0FE10] text-black py-2 rounded-lg font-semibold hover:bg-[#E0FE10]/90"
          >
            Subscribe Monthly
          </button>
        </div>
  
        <div className="bg-zinc-800 p-6 rounded-xl relative overflow-hidden">
          <div className="absolute -right-8 -top-8 bg-[#E0FE10] text-black text-xs font-bold py-1 px-8 rotate-45">
            BEST VALUE
          </div>
          <div className="text-white text-2xl font-bold mb-1">$39.99/yr</div>
          <p className="text-zinc-400 text-sm mb-4">Annual plan with 30-day free trial</p>
          <button 
            onClick={() => window.open('https://buy.stripe.com/28obJm2an8iQdIk289', '_blank')}
            className="w-full bg-[#E0FE10] text-black py-2 rounded-lg font-semibold hover:bg-[#E0FE10]/90"
          >
            Start Free Trial
          </button>
        </div>
      </div>
  
      <p className="text-zinc-500 text-xs text-center">
        Cancel anytime. All subscriptions include unlimited access to all features.
      </p>
    </>
  );

  const renderQuizPrompt = () => (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          One Last Thing!
        </h2>
        <p className="text-zinc-400 font-['HK Grotesk'] text-sm px-4">
          Take our quick fitness quiz to help Pulse AI create more accurate workout and fitness creator recommendations.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <button
          onClick={() => setSignUpStep("quiz")}
          className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#c8e60e] transition-colors font-['HK Grotesk']"
        >
          Take the Quiz
        </button>
        <button
          onClick={async () => {
            try {
              setIsLoading(true);
              setError(null);
              
              // Call the callback provided by parent
              onQuizSkipped?.();
              
              const userId = auth.currentUser?.uid;
              if (!userId) throw new Error("No user found");
              
              // Fetch latest user data
              const refreshedUser = await userService.fetchUserFromFirestore(userId);
              
              if (!refreshedUser) {
                throw new Error("User data missing after skipping quiz.");
              }
              
              // Enhanced verification - explicitly check for username
              if (!refreshedUser.username) {
                console.log('[SignInModal] onQuizSkipped: Username is missing. Forcing profile step.');
                setIsSignUp(true);
                setSignUpStep('profile');
                setIsLoading(false);
                return;
              }
              
              // Handle auto-join challenge if needed
              if (roundIdRedirect) {
                if (refreshedUser.subscriptionType !== SubscriptionType.unsubscribed) {
                  console.log(`[SignInModal] onQuizSkipped: User is subscribed and has username. Attempting auto-join for round: ${roundIdRedirect}`);
                  await autoJoinChallenge(roundIdRedirect);
                  dispatch(clearRoundIdRedirect());
                } else {
                  console.log(`[SignInModal] onQuizSkipped: User is unsubscribed. Deferring auto-join for round: ${roundIdRedirect}`);
                }
              }
              
              // Handle next step based on subscription status
              if (refreshedUser.subscriptionType === SubscriptionType.unsubscribed) {
                console.log('[SignInModal] Quiz skipped. Unsubscribed. Redirecting to /subscribe');
                router.push('/subscribe');
              } else {
                console.log('[SignInModal] Quiz skipped. Closing modal.');
                onClose?.();
              }
              
            } catch (err) {
              const error = err as Error;
              console.error("Error handling quiz skip:", error);
              setError(error.message);
            } finally {
              setIsLoading(false);
            }
          }}
          className="w-full bg-zinc-800 text-white font-semibold py-3 px-4 rounded-lg hover:bg-zinc-700 transition-colors font-['HK Grotesk']"
        >
          Skip for Now
        </button>
      </div>
    </>
  );

  const questions = [
    // Gender Question
    <div key="gender" className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          How do you identify?
        </h2>
        <p className="text-zinc-400 font-['HK Grotesk'] text-sm">
          This helps when giving fitness recommendations and calculating metrics.
        </p>
      </div>

      <div className="space-y-3">
        {["Man", "Woman", "I'd rather self describe"].map((option) => (
          <button
            key={option}
            onClick={async () => {
              let genderValue: Gender;

              // Convert option to proper Gender enum
              switch(option) {
                case "Man":
                  genderValue = Gender.Man;
                  break;
                case "Woman":
                  genderValue = Gender.Woman;
                  break;
                default:
                  genderValue = Gender.SelfDescribe;
              }

              setQuizData({ ...quizData, gender: option as any });

              const userId = auth.currentUser?.uid;
              if (userId) {
                try {
                  const currentUserData = await userService.fetchUserFromFirestore(userId);
                  if (currentUserData) {
                    currentUserData.gender = genderValue;
                    currentUserData.updatedAt = new Date();
                    await userService.updateUser(userId, currentUserData); // Save the fetched and modified object

                    // --- NEW: Refresh user and update Redux ---
                    const refreshedUser = await userService.fetchUserFromFirestore(userId);
                    userService.nonUICurrentUser = refreshedUser; // Use nonUICurrentUser
                  } else {
                     console.error("[Quiz Debug - Gender Click] Could not fetch user data for update.");
                  }
                } catch (error) {
                  console.error("[Quiz Debug - Gender Click] Error fetching/updating user:", error);
                }
              }

              // Delay the step change slightly to potentially avoid state race conditions with parent component
              setTimeout(() => {
                setQuizStep(quizStep + 1);
              }, 50); // 50ms delay
            }}
            className={`w-full p-4 rounded-lg border ${
              quizData.gender === option
                ? "border-[#E0FE10] bg-[#E0FE10]/10"
                : "border-zinc-700 hover:border-[#E0FE10]"
            } text-left text-white transition-colors`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>,
    // Height Question
    <div key="height" className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          What is your height?
        </h2>
        <p className="text-zinc-400 font-['HK Grotesk'] text-sm">
          Height helps recommendations and calculating metrics.
        </p>
      </div>

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-2">Feet</label>
          <input
            type="number"
            value={quizData.height.feet || ""}
            onChange={async (e) => {
              const newFeet = Number(e.target.value);
              const newHeight = { ...quizData.height, feet: newFeet };
              setQuizData({ ...quizData, height: newHeight });

              const userId = auth.currentUser?.uid;
              if (userId) {
                try {
                  const currentUserData = await userService.fetchUserFromFirestore(userId);
                  if (currentUserData) {
                    currentUserData.height = newHeight;
                    currentUserData.updatedAt = new Date();
                    await userService.updateUser(userId, currentUserData);

                    // --- NEW: Refresh user and update Redux ---
                    const refreshedUser = await userService.fetchUserFromFirestore(userId);
                    userService.nonUICurrentUser = refreshedUser; // Use nonUICurrentUser
                  } else {
                     console.error("[Quiz Debug - Height Feet Change] Could not fetch user data for update.");
                  }
                } catch (error) {
                  console.error("[Quiz Debug - Height Feet Change] Error fetching/updating user:", error);
                }
              }
            }}
            min="0"
            max="8"
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] transition-colors"
            placeholder="0"
          />
        </div>

        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-2">Inches</label>
          <input
            type="number"
            value={quizData.height.inches || ""}
            onChange={async (e) => {
              const newInches = Number(e.target.value);
              const newHeight = { ...quizData.height, inches: newInches };
              setQuizData({ ...quizData, height: newHeight });

              const userId = auth.currentUser?.uid;
              if (userId) {
                try {
                  const currentUserData = await userService.fetchUserFromFirestore(userId);
                  if (currentUserData) {
                    currentUserData.height = newHeight;
                    currentUserData.updatedAt = new Date();
                    await userService.updateUser(userId, currentUserData);

                    // --- NEW: Refresh user and update Redux ---
                    const refreshedUser = await userService.fetchUserFromFirestore(userId);
                    userService.nonUICurrentUser = refreshedUser; // Use nonUICurrentUser
                  } else {
                     console.error("[Quiz Debug - Height Inches Change] Could not fetch user data for update.");
                  }
                } catch (error) {
                  console.error("[Quiz Debug - Height Inches Change] Error fetching/updating user:", error);
                }
              }
            }}
            min="0"
            max="11"
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] transition-colors"
            placeholder="0"
          />
        </div>
      </div>

      {(quizData.height.feet > 8 || quizData.height.inches > 11) && (
        <p className="text-red-400 text-sm mt-2">
          Please enter a valid height
        </p>
      )}
    </div>,
    // Weight Question
    <div key="weight" className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          What's your current weight?
        </h2>
      </div>

      <div className="flex gap-4">
        <input
          type="number"
          value={quizData.weight || ""}
          onChange={async (e) => {
            const newWeight = Number(e.target.value);
            setQuizData({ ...quizData, weight: newWeight });

            const userId = auth.currentUser?.uid;
            if (userId) {
              try {
                const currentUserData = await userService.fetchUserFromFirestore(userId);
                if (currentUserData) {
                  const newBodyWeight = new BodyWeight({
                    oldWeight: currentUserData.bodyWeight.length > 0
                      ? currentUserData.bodyWeight[currentUserData.bodyWeight.length - 1].newWeight
                      : 0,
                    newWeight: newWeight
                  });

                  currentUserData.bodyWeight = [...currentUserData.bodyWeight, newBodyWeight];
                  currentUserData.updatedAt = new Date();
                  await userService.updateUser(userId, currentUserData);

                  // --- NEW: Refresh user and update Redux ---
                  const refreshedUser = await userService.fetchUserFromFirestore(userId);
                  userService.nonUICurrentUser = refreshedUser; // Use nonUICurrentUser
                } else {
                   console.error("[Quiz Debug - Weight Change] Could not fetch user data for update.");
                }
              } catch (error) {
                console.error("[Quiz Debug - Weight Change] Error fetching/updating user:", error);
              }
            }
          }}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white"
          placeholder="Enter weight in lbs"
          min="0"
        />
        <span className="flex items-center text-zinc-400">Lbs</span>
      </div>
    </div>,
    // Gym Experience
    <div key="experience" className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          How well do you know your way around the gym?
        </h2>
      </div>

      <div className="space-y-3">
        {["Novice", "Intermediate", "Expert"].map((level) => (
          <button
            key={level}
            onClick={async () => {
              const levelMap = {
                "Novice": UserLevel.Novice,
                "Intermediate": UserLevel.Intermediate,
                "Expert": UserLevel.Expert
              };

              setQuizData({ ...quizData, level: level as any });

              const userId = auth.currentUser?.uid;
              if (userId) {
                try {
                  const currentUserData = await userService.fetchUserFromFirestore(userId);
                  if (currentUserData) {
                    currentUserData.level = levelMap[level as keyof typeof levelMap];
                    currentUserData.updatedAt = new Date();
                    await userService.updateUser(userId, currentUserData);

                    // --- NEW: Refresh user and update Redux ---
                    const refreshedUser = await userService.fetchUserFromFirestore(userId);
                    userService.nonUICurrentUser = refreshedUser; // Use nonUICurrentUser
                  } else {
                    console.error("[Quiz Debug - Experience Click] Could not fetch user data for update.");
                  }
                } catch (error) {
                  console.error("[Quiz Debug - Experience Click] Error fetching/updating user:", error);
                }
              }
              setQuizStep(quizStep + 1);
            }}
            className={`w-full p-4 rounded-lg border ${
              quizData.level === level
                ? "border-[#E0FE10] bg-[#E0FE10]/10"
                : "border-zinc-700 hover:border-[#E0FE10]"
            } text-left text-white transition-colors`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>,
    // Fitness Goal
    <div key="goals" className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          What is your fitness goal?
        </h2>
        <p className="text-zinc-400 font-['HK Grotesk'] text-sm">
          Select all that apply
        </p>
      </div>

      <div className="space-y-3">
        {(["Lose weight", "Gain muscle mass", "Tone up", "General Fitness"] as FitnessGoal[]).map((goal) => (
          <button
            type="button"
            key={goal}
            onClick={async () => {
              const goalsMap = {
                "Lose weight": WorkoutGoal.LoseWeight,
                "Gain muscle mass": WorkoutGoal.GainWeight,
                "Tone up": WorkoutGoal.ToneUp,
                "General Fitness": WorkoutGoal.GeneralFitness
              };

              // Determine updated goals
              const updatedGoals = quizData.goal.includes(goal)
                ? quizData.goal.filter((g) => g !== goal)
                : [...quizData.goal, goal];

              setQuizData((prev: QuizData) => ({
                ...prev,
                goal: updatedGoals,
              }));

              const userId = auth.currentUser?.uid;
              if (userId) {
                try {
                  const currentUserData = await userService.fetchUserFromFirestore(userId);
                  if (currentUserData) {
                    currentUserData.goal = updatedGoals.map(g => goalsMap[g]);
                    currentUserData.updatedAt = new Date();
                    await userService.updateUser(userId, currentUserData);

                    // --- NEW: Refresh user and update Redux ---
                    const refreshedUser = await userService.fetchUserFromFirestore(userId);
                    userService.nonUICurrentUser = refreshedUser; // Use nonUICurrentUser
                  } else {
                    console.error("[Quiz Debug - Goal Click] Could not fetch user data for update.");
                  }
                } catch (error) {
                  console.error("[Quiz Debug - Goal Click] Error fetching/updating user:", error);
                }
              }
              // Only move to next step if at least one goal is selected
              if (updatedGoals.length > 0) {
                setQuizStep(quizStep + 1);
              }
            }}
            className={`w-full p-4 rounded-lg border ${
              quizData.goal.includes(goal)
                ? "border-[#E0FE10] bg-[#E0FE10]/10"
                : "border-zinc-700 hover:border-[#E0FE10]"
            } text-left text-white transition-colors relative`}
          >
            <span>{goal}</span>
            {quizData.goal.includes(goal) && (
              <svg
                className="w-5 h-5 absolute right-4 top-1/2 transform -translate-y-1/2 text-[#E0FE10]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>,
    // Birthdate
    <div key="birthdate" className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          When is your birthdate?
        </h2>
        <p className="text-zinc-400 font-['HK Grotesk'] text-sm">
          We ask for your age to ensure accurate fitness calculations.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <select
          className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white"
          onChange={async (e) => {
            const date = new Date(quizData.birthdate || new Date());
            date.setMonth(parseInt(e.target.value));
            setQuizData({ ...quizData, birthdate: date });

            const userId = auth.currentUser?.uid;
            if (userId) {
              try {
                const currentUserData = await userService.fetchUserFromFirestore(userId);
                if (currentUserData) {
                  currentUserData.birthdate = date;
                  currentUserData.updatedAt = new Date();
                  await userService.updateUser(userId, currentUserData);

                  // --- NEW: Refresh user and update Redux ---
                  const refreshedUser = await userService.fetchUserFromFirestore(userId);
                  userService.nonUICurrentUser = refreshedUser; // Use nonUICurrentUser
                } else {
                  console.error("[Quiz Debug - Birthdate Month Change] Could not fetch user data for update.");
                }
              } catch (error) {
                console.error("[Quiz Debug - Birthdate Month Change] Error fetching/updating user:", error);
              }
            }
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {new Date(0, i).toLocaleString("default", { month: "long" })}
            </option>
          ))}
        </select>

        <select
          className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white"
          onChange={async (e) => {
            const date = new Date(quizData.birthdate || new Date());
            date.setDate(parseInt(e.target.value));
            setQuizData({ ...quizData, birthdate: date });

            const userId = auth.currentUser?.uid;
             if (userId) {
              try {
                const currentUserData = await userService.fetchUserFromFirestore(userId);
                if (currentUserData) {
                  currentUserData.birthdate = date;
                  currentUserData.updatedAt = new Date();
                  await userService.updateUser(userId, currentUserData);

                  // --- NEW: Refresh user and update Redux ---
                  const refreshedUser = await userService.fetchUserFromFirestore(userId);
                  userService.nonUICurrentUser = refreshedUser; // Use nonUICurrentUser
                } else {
                  console.error("[Quiz Debug - Birthdate Day Change] Could not fetch user data for update.");
                }
              } catch (error) {
                console.error("[Quiz Debug - Birthdate Day Change] Error fetching/updating user:", error);
              }
            }
          }}
        >
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>

        <select
          className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white"
          onChange={async (e) => {
            const date = new Date(quizData.birthdate || new Date());
            date.setFullYear(parseInt(e.target.value));
            setQuizData({ ...quizData, birthdate: date });

            const userId = auth.currentUser?.uid;
            if (userId) {
              try {
                const currentUserData = await userService.fetchUserFromFirestore(userId);
                if (currentUserData) {
                  currentUserData.birthdate = date;
                  currentUserData.updatedAt = new Date();
                  await userService.updateUser(userId, currentUserData);

                  // --- NEW: Refresh user and update Redux ---
                  const refreshedUser = await userService.fetchUserFromFirestore(userId);
                  userService.nonUICurrentUser = refreshedUser; // Use nonUICurrentUser
                } else {
                  console.error("[Quiz Debug - Birthdate Year Change] Could not fetch user data for update.");
                }
              } catch (error) {
                console.error("[Quiz Debug - Birthdate Year Change] Error fetching/updating user:", error);
              }
            }
          }}
        >
          {Array.from({ length: 100 }, (_, i) => {
            const year = new Date().getFullYear() - i;
            return (
              <option key={year} value={year}>
                {year}
              </option>
            );
          })}
        </select>
      </div>
    </div>,
  ];

  const renderQuizQuestion = () => {
    return questions[quizStep];
  };

  const isLastQuizStep = () => quizStep === questions.length - 1;

  const validateEmail = () => {
    if (!email) {
      setErrors({ email: "Email is required" });
      setShowError(true);
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: "Please enter a valid email address" });
      setShowError(true);
      return false;
    }
    return true;
  };

  const validatePassword = () => {
    if (!hasUppercase || !hasNumber || !hasMinLength || !passwordsMatch) {
      setShowError(true);
      return false;
    }
    return true;
  };

  const validateUsername = () => {
    if (!username) {
      setErrors({ username: "Username is required" });
      setShowError(true);
      return false;
    }
    return isUsernameAvailable;
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    // Simulated username availability check
    setIsUsernameAvailable(/^[a-zA-Z0-9_]{3,}$/.test(value));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsImageUploading(true);
        setProfileImage(file);
        
        const uploadResult = await firebaseStorageService.uploadImage(
          file, 
          UploadImageType.Profile
        );
    
        console.log('Profile image uploaded successfully', uploadResult);
      } catch (error) {
        console.error('Profile image upload failed', error);
        setError('Failed to upload profile image');
        setProfileImage(null);
      } finally {
        setIsImageUploading(false);
      }
    }
  };

  const renderProfileStep = () => (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          Personalize your experience
        </h2>
        <p className="text-zinc-400 font-['HK Grotesk'] text-sm">
          Set a username and profile image
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Image Upload */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden">
              {profileImage ? (
                <img
                  src={URL.createObjectURL(profileImage)}
                  alt="Profile Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera size={32} className="text-zinc-500" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#E0FE10] rounded-full flex items-center justify-center cursor-pointer">
              <Camera size={16} className="text-black" />
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>

            {/* PLACE LOADING STATE HERE */}
            {isImageUploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="loader border-t-transparent border-4 border-white rounded-full w-8 h-8 animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        {/* Username Input */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
              Username
            </label>
            {username && (
              <span className={`text-xs ${isUsernameAvailable ? "text-[#E0FE10]" : "text-red-400"}`}>
                {isUsernameAvailable ? "username is available" : "username is not available"}
              </span>
            )}
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            className={`w-full bg-zinc-800 border rounded-lg p-3 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] transition-colors ${
              errors.username ? "border-red-500" : "border-zinc-600"
            }`}
            placeholder="Choose a username"
          />
        </div>
      </div>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          Create password
        </h2>
        <p className="text-zinc-400 font-['HK Grotesk'] text-sm">
          Set a password for your account
        </p>
      </div>

      <div className="space-y-6">
        {/* Password Input */}
        <div> {/* Changed: Outer div for label + input group */}
          <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
            Password
          </label>
          <div className="relative"> {/* Added: Relative container for input and button */}
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setShowError(false);
              }}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 pr-10 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] transition-colors"
              placeholder="Create password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5" // Removed top-7
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-zinc-400" />
              ) : (
                <Eye className="h-5 w-5 text-zinc-400" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm Password Input */}
        <div> {/* Changed: Outer div for label + input group */}
          <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
            Confirm Password
          </label>
          <div className="relative"> {/* Added: Relative container for input and button */}
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setShowError(false);
              }}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 pr-10 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] transition-colors"
              placeholder="Confirm password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5" // Removed top-7
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5 text-zinc-400" />
              ) : (
                <Eye className="h-5 w-5 text-zinc-400" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {/* Password requirement indicators... */}
          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                hasUppercase ? "bg-[#E0FE10]" : "bg-zinc-700"
              }`}
            >
              {hasUppercase && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${hasUppercase ? "text-[#E0FE10]" : "text-zinc-400"}`}>
              1 uppercase
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                hasNumber ? "bg-[#E0FE10]" : "bg-zinc-700"
              }`}
            >
              {hasNumber && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${hasNumber ? "text-[#E0FE10]" : "text-zinc-400"}`}>
              1 number
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                hasMinLength ? "bg-[#E0FE10]" : "bg-zinc-700"
              }`}
            >
              {hasMinLength && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${hasMinLength ? "text-[#E0FE10]" : "text-zinc-400"}`}>
              8 characters
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                passwordsMatch && password ? "bg-[#E0FE10]" : "bg-zinc-700"
              }`}
            >
              {passwordsMatch && password && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${passwordsMatch && password ? "text-[#E0FE10]" : "text-zinc-400"}`}>
              Passwords match
            </span>
          </div>
        </div>

        {/* Add a Back button */}
        <button
          type="button"
          onClick={() => setSignUpStep("initial")} // Go back to email entry
          className="w-full text-center text-zinc-400 text-sm hover:text-white transition-colors mt-4"
        >
          Back
        </button>
      </div>
    </>
  );

  const renderForgotPassword = () => (
    <>
      <div className="text-center mb-8 pt-4 sm:pt-0">
        <img src="/pulse-logo-white.svg" alt="Pulse Logo" className="h-8 mx-auto mb-8" />
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          {resetEmailSent ? "Check Your Email" : "Reset Your Password"}
        </h2>
        <p className="text-zinc-400 font-['HK Grotesk'] text-sm">
          {resetEmailSent 
            ? "We've sent password reset instructions to your email" 
            : "Enter your email address to receive reset instructions"}
        </p>
      </div>

      {!resetEmailSent ? (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setShowError(false);
              }}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] transition-colors"
              placeholder="Enter your email"
            />
          </div>
          
          <div className="flex flex-col gap-4 mt-8">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isLoading}
              className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#c8e60e] transition-colors font-['HK Grotesk'] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="loader border-t-transparent border-4 border-black rounded-full w-5 h-5 mx-auto animate-spin"></div>
              ) : (
                "Send Reset Instructions"
              )}
            </button>
            
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setResetEmailSent(false);
              }}
              className="text-zinc-400 text-sm hover:text-white transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-zinc-300 text-center">
            Please check your email and follow the instructions to reset your password.
          </p>
          
          <div className="flex flex-col gap-4 mt-8">
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setResetEmailSent(false);
              }}
              className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#c8e60e] transition-colors font-['HK Grotesk']"
            >
              Return to Sign In
            </button>
          </div>
        </div>
      )}
    </>
  );
  
  const renderInitialStep = () => (
    <>
      <div className="text-center mb-8 pt-4 sm:pt-0">
        <img src="/pulse-logo-white.svg" alt="Pulse Logo" className="h-8 mx-auto mb-8" />
        <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">
          {isSignUp ? "Join the Collective" : "Welcome Back!"}
        </h2>
        <p className="text-zinc-400 font-['HK Grotesk'] text-sm">
          Beat Your Best, Share Your Victory
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <button
          type="button"
          onClick={() => {
            setActiveProvider("apple"); // Track the active provider
            handleSocialAuth("apple"); // Trigger the social auth
          }}
          disabled={isLoading && activeProvider === "apple"} // Disable if loading with this provider
          className={`w-full bg-black text-white font-semibold py-3 px-4 rounded-lg transition-colors font-['HK Grotesk'] border border-zinc-700 flex items-center justify-center gap-3 ${
            isLoading && activeProvider === "apple" ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-800"
          }`}
        >
          {isLoading && activeProvider === "apple" ? (
            <div className="loader border-t-transparent border-4 border-white rounded-full w-5 h-5 animate-spin"></div>
          ) : (
            <>
              <img src="/apple-logo.svg" alt="Apple" className="w-5 h-5" />
              {isSignUp ? "Sign up with Apple" : "Sign in with Apple"}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSocialAuth("google")}
          disabled={isLoading}
          className={`w-full bg-white text-black font-semibold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors font-['HK Grotesk'] flex items-center justify-center gap-3 ${
            isLoading ? "cursor-not-allowed opacity-50" : ""
          }`}
        >
          {isLoading && activeProvider === "google" ? (
            <div className="loader border-t-transparent border-4 border-black rounded-full w-5 h-5 animate-spin"></div>
          ) : (
            <>
              <img src="/google-logo.svg" alt="Google" className="w-5 h-5" />
              {isSignUp ? "Sign up with Google" : "Sign in with Google"}
            </>
          )}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-700"></div>
          </div>
          {/* Uncomment below if you want a separator text */}
          {/* <div className="relative flex justify-center text-sm">
            <span className="px-4 text-zinc-400 bg-zinc-900">or continue with email</span>
          </div> */}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setShowError(false);
            }}
            className={`w-full bg-zinc-800 border rounded-lg p-3 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] transition-colors ${
              errors.email ? "border-red-500" : "border-zinc-600"
            }`}
            placeholder="Enter your email"
          />
          {showError && errors.email && (
            <div className="text-red-400 text-sm mt-2">{errors.email}</div>
          )}
        </div>

        {!isSignUp && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-zinc-300 font-['HK Grotesk']">
                Password
              </label>
              <button 
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-[#E0FE10] text-sm hover:underline"
              >
                Forgot your password?
              </button>
            </div>
            <div className="relative"> {/* Added: Relative container for input and button */}
              <input
                type={showPassword ? "text" : "password"} // Changed to use showPassword state
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setShowError(false);
                }}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 pr-10 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] transition-colors" // Added pr-10
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5" // Removed inline style
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-zinc-400" />
                ) : (
                  <Eye className="h-5 w-5 text-zinc-400" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const renderQuizNavigation = () => {
    if (signUpStep !== "quiz") return null;

    return (
      <div className="mt-8 flex gap-4">
        {quizStep > 0 && (
          <button
            type="button"
            onClick={() => setQuizStep(quizStep - 1)}
            className="flex-1 bg-zinc-800 text-white font-semibold py-3 px-4 rounded-lg hover:bg-zinc-700 transition-colors font-['HK Grotesk']"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (isLastQuizStep()) {
              handleCompleteQuiz();
            } else {
              setQuizStep(quizStep + 1);
            }
          }}
          disabled={!isCurrentStepValid()}
          className="flex-1 bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#c8e60e] transition-colors font-['HK Grotesk'] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLastQuizStep() ? "Complete quiz" : "Next"}
        </button>
      </div>
    );
  };

  // Validation for quiz steps
  const isCurrentStepValid = () => {
    switch (quizStep) {
      case 0:
        return !!quizData.gender;
      case 1:
        return (
          quizData.height.feet > 0 &&
          quizData.height.feet <= 8 &&
          quizData.height.inches >= 0 &&
          quizData.height.inches <= 11
        );
      case 2:
        return quizData.weight > 0;
      case 3:
        return !!quizData.level;
      case 4:
        return quizData.goal.length > 0;
      case 5:
        return !!quizData.birthdate;
      default:
        return false;
    }
  };

  const renderCurrentStep = () => {
    if (isForgotPassword) {
      return renderForgotPassword();
    }
    
    if (isSignUp) {
      switch (signUpStep) {
        case "password":
          return renderPasswordStep();
        case "profile":
          return renderProfileStep();
        case "quiz-prompt":
          return renderQuizPrompt();
        case "quiz":
          return renderQuizQuestion();
        case "subscription":
          return renderSubscriptionStep();
        default:
          return renderInitialStep();
      }
    }
    
    if (signUpStep === "subscription") {
      return renderSubscriptionStep();
    }
    
    return renderInitialStep();
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setSignUpStep("initial");
    setErrors({});
    setShowError(false);
    setPassword("");
    setConfirmPassword("");
    setUsername("");
    setProfileImage(null);
  };

  // Add debug logging for props
  useEffect(() => {
    console.log('[SignInModal] Props state:', {
      isVisible,
      closable,
      hasOnClose: !!onClose,
      timestamp: new Date().toISOString()
    });
  }, [isVisible, closable, onClose]);

  // Add debug logging for signup step changes
  useEffect(() => {
    console.log('[SignInModal] Sign-up step changed:', {
      signUpStep,
      isSignUp,
      timestamp: new Date().toISOString()
    });
  }, [signUpStep, isSignUp]);

  // Make sure the modal is actually visible
  if (!isVisible) {
    console.log('[SignInModal] Modal not visible, not rendering');
    return null;
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    console.log('[SignInModal] Forgot password request initiated for:', email);
    
    try {
      if (!email) {
        setError("Please enter your email address");
        setIsLoading(false);
        return;
      }
      
      await authService.resetPassword(email);
      setResetEmailSent(true);
      console.log('[SignInModal] Password reset email sent successfully to:', email);
    } catch (err) {
      console.error("[SignInModal] Error sending password reset email:", err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInSuccess = async (user: any) => {
    const queryRedirectUrl = router.query.redirect as string | undefined;

    try {
      const userDoc = await userService.fetchUserFromFirestore(user.uid);
      
      // Enhanced username check with more detailed logging
      if (!userDoc) {
        console.error('[SignInModal] handleSignInSuccess: User document not found in Firestore');
        setError('User profile could not be loaded. Please try again.');
        return;
      }
      
      // Explicit missing username check - prioritize this before subscription check
      if (!userDoc.username) {
        console.log('[SignInModal] handleSignInSuccess: User has no username. Forcing profile completion step.');
        setIsSignUp(true);
        setSignUpStep('profile');
        setIsLoading(false);
        // *** Important: Do NOT clear roundIdRedirect here so it can be used after profile completion ***
        return;
      }
      
      // *** Explicit Subscription Check ***
      // Skip subscription check if user is on a payment page (they're about to pay for a round)
      const isOnPaymentPage = router.pathname.startsWith('/payment/');
      
      if (userDoc.subscriptionType === SubscriptionType.unsubscribed && !isOnPaymentPage) {
        console.log('[SignInModal] handleSignInSuccess: User is unsubscribed. Redirecting to /subscribe.');
        // Preserve roundIdRedirect if it exists for post-subscription flow
        if (roundIdRedirect) {
             console.log(`[SignInModal] handleSignInSuccess: Unsubscribed user came from round invite (${roundIdRedirect}). Redirecting to subscribe, state preserved.`);
        }
        router.push('/subscribe');
        // Return EARLY to prevent other redirect/close logic
        return; 
      } else if (isOnPaymentPage) {
        console.log('[SignInModal] handleSignInSuccess: User is on payment page, skipping subscription check to allow payment.');
      }
      // *** End Explicit Subscription Check ***

      // ** Auto-join check (User is guaranteed to be subscribed AND have username here) ** 
      if (roundIdRedirect) {
          console.log(`[SignInModal] handleSignInSuccess: Attempting auto-join for round: ${roundIdRedirect}`);
          await autoJoinChallenge(roundIdRedirect); 
          dispatch(clearRoundIdRedirect()); 
          console.log('[SignInModal] Sign in success after auto-join. Closing modal.');
          onClose?.(); 
          return; // Return after handling
      } else if (loginRedirectPath) {
        // User accessed protected route directly (and is subscribed)
        console.log(`[SignInModal] Sign in success. Found loginRedirectPath. Closing modal. Path: ${loginRedirectPath}`);
        dispatch(clearLoginRedirectPath()); 
        onClose?.(); 
        return; // Return after handling
      } else if (queryRedirectUrl) { 
        // Legacy fallback (and is subscribed)
        console.log(`[SignInModal] Sign in success. Using query param redirect. Navigating to: ${queryRedirectUrl}`);
        router.push(queryRedirectUrl);
        // Return after handling (onClose might not be needed if navigating away)
        return; 
      } else {
        // Final fallback (and is subscribed)
        console.log('[SignInModal] Sign in success. No specific redirect. Closing modal.');
        onClose?.(); 
        // No return needed here as it's the end of the function's try block
      }
    } catch (err) {
      const error = err as Error;
      console.error("Error completing sign in:", error);
      setError(error.message);
       // Handle error state appropriately - maybe don't close modal automatically
    } finally {
      setIsLoading(false);
    }
  };

  // --- iPhone App Download Banner ---
  // This banner appears only if the user is on an iPhone
  const iphoneBanner = isIphone && (
    <div className="mb-4 p-3 bg-[#E0FE10] text-black rounded-lg flex items-center justify-between shadow font-semibold">
      <span>Get the best experience! Download the Pulse iPhone app.</span>
      <a
        href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-4 px-3 py-1 bg-black text-[#E0FE10] rounded hover:bg-zinc-800 transition-colors"
      >
        Download
      </a>
    </div>
  );

  // ** Debug Log (placed before return) **
  // if (isVisible) {
  //     console.log('[SignInModal] Temp Redirect State Check (Render):', {
  //       roundIdRedirect,
  //       loginRedirectPath,
  //       timestamp: new Date().toISOString()
  //     });
  // }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black z-50 sm:p-6">
      <div className="bg-zinc-900 w-full h-full sm:h-auto sm:w-[480px] sm:rounded-xl p-6 sm:p-8 border-none sm:border sm:border-zinc-700 shadow-xl overflow-y-auto">
        {window.location.hostname === 'localhost' && <DevModeToggle />}
        {/* iPhone App Download Banner */}
        {iphoneBanner}
        
        {closable && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500 text-white text-sm font-semibold p-3 rounded-lg">
              {error}
            </div>
          )}
          {renderCurrentStep()}

          {signUpStep !== "quiz-prompt" && signUpStep !== "quiz" && signUpStep !== "subscription" && !isForgotPassword && (
            <div className="flex flex-col gap-4 mt-8">
              <button
                type="submit"
                onClick={() => {
                  console.log('[SignInModal] Submit button clicked:', {
                    isSignUp,
                    signUpStep,
                    email,
                    hasPassword: !!password,
                    passwordLength: password ? password.length : 0,
                    timestamp: new Date().toISOString()
                  });
                }}
                className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#c8e60e] transition-colors font-['HK Grotesk']"
              >
                {isSignUp
                  ? signUpStep === "profile"
                    ? "Complete"
                    : signUpStep === "password"
                    ? "Continue"
                    : "Continue with Email"
                  : "Sign In"}
              </button>
            </div>
          )}
        </form>

        {renderQuizNavigation()}

        {signUpStep === "initial" && !isForgotPassword && (
          <>
            <div className="mt-6 text-center">
              <p className="text-zinc-500 text-sm font-['HK Grotesk']">
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <button onClick={toggleMode} className="text-[#E0FE10] hover:text-[#c8e60e]">
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-700">
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-zinc-400 text-sm mb-6">
                <a
                  href="/about"
                  className="hover:text-[#E0FE10] transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  About Pulse
                </a>
                <div className="hidden sm:block w-1 h-1 bg-zinc-700 rounded-full"></div>
                <a
                  href="/creator"
                  className="hover:text-[#E0FE10] transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Creator Program
                </a>
                <div className="hidden sm:block w-1 h-1 bg-zinc-700 rounded-full"></div>
                <a
                  href="/rounds"
                  className="hover:text-[#E0FE10] transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Rounds Feature
                </a>
              </div>

              <div className="flex flex-wrap justify-center items-center gap-4 text-zinc-500 text-xs mb-6">
                <a
                  href="/terms"
                  className="hover:text-[#E0FE10] transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms & Conditions
                </a>
                <div className="hidden sm:block w-1 h-1 bg-zinc-700 rounded-full"></div>
                <a
                  href="/privacyPolicy"
                  className="hover:text-[#E0FE10] transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                <div className="hidden sm:block w-1 h-1 bg-zinc-700 rounded-full"></div>
                <button
                  onClick={() => (window.location.href = "mailto:pulsefitnessapp@gmail.com")}
                  className="hover:text-[#E0FE10] transition-colors"
                >
                  Contact Us
                </button>
              </div>

              <div className="flex justify-center gap-6 mb-6">
                <a
                  href="https://www.instagram.com/fitwithpulse/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-[#E0FE10] transition-colors"
                >
                  <img src="/instagram.svg" alt="Instagram" className="w-5 h-5" />
                </a>
                <a
                  href="https://twitter.com/fitwithpulse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-[#E0FE10] transition-colors"
                >
                  <img src="/twitter.svg" alt="Twitter" className="w-5 h-5" />
                </a>
                <a
                  href="https://www.youtube.com/@fitwithpulse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-[#E0FE10] transition-colors"
                >
                  <img src="/youtube.svg" alt="Youtube" className="w-5 h-5" />
                </a>
              </div>

              <div className="text-center text-zinc-500 text-xs">
                © {new Date().getFullYear()} Pulse. All rights reserved.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SignInModal;

// Utility to check if onboarding is complete
function isOnboardingComplete(user: any): boolean { // Explicitly return boolean
  if (!user) return false; // Handle null user

  // Check each required field safely
  const hasUsername = !!user.username;
  // Safely check height: must exist AND have feet > 0
  const hasValidHeight = !!user.height && typeof user.height === 'object' && user.height.feet > 0;
  const hasBirthdate = !!user.birthdate;
  const hasGender = !!user.gender;
  const hasLevel = !!user.level;
  const hasGoals = Array.isArray(user.goal) && user.goal.length > 0;
  const isRegistrationMarkedComplete = !!user.registrationComplete;

  // TEMPORARY FIX: If user has username and email, consider them complete
  // This bypasses the quiz for existing users
  if (user.username && user.email) {
    console.log('[isOnboardingComplete] TEMP FIX: User has username and email, considering complete');
    return true;
  }

  return (
    hasUsername &&
    hasValidHeight &&
    hasBirthdate &&
    hasGender &&
    hasLevel &&
    hasGoals &&
    isRegistrationMarkedComplete
  );
}

