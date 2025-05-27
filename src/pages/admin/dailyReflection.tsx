import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { adminMethods } from '../../api/firebase/admin/methods';
import { DailyPrompt } from '../../api/firebase/admin/types';
import { Timestamp } from 'firebase/firestore';
import { exerciseService, Exercise } from '../../api/firebase/exercise';
import { workoutService } from '../../api/firebase/workout/service';
import { SweatlistCollection } from '../../api/firebase/workout/types';
import { formatDate } from '../../utils/formatDate';
import { Loader2, CalendarIcon, Search, CheckCircle, AlertTriangle, XCircle, ListChecks, RefreshCw, Trash2, Copy, Users } from 'lucide-react';

const CHALLENGE_CACHE_KEY = 'adminAllChallengesCache';

const DailyReflectionPage: React.FC = () => {
  const [formData, setFormData] = useState<{
    date: Date;
    text: string;
    exerciseId?: string;
    exerciseName?: string;
    challengeId?: string;
    challengeName?: string;
  }>({
    date: new Date(new Date().setHours(0, 0, 0, 0)),
    text: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingPrompts, setExistingPrompts] = useState<DailyPrompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  
  // Challenge search state
  const [allChallenges, setAllChallenges] = useState<SweatlistCollection[]>([]);
  const [isLoadingAllChallenges, setIsLoadingAllChallenges] = useState(true);
  const [isRefreshingChallenges, setIsRefreshingChallenges] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<SweatlistCollection | null>(null);
  const [challengeSearchQuery, setChallengeSearchQuery] = useState('');
  const [challengeSearchResults, setChallengeSearchResults] = useState<SweatlistCollection[]>([]);
  const challengeResultsRef = useRef<HTMLDivElement>(null);
  const challengeInputRef = useRef<HTMLInputElement>(null);
  
  // Delete state
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);

  // Format date for the input field
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    fetchExistingPrompts();
  }, []);

  useEffect(() => {
    // Add event listener to close search results when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
      if (challengeResultsRef.current && !challengeResultsRef.current.contains(event.target as Node) &&
          challengeInputRef.current !== event.target &&
          !challengeInputRef.current?.contains(event.target as Node)) {
        setChallengeSearchResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchExistingPrompts = async () => {
    setIsLoadingPrompts(true);
    try {
      const prompts = await adminMethods.getDailyPrompts(30);
      setExistingPrompts(prompts);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      setErrorMessage('Failed to load existing prompts.');
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Reset messages when form changes
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ 
      ...prev, 
      date: new Date(e.target.value) 
    }));
    
    // Reset messages when form changes
    setSuccessMessage(null);
    setErrorMessage(null);
  };
  
  const handleExerciseSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // Get all exercises and filter client-side for now
      // In a production app, you might want to implement a dedicated search API
      if (!exerciseService.allExercises || exerciseService.allExercises.length === 0) {
        await exerciseService.fetchExercises();
      }
      
      const results = exerciseService.allExercises
        .filter(exercise => 
          exercise.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 10);
        
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching exercises:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setFormData(prev => ({
      ...prev,
      exerciseId: exercise.id,
      exerciseName: exercise.name
    }));
    setSearchQuery(exercise.name);
    setSearchResults([]);
  };

  const clearSelectedExercise = () => {
    setSelectedExercise(null);
    setFormData(prev => {
      const updated = { ...prev };
      // Remove these properties entirely rather than setting to undefined
      delete updated.exerciseId;
      delete updated.exerciseName;
      return updated;
    });
    setSearchQuery('');
  };

  const selectChallenge = (challenge: SweatlistCollection) => {
    setSelectedChallenge(challenge);
    setFormData(prev => ({
      ...prev,
      challengeId: challenge.id,
      challengeName: challenge.challenge?.title || challenge.id
    }));
    setChallengeSearchQuery(challenge.challenge?.title || challenge.id);
    setChallengeSearchResults([]);
  };

  const clearSelectedChallenge = () => {
    setSelectedChallenge(null);
    setFormData(prev => {
      const updated = { ...prev };
      // Remove these properties entirely rather than setting to undefined
      delete updated.challengeId;
      delete updated.challengeName;
      return updated;
    });
    setChallengeSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    
    try {
      // Create a base prompt object with required fields
      const promptData: Partial<DailyPrompt> = {
        date: formData.date,
        text: formData.text.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Only add optional fields if they exist and have values
      if (formData.exerciseId && formData.exerciseId.trim()) {
        promptData.exerciseId = formData.exerciseId.trim();
      }
      
      if (formData.exerciseName && formData.exerciseName.trim()) {
        promptData.exerciseName = formData.exerciseName.trim();
      }
      
      if (formData.challengeId && formData.challengeId.trim()) {
        promptData.challengeId = formData.challengeId.trim();
      }
      
      const success = await adminMethods.createDailyPrompt(promptData as DailyPrompt);
      
      if (success) {
        setSuccessMessage(`Daily reflection created for ${formatDate(formData.date)}`);
        setFormData({
          date: new Date(new Date().setHours(0, 0, 0, 0)),
          text: '',
        });
        setSelectedExercise(null);
        setSelectedChallenge(null);
        setSearchQuery('');
        setChallengeSearchQuery('');
        fetchExistingPrompts(); // Refresh the list
      } else {
        setErrorMessage('Failed to create daily reflection.');
      }
    } catch (error) {
      console.error('Error creating reflection:', error);
      setErrorMessage('An error occurred while creating the reflection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Challenge fetching and caching logic
  const fetchAndCacheChallenges = React.useCallback(async (fromRefreshButton = false) => {
    if (!fromRefreshButton) setIsLoadingAllChallenges(true);
    else setIsRefreshingChallenges(true);

    console.log('[Challenge Cache] Attempting to fetch challenges from Firestore...');
    try {
      const collections = await workoutService.fetchAllAdminCollections();
      const challengesData = collections.map(c => c.toDictionary());
      
      localStorage.setItem(CHALLENGE_CACHE_KEY, JSON.stringify(challengesData));
      console.log(`[Challenge Cache] ${challengesData.length} challenges fetched and cached in localStorage.`);
      
      setAllChallenges(collections);
      console.log('[Challenge Cache] All challenges state updated with Firestore data:', collections);
      setErrorMessage(null);
      if (fromRefreshButton) setSuccessMessage("Challenge list refreshed from Firestore.");

    } catch (error) {
      console.error('[Challenge Cache] Error fetching challenges from Firestore:', error);
      setErrorMessage('Failed to fetch challenge list from Firestore. Previous cache (if any) might be used.');
    } finally {
      if (!fromRefreshButton) setIsLoadingAllChallenges(false);
      else setIsRefreshingChallenges(false);
    }
  }, []);

  useEffect(() => {
    console.log('[Challenge Cache] Component did mount. Checking localStorage for cached challenges...');
    const cachedChallengesJSON = localStorage.getItem(CHALLENGE_CACHE_KEY);
    if (cachedChallengesJSON) {
      try {
        const cachedData = JSON.parse(cachedChallengesJSON);
        const instantiatedChallenges = cachedData.map((data: any) => new SweatlistCollection(data));
        setAllChallenges(instantiatedChallenges);
        setIsLoadingAllChallenges(false);
        console.log('[Challenge Cache] Loaded challenges from localStorage:', instantiatedChallenges);
      } catch (e) {
        console.error("[Challenge Cache] Error parsing challenges from localStorage, fetching from Firestore.", e);
        localStorage.removeItem(CHALLENGE_CACHE_KEY);
        fetchAndCacheChallenges();
      }
    } else {
      console.log('[Challenge Cache] No challenges found in localStorage. Fetching from Firestore...');
      fetchAndCacheChallenges();
    }
  }, [fetchAndCacheChallenges]);

  // Challenge search logic
  const handleChallengeSearchLogic = React.useCallback((searchQuery: string) => {
    console.log(`[Challenge Search Logic] Query: "${searchQuery}"`);
    if (!searchQuery.trim()) {
      setChallengeSearchResults([]);
      return;
    }
    if (isLoadingAllChallenges && allChallenges.length === 0) {
      console.log(`[Challenge Search Logic] Initial challenge list still loading.`);
      setChallengeSearchResults([]);
      return;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredChallenges = allChallenges.filter(collection =>
      (collection.id.toLowerCase().includes(lowerCaseQuery)) ||
      (collection.challenge?.title?.toLowerCase().includes(lowerCaseQuery)) ||
      (collection.challenge?.status?.toLowerCase().includes(lowerCaseQuery))
    ).slice(0, 10);
    console.log(`[Challenge Search Logic] Filtered results:`, filteredChallenges.map(c => c.challenge?.title || c.id));
    setChallengeSearchResults(filteredChallenges);
  }, [allChallenges, isLoadingAllChallenges]);

  const handleChallengeQueryChange = React.useCallback((newQuery: string) => {
    setChallengeSearchQuery(newQuery);
    console.log(`[Typing - Challenge] Query changed to: "${newQuery}"`);
    handleChallengeSearchLogic(newQuery);
  }, [handleChallengeSearchLogic]);

  // Function to copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccessMessage('Reflection text copied to clipboard!');
      // Clear the message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to copy text:', error);
      setErrorMessage('Failed to copy text to clipboard');
      setTimeout(() => {
        setErrorMessage(null);
      }, 3000);
    }
  };

  // Function to delete a daily reflection
  const deleteReflection = async (reflectionId: string) => {
    if (!reflectionId) return;
    
    setDeleteLoading(reflectionId);
    setDeleteResult(null);
    
    try {
      console.log(`[Delete Reflection] Attempting to delete reflection: ${reflectionId}`);
      
      // Delete the reflection using admin methods
      const success = await adminMethods.deleteDailyPrompt(reflectionId);
      
      if (success) {
        console.log(`[Delete Reflection] Successfully deleted reflection: ${reflectionId}`);
        
        setDeleteResult({
          success: true,
          message: `Reflection ${reflectionId.substring(0, 8)}... deleted successfully`
        });
        
        // Refresh the reflections list
        await fetchExistingPrompts();
        
        // Clear delete result message after 5 seconds
        setTimeout(() => {
          setDeleteResult(null);
        }, 5000);
      } else {
        setDeleteResult({
          success: false,
          message: `Failed to delete reflection: Unknown error`
        });
        
        setTimeout(() => {
          setDeleteResult(null);
        }, 5000);
      }
      
    } catch (error) {
      console.error(`[Delete Reflection] Error deleting reflection ${reflectionId}:`, error);
      setDeleteResult({
        success: false,
        message: `Failed to delete reflection: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      // Clear delete result message after 5 seconds
      setTimeout(() => {
        setDeleteResult(null);
      }, 5000);
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Daily Reflection | Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-[#d7ff00] flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 mr-2">
                <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
              </svg>
              Daily Reflection
            </h1>
            
            <button
              onClick={() => fetchAndCacheChallenges(true)}
              disabled={isLoadingAllChallenges || isRefreshingChallenges}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-[#262a30] text-[#d7ff00] hover:bg-[#31363c] border border-gray-700 transition disabled:opacity-70"
            >
              {isRefreshingChallenges ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw size={16} className="mr-2"/>}
              {isRefreshingChallenges ? 'Refreshing Challenges...' : 'Refresh Challenge List'}
            </button>
          </div>

          {(isLoadingAllChallenges && allChallenges.length === 0) && (
            <div className="my-4 p-3 bg-purple-900/30 text-purple-400 border border-purple-700 rounded-lg flex items-center animate-fadeIn">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading initial challenge list from cache/Firestore...
            </div>
          )}

          {/* Create Prompt Form */}
          <div className="bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-white">Create New Reflection</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Date Picker */}
              <div>
                <label htmlFor="date" className="block text-gray-300 mb-2 text-sm font-medium">Date</label>
                <div className="relative">
                  <input
                    id="date"
                    name="date"
                    type="date"
                    value={formatDateForInput(formData.date)}
                    onChange={handleDateChange}
                    className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                    required
                  />
                  <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                </div>
              </div>
              
              {/* Prompt Text */}
              <div>
                <label htmlFor="text" className="block text-gray-300 mb-2 text-sm font-medium">Reflection Text</label>
                <textarea
                  id="text"
                  name="text"
                  value={formData.text}
                  onChange={handleInputChange}
                  placeholder="Enter the reflection prompt..."
                  rows={4}
                  className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                  required
                />
              </div>
              
              {/* Exercise Search */}
              <div>
                <label htmlFor="exerciseSearch" className="block text-gray-300 mb-2 text-sm font-medium">
                  Link to Exercise (Optional)
                </label>
                <div className="relative">
                  {selectedExercise ? (
                    <div className="flex items-center w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 text-white">
                      <span className="flex-1">{selectedExercise.name}</span>
                      <button 
                        type="button" 
                        onClick={clearSelectedExercise} 
                        className="text-gray-400 hover:text-white"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center w-full bg-[#262a30] border border-gray-700 rounded-lg overflow-hidden">
                        <input
                          id="exerciseSearch"
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search for an exercise..."
                          className="flex-1 bg-transparent px-4 py-3 focus:outline-none text-white placeholder-gray-500"
                        />
                        <button
                          type="button"
                          onClick={handleExerciseSearch}
                          className="px-4 py-3 text-gray-400 hover:text-white"
                        >
                          {isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : <Search size={18} />}
                        </button>
                      </div>
                      
                      {/* Search Results Dropdown */}
                      {searchResults.length > 0 && (
                        <div 
                          ref={searchResultsRef} 
                          className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-[#262a30] border border-gray-700 rounded-lg shadow-lg"
                        >
                          {searchResults.map((exercise) => (
                            <div
                              key={exercise.id}
                              onClick={() => selectExercise(exercise)}
                              className="p-3 hover:bg-[#31363c] cursor-pointer border-b border-gray-700 last:border-b-0"
                            >
                              <div className="text-white font-medium">{exercise.name}</div>
                              <div className="text-gray-400 text-xs">
                                {exercise.primaryBodyParts?.join(', ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Optionally link this reflection to a specific exercise
                </p>
              </div>
              
              {/* Challenge Search */}
              <div>
                <label htmlFor="challengeSearch" className="block text-gray-300 mb-2 text-sm font-medium">
                  Link to Challenge/Round (Optional)
                </label>
                <div className="relative">
                  {selectedChallenge ? (
                    <div className="flex items-center w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 text-white">
                      <ListChecks size={18} className="mr-2 text-[#d7ff00]" />
                      <span className="flex-1">{selectedChallenge.challenge?.title || selectedChallenge.id}</span>
                      <span className="text-xs text-gray-400 ml-2">({selectedChallenge.challenge?.status || 'N/A'})</span>
                      <button 
                        type="button" 
                        onClick={clearSelectedChallenge} 
                        className="ml-2 text-gray-400 hover:text-white"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center w-full bg-[#262a30] border border-gray-700 rounded-lg overflow-hidden">
                        <input
                          id="challengeSearch"
                          ref={challengeInputRef}
                          type="text"
                          value={challengeSearchQuery}
                          onChange={(e) => handleChallengeQueryChange(e.target.value)}
                          placeholder="Search for a challenge/round..."
                          className="flex-1 bg-transparent px-4 py-3 focus:outline-none text-white placeholder-gray-500"
                          disabled={isLoadingAllChallenges && allChallenges.length === 0}
                        />
                        <div className="px-4 py-3 text-gray-400">
                          {(isLoadingAllChallenges && allChallenges.length === 0) ? (
                            <Loader2 className="animate-spin h-5 w-5" />
                          ) : (
                            <Search size={18} />
                          )}
                        </div>
                      </div>
                      
                      {/* Challenge Search Results Dropdown */}
                      {challengeSearchResults.length > 0 && (
                        <div 
                          ref={challengeResultsRef} 
                          className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-[#262a30] border border-gray-700 rounded-lg shadow-lg"
                        >
                          {challengeSearchResults.map((challenge) => (
                            <div
                              key={challenge.id}
                              onClick={() => selectChallenge(challenge)}
                              className="p-3 hover:bg-[#31363c] cursor-pointer border-b border-gray-700 last:border-b-0"
                            >
                              <div className="text-white font-medium">{challenge.challenge?.title || challenge.id}</div>
                              <div className="text-gray-400 text-xs">
                                ID: {challenge.id} | Status: {challenge.challenge?.status || 'N/A'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {(challengeSearchQuery && challengeSearchResults.length === 0 && !(isLoadingAllChallenges && allChallenges.length === 0)) && (
                        <div className="absolute z-10 w-full mt-1 bg-[#262a30] border border-gray-700 rounded-lg shadow-lg p-3 text-gray-400 text-sm">
                          No challenges found matching "{challengeSearchQuery}".
                        </div>
                      )}
                    </>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Optionally link this reflection to a specific challenge or round
                </p>
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !formData.text.trim()}
                className="w-full flex justify-center items-center px-4 py-3 rounded-lg font-medium bg-[#d7ff00] text-black hover:bg-[#b8cc00] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
                Create Reflection
              </button>
              
              {/* Success/Error Messages */}
              {successMessage && (
                <div className="p-3 bg-green-900/30 text-green-400 border border-green-700 rounded-lg flex items-center animate-fadeIn">
                  <CheckCircle size={20} className="mr-2" />
                  {successMessage}
                </div>
              )}
              {errorMessage && (
                <div className="p-3 bg-red-900/30 text-red-400 border border-red-700 rounded-lg flex items-center animate-fadeIn">
                  <AlertTriangle size={20} className="mr-2" />
                  {errorMessage}
                </div>
              )}
            </form>
          </div>

          {/* Existing Prompts */}
          <div className="bg-[#1a1e24] rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-white">Recent Reflections</h2>
            
            {isLoadingPrompts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-[#d7ff00]" />
              </div>
            ) : existingPrompts.length > 0 ? (
              <div className="space-y-6">
                {/* Group reflections by date */}
                {(() => {
                  // Group prompts by dateId
                  const groupedByDate = existingPrompts.reduce((acc, prompt) => {
                    const dateKey = (prompt as any).dateId || formatDate(prompt.date);
                    if (!acc[dateKey]) {
                      acc[dateKey] = [];
                    }
                    acc[dateKey].push(prompt);
                    return acc;
                  }, {} as Record<string, DailyPrompt[]>);

                  // Sort dates in descending order
                  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
                    // Convert MM-DD-YYYY to Date for proper sorting
                    const dateA = new Date(a.split('-').reverse().join('-'));
                    const dateB = new Date(b.split('-').reverse().join('-'));
                    return dateB.getTime() - dateA.getTime();
                  });

                  return sortedDates.map(dateKey => {
                    const datePrompts = groupedByDate[dateKey];
                    const displayDate = datePrompts[0]?.date ? formatDate(datePrompts[0].date) : dateKey;
                    
                    // Separate general and challenge-specific reflections
                    const generalReflections = datePrompts.filter(p => !(p as any).challengeId);
                    const challengeReflections = datePrompts.filter(p => (p as any).challengeId);

                    return (
                      <div key={dateKey} className="border border-gray-700 rounded-lg overflow-hidden">
                        {/* Date Header */}
                        <div className="bg-[#262a30] px-4 py-3 border-b border-gray-700">
                          <h3 className="text-lg font-semibold text-[#d7ff00] flex items-center">
                            <CalendarIcon size={20} className="mr-2" />
                            {displayDate}
                            <span className="ml-2 text-sm text-gray-400">
                              ({generalReflections.length + challengeReflections.length} reflection{generalReflections.length + challengeReflections.length !== 1 ? 's' : ''})
                            </span>
                          </h3>
                        </div>

                        <div className="p-4 space-y-4">
                          {/* General Reflections */}
                          {generalReflections.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                                <ListChecks size={16} className="mr-1" />
                                General Reflection
                              </h4>
                              {generalReflections.map((prompt) => (
                                <div key={prompt.id} className="bg-[#1f2327] rounded-lg p-4 border border-gray-700">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-start space-x-2 mb-2">
                                        <div className="flex-1 text-white leading-relaxed">
                                          {prompt.text}
                                        </div>
                                        <button
                                          onClick={() => copyToClipboard(prompt.text)}
                                          className="flex-shrink-0 p-1 text-gray-400 hover:text-[#d7ff00] transition-colors"
                                          title="Copy reflection text"
                                        >
                                          <Copy size={16} />
                                        </button>
                                      </div>
                                      {prompt.exerciseName && (
                                        <div className="text-sm text-gray-400">
                                          <span className="font-medium">Linked Exercise:</span> {prompt.exerciseName}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (prompt.id && window.confirm(`Are you sure you want to delete this general reflection from ${displayDate}?`)) {
                                          deleteReflection(prompt.id);
                                        }
                                      }}
                                      disabled={deleteLoading === prompt.id}
                                      className="ml-3 flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 transition text-white"
                                      title="Delete reflection"
                                    >
                                      {deleteLoading === prompt.id ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <Trash2 size={14} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Challenge-Specific Reflections */}
                          {challengeReflections.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                                <Users size={16} className="mr-1" />
                                Challenge-Specific Reflections ({challengeReflections.length})
                              </h4>
                              <div className="space-y-3">
                                {challengeReflections.map((prompt) => (
                                  <div key={prompt.id} className="bg-[#1f2327] rounded-lg p-4 border border-gray-700">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center mb-2">
                                          <div className="bg-[#d7ff00] text-black px-2 py-1 rounded text-xs font-medium mr-2">
                                            {(prompt as any).challengeName || (prompt as any).challengeId}
                                          </div>
                                          {(prompt as any).challengeId && (
                                            <div className="text-xs text-gray-500 font-mono">
                                              {(prompt as any).challengeId}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-start space-x-2 mb-2">
                                          <div className="flex-1 text-white leading-relaxed">
                                            {prompt.text}
                                          </div>
                                          <button
                                            onClick={() => copyToClipboard(prompt.text)}
                                            className="flex-shrink-0 p-1 text-gray-400 hover:text-[#d7ff00] transition-colors"
                                            title="Copy reflection text"
                                          >
                                            <Copy size={16} />
                                          </button>
                                        </div>
                                        {prompt.exerciseName && (
                                          <div className="text-sm text-gray-400">
                                            <span className="font-medium">Linked Exercise:</span> {prompt.exerciseName}
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (prompt.id && window.confirm(`Are you sure you want to delete this challenge reflection from ${displayDate}?`)) {
                                            deleteReflection(prompt.id);
                                          }
                                        }}
                                        disabled={deleteLoading === prompt.id}
                                        className="ml-3 flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 transition text-white"
                                        title="Delete reflection"
                                      >
                                        {deleteLoading === prompt.id ? (
                                          <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                          <Trash2 size={14} />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No reflections found. Create your first reflection above.
              </div>
            )}
            
            {/* Delete result message */}
            {deleteResult && (
              <div className={`mt-4 p-3 border rounded-lg flex items-center animate-fadeIn ${
                deleteResult.success 
                  ? 'bg-green-900/30 text-green-400 border-green-700' 
                  : 'bg-red-900/30 text-red-400 border-red-700'
              }`}>
                {deleteResult.success ? (
                  <CheckCircle size={20} className="mr-2" />
                ) : (
                  <AlertTriangle size={20} className="mr-2" />
                )}
                {deleteResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AdminRouteGuard>
  );
};

export default DailyReflectionPage; 