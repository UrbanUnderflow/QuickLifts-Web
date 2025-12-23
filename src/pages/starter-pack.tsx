import React, { useState } from 'react';
import { Check, Dumbbell, Layers, Timer } from 'lucide-react';
import Head from 'next/head';
import FAQ from '../components/FAQ';
import Meta from '../components/Meta';

const CREATOR_STEPS = [
  {
    title: "Account Creation",
    description: "Start your creator journey by setting up your profile. A complete profile helps build trust with your community and showcases your fitness expertise. Take time to craft a bio that highlights your unique perspective and training style.",
    detailedSteps: [
      "Download the app",
      "Sign up using your email or sign in with apple'",
      "Upload a profile image",
    ],
    image: "/step1StarterPack.png",
    mobileImage: "/step1StarterPack.png"
  },
  {
    title: "Set Up Your Profile",
    description: "Make your profile stand out by sharing your fitness story. Whether you're a certified trainer or passionate enthusiast, your unique perspective matters. Connect your social media to expand your reach and let people know where to find more of your content.",
    detailedSteps: [
      "Fill out profile description",
      "Add social media handles",
    ],
    image: "/step2StarterPack.png",
    mobileImage: "/step2StarterPack.png"
  },
  {
    title: "Upload Your First Content",
    description: "Time to share your expertise! Create your first Move by recording an exercise, combine Moves into a Stack for a complete workout, and organize your Stacks into a Round for a full training program. Each piece of content you create helps others on their fitness journey.",
    detailedSteps: [
      "Record or upload your first move",
      "Create your first 'Stack'",
      "Create a 'Round'"
    ],
    image: "/step3StarterPack.png",
    mobileImage: "/step3StarterPack.png"
  },
  {
    title: "Start a workout",
    description: "Experience Pulse from your community's perspective. Try out your own workout or join someone else's Round. This helps you understand the user experience and creates authentic content that resonates with your audience.",
    detailedSteps: [
      "Start and complete your first workout",
      "Join a 'Round'",
    ],
    image: "/step4StarterPack.png",
    mobileImage: "/step4StarterPack.png"
  }
];

const FAQ_DATA = [
  {
    question: "How do I earn through Pulse?",
    answer: "Your earnings grow with your community impact. Get rewarded for Stack completions, Round participation, and community engagement. The more value you create, the more you earn."
  },
  {
    question: "What makes a successful Round?",
    answer: "Great Rounds combine engaging workouts with active community participation. Focus on consistent interaction, clear instructions, and celebrating member progress."
  },
  {
    question: "How often should I create content?",
    answer: "Quality beats quantity. We recommend 2-3 new Moves or Stacks weekly, but focus on creating value for your community rather than hitting specific numbers."
  },
  {
    question: "Do I need special equipment to create content?",
    answer: "Just your smartphone! While professional equipment can enhance quality, many successful creators start with just their phones and natural lighting."
  },
  {
    question: "What is the Founding 100 Coaches Program?",
    answer: "It's our exclusive early access program for the first 100 fitness professionals on our platform. Members receive lifetime free access to Pulse, direct support from our team, and recognition as founding creators of our community."
  }
];

