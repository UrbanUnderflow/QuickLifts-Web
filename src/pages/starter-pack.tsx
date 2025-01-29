import React, { useState } from 'react';
import { Check } from 'lucide-react';
import Head from 'next/head';
import FAQ from '../components/FAQ';
import PartnerJoinModal from '../components/PartnerJoinModal';
import Meta from '../components/Meta';
import { Dumbbell, Layers, Timer } from 'lucide-react';  // Changed LayerStack to Layers


const CREATOR_STEPS = [
  {
    title: "Account Creation",
    description: "Start your creator journey by setting up your profile. A complete profile helps build trust with your community and showcases your fitness expertise. Take time to craft a bio that highlights your unique perspective and training style.",
    detailedSteps: [
      "Download the app",
      "Sign up using your email or sign in with apple'",
      "Upload a profile image",
    ],
    image: "/step1Mobile.svg",
    mobileImage: "/step1Mobile.svg"
  },
  {
    title: "Set Up Your Profile",
    description: "Make your profile stand out by sharing your fitness story. Whether you're a certified trainer or passionate enthusiast, your unique perspective matters. Connect your social media to expand your reach and let people know where to find more of your content.",
    detailedSteps: [
      "Fill out profile description",
      "Add social media handles",
    ],
    image: "/step2Mobile.svg",
    mobileImage: "/step2Mobile.svg"
  },
  {
    title: "Upload Your First Content",
    description: "Time to share your expertise! Create your first Move by recording an exercise, combine Moves into a Stack for a complete workout, and organize your Stacks into a Round for a full training program. Each piece of content you create helps others on their fitness journey.",
    detailedSteps: [
      "Record or upload first exercise video",
      "Create your first 'Stack'",
      "Create a 'Round'"
    ],
    image: "/step3Mobile.svg",
    mobileImage: "/step3Mobile.svg"
  },
  {
    title: "Start a workout",
    description: "Experience Pulse from your community's perspective. Try out your own workout or join someone else's Round. This helps you understand the user experience and creates authentic content that resonates with your audience.",
    detailedSteps: [
      "Start and complete your first workout",
      "Join a 'Round'",
    ],
    image: "/step4Mobile.svg",
    mobileImage: "/step4Mobile.svg"
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
  }
];

