import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, Users, Trophy, MessageCircle, BarChart3, BarChart2, Smartphone, Bell, MapPin, Globe, Zap, CheckCircle, Calendar, Phone, Mail, Download, Copy, Layers, Building2, TrendingUp, DollarSign, Target, Sparkles, Play, Heart, UserPlus, Award, Briefcase, Rocket, X } from 'lucide-react';
import Header from '../components/Header';
import PageHead from '../components/PageHead';
import { GetServerSideProps } from 'next';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';
import { auth } from '../api/firebase/config';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Define a serializable version of PageMetaData for this page's props
interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface PitchProps {
  metaData: SerializablePageMetaData | null;
}

const PITCH_PASSCODE = 'PULSE';
const ADMIN_PASSCODE = 'ONEUP';
const PITCH_UNLOCK_KEY = 'pitch-unlocked';
const PITCH_PASSCODE_USED_KEY = 'pitch-passcode-used';

const Pitch = ({ metaData }: PitchProps) => {
  const [activeSection, setActiveSection] = useState(0);
  const [_isMobileMenuOpen, _setIsMobileMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [copied, setCopied] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsVisitors, setAnalyticsVisitors] = useState<Array<{ ip: string; location: string; count: number; lastSeen: string; firstSeen: string; visitorId: string | null }>>([]);
  const [analyticsDetailIp, setAnalyticsDetailIp] = useState<string | null>(null);
  const [analyticsLogs, setAnalyticsLogs] = useState<Array<{ id: string; timestamp: string; location: string | null; userAgent: string | null; visitorId: string | null }>>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const totalSections = 20;
  const sectionRefs = useRef<(HTMLDivElement | null)[]>(Array(totalSections).fill(null));
  const activeSectionRef = useRef(0);
  const mainRef = useRef<HTMLElement | null>(null);

  const [passcodeUsed, setPasscodeUsed] = useState<'PULSE' | 'ONEUP' | null>(null);
  const showAnalyticsButton = passcodeUsed === 'ONEUP';
  
  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  // Brand colors
  const pulseGreen = '#E0FE10';
  const pulsePurple = '#8B5CF6';
  const pulseBlue = '#3B82F6';

  const linkedIn = {
    tremaine: 'https://linkedin.com/in/tremainegrant',
    marques: 'https://www.linkedin.com/in/marqueszak/',
    valerie: 'https://linkedin.com/in/speakhappiness-keynotespeaker',
    deray: 'https://www.linkedin.com/in/deray-mckesson-14523113',
    bobby: 'https://www.linkedin.com/search/results/all/?keywords=Bobby%20Nweke',
    lola: 'https://www.linkedin.com/search/results/all/?keywords=Lola%20Oluwaladun',
    erik: 'https://www.linkedin.com/search/results/all/?keywords=Erik%20Edwards%20Cooley',
  } as const;
  
  // Check sessionStorage for existing passcode unlock
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const unlocked = sessionStorage.getItem(PITCH_UNLOCK_KEY) === 'true';
      const used = sessionStorage.getItem(PITCH_PASSCODE_USED_KEY) as 'PULSE' | 'ONEUP' | null;
      setIsUnlocked(!!unlocked);
      if (unlocked && (used === 'PULSE' || used === 'ONEUP')) setPasscodeUsed(used);
    } catch {
      setIsUnlocked(false);
    }
  }, []);

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    const trimmed = passcodeInput.trim().toUpperCase();
    if (trimmed === PITCH_PASSCODE) {
      try {
        sessionStorage.setItem(PITCH_UNLOCK_KEY, 'true');
        sessionStorage.setItem(PITCH_PASSCODE_USED_KEY, 'PULSE');
      } catch {
        // ignore
      }
      setPasscodeUsed('PULSE');
      setIsUnlocked(true);
      setPasscodeInput('');
    } else if (trimmed === ADMIN_PASSCODE) {
      try {
        sessionStorage.setItem(PITCH_UNLOCK_KEY, 'true');
        sessionStorage.setItem(PITCH_PASSCODE_USED_KEY, 'ONEUP');
      } catch {
        // ignore
      }
      setPasscodeUsed('ONEUP');
      setIsUnlocked(true);
      setPasscodeInput('');
    } else {
      setPasscodeError('Incorrect passcode. Please try again.');
    }
  };

  // Record page view for analytics
  useEffect(() => {
    const visitorId = (() => {
      try {
        const key = 'pitch-visitor-id';
        let id = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        if (!id) {
          id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
          if (typeof window !== 'undefined') localStorage.setItem(key, id);
        }
        return id;
      } catch {
        return null;
      }
    })();
    fetch('/api/pitch/record-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visitorId ? { visitorId } : {}),
    }).catch(() => {});
  }, []);

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
    const rootEl = mainRef.current;
    
    const setActiveWithDebounce = (newIndex: number) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      
      if (!isTransitioning && newIndex !== activeSectionRef.current) {
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
          
          if (index !== -1 && index !== activeSectionRef.current) {
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
            
            if (index !== -1 && index !== activeSectionRef.current) {
              setActiveWithDebounce(index);
            }
          }
        }
      },
      {
        root: rootEl ?? null,
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
  }, [totalSections, isNavigating]);

  // Fallback scroll tracking
  useEffect(() => {
    const container = mainRef.current ?? window;
    let rafId: number | null = null;

    const handleScroll = () => {
      if (isNavigating) return;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const root = mainRef.current;
        const containerRect = root ? root.getBoundingClientRect() : { top: 0, height: window.innerHeight };
        const targetY = containerRect.top + containerRect.height / 2;
        let bestIndex = activeSectionRef.current;
        let bestDistance = Number.POSITIVE_INFINITY;

        sectionRefs.current.forEach((section, idx) => {
          if (!section) return;
          const rect = section.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const distance = Math.abs(centerY - targetY);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = idx;
          }
        });

        if (bestIndex !== activeSectionRef.current) {
          setActiveSection(bestIndex);
        }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isNavigating]);
  
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

  const getPresentationAsText = () => {
    const lines = [
      '——— SLIDE 1: TITLE ———',
      'GET FIT WITH PULSE',
      'The community-first fitness platform for creators and seekers.',
      'fitwithpulse.ai',
      '',
      '——— SLIDE 2: MEET JAIDUS (FITNESS CREATOR) ———',
      'Jaidus\' Problem: He needs ways to monetize his expertise.',
      'Fitness creators struggle to build sustainable income from their communities.',
      '',
      '——— SLIDE 3: MEET KAITLEN (FITNESS SEEKER) ———',
      'Kaitlen\'s Problem: Wants to train with Jaidus, but can\'t get to Soul Cycle.',
      'Fitness seekers want access to quality training from creators they admire.',
      '',
      '——— SLIDE 4: INTRODUCING PULSE ———',
      'Pulse is a community-first fitness platform.',
      'Capture Moves — bite-sized movement videos',
      'Compete in Rounds — workouts where community can compete',
      '',
      '——— SLIDE 5: MOVES ———',
      'CAPTURE: Single bite-sized movement videos.',
      'Creators can capture and share their signature moves.',
      '',
      '——— SLIDE 6: ROUNDS ———',
      'COMPETE: Module where multiple members of your community can compete.',
      'Rounds are the core engagement mechanic.',
      '',
      '——— SLIDE 7: CREATORS ARE DISCOVERABLE ———',
      'PULSE AI: AI matches fitness seekers with perfect creators for their goals.',
      'Seekers find creators through intelligent matching.',
      '',
      '——— SLIDE 8: PEOPLE CONNECT WITH REAL PEOPLE ———',
      'Integration with TikTok, YouTube, Instagram.',
      'Creators bring their existing audience to Pulse.',
      '',
      '——— SLIDE 9: WE INVEST IN THE CREATORS ———',
      'Pulse invests directly in creators.',
      'We help creators build sustainable businesses.',
      '',
      '——— SLIDE 10: CREATORS BRING THEIR COMMUNITY ———',
      'Fitness Creators → Fitness Seekers',
      'Creator-led growth model.',
      '',
      '——— SLIDE 11: PRICING ———',
      'Fitness Creators: $19.99/year',
      'Fitness Seekers: $9.99/month or $79.99/year',
      'Coming: Creator subscriptions with custom pricing.',
      '',
      '——— SLIDE 12: RESULTS ———',
      '$10k Revenue',
      'Brand partnerships: Skadoo, solidcore, bookkeepers.com, etc.',
      '',
      '——— SLIDE 13: OUR TAKE (BUSINESS MODEL) ———',
      '$80 (seeker subscription) + $40 (platform fee) × 50 (seekers per round) = $2,080 per round',
      'Pulse takes 20% of Round revenue.',
      '',
      '——— SLIDE 14: CREATOR ACTIVITY TARGET ———',
      'We encourage fitness creators to host at least 2 Standard Rounds per year.',
      '2 Rounds × $2,000 each = $4,080 annual revenue per creator.',
      '',
      '——— SLIDE 15: BEACHHEAD MARKET ———',
      '350,000 fitness creators',
      '$4,080 annual revenue per creator',
      '$1.4 Billion market opportunity',
      '',
      '——— SLIDE 16: PATH TO $100M ———',
      '25,000 Creators = $100M ARR',
      '$1M → $10M → $50M → $100M',
      'Milestone-based growth trajectory.',
      '',
      '——— SLIDE 17: PARTNERSHIPS ———',
      'We focused on building partnerships with brands that align with our mission.',
      'Brands we\'ve worked with: Skadoo, solidcore',
      'Brands we\'d love to work with: L\'Oréal, lululemon, alo, wellhub',
      '',
      '——— SLIDE 18: WHO\'S BUILDING PULSE? ———',
      'Core Team: Tremaine Grant (CEO & Founder), Bobby Nweke (Chief of Staff), Lola Oluwaladun (Design Lead)',
      'Advisors: Marques Zak (CMO @ ACC), Valerie Alexander (Fortune 500 Consultant), DeRay Mckesson (Campaign Zero), Erik Edwards (Partner @ Cooley)',
      '',
      '——— SLIDE 19: THE ASK ———',
      '$1M to turn creator acquisition into a machine.',
      'Use of funds: Product Team, Creator Success team, Marketing, and Paid Partnerships.',
      'Outcome: 25,000 creators.',
      '',
      '——— SLIDE 20: CTA ———',
      'Whether you\'re learning, earning, teaching, or just having fun—there\'s a place for you on Pulse.',
      'fitwithpulse.ai',
      '',
      '——— END ———',
    ];
    return lines.join('\n');
  };

  const handleCopyToClipboard = async () => {
    try {
      const text = getPresentationAsText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = getPresentationAsText();
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        alert('Could not copy to clipboard.');
      }
    }
  };

  const getAnalyticsHeaders = async (): Promise<Record<string, string>> => {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken(true);
      return { Authorization: `Bearer ${token}` };
    }
    if (passcodeUsed === 'ONEUP') {
      return { 'X-Pitch-Passcode': 'ONEUP' };
    }
    return {};
  };

  const fetchAnalyticsList = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const headers = await getAnalyticsHeaders();
      const res = await fetch('/api/pitch/analytics', { headers });
      if (!res.ok) throw new Error('Failed to load analytics');
      const data = await res.json();
      setAnalyticsVisitors(data.visitors ?? []);
    } catch (e) {
      setAnalyticsError(e instanceof Error ? e.message : 'Failed to load analytics');
      setAnalyticsVisitors([]);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchAnalyticsDetail = async (ip: string) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    setAnalyticsDetailIp(ip);
    try {
      const headers = await getAnalyticsHeaders();
      const res = await fetch(`/api/pitch/analytics?ip=${encodeURIComponent(ip)}`, { headers });
      if (!res.ok) throw new Error('Failed to load access log');
      const data = await res.json();
      setAnalyticsLogs(data.logs ?? []);
    } catch (e) {
      setAnalyticsError(e instanceof Error ? e.message : 'Failed to load access log');
      setAnalyticsLogs([]);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const openAnalyticsModal = () => {
    setAnalyticsOpen(true);
    setAnalyticsDetailIp(null);
    setAnalyticsLogs([]);
    setAnalyticsError(null);
    fetchAnalyticsList();
  };

  const closeAnalyticsModal = () => {
    setAnalyticsOpen(false);
    setAnalyticsDetailIp(null);
    setAnalyticsLogs([]);
    setAnalyticsVisitors([]);
  };
  
  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      setPdfProgress(0);
      
      const pdfWidth = 1280;
      const pdfHeight = 720;
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });
      
      const mainContainer = document.querySelector('main');
      if (!mainContainer) {
        throw new Error('Main container not found');
      }
      
      const navElements = document.querySelectorAll('.fixed');
      const originalStyles: string[] = [];
      navElements.forEach((el, idx) => {
        originalStyles[idx] = (el as HTMLElement).style.cssText;
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
      });
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if ((document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }

      const captureScale = 2;
      const jpegQuality = 0.75;
      
      for (let i = 0; i < totalSections; i++) {
        const section = sectionRefs.current[i];
        if (!section) continue;
        
        setPdfProgress(Math.round(((i + 1) / totalSections) * 100));
        
        section.scrollIntoView({ behavior: 'auto', block: 'start' });
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
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
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
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
            
            clonedSection.style.transform = 'none';
            clonedSection.style.position = 'relative';
            clonedSection.style.top = '0';
            clonedSection.style.left = '0';
            clonedSection.style.margin = '0';
            clonedSection.style.overflow = 'hidden';
            clonedSection.style.width = `${viewportWidth}px`;
            clonedSection.style.height = `${viewportHeight}px`;
            
            const view = clonedDoc.defaultView;

            const zIndexEls = clonedSection.querySelectorAll('[class*="z-"]');
            zIndexEls.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const computedPos = view?.getComputedStyle(htmlEl).position;
              if (computedPos === 'static') {
                htmlEl.style.position = 'relative';
              }
            });

            const directChildren = Array.from(clonedSection.children) as HTMLElement[];
            const bgWrapper = directChildren.find((child) =>
              child.classList.contains('absolute') && child.classList.contains('inset-0')
            );

            if (bgWrapper) {
              bgWrapper.style.zIndex = '0';
              bgWrapper.style.pointerEvents = 'none';

              const bgImg = bgWrapper.querySelector('img[class*="object-cover"]') as HTMLImageElement | null;
              if (bgImg?.src) {
                const bgImgComputed = view?.getComputedStyle(bgImg);
                const objectPos = bgImgComputed?.objectPosition || 'center';
                const opacity = parseFloat(bgImgComputed?.opacity || '1');

                if (opacity >= 0.99) {
                  bgWrapper.style.backgroundImage = `url(${bgImg.src})`;
                  bgWrapper.style.backgroundSize = 'cover';
                  bgWrapper.style.backgroundPosition = objectPos;
                  bgWrapper.style.backgroundRepeat = 'no-repeat';

                  bgImg.style.display = 'none';
                }
              }
            }

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
            
            const blurElements = clonedDoc.querySelectorAll('[class*="blur"]');
            blurElements.forEach(el => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.backdropFilter = 'none';
              htmlEl.style.setProperty('-webkit-backdrop-filter', 'none');
            });
            
            const fixedEls = clonedDoc.querySelectorAll('.fixed');
            fixedEls.forEach(el => {
              (el as HTMLElement).style.display = 'none';
            });
            
            const animatedEls = clonedDoc.querySelectorAll('[class*="animate-"]');
            animatedEls.forEach(el => {
              (el as HTMLElement).style.animation = 'none';
              (el as HTMLElement).style.opacity = '1';
              (el as HTMLElement).style.transform = 'none';
            });
          }
        });
        
        const outCanvas = document.createElement('canvas');
        outCanvas.width = pdfWidth;
        outCanvas.height = pdfHeight;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          throw new Error('Could not create canvas context');
        }
        outCtx.imageSmoothingEnabled = true;
        (outCtx as any).imageSmoothingQuality = 'high';
        outCtx.drawImage(canvas, 0, 0, pdfWidth, pdfHeight);

        const imgData = outCanvas.toDataURL('image/jpeg', jpegQuality);
        
        if (i > 0) {
          pdf.addPage([pdfWidth, pdfHeight], 'landscape');
        }
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
      }
      
      navElements.forEach((el, idx) => {
        (el as HTMLElement).style.cssText = originalStyles[idx];
      });
      
      sectionRefs.current[0]?.scrollIntoView({ behavior: 'auto' });
      
      pdf.save('Pulse_Investor_Deck.pdf');
      
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
      return `w-full min-h-[100dvh] min-h-screen snap-start flex flex-col items-center justify-center relative ${bgColor} overflow-x-hidden overflow-y-visible pt-16 pb-10 px-4 box-border`;
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

  // Glass card component
  const GlassCard = ({ children, className = '', accentColor = pulseGreen }: { children: React.ReactNode; className?: string; accentColor?: string }) => (
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
  
  // Passcode gate
  if (!isUnlocked) {
    return (
      <div className="bg-zinc-950 text-white min-h-screen flex flex-col items-center justify-center px-6">
        <PageHead 
          metaData={metaData}
          pageOgUrl="https://fitwithpulse.ai/pitch"
          pageOgImage="/pulse-pitch-og.png"
        />
        <img src="/PulseWhite.png" alt="Pulse" className="h-14 w-auto mb-6" />
        <h1 className="text-xl font-bold text-white mb-1">Pitch Deck</h1>
        <p className="text-zinc-400 text-sm mb-6">Enter passcode to view the presentation</p>
        <form onSubmit={handlePasscodeSubmit} className="flex flex-col gap-3 w-full max-w-[240px]">
          <input
            type="password"
            value={passcodeInput}
            onChange={(e) => {
              setPasscodeInput(e.target.value.toUpperCase());
              setPasscodeError('');
            }}
            placeholder="Passcode"
            className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] uppercase"
            style={{ textTransform: 'uppercase' }}
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
        pageOgUrl="https://fitwithpulse.ai/pitch"
        pageOgImage="/pulse-pitch-og.png"
      />
      
      <Header 
        onSectionChange={() => {}}
        currentSection="home"
        toggleMobileMenu={() => {}}
        setIsSignInModalVisible={() => {}}
        theme="dark"
        hideNav={true}
      />

      {/* Fullscreen loader while generating PDF */}
      {isGeneratingPDF && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-10 h-10 border-2 border-[#E0FE10] border-t-transparent rounded-full animate-spin"></div>
            <div className="text-white text-lg font-semibold">Downloading PDF…</div>
            <div className="text-zinc-400 text-sm">Capturing slides {pdfProgress}%</div>
          </div>
        </div>
      )}
      
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
      
      {/* Fixed Slide Counter + Download + Copy - Top Right */}
      <div className="fixed top-6 right-6 md:right-20 z-50 flex items-center gap-2 md:gap-3">
        {showAnalyticsButton && (
          <>
            <button
              onClick={openAnalyticsModal}
              className={`flex items-center justify-center rounded-full shadow-lg transition-all bg-zinc-700 hover:bg-zinc-600 text-white ${isMobile ? 'w-9 h-9' : 'w-10 h-10'}`}
              aria-label="View analytics"
              title="View analytics (IP / access log)"
            >
              <BarChart2 size={isMobile ? 14 : 16} />
            </button>
            <button 
              onClick={handleCopyToClipboard}
              className={`flex items-center justify-center rounded-full shadow-lg transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-white'} ${isMobile ? 'w-9 h-9' : 'w-10 h-10'}`}
              aria-label={copied ? 'Copied to clipboard' : 'Copy presentation as text'}
              title={copied ? 'Copied!' : 'Copy presentation as text'}
            >
              {copied ? (
                <CheckCircle size={isMobile ? 16 : 18} />
              ) : (
                <Copy size={isMobile ? 14 : 16} />
              )}
            </button>
          </>
        )}
        <button 
          onClick={handleDownloadPDF}
          disabled={isGeneratingPDF}
          className={`flex items-center bg-[#E0FE10] text-black font-medium ${isMobile ? 'text-xs px-2.5 py-1.5' : 'text-sm px-3 py-2'} rounded-full shadow-lg hover:bg-[#E0FE10]/90 transition-all disabled:opacity-70`}
        >
          {isGeneratingPDF ? (
            <>
              <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin mr-1.5"></div>
              {pdfProgress}%
            </>
          ) : (
            <>
              <Download size={isMobile ? 12 : 14} className="mr-1.5" />
              {isMobile ? 'Download' : 'Download Deck'}
            </>
          )}
        </button>
        <div className="bg-[#E0FE10] text-black px-4 py-2 rounded-full font-bold text-sm shadow-lg">
          {activeSection + 1}/{totalSections}
        </div>
      </div>

      {/* Analytics Modal */}
      {analyticsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true" aria-labelledby="analytics-modal-title">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              {analyticsDetailIp ? (
                <button
                  onClick={() => { setAnalyticsDetailIp(null); setAnalyticsLogs([]); fetchAnalyticsList(); }}
                  className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <ChevronLeft size={20} />
                  <span>Back</span>
                </button>
              ) : (
                <h2 id="analytics-modal-title" className="text-lg font-bold text-white">Pitch Deck Analytics</h2>
              )}
              <button
                onClick={closeAnalyticsModal}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {analyticsError && (
                <p className="text-red-400 text-sm mb-4">{analyticsError}</p>
              )}
              {analyticsLoading && !analyticsDetailIp && analyticsVisitors.length === 0 && (
                <p className="text-zinc-400 text-sm">Loading visitors…</p>
              )}
              {analyticsLoading && analyticsDetailIp && analyticsLogs.length === 0 && (
                <p className="text-zinc-400 text-sm">Loading access log…</p>
              )}
              {!analyticsDetailIp && analyticsVisitors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-zinc-400 text-sm mb-3">Click an IP to see access times.</p>
                  {analyticsVisitors.map((v) => (
                    <button
                      key={v.ip}
                      onClick={() => fetchAnalyticsDetail(v.ip)}
                      className="w-full text-left p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="font-mono text-[#E0FE10]">{v.ip}</span>
                      {v.visitorId && <span className="text-zinc-500 text-xs font-mono" title="Stable visitor ID (same across IPs)">{v.visitorId}</span>}
                      <span className="text-zinc-400 text-sm">{v.location}</span>
                      <span className="text-white font-semibold">{v.count} visit{v.count !== 1 ? 's' : ''}</span>
                      <span className="text-zinc-500 text-xs w-full md:w-auto">Last: {v.lastSeen ? new Date(v.lastSeen).toLocaleString() : '—'}</span>
                    </button>
                  ))}
                </div>
              )}
              {analyticsDetailIp && (
                <>
                  <h3 className="text-white font-semibold mb-2 font-mono break-all">{analyticsDetailIp}</h3>
                  <p className="text-zinc-400 text-sm mb-3">Access log ({analyticsLogs.length} entries)</p>
                  <ul className="space-y-2">
                    {analyticsLogs.map((log) => (
                      <li key={log.id} className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-sm">
                        <span className="text-white">{new Date(log.timestamp).toLocaleString()}</span>
                        {log.visitorId && <span className="text-zinc-500 text-xs font-mono ml-2" title="Stable visitor ID">({log.visitorId})</span>}
                        {log.location && <span className="text-zinc-400 ml-2">— {log.location}</span>}
                        {log.userAgent && <div className="text-zinc-500 text-xs mt-1 truncate" title={log.userAgent}>{log.userAgent}</div>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
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
      <main
        ref={mainRef}
        id="main-content"
        className={isMobile ? "snap-y snap-mandatory h-screen overflow-y-auto overflow-x-hidden overscroll-y-none" : "snap-y snap-mandatory h-screen overflow-y-scroll"}
        style={isMobile ? { WebkitOverflowScrolling: 'touch' } : undefined}
      >
        
        {/* Slide 1: Title - GET FIT WITH PULSE */}
        <section 
          data-slide="0"
          ref={(el) => { sectionRefs.current[0] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background with gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          
          {/* Animated grid background */}
          {!isGeneratingPDF && (
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute inset-0" style={{
                backgroundImage: `linear-gradient(rgba(224, 254, 16, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(224, 254, 16, 0.1) 1px, transparent 1px)`,
                backgroundSize: '50px 50px'
              }}></div>
            </div>
          )}
          
          {/* Main Content */}
          <div className={`${getContentClasses()} z-10 flex flex-col items-center justify-center`}>
            <p className="text-zinc-400 text-lg md:text-xl mb-4 animate-fade-in-up uppercase tracking-widest">Get Fit With</p>
            
            <img 
              src="/PulseGreen.png" 
              alt="Pulse" 
              className={`${isMobile ? 'h-20 md:h-28' : 'h-28 md:h-40 lg:h-48'} w-auto mb-8 animate-fade-in-up animation-delay-150`}
            />
            
            <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-zinc-300 animate-fade-in-up animation-delay-300 max-w-2xl mx-auto text-center mb-8`}>
              The community-first fitness platform for <span className="text-[#E0FE10] font-semibold">creators</span> and <span className="text-[#E0FE10] font-semibold">seekers</span>.
            </p>
            
            <div className="flex items-center gap-4 animate-fade-in-up animation-delay-450">
              <div className="px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700">
                <span className="text-zinc-300 text-sm">Pre-Seed Round</span>
              </div>
              <div className="px-4 py-2 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/50">
                <span className="text-[#E0FE10] text-sm font-semibold">$1M Raise</span>
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20 animate-fade-in-up animation-delay-600">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 2: Meet Jaidus - Fitness Creator */}
        <section 
          data-slide="1"
          ref={(el) => { sectionRefs.current[1] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              {/* Left - Image */}
              <div className="lg:w-2/5 animate-fade-in-up">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-[#E0FE10]/20 to-transparent rounded-3xl blur-2xl"></div>
                  <img 
                    src="/invest-jaidus.png" 
                    alt="Jaidus - Fitness Creator" 
                    className="relative w-full max-w-sm mx-auto rounded-2xl border-2 border-[#E0FE10]/40"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=500&fit=crop';
                    }}
                  />
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-black/90 backdrop-blur-sm border border-[#E0FE10]/50 rounded-xl px-4 py-2">
                      <p className="text-[#E0FE10] font-bold text-sm">JAIDUS</p>
                      <p className="text-zinc-400 text-xs">Fitness Creator</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right - Content */}
              <div className="lg:w-3/5 text-left animate-fade-in-up animation-delay-150">
                <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white`}>
                  Meet <span className="text-[#E0FE10]">Jaidus</span>
                </h2>
                
                <GlassCard className="mb-6">
                  <div className="p-6">
                    <p className="text-[#E0FE10] text-xs uppercase tracking-widest mb-3">Jaidus' Problem</p>
                    <p className="text-white text-xl md:text-2xl font-medium leading-relaxed">
                      He needs ways to <span className="text-[#E0FE10] font-bold">monetize his expertise</span>.
                    </p>
                  </div>
                </GlassCard>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <X className="w-3 h-3 text-red-400" />
                    </div>
                    <p className="text-zinc-300">Social media algorithms limit his reach</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <X className="w-3 h-3 text-red-400" />
                    </div>
                    <p className="text-zinc-300">No direct relationship with his community</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <X className="w-3 h-3 text-red-400" />
                    </div>
                    <p className="text-zinc-300">Brand deals are inconsistent and undervalued</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 3: Meet Kaitlen - Fitness Seeker */}
        <section 
          data-slide="2"
          ref={(el) => { sectionRefs.current[2] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-12">
              {/* Right - Image */}
              <div className="lg:w-2/5 animate-fade-in-up">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-l from-[#8B5CF6]/20 to-transparent rounded-3xl blur-2xl"></div>
                  <img 
                    src="/invest-kaitlen.png" 
                    alt="Kaitlen - Fitness Seeker" 
                    className="relative w-full max-w-sm mx-auto rounded-2xl border-2 border-[#8B5CF6]/40"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=500&fit=crop';
                    }}
                  />
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-black/90 backdrop-blur-sm border border-[#8B5CF6]/50 rounded-xl px-4 py-2">
                      <p className="text-[#8B5CF6] font-bold text-sm">KAITLEN</p>
                      <p className="text-zinc-400 text-xs">Fitness Seeker</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Left - Content */}
              <div className="lg:w-3/5 text-left animate-fade-in-up animation-delay-150">
                <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white`}>
                  Meet <span className="text-[#8B5CF6]">Kaitlen</span>
                </h2>
                
                <GlassCard accentColor={pulsePurple} className="mb-6">
                  <div className="p-6">
                    <p className="text-[#8B5CF6] text-xs uppercase tracking-widest mb-3">Kaitlen's Problem</p>
                    <p className="text-white text-xl md:text-2xl font-medium leading-relaxed">
                      Wants to train with Jaidus, but <span className="text-[#8B5CF6] font-bold">can't get to the studio</span>.
                    </p>
                  </div>
                </GlassCard>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <X className="w-3 h-3 text-red-400" />
                    </div>
                    <p className="text-zinc-300">Geographic barriers to quality training</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <X className="w-3 h-3 text-red-400" />
                    </div>
                    <p className="text-zinc-300">Generic workout apps lack personal connection</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <X className="w-3 h-3 text-red-400" />
                    </div>
                    <p className="text-zinc-300">No accountability or community support</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 4: Introducing Pulse */}
        <section 
          data-slide="3"
          ref={(el) => { sectionRefs.current[3] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
            <div className="text-center mb-10 animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold text-white mb-4`}>
                Introducing <span className="text-[#E0FE10]">Pulse</span>
              </h2>
              <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto">
                The platform that connects fitness creators with seekers through engaging, community-driven experiences.
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
              {/* App Screenshots */}
              <div className="flex items-center justify-center gap-4 animate-fade-in-up animation-delay-300">
                <img 
                  src="/invest-app-1.png" 
                  alt="Pulse App - Creator Profile" 
                  className={`w-auto rounded-[32px] border-2 border-[#E0FE10]/40 shadow-2xl ${isMobile ? 'h-[300px]' : 'h-[400px] md:h-[500px]'} object-contain`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <img 
                  src="/invest-app-2.png" 
                  alt="Pulse App - Rounds" 
                  className={`w-auto rounded-[32px] border-2 border-[#E0FE10]/40 shadow-2xl ${isMobile ? 'h-[300px]' : 'h-[400px] md:h-[500px]'} object-contain`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              
              {/* Feature highlights */}
              <div className="grid grid-cols-2 gap-4 animate-fade-in-up animation-delay-450">
                <GlassCard>
                  <div className="p-4 text-center">
                    <Play className="w-8 h-8 text-[#E0FE10] mx-auto mb-2" />
                    <p className="text-white font-bold text-sm">Moves</p>
                    <p className="text-zinc-400 text-xs">Capture movements</p>
                  </div>
                </GlassCard>
                <GlassCard>
                  <div className="p-4 text-center">
                    <Trophy className="w-8 h-8 text-[#E0FE10] mx-auto mb-2" />
                    <p className="text-white font-bold text-sm">Rounds</p>
                    <p className="text-zinc-400 text-xs">Compete together</p>
                  </div>
                </GlassCard>
                <GlassCard>
                  <div className="p-4 text-center">
                    <Users className="w-8 h-8 text-[#E0FE10] mx-auto mb-2" />
                    <p className="text-white font-bold text-sm">Community</p>
                    <p className="text-zinc-400 text-xs">Real connections</p>
                  </div>
                </GlassCard>
                <GlassCard>
                  <div className="p-4 text-center">
                    <Sparkles className="w-8 h-8 text-[#E0FE10] mx-auto mb-2" />
                    <p className="text-white font-bold text-sm">AI Matching</p>
                    <p className="text-zinc-400 text-xs">Perfect fit</p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 5: Moves - CAPTURE */}
        <section 
          data-slide="4"
          ref={(el) => { sectionRefs.current[4] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              {/* Left - Content */}
              <div className="lg:w-1/2 text-left animate-fade-in-up">
                <div className="flex items-center gap-3 mb-4">
                  <div className="px-3 py-1 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/50">
                    <span className="text-[#E0FE10] text-xs font-bold uppercase tracking-widest">Feature</span>
                  </div>
                </div>
                
                <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white`}>
                  <span className="text-[#E0FE10]">Moves</span>
                </h2>
                
                <p className="text-zinc-400 text-xs uppercase tracking-widest mb-4">CAPTURE</p>
                
                <p className="text-white text-xl md:text-2xl leading-relaxed mb-6">
                  Single <span className="text-[#E0FE10] font-semibold">bite-sized movement videos</span> that creators can capture and share.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-1" />
                    <p className="text-zinc-300">Quick to create, easy to consume</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-1" />
                    <p className="text-zinc-300">Build a library of signature exercises</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-1" />
                    <p className="text-zinc-300">Combine into complete workouts</p>
                  </div>
                </div>
              </div>
              
              {/* Right - Mockup */}
              <div className="lg:w-1/2 animate-fade-in-up animation-delay-300">
                <div className="relative flex justify-center">
                  <img 
                    src="/invest-moves.png" 
                    alt="Pulse Moves Feature" 
                    className={`w-auto rounded-[32px] border-2 border-[#E0FE10]/40 shadow-2xl ${isMobile ? 'h-[400px]' : 'h-[500px] md:h-[600px]'} object-contain`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/wunna-pulse-profile.png';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 6: Rounds - COMPETE */}
        <section 
          data-slide="5"
          ref={(el) => { sectionRefs.current[5] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-12">
              {/* Right - Content */}
              <div className="lg:w-1/2 text-left animate-fade-in-up">
                <div className="flex items-center gap-3 mb-4">
                  <div className="px-3 py-1 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/50">
                    <span className="text-[#8B5CF6] text-xs font-bold uppercase tracking-widest">Core Feature</span>
                  </div>
                </div>
                
                <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white`}>
                  <span className="text-[#8B5CF6]">Rounds</span>
                </h2>
                
                <p className="text-zinc-400 text-xs uppercase tracking-widest mb-4">COMPETE</p>
                
                <p className="text-white text-xl md:text-2xl leading-relaxed mb-6">
                  Module where <span className="text-[#8B5CF6] font-semibold">multiple members</span> of your community can compete.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Trophy className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-1" />
                    <p className="text-zinc-300">Leaderboards drive engagement</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-1" />
                    <p className="text-zinc-300">Community accountability</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-1" />
                    <p className="text-zinc-300">Primary revenue driver for creators</p>
                  </div>
                </div>
              </div>
              
              {/* Left - Mockup */}
              <div className="lg:w-1/2 animate-fade-in-up animation-delay-300">
                <div className="relative flex justify-center">
                  <img 
                    src="/invest-rounds.png" 
                    alt="Pulse Rounds Feature" 
                    className={`w-auto rounded-[32px] border-2 border-[#8B5CF6]/40 shadow-2xl ${isMobile ? 'h-[400px]' : 'h-[500px] md:h-[600px]'} object-contain`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/wunna-pulse-club.png';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 7: Creators are Discoverable - PULSE AI */}
        <section 
          data-slide="6"
          ref={(el) => { sectionRefs.current[6] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-4 text-white animate-fade-in-up`}>
              Creators are <span className="text-[#E0FE10]">discoverable</span> by seekers
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl mb-12 animate-fade-in-up animation-delay-150">
              Powered by intelligent matching
            </p>
            
            <GlassCard className="max-w-2xl mx-auto mb-10 animate-fade-in-up animation-delay-300">
              <div className="p-8">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <h3 className="text-[#E0FE10] text-2xl font-bold">PULSE AI</h3>
                </div>
                <p className="text-white text-lg md:text-xl leading-relaxed">
                  AI matches fitness seekers with <span className="text-[#E0FE10] font-semibold">perfect creators</span> for their goals, style, and preferences.
                </p>
              </div>
            </GlassCard>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up animation-delay-450">
              <div className="bg-zinc-950/50 p-6 rounded-xl border border-zinc-800">
                <Target className="w-10 h-10 text-[#E0FE10] mx-auto mb-4" />
                <p className="text-white font-bold mb-2">Goal-Based Matching</p>
                <p className="text-zinc-400 text-sm">Weight loss, muscle gain, flexibility, endurance</p>
              </div>
              <div className="bg-zinc-950/50 p-6 rounded-xl border border-zinc-800">
                <Heart className="w-10 h-10 text-[#E0FE10] mx-auto mb-4" />
                <p className="text-white font-bold mb-2">Style Preferences</p>
                <p className="text-zinc-400 text-sm">HIIT, yoga, strength, dance, running</p>
              </div>
              <div className="bg-zinc-950/50 p-6 rounded-xl border border-zinc-800">
                <Users className="w-10 h-10 text-[#E0FE10] mx-auto mb-4" />
                <p className="text-white font-bold mb-2">Community Fit</p>
                <p className="text-zinc-400 text-sm">Personality, motivation style, schedule</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 8: People Connect with Real People */}
        <section 
          data-slide="7"
          ref={(el) => { sectionRefs.current[7] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-4 text-white animate-fade-in-up`}>
              People <span className="text-[#E0FE10]">connect</span> with <span className="text-[#E0FE10]">real people</span>.
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl mb-12 animate-fade-in-up animation-delay-150">
              Creators bring their existing audience to Pulse
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mb-10 animate-fade-in-up animation-delay-300">
              {/* Social platforms */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white text-2xl">📷</span>
                </div>
                <p className="text-zinc-400 text-sm">Instagram</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center border border-zinc-700">
                  <span className="text-white text-2xl">🎵</span>
                </div>
                <p className="text-zinc-400 text-sm">TikTok</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center">
                  <span className="text-white text-2xl">▶️</span>
                </div>
                <p className="text-zinc-400 text-sm">YouTube</p>
              </div>
              
              <div className="text-zinc-500 text-4xl">→</div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-2xl bg-[#E0FE10]/20 border-2 border-[#E0FE10] flex items-center justify-center">
                  <img src="/PulseGreen.png" alt="Pulse" className="h-10 w-auto" />
                </div>
                <p className="text-[#E0FE10] text-sm font-bold">Pulse</p>
              </div>
            </div>
            
            <GlassCard className="max-w-xl mx-auto animate-fade-in-up animation-delay-450">
              <div className="p-6">
                <p className="text-white text-lg">
                  Creators <span className="text-[#E0FE10] font-semibold">own the relationship</span> with their community on Pulse — not rented from an algorithm.
                </p>
              </div>
            </GlassCard>
          </div>
        </section>
        
        {/* Slide 9: We Invest in the Creators */}
        <section 
          data-slide="8"
          ref={(el) => { sectionRefs.current[8] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-4 text-white animate-fade-in-up`}>
              We <span className="text-[#E0FE10]">invest</span> in the <span className="text-[#E0FE10]">creators</span>
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl mb-12 animate-fade-in-up animation-delay-150">
              Pulse helps creators build sustainable businesses
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto animate-fade-in-up animation-delay-300">
              <GlassCard>
                <div className="p-6 text-left">
                  <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-4">
                    <Briefcase className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3">Business Support</h3>
                  <p className="text-zinc-400">Tools for pricing, scheduling, and managing their fitness business</p>
                </div>
              </GlassCard>
              
              <GlassCard>
                <div className="p-6 text-left">
                  <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3">Growth Resources</h3>
                  <p className="text-zinc-400">Marketing support, analytics, and community building guidance</p>
                </div>
              </GlassCard>
              
              <GlassCard>
                <div className="p-6 text-left">
                  <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-4">
                    <Building2 className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3">Brand Partnerships</h3>
                  <p className="text-zinc-400">Connect creators with sponsorship opportunities</p>
                </div>
              </GlassCard>
              
              <GlassCard>
                <div className="p-6 text-left">
                  <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mb-4">
                    <Award className="w-6 h-6 text-[#E0FE10]" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3">Creator Success</h3>
                  <p className="text-zinc-400">Dedicated team to help creators maximize their potential</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>
        
        {/* Slide 10: Creators Bring Their Community */}
        <section 
          data-slide="9"
          ref={(el) => { sectionRefs.current[9] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-4 text-white animate-fade-in-up`}>
              Creators <span className="text-[#E0FE10]">bring their community</span>
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl mb-12 animate-fade-in-up animation-delay-150">
              Creator-led growth model
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 animate-fade-in-up animation-delay-300">
              {/* Creator */}
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#E0FE10]/30 to-[#E0FE10]/10 border-4 border-[#E0FE10] flex items-center justify-center mx-auto mb-4">
                  <Users className="w-16 h-16 text-[#E0FE10]" />
                </div>
                <p className="text-[#E0FE10] font-bold text-xl">Fitness Creators</p>
                <p className="text-zinc-400 text-sm">Build and monetize</p>
              </div>
              
              {/* Arrow */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-1 bg-gradient-to-r from-[#E0FE10] to-[#8B5CF6] rounded-full md:w-1 md:h-24 md:bg-gradient-to-b"></div>
                <p className="text-zinc-500 text-sm">brings</p>
              </div>
              
              {/* Seekers */}
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#8B5CF6]/30 to-[#8B5CF6]/10 border-4 border-[#8B5CF6] flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-16 h-16 text-[#8B5CF6]" />
                </div>
                <p className="text-[#8B5CF6] font-bold text-xl">Fitness Seekers</p>
                <p className="text-zinc-400 text-sm">Join and engage</p>
              </div>
            </div>
            
            <div className="mt-12 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 max-w-2xl mx-auto animate-fade-in-up animation-delay-450">
              <p className="text-white text-lg">
                <span className="text-[#E0FE10] font-bold">Result:</span> Lower CAC through organic creator-driven acquisition
              </p>
            </div>
          </div>
        </section>
        
        {/* Slide 11: Pricing */}
        <section 
          data-slide="10"
          ref={(el) => { sectionRefs.current[10] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-12 text-white animate-fade-in-up`}>
              <span className="text-[#E0FE10]">Pricing</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Creators */}
              <GlassCard className="animate-fade-in-up animation-delay-150">
                <div className="p-8">
                  <div className="w-16 h-16 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mx-auto mb-6">
                    <Users className="w-8 h-8 text-[#E0FE10]" />
                  </div>
                  <h3 className="text-[#E0FE10] font-bold text-xl mb-2">Fitness Creators</h3>
                  <div className="mb-6">
                    <span className="text-white text-4xl font-bold">$19.99</span>
                    <span className="text-zinc-400">/year</span>
                  </div>
                  <ul className="text-left space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300 text-sm">Unlimited Moves</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300 text-sm">Host Rounds</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300 text-sm">Community Management</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300 text-sm">Analytics Dashboard</span>
                    </li>
                  </ul>
                </div>
              </GlassCard>
              
              {/* Seekers */}
              <GlassCard accentColor={pulsePurple} className="animate-fade-in-up animation-delay-300">
                <div className="p-8">
                  <div className="w-16 h-16 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center mx-auto mb-6">
                    <UserPlus className="w-8 h-8 text-[#8B5CF6]" />
                  </div>
                  <h3 className="text-[#8B5CF6] font-bold text-xl mb-2">Fitness Seekers</h3>
                  <div className="mb-6">
                    <span className="text-white text-4xl font-bold">$9.99</span>
                    <span className="text-zinc-400">/month</span>
                    <p className="text-zinc-500 text-sm mt-1">or $79.99/year</p>
                  </div>
                  <ul className="text-left space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300 text-sm">Access all creators</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300 text-sm">Join unlimited Rounds</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300 text-sm">Progress tracking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
                      <span className="text-zinc-300 text-sm">Community access</span>
                    </li>
                  </ul>
                </div>
              </GlassCard>
            </div>
            
            <div className="mt-8 animate-fade-in-up animation-delay-450">
              <p className="text-zinc-400">
                <span className="text-[#E0FE10] font-semibold">Coming soon:</span> Creator subscriptions with custom pricing
              </p>
            </div>
          </div>
        </section>
        
        {/* Slide 12: Results / Traction */}
        <section 
          data-slide="11"
          ref={(el) => { sectionRefs.current[11] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-12 text-white animate-fade-in-up`}>
              <span className="text-[#E0FE10]">Results</span>
            </h2>
            
            <div className="mb-12 animate-fade-in-up animation-delay-150">
              <div className="inline-flex items-center gap-4 bg-[#E0FE10]/10 border-2 border-[#E0FE10]/50 rounded-2xl px-8 py-6">
                <DollarSign className="w-12 h-12 text-[#E0FE10]" />
                <div className="text-left">
                  <p className="text-[#E0FE10] text-5xl md:text-6xl font-bold">$10k</p>
                  <p className="text-zinc-400">Revenue</p>
                </div>
              </div>
            </div>
            
            <div className="mb-8 animate-fade-in-up animation-delay-300">
              <p className="text-zinc-400 text-sm uppercase tracking-widest mb-6">Brand Partnerships</p>
              <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
                {['Skadoo', 'solidcore', 'bookkeepers.com'].map((brand, index) => (
                  <div key={index} className="bg-zinc-900/50 px-6 py-3 rounded-xl border border-zinc-800">
                    <p className="text-white font-medium">{brand}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <GlassCard className="max-w-xl mx-auto animate-fade-in-up animation-delay-450">
              <div className="p-6">
                <p className="text-white text-lg">
                  Early traction validates the model. Now it's time to <span className="text-[#E0FE10] font-semibold">scale</span>.
                </p>
              </div>
            </GlassCard>
          </div>
        </section>
        
        {/* Slide 13: Our Take - Business Model */}
        <section 
          data-slide="12"
          ref={(el) => { sectionRefs.current[12] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-4 text-white animate-fade-in-up`}>
              Our <span className="text-[#E0FE10]">Take</span>
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl mb-12 animate-fade-in-up animation-delay-150">
              How we make money
            </p>
            
            <div className="max-w-3xl mx-auto animate-fade-in-up animation-delay-300">
              {/* Formula visualization */}
              <div className="bg-black/50 rounded-2xl p-8 border border-zinc-800 mb-8">
                <div className="flex flex-wrap items-center justify-center gap-4 text-2xl md:text-3xl">
                  <div className="bg-[#E0FE10]/20 px-4 py-2 rounded-lg">
                    <span className="text-[#E0FE10] font-bold">$80</span>
                  </div>
                  <span className="text-zinc-500">+</span>
                  <div className="bg-[#8B5CF6]/20 px-4 py-2 rounded-lg">
                    <span className="text-[#8B5CF6] font-bold">$40</span>
                  </div>
                  <span className="text-zinc-500">×</span>
                  <div className="bg-zinc-800 px-4 py-2 rounded-lg">
                    <span className="text-white font-bold">50</span>
                  </div>
                  <span className="text-zinc-500">=</span>
                  <div className="bg-[#E0FE10] px-6 py-2 rounded-lg">
                    <span className="text-black font-bold">$2,080</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-sm text-zinc-400">
                  <span>Seeker Sub</span>
                  <span className="text-zinc-600">+</span>
                  <span>Platform Fee</span>
                  <span className="text-zinc-600">×</span>
                  <span>Seekers/Round</span>
                  <span className="text-zinc-600">=</span>
                  <span className="text-[#E0FE10]">Per Round</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GlassCard>
                  <div className="p-6">
                    <p className="text-[#E0FE10] text-3xl font-bold mb-2">20%</p>
                    <p className="text-zinc-400">Platform take on Round revenue</p>
                  </div>
                </GlassCard>
                <GlassCard>
                  <div className="p-6">
                    <p className="text-[#8B5CF6] text-3xl font-bold mb-2">80%</p>
                    <p className="text-zinc-400">Goes directly to creators</p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 14: Creator Activity Target */}
        <section 
          data-slide="13"
          ref={(el) => { sectionRefs.current[13] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4 animate-fade-in-up">Creator Activity Target</p>
            <h2 className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} font-bold mb-12 text-white animate-fade-in-up animation-delay-150`}>
              We encourage fitness creators to host at least <span className="text-[#E0FE10]">2 Standard Rounds</span> per year
            </h2>
            
            <div className="max-w-2xl mx-auto animate-fade-in-up animation-delay-300">
              <div className="bg-black/50 rounded-2xl p-8 border border-[#E0FE10]/30 mb-8">
                <div className="flex flex-wrap items-center justify-center gap-4 text-2xl md:text-3xl">
                  <div className="text-center">
                    <span className="text-[#E0FE10] font-bold text-4xl">2</span>
                    <p className="text-zinc-400 text-sm">Rounds</p>
                  </div>
                  <span className="text-zinc-500">×</span>
                  <div className="text-center">
                    <span className="text-white font-bold text-4xl">$2,000</span>
                    <p className="text-zinc-400 text-sm">each</p>
                  </div>
                  <span className="text-zinc-500">=</span>
                  <div className="text-center">
                    <span className="text-[#E0FE10] font-bold text-5xl">$4,080</span>
                    <p className="text-zinc-400 text-sm">per creator/year</p>
                  </div>
                </div>
              </div>
              
              <GlassCard>
                <div className="p-6">
                  <p className="text-white text-lg">
                    Conservative estimate based on <span className="text-[#E0FE10] font-semibold">minimum activity</span>. 
                    Active creators can earn significantly more.
                  </p>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>
        
        {/* Slide 15: Beachhead Market */}
        <section 
          data-slide="14"
          ref={(el) => { sectionRefs.current[14] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-12 text-white animate-fade-in-up`}>
              <span className="text-[#E0FE10]">Beachhead</span> Market
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto animate-fade-in-up animation-delay-300">
              <GlassCard>
                <div className="p-8">
                  <p className="text-[#E0FE10] text-5xl md:text-6xl font-bold mb-2">350K</p>
                  <p className="text-zinc-400">Fitness Creators</p>
                  <p className="text-zinc-500 text-sm mt-2">US Market</p>
                </div>
              </GlassCard>
              
              <GlassCard>
                <div className="p-8">
                  <p className="text-[#E0FE10] text-5xl md:text-6xl font-bold mb-2">$4,080</p>
                  <p className="text-zinc-400">Annual Revenue</p>
                  <p className="text-zinc-500 text-sm mt-2">Per Creator</p>
                </div>
              </GlassCard>
              
              <GlassCard>
                <div className="p-8">
                  <p className="text-[#E0FE10] text-5xl md:text-6xl font-bold mb-2">$1.4B</p>
                  <p className="text-zinc-400">Market Opportunity</p>
                  <p className="text-zinc-500 text-sm mt-2">Beachhead</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>
        
        {/* Slide 16: Path to $100M */}
        <section 
          data-slide="15"
          ref={(el) => { sectionRefs.current[15] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-4 text-white animate-fade-in-up`}>
              Path to <span className="text-[#E0FE10]">$100M</span>
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl mb-12 animate-fade-in-up animation-delay-150">
              25,000 Creators = $100M ARR
            </p>
            
            <div className="relative max-w-4xl mx-auto animate-fade-in-up animation-delay-300">
              {/* Milestone timeline */}
              <div className="flex items-end justify-between gap-4 h-64 mb-8">
                <div className="flex-1 flex flex-col items-center">
                  <div className="bg-[#E0FE10]/20 rounded-t-lg w-full" style={{ height: '15%' }}></div>
                  <div className="bg-zinc-800 p-3 rounded-lg mt-4 w-full">
                    <p className="text-[#E0FE10] font-bold">$1M</p>
                    <p className="text-zinc-500 text-xs">250 creators</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="bg-[#E0FE10]/40 rounded-t-lg w-full" style={{ height: '35%' }}></div>
                  <div className="bg-zinc-800 p-3 rounded-lg mt-4 w-full">
                    <p className="text-[#E0FE10] font-bold">$10M</p>
                    <p className="text-zinc-500 text-xs">2,500 creators</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="bg-[#E0FE10]/60 rounded-t-lg w-full" style={{ height: '60%' }}></div>
                  <div className="bg-zinc-800 p-3 rounded-lg mt-4 w-full">
                    <p className="text-[#E0FE10] font-bold">$50M</p>
                    <p className="text-zinc-500 text-xs">12,500 creators</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="bg-[#E0FE10] rounded-t-lg w-full" style={{ height: '100%' }}></div>
                  <div className="bg-[#E0FE10]/20 border border-[#E0FE10] p-3 rounded-lg mt-4 w-full">
                    <p className="text-[#E0FE10] font-bold">$100M</p>
                    <p className="text-zinc-400 text-xs">25,000 creators</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 17: Partnerships */}
        <section 
          data-slide="16"
          ref={(el) => { sectionRefs.current[16] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4 animate-fade-in-up">Partnerships</p>
            <h2 className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} font-bold mb-12 text-white animate-fade-in-up animation-delay-150`}>
              We focused on building <span className="text-[#E0FE10]">partnerships</span> with brands that <span className="text-[#E0FE10]">align</span> with our mission.
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto animate-fade-in-up animation-delay-300">
              <GlassCard>
                <div className="p-6">
                  <p className="text-zinc-400 text-xs uppercase tracking-widest mb-4">Brands we've worked with</p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {['Skadoo', 'solidcore'].map((brand, index) => (
                      <div key={index} className="bg-zinc-950 px-4 py-2 rounded-lg border border-[#E0FE10]/30">
                        <p className="text-white font-medium">{brand}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
              
              <GlassCard accentColor={pulsePurple}>
                <div className="p-6">
                  <p className="text-zinc-400 text-xs uppercase tracking-widest mb-4">Brands we'd love to work with</p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {['L\'Oréal', 'lululemon', 'alo', 'wellhub'].map((brand, index) => (
                      <div key={index} className="bg-zinc-950 px-4 py-2 rounded-lg border border-[#8B5CF6]/30">
                        <p className="text-white font-medium">{brand}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>
        
        {/* Slide 18: Who's Building Pulse? (Team) - same as WunnaRun */}
        <section 
          data-slide="17"
          ref={(el) => { sectionRefs.current[17] = el as HTMLDivElement; }}
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
              
              {/* Partners */}
              <div className="flex items-center gap-4 mt-10 mb-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-600 to-transparent"></div>
                <span className="text-zinc-400 text-sm uppercase tracking-wider font-medium">Partners</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-600 to-transparent"></div>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
                <div className="flex items-center justify-center h-10 md:h-12 grayscale opacity-80 hover:opacity-100 hover:grayscale-0 transition-all">
                  <img src="/cooley-logo.png" alt="Cooley" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center h-10 md:h-12 grayscale opacity-80 hover:opacity-100 hover:grayscale-0 transition-all">
                  <img src="/awsstartups.png" alt="AWS Startups" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center h-10 md:h-12 grayscale opacity-80 hover:opacity-100 hover:grayscale-0 transition-all">
                  <img src="/techstars.png" alt="Techstars" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex items-center justify-center h-10 md:h-12 grayscale opacity-80 hover:opacity-100 hover:grayscale-0 transition-all">
                  <img src="/Launch.png" alt="Launch" className="h-8 md:h-10 w-auto object-contain" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Left - fitwithpulse.ai */}
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 19: The Ask - $1M */}
        <section 
          data-slide="18"
          ref={(el) => { sectionRefs.current[18] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-900')}
        >
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-4 text-white animate-fade-in-up`}>
              <span className="text-[#E0FE10]">$1M</span> to turn creator acquisition into a machine
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-12">
              {/* Use of Funds */}
              <GlassCard className="animate-fade-in-up animation-delay-150">
                <div className="p-6 text-left">
                  <p className="text-zinc-400 text-xs uppercase tracking-widest mb-4">Use of Funds</p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-4 h-4 text-[#E0FE10]" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Product Team</p>
                        <p className="text-zinc-500 text-sm">Engineers & designers</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-[#E0FE10]" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Creator Success Team</p>
                        <p className="text-zinc-500 text-sm">Onboarding & support</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-[#E0FE10]" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Marketing</p>
                        <p className="text-zinc-500 text-sm">Brand & acquisition</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-[#E0FE10]" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Paid Partnerships</p>
                        <p className="text-zinc-500 text-sm">Strategic brand deals</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </GlassCard>
              
              {/* Outcome */}
              <GlassCard accentColor={pulseGreen} className="animate-fade-in-up animation-delay-300">
                <div className="p-6 flex flex-col items-center justify-center h-full">
                  <Rocket className="w-16 h-16 text-[#E0FE10] mb-6" />
                  <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2">Outcome</p>
                  <p className="text-[#E0FE10] text-5xl font-bold mb-2">25,000</p>
                  <p className="text-white text-xl">creators</p>
                  <div className="mt-4 bg-black/30 px-4 py-2 rounded-lg">
                    <p className="text-zinc-400 text-sm">= <span className="text-[#E0FE10] font-bold">$100M</span> ARR potential</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>
        
        {/* Slide 20: CTA - Let's Build */}
        <section 
          data-slide="19"
          ref={(el) => { sectionRefs.current[19] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900"></div>
          
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <div className="animate-fade-in-up">
              <img src="/PulseGreen.png" alt="Pulse" className="h-16 md:h-20 w-auto mx-auto mb-8" />
              
              <h2 className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} font-medium mb-8 text-white leading-relaxed`}>
                Whether you're <span className="text-[#E0FE10]">learning</span>, <span className="text-[#E0FE10]">earning</span>, <span className="text-[#E0FE10]">teaching</span>, or just <span className="text-[#E0FE10]">having fun</span>—there's a place for you on Pulse.
              </h2>
              
              <GlassCard className="max-w-md mx-auto mb-12">
                <div className="p-8">
                  <h3 className="text-white font-bold text-xl mb-4">Let's talk.</h3>
                  
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
              
              <p className="text-[#E0FE10] font-bold text-xl animate-fade-in-up animation-delay-600">
                Let's build the future of fitness together.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Pitch; 

export const getServerSideProps: GetServerSideProps<PitchProps> = async (_context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('pitch');
  } catch (error) {
    console.error("Error fetching page meta data for pitch page:", error);
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
