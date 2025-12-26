import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState, useCallback, useEffect } from 'react';
import { firebaseStorageService, UploadResult, UploadImageType } from '../../api/firebase/storage/service'; // Adjust path as needed
import { doc, setDoc, getDoc } from 'firebase/firestore'; // Added Firestore imports
import { auth, db } from '../../api/firebase/config'; // Added auth/db import
import { ArrowUpRight, Upload, X, FileText, File, FileImage, PlusCircle, Trash2 } from 'lucide-react';
import { useScrollFade } from '../../hooks/useScrollFade';
// import Header from '../../components/Header'; // Assuming you might want a header
import Footer from '../../components/Footer/Footer';

// Define categories based on user request from app-screenshots.tsx
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

// Dynamically create AssetType entries for screenshots
type ScreenshotAssetType = `appScreenshot_${keyof typeof screenshotCategories}_${1 | 2 | 3}`;

// Group assets by section for better organization
const PRESS_ASSET_PATHS = {
  overview: 'press_assets/overview',
  founder: 'press_assets/founder',
  product: 'press_assets/product',
  media: 'press_assets/media', // Base path for general media assets
  logos: 'press_assets/logos',
  appScreenshots: 'press_assets/app_screenshots', // Added for screenshots
  videos: 'press_assets/videos', // Added for videos
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
  | 'logoGreenPng'
  // Screenshot Types
  | ScreenshotAssetType
  // New Logo Types
  | 'logoWatermarkSvg'
  | 'logoWatermarkPng'
  | 'logoWordmarkSvg'
  | 'logoWordmarkPng'
  | 'logoApparelSvg'
  | 'logoApparelPng'
  // New Apparel Logo Types
  | 'logoApparelGreenSvg'
  | 'logoApparelGreenPng'
  | 'logoApparelWhiteSvg'
  | 'logoApparelWhitePng'
  | 'logoWordmarkWhiteSvg'
  | 'logoWordmarkWhitePng';

const videoCategories: { [key: string]: string } = {
  appDemos: "App Demos",
  commercialFootage: "Commercial Footage",
};

interface UploadableVideoAsset {
  id: string; 
  name: string;
  videoFile?: File;
  videoUrl?: string | null;
  isUploadingVideo?: boolean;
  thumbFile?: File;
  thumbUrl?: string | null;
  isUploadingThumb?: boolean;
}

const PressUploadPage: NextPage = () => {
  // --- State for Assets ---
  const initialAssetUrls: Record<AssetType, string | null> = {
    overviewPdf: null,
    founderLandscape: null,
    founderPortrait1: null,
    founderPortrait2: null,
    founderBioPdf: null,
    productOnePagerPdf: null,
    factCheckSheetPdf: null,
    talkingPointsFaqsPdf: null,
    completeKitZip: null,
    logoSigSvg: null,
    logoSigPng: null,
    logoWhiteSvg: null,
    logoWhitePng: null,
    logoBlackSvg: null,
    logoBlackPng: null,
    logoGreenSvg: null,
    logoGreenPng: null,
    logoWatermarkSvg: null,
    logoWatermarkPng: null,
    logoWordmarkSvg: null,
    logoWordmarkPng: null,
    logoApparelSvg: null,
    logoApparelPng: null,
    logoApparelGreenSvg: null,
    logoApparelGreenPng: null,
    logoApparelWhiteSvg: null,
    logoApparelWhitePng: null,
    logoWordmarkWhiteSvg: null,
    logoWordmarkWhitePng: null,
  };

  const initialIsUploading: Record<AssetType, boolean> = {
    overviewPdf: false,
    founderLandscape: false,
    founderPortrait1: false,
    founderPortrait2: false,
    founderBioPdf: false,
    productOnePagerPdf: false,
    factCheckSheetPdf: false,
    talkingPointsFaqsPdf: false,
    completeKitZip: false,
    logoSigSvg: false,
    logoSigPng: false,
    logoWhiteSvg: false,
    logoWhitePng: false,
    logoBlackSvg: false,
    logoBlackPng: false,
    logoGreenSvg: false,
    logoGreenPng: false,
    logoWatermarkSvg: false,
    logoWatermarkPng: false,
    logoWordmarkSvg: false,
    logoWordmarkPng: false,
    logoApparelSvg: false,
    logoApparelPng: false,
    logoApparelGreenSvg: false,
    logoApparelGreenPng: false,
    logoApparelWhiteSvg: false,
    logoApparelWhitePng: false,
    logoWordmarkWhiteSvg: false,
    logoWordmarkWhitePng: false,
  };
  
  const initialDragActiveMap: Record<string, boolean> = { // string key for dragActiveMap
    overviewPdf: false,
    founderLandscape: false,
    founderPortrait1: false,
    founderPortrait2: false,
    founderBioPdf: false,
    productOnePagerPdf: false,
    factCheckSheetPdf: false,
    talkingPointsFaqsPdf: false,
    completeKitZip: false,
    logoSigSvg: false,
    logoSigPng: false,
    logoWhiteSvg: false,
    logoWhitePng: false,
    logoBlackSvg: false,
    logoBlackPng: false,
    logoGreenSvg: false,
    logoGreenPng: false,
    logoWatermarkSvg: false,
    logoWatermarkPng: false,
    logoWordmarkSvg: false,
    logoWordmarkPng: false,
    logoApparelSvg: false,
    logoApparelPng: false,
    logoApparelGreenSvg: false,
    logoApparelGreenPng: false,
    logoApparelWhiteSvg: false,
    logoApparelWhitePng: false,
    logoWordmarkWhiteSvg: false,
    logoWordmarkWhitePng: false,
  };

  // Populate initial states for screenshot assets
  Object.keys(screenshotCategories).forEach(categoryKey => {
    for (let i = 1; i <= 3; i++) {
      const assetTypeKey = `appScreenshot_${categoryKey}_${i}` as ScreenshotAssetType;
      initialAssetUrls[assetTypeKey] = null;
      initialIsUploading[assetTypeKey] = false;
      initialDragActiveMap[assetTypeKey] = false;
    }
  });

  const [assetUrls, setAssetUrls] = useState<Record<AssetType, string | null>>(initialAssetUrls);
  const [isUploading, setIsUploading] = useState<Record<AssetType, boolean>>(initialIsUploading);
  const [dragActiveMap, setDragActiveMap] = useState<Record<string, boolean>>(initialDragActiveMap);
  
  // New state for managing video assets
  const [videosByCategory, setVideosByCategory] = useState<Record<string, UploadableVideoAsset[]>>(() => {
    const initialState: Record<string, UploadableVideoAsset[]> = {};
    Object.keys(videoCategories).forEach(key => {
      initialState[key] = [];
    });
    return initialState;
  });

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false); // New state for save operation
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  type TabKey = 'general' | 'founder' | 'product' | 'visuals';
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'general', label: 'General Info' },
    { key: 'founder', label: 'Founder' },
    { key: 'product', label: 'Product & App' },
    { key: 'visuals', label: 'Branding' },
  ];

  // Fetch existing asset URLs on component mount
  useEffect(() => {
    const fetchExistingAssets = async () => {
      console.log("UPLOAD_PAGE - Attempting to fetch existing assets from Firestore...");
      try {
        const docRef = doc(db, "pressKitData", "liveAssets");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const existingAssets = docSnap.data() as Record<AssetType, string | null>; 
          // Create a new object that includes all keys from the initial assetUrls state,
          // ensuring that if Firestore has fewer keys, we don't lose any dropzones.
          const updatedUrls: Record<AssetType, string | null> = { ...assetUrls };
          for (const key in existingAssets) {
            if (Object.prototype.hasOwnProperty.call(updatedUrls, key)) {
              updatedUrls[key as AssetType] = existingAssets[key as AssetType];
            }
          }
          setAssetUrls(updatedUrls);
          console.log("UPLOAD_PAGE - Existing assets loaded into state:", updatedUrls);
        } else {
          console.log("UPLOAD_PAGE - No existing liveAssets document found. Starting with empty state.");
          // No need to do anything, assetUrls is already initialized to nulls
        }
      } catch (error) {
        console.error("UPLOAD_PAGE - Error fetching existing assets:", error);
        // Optionally set an error message to display to the user
        // setUploadError("Could not load existing asset data. Please check connection or try again.");
      }
      // We might want a loading state for this initial fetch as well, 
      // but for now, it will just populate when ready.
    };

    fetchExistingAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs once on mount

  // --- Drag & Drop Handlers ---
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

    // Guard: this page requires an authenticated Firebase user.
    // AuthWrapper should prompt via modal, but this prevents confusing console errors if the modal is closed.
    if (!auth.currentUser) {
      setUploadError('You must be signed in to upload press assets.');
      return;
    }

    // Determine storage path and update state function based on asset type
    let storagePath: string;
    let expectedFileType: 'image' | 'pdf' | 'zip';
    let allowedMimeTypes: string[] = []; // For more specific validation

    // Handle screenshot asset types dynamically
    if (assetType.startsWith('appScreenshot_')) {
      const parts = assetType.split('_'); // appScreenshot_categoryKey_index
      const categoryKey = parts[1];
      const imageIndex = parts[2];
      storagePath = `${PRESS_ASSET_PATHS.appScreenshots}/${categoryKey}/image_${imageIndex}.${file.name.split('.').pop()}`;
      expectedFileType = 'image';
      allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    } else {
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
        // New Logo Types
        case 'logoWatermarkSvg':
          storagePath = `${PRESS_ASSET_PATHS.logos}/watermark.svg`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/svg+xml'];
          break;
        case 'logoWatermarkPng':
          storagePath = `${PRESS_ASSET_PATHS.logos}/watermark.png`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/png'];
          break;
        case 'logoWordmarkSvg':
          storagePath = `${PRESS_ASSET_PATHS.logos}/wordmark.svg`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/svg+xml'];
          break;
        case 'logoWordmarkPng':
          storagePath = `${PRESS_ASSET_PATHS.logos}/wordmark.png`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/png'];
          break;
        case 'logoApparelSvg':
          storagePath = `${PRESS_ASSET_PATHS.logos}/apparel.svg`; // Storing under general logos path for now
          expectedFileType = 'image';
          allowedMimeTypes = ['image/svg+xml'];
          break;
        case 'logoApparelPng':
          storagePath = `${PRESS_ASSET_PATHS.logos}/apparel.png`; // Storing under general logos path for now
          expectedFileType = 'image';
          allowedMimeTypes = ['image/png'];
          break;
        // New Apparel Logo Types
        case 'logoApparelGreenSvg':
          storagePath = `${PRESS_ASSET_PATHS.logos}/apparel_green.svg`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/svg+xml'];
          break;
        case 'logoApparelGreenPng':
          storagePath = `${PRESS_ASSET_PATHS.logos}/apparel_green.png`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/png'];
          break;
        case 'logoApparelWhiteSvg':
          storagePath = `${PRESS_ASSET_PATHS.logos}/apparel_white.svg`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/svg+xml'];
          break;
        case 'logoApparelWhitePng':
          storagePath = `${PRESS_ASSET_PATHS.logos}/apparel_white.png`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/png'];
          break;
        case 'logoWordmarkWhiteSvg':
          storagePath = `${PRESS_ASSET_PATHS.logos}/wordmark_white.svg`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/svg+xml'];
          break;
        case 'logoWordmarkWhitePng':
          storagePath = `${PRESS_ASSET_PATHS.logos}/wordmark_white.png`;
          expectedFileType = 'image';
          allowedMimeTypes = ['image/png'];
          break;
        default:
          console.error('Invalid asset type');
          return;
      }
    }
    
    // File Type Validation using allowedMimeTypes
    if (!allowedMimeTypes.includes(file.type)) {
      setUploadError(`Invalid file type for ${labelForAssetType(assetType)}. Expected: ${allowedMimeTypes.join(', ')}. Received: ${file.type || 'unknown'}`);
      return;
    }

    setIsUploading(prev => ({ ...prev, [assetType]: true }));
    setAssetUrls(prev => ({ ...prev, [assetType]: null })); // Clear previous URL

    try {
      // --- Replace simulation with actual Firebase upload ---
      console.log(`Attempting to upload ${file.name} to Firebase Storage path: ${storagePath}`);
      
      const result = await firebaseStorageService.uploadFileToStorage(
        file, 
        storagePath,
        (progress) => {
          // You can use this progress value to update the UI if needed
          // For now, just logging it.
          // To avoid excessive logging, perhaps only log every 10% or so, or when it changes significantly.
          // console.log(`Upload progress for ${assetType}: ${Math.round(progress * 100)}%`);
        }
      );
      
      // --- End of Firebase upload code ---

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
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
    console.log('Attempting to save URLs to Firestore:', assetUrls);

    if (Object.values(assetUrls).every(url => url === null)) {
      setSaveErrorMessage("No assets have been uploaded yet. Please upload at least one asset before saving.");
      setIsSaving(false);
      return;
    }

    try {
      const docRef = doc(db, "pressKitData", "liveAssets");
      await setDoc(docRef, assetUrls);
      setSaveSuccessMessage("All asset URLs saved successfully to Firestore!");
      console.log('Asset URLs successfully saved to Firestore document pressKitData/liveAssets');
      // Optionally clear messages after a few seconds
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error saving asset URLs to Firestore:", error);
      setSaveErrorMessage("Failed to save asset URLs. Please try again. Check console for details.");
      // Optionally clear messages after a few seconds
      setTimeout(() => setSaveErrorMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Helper to get readable label ---
  const labelForAssetType = (assetType: AssetType): string => {
    if (assetType.startsWith('appScreenshot_')) {
      const parts = assetType.split('_');
      const categoryKey = parts[1] as keyof typeof screenshotCategories;
      const imageIndex = parts[2];
      const categoryLabel = screenshotCategories[categoryKey] || categoryKey; // Fallback to key if label not found
      return `${categoryLabel} Screenshot ${imageIndex}`;
    }
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
      case 'logoWatermarkSvg': return 'Watermark Logo (SVG)';
      case 'logoWatermarkPng': return 'Watermark Logo (PNG)';
      case 'logoWordmarkSvg': return 'Wordmark Logo (SVG)';
      case 'logoWordmarkPng': return 'Wordmark Logo (PNG)';
      case 'logoApparelSvg': return 'Apparel Logo (SVG)';
      case 'logoApparelPng': return 'Apparel Logo (PNG)';
      case 'logoApparelGreenSvg': return 'Apparel Logo - Green (SVG)';
      case 'logoApparelGreenPng': return 'Apparel Logo - Green (PNG)';
      case 'logoApparelWhiteSvg': return 'Apparel Logo - White (SVG)';
      case 'logoApparelWhitePng': return 'Apparel Logo - White (PNG)';
      case 'logoWordmarkWhiteSvg': return 'Wordmark Logo (White) (SVG)';
      case 'logoWordmarkWhitePng': return 'Wordmark Logo (White) (PNG)';
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
    
    // Determine if this is a dark apparel logo that needs a white background for preview
    const isDarkApparelLogo = assetType === 'logoApparelSvg' || assetType === 'logoApparelPng';
    
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
                    className={`w-full h-full object-contain p-4 ${isDarkApparelLogo ? 'bg-white' : ''}`}
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

  // Component for individual video/thumbnail dropzone
  interface VideoEntryDropzoneProps {
    label: string;
    accept: string;
    currentUrl: string | null | undefined;
    isUploading: boolean | undefined;
    onFileSelect: (file: File) => void;
    onRemove: () => void;
    identifier: string; // Unique ID for drag state or input ID
    aspectRatio?: string;
  }

  const VideoEntryDropzone: React.FC<VideoEntryDropzoneProps> = ({
    label,
    accept,
    currentUrl,
    isUploading,
    onFileSelect,
    onRemove,
    identifier,
    aspectRatio = "aspect-video"
  }) => {
    const [isDragActive, setIsDragActive] = useState(false);

    const handleDragInternal = (e: React.DragEvent, active: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(active);
    };

    const handleDropInternal = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileSelect(e.dataTransfer.files[0]);
      }
    };

    const handleInputChangeInternal = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        onFileSelect(event.target.files[0]);
      }
    };

    return (
      <div className="mb-6 last:mb-0">
        <label className="block text-white text-sm font-medium mb-2">{label}</label>
        <div 
          className={`${aspectRatio} relative rounded-xl overflow-hidden border-2 ${
            isDragActive 
              ? "border-[#E0FE10] bg-[#E0FE10]/10" 
              : currentUrl 
                ? "border-zinc-700 hover:border-[#E0FE10]/50" 
                : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
          } transition-all duration-300 group`}
          onDragEnter={(e) => handleDragInternal(e, true)}
          onDragLeave={(e) => handleDragInternal(e, false)}
          onDragOver={(e) => handleDragInternal(e, true)}
          onDrop={handleDropInternal}
        >
          <input
            type="file"
            id={`file-input-${identifier}`}
            accept={accept}
            onChange={handleInputChangeInternal}
            className="hidden"
            disabled={isUploading}
          />
          {currentUrl && !isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {accept.startsWith('image') ? (
                <div className="w-full h-full relative">
                  <img src={currentUrl} alt={label} className="w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                    <button onClick={() => document.getElementById(`file-input-${identifier}`)?.click()} className="mb-2 px-3 py-1.5 bg-[#E0FE10] text-black rounded-full font-medium text-xs hover:bg-[#c8e40d]">Replace</button>
                    <button onClick={onRemove} className="px-3 py-1.5 bg-zinc-800 text-white rounded-full font-medium text-xs hover:bg-zinc-700">Remove</button>
                  </div>
                </div>
              ) : accept.startsWith('video') && currentUrl.startsWith('blob:') ? (
                 <div className="w-full h-full relative">
                    <video src={currentUrl} controls className="w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                        <button onClick={() => document.getElementById(`file-input-${identifier}`)?.click()} className="mb-2 px-3 py-1.5 bg-[#E0FE10] text-black rounded-full font-medium text-xs hover:bg-[#c8e40d]">Replace</button>
                        <button onClick={onRemove} className="px-3 py-1.5 bg-zinc-800 text-white rounded-full font-medium text-xs hover:bg-zinc-700">Remove</button>
                    </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-center p-4">
                  <div className="mb-2 w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center">
                    {accept.startsWith('video') ? <FileText className="w-5 h-5 text-[#E0FE10]" /> : <FileImage className="w-5 h-5 text-[#E0FE10]" /> }
                  </div>
                  <p className="text-white font-medium text-sm truncate max-w-full">
                    {accept.startsWith('video') ? 'Video Uploaded' : 'Image Uploaded'}
                  </p>
                  <p className="text-zinc-400 text-xs mb-3 break-all">{currentUrl.split('/').pop()?.split('?')[0] || 'file'}</p>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                    <button onClick={() => document.getElementById(`file-input-${identifier}`)?.click()} className="mb-2 px-3 py-1.5 bg-[#E0FE10] text-black rounded-full font-medium text-xs hover:bg-[#c8e40d]">Replace</button>
                    <button onClick={onRemove} className="px-3 py-1.5 bg-zinc-800 text-white rounded-full font-medium text-xs hover:bg-zinc-700">Remove</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
              <div className="w-10 h-10 rounded-full border-2 border-[#E0FE10]/20 border-t-[#E0FE10] animate-spin mb-1"></div>
              <p className="text-[#E0FE10] text-xs font-medium">Uploading...</p>
            </div>
          )}
          {!currentUrl && !isUploading && (
            <label htmlFor={`file-input-${identifier}`} className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-1">
                {accept.startsWith('video') ? <Upload className="w-5 h-5 text-[#E0FE10]" /> : <FileImage className="w-5 h-5 text-[#E0FE10]" /> }
              </div>
              {isDragActive ? (
                <p className="text-[#E0FE10] text-xs font-medium">Drop to upload</p>
              ) : (
                <>
                  <p className="text-white text-xs font-medium">Upload {label}</p>
                  <p className="text-zinc-400 text-xs mt-0.5">Drag & drop or click</p>
                </>
              )}
            </label>
          )}
        </div>
      </div>
    );
  };

  const handleVideoAssetFileUpload = async (
    file: File,
    categoryKey: string,
    videoId: string,
    assetPart: 'video' | 'thumbnail'
  ) => {
    setUploadError(null);
    const isVideoFile = assetPart === 'video';

    setVideosByCategory(prev => ({
      ...prev,
      [categoryKey]: (prev[categoryKey] || []).map(video => 
        video.id === videoId ? {
          ...video,
          ...(isVideoFile ? { isUploadingVideo: true, videoUrl: null, videoFile: file } : { isUploadingThumb: true, thumbUrl: null, thumbFile: file }),
        } : video
      ),
    }));

    // For local preview of video before upload (optional)
    // if (isVideoFile && file.type.startsWith('video/')) {
    //   const localUrl = URL.createObjectURL(file);
    //   setVideosByCategory(prev => ({
    //     ...prev,
    //     [categoryKey]: (prev[categoryKey] || []).map(video => 
    //       video.id === videoId ? { ...video, videoUrl: localUrl } : video // Temporarily show blob URL
    //     ),
    //   }));
    // }

    const fileExtension = file.name.split('.').pop();
    const fileName = assetPart === 'video' ? `video.${fileExtension}` : `thumb.${fileExtension}`;
    const storagePath = `${PRESS_ASSET_PATHS.videos}/${categoryKey}/${videoId}/${fileName}`;

    try {
      console.log(`Attempting to upload ${assetPart} for video ID ${videoId} in ${categoryKey} to ${storagePath}`);
      const result = await firebaseStorageService.uploadFileToStorage(file, storagePath, (progress) => {
        // console.log(`Upload progress for ${assetPart} ${videoId}: ${Math.round(progress * 100)}%`);
      });

      setVideosByCategory(prev => ({
        ...prev,
        [categoryKey]: (prev[categoryKey] || []).map(video => 
          video.id === videoId ? {
            ...video,
            ...(isVideoFile 
              ? { isUploadingVideo: false, videoUrl: result.downloadURL, videoFile: undefined } 
              : { isUploadingThumb: false, thumbUrl: result.downloadURL, thumbFile: undefined }),
          } : video
        ),
      }));
      console.log(`Upload successful for ${assetPart} ${videoId}: ${result.downloadURL}`);

    } catch (error) {
      console.error(`Upload failed for ${assetPart} ${videoId}:`, error);
      setUploadError(`Upload failed for ${assetPart} (ID: ${videoId}). Please try again.`);
      setVideosByCategory(prev => ({
        ...prev,
        [categoryKey]: (prev[categoryKey] || []).map(video => 
          video.id === videoId ? {
            ...video,
            ...(isVideoFile ? { isUploadingVideo: false } : { isUploadingThumb: false }),
          } : video
        ),
      }));
    }
  };

  const handleRemoveVideoAsset = (categoryKey: string, videoId: string, assetPart: 'video' | 'thumbnail') => {
    // TODO: Add logic to delete from Firebase Storage if URL exists
    const isVideoFile = assetPart === 'video';
    console.log(`Removing ${assetPart} for video ID ${videoId} in ${categoryKey}`);
    setVideosByCategory(prev => ({
      ...prev,
      [categoryKey]: (prev[categoryKey] || []).map(video => 
        video.id === videoId ? {
          ...video,
          ...(isVideoFile 
            ? { videoUrl: null, videoFile: undefined, isUploadingVideo: false } 
            : { thumbUrl: null, thumbFile: undefined, isUploadingThumb: false }),
        } : video
      ),
    }));
  };

  const handleAddVideo = (categoryKey: string) => {
    // ... existing code ...
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
        {/* Tab Navigation */}
        <div className="mb-10 border-b border-zinc-700 flex space-x-1 sm:space-x-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-6 py-3 text-sm sm:text-base font-medium transition-colors duration-150 ease-in-out focus:outline-none whitespace-nowrap
                ${
                  activeTab === tab.key
                    ? 'border-b-2 border-[#E0FE10] text-[#E0FE10]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          
          {/* Tab Content Area */}
          {activeTab === 'general' && (
            <>
              {/* Overview Section */}
              <section /* ref={useScrollFade()} */ className="py-12 bg-zinc-950 rounded-2xl p-8">
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

              {/* Fact-Check Sheet Section */}
              <section /* ref={useScrollFade()} */ className="py-12 bg-black rounded-2xl p-8">
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
              <section /* ref={useScrollFade()} */ className="py-12 bg-zinc-950 rounded-2xl p-8">
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
              <section /* ref={useScrollFade()} */ className="py-12 bg-black rounded-2xl p-8">
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
            </>
          )}

          {activeTab === 'founder' && (
            <>
              {/* Founder Bio Section */}
              <section /* ref={useScrollFade()} */ className="py-12 bg-black rounded-2xl p-8">
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
            </>
          )}

          {activeTab === 'product' && (
            <>
              {/* Product One-Pager Section */}
              <section /* ref={useScrollFade()} */ className="py-12 bg-zinc-950 rounded-2xl p-8">
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

              {/* App Screenshots Section (Moved Here) */}
              <section /* ref={useScrollFade()} */ className="py-12 bg-black rounded-2xl p-8">
                <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                  App Screenshots
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
                </h2>
                <h3 className="text-white text-4xl font-bold mb-8">Key Feature Visuals</h3>
                <p className="text-zinc-400 mb-10">Upload 3 high-resolution screenshots for each app category/feature.</p>

                {Object.entries(screenshotCategories).map(([categoryKey, categoryLabel]) => (
                  <div key={categoryKey} className="mb-12 last:mb-0"> {/* Removed Debug Border */}
                    <h4 className="text-white text-2xl font-semibold mb-6 border-b border-zinc-700 pb-3">{categoryLabel}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-10">
                      {[1, 2, 3].map(index => {
                        const screenshotAssetType = `appScreenshot_${categoryKey}_${index}` as ScreenshotAssetType;
                        // const expectedFullLabel = labelForAssetType(screenshotAssetType);
                        return (
                          // Restore renderDropZone call, wrapped in a div with a key
                          <div key={`${categoryKey}_${index}`}> 
                            {renderDropZone(
                              categoryLabel, // Base label, full label is derived by labelForAssetType
                              screenshotAssetType,
                              "image/*",
                              "aspect-[9/16]" // Common mobile screenshot aspect ratio
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {uploadError && assetUrls[Object.keys(assetUrls).find(k => k.startsWith('appScreenshot_')) as AssetType] === null && ( // Show general error if relevant
                    <div className="mt-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-200">
                        <p className="flex items-center">
                            <X className="w-5 h-5 mr-2 flex-shrink-0" />
                            <span>{uploadError}</span>
                        </p>
                    </div>
                )}
              </section>
            </>
          )}

          {activeTab === 'visuals' && (
            <>
              {/* Logo Assets Section */}
              <section /* ref={useScrollFade()} */ className="py-12 bg-black rounded-2xl p-8">
                <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                  Logo Assets
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
                </h2>
                <h3 className="text-2xl font-semibold text-white mb-6">Logo Assets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {renderDropZone("Signature Logo", 'logoSigSvg', "image/svg+xml")}
                  {renderDropZone("Signature Logo", 'logoSigPng', "image/png")}
                  {renderDropZone("White Logo", 'logoWhiteSvg', "image/svg+xml")}
                  {renderDropZone("White Logo", 'logoWhitePng', "image/png")}
                  {renderDropZone("Black Logo", 'logoBlackSvg', "image/svg+xml")}
                  {renderDropZone("Black Logo", 'logoBlackPng', "image/png")}
                  {renderDropZone("Green Logo", 'logoGreenSvg', "image/svg+xml")}
                  {renderDropZone("Green Logo", 'logoGreenPng', "image/png")}
                  {/* New Watermark and Wordmark Logos */}
                  {renderDropZone("Watermark Logo", 'logoWatermarkSvg', "image/svg+xml")}
                  {renderDropZone("Watermark Logo", 'logoWatermarkPng', "image/png")}
                  {renderDropZone("Wordmark Logo (Black)", 'logoWordmarkSvg', "image/svg+xml")}
                  {renderDropZone("Wordmark Logo (Black)", 'logoWordmarkPng', "image/png")}
                  {renderDropZone("Wordmark Logo (White)", 'logoWordmarkWhiteSvg', "image/svg+xml")}
                  {renderDropZone("Wordmark Logo (White)", 'logoWordmarkWhitePng', "image/png")}
                </div>
                {uploadError && (
                  <p className="text-red-500 text-sm mt-2">{uploadError}</p>
                )}
              </section>

              {/* New Apparel Logos Section */}
              <section className="py-12 bg-zinc-950 rounded-2xl p-8 mt-8">
                <h3 className="text-2xl font-semibold text-white mb-6">Apparel Logos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {renderDropZone("Apparel Logo", 'logoApparelSvg', "image/svg+xml")}
                  {renderDropZone("Apparel Logo", 'logoApparelPng', "image/png")}
                  {/* Green and White Apparel Logos */}
                  {renderDropZone("Apparel Logo - Green", 'logoApparelGreenSvg', "image/svg+xml")}
                  {renderDropZone("Apparel Logo - Green", 'logoApparelGreenPng', "image/png")}
                  {renderDropZone("Apparel Logo - White", 'logoApparelWhiteSvg', "image/svg+xml")}
                  {renderDropZone("Apparel Logo - White", 'logoApparelWhitePng', "image/png")}
                </div>
                {uploadError && (
                  <p className="text-red-500 text-sm mt-2">{uploadError}</p>
                )}
              </section>

              {/* Video Assets Section */}
              <section /* ref={useScrollFade()} */ className="py-12 bg-zinc-950 rounded-2xl p-8">
                <h3 className="text-2xl font-semibold text-white mb-6">Video Assets</h3>
                {Object.entries(videoCategories).map(([categoryKey, categoryLabel]) => (
                  <div key={categoryKey} className="mb-12 last:mb-0">
                    <h4 className="text-white text-2xl font-semibold mb-6 border-b border-zinc-700 pb-3">{categoryLabel}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-10">
                      {[1, 2, 3].map(index => {
                        const videoId = `${categoryKey}_${index}`;
                        return (
                          <div key={videoId}>
                            <VideoEntryDropzone
                              label={categoryLabel}
                              accept="video/*"
                              currentUrl={videosByCategory[categoryKey]?.find(v => v.id === videoId)?.videoUrl}
                              isUploading={videosByCategory[categoryKey]?.find(v => v.id === videoId)?.isUploadingVideo}
                              onFileSelect={(file) => handleVideoAssetFileUpload(file, categoryKey, videoId, 'video')}
                              onRemove={() => handleRemoveVideoAsset(categoryKey, videoId, 'video')}
                              identifier={videoId}
                              aspectRatio="aspect-video"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}
          
          {/* Save Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-sm p-4 border-t border-zinc-800 shadow-lg z-50">
            <div className="max-w-7xl mx-auto flex flex-col items-center">
              <button 
                type="submit" 
                className="px-8 py-3 bg-[#E0FE10] hover:bg-[#c8e40d] text-black font-medium rounded-lg transition-colors duration-300 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-full sm:w-auto sm:min-w-[200px]"
                disabled={Object.values(isUploading).some(status => status) || isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save All Changes'
                )}
              </button>
              {saveSuccessMessage && (
                <p className="mt-4 text-green-400">{saveSuccessMessage}</p>
              )}
              {saveErrorMessage && (
                <p className="mt-2 text-red-400 text-sm">{saveErrorMessage}</p>
              )}
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
};

export default PressUploadPage; 