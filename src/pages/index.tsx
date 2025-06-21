import React, { useState, useEffect } from 'react';
import type { NextPage, GetServerSideProps } from 'next';
import Footer from '../components/Footer/Footer';
import FAQ from '../components/FAQ';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';
import { FaTrophy, FaCoins, FaGamepad, FaChartLine, FaFire, FaStar, FaRocket, FaBolt, FaArrowRight, FaArrowsRotate } from 'react-icons/fa6';
import { FaApple } from 'react-icons/fa';
import HomeContent from './HomeContent';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface HomePageProps {
  metaData: SerializablePageMetaData | null;
}

const STORAGE_KEY = 'pulse_has_seen_marketing';

// Separate component for marketing content to avoid hook issues
const MarketingContent: React.FC<{ onUseWebApp: () => void; metaData: SerializablePageMetaData | null }> = ({ onUseWebApp, metaData }) => {
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
              A gamified fitness platform where creators earn,<br />
              members level up, and everyone wins together
            </span>
          </h2>
          
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 max-w-3xl mx-auto animate-fade-in-up animation-delay-900">
            Transform your fitness journey into an engaging game where every workout earns rewards, 
            every milestone unlocks achievements, and every creator can build their empire.
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

      {/* Gamification Section - New Bold & Colorful */}
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
              <FaGamepad className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">Fitness Meets Gaming</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 lg:mb-8 tracking-tight">
              Level Up Your
              <br />
              <span className="bg-gradient-to-r from-[#E0FE10] via-lime-400 to-green-400 bg-clip-text text-transparent">
                Fitness Game
              </span>
            </h2>
            
            <p className="text-lg lg:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed mb-8 lg:mb-12">
              We've transformed traditional fitness tracking into an engaging RPG-like experience where every rep counts, every milestone matters, and every achievement unlocks new possibilities.
            </p>
          </div>

          {/* Gamification Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-12 lg:mb-20">
            {/* Work Score System */}
            <div className="group bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/30 rounded-3xl p-6 lg:p-8 hover:border-[#E0FE10]/50 transition-all duration-300">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaChartLine className="h-6 w-6 lg:h-8 lg:w-8 text-black" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Work Score System</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Every workout gets a <span className="text-white font-medium">unique score</span> based on intensity, form, and progression. Watch your scores climb as you improve.
              </p>
              <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-3 lg:p-4">
                <p className="text-[#E0FE10] text-xs lg:text-sm">
                  <strong>Level Up:</strong> Higher scores unlock exercises, challenges, and creator tools.
                </p>
              </div>
            </div>

            {/* Achievement System */}
            <div className="group bg-gradient-to-br from-lime-500/10 to-green-500/10 backdrop-blur-sm border border-lime-400/30 rounded-3xl p-6 lg:p-8 hover:border-lime-400/50 transition-all duration-300">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-lime-500 to-green-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaTrophy className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Achievement Unlocks</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Unlock <span className="text-lime-300 font-medium">badges, titles, and features</span> as you hit milestones. From "First Rep" to "Iron Warrior".
              </p>
              <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-3 lg:p-4">
                <p className="text-lime-300 text-xs lg:text-sm">
                  <strong>Collect Them All:</strong> 50+ achievements across strength, consistency, and community.
                </p>
              </div>
            </div>

            {/* Creator Earnings */}
            <div className="group bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm border border-green-400/30 rounded-3xl p-6 lg:p-8 hover:border-green-400/50 transition-all duration-300">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaCoins className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Creator Economy</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Fitness creators earn <span className="text-green-300 font-medium">real rewards</span> through content creation, challenges, and community building.
              </p>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 lg:p-4">
                <p className="text-green-300 text-xs lg:text-sm">
                  <strong>Multiple Streams:</strong> Premium content, coaching, challenges, and tips.
                </p>
              </div>
            </div>

            {/* Leaderboards */}
            <div className="group bg-gradient-to-br from-[#E0FE10]/10 to-yellow-400/10 backdrop-blur-sm border border-[#E0FE10]/30 rounded-3xl p-6 lg:p-8 hover:border-[#E0FE10]/50 transition-all duration-300">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-[#E0FE10] to-yellow-400 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaFire className="h-6 w-6 lg:h-8 lg:w-8 text-black" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Dynamic Leaderboards</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Compete on <span className="text-yellow-300 font-medium">global, local, and friend</span> leaderboards. Track wins, consistency, and records.
              </p>
              <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-3 lg:p-4">
                <p className="text-[#E0FE10] text-xs lg:text-sm">
                  <strong>Fair Play:</strong> Skill-based matching keeps competition balanced.
                </p>
              </div>
            </div>

            {/* Challenge Rewards */}
            <div className="group bg-gradient-to-br from-lime-600/10 to-[#E0FE10]/10 backdrop-blur-sm border border-lime-400/30 rounded-3xl p-6 lg:p-8 hover:border-lime-400/50 transition-all duration-300">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-lime-600 to-[#E0FE10] rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaStar className="h-6 w-6 lg:h-8 lg:w-8 text-black" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Challenge Rewards</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                Join themed challenges with <span className="text-lime-300 font-medium">real prizes</span>. Gear giveaways, creator meet-ups, and more.
              </p>
              <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-3 lg:p-4">
                <p className="text-lime-300 text-xs lg:text-sm">
                  <strong>Weekly Prizes:</strong> From Pulse swag to premium fitness equipment.
                </p>
              </div>
            </div>

            {/* Progress Visualization */}
            <div className="group bg-gradient-to-br from-green-600/10 to-lime-500/10 backdrop-blur-sm border border-green-400/30 rounded-3xl p-6 lg:p-8 hover:border-green-400/50 transition-all duration-300">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-green-600 to-lime-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaBolt className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 lg:mb-4">Visual Progress</h3>
              <p className="text-zinc-400 leading-relaxed text-sm lg:text-base mb-4 lg:mb-6">
                <span className="text-green-300 font-medium">Animated progress bars</span>, streak counters, and achievement animations that celebrate every win.
              </p>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 lg:p-4">
                <p className="text-green-300 text-xs lg:text-sm">
                  <strong>Motivation Boost:</strong> Visual feedback increases consistency by 40%.
                </p>
              </div>
            </div>
          </div>

          {/* Gamification Impact Statement */}
          <div className="bg-gradient-to-br from-zinc-900/80 to-green-950/40 backdrop-blur-sm border border-[#E0FE10]/20 rounded-3xl p-12 text-center">
            <h3 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              Why Gamification Works for Fitness
            </h3>
            <p className="text-xl text-zinc-300 mb-8 max-w-4xl mx-auto leading-relaxed">
              Studies show that gamified fitness apps increase user engagement by <span className="text-[#E0FE10] font-bold">67%</span>, 
              improve workout consistency by <span className="text-lime-400 font-bold">45%</span>, and help users achieve their goals 
              <span className="text-green-400 font-bold"> 3x faster</span> than traditional tracking methods.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="text-center">
                <div className="text-4xl font-bold text-[#E0FE10] mb-2">67%</div>
                <div className="text-zinc-400">Higher Engagement</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-lime-400 mb-2">45%</div>
                <div className="text-zinc-400">Better Consistency</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-400 mb-2">3x</div>
                <div className="text-zinc-400">Faster Goal Achievement</div>
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

      {/* Why Choose Pulse Section - Enhanced */}
      <section className="min-h-screen bg-gradient-to-br from-zinc-950 via-purple-950/10 to-black py-20">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-purple-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-8">
              <FaStar className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">Why Choose Pulse</span>
            </div>
            <h3 className="text-white text-4xl lg:text-5xl font-bold mb-6">
              Not Just Another Fitness App: <br /><span className="bg-gradient-to-r from-[#E0FE10] via-purple-400 to-blue-400 bg-clip-text text-transparent">With Pulse, You Shape The Experience</span>
            </h3>
            <p className="text-zinc-400 text-lg max-w-4xl mx-auto leading-relaxed">
              Here's how we create the stickiest fitness ecosystem ever built: Every Move you create fuels your personal library, every Stack you build establishes your expertise, every Round you join connects you to a community that celebrates your growth. It's not just gamification—it's a flywheel that makes quitting impossible.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="group bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/20 hover:border-[#E0FE10]/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaGamepad className="h-6 w-6 text-black" />
              </div>
              <h4 className="text-white text-xl font-semibold mb-4">
                Your Content, Your Empire
              </h4>
              <p className="text-zinc-400 leading-relaxed mb-4"><span className="text-white font-medium">Create</span> your own exercises and workouts. <span className="text-[#E0FE10] font-medium">Monetize</span> your expertise. Build your following.</p>
              <div className="text-[#E0FE10] text-sm font-medium">
                → Create once, earn forever
              </div>
            </div>
            <div className="group bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-400/20 hover:border-purple-400/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20 cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaTrophy className="h-6 w-6 text-white" />
              </div>
              <h4 className="text-white text-xl font-semibold mb-4">
                Community That Keeps You Coming Back
              </h4>
              <p className="text-zinc-400 leading-relaxed mb-4">Friends counting on you. <span className="text-purple-300 font-medium">Team rewards</span>. Leaderboard competition. <span className="text-white font-medium">Showing up becomes inevitable</span>.</p>
              <div className="text-purple-300 text-sm font-medium">
                → Win together, stay together
              </div>
            </div>
            <div className="group bg-gradient-to-br from-orange-500/10 to-pink-500/10 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-orange-400/20 cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaChartLine className="h-6 w-6 text-white" />
              </div>
              <h4 className="text-white text-xl font-semibold mb-4">
                Data Stories That Drive Action
              </h4>
              <p className="text-zinc-400 leading-relaxed mb-4"><span className="text-orange-300 font-medium">Work Score</span> transforms raw data into your <span className="text-white font-medium">victory story</span>. Track progress, unlock achievements.</p>
              <div className="text-orange-300 text-sm font-medium">
                → Progress you can feel and see
              </div>
            </div>
          </div>

          {/* The Ecosystem Flow */}
          <div className="bg-gradient-to-br from-zinc-900/50 to-purple-900/20 backdrop-blur-sm border border-zinc-700/50 rounded-3xl p-8 lg:p-12 mb-16">
            <div className="text-center mb-8">
              <h4 className="text-white text-2xl lg:text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-[#E0FE10] to-purple-400 bg-clip-text text-transparent">The Pulse Flywheel:</span> How We Keep You Hooked
              </h4>
              <p className="text-zinc-400 text-lg">Every action you take makes the next one easier, more rewarding, and more connected to your community.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <FaBolt className="h-8 w-8 text-black" />
                </div>
                <h5 className="text-white font-semibold mb-2">Create Moves</h5>
                <p className="text-zinc-400 text-sm">Record exercises, earn XP, build your library</p>
              </div>
              
              <div className="flex justify-center">
                <FaArrowRight className="h-6 w-6 text-purple-400 transform rotate-90 lg:rotate-0" />
              </div>
              
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <FaRocket className="h-8 w-8 text-white" />
                </div>
                <h5 className="text-white font-semibold mb-2">Build Stacks</h5>
                <p className="text-zinc-400 text-sm">Combine into workouts, establish expertise, earn income</p>
              </div>
              
              <div className="flex justify-center">
                <FaArrowRight className="h-6 w-6 text-blue-400 transform rotate-90 lg:rotate-0" />
              </div>
              
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <FaTrophy className="h-8 w-8 text-white" />
                </div>
                <h5 className="text-white font-semibold mb-2">Join Rounds</h5>
                <p className="text-zinc-400 text-sm">Compete with friends, win rewards, stay accountable</p>
              </div>
            </div>
            
            <div className="text-center mt-8">
              <div className="inline-flex items-center gap-2 text-[#E0FE10] font-medium">
                <FaArrowsRotate className="h-4 w-4" />
                <span>The cycle repeats, getting stronger every time</span>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
    </div>
  );
};

const HomePage: NextPage<HomePageProps> = ({ metaData }) => {
  const [showMarketing, setShowMarketing] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has seen marketing content before
    const hasSeenMarketing = localStorage.getItem(STORAGE_KEY);
    if (hasSeenMarketing === 'true') {
      setShowMarketing(false);
    }
    setIsLoading(false);
  }, []);

  const handleUseWebApp = () => {
    // Set flag that user has seen marketing and wants to use web app
    localStorage.setItem(STORAGE_KEY, 'true');
    setShowMarketing(false);
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

  // Show web app if user has seen marketing
  if (!showMarketing) {
    return (
      <div className="h-screen relative">
        <HomeContent />
        {/* Optional: Add a small button to go back to marketing view */}
        <button
          onClick={handleBackToMarketing}
          className="fixed bottom-4 right-4 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg text-xs opacity-50 hover:opacity-100 transition-opacity z-50"
          title="View marketing page"
        >
          About Pulse
        </button>
      </div>
    );
  }

  // Show marketing content
  return <MarketingContent onUseWebApp={handleUseWebApp} metaData={metaData} />;
};

export const getServerSideProps: GetServerSideProps<HomePageProps> = async (context) => {
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
        }
      };
    }
    
    return {
      props: {
        metaData: null
      }
    };
  } catch (error) {
    console.error('Error fetching meta data:', error);
    
    return {
      props: {
        metaData: null
      }
    };
  }
};

export default HomePage;