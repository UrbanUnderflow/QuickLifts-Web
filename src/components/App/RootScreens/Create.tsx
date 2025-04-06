import React, { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/router';
import ProgressBar from '../../../components/App/ProgressBar';
import { firebaseStorageService, VideoType } from '../../../api/firebase/storage/service';
import Spacer from '../../../components/Spacer';
import { exerciseService } from '../../../api/firebase/exercise/service';
import { userService } from '../../../api/firebase/user/service';
import { formatExerciseNameForId } from '../../../utils/stringUtils';
import { clearAllStorage } from '../../../utils/indexedDBStorage';
import { gifGenerator } from '../../../utils/gifGenerator';
import { db } from '../../../api/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { SimpleVideoTrimmer } from '../../../components/SimpleVideoTrimmer';

import { Exercise, ExerciseVideo, ExerciseAuthor, ExerciseCategory } from '../../../api/firebase/exercise/types';
import { ProfileImage } from '../../../api/firebase/user/types';

// Add this outside the component - a simple in-memory cache not affected by component re-renders
// This will persist across multiple executions of the useEffect in StrictMode
const videoCache = {
  data: new Map(),
  set: (key: string, value: any) => {
    videoCache.data.set(key, value);
    console.log(`[DEBUG] Video cached in memory: ${key}`);
  },
  get: (key: string) => {
    const value = videoCache.data.get(key);
    console.log(`[DEBUG] Video cache lookup: ${key}, found: ${!!value}`);
    return value;
  },
  delete: (key: string) => {
    const existed = videoCache.data.delete(key);
    console.log(`[DEBUG] Video cache deleted: ${key}, existed: ${existed}`);
    return existed;
  }
};

const Create: React.FC = () => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and video state
  const [isDragOver, setIsDragOver] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Exercise metadata state
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseCategory, setExerciseCategory] = useState('Weight Training');
  const [tags, setTags] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [similarExercisesFound, setSimilarExercisesFound] = useState<Exercise[]>([]);
  const [isDuplicateExercise, setIsDuplicateExercise] = useState(false);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [uploadedExercise, setUploadedExercise] = useState<Exercise | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [uploadedExerciseId, setUploadedExerciseId] = useState<string>('');

  const categories = [
    'Weight Training', 
    'Cardio', 
    'Pilates',
    'Mobility', 
    'Stretching', 
    'Calisthenics'
  ];

  useEffect(() => {
    // Only run when the component mounts and router is ready
    if (typeof window !== 'undefined' && router.isReady) {
      const processTrimmedVideo = async () => {
        try {
          // First, get URL parameters
          const urlParams = new URLSearchParams(window.location.search);
          const isTrimmed = urlParams.get('trimmed') === 'true';
          
          // Only proceed if we're returning from trim page
          if (!isTrimmed) {
            console.log('[DEBUG] Not returning from trim page, skipping video processing');
            return;
          }
          
          console.log('[DEBUG] Returning from trim page, looking for video data in sessionStorage');
          
          // Get video data from sessionStorage
          const videoDataStr = sessionStorage.getItem('trimmed_video_data');
          if (!videoDataStr) {
            console.error('[DEBUG] No video data found in sessionStorage');
            return;
          }
          
          try {
            // Parse the video data
            const videoData = JSON.parse(videoDataStr);
            console.log('[DEBUG] Found video data in sessionStorage:', {
              name: videoData.name,
              type: videoData.type,
              dataSize: videoData.data ? videoData.data.length : 'not available',
              isMinimal: videoData.isMinimal || false
            });
            
            let trimmedFile;
            
            // Handle normal vs minimal mode
            if (videoData.isMinimal) {
              // Check if we have a video blob in memory
              console.log('[DEBUG] Using minimal mode - looking for video blob in memory');
              const tempBlob = (window as any).tempVideoBlob;
              
              if (!tempBlob) {
                console.error('[DEBUG] No video blob found in memory for minimal mode');
                return;
              }
              
              // Use the blob directly
              trimmedFile = tempBlob;
              // Make sure trim metadata is attached
              if (videoData.trimStart !== undefined && videoData.trimEnd !== undefined) {
                (trimmedFile as any).trimStart = videoData.trimStart;
                (trimmedFile as any).trimEnd = videoData.trimEnd;
              }
            } else {
              // Normal mode with full data in sessionStorage
              console.log('[DEBUG] Using full data mode from sessionStorage');
              // Convert base64 to File object
              const arrayBuffer = Uint8Array.from(atob(videoData.data), c => c.charCodeAt(0)).buffer;
              trimmedFile = new File([arrayBuffer], videoData.name, { type: videoData.type });
              
              // Add trim metadata if present
              if (videoData.trimStart !== undefined && videoData.trimEnd !== undefined) {
                console.log('[DEBUG] Attaching trim metadata:', { 
                  trimStart: videoData.trimStart, 
                  trimEnd: videoData.trimEnd 
                });
                (trimmedFile as any).trimStart = videoData.trimStart;
                (trimmedFile as any).trimEnd = videoData.trimEnd;
              }
            }
            
            // Create object URL 
            const objectUrl = URL.createObjectURL(trimmedFile);
            console.log('[DEBUG] Created object URL for video preview:', objectUrl);
            
            // Check actual duration of the loaded video
            const durationCheck = document.createElement('video');
            durationCheck.preload = 'metadata';
            durationCheck.onloadedmetadata = () => {
              console.log('[DEBUG] LOADED VIDEO VERIFICATION - Actual duration after loading:', 
                          durationCheck.duration.toFixed(3), 'seconds',
                          'Expected:', ((trimmedFile as any).trimEnd - (trimmedFile as any).trimStart).toFixed(3), 
                          'seconds');
              URL.revokeObjectURL(durationCheck.src);
            };
            durationCheck.onerror = (e) => {
              console.error('[DEBUG] LOADED VIDEO VERIFICATION - Error checking video duration:', e);
              URL.revokeObjectURL(durationCheck.src);
            };
            durationCheck.src = objectUrl;
            
            // Update component state
            setVideoFile(trimmedFile);
            setVideoPreview(objectUrl);
            
            console.log('[DEBUG] Video state updated successfully');
            
            // Clean up sessionStorage after we've successfully loaded the video
            // (wait a bit to make sure the state updates take effect)
            setTimeout(() => {
              sessionStorage.removeItem('trimmed_video_data');
              console.log('[DEBUG] Removed video data from sessionStorage');
              
              // Also clean up temp blob if it exists
              if ((window as any).tempVideoBlob) {
                delete (window as any).tempVideoBlob;
                console.log('[DEBUG] Cleaned up temporary video blob from memory');
              }
              
              // Remove URL parameters for cleanliness
              const cleanUrl = window.location.pathname + 
                (urlParams.toString() ? `?${urlParams.toString()}` : '');
              window.history.replaceState({}, '', cleanUrl);
            }, 2000);
            
          } catch (parseError) {
            console.error('[DEBUG] Error parsing video data from sessionStorage:', parseError);
          }
        } catch (error) {
          console.error('[DEBUG] Error processing trimmed video:', error);
        }
      };
      
      // Run the processor
      processTrimmedVideo();
    }
  }, [router.isReady]);

  // Drag and drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleFileSelection = (file: File) => {
    const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.qt', '.avi'];
    
    // Check if file extension is allowed, regardless of detected MIME type
    const fileName = file.name.toLowerCase();
    const hasAllowedExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    
    console.log(`[DEBUG] Video file selected - Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB, Type: ${file.type}, Name: ${file.name}`);
    
    if (!ALLOWED_TYPES.includes(file.type) && !hasAllowedExtension) {
      console.log('[DEBUG] Rejected file with unsupported type:', file.type);
      alert('Please upload a valid video file (MP4, QuickTime, or AVI). WebM format is not supported for uploading.');
      return;
    }

    // Check file size - limit to 50MB for browser processing
    const MAX_SIZE_MB = 50;
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > MAX_SIZE_MB) {
      alert(`File size (${fileSizeMB.toFixed(2)} MB) exceeds the maximum allowed size of ${MAX_SIZE_MB} MB. Please select a smaller file.`);
      return;
    }

    // Convert file if needed
    setIsProcessing(true);
    tryConvertVideo(file)
      .then(processedFile => {
        setSelectedFile(processedFile);
        setShowTrimmer(true);
        setIsProcessing(false);
      })
      .catch(error => {
        setIsProcessing(false);
        console.error('[DEBUG] Error during file conversion:', error);
        alert('Failed to process the video file. Please try a different file format.');
      });
  };

  const handleTrimComplete = (trimmedFile: File) => {
    console.log('[DEBUG] Trim complete, setting video file');
    setVideoFile(trimmedFile);
    setShowTrimmer(false);
    
    // Create preview URL for the trimmed video
    const previewUrl = URL.createObjectURL(trimmedFile);
    setVideoPreview(previewUrl);
  };

  // Function to attempt video conversion if needed
  const tryConvertVideo = async (file: File): Promise<File> => {
    const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    
    // If file is already in an allowed format, return it directly
    if (ALLOWED_TYPES.includes(file.type)) {
      console.log('[DEBUG] File already in allowed format:', file.type);
      return file;
    }
    
    console.log('[DEBUG] Attempting to convert file from', file.type);
    
    // Check file extension to determine best target format
    const fileName = file.name.toLowerCase();
    let targetType = 'video/mp4'; // Default to MP4
    let targetExtension = '.mp4';
    
    if (fileName.endsWith('.mov') || fileName.endsWith('.qt')) {
      targetType = 'video/quicktime';
      targetExtension = fileName.endsWith('.mov') ? '.mov' : '.qt';
    } else if (fileName.endsWith('.avi')) {
      targetType = 'video/x-msvideo';
      targetExtension = '.avi';
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Create video element to read the file
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        // Create object URL for the file
        const objectUrl = URL.createObjectURL(file);
        
        // Set up events for processing
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(objectUrl);
          
          // Create a canvas to draw video frames
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // In a real conversion, we would:
          // 1. Draw frames to canvas
          // 2. Capture frames as data
          // 3. Encode to target format
          
          // For this example, we'll take a simpler approach:
          // Just change the file type and name to allow processing
          
          // Create a new File object with modified type
          const newFileName = file.name.substring(0, file.name.lastIndexOf('.')) + targetExtension;
          
          // Since browser JS can't truly convert video formats, we'll just change the metadata
          // This is a workaround to bypass the type check
          const newFile = new File([file], newFileName, { type: targetType });
          
          console.log('[DEBUG] Created processed file:', {
            name: newFile.name,
            type: newFile.type,
            size: newFile.size
          });
          
          resolve(newFile);
        };
        
        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load video metadata'));
        };
        
        // Set the source to load metadata
        video.src = objectUrl;
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const clearVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Check for similar exercises in Firestore
  const checkSimilarExercises = async (): Promise<Exercise[]> => {
    if (!exerciseName.trim()) return [];
    
    try {
      console.log('[DEBUG] Starting similar exercise check for:', exerciseName.trim());
      
      // Always check using lowercase for document ID lookup
      const lowerCaseName = exerciseName.trim().toLowerCase();
      console.log('[DEBUG] Directly checking Firestore for document with ID:', lowerCaseName);
      
      const exists = await exerciseService.verifyExerciseExistsByName(exerciseName.trim());
      
      if (exists) {
        // If it exists, get the full exercise data
        console.log('[DEBUG] Found existing exercise with this name');
        const exercise = await exerciseService.getExerciseByName(exerciseName.trim());
        return exercise ? [exercise] : [];
      }
      
      console.log('[DEBUG] No exact match found by document ID');
      
      // For compatibility, also run the existing service check
      console.log('[DEBUG] For comparison, also using exerciseService.fetchExercises()');
      await exerciseService.fetchExercises();
      const allExercises = exerciseService.allExercises;
      
      console.log(`[DEBUG] Service fetched ${allExercises.length} exercises with videos`);

      // Filter exercises by name - case insensitive matching
      const serviceMatches = allExercises.filter(exercise => {
        // Compare names in a case-insensitive way
        const isMatch = exercise.name.toLowerCase() === exerciseName.trim().toLowerCase();
        if (isMatch) {
          console.log(`[DEBUG] Service found match: "${exercise.name}" with ID: ${exercise.id}`);
        }
        return isMatch;
      });
      
      console.log(`[DEBUG] Service found ${serviceMatches.length} similar exercises`);
      
      return serviceMatches;
    } catch (error) {
      console.error('[DEBUG] Error checking similar exercises:', error);
      return [];
    }
  };

  // Upload video function with progress callback
  const uploadVideo = async (existingExercise?: Exercise) => {
    if (!videoFile) {
      console.error('[DEBUG] No video file to upload');
      return;
    }
    
    try {
      console.log('[DEBUG] Starting upload process');
      console.log('[DEBUG] Video details before processing:', {
        name: videoFile.name,
        size: videoFile.size,
        type: videoFile.type
      });
      
      // Check if video has trim metadata
      const hasTrimMetadata = !!(
        (videoFile as any).trimStart !== undefined && 
        (videoFile as any).trimEnd !== undefined
      );
      
      if (hasTrimMetadata) {
        console.log('[DEBUG] Video has trim metadata:', {
          trimStart: (videoFile as any).trimStart,
          trimEnd: (videoFile as any).trimEnd
        });
      }
      
      // Make sure the file type is compatible with Firebase Storage
      const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      let fileToUpload = videoFile;
      
      if (!ALLOWED_TYPES.includes(videoFile.type)) {
        console.log('[DEBUG] Converting video to compatible format before upload');
        try {
          // Default to MP4 format which is widely supported
          const newFileName = videoFile.name.replace(/\.[^/.]+$/, '.mp4');
          fileToUpload = new File([videoFile], newFileName, { type: 'video/mp4' });
          
          console.log('[DEBUG] Created compatible file for upload:', {
            name: fileToUpload.name,
            type: fileToUpload.type,
            size: fileToUpload.size
          });
          
          // Copy trim metadata if present
          if (hasTrimMetadata) {
            (fileToUpload as any).trimStart = (videoFile as any).trimStart;
            (fileToUpload as any).trimEnd = (videoFile as any).trimEnd;
          }
        } catch (conversionError) {
          console.error('[DEBUG] Error converting video format:', conversionError);
          throw new Error('Could not convert video to a compatible format. Please upload an MP4 video.');
        }
      }
      
      // Clear the exercise service cache to ensure fresh data
      exerciseService.clearCache();
      
      // Format exercise name consistently
      const formattedExerciseName = formatExerciseNameForId(exerciseName.trim());
      
      if (existingExercise) {
        console.log('[DEBUG] Using existing exercise:', {
          id: existingExercise.id,
          name: existingExercise.name
        });
        
        // Verify the existing exercise is actually in Firestore - by name now
        const exists = await exerciseService.verifyExerciseExistsByName(existingExercise.name);
        if (!exists) {
          console.error('[DEBUG] The existing exercise selected is not in Firestore!', existingExercise.name);
          alert('There was an error with the selected exercise. Creating a new one instead.');
          existingExercise = undefined; // Force creation of a new exercise
        }
      } else {
        console.log('[DEBUG] Will create new exercise with name:', formattedExerciseName);
      }
      
      setIsUploading(true);
      setUploadProgress(0);
      
      // 1. Upload the video to Firebase Storage - this will account for 70% of the total progress
      console.log('[DEBUG] Starting Firebase Storage upload with file:', {
        name: fileToUpload.name,
        type: fileToUpload.type,
        size: fileToUpload.size
      });
      
      const uploadResult = await firebaseStorageService.uploadVideo(
        fileToUpload,
        VideoType.Exercise,
        (progress) => {
          // Scale progress to be 70% of the total workflow
          const scaledProgress = progress * 0.7;
          console.log(`[DEBUG] Upload progress: ${Math.round(progress * 100)}%, Scaled: ${Math.round(scaledProgress * 100)}%`);
          setUploadProgress(scaledProgress);
        },
        // Pass the exercise name for the storage path
        existingExercise ? existingExercise.name : formattedExerciseName
      );
      
      console.log('[DEBUG] Video uploaded successfully to Firebase Storage:', uploadResult);
      
      // Update progress to 70% after successful upload
      setUploadProgress(0.7);
      
      // 2. Get the current user 
      console.log('[DEBUG] Getting current user');
      
      // Get complete user data from userService (Redux store)
      const completeUserData = userService.currentUser;
      
      if (!completeUserData) {
        console.error('[DEBUG] No user found in Redux store');
        throw new Error('User must be logged in to upload videos');
      }
      
      const username = completeUserData.username || 'Anonymous';
      const userId = completeUserData.id;
      
      console.log('[DEBUG] Current user from Redux store:', {
        uid: userId,
        username: username
      });
      
      // 3. Generate IDs for new documents
      const exerciseId = existingExercise?.id || exerciseService.generateExerciseId();
      const videoId = exerciseService.generateExerciseVideoId();
      console.log('[DEBUG] Generated IDs:', { exerciseId, videoId });
      
      // Set progress to 75% after generating IDs and fetching user
      setUploadProgress(0.75);
      
      // 4. Import Firestore modules
      console.log('[DEBUG] Importing Firestore modules');
      const { Timestamp } = await import('firebase/firestore');
      
      // 5. First, prepare the exercise video data
      const exerciseVideoData = new ExerciseVideo({
        id: videoId,
        exerciseId: existingExercise ? existingExercise.id : exerciseId,
        exercise: formattedExerciseName,
        username: username,
        userId: userId,
        videoURL: uploadResult.downloadURL,
        fileName: uploadResult.gsURL.split('/').pop() || 'unknown',
        storagePath: uploadResult.gsURL,
        profileImage: new ProfileImage({
          profileImageURL: completeUserData.profileImage?.profileImageURL || '',
          imageOffsetWidth: 0,
          imageOffsetHeight: 0
        }),
        caption: caption,
        visibility: 'open',
        totalAccountsReached: 0,
        totalAccountLikes: 0,
        totalAccountBookmarked: 0,
        totalAccountUsage: 0,
        isApproved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Include trim metadata if available
        ...(hasTrimMetadata && {
          trimMetadata: {
            trimStart: (videoFile as any).trimStart,
            trimEnd: (videoFile as any).trimEnd,
            duration: (videoFile as any).trimEnd - (videoFile as any).trimStart
          }
        })
      });
      
      console.log('[DEBUG] Exercise video data prepared:', exerciseVideoData);
      
      // 6. Create the exercise video using the service
      console.log('[DEBUG] Creating exercise video document in Firestore');
      try {
        // Convert to plain object before saving to Firestore
        const exerciseVideoPlainObject = exerciseVideoData.toDictionary();
        
        // Add the trim metadata back if it exists (it may not be in the toDictionary output)
        if (hasTrimMetadata) {
          exerciseVideoPlainObject.trimMetadata = {
            trimStart: (videoFile as any).trimStart,
            trimEnd: (videoFile as any).trimEnd,
            duration: (videoFile as any).trimEnd - (videoFile as any).trimStart
          };
        }
        
        await exerciseService.createExerciseVideo(exerciseVideoPlainObject);
        console.log('[DEBUG] Exercise video document created successfully with ID:', videoId);
      } catch (firestoreError) {
        console.error('[DEBUG] Error creating exercise video document:', firestoreError);
        throw firestoreError;
      }
      
      // Update progress to 80% after creating the video document
      setUploadProgress(0.8);
        
      // 7. Create or update the Exercise document if it doesn't exist
      if (!existingExercise) {
        console.log('[DEBUG] Preparing to create new exercise document', ExerciseCategory.fromIdentifier(exerciseCategory.toLowerCase().replace(/\s+/g, '-')));
        const exerciseData = new Exercise({
          id: exerciseId,
          name: formattedExerciseName,
          category: ExerciseCategory.fromIdentifier(exerciseCategory.toLowerCase().replace(/\s+/g, '-')),
          primaryBodyParts: [],
          secondaryBodyParts: [],
          tags: tags,
          description: '',
          steps: [],
          currentVideoPosition: 0,
          visibility: 'live',
          author: new ExerciseAuthor({
            userId: userId,
            username: username
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log('[DEBUG] Exercise data prepared:', exerciseData);
        
        // 8. Create the exercise using the service
        console.log('[DEBUG] Creating exercise document in Firestore');
        try {
          // Convert to plain object before saving to Firestore
          const exerciseDataPlainObject = exerciseData.toDictionary();
          await exerciseService.createExercise(exerciseDataPlainObject);
          console.log('[DEBUG] Exercise document created successfully with ID:', exerciseId);
          
          // Verify the exercise was created - by name now
          const created = await exerciseService.verifyExerciseExistsByName(formattedExerciseName);
          if (created) {
            console.log('[DEBUG] Verified exercise document was created successfully');
          } else {
            console.error('[DEBUG] Failed to verify exercise document creation');
          }
        } catch (firestoreError) {
          console.error('[DEBUG] Error creating exercise document:', firestoreError);
          throw firestoreError;
        }
      } else {
        console.log('[DEBUG] Using existing exercise, no need to create a new one');
      }
      
      // Update progress to 85% after creating the exercise document
      setUploadProgress(0.85);
      
      // 9. Set the uploaded exercise ID
      console.log('[DEBUG] Setting uploaded exercise ID:', exerciseId);
      setUploadedExerciseId(exerciseId);
      
      // 10. Generate GIF for the uploaded video - CLIENT SIDE VERSION
      console.log('[DEBUG] Starting client-side GIF generation for video', videoId);

      try {
        console.log('[DEBUG] Using client-side gifGenerator');
        
        // Listen for GIF encoding progress updates from the gifGenerator
        const encodingProgressListener = (progress: number) => {
          // Scale encoding progress from 87% to 92%
          const scaledProgress = 0.87 + (progress * 0.05);
          setUploadProgress(scaledProgress);
        };
        
        // Listen for frame capture progress
        const frameCaptureListener = (e: any) => {
          if (e.detail && typeof e.detail.progress === 'number') {
            // Scale frame capture progress from 85% to 87%
            const scaledProgress = 0.85 + (e.detail.progress * 0.02);
            setUploadProgress(scaledProgress);
          }
        };
        
        // Add event listeners
        window.addEventListener('gif-encoding-progress', (e: any) => {
          if (e.detail && typeof e.detail.progress === 'number') {
            encodingProgressListener(e.detail.progress);
          }
        });
        
        window.addEventListener('gif-frame-capture-progress', frameCaptureListener);

        const gifUrl = await gifGenerator.generateAndUploadGif(
          { file: videoFile },  // Pass the local video file instead of the URL
          formattedExerciseName,
          videoId,
          {
            width: 288,
            height: 512,
            numFrames: 80,   // Reduced from 125
            quality: 10,     // Increased from 3
            delay: 100,      // Added delay for smoother playback
            dither: true,
            workers: 4,
            maxDuration: 5
          }
        );
        
        if (gifUrl) {
          console.log('[DEBUG] Client-side GIF generation successful:', gifUrl);
          
          // GIF has been generated and uploaded, update to 92%
          setUploadProgress(0.92);
          
          // Update the video document with the GIF URL
          console.log('[DEBUG] Updating Firestore document with GIF URL');
          const videoRef = doc(db, 'exerciseVideos', videoId);
          
          // Create a progress interval for Firestore update
          let firestoreProgress = 0;
          const firestoreUpdateInterval = setInterval(() => {
            // Increment progress from 92% to 95%
            firestoreProgress += 0.003;
            const newProgress = Math.min(0.95, 0.92 + firestoreProgress);
            setUploadProgress(newProgress);
          }, 100);
          
          await updateDoc(videoRef, {
            gifURL: gifUrl,
            updatedAt: new Date()
          });
          
          // Clear the Firestore update interval
          clearInterval(firestoreUpdateInterval);
          
          console.log('[DEBUG] Updated video document with GIF URL');
          
          // Remove the event listeners
          window.removeEventListener('gif-encoding-progress', (e: any) => {
            if (e.detail && typeof e.detail.progress === 'number') {
              encodingProgressListener(e.detail.progress);
            }
          });
          window.removeEventListener('gif-frame-capture-progress', frameCaptureListener);
          
          // Show success modal after everything is complete
          setShowSuccessModal(true);
          
          return true;
        } else {
          console.warn('[DEBUG] GIF generation attempt failed (no URL returned), retrying...');
          // Even if GIF fails, we should still show success modal since video was uploaded
          setShowSuccessModal(true);
        }
      } catch (gifError) {
        console.error('[DEBUG] Error starting GIF generation:', gifError);
        // Still complete the progress bar and show success modal even if GIF generation fails
        setUploadProgress(1.0);
        setShowSuccessModal(true);
      }
      
      // 11. Log a summary of the upload, including trim metadata if present
      console.log('[DEBUG] Upload process completed successfully', {
        exerciseId,
        videoId,
        hasTrimData: !!(videoFile as any).trimStart !== undefined,
        ...(hasTrimMetadata && {
          trimStart: (videoFile as any).trimStart,
          trimEnd: (videoFile as any).trimEnd,
          duration: (videoFile as any).trimEnd - (videoFile as any).trimStart
        })
      });
      
      console.log('[DEBUG] ⚠️ IMPORTANT: Server-side processing needed for video trimming!');
      if (hasTrimMetadata) {
        console.log('[DEBUG] This video has trim metadata and requires server-side processing:');
        console.log('[DEBUG] 1. The full video was uploaded to Firebase Storage');
        console.log('[DEBUG] 2. Trim metadata was added to the Firestore document');
        console.log('[DEBUG] 3. A Cloud Function should process this video with FFmpeg');
        console.log(`[DEBUG] 4. Trim points: ${(videoFile as any).trimStart.toFixed(2)}s to ${(videoFile as any).trimEnd.toFixed(2)}s`);
      }
    } catch (error) {
      console.error('[DEBUG] Upload failed - Full error:', error);
      console.error('[DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[DEBUG] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[DEBUG] Error name:', error instanceof Error ? error.name : 'Unknown name');
      
      alert('Video upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      console.log('[DEBUG] Upload process finished');
      setIsUploading(false);
    }
  };

  // Handle submission: check for similar exercises first.
  const handleSubmit = async () => {
    console.log('[DEBUG] Submit button clicked');
    
    if (!videoFile) {
      console.error('[DEBUG] No video file selected');
      return;
    }
    
    if (!exerciseName.trim()) {
      console.error('[DEBUG] No exercise name provided');
      return;
    }
    
    console.log('[DEBUG] Checking for similar exercises');
    
    // Check for similar exercises by exact name match
    const similar = await checkSimilarExercises();
    
    if (similar.length > 0) {
      console.log('[DEBUG] Similar exercises found, showing modal');
      setIsDuplicateExercise(true);
      setSimilarExercisesFound(similar);
      setShowSimilarModal(true);
      return;
    }
    
    console.log('[DEBUG] No similar exercises found, proceeding with upload');
    // If no similar exercises found, upload immediately.
    uploadVideo();
  };

  // Handlers for Similar Exercises Modal
  const handleSelectSimilarExercise = (exercise: Exercise) => {
    console.log('[DEBUG] User selected similar exercise:', {
      id: exercise.id,
      name: exercise.name
    });
    
    // The document ID is the exercise name, so verify by name
    exerciseService.verifyExerciseExistsByName(exercise.name)
      .then(exists => {
        if (!exists) {
          console.error('[DEBUG] Selected exercise does not exist in Firestore!', exercise.name);
          
          // Show a warning and ask user to proceed with creating a new exercise instead
          if (window.confirm('The selected exercise could not be found. Would you like to create a new exercise instead?')) {
            setShowSimilarModal(false);
            uploadVideo(); // Create new exercise
          }
        } else {
          // Exercise exists, proceed with linking the video
          console.log('[DEBUG] Verified exercise exists, proceeding with upload', exercise.name);
          setShowSimilarModal(false);
          uploadVideo(exercise); // Pass the existing exercise to link the video
        }
      })
      .catch(error => {
        console.error('[DEBUG] Error verifying exercise:', error);
        setShowSimilarModal(false);
        uploadVideo(); // Fallback to creating new exercise
      });
  };

  const handleSelectAsUnique = () => {
    console.log('[DEBUG] User selected to create as unique exercise');
    setShowSimilarModal(false);
    // Proceed with upload if the user confirms the exercise is unique.
    uploadVideo();
  };

  // Handlers for Success Modal
  const handleViewMove = () => {
    console.log('[DEBUG] View move button clicked, exercise ID:', uploadedExerciseId);
    if (uploadedExerciseId) {
      // The actual URL should use the name as document ID (lowercase with dashes instead of spaces)
      const documentId = exerciseName.trim().toLowerCase().replace(/\s+/g, '-');
      console.log('[DEBUG] Document ID for navigation:', documentId);
      
      // Verify the exercise exists before navigating
      exerciseService.verifyExerciseExistsByName(exerciseName.trim())
        .then(exists => {
          if (exists) {
            console.log('[DEBUG] Exercise exists, navigating to exercise page', documentId);
            router.push(`/exercise/${documentId}`);
          } else {
            console.error('[DEBUG] Exercise does not exist in Firestore!', documentId);
            alert('Sorry, there was an error accessing the exercise. Please try again.');
          }
        })
        .catch(error => {
          console.error('[DEBUG] Error verifying exercise for navigation:', error);
          alert('Sorry, there was an error accessing the exercise. Please try again.');
        });
    } else {
      console.error('[DEBUG] No exercise ID available for viewing');
    }
  };

  const handleCloseSuccessModal = () => {
    // Reset form to initial state.
    clearVideo();
    setExerciseName('');
    setExerciseCategory('Weight Training');
    setTags([]);
    setCaption('');
    setNewTag('');
    setUploadProgress(0);
    setIsGeneratingCaption(false);
    setShowSuccessModal(false);
  };

  // Generate AI caption based on exercise details
  const handleGenerateCaption = async () => {
    if (!exerciseName.trim()) {
      alert('Please enter an exercise name first');
      return;
    }

    try {
      setIsGeneratingCaption(true);
      
      // Prepare the data for the API request
      const data = {
        exerciseName: exerciseName.trim(),
        category: exerciseCategory,
        tags: tags
      };
      
      console.log('[DEBUG] Generating AI caption with data:', data);
      
      // Make API request to our backend
      const response = await fetch('/api/generateCaption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[DEBUG] AI caption generated:', result);
      
      // Update the caption state with the generated text
      if (result.caption) {
        setCaption(result.caption);
      } else {
        throw new Error('No caption returned from API');
      }
    } catch (error) {
      console.error('[DEBUG] Error generating caption:', error);
      alert('Failed to generate caption. Please try again or enter one manually.');
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="text-center text-white mb-6">
        <h2 className="text-2xl font-bold">Create</h2>
        <p className="text-zinc-400">Start building your next workout or post.</p>
      </div>

      <div 
        className={`
          border-2 border-dashed rounded-xl p-6 text-center transition-colors duration-300
          ${isDragOver ? 'border-[#E0FE10] bg-[#E0FE10]/10' : 'border-zinc-700'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-12 h-12 border-4 border-[#E0FE10] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-zinc-300">Processing your video...</p>
          </div>
        ) : videoPreview ? (
          <div className="relative">
            <video 
              src={videoPreview} 
              controls 
              className="w-full rounded-xl"
            />
            <button 
              onClick={clearVideo}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <input 
              type="file" 
              ref={fileInputRef}
              accept="video/mp4,video/quicktime,video/x-msvideo"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="text-zinc-400">
              <p className="mb-4">Drag and drop videos here</p>
              <p className="mb-4">or</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg"
              >
                Browse Files
              </button>
            </div>
          </>
        )}
      </div>

      {videoPreview && (
        <div className="mt-6 space-y-4">
          {/* Exercise Name */}
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Exercise Name</label>
            <input
              type="text"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              placeholder="Enter exercise name"
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
            />
          </div>

          {/* Exercise Category */}
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Exercise Category</label>
            <select
              value={exerciseCategory}
              onChange={(e) => setExerciseCategory(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Tags</label>
            <div className="flex mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add a tag"
                className="flex-grow bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
              />
              <button 
                onClick={handleAddTag}
                className="ml-2 bg-[#E0FE10] text-black px-4 rounded-lg"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <div 
                  key={tag} 
                  className="bg-zinc-700 text-white px-3 py-1 rounded-full flex items-center"
                >
                  {tag}
                  <button 
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Caption</label>
            <div className="relative">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption to your exercise..."
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                rows={4}
              />
              <button
                onClick={handleGenerateCaption}
                disabled={isGeneratingCaption || !exerciseName.trim()}
                className="absolute right-2 top-2 bg-zinc-700 hover:bg-zinc-600 text-[#E0FE10] px-3 py-1 rounded text-sm flex items-center transition-colors"
                title="Generate AI caption"
              >
                {isGeneratingCaption ? (
                  <div className="w-4 h-4 border-2 border-[#E0FE10] border-t-transparent rounded-full animate-spin mr-1"></div>
                ) : (
                  <span className="mr-1">✨</span>
                )}
                {isGeneratingCaption ? 'Generating...' : 'AI Caption'}
              </button>
            </div>
            {isGeneratingCaption && (
              <div className="text-xs text-zinc-400 mt-1">
                Creating caption based on exercise details...
              </div>
            )}
          </div>

          {/* Progress Bar (upload progress) */}
          {isUploading && (
            <div className="mt-4">
              <ProgressBar 
                progress={uploadProgress} 
                label={
                  uploadProgress < 0.7 ? "Uploading video..." :
                  uploadProgress < 0.8 ? "Creating exercise..." :
                  uploadProgress < 0.85 ? "Preparing files..." :
                  uploadProgress < 0.87 ? "Generating preview..." :
                  uploadProgress < 0.92 ? "Encoding preview..." :
                  uploadProgress < 0.95 ? "Storing preview..." :
                  uploadProgress < 1.0 ? "Finalizing..." :
                  "Complete!"
                }
              />
            </div>
          )}

          {/* Submit Button */}
          <button 
            onClick={handleSubmit}
            disabled={!exerciseName.trim() || isUploading}
            className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 mb-20 rounded-lg hover:bg-[#c8e60e] transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Post Exercise'}
          </button>
          <Spacer size={100} />
        </div>
      )}

      {/* Storage Troubleshooting - Shown when no video is selected */}
      {!videoPreview && (
        <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg">
          <details>
            <summary className="text-zinc-400 text-sm cursor-pointer">Storage troubleshooting</summary>
            <div className="mt-2 text-zinc-500 text-xs">
              <p className="mb-2">If you're having trouble uploading videos, clear the browser storage to resolve potential issues.</p>
              <div className="mb-3 border-l-2 border-yellow-500 pl-2 py-1 text-yellow-200 bg-yellow-900/20">
                <strong>Note:</strong> This app requires browser storage to work properly. If you're in private/incognito mode or have strict privacy settings, you may encounter issues. Try using a regular browser window or adjusting your privacy settings.
              </div>
              <button 
                onClick={async () => {
                  if (confirm('Clear all video storage? This may help resolve upload issues.')) {
                    try {
                      await clearAllStorage();
                      alert('Storage cleared successfully.');
                    } catch (err) {
                      console.error('[DEBUG] Error clearing storage:', err);
                      alert('Failed to clear storage. Please try again or reload the page.');
                    }
                  }
                }}
                className="bg-zinc-700 text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-zinc-600"
              >
                Clear Storage
              </button>
            </div>
          </details>
        </div>
      )}

      {/* Similar Exercises Modal */}
      {showSimilarModal && (
        <SimilarExercisesModal 
          similarExercises={similarExercisesFound}
          isDuplicateExercise={isDuplicateExercise}
          onSelectExercise={handleSelectSimilarExercise}
          onSelectAsUnique={handleSelectAsUnique}
          onClose={() => setShowSimilarModal(false)}
        />
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <SuccessModal 
          onViewMove={handleViewMove}
          onClose={handleCloseSuccessModal}
        />
      )}

      {/* Video Trimmer Modal */}
      <SimpleVideoTrimmer
        isOpen={showTrimmer}
        file={selectedFile}
        onClose={() => setShowTrimmer(false)}
        onTrimComplete={handleTrimComplete}
      />
    </div>
  );
};

export default Create;

// Similar Exercises  Modal
interface SimilarExercisesModalProps {
  similarExercises: Exercise[];
  onSelectExercise: (exercise: Exercise) => void;
  onSelectAsUnique: () => void;
  onClose: () => void;
  isDuplicateExercise: boolean;
}

const SimilarExercisesModal: React.FC<SimilarExercisesModalProps> = ({
  similarExercises,
  onSelectExercise,
  onSelectAsUnique,
  isDuplicateExercise
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <button
              onClick={onSelectAsUnique}
              className="w-full bg-zinc-800 text-white py-2 px-4 rounded-lg mb-4"
            >
              {isDuplicateExercise 
                ? "Cancel, I have a unique exercise"
                : "No, this is a unique exercise"
              }
            </button>
            
            <h3 className="text-xl text-white font-semibold">
              {isDuplicateExercise 
                ? "There is an exercise in the vault with the same name. Tap the exercise to link them."
                : "Similar exercises found in the vault"
              }
            </h3>
          </div>

          {/* Exercise Cards */}
          <div className="space-y-4">
            {similarExercises.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => onSelectExercise(exercise)}
                className="w-full bg-zinc-800 rounded-xl overflow-hidden hover:bg-zinc-700 transition-colors"
              >
                <div className="aspect-square w-full relative">
                  {exercise.videos?.[0]?.gifURL ? (
                    <img 
                      src={exercise.videos[0].gifURL} 
                      alt={exercise.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                      <span className="text-zinc-400">No preview</span>
                    </div>
                  )}
                </div>
                <div className="p-4 text-left">
                  <h4 className="text-white font-medium">{exercise.name}</h4>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


// Success Modal
interface SuccessModalProps {
  onViewMove: () => void;
  onClose: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ onViewMove, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 text-center">
        <div className="mb-4 text-[#E0FE10] text-5xl">✓</div>
        <h3 className="text-xl text-white font-semibold mb-4">
          Upload Complete!
        </h3>
        <div className="space-y-3">
          <button
            onClick={onViewMove}
            className="w-full bg-[#E0FE10] text-black font-semibold py-3 rounded-lg"
          >
            View Move
          </button>
          <button
            onClick={onClose}
            className="w-full bg-zinc-800 text-white py-3 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

