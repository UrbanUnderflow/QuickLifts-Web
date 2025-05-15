import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import { Download, FileImage, X, Smartphone } from 'lucide-react'; // Changed icon
import Footer from '../../components/Footer/Footer';
// Import Firebase dependencies
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

// Define structure for screenshot data
interface ScreenshotAsset {
  id: string; // Unique ID (e.g., Firestore doc ID or filename)
  name: string;
  url: string;
  fileType: string; // e.g., 'image/png', 'image/jpeg'
  category: string; // Category based on feature
}

// Define categories based on user request
const screenshotCategories: { [key: string]: string } = {
  // User Features
  moves: "Moves Feature",
  stacks: "Stacks Feature",
  rounds: "Rounds Feature",
  inProgressWorkout: "In-Progress Workout (Timed)",
  weightTraining: "Weight Training Interface",
  loggingWeights: "Logging Weights",
  progressReport: "Progress Report",
  workoutSummary: "Workout Summary",
  checkingIn: "Checking In",
  weeklyWeighIns: "Weekly Weigh-Ins",
  roundPricing: "Setting Round Pricing",
  creatingRound: "Creating a Round",
  // Trainer Features
  creatorPaymentDashboard: "Creator Payment Dashboard",
  generatingRoundAI: "Generating Round with AI",
  stripeConnect: "Stripe Connect Integration",
  professionalDashboard: "Professional Dashboard"
};

const PressAppScreenshotsPage: NextPage = () => {
  const [screenshots, setScreenshots] = useState<ScreenshotAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Group screenshots by category after fetching
  const groupedScreenshots = screenshots.reduce((acc, screenshot) => {
    const category = screenshot.category || 'Uncategorized'; // Default category
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(screenshot);
    return acc;
  }, {} as Record<string, ScreenshotAsset[]>);

  useEffect(() => {
    const fetchScreenshots = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        // Fetch all the screenshot URLs from the pressKitData/liveAssets document
        const docRef = doc(db, "pressKitData", "liveAssets");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const liveAssets = docSnap.data();
          const screenshots: ScreenshotAsset[] = [];
          
          // Process all the appScreenshot_ fields from the document
          Object.entries(liveAssets).forEach(([key, url]) => {
            if (key.startsWith('appScreenshot_') && url) {
              // Parse the key format: appScreenshot_categoryKey_index
              const parts = key.split('_');
              if (parts.length === 3) {
                const categoryKey = parts[1];
                const categoryName = screenshotCategories[categoryKey] || categoryKey;
                const index = parseInt(parts[2]);
                
                screenshots.push({
                  id: key,
                  name: `${categoryName}_${index}.png`,
                  url: url as string,
                  fileType: 'image/png', // Assuming PNG for simplicity
                  category: categoryName
                });
              }
            }
          });
          
          setScreenshots(screenshots);
          console.log("Fetched screenshots:", screenshots);
        } else {
          console.log("No liveAssets document found!");
          setFetchError("No screenshots available. Please check back later.");
        }
      } catch (error) {
        console.error("Failed to fetch screenshots:", error);
        setFetchError("Failed to load screenshots. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchScreenshots();
  }, []);

  const handleDownloadAll = () => {
    // TODO: Implement zipping screenshots (likely server-side)
    alert('Download All Screenshots functionality not yet implemented.');
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <Head>
        <title>App Screenshots - Pulse</title>
        <meta name="description" content="Download official Pulse app screenshots." />
      </Head>

      {/* <Header /> Optional */}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title Section */}
        <div className="mb-16 text-center md:text-left">
          <h1 className="text-5xl sm:text-6xl font-bold mb-4">App Screenshots</h1>
          <p className="text-zinc-400 text-lg max-w-3xl mx-auto md:mx-0 mb-6">
            Download official Pulse app screenshots showcasing key features. By using these assets, you agree to our brand guidelines and terms of service.
          </p>
          <button
            onClick={handleDownloadAll}
            className="inline-flex items-center px-6 py-3 border border-zinc-700 rounded-full text-sm font-medium hover:bg-zinc-800 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={screenshots.length === 0 || isLoading}
          >
            <Download className="w-4 h-4 mr-2" />
            Download All Screenshots
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
           <div className="text-center py-16">
             <div className="w-12 h-12 mx-auto rounded-full border-4 border-[#E0FE10]/20 border-t-[#E0FE10] animate-spin mb-4"></div>
             <p className="text-zinc-400">Loading Screenshots...</p>
           </div>
        )}

        {/* Error State */}
        {fetchError && !isLoading && (
          <div className="text-center py-16 border-2 border-dashed border-red-700 rounded-xl bg-red-900/20 px-6">
            <X className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-semibold text-red-300">Error Loading Screenshots</h3>
            <p className="mt-1 text-sm text-red-400">{fetchError}</p>
          </div>
        )}

        {/* Screenshot Categories & Grid */}
        {!isLoading && !fetchError && screenshots.length > 0 && (
          <div className="space-y-12">
            {Object.entries(groupedScreenshots).map(([category, items]) => (
              <section key={category}>
                <h2 className="text-2xl font-semibold mb-6 border-b border-zinc-700 pb-2">{category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {items.map((screenshot) => (
                    <div key={screenshot.id} className="group relative bg-zinc-800 rounded-xl p-4 aspect-[9/16] flex items-center justify-center overflow-hidden"> {/* Adjusted aspect ratio */}
                      <img
                        src={screenshot.url}
                        alt={screenshot.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" // Use object-cover
                      />
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                        <p className="text-white text-sm font-medium mb-2 truncate w-full" title={screenshot.name}>{screenshot.name}</p>
                        <a
                          href={screenshot.url}
                          download={screenshot.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-[#E0FE10] text-black rounded-full text-xs font-medium hover:bg-[#c8e40d] transition-colors"
                          aria-label={`Download ${screenshot.name}`}
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
        {!isLoading && !fetchError && screenshots.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-zinc-700 rounded-xl">
            <Smartphone className="mx-auto h-12 w-12 text-zinc-500" /> {/* Changed Icon */}
            <h3 className="mt-2 text-sm font-semibold text-zinc-300">No screenshots available</h3>
            <p className="mt-1 text-sm text-zinc-500">There are currently no screenshots available for download.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PressAppScreenshotsPage; 