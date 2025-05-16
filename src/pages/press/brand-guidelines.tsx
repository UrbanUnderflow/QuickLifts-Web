import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowUpRight, Download, Copy, Check, ChevronRight, ArrowLeft, Dumbbell, Plus, Circle } from 'lucide-react';
import { useScrollFade } from '../../hooks/useScrollFade';
import Header from '../../components/Header';
import Footer from '../../components/Footer/Footer';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

// Define types for our refs and state
type SectionRefs = {
  [key: string]: HTMLElement | null;
};

type CopiedState = {
  [key: string]: boolean;
};

// Structure for individual processed logo assets
interface DisplayLogoAsset {
  id: string;
  name: string;
  url: string;
  fileType: string;
}

// Interface for the raw assets we expect from Firestore
interface PressKitAssets {
  logoSigSvg?: string;
  logoSigPng?: string;
  logoWhiteSvg?: string;
  logoWhitePng?: string;
  logoBlackSvg?: string;
  logoBlackPng?: string;
  logoGreenSvg?: string;
  logoGreenPng?: string;
  logoWordmarkSvg?: string;
  logoWordmarkPng?: string;
  logoApparelSvg?: string;
  logoApparelPng?: string;
  logoApparelGreenSvg?: string;
  logoApparelGreenPng?: string;
  logoApparelWhiteSvg?: string;
  logoApparelWhitePng?: string;
  logoWordmarkWhiteSvg?: string; // Added for white wordmark
  logoWordmarkWhitePng?: string; // Added for white wordmark
  // Add other asset keys as needed from your 'liveAssets' document
}

