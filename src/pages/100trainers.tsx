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

interface HundredTrainersPageProps {
  metaData: PageMetaData | null;
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
    question: "What is the Founding 100 Coaches Program?",
    answer: "It's our exclusive early access program for the first 100 fitness professionals on our platform. Members receive lifetime free access to Pulse, direct support from our team, and recognition as founding creators of our community."
  }
];

const CreatorChecklist = ({ metaData }: HundredTrainersPageProps) => {
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

  const handleApplyClick = () => {
    // Logic for application
    router.push('https://tally.so/r/wQ0xAP');
  };

  const features = [
    { icon: <DollarSign size={24} className="text-[#E0FE10]" />, title: 'Monetization Tools', description: 'Unlock features to earn from your content and expertise.' },
    { icon: <Zap size={24} className="text-[#E0FE10]" />, title: 'Early Access to Features', description: 'Be the first to try new tools and shape their development.' },
    { icon: <Users size={24} className="text-[#E0FE10]" />, title: 'Founding Member Status', description: 'Exclusive badge and recognition within the Pulse community.' },
    { icon: <Check size={24} className="text-[#E0FE10]" />, title: 'Direct Support & Feedback Channels', description: 'Priority support and direct lines to the Pulse team.' },
    { icon: <Gift size={24} className="text-[#E0FE10]" />, title: 'Exclusive Founding Trainer Welcome Kit', description: 'Receive a special welcome package with Pulse merchandise and goodies.' },
    { icon: <CalendarDays size={24} className="text-[#E0FE10]" />, title: 'Free Entry to Pulse Events for 1 Year', description: 'Gain complimentary access to all official Pulse workshops, meetups, and online events.' },
    { icon: <Target size={24} className="text-[#E0FE10]" />, title: 'Featured Promotion & Spotlight Opportunities', description: 'Get your profile and content highlighted across Pulse platforms to boost your visibility.' },
  ];

  return (
    <>
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/100trainers"
      />
      <div className="min-h-screen bg-gradient-to-br from-[#101010] to-[#18181b] text-white">
        <Header 
          onSectionChange={() => {}} // Stub function
          currentSection="creator" // Default section
          toggleMobileMenu={() => {}} // Stub function
          setIsSignInModalVisible={() => {}} // Stub function
          theme="dark" // Set theme
        />
        <main className="pt-20 pb-16">
          <section className="py-16 md:py-24 text-center bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/path-to-your-hero-image.jpg")' }}> {/* Replace with actual hero image if any */}
            <div className="absolute inset-0 bg-black/70"></div>
            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#E0FE10] to-green-400">
                Join the <span className="whitespace-nowrap">Pulse 100</span>
              </h1>
              <p className="mt-6 text-xl md:text-2xl text-gray-300 leading-relaxed">
                Become a Founding Trainer in a community that's reshaping fitness. We're looking for 100 passionate creators to pioneer the future with us.
              </p>
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
                onClick={handleApplyClick}
                className="flex items-center justify-center mx-auto px-10 py-5 border border-transparent text-xl font-medium rounded-full text-black bg-gradient-to-r from-[#E0FE10] to-green-400 hover:opacity-90 transition-transform duration-300 ease-in-out transform hover:scale-105 shadow-xl"
              >
                Apply Now & Shape the Future <ExternalLink className="ml-3 h-6 w-6" />
              </button>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<HundredTrainersPageProps> = async (context) => {
  let metaData: PageMetaData | null = null;
  try {
    // Fetch meta data for the '100trainers' page
    metaData = await adminMethods.getPageMetaData('100trainers');
  } catch (error) {
    console.error("Error fetching page meta data for 100trainers:", error);
    // Optionally, set default meta data or handle the error as needed
    // For now, we'll proceed with null metaData if an error occurs
  }

  return {
    props: {
      metaData,
    },
  };
};

export default CreatorChecklist;