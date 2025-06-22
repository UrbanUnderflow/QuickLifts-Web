import React, { useState, useEffect, useRef } from 'react';
import { Check, Dumbbell, Layers, Timer, Loader2, Zap, Send, ArrowRight, Users, MessageCircle, DollarSign, ExternalLink, Info, Gift, CalendarDays, Target, X } from 'lucide-react';
import Head from 'next/head';
import FAQ from '../components/FAQ';
import Meta from '../components/Meta';
import { userService } from '../api/firebase/user';
import { useUser } from '../hooks/useUser';
import { useRouter } from 'next/router';
import Footer from '../components/Footer/Footer';
import Header from '../components/Header';
import { GetServerSideProps } from 'next';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData } from '../api/firebase/admin/types';
import PageHead from '../components/PageHead';

// Define a serializable version of PageMetaData
interface SerializablePageMetaData extends Omit<PageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface HundredTrainersPageProps {
  metaData: SerializablePageMetaData | null;
}

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
          question: "What is the Founding 100 Trainers Program?",
    answer: "It's our exclusive early access program for the first 100 fitness professionals on our platform. Members receive lifetime free access to Pulse, direct support from our team, and recognition as founding creators of our community."
  }
];

type ViewState = 'landing' | 'form' | 'guide' | 'success';

