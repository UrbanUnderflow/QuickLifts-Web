import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { storeVideoFile, getVideoFile, removeVideoFile } from '../utils/indexedDBStorage';
import { SimpleVideoTrimmer } from '../components/SimpleVideoTrimmer';

// Information component to explain the trimming process
const InfoAlert: React.FC = () => (
  <div className="max-w-md w-full bg-zinc-800 rounded-lg p-4 mb-4 text-sm text-zinc-300">
    <p className="mb-2">
      <strong className="text-[#E0FE10]">Note:</strong> Video trimming is processed on our servers for better compatibility with all devices.
    </p>
    <p>
      Select your start and end points, then save. The full video will be uploaded with your trim preferences, and our system will automatically create the trimmed version.
    </p>
  </div>
);

const TrimVideoPage: React.FC = () => {
  const router = useRouter();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Parse the returnUrl and any state from query params
  useEffect(() => {
    if (router.isReady) {
      setIsReady(true);
      
      // Get file from IndexedDB instead of sessionStorage
      const getVideoFromIndexedDB = async () => {
        try {
          setIsLoading(true);
          console.log('[DEBUG] Attempting to retrieve video file from IndexedDB');
          
          const storedFile = await getVideoFile('trim_video_file');
          if (storedFile) {
            console.log('[DEBUG] Found video file in IndexedDB');
            // Convert base64 back to File object
            const { name, type, data } = storedFile;
            const arrayBuffer = Uint8Array.from(atob(data), c => c.charCodeAt(0)).buffer;
            const file = new File([arrayBuffer], name, { type });
            setVideoFile(file);
          } else {
            console.log('[DEBUG] No video file found in IndexedDB');
            setError('No video file found. Please upload a video first.');
          }
        } catch (err) {
          console.error('[DEBUG] Failed to restore video file from IndexedDB:', err);
          setError('Could not load the video file. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };
      
      getVideoFromIndexedDB();
    }
  }, [router.isReady]);

  const handleTrimComplete = async (trimmedFile: File) => {
    try {
      setIsLoading(true);
      console.log('[DEBUG] Starting to save trimmed video');
      console.log('[DEBUG] Trimmed file details:', {
        name: trimmedFile.name,
        size: trimmedFile.size,
        type: trimmedFile.type,
        extension: trimmedFile.name.split('.').pop(),
        trimStart: (trimmedFile as any).trimStart,
        trimEnd: (trimmedFile as any).trimEnd
      });
      
      // Ensure we're using an MP4 compatible file to upload to Firebase
      let compatibleFile = trimmedFile;
      
      // ALWAYS convert to MP4 to ensure compatibility
      console.log('[DEBUG] Creating MP4-compatible file for upload');
      
      try {
        // Create a new file with MP4 mime type to ensure compatibility with Firebase
        const newFileName = trimmedFile.name.replace(/\.(webm|mkv|avi|mov|qt)$/, '.mp4');
        compatibleFile = new File(
          [trimmedFile], 
          newFileName.endsWith('.mp4') ? newFileName : newFileName + '.mp4', 
          { type: 'video/mp4' }
        );
        
        // Copy the trim metadata to the new file
        Object.defineProperties(compatibleFile, {
          trimStart: { value: (trimmedFile as any).trimStart, enumerable: true },
          trimEnd: { value: (trimmedFile as any).trimEnd, enumerable: true }
        });
        
        console.log('[DEBUG] Created compatible file with MP4 type:', {
          name: compatibleFile.name,
          size: compatibleFile.size,
          type: compatibleFile.type
        });
      } catch (error) {
        console.error('[DEBUG] Error creating MP4-compatible file:', error);
        // Continue with original file if conversion fails
        compatibleFile = trimmedFile;
      }
      
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Content = base64.split(',')[1]; // Remove data URL prefix
          resolve(base64Content);
        };
        reader.onerror = reject;
        reader.readAsDataURL(compatibleFile);
      });

      console.log('[DEBUG] Converted video to base64, size:', base64Data.length);

      // Generate a unique ID for this trimmed video
      const videoId = Date.now().toString();
      
      // Since IndexedDB is not working, use sessionStorage instead
      // Store minimum necessary data to avoid sessionStorage size limits
      const videoData = {
        name: compatibleFile.name,
        type: compatibleFile.type,
        data: base64Data, // This will be the Base64 encoded video
        trimStart: (compatibleFile as any).trimStart,
        trimEnd: (compatibleFile as any).trimEnd,
        videoId: videoId
      };

      // Store in sessionStorage - this bypasses IndexedDB completely
      try {
        sessionStorage.setItem('trimmed_video_data', JSON.stringify(videoData));
        console.log('[DEBUG] Successfully stored video data in sessionStorage, size:', JSON.stringify(videoData).length);
      } catch (storageError) {
        console.error('[DEBUG] Error storing video in sessionStorage:', storageError);
        
        // If sessionStorage fails (possibly due to size), fall back to a minimal approach
        // Store just the metadata and use a flag to indicate the video is ready
        const minimalData = {
          name: compatibleFile.name,
          type: compatibleFile.type,
          trimStart: (compatibleFile as any).trimStart,
          trimEnd: (compatibleFile as any).trimEnd,
          videoId: videoId,
          // Add important flag to indicate we're using minimal mode
          isMinimal: true
        };
        
        sessionStorage.setItem('trimmed_video_data', JSON.stringify(minimalData));
        
        // For minimal mode, we also need to temporarily store the video blob in memory
        // This is risky as it might not survive page navigation, but it's our last resort
        if (typeof window !== 'undefined' && window.opener) {
          // If opened in a new window, try to pass to parent
          window.opener.tempVideoBlob = compatibleFile;
        } else {
          // Otherwise use global variable as last resort
          (window as any).tempVideoBlob = compatibleFile;
        }
        
        console.log('[DEBUG] Stored minimal data in sessionStorage and video in memory');
      }
      
      // Clean up the original file from session storage
      sessionStorage.removeItem('trim_video_file');
      console.log('[DEBUG] Removed original video file from sessionStorage');

      // Wait a moment to ensure operations are complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate back
      const returnUrl = router.query.returnUrl as string || '/';
      console.log('[DEBUG] All operations complete, navigating to:', returnUrl);
      
      // Add a query parameter to signal that trimming just completed
      const destinationUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}trimmed=true`;
      console.log('[DEBUG] Navigating with trim flag:', destinationUrl);
      router.replace(destinationUrl);

    } catch (error) {
      console.error('[DEBUG] Error in handleTrimComplete:', error);
      setError(error instanceof Error ? error.message : 'Failed to save the trimmed video. Please try again.');
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      // Clean up by removing the original file
      await removeVideoFile('trim_video_file');
      console.log('[DEBUG] Removed original video from IndexedDB after cancellation');
    } catch (err) {
      console.error('[DEBUG] Error removing video file on cancel:', err);
    }
    
    // Navigate back without saving
    const returnUrl = router.query.returnUrl as string || '/';
    router.push(returnUrl);
  };

  return (
    <>
      <Head>
        <title>Trim Video - QuickLifts</title>
        <meta name="description" content="Trim your video for QuickLifts" />
      </Head>

      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        {!isReady || isLoading ? (
          <div className="text-white">Loading...</div>
        ) : error ? (
          <div className="p-6 bg-zinc-900 rounded-xl text-white max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Error</h2>
            <p>{error}</p>
            <button 
              className="mt-4 w-full bg-[#E0FE10] text-black py-2 rounded-lg"
              onClick={() => router.push(router.query.returnUrl as string || '/')}
            >
              Return
            </button>
          </div>
        ) : videoFile ? (
          <>
            <InfoAlert />
            <SimpleVideoTrimmer 
              isOpen={true}
              file={videoFile} 
              onTrimComplete={handleTrimComplete} 
              onClose={handleCancel} 
            />
          </>
        ) : (
          <div className="text-white">No video file found.</div>
        )}
      </div>
    </>
  );
};

export default TrimVideoPage; 