import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  FaArrowRight, 
  FaCheck, 
  FaChevronDown, 
  FaStar,
  FaUsers,
  FaDumbbell,
  FaVideo,
  FaTrophy,
  FaCoins,
  FaDollarSign,
  FaPlay
} from 'react-icons/fa6';
import Footer from '../components/Footer/Footer';
import { platformDetection, appLinks, openIOSAppOrStore } from '../utils/platformDetection';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onToggle }) => (
  <div className="border-b border-zinc-800">
    <button
      onClick={onToggle}
      className="w-full py-5 flex items-center justify-between text-left hover:text-[#E0FE10] transition-colors"
    >
      <span className="text-lg font-medium text-white">{question}</span>
      <FaChevronDown className={`h-5 w-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && (
      <div className="pb-5 text-zinc-400 leading-relaxed">
        {answer}
      </div>
    )}
  </div>
);

const CreatorsPage: React.FC = () => {
  const router = useRouter();
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  // Detect platform on mount
  useEffect(() => {
    setPlatform(platformDetection.getPlatform());
  }, []);

  const handleLaunchChallenge = () => {
    if (platform === 'ios') {
      // On iOS: Try to open the app, fall back to App Store
      openIOSAppOrStore(
        appLinks.creatorOnboardingDeepLink(),
        appLinks.appStoreUrl
      );
    } else {
      // On Android/Desktop: Route to web creator onboarding
      router.push('/creator-onboarding');
    }
  };

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  const faqItems = [
    {
      question: "Do I need a big following?",
      answer: "No. Most creators start with the audience they already have - even if that is just 20-50 people. Pulse is designed to help you build deeper engagement with a small community, not chase follower counts."
    },
    {
      question: "Can this work with my studio?",
      answer: "Absolutely. Studios like SoulCycle have used Pulse to run instructor-led challenges that bring new customers in and re-engage lapsed members. Your studio benefits when you host challenges."
    },
    {
      question: "How do I get paid?",
      answer: "Participants subscribe to Pulse to join challenges. You earn from their ongoing participation. Payments are processed monthly via Stripe with no minimum threshold."
    },
    {
      question: "What kind of content works best?",
      answer: "Short, 5-30 second exercise clips from workouts you already do. No fancy production needed - just clear demonstrations shot on your phone. Authenticity beats polish."
    },
    {
      question: "How long does a challenge last?",
      answer: "You decide. Most challenges run 7-30 days, but you have full control over the duration, schedule, and rules. Start with a short challenge to test what works for your community."
    }
  ];

  return (
    <>
      <Head>
        <title>For Creators | Turn Your Workouts Into Revenue | Pulse</title>
        <meta name="description" content="Pulse lets fitness creators launch short challenges using bite-sized exercise videos and earn when their community shows up. No massive following required." />
        <meta property="og:title" content="For Creators | Turn Your Workouts Into Revenue | Pulse" />
        <meta property="og:description" content="Launch fitness challenges. Build your community. Earn recurring revenue." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-white">
        
        {/* Simple Navigation */}
        <nav className="fixed top-0 w-full bg-zinc-950/90 backdrop-blur-md z-50 border-b border-zinc-800/50">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link href="/" className="flex items-center">
              <img 
                src="/pulse-logo-green.svg" 
                alt="Pulse" 
                className="h-8 w-auto" 
              />
            </Link>
            <button 
              onClick={handleLaunchChallenge}
              className="bg-[#E0FE10] text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors"
            >
              Launch Your Challenge
            </button>
          </div>
        </nav>

        {/* 1. Hero Section */}
        <section className="pt-32 pb-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Turn Your Workouts Into{' '}
              <span className="bg-gradient-to-r from-[#E0FE10] to-lime-400 bg-clip-text text-transparent">
                Monthly Recurring Revenue
              </span>
            </h1>
            
              <p className="text-xl sm:text-2xl text-zinc-400 mb-10 max-w-3xl mx-auto leading-relaxed">
               Turn bite-sized videos into gamified group experiences.
              </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button 
                onClick={handleLaunchChallenge}
                className="inline-flex items-center gap-3 bg-[#E0FE10] text-black px-8 py-4 rounded-2xl font-bold text-lg hover:bg-lime-300 transition-colors group"
              >
                Launch Your First Challenge
                <FaArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={scrollToHowItWorks}
                className="text-zinc-400 hover:text-white transition-colors font-medium"
              >
                See how it works
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="flex text-[#E0FE10]">
                  <FaStar className="h-4 w-4" />
                  <FaStar className="h-4 w-4" />
                  <FaStar className="h-4 w-4" />
                  <FaStar className="h-4 w-4" />
                  <FaStar className="h-4 w-4" />
                </div>
                <span>4.9 on the App Store</span>
              </div>
              <span className="hidden sm:inline text-zinc-700">|</span>
              <span>Trusted by instructors and studios</span>
            </div>
          </div>
        </section>

        {/* Video Walkthrough Section - nas.io style */}
        <section className="py-20 px-6 bg-gradient-to-b from-zinc-950 to-zinc-900">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[#E0FE10] text-3xl sm:text-4xl font-bold italic mb-2">2 minutes</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                to build your first challenge
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                Create content once, turn it into recurring revenue.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Left - Feature List */}
              <div className="space-y-3">
                {[
                  { icon: FaVideo, label: 'Moves', desc: 'Record bite-sized exercise clips', active: true },
                  { icon: FaDumbbell, label: 'Movelists', desc: 'Stack moves into workout routines' },
                  { icon: FaTrophy, label: 'Rounds', desc: 'Launch group fitness challenges' },
                  { icon: FaUsers, label: 'Community', desc: 'Build your engaged audience' },
                  { icon: FaDollarSign, label: 'Earnings', desc: 'Get paid when people participate' },
                ].map((feature, idx) => (
                  <div 
                    key={feature.label}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                      feature.active 
                        ? 'bg-[#E0FE10]/10 border-[#E0FE10]/40' 
                        : 'bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      feature.active ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-zinc-300'
                    }`}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={`font-semibold ${feature.active ? 'text-[#E0FE10]' : 'text-white'}`}>
                        {feature.label}
                      </p>
                      <p className="text-zinc-400 text-sm">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right - Video */}
              <div className="flex justify-center lg:justify-end">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden w-full max-w-[380px] aspect-[9/16]">
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube-nocookie.com/embed/MZ_CSr0Cyzs?rel=0&modestbranding=1&playsinline=1"
                    title="How to Launch Your First Challenge on Pulse"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            <div className="text-center mt-8">
              <a
                href="https://www.youtube.com/watch?v=MZ_CSr0Cyzs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
              >
                <FaPlay className="h-3 w-3" />
                Watch full video walkthrough
              </a>
            </div>
          </div>
        </section>

        {/* 2. Who This Is For */}
        <section className="py-20 px-6 bg-zinc-900/50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
              Built for creators who already have people paying attention
            </h2>
            <p className="text-zinc-400 text-center mb-12 text-lg">
              If you teach fitness in any form, this is for you.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
              {[
                'Personal trainers',
                'Group fitness instructors',
                'Studio instructors',
                'Online coaches',
                'Yoga & Pilates teachers',
                'Fitness creators'
              ].map((type) => (
                <div key={type} className="flex items-center gap-3 bg-zinc-800/50 rounded-xl px-4 py-3">
                  <FaCheck className="h-4 w-4 text-[#E0FE10] flex-shrink-0" />
                  <span className="text-zinc-300">{type}</span>
                </div>
              ))}
            </div>
            
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-4 text-center">You do not need:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                {[
                  'A massive following',
                  'A course',
                  'A custom app',
                  'A marketing team'
                ].map((item) => (
                  <div key={item} className="text-zinc-400">
                    <span className="text-zinc-600 line-through">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. The Core Problem */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
              Growing as a fitness creator is{' '}
              <span className="text-zinc-500">harder than it should be</span>
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {[
                'Social platforms do not pay consistently',
                'Programs take months to build and sell',
                'One-on-one coaching does not scale',
                'Communities lose momentum between launches',
                'Hard to bring people together consistently',
                'Fighting algorithms for reach'
              ].map((pain) => (
                <div key={pain} className="flex items-start gap-3 text-zinc-400">
                  <span className="text-red-400 mt-1">x</span>
                  <span>{pain}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. The Pulse Solution */}
        <section id="how-it-works" className="py-20 px-6 bg-zinc-900/50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
              Pulse turns your workouts into community challenges
            </h2>
            <p className="text-zinc-400 text-center mb-16 text-lg">
              Three steps. No complexity.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="relative">
                <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/5 border border-[#E0FE10]/20 rounded-2xl p-8 h-full">
                  <div className="w-14 h-14 bg-[#E0FE10] rounded-xl flex items-center justify-center mb-6">
                    <FaVideo className="h-6 w-6 text-black" />
                  </div>
                  <div className="text-[#E0FE10] text-sm font-medium mb-2">Step 1</div>
                  <h3 className="text-2xl font-bold mb-3">Create</h3>
                  <p className="text-zinc-400">
                    Upload short exercise clips from workouts you already do. 5-30 seconds each. Phone quality is perfect.
                  </p>
                </div>
              </div>
              
              <div className="relative">
                <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-400/20 rounded-2xl p-8 h-full">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-6">
                    <FaTrophy className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-purple-400 text-sm font-medium mb-2">Step 2</div>
                  <h3 className="text-2xl font-bold mb-3">Launch</h3>
                  <p className="text-zinc-400">
                    Turn your clips into a challenge your community joins together. Set the rules, duration, and invite your people.
                  </p>
                </div>
              </div>
              
              <div className="relative">
                <div className="bg-gradient-to-br from-orange-500/10 to-pink-500/5 border border-orange-400/20 rounded-2xl p-8 h-full">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center mb-6">
                    <FaCoins className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-orange-400 text-sm font-medium mb-2">Step 3</div>
                  <h3 className="text-2xl font-bold mb-3">Earn</h3>
                  <p className="text-zinc-400">
                    Participants subscribe. You earn when they show up. Recurring revenue from real engagement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. What Creators Actually Earn */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
              Creators earn through participation, not hype
            </h2>
            <p className="text-zinc-400 text-center mb-12 text-lg">
              Here is how the economics work.
            </p>
            
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-8 md:p-12">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#E0FE10] rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold">1</div>
                  <p className="text-zinc-300 text-lg">You launch a challenge using your workout content</p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#E0FE10] rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold">2</div>
                  <p className="text-zinc-300 text-lg">Your community joins - even 20-50 people is enough to start</p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#E0FE10] rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold">3</div>
                  <p className="text-zinc-300 text-lg">Those participants subscribe to Pulse to participate</p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#E0FE10] rounded-full flex items-center justify-center flex-shrink-0 text-black font-bold">4</div>
                  <p className="text-zinc-300 text-lg">You earn from their ongoing participation in your challenges</p>
                </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-zinc-700">
                <p className="text-zinc-400 text-center">
                  <span className="text-[#E0FE10] font-medium">Most creators start with the audience they already have.</span>
                  <br />No need to go viral. Just engage the people who already follow you.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. SoulCycle Case Study */}
        <section className="py-20 px-6 bg-zinc-900/50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
              How instructors use Pulse to grow beyond the studio
            </h2>
            <p className="text-zinc-400 text-center mb-12 text-lg">
              Real results from a real partnership.
            </p>
            
            <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700 rounded-2xl overflow-hidden">
              <div className="bg-zinc-800/80 px-8 py-6 border-b border-zinc-700">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-yellow-500 rounded-xl flex items-center justify-center">
                    <span className="text-black font-bold text-xl">SC</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">SoulCycle Buckhead, Atlanta</h3>
                    <p className="text-zinc-400">Two instructor-led challenges</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h4 className="text-lg font-bold mb-4 text-[#E0FE10]">The Challenge</h4>
                    <ul className="space-y-3 text-zinc-300">
                      <li className="flex items-start gap-2">
                        <FaCheck className="h-4 w-4 text-[#E0FE10] mt-1 flex-shrink-0" />
                        <span>Kickoff ride hosted in studio</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <FaCheck className="h-4 w-4 text-[#E0FE10] mt-1 flex-shrink-0" />
                        <span>Closing event and prize presentation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <FaCheck className="h-4 w-4 text-[#E0FE10] mt-1 flex-shrink-0" />
                        <span>Winner received 7-day SoulCycle pass</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold mb-4 text-[#E0FE10]">The Results</h4>
                    <div className="space-y-4">
                      <div className="bg-zinc-800/50 rounded-xl p-4">
                        <div className="text-3xl font-bold text-[#E0FE10]">25%</div>
                        <div className="text-zinc-400">of participants had never ridden SoulCycle</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-4">
                        <div className="text-3xl font-bold text-[#E0FE10]">30%</div>
                        <div className="text-zinc-400">of lapsed riders (3+ months) returned after the challenge</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-6">
                  <p className="text-zinc-300 text-center">
                    <strong className="text-white">Why this matters:</strong> Challenges drive new customer acquisition, 
                    re-engage lapsed members, and empower instructors to build their own following - all while 
                    benefiting the instructor and the studio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Why Creators Choose Pulse */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
              Why creators choose Pulse
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: 'Built for fitness, not generic content',
                  description: 'Every feature is designed for how fitness creators actually work.'
                },
                {
                  title: 'Challenges create accountability',
                  description: 'Your community shows up because they are in it together.'
                },
                {
                  title: 'Participation drives earnings',
                  description: 'You earn when people engage, not just when they click.'
                },
                {
                  title: 'No need to sell programs or chase DMs',
                  description: 'Skip the sales calls. Just create and launch.'
                },
                {
                  title: 'Works with studios, not against them',
                  description: 'Extend your reach beyond the studio without conflict.'
                },
                {
                  title: 'Direct access to your community',
                  description: 'No algorithms deciding who sees your content.'
                }
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <FaCheck className="h-5 w-5 text-[#E0FE10] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-zinc-400 text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. What You Need to Get Started */}
        <section className="py-20 px-6 bg-zinc-900/50">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Getting started is simple
            </h2>
            <p className="text-zinc-400 mb-12 text-lg">
              Here is all you need to launch your first challenge.
            </p>
            
            <div className="grid sm:grid-cols-3 gap-6 mb-12">
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-6">
                <div className="w-12 h-12 bg-zinc-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="font-bold mb-2">A phone</h3>
                <p className="text-zinc-500 text-sm">To record your exercises</p>
              </div>
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-6">
                <div className="w-12 h-12 bg-zinc-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FaDumbbell className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-bold mb-2">Your normal workouts</h3>
                <p className="text-zinc-500 text-sm">What you already teach</p>
              </div>
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-6">
                <div className="w-12 h-12 bg-zinc-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FaUsers className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="font-bold mb-2">A small group to invite</h3>
                <p className="text-zinc-500 text-sm">Even 20 people is enough</p>
              </div>
            </div>
            
            <p className="text-zinc-500">
              Most creators launch their first challenge in under a day.
            </p>
          </div>
        </section>

        {/* 9. CTA Section */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Launch your first challenge today
            </h2>
            <p className="text-zinc-400 mb-10 text-lg">
              No contracts. No upfront cost. Just start.
            </p>
            
            <button 
              onClick={handleLaunchChallenge}
              className="inline-flex items-center gap-3 bg-[#E0FE10] text-black px-10 py-5 rounded-2xl font-bold text-xl hover:bg-lime-300 transition-colors group"
            >
              Launch Your First Challenge
              <FaArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        {/* 10. FAQ */}
        <section className="py-20 px-6 bg-zinc-900/50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
              Frequently asked questions
            </h2>
            
            <div className="divide-y divide-zinc-800">
              {faqItems.map((item, index) => (
                <FAQItem
                  key={index}
                  question={item.question}
                  answer={item.answer}
                  isOpen={openFAQ === index}
                  onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 11. Footer */}
        <Footer />
      </div>
    </>
  );
};

export default CreatorsPage;
