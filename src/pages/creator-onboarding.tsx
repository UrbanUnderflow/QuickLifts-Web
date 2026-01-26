import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  FaArrowRight, 
  FaCheck, 
  FaPlay,
  FaApple,
  FaMobileScreen,
  FaVideo,
  FaTrophy,
  FaUsers
} from 'react-icons/fa6';
import { useUser } from '../hooks/useUser';
import SignInModal from '../components/SignInModal';

const CreatorOnboardingPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [embedOrigin, setEmbedOrigin] = useState<string>('');

  useEffect(() => {
    // Used for YouTube embed "origin" param (helps reduce embed friction on some networks)
    if (typeof window !== 'undefined') {
      setEmbedOrigin(window.location.origin);
    }
  }, []);

  const handleGetStarted = () => {
    if (!currentUser) {
      setIsSignInModalOpen(true);
    } else {
      // User is logged in, proceed to create flow
      router.push('/create');
    }
  };

  const appStoreQRUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729')}`;

  const buildYouTubeEmbedSrc = (videoId: string, extraParams: Record<string, string> = {}) => {
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      ...extraParams,
    });
    if (embedOrigin) params.set('origin', embedOrigin);
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  };

  const tutorialVideos = useMemo(() => {
    return [
      {
        id: '8Ous6Wqvn7o',
        title: 'Product Walkthrough',
        subtitle: 'Full platform overview',
      },
      {
        id: 'FDqvrReKjyo',
        title: 'How to Upload a Move',
        subtitle: 'Creator tutorial',
      },
      {
        id: 'MZ_CSr0Cyzs',
        title: 'How to Create a Round',
        subtitle: 'Build AI-powered workouts',
      },
    ];
  }, []);

  const steps = [
    {
      number: 1,
      title: 'Create Your Moves',
      description: 'Record short 5-30 second exercise clips. Use your phone - no fancy equipment needed.',
      icon: FaVideo,
      tips: [
        'Film in good lighting',
        'Show the full movement',
        'Keep it simple and clear'
      ]
    },
    {
      number: 2,
      title: 'Build a Movelist',
      description: 'Combine your moves into a workout routine. This becomes the foundation of your challenge.',
      icon: FaTrophy,
      tips: [
        'Start with 5-10 exercises',
        'Mix different body parts',
        'Consider your audience level'
      ]
    },
    {
      number: 3,
      title: 'Launch Your Round',
      description: 'Set the duration, invite your community, and watch them train together.',
      icon: FaUsers,
      tips: [
        'Start with a 7-day challenge',
        'Invite your existing followers',
        'Engage in the chat daily'
      ]
    }
  ];

  return (
    <>
      <Head>
        <title>Creator Onboarding | Launch Your First Challenge | Pulse</title>
        <meta name="description" content="Learn how to create your first fitness challenge on Pulse. Step-by-step guide for creators." />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-white">
        {/* Navigation */}
        <nav className="fixed top-0 w-full bg-zinc-950/90 backdrop-blur-md z-50 border-b border-zinc-800/50">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-[#E0FE10]">
              Pulse
            </Link>
            {currentUser ? (
              <button 
                onClick={() => router.push('/create')}
                className="bg-[#E0FE10] text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors"
              >
                Go to Creator Studio
              </button>
            ) : (
              <button 
                onClick={() => setIsSignInModalOpen(true)}
                className="bg-[#E0FE10] text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </nav>

        {/* Hero */}
        <section className="pt-32 pb-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-full mb-6">
              <FaPlay className="h-3 w-3 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">Creator Onboarding</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Launch Your First Challenge in{' '}
              <span className="text-[#E0FE10]">3 Simple Steps</span>
            </h1>
            
            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
              Everything you need to know to create content, build your community, and start earning.
            </p>
          </div>
        </section>

        {/* Best on Mobile Notice */}
        <section className="px-6 pb-12">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/30 rounded-2xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <FaMobileScreen className="h-5 w-5 text-blue-400" />
                    <h3 className="text-lg font-bold">Best Experience on iPhone</h3>
                  </div>
                  <p className="text-zinc-400 mb-4">
                  Creating content is easiest on your phone. Download the Pulse app to record moves, 
                  build Movelists, and launch challenges all from your pocket.
                  </p>
                  <a 
                    href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                    className="inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-colors"
                  >
                    <FaApple className="h-4 w-4" />
                    Download for iPhone
                  </a>
                </div>
                <div className="flex-shrink-0">
                  <div className="bg-white p-3 rounded-xl">
                    <img 
                      src={appStoreQRUrl}
                      alt="Scan to download Pulse"
                      className="w-32 h-32"
                    />
                  </div>
                  <p className="text-zinc-500 text-xs text-center mt-2">Scan with your phone</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="px-6 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              {steps.map((step) => (
                <div 
                  key={step.number}
                  className={`bg-zinc-900/50 border rounded-2xl p-6 md:p-8 transition-all cursor-pointer ${
                    currentStep === step.number 
                      ? 'border-[#E0FE10]/50 bg-[#E0FE10]/5' 
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                  onClick={() => setCurrentStep(step.number)}
                >
                  <div className="flex items-start gap-6">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      currentStep === step.number 
                        ? 'bg-[#E0FE10] text-black' 
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      <step.icon className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-sm font-medium ${
                          currentStep === step.number ? 'text-[#E0FE10]' : 'text-zinc-500'
                        }`}>
                          Step {step.number}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                      <p className="text-zinc-400 mb-4">{step.description}</p>
                      
                      {currentStep === step.number && (
                        <div className="bg-zinc-800/50 rounded-xl p-4 mt-4">
                          <p className="text-sm font-medium text-zinc-300 mb-3">Quick Tips:</p>
                          <ul className="space-y-2">
                            {step.tips.map((tip, tipIndex) => (
                              <li key={tipIndex} className="flex items-center gap-2 text-sm text-zinc-400">
                                <FaCheck className="h-3 w-3 text-[#E0FE10]" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Video Tutorial */}
        <section className="px-6 py-12">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Watch How It Works</h2>
            <div className="flex justify-center">
              {/* YouTube Shorts embed - vertical format, larger size */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden w-[380px] sm:w-[420px] h-[675px] sm:h-[747px]">
                <iframe
                  className="w-full h-full"
                  src={buildYouTubeEmbedSrc('MZ_CSr0Cyzs')}
                  title="How to Launch Your First Challenge on Pulse"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
            <p className="text-zinc-500 text-sm text-center mt-4">
              Quick 60-second overview of creating your first challenge
            </p>
            <div className="text-center mt-3">
              <a
                href="https://www.youtube.com/watch?v=MZ_CSr0Cyzs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-white text-sm underline underline-offset-4"
              >
                Having trouble playing? Open on YouTube
              </a>
            </div>
          </div>
        </section>

        {/* More Tutorials */}
        <section className="px-6 pb-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">More Creator Tutorials</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tutorialVideos.map((v) => (
                <div key={v.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                  <div className="aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                    <iframe
                      className="w-full h-full"
                      src={buildYouTubeEmbedSrc(v.id)}
                      title={v.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                  <div className="mt-3">
                    <p className="text-white font-medium text-sm">{v.title}</p>
                    <p className="text-zinc-500 text-xs">{v.subtitle}</p>
                    <a
                      href={`https://www.youtube.com/watch?v=${v.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-zinc-400 hover:text-white text-xs underline underline-offset-4"
                    >
                      Open on YouTube
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-zinc-400 mb-8">
              {currentUser 
                ? 'Head to the creator studio to start building your first challenge.'
                : 'Create a free account to start building your first challenge.'}
            </p>
            
            <button 
              onClick={handleGetStarted}
              className="inline-flex items-center gap-3 bg-[#E0FE10] text-black px-8 py-4 rounded-2xl font-bold text-lg hover:bg-lime-300 transition-colors group"
            >
              {currentUser ? 'Go to Creator Studio' : 'Create Free Account'}
              <FaArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        {/* Footer spacing */}
        <div className="h-20"></div>
      </div>

      {/* Sign In Modal */}
      <SignInModal 
        isVisible={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={() => {
          setIsSignInModalOpen(false);
          router.push('/create');
        }}
        onSignUpSuccess={() => {
          setIsSignInModalOpen(false);
          router.push('/create');
        }}
      />
    </>
  );
};

export default CreatorOnboardingPage;

