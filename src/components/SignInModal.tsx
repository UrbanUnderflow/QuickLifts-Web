import React, { useState, useEffect } from "react";
import { getRedirectResult, signInWithRedirect, OAuthProvider } from 'firebase/auth';
import { Camera, X } from 'lucide-react';
import { FitnessGoal, QuizData, SignUpStep } from "../types/AuthTypes";
import authService from '../api/firebase/auth';
import { userService } from '../api/firebase/user';
import { User } from '../types/User';
import { auth } from '../api/firebase/config';
import Link from 'next/link';


// type SignUpStep = 'initial' | 'password' | 'profile';
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
}

const SignInModal: React.FC<SignInModalProps> = ({ 
    isVisible, 
    closable = false, // Default to true
    onClose,
    onSignInSuccess,
    onSignInError,
    onSignUpSuccess,
    onSignUpError,
    onQuizComplete,
    onQuizSkipped,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpStep, setSignUpStep] = useState<SignUpStep>('initial');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    username?: string;
  }>({});
  const [showError, setShowError] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null); 

  // Password validation states
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasMinLength = password.length >= 8;
  const passwordsMatch = password === confirmPassword;

  // Add to component state
  const [quizStep, setQuizStep] = useState<number>(0);
  const [quizData, setQuizData] = useState<QuizData>({
    gender: null,
    height: { feet: 0, inches: 0 },
    weight: 0,
    gymExperience: null,
    fitnessGoals: [],
    birthdate: null
    });

  if (!isVisible) return null;

  useEffect(() => {
    const handleRedirect = async () => {
        console.log('Starting redirect handler...'); // Debug log 1

        try {
            const result = await getRedirectResult(auth);
            console.log('Redirect result:', result); // Debug log 2

            if (result) {
                console.log('Got successful result, fetching user...'); // Debug log 3
                
                try {
                    const firestoreUser = await userService.fetchUserFromFirestore(result.user.uid);
                    console.log('Fetched firestore user:', firestoreUser); // Debug log 4

                    userService.currentUser = firestoreUser;

                    const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
                    console.log('Is new user?', isNewUser); // Debug log 5

                    if (isNewUser) {
                        console.log('Creating new user...'); // Debug log 6
                        const newUser = new User({
                            // ... user creation code ...
                        });

                        await userService.updateUser(result.user.uid, newUser);
                        userService.currentUser = newUser;
                        console.log('New user created and saved:', newUser); // Debug log 7
                        onSignUpSuccess?.(result.user);
                    } else {
                        console.log('Existing user, triggering sign in success'); // Debug log 8
                        onSignInSuccess?.(result.user);
                    }

                    console.log('Attempting to close modal...'); // Debug log 9
                    onClose?.();
                } catch (firestoreError) {
                    console.error('Error with Firestore operations:', firestoreError); // Debug log 10
                    throw firestoreError;
                }
            } else {
                console.log('No redirect result - probably first render'); // Debug log 11
            }
        } catch (error) {
            console.error('Main error in redirect handler:', error); // Debug log 12
            setError(error instanceof Error ? error.message : 'Unknown error');
            if (isSignUp) {
                onSignUpError?.(error as Error);
            } else {
                onSignInError?.(error as Error);
            }
        } finally {
            console.log('Finishing redirect handler, setting loading false'); // Debug log 13
            setIsLoading(false);
        }
    };

    console.log('Effect running, isVisible:', isVisible); // Debug log 14
    if (isVisible) {
        handleRedirect();
    }
}, [isSignUp, onSignInSuccess, onSignUpSuccess, onSignInError, onSignUpError, onClose, isVisible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (isSignUp) {
      switch (signUpStep) {
        case 'initial':
          if (validateEmail()) {
            setSignUpStep('password');
            setShowError(false);
          }
          break;
        case 'password':
          if (validatePassword()) {
            setSignUpStep('profile');
            setShowError(false);
          }
          break;
        case 'profile':
          if (validateUsername()) {
            try {
              setIsLoading(true);
              setError(null);
  
              const result = await authService.signUpWithEmail({
                email,
                password,
                username,
              });
  
              // Create the user object
              const newUser = new User({
                id: result.user.uid,
                displayName: '', // Default, can be updated in profile step
                email,
                username,
                bio: '', // Default
                profileImage: {
                  profileImageURL: '',
                  imageOffsetWidth: 0,
                  imageOffsetHeight: 0,
                },
                followerCount: 0,
                followingCount: 0,
                bodyWeight: [],
                workoutCount: 0,
                creator: {
                  type: [],
                  instagramHandle: '',
                  twitterHandle: '',
                  youtubeUrl: '',
                  acceptCodeOfConduct: false,
                  acceptExecutiveTerms: false,
                  acceptGeneralTerms: false,
                  acceptSweatEquityPartnership: false,
                  onboardingStatus: '',
                  onboardingLink: '',
                  onboardingExpirationDate: 0,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              });
  
              // Save the user globally
              userService.currentUser = newUser;
  
              console.log('Sign-up successful:', newUser);
  
              setSignUpStep('quiz-prompt');
            } catch (err) {
              const error = err as Error;
              console.error('Error during sign-up:', error);
              setError(error.message);
            } finally {
              setIsLoading(false);
            }
          }
          break;
      }
    } else {
      // Handle sign in
      try {
        setIsLoading(true);
        setError(null);
    
        const result = await authService.signInWithEmail(email, password);
    
        console.log('Sign-in successful:', result.user);
    
        // Fetch user data and save globally
        const userDoc = await userService.fetchUserFromFirestore(result.user.uid);
        userService.currentUser = userDoc;
    
        onSignInSuccess?.(result.user);
        // Add this line to close the modal
        onClose?.();  // Add this line
      } catch (err) {
        const error = err as Error;
        console.error('Error during sign-in:', error);
        setError(error.message);
        onSignInError?.(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCompleteQuiz = async () => {
    try {
      setIsLoading(true);
      setError(null);
  
      // Get the user's ID from the Firebase authentication state
      const userId = auth.currentUser?.uid;
  
      if (!userId) {
        throw new Error('No user found');
      }
  
      // Construct the user object with default or empty values
      const user = new User({
        id: userId,
        displayName: '', // Default value, can be updated later
        email: email,
        username: username,
        bio: '', // Default value
        profileImage: { profileImageURL: '', imageOffsetWidth: 0, imageOffsetHeight: 0 }, // Empty profile image
        followerCount: 0,
        followingCount: 0,
        bodyWeight: [], // No body weight records yet
        workoutCount: 0,
        creator: {
          type: [],
          instagramHandle: '',
          twitterHandle: '',
          youtubeUrl: '',
          acceptCodeOfConduct: false,
          acceptExecutiveTerms: false,
          acceptGeneralTerms: false,
          acceptSweatEquityPartnership: false,
          onboardingStatus: '',
          onboardingLink: '',
          onboardingExpirationDate: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
  
      // Use the userMethods.updateUser function to update the user document
      await userService.updateUser(userId, user);
  
      console.log('User document updated successfully');
      onQuizComplete?.(); // Notify the parent component that the quiz is complete
    } catch (err) {
      const error = err as Error;
      console.error('Error updating user data:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    try {
        setIsLoading(true);
        setError(null);
        setActiveProvider(provider);

        if (provider === 'apple') {
            const appleProvider = new OAuthProvider('apple.com');
            appleProvider.addScope('email');
            appleProvider.addScope('name');
            
            // Just start the redirect - the useEffect handler will handle the result
            await signInWithRedirect(auth, appleProvider);
        } else {
            // Keep existing Google sign-in logic
            const result = await authService.signInWithGoogle();
            const firestoreUser = await userService.fetchUserFromFirestore(result.user.uid);
            userService.currentUser = firestoreUser;

            if (isSignUp) {
                onSignUpSuccess?.(result.user);
            } else {
                onSignInSuccess?.(result.user);
            }
        }
    } catch (err) {
        const error = err as Error;
        setError(error.message);
        if (isSignUp) {
            onSignUpError?.(error);
        } else {
            onSignInError?.(error);
        }
    } finally {
        setIsLoading(false);
    }
};

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
          onClick={() => setSignUpStep('quiz')}
          className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg 
            hover:bg-[#c8e60e] transition-colors font-['HK Grotesk']"
        >
          Take the Quiz
        </button>
        <button
          onClick={() => onQuizSkipped?.()}
          className="w-full bg-zinc-800 text-white font-semibold py-3 px-4 rounded-lg 
            hover:bg-zinc-700 transition-colors font-['HK Grotesk']"
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
        {['Man', 'Woman', 'I\'d rather self describe'].map((option) => (
          <button
            key={option}
            onClick={() => {
              setQuizData({...quizData, gender: option as any});
              setQuizStep(quizStep + 1);
            }}
            className={`w-full p-4 rounded-lg border ${
              quizData.gender === option
                ? 'border-[#E0FE10] bg-[#E0FE10]/10'
                : 'border-zinc-700 hover:border-[#E0FE10]'
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
          value={quizData.height.feet || ''}
          onChange={(e) => setQuizData({
            ...quizData,
            height: {
              ...quizData.height,
              feet: Number(e.target.value)
            }
          })}
          min="0"
          max="8"
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white 
            placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 
            focus:ring-[#E0FE10] transition-colors"
          placeholder="0"
        />
      </div>

      <div className="flex-1">
        <label className="block text-sm text-zinc-400 mb-2">Inches</label>
        <input
          type="number"
          value={quizData.height.inches || ''}
          onChange={(e) => setQuizData({
            ...quizData,
            height: {
              ...quizData.height,
              inches: Number(e.target.value)
            }
          })}
          min="0"
          max="11"
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white 
            placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 
            focus:ring-[#E0FE10] transition-colors"
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
          value={quizData.weight || ''}
          onChange={(e) => setQuizData({...quizData, weight: Number(e.target.value)})}
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
        {['Novice', 'Intermediate', 'Expert'].map((level) => (
          <button
            key={level}
            onClick={() => {
              setQuizData({...quizData, gymExperience: level as any});
              setQuizStep(quizStep + 1);
            }}
            className={`w-full p-4 rounded-lg border ${
              quizData.gymExperience === level
                ? 'border-[#E0FE10] bg-[#E0FE10]/10'
                : 'border-zinc-700 hover:border-[#E0FE10]'
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
      {(['Lose weight', 'Gain muscle mass', 'Tone up', 'General Fitness'] as FitnessGoal[]).map((goal) => (
        <button
          type="button"
          key={goal}
          onClick={() => {
            setQuizData((prev: QuizData) => ({
              ...prev,
              fitnessGoals: prev.fitnessGoals.includes(goal)
                ? prev.fitnessGoals.filter(g => g !== goal)
                : [...prev.fitnessGoals, goal]
            }));
          }}
          className={`w-full p-4 rounded-lg border ${
            quizData.fitnessGoals.includes(goal)
              ? 'border-[#E0FE10] bg-[#E0FE10]/10'
              : 'border-zinc-700 hover:border-[#E0FE10]'
          } text-left text-white transition-colors relative`}
        >
          <span>{goal}</span>
          {quizData.fitnessGoals.includes(goal) && (
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
          onChange={(e) => {
            const date = new Date(quizData.birthdate || new Date());
            date.setMonth(parseInt(e.target.value));
            setQuizData({...quizData, birthdate: date});
          }}
        >
          {Array.from({length: 12}, (_, i) => (
            <option key={i} value={i}>
              {new Date(0, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        
        <select
          className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white"
          onChange={(e) => {
            const date = new Date(quizData.birthdate || new Date());
            date.setDate(parseInt(e.target.value));
            setQuizData({...quizData, birthdate: date});
          }}
        >
          {Array.from({length: 31}, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        
        <select
          className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white"
          onChange={(e) => {
            const date = new Date(quizData.birthdate || new Date());
            date.setFullYear(parseInt(e.target.value));
            setQuizData({...quizData, birthdate: date});
          }}
        >
          {Array.from({length: 100}, (_, i) => {
            const year = new Date().getFullYear() - i;
            return <option key={year} value={year}>{year}</option>;
          })}
        </select>
      </div>
    </div>
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setProfileImage(e.target.files[0]);
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
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Username Input */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
              Username
            </label>
            {username && (
              <span className={`text-xs ${isUsernameAvailable ? 'text-[#E0FE10]' : 'text-red-400'}`}>
                {isUsernameAvailable ? 'username is available' : 'username is not available'}
              </span>
            )}
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            className={`w-full bg-zinc-800 border rounded-lg p-3 text-white 
              placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 
              focus:ring-[#E0FE10] transition-colors ${
                errors.username ? 'border-red-500' : 'border-zinc-600'
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
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setShowError(false);
            }}
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white 
              placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 
              focus:ring-[#E0FE10] transition-colors"
            placeholder="Create password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setShowError(false);
            }}
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white 
              placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 
              focus:ring-[#E0FE10] transition-colors"
            placeholder="Confirm password"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center
              ${hasUppercase ? 'bg-[#E0FE10]' : 'bg-zinc-700'}`}>
              {hasUppercase && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${hasUppercase ? 'text-[#E0FE10]' : 'text-zinc-400'}`}>
              1 uppercase
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center
              ${hasNumber ? 'bg-[#E0FE10]' : 'bg-zinc-700'}`}>
              {hasNumber && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${hasNumber ? 'text-[#E0FE10]' : 'text-zinc-400'}`}>
              1 number
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center
              ${hasMinLength ? 'bg-[#E0FE10]' : 'bg-zinc-700'}`}>
              {hasMinLength && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${hasMinLength ? 'text-[#E0FE10]' : 'text-zinc-400'}`}>
              8 characters
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center
              ${passwordsMatch && password ? 'bg-[#E0FE10]' : 'bg-zinc-700'}`}>
              {passwordsMatch && password && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm ${passwordsMatch && password ? 'text-[#E0FE10]' : 'text-zinc-400'}`}>
              Passwords match
            </span>
          </div>
        </div>
      </div>
    </>
  );

  const renderInitialStep = () => (
    <>
      <div className="text-center mb-8 pt-4 sm:pt-0">
        <img 
          src="/pulse-logo-white.svg" 
          alt="Pulse Logo" 
          className="h-8 mx-auto mb-8"
        />
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
                setActiveProvider('apple'); // Track the active provider
                handleSocialAuth('apple'); // Trigger the social auth
            }}
            disabled={isLoading && activeProvider === 'apple'} // Disable if loading with this provider
            className={`w-full bg-black text-white font-semibold py-3 px-4 rounded-lg 
                transition-colors font-['HK Grotesk'] border border-zinc-700 
                flex items-center justify-center gap-3 ${
                isLoading && activeProvider === 'apple' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800'
                }`}
            >
            {isLoading && activeProvider === 'apple' ? (
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
            onClick={() => handleSocialAuth('google')}
            disabled={isLoading}
            className={`w-full bg-white text-black font-semibold py-3 px-4 rounded-lg 
                hover:bg-gray-100 transition-colors font-['HK Grotesk'] flex items-center justify-center gap-3 ${
                isLoading ? 'cursor-not-allowed opacity-50' : ''
                }`}
            >
            {isLoading && activeProvider === 'google' ? (
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
            className={`w-full bg-zinc-800 border rounded-lg p-3 text-white 
              placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 
              focus:ring-[#E0FE10] transition-colors ${
                errors.email ? 'border-red-500' : 'border-zinc-600'
              }`}
            placeholder="Enter your email"
          />
          {showError && errors.email && (
            <div className="text-red-400 text-sm mt-2">
              {errors.email}
            </div>
          )}
        </div>

        {!isSignUp && (
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setShowError(false);
              }}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white 
                placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 
                focus:ring-[#E0FE10] transition-colors"
              placeholder="Enter your password"
            />
          </div>
        )}
      </div>
    </>
  );

  const renderQuizNavigation = () => {
    if (signUpStep !== 'quiz') return null;
  
    return (
      <div className="mt-8 flex gap-4">
        {quizStep > 0 && (
          <button
            type="button"
            onClick={() => setQuizStep(quizStep - 1)}
            className="flex-1 bg-zinc-800 text-white font-semibold py-3 px-4 rounded-lg 
              hover:bg-zinc-700 transition-colors font-['HK Grotesk']"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (isLastQuizStep()) {
              // Handle quiz completion
              handleCompleteQuiz();
            } else {
              setQuizStep(quizStep + 1);
            }
          }}
          disabled={!isCurrentStepValid()}
          className="flex-1 bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg 
            hover:bg-[#c8e60e] transition-colors font-['HK Grotesk']
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLastQuizStep() ? "Complete quiz" : "Next"}
        </button>
      </div>
    );
  };

  // Add validation function for each step
    const isCurrentStepValid = () => {
        switch (quizStep) {
        case 0: // Gender
            return !!quizData.gender;
        case 1: // Height
            return quizData.height.feet > 0 && 
                quizData.height.feet <= 8 && 
                quizData.height.inches >= 0 && 
                quizData.height.inches <= 11;
        case 2: // Weight
            return quizData.weight > 0;
        case 3: // Gym Experience
            return !!quizData.gymExperience;
        case 4: // Fitness Goals
            return quizData.fitnessGoals.length > 0;
        case 5: // Birthdate
            return !!quizData.birthdate;
        default:
            return false;
        }
    };

  const renderCurrentStep = () => {
    if (isSignUp) {
      switch (signUpStep) {
        case 'password':
          return renderPasswordStep();
        case 'profile':
          return renderProfileStep();
        case 'quiz-prompt':
          return renderQuizPrompt();
        case 'quiz':
          return renderQuizQuestion();
        default:
          return renderInitialStep();
      }
    }
    return renderInitialStep();
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setSignUpStep('initial');
    setErrors({});
    setShowError(false);
    setPassword("");
    setConfirmPassword("");
    setUsername("");
    setProfileImage(null);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50 sm:p-6">
      <div className="bg-zinc-900 w-full h-full sm:h-auto sm:w-[480px] sm:rounded-xl p-6 sm:p-8 
        border-none sm:border sm:border-zinc-700 shadow-xl overflow-y-auto">
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
           {/* Display error */}
           {error && (
            <div className="bg-red-500 text-white text-sm font-semibold p-3 rounded-lg">
            {error}
            </div>
           )}

          {/* Display current step */}
          {renderCurrentStep()}
  
          {/* Only show the main form button if we're not in quiz mode */}
          {signUpStep !== 'quiz-prompt' && signUpStep !== 'quiz' && (
            <div className="flex flex-col gap-4 mt-8">
              <button
                type="submit"
                className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg 
                  hover:bg-[#c8e60e] transition-colors font-['HK Grotesk']"
              >
                {isSignUp 
                  ? (signUpStep === 'profile' 
                    ? "Complete" 
                    : signUpStep === 'password' 
                      ? "Continue" 
                      : "Continue with Email") 
                  : "Sign In"}
              </button>
            </div>
          )}
        </form>
  
        {/* Quiz navigation button */}
        {renderQuizNavigation()}
  
        {/* Footer content - only show on initial steps */}
        {signUpStep === 'initial' && (
          <>
            <div className="mt-6 text-center">
              {!isSignUp && (
                <a href="#" className="text-zinc-400 hover:text-[#E0FE10] text-sm transition-colors mb-2 block">
                  Forgot your password?
                </a>
              )}
              <p className="text-zinc-500 text-sm font-['HK Grotesk']">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button 
                onClick={toggleMode} 
                className="text-[#E0FE10] hover:text-[#c8e60e]"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
            </div>
  
            <div className="mt-8 pt-6 border-t border-zinc-700">
              <p className="text-zinc-400 text-xs text-center font-['HK Grotesk'] px-4">
                Join the Fitness Collective: Create, Share, and Progress Together
              </p>
<>
              {/* New Footer Section */}
    <div className="mt-8 pt-6 border-t border-zinc-700">

      {/* Links Section */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-zinc-400 text-sm mb-6">
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
      <div className="flex flex-wrap justify-center items-center gap-4 text-zinc-500 text-xs mb-6">
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
          onClick={() => window.location.href = 'mailto:pulsefitnessapp@gmail.com'}
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

      {/* Copyright */}
      <div className="text-center text-zinc-500 text-xs">
        © {new Date().getFullYear()} Pulse. All rights reserved.
      </div>
    </div>
  </>

            </div>

            
          </>
        )}
      </div>
    </div>
  );
};

export default SignInModal;