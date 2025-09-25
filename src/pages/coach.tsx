import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaUsers, FaChartLine, FaBrain, FaRocket, FaCheckCircle, FaMobile, FaDesktop, FaQuoteLeft, FaArrowUp, FaHeart, FaFire, FaBolt, FaStar } from 'react-icons/fa';
import { MdDashboard, MdChat, MdAnalytics, MdGroup, MdTrendingUp, MdSpeed, MdInsights } from 'react-icons/md';

const Coach: React.FC = () => {
  const router = useRouter();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const handleRegister = () => {
    router.push('/coach/sign-up');
  };

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <FaBrain className="text-4xl" />,
      title: "AI Insights",
      metric: "23%",
      metricLabel: "Better Results",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <MdDashboard className="text-4xl" />,
      title: "Smart CRM",
      metric: "10x",
      metricLabel: "Faster Setup",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <MdTrendingUp className="text-4xl" />,
      title: "Analytics",
      metric: "89%",
      metricLabel: "Accuracy",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <FaUsers className="text-4xl" />,
      title: "Connect",
      metric: "24/7",
      metricLabel: "Access",
      color: "from-orange-500 to-red-500"
    }
  ];

  const testimonials = [
    {
      name: "Sarah J.",
      role: "PT",
      quote: "Game changer for my coaching!",
      rating: 5,
      avatar: "S"
    },
    {
      name: "Mike R.",
      role: "S&C Coach",
      quote: "Data I never had before.",
      rating: 5,
      avatar: "M"
    },
    {
      name: "Emma C.",
      role: "Wellness",
      quote: "50+ clients, no overwhelm.",
      rating: 5,
      avatar: "E"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden min-h-screen flex items-center">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E0FE10]/5 via-purple-500/5 to-blue-500/5"></div>
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#E0FE10]/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center">
            {/* Floating Badge */}
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-purple-500/20 rounded-full text-[#E0FE10] text-sm font-medium mb-8 animate-bounce">
              <FaRocket className="mr-2 animate-spin" />
              Future of Coaching
            </div>
            
            {/* Main Title with Gradient */}
            <h1 className="text-6xl md:text-8xl font-bold mb-8">
              <span className="bg-gradient-to-r from-white via-[#E0FE10] to-purple-400 bg-clip-text text-transparent">
                Pulse
              </span>
              <br />
              <span className="text-white">Coach</span>
            </h1>
            
            {/* Value Proposition */}
            <p className="text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
              AI-powered coaching platform with advanced client management
            </p>
            
            {/* Visual Icons Instead of Text */}
            <div className="flex justify-center items-center space-x-8 mb-12">
              <div className="flex items-center space-x-2">
                <FaBrain className="text-2xl text-purple-400 animate-pulse" />
                <FaArrowUp className="text-[#E0FE10]" />
              </div>
              <div className="flex items-center space-x-2">
                <MdDashboard className="text-2xl text-blue-400 animate-pulse" />
                <FaArrowUp className="text-[#E0FE10]" />
              </div>
              <div className="flex items-center space-x-2">
                <MdTrendingUp className="text-2xl text-green-400 animate-pulse" />
                <FaArrowUp className="text-[#E0FE10]" />
              </div>
            </div>
            
            {/* CTA Button */}
            <button
              onClick={handleRegister}
              className="group bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-12 py-6 rounded-2xl text-xl font-bold hover:scale-105 transition-all duration-300 shadow-2xl shadow-[#E0FE10]/25 mb-16"
            >
              <div className="flex items-center">
                <FaBolt className="mr-3 group-hover:animate-bounce" />
                Start Now
                <FaRocket className="ml-3 group-hover:animate-bounce" />
              </div>
            </button>

          </div>
        </div>
      </div>

      {/* Visual Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="group relative">
              <div className={`bg-gradient-to-br ${feature.color} p-8 rounded-3xl hover:scale-105 transition-all duration-500 cursor-pointer`}>
                <div className="text-white mb-6 group-hover:animate-bounce">
                  {feature.icon}
                </div>
                <div className="text-white font-bold text-xl mb-2">{feature.title}</div>
                <div className="text-white/90 text-3xl font-bold mb-1">{feature.metric}</div>
                <div className="text-white/70 text-sm">{feature.metricLabel}</div>
                
                {/* Floating particles */}
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-white/30 rounded-full animate-ping"></div>
                <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-white/20 rounded-full animate-pulse delay-500"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Dashboard */}
      <div className="bg-zinc-900/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Your Command Center</h2>
            <p className="text-zinc-400">Manage all your athletes in one place</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Animated Dashboard */}
            <div className="relative">
              <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-3xl p-8 border border-zinc-700 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-lg flex items-center justify-center">
                      <MdDashboard className="text-black" />
                    </div>
                    <span className="font-bold text-xl">Dashboard</span>
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse delay-200"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse delay-400"></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-2xl p-4 border border-purple-500/30">
                    <FaUsers className="text-2xl text-purple-400 mb-2" />
                    <div className="text-2xl font-bold text-white">24</div>
                    <div className="text-purple-300 text-xs">Athletes</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl p-4 border border-blue-500/30">
                    <FaFire className="text-2xl text-blue-400 mb-2" />
                    <div className="text-2xl font-bold text-white">156</div>
                    <div className="text-blue-300 text-xs">Sessions</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-2xl p-4 border border-green-500/30">
                    <MdTrendingUp className="text-2xl text-green-400 mb-2" />
                    <div className="text-2xl font-bold text-white">89%</div>
                    <div className="text-green-300 text-xs">Sentiment Score</div>
                  </div>
                </div>
                
                {/* Animated Chart */}
                <div className="bg-zinc-800/50 rounded-2xl p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-zinc-400">Weekly Progress</span>
                    <FaChartLine className="text-[#E0FE10]" />
                  </div>
                  <div className="flex items-end space-x-2 h-16">
                    {[40, 60, 80, 45, 70, 90, 65].map((height, i) => (
                      <div 
                        key={i} 
                        className="bg-gradient-to-t from-[#E0FE10] to-lime-400 rounded-sm flex-1 transition-all duration-1000 hover:scale-110" 
                        style={{ height: `${height}%` }}
                      ></div>
                    ))}
                  </div>
                </div>
                
                {/* Live Activity */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 bg-zinc-800/30 rounded-xl p-3">
                    <div className="w-2 h-2 bg-[#E0FE10] rounded-full animate-ping"></div>
                    <span className="text-sm text-zinc-300">Sarah just completed workout</span>
                    <span className="text-xs text-[#E0FE10] ml-auto">now</span>
                  </div>
                  <div className="flex items-center space-x-3 bg-zinc-800/30 rounded-xl p-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-sm text-zinc-300">Mike updated check-in</span>
                    <span className="text-xs text-blue-400 ml-auto">2m</span>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-[#E0FE10]/20 rounded-full animate-bounce"></div>
              <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-purple-500/20 rounded-full animate-pulse"></div>
            </div>

            {/* Visual Benefits */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4 group cursor-pointer">
                <div className="w-12 h-12 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FaBrain className="text-black text-xl" />
                </div>
                <div>
                  <div className="font-bold text-lg">AI Insights</div>
                  <div className="text-zinc-400 text-sm">Smart recommendations</div>
                </div>
                <FaArrowUp className="text-[#E0FE10] ml-auto group-hover:animate-bounce" />
              </div>
              
              <div className="flex items-center space-x-4 group cursor-pointer">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MdAnalytics className="text-white text-xl" />
                </div>
                <div>
                  <div className="font-bold text-lg">Real-time Data</div>
                  <div className="text-zinc-400 text-sm">Live performance tracking</div>
                </div>
                <FaArrowUp className="text-[#E0FE10] ml-auto group-hover:animate-bounce" />
              </div>
              
              <div className="flex items-center space-x-4 group cursor-pointer">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FaUsers className="text-white text-xl" />
                </div>
                <div>
                  <div className="font-bold text-lg">Client Management</div>
                  <div className="text-zinc-400 text-sm">Effortless organization</div>
                </div>
                <FaArrowUp className="text-[#E0FE10] ml-auto group-hover:animate-bounce" />
              </div>
              
              <div className="flex items-center space-x-4 group cursor-pointer">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MdSpeed className="text-white text-xl" />
                </div>
                <div>
                  <div className="font-bold text-lg">24/7 Access</div>
                  <div className="text-zinc-400 text-sm">Always available</div>
                </div>
                <FaArrowUp className="text-[#E0FE10] ml-auto group-hover:animate-bounce" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Showcase */}
      <div className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/10 to-blue-900/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-3 mb-6">
              <FaBrain className="text-4xl text-purple-400 animate-pulse" />
              <span className="text-3xl font-bold">AI CBT</span>
              <FaBolt className="text-4xl text-[#E0FE10] animate-bounce" />
            </div>
            <div className="text-lg text-zinc-300 mb-2">Cognitive Behavioral Therapy</div>
            <p className="text-zinc-400">Get real-time insights on your athletes' mental performance</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* AI Chat Interface */}
            <div className="relative">
              <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-3xl p-8 border border-purple-500/30 backdrop-blur-sm">
                <div className="flex items-center mb-6">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mr-3"></div>
                  <span className="font-bold">PulseCheck AI</span>
                  <div className="ml-auto flex space-x-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl p-4 border-l-4 border-purple-400">
                    <div className="flex items-center mb-2">
                      <MdInsights className="text-purple-400 mr-2" />
                      <span className="text-sm font-semibold text-purple-300">Stress Alert</span>
                    </div>
                    <div className="text-sm text-white">Sarah: ⚠️ High stress detected</div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl p-4 border-l-4 border-blue-400">
                    <div className="flex items-center mb-2">
                      <MdTrendingUp className="text-blue-400 mr-2" />
                      <span className="text-sm font-semibold text-blue-300">Performance</span>
                    </div>
                    <div className="text-sm text-white">Mike: 📈 +23% confidence boost</div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl p-4 border-l-4 border-green-400">
                    <div className="flex items-center mb-2">
                      <FaBolt className="text-green-400 mr-2" />
                      <span className="text-sm font-semibold text-green-300">Recommendation</span>
                    </div>
                    <div className="text-sm text-white">Alex: 🎯 Adjust intensity</div>
                  </div>
                </div>
              </div>
              
              {/* Floating AI Elements */}
              <div className="absolute -top-6 -right-6 w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center animate-spin">
                <FaBrain className="text-purple-400" />
              </div>
            </div>

            {/* Visual Benefits Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <FaBrain className="text-white text-2xl" />
                </div>
                <div className="font-bold text-lg mb-2">Mental Insights</div>
                <div className="text-3xl font-bold text-purple-400 mb-1">100%</div>
                <div className="text-zinc-400 text-sm">Accuracy</div>
              </div>
              
              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <MdSpeed className="text-white text-2xl" />
                </div>
                <div className="font-bold text-lg mb-2">Predictions</div>
                <div className="text-3xl font-bold text-blue-400 mb-1">Real-time</div>
                <div className="text-zinc-400 text-sm">Analysis</div>
              </div>
              
              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <FaBolt className="text-white text-2xl" />
                </div>
                <div className="font-bold text-lg mb-2">Recommendations</div>
                <div className="text-3xl font-bold text-green-400 mb-1">Smart</div>
                <div className="text-zinc-400 text-sm">Suggestions</div>
              </div>
              
              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <FaHeart className="text-white text-2xl" />
                </div>
                <div className="font-bold text-lg mb-2">Wellness</div>
                <div className="text-3xl font-bold text-orange-400 mb-1">24/7</div>
                <div className="text-zinc-400 text-sm">Monitoring</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof Carousel */}
      <div className="bg-zinc-900/50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Coaches Love Pulse</h2>
            <div className="flex justify-center items-center space-x-2 mb-6">
              {[1,2,3,4,5].map(i => (
                <FaStar key={i} className="text-2xl text-[#E0FE10]" />
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-3xl p-8 border border-zinc-700 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-6 text-black font-bold text-2xl">
                {testimonials[currentTestimonial].avatar}
              </div>
              
              <div className="text-2xl font-bold mb-4 text-[#E0FE10]">
                "{testimonials[currentTestimonial].quote}"
              </div>
              
              <div className="text-lg font-semibold text-white mb-1">
                {testimonials[currentTestimonial].name}
              </div>
              <div className="text-zinc-400">
                {testimonials[currentTestimonial].role}
              </div>
              
              {/* Carousel Dots */}
              <div className="flex justify-center space-x-2 mt-6">
                {testimonials.map((_, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentTestimonial ? 'bg-[#E0FE10]' : 'bg-zinc-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Device Showcase */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Coach Anywhere</h2>
            <p className="text-zinc-400">Mobile app + web dashboard</p>
          </div>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="bg-gradient-to-br from-[#E0FE10]/20 to-lime-400/20 rounded-3xl p-12 text-center">
                <FaMobile className="text-8xl text-[#E0FE10] mx-auto mb-6 animate-bounce" />
                <div className="text-2xl font-bold mb-2">Mobile</div>
                <div className="text-4xl font-bold text-[#E0FE10] mb-2">24/7</div>
                <div className="text-zinc-400">On-the-go coaching</div>
              </div>
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-[#E0FE10]/30 rounded-full animate-ping"></div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl p-12 text-center">
                <FaDesktop className="text-8xl text-blue-400 mx-auto mb-6 animate-pulse" />
                <div className="text-2xl font-bold mb-2">Desktop</div>
                <div className="text-4xl font-bold text-blue-400 mb-2">Pro</div>
                <div className="text-zinc-400">Advanced analytics</div>
              </div>
              <div className="absolute -top-4 -left-4 w-6 h-6 bg-blue-500/30 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#E0FE10]/5 via-purple-500/5 to-blue-500/5"></div>
        <div className="absolute top-10 left-10 w-32 h-32 bg-[#E0FE10]/10 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl animate-pulse delay-1000"></div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Level Up?</h2>
          <p className="text-xl text-zinc-300 mb-12">Join the coaching revolution</p>
          
          <div className="mb-12">
            <div className="grid grid-cols-3 gap-8 mb-8">
              <div className="group">
                <div className="text-5xl font-bold text-[#E0FE10] mb-2 group-hover:scale-110 transition-transform">
                  FREE
                </div>
                <div className="text-zinc-300">Start</div>
              </div>
              <div className="group">
                <div className="text-5xl font-bold text-[#E0FE10] mb-2 group-hover:scale-110 transition-transform">
                  24/7
                </div>
                <div className="text-zinc-300">Access</div>
              </div>
              <div className="group">
                <div className="text-5xl font-bold text-[#E0FE10] mb-2 group-hover:scale-110 transition-transform">
                  ∞
                </div>
                <div className="text-zinc-300">Growth</div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleRegister}
            className="group bg-gradient-to-r from-[#E0FE10] via-lime-400 to-[#E0FE10] text-black px-16 py-6 rounded-3xl text-2xl font-bold hover:scale-105 transition-all duration-300 shadow-2xl shadow-[#E0FE10]/25 animate-pulse"
          >
            <div className="flex items-center">
              <FaRocket className="mr-4 text-2xl group-hover:animate-bounce" />
              Start Coaching
              <FaBolt className="ml-4 text-2xl group-hover:animate-bounce" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Coach;
