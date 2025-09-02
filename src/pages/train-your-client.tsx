import React, { useState } from 'react';
import { Check, Users, Calendar, Target, BarChart3, MessageSquare, Dumbbell, Layers } from 'lucide-react';
import Head from 'next/head';
import FAQ from '../components/FAQ';
import Meta from '../components/Meta';

const TRAINER_STEPS = [
  {
    title: "Set Up Your Trainer Profile",
    description: "Create a professional profile that showcases your expertise and attracts clients. A complete profile builds trust and helps potential clients understand your training style and qualifications.",
    detailedSteps: [
      "Download the Pulse app",
      "Sign up as a trainer/creator",
      "Upload a professional profile photo",
      "Write a compelling bio highlighting your expertise",
      "Add your certifications and qualifications",
      "Connect your social media accounts"
    ],
    image: "/step1Mobile.png",
    mobileImage: "/step1Mobile.png"
  },
  {
    title: "Create Your First Round",
    description: "Design a comprehensive training program (Round) that will guide your clients through their fitness journey. This is where you'll organize your workouts and set the structure for your training program.",
    detailedSteps: [
      "Tap 'Create Round' in the app",
      "Name your Round (e.g., '30-Day Transformation')",
      "Set the duration and start date",
      "Add a description of what clients will achieve",
      "Set pricing and enrollment details",
      "Choose whether it's public or private"
    ],
    image: "/step2Mobile.png",
    mobileImage: "/step2Mobile.png"
  },
  {
    title: "Build Your Exercise Library",
    description: "Create a collection of exercises (Moves) that you'll use in your workouts. This library will save you time and ensure consistency across your training programs.",
    detailedSteps: [
      "Record or upload exercise videos",
      "Add detailed exercise descriptions",
      "Include proper form cues and safety notes",
      "Categorize exercises by muscle group",
      "Set recommended weights and rep ranges",
      "Save exercises to your personal library"
    ],
    image: "/step3Mobile.png",
    mobileImage: "/step3Mobile.png"
  },
  {
    title: "Create Workout Stacks",
    description: "Combine your exercises into complete workouts (Stacks) that target specific goals. Each Stack should be designed to challenge your clients while maintaining proper progression.",
    detailedSteps: [
      "Select exercises from your library",
      "Arrange exercises in logical order",
      "Set rep ranges and rest periods",
      "Add supersets or circuits if needed",
      "Include warm-up and cool-down exercises",
      "Test the workout flow and timing"
    ],
    image: "/step4Mobile.png",
    mobileImage: "/step4Mobile.png"
  },
  {
    title: "Add Stacks to Your Round",
    description: "Organize your Stacks into a structured program within your Round. This creates a clear progression path for your clients and helps them understand their training schedule.",
    detailedSteps: [
      "Open your Round in edit mode",
      "Add your created Stacks to the program",
      "Arrange Stacks in logical progression order",
      "Set frequency (how many times per week)",
      "Add rest days and recovery periods",
      "Preview the complete program flow"
    ],
    image: "/step5Mobile.png",
    mobileImage: "/step5Mobile.png"
  },
  {
    title: "Invite Your Clients",
    description: "Send personalized invitations to your clients to join your Round. This creates a direct connection and allows you to track their progress throughout the program.",
    detailedSteps: [
      "Generate a unique invitation link",
      "Send the link to your client via email or text",
      "Include a personal message about the program",
      "Set expectations for the training journey",
      "Follow up if they haven't joined within 24 hours",
      "Welcome them once they've joined"
    ],
    image: "/step6Mobile.png",
    mobileImage: "/step6Mobile.png"
  },
  {
    title: "Monitor Client Progress",
    description: "Track your clients' progress through the app to provide personalized guidance and adjustments. Regular monitoring helps ensure they're on track to reach their goals.",
    detailedSteps: [
      "Check client workout completion rates",
      "Review their logged weights and reps",
      "Monitor their check-in responses",
      "Analyze their progress photos and measurements",
      "Identify areas needing adjustment",
      "Provide timely feedback and encouragement"
    ],
    image: "/step7Mobile.png",
    mobileImage: "/step7Mobile.png"
  },
  {
    title: "Provide Ongoing Support",
    description: "Maintain regular communication with your clients to keep them motivated and address any concerns. This support is crucial for their long-term success and retention.",
    detailedSteps: [
      "Respond to client messages within 24 hours",
      "Schedule regular check-in calls or video sessions",
      "Adjust programs based on client feedback",
      "Celebrate their achievements and milestones",
      "Address any challenges or setbacks",
      "Plan next steps and future programs"
    ],
    image: "/step8Mobile.png",
    mobileImage: "/step8Mobile.png"
  },
  {
    title: "Scale Your Training Business",
    description: "Once you have a successful system in place, expand your reach to help more clients. This includes creating additional programs, building your client base, and optimizing your processes.",
    detailedSteps: [
      "Create additional Rounds for different goals",
      "Develop specialized programs (strength, cardio, etc.)",
      "Build a waitlist for new clients",
      "Collect testimonials and success stories",
      "Optimize your program based on client results",
      "Consider group training or challenges"
    ],
    image: "/step9Mobile.png",
    mobileImage: "/step9Mobile.png"
  }
];

