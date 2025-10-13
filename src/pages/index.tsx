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

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai"
      />

      {/* Hero Section - Updated with Web App Button */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden">
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
              Build Your Fitness Empire Through<br />
              Content, Community & Challenges
            </span>
          </h2>
          
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 max-w-3xl mx-auto animate-fade-in-up animation-delay-900">
            Convert boring content into actionable, gamified workouts. Turn your Moves into Stacks, launch community Rounds, and monetize your expertise.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in-up animation-delay-1200">
            <button
              onClick={onUseWebApp}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group"
            >
              Use Web App
              <FaArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a 
              href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
              className="inline-flex items-center gap-3 bg-zinc-900/80 text-white border border-zinc-700 hover:border-zinc-600 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-800/80 transition-all duration-300"
            >
              Download iOS App
              <FaApple className="h-5 w-5" />
            </a>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 animate-fade-in-up animation-delay-1500">
            <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/30 hover:border-[#E0FE10]/50 rounded-3xl p-6 max-w-[280px] cursor-pointer transform hover:-translate-y-2 transition-all duration-500 hover:shadow-lg hover:shadow-[#E0FE10]/20 group">
              <div className="w-12 h-12 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <FaBolt className="h-6 w-6 text-black" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Create Content</h3>
              <p className="text-zinc-400">Record Moves & build your exercise library</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-400/30 hover:border-purple-400/50 rounded-3xl p-6 max-w-[280px] cursor-pointer transform hover:-translate-y-2 transition-all duration-500 hover:shadow-lg hover:shadow-purple-400/20 group">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <FaGamepad className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Launch Rounds</h3>
              <p className="text-zinc-400">Turn Stacks into community challenges</p>
            </div>
            
            <div className="bg-gradient-to-br from-orange-500/10 to-pink-500/10 backdrop-blur-sm border border-orange-400/30 hover:border-orange-400/50 rounded-3xl p-6 max-w-[280px] cursor-pointer transform hover:-translate-y-2 transition-all duration-500 hover:shadow-lg hover:shadow-orange-400/20 group">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <FaCoins className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Earn Revenue</h3>
              <p className="text-zinc-400">Monetize through subscriptions & royalties</p>
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
                      Record <span className="text-white font-medium">5-30 second exercise videos</span> that become reusable content assets. Build your library of signature movements.
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
                      Combine Moves into <span className="text-white font-medium">complete workout programs</span> called Stacks. Package your expertise into sellable content.
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
                      Turn your Stacks into <span className="text-white font-medium">competitive challenges</span> called Rounds. Set prizes, duration, and build your community.
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
                      Members join your Rounds, engage with your content, and <span className="text-white font-medium">build loyalty</span> to your brand through gamified challenges.
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
                      See how your community performs with <span className="text-white font-medium">real data and insights</span>. Know what works and optimize your content.
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
                      Use <span className="text-white font-medium">AI insights</span> to improve your content. See what resonates, what drives results, and what keeps people coming back.
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
                      Generate income through <span className="text-white font-medium">multiple revenue streams</span>: Stack subscriptions, Round entry fees, and automated creator royalties.
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

      {/* Apple Watch & Data Revolution Section - New */}
      <section className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-blue-950/30 to-zinc-950"></div>
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500/8 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-500/8 rounded-full filter blur-3xl animate-pulse animation-delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500/6 rounded-full filter blur-3xl animate-pulse animation-delay-2000"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12 lg:mb-20">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-400/30 rounded-full mb-6 lg:mb-8">
              <FaRocket className="h-4 w-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-medium">Data Revolution</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 lg:mb-8 tracking-tight">
              Your Wrist Captures More Data
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Than Apollo Astronauts
              </span>
            </h2>
            
            <p className="text-lg lg:text-xl text-zinc-400 max-w-4xl mx-auto leading-relaxed mb-8 lg:mb-12">
              Today's Apple Watch collects more comprehensive health data in a single workout than NASA captured 
              from entire Apollo missions. But raw data is just numbers—until you add the human story.
            </p>
          </div>

          {/* Main Content Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-16 lg:mb-24">
            
            {/* Left: Apollo vs Apple Watch Comparison */}
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-zinc-900/80 to-blue-950/40 backdrop-blur-sm border border-blue-400/20 rounded-3xl p-8 lg:p-10">
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-6">Apollo Mission Data</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-zinc-400">Heart Rate</span>
                    <span className="text-blue-400 font-mono">Basic monitoring</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-zinc-400">Body Temperature</span>
                    <span className="text-blue-400 font-mono">Limited sensors</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-zinc-400">Sleep Data</span>
                    <span className="text-red-400 font-mono">None</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-zinc-400">Activity Tracking</span>
                    <span className="text-red-400 font-mono">Manual logs</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Contextual Data</span>
                    <span className="text-red-400 font-mono">Radio reports only</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-[#E0FE10]/10 to-cyan-500/10 backdrop-blur-sm border border-cyan-400/30 rounded-3xl p-8 lg:p-10">
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-6">Your Apple Watch</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-zinc-400">Heart Rate</span>
                    <span className="text-cyan-400 font-mono">Real-time + HRV</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-zinc-400">Movement</span>
                    <span className="text-cyan-400 font-mono">6-axis gyroscope</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-zinc-400">Blood Oxygen</span>
                    <span className="text-cyan-400 font-mono">Continuous SpO2</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-zinc-400">Sleep Quality</span>
                    <span className="text-cyan-400 font-mono">REM, Deep, Core</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">+ 20 More Metrics</span>
                    <span className="text-[#E0FE10] font-mono">Every second</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Visual Representation */}
            <div className="relative">
              <div className="relative z-10 bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-blue-400/30 rounded-3xl p-8 lg:p-12 text-center">
                <div className="w-24 h-24 lg:w-32 lg:h-32 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center">
                  <span className="text-2xl lg:text-3xl">⌚</span>
                </div>
                <h3 className="text-xl lg:text-2xl font-bold text-white mb-4">
                  More Data Points in One Workout
                </h3>
                <p className="text-zinc-400 mb-6">
                  Than NASA collected from the entire Apollo 11 mission
                </p>
                <div className="text-4xl lg:text-6xl font-bold text-cyan-400 mb-2">1000x</div>
                <div className="text-sm lg:text-base text-zinc-500">More comprehensive health insights</div>
              </div>
              
              {/* Floating data points */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-[#E0FE10]/20 to-lime-400/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-2xl flex items-center justify-center animate-bounce">
                <span className="text-[#E0FE10] text-xs font-bold">ECG</span>
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-purple-400/30 rounded-xl flex items-center justify-center animate-bounce animation-delay-1000">
                <span className="text-purple-400 text-xs font-bold">GPS</span>
              </div>
              <div className="absolute top-1/2 -left-6 w-18 h-18 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-sm border border-cyan-400/30 rounded-lg flex items-center justify-center animate-bounce animation-delay-2000">
                <span className="text-cyan-400 text-xs font-bold">VO2</span>
              </div>
            </div>
          </div>

          {/* Human Context Section */}
          <div className="bg-gradient-to-br from-zinc-900/80 to-purple-950/40 backdrop-blur-sm border border-purple-400/20 rounded-3xl p-8 lg:p-12 mb-16 lg:mb-24">
            <div className="text-center mb-8 lg:mb-12">
              <h3 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                But Data Without Context is Just 
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Noise</span>
              </h3>
              <p className="text-lg lg:text-xl text-zinc-300 max-w-3xl mx-auto leading-relaxed">
                <span className="text-white font-semibold">Pulse bridges</span> the gap between <span className="text-purple-300 font-medium">raw biometric data</span> and <span className="text-[#E0FE10] font-medium">meaningful insights</span> by capturing the <span className="text-cyan-300 font-medium">human story</span> behind every number.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              
              {/* How You Experience */}
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm border border-purple-400/20 rounded-2xl p-6 text-center group hover:border-purple-400/40 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white text-lg">🧠</span>
                </div>
                <h4 className="text-white font-bold mb-3">How You <span className="text-purple-300">Experience</span></h4>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  <span className="text-purple-200">"That felt easier than my heart rate suggests"</span> — Your <span className="font-medium">perception vs. data</span> tells the complete story.
                </p>
              </div>

              {/* How You Feel */}
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border border-blue-400/20 rounded-2xl p-6 text-center group hover:border-blue-400/40 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white text-lg">💭</span>
                </div>
                <h4 className="text-white font-bold mb-3">How You <span className="text-cyan-300">Feel</span></h4>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  <span className="font-medium text-cyan-200">Energy, motivation, confidence</span> — the emotional data no sensor captures but drives every rep.
                </p>
              </div>

              {/* Personal Context */}
              <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/20 rounded-2xl p-6 text-center group hover:border-[#E0FE10]/40 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-black text-lg">📝</span>
                </div>
                <h4 className="text-white font-bold mb-3">Personal <span className="text-[#E0FE10]">Context</span></h4>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  <span className="text-lime-200">"Stressed from work, didn't sleep well, but pushed through"</span> — context that explains the <span className="font-medium">why</span> behind numbers.
                </p>
              </div>

              {/* Decision Insights */}
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm border border-green-400/20 rounded-2xl p-6 text-center group hover:border-green-400/40 transition-all duration-300">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white text-lg">🎯</span>
                </div>
                <h4 className="text-white font-bold mb-3">Decision <span className="text-green-300">Story</span></h4>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Why you chose that weight, skipped that exercise, or pushed for an extra set — <span className="font-medium text-green-200">decisions</span> that shape your journey.
                </p>
              </div>
            </div>
          </div>

          {/* The Complete Story */}
          <div className="text-center mb-8 lg:mb-12">
            <h3 className="text-3xl lg:text-5xl font-bold text-white mb-8">
              <span className="bg-gradient-to-r from-[#E0FE10] via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Data + Context = 
              </span>
              <br />
              Your Story
            </h3>
            
            <div className="bg-gradient-to-br from-zinc-900/80 to-blue-950/40 backdrop-blur-sm border border-[#E0FE10]/30 rounded-3xl p-8 lg:p-12 max-w-4xl mx-auto">
              <p className="text-lg lg:text-xl text-zinc-300 leading-relaxed mb-8">
                <span className="text-white font-semibold">Biometric data</span> + <span className="text-cyan-300 font-semibold">personal context</span> = we don't just <span className="text-zinc-400">track</span> your fitness—we <span className="text-[#E0FE10] font-medium">understand</span> your journey. 
                This creates your personalized <span className="text-purple-300 font-medium">Work Score</span> and gamifies progress that's meaningful to <span className="text-white font-bold">YOU</span>.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="group">
                  <div className="text-4xl lg:text-5xl font-bold text-[#E0FE10] mb-2 group-hover:scale-110 transition-transform duration-300">📊</div>
                  <div className="text-white font-semibold mb-2">Raw Data</div>
                  <div className="text-zinc-400 text-sm">Heart rate, reps, weight, time</div>
                </div>
                
                <div className="group">
                  <div className="text-4xl lg:text-5xl mb-2 group-hover:scale-110 transition-transform duration-300">+</div>
                  <div className="text-white font-semibold mb-2">Human Context</div>
                  <div className="text-zinc-400 text-sm">Experience, feelings, decisions</div>
                </div>
                
                <div className="group">
                  <div className="text-4xl lg:text-5xl font-bold text-cyan-400 mb-2 group-hover:scale-110 transition-transform duration-300">🎮</div>
                  <div className="text-white font-semibold mb-2">Gamified Score</div>
                  <div className="text-zinc-400 text-sm">Personalized, meaningful progress</div>
                </div>
              </div>
            </div>
          </div>

          {/* Energy Story Example */}
          <div className="mt-16 lg:mt-24">
            <div className="text-center mb-8 lg:mb-12">
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                See It In Action: <span className="text-orange-400">Your Energy Story</span>
              </h3>
              <p className="text-zinc-400 max-w-2xl mx-auto">
                Here's how your Apple Watch data combines with human context to create a meaningful health narrative
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              
              {/* Mobile Phone Mockup */}
              <div className="relative mx-auto">
                <div className="relative w-[300px] h-[600px] bg-black rounded-[3rem] p-2 shadow-2xl">
                  {/* Phone Screen */}
                  <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black rounded-[2.5rem] overflow-hidden relative">
                    
                    {/* Status Bar */}
                    <div className="flex justify-between items-center px-6 py-2 text-white text-sm">
                      <span className="font-semibold">8:55</span>
                      <div className="flex items-center gap-1">
                        <div className="flex gap-1">
                          <div className="w-1 h-3 bg-white rounded-full"></div>
                          <div className="w-1 h-3 bg-white rounded-full"></div>
                          <div className="w-1 h-3 bg-white rounded-full"></div>
                          <div className="w-1 h-3 bg-gray-500 rounded-full"></div>
                        </div>
                        <span className="text-xs ml-2">78%</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 py-2">
                      {/* Header */}
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-white text-xl font-bold">Your Energy Story</h2>
                        <div className="bg-orange-500/20 border border-orange-400 rounded-full px-3 py-1 flex items-center gap-2">
                          <span className="text-orange-400 text-sm font-medium">-368 kcal deficit</span>
                          <span className="text-orange-400">😊</span>
                        </div>
                      </div>

                      {/* Main Card */}
                      <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-400/30 rounded-2xl p-4 mb-4">
                        {/* Fat Loss Mode Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">📈</span>
                          </div>
                          <div>
                            <h3 className="text-white font-bold">Fat Loss Mode 📈</h3>
                            <p className="text-gray-400 text-xs">You're in a solid deficit - great for steady fat loss progress!</p>
                          </div>
                        </div>

                        {/* Calories Comparison */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                              <span className="text-blue-400 text-sm">Calories In</span>
                            </div>
                            <div className="text-white text-lg font-bold">1,943 kcal</div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div className="bg-blue-400 h-2 rounded-full" style={{width: '75%'}}></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                              <span className="text-red-400 text-sm">Calories Out 🔥</span>
                            </div>
                            <div className="text-white text-lg font-bold">2,311 kcal</div>
                            <div className="text-xs text-gray-400">Active: 270 | Resting: 2,041</div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div className="bg-red-400 h-2 rounded-full" style={{width: '90%'}}></div>
                            </div>
                          </div>
                        </div>

                        {/* Net Result */}
                        <div className="text-center py-3 border-t border-gray-700">
                          <div className="text-gray-400 text-sm">Net Result:</div>
                          <div className="text-orange-400 text-xl font-bold flex items-center justify-center gap-2">
                            -368 kcal deficit 😊
                          </div>
                        </div>
                      </div>

                      {/* Understanding Section */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-400">💡</span>
                          <span className="text-yellow-400 text-sm font-semibold">Understanding Your Energy Burn</span>
                        </div>
                        <div className="text-xs text-gray-400 space-y-1">
                          <div>🟠 <span className="text-orange-400">Active Calories:</span> Energy burned through movement, exercise, and daily activities</div>
                          <div>🔴 <span className="text-red-400">Resting Calories:</span> Energy your body burns at rest for basic functions like breathing, circulation, and cell production</div>
                        </div>
                      </div>

                      {/* What This Means */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-400">💡</span>
                          <span className="text-yellow-400 text-sm font-semibold">What This Means</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          This deficit should result in about 1 pound of fat loss per week if maintained. Poor sleep significantly impacts metabolism, increasing hunger hormones and reducing energy expenditure.
                        </div>
                      </div>

                      {/* Recommendation */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-green-400">🎯</span>
                          <span className="text-green-400 text-sm font-semibold">Recommendation</span>
                        </div>
                        <div className="text-xs text-lime-300">
                          Strong deficit for fat loss. Monitor energy levels and consider refeed days if needed. Prioritize getting more sleep - it's crucial for your energy balance and fitness goals.
                        </div>
                      </div>

                      {/* Add to Story Button */}
                      <div className="bg-green-500/10 border border-green-400/30 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-green-400 text-sm font-medium">Add to Your Story</div>
                          <div className="text-gray-400 text-xs">Add context, notes, or missing data</div>
                        </div>
                        <span className="text-green-400">→</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
                    <span className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm">📊</span>
                    Apple Watch Data
                  </h4>
                  <div className="space-y-2 text-sm text-zinc-400">
                    <div>• <span className="text-blue-300">Calories burned:</span> 2,311 kcal (270 active + 2,041 resting)</div>
                    <div>• <span className="text-blue-300">Heart rate variability:</span> Sleep quality indicators</div>
                    <div>• <span className="text-blue-300">Activity rings:</span> Movement patterns throughout the day</div>
                    <div>• <span className="text-blue-300">Workout data:</span> Exercise intensity and duration</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
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
                  <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
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

                <div className="bg-gradient-to-r from-[#E0FE10]/10 to-orange-500/10 border border-[#E0FE10]/30 rounded-xl p-4">
                  <p className="text-[#E0FE10] text-sm">
                    <strong>This is the future of health tracking:</strong> Your Apple Watch provides the data foundation, but Pulse adds the human story that makes it meaningful and actionable.
                  </p>
                </div>
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
            <section className="min-h-screen bg-gradient-to-br from-zinc-950 via-purple-950/10 to-black py-20">
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
                 <button className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group">
                   Start Creating Today
                   <FaArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                 </button>
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

      {/* Core Products Section - HIDDEN FOR NOW */}
      {false && <section className="py-16 sm:py-24 lg:py-32 relative overflow-hidden bg-gradient-to-br from-zinc-950 via-purple-950/20 to-black">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/5 w-96 h-96 bg-[#E0FE10]/8 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-1/5 w-80 h-80 bg-purple-500/8 rounded-full filter blur-3xl animate-pulse animation-delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/8 rounded-full filter blur-3xl animate-pulse animation-delay-2000"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12 lg:mb-20">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-purple-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-6 lg:mb-8">
              <FaRocket className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">Core Products</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 lg:mb-8 tracking-tight">
              One Platform,
              <br />
              <span className="bg-gradient-to-r from-[#E0FE10] via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Three Powerful Products
              </span>
            </h2>
            
            <p className="text-lg lg:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
              <span className="text-white font-semibold">Pulse</span> serves as the central data engine, powering specialized experiences through <span className="text-purple-300 font-medium">Pulse Programming</span> and <span className="text-blue-300 font-medium">PulseCheck</span>.
            </p>
          </div>

          {/* Products Ecosystem Diagram */}
          <div className="relative max-w-6xl mx-auto">
            {/* Connection Lines */}
            <div className="hidden lg:block absolute inset-0 z-0">
              {/* Left connection line */}
              <div className="absolute top-1/2 left-[20%] right-[60%] h-1 bg-gradient-to-r from-purple-400/60 to-[#E0FE10]/60 transform -translate-y-1/2"></div>
              {/* Right connection line */}
              <div className="absolute top-1/2 left-[60%] right-[20%] h-1 bg-gradient-to-r from-[#E0FE10]/60 to-blue-400/60 transform -translate-y-1/2"></div>
              
              {/* Animated data flow dots */}
              <div className="absolute top-1/2 left-[25%] w-3 h-3 bg-purple-400 rounded-full transform -translate-y-1/2 animate-pulse"></div>
              <div className="absolute top-1/2 left-[35%] w-2 h-2 bg-[#E0FE10] rounded-full transform -translate-y-1/2 animate-pulse animation-delay-500"></div>
              <div className="absolute top-1/2 right-[35%] w-2 h-2 bg-[#E0FE10] rounded-full transform -translate-y-1/2 animate-pulse animation-delay-1000"></div>
              <div className="absolute top-1/2 right-[25%] w-3 h-3 bg-blue-400 rounded-full transform -translate-y-1/2 animate-pulse animation-delay-1500"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-center relative z-10">
              
              {/* Pulse Programming */}
              <div className="group bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm border border-purple-400/30 hover:border-purple-400/50 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20 cursor-pointer transform hover:-translate-y-2">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <FaRocket className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Pulse Programming</h3>
                  <p className="text-purple-300 text-sm font-medium mb-4">AI-Powered Workout Generation</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span className="text-sm">Custom workout plans</span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span className="text-sm">AI exercise selection</span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span className="text-sm">Progressive overload</span>
                  </div>
                </div>

                <div className="bg-purple-500/10 border border-purple-400/20 rounded-xl p-4 mb-4">
                  <p className="text-purple-300 text-xs">
                    <strong>Powered by Pulse:</strong> Uses your workout history, preferences, and progress data to generate personalized programs.
                  </p>
                </div>

                <a 
                  href="/programming" 
                  className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors group-hover:gap-3 duration-300"
                >
                  Learn More
                  <FaArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* Pulse (Central) */}
              <div className="lg:scale-110 group bg-gradient-to-br from-[#E0FE10]/15 to-lime-400/15 backdrop-blur-sm border-2 border-[#E0FE10]/40 hover:border-[#E0FE10]/60 rounded-3xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-[#E0FE10]/30 cursor-pointer transform hover:-translate-y-3">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 relative">
                    <FaBolt className="h-10 w-10 text-black" />
                    {/* Pulsing ring effect */}
                    <div className="absolute inset-0 rounded-3xl border-2 border-[#E0FE10] animate-ping opacity-20"></div>
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-3">Pulse</h3>
                  <p className="text-[#E0FE10] text-sm font-medium mb-4">The Data Engine</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                    <span className="text-sm">Workout tracking & scoring</span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                    <span className="text-sm">Community & challenges</span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                    <span className="text-sm">Health data integration</span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                    <span className="text-sm">Creator tools & economy</span>
                  </div>
                </div>

                <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-xl p-4 mb-4">
                  <p className="text-[#E0FE10] text-xs">
                    <strong>Central Hub:</strong> All your fitness data, social connections, and achievements live here. Powers all other Pulse products.
                  </p>
                </div>

                <a 
                  href="/app" 
                  className="inline-flex items-center gap-2 text-[#E0FE10] hover:text-lime-300 font-medium transition-colors group-hover:gap-3 duration-300"
                >
                  Open Pulse
                  <FaArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* PulseCheck */}
              <div className="group bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border border-blue-400/30 hover:border-blue-400/50 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/20 cursor-pointer transform hover:-translate-y-2">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <FaChartLine className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">PulseCheck</h3>
                  <p className="text-blue-300 text-sm font-medium mb-4">Health Insights & Analytics</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-sm">Health data stories</span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-sm">Trend analysis</span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-300">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-sm">Personalized insights</span>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4 mb-4">
                  <p className="text-blue-300 text-xs">
                    <strong>Powered by Pulse:</strong> Analyzes your Pulse workout data, health metrics, and patterns to deliver actionable insights.
                  </p>
                </div>

                <a 
                  href="/pulsecheck" 
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors group-hover:gap-3 duration-300"
                >
                  Explore PulseCheck
                  <FaArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Data Flow Indicators */}
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-4 bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 rounded-full px-6 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                  <span className="text-purple-300 text-sm">Data Flow</span>
                </div>
                <div className="w-1 h-6 bg-zinc-600"></div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#E0FE10] rounded-full animate-pulse animation-delay-500"></div>
                  <span className="text-[#E0FE10] text-sm">Central Engine</span>
                </div>
                <div className="w-1 h-6 bg-zinc-600"></div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse animation-delay-1000"></div>
                  <span className="text-blue-300 text-sm">Insights</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>}

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