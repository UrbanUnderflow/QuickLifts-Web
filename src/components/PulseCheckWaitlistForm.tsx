import React, { useState } from 'react';
import { FaEnvelope, FaUser, FaSpinner, FaCheckCircle, FaTimes } from 'react-icons/fa';

interface WaitlistFormProps {
  isOpen: boolean;
  onClose: () => void;
  userType?: 'athlete' | 'coach';
}

export const PulseCheckWaitlistForm: React.FC<WaitlistFormProps> = ({ 
  isOpen, 
  onClose, 
  userType 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  });
  const [selectedUserType, setSelectedUserType] = useState<'athlete' | 'coach'>(userType || 'athlete');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/brevo/pulse-check-waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          userType: selectedUserType
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '' });
        // Auto-close after 3 seconds
        setTimeout(() => {
          onClose();
          setSubmitStatus('idle');
        }, 3000);
      } else {
        setSubmitStatus('error');
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (_error) {
      setSubmitStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[#E0FE10]/20 to-lime-400/20 rounded-3xl blur opacity-75"></div>
        
        <div className="relative bg-zinc-900/95 backdrop-blur-sm rounded-3xl ring-1 ring-[#E0FE10]/20 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#E0FE10] to-lime-400 p-6 text-center relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 bg-black/20 hover:bg-black/30 rounded-full flex items-center justify-center transition-colors"
            >
              <FaTimes className="h-4 w-4 text-zinc-900" />
            </button>
            
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">
              Join the Pulse Check Waitlist
            </h2>
            <p className="text-zinc-800 text-sm">
              Be the first to experience always-on sport psychology
            </p>
          </div>

          {/* Form */}
          <div className="p-6">
            {submitStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaCheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">You're on the list! 🎉</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Check your email for a welcome message with more details about Pulse Check.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Field */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                    Name (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaUser className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#E0FE10]/50 focus:border-[#E0FE10]/50 transition-colors"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                    Email Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaEnvelope className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#E0FE10]/50 focus:border-[#E0FE10]/50 transition-colors"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                {/* User Type Selection */}
                {!userType ? (
                  <div>
                    <label className="block text-sm font-medium text-white mb-3">
                      I'm joining as: *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedUserType('athlete')}
                        className={`p-3 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${
                          selectedUserType === 'athlete'
                            ? 'border-[#E0FE10] bg-[#E0FE10]/10 text-[#E0FE10]'
                            : 'border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        🏃‍♂️ Athlete
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUserType('coach')}
                        className={`p-3 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${
                          selectedUserType === 'coach'
                            ? 'border-[#E0FE10] bg-[#E0FE10]/10 text-[#E0FE10]'
                            : 'border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        👨‍🏫 Coach
                      </button>
                    </div>
                  </div>
                ) : (
                  /* User Type Info */
                  <div className="p-3 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-400">
                      Joining as: <span className="text-[#E0FE10] font-medium capitalize">{selectedUserType}</span>
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {submitStatus === 'error' && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-sm">{errorMessage}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.email}
                  className="w-full bg-gradient-to-r from-[#E0FE10] to-lime-400 text-zinc-900 font-semibold py-3 px-6 rounded-xl hover:from-[#E0FE10]/90 hover:to-lime-400/90 focus:outline-none focus:ring-2 focus:ring-[#E0FE10]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <FaSpinner className="h-4 w-4 animate-spin" />
                      Joining Waitlist...
                    </>
                  ) : (
                    'Join Waitlist'
                  )}
                </button>

                <p className="text-xs text-zinc-500 text-center">
                  We'll email you when Pulse Check is ready. No spam, promise! 🤝
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 