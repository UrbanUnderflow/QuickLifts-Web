import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowUpRight, Download, Search } from 'lucide-react';
import { useScrollFade } from '../../hooks/useScrollFade';
import Header from '../../components/Header';
import Footer from '../../components/Footer/Footer';

const PressKit = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const sections = [
    {
      title: "Our Story",
      content: "At Pulse, we've created a vibrant community where fitness enthusiasts connect, share, and grow together. Born from the belief that fitness is better when shared, we've built a platform that combines the power of social connection with personalized fitness tracking.",
      bgColor: "bg-[#192126]",
      textColor: "text-white",
      buttonClass: "border-white text-white",
      imageGrid: true
    },
    {
      title: "Our Mission",
      content: "To democratize fitness by creating an inclusive platform where everyone can find inspiration, share their journey, and achieve their fitness goals. We believe in making fitness accessible, engaging, and community-driven.",
      bgColor: "bg-white",
      textColor: "text-neutral-600",
      buttonClass: "border-black text-black",
      imageGrid: true
    },
    {
      title: "Our Vision",
      content: "To build a world where fitness is not just about personal achievement, but about collective growth and support. We envision a future where every workout shared inspires someone else to start their fitness journey.",
      bgColor: "bg-[#192126]",
      textColor: "text-white",
      buttonClass: "border-white text-white",
      imageGrid: true
    },
    {
      title: "Our Values",
      content: "Community First: We believe in the power of shared experiences and mutual support. Innovation: Constantly evolving to provide the best fitness experience. Inclusivity: Creating a space where everyone feels welcome and supported.",
      bgColor: "bg-white",
      textColor: "text-neutral-600",
      buttonClass: "border-black text-black",
      imageGrid: true
    }
  ];

  const mediaAssets = [
    { title: "Logos", description: "Official Pulse brand logos in various formats" },
    { title: "Brand Materials", description: "Brand guidelines, color palettes, and typography" },
    { title: "Product Screenshots", description: "High-resolution app interface images" },
    { title: "Deck", description: "Presentation materials and company overview" },
    { title: "The Team", description: "Team photos and leadership profiles" },
    { title: "Press Releases", description: "Latest news and announcements" }
  ];

  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>Press Kit - Pulse Fitness Collective</title>
        <meta name="description" content="Pulse press resources, media materials, and downloadable assets for journalists and creators." />
      </Head>

      {/* Hero Section */}
      <section ref={useScrollFade()} className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden animate-gradient-background">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-zinc-900"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 opacity-40"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-1000"></div>
        </div>
        
        {/* Animated grid pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[url('/grid-pattern.svg')] bg-repeat"></div>
        </div>

        {/* Content */}
        <div className="relative z-20 max-w-4xl mx-auto">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer animate-fade-in-up animation-delay-300">
            Media Resources
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
          </h2>
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8 animate-fade-in-up animation-delay-600">
            Pulse Press Kit
          </h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 animate-fade-in-up animation-delay-900">
            Everything you need to tell the Pulse story - from founder bios to product screenshots
          </p>
        </div>
      </section>

      {/* Overview Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                00_Overview
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">The 30-second pitch</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-4">Elevator Pitch</h4>
                <p className="text-zinc-400 text-lg mb-6">
                  Pulse is a fitness collective platform where enthusiasts create, share, and grow together through community-driven workouts and challenges, transforming solo fitness into shared experiences.
                </p>
                
                <h4 className="text-white text-xl font-semibold mb-4 mt-8">Why Now? Narrative</h4>
                <p className="text-zinc-400 text-lg mb-4">
                  The fitness industry has long focused on solo experiences and expert-driven content, leaving a gap for genuine community participation and content creation by everyday fitness enthusiasts.
                </p>
                <p className="text-zinc-400 text-lg">
                  With over 1,000 creators joining our founding class within 45 days of launch, Pulse is proving that fitness-minded individuals are hungry for a platform where they can not only consume but actively contribute to the collective fitness experience.
                </p>
                
                <a href="#" className="mt-8 inline-flex items-center text-[#E0FE10] hover:text-white">
                  <Download className="mr-2 h-5 w-5" />
                  Download full Overview PDF
                </a>
              </div>
            </div>
            
            <div className="lg:w-1/2">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-6">Quick Stats</h4>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">FOUNDED</p>
                    <p className="text-white text-xl">2023</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">HEADQUARTERS</p>
                    <p className="text-white text-xl">Atlanta, GA</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">USERS</p>
                    <p className="text-white text-xl">10,000+</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">CREATORS</p>
                    <p className="text-white text-xl">1,000+</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">WORKOUTS SHARED</p>
                    <p className="text-white text-xl">15,000+</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">FUNDING</p>
                    <p className="text-white text-xl">Seed Stage</p>
                  </div>
                </div>
                
                <div className="mt-8 p-4 bg-black/30 border border-zinc-800 rounded-lg">
                  <h5 className="text-[#E0FE10] text-sm font-semibold mb-2">MEDIA NOTE</h5>
                  <p className="text-zinc-400 text-sm">For the most current stats and metrics, please contact our press team directly at press@pulse.ai</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Bio Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/2 order-2 lg:order-1">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Founder Bio & Photos
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">Tremaine Grant</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-4">Short Bio (150 words)</h4>
                <p className="text-zinc-400 text-lg mb-6">
                  Tremaine Grant is the founder and CEO of Pulse, the fitness collective redefining how people experience, share, and build community around fitness. With a background in software engineering and a lifelong passion for fitness, Tremaine identified a crucial gap in the market: the lack of platforms where everyday fitness enthusiasts could create and share content as easily as fitness professionals. Before founding Pulse, Tremaine worked as a senior developer at prominent tech companies, where he honed his skills in creating intuitive, user-centric digital experiences. A former collegiate athlete, Tremaine brings a unique perspective that bridges the technological and fitness worlds. He's building Pulse to be more than an app—it's a movement to democratize fitness content creation and build genuine community through shared physical activity.
                </p>
                
                <h4 className="text-white text-xl font-semibold mb-4 mt-8">Long Bio (600 words)</h4>
                <p className="text-zinc-400 text-lg mb-4">
                  Tremaine Grant is the visionary founder and CEO of Pulse, a groundbreaking fitness collective platform that's redefining the intersection of technology, community, and physical wellbeing. His journey to creating Pulse represents a perfect synthesis of his technical expertise, entrepreneurial spirit, and lifelong commitment to fitness.
                </p>
                <p className="text-zinc-400 text-lg mb-4">
                  Born and raised in Atlanta, Tremaine discovered his dual passions for technology and athletics early in life. As a scholarship track athlete in college, he experienced firsthand the transformative power of structured fitness and community support. Simultaneously, he pursued computer science, fascinated by technology's potential to connect people and solve real-world problems.
                </p>
                <p className="text-zinc-400 text-lg mb-4">
                  After graduating, Tremaine built a successful career as a software engineer at several leading tech companies, working on projects that reached millions of users. Throughout his corporate journey, he remained deeply connected to fitness communities, participating in and eventually leading workout groups in his spare time.
                </p>
                <p className="text-zinc-400 text-lg">
                  The idea for Pulse emerged from a simple observation: while social media had transformed nearly every aspect of daily life, fitness platforms remained surprisingly one-dimensional, primarily focusing on content consumption rather than creation and community engagement. Tremaine envisioned a platform where anyone—not just professional trainers—could easily create, share, and build community around fitness content.
                </p>
                
                <div className="mt-8 p-4 bg-black/30 border border-zinc-800 rounded-lg">
                  <h5 className="text-[#E0FE10] text-sm font-semibold mb-2">INTERESTING FACTS</h5>
                  <ul className="text-zinc-400 text-sm list-disc ml-4 space-y-2">
                    <li>Former collegiate track athlete (400m specialist)</li>
                    <li>Self-taught programmer who built his first app at 16</li>
                    <li>Passionate advocate for diversity in tech and fitness spaces</li>
                    <li>Has completed 7 marathons across 5 countries</li>
                  </ul>
                </div>
                
                <a href="#" className="mt-8 inline-flex items-center text-[#E0FE10] hover:text-white">
                  <Download className="mr-2 h-5 w-5" />
                  Download full bio and photos
                </a>
              </div>
            </div>
            
            <div className="lg:w-1/2 order-1 lg:order-2">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 aspect-[4/3] bg-zinc-800 rounded-xl overflow-hidden relative group">
                  <img 
                    src="/founder-landscape.jpg" 
                    alt="Tremaine Grant - Landscape" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4">
                      <p className="text-white font-medium">Tremaine Grant</p>
                      <p className="text-zinc-300 text-sm">Landscape - High Res</p>
                    </div>
                  </div>
                </div>
                <div className="aspect-[3/4] bg-zinc-800 rounded-xl overflow-hidden relative group">
                  <img 
                    src="/founder-portrait-1.jpg" 
                    alt="Tremaine Grant - Portrait 1" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4">
                      <p className="text-white font-medium">Portrait 1</p>
                      <p className="text-zinc-300 text-sm">Studio Setting</p>
                    </div>
                  </div>
                </div>
                <div className="aspect-[3/4] bg-zinc-800 rounded-xl overflow-hidden relative group">
                  <img 
                    src="/founder-portrait-2.jpg" 
                    alt="Tremaine Grant - Portrait 2" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4">
                      <p className="text-white font-medium">Portrait 2</p>
                      <p className="text-zinc-300 text-sm">Casual Setting</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product One-Pager Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Product One-Pager
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">How Pulse Works</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-4">Problem → Solution</h4>
                <div className="mb-6">
                  <p className="text-[#E0FE10] mb-2 font-medium">THE PROBLEM:</p>
                  <p className="text-zinc-400 text-lg">
                    Fitness has become increasingly isolated and consumption-driven. Existing platforms treat users as passive consumers rather than active creators. People struggle to maintain motivation without community support.
                  </p>
                </div>
                
                <div className="mb-6">
                  <p className="text-[#E0FE10] mb-2 font-medium">THE SOLUTION:</p>
                  <p className="text-zinc-400 text-lg">
                    Pulse transforms fitness into a social experience by enabling anyone to create, share, and participate in community-driven workouts. Our three-tiered system (Moves → Stacks → Rounds) provides the building blocks for a truly collaborative fitness ecosystem.
                  </p>
                </div>
                
                <div className="mb-6">
                  <h5 className="text-white text-lg font-medium mb-3">User Testimonials</h5>
                  <div className="space-y-4">
                    <div className="p-4 bg-black/30 rounded-lg">
                      <p className="text-zinc-300 italic">"I've tried dozens of fitness apps, but Pulse is the first one where I feel like I'm part of something bigger than just my own workouts. The community challenges keep me motivated in a way nothing else has."</p>
                      <p className="text-[#E0FE10] mt-2 text-sm">Sarah, Los Angeles</p>
                    </div>
                    <div className="p-4 bg-black/30 rounded-lg">
                      <p className="text-zinc-300 italic">"As a personal trainer, Pulse has revolutionized how I connect with clients. I can create custom workouts, track their progress, and build a community around my training philosophy."</p>
                      <p className="text-[#E0FE10] mt-2 text-sm">Marcus, Chicago</p>
                    </div>
                  </div>
                </div>
                
                <a href="#" className="mt-8 inline-flex items-center text-[#E0FE10] hover:text-white">
                  <Download className="mr-2 h-5 w-5" />
                  Download full product overview
                </a>
              </div>
            </div>
            
            <div className="lg:w-1/2">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-6">The Pulse Ecosystem</h4>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-black/30 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-black">1</span>
                    </div>
                    <div>
                      <h5 className="text-white font-semibold text-lg mb-1">Moves</h5>
                      <p className="text-zinc-400">5-30 second video clips of exercises that form the building blocks of your fitness journey. Create or follow moves from the community.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-black/30 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/70 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-black">2</span>
                    </div>
                    <div>
                      <h5 className="text-white font-semibold text-lg mb-1">Stacks</h5>
                      <p className="text-zinc-400">Combine multiple Moves to create complete workout routines. Personalize with sets, reps, and timing to match your fitness level.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-black/30 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/40 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-black">3</span>
                    </div>
                    <div>
                      <h5 className="text-white font-semibold text-lg mb-1">Rounds</h5>
                      <p className="text-zinc-400">Community fitness challenges where members complete Stacks together, compete for points, and support each other's progress.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 grid grid-cols-3 gap-6">
                  <div className="aspect-[9/19.5] bg-zinc-800 rounded-lg overflow-hidden">
                    <img 
                      src="/app-screens/moves-screen.jpg" 
                      alt="Moves Screen" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="aspect-[9/19.5] bg-zinc-800 rounded-lg overflow-hidden">
                    <img 
                      src="/app-screens/stacks-screen.jpg" 
                      alt="Stacks Screen" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="aspect-[9/19.5] bg-zinc-800 rounded-lg overflow-hidden">
                    <img 
                      src="/app-screens/rounds-screen.jpg" 
                      alt="Rounds Screen" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Media Assets Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row justify-between items-start mb-12">
            <div>
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Media Assets
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-2">Visual Resources</h3>
              <p className="text-zinc-400 max-w-2xl">
                Download official Pulse brand assets, app screenshots, and media materials. All assets are available in high resolution formats suitable for both print and digital media.
              </p>
            </div>
            <div className="mt-4 lg:mt-0 w-full lg:w-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search media assets"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full lg:w-80 px-4 py-3 pr-10 bg-zinc-900/80 border border-zinc-800 focus:border-[#E0FE10] rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#E0FE10]"
                />
                <Search className="w-5 h-5 text-zinc-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src="/media-assets/logos-thumbnail.jpg" 
                  alt="Pulse Logos" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">Logos</p>
                    <p className="text-zinc-300 text-sm">SVG, PNG, Dark/Light</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">Logos</h3>
              <p className="text-zinc-400 mb-4">Official Pulse brand logos in various formats and color schemes</p>
              <Link href="/press/logos">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            </div>
            
            <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src="/media-assets/app-screens-thumbnail.jpg" 
                  alt="App Screenshots" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">App Screenshots</p>
                    <p className="text-zinc-300 text-sm">High-resolution, all features</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">App Screenshots</h3>
              <p className="text-zinc-400 mb-4">High-resolution images of all key app screens and features</p>
              <Link href="/press/app-screenshots">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            </div>
            
            <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src="/media-assets/app-gifs-thumbnail.jpg" 
                  alt="App GIFs" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">App GIFs</p>
                    <p className="text-zinc-300 text-sm">5-sec feature loops</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">App GIFs</h3>
              <p className="text-zinc-400 mb-4">Short animated GIFs showing key app features in action</p>
              <a href="#" className="flex items-center text-[#E0FE10] hover:text-white group">
                View all
                <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
              </a>
            </div>
            
            <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src="/media-assets/b-roll-thumbnail.jpg" 
                  alt="B-Roll Video" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">B-Roll Video</p>
                    <p className="text-zinc-300 text-sm">App demonstrations and usage</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">B-Roll Video</h3>
              <p className="text-zinc-400 mb-4">Professional footage of Pulse in use, ideal for broadcast</p>
              <Link href="/press/videos">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            </div>
            
            <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src="/media-assets/branding-thumbnail.jpg" 
                  alt="Brand Guidelines" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">Brand Guidelines</p>
                    <p className="text-zinc-300 text-sm">Colors, typography, usage</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">Brand Guidelines</h3>
              <p className="text-zinc-400 mb-4">Comprehensive guide to Pulse's visual identity and brand usage</p>
              <Link href="/press/brand-guidelines">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            </div>
            
            <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src="/media-assets/press-releases-thumbnail.jpg" 
                  alt="Press Releases" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">Press Releases</p>
                    <p className="text-zinc-300 text-sm">Latest news and announcements</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">Press Releases</h3>
              <p className="text-zinc-400 mb-4">Latest announcements including Morning Mobility Challenge launch</p>
              <Link href="/press/press-releases">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Fact-Check Sheet Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-12">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Fact-Check Sheet
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-4">Get Your Facts Straight</h3>
            <p className="text-zinc-400 max-w-2xl">
              All the official names, numbers, and terminology used at Pulse, compiled for easy reference to ensure accuracy in your reporting.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-6">Company Information</h4>
              
              <div className="space-y-6">
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">COMPANY NAME</p>
                  <p className="text-white">Pulse, Inc. (legal), "Pulse" or "Pulse Fitness Collective" (informal)</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">FOUNDING</p>
                  <p className="text-white">Founded in 2023 by Tremaine Grant in Atlanta, Georgia</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">PRODUCT NAMES</p>
                  <p className="text-white">Moves (individual exercise videos)</p>
                  <p className="text-white">Stacks (workout routines)</p>
                  <p className="text-white">Rounds (community challenges)</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">PLATFORM AVAILABILITY</p>
                  <p className="text-white">iOS App Store, Web app (fitwithpulse.ai)</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">HEADQUARTERS</p>
                  <p className="text-white">Atlanta, Georgia, USA</p>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-6">Key Metrics</h4>
              
              <div className="space-y-6">
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">USERS</p>
                  <p className="text-white">10,000+ active users as of May 2023</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: Internal analytics, updated monthly</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">CREATOR COMMUNITY</p>
                  <p className="text-white">1,000+ creators in the Founding Class (joined within first 45 days)</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: User registration data, verified May 2023</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">CONTENT STATS</p>
                  <p className="text-white">15,000+ workouts shared</p>
                  <p className="text-white">50,000+ exercises created</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: Platform database, May 2023</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">MORNING MOBILITY CHALLENGE</p>
                  <p className="text-white">2,500+ participants in inaugural challenge</p>
                  <p className="text-white">87% completion rate</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: Challenge analytics, April-May 2023</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <a href="#" className="inline-flex items-center text-[#E0FE10] hover:text-white">
              <Download className="mr-2 h-5 w-5" />
              Download complete fact-check sheet
            </a>
          </div>
        </div>
      </section>

      {/* Talking Points & FAQs Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Talking Points
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">Key Message Pillars</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">1</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">The Creator Economy for Fitness</h4>
                      <p className="text-zinc-400">Pulse is pioneering a creator economy specifically for fitness, where anyone with passion can create, share, and potentially monetize their fitness content.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">2</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">Community-Driven Innovation</h4>
                      <p className="text-zinc-400">Unlike traditional top-down fitness platforms, Pulse evolves based on how our community uses it. Our users directly shape the future of the platform.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">3</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">Democratizing Fitness Content</h4>
                      <p className="text-zinc-400">We're breaking down barriers between "experts" and "consumers" by giving everyone the tools to create high-quality fitness content.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">4</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">From Content to Community</h4>
                      <p className="text-zinc-400">Pulse transforms passive content consumption into active community participation through our Rounds feature, where users workout together virtually.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">5</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">The Social Fitness Revolution</h4>
                      <p className="text-zinc-400">Fitness has historically been an individual journey. Pulse is making it inherently social, without sacrificing personalization.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">6</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">Inclusive Leadership in Tech</h4>
                      <p className="text-zinc-400">As a Black-founded tech startup in the fitness space, Pulse represents the importance of diverse leadership in shaping inclusive platforms.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                FAQs
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">Frequently Asked Questions</h3>
              
              <div className="space-y-6">
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">How does Pulse differ from other fitness apps?</h4>
                  <p className="text-zinc-400">Most fitness apps treat users as passive consumers of expert-created content. Pulse flips this model by enabling every user to be a creator, sharing their own exercises and workouts while building community through challenges.</p>
                </div>
                
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">Do users need to be fitness experts to create content?</h4>
                  <p className="text-zinc-400">Not at all. Pulse is designed for everyone from beginners to professionals. Our intuitive tools make it easy for anyone to create high-quality fitness content, whether you're sharing your first push-up or your specialized training regimen.</p>
                </div>
                
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">What is the Morning Mobility Challenge?</h4>
                  <p className="text-zinc-400">The Morning Mobility Challenge is our flagship community event where participants commit to daily morning mobility exercises for 30 days. It combines user-generated content with community accountability, representing the essence of what makes Pulse unique.</p>
                </div>
                
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">How does Pulse plan to monetize?</h4>
                  <p className="text-zinc-400">Our primary focus is building a vibrant community and platform. Our future monetization will include premium features for creators, community challenge sponsorships, and tools that help fitness professionals expand their reach while maintaining our commitment to an accessible core platform.</p>
                </div>
                
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">Is Pulse available internationally?</h4>
                  <p className="text-zinc-400">Yes, Pulse is available worldwide on iOS and through our web app. While our primary market is currently the United States, we're seeing organic growth in international markets, particularly in Canada, the UK, and Australia.</p>
                </div>
              </div>
              
              <a href="#" className="mt-8 inline-flex items-center text-[#E0FE10] hover:text-white">
                <Download className="mr-2 h-5 w-5" />
                Download complete talking points and FAQs
              </a>
            </div>
          </div>
        </div>
      </section>
      
      {/* Contact Card Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Media Contact
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">Get In Touch</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-1">Email</h4>
                      <p className="text-zinc-400">press@pulse.ai</p>
                      <p className="text-zinc-500 text-sm mt-1">For all media inquiries (most responsive)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-1">Phone</h4>
                      <p className="text-zinc-400">(404) 555-0123</p>
                      <p className="text-zinc-500 text-sm mt-1">For urgent requests during business hours (EST)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-1">Book an Interview</h4>
                      <p className="text-zinc-400">calendly.com/pulse-media/press</p>
                      <p className="text-zinc-500 text-sm mt-1">Schedule time with our founders or executives</p>
                    </div>
                  </div>
                  
                  <div className="pt-6 mt-6 border-t border-zinc-800">
                    <h4 className="text-white text-lg font-medium mb-4">Social Media</h4>
                    <div className="flex gap-4">
                      <a href="https://twitter.com/pulseapp" className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center hover:bg-[#E0FE10]/40 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                        </svg>
                      </a>
                      <a href="https://instagram.com/pulseapp" className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center hover:bg-[#E0FE10]/40 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                        </svg>
                      </a>
                      <a href="https://linkedin.com/company/pulseapp" className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center hover:bg-[#E0FE10]/40 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                          <rect x="2" y="9" width="4" height="12"></rect>
                          <circle cx="4" cy="4" r="2"></circle>
                        </svg>
                      </a>
                      <a href="https://tiktok.com/@pulseapp" className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center hover:bg-[#E0FE10]/40 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path>
                          <path d="M20 9V4a1 1 0 0 0-1-1h-5"></path>
                          <path d="M15 12v3a4 4 0 0 1-4 4H9"></path>
                          <line x1="20" y1="9" x2="9" y2="9"></line>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:w-1/2 flex justify-center">
              <div className="max-w-md relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#E0FE10] to-teal-500 rounded-xl blur opacity-30"></div>
                <div className="relative bg-zinc-900 rounded-xl overflow-hidden p-8">
                  <h4 className="text-white text-2xl font-semibold mb-6">Download Press Kit</h4>
                  <p className="text-zinc-400 mb-8">Get everything in one place for offline access. Our complete press kit includes all PDFs, high-resolution images, and video assets.</p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                      <span className="text-zinc-300">All company & product info PDFs</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                      <span className="text-zinc-300">High-resolution logos & images</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                      <span className="text-zinc-300">App walkthrough video</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                      <span className="text-zinc-300">Usage guidelines</span>
                    </div>
                  </div>
                  
                  <a href="#" className="block w-full bg-[#E0FE10] hover:bg-[#c8e40d] text-black font-medium py-3 px-6 rounded-lg text-center transition-colors">
                    Download Complete Kit (42MB)
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PressKit;