import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, Users, Trophy, MessageCircle, BarChart3, BarChart2, Smartphone, Bell, MapPin, Globe, Zap, CheckCircle, Calendar, Phone, Mail, Download, Copy, Layers, Building2, Wrench, Dumbbell, Footprints, PersonStanding, X } from 'lucide-react';
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

interface WunnaRunProps {
  metaData: SerializablePageMetaData | null;
}

const WUNNA_PASSCODE = 'WUNNA';
const ONEUP_PASSCODE = 'ONEUP';
const WUNNA_UNLOCK_KEY = 'wunna-run-unlocked';
const WUNNA_PASSCODE_USED_KEY = 'wunna-run-passcode-used'; // 'WUNNA' | 'ONEUP' — ONEUP shows analytics

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
  const [copied, setCopied] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsVisitors, setAnalyticsVisitors] = useState<Array<{ ip: string; location: string; count: number; lastSeen: string; firstSeen: string; visitorId: string | null }>>([]);
  const [analyticsDetailIp, setAnalyticsDetailIp] = useState<string | null>(null);
  const [analyticsLogs, setAnalyticsLogs] = useState<Array<{ id: string; timestamp: string; location: string | null; userAgent: string | null; visitorId: string | null }>>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const totalSections = 22;
  const sectionRefs = useRef<(HTMLDivElement | null)[]>(Array(totalSections).fill(null));

  const [passcodeUsed, setPasscodeUsed] = useState<'WUNNA' | 'ONEUP' | null>(null);
  const showAnalyticsButton = passcodeUsed === 'ONEUP';
  
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
  
  // Check sessionStorage for existing passcode unlock and which passcode was used (client-side only)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const unlocked = sessionStorage.getItem(WUNNA_UNLOCK_KEY) === 'true';
      const used = sessionStorage.getItem(WUNNA_PASSCODE_USED_KEY) as 'WUNNA' | 'ONEUP' | null;
      setIsUnlocked(!!unlocked);
      if (unlocked && (used === 'WUNNA' || used === 'ONEUP')) setPasscodeUsed(used);
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
        sessionStorage.setItem(WUNNA_PASSCODE_USED_KEY, 'WUNNA');
      } catch {
        // ignore
      }
      setPasscodeUsed('WUNNA');
      setIsUnlocked(true);
      setPasscodeInput('');
    } else if (trimmed === ONEUP_PASSCODE) {
      try {
        sessionStorage.setItem(WUNNA_UNLOCK_KEY, 'true');
        sessionStorage.setItem(WUNNA_PASSCODE_USED_KEY, 'ONEUP');
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

  // Record page view (IP / location / stable visitor ID) for analytics
  useEffect(() => {
    const visitorId = (() => {
      try {
        const key = 'wunna-run-visitor-id';
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
    fetch('/api/wunna-run/record-view', {
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

  const getPresentationAsText = () => {
    const lines = [
      '——— SLIDE 1: TITLE ———',
      'WUNNA RUN x PULSE',
      'Year-Round Community Infrastructure for the World\'s Fastest-Growing Run Club',
      'fitwithpulse.ai',
      '',
      '——— SLIDE 2: THE OPPORTUNITY ———',
      'We\'re offering Wunna Run more than a software vendor relationship.',
      '1. Partnership — Wunna Run adopts Pulse as official community platform. Gunna receives equity in Pulse — aligned incentives.',
      '2. Investment — Gunna invests in Pulse\'s pre-seed round via SAFE alongside institutional partners — ownership in the infrastructure powering the run club movement.',
      '3. Both — Combined partnership and investment for maximum alignment and ownership — a true stake in the platform\'s success, not just a logo on a banner.',
      'Details in the attached Investment Brief.',
      '',
      '——— SLIDE 3: WHAT GUNNA GETS ———',
      '• Meaningful equity ownership in Pulse',
      '• Input on product direction — especially run club and community features',
      '• Technology infrastructure to scale Wunna Run globally without losing intimacy',
      '• Rich data on his community for merch drops, pre-sales, VIP experiences, and sponsor activations',
      '• Year-round engagement platform that keeps runners connected between events',
      '• Philanthropic impact tracking — see how participation translates to community giveback',
      '• A partner aligned with his mission of health, wellness, community, and philanthropy',
      '',
      '——— SLIDE 4: THE MISSION BEHIND THE MOVEMENT ———',
      'Wunna Run started with a personal transformation.',
      '',
      'Gunna faced his own nutritional and health challenges. Through fitness, he found peace, accountability, and a sense of purpose. Running a marathon — and raising money for his community during it — became the spark for something bigger.',
      '',
      'Today, Wunna Run is a global movement rooted in four pillars:',
      '• Health — Inspiring people to move, no matter where they start',
      '• Wellness — Finding peace and balance through fitness',
      '• Community — Real connections between Gunna and his fans',
      '• Philanthropy — Giving back through Gunna\'s Great Giveaway',
      '',
      'Gunna invests over $3 million annually in the City of South Fulton — one of the most underserved communities in Georgia — because he believes health and economic opportunity go hand in hand.',
      '',
      'Pulse is built to support all four pillars — not just the runs, but the mission behind them.',
      '',
      '——— SLIDE 5: WUNNA RUN RECAP + NEXT ———',
      '2025 proved the demand. 2026 turns it into a global movement.',
      '',
      'THE ORIGIN',
      'Gunna\'s own health journey — overcoming nutritional challenges, finding peace through fitness, and transforming his life — inspired him to run a marathon and raise money for his community. That moment became Wunna Run: a movement to inspire others to be their best selves and run with purpose.',
      '',
      '2025 — WHAT WUNNA RUN DID',
      '• 8 cities • 2,000+ runners per event • 20+ races worldwide',
      '• Partners: Strava, Under Armour, House of Athlete, Symbiotica, Flourish, Path Water',
      '• Proceeds supporting Gunna\'s Great Giveaway — investing in the City of South Fulton and communities that need it most',
      '',
      '2026 — GLOBAL EXPANSION',
      '• Paris + London launch moments',
      '• City-to-city continuity (points carry over)',
      '• One global series experience',
      '• Deeper philanthropic integration',
      '',
      'PROPOSAL',
      'Technology installation — build on top of Pulse. Infrastructure for check-ins, run tracking, challenges, points, leaderboards, owned data, and philanthropic impact tracking across the entire series.',
      'Result: A global series, year-round — with purpose.',
      '',
      '——— SLIDE 6: THE RUNNERS ———',
      'The Problem:',
      '1. Runners, fans, and community who physically showed up to Wunna Run had an incredible experience — but cannot take part again until the next in-person run.',
      '2. Runners, fans, and community who cannot attend due to travel or not living in a major city still want to participate and contribute to the run community.',
      '',
      'What they want:',
      '• Stay connected • Track progress • Earn recognition • Feel part of something bigger • Run with purpose',
      '',
      '——— SLIDE 7: THE SOLUTION: INTRODUCING PULSE — RUNS WITH GUNNA ———',
      'Pulse is a community-first fitness platform that helps brands, athletes, and community leaders build deeper connection through digital group training. Backed by the same investors behind Uber, Calm, and Robinhood. This is your personalized operating system for your fitness community.',
      '',
      '——— SLIDE 8: THE RUNNER EXPERIENCE ———',
      'Join → Download Pulse, join the Wunna Run community. Check-in → Scan at the run, earn points. Earn → Climb the leaderboard, unlock rewards. Stay connected → Engage between events. Come back → Show up to the next run, keep the streak alive.',
      '',
      '——— SLIDE 9: HOW IT WORKS — COMMUNITY ———',
      'Run tracking & challenges build stronger community. Every run compounds — a connected journey. Track runs between events, community challenges, streaks/milestones, two-way communication (Gunna can message runners directly).',
      '',
      '——— SLIDES 10–12: HOW IT WORKS — CHECK-INS (3 parts) ———',
      'Check-Ins Part 1: When participants arrive at the physical location, the QR code appears on their phone to be scanned by the host — or they scan a QR at the venue.',
      'Check-Ins Part 2: Points and badges for scanning QR at the physical location. Collect badges across cities for additional points. Runs become a connected experience from city to city.',
      'Check-Ins Part 3: How it works: We use check-ins to expand reach and make Gunna Runs accessible to everyone everywhere. The map shows physical check-ins and virtual runners. People can join virtually from any city and run from anywhere — unlocking scale that wasn\'t possible before.',
      '',
      '——— SLIDE 13: GAMIFICATION ———',
      'Points as incentives. Each run compounds and leads to the next — a connected experience. Invites: earn points when friends join. Social: points encourage interaction. Loyalty: streaks, badges, city-to-city continuity. Gamification turns participation into belonging.',
      '',
      '——— SLIDE 14: BETWEEN EVENTS ———',
      'Year-round engagement: challenges, streaks, communication, data that powers the next run. The community doesn\'t stop when the run ends.',
      '',
      '——— SLIDE 15: HOW IT WORKS — DATA ———',
      'Wearable data collection — runs, activity, and engagement sync from Apple Watch, Garmin, Strava, and more. Rich member profiles for deeper fan experiences. Own the relationship, see who\'s most engaged, segment for merch/VIP, inform partnerships and sponsorships.',
      'Good addition with wearables (Apple Watch, Garmin, Strava sync). Shows you complement, not compete.',
      '',
      '——— SLIDE 16: THE SERIES (NASCAR/PGA STYLE) ———',
      'One global series with points, standings, and continuity across cities.',
      '',
      '——— SLIDE 17: WUNNA RUN TEAM EXPERIENCE ———',
      'For the Wunna Run Team: Metrics by city, community management, one platform for events, check-ins, merch drops, challenges, and fan experiences.',
      '',
      '——— SLIDE 18: SCALE ———',
      'Technology infrastructure to scale Wunna Run globally.',
      '',
      '——— SLIDE 19: WHO\'S BUILDING PULSE? ———',
      'Core Team: Tremaine Grant (CEO & Founder), Bobby Nweke (Chief of Staff), Lola Oluwaladun (Design Lead).',
      'Advisors: Marques Zak (CMO @ ACC), Valerie Alexander (Fortune 500 Consultant), DeRay Mckesson (Campaign Zero), Erik Edwards (Partner @ Cooley).',
      'Partners: Cooley, AWS Startups, Techstars, Launch.',
      '',
      '——— SLIDE 20: TIMELINE ———',
      'March 20 — Paris (potential soft launch)',
      'March 31 — London (potential launch)',
      'Q2 2026 — Full series rollout',
      '',
      '——— SLIDE 21: NEXT STEPS ———',
      'Follow-up and next steps.',
      '',
      '——— SLIDE 22: LET\'S BUILD ———',
      'Let\'s build. fitwithpulse.ai',
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
      // Fallback for older browsers or non-HTTPS
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
      return { 'X-Wunna-Run-Passcode': 'ONEUP' };
    }
    return {};
  };

  const fetchAnalyticsList = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const headers = await getAnalyticsHeaders();
      const res = await fetch('/api/wunna-run/analytics', { headers });
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
      const res = await fetch(`/api/wunna-run/analytics?ip=${encodeURIComponent(ip)}`, { headers });
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
              {isMobile ? 'Download' : 'Download Presentation'}
            </>
          )}
        </button>
        <div className="bg-[#E0FE10] text-black px-4 py-2 rounded-full font-bold text-sm shadow-lg">
          {activeSection + 1}/{totalSections}
        </div>
      </div>

      {/* Analytics Modal (admin only) */}
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
                <h2 id="analytics-modal-title" className="text-lg font-bold text-white">Wunna Run Analytics</h2>
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
      
      {/* Main content - full-screen slides on mobile with snap scroll */}
      <main
        id="main-content"
        className={isMobile ? "snap-y snap-mandatory h-screen overflow-y-auto overflow-x-hidden overscroll-y-none" : "snap-y snap-mandatory h-screen overflow-y-scroll"}
        style={isMobile ? { WebkitOverflowScrolling: 'touch' } : undefined}
      >
        
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
            {/* WUNNA RUN x Pulse — same line */}
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5 mb-8 animate-fade-in-up">
              <h1 className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl lg:text-8xl'} font-bold text-white tracking-tight`}>
                WUNNA RUN <span className="text-zinc-400">x</span>
              </h1>
              <img 
                src="/PulseGreen.png" 
                alt="Pulse" 
                className={`${isMobile ? 'h-12 md:h-16' : 'h-16 md:h-24 lg:h-28'} w-auto`}
              />
            </div>
            
            {/* Subtitle — wide container on large screens so tagline stays on one line */}
            <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-zinc-300 animate-fade-in-up animation-delay-600 max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto text-center`}>
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
        
        {/* Slide 2: The Opportunity (moved up) */}
        <section 
          data-slide="1"
          ref={(el) => { sectionRefs.current[1] = el as HTMLDivElement; }}
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
                    Wunna Run adopts Pulse as official community platform. <span className="text-[#E0FE10] font-bold">Gunna receives equity in Pulse</span> — aligned incentives.
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
                    Gunna invests in Pulse&apos;s pre-seed round via <span className="text-[#8B5CF6] font-bold">SAFE</span> alongside institutional partners — ownership in the infrastructure powering the run club movement.
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
                    Combined partnership and investment for maximum alignment and ownership — a true stake in the platform&apos;s success, not just a logo on a banner.
                  </p>
                </div>
              </GlassCard>
            </div>
            
            <div className="bg-zinc-950 p-4 rounded-xl border border-[#E0FE10]/30 text-center animate-fade-in-up animation-delay-600">
              <p className="text-zinc-400">Details in the attached <span className="text-[#E0FE10] font-bold">Investment Brief</span></p>
            </div>
          </div>
        </section>
        
        {/* Slide 2: What Gunna Gets */}
        <section 
          data-slide="2"
          ref={(el) => { sectionRefs.current[2] = el as HTMLDivElement; }}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 animate-fade-in-up animation-delay-300">
              <div className="flex items-start gap-4 bg-gradient-to-r from-[#E0FE10]/20 to-zinc-900/50 p-5 rounded-xl border-2 border-[#E0FE10]/50 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-black" />
                </div>
                <p className="text-zinc-200 text-base font-semibold">Meaningful equity ownership in Pulse</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-5 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-sm md:text-base">Input on product direction — especially run club and community features</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-5 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-sm md:text-base">Technology infrastructure to scale Wunna Run globally without losing intimacy</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-5 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-sm md:text-base">Rich data on his community for merch drops, pre-sales, VIP experiences, and sponsor activations</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-5 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-sm md:text-base">Year-round engagement platform that keeps runners connected between events</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-5 rounded-xl border border-zinc-800 text-left">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-sm md:text-base">Philanthropic impact tracking — see how participation translates to community giveback</p>
              </div>
              
              <div className="flex items-start gap-4 bg-zinc-900/50 p-5 rounded-xl border border-[#E0FE10]/25 text-left md:col-span-2">
                <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-[#E0FE10]" />
                </div>
                <p className="text-zinc-300 text-sm md:text-base">A partner aligned with his mission of health, wellness, community, and philanthropy</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Slide 3: The Mission Behind the Movement */}
        <section 
          data-slide="3"
          ref={(el) => { sectionRefs.current[3] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background Image (from former Executive Summary slide) */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-crowd.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/85"></div>
          </div>
          <div className="relative z-10 w-full max-w-5xl mx-auto px-6">
            {/* Header */}
            <div className="text-center mb-8 animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold text-white mb-3`}>
                The Mission Behind the Movement
              </h2>
              <p className="text-[#E0FE10] text-lg md:text-xl font-medium">
                Wunna Run started with a personal transformation.
              </p>
            </div>
            
            {/* Story Card */}
            <div className="bg-black/60 backdrop-blur-sm border border-white/15 rounded-2xl p-6 md:p-8 mb-6 animate-fade-in-up animation-delay-150">
              <p className="text-white text-base md:text-lg leading-relaxed text-center">
                Gunna faced his own nutritional and health challenges. Through fitness, he found <span className="text-[#E0FE10] font-semibold">peace, accountability, and purpose</span>. Running a marathon — and raising money for his community — became the spark for something bigger.
              </p>
            </div>
            
            {/* Four Pillars */}
            <div className="mb-6 animate-fade-in-up animation-delay-200">
              <p className="text-zinc-400 text-xs uppercase tracking-widest mb-4 text-center">Wunna Run is rooted in four pillars</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-black/70 border-2 border-[#E0FE10]/40 rounded-xl p-4 text-center backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-[#E0FE10] text-xl">💪</span>
                  </div>
                  <p className="text-[#E0FE10] font-bold text-base mb-1">Health</p>
                  <p className="text-zinc-300 text-xs md:text-sm">Inspiring people to move, no matter where they start</p>
                </div>
                <div className="bg-black/70 border-2 border-[#E0FE10]/40 rounded-xl p-4 text-center backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-[#E0FE10] text-xl">🧘</span>
                  </div>
                  <p className="text-[#E0FE10] font-bold text-base mb-1">Wellness</p>
                  <p className="text-zinc-300 text-xs md:text-sm">Finding peace and balance through fitness</p>
                </div>
                <div className="bg-black/70 border-2 border-[#E0FE10]/40 rounded-xl p-4 text-center backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-[#E0FE10] text-xl">🤝</span>
                  </div>
                  <p className="text-[#E0FE10] font-bold text-base mb-1">Community</p>
                  <p className="text-zinc-300 text-xs md:text-sm">Real connections between Gunna and his fans</p>
                </div>
                <div className="bg-black/70 border-2 border-[#E0FE10]/40 rounded-xl p-4 text-center backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-[#E0FE10] text-xl">❤️</span>
                  </div>
                  <p className="text-[#E0FE10] font-bold text-base mb-1">Philanthropy</p>
                  <p className="text-zinc-300 text-xs md:text-sm">Giving back through <a href="https://gunnasgreatgiveawayfoundation.com/" target="_blank" rel="noopener noreferrer" className="text-[#E0FE10] hover:underline font-medium">Gunna&apos;s Great Giveaway</a></p>
                </div>
              </div>
            </div>
            
            {/* $3M Investment Highlight */}
            <div className="bg-gradient-to-r from-[#E0FE10]/15 to-transparent border-l-4 border-[#E0FE10] rounded-r-xl p-4 md:p-5 mb-5 animate-fade-in-up animation-delay-300">
              <p className="text-white text-base md:text-lg">
                Gunna invests over <span className="text-[#E0FE10] font-bold text-xl md:text-2xl">$3 million</span> annually in the City of South Fulton — one of the most underserved communities in Georgia — because he believes health and economic opportunity go hand in hand.
              </p>
            </div>
            
            {/* Closing Statement */}
            <div className="text-center animate-fade-in-up animation-delay-450">
              <p className="text-white text-lg md:text-xl font-bold">
                Pulse is built to support all four pillars — <span className="text-[#E0FE10]">not just the runs, but the mission behind them.</span>
              </p>
            </div>
          </div>
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
          <div className="absolute bottom-6 right-6 md:right-20 z-20 flex items-center gap-4">
            <Footprints className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Running" />
            <Dumbbell className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Lifting" />
            <PersonStanding className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" aria-label="Mobility" />
          </div>
        </section>
        
        {/* Slide 4: Wunna Run Recap + Next */}
        <section 
          data-slide="4"
          ref={(el) => { sectionRefs.current[4] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Wunna Run 5K at start line */}
          <div className="absolute inset-0">
            <img 
              src="/wunna-run-meet-wunna.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/75"></div>
          </div>
          
          {/* Main Content */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            {/* Title */}
            <div className="text-center mb-8 animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold text-white`}>
                Wunna Run Recap + Next
              </h2>
              <p className="text-zinc-200 mt-3 text-lg md:text-xl font-medium">
                2025 proved the demand. 2026 turns it into a global movement.
              </p>
            </div>

            {/* Visual: 2025 / 2026 side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* 2025 */}
              <div className="bg-black/70 border border-white/20 rounded-2xl p-6 backdrop-blur-md animate-fade-in-up">
                <p className="text-[#E0FE10] text-sm uppercase tracking-widest mb-4 font-bold">2025 — What Wunna Run Did</p>
                <ul className="text-white text-base space-y-3">
                  <li className="flex items-center gap-3">
                    <span className="text-[#E0FE10] font-bold text-xl">8</span>
                    <span>cities</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#E0FE10] font-bold text-xl">2,000+</span>
                    <span>runners per event</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-[#E0FE10] font-bold text-xl">20+</span>
                    <span>races worldwide</span>
                  </li>
                  <li className="pt-2 border-t border-white/10">
                    <span className="text-zinc-300 text-sm">Partners: Strava, Under Armour, House of Athlete, Symbiotica, Flourish, Path Water</span>
                  </li>
                  <li>
                    <span className="text-zinc-300 text-sm">Proceeds supporting <a href="https://gunnasgreatgiveawayfoundation.com/" target="_blank" rel="noopener noreferrer" className="text-[#E0FE10] hover:underline font-medium">Gunna&apos;s Great Giveaway</a> — investing in the City of South Fulton</span>
                  </li>
                </ul>
              </div>

              {/* 2026 */}
              <div className="bg-black/70 border-2 border-[#E0FE10]/40 rounded-2xl p-6 backdrop-blur-md animate-fade-in-up animation-delay-150">
                <p className="text-[#E0FE10] text-sm uppercase tracking-widest mb-4 font-bold">2026 — Global Expansion</p>
                <ul className="text-white text-base space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="text-[#E0FE10] text-lg">•</span>
                    <span>Paris + London launch moments</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#E0FE10] text-lg">•</span>
                    <span>City-to-city continuity (points carry over)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#E0FE10] text-lg">•</span>
                    <span>One global series experience</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#E0FE10] text-lg">•</span>
                    <span>Deeper philanthropic integration</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* PROPOSAL */}
            <div className="animate-fade-in-up animation-delay-300">
              <div className="bg-gradient-to-r from-[#E0FE10]/15 to-black/60 border-2 border-[#E0FE10]/50 rounded-2xl p-6 backdrop-blur-md">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#E0FE10]/20 border border-[#E0FE10]/50 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-6 h-6 text-[#E0FE10]" />
                    </div>
                    <div>
                      <p className="text-[#E0FE10] text-xs uppercase tracking-widest font-bold">Proposal</p>
                      <p className="text-white font-bold text-xl mt-1">
                        Technology installation — build on top of <span className="text-[#E0FE10] italic">Pulse</span>
                      </p>
                      <p className="text-zinc-200 text-base mt-2">
                        Infrastructure for check-ins, run tracking, challenges, points, leaderboards, owned data, and philanthropic impact tracking.
                      </p>
                    </div>
                  </div>
                  <div className="text-left md:text-right flex-shrink-0">
                    <p className="text-white font-semibold text-sm">Result:</p>
                    <p className="text-[#E0FE10] font-bold text-lg">
                      A global series, year-round —<br />with purpose.
                    </p>
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
        
        {/* Slide 5: Meet the Runners */}
        <section 
          data-slide="5"
          ref={(el) => { sectionRefs.current[5] = el as HTMLDivElement; }}
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
          
          {/* Main Content - Problem-centered layout with image */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
            {/* Title */}
            <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white text-center animate-fade-in-up`}>
              The Runners
            </h2>
            
            <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-8">
              {/* THE PROBLEM - Centerpiece (Left/Main) */}
              <div className="lg:w-3/5 bg-black/50 backdrop-blur-sm border-2 border-[#E0FE10]/40 rounded-2xl p-6 md:p-8 animate-fade-in-up animation-delay-150 flex flex-col justify-center">
                <p className="text-[#E0FE10] text-xs uppercase tracking-widest mb-4 text-center">The Runners Problem</p>
                
                <div className="space-y-5">
                  {/* Problem 1 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center">
                      <span className="text-[#E0FE10] font-bold">1</span>
                    </div>
                    <p className="text-white text-base md:text-lg leading-relaxed">
                      Runners, fans, and community who physically showed up to Wunna Run had an incredible experience — <span className="text-[#E0FE10] font-semibold">but cannot take part again until the next in-person run.</span>
                    </p>
                  </div>
                  
                  {/* Problem 2 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center">
                      <span className="text-[#E0FE10] font-bold">2</span>
                    </div>
                    <p className="text-white text-base md:text-lg leading-relaxed">
                      Runners, fans, and community who cannot attend due to travel or not living in a major city <span className="text-[#E0FE10] font-semibold">still want to participate and contribute to the run community.</span>
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Runner Image (Right) */}
              <div className="lg:w-2/5 animate-fade-in-up animation-delay-300">
                <div className="relative rounded-lg overflow-hidden border-2 border-[#E0FE10]/50 h-full min-h-[250px] md:min-h-[300px]">
                  <img 
                    src="/wunna-run-runners.png" 
                    alt="Wunna Run Runners" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
            
            {/* What they want - compact row */}
            <div className="animate-fade-in-up animation-delay-450 mt-6">
              <p className="text-zinc-400 text-sm uppercase tracking-widest mb-3 text-center">What they want</p>
              <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                {[
                  'Stay connected',
                  'Track progress',
                  'Earn recognition',
                  'Feel part of something bigger',
                  'Run with purpose',
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-[#E0FE10]">•</span>
                    <span className="text-zinc-200 text-xs md:text-sm">{item}</span>
                  </div>
                ))}
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
        
        {/* Slide 6: The Solution: Introducing Pulse - Runs with Gunna */}
        <section 
          data-slide="6"
          ref={(el) => { sectionRefs.current[6] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          {/* Background - Dark gradient like chromatic-glass */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          
          {/* Main Content - Two Column Layout */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Left Side - Text Content */}
            <div className={`${isMobile ? 'w-full text-center' : 'md:w-1/2 text-left'} animate-fade-in-up`}>
              <h2 className={`${isMobile ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl lg:text-5xl'} font-bold mb-8 text-white`}>
                The Solution: Introducing <span className="text-[#E0FE10] italic">Pulse</span> — Runs with Gunna
              </h2>
              
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-8`}>
                <span className="text-[#E0FE10] font-semibold">Pulse</span> is a <span className="text-[#E0FE10] font-semibold">community-first fitness platform</span> that helps <span className="text-[#E0FE10] font-semibold">brands</span>, <span className="text-[#E0FE10] font-semibold">athletes</span>, and <span className="text-[#E0FE10] font-semibold">community leaders</span> build deeper connection through digital group training.
              </p>
              
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-8`}>
                Backed by the same investors behind <span className="text-[#E0FE10] font-semibold">Uber</span>, <span className="text-[#E0FE10] font-semibold">Calm</span>, and <span className="text-[#E0FE10] font-semibold">Robinhood</span>.
              </p>
              
              <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-zinc-400`}>
                <span className="text-[#E0FE10] font-semibold">This is your personalized operating system for your fitness community.</span>
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
        
        {/* Slide 7: The Runner Experience */}
        <section 
          data-slide="7"
          ref={(el) => { sectionRefs.current[7] = el as HTMLDivElement; }}
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
        
        {/* Slide 8: How It Works — Community */}
        <section 
          data-slide="8"
          ref={(el) => { sectionRefs.current[8] = el as HTMLDivElement; }}
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
        
        {/* Slide 9: How It Works — Check-Ins (Part 1: QR at venue) */}
        <section 
          data-slide="9"
          ref={(el) => { sectionRefs.current[9] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          <div className="absolute inset-0">
            <img src="/wunna-run-gunna.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/70"></div>
          </div>
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className={`${isMobile ? 'w-full text-center' : 'md:w-2/5 text-left'} animate-fade-in-up`}>
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white`}>
                How it works — <span className="text-[#E0FE10]">Check-Ins</span> <span className="text-zinc-400 text-2xl md:text-3xl">(1 of 3)</span>
              </h2>
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-4`}>
                When participants arrive at the <span className="text-[#E0FE10] font-semibold">physical location</span> of the run, the QR code appears on their phone — ready to be scanned by the host.
              </p>
              <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-zinc-300 leading-relaxed`}>
                Or they can scan a QR code displayed at the venue to check in. Either way — they&apos;re in.
              </p>
            </div>
            <div className={`${isMobile ? 'w-full' : 'md:w-3/5'} animate-fade-in-up animation-delay-300 flex justify-center`}>
              <img src="/wunna-checkin-qr.png" alt="QR Code — show to host to check in" className={`rounded-[32px] border-2 border-[#E0FE10]/60 ${isMobile ? 'h-80' : 'h-[420px] md:h-[500px] lg:h-[560px]'} w-auto object-contain`} />
            </div>
          </div>
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>

        {/* Slide 10: How It Works — Check-Ins (Part 2: Points & badges) */}
        <section 
          data-slide="10"
          ref={(el) => { sectionRefs.current[10] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          <div className="absolute inset-0">
            <img src="/wunna-run-gunna.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/70"></div>
          </div>
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className={`${isMobile ? 'w-full text-center' : 'md:w-2/5 text-left'} animate-fade-in-up`}>
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white`}>
                How it works — <span className="text-[#E0FE10]">Check-Ins</span> <span className="text-zinc-400 text-2xl md:text-3xl">(2 of 3)</span>
              </h2>
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-4`}>
                <span className="text-[#E0FE10] font-semibold">Points and badges</span> for scanning the QR code at the physical location — so showing up pays off.
              </p>
              <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-zinc-300 leading-relaxed mb-4`}>
                Participants can collect badges across cities (e.g. Paris, London, Atlanta). More badges = more points — encouraging runners to show up run after run.
              </p>
              <p className={`${isMobile ? 'text-base' : 'text-lg'} text-[#E0FE10] font-semibold`}>
                Runs are no longer one-off events. They become a <span className="text-white">connected experience</span> from city to city.
              </p>
            </div>
            <div className={`${isMobile ? 'w-full' : 'md:w-3/5'} animate-fade-in-up animation-delay-300 flex justify-center`}>
              <img src="/wunna-checkin-confirmation.png" alt="Checked in — badges and points" className={`rounded-[32px] border-2 border-[#E0FE10]/60 ${isMobile ? 'h-80' : 'h-[420px] md:h-[500px] lg:h-[560px]'} w-auto object-contain`} />
            </div>
          </div>
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>

        {/* Slide 11: How It Works — Check-Ins (Part 3: Map, physical + virtual) */}
        <section 
          data-slide="11"
          ref={(el) => { sectionRefs.current[11] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          <div className="absolute inset-0">
            <img src="/wunna-run-gunna.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/70"></div>
          </div>
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className={`${isMobile ? 'w-full text-center' : 'md:w-2/5 text-left'} animate-fade-in-up`}>
              <h2 className={`${isMobile ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl lg:text-4xl'} font-bold mb-6 text-white leading-tight`}>
                How it works: We use check-ins to expand reach and make <span className="text-[#E0FE10]">Gunna Runs</span> accessible to everyone everywhere.
              </h2>
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-4`}>
                The map shows <span className="text-[#E0FE10] font-semibold">physical check-ins</span> — and also <span className="text-[#E0FE10] font-semibold">virtual runners</span>.
              </p>
              <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-zinc-300 leading-relaxed mb-4`}>
                People can join the run virtually from any city and run from wherever they are — and still take part in the same event, earn points, and feel part of the community.
              </p>
              <p className={`${isMobile ? 'text-base' : 'text-lg'} text-[#E0FE10] font-semibold`}>
                That unlocks <span className="text-white">scale</span> that wasn&apos;t possible when every run was in-person only.
              </p>
            </div>
            <div className={`${isMobile ? 'w-full' : 'md:w-3/5'} animate-fade-in-up animation-delay-300 flex justify-center`}>
              <img src="/wunna-checkin-global.png" alt="Global runners — physical and virtual" className={`rounded-[32px] border-2 border-[#E0FE10]/60 ${isMobile ? 'h-80' : 'h-[420px] md:h-[500px] lg:h-[560px]'} w-auto object-contain`} />
            </div>
          </div>
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 12: How It Works — Gamification */}
        <section 
          data-slide="12"
          ref={(el) => { sectionRefs.current[12] = el as HTMLDivElement; }}
          className={`${getSectionClasses()} overflow-hidden`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-zinc-900"></div>
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="w-full md:w-2/5 text-left animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold mb-6 text-white`}>
                How it works — <span className="text-[#E0FE10]">Gamification</span>
              </h2>
              <p className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl'} text-white leading-relaxed mb-5`}>
                <span className="text-[#E0FE10] font-semibold">Points as incentives.</span> Each run compounds and leads to the next — a connected experience, not isolated events.
              </p>
              <ul className="space-y-3 text-zinc-300 text-base md:text-lg">
                <li className="flex items-start gap-2">
                  <Trophy className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span><span className="text-white font-medium">Invites:</span> Earn points when friends join with your link — growth and community in one.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span><span className="text-white font-medium">Social:</span> Points encourage interaction — challenges, leaderboards, recognition.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span><span className="text-white font-medium">Loyalty:</span> Streaks, badges, city-to-city continuity keep runners coming back.</span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="w-5 h-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <span><span className="text-white font-medium">Deeper connection:</span> Gamification turns participation into belonging — not just one run, but a movement.</span>
                </li>
              </ul>
            </div>
            <div className={`${isMobile ? 'w-full' : 'md:w-3/5'} animate-fade-in-up animation-delay-300 flex justify-center`}>
              <img src="/wunna-gamification-rules.png" alt="Rules & Scoring on Pulse" className={`rounded-[32px] border-2 border-[#E0FE10]/60 w-auto object-contain ${isMobile ? 'h-96' : 'h-[420px] md:h-[500px] lg:h-[560px]'}`} />
            </div>
          </div>
          <div className="absolute bottom-6 left-6 z-20">
            <span className="text-[#E0FE10] font-medium text-sm md:text-base">fitwithpulse.ai</span>
          </div>
        </section>
        
        {/* Slide 13: Between Events */}
        <section 
          data-slide="13"
          ref={(el) => { sectionRefs.current[13] = el as HTMLDivElement; }}
          className={getSectionClasses('bg-zinc-950')}
        >
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
            {/* Title */}
            <div className="text-center mb-8 animate-fade-in-up">
              <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold text-white`}>
                Between <span className="text-[#E0FE10]">Events</span>
              </h2>
              <p className="text-xl text-zinc-400 mt-3">The community doesn&apos;t stop when the run ends.</p>
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
        
        {/* Slide 14: How It Works — Data (Rich data profile on each runner) */}
        <section 
          data-slide="14"
          ref={(el) => { sectionRefs.current[14] = el as HTMLDivElement; }}
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
              
              <p className="text-zinc-400 text-sm mb-4">
                <span className="text-[#E0FE10] font-semibold">Wearable data collection</span> — runs, activity, and engagement sync from Apple Watch, Garmin, Strava, and more.
              </p>
              
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
        
        {/* Slide 15: The Series - NASCAR/PGA Style */}
        <section 
          data-slide="15"
          ref={(el) => { sectionRefs.current[15] = el as HTMLDivElement; }}
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
        
        {/* Slide 16: The Wunna Run Team Experience */}
        <section 
          data-slide="16"
          ref={(el) => { sectionRefs.current[16] = el as HTMLDivElement; }}
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
        
        {/* Slide 17: Scale */}
        <section 
          data-slide="17"
          ref={(el) => { sectionRefs.current[17] = el as HTMLDivElement; }}
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
        
        {/* Slide 18: Who's Building Pulse? (Team) */}
        <section 
          data-slide="18"
          ref={(el) => { sectionRefs.current[18] = el as HTMLDivElement; }}
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
        
        {/* Slide 19: Timeline */}
        <section 
          data-slide="19"
          ref={(el) => { sectionRefs.current[19] = el as HTMLDivElement; }}
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
          data-slide="20"
          ref={(el) => { sectionRefs.current[20] = el as HTMLDivElement; }}
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
          data-slide="21"
          ref={(el) => { sectionRefs.current[21] = el as HTMLDivElement; }}
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
                    <img src="/pulse-logo-white.svg" alt="Pulse Logo" className="h-12 w-auto mb-2" />
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
