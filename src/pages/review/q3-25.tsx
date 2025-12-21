import React from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { 
  ArrowUpRight, 
  ArrowLeft, 
  Trophy, 
  Activity, 
  Target, 
  Sparkles,
  ArrowRight,
  Mail,
  Calendar,
  Lightbulb,
  Clock,
  CheckCircle,
  Rocket,
  Download
} from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';

// Q3 Overall Key Metrics
const q3OverallMetrics = [
  {
    label: "Subscribed Members",
    currentValue: 116,
    previousValue: 144,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Unique Moves Added",
    currentValue: 612,
    previousValue: 556,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Total Workouts Logged",
    currentValue: 4200,
    previousValue: 3180,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Earnings",
    currentValue: 589,
    previousValue: 1105,
    isCurrency: true,
    showGrowth: true
  }
];

// Morning Mobility Final Metrics
const mobilityFinalMetrics = [
  {
    label: "Total Participants",
    currentValue: 83,
    previousValue: 0,
    isCurrency: false,
    showGrowth: false
  },
  {
    label: "Workouts Completed",
    currentValue: 1630,
    previousValue: 0,
    isCurrency: false,
    showGrowth: false
  },
  {
    label: "Referral Rate",
    currentValue: 65,
    previousValue: 0,
    isCurrency: false,
    showGrowth: false
  }
];

const learnings = [
  { 
    title: 'Round Length Too Long', 
    description: '90 days proved challenging for sustained engagement. Users showed fatigue mid-challenge.',
    insight: 'Shorter 30-day Rounds may drive better completion rates'
  },
  { 
    title: 'Build Time Too Long', 
    description: 'Creators spend hours building Rounds manually. This limits creator adoption.',
    insight: 'AI-assisted building and templates are critical for scale'
  },
  { 
    title: 'Post-Round Drop-off', 
    description: 'After completing a Round, users lack clear next steps.',
    insight: 'Need retargeting flows to guide users to new Rounds or features'
  }
];

const businessHighlights = [
  {
    title: "AWS + Techstars Impact Bootcamp",
    description: "Selected for the AWS Impact Bootcamp in Atlanta—hands-on technical training, business mentorship, and direct investor access.",
    signal: "Recognition as a high-potential founder building something bold",
    featured: true
  }
];

const nextQuarterPriorities = [
  { 
    id: 1, 
    title: "AI Round Builder", 
    description: "Use prompts to generate complete Rounds in minutes, not hours"
  },
  { 
    id: 2, 
    title: "Round Templates", 
    description: "CapCut-style templates: select moves, apply template, instant Round"
  },
  { 
    id: 3, 
    title: "Retargeting Flows", 
    description: "Guide users to new Rounds and features after completion"
  },
  { 
    id: 4, 
    title: "Shorter Round Formats", 
    description: "Test 14-day and 30-day Rounds for better completion"
  }
];

const Q3Review2025 = () => {
  return (
    <>
      <Head>
        <title>Q3 2025: Lessons from the Long Round | Pulse</title>
        <meta name="description" content="Pulse Q3 2025: Morning Mobility completed. Key learnings on Round length, build time, and the path to AI-powered Round creation." />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Subtle gradient orbs for depth */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-amber-200/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-gray-100/60 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-gradient-to-br from-orange-100/20 to-transparent rounded-full blur-3xl" />
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
            Q3 2025 • July - September
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Lessons from the Long Round
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl" data-description="true">
            AWS Bootcamp selected. Morning Mobility completed. 90 days taught us what works—now we're building smarter.
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

        {/* AWS Bootcamp - Featured */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/60 backdrop-blur-xl border border-emerald-200/60 shadow-lg shadow-emerald-100/40">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400" />
            
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Rocket size={20} className="text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                      Key Milestone
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">AWS + Techstars Impact Bootcamp</h2>
                </div>
              </div>
              
              <p className="text-gray-700 leading-relaxed">
                Selected for the <a href="https://aws.amazon.com/startups/lp/aws-impact-bootcamps" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline hover:text-emerald-800">AWS Impact Bootcamp</a> in Atlanta. Two days of hands-on technical training, real-world business mentorship, and direct investor access.
              </p>
            </div>
          </div>
        </div>

        {/* Morning Mobility Completion */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                <Trophy size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Morning Mobility Round Completed</h2>
            </div>
            
            <p className="text-gray-600">
              Our 90-day flagship Round crossed the finish line. 83 participants, 1,630 workouts, and critical insights for the future.
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-100/50 to-transparent" />
          <div className="relative max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Activity size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Q3 Overall Key Metrics
              </h2>
            </div>
            
            <p className="text-gray-600 mb-8">
              Platform metrics with context on the revenue shift during our learning phase.
            </p>

            <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
              <MetricsGrid metrics={q3OverallMetrics} />
            </div>
          </div>
        </div>

        {/* Key Learnings */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Lightbulb size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Key Learnings
            </h2>
          </div>
          
          <div className="space-y-4">
            {learnings.map((learning, index) => (
              <div 
                key={index}
                className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5 border-l-4 border-l-amber-500"
              >
                <div className="flex items-start gap-3">
                  <Clock size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{learning.title}</h3>
                    <p className="text-gray-600 text-sm mb-2">{learning.description}</p>
                    <p className="text-amber-700 text-xs font-medium">💡 {learning.insight}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What's Next - Q4 Priorities */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Target size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Q4 Priorities: Building Smarter
            </h2>
          </div>
          
          <div className="space-y-3">
            {nextQuarterPriorities.map((priority) => (
              <div 
                key={priority.id}
                className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5 hover:bg-white/70 hover:shadow-lg hover:shadow-gray-200/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {priority.id}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{priority.title}</h3>
                    <p className="text-sm text-gray-600">{priority.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Resources & Next Steps</h2>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50">
                <h3 className="font-semibold text-gray-900 mb-2">📊 Investor Dataroom</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Financials, market analysis, and pitch deck.
                </p>
                <a 
                  href="/investor" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  View Dataroom
                  <ArrowUpRight size={14} />
                </a>
              </div>
              
              <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50">
                <h3 className="font-semibold text-gray-900 mb-2">📰 Press Kit</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Media resources, assets, and press releases.
                </p>
                <a 
                  href="/press" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Access Press Kit
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </div>

            <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50">
              <h4 className="font-semibold text-gray-900 mb-3">Get in Touch</h4>
              <div className="flex flex-wrap gap-3">
                <a 
                  href="mailto:hello@fitwithpulse.ai" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Mail size={14} />
                  hello@fitwithpulse.ai
                </a>
                <a 
                  href="https://calendly.com/tre-aqo7/30min" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Calendar size={14} />
                  Schedule a Call
                </a>
              </div>
            </div>
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

export default Q3Review2025;

