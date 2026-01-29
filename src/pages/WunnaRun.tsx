import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Users, Trophy, MessageCircle, BarChart3, Smartphone, Bell, MapPin, Globe, Zap, CheckCircle, Calendar, Phone, Mail, Download, Layers, Building2, Wrench, Dumbbell, Footprints, PersonStanding } from 'lucide-react';
import Header from '../components/Header';
import PageHead from '../components/PageHead';
import { GetServerSideProps } from 'next';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Define a serializable version of PageMetaData for this page's props
interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface WunnaRunProps {
  metaData: SerializablePageMetaData | null;
}

const WUNNA_PASSCODE = 'WUNNA';
const WUNNA_UNLOCK_KEY = 'wunna-run-unlocked';

const WunnaRun = ({ metaData }: WunnaRunProps) => {
  const [activeSection, setActiveSection] = useState(0);
  const [_isMobileMenuOpen, _setIsMobileMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const totalSections = 20;
  const sectionRefs = useRef<(HTMLDivElement | null)[]>(Array(totalSections).fill(null));
  
  // Brand colors for Wunna Run
  const wunnaGreen = '#E0FE10'; // Pulse green
  const wunnaPurple = '#8B5CF6'; // Accent purple
  const wunnaBlue = '#3B82F6'; // Accent blue

  const linkedIn = {
    tremaine: 'https://linkedin.com/in/tremainegrant',
    marques: 'https://www.linkedin.com/in/marqueszak/',
    valerie: 'https://linkedin.com/in/speakhappiness-keynotespeaker',
    deray: 'https://www.linkedin.com/in/deray-mckesson-14523113',
    // Best-effort links: public profile URLs weren’t discoverable via web search
    bobby: 'https://www.linkedin.com/search/results/all/?keywords=Bobby%20Nweke',
    lola: 'https://www.linkedin.com/search/results/all/?keywords=Lola%20Oluwaladun',
    erik: 'https://www.linkedin.com/search/results/all/?keywords=Erik%20Edwards%20Cooley',
  } as const;
  
  // Check sessionStorage for existing passcode unlock (client-side only)
  useEffect(() => {
    try {
      const unlocked = typeof window !== 'undefined' && sessionStorage.getItem(WUNNA_UNLOCK_KEY) === 'true';
      setIsUnlocked(!!unlocked);
    } catch {
      setIsUnlocked(false);
    }
  }, []);

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    const trimmed = passcodeInput.trim().toUpperCase();
    if (trimmed === WUNNA_PASSCODE) {
      try {
        sessionStorage.setItem(WUNNA_UNLOCK_KEY, 'true');
      } catch {
        // ignore
      }
      setIsUnlocked(true);
      setPasscodeInput('');
    } else {
      setPasscodeError('Incorrect passcode. Please try again.');
    }
  };

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
  
  // Intersection Observer for section detection
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
          
          const index = sectionRefs.current.findIndex(
            section => section === mostVisibleEntry.target
          );
          
          if (index !== -1 && index !== activeSection) {
            setActiveWithDebounce(index);
          }
        } else {
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
        root: null,
        rootMargin: '0px',
        threshold: [0.1, 0.5, 0.9],
      }
    );
    
    const initTimer = setTimeout(() => {
      sectionRefs.current.forEach(section => {
        if (section) {
          observer.observe(section);
        }
      });
    }, 100);
    
    return () => {
      clearTimeout(initTimer);
      clearTimeout(debounceTimer);
      clearTimeout(transitionTimer);
      observer.disconnect();
    };
  }, [activeSection, totalSections, isNavigating]);
  
  const navigateToSection = (index: number) => {
    if (index >= 0 && index < totalSections && !isNavigating) {
      setIsNavigating(true);
      setActiveSection(index);
      
      const scrollTimer = setTimeout(() => {
        if (sectionRefs.current[index]) {
          sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
          
          const resetTimer = setTimeout(() => {
            setIsNavigating(false);
          }, 800);
          
          return () => clearTimeout(resetTimer);
        } else {
          setIsNavigating(false);
        }
      }, 10);
      
      return () => clearTimeout(scrollTimer);
    }
  };
  
  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      setPdfProgress(0);
      
      // Use smaller dimensions for reasonable file size (1280x720 = 720p HD)
      const pdfWidth = 1280;
      const pdfHeight = 720;
      
      // Create PDF in landscape orientation
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });
      
      const mainContainer = document.querySelector('main');
      if (!mainContainer) {
        throw new Error('Main container not found');
      }
      
      // Hide navigation elements during capture
      const navElements = document.querySelectorAll('.fixed');
      const originalStyles: string[] = [];
      navElements.forEach((el, idx) => {
        originalStyles[idx] = (el as HTMLElement).style.cssText;
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
      });
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Ensure fonts are fully loaded before any capture (prevents spacing/kerning glitches)
      if ((document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }

      // Capture at higher resolution, then downscale to PDF size for crisp text/icons
      const captureScale = 2;
      const jpegQuality = 0.75;
      
      // Capture each section
      for (let i = 0; i < totalSections; i++) {
        const section = sectionRefs.current[i];
        if (!section) continue;
        
        // Update progress
        setPdfProgress(Math.round(((i + 1) / totalSections) * 100));
        
        // Scroll to section and wait
        section.scrollIntoView({ behavior: 'auto', block: 'start' });
        
        // Wait for scroll to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Wait for all images in section to load
        const images = section.querySelectorAll('img');
        await Promise.all(
          Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })
        );
        
        // Additional wait for rendering to settle
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Capture the section - scale 1 for smaller file size
        const canvas = await html2canvas(section, {
          scale: captureScale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#09090b',
          logging: false,
          width: viewportWidth,
          height: viewportHeight,
          windowWidth: viewportWidth,
          windowHeight: viewportHeight,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          ignoreElements: (element) => {
            const style = window.getComputedStyle(element);
            return style.position === 'fixed';
          },
          onclone: (clonedDoc, element) => {
            const clonedSection = element as HTMLElement;
            
            // Reset transforms
            clonedSection.style.transform = 'none';
            clonedSection.style.position = 'relative';
            clonedSection.style.top = '0';
            clonedSection.style.left = '0';
            clonedSection.style.margin = '0';
            clonedSection.style.overflow = 'hidden';
            clonedSection.style.width = `${viewportWidth}px`;
            clonedSection.style.height = `${viewportHeight}px`;
            
            const view = clonedDoc.defaultView;

            // Ensure z-index works in clone:
            // Tailwind `z-*` doesn't apply unless the element is positioned; slide 1/2/4 rely on `z-10` without `relative`.
            const zIndexEls = clonedSection.querySelectorAll('[class*="z-"]');
            zIndexEls.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const computedPos = view?.getComputedStyle(htmlEl).position;
              if (computedPos === 'static') {
                htmlEl.style.position = 'relative';
              }
            });

            // Convert ONLY the top-level background wrapper (the first direct child `.absolute.inset-0`)
            // to a CSS background to avoid html2canvas object-cover inconsistencies.
            const directChildren = Array.from(clonedSection.children) as HTMLElement[];
            const bgWrapper = directChildren.find((child) =>
              child.classList.contains('absolute') && child.classList.contains('inset-0')
            );

            if (bgWrapper) {
              // Keep background behind all content
              bgWrapper.style.zIndex = '0';
              bgWrapper.style.pointerEvents = 'none';

              const bgImg = bgWrapper.querySelector('img[class*="object-cover"]') as HTMLImageElement | null;
              if (bgImg?.src) {
                const bgImgComputed = view?.getComputedStyle(bgImg);
                const objectPos = bgImgComputed?.objectPosition || 'center';
                const opacity = parseFloat(bgImgComputed?.opacity || '1');

                // Only convert when the bg image is "full strength". If the image is intentionally faded,
                // leave it as an <img> so we preserve the intended layering.
                if (opacity >= 0.99) {
                  bgWrapper.style.backgroundImage = `url(${bgImg.src})`;
                  bgWrapper.style.backgroundSize = 'cover';
                  bgWrapper.style.backgroundPosition = objectPos;
                  bgWrapper.style.backgroundRepeat = 'no-repeat';

                  // Hide only the background <img>, keep overlay divs inside the wrapper
                  bgImg.style.display = 'none';
                }
              }
            }

            // Make sure SVG icons render consistently in html2canvas by giving them explicit
            // width/height and ensuring their color is computed.
            const svgEls = clonedSection.querySelectorAll('svg');
            svgEls.forEach((svg) => {
              const htmlSvg = svg as SVGElement as unknown as HTMLElement;
              const cs = view?.getComputedStyle(htmlSvg);
              const w = cs ? parseFloat(cs.width) : 0;
              const h = cs ? parseFloat(cs.height) : 0;
              if (Number.isFinite(w) && w > 0) svg.setAttribute('width', `${w}`);
              if (Number.isFinite(h) && h > 0) svg.setAttribute('height', `${h}`);
              if (cs?.color) {
                (htmlSvg.style as any).color = cs.color;
              }
              svg.setAttribute('shape-rendering', 'geometricPrecision');
            });
            
            // Handle backdrop-blur
            const blurElements = clonedDoc.querySelectorAll('[class*="blur"]');
            blurElements.forEach(el => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.backdropFilter = 'none';
              htmlEl.style.setProperty('-webkit-backdrop-filter', 'none');
            });
            
            // Hide fixed elements
            const fixedEls = clonedDoc.querySelectorAll('.fixed');
            fixedEls.forEach(el => {
              (el as HTMLElement).style.display = 'none';
            });
            
            // Finalize animations
            const animatedEls = clonedDoc.querySelectorAll('[class*="animate-"]');
            animatedEls.forEach(el => {
              (el as HTMLElement).style.animation = 'none';
              (el as HTMLElement).style.opacity = '1';
              (el as HTMLElement).style.transform = 'none';
            });
          }
        });
        
        // Downscale to the exact PDF dimensions to avoid jsPDF resampling artifacts (missing spaces/icons)
        const outCanvas = document.createElement('canvas');
        outCanvas.width = pdfWidth;
        outCanvas.height = pdfHeight;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          throw new Error('Could not create canvas context');
        }
        outCtx.imageSmoothingEnabled = true;
        // Prefer higher quality resampling when available
        (outCtx as any).imageSmoothingQuality = 'high';
        outCtx.drawImage(canvas, 0, 0, pdfWidth, pdfHeight);

        // Use JPEG for smaller file size
        const imgData = outCanvas.toDataURL('image/jpeg', jpegQuality);
        
        if (i > 0) {
          pdf.addPage([pdfWidth, pdfHeight], 'landscape');
        }
        
        // Fill the entire page
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
      }
      
      // Restore navigation visibility
      navElements.forEach((el, idx) => {
        (el as HTMLElement).style.cssText = originalStyles[idx];
      });
      
      // Scroll back to first section
      sectionRefs.current[0]?.scrollIntoView({ behavior: 'auto' });
      
      // Download the PDF
      pdf.save('Pulse_x_WunnaRun_Proposal.pdf');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
      setPdfProgress(0);
    }
  };
  
  const getSectionClasses = (bgColor: string = 'bg-zinc-950') => {
    if (isMobile) {
      return `w-full relative py-16 px-6 mb-24 ${bgColor}`;
    } else {
      return `w-full h-screen snap-start flex flex-col items-center justify-center relative ${bgColor}`;
    }
  };
  
  const getContentClasses = (alignment: 'center' | 'left' | 'right' = 'center') => {
    const alignmentClass = alignment === 'center' ? 'text-center' : alignment === 'left' ? 'text-left' : 'text-right';
    if (isMobile) {
      return `w-full max-w-4xl mx-auto px-2 ${alignmentClass}`;
    } else {
      return `max-w-4xl mx-auto ${alignmentClass}`;
    }
  };

  // Glass card component for consistent styling
  const GlassCard = ({ children, className = '', accentColor = wunnaGreen }: { children: React.ReactNode; className?: string; accentColor?: string }) => (
    <div className={`relative group ${className}`}>
      <div 
        className="absolute -inset-1 rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-all duration-700"
        style={{ background: `linear-gradient(135deg, ${accentColor}40, transparent 60%)` }}
      />
      <div className="relative rounded-3xl overflow-hidden backdrop-blur-xl bg-zinc-900/40 border border-white/10">
        <div 
          className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}80, transparent)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
        {children}
      </div>
    </div>
  );
  
  // Passcode gate — show until correct passcode is entered
  if (!isUnlocked) {
    return (
      <div className="bg-zinc-950 text-white min-h-screen flex flex-col items-center justify-center px-6">
        <PageHead 
          metaData={metaData}
          pageOgUrl="https://fitwithpulse.ai/WunnaRun"
          pageOgImage="/wunna-run-og.png"
        />
        <img src="/PulseGreen.png" alt="Pulse" className="h-14 w-auto mb-6" />
        <h1 className="text-xl font-bold text-white mb-1">Wunna Run</h1>
        <p className="text-zinc-400 text-sm mb-6">Enter passcode to view the presentation</p>
        <form onSubmit={handlePasscodeSubmit} className="flex flex-col gap-3 w-full max-w-[240px]">
          <input
            type="password"
            value={passcodeInput}
            onChange={(e) => {
              setPasscodeInput(e.target.value);
              setPasscodeError('');
            }}
            placeholder="Passcode"
            className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10]"
            autoComplete="off"
            autoFocus
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#E0FE10] text-black font-bold hover:bg-[#c5e50c] transition-colors"
          >
            Enter
          </button>
          {passcodeError && (
            <p className="text-red-400 text-sm text-center">{passcodeError}</p>
          )}
        </form>
        <p className="text-zinc-500 text-xs mt-8">fitwithpulse.ai</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 text-white min-h-screen">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/WunnaRun"
        pageOgImage="/wunna-run-og.png"
      />
      
      <Header 
        onSectionChange={() => {}}
        currentSection="home"
        toggleMobileMenu={() => {}}
        setIsSignInModalVisible={() => {}}
        theme="dark"
        hideNav={true}
      />
      
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
      
      {/* Fixed Slide Counter Badge - Top Right */}
      <div className="fixed top-6 right-6 md:right-20 z-50">
        <div className="bg-[#E0FE10] text-black px-4 py-2 rounded-full font-bold text-sm shadow-lg">
          {activeSection + 1}/{totalSections}
        </div>
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
        
        {/* Slide 1: Title */}
        <section 
          data-slide="0"
          ref={(el) => { sectionRefs.current[0] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background Image with Overlay */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-gunna.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover object-top"
              style={{ objectPosition: 'center 20%' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/70 to-black/60"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30"></div>
          </div>
          
          {/* Main Content */}
          <div className={`${getContentClasses()} z-10 flex flex-col items-center justify-center`}>
            {/* WUNNA RUN x */}
            <h1 className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl lg:text-8xl'} font-bold mb-4 text-white tracking-tight animate-fade-in-up`}>
              WUNNA RUN <span className="text-zinc-400">x</span>
            </h1>
            
            {/* Pulse Logo */}
            <div className="flex items-center justify-center mb-8 animate-fade-in-up animation-delay-300">
              <img 
                src="/PulseGreen.png" 
                alt="Pulse" 
                className={`${isMobile ? 'h-16' : 'h-20 md:h-28'} w-auto`}
              />
            </div>
            
            {/* Subtitle */}
            <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-zinc-300 animate-fade-in-up animation-delay-600 max-w-2xl mx-auto text-center`}>
              Year-Round Community Infrastructure for the World's Fastest-Growing Run Club
            </p>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20 animate-fade-in-up animation-delay-900">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
          
          {/* Bottom Right - Fitness Icons */}
          <div className="absolute bottom-6 right-6 md:right-20 z-20 flex items-center gap-4 animate-fade-in-up animation-delay-900">
            <Footprints className="w-5 h-5 md:w-6 md:h-6 text-zinc-500" aria-label="Running" />
            <Dumbbell className="w-5 h-5 md:w-6 md:h-6 text-zinc-500" aria-label="Lifting" />
            <PersonStanding className="w-5 h-5 md:w-6 md:h-6 text-zinc-500" aria-label="Mobility" />
          </div>
        </section>
        
        {/* Slide 2: Executive Summary */}
        <section 
          data-slide="1"
          ref={(el) => { sectionRefs.current[1] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background Image with Overlay */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-crowd.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60"></div>
          </div>
          
          {/* Main Content */}
          <div className={`${getContentClasses()} z-10`}>
            <p className="text-[#E0FE10] text-sm uppercase tracking-widest mb-4 animate-fade-in-up">
              Executive Summary
            </p>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white animate-fade-in-up`}>
              Build with <span className="text-[#E0FE10]">Gunna</span> — not a vendor relationship
            </h2>
            
            <p className="text-lg md:text-xl text-zinc-200 max-w-3xl mx-auto leading-relaxed animate-fade-in-up animation-delay-150">
              Wunna Run has built something special — authentic community, real connection, global reach. Pulse provides the
              technology infrastructure to make this a <span className="text-white font-semibold">year-round series</span> instead of isolated events.
            </p>
            
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto animate-fade-in-up animation-delay-300">
              {/* Equity + Alignment */}
              <div className="bg-black/40 border border-[#E0FE10]/25 rounded-2xl p-6 text-left">
                <p className="text-[#E0FE10] text-xs uppercase tracking-widest mb-3">Alignment</p>
                <p className="text-white font-semibold text-lg mb-2">
                  <span className="text-[#E0FE10]">Meaningful equity</span> in Pulse
                </p>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  We’re offering Wunna Run more than software — an opportunity to own equity in a high-tech platform we’re building together.
                </p>
              </div>
              
              {/* Category-defining tech */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-6 text-left">
                <p className="text-[#E0FE10] text-xs uppercase tracking-widest mb-3">Technology</p>
                <p className="text-white font-semibold text-lg mb-2">Community-first Fitness App</p>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Built to rival category leaders like <span className="text-white font-medium">Trainerize</span> and <span className="text-white font-medium">Fitbod</span> — with the community infrastructure that platforms like <span className="text-white font-medium">Strava</span> don&apos;t offer.
                </p>
              </div>
              
              {/* What it unlocks */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-6 text-left">
                <p className="text-[#E0FE10] text-xs uppercase tracking-widest mb-3">What It Unlocks</p>
                <p className="text-white font-semibold text-lg mb-2">A connected series</p>
                <ul className="text-zinc-300 text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-[#E0FE10] mt-1">•</span>
                    Points, streaks, and standings that carry over run-to-run
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#E0FE10] mt-1">•</span>
                    Owned community + direct communication with runners
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#E0FE10] mt-1">•</span>
                    Data that powers partnerships, drops, and VIP experiences
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
          
          {/* Bottom Right - Fitness Icons */}
          <div className="absolute bottom-6 right-6 md:right-20 z-20 flex items-center gap-4">
            <Footprints className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Running" />
            <Dumbbell className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Lifting" />
            <PersonStanding className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Mobility" />
          </div>
        </section>
        
        {/* Slide 3: Meet the Runners */}
        <section 
          data-slide="2"
          ref={(el) => { sectionRefs.current[2] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background Image with Blur Overlay */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-runners.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-black/60"></div>
          </div>
          
          {/* Main Content - Two Column Layout */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-start gap-8 md:gap-16">
              {/* Left Side */}
              <div className="md:w-1/2 animate-fade-in-up">
                <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white`}>
                  The Runners
                </h2>
                
                {/* Runner Image Card */}
                <div className="relative rounded-lg overflow-hidden mb-6 border-2 border-[#E0FE10]/50">
                  <img 
                    src="/wunna-run-runners.png" 
                    alt="Wunna Run Runners" 
                    className="w-full h-48 md:h-56 object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <span className="text-[#E0FE10] font-semibold">Fitness Seeker</span>
                  </div>
                </div>
                
                <div className="text-left">
                  <h3 className="text-xl font-bold text-white mb-3">The Runners Problem:</h3>
                  <p className="text-zinc-300 leading-relaxed">
                    They showed up to Wunna Run, had an incredible experience, but cannot take part in this experience again until the next in-person run.
                  </p>
                </div>
              </div>
              
              {/* Right Side */}
              <div className="md:w-1/2 animate-fade-in-up animation-delay-300">
                <h3 className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} font-bold text-white mb-8`}>
                  They want to:
                </h3>
                
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="text-white text-xl">•</span>
                    <span className="text-white text-lg md:text-xl">Stay connected to the community</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-white text-xl">•</span>
                    <span className="text-white text-lg md:text-xl">Track their progress</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-white text-xl">•</span>
                    <span className="text-white text-lg md:text-xl">Earn recognition for showing up</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-white text-xl">•</span>
                    <span className="text-[#E0FE10] text-lg md:text-xl font-semibold italic">Feel like they're part of something bigger</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
          
          {/* Bottom Right - Fitness Icons */}
          <div className="absolute bottom-6 right-6 md:right-20 z-20 flex items-center gap-4">
            <Footprints className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Running" />
            <Dumbbell className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Lifting" />
            <PersonStanding className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Mobility" />
          </div>
        </section>
        
        {/* Slide 4: Wunna Run 2025 Recap */}
        <section 
          data-slide="3"
          ref={(el) => { sectionRefs.current[3] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Wunna Run 5K at start line */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-meet-wunna.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60"></div>
          </div>
          
          {/* Main Content */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            {/* Title */}
            <div className="text-center mb-10 animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold text-white`}>
                Wunna Run <span className="text-[#E0FE10]">Recap + Next</span>
              </h2>
              <p className="text-zinc-300 mt-3 text-lg md:text-xl">
                2025 proved the demand. 2026 turns it into a global system.
              </p>
            </div>

            {/* Visual: Build on top of Pulse (Stack) */}
            <div className="relative mx-auto max-w-5xl">
              {/* Subtle connector line */}
              <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-6 bottom-20 w-px bg-gradient-to-b from-[#E0FE10]/0 via-[#E0FE10]/25 to-[#E0FE10]/0"></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* 2025 */}
                <div className="bg-zinc-950/55 border border-white/10 rounded-2xl p-6 backdrop-blur-sm animate-fade-in-up text-left">
                  <p className="text-[#E0FE10] text-xs uppercase tracking-widest mb-3">2025 — What Wunna Run did</p>
                  <div className="flex items-center justify-start gap-3 mb-3">
                    <Trophy className="w-7 h-7 text-[#E0FE10]" />
                    <p className="text-white font-bold text-xl">Proven Momentum</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-left">
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                      <p className="text-white font-semibold">8</p>
                      <p className="text-zinc-400 text-xs">cities</p>
                    </div>
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                      <p className="text-white font-semibold">2,000+</p>
                      <p className="text-zinc-400 text-xs">per event</p>
                    </div>
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                      <p className="text-white font-semibold">Partners</p>
                      <p className="text-zinc-400 text-xs">Strava, UA</p>
                    </div>
                  </div>
                </div>

                {/* 2026 */}
                <div className="bg-zinc-950/55 border border-[#E0FE10]/20 rounded-2xl p-6 backdrop-blur-sm animate-fade-in-up animation-delay-150 text-left">
                  <p className="text-[#E0FE10] text-xs uppercase tracking-widest mb-3">2026 — Expansion</p>
                  <div className="flex items-center justify-start gap-3 mb-3">
                    <Globe className="w-7 h-7 text-[#E0FE10]" />
                    <p className="text-white font-bold text-xl">Global Expansion</p>
                  </div>
                  <ul className="text-zinc-300 text-sm space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-[#E0FE10] mt-1">•</span>
                      Paris + London launch moments
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#E0FE10] mt-1">•</span>
                      City-to-city continuity (points carry over)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#E0FE10] mt-1">•</span>
                      One global series experience
                    </li>
                  </ul>
                </div>
              </div>

              {/* Technology installation → Build on top of Pulse */}
              <div className="mt-6 md:mt-8 animate-fade-in-up animation-delay-450">
                <div className="relative bg-gradient-to-r from-[#E0FE10]/12 via-black/40 to-black/40 border border-[#E0FE10]/35 rounded-2xl p-6 text-left">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 w-full md:w-auto">
                      <div className="w-12 h-12 rounded-xl bg-[#E0FE10]/15 border border-[#E0FE10]/35 flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-6 h-6 text-[#E0FE10]" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-[#E0FE10] text-xs uppercase tracking-widest">Proposal</p>
                        <p className="text-white font-bold text-xl">
                          Technology installation — build on top of <span className="text-[#E0FE10] italic">Pulse</span>
                        </p>
                        <p className="text-zinc-300 text-sm mt-1">
                          Infrastructure for check-ins, run tracking, challenges, points, leaderboards, and owned data across the entire series.
                        </p>
                      </div>
                    </div>
                    <div className="w-full md:w-auto text-left md:text-right">
                      <p className="text-white font-semibold">Result:</p>
                      <p className="text-[#E0FE10] font-bold whitespace-nowrap md:whitespace-nowrap">
                        A global series, year‑round
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
          
          {/* Bottom Right - Fitness Icons */}
          <div className="absolute bottom-6 right-6 md:right-20 z-20 flex items-center gap-4">
            <Footprints className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Running" />
            <Dumbbell className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Lifting" />
            <PersonStanding className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Mobility" />
          </div>
        </section>
        
        {/* Slide 5: Introducing Pulse */}
        <section 
          data-slide="4"
          ref={(el) => { sectionRefs.current[4] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Dark gradient like chromatic-glass */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          
          {/* Main Content - Two Column Layout */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Left Side - Text Content */}
            <div className={`${isMobile ? 'w-full text-center' : 'md:w-1/2 text-left'} animate-fade-in-up`}>
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl lg:text-6xl'} font-bold mb-8 text-white`}>
                Introducing <span className="text-[#E0FE10] italic">Pulse</span>
              </h2>
              
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-8`}>
                <span className="text-[#E0FE10] font-semibold">Pulse</span> is a <span className="text-[#E0FE10] font-semibold">community-first fitness platform</span> that helps <span className="text-[#E0FE10] font-semibold">brands</span>, <span className="text-[#E0FE10] font-semibold">athletes</span>, and <span className="text-[#E0FE10] font-semibold">community leaders</span> build deeper connection through digital group training.
              </p>
              
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-8`}>
                Backed by the same investors behind <span className="text-[#E0FE10] font-semibold">Uber</span>, <span className="text-[#E0FE10] font-semibold">Calm</span>, and <span className="text-[#E0FE10] font-semibold">Robinhood</span>.
              </p>
              
              <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-zinc-400`}>
                Think of it as: <span className="text-[#E0FE10] font-semibold">The operating system for your fitness community.</span>
              </p>
            </div>
            
            {/* Right Side - Phone Mockups with subtle green stroke */}
            <div className={`${isMobile ? 'w-full' : 'md:w-1/2'} relative animate-fade-in-up animation-delay-300`}>
              <div className="flex items-center justify-center gap-4 md:gap-6">
                {/* Phone 1 - Gunna Profile */}
                <div className="relative">
                  <img 
                    src="/wunna-pulse-profile.png" 
                    alt="Gunna Profile on Pulse" 
                    className={`w-auto rounded-[40px] border-2 border-[#E0FE10]/60 shadow-xl ${isMobile ? 'h-[420px]' : 'h-[520px] md:h-[640px] lg:h-[720px]'} object-contain`}
                  />
                </div>
                
                {/* Phone 2 - Wunna Run Club */}
                <div className="relative">
                  <img 
                    src="/wunna-pulse-club.png" 
                    alt="Wunna Run Club on Pulse" 
                    className={`w-auto rounded-[40px] border-2 border-[#E0FE10]/60 shadow-xl ${isMobile ? 'h-[420px]' : 'h-[520px] md:h-[640px] lg:h-[720px]'} object-contain`}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 6: How It Works — Check-Ins */}
        <section 
          data-slide="5"
          ref={(el) => { sectionRefs.current[5] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Dark with subtle image */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-gunna.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/70"></div>
          </div>
          
          {/* Main Content - Two Column Layout */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Left Side - Text Content */}
            <div className={`${isMobile ? 'w-full text-center' : 'md:w-2/5 text-left'} animate-fade-in-up`}>
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white`}>
                How it works — <span className="text-[#E0FE10]">Check-Ins</span>
              </h2>
              
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-6`}>
                Runners can <span className="text-[#E0FE10] font-semibold">join virtually or physically</span> through QR code scan
              </p>
              
              <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-[#E0FE10] font-semibold leading-relaxed`}>
                Point Incentive, and badges for physical check-in at locations
              </p>
            </div>
            
            {/* Right Side - Three Phone Mockups */}
            <div className={`${isMobile ? 'w-full' : 'md:w-3/5'} relative animate-fade-in-up animation-delay-300`}>
              <div className="flex items-end justify-center gap-2 md:gap-4">
                {/* Phone 1 - QR Code */}
                <img 
                  src="/wunna-checkin-qr.png" 
                  alt="QR Code Check-in" 
                  className={`rounded-[32px] border-2 border-[#E0FE10]/60 ${isMobile ? 'h-72' : 'h-96 md:h-[420px] lg:h-[500px]'} w-auto object-contain`}
                />
                
                {/* Phone 2 - You're In (center, slightly larger) */}
                <img 
                  src="/wunna-checkin-confirmation.png" 
                  alt="Checked In Confirmation" 
                  className={`rounded-[32px] border-2 border-[#E0FE10]/60 ${isMobile ? 'h-80' : 'h-[420px] md:h-[500px] lg:h-[560px]'} w-auto object-contain`}
                />
                
                {/* Phone 3 - Global Runners */}
                <img 
                  src="/wunna-checkin-global.png" 
                  alt="Global Runners Map" 
                  className={`rounded-[32px] border-2 border-[#E0FE10]/60 ${isMobile ? 'h-72' : 'h-96 md:h-[420px] lg:h-[500px]'} w-auto object-contain`}
                />
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 8: How It Works — Gamification */}
        <section 
          data-slide="6"
          ref={(el) => { sectionRefs.current[6] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          
          {/* Main Content - Two Column Layout */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Left Side - Text Content */}
            <div className="w-full md:w-2/5 text-left animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white`}>
                How it works — <span className="text-[#E0FE10]">Gamification</span>
              </h2>
              
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-6`}>
                Earn Pulse Points on race day — from showing up to crossing the finish!
              </p>
              
              <ul className="space-y-3 text-zinc-300">
                <li className="flex items-start gap-2">
                  <Trophy className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Points for attendance, city-to-city participation, streaks</span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Leaderboards by city, total runs, engagement</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Badges and rewards for milestones</span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Runners compete with each other — and themselves</span>
                </li>
              </ul>
            </div>
            
            {/* Right Side - Rules & Scoring Phone */}
            <div className={`${isMobile ? 'w-full' : 'md:w-3/5'} relative animate-fade-in-up animation-delay-300 flex justify-center`}>
              <img 
                src="/wunna-gamification-rules.png" 
                alt="Rules & Scoring on Pulse" 
                className={`rounded-[32px] border-2 border-[#E0FE10]/60 w-auto object-contain ${isMobile ? 'h-96' : 'h-[420px] md:h-[500px] lg:h-[560px]'}`}
              />
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 9: How It Works — Community */}
        <section 
          data-slide="7"
          ref={(el) => { sectionRefs.current[7] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          
          {/* Main Content - Two Column Layout */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Left Side - Text Content */}
            <div className="w-full md:w-2/5 text-left animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white`}>
                How it works — <span className="text-[#E0FE10]">Community</span>
              </h2>
              
              <h3 className="text-xl font-bold text-white mb-4">Run tracking & challenges build stronger community.</h3>
              
              <p className="text-zinc-400 mb-6 border-l-2 border-[#E0FE10]/60 pl-4 italic">
                Every run compounds. No more isolated workouts — each run becomes part of a <span className="text-white font-medium">connected journey</span> with purpose and intention.
              </p>
              
              <ul className="space-y-3 text-zinc-300">
                <li className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Track runs between events — progress that builds</span>
                </li>
                <li className="flex items-start gap-2">
                  <Trophy className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Community challenges connect runners to a shared goal</span>
                </li>
                <li className="flex items-start gap-2">
                  <Layers className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Runs stack into streaks, milestones, and achievements</span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Two-way communication — Gunna can message runners directly</span>
                </li>
              </ul>
            </div>
            
            {/* Right Side - Two Phones: Challenge + Run Tracking */}
            <div className={`${isMobile ? 'w-full' : 'md:w-3/5'} relative animate-fade-in-up animation-delay-300 flex justify-center`}>
              <div className="flex items-end justify-center gap-3 md:gap-6">
                {/* Phone 1 - Run Tracking */}
                <img 
                  src="/wunna-run-tracking.png" 
                  alt="Run Tracking - Thursday Run" 
                  className={`rounded-[32px] border-2 border-[#E0FE10]/60 w-auto object-contain ${isMobile ? 'h-72' : 'h-[380px] md:h-[460px] lg:h-[520px]'}`}
                />
                
                {/* Phone 2 - The Run With Gunna Challenge (slightly larger, center focus) */}
                <img 
                  src="/wunna-community-challenge.png" 
                  alt="The Run With Gunna Challenge" 
                  className={`rounded-[32px] border-2 border-[#E0FE10]/60 w-auto object-contain ${isMobile ? 'h-80' : 'h-[420px] md:h-[500px] lg:h-[560px]'}`}
                />
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 10: How It Works — Data (Rich data profile on each runner) */}
        <section 
          data-slide="8"
          ref={(el) => { sectionRefs.current[8] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          
          {/* Subtle animated circuit background - palette colors (hidden during PDF export) */}
          {!isGeneratingPDF && (
          <div className="absolute inset-0 pointer-events-none z-0 opacity-30">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
              {/* Green circuit paths */}
              <path pathLength="1" strokeDasharray="1" strokeDashoffset="1" stroke={wunnaGreen} strokeWidth="0.4" fill="none" className="animate-circuit-draw" style={{ animationDelay: '0s' }} d="M 40 60 L 120 60 L 120 100 L 200 100" />
              <path pathLength="1" strokeDasharray="1" strokeDashoffset="1" stroke={wunnaGreen} strokeWidth="0.4" fill="none" className="animate-circuit-draw" style={{ animationDelay: '4s' }} d="M 280 80 L 360 80 L 360 140" />
              <path pathLength="1" strokeDasharray="1" strokeDashoffset="1" stroke={wunnaGreen} strokeWidth="0.4" fill="none" className="animate-circuit-draw" style={{ animationDelay: '8s' }} d="M 60 200 L 140 200 L 140 240" />
              {/* Purple circuit paths */}
              <path pathLength="1" strokeDasharray="1" strokeDashoffset="1" stroke={wunnaPurple} strokeWidth="0.4" fill="none" className="animate-circuit-draw" style={{ animationDelay: '1.5s' }} d="M 80 120 L 160 120 L 160 180 L 80 180" />
              <path pathLength="1" strokeDasharray="1" strokeDashoffset="1" stroke={wunnaPurple} strokeWidth="0.4" fill="none" className="animate-circuit-draw" style={{ animationDelay: '5.5s' }} d="M 240 40 L 320 40 L 320 100" />
              <path pathLength="1" strokeDasharray="1" strokeDashoffset="1" stroke={wunnaPurple} strokeWidth="0.4" fill="none" className="animate-circuit-draw" style={{ animationDelay: '9.5s' }} d="M 200 220 L 320 220 L 320 260" />
              {/* Blue circuit paths */}
              <path pathLength="1" strokeDasharray="1" strokeDashoffset="1" stroke={wunnaBlue} strokeWidth="0.4" fill="none" className="animate-circuit-draw" style={{ animationDelay: '3s' }} d="M 20 140 L 100 140 L 100 220" />
              <path pathLength="1" strokeDasharray="1" strokeDashoffset="1" stroke={wunnaBlue} strokeWidth="0.4" fill="none" className="animate-circuit-draw" style={{ animationDelay: '7s' }} d="M 180 60 L 260 60 L 260 160 L 340 160" />
              <path pathLength="1" strokeDasharray="1" strokeDashoffset="1" stroke={wunnaBlue} strokeWidth="0.4" fill="none" className="animate-circuit-draw" style={{ animationDelay: '2s' }} d="M 300 180 L 380 180 L 380 260" />
              {/* Small nodes - subtle pulse */}
              <circle cx="120" cy="100" r="1.5" fill={wunnaGreen} className="animate-circuit-pulse" style={{ animationDelay: '0.5s' }} />
              <circle cx="260" cy="60" r="1.5" fill={wunnaBlue} className="animate-circuit-pulse" style={{ animationDelay: '2.5s' }} />
              <circle cx="160" cy="180" r="1.5" fill={wunnaPurple} className="animate-circuit-pulse" style={{ animationDelay: '4.5s' }} />
              <circle cx="320" cy="220" r="1.5" fill={wunnaPurple} className="animate-circuit-pulse" style={{ animationDelay: '6.5s' }} />
              <circle cx="360" cy="140" r="1.5" fill={wunnaGreen} className="animate-circuit-pulse" style={{ animationDelay: '8.5s' }} />
            </svg>
          </div>
          )}
          
          {/* Main Content - Two Column Layout */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Left Side - Text Content */}
            <div className="w-full md:w-2/5 text-left animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-8 text-white`}>
                How it works — <span className="text-[#E0FE10]">Data</span>
              </h2>
              <p className="text-[#E0FE10] text-sm uppercase tracking-widest mb-6">Know Your Runners</p>
              
              <h3 className="text-xl font-bold text-white mb-6">Rich member profiles for deeper fan experiences.</h3>
              
              <ul className="space-y-3 text-zinc-300">
                <li className="flex items-start gap-2">
                  <Users className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>More than just email addresses — <span className="text-white font-semibold">you own the relationship</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>See who your most engaged runners are</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Segment for merch drops, pre-sales, and VIP experiences</span>
                </li>
                <li className="flex items-start gap-2">
                  <Trophy className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span>Data to inform partnerships and sponsorships</span>
                </li>
              </ul>
            </div>
            
            {/* Right Side - Member Insights Phone */}
            <div className={`${isMobile ? 'w-full' : 'md:w-3/5'} relative animate-fade-in-up animation-delay-300 flex justify-center`}>
              <img 
                src="/wunna-member-insights.png" 
                alt="Member Insights - Rich data profile on each runner" 
                className={`rounded-[32px] border-2 border-[#E0FE10]/60 w-auto object-contain ${isMobile ? 'h-96' : 'h-[420px] md:h-[500px] lg:h-[560px]'}`}
              />
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 11: The Runner Experience */}
        <section 
          data-slide="9"
          ref={(el) => { sectionRefs.current[9] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background Image with Overlay */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-runners-action.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/65"></div>
          </div>
          
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-12 text-white animate-fade-in-up`}>
              The <span className="text-[#E0FE10]">Runner</span> Experience
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-fade-in-up animation-delay-300">
              {[
                { step: '1', title: 'Join', desc: 'Download Pulse, join the Wunna Run community', icon: Smartphone },
                { step: '2', title: 'Check In', desc: 'Arrive at the run, check in via the app', icon: CheckCircle },
                { step: '3', title: 'Earn', desc: 'Get points, climb the leaderboard, unlock rewards', icon: Trophy },
                { step: '4', title: 'Stay Connected', desc: 'Engage between events, see announcements', icon: MessageCircle },
                { step: '5', title: 'Come Back', desc: 'Show up to the next run, keep the streak alive', icon: Zap },
              ].map((item, index) => (
                <div key={index} className="relative">
                  <GlassCard>
                    <div className="p-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center mx-auto mb-4">
                        <span className="text-black font-bold text-xl">{item.step}</span>
                      </div>
                      <item.icon className="w-8 h-8 text-[#E0FE10] mx-auto mb-3" />
                      <h3 className="text-white font-bold mb-2">{item.title}</h3>
                      <p className="text-zinc-400 text-sm">{item.desc}</p>
                    </div>
                  </GlassCard>
                  {index < 4 && (
                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-[#E0FE10]/50"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Slide 12: The Wunna Run Team Experience */}
        <section 
          data-slide="10"
          ref={(el) => { sectionRefs.current[10] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background Image with Overlay */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-team.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60"></div>
          </div>
          
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white animate-fade-in-up text-center`}>
              For the <span className="text-[#E0FE10]">Wunna Run</span> Team
            </h2>
            <p className="text-xl text-zinc-400 mb-16 text-center animate-fade-in-up animation-delay-150">
              Everything you need to manage and scale
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up animation-delay-300">
              {/* Card 1: Metrics by City */}
              <div className="bg-zinc-900/60 p-8 rounded-2xl border border-zinc-800 h-full">
                <div className="w-14 h-14 rounded-xl bg-[#E0FE10]/20 flex items-center justify-center mb-6">
                  <BarChart3 className="w-7 h-7 text-[#E0FE10]" />
                </div>
                <h3 className="text-white font-bold text-xl mb-3">Metrics by City</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Real-time attendance, engagement, and growth data across every city. See which markets are growing fastest.
                </p>
              </div>
              
              {/* Card 2: Community Management */}
              <div className="bg-zinc-900/60 p-8 rounded-2xl border border-zinc-800 h-full">
                <div className="w-14 h-14 rounded-xl bg-[#E0FE10]/20 flex items-center justify-center mb-6">
                  <Users className="w-7 h-7 text-[#E0FE10]" />
                </div>
                <h3 className="text-white font-bold text-xl mb-3">Community Management</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Direct messaging, push notifications, and community feed. Own the relationship with every runner.
                </p>
              </div>
              
              {/* Card 3: One Platform */}
              <div className="bg-zinc-900/60 p-8 rounded-2xl border border-zinc-800 h-full">
                <div className="w-14 h-14 rounded-xl bg-[#E0FE10]/20 flex items-center justify-center mb-6">
                  <Layers className="w-7 h-7 text-[#E0FE10]" />
                </div>
                <h3 className="text-white font-bold text-xl mb-3">One Platform</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Events, check-ins, merch drops, challenges, and fan experiences — all under one roof.
                </p>
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 13: Between Events */}
        <section 
          data-slide="11"
          ref={(el) => { sectionRefs.current[11] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
            {/* Title */}
            <div className="text-center mb-8 animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold text-white`}>
                Between <span className="text-[#E0FE10]">Events</span>
              </h2>
              <p className="text-xl text-zinc-400 mt-3">The community doesn't stop when the run ends.</p>
            </div>
            
            {/* 3-Column Layout: Engagement - Run Summary - Engagement */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center animate-fade-in-up animation-delay-150">
              
              {/* Left Column - Engagement Methods */}
              <div className="flex flex-col gap-4 order-2 lg:order-1">
                <GlassCard accentColor={wunnaPurple}>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <MapPin className="w-7 h-7 text-[#8B5CF6]" />
                      <h3 className="text-white font-bold text-lg">Ad-hoc Runs</h3>
                    </div>
                    <p className="text-zinc-400 text-sm">Runners organize their own meetups through the app</p>
                  </div>
                </GlassCard>
                
                <GlassCard>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <MessageCircle className="w-7 h-7 text-[#E0FE10]" />
                      <h3 className="text-white font-bold text-lg">Content</h3>
                    </div>
                    <p className="text-zinc-400 text-sm">Gunna drops training tips, motivation, behind-the-scenes</p>
                  </div>
                </GlassCard>
              </div>
              
              {/* Center Column - Run Summary */}
              <div className="order-1 lg:order-2">
                <div className="text-center mb-3">
                  <p className="text-zinc-500 text-xs">Every run is tracked and celebrated</p>
                </div>
                
                <div className="relative max-w-sm mx-auto">
                  {/* Blue glow background */}
                  <div className="absolute inset-0 bg-[#3B82F6]/10 blur-3xl rounded-full" />
                  
                  <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#0c1929] to-[#0a0a0b] border border-[#3B82F6]/20 p-5">
                    {/* Header */}
                    <div className="text-center mb-5">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#3B82F6]/10 flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#3B82F6]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
                        </svg>
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">Thursday Run</h4>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/30">
                          Free Run
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-800/50 text-zinc-400 border border-zinc-700/50">
                          Outdoor
                        </span>
                      </div>
                      <p className="text-zinc-500 text-xs">Dec 31, 2025 at 11:30 PM</p>
                    </div>

                    {/* Map placeholder */}
                    <div className="relative h-32 rounded-2xl overflow-hidden mb-3 bg-gradient-to-br from-[#1a2744] to-[#0f172a] border border-[#3B82F6]/20">
                      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-[#E0FE10] text-black text-xs font-bold flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-black" /> Start
                      </div>
                      <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-[#3B82F6] text-white text-xs font-bold">
                        Finish
                      </div>
                      {/* Route line */}
                      <svg className="absolute inset-0 w-full h-full">
                        <path
                          d="M 50 100 Q 100 50 150 80 Q 200 110 250 60"
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    {/* Goal Achieved */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm">Goal Achieved!</p>
                        <p className="text-zinc-400 text-xs">Completed</p>
                      </div>
                      <span className="text-xl">🏆</span>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-center">
                        <p className="text-xl font-bold text-white">1.4 mi</p>
                        <p className="text-zinc-500 text-xs">Distance</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-center">
                        <p className="text-xl font-bold text-white">14:41</p>
                        <p className="text-zinc-500 text-xs">Time</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-center">
                        <p className="text-xl font-bold text-white">10:30</p>
                        <p className="text-zinc-500 text-xs">Avg Pace</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#F97316]/10 border border-[#F97316]/20 text-center">
                        <p className="text-xl font-bold text-white">137</p>
                        <p className="text-zinc-500 text-xs">Calories</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Engagement Methods */}
              <div className="flex flex-col gap-4 order-3">
                <GlassCard accentColor={wunnaBlue}>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Trophy className="w-7 h-7 text-[#3B82F6]" />
                      <h3 className="text-white font-bold text-lg">Challenges</h3>
                    </div>
                    <p className="text-zinc-400 text-sm">Weekly/monthly challenges to keep engagement high</p>
                  </div>
                </GlassCard>
                
                <GlassCard accentColor="#EF4444">
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Calendar className="w-7 h-7 text-red-400" />
                      <h3 className="text-white font-bold text-lg">Countdown</h3>
                    </div>
                    <p className="text-zinc-400 text-sm">Build hype for the next event with countdown features</p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 14: The Series - NASCAR/PGA Style */}
        <section 
          data-slide="12"
          ref={(el) => { sectionRefs.current[12] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Premium dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          
          {/* Dark mode global map background (hidden during PDF export) */}
          {!isGeneratingPDF && (
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice">
              {/* Grid lines - latitude */}
              {[100, 150, 200, 250, 300, 350, 400].map((y) => (
                <line key={`lat-${y}`} x1="0" y1={y} x2="1000" y2={y} stroke="#3f3f46" strokeWidth="0.5" opacity="0.4" />
              ))}
              {/* Grid lines - longitude */}
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => (
                <line key={`lng-${x}`} x1={x} y1="50" x2={x} y2="450" stroke="#3f3f46" strokeWidth="0.5" opacity="0.4" />
              ))}
              
              {/* Simplified continent outlines */}
              {/* North America */}
              <path d="M 120 120 Q 180 100 220 130 L 250 180 Q 280 220 250 260 L 200 280 Q 160 260 130 220 Q 100 180 120 120 Z" fill="none" stroke="#52525b" strokeWidth="1" />
              {/* South America */}
              <path d="M 220 300 Q 250 280 270 310 L 280 380 Q 270 420 240 400 L 210 350 Q 200 320 220 300 Z" fill="none" stroke="#52525b" strokeWidth="1" />
              {/* Europe */}
              <path d="M 440 120 Q 480 100 520 120 L 540 160 Q 520 180 480 170 L 450 150 Q 430 140 440 120 Z" fill="none" stroke="#52525b" strokeWidth="1" />
              {/* Africa */}
              <path d="M 460 200 Q 500 180 540 200 L 560 280 Q 540 340 500 360 L 460 320 Q 440 260 460 200 Z" fill="none" stroke="#52525b" strokeWidth="1" />
              {/* Asia */}
              <path d="M 560 100 Q 650 80 750 100 L 800 160 Q 820 220 780 260 L 700 280 Q 620 260 580 200 L 560 140 Q 550 120 560 100 Z" fill="none" stroke="#52525b" strokeWidth="1" />
              {/* Australia */}
              <path d="M 780 340 Q 820 320 860 340 L 880 380 Q 860 410 820 400 L 780 370 Q 770 355 780 340 Z" fill="none" stroke="#52525b" strokeWidth="1" />
              
              {/* Pulsing city dots - key global locations */}
              <circle cx="200" cy="180" r="3" fill={wunnaGreen}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="480" cy="140" r="3" fill={wunnaGreen}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" begin="0.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="500" cy="260" r="3" fill={wunnaGreen}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" begin="1s" repeatCount="indefinite" />
              </circle>
              <circle cx="700" cy="180" r="3" fill={wunnaPurple}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" begin="1.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="820" cy="360" r="3" fill={wunnaBlue}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" begin="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="250" cy="340" r="3" fill={wunnaBlue}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" begin="2.5s" repeatCount="indefinite" />
              </circle>
              
              {/* Connecting flight lines between cities */}
              <path d="M 200 180 Q 340 100 480 140" fill="none" stroke={wunnaGreen} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.5">
                <animate attributeName="stroke-dashoffset" values="8;0" dur="2s" repeatCount="indefinite" />
              </path>
              <path d="M 480 140 Q 590 160 700 180" fill="none" stroke={wunnaPurple} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.5">
                <animate attributeName="stroke-dashoffset" values="8;0" dur="2s" begin="0.7s" repeatCount="indefinite" />
              </path>
              <path d="M 200 180 Q 220 260 250 340" fill="none" stroke={wunnaBlue} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.5">
                <animate attributeName="stroke-dashoffset" values="8;0" dur="2s" begin="1.4s" repeatCount="indefinite" />
              </path>
            </svg>
          </div>
          )}
          
          {/* Subtle accent lines */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E0FE10]/20 to-transparent"></div>
            <div className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E0FE10]/20 to-transparent"></div>
          </div>
          
          {/* Main Content */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            {/* Title */}
            <div className="text-center mb-12 animate-fade-in-up">
              <p className="text-[#E0FE10] text-sm uppercase tracking-widest mb-4">The Bigger Picture</p>
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold text-white mb-4`}>
                Think <span className="text-[#E0FE10]">NASCAR</span>. Think <span className="text-[#E0FE10]">PGA Tour</span>.
              </h2>
              <p className="text-xl text-zinc-400 max-w-3xl mx-auto">
                Not just individual events — a <span className="text-white font-semibold">connected series</span> where every race, every round, every run counts toward something bigger.
              </p>
            </div>
            
            {/* Series Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in-up animation-delay-150">
              {/* Traditional */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <div className="text-zinc-500 text-sm uppercase tracking-wider mb-3">Traditional Run Events</div>
                <ul className="space-y-2 text-zinc-400 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></span>
                    One event, one experience
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></span>
                    Results reset each time
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></span>
                    No continuity between runs
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></span>
                    Isolated moments
                  </li>
                </ul>
              </div>
              
              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-px bg-gradient-to-r from-zinc-700 to-[#E0FE10]"></div>
                  <span className="text-[#E0FE10] text-xs uppercase tracking-wider">Pulse enables</span>
                  <div className="w-16 h-px bg-gradient-to-r from-[#E0FE10] to-zinc-700"></div>
                </div>
              </div>
              
              {/* Wunna Run Series */}
              <div className="bg-gradient-to-br from-[#E0FE10]/10 to-transparent border border-[#E0FE10]/30 rounded-2xl p-6">
                <div className="text-[#E0FE10] text-sm uppercase tracking-wider mb-3">Wunna Run Series</div>
                <ul className="space-y-2 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#E0FE10] rounded-full"></span>
                    Season-long journey
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#E0FE10] rounded-full"></span>
                    <span className="text-white font-medium">Points carry over</span> event to event
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#E0FE10] rounded-full"></span>
                    Global standings & leaderboards
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#E0FE10] rounded-full"></span>
                    <span className="text-white font-medium">Every run matters</span>
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Key Value Props */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up animation-delay-300">
              <div className="text-center p-4">
                <div className="text-3xl md:text-4xl font-bold text-[#E0FE10] mb-2">7+</div>
                <div className="text-zinc-400 text-sm">Cities in 2025 Tour</div>
              </div>
              <div className="text-center p-4 border-x border-zinc-800">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">1 Series</div>
                <div className="text-zinc-400 text-sm">Connected Experience</div>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl md:text-4xl font-bold text-[#E0FE10] mb-2">∞</div>
                <div className="text-zinc-400 text-sm">Reasons to Come Back</div>
              </div>
            </div>
            
            {/* Bottom callout */}
            <div className="mt-12 text-center animate-fade-in-up animation-delay-450">
              <p className="text-zinc-500 text-sm max-w-2xl mx-auto">
                <span className="text-white font-medium">Technology makes this possible.</span> Pulse provides the infrastructure to track, connect, and reward participation across the entire Wunna Run series — turning fans into lifelong members.
              </p>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 15: Scale */}
        <section 
          data-slide="13"
          ref={(el) => { sectionRefs.current[13] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Clean gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900"></div>
          
          {/* Main Content */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            {/* Title */}
            <div className="text-center mb-16 animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-6xl'} font-bold text-white mb-4`}>
                <span className="text-[#E0FE10]">Scale</span>
              </h2>
              <p className="text-xl text-zinc-400">
                From local runs to a global movement
              </p>
            </div>
            
            {/* Growth metrics - Clean horizontal layout */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16 animate-fade-in-up animation-delay-300">
              {/* Current */}
              <div className="bg-zinc-900/50 rounded-2xl p-8 border border-zinc-800 text-center">
                <p className="text-zinc-500 text-sm uppercase tracking-wider mb-2">Today</p>
                <p className="text-4xl md:text-5xl font-bold text-white">2K+</p>
                <p className="text-zinc-400 text-sm mt-2">runners per event</p>
              </div>
              
              {/* Year 1 */}
              <div className="bg-zinc-900/50 rounded-2xl p-8 border border-zinc-800 text-center">
                <p className="text-zinc-500 text-sm uppercase tracking-wider mb-2">Year 1</p>
                <p className="text-4xl md:text-5xl font-bold text-[#8B5CF6]">100K</p>
                <p className="text-zinc-400 text-sm mt-2">in the community</p>
              </div>
              
              {/* Year 2 */}
              <div className="bg-zinc-900/50 rounded-2xl p-8 border border-zinc-800 text-center">
                <p className="text-zinc-500 text-sm uppercase tracking-wider mb-2">Year 2</p>
                <p className="text-4xl md:text-5xl font-bold text-[#3B82F6]">500K</p>
                <p className="text-zinc-400 text-sm mt-2">global members</p>
              </div>
              
              {/* Vision */}
              <div className="bg-gradient-to-br from-[#E0FE10]/10 to-zinc-900/50 rounded-2xl p-8 border border-[#E0FE10]/30 text-center">
                <p className="text-[#E0FE10] text-sm uppercase tracking-wider mb-2">Vision</p>
                <p className="text-4xl md:text-5xl font-bold text-[#E0FE10]">1M+</p>
                <p className="text-zinc-400 text-sm mt-2">global community</p>
              </div>
            </div>
            
            {/* 2025 Tour Cities */}
            <div className="animate-fade-in-up animation-delay-600 mb-10">
              <p className="text-center text-zinc-500 text-sm uppercase tracking-wider mb-4">2025 Wunna World Tour</p>
              <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
                {['NYC', 'Toronto', 'DC', 'Miami', 'Atlanta', 'Houston', 'LA'].map((city) => (
                  <div key={city} className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-zinc-800">
                    <p className="text-white text-sm font-medium">{city}</p>
                  </div>
                ))}
                <div className="bg-[#E0FE10]/10 rounded-lg px-4 py-2 border border-[#E0FE10]/30">
                  <p className="text-[#E0FE10] text-sm font-medium">8 cities</p>
                </div>
              </div>
            </div>
            
            {/* 2026 Global Expansion */}
            <div className="animate-fade-in-up animation-delay-900">
              <p className="text-center text-zinc-500 text-sm uppercase tracking-wider mb-4">2026 Global Expansion</p>
              <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
                <div className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-[#8B5CF6]/30">
                  <p className="text-white text-sm font-medium">Paris</p>
                </div>
                <div className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-[#8B5CF6]/30">
                  <p className="text-white text-sm font-medium">London</p>
                </div>
                <div className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-zinc-800">
                  <p className="text-zinc-400 text-sm font-medium">+ International</p>
                </div>
              </div>
            </div>
            
            {/* Bottom tagline */}
            <div className="mt-12 text-center animate-fade-in-up animation-delay-900">
              <p className="text-lg md:text-xl text-zinc-300">
                Pulse gives you the infrastructure to <span className="text-[#E0FE10] font-semibold">scale without losing the intimacy</span>.
              </p>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 16: Who's Building Pulse? (Team) */}
        <section 
          data-slide="14"
          ref={(el) => { sectionRefs.current[14] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          
          {/* Main Content */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            {/* Title */}
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-10 text-white animate-fade-in-up text-center`}>
              Who&apos;s building{' '}<span className="text-[#E0FE10] italic">Pulse</span>?
            </h2>
            
            {/* Combined Team Grid */}
            <div className="animate-fade-in-up animation-delay-150">
              {/* Core Team Row */}
              <div className="flex justify-center items-start gap-10 md:gap-16 mb-8">
                {/* Tremaine */}
                <a href={linkedIn.tremaine} target="_blank" rel="noopener noreferrer" className="text-center group w-36 md:w-44">
                  <div className="relative mb-3">
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-3 border-[#E0FE10] mx-auto ring-4 ring-[#E0FE10]/20 ring-offset-2 ring-offset-black">
                      <img src="/TremaineFounder.jpg" alt="Tremaine Grant" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <h4 className="text-white font-bold text-base md:text-lg group-hover:text-[#E0FE10] transition-colors">Tremaine Grant</h4>
                  <p className="text-[#E0FE10] text-sm font-medium mb-2">CEO &amp; Founder</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600/30 text-blue-300">D1 Athlete</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600/30 text-emerald-300">Biotech</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-600/30 text-orange-300">Engineer</span>
                  </div>
                </a>
                
                {/* Bobby */}
                <a href={linkedIn.bobby} target="_blank" rel="noopener noreferrer" className="text-center group w-36 md:w-44">
                  <div className="relative mb-3">
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-3 border-[#E0FE10] mx-auto ring-4 ring-[#E0FE10]/20 ring-offset-2 ring-offset-black">
                      <img src="/bobbyAdvisor.jpg" alt="Bobby Nweke" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <h4 className="text-white font-bold text-base md:text-lg group-hover:text-[#E0FE10] transition-colors">Bobby Nweke</h4>
                  <p className="text-[#E0FE10] text-sm font-medium mb-2">Chief of Staff</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/30 text-red-300">TED</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#A51C30]/30 text-red-200">Harvard</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-700/30 text-red-200">TFA</span>
                  </div>
                </a>
                
                {/* Lola */}
                <a href={linkedIn.lola} target="_blank" rel="noopener noreferrer" className="text-center group w-36 md:w-44">
                  <div className="relative mb-3">
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-3 border-[#E0FE10] mx-auto ring-4 ring-[#E0FE10]/20 ring-offset-2 ring-offset-black">
                      <img src="/lola.jpg" alt="Lola Oluwaladun" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <h4 className="text-white font-bold text-base md:text-lg group-hover:text-[#E0FE10] transition-colors">Lola Oluwaladun</h4>
                  <p className="text-[#E0FE10] text-sm font-medium mb-2">Design Lead</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-600/30 text-purple-300">Figma</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-pink-600/30 text-pink-300">UX/UI</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-fuchsia-600/30 text-fuchsia-300">Branding</span>
                  </div>
                </a>
              </div>
              
              {/* Divider */}
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-600 to-transparent"></div>
                <span className="text-zinc-400 text-sm uppercase tracking-wider font-medium">Advisors</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-600 to-transparent"></div>
              </div>
              
              {/* Advisors Row */}
              <div className="flex justify-center items-start gap-6 md:gap-12">
                {/* Marques */}
                <a href={linkedIn.marques} target="_blank" rel="noopener noreferrer" className="text-center group w-24 md:w-28">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-zinc-600 mx-auto mb-2">
                    <img src="/zak.jpg" alt="Marques Zak" className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-white font-semibold text-sm group-hover:text-[#E0FE10] transition-colors">Marques Zak</h4>
                  <p className="text-zinc-400 text-xs">CMO @ ACC</p>
                </a>
                
                {/* Valerie */}
                <a href={linkedIn.valerie} target="_blank" rel="noopener noreferrer" className="text-center group w-24 md:w-28">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-zinc-600 mx-auto mb-2">
                    <img src="/Val.jpg" alt="Valerie Alexander" className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-white font-semibold text-sm group-hover:text-[#E0FE10] transition-colors">Valerie Alexander</h4>
                  <p className="text-zinc-400 text-xs">Fortune 500 Consultant</p>
                </a>
                
                {/* DeRay */}
                <a href={linkedIn.deray} target="_blank" rel="noopener noreferrer" className="text-center group w-24 md:w-28">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-zinc-600 mx-auto mb-2">
                    <img src="/Deray.png" alt="DeRay Mckesson" className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-white font-semibold text-sm group-hover:text-[#E0FE10] transition-colors">DeRay Mckesson</h4>
                  <p className="text-zinc-400 text-xs">Campaign Zero</p>
                </a>
                
                {/* Erik */}
                <a href={linkedIn.erik} target="_blank" rel="noopener noreferrer" className="text-center group w-24 md:w-28">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-zinc-600 mx-auto mb-2">
                    <img src="/ErikEdwards.png" alt="Erik Edwards" className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-white font-semibold text-sm group-hover:text-[#E0FE10] transition-colors">Erik Edwards</h4>
                  <p className="text-zinc-400 text-xs">Partner @ Cooley</p>
                </a>
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 17: The Opportunity */}
        <section 
          data-slide="15"
          ref={(el) => { sectionRefs.current[15] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className={getContentClasses()}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-4 text-white animate-fade-in-up`}>
              The <span className="text-[#E0FE10]">Opportunity</span>
            </h2>
            <p className="text-xl text-zinc-400 mb-8 animate-fade-in-up animation-delay-150">
              We're offering Wunna Run more than a software vendor relationship.
            </p>
            
            {/* Why Pulse - Compact Version */}
            <div className="flex flex-wrap justify-center gap-3 mb-10 animate-fade-in-up animation-delay-200">
              {[
                'Community-first',
                'Owned audience',
                'Year-round engagement',
                'Built for scale',
                'Aligned mission',
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2 bg-zinc-950/80 px-4 py-2 rounded-full border border-zinc-800">
                  <CheckCircle className="w-4 h-4 text-[#E0FE10]" />
                  <span className="text-zinc-300 text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in-up animation-delay-300">
              <GlassCard>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-[#E0FE10] text-2xl font-bold">1</span>
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3">Partnership</h3>
                  <p className="text-zinc-400 text-sm">
                    Wunna Run adopts Pulse as official community platform. Gunna receives <span className="text-[#E0FE10] font-bold text-base">equity in Pulse</span>.
                  </p>
                </div>
              </GlassCard>
              
              <GlassCard accentColor={wunnaPurple}>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-[#8B5CF6] text-2xl font-bold">2</span>
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3">Investment</h3>
                  <p className="text-zinc-400 text-sm">
                    Gunna invests in Pulse's pre-seed round via <span className="text-[#8B5CF6] font-bold">SAFE</span> alongside institutional partners.
                  </p>
                </div>
              </GlassCard>
              
              <GlassCard accentColor={wunnaBlue}>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#3B82F6]/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-[#3B82F6] text-2xl font-bold">3</span>
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3">Both</h3>
                  <p className="text-zinc-400 text-sm">
                    Combined partnership and investment for <span className="text-[#3B82F6] font-bold text-base">maximum alignment and ownership</span>.
                  </p>
                </div>
              </GlassCard>
            </div>
            
            <div className="bg-zinc-950 p-4 rounded-xl border border-[#E0FE10]/30 text-center animate-fade-in-up animation-delay-600">
              <p className="text-zinc-400">Details in the attached <span className="text-[#E0FE10] font-bold">Investment Brief</span></p>
            </div>
          </div>
        </section>
        
        {/* Slide 18: What Gunna Gets */}
        <section 
          data-slide="16"
          ref={(el) => { sectionRefs.current[16] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background Image with Overlay */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-proclamation.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/70"></div>
          </div>
          
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-left md:text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-12 text-white animate-fade-in-up`}>
              What <span className="text-[#E0FE10]">Gunna</span> Gets
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up animation-delay-300">
              {/* First item - Equity highlighted prominently */}
              <div className="flex items-start gap-4 bg-gradient-to-r from-[#E0FE10]/20 to-zinc-900/50 p-6 rounded-xl border-2 border-[#E0FE10]/50 text-left">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-6 h-6 text-black" />
                </div>
                <p className="text-white text-lg font-bold">Meaningful <span className="text-[#E0FE10] text-xl">equity ownership</span> in Pulse</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-lg">Input on product direction, especially run club features</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-lg">Technology infrastructure to scale Wunna Run globally</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-lg">Rich data on his community for merch, pre-sales, and fan experiences</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-lg">Year-round engagement platform beyond physical events</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-lg">A partner aligned with his mission of health, wellness, and community</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 19: Timeline */}
        <section 
          data-slide="17"
          ref={(el) => { sectionRefs.current[17] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black"></div>
          
          {/* Subtle animated timeline/calendar background (hidden during PDF export) */}
          {!isGeneratingPDF && (
          <div className="absolute inset-0 pointer-events-none opacity-15">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
              {/* Horizontal calendar grid lines */}
              {[80, 160, 240, 320].map((y) => (
                <line key={`h-${y}`} x1="0" y1={y} x2="800" y2={y} stroke="#52525b" strokeWidth="0.5" strokeDasharray="8 8" opacity="0.5" />
              ))}
              {/* Vertical time markers */}
              {[100, 200, 300, 400, 500, 600, 700].map((x) => (
                <line key={`v-${x}`} x1={x} y1="40" x2={x} y2="360" stroke="#52525b" strokeWidth="0.5" strokeDasharray="4 12" opacity="0.4" />
              ))}
              
              {/* Main timeline path - flowing curve */}
              <path 
                d="M 50 300 Q 150 280 250 200 Q 350 120 450 180 Q 550 240 650 140 Q 720 80 780 100" 
                fill="none" 
                stroke={wunnaGreen} 
                strokeWidth="2" 
                strokeDasharray="8 4"
                opacity="0.6"
              >
                <animate attributeName="stroke-dashoffset" values="24;0" dur="2s" repeatCount="indefinite" />
              </path>
              
              {/* Milestone nodes along the path */}
              <circle cx="250" cy="200" r="6" fill={wunnaGreen} opacity="0.8">
                <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="450" cy="180" r="6" fill={wunnaPurple} opacity="0.8">
                <animate attributeName="r" values="6;8;6" dur="2s" begin="0.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="650" cy="140" r="6" fill={wunnaBlue} opacity="0.8">
                <animate attributeName="r" values="6;8;6" dur="2s" begin="1s" repeatCount="indefinite" />
              </circle>
              
              {/* Small clock/progress markers scattered */}
              <circle cx="100" cy="100" r="3" fill="#52525b" opacity="0.5" />
              <circle cx="200" cy="320" r="3" fill="#52525b" opacity="0.5" />
              <circle cx="350" cy="80" r="3" fill="#52525b" opacity="0.5" />
              <circle cx="500" cy="320" r="3" fill="#52525b" opacity="0.5" />
              <circle cx="600" cy="280" r="3" fill="#52525b" opacity="0.5" />
              <circle cx="700" cy="200" r="3" fill="#52525b" opacity="0.5" />
            </svg>
          </div>
          )}
          
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-12 text-white animate-fade-in-up`}>
              <span className="text-[#E0FE10]">Timeline</span>
            </h2>
            
            <div className="space-y-6 max-w-2xl mx-auto animate-fade-in-up animation-delay-300">
              <div className="flex items-center gap-6">
                <div className="w-24 text-right">
                  <p className="text-[#E0FE10] font-bold">March 20</p>
                </div>
                <div className="w-4 h-4 rounded-full bg-[#E0FE10]"></div>
                <div className="flex-1 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                  <p className="text-white font-medium">Paris (potential soft launch)</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="w-24 text-right">
                  <p className="text-[#E0FE10] font-bold">March 31</p>
                </div>
                <div className="w-4 h-4 rounded-full bg-[#E0FE10]"></div>
                <div className="flex-1 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                  <p className="text-white font-medium">London (potential launch)</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="w-24 text-right">
                  <p className="text-[#E0FE10] font-bold">Q2 2026</p>
                </div>
                <div className="w-4 h-4 rounded-full bg-[#E0FE10]"></div>
                <div className="flex-1 bg-zinc-950 p-4 rounded-xl border border-[#E0FE10]/30">
                  <p className="text-white font-medium">Full rollout across all Wunna Run events</p>
                </div>
              </div>
            </div>
            
            <div className="mt-12 text-center animate-fade-in-up animation-delay-600">
              <p className="text-xl text-zinc-400">We can move as fast as you need.</p>
            </div>
          </div>
        </section>
        
        {/* Slide 20: Next Steps */}
        <section 
          data-slide="18"
          ref={(el) => { sectionRefs.current[18] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className={getContentClasses('left')}>
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-12 text-white animate-fade-in-up`}>
              Next <span className="text-[#E0FE10]">Steps</span>
            </h2>
            
            <div className="space-y-4 max-w-2xl animate-fade-in-up animation-delay-300">
              {[
                'Review this deck and the attached Investment Brief',
                'Schedule a call with Tremaine to discuss questions and interest',
                'Align on structure — partnership, investment, or both',
                'Draft formal agreements',
                'Begin integration planning',
              ].map((step, index) => (
                <div key={index} className="flex items-center gap-4 bg-zinc-900/50 p-5 rounded-xl border border-zinc-800 text-left">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0">
                    <span className="text-black font-bold">{index + 1}</span>
                  </div>
                  <p className="text-zinc-300 text-lg">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Slide 21: Let's Build */}
        <section 
          data-slide="19"
          ref={(el) => { sectionRefs.current[19] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Clean gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900"></div>
          
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <div className="animate-fade-in-up">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                Let's <span className="text-[#E0FE10]">Build</span>
              </h2>
              
              <p className="text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
                Wunna Run is already changing lives. Pulse helps you scale that impact.
              </p>
              
              <p className="text-2xl text-[#E0FE10] font-bold mb-12">Let's talk.</p>
              
              <GlassCard className="max-w-md mx-auto mb-12">
                <div className="p-8">
                  <h3 className="text-white font-bold text-xl mb-4">Tremaine Grant</h3>
                  <p className="text-zinc-400 mb-6">Founder & CEO, Pulse</p>
                  
                  <div className="space-y-3 text-left">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-[#E0FE10]" />
                      <a href="mailto:tre@fitwithpulse.ai" className="text-zinc-300 hover:text-[#E0FE10] transition-colors">
                        tre@fitwithpulse.ai
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-[#E0FE10]" />
                      <a href="tel:+19545484221" className="text-zinc-300 hover:text-[#E0FE10] transition-colors">
                        (954) 548-4221
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-[#E0FE10]" />
                      <a href="https://fitwithpulse.ai" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-[#E0FE10] transition-colors">
                        fitwithpulse.ai
                      </a>
                    </div>
                  </div>
                </div>
              </GlassCard>
              
              <div className="flex flex-col items-center animate-fade-in-up animation-delay-600">
                <div className="flex gap-8 items-center">
                  <div className="flex flex-col items-center">
                    <img src="/PulseWhite.png" alt="Pulse Logo" className="h-12 w-auto mb-2" />
                    <p className="text-[#E0FE10] text-sm font-medium">Pulse</p>
                  </div>
                  <div className="text-white text-2xl">×</div>
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-bold text-white mb-2">WUNNA RUN</span>
                    <p className="text-zinc-400 text-sm">Gunna</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Download button */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <button 
          onClick={handleDownloadPDF}
          disabled={isGeneratingPDF}
          className={`flex items-center bg-[#E0FE10] text-black font-medium ${isMobile ? 'text-sm px-3 py-1.5' : 'px-4 py-2'} rounded-full shadow-lg hover:bg-[#E0FE10]/90 transition-all disabled:opacity-70`}
        >
          {isGeneratingPDF ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
              Generating PDF... {pdfProgress}%
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

export default WunnaRun; 

export const getServerSideProps: GetServerSideProps<WunnaRunProps> = async (_context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('WunnaRun');
  } catch (error) {
    console.error("Error fetching page meta data for WunnaRun page:", error);
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
