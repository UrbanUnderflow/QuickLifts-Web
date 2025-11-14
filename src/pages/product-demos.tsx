import React, { useState } from 'react';
import Head from 'next/head';
import { Play, Camera, Target, Users, Zap, Smartphone, Video, TrendingUp, Award, Lock } from 'lucide-react';

const ProductDemos: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Demos', icon: <Play className="w-4 h-4" /> },
    { id: 'getting-started', label: 'Getting Started', icon: <Zap className="w-4 h-4" /> },
    { id: 'creator', label: 'For Creators', icon: <Camera className="w-4 h-4" /> },
    { id: 'user', label: 'For Users', icon: <Users className="w-4 h-4" /> },
    { id: 'features', label: 'Features', icon: <Smartphone className="w-4 h-4" /> },
  ];

  const demos = [
    {
      id: 'product-walkthrough',
      title: 'Pulse Product Walkthrough',
      description: 'A comprehensive overview of the Pulse platform and all its features',
      category: 'getting-started',
      videoUrl: 'https://www.youtube.com/embed/hYzwB92MGy4',
      duration: '5:30',
      featured: true,
      tags: ['Overview', 'Introduction', 'Platform Tour'],
    },
    {
      id: 'upload-move',
      title: 'How to Upload a Move',
      description: 'Learn how to add exercises to your Pulse library in minutes',
      category: 'creator',
      videoUrl: 'https://www.youtube.com/embed/FDqvrReKjyo',
      duration: '2:15',
      featured: true,
      tags: ['Moves', 'Upload', 'Creator Tools'],
    },
    {
      id: 'create-round',
      title: 'How to Create a Round',
      description: 'Build your first AI-powered workout round step-by-step',
      category: 'creator',
      videoUrl: 'https://www.youtube.com/embed/MZ_CSr0Cyzs',
      duration: '3:45',
      featured: true,
      tags: ['Rounds', 'AI', 'Programming'],
    },
    {
      id: 'join-challenge',
      title: 'Joining a Round Challenge',
      description: 'Discover how to join and participate in community fitness challenges',
      category: 'user',
      videoUrl: 'https://www.youtube.com/embed/placeholder1',
      duration: '2:00',
      featured: false,
      tags: ['Challenges', 'Community', 'Participation'],
      comingSoon: true,
    },
    {
      id: 'track-progress',
      title: 'Tracking Your Fitness Progress',
      description: 'Learn how to monitor your workouts, stats, and achievements',
      category: 'user',
      videoUrl: 'https://www.youtube.com/embed/placeholder2',
      duration: '3:00',
      featured: false,
      tags: ['Analytics', 'Progress', 'Health Data'],
      comingSoon: true,
    },
    {
      id: 'social-features',
      title: 'Social & Community Features',
      description: 'Connect with friends, share workouts, and build your fitness community',
      category: 'features',
      videoUrl: 'https://www.youtube.com/embed/placeholder3',
      duration: '4:00',
      featured: false,
      tags: ['Social', 'Community', 'Engagement'],
      comingSoon: true,
    },
    {
      id: 'ai-programming',
      title: 'AI-Powered Programming',
      description: 'See how Neura creates personalized workout plans just for you',
      category: 'features',
      videoUrl: 'https://www.youtube.com/embed/placeholder4',
      duration: '3:30',
      featured: false,
      tags: ['AI', 'Neura', 'Personalization'],
      comingSoon: true,
    },
    {
      id: 'monetization',
      title: 'Monetizing Your Content',
      description: 'Learn how to earn money as a fitness creator on Pulse',
      category: 'creator',
      videoUrl: 'https://www.youtube.com/embed/placeholder5',
      duration: '5:00',
      featured: false,
      tags: ['Earnings', 'Creator Economy', 'Revenue'],
      comingSoon: true,
    },
  ];

  const filteredDemos = activeCategory === 'all' 
    ? demos 
    : demos.filter(demo => demo.category === activeCategory);

  const featuredDemos = demos.filter(demo => demo.featured && !demo.comingSoon);

  return (
    <>
      <Head>
        <title>Product Demos | Pulse - See It In Action</title>
        <meta name="description" content="Watch comprehensive product demos and tutorials to master the Pulse fitness platform. Learn how to create, share, and participate in fitness challenges." />
      </Head>

      <div className="min-h-screen bg-[#0a0a0a] text-white">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-b from-zinc-900 via-[#0a0a0a] to-[#0a0a0a] border-b border-zinc-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#E0FE10]/5 via-transparent to-transparent" />
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-full px-4 py-2 mb-6">
                <Video className="w-4 h-4 text-[#E0FE10]" />
                <span className="text-[#E0FE10] text-sm font-medium">Product Tutorials & Demos</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white to-zinc-400 bg-clip-text text-transparent">
                See Pulse In Action
              </h1>
              
              <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
                Watch step-by-step tutorials and product demos to master every feature of the Pulse platform
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="#featured"
                  className="inline-flex items-center gap-2 bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#d0ee00] transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20"
                >
                  <Play className="w-5 h-5" />
                  Watch Featured Demos
                </a>
                <a
                  href="#all-demos"
                  className="inline-flex items-center gap-2 bg-zinc-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-zinc-700 transition-all duration-300 border border-zinc-700"
                >
                  Browse All Tutorials
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          
          {/* Featured Demos Section */}
          <section id="featured" className="mb-20">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-full px-4 py-2 mb-4">
                <Award className="w-4 h-4 text-[#E0FE10]" />
                <span className="text-[#E0FE10] text-sm font-medium">Most Popular</span>
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">Featured Demos</h2>
              <p className="text-zinc-400 text-lg">Start here to get up and running quickly</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              {featuredDemos.map((demo, index) => (
                <div
                  key={demo.id}
                  className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-6 hover:border-[#E0FE10]/50 transition-all duration-300 group"
                >
                  {/* Video Container */}
                  <div className="relative rounded-xl overflow-hidden border border-zinc-600 bg-black mb-4 group-hover:border-[#E0FE10]/50 transition-colors">
                    <iframe
                      className="w-full aspect-video"
                      src={demo.videoUrl}
                      title={demo.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>

                  {/* Demo Info */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="text-xl font-bold text-white group-hover:text-[#E0FE10] transition-colors">
                      {demo.title}
                    </h3>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md flex-shrink-0">
                      {demo.duration}
                    </span>
                  </div>

                  <p className="text-zinc-400 mb-4">{demo.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {demo.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-xs bg-[#E0FE10]/10 text-[#E0FE10] px-2 py-1 rounded-md border border-[#E0FE10]/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* All Demos Section */}
          <section id="all-demos" className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">All Product Demos</h2>
              <p className="text-zinc-400 text-lg">Explore tutorials by category</p>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    activeCategory === category.id
                      ? 'bg-[#E0FE10] text-black shadow-lg shadow-[#E0FE10]/20'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700'
                  }`}
                >
                  {category.icon}
                  {category.label}
                </button>
              ))}
            </div>

            {/* Demos Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDemos.map(demo => (
                <div
                  key={demo.id}
                  className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-[#E0FE10]/50 transition-all duration-300 group ${
                    demo.comingSoon ? 'opacity-60' : ''
                  }`}
                >
                  {/* Video Thumbnail */}
                  <div className="relative aspect-video bg-zinc-800 border-b border-zinc-700">
                    {demo.comingSoon ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                        <Lock className="w-12 h-12 text-zinc-600 mb-3" />
                        <p className="text-zinc-500 font-semibold">Coming Soon</p>
                        <p className="text-zinc-600 text-sm mt-1">New demo video in production</p>
                      </div>
                    ) : (
                      <iframe
                        className="w-full h-full"
                        src={demo.videoUrl}
                        title={demo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    )}
                    
                    {!demo.featured && !demo.comingSoon && (
                      <div className="absolute top-3 right-3">
                        <span className="text-xs bg-black/80 text-white px-2 py-1 rounded-md">
                          {demo.duration}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Demo Info */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#E0FE10] transition-colors">
                      {demo.title}
                    </h3>
                    <p className="text-zinc-400 text-sm mb-4">{demo.description}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {demo.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredDemos.length === 0 && (
              <div className="text-center py-12">
                <Video className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-500 text-lg">No demos found in this category</p>
              </div>
            )}
          </section>

          {/* CTA Section */}
          <section className="mb-20">
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8 md:p-12 text-center">
              <div className="max-w-3xl mx-auto">
                <Zap className="w-16 h-16 text-[#E0FE10] mx-auto mb-6" />
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to Get Started?
                </h2>
                <p className="text-zinc-400 text-lg mb-8">
                  Download the Pulse app today and start building your fitness community
                </p>
                
                <div className="flex flex-wrap justify-center gap-4">
                  <a
                    href="https://apps.apple.com/app/pulse/id6502470369"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#d0ee00] transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20"
                  >
                    <Smartphone className="w-5 h-5" />
                    Download for iOS
                  </a>
                  <a
                    href="/build-your-round"
                    className="inline-flex items-center gap-2 bg-zinc-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-zinc-700 transition-all duration-300 border border-zinc-700"
                  >
                    <Target className="w-5 h-5" />
                    Build Your First Round
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Help Section */}
          <section>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
              <div className="text-center max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-white mb-4">Need More Help?</h3>
                <p className="text-zinc-400 mb-6">
                  Can't find what you're looking for? Our support team is here to help you succeed.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <a
                    href="/GetInTouch"
                    className="inline-flex items-center gap-2 bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#d0ee00] transition-all duration-300"
                  >
                    Contact Support
                  </a>
                  <a
                    href="/creator"
                    className="inline-flex items-center gap-2 bg-zinc-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-zinc-700 transition-all duration-300 border border-zinc-700"
                  >
                    Creator Resources
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default ProductDemos;