const BrandGuidelines = () => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [copied, setCopied] = useState<CopiedState>({
    h1: false,
    h2: false,
    body: false,
    ui: false,
    label: false,
    neon: false,
    black: false,
    white: false,
    zinc900: false,
    zinc800: false,
    zinc500: false,
    zinc300: false,
    interBold: false,
    interSemibold: false, 
    interMedium: false,
    interRegular: false
  });
  
  const sectionsRef = useRef<SectionRefs>({
    overview: null,
    logo: null,
    typography: null,
    colors: null,
    usage: null,
    logomarkConstruction: null, // Added for Logomark Construction section
    iconography: null,
    voice: null,
    photography: null,
    apparelLogos: null, // Added for Apparel Logos section
    logoMisuse: null, // Added for Logo Misuse section
    minSize: null, // Added for Minimum Size section
  });

  const [pressKitAssets, setPressKitAssets] = useState<PressKitAssets | null>(null); // Raw from Firestore
  const [processedLogos, setProcessedLogos] = useState<Record<string, DisplayLogoAsset>>({}); // Keyed by asset ID
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [id]: true });
    setTimeout(() => {
      setCopied({ ...copied, [id]: false });
    }, 2000);
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = sectionsRef.current[sectionId];
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;
      
      Object.keys(sectionsRef.current).forEach((section) => {
        const element = sectionsRef.current[section];
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          
          if (scrollPosition >= top && scrollPosition <= top + height) {
            setActiveSection(section);
          }
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchAssets = async () => {
      setIsLoadingAssets(true);
      setFetchError(null);
      try {
        const docRef = doc(db, "pressKitData", "liveAssets");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const allAssets = docSnap.data() as PressKitAssets;
          setPressKitAssets(allAssets); // Store raw assets
          console.log("Brand Guidelines - Raw press kit assets loaded:", allAssets);

          const localLogoMappings: { key: keyof PressKitAssets; name: string; type: string; id: string }[] = [
            // Primary & Signature Logos (assuming sig can be black)
            { id: 'logoSigSvg', key: 'logoSigSvg', name: 'Pulse Signature.svg', type: 'image/svg+xml' },
            { id: 'logoSigPng', key: 'logoSigPng', name: 'Pulse Signature.png', type: 'image/png' },
            { id: 'logoBlackSvg', key: 'logoBlackSvg', name: 'Pulse Black.svg', type: 'image/svg+xml' }, // For explicit black logo
            { id: 'logoBlackPng', key: 'logoBlackPng', name: 'Pulse Black.png', type: 'image/png' },
            { id: 'logoWhiteSvg', key: 'logoWhiteSvg', name: 'Pulse White.svg', type: 'image/svg+xml' },
            { id: 'logoWhitePng', key: 'logoWhitePng', name: 'Pulse White.png', type: 'image/png' },
            { id: 'logoGreenSvg', key: 'logoGreenSvg', name: 'Pulse Green.svg', type: 'image/svg+xml' },
            { id: 'logoGreenPng', key: 'logoGreenPng', name: 'Pulse Green.png', type: 'image/png' },
            // Wordmark
            { id: 'logoWordmarkSvg', key: 'logoWordmarkSvg', name: 'Pulse Wordmark.svg', type: 'image/svg+xml' },
            { id: 'logoWordmarkPng', key: 'logoWordmarkPng', name: 'Pulse Wordmark.png', type: 'image/png' },
            // Apparel Logos
            { id: 'logoApparelSvg', key: 'logoApparelSvg', name: 'Pulse Apparel.svg', type: 'image/svg+xml' },
            { id: 'logoApparelPng', key: 'logoApparelPng', name: 'Pulse Apparel.png', type: 'image/png' },
            { id: 'logoApparelGreenSvg', key: 'logoApparelGreenSvg', name: 'Pulse Apparel Green.svg', type: 'image/svg+xml' },
            { id: 'logoApparelGreenPng', key: 'logoApparelGreenPng', name: 'Pulse Apparel Green.png', type: 'image/png' },
            { id: 'logoApparelWhiteSvg', key: 'logoApparelWhiteSvg', name: 'Pulse Apparel White.svg', type: 'image/svg+xml' },
            { id: 'logoApparelWhitePng', key: 'logoApparelWhitePng', name: 'Pulse Apparel White.png', type: 'image/png' },
            { id: 'logoWordmarkWhiteSvg', key: 'logoWordmarkWhiteSvg', name: 'Pulse Wordmark White.svg', type: 'image/svg+xml' },
            { id: 'logoWordmarkWhitePng', key: 'logoWordmarkWhitePng', name: 'Pulse Wordmark White.png', type: 'image/png' },
          ];

          const fetchedLogos: Record<string, DisplayLogoAsset> = {};
          localLogoMappings.forEach(mapping => {
            if (allAssets[mapping.key]) {
              fetchedLogos[mapping.id] = {
                id: mapping.id,
                name: mapping.name,
                url: allAssets[mapping.key]!,
                fileType: mapping.type,
              };
            }
          });
          setProcessedLogos(fetchedLogos);
          console.log("Brand Guidelines - Processed logos:", fetchedLogos);

          if (Object.keys(fetchedLogos).length === 0) {
            console.log("Brand Guidelines - Live assets document exists, but no recognizable mapped logo URLs found.");
          }

        } else {
          console.log("Brand Guidelines - No live press kit assets document found!");
          setFetchError("Brand assets are not available at the moment.");
          setPressKitAssets({}); // Set to empty object to avoid null issues
          setProcessedLogos({});
        }
      } catch (error) {
        console.error("Brand Guidelines - Error fetching press kit assets:", error);
        setFetchError("Failed to load brand assets. Please try again later.");
        setPressKitAssets({}); // Set to empty object
        setProcessedLogos({});
      } finally {
        setIsLoadingAssets(false);
      }
    };

    fetchAssets();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Head>
        <title>Brand Guidelines - Pulse Fitness Collective</title>
        <meta name="description" content="Official brand guidelines for Pulse Fitness Collective, including logo usage, typography, colors, and brand voice." />
      </Head>

      {/* Hero Section */}
      <section ref={useScrollFade()} className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-zinc-900"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 opacity-40"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-2000"></div>
        </div>
        
        {/* Animated grid pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[url('/grid-pattern.svg')] bg-repeat"></div>
        </div>

        {/* Content */}
        <div className="relative z-20 max-w-4xl mx-auto">
          <Link href="/press">
            <span className="flex items-center text-zinc-400 hover:text-white mb-6 group">
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Press Kit
            </span>
          </Link>
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer animate-fade-in-up animation-delay-300">
            Our Brand Identity
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
          </h2>
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8 animate-fade-in-up animation-delay-600">
            Pulse Brand Guidelines
          </h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 animate-fade-in-up animation-delay-900">
            Everything you need to represent our brand consistently across all mediums
          </p>
          <a href="#" className="inline-flex items-center justify-center px-8 py-3 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-medium rounded-lg transition-colors animate-fade-in-up animation-delay-1200">
            <Download className="mr-2 h-5 w-5" />
            Download Complete Brand Kit (PDF)
          </a>
        </div>
      </section>

      {/* Navigation + Content Sections */}
      <section className="py-16 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Sticky Navigation */}
            <div className="lg:w-1/4">
              <div className="sticky top-24 bg-zinc-900/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-800">
                <h3 className="text-white text-lg font-medium mb-6">Brand Guidelines</h3>
                <nav className="space-y-1">
                  {[
                    { id: 'overview', label: 'Brand Overview', number: 1 },
                    { id: 'logo', label: 'Logo System', number: 2 },
                    { id: 'typography', label: 'Typography', number: 3 },
                    { id: 'colors', label: 'Color Palette', number: 4 },
                    { id: 'usage', label: 'Logo Usage', number: 5 },
                    { id: 'logomarkConstruction', label: 'Logomark Construction', number: 6 }, // New section
                    { id: 'iconography', label: 'Iconography', number: 7 }, // Renumbered
                    { id: 'voice', label: 'Brand Voice', number: 8 }, // Renumbered
                    { id: 'photography', label: 'Photography', number: 9 }, // Renumbered
                    { id: 'apparelLogos', label: 'Apparel Logos', number: 10 }, // Renumbered
                    { id: 'logoMisuse', label: 'Logo Misuse', number: 11 }, // New section
                    { id: 'minSize', label: 'Minimum Size', number: 12 }, // New section
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`flex items-center w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        activeSection === item.id
                          ? 'bg-[#E0FE10]/10 text-[#E0FE10]'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                      }`}
                    >
                      <span>{item.label}</span>
                      {activeSection === item.id && (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </button>
                  ))}
                </nav>
                <div className="mt-8 p-4 bg-zinc-800/50 rounded-lg">
                  <p className="text-zinc-400 text-sm">
                    Need something specific? Contact our brand team at{' '}
                    <a href="mailto:brand@pulse.ai" className="text-[#E0FE10] hover:underline">
                      brand@pulse.ai
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:w-3/4">
              {/* Brand Overview */}
              <section 
                id="overview" 
                ref={(el) => { sectionsRef.current.overview = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">1</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Brand Overview</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-4">Our Brand Essence</h3>
                  <p className="text-zinc-400 text-lg mb-6">
                    The Pulse brand represents the vibrant intersection of fitness, community, and technology. 
                    Our visual identity is designed to feel energetic, inclusive, and forward-thinking, while remaining 
                    approachable and human-centered.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Dynamic</h4>
                      <p className="text-zinc-400">Our brand reflects the energy and movement at the core of fitness journeys.</p>
                    </div>
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Collective</h4>
                      <p className="text-zinc-400">We emphasize community, connection, and shared experiences above all.</p>
                    </div>
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Accessible</h4>
                      <p className="text-zinc-400">Our design system is clean, minimal, and focused on inclusivity.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-4">Our Story</h3>
                  <p className="text-zinc-400 text-lg mb-4">
                    Pulse was born from the belief that fitness is better when shared. Our visual identity reflects this 
                    philosophy through a system that emphasizes connection, energy, and collective growth.
                  </p>
                  <p className="text-zinc-400 text-lg">
                    The cornerstone of our brand is the pulse symbol – representing both the rhythmic nature of exercise 
                    and the connections formed between community members. Our signature neon green brings energy and 
                    distinction to an otherwise minimal black and white palette, creating a system that stands out in 
                    a crowded fitness technology landscape.
                  </p>
                </div>
              </section>
              
              {/* Logo System */}
              <section 
                id="logo" 
                ref={(el) => { sectionsRef.current.logo = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">2</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Logo System</h2>
                </div>

                {isLoadingAssets && <p className="text-zinc-400">Loading logo assets...</p>}
                {fetchError && <p className="text-red-400">Error loading assets: {fetchError}</p>}

                {!isLoadingAssets && !fetchError && Object.keys(processedLogos).length > 0 && (
                  // Log first, then return the JSX block
                  (console.log("Rendering Logo System with processedLogos:", processedLogos), (
                  <>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                      <h3 className="text-white text-xl font-semibold mb-6">Primary Logo</h3>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <div className="flex items-center justify-center bg-white p-12 rounded-lg">
                          <img 
                            src={processedLogos['logoBlackSvg']?.url || processedLogos['logoSigSvg']?.url || "/brand/pulse-logo-black.svg"} 
                            alt={processedLogos['logoBlackSvg']?.name || processedLogos['logoSigSvg']?.name || "Pulse logo (black)"} 
                            className="max-w-full h-auto"
                          />
                        </div>
                        <div className="flex items-center justify-center bg-black p-12 rounded-lg">
                          <img 
                            src={processedLogos['logoWhiteSvg']?.url || "/brand/pulse-logo-white.svg"} 
                            alt={processedLogos['logoWhiteSvg']?.name || "Pulse logo (white)"} 
                            className="max-w-full h-auto"
                          />
                        </div>
                      </div>
                      
                      <p className="text-zinc-400 text-lg mb-6">
                        Our primary logo features a distinctive circular icon with a waveform that represents the pulse of activity, 
                        paired with our wordmark in a bold, modern typeface. The logo is available in black and white variations for 
                        use on different backgrounds.
                      </p>
                      
                      <div className="flex flex-wrap gap-4 mt-6">
                        <a href={processedLogos['logoSigSvg']?.url || '#'} download={processedLogos['logoSigSvg']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                          <Download className="mr-2 h-5 w-5" />
                          Download SVG (Signature)
                        </a>
                        <a href={processedLogos['logoWhiteSvg']?.url || '#'} download={processedLogos['logoWhiteSvg']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                          <Download className="mr-2 h-5 w-5" />
                          Download SVG (White)
                        </a>
                      </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                      <h3 className="text-white text-xl font-semibold mb-6">Logo Mark Only</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="flex items-center justify-center bg-white p-8 rounded-lg aspect-square">
                          <img 
                            src={processedLogos['logoBlackSvg']?.url || processedLogos['logoSigSvg']?.url || "/brand/pulse-icon-black.svg"} 
                            alt={processedLogos['logoBlackSvg']?.name || processedLogos['logoSigSvg']?.name || "Pulse icon (black)"} 
                            className="w-24 h-24 object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-center bg-black p-8 rounded-lg aspect-square">
                          <img 
                            src={processedLogos['logoWhiteSvg']?.url || "/brand/pulse-icon-white.svg"} 
                            alt={processedLogos['logoWhiteSvg']?.name || "Pulse icon (white)"} 
                            className="w-24 h-24 object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-center bg-black p-8 rounded-lg aspect-square">
                          <img 
                            src={processedLogos['logoGreenSvg']?.url || "/brand/pulse-icon-neon.svg"} 
                            alt={processedLogos['logoGreenSvg']?.name || "Pulse icon (neon)"} 
                            className="w-24 h-24 object-contain"
                          />
                        </div>
                      </div>
                      
                      <p className="text-zinc-400 text-lg">
                        The Pulse logomark can be used independently in contexts where space is limited or for brand recognition 
                        in social media profiles, app icons, or favicons. It's available in black, white, and our signature neon green.
                      </p>
                       {/* TODO: Add specific icon download links if available */}
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                      <h3 className="text-white text-xl font-semibold mb-6">Wordmark Only</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="flex items-center justify-center bg-white p-8 rounded-lg">
                          <img 
                            src={processedLogos['logoWordmarkSvg']?.url || "/brand/pulse-wordmark-black.svg"} 
                            alt={processedLogos['logoWordmarkSvg']?.name || "Pulse wordmark (black)"} 
                            className="max-w-xs h-auto object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-center bg-black p-8 rounded-lg">
                          <img 
                            src={processedLogos['logoWordmarkWhiteSvg']?.url || "/brand/pulse-wordmark-white.svg"}
                            alt={processedLogos['logoWordmarkWhiteSvg']?.name || "Pulse wordmark (white)"} 
                            className="max-w-xs h-auto object-contain"
                          />
                        </div>
                      </div>
                      
                      <p className="text-zinc-400 text-lg">
                        The wordmark can be used independently when the logo is already established in context or when a more 
                        subtle branded element is required. Like our primary logo, it's available in black and white.
                      </p>
                      <div className="flex flex-wrap gap-4 mt-6">
                        <a href={processedLogos['logoWordmarkSvg']?.url || '#'} download={processedLogos['logoWordmarkSvg']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                          <Download className="mr-2 h-5 w-5" />
                          Download Wordmark SVG (Black)
                        </a>
                        <a href={processedLogos['logoWordmarkPng']?.url || '#'} download={processedLogos['logoWordmarkPng']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                          <Download className="mr-2 h-5 w-5" />
                          Download Wordmark PNG (Black)
                        </a>
                        <a href={processedLogos['logoWordmarkWhiteSvg']?.url || '#'} download={processedLogos['logoWordmarkWhiteSvg']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                          <Download className="mr-2 h-5 w-5" />
                          Download Wordmark SVG (White)
                        </a>
                        <a href={processedLogos['logoWordmarkWhitePng']?.url || '#'} download={processedLogos['logoWordmarkWhitePng']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                          <Download className="mr-2 h-5 w-5" />
                          Download Wordmark PNG (White)
                        </a>
                      </div>
                    </div>
                  </>
                  ))
                )}
                 {/* Show this if loading is done, no error, but no logos were processed */}
                {!isLoadingAssets && !fetchError && Object.keys(processedLogos).length === 0 && (
                  <p className="text-zinc-400 p-8 text-center">No mapped logo assets are currently available. Please check the upload page.</p>
                )}
              </section>
              
              {/* Typography */}
              <section 
                id="typography" 
                ref={(el) => { sectionsRef.current.typography = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">3</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Typography</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Primary Typeface: HK Grotesk</h3>
                  
                  <div className="mb-10">
                    <img 
                      src="/brand/hk-grotesk-sample.jpg" 
                      alt="HK Grotesk Sample" 
                      className="w-full rounded-lg mb-6"
                    />
                    
                    <p className="text-zinc-400 text-lg mb-6">
                      HK Grotesk is our primary typeface, chosen for its modern, clean aesthetic and excellent readability 
                      across digital and print applications. Its geometric yet friendly character aligns perfectly with our 
                      brand attributes.
                    </p>
                    
                    <a href="#" className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                      <Download className="mr-2 h-5 w-5" />
                      Download Font Files
                    </a>
                  </div>
                  
                  <h4 className="text-white text-lg font-semibold mb-4">Font Weights & Usage</h4>
                  
                  <div className="space-y-6">
                    <div className="border-b border-zinc-800 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-bold text-3xl">36 Bold</span>
                        <button 
                          onClick={() => handleCopy('36px HK Grotesk Bold', 'h1')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.h1 ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.h1 ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-zinc-400">Primary headlines, page titles</p>
                    </div>
                    
                    <div className="border-b border-zinc-800 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-bold text-2xl">24 Bold</span>
                        <button 
                          onClick={() => handleCopy('24px HK Grotesk Bold', 'h2')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.h2 ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.h2 ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-zinc-400">Section headings, prominent UI elements</p>
                    </div>
                    
                    <div className="border-b border-zinc-800 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium text-base">16 Medium</span>
                        <button 
                          onClick={() => handleCopy('16px HK Grotesk Medium', 'body')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.body ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.body ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-zinc-400">Body text, general content</p>
                    </div>
                    
                    <div className="border-b border-zinc-800 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold text-sm">14 SemiBold</span>
                        <button 
                          onClick={() => handleCopy('14px HK Grotesk SemiBold', 'ui')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.ui ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.ui ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-zinc-400">UI elements, buttons, navigation</p>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold text-xs uppercase tracking-wider">12 SemiBold</span>
                        <button 
                          onClick={() => handleCopy('12px HK Grotesk SemiBold', 'label')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.label ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.label ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-zinc-400">Labels, captions, supporting text</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Secondary Typeface: Inter</h3>
                  
                  <div className="mb-10">
                    <img 
                      src="/brand/inter-sample.jpg" 
                      alt="Inter Font Sample" 
                      className="w-full rounded-lg mb-6"
                    />
                    
                    <p className="text-zinc-400 text-lg mb-6">
                      Inter is our secondary typeface used primarily for digital interfaces, web applications, and 
                      user interfaces. This variable font family is optimized for screen legibility and offers 
                      versatile weights that adapt seamlessly across different devices and platforms.
                    </p>
                    
                    <a href="https://fonts.google.com/specimen/Inter" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                      <ArrowUpRight className="mr-2 h-5 w-5" />
                      View on Google Fonts
                    </a>
                  </div>
                  
                  <h4 className="text-white text-lg font-semibold mb-4">Font Weights & Usage</h4>
                  
                  <div className="space-y-6">
                    <div className="border-b border-zinc-800 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-bold text-3xl" style={{fontFamily: 'Inter'}}>700 Bold</span>
                        <button 
                          onClick={() => handleCopy('700 Inter Bold', 'interBold')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </button>
                      </div>
                      <p className="text-zinc-400">UI headings, buttons, emphasized elements</p>
                    </div>
                    
                    <div className="border-b border-zinc-800 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold text-2xl" style={{fontFamily: 'Inter'}}>600 SemiBold</span>
                        <button 
                          onClick={() => handleCopy('600 Inter SemiBold', 'interSemibold')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </button>
                      </div>
                      <p className="text-zinc-400">Subheadings, navigation items, important information</p>
                    </div>
                    
                    <div className="border-b border-zinc-800 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium text-base" style={{fontFamily: 'Inter'}}>500 Medium</span>
                        <button 
                          onClick={() => handleCopy('500 Inter Medium', 'interMedium')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </button>
                      </div>
                      <p className="text-zinc-400">Interface body text, default UI text weight</p>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-normal text-sm" style={{fontFamily: 'Inter'}}>400 Regular</span>
                        <button 
                          onClick={() => handleCopy('400 Inter Regular', 'interRegular')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </button>
                      </div>
                      <p className="text-zinc-400">General body text, descriptions, longer content</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-4">Web Typography</h3>
                  <p className="text-zinc-400 text-lg mb-6">
                    For web applications and websites, we've established a typographic scale that maintains 
                    consistency across all digital touchpoints. While HK Grotesk is used for marketing materials 
                    and brand assets, Inter is our preferred typeface for web interfaces, dashboards, and 
                    digital products due to its excellent screen readability.
                  </p>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="py-3 text-zinc-400 font-medium">Element</th>
                          <th className="py-3 text-zinc-400 font-medium">Size</th>
                          <th className="py-3 text-zinc-400 font-medium">Weight</th>
                          <th className="py-3 text-zinc-400 font-medium">Line Height</th>
                          <th className="py-3 text-zinc-400 font-medium">CSS Class</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-zinc-800">
                          <td className="py-4 text-white">h1</td>
                          <td className="py-4 text-white">36px</td>
                          <td className="py-4 text-white">Bold</td>
                          <td className="py-4 text-white">44px</td>
                          <td className="py-4 text-[#E0FE10] font-mono text-sm">.text-4xl</td>
                        </tr>
                        <tr className="border-b border-zinc-800">
                          <td className="py-4 text-white">h2</td>
                          <td className="py-4 text-white">24px</td>
                          <td className="py-4 text-white">Bold</td>
                          <td className="py-4 text-white">32px</td>
                          <td className="py-4 text-[#E0FE10] font-mono text-sm">.text-2xl</td>
                        </tr>
                        <tr className="border-b border-zinc-800">
                          <td className="py-4 text-white">h3</td>
                          <td className="py-4 text-white">20px</td>
                          <td className="py-4 text-white">Bold</td>
                          <td className="py-4 text-white">28px</td>
                          <td className="py-4 text-[#E0FE10] font-mono text-sm">.text-xl</td>
                        </tr>
                        <tr className="border-b border-zinc-800">
                          <td className="py-4 text-white">body</td>
                          <td className="py-4 text-white">16px</td>
                          <td className="py-4 text-white">Regular/Medium</td>
                          <td className="py-4 text-white">24px</td>
                          <td className="py-4 text-[#E0FE10] font-mono text-sm">.text-base</td>
                        </tr>
                        <tr>
                          <td className="py-4 text-white">small</td>
                          <td className="py-4 text-white">14px</td>
                          <td className="py-4 text-white">Regular/SemiBold</td>
                          <td className="py-4 text-white">20px</td>
                          <td className="py-4 text-[#E0FE10] font-mono text-sm">.text-sm</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
              
              {/* Color Palette */}
              <section 
                id="colors" 
                ref={(el) => { sectionsRef.current.colors = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">4</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Color Palette</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Primary Colors</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div>
                      <div className="h-36 bg-[#E0FE10] rounded-lg mb-4 flex items-end">
                        <div className="w-full p-4 bg-black/20">
                          <p className="font-medium text-black">Pulse Neon</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">#E0FE10</p>
                          <p className="text-zinc-400 text-sm">RGB 224, 254, 16</p>
                        </div>
                        <button 
                          onClick={() => handleCopy('#E0FE10', 'neon')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.neon ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.neon ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <div className="h-36 bg-black rounded-lg mb-4 flex items-end">
                        <div className="w-full p-4 bg-white/10">
                          <p className="font-medium text-white">Pulse Black</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">#000000</p>
                          <p className="text-zinc-400 text-sm">RGB 0, 0, 0</p>
                        </div>
                        <button 
                          onClick={() => handleCopy('#000000', 'black')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.black ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.black ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <div className="h-36 bg-white rounded-lg mb-4 flex items-end">
                        <div className="w-full p-4 bg-black/10">
                          <p className="font-medium text-black">Pulse White</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">#FFFFFF</p>
                          <p className="text-zinc-400 text-sm">RGB 255, 255, 255</p>
                        </div>
                        <button 
                          onClick={() => handleCopy('#FFFFFF', 'white')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.white ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.white ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-zinc-400 text-lg">
                    Our primary color palette is intentionally minimal to create a bold, distinctive look that 
                    stands out in the fitness technology space. The neon green provides a vibrant energy that 
                    contrasts powerfully with our black and white base.
                  </p>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-6">Supporting Colors</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <div>
                      <div className="h-24 bg-zinc-900 rounded-lg mb-4"></div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">Zinc 900</p>
                          <p className="text-zinc-400 text-sm">#18181B</p>
                        </div>
                        <button 
                          onClick={() => handleCopy('#18181B', 'zinc900')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.zinc900 ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.zinc900 ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <div className="h-24 bg-zinc-800 rounded-lg mb-4"></div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">Zinc 800</p>
                          <p className="text-zinc-400 text-sm">#27272A</p>
                        </div>
                        <button 
                          onClick={() => handleCopy('#27272A', 'zinc800')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.zinc800 ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.zinc800 ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <div className="h-24 bg-zinc-500 rounded-lg mb-4"></div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">Zinc 500</p>
                          <p className="text-zinc-400 text-sm">#71717A</p>
                        </div>
                        <button 
                          onClick={() => handleCopy('#71717A', 'zinc500')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.zinc500 ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.zinc500 ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <div className="h-24 bg-zinc-300 rounded-lg mb-4"></div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">Zinc 300</p>
                          <p className="text-zinc-400 text-sm">#D4D4D8</p>
                        </div>
                        <button 
                          onClick={() => handleCopy('#D4D4D8', 'zinc300')}
                          className="flex items-center text-sm text-zinc-400 hover:text-[#E0FE10]"
                        >
                          {copied.zinc300 ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied.zinc300 ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-zinc-400 text-lg mb-8">
                    Our grayscale palette provides subtle variation for UI elements, text hierarchy, and backgrounds 
                    without distracting from our core brand colors.
                  </p>
                  
                  <h4 className="text-white text-lg font-semibold mb-4">Functional Colors</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <div className="h-24 bg-green-500 rounded-lg mb-4"></div>
                      <p className="text-white font-medium">Success</p>
                      <p className="text-zinc-400 text-sm">#22C55E</p>
                    </div>
                    
                    <div>
                      <div className="h-24 bg-red-500 rounded-lg mb-4"></div>
                      <p className="text-white font-medium">Error</p>
                      <p className="text-zinc-400 text-sm">#EF4444</p>
                    </div>
                    
                    <div>
                      <div className="h-24 bg-yellow-500 rounded-lg mb-4"></div>
                      <p className="text-white font-medium">Warning</p>
                      <p className="text-zinc-400 text-sm">#EAB308</p>
                    </div>
                    
                    <div>
                      <div className="h-24 bg-blue-500 rounded-lg mb-4"></div>
                      <p className="text-white font-medium">Info</p>
                      <p className="text-zinc-400 text-sm">#3B82F6</p>
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Logo Usage */}
              <section 
                id="usage" 
                ref={(el) => { sectionsRef.current.usage = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">5</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Logo Usage</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Clear Space</h3>
                  
                  <div className="bg-zinc-800/70 p-8 rounded-lg mb-8">
                    <img 
                      src="/brand/logo-clearspace.svg" 
                      alt="Logo clear space demonstration" 
                      className="max-w-full h-auto"
                    />
                  </div>
                  
                  <p className="text-zinc-400 text-lg">
                    Always maintain the minimum clear space around the logo to ensure its visibility and impact. 
                    The clear space should be at least equal to the height of the 'p' in the Pulse wordmark.
                  </p>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Minimum Size</h3>
                  
                  <div className="flex flex-wrap gap-12 mb-8">
                    <div className="text-center">
                      <div className="bg-white p-4 rounded-lg mb-4 flex items-center justify-center">
                        <img 
                          src={processedLogos['logoBlackSvg']?.url || processedLogos['logoSigSvg']?.url || "/brand/pulse-logo-black.svg"} 
                          alt={processedLogos['logoBlackSvg']?.name || "Minimum logo size"} 
                          className="w-32"
                        />
                      </div>
                      <p className="text-white font-medium">Digital: 88px wide</p>
                    </div>
                    
                    <div className="text-center">
                      <div className="bg-white p-4 rounded-lg mb-4 flex items-center justify-center">
                        <img 
                          src={processedLogos['logoBlackSvg']?.url || processedLogos['logoSigSvg']?.url || "/brand/pulse-icon-black.svg"} 
                          alt={processedLogos['logoBlackSvg']?.name || "Minimum icon size"} 
                          className="w-12 h-12"
                        />
                      </div>
                      <p className="text-white font-medium">Icon: 32px</p>
                    </div>
                    
                    <div className="text-center">
                      <div className="bg-white p-4 rounded-lg mb-4 flex items-center justify-center">
                        <img 
                          src={processedLogos['logoWordmarkSvg']?.url || "/brand/pulse-wordmark-black.svg"} 
                          alt={processedLogos['logoWordmarkSvg']?.name || "Minimum wordmark size"} 
                          className="w-24"
                        />
                      </div>
                      <p className="text-white font-medium">Wordmark: 60px wide</p>
                    </div>
                  </div>
                  
                  <p className="text-zinc-400 text-lg">
                    To maintain legibility, never use the logo at sizes smaller than specified here. For smaller 
                    applications like favicons, use only the icon element.
                  </p>
                </div>               
              </section>
              
              {/* Minimum Size */}
              <section 
                id="minSize" 
                ref={(el) => { sectionsRef.current.minSize = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">12</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Minimum Size</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <p className="text-zinc-400 text-lg mb-6">
                    To maintain legibility, the Pulse logo and logomark should not be reproduced at sizes smaller 
                    than specified below. These minimum sizes ensure the brand remains recognizable across all applications.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-zinc-800 p-6 rounded-lg">
                      <h4 className="text-white text-lg font-semibold mb-3">Logo Minimum Size</h4>
                      <p className="text-zinc-400 mb-4">Print: 25mm wide</p>
                      <p className="text-zinc-400 mb-4">Digital: 100px wide</p>
                      <div className="border-t border-zinc-700 pt-4">
                        <img src={processedLogos['logoBlackSvg']?.url || processedLogos['logoSigSvg']?.url || "/brand/pulse-logo-black.svg"} 
                             alt={processedLogos['logoBlackSvg']?.name || "Pulse Logo"} 
                             className="h-8 w-auto" />
                      </div>
                    </div>
                    
                    <div className="bg-zinc-800 p-6 rounded-lg">
                      <h4 className="text-white text-lg font-semibold mb-3">Logomark Minimum Size</h4>
                      <p className="text-zinc-400 mb-4">Print: 10mm wide</p>
                      <p className="text-zinc-400 mb-4">Digital: 40px wide</p>
                      <div className="border-t border-zinc-700 pt-4">
                        <img src={processedLogos['logoBlackSvg']?.url || processedLogos['logoSigSvg']?.url || "/brand/pulse-icon-black.svg"} 
                             alt={processedLogos['logoBlackSvg']?.name || "Pulse Logomark"} 
                             className="h-8 w-8" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Logo Misuse */}
              <section 
                id="logoMisuse"
                ref={(el) => { sectionsRef.current.logoMisuse = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">5</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Logo Misuse</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-6">Incorrect Usage</h3>
                  
                  <p className="text-zinc-400 text-lg mb-6">
                    To maintain the integrity of the Pulse brand, please avoid the following common misuses of our logo. Always use 
                    the approved logo files without modification:
                  </p>
                  <ul className="list-disc list-inside text-zinc-400 space-y-3 pl-4">
                    <li>Don't stretch or distort the logo.</li>
                    <li>Don't change the logo colors.</li>
                    <li>Don't add effects or drop shadows.</li>
                    <li>Don't rotate or tilt the logo.</li>
                    <li>Don't use on low-contrast backgrounds.</li>
                    <li>Don't outline or stroke the logo.</li>
                  </ul>
                </div>
              </section>
              
              {/* Logomark Construction - NEW SECTION CONTENT */}
              <section 
                id="logomarkConstruction" 
                ref={(el) => { sectionsRef.current.logomarkConstruction = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">6</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Logomark Construction</h2>
                </div>
                
                <div className="bg-white border border-zinc-200 rounded-xl p-8">
                  <p className="text-zinc-700 text-lg mb-4">
                    The logo mark is our identifying mark or symbol that doesn't contain our business name and represents our identity.
                  </p>
                  <p className="text-zinc-700 text-lg mb-10">
                    Our logo mark is constructed from dumbbells.
                  </p>

                  <div className="flex flex-col items-center space-y-10">
                    {/* Equation Part */}
                    <div className="flex items-center justify-center space-x-6 md:space-x-10">
                      <div className="text-center">
                        {/* <Dumbbell className="w-20 h-20 md:w-28 md:h-28 text-zinc-300 mx-auto" strokeWidth={1.5} /> */}
                        <img src="/logo_dumbbell.png" alt="Dumbbell Component" className="w-20 h-20 md:w-28 md:h-28 object-contain mx-auto" />
                        <p className="text-zinc-600 mt-2 text-sm">Dumbbell Shape</p>
                      </div>
                      <Plus className="w-10 h-10 md:w-12 md:h-12 text-zinc-500" strokeWidth={1.5}/>
                      <div className="text-center">
                        {/* For a black circle on a white background, we can use a div with border or a solid fill */}
                        <div className="w-20 h-20 md:w-28 md:h-28 bg-black rounded-full mx-auto"></div>
                        {/* <Circle className="w-20 h-20 md:w-28 md:h-28 text-black mx-auto" strokeWidth={1.5} fill="black"/> You could use fill if the icon supports it directly and you want the Lucide icon */}
                        <p className="text-zinc-600 mt-2 text-sm">Containing Circle</p>
                      </div>
                    </div>

                    {/* Result Part with Construction Lines */}
                    <div className="text-center mt-10">
                        <p className="text-black text-3xl mb-6 font-semibold">=</p>
                        <div className="relative w-48 h-48 md:w-64 md:h-64 mx-auto flex items-center justify-center">
                            {/* Stylized Construction Lines (Simplified) - will be dark on white bg */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                <div className="w-full h-[1px] bg-zinc-400"></div>
                                <div className="w-[1px] h-full bg-zinc-400 absolute top-0 left-1/2 -translate-x-1/2"></div>
                                <div className="w-full h-[1px] bg-zinc-400 origin-center transform rotate-45 absolute"></div>
                                <div className="w-full h-[1px] bg-zinc-400 origin-center transform -rotate-45 absolute"></div>
                                <div className="w-[80%] h-[80%] border border-zinc-400 rounded-full absolute"></div>
                            </div>
                            
                            {/* Actual Logomark Image */}
                            <img 
                                src={processedLogos['logoSigSvg']?.url || processedLogos['logoBlackSvg']?.url || '/brand/pulse-icon-black.svg'} 
                                alt="Pulse Logomark"
                                className="w-32 h-32 md:w-40 md:h-40 object-contain z-10 relative"
                            />
                        </div>
                        <p className="text-black mt-4 text-lg font-medium">Pulse Logomark</p>
                    </div>
                  </div>

                </div>
              </section>
              
              {/* Iconography */}
              <section 
                id="iconography" 
                ref={(el) => { sectionsRef.current.iconography = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">7</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Iconography</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-6">Icon System</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-10">
                    {/* Row 1 */}
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 6V12L16 14" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9 22V12H15V22" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 8H17C16.4696 8 15.9609 8.21071 15.5858 8.58579C15.2107 8.96086 15 9.46957 15 10V21H3V10C3 9.46957 3.21071 8.96086 3.58579 8.58579C3.96086 8.21071 4.46957 8 5 8H4" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9 8V4C9 3.46957 9.21071 2.96086 9.58579 2.58579C9.96086 2.21071 10.4696 2 11 2H13C13.5304 2 14.0391 2.21071 14.4142 2.58579C14.7893 2.96086 15 3.46957 15 4V8" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.84 4.60999C20.3292 4.099 19.7228 3.69364 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69364 13.5708 4.099 13.06 4.60999L12 5.66999L10.94 4.60999C9.9083 3.5783 8.50903 2.9987 7.05 2.9987C5.59096 2.9987 4.19169 3.5783 3.16 4.60999C2.1283 5.64169 1.54871 7.04096 1.54871 8.49999C1.54871 9.95903 2.1283 11.3583 3.16 12.39L4.22 13.45L12 21.23L19.78 13.45L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6053C22.3095 9.93789 22.4518 9.22248 22.4518 8.49999C22.4518 7.77751 22.3095 7.0621 22.0329 6.39464C21.7563 5.72718 21.351 5.12075 20.84 4.60999V4.60999Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    
                    {/* Row 2 */}
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M15 9H9V15H15V9Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 16V12" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 8H12.01" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 17H4C3.46957 17 2.96086 16.7893 2.58579 16.4142C2.21071 16.0391 2 15.5304 2 15V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H20C20.5304 3 21.0391 3.21071 21.4142 3.58579C21.7893 3.96086 22 4.46957 22 5V15C22 15.5304 21.7893 16.0391 21.4142 16.4142C21.0391 16.7893 20.5304 17 20 17H19" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 15L17 21H7L12 15Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M22 6L12 13L2 6" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2V6" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 18V22" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4.93 4.93L7.76 7.76" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16.24 16.24L19.07 19.07" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 12H6" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M18 12H22" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="bg-zinc-800 aspect-square rounded-lg p-4 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M23 6L13.5 15.5L8.5 10.5L1 18" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M17 6H23V12" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  
                  <p className="text-zinc-400 text-lg mb-8">
                    Our icon system uses a clean, consistent style with 2px stroke weights and rounded caps. 
                    Icons should be used to enhance usability and provide visual cues for navigation and actions.
                  </p>
                  
                  <h4 className="text-white text-lg font-semibold mb-4">Icon Usage Guidelines</h4>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2"></div>
                      <p className="text-zinc-400">Always maintain the consistent 2px stroke weight and rounded styling</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2"></div>
                      <p className="text-zinc-400">Use appropriate sizing for different contexts (24px for UI elements, 20px for dense lists)</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2"></div>
                      <p className="text-zinc-400">Maintain adequate spacing around icons to ensure visibility</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2"></div>
                      <p className="text-zinc-400">Only use brand colors (primary neon, black, white, or grayscale) for icons</p>
                    </div>
                  </div>
                  
                  <a href="#" className="inline-flex items-center text-[#E0FE10] hover:text-white">
                    <Download className="mr-2 h-5 w-5" />
                    Download Icon Package (SVG)
                  </a>
                </div>
              </section>
              
              {/* Brand Voice */}
              <section 
                id="voice" 
                ref={(el) => { sectionsRef.current.voice = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">8</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Brand Voice</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-4">Tone & Personality</h3>
                  
                  <p className="text-zinc-400 text-lg mb-8">
                    The Pulse voice is energetic, inclusive, and encouraging. We speak with confidence but remain 
                    approachable and human. Our communication reflects our core brand values by being authentic, 
                    community-focused, and motivational without ever feeling judgmental.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    <div>
                      <h4 className="text-[#E0FE10] font-medium text-lg mb-4">We Are</h4>
                      <ul className="space-y-4">
                        <li className="flex items-start gap-4">
                          <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17L4 12" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Energetic</p>
                            <p className="text-zinc-400">Our language is vibrant and dynamic, reflecting the energy of movement and activity</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-4">
                          <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17L4 12" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Inclusive</p>
                            <p className="text-zinc-400">We speak to everyone, regardless of fitness level, background, or goals</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-4">
                          <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17L4 12" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Authentic</p>
                            <p className="text-zinc-400">We value real human experiences and speak honestly without hyperbole</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-4">
                          <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17L4 12" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Encouraging</p>
                            <p className="text-zinc-400">We motivate without pressuring and celebrate all progress, big or small</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-red-400 font-medium text-lg mb-4">We Are Not</h4>
                      <ul className="space-y-4">
                        <li className="flex items-start gap-4">
                          <div className="w-6 h-6 rounded-full bg-red-400/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M18 6L6 18" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M6 6L18 18" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Judgmental</p>
                            <p className="text-zinc-400">We never shame, criticize, or make people feel inadequate about their fitness level</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-4">
                          <div className="w-6 h-6 rounded-full bg-red-400/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M18 6L6 18" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M6 6L18 18" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Exclusive</p>
                            <p className="text-zinc-400">We avoid insider jargon or terminology that might alienate newcomers</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-4">
                          <div className="w-6 h-6 rounded-full bg-red-400/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M18 6L6 18" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M6 6L18 18" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Overpromising</p>
                            <p className="text-zinc-400">We don't make unrealistic claims about results or quick fixes</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-4">
                          <div className="w-6 h-6 rounded-full bg-red-400/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M18 6L6 18" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M6 6L18 18" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Impersonal</p>
                            <p className="text-zinc-400">We avoid corporate jargon and speak like real people to real people</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <h4 className="text-white text-lg font-semibold mb-4">Voice Examples</h4>
                  
                  <div className="space-y-6">
                    <div className="bg-zinc-800/70 p-6 rounded-lg">
                      <h5 className="text-[#E0FE10] font-medium mb-2">App Notification</h5>
                      <div className="bg-zinc-900 p-4 rounded-lg mb-4">
                        <p className="text-white">"Your community is crushing it! 12 friends completed your Mobility Stack this week. Share some love?"</p>
                      </div>
                      <p className="text-zinc-400 text-sm">
                        This notification emphasizes community connection, celebrates collective achievement, and 
                        encourages positive interaction in an energetic but authentic way.
                      </p>
                    </div>
                    
                    <div className="bg-zinc-800/70 p-6 rounded-lg">
                      <h5 className="text-[#E0FE10] font-medium mb-2">Welcome Email</h5>
                      <div className="bg-zinc-900 p-4 rounded-lg mb-4">
                        <p className="text-white">"Welcome to Pulse! We're excited to have you join our community of fitness enthusiasts. Whether you're just starting out or a seasoned pro, you'll find moves and challenges that meet you exactly where you are. Your journey is unique—and we're here to support every step of the way."</p>
                      </div>
                      <p className="text-zinc-400 text-sm">
                        This welcome message is inclusive of all fitness levels, warm and encouraging, and 
                        emphasizes both individuality and community support.
                      </p>
                    </div>
                    
                    <div className="bg-zinc-800/70 p-6 rounded-lg">
                      <h5 className="text-[#E0FE10] font-medium mb-2">Challenge Completion</h5>
                      <div className="bg-zinc-900 p-4 rounded-lg mb-4">
                        <p className="text-white">"You did it! You've completed the Morning Mobility Challenge. That's 30 days of showing up for yourself and your community. The consistency you've built is something to be proud of—what challenge will you take on next?"</p>
                      </div>
                      <p className="text-zinc-400 text-sm">
                        This message celebrates achievement with genuine enthusiasm, acknowledges the 
                        effort involved, and encourages continued engagement without pressure.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Photography */}
              <section 
                id="photography" 
                ref={(el) => { sectionsRef.current.photography = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">9</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Photography</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-6">Photography Style</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="aspect-video bg-zinc-800 rounded-lg overflow-hidden">
                      <img 
                        src="/brand/photography-1.jpg" 
                        alt="Authentic fitness moment" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="aspect-video bg-zinc-800 rounded-lg overflow-hidden">
                      <img 
                        src="/brand/photography-2.jpg" 
                        alt="Community fitness" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  
                  <p className="text-zinc-400 text-lg mb-8">
                    Our photography captures authentic moments of movement, community, and personal achievement. 
                    We showcase diverse people in real environments, emphasizing natural lighting and genuine 
                    expressions over overly polished or staged imagery.
                  </p>
                  
                  <h4 className="text-white text-lg font-semibold mb-4">Photography Guidelines</h4>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2"></div>
                      <p className="text-zinc-400">Represent diverse body types, ages, ethnicities, and fitness levels</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2"></div>
                      <p className="text-zinc-400">Focus on authentic moments of effort, joy, community, and accomplishment</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2"></div>
                      <p className="text-zinc-400">Use natural lighting and real environments whenever possible</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2"></div>
                      <p className="text-zinc-400">Capture movement and energy rather than static, posed shots</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2"></div>
                      <p className="text-zinc-400">Show people connecting and supporting each other in their fitness journeys</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden">
                      <img 
                        src="/brand/photography-small-1.jpg" 
                        alt="Photography example 1" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden">
                      <img 
                        src="/brand/photography-small-2.jpg" 
                        alt="Photography example 2" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden">
                      <img 
                        src="/brand/photography-small-3.jpg" 
                        alt="Photography example 3" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Apparel Logos Section - New */}
              <section 
                id="apparelLogos" 
                ref={(el) => { sectionsRef.current.apparelLogos = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    {/* Choose an appropriate number, e.g., 9 if it's the next section */}
                    <span className="font-bold text-black">10</span> 
                  </div>
                  <h2 className="text-white text-3xl font-bold">Apparel Logos</h2>
                </div>

                {isLoadingAssets && <p className="text-zinc-400">Loading apparel logo assets...</p>}
                {fetchError && <p className="text-red-400">Error loading assets: {fetchError}</p>}

                {!isLoadingAssets && !fetchError && Object.keys(processedLogos).length > 0 && (
                  // Log first, then return the JSX block
                  (console.log("Rendering Apparel Logos with processedLogos:", processedLogos), (
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-white text-xl font-semibold mb-6">Primary Apparel Logos</h3>
                    <p className="text-zinc-400 text-lg mb-8">
                      These logos are specifically designed or selected for use on apparel and merchandise. 
                      Consider the fabric color and printing method when choosing the appropriate version.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
                      {/* Default Apparel Logo (likely dark, on white background for preview) */}
                      <div>
                        <h4 className="text-white text-md font-semibold mb-3 text-center">Apparel Logo (Default)</h4>
                        <div className="flex items-center justify-center bg-white p-8 rounded-lg aspect-square mb-3">
                          <img 
                            src={processedLogos['logoApparelSvg']?.url || "/brand/pulse-apparel-default.svg"} 
                            alt={processedLogos['logoApparelSvg']?.name || "Pulse Apparel Logo SVG (Default)"} 
                            className="max-w-full h-24 object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-center bg-white p-8 rounded-lg aspect-square">
                          <img 
                            src={processedLogos['logoApparelPng']?.url || "/brand/pulse-apparel-default.png"} 
                            alt={processedLogos['logoApparelPng']?.name || "Pulse Apparel Logo PNG (Default)"} 
                            className="max-w-full h-24 object-contain"
                          />
                        </div>
                      </div>

                      {/* Green Apparel Logo */}
                      <div>
                        <h4 className="text-white text-md font-semibold mb-3 text-center">Apparel Logo (Green)</h4>
                        <div className="flex items-center justify-center bg-black p-8 rounded-lg aspect-square mb-3">
                          <img 
                            src={processedLogos['logoApparelGreenSvg']?.url || "/brand/pulse-apparel-green.svg"} 
                            alt={processedLogos['logoApparelGreenSvg']?.name || "Pulse Apparel Logo SVG (Green)"} 
                            className="max-w-full h-24 object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-center bg-black p-8 rounded-lg aspect-square">
                          <img 
                            src={processedLogos['logoApparelGreenPng']?.url || "/brand/pulse-apparel-green.png"} 
                            alt={processedLogos['logoApparelGreenPng']?.name || "Pulse Apparel Logo PNG (Green)"} 
                            className="max-w-full h-24 object-contain"
                          />
                        </div>
                      </div>

                      {/* White Apparel Logo */}
                      <div>
                        <h4 className="text-white text-md font-semibold mb-3 text-center">Apparel Logo (White)</h4>
                        <div className="flex items-center justify-center bg-black p-8 rounded-lg aspect-square mb-3">
                          <img 
                            src={processedLogos['logoApparelWhiteSvg']?.url || "/brand/pulse-apparel-white.svg"} 
                            alt={processedLogos['logoApparelWhiteSvg']?.name || "Pulse Apparel Logo SVG (White)"} 
                            className="max-w-full h-24 object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-center bg-black p-8 rounded-lg aspect-square">
                          <img 
                            src={processedLogos['logoApparelWhitePng']?.url || "/brand/pulse-apparel-white.png"} 
                            alt={processedLogos['logoApparelWhitePng']?.name || "Pulse Apparel Logo PNG (White)"} 
                            className="max-w-full h-24 object-contain"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <h4 className="text-white text-lg font-semibold mb-4">Download Apparel Logos</h4>
                    <div className="flex flex-wrap gap-4">
                      <a href={processedLogos['logoApparelSvg']?.url || '#'} download={processedLogos['logoApparelSvg']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                        <Download className="mr-2 h-5 w-5" /> SVG (Default)
                      </a>
                      <a href={processedLogos['logoApparelPng']?.url || '#'} download={processedLogos['logoApparelPng']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                        <Download className="mr-2 h-5 w-5" /> PNG (Default)
                      </a>
                      <a href={processedLogos['logoApparelGreenSvg']?.url || '#'} download={processedLogos['logoApparelGreenSvg']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                        <Download className="mr-2 h-5 w-5" /> SVG (Green)
                      </a>
                      <a href={processedLogos['logoApparelGreenPng']?.url || '#'} download={processedLogos['logoApparelGreenPng']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                        <Download className="mr-2 h-5 w-5" /> PNG (Green)
                      </a>
                      <a href={processedLogos['logoApparelWhiteSvg']?.url || '#'} download={processedLogos['logoApparelWhiteSvg']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                        <Download className="mr-2 h-5 w-5" /> SVG (White)
                      </a>
                      <a href={processedLogos['logoApparelWhitePng']?.url || '#'} download={processedLogos['logoApparelWhitePng']?.name} className="inline-flex items-center text-[#E0FE10] hover:text-white group">
                        <Download className="mr-2 h-5 w-5" /> PNG (White)
                      </a>
                    </div>
                  </div>
                  ))
                )}
                 {/* Show this if loading is done, no error, but no apparel logos were processed */}
                {!isLoadingAssets && !fetchError && Object.keys(processedLogos).filter(k => k.startsWith('logoApparel')).length === 0 && (
                    <p className="text-zinc-400 p-8 text-center">No mapped apparel logo assets are currently available. Please check the upload page.</p>
                )}
              </section>
              
              {/* Download Section */}
              <section className="mb-20">
                <div className="bg-black rounded-xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#E0FE10]/10 rounded-full filter blur-3xl"></div>
                  
                  <div className="relative z-10">
                    <h3 className="text-white text-2xl font-bold mb-4">Download Complete Brand Guidelines</h3>
                    <p className="text-zinc-400 mb-6">
                      Get all our brand assets, guidelines, and resources in one complete package.
                    </p>
                    
                    <div className="flex flex-wrap gap-4">
                      <a href="#" className="inline-flex items-center justify-center px-6 py-3 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-medium rounded-lg transition-colors">
                        <Download className="mr-2 h-5 w-5" />
                        Complete Brand Kit (42MB)
                      </a>
                      
                      <a href="#" className="inline-flex items-center justify-center px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors">
                        <Download className="mr-2 h-5 w-5" />
                        Logo Package Only (8MB)
                      </a>
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Contact Section */}
              <section>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-4">Questions?</h3>
                  <p className="text-zinc-400 text-lg mb-6">
                    For any questions about our brand guidelines or for special usage requests, 
                    please contact our brand team.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <a href="mailto:brand@pulse.ai" className="inline-flex items-center justify-center px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      brand@pulse.ai
                    </a>
                    
                    <Link href="/press">
                      <span className="inline-flex items-center justify-center px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Press Kit
                      </span>
                    </Link>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BrandGuidelines;