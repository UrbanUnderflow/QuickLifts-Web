import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState, useCallback } from 'react';
import { firebaseStorageService, UploadResult, UploadImageType } from '../../api/firebase/storage/service'; // Adjust path as needed
import { ArrowUpRight, Upload, X } from 'lucide-react';
import { useScrollFade } from '../../hooks/useScrollFade';
// import Header from '../../components/Header'; // Assuming you might want a header
import Footer from '../../components/Footer/Footer';

// Define specific types for press assets if needed, or use a generic approach
const PRESS_ASSET_BASE_PATH = 'press_assets/founder'; 

const PressUploadPage: NextPage = () => {
  // --- State for Founder Bio Assets ---
  const [founderLandscapeImageUrl, setFounderLandscapeImageUrl] = useState<string | null>(null);
  const [founderPortrait1ImageUrl, setFounderPortrait1ImageUrl] = useState<string | null>(null);
  const [founderPortrait2ImageUrl, setFounderPortrait2ImageUrl] = useState<string | null>(null);
  const [founderBioPdfUrl, setFounderBioPdfUrl] = useState<string | null>(null);
  
  const [isUploadingLandscape, setIsUploadingLandscape] = useState(false);
  const [isUploadingPortrait1, setIsUploadingPortrait1] = useState(false);
  const [isUploadingPortrait2, setIsUploadingPortrait2] = useState(false);
  const [isUploadingBioPdf, setIsUploadingBioPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // --- Drag & Drop Handlers ---
  const [dragActiveMap, setDragActiveMap] = useState<Record<string, boolean>>({
    landscape: false,
    portrait1: false,
    portrait2: false,
    bioPdf: false
  });

  const handleDrag = useCallback((e: React.DragEvent, assetType: string, isDragActive: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveMap(prev => ({...prev, [assetType]: isDragActive}));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, assetType: 'landscape' | 'portrait1' | 'portrait2' | 'bioPdf') => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveMap(prev => ({...prev, [assetType]: false}));
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file, assetType);
    }
  }, []);

  // --- Upload Handler ---
  const handleFileUpload = async (
    file: File,
    assetType: 'landscape' | 'portrait1' | 'portrait2' | 'bioPdf'
  ) => {
    setUploadError(null); // Clear previous errors

    // Determine storage path and update state function based on asset type
    let setUploading: React.Dispatch<React.SetStateAction<boolean>>;
    let setUrl: React.Dispatch<React.SetStateAction<string | null>>;
    let storagePath: string;
    let expectedFileType: 'image' | 'pdf';

    switch (assetType) {
      case 'landscape':
        setUploading = setIsUploadingLandscape;
        setUrl = setFounderLandscapeImageUrl;
        storagePath = `${PRESS_ASSET_BASE_PATH}/landscape.${file.name.split('.').pop()}`; // Use original extension
        expectedFileType = 'image';
        break;
      case 'portrait1':
        setUploading = setIsUploadingPortrait1;
        setUrl = setFounderPortrait1ImageUrl;
        storagePath = `${PRESS_ASSET_BASE_PATH}/portrait1.${file.name.split('.').pop()}`;
        expectedFileType = 'image';
        break;
      case 'portrait2':
        setUploading = setIsUploadingPortrait2;
        setUrl = setFounderPortrait2ImageUrl;
        storagePath = `${PRESS_ASSET_BASE_PATH}/portrait2.${file.name.split('.').pop()}`;
        expectedFileType = 'image';
        break;
      case 'bioPdf':
        setUploading = setIsUploadingBioPdf;
        setUrl = setFounderBioPdfUrl;
        storagePath = `${PRESS_ASSET_BASE_PATH}/bio.pdf`; // Fixed name for PDF
        expectedFileType = 'pdf';
        break;
      default:
        console.error('Invalid asset type');
        return;
    }
    
    // Basic File Type Validation
    if (expectedFileType === 'image' && !file.type.startsWith('image/')) {
      setUploadError(`Invalid file type for ${assetType}. Please upload an image.`);
      return;
    }
    if (expectedFileType === 'pdf' && file.type !== 'application/pdf') {
      setUploadError(`Invalid file type for ${assetType}. Please upload a PDF.`);
      return;
    }

    setUploading(true);
    setUrl(null); // Clear previous URL while uploading

    try {
      // --- TODO: Adapt FirebaseStorageService ---
      // The current `uploadImage` is tied to user profiles and enums.
      // We need a generic function like `uploadFileToPath(file: File, path: string): Promise<UploadResult>`
      // For now, let's simulate the upload and set a placeholder URL.
      console.log(`Simulating upload of ${file.name} to ${storagePath}`);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate upload delay
      const simulatedResult: UploadResult = { 
        downloadURL: `/placeholder/${assetType}_url_${Date.now()}`, 
        gsURL: `gs://your-bucket/${storagePath}` 
      };
      // --- End of TODO ---

      // const result = await firebaseStorageService.uploadFileToPath(file, storagePath); // Replace simulation
      const result = simulatedResult; // Use simulation result for now
      setUrl(result.downloadURL);
      console.log(`Upload successful for ${assetType}:`, result.downloadURL);

    } catch (error) {
      console.error(`Upload failed for ${assetType}:`, error);
      setUploadError(`Upload failed for ${assetType}. Please try again.`);
      setUrl(null); // Clear URL on error
    } finally {
      setUploading(false);
    }
  };

  // Handle input change (when file is selected via input element)
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>, assetType: 'landscape' | 'portrait1' | 'portrait2' | 'bioPdf') => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    const file = event.target.files[0];
    handleFileUpload(file, assetType);
  };

  // --- Main Form Submit Handler (Placeholder) ---
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Handle overall form submission (e.g., save URLs in DB)
    console.log('Form submitted with URLs:', {
      founderLandscapeImageUrl,
      founderPortrait1ImageUrl,
      founderPortrait2ImageUrl,
      founderBioPdfUrl
    });
    // TODO: Add logic to save these URLs to Firestore or your backend
  };

  // --- Helper to render drop zone ---
  const renderDropZone = (
    label: string,
    assetType: 'landscape' | 'portrait1' | 'portrait2' | 'bioPdf',
    currentUrl: string | null,
    isUploading: boolean,
    accept: string, // e.g., "image/*", "application/pdf"
    aspectRatio: string = "aspect-square" // CSS class for aspect ratio
  ) => {
    const isDragActive = dragActiveMap[assetType];
    
    // Determine which setter function to use based on asset type
    let setUrl: React.Dispatch<React.SetStateAction<string | null>>;
    switch (assetType) {
      case 'landscape':
        setUrl = setFounderLandscapeImageUrl;
        break;
      case 'portrait1':
        setUrl = setFounderPortrait1ImageUrl;
        break;
      case 'portrait2':
        setUrl = setFounderPortrait2ImageUrl;
        break;
      case 'bioPdf':
        setUrl = setFounderBioPdfUrl;
        break;
    }
    
    return (
      <div className="mb-6">
        <label className="block text-white text-lg font-medium mb-2">{label}</label>
        <div 
          className={`${aspectRatio} relative rounded-xl overflow-hidden border-2 ${
            isDragActive 
              ? "border-[#E0FE10] bg-[#E0FE10]/10" 
              : currentUrl 
                ? "border-zinc-700 hover:border-[#E0FE10]/50" 
                : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
          } transition-all duration-300 group`}
          onDragEnter={(e) => handleDrag(e, assetType, true)}
          onDragLeave={(e) => handleDrag(e, assetType, false)}
          onDragOver={(e) => handleDrag(e, assetType, true)}
          onDrop={(e) => handleDrop(e, assetType)}
        >
          {/* Hidden file input */}
          <input
            type="file"
            id={`file-${assetType}`}
            accept={accept}
            onChange={(e) => handleInputChange(e, assetType)}
            className="hidden"
            disabled={isUploading}
          />
          
          {/* If there's a current image/file */}
          {currentUrl && !isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {accept.startsWith('image') ? (
                <div className="w-full h-full relative">
                  <img 
                    src={currentUrl} 
                    alt={`${label}`} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                    <button 
                      onClick={() => document.getElementById(`file-${assetType}`)?.click()}
                      className="mb-2 px-4 py-2 bg-[#E0FE10] text-black rounded-full font-medium text-sm hover:bg-[#c8e40d] transition-colors"
                    >
                      Replace
                    </button>
                    <button 
                      onClick={() => setUrl(null)}
                      className="px-4 py-2 bg-zinc-800 text-white rounded-full font-medium text-sm hover:bg-zinc-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-center p-4">
                  <div className="mb-4 w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <line x1="10" y1="9" x2="8" y2="9"></line>
                    </svg>
                  </div>
                  <p className="text-white font-medium text-lg truncate max-w-full">PDF Uploaded</p>
                  <p className="text-zinc-400 text-sm mb-4">{currentUrl.split('/').pop()}</p>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                    <button 
                      onClick={() => document.getElementById(`file-${assetType}`)?.click()}
                      className="mb-2 px-4 py-2 bg-[#E0FE10] text-black rounded-full font-medium text-sm hover:bg-[#c8e40d] transition-colors"
                    >
                      Replace
                    </button>
                    <button 
                      onClick={() => setUrl(null)}
                      className="px-4 py-2 bg-zinc-800 text-white rounded-full font-medium text-sm hover:bg-zinc-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Upload state */}
          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
              <div className="w-12 h-12 rounded-full border-4 border-[#E0FE10]/20 border-t-[#E0FE10] animate-spin mb-2"></div>
              <p className="text-[#E0FE10] font-medium">Uploading...</p>
            </div>
          )}
          
          {/* Empty state */}
          {!currentUrl && !isUploading && (
            <label 
              htmlFor={`file-${assetType}`}
              className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-2">
                <Upload className="w-6 h-6 text-[#E0FE10]" />
              </div>
              {isDragActive ? (
                <p className="text-[#E0FE10] font-medium">Drop to upload</p>
              ) : (
                <>
                  <p className="text-white font-medium">Upload {accept.startsWith('image') ? 'Image' : 'PDF'}</p>
                  <p className="text-zinc-400 text-sm mt-1">Drag & drop or click to browse</p>
                </>
              )}
            </label>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>Upload Press Kit Assets - Pulse</title>
        <meta name="description" content="Upload and manage assets for the Pulse press kit." />
      </Head>

      {/* Hero Section */}
      <section ref={useScrollFade()} className="relative py-16 flex flex-col items-center justify-center text-center px-8 overflow-hidden animate-gradient-background">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-zinc-900"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 opacity-40"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-1000"></div>
        </div>
        
        {/* Animated grid pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[url('/grid-pattern.svg')] bg-repeat"></div>
        </div>

        {/* Content */}
        <div className="relative z-20 max-w-4xl mx-auto">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer animate-fade-in-up animation-delay-300">
            Media Management
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-8 animate-fade-in-up animation-delay-600">
            Upload Press Kit Assets
          </h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 animate-fade-in-up animation-delay-900">
            Update media assets and downloads for the press kit
          </p>
        </div>
      </section>

      <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Founder Bio Section */}
          <section ref={useScrollFade()} className="py-12 bg-zinc-950 rounded-2xl p-8">
            <div className="flex flex-col lg:flex-row gap-16 items-start">
              <div className="lg:w-1/2 order-2 lg:order-1">
                <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                  Founder Bio & Photos
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
                </h2>
                <h3 className="text-white text-4xl font-bold mb-8">Update Media</h3>
                
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-all duration-300">
                  <h4 className="text-white text-xl font-semibold mb-6">Downloadable Assets</h4>
                  
                  <div className="space-y-6">
                    {/* PDF Upload */}
                    {renderDropZone(
                      "Full Bio & Photos PDF", 
                      "bioPdf", 
                      founderBioPdfUrl, 
                      isUploadingBioPdf, 
                      "application/pdf",
                      "aspect-[4/3]"
                    )}
                  </div>
                </div>
              </div>
              
              <div className="lg:w-1/2 order-1 lg:order-2">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    {renderDropZone(
                      "Landscape Image", 
                      "landscape", 
                      founderLandscapeImageUrl, 
                      isUploadingLandscape, 
                      "image/*",
                      "aspect-[4/3]"
                    )}
                  </div>
                  <div>
                    {renderDropZone(
                      "Portrait Image 1", 
                      "portrait1", 
                      founderPortrait1ImageUrl, 
                      isUploadingPortrait1, 
                      "image/*",
                      "aspect-[3/4]"
                    )}
                  </div>
                  <div>
                    {renderDropZone(
                      "Portrait Image 2", 
                      "portrait2", 
                      founderPortrait2ImageUrl, 
                      isUploadingPortrait2, 
                      "image/*",
                      "aspect-[3/4]"
                    )}
                  </div>
                </div>
                {uploadError && (
                  <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200">
                    <p className="flex items-center">
                      <X className="w-5 h-5 mr-2" /> {uploadError}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Other content sections (placeholders) */}
          <section ref={useScrollFade()} className="py-12 bg-black rounded-2xl p-8">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Media Assets
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-8">Visual Resources</h3>
            
            <p className="text-zinc-400 mb-8">Update logos, screenshots, product photos, and other media assets for the press kit.</p>
            
            {/* Placeholder for future implementation */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500">Media asset management coming soon</p>
            </div>
          </section>
          
          {/* Save Button */}
          <div className="text-center">
            <button 
              type="submit" 
              className="px-8 py-4 bg-[#E0FE10] hover:bg-[#c8e40d] text-black font-medium rounded-lg transition-colors duration-300 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isUploadingLandscape || isUploadingPortrait1 || isUploadingPortrait2 || isUploadingBioPdf}
            >
              Save All Changes
            </button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
};

export default PressUploadPage; 