const CreatorChecklist = () => {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const siteUrl = 'https://fitwithpulse.ai';
  const pageUrl = `${siteUrl}/creator-checklist`;
  const title = 'Creator Guide | Start Your Pulse Journey';
  const description = 'Begin your creator journey with Pulse. Learn how to create content, build your community, and grow your fitness brand.';

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>

      <Meta title={title} description={description} url={pageUrl} />

      {/* Hero Section */}
      <div className="pt-20 pb-16 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-12">
          {/* App Introduction */}
          <div>
            <h1 className="text-4xl sm:text-6xl font-['Thunder'] font-bold mb-6">
              Welcome to <span className="text-orange-500">Pulse</span>
            </h1>
            <p className="text-xl text-zinc-600">
              Join a community where fitness enthusiasts create, share, and grow together. Whether you're a certified trainer or passionate about fitness, you can build your following and earn from your impact.
            </p>
          </div>

          {/* Download App */}
          <a 
            href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-full font-semibold hover:bg-zinc-800 transition-colors"
          >
            Download Pulse
            <span className="text-[#E0FE10]">→</span>
          </a>

          {/* Learning Path Introduction */}
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-['Thunder'] font-bold mb-4">
              Let's Get You Started
            </h2>
            <p className="text-lg text-zinc-600">
              Before diving into the setup process, familiarize yourself with our core features below. Understanding Moves, Stacks, and Rounds will help you make the most of your creator journey.
            </p>
          </div>

          {/* Arrow indicator */}
          <div className="flex justify-center">
            <svg 
              className="w-6 h-6 text-zinc-400 animate-bounce" 
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
      </div>

      {/* Interactive Feature Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4 mb-20">
        <a 
          href="/moves" 
          className="group relative overflow-hidden bg-black border-2 border-black rounded-2xl p-6 hover:bg-zinc-900 transition-all cursor-pointer"
        >
          <div className="relative z-10">
            <h3 className="text-xl font-semibold mb-2 text-white">Moves</h3>
            <p className="text-zinc-300 mb-4">The building blocks of your workout. Record and save exercises to create custom Stacks.</p>
            <span className="text-sm text-white group-hover:text-white/80 transition-colors">
            Learn about Moves →
            </span>
          </div>
          <div className="absolute top-4 right-4">
          <Dumbbell className="w-8 h-8 text-white opacity-20" />
          </div>
        </a>

        <a 
          href="/stacks" 
          className="group relative overflow-hidden bg-black border-2 border-black rounded-2xl p-6 hover:bg-zinc-900 transition-all cursor-pointer"
        >
          <div className="relative z-10">
            <h3 className="text-xl font-semibold mb-2 text-white">Stacks</h3>
            <p className="text-zinc-300 mb-4">Stack your Moves to build a complete workout. Create the perfect training session for any goal.</p>
            <span className="text-sm text-white group-hover:text-white/80 transition-colors">
              Learn about Stacks →
            </span>
          </div>
          <div className="absolute top-4 right-4">
          <Layers className="w-8 h-8 text-white opacity-20" />
          </div>
        </a>

        <a 
          href="/rounds" 
          className="group relative overflow-hidden bg-black border-2 border-black rounded-2xl p-6 hover:bg-zinc-900 transition-all cursor-pointer"
        >
          <div className="relative z-10">
            <h3 className="text-xl font-semibold mb-2 text-white">Rounds</h3>
            <p className="text-zinc-300 mb-4">Join the Round. Time-bound training programs where your community trains together or at their own pace.</p>
            <span className="text-sm text-white group-hover:text-white/80 transition-colors">
            Learn about Rounds →
            </span>
          </div>
          <div className="absolute top-4 right-4">
          <Timer className="w-8 h-8 text-white opacity-20" />
          </div>
        </a>
      </div>

      {/* Steps Section */}
      <div className="max-w-6xl mx-auto px-4 mb-32">
        <div className="grid gap-16">
          {CREATOR_STEPS.map((step, index) => (
            <div key={index} className="relative bg-white border border-zinc-100 rounded-2xl p-8">
              <div className="flex flex-col md:flex-row items-start gap-8">
                <div className="w-full md:w-1/2">
                  <div className="bg-zinc-50 rounded-xl p-4">
                    <img 
                      src={step.image}
                      alt={step.title}
                      className="hidden md:block w-full h-auto rounded-lg shadow-lg"
                    />
                    <img 
                      src={step.mobileImage}
                      alt={step.title}
                      className="md:hidden w-full h-auto rounded-lg shadow-lg"
                    />
                  </div>
                </div>
                <div className="w-full md:w-1/2 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 text-zinc-700 font-semibold">
                      {index + 1}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-['Thunder'] font-bold">
                      {step.title}
                    </h3>
                  </div>
                  
                  <p className="text-lg text-zinc-600">
                    {step.description}
                  </p>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-zinc-700">Quick Steps:</h4>
                    {step.detailedSteps.map((detailStep, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-300"></div>
                        <p className="text-sm text-zinc-600">{detailStep}</p>
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
                        ? 'bg-green-100 text-green-700'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
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

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 mb-32">
        <FAQ title="Common Questions" items={FAQ_DATA} />
      </div>

      {/* CTA Section */}
      <div className="bg-zinc-50 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-['Thunder'] font-bold mb-6">
            Ready to Start Creating?
          </h2>
          <a 
            href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-full font-semibold hover:bg-zinc-800 transition-colors"
          >
            Download Pulse
            <span className="text-[#E0FE10]">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default CreatorChecklist;