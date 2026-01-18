import React from 'react';
import { motion } from 'framer-motion';
import { Brain, X, Sparkles, MessageCircle, Target } from 'lucide-react';

interface NoraIntroCardProps {
  onDismiss: () => void;
}

const NoraIntroCard: React.FC<NoraIntroCardProps> = ({ onDismiss }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="relative mx-4 mb-4"
    >
      {/* Gradient border wrapper */}
      <div className="relative rounded-2xl p-[1px] overflow-hidden">
        {/* Animated gradient border */}
        <div 
          className="absolute inset-0 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #E0FE10 0%, #10B981 50%, #3B82F6 100%)',
            opacity: 0.6,
          }}
        />
        
        {/* Inner content */}
        <div className="relative bg-zinc-900/95 backdrop-blur-xl rounded-2xl p-5">
          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header with avatar */}
          <div className="flex items-start gap-4 mb-4">
            {/* Nora avatar with glow */}
            <div className="relative flex-shrink-0">
              {/* Glow */}
              <div className="absolute inset-0 rounded-full bg-[#E0FE10] blur-lg opacity-30" />
              {/* Avatar */}
              <div 
                className="relative w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #E0FE1020 0%, #E0FE1005 100%)',
                  border: '2px solid #E0FE1040',
                }}
              >
                <Brain className="w-7 h-7 text-[#E0FE10]" />
              </div>
            </div>

            {/* Title and tagline */}
            <div className="flex-1 pt-1">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                Hi, I'm Nora
                <Sparkles className="w-4 h-4 text-[#E0FE10]" />
              </h3>
              <p className="text-zinc-400 text-sm italic">
                "Your workout data now talks back."
              </p>
            </div>
          </div>

          {/* Quick tips */}
          <div className="space-y-2.5 mb-4">
            <p className="text-zinc-300 text-sm">
              I'm your AI mental performance coach. Here are some things you can share with me:
            </p>
            
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Target, text: 'Your goals' },
                { icon: MessageCircle, text: 'What\'s on your mind' },
                { icon: Sparkles, text: 'Wins & challenges' },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-xs"
                >
                  <item.icon className="w-3 h-3 text-[#E0FE10]" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom note */}
          <p className="text-zinc-500 text-xs">
            Everything you share helps me understand you better. Let's get started!
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default NoraIntroCard;
