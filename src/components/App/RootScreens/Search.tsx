import React, { useState, useEffect } from 'react';
import { userService, User } from '../../../api/firebase/user';
import { Search as SearchIcon, Users, Dumbbell, UserCircle } from 'lucide-react';
import { exerciseService } from '../../../api/firebase/exercise';
import { useRouter } from 'next/router';
import { Exercise } from '../../../api/firebase/exercise';

// Types
interface SearchCardProps {
  text: string;
  subText?: string;
  icon: React.ReactNode;
}

interface ExerciseCardProps {
  exercise: Exercise;
  onSelect: (exercise: Exercise) => void;
}

interface UserCardProps {
  user: User;
  onSelect: (user: User) => void;
}

// Empty state card for different sections
const SearchCard: React.FC<SearchCardProps> = ({ text, subText, icon }) => (
  <div className="bg-zinc-800 rounded-lg p-6 mx-4 mb-6">
    <div className="flex items-start space-x-4">
      <div className="bg-zinc-700 p-4 rounded-full">
        {icon}
      </div>
      <div>
        <h3 className="text-white font-semibold text-sm mb-2">{text}</h3>
        {subText && (
          <p className="text-zinc-400 text-sm">{subText}</p>
        )}
      </div>
    </div>
  </div>
);

// Exercise Card Component
const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, onSelect }) => (
  <div 
    className="cursor-pointer p-4 hover:bg-zinc-800 transition-colors"
    onClick={() => onSelect(exercise)}
  >
    <div className="flex items-center space-x-4">
      <div className="w-16 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
        {exercise.videos[0]?.gifURL ? (
          <img 
            src={exercise.videos[0].gifURL} 
            alt={exercise.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-700">
            <Dumbbell className="w-8 h-8 text-zinc-500" />
          </div>
        )}
      </div>
      <div className="flex-1">
        <h3 className="text-white font-medium">{exercise.name}</h3>
        <p className="text-zinc-400 text-sm">
          {exercise.primaryBodyParts.join(', ')}
        </p>
      </div>
    </div>
  </div>
);

// User Card Component
const UserCard: React.FC<UserCardProps> = ({ user, onSelect }) => (
  <div 
    className="cursor-pointer p-4 hover:bg-zinc-800 transition-colors"
    onClick={() => onSelect(user)}
  >
    <div className="flex items-center space-x-4">
      {user.profileImage?.profileImageURL ? (
        <img 
          src={user.profileImage.profileImageURL} 
          alt={user.username}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 bg-zinc-700 rounded-full flex items-center justify-center">
          <UserCircle className="w-8 h-8 text-zinc-500" />
        </div>
      )}
      <div>
        <h3 className="text-white font-medium">@{user.username}</h3>
      </div>
    </div>
  </div>
);

// Tab Types
type TabType = 'all' | 'people' | 'exercises' | 'bodyparts';

const Search: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [featuredUsers, setFeaturedUsers] = useState<User[]>([]);
  const [featuredExercises, setFeaturedExercises] = useState<Exercise[]>([]);

  const router = useRouter();

  // Tab configuration
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All', icon: <SearchIcon className="w-4 h-4" /> },
    { id: 'people', label: 'People', icon: <Users className="w-4 h-4" /> },
    { id: 'exercises', label: 'Moves', icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'bodyparts', label: 'Bodyparts', icon: <Dumbbell className="w-4 h-4" /> }
  ];

  const handleUserSelect = (user: User) => {
    router.push(`/profile/${user.username}`);
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    // Convert spaces to hyphens and make lowercase for consistent URLs
    const urlName = exercise.name.toLowerCase().replace(/\s+/g, '-');
    router.push(`/exercise/${urlName}`);
  };

  // Search placeholder based on selected tab
  const getSearchPlaceholder = () => {
    switch (selectedTab) {
      case 'people':
        return 'Search people..';
      case 'exercises':
        return 'Search exercises..';
      case 'bodyparts':
        return 'Search bodyparts..';
      default:
        return 'Search people, exercises, or bodyparts..';
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const users = await userService.fetchUsersWithVideosUploaded();
        setFeaturedUsers(users);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [users, exercises] = await Promise.all([
          userService.fetchUsersWithVideosUploaded(),
          exerciseService.fetchFeaturedExercisesWithVideos(24)
        ]);
        setFeaturedUsers(users);
        setFeaturedExercises(exercises);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };
  
    loadInitialData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Top Bar with Tabs */}
      <div className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 ">
        <div className="pt-4 px-4">
          {/* Search Input */}
          <div className="flex items-center space-x-3 bg-zinc-800 rounded-lg px-4 py-2">
            <SearchIcon className="w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder={getSearchPlaceholder()}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white placeholder-zinc-500 flex-1 outline-none"
            />
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 mt-4 pb-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-colors
                  ${selectedTab === tab.id 
                    ? 'bg-[#E0FE10] text-black' 
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
              >
                {tab.icon}
                <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-4 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {searchQuery === '' ? (
        <div className="py-4 ">
          <h2 className="text-lg font-semibold text-white px-4 mb-4">
            People
          </h2>
          <div className="overflow-x-auto scrollbar-hide">
          {/* Inner container ensures all items stay on one row */}
          <div className="flex flex-nowrap space-x-4 px-4 pb-4 min-w-max">
            {featuredUsers.map((user) => (
              <div 
                key={user.id}
                className="flex-shrink-0 cursor-pointer"
                onClick={() => handleUserSelect(user)}
              >
                <div className="relative w-[150px]">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-800">
                    {user.profileImage?.profileImageURL ? (
                      <img
                        src={user.profileImage.profileImageURL}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserCircle className="w-12 h-12 text-zinc-600" />
                      </div>
                    )}
                    {user.creator?.type?.includes('personalTrainer') && (
                      <div className="absolute bottom-2 right-2">
                        <div className="bg-[#E0FE10] px-3 py-1 rounded-xl">
                          <span className="text-xs font-bold text-black tracking-wider">
                            T R A I N E R
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-white text-center">
                    @{user.username}
                  </p>
                </div>
              </div>
            ))}
          </div>
          </div>

          <div className="py-4">
            <h2 className="text-lg font-semibold text-white px-4 mb-4">
              Explore New Moves
            </h2>
            <div className="grid grid-cols-3 gap-0">
              {featuredExercises.map((exercise) => (
                <div 
                  key={exercise.id} 
                  className="cursor-pointer aspect-[2/3]"
                  onClick={() => handleExerciseSelect(exercise)}
                >
                  <div className="relative w-full h-full">
                    {exercise.videos[0]?.gifURL ? (
                      <img
                        src={exercise.videos[0].gifURL}
                        alt={exercise.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                        <Dumbbell className="w-8 h-8 text-zinc-600" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        ) : (
          // Search Results
          <div className="divide-y divide-zinc-800">
            {selectedTab === 'all' && (
              <>
                <div className="px-4 py-2 text-sm font-medium text-zinc-400">People</div>
                {/* User results would go here */}
                <div className="px-4 py-2 text-sm font-medium text-zinc-400">Exercises</div>
                {/* Exercise results would go here */}
              </>
            )}
            {selectedTab === 'people' && (
              <div className="px-4">
                {/* User results would go here */}
              </div>
            )}
            {selectedTab === 'exercises' && (
              <div className="px-4">
                {/* Exercise results would go here */}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;