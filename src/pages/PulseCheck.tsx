import type { NextPage } from 'next';
import React, { useState, useEffect, useRef } from 'react';
import { FaCheckCircle, FaChartLine, FaBrain, FaHeart, FaRocket, FaShieldAlt, FaBed, FaMoon, FaSun, FaLightbulb, FaUtensils, FaCamera, FaFire, FaWeight, FaExclamationTriangle, FaWrench, FaEye, FaBullseye, FaLungs, FaPlay, FaDumbbell, FaTrophy, FaCalendarAlt, FaArrowUp, FaUserTie, FaClock, FaThumbsUp, FaThumbsDown, FaComments, FaClipboardList } from 'react-icons/fa';
import Footer from '../components/Footer/Footer';
import PageHead from '../components/PageHead';
import { PulseCheckWaitlistForm } from '../components/PulseCheckWaitlistForm';
import { useUser } from '../hooks/useUser';
import SignInModal from '../components/SignInModal';
import Chat from '../components/pulsecheck/Chat';
import ConnectedCoachesBadge from '../components/pulsecheck/ConnectedCoachesBadge';
import NoraOnboarding from '../components/pulsecheck/NoraOnboarding';
import ProfilePhoto from '../components/pulsecheck/ProfilePhoto';
import SideNav from '../components/Navigation/SideNav';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import PulseCheckMarketingLanding from '../components/pulsecheck/PulseCheckMarketingLanding';

const STORAGE_KEY_PC = 'pulsecheck_has_seen_marketing';
const STORAGE_KEY_NORA_ONBOARDING = 'pulsecheck_has_seen_nora_onboarding';

