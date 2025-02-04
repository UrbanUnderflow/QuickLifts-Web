import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ArrowLeft, Trophy, Users, Star, Activity, Calendar  } from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';
import MonthInReviewMeta from '../../components/MonthInReviewMeta';
import Spacer from '../../components/Spacer';

const metrics = [
  {
    label: "Subscribed Members",
    currentValue: 127,
    previousValue: 120,
    isCurrency: false
  },
  {
    label: "Unique Moves",
    currentValue: 251,
    previousValue: 213,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Workouts Completed",
    currentValue: 774,
    previousValue: 555,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Revenue",
    currentValue: 238,
    previousValue: 247,
    isCurrency: true
  }
];

const MonthInReview = () => {
  const metaTitle = "December 2024: Month in Review | Pulse";
  const metaDescription =
    "Explore Pulse's December highlights, including our Rounds feature launch, successful beta testing, and major achievements as we expand our fitness community.";
  const metaImage = "https://fitwithpulse.ai/december-2024-review.png";
  const pageUrl = "https://fitwithpulse.ai/month-in-review/december-2024";
  const [isPlaying, setIsPlaying] = useState(false);

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
            <div className="text-sm font-medium text-[#E0FE10]">Month in Review</div>
            <h1 className="mt-2 text-5xl sm:text-7xl font-bold font-['Thunder']">
              Welcome to Rounds
              <span className="block"></span>
            </h1>
            <div className="mt-2 text-zinc-400 text-xl font-['Thunder']">December 2024</div>
            <p className="mt-4 text-zinc-400 max-w-2xl text-lg" data-description="true">
            We celebrated the launch of Rounds with a special event at SoulCycle Buckhead, marking our first official partnership with instructor Jaidus. 
            The morning was filled with energy and excitement as our community came together to experience this new chapter in group fitness training. 
            The enthusiasm from both Jaidus and the attendees validated our vision for Rounds as a powerful tool for community-driven fitness.
            </p>
          </div>
        </div>

        {/* Major Achievements Section */}
        <div className="max-w-6xl mx-auto px-4 -mt-12">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="text-black" size={28} />
              <h2 className="text-2xl font-bold">December's Achievements</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: "Rounds Launch Success",
                  description: "Successfully launched our Rounds feature with SoulCycle Buckhead instructor Jaidus, marking our first public group training experience."
                },
                {
                  title: "Beta Testing Milestone",
                  description: "Completed comprehensive beta testing with selected users, gathering invaluable feedback that shaped our public release."
                },
                {
                  title: "First Pitch Competition",
                  description: "Made our mark in our first major pitch competition, establishing valuable connections in the startup ecosystem."
                }
              ].map((achievement, index) => (
                <div key={index} className="bg-zinc-50 p-6 rounded-lg">
                  <Star className="text-black mb-4" size={20} />
                  <h3 className="font-bold mb-2">{achievement.title}</h3>
                  <div className="text-zinc-600">{achievement.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key Metrics Section */}
        <div className="max-w-6xl mx-auto px-4 mt-16">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="text-black" size={28} />
            <h2 className="text-2xl font-bold">Key Metrics</h2>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="mb-8">
              <p className="text-lg text-zinc-600">
                December marked a significant uptick in user engagement with the launch of Rounds. We've seen encouraging growth across all key metrics. The successful beta testing phase and official launch have created 
                momentum that we're excited to build upon this year.
                <br /><br />
                As we move into 2025, our focus will be on expanding our creator network and enhancing the Rounds experience based on user feedback.
              </p>
            </div>
            <MetricsGrid metrics={metrics} />
          </div>
        </div>

        {/* Community Spotlight */}
        <div className="max-w-6xl mx-auto px-4 mt-16">
          <div className="flex items-center gap-3 mb-6">
            <Users className="text-black" size={28} />
            <h2 className="text-2xl font-bold">Community Growth and Engagement</h2>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="prose max-w-none">
              <p className="text-lg text-zinc-600 mb-6">
                Our December launch event at SoulCycle Buckhead marked a pivotal moment in Pulse's community building efforts. The enthusiasm and 
                engagement from both creators and users have validated our vision for Rounds as a powerful tool for community-driven fitness.
              </p>

              {/* Media Grid Section - Now with equal-sized cells */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 my-8">
                {/* Video */}
                <div className="aspect-[9/16] w-full bg-zinc-100 rounded-lg overflow-hidden relative">
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

                {/* First Image */}
                <div className="aspect-[9/16] w-full bg-zinc-100 rounded-lg overflow-hidden">
                  <Image 
                    src="/cake.jpg" 
                    alt="Launch Event Celebration Cake" 
                    width={400}
                    height={600}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Second Image */}
                <div className="aspect-[9/16] w-full bg-zinc-100 rounded-lg overflow-hidden">
                  <Image 
                    src="/toast.jpg" 
                    alt="Launch Event Toast" 
                    width={400}
                    height={600}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Content Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div>
                  <h3 className="text-xl font-bold mb-4">Event Wins</h3>
                  <ul className="space-y-3 text-zinc-600">
                    <li>• Successful kickoff event at SoulCycle Buckhead</li>
                    <li>• Created warm connections and brand awareness amongst SoulCycle riders</li>
                    <li>• Received valuable feedback from attendees</li>
                    <li>• Signed up a handful of individuals for the challenge</li>
                  </ul>
                  <Spacer size={48} />
                  <h3 className="text-xl font-bold mb-4">Key Learnings</h3>
                  <ul className="space-y-3 text-zinc-600">
                    <li>• Registration feels longer than needed. Will shorten this for Round sign ups.</li>
                    <li>• Goal for events of this format should be soley brand awareness as people don't have as much time inbetween cycling and moving forward with their day.</li>
                    <li>• Have more branded items for individuals to take with them(shirts, towels, etc)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-4">What's Next</h3>
                  <p className="text-zinc-600">
                    Building on the success of our launch event, we're excited to create more in-person experiences that bridge our digital and physical communities. Looking ahead to February, we're launching our next Round featuring both <a href="https://www.soul-cycle.com/instructors/10241/Jaidus/" target="_blank" rel="noopener noreferrer" className="text-black hover:text-zinc-700 underline">Jaidus</a> and <a href="https://www.soul-cycle.com/instructors/10699/Vynnessa/" target="_blank" rel="noopener noreferrer" className="text-black hover:text-zinc-700 underline">Vynnessa Smith</a>, two incredible SoulCycle Buckhead instructors.
                  <br /><br />
                    Beyond SoulCycle, we're actively building partnerships with established fitness communities across Atlanta to bring diverse training experiences to our platform. If you're part of a fitness community interested in hosting Rounds, we'd love to connect and explore how we can grow together.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Spotlight */}
        <div className="max-w-6xl mx-auto px-4 mt-16">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl shadow-lg p-8 text-white">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="text-white" size={28} />
              <h2 className="text-2xl font-bold">Rounds: Now Live! 🎉</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <p className="text-lg text-zinc-300 mb-6">
                  Rounds has officially launched, bringing a new dimension to community fitness. Our first public Round with Jaidus from SoulCycle 
                  Buckhead showcases the feature's potential to transform how we train together.
                </p>
                <div className="space-y-4">
                  <h3 className="font-bold text-[#E0FE10]">Launch Success</h3>
                  <ul className="space-y-3 text-zinc-300">
                    <li>• Strong participation in first public Round</li>
                    <li>• Positive community feedback</li>
                    <li>• Growing creator interest</li>
                    <li>• Received vital UI suggestions, and crtical feedback</li>
                  </ul>
                </div>

                <div className="mt-8">
                  <div className="bg-zinc-800 p-6 rounded-lg">
                    <h3 className="font-bold mb-4">Join Our Next Round</h3>
                    <p className="text-zinc-300">
                      Experience the power of community training with our upcoming Rounds. Connect with fellow fitness enthusiasts and push your 
                      limits together.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <a 
                        href="https://apps.apple.com/ca/app/pulse-community-fitness/id6451497729"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-6 bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-medium flex items-center gap-2 hover:bg-[#d4f00f] transition-colors"
                      >
                        Download Pulse Now
                        <ArrowUpRight size={18} />
                      </a>
                      <a 
                        href="https://fitwithpulse.ai/challenge/cevWHBlBk7VobANRUsmC"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-6 bg-blue-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-400 transition-colors"
                      >
                        Join Jaidus's Round
                        <ArrowUpRight size={18} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <Image 
                  src="/leaderboard.png"
                  alt="Rounds leaderboard" 
                  width={400} 
                  height={400} 
                  className="rounded-lg w-full"
                />   
                <Image 
                  src="/challenge-notifications.png"
                  alt="Rounds notifications" 
                  width={400} 
                  height={400} 
                  className="rounded-lg w-full"
                />   
              </div>
            </div>
          </div>
        </div>

        {/* How You Can Help Section */}
        <div className="max-w-6xl mx-auto px-4 mt-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Star className="text-black" size={28} />
              <h2 className="text-2xl font-bold">How You Can Help</h2>
            </div>
            <div className="prose max-w-none">
              <p className="text-lg text-zinc-600 mb-6">
                As we build momentum with Rounds, we're looking for support in several key areas to maximize our impact and reach.
              </p>
              <h3 className="text-xl font-bold mb-4">Ways to Support:</h3>
              <ul className="space-y-3 text-zinc-600">
                <li>• Introductions to fitness creators and trainers interested in hosting Rounds</li>
                <li>• Connections to gyms and fitness facilities for potential partnerships</li>
                <li>• Feedback on the Rounds experience and feature suggestions</li>
                <li>• Sharing Pulse with your fitness network</li>
              </ul>
              <p className="mt-6 text-zinc-600">
                Your support in these areas will help us create an even more engaging and effective platform for community fitness.
              </p>
            </div>
          </div>
        </div>

        {/* Thank You Section */}
        <div className="max-w-6xl mx-auto px-4 mt-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Giving Gratitude</h2>
            </div>
            <div className="prose max-w-none">
              <p className="text-lg text-zinc-600 mb-6">
                We're incredibly grateful for the support and collaboration that made our December achievements possible:
              </p>
              <ul className="space-y-3 text-zinc-600">
                <li>• Jaidus and SoulCycle Buckhead for hosting our launch event</li>
                <li>• Our beta testing group for their valuable feedback and patience</li>
                <li>• The Atlanta fitness community for their warm welcome and support</li>
                <li>• Our early Rounds participants for their enthusiasm and engagement</li>
                <li>• The startup community for their support during our first pitch competition</li>
              </ul>
              <p className="mt-6 text-lg text-zinc-600">
                Thank you all for being part of our journey! We're excited to build on this momentum in 2025.
              </p>
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="max-w-6xl mx-auto px-4 mt-16 mb-24">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Join Our 30-Day Ab Challenge</h2>
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-shrink-0 w-24 text-center">
                  <div className="text-2xl font-bold">Jan 31</div>
                  <div className="text-zinc-500">2025</div>
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold">30-Day Ab Challenge</h3>
                  <p className="text-zinc-600 mt-1">
                    Kickstart your fitness journey and build core strength with our 30-day ab challenge. Join Jaidus and a community of fitness enthusiasts to push your limits and achieve your goals together.
                  </p>
                </div>
                <a 
                  href="https://fitwithpulse.ai/challenge/cevWHBlBk7VobANRUsmC" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-shrink-0 bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 mt-4 sm:mt-0"
                >
                  Join the Challenge
                  <ArrowUpRight size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MonthInReview;
