import React, { useState, useEffect } from 'react';
import type { NextPage, GetStaticProps } from 'next';
import Footer from '../components/Footer/Footer';
import FAQ from '../components/FAQ';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';
import { FaTrophy, FaCoins, FaGamepad, FaChartLine, FaXmark, FaFire, FaStar, FaRocket, FaBolt, FaArrowRight, FaArrowsRotate } from 'react-icons/fa6';
import { FaApple, FaUser, FaCheck} from 'react-icons/fa';
import HomeContent from './HomeContent';
import { useUser } from '../hooks/useUser';
import SignInModal from '../components/SignInModal';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import 'swiper/css';
import { exerciseService } from '../api/firebase/exercise/service';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface HomePageProps {
  metaData: SerializablePageMetaData | null;
}

const STORAGE_KEY = 'pulse_has_seen_marketing';

// Separate component for marketing content to avoid hook issues
const MarketingContent: React.FC<{ 
  onUseWebApp: () => void; 
  metaData: SerializablePageMetaData | null;
  isSignInModalOpen: boolean;
  setIsSignInModalOpen: (open: boolean) => void;
}> = ({ onUseWebApp, metaData, isSignInModalOpen, setIsSignInModalOpen }) => {
  const faqData = [
    {
      question: "What is the Fitness Collective?",
      answer: "The Fitness Collective transcends a typical fitness community. While communities foster connection and support, a collective goes further, empowering its members to shape the very thing they're a part of. They contribute with user-generated content (exercises, videos, workouts), democratized influence, shared knowledge. <br /><br /><b>Think of it this way:</b> A community consumes, a collective creates. The Fitness Collective is where fitness lovers can not only find support and inspiration but also leave their own unique mark on the platform they love."
    },
    {
      question: "How does Pulse track my progress?",
      answer: "Pulse tracks your progress by allowing you to log your workouts through statistics and videos. <br /> <br />Pulse AI takes this information and applies a score called a <b>Work Score</b> to your sessions that you can easily focus on improving one session at a time."
    },
    {
      question: "Is Pulse available for both iOS and Android?",
      answer: "We are currently only on iOS, but you can use the web app on Android devices right here on this website."
    },
    {
      question: "How do I get started?",
      answer: "Getting started is as easy as just downloading the app! <br /><br /> <a className='text-blue-500 hover:text-blue-700 focus:text-blue-700' href='https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729'>Download Now</a>"
    },
    {
      question: "How do I find and follow other users?",
      answer: "Our workouts are your gateway to connection. See community members in action as you exercise. Discover new people to follow and get inspired with every rep."
    },
    {
      question: "Can I create and share my own workouts?",
      answer: "Yes! You can create your own exercises, workouts, and shoot your own videos to share with the collective. You can also share your workouts with friends and family directly."
    },
    {
      question: "Are there community challenges or events?",
      answer: "Yes! We have in-app and real-world challenges, but you have to stay connected to catch them!"
    },
    {
      question: "Can I export my workout data?",
      answer: "Absolutely! Your data is yours, and we make it easy to take it with you anywhere you decide to go."
    }
  ];

  const [moveVideos, setMoveVideos] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadVideos = async () => {
      try {
        // Fetch exercises with videos, then flatten to video URLs
        await exerciseService.fetchExercises();
        const all = exerciseService.allExercises;
        const urls: string[] = all
          .flatMap(ex => (ex.videos || []).map(v => v.videoURL).filter(Boolean)) as string[];
        // Shuffle and select up to 10
        const randomTen = urls
          .sort(() => Math.random() - 0.5)
          .slice(0, 10);
        if (isMounted) setMoveVideos(randomTen);
      } catch (e) {
        console.error('Failed to load move videos', e);
      }
    };
    loadVideos();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai"
      />

      {/* Hero Section - Updated with Web App Button */}
      <section className="relative min-h-screen flex items-center justify-center px-6 sm:px-8 py-20 overflow-hidden">
        {/* Enhanced Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-green-950/30 to-zinc-900"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-[#E0FE10]/10 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-lime-500/10 rounded-full filter blur-3xl animate-pulse animation-delay-1000"></div>
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-green-500/10 rounded-full filter blur-3xl animate-pulse animation-delay-2000"></div>
          <div className="absolute bottom-1/3 left-1/5 w-72 h-72 bg-emerald-500/8 rounded-full filter blur-3xl"></div>
        </div>
        
        {/* Animated grid pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[url('/grid-pattern.svg')] bg-repeat"></div>
        </div>

        {/* Content - Two Column Layout */}
        <div className="relative z-20 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Column - Text Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-lime-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-8 animate-fade-in-up">
                <FaGamepad className="h-4 w-4 text-[#E0FE10]" />
                <span className="text-[#E0FE10] text-sm font-medium">Gamified Fitness Platform</span>
              </div>
              
              <h1 className="text-white text-5xl sm:text-7xl lg:text-8xl font-bold mb-6 animate-fade-in-up animation-delay-300">
                Pulse
              </h1>
              
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 animate-fade-in-up animation-delay-600">
                <span className="bg-gradient-to-r from-[#E0FE10] via-purple-400 to-blue-400 bg-clip-text text-transparent">
                  Turn Your Workouts Into<br />
                  Monthly Recurring Revenue
                </span>
              </h2>
              
              <p className="text-zinc-400 text-lg sm:text-xl leading-relaxed mb-8 animate-fade-in-up animation-delay-900">
                Create once, earn forever. Build workout content that generates passive income through subscriptions, challenge entry fees, and automated creator royalties.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10 animate-fade-in-up animation-delay-1200">
                <button
                  onClick={onUseWebApp}
                  className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group"
                >
                  Use Web App
                  <FaArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <a 
                  href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                  className="inline-flex items-center justify-center gap-3 bg-zinc-900/80 text-white border border-zinc-700 hover:border-zinc-600 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-800/80 transition-all duration-300"
                >
                  Download iOS App
                  <FaApple className="h-5 w-5" />
                </a>
              </div>
              
              {/* Trust Bar - App Store Rating */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 text-zinc-300 mb-8 animate-fade-in-up animation-delay-1500">
                <div className="flex items-center gap-2 bg-zinc-900/70 border border-zinc-800 rounded-full px-4 py-2">
                  <span className="text-white font-semibold">4.9</span>
                  <div className="flex items-center text-[#E0FE10]">
                    <FaStar className="h-4 w-4" />
                    <FaStar className="h-4 w-4" />
                    <FaStar className="h-4 w-4" />
                    <FaStar className="h-4 w-4" />
                    <FaStar className="h-4 w-4" />
                  </div>
                  <span className="text-sm text-zinc-400">on the App Store</span>
                </div>
                <span className="text-sm text-zinc-500">Trusted by creators and athletes</span>
              </div>

              {/* Moves Carousel */}
              <div className="animate-fade-in-up animation-delay-1800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white text-sm font-semibold">Real Moves from Creators on Pulse</h3>
                  <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                    <FaUser className="h-3 w-3" />
                    <span>Live from our community</span>
                  </div>
                </div>
                <Swiper
                  modules={[Autoplay]}
                  spaceBetween={16}
                  slidesPerView={1.2}
                  autoplay={{
                    delay: 3000,
                    disableOnInteraction: false,
                  }}
                  loop={true}
                  breakpoints={{
                    640: { slidesPerView: 2.2 },
                    1024: { slidesPerView: 3.2 }
                  }}
                >
                  {(moveVideos.length ? moveVideos : ['move.mp4','rounds.mp4','mymoves.mp4','createstack.mp4','LaunchRounds.mp4']).map((src, idx) => (
                    <SwiperSlide key={idx}>
                      <div className="rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-900/60">
                        <video src={src.startsWith('http') ? src : `/${src}`} className="w-full h-56 object-cover" autoPlay muted loop playsInline />
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>

              {/* Creator Flow - Compact Horizontal */}
              <div className="mt-8 animate-fade-in-up animation-delay-2000">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0">
                  {/* Create Content */}
                  <div className="flex items-center gap-3 bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/30 rounded-2xl px-5 py-3.5 w-full sm:w-auto">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FaBolt className="h-5 w-5 text-black" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-base leading-tight">Create Content</div>
                      <div className="text-zinc-400 text-xs leading-snug mt-0.5">Record Moves</div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center px-3 rotate-90 sm:rotate-0">
                    <FaArrowRight className="h-5 w-5 text-zinc-600" />
                  </div>

                  {/* Launch Rounds */}
                  <div className="flex items-center gap-3 bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-400/30 rounded-2xl px-5 py-3.5 w-full sm:w-auto">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FaGamepad className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-base leading-tight">Launch Rounds</div>
                      <div className="text-zinc-400 text-xs leading-snug mt-0.5">Turn Stacks into challenges</div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center px-3 rotate-90 sm:rotate-0">
                    <FaArrowRight className="h-5 w-5 text-zinc-600" />
                  </div>

                  {/* Earn Revenue */}
                  <div className="flex items-center gap-3 bg-gradient-to-br from-orange-500/10 to-pink-500/10 backdrop-blur-sm border border-orange-400/30 rounded-2xl px-5 py-3.5 w-full sm:w-auto">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FaCoins className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-base leading-tight">Earn Revenue</div>
                      <div className="text-zinc-400 text-xs leading-snug mt-0.5">Monetize expertise</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Phone Screenshot */}
            <div className="flex items-center justify-center lg:justify-end animate-fade-in-up animation-delay-1800">
              <div className="relative group">
                <div className="relative w-[300px] sm:w-[380px] lg:w-[420px]">
                  <div className="absolute -inset-6 bg-gradient-to-r from-[#E0FE10]/30 to-lime-400/30 rounded-[3rem] blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
                  <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-zinc-800/50 shadow-2xl transform group-hover:scale-105 transition-transform duration-500">
                    <img 
                      src="/Winner1.png" 
                      alt="Pulse App - Winner Screen" 
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* How Pulse Works - The Flow */}
      <section className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-green-950/20 to-zinc-950"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/5 w-96 h-96 bg-[#E0FE10]/12 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-1/5 w-80 h-80 bg-lime-500/10 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-green-500/8 rounded-full filter blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12 lg:mb-20">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-lime-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-6 lg:mb-8">
              <FaCoins className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">The Creator Journey</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 lg:mb-8 tracking-tight">
              From First Move
              <br />
              <span className="bg-gradient-to-r from-[#E0FE10] via-lime-400 to-green-400 bg-clip-text text-transparent">
                To Monthly Revenue
              </span>
            </h2>
            
            <p className="text-lg lg:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
              How fitness creators turn their expertise into sustainable income through Moves, Stacks, and Rounds
            </p>
          </div>

          {/* The Flow - Vertical Timeline */}
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Vertical connecting line */}
              <div className="absolute left-8 lg:left-12 top-16 bottom-16 w-1 bg-gradient-to-b from-[#E0FE10] via-purple-400 via-blue-400 via-orange-400 to-green-400"></div>
              
              <div className="space-y-12 lg:space-y-16">
                
                {/* Step 1: Create Moves */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-black text-xl lg:text-2xl font-bold">1</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-[#E0FE10]">Create</span> Your Moves
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      <span className="text-white font-medium">5-30 second exercise videos</span>
                    </p>
                    <div className="flex items-center gap-3 text-sm text-[#E0FE10]">
                      <FaBolt className="h-4 w-4" />
                      <span>Your content • Your brand • Reusable forever</span>
                    </div>
                  </div>
                </div>

                {/* Step 2: Build Stacks */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">2</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-purple-400">Stack</span> Your Workout Programs
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      <span className="text-white font-medium">Complete workout programs</span>
                    </p>
                    <div className="flex items-center gap-3 text-sm text-purple-400">
                      <FaRocket className="h-4 w-4" />
                      <span>Structured programs • Subscription ready • Creator owned</span>
                    </div>
                  </div>
                </div>

                {/* Step 3: Launch Rounds */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">3</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-blue-400">Launch</span> Community Rounds
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      <span className="text-white font-medium">Competitive challenges</span>
                    </p>
                    <div className="flex items-center gap-3 text-sm text-blue-400">
                      <FaTrophy className="h-4 w-4" />
                      <span>Your community • Your rules • Your brand</span>
                    </div>
                  </div>
                </div>

                {/* Step 4: Grow Your Community */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">4</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-orange-400">Grow</span> Your Community
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      <span className="text-white font-medium">Build loyalty</span>
                    </p>
                    <div className="flex items-center gap-3 text-sm text-orange-400">
                      <FaGamepad className="h-4 w-4" />
                      <span>Real engagement • Built-in distribution • Community owned</span>
                    </div>
                  </div>
                </div>

                {/* Step 5: Understand Your Audience */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">5</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-cyan-400">Understand</span> Your Audience
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      <span className="text-white font-medium">Real data and insights</span>
                    </p>
                    <div className="flex items-center gap-3 text-sm text-cyan-400">
                      <FaChartLine className="h-4 w-4" />
                      <span>Performance data • Engagement metrics • Content insights</span>
                    </div>
                  </div>
                </div>

                {/* Step 6: Optimize & Improve */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">6</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-green-400">Optimize</span> & Improve
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      <span className="text-white font-medium">AI insights</span>
                    </p>
                    <div className="flex items-center gap-3 text-sm text-green-400">
                      <FaStar className="h-4 w-4" />
                      <span>AI recommendations • Content analytics • Performance trends</span>
                    </div>
                  </div>
                </div>

                {/* Step 7: Earn Revenue */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-black text-xl lg:text-2xl font-bold">7</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-yellow-400">Earn</span> Sustainable Revenue
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      <span className="text-white font-medium">Multiple revenue streams</span>
                    </p>
                    <div className="flex items-center gap-3 text-sm text-yellow-400">
                      <FaCoins className="h-4 w-4" />
                      <span>$4.3k+ monthly potential • Passive income • Multiple streams</span>
                    </div>
                  </div>
                </div>

                {/* Step 8: Scale Your Empire */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center flex-shrink-0 border-4 border-white">
                    <FaArrowsRotate className="text-black text-lg lg:text-xl" />
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-[#E0FE10]">Scale</span> Your Fitness Empire
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      Each Round builds on the last. <span className="text-white font-medium">Grow your library, expand your community, increase your revenue</span>. Build once, earn repeatedly.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-[#E0FE10]">
                      <FaBolt className="h-4 w-4" />
                      <span>Compounding growth • Passive income • Long-term business</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-16 lg:mt-20">
            <div className="bg-gradient-to-br from-zinc-900/80 to-green-950/40 backdrop-blur-sm border border-[#E0FE10]/20 rounded-3xl p-8 lg:p-12 max-w-4xl mx-auto">
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                <span className="text-[#E0FE10]">Build once.</span> Earn repeatedly.
              </h3>
              <p className="text-lg text-zinc-300 mb-6 max-w-2xl mx-auto">
                Create your content library, launch your Rounds, and watch your fitness empire grow with every challenge.
              </p>
              <div className="flex items-center justify-center gap-2 text-[#E0FE10]">
                <FaCoins className="h-5 w-5" />
                <span className="font-medium">The creator economy for fitness professionals</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hierarchy Flowchart Section - Updated with new styling */}
      <section className="py-20 bg-gradient-to-br from-zinc-950 to-black">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-center text-white text-3xl font-bold mb-16">The Pulse Ecosystem</h2>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-10 relative">
            {/* Connecting lines with gradients */}
            <div className="hidden md:block absolute inset-0 z-0">
              <div className="absolute top-1/2 left-1/4 right-3/4 h-1 bg-gradient-to-r from-[#E0FE10] to-purple-400 transform -translate-y-1/2"></div>
              <div className="absolute top-1/2 left-1/2 right-1/4 h-1 bg-gradient-to-r from-purple-400 to-blue-400 transform -translate-y-1/2"></div>
            </div>
            
            {/* Mobile connecting lines */}
            <div className="md:hidden absolute left-1/2 top-[22%] bottom-[78%] w-1 bg-gradient-to-b from-[#E0FE10] to-purple-400 transform -translate-x-1/2"></div>
            <div className="md:hidden absolute left-1/2 top-[55%] bottom-[45%] w-1 bg-gradient-to-b from-purple-400 to-blue-400 transform -translate-x-1/2"></div>
            
            {/* Move Card */}
            <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm rounded-3xl p-6 w-full md:w-[30%] relative z-10 border border-[#E0FE10]/30 hover:border-[#E0FE10]/50 hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group cursor-pointer">
              <div className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-gradient-to-br from-[#E0FE10] to-lime-400 flex items-center justify-center font-bold text-black">1</div>
              <h3 className="text-[#E0FE10] text-2xl font-bold mb-3">Move</h3>
              <p className="text-zinc-400">The foundation: short video clips of exercises that form the building blocks of your fitness journey.</p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <FaArrowRight className="w-6 h-6 text-[#E0FE10]" />
              </div>
            </div>
            
            {/* Stack Card */}
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm rounded-3xl p-6 w-full md:w-[30%] relative z-10 border border-purple-400/30 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-400/20 transition-all duration-300 group cursor-pointer">
              <div className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white">2</div>
              <h3 className="text-purple-400 text-2xl font-bold mb-3">Stack</h3>
              <p className="text-zinc-400">Combine Moves to create complete workout routines that you can share or follow.</p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <FaArrowRight className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            
            {/* Round Card */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm rounded-3xl p-6 w-full md:w-[30%] relative z-10 border border-blue-400/30 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-400/20 transition-all duration-300 group cursor-pointer">
              <div className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center font-bold text-white">3</div>
              <h3 className="text-blue-400 text-2xl font-bold mb-3">Round</h3>
              <p className="text-zinc-400">Join community fitness challenges where members work out, compete, and support each other.</p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <FaArrowRight className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Move Section */}
      <section id="move-section" className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-20 p-8 bg-gradient-to-br from-black to-zinc-950">
        <div className="relative w-[300px] sm:w-[380px] group">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px] transition-transform duration-500 transform group-hover:scale-105">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10] group-hover:border-4 transition-all duration-300" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-300"
                autoPlay
                loop
                muted
                playsInline
                src="/ThisIsPulseNoSound.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
          <div className="absolute -z-10 inset-0 rounded-[3rem] bg-[#E0FE10]/20 blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
        </div>
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-lime-400/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-6">
            <FaBolt className="h-4 w-4 text-[#E0FE10]" />
            <span className="text-[#E0FE10] text-sm font-medium">The Foundation</span>
          </div>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Everything starts with a <span className="bg-gradient-to-r from-[#E0FE10] to-lime-400 bg-clip-text text-transparent">Move</span>
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            A Move is a soundless, 5-15 second video clip of a lift, stretch, exercise, focusing on it's core movement.
          </p>
          <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/20 rounded-2xl p-4">
            <p className="text-[#E0FE10] text-sm">
              <strong>These are your building blocks.</strong> Create once, reuse forever.
            </p>
          </div>
        </div>
      </section>

      {/* Stacks Section - Enhanced */}
      <section id="stack-section" className="min-h-screen bg-gradient-to-br from-zinc-950 via-purple-950/20 to-zinc-900 flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="max-w-xl lg:order-1">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-purple-400/30 rounded-full mb-6">
            <FaRocket className="h-4 w-4 text-purple-400" />
            <span className="text-purple-400 text-sm font-medium">Build The Blocks</span>
          </div>
          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Stack</span> your Moves into workouts
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            Combine your Moves into complete workout programs called Stacks. Create personalized routines, share them with the community, or discover Stacks from other creators.
          </p>
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-400/20 rounded-2xl p-4">
            <p className="text-purple-300 text-sm">
              <strong>Creator Economy:</strong> Popular Stacks generate passive income. Build a following and monetize your expertise through Stack subscriptions.
            </p>
          </div>
        </div>
        <div className="relative w-[300px] sm:w-[380px] lg:order-2 group">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px] transition-transform duration-500 transform group-hover:scale-105">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-purple-400 group-hover:border-4 transition-all duration-300" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-300"
                autoPlay
                loop
                muted
                playsInline
                src="/stack.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
          <div className="absolute -z-10 inset-0 rounded-[3rem] bg-purple-400/20 blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
        </div>
      </section>

      {/* Community Section - Enhanced */}
      <section id="round-section" className="min-h-screen bg-gradient-to-br from-black via-blue-950/20 to-zinc-950 flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="relative w-[300px] sm:w-[380px] group">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px] transition-transform duration-500 transform group-hover:scale-105">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-blue-400 group-hover:border-4 transition-all duration-300" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-300"
                autoPlay
                loop
                muted
                playsInline
                src="/rounds.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
          <div className="absolute -z-10 inset-0 rounded-[3rem] bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
        </div>
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-400/30 rounded-full mb-6">
            <FaTrophy className="h-4 w-4 text-blue-400" />
            <span className="text-blue-400 text-sm font-medium">The Community</span>
          </div>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Join a <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Round</span> and compete together
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            Join community fitness challenges called Rounds. Compete with up to 250 people, chat in real-time, and earn rewards through time-based challenges that build accountability.
          </p>
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border border-blue-400/20 rounded-2xl p-4">
            <p className="text-blue-300 text-sm">
              <strong>Win Together:</strong> Collective achievements unlock team rewards. Individual performance contributes to group success and shared prize pools.
            </p>
          </div>
        </div>
      </section>

      {/* Apple Watch Gamification - Compact */}
      <section className="relative overflow-hidden h-[300px] bg-gradient-to-br from-black via-blue-950/30 to-zinc-950">
        <div className="absolute inset-0">
          <div className="absolute -top-10 -left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -right-10 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto h-full px-6 lg:px-8 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-3 px-5 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-400/30 rounded-full mb-4">
              <FaGamepad className="h-4 w-4 text-blue-400" />
              <span className="text-blue-400 text-xs font-medium">Gamified Apple Watch</span>
            </div>
            <h2 className="text-white text-3xl lg:text-4xl font-bold mb-2 tracking-tight">Gamify Your Apple Watch Data</h2>
            <p className="text-zinc-400 text-sm sm:text-base max-w-xl">
              Turn heart rate, calories, and activity into points, streaks, and wins with your Round.
            </p>
          </div>
          <div className="hidden sm:flex items-center justify-center">
            <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 border border-blue-400/30 rounded-2xl flex items-center justify-center">
              <span className="text-2xl lg:text-3xl">⌚</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features & Products Section - New */}
      <section className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950/50 to-zinc-900"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/6 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-20 right-1/6 w-80 h-80 bg-[#E0FE10]/5 rounded-full filter blur-3xl"></div>
          <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full filter blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12 lg:mb-20">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-blue-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-6 lg:mb-8">
              <FaRocket className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">Explore Our Features</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 lg:mb-8 tracking-tight">
              Powerful Features
              <br />
              <span className="bg-gradient-to-r from-[#E0FE10] via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Built for Every Goal
              </span>
            </h2>
            
            <p className="text-lg lg:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
              From AI-powered programming to health data insights, discover how each feature is designed to level up your fitness journey.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            
            {/* Real Workouts From Real People */}
            <div className="group bg-gradient-to-br from-purple-500/10 to-indigo-500/10 backdrop-blur-sm border border-purple-400/30 hover:border-purple-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaUser className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Real Workouts From Real People</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base">
                Access authentic workouts created by real trainers and athletes. Every Move is filmed by actual people, giving you genuine content that inspires and motivates your fitness journey.
              </p>
            </div>

            {/* Video Demonstrations in Real Time */}
            <div className="group bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/30 hover:border-[#E0FE10]/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaFire className="h-6 w-6 lg:h-8 lg:w-8 text-black" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Video Demonstrations in Real Time</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base">
                Follow along with high-quality video demonstrations as you work out. See proper form, technique, and execution for every exercise in real-time.
              </p>
            </div>

            {/* Gamified Content & Earned Revenue */}
            <div className="group bg-gradient-to-br from-orange-500/10 to-pink-500/10 backdrop-blur-sm border border-orange-400/30 hover:border-orange-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-orange-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaCoins className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Gamified Content & Earned Revenue</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base">
                Turn your fitness expertise into income streams. Create content, launch challenges, and earn revenue through our gamified creator economy platform.
              </p>
            </div>

            {/* Food Photo Macro Calculation */}
            <div className="group bg-gradient-to-br from-teal-500/10 to-cyan-500/10 backdrop-blur-sm border border-teal-400/30 hover:border-teal-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-teal-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaBolt className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Real Macro Calculation</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base">
                Simply take photos of your food and get instant, accurate macro calculations. Track your nutrition effortlessly with AI-powered food recognition technology.
              </p>
            </div>

            {/* Apple Watch Data Story */}
            <div className="group bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm border border-blue-400/30 hover:border-blue-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaChartLine className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Apple Watch Data Story</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base">
                Transform your Apple Watch data into meaningful insights. Understand your complete health story through heart rate, activity, sleep, and more.
              </p>
            </div>

            {/* Real Community That Trains Together */}
            <div className="group bg-gradient-to-br from-emerald-500/10 to-green-500/10 backdrop-blur-sm border border-emerald-400/30 hover:border-emerald-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaTrophy className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Real Community That Trains Together</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base">
                Join a supportive fitness community where members work out together, share progress, and motivate each other. Build accountability through genuine connections.
              </p>
            </div>

          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-16 lg:mt-20">
            <div className="bg-gradient-to-br from-zinc-900/80 to-purple-950/40 backdrop-blur-sm border border-purple-500/20 rounded-3xl p-8 lg:p-12 max-w-4xl mx-auto">
              <h3 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                Ready to Transform Your Fitness Journey?
              </h3>
              <p className="text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
                Join thousands of users who are already leveling up with Pulse's gamified platform. Start your journey today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group"
                >
                  Download Pulse
                  <FaArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <a 
                  href="/creators"
                  className="inline-flex items-center gap-3 bg-zinc-900/80 text-white border border-zinc-700 hover:border-zinc-600 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-800/80 transition-all duration-300"
                >
                  Become a Creator
                  <FaCoins className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Traditional vs Pulse Comparison */}
      <section className="bg-gradient-to-br from-zinc-950 via-purple-950/20 to-zinc-950 py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              <span className="text-red-400">Traditional Platforms</span> <span className="text-zinc-400 font-normal">vs</span> <span className="text-[#E0FE10]">Pulse</span> <span className="text-white">for Creators</span>
            </h2>
            <p className="text-zinc-400 text-lg">Why creators are making the switch</p>
          </div>

          {/* Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {/* Traditional Platforms */}
            <div className="bg-gradient-to-br from-red-950/20 to-zinc-900/80 backdrop-blur-sm border border-red-500/20 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <FaXmark className="h-6 w-6 text-red-400" />
                <h3 className="text-2xl font-bold text-white">Traditional Platforms</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <FaXmark className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">You're fighting algorithms for reach</p>
                </div>
                <div className="flex items-start gap-3">
                  <FaXmark className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">Platform takes 30-50% of your revenue</p>
                </div>
                <div className="flex items-start gap-3">
                  <FaXmark className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">Can't own your community or content</p>
                </div>
                <div className="flex items-start gap-3">
                  <FaXmark className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">Limited monetization options</p>
                </div>
                <div className="flex items-start gap-3">
                  <FaXmark className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">No community engagement tools</p>
                </div>
              </div>
            </div>

            {/* Pulse for Creators */}
            <div className="bg-gradient-to-br from-[#E0FE10]/10 to-zinc-900/80 backdrop-blur-sm border border-[#E0FE10]/30 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <FaCheck className="h-6 w-6 text-[#E0FE10]" />
                <h3 className="text-2xl font-bold text-white">Pulse for Creators</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <FaCheck className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">Direct access to your community</p>
                </div>
                <div className="flex items-start gap-3">
                  <FaCheck className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">Keep 100% of subscription revenue</p>
                </div>
                <div className="flex items-start gap-3">
                  <FaCheck className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">Own your content & community</p>
                </div>
                <div className="flex items-start gap-3">
                  <FaCheck className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">Multiple revenue streams built-in</p>
                </div>
                <div className="flex items-start gap-3">
                  <FaCheck className="h-5 w-5 text-[#E0FE10] flex-shrink-0 mt-0.5" />
                  <p className="text-zinc-300">Gamified Rounds for engagement</p>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-gradient-to-br from-blue-950/40 to-zinc-900/60 backdrop-blur-sm border border-blue-500/20 rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full"></div>
                <div>
                  <h4 className="text-white font-bold text-lg">Deray Mckesson</h4>
                  <p className="text-zinc-400 text-sm">Activist & Educator • NYC</p>
                </div>
              </div>
              <p className="text-zinc-300 text-lg italic mb-4">
                "Pulse reminds me of the best classrooms — They're places where every student can feel success."
              </p>
              <div className="flex gap-1 text-[#E0FE10]">
                <FaStar className="h-5 w-5" />
                <FaStar className="h-5 w-5" />
                <FaStar className="h-5 w-5" />
                <FaStar className="h-5 w-5" />
                <FaStar className="h-5 w-5" />
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-gradient-to-br from-green-950/40 to-zinc-900/60 backdrop-blur-sm border border-[#E0FE10]/20 rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-full"></div>
                <div>
                  <h4 className="text-white font-bold text-lg">Marques Zak</h4>
                  <p className="text-zinc-400 text-sm">Fitness Enthusiast • NYC</p>
                </div>
              </div>
              <p className="text-zinc-300 text-lg italic mb-4">
                "The Mobility Challenge is Amazing! I do it after my workouts and it feels soooo good!"
              </p>
              <div className="flex gap-1 text-[#E0FE10]">
                <FaStar className="h-5 w-5" />
                <FaStar className="h-5 w-5" />
                <FaStar className="h-5 w-5" />
                <FaStar className="h-5 w-5" />
                <FaStar className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-zinc-900 py-20">
        <FAQ title="Frequently Asked Questions" 
        items={faqData}
        theme="dark"
         />
      </section>

      <Footer />
      
      {/* Sign In Modal */}
      <SignInModal 
        isVisible={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={() => {
          setIsSignInModalOpen(false);
          onUseWebApp(); // Trigger the web app access after successful sign in
        }}
        onSignUpSuccess={() => {
          setIsSignInModalOpen(false);
          onUseWebApp(); // Trigger the web app access after successful sign up
        }}
      />
    </div>
  );
};

const HomePage: NextPage<HomePageProps> = ({ metaData }) => {
  const [showMarketing, setShowMarketing] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const currentUser = useUser();

  useEffect(() => {
    // Check if user has seen marketing content before
    const hasSeenMarketing = localStorage.getItem(STORAGE_KEY);
    if (hasSeenMarketing === 'true') {
      setShowMarketing(false);
    }
    setIsLoading(false);
  }, []);

  const handleUseWebApp = () => {
    // Only allow web app access if user is authenticated
    if (currentUser) {
      // Set flag that user has seen marketing and wants to use web app
      localStorage.setItem(STORAGE_KEY, 'true');
      setShowMarketing(false);
    } else {
      // If not authenticated, show sign-in modal
      console.log('[HomePage] User not authenticated, showing sign-in modal');
      setIsSignInModalOpen(true);
    }
  };

  const handleBackToMarketing = () => {
    // Allow user to go back to marketing view
    localStorage.removeItem(STORAGE_KEY);
    setShowMarketing(true);
  };

  // Show loading state briefly to prevent flash
  if (isLoading) {
    return (
      <div className="h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Show web app if user has seen marketing AND is authenticated
  if (!showMarketing) {
    // If user is not authenticated, show marketing instead and clear the flag
    if (!currentUser) {
      // Clear the localStorage flag since user is not authenticated
      localStorage.removeItem(STORAGE_KEY);
      // Reset to show marketing
      setShowMarketing(true);
      return <MarketingContent 
        onUseWebApp={handleUseWebApp} 
        metaData={metaData} 
        isSignInModalOpen={isSignInModalOpen}
        setIsSignInModalOpen={setIsSignInModalOpen}
      />;
    }
    
    return (
      <div className="h-screen relative">
        <HomeContent onAbout={handleBackToMarketing} />
      </div>
    );
  }

  // Show marketing content
  return <MarketingContent 
    onUseWebApp={handleUseWebApp} 
    metaData={metaData} 
    isSignInModalOpen={isSignInModalOpen}
    setIsSignInModalOpen={setIsSignInModalOpen}
  />;
};

// Convert to static generation for better performance
export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  try {
    const metaData = await adminMethods.getPageMetaData('about');
    
    if (metaData) {
      const serializedMetaData: SerializablePageMetaData = {
        ...metaData,
        lastUpdated: metaData.lastUpdated.toString()
      };
      
      return {
        props: {
          metaData: serializedMetaData
        },
        revalidate: 3600 // Revalidate every hour
      };
    }
    
    return {
      props: {
        metaData: null
      },
      revalidate: 3600
    };
  } catch (error) {
    console.error('Error fetching meta data:', error);
    
    return {
      props: {
        metaData: null
      },
      revalidate: 3600
    };
  }
};

export default HomePage;