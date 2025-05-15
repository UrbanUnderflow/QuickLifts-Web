import React, { useState, useEffect, useRef } from 'react';
import { Check, Dumbbell, Layers, Timer, Loader2, Zap, Send, ArrowRight, Users, MessageCircle } from 'lucide-react';
import Head from 'next/head';
import FAQ from '../components/FAQ';
import Meta from '../components/Meta';
import { userService } from '../api/firebase/user';
import { useUser } from '../hooks/useUser';


const CREATOR_STEPS = [
  {
    title: "Account Creation",
    description: "Start your creator journey by setting up your profile. A complete profile helps build trust with your community and showcases your fitness expertise. Take time to craft a bio that highlights your unique perspective and training style.",
    detailedSteps: [
      "Download the app",
      "Sign up using your email or sign in with apple'",
      "Upload a profile image",
    ],
    image: "/step1Mobile.png",
    mobileImage: "/step1Mobile.png"
  },
  {
    title: "Set Up Your Profile",
    description: "Make your profile stand out by sharing your fitness story. Whether you're a certified trainer or passionate enthusiast, your unique perspective matters. Connect your social media to expand your reach and let people know where to find more of your content.",
    detailedSteps: [
      "Fill out profile description",
      "Add social media handles",
    ],
    image: "/step2Mobile.png",
    mobileImage: "/step2Mobile.png"
  },
  {
    title: "Upload Your First Content",
    description: "Time to share your expertise! Create your first Move by recording an exercise, combine Moves into a Stack for a complete workout, and organize your Stacks into a Round for a full training program. Each piece of content you create helps others on their fitness journey.",
    detailedSteps: [
      "Record or upload your first move",
      "Create your first 'Stack'",
      "Create a 'Round'"
    ],
    image: "/step3Mobile.png",
    mobileImage: "/step3Mobile.png"
  },
  {
    title: "Start a workout",
    description: "Experience Pulse from your community's perspective. Try out your own workout or join someone else's Round. This helps you understand the user experience and creates authentic content that resonates with your audience.",
    detailedSteps: [
      "Start and complete your first workout",
      "Join a 'Round'",
    ],
    image: "/step4Mobile.png",
    mobileImage: "/step4Mobile.png"
  }
];

const FAQ_DATA = [
  {
    question: "How do I earn through Pulse?",
    answer: "Your earnings grow with your community impact. Get rewarded for Stack completions, Round participation, and community engagement. The more value you create, the more you earn."
  },
  {
    question: "What makes a successful Round?",
    answer: "Great Rounds combine engaging workouts with active community participation. Focus on consistent interaction, clear instructions, and celebrating member progress."
  },
  {
    question: "How often should I create content?",
    answer: "Quality beats quantity. We recommend 2-3 new Moves or Stacks weekly, but focus on creating value for your community rather than hitting specific numbers."
  },
  {
    question: "Do I need special equipment to create content?",
    answer: "Just your smartphone! While professional equipment can enhance quality, many successful creators start with just their phones and natural lighting."
  },
  {
    question: "What is the Founding 100 Coaches Program?",
    answer: "It's our exclusive early access program for the first 100 fitness professionals on our platform. Members receive lifetime free access to Pulse, direct support from our team, and recognition as founding creators of our community."
  }
];

