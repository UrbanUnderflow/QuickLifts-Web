import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { workoutService } from '../../api/firebase/workout/service';
import { SweatlistCollection, UserChallenge, Challenge, ChallengeStatus, WorkoutStatus, WorkoutSession } from '../../api/firebase/workout/types';
import debounce from 'lodash.debounce';
import { SweatlistIdentifiers } from '../../api/firebase/workout/types'; // Added SweatlistIdentifiers

// CSS for toast animation (copied from inactivityCheck)
const toastAnimation = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.3s ease-out forwards;
  }
`;

interface ChallengeUpdate {
  id: string;
  currentStatus: string;
  newStatus: string;
  startDate: string;
  endDate: string;
}

interface CollectionResult {
  updatesApplied: number;
  proposedUpdates: ChallengeUpdate[];
}

interface UpdateResult {
  success: boolean;
  message: string;
  results: {
    sweatlistCollection: CollectionResult;
    timestamp: number;
    testMode: boolean;
  };
}

const ChallengeStatusPage: React.FC = () => {
  const [sweatlistChallenges, setSweatlistChallenges] = useState<SweatlistCollection[]>([]);
  const [filteredChallenges, setFilteredChallenges] = useState<SweatlistCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChallenge, setSelectedChallenge] = useState<SweatlistCollection | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [copiedId, setCopiedId] = useState<string>('');
  const [deletingSweatlist, setDeletingSweatlist] = useState<{ [key: string]: boolean }>({});
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [userChallengesLoading, setUserChallengesLoading] = useState(false);
  const [userChallengesError, setUserChallengesError] = useState<string | null>(null);
  const [clearingAllStacks, setClearingAllStacks] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // New state variables for workout testing
  const [testingWorkout, setTestingWorkout] = useState<{ [key: string]: boolean }>({});
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedSweatlist, setSelectedSweatlist] = useState<{id: string, sweatlistName: string, index: number} | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [testingResult, setTestingResult] = useState<{success: boolean, message: string} | null>(null);

  // New state for viewing participant details
  const [selectedUserChallengeDetails, setSelectedUserChallengeDetails] = useState<UserChallenge | null>(null);
  const [showParticipantDetailsModal, setShowParticipantDetailsModal] = useState(false);

  useEffect(() => {
    const fetchAdminChallenges = async () => {
      try {
        setLoading(true);
        // Fetch all admin collections using the new service function
        const collections = await workoutService.fetchAllAdminCollections();
        setSweatlistChallenges(collections);
        setFilteredChallenges(collections);
      } catch (error) {
        console.error('Error fetching admin challenges:', error);
        // Optionally set an error state here to display to the user
      } finally {
        setLoading(false);
      }
    };

    fetchAdminChallenges();
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    if (!searchTerm) {
      setFilteredChallenges(sweatlistChallenges);
      return;
    }
    
    const lowercaseTerm = searchTerm.toLowerCase();
    const filtered = sweatlistChallenges.filter(collection => 
      (collection.id.toLowerCase().includes(lowercaseTerm)) ||
      (collection.challenge?.title?.toLowerCase().includes(lowercaseTerm)) ||
      (collection.challenge?.status?.toLowerCase().includes(lowercaseTerm))
    );
    
    setFilteredChallenges(filtered);
  }, [searchTerm, sweatlistChallenges]);

  const handleSearchChange = debounce((term: string) => {
    setSearchTerm(term);
  }, 300);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const collections = await workoutService.fetchAllAdminCollections();
      setSweatlistChallenges(collections);
      setFilteredChallenges(collections);
      setSearchTerm('');
      const searchInput = document.getElementById('challenge-search') as HTMLInputElement;
      if (searchInput) searchInput.value = '';
    } catch (error) {
      console.error('Error refreshing admin challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id)
      .then(() => {
        setCopiedId(id);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  const formatDate = (date: Date | number | undefined): string => {
    if (!date) return 'N/A';

    const dateObj = typeof date === 'number'
      ? new Date(date * 1000)  // Convert from Unix timestamp (seconds)
      : new Date(date);

    return dateObj.toLocaleString();
  };

  const runChallengeStatusUpdate = async (testMode: boolean = false) => {
    setUpdateLoading(true);
    setUpdateError(null);
    setUpdateResult(null);

    try {
      // Use the dedicated manual trigger function instead of the scheduled one
      const result = await fetch('/.netlify/functions/trigger-challenge-status-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testMode }),
      });

      // Check content type to determine if it's JSON
      const contentType = result.headers.get('content-type');

      if (!result.ok) {
        // Get the error content regardless of type
        const errorContent = await result.text();
        throw new Error(`Server error (${result.status}): ${errorContent}`);
      }

      // If it's not JSON, handle the text response
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await result.text();
        setUpdateError(`The server returned a non-JSON response: ${textResponse}`);
        return;
      }

      // Parse the JSON response
      const data: UpdateResult = await result.json();
      setUpdateResult(data);

      // Refresh the sweatlist challenges after a successful update
      if (!testMode) {
        // Re-fetch data to reflect changes using the admin function
        setLoading(true); // Show loading indicator while refreshing
        try {
          const collections = await workoutService.fetchAllAdminCollections();
          setSweatlistChallenges(collections);
          setFilteredChallenges(collections);
        } catch (refreshError) {
           console.error('Error refreshing admin challenges:', refreshError);
           setUpdateError('Update successful, but failed to refresh challenge list.');
        } finally {
          setLoading(false);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setUpdateError(errorMessage);
      console.error('Error running challenge status update:', err);
    } finally {
      setUpdateLoading(false);
    }
  };

  // --- Fetch user challenges when a challenge is selected --- 
  const handleSelectChallenge = async (collection: SweatlistCollection | null) => {
    setSelectedChallenge(collection);
    setUserChallenges([]); // Clear previous challenges
    setUserChallengesError(null);
    
    if (collection) {
      setUserChallengesLoading(true);
      try {
        // Use the existing service function to fetch by challenge ID (which is collection.id)
        const fetchedChallenges = await workoutService.fetchUserChallengesByChallengeId(collection.id);
        console.log('[ChallengeStatusPage] Fetched UserChallenges:', JSON.stringify(fetchedChallenges.map(uc => ({ id: uc.id, userId: uc.userId, challengeId: uc.challengeId })), null, 2)); // DEBUG LOG
        setUserChallenges(fetchedChallenges);
      } catch (error) {
        console.error('Error fetching user challenges:', error);
        setUserChallengesError(error instanceof Error ? error.message : 'Failed to load participants');
      } finally {
        setUserChallengesLoading(false);
      }
    } else {
       setUserChallengesLoading(false); // Ensure loading is false when deselecting
    }
  };

  // --- Handler to clear all stacks --- 
  const handleClearAllStacks = async (collectionId: string) => {
    if (!collectionId || !selectedChallenge) return;

    if (!window.confirm(`Are you sure you want to remove ALL stacks from challenge ${selectedChallenge.challenge?.title || collectionId}? This action cannot be undone.`)) {
      return;
    }

    setClearingAllStacks(true);
    try {
      await workoutService.clearAllStacksFromRound(collectionId);

      // Update local state to reflect the change immediately
      setSelectedChallenge(current => {
        if (current && current.id === collectionId) {
          // Create a new instance based on the current data but with empty sweatlistIds
          const updatedData = { ...current.toDictionary(), sweatlistIds: [] }; 
          // Convert timestamps back to Date objects if needed for the constructor
          updatedData.createdAt = current.createdAt;
          updatedData.updatedAt = new Date(); // Reflect update time locally
          if (updatedData.challenge) {
            updatedData.challenge.startDate = current.challenge?.startDate;
            updatedData.challenge.endDate = current.challenge?.endDate;
            updatedData.challenge.createdAt = current.challenge?.createdAt;
            updatedData.challenge.updatedAt = current.challenge?.updatedAt; 
          }
          return new SweatlistCollection(updatedData);
        }
        return current;
      });
      console.log(`Successfully cleared stacks locally for ${collectionId}`);
      // Optionally show a success toast

    } catch (error) {
      console.error(`Failed to clear stacks for collection ${collectionId}:`, error);
      alert(`Error clearing stacks: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Optionally show an error toast
    } finally {
      setClearingAllStacks(false);
    }
  };

  // --- Handler for status change buttons ---
  const handleStatusChangeClick = async (collectionId: string, newStatus: ChallengeStatus) => {
    if (!selectedChallenge || selectedChallenge.id !== collectionId) return;

    const currentStatus = selectedChallenge.challenge?.status;
    if (currentStatus === newStatus) {
      console.log("Status is already", newStatus);
      return;
    }

    if (!window.confirm(`Are you sure you want to change the status from '${currentStatus || 'unknown'}' to '${newStatus}' for challenge ${selectedChallenge.challenge?.title || collectionId}?`)) {
      return;
    }

    setIsUpdatingStatus(true);
    try {
      // 1. Update the main sweatlist-collection document
      await workoutService.updateChallengeStatus(collectionId, newStatus);
      console.log(`Successfully updated sweatlist-collection ${collectionId} status to ${newStatus}.`);

      // 2. Update all associated user-challenge documents (fire and forget for now, but ideally handle errors)
      console.log(`Triggering batch update for user-challenges associated with ${collectionId}...`);
      // We call this *after* the main update. The Cloud Function will trigger off these updates.
      await workoutService.updateStatusForAllUserChallenges(collectionId, newStatus);
      console.log(`Batch update for user-challenges initiated for ${collectionId}.`);

      // 3. Update local state immediately (reflects main collection change)
      setSelectedChallenge(current => {
        if (current && current.id === collectionId && current.challenge) {
          // Create a new Challenge instance with the updated status
          const updatedChallengeData = { ...current.challenge.toDictionary(), status: newStatus, updatedAt: new Date() };
          const updatedChallenge = new Challenge(updatedChallengeData);

          // Create a new SweatlistCollection instance with the updated challenge
          const updatedCollectionData = { ...current.toDictionary(), challenge: updatedChallenge, updatedAt: new Date() };
          return new SweatlistCollection(updatedCollectionData);
        }
        return current;
      });
      console.log(`Successfully updated status locally to ${newStatus} for ${collectionId}`);
      // Optionally show a success toast

    } catch (error) {
      console.error(`Failed to update status for collection ${collectionId} to ${newStatus}:`, error);
      alert(`Error updating status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Optionally show an error toast
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // --- Handler for viewing participant details ---
  const handleViewParticipantDetails = (userChallenge: UserChallenge) => {
    setSelectedUserChallengeDetails(userChallenge);
    setShowParticipantDetailsModal(true);
  };

  // Placeholder function for deleting a sweatlist
  const handleDeleteSweatlist = async (collectionId: string, sweatlistId: string, sweatlistIndex: number) => {
    // Use a unique key for loading state, e.g., combining IDs or index
    const loadingKey = `${collectionId}-${sweatlistId}-${sweatlistIndex}`; 
    
    if (!window.confirm(`Are you sure you want to remove this Sweatlist (ID: ${sweatlistId || 'N/A'}) from the challenge? This action cannot be undone.`)) {
      return;
    }

    setDeletingSweatlist(prev => ({ ...prev, [loadingKey]: true }));
    console.log(`Attempting to delete Sweatlist ID: ${sweatlistId} (index: ${sweatlistIndex}) from Collection ID: ${collectionId}`);

    try {
      // --- BACKEND INTEGRATION NEEDED ---
      // Replace this with your actual backend call, e.g.:
      // await workoutService.removeSweatlistFromCollection(collectionId, sweatlistId); 
      // Call the actual backend service function
      await workoutService.removeStackFromRound(collectionId, sweatlistId); 

      // --- UPDATE LOCAL STATE ---
      // On success, update the selectedChallenge state to remove the item visually
      setSelectedChallenge(currentChallenge => {
        if (!currentChallenge || currentChallenge.id !== collectionId) {
          return currentChallenge; // Should not happen if button is only visible for selected
        }
        
        // Filter out the deleted sweatlist based on ID and potentially index if IDs are not unique
        const updatedSweatlistIds = (currentChallenge.sweatlistIds || []).filter(
          (sl, index) => !(sl.id === sweatlistId && index === sweatlistIndex) // Match both ID and index for safety
        );

        return {
          ...currentChallenge,
          sweatlistIds: updatedSweatlistIds,
        } as SweatlistCollection; // Add type assertion
      });

      console.log(`Successfully removed Sweatlist ID: ${sweatlistId}`);
      // Optionally show a success toast message here

    } catch (error) {
      console.error(`Failed to delete Sweatlist ID: ${sweatlistId} from Collection ID: ${collectionId}`, error);
      // Show an error message to the user (e.g., using a toast)
      alert(`Error removing Sweatlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingSweatlist(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  // Add function to handle starting a test workout
  const handleTestWorkoutStart = (collectionId: string, sweatlist: SweatlistIdentifiers, index: number) => { // Modified sweatlist type
    if (!selectedChallenge || !userChallenges.length) {
      alert("Please select a challenge and ensure there are participants.");
      return;
    }
    // Find the first participant to act as the test user
    // In a real scenario, you might want to select a specific test user
    const firstParticipant = userChallenges[0];
    if (!firstParticipant) {
      alert("No participants found in this challenge to initiate a test workout.");
      return;
    }
    setSelectedParticipant(firstParticipant.userId);
    setSelectedSweatlist({...sweatlist, index}); // sweatlist already contains sweatlistAuthorId
    setShowTestModal(true);
    setTestingResult(null); // Reset previous results
  };

  const testStartWorkout = async () => {
    if (!selectedChallenge || 
        !selectedParticipant || 
        !selectedSweatlist || 
        !selectedSweatlist.id || 
        !(selectedSweatlist as any).sweatlistAuthorId) { // Cast to any for the check
      setTestingResult({
        success: false,
        message: "Missing critical data: challenge, participant, or sweatlist details (ID or Author ID)."
      });
      return;
    }

    const loadingKey = `${selectedChallenge.id}-${selectedSweatlist.id}-${selectedSweatlist.index}`;
    setTestingWorkout(prev => ({ ...prev, [loadingKey]: true }));
    setTestingResult({ success: true, message: "Initiating test workout simulation..." });

    let sessionId: string | null = null;
    let originalUserChallengeState: { isActive: boolean | undefined, lastActive: Date | null | undefined } | null = null; // Changed updatedAt to lastActive
    let currentUserChallenge: UserChallenge | undefined = undefined; 

    try {
      // --- Fetch and update UserChallenge for active state ---
      setTestingResult({ success: true, message: "Setting participant to active..." });
      const userChallenges = await workoutService.fetchUserChallengesByChallengeId(selectedChallenge.id);
      currentUserChallenge = userChallenges.find(uc => uc.userId === selectedParticipant); 

      if (currentUserChallenge) {
        originalUserChallengeState = {
          isActive: currentUserChallenge.isCurrentlyActive,
          lastActive: currentUserChallenge.lastActive // Store original lastActive
        };
        currentUserChallenge.isCurrentlyActive = true;
        currentUserChallenge.lastActive = new Date(); // Set lastActive to now for the simulation
        await workoutService.updateUserChallenge(currentUserChallenge);
        setTestingResult({ success: true, message: "Participant set to active. Fetching workout template..." });
      } else {
        console.warn(`[AdminChallengeStatus] Could not find UserChallenge for participant ${selectedParticipant} in challenge ${selectedChallenge.id} to set active state.`);
        // Proceed without setting active state if not found, or throw error
      }
      // --- End UserChallenge update ---


      setTestingResult({ success: true, message: "Fetching workout template..." });
      const [workoutTemplate, templateLogs] = await workoutService.fetchSavedWorkout(
        (selectedSweatlist as any).sweatlistAuthorId, // Cast to any for usage
        selectedSweatlist.id
      );

      if (!workoutTemplate || !templateLogs) {
        throw new Error("Failed to fetch workout template or its logs.");
      }
      setTestingResult({ success: true, message: `Template '${workoutTemplate.title}' fetched. Creating test session...` });

      console.log('[AdminChallengeStatus] About to create test session. Challenge ID:', selectedChallenge.id, 'Challenge Title:', selectedChallenge.title, 'Sweatlist ID:', selectedSweatlist.id, 'Sweatlist Name:', (selectedSweatlist as any).sweatlistName); // DEBUG LOG

      const { sessionId: newSessionId, createdLogObjects } = await workoutService.createFullTestWorkoutSession(
        selectedParticipant, // This is the userId of the participant
        workoutTemplate,
        templateLogs,
        selectedChallenge.id,
        selectedSweatlist.id
      );
      sessionId = newSessionId; // Store session ID for cleanup
      setTestingResult({ success: true, message: `Test session ${sessionId} created with ${createdLogObjects.length} exercises. Simulating completion...` });

      // Simulate completing each exercise log
      for (let i = 0; i < createdLogObjects.length; i++) {
        const logToComplete = createdLogObjects[i];
        await new Promise(resolve => setTimeout(resolve, 6000)); // 6-second delay
        
        setTestingResult({ 
          success: true, 
          message: `Simulating completion of exercise ${i + 1}/${createdLogObjects.length}: '${logToComplete.exercise?.name || 'Unknown Exercise'}'...` 
        });

        await workoutService.simulateUpdateExerciseLog(
          selectedParticipant,
          sessionId,
          logToComplete.id,
          {
            logSubmitted: true,
            isCompleted: true,
            completedAt: new Date(),
            updatedAt: new Date()
          }
        );
      }

      setTestingResult({ success: true, message: "All exercises simulated. Completing workout session..." });
      await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay

      await workoutService.simulateUpdateWorkoutSession(
        selectedParticipant,
        sessionId,
        {
          workoutStatus: WorkoutStatus.Complete,
          isCompleted: true,
          endTime: new Date(),
          updatedAt: new Date()
        } as Partial<WorkoutSession> // Corrected cast
      );

      setTestingResult({
        success: true,
        message: `Workout session ${sessionId} simulation complete! Cleaning up in 15 seconds...`
      });

      // Cleanup after 15 seconds
      setTimeout(async () => {
        if (!sessionId) return;
        try {
          setTestingResult({ success: true, message: `Cleaning up test session ${sessionId}...` });
          console.log(`Auto-deleting test workout session ${sessionId} for user ${selectedParticipant}`);
          await workoutService.deleteTestWorkoutSession(selectedParticipant, sessionId);
          
          // --- Restore UserChallenge state ---
          if (currentUserChallenge && originalUserChallengeState) {
            setTestingResult({ success: true, message: `Restoring participant's original active status...` });
            currentUserChallenge.isCurrentlyActive = originalUserChallengeState.isActive ?? false; 
            currentUserChallenge.lastActive = originalUserChallengeState.lastActive ?? null; // Restore original lastActive, default to null
            await workoutService.updateUserChallenge(currentUserChallenge); 
            setTestingResult({
              success: true,
              message: `Test simulation finished, session ${sessionId} cleaned up, and participant status restored.`
            });
          } else {
            setTestingResult({
              success: true,
              message: `Test simulation finished and session ${sessionId} cleaned up.`
            });
          }
          // --- End UserChallenge restoration ---

        } catch (cleanupError) {
          console.error("Error during test workout cleanup:", cleanupError);
          setTestingResult({
            success: false,
            message: `Simulation ran but cleanup failed for session ${sessionId}: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`
          });
        } finally {
          setTestingWorkout(prev => ({ ...prev, [loadingKey]: false }));
        }
      }, 25000); // 25 seconds (15 + 10)

    } catch (error) {
      console.error("Error during test workout simulation:", error);
      setTestingResult({
        success: false,
        message: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      // If session was created before error, try to clean it up immediately if possible
      if (sessionId) {
        setTestingResult({
          success: false,
          message: `Simulation error. Attempting immediate cleanup of session ${sessionId}... Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        try {
          await workoutService.deleteTestWorkoutSession(selectedParticipant, sessionId);
          // --- Restore UserChallenge state on error ---
          if (currentUserChallenge && originalUserChallengeState) {
             setTestingResult({ success: false, message: `Simulation error. Session cleaned up. Restoring participant status... Error: ${error instanceof Error ? error.message : 'Unknown error'}`});
            currentUserChallenge.isCurrentlyActive = originalUserChallengeState.isActive ?? false; 
            currentUserChallenge.lastActive = originalUserChallengeState.lastActive ?? null; // Restore original lastActive, default to null
            await workoutService.updateUserChallenge(currentUserChallenge);
            setTestingResult({ success: false, message: `Simulation error. Session ${sessionId} cleaned up and participant status restored. Original Error: ${error instanceof Error ? error.message : 'Unknown error'}`});
          } else {
            setTestingResult({
              success: false,
              message: `Simulation error. Session ${sessionId} cleaned up. Original Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
          // --- End UserChallenge restoration on error ---
        } catch (immediateCleanupError) {
           setTestingResult({
            success: false,
            message: `Simulation error AND cleanup failed for session ${sessionId}. Original Error: ${error instanceof Error ? error.message : 'Unknown error'}. Cleanup Error: ${immediateCleanupError instanceof Error ? immediateCleanupError.message : 'Unknown error'}`
          });
        }
      }
      setTestingWorkout(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  // --- Log state on render for debugging ---
  console.log('[Render] userChallenges:', userChallenges, 'Loading:', userChallengesLoading, 'Error:', userChallengesError);

  return (
    <AdminRouteGuard>
      <Head>
        <title>Challenge Status Management | Pulse Admin</title>
        <style>{toastAnimation}</style>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 flex items-center">
            <span className="text-[#d7ff00] mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912l-.003.002-.34.18a.75.75 0 01-.707 0A50.009 50.009 0 007.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 014.653-2.52.75.75 0 00-.65-1.352 56.129 56.129 0 00-4.78 2.589 1.858 1.858 0 00-.859 1.228 49.803 49.803 0 00-4.634-1.527.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z" />
                <path d="M13.06 15.473a48.45 48.45 0 017.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 01-.46.71 47.878 47.878 0 00-8.105 4.342.75.75 0 01-.832 0 47.877 47.877 0 00-8.104-4.342.75.75 0 01-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 016 13.18v1.27a1.5 1.5 0 00-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 00.551-1.608 1.5 1.5 0 00.14-2.67v-.645a48.549 48.549 0 013.44 1.668 2.25 2.25 0 002.12 0z" />
                <path d="M4.462 19.462c.42-.419.753-.89 1-1.394.453.213.902.434 1.347.661a6.743 6.743 0 01-1.286 1.794.75.75 0 11-1.06-1.06z" />
              </svg>
            </span>
            Challenge Status Management
          </h1>
          
          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Left gradient border */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Action Buttons */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => runChallengeStatusUpdate(true)}
                disabled={updateLoading}
                className={`relative px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition ${
                  updateLoading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-[#262a30] text-yellow-400 border border-yellow-800'
                }`}
              >
                <span className="flex items-center">
                  {updateLoading && updateResult?.results.testMode ? (
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {updateLoading && updateResult?.results.testMode ? 'Testing...' : 'Test Run (No Updates)'}
                </span>
              </button>

              <button
                onClick={() => runChallengeStatusUpdate(false)}
                disabled={updateLoading}
                className={`relative px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition ${
                  updateLoading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-[#262a30] text-[#d7ff00] border border-[#616e00]'
                }`}
              >
                <span className="flex items-center">
                  {updateLoading && !(updateResult?.results.testMode ?? true) ? (
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {updateLoading && !(updateResult?.results.testMode ?? true) ? 'Updating...' : 'Run Status Update Job'}
                </span>
              </button>
            </div>
            
            {/* Update Result */}
            {updateError && (
              <div className="flex items-center gap-2 text-red-400 mt-4 p-3 bg-red-900/20 rounded-lg relative overflow-hidden mb-6">
                {/* Error message gradient border */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>
                
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{updateError}</span>
              </div>
            )}

            {updateResult && (
              <div className="flex items-center gap-2 text-green-400 mt-4 p-3 bg-green-900/20 rounded-lg relative overflow-hidden mb-6">
                {/* Success message gradient border */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-green-500 to-emerald-400"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-green-500 to-emerald-400"></div>
                
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span>Status update completed successfully</span>
                    {updateResult.results.testMode && (
                      <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">
                        Test Mode
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 text-sm">
                    <p>Timestamp: {formatDate(updateResult.results.timestamp)}</p>
                    <p>Sweatlist Updates: {updateResult.results.sweatlistCollection.updatesApplied}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Search Input - Added */}
            <div className="mb-6">
              <label htmlFor="challenge-search" className="block text-gray-300 mb-2 text-sm font-medium">Search Challenges</label>
              <div className="relative">
                <input
                  id="challenge-search"
                  type="text"
                  placeholder="Search by ID, title, or status"
                  className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                <div className="absolute right-3 top-3">
                  <button
                    onClick={handleRefresh}
                    className="text-gray-400 hover:text-white transition"
                    title="Refresh List"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Sweatlist Challenge Tables */}
            <div className="mb-8">
              <h2 className="text-xl font-medium mb-4 text-white flex items-center">
                <span className="text-[#d7ff00] mr-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                </span>
                Sweatlist Challenges
              </h2>
              
              {loading ? (
                <div className="text-center my-4 text-gray-300">
                  <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading challenges...
                </div>
              ) : sweatlistChallenges.length === 0 ? (
                <div className="flex items-center gap-2 text-gray-400 mt-4 p-3 bg-gray-800/30 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>No sweatlist challenges found matching your criteria.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-[#262a30] rounded-lg overflow-hidden">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">ID</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Title</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Status</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Start Date</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">End Date</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Participants</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredChallenges.map((collection) => (
                        <React.Fragment key={collection.id}>
                          <tr 
                            className={`hover:bg-[#2a2f36] transition-colors ${ 
                             selectedChallenge?.id === collection.id ? 'bg-[#1d2b3a]' : '' 
                            }`} 
                          >
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              <button 
                                onClick={() => copyToClipboard(collection.id)} 
                                className="text-blue-400 hover:text-blue-300 flex items-center" 
                                title="Copy Collection ID" 
                              >
                                {collection.id.substring(0, 8)}...
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1 opacity-60" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                              </button>
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              {collection.challenge?.title || 'N/A'}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700">
                              {String(collection.challenge?.status) === 'active' ? (
                                <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">
                                  Active
                                </span>
                              ) : String(collection.challenge?.status) === 'completed' ? (
                                <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">
                                  Completed
                                </span>
                              ) : String(collection.challenge?.status) === 'published' ? (
                                <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">
                                  Published
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">
                                  {collection.challenge?.status || 'N/A'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              {formatDate(collection.challenge?.startDate)}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              {formatDate(collection.challenge?.endDate)}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              {collection.challenge?.participants?.length || 0}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700">
                              <button
                                onClick={() => handleSelectChallenge(selectedChallenge?.id === collection.id ? null : collection)}
                                className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded-lg text-xs font-medium border border-purple-900 hover:bg-purple-800/40 transition-colors flex items-center"
                                title="View details"
                              >
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                                {selectedChallenge?.id === collection.id ? 'Hide' : 'View'}
                              </button>
                            </td>
                          </tr>
                          {selectedChallenge?.id === collection.id && (
                            <tr className="animate-fade-in-up">
                              <td colSpan={7} className="border-b border-blue-800 p-0">
                                <div className="bg-[#1d2b3a] border border-blue-800 rounded-lg p-4">
                                  <div className="flex justify-between items-start mb-3">
                                    <h4 className="text-white font-medium">Challenge Details</h4>
                                    <button 
                                      onClick={() => setSelectedChallenge(null)} 
                                      className="text-gray-400 hover:text-white"
                                      title="Hide details"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-4">
                                      <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Basic Info</h5>
                                      <div className="space-y-3">
                                        <div>
                                          <div className="text-gray-400 text-xs">Collection ID</div>
                                          <div className="text-gray-300 font-mono text-sm break-all">{selectedChallenge.id}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">Owner ID(s)</div>
                                          <div className="text-gray-300 font-mono text-sm break-all">{Array.isArray(selectedChallenge.ownerId) ? selectedChallenge.ownerId.join(', ') : selectedChallenge.ownerId}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">Created At</div>
                                          <div className="text-gray-300 text-sm">{formatDate(selectedChallenge.createdAt)}</div>
                                        </div>
                                         <div>
                                          <div className="text-gray-400 text-xs">Updated At</div>
                                          <div className="text-gray-300 text-sm">{formatDate(selectedChallenge.updatedAt)}</div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-4">
                                       <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Challenge Details</h5>
                                       <div className="space-y-3">
                                         <div>
                                          <div className="text-gray-400 text-xs">Title</div>
                                          <div className="text-white font-medium">{selectedChallenge.challenge?.title || 'N/A'}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">Subtitle</div>
                                          <div className="text-gray-300 text-sm">{selectedChallenge.challenge?.subtitle || 'N/A'}</div>
                                        </div>
                                         <div>
                                          <div className="text-gray-400 text-xs">Status</div>
                                          <div className="text-gray-300 text-sm mt-1 flex items-center gap-2">
                                            {selectedChallenge.challenge?.status === ChallengeStatus.Active ? (
                                              <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">Active</span>
                                            ) : selectedChallenge.challenge?.status === ChallengeStatus.Completed ? (
                                              <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">Completed</span>
                                            ) : selectedChallenge.challenge?.status === ChallengeStatus.Published ? (
                                              <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">Published</span>
                                            ) : selectedChallenge.challenge?.status === ChallengeStatus.Draft ? (
                                              <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">Draft</span>
                                            ) : (
                                              <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">{selectedChallenge.challenge?.status || 'N/A'}</span>
                                            )}
                                             {/* --- Status Change Buttons (Show All) --- */}
                                             <div className="flex flex-wrap gap-1 mt-1">
                                               {[ChallengeStatus.Draft, ChallengeStatus.Published, ChallengeStatus.Active, ChallengeStatus.Completed, ChallengeStatus.Cancelled].map((targetStatus) => {
                                                 const isCurrent = selectedChallenge.challenge?.status === targetStatus;
                                                 let buttonClass = 'bg-gray-700/50 text-gray-400 hover:bg-gray-600';
                                                 let buttonText = `Set ${targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1)}`;
                                                 let titleText = `Set status to ${targetStatus}`;

                                                 if (targetStatus === ChallengeStatus.Published) {
                                                     buttonClass = 'bg-yellow-900/50 text-yellow-400 hover:bg-yellow-900/70 border-yellow-800';
                                                 } else if (targetStatus === ChallengeStatus.Active) {
                                                     buttonClass = 'bg-green-900/50 text-green-400 hover:bg-green-900/70 border-green-800';
                                                 } else if (targetStatus === ChallengeStatus.Completed) {
                                                     buttonClass = 'bg-blue-900/50 text-blue-400 hover:bg-blue-900/70 border-blue-800';
                                                 } else if (targetStatus === ChallengeStatus.Cancelled) {
                                                     buttonClass = 'bg-red-900/50 text-red-400 hover:bg-red-900/70 border-red-800';
                                                 } // Draft uses the default gray

                                                 return (
                                                   <button
                                                     key={targetStatus}
                                                     onClick={() => handleStatusChangeClick(selectedChallenge.id, targetStatus)}
                                                     disabled={isUpdatingStatus || isCurrent} // Disable if updating or if it's the current status
                                                     className={`px-2 py-0.5 rounded text-xs font-medium transition flex items-center gap-1 border ${isUpdatingStatus ? 'bg-gray-700 text-gray-500 cursor-wait opacity-50' : isCurrent ? 'opacity-50 cursor-not-allowed ring-2 ring-offset-2 ring-offset-[#1d2b3a]' : buttonClass}`}
                                                     title={isCurrent ? `Status is already ${targetStatus}` : titleText}
                                                   >
                                                     {isUpdatingStatus ? '...' : buttonText}
                                                   </button>
                                                 );
                                               })}
                                             </div>
                                          </div>
                                        </div>
                                       </div>
                                    </div>
                                    <div className="space-y-4">
                                      <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Timeline & Participants</h5>
                                      <div className="space-y-3">
                                        <div>
                                          <div className="text-gray-400 text-xs">Start Date</div>
                                          <div className="text-gray-300 text-sm">{formatDate(selectedChallenge.challenge?.startDate)}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">End Date</div>
                                          <div className="text-gray-300 text-sm">{formatDate(selectedChallenge.challenge?.endDate)}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">Participants</div>
                                          <div className="text-gray-300 text-sm">
                                            {userChallengesLoading
                                              ? '...'
                                              : userChallengesError
                                              ? 'N/A'
                                              : userChallenges
                                              ? userChallenges.length
                                              : 0}
                                          </div>
                                        </div>
                                         {selectedChallenge.challenge?.cohortAuthor && (
                                           <div>
                                             <div className="text-gray-400 text-xs">Cohort Author(s)</div>
                                             <div className="text-gray-300 font-mono text-sm break-all">{selectedChallenge.challenge.cohortAuthor.join(', ')}</div>
                                           </div>
                                         )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Sweatlists Included Section */}
                                  <div className="mt-6">
                                    <h5 className="text-gray-400 text-sm font-medium mb-3 border-b border-gray-700 pb-1">Sweatlists Included</h5>
                                    {/* Clear All Button - Only show if there are stacks */}
                                    {selectedChallenge.sweatlistIds && selectedChallenge.sweatlistIds.length > 0 && (
                                      <div className="mb-3 flex justify-end">
                                        <button
                                          onClick={() => handleClearAllStacks(selectedChallenge.id)}
                                          disabled={clearingAllStacks || Object.values(deletingSweatlist).some(v => v)} // Disable if clearing or deleting individual
                                          className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${clearingAllStacks ? 'bg-red-800 text-red-300 cursor-wait' : 'bg-red-900/50 text-red-400 hover:bg-red-900/70 border border-red-800'}`}
                                          title="Remove all stacks from this challenge"
                                        >
                                          {clearingAllStacks ? (
                                            <>
                                             <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                             </svg>
                                             Clearing...
                                            </>
                                          ) : (
                                            <>
                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                               <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                             </svg>
                                             Clear All Stacks
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                    {selectedChallenge.sweatlistIds && selectedChallenge.sweatlistIds.length > 0 ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {selectedChallenge.sweatlistIds.map((sweatlist: SweatlistIdentifiers, index: number) => ( // Modified sweatlist type
                                          <div
                                            key={`${sweatlist.id}-${index}`}
                                            className="p-3 rounded-lg border bg-[#262a30] border-gray-700 flex items-center justify-between"
                                          >
                                            <div className="flex items-start gap-2 flex-grow">
                                              <div className="h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium bg-gray-700 text-gray-300 flex-shrink-0">
                                                {index + 1}
                                              </div>
                                              <div>
                                                <div className="font-medium text-gray-200 break-all">
                                                  {sweatlist.sweatlistName || 'Unnamed Sweatlist'}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1 font-mono break-all">
                                                  ID: {sweatlist.id || 'N/A'}-{index}
                                                </div>
                                                {typeof sweatlist.order === 'number' && (
                                                  <div className="text-xs text-gray-400 mt-1 font-mono break-all">
                                                    Order: {sweatlist.order}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            {/* Action Buttons */}
                                            <div className="flex items-center ml-2">
                                              {/* Test Workout Start Button */}
                                              <button
                                                onClick={() => handleTestWorkoutStart(selectedChallenge.id, sweatlist, index)}
                                                className={`p-1 rounded text-blue-500 hover:bg-blue-900/50 flex-shrink-0 mr-1 ${testingWorkout[`${selectedChallenge.id}-${sweatlist.id}-${index}`] ? 'opacity-50 cursor-wait' : ''}`}
                                                title="Test Start Workout Notification"
                                                disabled={testingWorkout[`${selectedChallenge.id}-${sweatlist.id}-${index}`]}
                                              >
                                                {testingWorkout[`${selectedChallenge.id}-${sweatlist.id}-${index}`] ? (
                                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                  </svg>
                                                )}
                                              </button>
                                              {/* Delete Button */}
                                              <button
                                                onClick={() => handleDeleteSweatlist(selectedChallenge.id, sweatlist.id, index)}
                                                className={`p-1 rounded text-red-500 hover:bg-red-900/50 flex-shrink-0 ${deletingSweatlist[`${selectedChallenge.id}-${sweatlist.id}-${index}`] ? 'opacity-50 cursor-wait' : ''}`}
                                                title="Remove Sweatlist"
                                                disabled={deletingSweatlist[`${selectedChallenge.id}-${sweatlist.id}-${index}`]}
                                              >
                                                {deletingSweatlist[`${selectedChallenge.id}-${sweatlist.id}-${index}`] ? (
                                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                  </svg>
                                                )}
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-gray-400 mt-4 p-3 bg-gray-800/30 rounded-lg text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>No Sweatlists associated with this challenge.</span>
                                      </div>
                                    )}
                                  </div>
                                  {/* End Sweatlists Included Section */}

                                  {/* Participants (User Challenges) Section */}
                                  <div className="mt-6">
                                    <h5 className="text-gray-400 text-sm font-medium mb-3 border-b border-gray-700 pb-1">Participants</h5>
                                    {userChallengesLoading ? (
                                      <div className="text-center py-4 text-gray-300">
                                        <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Loading participants...
                                      </div>
                                    ) : userChallengesError ? (
                                      <div className="flex items-center gap-2 text-red-400 p-3 bg-red-900/20 rounded-lg text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <span>Error: {userChallengesError}</span>
                                      </div>
                                    ) : userChallenges.length > 0 ? (
                                      <div className="max-h-60 overflow-y-auto pr-2"> {/* Scrollable container */}
                                        <ul className="space-y-3">
                                          {userChallenges.map((uc) => (
                                            <li key={uc.id} className="p-3 rounded-lg border bg-[#262a30] border-gray-700">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  {/* Optional: Add profile image if available */}
                                                  {/* <img src={uc.profileImage?.thumbnailURL || uc.profileImage?.profileImageURL || 'placeholder.png'} alt={uc.username} className="h-8 w-8 rounded-full" /> */}
                                                  <div>
                                                    <div className="font-medium text-gray-200">{uc.username || 'N/A'}</div>
                                                    <div className="text-xs text-gray-400 mt-1 font-mono break-all">User ID: {uc.userId || 'N/A'}</div>
                                                    <div className="text-xs text-gray-500 mt-1 font-mono break-all">UC ID: {uc.id || 'N/A'}</div>
                                                    {/* Add display for ignoreNotifications */}
                                                    {uc.ignoreNotifications && uc.ignoreNotifications.length > 0 && (
                                                      <div className="text-xs text-orange-400 mt-1 font-mono break-all">
                                                        Ignoring: {uc.ignoreNotifications.join(', ')}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                {/* Add other details like progress, points, etc. */}
                                                <div className="text-right text-sm">
                                                  <div className="text-gray-300">Points: {uc.pulsePoints?.totalPoints ?? 0}</div>
                                                  <div className="text-xs text-gray-400 mt-1">Joined: {formatDate(uc.joinDate)}</div>
                                                  {/* Consider adding progress: Math.round(uc.progress * 100) + '%' */}
                                                  <button
                                                    onClick={() => handleViewParticipantDetails(uc)}
                                                    className="mt-2 px-2 py-1 bg-blue-900/30 text-blue-400 rounded-lg text-xs font-medium border border-blue-900 hover:bg-blue-800/40 transition-colors flex items-center"
                                                    title="View participant details"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                    </svg>
                                                    View Details
                                                  </button>
                                                </div>
                                              </div>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-gray-400 p-3 bg-gray-800/30 rounded-lg text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>No participants found for this challenge.</span>
                                      </div>
                                    )}
                                  </div>
                                  {/* End Participants Section */}

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toastVisible && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up z-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>ID <span className="font-mono">{copiedId.substring(0, 8)}...</span> copied to clipboard</span>
        </div>
      )}

      {/* Test Workout Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1e24] rounded-xl max-w-md w-full p-6 shadow-2xl relative animate-fade-in-up">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">Test Workout Start Notification</h3>
              <button 
                onClick={() => setShowTestModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {testingResult ? (
              <div className={`mb-4 p-3 rounded-lg ${testingResult.success ? 'bg-green-900/30 text-green-400 border border-green-900' : 'bg-red-900/30 text-red-400 border border-red-900'}`}>
                <div className="flex items-center gap-2">
                  {testingResult.success ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{testingResult.message}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-gray-300 text-sm mb-2">
                    This will create a temporary workout session for the selected participant with the stack &quot;{selectedSweatlist?.sweatlistName || 'Unknown'}&quot;. 
                    The session will auto-delete after 10 seconds.
                  </p>
                  
                  <div className="mt-4">
                    <label className="block text-gray-300 mb-2 text-sm font-medium">Select Participant</label>
                    <select 
                      value={selectedParticipant} 
                      onChange={(e) => setSelectedParticipant(e.target.value)}
                      className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white"
                    >
                      <option value="">-- Select a participant --</option>
                      {userChallenges.map(uc => (
                        <option key={uc.userId} value={uc.userId}>
                          {uc.username || 'Unknown'} ({uc.userId.substring(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowTestModal(false)}
                    className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={testStartWorkout}
                    disabled={!selectedParticipant || Object.values(testingWorkout).some(v => v)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      !selectedParticipant || Object.values(testingWorkout).some(v => v)
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                        : 'bg-[#1d2b3a] text-[#d7ff00] border border-[#616e00] hover:bg-[#2a3b4a]'
                    } transition flex items-center justify-center`}
                  >
                    {Object.values(testingWorkout).some(v => v) ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Testing...
                      </>
                    ) : (
                      'Start Test Workout'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Participant Details Modal */}
      {showParticipantDetailsModal && selectedUserChallengeDetails && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in-up">
          <div className="bg-[#1a1e24] rounded-xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">
                Participant Details: {selectedUserChallengeDetails.username || 'N/A'}
              </h3>
              <button 
                onClick={() => setShowParticipantDetailsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-gray-400">User ID:</p>
                <p className="text-gray-200 font-mono break-all">{selectedUserChallengeDetails.userId}</p>
              </div>
              <div>
                <p className="text-gray-400">User Challenge ID:</p>
                <p className="text-gray-200 font-mono break-all">{selectedUserChallengeDetails.id}</p>
              </div>
              <div>
                <p className="text-gray-400">Challenge ID:</p>
                <p className="text-gray-200 font-mono break-all">{selectedUserChallengeDetails.id}</p>
              </div>
              <div>
                <p className="text-gray-400">Joined Date:</p>
                <p className="text-gray-200">{formatDate(selectedUserChallengeDetails.joinDate)}</p>
              </div>
              <div>
                <p className="text-gray-400">Progress:</p>
                <p className="text-gray-200">{(selectedUserChallengeDetails.progress * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-gray-400">Total Points:</p>
                <p className="text-gray-200">{selectedUserChallengeDetails.pulsePoints?.totalPoints ?? 0}</p>
              </div>
               {selectedUserChallengeDetails.ignoreNotifications && selectedUserChallengeDetails.ignoreNotifications.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-gray-400">Ignoring Notifications For:</p>
                  <p className="text-orange-400 font-mono break-all">{selectedUserChallengeDetails.ignoreNotifications.join(', ')}</p>
                </div>
              )}
            </div>

            <h4 className="text-gray-300 font-medium mb-2 mt-6 border-b border-gray-700 pb-1">Completed Workouts ({selectedUserChallengeDetails.completedWorkouts?.length || 0})</h4>
            {selectedUserChallengeDetails.completedWorkouts && selectedUserChallengeDetails.completedWorkouts.length > 0 ? (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {selectedUserChallengeDetails.completedWorkouts.map((workout, index) => (
                  <div key={workout.id || index} className="p-3 rounded-lg border bg-[#262a30] border-gray-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-200 font-medium">Workout ID: {workout.workoutId || 'N/A'}</p>
                            <p className="text-xs text-gray-400 mt-1 font-mono break-all">Completed Entry ID: {workout.id || 'N/A'}</p>
                        </div>
                        <div className="text-right text-xs">
                            <p className="text-gray-300">Completed: {formatDate(workout.completedAt)}</p>
                            {/* Points awarded and notes are not directly available here */}
                            {/* <p className="text-gray-400">Points: {workout.pointsAwarded ?? 'N/A'}</p> */}
                        </div>
                    </div>
                    {/* {workout.notes && ( // Notes are not directly available
                        <div className="mt-2 pt-2 border-t border-gray-700/50">
                            <p className="text-xs text-gray-400">Notes:</p>
                            <p className="text-xs text-gray-300 whitespace-pre-wrap">{workout.notes}</p>
                        </div>
                    )} */}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400 mt-2 p-3 bg-gray-800/30 rounded-lg text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span>No completed workouts recorded for this participant in this challenge.</span>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowParticipantDetailsModal(false)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminRouteGuard>
  );
};

export default ChallengeStatusPage; 