import React, { useState, useEffect, useRef } from 'react';
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
    XCircle,
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
} from 'lucide-react';
import { Switch } from '@headlessui/react';
import { useScrollFade } from '../hooks/useScrollFade';

import { userService } from '../api/firebase/user/service';
import { workoutService } from '../api/firebase/workout/service';
import { exerciseService } from '../api/firebase/exercise/service';
import { Exercise, ExerciseDetail, ExerciseCategory, ExerciseVideo, ExerciseReference, WeightTrainingExercise, CardioExercise } from '../api/firebase/exercise/types';
import { Workout, SweatlistCollection, Challenge, ChallengeStatus, SweatlistIdentifiers, WorkoutStatus } from '../api/firebase/workout/types';
import { StackCard } from '../components/Rounds/StackCard'
import { ExerciseGrid } from '../components/App/ExerciseGrid/ExerciseGrid';
import { MultiUserSelector } from '../components/App/MultiSelectUser/MultiSelectUser';
import { generateId } from '../utils/generateId';
import { useUser } from '../hooks/useUser';
import PageHead from '../components/PageHead'; // Added PageHead import
import { adminMethods } from '../api/firebase/admin/methods'; // Added adminMethods
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types'; // Added PageMetaData

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
    
    return `
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
      Challenges Completed: ${this.pastChallengesCompleted}
      ${this.favoriteExercises?.length ? `Favorite Exercises: ${this.favoriteExercises.join(', ')}` : ''}
      ${this.dislikedExercises?.length ? `Exercises to Avoid: ${this.dislikedExercises.join(', ')}` : ''}
      `.trim();
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
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
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
      
      console.log('Programming access request submitted:', formData);
      
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
    // viewModel, // viewModel not used directly here for setChallenge anymore
  }) => {
    const {
      startDate,
      endDate,
      challengeName,
      challengeDesc,
      roundType,
      pinCode,
    } = currentChallengeData;
  
    // Refs for different sections
    const roundTypeRef = useRef<HTMLDivElement>(null);
    const pinCodeRef = useRef<HTMLInputElement>(null);
  
    // Date formatter
    const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
  
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
            startDate: sDate,
            endDate: eDate,
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

      // When a stack is selected, we might not need to update challengeData here
      // unless some specific fields are derived from stack selection for the round itself.
      // handleLocalSetChallengeData(
      //   startDate,
      //   endDate,
      //   challengeName,
      //   challengeDesc,
      //   roundType,
      //   pinCode
      // );

      setSelectedStacks(prev => [...prev, updatedStack]);
    };

    const handleRemoveStack = (stackId: string) => {
      onRemoveStack(stackId);
    };

    // Removed handleSaveChallenge as it's not used in MobileChallengeSetupView's primary role now
    // Removed local state for activeTab, includeRestDays, selectedPreferences, restDayPreferences
    // Removed handlers: handleIncludeRestDaysChange, handleRestDayPreferencesChange

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
              {selectedStacks.map((stack) => (
                <div key={stack.roundWorkoutId || stack.id} className="border border-zinc-700 rounded-lg">
                    <StackCard
                    key={stack.roundWorkoutId || stack.id} 
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
                value={startDate.toISOString().split('T')[0]}
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
                value={endDate.toISOString().split('T')[0]}
                min={startDate.toISOString().split('T')[0]}
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

interface DesktopChallengeSetupProps {
  challengeData: ChallengeData;
  setChallengeData: (data: ChallengeData) => void; // Simplified to pass the whole object
  viewModel: ViewModel;
}

// In the DesktopChallengeSetupView component
const DesktopChallengeSetupView: React.FC<DesktopChallengeSetupProps> = ({
    challengeData,
    setChallengeData,
    viewModel,
  }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [allStacks, setAllStacks] = useState<Workout[]>([]);
    const [selectedStacks, setSelectedStacks] = useState<WorkoutWithRoundId[]>([]);
    const [isAIMode, setIsAIMode] = useState(true);
    const currentUser = useUser();

    // User tagging state
    const [allUsers, setAllUsers] = useState<UserDataCard[]>([]);
    const [taggedUsers, setTaggedUsers] = useState<UserDataCard[]>([]);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);

    // Tagged users scroll state
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const taggedUsersScrollRef = useRef<HTMLDivElement>(null);

    // Chatbot conversation state
    const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
    const [isAIResponding, setIsAIResponding] = useState(false);
    const [showGenerateCard, setShowGenerateCard] = useState(false);
    const [questionCount, setQuestionCount] = useState(0);
    const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
    const [finalPrompt, setFinalPrompt] = useState('');
    const [suggestedDescription, setSuggestedDescription] = useState('');

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

    // Handle sending message to chatbot
    const handleSendChatMessage = async (message: string) => {
      if (!message.trim() || isAIResponding) return;

      try {
        setIsAIResponding(true);
        
        // Add user message to conversation
        const newUserMessage = { role: 'user' as const, content: message };
        const updatedHistory = [...conversationHistory, newUserMessage];
        setConversationHistory(updatedHistory);

        console.log('Sending to chatbot API...', {
          message,
          conversationHistory: updatedHistory,
          taggedUsers,
          challengeData,
          selectedMoves,
          selectedCreators,
          restDayPreferences: challengeData.restDayPreferences,
          equipmentPreferences: challengeData.equipmentPreferences,
          movesTabSelectedCreatorIds
        });

        const response = await fetch('/api/chatbot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            conversationHistory,
            taggedUsers,
            challengeData,
            selectedMoves,
            selectedCreators,
            restDayPreferences: challengeData.restDayPreferences,
            equipmentPreferences: challengeData.equipmentPreferences,
            movesTabSelectedCreatorIds
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();
        console.log('Chatbot response:', data);

        if (data.success && data.message) {
          // Add AI response to conversation
          const aiMessage = { role: 'assistant' as const, content: data.message };
          setConversationHistory(prev => [...prev, aiMessage]);
          
          // Update question count and show generate card if ready
          setQuestionCount(data.questionCount || 0);
          setShowGenerateCard(data.readyToGenerate || false);
          setIsAwaitingConfirmation(data.isAwaitingConfirmation || false);
          
          // Handle final prompt and suggested description
          if (data.finalPrompt) {
            setFinalPrompt(data.finalPrompt);
          }
          
          if (data.suggestedDescription && !challengeData.challengeDesc) {
            setSuggestedDescription(data.suggestedDescription);
            // Auto-update the challenge description
            handleLocalSetChallengeData({ challengeDesc: data.suggestedDescription });
          }
        } else {
          throw new Error(data.error || 'Invalid response from AI');
        }

      } catch (error) {
        console.error('Error sending chat message:', error);
        // Add error message to conversation
        const errorMessage = { 
          role: 'assistant' as const, 
          content: 'I apologize, but I encountered an error. Please try again.' 
        };
        setConversationHistory(prev => [...prev, errorMessage]);
      } finally {
        setIsAIResponding(false);
      }
    };

    const generalAiPreferencesOptions = [
      "Exclusive to selected creators",
      "Use stacks I've created/saved in my library",
      "Create unique stacks for each day.",
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

    const router = useRouter();
    
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
      const fetchUsersAndSeedIfEmpty = async () => {
        try {
          console.log('Attempting to load user data cards from Firestore...');
          const rawDataCards = await userService.fetchAllUserDataCards();
          
          if (rawDataCards.length === 0) {
            console.log('No user data cards found in Firestore. Attempting to seed mock data...');
            // Check a flag to prevent re-seeding. This is a simple in-memory flag.
            // For a more persistent solution, consider localStorage or a Firestore flag.
            if (!(window as any).__hasSeededMockUsers) {
              const mockUsersToSeed: Omit<UserDataCard, 'id' | 'createdAt' | 'updatedAt' | 'toAIContext' | 'getChatDisplaySummary'>[] = [
                {
                  name: 'Alice Wonderland',
                  email: 'alice@example.com',
                  fitnessLevel: 'beginner',
                  primaryGoals: ['general-fitness', 'weight-loss'],
                  trainingFrequency: 3,
                  availableEquipment: ['home-gym', 'bodyweight-only'],
                  preferredDuration: 30,
                  experienceYears: 0,
                  preferredWorkoutTypes: ['yoga', 'cardio'],
                  preferredIntensity: 'low',
                  injuries: [],
                  limitations: [],
                  healthConditions: [],
                  availableDays: ['monday', 'wednesday', 'friday'],
                  timeOfDay: ['morning'],
                  favoriteExercises: ['Jumping Jacks', 'Yoga Sun Salutation'],
                  dislikedExercises: ['Burpees'],
                  pastChallengesCompleted: 0,
                  motivationStyle: ['independent'],
                  preferredFeedback: ['encouraging'],
                },
                {
                  name: 'Bob The Builder',
                  email: 'bob@example.com',
                  fitnessLevel: 'intermediate',
                  primaryGoals: ['strength', 'hypertrophy'],
                  trainingFrequency: 4,
                  availableEquipment: ['full-gym'],
                  preferredDuration: 60,
                  experienceYears: 2,
                  preferredWorkoutTypes: ['weight-training'],
                  preferredIntensity: 'moderate',
                  injuries: ['Slight knee discomfort'],
                  limitations: [],
                  healthConditions: [],
                  availableDays: ['tuesday', 'thursday', 'saturday', 'sunday'],
                  timeOfDay: ['evening'],
                  favoriteExercises: ['Bench Press', 'Squats'],
                  dislikedExercises: ['Running long distance'],
                  pastChallengesCompleted: 2,
                  motivationStyle: ['competitive'],
                  preferredFeedback: ['technical'],
                },
                {
                  name: 'Charlie Brown',
                  email: 'charlie@example.com',
                  fitnessLevel: 'advanced',
                  primaryGoals: ['athletic-performance'],
                  trainingFrequency: 5,
                  availableEquipment: ['full-gym', 'minimal-equipment'],
                  preferredDuration: 75,
                  experienceYears: 5,
                  preferredWorkoutTypes: ['sports-specific', 'functional'],
                  preferredIntensity: 'high',
                  injuries: [],
                  limitations: [],
                  healthConditions: [],
                  availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                  timeOfDay: ['afternoon'],
                  favoriteExercises: ['Deadlifts', 'Olympic Lifts'],
                  dislikedExercises: [],
                  pastChallengesCompleted: 5,
                  motivationStyle: ['coach-guided'],
                  preferredFeedback: ['detailed'],
                }
              ];

              console.log('Seeding mock users:', mockUsersToSeed);
              for (const userData of mockUsersToSeed) {
                // UserDataCard constructor will fill in missing dates and default values
                const cardToCreate = new UserDataCard(userData);
                // We need to convert the class instance to a plain object for Firestore
                const plainCardObject = { ...cardToCreate }; 
                // Remove methods if they exist on the object, Firestore cannot store functions
                delete (plainCardObject as any).toAIContext;
                delete (plainCardObject as any).getChatDisplaySummary;

                await userService.createUserDataCard(plainCardObject);
              }
              console.log('Mock user data seeding complete.');
              (window as any).__hasSeededMockUsers = true;

              // Re-fetch after seeding
              const freshRawDataCards = await userService.fetchAllUserDataCards();
              const freshDataCards = freshRawDataCards.map(data => new UserDataCard(data));
              setAllUsers(freshDataCards);
              console.log(`Loaded ${freshDataCards.length} user data cards after seeding.`);
              return; // Exit after successful seeding and re-fetch
            } else {
              console.log('Mock data already seeded in this session. Skipping.');
            }
          }
          
          // If data was found initially or seeding was skipped/already done
          const dataCards = rawDataCards.map(data => new UserDataCard(data));
          setAllUsers(dataCards);
          console.log(`Loaded ${dataCards.length} user data cards.`);

        } catch (error) {
          console.error('Error fetching or seeding user data cards:', error);
          // Fallback to existing mock data if Firestore operations fail catastrophically
          // This part of the logic can be kept as a final fallback
          console.log('Falling back to local mock data due to error...');
          const mockUsers: UserDataCard[] = [
            new UserDataCard({
              id: '1',
              name: 'Sarah Johnson (Fallback)',
              email: 'sarah@example.com',
              fitnessLevel: 'intermediate',
              primaryGoals: ['strength', 'hypertrophy'],
              trainingFrequency: 4,
              availableEquipment: ['full-gym'],
              preferredDuration: 60,
              pastChallengesCompleted: 3
            }),
            new UserDataCard({
              id: '2', 
              name: 'Mike Chen (Fallback)',
              email: 'mike@example.com',
              fitnessLevel: 'advanced',
              primaryGoals: ['athletic-performance', 'strength'],
              trainingFrequency: 5,
              availableEquipment: ['full-gym'],
              preferredDuration: 75,
              injuries: ['Previous shoulder injury'],
              pastChallengesCompleted: 8
            }),
            new UserDataCard({
              id: '3',
              name: 'Emma Rodriguez (Fallback)',
              email: 'emma@example.com', 
              fitnessLevel: 'beginner',
              primaryGoals: ['general-fitness', 'weight-loss'],
              trainingFrequency: 3,
              availableEquipment: ['home-gym'],
              preferredDuration: 30,
              pastChallengesCompleted: 1
            })
          ];
          setAllUsers(mockUsers);
        }
      };
      fetchUsersAndSeedIfEmpty();
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
      user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) && 
      !taggedUsers.some(tagged => tagged.id === user.id)
    );

    // Handle user selection from dropdown
    const handleUserSelect = (user: UserDataCard) => {
      const textBeforeCursor = aiPromptText.substring(0, cursorPosition);
      const textAfterCursor = aiPromptText.substring(cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtIndex !== -1) {
        const beforeAt = textBeforeCursor.substring(0, lastAtIndex);
        const newText = `${beforeAt}@${user.name} ${textAfterCursor}`;
        
        setAiPromptText(newText);
        setTaggedUsers(prev => [...prev, user]);
        setShowUserDropdown(false);
        setUserSearchTerm('');
        
        // Update cursor position to after the inserted name
        const newCursorPosition = beforeAt.length + user.name.length + 2; // +2 for "@" and space
        setCursorPosition(newCursorPosition);
      }
    };

    // Remove tagged user
    const handleRemoveTaggedUser = (userId: string) => {
      setTaggedUsers(prev => prev.filter(user => user.id !== userId));
      
      // Also remove from prompt text
      const userToRemove = allUsers.find(u => u.id === userId);
      if (userToRemove) {
        const updatedText = aiPromptText.replace(new RegExp(`@${userToRemove.name}\\s?`, 'g'), '');
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
    setChallengeData({ ...challengeData, ...partialData });
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
      //   toast(...)
      return false;
    }
    if (challengeData.challengeDesc.trim().length === 0) {
      //   toast(...)
      return false;
    }
    if (challengeData.endDate <= challengeData.startDate) {
      //   toast(...)
      return false;
    }
    if (challengeData.roundType === SweatlistType.locked && challengeData.pinCode.length !== 9) {
      //   toast(...)
      return false;
    }
    if (!isAIMode && selectedStacks.length === 0) { // Only check selectedStacks if not in AI mode
      //   toast(...)
      return false;
    }
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
  
    const category = exerciseData.category.type === 'weight-training' 
      ? ExerciseCategory.weightTraining({
          reps: exerciseData.category.details.reps || ['10'],
          sets: exerciseData.category.details.sets || 3,
          weight: exerciseData.category.details.weight || 0,
          screenTime: exerciseData.category.details.screenTime || 60,
          selectedVideo: baseExercise.videos?.[0] || null
        })
      : ExerciseCategory.cardio({
          duration: exerciseData.category.details.duration || 60,
          bpm: exerciseData.category.details.bpm || 0,
          calories: exerciseData.category.details.calories || 0,
          screenTime: exerciseData.category.details.screenTime || 60,
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

  const handleGenerateAIRound = async () => {
    console.log('🎯 Generate AI Round button clicked!');
    
    if (!validateChallengeInput()) {
      console.log('❌ Challenge input validation failed');
      return;
    }
    
    try {
      console.log('🚀 Starting AI round generation...');
      setIsGenerating(true);
      setError(null);
  
      const currentRestPrefs = challengeData.restDayPreferences || { includeRestDays: false, restDays: [], preferences: [] };
      const uniqueStacksPerDay = currentRestPrefs.preferences.includes("Create unique stacks for each day.");
      let numberOfUniqueStacks: number | null = null;
      let effectiveSelectedRestDays: string[] = [];

      if (currentRestPrefs.includeRestDays) {
        effectiveSelectedRestDays = currentRestPrefs.restDays;
      }

      if (!uniqueStacksPerDay && currentRestPrefs.includeRestDays) {
        numberOfUniqueStacks = Math.max(1, 7 - effectiveSelectedRestDays.length);
      } else if (!uniqueStacksPerDay) {
        numberOfUniqueStacks = 7;
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

      console.log("--- AI Generation Parameters ---");
      console.log("Unique Stacks Per Day:", uniqueStacksPerDay);
      console.log("Number of Unique Stacks to Generate:", numberOfUniqueStacks);
      console.log("Selected Rest Days (for API):", effectiveSelectedRestDays);
      console.log("Must Include Moves:", selectedMoves.map(m => m.name));
      console.log("Conversation History Length:", conversationHistory.length);
      console.log("Tagged Users:", taggedUsers.length);
      console.log("Selected Preferences (for API):", userSelectedPreferencesForAPI);
      console.log("Available Exercises Count (for API):", availableExercisesForAPI.length);
      console.log("Start Date:", challengeData.startDate);
      console.log("End Date:", challengeData.endDate);
      console.log("Selected Creator IDs:", selectedCreators);
      console.log("--------------------------------");

      // Create comprehensive prompt from conversation or fallback to aiPromptText
      let comprehensivePrompt = '';
      if (finalPrompt) {
        // Use the refined final prompt from chatbot
        comprehensivePrompt = finalPrompt;
        console.log('Using refined final prompt from chatbot conversation');
      } else if (conversationHistory.length > 0) {
        // Build prompt from conversation
        comprehensivePrompt = 'CONVERSATION SUMMARY:\n';
        conversationHistory.forEach((msg, index) => {
          comprehensivePrompt += `${msg.role === 'user' ? 'Coach' : 'AI'}: ${msg.content}\n`;
        });
        
        // Add tagged users context
        if (taggedUsers.length > 0) {
          comprehensivePrompt += '\nCLIENT PROFILES:\n';
          taggedUsers.forEach((user, index) => {
            comprehensivePrompt += `${user.name}: ${user.toAIContext ? user.toAIContext() : `${user.fitnessLevel}, Goals: ${user.primaryGoals?.join(', ') || 'Not specified'}`}\n`;
          });
        }
      } else {
        // Fallback to original prompt if no conversation
        comprehensivePrompt = aiPromptText || 'Create a personalized training program based on the selected configuration.';
        
        // Add tagged users context even for direct generation
        if (taggedUsers.length > 0) {
          comprehensivePrompt += '\n\nCLIENT PROFILES:\n';
          taggedUsers.forEach((user, index) => {
            comprehensivePrompt += `${user.name}: ${user.toAIContext ? user.toAIContext() : `${user.fitnessLevel}, Goals: ${user.primaryGoals?.join(', ') || 'Not specified'}`}\n`;
          });
        }
      }

      // Log the final prompt that will be sent to AI generation
      console.log('\n=== FINAL PROMPT FOR AI GENERATION ===');
      console.log('Prompt Source:', finalPrompt ? 'Refined chatbot conversation' : conversationHistory.length > 0 ? 'Built from conversation history' : 'Direct input/fallback');
      console.log('Final Prompt Length:', comprehensivePrompt.length, 'characters');
      console.log('---');
      console.log(comprehensivePrompt);
      console.log('=== END FINAL PROMPT ===\n');

      console.log('📡 Making API call to /api/generateRound...');
      console.log('API Request Body:', {
        mustIncludeExercises: selectedMoves.map(move => move.name),
        userPrompt: comprehensivePrompt,
        preferences: userSelectedPreferencesForAPI, 
        availableExercises: availableExercisesForAPI.length,
        startDate: challengeData.startDate,
        endDate: challengeData.endDate,
        numberOfUniqueStacks: numberOfUniqueStacks, 
        selectedRestDays: effectiveSelectedRestDays,
        equipmentPreferences: challengeData.equipmentPreferences,
        taggedUsers: taggedUsers.length,
        conversationHistory: conversationHistory.length
      });

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
          startDate: challengeData.startDate,
          endDate: challengeData.endDate,
          numberOfUniqueStacks: numberOfUniqueStacks, 
          selectedRestDays: effectiveSelectedRestDays,
          // Equipment preferences for AI consideration
          equipmentPreferences: challengeData.equipmentPreferences || { selectedEquipment: [], equipmentOnly: false },
          // Additional context for better generation
          taggedUsers: taggedUsers,
          conversationHistory: conversationHistory
        }),
      });

      console.log('📡 API Response Status:', response.status);
      console.log('📡 API Response OK:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error('Failed to generate workout round');
      }
  
      const generatedResponse = await response.json();
      console.log('✅ API Response JSON:', generatedResponse);
      
      const generatedRound = generatedResponse.choices[0].message.content;
      console.log('📋 Generated Round Content:', generatedRound);

      let cleanedResponse = generatedRound
        .replace(/^```json\n/, '')
        .replace(/\n```$/, '')
        .trim();

      console.log('🧹 Cleaned Response:', cleanedResponse);

      let parsedRound;
      try {
        parsedRound = JSON.parse(cleanedResponse);
        console.log('✅ Parsed Round Successfully:', parsedRound);
      } catch (error) {
        console.error('❌ Error parsing AI response:', error);
        console.log('Raw response:', generatedRound);
        console.log('Cleaned response:', cleanedResponse);
        throw new Error('Failed to parse AI response');
      }
  
      console.log('Generated round data:', parsedRound);
      const createdStacks = [];
      const sweatlistIds = [];
      let currentOrder = 0;

      for (const stackData of parsedRound.stacks) {
        currentOrder++;
        
        if (stackData.title.toLowerCase() === "rest") {
          sweatlistIds.push(new SweatlistIdentifiers({
            id: "rest-" + generateId(),
            sweatlistAuthorId: currentUser?.id || '',
            sweatlistName: "Rest",
            order: currentOrder,
            isRest: true
          }));
          continue;
        }

        try {
          const useOnlyCreatorExercises = currentRestPrefs.preferences.includes("Creator videos only"); // This seems like a duplicate of useCreatorExclusive, or another option
          
          const enrichedExercises = stackData.exercises
            .map((ex: ExerciseReference) => {
              try {
                return enrichExerciseData(ex, allExercises, availableExercisesForAPI, useOnlyCreatorExercises);
              } catch (error) {
                console.warn(`Skipping exercise ${(ex as any)?.name || 'Unknown'}: ${error}`); 
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
            // workout.workoutStatus = WorkoutStatus.Archived; // Temporarily commented out
            
            const createdStack = await userService.createStack(workout, exerciseLogs);
            
            if (createdStack) {
              createdStacks.push(createdStack);
              sweatlistIds.push(new SweatlistIdentifiers({
                id: createdStack.id,
                sweatlistAuthorId: currentUser?.id || '',
                sweatlistName: createdStack.title,
                order: currentOrder,
                isRest: false
              }));
            }
          }
        } catch (error) {
          console.error('Error creating stack:', stackData.title, error);
          continue;
        }
      }

      if (createdStacks.length === 0 && !sweatlistIds.some(id => id.isRest)) {
        throw new Error('No stacks or rest days were successfully created');
      }
  
      const createdAt = new Date();
  
      if (!currentUser?.id) {
        throw new Error("No user logged in");
      }
  
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
        ownerId: [currentUser?.id || '']
      });
  
      const collection = new SweatlistCollection({
        id: "",
        title: challengeData.challengeName,
        subtitle: challengeData.challengeDesc,
        pin: challengeData.pinCode,
        challenge,
        sweatlistIds: sweatlistIds,
        ownerId: [currentUser?.id || ''],
        participants: [],
        privacy: challengeData.roundType,
        createdAt,
        updatedAt: createdAt
      });
  
      const updatedCollection = await workoutService.updateCollection(collection);
      
      console.log("The collection is: ", updatedCollection);
      if (updatedCollection) {
        router.push(`/round/${updatedCollection.id}`);
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
      const createdAt = new Date();
  
      if (!currentUser?.id) {
        throw new Error("No user logged in");
      }
  
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
        ownerId: [currentUser?.id || '']
      });
  
      const collection = new SweatlistCollection({
        id: "",
        title: challengeData.challengeName,
        subtitle: challengeData.challengeDesc,
        pin: challengeData.pinCode,
        challenge,
        sweatlistIds: selectedStacks.map((stack, index) => ({
          id: stack.id,
          sweatlistAuthorId: currentUser?.id || '', // Assuming stack.author is the ID
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
  
      const updatedCollection = await workoutService.updateCollection(collection);
      
      console.log("The collection is: ", updatedCollection);
      if (updatedCollection) {  
        router.push(`/round/${updatedCollection.id}`);
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
        if (conversationHistory.length > 0) {
          // Focus the simple input for continuing conversation
          chatInputRef.current?.focus();
        } else {
          // Focus the textarea for starting conversation
          chatTextareaRef.current?.focus();
        }
      }, 100);
    }
  }, [isAIResponding, conversationHistory.length]);

  // Initial focus when component mounts
  useEffect(() => {
    // Focus the appropriate input when the component first loads
    setTimeout(() => {
      if (conversationHistory.length > 0) {
        chatInputRef.current?.focus();
      } else {
        chatTextareaRef.current?.focus();
      }
    }, 200); // Slightly longer delay to ensure everything is rendered
  }, []); // Only run on mount

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (chatMessagesRef.current) {
      const scrollToBottom = () => {
        chatMessagesRef.current?.scrollTo({
          top: chatMessagesRef.current.scrollHeight,
          behavior: 'smooth'
        });
      };
      
      // Small delay to ensure DOM is updated with new content
      setTimeout(scrollToBottom, 100);
    }
  }, [conversationHistory, isAIResponding, showGenerateCard]); // Scroll when conversation changes, AI responding state changes, or generate card appears

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
                  className="flex-1 px-4 py-2 bg-[#E0FE10] hover:bg-[#E0FE10]/90 text-black rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10]" />
              <h3 className="text-xl font-semibold text-white">Generating Round</h3>
              <p className="text-zinc-400 text-center">
                Creating your personalized training program using AI. This may take a moment...
              </p>
              <div className={`text-[#E0FE10] text-lg loading-text-ready ${fadeState === 'fade-in' ? 'loading-text-visible' : 'loading-text-hidden'}`}>
                {stages[currentStage]}
              </div>
              {currentExercise && (
                <div className={`text-zinc-400 text-sm italic loading-text-ready ${fadeState === 'fade-in' ? 'loading-text-visible' : 'loading-text-hidden'}`}>
                  {currentExercise}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-6 right-6 z-10">
        <button
            onClick={() => setIsAIMode(!isAIMode)}
            className="group relative px-4 py-2 rounded-lg bg-black/20 backdrop-blur-sm 
                    border border-zinc-800 hover:border-[#E0FE10]/50 transition-all"
        >
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#E0FE10] via-purple-500 to-[#E0FE10] opacity-20 
                            blur-xl group-hover:opacity-30 transition-opacity" />
            
            <div className="relative flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#E0FE10]" />
            <span className="text-white font-medium">{isAIMode ? 'Manual Setup' : 'AI Round'}</span>
            </div>
        </button>
        </div>

        {/* Left Panel: Title, Prompt, Stes, etc. */}
        <div className="w-[600px] h-full flex flex-col bg-[#1a1e24] rounded-xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#E0FE10]"></div>
          <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#E0FE10]"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E0FE10] via-purple-500 to-blue-500"></div>
          <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-gradient-to-t from-[#E0FE10] via-purple-500 to-blue-500"></div>

        <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800 hover:scrollbar-thumb-zinc-600">
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
                    <h3 className="text-2xl font-semibold text-white text-center mb-2">Turn your expertise into shared fitness experiences</h3>
                    <p className="text-zinc-400 text-center text-sm">
                        Be specific about your Round's focus—like "upper body strength with core stability" or "progressive leg workout for beginners." Include any special considerations, goals, or themes to create the most effective program for your community.
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
                         value={challengeData.startDate.toISOString().split('T')[0]}
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
                         value={challengeData.endDate.toISOString().split('T')[0]}
                         min={challengeData.startDate.toISOString().split('T')[0]}
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

                <div>
                
                </div>

                

                <button
                onClick={() => setIsAIMode(false)}
                className="w-full py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                >
                Cancel and return to manual creation
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

        {/* AI Chat Collaboration Area - Placeholder */}
        <div className="flex-1 min-w-0 h-full bg-[#1a1e24] rounded-xl shadow-xl relative flex flex-col overflow-hidden">
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
          <div ref={chatMessagesRef} className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800">
            <div className="space-y-4">
              {/* Starter Prompt Cards - only show if no conversation yet */}
              {conversationHistory.length === 0 && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-white mb-2">Get Started with AI Programming</h3>
                    <p className="text-lg text-zinc-400">Click on any example below to get started, or write your own prompt</p>
                  </div>
                  
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
              {conversationHistory.map((message, index) => (
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

              {/* Loading indicator when AI is responding */}
              {isAIResponding && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 max-w-[80%]">
                    <p className="text-xl text-zinc-300">
                      Thinking...
                    </p>
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
                      
                      {/* Generate Button */}
                      <button
                        className="w-full py-3 bg-gradient-to-r from-[#E0FE10] via-purple-500 to-[#E0FE10] 
                                  text-black rounded-lg font-semibold hover:opacity-90 transition-opacity
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleGenerateAIRound}
                        disabled={isGenerating}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {isGenerating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          <span>{isGenerating ? 'Generating Round...' : 'Generate My Round'}</span>
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
          
          {/* Chat Input - Ready for conversation */}
           {/* Round Prompt Section - For starting AI conversation */}
          <div className="flex justify-center py-4 bg-[#111417] relative">
            <div className="w-full max-w-6xl bg-[#1a1e24] rounded-xl shadow-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#E0FE10]"></div>
                <h3 className="text-lg font-semibold text-white">Round Prompt</h3>
                <span className="text-sm text-zinc-400">- Describe your training goals to start the conversation</span>
              </div>
              
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
                    
                    <div 
                      ref={taggedUsersScrollRef}
                      onScroll={checkTaggedUsersScroll}
                      className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800 pb-1"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      {taggedUsers.map((user) => (
                        <div key={user.id} className="bg-[#E0FE10]/20 border border-[#E0FE10]/40 rounded-lg px-3 py-2 flex items-center gap-2 flex-shrink-0 min-w-fit">
                          <div className="w-6 h-6 rounded-full bg-[#E0FE10]/30 flex items-center justify-center">
                            <UserCircle className="w-4 h-4 text-[#E0FE10]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white whitespace-nowrap">{user.name}</span>
                            <span className="text-xs text-zinc-400 whitespace-nowrap">{user.getChatDisplaySummary()}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveTaggedUser(user.id)}
                            className="text-zinc-400 hover:text-white ml-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Chat Input Area */}
              {conversationHistory.length > 0 ? (
                // Simple input for continuing conversation
                <div className="flex gap-4 relative">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      ref={chatInputRef}
                      value={aiPromptText}
                      onChange={(e) => setAiPromptText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (aiPromptText.trim() && !isAIResponding) {
                            handleSendChatMessage(aiPromptText);
                            setAiPromptText('');
                          }
                        }
                      }}
                      placeholder="Continue the conversation..."
                      className="w-full p-4 bg-[#262a30] rounded-lg border border-zinc-700 
                                text-white placeholder:text-zinc-500 
                                focus:border-[#E0FE10] focus:outline-none transition-all"
                      disabled={isAIResponding}
                    />
                  </div>
                  <button
                    className="px-6 py-3 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    onClick={() => {
                      if (aiPromptText.trim() && !isAIResponding) {
                        handleSendChatMessage(aiPromptText);
                        setAiPromptText('');
                      }
                    }}
                    disabled={!aiPromptText.trim() || isAIResponding}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {isAIResponding ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                </div>
              ) : (
                // Original textarea for starting conversation
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
                        <div className="p-2 border-b border-zinc-700">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#E0FE10]" />
                            <span className="text-xs text-zinc-400">Select user to tag:</span>
                          </div>
                        </div>
                        {filteredUsers.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => handleUserSelect(user)}
                            className="w-full p-3 flex items-center gap-3 hover:bg-zinc-700/50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                              <UserCircle className="w-5 h-5 text-[#E0FE10]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white">{user.name}</div>
                              <div className="text-xs text-zinc-400 truncate">{user.getChatDisplaySummary()}</div>
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
                          <Brain className="w-4 h-4" />
                        )}
                        <span>{isAIResponding ? 'Sending...' : 'Start Collaberating'}</span>
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
              )}
              
              <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  💡 <strong>Pro tip:</strong> Use @ to tag users for personalized recommendations. Type @ followed by a name to search and select users whose fitness profiles will help the AI create more targeted programs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Workout Customization and Stack Selector / AI Tools */}
        <div className="w-[550px] h-full bg-[#1a1e24] rounded-xl shadow-xl relative flex flex-col overflow-hidden">
            {/* Gradient borders */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#E0FE10]"></div>
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#E0FE10]"></div>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E0FE10] via-purple-500 to-blue-500"></div>
            <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-gradient-to-t from-[#E0FE10] via-purple-500 to-blue-500"></div>

            {/* --- START: Always Visible Preferences UI Block --- */}
            <div className="p-6 space-y-4 border-b border-zinc-700 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800 max-h-[40vh]"> {/* Added max-height */}
                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <h3 className="font-medium text-white mb-2">Round Customization</h3>
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
            </div>
            {/* --- END: Always Visible Preferences UI Block --- */}
            
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
                              setSelectedCreators(prev => [...prev, userId]);
                          }}
                          onUserRemove={(userId) => {
                              setSelectedCreators(prev => prev.filter(id => id !== userId));
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

        

    </div>
    
   
   
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
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showApp, setShowApp] = useState(false); // New state to track when user wants to enter the app
  const [isTransitioning, setIsTransitioning] = useState(false); // New state for transition animation

  // ViewModel definition - this will be constructed to match the ViewModel interface
  const constructedViewModel: ViewModel = {
    appCoordinator: {
      showFloatingTextfield: () => { console.log('mock: showFloatingTextfield'); },
      closeFloatingMenu: () => { console.log('mock: closeFloatingMenu'); },
      closeModals: () => { console.log('mock: closeModals'); },
    },
    validateChallengeInput: (startDate: Date, endDate: Date, name: string, desc: string, type: SweatlistType, pin: string) => { 
      console.log('mock: validateChallengeInput from constructedViewModel'); 
      return true; 
    },
    setChallenge: (startDate: Date, endDate: Date, name: string, desc: string, type: SweatlistType, pin: string, restDayPreferences?: ChallengeData['restDayPreferences']) => { 
      console.log('mock: setChallenge from constructedViewModel', startDate, endDate, name, desc, type, pin, restDayPreferences); 
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

  // Function to close tutorial and mark as seen
  const handleCloseTutorial = () => {
    localStorage.setItem('pulse_programming_tutorial_seen', 'true');
    setShowTutorialModal(false);
  };

  // This function is the single source for updating challengeData
  const updateChallengeDataState = (newData: Partial<ChallengeData>) => {
    setChallengeData((prevData: ChallengeData) => ({ 
      ...prevData, 
      ...newData 
    }));
  };

  const handleRemoveStackForMobile = (stackId: string) => {
    setSelectedStacks(prev => prev.filter(stack => (stack.roundWorkoutId || stack.id) !== stackId));
  };

  const handleGetStarted = () => {
    setIsTransitioning(true);
    // Delay showing the app to allow for the fade-out animation
    setTimeout(() => {
      setShowApp(true);
      setIsTransitioning(false);
    }, 800); // 800ms matches our CSS transition duration
  };

  return (
    <div className="min-h-screen bg-[#111417]">
      {/* Removed existing Head component */}
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/programming"
      />
      
      {/* Add custom CSS for transitions */}
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
                  setChallengeData={updateChallengeDataState}
                  currentChallengeData={challengeData}
                  selectedStacks={selectedStacks}
                  setSelectedStacks={setSelectedStacks}
                  onRemoveStack={handleRemoveStackForMobile} 
                  viewModel={constructedViewModel} // Use the correctly structured ViewModel
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
          <div className="hidden lg:block bg-[#111417]">
            <DesktopChallengeSetupView
              challengeData={challengeData}
              setChallengeData={updateChallengeDataState}
              viewModel={constructedViewModel} // Use the correctly structured ViewModel
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<PulseProgrammingPageProps> = async (context) => {
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