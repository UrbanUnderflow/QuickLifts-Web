import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import { Download, X, Film } from 'lucide-react'; // Changed icon
import Footer from '../../components/Footer/Footer';
// import Header from '../../components/Header'; // Optional: Add header if needed

// Define structure for video data
interface VideoAsset {
  id: string; // Unique ID
  name: string;
  url: string; // URL to the video file
  thumbnailUrl: string; // URL to a preview image
  fileType: string; // e.g., 'video/mp4'
  category: string; // Category
}

// Define video categories
const videoCategories: { [key: string]: string } = {
  appDemos: "App Demos",
  commercialFootage: "Commercial Footage",
};

const PressVideosPage: NextPage = () => {
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Group videos by category after fetching
  const groupedVideos = videos.reduce((acc, video) => {
    const category = video.category || 'Uncategorized'; // Default category
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(video);
    return acc;
  }, {} as Record<string, VideoAsset[]>);

  useEffect(() => {
    const fetchVideos = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        // --- TODO: Implement actual fetching logic here ---
        console.log('Simulating fetching videos...');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

        // Example simulated data:
        const fetchedVideos: VideoAsset[] = [
          // App Demos
          { id: 'vid1', name: 'Pulse_App_Overview_Demo.mp4', url: '/placeholder/video.mp4', thumbnailUrl: '/placeholder/video_thumb.jpg', fileType: 'video/mp4', category: videoCategories.appDemos },
          { id: 'vid2', name: 'Creating_A_Round_Demo.mp4', url: '/placeholder/video.mp4', thumbnailUrl: '/placeholder/video_thumb.jpg', fileType: 'video/mp4', category: videoCategories.appDemos },
          { id: 'vid3', name: 'Logging_Weights_Demo.mp4', url: '/placeholder/video.mp4', thumbnailUrl: '/placeholder/video_thumb.jpg', fileType: 'video/mp4', category: videoCategories.appDemos },
          // Commercial Footage
          { id: 'vid4', name: 'Pulse_Brand_Anthem_30s.mp4', url: '/placeholder/video.mp4', thumbnailUrl: '/placeholder/video_thumb.jpg', fileType: 'video/mp4', category: videoCategories.commercialFootage },
          { id: 'vid5', name: 'Pulse_Community_Spotlight.mp4', url: '/placeholder/video.mp4', thumbnailUrl: '/placeholder/video_thumb.jpg', fileType: 'video/mp4', category: videoCategories.commercialFootage },
        ];
        // --- End of TODO ---

        setVideos(fetchedVideos);
      } catch (error) {
        console.error("Failed to fetch videos:", error);
        setFetchError("Failed to load videos. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchVideos();
  }, []);

  const handleDownloadAll = () => {
    // TODO: Implement zipping videos (likely server-side and potentially complex)
    alert('Download All Videos functionality not yet implemented.');
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <Head>
        <title>Video Assets - Pulse</title>
        <meta name="description" content="Download official Pulse video assets including app demos and commercial footage." />
      </Head>

      {/* <Header /> Optional */}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title Section */}
        <div className="mb-16 text-center md:text-left">
          <h1 className="text-5xl sm:text-6xl font-bold mb-4">Video Assets</h1>
          <p className="text-zinc-400 text-lg max-w-3xl mx-auto md:mx-0 mb-6">
            Download official Pulse video assets including app demonstrations and promotional footage. By using these assets, you agree to our brand guidelines and terms of service.
          </p>
          <button
            onClick={handleDownloadAll}
            className="inline-flex items-center px-6 py-3 border border-zinc-700 rounded-full text-sm font-medium hover:bg-zinc-800 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={videos.length === 0 || isLoading}
          >
            <Download className="w-4 h-4 mr-2" />
            Download All Videos
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
           <div className="text-center py-16">
             <div className="w-12 h-12 mx-auto rounded-full border-4 border-[#E0FE10]/20 border-t-[#E0FE10] animate-spin mb-4"></div>
             <p className="text-zinc-400">Loading Videos...</p>
           </div>
        )}

        {/* Error State */}
        {fetchError && !isLoading && (
          <div className="text-center py-16 border-2 border-dashed border-red-700 rounded-xl bg-red-900/20 px-6">
            <X className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-semibold text-red-300">Error Loading Videos</h3>
            <p className="mt-1 text-sm text-red-400">{fetchError}</p>
          </div>
        )}

        {/* Video Categories & Grid */}
        {!isLoading && !fetchError && videos.length > 0 && (
          <div className="space-y-12">
            {Object.entries(groupedVideos).map(([category, items]) => (
              <section key={category}>
                <h2 className="text-2xl font-semibold mb-6 border-b border-zinc-700 pb-2">{category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {items.map((video) => (
                    <div key={video.id} className="group relative bg-zinc-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden"> {/* Use aspect-video */}
                      <img
                        src={video.thumbnailUrl} // Show thumbnail
                        alt={video.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                        <p className="text-white text-sm font-medium mb-2 truncate w-full" title={video.name}>{video.name}</p>
                        <a
                          href={video.url} // Link to the video file
                          download={video.name} // Suggest filename for download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-[#E0FE10] text-black rounded-full text-xs font-medium hover:bg-[#c8e40d] transition-colors"
                          aria-label={`Download ${video.name}`}
                        >
                          <Download className="w-3 h-3 mr-1.5" />
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !fetchError && videos.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-zinc-700 rounded-xl">
            <Film className="mx-auto h-12 w-12 text-zinc-500" /> {/* Changed Icon */}
            <h3 className="mt-2 text-sm font-semibold text-zinc-300">No videos available</h3>
            <p className="mt-1 text-sm text-zinc-500">There are currently no videos available for download.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PressVideosPage; 