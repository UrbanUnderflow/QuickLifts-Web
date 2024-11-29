import React from 'react';
import Image from 'next/image';
import { ArrowUpRight, Trophy, Users, Star, Calendar, ArrowUp, ArrowDown } from 'lucide-react';

const MonthInReview = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-sm font-medium text-[#E0FE10]">Month in Review</div>
          <h1 className="mt-2 text-5xl sm:text-7xl font-bold font-['Thunder']">
            November 2024
          </h1>
          <p className="mt-4 text-zinc-400 max-w-2xl text-lg">
          November marks a pivotal shift in our journey, moving beyond the building phase to 
          deeply engage with our community and future partners. While our technology foundations 
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
        <h2 className="text-2xl font-bold">Major Achievements</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
            {
                title: "IBM Sports Innovation",
                description: <>Selected for <a href="https://developer.ibm.com/startups/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">IBM Startups</a> in collaboration with <a href="https://www.hypesportsinnovation.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Hype Sports Innovation</a> program, joining an elite group of sports tech innovators.</>
            },
            {
                title: "AcceleratorCon Finalist",
                description: <>Selected to present at the Draft Experience, where we shared our vision with investors from <a href="https://300.global/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">300 Global</a> and <a href="https://www.plugandplaytechcenter.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Plug & Play</a> in New York.</>
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

      {/* Key Metrics Grid */}
      <div className="max-w-6xl mx-auto px-4 -mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Users", value: "2,847", change: 12.4 },
            { label: "Avg. Daily Workouts", value: "156", change: 8.7 },
            { label: "Revenue", value: "$12.4K", change: 15.2 },
            { label: "User Retention", value: "84%", change: -2.1 }
          ].map((metric, index) => (
            <div key={index} className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">{metric.label}</span>
                <span className={`flex items-center ${metric.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metric.change >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                  {Math.abs(metric.change)}%
                </span>
              </div>
              <div className="mt-2 text-3xl font-bold">{metric.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Community Spotlight */}
      <div className="max-w-6xl mx-auto px-4 mt-16">
        <div className="flex items-center gap-3 mb-6">
          <Users className="text-black" size={28} />
          <h2 className="text-2xl font-bold">Building in Atlanta</h2>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="prose max-w-none">
            <p className="text-lg text-zinc-600 mb-6">
              This month marked our deeper integration into Atlanta's vibrant tech ecosystem. 
              Our pitch at Atlanta Tech Village showcased not just our product, but the incredible 
              support and energy of the local tech community.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              <div>
                <h3 className="text-xl font-bold mb-4">Community Engagement</h3>
                <ul className="space-y-3 text-zinc-600">
                  <li>• Pitched at Atlanta Tech Village</li>
                  <li>• Applied for TechStars accelerator program</li>
                  <li>• Submitted application for Global 300</li>
                  <li>• Participating in It Takes A Village initiative</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-4">Why Atlanta?</h3>
                <p className="text-zinc-600">
                  The supportive ecosystem, diverse talent pool, and collaborative spirit make 
                  Atlanta the perfect home for building the future of fitness communities.
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

      {/* Upcoming Events */}
      <div className="max-w-6xl mx-auto px-4 mt-16 mb-24">
        <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Join Us at Upcoming Events</h2>
            <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-shrink-0 w-24 text-center">
                <div className="text-2xl font-bold">Dec 6</div>
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
  );
};

export default MonthInReview;