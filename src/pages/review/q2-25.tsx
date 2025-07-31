import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ArrowLeft, Trophy, Users, Star, Activity, Calendar, RefreshCw, Target, Brain, Zap, TrendingUp, Award, Bot } from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';
import MonthInReviewMeta from '../../components/MonthInReviewMeta';
import Spacer from '../../components/Spacer';

// Q2 Overall Key Metrics - matching Q1 structure
const q2OverallMetrics = [
  {
    label: "Subscribed Members",
    currentValue: 186,
    previousValue: 144,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Unique Moves Added",
    currentValue: 556,
    previousValue: 354,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Total Workouts Logged",
    currentValue: 3180,
    previousValue: 980,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Earnings",
    currentValue: 1625,
    previousValue: 1060,
    isCurrency: true,
    showGrowth: true
  }
];

// Morning Mobility Round Metrics
const morningMobilityMetrics = [
  {
    label: "Challenge Participants",
    currentValue: 83,
    previousValue: 35,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Workouts Completed (in Round)",
    currentValue: 1630,
    previousValue: 940,
    isCurrency: false,
    showGrowth: true
  }
];

const Q2Review2025 = () => {
  const metaTitle = "Q2 2025 Mid-Quarter Review: Quarter of the Agents | Pulse";
  const metaDescription =
    "Pulse Q2 2025: The quarter we became a defensible creator platform with AI agents, 10x dev velocity, and three stage victories.";
  const metaImage = "https://fitwithpulse.ai/q2-2025-review.png";
  const pageUrl = "https://fitwithpulse.ai/review/q2-25";

  return (
    <>
      <MonthInReviewMeta
        title={metaTitle}
        description={metaDescription}
        imageUrl={metaImage}
        pageUrl={pageUrl}
      />

      <div className="min-h-screen bg-white">
        {/* Back to Reviews Link */}
        <div className="bg-zinc-900 text-white py-4">
          <div className="max-w-6xl mx-auto px-4">
            <Link href="/review" className="flex items-center text-sm gap-2 text-[#E0FE10] hover:underline">
              <ArrowLeft size={20} />
              View Other Reviews
            </Link>
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white py-24">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-sm font-medium text-[#E0FE10]">Mid-Quarter Review</div>
            <h1 className="mt-2 text-5xl sm:text-7xl font-bold font-['Thunder']">
              Q2 2025: Quarter of the Agents
            </h1>
            <div className="mt-2 text-zinc-400 text-xl font-['Thunder']">April - June 2025</div>
            <p className="mt-4 text-zinc-400 max-w-2xl text-lg" data-description="true">
              In the first seven weeks of Q2 we vaulted Pulse from promising app to defensible creator platform. 
              We earned stage wins at major pitch events and secured keynote speaking opportunities. 
              Our advisor bench deepened with three new operator-grade voices plus a Harvard-trained Chief of Staff.
            </p>
          </div>
        </div>

        {/* Executive Snapshot Section */}
        <div className="max-w-6xl mx-auto px-4 -mt-12 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Bot className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Executive Snapshot: "Quarter of the Agents"</h2>
            </div>
            <p className="text-lg text-zinc-600 mb-8">
              In the first seven weeks of Q2 we vaulted Pulse from promising app to defensible creator platform. 
              We earned stage wins at major pitch events and secured keynote speaking opportunities. 
              Our advisor bench deepened with three new operator-grade voices plus a Harvard-trained Chief of Staff.
            </p>
            
            <div className="bg-zinc-50 rounded-lg p-6 mb-8">
              <h3 className="text-xl font-bold mb-4">🤖 Agentic Layer Revolution</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-bold mb-2">Cursor AI IDE</h4>
                  <p className="text-sm text-zinc-600">Instant code-gen, refactors, test scaffolds</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-bold mb-2">Bug-Bot & Background Agents</h4>
                  <p className="text-sm text-zinc-600">Auto-detect & patch regressions during off-hours</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-bold mb-2">Pulse PR-Ops (custom)</h4>
                  <p className="text-sm text-zinc-600">Monitors Airtable → drafts press releases, updates</p>
                </div>
              </div>
            </div>

            <div className="bg-[#E0FE10] rounded-lg p-6">
              <h3 className="text-xl font-bold mb-2">🎯 Vision</h3>
              <p className="text-zinc-800">
                We're building the future of work where AI agents aren't just tools—they're teammates. 
                Each agent gets a name, a role, and an actual seat at our table, transforming how startups scale with autonomous intelligence.
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics Section */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Q2 Overall Key Metrics</h2>
            </div>
            <div className="mb-8">
              <p className="text-lg text-zinc-600">
                Beyond our breakthrough moments, Q2 showed continued platform growth across key user and activity metrics.
              </p>
            </div>
            <MetricsGrid metrics={q2OverallMetrics} />

          </div>
        </div>

        {/* Stage Wins & Validation Section */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Stage Wins & Third-Party Validation</h2>
            </div>
            <p className="text-lg text-zinc-600 mb-6">
              Q2 brought unprecedented third-party validation through three major stage appearances and award wins.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-6 rounded-lg">
                <Award className="text-orange-600 mb-3" size={24} />
                <h3 className="font-bold text-lg mb-2">Audience Favorite Award</h3>
                <p className="text-zinc-700">🏆 ReBrand Pitch</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg">
                <Users className="text-purple-600 mb-3" size={24} />
                <h3 className="font-bold text-lg mb-2">Audience Choice + New Advisor</h3>
                <p className="text-zinc-700">☕ 1 Million Cups</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-teal-50 p-6 rounded-lg">
                <Target className="text-teal-600 mb-3" size={24} />
                <h3 className="font-bold text-lg mb-2">Men's Health Day Keynote</h3>
                <p className="text-zinc-700">🏋️ BrickHouse Gym</p>
              </div>
            </div>
            
            <div className="mt-6 bg-zinc-50 rounded-lg p-6">
              <h3 className="font-bold mb-3">📈 Additional Validation</h3>
              <ul className="space-y-2 text-zinc-600">
                <li>• Selected to pitch at Atlanta Ventures Health & Wellness Meetup (June)</li>
                <li>• Added SoulCycle & Solidcore creators to 100 Coaches pipeline</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Morning Mobility Round Section */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Users className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Morning Mobility Round: Our Breakthrough</h2>
            </div>
            <p className="text-lg text-zinc-600 mb-6">
              The Morning Mobility Challenge became our breakout success, demonstrating the power of our social loop and creator multiplier effect.
              Check out the key results from our flagship challenge below!
            </p>
            <MetricsGrid metrics={morningMobilityMetrics} />
            
            <div className="mt-8 bg-[#E0FE10] rounded-lg p-6">
              <h3 className="font-bold text-lg mb-2">📊 Key Achievements</h3>
              <ul className="space-y-2 text-zinc-800">
                <li>• 83 total participants joined with 65.2% coming through referrals</li>
                <li>• Over 1,630 workouts completed, demonstrating sustained user activity</li>
                <li>• Challenge format validates our creator-led community approach</li>
              </ul>
            </div>
          </div>
        </div>

        {/* What We Nailed Section */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Star className="text-black" size={28} />
              <h2 className="text-2xl font-bold">What We Nailed (April 1 – May 15)</h2>
            </div>
            
            <div className="space-y-6">
              <div className="border-l-4 border-green-500 pl-6">
                <h3 className="font-bold text-lg mb-2">Challenge Activation</h3>
                <ul className="text-zinc-600 space-y-1">
                  <li>• Morning Mobility Challenge live → 68 organic joins</li>
                </ul>
                <p className="text-sm text-green-600 mt-2">💡 Validates social loop & creator multiplier</p>
              </div>
              
              <div className="border-l-4 border-blue-500 pl-6">
                <h3 className="font-bold text-lg mb-2">Virality Engine</h3>
                <ul className="text-zinc-600 space-y-1">
                  <li>• User referrals and social sharing features driving organic growth</li>
                </ul>
                <p className="text-sm text-blue-600 mt-2">💡 Users are successfully bringing in new members without paid advertising</p>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-6">
                <h3 className="font-bold text-lg mb-2">Growth Stack</h3>
                <ul className="text-zinc-600 space-y-1">
                  <li>• Brevo (115k import + flows) • TikTok pixel → 1M impr / $0.47 CAC</li>
                </ul>
                <p className="text-sm text-purple-600 mt-2">💡 Scalable retargeting & lifecycle comms</p>
              </div>
              
              <div className="border-l-4 border-orange-500 pl-6">
                <h3 className="font-bold text-lg mb-2">Brand + IP</h3>
                <ul className="text-zinc-600 space-y-1">
                  <li>• Pulse Programming™ launch • TM filed • provisional patent</li>
                </ul>
                <p className="text-sm text-orange-600 mt-2">💡 Defensible moat; investor signal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Talent Upgrades Section */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Users className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Talent Upgrades</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg">
                <h3 className="font-bold text-lg mb-3">🎓 Chief of Staff</h3>
                <p className="text-zinc-700 mb-2"><strong>Bobby Nweke</strong></p>
                <p className="text-sm text-zinc-600">Harvard / ex-TED coach</p>
                <p className="text-sm text-blue-600 mt-2">Top-tier storytelling guidance</p>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg">
                <h3 className="font-bold text-lg mb-3">🧠 New Advisors</h3>
                <ul className="text-sm text-zinc-600 space-y-1">
                  <li>• <strong>Valerie Alexander</strong> - Happiness, Inclusion & Bias</li>
                  <li>• <strong>DeRay Mckesson</strong> - Community Building and Organizing</li>
                  <li>• <strong>Marques Zak</strong> - Marketing and Growth</li>
                </ul>
                <p className="text-sm text-green-600 mt-2">Community building & inclusive growth guidance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Extra Wins Section */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Extra Wins</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                  <p className="text-zinc-700">Investor Dataroom v2 with live K-factor dashboard</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                  <p className="text-zinc-700">Pulse PR-Ops AI agent drafting releases & investor notes</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                  <p className="text-zinc-700">iOS crash-free sessions ↑ to 99.3%</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                  <p className="text-zinc-700">First Apple Watch HR streaming inside Sweat Sync Live</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                  <p className="text-zinc-700">Stripe Connect revenue-share ledger live</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                  <p className="text-zinc-700">Admin Tools CMS • 100 Coaches CRM • Pulse Check app inception</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top-5 Priorities Section */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Target className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Top-5 Priorities for Next Quarter (Q3) (July 1 → September 30, 2025)</h2>
            </div>
            
            <div className="space-y-4">
              {[
                { id: 1, title: "Fundraising", target: "Close Seed round • $500K-$1M raised" },
                { id: 2, title: "Strategic Partnerships", target: "1 brand partnership (exploring ON collaboration) • 1 corporate pilot" },
                { id: 3, title: "100 Coaches Program", target: "Onboard first 40 trainers • establish program foundation" },
                { id: 4, title: "PR & Thought Leadership", target: "5 major media placements" },
                { id: 5, title: "Product Scale", target: "Grow subscriber base by 30%" }
              ].map((priority) => (
                <div key={priority.id} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold">
                    {priority.id}
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-bold">{priority.title}</h3>
                    <p className="text-sm text-zinc-600">{priority.target}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>



        <Spacer />
      </div>
    </>
  );
};

export default Q2Review2025; 