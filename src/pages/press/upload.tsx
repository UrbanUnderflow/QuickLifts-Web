import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState, useCallback } from 'react';
import { firebaseStorageService, UploadResult, UploadImageType } from '../../api/firebase/storage/service'; // Adjust path as needed
import { ArrowUpRight, Upload, X, FileText, File, FileImage } from 'lucide-react';
import { useScrollFade } from '../../hooks/useScrollFade';
// import Header from '../../components/Header'; // Assuming you might want a header
import Footer from '../../components/Footer/Footer';

// Define specific types for press assets if needed, or use a generic approach
// Group assets by section for better organization
const PRESS_ASSET_PATHS = {
  overview: 'press_assets/overview',
  founder: 'press_assets/founder',
  product: 'press_assets/product',
  media: 'press_assets/media', // Base path for general media assets
  logos: 'press_assets/logos', // Added logo path
  factSheet: 'press_assets/fact_sheet',
  talkingPoints: 'press_assets/talking_points',
  completeKit: 'press_assets/complete_kit'
};

type AssetType = 
  | 'overviewPdf'
  | 'founderLandscape' 
  | 'founderPortrait1' 
  | 'founderPortrait2' 
  | 'founderBioPdf'
  | 'productOnePagerPdf'
  | 'factCheckSheetPdf'
  | 'talkingPointsFaqsPdf'
  | 'completeKitZip'
  // Logo Types
  | 'logoSigSvg'
  | 'logoSigPng'
  | 'logoWhiteSvg'
  | 'logoWhitePng'
  | 'logoBlackSvg'
  | 'logoBlackPng'
  | 'logoGreenSvg'
  | 'logoGreenPng';
  // Add specific media asset types later if needed (e.g., 'logoSvg', 'screenshot1')

