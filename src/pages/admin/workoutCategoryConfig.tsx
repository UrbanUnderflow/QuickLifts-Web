// src/pages/admin/workoutCategoryConfig.tsx

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { ArrowLeft, Save, Loader2, RefreshCw, Dumbbell, Activity, Check, AlertCircle } from 'lucide-react';
import {
  fetchWorkoutCategoryMapping,
  updateWorkoutCategoryMapping,
  getDefaultMapping,
  clearCache,
  WorkoutCategoryMappingConfig,
  ExerciseCategoryIdentifier,
  ALL_EXERCISE_CATEGORIES,
  WORKOUT_TYPE_INFO,
  EXERCISE_CATEGORY_INFO,
  WorkoutType
} from '../../api/firebase/workoutCategoryMapping';

// Workout types that support generation
const CONFIGURABLE_WORKOUT_TYPES: WorkoutType[] = ['lift', 'stretch'];

const WorkoutCategoryConfigPage: React.FC = () => {
  const router = useRouter();
  
  // State
  const [config, setConfig] = useState<WorkoutCategoryMappingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Fetch config on mount
  useEffect(() => {
    loadConfig();
  }, []);
  
  const loadConfig = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const mapping = await fetchWorkoutCategoryMapping();
      setConfig(mapping);
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading config:', error);
      setErrorMessage('Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = () => {
    clearCache();
    loadConfig();
  };
  
  const handleCategoryToggle = (workoutType: WorkoutType, category: ExerciseCategoryIdentifier) => {
    if (!config) return;
    
    const currentCategories = config[workoutType] || [];
    let newCategories: ExerciseCategoryIdentifier[];
    
    if (currentCategories.includes(category)) {
      // Remove category (but ensure at least one remains)
      newCategories = currentCategories.filter(c => c !== category);
      if (newCategories.length === 0) {
        setErrorMessage(`${WORKOUT_TYPE_INFO[workoutType].displayName} must have at least one category selected`);
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }
    } else {
      // Add category
      newCategories = [...currentCategories, category];
    }
    
    setConfig({
      ...config,
      [workoutType]: newCategories
    });
    setHasChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };
  
  const handleSave = async () => {
    if (!config) return;
    
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      const success = await updateWorkoutCategoryMapping(config);
      
      if (success) {
        setSuccessMessage('Configuration saved successfully!');
        setHasChanges(false);
        // Refresh to get the updated version/timestamp
        await loadConfig();
      } else {
        setErrorMessage('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setErrorMessage('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleResetToDefaults = () => {
    const defaults = getDefaultMapping();
    setConfig(defaults);
    setHasChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };
  
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <AdminRouteGuard>
      <Head>
        <title>Workout Category Config | Pulse Admin</title>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center text-gray-400 hover:text-white transition mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center">
                  <span className="text-[#d7ff00] mr-3">
                    <Dumbbell className="w-7 h-7" />
                  </span>
                  Workout Category Configuration
                </h1>
                <p className="text-gray-400 mt-2">
                  Configure which exercise categories are used for each workout type during generation
                </p>
              </div>
              
              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg bg-[#262a30] hover:bg-[#363a40] transition"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Messages */}
          {successMessage && (
            <div className="mb-6 p-4 rounded-lg bg-green-900/30 border border-green-700 flex items-center">
              <Check className="w-5 h-5 text-green-400 mr-3" />
              <span className="text-green-300">{successMessage}</span>
            </div>
          )}
          
          {errorMessage && (
            <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-700 flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
              <span className="text-red-300">{errorMessage}</span>
            </div>
          )}
          
          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#d7ff00]" />
              <span className="ml-3 text-gray-400">Loading configuration...</span>
            </div>
          ) : config ? (
            <>
              {/* Configuration Cards */}
              <div className="space-y-6">
                {CONFIGURABLE_WORKOUT_TYPES.map((workoutType) => {
                  const typeInfo = WORKOUT_TYPE_INFO[workoutType];
                  const selectedCategories = config[workoutType] || [];
                  
                  return (
                    <div
                      key={workoutType}
                      className="relative bg-[#1a1e24] rounded-xl p-6 shadow-xl overflow-hidden"
                    >
                      {/* Colored top border */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-[3px]"
                        style={{ backgroundColor: typeInfo.color }}
                      />
                      
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center mr-3"
                            style={{ backgroundColor: `${typeInfo.color}20` }}
                          >
                            {workoutType === 'lift' ? (
                              <Dumbbell className="w-5 h-5" style={{ color: typeInfo.color }} />
                            ) : (
                              <Activity className="w-5 h-5" style={{ color: typeInfo.color }} />
                            )}
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold">{typeInfo.displayName}</h2>
                            <p className="text-sm text-gray-400">
                              {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected
                            </p>
                          </div>
                        </div>
                        
                        <div 
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: `${typeInfo.color}20`,
                            color: typeInfo.color 
                          }}
                        >
                          Generation Enabled
                        </div>
                      </div>
                      
                      {/* Category Checkboxes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ALL_EXERCISE_CATEGORIES.map((category) => {
                          const categoryInfo = EXERCISE_CATEGORY_INFO[category];
                          const isSelected = selectedCategories.includes(category);
                          
                          return (
                            <label
                              key={category}
                              className={`flex items-center p-4 rounded-lg cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-[#262a30] border-2 border-[#d7ff00]/50' 
                                  : 'bg-[#262a30]/50 border-2 border-transparent hover:bg-[#262a30]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleCategoryToggle(workoutType, category)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 transition-all ${
                                isSelected 
                                  ? 'bg-[#d7ff00] border-[#d7ff00]' 
                                  : 'border-gray-500'
                              }`}>
                                {isSelected && (
                                  <Check className="w-3 h-3 text-black" />
                                )}
                              </div>
                              <div>
                                <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                  {categoryInfo.displayName}
                                </span>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {category}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Metadata & Actions */}
              <div className="mt-8 p-6 bg-[#1a1e24] rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    <p>Version: {config.version || 1}</p>
                    <p>Last Updated: {formatTimestamp(config.updatedAt)}</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleResetToDefaults}
                      className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-[#262a30] transition"
                    >
                      Reset to Defaults
                    </button>
                    
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !hasChanges}
                      className={`px-6 py-2 rounded-lg font-semibold flex items-center transition ${
                        hasChanges 
                          ? 'bg-[#d7ff00] text-black hover:bg-lime-400' 
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Configuration
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {hasChanges && (
                  <p className="mt-3 text-sm text-amber-400 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    You have unsaved changes
                  </p>
                )}
              </div>
              
              {/* Info Section */}
              <div className="mt-8 p-6 bg-[#1a1e24] rounded-xl">
                <h3 className="text-lg font-semibold mb-4">How This Works</h3>
                <div className="space-y-3 text-sm text-gray-400">
                  <p>
                    <strong className="text-white">Lift workouts:</strong> When a user generates a lift workout, 
                    only exercises from the selected categories will be available for the AI to choose from.
                  </p>
                  <p>
                    <strong className="text-white">Stretch workouts:</strong> Similarly, stretch workout generation 
                    will only use exercises from the categories selected for stretch.
                  </p>
                  <p>
                    <strong className="text-white">Run & Fat Burn:</strong> These workout types are self-driven 
                    and do not use exercise generation.
                  </p>
                  <p className="text-gray-500 pt-2 border-t border-gray-700">
                    Changes here affect both the iOS app and web API. The iOS app fetches this configuration 
                    at launch, while the web API fetches it on each generation request.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p>Failed to load configuration. Please try refreshing.</p>
            </div>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default WorkoutCategoryConfigPage;
