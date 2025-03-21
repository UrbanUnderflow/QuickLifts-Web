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
      console.log('[DEBUG] Starting to save trimmed video to IndexedDB');
      console.log('[DEBUG] Trimmed file details:', {
        name: trimmedFile.name,
        size: trimmedFile.size,
        type: trimmedFile.type,
        trimStart: (trimmedFile as any).trimStart,
        trimEnd: (trimmedFile as any).trimEnd
      });
      
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Content = base64.split(',')[1]; // Remove data URL prefix
          resolve(base64Content);
        };
        reader.onerror = reject;
        reader.readAsDataURL(trimmedFile);
      });

      console.log('[DEBUG] Converted video to base64, size:', base64Data.length);

      // Clean up any existing trimmed file
      await removeVideoFile('trimmed_video_file').catch(err => {
        console.log('[DEBUG] No existing trimmed file to remove or error:', err);
      });

      // Store the new trimmed file
      const videoData = {
        name: trimmedFile.name,
        type: trimmedFile.type,
        data: base64Data,
        trimStart: (trimmedFile as any).trimStart,
        trimEnd: (trimmedFile as any).trimEnd
      };

      console.log('[DEBUG] Storing video data in IndexedDB:', {
        name: videoData.name,
        type: videoData.type,
        dataSize: videoData.data.length,
        trimStart: videoData.trimStart,
        trimEnd: videoData.trimEnd
      });

      await storeVideoFile('trimmed_video_file', videoData);
      console.log('[DEBUG] Successfully stored trimmed video in IndexedDB');

      // Verify the file was stored and retry if needed
      let retryCount = 0;
      let verifyFile = null;
      
      while (retryCount < 3 && !verifyFile) {
        verifyFile = await getVideoFile('trimmed_video_file');
        if (!verifyFile) {
          console.log(`[DEBUG] Verification attempt ${retryCount + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          retryCount++;
        }
      }

      if (!verifyFile) {
        throw new Error('Failed to verify stored video file after multiple attempts');
      }

      console.log('[DEBUG] Verified trimmed video in IndexedDB:', {
        name: verifyFile.name,
        type: verifyFile.type,
        dataSize: verifyFile.data.length,
        trimStart: verifyFile.trimStart,
        trimEnd: verifyFile.trimEnd
      });

      // Clean up the original file
      await removeVideoFile('trim_video_file').catch(err => {
        console.log('[DEBUG] Error removing original file or not found:', err);
      });

      // Wait a moment to ensure IndexedDB operations are complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Navigate back
      const returnUrl = router.query.returnUrl as string || '/';
      console.log('[DEBUG] All operations complete, navigating to:', returnUrl);
      
      // Use router.replace instead of push to force a clean navigation
      router.replace(returnUrl);

    } catch (error) {
      console.error('[DEBUG] Error in handleTrimComplete:', error);
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