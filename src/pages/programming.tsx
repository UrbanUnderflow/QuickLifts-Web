import React, { useState, useEffect, useRef, useCallback } from 'react';
// createPortal removed - not used
import { useRouter } from 'next/router';
import type { GetServerSideProps, NextPage } from 'next'; // Added GetServerSideProps, NextPage
import { 
    Users,
    Lock,
    Dumbbell,
    Brain,
    UserCircle,
    Sparkles,
    X,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Zap,
    Layout,
    Lightbulb,
    Video,
    Check,
    Send,
    Loader2,
    Code,
    Shuffle,
    Calendar,
    Sliders,
    Clock,
    Share2,
    ArrowRight,
    Edit3,
    MessageSquare,
    Plus,
    History,
    Settings,
    Home,
    Trophy,
    Target,
} from 'lucide-react';
import { Switch } from '@headlessui/react';
import { useScrollFade } from '../hooks/useScrollFade';

import { userService, User } from '../api/firebase/user';
import { workoutService } from '../api/firebase/workout/service';
import { exerciseService } from '../api/firebase/exercise/service';
import { Exercise, ExerciseDetail, ExerciseCategory, ExerciseVideo, ExerciseReference, WeightTrainingExercise, CardioExercise } from '../api/firebase/exercise/types';
import { Workout, SweatlistCollection, Challenge, ChallengeStatus, SweatlistIdentifiers, WorkoutStatus, WorkoutSummary, BodyZone } from '../api/firebase/workout/types';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../api/firebase/config';
import { StackCard } from '../components/Rounds/StackCard'
import { ExerciseGrid } from '../components/App/ExerciseGrid/ExerciseGrid';
import { MultiUserSelector } from '../components/App/MultiSelectUser/MultiSelectUser';
import { generateId } from '../utils/generateId';
import { convertFirestoreTimestamp } from '../utils/formatDate';
import { useUser } from '../hooks/useUser';
import PageHead from '../components/PageHead'; // Added PageHead import
import { adminMethods } from '../api/firebase/admin/methods'; // Added adminMethods
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types'; // Added PageMetaData
import { 
  programmingConversationService, 
  ProgrammingConversation, 
  ProgrammingChatMessage 
} from '../api/firebase/programming';

// Using convertFirestoreTimestamp from utils/formatDate.ts for consistent date handling

// Helper function to safely format dates for input fields
const formatDateForInput = (date: Date | null | undefined): string => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
};

// Define a serializable version of PageMetaData for this page's props
interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

// UserDataCard model for AI context when users are tagged
interface UserDataCard {
  // Basic Information
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  
  // Demographics (optional but helpful for AI)
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  
  // Fitness Profile
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  experienceYears?: number;
  
  // Goals & Preferences
  primaryGoals: ('strength' | 'hypertrophy' | 'endurance' | 'weight-loss' | 'athletic-performance' | 'general-fitness')[];
  preferredWorkoutTypes: ('weight-training' | 'cardio' | 'yoga' | 'pilates' | 'functional' | 'sports-specific')[];
  preferredIntensity: 'low' | 'moderate' | 'high' | 'varied';
  
  // Physical Considerations
  injuries?: string[]; // List of current or past injuries
  limitations?: string[]; // Physical limitations or restrictions
  healthConditions?: string[]; // Relevant health conditions
  
  // Training Logistics
  availableEquipment: ('full-gym' | 'home-gym' | 'minimal-equipment' | 'bodyweight-only')[];
  preferredDuration: number; // Preferred workout duration in minutes
  trainingFrequency: number; // Days per week they prefer to train
  availableDays: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  timeOfDay: ('early-morning' | 'morning' | 'afternoon' | 'evening' | 'flexible')[];
  
  // Historical Data
  favoriteExercises?: string[]; // Exercise names they enjoy
  dislikedExercises?: string[]; // Exercises to avoid
  pastChallengesCompleted: number;
  averageWorkoutCompletionRate?: number; // Percentage of workouts they typically complete
  
  // Body Composition (optional, if user chooses to share)
  height?: number; // in cm
  weight?: number; // in kg
  bodyFatPercentage?: number;
  
  // Motivation & Behavioral
  motivationStyle: ('competitive' | 'collaborative' | 'independent' | 'coach-guided')[];
  preferredFeedback: ('detailed' | 'minimal' | 'encouraging' | 'technical')[];
  
  // Recent Activity Context
  recentWorkoutTypes?: string[]; // What they've been doing lately
  lastActiveDate?: Date;
  currentChallengeParticipation?: string[]; // Challenge IDs they're currently in
  
  // ENHANCED: Actual Performance Data
  workoutHistory?: {
    recentWorkouts: number; // Count of workouts in last 30 days
    totalWorkouts: number; // Total completed workouts
    lastWorkoutDate?: Date;
    averageWorkoutDuration?: number; // in minutes
  };
  
  strengthMetrics?: {
    pullStrength?: { exercise: string; weight: number; reps: number; date: Date }; // Best recent pull movement (pullups, rows, etc.)
    pushStrength?: { exercise: string; weight: number; reps: number; date: Date }; // Best recent push movement (bench, pushups, etc.)
    squatStrength?: { exercise: string; weight: number; reps: number; date: Date }; // Best recent squat movement
    deadliftStrength?: { exercise: string; weight: number; reps: number; date: Date }; // Best recent deadlift
    totalVolumeRecent?: number; // Total weight lifted in last 30 days
  };
  
  personalRecords?: { 
    exercise: string; 
    weight: number; 
    reps: number; 
    date: Date; 
  }[]; // Top 5 recent PRs
  
  progressionTrends?: {
    strengthTrend: 'improving' | 'maintaining' | 'declining' | 'unknown';
    volumeTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
    consistencyRating: number; // 0-100 based on workout frequency
  };
  
  // Raw User Input (preserved for AI context)
  additionalGoalsText?: string; // Full text from user's additional goals
  bioText?: string; // Full bio text from user
  
  // Created/Updated tracking
  createdAt: Date;
  updatedAt: Date;
}

class UserDataCard {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  experienceYears?: number;
  primaryGoals: ('strength' | 'hypertrophy' | 'endurance' | 'weight-loss' | 'athletic-performance' | 'general-fitness')[];
  preferredWorkoutTypes: ('weight-training' | 'cardio' | 'yoga' | 'pilates' | 'functional' | 'sports-specific')[];
  preferredIntensity: 'low' | 'moderate' | 'high' | 'varied';
  injuries?: string[];
  limitations?: string[];
  healthConditions?: string[];
  availableEquipment: ('full-gym' | 'home-gym' | 'minimal-equipment' | 'bodyweight-only')[];
  preferredDuration: number;
  trainingFrequency: number;
  availableDays: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  timeOfDay: ('early-morning' | 'morning' | 'afternoon' | 'evening' | 'flexible')[];
  favoriteExercises?: string[];
  dislikedExercises?: string[];
  pastChallengesCompleted: number;
  averageWorkoutCompletionRate?: number;
  height?: number;
  weight?: number;
  bodyFatPercentage?: number;
  motivationStyle: ('competitive' | 'collaborative' | 'independent' | 'coach-guided')[];
  preferredFeedback: ('detailed' | 'minimal' | 'encouraging' | 'technical')[];
  recentWorkoutTypes?: string[];
  lastActiveDate?: Date;
  currentChallengeParticipation?: string[];
  workoutHistory?: {
    recentWorkouts: number;
    totalWorkouts: number;
    lastWorkoutDate?: Date;
    averageWorkoutDuration?: number;
  };
  strengthMetrics?: {
    pullStrength?: { exercise: string; weight: number; reps: number; date: Date };
    pushStrength?: { exercise: string; weight: number; reps: number; date: Date };
    squatStrength?: { exercise: string; weight: number; reps: number; date: Date };
    deadliftStrength?: { exercise: string; weight: number; reps: number; date: Date };
    totalVolumeRecent?: number;
  };
  personalRecords?: { 
    exercise: string; 
    weight: number; 
    reps: number; 
    date: Date; 
  }[];
  progressionTrends?: {
    strengthTrend: 'improving' | 'maintaining' | 'declining' | 'unknown';
    volumeTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
    consistencyRating: number;
  };
  additionalGoalsText?: string;
  bioText?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.email = data.email || '';
    this.profileImage = data.profileImage;
    this.age = data.age;
    this.gender = data.gender;
    this.fitnessLevel = data.fitnessLevel || 'beginner';
    this.experienceYears = data.experienceYears;
    this.primaryGoals = data.primaryGoals || [];
    this.preferredWorkoutTypes = data.preferredWorkoutTypes || [];
    this.preferredIntensity = data.preferredIntensity || 'moderate';
    this.injuries = data.injuries || [];
    this.limitations = data.limitations || [];
    this.healthConditions = data.healthConditions || [];
    this.availableEquipment = data.availableEquipment || ['bodyweight-only'];
    this.preferredDuration = data.preferredDuration || 30;
    this.trainingFrequency = data.trainingFrequency || 3;
    this.availableDays = data.availableDays || [];
    this.timeOfDay = data.timeOfDay || ['flexible'];
    this.favoriteExercises = data.favoriteExercises || [];
    this.dislikedExercises = data.dislikedExercises || [];
    this.pastChallengesCompleted = data.pastChallengesCompleted || 0;
    this.averageWorkoutCompletionRate = data.averageWorkoutCompletionRate;
    this.height = data.height;
    this.weight = data.weight;
    this.bodyFatPercentage = data.bodyFatPercentage;
    this.motivationStyle = data.motivationStyle || ['independent'];
    this.preferredFeedback = data.preferredFeedback || ['encouraging'];
    this.recentWorkoutTypes = data.recentWorkoutTypes || [];
    this.lastActiveDate = data.lastActiveDate ? new Date(data.lastActiveDate) : undefined;
    this.currentChallengeParticipation = data.currentChallengeParticipation || [];
    this.workoutHistory = data.workoutHistory;
    this.strengthMetrics = data.strengthMetrics;
    this.personalRecords = data.personalRecords;
    this.progressionTrends = data.progressionTrends;
    this.additionalGoalsText = data.additionalGoalsText;
    this.bioText = data.bioText;
    this.createdAt = new Date(data.createdAt || new Date());
    this.updatedAt = new Date(data.updatedAt || new Date());
  }

  // Convert to a format suitable for AI context
  toAIContext(): string {
    const goals = this.primaryGoals.join(', ');
    const workoutTypes = this.preferredWorkoutTypes.join(', ');
    const equipment = this.availableEquipment.join(', ');
    const injuries = this.injuries?.length ? this.injuries.join(', ') : 'None reported';
    const limitations = this.limitations?.length ? this.limitations.join(', ') : 'None reported';
    
    let context = `
      User: ${this.name}
      Fitness Level: ${this.fitnessLevel}${this.experienceYears ? ` (${this.experienceYears} years experience)` : ''}
      Primary Goals: ${goals}
      Preferred Workout Types: ${workoutTypes}
      Available Equipment: ${equipment}
      Training Frequency: ${this.trainingFrequency} days/week
      Preferred Duration: ${this.preferredDuration} minutes
      Injuries/Limitations: ${injuries}${this.limitations?.length ? `, ${limitations}` : ''}
      Preferred Intensity: ${this.preferredIntensity}
      Motivation Style: ${this.motivationStyle.join(', ')}
      Challenges Completed: ${this.pastChallengesCompleted}`;

    // Add workout history if available
    if (this.workoutHistory) {
      context += `
      Recent Activity: ${this.workoutHistory.recentWorkouts} workouts in last 30 days (Total: ${this.workoutHistory.totalWorkouts})`;
      if (this.workoutHistory.lastWorkoutDate) {
        const daysSince = Math.floor((Date.now() - this.workoutHistory.lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24));
        context += `, Last workout: ${daysSince} days ago`;
      }
      if (this.workoutHistory.averageWorkoutDuration) {
        context += `, Avg duration: ${this.workoutHistory.averageWorkoutDuration} min`;
      }
    }

    // Add strength metrics if available - THIS IS KEY FOR PULL STRENGTH CONTEXT
    if (this.strengthMetrics) {
      context += `
      Current Strength Levels:`;
      if (this.strengthMetrics.pullStrength) {
        const pull = this.strengthMetrics.pullStrength;
        context += ` Pull Strength: ${pull.exercise} ${pull.weight}lbs x ${pull.reps} reps`;
      }
      if (this.strengthMetrics.pushStrength) {
        const push = this.strengthMetrics.pushStrength;
        context += ` | Push Strength: ${push.exercise} ${push.weight}lbs x ${push.reps} reps`;
      }
      if (this.strengthMetrics.squatStrength) {
        const squat = this.strengthMetrics.squatStrength;
        context += ` | Squat: ${squat.exercise} ${squat.weight}lbs x ${squat.reps} reps`;
      }
      if (this.strengthMetrics.deadliftStrength) {
        const dl = this.strengthMetrics.deadliftStrength;
        context += ` | Deadlift: ${dl.exercise} ${dl.weight}lbs x ${dl.reps} reps`;
      }
      if (this.strengthMetrics.totalVolumeRecent) {
        context += ` | Recent Volume: ${Math.round(this.strengthMetrics.totalVolumeRecent).toLocaleString()}lbs total`;
      }
    }

    // Add personal records if available
    if (this.personalRecords?.length) {
      context += `
      Recent Personal Records: ${this.personalRecords.slice(0, 3).map(pr => 
        `${pr.exercise} ${pr.weight}lbs x ${pr.reps} reps`
      ).join(', ')}`;
    }

    // Add progression trends if available
    if (this.progressionTrends) {
      context += `
      Progress Trends: Strength ${this.progressionTrends.strengthTrend}, Volume ${this.progressionTrends.volumeTrend}, Consistency ${this.progressionTrends.consistencyRating}%`;
    }

    // Add existing optional fields
    if (this.favoriteExercises?.length) {
      context += `
      Favorite Exercises: ${this.favoriteExercises.join(', ')}`;
    }
    if (this.dislikedExercises?.length) {
      context += `
      Exercises to Avoid: ${this.dislikedExercises.join(', ')}`;
    }
    if (this.bioText) {
      context += `
      User Bio: ${this.bioText}`;
    }
    if (this.additionalGoalsText) {
      context += `
      Additional Goals/Notes: ${this.additionalGoalsText}`;
    }
    
    return context.trim();
  }

  // Get a summary for display in chat
  getChatDisplaySummary(): string {
    const level = this.fitnessLevel.charAt(0).toUpperCase() + this.fitnessLevel.slice(1);
    const goals = this.primaryGoals.slice(0, 2).join(' & '); // Show max 2 goals
    return `${level} • ${goals} • ${this.trainingFrequency}x/week`;
  }
}

