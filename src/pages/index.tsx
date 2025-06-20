import React, { useState, useEffect } from 'react';
import type { NextPage, GetServerSideProps } from 'next';
import Footer from '../components/Footer/Footer';
import FAQ from '../components/FAQ';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';
import { FaTrophy, FaCoins, FaGamepad, FaChartLine, FaFire, FaStar, FaRocket, FaBolt, FaArrowRight } from 'react-icons/fa6';
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
              Download App
              <FaRocket className="h-5 w-5" />
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
                Every workout generates a unique Work Score based on intensity, form, and progression. Watch your scores climb as you get stronger and more consistent.
              </p>
              <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-3 lg:p-4">
                <p className="text-[#E0FE10] text-xs lg:text-sm">
                  <strong>Level Up:</strong> Achieve higher Work Scores to unlock new exercises, challenges, and creator tools.
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
                Unlock badges, titles, and special features as you hit milestones. From "First Rep" to "Iron Warrior", every achievement tells your fitness story.
              </p>
              <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-3 lg:p-4">
                <p className="text-lime-300 text-xs lg:text-sm">
                  <strong>Collect Them All:</strong> 50+ unique achievements spanning strength, consistency, community engagement, and creativity.
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
                Fitness creators earn real rewards through content creation, challenge hosting, and community building. Turn your passion into profit.
              </p>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 lg:p-4">
                <p className="text-green-300 text-xs lg:text-sm">
                  <strong>Multiple Streams:</strong> Earn through premium content, private coaching, sponsored challenges, and community tips.
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
                Compete on global, local, and friend leaderboards. Track weekly wins, monthly consistency, and all-time personal records.
              </p>
              <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-3 lg:p-4">
                <p className="text-[#E0FE10] text-xs lg:text-sm">
                  <strong>Fair Play:</strong> Skill-based matchmaking ensures you compete with people at your fitness level.
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
                Join themed challenges with real prizes. From gear giveaways to exclusive creator meet-ups, every challenge has something to win.
              </p>
              <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-3 lg:p-4">
                <p className="text-lime-300 text-xs lg:text-sm">
                  <strong>Weekly Prizes:</strong> New challenges every week with prizes ranging from Pulse swag to premium fitness equipment.
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
                See your fitness journey come to life with animated progress bars, streak counters, and achievement animations that celebrate every win.
              </p>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 lg:p-4">
                <p className="text-green-300 text-xs lg:text-sm">
                  <strong>Motivation Boost:</strong> Visual feedback increases workout consistency by 40% compared to traditional tracking.
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
            <h3 className="text-white text-4xl lg:text-5xl font-bold">
              Not Just Another Fitness App: <br /><span className="bg-gradient-to-r from-[#E0FE10] via-purple-400 to-blue-400 bg-clip-text text-transparent">With Pulse, You Shape The Experience</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/20 hover:border-[#E0FE10]/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaGamepad className="h-6 w-6 text-black" />
              </div>
              <h4 className="text-white text-xl font-semibold mb-4">
                User-Generated Content
              </h4>
              <p className="text-zinc-400 leading-relaxed">Unlike platforms with fixed workout libraries, Pulse lets you create and share your own exercises and routines. For trainers, this means a powerful tool to scale your influence and showcase your expertise to a wider audience.</p>
            </div>
            <div className="group bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border border-purple-400/20 hover:border-purple-400/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20 cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaTrophy className="h-6 w-6 text-white" />
              </div>
              <h4 className="text-white text-xl font-semibold mb-4">
                Community Challenges
              </h4>
              <p className="text-zinc-400 leading-relaxed">Our Rounds feature turns fitness into a social experience. Trainers can create branded competitions to keep clients engaged, while fitness enthusiasts can find accountability partners that make showing up feel effortless.</p>
            </div>
            <div className="group bg-gradient-to-br from-orange-500/10 to-pink-500/10 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-orange-400/20 cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FaChartLine className="h-6 w-6 text-white" />
              </div>
              <h4 className="text-white text-xl font-semibold mb-4">
                Data-Driven Growth
              </h4>
              <p className="text-zinc-400 leading-relaxed">We track meaningful metrics with our Work Score system that matters for lasting change. Get actionable insights that both trainers and clients can use to optimize workouts and celebrate real progress.</p>
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