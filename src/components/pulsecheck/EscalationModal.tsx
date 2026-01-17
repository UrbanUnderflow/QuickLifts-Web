import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertOctagon,
  Shield,
  Heart,
  Phone,
  X,
  MessageCircle,
  CheckCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { EscalationTier, EscalationCategory, getCategoryLabel, getTierColor } from '../../api/firebase/escalation/types';

// ============================================================================
// Types
// ============================================================================

interface EscalationModalProps {
  isOpen: boolean;
  tier: EscalationTier;
  category: EscalationCategory;
  reason?: string;
  onAcceptConsent?: () => Promise<void>;
  onDeclineConsent?: () => Promise<void>;
  onClose?: () => void;
  isProcessing?: boolean;
}

// ============================================================================
// Crisis Resources
// ============================================================================

const crisisResources = [
  {
    name: '988 Suicide & Crisis Lifeline',
    number: '988',
    description: '24/7, free and confidential support',
    url: 'https://988lifeline.org'
  },
  {
    name: 'Crisis Text Line',
    number: 'Text HOME to 741741',
    description: 'Free, 24/7 crisis support via text',
    url: 'https://www.crisistextline.org'
  },
  {
    name: 'International Association for Suicide Prevention',
    description: 'Find a crisis center in your country',
    url: 'https://www.iasp.info/resources/Crisis_Centres/'
  }
];

// ============================================================================
// Tier 2 Modal (Consent-Based)
// ============================================================================

const Tier2Modal: React.FC<{
  category: EscalationCategory;
  reason?: string;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  isProcessing: boolean;
}> = ({ category, reason, onAccept, onDecline, isProcessing }) => {
  return (
    <div className="relative">
      {/* Header */}
      <div className="relative px-6 pt-6 pb-4">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center border border-orange-500/30">
            <AlertTriangle className="w-7 h-7 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">We're here for you</h2>
            <p className="text-sm text-zinc-400">{getCategoryLabel(category)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-4">
        <p className="text-zinc-300 leading-relaxed">
          Based on our conversation, it seems like you might be going through a challenging time. 
          I want you to know that you're not alone, and there are professionals who can help.
        </p>

        {reason && (
          <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
            <p className="text-sm text-zinc-400">{reason}</p>
          </div>
        )}

        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl p-4 border border-orange-500/20">
          <div className="flex items-start gap-3">
            <Heart className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium mb-1">Would you like to connect with support?</p>
              <p className="text-sm text-zinc-400">
                With your permission, I can connect you with a mental health professional 
                who specializes in supporting athletes. This is completely confidential.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 space-y-3 border-t border-zinc-800">
        <button
          onClick={onAccept}
          disabled={isProcessing}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Yes, I'd like to connect with support
            </>
          )}
        </button>
        
        <button
          onClick={onDecline}
          disabled={isProcessing}
          className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800/50 hover:text-white transition-all disabled:opacity-50"
        >
          Not right now, thanks
        </button>

        <p className="text-xs text-center text-zinc-500 pt-2">
          You can always change your mind and ask for support later.
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// Tier 3 Modal (Critical - Mandatory)
// ============================================================================

const Tier3Modal: React.FC<{
  category: EscalationCategory;
  reason?: string;
  isProcessing: boolean;
}> = ({ category, reason, isProcessing }) => {
  const [showResources, setShowResources] = useState(true);

  return (
    <div className="relative">
      {/* Critical Header */}
      <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-red-500/10 to-red-900/10">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-red-400 to-red-600 animate-pulse" />
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center border border-red-500/40 animate-pulse">
            <AlertOctagon className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Your safety matters most</h2>
            <p className="text-sm text-red-300/80">Immediate support is being connected</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-4">
        <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
          <p className="text-white leading-relaxed">
            I hear you, and I want you to know that what you're feeling matters. 
            A trained professional is being notified right now to reach out to you 
            and provide the support you deserve.
          </p>
        </div>

        {isProcessing && (
          <div className="flex items-center justify-center gap-3 py-4">
            <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
            <span className="text-zinc-300">Connecting you with support...</span>
          </div>
        )}

        {/* Crisis Resources */}
        <div className="space-y-3">
          <button
            onClick={() => setShowResources(!showResources)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <Shield className="w-4 h-4" />
            {showResources ? 'Hide' : 'Show'} immediate crisis resources
          </button>

          {showResources && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3"
            >
              {crisisResources.map((resource, index) => (
                <div
                  key={index}
                  className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 hover:border-red-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-white">{resource.name}</h4>
                      {resource.number && (
                        <a
                          href={resource.number === '988' ? 'tel:988' : '#'}
                          className="text-red-400 font-semibold text-lg hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-4 h-4" />
                          {resource.number}
                        </a>
                      )}
                      <p className="text-sm text-zinc-400 mt-1">{resource.description}</p>
                    </div>
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Reassurance */}
        <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium mb-1">I'm still here</p>
              <p className="text-sm text-zinc-400">
                While we wait for support, I'm here to listen. You don't have to 
                face this alone. Would you like to continue talking?
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
        <p className="text-xs text-zinc-500 text-center">
          Your conversation has been secured and will be shared with the mental health 
          professional to ensure they can provide the best support possible.
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// Main Modal Component
// ============================================================================

const EscalationModal: React.FC<EscalationModalProps> = ({
  isOpen,
  tier,
  category,
  reason,
  onAcceptConsent,
  onDeclineConsent,
  onClose,
  isProcessing = false
}) => {
  // Handle escape key for Tier 2 only (Tier 3 cannot be dismissed)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tier === EscalationTier.ElevatedRisk && onClose) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, tier, onClose]);

  const tierColor = getTierColor(tier);
  const isCritical = tier === EscalationTier.CriticalRisk;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 ${
              isCritical 
                ? 'bg-black/90' 
                : 'bg-black/70 backdrop-blur-sm'
            }`}
            onClick={!isCritical ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative w-full max-w-lg bg-[#1a1e24] rounded-2xl shadow-2xl overflow-hidden ${
              isCritical ? 'border border-red-500/30' : 'border border-zinc-800'
            }`}
          >
            {/* Close button - only for Tier 2 */}
            {!isCritical && onClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Content based on tier */}
            {tier === EscalationTier.ElevatedRisk && (
              <Tier2Modal
                category={category}
                reason={reason}
                onAccept={onAcceptConsent || (async () => {})}
                onDecline={onDeclineConsent || (async () => {})}
                isProcessing={isProcessing}
              />
            )}

            {tier === EscalationTier.CriticalRisk && (
              <Tier3Modal
                category={category}
                reason={reason}
                isProcessing={isProcessing}
              />
            )}
          </motion.div>

          {/* Ambient glow for critical */}
          {isCritical && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-500/10 blur-[100px] rounded-full" />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EscalationModal;
