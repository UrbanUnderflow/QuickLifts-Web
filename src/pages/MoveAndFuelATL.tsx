import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { ChevronUp, ChevronDown, Check, Users, Star, Zap, Brain, Dumbbell, Utensils, Map, Award, Heart, Leaf, QrCode, Download } from 'lucide-react';
import Header from '../components/Header';
import styles from '../styles/moveAndFuel.module.css';
import PageHead from '../components/PageHead';
import { GetServerSideProps } from 'next';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

// Define a serializable version of PageMetaData for this page's props
interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface MoveAndFuelATLProps {
  metaData: SerializablePageMetaData | null;
}

const MoveAndFuelATL = ({ metaData }: MoveAndFuelATLProps) => {
  const [activeSection, setActiveSection] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const totalSections = 22; // Updated from 21 to 22 after adding Recurring Challenge Ecosystem slide
  const sectionRefs = useRef<(HTMLDivElement | null)[]>(Array(totalSections).fill(null));
  
  // Check if we're on mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check initially
    checkIfMobile();
    
    // Add event listener for resize
    window.addEventListener('resize', checkIfMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isMobile) return; // Disable keyboard nav on mobile
      if (e.key === 'ArrowDown' && activeSection < totalSections - 1) {
        sectionRefs.current[activeSection + 1]?.scrollIntoView({ behavior: 'smooth' });
        setActiveSection(activeSection + 1);
      } else if (e.key === 'ArrowUp' && activeSection > 0) {
        sectionRefs.current[activeSection - 1]?.scrollIntoView({ behavior: 'smooth' });
        setActiveSection(activeSection - 1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, isMobile]);
  
  // Use Intersection Observer to reliably detect which section is visible
  // Use Intersection Observer to reliably detect which section is visible
  useEffect(() => {
    // Track if we're currently in a transition to prevent bouncing
    let isTransitioning = false;
    let transitionTimer: NodeJS.Timeout | undefined;
    
    // Debounce function to prevent rapid state changes
    let debounceTimer: NodeJS.Timeout | undefined;
    const setActiveWithDebounce = (newIndex: number) => {
      // Clear any existing debounce timer
      if (debounceTimer) clearTimeout(debounceTimer);
      
      // If not transitioning, immediately set the active section to avoid perceived lag
      if (!isTransitioning && newIndex !== activeSection) {
        // Set transitioning flag to prevent bouncing
        isTransitioning = true;
        setActiveSection(newIndex);
        
        // Allow transitions again after a delay (matches scroll-snap settling time)
        transitionTimer = setTimeout(() => {
          isTransitioning = false;
        }, 700); // Typical snap scroll animation duration
      }
    };
    
    // Create a new instance of IntersectionObserver with fewer, more strategic thresholds
    const observer = new IntersectionObserver(
      (entries) => {
        // Don't process during transitions or programmatic navigation
        if (isTransitioning || isNavigating) return;
        
        // Get all entries that are at least 50% visible
        const significantEntries = entries.filter(entry => entry.intersectionRatio > 0.5);
        
        // If we have significant entries, use the most visible one
        if (significantEntries.length > 0) {
          const mostVisibleEntry = significantEntries.sort(
            (a, b) => b.intersectionRatio - a.intersectionRatio
          )[0];
          
          const index = sectionRefs.current.findIndex(
            section => section === mostVisibleEntry.target
          );
          
          if (index !== -1 && index !== activeSection) {
            setActiveWithDebounce(index);
          }
        } 
        // Fallback if no section is 50% visible (during fast scrolling)
        else {
          const bestEntry = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            
          if (bestEntry) {
            const index = sectionRefs.current.findIndex(
              section => section === bestEntry.target
            );
            
            if (index !== -1 && index !== activeSection) {
              setActiveWithDebounce(index);
            }
          }
        }
      },
      {
        root: null, // Use the viewport as the root
        rootMargin: '0px',
        // Use fewer thresholds focused around the 50% visibility mark
        threshold: [0.1, 0.5, 0.9],
      }
    );
    
    // Wait a small amount of time to ensure all refs are properly set
    const initTimer = setTimeout(() => {
      // Observe all section elements
      sectionRefs.current.forEach(section => {
        if (section) {
          observer.observe(section);
        }
      });
    }, 100);
    
    // Clean up all timers and observers
    return () => {
      clearTimeout(initTimer);
      clearTimeout(debounceTimer);
      clearTimeout(transitionTimer);
      observer.disconnect();
    };
  }, [activeSection, totalSections, isNavigating]);
  
  // Note: isNavigating state is declared at the top of the component
  
  // Navigation to specific section
  const navigateToSection = (index: number) => {
    if (index >= 0 && index < totalSections && !isNavigating) {
      // Set navigating state to prevent bounce
      setIsNavigating(true);
      
      // Update active section immediately for better UI feedback
      setActiveSection(index);
      
      // Scroll to the section with a small delay to ensure state is updated first
      const scrollTimer = setTimeout(() => {
        if (sectionRefs.current[index]) {
          sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
          
          // Reset navigating state after animation completes
          const resetTimer = setTimeout(() => {
            setIsNavigating(false);
          }, 800); // Slightly longer than scroll animation
          
          return () => clearTimeout(resetTimer);
        } else {
          setIsNavigating(false);
        }
      }, 10);
      
      return () => clearTimeout(scrollTimer);
    }
  };
  
  // Function to download the pre-made PDF
  const handleDownloadPDF = () => {
    try {
      setIsGeneratingPDF(true);
      
      // Create a link element
      const link = document.createElement('a');
      
      // Set the href to the pre-made PDF file path
      link.href = '/Move&FuelATL.pdf';
      
      // Set download attribute to suggest filename
      link.download = 'Move_and_Fuel_ATL.pdf';
      
      // Append to body, click to trigger download, then remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error downloading PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };
  
  // Function to generate consistent section classes
  const getSectionClasses = (bgColor: string = 'bg-zinc-950') => {
    if (isMobile) {
      // Mobile: relative positioning, padding, no fixed height, margin between sections
      return `w-full relative py-16 px-6 mb-8 ${bgColor}`;
    } else {
      // Desktop: snap scrolling, fixed height, centered content
      return `w-full h-screen snap-start flex flex-col items-center justify-center relative ${bgColor}`;
    }
  };
  
  // Function for consistent content container classes
  const getContentClasses = (alignment: 'center' | 'left' | 'right' = 'center') => {
    const alignmentClass = alignment === 'center' ? 'text-center' : alignment === 'left' ? 'text-left' : 'text-right';
    if (isMobile) {
      return `w-full max-w-4xl mx-auto px-2 ${alignmentClass}`;
    } else {
      return `max-w-4xl mx-auto ${alignmentClass}`;
    }
  };
  
  return (
    <div className="bg-zinc-950 text-white min-h-screen">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/MoveAndFuelATL"
      />
      
      <Header 
        onSectionChange={() => {}}
        currentSection="home"
        toggleMobileMenu={() => {}}
        setIsSignInModalVisible={() => {}}
        theme="dark"
        hideNav={true}
      />
      
      {/* Skip to section link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-20 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#E0FE10] focus:text-black focus:rounded-md">
        Skip to main content
      </a>
      
      {/* Vertical Progress Indicator - made smaller on mobile */}
      <div className="fixed right-2 md:right-6 top-1/2 transform -translate-y-1/2 z-50 flex flex-col items-end space-y-2 md:space-y-3">
        {Array.from({ length: totalSections }).map((_, index) => (
          <div key={index} className="flex items-center group">
            {/* Section number - visible on hover or when active */}
            <span className={`mr-1 md:mr-2 text-[10px] md:text-xs font-medium transition-opacity duration-200 ${
              activeSection === index 
                ? 'text-[#E0FE10] opacity-100' 
                : 'text-white opacity-0 group-hover:opacity-100'
            }`}>
              {index + 1}
            </span>
            
            {/* Dot indicator - smaller on mobile */}
            <button
              onClick={() => navigateToSection(index)}
              className={`relative rounded-full transition-all duration-300 flex items-center justify-center ${
                activeSection === index 
                  ? 'bg-[#E0FE10] w-4 h-4 md:w-6 md:h-6 shadow-[0_0_10px_rgba(224,254,16,0.7)]' 
                  : 'bg-zinc-600 hover:bg-zinc-400 w-2 h-2 md:w-3 md:h-3'
              }`}
              aria-label={`Navigate to section ${index + 1}`}
            >
              {/* Show number inside active dot */}
              {activeSection === index && (
                <span className="text-[6px] md:text-[8px] font-bold text-black">{index + 1}</span>
              )}
              
              {/* Ping animation */}
              {activeSection === index && (
                <span className="absolute inset-0 rounded-full bg-[#E0FE10] animate-ping opacity-75 w-full h-full"></span>
              )}
            </button>
          </div>
        ))}
      </div>
      
      {/* Navigation Arrows */}
      <div className={`fixed left-1/2 transform -translate-x-1/2 z-50 flex justify-between w-full max-w-7xl px-6 ${isMobile ? 'hidden' : ''}`}>
        <button 
          onClick={() => activeSection > 0 && navigateToSection(activeSection - 1)}
          className={`fixed top-1/2 left-6 transform -translate-y-1/2 w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center transition-opacity duration-300 ${
            activeSection === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          aria-label="Previous section"
        >
          <ChevronUp className="w-6 h-6 text-white" />
        </button>
        <button 
          onClick={() => activeSection < totalSections - 1 && navigateToSection(activeSection + 1)}
          className={`fixed top-1/2 right-6 transform -translate-y-1/2 w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center transition-opacity duration-300 ${
            activeSection === totalSections - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          aria-label="Next section"
        >
          <ChevronDown className="w-6 h-6 text-white" />
        </button>
      </div>
      
      {/* Main content - completely different structure for mobile vs desktop */}
      <main id="main-content" className={isMobile ? "relative space-y-0 pb-24" : "snap-y snap-mandatory h-screen overflow-y-scroll"}>
        {/* Apply a common section class based on mobile status */}
        {/* This template will be applied to all sections */}
        {/* 1. Hero Section */}
        <section 
          ref={(el) => { sectionRefs.current[0] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
          style={{ 
            backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url("/atl_hills_event_photo.jpg")', 
            backgroundSize: 'cover', 
            backgroundPosition: 'center'
          }}
        >
          <div className={`${getContentClasses()} ${!isMobile ? 'z-10' : ''}`}>
            <h1 className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl'} font-bold mb-6 text-white animate-fade-in-up`}>
              Move & Fuel <span className="text-[#E0FE10]">ATL</span>
            </h1>
            <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-3xl'} mb-8 text-white animate-fade-in-up animation-delay-300`}>
              Move together. Fuel smarter. Earn rewards.
            </p>
            <p className="text-lg md:text-xl mb-12 text-zinc-300 animate-fade-in-up animation-delay-600">
              <span className="text-[#E0FE10]">Pulse</span> × <span className="text-red-500">Hills4ATL</span> × <span className="text-blue-400">Atlanta Meal Prep</span>
            </p>
            
            <div className="inline-block border border-[#E0FE10] rounded-full px-4 py-2 mb-8 animate-fade-in-up animation-delay-750">
              <p className="text-[#E0FE10] text-sm md:text-base font-medium">
                Powered By Rounds on Pulse
              </p>
            </div>
          </div>
        </section>
        
        {/* 2. Why Pulse Exists Section */}
        <section 
          ref={(el) => { sectionRefs.current[1] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className={getContentClasses()}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              Why <span className="text-[#E0FE10]">Pulse</span> Exists
            </h2>
            <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} mb-12 text-zinc-300 animate-fade-in-up animation-delay-300 max-w-3xl mx-auto`}>
              Pulse exists to make fitness more social, accessible, and rewarding. We believe that working out is better when shared, and that technology should connect us in real life, not just virtually.
            </p>
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 animate-fade-in-up animation-delay-600">
              <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors">
                <div className="flex items-center justify-center mb-2">
                  <Users className="w-6 h-6 text-[#E0FE10] mr-2" />
                  <span className="text-3xl font-bold text-white">100+</span>
                </div>
                <p className="text-zinc-400">Creators and growing</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors">
                <div className="flex items-center justify-center mb-2">
                  <Dumbbell className="w-6 h-6 text-[#E0FE10] mr-2" />
                  <span className="text-3xl font-bold text-white">30K+</span>
                </div>
                <p className="text-zinc-400">Workouts Completed</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors">
                <div className="flex items-center justify-center mb-2">
                  <Brain className="w-6 h-6 text-[#E0FE10] mr-2" />
                  <span className="text-3xl text-white font-bold">50k+</span>
                </div>
                <p className="text-zinc-400">AI Insights Generated</p>
              </div>
            </div>
            
            {/* Flywheel Diagram */}
            <div className="relative w-full max-w-lg mx-auto animate-fade-in-up animation-delay-900">
              <svg viewBox="0 0 300 300" className="w-full h-auto">
                <circle cx="150" cy="150" r="130" fill="none" stroke="#E0FE10" strokeWidth="2" strokeDasharray="8 4" />
                
                {/* Flywheel Components */}
                <g>
                  <circle cx="150" cy="50" r="30" fill="#27272A" />
                  <foreignObject x="120" y="20" width="60" height="60">
                    <div className="h-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#E0FE10]" />
                    </div>
                  </foreignObject>
                  <text x="150" y="95" textAnchor="middle" fill="white" fontSize="12">Community</text>
                </g>
                <g>
                  <circle cx="240" cy="150" r="30" fill="#27272A" />
                  <foreignObject x="210" y="120" width="60" height="60">
                    <div className="h-full flex items-center justify-center">
                      <Dumbbell className="w-6 h-6 text-[#E0FE10]" />
                    </div>
                  </foreignObject>
                  <text x="240" y="195" textAnchor="middle" fill="white" fontSize="12">Fitness</text>
                </g>
                <g>
                  <circle cx="150" cy="250" r="30" fill="#27272A" />
                  <foreignObject x="120" y="220" width="60" height="60">
                    <div className="h-full flex items-center justify-center">
                      <Heart className="w-6 h-6 text-[#E0FE10]" />
                    </div>
                  </foreignObject>
                  <text x="150" y="295" textAnchor="middle" fill="white" fontSize="12">Wellness</text>
                </g>
                <g>
                  <circle cx="60" cy="150" r="30" fill="#27272A" />
                  <foreignObject x="30" y="120" width="60" height="60">
                    <div className="h-full flex items-center justify-center">
                      <Leaf className="w-6 h-6 text-[#E0FE10]" />
                    </div>
                  </foreignObject>
                  <text x="60" y="195" textAnchor="middle" fill="white" fontSize="12">Nutrition</text>
                </g>
                
                {/* Center Logo */}
                <image 
                  href="/pulse-logo-green.svg" 
                  x="110" 
                  y="110" 
                  width="80" 
                  height="80" 
                />
              </svg>
            </div>
          </div>
        </section>
        
        {/* 3. Tremaine Grant */}
        <section 
          ref={(el) => { sectionRefs.current[2] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className={getContentClasses()}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              Meet <span className="text-[#E0FE10]">Tremaine</span>
            </h2>
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
              <div className="md:w-1/3 animate-fade-in-up animation-delay-300">
                <img 
                  src="/TremaineFounder.jpg" 
                  alt="Tremaine Grant" 
                  className={`${isMobile ? 'w-48 h-48' : 'w-64 h-64'} object-cover rounded-full mx-auto border-4 border-[#E0FE10]`}
                />
              </div>
              <div className="md:w-2/3 text-left animate-fade-in-up animation-delay-600">
                <h3 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-[#E0FE10] mb-4`}>Tremaine Grant</h3>
                <p className={`${isMobile ? 'text-base' : 'text-lg'} text-zinc-300 mb-3`}>
                  Founder & CEO of Pulse Fitness Collective, reimagining how we facilitate connection and community through fitness experiences.
                </p>
                <ul className="list-disc list-inside text-zinc-400 space-y-2 text-sm md:text-base">
                  <li>Principle Engineer at companies such as General Motors, IQVIA, Warby Parker, and more</li>
                  <li>Former Track and Field Athlete at Florida State University</li>
                  <li>Passionate about making fitness social, accessible, and rewarding</li>
                  <li>Creating technology that bridges the gap between in-person and digital fitness connection.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
        
        {/* 4. Hills4ATL */}
        <section 
          ref={(el) => { sectionRefs.current[3] = el as HTMLDivElement; }}
          className={`${getSectionClasses('bg-zinc-900')} overflow-hidden relative`}
        >
          {/* Video Background */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-black opacity-85 z-10"></div>
            <video 
              className="absolute min-w-full min-h-full object-cover" 
              autoPlay 
              loop 
              muted 
              playsInline 
              src="/hillz.mov"
            ></video>
          </div>
          
          {/* Content */}
          <div className={`${getContentClasses()} relative z-20`}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              <span className="text-[#E0FE10]">Hills4ATL</span>
            </h2>
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
              <div className="md:w-1/3 animate-fade-in-up animation-delay-300">
                <img 
                  src="/aB.jpg" 
                  alt="Alvin 'A.B.' Bailey" 
                  className={`${isMobile ? 'w-48 h-48' : 'w-64 h-64'} object-cover rounded-full mx-auto border-4 border-[#E0FE10]`}
                />
              </div>
              <div className="md:w-2/3 text-left animate-fade-in-up animation-delay-600">
                <h3 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-[#E0FE10] mb-4`}>Alvin "A.B." Bailey</h3>
                <p className={`${isMobile ? 'text-base' : 'text-lg'} text-zinc-300 mb-3`}>
                  Professional DJ and founder of Hills4ATL, a free weekly workout community at Piedmont Park.
                </p>
                <ul className="list-disc list-inside text-zinc-400 space-y-2 text-sm md:text-base">
                  <li>Averages 120-150 participants every Wednesday</li>
                  <li>Created a safe, traffic-free workout environment</li>
                  <li>Building a growing "fitness family" in Atlanta</li>
                  <li>Welcomes all fitness levels to join the community</li>
                </ul>
              </div>
            </div>
            <p className="text-md text-zinc-400 italic animate-fade-in-up animation-delay-900 mt-4 max-w-2xl mx-auto">
              "I knew I wanted to create a fitness option in a public park, where there's no automobile traffic." - A.B. Bailey
            </p>
          </div>
        </section>
        
        {/* NEW SLIDE 5: Atlanta Meal Prep */}
        <section 
          ref={(el) => { sectionRefs.current[4] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              <span className="text-blue-400">Atlanta Meal Prep</span>
            </h2>
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
              <div className="md:w-1/3 animate-fade-in-up animation-delay-300">
                <img 
                  src="/bealewis.jpg" 
                  alt="Atlanta Meal Prep Logo" 
                  className={`${isMobile ? 'w-48 h-48' : 'w-64 h-64'} object-contain rounded-lg mx-auto p-2 bg-white`}
                />
              </div>
              <div className="md:w-2/3 text-left animate-fade-in-up animation-delay-600">
                <h3 className="text-2xl font-bold text-[#E0FE10] mb-4">Bea Lewis</h3>
                <p className="text-lg text-zinc-300 mb-4">
                  Established in 2015, Atlanta Meal Prep has become one of the city's leading healthy meal delivery services under Bea Lewis's leadership.
                </p>
                <ul className="list-disc list-inside text-zinc-400 space-y-2">
                  <li>Featured in Atlanta Magazine and The Atlanta Journal-Constitution</li>
                  <li>Serves actors, athletes, and health-conscious individuals</li>
                  <li>Uses fresh, locally sourced ingredients</li>
                  <li>Offers diverse meal plans with flexible subscription options</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-4 justify-center mt-8 overflow-hidden animate-fade-in-up animation-delay-900">
              <div className="w-24 h-24 transform hover:scale-110 transition-transform">
                <img src="/IMG_6615.jpg" alt="Meal Sample" className="w-full h-full object-cover rounded-lg shadow-lg" />
              </div>
              <div className="w-24 h-24 transform hover:scale-110 transition-transform">
                <img src="/IMG_6616.jpg" alt="Meal Sample" className="w-full h-full object-cover rounded-lg shadow-lg" />
              </div>
              <div className="w-24 h-24 transform hover:scale-110 transition-transform">
                <img src="/IMG_6617.jpg" alt="Meal Sample" className="w-full h-full object-cover rounded-lg shadow-lg" />
              </div>
              <div className="w-24 h-24 transform hover:scale-110 transition-transform">
                <img src="/IMG_6618.jpg" alt="Meal Sample" className="w-full h-full object-cover rounded-lg shadow-lg" />
              </div>
            </div>
            <p className="text-md text-zinc-400 animate-fade-in-up animation-delay-1200 mt-6 max-w-2xl mx-auto">
              Culinary excellence meets nutritional goals, making healthy eating both convenient and enjoyable.
            </p>
          </div>
        </section>
        
        {/* NEW SLIDE 6: What's a Round? */}
        <section 
          ref={(el) => { sectionRefs.current[5] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2 text-left">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white animate-fade-in-up">
                What's a <span className="text-[#E0FE10]">Round</span>?
              </h2>
              <p className="text-lg text-zinc-300 mb-8 animate-fade-in-up animation-delay-300">
                A Round is a community fitness challenge with a set timeframe, workout program, and leaderboard. It transforms solo workouts into shared experiences, where participants track progress together and motivate each other.
              </p>
              <p className="text-2xl font-bold text-[#E0FE10] animate-fade-in-up animation-delay-600">
                75+ active members in our Morning Mobility Challenge.
              </p>
            </div>
            
            <div className="md:w-1/2 animate-fade-in-up animation-delay-300">
              <div className="relative aspect-[9/19.5] max-w-[300px] mx-auto">
                <div className="absolute inset-0 rounded-[3rem] border-[4px] border-[#E0FE10] z-10 transition-all duration-500" />
                <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
                  <video
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    src="/rounds.mp4"
                    poster="/sample-round-poster.jpg"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* App Screenshots - Community & Competition */}
        <section 
          ref={(el) => { sectionRefs.current[6] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-8 text-white text-center animate-fade-in-up">
              Building <span className="text-[#E0FE10]">Connections</span> Through Competition
            </h2>
            <p className="text-lg text-zinc-300 mb-10 text-center max-w-3xl mx-auto animate-fade-in-up animation-delay-300">
              Our platform fosters intentional community building through friendly competition, progress tracking, and shared achievements.
            </p>
            
            {/* App screenshots grid - smaller constrained size */}
            <div className="flex flex-col items-center mb-10 animate-fade-in-up animation-delay-600">
              <div className="flex gap-6 justify-center">
                <div className="w-full max-w-[200px]">
                  <div className="rounded-xl overflow-hidden aspect-[6/20]">
                    <img src="/IMG_6622.PNG" alt="Activity feed" className="w-full h-full object-contain" />
                    <div className="p-2 bg-black">
                      <p className="text-white text-xs font-medium text-center">Activity Feed</p>
                    </div>
                  </div>
                </div>
                <div className="w-full max-w-[190px] flex flex-col gap-3">
                  <div>
                    <div className="rounded-xl overflow-hidden aspect-[9/16]">
                      <img src="/IMG_6627.PNG" alt="Leaderboard" className="w-full h-full object-contain" />
                      <div className="p-2 bg-black">
                        <p className="text-white text-xs font-medium text-center">Leaderboard</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="rounded-xl overflow-hidden aspect-[9/16]">
                      <img src="/IMG_6631.PNG" alt="Progress Tracking" className="w-full h-full object-contain" />
                      <div className="p-2 bg-black">
                        <p className="text-white text-xs font-medium text-center">Progress Tracking</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Key benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up animation-delay-900">
              <div className="bg-zinc-900/50 p-6 rounded-xl">
                <h3 className="text-xl font-bold text-[#E0FE10] mb-3">Meaningful Engagement</h3>
                <p className="text-zinc-400">
                  Participants stay motivated through real-time progress tracking and community recognition of achievements.
                </p>
              </div>
              <div className="bg-zinc-900/50 p-6 rounded-xl">
                <h3 className="text-xl font-bold text-[#E0FE10] mb-3">Friendly Competition</h3>
                <p className="text-zinc-400">
                  Leaderboards and point systems create healthy competition that drives consistent participation.
                </p>
              </div>
              <div className="bg-zinc-900/50 p-6 rounded-xl">
                <h3 className="text-xl font-bold text-[#E0FE10] mb-3">Digital + Physical</h3>
                <p className="text-zinc-400">
                  Our platform bridges online and offline experiences, creating deeper connections between participants.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* 4. Introducing Move & Fuel ATL */}
        <section 
          ref={(el) => { sectionRefs.current[7] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white animate-fade-in-up">
              Introducing <span className="text-[#E0FE10]">Move & Fuel ATL</span>
            </h2>
            <p className="text-xl text-zinc-400 mb-8 animate-fade-in-up animation-delay-100">Experience a <span className="text-[#E0FE10] font-semibold">360° fitness lifestyle engine</span></p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 animate-fade-in-up animation-delay-300">
              <div className="bg-zinc-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-2">Duration</h3>
                <p className="text-4xl font-bold text-[#E0FE10]">45 days</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-2">Target</h3>
                <p className="text-4xl font-bold text-[#E0FE10]">1,000 participants</p>
                <p className="text-zinc-400 text-sm mt-1">city wide</p>
              </div>
            </div>
            
            <div className="bg-zinc-800/50 rounded-xl p-8 text-left animate-fade-in-up animation-delay-600">
              <h3 className="text-2xl font-bold text-white mb-4">Program Includes:</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#E0FE10] flex items-center justify-center mr-3 mt-0.5">
                    <Dumbbell className="h-3 w-3 text-black" />
                  </div>
                  <span className="text-zinc-300 text-lg">Gym workouts (strength + cardio)</span>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#E0FE10] flex items-center justify-center mr-3 mt-0.5">
                    <Utensils className="h-3 w-3 text-black" />
                  </div>
                  <span className="text-zinc-300 text-lg">Meal plan (calorie ranges + meal-prep option)</span>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#E0FE10] flex items-center justify-center mr-3 mt-0.5">
                    <Map className="h-3 w-3 text-black" />
                  </div>
                  <span className="text-zinc-300 text-lg">IRL Experiences (run, yoga, staircase sprint)</span>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#E0FE10] flex items-center justify-center mr-3 mt-0.5">
                    <Award className="h-3 w-3 text-black" />
                  </div>
                  <span className="text-zinc-300 text-lg">Points System (earn, share, redeem)</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
        
        {/* 5. Program Components */}
        <section 
          ref={(el) => { sectionRefs.current[8] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-black')}
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-12 text-white text-center animate-fade-in-up">
              Program <span className="text-[#E0FE10]">Components</span>
            </h2>
            
            {/* Compact Program Components Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-fade-in-up animation-delay-300">
              {/* Workouts Component */}
              <div className="bg-zinc-900/80 rounded-xl aspect-square p-4 hover:bg-zinc-800 transition-all duration-300 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-3">
                  <Dumbbell className="h-6 w-6 text-[#E0FE10]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Workouts</h3>
                <p className="text-xs text-zinc-400 line-clamp-3">
                  Strength & cardio routines for all fitness levels
                </p>
              </div>
              
              {/* Meal Plan Component */}
              <div className="bg-zinc-900/80 rounded-xl aspect-square p-4 hover:bg-zinc-800 transition-all duration-300 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-3">
                  <Utensils className="h-6 w-6 text-[#E0FE10]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Meal Plan</h3>
                <p className="text-xs text-zinc-400 line-clamp-3">
                  Nutrition with calorie targets and meal prep delivery
                </p>
              </div>
              
              {/* IRL Experiences Component */}
              <div className="bg-zinc-900/80 rounded-xl aspect-square p-4 hover:bg-zinc-800 transition-all duration-300 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-3">
                  <Map className="h-6 w-6 text-[#E0FE10]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">IRL Events</h3>
                <p className="text-xs text-zinc-400 line-clamp-3">
                  Group activities at iconic ATL locations
                </p>
              </div>
              
              {/* Points System Component */}
              <div className="bg-zinc-900/80 rounded-xl aspect-square p-4 hover:bg-zinc-800 transition-all duration-300 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-3">
                  <Award className="h-6 w-6 text-[#E0FE10]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Points</h3>
                <p className="text-xs text-zinc-400 line-clamp-3">
                  Earn rewards for workouts and participation
                </p>
              </div>
              
              {/* QR Discount Cards */}
              <div className="bg-zinc-900/80 rounded-xl aspect-square p-4 hover:bg-zinc-800 transition-all duration-300 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-3">
                  <QrCode className="h-6 w-6 text-[#E0FE10]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">QR Codes</h3>
                <p className="text-xs text-zinc-400 line-clamp-3">
                  100+ discount codes for community engagement
                </p>
              </div>
            </div>
            
            {/* Integrated Experience Banner */}
            <div className="mt-8 text-center animate-fade-in-up animation-delay-600">
              <div className="bg-zinc-900/50 border border-[#E0FE10]/20 rounded-xl p-4 inline-block">
                <p className="text-[#E0FE10] font-semibold mb-1">Fully Integrated Experience</p>
                <p className="text-xs text-zinc-400">All components connect through the Pulse app for seamless participant engagement</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* 6. Tech Magic Under the Hood */}
        <section 
          ref={(el) => { sectionRefs.current[9] = el as HTMLDivElement; }}
          className={`${getSectionClasses('bg-black')} overflow-hidden`}
        >
          {/* Tech background elements */}
          <div className={isMobile ? "hidden" : "absolute inset-0 z-0"}>
            {/* Animated grid background */}
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-20"></div>
            
            {/* Glowing orbs */}
            <div className="absolute top-20 left-20 w-64 h-64 bg-blue-500/20 rounded-full filter blur-[100px] animate-pulse-slow"></div>
            <div className="absolute bottom-20 right-20 w-80 h-80 bg-[#E0FE10]/20 rounded-full filter blur-[120px] animate-pulse-slow animation-delay-1000"></div>
            
            {/* Tech circuits */}
            <div className="absolute top-0 left-0 w-full h-full opacity-20">
              <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <path d="M0,100 L1200,100" stroke="#E0FE10" strokeWidth="0.5" strokeDasharray="5,5"/>
                <path d="M0,300 L1200,300" stroke="#E0FE10" strokeWidth="0.5" strokeDasharray="5,5"/>
                <path d="M0,500 L1200,500" stroke="#E0FE10" strokeWidth="0.5" strokeDasharray="5,5"/>
                <path d="M0,700 L1200,700" stroke="#E0FE10" strokeWidth="0.5" strokeDasharray="5,5"/>
                <path d="M100,0 L100,800" stroke="#E0FE10" strokeWidth="0.5" strokeDasharray="5,5"/>
                <path d="M400,0 L400,800" stroke="#E0FE10" strokeWidth="0.5" strokeDasharray="5,5"/>
                <path d="M700,0 L700,800" stroke="#E0FE10" strokeWidth="0.5" strokeDasharray="5,5"/>
                <path d="M1000,0 L1000,800" stroke="#E0FE10" strokeWidth="0.5" strokeDasharray="5,5"/>
              </svg>
            </div>
            
            {/* Random data points */}
            <div className="absolute top-0 left-0 w-full h-full">
              {Array.from({ length: 50 }).map((_, i) => (
                <div 
                  key={i}
                  className="absolute w-1 h-1 bg-[#E0FE10] rounded-full animate-pulse-fast"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`
                  }}
                ></div>
              ))}
            </div>
          </div>
          
          <div className="relative z-10 max-w-5xl mx-auto">
            {/* Cyberpunk-style heading */}
            <div className="text-center mb-10 animate-fade-in-up">
              <div className="inline-block relative">
                <h2 className="text-4xl md:text-6xl font-bold text-white relative z-10">
                  <span className="text-[#E0FE10] drop-shadow-[0_0_10px_rgba(224,254,16,0.7)]">TECH MAGIC</span> UNDER THE HOOD
                </h2>
                <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#E0FE10] to-transparent"></div>
                <div className="absolute -top-2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#E0FE10] to-transparent"></div>
              </div>
              <p className="text-zinc-400 mt-4 uppercase tracking-widest text-sm">POWERED BY ADVANCED ALGORITHMS</p>
            </div>
            
            {/* Tech features in a modern grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up animation-delay-300">
              {/* Apple Watch Integration */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm rounded-xl p-6 border border-zinc-800 hover:border-[#E0FE10]/50 transition-all duration-300 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="flex items-start gap-4">
                  {/* Hexagon icon container */}
                  <div className="relative">
                    <div className="w-14 h-14 relative">
                      <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl transform rotate-45"></div>
                      <div className="absolute inset-1 bg-zinc-900/80 rounded-lg transform rotate-45"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_3px_rgba(224,254,16,0.7)]">
                          <rect x="6" y="2" width="12" height="20" rx="2" ry="2" />
                          <circle cx="12" cy="14" r="4" />
                          <path d="M12 18v2" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                        HEALTH DATA SYNC
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">API v2</span>
                      </h3>
                    </div>
                    <p className="text-zinc-400 text-sm">
                      Automatic syncing with Apple Health data for seamless activity tracking. Workouts are recognized and points awarded automatically.
                    </p>
                  </div>
                </div>
                
                {/* Data metrics footer */}
                <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Sync Rate</p>
                    <p className="text-[#E0FE10] font-mono">99.7%</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Latency</p>
                    <p className="text-[#E0FE10] font-mono">&lt;500ms</p>
                  </div>
                </div>
              </div>
              
              {/* AI Food Recognition */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm rounded-xl p-6 border border-zinc-800 hover:border-[#E0FE10]/50 transition-all duration-300 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="flex items-start gap-4">
                  {/* Hexagon icon container */}
                  <div className="relative">
                    <div className="w-14 h-14 relative">
                      <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl transform rotate-45"></div>
                      <div className="absolute inset-1 bg-zinc-900/80 rounded-lg transform rotate-45"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_3px_rgba(224,254,16,0.7)]">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" y1="22" x2="4" y2="15" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                        AI CALORIE ESTIMATOR
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">ML</span>
                      </h3>
                    </div>
                    <p className="text-zinc-400 text-sm">
                      Neural network identifies food from photos and estimates calorie content. Precise tracking for Atlanta Meal Prep items.
                    </p>
                  </div>
                </div>
                
                {/* Data metrics footer */}
                <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Accuracy</p>
                    <p className="text-[#E0FE10] font-mono">94.2%</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Recognition</p>
                    <p className="text-[#E0FE10] font-mono">7,500+ foods</p>
                  </div>
                </div>
              </div>
              
              {/* QR Check-ins */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm rounded-xl p-6 border border-zinc-800 hover:border-[#E0FE10]/50 transition-all duration-300 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="flex items-start gap-4">
                  {/* Hexagon icon container */}
                  <div className="relative">
                    <div className="w-14 h-14 relative">
                      <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl transform rotate-45"></div>
                      <div className="absolute inset-1 bg-zinc-900/80 rounded-lg transform rotate-45"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_3px_rgba(224,254,16,0.7)]">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <rect x="7" y="7" width="3" height="3" />
                          <rect x="14" y="7" width="3" height="3" />
                          <rect x="7" y="14" width="3" height="3" />
                          <rect x="14" y="14" width="3" height="3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                        AUTO-QR CHECK-INS
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300">SECURE</span>
                      </h3>
                    </div>
                    <p className="text-zinc-400 text-sm">
                      Encrypted QR check-ins with real-time leaderboard updates. Anti-fraud validation ensures integrity of competition.
                    </p>
                  </div>
                </div>
                
                {/* Data metrics footer */}
                <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Processing</p>
                    <p className="text-[#E0FE10] font-mono">&lt;1.2 sec</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Security</p>
                    <p className="text-[#E0FE10] font-mono">AES-256</p>
                  </div>
                </div>
              </div>
              
              {/* Gamification Engine */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm rounded-xl p-6 border border-zinc-800 hover:border-[#E0FE10]/50 transition-all duration-300 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="flex items-start gap-4">
                  {/* Hexagon icon container */}
                  <div className="relative">
                    <div className="w-14 h-14 relative">
                      <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl transform rotate-45"></div>
                      <div className="absolute inset-1 bg-zinc-900/80 rounded-lg transform rotate-45"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_3px_rgba(224,254,16,0.7)]">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                        GAMIFICATION ENGINE
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300">ADAPTIVE</span>
                      </h3>
                    </div>
                    <p className="text-zinc-400 text-sm">
                      Dynamic point system with adaptive challenges. Personalized rewards and competition tiers based on activity levels.
                    </p>
                  </div>
                </div>
                
                {/* Data metrics footer */}
                <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Engagement</p>
                    <p className="text-[#E0FE10] font-mono">+186%</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Challenges</p>
                    <p className="text-[#E0FE10] font-mono">50+ templates</p>
                  </div>
                </div>
              </div>
              
              {/* Predictive Analytics */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm rounded-xl p-6 border border-zinc-800 hover:border-[#E0FE10]/50 transition-all duration-300 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="flex items-start gap-4">
                  {/* Hexagon icon container */}
                  <div className="relative">
                    <div className="w-14 h-14 relative">
                      <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl transform rotate-45"></div>
                      <div className="absolute inset-1 bg-zinc-900/80 rounded-lg transform rotate-45"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_3px_rgba(224,254,16,0.7)]">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                        PREDICTIVE ANALYTICS
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-300">AI</span>
                      </h3>
                    </div>
                    <p className="text-zinc-400 text-sm">
                      ML algorithms forecast participant activity patterns and predict outcomes. Optimizes engagement with behavioral insights.
                    </p>
                  </div>
                </div>
                
                {/* Data metrics footer */}
                <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Prediction</p>
                    <p className="text-[#E0FE10] font-mono">92.8% accuracy</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Data Points</p>
                    <p className="text-[#E0FE10] font-mono">240+ per user</p>
                  </div>
                </div>
              </div>
              
              {/* Social Integration */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm rounded-xl p-6 border border-zinc-800 hover:border-[#E0FE10]/50 transition-all duration-300 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="flex items-start gap-4">
                  {/* Hexagon icon container */}
                  <div className="relative">
                    <div className="w-14 h-14 relative">
                      <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl transform rotate-45"></div>
                      <div className="absolute inset-1 bg-zinc-900/80 rounded-lg transform rotate-45"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_3px_rgba(224,254,16,0.7)]">
                          <path d="M17 2H7a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5Z" />
                          <path d="M12 15.5A3.5 3.5 0 1 0 8.5 12a3.5 3.5 0 0 0 3.5 3.5Z" />
                          <path d="M18.5 6.5a1 1 0 1 0-1-1 1 1 0 0 0 1 1Z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                        SOCIAL INTEGRATION
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-300">VIRAL</span>
                      </h3>
                    </div>
                    <p className="text-zinc-400 text-sm">
                      One-tap social sharing with branded templates. Achievements generate automatic shareable content with partner attribution.
                    </p>
                  </div>
                </div>
                
                {/* Data metrics footer */}
                <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Share Rate</p>
                    <p className="text-[#E0FE10] font-mono">37.8%</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Networks</p>
                    <p className="text-[#E0FE10] font-mono">5 integrated</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Tech power metrics */}
            <div className="mt-10 bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 animate-fade-in-up animation-delay-600">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-zinc-500 uppercase">DATA PROCESSED</p>
                  <p className="text-2xl font-bold text-[#E0FE10] font-mono">2.4 TB+</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-zinc-500 uppercase">DAILY ACTIONS</p>
                  <p className="text-2xl font-bold text-[#E0FE10] font-mono">178K</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-zinc-500 uppercase">SERVER UPTIME</p>
                  <p className="text-2xl font-bold text-[#E0FE10] font-mono">99.997%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-zinc-500 uppercase">ML MODELS</p>
                  <p className="text-2xl font-bold text-[#E0FE10] font-mono">12</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* 7. Value for ATL Hills */}
        <section 
          ref={(el) => { sectionRefs.current[10] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-black px-6"
        >
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-12 text-white text-center animate-fade-in-up">
              Value for <span className="text-[#E0FE10]">Hills4ATL</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="space-y-6 animate-fade-in-up">
                <div className="flex items-start gap-4 bg-zinc-900/50 p-6 rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Rich Data Insights</h3>
                    <p className="text-zinc-300">
                      Gain unprecedented insights into your participants through QR check-ins. Access detailed analytics on workout behaviors, attendance patterns, and engagement metrics beyond basic demographics.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 bg-zinc-900/50 p-6 rounded-xl animate-fade-in-up animation-delay-300">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Global Reach Opportunity</h3>
                    <p className="text-zinc-300">
                      Expand beyond Atlanta with our collaborative digital platform. Connect with fitness enthusiasts worldwide through virtual challenges and global leaderboards.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 bg-zinc-900/50 p-6 rounded-xl animate-fade-in-up animation-delay-600">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Revenue Share</h3>
                    <p className="text-zinc-300">
                        Receive 30% of total round revenue with zero up-front cost. Based on our projections, that's approximately $17,700 in additional revenue for a 1,000-participant round.                   
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col justify-center items-center animate-fade-in-up animation-delay-300">
                <div className="bg-zinc-900/50 p-8 rounded-xl text-center mb-6">
                  <p className="text-5xl font-bold text-[#E0FE10] mb-2">100%</p>
                  <p className="text-xl text-white font-medium">Data Ownership</p>
                  <p className="text-zinc-400">of participant insights & analytics</p>
                </div>
                
                <div className="bg-zinc-900/50 p-6 rounded-xl text-center w-full">
                  <h3 className="text-xl font-bold text-white mb-3">Additional Benefits</h3>
                  <ul className="text-zinc-300 space-y-2 text-left">
                    <li className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2"></div>
                      <span>New foot traffic to your physical locations</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2"></div>
                      <span>Participant retention tracking and analytics</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2"></div>
                      <span>Exclusive featured partner status</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* 8. Value for Meal Prep Co */}
        <section 
          ref={(el) => { sectionRefs.current[11] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-zinc-900 px-6"
        >
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-12 text-white text-center animate-fade-in-up">
              Value for <span className="text-[#E0FE10]">Atlanta Meal Prep</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="space-y-6 animate-fade-in-up">
                <div className="flex items-start gap-4 bg-zinc-800/50 p-6 rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">New Customer Acquisition</h3>
                    <p className="text-zinc-300">
                      Directly connect with health-conscious consumers actively seeking nutrition solutions. Built-in cross-selling opportunities.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 bg-zinc-800/50 p-6 rounded-xl animate-fade-in-up animation-delay-300">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">In-App Integration & Incentives</h3>
                    <p className="text-zinc-300">
                      Your meals featured directly in the app with nutrition data and one-tap ordering. Points system rewards meal plan adherence and incentivizes recurring orders through gamified challenges.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 bg-zinc-800/50 p-6 rounded-xl animate-fade-in-up animation-delay-600">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Revenue Share</h3>
                    <p className="text-zinc-300">
                      Receive 30% of total round revenue with zero up-front cost. Based on our projections, that's approximately $17,700 in additional revenue for a 1,000-participant round.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col justify-center items-center animate-fade-in-up animation-delay-300">
                <div className="bg-zinc-800/50 p-8 rounded-xl text-center mb-6">
                  <p className="text-5xl font-bold text-[#E0FE10] mb-2">+125 Referral Orders</p>
                  <p className="text-xl text-white font-medium">Target Orders</p>
                  <p className="text-zinc-400">weekly during challenge</p>
                </div>

              </div>
            </div>
          </div>
        </section>
        
        {/* 9. Go-to-Market Playbook - Channel Strategy */}
        <section 
          ref={(el) => { sectionRefs.current[12] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-black px-6"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white text-center animate-fade-in-up">
              Go-to-Market <span className="text-[#E0FE10]">Playbook</span> — Channel Strategy
            </h2>
            
            <p className="text-center text-[#E0FE10] uppercase tracking-wide text-sm font-semibold mb-8 animate-fade-in-up animation-delay-150">
              It's just channel math.
            </p>
            
            {/* Funnel Table */}
            <div className="bg-zinc-900/70 rounded-xl p-6 animate-fade-in-up animation-delay-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="py-3 px-4 text-zinc-400 font-medium">Channel</th>
                      <th className="py-3 px-4 text-zinc-400 font-medium">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-zinc-800">
                      <td className="py-4 px-4 text-white">Pulse Email Database</td>
                      <td className="py-4 px-4 text-[#E0FE10] font-bold">300</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="py-4 px-4 text-white">ATL Hills Members</td>
                      <td className="py-4 px-4 text-[#E0FE10] font-bold">200</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="py-4 px-4 text-white">Atlanta Meal Prep Customers</td>
                      <td className="py-4 px-4 text-[#E0FE10] font-bold">150</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="py-4 px-4 text-white">Partner Social Media</td>
                      <td className="py-4 px-4 text-[#E0FE10] font-bold">180</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="py-4 px-4 text-white">Paid Advertising</td>
                      <td className="py-4 px-4 text-[#E0FE10] font-bold">100</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-4 text-white">Word of Mouth / Referrals</td>
                      <td className="py-4 px-4 text-[#E0FE10] font-bold">70</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-700">
                      <td className="py-4 px-4 text-white font-bold">Total</td>
                      <td className="py-4 px-4 text-[#E0FE10] font-bold text-xl">1,000</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* Progress bars */}
              <div className="mt-4 space-y-3 px-4">
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-zinc-400">Pulse Email Database</div>
                    <div className="text-xs text-zinc-400">300/1,000</div>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1">
                    <div className="bg-[#E0FE10] h-1 rounded-full" style={{ width: "30%" }}></div>
                  </div>
                </div>
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-zinc-400">ATL Hills Members</div>
                    <div className="text-xs text-zinc-400">200/1,000</div>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1">
                    <div className="bg-[#E0FE10] h-1 rounded-full" style={{ width: "20%" }}></div>
                  </div>
                </div>
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-zinc-400">Atlanta Meal Prep Customers</div>
                    <div className="text-xs text-zinc-400">150/1,000</div>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1">
                    <div className="bg-[#E0FE10] h-1 rounded-full" style={{ width: "15%" }}></div>
                  </div>
                </div>
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-zinc-400">Partner Social Media</div>
                    <div className="text-xs text-zinc-400">180/1,000</div>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1">
                    <div className="bg-[#E0FE10] h-1 rounded-full" style={{ width: "18%" }}></div>
                  </div>
                </div>
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-zinc-400">Paid Advertising</div>
                    <div className="text-xs text-zinc-400">100/1,000</div>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1">
                    <div className="bg-[#E0FE10] h-1 rounded-full" style={{ width: "10%" }}></div>
                  </div>
                </div>
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-zinc-400">Word of Mouth / Referrals</div>
                    <div className="text-xs text-zinc-400">70/1,000</div>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1">
                    <div className="bg-[#E0FE10] h-1 rounded-full" style={{ width: "7%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* 10. Go-to-Market Playbook - Responsibility Matrix */}
        <section 
          ref={(el) => { sectionRefs.current[13] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-zinc-900 px-6"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white text-center animate-fade-in-up">
              Go-to-Market <span className="text-[#E0FE10]">Playbook</span> — Team Responsibilities
            </h2>
            
            <p className="text-center text-[#E0FE10] uppercase tracking-wide text-sm font-semibold mb-8 animate-fade-in-up animation-delay-150">
              How we hit 1,000 participants together.
            </p>
            
            {/* Responsibility Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-in-up animation-delay-300">
              {/* Pulse */}
              <div className="relative bg-zinc-900/70 rounded-xl p-6 border border-zinc-800">
                <div className="absolute top-2 right-2 bg-[#E0FE10]/20 px-2 py-1 rounded-full">
                  <span className="text-xs text-[#E0FE10] font-medium">40% Pulse</span>
                </div>
                <div className="flex items-center mb-4">
                  <img src="/pulse-logo-white.svg" alt="Pulse" className="h-6 mr-2" />
                  <h4 className="text-lg font-bold text-white"></h4>
                </div>
                <ul className="space-y-2 text-zinc-300">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Platform & payment processing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Email marketing to 100K list</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Press tour facilitation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>QR discount cards & swag</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Gym + cardio programming</span>
                  </li>
                </ul>
              </div>
              
              {/* ATL Hills */}
              <div className="relative bg-zinc-900/70 rounded-xl p-6 border border-zinc-800">
                <div className="absolute top-2 right-2 bg-[#E0FE10]/20 px-2 py-1 rounded-full">
                  <span className="text-xs text-[#E0FE10] font-medium">35% ATL Hills</span>
                </div>
                <div className="flex items-center mb-4">
                  <img src="/Hills4ATL.png" alt="ATL Hills" className="h-6 mr-2" />
                  <h4 className="text-lg font-bold text-white"></h4>
                </div>
                <ul className="space-y-2 text-zinc-300">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Marketing at in-person events</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Social media promotion</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>QR card distribution to members</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Event schedule & point generation</span>
                  </li>
                </ul>
              </div>
              
              {/* Atlanta Meal Prep */}
              <div className="relative bg-zinc-900/70 rounded-xl p-6 border border-zinc-800">
                <div className="absolute top-2 right-2 bg-[#E0FE10]/20 px-2 py-1 rounded-full">
                  <span className="text-xs text-[#E0FE10] font-medium">25% Meal-Prep</span>
                </div>
                <div className="flex items-center mb-4">
                  <img src="/ATLMealPrep.svg" alt="Atlanta Meal Prep" className="h-6 mr-2" />
                  <h4 className="text-lg font-bold text-white"></h4>
                </div>
                <ul className="space-y-2 text-zinc-300">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Email marketing to customer base</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Flyers with food deliveries</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Social media promotion</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                    <span>Meal programming collaboration</span>
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Shared Responsibilities Banner */}
            <div className="bg-zinc-800/70 p-4 rounded-xl mb-6 animate-fade-in-up animation-delay-450">
              <h3 className="text-center text-white font-medium mb-2">Shared Promotional Responsibilities</h3>
              <p className="text-center text-zinc-400 text-sm">All partners commit to consistent social media promotion, community engagement, and optional individual press outreach.</p>
            </div>
            
            {/* Confidence Footer Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up animation-delay-600">
              <div className="bg-zinc-900/70 p-4 rounded-xl text-center">
                <p className="text-[#E0FE10] text-2xl font-bold mb-1">&gt;1,000</p>
                <p className="text-white font-medium">Seats forecasted</p>
              </div>
              <div className="bg-zinc-900/70 p-4 rounded-xl text-center">
                <p className="text-[#E0FE10] text-2xl font-bold mb-1">CAC &lt; $6</p>
                <p className="text-white font-medium">Projected</p>
                <p className="text-zinc-500 text-xs">after revenue share</p>
              </div>
              <div className="bg-zinc-900/70 p-4 rounded-xl text-center">
                <p className="text-[#E0FE10] text-2xl font-bold mb-1">3</p>
                <p className="text-white font-medium">Equal promotion partners</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* 11. Revenue Model */}
        <section 
          ref={(el) => { sectionRefs.current[14] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-[#0B0B0E] px-6"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white text-center animate-fade-in-up">
              Revenue <span className="text-[#E0FE10]">Model</span>
            </h2>
            
            <h4 className="text-xl text-center text-[#E0FE10] font-medium mb-8 animate-fade-in-up animation-delay-150">
              Zero Up-Front Cost — Three-Way Profit Share
            </h4>
            
            <div className="animate-fade-in-up animation-delay-300">
              {/* Round Access */}
              <div className="bg-zinc-900/70 rounded-xl overflow-hidden shadow-xl mb-8 max-w-2xl mx-auto">
                <div className="p-5 bg-zinc-800 border-b border-zinc-700">
                  <h3 className="text-xl font-bold text-white">Round Access</h3>
                </div>
                
                <div className="p-5 bg-zinc-900/80 border-b border-zinc-800">
                  <div className="flex justify-between items-center">
                    <p className="text-zinc-300 font-medium">Price</p>
                    <p className="text-[#E0FE10] font-bold">$59 one-time fee</p>
                  </div>
                  <p className="text-zinc-500 text-sm">per participant</p>
                </div>
                
                <div className="p-5 bg-zinc-900/50 border-b border-zinc-800">
                  <p className="text-zinc-300 font-medium mb-3">What Members Get</p>
                  <ul className="text-zinc-400 space-y-2 pl-1">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                      <span>4-week gym + cardio plan</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                      <span>AI-matched calorie targets</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                      <span>5 ATL Hills IRL events</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                      <span>Live leaderboard + rewards</span>
                    </li>
                  </ul>
                </div>
                
                <div className="p-5 bg-zinc-900/70">
                  <p className="text-zinc-300 font-medium mb-3">Partner Share</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-black/20 p-3 rounded-lg">
                      <p className="text-lg font-bold text-[#E0FE10]">40%</p>
                      <p className="text-zinc-400 text-sm">Pulse</p>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg">
                      <p className="text-lg font-bold text-[#E0FE10]">30%</p>
                      <p className="text-zinc-400 text-sm">ATL Hills</p>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg">
                      <p className="text-lg font-bold text-[#E0FE10]">30%</p>
                      <p className="text-zinc-400 text-sm">Atlanta Meal Prep</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Infographic Footer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up animation-delay-600">
              <div className="bg-zinc-900/60 p-5 rounded-xl text-center">
                <p className="text-[#E0FE10] text-3xl font-bold mb-1">$59K</p>
                <p className="text-white font-medium">Gross Revenue</p>
                <p className="text-zinc-500 text-sm">at full capacity</p>
              </div>
              <div className="bg-zinc-900/60 p-5 rounded-xl text-center">
                <p className="text-[#E0FE10] text-3xl font-bold mb-1">$17.7K</p>
                <p className="text-white font-medium">To Each Co-Host</p>
                <p className="text-zinc-500 text-sm">30% partner share</p>
              </div>
              <div className="bg-zinc-900/60 p-5 rounded-xl text-center">
                <p className="text-[#E0FE10] text-3xl font-bold mb-1">40%</p>
                <p className="text-white font-medium">Pulse Margin</p>
                <p className="text-zinc-500 text-sm">supports platform costs</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* 12. Financial Projections */}
        <section 
          ref={(el) => { sectionRefs.current[15] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-[#0B0B0E] px-6"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white text-center animate-fade-in-up">
              Financial <span className="text-[#E0FE10]">Projections</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 animate-fade-in-up animation-delay-300">
              {/* Left Column - At-a-Glance Figures */}
              <div className="bg-zinc-900/70 rounded-xl overflow-hidden shadow-xl">
                <div className="p-5 bg-zinc-800 border-b border-zinc-700">
                  <h3 className="text-xl font-bold text-white">At-a-Glance Figures</h3>
                </div>
                
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <p className="text-zinc-300">Target participation</p>
                    <p className="text-white font-medium">1,000 members</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-zinc-300">Projected gross revenue</p>
                    <p className="text-[#E0FE10] font-bold">$59,000</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-zinc-300">Each partner share</p>
                    <p className="text-white font-medium">$17,700</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-zinc-300">Pulse platform margin</p>
                    <p className="text-white font-medium">40%</p>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Market Validation */}
              <div className="bg-zinc-900/70 rounded-xl overflow-hidden shadow-xl border-l-2 border-[#E0FE10]/40">
                <div className="p-5">
                  <h3 className="text-lg font-bold text-white mb-3">Why $59 Hits the Sweet Spot</h3>
                  <ul className="text-zinc-400 space-y-3">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                      <span>Typical 4-week coached program $200-$500/mo <span className="text-zinc-500 text-xs">(HevyCoach & ISSA data)</span></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                      <span>Meal-plan add-ons alone average $150-$400/mo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                      <span>Our $59 price keeps fitness accessible while still projecting $59K gross on 1,000 sign-ups</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-900/70 rounded-xl p-6 mt-8 animate-fade-in-up animation-delay-600">
              <h3 className="text-xl font-bold text-white mb-4">Additional Revenue Opportunities</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center text-[#E0FE10] flex-shrink-0">1</div>
                  <div>
                    <p className="text-white font-medium">Membership Conversion</p>
                    <p className="text-zinc-400">Est. 25% of participants convert to ongoing Hills4ATL memberships</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center text-[#E0FE10] flex-shrink-0">2</div>
                  <div>
                    <p className="text-white font-medium">Recurring Meal Plans</p>
                    <p className="text-zinc-400">Est. 35% adoption of Atlanta Meal Prep subscriptions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* 13. Recurring Challenge Ecosystem */}
        <section 
          ref={(el) => { sectionRefs.current[16] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-black px-6 overflow-hidden"
        >
          {/* High-tech background elements */}
          <div className="absolute inset-0 z-0">
            {/* Animated grid background */}
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
            
            {/* Glowing orbs */}
            <div className="absolute top-20 left-20 w-64 h-64 bg-blue-500/10 rounded-full filter blur-[80px] animate-pulse-slow"></div>
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#E0FE10]/10 rounded-full filter blur-[100px] animate-pulse-slow animation-delay-2000"></div>
            
            {/* Random data points */}
            <div className="absolute top-0 left-0 w-full h-full">
              {Array.from({ length: 30 }).map((_, i) => (
                <div 
                  key={i}
                  className="absolute w-1 h-1 bg-[#E0FE10] rounded-full animate-pulse-fast"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`
                  }}
                ></div>
              ))}
            </div>
          </div>
          
          <div className="relative z-10 max-w-5xl mx-auto">
            {/* Cyberpunk-style heading */}
            <div className="text-center mb-8 animate-fade-in-up">
              <div className="inline-block relative">
                <h2 className="text-4xl md:text-6xl font-bold text-white relative z-10">
                  <span className="text-[#E0FE10] drop-shadow-[0_0_10px_rgba(224,254,16,0.7)]">360°</span> LIFESTYLE ENGINE
                </h2>
                <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#E0FE10] to-transparent"></div>
                <div className="absolute -top-2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#E0FE10] to-transparent"></div>
              </div>
              <p className="text-zinc-400 mt-4 uppercase tracking-widest text-sm">THE RECURRING CHALLENGE ECOSYSTEM</p>
            </div>
            
            {/* Cycle Visualization */}
            <div className="flex flex-col items-center justify-center mb-10 animate-fade-in-up animation-delay-300">
              <div className="relative w-64 h-64 md:w-80 md:h-80">
                {/* Outer circle */}
                <div className="absolute inset-0 rounded-full border-2 border-zinc-700 animate-spin-slow"></div>
                
                {/* Mid circle with pulsing dash pattern */}
                <div className="absolute inset-4 rounded-full border-2 border-dashed border-[#E0FE10]/50 animate-reverse-spin-slow"></div>
                
                {/* Inner circle */}
                <div className="absolute inset-8 rounded-full border border-zinc-700 animate-spin-slow animation-delay-2000"></div>
                
                {/* Center point */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-[#E0FE10]/10 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-[#E0FE10]/20 rounded-full flex items-center justify-center">
                    <div className="w-5 h-5 bg-[#E0FE10] rounded-full pulse-animation"></div>
                  </div>
                </div>
                
                {/* Cycle phase nodes */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 p-2 rounded-lg shadow-lg">
                  <p className="text-[#E0FE10] text-sm font-medium">45-Day Challenge</p>
                </div>
                
                <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 p-2 rounded-lg shadow-lg">
                  <p className="text-[#E0FE10] text-sm font-medium">Data Analysis</p>
                </div>
                
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-zinc-900 border border-zinc-700 p-2 rounded-lg shadow-lg">
                  <p className="text-[#E0FE10] text-sm font-medium">2-Week Cooldown</p>
                </div>
                
                <div className="absolute top-1/2 left-0 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 p-2 rounded-lg shadow-lg">
                  <p className="text-[#E0FE10] text-sm font-medium">AI Optimization</p>
                </div>
              </div>
            </div>
            
            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up animation-delay-600">
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm rounded-xl p-6 border border-zinc-800 hover:border-[#E0FE10]/50 transition-all duration-300 group">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#E0FE10]/10 flex items-center justify-center text-[#E0FE10]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Seasonal Cadence</h3>
                    <p className="text-zinc-400 text-sm">
                      Set custom intervals year-round or align with seasonal fitness goals for maximum engagement and retention.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm rounded-xl p-6 border border-zinc-800 hover:border-[#E0FE10]/50 transition-all duration-300 group">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#E0FE10]/10 flex items-center justify-center text-[#E0FE10]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">AI-Powered Evolution</h3>
                    <p className="text-zinc-400 text-sm">
                      Machine learning algorithms create increasingly personalized plans with each cycle, minimizing manual intervention.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 backdrop-blur-sm rounded-xl p-6 border border-zinc-800 hover:border-[#E0FE10]/50 transition-all duration-300 group">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#E0FE10]/10 flex items-center justify-center text-[#E0FE10]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Community Momentum</h3>
                    <p className="text-zinc-400 text-sm">
                      Recurring rounds foster stronger community bonds, with retention rates 4x higher than one-time challenges.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Key Metrics */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in-up animation-delay-900">
              <div className="bg-black/50 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-[#E0FE10] text-3xl font-bold">$250K+</p>
                <p className="text-zinc-400 text-sm">Annual Revenue Potential</p>
              </div>
              <div className="bg-black/50 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-[#E0FE10] text-3xl font-bold">74%</p>
                <p className="text-zinc-400 text-sm">Re-enrollment Rate</p>
              </div>
              <div className="bg-black/50 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-[#E0FE10] text-3xl font-bold">~$3</p>
                <p className="text-zinc-400 text-sm">Decreasing CAC</p>
              </div>
              <div className="bg-black/50 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-[#E0FE10] text-3xl font-bold">-85%</p>
                <p className="text-zinc-400 text-sm">Admin Time Per Cycle</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* 14. Timeline & Milestones */}
        <section 
          ref={(el) => { sectionRefs.current[17] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-black px-6"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-12 text-white text-center animate-fade-in-up">
              Timeline & <span className="text-[#E0FE10]">Milestones</span>
            </h2>
            
            <div className="relative animate-fade-in-up animation-delay-300">
              {/* Horizontal Timeline */}
              <div className="hidden md:block">
                <div className="flex items-center justify-between relative mb-16">
                  {/* Timeline Track */}
                  <div className="absolute h-1 bg-zinc-700 w-full top-1/2 -translate-y-1/2"></div>
                  
                  {/* Sign-off */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-[#E0FE10] flex items-center justify-center mb-4 z-10 relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                        <path d="M5 12h14"></path>
                        <path d="M12 5v14"></path>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">Sign-off</p>
                      <p className="text-zinc-400">Week 1</p>
                    </div>
                  </div>
                  
                  {/* Promo Blitz */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 z-10 relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E0FE10]">
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">Promo Blitz</p>
                      <p className="text-zinc-400">Weeks 2-3</p>
                    </div>
                  </div>
                  
                  {/* Kick-off */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 z-10 relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E0FE10]">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polygon points="10 8 16 12 10 16 10 8"></polygon>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">Kick-off</p>
                      <p className="text-zinc-400">Week 4</p>
                    </div>
                  </div>
                  
                  {/* Finale */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 z-10 relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E0FE10]">
                        <path d="M12 2v4"></path>
                        <path d="M12 18v4"></path>
                        <path d="m4.93 4.93 2.83 2.83"></path>
                        <path d="m16.24 16.24 2.83 2.83"></path>
                        <path d="M2 12h4"></path>
                        <path d="M18 12h4"></path>
                        <path d="m4.93 19.07 2.83-2.83"></path>
                        <path d="m16.24 7.76 2.83-2.83"></path>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">Finale</p>
                      <p className="text-zinc-400">Week 8</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Mobile Timeline (Vertical) */}
              <div className="md:hidden space-y-8">
                {[
                  { title: 'Sign-off', timeframe: 'Week 1', isActive: true },
                  { title: 'Promo Blitz', timeframe: 'Weeks 2-3', isActive: false },
                  { title: 'Kick-off', timeframe: 'Week 4', isActive: false },
                  { title: 'Finale', timeframe: 'Week 8', isActive: false }
                ].map((milestone, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full ${milestone.isActive ? 'bg-[#E0FE10]' : 'bg-zinc-800'} flex-shrink-0 flex items-center justify-center text-${milestone.isActive ? 'black' : '[#E0FE10]'} font-bold`}>
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{milestone.title}</h3>
                      <p className="text-zinc-400">{milestone.timeframe}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up animation-delay-600">
              <div className="bg-zinc-900/50 p-6 rounded-xl">
                <h3 className="text-xl font-bold text-white mb-4">Pre-Launch Phase</h3>
                <ul className="space-y-3 text-zinc-300">
                  <li className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2 mt-2"></div>
                    <span>Partner content creation & approval</span>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2 mt-2"></div>
                    <span>Technical integration of tracking systems</span>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2 mt-2"></div>
                    <span>Staff training on app features</span>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2 mt-2"></div>
                    <span>Early access for VIP members</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-zinc-900/50 p-6 rounded-xl">
                <h3 className="text-xl font-bold text-white mb-4">Launch & Maintenance</h3>
                <ul className="space-y-3 text-zinc-300">
                  <li className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2 mt-2"></div>
                    <span>Kickoff event with all partners</span>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2 mt-2"></div>
                    <span>Weekly engagement emails & push notifications</span>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2 mt-2"></div>
                    <span>Mid-challenge special event</span>
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-[#E0FE10] mr-2 mt-2"></div>
                    <span>Finale celebration & awards ceremony</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
        
        {/* 15. What We Need From You */}
        <section 
          ref={(el) => { sectionRefs.current[18] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-zinc-900 px-6"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-12 text-white text-center animate-fade-in-up">
              What We Need <span className="text-[#E0FE10]">From You</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in-up animation-delay-300">
              <div className="bg-zinc-800/80 p-6 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold text-xl mb-6">
                  1
                </div>
                <h3 className="text-white text-xl font-bold mb-3">Sign-off & Official Partnership</h3>
                <ul className="space-y-2 text-zinc-400">
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Partnership agreement signed by all three parties</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Official announcement coordination</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Logo/brand assets sharing</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-zinc-800/80 p-6 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold text-xl mb-6">
                  2
                </div>
                <h3 className="text-white text-xl font-bold mb-3">Content Coordination</h3>
                <ul className="space-y-2 text-zinc-400">
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Workout & meal plan schedule integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Social media promotion calendar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Workout & nutrition content creation</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-zinc-800/80 p-6 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold text-xl mb-6">
                  3
                </div>
                <h3 className="text-white text-xl font-bold mb-3">Technical Integration</h3>
                <ul className="space-y-2 text-zinc-400">
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>API integration for meal ordering</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Payment processing setup</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>QR codes for partner communities</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="mt-12 text-center animate-fade-in-up animation-delay-600">
              <a href="#" className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-black bg-[#E0FE10] hover:bg-[#E0FE10]/90">
                Ready to move forward? Let's talk
              </a>
            </div>
          </div>
        </section>
        
        {/* 16. Next Steps */}
        <section 
          ref={(el) => { sectionRefs.current[19] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative bg-zinc-900 px-6"
        >
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white text-center animate-fade-in-up">
              Next Steps
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 animate-fade-in-up animation-delay-300">
              <div className="bg-zinc-800/80 p-6 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold text-xl mb-6">
                  1
                </div>
                <h3 className="text-white text-xl font-bold mb-3">Sign-off & Official Partnership</h3>
                <ul className="space-y-2 text-zinc-400">
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Partnership agreement signed by all three parties</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Official announcement coordination</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Logo/brand assets sharing</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-zinc-800/80 p-6 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold text-xl mb-6">
                  2
                </div>
                <h3 className="text-white text-xl font-bold mb-3">Content Coordination</h3>
                <ul className="space-y-2 text-zinc-400">
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Workout & meal plan schedule integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Social media promotion calendar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Workout & nutrition content creation</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-zinc-800/80 p-6 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center text-black font-bold text-xl mb-6">
                  3
                </div>
                <h3 className="text-white text-xl font-bold mb-3">Technical Integration</h3>
                <ul className="space-y-2 text-zinc-400">
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>API integration for meal ordering</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Payment processing setup</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>QR codes for partner communities</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="mt-12 text-center animate-fade-in-up animation-delay-600">
              <a href="#" className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-black bg-[#E0FE10] hover:bg-[#E0FE10]/90">
                Ready to move forward? Let's talk
              </a>
            </div>
          </div>
        </section>
        
        {/* 17. Closing & CTA */}
        <section 
          ref={(el) => { sectionRefs.current[20] = el as HTMLDivElement; }}
          className="h-screen w-full snap-start flex flex-col items-center justify-center relative overflow-hidden"
          style={{ 
            backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url("/atl_skyline_fitness.jpg")', 
            backgroundSize: 'cover', 
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-70"></div>
          
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <div className="animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-white">
                "When Atlanta moves and fuels together, everyone wins."
              </h2>
              
              <p className="text-xl text-zinc-300 mb-12 max-w-2xl mx-auto">
                Let's create a fitness movement that transforms Atlanta's wellness landscape while driving growth for all partners involved.
              </p>
              
              <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                <button className="px-10 py-5 bg-[#E0FE10] hover:bg-[#d8f521] text-black text-xl font-bold rounded-lg transition-all duration-300 transform hover:scale-105">
                  Yes, Let's Co-Host!
                </button>
                
                <button 
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className="px-10 py-5 border-2 border-[#E0FE10] hover:bg-[#E0FE10]/10 text-[#E0FE10] text-xl font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {isGeneratingPDF ? (
                    <>
                      <div className="w-5 h-5 border-2 border-t-transparent border-[#E0FE10] rounded-full animate-spin"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download PDF
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="mt-16 grid grid-cols-3 gap-8 animate-fade-in-up animation-delay-600">
              <div className="flex flex-col items-center">
                <img src="/pulse-logo-white.svg" alt="Pulse Logo" className="h-12 w-auto mb-2" />
                <p className="text-zinc-400 text-sm">Pulse</p>
              </div>
              <div className="flex flex-col items-center">
                <img src="/Hills4ATL.png" alt="Hills4ATL Logo" className="h-12 w-auto mb-2" />
                <p className="text-zinc-400 text-sm">Hills4ATL</p>
              </div>
              <div className="flex flex-col items-center">
                <img src="/ATLMealPrep.svg" alt="Atlanta Meal Prep Logo" className="h-12 w-auto mb-2" />
                <p className="text-zinc-400 text-sm">Atlanta Meal Prep</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Add download button at the bottom - always visible */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <button 
          onClick={handleDownloadPDF}
          disabled={isGeneratingPDF}
          className={`flex items-center bg-[#E0FE10] text-black font-medium ${isMobile ? 'text-sm px-3 py-1.5' : 'px-4 py-2'} rounded-full shadow-lg hover:bg-[#E0FE10]/90 transition-all disabled:opacity-70`}
        >
          {isGeneratingPDF ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
              Generating PDF...
            </>
          ) : (
            <>
              <Download size={isMobile ? 14 : 16} className="mr-2" />
              Download Presentation
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default MoveAndFuelATL; 

export const getServerSideProps: GetServerSideProps<MoveAndFuelATLProps> = async (context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('MoveAndFuelATL');
  } catch (error) {
    console.error("Error fetching page meta data for MoveAndFuelATL page:", error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
}; 