const PulseCheckPage: NextPage = () => {
    const currentUser = useUser();
    const [showMarketing, setShowMarketing] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
    const [showNoraOnboarding, setShowNoraOnboarding] = useState(false);
    // Add custom styles for animations
    const customStyles = `
        @keyframes fadeInScale {
            0% {
                opacity: 0;
                transform: scale(0.95) translateY(10px);
            }
            100% {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
        
        @keyframes fadeOutScale {
            0% {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
            100% {
                opacity: 0;
                transform: scale(0.95) translateY(-10px);
            }
        }
        
        @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(5px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeOut {
            0% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-5px); }
        }
        
        .animate-fadeInScale {
            animation: fadeInScale 0.8s ease-out forwards;
        }
        
        .animate-fadeOutScale {
            animation: fadeOutScale 0.6s ease-in forwards;
        }
        
        .animate-fadeIn {
            animation: fadeIn 0.5s ease-out forwards;
        }
        
        .animate-fadeOut {
            animation: fadeOut 0.4s ease-in forwards;
        }
    `;
    // Typing animation state
    const [typedText, setTypedText] = useState('');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(true);
    const [showSleepCard, setShowSleepCard] = useState(false);
    const [showNutritionCard, setShowNutritionCard] = useState(false);
    const [showBreathingCard, setShowBreathingCard] = useState(false);
    const [showWorkoutCard, setShowWorkoutCard] = useState(false);
    const [showProgressionCard, setShowProgressionCard] = useState(false);
    const [showCoachNotifyCard, setShowCoachNotifyCard] = useState(false);
    const [showCoachReasoningCard, setShowCoachReasoningCard] = useState(false);
    const [showCoachLogisticsCard, setShowCoachLogisticsCard] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isReversing, setIsReversing] = useState(false);

    // Waitlist form state
    const [showWaitlistForm, setShowWaitlistForm] = useState(false);
    const [waitlistUserType, setWaitlistUserType] = useState<'athlete' | 'coach' | undefined>(undefined);

    // Mobile PulseCheck header menu (mirrors desktop More menu)
    const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

    const questions = [
        "What was my sleep like last night?",
        "Am I staying on track with my nutrition goals?",
        "I'm feeling anxious about my competition, what can I do to get calm?",
        "What was my heaviest squat?",
        "If I continue on this pace, what would be a respectable progression?",
        "Your stress levels seem high, is it OK if I notify Coach Calvin?",
        "What was Coach Calvin's thought process behind today's deload week?",
        "What time did Coach Calvin say to meet for tomorrow's competition prep?"
    ];

    // Intersection observer for hero section visibility
    const heroRef = useRef<HTMLDivElement>(null);
    const [isHeroVisible, setIsHeroVisible] = useState(true);

    // Intersection Observer to track hero section visibility
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsHeroVisible(entry.isIntersecting);
                // If hero becomes invisible, reset animation states
                if (!entry.isIntersecting) {
                    setIsTyping(false);
                    setIsAnimating(false);
                    setIsReversing(false);
                    // Reset all card states
                    setShowSleepCard(false);
                    setShowNutritionCard(false);
                    setShowBreathingCard(false);
                    setShowWorkoutCard(false);
                    setShowProgressionCard(false);
                    setShowCoachNotifyCard(false);
                    setShowCoachReasoningCard(false);
                    setShowCoachLogisticsCard(false);
                }
            },
            {
                threshold: 0.3, // Trigger when 30% of hero is visible
                rootMargin: '-100px 0px -100px 0px' // Add some margin for better UX
            }
        );

        if (heroRef.current) {
            observer.observe(heroRef.current);
        }

        return () => {
            if (heroRef.current) {
                observer.unobserve(heroRef.current);
            }
        };
    }, []);

    // Mirror home: decide which view to show under same URL
    useEffect(() => {
        const hasSeen = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PC) : null;
        // Allow query param override: /PulseCheck?web=1
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const webParam = params?.get('web');
        if (webParam === '1') {
            localStorage.setItem(STORAGE_KEY_PC, 'true');
        }
        if (hasSeen === 'true') {
            setShowMarketing(false);
        }
        setIsLoading(false);
    }, []);

    // Check if user needs to see Nora onboarding (for logged-in users)
    useEffect(() => {
        if (currentUser && !showMarketing) {
            const hasSeenNoraOnboarding = typeof window !== 'undefined'
                ? localStorage.getItem(STORAGE_KEY_NORA_ONBOARDING)
                : null;
            if (hasSeenNoraOnboarding !== 'true') {
                setShowNoraOnboarding(true);
            }
        }
    }, [currentUser, showMarketing]);

    const handleNoraOnboardingComplete = () => {
        localStorage.setItem(STORAGE_KEY_NORA_ONBOARDING, 'true');
        setShowNoraOnboarding(false);
    };

    const handleUseWebApp = () => {
        if (currentUser) {
            localStorage.setItem(STORAGE_KEY_PC, 'true');
            setShowMarketing(false);
        } else {
            setIsSignInModalOpen(true);
        }
    };

    const handleBackToMarketing = () => {
        localStorage.removeItem(STORAGE_KEY_PC);
        setShowMarketing(true);
    };

    useEffect(() => {
        // Only run animations when hero is visible
        if (!isHeroVisible) return;

        const currentQuestion = questions[currentQuestionIndex];

        if (isTyping && !isAnimating) {
            if (typedText.length < currentQuestion.length) {
                const timeout = setTimeout(() => {
                    setTypedText(currentQuestion.slice(0, typedText.length + 1));
                }, 100);
                return () => clearTimeout(timeout);
            } else if (typedText.length === currentQuestion.length) {
                const timeout = setTimeout(() => {
                    setIsTyping(false);
                    // Trigger animation for the first five questions
                    if (currentQuestionIndex === 0) {
                        setIsAnimating(true);
                        // Start the sleep card transition after a brief pause
                        setTimeout(() => {
                            setShowSleepCard(true);
                        }, 800);
                    } else if (currentQuestionIndex === 1) {
                        setIsAnimating(true);
                        // Start the nutrition card transition after a brief pause
                        setTimeout(() => {
                            setShowNutritionCard(true);
                        }, 800);
                    } else if (currentQuestionIndex === 2) {
                        setIsAnimating(true);
                        // Start the breathing card transition after a brief pause
                        setTimeout(() => {
                            setShowBreathingCard(true);
                        }, 800);
                    } else if (currentQuestionIndex === 3) {
                        setIsAnimating(true);
                        // Start the workout analytics card transition after a brief pause
                        setTimeout(() => {
                            setShowWorkoutCard(true);
                        }, 800);
                    } else if (currentQuestionIndex === 4) {
                        setIsAnimating(true);
                        // Start the progression card transition after a brief pause
                        setTimeout(() => {
                            setShowProgressionCard(true);
                        }, 800);
                    } else if (currentQuestionIndex === 5) {
                        setIsAnimating(true);
                        // Start the coach notification card transition after a brief pause
                        setTimeout(() => {
                            setShowCoachNotifyCard(true);
                        }, 800);
                    } else if (currentQuestionIndex === 6) {
                        setIsAnimating(true);
                        // Start the coach reasoning card transition after a brief pause
                        setTimeout(() => {
                            setShowCoachReasoningCard(true);
                        }, 800);
                    } else if (currentQuestionIndex === 7) {
                        setIsAnimating(true);
                        // Start the coach logistics card transition after a brief pause
                        setTimeout(() => {
                            setShowCoachLogisticsCard(true);
                        }, 800);
                    }
                }, 2000);
                return () => clearTimeout(timeout);
            }
        } else if (!isTyping) {
            const timeout = setTimeout(() => {
                if (currentQuestionIndex === 0) {
                    // Start reverse morphing animation for sleep card
                    setIsReversing(true);
                    setShowSleepCard(false);

                    // Complete the reverse animation to typing interface
                    setTimeout(() => {
                        setIsAnimating(false);
                        setIsReversing(false);
                        setTypedText('');
                        setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
                        setIsTyping(true);
                    }, 800);
                } else if (currentQuestionIndex === 1) {
                    // Start reverse morphing animation for nutrition card
                    setIsReversing(true);
                    setShowNutritionCard(false);

                    // Complete the reverse animation to typing interface
                    setTimeout(() => {
                        setIsAnimating(false);
                        setIsReversing(false);
                        setTypedText('');
                        setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
                        setIsTyping(true);
                    }, 800);
                } else if (currentQuestionIndex === 2) {
                    // Start reverse morphing animation for breathing card
                    setIsReversing(true);
                    setShowBreathingCard(false);

                    // Complete the reverse animation to typing interface
                    setTimeout(() => {
                        setIsAnimating(false);
                        setIsReversing(false);
                        setTypedText('');
                        setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
                        setIsTyping(true);
                    }, 800);
                } else if (currentQuestionIndex === 3) {
                    // Start reverse morphing animation for workout card
                    setIsReversing(true);
                    setShowWorkoutCard(false);

                    // Complete the reverse animation to typing interface
                    setTimeout(() => {
                        setIsAnimating(false);
                        setIsReversing(false);
                        setTypedText('');
                        setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
                        setIsTyping(true);
                    }, 800);
                } else if (currentQuestionIndex === 4) {
                    // Start reverse morphing animation for progression card
                    setIsReversing(true);
                    setShowProgressionCard(false);

                    // Complete the reverse animation to typing interface
                    setTimeout(() => {
                        setIsAnimating(false);
                        setIsReversing(false);
                        setTypedText('');
                        setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
                        setIsTyping(true);
                    }, 800);
                } else if (currentQuestionIndex === 5) {
                    // Start reverse morphing animation for coach notify card
                    setIsReversing(true);
                    setShowCoachNotifyCard(false);

                    // Complete the reverse animation to typing interface
                    setTimeout(() => {
                        setIsAnimating(false);
                        setIsReversing(false);
                        setTypedText('');
                        setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
                        setIsTyping(true);
                    }, 800);
                } else if (currentQuestionIndex === 6) {
                    // Start reverse morphing animation for coach reasoning card
                    setIsReversing(true);
                    setShowCoachReasoningCard(false);

                    // Complete the reverse animation to typing interface
                    setTimeout(() => {
                        setIsAnimating(false);
                        setIsReversing(false);
                        setTypedText('');
                        setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
                        setIsTyping(true);
                    }, 800);
                } else if (currentQuestionIndex === 7) {
                    // Start reverse morphing animation for coach logistics card
                    setIsReversing(true);
                    setShowCoachLogisticsCard(false);

                    // Complete the reverse animation to typing interface
                    setTimeout(() => {
                        setIsAnimating(false);
                        setIsReversing(false);
                        setTypedText('');
                        setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
                        setIsTyping(true);
                    }, 800);
                } else {
                    setTypedText('');
                    setCurrentQuestionIndex((prev) => (prev + 1) % questions.length);
                    setIsTyping(true);
                }
            }, (currentQuestionIndex >= 0 && currentQuestionIndex <= 7) ? 4000 : 1000); // Show morphing cards longer
            return () => clearTimeout(timeout);
        }
    }, [typedText, isTyping, currentQuestionIndex, questions, isHeroVisible]);

    // Sleep Card Component
    const SleepCard: React.FC = () => (
        <div className={`w-full max-w-2xl mx-auto transform transition-all duration-1000 ease-out ${isReversing ? 'animate-fadeOutScale' : 'animate-fadeInScale'
            }`}>
            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl p-8 ring-1 ring-teal-500/20 shadow-2xl transform transition-all duration-800 ease-out">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/20 to-teal-400/20 rounded-3xl blur opacity-75"></div>

                <div className={`relative transition-opacity duration-400 ${isReversing ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-white">Sleep & Recovery</h3>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-500/15 border border-teal-500/30 rounded-full">
                            <span className="text-xs font-semibold text-teal-400">Good</span>
                            <FaBed className="h-3 w-3 text-teal-400" />
                        </div>
                    </div>

                    {/* Main Sleep Metrics */}
                    <div className="flex items-center gap-6 mb-8">
                        {/* Large Sleep Icon with Glow */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-teal-500/20 rounded-full blur-lg"></div>
                            <div className="relative w-16 h-16 bg-teal-500/10 border-2 border-teal-500/30 rounded-full flex items-center justify-center">
                                <FaBed className="h-7 w-7 text-teal-400" />
                            </div>
                        </div>

                        <div className="flex-1">
                            <div className="text-3xl font-bold text-white mb-1">7h 30m</div>
                            <div className="text-zinc-400 text-sm">Total sleep time</div>
                        </div>
                    </div>

                    {/* Bedtime and Wake Time */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <FaMoon className="h-4 w-4 text-teal-400" />
                            <div>
                                <div className="text-xs font-medium text-teal-400 mb-1">Bedtime</div>
                                <div className="text-sm font-semibold text-white">10:30 PM</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-xs font-medium text-orange-400 mb-1">Wake Time</div>
                                <div className="text-sm font-semibold text-white">6:00 AM</div>
                            </div>
                            <FaSun className="h-4 w-4 text-orange-400" />
                        </div>
                    </div>

                    {/* Sleep Efficiency */}
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-zinc-400 text-sm">Sleep Efficiency:</span>
                        <span className="text-lg font-bold text-teal-400">88%</span>
                    </div>

                    {/* Sleep Stages */}
                    <div className="mb-6">
                        <div className="text-xs font-semibold text-[#E0FE10] mb-3">Sleep Stages</div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-zinc-400">Deep Sleep:</span>
                                <span className="text-xs font-medium text-blue-400">1.8h</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-zinc-400">REM Sleep:</span>
                                <span className="text-xs font-medium text-teal-400">2.1h</span>
                            </div>
                        </div>
                    </div>

                    {/* Sleep Impact on Energy */}
                    <div className="border-t border-zinc-800 pt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <FaLightbulb className="h-4 w-4 text-teal-400" />
                            <span className="text-xs font-semibold text-teal-400">Sleep Impact on Your Energy</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Excellent sleep quality optimizes metabolism, balances hunger hormones, and supports muscle recovery. This solid 7.5 hours sets you up for peak performance today.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // Nutrition Card Component
    const NutritionCard: React.FC = () => (
        <div className={`w-full max-w-2xl mx-auto transform transition-all duration-1000 ease-out ${isReversing ? 'animate-fadeOutScale' : 'animate-fadeInScale'
            }`}>
            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl p-8 ring-1 ring-yellow-400/20 shadow-2xl transform transition-all duration-800 ease-out">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-3xl blur opacity-75"></div>

                <div className={`relative transition-opacity duration-400 ${isReversing ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-white">Your Dietary Story</h3>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/15 border border-green-500/30 rounded-full">
                            <span className="text-xs font-semibold text-green-400">Balanced</span>
                            <FaUtensils className="h-3 w-3 text-green-400" />
                        </div>
                    </div>

                    {/* Main Food Icon and Title */}
                    <div className="flex items-center gap-6 mb-8">
                        {/* Large Food Icon with Glow */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-lg"></div>
                            <div className="relative w-16 h-16 bg-green-500/10 border-2 border-green-500/30 rounded-full flex items-center justify-center">
                                <FaUtensils className="h-7 w-7 text-green-400" />
                            </div>
                        </div>

                        <div className="flex-1">
                            <div className="text-xl font-bold text-white mb-1">Fueling Performance</div>
                            <div className="text-zinc-400 text-sm">Your nutrition is supporting your goals with balanced macros</div>
                        </div>
                    </div>

                    {/* Foods You Ate Today */}
                    <div className="mb-8 p-4 bg-zinc-800/40 rounded-xl border border-green-500/20">
                        <div className="flex items-center gap-2 mb-4">
                            <FaCamera className="h-4 w-4 text-green-400" />
                            <span className="text-sm font-semibold text-green-400">Foods You Ate Today</span>
                            <span className="ml-auto text-xs text-zinc-400">4 meals</span>
                        </div>

                        {/* Food Images Grid */}
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            {/* Sample food images placeholders */}
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center border border-green-500/30">
                                <span className="text-xs">🥗</span>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center border border-green-500/30">
                                <span className="text-xs">🐟</span>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg flex items-center justify-center border border-green-500/30">
                                <span className="text-xs">🥦</span>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center border border-green-500/30">
                                <span className="text-xs">🍌</span>
                            </div>
                        </div>

                        {/* Meal Names */}
                        <div className="flex gap-2 flex-wrap">
                            <span className="px-2 py-1 bg-zinc-700/50 text-xs text-zinc-300 rounded border border-zinc-600">Breakfast Bowl</span>
                            <span className="px-2 py-1 bg-zinc-700/50 text-xs text-zinc-300 rounded border border-zinc-600">Grilled Salmon</span>
                            <span className="px-2 py-1 bg-zinc-700/50 text-xs text-zinc-300 rounded border border-zinc-600">+ 2 more</span>
                        </div>
                    </div>

                    {/* Total Calories - Highlighted Section */}
                    <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                            <FaFire className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-semibold text-blue-400">Total Calories</span>
                        </div>
                        <div className="text-3xl font-bold text-white">2,480 kcal</div>
                    </div>

                    {/* Macronutrients */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-green-500/20">
                        <div className="flex items-center gap-2 mb-4">
                            <FaWeight className="h-4 w-4 text-green-400" />
                            <span className="text-sm font-semibold text-green-400">Macronutrients</span>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {/* Carbohydrates */}
                            <div>
                                <div className="text-xs font-medium text-orange-400 mb-1">Carbs</div>
                                <div className="text-lg font-bold text-white">285g</div>
                                <div className="text-xs text-zinc-400">46%</div>
                            </div>

                            {/* Protein */}
                            <div>
                                <div className="text-xs font-medium text-teal-400 mb-1">Protein</div>
                                <div className="text-lg font-bold text-white">165g</div>
                                <div className="text-xs text-zinc-400">27%</div>
                            </div>

                            {/* Fat */}
                            <div>
                                <div className="text-xs font-medium text-yellow-400 mb-1">Fat</div>
                                <div className="text-lg font-bold text-white">75g</div>
                                <div className="text-xs text-zinc-400">27%</div>
                            </div>
                        </div>
                    </div>

                    {/* Nutrient Alert */}
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <FaExclamationTriangle className="h-4 w-4 text-red-400" />
                            <span className="text-sm font-semibold text-red-400">Nutrient Alert</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium text-white">Vitamin D</div>
                                <div className="text-xs text-zinc-400">12 IU • Target: 600 IU</div>
                            </div>
                            <div className="px-2 py-1 bg-red-500/20 text-xs font-bold text-red-400 rounded">LOW</div>
                        </div>
                    </div>

                    {/* Fix It Section */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-green-500/20">
                        <div className="flex items-center gap-2 mb-4">
                            <FaWrench className="h-4 w-4 text-green-400" />
                            <span className="text-sm font-semibold text-green-400">Fix It</span>
                        </div>

                        <div className="mb-3">
                            <div className="text-xs text-green-400 mb-2">Vitamin D - LOW</div>
                            <div className="text-xs text-zinc-400 mb-2">Your current: 12 IU</div>
                        </div>

                        {/* Supplement Recommendations */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-zinc-700/50 rounded-lg border border-zinc-600">
                                <div className="text-xs font-medium text-white">Vitamin D3</div>
                                <div className="text-xs text-zinc-400">2000 IU daily</div>
                            </div>
                            <div className="p-2 bg-zinc-700/50 rounded-lg border border-zinc-600">
                                <div className="text-xs font-medium text-white">Fatty Fish</div>
                                <div className="text-xs text-zinc-400">Add 2x/week</div>
                            </div>
                        </div>
                    </div>

                    {/* Analysis */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-green-500/20">
                        <div className="flex items-center gap-2 mb-4">
                            <FaEye className="h-4 w-4 text-green-400" />
                            <span className="text-sm font-semibold text-green-400">Nutrition Analysis</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-zinc-400 mb-1">Macro Balance</div>
                                <div className="text-sm font-bold text-white">Excellent</div>
                            </div>
                            <div>
                                <div className="text-xs text-zinc-400 mb-1">Overall Quality</div>
                                <div className="text-sm font-bold text-green-400">Very Good</div>
                            </div>
                        </div>
                    </div>

                    {/* Mental Game & Relationship with Food */}
                    <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-4">
                            <FaBrain className="h-4 w-4 text-purple-400" />
                            <span className="text-sm font-semibold text-purple-400">Mental Game</span>
                        </div>

                        <div className="mb-3">
                            <div className="text-xs text-purple-400 mb-2">Relationship with Food</div>
                            <div className="text-sm font-medium text-white mb-2">Balanced & Mindful</div>
                            <div className="text-xs text-zinc-400 leading-relaxed">
                                You're maintaining a healthy relationship with food, viewing it as fuel rather than reward/punishment. No signs of restrictive or emotional eating patterns.
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-2 bg-zinc-800/60 rounded-lg">
                                <div className="text-xs text-green-400 mb-1">Food Stress</div>
                                <div className="text-xs font-bold text-white">Low</div>
                            </div>
                            <div className="p-2 bg-zinc-800/60 rounded-lg">
                                <div className="text-xs text-blue-400 mb-1">Eating Confidence</div>
                                <div className="text-xs font-bold text-white">High</div>
                            </div>
                        </div>
                    </div>

                    {/* Insights */}
                    <div className="border-t border-zinc-800 pt-6 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <FaLightbulb className="h-4 w-4 text-yellow-400" />
                            <span className="text-xs font-semibold text-white">What This Means</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                            Your macro balance is supporting your training goals with adequate protein for recovery and carbs for energy. The slight vitamin D deficiency is common but easily addressed. Your healthy relationship with food is supporting both physical performance and mental well-being.
                        </p>
                    </div>

                    {/* Recommendations */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <FaBullseye className="h-4 w-4 text-green-400" />
                            <span className="text-xs font-semibold text-white">Recommendation</span>
                        </div>
                        <p className="text-xs text-green-400 leading-relaxed">
                            Continue your current eating pattern and add a vitamin D supplement or increase fatty fish intake. Consider timing your largest carb meals around your workouts for optimal performance.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // Breathing Exercise Card Component
    const BreathingCard: React.FC = () => (
        <div className={`w-full max-w-2xl mx-auto transform transition-all duration-1000 ease-out ${isReversing ? 'animate-fadeOutScale' : 'animate-fadeInScale'
            }`}>
            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl p-8 ring-1 ring-blue-400/20 shadow-2xl transform transition-all duration-800 ease-out">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 rounded-3xl blur opacity-75"></div>

                <div className={`relative transition-opacity duration-400 ${isReversing ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Header */}
                    <div className="mb-8">
                        <h3 className="text-xl font-semibold text-white mb-3">
                            Breathing Exercise
                        </h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Let's help you get calm and focused before your competition with a proven breathing technique.
                        </p>
                    </div>

                    {/* Main Breathing Exercise Button */}
                    <div className="mb-6 p-6 bg-gradient-to-br from-blue-500/12 to-indigo-500/8 rounded-2xl border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300 cursor-pointer group">
                        <div className="flex items-center gap-5">
                            {/* Breathing Icon with Animation */}
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-lg animate-pulse"></div>
                                <div className="relative w-16 h-16 bg-blue-500/15 border-2 border-blue-400/40 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                                    <FaLungs className="h-8 w-8 text-blue-400" />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1">
                                <h4 className="text-lg font-semibold text-white mb-1">
                                    Start 4-7-8 Breathing
                                </h4>
                                <p className="text-sm text-zinc-400 mb-3">
                                    3 minutes • Relaxation
                                </p>
                                <div className="text-xs text-blue-400">
                                    Inhale 4s → Hold 7s → Exhale 8s
                                </div>
                            </div>

                            {/* Play Button */}
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-blue-500/20 border border-blue-400/40 rounded-full flex items-center justify-center group-hover:bg-blue-500/30 transition-colors duration-300">
                                    <FaPlay className="h-5 w-5 text-blue-400 ml-0.5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Benefits Section */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <FaHeart className="h-4 w-4 text-red-400" />
                            Benefits for Competition
                        </h5>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                <span className="text-xs text-zinc-300">Reduces anxiety</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <span className="text-xs text-zinc-300">Improves focus</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                <span className="text-xs text-zinc-300">Lowers heart rate</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                <span className="text-xs text-zinc-300">Calms mind</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Tips */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <FaLightbulb className="h-4 w-4 text-yellow-400" />
                            Quick Tips
                        </h5>
                        <div className="space-y-2">
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span className="text-xs text-zinc-300">Find a comfortable, quiet position</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span className="text-xs text-zinc-300">Focus on slow, controlled breathing</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span className="text-xs text-zinc-300">Let thoughts pass without judgment</span>
                            </div>
                        </div>
                    </div>

                    {/* Alternative Options */}
                    <div className="space-y-3">
                        <h5 className="text-sm font-semibold text-white mb-3">
                            Other Calming Techniques
                        </h5>

                        <div className="grid grid-cols-1 gap-2">
                            <button className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30 hover:bg-zinc-800/50 transition-colors duration-200 group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                        <FaBrain className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <span className="text-sm text-white">Progressive Muscle Relaxation</span>
                                </div>
                                <span className="text-xs text-zinc-400 group-hover:text-zinc-300">5 min</span>
                            </button>

                            <button className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30 hover:bg-zinc-800/50 transition-colors duration-200 group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                                        <FaEye className="h-4 w-4 text-green-400" />
                                    </div>
                                    <span className="text-sm text-white">Visualization Exercise</span>
                                </div>
                                <span className="text-xs text-zinc-400 group-hover:text-zinc-300">3 min</span>
                            </button>
                        </div>
                    </div>

                    {/* Encouragement */}
                    <div className="border-t border-zinc-800 pt-6 mt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <FaBullseye className="h-4 w-4 text-blue-400" />
                            <span className="text-xs font-semibold text-white">Competition Ready</span>
                        </div>
                        <p className="text-xs text-blue-400 leading-relaxed">
                            Remember: feeling nervous before competition is normal. This breathing exercise will help you channel that energy into peak performance. You've got this! 🎯
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // Workout Analytics Card Component
    const WorkoutAnalyticsCard: React.FC = () => (
        <div className={`w-full max-w-2xl mx-auto transform transition-all duration-1000 ease-out ${isReversing ? 'animate-fadeOutScale' : 'animate-fadeInScale'
            }`}>
            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl p-8 ring-1 ring-purple-400/20 shadow-2xl transform transition-all duration-800 ease-out">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-3xl blur opacity-75"></div>

                <div className={`relative transition-opacity duration-400 ${isReversing ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-white">Squat Performance</h3>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/15 border border-purple-500/30 rounded-full">
                            <span className="text-xs font-semibold text-purple-400">Personal Record</span>
                            <FaTrophy className="h-3 w-3 text-purple-400" />
                        </div>
                    </div>

                    {/* Main PR Display */}
                    <div className="mb-8 p-6 bg-gradient-to-br from-purple-500/15 to-pink-500/10 rounded-2xl border border-purple-400/30">
                        <div className="flex items-center gap-6">
                            {/* Dumbbell Icon */}
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-lg"></div>
                                <div className="relative w-16 h-16 bg-purple-500/15 border-2 border-purple-400/40 rounded-full flex items-center justify-center">
                                    <FaDumbbell className="h-8 w-8 text-purple-400" />
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="text-3xl font-bold text-white mb-1">315 lbs</div>
                                <div className="text-zinc-400 text-sm mb-2">Your heaviest squat</div>
                                <div className="text-xs text-purple-400">Set on March 15, 2024</div>
                            </div>
                        </div>
                    </div>

                    {/* Performance Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                            <div className="flex items-center gap-2 mb-2">
                                <FaCalendarAlt className="h-4 w-4 text-blue-400" />
                                <span className="text-sm font-semibold text-white">Total Sessions</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-400">24</div>
                            <div className="text-xs text-zinc-400">This month: 8</div>
                        </div>

                        <div className="p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                            <div className="flex items-center gap-2 mb-2">
                                <FaChartLine className="h-4 w-4 text-green-400" />
                                <span className="text-sm font-semibold text-white">Volume PR</span>
                            </div>
                            <div className="text-2xl font-bold text-green-400">18,750</div>
                            <div className="text-xs text-zinc-400">lbs total work</div>
                        </div>
                    </div>

                    {/* Recent Progress Chart */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <FaChartLine className="h-4 w-4 text-purple-400" />
                            Recent Progress (Last 6 Workouts)
                        </h5>

                        {/* Simple progress visualization */}
                        <div className="space-y-2">
                            {[
                                { date: 'Mar 15', weight: 315, sets: 3, reps: 5, isMax: true },
                                { date: 'Mar 12', weight: 295, sets: 4, reps: 6, isMax: false },
                                { date: 'Mar 8', weight: 285, sets: 4, reps: 8, isMax: false },
                                { date: 'Mar 5', weight: 275, sets: 5, reps: 5, isMax: false },
                                { date: 'Mar 1', weight: 265, sets: 4, reps: 8, isMax: false },
                                { date: 'Feb 26', weight: 255, sets: 5, reps: 6, isMax: false },
                            ].map((workout, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-zinc-900/40 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${workout.isMax ? 'bg-purple-400' : 'bg-zinc-500'}`}></div>
                                        <span className="text-xs text-zinc-400">{workout.date}</span>
                                    </div>
                                    <div className="text-xs text-white">
                                        {workout.weight} lbs × {workout.sets}×{workout.reps}
                                        {workout.isMax && <span className="ml-2 text-purple-400">🏆</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Strength Metrics */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <FaWeight className="h-4 w-4 text-orange-400" />
                            Strength Analysis
                        </h5>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-zinc-400">1RM Estimated:</span>
                                <span className="text-sm font-bold text-white">340 lbs</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-zinc-400">Body Weight Ratio:</span>
                                <span className="text-sm font-bold text-orange-400">1.8x</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-zinc-400">Monthly Growth:</span>
                                <span className="text-sm font-bold text-green-400">+12.5 lbs</span>
                            </div>
                        </div>
                    </div>

                    {/* Insights */}
                    <div className="border-t border-zinc-800 pt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <FaLightbulb className="h-4 w-4 text-yellow-400" />
                            <span className="text-xs font-semibold text-white">Performance Insights</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Your squat progression shows consistent strength gains with excellent form stability. The 60lb increase over 3 months puts you in the top 15% of intermediate lifters. Your current trajectory suggests you're ready for advanced programming.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // Progression Prediction Card Component
    const ProgressionCard: React.FC = () => (
        <div className={`w-full max-w-2xl mx-auto transform transition-all duration-1000 ease-out ${isReversing ? 'animate-fadeOutScale' : 'animate-fadeInScale'
            }`}>
            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl p-8 ring-1 ring-emerald-400/20 shadow-2xl transform transition-all duration-800 ease-out">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400/20 to-teal-400/20 rounded-3xl blur opacity-75"></div>

                <div className={`relative transition-opacity duration-400 ${isReversing ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Header */}
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-white mb-3">
                            Progression Forecast
                        </h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Based on your current training consistency and progression rate, here's your projected strength development.
                        </p>
                    </div>

                    {/* Projected Milestones */}
                    <div className="mb-6 p-6 bg-gradient-to-br from-emerald-500/15 to-teal-500/10 rounded-2xl border border-emerald-400/30">
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <FaArrowUp className="h-5 w-5 text-emerald-400" />
                            Next Milestones
                        </h4>

                        <div className="space-y-4">
                            {[
                                { milestone: '350 lbs', timeframe: '6-8 weeks', probability: 'High', color: 'text-green-400' },
                                { milestone: '365 lbs', timeframe: '3-4 months', probability: 'Very High', color: 'text-emerald-400' },
                                { milestone: '400 lbs', timeframe: '8-10 months', probability: 'Achievable', color: 'text-blue-400' },
                            ].map((goal, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-zinc-800/40 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                                            <FaTrophy className="h-4 w-4 text-emerald-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{goal.milestone}</div>
                                            <div className="text-xs text-zinc-400">{goal.timeframe}</div>
                                        </div>
                                    </div>
                                    <div className={`text-xs font-semibold px-2 py-1 bg-zinc-700/50 rounded ${goal.color}`}>
                                        {goal.probability}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Training Recommendations */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <FaRocket className="h-4 w-4 text-blue-400" />
                            Recommended Training Adjustments
                        </h5>

                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3 bg-zinc-900/40 rounded-lg">
                                <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center mt-0.5">
                                    <span className="text-xs font-bold text-blue-400">1</span>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">Increase Training Frequency</div>
                                    <div className="text-xs text-zinc-400">Move from 2x to 3x per week for faster adaptation</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-zinc-900/40 rounded-lg">
                                <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center mt-0.5">
                                    <span className="text-xs font-bold text-purple-400">2</span>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">Add Pause Squats</div>
                                    <div className="text-xs text-zinc-400">Build strength out of the hole for PR attempts</div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-zinc-900/40 rounded-lg">
                                <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                                    <span className="text-xs font-bold text-green-400">3</span>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">Focus on Recovery</div>
                                    <div className="text-xs text-zinc-400">8+ hours sleep and adequate protein for growth</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Confidence Metrics */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <FaChartLine className="h-4 w-4 text-emerald-400" />
                            Progression Confidence
                        </h5>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-zinc-400 mb-1">Consistency Score</div>
                                <div className="text-lg font-bold text-emerald-400">94%</div>
                            </div>
                            <div>
                                <div className="text-xs text-zinc-400 mb-1">Form Stability</div>
                                <div className="text-lg font-bold text-blue-400">Excellent</div>
                            </div>
                        </div>
                    </div>

                    {/* Motivational Close */}
                    <div className="border-t border-zinc-800 pt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <FaBullseye className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs font-semibold text-white">Your Path Forward</span>
                        </div>
                        <p className="text-xs text-emerald-400 leading-relaxed">
                            At your current pace, you're on track to join the 400lb club within a year! Your progression is mathematically sound and your form improvements show you're training smart. Keep this momentum and those big numbers are inevitable. 💪
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // Coach Notification Card Component
    const CoachNotifyCard: React.FC = () => (
        <div className={`w-full max-w-2xl mx-auto transform transition-all duration-1000 ease-out ${isReversing ? 'animate-fadeOutScale' : 'animate-fadeInScale'
            }`}>
            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl p-8 ring-1 ring-orange-400/20 shadow-2xl transform transition-all duration-800 ease-out">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-400/20 to-red-400/20 rounded-3xl blur opacity-75"></div>

                <div className={`relative transition-opacity duration-400 ${isReversing ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Header */}
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-white mb-3">
                            Coach Notification
                        </h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            I've noticed some elevated stress patterns in your recent check-ins. Would you like me to reach out to Coach Calvin?
                        </p>
                    </div>

                    {/* Stress Detection Summary */}
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                            <FaExclamationTriangle className="h-4 w-4" />
                            Stress Patterns Noticed
                        </h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-300">Sleep Quality:</span>
                                <span className="text-red-400 font-medium">Below average (3 nights)</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-300">Competition Anxiety:</span>
                                <span className="text-red-400 font-medium">High levels reported</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-300">Recovery Metrics:</span>
                                <span className="text-yellow-400 font-medium">Declining trend</span>
                            </div>
                        </div>
                    </div>

                    {/* Coach Information */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                <FaUserTie className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h5 className="text-sm font-semibold text-white">Coach Calvin</h5>
                                <p className="text-xs text-zinc-400">Strength & Conditioning Specialist</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-zinc-400">Last Contact:</span>
                                <div className="text-white font-medium">Yesterday, 2:30 PM</div>
                            </div>
                            <div>
                                <span className="text-zinc-400">Status:</span>
                                <div className="text-green-400 font-medium">● Available</div>
                            </div>
                        </div>
                    </div>

                    {/* Notification Options */}
                    <div className="mb-6 space-y-3">
                        <h5 className="text-sm font-semibold text-white">Notification Options</h5>

                        <button className="w-full p-4 bg-green-500/15 border border-green-500/30 rounded-xl hover:bg-green-500/20 transition-colors duration-200 group">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FaThumbsUp className="h-5 w-5 text-green-400" />
                                    <div className="text-left">
                                        <div className="text-sm font-medium text-white">Yes, reach out to Coach Calvin</div>
                                        <div className="text-xs text-zinc-400">Share my stress patterns and recent data</div>
                                    </div>
                                </div>
                                <div className="text-xs text-green-400 font-medium">Recommended</div>
                            </div>
                        </button>

                        <button className="w-full p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-xl hover:bg-zinc-800/60 transition-colors duration-200">
                            <div className="flex items-center gap-3">
                                <FaThumbsDown className="h-5 w-5 text-zinc-400" />
                                <div className="text-left">
                                    <div className="text-sm font-medium text-white">Not right now</div>
                                    <div className="text-xs text-zinc-400">I'll handle this on my own</div>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* What Coach Will Receive */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <FaComments className="h-4 w-4 text-blue-400" />
                            What Coach Calvin Will Receive
                        </h5>
                        <div className="space-y-2 text-xs text-zinc-300">
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span>Stress level trends from past 7 days</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span>Sleep and recovery pattern summary</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span>Competition anxiety indicators</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span>Recommended intervention strategies</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-zinc-800 pt-6">
                        <div className="flex items-center gap-2 mb-2">
                            <FaShieldAlt className="h-4 w-4 text-orange-400" />
                            <span className="text-xs font-semibold text-white">Your Privacy</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Only essential performance insights are shared. Personal details and specific conversations remain private unless you explicitly choose to share them.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // Coach Reasoning Card Component
    const CoachReasoningCard: React.FC = () => (
        <div className={`w-full max-w-2xl mx-auto transform transition-all duration-1000 ease-out ${isReversing ? 'animate-fadeOutScale' : 'animate-fadeInScale'
            }`}>
            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl p-8 ring-1 ring-indigo-400/20 shadow-2xl transform transition-all duration-800 ease-out">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-400/20 to-blue-400/20 rounded-3xl blur opacity-75"></div>

                <div className={`relative transition-opacity duration-400 ${isReversing ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Header */}
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-white mb-3">
                            Coach's Reasoning
                        </h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Understanding Coach Calvin's programming decisions for your deload week.
                        </p>
                    </div>

                    {/* Current Week Overview */}
                    <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                        <h4 className="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                            <FaCalendarAlt className="h-4 w-4" />
                            This Week: Deload Phase
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-zinc-400">Volume Reduction:</span>
                                <div className="text-white font-medium">40% decrease</div>
                            </div>
                            <div>
                                <span className="text-zinc-400">Intensity Maintained:</span>
                                <div className="text-indigo-400 font-medium">80-85% 1RM</div>
                            </div>
                        </div>
                    </div>

                    {/* Coach's Strategic Reasoning */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <FaBrain className="h-4 w-4 text-blue-400" />
                            Coach Calvin's Thought Process
                        </h5>

                        <div className="space-y-4">
                            <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/30">
                                <h6 className="text-xs font-semibold text-blue-400 mb-2">1. Fatigue Management</h6>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    "Your HRV has been declining for 10 days, and sleep quality dropped 15%. A deload prevents overreaching while maintaining neural efficiency through heavy singles."
                                </p>
                            </div>

                            <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/30">
                                <h6 className="text-xs font-semibold text-green-400 mb-2">2. Competition Preparation</h6>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    "With competition in 3 weeks, this deload ensures peak nervous system readiness. The reduced volume allows supercompensation while maintaining movement patterns."
                                </p>
                            </div>

                            <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/30">
                                <h6 className="text-xs font-semibold text-purple-400 mb-2">3. Technical Refinement</h6>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    "Lower volume means higher focus on form. Your squat depth has been inconsistent at high fatigue - this week we perfect technique at opener weights."
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Data Supporting Decision */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <FaChartLine className="h-4 w-4 text-emerald-400" />
                            Supporting Data Points
                        </h5>

                        <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center justify-between p-2 bg-zinc-900/40 rounded">
                                <span className="text-xs text-zinc-400">Training Stress Score (7-day avg):</span>
                                <span className="text-sm font-bold text-red-400">425 (High)</span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-zinc-900/40 rounded">
                                <span className="text-xs text-zinc-400">Rate of Perceived Exertion trend:</span>
                                <span className="text-sm font-bold text-yellow-400">↗ Increasing</span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-zinc-900/40 rounded">
                                <span className="text-xs text-zinc-400">Previous deload response:</span>
                                <span className="text-sm font-bold text-green-400">+8% strength gain</span>
                            </div>
                        </div>
                    </div>

                    {/* Expected Outcomes */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <FaRocket className="h-4 w-4 text-orange-400" />
                            Expected Outcomes
                        </h5>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <span className="text-zinc-300">Restored nervous system capacity by Friday</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                <span className="text-zinc-300">Improved sleep quality and HRV recovery</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                <span className="text-zinc-300">Technical improvements at competition weights</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                <span className="text-zinc-300">Ready for final competition prep phase</span>
                            </div>
                        </div>
                    </div>

                    {/* Coach Quote */}
                    <div className="border-t border-zinc-800 pt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <FaComments className="h-4 w-4 text-indigo-400" />
                            <span className="text-xs font-semibold text-white">Coach Calvin's Note</span>
                        </div>
                        <blockquote className="text-xs text-indigo-400 leading-relaxed italic border-l-2 border-indigo-400/30 pl-3">
                            "Trust the process. Your body is telling us it's time to step back and sharpen the blade. This deload isn't a step backward—it's loading the spring for a bigger jump forward. Competition day, you'll thank us for this decision."
                        </blockquote>
                    </div>
                </div>
            </div>
        </div>
    );

    // Coach Logistics Card Component
    const CoachLogisticsCard: React.FC = () => (
        <div className={`w-full max-w-2xl mx-auto transform transition-all duration-1000 ease-out ${isReversing ? 'animate-fadeOutScale' : 'animate-fadeInScale'
            }`}>
            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl p-8 ring-1 ring-cyan-400/20 shadow-2xl transform transition-all duration-800 ease-out">
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/20 to-teal-400/20 rounded-3xl blur opacity-75"></div>

                <div className={`relative transition-opacity duration-400 ${isReversing ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Header */}
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-white mb-3">
                            Competition Day Logistics
                        </h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Here's Coach Calvin's schedule and preparation instructions for tomorrow's bodybuilding competition.
                        </p>
                    </div>

                    {/* Meeting Time - Prominent Display */}
                    <div className="mb-6 p-6 bg-gradient-to-br from-cyan-500/15 to-teal-500/10 rounded-2xl border border-cyan-400/30">
                        <div className="text-center">
                            <FaClock className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
                            <h4 className="text-2xl font-bold text-white mb-2">6:30 AM</h4>
                            <p className="text-cyan-400 text-sm font-medium">Team Meeting Time</p>
                            <p className="text-xs text-zinc-400 mt-1">Venue: Competition warm-up area</p>
                        </div>
                    </div>

                    {/* Complete Schedule */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <FaClipboardList className="h-4 w-4 text-cyan-400" />
                            Full Competition Day Timeline
                        </h5>

                        <div className="space-y-3">
                            {[
                                { time: '6:30 AM', event: 'Team Check-in', detail: 'Coach Calvin - Warm-up area', status: 'upcoming' },
                                { time: '7:00 AM', event: 'Final Prep Briefing', detail: 'Posing review, strategy talk', status: 'upcoming' },
                                { time: '8:30 AM', event: 'Backstage Access', detail: 'Athletes and coaches only', status: 'upcoming' },
                                { time: '9:00 AM', event: 'Pump-up Session', detail: 'Light training, final poses', status: 'upcoming' },
                                { time: '10:30 AM', event: 'Competition Begins', detail: 'Men\'s Physique - First Call', status: 'competition' },
                            ].map((item, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-zinc-900/40 rounded-lg">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.status === 'competition' ? 'bg-orange-400' : 'bg-cyan-400'
                                        }`}></div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-white">{item.event}</span>
                                            <span className="text-xs font-bold text-cyan-400">{item.time}</span>
                                        </div>
                                        <p className="text-xs text-zinc-400">{item.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pre-Competition Checklist */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <FaCheckCircle className="h-4 w-4 text-green-400" />
                            Coach Calvin's Pre-Comp Checklist
                        </h5>

                        <div className="space-y-2">
                            {[
                                'Competition tan applied (tonight)',
                                'Posing suit fitted and ready',
                                'Pump-up routine practiced',
                                'Nutrition timing confirmed',
                                'Music playlist finalized',
                                'Emergency contact info shared'
                            ].map((item, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <FaCheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />
                                    <span className="text-xs text-zinc-300">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Last-Minute Instructions */}
                    <div className="mb-6 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                        <h5 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <FaLightbulb className="h-4 w-4 text-yellow-400" />
                            Last-Minute Reminders
                        </h5>
                        <div className="space-y-2 text-xs text-zinc-300">
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span>Bring backup posing suit (in your gear bag)</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span>Light breakfast only - banana and coffee as discussed</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                <span>Phone on silent but keep it accessible for coordination</span>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="border-t border-zinc-800 pt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <FaUserTie className="h-4 w-4 text-cyan-400" />
                            <span className="text-xs font-semibold text-white">Emergency Contact</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-zinc-900/40 rounded-lg">
                            <div>
                                <p className="text-sm font-medium text-white">Coach Calvin</p>
                                <p className="text-xs text-zinc-400">Direct line for competition day</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-cyan-400">(555) 123-4567</p>
                                <p className="text-xs text-green-400">Available 24/7</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // A helper function to create a consistent feature item
    const _Feature: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
        <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative px-8 py-6 bg-zinc-900 ring-1 ring-white/10 rounded-xl leading-none flex items-top justify-start space-x-6">
                <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#E0FE10] to-lime-400">
                        <Icon className="h-6 w-6 text-zinc-900" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="text-zinc-400 leading-relaxed">{children}</p>
                </div>
            </div>
        </div>
    );

    interface PricingCardProps {
        plan: string;
        price: string;
        description: string;
        features: string[];
        buttonText: string;
        buttonAction: string;
        popular?: boolean;
    }

    // A helper function for pricing cards
    const _PricingCard: React.FC<PricingCardProps> = ({ plan, price, description, features, buttonText, buttonAction, popular = false }) => (
        <div className={`relative flex flex-col justify-between rounded-3xl bg-zinc-900/80 backdrop-blur-sm p-8 ring-1 ${popular ? 'ring-2 ring-[#E0FE10] shadow-2xl shadow-[#E0FE10]/20' : 'ring-white/10'} xl:p-10 group hover:scale-105 transition-all duration-300`}>
            {popular && (
                <>
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#E0FE10] via-lime-400 to-[#E0FE10] rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                        <div className="flex justify-center">
                            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#E0FE10] to-lime-400 px-4 py-1.5 text-xs font-semibold text-zinc-900">
                                <FaRocket className="mr-1 h-3 w-3" />
                                Most Popular
                            </span>
                        </div>
                    </div>
                </>
            )}
            <div className="relative">
                <h3 className="text-xl font-bold leading-8 text-white">{plan}</h3>
                <p className="mt-4 text-sm leading-6 text-zinc-400">{description}</p>
                <div className="mt-6 flex items-baseline gap-x-2">
                    <span className="text-5xl font-bold tracking-tight text-white">{price}</span>
                    {plan !== 'Enterprise' && <span className="text-sm font-semibold leading-6 text-zinc-400">/month</span>}
                </div>
                <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-zinc-300">
                    {features.map((feature: string, index: number) => (
                        <li key={index} className="flex gap-x-3">
                            <FaCheckCircle className="h-5 w-5 flex-none text-[#E0FE10]" aria-hidden="true" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <a
                href={buttonAction}
                className={`mt-8 block rounded-xl px-4 py-3 text-center text-sm font-semibold leading-6 transition-all duration-200 ${popular
                    ? 'bg-gradient-to-r from-[#E0FE10] to-lime-400 text-zinc-900 shadow-lg hover:shadow-xl hover:scale-105'
                    : 'bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/20'
                    }`}
            >
                {buttonText}
            </a>
        </div>
    );

    // Initial tiny loading gate to avoid flicker
    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Loading...</div>
        );
    }

    // If user chose web app (and is logged in), show web app content
    if (!showMarketing && currentUser) {
        // Show Nora onboarding if user hasn't seen it yet
        if (showNoraOnboarding) {
            return (
                <>
                    <PageHead
                        metaData={{
                            pageId: "pulse-check-onboarding",
                            pageTitle: "Meet Nora — Your AI Mental Performance Coach",
                            metaDescription: "Your workout data now talks back. Meet Nora, your AI mental performance coach.",
                            lastUpdated: new Date().toISOString()
                        }}
                        pageOgUrl="https://fitwithpulse.ai/PulseCheck"
                    />
                    <NoraOnboarding onComplete={handleNoraOnboardingComplete} />
                </>
            );
        }

        return (
            <>
                <PageHead
                    metaData={{
                        pageId: "pulse-check",
                        pageTitle: "PulseCheck — AI Sports Psychology",
                        metaDescription: "AI-powered sports psychology and mindset coaching",
                        lastUpdated: new Date().toISOString()
                    }}
                    pageOgUrl="https://fitwithpulse.ai/PulseCheck"
                />

                {/* Side/Bottom Navigation */}
                <SideNav onAbout={handleBackToMarketing} />

                {/* Main Content Area */}
                <div className="md:ml-20 lg:ml-64 bg-[#0a0a0b] min-h-screen">
                    {/* Glassmorphic Header */}
                    <div className="fixed top-0 left-0 md:left-20 lg:left-64 right-0 z-10">
                        {/* Glass background */}
                        <div className="backdrop-blur-xl bg-zinc-900/60 border-b border-white/10">
                            {/* Chromatic reflection line */}
                            <div
                                className="absolute top-0 left-0 right-0 h-[1px] opacity-40"
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(224,254,16,0.4), rgba(59,130,246,0.3), transparent)' }}
                            />

                            <div className="flex items-center justify-between px-6 py-3">
                                <div className="flex items-center gap-3">
                                    {/* Desktop: PulseCheck with glow */}
                                    <div className="hidden md:flex items-center gap-2">
                                        <div className="relative">
                                            <div className="absolute -inset-2 bg-[#E0FE10]/10 rounded-lg blur-lg" />
                                            <h1 className="relative text-xl font-bold text-white tracking-tight">
                                                PulseCheck
                                            </h1>
                                        </div>
                                    </div>

                                    {/* Mobile: PulseCheck with premium dropdown */}
                                    <div className="relative md:hidden">
                                        <button
                                            type="button"
                                            onClick={() => setShowMobileMoreMenu(v => !v)}
                                            className="group inline-flex items-center gap-1.5"
                                        >
                                            <span className="text-xl font-bold text-white">PulseCheck</span>
                                            <div className={`w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-transform ${showMobileMoreMenu ? 'rotate-180' : ''}`}>
                                                <ChevronDownIcon className="w-3 h-3 text-zinc-400 group-hover:text-white transition-colors" />
                                            </div>
                                        </button>

                                        {showMobileMoreMenu && (
                                            <>
                                                {/* Backdrop */}
                                                <div
                                                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                                                    onClick={() => setShowMobileMoreMenu(false)}
                                                />

                                                {/* Premium glassmorphic menu card */}
                                                <div className="absolute mt-3 w-60 z-50">
                                                    {/* Glow effect */}
                                                    <div className="absolute -inset-1 bg-[#E0FE10]/10 rounded-2xl blur-xl" />

                                                    {/* Glass card */}
                                                    <div className="relative rounded-xl backdrop-blur-xl bg-zinc-900/90 border border-white/10 overflow-hidden">
                                                        {/* Chromatic top line */}
                                                        <div
                                                            className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
                                                            style={{ background: 'linear-gradient(90deg, transparent, rgba(224,254,16,0.5), transparent)' }}
                                                        />

                                                        {/* App Switcher – go back to Pulse home */}
                                                        <button
                                                            onClick={() => {
                                                                window.location.href = '/';
                                                                setShowMobileMoreMenu(false);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/5 transition-colors"
                                                        >
                                                            <div className="relative">
                                                                <div className="absolute -inset-1 bg-[#E0FE10]/20 rounded-lg blur opacity-50" />
                                                                <img
                                                                    src="/pulseIcon.png"
                                                                    alt="Pulse"
                                                                    className="relative w-5 h-5"
                                                                />
                                                            </div>
                                                            <span className="font-medium">Pulse</span>
                                                        </button>

                                                        <div className="border-t border-white/5" />

                                                        {/* About */}
                                                        <button
                                                            onClick={() => {
                                                                window.location.href = '/about';
                                                                setShowMobileMoreMenu(false);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/5 transition-colors"
                                                        >
                                                            <span className="text-lg text-zinc-400">ℹ️</span>
                                                            <span>About</span>
                                                        </button>

                                                        <div className="border-t border-white/5" />

                                                        {/* Settings */}
                                                        <button
                                                            onClick={() => {
                                                                window.location.href = '/settings';
                                                                setShowMobileMoreMenu(false);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/5 transition-colors"
                                                        >
                                                            <span className="text-lg text-zinc-400">⚙️</span>
                                                            <span>Settings</span>
                                                        </button>

                                                        <div className="border-t border-white/5" />

                                                        {/* Sign Out */}
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const { signOut } = await import('../api/firebase/auth/methods');
                                                                    await signOut();
                                                                    window.location.href = '/';
                                                                } catch (error) {
                                                                    console.error('Error signing out:', error);
                                                                } finally {
                                                                    setShowMobileMoreMenu(false);
                                                                }
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-red-500/10 transition-colors"
                                                        >
                                                            <span className="text-lg text-zinc-400">↩️</span>
                                                            <span>Sign Out</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <ConnectedCoachesBadge />
                                    <div className="hidden md:block">
                                        <ProfilePhoto />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="h-screen pt-[52px] overflow-hidden">
                        <Chat />
                    </div>
                </div>

                <SignInModal isVisible={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />
            </>
        );
    }

    const useChromaticLanding = true;
    if (useChromaticLanding) {
        return (
            <>
                <PageHead
                    metaData={{
                        pageId: "pulse-check",
                        pageTitle: "PulseCheck — The Mental Performance OS for Elite Programs",
                        metaDescription: "PulseCheck gives coaches real-time readiness signals, intervention tools, and clinical safety nets before it shows on the scoreboard.",
                        lastUpdated: new Date().toISOString()
                    }}
                    pageOgUrl="https://fitwithpulse.ai/pulse-check"
                />
                <PulseCheckMarketingLanding
                    onJoinWaitlist={() => {
                        setWaitlistUserType('athlete');
                        setShowWaitlistForm(true);
                    }}
                />
                <PulseCheckWaitlistForm
                    isOpen={showWaitlistForm}
                    onClose={() => setShowWaitlistForm(false)}
                    userType={waitlistUserType}
                />
            </>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-avenir overflow-hidden">
            <style jsx>{customStyles}</style>
            <PageHead
                metaData={{
                    pageId: "pulse-check",
                    pageTitle: "PulseCheck — Always-On Sport Psychology",
                    metaDescription: "Always-On Sport Psychology for Athletes & Their Coaches. Pair subjective mood with objective biometrics to unlock peak performance.",
                    lastUpdated: new Date().toISOString()
                }}
                pageOgUrl="https://fitwithpulse.ai/pulse-check"
            />

            <main className="isolate">
                {/* Hero Section */}
                <div className="relative min-h-screen flex items-center justify-center px-6 sm:px-8" ref={heroRef}>
                    {/* Animated Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"></div>
                    <div className="absolute inset-0">
                        <div className="absolute top-20 left-20 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-20 right-20 w-80 h-80 bg-lime-400/5 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
                        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-teal-400/5 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                    </div>

                    {/* Grid Pattern */}
                    <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-repeat opacity-5"></div>

                    {/* Hero Content */}
                    <div className="relative z-20 max-w-7xl mx-auto px-6 lg:px-8 text-center">
                        <div className="max-w-4xl mx-auto">
                            <div className="mb-8">
                                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#E0FE10]/10 to-lime-400/10 px-6 py-2 text-sm font-medium text-[#E0FE10] ring-1 ring-inset ring-[#E0FE10]/20 backdrop-blur">
                                    <FaShieldAlt className="mr-2 h-4 w-4" />
                                    The Complete Readiness Triad for Elite Programs
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8">
                                <span className="bg-gradient-to-r from-white via-zinc-100 to-zinc-300 bg-clip-text text-transparent">
                                    PulseCheck
                                </span>
                                <span className="block text-3xl md:text-5xl mt-3 text-[#E0FE10]">
                                    The mental performance OS for elite programs
                                </span>
                            </h1>

                            <p className="text-xl md:text-2xl text-zinc-300 mb-3 leading-relaxed">
                                We don't just tell you if athletes are physically ready.
                            </p>
                            <p className="text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed max-w-4xl mx-auto">
                                We tell you whether they are mentally built to execute today—before it appears on the scoreboard.
                            </p>

                            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
                                <span className="inline-flex items-center rounded-full bg-zinc-900/80 border border-zinc-800 px-4 py-2 text-sm text-zinc-200">
                                    <FaBrain className="mr-2 h-4 w-4 text-[#E0FE10]" />
                                    Always-on athlete check-ins
                                </span>
                                <span className="inline-flex items-center rounded-full bg-zinc-900/80 border border-zinc-800 px-4 py-2 text-sm text-zinc-200">
                                    <FaChartLine className="mr-2 h-4 w-4 text-[#E0FE10]" />
                                    Team-wide roster readiness radar
                                </span>
                                <span className="inline-flex items-center rounded-full bg-zinc-900/80 border border-zinc-800 px-4 py-2 text-sm text-zinc-200">
                                    <FaShieldAlt className="mr-2 h-4 w-4 text-[#E0FE10]" />
                                    Clinical escalation guardrails
                                </span>
                            </div>

                            {/* Typing Animation Container / Sleep Card / Nutrition Card */}
                            <div className="max-w-2xl mx-auto mb-12 relative">
                                {showSleepCard ? (
                                    <SleepCard />
                                ) : showNutritionCard ? (
                                    <NutritionCard />
                                ) : showBreathingCard ? (
                                    <BreathingCard />
                                ) : showWorkoutCard ? (
                                    <WorkoutAnalyticsCard />
                                ) : showProgressionCard ? (
                                    <ProgressionCard />
                                ) : showCoachNotifyCard ? (
                                    <CoachNotifyCard />
                                ) : showCoachReasoningCard ? (
                                    <CoachReasoningCard />
                                ) : showCoachLogisticsCard ? (
                                    <CoachLogisticsCard />
                                ) : (
                                    <div className={`relative transition-all duration-800 ease-out ${isAnimating ? 'transform scale-105 opacity-90' : 'transform scale-100 opacity-100'
                                        } ${currentQuestionIndex > 0 ? 'animate-fadeInScale' : ''}`}>
                                        <div className={`relative bg-zinc-900/80 backdrop-blur-sm p-8 ring-1 shadow-2xl transition-all duration-800 ease-out ${isAnimating
                                            ? currentQuestionIndex === 0
                                                ? 'ring-teal-500/30 rounded-3xl'
                                                : currentQuestionIndex === 1
                                                    ? 'ring-yellow-400/30 rounded-3xl'
                                                    : currentQuestionIndex === 2
                                                        ? 'ring-blue-400/30 rounded-3xl'
                                                        : currentQuestionIndex === 3
                                                            ? 'ring-purple-400/30 rounded-3xl'
                                                            : 'ring-emerald-400/30 rounded-3xl'
                                            : currentQuestionIndex === 1
                                                ? 'ring-yellow-400/30 rounded-2xl'
                                                : currentQuestionIndex === 2
                                                    ? 'ring-blue-400/30 rounded-2xl'
                                                    : currentQuestionIndex === 3
                                                        ? 'ring-purple-400/30 rounded-2xl'
                                                        : currentQuestionIndex === 4
                                                            ? 'ring-emerald-400/30 rounded-2xl'
                                                            : 'ring-white/10 rounded-2xl'
                                            }`}>
                                            <div className={`absolute -inset-1 blur transition-all duration-800 ease-out ${isAnimating
                                                ? currentQuestionIndex === 0
                                                    ? 'bg-gradient-to-r from-teal-500/20 to-teal-400/20 opacity-75 rounded-3xl'
                                                    : currentQuestionIndex === 1
                                                        ? 'bg-gradient-to-r from-yellow-400/20 to-orange-400/20 opacity-75 rounded-3xl'
                                                        : currentQuestionIndex === 2
                                                            ? 'bg-gradient-to-r from-blue-400/20 to-indigo-400/20 opacity-75 rounded-3xl'
                                                            : currentQuestionIndex === 3
                                                                ? 'bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-75 rounded-3xl'
                                                                : 'bg-gradient-to-r from-emerald-400/20 to-teal-400/20 opacity-75 rounded-3xl'
                                                : currentQuestionIndex === 1
                                                    ? 'bg-gradient-to-r from-yellow-400/20 to-orange-400/20 opacity-75 rounded-2xl'
                                                    : currentQuestionIndex === 2
                                                        ? 'bg-gradient-to-r from-blue-400/20 to-indigo-400/20 opacity-75 rounded-2xl'
                                                        : currentQuestionIndex === 3
                                                            ? 'bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-75 rounded-2xl'
                                                            : currentQuestionIndex === 4
                                                                ? 'bg-gradient-to-r from-emerald-400/20 to-teal-400/20 opacity-75 rounded-2xl'
                                                                : 'bg-gradient-to-r from-[#E0FE10]/20 to-lime-400/20 opacity-75 rounded-2xl'
                                                }`}></div>
                                            <div className="relative">
                                                <div className={`flex items-center mb-4 transition-all duration-500 ${isAnimating ? 'opacity-60 transform translate-y-1' : 'opacity-100 transform translate-y-0'
                                                    }`}>
                                                    <div className="flex space-x-2">
                                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                                    </div>
                                                    <span className="ml-4 text-sm text-zinc-500">PulseCheck</span>
                                                </div>
                                                <div className={`text-left transition-all duration-500 ${isAnimating ? 'opacity-40 transform translate-y-2' : 'opacity-100 transform translate-y-0'
                                                    }`}>
                                                    <p className="text-zinc-400 mb-2 text-sm">Daily Check-in</p>
                                                    <div className="font-mono text-lg md:text-xl text-white min-h-[2rem] flex items-center">
                                                        {typedText}
                                                        <span className="ml-1 animate-pulse">|</span>
                                                    </div>
                                                </div>

                                                {/* Morphing Content - Shows during forward animation only */}
                                                {isAnimating && !isReversing && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="text-center transform transition-all duration-500 ease-out animate-fadeIn">
                                                            <div className={`w-12 h-12 mx-auto mb-3 border-2 rounded-full flex items-center justify-center ${currentQuestionIndex === 0
                                                                ? 'bg-teal-500/20 border-teal-500/40'
                                                                : currentQuestionIndex === 1
                                                                    ? 'bg-green-500/20 border-green-500/40'
                                                                    : currentQuestionIndex === 2
                                                                        ? 'bg-blue-500/20 border-blue-500/40'
                                                                        : currentQuestionIndex === 3
                                                                            ? 'bg-purple-500/20 border-purple-500/40'
                                                                            : currentQuestionIndex === 4
                                                                                ? 'bg-emerald-500/20 border-emerald-500/40'
                                                                                : currentQuestionIndex === 5
                                                                                    ? 'bg-orange-500/20 border-orange-500/40'
                                                                                    : currentQuestionIndex === 6
                                                                                        ? 'bg-indigo-500/20 border-indigo-500/40'
                                                                                        : 'bg-cyan-500/20 border-cyan-500/40'
                                                                }`}>
                                                                {currentQuestionIndex === 0 ? (
                                                                    <FaBed className="h-5 w-5 text-teal-400" />
                                                                ) : currentQuestionIndex === 1 ? (
                                                                    <FaUtensils className="h-5 w-5 text-green-400" />
                                                                ) : currentQuestionIndex === 2 ? (
                                                                    <FaLungs className="h-5 w-5 text-blue-400" />
                                                                ) : currentQuestionIndex === 3 ? (
                                                                    <FaDumbbell className="h-5 w-5 text-purple-400" />
                                                                ) : currentQuestionIndex === 4 ? (
                                                                    <FaArrowUp className="h-5 w-5 text-emerald-400" />
                                                                ) : currentQuestionIndex === 5 ? (
                                                                    <FaExclamationTriangle className="h-5 w-5 text-orange-400" />
                                                                ) : currentQuestionIndex === 6 ? (
                                                                    <FaBrain className="h-5 w-5 text-indigo-400" />
                                                                ) : (
                                                                    <FaClock className="h-5 w-5 text-cyan-400" />
                                                                )}
                                                            </div>
                                                            <p className="text-white font-semibold text-sm opacity-80">
                                                                {currentQuestionIndex === 0
                                                                    ? 'Reviewing your sleep story...'
                                                                    : currentQuestionIndex === 1
                                                                        ? 'Looking at your nutrition journey...'
                                                                        : currentQuestionIndex === 2
                                                                            ? 'Finding calming techniques...'
                                                                            : currentQuestionIndex === 3
                                                                                ? 'Checking your workout history...'
                                                                                : currentQuestionIndex === 4
                                                                                    ? 'Planning your progression...'
                                                                                    : currentQuestionIndex === 5
                                                                                        ? 'Reviewing stress patterns...'
                                                                                        : currentQuestionIndex === 6
                                                                                            ? 'Connecting with coach insights...'
                                                                                            : 'Checking your schedule...'
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                                <button
                                    onClick={handleUseWebApp}
                                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-white/10 rounded-xl ring-1 ring-inset ring-white/20 hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
                                >
                                    Use Web App
                                </button>
                                <a
                                    href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Pilot%20Inquiry"
                                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-zinc-900 bg-zinc-100 rounded-xl shadow hover:shadow-lg transition-all duration-200"
                                >
                                    Request Department Pilot
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Conversion-first positioning section */}
                <div className="py-16 sm:py-20 bg-zinc-950 border-y border-zinc-800/80">
                    <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">For Athletic Programs That Need Signal, Not Intuition</p>
                            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mt-3">The 3-Pillar Mental Readiness Engine</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="rounded-3xl bg-zinc-900/80 border border-zinc-800 p-7 backdrop-blur-sm">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-[#E0FE10] to-lime-400 flex items-center justify-center mb-4">
                                    <FaBrain className="h-5 w-5 text-zinc-900" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-3">For Athletes</h3>
                                <p className="text-zinc-400 mb-4">24/7 private, stigma-free AI support that turns check-ins into trainable habits.</p>
                                <ul className="text-sm text-zinc-300 space-y-2">
                                    <li>• Frictionless iMessage-style daily mental reps</li>
                                    <li>• Real-time response to anxiety, fatigue, and focus drops</li>
                                    <li>• Personalized drills like Box Breathing and 3-Second Reset</li>
                                </ul>
                            </div>

                            <div className="rounded-3xl bg-zinc-900/80 border border-zinc-800 p-7 backdrop-blur-sm">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-[#E0FE10] to-lime-400 flex items-center justify-center mb-4">
                                    <FaChartLine className="h-5 w-5 text-zinc-900" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-3">For Coaches</h3>
                                <p className="text-zinc-400 mb-4">Team-level intelligence before the tape and before the locker room conversation.</p>
                                <ul className="text-sm text-zinc-300 space-y-2">
                                    <li>• Green/Yellow/Orange/Red roster map at a glance</li>
                                    <li>• Actionable coaching recommendations by athlete</li>
                                    <li>• Proactive alerts when performance risk rises</li>
                                </ul>
                            </div>

                            <div className="rounded-3xl bg-zinc-900/80 border border-zinc-800 p-7 backdrop-blur-sm">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-[#E0FE10] to-lime-400 flex items-center justify-center mb-4">
                                    <FaShieldAlt className="h-5 w-5 text-zinc-900" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-3">For Sports Medicine</h3>
                                <p className="text-zinc-400 mb-4">Clinical handoff automation from routine performance coaching to safety.</p>
                                <ul className="text-sm text-zinc-300 space-y-2">
                                    <li>• Escalation triggers with objective context snapshots</li>
                                    <li>• Restricted visibility on HIPAA-sensitive cases</li>
                                    <li>• Secure handoff to AuntEdna for immediate follow-up</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Equation Section - Moved after Hero and Mobile Optimized */}
                <div className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
                    {/* Background Elements */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"></div>
                    <div className="absolute inset-0">
                        <div className="absolute top-1/4 left-1/6 w-72 h-72 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-1/4 right-1/6 w-80 h-80 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl"></div>
                    </div>

                    <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
                        {/* Section Header */}
                        <div className="text-center mb-12 lg:mb-20">
                            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 lg:mb-8 tracking-tight">
                                The Performance
                                <br />
                                <span className="bg-gradient-to-r from-[#E0FE10] via-blue-400 to-purple-400 bg-clip-text text-transparent">
                                    Equation
                                </span>
                            </h2>
                            <p className="text-lg lg:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
                                Every element working in perfect harmony to unlock your athletic potential
                            </p>
                        </div>

                        {/* Performance Equation Visual - Consistent Card Sizes */}
                        <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-center lg:gap-8 mb-12 lg:mb-20">

                            {/* Mind + Physical */}
                            <div className="group relative w-full max-w-sm lg:w-64 lg:h-64">
                                <div className="absolute -inset-4 bg-gradient-to-r from-[#E0FE10]/20 to-lime-400/20 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 backdrop-blur-sm border border-[#E0FE10]/30 rounded-3xl p-6 text-center h-full flex flex-col justify-center">
                                    <div className="flex items-center justify-center gap-3 mb-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center">
                                            <FaBrain className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="text-xl font-bold text-white">+</div>
                                        <div className="w-12 h-12 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center">
                                            <FaDumbbell className="h-6 w-6 text-zinc-900" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">Mind +<br />Physical</h3>
                                    <p className="text-zinc-400 text-sm">
                                        Sports psychology meets athletic performance data
                                    </p>
                                </div>
                            </div>

                            {/* Arrow - Desktop only */}
                            <div className="hidden lg:flex items-center">
                                <div className="w-12 h-px bg-gradient-to-r from-[#E0FE10] to-blue-400"></div>
                                <div className="w-0 h-0 border-l-4 border-l-blue-400 border-t-2 border-t-transparent border-b-2 border-b-transparent"></div>
                            </div>

                            {/* AI Analysis */}
                            <div className="group relative w-full max-w-sm lg:w-64 lg:h-64">
                                <div className="absolute -inset-4 bg-gradient-to-r from-blue-400/20 to-purple-500/20 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-blue-400/30 rounded-3xl p-6 text-center h-full flex flex-col justify-center">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <FaRocket className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">AI<br />Analysis</h3>
                                    <p className="text-zinc-400 text-sm">
                                        AI processes patterns, correlations, and insights
                                    </p>
                                </div>
                            </div>

                            {/* Arrow - Desktop only */}
                            <div className="hidden lg:flex items-center">
                                <div className="w-12 h-px bg-gradient-to-r from-blue-400 to-orange-400"></div>
                                <div className="w-0 h-0 border-l-4 border-l-orange-400 border-t-2 border-t-transparent border-b-2 border-b-transparent"></div>
                            </div>

                            {/* Coach Wisdom */}
                            <div className="group relative w-full max-w-sm lg:w-64 lg:h-64">
                                <div className="absolute -inset-4 bg-gradient-to-r from-orange-400/20 to-red-500/20 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-sm border border-orange-400/30 rounded-3xl p-6 text-center h-full flex flex-col justify-center">
                                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <FaUserTie className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">Coach<br />Wisdom</h3>
                                    <p className="text-zinc-400 text-sm">
                                        Expert guidance delivered with perfect timing
                                    </p>
                                </div>
                            </div>

                            {/* Equals - Mobile: Below, Desktop: Right */}
                            <div className="lg:hidden text-2xl font-bold text-white my-2">=</div>
                            <div className="hidden lg:flex items-center">
                                <div className="text-3xl font-bold text-white mx-4">=</div>
                            </div>

                            {/* Peak Performance */}
                            <div className="group relative w-full max-w-sm lg:w-64 lg:h-64">
                                <div className="absolute -inset-4 bg-gradient-to-r from-[#E0FE10]/30 to-lime-400/30 rounded-3xl blur opacity-40 group-hover:opacity-60 transition duration-1000"></div>
                                <div className="relative bg-gradient-to-br from-[#E0FE10]/20 to-lime-400/20 backdrop-blur-sm border border-[#E0FE10]/50 rounded-3xl p-6 text-center h-full flex flex-col justify-center">
                                    <div className="w-16 h-16 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                                        <FaTrophy className="h-8 w-8 text-zinc-900" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">Peak<br />Performance</h3>
                                    <p className="text-zinc-400 text-sm">
                                        Your absolute best, backed by science
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Supporting Statement - Mobile Optimized */}
                        <div className="text-center">
                            <div className="max-w-4xl mx-auto">
                                <p className="text-lg lg:text-2xl text-zinc-300 leading-relaxed mb-6 lg:mb-8">
                                    The convergence of sports science, psychology, and AI—creating the most comprehensive athletic intelligence platform ever built.
                                </p>
                                <div className="grid grid-cols-3 gap-4 lg:gap-8">
                                    <div className="text-center">
                                        <div className="text-2xl lg:text-4xl font-bold text-[#E0FE10] mb-1 lg:mb-2">24/7</div>
                                        <div className="text-zinc-400 text-xs lg:text-base">Expert Guidance</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl lg:text-4xl font-bold text-blue-400 mb-1 lg:mb-2">∞</div>
                                        <div className="text-zinc-400 text-xs lg:text-base">Data Points</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl lg:text-4xl font-bold text-purple-400 mb-1 lg:mb-2">1</div>
                                        <div className="text-zinc-400 text-xs lg:text-base">Personalized</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sports Psychology Education Section - Scan-First Version */}
                <div className="py-16 sm:py-24 lg:py-28 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-purple-950/20 to-zinc-950"></div>
                    <div className="absolute inset-0">
                        <div className="absolute top-20 left-1/5 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-20 right-1/5 w-80 h-80 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse"></div>
                    </div>

                    <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
                        <div className="text-center mb-12 lg:mb-16">
                            <div className="inline-flex items-center gap-3 px-5 py-2 bg-zinc-800/50 border border-zinc-700 rounded-full mb-6">
                                <FaBrain className="h-4 w-4 text-purple-300" />
                                <span className="text-purple-300 text-sm font-medium">Sports Psychology in Action</span>
                            </div>

                            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
                                The Mental Game
                                <span className="block mt-2 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                                    Changes Everything
                                </span>
                            </h2>

                            <p className="text-lg text-zinc-300 max-w-3xl mx-auto leading-relaxed mt-6">
                                PulseCheck turns mental training into measurable advantage. One system, three outcomes.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                                <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Outcome 1</p>
                                    <p className="text-xl font-bold text-[#E0FE10] mt-2">Measure readiness with clarity.</p>
                                </div>
                                <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Outcome 2</p>
                                    <p className="text-xl font-bold text-[#E0FE10] mt-2">Act before performance drops.</p>
                                </div>
                                <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Outcome 3</p>
                                    <p className="text-xl font-bold text-[#E0FE10] mt-2">Protect your athletes, every time.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                            <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-7">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-4">
                                    <FaBrain className="h-5 w-5 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Daily Mental Conditioning</h3>
                                <p className="text-zinc-400 mt-3">
                                    A 2-minute daily check-in catches the subtle shifts before they become mistakes.
                                </p>
                                <div className="text-sm text-zinc-300 mt-5 border-l-2 border-[#E0FE10]/70 pl-4">
                                    <p className="font-semibold text-white">Result</p>
                                    <p className="text-zinc-300">Fewer mental crashes on high-pressure days.</p>
                                </div>
                            </div>

                            <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-7">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-[#E0FE10] to-lime-400 flex items-center justify-center mb-4">
                                    <FaChartLine className="h-5 w-5 text-zinc-900" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Readiness Signals in Context</h3>
                                <p className="text-zinc-400 mt-3">
                                    Objective biometrics + check-in tone turn each athlete into a clear signal for coaching.
                                </p>
                                <div className="text-sm text-zinc-300 mt-5 border-l-2 border-[#E0FE10]/70 pl-4">
                                    <p className="font-semibold text-white">Result</p>
                                    <p className="text-zinc-300">Roster-level visibility on performance risk.</p>
                                </div>
                            </div>

                            <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-7">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center mb-4">
                                    <FaShieldAlt className="h-5 w-5 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Safety-Native Escalation</h3>
                                <p className="text-zinc-400 mt-3">
                                    Severe mental stress is routed to clinical support with secure context and visibility controls.
                                </p>
                                <div className="text-sm text-zinc-300 mt-5 border-l-2 border-[#E0FE10]/70 pl-4">
                                    <p className="font-semibold text-white">Result</p>
                                    <p className="text-zinc-300">Faster, safer response when risk changes.</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-7 md:p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6 items-center">
                                <div className="text-center lg:text-left">
                                    <p className="text-sm uppercase tracking-[0.22em] text-zinc-500">The Conversion Test</p>
                                    <h3 className="text-2xl font-bold text-white mt-2">Does your team still rely on intuition at game time?</h3>
                                </div>
                                <div className="grid w-full grid-cols-3 gap-3 sm:gap-4">
                                    <div className="min-w-0 bg-zinc-950/80 border border-zinc-700 rounded-xl p-3 text-center">
                                        <p className="text-xs text-zinc-500">Traditional</p>
                                        <p className="text-lg sm:text-xl xl:text-2xl leading-tight font-bold text-white mt-2 break-words">Reactive</p>
                                    </div>
                                    <div className="min-w-0 bg-zinc-950/80 border border-zinc-700 rounded-xl p-3 text-center">
                                        <p className="text-xs text-zinc-500">PulseCheck</p>
                                        <p className="text-lg sm:text-xl xl:text-2xl leading-tight font-bold text-[#E0FE10] mt-2 break-words">Proactive</p>
                                    </div>
                                    <div className="min-w-0 bg-zinc-950/80 border border-zinc-700 rounded-xl p-3 text-center">
                                        <p className="text-xs text-zinc-500">Result</p>
                                        <p className="text-lg sm:text-xl xl:text-2xl leading-tight font-bold text-zinc-100 mt-2 break-words">Execution Wins</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coach-Athlete Layer Section */}
                <div className="relative py-24 sm:py-32">
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black"></div>
                    <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
                        {/* Section Header */}
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                                Uniting the
                                <span className="bg-gradient-to-r from-[#E0FE10] to-lime-400 bg-clip-text text-transparent"> Athletic Ecosystem</span>
                            </h2>
                            <p className="text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
                                PulseCheck isn't just a chatbot—it's a comprehensive platform replacing fragmented workflows with actionable intelligence. It provides friction-free journaling for athletes, prioritized visibility for coaches, and a reliable medical safety net for clinical escalations.
                            </p>
                        </div>

                        {/* Three-Layer Visualization */}
                        <div className="mb-20">
                            <div className="max-w-4xl mx-auto">
                                <div className="relative">
                                    {/* Connection Lines */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#E0FE10]/30 to-transparent"></div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                                        {/* Nora */}
                                        <div className="text-center">
                                            <div className="relative mb-6 mx-auto w-24 h-24">
                                                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl"></div>
                                                <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center border-2 border-blue-400/50">
                                                    <FaRocket className="h-10 w-10 text-white" />
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">Athlete App (Nora)</h3>
                                            <p className="text-sm text-zinc-400">
                                                Frictionless SMS-style check-ins and actionable mental performance drills.
                                            </p>
                                        </div>

                                        {/* Coach Dashboard */}
                                        <div className="text-center">
                                            <div className="relative mb-6 mx-auto w-28 h-28">
                                                <div className="absolute inset-0 bg-[#E0FE10]/20 rounded-full blur-xl animate-pulse"></div>
                                                <div className="relative w-28 h-28 bg-gradient-to-br from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center border-4 border-lime-300/50 shadow-2xl">
                                                    <FaChartLine className="h-12 w-12 text-zinc-900" />
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-bold text-[#E0FE10] mb-2">Coach Dashboard</h3>
                                            <p className="text-sm text-zinc-400">
                                                Team roster visibility, actionable briefings, and escalating concerns.
                                            </p>
                                        </div>

                                        {/* Aunt Edna */}
                                        <div className="text-center">
                                            <div className="relative mb-6 mx-auto w-24 h-24">
                                                <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl"></div>
                                                <div className="relative w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center border-2 border-purple-400/50">
                                                    <FaShieldAlt className="h-10 w-10 text-white" />
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">Clinical Safety (AuntEdna)</h3>
                                            <p className="text-sm text-zinc-400">
                                                Ensures HIPAA-compliant routing of critical medical or mental health issues.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>


                    </div>
                </div>


                {/* Athlete vs Coach Section - Enhanced */}
                <div className="py-24 sm:py-32 bg-zinc-900/50">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">Built for your workflow</h2>
                            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">The right experience, optimized for how you actually work.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            {/* For the Athlete */}
                            <div className="group relative">
                                <div className="absolute -inset-1 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative flex flex-col rounded-3xl bg-zinc-900/80 backdrop-blur-sm p-8 ring-1 ring-inset ring-white/10 lg:p-10">
                                    <div className="flex items-center mb-6">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#E0FE10] to-lime-400 mr-4">
                                            <FaHeart className="h-6 w-6 text-zinc-900" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">For Athletes</h3>
                                    </div>
                                    <p className="text-zinc-300 mb-8 leading-relaxed">
                                        Native integration with your existing Pulse app. No friction, maximum insight.
                                    </p>
                                    <div className="space-y-4 mb-8 flex-1">
                                        <div className="flex items-center text-zinc-300">
                                            <FaCheckCircle className="h-5 w-5 text-[#E0FE10] mr-3" />
                                            Seamless HealthKit sync
                                        </div>
                                        <div className="flex items-center text-zinc-300">
                                            <FaCheckCircle className="h-5 w-5 text-[#E0FE10] mr-3" />
                                            Instant workout history & PR analysis
                                        </div>
                                        <div className="flex items-center text-zinc-300">
                                            <FaCheckCircle className="h-5 w-5 text-[#E0FE10] mr-3" />
                                            Comprehensive technique explanations
                                        </div>
                                        <div className="flex items-center text-zinc-300">
                                            <FaCheckCircle className="h-5 w-5 text-[#E0FE10] mr-3" />
                                            Smart push notifications
                                        </div>
                                        <div className="flex items-center text-zinc-300">
                                            <FaCheckCircle className="h-5 w-5 text-[#E0FE10] mr-3" />
                                            Privacy-first design
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center mb-8">
                                        {/* Energy Story Dashboard - Glassmorphic Style */}
                                        <div className="relative w-full max-w-lg">
                                            {/* Glow Effect */}
                                            <div className="absolute -inset-1 bg-gradient-to-r from-[#E0FE10]/20 to-lime-400/20 rounded-3xl blur opacity-75"></div>

                                            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl ring-1 ring-[#E0FE10]/20 shadow-2xl overflow-hidden h-[600px] flex flex-col">
                                                {/* Dashboard Header */}
                                                <div className="bg-gradient-to-r from-[#E0FE10] to-lime-400 p-4 flex-shrink-0">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-zinc-900 font-bold text-lg">Today's Energy Story</h3>
                                                        <div className="flex items-center space-x-2">
                                                            <FaHeart className="h-4 w-4 text-zinc-900" />
                                                            <span className="text-zinc-900 text-sm font-medium">Live</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Energy Balance Summary */}
                                                <div className="p-4 border-b border-zinc-800 flex-shrink-0">
                                                    <div className="text-center mb-4">
                                                        <div className="text-orange-400 text-2xl font-bold">-247 kcal</div>
                                                        <div className="text-zinc-400 text-sm">Net Energy Balance</div>
                                                        <div className="text-orange-400 text-xs font-medium mt-1">Fat Loss Mode 📉</div>
                                                    </div>

                                                    {/* Energy In vs Out Visual */}
                                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                                        <div className="text-center">
                                                            <div className="flex items-center justify-center mb-2">
                                                                <FaUtensils className="h-4 w-4 text-blue-400 mr-2" />
                                                                <span className="text-blue-400 text-sm font-medium">Calories In</span>
                                                            </div>
                                                            <div className="text-white text-lg font-bold">1,847</div>
                                                            <div className="w-full h-2 bg-zinc-800 rounded-full mt-2">
                                                                <div className="w-4/5 h-2 bg-blue-400 rounded-full"></div>
                                                            </div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="flex items-center justify-center mb-2">
                                                                <FaFire className="h-4 w-4 text-red-400 mr-2" />
                                                                <span className="text-red-400 text-sm font-medium">Calories Out</span>
                                                            </div>
                                                            <div className="text-white text-lg font-bold">2,094</div>
                                                            <div className="w-full h-2 bg-zinc-800 rounded-full mt-2">
                                                                <div className="w-full h-2 bg-red-400 rounded-full"></div>
                                                            </div>
                                                            <div className="text-xs text-zinc-400 mt-1">
                                                                <span className="text-orange-400">842</span> active + <span className="text-red-400">1,252</span> resting
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Heart Rate Insights */}
                                                <div className="p-4 border-b border-zinc-800 flex-shrink-0">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center space-x-2">
                                                            <FaHeart className="h-4 w-4 text-[#E0FE10]" />
                                                            <span className="text-white text-sm font-medium">Heart Rate Zones</span>
                                                        </div>
                                                        <span className="text-[#E0FE10] text-xs">78 avg bpm</span>
                                                    </div>

                                                    {/* Zone Distribution */}
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                                                                <span className="text-zinc-300 text-xs">Fat Burn</span>
                                                            </div>
                                                            <span className="text-blue-400 text-xs font-medium">42 min</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                                                                <span className="text-zinc-300 text-xs">Cardio</span>
                                                            </div>
                                                            <span className="text-yellow-400 text-xs font-medium">28 min</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                                                                <span className="text-zinc-300 text-xs">Peak</span>
                                                            </div>
                                                            <span className="text-red-400 text-xs font-medium">12 min</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Today's Achievements */}
                                                <div className="p-4 border-b border-zinc-800 flex-shrink-0">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center space-x-2">
                                                            <FaTrophy className="h-4 w-4 text-yellow-400" />
                                                            <span className="text-white text-sm font-medium">Achievements</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="text-center p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                                            <FaTrophy className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
                                                            <div className="text-yellow-400 text-xs font-medium">10K Steps</div>
                                                            <div className="text-zinc-400 text-xs">Gold</div>
                                                        </div>
                                                        <div className="text-center p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                                            <FaBullseye className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                                                            <div className="text-blue-400 text-xs font-medium">Deficit</div>
                                                            <div className="text-zinc-400 text-xs">Goal</div>
                                                        </div>
                                                        <div className="text-center p-2 bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-lg">
                                                            <FaLungs className="h-5 w-5 text-[#E0FE10] mx-auto mb-1" />
                                                            <div className="text-[#E0FE10] text-xs font-medium">Zone 2</div>
                                                            <div className="text-zinc-400 text-xs">Target</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* AI Insights */}
                                                <div className="p-4 flex-grow">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center space-x-2">
                                                            <FaLightbulb className="h-4 w-4 text-yellow-400" />
                                                            <span className="text-white text-sm font-medium">AI Insights</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                                                            <div className="text-orange-400 text-xs font-medium mb-1">Energy Story</div>
                                                            <div className="text-zinc-300 text-xs leading-relaxed">
                                                                Perfect deficit for steady fat loss. This pace allows progress without metabolic slowdown.
                                                            </div>
                                                        </div>

                                                        <div className="p-3 bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-lg">
                                                            <div className="text-[#E0FE10] text-xs font-medium mb-1">Recovery Focus</div>
                                                            <div className="text-zinc-300 text-xs leading-relaxed">
                                                                Great Zone 2 work today. This builds your aerobic base and fat burning efficiency.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setWaitlistUserType('athlete');
                                            setShowWaitlistForm(true);
                                        }}
                                        className="flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#E0FE10] to-lime-400 px-6 py-3 text-sm font-semibold text-zinc-900 hover:from-[#E0FE10]/90 hover:to-lime-400/90 transition-all shadow-lg hover:shadow-xl"
                                    >
                                        <FaRocket className="h-5 w-5" />
                                        Join Waitlist
                                    </button>
                                </div>
                            </div>

                            {/* For the Coach */}
                            <div className="group relative">
                                <div className="absolute -inset-1 bg-gradient-to-r from-teal-400 to-blue-400 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative flex flex-col rounded-3xl bg-zinc-900/80 backdrop-blur-sm p-8 ring-1 ring-inset ring-white/10 lg:p-10">
                                    <div className="flex items-center mb-6">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-blue-400 mr-4">
                                            <FaChartLine className="h-6 w-6 text-zinc-900" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">For Coaches</h3>
                                    </div>
                                    <p className="text-zinc-300 mb-8 leading-relaxed">
                                        Comprehensive web dashboard built for managing teams and making data-driven decisions.
                                    </p>
                                    <div className="space-y-4 mb-8 flex-1">
                                        <div className="flex items-center text-zinc-300">
                                            <FaCheckCircle className="h-5 w-5 text-teal-400 mr-3" />
                                            Team Pulse Board overview
                                        </div>
                                        <div className="flex items-center text-zinc-300">
                                            <FaCheckCircle className="h-5 w-5 text-teal-400 mr-3" />
                                            Proactive intervention alerts
                                        </div>
                                        <div className="flex items-center text-zinc-300">
                                            <FaCheckCircle className="h-5 w-5 text-teal-400 mr-3" />
                                            Exportable reports & analytics
                                        </div>
                                        <div className="flex items-center text-zinc-300">
                                            <FaCheckCircle className="h-5 w-5 text-teal-400 mr-3" />
                                            Real-time athlete alerts
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center mb-8">
                                        {/* Live Coach Dashboard - Glassmorphic Style */}
                                        <div className="relative w-full max-w-lg">
                                            {/* Glow Effect */}
                                            <div className="absolute -inset-1 bg-gradient-to-r from-teal-400/20 to-blue-400/20 rounded-3xl blur opacity-75"></div>

                                            <div className="relative bg-zinc-900/90 backdrop-blur-sm rounded-3xl ring-1 ring-teal-400/20 shadow-2xl overflow-hidden h-[600px] flex flex-col">
                                                {/* Dashboard Header */}
                                                <div className="bg-gradient-to-r from-teal-400 to-blue-400 p-4 flex-shrink-0">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-zinc-900 font-bold text-lg">Team Pulse Board</h3>
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                            <span className="text-zinc-900 text-sm font-medium">Live</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Quick Stats */}
                                                <div className="p-4 border-b border-zinc-800 flex-shrink-0">
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div className="text-center">
                                                            <div className="text-teal-400 text-xl font-bold">12</div>
                                                            <div className="text-zinc-400 text-xs">Athletes</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-yellow-400 text-xl font-bold">3</div>
                                                            <div className="text-zinc-400 text-xs">Alerts</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-green-400 text-xl font-bold">89%</div>
                                                            <div className="text-zinc-400 text-xs">Readiness</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Athletes List */}
                                                <div className="p-4 space-y-3 flex-grow overflow-y-auto">
                                                    {/* Athlete 1 - Alert */}
                                                    <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                                                                <span className="text-white text-xs font-bold">JS</span>
                                                            </div>
                                                            <div>
                                                                <div className="text-white text-sm font-medium">Jessica Smith</div>
                                                                <div className="text-red-400 text-xs">High stress • Poor sleep</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <FaExclamationTriangle className="h-4 w-4 text-red-400" />
                                                            <span className="text-red-400 text-xs font-medium">Alert</span>
                                                        </div>
                                                    </div>

                                                    {/* Athlete 2 - Good */}
                                                    <div className="flex items-center justify-between p-3 bg-zinc-800/40 rounded-lg">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                                                <span className="text-white text-xs font-bold">MJ</span>
                                                            </div>
                                                            <div>
                                                                <div className="text-white text-sm font-medium">Mike Johnson</div>
                                                                <div className="text-green-400 text-xs">Ready • Good recovery</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-green-400 text-xs font-medium">92%</div>
                                                    </div>

                                                    {/* Athlete 3 - Warning */}
                                                    <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                                                                <span className="text-white text-xs font-bold">AL</span>
                                                            </div>
                                                            <div>
                                                                <div className="text-white text-sm font-medium">Alex Lee</div>
                                                                <div className="text-yellow-400 text-xs">Fatigue trend • Monitor</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-yellow-400 text-xs font-medium">76%</div>
                                                    </div>

                                                    {/* Athlete 4 - Good */}
                                                    <div className="flex items-center justify-between p-3 bg-zinc-800/40 rounded-lg">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
                                                                <span className="text-white text-xs font-bold">SC</span>
                                                            </div>
                                                            <div>
                                                                <div className="text-white text-sm font-medium">Sarah Chen</div>
                                                                <div className="text-teal-400 text-xs">Peak form • Competition ready</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-teal-400 text-xs font-medium">96%</div>
                                                    </div>
                                                </div>

                                                {/* Quick Actions */}
                                                <div className="p-4 border-t border-zinc-800 flex-shrink-0">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button className="flex items-center justify-center space-x-2 p-2 bg-teal-500/20 text-teal-400 rounded-lg text-xs font-medium hover:bg-teal-500/30 transition-colors">
                                                            <FaComments className="h-3 w-3" />
                                                            <span>Send Message</span>
                                                        </button>
                                                        <button className="flex items-center justify-center space-x-2 p-2 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-colors">
                                                            <FaChartLine className="h-3 w-3" />
                                                            <span>View Reports</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setWaitlistUserType('coach');
                                            setShowWaitlistForm(true);
                                        }}
                                        className="rounded-xl bg-gradient-to-r from-teal-400 to-blue-400 px-6 py-3 text-sm font-semibold text-zinc-900 shadow-lg hover:shadow-xl transition-all text-center w-full flex items-center justify-center gap-2"
                                    >
                                        <FaRocket className="h-4 w-4" />
                                        Join Waitlist
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Simulated Mental Game Section */}
                <div className="py-24 sm:py-32 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"></div>
                    <div className="absolute inset-0">
                        <div className="absolute top-16 left-1/4 w-96 h-96 bg-[#E0FE10]/10 rounded-full filter blur-3xl"></div>
                        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl"></div>
                    </div>

                    <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="text-center mb-14">
                            <div className="inline-flex items-center gap-3 px-5 py-2 bg-zinc-900/70 border border-zinc-700 rounded-full mb-6">
                                <FaPlay className="h-4 w-4 text-[#E0FE10]" />
                                <span className="text-zinc-200 text-sm font-medium">Simulated Mental Game</span>
                            </div>
                            <h2 className="text-4xl sm:text-6xl font-bold text-white tracking-tight">
                                Train The Mind
                                <span className="block mt-2 bg-gradient-to-r from-[#E0FE10] via-lime-400 to-emerald-400 bg-clip-text text-transparent">
                                    Before The Clutch Moment
                                </span>
                            </h2>
                            <p className="text-zinc-400 text-lg max-w-3xl mx-auto mt-6">
                                Run pressure scenarios before game day. PulseCheck coaches breathing, attention control, and execution cues in the exact moments athletes usually unravel.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 mb-10">
                            <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 md:p-8">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-zinc-800/70 px-3 py-1.5 border border-zinc-700">
                                        <FaClock className="h-3.5 w-3.5 text-[#E0FE10]" />
                                        <span className="text-xs text-zinc-300 uppercase tracking-[0.15em]">Simulation State</span>
                                    </div>
                                    <div className="text-sm text-zinc-400">Q4 · 01:42 · Down 1</div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-6">
                                    <div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-4 text-center">
                                        <p className="text-xs text-zinc-500 uppercase tracking-[0.14em]">Pressure</p>
                                        <p className="text-2xl font-bold text-orange-400 mt-1">87%</p>
                                    </div>
                                    <div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-4 text-center">
                                        <p className="text-xs text-zinc-500 uppercase tracking-[0.14em]">Focus</p>
                                        <p className="text-2xl font-bold text-blue-400 mt-1">62%</p>
                                    </div>
                                    <div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-4 text-center">
                                        <p className="text-xs text-zinc-500 uppercase tracking-[0.14em]">Composure</p>
                                        <p className="text-2xl font-bold text-[#E0FE10] mt-1">71%</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-orange-300 mb-2">Trigger Event</p>
                                        <p className="text-zinc-200">Missed two free throws, crowd gets loud, hands feel tight, self-talk turns negative.</p>
                                    </div>
                                    <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-blue-300 mb-2">Nora Prompt</p>
                                        <p className="text-zinc-200">"Reset in 8 seconds: exhale long, eyes on rim center, cue: smooth follow-through."</p>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-emerald-300 mb-2">Execution Result</p>
                                        <p className="text-zinc-200">Athlete slows heart rate, blocks crowd noise, and commits to next-shot routine.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 md:p-8">
                                <h3 className="text-2xl font-bold text-white mb-2">Mental Intervention Sequence</h3>
                                <p className="text-zinc-400 text-sm mb-6">A repeatable workflow used in late-game stress spikes.</p>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                                            <FaExclamationTriangle className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-white font-semibold">1. Detect The Spiral</p>
                                            <p className="text-zinc-400 text-sm">Negative self-talk and rushed decision patterns are flagged instantly.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                            <FaBrain className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-white font-semibold">2. Issue A Micro-Reset</p>
                                            <p className="text-zinc-400 text-sm">Breath cadence and short cue are tailored to role and situation.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                                        <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 text-[#E0FE10] flex items-center justify-center">
                                            <FaBullseye className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-white font-semibold">3. Re-Attach To Task</p>
                                            <p className="text-zinc-400 text-sm">Attention narrows to one controllable action for the next play.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                            <FaCheckCircle className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-white font-semibold">4. Lock In Confidence</p>
                                            <p className="text-zinc-400 text-sm">Immediate reinforcement makes the clutch routine more automatic next time.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Scenario A</p>
                                <h4 className="text-white font-semibold mt-2 mb-3">Free Throw Miss Streak</h4>
                                <p className="text-zinc-400 text-sm">Skill: breath down-regulation + visual anchor.</p>
                                <p className="text-[#E0FE10] text-sm mt-3">Result: faster emotional recovery between attempts.</p>
                            </div>
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Scenario B</p>
                                <h4 className="text-white font-semibold mt-2 mb-3">Opponent Momentum Run</h4>
                                <p className="text-zinc-400 text-sm">Skill: cognitive reframing + next-play cue.</p>
                                <p className="text-[#E0FE10] text-sm mt-3">Result: less panic decision-making under noise.</p>
                            </div>
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Scenario C</p>
                                <h4 className="text-white font-semibold mt-2 mb-3">Overtime Final Possession</h4>
                                <p className="text-zinc-400 text-sm">Skill: attentional narrowing + confidence script.</p>
                                <p className="text-[#E0FE10] text-sm mt-3">Result: cleaner execution in decisive moments.</p>
                            </div>
                        </div>
                    </div>
                </div>



                {/* Enhanced CTA Section */}
                <div className="py-24 sm:py-32 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"></div>
                    <div className="absolute inset-0">
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#E0FE10]/10 rounded-full filter blur-3xl"></div>
                        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-lime-400/10 rounded-full filter blur-3xl"></div>
                    </div>
                    <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
                        <h2 className="text-4xl font-bold tracking-tight text-white sm:text-6xl mb-6">
                            Ready to unlock peak <br />
                            <span className="bg-gradient-to-r from-[#E0FE10] to-lime-400 bg-clip-text text-transparent">
                                mental performance?
                            </span>
                        </h2>
                        <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                            Join athletes and coaches who are already using PulseCheck to gain the psychological edge in their training.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <button
                                onClick={() => {
                                    setWaitlistUserType('athlete');
                                    setShowWaitlistForm(true);
                                }}
                                className="group relative inline-flex items-center justify-center px-10 py-4 text-lg font-semibold text-zinc-900 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                            >
                                <span className="absolute -inset-1 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></span>
                                <span className="relative flex items-center">
                                    <FaRocket className="mr-2 h-5 w-5" />
                                    Join Waitlist
                                </span>
                            </button>
                            <a
                                href="mailto:pulsefitnessapp@gmail.com"
                                className="inline-flex items-center justify-center px-10 py-4 text-lg font-semibold text-white hover:text-zinc-300 transition-colors"
                            >
                                Contact for Pilot Program
                                <span className="ml-2">→</span>
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />

            {/* Waitlist Form Modal */}
            <PulseCheckWaitlistForm
                isOpen={showWaitlistForm}
                onClose={() => setShowWaitlistForm(false)}
                userType={waitlistUserType}
            />
        </div>
    );
};

export default PulseCheckPage;
