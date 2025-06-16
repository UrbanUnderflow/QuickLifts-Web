import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  HeartIcon, 
  BoltIcon, 
  MoonIcon, 
  FireIcon,
  ChartBarIcon,
  SparklesIcon,
  ArrowRightIcon,
  PlayIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const HealthDataStories = () => {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.3]);

  const [activeStory, setActiveStory] = useState(0);

  const healthStories = [
    {
      id: 'energy-balance',
      title: 'Your Energy Story',
      subtitle: 'Energy Balance & Metabolism',
      icon: <FireIcon className="w-8 h-8" />,
      color: 'from-orange-500 to-red-500',
      glowColor: 'orange-500/20',
      borderColor: 'orange-500/40',
      description: 'Understand how your calories in vs calories out affects your energy levels and weight management goals.',
      insights: [
        'Caloric deficit/surplus analysis',
        'Metabolic rate insights',
        'Energy expenditure patterns',
        'Nutrition timing recommendations'
      ],
      outcomes: [
        { status: 'Excellent', description: 'Perfect energy balance supporting your goals', color: 'text-green-400' },
        { status: 'Good', description: 'Healthy energy patterns with room for optimization', color: 'text-blue-400' },
        { status: 'Needs Attention', description: 'Energy imbalance affecting performance', color: 'text-yellow-400' },
        { status: 'Concerning', description: 'Significant energy deficit or surplus', color: 'text-red-400' }
      ],
      mockData: {
        caloriesIn: 2150,
        caloriesOut: 2380,
        netCalories: -230,
        status: 'Moderate Deficit'
      }
    },
    {
      id: 'movement-story',
      title: 'Your Movement Story',
      subtitle: 'Activity & Steps Analysis',
      icon: <BoltIcon className="w-8 h-8" />,
      color: 'from-green-500 to-emerald-500',
      glowColor: 'green-500/20',
      borderColor: 'green-500/40',
      description: 'Track your daily movement patterns and discover how your activity levels impact your overall health.',
      insights: [
        'Daily step count analysis',
        'Activity pattern recognition',
        'Movement goal tracking',
        'Sedentary behavior insights'
      ],
      outcomes: [
        { status: 'Highly Active', description: '15,000+ steps with consistent movement', color: 'text-green-400' },
        { status: 'Active', description: '10,000-15,000 steps meeting health guidelines', color: 'text-blue-400' },
        { status: 'Moderately Active', description: '7,500-10,000 steps with room for improvement', color: 'text-yellow-400' },
        { status: 'Sedentary', description: 'Below 7,500 steps, increased health risks', color: 'text-red-400' }
      ],
      mockData: {
        steps: 12847,
        goal: 10000,
        progress: 128,
        achievements: ['10K Steps', '15K Steps']
      }
    },
    {
      id: 'sleep-recovery',
      title: 'Sleep Story',
      subtitle: 'Rest Quality Analysis',
      icon: <MoonIcon className="w-8 h-8" />,
      color: 'from-purple-500 to-indigo-500',
      glowColor: 'purple-500/20',
      borderColor: 'purple-500/40',
      description: 'Analyze your sleep patterns and understand how rest quality affects your recovery and performance.',
      insights: [
        'Sleep duration and efficiency',
        'Sleep stage breakdown',
        'Recovery score calculation',
        'Sleep timing optimization'
      ],
      outcomes: [
        { status: 'Excellent', description: '8+ hours with high efficiency and optimal stages', color: 'text-green-400' },
        { status: 'Good', description: '7-8 hours with good sleep quality', color: 'text-blue-400' },
        { status: 'Fair', description: '6-7 hours or disrupted sleep patterns', color: 'text-yellow-400' },
        { status: 'Poor', description: 'Less than 6 hours or very poor quality', color: 'text-red-400' }
      ],
      mockData: {
        duration: '7h 42m',
        efficiency: 89,
        deepSleep: 22,
        remSleep: 18
      }
    },
    {
      id: 'heart-story',
      title: 'Your Heart Story',
      subtitle: 'Cardiovascular Health',
      icon: <HeartIcon className="w-8 h-8" />,
      color: 'from-red-500 to-pink-500',
      glowColor: 'red-500/20',
      borderColor: 'red-500/40',
      description: 'Monitor your heart rate variability and cardiovascular patterns to optimize your training and recovery.',
      insights: [
        'Heart rate variability trends',
        'Recovery score analysis',
        'Stress level indicators',
        'Training readiness assessment'
      ],
      outcomes: [
        { status: 'Excellent Recovery', description: 'High HRV indicating optimal recovery', color: 'text-green-400' },
        { status: 'Good Recovery', description: 'Healthy HRV patterns with good balance', color: 'text-blue-400' },
        { status: 'Moderate Stress', description: 'Elevated stress levels affecting recovery', color: 'text-yellow-400' },
        { status: 'High Stress', description: 'Low HRV indicating overtraining or stress', color: 'text-red-400' }
      ],
      mockData: {
        avgHRV: 42.3,
        recoveryScore: 78,
        trend: 'Improving',
        restingHR: 58
      }
    },
    {
      id: 'nutrition-story',
      title: 'Your Dietary Story',
      subtitle: 'Nutrition Analysis',
      icon: <ChartBarIcon className="w-8 h-8" />,
      color: 'from-yellow-500 to-orange-500',
      glowColor: 'yellow-500/20',
      borderColor: 'yellow-500/40',
      description: 'Understand your nutritional patterns and how your diet supports your health and fitness goals.',
      insights: [
        'Macronutrient balance analysis',
        'Micronutrient tracking',
        'Meal timing patterns',
        'Nutritional quality assessment'
      ],
      outcomes: [
        { status: 'Optimal Nutrition', description: 'Balanced macros with high-quality foods', color: 'text-green-400' },
        { status: 'Good Balance', description: 'Healthy eating patterns with minor gaps', color: 'text-blue-400' },
        { status: 'Needs Improvement', description: 'Imbalanced macros or nutrient deficiencies', color: 'text-yellow-400' },
        { status: 'Poor Nutrition', description: 'Significant nutritional imbalances', color: 'text-red-400' }
      ],
      mockData: {
        calories: 2150,
        protein: 128,
        carbs: 245,
        fat: 78,
        quality: 'Good'
      }
    },
    {
      id: 'fitness-story',
      title: 'Cardio Fitness',
      subtitle: 'VO₂ Max & Endurance',
      icon: <SparklesIcon className="w-8 h-8" />,
      color: 'from-cyan-500 to-blue-500',
      glowColor: 'cyan-500/20',
      borderColor: 'cyan-500/40',
      description: 'Track your cardiovascular fitness level and endurance capacity through VO₂ max analysis.',
      insights: [
        'VO₂ max trending analysis',
        'Fitness level classification',
        'Endurance capacity assessment',
        'Training zone optimization'
      ],
      outcomes: [
        { status: 'Excellent', description: 'Superior cardiovascular fitness for your age', color: 'text-green-400' },
        { status: 'Good', description: 'Above average fitness with room to improve', color: 'text-blue-400' },
        { status: 'Fair', description: 'Average fitness level for your demographic', color: 'text-yellow-400' },
        { status: 'Poor', description: 'Below average, focus on cardio improvement', color: 'text-red-400' }
      ],
      mockData: {
        vo2Max: 48.2,
        fitnessLevel: 'Good',
        trend: 'Stable',
        percentile: 72
      }
    }
  ];

  const features = [
    {
      icon: <SparklesIcon className="w-6 h-6" />,
      title: 'AI-Powered Insights',
      description: 'Advanced algorithms analyze your health data to provide personalized insights and recommendations.'
    },
    {
      icon: <ChartBarIcon className="w-6 h-6" />,
      title: 'Comprehensive Analysis',
      description: 'Track 6 key health domains with detailed breakdowns and trend analysis over time.'
    },
    {
      icon: <HeartIcon className="w-6 h-6" />,
      title: 'Holistic Health View',
      description: 'See how all your health metrics connect and influence each other for complete wellness understanding.'
    },
    {
      icon: <BoltIcon className="w-6 h-6" />,
      title: 'Real-time Updates',
      description: 'Get instant updates as new health data syncs from your Apple Watch and other devices.'
    }
  ];

  return (
    <>
      <Head>
        <title>Health Data Stories - Transform Your Health Data Into Actionable Insights | Pulse</title>
        <meta name="description" content="Discover how Pulse transforms your health data into compelling stories with AI-powered insights. Track energy, movement, sleep, heart health, nutrition, and fitness with beautiful visualizations." />
        <meta name="keywords" content="health data analysis, fitness tracking, health insights, wellness stories, health analytics, fitness data visualization" />
        <meta property="og:title" content="Health Data Stories - Transform Your Health Data Into Actionable Insights" />
        <meta property="og:description" content="Turn your health data into compelling stories with AI-powered insights and beautiful visualizations." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            style={{ y, opacity }}
            className="absolute inset-0"
          >
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"></div>
            <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          </motion.div>
        </div>

        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              {/* Badge */}
              <div className="inline-flex items-center space-x-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-6 py-3">
                <SparklesIcon className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">AI-POWERED HEALTH INSIGHTS</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                <span className="block">Transform Your</span>
                <span className="block bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Health Data
                </span>
                <span className="block">Into Stories</span>
              </h1>

              {/* Subtitle */}
              <p className="max-w-3xl mx-auto text-xl sm:text-2xl text-gray-300 leading-relaxed">
                Discover the narrative hidden in your health data. Pulse transforms complex metrics into 
                compelling stories that guide your wellness journey with AI-powered insights.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl font-semibold text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-300"
                >
                  <span className="flex items-center space-x-2">
                    <span>Explore Your Health Story</span>
                    <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group flex items-center space-x-2 px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl font-semibold text-white hover:bg-white/10 transition-all duration-300"
                >
                  <PlayIcon className="w-5 h-5" />
                  <span>Watch Demo</span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Overview */}
        <section className="relative py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                Why Health Data Stories?
              </h2>
              <p className="max-w-3xl mx-auto text-xl text-gray-300">
                Your health data tells a story. We help you understand it with beautiful visualizations 
                and AI-powered insights that make complex health metrics simple and actionable.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group relative p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl hover:bg-white/10 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-400 rounded-2xl flex items-center justify-center mb-6">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold mb-4">{feature.title}</h3>
                    <p className="text-gray-300">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Health Stories Showcase */}
        <section className="relative py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                Six Health Stories, One Complete Picture
              </h2>
              <p className="max-w-3xl mx-auto text-xl text-gray-300">
                Each story provides deep insights into different aspects of your health, 
                with personalized recommendations and beautiful visualizations.
              </p>
            </motion.div>

            {/* Story Navigation */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {healthStories.map((story, index) => (
                <motion.button
                  key={story.id}
                  onClick={() => setActiveStory(index)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center space-x-3 px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                    activeStory === index
                      ? `bg-gradient-to-r ${story.color} text-white shadow-lg`
                      : 'bg-white/5 backdrop-blur-sm border border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {story.icon}
                  <span>{story.title}</span>
                </motion.button>
              ))}
            </div>

            {/* Active Story Display */}
            <motion.div
              key={activeStory}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              {/* Story Info */}
              <div className="space-y-8">
                <div>
                  <div className={`inline-flex items-center space-x-3 p-4 bg-gradient-to-r ${healthStories[activeStory].color} rounded-2xl mb-6`}>
                    {healthStories[activeStory].icon}
                    <div>
                      <h3 className="text-2xl font-bold">{healthStories[activeStory].title}</h3>
                      <p className="text-white/80">{healthStories[activeStory].subtitle}</p>
                    </div>
                  </div>
                  <p className="text-lg text-gray-300 leading-relaxed">
                    {healthStories[activeStory].description}
                  </p>
                </div>

                {/* Insights */}
                <div>
                  <h4 className="text-xl font-semibold mb-4">Key Insights</h4>
                  <div className="space-y-3">
                    {healthStories[activeStory].insights.map((insight, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <CheckIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Possible Outcomes */}
                <div>
                  <h4 className="text-xl font-semibold mb-4">Possible Outcomes</h4>
                  <div className="space-y-3">
                    {healthStories[activeStory].outcomes.map((outcome, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className={`w-3 h-3 rounded-full ${outcome.color.replace('text-', 'bg-')} mt-2 flex-shrink-0`}></div>
                        <div>
                          <span className={`font-semibold ${outcome.color}`}>{outcome.status}:</span>
                          <span className="text-gray-300 ml-2">{outcome.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mock Health Card */}
              <div className="relative">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className={`relative p-8 bg-white/5 backdrop-blur-sm border border-${healthStories[activeStory].borderColor} rounded-3xl shadow-2xl`}
                >
                  {/* Glow Effect */}
                  <div className={`absolute inset-0 bg-gradient-to-br from-${healthStories[activeStory].glowColor} to-transparent rounded-3xl blur-xl opacity-50`}></div>
                  
                  <div className="relative">
                    {/* Card Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className={`p-3 bg-gradient-to-r ${healthStories[activeStory].color} rounded-2xl`}>
                          {healthStories[activeStory].icon}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{healthStories[activeStory].title}</h3>
                          <p className="text-gray-400">{healthStories[activeStory].subtitle}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 bg-${healthStories[activeStory].borderColor} rounded-full`}>
                        <span className="text-sm font-medium">Today</span>
                      </div>
                    </div>

                    {/* Mock Data Display */}
                    <div className="space-y-6">
                      {/* Energy Balance Story */}
                      {activeStory === 0 && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-green-500/20">
                              <p className="text-sm text-gray-400">Calories In</p>
                              <p className="text-2xl font-bold text-green-400">{healthStories[activeStory].mockData.caloriesIn}</p>
                            </div>
                            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-orange-500/20">
                              <p className="text-sm text-gray-400">Calories Out</p>
                              <p className="text-2xl font-bold text-orange-400">{healthStories[activeStory].mockData.caloriesOut}</p>
                            </div>
                          </div>
                          <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-blue-500/20">
                            <p className="text-sm text-gray-400">Net Balance</p>
                            <p className="text-xl font-bold text-blue-400">{healthStories[activeStory].mockData.netCalories} kcal</p>
                            <p className="text-sm text-gray-300">{healthStories[activeStory].mockData.status}</p>
                          </div>
                        </div>
                      )}

                      {/* Movement Story */}
                      {activeStory === 1 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Steps Today</span>
                            <span className="text-2xl font-bold">{healthStories[activeStory].mockData.steps?.toLocaleString() || '0'}</span>
                          </div>
                          <div className="w-full bg-gray-700/50 rounded-full h-4 backdrop-blur-sm">
                            <div 
                              className={`h-4 bg-gradient-to-r ${healthStories[activeStory].color} rounded-full shadow-lg`}
                              style={{ width: `${Math.min(healthStories[activeStory].mockData.progress || 0, 100)}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-sm text-gray-400">
                            <span>Goal: {healthStories[activeStory].mockData.goal?.toLocaleString() || '0'}</span>
                            <span>{healthStories[activeStory].mockData.progress || 0}%</span>
                          </div>
                          <div className="flex space-x-2">
                            {healthStories[activeStory].mockData.achievements?.map((achievement, idx) => (
                              <div key={idx} className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-xs text-green-400">
                                🏆 {achievement}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sleep Story */}
                      {activeStory === 2 && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-purple-500/20">
                              <p className="text-sm text-gray-400">Duration</p>
                              <p className="text-2xl font-bold text-purple-400">{healthStories[activeStory].mockData.duration}</p>
                            </div>
                            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-blue-500/20">
                              <p className="text-sm text-gray-400">Efficiency</p>
                              <p className="text-2xl font-bold text-blue-400">{healthStories[activeStory].mockData.efficiency}%</p>
                              <div className="w-full bg-gray-700/50 rounded-full h-2 mt-2">
                                <div 
                                  className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-800 ease-out"
                                  style={{ width: `${healthStories[activeStory].mockData.efficiency}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Deep Sleep</span>
                              <span className="text-sm font-semibold text-indigo-400">{healthStories[activeStory].mockData.deepSleep || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-700/50 rounded-full h-2">
                              <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${healthStories[activeStory].mockData.deepSleep || 0}%` }}></div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">REM Sleep</span>
                              <span className="text-sm font-semibold text-purple-400">{healthStories[activeStory].mockData.remSleep || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-700/50 rounded-full h-2">
                              <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${healthStories[activeStory].mockData.remSleep || 0}%` }}></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Heart Story */}
                      {activeStory === 3 && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-red-500/20">
                              <p className="text-sm text-gray-400">Avg HRV</p>
                              <p className="text-2xl font-bold text-red-400">{healthStories[activeStory].mockData.avgHRV} ms</p>
                            </div>
                            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-pink-500/20">
                              <p className="text-sm text-gray-400">Recovery</p>
                              <p className="text-2xl font-bold text-pink-400">{healthStories[activeStory].mockData.recoveryScore}/100</p>
                            </div>
                          </div>
                          <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-green-500/20">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Trend</span>
                              <span className="text-sm font-semibold text-green-400 flex items-center">
                                ↗️ {healthStories[activeStory].mockData.trend}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 mt-2">Resting HR: {healthStories[activeStory].mockData.restingHR} bpm</p>
                          </div>
                        </div>
                      )}

                      {/* Nutrition Story */}
                      {activeStory === 4 && (
                        <div className="space-y-4">
                          <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-yellow-500/20">
                            <p className="text-sm text-gray-400">Total Calories</p>
                            <p className="text-2xl font-bold text-yellow-400">{healthStories[activeStory].mockData.calories}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-orange-500/20 text-center">
                              <p className="text-xs text-gray-400">Protein</p>
                              <p className="text-lg font-bold text-orange-400">{healthStories[activeStory].mockData.protein}g</p>
                            </div>
                            <div className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-blue-500/20 text-center">
                              <p className="text-xs text-gray-400">Carbs</p>
                              <p className="text-lg font-bold text-blue-400">{healthStories[activeStory].mockData.carbs}g</p>
                            </div>
                            <div className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-green-500/20 text-center">
                              <p className="text-xs text-gray-400">Fat</p>
                              <p className="text-lg font-bold text-green-400">{healthStories[activeStory].mockData.fat}g</p>
                            </div>
                          </div>
                          <div className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-emerald-500/20">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Quality Score</span>
                              <span className="text-sm font-semibold text-emerald-400">{healthStories[activeStory].mockData.quality}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Fitness Story */}
                      {activeStory === 5 && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-cyan-500/20">
                              <p className="text-sm text-gray-400">VO₂ Max</p>
                              <p className="text-2xl font-bold text-cyan-400">{healthStories[activeStory].mockData.vo2Max}</p>
                            </div>
                            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-blue-500/20">
                              <p className="text-sm text-gray-400">Fitness Level</p>
                              <p className="text-lg font-bold text-blue-400">{healthStories[activeStory].mockData.fitnessLevel}</p>
                            </div>
                          </div>
                          <div className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-green-500/20">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-400">Percentile</span>
                              <span className="text-sm font-semibold text-green-400">{healthStories[activeStory].mockData.percentile}th</span>
                            </div>
                            <div className="w-full bg-gray-700/50 rounded-full h-3">
                              <div className="h-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${healthStories[activeStory].mockData.percentile}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Trend: {healthStories[activeStory].mockData.trend}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Insight */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl">
                      <div className="flex items-start space-x-3">
                        <SparklesIcon className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-purple-400 mb-1">AI Insight</p>
                          <p className="text-sm text-gray-300">
                            Your {healthStories[activeStory].title.toLowerCase()} shows positive trends. 
                            Continue your current approach for optimal results.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <h2 className="text-4xl sm:text-5xl font-bold">
                Ready to Discover Your Health Story?
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Join thousands of users who have transformed their health journey with 
                AI-powered insights and beautiful data storytelling.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl font-semibold text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-300"
                >
                  Download Pulse App
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl font-semibold text-white hover:bg-white/10 transition-all duration-300"
                >
                  Learn More
                </motion.button>
              </div>

              {/* App Store Badges */}
              <div className="flex items-center justify-center space-x-4 pt-8">
                <div className="text-sm text-gray-400">Available on</div>
                <div className="flex space-x-4">
                  <div className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                    <span className="text-sm font-medium">App Store</span>
                  </div>
                  <div className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                    <span className="text-sm font-medium">Coming Soon</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default HealthDataStories; 