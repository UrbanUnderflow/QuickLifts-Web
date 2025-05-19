import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ArrowUpRight, Download, ChevronRight, ArrowLeft } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer/Footer';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

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
  // Add more financial metrics as needed
}

const InvestorDataroom: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Refs for sections
  const sectionsRef = useRef<SectionRefs>({
    overview: null,
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
        // Replace with actual data fetching
        const docRef = doc(db, "investorData", "metrics");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setFinancialMetrics(docSnap.data() as FinancialMetrics);
        } else {
          console.log("No metrics document found");
          // Set placeholder data for development
          setFinancialMetrics({
            revenue: "$1.2M ARR",
            users: "250,000+",
            growth: "22% MoM",
            retention: "85%"
          });
        }
      } catch (error) {
        console.error("Error fetching investor data:", error);
        // Set placeholder data on error
        setFinancialMetrics({
          revenue: "$1.2M ARR",
          users: "250,000+",
          growth: "22% MoM",
          retention: "85%"
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Head>
        <title>Investor Dataroom - Pulse Fitness Collective</title>
        <meta name="description" content="Exclusive investor information for Pulse Fitness Collective" />
      </Head>

      <Header 
        onSectionChange={handleHeaderSectionChange} 
        currentSection="home" 
        toggleMobileMenu={toggleMobileMenu} 
        setIsSignInModalVisible={setIsSignInModalVisible} 
      />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden">
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
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">Investor Relations</h2>
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8">Pulse Investor Dataroom</h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12">
            Building the future of social fitness with passionate communities
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#deck" onClick={(e) => { e.preventDefault(); scrollToSection('deck'); }} className="inline-flex items-center justify-center px-8 py-3 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-medium rounded-lg transition-colors">
              <Download className="mr-2 h-5 w-5" />
              Download Pitch Deck
            </a>
            <a href="mailto:investors@pulse.ai" className="inline-flex items-center justify-center px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors">
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
                    { id: 'market', label: 'Market Opportunity', number: 2 },
                    { id: 'product', label: 'Product & Technology', number: 3 },
                    { id: 'team', label: 'Team', number: 4 },
                    { id: 'traction', label: 'Traction & Metrics', number: 5 },
                    { id: 'financials', label: 'Financial Information', number: 6 },
                    { id: 'deck', label: 'Pitch Deck', number: 7 },
                    { id: 'investment', label: 'Investment Opportunity', number: 8 },
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
                    <a href="mailto:investors@pulse.ai" className="text-[#E0FE10] hover:underline">
                      investors@pulse.ai
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
                  <h3 className="text-white text-xl font-semibold mb-4">About Pulse</h3>
                  <p className="text-zinc-400 text-lg mb-6">
                    Pulse is a social fitness platform that connects like-minded fitness enthusiasts to work out together,
                    share progress, and achieve their goals through community support. Our mission is to make fitness a 
                    collective experience rather than an isolated journey.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Vision</h4>
                      <p className="text-zinc-400">To build the world's most engaging fitness community platform.</p>
                    </div>
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Mission</h4>
                      <p className="text-zinc-400">Make fitness social, sustainable, and supportive through technology.</p>
                    </div>
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Values</h4>
                      <p className="text-zinc-400">Community-first, innovation, inclusivity, and authentic connection.</p>
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
                    <span className="font-bold text-black">2</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Market Opportunity</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-4">The Fitness Landscape</h3>
                  
                  <p className="text-zinc-400 text-lg mb-6">
                    The global fitness app market was valued at $13.78 billion in 2023 and is expected to reach $120.37 billion 
                    by 2030, with a CAGR of 24.3%. The social fitness segment is growing at an even faster rate, as users 
                    increasingly seek community-based experiences.
                  </p>
                  
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
                            <p className="text-white font-medium">Personalization Trend</p>
                            <p className="text-zinc-400">Increasing demand for personalized fitness experiences</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-zinc-800/50 rounded-xl p-6">
                      <h4 className="text-[#E0FE10] font-medium mb-3">TAM (Total Addressable Market)</h4>
                      <p className="text-white text-3xl font-bold mb-2">$120B+</p>
                      <p className="text-zinc-400">Global fitness app market by 2030</p>
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
                    While the fitness app market is crowded, Pulse has identified a significant gap in truly social 
                    fitness experiences. Most competitors focus on individual tracking or basic social sharing, without 
                    building meaningful communities around fitness.
                  </p>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="py-3 text-zinc-400 font-medium">Competitor</th>
                          <th className="py-3 text-zinc-400 font-medium">Individual Tracking</th>
                          <th className="py-3 text-zinc-400 font-medium">Social Features</th>
                          <th className="py-3 text-zinc-400 font-medium">Community Building</th>
                          <th className="py-3 text-zinc-400 font-medium">Personalized Content</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-zinc-800">
                          <td className="py-4 text-white">Pulse</td>
                          <td className="py-4 text-[#E0FE10]">★★★★★</td>
                          <td className="py-4 text-[#E0FE10]">★★★★★</td>
                          <td className="py-4 text-[#E0FE10]">★★★★★</td>
                          <td className="py-4 text-[#E0FE10]">★★★★☆</td>
                        </tr>
                        <tr className="border-b border-zinc-800">
                          <td className="py-4 text-white">Competitor A</td>
                          <td className="py-4 text-[#E0FE10]">★★★★★</td>
                          <td className="py-4 text-[#E0FE10]">★★★☆☆</td>
                          <td className="py-4 text-[#E0FE10]">★★☆☆☆</td>
                          <td className="py-4 text-[#E0FE10]">★★★★☆</td>
                        </tr>
                        <tr className="border-b border-zinc-800">
                          <td className="py-4 text-white">Competitor B</td>
                          <td className="py-4 text-[#E0FE10]">★★★★☆</td>
                          <td className="py-4 text-[#E0FE10]">★★★★☆</td>
                          <td className="py-4 text-[#E0FE10]">★★☆☆☆</td>
                          <td className="py-4 text-[#E0FE10]">★★★☆☆</td>
                        </tr>
                        <tr>
                          <td className="py-4 text-white">Competitor C</td>
                          <td className="py-4 text-[#E0FE10]">★★★☆☆</td>
                          <td className="py-4 text-[#E0FE10]">★★☆☆☆</td>
                          <td className="py-4 text-[#E0FE10]">★★★☆☆</td>
                          <td className="py-4 text-[#E0FE10]">★★☆☆☆</td>
                        </tr>
                      </tbody>
                    </table>
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
                    <span className="font-bold text-black">3</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Product & Technology</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-4">Platform Overview</h3>
                  
                  <p className="text-zinc-400 text-lg mb-8">
                    Pulse is a comprehensive social fitness platform available on iOS, Android, and web, designed to make 
                    fitness more engaging, social, and sustainable through innovative technology and community features.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    <div className="rounded-xl overflow-hidden">
                      <img 
                        src="/investor/product-screenshot-1.jpg" 
                        alt="Pulse App Screenshot - Feed" 
                        className="w-full aspect-[9/16] object-cover"
                      />
                    </div>
                    <div className="rounded-xl overflow-hidden">
                      <img 
                        src="/investor/product-screenshot-2.jpg" 
                        alt="Pulse App Screenshot - Workout" 
                        className="w-full aspect-[9/16] object-cover"
                      />
                    </div>
                    <div className="rounded-xl overflow-hidden">
                      <img 
                        src="/investor/product-screenshot-3.jpg" 
                        alt="Pulse App Screenshot - Community" 
                        className="w-full aspect-[9/16] object-cover"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-4">Key Features</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Social Fitness Feed</h4>
                        <p className="text-zinc-400">
                          Real-time activity sharing, likes, comments, and community interactions to keep users motivated and connected.
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Workout Stacks</h4>
                        <p className="text-zinc-400">
                          Customizable workout programs that can be shared with friends or the community, with progress tracking.
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Community Challenges</h4>
                        <p className="text-zinc-400">
                          Time-limited fitness challenges that bring communities together with rewards and leaderboards.
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Move of the Day</h4>
                        <p className="text-zinc-400">
                          Daily exercise recommendations with video guidance, making fitness accessible and varied for all users.
                        </p>
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
              
              {/* Team Section */}
              <section 
                id="team" 
                ref={(el) => { sectionsRef.current.team = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">4</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Team</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Executive Team</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* CEO */}
                    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                      <div className="aspect-square overflow-hidden">
                        <img 
                          src="/investor/team-ceo.jpg"
                          alt="CEO Portrait" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-6">
                        <h4 className="text-white font-semibold mb-1">Tremaine Grant</h4>
                        <p className="text-[#E0FE10] text-sm font-medium mb-3">CEO & Founder</p>
                        <p className="text-zinc-400 text-sm">
                          Former fitness entrepreneur and tech leader with 10+ years experience in consumer products. 
                          Previously founded GloryFit (acquired in 2019) and led product at FitnessTech.
                        </p>
                      </div>
                    </div>
                    
                    {/* CTO */}
                    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                      <div className="aspect-square overflow-hidden">
                        <img 
                          src="/investor/team-cto.jpg"
                          alt="CTO Portrait" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-6">
                        <h4 className="text-white font-semibold mb-1">Alex Reynolds</h4>
                        <p className="text-[#E0FE10] text-sm font-medium mb-3">CTO</p>
                        <p className="text-zinc-400 text-sm">
                          Tech veteran with experience at Google and Twitter. Expert in building scalable platforms and 
                          mobile applications with focus on social experiences.
                        </p>
                      </div>
                    </div>
                    
                    {/* COO */}
                    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                      <div className="aspect-square overflow-hidden">
                        <img 
                          src="/investor/team-coo.jpg"
                          alt="COO Portrait" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-6">
                        <h4 className="text-white font-semibold mb-1">Morgan Chen</h4>
                        <p className="text-[#E0FE10] text-sm font-medium mb-3">COO</p>
                        <p className="text-zinc-400 text-sm">
                          Operations expert with background in fitness industry. Previously scaled operations at Peloton 
                          and led community engagement at Nike Run Club.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-6">Advisory Board</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img 
                          src="/investor/advisor-1.jpg"
                          alt="Advisor 1" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Dr. James Wilson</h4>
                        <p className="text-[#E0FE10] text-sm font-medium mb-2">Sports Medicine</p>
                        <p className="text-zinc-400 text-sm">
                          Leading sports medicine expert and published author on fitness technology.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img 
                          src="/investor/advisor-2.jpg"
                          alt="Advisor 2" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Sarah Martinez</h4>
                        <p className="text-[#E0FE10] text-sm font-medium mb-2">Growth Strategy</p>
                        <p className="text-zinc-400 text-sm">
                          Former VP of Growth at Strava and advisor to multiple fitness startups.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img 
                          src="/investor/advisor-3.jpg"
                          alt="Advisor 3" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Michael Johnson</h4>
                        <p className="text-[#E0FE10] text-sm font-medium mb-2">Venture Capital</p>
                        <p className="text-zinc-400 text-sm">
                          Partner at Fitness Ventures and early investor in multiple successful health tech companies.
                        </p>
                      </div>
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
                    <span className="font-bold text-black">5</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Traction & Metrics</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Key Performance Indicators</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Monthly Active Users</p>
                        <p className="text-white text-3xl font-bold mb-1">125K+</p>
                        <p className="text-[#E0FE10] text-sm">↑ 28% MoM</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">User Retention (D30)</p>
                        <p className="text-white text-3xl font-bold mb-1">67%</p>
                        <p className="text-[#E0FE10] text-sm">↑ 12% YoY</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Workouts Completed</p>
                        <p className="text-white text-3xl font-bold mb-1">2.8M</p>
                        <p className="text-[#E0FE10] text-sm">↑ 35% QoQ</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Avg. Session Time</p>
                        <p className="text-white text-3xl font-bold mb-1">23min</p>
                        <p className="text-[#E0FE10] text-sm">↑ 8% MoM</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800/50 rounded-xl p-6 mb-8">
                    <h4 className="text-white text-lg font-semibold mb-4">Revenue Growth</h4>
                    <div className="h-64 bg-zinc-900/50 rounded-lg">
                      {/* Revenue graph placeholder - would be actual chart in production */}
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-zinc-500">Revenue Growth Chart - Q1 2022 to Q2 2023</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-zinc-800/50 rounded-xl p-6">
                      <h4 className="text-white text-lg font-semibold mb-4">Customer Acquisition</h4>
                      <p className="text-zinc-400 mb-4">
                        Our customer acquisition strategy has optimized CAC from $18 to $9.50 over the past 12 months.
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <p className="text-zinc-400 text-sm">Current CAC</p>
                          <p className="text-white text-xl font-bold">$9.50</p>
                        </div>
                        <div>
                          <p className="text-zinc-400 text-sm">LTV:CAC Ratio</p>
                          <p className="text-white text-xl font-bold">4.2:1</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-zinc-800/50 rounded-xl p-6">
                      <h4 className="text-white text-lg font-semibold mb-4">Growth Channels</h4>
                      <ul className="space-y-3">
                        <li className="flex justify-between items-center">
                          <span className="text-zinc-400">Organic / Word of Mouth</span>
                          <span className="text-white font-medium">41%</span>
                        </li>
                        <li className="flex justify-between items-center">
                          <span className="text-zinc-400">Social Media</span>
                          <span className="text-white font-medium">28%</span>
                        </li>
                        <li className="flex justify-between items-center">
                          <span className="text-zinc-400">Influencer Partnerships</span>
                          <span className="text-white font-medium">18%</span>
                        </li>
                        <li className="flex justify-between items-center">
                          <span className="text-zinc-400">Paid Acquisition</span>
                          <span className="text-white font-medium">13%</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-4">User Testimonials</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-zinc-800/50 rounded-xl p-6">
                      <div className="flex items-center mb-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
                          <img 
                            src="/investor/user-1.jpg"
                            alt="User 1" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-white font-medium">Jessica H.</p>
                          <p className="text-zinc-400 text-sm">Member since 2022</p>
                        </div>
                        <div className="ml-auto text-[#E0FE10]">★★★★★</div>
                      </div>
                      <p className="text-zinc-400 italic">
                        "Pulse has completely transformed my fitness journey. The community aspect keeps me motivated, and I've made genuine friends who support my goals."
                      </p>
                    </div>
                    
                    <div className="bg-zinc-800/50 rounded-xl p-6">
                      <div className="flex items-center mb-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
                          <img 
                            src="/investor/user-2.jpg"
                            alt="User 2" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-white font-medium">Marcus T.</p>
                          <p className="text-zinc-400 text-sm">Member since 2023</p>
                        </div>
                        <div className="ml-auto text-[#E0FE10]">★★★★★</div>
                      </div>
                      <p className="text-zinc-400 italic">
                        "I've tried dozens of fitness apps, but Pulse is the only one that's kept me engaged for more than a few weeks. The social elements and challenges make all the difference."
                      </p>
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
                    <span className="font-bold text-black">6</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Financial Information</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Business Model</h3>
                  
                  <p className="text-zinc-400 text-lg mb-6">
                    Pulse operates on a freemium model with subscription options for premium features, 
                    driving reliable recurring revenue streams with strong margins.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Free Tier</h4>
                      <p className="text-zinc-400 mb-3">Basic functionality with limited features and community access.</p>
                      <p className="text-white font-medium">$0/month</p>
                    </div>
                    
                    <div className="bg-zinc-800/70 rounded-lg p-5 relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 bg-[#E0FE10] text-black text-xs font-bold py-1 px-3 rounded-bl-lg">
                        MOST POPULAR
                      </div>
                      <h4 className="text-[#E0FE10] font-medium mb-3">Premium Tier</h4>
                      <p className="text-zinc-400 mb-3">Full access to all features, workouts, and community tools.</p>
                      <p className="text-white font-medium">$9.99/month</p>
                    </div>
                    
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Annual Premium</h4>
                      <p className="text-zinc-400 mb-3">Yearly premium subscription with significant discount.</p>
                      <p className="text-white font-medium">$89.99/year</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-white text-lg font-semibold mb-4">Revenue Breakdown</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400">Premium Subscriptions</span>
                          <span className="text-white font-medium">78%</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden">
                          <div className="bg-[#E0FE10] h-full rounded-full" style={{ width: '78%' }}></div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-zinc-400">In-App Purchases</span>
                          <span className="text-white font-medium">14%</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden">
                          <div className="bg-[#E0FE10] h-full rounded-full" style={{ width: '14%' }}></div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-zinc-400">Partnerships & Sponsorships</span>
                          <span className="text-white font-medium">8%</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden">
                          <div className="bg-[#E0FE10] h-full rounded-full" style={{ width: '8%' }}></div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-white text-lg font-semibold mb-4">Key Financial Metrics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                          <p className="text-zinc-400 text-sm">ARR</p>
                          <p className="text-white text-xl font-bold">$4.8M</p>
                          <p className="text-[#E0FE10] text-xs">↑ 42% YoY</p>
                        </div>
                        
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                          <p className="text-zinc-400 text-sm">Gross Margin</p>
                          <p className="text-white text-xl font-bold">89%</p>
                          <p className="text-[#E0FE10] text-xs">↑ 4% YoY</p>
                        </div>
                        
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                          <p className="text-zinc-400 text-sm">ARPU</p>
                          <p className="text-white text-xl font-bold">$7.20</p>
                          <p className="text-[#E0FE10] text-xs">↑ 15% YoY</p>
                        </div>
                        
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                          <p className="text-zinc-400 text-sm">Burn Rate</p>
                          <p className="text-white text-xl font-bold">$230K/mo</p>
                          <p className="text-zinc-300 text-xs">18 month runway</p>
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
                          <th className="py-4 px-6 text-zinc-400 font-medium">Year 1 (2023)</th>
                          <th className="py-4 px-6 text-zinc-400 font-medium">Year 2 (2024)</th>
                          <th className="py-4 px-6 text-zinc-400 font-medium">Year 3 (2025)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-zinc-700">
                          <td className="py-4 px-6 text-white">Revenue</td>
                          <td className="py-4 px-6 text-white">$5.2M</td>
                          <td className="py-4 px-6 text-white">$12.8M</td>
                          <td className="py-4 px-6 text-white">$28.5M</td>
                        </tr>
                        <tr className="border-b border-zinc-700">
                          <td className="py-4 px-6 text-white">User Base</td>
                          <td className="py-4 px-6 text-white">240K</td>
                          <td className="py-4 px-6 text-white">580K</td>
                          <td className="py-4 px-6 text-white">1.2M</td>
                        </tr>
                        <tr className="border-b border-zinc-700">
                          <td className="py-4 px-6 text-white">Gross Profit</td>
                          <td className="py-4 px-6 text-white">$4.6M</td>
                          <td className="py-4 px-6 text-white">$11.5M</td>
                          <td className="py-4 px-6 text-white">$25.9M</td>
                        </tr>
                        <tr>
                          <td className="py-4 px-6 text-white">EBITDA</td>
                          <td className="py-4 px-6 text-white">-$2.2M</td>
                          <td className="py-4 px-6 text-white">$1.8M</td>
                          <td className="py-4 px-6 text-white">$8.6M</td>
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
                    <span className="font-bold text-black">7</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Pitch Deck</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <div className="bg-zinc-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
                    <img 
                      src="/investor/pitch-deck-preview.jpg" 
                      alt="Pitch Deck Preview" 
                      className="w-48 h-64 object-cover rounded-lg shadow-lg mb-6"
                    />
                    <h3 className="text-white text-xl font-semibold mb-3">Pulse Investor Presentation</h3>
                    <p className="text-zinc-400 mb-6 max-w-lg">
                      Our comprehensive investor deck includes detailed information about our market opportunity, 
                      business model, growth strategy, and financial projections.
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center">
                      <a href="#" className="inline-flex items-center justify-center px-6 py-3 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-medium rounded-lg transition-colors">
                        <Download className="mr-2 h-5 w-5" />
                        Download Pitch Deck (PDF)
                      </a>
                      <a href="#" className="inline-flex items-center justify-center px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors">
                        <Download className="mr-2 h-5 w-5" />
                        Download Financial Model (XLS)
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
                    <span className="font-bold text-black">8</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Investment Opportunity</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="md:w-1/2">
                      <h3 className="text-white text-xl font-semibold mb-4">Series A Funding Round</h3>
                      
                      <div className="space-y-6">
                        <div>
                          <p className="text-zinc-400 mb-1">Target Raise</p>
                          <p className="text-white text-3xl font-bold">$8 Million</p>
                        </div>
                        
                        <div>
                          <p className="text-zinc-400 mb-1">Pre-Money Valuation</p>
                          <p className="text-white text-3xl font-bold">$42 Million</p>
                        </div>
                        
                        <div>
                          <p className="text-zinc-400 mb-1">Minimum Investment</p>
                          <p className="text-white text-xl font-medium">$250,000</p>
                        </div>
                        
                        <div>
                          <p className="text-zinc-400 mb-1">Funding Use</p>
                          <ul className="text-white space-y-1 mt-2">
                            <li>• Product development (45%)</li>
                            <li>• User acquisition (30%)</li>
                            <li>• Team expansion (15%)</li>
                            <li>• Operations (10%)</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="md:w-1/2">
                      <h3 className="text-white text-xl font-semibold mb-4">Fundraising Timeline</h3>
                      
                      <div className="relative pl-8 pb-8 border-l border-zinc-700">
                        <div className="absolute left-0 top-0 w-3 h-3 -ml-1.5 rounded-full bg-[#E0FE10]"></div>
                        <h4 className="text-white font-medium mb-1">Seed Round - Completed</h4>
                        <p className="text-zinc-400 text-sm mb-1">Q2 2022</p>
                        <p className="text-zinc-400">$2.5M raised from angel investors and seed funds</p>
                      </div>
                      
                      <div className="relative pl-8 pb-8 border-l border-zinc-700">
                        <div className="absolute left-0 top-0 w-3 h-3 -ml-1.5 rounded-full bg-[#E0FE10]"></div>
                        <h4 className="text-white font-medium mb-1">Series A - Current</h4>
                        <p className="text-zinc-400 text-sm mb-1">Q3 2023</p>
                        <p className="text-zinc-400">$8M target to accelerate growth and expand market reach</p>
                      </div>
                      
                      <div className="relative pl-8 border-l border-zinc-700">
                        <div className="absolute left-0 top-0 w-3 h-3 -ml-1.5 rounded-full bg-zinc-700"></div>
                        <h4 className="text-white font-medium mb-1">Series B - Projected</h4>
                        <p className="text-zinc-400 text-sm mb-1">Q4 2024</p>
                        <p className="text-zinc-400">Targeting international expansion and ecosystem growth</p>
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
                        <h4 className="text-[#E0FE10] font-medium mb-3">Explosive Growth Potential</h4>
                        <p className="text-zinc-400">
                          Operating in a rapidly expanding market with proven product-market fit and early traction 
                          showing exceptional user growth and retention.
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Strong Unit Economics</h4>
                        <p className="text-zinc-400">
                          Impressive LTV:CAC ratio of 4.2:1 with steady improvement in customer acquisition costs 
                          and increasing average revenue per user.
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Exceptional Team</h4>
                        <p className="text-zinc-400">
                          Founded and led by experienced entrepreneurs and industry veterans with proven track records
                          in fitness technology and successful exits.
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 h-full">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Clear Exit Opportunities</h4>
                        <p className="text-zinc-400">
                          Well-positioned for strategic acquisition by major fitness brands, health corporations, 
                          or social media platforms, with several potential IPO pathways.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                    <a href="mailto:investors@pulse.ai" className="inline-flex items-center justify-center px-8 py-4 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-bold rounded-lg transition-colors text-center">
                      Schedule Investor Meeting
                    </a>
                    <a href="#" className="inline-flex items-center justify-center px-8 py-4 border border-zinc-700 hover:border-[#E0FE10] text-white font-medium rounded-lg transition-colors text-center">
                      Request Due Diligence Access
                    </a>
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

export default InvestorDataroom; 