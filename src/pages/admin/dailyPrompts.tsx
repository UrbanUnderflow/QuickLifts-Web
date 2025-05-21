import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { adminMethods } from '../../api/firebase/admin/methods';
import { DailyPrompt } from '../../api/firebase/admin/types';
import { Timestamp } from 'firebase/firestore';
import { exerciseService, Exercise } from '../../api/firebase/exercise';
import { formatDate } from '../../utils/formatDate';
import { Loader2, CalendarIcon, Search, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const DailyReflectionPage: React.FC = () => {
  const [formData, setFormData] = useState<{
    date: Date;
    text: string;
    exerciseId?: string;
    exerciseName?: string;
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
    setFormData(prev => ({
      ...prev,
      exerciseId: undefined,
      exerciseName: undefined
    }));
    setSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    
    try {
      const promptData: DailyPrompt = {
        date: formData.date,
        text: formData.text.trim(),
        exerciseId: formData.exerciseId,
        exerciseName: formData.exerciseName,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const success = await adminMethods.createDailyPrompt(promptData);
      
      if (success) {
        setSuccessMessage(`Daily reflection created for ${formatDate(formData.date)}`);
        setFormData({
          date: new Date(new Date().setHours(0, 0, 0, 0)),
          text: '',
        });
        setSelectedExercise(null);
        setSearchQuery('');
        fetchExistingPrompts(); // Refresh the list
      } else {
        setErrorMessage('Failed to create daily reflection.');
      }
    } catch (error) {
      console.error('Error creating prompt:', error);
      setErrorMessage('An error occurred while creating the reflection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Daily Reflection | Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 text-[#d7ff00] flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 mr-2">
              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
              <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
            </svg>
            Daily Reflection
          </h1>

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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-700">
                      <th className="pb-3 font-medium text-gray-300">Date</th>
                      <th className="pb-3 font-medium text-gray-300">Reflection</th>
                      <th className="pb-3 font-medium text-gray-300">Linked Exercise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingPrompts.map((prompt) => (
                      <tr key={prompt.id} className="border-b border-gray-800 hover:bg-[#262a30]">
                        <td className="py-4 pr-4 whitespace-nowrap">
                          {formatDate(prompt.date)}
                        </td>
                        <td className="py-4 pr-4">
                          <div className="line-clamp-2">{prompt.text}</div>
                        </td>
                        <td className="py-4">
                          {prompt.exerciseName || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No reflections found. Create your first reflection above.
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