const FAQ_DATA = [
  {
    question: "How do I get approved as a trainer on Pulse?",
    answer: "Apply through our creator application process. We review your fitness credentials, experience, and content to ensure quality training for our community. Most certified trainers are approved within 48 hours."
  },
  {
    question: "What makes a successful training program?",
    answer: "Great programs combine clear progression, proper exercise selection, and consistent communication. Focus on your clients' specific goals, provide detailed instructions, and maintain regular check-ins."
  },
  {
    question: "How many clients can I train at once?",
    answer: "You can train as many clients as you can effectively support. Start with 5-10 clients to perfect your system, then scale up. Quality attention to each client is more important than quantity."
  },
  {
    question: "What if a client isn't following the program?",
    answer: "Reach out proactively to understand their challenges. Adjust the program if needed, provide additional motivation, and consider scheduling a call to address any concerns or obstacles."
  },
  {
    question: "How do I handle client payments?",
    answer: "Pulse handles all payment processing securely. You'll receive payments automatically based on your agreed terms with clients. Set clear pricing in your Round descriptions."
  },
  {
    question: "Can I create programs for different fitness levels?",
    answer: "Absolutely! Create multiple Rounds targeting different experience levels. You can also include exercise modifications within the same program to accommodate various fitness levels."
  },
  {
    question: "How do I track client results effectively?",
    answer: "Use the app's progress tracking features, request regular photos and measurements, and maintain detailed notes. Regular check-ins help you monitor progress and make necessary adjustments."
  }
];

const TrainYourClientGuide = () => {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const siteUrl = 'https://fitwithpulse.ai';
  const pageUrl = `${siteUrl}/train-your-client`;
  const title = 'Train Your Client Guide | Pulse Trainer Setup';
  const description = 'Complete guide for trainers setting up programs to train clients on Pulse. Learn how to create Rounds, build workouts, and manage client progress effectively.';

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
              Welcome to Pulse Training! 
            </h3>
            <p className="text-zinc-300">
              Ready to start training clients on Pulse? This comprehensive guide will walk you through setting up your trainer profile, creating programs, and managing client progress effectively.
            </p>
          </div>
          <div>
            <a
              href="/creators"
              className="text-zinc-400 hover:text-white text-sm whitespace-nowrap"
            >
              Apply to Train →
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
              Trainer Getting Started Guide
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8">
              Train with <span className="text-[#E0FE10]">Pulse</span>
            </h1>
            <p className="text-zinc-400 text-xl leading-relaxed">
              Transform your training business with Pulse's powerful platform. Create personalized programs, track client progress, and build lasting relationships with your clients through our comprehensive training tools.
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
              Build Your Training Empire
            </h2>
            <p className="text-zinc-400 text-lg">
              From setting up your profile to scaling your business, we'll guide you through every step of creating successful training programs and managing client relationships effectively.
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
          <h2 className="text-center text-white text-3xl font-bold mb-16">Why Train with Pulse</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10] transform hover:-translate-y-1 duration-300">
              <div className="relative z-10">
                <h3 className="text-[#E0FE10] text-2xl font-bold mb-3">Client Management</h3>
                <p className="text-zinc-400 mb-4">Easily manage multiple clients, track their progress, and provide personalized guidance all in one platform.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Streamlined Workflow
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <Users className="w-8 h-8 text-[#E0FE10] opacity-40" />
              </div>
            </div>

            <div className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10]/70 transform hover:-translate-y-1 duration-300">
              <div className="relative z-10">
                <h3 className="text-[#E0FE10]/70 text-2xl font-bold mb-3">Program Creation</h3>
                <p className="text-zinc-400 mb-4">Build comprehensive training programs with our intuitive tools. Create Moves, Stacks, and Rounds that deliver results.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Powerful Tools
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <Target className="w-8 h-8 text-[#E0FE10]/70 opacity-40" />
              </div>
            </div>

            <div className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10]/40 transform hover:-translate-y-1 duration-300">
              <div className="relative z-10">
                <h3 className="text-[#E0FE10]/40 text-2xl font-bold mb-3">Business Growth</h3>
                <p className="text-zinc-400 mb-4">Scale your training business with automated payments, client tracking, and tools to attract and retain more clients.</p>
                <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                  Grow Your Business
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <BarChart3 className="w-8 h-8 text-[#E0FE10]/40 opacity-40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20 bg-black">
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <h2 className="text-center text-white text-4xl font-bold mb-16">Getting Started</h2>
          <div className="grid gap-16">
            {TRAINER_STEPS.map((step, index) => (
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
              href="/creators"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 border border-zinc-700 transition-colors"
            >
              <span>Ready to Start Training? Apply Now</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TrainYourClientGuide;
