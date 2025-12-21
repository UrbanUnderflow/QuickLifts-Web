import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Head from 'next/head';
import { 
  ArrowLeft, 
  Users, 
  Activity, 
  Calendar, 
  RefreshCw, 
  Target, 
  Brain,
  CheckCircle,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Lightbulb,
  Rocket,
  Download
} from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';

const q1OverallMetrics = [
  {
    label: "Subscribed Members",
    currentValue: 126,
    previousValue: 86,
    isCurrency: false
  },
  {
    label: "Unique Moves Added",
    currentValue: 354,
    previousValue: 251,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Total Workouts Logged",
    currentValue: 980,
    previousValue: 774,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Earnings",
    currentValue: 1147,
    previousValue: 489,
    isCurrency: true
  }
];

const Q1Review2025 = () => {
  return (
    <>
      <Head>
        <title>Q1 2025: Launch, Learn, Iterate | Pulse</title>
        <meta name="description" content="Pulse Q1 2025: Launching Rounds, insights from Jaidus & Vynessa's challenges, feature iterations, and shifting back to build." />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Subtle gradient orbs for depth */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-emerald-200/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-gray-100/60 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-gradient-to-br from-blue-100/20 to-transparent rounded-full blur-3xl" />
        </div>

        {/* Navigation */}
        <div className="relative border-b border-gray-200/60 backdrop-blur-sm bg-white/70">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <Link href="/review" className="inline-flex items-center text-sm text-gray-600 hover:text-black transition-colors">
              <ArrowLeft size={16} className="mr-2" />
              All Reviews
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-12">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Q1 2025 • January - March
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Launch, Learn, Iterate
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl" data-description="true">
            Q1 marked the official launch of Rounds—our core feature. We hosted our first challenges and rapidly iterated based on creator feedback.
          </p>
          <a
            href="/PulseDeck12_9.pdf"
            download
            className="inline-flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all hover:shadow-lg hover:shadow-gray-900/20"
          >
            <Download size={18} />
            Download PDF
          </a>
        </div>

        {/* Rounds Takes Center Stage - Featured */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/60 backdrop-blur-xl border border-emerald-200/60 shadow-lg shadow-emerald-100/40">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400" />
            
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Calendar size={20} className="text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                      Major Launch
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Rounds Takes Center Stage</h2>
                </div>
              </div>
              
              <p className="text-gray-700 leading-relaxed">
                Rounds launched as Pulse's flagship feature, transitioning from months of development into the hands of creators and users.
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-100/50 to-transparent" />
          <div className="relative max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Activity size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Q1 Overall Key Metrics
              </h2>
            </div>
            
            <p className="text-gray-600 mb-8">
              Beyond the Rounds launch, Q1 showed continued platform growth across key user and activity metrics.
            </p>

            <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
              <MetricsGrid metrics={q1OverallMetrics} />
            </div>
          </div>
        </div>

        {/* Public Announcement */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                <Users size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Public Announcement: Rounds is Here!</h2>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Video */}
              <div className="w-full md:w-1/3 flex-shrink-0">
                <div className="aspect-[9/16] bg-gray-100 rounded-xl overflow-hidden shadow-lg">
                  <video 
                    className="w-full h-full object-cover"
                    controls
                    playsInline
                    src="/LaunchRounds.mp4" 
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-grow flex items-center">
                <p className="text-gray-600 text-lg">
                  We officially announced Rounds to the public, sharing our vision for community-driven fitness.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Learning & Iterating */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Learning & Iterating: The Feedback Loop
            </h2>
          </div>
          
          <p className="text-gray-600 mb-8">
            Regular meetings with Jaidus and Vynessa drove our development priorities.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Key Focus Areas</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                {[
                  "Streamlining challenge setup for creators",
                  "Enhancing participant progress visualization",
                  "Improving notification relevance and timing",
                  "Developing better analytics for creators",
                  "Simplifying the payment and payout process"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Turning Insights into Action</h3>
              <p className="text-gray-600 text-sm">
                Learnings from initial Rounds directly shaped our roadmap. We shifted focus back to building based on creator needs.
              </p>
            </div>
          </div>
        </div>

        {/* Creator Rounds */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
              <Target size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              In the Trenches: Creator Rounds
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Jaidus's Challenge */}
            <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl overflow-hidden shadow-lg shadow-gray-200/30">
              <div className="aspect-[9/16] bg-gray-100 relative">
                <video 
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  src="/JaidusNewYear.mov" 
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-gray-900 mb-3">Jaidus's 30-Day Ab Challenge</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Our inaugural Round with SoulCycle instructor Jaidus provided invaluable engagement data.
                </p>
                <div className="bg-gray-50/80 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Key Learnings</h4>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>• High initial engagement, tapering mid-challenge</li>
                    <li>• Need for clearer progress tracking</li>
                    <li>• Creator workflow bottlenecks identified</li>
                    <li>• Core challenge concept validated</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Vynessa's Challenge */}
            <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl overflow-hidden shadow-lg shadow-gray-200/30">
              <div className="aspect-[9/16] bg-gray-100 relative">
                <video 
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  src="/VynessaBarbie.mov" 
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-gray-900 mb-3">Vynessa's 30-Day Squat Challenge</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Vynessa's Round tested co-promotion and different notification strategies.
                </p>
                <div className="bg-gray-50/80 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Key Learnings</h4>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>• Tested different notification strategies</li>
                    <li>• Explored co-promotion effectiveness</li>
                    <li>• Need for simplified onboarding</li>
                    <li>• Optimal challenge length insights</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Behind the Scenes */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Rocket size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Behind the Scenes: Building the Foundation
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            {/* Web Platform */}
            <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
              <div className="aspect-square bg-gray-100 rounded-lg mb-4 relative overflow-hidden">
                <Image 
                  src="/webPlatform.png" 
                  alt="Pulse web platform" 
                  layout="fill" 
                  objectFit="cover" 
                />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Web Platform</h3>
              <p className="text-gray-600 text-sm">
                Pivotal foundational work on our web application was completed, setting the stage for full launch in Q2.
              </p>
            </div>

            {/* AI Programming */}
            <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
              <div className="aspect-square bg-gray-100 rounded-lg mb-4 relative overflow-hidden">
                <video 
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  src="/AIProgramming.mp4" 
                  poster="/ai-poster.png"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">AI-Powered Programs</h3>
              <p className="text-gray-600 text-sm">
                Significant strides on our unique AI tool for trainers, leveraging real-world user data for tailored programs.
              </p>
            </div>

            {/* Storytelling */}
            <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
              <div className="aspect-square bg-gray-100 rounded-lg mb-4 relative overflow-hidden">
                <Image 
                  src="/everythingStartsWithAMove.png" 
                  alt="Everything starts with a move" 
                  layout="fill" 
                  objectFit="cover" 
                />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Enhanced Storytelling</h3>
              <p className="text-gray-600 text-sm">
                Launched a revamped About site to better articulate core fundamentals and vision behind Pulse.
              </p>
            </div>

            {/* Starter Pack */}
            <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
              <img 
                src="/starter-pack-poster.png"
                alt="Starter Pack" 
                className="w-full h-auto rounded-lg mb-4 bg-gray-100 p-4"
              />
              <h3 className="font-semibold text-gray-900 mb-2">Creator Starter Pack</h3>
              <p className="text-gray-600 text-sm">
                Built a dedicated web component to streamline creator onboarding and migration to Pulse.
              </p>
            </div>

            {/* Push Notifications */}
            <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
              <div className="aspect-square bg-gray-100 rounded-lg mb-4 relative overflow-hidden">
                <Image 
                  src="/push-notifications.png" 
                  alt="Push notifications" 
                  layout="fill" 
                  objectFit="cover" 
                />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Push Notifications</h3>
              <p className="text-gray-600 text-sm">
                Enhanced push notifications for chat activity and peer workouts, strengthening community cohort.
              </p>
            </div>

            {/* Analytics */}
            <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
              <div className="aspect-square bg-gray-100 rounded-lg mb-4 relative overflow-hidden">
                <Image 
                  src="/round-analytics.jpg" 
                  alt="Round analytics" 
                  layout="fill" 
                  objectFit="cover" 
                />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Individual Analytics</h3>
              <p className="text-gray-600 text-sm">
                Developing deep analytics to give participants detailed insights into their performance and progress.
              </p>
            </div>
          </div>
        </div>

        {/* Q2 Priorities */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center">
                <RefreshCw size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Q2 2025: Priorities & Initiatives</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Product & Feature Development</h3>
                <ul className="space-y-2 text-gray-600 text-sm">
                  {[
                    "Launch 90-day Mobility Round (Testing duration & $1000 prize)",
                    "Implement updated Point System with referral chaining",
                    "Full launch of the Pulse Web Platform"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-cyan-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Growth & Marketing Infrastructure</h3>
                <ul className="space-y-2 text-gray-600 text-sm">
                  {[
                    "Build Marketing Funnel: Brevo, TikTok Ads, AppFlyer, Mixpanel",
                    "Recruit 5 new coaches/creators",
                    "Develop Corporate Wellness program strategies"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-cyan-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Asks Section */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-gradient-to-br from-gray-50/80 to-gray-100/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gray-400 flex items-center justify-center">
                <Lightbulb size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">How You Can Help</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              Areas where connections or expertise would be appreciated:
            </p>
            
            <ul className="space-y-3 text-gray-600">
              {[
                "Introductions to passionate fitness coaches and content creators",
                "Recommendations for talented video editors",
                "Connections or insights regarding relevant accelerator programs",
                "Introductions to potential corporate wellness program partners"
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3 bg-white/50 backdrop-blur-sm rounded-lg p-3">
                  <ArrowRight size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="relative border-t border-gray-200/60 backdrop-blur-sm bg-white/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-sm text-gray-400 mb-1">Learn more about Pulse</p>
                <a 
                  href="https://fitwithpulse.ai" 
                  className="text-gray-900 font-medium hover:text-gray-600 transition-colors inline-flex items-center group"
                >
                  fitwithpulse.ai
                  <ArrowUpRight size={16} className="ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
              <a
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all hover:shadow-lg hover:shadow-gray-900/20 inline-flex items-center gap-2"
              >
                Download Pulse
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Q1Review2025;
