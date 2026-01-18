import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  MessageCircle, 
  Shield, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  Target,
  TrendingUp,
  Users
} from 'lucide-react';

interface NoraOnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    id: 'meet-nora',
    title: 'Meet Nora',
    subtitle: 'Your AI Mental Performance Coach',
    tagline: 'Your workout data now talks back.',
    description: "Nora is always here for you — whether it's 3pm or 3am. It understands athletes and helps you build the mental edge that separates good from great.",
    icon: Brain,
    accentColor: '#E0FE10',
    features: [
      'Available 24/7, whenever you need support',
      'Trained in sport psychology principles',
      'Personalized to your goals and sport'
    ]
  },
  {
    id: 'what-nora-does',
    title: 'What Nora Does',
    subtitle: 'Track, Reflect, Grow',
    tagline: 'Mental performance, measured.',
    description: 'Nora helps you understand your mental patterns, track your mindset over time, and gives you actionable insights to perform at your best.',
    icon: TrendingUp,
    accentColor: '#10B981',
    features: [
      'Daily check-ins that take seconds',
      'Mental notes to track patterns',
      'Personalized insights from your data'
    ]
  },
  {
    id: 'coach-connection',
    title: 'Connected to Your Coach',
    subtitle: 'Privacy You Control',
    tagline: 'Share what matters, keep what\'s private.',
    description: 'When connected to a coach, Nora can share your progress and flag when you might need extra support. You always control what stays private.',
    icon: Users,
    accentColor: '#3B82F6',
    features: [
      'Share conversations or keep them private',
      'Coaches see trends, not every detail',
      'Escalation support when you need it most'
    ]
  },
  {
    id: 'get-started',
    title: 'Ready to Begin?',
    subtitle: 'Your Mental Edge Starts Now',
    tagline: 'Let\'s unlock your potential.',
    description: "Start a conversation with Nora about anything — your goals, your stress, your wins. There's no wrong way to begin.",
    icon: Sparkles,
    accentColor: '#E0FE10',
    features: [
      'Ask about performance anxiety',
      'Share what\'s on your mind',
      'Set mental performance goals'
    ]
  }
];

const NoraOnboarding: React.FC<NoraOnboardingProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = slides[currentSlide];
  const Icon = slide.icon;
  const isLastSlide = currentSlide === slides.length - 1;

  const nextSlide = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#0a0a0c] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating orbs */}
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: `radial-gradient(circle, ${slide.accentColor}40 0%, transparent 70%)`,
            filter: 'blur(60px)',
          }}
        />
        <motion.div
          animate={{
            x: [0, -20, 0],
            y: [0, 30, 0],
            scale: [1, 0.9, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-15"
          style={{
            background: `radial-gradient(circle, #3B82F640 0%, transparent 70%)`,
            filter: 'blur(50px)',
          }}
        />
        
        {/* Noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-lg px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon with glow */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="relative mb-8"
            >
              {/* Glow effect */}
              <div 
                className="absolute inset-0 rounded-full blur-2xl opacity-40"
                style={{ backgroundColor: slide.accentColor }}
              />
              {/* Icon container */}
              <div 
                className="relative w-24 h-24 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${slide.accentColor}20 0%, ${slide.accentColor}05 100%)`,
                  border: `2px solid ${slide.accentColor}40`,
                }}
              >
                <Icon 
                  className="w-12 h-12" 
                  style={{ color: slide.accentColor }}
                />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-3xl md:text-4xl font-bold text-white mb-2"
            >
              {slide.title}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl font-medium mb-3"
              style={{ color: slide.accentColor }}
            >
              {slide.subtitle}
            </motion.p>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-zinc-400 italic text-sm mb-6"
            >
              "{slide.tagline}"
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-zinc-300 text-base leading-relaxed mb-8 max-w-md"
            >
              {slide.description}
            </motion.p>

            {/* Features list */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="w-full max-w-sm space-y-3 mb-8"
            >
              {slide.features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: slide.accentColor }}
                  />
                  <span className="text-zinc-300 text-sm text-left">{feature}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {/* Back button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              currentSlide === 0 
                ? 'opacity-0 pointer-events-none' 
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back</span>
          </motion.button>

          {/* Dots */}
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: index === currentSlide ? slide.accentColor : 'rgba(255,255,255,0.2)',
                  width: index === currentSlide ? '24px' : '8px',
                }}
              />
            ))}
          </div>

          {/* Next/Complete button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={nextSlide}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: slide.accentColor,
              color: '#0a0a0c',
            }}
          >
            <span>{isLastSlide ? 'Start Chatting' : 'Next'}</span>
            {!isLastSlide && <ChevronRight className="w-5 h-5" />}
            {isLastSlide && <MessageCircle className="w-5 h-5" />}
          </motion.button>
        </div>
      </div>

      {/* Skip button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={onComplete}
        className="absolute top-6 right-6 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
      >
        Skip intro
      </motion.button>
    </motion.div>
  );
};

export default NoraOnboarding;
