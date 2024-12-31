import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Users, 
  UserPlus, 
  Smartphone, 
  Award, 
  Calendar,
  ArrowUpRight,
  Building2,
  Rocket,
  Code,
  ChevronRight,
  Star,
  Timer,
  Target,
  ArrowLeft
} from 'lucide-react';

const yearEndStats = [
  {
    label: "Beta Testers",
    value: "150+",
    icon: Users,
    color: "#E0FE10"
  },
  {
    label: "Team Growth",
    value: "3 New Hires",
    icon: UserPlus,
    color: "#FF6B6B"
  },
  {
    label: "App Updates",
    value: "12",
    icon: Smartphone,
    color: "#4ECDC4"
  },
  {
    label: "Programs Completed",
    value: "2",
    icon: Award,
    color: "#FFD93D"
  }
];

const milestones = [
  {
    month: "January",
    title: "Beta Launch",
    description: "Launched our beta version in the App Store with limited features, beginning our journey with early adopters.",
    icon: Rocket,
    color: "#E0FE10"
  },
  {
    month: "April",
    title: "Beta Completion",
    description: "Successfully completed three rounds of beta testing, implementing valuable user feedback.",
    icon: Users,
    color: "#FF6B6B"
  },
  {
    month: "May",
    title: "Public Launch",
    description: "Officially launched Pulse 1.0 to the public, marking our first major release.",
    icon: Smartphone,
    color: "#4ECDC4"
  },
  {
    month: "July",
    title: "Operation Hope",
    description: "Graduated from Operation Hope program in Atlanta, expanding our business knowledge.",
    icon: Building2,
    color: "#FFD93D"
  },
  {
    month: "September",
    title: "Web Development",
    description: "Kicked off web app development and complete website redesign.",
    icon: Code,
    color: "#E0FE10"
  },
  {
    month: "December",
    title: "Rounds Launch",
    description: "Launched Rounds feature with successful kickoff event at SoulCycle Buckhead.",
    icon: Users,
    color: "#FF6B6B"
  }
];

const quarters = [
  {
    quarter: "Q1",
    title: "Foundation Building",
    description: "Launched beta testing program and gathered initial user feedback",
    achievements: [
      "Launched in App Store",
      "Started beta testing program",
      "Gathered user feedback",
      "Implemented core features"
    ],
    stats: {
      betaTesters: "50+",
      updates: "4",
      feedback: "100+"
    }
  },
  {
    quarter: "Q2",
    title: "Public Release",
    description: "Successfully launched Pulse 1.0 and applied to accelerator programs",
    achievements: [
      "Released version 1.0",
      "Applied to TechStars",
      "Improved storytelling",
      "Enhanced user experience"
    ],
    stats: {
      users: "100+",
      updates: "3",
      engagement: "75%"
    }
  },
  {
    quarter: "Q3",
    title: "Team Expansion",
    description: "Grew our team and began web development initiatives",
    achievements: [
      "Hired web developer",
      "Started web app development",
      "Redesigned website",
      "Expanded team capabilities"
    ],
    stats: {
      newHires: "2",
      projects: "3",
      milestones: "4"
    }
  },
  {
    quarter: "Q4",
    title: "Feature Innovation",
    description: "Launched Rounds and expanded our presence in the fitness community",
    achievements: [
      "Launched Rounds feature",
      "Hosted first live event",
      "Created press kit",
      "Built community partnerships"
    ],
    stats: {
      events: "2",
      features: "5",
      partners: "3"
    }
  }
];

