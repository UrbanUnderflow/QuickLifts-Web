import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { VideoTrimmer } from '../components/VideoTrimmer';
import Head from 'next/head';

const TrimVideoPage: React.FC = () => {
  const router = useRouter();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Parse the returnUrl and any state from query params
  useEffect(() => {
    if (router.isReady) {
      setIsReady(true);
      
      // Get file from sessionStorage if available
      const storedFile = sessionStorage.getItem('trim_video_file');
      if (storedFile) {
        try {
          // Convert base64 back to File object
          const { name, type, data } = JSON.parse(storedFile);
          const arrayBuffer = Uint8Array.from(atob(data), c => c.charCodeAt(0)).buffer;
          const file = new File([arrayBuffer], name, { type });
          setVideoFile(file);
        } catch (err) {
          console.error('Failed to restore video file:', err);
          setError('Could not load the video file. Please try again.');
        }
      } else {
        setError('No video file found. Please upload a video first.');
      }
    }
  }, [router.isReady]);

  const handleTrimComplete = (trimmedFile: File) => {
    // Save the trimmed file to session storage for the return route
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64data = reader.result as string;
        const base64Content = base64data.split(',')[1]; // Remove the data URL prefix
        
        // Store the trimmed file data
        sessionStorage.setItem('trimmed_video_file', JSON.stringify({
          name: trimmedFile.name,
          type: trimmedFile.type,
          data: base64Content
        }));
        
        // Remove the original file data to free up space
        sessionStorage.removeItem('trim_video_file');
        
        // Navigate back to the returnUrl or home
        const returnUrl = router.query.returnUrl as string || '/';
        router.push(returnUrl);
      };
      reader.readAsDataURL(trimmedFile);
    } catch (err) {
      console.error('Failed to save trimmed video:', err);
      setError('Failed to save the trimmed video. Please try again.');
    }
  };

  const handleCancel = () => {
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

      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        {!isReady ? (
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
          <VideoTrimmer 
            file={videoFile} 
            onTrimComplete={handleTrimComplete} 
            onCancel={handleCancel} 
          />
        ) : (
          <div className="text-white">No video file found.</div>
        )}
      </div>
    </>
  );
};

export default TrimVideoPage; 