const PressUploadPage: NextPage = () => {
  // --- State for Assets ---
  const [assetUrls, setAssetUrls] = useState<Record<AssetType, string | null>>({
    overviewPdf: null,
    founderLandscape: null,
    founderPortrait1: null,
    founderPortrait2: null,
    founderBioPdf: null,
    productOnePagerPdf: null,
    factCheckSheetPdf: null,
    talkingPointsFaqsPdf: null,
    completeKitZip: null,
    // Logos Initial State
    logoSigSvg: null,
    logoSigPng: null,
    logoWhiteSvg: null,
    logoWhitePng: null,
    logoBlackSvg: null,
    logoBlackPng: null,
    logoGreenSvg: null,
    logoGreenPng: null,
  });

  const [isUploading, setIsUploading] = useState<Record<AssetType, boolean>>({
    overviewPdf: false,
    founderLandscape: false,
    founderPortrait1: false,
    founderPortrait2: false,
    founderBioPdf: false,
    productOnePagerPdf: false,
    factCheckSheetPdf: false,
    talkingPointsFaqsPdf: false,
    completeKitZip: false,
    // Logos Initial State
    logoSigSvg: false,
    logoSigPng: false,
    logoWhiteSvg: false,
    logoWhitePng: false,
    logoBlackSvg: false,
    logoBlackPng: false,
    logoGreenSvg: false,
    logoGreenPng: false,
  });
  
  const [uploadError, setUploadError] = useState<string | null>(null);

  // --- Drag & Drop Handlers ---
  const [dragActiveMap, setDragActiveMap] = useState<Record<string, boolean>>({
    overviewPdf: false,
    founderLandscape: false,
    founderPortrait1: false,
    founderPortrait2: false,
    founderBioPdf: false,
    productOnePagerPdf: false,
    factCheckSheetPdf: false,
    talkingPointsFaqsPdf: false,
    completeKitZip: false,
    // Logos Initial State
    logoSigSvg: false,
    logoSigPng: false,
    logoWhiteSvg: false,
    logoWhitePng: false,
    logoBlackSvg: false,
    logoBlackPng: false,
    logoGreenSvg: false,
    logoGreenPng: false,
  });

  const handleDrag = useCallback((e: React.DragEvent, assetType: string, isDragActive: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveMap(prev => ({...prev, [assetType]: isDragActive}));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, assetType: AssetType) => {
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
    assetType: AssetType
  ) => {
    setUploadError(null); // Clear previous errors

    // Determine storage path and update state function based on asset type
    let storagePath: string;
    let expectedFileType: 'image' | 'pdf' | 'zip';
    let allowedMimeTypes: string[] = []; // For more specific validation

    switch (assetType) {
      // Overview
      case 'overviewPdf':
        storagePath = `${PRESS_ASSET_PATHS.overview}/overview.pdf`;
        expectedFileType = 'pdf';
        allowedMimeTypes = ['application/pdf'];
        break;
      // Founder
      case 'founderLandscape':
        storagePath = `${PRESS_ASSET_PATHS.founder}/landscape.${file.name.split('.').pop()}`; // Use original extension
        expectedFileType = 'image';
        // Allow common image types
        allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        break;
      case 'founderPortrait1':
        storagePath = `${PRESS_ASSET_PATHS.founder}/portrait1.${file.name.split('.').pop()}`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        break;
      case 'founderPortrait2':
        storagePath = `${PRESS_ASSET_PATHS.founder}/portrait2.${file.name.split('.').pop()}`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        break;
      case 'founderBioPdf':
        storagePath = `${PRESS_ASSET_PATHS.founder}/bio.pdf`;
        expectedFileType = 'pdf';
        allowedMimeTypes = ['application/pdf'];
        break;
      // Product
      case 'productOnePagerPdf':
        storagePath = `${PRESS_ASSET_PATHS.product}/one-pager.pdf`;
        expectedFileType = 'pdf';
        allowedMimeTypes = ['application/pdf'];
        break;
      // Logos
      case 'logoSigSvg':
        storagePath = `${PRESS_ASSET_PATHS.logos}/signature.svg`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/svg+xml'];
        break;
      case 'logoSigPng':
        storagePath = `${PRESS_ASSET_PATHS.logos}/signature.png`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/png'];
        break;
      case 'logoWhiteSvg':
        storagePath = `${PRESS_ASSET_PATHS.logos}/white.svg`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/svg+xml'];
        break;
      case 'logoWhitePng':
        storagePath = `${PRESS_ASSET_PATHS.logos}/white.png`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/png'];
        break;
      case 'logoBlackSvg':
        storagePath = `${PRESS_ASSET_PATHS.logos}/black.svg`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/svg+xml'];
        break;
      case 'logoBlackPng':
        storagePath = `${PRESS_ASSET_PATHS.logos}/black.png`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/png'];
        break;
      case 'logoGreenSvg':
        storagePath = `${PRESS_ASSET_PATHS.logos}/green.svg`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/svg+xml'];
        break;
      case 'logoGreenPng':
        storagePath = `${PRESS_ASSET_PATHS.logos}/green.png`;
        expectedFileType = 'image';
        allowedMimeTypes = ['image/png'];
        break;
      // Fact Sheet
      case 'factCheckSheetPdf':
        storagePath = `${PRESS_ASSET_PATHS.factSheet}/fact-sheet.pdf`;
        allowedMimeTypes = ['application/pdf'];
        break;
      // Talking Points
      case 'talkingPointsFaqsPdf':
        storagePath = `${PRESS_ASSET_PATHS.talkingPoints}/talking-points-faq.pdf`;
        allowedMimeTypes = ['application/pdf'];
        break;
      // Complete Kit
      case 'completeKitZip':
        storagePath = `${PRESS_ASSET_PATHS.completeKit}/press-kit.zip`;
        expectedFileType = 'zip';
        allowedMimeTypes = ['application/zip', 'application/x-zip-compressed'];
        break;
      default:
        console.error('Invalid asset type');
        return;
    }
    
    // File Type Validation using allowedMimeTypes
    if (!allowedMimeTypes.includes(file.type)) {
      setUploadError(`Invalid file type for ${labelForAssetType(assetType)}. Expected: ${allowedMimeTypes.join(', ')}. Received: ${file.type || 'unknown'}`);
      return;
    }

    setIsUploading(prev => ({ ...prev, [assetType]: true }));
    setAssetUrls(prev => ({ ...prev, [assetType]: null })); // Clear previous URL

    try {
      // --- TODO: Adapt FirebaseStorageService ---
      console.log(`Simulating upload of ${file.name} to ${storagePath}`);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate upload delay
      const simulatedResult: UploadResult = { 
        downloadURL: `/placeholder/${assetType}_url_${Date.now()}`, 
        gsURL: `gs://your-bucket/${storagePath}` 
      };
      // --- End of TODO ---

      const result = simulatedResult; // Use simulation result for now
      setAssetUrls(prev => ({ ...prev, [assetType]: result.downloadURL }));
      console.log(`Upload successful for ${assetType}:`, result.downloadURL);

    } catch (error) {
      console.error(`Upload failed for ${assetType}:`, error);
      setUploadError(`Upload failed for ${assetType}. Please try again.`);
      setAssetUrls(prev => ({ ...prev, [assetType]: null })); // Clear URL on error
    } finally {
      setIsUploading(prev => ({ ...prev, [assetType]: false }));
    }
  };

  // Handle input change (when file is selected via input element)
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>, assetType: AssetType) => {
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
    console.log('Form submitted with URLs:', assetUrls);
    // TODO: Add logic to save these URLs to Firestore or your backend
  };

  // --- Helper to get readable label ---
  const labelForAssetType = (assetType: AssetType): string => {
    switch (assetType) {
      case 'overviewPdf': return 'Overview PDF';
      case 'founderLandscape': return 'Founder Landscape Image';
      case 'founderPortrait1': return 'Founder Portrait Image 1';
      case 'founderPortrait2': return 'Founder Portrait Image 2';
      case 'founderBioPdf': return 'Founder Bio PDF';
      case 'productOnePagerPdf': return 'Product One-Pager PDF';
      case 'factCheckSheetPdf': return 'Fact-Check Sheet PDF';
      case 'talkingPointsFaqsPdf': return 'Talking Points & FAQs PDF';
      case 'completeKitZip': return 'Complete Kit ZIP';
      case 'logoSigSvg': return 'Signature Logo (SVG)';
      case 'logoSigPng': return 'Signature Logo (PNG)';
      case 'logoWhiteSvg': return 'White Logo (SVG)';
      case 'logoWhitePng': return 'White Logo (PNG)';
      case 'logoBlackSvg': return 'Black Logo (SVG)';
      case 'logoBlackPng': return 'Black Logo (PNG)';
      case 'logoGreenSvg': return 'Green Logo (SVG)';
      case 'logoGreenPng': return 'Green Logo (PNG)';
      default: return 'Asset';
    }
  };

  // --- Helper to render drop zone ---
  const renderDropZone = (
    label: string, // Now just the base label
    assetType: AssetType,
    accept: string, // e.g., "image/*", "application/pdf", "application/zip"
    aspectRatio: string = "aspect-square" // CSS class for aspect ratio
  ) => {
    const currentUrl = assetUrls[assetType];
    const isLoading = isUploading[assetType];
    const isDragActive = dragActiveMap[assetType];
    const fullLabel = labelForAssetType(assetType); // Get the full label

    const setUrl = (url: string | null) => {
      setAssetUrls(prev => ({...prev, [assetType]: url}));
    };
    
    return (
      <div className="mb-6">
        <label className="block text-white text-sm font-medium mb-2">{fullLabel}</label>
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
            disabled={isLoading}
          />
          
          {/* If there's a current image/file */}
          {currentUrl && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {accept.startsWith('image') ? (
                // Image Preview
                <div className="w-full h-full relative">
                  <img 
                    src={currentUrl} 
                    alt={`${fullLabel}`} 
                    className="w-full h-full object-contain p-4"
                  />
                  {/* Hover overlay for image */}
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
              ) : (accept === 'application/pdf') ? (
                // PDF Preview
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-center p-4">
                  <div className="mb-4 w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[#E0FE10]" /> 
                  </div>
                  <p className="text-white font-medium text-lg truncate max-w-full">PDF Uploaded</p>
                  <p className="text-zinc-400 text-sm mb-4">{currentUrl.split('/').pop()?.split('_url_')[0] || 'file.pdf'}</p>
                  {/* Hover overlay for PDF */}
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
                 // ZIP Preview (or other file types)
                 <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-center p-4">
                  <div className="mb-4 w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center">
                    <File className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <p className="text-white font-medium text-lg truncate max-w-full">ZIP Uploaded</p>
                  <p className="text-zinc-400 text-sm mb-4">{currentUrl.split('/').pop()?.split('_url_')[0] || 'file.zip'}</p>
                  {/* Hover overlay for ZIP */}
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
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
              <div className="w-12 h-12 rounded-full border-4 border-[#E0FE10]/20 border-t-[#E0FE10] animate-spin mb-2"></div>
              <p className="text-[#E0FE10] font-medium">Uploading...</p>
            </div>
          )}
          
          {/* Empty state */}
          {!currentUrl && !isLoading && (
            <label 
              htmlFor={`file-${assetType}`}
              className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-2">
                 {accept.startsWith('image') ? <FileImage className="w-6 h-6 text-[#E0FE10]" /> : 
                 accept === 'application/pdf' ? <FileText className="w-6 h-6 text-[#E0FE10]" /> : 
                 <File className="w-6 h-6 text-[#E0FE10]" />}
              </div>
              {isDragActive ? (
                <p className="text-[#E0FE10] font-medium">Drop to upload</p>
              ) : (
                <>
                  <p className="text-white font-medium">
                    Upload {accept === 'application/pdf' ? 'PDF' :
                           accept === 'application/zip' ? 'ZIP' :
                           accept === 'image/svg+xml' ? 'SVG' :
                           accept === 'image/png' ? 'PNG' : 'Image'}
                  </p>
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
          
          {/* Overview Section */}
          <section ref={useScrollFade()} className="py-12 bg-zinc-950 rounded-2xl p-8">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Overview
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-8">The 30-second pitch</h3>
            
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-all duration-300">
              <h4 className="text-white text-xl font-semibold mb-6">Downloadable Overview PDF</h4>
              {renderDropZone(
                "Full Overview PDF", 
                'overviewPdf',
                "application/pdf",
                "aspect-[4/3]"
              )}
            </div>
          </section>

          {/* Founder Bio Section */}
          <section ref={useScrollFade()} className="py-12 bg-black rounded-2xl p-8">
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
                      'founderBioPdf', 
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
                      'founderLandscape', 
                      "image/*",
                      "aspect-[4/3]"
                    )}
                  </div>
                  <div>
                    {renderDropZone(
                      "Portrait Image 1", 
                      'founderPortrait1', 
                      "image/*",
                      "aspect-[3/4]"
                    )}
                  </div>
                  <div>
                    {renderDropZone(
                      "Portrait Image 2", 
                      'founderPortrait2', 
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

          {/* Product One-Pager Section */}
          <section ref={useScrollFade()} className="py-12 bg-zinc-950 rounded-2xl p-8">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Product One-Pager
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-8">How Pulse Works</h3>
            
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-all duration-300">
              <h4 className="text-white text-xl font-semibold mb-6">Downloadable Product Overview PDF</h4>
              {renderDropZone(
                "Full Product Overview PDF", 
                'productOnePagerPdf',
                "application/pdf",
                "aspect-[4/3]"
              )}
            </div>
          </section>
          
          {/* Media Assets Section (Placeholder Structure) */}
          <section ref={useScrollFade()} className="py-12 bg-black rounded-2xl p-8">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Media Assets
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-8">Visual Resources</h3>
            
            <p className="text-zinc-400 mb-8">Update logos, screenshots, product photos, and other media assets for the press kit. (Detailed management coming soon)</p>
            
            {/* Placeholder for future implementation */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {['Logos', 'App Screenshots', 'App GIFs', 'B-Roll Video', 'Brand Guidelines', 'Press Releases'].map(item => (
                <div key={item} className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-8 text-center">
                  <p className="text-white font-medium mb-2">{item}</p>
                  <p className="text-zinc-500 text-sm">Management coming soon</p>
                </div>
              ))}
            </div>
          </section>
          
          {/* Fact-Check Sheet Section */}
          <section ref={useScrollFade()} className="py-12 bg-zinc-950 rounded-2xl p-8">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Fact-Check Sheet
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-8">Get Your Facts Straight</h3>
            
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-all duration-300">
              <h4 className="text-white text-xl font-semibold mb-6">Downloadable Fact Sheet PDF</h4>
              {renderDropZone(
                "Complete Fact-Check Sheet PDF", 
                'factCheckSheetPdf',
                "application/pdf",
                "aspect-[4/3]"
              )}
            </div>
          </section>
          
          {/* Talking Points & FAQs Section */}
          <section ref={useScrollFade()} className="py-12 bg-black rounded-2xl p-8">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Talking Points & FAQs
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-8">Key Messages & Questions</h3>
            
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-all duration-300">
              <h4 className="text-white text-xl font-semibold mb-6">Downloadable Talking Points & FAQs PDF</h4>
              {renderDropZone(
                "Complete Talking Points & FAQs PDF", 
                'talkingPointsFaqsPdf',
                "application/pdf",
                "aspect-[4/3]"
              )}
            </div>
          </section>
          
          {/* Complete Kit Download Section */}
          <section ref={useScrollFade()} className="py-12 bg-zinc-950 rounded-2xl p-8">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Complete Kit Download
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-8">All-in-One Package</h3>
            
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-all duration-300">
              <h4 className="text-white text-xl font-semibold mb-6">Downloadable Complete Kit ZIP</h4>
              {renderDropZone(
                "Complete Press Kit (.zip)", 
                'completeKitZip',
                "application/zip",
                "aspect-[4/3]"
              )}
            </div>
          </section>
          
          {/* Logo Assets Section */}
          <section ref={useScrollFade()} className="py-12 bg-black rounded-2xl p-8">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Logo Assets
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-8">Upload Brand Logos</h3>
            <p className="text-zinc-400 mb-8">Upload SVG and PNG versions for each required logo style.</p>

            {/* Logo Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
              {/* Signature */}
              {renderDropZone("Signature Logo", 'logoSigSvg', "image/svg+xml")}
              {renderDropZone("Signature Logo", 'logoSigPng', "image/png")}
              {/* White */}
              {renderDropZone("White Logo", 'logoWhiteSvg', "image/svg+xml")}
              {renderDropZone("White Logo", 'logoWhitePng', "image/png")}
              {/* Black */}
              {renderDropZone("Black Logo", 'logoBlackSvg', "image/svg+xml")}
              {renderDropZone("Black Logo", 'logoBlackPng', "image/png")}
              {/* Green */}
              {renderDropZone("Green Logo", 'logoGreenSvg', "image/svg+xml")}
              {renderDropZone("Green Logo", 'logoGreenPng', "image/png")}
            </div>
            {uploadError && (
              <div className="mt-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200">
                <p className="flex items-center">
                  <X className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span>{uploadError}</span>
                </p>
              </div>
            )}
          </section>
          
          {/* Save Button */}
          <div className="text-center py-8">
            <button 
              type="submit" 
              className="px-8 py-4 bg-[#E0FE10] hover:bg-[#c8e40d] text-black font-medium rounded-lg transition-colors duration-300 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={Object.values(isUploading).some(status => status)}
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