const YearInReview = () => {
  const [activeQuarter, setActiveQuarter] = useState(0);

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Navigation */}
      <div className="bg-zinc-900 text-white py-4">
        <div className="max-w-7xl mx-auto px-4">
          <Link href="/review" className="flex items-center text-sm gap-2 text-[#E0FE10] hover:underline">
            <ArrowLeft size={20} />
            View All Reviews
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
        <div className="relative max-w-7xl mx-auto py-32 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-7xl font-bold font-['Thunder'] text-white mb-6">
              2024: A Year of
              <span className="text-[#E0FE10]"> Building</span> and
              <span className="text-[#E0FE10]"> Growing</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-3xl mx-auto">
              From beta testing to our Rounds launch, 2024 was a transformative year 
              for Pulse. Here's our journey of building, learning, and growing together.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Year End Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {yearEndStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-zinc-800 rounded-xl p-6 border border-zinc-700"
            >
              <div className="flex items-center gap-4">
                <div 
                  className="p-3 rounded-lg" 
                  style={{ backgroundColor: stat.color + '20' }}
                >
                  <stat.icon 
                    size={24} 
                    style={{ color: stat.color }} 
                  />
                </div>
                <div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-zinc-400">
                    {stat.label}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Timeline Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h2 className="text-3xl sm:text-5xl font-bold font-['Thunder'] text-white mb-4">
            Our Journey Through <span className="text-[#E0FE10]">2024</span>
          </h2>
          <p className="text-zinc-400">
            A timeline of key moments that shaped our year
          </p>
        </motion.div>

        <div className="space-y-12">
          {milestones.map((milestone, index) => (
            <motion.div
              key={milestone.month}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <div className="flex items-center gap-8">
                <div 
                  className="w-24 h-24 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: milestone.color + '20' }}
                >
                  <milestone.icon 
                    size={32} 
                    style={{ color: milestone.color }} 
                  />
                </div>
                <div>
                  <div className="text-zinc-500 mb-1">
                    {milestone.month}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {milestone.title}
                  </h3>
                  <p className="text-zinc-400">
                    {milestone.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quarterly Breakdown */}
      <div className="bg-black py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <h2 className="text-3xl sm:text-5xl font-bold font-['Thunder'] text-white mb-4">
              Quarterly <span className="text-[#E0FE10]">Breakdown</span>
            </h2>
            <p className="text-zinc-400">
              A detailed look at our progress throughout the year
            </p>
          </motion.div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            {quarters.map((q, index) => (
              <button
                key={q.quarter}
                onClick={() => setActiveQuarter(index)}
                className={`p-4 rounded-lg transition-all ${
                  activeQuarter === index 
                    ? 'bg-[#E0FE10] text-black' 
                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                }`}
              >
                {q.quarter}
              </button>
            ))}
          </div>

          <motion.div
            key={activeQuarter}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-zinc-800 rounded-xl p-8"
          >
            <h3 className="text-2xl font-bold text-white mb-4">
              {quarters[activeQuarter].title}
            </h3>
            <p className="text-zinc-400 mb-8">
              {quarters[activeQuarter].description}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-[#E0FE10] font-bold mb-4">Key Achievements</h4>
                <ul className="space-y-3">
                  {quarters[activeQuarter].achievements.map((achievement, index) => (
                    <li key={index} className="flex items-center gap-2 text-zinc-300">
                      <ChevronRight className="text-[#E0FE10]" size={16} />
                      {achievement}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[#E0FE10] font-bold mb-4">Quarter Stats</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(quarters[activeQuarter].stats).map(([key, value]) => (
                    <div key={key} className="bg-zinc-700 rounded-lg p-4">
                      <div className="text-2xl font-bold text-white">{value}</div>
                      <div className="text-zinc-400 capitalize">{key}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Looking Ahead Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h2 className="text-3xl sm:text-5xl font-bold font-['Thunder'] text-white mb-4">
            Looking Ahead to <span className="text-[#E0FE10]">2025</span>
          </h2>
          <p className="text-zinc-400">
            Our vision for the upcoming year
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-zinc-800 rounded-xl p-6 border border-zinc-700"
          >
            <div className="p-3 rounded-lg inline-flex bg-[#E0FE10] bg-opacity-20 mb-4">
              <Target size={24} className="text-[#E0FE10]" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Expanding Rounds</h3>
            <p className="text-zinc-400">
              Growing our community-driven workouts with new features and partnerships
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-zinc-800 rounded-xl p-6 border border-zinc-700"
          >
            <div className="p-3 rounded-lg inline-flex bg-[#FF6B6B] bg-opacity-20 mb-4">
              <Users size={24} className="text-[#FF6B6B]" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Creator Network</h3>
            <p className="text-zinc-400">
              Building relationships with fitness creators and expanding our content offerings
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-zinc-800 rounded-xl p-6 border border-zinc-700"
          >
            <div className="p-3 rounded-lg inline-flex bg-[#4ECDC4] bg-opacity-20 mb-4">
              <Rocket size={24} className="text-[#4ECDC4]" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Platform Growth</h3>
            <p className="text-zinc-400">
              Launching new features and expanding our presence in the fitness tech space
            </p>
          </motion.div>
        </div>

        <div className="mt-12 text-center">
          <motion.a
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            href="https://apps.apple.com/app/pulse"
            className="inline-flex items-center gap-2 bg-[#E0FE10] text-black px-8 py-4 rounded-full font-medium hover:bg-opacity-90 transition-all"
          >
            Download Pulse
            <ArrowUpRight size={20} />
          </motion.a>
        </div>
      </div>
    </div>
  );
};

export default YearInReview;

