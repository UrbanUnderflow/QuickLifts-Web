import React, { useState } from 'react';
import { FaLock, FaEye, FaHeart, FaComments, FaChartLine } from 'react-icons/fa';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsent: (shareConversations: boolean, shareSentiment: boolean) => void;
  coachName: string;
  loading?: boolean;
}

const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({
  isOpen,
  onClose,
  onConsent,
  coachName,
  loading = false
}) => {
  const [shareConversations, setShareConversations] = useState(true);
  const [shareSentiment, setShareSentiment] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onConsent(shareConversations, shareSentiment);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-[#E0FE10] rounded-full flex items-center justify-center">
              <FaLock className="text-black text-lg" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Privacy Settings</h2>
              <p className="text-zinc-400 text-sm">Choose what to share with {coachName}</p>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-zinc-800 rounded-lg p-4 mb-6">
            <p className="text-zinc-300 text-sm leading-relaxed">
              Your conversations with your AI companion are <strong className="text-white">shared with your coach by default</strong>. 
              You can choose to make your conversations private if you prefer your coach only see sentiment versus the details of your conversation with the chatbot.
            </p>
          </div>

          {/* Privacy Options */}
          <div className="space-y-4 mb-6">
            {/* Conversation Sharing */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <input
                    type="checkbox"
                    id="shareConversations"
                    checked={shareConversations}
                    onChange={(e) => setShareConversations(e.target.checked)}
                    className="w-4 h-4 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded focus:ring-[#E0FE10] focus:ring-2"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="shareConversations" className="flex items-center space-x-2 cursor-pointer">
                    <FaComments className="text-[#E0FE10] text-sm" />
                    <span className="text-white font-medium">Share Full Conversations</span>
                  </label>
                  <p className="text-zinc-400 text-sm mt-1">
                    Allow your coach to read your full conversations with the AI companion for deeper insights and personalized guidance.
                    <span className="text-[#E0FE10]"> (Recommended)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Sentiment Sharing */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <input
                    type="checkbox"
                    id="shareSentiment"
                    checked={shareSentiment}
                    onChange={(e) => setShareSentiment(e.target.checked)}
                    className="w-4 h-4 text-[#E0FE10] bg-zinc-700 border-zinc-600 rounded focus:ring-[#E0FE10] focus:ring-2"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="shareSentiment" className="flex items-center space-x-2 cursor-pointer">
                    <FaChartLine className="text-blue-400 text-sm" />
                    <span className="text-white font-medium">Share Mood & Sentiment Data</span>
                  </label>
                  <p className="text-zinc-400 text-sm mt-1">
                    Allow your coach to see your mood trends and emotional patterns to provide better support.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Indicators */}
          <div className="bg-zinc-800 rounded-lg p-4 mb-6">
            <h3 className="text-white font-medium mb-3 flex items-center space-x-2">
              <FaEye className="text-[#E0FE10]" />
              <span>What your coach will see:</span>
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${shareSentiment ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-zinc-300">
                  Mood trends and sentiment analysis {shareSentiment ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${shareConversations ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-zinc-300">
                  Full conversation content {shareConversations ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-zinc-300">Your progress and activity data ✓</span>
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mb-6">
            <div className="flex items-start space-x-2">
              <FaLock className="text-blue-400 text-sm mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-blue-200 text-xs">
                  <strong>Privacy Note:</strong> By default, your coach has access to your full conversations. 
                  You can change these settings anytime in your profile if you prefer to only share sentiment data.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-zinc-700 text-white px-4 py-3 rounded-lg hover:bg-zinc-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-[#E0FE10] text-black px-4 py-3 rounded-lg hover:bg-lime-400 transition-colors font-medium disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <FaHeart className="text-sm" />
                  <span>Connect with Coach</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyConsentModal;
