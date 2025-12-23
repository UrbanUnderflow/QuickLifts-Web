import React, { useState } from 'react';
import { Check, Play, BarChart3, Target } from 'lucide-react';
import Head from 'next/head';
import FAQ from '../components/FAQ';
import Meta from '../components/Meta';

const CLIENT_STEPS = [
  {
    title: "Download & Create Account",
    description: "",
    detailedSteps: [
      "Download Pulse from the App Store",
      "Sign up using your email or Apple ID",
      "Upload a profile photo",
      "Complete your basic profile information",
      "Enable push notifications for workout reminders"
    ],
    image: "/step1Mobile.png",
    mobileImage: "/step1Mobile.png"
  },
  {
    title: "Get Pulse Subscription",
    description: "",
    detailedSteps: [
      "After register, you'll see the subscription options",
      "Select 'Start Free Trial' or 'Subscribe Now' if you haven't subscribed through your trainer already.",
      "Confirm access to the dashboard",
    ],
    image: "/step2Mobile.png",
    mobileImage: "/step2Mobile.png"
  },
  {
    title: "Join the Round",
    description: "You may have completed this step through your Round host.",
    detailedSteps: [
      "Join the round",
      "Make Payment if payment is required.",
      "Once successful, return to the Pulse App"
    ],
    image: "/step3Mobile.png",
    mobileImage: "/step3Mobile.png"
  },
  {
    title: "Review Your Round Details",
    description: "Your trainer will create personalized workout plans (called Stacks) specifically designed for your goals.",
    detailedSteps: [
      "Open the Pulse app",
      "Scroll to the Active Rounds section",
      "Tap on the Round you just joined",
      "Scroll through and review whats required of you this round"
    ],
    image: "/step4Mobile.png",
    mobileImage: "/step4Mobile.png"
  },
  {
    title: "Start Your First Workout",
    description: "Time to get moving! Select a Stack from your plan and begin your workout.",
    detailedSteps: [
      "Select a Stack from your assigned plan",
      "Tap 'Start Workout' to begin",
      "Follow along with exercise videos",
      "Navigate between exercises as you complete them"
    ],
    image: "/step5Mobile.png",
    mobileImage: "/step5Mobile.png"
  },
  {
    title: "Track Your Progress",
    description: "As you complete each exercise, log your reps, weight, and any modifications. This data helps your trainer adjust your program over time.",
    detailedSteps: [
      "Review recommended weight",
      "Select \"I did recommended weight\"",
      "Swipe up on this details card if you need to edit",
      "Enter the reps, and weight used for each exercise",
      "Add any notes you may want for specific exercise",
      "Tap Update to save and move on to the next Move"
    ],
    image: "/step6Mobile.png",
    mobileImage: "/step6Mobile.png"
  },
  {
    title: "Complete Your Workout",
    description: "Finish strong by completing your workout summary. ",
    detailedSteps: [
      "Review your workout summary",
      "Rate your overall workout experience",
      "Add any additional notes or feedback",
      "Complete check-in",
      "Save and submit your completed workout"
    ],
    image: "/step7Mobile.png",
    mobileImage: "/step7Mobile.png"
  },
  {
    title: "Weekly Weigh-ins",
    description: "Stay connected with your trainer through regular weigh-ins. Share your progress, ask questions, and receive feedback to keep your fitness journey on track and motivated.",
    detailedSteps: [
      "Tap the weigh-in card in the Round",
      "Enter current weight",
      "Upload front, back, and side photos",
      "Submit for trainer review"
    ],
    image: "/step8Mobile.png",
    mobileImage: "/step8Mobile.png"
  },
  {
    title: "Log your food",
    description: "Track your nutrition by logging your meals throughout the day.",
    detailedSteps: [
      "Tap the macro card in the Round",
      "Scroll down and press capture food",
      "Take a photo of your food",
      "Provide a caption",
      "Submit to add the macros to your log"
    ],
    image: "/step9Mobile.png",
    mobileImage: "/step9Mobile.png"
  }
];