const CreatorChecklist = ({ metaData }: HundredTrainersPageProps) => {
  const currentUser = useUser();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>('landing');
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

  const router = useRouter();
  const [showVideo, setShowVideo] = useState(false);

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

  useEffect(() => {
    // Potentially handle redirection or UI changes based on auth status
    if (!currentUser && router.pathname.startsWith('/app')) { // Example, adjust as needed
      // router.push('/login');
    }
  }, [currentUser, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear submitError when user starts typing
    if (submitError) {
      setSubmitError('');
    }
  };
  
  const handleCheckboxChange = (category: 'role' | 'useCases', name: string) => {
    setFormData(prev => {
      const newCategoryState = {
        ...prev[category],
        [name]: !prev[category][name as keyof typeof prev[typeof category]]
      };
      return {
        ...prev,
        [category]: newCategoryState
      };
    });
    // Clear submitError when user interacts with form
    if (submitError) {
      setSubmitError('');
    }
  };
  
  const handleRadioChange = (name: string, value: boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear submitError when user interacts with form
    if (submitError) {
      setSubmitError('');
    }
  };
  
  const handleViewGuide = () => {
    setCurrentView('guide');
  };
  
  const handleReturnToForm = () => {
    setCurrentView('form');
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
      
      const hasRole = Object.values(formData.role).some(val => val);
      if (!hasRole) {
        throw new Error('Please select at least one role');
      }
      
      const submissionData = {
        ...formData,
        applyForFoundingCoaches: true
      };
      
      const result = await userService.saveApplicationForm(submissionData);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to submit application');
      }
      
      setCurrentView('success');
      
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyClick = () => {
    setCurrentView('form');
    // Scroll to form section if needed, or ensure it's visible
    const formSection = document.getElementById('application-form-section');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isFormValid = () => {
    if (!formData.name || !formData.email || !formData.email.includes('@')) return false;
    return Object.values(formData.role).some(val => val);
  };
  

  const features = [
    { icon: <CalendarDays size={24} className="text-[#E0FE10]" />, title: 'Lifetime Free Pulse Creator Membership', description: 'In order to monetize your content in the future, you will be required to have a creator membership. All 100 members will be grandfathered into a free creator membership.' },
    { icon: <DollarSign size={24} className="text-[#E0FE10]" />, title: 'Monetization Tools', description: 'Unlock features to earn from your content and expertise.' },
    { icon: <Zap size={24} className="text-[#E0FE10]" />, title: 'Early Access to Features', description: 'Be the first to try new tools and shape their development.' },
    { icon: <Users size={24} className="text-[#E0FE10]" />, title: 'Founding Member Status', description: 'Exclusive badge and recognition within the Pulse community.' },
    { icon: <Check size={24} className="text-[#E0FE10]" />, title: 'Direct Support & Feedback Channels', description: 'Priority support and direct lines to the Pulse team.' },
    { icon: <Gift size={24} className="text-[#E0FE10]" />, title: 'Exclusive Founding Trainer Welcome Kit', description: 'Receive a special welcome package with Pulse merchandise and goodies.' },
    { icon: <Target size={24} className="text-[#E0FE10]" />, title: 'Featured Promotion & Spotlight Opportunities', description: 'Get your profile and content highlighted across Pulse platforms to boost your visibility.' },
  ];

  const applicationGuideContent = (
    <div className="bg-[#1c1c1c] p-8 rounded-xl shadow-2xl text-left max-w-3xl mx-auto my-12">
      <h2 className="text-3xl font-bold text-[#E0FE10] mb-6">Application Guide: Pulse Founding 100</h2>
              <p className="text-gray-300 mb-4">Welcome! We're thrilled you're considering joining our Founding 100 Trainers Program. This guide will help you through the application process.</p>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">1. Personal Information</h3>
          <p className="text-gray-400">Provide your full name and a valid email address. This helps us stay in touch.</p>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">2. Your Role</h3>
          <p className="text-gray-400">Select all roles that best describe you (e.g., Trainer, Enthusiast, Coach). This helps us understand your background.</p>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">3. Primary Use</h3>
          <p className="text-gray-400">Tell us how you primarily envision using Pulse. This gives us insight into your goals with the platform.</p>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">4. Use Cases</h3>
          <p className="text-gray-400">Select the ways you plan to use Pulse (e.g., 1-on-1 Coaching, Community Rounds). Be as specific as possible.</p>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">5. Experience & Goals (Optional but Recommended)</h3>
          <ul className="list-disc list-inside text-gray-400 pl-4">
            <li><strong>Client Count / Community Size:</strong> If applicable, estimate the number of clients or community members you engage with.</li>
            <li><strong>Years of Experience:</strong> How long have you been involved in fitness in your current capacity?</li>
            <li><strong>Long-Term Goal:</strong> What do you hope to achieve with Pulse in the long run?</li>
          </ul>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">6. Certification (Optional)</h3>
          <p className="text-gray-400">If you hold any fitness certifications, let us know. If yes, please provide the name of the certification.</p>
        </div>
      </div>

              <p className="text-gray-300 mt-8">Submitting this form confirms your interest in the Founding 100 Trainers Program. We review applications on a rolling basis.</p>
      <button
        onClick={handleReturnToForm}
        className="mt-8 w-full sm:w-auto flex items-center justify-center px-8 py-3 border border-transparent text-lg font-medium rounded-full text-black bg-[#E0FE10] hover:bg-opacity-80 transition-colors duration-300 ease-in-out"
      >
        Return to Application Form
      </button>
    </div>
  );

  return (
    <>
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/100trainers"
      />
      <div className="min-h-screen bg-gradient-to-br from-[#101010] to-[#18181b] text-white">
        <Header 
          onSectionChange={() => {}}
          currentSection="creator"
          toggleMobileMenu={() => {}}
          setIsSignInModalVisible={() => {}}
          theme="dark"
          hideNav={true}
        />
        <main className="pt-20 pb-16">
          <section className="py-16 md:py-24 text-center bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/hero-background-100t.jpg")' }}> {/* Ensure this image exists or use a bg color */}
            {currentView === 'landing' && <div className="absolute inset-0 bg-black/70"></div>} {/* Conditional Overlay */}
            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#E0FE10] to-green-400">
                Join the <span className="whitespace-nowrap">Pulse 100</span>
              </h1>
              <p className="mt-6 text-xl md:text-2xl text-gray-300 leading-relaxed">
                Become a Founding Trainer in a community that's reshaping fitness. We're looking for 100 passionate creators to pioneer the future with us.
              </p>
              {currentView === 'landing' && (
                <div className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-4">
                  <button 
                    onClick={handleApplyClick}
                    className="w-full sm:w-auto flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-full text-black bg-[#E0FE10] hover:bg-opacity-80 transition-transform duration-300 ease-in-out transform hover:scale-105 shadow-lg"
                  >
                    Apply to be a Founding Trainer <ArrowRight className="ml-3 h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => setShowVideo(true)}
                    className="w-full sm:w-auto flex items-center justify-center px-8 py-4 border border-[#E0FE10] text-lg font-medium rounded-full text-[#E0FE10] hover:bg-[#E0FE10] hover:text-black transition-colors duration-300 ease-in-out transform hover:scale-105 shadow-lg"
                  >
                    <Info className="mr-3 h-5 w-5" /> Learn More
                  </button>
                </div>
              )}
            </div>
          </section>

          {showVideo && (
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowVideo(false)}>
              <div className="relative aspect-video w-full max-w-4xl rounded-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <iframe 
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/your-video-id?autoplay=1&rel=0"  /* Replace your-video-id */
                  title="Pulse 100 Program Overview" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                ></iframe>
                <button onClick={() => setShowVideo(false)} className="absolute top-4 right-4 text-white hover:text-[#E0FE10] z-50">
                  <X size={32} />
                </button>
              </div>
            </div>
          )}
          
          {currentView === 'landing' && (
            <>
              <section className="py-16 md:py-24 bg-[#131313]">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-white">Why Join the <span className="text-[#E0FE10]">Pulse 100</span>?</h2>
                    <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">Exclusive benefits and a chance to be at the forefront of fitness innovation. Here's what you get as a Founding Trainer:</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                      <div key={index} className="bg-[#1c1c1c] p-8 rounded-xl shadow-2xl hover:shadow-[#E0FE10]/30 transition-all duration-300 transform hover:-translate-y-1">
                        <div className="flex items-center justify-center w-12 h-12 bg-[#2a2a2a] rounded-full mb-6">
                          {feature.icon}
                        </div>
                        <h3 className="text-2xl font-semibold text-white mb-3">{feature.title}</h3>
                        <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="py-16 md:py-24">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Make an Impact?</h2>
                  <p className="text-xl text-gray-300 mb-10">If you're a fitness creator who's passionate, innovative, and ready to build the future of fitness with us, we want to hear from you.</p>
                  <button 
                    onClick={handleApplyClick} // This button also triggers the form
                    className="flex items-center justify-center mx-auto px-10 py-5 border border-transparent text-xl font-medium rounded-full text-black bg-gradient-to-r from-[#E0FE10] to-green-400 hover:opacity-90 transition-transform duration-300 ease-in-out transform hover:scale-105 shadow-xl"
                  >
                    Apply Now & Shape the Future <ExternalLink className="ml-3 h-6 w-6" />
                  </button>
                </div>
              </section>
            </>
          )}

          {currentView === 'form' && (
            <section id="application-form-section" className="py-16 md:py-24 bg-[#131313] relative z-20">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                  <h2 className="text-4xl font-bold text-white">Application for Pulse Founding 100</h2>
                  <p className="mt-4 text-lg text-gray-400">We're excited to learn more about you!</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-8 bg-[#1c1c1c] p-8 rounded-xl shadow-2xl">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                    <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} required className="w-full bg-[#2a2a2a] border-gray-600 rounded-md p-3 text-white focus:ring-[#E0FE10] focus:border-[#E0FE10]" />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
                    <input type="email" name="email" id="email" value={formData.email} onChange={handleInputChange} required className="w-full bg-[#2a2a2a] border-gray-600 rounded-md p-3 text-white focus:ring-[#E0FE10] focus:border-[#E0FE10]" />
                  </div>

                  {/* Roles */}
                  <fieldset>
                    <legend className="text-sm font-medium text-gray-300 mb-2">Which role(s) best describe you? (Select all that apply)</legend>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.keys(formData.role).map((key) => (
                        <div key={key} className="flex items-center">
                          <input id={`role-${key}`} name={key} type="checkbox" checked={formData.role[key as keyof typeof formData.role]} onChange={() => handleCheckboxChange('role', key)} className="h-4 w-4 text-[#E0FE10] bg-gray-700 border-gray-600 rounded focus:ring-[#E0FE10]" />
                          <label htmlFor={`role-${key}`} className="ml-2 text-sm text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label htmlFor="primaryUse" className="block text-sm font-medium text-gray-300 mb-1">How do you primarily see yourself using Pulse?</label>
                    <textarea name="primaryUse" id="primaryUse" value={formData.primaryUse} onChange={handleInputChange} rows={3} className="w-full bg-[#2a2a2a] border-gray-600 rounded-md p-3 text-white focus:ring-[#E0FE10] focus:border-[#E0FE10]" placeholder="e.g., Share my workouts, build a fitness community, train clients..."></textarea>
                  </div>
                  
                  {/* Use Cases */}
                  <fieldset>
                    <legend className="text-sm font-medium text-gray-300 mb-2">Which of the following use cases are you interested in? (Select all that apply)</legend>
                    <div className="space-y-2">
                      {Object.keys(formData.useCases).map((key) => (
                        <div key={key} className="flex items-center">
                          <input id={`useCases-${key}`} name={key} type="checkbox" checked={formData.useCases[key as keyof typeof formData.useCases]} onChange={() => handleCheckboxChange('useCases', key)} className="h-4 w-4 text-[#E0FE10] bg-gray-700 border-gray-600 rounded focus:ring-[#E0FE10]" />
                          <label htmlFor={`useCases-${key}`} className="ml-2 text-sm text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label htmlFor="clientCount" className="block text-sm font-medium text-gray-300 mb-1">Roughly how many clients or community members do you currently engage with? (Optional)</label>
                    <select 
                      name="clientCount" 
                      id="clientCount" 
                      value={formData.clientCount} 
                      onChange={handleInputChange} 
                      className="w-full bg-[#2a2a2a] border-gray-600 rounded-md p-3 text-white focus:ring-[#E0FE10] focus:border-[#E0FE10]"
                    >
                      <option value="">Select a range</option>
                      <option value="0-10">0-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-100">51-100</option>
                      <option value="101-500">101-500</option>
                      <option value="501-1000">501-1000</option>
                      <option value="1000+">1000+</option>
                      <option value="Not applicable">Not applicable</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="yearsExperience" className="block text-sm font-medium text-gray-300 mb-1">Years of Experience in your primary role (Optional)</label>
                    <input type="text" name="yearsExperience" id="yearsExperience" value={formData.yearsExperience} onChange={handleInputChange} className="w-full bg-[#2a2a2a] border-gray-600 rounded-md p-3 text-white focus:ring-[#E0FE10] focus:border-[#E0FE10]" placeholder="e.g., 3 years as a PT" />
                  </div>
                  
                  <div>
                    <label htmlFor="longTermGoal" className="block text-sm font-medium text-gray-300 mb-1">What's your long-term goal with Pulse? (Optional)</label>
                    <textarea name="longTermGoal" id="longTermGoal" value={formData.longTermGoal} onChange={handleInputChange} rows={3} className="w-full bg-[#2a2a2a] border-gray-600 rounded-md p-3 text-white focus:ring-[#E0FE10] focus:border-[#E0FE10]" placeholder="e.g., Build a global fitness brand, help 1000 people achieve their goals..."></textarea>
                  </div>

                  {/* Certification */}
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-gray-300">Are you a certified fitness professional? (Optional)</legend>
                    <div className="flex items-center gap-x-4">
                      <div className="flex items-center">
                        <input id="isCertifiedYes" name="isCertified" type="radio" checked={formData.isCertified === true} onChange={() => handleRadioChange('isCertified', true)} className="h-4 w-4 text-[#E0FE10] border-gray-600 focus:ring-[#E0FE10]" />
                        <label htmlFor="isCertifiedYes" className="ml-2 block text-sm text-gray-300">Yes</label>
                      </div>
                      <div className="flex items-center">
                        <input id="isCertifiedNo" name="isCertified" type="radio" checked={formData.isCertified === false} onChange={() => handleRadioChange('isCertified', false)} className="h-4 w-4 text-[#E0FE10] border-gray-600 focus:ring-[#E0FE10]" />
                        <label htmlFor="isCertifiedNo" className="ml-2 block text-sm text-gray-300">No</label>
                      </div>
                    </div>
                    {formData.isCertified && (
                      <div>
                        <label htmlFor="certificationName" className="block text-sm font-medium text-gray-300 mt-2 mb-1">Name of Certification (Optional)</label>
                        <input type="text" name="certificationName" id="certificationName" value={formData.certificationName} onChange={handleInputChange} className="w-full bg-[#2a2a2a] border-gray-600 rounded-md p-3 text-white focus:ring-[#E0FE10] focus:border-[#E0FE10]" />
                      </div>
                    )}
                  </fieldset>
                  
                  {submitError && <p className="text-red-400 text-sm">{submitError}</p>}

                  <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4">
                    <button
                      type="button"
                      onClick={handleViewGuide}
                      className="w-full sm:w-auto px-6 py-3 border border-gray-600 rounded-full text-gray-300 hover:bg-gray-700 hover:text-white transition-colors duration-300"
                    >
                      View Application Guide
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentView('landing')}
                      className="w-full sm:w-auto px-6 py-3 border border-[#E0FE10] rounded-full text-[#E0FE10] hover:bg-[#E0FE10] hover:text-black transition-colors duration-300"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting || !isFormValid()}
                      className="w-full sm:w-auto flex items-center justify-center px-8 py-3 border border-transparent text-lg font-medium rounded-full text-black bg-[#E0FE10] hover:bg-opacity-80 transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                      {isSubmitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {currentView === 'guide' && (
            <section className="py-16 md:py-24 bg-[#131313] relative z-20">
              {applicationGuideContent}
            </section>
          )}

          {currentView === 'success' && (
            <section className="py-16 md:py-24 bg-[#131313] text-center relative z-20">
              <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-[#1c1c1c] p-8 sm:p-12 rounded-xl shadow-2xl">
                  <Check className="w-20 h-20 text-[#E0FE10] mx-auto mb-6 animate-pulse" />
                  <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Application Submitted!</h2>
                  <p className="text-lg text-gray-300 mb-8">Thank you for applying to the Pulse Founding 100 Trainers Program! We've received your application and will review it shortly. We'll be in touch via email with next steps.</p>
                  <p className="text-gray-400 text-sm mb-8">In the meantime, feel free to explore Pulse and start creating!</p>
                  <button
                    onClick={() => setCurrentView('landing')}
                    className="w-full sm:w-auto flex items-center justify-center mx-auto px-8 py-3 border border-transparent text-lg font-medium rounded-full text-black bg-[#E0FE10] hover:bg-opacity-80 transition-colors duration-300 ease-in-out"
                  >
                    Back to 100 Trainers Page
                  </button>
                </div>
              </div>
            </section>
          )}

        </main>
        <Footer />
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<HundredTrainersPageProps> = async (context) => {
  let rawMetaData: PageMetaData | null = null;
  try {
    // Fetch meta data for the '100trainers' page
    rawMetaData = await adminMethods.getPageMetaData('100trainers');
  } catch (error) {
    console.error("Error fetching page meta data for 100trainers:", error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;

  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      // Ensure lastUpdated is serializable, converting Timestamp to ISO string
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default CreatorChecklist;