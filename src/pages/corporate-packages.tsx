import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Check, Users, Target, TrendingUp, Award, Building2, Zap, Globe, Mail, Calendar } from 'lucide-react';
import Header from '../components/Header';
import PageHead from '../components/PageHead';
import { GetServerSideProps } from 'next';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

// Define a serializable version of PageMetaData for this page's props
interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface CorporatePackagesProps {
  metaData: SerializablePageMetaData | null;
}

const CorporatePackages = ({ metaData }: CorporatePackagesProps) => {
  const [activeSection, setActiveSection] = useState(0);
  const [_isMobileMenuOpen, _setIsMobileMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const totalSections = 8;
  const sectionRefs = useRef<(HTMLDivElement | null)[]>(Array(totalSections).fill(null));
  
  // Check if we're on mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isMobile) return;
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
  
  // Use Intersection Observer to detect which section is visible
  useEffect(() => {
    let isTransitioning = false;
    let transitionTimer: NodeJS.Timeout | undefined;
    
    let debounceTimer: NodeJS.Timeout | undefined;
    const setActiveWithDebounce = (newIndex: number) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      
      if (!isTransitioning && newIndex !== activeSection) {
        isTransitioning = true;
        setActiveSection(newIndex);
        
        transitionTimer = setTimeout(() => {
          isTransitioning = false;
        }, 700);
      }
    };
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (isTransitioning || isNavigating) return;
        
        const significantEntries = entries.filter(entry => entry.intersectionRatio > 0.5);
        
        if (significantEntries.length > 0) {
          const mostVisibleEntry = significantEntries.sort(
            (a, b) => b.intersectionRatio - a.intersectionRatio
          )[0];
          
          const sectionIndex = parseInt(mostVisibleEntry.target.getAttribute('data-section') || '0');
          setActiveWithDebounce(sectionIndex);
        }
      },
      {
        threshold: [0.1, 0.3, 0.5, 0.7, 0.9],
        rootMargin: '-10% 0px -10% 0px'
      }
    );
    
    sectionRefs.current.forEach((ref, index) => {
      if (ref) {
        ref.setAttribute('data-section', index.toString());
        observer.observe(ref);
      }
    });
    
    return () => {
      observer.disconnect();
      if (transitionTimer) clearTimeout(transitionTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [activeSection, isNavigating]);
  
  const navigateToSection = (index: number) => {
    if (index < 0 || index >= totalSections) return;
    
    setIsNavigating(true);
    if (sectionRefs.current[index]) {
      sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
      
      const resetTimer = setTimeout(() => {
        setIsNavigating(false);
      }, 1000);
      
      return () => clearTimeout(resetTimer);
    }
  };
  
  // Function to generate consistent section classes
  const getSectionClasses = (bgColor: string = 'bg-zinc-950') => {
    if (isMobile) {
      return `w-full relative py-16 px-6 mb-24 ${bgColor}`;
    } else {
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
        pageOgUrl="https://fitwithpulse.ai/corporate-packages"
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
      
      {/* Vertical Progress Indicator */}
      <div className="fixed right-2 md:right-6 top-1/2 transform -translate-y-1/2 z-50 flex flex-col items-end space-y-2 md:space-y-3">
        {Array.from({ length: totalSections }).map((_, index) => (
          <div key={index} className="flex items-center group">
            <span className={`mr-1 md:mr-2 text-[10px] md:text-xs font-medium transition-opacity duration-200 ${
              activeSection === index 
                ? 'text-[#E0FE10] opacity-100' 
                : 'text-white opacity-0 group-hover:opacity-100'
            }`}>
              {index + 1}
            </span>
            
            <button
              onClick={() => navigateToSection(index)}
              className={`relative rounded-full transition-all duration-300 flex items-center justify-center ${
                activeSection === index 
                  ? 'bg-[#E0FE10] w-4 h-4 md:w-6 md:h-6 shadow-[0_0_10px_rgba(224,254,16,0.7)]' 
                  : 'bg-zinc-600 hover:bg-zinc-400 w-2 h-2 md:w-3 md:h-3'
              }`}
              aria-label={`Navigate to section ${index + 1}`}
            >
              {activeSection === index && (
                <span className="text-[6px] md:text-[8px] font-bold text-black">{index + 1}</span>
              )}
              
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
      
      {/* Main content */}
      <main id="main-content" className={isMobile ? "relative pb-24 overflow-visible" : "snap-y snap-mandatory h-screen overflow-y-scroll"}>
        
        {/* 1. Hero Section */}
        <section 
          ref={(el) => { sectionRefs.current[0] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
          style={{ 
            backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url("/corporate-hero-bg.jpg")', 
            backgroundSize: 'cover', 
            backgroundPosition: 'center'
          }}
        >
          <div className={`${getContentClasses()} ${!isMobile ? 'z-10' : ''}`}>
            <h1 className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl'} font-bold mb-6 text-white animate-fade-in-up`}>
              Corporate <span className="text-[#E0FE10]">Partnerships</span>
            </h1>
            <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-3xl'} mb-8 text-white animate-fade-in-up animation-delay-300`}>
              Partner with the future of social fitness
            </p>
            <p className="text-lg md:text-xl mb-12 text-zinc-300 animate-fade-in-up animation-delay-600">
              Join forces with <span className="text-[#E0FE10]">Pulse</span> to create meaningful connections, 
              drive employee wellness, and build communities that thrive.
            </p>
            
            <div className="inline-block border border-[#E0FE10] rounded-full px-4 py-2 mb-8 animate-fade-in-up animation-delay-750">
              <p className="text-[#E0FE10] text-sm md:text-base font-medium">
                800+ Members • 61% Retention • K-factor 1.27
              </p>
            </div>
          </div>
        </section>
        
        {/* 2. Why Partner With Pulse */}
        <section 
          ref={(el) => { sectionRefs.current[1] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className={getContentClasses()}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              Why Partner With <span className="text-[#E0FE10]">Pulse</span>
            </h2>
            <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} mb-12 text-zinc-300 animate-fade-in-up animation-delay-300 max-w-3xl mx-auto`}>
              Pulse is revolutionizing how people connect through fitness. Our social-first approach creates 
              authentic communities that drive real engagement and measurable results.
            </p>
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 animate-fade-in-up animation-delay-600">
              <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors">
                <div className="flex items-center justify-center mb-2">
                  <Users className="w-6 h-6 text-[#E0FE10] mr-2" />
                  <span className="text-3xl font-bold text-white">808</span>
                </div>
                <p className="text-zinc-400">Active Members</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="w-6 h-6 text-[#E0FE10] mr-2" />
                  <span className="text-3xl font-bold text-white">61%</span>
                </div>
                <p className="text-zinc-400">Retention Rate</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-800/80 transition-colors">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="w-6 h-6 text-[#E0FE10] mr-2" />
                  <span className="text-3xl text-white font-bold">1.27</span>
                </div>
                <p className="text-zinc-400">K-Factor Growth</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* 3. Partnership Packages */}
        <section 
          ref={(el) => { sectionRefs.current[2] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className={getContentClasses()}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              Partnership <span className="text-[#E0FE10]">Packages</span>
            </h2>
            <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} mb-12 text-zinc-300 animate-fade-in-up animation-delay-300 max-w-3xl mx-auto`}>
              Choose the partnership model that aligns with your organization's goals and budget.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in-up animation-delay-600">
              {/* Technology Integration Package */}
              <div className="bg-zinc-800/50 rounded-xl p-8 border border-zinc-700 hover:border-[#E0FE10]/30 transition-colors">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mr-4">
                    <Building2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Technology Integration</h3>
                </div>
                <p className="text-zinc-400 mb-6">
                  Integrate Pulse's social fitness platform into your existing wellness programs with custom API access and branded experiences.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>API access to workout library</span>
                  </li>
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Custom branded experiences</span>
                  </li>
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>White-label social features</span>
                  </li>
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Analytics dashboard</span>
                  </li>
                </ul>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white mb-2">$25K - $100K+</p>
                  <p className="text-zinc-400 text-sm">Investment range</p>
                </div>
              </div>
              
              {/* Content Partnership Package */}
              <div className="bg-gradient-to-br from-[#E0FE10]/10 to-[#E0FE10]/5 border-2 border-[#E0FE10]/30 rounded-xl p-8 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-[#E0FE10] text-black px-4 py-1 rounded-full text-sm font-bold">
                    MOST POPULAR
                  </span>
                </div>
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-[#E0FE10]/20 rounded-lg flex items-center justify-center mr-4">
                    <Target className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Content Partnership</h3>
                </div>
                <p className="text-zinc-400 mb-6">
                  Co-create branded workout challenges and content that engages your audience while building authentic community connections.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Co-branded workout challenges</span>
                  </li>
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Cross-platform content sharing</span>
                  </li>
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Influencer collaboration</span>
                  </li>
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Performance analytics</span>
                  </li>
                </ul>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white mb-2">$10K - $50K</p>
                  <p className="text-zinc-400 text-sm">Investment range</p>
                </div>
              </div>
              
              {/* Strategic Alliance Package */}
              <div className="bg-zinc-800/50 rounded-xl p-8 border border-zinc-700 hover:border-[#E0FE10]/30 transition-colors">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mr-4">
                    <Globe className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Strategic Alliance</h3>
                </div>
                <p className="text-zinc-400 mb-6">
                  Deep integration partnership with shared resources, joint marketing initiatives, and long-term strategic alignment.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Joint product development</span>
                  </li>
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Shared marketing resources</span>
                  </li>
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Revenue sharing model</span>
                  </li>
                  <li className="flex items-center text-zinc-300">
                    <Check className="w-5 h-5 text-[#E0FE10] mr-3 flex-shrink-0" />
                    <span>Executive advisory access</span>
                  </li>
                </ul>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white mb-2">$100K+</p>
                  <p className="text-zinc-400 text-sm">Investment range</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* 4. Success Stories */}
        <section 
          ref={(el) => { sectionRefs.current[3] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className={getContentClasses()}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              Partnership <span className="text-[#E0FE10]">Success Stories</span>
            </h2>
            <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} mb-12 text-zinc-300 animate-fade-in-up animation-delay-300 max-w-3xl mx-auto`}>
              See how organizations are leveraging Pulse to build stronger, healthier communities through our Tier 1 partnerships.
            </p>
            
            {/* Case Studies - Tabbed Interface */}
            <div className="animate-fade-in-up animation-delay-600">
              {/* Tab Navigation */}
              <div className="flex justify-center mb-8">
                <div className="bg-zinc-800/50 rounded-lg p-1 flex space-x-1">
                  <button 
                    onClick={() => setActiveTab(0)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 0 
                        ? 'bg-[#E0FE10] text-black' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                    }`}
                  >
                    SoulCycle × Jaidus
                  </button>
                  <button 
                    onClick={() => setActiveTab(1)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 1 
                        ? 'bg-blue-500 text-white' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                    }`}
                  >
                    SoulCycle × Co-Hosted
                  </button>
                  <button 
                    onClick={() => setActiveTab(2)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 2 
                        ? 'bg-purple-500 text-white' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                    }`}
                  >
                    Pulse Mobility
                  </button>
                </div>
              </div>
              
              {/* Case Study Content */}
              <div className="relative">
                {/* Case Study 1: SoulCycle × Jaidus Mondesir */}
                {activeTab === 0 && (
                  <div className="bg-zinc-800/50 rounded-xl p-8 border-l-4 border-[#E0FE10]">
                    <div className="flex items-center mb-6">
                      <div className="w-16 h-16 bg-red-500/20 rounded-lg flex items-center justify-center mr-4">
                        <span className="text-red-400 text-2xl font-bold">SC</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">SoulCycle × Jaidus Mondesir</h3>
                        <p className="text-zinc-400">30-Day Ab Challenge</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-lg font-semibold text-[#E0FE10] mb-3">Challenge</h4>
                          <p className="text-zinc-300">
                            SoulCycle instructor Jaidus Mondesir wanted to extend his influence beyond the bike, 
                            showcasing his personality and coaching style to a broader audience while building his 
                            personal brand complementary to SoulCycle's values.
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-lg font-semibold text-[#E0FE10] mb-3">Solution</h4>
                          <p className="text-zinc-300">
                            Pulse collaborated closely with Jaidus over two months to co-design the inaugural 
                            "30-Day Ab Challenge," building new platform features, filming elevated studio content, 
                            and integrating promotional assets across social channels.
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-lg font-semibold text-[#E0FE10] mb-6">Results</h4>
                        <div className="grid grid-cols-2 gap-6 mb-6">
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-[#E0FE10] text-3xl font-bold">50</p>
                            <p className="text-zinc-400 text-sm">Official Sign-ups</p>
                          </div>
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-[#E0FE10] text-3xl font-bold">30%</p>
                            <p className="text-zinc-400 text-sm">New to SoulCycle</p>
                          </div>
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-[#E0FE10] text-3xl font-bold">4</p>
                            <p className="text-zinc-400 text-sm">Studio Conversions</p>
                          </div>
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-[#E0FE10] text-3xl font-bold">2</p>
                            <p className="text-zinc-400 text-sm">Months Collaboration</p>
                          </div>
                        </div>
                        <p className="text-zinc-300 text-sm bg-zinc-900/30 rounded-lg p-4">
                          The challenge successfully identified Jaidus's "power users" and demonstrated 
                          Pulse's ability to drive real-world traffic to partner communities.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Case Study 2: SoulCycle × Vynessa Smith & Jaidus Mondesir */}
                {activeTab === 1 && (
                  <div className="bg-zinc-800/50 rounded-xl p-8 border-l-4 border-blue-500">
                    <div className="flex items-center mb-6">
                      <div className="w-16 h-16 bg-blue-500/20 rounded-lg flex items-center justify-center mr-4">
                        <span className="text-blue-400 text-2xl font-bold">SC</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">SoulCycle × Vynessa Smith & Jaidus Mondesir</h3>
                        <p className="text-zinc-400">30-Day Squat Challenge (Co-Hosted)</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-lg font-semibold text-blue-400 mb-3">Challenge</h4>
                          <p className="text-zinc-300">
                            Building on the first Round's success, SoulCycle instructor Vynessa Smith sought to create 
                            a women-focused glute strength challenge, partnering with Jaidus to cross-pollinate audiences 
                            and test co-hosting dynamics.
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-lg font-semibold text-blue-400 mb-3">Solution</h4>
                          <p className="text-zinc-300">
                            Pulse enhanced its platform to support co-hosting and collaborative editing, allowing 
                            both instructors to build content together while integrating feedback from the prior challenge.
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-lg font-semibold text-blue-400 mb-6">Results</h4>
                        <div className="grid grid-cols-2 gap-6 mb-6">
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-blue-400 text-3xl font-bold">37</p>
                            <p className="text-zinc-400 text-sm">New Challengers</p>
                          </div>
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-blue-400 text-3xl font-bold">87</p>
                            <p className="text-zinc-400 text-sm">Total Participants</p>
                          </div>
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-blue-400 text-3xl font-bold">30</p>
                            <p className="text-zinc-400 text-sm">Days Duration</p>
                          </div>
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-blue-400 text-3xl font-bold">2</p>
                            <p className="text-zinc-400 text-sm">Co-Hosts</p>
                          </div>
                        </div>
                        <p className="text-zinc-300 text-sm bg-zinc-900/30 rounded-lg p-4">
                          This challenge validated co-creator dynamics and provided insights on optimal challenge 
                          length and intensity for broader audience accessibility.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Case Study 3: Pulse Mobility Challenge */}
                {activeTab === 2 && (
                  <div className="bg-zinc-800/50 rounded-xl p-8 border-l-4 border-purple-500">
                    <div className="flex items-center mb-6">
                      <div className="w-16 h-16 bg-purple-500/20 rounded-lg flex items-center justify-center mr-4">
                        <span className="text-purple-400 text-2xl font-bold">PM</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">Pulse Mobility Challenge</h3>
                        <p className="text-zinc-400">90-Day Prize Pot Challenge</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-lg font-semibold text-purple-400 mb-3">Challenge</h4>
                          <p className="text-zinc-300">
                            Pulse launched its first 90-day Morning Mobility Challenge to test new platform features, 
                            community behaviors, and introduce the "prize pot" system with a $1,000 cash reward.
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-lg font-semibold text-purple-400 mb-3">Solution</h4>
                          <p className="text-zinc-300">
                            Using Stripe Connect, Pulse enabled hosts to configure and hold prize funds in escrow, 
                            while expanding into wellness and mobility content beyond traditional strength training.
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-lg font-semibold text-purple-400 mb-6">Results</h4>
                        <div className="grid grid-cols-2 gap-6 mb-6">
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-purple-400 text-3xl font-bold">83</p>
                            <p className="text-zinc-400 text-sm">Total Participants</p>
                          </div>
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-purple-400 text-3xl font-bold">65%</p>
                            <p className="text-zinc-400 text-sm">Referral Growth</p>
                          </div>
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-purple-400 text-3xl font-bold">$1K</p>
                            <p className="text-zinc-400 text-sm">Prize Pot</p>
                          </div>
                          <div className="text-center bg-zinc-900/50 rounded-lg p-4">
                            <p className="text-purple-400 text-3xl font-bold">6</p>
                            <p className="text-zinc-400 text-sm">K-Factor</p>
                          </div>
                        </div>
                        <p className="text-zinc-300 text-sm bg-zinc-900/30 rounded-lg p-4">
                          The challenge demonstrated Pulse's power users, validated payouts as a scalable feature, 
                          and proved the platform's ability to innovate with gamification across diverse fitness categories.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        
        {/* 5. Partnership Benefits */}
        <section 
          ref={(el) => { sectionRefs.current[4] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className={getContentClasses()}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              Partnership <span className="text-[#E0FE10]">Benefits</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-fade-in-up animation-delay-300">
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#E0FE10]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Community Building</h3>
                    <p className="text-zinc-400">
                      Create authentic connections within your organization through shared fitness experiences and challenges.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#E0FE10]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Measurable Results</h3>
                    <p className="text-zinc-400">
                      Track engagement, participation, and wellness outcomes with detailed analytics and reporting.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#E0FE10]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Brand Alignment</h3>
                    <p className="text-zinc-400">
                      Associate your brand with innovation, community, and positive lifestyle choices.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#E0FE10]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Scalable Platform</h3>
                    <p className="text-zinc-400">
                      Leverage our proven technology stack that scales from small teams to enterprise organizations.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#E0FE10]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Globe className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Cross-Platform Reach</h3>
                    <p className="text-zinc-400">
                      Engage users across iOS, Android, and web platforms with consistent, high-quality experiences.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#E0FE10]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Target className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Custom Solutions</h3>
                    <p className="text-zinc-400">
                      Work with our team to develop tailored solutions that meet your specific needs and objectives.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* 6. Implementation Process */}
        <section 
          ref={(el) => { sectionRefs.current[5] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className={getContentClasses()}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              Implementation <span className="text-[#E0FE10]">Process</span>
            </h2>
            <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} mb-12 text-zinc-300 animate-fade-in-up animation-delay-300 max-w-3xl mx-auto`}>
              Our streamlined process ensures a smooth partnership launch and maximum impact.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 animate-fade-in-up animation-delay-600">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#E0FE10]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-[#E0FE10] text-2xl font-bold">1</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Discovery</h3>
                <p className="text-zinc-400 text-sm">
                  We learn about your goals, audience, and requirements to design the perfect partnership.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-[#E0FE10]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-[#E0FE10] text-2xl font-bold">2</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Strategy</h3>
                <p className="text-zinc-400 text-sm">
                  We develop a customized partnership strategy with clear objectives and success metrics.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-[#E0FE10]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-[#E0FE10] text-2xl font-bold">3</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Launch</h3>
                <p className="text-zinc-400 text-sm">
                  We execute the partnership launch with full support and dedicated project management.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-[#E0FE10]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-[#E0FE10] text-2xl font-bold">4</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Optimize</h3>
                <p className="text-zinc-400 text-sm">
                  We continuously monitor performance and optimize for maximum engagement and results.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* 7. Get Started */}
        <section 
          ref={(el) => { sectionRefs.current[6] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className={getContentClasses()}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white animate-fade-in-up`}>
              Ready to <span className="text-[#E0FE10]">Partner</span>?
            </h2>
            <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} mb-12 text-zinc-300 animate-fade-in-up animation-delay-300 max-w-3xl mx-auto`}>
              Let's discuss how Pulse can help your organization build stronger, healthier communities.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up animation-delay-600">
              <div className="bg-zinc-800/50 rounded-xl p-8">
                <div className="flex items-center mb-6">
                  <Mail className="w-8 h-8 text-[#E0FE10] mr-4" />
                  <h3 className="text-xl font-bold text-white">Contact Our Team</h3>
                </div>
                <p className="text-zinc-400 mb-6">
                  Reach out to discuss partnership opportunities and learn more about how Pulse can support your goals.
                </p>
                <a 
                  href="mailto:partnerships@fitwithpulse.ai?subject=Corporate Partnership Inquiry"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#E0FE10] text-black font-medium rounded-lg hover:bg-[#d8f521] transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  Send Email
                </a>
              </div>
              
              <div className="bg-zinc-800/50 rounded-xl p-8">
                <div className="flex items-center mb-6">
                  <Calendar className="w-8 h-8 text-[#E0FE10] mr-4" />
                  <h3 className="text-xl font-bold text-white">Schedule a Call</h3>
                </div>
                <p className="text-zinc-400 mb-6">
                  Book a 30-minute consultation to explore partnership opportunities and answer your questions.
                </p>
                <a 
                  href="https://calendly.com/tre-aqo7/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Calendar className="w-5 h-5" />
                  Schedule Call
                </a>
              </div>
            </div>
          </div>
        </section>
        
        {/* 8. Footer CTA */}
        <section 
          ref={(el) => { sectionRefs.current[7] = el as HTMLDivElement; }}
          className={`${getSectionClasses('bg-transparent')} overflow-hidden`}
          style={{ 
            backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8)), url("/corporate-footer-bg.jpg")', 
            backgroundSize: 'cover', 
            backgroundPosition: 'center'
          }}
        >
          <div className={`${getContentClasses()} ${!isMobile ? 'z-10' : ''}`}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white animate-fade-in-up`}>
              Let's Build Something <span className="text-[#E0FE10]">Amazing</span> Together
            </h2>
            <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} mb-8 text-zinc-300 animate-fade-in-up animation-delay-300`}>
              Join the organizations already partnering with Pulse to create healthier, more connected communities.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-600">
              <a 
                href="mailto:partnerships@fitwithpulse.ai?subject=Corporate Partnership Inquiry"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#E0FE10] text-black font-bold rounded-lg hover:bg-[#d8f521] transition-colors"
              >
                <Mail className="w-5 h-5" />
                Start Partnership Discussion
              </a>
              <a 
                href="https://calendly.com/tre-aqo7/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-white text-white font-medium rounded-lg hover:bg-white hover:text-black transition-colors"
              >
                <Calendar className="w-5 h-5" />
                Schedule Consultation
              </a>
            </div>
            
            <div className="mt-12 text-center animate-fade-in-up animation-delay-900">
              <p className="text-zinc-400 text-sm">
                Questions? Contact us at{' '}
                <a href="mailto:partnerships@fitwithpulse.ai" className="text-[#E0FE10] hover:underline">
                  partnerships@fitwithpulse.ai
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<CorporatePackagesProps> = async (_context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('corporate-packages');
  } catch (error) {
    console.error('Error fetching metaData for corporate-packages page in getServerSideProps:', error);
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

export default CorporatePackages;