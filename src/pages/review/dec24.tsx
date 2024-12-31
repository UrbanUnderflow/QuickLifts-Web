import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ArrowLeft, Trophy, Users, Star, Activity, Calendar  } from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';
import MonthInReviewMeta from '../../components/MonthInReviewMeta';

const metrics = [
  {
    label: "Active Users",
    currentValue: 120,
    previousValue: 90,
    isCurrency: false
  },
  {
    label: "Moves",
    currentValue: 250,
    previousValue: 194,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Workouts Completed",
    currentValue: 580,
    previousValue: 417,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Revenue",
    currentValue: 210,
    previousValue: 168,
    isCurrency: true
  }
];

const MonthInReview = () => {
  const metaTitle = "December 2024: Month in Review | Pulse";
  const metaDescription =
    "Explore Pulse's December highlights, including our Rounds feature launch, successful beta testing, and major achievements as we expand our fitness community.";
  const metaImage = "https://fitwithpulse.ai/december-2024-review.png";
  const pageUrl = "https://fitwithpulse.ai/month-in-review/december-2024";

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
              December was a jam-packed month of achievements and growth! We successfully launched our Rounds feature with a kickoff event at SoulCycle Buckhead, 
              completed vital beta testing, and competed in our first pitch event. The energy and momentum heading into the New Year is incredible as we focus on 
              expanding our creator community and enhancing the Rounds experience.
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
                December marked a significant uptick in user engagement with the launch of Rounds. We've seen encouraging growth across all key metrics, 
                particularly in workout completions and community engagement. The successful beta testing phase and official launch have created 
                momentum that we're excited to build upon in the new year.
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div>
                  <h3 className="text-xl font-bold mb-4">Launch Highlights</h3>
                  <ul className="space-y-3 text-zinc-600">
                    <li>• Successful kickoff event at SoulCycle Buckhead</li>
                    <li>• Strong beta testing group engagement</li>
                    <li>• Positive creator feedback on the Rounds feature</li>
                    <li>• Growing interest from Atlanta fitness community</li>
                    <li>• Expanding network of potential creator partners</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-4">Looking Forward to 2025</h3>
                  <p className="text-zinc-600">
                    As we enter the new year, we're focused on expanding our creator network and enhancing the Rounds experience. We're actively 
                    seeking partnerships with fitness professionals and facilities across Atlanta to bring more diverse workout experiences to our community.
                    <br /><br />
                    If you're a fitness professional interested in hosting Rounds or know someone who might be, we'd love to connect.
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
                    <li>• Enhanced engagement metrics</li>
                  </ul>
                </div>

                <div className="mt-8">
                  <div className="bg-zinc-800 p-6 rounded-lg">
                    <h3 className="font-bold mb-4">Join Our Next Round</h3>
                    <p className="text-zinc-300">
                      Experience the power of community training with our upcoming Rounds. Connect with fellow fitness enthusiasts and push your 
                      limits together.
                    </p>
                    <button className="mt-6 bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-medium flex items-center gap-2">
                      Download Pulse Now
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                </div>   
              </div>
              <Image 
                src="/roundsPreview.png"
                alt="Rounds Preview" 
                width={400} 
                height={400} 
                className="rounded-lg"
              />   
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
            <h2 className="text-2xl font-bold mb-6">Join Us at Upcoming Events</h2>
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-shrink-0 w-24 text-center">
                  <div className="text-2xl font-bold">Jan 31</div>
                  <div className="text-zinc-500">2025</div>
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold">First Round Celebration</h3>
                  <p className="text-zinc-600 mt-1">
                    Join us at Lululemon for a community celebration of our first completed Round.
                  </p>
                </div>
                <a 
                  href="https://forms.gle/your-registration-link" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-shrink-0 bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 mt-4 sm:mt-0"
                >
                  Register to Attend
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
