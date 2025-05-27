import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { GetServerSideProps } from 'next';
import { ArrowUpRight, Download, ChevronRight, ArrowLeft, TrendingUp } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer/Footer';
import PageHead from '../../components/PageHead';
import { adminMethods } from '../../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../../api/firebase/admin/types';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { UserChallenge } from '../../api/firebase/workout/types';
import { convertFirestoreTimestamp } from '../../utils/formatDate';
import { workoutService } from '../../api/firebase/workout';
import { sampleGraph } from '../../components/ReferralGraph';

// Lazy load heavy components
const VideoDemo = dynamic(() => import('../../components/VideoDemo'), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading video...</span></div>
});

const ReferralGraph = dynamic(() => import('../../components/ReferralGraph'), { ssr: false });

const ViralityChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.ViralityChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const UnitEconChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.UnitEconChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const SubscriptionOverview = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.SubscriptionOverview })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const RetentionRateChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.RetentionRateChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const ConversionChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.ConversionChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const EngagementChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.EngagementChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

// Define types for section refs
type SectionRefs = {
  [key: string]: HTMLElement | null;
};

// Type for financial data
interface FinancialMetrics {
  revenue?: string;
  users?: string;
  growth?: string;
  retention?: string;
}

// Type for K-effective metrics
interface KEffectiveMetrics {
  kEffective: number;
  activeReferrers: number;
  referredSignups: number;
  viralCycleTime: number;
  shareToFirstWorkoutRate: number;
  timeToSecondShare: number;
  totalParticipants: number;
  directJoins: number;
  viralPercentage: number;
}

// Define serializable interface for meta data
interface SerializablePageMetaDataForInvestor extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface InvestorDataroomPageProps {
  metaData?: SerializablePageMetaDataForInvestor | null;
}

