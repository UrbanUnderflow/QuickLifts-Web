import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState } from 'react';
import Header, { Section } from '../components/Header';
import SignInModal from '../components/SignInModal';
import Footer from '../components/Footer/Footer';
import FAQ from '../components/FAQ';
import { useScrollFade } from '../hooks/useScrollFade';



const AboutPage: NextPage = () => {
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSignInModalVisible, setIsSignInModalVisible] = useState(false);

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
      answer: "We are currently only on iOS, but you can use the web app on Android devices <a className='text-blue-500 hover:text-blue-700 focus:text-blue-700' href='https://fitwithpulse.ai/dashboard'>here</a>"
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

  const handleSectionChange = (section: Section) => {
    setCurrentSection(section);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>About Pulse - The Fitness Collective</title>
        <meta name="description" content="Discover how Pulse is transforming fitness through community-driven workouts and shared experiences." />
      </Head>

      {/* Header */}
      <Header 
        onSectionChange={handleSectionChange}
        currentSection={currentSection}
        toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        setIsSignInModalVisible={() => setIsSignInModalVisible(true)}
        theme="dark"
      />

      {/* What is Pulse Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center text-center px-8 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            What is Pulse
          </h2>
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8">
            The Fitness Collective
          </h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12">
            Pulse is more than just another fitness app - it's a collective movement 
            where every member contributes to and benefits from a shared fitness journey. 
            We're transforming solo workouts into shared experiences, turning individual 
            progress into collective inspiration, and building a community where everyone 
            has a voice in fitness.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="bg-zinc-800/50 rounded-xl p-6 max-w-[280px]">
              <h3 className="text-white text-xl font-semibold mb-2">Create</h3>
              <p className="text-zinc-400">Share your unique exercises and workout routines with the community</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-6 max-w-[280px]">
              <h3 className="text-white text-xl font-semibold mb-2">Connect</h3>
              <p className="text-zinc-400">Join a vibrant community of fitness enthusiasts and motivate each other</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-6 max-w-[280px]">
              <h3 className="text-white text-xl font-semibold mb-2">Grow</h3>
              <p className="text-zinc-400">Track your progress and evolve with a community that celebrates every win</p>
            </div>
          </div>
        </div>
      </section>

      {/* Moves Section */}
      <section ref={useScrollFade()} className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
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
                src="/move.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
        </div>
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            The Foundation
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Everything starts with a Move
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            A Move is the fundamental building block of Pulse. It's a 5-30 second video clip of a lift, stretch, exercise, or movement that is used to build a workout. Build your library of movements from basic exercises to complex variations, each Move you create becomes part of yours or maybe someone else fitness journey.
          </p>
        </div>
      </section>

      {/* Stacks Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="max-w-xl lg:order-1">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Build The Blocks
          </h2>
          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
            Stack your Moves into workouts
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Combine your Moves into powerful workouts called Stacks. Create personalized routines that target your goals, share them with the community, or discover Stacks created by others. Each Stack is a curated collection of Moves designed to challenge and inspire.
          </p>
        </div>
        <div className="relative w-[300px] sm:w-[380px] lg:order-2">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10]" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/stack.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-zinc-900 flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
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
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            The Community
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Share, discover, and grow together
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Join a vibrant community of fitness enthusiasts. Share your Moves and Stacks, discover new workouts, and connect with others on the same journey. In Pulse, every member contributes to a growing library of fitness content.
          </p>
        </div>
      </section>

      {/* Why Choose Pulse Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-black py-20">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">Why Choose Pulse</h2>
            <h3 className="text-white text-4xl font-bold">
              A User-Driven Fitness Community: <br />Collective Content, Support, and Growth
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
            <div>
              <h4 className="text-white text-xl font-semibold mb-4">Growth over perfection pledge</h4>
              <p className="text-zinc-400">We celebrate milestones and acknowledge that perfection is when we continue to push ourselves beyond what feels comfortable.</p>
            </div>
            <div>
              <h4 className="text-white text-xl font-semibold mb-4">We show up</h4>
              <p className="text-zinc-400">60 percent of the battle is simply just showing up at the gym with a plan. If we can get in the room, we can achieve our best, so we pledge to workout, share, and encourage others along the way.</p>
            </div>
            <div>
              <h4 className="text-white text-xl font-semibold mb-4">Progress over pressure</h4>
              <p className="text-zinc-400">We track what matters for lasting change – strength, endurance, mobility, not just what the scale says.</p>
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

export default AboutPage;