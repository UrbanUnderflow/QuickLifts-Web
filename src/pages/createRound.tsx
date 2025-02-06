import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { 
    CheckCircle, 
    Plus, 
    Trash2, 
    ChevronDown,
    Users,
    Lock,
    Calendar,
    Clock,
    Search,
    ArrowUp,
    ArrowDown,
    X,
    Edit
  } from 'lucide-react';
import { userService } from '../api/firebase/user';
import { workoutService } from '../api/firebase/workout/service';
import { Workout, SweatlistCollection, Challenge, ChallengeStatus } from '../api/firebase/workout/types';
import { StackCard } from '../components/Rounds/StackCard'


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
    pin: string
  ) => void;
}

interface ChallengeData {
  startDate: Date;
  endDate: Date;
  challengeName: string;
  challengeDesc: string;
  roundType: SweatlistType;
  pinCode: string;
}

interface MobileChallengeSetupProps {
  setChallengeData: (
    start: Date,
    end: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string
  ) => void;
  currentChallengeData: ChallengeData;
  selectedStacks: Workout[];
  onRemoveStack: (stackId: string) => void;
  viewModel: ViewModel;
}

const MobileChallengeSetupView: React.FC<MobileChallengeSetupProps> = ({
    setChallengeData,
    currentChallengeData,
    selectedStacks,
    onRemoveStack,
    viewModel,
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
  
    return (
      <div>
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
            onChange={(e) => setChallengeData(
              startDate, 
              endDate, 
              e.target.value, 
              challengeDesc, 
              roundType, 
              pinCode
            )}
            placeholder="Add a name for your round"
            className="w-full p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50 
                      text-white placeholder:text-zinc-600
                      focus:border-[#E0FE10] focus:outline-none transition-all"
          />
        </div>
  
        {/* Description */}
        <div className="mb-8">
          <label className="text-sm text-zinc-400 mb-2 block">Description</label>
          <textarea
            value={challengeDesc}
            onChange={(e) => setChallengeData(
              startDate, 
              endDate, 
              challengeName, 
              e.target.value, 
              roundType, 
              pinCode
            )}
            placeholder="Add a description for your round"
            rows={3}
            className="w-full p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50 
                      text-white placeholder:text-zinc-600 
                      focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
          />
        </div>
  
        {/* Selected Stacks */}
        <div className="mb-8">
          <label className="text-sm text-zinc-400 mb-2 block">Selected Stacks</label>
          {selectedStacks.length === 0 ? (
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-700/50 text-center">
              <p className="text-zinc-400">No stacks selected yet</p>
              <p className="text-zinc-500 text-sm mt-1">Select stacks to add them to your round</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedStacks.map((stack) => (
                <div className="border border-zinc-700/50 rounded-lg">
                    <StackCard
                    key={stack.roundWorkoutId || stack.id}
                    workout={stack}
                    gifUrls={stack.exercises?.map(ex => ex.exercise?.videos?.[0]?.gifURL || '') || []}
                    isChallengeEnabled={false}
                    onPrimaryAction={() => onRemoveStack(stack.roundWorkoutId || stack.id)}
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
              onClick={() => setChallengeData(startDate, endDate, challengeName, challengeDesc, SweatlistType.together, pinCode)}
              className={`p-4 rounded-lg flex flex-col items-center ${
                roundType === SweatlistType.together 
                  ? "bg-[#E0FE10] text-black" 
                  : "bg-zinc-900/50 border border-zinc-700/50 text-zinc-400"
              }`}
            >
              <Users className="h-5 w-5 mb-2" />
              <span className="font-medium text-sm">Together</span>
              <span className="text-xs mt-1">Train with the community</span>
            </button>
  
            <button
              onClick={() => setChallengeData(startDate, endDate, challengeName, challengeDesc, SweatlistType.locked, pinCode)}
              className={`p-4 rounded-lg flex flex-col items-center ${
                roundType === SweatlistType.locked 
                  ? "bg-[#E0FE10] text-black" 
                  : "bg-zinc-900/50 border border-zinc-700/50 text-zinc-400"
              }`}
            >
              <Lock className="h-5 w-5 mb-2" />
              <span className="font-medium text-sm">Private</span>
              <span className="text-xs mt-1">Invite-only training</span>
            </button>
          </div>
        </div>
  
        {/* Dates */}
        <div className={`mb-20 ${roundType === SweatlistType.locked ? 'mb-4' : 'mb-40'}`}>
          <label className="text-sm text-zinc-400 mb-2 block">Round Dates</label>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => setChallengeData(
                  new Date(e.target.value),
                  endDate,
                  challengeName,
                  challengeDesc,
                  roundType,
                  pinCode
                )}
                className="w-full p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 
                        text-white placeholder:text-zinc-600
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
                onChange={(e) => setChallengeData(
                  startDate,
                  new Date(e.target.value),
                  challengeName,
                  challengeDesc,
                  roundType,
                  pinCode
                )}
                className="w-full p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 
                        text-white placeholder:text-zinc-600
                        focus:border-[#E0FE10] focus:outline-none transition-all
                        [color-scheme:dark]"
              />
            </div>
          </div>
        </div>
  
        {roundType === SweatlistType.locked && (
          <div className="mb-40">
            <label htmlFor="pinCode" className="text-sm text-zinc-400 mb-2 block">PIN Code</label>
            <input
              ref={pinCodeRef}
              id="pinCode"
              type="text"
              maxLength={9}
              minLength={9}
              value={pinCode}
              onChange={(e) => setChallengeData(
                startDate,
                endDate,
                challengeName,
                challengeDesc,
                roundType,
                e.target.value
              )}
              placeholder="Set 9-digit PIN"
              className="w-full p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 
                        text-white placeholder:text-zinc-600
                        focus:border-[#E0FE10] focus:outline-none transition-all"
            />
          </div>
        )}
      </div>
    );
  };

interface DesktopChallengeSetupProps {
  challengeData: ChallengeData;
  setChallengeData: (
    start: Date,
    end: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string
  ) => void;
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
    const [selectedStacks, setSelectedStacks] = useState<Workout[]>([]);
    const router = useRouter();
    
    const filteredStacksList = () => (
        <div className="space-y-4">
          {filteredStacks.map((stack) => (
            <div className="border border-zinc-700/50 rounded-lg">
            <StackCard
                key={stack.id}
                workout={stack}
                gifUrls={stack.exercises?.map(ex => ex.exercise?.videos?.[0]?.gifURL || '') || []}
                isChallengeEnabled={false}
                onPrimaryAction={() => handleStackSelect(stack)}

                // Remove showCalendar and isComplete if they're not in the interface
            />
            </div>
            ))}

        </div>
      );
  
    useEffect(() => {
      const fetchStacks = async () => {
        try {
          // Use the actual userService instead of mock data
          const stacks = await userService.fetchUserStacks();
          setAllStacks(stacks);
        } catch (error) {
          console.error('Error fetching stacks:', error);
        }
      };
      fetchStacks();
    }, []);

  const filteredStacks = allStacks.filter((stack) =>
    stack.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  
  const handleStackSelect = (stack: Workout) => {
    setSelectedStacks((prev: Workout[]) => {
      // First check if we already have this stack
      if (prev.some(s => s.id === stack.id)) {
        // Get all stacks with the same ID
        const sameStacks = prev.filter(s => s.id === stack.id);
        const newStack = new Workout({
          ...stack,
          roundWorkoutId: `${stack.id}-${sameStacks.length + 1}`
        });
        return [...prev, newStack];
      } else {
        // First instance of this stack
        const newStack = new Workout({
          ...stack,
          roundWorkoutId: stack.id
        });
        return [...prev, newStack];
      }
    });
  };

  const generateUniqueWorkoutIds = (stacks: Workout[]): Workout[] => {
    return stacks.map((stack, index) => {
      // Create a new Workout instance with the updated roundWorkoutId
      const updatedWorkout = new Workout({
        ...stack,
        roundWorkoutId: index === 0 ? stack.id : `${stack.id}-${index + 1}`
      });
      return updatedWorkout;
    });
  };

  const handleRemoveStack = (stackId: string) => {
    setSelectedStacks((prev: Workout[]) => {
      // Filter out the stack to remove
      const updatedStacks = prev.filter(s => s.roundWorkoutId !== stackId);
      
      // Reindex the remaining stacks
      return updatedStacks.map((stack, index) => 
        new Workout({
          ...stack,
          roundWorkoutId: index === 0 ? stack.id : `${stack.id}-${index + 1}`
        })
      );
    });
  };

  const validateChallengeInput = (): boolean => {
    if (challengeData.challengeName.trim().length === 0) {
    //   toast({
    //     title: "Error",
    //     description: "Round needs a name before you can create it",
    //     variant: "destructive"
    //   });
      return false;
    }

    if (challengeData.challengeDesc.trim().length === 0) {
    //   toast({
    //     title: "Error",
    //     description: "Round needs a description before you can create it",
    //     variant: "destructive"
    //   });
      return false;
    }

    if (challengeData.endDate <= challengeData.startDate) {
    //   toast({
    //     title: "Error",
    //     description: "Round start date needs to be before the end date",
    //     variant: "destructive"
    //   });
      return false;
    }

    if (challengeData.roundType === SweatlistType.locked && challengeData.pinCode.length !== 9) {
    //   toast({
    //     title: "Error",
    //     description: "Private rounds require a 9-digit PIN",
    //     variant: "destructive"
    //   });
      return false;
    }

    if (selectedStacks.length === 0) {
    //   toast({
    //     title: "Error",
    //     description: "Please select at least one stack for your round",
    //     variant: "destructive"
    //   });
      return false;
    }

    return true;
  };

  const handleCreateRound = async () => {
    if (!validateChallengeInput()) return;
  
    try {
      const createdAt = new Date();
      const currentUser = userService.currentUser;
  
      if (!currentUser?.id) {
        throw new Error("No user logged in");
      }
  
      // Create challenge object
      const challenge = new Challenge({
        id: "",
        title: challengeData.challengeName,
        subtitle: challengeData.challengeDesc,
        participants: [],
        status: ChallengeStatus.Draft, // Add the required status
        startDate: challengeData.startDate,
        endDate: challengeData.endDate,
        createdAt,
        updatedAt: createdAt
        // Remove ownerId as it's not part of the Challenge type
      });
  
      // Create SweatlistCollection with proper structure
      const collection = new SweatlistCollection({
        id: "",
        title: challengeData.challengeName,
        subtitle: challengeData.challengeDesc,
        pin: challengeData.pinCode,
        challenge,
        sweatlistIds: selectedStacks.map((stack, index) => ({
          id: stack.id,
          sweatlistAuthorId: currentUser.id,
          sweatlistName: stack.title,
          order: index + 1
        })),
        ownerId: [currentUser.id],
        participants: [],
        privacy: challengeData.roundType === SweatlistType.locked ? 
                 SweatlistType.locked : 
                 SweatlistType.together,
        createdAt,
        updatedAt: createdAt
      });
  
      // Update collection in Firestore
      const updatedCollection = await workoutService.updateCollection(collection);
      
      if (updatedCollection) {  
        router.push(`/round/${updatedCollection.id}`);
      }
    } catch (error) {
      console.error('Error creating round:', error);
     
    }
  };

  return (
    <div className="h-screen flex justify-center gap-6 bg-zinc-900 p-6">
      {/* Left Panel: Challenge Setup Form */}
      <div className="w-[500px] bg-zinc-800 rounded-xl shadow-xl relative flex flex-col">
        <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600">
          <MobileChallengeSetupView
            setChallengeData={setChallengeData}
            currentChallengeData={challengeData}
            selectedStacks={selectedStacks}
            onRemoveStack={handleRemoveStack}
            viewModel={viewModel}
          />
        </div>
        
         {/* Fixed Create Round Button */}
         <div className="absolute bottom-0 left-0 right-0 p-6 bg-zinc-800 border-t border-zinc-700 rounded-b-xl">
          <button
            className="w-full py-4 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
            onClick={handleCreateRound}
          >
            Create Round
          </button>
        </div>
      </div>
  
      {/* Right Panel: Stack Selector */}
      <div className="w-[400px] bg-zinc-800 rounded-xl shadow-xl relative flex flex-col">
        <div className="h-full overflow-y-auto p-6 pb-24 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600">
          <h2 className="text-white text-2xl font-bold mb-4">Your Stacks</h2>
          <input
            type="text"
            placeholder="Search stacks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-4 bg-zinc-900 text-white rounded-lg border border-zinc-700 focus:border-[#E0FE10] transition-colors mb-4"
          />
          {filteredStacks.length === 0 ? (
            <p className="text-center text-zinc-500">No stacks found</p>
          ) : (
            filteredStacksList()
          )}
        </div>
      </div>
    </div>
  );
};

const CreateRoundPage: React.FC = () => {
  const [challengeData, setChallengeData] = useState<ChallengeData>({
    startDate: new Date(),
    endDate: new Date(new Date().getTime() + 86400 * 1000),
    challengeName: '',
    challengeDesc: '',
    roundType: SweatlistType.together,
    pinCode: '',
  });

  const [selectedStacks, setSelectedStacks] = useState<Workout[]>([]);

  const updateChallengeData = (
    start: Date,
    end: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string
  ) => {
    setChallengeData({
      startDate: start,
      endDate: end,
      challengeName: name,
      challengeDesc: desc,
      roundType: type,
      pinCode: pin,
    });
  };

  // Mock viewModel for example purposes
  const mockViewModel: ViewModel = {
    appCoordinator: {
      showFloatingTextfield: () => {},
      closeFloatingMenu: () => {},
      closeModals: () => {},
    },
    validateChallengeInput: () => true,
    setChallenge: () => {},
  };

  return (
    <>
      {/* Mobile view */}
      <div className="block lg:hidden">
        {/* Left Panel: Challenge Setup Form */}
        <div className="w-full max-w-[500px] mx-auto bg-zinc-800 -xl relative flex flex-col min-h-screen">
          <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600">
            <MobileChallengeSetupView
              setChallengeData={updateChallengeData}
              currentChallengeData={challengeData}
              selectedStacks={selectedStacks}
              onRemoveStack={(stackId: string) => {
                setSelectedStacks(selectedStacks.filter(stack => stack.id !== stackId));
              }}
              viewModel={mockViewModel}
            />
          </div>
          
          {/* Fixed Create Round Button */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-zinc-800 border-t border-zinc-700 rounded-b-xl">
            <button
              className="w-full py-4 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
              onClick={() => {
                if (mockViewModel.validateChallengeInput(
                  challengeData.startDate,
                  challengeData.endDate,
                  challengeData.challengeName,
                  challengeData.challengeDesc,
                  challengeData.roundType,
                  challengeData.pinCode
                )) {
                  mockViewModel.setChallenge(
                    challengeData.startDate,
                    challengeData.endDate,
                    challengeData.challengeName,
                    challengeData.challengeDesc,
                    challengeData.roundType,
                    challengeData.pinCode
                  );
                  mockViewModel.appCoordinator.closeModals();
                }
              }}
            >
              Create Round
            </button>
          </div>
        </div>
      </div>
  
      {/* Desktop view */}
      <div className="hidden lg:block">
        <DesktopChallengeSetupView
          challengeData={challengeData}
          setChallengeData={updateChallengeData}
          viewModel={mockViewModel}
        />
      </div>
    </>
  );
};

// Export types and components
export type {
  Workout,
  ViewModel,
  ChallengeData,
  MobileChallengeSetupProps,
  DesktopChallengeSetupProps,
};

export {
  MobileChallengeSetupView,
  DesktopChallengeSetupView,
};

export default CreateRoundPage;