const FAQ_DATA = [
  {
    question: "What if I've never used a fitness app before?",
    answer: "No worries! Pulse is designed to be user-friendly for all experience levels. Your trainer will guide you through everything, and each exercise includes video demonstrations to ensure proper form."
  },
  {
    question: "How do I know if I'm doing exercises correctly?",
    answer: "Each exercise in your Stack includes a video demonstration. Watch these carefully, and don't hesitate to ask your trainer questions. You can also record yourself and share with your trainer for form feedback."
  },
  {
    question: "What if I can't complete a workout as prescribed?",
    answer: "That's completely normal! Log what you were able to complete and add notes about any modifications. Your trainer will adjust future workouts based on your feedback and progress."
  },
  {
    question: "How often should I check in with my trainer?",
    answer: "This depends on your program, but typically weekly check-ins work well. Your trainer will let you know their preferred communication schedule and method."
  },
  {
    question: "What happens after my free trial ends?",
    answer: "You can continue with a paid subscription to maintain access to all features, or discuss alternative arrangements with your trainer. Many trainers offer flexible options for their clients."
  },
  {
    question: "Can I do workouts offline?",
    answer: "You'll need an internet connection to initially load your workouts and sync your progress, but once loaded, you can complete most workouts offline. Your data will sync when you reconnect."
  },
  {
    question: "What if I have questions during a workout?",
    answer: "You can pause your workout anytime to review exercise videos or send a message to your trainer. For immediate concerns about form or safety, it's always best to stop and ask."
  }
];

const OneOnOneGuide = () => {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const siteUrl = 'https://fitwithpulse.ai';
  const pageUrl = `${siteUrl}/one-on-one`;
  const title = 'One-on-One Training Guide | Pulse Client Onboarding';
  const description = 'Complete guide for clients starting their fitness journey with a personal trainer on Pulse. Learn how to download the app, start your trial, and make the most of your training program.';

  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>

      <Meta title={title} description={description} url={pageUrl} />

      <div className="bg-[#E0FE10]/10 border-l-4 border-[#E0FE10] p-4 mx-4 md:mx-auto max-w-5xl">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg mb-1">
              Welcome to Your Fitness Journey! 
            </h3>
            <p className="text-zinc-300">
              Your trainer has chosen Pulse to help you reach your fitness goals. This guide will walk you through everything you need to know to get started, from downloading the app to completing your first workout and beyond.
            </p>
          </div>
          <div>
            <a
              href="/download"
              className="text-zinc-400 hover:text-white text-sm whitespace-nowrap"
            >
              Download App →
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
              Client Getting Started Guide
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8">
              Train with <span className="text-[#E0FE10]">Pulse</span>
            </h1>
            <p className="text-zinc-400 text-xl leading-relaxed pl-8">
              Your personal trainer has everything set up for your success. Follow this guide to get started.
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
              Everything You Need to Know
            </h2>
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
          <h2 className="text-center text-white text-3xl font-bold mb-16">What Makes Pulse Special</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* New tile: Video Demonstrations */}
            <div className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10] transform hover:-translate-y-1 duration-300">
              <div className="relative z-10">
                <h3 className="text-[#E0FE10] text-2xl font-bold mb-3">Video Demonstrations</h3>
                <p className="text-zinc-400 mb-4">Every exercise in your plan includes a short video demo performed by experts and real people just like you.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Learn Proper Form
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <Play className="w-8 h-8 text-[#E0FE10] opacity-40" />
              </div>
            </div>

            <div className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10] transform hover:-translate-y-1 duration-300">
              <div className="relative z-10">
                <h3 className="text-[#E0FE10] text-2xl font-bold mb-3">Personal Training</h3>
                <p className="text-zinc-400 mb-4">Work directly with your trainer, conent creators, or friends to be challenged by real full workouts.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Personalized Programs
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <Target className="w-8 h-8 text-[#E0FE10] opacity-40" />
              </div>
            </div>

            <div className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10]/70 transform hover:-translate-y-1 duration-300">
              <div className="relative z-10">
                <h3 className="text-[#E0FE10]/70 text-2xl font-bold mb-3">Progress Tracking</h3>
                <p className="text-zinc-400 mb-4">Log your workouts, track improvements, and share progress.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Track Your Growth
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <BarChart3 className="w-8 h-8 text-[#E0FE10]/70 opacity-40" />
              </div>
            </div>

            <div className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10]/40 transform hover:-translate-y-1 duration-300">
              <div className="relative z-10">
                <h3 className="text-[#E0FE10]/40 text-2xl font-bold mb-3">Direct Communication</h3>
                <p className="text-zinc-400 mb-4">Stay connected with your trainer through in-app messaging, check-ins, and real-time feedback on your workouts.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Stay Connected
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <MessageSquare className="w-8 h-8 text-[#E0FE10]/40 opacity-40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20 bg-black">
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <h2 className="text-center text-white text-4xl font-bold mb-16">Your Step-by-Step Guide</h2>
          <div className="grid gap-16">
            {CLIENT_STEPS.map((step, index) => (
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
                      <h4 className="text-sm font-semibold text-zinc-300">Action Items:</h4>
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
          <FAQ title="Frequently Asked Questions" items={FAQ_DATA} theme="dark" />
          
          <div className="mt-10 text-center">
            <a
              href="/download"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 border border-zinc-700 transition-colors"
            >
              <span>Ready to Start? Download Pulse</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OneOnOneGuide;
