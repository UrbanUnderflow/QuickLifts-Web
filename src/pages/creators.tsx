import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Play, Download, Users, DollarSign, Zap, Trophy, CheckCircle, ArrowRight, MessageCircle, Star, Calculator, TrendingUp, Brain, Sparkles } from 'lucide-react';

const CreatorsPage: React.FC = () => {
  const [followerCount, setFollowerCount] = useState(10000);
  const [weeklyMoves, setWeeklyMoves] = useState(3);
  const [estimatedEarnings, setEstimatedEarnings] = useState(0);

  // Calculate estimated earnings based on inputs
  useEffect(() => {
    // Formula: (followers * 0.05 engagement rate * weekly moves * $2.50 avg per play * 4 weeks)
    const monthlyPlays = followerCount * 0.05 * weeklyMoves * 4;
    const estimated = monthlyPlays * 2.50;
    setEstimatedEarnings(Math.round(estimated));
  }, [followerCount, weeklyMoves]);

  const handleApplyClick = () => {
    // Replace with actual application form URL
    window.open('https://forms.gle/your-typeform-link', '_blank');
  };

  const handleDemoClick = () => {
    // Replace with actual demo video URL
    window.open('https://vimeo.com/your-demo-video', '_blank');
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Head>
        <title>Creators Program | Turn Workouts into Worlds | Pulse</title>
        <meta name="description" content="Join the 100 Trainers Program. Earn $4.3k+ monthly with our multiplayer fitness platform. Apply now for exclusive creator benefits." />
        <meta name="keywords" content="fitness creator, workout monetization, fitness influencer, trainer program, pulse creators" />
        <meta property="og:title" content="Creators Program | Turn Workouts into Worlds | Pulse" />
        <meta property="og:description" content="Join the 100 Trainers Program. Earn $4.3k+ monthly with our multiplayer fitness platform." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className="min-h-screen bg-[#111417] text-white">
        {/* Navigation */}
        <nav className="fixed top-0 w-full bg-[#111417]/95 backdrop-blur-sm z-50 border-b border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="text-xl font-bold text-[#d7ff00]">Pulse</div>
            <div className="hidden md:flex space-x-6 text-sm">
              <button onClick={() => scrollToSection('why-creators')} className="hover:text-[#d7ff00] transition">Why Creators Win</button>
              <button onClick={() => scrollToSection('economy')} className="hover:text-[#d7ff00] transition">Economy</button>
              <button onClick={() => scrollToSection('ai-features')} className="hover:text-[#d7ff00] transition">AI Features</button>
              <button onClick={() => scrollToSection('program')} className="hover:text-[#d7ff00] transition">100 Trainers</button>
              <button onClick={() => scrollToSection('stories')} className="hover:text-[#d7ff00] transition">Stories</button>
            </div>
            <button 
              onClick={handleApplyClick}
              className="bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00] px-4 py-2 rounded-lg font-medium text-black hover:opacity-90 transition"
            >
              Apply Now
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section id="hero" className="relative pt-20 pb-16 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-[#d7ff00]/10"></div>
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-12">
              <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-200 to-[#d7ff00] bg-clip-text text-transparent">
                Turn Workouts into Worlds
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
                Join the multiplayer fitness revolution. Your moves become micro-assets earning royalties every time someone plays.
              </p>
              
              {/* KPI Burst */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
                <div className="bg-[#1a1e24] rounded-xl p-6 border border-blue-800/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500"></div>
                  <div className="text-3xl font-bold text-[#d7ff00] mb-2">37.5×</div>
                  <div className="text-gray-300">Average user multiplier per creator</div>
                </div>
                <div className="bg-[#1a1e24] rounded-xl p-6 border border-purple-800/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-[#d7ff00]"></div>
                  <div className="text-3xl font-bold text-[#d7ff00] mb-2">$4.3k</div>
                  <div className="text-gray-300">Top earner in 4 months</div>
                </div>
                <div className="bg-[#1a1e24] rounded-xl p-6 border border-green-800/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#d7ff00] to-green-500"></div>
                  <div className="text-3xl font-bold text-[#d7ff00] mb-2">250+</div>
                  <div className="text-gray-300">Players per multiplayer Round</div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button 
                  onClick={handleApplyClick}
                  className="bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00] px-8 py-4 rounded-lg font-bold text-black text-lg hover:opacity-90 transition flex items-center gap-2"
                >
                  Apply to the 100 Trainers Program
                  <ArrowRight className="h-5 w-5" />
                </button>
                <button 
                  onClick={handleDemoClick}
                  className="border border-gray-600 px-8 py-4 rounded-lg font-medium hover:bg-gray-800/50 transition flex items-center gap-2"
                >
                  <Play className="h-5 w-5" />
                  Watch 90-sec Demo
                </button>
              </div>
            </div>

            {/* Demo Placeholder */}
            <div className="bg-[#1a1e24] rounded-2xl p-8 border border-gray-700 max-w-4xl mx-auto">
              <div className="aspect-video bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-xl flex items-center justify-center border border-gray-600">
                <div className="text-center">
                  <Play className="h-16 w-16 mx-auto mb-4 text-[#d7ff00]" />
                  <p className="text-gray-300">8-second montage: Moves → Stack → 250-player Round</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Creators Win */}
        <section id="why-creators" className="py-16 px-4 bg-[#0f1216]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12 text-white">Why Creators Win on Pulse</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#1a1e24] rounded-xl p-8 border border-blue-800/50 relative overflow-hidden group hover:border-blue-600/70 transition-all">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500"></div>
                <DollarSign className="h-12 w-12 text-[#d7ff00] mb-6" />
                <h3 className="text-xl font-bold mb-4 text-white">Plug-and-Play Revenue</h3>
                <p className="text-gray-300 mb-4">Auto royalty on every replay. No sponsorship deals needed—just upload and earn.</p>
                <div className="text-sm text-[#d7ff00] font-medium">Set it and forget it monetization</div>
              </div>
              
              <div className="bg-[#1a1e24] rounded-xl p-8 border border-purple-800/50 relative overflow-hidden group hover:border-purple-600/70 transition-all">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-[#d7ff00]"></div>
                <Users className="h-12 w-12 text-[#d7ff00] mb-6" />
                <h3 className="text-xl font-bold mb-4 text-white">Multiplayer Magic</h3>
                <p className="text-gray-300 mb-4">One workout becomes unlimited Rounds with up to 250 players competing together.</p>
                <div className="text-sm text-[#d7ff00] font-medium">Infinite scalability per creation</div>
              </div>
              
              <div className="bg-[#1a1e24] rounded-xl p-8 border border-green-800/50 relative overflow-hidden group hover:border-green-600/70 transition-all">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#d7ff00] to-green-500"></div>
                <Trophy className="h-12 w-12 text-[#d7ff00] mb-6" />
                <h3 className="text-xl font-bold mb-4 text-white">Own Your IP</h3>
                <p className="text-gray-300 mb-4">Keep 100% rights to your content. We just license for platform use.</p>
                <div className="text-sm text-[#d7ff00] font-medium">You maintain full ownership</div>
              </div>
            </div>
          </div>
        </section>

        {/* Economy Explainer */}
        <section id="economy" className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-white">Every Move You Upload Becomes a Micro-Asset</h2>
              <p className="text-xl text-gray-300">The more engaging your content, the more you earn through our automated royalty system.</p>
            </div>
            
            {/* Flow Diagram */}
            <div className="bg-[#1a1e24] rounded-2xl p-8 border border-gray-700 mb-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-bold mb-2">Create Move</h3>
                  <p className="text-gray-400 text-sm">Upload your workout</p>
                </div>
                
                <ArrowRight className="h-6 w-6 text-[#d7ff00] rotate-90 md:rotate-0" />
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-bold mb-2">Build Stack</h3>
                  <p className="text-gray-400 text-sm">AI creates variations</p>
                </div>
                
                <ArrowRight className="h-6 w-6 text-[#d7ff00] rotate-90 md:rotate-0" />
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <Trophy className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-bold mb-2">Host Round</h3>
                  <p className="text-gray-400 text-sm">Players compete live</p>
                </div>
                
                <ArrowRight className="h-6 w-6 text-[#d7ff00] rotate-90 md:rotate-0" />
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#d7ff00] rounded-full flex items-center justify-center mb-4 mx-auto">
                    <DollarSign className="h-8 w-8 text-black" />
                  </div>
                  <h3 className="font-bold mb-2">Earn $$$</h3>
                  <p className="text-gray-400 text-sm">Automatic royalties</p>
                </div>
              </div>
            </div>

            {/* Earnings Calculator */}
            <div className="bg-[#1a1e24] rounded-2xl p-8 border border-gray-700 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
              <h3 className="text-2xl font-bold mb-6 text-center text-white flex items-center justify-center gap-2">
                <Calculator className="h-6 w-6 text-[#d7ff00]" />
                Estimate Your Monthly Earnings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Your Follower Count</label>
                    <input
                      type="range"
                      min="1000"
                      max="1000000"
                      step="1000"
                      value={followerCount}
                      onChange={(e) => setFollowerCount(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="text-right text-sm text-gray-400 mt-1">
                      {followerCount.toLocaleString()} followers
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Weekly Moves Created</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={weeklyMoves}
                      onChange={(e) => setWeeklyMoves(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="text-right text-sm text-gray-400 mt-1">
                      {weeklyMoves} moves per week
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#262a30] rounded-xl p-6 border border-[#d7ff00]/30">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-[#d7ff00] mb-2">
                      ${estimatedEarnings.toLocaleString()}
                    </div>
                    <div className="text-gray-300 mb-4">Estimated monthly earnings</div>
                    <div className="text-sm text-gray-400">
                      Based on 5% engagement rate and $2.50 average per play
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pulse Programming AI */}
        <section id="ai-features" className="py-16 px-4 bg-[#0f1216]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-white flex items-center justify-center gap-3">
                <Brain className="h-10 w-10 text-[#d7ff00]" />
                Pulse Programming AI
              </h2>
              <p className="text-xl text-gray-300">The smartest fitness AI that scales your creativity</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="bg-[#1a1e24] rounded-xl p-6 border border-gray-700 mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-[#d7ff00] rounded-full flex items-center justify-center">
                      <span className="text-black font-bold text-sm">AI</span>
                    </div>
                    <div className="text-gray-400 text-sm">Chat with Pulse AI</div>
                  </div>
                  <div className="bg-[#262a30] rounded-lg p-4 mb-4">
                    <p className="text-gray-300">"Create a 30-minute HIIT workout for beginners focused on core strength"</p>
                  </div>
                  <div className="flex items-center gap-2 text-[#d7ff00] text-sm">
                    <Sparkles className="h-4 w-4" />
                    <span>Generating complete workout with progressions...</span>
                  </div>
                </div>
                
                <ul className="space-y-4">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#d7ff00] flex-shrink-0" />
                    <span className="text-gray-300">Auto-progression algorithms that adapt to user performance</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#d7ff00] flex-shrink-0" />
                    <span className="text-gray-300">Adaptive difficulty scaling for any fitness level</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#d7ff00] flex-shrink-0" />
                    <span className="text-gray-300">Automatic copyright tagging and attribution</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#d7ff00] flex-shrink-0" />
                    <span className="text-gray-300">Smart workout variations for infinite replay value</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-[#1a1e24] rounded-2xl p-8 border border-gray-700">
                <div className="aspect-square bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl flex items-center justify-center border border-gray-600">
                  <div className="text-center">
                    <Brain className="h-16 w-16 mx-auto mb-4 text-[#d7ff00]" />
                    <p className="text-gray-300">AI Workout Generation Demo</p>
                    <p className="text-sm text-gray-400 mt-2">Watch the magic happen in real-time</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 100 Trainers Program */}
        <section id="program" className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-white">100 Trainers Program</h2>
              <p className="text-xl text-gray-300">Limited-slot cohort with exclusive launch benefits</p>
              <div className="inline-block bg-red-600/20 border border-red-600 rounded-full px-4 py-2 mt-4">
                <span className="text-red-400 font-medium">⚡ Only 23 spots remaining</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="bg-[#1a1e24] rounded-2xl p-8 border border-gray-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                <h3 className="text-2xl font-bold mb-6 text-white">Exclusive Benefits</h3>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#d7ff00] flex-shrink-0" />
                    <span className="text-gray-300">1:1 dedicated launch engineer for 2 weeks</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#d7ff00] flex-shrink-0" />
                    <span className="text-gray-300">Premium feature placement in app discovery</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#d7ff00] flex-shrink-0" />
                    <span className="text-gray-300">$500 advertising credit match program</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#d7ff00] flex-shrink-0" />
                    <span className="text-gray-300">Direct line to product team for feedback</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#d7ff00] flex-shrink-0" />
                    <span className="text-gray-300">Exclusive creator Discord community</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-[#1a1e24] rounded-2xl p-8 border border-gray-700">
                <h3 className="text-2xl font-bold mb-6 text-white">Launch Timeline</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-white font-bold text-sm">1</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">Week 1-2: Onboarding</h4>
                      <p className="text-gray-400 text-sm">Setup, training, and first content uploads</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-white font-bold text-sm">2</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">Week 3: First Paid Round</h4>
                      <p className="text-gray-400 text-sm">Launch your monetized content to users</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-[#d7ff00] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-black font-bold text-sm">3</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">Week 4+: Scale & Optimize</h4>
                      <p className="text-gray-400 text-sm">Analyze performance and scale successful content</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <button 
                onClick={handleApplyClick}
                className="bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00] px-8 py-4 rounded-lg font-bold text-black text-lg hover:opacity-90 transition flex items-center gap-2 mx-auto"
              >
                Apply to the 100 Trainers Program
                <ArrowRight className="h-5 w-5" />
              </button>
              <p className="text-gray-400 text-sm mt-4">Applications reviewed within 48 hours</p>
            </div>
          </div>
        </section>

        {/* Creator Stories */}
        <section id="stories" className="py-16 px-4 bg-[#0f1216]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-white">Creator Stories</h2>
              <p className="text-xl text-gray-300">Real results from our founding creators</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#1a1e24] rounded-2xl p-8 border border-gray-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500"></div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xl">JM</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Jessica Martinez</h3>
                    <p className="text-gray-400">HIIT Specialist, 45k followers</p>
                  </div>
                </div>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  "Within 3 months, I went from zero to $3,200 monthly recurring revenue. The multiplayer aspect completely changed how my community engages with my content. Instead of one-and-done videos, my workouts live forever."
                </p>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#d7ff00]">$3.2k</div>
                    <div className="text-xs text-gray-400">Monthly Revenue</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#d7ff00]">850+</div>
                    <div className="text-xs text-gray-400">Active Players</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#d7ff00]">92%</div>
                    <div className="text-xs text-gray-400">Completion Rate</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#1a1e24] rounded-2xl p-8 border border-gray-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-[#d7ff00]"></div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-[#d7ff00] rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-xl">DR</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white">David Rodriguez</h3>
                    <p className="text-gray-400">Strength Coach, 28k followers</p>
                  </div>
                </div>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  "The AI programming tool is incredible. I upload one workout concept and it creates 15 variations automatically. Each variation earns separately, so I'm basically earning royalties on my sleep while my community stays engaged."
                </p>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#d7ff00]">$1.8k</div>
                    <div className="text-xs text-gray-400">Monthly Revenue</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#d7ff00]">420+</div>
                    <div className="text-xs text-gray-400">Active Players</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#d7ff00]">24</div>
                    <div className="text-xs text-gray-400">Workouts Created</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-8">
              <button className="text-[#d7ff00] hover:text-[#b8d400] transition flex items-center gap-2 mx-auto">
                <Download className="h-5 w-5" />
                Download Full Case Studies (PDF)
              </button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12 text-white">FAQ & Fine Print</h2>
            
            <div className="space-y-6">
              <div className="bg-[#1a1e24] rounded-xl p-6 border border-gray-700">
                <h3 className="font-bold text-white mb-3">What's the revenue split?</h3>
                <p className="text-gray-300">Creators keep 70% of all revenue generated from their content. Pulse takes 30% to cover platform operations, hosting, and development.</p>
              </div>
              
              <div className="bg-[#1a1e24] rounded-xl p-6 border border-gray-700">
                <h3 className="font-bold text-white mb-3">How often do payouts happen?</h3>
                <p className="text-gray-300">Monthly payouts on the 15th via Stripe. Minimum payout threshold is $50. Real-time earnings tracking in your creator dashboard.</p>
              </div>
              
              <div className="bg-[#1a1e24] rounded-xl p-6 border border-gray-700">
                <h3 className="font-bold text-white mb-3">Is there an exclusivity requirement?</h3>
                <p className="text-gray-300">No exclusivity required. You can continue using other platforms. We just ask that Pulse-created content stays unique to our ecosystem.</p>
              </div>
              
              <div className="bg-[#1a1e24] rounded-xl p-6 border border-gray-700">
                <h3 className="font-bold text-white mb-3">Who owns the content I create?</h3>
                <p className="text-gray-300">You retain 100% ownership of your intellectual property. Pulse gets a platform license to distribute, but you can use your content elsewhere freely.</p>
              </div>
              
              <div className="bg-[#1a1e24] rounded-xl p-6 border border-gray-700">
                <h3 className="font-bold text-white mb-3">What are the brand safety guidelines?</h3>
                <p className="text-gray-300">Standard fitness content guidelines: no unsafe practices, age-appropriate language, and evidence-based training methods. Full guidelines provided upon acceptance.</p>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <h3 className="text-xl font-bold text-white mb-4">Ready to Get Started?</h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button className="bg-[#d7ff00] text-black px-6 py-3 rounded-lg font-medium hover:bg-[#b8d400] transition flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Creator One-Sheet (PDF)
                </button>
                <button className="border border-gray-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-800/50 transition flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Brand Asset Pack
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Sticky Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#111417]/95 backdrop-blur-sm border-t border-gray-800 p-4 z-40">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => window.open('https://discord.gg/pulse-creators', '_blank')}
                className="text-[#d7ff00] hover:text-[#b8d400] transition flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="hidden sm:inline">Chat with Creator Success</span>
                <span className="sm:hidden">Discord</span>
              </button>
            </div>
            <button 
              onClick={handleApplyClick}
              className="bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00] px-6 py-3 rounded-lg font-bold text-black hover:opacity-90 transition"
            >
              Apply Now
            </button>
          </div>
        </div>

        {/* Bottom Padding for Sticky Footer */}
        <div className="h-20"></div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #d7ff00;
          cursor: pointer;
          border: 2px solid #111417;
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #d7ff00;
          cursor: pointer;
          border: 2px solid #111417;
        }
      `}</style>
    </>
  );
};

export default CreatorsPage; 