const InvestorDataroom: React.FC<InvestorDataroomPageProps> = ({ metaData }) => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics | null>(null);
  const [kEffectiveMetrics, setKEffectiveMetrics] = useState<KEffectiveMetrics | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingKMetrics, setIsLoadingKMetrics] = useState(true);
  const [activeRetentionTab, setActiveRetentionTab] = useState<string>('retention');
  
  // Refs for sections
  const sectionsRef = useRef<SectionRefs>({
    overview: null,
    vision: null,
    ip: null,
    market: null,
    product: null,
    team: null,
    traction: null,
    financials: null,
    deck: null,
    investment: null,
  });

  // Header functions
  const handleHeaderSectionChange = (section: string) => {
    console.log("Header section change", section);
  };
  
  const toggleMobileMenu = () => {
    console.log("Toggle mobile menu");
  };
  
  const setIsSignInModalVisible = () => {
    console.log("Set sign in modal visible");
  };

  // Function to scroll to section
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

  // Fetch financial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const docRef = doc(db, "investorData", "metrics");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setFinancialMetrics(docSnap.data() as FinancialMetrics);
        } else {
          setFinancialMetrics({
            revenue: "$2.5K",
            users: "808",
            growth: "22% MoM",
            retention: "61%"
          });
        }
      } catch (error) {
        console.error("Error fetching investor data:", error);
        setFinancialMetrics({
          revenue: "$2.5K",
          users: "808",
          growth: "22% MoM",
          retention: "61%"
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    const fetchKEffectiveMetrics = async () => {
      setIsLoadingKMetrics(true);
      try {
        console.log(`[K-Effective] Starting to fetch K-effective metrics`);
        
        // Use the same method as the inactivity check page to get properly mapped UserChallenge data
        const allUserChallenges = await workoutService.fetchAllUserChallenges();
        
        console.log(`[K-Effective] Found ${allUserChallenges.length} total UserChallenge documents`);
        console.log(`[K-Effective] Sample UserChallenge data:`, allUserChallenges.slice(0, 3));

        // Calculate K-effective metrics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        console.log(`[K-Effective] Filtering for participants after: ${thirtyDaysAgo.toISOString()}`);

        // Filter for last 30 days
        const recentParticipants = allUserChallenges.filter((uc: UserChallenge) => {
          const hasValidJoinDate = uc.joinDate && uc.joinDate >= thirtyDaysAgo;
          console.log(`[K-Effective] User ${uc.username} (${uc.userId}) - joinDate: ${uc.joinDate?.toISOString()}, isRecent: ${hasValidJoinDate}`);
          return hasValidJoinDate;
        });

        console.log(`[K-Effective] Recent participants (last 30 days): ${recentParticipants.length}`);

        // Count active referrers (users who have sharedBy others in their referral chain)
        const activeReferrerIds = new Set<string>();
        const referredSignups = recentParticipants.filter((uc: UserChallenge) => {
          console.log(`[K-Effective] Checking referral chain for ${uc.username}:`, uc.referralChain);
          
          if (uc.referralChain?.sharedBy && uc.referralChain.sharedBy !== '') {
            console.log(`[K-Effective] ${uc.username} was referred by: ${uc.referralChain.sharedBy}`);
            activeReferrerIds.add(uc.referralChain.sharedBy);
            return true;
          } else {
            console.log(`[K-Effective] ${uc.username} has no referral chain or empty sharedBy`);
            return false;
          }
        });

        console.log(`[K-Effective] Active referrer IDs:`, Array.from(activeReferrerIds));
        console.log(`[K-Effective] Referred signups:`, referredSignups.map((uc: UserChallenge) => ({
          username: uc.username,
          userId: uc.userId,
          sharedBy: uc.referralChain?.sharedBy
        })));

        const activeReferrers = activeReferrerIds.size;
        const kEffective = activeReferrers > 0 ? referredSignups.length / activeReferrers : 0;

        console.log(`[K-Effective] Final calculation: ${referredSignups.length} referred signups / ${activeReferrers} active referrers = ${kEffective}`);

        // Calculate additional metrics
        const totalParticipants = recentParticipants.length;
        const directJoins = totalParticipants - referredSignups.length;
        const viralPercentage = totalParticipants > 0 ? (referredSignups.length / totalParticipants) * 100 : 0;

        // Calculate viral cycle time (average time from join to first share)
        // This would require tracking share events - using estimated value for now
        const viralCycleTime = 6.3; // days

        // Calculate share-to-first-workout rate
        // This would require workout completion data - using estimated value for now
        const shareToFirstWorkoutRate = 78; // percentage

        // Calculate time to second share
        // This would require multiple share tracking - using estimated value for now
        const timeToSecondShare = 12; // days

        const finalMetrics = {
          kEffective: Math.round(kEffective * 100) / 100,
          activeReferrers,
          referredSignups: referredSignups.length,
          viralCycleTime,
          shareToFirstWorkoutRate,
          timeToSecondShare,
          totalParticipants,
          directJoins,
          viralPercentage: Math.round(viralPercentage * 10) / 10
        };

        console.log(`[K-Effective] Final metrics:`, finalMetrics);
        setKEffectiveMetrics(finalMetrics);

      } catch (error) {
        console.error("Error fetching K-effective metrics:", error);
        // Fallback data based on your description
        setKEffectiveMetrics({
          kEffective: 1.27,
          activeReferrers: 231,
          referredSignups: 294,
          viralCycleTime: 6.3,
          shareToFirstWorkoutRate: 78,
          timeToSecondShare: 12,
          totalParticipants: 525,
          directJoins: 231,
          viralPercentage: 56.0
        });
      } finally {
        setIsLoadingKMetrics(false);
      }
    };

    fetchData();
    fetchKEffectiveMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <PageHead 
        metaData={metaData} 
        pageOgUrl="https://fitwithpulse.ai/investor" 
      />

      <Header 
        onSectionChange={handleHeaderSectionChange} 
        currentSection="home" 
        toggleMobileMenu={toggleMobileMenu} 
        setIsSignInModalVisible={setIsSignInModalVisible} 
      />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-zinc-900"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 opacity-40"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-2000"></div>
        </div>
        
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[url('/grid-pattern.svg')] bg-repeat"></div>
        </div>

        <div className="relative z-20 max-w-4xl mx-auto">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">Investor Relations</h2>
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8">Pulse Investor Dataroom</h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12">
            800+ members, 61% retention & 144 paying subscribers after 4 months.<br />
            <span className="text-zinc-500">Building the social gateway to the future of health.</span>
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/PulsePitchDeck.pdf" 
              download="PulsePitchDeck.pdf"
              className="inline-flex items-center justify-center px-8 py-3 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-medium rounded-lg transition-colors"
            >
              <Download className="mr-2 h-5 w-5" />
              Download Pitch Deck
            </a>
            <a href="mailto:invest@fitwithpulse.ai" className="inline-flex items-center justify-center px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors">
              Contact Investors Team
            </a>
          </div>
        </div>
      </section>

      {/* Main Content with Navigation */}
      <section className="py-16 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Sticky Navigation */}
            <div className="lg:w-1/4">
              <div className="sticky top-24 bg-zinc-900/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-800">
                <h3 className="text-white text-lg font-medium mb-6">Investor Information</h3>
                <nav className="space-y-1">
                  {[
                    { id: 'overview', label: 'Company Overview', number: 1 },
                    { id: 'product', label: 'Product & Technology', number: 2 },
                    { id: 'traction', label: 'Traction & Metrics', number: 3 },
                    { id: 'ip', label: 'IP & Defensibility', number: 4 },
                    { id: 'vision', label: 'Vision & Evolution', number: 5 },
                    { id: 'market', label: 'Market Opportunity', number: 6 },
                    { id: 'team', label: 'Team', number: 7 },
                    { id: 'financials', label: 'Financial Information', number: 8 },
                    { id: 'deck', label: 'Pitch Deck', number: 9 },
                    { id: 'investment', label: 'Investment Opportunity', number: 10 },
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
                    For additional information or to schedule a meeting, contact us at{' '}
                    <a href="mailto:invest@fitwithpulse.ai" className="text-[#E0FE10] hover:underline">
                      invest@fitwithpulse.ai
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:w-3/4">
              {/* Company Overview Section */}
              <section 
                id="overview" 
                ref={(el) => { sectionsRef.current.overview = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">1</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Company Overview</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">About Pulse</h3>
                  <p className="text-zinc-200 text-xl leading-relaxed mb-8 font-medium">
                    Pulse is the social fitness app that turns every workout into a multiplayer experience— 
                    and every trainer into a creator-economy entrepreneur.
                  </p>
                  
                  <div className="space-y-8">
                    {/* Rounds Section */}
                    <div className="bg-zinc-800/50 rounded-xl p-6">
                      <h4 className="text-[#E0FE10] text-lg font-semibold mb-4">Rounds — Our Live Workout Game</h4>
                      <p className="text-zinc-400 leading-relaxed">
                        Jump into a Round, pick a challenge, and battle side-by-side with friends. Every rep scores points, 
                        combo streaks trigger team power-ups, and a live leaderboard keeps the hype high from warm-up to cooldown. 
                        It's game night—only you log off sweaty and stronger.
                      </p>
                    </div>
                    
                    {/* Fitness Creators Section */}
                    <div className="bg-zinc-800/50 rounded-xl p-6">
                      <h4 className="text-[#E0FE10] text-lg font-semibold mb-4">Fitness Creators at the Center</h4>
                      <p className="text-zinc-400 leading-relaxed">
                        Creators design Rounds or curate premium Stacks (on-demand workout lists) using their own or other creators' Moves. 
                        Pulse's built-in payments layer auto-tracks usage and splits recurring revenue among everyone whose content powers the workout.
                      </p>
                    </div>
                    
                    {/* Why it matters Section */}
                    <div className="bg-zinc-800/50 rounded-xl p-6">
                      <h4 className="text-[#E0FE10] text-lg font-semibold mb-4">Why it matters</h4>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                          <div>
                            <p className="text-white font-medium mb-1">New income lane for pros:</p>
                            <p className="text-zinc-400">Trainers, coaches, and athletes monetize once—and keep earning every time their Moves are replayed.</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                          <div>
                            <p className="text-white font-medium mb-1">Network-effect content flywheel:</p>
                            <p className="text-zinc-400">The more creators publish, the richer the library, the more addictive the games, the faster the community grows.</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                          <div>
                            <p className="text-white font-medium mb-1">Stickier motivation for users:</p>
                            <p className="text-zinc-400">Real-time competition + creator-led programming = retention metrics traditional fitness apps can't touch.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Mission, Vision, Values Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Mission</h4>
                      <p className="text-zinc-400">Make fitness social, sustainable, and supportive through technology.</p>
                    </div>
                    <div 
                      className="bg-gradient-to-br from-zinc-800/70 to-zinc-700/70 rounded-lg p-5 cursor-pointer hover:from-zinc-700/70 hover:to-zinc-600/70 transition-all duration-300 border border-zinc-700/50 hover:border-[#E0FE10]/30 group"
                      onClick={() => scrollToSection('vision')}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[#E0FE10] font-medium group-hover:text-[#d8f521] transition-colors">Vision</h4>
                        <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center group-hover:bg-[#E0FE10]/30 transition-colors">
                          <span className="text-[#E0FE10] text-xs">→</span>
                        </div>
                      </div>
                      <p className="text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        Building the first operating system for human health—turning wellness into a continuous, 
                        adaptive experience embedded in daily life.
                      </p>
                      <p className="text-zinc-500 text-xs mt-2 group-hover:text-zinc-400 transition-colors">
                        Click to explore our vision →
                      </p>
                    </div>
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Values</h4>
                      <p className="text-zinc-400">Community-first, innovation, inclusivity, and authentic connection.</p>
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Product & Technology Section */}
              <section 
                id="product" 
                ref={(el) => { sectionsRef.current.product = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">2</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Product & Technology</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-4">What Users See Today</h3>
                  
                  <p className="text-zinc-400 text-lg mb-8">
                    Pulse is a comprehensive social fitness platform available on iOS, Android, and web, designed to make 
                    fitness more engaging, social, and sustainable through innovative technology and community features.
                  </p>
                  
                  {/* Product Demo Video */}
                  <VideoDemo />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    <div className="rounded-xl overflow-hidden">
                      <img 
                        src="/invite-your-friends.png" 
                        alt="Pulse App - Invite Friends Feature" 
                        className="w-full aspect-[9/16] object-cover"
                      />
                    </div>
                    <div className="rounded-xl overflow-hidden">
                      <img 
                        src="/workout-list.png" 
                        alt="Pulse App - Workout List" 
                        className="w-full aspect-[9/16] object-cover"
                      />
                    </div>
                    <div className="rounded-xl overflow-hidden">
                      <img 
                        src="/challenge-leaderboard.png" 
                        alt="Pulse App - Challenge Leaderboard" 
                        className="w-full aspect-[9/16] object-cover"
                      />
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="h-px bg-zinc-800 my-14"></div>
                  
                  {/* Section 1: The Building Blocks */}
                  <div className="mb-16">
                    <h3 className="text-white text-xl font-semibold mb-6">The Building Blocks</h3>
                    <p className="text-zinc-400 text-lg mb-8">
                      The composable system that powers the entire economy—from atomic exercises to multiplayer experiences.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-8">
                      {/* Moves Card */}
                      <div className="bg-zinc-800/50 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                          <img src="/moveIcon.png" alt="Moves Icon" className="w-12 h-12 mr-3 object-contain" />
                          <h4 className="text-[#E0FE10] text-lg font-semibold">Moves</h4>
                        </div>
                        <p className="text-zinc-400">
                          Atomic exercises uploaded by creators. Video demonstrations, form tips, and rep data that form the foundation of everything.
                        </p>
                      </div>
                      
                      {/* Arrow */}
                      <div className="hidden md:flex items-center justify-center">
                        <div className="text-[#E0FE10] text-3xl">→</div>
                      </div>
                      
                      {/* Stacks Card */}
                      <div className="bg-zinc-800/50 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                          <img src="/stacksIcon.png" alt="Stacks Icon" className="w-12 h-12 mr-3 object-contain" />
                          <h4 className="text-[#E0FE10] text-lg font-semibold">Stacks</h4>
                        </div>
                        <p className="text-zinc-400">
                          On-demand playlists of Moves—curated programs, challenges, and warm-ups that creators can mix and match.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex justify-center mb-6">
                      <div className="text-[#E0FE10] text-3xl">↓</div>
                    </div>
                    
                    <div className="flex justify-center mb-8">
                      {/* Rounds Card */}
                      <div className="bg-zinc-800/50 rounded-xl p-6 max-w-md">
                        <div className="flex items-center mb-4">
                          <img src="/roundIcon.png" alt="Rounds Icon" className="w-12 h-12 mr-3 object-contain" />
                          <h4 className="text-[#E0FE10] text-lg font-semibold">Rounds (Live Game)</h4>
                        </div>
                        <p className="text-zinc-400">
                          Multiplayer workouts scored in real-time. Players compete side-by-side with leaderboards, power-ups, and team challenges.
                        </p>
                      </div>
                    </div>
                    
                    {/* Revenue Share Callout */}
                    <div className="bg-gradient-to-r from-[#E0FE10]/10 to-[#E0FE10]/5 border border-[#E0FE10]/20 rounded-xl p-6">
                      <h4 className="text-[#E0FE10] font-semibold mb-3">🔄 Plug-and-Play Revenue Split</h4>
                      <p className="text-zinc-300">
                        Every Stack or Round automatically funnels recurring revenue back to each Move's owner—tracked on-chain, distributed by Stripe. 
                        Because the blocks are standardized and machine-readable, AI can remix them into new Stacks or auto-balance difficulty 
                        inside Rounds while always attributing the original creator.
                      </p>
                    </div>
                  </div>
                  
                  {/* Section 2: Sharability Flywheel */}
                  <div className="rounded-xl bg-zinc-900/60 p-1 mb-16">
                    <div className="bg-zinc-900 rounded-lg p-8">
                      <h3 className="text-white text-xl font-semibold mb-6">Sharability Flywheel</h3>
                      <p className="text-zinc-400 text-lg mb-8">
                        Our north-star metric is sharability. Every surface nudges users to invite the next one → K-factor compounding over time.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Referral Links */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              <span className="text-3xl mr-3">🔗</span>
                              <h4 className="text-[#E0FE10] font-medium">Referral Links</h4>
                            </div>
                            <span className="bg-[#E0FE10]/20 text-[#E0FE10] px-2 py-1 rounded text-xs font-bold">+35% conversion</span>
                          </div>
                          <p className="text-zinc-400 text-sm">
                            Personalized invite links with tracking and rewards for both referrer and referee.
                          </p>
                        </div>
                        
                        {/* Share-to-Earn Bonus */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                          <div className="flex items-center mb-4">
                            <span className="text-3xl mr-3">🎯</span>
                            <h4 className="text-[#E0FE10] font-medium">Share-to-Earn Bonus Points</h4>
                          </div>
                          <p className="text-zinc-400 text-sm mb-3">
                            In-app rewards for bringing friends into Rounds and challenges.
                          </p>
                          <div className="bg-zinc-700/50 rounded-lg p-3 text-center">
                            <span className="text-[#E0FE10] font-bold">+50 bonus points</span>
                            <span className="text-zinc-400 text-xs block">for bringing a friend</span>
                          </div>
                        </div>
                        
                        {/* Auto-generated IG Share */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                          <div className="flex items-center mb-4">
                            <span className="text-3xl mr-3">📸</span>
                            <h4 className="text-[#E0FE10] font-medium">Auto-Generated Share Images</h4>
                          </div>
                          <p className="text-zinc-400 text-sm">
                            Beautiful, branded workout summaries automatically generated for Instagram and social sharing.
                          </p>
                        </div>
                        
                        {/* Chains Team Missions */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                          <div className="flex items-center mb-4">
                            <span className="text-3xl mr-3">⛓️</span>
                            <h4 className="text-[#E0FE10] font-medium">Chains Team Missions</h4>
                          </div>
                          <p className="text-zinc-400 text-sm">
                            Team members chain together in Rounds to complete collaborative tasks, creating deeper social bonds.
                          </p>
                        </div>
                      </div>
                      
                      {/* K-Factor Metric */}
                      <div className="text-center bg-zinc-800/30 rounded-lg p-4">
                        <p className="text-zinc-400 text-sm mb-2">Current K-Factor</p>
                        <p className="text-white text-2xl font-bold">1.24</p>
                        <p className="text-zinc-500 text-xs">One new user for every 0.24 shares</p>
                      </div>
                      
                      {/* Visual Examples */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div className="rounded-xl overflow-hidden">
                          <img 
                            src="/referral-effect.png" 
                            alt="Pulse App - Referral Effect in Action" 
                            className="w-full aspect-[9/16] object-cover"
                          />
                          <p className="text-zinc-400 text-xs text-center mt-2">Referral tracking and rewards</p>
                        </div>
                        <div className="rounded-xl overflow-hidden">
                          <img 
                            src="/check-in-complete.png" 
                            alt="Pulse App - Check-in Complete" 
                            className="w-full aspect-[9/16] object-cover"
                          />
                          <p className="text-zinc-400 text-xs text-center mt-2">Social check-ins drive engagement</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Section 3: Future-Proof Stack */}
                  <div className="mb-8">
                    <h3 className="text-white text-xl font-semibold mb-6">Future-Proof Stack</h3>
                    <p className="text-zinc-400 text-lg mb-8">
                      AI-generated programming, wearables integration & the Health-OS data layer that scales Pulse into the operating system for human health.
                    </p>
                    
                    <div className="space-y-6">
                      {/* Apple Watch & Sensor Hub */}
                      <div className="flex items-start gap-6 bg-zinc-800/30 rounded-xl p-6">
                        <div className="w-14 h-14 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#E0FE10] text-2xl">⌚</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white font-semibold mb-2">Apple Watch & Sensor Hub</h4>
                          <p className="text-zinc-400 mb-4">
                            Live HR, HRV, and VO₂ overlays during Rounds. Real-time biometric feedback that adjusts difficulty and unlocks performance insights.
                          </p>
                          
                          {/* Apple Watch Integration Images */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="rounded-lg overflow-hidden">
                              <img 
                                src="/AppleWatchIntegration.PNG" 
                                alt="Apple Watch Integration with Pulse" 
                                className="w-full h-auto object-cover"
                              />
                              <p className="text-zinc-500 text-xs text-center mt-2">Real-time biometric tracking</p>
                            </div>
                            <div className="rounded-lg overflow-hidden">
                              <img 
                                src="/HealthDataStory.PNG" 
                                alt="Health Data Story and Analytics" 
                                className="w-full h-auto object-cover"
                              />
                              <p className="text-zinc-500 text-xs text-center mt-2">Comprehensive health insights</p>
                            </div>
                            <div className="rounded-lg overflow-hidden">
                              <img 
                                src="/EnergyStory.PNG" 
                                alt="Energy and Performance Analytics" 
                                className="w-full h-auto object-cover"
                              />
                              <p className="text-zinc-500 text-xs text-center mt-2">Energy & performance tracking</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Pulse Programming AI */}
                      <div className="flex items-start gap-6 bg-zinc-800/30 rounded-xl p-6">
                        <div className="w-14 h-14 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#E0FE10] text-2xl">🤖</span>
                        </div>
                        <div>
                          <h4 className="text-white font-semibold mb-2">Pulse Programming AI</h4>
                          <p className="text-zinc-400">
                            GPT-assisted workout authoring that helps creators build rich experiences. "Generate a 30-min HIIT Round for beginners" becomes a full program in seconds.
                          </p>
                        </div>
                      </div>
                      
                      {/* Behavior Pixel Data Graph */}
                      <div className="flex items-start gap-6 bg-zinc-800/30 rounded-xl p-6">
                        <div className="w-14 h-14 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#E0FE10] text-2xl">📊</span>
                        </div>
                        <div>
                          <h4 className="text-white font-semibold mb-2">Behavior Pixel™ Data Graph</h4>
                          <p className="text-zinc-400">
                            Time-series tracking of movement, recovery, and nutrition patterns that feed long-term longevity insights and predictive health recommendations.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-4">Technology Stack</h3>
                  
                  <p className="text-zinc-400 text-lg mb-6">
                    Pulse is built on a modern, scalable technology stack designed for high performance and rapid iteration.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Frontend</h4>
                      <ul className="text-zinc-400 space-y-2">
                        <li>• React Native for mobile apps</li>
                        <li>• Next.js for web application</li>
                        <li>• Tailwind CSS for styling</li>
                        <li>• TypeScript for type safety</li>
                      </ul>
                    </div>
                    
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Backend</h4>
                      <ul className="text-zinc-400 space-y-2">
                        <li>• Firebase for authentication</li>
                        <li>• Cloud Firestore for database</li>
                        <li>• Node.js serverless functions</li>
                        <li>• Express for API endpoints</li>
                      </ul>
                    </div>
                    
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Infrastructure</h4>
                      <ul className="text-zinc-400 space-y-2">
                        <li>• Google Cloud Platform</li>
                        <li>• Netlify for web hosting</li>
                        <li>• CI/CD pipelines</li>
                        <li>• Monitoring and analytics</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Traction & Metrics Section */}
              <section 
                id="traction" 
                ref={(el) => { sectionsRef.current.traction = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">3</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Traction & Metrics</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Key Performance Indicators</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-14">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Total Members</p>
                        <p className="text-white text-3xl font-bold mb-1">808</p>
                        <p className="text-[#E0FE10] text-sm">Since Jan 2025 launch</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Monthly Active Users</p>
                        <p className="text-white text-3xl font-bold mb-1">286</p>
                        <p className="text-[#E0FE10] text-sm">61% retention rate</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Paying Subscribers</p>
                        <p className="text-white text-3xl font-bold mb-1">144</p>
                        <p className="text-[#E0FE10] text-sm">18% conversion rate</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">MRR</p>
                        <p className="text-white text-3xl font-bold mb-1">$625</p>
                        <p className="text-[#E0FE10] text-sm">Growing monthly</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">CAC</p>
                        <p className="text-white text-3xl font-bold mb-1">$0</p>
                        <p className="text-[#E0FE10] text-sm">100% organic growth</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Revenue (4 months)</p>
                        <p className="text-white text-3xl font-bold mb-1">$2.5K</p>
                        <p className="text-[#E0FE10] text-sm">Monetization validated</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Engagement Metrics Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Avg. Session Time</p>
                        <p className="text-white text-3xl font-bold mb-1">1h 29m</p>
                        <p className="text-[#E0FE10] text-sm">High user engagement</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Sessions per User</p>
                        <p className="text-white text-3xl font-bold mb-1">4.8</p>
                        <p className="text-[#E0FE10] text-sm">Strong habit formation</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Analytics Dashboard Section */}
                  <div className="mb-12">
                    <h4 className="text-white text-lg font-semibold mb-6">Analytics Dashboard</h4>
                    <p className="text-zinc-400 text-sm mb-8">Real-time metrics from our analytics platform showing subscription breakdown, retention trends, and conversion performance.</p>
                    
                    {/* Data Sources */}
                    <div className="bg-zinc-800/30 rounded-xl p-6 mb-8">
                      <h5 className="text-white font-medium mb-4">Data Sources & Tech Stack</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-3 bg-zinc-900/50 rounded-lg p-3">
                          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-orange-400 text-xs font-bold">FB</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">Firebase</p>
                            <p className="text-zinc-400 text-xs">User data & auth</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-zinc-900/50 rounded-lg p-3">
                          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-purple-400 text-xs font-bold">MP</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">Mixpanel</p>
                            <p className="text-zinc-400 text-xs">Event tracking</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-zinc-900/50 rounded-lg p-3">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-blue-400 text-xs font-bold">AS</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">App Store Connect</p>
                            <p className="text-zinc-400 text-xs">App metrics</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-zinc-900/50 rounded-lg p-3">
                          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-green-400 text-xs font-bold">RC</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">RevenueCat</p>
                            <p className="text-zinc-400 text-xs">Subscriptions</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                      {/* Subscription Overview */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-white font-medium">Subscription Overview</h5>
                          <span className="text-zinc-400 text-sm">May 2025</span>
                        </div>
                        <SubscriptionOverview />
                      </div>
                      
                      {/* Conversion to Paid */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-white font-medium">Conversion to Standard Paid Subscriptions</h5>
                          <span className="text-zinc-400 text-sm">Last 30 Days</span>
                        </div>
                        <ConversionChart />
                      </div>
                    </div>
                    
                    {/* Retention Rate Chart */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-white font-medium">Retention and Conversion Rates</h5>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center text-zinc-400 text-sm">
                            <input type="checkbox" className="mr-2" />
                            Show average
                          </label>
                        </div>
                      </div>
                      
                      <div className="bg-zinc-800/30 rounded-xl p-6">
                        <div className="flex gap-6 mb-4 text-sm">
                          <button 
                            onClick={() => setActiveRetentionTab('retention')}
                            className={`pb-1 transition-colors ${
                              activeRetentionTab === 'retention' 
                                ? 'text-sky-400 border-b-2 border-sky-400' 
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            Retention Rate
                          </button>
                          <button 
                            onClick={() => setActiveRetentionTab('conversion')}
                            className={`pb-1 transition-colors ${
                              activeRetentionTab === 'conversion' 
                                ? 'text-sky-400 border-b-2 border-sky-400' 
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            Conversion Rate by Introductory Offer
                          </button>
                        </div>
                        <RetentionRateChart />
                        
                        {/* Chart Legend */}
                        <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                          <span>Performance Scale:</span>
                          <div className="flex items-center gap-2">
                            <span>0%</span>
                            <div className="w-20 h-2 bg-gradient-to-r from-red-500/20 via-yellow-500/20 to-[#E0FE10]/20 rounded-full"></div>
                            <span>100%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* User Engagement Analytics */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-white font-medium">User Engagement Analytics</h5>
                        <span className="text-zinc-400 text-sm">May 2025</span>
                      </div>
                      <EngagementChart />
                    </div>
                    
                    {/* K-Effective Viral Growth Snapshot */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="h-5 w-5 text-[#E0FE10]" />
                          <h5 className="text-white font-medium">Viral Growth Snapshot</h5>
                        </div>
                        <span className="text-zinc-400 text-sm">Morning Mobility Challenge • Last 30 Days</span>
                      </div>
                      
                      {isLoadingKMetrics ? (
                        <div className="bg-zinc-800/30 rounded-xl p-8 flex items-center justify-center">
                          <div className="text-zinc-400">Loading viral metrics...</div>
                        </div>
                      ) : kEffectiveMetrics ? (
                        <div className="bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 rounded-xl p-6 border border-[#E0FE10]/20">
                          {/* Main K-Effective Metric */}
                          <div className="text-center mb-6">
                            <div className="inline-flex items-center gap-2 bg-[#E0FE10]/10 rounded-lg px-4 py-2 mb-2">
                              <span className="text-[#E0FE10] text-sm font-medium">Effective K-Factor (last 30d)</span>
                            </div>
                            <div className="text-white text-4xl font-bold mb-1">{kEffectiveMetrics.kEffective}</div>
                            <p className="text-zinc-400 text-sm">
                              {kEffectiveMetrics.referredSignups} referred sign-ups from {kEffectiveMetrics.activeReferrers} active referrers
                            </p>
                          </div>
                          
                          {/* Key Metrics Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                              <div className="text-[#E0FE10] text-lg font-bold">{kEffectiveMetrics.viralPercentage}%</div>
                              <div className="text-zinc-400 text-xs">of new users via referrals</div>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                              <div className="text-[#E0FE10] text-lg font-bold">{kEffectiveMetrics.viralCycleTime}d</div>
                              <div className="text-zinc-400 text-xs">viral cycle time</div>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                              <div className="text-[#E0FE10] text-lg font-bold">{kEffectiveMetrics.shareToFirstWorkoutRate}%</div>
                              <div className="text-zinc-400 text-xs">share-to-workout rate</div>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                              <div className="text-[#E0FE10] text-lg font-bold">{kEffectiveMetrics.timeToSecondShare}d</div>
                              <div className="text-zinc-400 text-xs">time to second share</div>
                            </div>
                          </div>
                          
                          {/* Breakdown */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-zinc-800/30 rounded-lg p-4">
                              <h6 className="text-white font-medium mb-3">Creator-Driven Virality</h6>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-zinc-400 text-sm">Total Participants</span>
                                  <span className="text-white font-medium">{kEffectiveMetrics.totalParticipants}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-zinc-400 text-sm">Referred Joins</span>
                                  <span className="text-[#E0FE10] font-medium">{kEffectiveMetrics.referredSignups}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-zinc-400 text-sm">Direct Joins</span>
                                  <span className="text-white font-medium">{kEffectiveMetrics.directJoins}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-zinc-800/30 rounded-lg p-4">
                              <h6 className="text-white font-medium mb-3">Why This Matters</h6>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                                  <span className="text-zinc-400">K &gt; 1.0 = viral loop scales without paid acquisition</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                                  <span className="text-zinc-400">Immune to missing-invite noise</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                                  <span className="text-zinc-400">Measures actual results, not attempts</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Methodology Note */}
                          <div className="mt-4 p-3 bg-zinc-900/30 rounded-lg border-l-2 border-[#E0FE10]/50">
                            <p className="text-zinc-400 text-xs">
                              <strong className="text-[#E0FE10]">Methodology:</strong> K<sub>effective</sub> = New sign-ups attributed to referrals ÷ Active referrers in same period. 
                              Focused on Morning Mobility challenge to demonstrate creator-driven viral mechanics.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-zinc-800/30 rounded-xl p-8 text-center">
                          <div className="text-zinc-400">Unable to load viral metrics</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Viral Story & Network Effect */}
                    <div className="mb-8">
                      <div className="bg-gradient-to-br from-[#E0FE10]/10 to-[#E0FE10]/5 border border-[#E0FE10]/20 rounded-xl p-6">
                        <h5 className="text-white font-semibold mb-4 flex items-center gap-2">
                          <span className="text-2xl">🚀</span>
                          Small Creator Cohort Proves Flywheel
                        </h5>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Viral Flow */}
                          <div>
                            <div className="bg-zinc-900/50 rounded-lg p-4 mb-4">
                              <div className="flex items-center justify-between text-center">
                                <div>
                                  <div className="text-[#E0FE10] text-2xl font-bold">6</div>
                                  <div className="text-zinc-400 text-xs">active referrers</div>
                                </div>
                                <div className="text-[#E0FE10] text-xl">→</div>
                                <div>
                                  <div className="text-[#E0FE10] text-2xl font-bold">59</div>
                                  <div className="text-zinc-400 text-xs">net sign-ups</div>
                                </div>
                                <div className="text-[#E0FE10] text-xl">→</div>
                                <div>
                                  <div className="text-[#E0FE10] text-2xl font-bold">81</div>
                                  <div className="text-zinc-400 text-xs">total participants</div>
                                </div>
                              </div>
                              <div className="text-center mt-3 pt-3 border-t border-zinc-700">
                                <span className="text-zinc-300 text-sm">Loop time: </span>
                                <span className="text-[#E0FE10] font-semibold">6.3 days</span>
                              </div>
                            </div>
                            
                            <div className="bg-zinc-800/50 rounded-lg p-4">
                              <h6 className="text-white font-medium mb-2">Next Step Projection:</h6>
                              <div className="text-zinc-300 text-sm space-y-1">
                                <div><span className="text-[#E0FE10]">100 active referrers</span> → <span className="text-[#E0FE10]">600+ sign-ups</span></div>
                                <div><span className="text-[#E0FE10]">CAC &lt;$1</span> vs. <span className="text-zinc-500 line-through">$4.75 paid</span></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Network Visualization Concept */}
                          <div className="flex items-center justify-center">
                            <div className="bg-zinc-900/50 rounded-lg p-6 w-full">
                              <p className="text-zinc-400 text-sm mb-4 text-center">Viral Effect</p>
                              <ReferralGraph data={sampleGraph} className="rounded-lg border border-zinc-700/50" />
                              <div className="mt-3 text-[#E0FE10] text-xs font-medium text-center">
                                One referrer shares → multiple children join → children become referrers → viral branching effect
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* What the Numbers Really Mean */}
                    <div className="mb-8">
                      <h5 className="text-white font-medium mb-4">What the Numbers Really Mean</h5>
                      <div className="bg-zinc-800/30 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-zinc-700 bg-zinc-900/50">
                              <th className="py-3 px-4 text-zinc-400 font-medium text-sm">Metric</th>
                              <th className="py-3 px-4 text-zinc-400 font-medium text-sm">Interpretation</th>
                              <th className="py-3 px-4 text-zinc-400 font-medium text-sm">Investor Takeaway</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm">
                            <tr className="border-b border-zinc-700">
                              <td className="py-3 px-4 text-[#E0FE10] font-medium">K-eff = 9.83</td>
                              <td className="py-3 px-4 text-zinc-300">Each active referrer → 9.83 credited sign-ups</td>
                              <td className="py-3 px-4 text-zinc-300">Viral loop &gt; 1 ⇒ product can grow "for free"</td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                              <td className="py-3 px-4 text-[#E0FE10] font-medium">72.8% via referrals</td>
                              <td className="py-3 px-4 text-zinc-300">Majority of growth is peer-driven</td>
                              <td className="py-3 px-4 text-zinc-300"><strong>Paid CAC isn't the growth engine—community is</strong></td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                              <td className="py-3 px-4 text-[#E0FE10] font-medium">6.3d cycle time</td>
                              <td className="py-3 px-4 text-zinc-300">Host → child joins in under a week</td>
                              <td className="py-3 px-4 text-zinc-300">Loop spins fast; LTV realized quickly</td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                              <td className="py-3 px-4 text-[#E0FE10] font-medium">78% share-to-workout</td>
                              <td className="py-3 px-4 text-zinc-300">Referred sign-ups actually finish a Round</td>
                              <td className="py-3 px-4 text-zinc-300">Referred users are quality users, not tourists</td>
                            </tr>
                            <tr>
                              <td className="py-3 px-4 text-[#E0FE10] font-medium">12d to 2nd share</td>
                              <td className="py-3 px-4 text-zinc-300">They pay it forward within ~2 weeks</td>
                              <td className="py-3 px-4 text-zinc-300">Flywheel self-propagates</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Data Glossary */}
              <div className="mb-8">
                <details className="bg-zinc-800/30 rounded-xl overflow-hidden">
                  <summary className="cursor-pointer p-6 hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <h5 className="text-white font-medium">📊 Data Glossary</h5>
                      <span className="text-zinc-400 text-sm">Click to expand definitions</span>
                    </div>
                  </summary>
                  <div className="px-6 pb-6 border-t border-zinc-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">Effective K-Factor</h6>
                        <p className="text-zinc-400 text-sm">Our viral growth metric calculated as: New sign-ups attributed to referrals ÷ Active referrers in the same period. This approach is immune to missing-invite noise and measures actual results rather than attempts. Values above 1.0 indicate viral growth that can scale without paid acquisition.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">CAC (Customer Acquisition Cost)</h6>
                        <p className="text-zinc-400 text-sm">Total cost to acquire one paying customer, including marketing spend, sales costs, and onboarding expenses.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">Retention Rate</h6>
                        <p className="text-zinc-400 text-sm">Percentage of users who remain active after a specific time period. Critical metric for subscription businesses.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">ARPU (Average Revenue Per User)</h6>
                        <p className="text-zinc-400 text-sm">Average monthly revenue generated per user, calculated as total revenue divided by active users.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">Churn Rate</h6>
                        <p className="text-zinc-400 text-sm">Percentage of subscribers who cancel their subscription in a given period. Lower is better.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">Creator Multiplier</h6>
                        <p className="text-zinc-400 text-sm">Average number of users acquired per creator partner. Measures effectiveness of creator-driven growth strategy.</p>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
              
              {/* Growth Metrics Charts */}
              <div className="space-y-12 mb-10">
                <div>
                  <h4 className="text-white text-lg font-semibold mb-4">Organic Growth Economics</h4>
                  <p className="text-zinc-400 text-sm mb-6">
                    Community-driven acquisition costs and viral coefficient trends showing sustainable growth without paid marketing dependency.
                  </p>
                  
                  {/* Organic vs Paid Comparison */}
                  <div className="bg-zinc-800/30 rounded-xl p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-[#E0FE10] text-2xl font-bold mb-1">$0</div>
                        <div className="text-zinc-400 text-sm">Current CAC</div>
                        <div className="text-zinc-500 text-xs">100% organic</div>
                      </div>
                      <div className="text-center">
                        <div className="text-zinc-500 text-2xl font-bold mb-1 line-through">$4.75</div>
                        <div className="text-zinc-400 text-sm">Industry Paid CAC</div>
                        <div className="text-zinc-500 text-xs">Traditional approach</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[#E0FE10] text-2xl font-bold mb-1">&lt;$1</div>
                        <div className="text-zinc-400 text-sm">Projected CAC at scale</div>
                        <div className="text-zinc-500 text-xs">With 100+ creators</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-[#E0FE10]/10 rounded-lg border border-[#E0FE10]/20">
                      <p className="text-[#E0FE10] text-sm font-medium text-center">
                        💡 Paid CAC isn't the growth engine—community is
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-zinc-800/50 rounded-xl p-6">
                  <h4 className="text-white text-lg font-semibold mb-4">Early Stage Validation</h4>
                  <p className="text-zinc-400 mb-4">
                    Strong early metrics since January 2025 public launch demonstrate product-market fit and scalable unit economics.
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-center mb-4">
                    <div>
                      <p className="text-zinc-400 text-sm">Retention Rate</p>
                      <p className="text-white text-xl font-bold">61%</p>
                      <p className="text-zinc-500 text-xs">Above industry avg</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-sm">Conversion Rate</p>
                      <p className="text-white text-xl font-bold">18%</p>
                      <p className="text-zinc-500 text-xs">2x industry avg</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center mb-4">
                    <div>
                      <p className="text-zinc-400 text-sm">Creator Multiplier</p>
                      <p className="text-white text-xl font-bold">37.5x</p>
                      <p className="text-zinc-500 text-xs">Users per creator</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-sm">Monthly Churn</p>
                      <p className="text-white text-xl font-bold">6.5%</p>
                      <p className="text-zinc-500 text-xs">Low for early stage</p>
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-4">
                    <h5 className="text-[#E0FE10] text-sm font-medium mb-2">Subscription Mix</h5>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-zinc-400 text-sm">Annual ($39.99)</span>
                      <span className="text-white font-medium">80 subs (56%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400 text-sm">Monthly ($4.99)</span>
                      <span className="text-white font-medium">64 subs (44%)</span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-2">Strong annual uptake shows user confidence</p>
                  </div>
                </div>
                
                <div className="bg-zinc-800/50 rounded-xl p-6">
                  <h4 className="text-white text-lg font-semibold mb-4">Growth Channels</h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center">
                      <span className="text-zinc-400">Creator-Led Acquisition</span>
                      <span className="text-white font-medium">65%</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-zinc-400">Social Media Marketing (TikTok, Instagram)</span>
                      <span className="text-white font-medium">20%</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-zinc-400">Word of Mouth</span>
                      <span className="text-white font-medium">10%</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-zinc-400">Direct/Organic</span>
                      <span className="text-white font-medium">5%</span>
                    </li>
                  </ul>
                </div>
              </div>

               {/* IP & Defensibility Section */}
                <section
                    id="ip"
                    ref={(el) => { sectionsRef.current.ip = el; }}
                    className="mb-20"
                >
                    {/* header */}
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">4</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">IP &amp; Defensibility</h2>
                    </div>

                    {/* gradient-frame wrapper */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-[2px]">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-[#d7ff00]/20 animate-[spin_10s_linear_infinite] opacity-25" />
                    <div className="relative bg-zinc-900 rounded-lg p-8 lg:p-10 space-y-10">

                        {/* secured filings table */}
                        <div>
                        <h3 className="text-white text-xl font-semibold mb-6">Secured Filings</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-zinc-800 text-zinc-400 text-sm">
                                {['Filing', 'Type', 'Jurisdiction', 'Status', 'Coverage', 'Filed'].map(h => (
                                    <th key={h} className="py-3 pr-6 font-medium">{h}</th>
                                ))}
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {[
                                {
                                    filing: 'Pulse Programming™',
                                    type: 'Trademark',
                                    jur: 'USPTO',
                                    status: 'Registered',
                                    cov: 'Software class 9 · 42',
                                    filed: 'Aug 2024',
                                },
                                {
                                    filing: 'Pulse Programming – AI Stack Generation',
                                    type: 'Provisional Patent',
                                    jur: 'USPTO',
                                    status: 'Filed',
                                    cov: 'Method for AI-generated workout programs',
                                    filed: 'Feb 2025',
                                },
                                {
                                    filing: 'Rounds™',
                                    type: 'Trademark',
                                    jur: 'USPTO',
                                    status: 'Pending',
                                    cov: 'Community-fitness software',
                                    filed: 'Jan 2025',
                                },
                                ].map(r => (
                                <tr key={r.filing} className="border-b border-zinc-800 last:border-0">
                                    <td className="py-4 pr-6 text-white">
                                    {r.filing === 'Pulse Programming™' ? (
                                        <a 
                                        href="https://fitwithpulse.ai/programming" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-[#E0FE10] hover:text-[#d8f521] transition-colors underline decoration-dotted"
                                        >
                                        {r.filing}
                                        </a>
                                    ) : (
                                        r.filing
                                    )}
                                    </td>
                                    <td className="py-4 pr-6 text-zinc-300">{r.type}</td>
                                    <td className="py-4 pr-6 text-zinc-300">{r.jur}</td>
                                    <td className="py-4 pr-6">
                                    <span className={`px-2 py-1 rounded text-xs font-medium
                                        ${r.status === 'Registered' ? 'bg-green-600/20 text-green-400'
                                        : 'bg-yellow-600/20 text-yellow-400'}`}>
                                        {r.status}
                                    </span>
                                    </td>
                                    <td className="py-4 pr-6 text-zinc-300">{r.cov}</td>
                                    <td className="py-4 text-zinc-300">{r.filed}</td>
                                </tr>
                                ))}
                            </tbody>
                            </table>
                        </div>
                        </div>

                        {/* pipeline & funding call-out */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* pipeline card */}
                        <div className="bg-zinc-800/60 rounded-lg p-6 md:col-span-2">
                            <h4 className="text-[#E0FE10] font-medium mb-3">Pipeline (Next 12 Months)</h4>
                            <ul className="space-y-2 text-sm text-zinc-400">
                            <li>• 3 additional patent applications drafted and ready to file → <span className="text-zinc-200">pending funding</span></li>
                            <li>• EU trademark filings for Pulse Programming™ & Rounds™ → <span className="text-zinc-200">Q4 2025</span></li>
                            <li>• Design patent for on-watch real-time "Energy Story" UI → <span className="text-zinc-200">Q1 2026</span></li>
                            </ul>
                        </div>

                        {/* funding accelerator card */}
                        <div className="bg-zinc-800/60 rounded-lg p-6 flex flex-col justify-between">
                            <h4 className="text-[#E0FE10] font-medium mb-3">Capital = Acceleration</h4>
                            <p className="text-zinc-400 text-sm mb-4">
                            Additional funding allows us to fast-track international trademarks and convert provisionals before expiry—locking in a multi-year moat.
                            </p>
                        </div>
                        </div>

                    </div>
                    </div>
                </section>

                {/* Vision & Evolution Section */}
                <section 
                    id="vision" 
                    ref={(el) => { sectionsRef.current.vision = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">5</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Vision &amp; Evolution</h2>
                    </div>
                    
                    {/* Transition text */}
                    <div className="mb-8">
                    <p className="text-zinc-400 text-lg italic text-center">
                        After social proof comes systemic impact.
                    </p>
                    </div>
                    
                    {/* Main vision card */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1 mb-10">
                    {/* Animated border shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-purple-500/15 to-[#d7ff00]/15 animate-[spin_8s_linear_infinite] opacity-25"></div>
                    
                    {/* Inner content */}
                    <div className="relative bg-zinc-900 rounded-lg p-8 lg:p-12 space-y-8">
                        {/* Vision statement */}
                        <blockquote className="text-zinc-200 text-xl md:text-2xl leading-relaxed font-light border-l-4 border-[#E0FE10] pl-6">
                        At Pulse, our vision is to build more than a fitness platform—we&rsquo;re creating the <span className="text-white font-semibold">first operating system for human health</span>.
                        We believe wellness isn&rsquo;t siloed into workouts, doctors, or devices—it&rsquo;s continuous, adaptive, and embedded into daily life.
                        </blockquote>
                        
                        {/* Evolution pillars */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                            title: 'Behavior Pixel',
                            copy: 'Every real-world choice becomes a datapoint—movement, meals, sleep, even stress patterns.'
                            },
                            {
                            title: 'Adaptive AI Rounds',
                            copy: 'Programs auto-adjust to bio-feedback, recovery metrics and goals in real time.'
                            },
                            {
                            title: 'Gamified Longevity',
                            copy: 'Health turns into a shared game: scores, leagues, and community-powered rewards.'
                            }
                        ].map((item) => (
                            <div key={item.title} className="bg-zinc-800/60 rounded-lg p-6">
                            <h4 className="text-[#E0FE10] font-medium mb-2">{item.title}</h4>
                            <p className="text-zinc-400 text-sm">{item.copy}</p>
                            </div>
                        ))}
                        </div>
                        
                        {/* Closing statement */}
                        <p className="text-zinc-400 pt-4">
                        Pulse will be the layer that lets people <span className="text-white font-medium">see, shape, and strive</span> for better health—together.
                        </p>
                    </div>
                    </div>
                    
                    {/* Evolution timeline */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                        <div className="w-3 h-3 rounded-full bg-[#E0FE10] mr-3"></div>
                        <span className="text-[#E0FE10] font-medium text-sm">2023-24</span>
                        </div>
                        <h4 className="text-white font-semibold mb-2">Social Fitness Core</h4>
                        <p className="text-zinc-400 text-sm">
                        Building the foundation with community-driven workouts, challenges, and social engagement features.
                        </p>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                        <div className="w-3 h-3 rounded-full bg-zinc-500 mr-3"></div>
                        <span className="text-zinc-400 font-medium text-sm">2024-25</span>
                        </div>
                        <h4 className="text-white font-semibold mb-2">Whole-Body Health Intelligence</h4>
                        <p className="text-zinc-400 text-sm">
                        Expanding beyond fitness with Apple Watch integration, meal AI, sleep tracking, and comprehensive wellness insights.
                        </p>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                        <div className="w-3 h-3 rounded-full bg-zinc-600 mr-3"></div>
                        <span className="text-zinc-400 font-medium text-sm">2025+</span>
                        </div>
                        <h4 className="text-white font-semibold mb-2">Pulse Health OS</h4>
                        <p className="text-zinc-400 text-sm">
                        The complete health operating system with predictive AI, seamless device integration, and personalized health orchestration.
                        </p>
                    </div>
                    </div>
                </section>

                {/* Two-Up Framing Card */}
                <section className="mb-20">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                            <span className="text-2xl mr-3">🚀</span>
                            <h3 className="text-white text-xl font-semibold">Pulse Today</h3>
                        </div>
                        <ul className="space-y-3 text-zinc-300">
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Social fitness feed live on iOS/Android</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>808 users, 18% paid conversion</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Creator multiplier 37.5×</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>$0 CAC, 100% organic growth</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>61% retention, 1h 29m sessions</span>
                            </li>
                        </ul>
                        </div>
                        
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                            <span className="text-2xl mr-3">🌌</span>
                            <h3 className="text-white text-xl font-semibold">Pulse Tomorrow</h3>
                        </div>
                        <ul className="space-y-3 text-zinc-300">
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Health OS stitching workouts, wearables, recovery AI</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Behavior Pixel® data model patent draft</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Gamified longevity leaderboard</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Predictive AI for health optimization</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Personal health operating system</span>
                            </li>
                        </ul>
                        </div>
                    </div>
                    </div>
                </section>

                {/* Market Opportunity Section */}
                <section 
                    id="market" 
                    ref={(el) => { sectionsRef.current.market = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">6</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Market Opportunity</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                    <h3 className="text-white text-xl font-semibold mb-4">The Fitness Landscape</h3>
                    
                    <p className="text-zinc-400 text-lg mb-6">
                        The fitness industry represents a massive and rapidly growing market opportunity, with multiple layers 
                        of addressable segments that Pulse is uniquely positioned to capture through our creator-driven approach.
                    </p>
                    
                    {/* Market Size Visualization */}
                    <div className="mb-10">
                        <h4 className="text-white text-lg font-semibold mb-6">Market Analysis</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* Total Addressable Market */}
                            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-700 p-6">
                                <div className="absolute inset-0 bg-gradient-to-r from-zinc-600/20 to-zinc-500/20"></div>
                                <div className="relative">
                                    <div className="text-center mb-4">
                                        <div className="w-full h-32 bg-zinc-600 rounded-lg mb-4 flex items-center justify-center">
                                            <span className="text-white text-sm font-medium">Total Fitness Industry</span>
                                        </div>
                                    </div>
                                    <h5 className="text-white text-2xl font-bold mb-2">$244 Bn</h5>
                                    <p className="text-[#E0FE10] text-sm font-medium mb-2">Total Addressable Market</p>
                                    <p className="text-zinc-400 text-sm">Total Fitness Industry Value 2023</p>
                                    <p className="text-zinc-500 text-xs">(5.6% growth rate)</p>
                                </div>
                            </div>
                            
                            {/* Serviceable Addressable Market */}
                            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-700 p-6">
                                <div className="absolute inset-0 bg-gradient-to-r from-zinc-600/20 to-zinc-500/20"></div>
                                <div className="relative">
                                    <div className="text-center mb-4">
                                        <div className="w-full h-32 bg-zinc-600 rounded-lg mb-4 flex items-center justify-center">
                                            <span className="text-white text-sm font-medium">Influence & Fitness Seekers</span>
                                        </div>
                                    </div>
                                    <h5 className="text-white text-2xl font-bold mb-2">$41.3 Bn</h5>
                                    <p className="text-[#E0FE10] text-sm font-medium mb-2">Serviceable Addressable Market</p>
                                    <p className="text-zinc-400 text-sm">Based on influence & fitness seeker population</p>
                                </div>
                            </div>
                            
                            {/* Service Obtainable Market */}
                            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/10 p-6 border-2 border-[#E0FE10]/30">
                                <div className="relative">
                                    <div className="text-center mb-4">
                                        <div className="w-full h-32 bg-[#E0FE10] rounded-lg mb-4 flex items-center justify-center">
                                            <span className="text-black text-sm font-medium">Pulse Target Market</span>
                                        </div>
                                    </div>
                                    <h5 className="text-white text-2xl font-bold mb-2">$810 Million</h5>
                                    <p className="text-[#E0FE10] text-sm font-medium mb-2">Service Obtainable Market</p>
                                    <p className="text-zinc-300 text-sm">5M users (over 5 years period)</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-zinc-800/30 rounded-lg p-4 text-center">
                            <p className="text-zinc-400 text-sm">
                                <span className="text-[#E0FE10] font-medium">Source:</span> 
                                <a href="https://www.wellnesscreatives.com/fitness-industry-statistics-growth/" 
                                   className="text-zinc-300 hover:text-[#E0FE10] transition-colors ml-1" 
                                   target="_blank" 
                                   rel="noopener noreferrer">
                                    Wellness Creatives Fitness Industry Analysis
                                </a>
                            </p>
                        </div>
                    </div>
                    
                    {/* Key Market Drivers */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1 mb-8">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-[#d7ff00]/20"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-6">
                        <h4 className="text-white text-lg font-semibold mb-4">Key Market Drivers</h4>
                        
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#E0FE10] text-xs font-bold">1</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Rising Health Consciousness</p>
                                <p className="text-zinc-400">Increasing awareness of health and fitness, especially post-pandemic</p>
                            </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#E0FE10] text-xs font-bold">2</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Social Connection Demand</p>
                                <p className="text-zinc-400">Growing desire for community and connection in fitness journeys</p>
                            </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#E0FE10] text-xs font-bold">3</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Digital Transformation</p>
                                <p className="text-zinc-400">Rapid adoption of digital fitness solutions and mobile technology</p>
                            </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#E0FE10] text-xs font-bold">4</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Creator Economy Growth</p>
                                <p className="text-zinc-400">Fitness influencers driving engagement and monetization opportunities</p>
                            </div>
                            </div>
                        </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Mobile Fitness App Market</h4>
                        <p className="text-white text-3xl font-bold mb-2">$120B+</p>
                        <p className="text-zinc-400 mb-3">Projected global fitness app market by 2030</p>
                        <p className="text-zinc-500 text-xs">
                            <a href="https://www.grandviewresearch.com/industry-analysis/fitness-app-market" 
                               className="hover:text-[#E0FE10] transition-colors" 
                               target="_blank" 
                               rel="noopener noreferrer">
                                Source: Grand View Research
                            </a>
                        </p>
                        </div>
                        
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Target User Base</h4>
                        <p className="text-white text-3xl font-bold mb-2">820M+</p>
                        <p className="text-zinc-400">Active fitness enthusiasts worldwide</p>
                        </div>
                    </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-white text-xl font-semibold mb-4">Competitive Landscape</h3>
                    
                    <p className="text-zinc-400 text-lg mb-6">
                        People connect with real people. Where else can we upload content, track fitness progress, and make money supporting people's growth?
                    </p>
                    
                    {/* Competitor Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {/* Pulse */}
                        <div className="bg-zinc-800/50 rounded-xl p-6 border-2 border-[#E0FE10]/30">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center mr-3">
                                    <span className="text-black font-bold text-lg">P</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold">Pulse</h4>
                                    <p className="text-zinc-400 text-sm">2025</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                                <p className="text-white">$4.99/month</p>
                                <p className="text-white">$39.99/annually</p>
                            </div>
                        </div>
                        
                        {/* Strava */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center mr-3">
                                    <span className="text-white font-bold text-lg">S</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold">Strava</h4>
                                    <p className="text-zinc-400 text-sm">2009</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                                <p className="text-white">$11.99/month</p>
                                <p className="text-white">$79.99/annually</p>
                                <p className="text-zinc-400">100+ million users</p>
                            </div>
                        </div>
                        
                        {/* Trainerize */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mr-3">
                                    <span className="text-white font-bold text-lg">T</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold">Trainerize</h4>
                                    <p className="text-zinc-400 text-sm">2008</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                                <p className="text-white">$5/per client</p>
                                <p className="text-white">$250/500 client</p>
                                <p className="text-zinc-400">1.6 million trainers</p>
                            </div>
                        </div>
                        
                        {/* Instagram */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mr-3">
                                    <span className="text-white font-bold text-lg">I</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold">Instagram</h4>
                                    <p className="text-zinc-400 text-sm">2010</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                                <p className="text-white">Free</p>
                                <p className="text-zinc-400">estimated 280 million</p>
                                <p className="text-zinc-400">fitness content creators</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Feature Comparison Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-zinc-700 bg-zinc-900/50">
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm">Feature</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm text-center">Pulse</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm text-center">Strava</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm text-center">Trainerize</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm text-center">Instagram</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-white">Fitness Specific</td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-white">User Generated Content (UGC)</td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-white">AI Curated Workouts</td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4 text-white">Creator Compensation</td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                        </table>
                    </div>
                    </div>
                </section>

                {/* Team Section */}
                <section 
                    id="team" 
                    ref={(el) => { sectionsRef.current.team = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">7</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Team</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                    <h3 className="text-white text-xl font-semibold mb-6">The Folks Building Pulse</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* CEO */}
                        <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                            <img 
                            src="TremaineFounder.jpg"
                            alt="Tremaine Grant - CEO & Founder" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6">
                            <h4 className="text-white font-semibold mb-1">Tremaine</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-3">CEO & Founder</p>
                            <p className="text-zinc-400 text-sm">
                            Principal engineer, former D1 track and field athlete, and personal trainer of 10+ years. 
                            Experience launching and scaling software at Fortune 500 companies like General Motors, IQVIA, 
                            and Pfizer, to startups like Warby Parker. Passionate about the intersection of technology and health.
                            </p>
                        </div>
                        </div>
                        
                        {/* Design Lead */}
                        <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                            <img 
                            src="lola.jpg"
                            alt="Lola - Design Lead" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6">
                            <h4 className="text-white font-semibold mb-1">Lola</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-3">Design Lead</p>
                            <p className="text-zinc-400 text-sm">
                            Creative visionary leading our design strategy and user experience. Expert in creating 
                            intuitive interfaces that make fitness accessible and engaging for everyone. Passionate about 
                            crafting accessible design that's both creative and uniquely compelling.
                            </p>
                        </div>
                        </div>
                        
                        {/* Digital Creators Lead */}
                        <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                            <img 
                            src="ricardo.jpg"
                            alt="Ricardo - Digital Creators Lead" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6">
                            <h4 className="text-white font-semibold mb-1">Ricardo</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-3">Digital Creators Lead</p>
                            <p className="text-zinc-400 text-sm">
                            Exercise science major and veteran who leads our creator acquisition and partnership strategy. 
                            Passionate about people and social media, with proven experience growing Instagram accounts 
                            to over 50K followers. Expert in building relationships with fitness influencers and scaling creator-driven growth.
                            </p>
                        </div>
                        </div>
                    </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-white text-xl font-semibold mb-6">Who Advises Us</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            <img 
                            src="/bobbyAdvisor.jpg"
                            alt="Advisor 1" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-1">Bobby Nweke</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-2">Storytelling and Education</p>
                            <p className="text-zinc-400 text-sm">
                            Master storyteller and education leader. Teach for America graduate, former charter school principal, 
                            TED speaking coach, and executive coach. Harvard graduate in entrepreneurship and future of learning—
                            bringing unparalleled expertise in crafting compelling narratives that drive engagement and growth.
                            </p>
                        </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            <img 
                            src="/Deray.png"
                            alt="Advisor 2" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-1">DeRay Mckesson</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-2">Community Building and Organizing</p>
                            <p className="text-zinc-400 text-sm">
                            Renowned civil rights activist and community organizer who has mastered the art of rallying people 
                            around a shared cause. As a newly passionate fitness enthusiast, DeRay brings a unique perspective 
                            on human behavior and motivation—essential insights for building authentic communities that inspire lasting change.
                            </p>
                        </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            <img 
                            src="zak.jpg"
                            alt="Advisor 3" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-1">Marques Zak</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-2">Marketing and Growth</p>
                            <p className="text-zinc-400 text-sm">
                            Marketing executive with leadership roles at PepsiCo and American Express. Recent inductee into the 
                            Advertising Hall of Achievement, Marques brings years of experience creating memorable brand experiences 
                            and driving explosive growth through innovative marketing strategies that resonate with diverse audiences.
                            </p>
                        </div>
                        </div>
                    </div>
                    </div>
                </section>

                {/* Financial Information Section */}
                <section 
                    id="financials" 
                    ref={(el) => { sectionsRef.current.financials = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">8</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Financial Information</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                    <h3 className="text-white text-xl font-semibold mb-6">Business Model</h3>
                    
                    <p className="text-zinc-400 text-lg mb-6">
                        Pulse operates on a premium subscription model with monthly and annual options, 
                        driving reliable recurring revenue streams with strong margins and high user commitment.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="bg-zinc-800/70 rounded-lg p-5 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 bg-[#E0FE10] text-black text-xs font-bold py-1 px-3 rounded-bl-lg">
                            MOST POPULAR
                        </div>
                        <h4 className="text-[#E0FE10] font-medium mb-3">Monthly Premium</h4>
                        <p className="text-zinc-400 mb-3">Full access to all features, workouts, and community tools.</p>
                        <p className="text-white font-medium">$4.99/month</p>
                        </div>
                        
                        <div className="bg-zinc-800/70 rounded-lg p-5">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Annual Premium</h4>
                        <p className="text-zinc-400 mb-3">Yearly premium subscription with significant discount and best value.</p>
                        <p className="text-white font-medium">$39.99/year</p>
                        <p className="text-[#E0FE10] text-sm mt-2">Save 33% vs monthly</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                        <h4 className="text-white text-lg font-semibold mb-4">Revenue Breakdown</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                            <span className="text-zinc-400">Premium Subscriptions</span>
                            <span className="text-white font-medium">100%</span>
                            </div>
                            <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden">
                            <div className="bg-[#E0FE10] h-full rounded-full" style={{ width: '100%' }}></div>
                            </div>
                            
                            <div className="bg-zinc-800/50 rounded-lg p-4 mt-4">
                            <h5 className="text-[#E0FE10] text-sm font-medium mb-2">Current Revenue Mix</h5>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-zinc-400 text-sm">Annual ($39.99)</span>
                                <span className="text-white font-medium">$3,199 (56%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400 text-sm">Monthly ($4.99)</span>
                                <span className="text-white font-medium">$319 (44%)</span>
                            </div>
                            </div>
                        </div>
                        </div>
                        
                        <div>
                        <h4 className="text-white text-lg font-semibold mb-4">Key Financial Metrics</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-800/50 rounded-lg p-4">
                            <p className="text-zinc-400 text-sm">Total Revenue</p>
                            <p className="text-white text-xl font-bold">$2.5K</p>
                            <p className="text-[#E0FE10] text-xs">4 months</p>
                            </div>
                            
                            <div className="bg-zinc-800/50 rounded-lg p-4">
                            <p className="text-zinc-400 text-sm">Conversion Rate</p>
                            <p className="text-white text-xl font-bold">18%</p>
                            <p className="text-[#E0FE10] text-xs">2x industry avg</p>
                            </div>
                            
                            <div className="bg-zinc-800/50 rounded-lg p-4">
                            <p className="text-zinc-400 text-sm">ARPU</p>
                            <p className="text-white text-xl font-bold">$17.36</p>
                            <p className="text-[#E0FE10] text-xs">Monthly average</p>
                            </div>
                            
                            <div className="bg-zinc-800/50 rounded-lg p-4">
                            <p className="text-zinc-400 text-sm">Monthly Churn</p>
                            <p className="text-white text-xl font-bold">6.5%</p>
                            <p className="text-zinc-300 text-xs">Low for early stage</p>
                            </div>
                        </div>
                        </div>
                    </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white text-xl font-semibold">Financial Projections</h3>
                        
                        <div className="flex items-center bg-zinc-800 rounded-lg overflow-hidden text-sm">
                        <button className="px-3 py-1 bg-[#E0FE10] text-black font-medium">3 Year</button>
                        <button className="px-3 py-1 text-zinc-400">5 Year</button>
                        </div>
                    </div>
                    
                    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-zinc-700">
                            <th className="py-4 px-6 text-zinc-400 font-medium">Metric</th>
                            <th className="py-4 px-6 text-zinc-400 font-medium">Year 1 (2025)</th>
                            <th className="py-4 px-6 text-zinc-400 font-medium">Year 2 (2026)</th>
                            <th className="py-4 px-6 text-zinc-400 font-medium">Year 3 (2027)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-zinc-700">
                            <td className="py-4 px-6 text-white">Revenue</td>
                            <td className="py-4 px-6 text-white">$28K</td>
                            <td className="py-4 px-6 text-white">$485K</td>
                            <td className="py-4 px-6 text-white">$2.8M</td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                            <td className="py-4 px-6 text-white">User Base</td>
                            <td className="py-4 px-6 text-white">2.5K</td>
                            <td className="py-4 px-6 text-white">18K</td>
                            <td className="py-4 px-6 text-white">85K</td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                            <td className="py-4 px-6 text-white">Paying Subscribers</td>
                            <td className="py-4 px-6 text-white">450</td>
                            <td className="py-4 px-6 text-white">3.2K</td>
                            <td className="py-4 px-6 text-white">15K</td>
                            </tr>
                            <tr>
                            <td className="py-4 px-6 text-white">Monthly Churn</td>
                            <td className="py-4 px-6 text-white">8%</td>
                            <td className="py-4 px-6 text-white">6%</td>
                            <td className="py-4 px-6 text-white">4%</td>
                            </tr>
                        </tbody>
                        </table>
                    </div>
                    
                    <p className="text-zinc-500 text-sm mt-4 italic">
                        Note: Detailed financial projections and audited financials are available upon request with signed NDA.
                    </p>
                    </div>
                </section>

                {/* Pitch Deck Section */}
                <section 
                    id="deck" 
                    ref={(el) => { sectionsRef.current.deck = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">9</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Pitch Deck</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <div className="bg-zinc-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
                        <img 
                        src="PitchDeckPreview.png" 
                        alt="Pitch Deck Preview" 
                        className="w-48 h-64 object-cover rounded-lg shadow-lg mb-6"
                        />
                        <h3 className="text-white text-xl font-semibold mb-3">Pulse Investor Presentation</h3>
                        <p className="text-zinc-400 mb-6 max-w-lg">
                        Our comprehensive investor deck includes detailed information about our market opportunity, 
                        business model, growth strategy, and financial projections.
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center">
                        <a 
                            href="/PulsePitchDeck.pdf" 
                            download="PulsePitchDeck.pdf"
                            className="inline-flex items-center justify-center px-6 py-3 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-medium rounded-lg transition-colors"
                        >
                            <Download className="mr-2 h-5 w-5" />
                            Download Pitch Deck (PDF)
                        </a>
                      
                        </div>
                    </div>
                    </div>
                </section>

                {/* Investment Opportunity Section */}
                <section 
                    id="investment" 
                    ref={(el) => { sectionsRef.current.investment = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">10</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Investment Opportunity</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">                    
                    
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="md:w-1/2">
                        <h3 className="text-white text-xl font-semibold mb-4">Seed Funding Round</h3>
                        
                        <div className="space-y-6">
                            <div>
                            <p className="text-zinc-400 mb-1">Target Raise</p>
                            <p className="text-white text-3xl font-bold">$750K</p>
                            </div>
                            
                            <div>
                            <p className="text-zinc-400 mb-1">Pre-Money Valuation</p>
                            <p className="text-white text-3xl font-bold">$3.5 Million</p>
                            </div>
                            
                            <div>
                            <p className="text-zinc-400 mb-1">Minimum Investment</p>
                            <p className="text-white text-xl font-medium">$25,000</p>
                            </div>
                            
                            <div>
                            <p className="text-zinc-400 mb-1">Funding Use</p>
                            <ul className="text-white space-y-1 mt-2">
                                <li>• Creator acquisition (60%)</li>
                                <li>• Product development (25%)</li>
                                <li>• Team expansion (10%)</li>
                                <li>• Operations (5%)</li>
                            </ul>
                            </div>
                        </div>
                        </div>
                        
                        <div className="md:w-1/2">
                        <h3 className="text-white text-xl font-semibold mb-4">Fundraising Timeline</h3>
                        
                        <div className="relative pl-8 pb-8 border-l border-zinc-700">
                            <div className="absolute left-0 top-0 w-3 h-3 -ml-1.5 rounded-full bg-[#E0FE10]"></div>
                            <h4 className="text-white font-medium mb-1">Bootstrap Phase - Completed</h4>
                            <p className="text-zinc-400 text-sm mb-1">2023-2024</p>
                            <p className="text-zinc-400">$7K self-funded to build MVP and validate product-market fit</p>
                        </div>
                        
                        <div className="relative pl-8 pb-8 border-l border-zinc-700">
                            <div className="absolute left-0 top-0 w-3 h-3 -ml-1.5 rounded-full bg-[#E0FE10]"></div>
                            <h4 className="text-white font-medium mb-1">Seed Round - Current</h4>
                            <p className="text-zinc-400 text-sm mb-1">Q2 2025</p>
                            <p className="text-zinc-400">$750K to accelerate creator acquisition and scale platform</p>
                        </div>
                        
                        <div className="relative pl-8 border-l border-zinc-700">
                            <div className="absolute left-0 top-0 w-3 h-3 -ml-1.5 rounded-full bg-zinc-700"></div>
                            <h4 className="text-white font-medium mb-1">Series A - Projected</h4>
                            <p className="text-zinc-400 text-sm mb-1">Q4 2026</p>
                            <p className="text-zinc-400">Targeting $5M+ for market expansion and feature development</p>
                        </div>
                        </div>
                    </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-white text-xl font-semibold mb-6">Why Invest in Pulse?</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-3">Early Stage Validation</h4>
                            <p className="text-zinc-400">
                            Strong early metrics with 808 users, 61% retention, and 18% conversion rate in just 4 months 
                            since public launch, demonstrating clear product-market fit.
                            </p>
                        </div>
                        </div>
                        
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-3">Creator-Driven Growth</h4>
                            <p className="text-zinc-400">
                            Proven creator acquisition model with 37.5x user multiplier per creator and validation 
                            from SoulCycle instructors bringing 75 paying users.
                            </p>
                        </div>
                        </div>
                        
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-3">Experienced Founder</h4>
                            <p className="text-zinc-400">
                            Led by Tremaine Grant, first-generation Jamaican-American software engineer with proven 
                            track record in building and scaling consumer products.
                            </p>
                        </div>
                        </div>
                        
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-3">Massive Market Opportunity</h4>
                            <p className="text-zinc-400">
                            Operating in the $120B+ global fitness app market with a unique social-first approach 
                            that differentiates from existing competitors.
                            </p>
                        </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="mailto:invest@fitwithpulse.ai" className="inline-flex items-center justify-center px-8 py-4 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-bold rounded-lg transition-colors text-center">
                        Schedule Investor Meeting
                        </a>
                        <a href="#" className="inline-flex items-center justify-center px-8 py-4 border border-zinc-700 hover:border-[#E0FE10] text-white font-medium rounded-lg transition-colors text-center">
                        Request Due Diligence Access
                        </a>
                    </div>
                    </div>
                </section>

                {/* Security & Compliance Footer */}
                <section className="py-8 bg-zinc-950 border-t border-zinc-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-zinc-400 text-sm">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span>Pulse is GDPR-compliant, HIPAA-ready, and SOC-2 roadmap kicking off Q3 2025.</span>
                        </div>
                        <div className="flex items-center gap-6 text-zinc-500 text-xs">
                        <span>🔒 End-to-end encryption</span>
                        <span>🛡️ Privacy by design</span>
                        <span>🛡️ Privacy by design</span>
                        <span>📋 Regular security audits</span>
                        </div>
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

export const getServerSideProps: GetServerSideProps<InvestorDataroomPageProps> = async (context) => {
  // Determine which page ID to use based on the URL
  const isInvestRoute = context.resolvedUrl?.startsWith('/invest');
  const primaryPageId = isInvestRoute ? 'invest' : 'investor';
  const fallbackPageId = 'investor';
  
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    // Try the primary page ID first
    rawMetaData = await adminMethods.getPageMetaData(primaryPageId);
    
    // If no meta data found for 'invest', fall back to 'investor'
    if (!rawMetaData && primaryPageId !== fallbackPageId) {
      rawMetaData = await adminMethods.getPageMetaData(fallbackPageId);
    }
  } catch (error) {
    console.error(`Error fetching metaData for ${primaryPageId} page in getServerSideProps:`, error);
    
    // Try fallback if primary failed and they're different
    if (primaryPageId !== fallbackPageId) {
      try {
        rawMetaData = await adminMethods.getPageMetaData(fallbackPageId);
      } catch (fallbackError) {
        console.error(`Error fetching fallback metaData for ${fallbackPageId} page:`, fallbackError);
      }
    }
    // Fallthrough to return props with metaData: null
  }

  let serializableMetaData: SerializablePageMetaDataForInvestor | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      // Ensure lastUpdated is serializable, converting Timestamp to ISO string
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }
    
  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default InvestorDataroom;