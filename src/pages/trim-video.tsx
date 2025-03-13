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

  const handleTrimComplete = (trimmedFile: File) => {
    // Save the trimmed file to IndexedDB for the return route
    try {
      setIsLoading(true);
      console.log('[DEBUG] Saving trimmed video to IndexedDB');
      
      // Extract trim metadata from filename and save it to the video data
      let trimStart = 0;
      let trimEnd = 0;
      
      // Check if we have trim metadata directly on the file object (our SimpleVideoTrimmer adds these)
      if ((trimmedFile as any).trimStart !== undefined && (trimmedFile as any).trimEnd !== undefined) {
        trimStart = (trimmedFile as any).trimStart;
        trimEnd = (trimmedFile as any).trimEnd;
        console.log('[DEBUG] Using trim metadata from file object:', { trimStart, trimEnd });
      } else {
        // Try to extract from filename as fallback
        const filename = trimmedFile.name;
        const trimMatch = filename.match(/_trim_(\d+\.\d+)_(\d+\.\d+)/);
        
        if (trimMatch && trimMatch.length === 3) {
          trimStart = parseFloat(trimMatch[1]);
          trimEnd = parseFloat(trimMatch[2]);
          console.log('[DEBUG] Extracted trim metadata from filename:', { trimStart, trimEnd });
        }
      }
      
      const reader = new FileReader();
      reader.onload = async () => {
        const base64data = reader.result as string;
        const base64Content = base64data.split(',')[1]; // Remove the data URL prefix
        
        try {
          // First, ensure any existing trimmed file is removed to prevent conflicts
          await removeVideoFile('trimmed_video_file').catch(err => {
            console.log('[DEBUG] No existing trimmed file to remove or error:', err);
          });
          
          // Store the trimmed file data in IndexedDB with trim metadata
          await storeVideoFile('trimmed_video_file', {
            name: trimmedFile.name,
            type: trimmedFile.type,
            data: base64Content,
            trimStart,
            trimEnd
          });
          
          console.log('[DEBUG] Trimmed video stored in IndexedDB successfully');
          
          // Remove the original file data to free up space
          await removeVideoFile('trim_video_file').catch(err => {
            console.log('[DEBUG] Error removing original file or not found:', err);
          });
          
          console.log('[DEBUG] Original video removed from IndexedDB');
          
          // Navigate back to the returnUrl or home
          const returnUrl = router.query.returnUrl as string || '/';
          console.log('[DEBUG] Navigating to return URL:', returnUrl);
          
          // Use router.push with a small delay to ensure IndexedDB operations complete
          setTimeout(() => {
            router.push(returnUrl);
          }, 100);
        } catch (storeError) {
          console.error('[DEBUG] Failed to store trimmed video in IndexedDB:', storeError);
          setError('Failed to save the trimmed video. Please try again.');
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(trimmedFile);
    } catch (err) {
      console.error('[DEBUG] Failed to process trimmed video:', err);
      setError('Failed to save the trimmed video. Please try again.');
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
              file={videoFile} 
              onTrimComplete={handleTrimComplete} 
              onCancel={handleCancel} 
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