const CreatorStarterPack = () => {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const siteUrl = 'https://fitwithpulse.ai';
  const pageUrl = `${siteUrl}/starter-pack`;
  const title = 'Getting Started with Pulse | Creator Guide';
  const description = 'Learn how to set up your Pulse creator account and start building your fitness community. Complete guide for new Pulse coaches and trainers.';

  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>

      <Meta title={title} description={description} url={pageUrl} />

      <div className="bg-[#E0FE10]/10 border-l-4 border-[#E0FE10] p-4 mx-4 md:mx-auto max-w-5xl mt-8">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg mb-1">
              Welcome to Pulse! 
            </h3>
            <p className="text-zinc-300">
              Ready to start your creator journey? This guide will help you set up your Pulse account and create your first content. Follow these steps to make the most of your fitness journey with Pulse.
            </p>
          </div>
          <div>
            <a
              href="/creators"
              className="text-zinc-400 hover:text-white text-sm whitespace-nowrap"
            >
              Apply to join →
            </a>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="min-h-[80vh] py-20 text-center flex flex-col items-center justify-center">
        <div className="max-w-3xl mx-auto px-4 space-y-12">
          {/* App Introduction */}
          <div>
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Creator Getting Started Guide
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8">
              Welcome to <span className="text-[#E0FE10]">Pulse</span>
            </h1>
            <p className="text-zinc-400 text-xl leading-relaxed">
              Start building your community and impact today! This guide will help you set up your account and create your first content. As a Pulse creator, you'll enjoy access to our platform's powerful features for building your fitness community.
            </p>
          </div>

          {/* Download App */}
          <a 
            href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-zinc-800 text-white px-8 py-4 rounded-full font-semibold hover:bg-zinc-700 transition-all border border-[#E0FE10]/30 hover:border-[#E0FE10] hover:shadow-lg hover:shadow-[#E0FE10]/10"
          >
            Download Pulse
            <span className="text-[#E0FE10]">→</span>
          </a>

          {/* Learning Path Introduction */}
          <div className="max-w-2xl mx-auto">
            <h2 className="text-white text-2xl sm:text-3xl font-bold mb-4">
              Let's Get You Started
            </h2>
            <p className="text-zinc-400 text-lg">
              Before diving into the setup process, familiarize yourself with our core features below. Understanding Moves, Stacks, and Rounds will help you make the most of your creator journey.
            </p>
          </div>

          {/* Arrow indicator */}
          <div className="flex justify-center">
            <svg 
              className="w-6 h-6 text-[#E0FE10] animate-bounce" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 14l-7 7m0 0l-7-7m7 7V3" 
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Interactive Feature Tiles */}
      <section className="py-20 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-4 mb-20">
          <h2 className="text-center text-white text-3xl font-bold mb-16">The Pulse Ecosystem</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a 
              href="/moves" 
              className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all cursor-pointer hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10] transform hover:-translate-y-1 duration-300"
            >
              <div className="relative z-10">
                <h3 className="text-[#E0FE10] text-2xl font-bold mb-3">Moves</h3>
                <p className="text-zinc-400 mb-4">The building blocks of your workout. Record and save exercises to create custom Stacks.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Learn about Moves
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <Dumbbell className="w-8 h-8 text-[#E0FE10] opacity-40" />
              </div>
            </a>

            <a 
              href="/stacks" 
              className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all cursor-pointer hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10]/70 transform hover:-translate-y-1 duration-300"
            >
              <div className="relative z-10">
                <h3 className="text-[#E0FE10]/70 text-2xl font-bold mb-3">Stacks</h3>
                <p className="text-zinc-400 mb-4">Stack your Moves to build a complete workout. Create the perfect training session for any goal.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Learn about Stacks
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <Layers className="w-8 h-8 text-[#E0FE10]/70 opacity-40" />
              </div>
            </a>

            <a 
              href="/rounds" 
              className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all cursor-pointer hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10]/40 transform hover:-translate-y-1 duration-300"
            >
              <div className="relative z-10">
                <h3 className="text-[#E0FE10]/40 text-2xl font-bold mb-3">Rounds</h3>
                <p className="text-zinc-400 mb-4">Join the Round. Time-bound training programs where your community trains together or at their own pace.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Learn about Rounds
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <Timer className="w-8 h-8 text-[#E0FE10]/40 opacity-40" />
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20 bg-black">
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <h2 className="text-center text-white text-4xl font-bold mb-16">Getting Started</h2>
          <div className="grid gap-16">
            {CREATOR_STEPS.map((step, index) => (
              <div key={index} className="relative bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 hover:bg-zinc-900 transition-all duration-300 group">
                <div className="flex flex-col md:flex-row items-start gap-8">
                  <div className="w-full md:w-1/2">
                    <div className="bg-zinc-800/50 rounded-xl p-4 group-hover:shadow-lg group-hover:shadow-[#E0FE10]/5 transition-all duration-300">
                      <img 
                        src={step.image}
                        alt={step.title}
                        className="hidden md:block w-full h-auto rounded-lg"
                      />
                      <img 
                        src={step.mobileImage}
                        alt={step.title}
                        className="md:hidden w-full h-auto rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="w-full md:w-1/2 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#E0FE10]/10 text-[#E0FE10] font-semibold border border-[#E0FE10]/20 group-hover:bg-[#E0FE10]/20 transition-colors duration-300">
                        {index + 1}
                      </div>
                      <h3 className="text-2xl sm:text-3xl text-white font-bold group-hover:text-[#E0FE10] transition-colors duration-300">
                        {step.title}
                      </h3>
                    </div>
                    
                    <p className="text-lg text-zinc-400">
                      {step.description}
                    </p>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-zinc-300">Quick Steps:</h4>
                      {step.detailedSteps.map((detailStep, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10]/40"></div>
                          <p className="text-sm text-zinc-400">{detailStep}</p>
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => {
                        if (completedSteps.includes(index)) {
                          setCompletedSteps(completedSteps.filter(s => s !== index));
                        } else {
                          setCompletedSteps([...completedSteps, index]);
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                        completedSteps.includes(index)
                          ? 'bg-[#E0FE10]/20 text-[#E0FE10] border border-[#E0FE10]/40'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      {completedSteps.includes(index) ? 'Completed' : 'Mark Complete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-zinc-900 py-20">
        <div className="max-w-4xl mx-auto px-4 mb-16">
          <FAQ title="Common Questions" items={FAQ_DATA} theme="dark" />
          
          <div className="mt-10 text-center">
            <a
              href="/creators"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 border border-zinc-700 transition-colors"
            >
              <span>Want to Apply? Visit Creator Applications</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CreatorStarterPack;