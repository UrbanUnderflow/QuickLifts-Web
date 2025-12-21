import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Head from 'next/head';
import { ArrowUpRight, ArrowLeft, Trophy, Users, Star, Activity, Calendar, CheckCircle, Sparkles, Download } from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';

const metrics = [
  {
    label: "Subscribed Members",
    currentValue: 120,
    previousValue: 90,
    isCurrency: false
  },
  {
    label: "Unique Moves",
    currentValue: 213,
    previousValue: 194,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Workouts Completed",
    currentValue: 555,
    previousValue: 417,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Revenue",
    currentValue: 247,
    previousValue: 168,
    isCurrency: true
  }
];

const achievements = [
  {
    title: "Rounds Launch Success",
    description: "Successfully launched our Rounds feature with SoulCycle Buckhead instructor Jaidus, marking our first public group training experience.",
    featured: true
  },
  {
    title: "Beta Testing Milestone",
    description: "Completed comprehensive beta testing with selected users, gathering invaluable feedback that shaped our public release."
  },
  {
    title: "First Pitch Competition",
    description: "Made our mark in our first major pitch competition, establishing valuable connections in the startup ecosystem."
  }
];

const Dec24Review = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <>
      <Head>
        <title>December 2024: Month in Review | Pulse</title>
        <meta name="description" content="Explore Pulse's December highlights, including our Rounds feature launch, successful beta testing, and major achievements as we expand our fitness community." />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Subtle gradient orbs for depth */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-gray-200/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-gray-100/60 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-gradient-to-br from-lime-100/20 to-transparent rounded-full blur-3xl" />
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
            December 2024
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Welcome to Rounds
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl" data-description="true">
            We celebrated the launch of Rounds with a special event at SoulCycle Buckhead, marking our first official partnership with instructor Jaidus. 
            The morning was filled with energy and excitement as our community came together to experience this new chapter in group fitness training.
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

        {/* Achievements */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Trophy size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              December's Achievements
            </h2>
          </div>
          
          <div className="space-y-4">
            {achievements.map((item, index) => (
              <div 
                key={index}
                className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                  item.featured 
                    ? 'bg-gradient-to-br from-amber-50/80 to-yellow-50/60 backdrop-blur-xl border border-amber-200/60 shadow-lg shadow-amber-100/40' 
                    : 'bg-white/50 backdrop-blur-lg border border-gray-200/50 hover:bg-white/70 hover:shadow-lg hover:shadow-gray-200/30'
                }`}
              >
                {item.featured && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400" />
                )}
                
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      item.featured ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      <Star size={16} className={item.featured ? 'text-amber-600' : 'text-gray-700'} />
                    </div>
                    <div className="flex-grow">
                      {item.featured && (
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={14} className="text-amber-500" />
                          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                            Key Milestone
                          </span>
                        </div>
                      )}
                      <h3 className={`font-semibold mb-2 ${item.featured ? 'text-xl text-gray-900' : 'text-lg text-gray-900'}`}>
                        {item.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
                Key Metrics
              </h2>
            </div>
            
            <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
              <p className="text-gray-600 mb-8 leading-relaxed">
                December marked a significant uptick in user engagement with the launch of Rounds. We've seen encouraging growth across all key metrics. 
                The successful beta testing phase and official launch have created momentum that we're excited to build upon this year.
              </p>
              <MetricsGrid metrics={metrics} />
            </div>
          </div>
        </div>

        {/* Community Growth */}
        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Community Growth
            </h2>
          </div>

          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <p className="text-gray-600 mb-8 leading-relaxed">
              Our December launch event at SoulCycle Buckhead marked a pivotal moment in Pulse's community building efforts. The enthusiasm and 
              engagement from both creators and users have validated our vision for Rounds as a powerful tool for community-driven fitness.
            </p>

            {/* Media Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Video */}
              <div className="aspect-[9/16] w-full bg-gray-100 rounded-xl overflow-hidden relative">
                <video 
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  src="/LaunchEventRecap.mp4"
                  poster="/LaunchEventRecapThumbnail.png"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {!isPlaying && (
                  <button 
                    className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30"
                    onClick={(e) => {
                      e.currentTarget.parentElement?.querySelector('video')?.play();
                    }}
                  >
                    <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center transition-transform hover:scale-110">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                        <svg 
                          viewBox="0 0 24 24" 
                          className="w-6 h-6 text-black fill-current"
                          style={{ marginLeft: '2px' }}
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              <div className="aspect-[9/16] w-full bg-gray-100 rounded-xl overflow-hidden">
                <Image 
                  src="/cake.jpg" 
                  alt="Launch Event Celebration Cake" 
                  width={400}
                  height={600}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="aspect-[9/16] w-full bg-gray-100 rounded-xl overflow-hidden">
                <Image 
                  src="/toast.jpg" 
                  alt="Launch Event Toast" 
                  width={400}
                  height={600}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Event Wins</h3>
                <ul className="space-y-2 text-gray-600 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    Successful kickoff event at SoulCycle Buckhead
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    Created warm connections amongst SoulCycle riders
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    Received valuable feedback from attendees
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    Signed up individuals for the challenge
                  </li>
                </ul>

                <h3 className="font-semibold text-gray-900 mt-8 mb-4">Key Learnings</h3>
                <ul className="space-y-2 text-gray-600 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    Registration feels longer than needed. Will shorten for Round sign ups.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    Events should focus on brand awareness—people are time-constrained.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    Have more branded items (shirts, towels, etc.)
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-4">What's Next</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Building on the success of our launch event, we're creating more in-person experiences that bridge our digital and physical communities. 
                  Looking ahead to February, we're launching our next Round featuring both{' '}
                  <a href="https://www.soul-cycle.com/instructors/10241/Jaidus/" target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline font-medium">Jaidus</a>{' '}and{' '}
                  <a href="https://www.soul-cycle.com/instructors/10699/Vynnessa/" target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline font-medium">Vynnessa Smith</a>, two incredible SoulCycle Buckhead instructors.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mt-4">
                  Beyond SoulCycle, we're actively building partnerships with established fitness communities across Atlanta. If you're part of a fitness community interested in hosting Rounds, we'd love to connect.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rounds Feature */}
        <div className="relative max-w-4xl mx-auto px-6 py-8">
          <div className="bg-gray-900 rounded-2xl p-8 overflow-hidden relative">
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-lime-400 via-emerald-400 to-lime-400" />
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-lime-400 flex items-center justify-center">
                <Calendar size={16} className="text-gray-900" />
              </div>
              <h2 className="text-white font-semibold">Rounds: Now Live! 🎉</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Rounds has officially launched, bringing a new dimension to community fitness. Our first public Round with Jaidus from SoulCycle 
                  Buckhead showcases the feature's potential to transform how we train together.
                </p>
                
                <h4 className="text-lime-400 font-semibold mb-3 text-sm">Launch Success</h4>
                <ul className="space-y-2 text-gray-300 text-sm mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 flex-shrink-0" />
                    Strong participation in first public Round
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 flex-shrink-0" />
                    Positive community feedback
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 flex-shrink-0" />
                    Growing creator interest
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-lime-400 mt-0.5 flex-shrink-0" />
                    Received vital UI suggestions
                  </li>
                </ul>

                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50">
                  <h4 className="text-white font-semibold mb-2">Join Our Next Round</h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Experience the power of community training with our upcoming Rounds.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a 
                      href="https://apps.apple.com/ca/app/pulse-community-fitness/id6451497729"
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-lime-400 text-gray-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-lime-300 transition-colors"
                    >
                      Download Pulse
                      <ArrowUpRight size={14} />
                    </a>
                    <a 
                      href="https://fitwithpulse.ai/challenge/cevWHBlBk7VobANRUsmC"
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-white/20 transition-colors border border-white/20"
                    >
                      Join Jaidus's Round
                      <ArrowUpRight size={14} />
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Image 
                  src="/leaderboard.png"
                  alt="Rounds leaderboard" 
                  width={400} 
                  height={400} 
                  className="rounded-xl w-full"
                />   
                <Image 
                  src="/challenge-notifications.png"
                  alt="Rounds notifications" 
                  width={400} 
                  height={400} 
                  className="rounded-xl w-full"
                />   
              </div>
            </div>
          </div>
        </div>

        {/* How You Can Help */}
        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center">
                <Star size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">How You Can Help</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              As we build momentum with Rounds, we're looking for support in several key areas to maximize our impact and reach.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Introductions to fitness creators and trainers interested in hosting Rounds",
                "Connections to gyms and fitness facilities for potential partnerships",
                "Feedback on the Rounds experience and feature suggestions",
                "Sharing Pulse with your fitness network"
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3 bg-gray-50/80 backdrop-blur-sm rounded-lg p-4">
                  <CheckCircle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gratitude */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <Trophy size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Giving Gratitude</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              We're incredibly grateful for the support and collaboration that made our December achievements possible:
            </p>
            
            <ul className="space-y-3 text-gray-600 text-sm">
              <li>• Jaidus and SoulCycle Buckhead for hosting our launch event</li>
              <li>• Our beta testing group for their valuable feedback and patience</li>
              <li>• The Atlanta fitness community for their warm welcome and support</li>
              <li>• Our early Rounds participants for their enthusiasm and engagement</li>
              <li>• The startup community for their support during our first pitch competition</li>
            </ul>
            
            <p className="mt-6 text-gray-700 font-medium">
              Thank you all for being part of our journey! We're excited to build on this momentum in 2025.
            </p>
          </div>
        </div>

        {/* Upcoming Challenge */}
        <div className="relative border-t border-gray-200/60 backdrop-blur-sm bg-white/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Jan 31, 2025</p>
                <h3 className="text-lg font-semibold text-gray-900">30-Day Ab Challenge</h3>
                <p className="text-gray-600 text-sm">Join Jaidus and build core strength together.</p>
              </div>
              <a 
                href="https://fitwithpulse.ai/challenge/cevWHBlBk7VobANRUsmC" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all hover:shadow-lg hover:shadow-gray-900/20 inline-flex items-center gap-2"
              >
                Join the Challenge
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dec24Review;
