import React, { useState, useEffect, useCallback } from 'react';
import { Survey, SurveyQuestion } from '../../api/firebase/creatorPages/service';

interface SurveyTakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  survey: Survey;
  onSubmit: (answers: { [questionId: string]: string | number }, respondentName?: string, respondentEmail?: string) => Promise<void>;
}

const SurveyTakingModal: React.FC<SurveyTakingModalProps> = ({
  isOpen,
  onClose,
  survey,
  onSubmit,
}) => {
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = intro, questions start at 0
  const [answers, setAnswers] = useState<{ [questionId: string]: string | number }>({});
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isAnimating, setIsAnimating] = useState(false);

  const totalQuestions = survey?.questions?.length || 0;
  const currentQuestion = currentIndex >= 0 && currentIndex < totalQuestions 
    ? survey.questions[currentIndex] 
    : null;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(-1);
      setAnswers({});
      setRespondentName('');
      setRespondentEmail('');
      setIsSubmitting(false);
      setIsComplete(false);
      setDirection('next');
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || isAnimating || isSubmitting) return;
      
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, answers, isAnimating, isSubmitting]);

  const animateTransition = (dir: 'next' | 'prev', callback: () => void) => {
    setDirection(dir);
    setIsAnimating(true);
    setTimeout(() => {
      callback();
      setTimeout(() => setIsAnimating(false), 50);
    }, 200);
  };

  const handleNext = useCallback(() => {
    if (isAnimating) return;

    // Validate current question if we're past intro
    if (currentQuestion) {
      const answer = answers[currentQuestion.id];
      if (currentQuestion.required && (answer === undefined || answer === '')) {
        return; // Don't proceed if required and not answered
      }
    }

    if (isLastQuestion) {
      handleSubmit();
    } else {
      animateTransition('next', () => {
        setCurrentIndex(prev => prev + 1);
      });
    }
  }, [currentIndex, currentQuestion, answers, isLastQuestion, isAnimating]);

  const handlePrev = () => {
    if (currentIndex > -1 && !isAnimating) {
      animateTransition('prev', () => {
        setCurrentIndex(prev => prev - 1);
      });
    }
  };

  const handleAnswerChange = (questionId: string, value: string | number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(answers, respondentName || undefined, respondentEmail || undefined);
      setIsComplete(true);
    } catch (err) {
      console.error('[SurveyTaking] Failed to submit:', err);
      alert('Failed to submit survey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = (): boolean => {
    if (currentIndex === -1) return true; // Can always proceed from intro
    if (!currentQuestion) return false;
    
    const answer = answers[currentQuestion.id];
    if (currentQuestion.required) {
      return answer !== undefined && answer !== '';
    }
    return true;
  };

  if (!isOpen || !survey) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#E0FE10]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#E0FE10]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Progress bar */}
      {!isComplete && currentIndex >= 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-700/50 z-10">
          <div 
            className="h-full bg-[#E0FE10] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-20 p-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Main content area */}
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl">
          {/* Completion screen */}
          {isComplete ? (
            <div className="text-center animate-fadeIn">
              <div className="w-20 h-20 bg-[#E0FE10] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">Thank you!</h2>
              <p className="text-zinc-400 text-lg mb-8">Your response has been recorded.</p>
              <button
                onClick={onClose}
                className="px-8 py-3 bg-[#E0FE10] text-black rounded-full font-semibold hover:bg-[#d0ee00] transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Intro screen */}
              {currentIndex === -1 && (
                <div className={`transition-all duration-200 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
                  <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                    {survey.title}
                  </h1>
                  {survey.description && (
                    <p className="text-xl text-zinc-400 mb-8">{survey.description}</p>
                  )}
                  
                  <div className="space-y-4 mb-8">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Your name (optional)</label>
                      <input
                        type="text"
                        value={respondentName}
                        onChange={(e) => setRespondentName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-colors text-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Your email (optional)</label>
                      <input
                        type="email"
                        value={respondentEmail}
                        onChange={(e) => setRespondentEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-colors text-lg"
                      />
                    </div>
                  </div>

                  <p className="text-sm text-zinc-500 mb-6">
                    {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} • Takes about {Math.ceil(totalQuestions * 0.5)} minute{Math.ceil(totalQuestions * 0.5) !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {/* Question screens */}
              {currentQuestion && (
                <div className={`transition-all duration-200 ${isAnimating ? (direction === 'next' ? 'opacity-0 -translate-y-4' : 'opacity-0 translate-y-4') : 'opacity-100 translate-y-0'}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-sm text-zinc-500">
                      {currentIndex + 1} of {totalQuestions}
                    </span>
                    {currentQuestion.required && (
                      <span className="text-xs text-[#E0FE10] bg-[#E0FE10]/10 px-2 py-1 rounded-full">
                        Required
                      </span>
                    )}
                  </div>

                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">
                    {currentQuestion.question}
                  </h2>

                  {/* Text input */}
                  {currentQuestion.type === 'text' && (
                    <textarea
                      value={answers[currentQuestion.id] as string || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Type your answer here..."
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-zinc-500 focus:border-[#E0FE10] focus:outline-none transition-colors text-lg resize-none"
                      autoFocus
                    />
                  )}

                  {/* Multiple choice */}
                  {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                    <div className="space-y-3">
                      {currentQuestion.options.map((option, index) => {
                        const isSelected = answers[currentQuestion.id] === option.text;
                        return (
                          <button
                            key={option.id}
                            onClick={() => handleAnswerChange(currentQuestion.id, option.text)}
                            className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 group ${
                              isSelected
                                ? 'bg-[#E0FE10]/10 border-[#E0FE10] text-white'
                                : 'bg-white/5 border-white/10 text-zinc-300 hover:border-white/30 hover:bg-white/10'
                            }`}
                          >
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-[#E0FE10] text-black'
                                : 'bg-white/10 text-zinc-400 group-hover:bg-white/20'
                            }`}>
                              {String.fromCharCode(65 + index)}
                            </span>
                            <span className="text-lg">{option.text}</span>
                            {isSelected && (
                              <svg className="w-5 h-5 ml-auto text-[#E0FE10]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Yes / No */}
                  {currentQuestion.type === 'yes_no' && (
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => handleAnswerChange(currentQuestion.id, 'Yes')}
                        className={`flex-1 max-w-[200px] py-6 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-3 group ${
                          answers[currentQuestion.id] === 'Yes'
                            ? 'bg-emerald-500/20 border-emerald-500 text-white'
                            : 'bg-white/5 border-white/10 text-zinc-300 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                          answers[currentQuestion.id] === 'Yes'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-zinc-400 group-hover:bg-emerald-500/30 group-hover:text-emerald-400'
                        }`}>
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-xl font-semibold">Yes</span>
                      </button>
                      <button
                        onClick={() => handleAnswerChange(currentQuestion.id, 'No')}
                        className={`flex-1 max-w-[200px] py-6 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-3 group ${
                          answers[currentQuestion.id] === 'No'
                            ? 'bg-red-500/20 border-red-500 text-white'
                            : 'bg-white/5 border-white/10 text-zinc-300 hover:border-red-500/50 hover:bg-red-500/10'
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                          answers[currentQuestion.id] === 'No'
                            ? 'bg-red-500 text-white'
                            : 'bg-white/10 text-zinc-400 group-hover:bg-red-500/30 group-hover:text-red-400'
                        }`}>
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <span className="text-xl font-semibold">No</span>
                      </button>
                    </div>
                  )}

                  {/* Number picker */}
                  {currentQuestion.type === 'number' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-zinc-400">{currentQuestion.minValue || 1}</span>
                        <span className="text-4xl font-bold text-[#E0FE10]">
                          {answers[currentQuestion.id] as number || currentQuestion.minValue || 1}
                        </span>
                        <span className="text-zinc-400">{currentQuestion.maxValue || 10}</span>
                      </div>
                      <input
                        type="range"
                        min={currentQuestion.minValue || 1}
                        max={currentQuestion.maxValue || 10}
                        value={answers[currentQuestion.id] as number || currentQuestion.minValue || 1}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, parseInt(e.target.value))}
                        className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-[#E0FE10]"
                        style={{
                          background: `linear-gradient(to right, #E0FE10 0%, #E0FE10 ${((answers[currentQuestion.id] as number || currentQuestion.minValue || 1) - (currentQuestion.minValue || 1)) / ((currentQuestion.maxValue || 10) - (currentQuestion.minValue || 1)) * 100}%, #3f3f46 ${((answers[currentQuestion.id] as number || currentQuestion.minValue || 1) - (currentQuestion.minValue || 1)) / ((currentQuestion.maxValue || 10) - (currentQuestion.minValue || 1)) * 100}%, #3f3f46 100%)`
                        }}
                      />
                      <div className="flex justify-between mt-2">
                        {Array.from({ length: (currentQuestion.maxValue || 10) - (currentQuestion.minValue || 1) + 1 }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => handleAnswerChange(currentQuestion.id, (currentQuestion.minValue || 1) + i)}
                            className={`w-8 h-8 rounded-full text-sm transition-colors ${
                              answers[currentQuestion.id] === (currentQuestion.minValue || 1) + i
                                ? 'bg-[#E0FE10] text-black font-medium'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            {(currentQuestion.minValue || 1) + i}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between mt-10">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === -1}
                  className={`flex items-center gap-2 px-5 py-3 rounded-full text-white transition-all ${
                    currentIndex === -1
                      ? 'opacity-0 pointer-events-none'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                <button
                  onClick={handleNext}
                  disabled={!canProceed() || isSubmitting}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all ${
                    canProceed() && !isSubmitting
                      ? 'bg-[#E0FE10] text-black hover:bg-[#d0ee00]'
                      : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : isLastQuestion ? (
                    <>
                      Submit
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      {currentIndex === -1 ? 'Start' : 'Next'}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {/* Keyboard hint */}
              <p className="text-center text-zinc-600 text-sm mt-8">
                Press <kbd className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">Enter ↵</kbd> to continue
              </p>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          background: #E0FE10;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 24px;
          height: 24px;
          background: #E0FE10;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};

export default SurveyTakingModal;


