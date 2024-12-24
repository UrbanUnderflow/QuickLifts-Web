import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState } from 'react';
import Header, { Section } from '../components/Header';
import SignInModal from '../components/SignInModal';
import Footer from '../components/Footer/Footer';

const RoundsPage: NextPage = () => {
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSignInModalVisible, setIsSignInModalVisible] = useState(false);

  const handleSectionChange = (section: Section) => {
    setCurrentSection(section);
    setIsMobileMenuOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set('p', section);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const getMenuItemClassName = (section: Section) => {
    return `text-base font-medium capitalize ${
      currentSection === section ? 'text-[#14B8A6] font-bold' : 'text-gray-700'
    }`;
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>Rounds - Create and Share Fitness Videos | Pulse</title>
        <meta 
          name="description" 
          content="Share your fitness journey through quick, engaging videos. Connect with fellow fitness enthusiasts and showcase your progress." 
        />
        <meta property="og:title" content="Rounds - Create and Share Fitness Videos | Pulse" />
        <meta 
          property="og:description" 
          content="Share your fitness journey through quick, engaging videos. Connect with fellow fitness enthusiasts and showcase your progress." 
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/rounds-preview.jpg" />
      </Head>

      {/* Header */}
      <div className="flex justify-between items-center pt-10">
        <Header 
          onSectionChange={handleSectionChange} 
          currentSection={currentSection} 
          toggleMobileMenu={toggleMobileMenu} 
          setIsSignInModalVisible={() => setIsSignInModalVisible(true)}
          theme="dark"
        />
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-25 z-10 transition-opacity duration-300 ease-in-out" onMouseDown={() => setIsMobileMenuOpen(false)}>
          <div className={`fixed inset-y-0 right-0 w-64 bg-white shadow-md transform transition-transform duration-300 ease-in-out z-20 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`} onMouseDown={(e) => e.stopPropagation()}>
            <div className="p-4 flex flex-col gap-6">
              <button className={getMenuItemClassName('home')} onClick={() => handleSectionChange('home')}>Features</button>
              <button className={getMenuItemClassName('creator')} onClick={() => handleSectionChange('creator')}>Creators</button>
              <button className={getMenuItemClassName('support')} onClick={() => handleSectionChange('support')}>Support</button>
              <button className={getMenuItemClassName('contact')} onClick={() => { setIsMobileMenuOpen(false); window.location.href = 'mailto:pulsefitnessapp@gmail.com'; }}>Contact Us</button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <main className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        {/* Phone Frame Container (Left) */}
        <div className="relative w-[300px] sm:w-[380px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10]" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/rounds.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Introducing Rounds
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Create, Share, and Join Your Digital Community Workout.
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Think of a Round like a group challenge. A Round transforms 
            your typically solo daily workouts into a group event where 
            together people can track progress, share victories and push 
            each other forward over a defined timeline.
          </p>
        </div>
      </main>

      {/* Progress Tracking Section */}
      <section className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        {/* Text Content First on Left */}
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Track Your Progress
          </h2>
          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
            Compete and crush your fitness goals
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Join the ultimate fitness competition! Race to the top of the leaderboard, earn points for every workout, and show off your winning streak. Challenge friends, unlock achievements, and celebrate victories together as you battle your way to becoming the champion of your Round.
          </p>
        </div>

        {/* Progress Card on Right */}
        <RoundProgress />
      </section>

      {/* Workout Program Section */}
      <section className="min-h-screen bg-zinc-900 flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        {/* Phone Frame Container (Left) */}
        <div className="relative w-[300px] sm:w-[380px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10]" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/round2.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Daily Workouts
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Follow structured workout programs
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Each Round comes with carefully workout programs designed by your community, broken down by day. Complete your assigned workouts, track your progress, and stay consistent with your fitness goals. The program can be done solo or even better with friends!
          </p>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="min-h-[50vh] bg-black flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-white text-5xl sm:text-6xl font-bold mb-6">
          Ready to join your first Round?
        </h2>
        <p className="text-zinc-400 text-xl max-w-2xl mb-10">
          Take the first step towards a more engaging fitness journey. Join a community of motivated individuals and start crushing your goals together.
        </p>
        <a 
          href="https://fitwithpulse.ai/challenge/cevWHBlBk7VobANRUsmC"
          className="bg-[#E0FE10] text-black px-12 py-4 rounded-full text-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors"
        >
          Join Now
        </a>
      </section>

      {/* SignIn Modal */}
      <SignInModal
        isVisible={isSignInModalVisible}
        onSignInSuccess={() => setIsSignInModalVisible(false)}
        onSignInError={(error) => console.error('Sign-in error:', error)}
        onSignUpSuccess={() => setIsSignInModalVisible(false)}
        onSignUpError={(error) => console.error('Sign-up error:', error)}
        onQuizComplete={() => console.log('Quiz completed')}
        onQuizSkipped={() => console.log('Quiz skipped')}
      />

      <Footer />
    </div>
  );
};

