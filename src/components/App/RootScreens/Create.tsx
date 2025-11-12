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
import { useUser } from '../../../hooks/useUser';
import { creatorPagesService } from '../../../api/firebase/creatorPages/service';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

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
  const currentUser = useUser();

  // Drag and video state
  const [isDragOver, setIsDragOver] = useState(false);
  const [originalVideoFile, setOriginalVideoFile] = useState<File | null>(null);
  const [trimStartTime, setTrimStartTime] = useState<number | null>(null);
  const [trimEndTime, setTrimEndTime] = useState<number | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
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

  // Landing Page Builder modal state
  const [showPageModal, setShowPageModal] = useState(false);
  const [lpSlug, setLpSlug] = useState('');
  const [lpTitle, setLpTitle] = useState('');
  const [lpHeadline, setLpHeadline] = useState('');
  const [lpBody, setLpBody] = useState('');
  const [lpBgType, setLpBgType] = useState<'color'|'image'>('color');
  const [lpBgColor, setLpBgColor] = useState('#0b0b0c');
  const [lpBgImage, setLpBgImage] = useState('');
  const [lpBgImageFile, setLpBgImageFile] = useState<File | null>(null);
  const [lpBgImagePreview, setLpBgImagePreview] = useState<string | null>(null);
  const [lpImageUploading, setLpImageUploading] = useState(false);
  const [lpCtaType, setLpCtaType] = useState<'link'|'waitlist'>('waitlist');
  const [lpCtaLabel, setLpCtaLabel] = useState('Join Waitlist');
  const [lpCtaHref, setLpCtaHref] = useState('');
  const [lpSaving, setLpSaving] = useState(false);

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
            
            // Create object URL and revoke any previous preview first
            if (previewUrlRef.current) {
              try { URL.revokeObjectURL(previewUrlRef.current); } catch (_) {}
              previewUrlRef.current = null;
            }
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
            setOriginalVideoFile(trimmedFile);
            previewUrlRef.current = objectUrl;
            setVideoPreview(objectUrl);
            
            // If videoData contains trimStart/trimEnd, set them here (though this flow might be deprecated)
            if (videoData.trimStart !== undefined && videoData.trimEnd !== undefined) {
              setTrimStartTime(videoData.trimStart);
              setTrimEndTime(videoData.trimEnd);
              console.log('[DEBUG] Trim times set from sessionStorage data:', {
                start: videoData.trimStart,
                end: videoData.trimEnd,
              });
            }
            
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
    setOriginalVideoFile(trimmedFile);
    setShowTrimmer(false);
    // Capture trim points from returned file metadata if present
    const s = (trimmedFile as any).trimStartTime ?? (trimmedFile as any).trimStart;
    const e = (trimmedFile as any).trimEndTime ?? (trimmedFile as any).trimEnd;
    if (typeof s === 'number' && typeof e === 'number') {
      setTrimStartTime(s);
      setTrimEndTime(e);
      console.log('[DEBUG] Trim points set from file metadata', { s, e });
    }
    
    // Create preview URL for the trimmed video
    if (previewUrlRef.current) {
      try { URL.revokeObjectURL(previewUrlRef.current); } catch (_) {}
      previewUrlRef.current = null;
    }
    const previewUrl = URL.createObjectURL(trimmedFile);
    previewUrlRef.current = previewUrl;
    setVideoPreview(previewUrl);
  };

  // NEW: Handler for when SimpleVideoTrimmer provides startTime and endTime
  const handleTrimSelection = (params: { startTime: number; endTime: number }) => {
    console.log('[DEBUG] Trim selection made:', params);
    if (selectedFile) { // selectedFile should be the original file shown in the trimmer
      setOriginalVideoFile(selectedFile); // Ensure originalVideoFile is the one from the trimmer
      if (previewUrlRef.current) {
        try { URL.revokeObjectURL(previewUrlRef.current); } catch (_) {}
        previewUrlRef.current = null;
      }
      const previewUrl = URL.createObjectURL(selectedFile);
      previewUrlRef.current = previewUrl;
      setVideoPreview(previewUrl); // Show preview of the original file
    }
    setTrimStartTime(params.startTime);
    setTrimEndTime(params.endTime);
    setShowTrimmer(false); // Close trimmer after selection
  };

  // Function to attempt video conversion if needed
  const tryConvertVideo = async (file: File): Promise<File> => {
    // Define Safari-compatible formats
    const SAFARI_COMPATIBLE_TYPES = ['video/mp4', 'video/quicktime'];
    const SAFARI_COMPATIBLE_CODECS = ['avc1.42E01E, mp4a.40.2']; // H.264 with AAC audio
    
    // If file is already in a Safari-compatible format, return it directly
    if (SAFARI_COMPATIBLE_TYPES.includes(file.type)) {
      console.log('[DEBUG] File already in Safari-compatible format:', file.type);
      return file;
    }
    
    console.log('[DEBUG] Attempting to verify/convert file from', file.type);
    
    return new Promise((resolve, reject) => {
      try {
        // Create video element to test compatibility
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        // Create object URL for the file
        const objectUrl = URL.createObjectURL(file);
        
        // Set up events for processing
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(objectUrl);
          
          // Test if current format can play in Safari
          const canPlayType = video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
          console.log('[DEBUG] Safari compatibility check:', canPlayType);
          
          if (canPlayType === 'probably' || canPlayType === 'maybe') {
            // If compatible, just update the container format
            const newFileName = file.name.replace(/\.[^/.]+$/, '.mp4');
            const newFile = new File([file], newFileName, { 
              type: 'video/mp4',
              lastModified: file.lastModified 
            });
            
            console.log('[DEBUG] Created Safari-compatible file:', {
              name: newFile.name,
              type: newFile.type,
              size: newFile.size
            });
            
            resolve(newFile);
          } else {
            // If not compatible, we should inform the user
            console.warn('[DEBUG] Video format not Safari-compatible');
            alert('The selected video format may not be compatible with Safari. For best results, please upload an MP4 file encoded with H.264.');
            // Still resolve with the original file, but with MP4 container
            const newFileName = file.name.replace(/\.[^/.]+$/, '.mp4');
            resolve(new File([file], newFileName, { type: 'video/mp4' }));
          }
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
    setOriginalVideoFile(null);
    if (previewUrlRef.current) {
      try { URL.revokeObjectURL(previewUrlRef.current); } catch (_) {}
      previewUrlRef.current = null;
    }
    setVideoPreview(null);
    setTrimStartTime(null);
    setTrimEndTime(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        try { URL.revokeObjectURL(previewUrlRef.current); } catch (_) {}
        previewUrlRef.current = null;
      }
    };
  }, []);

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
    if (!originalVideoFile || trimStartTime === null || trimEndTime === null) {
      console.error('[DEBUG] No original video file to upload or trim times not set');
      alert('Please select a video and define trim points.');
      return;
    }
    
    try {
      console.log('[DEBUG] Starting upload process with server-side trim plan');
      console.log('[DEBUG] Original video details:', {
        name: originalVideoFile.name,
        size: originalVideoFile.size,
        type: originalVideoFile.type,
        trimStart: trimStartTime,
        trimEnd: trimEndTime,
      });
      
      // Make sure the file type is compatible with Firebase Storage
      const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      let fileToUpload = originalVideoFile;
      
      if (!ALLOWED_TYPES.includes(originalVideoFile.type)) {
        console.log('[DEBUG] Converting original video to compatible format before upload');
        try {
          const newFileName = originalVideoFile.name.replace(/\\.[^/.]+$/, '.mp4');
          fileToUpload = new File([originalVideoFile], newFileName, { type: 'video/mp4' });
          console.log('[DEBUG] Created compatible file for upload:', {
            name: fileToUpload.name,
            type: fileToUpload.type,
            size: fileToUpload.size
          });
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
      
      // 1. Upload the ORIGINAL video to Firebase Storage
      // Progress: 0% -> 50%
      console.log('[DEBUG] Starting Firebase Storage upload of ORIGINAL video:', {
        name: fileToUpload.name,
        type: fileToUpload.type,
        size: fileToUpload.size
      });
      
      const uploadResult = await firebaseStorageService.uploadVideo(
        fileToUpload, // Uploading the original (or container-converted) file
        VideoType.Exercise, // Consider a temporary location if originals aren't kept long-term
        (progress) => {
          const scaledProgress = progress * 0.5; // Uploading original is 50% of this stage
          console.log(`[DEBUG] Original video upload progress: ${Math.round(progress * 100)}%, Scaled: ${Math.round(scaledProgress * 100)}%`);
          setUploadProgress(scaledProgress);
        },
        existingExercise ? existingExercise.name : formattedExerciseName // Path for original
      );
      
      console.log('[DEBUG] Original video uploaded successfully to Firebase Storage:', uploadResult);
      setUploadProgress(0.5); // Mark original upload as 50% complete
      
      // 2. Get the current user 
      console.log('[DEBUG] Getting current user');
      
      // Get complete user data from userService (Redux store)
      // const completeUserData = userService.currentUser;
      const completeUserData = currentUser;
      
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
        originalVideoStoragePath: uploadResult.gsURL, 
        originalVideoUrl: uploadResult.downloadURL, 
        // Seed videoURL with the original so the exercise page has a playable source immediately.
        // The server-side trim can update this to the trimmed URL later.
        videoURL: uploadResult.downloadURL, 
        gifURL: '', 
        trimStatus: 'pending', 
        trimStartTime: trimStartTime!, // Assert non-null as checked in uploadVideo start
        trimEndTime: trimEndTime!,   // Assert non-null
        fileName: uploadResult.gsURL.split('/').pop() || 'unknown',
        storagePath: '', 
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
        updatedAt: new Date()
        // Old client-side trim metadata removed, new structure handles it
      });
      
      console.log('[DEBUG] Exercise video data prepared (for server-side trim):', exerciseVideoData);
      
      // 6. Create the exercise video using the service
      console.log('[DEBUG] Creating exercise video document in Firestore');
      try {
        // Convert to plain object before saving to Firestore
        const exerciseVideoPlainObject = exerciseVideoData.toDictionary();
        
        // Add server-side trim specific fields explicitly if not already in toDictionary 
        // (depending on ExerciseVideo class implementation)
        exerciseVideoPlainObject.trimStartTime = trimStartTime!;
        exerciseVideoPlainObject.trimEndTime = trimEndTime!;
        exerciseVideoPlainObject.originalVideoStoragePath = uploadResult.gsURL;
        exerciseVideoPlainObject.originalVideoUrl = uploadResult.downloadURL;
        // Ensure videoURL exists so UI can render immediately
        exerciseVideoPlainObject.videoURL = exerciseVideoPlainObject.videoURL || uploadResult.downloadURL;
        exerciseVideoPlainObject.trimStatus = 'pending';
        
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
      
      // 10. Trigger Firebase Cloud Function for trimming
      // Progress: 85% -> 95% (representing triggering and server processing)
      console.log('[DEBUG] Preparing to trigger Firebase Cloud Function for video trimming.');
      setUploadProgress(0.87); // Indicate triggering has started

      // TODO: Implement the actual call to your Firebase Cloud Function here
      // Example parameters for the cloud function:
      const cloudFunctionParams = {
        originalVideoStoragePath: uploadResult.gsURL, // gs:// path
        targetExerciseId: exerciseId,
        targetVideoId: videoId,
        trimStartTime: trimStartTime,
        trimEndTime: trimEndTime,
        outputFileName: `${formattedExerciseName}-${videoId}-trimmed.mp4` // Suggested name for trimmed video
      };
      console.log('[DEBUG] Cloud Function parameters:', cloudFunctionParams);
      console.log(`[DEBUG] NEXT STEP: Call a Firebase Cloud Function (e.g., via HTTPS callable or other trigger) with these params.`);
      
      // Simulate server processing time for UI feedback
      // In a real scenario, you'd listen for Firestore updates or get a response from the callable function.
      // For now, we'll just advance the progress bar.
      // The actual videoURL and gifURL will be updated in Firestore by the cloud function.
      
      // Commenting out client-side GIF generation as it should happen on the server after trimming
      /*
      console.log('[DEBUG] Starting client-side GIF generation for video', videoId);
      try {
        // ... (original client-side GIF generation code) ...
        // This section needs to be moved to the cloud function or triggered after server trim.
      } catch (gifError) {
        console.error('[DEBUG] Error starting GIF generation:', gifError);
      }
      */
      
      console.log('[DEBUG] Client-side processing complete. Waiting for server to trim and update URLs.');
      // The UI should now wait for the Firestore document to be updated by the cloud function.
      // For demo, we'll just complete the progress bar.
      // The SuccessModal will be shown, but URLs might not be final yet.

      // A listener on the exerciseVideo document (videoId) should eventually trigger setShowSuccessModal
      // when `trimStatus` becomes 'completed' and `videoURL` is populated.
      // For now, let's assume the call is made and we show success.
      // This part needs to be more robust with actual server feedback.
      
      // Progress: 87% -> 100% (simulating call and server work for now)
      // A more realistic progress update would come from observing the Cloud Function's progress
      // (e.g., by listening to Firestore updates on the video document).
      let simulatedServerProgress = 0;
      const serverProgressInterval = setInterval(() => {
        simulatedServerProgress += 0.02; // Increment progress
        const currentSimulatedProgress = Math.min(0.13, simulatedServerProgress); // Cap at 0.13 (for 87% to 100%)
        setUploadProgress(0.87 + currentSimulatedProgress);
        if (0.87 + currentSimulatedProgress >= 1.0) {
          clearInterval(serverProgressInterval);
          console.log('[DEBUG] Simulated server processing complete.');
          // In a real app, this would be triggered by the cloud function finishing
          // and updating the Firestore document, which the client would listen to.
          setShowSuccessModal(true); 
        }
      }, 300);

      // 11. Log a summary (trim data is now from state)
      console.log('[DEBUG] Upload process initiated for server-side trim:', {
        exerciseId,
        videoId,
        originalVideoPath: uploadResult.gsURL,
        trimStartTime: trimStartTime,
        trimEndTime: trimEndTime,
      });
      
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
    
    if (!originalVideoFile) {
      console.error('[DEBUG] No original video file selected');
      alert('Please select a video file.');
      return;
    }

    if (trimStartTime === null || trimEndTime === null) {
      console.error('[DEBUG] Trim times not set');
      alert('Please select trim points for your video using the trimmer.');
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

  const handleLpImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate image type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setLpBgImageFile(file);
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setLpBgImagePreview(previewUrl);
  };

  const handleSaveLandingPage = async () => {
    if (!currentUser?.id) {
      alert('You must be logged in to create a landing page.');
      return;
    }
    if (!lpSlug.trim()) {
      alert('Please enter a page slug (URL).');
      return;
    }
    if (!lpTitle.trim()) {
      alert('Please enter a page title.');
      return;
    }

    setLpSaving(true);
    try {
      let backgroundImageUrl = lpBgImage;

      // Upload image if file is selected
      if (lpBgType === 'image' && lpBgImageFile) {
        setLpImageUploading(true);
        const storage = getStorage();
        const fileName = `${Date.now()}_${lpBgImageFile.name}`;
        const imageRef = storageRef(storage, `landing-page/${currentUser.id}/${fileName}`);
        
        await uploadBytes(imageRef, lpBgImageFile);
        backgroundImageUrl = await getDownloadURL(imageRef);
        setLpImageUploading(false);
      }

      const pageInput = {
        slug: lpSlug.trim().toLowerCase().replace(/\s+/g, '-'),
        title: lpTitle.trim(),
        headline: lpHeadline.trim(),
        body: lpBody.trim(),
        backgroundType: lpBgType,
        backgroundColor: lpBgType === 'color' ? lpBgColor : '',
        backgroundImageUrl: lpBgType === 'image' ? backgroundImageUrl : '',
        ctaType: lpCtaType,
        ctaLabel: lpCtaLabel.trim(),
        ctaHref: lpCtaType === 'link' ? lpCtaHref.trim() : '',
      };

      await creatorPagesService.savePage(currentUser.id, currentUser.username || '', pageInput);
      alert(`Landing page saved! Visit: /${currentUser.username || currentUser.id}/${pageInput.slug}`);
      setShowPageModal(false);
      // Reset form
      setLpSlug('');
      setLpTitle('');
      setLpHeadline('');
      setLpBody('');
      setLpBgType('color');
      setLpBgColor('#0b0b0c');
      setLpBgImage('');
      setLpBgImageFile(null);
      setLpBgImagePreview(null);
      setLpCtaType('waitlist');
      setLpCtaLabel('Join Waitlist');
      setLpCtaHref('');
    } catch (err) {
      console.error('[Save Landing Page]', err);
      alert('Failed to save landing page. Please try again.');
    } finally {
      setLpSaving(false);
      setLpImageUploading(false);
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
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-zinc-300">Caption</label>
              {caption && (
                <button
                  onClick={handleGenerateCaption}
                  disabled={isGeneratingCaption || !exerciseName.trim()}
                  className={`bg-zinc-700 hover:bg-zinc-600 text-[#E0FE10] px-3 py-1 rounded text-sm flex items-center transition-all duration-200
                    ${isGeneratingCaption ? 'opacity-50' : ''}`}
                  title="Generate AI caption"
                >
                  {isGeneratingCaption ? (
                    <div className="w-4 h-4 border-2 border-[#E0FE10] border-t-transparent rounded-full animate-spin mr-1"></div>
                  ) : (
                    <span className="mr-1">✨</span>
                  )}
                  {isGeneratingCaption ? 'Generating...' : 'AI Caption'}
                </button>
              )}
            </div>
            <div className="relative">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption to your exercise..."
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                rows={4}
              />
              {!caption && (
                <button
                  onClick={handleGenerateCaption}
                  disabled={isGeneratingCaption || !exerciseName.trim()}
                  className={`absolute right-2 top-2 bg-zinc-700 hover:bg-zinc-600 text-[#E0FE10] px-3 py-1 rounded text-sm flex items-center transition-all duration-200
                    ${isGeneratingCaption ? 'opacity-50' : ''}`}
                  title="Generate AI caption"
                >
                  {isGeneratingCaption ? (
                    <div className="w-4 h-4 border-2 border-[#E0FE10] border-t-transparent rounded-full animate-spin mr-1"></div>
                  ) : (
                    <span className="mr-1">✨</span>
                  )}
                  {isGeneratingCaption ? 'Generating...' : 'AI Caption'}
                </button>
              )}
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
                  uploadProgress < 0.5 ? "Uploading original video..." :
                  uploadProgress < 0.8 ? "Creating exercise entry..." :
                  uploadProgress < 0.87 ? "Requesting server trim..." :
                  uploadProgress < 1.0 ? "Server processing video..." :
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

      {/* Create Landing Page Button */}
      {!videoPreview && (
        <div className="mt-6">
          <button
            onClick={() => setShowPageModal(true)}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-3 rounded-lg border border-zinc-700 transition-colors"
          >
            + Create Landing Page
          </button>
        </div>
      )}

      {/* Landing Page Builder Modal */}
      {showPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Create Landing Page</h2>
              <button onClick={() => setShowPageModal(false)} className="text-zinc-400 hover:text-white text-2xl">✕</button>
            </div>

            <div className="space-y-4">
              {/* Slug */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Page URL Slug</label>
                <div className="text-xs text-zinc-400 mb-1">Your page will be at: /{currentUser?.username}/{lpSlug || 'your-page'}</div>
                <input
                  type="text"
                  value={lpSlug}
                  onChange={(e) => setLpSlug(e.target.value)}
                  placeholder="my-landing-page"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Page Title</label>
                <input
                  type="text"
                  value={lpTitle}
                  onChange={(e) => setLpTitle(e.target.value)}
                  placeholder="Welcome to My Page"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* Headline */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Headline (optional)</label>
                <input
                  type="text"
                  value={lpHeadline}
                  onChange={(e) => setLpHeadline(e.target.value)}
                  placeholder="Join the movement"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Body Text (optional)</label>
                <textarea
                  value={lpBody}
                  onChange={(e) => setLpBody(e.target.value)}
                  placeholder="Describe what you're offering..."
                  rows={4}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* Background Type */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Background</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setLpBgType('color')}
                    className={`px-3 py-1 rounded ${lpBgType === 'color' ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-white'}`}
                  >
                    Color
                  </button>
                  <button
                    onClick={() => setLpBgType('image')}
                    className={`px-3 py-1 rounded ${lpBgType === 'image' ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-white'}`}
                  >
                    Image
                  </button>
                </div>
                {lpBgType === 'color' && (
                  <input
                    type="color"
                    value={lpBgColor}
                    onChange={(e) => setLpBgColor(e.target.value)}
                    className="w-full h-12 rounded-lg cursor-pointer"
                  />
                )}
                {lpBgType === 'image' && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLpImageSelect}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#E0FE10] file:text-black file:cursor-pointer hover:file:bg-[#d0ee00]"
                    />
                    {lpBgImagePreview && (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-zinc-700">
                        <img src={lpBgImagePreview} alt="Background preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            setLpBgImageFile(null);
                            setLpBgImagePreview(null);
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {lpImageUploading && (
                      <p className="text-sm text-zinc-400">Uploading image...</p>
                    )}
                  </div>
                )}
              </div>

              {/* CTA Type */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Button Type</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setLpCtaType('waitlist')}
                    className={`px-3 py-1 rounded ${lpCtaType === 'waitlist' ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-white'}`}
                  >
                    Waitlist
                  </button>
                  <button
                    onClick={() => setLpCtaType('link')}
                    className={`px-3 py-1 rounded ${lpCtaType === 'link' ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-white'}`}
                  >
                    Link
                  </button>
                </div>
              </div>

              {/* CTA Label */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Button Text</label>
                <input
                  type="text"
                  value={lpCtaLabel}
                  onChange={(e) => setLpCtaLabel(e.target.value)}
                  placeholder="Join Waitlist"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* CTA Href (if link) */}
              {lpCtaType === 'link' && (
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Button Link</label>
                  <input
                    type="url"
                    value={lpCtaHref}
                    onChange={(e) => setLpCtaHref(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowPageModal(false)}
                  className="flex-1 bg-zinc-700 text-white px-4 py-3 rounded-lg hover:bg-zinc-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLandingPage}
                  disabled={lpSaving}
                  className="flex-1 bg-[#E0FE10] text-black px-4 py-3 rounded-lg hover:bg-[#d0ee00] disabled:opacity-50"
                >
                  {lpSaving ? 'Saving...' : 'Save & Publish'}
                </button>
              </div>
            </div>
          </div>
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