const CreatorChecklist = () => {
  const currentUser = useUser();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [wasFormSubmitted, setWasFormSubmitted] = useState(false);
  const formFilledRef = useRef(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: {
      trainer: false,
      enthusiast: false,
      coach: false,
      fitnessInstructor: false
    },
    primaryUse: '',
    useCases: {
      oneOnOneCoaching: false,
      communityRounds: false,
      personalPrograms: false
    },
    clientCount: '',
    yearsExperience: '',
    longTermGoal: '',
    isCertified: false,
    certificationName: '',
    applyForFoundingCoaches: true // Default to true since this is the founding coaches application
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const siteUrl = 'https://fitwithpulse.ai';
  const pageUrl = `${siteUrl}/starter-pack`;
  const title = 'Founding 100 Coaches Program | Pulse';
  const description = 'Apply to join Pulse\'s exclusive Founding 100 Coaches Program. Get lifetime free access to our platform and shape the future of fitness training.';

  // Pre-fill form with user data once on mount
  useEffect(() => {
    // Only update if we have a user and haven't filled the form yet
    if (currentUser && !formFilledRef.current) {
      formFilledRef.current = true;
      setFormData(prev => ({
        ...prev,
        name: currentUser.displayName || '',
        email: currentUser.email || ''
      }));
    }
  }, [currentUser]); // Depend on currentUser to ensure it's loaded

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCheckboxChange = (category: 'role' | 'useCases', name: string) => {
    setFormData(prev => {
      if (category === 'role') {
        return {
          ...prev,
          role: {
            ...prev.role,
            [name]: !prev.role[name as keyof typeof prev.role]
          }
        };
      } else {
        return {
          ...prev,
          useCases: {
            ...prev.useCases,
            [name]: !prev.useCases[name as keyof typeof prev.useCases]
          }
        };
      }
    });
  };
  
  const handleRadioChange = (name: string, value: boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleViewGuide = () => {
    setSubmitSuccess(true);
    setWasFormSubmitted(false);
  };
  
  const handleReturnToForm = () => {
    setSubmitSuccess(false);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      // Validate form
      if (!formData.name || !formData.email) {
        throw new Error('Name and email are required');
      }
      
      if (!formData.email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      
      // Roles validation - at least one role should be selected
      const hasRole = Object.values(formData.role).some(val => val);
      if (!hasRole) {
        throw new Error('Please select at least one role');
      }
      
      // Ensure applyForFoundingCoaches is true for the starter-pack page
      const submissionData = {
        ...formData,
        applyForFoundingCoaches: true // Always force to true for this page
      };
      
      // Submit to Firebase
      const result = await userService.saveApplicationForm(submissionData);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to submit application');
      }
      
      // Success!
      setSubmitSuccess(true);
      setWasFormSubmitted(true);
      
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>

      <Meta title={title} description={description} url={pageUrl} />

      {submitSuccess ? (
        // Success view with getting started guide
        <>
          <div className="bg-[#E0FE10]/10 border-l-4 border-[#E0FE10] p-4 mx-4 md:mx-auto max-w-5xl mt-8">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg mb-1">
                  {wasFormSubmitted 
                    ? "Application Submitted Successfully!" 
                    : "Getting Started Guide"
                  }
                </h3>
                <p className="text-zinc-300">
                  {wasFormSubmitted 
                    ? "Thank you for applying to the Founding 100 Coaches Program. We'll review your application and get back to you shortly. In the meantime, here's how to get started with Pulse once you're approved."
                    : "This guide will help you get started with setting up your Pulse account and creating your first content. Follow these steps to make the most of your fitness journey with Pulse."
                  }
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleReturnToForm}
                  className="text-zinc-400 hover:text-white text-sm whitespace-nowrap"
                >
                  Return to form
                </button>
              </div>
            </div>
          </div>

          {/* Hero Section */}
          <section className="min-h-[80vh] py-20 text-center flex flex-col items-center justify-center">
            <div className="max-w-3xl mx-auto px-4 space-y-12">
              {/* App Introduction */}
              <div>
                <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                  Founding 100 Coaches Program
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
                </h2>
                <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8">
                  Welcome to <span className="text-[#E0FE10]">Pulse</span>
                </h1>
                <p className="text-zinc-400 text-xl leading-relaxed">
                  {wasFormSubmitted 
                    ? "Once approved, you'll be part of our Founding 100 Coaches Program! This guide will help you get started with setting up your account and creating your first content. As a founding coach, you'll enjoy "
                    : "Interested in joining our exclusive Founding 100 Coaches Program? Apply through the form to gain lifetime free access to Pulse's premium features. This guide will help you understand how to "
                  }
                  <strong className="text-white">Lifetime Free Membership</strong> to the platform. Start building your community and impact today!
                </p>
              </div>

              {/* Download App */}
              <a 
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-zinc-800 text-white px-8 py-4 rounded-full font-semibold hover:bg-zinc-700 transition-all border border-[#E0FE10]/30 hover:border-[#E0FE10] hover:shadow-lg hover:shadow-[#E0FE10]/10"
              >
                Download Pulse
                <span className="text-[#E0FE10]">→</span>
              </a>

              {/* Learning Path Introduction */}
              <div className="max-w-2xl mx-auto">
                <h2 className="text-white text-2xl sm:text-3xl font-bold mb-4">
                  Let's Get You Started
                </h2>
                <p className="text-zinc-400 text-lg">
                  Before diving into the setup process, familiarize yourself with our core features below. Understanding Moves, Stacks, and Rounds will help you make the most of your creator journey.
                </p>
              </div>

              {/* Arrow indicator */}
              <div className="flex justify-center">
                <svg 
                  className="w-6 h-6 text-[#E0FE10] animate-bounce" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 14l-7 7m0 0l-7-7m7 7V3" 
                  />
                </svg>
              </div>
            </div>
          </section>

          {/* Interactive Feature Tiles */}
          <section className="py-20 bg-zinc-950">
            <div className="max-w-5xl mx-auto px-4 mb-20">
              <h2 className="text-center text-white text-3xl font-bold mb-16">The Pulse Ecosystem</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <a 
                  href="/moves" 
                  className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all cursor-pointer hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10] transform hover:-translate-y-1 duration-300"
                >
                  <div className="relative z-10">
                    <h3 className="text-[#E0FE10] text-2xl font-bold mb-3">Moves</h3>
                    <p className="text-zinc-400 mb-4">The building blocks of your workout. Record and save exercises to create custom Stacks.</p>
                    <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                      Learn about Moves
                      <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Dumbbell className="w-8 h-8 text-[#E0FE10] opacity-40" />
                  </div>
                </a>

                <a 
                  href="/stacks" 
                  className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all cursor-pointer hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10]/70 transform hover:-translate-y-1 duration-300"
                >
                  <div className="relative z-10">
                    <h3 className="text-[#E0FE10]/70 text-2xl font-bold mb-3">Stacks</h3>
                    <p className="text-zinc-400 mb-4">Stack your Moves to build a complete workout. Create the perfect training session for any goal.</p>
                    <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                      Learn about Stacks
                      <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Layers className="w-8 h-8 text-[#E0FE10]/70 opacity-40" />
                  </div>
                </a>

                <a 
                  href="/rounds" 
                  className="group relative overflow-hidden bg-zinc-900/80 rounded-xl p-6 transition-all cursor-pointer hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#E0FE10]/10 border border-[#E0FE10]/40 transform hover:-translate-y-1 duration-300"
                >
                  <div className="relative z-10">
                    <h3 className="text-[#E0FE10]/40 text-2xl font-bold mb-3">Rounds</h3>
                    <p className="text-zinc-400 mb-4">Join the Round. Time-bound training programs where your community trains together or at their own pace.</p>
                    <span className="text-zinc-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
                      Learn about Rounds
                      <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Timer className="w-8 h-8 text-[#E0FE10]/40 opacity-40" />
                  </div>
                </a>
              </div>
            </div>
          </section>

          {/* Steps Section */}
          <section className="py-20 bg-black">
            <div className="max-w-6xl mx-auto px-4 mb-16">
              <h2 className="text-center text-white text-4xl font-bold mb-16">Getting Started</h2>
              <div className="grid gap-16">
                {CREATOR_STEPS.map((step, index) => (
                  <div key={index} className="relative bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 hover:bg-zinc-900 transition-all duration-300 group">
                    <div className="flex flex-col md:flex-row items-start gap-8">
                      <div className="w-full md:w-1/2">
                        <div className="bg-zinc-800/50 rounded-xl p-4 group-hover:shadow-lg group-hover:shadow-[#E0FE10]/5 transition-all duration-300">
                          <img 
                            src={step.image}
                            alt={step.title}
                            className="hidden md:block w-full h-auto rounded-lg"
                          />
                          <img 
                            src={step.mobileImage}
                            alt={step.title}
                            className="md:hidden w-full h-auto rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="w-full md:w-1/2 space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#E0FE10]/10 text-[#E0FE10] font-semibold border border-[#E0FE10]/20 group-hover:bg-[#E0FE10]/20 transition-colors duration-300">
                            {index + 1}
                          </div>
                          <h3 className="text-2xl sm:text-3xl text-white font-bold group-hover:text-[#E0FE10] transition-colors duration-300">
                            {step.title}
                          </h3>
                        </div>
                        
                        <p className="text-lg text-zinc-400">
                          {step.description}
                        </p>

                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-zinc-300">Quick Steps:</h4>
                          {step.detailedSteps.map((detailStep, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10]/40"></div>
                              <p className="text-sm text-zinc-400">{detailStep}</p>
                            </div>
                          ))}
                        </div>
                        
                        <button
                          onClick={() => {
                            if (completedSteps.includes(index)) {
                              setCompletedSteps(completedSteps.filter(s => s !== index));
                            } else {
                              setCompletedSteps([...completedSteps, index]);
                            }
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                            completedSteps.includes(index)
                              ? 'bg-[#E0FE10]/20 text-[#E0FE10] border border-[#E0FE10]/40'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          {completedSteps.includes(index) ? 'Completed' : 'Mark Complete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="bg-zinc-900 py-20">
            <div className="max-w-4xl mx-auto px-4 mb-16">
              <FAQ title="Common Questions" items={FAQ_DATA} theme="dark" />
              
              {!wasFormSubmitted && (
                <div className="mt-10 text-center">
                  <button
                    onClick={handleReturnToForm}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 border border-zinc-700 transition-colors"
                  >
                    <span>Return to Application Form</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        // Application Form
        <div className="min-h-screen py-16">
          <div className="max-w-4xl mx-auto px-4">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
                Exclusive Opportunity
              </h2>
              <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
                Join the Founding 100 Coaches
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl mx-auto">
                Apply to be part of our exclusive founding group of fitness professionals. As a Founding Coach, you'll receive <span className="text-white font-semibold">lifetime free access</span> to Pulse's premium features and direct support from our team.
              </p>
            </div>

            {/* Benefits Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700/50 hover:border-[#E0FE10]/20 transition-colors">
                <div className="bg-[#E0FE10]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-[#E0FE10]" />
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">Lifetime Free Access</h3>
                <p className="text-zinc-400">
                  Never pay for platform fees, even as we roll out premium features in the future
                </p>
              </div>

              <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700/50 hover:border-[#E0FE10]/20 transition-colors">
                <div className="bg-[#E0FE10]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-[#E0FE10]" />
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">Featured Promotion</h3>
                <p className="text-zinc-400">
                  Get highlighted as a founding creator and featured in our promotional materials
                </p>
              </div>

              <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700/50 hover:border-[#E0FE10]/20 transition-colors">
                <div className="bg-[#E0FE10]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <MessageCircle className="h-6 w-6 text-[#E0FE10]" />
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">Direct Support</h3>
                <p className="text-zinc-400">
                  Get direct access to our team for support, feature requests, and growth strategy
                </p>
              </div>
            </div>

            {/* Application Form */}
            <div className="bg-zinc-800 rounded-xl p-8 border border-zinc-700">
              <h2 className="text-2xl font-bold text-white mb-6">Apply for the Founding 100 Coaches Program</h2>
              
              {submitError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-6">
                  {submitError}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-zinc-700 pb-2">Basic Information</h3>
                  
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-zinc-400 mb-1">Full Name *</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all"
                      placeholder="Your name"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1">Email Address *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                
                {/* Role & Use Case */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-zinc-700 pb-2">Your Role & Use Case</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Which best describes you? (Select all that apply)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                        <input 
                          type="checkbox" 
                          checked={formData.role.trainer}
                          onChange={() => handleCheckboxChange('role', 'trainer')}
                          className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                        />
                        <span className="ml-3 text-white">Personal Trainer</span>
                      </label>
                      
                      <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                        <input 
                          type="checkbox" 
                          checked={formData.role.enthusiast}
                          onChange={() => handleCheckboxChange('role', 'enthusiast')}
                          className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                        />
                        <span className="ml-3 text-white">Fitness Enthusiast</span>
                      </label>
                      
                      <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                        <input 
                          type="checkbox" 
                          checked={formData.role.coach}
                          onChange={() => handleCheckboxChange('role', 'coach')}
                          className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                        />
                        <span className="ml-3 text-white">Coach</span>
                      </label>
                      
                      <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                        <input 
                          type="checkbox" 
                          checked={formData.role.fitnessInstructor}
                          onChange={() => handleCheckboxChange('role', 'fitnessInstructor')}
                          className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                        />
                        <span className="ml-3 text-white">Fitness Instructor</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="primaryUse" className="block text-sm font-medium text-zinc-400 mb-1">How do you plan to use Pulse with your clients or community?</label>
                    <textarea
                      id="primaryUse"
                      name="primaryUse"
                      value={formData.primaryUse}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
                      placeholder="Describe how you plan to use our platform..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Which use cases are you most interested in? (Select all that apply)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                        <input 
                          type="checkbox" 
                          checked={formData.useCases.oneOnOneCoaching}
                          onChange={() => handleCheckboxChange('useCases', 'oneOnOneCoaching')}
                          className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                        />
                        <span className="ml-3 text-white">One-on-one coaching</span>
                      </label>
                      
                      <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                        <input 
                          type="checkbox" 
                          checked={formData.useCases.communityRounds}
                          onChange={() => handleCheckboxChange('useCases', 'communityRounds')}
                          className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                        />
                        <span className="ml-3 text-white">Community Rounds</span>
                      </label>
                      
                      <label className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors border border-zinc-700">
                        <input 
                          type="checkbox" 
                          checked={formData.useCases.personalPrograms}
                          onChange={() => handleCheckboxChange('useCases', 'personalPrograms')}
                          className="form-checkbox h-5 w-5 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded"
                        />
                        <span className="ml-3 text-white">Personal programs</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* Professional Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-zinc-700 pb-2">Professional Information</h3>
                  
                  <div>
                    <label htmlFor="clientCount" className="block text-sm font-medium text-zinc-400 mb-1">How many clients do you currently have?</label>
                    <select
                      id="clientCount"
                      name="clientCount"
                      value={formData.clientCount}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white focus:border-[#E0FE10] focus:outline-none transition-all"
                    >
                      <option value="">Select an option</option>
                      <option value="0">0 (None yet)</option>
                      <option value="1-5">1-5 clients</option>
                      <option value="6-10">6-10 clients</option>
                      <option value="11-20">11-20 clients</option>
                      <option value="21-50">21-50 clients</option>
                      <option value="50+">More than 50 clients</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="yearsExperience" className="block text-sm font-medium text-zinc-400 mb-1">How many years of training experience do you have?</label>
                    <select
                      id="yearsExperience"
                      name="yearsExperience"
                      value={formData.yearsExperience}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white focus:border-[#E0FE10] focus:outline-none transition-all"
                    >
                      <option value="">Select an option</option>
                      <option value="<1">Less than 1 year</option>
                      <option value="1-2">1-2 years</option>
                      <option value="3-5">3-5 years</option>
                      <option value="6-10">6-10 years</option>
                      <option value="10+">More than 10 years</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="longTermGoal" className="block text-sm font-medium text-zinc-400 mb-1">What are your long-term goals as a fitness professional?</label>
                    <textarea
                      id="longTermGoal"
                      name="longTermGoal"
                      value={formData.longTermGoal}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
                      placeholder="Describe your long-term professional goals..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Are you certified? (FYI, this is not required)</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input 
                          type="radio" 
                          checked={formData.isCertified === true}
                          onChange={() => handleRadioChange('isCertified', true)}
                          className="form-radio h-5 w-5 text-[#E0FE10]"
                        />
                        <span className="ml-2 text-white">Yes</span>
                      </label>
                      
                      <label className="flex items-center">
                        <input 
                          type="radio" 
                          checked={formData.isCertified === false}
                          onChange={() => handleRadioChange('isCertified', false)}
                          className="form-radio h-5 w-5 text-[#E0FE10]"
                        />
                        <span className="ml-2 text-white">No</span>
                      </label>
                    </div>
                  </div>

                  {formData.isCertified && (
                    <div className="pl-6 border-l-2 border-[#E0FE10]/30">
                      <label htmlFor="certificationName" className="block text-sm font-medium text-zinc-400 mb-1">Which certification(s) do you have?</label>
                      <input
                        type="text"
                        id="certificationName"
                        name="certificationName"
                        value={formData.certificationName}
                        onChange={handleInputChange}
                        className="w-full p-3 bg-[#262a30] rounded-lg border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-all"
                        placeholder="E.g., NASM, ACE, ISSA, NSCA, etc."
                      />
                    </div>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-4 flex items-center justify-center gap-2 ${
                    isSubmitting ? 'bg-zinc-600' : 'bg-[#E0FE10] hover:bg-[#c5df0e] active:bg-[#a8be0c]'
                  } text-black rounded-lg font-semibold transition-colors`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Submit Application</span>
                    </>
                  )}
                </button>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={handleViewGuide}
                    className="text-[#E0FE10] hover:text-white transition-colors text-sm font-medium"
                  >
                    How to get started with the Pulse app →
                  </button>
                </div>
              </form>
            </div>

            {/* FAQ Section */}
            <div className="mt-16">
              <FAQ title="Common Questions About the Program" items={FAQ_DATA} theme="dark" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorChecklist;