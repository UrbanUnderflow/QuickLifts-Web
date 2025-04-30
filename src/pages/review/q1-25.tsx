import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ArrowLeft, Trophy, Users, Star, Activity, Calendar, RefreshCw, Target, Brain } from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';
import MonthInReviewMeta from '../../components/MonthInReviewMeta';
import Spacer from '../../components/Spacer';

const metrics = [
  {
    label: "Rounds Launched",
    currentValue: 2,
    previousValue: 0,
    isCurrency: false
  },
  {
    label: "Active Round Participants",
    currentValue: 75,
    previousValue: 0,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Total Workouts Completed",
    currentValue: 2050,
    previousValue: 0,
    isCurrency: false,
    showGrowth: true
  }
];

// Define Q1 Overall Metrics - Update placeholder values
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
    label: "Total Workouts Logged", // Clarified label
    currentValue: 980, // Placeholder - Update
    previousValue: 774, // From end of Dec/Jan
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Earnings", // Changed label from MRR
    currentValue: 1060, // Updated value
    previousValue: 268, // From end of Dec/Jan 
    isCurrency: true
  }
];

const Q1Review2025 = () => {
  const metaTitle = "Q1 2025 Review: Rounds Launch & Learnings | Pulse";
  const metaDescription =
    "Pulse Q1 2025: Launching Rounds, insights from Jaidus & Vynessa's challenges, feature iterations, and shifting back to build.";
  const metaImage = "https://fitwithpulse.ai/q1-2025-review.png";
  const pageUrl = "https://fitwithpulse.ai/review/q1-2025";
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
            <div className="text-sm font-medium text-[#E0FE10]">Quarterly Review</div>
            <h1 className="mt-2 text-5xl sm:text-7xl font-bold font-['Thunder']">
              Q1 2025: Launch, Learn, Iterate
            </h1>
            <div className="mt-2 text-zinc-400 text-xl font-['Thunder']">January - March 2025</div>
            <p className="mt-4 text-zinc-400 max-w-2xl text-lg" data-description="true">
              The first quarter of 2025 was monumental for Pulse, marked by the official launch of our core Rounds feature.
              We successfully hosted our first challenges, gathered critical insights from creators and participants,
              and rapidly iterated on the platform, setting the stage for future growth.
            </p>
          </div>
        </div>

        {/* Rounds Feature Launch Section */}
        <div className="max-w-6xl mx-auto px-4 -mt-12 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Rounds Takes Center Stage</h2>
            </div>
            <p className="text-lg text-zinc-600 mb-6">
              Q1 heralded the launch of Rounds, the keystone feature built upon months of foundational development and user validation. 
              As the flagship of Pulse's community-driven fitness model, its launch marked the pivotal transition from planning and testing to real-world application, 
              placing the core challenge experience – the result of all that groundwork – directly into the hands of creators and users.
            </p>
            {/* Optional: Add an image or video here showcasing the Rounds feature */}
          </div>
        </div>

        {/* MOVED UP: Overall Key Metrics Section */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="text-black" size={28} /> 
              <h2 className="text-2xl font-bold">Q1 Overall Key Metrics</h2>
            </div>
            <div className="mb-8">
              <p className="text-lg text-zinc-600">
                Beyond the Rounds launch, Q1 showed continued platform growth across key user and activity metrics.
                {/* Add more context if needed */}
              </p>
            </div>
            {/* Use the new q1OverallMetrics array */}
            <MetricsGrid metrics={q1OverallMetrics} /> 
          </div>
        </div>

        {/* NEW: Public Announcement Video Section */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Users className="text-black" size={28} /> {/* Using Users icon for announcement */} 
              <h2 className="text-2xl font-bold">Public Announcement: Rounds is Here!</h2>
            </div>
            {/* Flex container for two columns */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Left Column: Video */}
              <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0">
                {/* Adjusted for portrait aspect ratio (e.g., aspect-[9/16]) and removed w-full from video container */}
                <div className="aspect-[9/16] bg-zinc-100 rounded-lg overflow-hidden relative">
                  <video 
                    className="w-full h-full object-cover"
                    controls
                    playsInline
                    src="/LaunchRounds.mp4" 
                    // poster="/path/to/your/poster-image.jpg" 
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
              {/* Right Column: Text & Metrics */}
              <div className="flex-grow">
                <p className="text-lg text-zinc-600 mb-4">
                  We officially announced the launch of Rounds to the public during Q1, sharing our vision for community-driven fitness.
                  Check out our announcement video and the key results from our initial Rounds below!
                </p>
                {/* Add any other relevant text or links here */}
                
                {/* Moved Metrics Grid */}
                <div className="mt-6">
                   <h3 className="text-xl font-bold mb-4">Q1 Rounds Highlights</h3>
                   <MetricsGrid metrics={metrics} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MOVED UP: Learnings and Iteration Section */}
        <div className="max-w-6xl mx-auto px-4 mt-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Brain className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Learning & Iterating: The Feedback Loop</h2>
            </div>
            <p className="text-lg text-zinc-600 mb-6">
              Q1 was defined by a tight feedback loop. We held regular meetings with both Jaidus and Vynessa to understand their experiences, pain points, and ideas.
              This direct input was crucial for identifying areas for improvement and prioritizing feature development.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-xl mb-4">Key Focus Areas:</h3>
                <ul className="list-disc list-inside space-y-2 text-zinc-600">
                  <li>Streamlining challenge setup for creators.</li>
                  <li>Enhancing participant progress visualization.</li>
                  <li>Improving notification relevance and timing.</li>
                  <li>Developing better analytics for creators.</li>
                  <li>Simplifying the payment and payout process (if applicable).</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-xl mb-4">Turning Insights into Action</h3>
                <p className="text-zinc-600">
                  The learnings from these initial Rounds directly informed our development roadmap. We made a conscious decision in Q1 to shift focus back towards building,
                  addressing the immediate needs identified by our pioneering creators. This iterative process ensures Rounds becomes more efficient, effective, and engaging with each update.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Creator Challenge Spotlights Section */}  
        <div className="max-w-6xl mx-auto px-4 mt-16">
          <div className="flex items-center gap-3 mb-6">
            <Target className="text-black" size={28} />
            <h2 className="text-2xl font-bold">In the Trenches: Creator Rounds</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Jaidus's 30-Day Ab Challenge */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="font-bold text-xl mb-4">Jaidus's 30-Day Ab Challenge</h3>
              {/* Replaced Image with Video */}
              <div className="rounded-lg w-full mb-4 overflow-hidden bg-zinc-100 relative aspect-[9/16]">
                <video 
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  src="/JaidusNewYear.mov" 
                  // poster="/path/to/jaidus-poster.jpg" // Optional poster
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <p className="text-zinc-600 mb-4">
                Our inaugural Round featured SoulCycle instructor Jaidus leading a dynamic 30-day ab challenge.
                This first run provided invaluable data on user engagement, challenge structure effectiveness, and creator tooling needs.
              </p>
              <h4 className="font-semibold mb-2">Key Results & Learnings:</h4>
              <ul className="list-disc list-inside space-y-1 text-zinc-600">
                <li>High initial engagement, tapering off mid-challenge.</li>
                <li>Feedback highlighted need for clearer progress tracking for participants.</li>
                <li>Identified creator workflow bottlenecks in content scheduling.</li>
                <li>Successful validation of the core challenge concept.</li>
              </ul>
            </div>

            {/* Vynessa's 30-Day Squat Challenge */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="font-bold text-xl mb-4">Vynessa's 30-Day Squat Challenge</h3>
              {/* Replaced Image with Video */}
               <div className="rounded-lg w-full mb-4 overflow-hidden bg-zinc-100 relative aspect-[9/16]"> 
                 <video 
                   className="w-full h-full object-cover" 
                   controls
                   playsInline
                   src="/VynessaBarbie.mov" 
                   // poster="/path/to/poster.jpg" // Optional poster
                 >
                   Your browser does not support the video tag.
                 </video>
               </div> 
              <p className="text-zinc-600 mb-4">
                Building on the first Round, Vynessa Smith, also from SoulCycle, launched a 30-day squat challenge, partly in collaboration with Jaidus.
                This allowed us to test variations in challenge promotion and co-creator dynamics.
              </p>
              <h4 className="font-semibold mb-2">Key Results & Learnings:</h4>
              <ul className="list-disc list-inside space-y-1 text-zinc-600">
                <li>Tested different notification strategies based on Jaidus's round feedback.</li>
                <li>Explored co-promotion effectiveness between creators.</li>
                <li>Reinforced the need for simplified participant onboarding.</li>
                <li>Gathered insights on optimal challenge length and intensity.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Behind the Scenes Section */}
        <div className="max-w-6xl mx-auto px-4 mt-16">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="text-black" size={28} /> {/* Reusing Brain icon or choose another */} 
            <h2 className="text-2xl font-bold">Behind the Scenes: Building the Foundation</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Web App Progress Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
              <h3 className="font-bold text-xl mb-3">Web Platform Launching Soon</h3>
              <div className="aspect-square bg-zinc-100 rounded-lg mb-4 relative overflow-hidden">
                 <Image 
                   src="/webPlatform.png" 
                   alt="Screenshot of the Pulse web platform interface" 
                   layout="fill" 
                   objectFit="cover" 
                 />
              </div>
              <p className="text-zinc-600 flex-grow">
                Pivotal foundational work on our web application was completed in Q1.
                This sets the stage for a full launch of the Pulse web platform early in Q2, expanding access and functionality.
              </p>
            </div>

            {/* AI Trainer Feature Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
              <h3 className="font-bold text-xl mb-3">AI-Powered Program Generation</h3>
              <div className="aspect-square bg-zinc-100 rounded-lg mb-4 relative overflow-hidden">
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
              <p className="text-zinc-600 flex-grow">
                We made significant strides on our unique AI tool for trainers. Unlike simple ChatGPT wrappers, ours leverages Pulse's rich, real-world user data and library of User Generated Moves.
                Trainers can use detailed prompts (client goals, info, workout style) to generate tailored programs in seconds, which they can then refine. 
                Here, AI is the means to powerful, data-driven customization, not the end product.
              </p>
            </div>

            {/* Storytelling / About Site Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
              <h3 className="font-bold text-xl mb-3">Enhanced Storytelling</h3>
              <div className="aspect-square bg-zinc-100 rounded-lg mb-4 relative overflow-hidden">
                 <Image 
                   src="/everythingStartsWithAMove.png" 
                   alt="Diagram illustrating the importance of Moves in Pulse ecosystem" 
                   layout="fill" 
                   objectFit="cover" 
                 />
              </div>
              <p className="text-zinc-600 flex-grow">
                Q1 included a renewed focus on storytelling. We launched a revamped About site to better articulate the core fundamentals and vision behind Pulse,
                clarifying our mission for users, creators, and partners.
              </p>
              {/* Optional: Add link to about page */}
            </div>

            {/* Starter Pack Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
              <h3 className="font-bold text-xl mb-3">Creator Onboarding: Starter Pack</h3>
              <img 
                src="/starter-pack-poster.png"
                alt="Starter Pack onboarding step screenshot" 
                className="w-full h-auto rounded-lg mb-4 bg-zinc-100 p-4"
              />
              <p className="text-zinc-600 flex-grow">
                To streamline creator onboarding, we built the 'Starter Pack' – a dedicated web component.
                This tool assists new trainers and creators migrating to Pulse, making their transition smoother and faster.
              </p>
            </div>

            {/* Push Notifications Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
              <h3 className="font-bold text-xl mb-3">Push Notifications</h3>
              <div className="aspect-square bg-zinc-100 rounded-lg mb-4 relative overflow-hidden">
                 <Image 
                   src="/push-notifications.png" 
                   alt="Example push notifications for Rounds engagement" 
                   layout="fill" 
                   objectFit="cover" 
                 />
              </div>
              <p className="text-zinc-600 flex-grow">
                Addressing key feedback from initial Rounds, we implemented enhanced push notifications.
                These alerts (chat activity, peer workout completions) foster an engagement loop and ecosystem beyond just logging workouts, 
                strengthening the community cohort within each Round.
              </p>
            </div>

            {/* NEW: Individual Analytics Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
              <h3 className="font-bold text-xl mb-3">Deep Dive: Individual Round Analytics</h3>
              <div className="aspect-square bg-zinc-100 rounded-lg mb-4 relative overflow-hidden">
                 <Image 
                   src="/round-analytics.jpg" 
                   alt="Screenshot of individual performance analytics within a Round" 
                   layout="fill" 
                   objectFit="cover" 
                 />
              </div>
              <p className="text-zinc-600 flex-grow">
                Understanding individual progress is key. We began developing deep analytics features to give participants detailed insights into their performance, consistency, and improvement throughout a Round.
                This empowers users to better track their journey and stay motivated.
              </p>
            </div>

          </div>
        </div>

        {/* Looking Ahead Section --> Renamed and Restructured */}
        <div className="max-w-6xl mx-auto px-4 mt-16 mb-12"> {/* Adjusted margin bottom */} 
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <RefreshCw className="text-black" size={28} />
              <h2 className="text-2xl font-bold">Q2 2025: Priorities & Initiatives</h2>
            </div>
            {/* Replaced paragraph with bullet points */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-zinc-600">
              <div>
                <h3 className="font-semibold text-black mb-2">Product & Feature Development:</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Launch 90-day Mobility Round (Testing duration & $1000 prize incentive).</li>
                  <li>Implement updated Point System with referral chaining.</li>
                  <li>Full launch of the Pulse Web Platform.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-black mb-2">Growth & Marketing Infrastructure:</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Build Marketing Funnel: Brevo automation, TikTok Ads/Pixel, AppFlyer & OneLink attribution/deep-linking, Mixpanel integration.</li>
                  <li>Recruit 5 new coaches/creators.</li>
                  <li>Develop Corporate Wellness program strategies.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* NEW: Asks Section */}
        <div className="max-w-6xl mx-auto px-4 mt-16 mb-24">
          <div className="bg-zinc-50 rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Users className="text-zinc-500" size={28} /> {/* Using Users icon */} 
              <h2 className="text-2xl font-bold text-zinc-800">How You Can Help / Asks</h2>
            </div>
            <p className="text-lg text-zinc-600 mb-6">
              Your support is invaluable as we continue to grow Pulse. Here are a few areas where connections or expertise would be greatly appreciated:
            </p>
            <ul className="list-disc list-inside space-y-3 text-zinc-600">
              <li>Introductions to passionate fitness coaches and content creators.</li>
              <li>Recommendations for talented video editors.</li>
              <li>Connections or insights regarding relevant accelerator programs.</li>
              <li>Introductions to potential corporate wellness program partners or advisors.</li>
            </ul>
            {/* Optional: Add contact info or link */}
          </div>
        </div>

      </div>
    </>
  );
};

export default Q1Review2025;
