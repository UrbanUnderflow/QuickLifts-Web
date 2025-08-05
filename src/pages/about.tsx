import type { NextPage, GetServerSideProps } from 'next';
import React from 'react';
import Footer from '../components/Footer/Footer';
import FAQ from '../components/FAQ';
import { useScrollFade } from '../hooks/useScrollFade';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';
import { FaTrophy, FaCoins, FaGamepad, FaChartLine, FaXmark, FaFire, FaStar, FaRocket, FaBolt, FaArrowRight, FaArrowsRotate } from 'react-icons/fa6';
import { FaApple, FaUser, FaCheck} from 'react-icons/fa';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface AboutPageProps {
  metaData: SerializablePageMetaData | null;
}

const AboutPage: NextPage<AboutPageProps> = ({ metaData }) => {

  const scrollToElement = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
      answer: "We are currently only on iOS, but you can use the web app on Android devices <a className='text-blue-500 hover:text-blue-700 focus:text-blue-700' href='https://fitwithpulse.ai'>here</a>"
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

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/about"
      />

      {/* Hero Section - Updated */}
      <section ref={useScrollFade()} className="relative min-h-screen flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden">
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

        {/* Content */}
        <div className="relative z-20 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-lime-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-8 animate-fade-in-up">
            <FaGamepad className="h-4 w-4 text-[#E0FE10]" />
            <span className="text-[#E0FE10] text-sm font-medium">Gamified Fitness Platform</span>
          </div>
          
          <h1 className="text-white text-6xl sm:text-8xl font-bold mb-8 animate-fade-in-up animation-delay-300">
            Pulse
          </h1>
          
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-8 animate-fade-in-up animation-delay-600">
            <span className="bg-gradient-to-r from-[#E0FE10] via-purple-400 to-blue-400 bg-clip-text text-transparent">
              A gamified fitness platform where creators earn,<br />
              members level up, and everyone wins together
            </span>
          </h2>
          
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 max-w-3xl mx-auto animate-fade-in-up animation-delay-900">
            Transform your fitness journey into an engaging game where every workout earns rewards, 
            every milestone unlocks achievements, and every creator can build their empire.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 animate-fade-in-up animation-delay-1200">
            <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/30 hover:border-[#E0FE10]/50 rounded-3xl p-6 max-w-[280px] cursor-pointer transform hover:-translate-y-2 transition-all duration-500 hover:shadow-lg hover:shadow-[#E0FE10]/20 group">
              <div className="w-12 h-12 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <FaCoins className="h-6 w-6 text-black" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Earn</h3>
              <p className="text-zinc-400">Creators monetize content & build communities</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-400/30 hover:border-purple-400/50 rounded-3xl p-6 max-w-[280px] cursor-pointer transform hover:-translate-y-2 transition-all duration-500 hover:shadow-lg hover:shadow-purple-400/20 group">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <FaTrophy className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Level Up</h3>
              <p className="text-zinc-400">Unlock achievements & track progression</p>
            </div>
            
            <div className="bg-gradient-to-br from-orange-500/10 to-pink-500/10 backdrop-blur-sm border border-orange-400/30 hover:border-orange-400/50 rounded-3xl p-6 max-w-[280px] cursor-pointer transform hover:-translate-y-2 transition-all duration-500 hover:shadow-lg hover:shadow-orange-400/20 group">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <FaRocket className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Win Together</h3>
              <p className="text-zinc-400">Community challenges & shared victories</p>
            </div>
          </div>
        </div>
      </section>

      {/* How Pulse Works - The Flow */}
      <section ref={useScrollFade()} className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
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
              <FaGamepad className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">How Pulse Works</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 lg:mb-8 tracking-tight">
              From Content Creation
              <br />
              <span className="bg-gradient-to-r from-[#E0FE10] via-lime-400 to-green-400 bg-clip-text text-transparent">
                To Winning Prizes
              </span>
            </h2>
            
            <p className="text-lg lg:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
              A simple, powerful cycle that turns fitness into an engaging game where everyone wins
            </p>
          </div>

          {/* The Flow - Vertical Timeline */}
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Vertical connecting line */}
              <div className="absolute left-8 lg:left-12 top-16 bottom-16 w-1 bg-gradient-to-b from-[#E0FE10] via-purple-400 via-blue-400 via-orange-400 to-green-400"></div>
              
              <div className="space-y-12 lg:space-y-16">
                
                {/* Step 1: Create Content */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-black text-xl lg:text-2xl font-bold">1</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-[#E0FE10]">Create</span> Workout Content
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      Users record <span className="text-white font-medium">exercise videos</span> and build their personal fitness library. Every movement becomes content.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-[#E0FE10]">
                      <FaBolt className="h-4 w-4" />
                      <span>5-30 second video clips • Exercise library • Personal brand</span>
                    </div>
                  </div>
                </div>

                {/* Step 2: Build Workouts */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">2</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-purple-400">Build</span> Complete Workouts
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      Combine exercises into <span className="text-white font-medium">structured workouts</span> called Stacks. Share with the community or keep private.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-purple-400">
                      <FaRocket className="h-4 w-4" />
                      <span>Workout sequences • Difficulty levels • Sharing & discovery</span>
                    </div>
                  </div>
                </div>

                {/* Step 3: Create Games */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">3</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-blue-400">Design</span> Fitness Games
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      Humans or AI turn workouts into <span className="text-white font-medium">competitive challenges</span> called Rounds. Set rules, prizes, and duration.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-blue-400">
                      <FaTrophy className="h-4 w-4" />
                      <span>Challenge creation • Prize pools • Game mechanics</span>
                    </div>
                  </div>
                </div>

                {/* Step 4: Play Games */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">4</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-orange-400">Play</span> & Compete
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      Users join challenges, work out together, and <span className="text-white font-medium">compete in real-time</span>. Community drives accountability.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-orange-400">
                      <FaGamepad className="h-4 w-4" />
                      <span>Live competition • Chat & support • Team challenges</span>
                    </div>
                  </div>
                </div>

                {/* Step 5: Collect Data */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">5</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-cyan-400">Capture</span> Data & Context
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      Apple Watch collects <span className="text-white font-medium">biometric data</span> while users add personal context about how they felt and performed.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-cyan-400">
                      <FaChartLine className="h-4 w-4" />
                      <span>Heart rate • Sleep • Energy levels • Personal notes</span>
                    </div>
                  </div>
                </div>

                {/* Step 6: Generate Scores */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl lg:text-2xl font-bold">6</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-green-400">Generate</span> Scores & Progress
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      Pulse creates personalized <span className="text-white font-medium">Work Scores</span>, tracks progress, and updates leaderboards in real-time.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-green-400">
                      <FaStar className="h-4 w-4" />
                      <span>Work Score • Progress tracking • Achievement unlocks</span>
                    </div>
                  </div>
                </div>

                {/* Step 7: Win Prizes */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-black text-xl lg:text-2xl font-bold">7</span>
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-yellow-400">Win</span> Prizes & Rewards
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      Top performers earn <span className="text-white font-medium">real prizes</span>, creators get paid, and everyone unlocks new features and achievements.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-yellow-400">
                      <FaCoins className="h-4 w-4" />
                      <span>Cash prizes • Gear • Creator revenue • Achievements</span>
                    </div>
                  </div>
                </div>

                {/* Step 8: Repeat */}
                <div className="relative flex items-start gap-6 lg:gap-12">
                  <div className="relative z-10 w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center flex-shrink-0 border-4 border-white">
                    <FaArrowsRotate className="text-black text-lg lg:text-xl" />
                  </div>
                  <div className="pt-2 lg:pt-4 flex-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      <span className="text-[#E0FE10]">Repeat</span> & Level Up
                    </h3>
                    <p className="text-zinc-400 text-lg mb-4">
                      The cycle continues, getting <span className="text-white font-medium">stronger with each round</span>. More content, better workouts, bigger prizes.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-[#E0FE10]">
                      <FaBolt className="h-4 w-4" />
                      <span>Compound growth • Stronger community • Bigger rewards</span>
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
                <span className="text-[#E0FE10]">Simple concept.</span> Powerful results.
              </h3>
              <p className="text-lg text-zinc-300 mb-6 max-w-2xl mx-auto">
                Every step feeds the next, creating a flywheel that makes fitness addictive, rewarding, and sustainable.
              </p>
              <div className="flex items-center justify-center gap-2 text-[#E0FE10]">
                <FaArrowsRotate className="h-5 w-5 animate-spin" />
                <span className="font-medium">The cycle that changes everything</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hierarchy Flowchart Section - Updated with new styling */}
      <section ref={useScrollFade()} className="py-20 bg-gradient-to-br from-zinc-950 to-black">
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
            <div 
              onClick={() => scrollToElement('move-section')}
              className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm rounded-3xl p-6 w-full md:w-[30%] relative z-10 border border-[#E0FE10]/30 hover:border-[#E0FE10]/50 hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group cursor-pointer"
            >
              <div className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-gradient-to-br from-[#E0FE10] to-lime-400 flex items-center justify-center font-bold text-black">1</div>
              <h3 className="text-[#E0FE10] text-2xl font-bold mb-3">Move</h3>
              <p className="text-zinc-400">The foundation: short video clips of exercises that form the building blocks of your fitness journey.</p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <FaArrowRight className="w-6 h-6 text-[#E0FE10]" />
              </div>
            </div>
            
            {/* Stack Card */}
            <div 
              onClick={() => scrollToElement('stack-section')}
              className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm rounded-3xl p-6 w-full md:w-[30%] relative z-10 border border-purple-400/30 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-400/20 transition-all duration-300 group cursor-pointer"
            >
              <div className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white">2</div>
              <h3 className="text-purple-400 text-2xl font-bold mb-3">Stack</h3>
              <p className="text-zinc-400">Combine Moves to create complete workout routines that you can share or follow.</p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <FaArrowRight className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            
            {/* Round Card */}
            <div 
              onClick={() => scrollToElement('round-section')}
              className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm rounded-3xl p-6 w-full md:w-[30%] relative z-10 border border-blue-400/30 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-400/20 transition-all duration-300 group cursor-pointer"
            >
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

      {/* Moves Section - Enhanced */}
      <section id="move-section" ref={useScrollFade()} className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-20 p-8 bg-gradient-to-br from-black to-zinc-950">
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
            A Move is the fundamental building block of Pulse. It's a 5-30 second video clip of a lift, stretch, exercise, or movement that is used to build a workout. Build your library of movements from basic exercises to complex variations, each Move you create becomes part of yours or maybe someone else fitness journey.
          </p>
          <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/20 rounded-2xl p-4">
            <p className="text-[#E0FE10] text-sm">
              <strong>Gamification:</strong> Each Move you create earns XP and unlocks new creation tools. Quality Moves get featured and earn bonus rewards.
            </p>
          </div>
        </div>
      </section>

      {/* Stacks Section - Enhanced */}
      <section id="stack-section" ref={useScrollFade()} className="min-h-screen bg-gradient-to-br from-zinc-950 via-purple-950/20 to-zinc-900 flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="max-w-xl lg:order-1">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-purple-400/30 rounded-full mb-6">
            <FaRocket className="h-4 w-4 text-purple-400" />
            <span className="text-purple-400 text-sm font-medium">Build The Blocks</span>
          </div>
          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Stack</span> your Moves into workouts
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            Combine your Moves into powerful workouts called Stacks. Create personalized routines that target your goals, share them with the community, or discover Stacks created by others. Each Stack is a curated collection of Moves designed to challenge and inspire.
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
      <section id="round-section" ref={useScrollFade()} className="min-h-screen bg-gradient-to-br from-black via-blue-950/20 to-zinc-950 flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
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
            Participate in community fitness challenges called Rounds where multiple people work out together. Chat, support, and check in with fellow participants as you compete for points. Earn rewards by completing workouts and engaging with your fellow Rounders in these time-based challenges that build community and accountability.
          </p>
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border border-blue-400/20 rounded-2xl p-4">
            <p className="text-blue-300 text-sm">
              <strong>Win Together:</strong> Collective achievements unlock team rewards. Individual performance contributes to group success and shared prize pools.
            </p>
          </div>
        </div>
      </section>

      {/* What Makes Pulse Different Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-gradient-to-br from-zinc-950 via-purple-950/10 to-black py-20">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-purple-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-8">
              <FaStar className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">What Makes Pulse Different</span>
            </div>
            <h3 className="text-white text-4xl lg:text-5xl font-bold mb-6">
              While Others Track, <br /><span className="bg-gradient-to-r from-[#E0FE10] via-purple-400 to-blue-400 bg-clip-text text-transparent">We Transform</span>
            </h3>
            <p className="text-zinc-400 text-lg max-w-4xl mx-auto leading-relaxed">
              Pulse isn't just another fitness app—it's a living ecosystem where creators thrive, communities flourish, and data becomes actionable intelligence. Here's how we're different from every other platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {/* Creator-First Economy */}
            <div className="group bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/20 hover:border-[#E0FE10]/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaCoins className="h-6 w-6 text-black" />
              </div>
              <h4 className="text-white text-xl font-semibold mb-4">
                Creator-First Economy
              </h4>
              <p className="text-zinc-400 leading-relaxed mb-4">
                <span className="text-white font-medium">Build workouts, earn revenue, grow your fitness business.</span>
              </p>
              <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-3 mb-4">
                <p className="text-[#E0FE10] text-sm">
                  <strong>Advantage:</strong> While others treat you as a user, we treat you as a creator
                </p>
              </div>
              <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-3 mb-4">
                <p className="text-[#E0FE10] text-sm">
                  <strong>Value:</strong> Build workouts, earn revenue, grow your fitness business
                </p>
              </div>
              <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-3">
                <p className="text-[#E0FE10] text-sm">
                  <strong>Proof:</strong> $4.3k+ monthly potential for top creators
                </p>
              </div>
            </div>

            {/* Real Community vs Solo Tracking */}
            <div className="group bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-400/20 hover:border-purple-400/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20 cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaUser className="h-6 w-6 text-white" />
              </div>
              <h4 className="text-white text-xl font-semibold mb-4">
                Real Community vs Solo Tracking
              </h4>
              <p className="text-zinc-400 leading-relaxed mb-4">
                <span className="text-white font-medium">Real accountability, real prizes, up to 250 players per challenge.</span>
              </p>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-4">
                <p className="text-purple-300 text-sm">
                  <strong>Advantage:</strong> Live challenges with real people vs. lonely workouts
                </p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-4">
                <p className="text-purple-300 text-sm">
                  <strong>Value:</strong> Real accountability, real prizes, up to 250 players per challenge
                </p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                <p className="text-purple-300 text-sm">
                  <strong>Proof:</strong> Authentic community with shared goals
                </p>
              </div>
            </div>

            {/* Intelligent Data vs Pretty Charts */}
            <div className="group bg-gradient-to-br from-orange-500/10 to-pink-500/10 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-orange-400/20 cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaChartLine className="h-6 w-6 text-white" />
              </div>
              <h4 className="text-white text-xl font-semibold mb-4">
                Intelligent Data vs Pretty Charts
              </h4>
              <p className="text-zinc-400 leading-relaxed mb-4">
                <span className="text-white font-medium">Apple Watch data + human context = actionable insights.</span>
              </p>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-4">
                <p className="text-orange-300 text-sm">
                  <strong>Advantage:</strong> We tell you what to do next vs. just showing what happened
                </p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-4">
                <p className="text-orange-300 text-sm">
                  <strong>Value:</strong> Apple Watch data + human context = actionable insights
                </p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <p className="text-orange-300 text-sm">
                  <strong>Proof:</strong> Personalized recommendations, not just reports
                </p>
              </div>
            </div>
          </div>

          {/* Competitive Comparison Table */}
          <div className="bg-gradient-to-br from-zinc-900/50 to-purple-900/20 backdrop-blur-sm border border-zinc-700/50 rounded-3xl p-8 lg:p-12 mb-16">
            <div className="text-center mb-8">
              <h4 className="text-white text-2xl lg:text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-[#E0FE10] to-purple-400 bg-clip-text text-transparent">Traditional Apps</span> vs <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">Pulse Platform</span>
              </h4>
              <p className="text-zinc-400 text-lg">See how we stack up against the competition</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Traditional Apps - Problems */}
              <div className="space-y-4">
                <h5 className="text-white text-xl font-bold mb-6 flex items-center gap-3">
                  <FaXmark className="h-6 w-6 text-red-400" />
                  Traditional Apps
                </h5>
                
                <div className="flex items-start gap-2">
                  <FaXmark className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-400">Solo workouts with no real accountability</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <FaXmark className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-400">Static data reports that don't drive action</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <FaXmark className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-400">No monetization for fitness creators</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <FaXmark className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-400">Generic workouts → Personalized AI programming</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <FaXmark className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-400">Fake social → Authentic community</span>
                </div>
              </div>
              
              {/* Pulse Platform - Solutions */}
              <div className="space-y-4">
                <h5 className="text-white text-xl font-bold mb-6 flex items-center gap-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  Pulse Platform
                </h5>
                
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <span className="text-white">Live multiplayer challenges</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <span className="text-white">AI-powered insights</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <span className="text-white">Creator economy</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <span className="text-white">Personalized AI programming</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <span className="text-white">Authentic community</span>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border border-blue-400/20 rounded-3xl p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex-shrink-0"></div>
                <div>
                  <h5 className="text-white font-semibold text-lg">Deray Mckesson</h5>
                  <p className="text-blue-300 text-sm">Activist & Educator • NYC</p>
                </div>
              </div>
              <blockquote className="text-white text-lg leading-relaxed italic mb-4">
                "Pulse reminds me of the best classrooms — They're places where every student can feel success."
              </blockquote>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <FaStar key={i} className="h-4 w-4 text-[#E0FE10]" />
                ))}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/20 rounded-3xl p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-full flex-shrink-0"></div>
                <div>
                  <h5 className="text-white font-semibold text-lg">Marques Zak</h5>
                  <p className="text-[#E0FE10] text-sm">Fitness Enthusiast • NYC</p>
                </div>
              </div>
              <blockquote className="text-white text-lg leading-relaxed italic mb-4">
                "The Mobility Challenge is Amazing! I do it after my workouts and it feels soooo good!"
              </blockquote>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <FaStar key={i} className="h-4 w-4 text-[#E0FE10]" />
                ))}
              </div>
            </div>
          </div>

          {/* Strong CTA */}
          <div className="text-center">
            <div className="bg-gradient-to-br from-[#E0FE10]/10 to-purple-500/10 backdrop-blur-sm border border-[#E0FE10]/30 rounded-3xl p-8 lg:p-12 max-w-4xl mx-auto">
              <h4 className="text-white text-2xl lg:text-3xl font-bold mb-6">
                Ready to Experience the Difference?
              </h4>
              <p className="text-zinc-400 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                Join the fitness platform that's actually built for creators, community, and real results.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group"
                >
                  Start Creating Today
                  <FaArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <a 
                  href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                  className="inline-flex items-center gap-3 bg-zinc-900/80 text-white border border-zinc-700 hover:border-zinc-600 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-800/80 transition-all duration-300"
                >
                  Download iOS App
                  <FaApple className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Apple Watch & Wearables Section */}
      <section ref={useScrollFade()} className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-blue-950/20 to-black"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/6 w-96 h-96 bg-blue-500/8 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-20 right-1/6 w-80 h-80 bg-cyan-500/8 rounded-full filter blur-3xl"></div>
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-teal-500/8 rounded-full filter blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12 lg:mb-20">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-400/30 rounded-full mb-6 lg:mb-8">
              <FaRocket className="h-4 w-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-medium">Apple Watch Integration</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 lg:mb-8 tracking-tight">
              From Apollo Mission Computing
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                To Your Wrist
              </span>
            </h2>
            
            <p className="text-lg lg:text-xl text-zinc-400 max-w-4xl mx-auto leading-relaxed mb-8 lg:mb-12">
              Your Apple Watch has more computing power than the entire Apollo mission to the moon. We're using that incredible technology to capture your health data, then combining it with the one thing machines can't measure: <span className="text-white font-medium">your human story</span>.
            </p>
          </div>

          {/* Data Bridge Concept */}
          <div className="bg-gradient-to-br from-zinc-900/80 to-blue-950/40 backdrop-blur-sm border border-blue-400/20 rounded-3xl p-8 lg:p-12 mb-12 lg:mb-20">
            <div className="text-center mb-8 lg:mb-12">
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                The Data Bridge
              </h3>
              <p className="text-lg lg:text-xl text-zinc-300 max-w-3xl mx-auto leading-relaxed">
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-bold">Pulse bridges</span> the gap between <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-bold">raw biometric data</span> and <span className="bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent font-bold">meaningful insights</span> by capturing the <span className="bg-gradient-to-r from-green-400 to-lime-400 bg-clip-text text-transparent font-bold">human story</span> behind every number.
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left: Concept Explanation */}
              <div className="space-y-6">
                <div className="bg-blue-500/10 border border-blue-400/20 rounded-2xl p-6">
                  <h4 className="text-xl font-bold text-blue-300 mb-3 flex items-center gap-3">
                    <FaRocket className="h-5 w-5" />
                    Concrete Data
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Your Apple Watch captures objective metrics: heart rate, calories burned, steps taken, sleep stages, and workout intensity. This is the <span className="text-white font-medium">quantified self</span> — precise, measurable, and consistent.
                  </p>
                </div>
                
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-3 text-cyan-400">
                    <div className="w-8 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400"></div>
                    <span className="text-lg font-medium">+</span>
                    <div className="w-8 h-0.5 bg-gradient-to-r from-cyan-400 to-teal-400"></div>
                  </div>
                </div>
                
                <div className="bg-teal-500/10 border border-teal-400/20 rounded-2xl p-6">
                  <h4 className="text-xl font-bold text-teal-300 mb-3 flex items-center gap-3">
                    <FaUser className="h-5 w-5" />
                    Human Context
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    You provide the subjective experience: how you felt, what you ate, your stress levels, sleep quality, and personal goals. This is the <span className="text-white font-medium">lived experience</span> — nuanced, personal, and meaningful.
                  </p>
                </div>
                
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-3 text-green-400">
                    <div className="w-8 h-0.5 bg-gradient-to-r from-teal-400 to-green-400"></div>
                    <span className="text-lg font-medium">=</span>
                    <div className="w-8 h-0.5 bg-gradient-to-r from-green-400 to-lime-400"></div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-500/10 to-lime-500/10 border border-green-400/20 rounded-2xl p-6">
                  <h4 className="text-xl font-bold text-green-300 mb-3 flex items-center gap-3">
                    <FaStar className="h-5 w-5" />
                    Actionable Intelligence
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Pulse AI combines both to create <span className="text-white font-medium">complete health stories</span> that can be scored, gamified, and used to make real improvements to your fitness and wellbeing.
                  </p>
                </div>
              </div>
              
              {/* Right: Energy Story Example */}
              <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-sm border border-zinc-700/50 rounded-3xl p-6 lg:p-8">
                <div className="text-center mb-6">
                  <h4 className="text-xl lg:text-2xl font-bold text-white mb-2">Energy Story Example</h4>
                  <p className="text-zinc-400">How data + context = actionable insights</p>
                </div>
                
                {/* Phone Mockup */}
                <div className="relative mx-auto w-[280px] h-[560px] bg-zinc-900 rounded-[3rem] p-2 border-4 border-zinc-700 mb-8">
                  <div className="w-full h-full bg-black rounded-[2.5rem] overflow-hidden relative">
                    {/* Status Bar */}
                    <div className="absolute top-0 left-0 right-0 h-12 bg-black z-10 flex items-center justify-between px-8 text-white text-sm">
                      <span>9:41</span>
                      <div className="flex gap-1">
                        <div className="w-4 h-2 bg-white rounded-sm"></div>
                        <div className="w-4 h-2 bg-white rounded-sm"></div>
                        <div className="w-4 h-2 bg-white rounded-sm"></div>
                      </div>
                    </div>
                    
                    {/* Energy Story Content */}
                    <div className="pt-12 p-6 text-white">
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold mb-2">Energy Story</h3>
                        <p className="text-zinc-400 text-sm">Today • Dec 15, 2024</p>
                      </div>
                      
                      {/* Main Metric */}
                      <div className="text-center mb-8">
                        <div className="text-5xl font-bold text-red-400 mb-2">-368</div>
                        <div className="text-zinc-400 text-sm">kcal deficit</div>
                        <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-full px-3 py-1 mt-2">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          <span className="text-red-300 text-xs font-medium">Fat Loss Mode</span>
                        </div>
                      </div>
                      
                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-zinc-800/50 rounded-2xl p-4 text-center">
                          <div className="text-2xl font-bold text-[#E0FE10]">2,311</div>
                          <div className="text-zinc-400 text-xs">kcal burned</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-2xl p-4 text-center">
                          <div className="text-2xl font-bold text-blue-400">1,943</div>
                          <div className="text-zinc-400 text-xs">kcal consumed</div>
                        </div>
                      </div>
                      
                      {/* Context Indicators */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-zinc-300">Wore watch all day</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          <span className="text-zinc-300">Logged 3 meals</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <span className="text-zinc-300">Added 10min walk</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Breakdown */}
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div>
                    <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-3">
                      <span className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm">⌚</span>
                      Apple Watch Data
                    </h4>
                    <div className="space-y-2 text-sm text-zinc-400">
                      <div>• <span className="text-blue-300">2,311 kcal burned:</span> Active + resting metabolism</div>
                      <div>• <span className="text-blue-300">Heart rate zones:</span> 45min moderate, 15min vigorous</div>
                      <div>• <span className="text-blue-300">Movement:</span> 12,847 steps, 6.2 miles</div>
                      <div>• <span className="text-blue-300">Sleep:</span> 7h 23min, 85% efficiency</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-3">
                      <span className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-sm">🧠</span>
                      Human Context
                    </h4>
                    <div className="space-y-2 text-sm text-zinc-400">
                      <div>• <span className="text-orange-300">Physical Goal:</span> "Fat Loss Mode" - deficit target aligns with -368 kcal</div>
                      <div>• <span className="text-orange-300">Food Log:</span> Breakfast at 8am, oatmeal & banana logged</div>
                      <div>• <span className="text-orange-300">Watch Status:</span> "Wore all day" - complete data capture confirmed</div>
                      <div>• <span className="text-orange-300">Extra Activity:</span> "10min walk without watch during lunch"</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-3">
                      <span className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-sm">🎯</span>
                      Actionable Insights
                    </h4>
                    <div className="space-y-2 text-sm text-zinc-400">
                      <div>• <span className="text-green-300">Increase daily steps:</span> Add 2,000 steps to boost NEAT and energy burn</div>
                      <div>• <span className="text-green-300">Reduce evening carbs:</span> Move carbs to pre-workout for better fat oxidation</div>
                      <div>• <span className="text-green-300">Meal timing:</span> Stop eating 3 hours before bed to improve sleep quality</div>
                      <div>• <span className="text-green-300">Energy supplements:</span> Consider B-complex and magnesium for sustained energy</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center">
            <div className="bg-gradient-to-br from-zinc-900/80 to-blue-950/40 backdrop-blur-sm border border-blue-400/20 rounded-3xl p-8 lg:p-12 max-w-4xl mx-auto">
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                Your Health Data Has Never Been This <span className="text-blue-400">Intelligent</span>
              </h3>
              <p className="text-lg text-zinc-300 mb-6 max-w-2xl mx-auto">
                Experience the future of health tracking where every data point tells a story, and every story drives action.
              </p>
              <a 
                href="/HealthDataStories"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 group"
              >
                Explore Health Data Stories
                <FaArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Core Products Section */}
      <section ref={useScrollFade()} className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950/50 to-zinc-900"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/6 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-20 right-1/6 w-80 h-80 bg-purple-500/5 rounded-full filter blur-3xl"></div>
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-blue-500/5 rounded-full filter blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12 lg:mb-20">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-purple-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-6 lg:mb-8">
              <FaGamepad className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">Core Products</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 lg:mb-8 tracking-tight">
              One Platform,
              <br />
              <span className="bg-gradient-to-r from-[#E0FE10] via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Three Experiences
              </span>
            </h2>
            
            <p className="text-lg lg:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
              Pulse is the central data engine that powers our entire ecosystem. Every product connects to create a seamless fitness experience.
            </p>
          </div>

          {/* Core Products Ecosystem */}
          <div className="relative max-w-6xl mx-auto">
            
            {/* Connection Lines - Desktop */}
            <div className="hidden lg:block absolute inset-0 z-0">
              {/* Pulse Programming to Pulse */}
              <div className="absolute top-[20%] left-[15%] right-[60%] h-0.5 bg-gradient-to-r from-purple-400 to-[#E0FE10] opacity-60">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
              </div>
              
              {/* Pulse to PulseCheck */}
              <div className="absolute top-[20%] left-[60%] right-[15%] h-0.5 bg-gradient-to-r from-[#E0FE10] to-blue-400 opacity-60">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full animate-pulse animation-delay-1000"></div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 relative z-10">
              
              {/* Pulse Programming */}
              <div className="group bg-gradient-to-br from-purple-500/10 to-indigo-500/10 backdrop-blur-sm border border-purple-400/30 hover:border-purple-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20 cursor-pointer transform hover:-translate-y-2">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform duration-300">
                    <FaRocket className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
                  </div>
                  <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">Pulse Programming</h3>
                  <p className="text-purple-300 text-sm font-medium">AI-Powered Workout Creation</p>
                </div>
                
                <div className="space-y-4 mb-6">
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Revolutionary AI that creates personalized workout challenges, analyzes your data, and generates custom routines that adapt to your progress.
                  </p>
                  
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                    <p className="text-purple-300 text-xs">
                      <strong>Powered by Pulse:</strong> Uses your workout history, preferences, and performance data to create the perfect challenge.
                    </p>
                  </div>
                </div>
                
                <a 
                  href="/programming" 
                  className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors group-hover:gap-3 duration-300"
                >
                  Explore AI Programming
                  <FaArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* Pulse - Central Hub */}
              <div className="group bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/30 hover:border-[#E0FE10]/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 cursor-pointer transform hover:-translate-y-2 lg:scale-110">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform duration-300">
                    <FaBolt className="h-10 w-10 lg:h-12 lg:w-12 text-black" />
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">Pulse</h3>
                  <p className="text-[#E0FE10] text-sm font-medium">The Central Data Engine</p>
                </div>
                
                <div className="space-y-4 mb-6">
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    The core platform where you create content, build workouts, join challenges, and track progress. Every interaction feeds the ecosystem.
                  </p>
                  
                  <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-3">
                    <p className="text-[#E0FE10] text-xs">
                      <strong>Data Hub:</strong> Collects Apple Watch data, workout videos, personal context, and community interactions.
                    </p>
                  </div>
                </div>
                
                <a 
                  href="/" 
                  className="inline-flex items-center gap-2 text-[#E0FE10] hover:text-lime-400 font-medium transition-colors group-hover:gap-3 duration-300"
                >
                  Open Pulse Platform
                  <FaArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* PulseCheck */}
              <div className="group bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border border-blue-400/30 hover:border-blue-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/20 cursor-pointer transform hover:-translate-y-2">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform duration-300">
                    <FaChartLine className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
                  </div>
                  <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">PulseCheck</h3>
                  <p className="text-blue-300 text-sm font-medium">AI Health Coach</p>
                </div>
                
                <div className="space-y-4 mb-6">
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Your personal AI health coach that analyzes sleep, nutrition, workouts, and more. Get instant insights through natural conversation.
                  </p>
                  
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                    <p className="text-blue-300 text-xs">
                      <strong>Powered by Pulse:</strong> Analyzes your complete health data to provide personalized coaching and recommendations.
                    </p>
                  </div>
                </div>
                
                <a 
                  href="/PulseCheck" 
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors group-hover:gap-3 duration-300"
                >
                  Try PulseCheck
                  <FaArrowRight className="h-4 w-4" />
                </a>
              </div>

            </div>
            
            {/* Data Flow Indicators */}
            <div className="mt-12 lg:mt-16">
              <div className="text-center mb-8">
                <h4 className="text-white text-lg font-semibold mb-2">Data Flow</h4>
                <p className="text-zinc-400 text-sm">How information moves through the ecosystem</p>
              </div>
              
              <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8 text-sm">
                <div className="flex items-center gap-2 text-purple-400">
                  <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                  <span>Programming analyzes your data</span>
                </div>
                <FaArrowRight className="h-4 w-4 text-zinc-600 rotate-90 lg:rotate-0" />
                <div className="flex items-center gap-2 text-[#E0FE10]">
                  <div className="w-3 h-3 bg-[#E0FE10] rounded-full animate-pulse animation-delay-500"></div>
                  <span>Pulse collects everything</span>
                </div>
                <FaArrowRight className="h-4 w-4 text-zinc-600 rotate-90 lg:rotate-0" />
                <div className="flex items-center gap-2 text-blue-400">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse animation-delay-1000"></div>
                  <span>PulseCheck provides insights</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features & Products Section - New */}
      <section ref={useScrollFade()} className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
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
            
            {/* AI Programming */}
            <div className="group bg-gradient-to-br from-purple-500/10 to-indigo-500/10 backdrop-blur-sm border border-purple-400/30 hover:border-purple-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaRocket className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">AI Programming</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Revolutionary AI creates personalized workout challenges, analyzes tagged user data, and generates custom routines that adapt to your progress.
              </p>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 lg:p-4 mb-4">
                <p className="text-purple-300 text-xs lg:text-sm">
                  <strong>Beta Access:</strong> Join exclusive early access program for advanced AI programming features.
                </p>
              </div>
              <a 
                href="/programming" 
                className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors group-hover:gap-3 duration-300"
              >
                Explore AI Programming
                <FaArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* PulseCheck */}
            <div className="group bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/30 hover:border-[#E0FE10]/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaBolt className="h-6 w-6 lg:h-8 lg:w-8 text-black" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">PulseCheck</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Your personal AI health coach that analyzes sleep, nutrition, workouts, and more. Get instant insights and coaching through natural conversation.
              </p>
              <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-3 lg:p-4 mb-4">
                <p className="text-[#E0FE10] text-xs lg:text-sm">
                  <strong>Coming Soon:</strong> Advanced sports psychology and performance optimization features.
                </p>
              </div>
              <a 
                href="/PulseCheck" 
                className="inline-flex items-center gap-2 text-[#E0FE10] hover:text-lime-400 font-medium transition-colors group-hover:gap-3 duration-300"
              >
                Learn About PulseCheck
                <FaArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Creator Program */}
            <div className="group bg-gradient-to-br from-orange-500/10 to-pink-500/10 backdrop-blur-sm border border-orange-400/30 hover:border-orange-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-orange-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaCoins className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Creator Program</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Join the 100 Trainers Program and turn your workouts into revenue streams. Earn $4.3k+ monthly through our multiplayer fitness platform.
              </p>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 lg:p-4 mb-4">
                <p className="text-orange-300 text-xs lg:text-sm">
                  <strong>Elite Program:</strong> 37.5x user multiplier and automated royalty system for top creators.
                </p>
              </div>
              <a 
                href="/creators" 
                className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-medium transition-colors group-hover:gap-3 duration-300"
              >
                Join Creator Program
                <FaArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Health Data Stories */}
            <div className="group bg-gradient-to-br from-teal-500/10 to-cyan-500/10 backdrop-blur-sm border border-teal-400/30 hover:border-teal-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-teal-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaChartLine className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Health Data Stories</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Transform your health data into compelling narratives. Track sleep, nutrition, movement, heart health, and more with AI-powered insights.
              </p>
              <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 lg:p-4 mb-4">
                <p className="text-teal-300 text-xs lg:text-sm">
                  <strong>Comprehensive:</strong> 6 health stories covering energy, movement, sleep, heart, nutrition, and fitness.
                </p>
              </div>
              <a 
                href="/HealthDataStories" 
                className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 font-medium transition-colors group-hover:gap-3 duration-300"
              >
                View Health Stories
                <FaArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Rounds (Community Challenges) */}
            <div className="group bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm border border-blue-400/30 hover:border-blue-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaTrophy className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Rounds</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Join multiplayer fitness challenges with up to 250 players. Compete, chat, and motivate each other in time-based community workouts.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 lg:p-4 mb-4">
                <p className="text-blue-300 text-xs lg:text-sm">
                  <strong>Multiplayer:</strong> Real-time leaderboards, live chat, and group achievements for maximum motivation.
                </p>
              </div>
              <a 
                href="/rounds" 
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors group-hover:gap-3 duration-300"
              >
                Explore Rounds
                <FaArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Stacks (Workout Collections) */}
            <div className="group bg-gradient-to-br from-emerald-500/10 to-green-500/10 backdrop-blur-sm border border-emerald-400/30 hover:border-emerald-400/50 rounded-3xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-400/20 cursor-pointer">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaGamepad className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Stacks</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Create and discover curated workout collections. Stack your favorite Moves into complete routines and share them with the community.
              </p>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 lg:p-4 mb-4">
                <p className="text-emerald-300 text-xs lg:text-sm">
                  <strong>Customizable:</strong> Build personalized routines that match your goals, equipment, and schedule.
                </p>
              </div>
              <a 
                href="/stacks" 
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition-colors group-hover:gap-3 duration-300"
              >
                Browse Stacks
                <FaArrowRight className="h-4 w-4" />
              </a>
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

      {/* FAQ Section */}
      <section ref={useScrollFade()} className="bg-zinc-900 py-20">
        <FAQ title="Frequently Asked Questions" 
        items={faqData}
        theme="dark"
         />
      </section>

      <Footer />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<AboutPageProps> = async (context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('about');
  } catch (error) {
    console.error("Error fetching page meta data for about page:", error);
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

export default AboutPage;