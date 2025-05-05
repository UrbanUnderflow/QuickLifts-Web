import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
// Remove Firebase imports if only displaying data fetched elsewhere
// import { firebaseStorageService, UploadResult } from '../../api/firebase/storage/service'; 
import { Download, FileImage, X } from 'lucide-react'; // Removed Upload, Trash2, Added X
import Footer from '../../components/Footer/Footer';
// import Header from '../../components/Header'; // Optional: Add header if needed

// Define structure for logo data
interface LogoAsset {
  id: string; // Unique ID (e.g., Firestore doc ID or filename)
  name: string;
  url: string;
  fileType: string; // e.g., 'image/svg+xml', 'image/png'
}

// Remove storage path if not uploading from this page
// const LOGO_STORAGE_PATH = 'press_assets/logos';

const PressLogosPage: NextPage = () => {
  // State to hold logos fetched from backend
  const [logos, setLogos] = useState<LogoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true); // State to track loading
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch existing logos from Firestore/backend on component mount
  useEffect(() => {
    const fetchLogos = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        // --- TODO: Implement actual fetching logic here ---
        console.log('Simulating fetching logos...');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        // Example simulated data:
        const fetchedLogos: LogoAsset[] = [
          // Pulse Signature
          { id: 'sig-svg', name: 'Pulse Signature.svg', url: '/placeholder/signature.svg', fileType: 'image/svg+xml' },
          { id: 'sig-png', name: 'Pulse Signature.png', url: '/placeholder/signature.png', fileType: 'image/png' },
          // Pulse White
          { id: 'white-svg', name: 'Pulse White.svg', url: '/placeholder/logo_light.svg', fileType: 'image/svg+xml' }, // Assuming light is white
          { id: 'white-png', name: 'Pulse White.png', url: '/placeholder/logo_light.png', fileType: 'image/png' }, // Assuming light is white
          // Pulse Black
          { id: 'black-svg', name: 'Pulse Black.svg', url: '/placeholder/logo_dark.svg', fileType: 'image/svg+xml' }, // Assuming dark is black
          { id: 'black-png', name: 'Pulse Black.png', url: '/placeholder/logo_dark.png', fileType: 'image/png' }, // Assuming dark is black
          // Pulse Green (Assuming a specific green logo exists)
          { id: 'green-svg', name: 'Pulse Green.svg', url: '/placeholder/logo_green.svg', fileType: 'image/svg+xml' },
          { id: 'green-png', name: 'Pulse Green.png', url: '/placeholder/logo_green.png', fileType: 'image/png' },
          // Pulse Icon (Keeping existing icons for variety)
          { id: 'icon-dark-svg', name: 'Pulse Icon Dark.svg', url: '/placeholder/icon_dark.svg', fileType: 'image/svg+xml' },
          { id: 'icon-light-svg', name: 'Pulse Icon Light.svg', url: '/placeholder/icon_light.svg', fileType: 'image/svg+xml' },
        ];
        // --- End of TODO ---

        setLogos(fetchedLogos);
      } catch (error) {
        console.error("Failed to fetch logos:", error);
        setFetchError("Failed to load logos. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogos();
  }, []);

  // --- Download All Logic (Placeholder) ---
  const handleDownloadAll = () => {
    // TODO: Implement zipping logos on the server or client-side (more complex)
    alert('Download All functionality not yet implemented.');
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <Head>
        <title>Press Logos - Pulse</title>
        <meta name="description" content="Download official Pulse brand logos." />
      </Head>

      {/* <Header /> Optional */} 

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title Section */}
        <div className="mb-16 text-center md:text-left">
          <h1 className="text-5xl sm:text-6xl font-bold mb-4">Logos</h1>
          <p className="text-zinc-400 text-lg max-w-3xl mx-auto md:mx-0 mb-6">
            Download official Pulse brand logos in various formats. By using these assets, you agree to our brand guidelines and terms of service.
          </p>
          <button 
            onClick={handleDownloadAll}
            className="inline-flex items-center px-6 py-3 border border-zinc-700 rounded-full text-sm font-medium hover:bg-zinc-800 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={logos.length === 0 || isLoading} // Disable if no logos or still loading
          >
            <Download className="w-4 h-4 mr-2" />
            Download All Files
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
           <div className="text-center py-16">
             <div className="w-12 h-12 mx-auto rounded-full border-4 border-[#E0FE10]/20 border-t-[#E0FE10] animate-spin mb-4"></div>
             <p className="text-zinc-400">Loading Logos...</p>
           </div>
        )}

        {/* Error State */}
        {fetchError && !isLoading && (
          <div className="text-center py-16 border-2 border-dashed border-red-700 rounded-xl bg-red-900/20 px-6">
            <X className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-semibold text-red-300">Error Loading Logos</h3>
            <p className="mt-1 text-sm text-red-400">{fetchError}</p>
          </div>
        )}

        {/* Logo Grid */} 
        {!isLoading && !fetchError && logos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {logos.map((logo) => (
              <div key={logo.id} className="group relative bg-zinc-800 rounded-xl p-4 aspect-video flex items-center justify-center overflow-hidden">
                <img 
                  src={logo.url} 
                  alt={logo.name} 
                  className="max-w-full max-h-24 object-contain transition-transform duration-300 group-hover:scale-105"
                />
                {/* Overlay */} 
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                  <p className="text-white text-sm font-medium mb-2 truncate w-full" title={logo.name}>{logo.name}</p>
                  <a 
                    href={logo.url} 
                    download={logo.name} // Use the name for the downloaded file
                    target="_blank" // Good practice for downloads
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-[#E0FE10] text-black rounded-full text-xs font-medium hover:bg-[#c8e40d] transition-colors"
                    aria-label={`Download ${logo.name}`}
                  >
                    <Download className="w-3 h-3 mr-1.5" />
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !fetchError && logos.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-zinc-700 rounded-xl">
            <FileImage className="mx-auto h-12 w-12 text-zinc-500" />
            <h3 className="mt-2 text-sm font-semibold text-zinc-300">No logos available</h3>
            <p className="mt-1 text-sm text-zinc-500">There are currently no logos available for download.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PressLogosPage; 