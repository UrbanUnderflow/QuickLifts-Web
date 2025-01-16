import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ArrowLeft, Trophy, Users, Star, Activity, Calendar  } from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';
import MonthInReviewMeta from '../../components/MonthInReviewMeta'; // Import the meta component


const metrics = [
  {
    label: "Active Users",
    currentValue: 90,
    previousValue: 86,
    isCurrency: false
  },
  {
    label: "Unique Moves",
    currentValue: 216,
    previousValue: 0,
    isCurrency: false,
    showGrowth: false
  },
  {
    label: "Workouts Completed",
    currentValue: 417,
    previousValue: 0,
    isCurrency: false,
    showGrowth: false
  },
  {
    label: "Revenue",
    currentValue: 168,
    previousValue: 201,
    isCurrency: true
  }
];

const MonthInReview = () => {
  const metaTitle = "November 2024: Month in Review | Pulse";
  const metaDescription =
    "Explore Pulse's November highlights, including community building, accelerator applications, and major achievements as we shift from building to scaling.";
  const metaImage = "https://fitwithpulse.ai/november-2024-review.png"; // Replace with an actual image URL for this review
  const pageUrl = "https://fitwithpulse.ai/month-in-review/november-2024";

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
        Shifting From Building Code
        <span className="block">to Building Community</span>
      </h1>
      <div className="mt-2 text-zinc-400 text-xl font-['Thunder']">November 2024</div>
      <p className="mt-4 text-zinc-400 max-w-2xl text-lg" data-description="true">
        November marks a pivotal shift in our journey, moving beyond the building phase to 
        deeply engaging with our community and future partners. While our technology foundations 
        remain strong, we're now focusing on the conversations and connections that matter most. 
        From prestigious tech accelerator programs to vibrant community partnerships, 
        we're fostering meaningful dialogues about the future of social fitness and building 
        relationships that will help guide our next steps moving into 2025.
      </p>
    </div>
  </div>

    {/* Major Achievements Section */}
    <div className="max-w-6xl mx-auto px-4 -mt-12">
    <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
        <Trophy className="text-black" size={28} />
        <h2 className="text-2xl font-bold">November's Achievements</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
            {
                title: "IBM Sports Innovation",
                description: <>Selected for <a href="https://developer.ibm.com/startups/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">IBM Startups</a> in collaboration with <a href="https://www.hypesportsinnovation.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Hype Sports Innovation</a> program, joining an elite group of sports tech innovators.</>
            },
            {
                title: "AcceleratorCon Finalist",
                description: <>Selected to present at the Draft Experience, where we shared our vision with investors from <a href="https://500.co" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">500 Global</a> and <a href="https://www.plugandplaytechcenter.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Plug & Play</a> in New York.</>
            },
            {
                title: "Startup Runway Finalist",
                description: <>Selected as a finalist to pitch at the <a href="https://startuprunway.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Startup Runway</a> event on December 5th at Valor VC Day.</>
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
            As we move from building to scaling, we’re focusing on meaningful metrics like Workouts Completed and Moves—real indicators of deeper engagement. While we’re just starting to track these metrics, they’re key to validating our belief that content creators will drive impactful usage beyond organic downloads.
            <br></br><br></br>With intentional marketing efforts launching in the new year, we’re excited to amplify creator impact and grow a thriving, engaged community.
            </p>
            </div>
            <MetricsGrid metrics={metrics} />
        </div>
        </div>
      {/* Community Spotlight */}
      <div className="max-w-6xl mx-auto px-4 mt-16">
        <div className="flex items-center gap-3 mb-6">
          <Users className="text-black" size={28} />
          <h2 className="text-2xl font-bold">Building in Atlanta and Beyond</h2>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="prose max-w-none">
            <p className="text-lg text-zinc-600 mb-6">
            This month, we deepened our integration into Atlanta’s vibrant tech ecosystem by pitching at Atlanta Tech Village, attending various pitch events across the city, and pursuing the It Takes a Village pre-accelerator.
            The supportive community and energy of Atlanta remain foundational as we grow Pulse into a platform that connects fitness enthusiasts around the globe.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              <div>
                <h3 className="text-xl font-bold mb-4">Community Engagement</h3>
                <ul className="space-y-3 text-zinc-600">
                  <li>• Pitched at Atlanta Tech Village</li>
                  <li>• Applied for <a href="https://www.techstars.com/accelerators/nyc" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">TechStars NYC</a> accelerator program</li>
                  <li>• Applied for <a href="https://www.techstars.com/accelerators/baltimore-ai-health" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">TechStars AI Health in Baltimore</a></li>
                  <li>• Submitted application for <a href="https://500.co/founders/flagship" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">500 Global</a></li>
                  <li>• Applied for <a href="https://www.atlantatechvillage.com/programs/pre-accelerator" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">It Takes A Village pre-accelerator</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-4">Looking to Build Deeper Roots in Atlanta</h3>
                <p className="text-zinc-600">
                As we continue to grow Pulse, we’re looking to strengthen our ties within Atlanta’s thriving ecosystem. We’re seeking connections to local programs, potential partners, and opportunities to collaborate with like-minded innovators in the city.
                <br></br><br></br>If you’re part of Atlanta’s tech, fitness, or entrepreneurial community—or know someone who is—let’s connect. 
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Feature Spotlight */}
      <div className="max-w-6xl mx-auto px-4 mt-16">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl shadow-lg p-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="text-white" size={28} />
            <h2 className="text-2xl font-bold">Introducing: Rounds🎉</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <p className="text-lg text-zinc-300 mb-6">
                Coming January 2025, Rounds revolutionizes community workouts by enabling 
                real-time interaction and engagement between fitness creators and their audiences.
              </p>
              <div className="space-y-4">
                <h3 className="font-bold text-[#E0FE10]">Feature Highlights</h3>
                <ul className="space-y-3 text-zinc-300">
                  <li>• Time-based synchronized workouts</li>
                  <li>• Live chat and community interaction</li>
                  <li>• Push notifications for workout check-ins</li>
                  <li>• Post-workout community engagement</li>
                </ul>
              </div>

              
                <div>
              <div className="bg-zinc-800 p-6 rounded-lg">
                <h3 className="font-bold mb-4">Creator Spotlight: Jaidus</h3>
                <Image 
                    src="/jaidus.png" // or whatever extension your image has (.jpg, .jpeg, etc.)
                    alt="Jaidus" 
                    width={400} 
                    height={400} 
                    className="rounded-lg"
                />                
                <p className="text-zinc-300">
                  We're thrilled to announce our collaboration with SoulCycle instructor and personal trainer Jaidus, 
                  who will be pioneering our Rounds feature with an exclusive community challenge.
                </p>
                <button className="mt-6 bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-medium flex items-center gap-2">
                  Download Pulse Now
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </div>   
            </div>
            <Image 
                    src="/roundsPreview.png" // or whatever extension your image has (.jpg, .jpeg, etc.)
                    alt="Jaidus" 
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
              A primary goal for Pulse right now is to gain acceptance into an accelerator program that can help us prepare for fundraising and build the operational foundation needed to scale our user base. 
            </p>
            <h3 className="text-xl font-bold mb-4">Ways You Can Support:</h3>
            <ul className="space-y-3 text-zinc-600">
              <li>• Introductions to accelerator programs focused on AI, health, or fitness</li>
              <li>• Connections to angel investors or early-stage VCs aligned with our mission</li>
              <li>• Partnerships or opportunities within the fitness or tech communities</li>
            </ul>
            <p className="mt-6 text-zinc-600">
              If you or someone you know can assist in any of these areas, we’d love to connect. Your support can help us take the next big step toward scaling Pulse.
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
              This month, we’ve been fortunate to receive incredible support and guidance from a variety of individuals and organizations. We want to take a moment to express our gratitude:
            </p>
            <ul className="space-y-3 text-zinc-600">
              <li>• The hosts of AcceleratorCon for accepting our company as finalists</li>
              <li>• <a href="https://www.linkedin.com/in/jordansawadogo/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Jordan Sawadogo</a> from <a href="https://500.co/founders/flagship" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">500 Global</a> and <a href="https://www.linkedin.com/in/justinmurray2577/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Justin Murray</a> from <a href="https://www.plugandplaytechcenter.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Plug & Play</a> for taking the time to interview us during the Draft Experience</li>
              <li>• <a href="https://www.linkedin.com/in/jaceycadet/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Jacey Cadet</a> from <a href="https://www.atlantatechvillage.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Atlanta Tech Village</a> for valuable feedback on our pitch</li>
              <li>• <a href="https://startuprunway.org/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Start-Up Runway</a> for accepting us as finalists for the December 5th pitch event</li>
              <li>• <a href="https://www.hypesportsinnovation.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Hype Sports Innovation</a> for acceptance into their program in partnership with IBM</li>
              <li>• Jaidus for his invaluable feedback and input on our upcoming "Rounds" feature</li>
            </ul>
            <p className="mt-6 text-lg text-zinc-600">
              Thank you all for your incredible support! We’re looking forward to a productive and impactful December as we continue building and scaling Pulse.
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
                <div className="text-2xl font-bold">Dec 5</div>
                <div className="text-zinc-500">2024</div>
                </div>
                <div className="flex-grow">
                <h3 className="font-bold">Startup Showdown Pitch Event</h3>
                <p className="text-zinc-600 mt-1">
                    Watch us pitch alongside innovative startups and connect with industry leaders.
                </p>
                </div>
                <a 
                href="https://www.tfaforms.com/4990537?tfa_5=a0PJw00000ND1ib" 
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