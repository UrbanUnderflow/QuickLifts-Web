import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Exercise } from '../../../api/firebase/exercise/types';
import { exerciseService } from '../../../api/firebase/exercise';
import { GifImageViewer } from '../../../components/GifImageViewer';
import { workoutService } from '../../../api/firebase/workout';
import { userService } from '../../../api/firebase/user';
import { Workout, WorkoutStatus, SweatlistCollection } from '../../../api/firebase/workout/types';
import { UserChallenge } from '../../../api/firebase/workout/types';
import { User } from '../../../api/firebase/user/types';
import { Challenge } from '../../../api/firebase/workout/types';
import { DocumentSnapshot } from 'firebase/firestore';
import { 
  CheckIcon, 
  ExclamationCircleIcon, 
  MagnifyingGlassIcon, 
  SparklesIcon, 
  UserGroupIcon, 
  CircleStackIcon, 
  BoltIcon, 
  XCircleIcon,
  SunIcon,
  MoonIcon,
  CalendarDaysIcon,
  PlayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { useUser } from '../../../hooks/useUser';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../api/firebase/config';
import { ExerciseVideo } from '../../../api/firebase/exercise/types';
import WorkoutTypeSelector from '../../App/Dashboard/WorkoutTypeSelector';
import ContentCategorySelector from '../../App/Dashboard/ContentCategorySelector';
import { ContentCategoryType } from '../../../api/firebase/workout/types';

// Enum for category tabs
const CategoryTab = {
  ALL: 'All',
  MOVES: 'Moves',
  ROUNDS: 'Rounds',
  PEOPLE: 'People'
};

const Discover: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [selectedCategory, setSelectedCategory] = useState(CategoryTab.ALL);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Data states
  const [trendingExercises, setTrendingExercises] = useState<Exercise[]>([]);
  const [trendingRounds, setTrendingRounds] = useState<SweatlistCollection[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<User[]>([]);
  const [activeRounds, setActiveRounds] = useState<UserChallenge[]>([]);
  const [featuredRounds, setFeaturedRounds] = useState<Challenge[]>([]);
  const [moveOfTheDay, setMoveOfTheDay] = useState<{ exercise: Exercise, video: ExerciseVideo } | null>(null);
  const [loadingMoveOfTheDay, setLoadingMoveOfTheDay] = useState(true);
  const [todaysMissions, setTodaysMissions] = useState<any[]>([]);
  
  // Search results
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [filteredRounds, setFilteredRounds] = useState<Challenge[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<User[]>([]);

  // Loading and pagination
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);

  // Mobile app menu (Pulse + caret -> shows More menu)
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

  // For ongoing workout
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [showContentCategorySelector, setShowContentCategorySelector] = useState(false);
  const [showWorkoutTypeSelector, setShowWorkoutTypeSelector] = useState(false);
  const [selectedContentCategory, setSelectedContentCategory] = useState<ContentCategoryType | null>(null);
  
  // Time-based greeting
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getTimeBasedIcon = () => {
    const hour = new Date().getHours();
    
    if (hour < 6) {
      return <MoonIcon className="w-5 h-5 text-blue-300" />;
    } else if (hour < 10) {
      return <SunIcon className="w-5 h-5 text-yellow-300" />;
    } else if (hour < 16) {
      return <SunIcon className="w-5 h-5 text-yellow-400" />;
    } else if (hour < 19) {
      return <SunIcon className="w-5 h-5 text-orange-400" />;
    } else {
      return <MoonIcon className="w-5 h-5 text-blue-300" />;
    }
  };

  // Get random motivational message
  const getMyDayMessage = () => {
    const messages = [
      "Here's what's on your agenda today.",
      "Focus on your goals for today.",
      "Plan your perfect workout day.",
      "Make today count with a great workout.",
      "What's your fitness focus today?"
    ];
    const dayOfYear = Math.floor(
      (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    return messages[dayOfYear % messages.length];
  };

  // Helper function to check if user is authenticated
  const isUserAuthenticated = () => {
    return !!currentUser?.id;
  };

  // Process today's missions from active rounds
  const processTodaysMissions = async (userChallenges: UserChallenge[]) => {
    const missions: any[] = [];
    
    // TODO: In the future, fetch round workouts from a separate collection
    // For now, we'll return empty missions since the web app doesn't have 
    // the same round workout structure as iOS
    
    // The iOS app stores workouts separately in a rounds/roundId/workouts collection
    // We would need to fetch those workouts based on the current day of the challenge
    
    for (const userChallenge of userChallenges) {
      if (!userChallenge.challenge) continue;
      
      // Calculate what day of the challenge we're on
      const startDate = new Date(userChallenge.challenge.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      
      const dayIndex = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if today's workout is already completed based on dayIndex
      // Note: This assumes completedWorkouts would have a dayIndex property in the future
      const isCompleted = userChallenge.completedWorkouts?.some(
        (cw: any) => {
          // For now, just check if any workout was completed today
          const completedDate = new Date(cw.completedAt);
          return completedDate.toDateString() === today.toDateString();
        }
      ) || false;
      
      // We would fetch the actual workout here from rounds/roundId/workouts
      // For now, create a placeholder mission
      if (dayIndex >= 0 && dayIndex < userChallenge.challenge.durationInDays) {
        // missions.push({
        //   id: `${userChallenge.id}_${dayIndex}`,
        //   challengeId: userChallenge.challengeId,
        //   challengeTitle: userChallenge.challenge.title,
        //   workout: null, // Would be fetched from rounds/roundId/workouts
        //   dayIndex,
        //   isCompleted,
        //   userChallenge
        // });
      }
    }
    
    return missions;
  };

  // Load initial data
  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  // IntersectionObserver for "Load More"
  useEffect(() => {
    if (!loaderRef.current || !hasMore || selectedCategory !== CategoryTab.MOVES || !hasMore /* trendingExercises no longer paginated */) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          // loadMoreTrendingExercises(); // This will be removed
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, lastDoc, selectedCategory]);

  // Search effect
  useEffect(() => {
    if (searchText) {
      performSearch(searchText);
    } else {
      clearSearch();
    }
  }, [searchText]);

  const loadData = async () => {
    setLoading(true);
    
    try {
      // First, load non-user-specific data that doesn't require authentication
      
      // Load trending exercises
      // const { exercises, lastVisible } = await exerciseService.fetchPaginatedExercises(null, 10);
      // setTrendingExercises(exercises);
      // setLastDoc(lastVisible);

      // Fetch Move of the Day
      await fetchMoveOfTheDayData();
      
      // Load trending rounds
      const trendingRoundsData = await workoutService.fetchTrendingRounds();
      setTrendingRounds(trendingRoundsData || []);
      
      // Load featured creators
      const creatorsData = await userService.fetchFeaturedUsers();
      setFeaturedCreators(creatorsData || []);
      
      // Load featured rounds
      const collections = await workoutService.fetchLiveRounds();
      const challenges = collections.map(collection => collection.challenge).filter((c): c is Challenge => !!c);
      setFeaturedRounds(challenges);
      
      // Then, load user-specific data only if a user is signed in
      if (isUserAuthenticated() && currentUser?.id) {
        // Load current workout *only if* status is InProgress
        try {
          const currentSession = await workoutService.fetchCurrentWorkoutSession(currentUser.id);
          if (currentSession?.workout?.workoutStatus === WorkoutStatus.InProgress) {
            setCurrentWorkout(currentSession.workout);
          } else {
            setCurrentWorkout(null); // Ensure it's null if no workout is InProgress
          }
        } catch (error) {
           console.log('Could not fetch current workout session:', error);
           setCurrentWorkout(null);
        }
        
        // Load active rounds using the dedicated method
        try {
          const activeUserRounds = await workoutService.fetchActiveUserChallenges();
          setActiveRounds(activeUserRounds);
          
          // Process today's missions from active rounds
          const missions = await processTodaysMissions(activeUserRounds);
          setTodaysMissions(missions);
        } catch (error) {
          console.log("Active user challenges couldn't be loaded, user might not be authenticated yet");
          setActiveRounds([]);
          setTodaysMissions([]);
        }
      } else {
        // If no user is signed in, clear user-specific data
        setCurrentWorkout(null);
        setActiveRounds([]);
        setTodaysMissions([]);
      }
      
    } catch (error) {
      console.error('Error loading discover data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTrendingExercises = async () => {
    // This function is no longer needed and will be removed.
    // if (!hasMore || loadingMore) return;
    
    // setLoadingMore(true);
    // try {
    //   const { exercises: newExercises, lastVisible } = await exerciseService.fetchPaginatedExercises(lastDoc, 10);
      
    //   setTrendingExercises(prev => [...prev, ...newExercises]);
    //   setLastDoc(lastVisible);
    //   setHasMore(newExercises.length > 0);
    // } catch (error) {
    //   console.error('Error loading more exercises:', error);
    // } finally {
    //   setLoadingMore(false);
    // }
  };

  const fetchMoveOfTheDayData = async () => {
    setLoadingMoveOfTheDay(true);
    try {
      const today = new Date();
      const month = String(today.getUTCMonth() + 1).padStart(2, "0");
      const day = String(today.getUTCDate()).padStart(2, "0");
      const year = today.getUTCFullYear();
      const documentId = `${month}-${day}-${year}`;
      
      const motdDocRef = doc(db, "moveOfTheDay", documentId);
      const motdSnapshot = await getDoc(motdDocRef);

      if (motdSnapshot.exists()) {
        const data = motdSnapshot.data();
        // Assuming data structure is { exercise: ExerciseData, video: VideoData }
        // We might need to construct Exercise and ExerciseVideo instances if methods are needed
        // For now, direct data usage for rendering might be okay if types align
        setMoveOfTheDay({ 
          exercise: new Exercise(data.exercise), // Construct to ensure methods/types
          video: new ExerciseVideo(data.video)   // Construct to ensure methods/types
        });
      } else {
        setMoveOfTheDay(null);
        console.log("Move of the Day for today not found.");
      }
    } catch (error) {
      console.error("Error fetching Move of the Day:", error);
      setMoveOfTheDay(null);
    } finally {
      setLoadingMoveOfTheDay(false);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    
    // Filter moves (exercises) similar to iOS HomePulseView using the in-memory exercise cache
    try {
      let all = exerciseService.allExercises || [];

      // If exercises haven't been loaded yet, fetch them once
      if (!all.length) {
        await exerciseService.fetchExercises();
        all = exerciseService.allExercises || [];
      }

      const normalized = lowerQuery;

      const matchingExercises = all.filter((exercise) => {
        const nameMatch = (exercise.name || '').toLowerCase().includes(normalized);

        const primaryMatch = (exercise.primaryBodyParts || []).some((part) =>
          (part || '').toLowerCase().includes(normalized)
        );

        const secondaryMatch = (exercise.secondaryBodyParts || []).some((part) =>
          (part || '').toLowerCase().includes(normalized)
        );

        const tagMatch = (exercise.tags || []).some((tag) =>
          (tag || '').toLowerCase().includes(normalized)
        );

        const descriptionMatch = (exercise.description || '')
          .toLowerCase()
          .includes(normalized);

        const stepsMatch = (exercise.steps || []).some((step) =>
          (step || '').toLowerCase().includes(normalized)
        );

        const captionMatch = (exercise.videos || []).some((video) =>
          (video.caption || '').toLowerCase().includes(normalized)
        );

        return (
          nameMatch ||
          primaryMatch ||
          secondaryMatch ||
          tagMatch ||
          descriptionMatch ||
          stepsMatch ||
          captionMatch
        );
      });

      const limitedExercises = matchingExercises.slice(0, 50);
      setFilteredExercises(limitedExercises);
    } catch (error) {
      console.error('Error searching exercises:', error);
      setFilteredExercises([]);
    }
    
    // Filter rounds
    const matchingUserChallenges = activeRounds.filter(round => 
      (round.challenge?.title || '').toLowerCase().includes(lowerQuery) || 
      (round.challenge?.subtitle || '').toLowerCase().includes(lowerQuery)
    ).map(round => round.challenge).filter((c): c is Challenge => !!c);

    const matchingFeaturedRounds = featuredRounds.filter(round => 
      (round.title || '').toLowerCase().includes(lowerQuery) || 
      (round.subtitle || '').toLowerCase().includes(lowerQuery)
    );

    setFilteredRounds([...matchingUserChallenges, ...matchingFeaturedRounds]);
    
    // Filter people
    const matchingPeople = featuredCreators.filter(creator => 
      creator.username.toLowerCase().includes(lowerQuery)
    );
    
    // If less than 3 users found, query more from database
    if (matchingPeople.length < 3) {
      try {
        const additionalUsers = await userService.queryUsers(lowerQuery);
        const allUsers = [...matchingPeople];
        
        // Add any new users not already in the list
        additionalUsers.forEach(user => {
          if (!allUsers.find(existing => existing.id === user.id)) {
            allUsers.push(user);
          }
        });
        
        setFilteredPeople(allUsers);
      } catch (error) {
        console.error('Error querying additional users:', error);
        setFilteredPeople(matchingPeople);
      }
    } else {
      setFilteredPeople(matchingPeople);
    }
  };

  const clearSearch = () => {
    setFilteredExercises([]);
    setFilteredRounds([]);
    setFilteredPeople([]);
  };

  const handleVideoSelection = (exerciseIndex: number, videoIndex: number) => {
    // This function might be obsolete or need to apply to moveOfTheDay if it has multiple videos.
    // For now, assuming moveOfTheDay has one primary video.
    // const updatedExercises = [...trendingExercises];
    // const exercise = updatedExercises[exerciseIndex];
    
    // if (exercise && exercise.videos && exercise.videos[videoIndex]) {
    //   updatedExercises[exerciseIndex] = new Exercise({
    //     ...exercise,
    //     currentVideoPosition: videoIndex
    //   });
    //   setTrendingExercises(updatedExercises);
    // }
  };

  const handleProfileClick = (username: string) => {
    if (username) {
      router.push(`/profile/${username}`);
    }
  };

  const selectExercise = (exercise: Exercise) => {
    // Handle cases where exercise name already contains hyphens
    // Replace spaces with hyphens, but use a special encoding for existing hyphens
    const slug = exercise.name
      .replace(/-/g, '%2D') // First encode any existing hyphens to their URL encoded form
      .toLowerCase()
      .replace(/\s+/g, '-'); // Then replace spaces with hyphens
    
    router.push(`/exercise/${slug}`);
  };

  const selectWorkout = (workout: Workout) => {
    router.push(`/workout/${workout.id}`);
  };
  
  const selectCreator = (creator: User) => {
    router.push(`/profile/${creator.username}`);
  };

  const selectRound = (round: UserChallenge | Challenge) => {
    // If it's a UserChallenge, use the challenge ID from the challenge object
    // If it's a Challenge, use its own ID
    const challengeId = 'challengeId' in round ? round.challengeId : round.id;
    router.push(`/round/${challengeId}`);
  };

  const renderWelcomeSection = () => {
    // Use the currentUser from the useUser hook defined at the top of the component
    const greeting = getTimeBasedGreeting();
    const message = getMyDayMessage();

    return (
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-lime-500/10 via-zinc-900 to-cyan-500/10 px-4 py-4 sm:px-6 sm:py-5 shadow-lg">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lime-400/10" />
            <div className="absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-cyan-400/5" />
          </div>

          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center text-[#E0FE10] mb-1">
                {getTimeBasedIcon()}
                <p className="ml-2 text-sm font-medium sm:text-base">
                  {greeting},
                </p>
              </div>
              {/* Use currentUser from hook, provide default if null */}
              <h2 className="truncate text-xl font-bold text-white sm:text-2xl">
                {currentUser?.username || 'Fitness Enthusiast'}
              </h2>
              <p className="mt-2 text-sm text-zinc-400 sm:text-base">
                {message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowContentCategorySelector(true)}
              className="relative inline-flex shrink-0 items-center justify-center rounded-full bg-[#E0FE10] px-4 py-2 text-xs font-semibold text-zinc-900 shadow-lg shadow-lime-400/30 transition hover:bg-lime-300 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <SparklesIcon className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" />
              <span>Start today&apos;s workout</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSearchBar = () => (
    <div className="relative mb-6 flex items-center rounded-lg border border-zinc-700/30 bg-zinc-800 shadow-lg">
      <MagnifyingGlassIcon className="w-5 h-5 ml-4 text-zinc-400" />
      <input
        type="text"
        placeholder="Search moves, rounds, or people..."
        className="w-full py-3 px-4 bg-transparent text-white focus:outline-none placeholder-zinc-500"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onFocus={() => setIsSearching(true)}
      />
      {searchText && (
        <button 
          onClick={() => {
            setSearchText('');
            setIsSearching(false);
            setSelectedCategory(CategoryTab.ALL);
            clearSearch();
          }}
          className="absolute right-4"
        >
          <XCircleIcon className="w-5 h-5 text-zinc-500 hover:text-zinc-300 transition-colors" />
        </button>
      )}
    </div>
  );

  const renderCategoryTabs = () => (
    <div className="flex overflow-x-auto pb-2 mb-6 scrollbar-none">
      {Object.values(CategoryTab).map(tab => (
        <button
          key={tab}
          onClick={() => setSelectedCategory(tab)}
          className={`flex items-center px-4 py-2 mr-3 rounded-full text-sm font-medium transition-all
            ${selectedCategory === tab 
              ? 'bg-[#E0FE10] text-zinc-900 shadow-md' 
              : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
        >
          <span className="flex items-center justify-center">
            {getTabIcon(tab as keyof typeof CategoryTab)}
            <span className="ml-2">{tab}</span>
          </span>
        </button>
      ))}
    </div>
  );

  const getTabIcon = (tab: keyof typeof CategoryTab) => {
    switch (tab) {
      case CategoryTab.ALL:
        return <SparklesIcon className="w-4 h-4" />;
      case CategoryTab.MOVES:
        return <BoltIcon className="w-4 h-4" />;
      case CategoryTab.ROUNDS:
        return <CircleStackIcon className="w-4 h-4" />;
      case CategoryTab.PEOPLE:
        return <UserGroupIcon className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const renderQuickActions = () => (
    <div className="mb-8">
      <h3 className="mb-3 text-white font-bold">Quick Actions</h3>
      <div
        className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:p-5 shadow-lg"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#E0FE10]/5 via-transparent to-cyan-400/10 pointer-events-none" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E0FE10] text-zinc-900 shadow-lg shadow-[#E0FE10]/40 sm:h-12 sm:w-12">
              <SparklesIcon className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-white sm:text-lg">
                Start a workout
              </h4>
              <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
                Get a personalized AI-powered Movelist in seconds, using your favorite creator moves.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
            <button
              type="button"
              onClick={() => setShowContentCategorySelector(true)}
              className="inline-flex items-center justify-center rounded-full bg-[#E0FE10] px-4 py-2 text-xs font-semibold text-zinc-900 shadow-md shadow-lime-400/40 transition hover:bg-lime-300 sm:px-5 sm:text-sm"
            >
              <SparklesIcon className="mr-1.5 h-4 w-4" />
              <span>Start</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTodaysMissions = () => {
    if (!currentUser) return null;

    return (
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <h3 className="text-white font-bold">Today's Missions</h3>
          {todaysMissions.length > 0 && (
            <span className="text-zinc-500 text-sm ml-2">({todaysMissions.length})</span>
          )}
        </div>

        <div className="relative">
          <div className="carousel flex gap-4 overflow-x-auto pb-4 scrollbar-none">
            {/* AI Powered Workouts Card - Always shown first */}
            <div 
              className="min-w-[320px] border border-[#E0FE10] bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-xl p-6 snap-start relative overflow-hidden cursor-pointer transition-transform"
              onClick={() => router.push('/stacks')}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-[#E0FE10] opacity-10 blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-[#E0FE10] flex items-center justify-center shadow-lg shadow-[#E0FE10]/30">
                    <SparklesIcon className="w-7 h-7 text-zinc-900" />
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-lg mb-1">AI Powered Workouts</h4>
                    <p className="text-zinc-400 text-sm">Customized just for you</p>
                  </div>
                </div>
                
                <p className="text-zinc-300 text-sm mb-6 leading-relaxed">
                  Instantly generate a custom Movelist with AI, blending your favorite creator moves to match your goals for today.
                </p>
                
                <button className="w-full bg-[#E0FE10] text-zinc-900 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-[#d0ee00] transition-colors shadow-lg shadow-[#E0FE10]/20">
                  <SparklesIcon className="w-5 h-5" />
                  <span>Create Workout</span>
                </button>
              </div>
            </div>

            {/* Mission Cards */}
            {todaysMissions.map((mission, index) => (
              <div 
                key={mission.id}
                className="min-w-[280px] bg-zinc-800 rounded-xl p-4 snap-start cursor-pointer hover:bg-zinc-750 transition-colors"
                onClick={() => {
                  if (!mission.isCompleted && mission.workout) {
                    router.push(`/workout/${mission.workout.id}?roundId=${mission.challengeId}`);
                  }
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="text-white font-medium text-base mb-1">
                      {mission.challengeTitle}
                    </h4>
                    <p className="text-zinc-400 text-sm">Day {mission.dayIndex + 1}</p>
                  </div>
                  {mission.isCompleted && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                
                {mission.workout && (
                  <div className="space-y-2">
                    <div className="text-white font-medium text-sm">
                      {mission.workout.title || mission.workout.workoutName || 'Workout'}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span>{mission.workout.durationInMinutes || 30} min</span>
                      <span>•</span>
                      <span>{mission.workout.exercises?.length || 0} exercises</span>
                    </div>
                    {!mission.isCompleted && (
                      <button className="mt-3 w-full bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors">
                        Start Workout
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderContinueWorkoutCard = () => {
    if (!currentWorkout) return null;
    console.log('Rendering Continue Workout Card for:', currentWorkout);

    const completedExercises = currentWorkout.exercises?.filter(ex => ex.isCompleted) || [];
    const progress = currentWorkout.exercises?.length 
      ? Math.round((completedExercises.length / currentWorkout.exercises.length) * 100)
      : 0;

    return (
      <div className="bg-zinc-800 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-white font-bold">Continue Workout</h3>
          <span className="text-zinc-400 text-sm">{progress}% Complete</span>
        </div>

        <div className="w-full bg-zinc-700 h-2 rounded-full mb-3">
          <div 
            className="bg-[#E0FE10] h-2 rounded-full" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-white">{currentWorkout.title || "Current Workout"}</p>
            <div className="flex mt-1">
              <div className="flex items-center text-zinc-400 text-sm mr-3">
                <img src="/icons/clock.svg" alt="Duration" className="w-4 h-4 mr-1" />
                <span>{currentWorkout.estimatedDuration || 45} min</span>
              </div>
              <div className="flex items-center text-zinc-400 text-sm">
                <img src="/icons/dumbbell.svg" alt="Type" className="w-4 h-4 mr-1" />
                <span>{currentWorkout.zone || "Strength"}</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => router.push(`/workout/${currentWorkout.id}`)}
            className="bg-[#E0FE10] text-zinc-900 py-2 px-4 rounded-md font-medium"
          >
            Resume
          </button>
        </div>
      </div>
    );
  };

  const renderActiveRounds = () => {
    if (!activeRounds.length) {
      // Show empty state for Active Rounds
      return (
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <h3 className="text-white font-bold">Active Rounds</h3>
          </div>
          <div className="bg-zinc-800 rounded-xl p-8 text-center">
            <UserGroupIcon className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-white font-medium mb-2">No Active Rounds</h4>
            <p className="text-zinc-400 text-sm mb-4">Join a round to track your progress with friends</p>
            <button 
              onClick={() => router.push('/rounds')}
              className="bg-[#E0FE10] text-zinc-900 px-6 py-2 rounded-lg font-medium text-sm hover:bg-[#d0ee00] transition-colors"
            >
              Browse Rounds
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <h3 className="text-white font-bold">Active Rounds</h3>
          <span className="text-zinc-500 text-sm ml-2">({activeRounds.length})</span>
        </div>

        <div className="relative">
          <div className="carousel flex gap-4 overflow-x-auto pb-4 scrollbar-none">
            {activeRounds.map((round, index) => {
              const now = new Date();
              const challengeStart = new Date(round.challenge?.startDate || now);
              const challengeEnd = new Date(round.challenge?.endDate || now);

              const daysLeft = Math.max(
                0,
                Math.floor(
                  (challengeEnd.getTime() - now.getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              );

              // Calculate progress based on time elapsed (days passed vs total days)
              const totalDays = round.challenge?.durationInDays || 30;
              const startDate = new Date(round.challenge?.startDate || now);
              const today = new Date();

              startDate.setHours(0, 0, 0, 0);
              today.setHours(0, 0, 0, 0);

              // Calculate days passed since challenge started
              const rawDaysPassed = Math.floor(
                (today.getTime() - startDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              const daysPassed = Math.max(0, rawDaysPassed);

              // Progress is based on time elapsed, not workouts completed
              const progressPercentage = Math.max(
                0,
                Math.min(100, (daysPassed / totalDays) * 100)
              );

              let todaysLabel = 'Starts soon';
              if (rawDaysPassed >= totalDays) {
                todaysLabel = 'Challenge completed';
              } else if (rawDaysPassed >= 0) {
                todaysLabel = `Day ${daysPassed + 1} of ${totalDays}`;
              }

              // Debug logging for progress calculation
              console.log(`📊 [renderActiveRounds] Time-based progress for ${round.challenge?.title}:`, {
                totalDays,
                daysLeft,
                daysPassed,
                progressPercentage: Math.round(progressPercentage),
                startDate: startDate.toISOString(),
                endDate: challengeEnd.toISOString(),
                today: today.toISOString()
              });

              return (
                <div
                  key={round.id || index}
                  className="min-w-[300px] snap-start cursor-pointer rounded-2xl bg-zinc-900/80 p-5 transition-colors hover:bg-zinc-800"
                  onClick={() => selectRound(round)}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h4 className="mb-1 text-base font-semibold text-white">
                        {round.challenge?.title || 'Active Round'}
                      </h4>
                      <p className="text-sm text-zinc-400">
                        {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#E0FE10]">
                        {round.pulsePoints?.totalPoints || 0}
                      </div>
                      <div className="text-xs text-zinc-500">Points</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="mb-1 flex justify-between text-xs text-zinc-400">
                      <span>Progress</span>
                      <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#E0FE10] to-[#a5c600] transition-all duration-300"
                        style={{
                          width: `${progressPercentage}%`,
                          minWidth: progressPercentage > 0 ? '2px' : '0px', // Ensure visibility for any progress
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-sm font-semibold text-white">
                        {round.completedWorkouts?.length || 0}/{totalDays}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Workouts
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm font-semibold text-white">
                        {round.currentStreak || 0}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Streak
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm font-semibold text-white">
                        {Math.round(progressPercentage)}%
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Time
                      </div>
                    </div>
                  </div>

                  {/* Today's Workout Row */}
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-800 pt-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Today&apos;s Workout
                      </p>
                      <p className="mt-0.5 truncate text-sm text-white">
                        {todaysLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectRound(round);
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#E0FE10] px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-md shadow-lime-400/40 transition hover:bg-lime-300"
                    >
                      <PlayIcon className="h-4 w-4" />
                      <span>Start workout</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderTrendingRounds = () => {
    if (!trendingRounds.length) {
      return (
        <div className="mb-8">
          <h3 className="text-white font-bold mb-4">Trending Rounds</h3>
          <div className="bg-zinc-800 rounded-xl p-8 text-center">
            <BoltIcon className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-white font-medium mb-2">No Trending Rounds</h4>
            <p className="text-zinc-400 text-sm">Check back soon for popular community rounds!</p>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-8">
        <h3 className="text-white font-bold mb-4">Trending Rounds</h3>
        
        <div className="carousel flex gap-4 overflow-x-auto pb-4 scrollbar-none">
          {trendingRounds.map((roundCollection, index) => (
            <div 
              key={roundCollection.id || index}
              className="min-w-[320px] bg-gradient-to-br from-red-600/20 via-orange-500/10 to-zinc-800 rounded-xl overflow-hidden cursor-pointer transition-transform shadow-lg"
              onClick={() => router.push(`/round/${roundCollection.challenge?.id || roundCollection.id}`)}
            >
              {/* Header with gradient background */}
              <div className="relative h-32 bg-gradient-to-br from-red-500 to-orange-400 p-4">
                {/* Decorative elements */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-8 -left-8 w-24 h-24 bg-white/10 rounded-full"></div>
                  <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white/5 rounded-full"></div>
                </div>
                
                {/* Content */}
                <div className="relative z-10 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <CircleStackIcon className="w-6 h-6 text-white" />
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-lg mb-1 line-clamp-1">
                      {roundCollection.title}
                    </h4>
                    {roundCollection.challenge && (
                      <div className="flex items-center gap-3 text-sm text-white/90">
                        <span className="flex items-center gap-1">
                          <CalendarDaysIcon className="w-4 h-4" />
                          {roundCollection.challenge.durationInDays} days
                        </span>
                        <span className="flex items-center gap-1">
                          <UserGroupIcon className="w-4 h-4" />
                          Active rounds
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Description section */}
              <div className="p-4 bg-zinc-800">
                {roundCollection.challenge?.subtitle ? (
                  <p className="text-zinc-300 text-sm mb-4 line-clamp-3">
                    {roundCollection.challenge.subtitle.length > 120 
                      ? `${roundCollection.challenge.subtitle.substring(0, 120)}...`
                      : roundCollection.challenge.subtitle
                    }
                  </p>
                ) : (
                  <p className="text-zinc-300 text-sm mb-4">
                    Join this featured training program and challenge yourself with other fitness enthusiasts!
                  </p>
                )}
                
                {/* CTA */}
                <div className="flex items-center justify-end">
                  <span className="text-orange-400 font-medium text-sm">View Details</span>
                  <svg className="w-4 h-4 ml-1 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFeaturedCreators = () => {
    if (!featuredCreators.length) return null;

    return (
      <div className="mb-8">
        <h3 className="text-white font-bold mb-4">Featured Fitness Creators</h3>
        
        <div className="carousel flex gap-6 overflow-x-auto pb-2 scrollbar-none">
          {featuredCreators.map((creator, index) => (
            <div 
              key={creator.id || index}
              className="flex flex-col items-center w-20 cursor-pointer"
              onClick={() => selectCreator(creator)}
            >
              <div className="w-20 h-20 rounded-full mb-2 overflow-hidden">
                {creator.profileImage?.profileImageURL ? (
                  <img 
                    src={creator.profileImage.profileImageURL} 
                    alt={creator.username}
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                    <span className="text-xl text-[#E0FE10] font-medium">
                      {creator.username?.charAt(0).toUpperCase() || "U"}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-white text-sm text-center truncate w-full">
                {creator.username}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMoveOfTheDaySection = () => {
    if (loadingMoveOfTheDay) {
      return (
        <div className="mb-8 p-4 bg-zinc-800 rounded-xl shadow-lg animate-pulse">
          <div className="h-8 bg-zinc-700 rounded w-3/4 mb-4"></div>
          <div className="aspect-video bg-zinc-700 rounded-lg mb-3"></div>
          <div className="h-4 bg-zinc-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-zinc-700 rounded w-1/3"></div>
        </div>
      );
    }

    if (!moveOfTheDay) {
      return (
        <div className="mb-8 p-6 bg-zinc-800 rounded-xl shadow-lg text-center">
          <CalendarDaysIcon className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">Move of the Day</h3>
          <p className="text-zinc-400 text-sm">Check back soon for today's featured move!</p>
        </div>
      );
    }

    const { exercise, video } = moveOfTheDay;

    return (
      <div className="mb-8 bg-gradient-to-br from-zinc-800 to-zinc-900 p-1 rounded-xl shadow-2xl hover:shadow-lime-500/30 transition-shadow duration-300">
        <div className="bg-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-bold text-[#E0FE10] flex items-center">
                <BoltIcon className="w-6 h-6 mr-2 text-[#E0FE10]" />
                Move of the Day
              </h2>
              {/* Optional: Add date or a small badge here */}
            </div>
          </div>

          <div 
            className="relative aspect-video w-full cursor-pointer group"
            onClick={() => selectExercise(exercise)}
          >
            {video.videoURL ? (
              <video
                key={video.videoURL} // Add key to force re-render if URL changes
                src={video.videoURL}
                className="w-full h-full object-cover"
                loop
                muted
                playsInline
                autoPlay
                poster={video.thumbnail || ''} // Use thumbnail as poster
              />
            ) : (
              <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                <BoltIcon className="w-16 h-16 text-zinc-500" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <PlayIcon className="w-16 h-16 text-white/80" />
            </div>
          </div>
          
          <div className="p-4">
            <h3 
              className="text-xl font-semibold text-white mb-1 hover:text-[#E0FE10] cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (video.username) handleProfileClick(video.username);
              }}
            >
              {exercise.name}
            </h3>
            
            {/* Creator Info */}
            <div 
              className="flex items-center gap-2 mt-2 mb-3 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (video.username) handleProfileClick(video.username);
              }}
            >
              {video.profileImage?.profileImageURL ? (
                <img 
                  src={video.profileImage.profileImageURL}
                  alt={video.username || "Creator"}
                  className="w-8 h-8 rounded-full object-cover border-2 border-zinc-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm text-[#E0FE10]">
                  {video.username?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <span className="text-sm text-zinc-300 hover:text-white transition-colors">
                {video.username || "QuickLifts Official"}
              </span>
            </div>

            <p className="text-zinc-400 text-xs mb-3 line-clamp-2">
              {exercise.description || "Check out this amazing move to boost your workout!"}
            </p>
            
            <button
              onClick={() => selectExercise(exercise)}
              className="w-full bg-[#E0FE10] text-zinc-900 py-2.5 px-4 rounded-lg font-semibold text-sm hover:bg-lime-400 transition-colors flex items-center justify-center gap-2"
            >
              <BoltIcon className="w-4 h-4" />
              View Move Details
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFeaturedRounds = () => {
    if (!featuredRounds.length) return null;

    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold">Featured Rounds</h3>
          {featuredRounds.length > 0 && (
            <span className="text-zinc-500 text-sm">({featuredRounds.length})</span>
          )}
        </div>
        
        <div className="carousel flex gap-4 overflow-x-auto pb-4 scrollbar-none">
          {featuredRounds.map((round, index) => (
            <div 
              key={round.id || index}
              className="min-w-[260px] bg-zinc-800 rounded-lg p-4 cursor-pointer"
              onClick={() => selectRound(round)}
            >
              <h4 className="text-white font-medium mb-2">
                {round.title || round.title || "Featured Round"}
              </h4>
              
              <div className="flex justify-between text-sm text-zinc-400 mb-2">
                <span>{round.durationInDays || 30} days</span>
                <span>{round.privacy || "Public"}</span>
              </div>
              
              <div className="flex items-center mb-2">
                <div className="flex -space-x-2 mr-2">
                  {(round.participants || []).slice(0, 3).map((participant, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border border-zinc-800 bg-zinc-700 overflow-hidden">
                      {participant.profileImage ? (
                        <img 
                          src={participant.profileImage.profileImageURL} 
                          alt="Participant" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs text-white">
                            {participant.username?.charAt(0).toUpperCase() || "U"}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <span className="text-sm text-zinc-400">
                  {(round.participants || []).length} participants
                </span>
              </div>
              
              <div className="flex items-center text-sm text-zinc-400">
                <img src="/icons/calendar.svg" alt="Start date" className="w-4 h-4 mr-1" />
                <span>
                  Starts {new Date(round?.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSearchResults = () => {
    if (!searchText) return null;
    
    const hasResults = filteredPeople.length > 0 || filteredRounds.length > 0 || filteredExercises.length > 0;
    
    if (!hasResults) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <img src="/icons/search-x.svg" alt="No results" className="w-16 h-16 mb-4 text-zinc-600" />
          <h3 className="text-white font-medium text-lg mb-2">No results found</h3>
          <p className="text-zinc-400 text-center">
            Try searching for different terms or categories
          </p>
          <button
            onClick={() => setSearchText('')}
            className="mt-6 text-[#E0FE10] font-medium"
          >
            Clear search
          </button>
        </div>
      );
    }
    
    return (
      <div>
        {filteredPeople.length > 0 && (
          <div className="mb-8">
            <h3 className="text-white font-bold mb-4">People</h3>
            
            <div className="space-y-3">
              {filteredPeople.map((user) => (
                <div 
                  key={user.id}
                  className="flex items-center p-3 bg-zinc-800 rounded-lg cursor-pointer"
                  onClick={() => selectCreator(user)}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                    {user.profileImage?.profileImageURL ? (
                      <img 
                        src={user.profileImage.profileImageURL} 
                        alt={user.username}
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {user.username?.charAt(0).toUpperCase() || "U"}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="text-white font-medium">{user.username}</h4>
                    {user.bio && (
                      <p className="text-zinc-400 text-sm line-clamp-1">{user.bio}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {filteredRounds.length > 0 && (
          <div className="mb-8">
            <h3 className="text-white font-bold mb-4">Rounds</h3>
            
            <div className="grid grid-cols-2 gap-4">
              {filteredRounds.map((round) => (
                <div
                  key={round.id}
                  className="bg-zinc-800 rounded-lg p-4 cursor-pointer"
                  onClick={() => selectRound(round)}
                >
                  <h4 className="text-white font-medium text-sm mb-2 line-clamp-1">
                    {round.title || "Round"}
                  </h4>
                  
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-zinc-400">{round.durationInDays || 30} days</span>
                    <span className="text-xs py-1 px-2 bg-[#E0FE10] bg-opacity-20 text-[#E0FE10] rounded-full">
                      {round.privacy || "Public"}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-xs text-zinc-400">
                    <img src="/icons/users.svg" alt="Participants" className="w-3 h-3 mr-1" />
                    <span>{(round.participants || []).length} participants</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {filteredExercises.length > 0 && (
          <div className="mb-8">
            <h3 className="text-white font-bold mb-4">Moves</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {filteredExercises.map((exercise) => (
                <div 
                  key={exercise.id}
                  className="bg-zinc-800 rounded-lg overflow-hidden cursor-pointer"
                  onClick={() => selectExercise(exercise)}
                >
                  <div className="relative aspect-square w-full">
                    {exercise.videos && exercise.videos.length > 0 && (
                      <video
                        src={exercise.videos[exercise.currentVideoPosition || 0]?.videoURL}
                        className="w-full h-full object-cover"
                        loop
                        muted
                        playsInline
                        autoPlay
                        onError={(e) => {
                          console.error('Video error:', e);
                          console.log('Video URL:', exercise.videos[exercise.currentVideoPosition || 0]?.videoURL);
                        }}
                        onLoadStart={() => {
                          console.log('Loading video URL:', exercise.videos[exercise.currentVideoPosition || 0]?.videoURL);
                        }}
                      />
                    )}
                  </div>
                  
                  <div className="p-3">
                    <h4 className="text-white text-sm mb-1">{exercise.name}</h4>
                    {exercise.primaryBodyParts && (
                      <p className="text-zinc-500 text-xs">
                        {exercise.primaryBodyParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Handle content category selection
  const handleCategorySelect = (category: ContentCategoryType) => {
    setSelectedContentCategory(category);
    setShowContentCategorySelector(false);
    
    if (category === ContentCategoryType.Lift) {
      // For Lift, show body part selection
      setShowWorkoutTypeSelector(true);
    } else if (category === ContentCategoryType.Stretch) {
      // For Stretch, navigate to stretch flow (will be implemented)
      router.push('/stretch');
    } else if (category === ContentCategoryType.Run) {
      // For Run, navigate to run configuration
      router.push('/run');
    } else if (category === ContentCategoryType.FatBurn) {
      // For Fat Burn, navigate to fat burn flow
      router.push('/fat-burn');
    }
  };

  // Main render method
  if (loading && !trendingExercises.length && !showWorkoutTypeSelector && !showContentCategorySelector) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="w-12 h-12 border-t-2 border-[#E0FE10] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 bg-zinc-900 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        {/* Desktop: Pulse logo (no dropdown) */}
        <div className="hidden md:block">
          <img 
            src="/pulse-logo-white.svg" 
            alt="Pulse" 
            className="h-7 w-auto" 
          />
        </div>

        {/* Mobile: Pulse logo with slim chevron that opens More menu */}
        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() => setShowMobileMoreMenu((v) => !v)}
            className="inline-flex items-center gap-1"
          >
            <img 
              src="/pulse-logo-white.svg" 
              alt="Pulse" 
              className="h-6 w-auto" 
            />
            {showMobileMoreMenu ? (
              <ChevronUpIcon className="w-4 h-4 text-zinc-300" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-zinc-300" />
            )}
          </button>

          {/* Mobile More menu dropdown (similar to desktop SideNav More) */}
          {showMobileMoreMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMobileMoreMenu(false)}
              />

              {/* Menu card */}
              <div className="absolute mt-3 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* App Switcher – Pulse / PulseCheck */}
                <button
                  onClick={() => {
                    router.push('/PulseCheck');
                    setShowMobileMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-zinc-800 transition-colors"
                >
                  <img
                    src="/pulseCheckIcon.png"
                    alt="PulseCheck"
                    className="w-5 h-5"
                  />
                  <span>PulseCheck</span>
                </button>

                <div className="border-t border-zinc-800" />

                {/* About */}
                <button
                  onClick={() => {
                    router.push('/about');
                    setShowMobileMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-xl">i</span>
                  <span>About</span>
                </button>

                <div className="border-t border-zinc-800" />

                {/* Settings */}
                <button
                  onClick={() => {
                    router.push('/settings');
                    setShowMobileMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-xl">⚙️</span>
                  <span>Settings</span>
                </button>

                <div className="border-t border-zinc-800" />

                {/* Sign Out */}
                <button
                  onClick={async () => {
                    try {
                      const { signOut } = await import('../../../api/firebase/auth/methods');
                      await signOut();
                      router.push('/');
                    } catch (error) {
                      console.error('Error signing out:', error);
                    } finally {
                      setShowMobileMoreMenu(false);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-xl">↩︎</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Search toggle icon (matches iOS behavior of entering a dedicated search state) */}
        <button
          type="button"
          onClick={() => {
            if (isSearching) {
              setIsSearching(false);
              setSearchText('');
              setSelectedCategory(CategoryTab.ALL);
              clearSearch();
            } else {
              setIsSearching(true);
            }
          }}
          className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white"
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
        </button>
      </div>

      {showContentCategorySelector ? (
        <ContentCategorySelector
          onClose={() => setShowContentCategorySelector(false)}
          onSelectCategory={handleCategorySelect}
        />
      ) : showWorkoutTypeSelector ? (
        <WorkoutTypeSelector
          onClose={() => {
            setShowWorkoutTypeSelector(false);
            setSelectedContentCategory(null);
          }}
          onCreateWorkout={(selectedParts) => {
            console.log('Selected body parts:', selectedParts);
            setShowWorkoutTypeSelector(false);
            setSelectedContentCategory(null);
          }}
        />
      ) : isSearching ? (
        <>
          {renderSearchBar()}
          {renderSearchResults()}
        </>
      ) : (
        <>
          {renderWelcomeSection()}
          {renderCategoryTabs()}

          {selectedCategory === CategoryTab.ALL && (
            <>
              {renderContinueWorkoutCard()}
              {renderQuickActions()}
              {renderActiveRounds()}
              {renderMoveOfTheDaySection()}
              {/* Temporarily hiding Trending Rounds until we have more data */}
              {/* {renderTrendingRounds()} */}
              {renderFeaturedCreators()}
            </>
          )}
          
          {selectedCategory === CategoryTab.MOVES && (
            <>
              {renderMoveOfTheDaySection()}
              {/* Temporarily hiding Trending Rounds until we have more data */}
              {/* {renderTrendingRounds()} */}
            </>
          )}
          
          {selectedCategory === CategoryTab.ROUNDS && (
            <>
              {renderTodaysMissions()}
              {renderActiveRounds()}
              {renderFeaturedRounds()}
              <div className="bg-zinc-800 rounded-lg p-6 mb-8">
                <h3 className="text-white font-bold mb-2">Discover More Rounds</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Search and join training programs created by the community. Train together and push each other to new heights!
                </p>
                <button 
                  onClick={() => router.push('/rounds')}
                  className="bg-zinc-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Browse All Rounds
                </button>
              </div>
            </>
          )}
          
          {selectedCategory === CategoryTab.PEOPLE && (
            renderFeaturedCreators()
          )}
        </>
      )}
    </div>
  );
};

export default Discover;