export default RoundsPage;


const RoundProgress = () => {
  return (
    <div className="bg-zinc-900/90 p-6 rounded-xl w-full max-w-md">
      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-zinc-800/50 p-4 rounded-xl">
          <div className="text-zinc-400 text-sm">Starts</div>
          <div className="text-white text-2xl font-semibold">Dec 18</div>
        </div>
        <div className="bg-zinc-800/50 p-4 rounded-xl">
          <div className="text-zinc-400 text-sm">Ends</div>
          <div className="text-white text-2xl font-semibold">Dec 25</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="bg-zinc-800/50 p-6 rounded-xl mb-6">
        <div className="grid grid-cols-3 gap-8">
          {/* Progress Circle */}
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-2">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-700"></div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-[#E0FE10]" 
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% 77%, 0 77%)',
                }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[#E0FE10] text-xl font-semibold">77%</span>
              </div>
            </div>
            <div className="text-zinc-400 text-sm">Progress</div>
          </div>
          
          {/* Days Left */}
          <div className="text-center">
            <div className="text-white text-3xl font-semibold mb-2">1</div>
            <div className="text-zinc-400 text-sm">Days Left</div>
          </div>
          
          {/* Total Stacks */}
          <div className="text-center">
            <div className="text-white text-3xl font-semibold mb-2">6/7</div>
            <div className="text-zinc-400 text-sm">Total Stacks</div>
          </div>
        </div>

        {/* Points Row */}
        <div className="flex justify-between mt-8 pt-8 border-t border-zinc-700/50">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-[#E0FE10] mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-white text-xl">175</span>
            <span className="text-zinc-400 ml-2">pts</span>
          </div>
          <div className="flex items-center">
            <svg className="w-6 h-6 text-yellow-500 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 3h14l3 4-10 13L2 7l3-4z" />
            </svg>
            <span className="text-white text-xl">#2</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="text-center">
            <div className="mb-1">
              <span className="text-orange-400 text-2xl">🔥</span>
            </div>
            <div className="text-white text-2xl font-semibold">5 day</div>
            <div className="text-zinc-400 text-sm">Streak</div>
          </div>
          <div className="text-center">
            <div className="mb-1">
              <span className="text-green-400 text-2xl">✓</span>
            </div>
            <div className="text-white text-2xl font-semibold">4</div>
            <div className="text-zinc-400 text-sm">Check-ins</div>
          </div>
        </div>
      </div>

      {/* Participants */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-xl">Participants</h3>
          <div className="flex gap-4">
            <button className="text-[#E0FE10]">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button className="text-zinc-400">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Participant List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-zinc-800/30 p-3 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-700"></div>
              <div>
                <div className="text-white">bobby</div>
                <div className="text-[#E0FE10] text-sm">275 pts</div>
              </div>
            </div>
            <div className="text-yellow-500">👑</div>
          </div>

          <div className="flex items-center justify-between bg-zinc-800/30 p-3 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-700"></div>
              <div>
                <div className="text-white">thetrefecta</div>
                <div className="text-[#E0FE10] text-sm">175 pts</div>
              </div>
            </div>
            <div className="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-sm">Active</div>
          </div>

          <div className="flex items-center justify-between bg-zinc-800/30 p-3 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-700"></div>
              <div>
                <div className="text-white">jaidus</div>
                <div className="text-zinc-400 text-sm">175 pts</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
