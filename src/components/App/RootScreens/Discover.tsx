import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Exercise } from '../../../api/firebase/exercise/types';
import { exerciseService } from '../../../api/firebase/exercise';
import { GifImageViewer } from '../../../components/GifImageViewer';
import { workoutService } from '../../../api/firebase/workout';
import { userService } from '../../../api/firebase/user';
import { Workout } from '../../../api/firebase/workout/types';
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
  MoonIcon 
} from '@heroicons/react/24/outline';
import { useUser } from '../../../hooks/useUser';

// Enum for category tabs
const CategoryTab = {
  ALL: 'All',
  MOVES: 'Moves',
  ROUNDS: 'Rounds',
  PEOPLE: 'People'
};

const Discover = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [selectedCategory, setSelectedCategory] = useState(CategoryTab.ALL);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Data states
  const [trendingExercises, setTrendingExercises] = useState<Exercise[]>([]);
  const [trendingStacks, setTrendingStacks] = useState<Workout[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<User[]>([]);
  const [activeRounds, setActiveRounds] = useState<UserChallenge[]>([]);
  const [featuredRounds, setFeaturedRounds] = useState<Challenge[]>([]);
  
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

  // For ongoing workout
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  
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

  // Load initial data
  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  // Add an effect to reload user-specific data when auth state changes
  // useEffect(() => {
  //   // If user becomes authenticated, reload user-specific data
  //   if (isUserAuthenticated()) {
  //     const loadUserSpecificData = async () => {
  //       try {
  //         // Load current workout
  //         const currentWorkoutData = workoutService.currentWorkout;
  //         setCurrentWorkout(currentWorkoutData);
          
  //         // Load active rounds
  //         const userRounds = await workoutService.fetchUserChallenges();
  //         setActiveRounds(userRounds.filter(round => 
  //           round.challenge && new Date(round.challenge.endDate) > new Date() && !round.isCompleted
  //         ));
  //       } catch (error) {
  //         console.error('Error loading user-specific data:', error);
  //       }
  //     };
      
  //     loadUserSpecificData();
  //   } else {
  //     // If user is signed out, clear user-specific data
  //     setCurrentWorkout(null);
  //     setActiveRounds([]);
  //   }
  // }, [userService.currentUser]);

  // IntersectionObserver for "Load More"
  useEffect(() => {
    if (!loaderRef.current || !hasMore || selectedCategory !== CategoryTab.MOVES) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreTrendingExercises();
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
      const { exercises, lastVisible } = await exerciseService.fetchPaginatedExercises(null, 10);
      setTrendingExercises(exercises);
      setLastDoc(lastVisible);
      
      // Load trending stacks
      const trendingStacksData = await workoutService.fetchRandomTrendingStacks();
      setTrendingStacks(trendingStacksData || []);
      
      // Load featured creators
      const creatorsData = await userService.fetchFeaturedUsers();
      setFeaturedCreators(creatorsData || []);
      
      // Load featured rounds
      const collections = await workoutService.fetchLiveRounds();
      const challenges = collections.map(collection => collection.challenge).filter((c): c is Challenge => !!c);
      setFeaturedRounds(challenges);
      
      // Then, load user-specific data only if a user is signed in
      if (isUserAuthenticated()) {
        // Load current workout
        const currentWorkoutData = workoutService.currentWorkout;
        setCurrentWorkout(currentWorkoutData);
        
        // Load active rounds
        try {
          const userRounds = await workoutService.fetchUserChallenges();
          setActiveRounds(userRounds.filter(round => 
            round.challenge && new Date(round.challenge.endDate) > new Date() && !round.isCompleted
          ));
        } catch (error) {
          console.log('User challenges couldn\'t be loaded, user might not be authenticated yet');
          setActiveRounds([]);
        }
      } else {
        // If no user is signed in, clear user-specific data
        setCurrentWorkout(null);
        setActiveRounds([]);
      }
      
    } catch (error) {
      console.error('Error loading discover data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTrendingExercises = async () => {
    if (!hasMore || loadingMore) return;
    
    setLoadingMore(true);
    try {
      const { exercises: newExercises, lastVisible } = await exerciseService.fetchPaginatedExercises(lastDoc, 10);
      
      setTrendingExercises(prev => [...prev, ...newExercises]);
      setLastDoc(lastVisible);
      setHasMore(newExercises.length > 0);
    } catch (error) {
      console.error('Error loading more exercises:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    
    // Filter exercises
    const matchingExercises = trendingExercises.filter(exercise => 
      exercise.name.toLowerCase().includes(lowerQuery)
    );
    setFilteredExercises(matchingExercises);
    
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
    const updatedExercises = [...trendingExercises];
    const exercise = updatedExercises[exerciseIndex];
    
    if (exercise && exercise.videos && exercise.videos[videoIndex]) {
      updatedExercises[exerciseIndex] = new Exercise({
        ...exercise,
        currentVideoPosition: videoIndex
      });
      setTrendingExercises(updatedExercises);
    }
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
    
    return (
      <div className="bg-zinc-800 bg-opacity-30 rounded-lg shadow p-4 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center text-[#E0FE10] mb-1">
              {getTimeBasedIcon()}
              <p className="text-md font-medium ml-2">{getTimeBasedGreeting()},</p>
            </div>
            {/* Use currentUser from hook, provide default if null */}
            <h2 className="text-xl font-bold text-white">{currentUser?.username || 'Fitness Enthusiast'}</h2> 
            <p className="text-sm text-zinc-400 mt-2">{getMyDayMessage()}</p>
          </div>
          
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#E0FE10] bg-opacity-20">
            {/* Check if currentUser and profileImage exist before accessing URL */}
            {currentUser?.profileImage?.profileImageURL ? (
              <img 
                src={currentUser.profileImage.profileImageURL} 
                alt="Profile" 
                className="w-11 h-11 rounded-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-11 h-11">
                {getTimeBasedIcon()} 
              </div>
            )}
          </div>
        </div>
        
        <div className="h-0.5 mt-4 bg-gradient-to-r from-green-400 via-teal-500 to-blue-500 rounded-full"></div>
      </div>
    );
  };

  const renderSearchBar = () => (
    <div className="relative flex items-center bg-zinc-800 rounded-lg mb-6 shadow-lg border border-zinc-700/30">
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
          onClick={() => setSearchText('')}
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

  const renderContinueWorkoutCard = () => {
    if (!currentWorkout) return null;

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
    if (!activeRounds.length) return null;

    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold">Active Rounds</h3>
          {activeRounds.length > 0 && (
            <span className="text-zinc-500 text-sm">({activeRounds.length})</span>
          )}
        </div>

        <div className="relative">
          <div className="carousel flex gap-4 overflow-x-auto pb-4 scrollbar-none">
            {activeRounds.map((round, index) => (
              <div 
                key={round.id || index}
                className="min-w-[300px] bg-zinc-800 rounded-xl p-4 snap-start"
                onClick={() => selectRound(round)}
              >
                <h4 className="text-white font-medium text-lg mb-2">
                  {round.challenge?.title || "Active Round"}
                </h4>
                
                <div className="flex justify-between text-sm text-zinc-400 mb-3">
                  <span>
                    {Math.max(0, Math.floor((new Date(round.challenge?.endDate ?? new Date()).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days left
                  </span>
                  <span>{round.pulsePoints?.totalPoints || 0} Points</span>
                </div>
                
                <div className="w-full bg-zinc-700 h-1.5 rounded-full mb-4">
                  <div 
                    className="bg-[#E0FE10] h-1.5 rounded-full" 
                    style={{ width: `${Math.max(0, Math.min(100, (1 - (Math.floor((new Date(round.challenge?.endDate ?? new Date()).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) / (round.challenge?.durationInDays || 30))) * 100))}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-center">
                  <div>
                    <div className="text-[#E0FE10] font-medium">
                      {round.completedWorkouts?.length || 0}/{round.challenge?.durationInDays || 30}
                    </div>
                    <div className="text-xs text-zinc-500">Workouts</div>
                  </div>
                  
                  <div>
                    <div className="text-[#E0FE10] font-medium">
                      {round.currentStreak || 0}
                    </div>
                    <div className="text-xs text-zinc-500">Day Streak</div>
                  </div>
                  
                  <div>
                    <div className="text-[#E0FE10] font-medium">
                      {round.pulsePoints?.totalPoints || 0}
                    </div>
                    <div className="text-xs text-zinc-500">Points</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTrendingStacks = () => {
    if (!trendingStacks.length) return null;

    return (
      <div className="mb-8">
        <h3 className="text-white font-bold mb-4">Trending Stacks</h3>
        
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="carousel flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {trendingStacks.map((workout, index) => (
              <div 
                key={workout.id || index} 
                className="min-w-[160px] cursor-pointer"
                onClick={() => selectWorkout(workout)}
              >
                <div className="relative w-40 h-24 rounded-xl overflow-hidden mb-2">
                  {workout.exercises[0]?.exercise.videos[0]?.gifURL ? (
                    <GifImageViewer
                      gifUrl={workout.exercises[0].exercise.videos[0].gifURL}
                      alt={workout.title}
                      frameSize={{ width: 160, height: 96 }}
                      contentMode="cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                      <img src="/icons/dumbbell.svg" alt="Workout" className="w-8 h-8 text-zinc-500" />
                    </div>
                  )}
                </div>
                
                <h4 className="text-white text-sm font-medium truncate">
                  {workout.title || `${workout.zone} Workout`}
                </h4>
                
                <div className="flex items-center mt-1">
                  <div className="flex items-center text-zinc-400 text-xs mr-2">
                    <img src="/icons/clock.svg" alt="Duration" className="w-3 h-3 mr-1" />
                    <span>{workout.estimatedDuration || 30} min</span>
                  </div>
                  
                  <div className="flex items-center bg-[#E0FE10] bg-opacity-20 px-2 py-0.5 rounded-md">
                    <span className="text-[#E0FE10] text-xs">{workout.zone || "Strength"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

  const renderTrendingExercises = () => {
    return (
      <div className="mb-20">
        <h3 className="text-white font-bold mb-4">Trending Moves</h3>
        
        <div className="grid grid-cols-2 gap-4">
          {trendingExercises.map((exercise, exerciseIndex) => (
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
                <div className="flex items-center gap-3 mb-2">
                  <div 
                    className="w-6 h-6 rounded-full overflow-hidden cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const username = exercise.videos[exercise.currentVideoPosition || 0]?.username;
                      if (username) handleProfileClick(username);
                    }}
                  >
                    {exercise.videos[exercise.currentVideoPosition || 0]?.profileImage?.profileImageURL ? (
                      <img 
                        src={exercise.videos[exercise.currentVideoPosition || 0].profileImage.profileImageURL}
                        alt="User"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                        <span className="text-xs text-white">
                          {exercise.videos[exercise.currentVideoPosition || 0]?.username?.charAt(0).toUpperCase() || "U"}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <span 
                    className="text-white text-sm font-medium cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const username = exercise.videos[exercise.currentVideoPosition || 0]?.username;
                      if (username) handleProfileClick(username);
                    }}
                  >
                    {exercise.videos[exercise.currentVideoPosition || 0]?.username || "Unknown User"}
                  </span>
                </div>
                
                <h4 className="text-white text-sm mb-1">{exercise.name}</h4>
                <p className="text-zinc-500 text-xs mb-3 line-clamp-1">{exercise.description}</p>
                
                <div className="flex gap-2">
                  {exercise.videos.slice(0, 4).map((video, videoIndex) => (
                    <button
                      key={video.id}
                      className={`w-8 h-8 rounded-full overflow-hidden border-2 
                      ${(exercise.currentVideoPosition || 0) === videoIndex 
                        ? 'border-[#E0FE10]' 
                        : 'border-zinc-600'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVideoSelection(exerciseIndex, videoIndex);
                      }}
                    >
                      <GifImageViewer
                        gifUrl={video.gifURL || '/default-gif.gif'}
                        alt={`Preview ${videoIndex + 1}`}
                        frameSize={{ width: 32, height: 32 }}
                        contentMode="cover"
                      />
                    </button>
                  ))}
                  
                  {exercise.videos.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white text-xs">
                      +{exercise.videos.length - 4}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Loader for infinite scrolling */}
        {hasMore && selectedCategory === CategoryTab.MOVES && (
          <div ref={loaderRef} className="flex justify-center py-6">
            {loadingMore && (
              <div className="w-8 h-8 border-t-2 border-[#E0FE10] rounded-full animate-spin"></div>
            )}
          </div>
        )}
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
            
            <div className="grid grid-cols-2 gap-4">
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

  // Main render method
  if (loading && !trendingExercises.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="w-12 h-12 border-t-2 border-[#E0FE10] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 bg-zinc-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-white">My Day</h1>
      </div>
      
      {renderWelcomeSection()}
      {renderSearchBar()}
      
      {searchText ? 
        renderSearchResults() : 
        (
          <>
            {renderCategoryTabs()}
            
            {selectedCategory === CategoryTab.ALL && (
              <>
                {renderContinueWorkoutCard()}
                {renderActiveRounds()}
                {renderTrendingStacks()}
                {renderFeaturedCreators()}
                {renderTrendingExercises()}
              </>
            )}
            
            {selectedCategory === CategoryTab.MOVES && (
              <>
                {renderTrendingStacks()}
                {renderTrendingExercises()}
              </>
            )}
            
            {selectedCategory === CategoryTab.ROUNDS && (
              <>
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
        )
      }
    </div>
  );
};

export default Discover;