// Landing Page Components
const LandingPage = ({ hasAccess, setShowEarlyAccessForm, onGetStarted }: { hasAccess: boolean, setShowEarlyAccessForm: (show: boolean) => void, onGetStarted?: () => void }) => {
  const currentUser = useUser();
  const [_isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [userHasAccess, setUserHasAccess] = useState(false);

  useEffect(() => {
    const checkUserAccess = async () => {
      if (currentUser?.email) {
        try {
          const accessData = await adminMethods.checkProgrammingAccess(currentUser.email);
          setUserHasAccess(!!accessData && accessData.status === 'active');
        } catch (error) {
          console.error('Error checking programming access:', error);
          setUserHasAccess(false);
        } finally {
          setIsLoadingAccess(false);
        }
      } else {
        setIsLoadingAccess(false);
        setUserHasAccess(false);
      }
    };

    checkUserAccess();
  }, [currentUser]);

  const handleButtonClick = () => {
    if (userHasAccess && onGetStarted) {
      // User has access, call the onGetStarted callback to enter the app
      onGetStarted();
    } else {
      // User doesn't have access, show the request form
      setShowEarlyAccessForm(true);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Hero Section */}
      <main ref={useScrollFade()} className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        {/* Video Container */}
        <div className="relative w-[300px] sm:w-[380px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10]" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900 flex items-center justify-center">
              {/* Placeholder for video - replace with actual video when available */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e24] to-zinc-900 opacity-80"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-[#E0FE10] rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-black" />
                </div>
                <p className="text-white text-sm text-center max-w-[200px]">
                  Video demo coming soon
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Introducing Pulse Programming
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            The Chat GPT For Personal Trainers
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Create personalized training programs in seconds with AI. Design structured workout rounds for your community, customize training cycles, and deliver professional-quality programs to your clients with unprecedented ease.
          </p>
          <div className="mt-8">
            <button
              onClick={handleButtonClick}
              className="bg-[#E0FE10] text-black px-8 py-4 rounded-lg font-semibold hover:bg-[#c5df0e] transition-colors inline-flex items-center"
            >
              {userHasAccess ? "Get Started" : "Request Access"} 
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>
      </main>

      {/* AI Program Generation Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            AI-Powered Program Design
          </h2>
          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
            Create professional training programs in seconds
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Simply describe your training goals, preferred exercise types, and target audience. Our AI will generate complete, progressive training programs with perfect form and balanced workouts. Customize every aspect or let the AI handle the details.
          </p>
        </div>

        {/* Interactive AI Code Demo */}
        <div className="w-full max-w-md bg-zinc-800 rounded-xl overflow-hidden shadow-xl">
          <div className="bg-zinc-900 p-4 flex items-center justify-between">
            <div className="flex items-center">
              <Code className="w-5 h-5 text-[#E0FE10] mr-2" />
              <span className="text-white font-medium">AI Program Generator</span>
            </div>
            <div className="flex space-x-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
          </div>
          <div className="p-5 bg-zinc-900/50 h-96 overflow-y-auto font-mono text-sm">
            <div className="text-green-400 mb-4"># Program request</div>
            <div className="text-white mb-6">Create a 4-week strength program focused on building upper body strength with progressive overload. Include compound movements and accessory work. Target audience is intermediate lifters with access to a full gym.</div>
            
            <div className="text-green-400 mb-4"># AI response</div>
            <div className="text-[#E0FE10] mb-2">Generating 4-week upper body strength program...</div>
            
            <div className="text-white mb-3 opacity-0 animate-[fadeIn_2s_0.5s_forwards]">✓ Analyzing optimal exercise selection</div>
            <div className="text-white mb-3 opacity-0 animate-[fadeIn_2s_1s_forwards]">✓ Calculating progressive overload parameters</div>
            <div className="text-white mb-3 opacity-0 animate-[fadeIn_2s_1.5s_forwards]">✓ Structuring training splits</div>
            <div className="text-white mb-3 opacity-0 animate-[fadeIn_2s_2s_forwards]">✓ Balancing volume and intensity</div>
            <div className="text-white mb-6 opacity-0 animate-[fadeIn_2s_2.5s_forwards]">✓ Finalizing program design</div>
            
            <div className="text-[#E0FE10] mb-4 opacity-0 animate-[fadeIn_2s_3s_forwards]">Program generated successfully! 16 workouts created.</div>
            
            <div className="bg-zinc-800 p-4 rounded-lg opacity-0 animate-[fadeIn_2s_3.5s_forwards]">
              <div className="text-white font-medium mb-2">Upper Body Power Program</div>
              <div className="text-zinc-400 text-xs mb-4">4 weeks • Progressive overload • 4 workouts/week</div>
              
              <div className="space-y-3">
                <div className="bg-zinc-700/30 p-3 rounded-lg">
                  <div className="text-[#E0FE10] text-xs mb-1">WEEK 1 • DAY 1</div>
                  <div className="text-white">Chest & Triceps</div>
                  <div className="text-zinc-400 text-xs">8 exercises • 45-60 min</div>
                </div>
                
                <div className="bg-zinc-700/30 p-3 rounded-lg">
                  <div className="text-[#E0FE10] text-xs mb-1">WEEK 1 • DAY 2</div>
                  <div className="text-white">Back & Biceps</div>
                  <div className="text-zinc-400 text-xs">7 exercises • 45-60 min</div>
                </div>
                
                <div className="bg-zinc-700/30 p-3 rounded-lg">
                  <div className="text-[#E0FE10] text-xs mb-1">WEEK 1 • DAY 3</div>
                  <div className="text-white">Rest Day</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section ref={useScrollFade()} className="py-20 px-8 bg-zinc-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-white text-4xl font-bold text-center mb-16">
            Everything trainers need to create perfect programs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors border border-zinc-700/50 hover:border-[#E0FE10]/20">
              <div className="bg-[#E0FE10]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Shuffle className="h-6 w-6 text-[#E0FE10]" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Smart Exercise Selection</h3>
              <p className="text-zinc-400">
                AI selects the optimal exercises based on your goals, available equipment, and client needs
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors border border-zinc-700/50 hover:border-[#E0FE10]/20">
              <div className="bg-[#E0FE10]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-[#E0FE10]" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Periodization</h3>
              <p className="text-zinc-400">
                Create structured programs with intelligent loading patterns across multiple weeks
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors border border-zinc-700/50 hover:border-[#E0FE10]/20">
              <div className="bg-[#E0FE10]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Sliders className="h-6 w-6 text-[#E0FE10]" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Full Customization</h3>
              <p className="text-zinc-400">
                Adjust every aspect of your program - from exercise selection to sets, reps, and rest periods
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors border border-zinc-700/50 hover:border-[#E0FE10]/20">
              <div className="bg-[#E0FE10]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-[#E0FE10]" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Time Efficiency</h3>
              <p className="text-zinc-400">
                Create weeks of programming in seconds instead of hours, giving you more time with clients
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors border border-zinc-700/50 hover:border-[#E0FE10]/20">
              <div className="bg-[#E0FE10]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-[#E0FE10]" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Client Management</h3>
              <p className="text-zinc-400">
                Create and manage programs for multiple clients with personalized approaches
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors border border-zinc-700/50 hover:border-[#E0FE10]/20">
              <div className="bg-[#E0FE10]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Share2 className="h-6 w-6 text-[#E0FE10]" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Easy Sharing</h3>
              <p className="text-zinc-400">
                Share programs with clients or your community with a simple link or in-app invitation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section ref={useScrollFade()} className="py-20 px-8 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
              See it in action
            </h2>
            <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
              Program design made simple
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Watch how Pulse Programming helps you create, manage and share professional workout programs in minutes.
            </p>
          </div>
          
          {/* Video Placeholder */}
          <div className="aspect-video rounded-xl overflow-hidden bg-zinc-800 relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e24] to-zinc-900 opacity-80"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="w-20 h-20 rounded-full bg-[#E0FE10] flex items-center justify-center">
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-black border-b-[10px] border-b-transparent ml-1"></div>
              </button>
            </div>
            <div className="absolute bottom-8 left-0 right-0 text-center">
              <p className="text-white text-lg font-semibold">Pulse Programming Demo</p>
              <p className="text-zinc-400">See how to create your first AI-powered training program</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={useScrollFade()} className="py-20 px-8 bg-zinc-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-white text-4xl font-bold text-center mb-16">
            Trusted by fitness professionals
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-zinc-800 rounded-xl p-8 border border-zinc-700/50">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center mr-4">
                  <Users className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Sarah J.</h3>
                  <p className="text-zinc-400 text-sm">Personal Trainer, 5+ years</p>
                </div>
              </div>
              <p className="text-zinc-300">
                "Pulse Programming has completely transformed how I create workout plans for my clients. What used to take me hours now takes minutes, and the quality is even better!"
              </p>
            </div>
            
            {/* Testimonial 2 */}
            <div className="bg-zinc-800 rounded-xl p-8 border border-zinc-700/50">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center mr-4">
                  <Users className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Marcus T.</h3>
                  <p className="text-zinc-400 text-sm">Fitness Coach, 8+ years</p>
                </div>
              </div>
              <p className="text-zinc-300">
                "The AI understands training principles better than many coaches I've met. It creates perfectly balanced programs with smart progression that my clients love."
              </p>
            </div>
            
            {/* Testimonial 3 */}
            <div className="bg-zinc-800 rounded-xl p-8 border border-zinc-700/50">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center mr-4">
                  <Users className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Alex D.</h3>
                  <p className="text-zinc-400 text-sm">Gym Owner, 10+ years</p>
                </div>
              </div>
              <p className="text-zinc-300">
                "My entire staff now uses Pulse Programming. It's increased our programming quality while freeing up time to focus on what matters most - working directly with our members."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section ref={useScrollFade()} className="min-h-[50vh] bg-black flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-white text-5xl sm:text-6xl font-bold mb-6">
          Ready to transform your training?
        </h2>
        <p className="text-zinc-400 text-xl max-w-2xl mb-10">
          Join the waitlist for Pulse Programming and be among the first to experience the future of fitness program design.
        </p>
        <button
          onClick={() => setShowEarlyAccessForm(true)}
          className="bg-[#E0FE10] text-black px-12 py-4 rounded-xl text-lg font-semibold hover:bg-[#c5df0e] transition-colors flex items-center"
        >
          {hasAccess ? "Get Started" : "Request Access"} 
          <ArrowRight className="ml-2 h-5 w-5" />
        </button>
      </section>
    </div>
  );
};

// Early Access Form Component
const EarlyAccessForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: {
      trainer: false,
      enthusiast: false,
      coach: false,
      fitnessInstructor: false
    },
    primaryUse: '',
    useCases: {
      oneOnOneCoaching: false,
      communityRounds: false,
      personalPrograms: false
    },
    clientCount: '',
    yearsExperience: '',
    longTermGoal: '',
    isCertified: false,
    certificationName: '',
    applyForFoundingCoaches: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCheckboxChange = (category: 'role' | 'useCases', name: string) => {
    setFormData(prev => {
      if (category === 'role') {
        return {
          ...prev,
          role: {
            ...prev.role,
            [name]: !prev.role[name as keyof typeof prev.role]
          }
        };
      } else {
        return {
          ...prev,
          useCases: {
            ...prev.useCases,
            [name]: !prev.useCases[name as keyof typeof prev.useCases]
          }
        };
      }
    });
  };
  
  const handleRadioChange = (name: string, value: boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      // Validate form
      if (!formData.name || !formData.email) {
        throw new Error('Name and email are required');
      }
      
      if (!formData.email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      
      // Roles validation - at least one role should be selected
      const hasRole = Object.values(formData.role).some(val => val);
      if (!hasRole) {
        throw new Error('Please select at least one role');
      }
      
      // Submit to Firebase using the new programming access system
      const success = await adminMethods.createProgrammingAccessRequest({
        email: formData.email,
        name: formData.name,
        status: 'requested',
        role: formData.role,
        primaryUse: formData.primaryUse,
        useCases: formData.useCases,
        clientCount: formData.clientCount,
        yearsExperience: formData.yearsExperience,
        longTermGoal: formData.longTermGoal,
        isCertified: formData.isCertified,
        certificationName: formData.certificationName,
        applyForFoundingCoaches: formData.applyForFoundingCoaches
      });
      
      if (!success) {
        throw new Error('Failed to submit application');
      }
      
      // Success!
      setSubmitSuccess(true);
      
      
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (submitSuccess) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Request Submitted!</h2>
        <p className="text-zinc-400 mb-8 max-w-md">
          Thank you for your interest in Pulse Programming. We'll review your application and get back to you shortly with access details.
        </p>
        
        <div className="flex flex-col items-center gap-6">
          <img 
            src="/PulseProgrammingLogoWhite.png" 
            alt="Pulse Programming Logo" 
            className="w-48 opacity-50 mb-2"
          />
          
          <a 
            href="https://apps.apple.com/us/app/pulse-fitness-workout-app/id1626908941" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-[#E0FE10] text-black rounded-lg hover:bg-[#E0FE10]/90 transition-colors"
          >
            <Zap className="w-5 h-5" />
            <span className="font-semibold">Download Pulse App</span>
          </a>
          
          <p className="text-sm text-zinc-500 max-w-xs text-center">
            Start your fitness journey today with the Pulse app while we review your Programming access request
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="flex flex-col items-center mb-8">
        <img 
          src="/PulseProgrammingLogoWhite.png" 
          alt="Pulse Programming Logo" 
          className="w-56 mb-6"
        />
        <h1 className="text-2xl md:text-3xl font-bold text-white text-center">Request Early Access</h1>
        <p className="text-zinc-400 text-center mt-2">
          Pulse Programming is currently in early access. Fill out this form to request access to our AI-powered fitness programming platform.
        </p>
      </div>
      
      {submitError && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-6">
          {submitError}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">Basic Information</h2>
          
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-400 mb-1">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all"
              placeholder="Your name"
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>
        </div>
        
        {/* Role & Use Case */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">Your Role & Use Case</h2>
          
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Which best describes you? (Select all that apply)</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                <input 
                  type="checkbox" 
                  checked={formData.role.trainer}
                  onChange={() => handleCheckboxChange('role', 'trainer')}
                  className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                />
                <span className="ml-3 text-white">Personal Trainer</span>
              </label>
              
              <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                <input 
                  type="checkbox" 
                  checked={formData.role.enthusiast}
                  onChange={() => handleCheckboxChange('role', 'enthusiast')}
                  className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                />
                <span className="ml-3 text-white">Fitness Enthusiast</span>
              </label>
              
              <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                <input 
                  type="checkbox" 
                  checked={formData.role.coach}
                  onChange={() => handleCheckboxChange('role', 'coach')}
                  className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                />
                <span className="ml-3 text-white">Coach</span>
              </label>
              
              <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                <input 
                  type="checkbox" 
                  checked={formData.role.fitnessInstructor}
                  onChange={() => handleCheckboxChange('role', 'fitnessInstructor')}
                  className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                />
                <span className="ml-3 text-white">Fitness Instructor</span>
              </label>
            </div>
          </div>
          
          <div>
            <label htmlFor="primaryUse" className="block text-sm font-medium text-zinc-400 mb-1">What will you primarily use Pulse Programming for?</label>
            <textarea
              id="primaryUse"
              name="primaryUse"
              value={formData.primaryUse}
              onChange={handleInputChange}
              rows={3}
              className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
              placeholder="Describe how you plan to use our platform..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Common use cases (Select all that apply)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                <input 
                  type="checkbox" 
                  checked={formData.useCases.oneOnOneCoaching}
                  onChange={() => handleCheckboxChange('useCases', 'oneOnOneCoaching')}
                  className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                />
                <span className="ml-3 text-white">One-on-one coaching</span>
              </label>
              
              <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                <input 
                  type="checkbox" 
                  checked={formData.useCases.communityRounds}
                  onChange={() => handleCheckboxChange('useCases', 'communityRounds')}
                  className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                />
                <span className="ml-3 text-white">Community Rounds</span>
              </label>
              
              <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                <input 
                  type="checkbox" 
                  checked={formData.useCases.personalPrograms}
                  onChange={() => handleCheckboxChange('useCases', 'personalPrograms')}
                  className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                />
                <span className="ml-3 text-white">Personal programs</span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Professional Information */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">Professional Information</h2>
          
          <div>
            <label htmlFor="clientCount" className="block text-sm font-medium text-zinc-400 mb-1">How many clients do you currently have?</label>
            <select
              id="clientCount"
              name="clientCount"
              value={formData.clientCount}
              onChange={handleInputChange}
              className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white focus:border-[#E0FE10] focus:outline-none transition-all"
            >
              <option value="">Select an option</option>
              <option value="0">0 (None yet)</option>
              <option value="1-5">1-5 clients</option>
              <option value="6-10">6-10 clients</option>
              <option value="11-20">11-20 clients</option>
              <option value="21-50">21-50 clients</option>
              <option value="50+">More than 50 clients</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="yearsExperience" className="block text-sm font-medium text-zinc-400 mb-1">How many years of training experience do you have?</label>
            <select
              id="yearsExperience"
              name="yearsExperience"
              value={formData.yearsExperience}
              onChange={handleInputChange}
              className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white focus:border-[#E0FE10] focus:outline-none transition-all"
            >
              <option value="">Select an option</option>
              <option value="<1">Less than 1 year</option>
              <option value="1-2">1-2 years</option>
              <option value="3-5">3-5 years</option>
              <option value="6-10">6-10 years</option>
              <option value="10+">More than 10 years</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="longTermGoal" className="block text-sm font-medium text-zinc-400 mb-1">What is your long-term goal with personal training?</label>
            <textarea
              id="longTermGoal"
              name="longTermGoal"
              value={formData.longTermGoal}
              onChange={handleInputChange}
              rows={3}
              className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
              placeholder="Describe your long-term professional goals..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Are you certified? (FYI, this is not required)</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input 
                  type="radio" 
                  checked={formData.isCertified === true}
                  onChange={() => handleRadioChange('isCertified', true)}
                  className="form-radio h-5 w-5 text-[#E0FE10]"
                />
                <span className="ml-2 text-white">Yes</span>
              </label>
              
              <label className="flex items-center">
                <input 
                  type="radio" 
                  checked={formData.isCertified === false}
                  onChange={() => handleRadioChange('isCertified', false)}
                  className="form-radio h-5 w-5 text-[#E0FE10]"
                />
                <span className="ml-2 text-white">No</span>
              </label>
            </div>
          </div>

          {formData.isCertified && (
            <div className="pl-6 border-l-2 border-[#E0FE10]/30">
              <label htmlFor="certificationName" className="block text-sm font-medium text-zinc-400 mb-1">Which certification(s) do you have?</label>
              <input
                type="text"
                id="certificationName"
                name="certificationName"
                value={formData.certificationName}
                onChange={handleInputChange}
                className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all"
                placeholder="E.g., NASM, ACE, ISSA, NSCA, etc."
              />
            </div>
          )}

          <div className="mt-6 p-4 bg-[#262a30]/50 rounded-lg border border-zinc-700/80 hover:border-[#E0FE10]/20 transition-colors">
            <div className="flex items-start">
              <input 
                type="checkbox" 
                id="applyForFoundingCoaches"
                checked={formData.applyForFoundingCoaches}
                onChange={() => setFormData(prev => ({ ...prev, applyForFoundingCoaches: !prev.applyForFoundingCoaches }))}
                className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded mt-1"
              />
              <div className="ml-3">
                <label htmlFor="applyForFoundingCoaches" className="block text-sm font-medium text-white">Apply for the Pulse Pilot Founding 100 Coaches Program</label>
                <p className="text-zinc-400 text-xs mt-1">
                  Get early access to all premium features and be part of our exclusive founding coaches community.
                  <a 
                    href="/starter-pack" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-1 text-[#E0FE10] underline hover:text-[#E0FE10]/80 transition-colors"
                  >
                    What is the Founding 100 Coaches Pilot?
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 flex items-center justify-center gap-2 ${
            isSubmitting ? 'bg-zinc-600' : 'bg-[#E0FE10] hover:bg-[#c5df0e] active:bg-[#a8be0c]'
          } text-black rounded-lg font-semibold transition-colors`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Request Access</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

// Local class extending Workout to handle roundWorkoutId for UI purposes
class WorkoutWithRoundId extends Workout {
  roundWorkoutId?: string;

  constructor(data: any, roundId?: string) {
    super(data); // Calls the original Workout constructor
    this.roundWorkoutId = roundId;
    // If data itself might be a WorkoutWithRoundId instance and we want to preserve its roundWorkoutId if roundId is not provided:
    if (roundId === undefined && (data as WorkoutWithRoundId).roundWorkoutId) {
        this.roundWorkoutId = (data as WorkoutWithRoundId).roundWorkoutId;
    }
  }
}

// Type definitions
export enum SweatlistType {
  together = 'together',
  locked = 'locked'
}

interface ViewModel {
  appCoordinator: {
    showFloatingTextfield: (options: {
      title: string;
      theme: string;
      keyboardType: string;
      maxLength?: number;
      minLength?: number;
      returnText: (text: string) => void;
      onDone: (text: string) => void;
      closeMenuDrawer: () => void;
    }) => void;
    closeFloatingMenu: () => void;
    closeModals: () => void;
  };
  
  validateChallengeInput: (
    startDate: Date,
    endDate: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string
  ) => boolean;

  setChallenge: (
    startDate: Date,
    endDate: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string,
    restDayPreferences?: ChallengeData['restDayPreferences'] // Ensure this matches ChallengeData
  ) => void;
}

interface ChallengeData {
  challengeId?: string;
  startDate: Date;
  endDate: Date;
  challengeName: string;
  challengeDesc: string;
  roundType: SweatlistType;
  pinCode: string;
  restDayPreferences?: {
    includeRestDays: boolean;
    restDays: string[]; // e.g. ["Monday", "Tuesday"]
    preferences: string[]; // For AI prompts, e.g. ["Schedule rest days on Monday..."]
  };
  equipmentPreferences?: {
    selectedEquipment: string[];
    equipmentOnly: boolean;
  };
  challengeType?: 'workout' | 'steps' | 'calories' | 'hybrid';
  stepConfiguration?: {
    dailyStepGoal: number;
    allowedMissedDays: number;
  };
  mealTracking?: {
    isEnabled: boolean;
    configurationType: 'mealPlan' | 'customMacros';
    pointsPerDay: number;
    tolerancePercentage: number;
    linkedMealPlanId?: string;
    mealPlanName?: string;
    customMacroRanges?: {
      calorieRange: { min: number; max: number };
      proteinRange: { min: number; max: number };
      carbRange: { min: number; max: number };
      fatRange: { min: number; max: number };
    };
  };
}

interface MobileChallengeSetupProps {
  setChallengeData: (data: ChallengeData) => void; // Simplified to pass the whole object
  currentChallengeData: ChallengeData;
  selectedStacks: WorkoutWithRoundId[]; 
  setSelectedStacks: (stacks: WorkoutWithRoundId[] | ((prev: WorkoutWithRoundId[]) => WorkoutWithRoundId[])) => void; 
  onRemoveStack: (stackId: string) => void;
  viewModel: ViewModel;
}

interface DayPreference {
  day: string;
  isSelected: boolean;
}

const MobileChallengeSetupView: React.FC<MobileChallengeSetupProps> = ({
    setChallengeData,
    currentChallengeData,
    selectedStacks,
    setSelectedStacks,
    onRemoveStack,
  }) => {
    // Simplified date handling - just use the dates as they are, fallback to current date if invalid
    const startDate = (currentChallengeData.startDate instanceof Date && !isNaN(currentChallengeData.startDate.getTime())) 
      ? currentChallengeData.startDate 
      : new Date();
    const endDate = (currentChallengeData.endDate instanceof Date && !isNaN(currentChallengeData.endDate.getTime()))
      ? currentChallengeData.endDate 
      : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const {
      challengeName,
      challengeDesc,
      roundType,
      pinCode,
    } = currentChallengeData;
  
    // Refs for different sections
    const roundTypeRef = useRef<HTMLDivElement>(null);
    const pinCodeRef = useRef<HTMLInputElement>(null);
  
    // Date formatter
    const _dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
  
    // Effect to scroll when round type changes to locked
    useEffect(() => {
      if (roundType === SweatlistType.locked) {
        // Slight delay to ensure DOM is updated
        setTimeout(() => {
          if (pinCodeRef.current) {
            pinCodeRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }, 100);
      }
    }, [roundType]);
  
    const handleLocalSetChallengeData = (
        sDate: Date, eDate: Date, name: string, desc: string, rType: SweatlistType, pCode: string
    ) => {
        setChallengeData({
            ...currentChallengeData, // preserve existing fields like restDayPreferences
            startDate: sDate instanceof Date && !isNaN(sDate.getTime()) ? sDate : convertFirestoreTimestamp(sDate),
            endDate: eDate instanceof Date && !isNaN(eDate.getTime()) ? eDate : convertFirestoreTimestamp(eDate),
            challengeName: name,
            challengeDesc: desc,
            roundType: rType,
            pinCode: pCode,
        });
    };

    const handleStackSelection = (stack: Workout) => {
      const mappedExercises = stack.exercises?.map(exercise => {
        const categoryType = exercise.exercise.category?.type || 'weight-training';
        const categoryDetails = exercise.exercise.category?.details;
        const isWeightTraining = categoryType === 'weight-training';

        return new ExerciseDetail({
          exercise: exercise.exercise,
          category: {
            type: categoryType,
            details: isWeightTraining 
              ? {
                  sets: (categoryDetails as WeightTrainingExercise)?.sets || 3,
                  reps: (categoryDetails as WeightTrainingExercise)?.reps || ['12'],
                  weight: (categoryDetails as WeightTrainingExercise)?.weight || 0,
                  screenTime: categoryDetails?.screenTime || 0,
                  selectedVideo: categoryDetails?.selectedVideo 
                    ? new ExerciseVideo(categoryDetails.selectedVideo)
                    : null
                }
              : {
                  duration: (categoryDetails as CardioExercise)?.duration || 60,
                  bpm: (categoryDetails as CardioExercise)?.bpm || 140,
                  calories: (categoryDetails as CardioExercise)?.calories || 0,
                  screenTime: categoryDetails?.screenTime || 0,
                  selectedVideo: categoryDetails?.selectedVideo 
                    ? new ExerciseVideo(categoryDetails.selectedVideo)
                    : null
                }
          }
        });
      }) || [];

      const updatedStack = new WorkoutWithRoundId({
        ...stack,
        exercises: mappedExercises
      }, stack.id); // Assign a default roundWorkoutId, or manage as needed

      setSelectedStacks(prev => [...prev, updatedStack]);
    };

    const _handleRemoveStack = (stackId: string) => {
      onRemoveStack(stackId);
    };

    return (
      <div className="relative h-full pb-20"> {/* Added pb-20 to prevent overlap with fixed button if any was here */}
        <h1 className="text-2xl font-semibold text-white text-center mb-2">Create a Round</h1>
        <p className="text-zinc-400 text-center text-sm mb-8">
          Rounds are structured training programs that guide you through a series of Stacks over time.
        </p>
  
        {/* Round Name */}
        <div className="mb-6">
          <label className="text-sm text-zinc-400 mb-2 block">Round Name</label>
          <input
            type="text"
            value={challengeName}
            onChange={(e) => handleLocalSetChallengeData(
              startDate, 
              endDate, 
              e.target.value, 
              challengeDesc, 
              roundType, 
              pinCode
            )}
            placeholder="Add a name for your round"
            className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 
                      text-white placeholder:text-zinc-500
                      focus:border-[#E0FE10] focus:outline-none transition-all"
          />
        </div>
  
        {/* Description */}
        <div className="mb-8">
          <label className="text-sm text-zinc-400 mb-2 block">Description</label>
          <textarea
            value={challengeDesc}
            onChange={(e) => handleLocalSetChallengeData(
              startDate, 
              endDate, 
              challengeName, 
              e.target.value, 
              roundType, 
              pinCode
            )}
            placeholder="Add a description for your round"
            rows={3}
            className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 
                      text-white placeholder:text-zinc-500 
                      focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
          />
        </div>
  
        {/* Selected Stacks */}
        <div className="mb-8">
          <label className="text-sm text-zinc-400 mb-2 block">Selected Stacks</label>
          {selectedStacks.length === 0 ? (
            <div className="p-4 rounded-lg bg-[#262a30] border border-zinc-700 text-center">
              <p className="text-zinc-400">No stacks selected yet</p>
              <p className="text-zinc-500 text-sm mt-1">Select stacks to add them to your round</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedStacks.map((stack, index) => (
                <div key={`mobile-stack-${index}-${stack.roundWorkoutId || stack.id}`} className="border border-zinc-700 rounded-lg">
                    <StackCard 
                    workout={stack}
                    gifUrls={stack.exercises?.map(ex => ex.exercise?.videos?.[0]?.gifURL || '') || []}
                    isChallengeEnabled={false}
                    onPrimaryAction={() => handleStackSelection(stack)}
                    />
                </div>
              ))}
            </div>
          )}
        </div>
  
        {/* Round Type */}
        <div ref={roundTypeRef} className="mb-8">
          <label className="text-sm text-zinc-400 mb-2 block">Round Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleLocalSetChallengeData(startDate, endDate, challengeName, challengeDesc, SweatlistType.together, pinCode)}
              className={`p-4 rounded-lg flex flex-col items-center transition-colors ${
                roundType === SweatlistType.together 
                  ? "bg-[#E0FE10] text-black" 
                  : "bg-[#262a30] border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50"
              }`}
            >
              <Users className="h-5 w-5 mb-2" />
              <span className="font-medium text-sm">Together</span>
              <span className="text-xs mt-1">Train with the community</span>
            </button>
  
            <button
              onClick={() => handleLocalSetChallengeData(startDate, endDate, challengeName, challengeDesc, SweatlistType.locked, pinCode)}
              className={`p-4 rounded-lg flex flex-col items-center transition-colors ${
                roundType === SweatlistType.locked 
                  ? "bg-[#E0FE10] text-black" 
                  : "bg-[#262a30] border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50"
              }`}
            >
              <Lock className="h-5 w-5 mb-2" />
              <span className="font-medium text-sm">Private</span>
              <span className="text-xs mt-1">Invite-only training</span>
            </button>
          </div>
        </div>
  
        {/* Dates */}
        {/* Adjusted margin calculation based on pinCodeRef visibility, not roundType directly affecting here */}
        <div className={`mb-8 ${pinCodeRef.current ? 'mb-4' : 'mb-20'}`}> 
          <label className="text-sm text-zinc-400 mb-2 block">Round Dates</label>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate && !isNaN(startDate.getTime()) ? startDate.toISOString().split('T')[0] : ''}
                onChange={(e) => handleLocalSetChallengeData(
                  new Date(e.target.value),
                  endDate,
                  challengeName,
                  challengeDesc,
                  roundType,
                  pinCode
                )}
                className="w-full p-3 rounded-lg bg-[#262a30] border border-zinc-700 
                        text-white placeholder:text-zinc-500
                        focus:border-[#E0FE10] focus:outline-none transition-all
                        [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">End Date</label>
              <input
                type="date"
                value={endDate && !isNaN(endDate.getTime()) ? endDate.toISOString().split('T')[0] : ''}
                min={startDate && !isNaN(startDate.getTime()) ? startDate.toISOString().split('T')[0] : ''}
                onChange={(e) => handleLocalSetChallengeData(
                  startDate,
                  new Date(e.target.value),
                  challengeName,
                  challengeDesc,
                  roundType,
                  pinCode
                )}
                className="w-full p-3 rounded-lg bg-[#262a30] border border-zinc-700 
                        text-white placeholder:text-zinc-500
                        focus:border-[#E0FE10] focus:outline-none transition-all
                        [color-scheme:dark]"
              />
            </div>
          </div>
        </div>
  
        {roundType === SweatlistType.locked && (
          <div className="mb-20"> {/* Ensure enough bottom margin if this is the last element before a fixed button */}
            <label htmlFor="pinCode" className="text-sm text-zinc-400 mb-2 block">PIN Code</label>
            <input
              ref={pinCodeRef}
              id="pinCode"
              type="text"
              maxLength={9}
              minLength={9}
              value={pinCode}
              onChange={(e) => handleLocalSetChallengeData(
                startDate,
                endDate,
                challengeName,
                challengeDesc,
                roundType,
                e.target.value
              )}
              placeholder="Set 9-digit PIN"
              className="w-full p-3 rounded-lg bg-[#262a30] border border-zinc-700 
                        text-white placeholder:text-zinc-500
                        focus:border-[#E0FE10] focus:outline-none transition-all"
            />
          </div>
        )}

        {/* Workout Preferences and Rest Days sections are REMOVED from here */}
        {/* The Create Round button that was part of MobileChallengeSetupView's JSX is REMOVED */}
      </div>
    );
  };

interface ChatResponse {
  thinking?: string;
  message: string;
  success?: boolean;
  readyToGenerate?: boolean;
  questionCount?: number;
  isAwaitingConfirmation?: boolean;
  finalPrompt?: string;
  suggestedName?: string;
  suggestedDescription?: string;
  suggestedStartDate?: string;
  suggestedEndDate?: string;
  configuredRestDays?: string[];
  shouldEnableRestDays?: boolean;
  shouldAnimateName?: boolean;
  shouldAnimateDescription?: boolean;
  error?: string;
}

interface DesktopChallengeSetupProps {
  challengeData: ChallengeData;
  setChallengeData: (data: ChallengeData) => void; // Simplified to pass the whole object
  viewModel: ViewModel;
  autoSave?: (updates: Partial<ProgrammingConversation>) => void; // Auto-save function
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  conversationHistory: ProgrammingChatMessage[];
  setConversationHistory: (history: ProgrammingChatMessage[]) => void;
  restoredUIState?: any; // UI state to restore from conversation
  isLoadingConversation: boolean;
  allConversations: any[];
  handleCreateNewConversation: () => Promise<void>;
  handleSwitchConversation: (id: string) => Promise<void>;
  isConversationPanelCollapsed: boolean;
  toggleConversationPanel: () => void;
  isRightPanelCollapsed: boolean;
  toggleRightPanel: () => void;
  isLeftPanelCollapsed: boolean;
  toggleLeftPanel: () => void;
}

// Stack Detail Modal Component
interface StackDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  stack: WorkoutWithRoundId | null;
}

const StackDetailModal: React.FC<StackDetailModalProps> = ({ isOpen, onClose, stack }) => {
  if (!isOpen || !stack) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#1a1d23] rounded-lg border border-zinc-700 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div>
            <h2 className="text-xl font-semibold text-white">{stack.title || 'Workout Stack'}</h2>
            <p className="text-sm text-zinc-400 mt-1">
              {stack.exercises?.length || 0} exercise{stack.exercises?.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {stack.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-zinc-300 mb-2">Description</h3>
              <p className="text-sm text-zinc-400">{stack.description}</p>
            </div>
          )}

          {/* Exercises List */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-zinc-300">Exercises</h3>
            {stack.exercises && stack.exercises.length > 0 ? (
              <div className="space-y-3">
                {stack.exercises.map((exerciseRef, index) => {
                  const exercise = exerciseRef.exercise;
                  return (
                    <div key={`exercise-${index}-${exercise.id || exercise.name}`} className="bg-[#262a30] rounded-lg p-4 border border-zinc-700">
                      <div className="flex items-start gap-4">
                        {/* Exercise GIF */}
                        <div className="flex-shrink-0">
                          {exercise.videos && exercise.videos.length > 0 && exercise.videos[0].gifURL ? (
                            <img
                              src={exercise.videos[0].gifURL}
                              alt={exercise.name}
                              className="w-16 h-16 rounded-lg object-cover bg-zinc-800"
                              onError={(e) => {
                                // Fallback to thumbnail if GIF fails to load
                                const target = e.target as HTMLImageElement;
                                if (exercise.videos[0].thumbnail) {
                                  target.src = exercise.videos[0].thumbnail;
                                } else {
                                  target.style.display = 'none';
                                }
                              }}
                            />
                          ) : exercise.videos && exercise.videos.length > 0 && exercise.videos[0].thumbnail ? (
                            <img
                              src={exercise.videos[0].thumbnail}
                              alt={exercise.name}
                              className="w-16 h-16 rounded-lg object-cover bg-zinc-800"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center">
                              <Dumbbell className="w-6 h-6 text-zinc-500" />
                            </div>
                          )}
                        </div>

                        {/* Exercise Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-white truncate">{exercise.name}</h4>
                              {exercise.category && (
                                <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-1 rounded mt-1 inline-block">
                                  {typeof exercise.category === 'string' ? exercise.category : exercise.category.type || 'Exercise'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Exercise Sets/Reps Info */}
                          <div className="mt-2 space-y-1">
                            {exercise.sets && exercise.sets > 0 && (
                              <div className="text-xs text-zinc-400">
                                <span className="font-medium">Sets:</span> {exercise.sets}
                              </div>
                            )}
                            {exercise.reps && (
                              <div className="text-xs text-zinc-400">
                                <span className="font-medium">Reps:</span> {exercise.reps}
                              </div>
                            )}
                            {exercise.weight && exercise.weight > 0 && (
                              <div className="text-xs text-zinc-400">
                                <span className="font-medium">Weight:</span> {exercise.weight} lbs
                              </div>
                            )}
                            {exercise.primaryBodyParts && exercise.primaryBodyParts.length > 0 && (
                              <div className="text-xs text-zinc-400">
                                <span className="font-medium">Target:</span> {exercise.primaryBodyParts.join(', ')}
                              </div>
                            )}
                          </div>

                          {/* Exercise Description */}
                          {exercise.description && (
                            <div className="mt-2">
                              <p className="text-xs text-zinc-500">{exercise.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <Dumbbell className="w-6 h-6 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-400">No exercises found in this stack</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-zinc-700 bg-[#262a30]">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-[#d4f00d] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Round Creation Success Modal Component
interface RoundSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  roundData: {
    collection: any;
    stacks: WorkoutWithRoundId[];
    isUpdate?: boolean;
    aiThinking?: string;
    scheduleInfo?: {
      startDate: Date;
      endDate: Date;
      restDays: string[];
      totalDays: number;
      workoutDays: number;
      restDayCount: number;
    };
  } | null;
  onViewRound: () => void;
  onContinueEditing: () => void;
}

const RoundSuccessModal: React.FC<RoundSuccessModalProps> = ({ 
  isOpen, 
  onClose, 
  roundData, 
  onViewRound, 
  onContinueEditing 
}) => {
  const [isAIReasoningExpanded, setIsAIReasoningExpanded] = useState(false);
  
  if (!isOpen || !roundData) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Generate full schedule with both workout and rest days
  const generateFullSchedule = () => {
    if (!roundData.scheduleInfo) return [];
    
    const { startDate, endDate: _endDate, restDays, totalDays } = roundData.scheduleInfo;
    const schedule = [];
    
    // Create a map of rest days for quick lookup
    const restDayMap = new Set(restDays.map(day => day.toLowerCase()));
    
    let workoutIndex = 0;
    
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + dayIndex);
      
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const formattedDate = currentDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      
      const isRestDay = restDayMap.has(dayOfWeek.toLowerCase());
      
      if (isRestDay) {
        schedule.push({
          type: 'rest',
          dayNumber: dayIndex + 1,
          date: formattedDate,
          dayOfWeek,
          title: 'Rest Day',
          description: 'Recovery and restoration',
        });
      } else {
        // Cycle through available workout stacks (auto-repeat pattern)
        const availableWorkouts = roundData.stacks.filter(stack => stack.title !== 'Rest');
        const workout = availableWorkouts.length > 0 
          ? availableWorkouts[workoutIndex % availableWorkouts.length]
          : null;
          
        schedule.push({
          type: 'workout',
          dayNumber: dayIndex + 1,
          date: formattedDate,
          dayOfWeek,
          title: workout?.title || `Workout ${(workoutIndex % availableWorkouts.length) + 1}`,
          exercises: workout?.exercises?.length || 0,
          workout: workout
        });
        workoutIndex++;
      }
    }
    
    return schedule;
  };

  const fullSchedule = generateFullSchedule();

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#1a1d23] rounded-lg border border-zinc-700 w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center">
              <Check className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {roundData.isUpdate ? 'Round Updated Successfully!' : 'Round Created Successfully!'}
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                {roundData.isUpdate 
                  ? `Added ${roundData.stacks?.length || 0} new stacks to ${roundData.collection?.title || 'your round'}`
                  : `${roundData.collection?.title || 'Your round'} is ready to go`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div className="space-y-6">
            {/* Round Overview */}
            <div className="bg-[#262a30] rounded-lg p-4 border border-zinc-700">
              <h3 className="text-sm font-medium text-[#E0FE10] mb-2">Round Overview</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Name:</span>
                  <span className="text-white">{roundData.collection?.title || 'Untitled Round'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Stacks:</span>
                  <span className="text-white">{roundData.stacks?.length || 0} workouts</span>
                </div>
                {roundData.scheduleInfo && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Rest Days:</span>
                      <span className="text-white">{roundData.scheduleInfo.restDayCount} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Total Days:</span>
                      <span className="text-white">{roundData.scheduleInfo.totalDays} days</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Exercises:</span>
                  <span className="text-white">
                    {roundData.stacks?.reduce((total, stack) => total + (stack.exercises?.length || 0), 0) || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Generated Schedule Preview */}
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Generated Schedule</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-700">
                {fullSchedule.length > 0 ? (
                  fullSchedule.map((day, index) => (
                    <div key={`schedule-day-${index}`} className={`rounded-lg p-3 border ${
                      day.type === 'rest' 
                        ? 'bg-[#1a1d23] border-zinc-600' 
                        : 'bg-[#262a30] border-zinc-700'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            day.type === 'rest' 
                              ? 'text-orange-400 bg-orange-400/10' 
                              : 'text-zinc-500 bg-zinc-700'
                          }`}>
                            Day {day.dayNumber}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {day.date} • {day.dayOfWeek}
                          </span>
                          <span className={`text-sm font-medium truncate ${
                            day.type === 'rest' ? 'text-orange-300' : 'text-white'
                          }`}>
                            {day.title}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400">
                          {day.type === 'rest' ? '💤 Recovery' : `${day.exercises} exercises`}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  roundData.stacks?.map((stack, index) => (
                    <div key={`success-stack-${index}-${stack.id}`} className="bg-[#262a30] rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-1 rounded">
                            Day {index + 1}
                          </span>
                          <span className="text-sm font-medium text-white truncate">
                            {stack.title || `Workout ${index + 1}`}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400">
                          {stack.exercises?.length || 0} exercises
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AI Reasoning - Collapsible Section */}
            {roundData.aiThinking && (
              <div className="bg-[#262a30] rounded-lg border border-zinc-700">
                <button 
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-zinc-700/50 transition-colors"
                  onClick={() => setIsAIReasoningExpanded(!isAIReasoningExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#E0FE10]">🧠 AI Reasoning</span>
                    <span className="text-xs text-zinc-500">See how the AI designed your program</span>
                  </div>
                  <div className={`transform transition-transform ${isAIReasoningExpanded ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {isAIReasoningExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-700">
                    <div className="bg-zinc-800/50 rounded-lg p-3 mt-3">
                      <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">
                        {roundData.aiThinking}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Success Message */}
            <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-lg p-4">
              <p className="text-sm text-[#E0FE10]">
                {roundData.isUpdate 
                  ? '🎉 New stacks have been added to your round! You can continue editing or view the updated round details.'
                  : '🎉 Your round has been created and is ready to share! You can continue editing here or view the full round details.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-zinc-700 bg-[#262a30]">
          <div className="flex gap-3">
            <button
              onClick={onContinueEditing}
              className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg font-medium hover:bg-zinc-600 transition-colors"
            >
              Continue Editing
            </button>
            <button
              onClick={onViewRound}
              className="flex-1 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-[#d4f00d] transition-colors flex items-center justify-center gap-2"
            >
              View Round
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// In the DesktopChallengeSetupView component
const DesktopChallengeSetupView: React.FC<DesktopChallengeSetupProps> = ({
    challengeData,
    setChallengeData,
    viewModel,
    autoSave,
    currentConversationId,
    setCurrentConversationId,
    refreshConversations,
    conversationHistory: programmingConversationHistory,
    setConversationHistory: setProgrammingConversationHistory,
    restoredUIState,
    isLoadingConversation,
    allConversations,
    handleCreateNewConversation,
    handleSwitchConversation,
    isConversationPanelCollapsed,
    toggleConversationPanel,
    isRightPanelCollapsed,
    toggleRightPanel,
    isLeftPanelCollapsed,
    toggleLeftPanel,
  }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [allStacks, setAllStacks] = useState<Workout[]>([]);
    const [selectedStacks, setSelectedStacks] = useState<WorkoutWithRoundId[]>([]);
    const [isAIMode, setIsAIMode] = useState(true);
    const [showExistingChallenges, setShowExistingChallenges] = useState(false);
    const [existingChallenges, setExistingChallenges] = useState<any[]>([]);
    const [loadingExistingChallenges, setLoadingExistingChallenges] = useState(false);
    const [existingChallengesError, setExistingChallengesError] = useState<string | null>(null);
    const [selectedExistingChallenge, setSelectedExistingChallenge] = useState<any>(null);
  
  // Debug logging for selectedExistingChallenge changes
  useEffect(() => {
    console.log('🔄 DEBUG: selectedExistingChallenge changed to:', selectedExistingChallenge?.id || 'null');
  }, [selectedExistingChallenge]);
    const [originalCollections, setOriginalCollections] = useState<any[]>([]); // Store original collections data
    const [hasChatAreaBeenShown, setHasChatAreaBeenShown] = useState(false); // Track if chat area has been shown for animation
    const currentUser = useUser();

    // Track when chat area should appear for first time animation
    useEffect(() => {
      if (programmingConversationHistory.length > 0 && !hasChatAreaBeenShown) {
        setHasChatAreaBeenShown(true);
      }
    }, [programmingConversationHistory.length, hasChatAreaBeenShown]);

    // User tagging state
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [taggedUsers, setTaggedUsers] = useState<User[]>([]);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);

    // Tagged users scroll state
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const taggedUsersScrollRef = useRef<HTMLDivElement>(null);

    // Effect to restore UI state from conversation
    useEffect(() => {
      if (restoredUIState) {
        
        // Restore selected existing challenge
        if (restoredUIState.selectedExistingChallenge) {
          
          // Set the selected challenge immediately
          setSelectedExistingChallenge(restoredUIState.selectedExistingChallenge);
          
          // Need to fetch existing challenges and set original collections to make the UI work properly
          fetchExistingChallenges().then(() => {
            // Only load stacks from Firestore if we don't have saved selectedStacks
            if (!restoredUIState.selectedStacks || !Array.isArray(restoredUIState.selectedStacks)) {
              // After challenges are loaded, properly select the challenge to load its stacks
              handleSelectExistingChallenge(restoredUIState.selectedExistingChallenge);
            }
          });
        }
        
        // Restore AI mode if available
        if (restoredUIState.isAIMode !== undefined) {
          setIsAIMode(restoredUIState.isAIMode);
        }

        // Restore selected stacks if available
        if (restoredUIState.selectedStacks && Array.isArray(restoredUIState.selectedStacks)) {
          setSelectedStacks(restoredUIState.selectedStacks);
        }

        // Restore challenge data if available
        if (restoredUIState.challengeData) {
          // Ensure dates are properly converted when restoring
          const restoredChallengeData = {
            ...restoredUIState.challengeData,
            startDate: convertFirestoreTimestamp(restoredUIState.challengeData.startDate),
            endDate: convertFirestoreTimestamp(restoredUIState.challengeData.endDate),
          };
          setChallengeData(restoredChallengeData);
        }
      }
    }, [restoredUIState]);

    // One-time browser detection and user state validation (run once on mount)
    useEffect(() => {
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      // Additional Safari-specific debugging (one time only)
      if (isSafari) {
        console.warn('🚨 [Programming] Safari detected - enabling enhanced debugging');
        
        // Check localStorage/sessionStorage availability in Safari
        try {
          localStorage.setItem('safari_test', 'test');
          localStorage.removeItem('safari_test');
        } catch (e) {
          console.error('❌ [Programming] Safari localStorage not available:', e);
        }
      }
    }, []); // Empty dependency array - run only once on mount

    // Convert ProgrammingChatMessage to simple format for chat interface
    const chatMessages = programmingConversationHistory.map(msg => ({
      role: msg.role,
      content: msg.message
    }));
    
    // Enhanced local function to update conversation history with better Safari support
    const _updateConversationHistory = (
      newHistory: Array<{role: 'user' | 'assistant', content: string}> | 
                 ((prev: Array<{role: 'user' | 'assistant', content: string}>) => Array<{role: 'user' | 'assistant', content: string}>)
    ) => {

      if (typeof newHistory === 'function') {
        // For function updates, get the current state and apply the function
        const currentSimpleHistory = programmingConversationHistory.map((msg: ProgrammingChatMessage) => ({
          role: msg.role,
          content: msg.message
        }));
        
        // Apply the function to get the new history
        const newSimpleHistory = newHistory(currentSimpleHistory);
        
        
        // Convert back to ProgrammingChatMessage format
        const programmingMessages: ProgrammingChatMessage[] = newSimpleHistory.map(msg => ({
          id: generateId(),
          role: msg.role,
          message: msg.content,
          timestamp: new Date()
        }));
        
        setProgrammingConversationHistory(programmingMessages);
      } else {
        // For direct array updates, use the array directly
        const historyToSet = newHistory;
        
        
        // Convert back to ProgrammingChatMessage format
        const programmingMessages: ProgrammingChatMessage[] = historyToSet.map(msg => ({
          id: generateId(),
          role: msg.role,
          message: msg.content,
          timestamp: new Date()
        }));


        setProgrammingConversationHistory(programmingMessages);
      }
    };

    // Chatbot conversation state
    const [isAIResponding, setIsAIResponding] = useState(false);
    const [showGenerateCard, setShowGenerateCard] = useState(false);
  
  // Monitor generate card state changes
  useEffect(() => {
    if (showGenerateCard) {
      console.log('✅ Generate card is now visible');
    }
  }, [showGenerateCard]);
    const [questionCount, setQuestionCount] = useState(0);
    const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
    const [finalPrompt, setFinalPrompt] = useState('');
    const [_suggestedDescription, setSuggestedDescription] = useState('');

    // Stack detail modal state
    const [isStackModalOpen, setIsStackModalOpen] = useState(false);
    const [selectedStackForModal, setSelectedStackForModal] = useState<WorkoutWithRoundId | null>(null);

    // Round creation success modal state
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [createdRoundData, setCreatedRoundData] = useState<{
      collection: any;
      stacks: WorkoutWithRoundId[];
      isUpdate?: boolean;
      aiThinking?: string;
      scheduleInfo?: {
        startDate: Date;
        endDate: Date;
        restDays: string[];
        totalDays: number;
        workoutDays: number;
        restDayCount: number;
      };
    } | null>(null);

    // Collapsible sections state
    const [isStacksOverviewCollapsed, setIsStacksOverviewCollapsed] = useState(false);

    // Handler for fetching existing challenges when dropdown is opened
    const fetchExistingChallenges = async () => {
      if (existingChallenges.length > 0) return; // Don't fetch again if already loaded
      
      // Check if user is authenticated
      if (!currentUser?.id) {
        return;
      }
      
      setLoadingExistingChallenges(true);
      setExistingChallengesError(null);
      try {
        // Use the workout service directly instead of API call
        const collections = await workoutService.fetchCollections(currentUser.id);
        
        if (collections.length > 0) {
          
          // Detailed meal tracking inspection for each collection
          collections.forEach((collection, _index) => {
            const challengeAny = collection.challenge as any;
            if (challengeAny?.mealTracking) {
            } else {
            }
          });
        }
        
        // Filter to only include collections that have challenges and are not completed
        const activeCollections = collections.filter(collection => 
          collection.challenge && 
          collection.challenge.status !== ChallengeStatus.Completed
        );
        
        
        // Store the original collections data for use when selecting an existing challenge
        setOriginalCollections(activeCollections);
        
        // Convert to the format expected by the UI (similar to the API response)
        const formattedChallenges = activeCollections.map(collection => ({
          id: collection.id,
          title: collection.challenge?.title || collection.title || 'Untitled Challenge',
          subtitle: collection.challenge?.subtitle || '',
          status: collection.challenge?.status || 'draft',
          startDate: convertFirestoreTimestamp(collection.challenge?.startDate || collection.createdAt),
          endDate: convertFirestoreTimestamp(collection.challenge?.endDate || collection.createdAt),
          participantsCount: collection.challenge?.participants?.length || 0,
          privacy: collection.challenge?.privacy || 'together',
          ownerId: collection.ownerId,
          notes: '', // Challenge class doesn't have notes property
          workouts: collection.sweatlistIds || []
        }));
        
        setExistingChallenges(formattedChallenges);
      } catch (error) {
        console.error('Error fetching existing challenges:', error);
        setExistingChallengesError('Error loading challenges from database');
      } finally {
        setLoadingExistingChallenges(false);
      }
    };

    // Function to fetch full workout data for an existing challenge
    const fetchWorkoutsForExistingChallenge = async (challenge: any) => {
      if (!challenge.workouts || challenge.workouts.length === 0) {
        setSelectedStacks([]);
        return;
      }

      try {
        // --- Step 1: Fetch all exercise videos from exerciseVideos collection ---
        let allExerciseVideos: ExerciseVideo[] = [];
        try {
          const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
          allExerciseVideos = videoSnapshot.docs.map(doc => new ExerciseVideo({ id: doc.id, ...doc.data() }));
        } catch (videoError) {
          console.error('[Programming] Error fetching exercise videos:', videoError);
          // Continue without videos rather than failing completely
        }

        // Extract workout IDs from the challenge
        const workoutIdsToFetch: string[] = [];
        const restDayPlaceholders: { index: number; idInfo: any }[] = [];

        // Separate IDs and identify rest days
        challenge.workouts.forEach((idInfo: any, index: number) => {
          const name = idInfo.sweatlistName || idInfo.id;
          const id = idInfo.id;
          if (name === "Rest" || id === "rest") {
            restDayPlaceholders.push({ index, idInfo });
          } else if (id && id !== "rest") {
            workoutIdsToFetch.push(id);
          }
        });

        // Batch fetch workouts from 'stacks' collection
        const MAX_IN_QUERY_SIZE = 30;
        const fetchedDocsData: any[] = [];
        
        for (let i = 0; i < workoutIdsToFetch.length; i += MAX_IN_QUERY_SIZE) {
          const chunkOfIds = workoutIdsToFetch.slice(i, i + MAX_IN_QUERY_SIZE);
          if (chunkOfIds.length > 0) {
            try {
              const stacksCollectionRef = collection(db, 'stacks');
              const q = query(stacksCollectionRef, where(documentId(), 'in', chunkOfIds));
              const snapshot = await getDocs(q);
              snapshot.docs.forEach((doc: any) => {
                const data = doc.data();
                fetchedDocsData.push({ id: doc.id, ...data });
              });
            } catch (batchError) {
              console.error(`Error fetching workout batch:`, batchError);
            }
          }
        }

        // Create workout instances with proper exercise data
        const fetchedWorkoutsMap = new Map<string, Workout>();
        fetchedDocsData.forEach(data => {
          try {
            const workoutInstance = new Workout(data);
            fetchedWorkoutsMap.set(data.id, workoutInstance);
          } catch (instantiationError) {
            console.error(`Error instantiating workout ${data.id}:`, instantiationError);
          }
        });

        // --- Step 2: Map Videos to Exercises in each Fetched Workout ---
        fetchedWorkoutsMap.forEach(workoutInstance => {
          if (workoutInstance.exercises && Array.isArray(workoutInstance.exercises)) {
            workoutInstance.exercises = workoutInstance.exercises.map(exerciseRef => {
              if (!exerciseRef || !exerciseRef.exercise) return exerciseRef; // Skip if structure is wrong

              const currentExercise = exerciseRef.exercise;
              const exerciseNameLower = currentExercise.name?.toLowerCase().trim();

              const matchingVideos = allExerciseVideos.filter(
                video => video.exercise?.toLowerCase().trim() === exerciseNameLower
              );

              // Create a *new* Exercise instance including the videos
              const exerciseWithVideos = new Exercise({
                ...currentExercise, // Spread original data
                videos: matchingVideos // Add the filtered videos
              });

              // Return a new ExerciseReference with the updated Exercise instance
              return new ExerciseReference({ 
                  ...exerciseRef, // Keep original groupId etc.
                  exercise: exerciseWithVideos 
              }); 
            });
          }
        });

        // Create final workout list with proper order and rest days
        const finalWorkouts: WorkoutWithRoundId[] = [];
        const missingWorkoutIds: string[] = [];
        
        challenge.workouts.forEach((idInfo: any, index: number) => {
          const name = idInfo.sweatlistName || idInfo.id;
          const id = idInfo.id;

          if (name === "Rest" || id === "rest") {
            // Create rest workout placeholder
            const restWorkout = new Workout({
              id: "rest",
              title: "Rest Day", 
              description: "Recovery day",
              author: idInfo.sweatlistAuthorId || currentUser?.id || '',
              exercises: [], 
              logs: [], 
              duration: 0, 
              useAuthorContent: true, 
              isCompleted: false,
              workoutStatus: WorkoutStatus.QueuedUp, 
              createdAt: new Date(), 
              updatedAt: new Date(),
              zone: BodyZone.FullBody, 
              order: index
            });
            finalWorkouts.push(new WorkoutWithRoundId(restWorkout, `rest-${index}`));
          } else if (id && fetchedWorkoutsMap.has(id)) {
            // Get the full workout with exercises
            const fullWorkout = fetchedWorkoutsMap.get(id)!;
            const workoutWithRoundId = new WorkoutWithRoundId(fullWorkout, `${id}-${index}`);
            finalWorkouts.push(workoutWithRoundId);
          } else if (id) {
            // Track missing workout IDs but don't create placeholders
            missingWorkoutIds.push(id);
          }
        });

        // Report missing workouts in a single message to reduce console noise
        if (missingWorkoutIds.length > 0) {
          console.warn(`⚠️ [Programming] ${missingWorkoutIds.length} workouts from this challenge could not be found in the database. They may have been deleted or moved. Missing IDs: ${missingWorkoutIds.slice(0, 5).join(', ')}${missingWorkoutIds.length > 5 ? ` and ${missingWorkoutIds.length - 5} more` : ''}`);
        }

        setSelectedStacks(finalWorkouts);
        
      } catch (error) {
        console.error('Error fetching workouts for existing challenge:', error);
        setSelectedStacks([]);
      }
    };

    // Handler for selecting an existing challenge
    const handleSelectExistingChallenge = async (challenge: any) => {
      console.log('🎯 DEBUG: Challenge selected from browse:', challenge);
      console.log('🎯 DEBUG: Selected challenge ID:', challenge?.id);
      console.log('🎯 DEBUG: Full challenge object:', JSON.stringify(challenge, null, 2));
      
      setSelectedExistingChallenge(challenge);
      
      // We need to access the original challenge data from the collection
      // Since the formatted challenge may not have all the detailed configuration
      const originalCollection = originalCollections.find((c: any) => c.id === challenge.id);
      const originalChallenge = originalCollection?.challenge;
      
      console.log('🎯 DEBUG: Found original collection:', originalCollection?.id);
      console.log('🎯 DEBUG: Original collection sweatlistIds count:', originalCollection?.sweatlistIds?.length || 0);

      // Validate and fix sweatlistIds count if needed
      if (originalCollection) {
        const { sweatlistIds: validSweatlistIds, workoutIdList: validWorkoutIdList } = 
          validateAndFixSweatlistIds(originalCollection);
        
        if (validSweatlistIds.length !== originalCollection.sweatlistIds?.length) {
          // Update the original collection in memory
          originalCollection.sweatlistIds = validSweatlistIds;
          originalCollection.workoutIdList = validWorkoutIdList;
        }
      }
      
      
      // Create updated challenge data while preserving conversation context
      // Use the already-converted dates from the formatted challenge object
      // The formattedChallenges array already has proper Date objects from convertFirestoreTimestamp
      let startDate = challenge.startDate;
      let endDate = challenge.endDate;
      
      // If the challenge dates are invalid (empty objects), fall back to original collection dates
      if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
        console.warn('⚠️ Challenge startDate is invalid, using original collection data');
        const fallbackStart = convertFirestoreTimestamp(originalChallenge?.startDate);
        startDate = (fallbackStart && !isNaN(fallbackStart.getTime())) ? fallbackStart : new Date();
      }
      
      if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
        console.warn('⚠️ Challenge endDate is invalid, using original collection data');
        const fallbackEnd = convertFirestoreTimestamp(originalChallenge?.endDate);
        endDate = (fallbackEnd && !isNaN(fallbackEnd.getTime())) ? fallbackEnd : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
      
      // Final safety check: if dates are still identical, force them to be different
      if (startDate.getTime() === endDate.getTime()) {
        console.warn('⚠️ Start and end dates are identical, adjusting end date');
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later
      }
      
      // Dates should now be properly processed without corruption
      
      const updatedChallengeData = {
        challengeId: challenge.id, // Set the challenge ID from the selected challenge
        challengeName: challenge.title,
        challengeDesc: challenge.subtitle,
        startDate: startDate,
        endDate: endDate,
        roundType: challenge.privacy === 'locked' ? SweatlistType.locked : SweatlistType.together,
        pinCode: challenge.pinCode || '',
        
        // Populate rest day preferences from original challenge
        restDayPreferences: originalChallenge?.restDayPreferences || challengeData.restDayPreferences,
        
        // Populate equipment preferences from original challenge  
        equipmentPreferences: originalChallenge?.equipmentPreferences || challengeData.equipmentPreferences,
        
        // Populate challenge type configuration
        challengeType: (originalChallenge?.challengeType as any) || 'workout',
        
        // Populate step configuration if available
        stepConfiguration: originalChallenge?.stepConfiguration || {
          dailyStepGoal: originalChallenge?.dailyStepGoal || 10000,
          allowedMissedDays: originalChallenge?.allowedMissedDays || 2,
        },
        
        // Populate meal tracking configuration if available
        mealTracking: (() => {
          const existingMealTracking = (originalChallenge as any)?.mealTracking;
          if (!existingMealTracking) {
            return {
              isEnabled: false,
              configurationType: 'customMacros' as const,
              pointsPerDay: 100,
              tolerancePercentage: 0.10,
              customMacroRanges: {
                calorieRange: { min: 1800, max: 2200 },
                proteinRange: { min: 120, max: 180 },
                carbRange: { min: 200, max: 300 },
                fatRange: { min: 60, max: 100 },
              },
            };
          }
          
          // Determine configuration type based on actual data
          const hasLinkedMealPlan = existingMealTracking.linkedMealPlanId || existingMealTracking.mealPlanName;
          const correctConfigType = hasLinkedMealPlan ? 'mealPlan' : 'customMacros';
          
          
          return {
            ...existingMealTracking,
            configurationType: correctConfigType as any,
            // Ensure we have the meal plan fields
            linkedMealPlanId: existingMealTracking.linkedMealPlanId || undefined,
            mealPlanName: existingMealTracking.mealPlanName || undefined,
            // Ensure we have custom macro ranges with defaults
            customMacroRanges: existingMealTracking.customMacroRanges || {
              calorieRange: { min: 1800, max: 2200 },
              proteinRange: { min: 120, max: 180 },
              carbRange: { min: 200, max: 300 },
              fatRange: { min: 60, max: 100 },
            },
          };
        })(),
      };
      
      // Use setChallengeData (which is updateChallengeDataState) to properly auto-save challenge data changes
      // Auto-save challenge data to conversation
      
      setChallengeData(updatedChallengeData); // This will auto-save to conversation
      
      // Update conversation title and UI state
      if (currentConversationId && autoSave) {
        try {
          await autoSave({
            title: challenge.title,
            summary: challenge.subtitle || '', // Update summary/description field
            uiState: {
              selectedExistingChallenge: challenge,
              isAIMode: true,
              activeTab: 'creators',
              isStacksOverviewCollapsed: false
            },
            updatedAt: new Date()
          });
          
          
          // Refresh conversation list to show updated title
          setTimeout(() => refreshConversations(), 100);
        } catch (error) {
          console.error('❌ [Programming] Error updating conversation:', error);
        }
      }

      // If the challenge has workouts, fetch the full workout data with exercises
      if (challenge.workouts && challenge.workouts.length > 0) {
        fetchWorkoutsForExistingChallenge(challenge);
      } else {
        setSelectedStacks([]);
      }
    };

    // Handler for clearing selected challenge and starting fresh
    const handleClearSelectedChallenge = () => {
      console.log('🧹 DEBUG: Clearing selectedExistingChallenge');
      setSelectedExistingChallenge(null);
      setChallengeData({
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        challengeName: '',
        challengeDesc: '',
        roundType: SweatlistType.together,
        pinCode: '',
        restDayPreferences: {
          includeRestDays: false,
          restDays: [],
          preferences: [],
        },
        equipmentPreferences: {
          selectedEquipment: [],
          equipmentOnly: false,
        },
        challengeType: 'workout',
        stepConfiguration: {
          dailyStepGoal: 10000,
          allowedMissedDays: 2,
        },
        mealTracking: {
          isEnabled: false,
          configurationType: 'customMacros',
          pointsPerDay: 100,
          tolerancePercentage: 0.10,
          customMacroRanges: {
            calorieRange: { min: 1800, max: 2200 },
            proteinRange: { min: 120, max: 180 },
            carbRange: { min: 200, max: 300 },
            fatRange: { min: 60, max: 100 },
          },
        },
      });
      setSelectedStacks([]);
    };

    // Effect to fetch challenges when dropdown is opened or user changes
    useEffect(() => {
      if (showExistingChallenges && currentUser?.id) {
        fetchExistingChallenges();
      }
    }, [showExistingChallenges, currentUser?.id]);

    // Reset challenges when user logs out
    useEffect(() => {
      if (!currentUser?.id) {
        console.log('🧹 DEBUG: Clearing selectedExistingChallenge due to no user');
        setExistingChallenges([]);
        setSelectedExistingChallenge(null);
        setExistingChallengesError(null);
        setOriginalCollections([]);
      }
    }, [currentUser?.id]);

    // Check scroll position for tagged users
    const checkTaggedUsersScroll = () => {
      const container = taggedUsersScrollRef.current;
      if (!container) return;
      
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth);
    };

    // Scroll tagged users container
    const scrollTaggedUsers = (direction: 'left' | 'right') => {
      const container = taggedUsersScrollRef.current;
      if (!container) return;
      
      const scrollAmount = 200; // pixels
      const newScrollLeft = direction === 'left' 
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;
      
      container.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    };

    // Update scroll indicators when tagged users change
    useEffect(() => {
      if (taggedUsers.length > 1) {
        // Small delay to ensure DOM is updated
        setTimeout(checkTaggedUsersScroll, 50);
      }
    }, [taggedUsers]);

    // Helper function to extract tagged users from conversation messages
    const extractTaggedUsersFromConversation = (messages: ProgrammingChatMessage[], availableUsers: User[]): User[] => {
      const taggedUserSet = new Set<string>();
      
      // Look for @mentions in all messages
      messages.forEach(msg => {
        const mentions = msg.message.match(/@(\w+)/g);
        if (mentions) {
          mentions.forEach(mention => {
            const username = mention.substring(1); // Remove @
            // Find user by username or displayName
            const user = availableUsers.find(u => 
              u.username.toLowerCase() === username.toLowerCase() || 
              u.displayName?.toLowerCase() === username.toLowerCase()
            );
            if (user) {
              taggedUserSet.add(user.id);
            }
          });
        }
      });
      
      // Return the actual User objects
      return availableUsers.filter(user => taggedUserSet.has(user.id));
    };

    // Check for readyToGenerate state and restore conversation data when conversation loads or changes
    useEffect(() => {
      // Check if the current conversation is ready to generate
      if (programmingConversationHistory.length > 0) {
        // Look for the latest assistant message with readyToGenerate: true
        const lastAssistantMessage = [...programmingConversationHistory]
          .reverse()
          .find(msg => msg.role === 'assistant' && msg.readyToGenerate === true);
        
        if (lastAssistantMessage) {
          // Don't immediately show generate card - let auto-scroll handle timing
          // The auto-scroll useEffect will check readyToGenerate after scroll completes
        } else {
          // No ready-to-generate message found, hide generate card
          setShowGenerateCard(false);
        }

        // Restore questionCount by counting assistant messages (proxy for questions asked)
        const assistantMessages = programmingConversationHistory.filter(msg => msg.role === 'assistant');
        if (assistantMessages.length > 0) {
          setQuestionCount(assistantMessages.length);
        }

        // Restore tagged users from conversation messages
        const restoredTaggedUsers = extractTaggedUsersFromConversation(programmingConversationHistory, allUsers);
        if (restoredTaggedUsers.length > 0) {
          setTaggedUsers(restoredTaggedUsers);
        }
      } else {
        // No conversation history, hide generate card and reset counts
        setShowGenerateCard(false);
        setQuestionCount(0);
        setTaggedUsers([]);
      }
    }, [programmingConversationHistory, challengeData, allUsers]); // Re-run when conversation, challenge data, or users change

    // Handle sending message to chatbot
    // In DesktopChallengeSetupView component, update the handleSendChatMessage function:

const handleSendChatMessage = async (message: string) => {
  if (!message.trim() || isAIResponding) return;

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  try {
    setIsAIResponding(true);
    
    if (!currentUser?.id) {
      console.error('❌ [Programming] No user ID available:', {
        currentUser,
        isSafari,
        timestamp: new Date().toISOString()
      });
      alert('User authentication issue detected. Please refresh the page and try again.');
      setIsAIResponding(false);
      return;
    }
    
    // Create conversation if this is the first message
    let activeConversationId = currentConversationId;
    if (!activeConversationId) {
      try {
        activeConversationId = await programmingConversationService.createConversation(currentUser.id, {
          challengeData: challengeData as any,
          selectedStacks: selectedStacks
        });
        setCurrentConversationId(activeConversationId);
        
        setTimeout(async () => {
          await refreshConversations();
        }, 500);
      } catch (error) {
        console.error('❌ [Programming] Failed to create conversation:', {
          error,
          userId: currentUser.id,
          isSafari,
          timestamp: new Date().toISOString()
        });
        alert('Failed to create conversation. Please refresh the page and try again.');
        setIsAIResponding(false);
        return;
      }
    }
    
    // Create the new user message
    const newUserProgrammingMessage: ProgrammingChatMessage = {
      id: generateId(),
      role: 'user',
      message: message,
      timestamp: new Date()
    };
    
    // IMPORTANT: Update the state with a new array to ensure React detects the change
    const updatedHistoryWithUser = [...programmingConversationHistory, newUserProgrammingMessage];
    setProgrammingConversationHistory(updatedHistoryWithUser);
    
    // Expand left panel if this is the first message in the conversation
    if (programmingConversationHistory.length === 0 && isLeftPanelCollapsed) {
      toggleLeftPanel();
    }
    

    // Auto-save user message if we have a conversation
    if (autoSave && activeConversationId) {
      await autoSave({ 
        messages: updatedHistoryWithUser,
        updatedAt: new Date()
      });
    }

    // Convert tagged users to UserDataCard format for AI processing
    const convertedTaggedUsers = taggedUsers.map(user => {
      const converted = convertUserToDataCard(user);
      return converted;
    });

    // Prepare existing challenge context if one is selected
    let existingChallengeContext = null;
    if (selectedExistingChallenge) {
      existingChallengeContext = {
        id: selectedExistingChallenge.id,
        title: selectedExistingChallenge.title,
        subtitle: selectedExistingChallenge.subtitle,
        status: selectedExistingChallenge.status,
        startDate: selectedExistingChallenge.startDate,
        endDate: selectedExistingChallenge.endDate,
        participantsCount: selectedExistingChallenge.participantsCount || 0,
        workouts: selectedExistingChallenge.workouts || [],
        privacy: selectedExistingChallenge.privacy,
        notes: selectedExistingChallenge.notes || '',
        isEditing: true
      };
    }


    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        conversationHistory: chatMessages,
        taggedUsers: convertedTaggedUsers,
        challengeData,
        selectedMoves,
        selectedCreators,
        restDayPreferences: challengeData.restDayPreferences,
        equipmentPreferences: challengeData.equipmentPreferences,
        movesTabSelectedCreatorIds,
        existingChallengeContext
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get AI response');
    }

    const data: ChatResponse = await response.json();

    if (data.success && data.message) {
      
      // Create the AI response message
      const aiProgrammingMessage: ProgrammingChatMessage = {
        id: generateId(),
        role: 'assistant',
        message: data.message,
        timestamp: new Date(),
        thinking: data.thinking,
        isAwaitingConfirmation: data.isAwaitingConfirmation,
        suggestedName: data.suggestedName,
        suggestedDescription: data.suggestedDescription,
        suggestedStartDate: data.suggestedStartDate,
        suggestedEndDate: data.suggestedEndDate,
        configuredRestDays: data.configuredRestDays,
        shouldEnableRestDays: data.shouldEnableRestDays,
        shouldAnimateName: data.shouldAnimateName,
        shouldAnimateDescription: data.shouldAnimateDescription,
        readyToGenerate: data.readyToGenerate,
        finalPrompt: data.finalPrompt
      };
      
      // IMPORTANT: Create a new array with both messages to ensure proper state update
      const finalHistory = [...updatedHistoryWithUser, aiProgrammingMessage];
      setProgrammingConversationHistory(finalHistory);
      
      
      // Auto-save conversation after AI response
      if (autoSave && activeConversationId) {
        
        // Prepare the save payload with messages and any conversation-level fields from AI response
        const savePayload: any = { 
          messages: finalHistory,
          updatedAt: new Date()
        };
        
        // Save readyToGenerate at conversation level if AI indicated the conversation is ready
        if (data.readyToGenerate !== undefined) {
          savePayload.readyToGenerate = data.readyToGenerate;
        }
        
        await autoSave(savePayload);
      }
      
      // Update question count and show generate card if ready
      setQuestionCount(data.questionCount || 0);
      
      const currentValidation = validateChallengeInputQuiet(data.readyToGenerate || false);
      const shouldShowGenerateCard = data.readyToGenerate && currentValidation;
      setShowGenerateCard(shouldShowGenerateCard || false);
      setIsAwaitingConfirmation(data.isAwaitingConfirmation || false);
      
      // If generate card is being shown after AI response, scroll down to show it
      if (shouldShowGenerateCard) {
        setTimeout(() => {
          console.log('🔍 [DEBUG] Scrolling down to show generate card after AI response...');
          chatMessagesRef.current?.scrollTo({
            top: chatMessagesRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }, 300); // Small delay to let the card render and any animations complete
      }
      
      
      // Handle final prompt and suggested description
      if (data.finalPrompt) {
        setFinalPrompt(data.finalPrompt);
      }
      
      // Handle suggested field population from validation
      if (data.suggestedDescription && !challengeData.challengeDesc) {
        setSuggestedDescription(data.suggestedDescription);
        handleLocalSetChallengeData({ challengeDesc: data.suggestedDescription });
      }
      
      if (data.suggestedName && !challengeData.challengeName) {
        handleLocalSetChallengeData({ challengeName: data.suggestedName });
      }
      
      if (data.suggestedStartDate && data.suggestedEndDate) {
        handleLocalSetChallengeData({ 
                                  startDate: convertFirestoreTimestamp(data.suggestedStartDate),
                        endDate: convertFirestoreTimestamp(data.suggestedEndDate)
        });
      }
      
      // Handle automated rest day configuration with animation
      
      if (data.shouldEnableRestDays && data.configuredRestDays && data.configuredRestDays.length > 0) {
        animateRestDayConfiguration(data.configuredRestDays);
      } else {
      }
      
      // Handle name and description auto-population with typing animation
      if (data.shouldAnimateName && data.suggestedName) {
        await animateTypingIntoField(data.suggestedName, 'name');
      }
      
      if (data.shouldAnimateDescription && data.suggestedDescription) {
        await animateTypingIntoField(data.suggestedDescription, 'description');
      }
    } else {
      throw new Error(data.error || 'Invalid response from AI');
    }

  } catch (error) {
    console.error('Error sending chat message:', error);
    // Add error message to conversation
    const errorProgrammingMessage: ProgrammingChatMessage = {
      id: generateId(),
      role: 'assistant',
      message: 'I apologize, but I encountered an error. Please try again.',
      timestamp: new Date()
    };
    
    // Fix: Don't use a function, just spread the current array
    const errorHistory = [...programmingConversationHistory, errorProgrammingMessage];
    setProgrammingConversationHistory(errorHistory);
  } finally {
    setIsAIResponding(false);
  }
};

    const generalAiPreferencesOptions = [
      "Exclusive to selected creators",
      "Use stacks I've created/saved in my library",
      // "Create unique stacks for each day." - REMOVED to prevent data explosion
    ];

    const [aiPromptText, setAiPromptText] = useState('');

    // Adjusted activeTab state and type
    const [activeTab, setActiveTab] = useState<'moves' | 'creators'>('moves'); 
    const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
    const [movesTabSelectedCreatorIds, setMovesTabSelectedCreatorIds] = useState<string[]>([]);
    const [selectedMoves, setSelectedMoves] = useState<Exercise[]>([]);
    const [allExercises, setAllExercises] = useState<Exercise[]>([]);
    const [movesSearchTerm, setMovesSearchTerm] = useState(''); // New state for moves search
    const [isGeneralPreferencesCollapsed, setIsGeneralPreferencesCollapsed] = useState(false); // New state for collapsible section

    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Add state to track if this is a regeneration scenario
    const [isRegenerationMode, setIsRegenerationMode] = useState(false);

      const router = useRouter();

  // Helper function to detect if user has already generated workouts (has stacks)
  const hasExistingGeneration = (): boolean => {
    return selectedStacks.length > 0;
  };

  // Helper function to determine if user is attempting regeneration
  const detectRegenerationAttempt = (): boolean => {
    return hasExistingGeneration();
  };

  // Update regeneration mode when selectedStacks changes
  useEffect(() => {
    setIsRegenerationMode(detectRegenerationAttempt());
  }, [selectedStacks]);

  // Helper function to delete old sweatlist records from database
  const deleteOldSweatlistRecords = async (sweatlistIds: string[]) => {
    if (sweatlistIds.length === 0) return;
    
    console.log('🗑️ Deleting old sweatlist records from user collection:', sweatlistIds);
    try {
      // Delete sweatlist records in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < sweatlistIds.length; i += batchSize) {
        const batch = sweatlistIds.slice(i, i + batchSize);
        const deletePromises = batch.map(async (sweatlistId) => {
          try {
            if (!currentUser?.id) {
              console.warn(`⚠️ No current user ID for deleting sweatlist record ${sweatlistId}`);
              return;
            }
            
            // Delete from user's MyCreatedWorkouts collection
            // This will trigger our sync function to also delete from global stacks collection
            const stackRef = doc(db, 'users', currentUser.id, 'MyCreatedWorkouts', sweatlistId);
            await deleteDoc(stackRef);
            console.log(`✅ Deleted sweatlist record: ${sweatlistId}`);
          } catch (error) {
            console.warn(`⚠️ Could not delete sweatlist record ${sweatlistId}:`, error);
            // Don't throw here, continue with other deletions
          }
        });
        await Promise.allSettled(deletePromises);
      }
      console.log('✅ Finished deleting old sweatlist records');
    } catch (error) {
      console.error('❌ Error during batch deletion of sweatlist records:', error);
      // Don't throw - regeneration should continue even if cleanup fails
    }
  };
  
  const filteredStacks = allStacks.filter((stack: Workout) =>
    stack.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

    const filteredStacksList = () => (
        <div className="space-y-4">
          {filteredStacks.map((stack: Workout) => (
            <div key={stack.id} className="border border-zinc-700/50 rounded-lg">
            <StackCard
                key={stack.id} 
                workout={stack} 
                gifUrls={stack.exercises?.map((ex: any) => ex.exercise?.videos?.[0]?.gifURL || '') || []}
                isChallengeEnabled={false}
                onPrimaryAction={() => handleStackSelect(stack)}
            />
            </div>
            ))}
        </div>
      );

    useEffect(() => {
        const fetchData = async () => {
            try {
            await exerciseService.fetchExercises();
            setAllExercises(exerciseService.allExercises);
            } catch (error) {
            console.error('Error fetching exercises:', error);
            }
        };
        fetchData();
    }, []);
  
    useEffect(() => {
      const fetchStacks = async () => {
        try {
          const stacks = await userService.fetchUserStacks();
          setAllStacks(stacks);
        } catch (error) {
          console.error('Error fetching stacks:', error);
        }
      };
      fetchStacks();
    }, []);

    // Load all users for tagging functionality
    useEffect(() => {
      const fetchUsers = async () => {
        try {
          const users = await userService.getAllUsers();
          setAllUsers(users);
        } catch (error) {
          console.error('❌ Error fetching users:', error);
          setAllUsers([]);
        }
      };
      fetchUsers();
    }, []);

    // Handle @ symbol detection and user search
    const handlePromptTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      const cursorPos = e.target.selectionStart;
      
      setAiPromptText(text);
      setCursorPosition(cursorPos);
    
      // Match the chars right before the caret that start with "@"
      const mentionMatch = /@([^\s@]{0,20})$/.exec(text.slice(0, cursorPos));
    
      if (mentionMatch) {
        setUserSearchTerm(mentionMatch[1]);   // part after the "@"
        setShowUserDropdown(true);
      } else {
        setShowUserDropdown(false);
      }
    };

    // Filter users based on search term
    const filteredUsers = allUsers.filter(user => 
      (user.displayName.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
       user.username.toLowerCase().includes(userSearchTerm.toLowerCase())) && 
      !taggedUsers.some(tagged => tagged.id === user.id)
    );

    // Handle user selection from dropdown
    const handleUserSelect = (user: User) => {
      const textBeforeCursor = aiPromptText.substring(0, cursorPosition);
      const textAfterCursor = aiPromptText.substring(cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtIndex !== -1) {
        const beforeAt = textBeforeCursor.substring(0, lastAtIndex);
        const displayName = user.displayName || user.username;
        const newText = `${beforeAt}@${displayName} ${textAfterCursor}`;
        
        setAiPromptText(newText);
        setTaggedUsers(prev => [...prev, user]);
        setShowUserDropdown(false);
        setUserSearchTerm('');
        
        // Update cursor position to after the inserted name
        const newCursorPosition = beforeAt.length + displayName.length + 2; // +2 for "@" and space
        setCursorPosition(newCursorPosition);
      }
    };

    // Remove tagged user
    const handleRemoveTaggedUser = (userId: string) => {
      setTaggedUsers(prev => prev.filter(user => user.id !== userId));
      
      // Also remove from prompt text
      const userToRemove = allUsers.find(u => u.id === userId);
      if (userToRemove) {
        const displayName = userToRemove.displayName || userToRemove.username;
        const updatedText = aiPromptText.replace(new RegExp(`@${displayName}\\s?`, 'g'), '');
        setAiPromptText(updatedText);
      }
    };

  // Updated Filter for Must-Have Moves
  const filteredExercisesForSelection = allExercises
    .filter((exercise) => { // Creator filter first (if active)
      if (movesTabSelectedCreatorIds.length > 0) {
        return exercise.videos?.some(video => movesTabSelectedCreatorIds.includes(video.userId));
      }
      return true; // No creator filter active for moves tab, include all for name search
    })
    .filter((exercise) => // Then name filter
      exercise.name.toLowerCase().includes(movesSearchTerm.toLowerCase())
    );

  const handleLocalSetChallengeData = (partialData: Partial<ChallengeData>) => {
    // Ensure any dates are properly converted, but don't double-convert valid Date objects
    const processedData = { ...partialData };
    if (processedData.startDate && !(processedData.startDate instanceof Date && !isNaN(processedData.startDate.getTime()))) {
      processedData.startDate = convertFirestoreTimestamp(processedData.startDate);
    }
    if (processedData.endDate && !(processedData.endDate instanceof Date && !isNaN(processedData.endDate.getTime()))) {
      processedData.endDate = convertFirestoreTimestamp(processedData.endDate);
    }
    setChallengeData({ ...challengeData, ...processedData });
  };

  // Helper function to update macro ranges safely
  const updateMacroRange = (
    macroType: 'calorieRange' | 'proteinRange' | 'carbRange' | 'fatRange',
    property: 'min' | 'max',
    value: number
  ) => {
    const defaultRanges = {
      calorieRange: { min: 1800, max: 2200 },
      proteinRange: { min: 120, max: 180 },
      carbRange: { min: 200, max: 300 },
      fatRange: { min: 60, max: 100 }
    };
    
    const currentRanges = challengeData.mealTracking?.customMacroRanges || defaultRanges;
    const currentRange = currentRanges[macroType] || defaultRanges[macroType];
    
    const newRanges = {
      ...currentRanges,
      [macroType]: { ...currentRange, [property]: value }
    };
    
    handleLocalSetChallengeData({
      mealTracking: { ...challengeData.mealTracking!, customMacroRanges: newRanges }
    });
  };

  const handleStackSelect = (stack: Workout) => { 
    setSelectedStacks((prev: WorkoutWithRoundId[]) => {
      if (prev.some(s => s.id === stack.id)) {
        const sameStacks = prev.filter(s => s.id === stack.id);
        const newStack = new WorkoutWithRoundId(stack, `${stack.id}-${sameStacks.length + 1}`);
        return [...prev, newStack];
      } else {
        const newStack = new WorkoutWithRoundId(stack, stack.id);
        return [...prev, newStack];
      }
    });
  };

  const handleRemoveStack = (stackIdToRemove: string) => { 
    setSelectedStacks((prev: WorkoutWithRoundId[]) => {
      const updatedStacks = prev.filter(s => s.roundWorkoutId !== stackIdToRemove);
      return updatedStacks.map(s => new WorkoutWithRoundId(s, s.roundWorkoutId)); 
    });
  };

  const validateChallengeInput = (): boolean => {

    if (challengeData.challengeName.trim().length === 0) {
      return false;
    }
    if (challengeData.challengeDesc.trim().length === 0) {
      return false;
    }
    if (challengeData.endDate <= challengeData.startDate) {
      return false;
    }
    if (challengeData.roundType === SweatlistType.locked && challengeData.pinCode.length !== 9) {
      return false;
    }
    if (!isAIMode && selectedStacks.length === 0) { // Only check selectedStacks if not in AI mode
      return false;
    }
    return true;
  };

  // Quiet version of validation for internal checks (no console logging)
  const validateChallengeInputQuiet = (forReadyToGenerate: boolean = false): boolean => {
    if (challengeData.challengeName.trim().length === 0) {
      console.log('🔍 [DEBUG] Validation failed: challengeName is empty');
      return false;
    }
    if (challengeData.challengeDesc.trim().length === 0) {
      console.log('🔍 [DEBUG] Validation failed: challengeDesc is empty');
      return false;
    }
    // Check if dates are valid Date objects first
    const isValidStartDate = challengeData.startDate instanceof Date && !isNaN(challengeData.startDate.getTime());
    const isValidEndDate = challengeData.endDate instanceof Date && !isNaN(challengeData.endDate.getTime());
    
    if (!isValidStartDate || !isValidEndDate) {
      // For readyToGenerate case, allow invalid dates since AI will handle them
      if (forReadyToGenerate) {
        return true;
      }
      return false;
    }
    
    if (challengeData.endDate <= challengeData.startDate) {
      // For readyToGenerate case, allow even if dates are equal (AI will fix them)
      if (forReadyToGenerate) {
        return true;
      }
      return false;
    }
    if (challengeData.roundType === SweatlistType.locked && challengeData.pinCode.length !== 9) {
      console.log('🔍 [DEBUG] Validation failed: locked type but pinCode not 9 chars');
      return false;
    }
    if (!isAIMode && selectedStacks.length === 0) {
      console.log('🔍 [DEBUG] Validation failed: not AI mode but no stacks selected');
      return false;
    }
    console.log('✅ [DEBUG] Validation passed!');
    return true;
  };

  const enrichExerciseData = (
    exerciseData: any,
    allExercises: Exercise[],
    creatorExercises: Exercise[],
    useOnlyCreatorExercises: boolean
  ): ExerciseDetail | null => {
    const exercisePool = useOnlyCreatorExercises ? creatorExercises : allExercises;
    
    const baseExercise = exercisePool.find(ex => 
      ex.name.toLowerCase() === exerciseData.name.toLowerCase()
    );
  
    if (!baseExercise) return null;

    // Parse AI-generated exercise data which can have various formats
    const parseExerciseData = (category: any) => {
      // Handle different AI response formats
      let duration = 60; // default
      let sets = 3; // default
      let reps = ['10']; // default

      // Handle category.reps - can be array or string
      if (category.reps) {
        if (Array.isArray(category.reps)) {
          // New format: array of rep counts ["12", "10", "8"]
          reps = category.reps;
          sets = category.sets || reps.length;
          
          // Check if any reps contain time indicators
          const hasTimeReps = reps.some((rep: string) => /seconds?|mins?|minutes?/i.test(rep));
          if (hasTimeReps) {
            // Extract duration from first time-based rep
            const timeRep = reps.find((rep: string) => /seconds?/i.test(rep));
            if (timeRep) {
              const timeMatch = timeRep.match(/(\d+)\s*seconds?/i);
              if (timeMatch) {
                duration = parseInt(timeMatch[1]);
              }
            }
          }
        } else {
          // Legacy format: string like "3 sets of 30 seconds"
          const repsStr = category.reps;
          const timeMatch = repsStr.match(/(\d+)\s*seconds?/i);
          if (timeMatch) {
            duration = parseInt(timeMatch[1]);
          }
          const setsMatch = repsStr.match(/(\d+)\s*sets?/i);
          if (setsMatch) {
            sets = parseInt(setsMatch[1]);
          }
          const repsMatch = repsStr.match(/(\d+)\s*reps?/i);
          if (repsMatch && !timeMatch) {
            reps = [repsMatch[1]];
          }
        }
      }

      // Format 2: category.defaultTimeSec/defaultTimeSeconds
      if (category.defaultTimeSec) {
        duration = category.defaultTimeSec;
      }
      if (category.defaultTimeSeconds) {
        duration = category.defaultTimeSeconds;
      }

      // Format 3: category.sets or category.defaultSets
      if (category.sets) {
        sets = category.sets;
      } else if (category.defaultSets) {
        sets = category.defaultSets;
      }

      // Format 4: category.defaultReps
      if (category.defaultReps) {
        reps = [category.defaultReps.toString()];
      }

      return { duration, sets, reps };
    };

    const parsedData = parseExerciseData(exerciseData.category);

    // Determine if it's a time-based exercise (cardio/plank) or rep-based (strength)
    const hasTimeBasedReps = Array.isArray(exerciseData.category.reps) 
      ? exerciseData.category.reps.some((rep: string) => /seconds?|mins?|minutes?/i.test(rep))
      : (exerciseData.category.reps && exerciseData.category.reps.includes('seconds'));
      
    const isTimeBased = exerciseData.name.toLowerCase().includes('plank') || 
                       exerciseData.name.toLowerCase().includes('jumping jacks') ||
                       exerciseData.name.toLowerCase().includes('mountain climbers') ||
                       hasTimeBasedReps;

    const category = isTimeBased
      ? ExerciseCategory.cardio({
          duration: parsedData.duration,
          bpm: 0,
          calories: 0,
          screenTime: parsedData.duration,
          selectedVideo: baseExercise.videos?.[0] || null
        })
      : ExerciseCategory.weightTraining({
          reps: parsedData.reps,
          sets: parsedData.sets,
          weight: 0,
          screenTime: 60,
          selectedVideo: baseExercise.videos?.[0] || null
        });
  
    return new ExerciseDetail({
      id: generateId(),
      exercise: baseExercise,
      exerciseName: exerciseData.name,
      isMissing: false,
      groupId: 0,
      category: category,
      notes: '',
      isSplit: false,
      closestMatch: []
    });
  };

  const filterExercisesByCreators = (exercises: Exercise[], selectedCreatorIds: string[]) => {
    return exercises.filter(exercise => 
      exercise.videos?.some(video => selectedCreatorIds.includes(video.userId))
    );
  };

  // Helper function to calculate total days between two dates
  const calculateTotalDays = (startDate: Date, endDate: Date): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Set hours to 0 to avoid DST issues affecting day count
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    // Check for invalid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("Invalid start or end date provided.");
    }
    if (end < start) {
        throw new Error("End date cannot be before start date.");
    }

    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
    
    return daysDiff;
  };

  // Helper function to validate and fix challenge stack counts
  const validateAndFixSweatlistIds = (challenge: any): { sweatlistIds: any[], workoutIdList: string[] } => {
    if (!challenge.startDate || !challenge.endDate) {
      console.warn('Challenge missing start/end dates, cannot validate');
      return { sweatlistIds: challenge.sweatlistIds || [], workoutIdList: challenge.workoutIdList || [] };
    }

    const totalDays = calculateTotalDays(new Date(challenge.startDate), new Date(challenge.endDate));
    const currentSweatlistIds = challenge.sweatlistIds || [];
    
    if (currentSweatlistIds.length <= totalDays) {
      // No issue, return as-is
      return { 
        sweatlistIds: currentSweatlistIds, 
        workoutIdList: currentSweatlistIds.map((item: any) => item.id) 
      };
    }

    console.warn(`🔧 Challenge has ${currentSweatlistIds.length} stacks but only ${totalDays} days. Trimming excess.`);
    
    // Keep the first N stacks that match the total days
    const validSweatlistIds = currentSweatlistIds.slice(0, totalDays);
    const validWorkoutIdList = validSweatlistIds.map((item: any) => item.id);
    
    return { sweatlistIds: validSweatlistIds, workoutIdList: validWorkoutIdList };
  };

  const handleGenerateAIRound = async () => {
    // Prevent generation while conversation is loading to avoid race condition with dates
    if (isLoadingConversation) {
      console.warn('⏳ Cannot generate while conversation is loading');
      return;
    }
    
    // Set loading state IMMEDIATELY to prevent double clicks
    if (isGenerating) {
      return;
    }

    // Log if this is a regeneration attempt
    if (isRegenerationMode) {
      console.log('🔄 Regeneration detected - user has existing stacks:', selectedStacks.length);
      console.log('🔍 DEBUG: Current selectedExistingChallenge state:', selectedExistingChallenge);
      console.log('🔍 DEBUG: selectedExistingChallenge ID:', selectedExistingChallenge?.id || 'NO ID FOUND');
      console.log('🔄 DEBUG: Will generate new stacks first, then clear existing ones to ensure safety');
    } else {
      console.log('✨ Initial generation - no existing stacks');
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const validationPassed = validateChallengeInput();
      
      if (!validationPassed) {
        setIsGenerating(false);
        return;
      }
      
      // --- NEW: clean up old auto-generated stacks for this round ---
      if (selectedExistingChallenge && currentUser?.id) {
        try {
          const allStacks = await userService.fetchUserStacks(currentUser.id);
          const stacksToDelete = allStacks.filter(
            s => s.autoGenerated && s.sourceRoundId === selectedExistingChallenge.id
          );
          for (const stack of stacksToDelete) {
            await userService.deleteStack(stack.id);
          }
        } catch (cleanupErr) {
          console.warn('Cleanup failed – proceeding anyway:', cleanupErr);
        }
      }
      // -----------------------------------------------------------
  
      const currentRestPrefs = challengeData.restDayPreferences || { includeRestDays: false, restDays: [], preferences: [] };
          // "Create unique stacks for each day." option is deprecated to prevent data explosion
    const uniqueStacksPerDay = false;
    let numberOfUniqueStacks: number | null = null;
      let effectiveSelectedRestDays: string[] = [];

      if (currentRestPrefs.includeRestDays) {
        effectiveSelectedRestDays = currentRestPrefs.restDays;
      }

      // Calculate the total days for the challenge using validated dates
      const start = convertFirestoreTimestamp(challengeData.startDate);
      const end = convertFirestoreTimestamp(challengeData.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      
      const timeDiff = end.getTime() - start.getTime();
      const totalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
      
      
      // Always use autofill pattern for challenges with rest days (like ChallengeDetailView)
      // Generate unique workout stacks and let frontend handle autofill across all days
      if (selectedExistingChallenge) {
        // For existing rounds, generate a limited set to add
        numberOfUniqueStacks = Math.max(1, 7 - effectiveSelectedRestDays.length);
      } else if (!uniqueStacksPerDay && currentRestPrefs.includeRestDays) {
        numberOfUniqueStacks = Math.max(1, 7 - effectiveSelectedRestDays.length);
      } else if (!uniqueStacksPerDay) {
        numberOfUniqueStacks = 7;
      }
      
      // Absolute safety cap: never generate > 14 unique stacks (2 weeks max)
      if (numberOfUniqueStacks && numberOfUniqueStacks > 14) {
        numberOfUniqueStacks = 14;
      }
      

      let availableExercisesForAPI = allExercises;
      let creatorFilteredExercises = allExercises;
      const useCreatorExclusive = currentRestPrefs.preferences.includes("Exclusive to selected creators");

      if (useCreatorExclusive && selectedCreators.length > 0) {
        creatorFilteredExercises = filterExercisesByCreators(allExercises, selectedCreators);
        if (creatorFilteredExercises.length === 0) {
            throw new Error("No exercises found from selected creators. Please select different creators or disable the 'Exclusive to selected creators' preference.");
        }
        availableExercisesForAPI = creatorFilteredExercises;
      }
      
      const userSelectedPreferencesForAPI = currentRestPrefs.preferences.filter(p => !p.startsWith('Schedule rest days'));


      // Create comprehensive prompt from conversation or fallback to aiPromptText
      let comprehensivePrompt = '';
      if (finalPrompt) {
        // Use the refined final prompt from chatbot
        comprehensivePrompt = finalPrompt;
      } else if (chatMessages.length > 0) {
        // Build prompt from conversation
        comprehensivePrompt = 'CONVERSATION SUMMARY:\n';
        chatMessages.forEach((msg) => {
          comprehensivePrompt += `${msg.role === 'user' ? 'Coach' : 'AI'}: ${msg.content}\n`;
        });
        
        // Add tagged users context
        if (taggedUsers.length > 0) {
          comprehensivePrompt += '\nCLIENT PROFILES:\n';
          taggedUsers.forEach((user) => {
            const userDataCard = convertUserToDataCard(user);
            comprehensivePrompt += `${userDataCard.name}: ${userDataCard.toAIContext()}\n`;
          });
        }
      } else {
        // Fallback to original prompt if no conversation
        comprehensivePrompt = aiPromptText || 'Create a personalized training program based on the selected configuration.';
        
        // Add tagged users context even for direct generation
        if (taggedUsers.length > 0) {
          comprehensivePrompt += '\n\nCLIENT PROFILES:\n';
          taggedUsers.forEach((user) => {
            const userDataCard = convertUserToDataCard(user);
            comprehensivePrompt += `${userDataCard.name}: ${userDataCard.toAIContext()}\n`;
          });
        }
      }

      // Log the final prompt that will be sent to AI generation

      // Ensure dates are valid and properly formatted as Unix timestamps (to match iOS format)
      
      const validStartDate = convertFirestoreTimestamp(challengeData.startDate);
      const validEndDate = convertFirestoreTimestamp(challengeData.endDate);
      
      
      // Convert to Unix timestamps (seconds since epoch) to match iOS timeIntervalSince1970
      const startDateUnix = Math.floor(validStartDate.getTime() / 1000);
      const endDateUnix = Math.floor(validEndDate.getTime() / 1000);
      
      

      // Prepare existing stacks data if we're modifying an existing round
      const existingStacksData = selectedExistingChallenge && selectedStacks.length > 0 
        ? selectedStacks.map(stack => ({
            title: stack.title,
            description: stack.description || '',
            exercises: stack.exercises?.map(ex => ({
              name: ex.exercise?.name || '',
              category: ex.exercise || {}
            })) || []
          }))
        : [];

      const response = await fetch('/api/generateRound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mustIncludeExercises: selectedMoves.map(move => move.name),
          userPrompt: comprehensivePrompt,
          preferences: userSelectedPreferencesForAPI, 
          availableExercises: availableExercisesForAPI.map(ex => ex.name), 
          startDate: startDateUnix,
          endDate: endDateUnix,
          numberOfUniqueStacks: numberOfUniqueStacks, 
          selectedRestDays: effectiveSelectedRestDays,
          // Equipment preferences for AI consideration
          equipmentPreferences: challengeData.equipmentPreferences || { selectedEquipment: [], equipmentOnly: false },
          // Additional context for better generation
          taggedUsers: taggedUsers,
          conversationHistory: chatMessages,
          // Existing round modification support
          existingStacks: existingStacksData,
          modifyExisting: selectedExistingChallenge ? true : false
        }),
      });


      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error('Failed to generate workout round');
      }
  
      const generatedResponse = await response.json();
      
      const generatedRound = generatedResponse.choices[0].message.content;

      let cleanedResponse = generatedRound
        .replace(/^```json\n/, '')
        .replace(/\n```$/, '')
        .trim();


      let parsedRound;
      try {
        parsedRound = JSON.parse(cleanedResponse);
        
        // AI thinking will be passed directly to success modal
      } catch (error) {
        console.error('❌ Error parsing AI response:', error);
        throw new Error('Failed to parse AI response');
      }
  
      const createdStacks = [];
      const workoutStacks = []; // Separate workout stacks from rest days
      const _restDayTemplate = {
        title: "Rest",
        description: "Recovery day",
        exercises: []
      };

      // Use uniqueStacks if available (contains the generated workout stacks),
      // otherwise fall back to stacks (for backward compatibility)
      const stacksToProcess = parsedRound.uniqueStacks || parsedRound.stacks;
      console.log(`🔄 Processing ${stacksToProcess.length} stacks for modal display`);

      // First pass: Create actual workout stacks and collect workout patterns
      for (const stackData of stacksToProcess) {
        if (stackData.title.toLowerCase() === "rest") {
          // Skip rest days in first pass - we'll handle them in autofill
          continue;
        }

        try {
          // Use the same exercise pool that was sent to the AI for consistency
          
          const enrichedExercises = stackData.exercises
            .map((ex: ExerciseReference, index: number) => {
              try {
                const result = enrichExerciseData(ex, availableExercisesForAPI, availableExercisesForAPI, true);
                if (result) {
                } else {
                  console.warn(`❌ Exercise ${index + 1}: "${(ex as any)?.name}" not found in available exercises pool`);
                }
                return result;
              } catch (error) {
                console.warn(`❌ Exercise ${index + 1}: "${(ex as any)?.name}" failed with error: ${error}`); 
                return null;
              }
            })
            .filter((exercise: ExerciseDetail | null): exercise is ExerciseDetail => exercise !== null);

          if (enrichedExercises.length > 0) {
            const { workout, exerciseLogs } = await workoutService.formatWorkoutAndInitializeLogs(
              enrichedExercises,
              currentUser?.id
            );

            workout.title = stackData.title;
            workout.description = `${stackData.description} (${enrichedExercises.length} exercises)`;

            // --- NEW PROVENANCE FLAGS ---
            workout.autoGenerated = true;
            workout.sourceRoundId = selectedExistingChallenge
              ? selectedExistingChallenge.id
              : null;
            // --------------------------------

            const createdStack = await userService.createStack(workout, exerciseLogs);
            
            if (createdStack) {
              createdStacks.push(createdStack);
              workoutStacks.push({
                id: createdStack.id,
                title: createdStack.title,
                authorId: currentUser?.id || ''
              });
            }
          }
        } catch (error) {
          console.error('Error creating stack:', stackData.title, error);
          continue;
        }
      }

      // Second pass: Create autofill sweatlistIds array that cycles workouts across all days
      
      const sweatlistIds = [];
      const restDayIndices = effectiveSelectedRestDays.map(day => {
        const dayMapping = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        return dayMapping[day as keyof typeof dayMapping];
      }).filter((index): index is number => index !== undefined);
      
      let workoutIndex = 0;
      const challengeStartDate = new Date(challengeData.startDate);
      
      for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
        const currentDate = new Date(challengeStartDate);
        currentDate.setDate(challengeStartDate.getDate() + dayIndex);
        const dayOfWeek = currentDate.getDay();
        
        if (restDayIndices.includes(dayOfWeek)) {
          // Add rest day
          sweatlistIds.push(new SweatlistIdentifiers({
            id: "rest-" + generateId(),
            sweatlistAuthorId: currentUser?.id || '',
            sweatlistName: "Rest",
            order: dayIndex + 1,
            isRest: true
          }));
        } else if (workoutStacks.length > 0) {
          // Add workout (cycle through available workouts)
          const workout = workoutStacks[workoutIndex % workoutStacks.length];
          sweatlistIds.push(new SweatlistIdentifiers({
            id: workout.id,
            sweatlistAuthorId: workout.authorId,
            sweatlistName: workout.title,
            order: dayIndex + 1,
            isRest: false
          }));
          workoutIndex++;
        } else {
          // Fallback rest day if no workouts available
          sweatlistIds.push(new SweatlistIdentifiers({
            id: "rest-" + generateId(),
            sweatlistAuthorId: currentUser?.id || '',
            sweatlistName: "Rest",
            order: dayIndex + 1,
            isRest: true
          }));
        }
      }


      if (createdStacks.length === 0 && !sweatlistIds.some(id => id.isRest)) {
        throw new Error('No stacks or rest days were successfully created');
      }
      
      console.log('✅ AI Generation successful - created', createdStacks.length, 'stacks');
  
      // NOW CLEAR EXISTING STACKS FOR REGENERATION (only after successful generation)
      if (isRegenerationMode && selectedExistingChallenge) {
        console.log('🧹 DEBUG: Generation successful - now clearing existing stacks before adding new ones...');
        console.log('🔍 DEBUG: Challenge ID to clear:', selectedExistingChallenge.id);
        
        try {
          // Get current data before clearing for cleanup tracking
          const originalCollection = originalCollections.find((c: any) => c.id === selectedExistingChallenge.id);
          console.log('🔍 DEBUG: Current sweatlistIds count:', originalCollection?.sweatlistIds?.length || 0);
          console.log('🔍 DEBUG: Current workoutIdList count:', originalCollection?.workoutIdList?.length || 0);
          
          const oldSweatlistIds = originalCollection?.sweatlistIds?.map((item: any) => item.id) || [];
          
          console.log('🧹 DEBUG: About to call clearAllStacksFromRound with ID:', selectedExistingChallenge.id);
          await workoutService.clearAllStacksFromRound(selectedExistingChallenge.id);
          console.log('✅ DEBUG: Successfully cleared existing stacks after confirming new generation');
          
          // Schedule cleanup of old sweatlist records
          if (oldSweatlistIds.length > 0) {
            deleteOldSweatlistRecords(oldSweatlistIds);
          }
          
        } catch (error) {
          console.error('❌ Error clearing existing stacks after generation:', error);
          setError('New workouts generated but failed to clear old ones. Please try regenerating again.');
          setIsGenerating(false);
          return;
        }
      }
  
      if (!currentUser?.id) {
        throw new Error("No user logged in");
      }

      let updatedCollection;

      // Check if we're adding to an existing round or creating a new one
      if (selectedExistingChallenge) {
        
        // Find the original collection from our stored data
        const originalCollection = originalCollections.find((c: any) => c.id === selectedExistingChallenge.id);
        
        if (!originalCollection) {
          throw new Error('Could not find the original collection data');
        }

        // CRITICAL FIX: Replace ALL sweatlistIds with the new autofill pattern
        // This ensures the challenge never exceeds the calculated total days
        
        // Validate that we don't exceed total days
        let finalSweatlistIds = sweatlistIds;
        if (finalSweatlistIds.length > totalDays) {
          console.warn(`⚠️ Generated ${finalSweatlistIds.length} sweatlistIds exceeds ${totalDays} total days. Trimming to fit.`);
          finalSweatlistIds = finalSweatlistIds.slice(0, totalDays);
        }

        // Use the complete autofill pattern instead of appending
        const combinedSweatlistIds = finalSweatlistIds;

        // Update the existing collection with new stacks
        const updatedCollectionData = {
          ...originalCollection,
          sweatlistIds: combinedSweatlistIds,
          workoutIdList: combinedSweatlistIds.map(item => item.id), // Update workoutIdList to match
          updatedAt: new Date(),
          // Update other fields if they were modified in the form
          title: challengeData.challengeName,
          subtitle: challengeData.challengeDesc,
          pin: challengeData.pinCode,
          privacy: challengeData.roundType,
          challenge: {
            ...originalCollection.challenge,
            title: challengeData.challengeName,
            subtitle: challengeData.challengeDesc,
            startDate: challengeData.startDate,
            endDate: challengeData.endDate,
            updatedAt: new Date(),
            mealTracking: challengeData.mealTracking || originalCollection.challenge?.mealTracking
          }
        };

        const collectionToUpdate = new SweatlistCollection(updatedCollectionData);
        updatedCollection = await workoutService.updateCollection(collectionToUpdate);
        
      } else {
        
        // Create new round (existing logic)
        const createdAt = new Date();
        
        const challenge = new Challenge({
          id: "",
          title: challengeData.challengeName,
          subtitle: challengeData.challengeDesc,
          participants: [],
          status: ChallengeStatus.Draft, 
          startDate: challengeData.startDate,
          endDate: challengeData.endDate,
          createdAt,
          updatedAt: createdAt,
          ownerId: [currentUser?.id || ''],
          mealTracking: challengeData.mealTracking
        });
    
        // Validate that new collection doesn't exceed total days
        let finalSweatlistIdsForNew = sweatlistIds;
        if (finalSweatlistIdsForNew.length > totalDays) {
          console.warn(`⚠️ New collection has ${finalSweatlistIdsForNew.length} sweatlistIds but only ${totalDays} total days. Trimming to fit.`);
          finalSweatlistIdsForNew = finalSweatlistIdsForNew.slice(0, totalDays);
        }

        const collection = new SweatlistCollection({
          id: "",
          title: challengeData.challengeName,
          subtitle: challengeData.challengeDesc,
          pin: challengeData.pinCode,
          challenge,
          sweatlistIds: finalSweatlistIdsForNew,
          ownerId: [currentUser?.id || ''],
          participants: [],
          privacy: challengeData.roundType,
          createdAt,
          updatedAt: createdAt
        });
    
        updatedCollection = await workoutService.updateCollection(collection);
      }
      
      if (updatedCollection) {
        // Update challenge data with the actual challenge ID from the created/updated collection
        const updatedChallengeDataWithId = {
          ...challengeData,
          challengeId: updatedCollection.id
        };
        
        // Update the challenge data state with the ID
        setChallengeData(updatedChallengeDataWithId);
        
        // Convert created stacks to WorkoutWithRoundId format for display
        const stacksForDisplay = createdStacks.map((stack, index) => 
          new WorkoutWithRoundId(stack, `${stack.id}-${index}`)
        );
        
        // Update selectedStacks state to reflect the new stacks
        if (selectedExistingChallenge) {
          // For existing rounds, add new stacks to existing ones
          setSelectedStacks(prev => {
            const newStacks = [...prev, ...stacksForDisplay];
            // Auto-save the updated stacks and challenge data with ID if we have a conversation
            if (currentConversationId && autoSave) {
              autoSave({ 
                selectedStacks: newStacks,
                challengeData: updatedChallengeDataWithId,
                updatedAt: new Date()
              });
            }
            return newStacks;
          });
        } else {
          // For new rounds, replace with new stacks
          setSelectedStacks(stacksForDisplay);
          // Auto-save the new stacks and challenge data with ID if we have a conversation
          if (currentConversationId && autoSave) {
            autoSave({ 
              selectedStacks: stacksForDisplay,
              challengeData: updatedChallengeDataWithId,
              updatedAt: new Date()
            });
          }
        }
        
        // Show success modal instead of redirecting
        const isUpdate = !!selectedExistingChallenge;
        const isRegeneration = isRegenerationMode && selectedExistingChallenge;
        
        if (isRegeneration) {
          console.log('🎉 DEBUG: Regeneration completed successfully!');
          console.log('📊 DEBUG: New stacks generated:', stacksForDisplay.length);
        }
        
        handleShowSuccessModal(updatedCollection, stacksForDisplay, isUpdate, parsedRound.thinking);
      }
  
    } catch (error) {
      console.error('Error in handleGenerateAIRound:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate workout round';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateRound = async () => {
    if (!validateChallengeInput()) return;
  
    try {
      if (!currentUser?.id) {
        throw new Error("No user logged in");
      }

      console.log('✅ Manual stacks ready for round creation:', selectedStacks.length, 'stacks');

      // NOW CLEAR EXISTING STACKS FOR MANUAL REGENERATION (only after confirming we have new stacks)
      if (isRegenerationMode && selectedExistingChallenge) {
        console.log('🧹 DEBUG: Manual stacks confirmed - now clearing existing stacks before adding new ones...');
        console.log('🔍 DEBUG: Challenge ID to clear:', selectedExistingChallenge.id);
        
        try {
          // Get current data before clearing for cleanup tracking
          const originalCollection = originalCollections.find((c: any) => c.id === selectedExistingChallenge.id);
          console.log('🔍 DEBUG: Current sweatlistIds count:', originalCollection?.sweatlistIds?.length || 0);
          console.log('🔍 DEBUG: Current workoutIdList count:', originalCollection?.workoutIdList?.length || 0);
          
          const oldSweatlistIds = originalCollection?.sweatlistIds?.map((item: any) => item.id) || [];
          
          console.log('🧹 DEBUG: About to call clearAllStacksFromRound with ID:', selectedExistingChallenge.id);
          await workoutService.clearAllStacksFromRound(selectedExistingChallenge.id);
          console.log('✅ DEBUG: Successfully cleared existing stacks after confirming manual stacks');
          
          // Schedule cleanup of old sweatlist records
          if (oldSweatlistIds.length > 0) {
            deleteOldSweatlistRecords(oldSweatlistIds);
          }
          
        } catch (error) {
          console.error('❌ Error clearing existing stacks after manual validation:', error);
          setError('Manual stacks ready but failed to clear old ones. Please try again.');
          return;
        }
      }

      let updatedCollection;

      // Check if we're adding to an existing round or creating a new one
      if (selectedExistingChallenge) {
        
        // Find the original collection from our stored data
        const originalCollection = originalCollections.find((c: any) => c.id === selectedExistingChallenge.id);
        
        if (!originalCollection) {
          throw new Error('Could not find the original collection data');
        }

        // Get the current highest order number from existing stacks
        const currentMaxOrder = Math.max(
          0, 
          ...(originalCollection.sweatlistIds || []).map((id: any) => id.order || 0)
        );

        // Create SweatlistIdentifiers for manually selected stacks
        const newSweatlistIds = selectedStacks.map((stack, index) => ({
          id: stack.id,
          sweatlistAuthorId: currentUser?.id || '',
          sweatlistName: stack.title,
          order: currentMaxOrder + index + 1,
          isRest: false, // Manual stacks are not rest days
        }));

        // Combine existing stacks with new ones (or replace if regenerating)
        const combinedSweatlistIds = isRegenerationMode 
          ? newSweatlistIds // Replace all stacks during regeneration
          : [
              ...(originalCollection.sweatlistIds || []),
              ...newSweatlistIds
            ];

        // Update the existing collection with new stacks
        const updatedCollectionData = {
          ...originalCollection,
          sweatlistIds: combinedSweatlistIds,
          workoutIdList: combinedSweatlistIds.map(item => item.id), // Update workoutIdList to match
          updatedAt: new Date(),
          // Update other fields if they were modified in the form
          title: challengeData.challengeName,
          subtitle: challengeData.challengeDesc,
          pin: challengeData.pinCode,
          privacy: challengeData.roundType,
          challenge: {
            ...originalCollection.challenge,
            title: challengeData.challengeName,
            subtitle: challengeData.challengeDesc,
            startDate: challengeData.startDate,
            endDate: challengeData.endDate,
            updatedAt: new Date(),
            mealTracking: challengeData.mealTracking || originalCollection.challenge?.mealTracking
          }
        };

        const collectionToUpdate = new SweatlistCollection(updatedCollectionData);
        updatedCollection = await workoutService.updateCollection(collectionToUpdate);
        
      } else {
        
        // Create new round (existing logic)
        const createdAt = new Date();
        
        const challenge = new Challenge({
          id: "",
          title: challengeData.challengeName,
          subtitle: challengeData.challengeDesc,
          participants: [],
          status: ChallengeStatus.Draft,
          startDate: challengeData.startDate,
          endDate: challengeData.endDate,
          createdAt,
          updatedAt: createdAt,
          ownerId: [currentUser?.id || ''],
          mealTracking: challengeData.mealTracking
        });
    
        const collection = new SweatlistCollection({
          id: "",
          title: challengeData.challengeName,
          subtitle: challengeData.challengeDesc,
          pin: challengeData.pinCode,
          challenge,
          sweatlistIds: selectedStacks.map((stack, index) => ({
            id: stack.id,
            sweatlistAuthorId: currentUser?.id || '',
            sweatlistName: stack.title,
            order: index + 1,
            isRest: false, // Manual stacks are not rest days
          })),
          ownerId: [currentUser?.id || ''],
          participants: [],
          privacy: challengeData.roundType,
          createdAt,
          updatedAt: createdAt
        });
    
        updatedCollection = await workoutService.updateCollection(collection);
      }
      
      if (updatedCollection) {  
        // Show success modal instead of redirecting
        const isUpdate = !!selectedExistingChallenge;
        const isRegeneration = isRegenerationMode && selectedExistingChallenge;
        
        if (isRegeneration) {
          console.log('🎉 DEBUG: Manual regeneration completed successfully!');
          console.log('📊 DEBUG: New stacks created:', selectedStacks.length);
        }
        
        handleShowSuccessModal(updatedCollection, selectedStacks, isUpdate, undefined); // No AI thinking for manual round creation
      }
    } catch (error) {
      console.error('Error creating round:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate workout round. Please try again.';
      setError(errorMessage);
    }
  };

  const [currentStage, setCurrentStage] = useState(0);
  const [currentExercise, setCurrentExercise] = useState('');
  const [fadeState, setFadeState] = useState('fade-in');
  


  // Initial ChallengeData for early function access
  const initialStartDate = new Date();
  const initialEndDate = new Date(initialStartDate.getTime() + 7 * 86400 * 1000);
  const _initialChallengeData: ChallengeData = {
    startDate: initialStartDate,
    endDate: initialEndDate,
    challengeName: '',
    challengeDesc: '',
    roundType: SweatlistType.together,
    pinCode: '',
    restDayPreferences: {
      includeRestDays: false,
      restDays: [],
      preferences: [],
    },
    equipmentPreferences: {
      selectedEquipment: [],
      equipmentOnly: false,
    },
    challengeType: 'workout',
    stepConfiguration: {
      dailyStepGoal: 10000,
      allowedMissedDays: 2,
    },
    mealTracking: {
      isEnabled: false,
      configurationType: 'customMacros',
      pointsPerDay: 100,
      tolerancePercentage: 0.10,
      customMacroRanges: {
        calorieRange: { min: 1800, max: 2200 },
        proteinRange: { min: 120, max: 180 },
        carbRange: { min: 200, max: 300 },
        fatRange: { min: 60, max: 100 },
      },
    },
  };


  
  const stages = [
    "Analyzing moves...",
    "Optimizing workout flow...",
    "Structuring your program...",
    "Almost there..."
  ];

  useEffect(() => {
    if (!isGenerating) return;
    let stageTimeout: NodeJS.Timeout;
    const progressStage = () => {
      setFadeState('fade-out');
      setTimeout(() => {
        setCurrentStage(prev => {
          const nextStage = prev + 1;
          if (nextStage === stages.length - 1) {
            return nextStage;
          }
          stageTimeout = setTimeout(progressStage, 10000); 
          return nextStage;
        });
        setFadeState('fade-in');
      }, 500);
    };
    stageTimeout = setTimeout(progressStage, 10000); 
    const exerciseInterval = setInterval(() => {
      if (allExercises.length > 0) {
        setFadeState('fade-out');
        setTimeout(() => {
          setCurrentExercise(allExercises[Math.floor(Math.random() * allExercises.length)].name);
          setFadeState('fade-in');
        }, 500);
      }
    }, 2000); 
    return () => {
      clearTimeout(stageTimeout);
      clearInterval(exerciseInterval);
    };
  }, [isGenerating, allExercises]);

  // --- Rest Day and AI Preference Handlers --- 
  const getUiRestDayPreferences = (): DayPreference[] => {
    const currentSelectedDays = challengeData.restDayPreferences?.restDays || [];
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({
        day,
        isSelected: currentSelectedDays.includes(day),
    }));
  };

  const handleDesktopIncludeRestDaysChange = (checked: boolean) => {
    const currentRestPrefs = challengeData.restDayPreferences || { includeRestDays: false, restDays: [], preferences: [] };
    let newAiPreferences = currentRestPrefs.preferences.filter(p => !p.startsWith('Schedule rest days'));

    if (checked && currentRestPrefs.restDays.length > 0) {
        const restDayPrompt = `Schedule rest days on ${currentRestPrefs.restDays.join(', ')} throughout the program duration. Ensure these days align with the program's start date ${challengeData.startDate.toLocaleDateString()} and end date ${challengeData.endDate.toLocaleDateString()}.`;
        newAiPreferences.push(restDayPrompt);
    }

    handleLocalSetChallengeData({
      restDayPreferences: {
        ...currentRestPrefs,
        includeRestDays: checked,
        // If unchecking, clear selected days too? Current logic keeps them if unchecking then rechecking.
        // For now, let's clear them if includeRestDays becomes false.
        restDays: checked ? currentRestPrefs.restDays : [],
        preferences: newAiPreferences,
      }
    });
  };

  const handleDesktopRestDayPreferencesChange = (updatedDay: string) => {
    const currentRestPrefs = challengeData.restDayPreferences || { includeRestDays: false, restDays: [], preferences: [] };
    const oldSelectedConcreteDays = currentRestPrefs.restDays;
    const newSelectedConcreteDays = oldSelectedConcreteDays.includes(updatedDay)
      ? oldSelectedConcreteDays.filter(d => d !== updatedDay)
      : [...oldSelectedConcreteDays, updatedDay];

    let newAiPreferences = currentRestPrefs.preferences.filter(p => !p.startsWith('Schedule rest days'));
    const newIncludeRestDays = newSelectedConcreteDays.length > 0 ? true : currentRestPrefs.includeRestDays;

    if (newIncludeRestDays && newSelectedConcreteDays.length > 0) {
      const restDayPrompt = `Schedule rest days on ${newSelectedConcreteDays.join(', ')} throughout the program duration. Ensure these days align with the program's start date ${challengeData.startDate.toLocaleDateString()} and end date ${challengeData.endDate.toLocaleDateString()}.`;
      newAiPreferences.push(restDayPrompt);
    }

    handleLocalSetChallengeData({
        restDayPreferences: {
            ...currentRestPrefs,
            includeRestDays: newIncludeRestDays,
            restDays: newSelectedConcreteDays,
            preferences: newAiPreferences,
        }
    });
  };
  
  const handleGeneralAiPreferenceToggle = (preference: string) => {
    const currentRestPrefs = challengeData.restDayPreferences || { includeRestDays: false, restDays: [], preferences: [] };
    const currentAiPrefs = currentRestPrefs.preferences;
    const newAiPrefs = currentAiPrefs.includes(preference)
        ? currentAiPrefs.filter(p => p !== preference)
        : [...currentAiPrefs, preference];
    
    // Ensure rest day prompt is not duplicated if it exists
    const restDayPromptExists = newAiPrefs.find(p => p.startsWith('Schedule rest days'));
    const finalAiPrefs = newAiPrefs.filter(p => !p.startsWith('Schedule rest days'));
    if(restDayPromptExists) finalAiPrefs.push(restDayPromptExists);

    handleLocalSetChallengeData({
        restDayPreferences: {
            ...currentRestPrefs,
            preferences: finalAiPrefs,
        }
    });
  };

  // Animate rest day configuration from chatbot suggestions
  const animateRestDayConfiguration = async (restDays: string[]) => {
    try {

      // Format all the days first
      const formattedDays = restDays.map(day => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase());
      
      // First enable the toggle with a natural delay
      setTimeout(() => {
        handleDesktopIncludeRestDaysChange(true);
      }, 800);

      // Step 2: Add each rest day progressively, building the cumulative list
      let cumulativeDays: string[] = [];
      
      formattedDays.forEach((dayFormatted, index) => {
        setTimeout(() => {
          cumulativeDays.push(dayFormatted);
          
          
          // Build the updated preferences with all days selected so far
          const currentRestPrefs = challengeData.restDayPreferences || { includeRestDays: false, restDays: [], preferences: [] };
          let newAiPreferences = currentRestPrefs.preferences.filter(p => !p.startsWith('Schedule rest days'));
          
          if (cumulativeDays.length > 0) {
            const restDayPrompt = `Schedule rest days on ${cumulativeDays.join(', ')} throughout the program duration. Ensure these days align with the program's start date ${challengeData.startDate.toLocaleDateString()} and end date ${challengeData.endDate.toLocaleDateString()}.`;
            newAiPreferences.push(restDayPrompt);
          }

          // Update state with cumulative days
          handleLocalSetChallengeData({
            restDayPreferences: {
              includeRestDays: true,
              restDays: [...cumulativeDays], // Use the cumulative list
              preferences: newAiPreferences,
            }
          });
          
        }, 1500 + (index * 1000)); // More natural, slower timing
      });

    } catch (error) {
      console.error('Error animating rest day configuration:', error);
    }
  };

  // Animate typing text into form fields
  const animateTypingIntoField = async (text: string, fieldType: 'name' | 'description') => {
    try {
      
      const delay = 50; // Delay between each character (milliseconds)
      
      // Clear the field first with a small delay
      setTimeout(() => {
        if (fieldType === 'name') {
          handleLocalSetChallengeData({ challengeName: '' });
        } else {
          handleLocalSetChallengeData({ challengeDesc: '' });
        }
      }, 300);
      
      // Type each character with a delay
      for (let i = 0; i <= text.length; i++) {
        setTimeout(() => {
          const currentText = text.substring(0, i);
          if (fieldType === 'name') {
            handleLocalSetChallengeData({ challengeName: currentText });
          } else {
            handleLocalSetChallengeData({ challengeDesc: currentText });
          }
          
          if (i === text.length) {
          }
        }, 500 + (i * delay)); // Start after 500ms, then 50ms per character
      }
      
    } catch (error) {
      console.error(`Error animating ${fieldType} typing:`, error);
    }
  };

  // Utility functions for workout analysis
  const analyzeWorkoutSummaries = (workoutSummaries: WorkoutSummary[]) => {
    if (!workoutSummaries?.length) return {};

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Filter recent workouts (last 30 days)
    const recentWorkouts = workoutSummaries.filter(ws => 
      ws.completedAt && new Date(ws.completedAt) >= thirtyDaysAgo
    );

    // Workout history analysis
    const workoutHistory = {
      recentWorkouts: recentWorkouts.length,
      totalWorkouts: workoutSummaries.length,
      lastWorkoutDate: workoutSummaries.length > 0 ? 
        new Date(Math.max(...workoutSummaries.map(ws => ws.completedAt?.getTime() || 0))) : undefined,
      averageWorkoutDuration: workoutSummaries.length > 0 ? 
        Math.round(workoutSummaries.reduce((sum, ws) => sum + (ws.duration || 0), 0) / workoutSummaries.length) : undefined
    };

    // Strength metrics analysis
    const strengthMetrics = extractStrengthMetrics(workoutSummaries);

    // Personal records (top 5 heaviest lifts)
    const personalRecords = extractPersonalRecords(workoutSummaries);

    // Progress trends
    const progressionTrends = analyzeProgressionTrends(workoutSummaries, recentWorkouts);

    return { workoutHistory, strengthMetrics, personalRecords, progressionTrends };
  };

  const extractStrengthMetrics = (workoutSummaries: WorkoutSummary[]) => {
    const strengthMetrics: any = {};
    const pullExercises = ['pull up', 'pullup', 'row', 'lat pulldown', 'chin up', 'chinup'];
    const pushExercises = ['bench press', 'push up', 'pushup', 'overhead press', 'shoulder press', 'dip'];
    const squatExercises = ['squat', 'goblet squat', 'front squat', 'back squat'];
    const deadliftExercises = ['deadlift', 'romanian deadlift', 'rdl', 'sumo deadlift'];

    let totalVolume = 0;
    let pullStrength: any = null;
    let pushStrength: any = null;
    let squatStrength: any = null;
    let deadliftStrength: any = null;

    workoutSummaries.forEach(summary => {
      summary.exercisesCompleted?.forEach(exerciseLog => {
        const exerciseName = exerciseLog.exercise.name.toLowerCase();
        
        exerciseLog.logs?.forEach(log => {
          const weight = log.weight || 0;
          const reps = log.reps || 0;
          const volume = weight * reps;
          totalVolume += volume;

          // Check for pull exercises
          if (pullExercises.some(ex => exerciseName.includes(ex))) {
            if (!pullStrength || weight > pullStrength.weight) {
              pullStrength = {
                exercise: exerciseLog.exercise.name,
                weight: weight,
                reps: reps,
                date: summary.completedAt || summary.createdAt
              };
            }
          }

          // Check for push exercises  
          if (pushExercises.some(ex => exerciseName.includes(ex))) {
            if (!pushStrength || weight > pushStrength.weight) {
              pushStrength = {
                exercise: exerciseLog.exercise.name,
                weight: weight,
                reps: reps,
                date: summary.completedAt || summary.createdAt
              };
            }
          }

          // Check for squat exercises
          if (squatExercises.some(ex => exerciseName.includes(ex))) {
            if (!squatStrength || weight > squatStrength.weight) {
              squatStrength = {
                exercise: exerciseLog.exercise.name,
                weight: weight,
                reps: reps,
                date: summary.completedAt || summary.createdAt
              };
            }
          }

          // Check for deadlift exercises
          if (deadliftExercises.some(ex => exerciseName.includes(ex))) {
            if (!deadliftStrength || weight > deadliftStrength.weight) {
              deadliftStrength = {
                exercise: exerciseLog.exercise.name,
                weight: weight,
                reps: reps,
                date: summary.completedAt || summary.createdAt
              };
            }
          }
        });
      });
    });

    if (pullStrength) strengthMetrics.pullStrength = pullStrength;
    if (pushStrength) strengthMetrics.pushStrength = pushStrength;
    if (squatStrength) strengthMetrics.squatStrength = squatStrength;
    if (deadliftStrength) strengthMetrics.deadliftStrength = deadliftStrength;
    if (totalVolume > 0) strengthMetrics.totalVolumeRecent = totalVolume;

    return Object.keys(strengthMetrics).length > 0 ? strengthMetrics : undefined;
  };

  const extractPersonalRecords = (workoutSummaries: WorkoutSummary[]) => {
    const records: Array<{ exercise: string; weight: number; reps: number; date: Date }> = [];

    workoutSummaries.forEach(summary => {
      summary.exercisesCompleted?.forEach(exerciseLog => {
        exerciseLog.logs?.forEach(log => {
          if (log.weight && log.weight > 0) {
            records.push({
              exercise: exerciseLog.exercise.name,
              weight: log.weight,
              reps: log.reps || 0,
              date: summary.completedAt || summary.createdAt
            });
          }
        });
      });
    });

    // Sort by weight descending and take top 5
    return records
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
  };

      // Stack modal handlers
    const handleOpenStackModal = (stack: WorkoutWithRoundId) => {
      setSelectedStackForModal(stack);
      setIsStackModalOpen(true);
    };

    const handleCloseStackModal = () => {
      setIsStackModalOpen(false);
      setSelectedStackForModal(null);
    };

    // Success modal handlers
    const handleShowSuccessModal = (collection: any, stacks: WorkoutWithRoundId[], isUpdate: boolean = false, aiThinking?: string) => {
      // Calculate schedule information
      const totalDays = calculateTotalDays(challengeData.startDate, challengeData.endDate);
      const restDays = challengeData.restDayPreferences?.restDays || [];
      
      // Calculate actual rest day count by iterating through the days
      let actualRestDayCount = 0;
      if (restDays.length > 0) {
        const restDayMap = new Set(restDays.map(day => day.toLowerCase()));
        for (let i = 0; i < totalDays; i++) {
          const currentDate = new Date(challengeData.startDate);
          currentDate.setDate(challengeData.startDate.getDate() + i);
          const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          if (restDayMap.has(dayOfWeek)) {
            actualRestDayCount++;
          }
        }
      }
      
      const workoutDays = stacks.length;
      
      const scheduleInfo = {
        startDate: challengeData.startDate,
        endDate: challengeData.endDate,
        restDays: restDays,
        totalDays: totalDays,
        workoutDays: workoutDays,
        restDayCount: actualRestDayCount
      };
      
      console.log('🔍 [SUCCESS MODAL] Data being passed:', {
        collection: collection?.title,
        stacksCount: stacks?.length,
        stacksTitles: stacks?.map(s => s.title),
        stacksExercises: stacks?.map(s => ({ title: s.title, exerciseCount: s.exercises?.length })),
        isUpdate,
        aiThinking: aiThinking?.slice(0, 100) + '...'
      });
      
      setCreatedRoundData({ collection, stacks, isUpdate, scheduleInfo, aiThinking });
      setIsSuccessModalOpen(true);
    };

    const handleCloseSuccessModal = () => {
      setIsSuccessModalOpen(false);
      setCreatedRoundData(null);
    };

    const handleViewRound = () => {
      if (createdRoundData?.collection?.id) {
        router.push(`/round/${createdRoundData.collection.id}`);
      }
    };

    const handleContinueEditing = () => {
      // Update the selected stacks with the created stacks for continued editing
      if (createdRoundData?.stacks) {
        if (createdRoundData.isUpdate) {
          // For updates, combine existing stacks with new ones
          setSelectedStacks(prev => [...prev, ...createdRoundData.stacks]);
        } else {
          // For new rounds, just set the created stacks
          setSelectedStacks(createdRoundData.stacks);
        }
      }
      handleCloseSuccessModal();
    };

    const analyzeProgressionTrends = (allWorkouts: WorkoutSummary[], recentWorkouts: WorkoutSummary[]) => {
    if (allWorkouts.length < 3) {
      return {
        strengthTrend: 'unknown' as const,
        volumeTrend: 'unknown' as const,
        consistencyRating: recentWorkouts.length > 0 ? Math.min(100, (recentWorkouts.length / 12) * 100) : 0
      };
    }

    // Simple trend analysis comparing first half vs second half of workouts
    const midpoint = Math.floor(allWorkouts.length / 2);
    const earlyWorkouts = allWorkouts.slice(0, midpoint);
    const laterWorkouts = allWorkouts.slice(midpoint);

    // Calculate average volume for each period
    const earlyVolume = earlyWorkouts.reduce((sum, w) => sum + calculateWorkoutVolume(w), 0) / earlyWorkouts.length;
    const laterVolume = laterWorkouts.reduce((sum, w) => sum + calculateWorkoutVolume(w), 0) / laterWorkouts.length;

    const volumeChange = (laterVolume - earlyVolume) / earlyVolume;
    
    return {
      strengthTrend: volumeChange > 0.1 ? 'improving' : volumeChange < -0.1 ? 'declining' : 'maintaining' as const,
      volumeTrend: volumeChange > 0.05 ? 'increasing' : volumeChange < -0.05 ? 'decreasing' : 'stable' as const,
      consistencyRating: Math.min(100, (recentWorkouts.length / 12) * 100) // Target: 3 workouts/week
    };
  };

  const calculateWorkoutVolume = (workout: WorkoutSummary): number => {
    let volume = 0;
    workout.exercisesCompleted?.forEach(exerciseLog => {
      exerciseLog.logs?.forEach(log => {
        volume += (log.weight || 0) * (log.reps || 0);
      });
    });
    return volume;
  };

  // Enhanced User to UserDataCard conversion function
  // Intelligently maps User data to UserDataCard format while preserving raw text for AI context
  const convertUserToDataCard = (user: User, workoutSummaries?: WorkoutSummary[]): UserDataCard => {
    // Extract fitness information from bio and additionalGoals
    const extractFitnessInfo = (text: string = '') => {
      const lowerText = text.toLowerCase();
      const injuries = [];
      const preferences = [];
      
      // Common injury keywords
      if (lowerText.includes('knee') || lowerText.includes('knees')) injuries.push('Knee issues');
      if (lowerText.includes('back') || lowerText.includes('spine')) injuries.push('Back issues');
      if (lowerText.includes('shoulder')) injuries.push('Shoulder issues');
      if (lowerText.includes('ankle')) injuries.push('Ankle issues');
      if (lowerText.includes('wrist')) injuries.push('Wrist issues');
      
      // Workout preferences from bio/goals
      if (lowerText.includes('yoga')) preferences.push('yoga');
      if (lowerText.includes('cardio') || lowerText.includes('running')) preferences.push('cardio');
      if (lowerText.includes('strength') || lowerText.includes('weights')) preferences.push('weight-training');
      if (lowerText.includes('pilates')) preferences.push('pilates');
      if (lowerText.includes('crossfit') || lowerText.includes('functional')) preferences.push('functional');
      
      return { injuries, preferences };
    };

    // Analyze bio and additional goals for fitness insights
    const bioInfo = extractFitnessInfo(user.bio);
    const goalInfo = extractFitnessInfo(user.additionalGoals);
    const allInjuries = [...bioInfo.injuries, ...goalInfo.injuries];
    const allPreferences = [...bioInfo.preferences, ...goalInfo.preferences];

    // Determine equipment based on user profile
    const determineEquipment = (): ('full-gym' | 'home-gym' | 'minimal-equipment' | 'bodyweight-only')[] => {
      if (user.homeGym?.name) return ['full-gym']; // Has a home gym
      if (user.location) return ['full-gym']; // Likely has access to gyms
      if (user.creator?.isTrainer) return ['full-gym']; // Trainers usually have gym access
      return ['full-gym', 'home-gym']; // Default to flexible
    };

    // Determine fitness level based on multiple factors
    const determineFitnessLevel = (): 'beginner' | 'intermediate' | 'advanced' | 'expert' => {
      let score = 0;
      
      // Base level from user.level
      if (user.level === 'expert') score += 3;
      else if (user.level === 'intermediate') score += 2;
      else score += 1; // novice
      
      // Boost for creators (they usually know more about fitness)
      if (user.creator?.isTrainer) score += 2;
      if (user.creator) score += 1;
      
      // Boost for video count (active users tend to be more experienced)
      if (user.videoCount > 50) score += 2;
      else if (user.videoCount > 20) score += 1;
      
      // Boost for detailed goals/bio (shows knowledge)
      if (user.additionalGoals?.length > 50 || user.bio?.length > 100) score += 1;
      
      if (score >= 6) return 'expert';
      if (score >= 4) return 'advanced';
      if (score >= 2) return 'intermediate';
      return 'beginner';
    };

    // Determine motivation style based on profile
    const determineMotivationStyle = (): ('competitive' | 'collaborative' | 'independent' | 'coach-guided')[] => {
      const styles = [];
      
      if (user.creator?.isTrainer) styles.push('coach-guided');
      if (user.workoutBuddy || user.workoutBuddyUser) styles.push('collaborative');
      if (user.creator) styles.push('independent');
      if (user.videoCount > 10) styles.push('competitive'); // Active users tend to be competitive
      
      return styles.length > 0 ? styles as ('competitive' | 'collaborative' | 'independent' | 'coach-guided')[] : ['independent'];
    };

    // Create intelligent defaults based on available User data
    const defaultData = {
      id: user.id,
      name: user.displayName || user.username,
      email: user.email,
      profileImage: user.profileImage?.profileImageURL,
      
             // Enhanced demographics
       age: user.birthdate ? Math.floor((Date.now() - user.birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined,
       gender: user.gender ? (user.gender.toString() === 'man' ? 'male' : user.gender.toString() === 'woman' ? 'female' : 'other') : 
              (user.selfDisclosedGender ? 'other' : undefined),
      
      // Enhanced fitness level determination
      fitnessLevel: determineFitnessLevel(),
      experienceYears: user.level === 'expert' ? 5 : user.level === 'intermediate' ? 3 : 
                     user.creator?.isTrainer ? 4 : 1,
      
      // Enhanced goal mapping including additionalGoals
      primaryGoals: (() => {
        const goals = [];
        
        // From user.goal enum
        if (user.goal?.length > 0) {
          user.goal.forEach(g => {
            const goalStr = g.toString().toLowerCase();
            if (goalStr.includes('weight') && goalStr.includes('lose')) goals.push('weight-loss');
            else if (goalStr.includes('muscle') || goalStr.includes('mass') || goalStr.includes('gain')) goals.push('hypertrophy');
            else if (goalStr.includes('tone') || goalStr.includes('strength')) goals.push('strength');
            else if (goalStr.includes('endurance') || goalStr.includes('cardio')) goals.push('endurance');
            else if (goalStr.includes('athletic') || goalStr.includes('performance')) goals.push('athletic-performance');
            else goals.push('general-fitness');
          });
        }
        
        // From additionalGoals text
        if (user.additionalGoals) {
          const goalText = user.additionalGoals.toLowerCase();
          if (goalText.includes('lose weight') || goalText.includes('weight loss')) goals.push('weight-loss');
          if (goalText.includes('muscle') || goalText.includes('hypertrophy') || goalText.includes('bulk')) goals.push('hypertrophy');
          if (goalText.includes('strength') || goalText.includes('strong')) goals.push('strength');
          if (goalText.includes('endurance') || goalText.includes('cardio') || goalText.includes('marathon')) goals.push('endurance');
          if (goalText.includes('athletic') || goalText.includes('performance') || goalText.includes('sport')) goals.push('athletic-performance');
        }
        
                 return goals.length > 0 ? 
           Array.from(new Set(goals)) as ('strength' | 'hypertrophy' | 'endurance' | 'weight-loss' | 'athletic-performance' | 'general-fitness')[] :
           ['general-fitness'];
      })(),
      
      // Enhanced workout type preferences
      preferredWorkoutTypes: (() => {
        const types = ['weight-training']; // Default
        allPreferences.forEach(pref => {
          if (!types.includes(pref)) types.push(pref);
        });
        return types as ('weight-training' | 'cardio' | 'yoga' | 'pilates' | 'functional' | 'sports-specific')[];
      })(),
      
      // Enhanced intensity based on experience and goals
      preferredIntensity: user.level === 'novice' ? 'low' : 
                         user.level === 'expert' ? 'high' : 
                         user.creator?.isTrainer ? 'high' : 'moderate' as 'low' | 'moderate' | 'high' | 'varied',
      
      // Smart equipment determination
      availableEquipment: determineEquipment(),
      
      // Enhanced duration based on experience
      preferredDuration: user.level === 'expert' ? 75 : 
                        user.level === 'intermediate' ? 60 : 
                        user.creator?.isTrainer ? 90 : 45,
      
      // Enhanced frequency based on level and goals
      trainingFrequency: user.level === 'expert' ? 5 : 
                        user.level === 'intermediate' ? 4 : 
                        user.creator?.isTrainer ? 6 : 3,
      
      availableDays: ['monday', 'tuesday', 'thursday', 'friday'] as ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[],
      timeOfDay: ['evening'] as ('early-morning' | 'morning' | 'afternoon' | 'evening' | 'flexible')[],
      
      // Enhanced injury and limitation data
      injuries: allInjuries,
      limitations: [],
      healthConditions: [],
      favoriteExercises: [],
      dislikedExercises: [],
      
      // Enhanced challenge participation based on platform activity
      pastChallengesCompleted: user.videoCount > 50 ? 5 : user.videoCount > 20 ? 3 : user.videoCount > 5 ? 1 : 0,
      averageWorkoutCompletionRate: user.isCurrentlyActive ? 85 : 
                                   user.videoCount > 20 ? 80 : 
                                   user.videoCount > 5 ? 70 : 60,
      
      // Enhanced body composition from User data
      height: user.height ? (user.height.feet * 12 + user.height.inches) * 2.54 : undefined, // Convert to cm
      weight: user.bodyWeight?.length > 0 ? user.bodyWeight[user.bodyWeight.length - 1].newWeight : undefined,
      bodyFatPercentage: undefined,
      
      // Enhanced behavioral data
      motivationStyle: determineMotivationStyle(),
      preferredFeedback: user.creator?.isTrainer ? ['technical', 'detailed'] :
                        user.level === 'expert' ? ['detailed'] :
                        ['encouraging'] as ('detailed' | 'minimal' | 'encouraging' | 'technical')[],
      
          // Enhanced activity data
    recentWorkoutTypes: allPreferences,
    lastActiveDate: user.updatedAt,
    currentChallengeParticipation: user.isCurrentlyActive ? ['current-activity'] : [],
    
    // Workout performance data (if available)
    ...(workoutSummaries?.length ? analyzeWorkoutSummaries(workoutSummaries) : {}),
    
    // Raw user input preserved for AI context
    additionalGoalsText: user.additionalGoals || undefined,
    bioText: user.bio || undefined,
    
    // Timestamps
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
    };

    return new UserDataCard(defaultData);
  };

  // Chat input refs for focus management
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Chat messages container ref for auto-scrolling
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Auto-focus chat input after AI responses
  useEffect(() => {
    if (!isAIResponding) {
      // Small delay to ensure DOM is updated after AI response
      setTimeout(() => {
              if (chatMessages.length > 0) {
        // Focus the simple input for continuing conversation
        chatInputRef.current?.focus();
      } else {
          // Focus the textarea for starting conversation
          chatTextareaRef.current?.focus();
        }
      }, 100);
    }
      }, [isAIResponding, chatMessages.length]);

  // Initial focus when component mounts
  useEffect(() => {
    // Focus the appropriate input when the component first loads
    setTimeout(() => {
      if (chatMessages.length > 0) {
        chatInputRef.current?.focus();
      } else {
        chatTextareaRef.current?.focus();
      }
    }, 200); // Slightly longer delay to ensure everything is rendered
  }, []); // Only run on mount

  // Track if user has manually scrolled up
  const [_userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const previousMessageCount = useRef(chatMessages.length);
  

  // Auto-scroll chat to bottom only when appropriate
  useEffect(() => {
    if (chatMessagesRef.current) {
      const scrollContainer = chatMessagesRef.current;
      const isAtBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 10;
      const hasNewMessage = chatMessages.length > previousMessageCount.current;
      
      // Only auto-scroll if user is at bottom and there's a new message, or if AI is responding
      if ((isAtBottom && hasNewMessage) || isAIResponding) {
        const scrollToBottom = () => {
          chatMessagesRef.current?.scrollTo({
            top: chatMessagesRef.current.scrollHeight,
            behavior: 'smooth'
          });
          setUserHasScrolledUp(false);
        };
        
        // Small delay to ensure DOM is updated with new content
        setTimeout(scrollToBottom, 100);
      }
      
      // Update previous message count
      previousMessageCount.current = chatMessages.length;
    }
  }, [chatMessages, isAIResponding, showGenerateCard]);

  // Auto-scroll to bottom when conversation is loaded/switched
  useEffect(() => {
    if (programmingConversationHistory.length > 0 && chatMessagesRef.current) {
      // Small delay to ensure DOM is fully rendered with conversation content
      const scrollToBottom = () => {
        chatMessagesRef.current?.scrollTo({
          top: chatMessagesRef.current.scrollHeight,
          behavior: 'smooth'
        });
        
        // After scroll completes, check if we should show generate card
        setTimeout(() => {
          // Look for the latest assistant message with readyToGenerate: true
          const lastAssistantMessage = [...programmingConversationHistory]
            .reverse()
            .find(msg => msg.role === 'assistant' && msg.readyToGenerate === true);
          
          if (lastAssistantMessage) {
            // Validate current challenge data before showing generate card (lenient for readyToGenerate)
            const currentValidation = validateChallengeInputQuiet(true);
            const shouldShowGenerateCard = currentValidation;
            
            setShowGenerateCard(shouldShowGenerateCard);
            
            // If generate card is being shown, scroll down again to ensure it's visible
            if (shouldShowGenerateCard) {
              setTimeout(() => {
                chatMessagesRef.current?.scrollTo({
                  top: chatMessagesRef.current.scrollHeight,
                  behavior: 'smooth'
                });
              }, 200); // Small delay to let the card render
            }
          }
        }, 500); // Wait for scroll animation to complete (smooth scroll takes ~300-500ms)
      };
      
      // Delay to ensure chat area is rendered and visible
      setTimeout(scrollToBottom, 300);
    }
  }, [programmingConversationHistory]);

  // Handle scroll events to detect manual scrolling
  const handleChatScroll = useCallback(() => {
    if (chatMessagesRef.current) {
      const scrollContainer = chatMessagesRef.current;
      const isAtBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 10;
      setUserHasScrolledUp(!isAtBottom);
    }
  }, []);

  return (
    <>
      <div className="flex h-screen items-start gap-6 bg-[#111417] p-6">
      {error && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <X className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-white">Generation Failed</h3>
              <p className="text-zinc-400 text-center">
                {error}
              </p>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setError(null)}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    handleGenerateAIRound();
                  }}
                  disabled={isGenerating || isLoadingConversation}
                  className="flex-1 px-4 py-2 bg-[#E0FE10] hover:bg-[#E0FE10]/90 text-black rounded-lg transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingConversation ? 'Loading...' : 'Try Again'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-lg w-full mx-4 border border-zinc-700">
            <div className="flex flex-col items-center gap-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10]" />
              
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">Generating Round</h3>
                <p className="text-zinc-400">
                  Creating your personalized training program using AI
                </p>
              </div>

              {/* AI Thinking moved to success modal - no longer shown during loading */}
              
              <div className={`text-[#E0FE10] text-lg loading-text-ready ${fadeState === 'fade-in' ? 'loading-text-visible' : 'loading-text-hidden'}`}>
                {stages[currentStage]}
              </div>
              
              {currentExercise && (
                <div className={`text-zinc-400 text-sm italic loading-text-ready ${fadeState === 'fade-in' ? 'loading-text-visible' : 'loading-text-hidden'}`}>
                  {currentExercise}
                </div>
              )}
              
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-zinc-500 rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-zinc-500 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
                  <div className="w-1 h-1 bg-zinc-500 rounded-full animate-pulse" style={{animationDelay: '0.6s'}}></div>
                </div>
                <span>Pulse AI is thinking. This may take a moment...</span>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Left Panel: Title, Prompt, Stes, etc. */}
        <div className={`${
          isLeftPanelCollapsed ? 'w-12' : 'w-[400px]'
        } h-full flex flex-col bg-[#1a1e24] rounded-xl shadow-xl relative overflow-hidden transition-all duration-300 ease-in-out`}>
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#E0FE10]"></div>
          <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#E0FE10]"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E0FE10] via-purple-500 to-blue-500"></div>
          <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-gradient-to-t from-[#E0FE10] via-purple-500 to-blue-500"></div>

        {/* Header with collapse icon */}
        <div className={`flex items-center justify-between p-4 border-b border-zinc-700 ${isLeftPanelCollapsed ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
          {!isLeftPanelCollapsed && (
            <>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">Round Setup</h3>
                {/* Programming Access Button - moved from floating position */}
                {currentUser ? (
                  <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-black/20 backdrop-blur-sm border border-zinc-700">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#E0FE10] to-purple-500 flex items-center justify-center">
                      {currentUser.profileImage?.profileImageURL ? (
                        <img 
                          src={currentUser.profileImage.profileImageURL} 
                          alt={currentUser.displayName || currentUser.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <UserCircle className="w-4 h-4 text-black" />
                      )}
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-white text-xs font-medium">
                        {currentUser.displayName || currentUser.username}
                      </p>
                      <p className="text-zinc-400 text-xs">Programming Access</p>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      // Redirect to main app for authentication
                      window.location.href = '/';
                    }}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-black/20 backdrop-blur-sm border border-zinc-700 hover:border-[#E0FE10]/50 transition-all"
                  >
                    <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
                      <UserCircle className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-zinc-400 text-xs">Sign In</p>
                      <p className="text-zinc-500 text-xs">Access your rounds</p>
                    </div>
                  </button>
                )}
              </div>
              <button
                onClick={toggleLeftPanel}
                className="p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                title="Collapse to sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            </>
          )}
        </div>

        {/* Collapsed state overlay - click to expand */}
        {isLeftPanelCollapsed && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-800/50 transition-all duration-200 group z-10"
            onClick={toggleLeftPanel}
            title="Click to expand round setup"
          >
            {/* Icon hint */}
            <div className="p-3 rounded-lg bg-zinc-800 group-hover:bg-zinc-700 transition-colors mb-2">
              <ChevronRight size={20} className="text-zinc-400 group-hover:text-white transition-colors" />
            </div>
            
            {/* Vertical text hint */}
            <div 
              className="text-zinc-500 text-xs font-medium whitespace-nowrap group-hover:text-zinc-300 transition-colors tracking-wide"
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                letterSpacing: '0.5px'
              }}
            >
              SETUP
            </div>
          </div>
        )}

        <div className={`h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800 hover:scrollbar-thumb-zinc-600 ${isLeftPanelCollapsed ? 'hidden' : ''}`}>
            {isAIMode ? (
            <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <div className="w-48 h-24 flex items-center justify-center mb-2">
                      <img 
                        src="/PulseProgrammingLogoWhite.png" 
                        alt="Pulse Programming Logo" 
                        className="object-contain max-h-full max-w-full"
                      />
                    </div>
                    <h3 className="text-2xl font-semibold text-white text-center mb-2">
                      {selectedExistingChallenge 
                        ? `Editing "${selectedExistingChallenge.title}"` 
                        : "Turn your expertise into shared fitness experiences"
                      }
                    </h3>
                    <p className="text-zinc-400 text-center text-sm">
                      {selectedExistingChallenge 
                        ? "Collaborate with AI to modify this existing round. Describe what changes you'd like to make or improvements you want to add."
                        : "Be specific about your Round's focus—like \"upper body strength with core stability\" or \"progressive leg workout for beginners.\" Include any special considerations, goals, or themes to create the most effective program for your community."
                      }
                    </p>
                  </div>

                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Round Title</label>
                  <input
                    type="text"
                    value={challengeData.challengeName}
                    onChange={(e) => handleLocalSetChallengeData({ challengeName: e.target.value })}
                    placeholder="Name your round"
                    className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 
                              text-white placeholder:text-zinc-500
                              focus:border-[#E0FE10] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Round Description</label>
                  <textarea
                    value={challengeData.challengeDesc}
                    onChange={(e) => handleLocalSetChallengeData({ challengeDesc: e.target.value })}
                    placeholder="Describe the purpose, or goals of this round(Members will see this)"
                    rows={4}
                    className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 
                                text-white placeholder:text-zinc-500 
                                focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
                    />
                </div>

                 <div className="mb-8">
                   <label className="text-sm text-zinc-400 mb-2 block">Round Type</label>
                   <div className="grid grid-cols-2 gap-3">
                     <button
                       onClick={() => handleLocalSetChallengeData({ roundType: SweatlistType.together })}
                       className={`p-4 rounded-lg flex flex-col items-center transition-colors ${
                         challengeData.roundType === SweatlistType.together 
                           ? "bg-[#E0FE10] text-black" 
                           : "bg-[#262a30] border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50"
                       }`}
                     >
                       <Users className="h-5 w-5 mb-2" />
                       <span className="font-medium text-sm">Together</span>
                       <span className="text-xs mt-1">Train with the community</span>
                     </button>

                     <button
                       onClick={() => handleLocalSetChallengeData({ roundType: SweatlistType.locked })}
                       className={`p-4 rounded-lg flex flex-col items-center transition-colors ${
                         challengeData.roundType === SweatlistType.locked 
                           ? "bg-[#E0FE10] text-black" 
                           : "bg-[#262a30] border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50"
                       }`}
                     >
                       <Lock className="h-5 w-5 mb-2" />
                       <span className="font-medium text-sm">Private</span>
                       <span className="text-xs mt-1">Invite-only training</span>
                     </button>
                   </div>
                 </div>

                 <div className="mb-8">
                   <label className="text-sm text-zinc-400 mb-2 block">Round Dates</label>
                   <div className="space-y-2">
                     <div>
                       <label className="text-xs text-zinc-500 block mb-1">Start Date</label>
                       <input
                         type="date"
                         value={formatDateForInput(challengeData.startDate)}
                         onChange={(e) => handleLocalSetChallengeData({ startDate: new Date(e.target.value) })}
                         className="w-full p-3 rounded-lg bg-[#262a30] border border-zinc-700 
                                 text-white placeholder:text-zinc-500
                                 focus:border-[#E0FE10] focus:outline-none transition-all
                                 [color-scheme:dark]"
                       />
                     </div>
                     <div>
                       <label className="text-xs text-zinc-500 block mb-1">End Date</label>
                       <input
                         type="date"
                         value={formatDateForInput(challengeData.endDate)}
                         min={formatDateForInput(challengeData.startDate)}
                         onChange={(e) => handleLocalSetChallengeData({ endDate: new Date(e.target.value) })}
                         className="w-full p-3 rounded-lg bg-[#262a30] border border-zinc-700 
                                 text-white placeholder:text-zinc-500
                                 focus:border-[#E0FE10] focus:outline-none transition-all
                                 [color-scheme:dark]"
                       />
                     </div>
                   </div>
                 </div>

                 {challengeData.roundType === SweatlistType.locked && (
                   <div className="mb-8">
                     <label className="text-sm text-zinc-400 mb-2 block">PIN Code</label>
                     <input
                       type="text"
                       maxLength={9}
                       minLength={9}
                       value={challengeData.pinCode}
                       onChange={(e) => handleLocalSetChallengeData({ pinCode: e.target.value })}
                       placeholder="Set 9-digit PIN"
                       className="w-full p-3 rounded-lg bg-[#262a30] border border-zinc-700 
                                 text-white placeholder:text-zinc-500
                                 focus:border-[#E0FE10] focus:outline-none transition-all"
                       />
                   </div>
                 )}

                {/* Existing Challenge Selection */}
                <div className="border-t border-zinc-700 pt-6">
                                      <div className="flex items-center justify-between mb-4">
                      <label className="text-sm text-zinc-400">Edit Existing Round</label>
                      <button
                        onClick={() => setShowExistingChallenges(!showExistingChallenges)}
                        className="text-xs text-[#E0FE10] hover:text-[#E0FE10]/80 transition-colors"
                      >
                        {showExistingChallenges ? 'Hide' : 'Browse'}
                      </button>
                    </div>
                  
                  {showExistingChallenges && (
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {!currentUser ? (
                        <div className="text-center py-4">
                          <p className="text-zinc-500 text-sm mb-3">Sign in to access your rounds</p>
                          <button
                            onClick={() => {
                              // Simple redirect to sign in - you can implement proper modal later
                              window.location.href = '/';
                            }}
                            className="px-4 py-2 bg-[#E0FE10] text-black rounded-lg text-sm hover:opacity-90 transition-opacity"
                          >
                            Sign In
                          </button>
                        </div>
                      ) : loadingExistingChallenges ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E0FE10]"></div>
                        </div>
                      ) : existingChallengesError ? (
                        <div className="text-center py-4">
                          <p className="text-red-400 text-sm mb-2">{existingChallengesError}</p>
                          <button
                            onClick={() => {
                              setExistingChallenges([]);
                              setExistingChallengesError(null);
                              setOriginalCollections([]);
                              if (currentUser?.id) {
                                fetchExistingChallenges();
                              }
                            }}
                            className="text-xs text-[#E0FE10] hover:text-[#E0FE10]/80 transition-colors"
                          >
                            Try Again
                          </button>
                        </div>
                      ) : existingChallenges.length === 0 ? (
                        <p className="text-zinc-500 text-sm text-center py-4">No existing rounds found</p>
                      ) : (
                        existingChallenges.map((challenge) => (
                          <button
                            key={challenge.id}
                            onClick={() => handleSelectExistingChallenge(challenge)}
                            className={`w-full p-3 rounded-lg border transition-all text-left ${
                              selectedExistingChallenge?.id === challenge.id
                                ? 'bg-[#E0FE10]/10 border-[#E0FE10] text-white'
                                : 'bg-[#262a30] border-zinc-700 text-zinc-300 hover:border-zinc-600'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-sm truncate">{challenge.title}</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                challenge.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                challenge.status === 'published' ? 'bg-blue-500/20 text-blue-400' :
                                challenge.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {challenge.status}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 truncate">{challenge.subtitle}</p>
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-xs text-zinc-400">
                                {new Date(challenge.startDate).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-zinc-400">
                                {challenge.participantsCount || 0} participants
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  
                  {selectedExistingChallenge && (
                    <div className="mt-4 p-4 bg-[#E0FE10]/5 border border-[#E0FE10]/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Edit3 className="w-4 h-4 text-[#E0FE10]" />
                        <span className="text-sm font-medium text-[#E0FE10]">Editing Mode</span>
                      </div>
                      
                      {/* Prominent Round Title */}
                      <div className="mb-3 p-3 bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-lg">
                        <p className="text-xs text-[#E0FE10] mb-1 font-medium">Currently Editing:</p>
                        <h4 className="text-lg font-semibold text-white truncate">
                          "{selectedExistingChallenge.title}"
                        </h4>
                      </div>
                      
                      <p className="text-xs text-zinc-400 mb-3">
                        The AI will help you modify this existing round and suggest improvements.
                      </p>
                      <button
                        onClick={handleClearSelectedChallenge}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        Clear selection and create new round
                      </button>
                    </div>
                  )}
                </div>

                {/* Selected Stacks Overview - Always show when editing existing round */}
                {selectedExistingChallenge && (
                  <div className="border-t border-zinc-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-zinc-400">Round Stacks ({selectedStacks.length})</label>
                        <span className="text-xs text-zinc-500">
                          {selectedStacks.length} workout{selectedStacks.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => setIsStacksOverviewCollapsed(!isStacksOverviewCollapsed)}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded"
                        title={isStacksOverviewCollapsed ? "Expand stacks" : "Collapse stacks"}
                      >
                        {isStacksOverviewCollapsed ? 'Show' : 'Hide'}
                        <ChevronDown 
                          size={14} 
                          className={`transition-transform duration-200 ${
                            isStacksOverviewCollapsed ? 'rotate-180' : 'rotate-0'
                          }`}
                        />
                      </button>
                    </div>
                    
                    {/* Collapsible content */}
                    <div className={`transition-all duration-300 overflow-hidden ${
                      isStacksOverviewCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
                    }`}>
                      {selectedStacks.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-700">
                          {selectedStacks.map((stack, index) => (
                            <div key={`stack-${index}-${stack.roundWorkoutId || stack.id}`} className="flex items-center justify-between bg-[#262a30] rounded-lg p-3 border border-zinc-700">
                              <div 
                                className="flex-1 min-w-0 cursor-pointer" 
                                onClick={() => handleOpenStackModal(stack)}
                                title="Click to view exercises"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-1 rounded min-w-0">
                                    Day {index + 1}
                                  </span>
                                  <p className="text-sm font-medium text-white truncate">
                                    {stack.title || `Stack ${index + 1}`}
                                  </p>
                                </div>
                                <p className="text-xs text-zinc-400 mt-1">
                                  {stack.exercises?.length || 0} exercise{stack.exercises?.length !== 1 ? 's' : ''} • Click to view details
                                </p>
                              </div>
                              <button
                                onClick={(_e) => {
                                  setSelectedStacks(prev => prev.filter(s => (s.roundWorkoutId || s.id) !== (stack.roundWorkoutId || stack.id)));
                                }}
                                className="ml-2 text-red-400/60 hover:text-red-400 transition-colors p-1"
                                title="Remove from round"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-[#262a30] border border-zinc-700 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                              <Layout className="w-4 h-4 text-zinc-400" />
                            </div>
                            <p className="text-sm text-zinc-400 font-medium">No Stacks Yet</p>
                            <p className="text-xs text-zinc-500 max-w-xs">
                              This round doesn't have any workout stacks yet. Use AI generation or manual selection to add stacks.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-3 p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <p className="text-xs text-zinc-500 text-center">
                          💡 {selectedStacks.length > 0 
                            ? "These are the current stacks in this round. You can modify the round using AI or manual selection."
                            : "Add stacks to this round using the AI generation or manual stack selection below."
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}



                <button
                onClick={() => setIsAIMode(false)}
                className="w-full py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                >
                {selectedExistingChallenge 
                  ? "Cancel and return to manual editing" 
                  : "Cancel and return to manual creation"
                }
                </button>
            </div>
            ) : (
            <MobileChallengeSetupView
                setChallengeData={handleLocalSetChallengeData} // Pass the new handler
                currentChallengeData={challengeData}
                selectedStacks={selectedStacks}
                setSelectedStacks={setSelectedStacks}
                onRemoveStack={handleRemoveStack}
                viewModel={viewModel}
            />
            )}
        </div>
        
        
        {!isAIMode && (
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-[#1a1e24] border-t border-zinc-700">
            <button
                className="w-full py-4 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
                onClick={handleCreateRound}
                disabled={selectedStacks.length === 0} // Disable if no stacks selected in manual mode
            >
                Create Round
            </button>
            </div>
        )}
        </div>

        {/* Center Container: AI Chat + Round Prompt (Vertical Stack) */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 h-full">
          {/* AI Chat Collaboration Area - Conditional with Animation */}
          {programmingConversationHistory.length > 0 && (
            <div className={`flex-1 min-w-0 bg-[#1a1e24] rounded-xl shadow-xl relative flex flex-col overflow-hidden ${
              hasChatAreaBeenShown ? 'chat-area-visible' : 'chat-area-enter'
            }`}>
          {/* Gradient borders */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-[#E0FE10] to-purple-500"></div>
          <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-purple-500 via-[#E0FE10] to-purple-500"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-[#E0FE10] to-purple-500"></div>
          <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-gradient-to-t from-purple-500 via-[#E0FE10] to-purple-500"></div>
          
          {/* Header */}
          <div className="p-4 border-b border-zinc-700">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#E0FE10] animate-pulse"></div>
              <h3 className="font-medium text-white">AI Assistant</h3>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Chat with AI about your round before generating</p>
          </div>
          
          {/* Chat Messages Area */}
          <div 
            ref={chatMessagesRef} 
            className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800"
            onScroll={handleChatScroll}
          >
            <div className="space-y-4">
              {/* Clean initial state for chat */}
              {chatMessages.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Brain className="w-8 h-8 text-black" />
                    </div>
                    <p className="text-zinc-400 text-lg mb-2">Ready to collaborate?</p>
                    <p className="text-zinc-500 text-sm">Describe your fitness round below and I'll help you create it.</p>
                  </div>
                </div>
              )}
              
              {/* Hide starter cards for cleaner look */}
              {chatMessages.length === 0 && false && (
                <div className="space-y-4">
                  <div className="grid gap-3">
                    {/* Starter Prompt 1 - Strength & Hypertrophy */}
                    <button
                      onClick={() => setAiPromptText("I have a client who wants to build upper body strength and muscle mass. They're intermediate level and have been training for about 2 years. I want to focus on improving their rear delts and creating a better V-taper for their physique.")}
                      className="text-left p-4 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 rounded-lg transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/30 transition-colors">
                          <Dumbbell className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-white mb-1">Strength & Hypertrophy Focus</h4>
                          <p className="text-base text-zinc-400">Upper body program for intermediate client focusing on rear delts and V-taper development</p>
                        </div>
                      </div>
                    </button>

                    {/* Starter Prompt 2 - Beginner Program */}
                    <button
                      onClick={() => setAiPromptText("I need to create a beginner-friendly program for someone who is new to fitness. They want to lose weight and build general fitness, but they're intimidated by complex workouts. I want something progressive that builds confidence.")}
                      className="text-left p-4 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 rounded-lg transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-green-500/30 transition-colors">
                          <Users className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-white mb-1">Beginner Transformation</h4>
                          <p className="text-base text-zinc-400">Progressive program for fitness newcomers focused on weight loss and confidence building</p>
                        </div>
                      </div>
                    </button>

                    {/* Starter Prompt 3 - Athletic Performance */}
                    <button
                      onClick={() => setAiPromptText("I'm working with an athlete who needs to improve their explosive power and agility for their sport. They already have a solid strength base but need more functional movement patterns and plyometric work.")}
                      className="text-left p-4 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 rounded-lg transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
                          <Zap className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-white mb-1">Athletic Performance</h4>
                          <p className="text-base text-zinc-400">Sport-specific training for explosive power, agility, and functional movement patterns</p>
                        </div>
                      </div>
                    </button>
                  </div>
                  
                  <div className="text-center pt-4">
                    <p className="text-xs text-zinc-500">💡 Pro tip: Tag clients with @ to include their fitness profiles in your program design</p>
                  </div>
                </div>
              )}
              
              {/* Conversation Messages */}
              {chatMessages.map((message, index) => (
                <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-black" />
                    </div>
                  )}
                  <div className={`rounded-lg p-3 max-w-[80%] ${
                    message.role === 'user' 
                      ? 'bg-[#E0FE10]/20 border border-[#E0FE10]/30' 
                      : 'bg-zinc-800'
                  }`}>
                    <p className="text-xl text-zinc-300 whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/40 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-4 h-4 text-[#E0FE10]" />
                    </div>
                  )}
                </div>
              ))}

              {/* Enhanced loading indicator when AI is responding */}
              {isAIResponding && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4 max-w-[80%] border border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-[#E0FE10]" />
                      <p className="text-sm font-medium text-[#E0FE10]">
                        AI Coach Thinking...
                      </p>
                    </div>
                    
                    {/* Display last thinking if available */}
                    {(() => {
                      const lastThinking = programmingConversationHistory
                        .slice()
                        .reverse()
                        .find(m => m.role === 'assistant' && m.thinking)?.thinking;
                      
                      return lastThinking ? (
                        <div className="space-y-2">
                          <p className="text-xs text-zinc-400 italic">
                            "{lastThinking}"
                          </p>
                          <div className="flex items-center gap-1">
                            <div className="flex gap-1">
                              <div className="w-1 h-1 bg-zinc-500 rounded-full animate-pulse"></div>
                              <div className="w-1 h-1 bg-zinc-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                              <div className="w-1 h-1 bg-zinc-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                            </div>
                            <span className="text-xs text-zinc-500">analyzing your request</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-300">
                          Analyzing your fitness goals and preferences...
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Generate Round Card - show when AI is ready */}
              {showGenerateCard && !isAIResponding && (
                <div className="flex justify-center w-full">
                  <div className="bg-gradient-to-br from-[#E0FE10]/10 to-purple-500/10 border border-[#E0FE10]/30 rounded-xl p-6 max-w-md w-full shadow-lg">
                    <div className="text-center mb-4">
                      <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center mx-auto mb-3">
                        <Zap className="w-6 h-6 text-black" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Ready to Generate!</h3>
                      <p className="text-sm text-zinc-400">
                        Perfect! I have all the information needed to create your personalized training round.
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Program Summary */}
                      <div className="bg-zinc-800/50 rounded-lg p-3 text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-zinc-400">Questions Asked:</span>
                          <span className="text-[#E0FE10]">{questionCount}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-zinc-400">Tagged Clients:</span>
                          <span className="text-white">{taggedUsers.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Status:</span>
                          <span className="text-[#E0FE10]">
                            {isAwaitingConfirmation ? '🤔 Awaiting Confirmation' : '✓ Ready to Generate'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Regeneration mode indicator */}
                      {isRegenerationMode && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                          <div className="flex items-center gap-2 text-blue-400 text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="font-medium">Regeneration Mode</span>
                          </div>
                          <p className="text-zinc-300 text-xs mt-1">
                            You have {selectedStacks.length} existing workout{selectedStacks.length !== 1 ? 's' : ''}. 
                            Regenerating will replace them with new AI-generated workouts.
                          </p>
                        </div>
                      )}
                      
                      {/* Generate Button */}
                      <button
                        className="w-full py-3 bg-gradient-to-r from-[#E0FE10] via-purple-500 to-[#E0FE10] 
                                  text-black rounded-lg font-semibold hover:opacity-90 transition-opacity
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleGenerateAIRound}
                        disabled={isGenerating || isLoadingConversation}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {(isGenerating || isLoadingConversation) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          <span>
                            {isLoadingConversation ? 'Loading Conversation...' : 
                             isGenerating ? 'Generating Round...' : 
                             isRegenerationMode ? 'Regenerate Round' : 'Generate My Round'}
                          </span>
                        </div>
                      </button>
                      
                      {/* Optional: Continue conversation option */}
                      <button 
                        className="w-full py-2 text-zinc-400 hover:text-white transition-colors text-xs"
                        onClick={() => setShowGenerateCard(false)}
                      >
                        Want to modify something? Continue the conversation below
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
        )}
        
          {/* Pulse Programming Logo - Only show when no conversation */}
          {programmingConversationHistory.length === 0 && (
            <img 
              src="/PulseProgrammingLogoWhite.png" 
              alt="Pulse Programming" 
              className="w-32 mx-auto mb-6 opacity-80 block"
            />
          )}
          
          {/* Input Area */}
          <div className="w-full max-w-3xl mx-auto">
            <div className="bg-[#1a1e24] rounded-xl shadow-xl p-6">
              {/* Welcome text - Only show when no conversation */}
              {programmingConversationHistory.length === 0 && (
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-medium text-white mb-2">Ready when you are.</h2>
                  <p className="text-zinc-400 text-sm">Describe your training goals to start the conversation</p>
                </div>
              )}
            
            {/* Tagged Users Display */}
            {taggedUsers.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-[#E0FE10]" />
                  <span className="text-sm text-zinc-400">Tagged Users:</span>
                </div>
                <div className="relative">
                  {/* Left Arrow */}
                  {taggedUsers.length > 1 && canScrollLeft && (
                    <button
                      onClick={() => scrollTaggedUsers('left')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-zinc-800/90 hover:bg-zinc-700/90 rounded-full flex items-center justify-center transition-colors shadow-lg border border-zinc-600"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                  )}
                  
                  {/* Right Arrow */}
                  {taggedUsers.length > 1 && canScrollRight && (
                    <button
                      onClick={() => scrollTaggedUsers('right')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-zinc-800/90 hover:bg-zinc-700/90 rounded-full flex items-center justify-center transition-colors shadow-lg border border-zinc-600"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                  )}
                  
                  {/* Scrollable container */}
                                     <div 
                     className={`flex gap-2 overflow-x-auto scrollbar-none ${taggedUsers.length > 1 ? 'px-10' : ''}`}
                     style={{ scrollBehavior: 'smooth' }}
                   >
                    {taggedUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-2 bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-lg px-3 py-2 min-w-fit">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#E0FE10] to-purple-500 flex items-center justify-center">
                          {user.profileImage?.profileImageURL ? (
                            <img 
                              src={user.profileImage.profileImageURL} 
                              alt={user.displayName || user.username}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <UserCircle className="w-4 h-4 text-black" />
                          )}
                        </div>
                        <span className="text-white text-sm font-medium">
                          {user.displayName || user.username}
                        </span>
                        <button
                          onClick={() => handleRemoveTaggedUser(user.id)}
                          className="text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Unified Input Area - Works for both starting and continuing conversations */}
            <div className="flex gap-4 relative">
                <div className="flex-1 relative">
                  <textarea
                    ref={chatTextareaRef}
                    value={aiPromptText}
                    onChange={handlePromptTextChange}
                    placeholder="E.g., Create a 4-week strength program focused on building muscle in my shoulders and upper back. Use @ to tag users for personalized recommendations..."
                    rows={4}
                    className="w-full p-4 bg-[#262a30] rounded-lg border border-zinc-700 
                              text-white placeholder:text-zinc-500 
                              focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
                  />
                  
                  {/* User Search Dropdown */}
                  {showUserDropdown && filteredUsers.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#262a30] border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                      {filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleUserSelect(user)}
                          className="w-full p-3 text-left hover:bg-zinc-700 transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#E0FE10] to-purple-500 flex items-center justify-center">
                            {user.profileImage?.profileImageURL ? (
                              <img 
                                src={user.profileImage.profileImageURL} 
                                alt={user.displayName || user.username}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <UserCircle className="w-4 h-4 text-black" />
                            )}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">
                              {user.displayName || user.username}
                            </p>
                            <p className="text-zinc-400 text-xs">
                              {user.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  <button
                    className="px-6 py-3 bg-gradient-to-r from-[#E0FE10] via-purple-500 to-[#E0FE10] 
                              text-black rounded-lg font-semibold hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-50"
                    onClick={() => {
                      handleSendChatMessage(aiPromptText);
                      setAiPromptText(''); // Clear the prompt after sending
                    }}
                    disabled={!aiPromptText.trim() || isAIResponding}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {isAIResponding ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                      ) : (
                        programmingConversationHistory.length > 0 ? (
                          <Send className="w-4 h-4" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )
                      )}
                      <span>
                        {isAIResponding 
                          ? 'Sending...' 
                          : programmingConversationHistory.length > 0 
                            ? 'Send' 
                            : 'Start Collaborating'
                        }
                      </span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setIsAIMode(false)}
                    className="px-6 py-2 text-zinc-400 hover:text-white transition-colors text-sm whitespace-nowrap"
                  >
                    Manual Setup
                  </button>
                </div>
              </div>
            
            <div className="mt-6 text-center">
              <p className="text-xs text-zinc-500">
                💡 Use @ to tag Pulse users for personalized context-aware recommendations
              </p>
            </div>

            {/* Suggestion Buttons - Only show when no conversation has started */}
            {programmingConversationHistory.length === 0 && (
              <div className="mt-8">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Suggestion 1 - Strength Focus */}
                  <button
                    onClick={() => setAiPromptText("Create a 4-week strength program focused on building muscle in shoulders and upper back")}
                    className="text-left p-4 bg-zinc-800/30 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                        <Dumbbell className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-sm font-medium text-white">Strength Program</span>
                    </div>
                    <p className="text-xs text-zinc-400">Build muscle and strength</p>
                  </button>

                  {/* Suggestion 2 - Weight Loss */}
                  <button
                    onClick={() => setAiPromptText("Design a beginner-friendly program for weight loss and general fitness")}
                    className="text-left p-4 bg-zinc-800/30 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                        <Users className="w-4 h-4 text-green-400" />
                      </div>
                      <span className="text-sm font-medium text-white">Weight Loss</span>
                    </div>
                    <p className="text-xs text-zinc-400">Beginner-friendly transformation</p>
                  </button>

                  {/* Suggestion 3 - Athletic Performance */}
                  <button
                    onClick={() => setAiPromptText("Create an athletic performance program for explosive power and agility")}
                    className="text-left p-4 bg-zinc-800/30 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                        <Zap className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-sm font-medium text-white">Athletic Performance</span>
                    </div>
                    <p className="text-xs text-zinc-400">Sport-specific training</p>
                  </button>

                  {/* Suggestion 4 - Home Workout */}
                  <button
                    onClick={() => setAiPromptText("Plan a home workout routine with minimal equipment")}
                    className="text-left p-4 bg-zinc-800/30 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                        <Home className="w-4 h-4 text-orange-400" />
                      </div>
                      <span className="text-sm font-medium text-white">Home Workout</span>
                    </div>
                    <p className="text-xs text-zinc-400">Minimal equipment needed</p>
                  </button>

                  {/* Suggestion 5 - Powerlifting */}
                  <button
                    onClick={() => setAiPromptText("Build a powerlifting program to increase my squat, bench, and deadlift")}
                    className="text-left p-4 bg-zinc-800/30 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                        <Trophy className="w-4 h-4 text-red-400" />
                      </div>
                      <span className="text-sm font-medium text-white">Powerlifting</span>
                    </div>
                    <p className="text-xs text-zinc-400">Squat, bench, deadlift focus</p>
                  </button>

                  {/* Suggestion 6 - Cutting Program */}
                  <button
                    onClick={() => setAiPromptText("Create a cutting program to maintain muscle while losing body fat")}
                    className="text-left p-4 bg-zinc-800/30 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                        <Target className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-sm font-medium text-white">Cutting Program</span>
                    </div>
                    <p className="text-xs text-zinc-400">Maintain muscle, lose fat</p>
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Right Panel: Split into two stacked panels */}
        <div className={`${
          isRightPanelCollapsed ? 'w-8' : 'w-[500px]'
        } h-full flex flex-col gap-4 transition-all duration-300 ease-in-out`}>
          
          {isRightPanelCollapsed ? (
            // Collapsed view - optimized for UX
            <div 
              className="h-full flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-800/50 transition-all duration-200 group px-1"
              onClick={toggleRightPanel}
              title="Click to expand round customization"
            >
              {/* Icon hint */}
              <div className="mb-4 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                <Settings size={14} />
              </div>
              
              {/* Vertical text with better spacing */}
              <div 
                className="text-zinc-400 text-xs font-medium whitespace-nowrap group-hover:text-zinc-200 transition-colors tracking-wide"
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  letterSpacing: '0.5px'
                }}
              >
                AI Tools & Round Setup
              </div>
              
              {/* Expand hint */}
              <div className="mt-4 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                <ChevronLeft size={12} />
              </div>
            </div>
          ) : (
            // Expanded view - original content
            <>
              {/* Top Panel: Round Customization */}
          <div className="bg-[#1a1e24] rounded-xl shadow-xl relative flex flex-col overflow-hidden" style={{ height: '45%' }}>
            {/* Gradient borders */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#E0FE10]"></div>
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#E0FE10]"></div>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E0FE10] via-purple-500 to-blue-500"></div>
            <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-gradient-to-t from-[#E0FE10] via-purple-500 to-blue-500"></div>

            {/* --- START: Always Visible Preferences UI Block --- */}
            <div className="p-6 space-y-4 border-b border-zinc-700 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800 max-h-[40vh]"> {/* Added max-height */}
                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white">Round Customization</h3>
                    <button
                      onClick={toggleRightPanel}
                      className="p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                      title="Collapse to sidebar"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Tailor your round with these options. These apply to both AI-generated and manually built rounds.
                  </p>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-medium text-white">Rest Days</h3>
                          <p className="text-sm text-zinc-400">Include specific rest days in your program</p>
                        </div>
                        <Switch
                          checked={challengeData.restDayPreferences?.includeRestDays || false}
                          onChange={handleDesktopIncludeRestDaysChange}
                          className={`${
                            (challengeData.restDayPreferences?.includeRestDays || false) ? 'bg-[#E0FE10]' : 'bg-zinc-700'
                          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                        >
                          <span
                            className={`${
                              (challengeData.restDayPreferences?.includeRestDays || false) ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                          />
                        </Switch>
                      </div>

                      {(challengeData.restDayPreferences?.includeRestDays || false) && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                          {getUiRestDayPreferences().map((pref) => (
                            <button
                              key={pref.day}
                              onClick={() => handleDesktopRestDayPreferencesChange(pref.day)}
                              className={`p-3 rounded-lg text-sm font-medium transition-colors ${ 
                                pref.isSelected
                                  ? 'bg-[#E0FE10] text-black'
                                  : 'bg-zinc-700 text-white hover:bg-zinc-600'
                              }`}
                            >
                              {pref.day}
                            </button>
                          ))}
                        </div>
                      )}
                </div>
                
                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                    <button 
                      onClick={() => setIsGeneralPreferencesCollapsed(!isGeneralPreferencesCollapsed)}
                      className="flex items-center justify-between w-full mb-2 focus:outline-none text-left"
                    >
                      <h3 className="font-medium text-white">General Preferences</h3>
                      <ChevronDown 
                        size={20} 
                        className={`text-white transition-transform duration-200 ${isGeneralPreferencesCollapsed ? '-rotate-90' : ''} flex-shrink-0`}
                      />
                    </button>
                    {!isGeneralPreferencesCollapsed && (
                      <div className="space-y-3 mt-3"> 
                      {generalAiPreferencesOptions.map((preference) => (
                          <label 
                          key={preference}
                          className="flex items-center bg-zinc-800/80 p-3 rounded-lg cursor-pointer hover:bg-zinc-700/70 transition-colors border border-zinc-700"
                          >
                          <input 
                              type="checkbox" 
                              checked={(challengeData.restDayPreferences?.preferences || []).includes(preference)}
                              onChange={() => handleGeneralAiPreferenceToggle(preference)}
                              className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded focus:ring-offset-0 focus:ring-2 focus:ring-[#E0FE10] transition-all"
                          />
                          <span className="ml-3 text-sm text-zinc-300">{preference}</span>
                          </label>
                      ))}
                      </div>
                    )}
                </div>

                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-white">Available Equipment</h3>
                      <p className="text-sm text-zinc-400">Select equipment available for your workouts</p>
                    </div>
                    <Switch
                      checked={challengeData.equipmentPreferences?.equipmentOnly || false}
                      onChange={(checked) => {
                        const currentEquipmentPrefs = challengeData.equipmentPreferences || { selectedEquipment: [], equipmentOnly: false };
                        handleLocalSetChallengeData({
                          equipmentPreferences: {
                            ...currentEquipmentPrefs,
                            equipmentOnly: checked,
                          }
                        });
                      }}
                      className={`${
                        (challengeData.equipmentPreferences?.equipmentOnly || false) ? 'bg-[#E0FE10]' : 'bg-zinc-700'
                      } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                    >
                      <span
                        className={`${
                          (challengeData.equipmentPreferences?.equipmentOnly || false) ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </Switch>
                  </div>

                  {(challengeData.equipmentPreferences?.equipmentOnly || false) && (
                    <div className="mb-3 p-3 bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-lg">
                      <p className="text-xs text-[#E0FE10]">
                        ⚠️ Equipment-only mode: AI will only select exercises that use your selected equipment
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                    {[
                      'Dumbbells', 'Barbell', 'Pull-up Bar', 'Resistance Bands', 
                      'Kettlebells', 'Cable Machine', 'Bench', 'Smith Machine',
                      'Bodyweight Only', 'Cardio Equipment', 'Medicine Ball', 'TRX/Suspension'
                    ].map((equipment) => {
                      const currentEquipment = challengeData.equipmentPreferences?.selectedEquipment || [];
                      const isSelected = currentEquipment.includes(equipment);
                      
                      return (
                        <button
                          key={equipment}
                          onClick={() => {
                            const currentEquipmentPrefs = challengeData.equipmentPreferences || { selectedEquipment: [], equipmentOnly: false };
                            const newSelectedEquipment = isSelected
                              ? currentEquipment.filter(e => e !== equipment)
                              : [...currentEquipment, equipment];
                            
                            handleLocalSetChallengeData({
                              equipmentPreferences: {
                                ...currentEquipmentPrefs,
                                selectedEquipment: newSelectedEquipment,
                              }
                            });
                          }}
                          className={`p-3 rounded-lg text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-[#E0FE10] text-black'
                              : 'bg-zinc-700 text-white hover:bg-zinc-600'
                          }`}
                        >
                          {equipment}
                        </button>
                      );
                    })}
                  </div>

                  {challengeData.equipmentPreferences?.selectedEquipment.length === 0 && (
                    <div className="mt-3 p-3 bg-zinc-700/50 rounded-lg">
                      <p className="text-xs text-zinc-400">
                        💡 No equipment selected. AI will choose from all available exercises.
                      </p>
                    </div>
                  )}
                </div>

                {/* Selected Stacks Display */}
                {selectedStacks.length > 0 && (
                  <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-white flex items-center gap-2">
                        <Layout size={16} />
                        Selected Stacks ({selectedStacks.length})
                      </h3>
                      <button
                        onClick={() => setIsStacksOverviewCollapsed(!isStacksOverviewCollapsed)}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded"
                        title={isStacksOverviewCollapsed ? "Expand stacks" : "Collapse stacks"}
                      >
                        {isStacksOverviewCollapsed ? 'Show' : 'Hide'}
                        <ChevronDown 
                          size={14} 
                          className={`transition-transform duration-200 ${
                            isStacksOverviewCollapsed ? 'rotate-180' : 'rotate-0'
                          }`}
                        />
                      </button>
                    </div>
                    <div className={`transition-all duration-300 overflow-hidden ${
                      isStacksOverviewCollapsed ? 'max-h-0 opacity-0' : 'max-h-32 opacity-100'
                    }`}>
                      <div className="space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-700">
                      {selectedStacks.map((stack, index) => (
                        <div key={`desktop-stack-${index}-${stack.roundWorkoutId || stack.id}`} className="flex items-center justify-between bg-zinc-700 rounded-lg p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{stack.title || `Stack ${index + 1}`}</p>
                            <p className="text-xs text-zinc-400">{stack.exercises?.length || 0} exercises</p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedStacks(prev => prev.filter(s => (s.roundWorkoutId || s.id) !== (stack.roundWorkoutId || stack.id)));
                            }}
                            className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Challenge Type Configuration */}
                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Zap size={16} />
                    Challenge Type
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {['workout', 'steps', 'calories', 'hybrid'].map((type) => (
                      <button
                        key={type}
                        onClick={() => handleLocalSetChallengeData({ challengeType: type as any })}
                        className={`p-3 rounded-lg text-sm font-medium transition-colors capitalize ${
                          challengeData.challengeType === type
                            ? 'bg-[#E0FE10] text-black'
                            : 'bg-zinc-700 text-white hover:bg-zinc-600'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step Configuration (only show if challenge type includes steps) */}
                {(challengeData.challengeType === 'steps' || challengeData.challengeType === 'hybrid') && (
                  <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                    <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                      <Clock size={16} />
                      Step Configuration
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">Daily Step Goal</label>
                        <input
                          type="number"
                          value={challengeData.stepConfiguration?.dailyStepGoal || 10000}
                          onChange={(e) => handleLocalSetChallengeData({
                            stepConfiguration: {
                              ...challengeData.stepConfiguration!,
                              dailyStepGoal: parseInt(e.target.value) || 10000
                            }
                          })}
                          className="w-full px-3 py-2 bg-zinc-700 text-white rounded-lg border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                          min="1000"
                          max="50000"
                          step="500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">Allowed Missed Days</label>
                        <input
                          type="number"
                          value={challengeData.stepConfiguration?.allowedMissedDays || 2}
                          onChange={(e) => handleLocalSetChallengeData({
                            stepConfiguration: {
                              ...challengeData.stepConfiguration!,
                              allowedMissedDays: parseInt(e.target.value) || 0
                            }
                          })}
                          className="w-full px-3 py-2 bg-zinc-700 text-white rounded-lg border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                          min="0"
                          max="7"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Meal Tracking Configuration */}
                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-white flex items-center gap-2">
                      <div className="w-4 h-4">🍎</div>
                      Meal Tracking
                    </h3>
                    <Switch
                      checked={challengeData.mealTracking?.isEnabled || false}
                      onChange={(enabled) => handleLocalSetChallengeData({
                        mealTracking: { ...challengeData.mealTracking!, isEnabled: enabled }
                      })}
                      className={`${
                        challengeData.mealTracking?.isEnabled ? 'bg-[#E0FE10]' : 'bg-zinc-700'
                      } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                    >
                      <span
                        className={`${
                          challengeData.mealTracking?.isEnabled ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </Switch>
                  </div>
                  
                  {/* Show configured status when enabled */}
                  {challengeData.mealTracking?.isEnabled && (
                    <div className="mt-2 p-2 bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                        <span className="text-xs text-[#E0FE10] font-medium">
                          Configured - {challengeData.mealTracking?.configurationType === 'customMacros' ? 'Custom Macros' : 'Meal Plan'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Meal Tracking Configuration Details (only show if meal tracking is enabled) */}
                {challengeData.mealTracking?.isEnabled && (
                  <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                    <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                      <div className="w-4 h-4">⚙️</div>
                      Meal Tracking Configuration
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">Configuration Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['customMacros', 'mealPlan'].map((type) => (
                            <button
                              key={type}
                              onClick={() => handleLocalSetChallengeData({
                                mealTracking: { ...challengeData.mealTracking!, configurationType: type as any }
                              })}
                              className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                                challengeData.mealTracking?.configurationType === type
                                  ? 'bg-[#E0FE10] text-black'
                                  : 'bg-zinc-700 text-white hover:bg-zinc-600'
                              }`}
                            >
                              {type === 'customMacros' ? 'Custom Macros' : 'Meal Plan'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {challengeData.mealTracking?.configurationType === 'customMacros' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Calories</label>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  placeholder="Min"
                                  value={challengeData.mealTracking?.customMacroRanges?.calorieRange?.min || 1800}
                                  onChange={(e) => updateMacroRange('calorieRange', 'min', parseInt(e.target.value) || 1800)}
                                  className="flex-1 px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                />
                                <input
                                  type="number"
                                  placeholder="Max"
                                  value={challengeData.mealTracking?.customMacroRanges?.calorieRange?.max || 2200}
                                  onChange={(e) => updateMacroRange('calorieRange', 'max', parseInt(e.target.value) || 2200)}
                                  className="flex-1 px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Protein (g)</label>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  placeholder="Min"
                                  value={challengeData.mealTracking?.customMacroRanges?.proteinRange?.min || 120}
                                  onChange={(e) => updateMacroRange('proteinRange', 'min', parseInt(e.target.value) || 120)}
                                  className="flex-1 px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                />
                                <input
                                  type="number"
                                  placeholder="Max"
                                  value={challengeData.mealTracking?.customMacroRanges?.proteinRange?.max || 180}
                                  onChange={(e) => updateMacroRange('proteinRange', 'max', parseInt(e.target.value) || 180)}
                                  className="flex-1 px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Carbs (g)</label>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  placeholder="Min"
                                  value={challengeData.mealTracking?.customMacroRanges?.carbRange?.min || 200}
                                  onChange={(e) => updateMacroRange('carbRange', 'min', parseInt(e.target.value) || 200)}
                                  className="flex-1 px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                />
                                <input
                                  type="number"
                                  placeholder="Max"
                                  value={challengeData.mealTracking?.customMacroRanges?.carbRange?.max || 300}
                                  onChange={(e) => updateMacroRange('carbRange', 'max', parseInt(e.target.value) || 300)}
                                  className="flex-1 px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Fat (g)</label>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  placeholder="Min"
                                  value={challengeData.mealTracking?.customMacroRanges?.fatRange?.min || 60}
                                  onChange={(e) => updateMacroRange('fatRange', 'min', parseInt(e.target.value) || 60)}
                                  className="flex-1 px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                />
                                <input
                                  type="number"
                                  placeholder="Max"
                                  value={challengeData.mealTracking?.customMacroRanges?.fatRange?.max || 100}
                                  onChange={(e) => updateMacroRange('fatRange', 'max', parseInt(e.target.value) || 100)}
                                  className="flex-1 px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Points per Day</label>
                              <input
                                type="number"
                                value={challengeData.mealTracking?.pointsPerDay || 100}
                                onChange={(e) => handleLocalSetChallengeData({
                                  mealTracking: { ...challengeData.mealTracking!, pointsPerDay: parseInt(e.target.value) || 100 }
                                })}
                                className="w-full px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                min="1"
                                max="1000"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Tolerance (%)</label>
                              <input
                                type="number"
                                value={(challengeData.mealTracking?.tolerancePercentage || 0.10) * 100}
                                onChange={(e) => handleLocalSetChallengeData({
                                  mealTracking: { ...challengeData.mealTracking!, tolerancePercentage: (parseInt(e.target.value) || 10) / 100 }
                                })}
                                className="w-full px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                min="1"
                                max="50"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {challengeData.mealTracking?.configurationType === 'mealPlan' && (
                        <div className="space-y-3">
                          <div className="p-3 bg-zinc-700/50 rounded-lg border border-zinc-600">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-white font-medium">Selected Meal Plan</p>
                                <p className="text-xs text-zinc-400 mt-1">
                                  {challengeData.mealTracking?.mealPlanName || (challengeData.mealTracking?.linkedMealPlanId ? 'Meal plan selected' : 'No meal plan selected')}
                                </p>
                              </div>
                              <button 
                                className="px-3 py-1 bg-[#E0FE10] text-black text-xs font-medium rounded-lg hover:bg-[#E0FE10]/90 transition-colors"
                                onClick={() => {
                                  // TODO: Implement meal plan selection modal
                                  alert('Meal plan selection coming soon!');
                                }}
                              >
                                {challengeData.mealTracking?.mealPlanName ? 'Change Plan' : 'Choose Plan'}
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Points per Day</label>
                              <input
                                type="number"
                                value={challengeData.mealTracking?.pointsPerDay || 100}
                                onChange={(e) => handleLocalSetChallengeData({
                                  mealTracking: { ...challengeData.mealTracking!, pointsPerDay: parseInt(e.target.value) || 100 }
                                })}
                                className="w-full px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                min="1"
                                max="1000"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-400 mb-1">Tolerance (%)</label>
                              <input
                                type="number"
                                value={(challengeData.mealTracking?.tolerancePercentage || 0.10) * 100}
                                onChange={(e) => handleLocalSetChallengeData({
                                  mealTracking: { ...challengeData.mealTracking!, tolerancePercentage: (parseInt(e.target.value) || 10) / 100 }
                                })}
                                className="w-full px-2 py-1 bg-zinc-700 text-white rounded text-xs border border-zinc-600 focus:border-[#E0FE10] focus:outline-none"
                                min="1"
                                max="50"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
            {/* --- END: Always Visible Preferences UI Block --- */}
          </div>
          
          {/* Bottom Panel: AI Tools and Stack Selection */}
          <div className="bg-[#1a1e24] rounded-xl shadow-xl relative flex flex-col overflow-hidden" style={{ height: '55%' }}>
            {/* Gradient borders */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#E0FE10]"></div>
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#E0FE10]"></div>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E0FE10] via-purple-500 to-blue-500"></div>
            <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-gradient-to-t from-purple-500 via-purple-500 to-blue-500"></div>
            
            {/* Container for conditional content, takes remaining space */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {isAIMode ? (
                  <>
                  {/* Tabs - AI Preferences (Brain icon) tab is REMOVED */}
                  <div className="px-6 pt-6">
                      <div className="flex space-x-1 bg-[#262a30] p-1 rounded-lg">
                      {/* AI Preferences Tab (Brain Icon) is REMOVED */}
                      <button
                          onClick={() => setActiveTab('moves')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all
                          ${activeTab === 'moves' 
                              ? 'bg-[#E0FE10] text-black' 
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}
                      >
                          <Dumbbell size={16} />
                          <span>Must-Include Moves</span>
                      </button>
                      <button
                          onClick={() => setActiveTab('creators')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all
                          ${activeTab === 'creators' 
                              ? 'bg-[#E0FE10] text-black' 
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'}`}
                      >
                          <UserCircle size={16} />
                          <span>Preferred Creators</span>
                      </button>
                      </div>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800">
                  {/* activeTab === 'preferences' block is REMOVED from here */}
                      {activeTab === 'moves' && (
                      <div className="space-y-4">
                          <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                            <h3 className="font-medium text-white mb-2">Filter Moves by Creator</h3>
                            <p className="text-sm text-zinc-400 mb-3">
                              Optionally, select creators to narrow down the list of moves below. This filter only applies to this tab.
                            </p>
                            <MultiUserSelector
                              selectedUserIds={movesTabSelectedCreatorIds}
                              onUserSelect={(userId) => {
                                setMovesTabSelectedCreatorIds(prev => [...prev, userId]);
                              }}
                              onUserRemove={(userId) => {
                                setMovesTabSelectedCreatorIds(prev => prev.filter(id => id !== userId));
                              }}
                            />
                          </div>

                          <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                            <h3 className="font-medium text-white mb-2">Search & Select Must-Have Moves</h3>
                            <p className="text-sm text-zinc-400">
                              AI will guarantee these exercises are included in your program. Search by name after applying creator filters if any.
                            </p>
                          </div>
                          
                          <input
                          type="text"
                          placeholder="Search moves by name..."
                          value={movesSearchTerm} 
                          onChange={(e) => setMovesSearchTerm(e.target.value)} 
                          className="w-full p-4 bg-[#262a30] text-white rounded-lg border border-zinc-700 focus:border-[#E0FE10] transition-colors"
                          />
                          <ExerciseGrid
                          userVideos={filteredExercisesForSelection} // Use filtered list
                          multiSelection={true}
                          selectedExercises={selectedMoves}
                          onToggleSelection={(exercise) => {
                              setSelectedMoves(prev => 
                              prev.some(e => e.id === exercise.id)
                                  ? prev.filter(e => e.id !== exercise.id)
                                  : [...prev, exercise]
                              )
                          }}
                          onSelectVideo={(exercise) => { // Should be same as onToggleSelection for multi
                              setSelectedMoves(prev => 
                              prev.some(e => e.id === exercise.id)
                                  ? prev.filter(e => e.id !== exercise.id)
                                  : [...prev, exercise]
                              )
                          }}
                          />
                      </div>
                      )}

                      {activeTab === 'creators' && (
                      <div className="space-y-4">
                          <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                            <h3 className="font-medium text-white mb-2">Preferred Creators</h3>
                            <p className="text-sm text-zinc-400">
                              Select trainers whose exercise videos you want to include in your program
                            </p>
                          </div>
                          <MultiUserSelector
                          selectedUserIds={selectedCreators}
                          onUserSelect={(userId) => {
                              setSelectedCreators(prev => {
                                const updatedCreators = [...prev, userId];
                                // Auto-save AI settings only if we have a conversation
                                if (autoSave && currentConversationId) {
                                  autoSave({ 
                                    aiSettings: { 
                                      selectedCreators: updatedCreators,
                                      mustIncludeMoves: selectedMoves,
                                      useOnlyCreatorExercises: false
                                    },
                                    updatedAt: new Date()
                                  });
                                }
                                return updatedCreators;
                              });
                          }}
                          onUserRemove={(userId) => {
                              setSelectedCreators(prev => {
                                const updatedCreators = prev.filter(id => id !== userId);
                                // Auto-save AI settings only if we have a conversation
                                if (autoSave && currentConversationId) {
                                  autoSave({ 
                                    aiSettings: { 
                                      selectedCreators: updatedCreators,
                                      mustIncludeMoves: selectedMoves,
                                      useOnlyCreatorExercises: false
                                    },
                                    updatedAt: new Date()
                                  });
                                }
                                return updatedCreators;
                              });
                          }}
                          />
                      </div>
                      )}
                  </div>

                  {/* Summary Footer */}
                  <div className="p-4 border-t border-zinc-700 bg-zinc-800/50">
                      <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">
                          {selectedMoves.length} moves selected
                      </span>
                      <span className="text-zinc-400">
                          {selectedCreators.length} creators selected
                      </span>
                      <span className="text-zinc-400">
                          {challengeData.equipmentPreferences?.selectedEquipment.length || 0} equipment selected
                      </span>
                      </div>
                  </div>
                  </>
              ) : (
                  // Original Stack Selector Content (Now below the always-visible preferences)
                  <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800">
                      <div className="flex flex-col items-center mb-6">
                          <div className="w-56 h-24 flex items-center justify-center mb-2">
                              <img 
                                  src="/PulseProgrammingLogoWhite.png" 
                                  alt="Pulse Programming Logo" 
                                  className="object-contain max-h-full max-w-full"
                              />
                          </div>
                          <h2 className="text-white text-2xl font-bold">Manual Stack Selection</h2>
                          <p className="text-zinc-400 text-center text-sm mt-1 mb-6">
                              Build your round by selecting specific stacks from your library
                          </p>
                      </div>
                      <h2 className="text-white text-xl font-bold mb-4">Your Stacks</h2>
                      <input
                          type="text"
                          placeholder="Search stacks..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full p-4 bg-[#262a30] text-white rounded-lg border border-zinc-700 focus:border-[#E0FE10] transition-colors mb-4"
                      />
                      {filteredStacks.length === 0 ? (
                          <p className="text-center text-zinc-500">No stacks found</p>
                      ) : (
                          filteredStacksList()
                      )}
                  </div>
              )}
            </div>
          </div>
          {/* End of bottom panel */}
            </>
          )}
        </div>

          {/* Conversation History Panel */}
        <div className={`${
          isConversationPanelCollapsed ? 'w-8' : 'w-80'
        } h-full bg-zinc-900 border-l border-zinc-700 flex flex-col transition-all duration-300 ease-in-out`}>
                     {isConversationPanelCollapsed ? (
             // Collapsed view - optimized for UX
             <div 
               className="h-full flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-800/50 transition-all duration-200 group px-1"
               onClick={toggleConversationPanel}
               title="Click to expand conversations"
             >
               {/* Icon hint with count badge */}
               <div className="mb-4 text-zinc-500 group-hover:text-zinc-300 transition-colors relative">
                 <History size={16} />
                 {allConversations.length > 0 && (
                   <div 
                     className="absolute -top-1 -right-1 bg-[#E0FE10] text-black text-xs font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-sm"
                     style={{ transform: 'rotate(90deg)' }}
                   >
                     {allConversations.length > 99 ? '99+' : allConversations.length}
                   </div>
                 )}
               </div>
               
               {/* Vertical text with better spacing */}
               <div 
                 className="text-zinc-400 text-xs font-medium whitespace-nowrap group-hover:text-zinc-200 transition-colors tracking-wide"
                 style={{
                   writingMode: 'vertical-rl',
                   textOrientation: 'mixed',
                   letterSpacing: '0.5px'
                 }}
               >
                 {allConversations.length > 0 ? 'Past Sessions' : 'History'}
               </div>
               
               {/* Visual expand hint */}
               <div className="mt-4 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                 <ChevronRight size={12} />
               </div>
             </div>
          ) : (
            // Expanded view - normal content
            <>
              <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <History size={20} />
                  Conversations
                </h3>
                <button
                  onClick={toggleConversationPanel}
                  className="p-1 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                  title="Collapse to sidebar"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
              
              <div className="p-4 border-b border-zinc-700">
                <button
                  onClick={handleCreateNewConversation}
                  disabled={isLoadingConversation}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-[#E0FE10] text-black rounded-lg hover:bg-[#d4e600] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                  {isLoadingConversation ? 'Loading...' : 'New Conversation'}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {allConversations.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500">
                    <MessageSquare size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                    <p className="text-sm">Start chatting to create your first conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-2 p-4">
                    {allConversations.map((conversation: any) => (
                      <button
                        key={conversation.id}
                        onClick={() => {
                          console.log('🖱️ [DEBUG] Conversation button clicked:', conversation.id);
                          handleSwitchConversation(conversation.id);
                        }}
                        className={`w-full p-3 rounded-lg text-left transition-colors border ${
                          conversation.id === currentConversationId
                            ? 'bg-zinc-800 border-[#E0FE10] text-white'
                            : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">
                              {conversation.title || 'Untitled Session'}
                            </h4>
                            <p className="text-xs text-zinc-500 mt-1">
                              {conversation.messages.length} messages
                            </p>
                            {conversation.challengeData.challengeName && (
                              <p className="text-xs text-zinc-400 mt-1 truncate">
                                Round: {conversation.challengeData.challengeName}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 ml-2">
                            {new Date(conversation.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {/* End of right panels wrapper */}

    </div>
    
   
   
      {/* Stack Detail Modal */}
      <StackDetailModal
        isOpen={isStackModalOpen}
        onClose={handleCloseStackModal}
        stack={selectedStackForModal}
      />

      {/* Round Creation Success Modal */}
      <RoundSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={handleCloseSuccessModal}
        roundData={createdRoundData}
        onViewRound={handleViewRound}
        onContinueEditing={handleContinueEditing}
      />
    </>
  );
};

// Tutorial Modal Component
interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 5;

  const goToNextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
      } else {
      // On the last slide, close the modal when "Get Started" is clicked
      onClose();
    }
  };

  const goToPrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // If the modal is not open, don't render anything
  if (!isOpen) return null;

  // Define the content for each slide
  const slides = [
    // Slide 1: Introduction to Pulse Programming
    <div key="slide-1" className="flex flex-col items-center">
      <div className="w-56 h-24 flex items-center justify-center mb-6">
        <img 
          src="/PulseProgrammingLogoWhite.png" 
          alt="Pulse Programming Logo" 
          className="object-contain max-h-full max-w-full"
        />
      </div>
      <div className="h-20 w-20 bg-[#E0FE10] rounded-full flex items-center justify-center mb-6">
        <Zap className="h-10 w-10 text-black" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Welcome to Pulse Programming</h2>
      <p className="text-zinc-400 text-center mb-6 max-w-md">
        Transform your fitness expertise into structured, sharable training experiences that guide your community to their goals.
      </p>
      <p className="text-zinc-300 text-center mb-4 max-w-md">
        This quick tutorial will show you how to create your first Round in just a few minutes.
      </p>
    </div>,

    // Slide 2: Core Concepts (Rounds, Stacks, and Moves)
    <div key="slide-2" className="flex flex-col items-center">
      <div className="h-16 w-16 bg-purple-500 rounded-full flex items-center justify-center mb-6">
        <Layout className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Core Concepts</h2>
      <div className="grid gap-6 max-w-md">
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
          <h3 className="text-[#E0FE10] font-semibold text-lg mb-2">Rounds</h3>
          <p className="text-zinc-400">
            Structured training programs that span multiple days or weeks. Think of rounds as your complete fitness programs or challenges.
          </p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
          <h3 className="text-[#E0FE10] font-semibold text-lg mb-2">Stacks</h3>
          <p className="text-zinc-400">
            Individual workouts that make up a round. Each stack contains a set of exercises designed to be completed in a single session.
          </p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
          <h3 className="text-[#E0FE10] font-semibold text-lg mb-2">Moves</h3>
          <p className="text-zinc-400">
            The specific exercises that make up a stack. Select from a library of moves or use AI to recommend the perfect exercises for your training goals.
          </p>
        </div>
      </div>
    </div>,

    // Slide 3: AI-Powered Round Generation
    <div key="slide-3" className="flex flex-col items-center">
      <div className="h-16 w-16 bg-blue-500 rounded-full flex items-center justify-center mb-6">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">AI-Powered Round Creation</h2>
      <div className="space-y-4 max-w-md">
        <p className="text-zinc-400 text-center mb-2">
          Let our AI do the heavy lifting by generating personalized training rounds based on your specific goals and preferences.
        </p>
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
          <ol className="list-decimal list-inside space-y-3 text-zinc-300">
            <li>Enter your round details (name, description, dates)</li>
            <li>Describe your training goals in the prompt</li> 
            <li>Customize with preferred moves and creators</li>
            <li>Set rest day preferences if needed</li>
            <li>Click "Generate Round" and let AI create your program</li>
          </ol>
        </div>
        <p className="text-zinc-400 text-center mt-2">
          The AI adapts to your needs—whether you're building strength, improving endurance, or focusing on specific muscle groups.
        </p>
      </div>
    </div>,

    // Slide 4: Manual Round Creation
    <div key="slide-4" className="flex flex-col items-center">
      <div className="h-16 w-16 bg-amber-500 rounded-full flex items-center justify-center mb-6">
        <Lightbulb className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Manual Round Creation</h2>
      <div className="space-y-4 max-w-md">
        <p className="text-zinc-400 text-center mb-2">
          For complete control, you can manually build your rounds by selecting specific stacks from your library.
        </p>
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
          <ol className="list-decimal list-inside space-y-3 text-zinc-300">
            <li>Enter your round details (name, description, dates)</li>
            <li>Choose "Manual Setup" from the top right</li>
            <li>Browse and select stacks from your library</li>
            <li>Arrange them in your preferred order</li>
            <li>Set rest days and privacy settings</li>
            <li>Click "Create Round" to finalize</li>
          </ol>
        </div>
        <p className="text-zinc-400 text-center mt-2">
          Perfect for trainers who already have specific workouts in mind or want to reuse their existing stacks.
        </p>
      </div>
    </div>,

    // Slide 5: Demo Video & Call to Action
    <div key="slide-5" className="flex flex-col items-center">
      <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mb-6">
        <Video className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">See It In Action</h2>
      
      <div className="w-full max-w-md aspect-video bg-zinc-800 rounded-lg border border-zinc-700 flex items-center justify-center mb-6">
        {/* Placeholder for video - will be replaced with actual video player */}
        <div className="text-zinc-400 text-center p-4">
          <p className="mb-2">Video demonstration coming soon</p>
          <p className="text-sm">This video will walk you through creating your first round step-by-step</p>
        </div>
      </div>
      
      <p className="text-zinc-300 text-center mb-8 max-w-md">
        Now you're ready to create your first Pulse Programming Round! Click "Get Started" below to begin.
      </p>
    </div>
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1e24] rounded-xl w-full max-w-5xl mx-4 overflow-hidden shadow-2xl">
        {/* Progress bar */}
        <div className="w-full h-1 bg-zinc-800">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-[#E0FE10] transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
          ></div>
        </div>
        
        {/* Modal header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
          <h3 className="text-lg font-medium text-white">Pulse Programming Tutorial</h3>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Modal body - slide content */}
        <div className="p-6">
          {slides[currentSlide]}
        </div>
        
        {/* Modal footer - navigation */}
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-between">
          <div>
            {currentSlide > 0 && (
              <button 
                onClick={goToPrevSlide}
                className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>
            )}
          </div>
          
          <div className="flex gap-4">
            {currentSlide < totalSlides - 1 ? (
              <>
                <button 
                  onClick={onClose}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                >
                  Skip
                </button>
                <button 
                  onClick={goToNextSlide}
                  className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg hover:opacity-90 transition-opacity"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-[#E0FE10] text-black rounded-lg hover:opacity-90 transition-opacity"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PulseProgrammingPageProps {
  metaData: SerializablePageMetaData | null;
}

const PulseProgrammingPage: NextPage<PulseProgrammingPageProps> = ({ metaData }) => {
  const currentUser = useUser();
  const [showEarlyAccessForm, setShowEarlyAccessForm] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [_isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [_showTutorial, _setShowTutorial] = useState(false);
  const [showApp, setShowApp] = useState(false); // New state to track when user wants to enter the app
  const [isTransitioning, setIsTransitioning] = useState(false); // New state for transition animation

  // Programming conversation state  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ProgrammingChatMessage[]>([]);
  const [allConversations, setAllConversations] = useState<ProgrammingConversation[]>([]);
  const [showConversationPanel, setShowConversationPanel] = useState(false);
  const [restoredUIState, setRestoredUIState] = useState<any>(null);
  const [isConversationPanelCollapsed, setIsConversationPanelCollapsed] = useState(true);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(true);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(true);

  // ViewModel definition - this will be constructed to match the ViewModel interface
  const constructedViewModel: ViewModel = {
    appCoordinator: {
      showFloatingTextfield: (_options: {
        title: string;
        theme: string;
        keyboardType: string;
        maxLength?: number;
        minLength?: number;
        returnText: (text: string) => void;
        onDone: (text: string) => void;
        closeMenuDrawer: () => void;
      }) => {
        // Web implementation - no-op for mobile-specific functionality
      },
      closeFloatingMenu: () => {
        // Web implementation - no-op for mobile-specific functionality
      },
      closeModals: () => {
        // Web implementation - no-op for mobile-specific functionality
      },
    },
    validateChallengeInput: (_startDate: Date, _endDate: Date, _name: string, _desc: string, _type: SweatlistType, _pin: string) => { 
      return true; 
    },
    setChallenge: (_startDate: Date, _endDate: Date, _name: string, _desc: string, _type: SweatlistType, _pin: string, _restDayPreferences?: ChallengeData['restDayPreferences']) => { 
    },
  };

  // Initial ChallengeData state setup
  const initialStartDate = new Date();
  const initialEndDate = new Date(initialStartDate.getTime() + 7 * 86400 * 1000); // Default to 1 week later
  const initialChallengeData: ChallengeData = {
    startDate: initialStartDate,
    endDate: initialEndDate,
    challengeName: '',
    challengeDesc: '',
    roundType: SweatlistType.together,
    pinCode: '',
    restDayPreferences: { // Initialize with defaults
        includeRestDays: false,
        restDays: [],
        preferences: [],
    },
    equipmentPreferences: {
      selectedEquipment: [],
      equipmentOnly: false,
    },
    challengeType: 'workout', // Default to workout type
    stepConfiguration: {
      dailyStepGoal: 10000,
      allowedMissedDays: 2,
    },
    mealTracking: {
      isEnabled: false,
      configurationType: 'customMacros',
      pointsPerDay: 100,
      tolerancePercentage: 0.10,
      customMacroRanges: {
        calorieRange: { min: 1800, max: 2200 },
        proteinRange: { min: 120, max: 180 },
        carbRange: { min: 200, max: 300 },
        fatRange: { min: 60, max: 100 },
      },
    },
  };

  // State for managing challenge data, selected stacks for mobile, and desktop specifics
  const [challengeData, setChallengeData] = useState<ChallengeData>(initialChallengeData);
  const [selectedStacks, setSelectedStacks] = useState<WorkoutWithRoundId[]>([]);
  
  // New state for tutorial modal
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  // Check localStorage on mount to determine if tutorial should be shown
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('pulse_programming_tutorial_seen');
    if (!hasSeenTutorial) {
      setShowTutorialModal(true);
    }
    
    // Check if the user has programming access
    const checkUserAccess = async () => {
      if (currentUser?.email) {
        try {
          setIsLoadingAccess(true);
          const accessData = await adminMethods.checkProgrammingAccess(currentUser.email);
          setHasAccess(!!accessData && accessData.status === 'active');
        } catch (error) {
          console.error('Error checking programming access:', error);
          setHasAccess(false);
        } finally {
          setIsLoadingAccess(false);
        }
      } else {
        setIsLoadingAccess(false);
        setHasAccess(false);
      }
    };

    checkUserAccess();
  }, [currentUser]);

  // Debounced auto-save functions
  const debouncedAutoSave = useCallback(
    async (updates: Partial<ProgrammingConversation>) => {
      if (!currentConversationId || !currentUser?.id) {
        return;
      }
      
      // Auto-save conversation updates to Firestore
      
      try {
        // First check if the conversation exists
        const existingConversation = await programmingConversationService.fetchConversation(currentConversationId);
        
        if (!existingConversation) {
          console.warn(`⚠️ Conversation ${currentConversationId} not found, clearing invalid ID`);
          setCurrentConversationId(null);
          return;
        }
        
        // Update conversation in Firestore
        await programmingConversationService.updateConversation(currentConversationId, updates);
        
        // Auto-save completed successfully
        
      } catch (error) {
        console.error('❌ Error auto-saving conversation:', error);
        
        // If it's a "document not found" error, clear the conversation ID
        if ((error as any)?.message?.includes('No document to update')) {
          console.warn(`⚠️ Document not found, clearing conversation ID: ${currentConversationId}`);
          setCurrentConversationId(null);
        }
      }
    },
    [currentConversationId, currentUser?.id]
  );

  // Initialize or load conversation on page mount
  useEffect(() => {

    const initializeConversation = async () => {
      if (!currentUser?.id) {
        return;
      }
      
      if (!hasAccess) {
        return;
      }
      
      setIsLoadingConversation(true);
      
      try {
        // Debug: Check what conversations exist in the database
        await programmingConversationService.debugConversations();
        
        // Get all conversations for this user
        const userConversations = await programmingConversationService.fetchUserConversations(currentUser.id);
        
        setAllConversations(userConversations);
        
        
        // If no conversations found, check if there are any conversations without userId that we can migrate
        if (userConversations.length === 0) {
          await programmingConversationService.addUserIdToConversations(currentUser.id);
          
          // Try fetching again after migration
          const migratedConversations = await programmingConversationService.fetchUserConversations(currentUser.id);
          setAllConversations(migratedConversations);
        }
        
        // Clean up any empty conversations
        await cleanupEmptyConversations();
        
        // Re-fetch conversations after cleanup
        const cleanedConversations = await programmingConversationService.fetchUserConversations(currentUser.id);
        setAllConversations(cleanedConversations);
        
        // Instead of auto-loading the latest conversation, start with a fresh state
        // Users can manually load previous conversations from the conversation panel
        
        // Always start with a new conversation state for clean initial experience
        setCurrentConversationId(null);
        setConversationHistory([]);
        setRestoredUIState(null);
        
        // Keep challengeData and selectedStacks at their default initial values
        // (they're already set in the component's initial state)
      } catch (error) {
        console.error('❌ Error initializing conversation:', error);
        console.error('Error details:', {
          name: (error as any)?.name,
          message: (error as any)?.message,
          stack: (error as any)?.stack
        });
      } finally {
        setIsLoadingConversation(false);
      }
    };

    // Only run if we have both userId and access, and we're not already loading
    if (currentUser?.id && hasAccess && !isLoadingConversation) {
      initializeConversation();
    }
  }, [currentUser?.id, hasAccess]); // Simplified dependencies to prevent loops

  // Handle body scroll lock and keyboard shortcuts when conversation panel opens/closes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (showConversationPanel) {
        document.body.classList.add('conversation-panel-open');
        
        // Add escape key listener
        const handleEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            console.log('🔒 [DEBUG] Escape key pressed, closing conversation panel');
            setShowConversationPanel(false);
          }
        };
        document.addEventListener('keydown', handleEscape);
        
        return () => {
          document.removeEventListener('keydown', handleEscape);
        };
      } else {
        document.body.classList.remove('conversation-panel-open');
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('conversation-panel-open');
      }
    };
  }, [showConversationPanel]);

  // Function to close tutorial and mark as seen
  const handleCloseTutorial = () => {
    localStorage.setItem('pulse_programming_tutorial_seen', 'true');
    setShowTutorialModal(false);
  };

  // This function is the single source for updating challengeData
  const updateChallengeDataState = (newData: Partial<ChallengeData>, skipAutoSave: boolean = false) => {
    setChallengeData((prevData: ChallengeData) => {
      const updatedData = { ...prevData, ...newData };
      
      // Auto-save challenge data changes only if we have a conversation and auto-save is not skipped
              if (currentConversationId && !skipAutoSave) {
        debouncedAutoSave({ 
          challengeData: updatedData as any,
          updatedAt: new Date()
        });
      }
      
      return updatedData;
    });
  };

  const handleRemoveStackForMobile = (stackId: string) => {
    setSelectedStacks(prev => {
      const updatedStacks = prev.filter(stack => (stack.roundWorkoutId || stack.id) !== stackId);
      
      // Auto-save stack changes only if we have a conversation
      if (currentConversationId) {
        debouncedAutoSave({ 
          selectedStacks: updatedStacks,
          updatedAt: new Date()
        });
      }
      
      return updatedStacks;
    });
  };



  const handleGetStarted = () => {
    setIsTransitioning(true);
    // Delay showing the app to allow for the fade-out animation
    setTimeout(() => {
      setShowApp(true);
      setIsTransitioning(false);
    }, 800); // 800ms matches our CSS transition duration
  };

  // Helper function to refresh conversations list
  const refreshConversations = async () => {
    if (!currentUser?.id) return;
    try {
      const userConversations = await programmingConversationService.fetchUserConversations(currentUser.id);
      setAllConversations(userConversations);
    } catch (error) {
      console.error('❌ Error refreshing conversations:', error);
    }
  };

  // Helper function to clean up empty conversations
  const cleanupEmptyConversations = async () => {
    if (!currentUser?.id) return;
    try {
      const userConversations = await programmingConversationService.fetchUserConversations(currentUser.id);
      const emptyConversations = userConversations.filter(conv => conv.messages.length === 0);
      
      if (emptyConversations.length > 0) {
        for (const conversation of emptyConversations) {
          await programmingConversationService.deleteConversation(conversation.id);
        }
        await refreshConversations(); // Refresh the list after cleanup
      }
    } catch (error) {
      console.error('❌ Error cleaning up empty conversations:', error);
    }
  };

  // Update conversation title when challenge name changes
  useEffect(() => {
    const updateConversationTitle = async () => {
      if (!currentConversationId || !currentUser?.id) return;
      
      try {
        const newTitle = challengeData.challengeName.trim() || 
          await programmingConversationService.generateSmartTitle(currentUser.id);
        
        await programmingConversationService.updateConversationTitle(currentConversationId, newTitle);
        
        // Refresh conversations to show updated title
        setTimeout(() => refreshConversations(), 100);
      } catch (error) {
        console.error('❌ Error updating conversation title:', error);
      }
    };

    // Only update if we have a conversation and the name actually changed
    if (currentConversationId && challengeData.challengeName) {
      const timeoutId = setTimeout(updateConversationTitle, 1000); // Debounce updates
      return () => clearTimeout(timeoutId);
    }
  }, [challengeData.challengeName, currentConversationId, currentUser?.id]);

  // Conversation management functions
  const handleSwitchConversation = async (conversationId: string) => {
    if (!currentUser?.id || conversationId === currentConversationId) return;
    
    setIsLoadingConversation(true);
    try {
      const conversation = await programmingConversationService.fetchConversation(conversationId);
      console.log('✅ [DEBUG] Fetched conversation:', conversation);
      if (conversation) {
        // Ensure message timestamps are properly converted to Date objects
        const processedMessages = conversation.messages.map(msg => ({
          ...msg,
          timestamp: convertFirestoreTimestamp(msg.timestamp)
        }));
        
        // Ensure dates are properly converted to Date objects
        const properChallengeData = {
          ...conversation.challengeData,
          startDate: convertFirestoreTimestamp(conversation.challengeData.startDate),
          endDate: convertFirestoreTimestamp(conversation.challengeData.endDate)
        } as ChallengeData;
        
        console.log('🔄 [RACE FIX] Conversation loaded with dates:', {
          startDate: properChallengeData.startDate?.toISOString(),
          endDate: properChallengeData.endDate?.toISOString()
        });
        
        // Batch all state updates to prevent race condition
        // Update conversation data first
        setCurrentConversationId(conversation.id);
        setConversationHistory(processedMessages);
        
        // Use updateChallengeDataState with skipAutoSave to prevent overwriting conversation data
        updateChallengeDataState(properChallengeData, true); // Skip auto-save during conversation loading
        setSelectedStacks(conversation.selectedStacks);
        
        // Restore UI state if available
        if (conversation.uiState) {
          setRestoredUIState(conversation.uiState);
        } else {
          setRestoredUIState(null);
        }
        
        // Expand left panel if this conversation has messages and panel is currently collapsed
        if (processedMessages.length > 0 && isLeftPanelCollapsed) {
          setIsLeftPanelCollapsed(false);
        }
        
        // Use setTimeout to ensure all state updates have been processed before clearing loading state
        setTimeout(() => {
          setIsLoadingConversation(false);
        }, 0);
        
      } else {
        setIsLoadingConversation(false);
      }
    } catch (error) {
      console.error('❌ Error switching conversation:', error);
      setIsLoadingConversation(false);
    }
  };

  const handleCreateNewConversation = async () => {
    if (!currentUser?.id) {
      console.error('❌ No user logged in');
      alert('Error: No user logged in. Please refresh the page and try again.');
      return;
    }
    
    setIsLoadingConversation(true);
    
    try {
      // Reset all form data to initial defaults - ensure dates are proper Date objects
      const now = new Date();
      const freshChallengeData: ChallengeData = {
        ...initialChallengeData,
        startDate: new Date(now.getTime()), // Create new Date object
        endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      };
      const freshSelectedStacks: WorkoutWithRoundId[] = [];
      
      // Create new conversation with fresh initial data
      const conversationId = await programmingConversationService.createConversation(currentUser.id, {
        challengeData: freshChallengeData as any,
        selectedStacks: freshSelectedStacks
      });
      
      // Reset all conversation and form state for new conversation
      setCurrentConversationId(conversationId);
      setConversationHistory([]);
      setChallengeData(freshChallengeData);
      setSelectedStacks(freshSelectedStacks);
      setRestoredUIState(null); // Clear any restored UI state
      setShowConversationPanel(false);
      
      // Wait for Firestore to process, then refresh
      setTimeout(async () => {
        try {
          await refreshConversations();
        } catch (refreshError) {
          console.error('❌ Error refreshing conversations:', refreshError);
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ Error creating new conversation:', error);
      alert(`Error creating new conversation: ${(error as any)?.message || 'Unknown error'}`);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const toggleConversationPanel = () => {
    setIsConversationPanelCollapsed(!isConversationPanelCollapsed);
  };

  const toggleRightPanel = () => {
    setIsRightPanelCollapsed(!isRightPanelCollapsed);
  };

  const toggleLeftPanel = () => {
    setIsLeftPanelCollapsed(!isLeftPanelCollapsed);
  };

  // Enhanced Conversation Panel rendered with React Portal


  return (
    <div className="min-h-screen bg-[#111417]">
      {/* Removed existing Head component */}
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/programming"
      />
      

      
      {/* Add custom CSS for transitions and conversation panel */}
      <style jsx>{`
        .landing-page-container {
          transition: opacity 0.8s ease-out, transform 0.8s ease-out;
        }
        
        .landing-page-fade-out {
          opacity: 0;
          transform: translateY(-20px);
        }
        
        .app-container {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeInUp 0.8s ease-out forwards;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .transition-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #111417 0%, #1a1e24 100%);
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          animation: fadeInOut 0.8s ease-in-out;
        }
        
        @keyframes fadeInOut {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        .loading-pulse {
          width: 60px;
          height: 60px;
          border: 3px solid #E0FE10;
          border-radius: 50%;
          border-top: 3px solid transparent;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Conversation panel styles for better interaction */
        body.conversation-panel-open {
          overflow: hidden;
        }
        
        /* Ensure all clickable elements in conversation panel work */
        .conversation-panel * {
          pointer-events: auto !important;
        }
        
        /* Prevent clicks from bubbling through backdrop */
        .conversation-backdrop {
          pointer-events: none !important;
        }
        
        /* Chat area slide-in animation */
        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .chat-area-enter {
          animation: slideInFromRight 0.5s ease-out forwards;
        }
        
        /* Prevent animation re-trigger when switching conversations */
        .chat-area-visible {
          opacity: 1;
          transform: translateX(0);
        }
      `}</style>
      
      {/* Transition overlay */}
      {isTransitioning && (
        <div className="transition-overlay">
          <div className="text-center">
            <div className="loading-pulse mx-auto mb-4"></div>
            <p className="text-[#E0FE10] text-lg font-medium">Launching Pulse Programming...</p>
          </div>
        </div>
      )}
      
      {/* Tutorial Modal */}
      <TutorialModal 
        isOpen={showTutorialModal} 
        onClose={handleCloseTutorial} 
      />
      {/* Show the landing page by default, or if user has access but hasn't clicked "Get Started" */}
      {!showEarlyAccessForm && (!hasAccess || (hasAccess && !showApp)) && (
        <div className={`landing-page-container ${isTransitioning ? 'landing-page-fade-out' : ''}`}>
          <LandingPage 
            hasAccess={hasAccess} 
            setShowEarlyAccessForm={setShowEarlyAccessForm}
            onGetStarted={handleGetStarted}
          />
        </div>
      )}
      
      {/* Early Access Form - Show if user doesn't have access and clicked to show the form */}
      {!hasAccess && showEarlyAccessForm && (
        <div className="min-h-screen bg-[#111417] text-white flex items-center justify-center">
          <div className="min-h-screen w-full bg-[#111417] flex items-center justify-center py-12">
            <EarlyAccessForm />
          </div>
        </div>
      )}
      
      {/* Only show the actual app if the user has access AND has clicked "Get Started" */}
      {hasAccess && showApp && (
        <div className="app-container">

          {/* Mobile view */}
          <div className="block lg:hidden bg-[#111417] min-h-screen">
            <div className="w-full max-w-[500px] mx-auto bg-[#1a1e24] rounded-t-xl relative flex flex-col min-h-screen">
              <div className="flex justify-center pt-6">
                <div className="w-40 h-20 flex items-center justify-center">
                  <img 
                    src="/PulseProgrammingLogoWhite.png" 
                    alt="Pulse Programming Logo" 
                    className="object-contain max-h-full max-w-full"
                  />
                </div>
              </div>
              <div className="flex-grow overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800 hover:scrollbar-thumb-zinc-600 pb-24">
                <MobileChallengeSetupView
                  setChallengeData={(data: ChallengeData) => {
                    console.log('🔍 [DEBUG] Mobile setChallengeData wrapper called with:', {
                      startDate: data.startDate,
                      endDate: data.endDate,
                      startTime: data.startDate?.getTime?.(),
                      endTime: data.endDate?.getTime?.(),
                      datesEqual: data.startDate?.getTime?.() === data.endDate?.getTime?.()
                    });
                    updateChallengeDataState(data, false); // Explicitly don't skip auto-save
                  }}
                  currentChallengeData={challengeData}
                  selectedStacks={selectedStacks}
                  setSelectedStacks={setSelectedStacks}
                  onRemoveStack={handleRemoveStackForMobile}
                  viewModel={constructedViewModel}
                />
              </div>
              
              <div className="fixed bottom-0 left-0 right-0 w-full max-w-[500px] mx-auto p-4 bg-[#1a1e24] border-t border-zinc-700">
                <button
                  className="w-full py-3 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
                  onClick={() => {
                    if (constructedViewModel.validateChallengeInput( // Use the correctly structured ViewModel
                      challengeData.startDate,
                      challengeData.endDate,
                      challengeData.challengeName,
                      challengeData.challengeDesc,
                      challengeData.roundType,
                      challengeData.pinCode
                    )) {
                      constructedViewModel.setChallenge( // Use the correctly structured ViewModel
                        challengeData.startDate,
                        challengeData.endDate,
                        challengeData.challengeName,
                        challengeData.challengeDesc,
                        challengeData.roundType,
                        challengeData.pinCode,
                        challengeData.restDayPreferences // Pass the entire object
                      );
                      constructedViewModel.appCoordinator.closeModals(); // Access nested appCoordinator
                    }
                  }}
                  disabled={selectedStacks.length === 0} // Basic validation for mobile button
                >
                  Create Round
                </button>
              </div>
            </div>
          </div>
      
          {/* Desktop view */}
          <div className="hidden lg:block bg-[#111417] flex">
            <div className="flex-1">
              <DesktopChallengeSetupView
                challengeData={challengeData}
                                      setChallengeData={(data: ChallengeData) => {
                        updateChallengeDataState(data, false); // Explicitly don't skip auto-save
                      }}
                viewModel={constructedViewModel} // Use the correctly structured ViewModel
                autoSave={debouncedAutoSave} // Pass auto-save function
                currentConversationId={currentConversationId}
                setCurrentConversationId={setCurrentConversationId}
                refreshConversations={refreshConversations}
                conversationHistory={conversationHistory}
                setConversationHistory={setConversationHistory}
                restoredUIState={restoredUIState}
                isLoadingConversation={isLoadingConversation}
                allConversations={allConversations}
                handleCreateNewConversation={handleCreateNewConversation}
                handleSwitchConversation={handleSwitchConversation}
                isConversationPanelCollapsed={isConversationPanelCollapsed}
                toggleConversationPanel={toggleConversationPanel}
                isRightPanelCollapsed={isRightPanelCollapsed}
                toggleRightPanel={toggleRightPanel}
                isLeftPanelCollapsed={isLeftPanelCollapsed}
                toggleLeftPanel={toggleLeftPanel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<PulseProgrammingPageProps> = async (_context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('programming');
  } catch (error) {
    console.error("Error fetching page meta data for programming page:", error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default PulseProgrammingPage;
