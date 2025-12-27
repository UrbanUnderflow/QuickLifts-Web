import React, { useState, useEffect } from 'react';
import { Survey, SurveyQuestion, SurveyQuestionType, SurveyQuestionOption } from '../../api/firebase/creatorPages/service';
import { v4 as uuidv4 } from 'uuid';

interface SurveyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (survey: Omit<Survey, 'id' | 'userId' | 'pageSlug' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  existingSurvey?: Survey | null;
  isClientQuestionnaire?: boolean; // When true, pre-populates with client intake questions
}

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  text: 'Text Field',
  multiple_choice: 'Multiple Choice',
  number: 'Number Picker',
  yes_no: 'Yes / No',
};

// Default client intake questionnaire questions extracted from coaching interview script
const getDefaultClientIntakeQuestions = (): SurveyQuestion[] => [
  // Goals & Motivation
  {
    id: uuidv4(),
    type: 'text',
    question: 'If we look 90 days from now, what would success look like for you?',
    required: true,
  },
  {
    id: uuidv4(),
    type: 'text',
    question: "What's the ultimate vision you have for your body and fitness?",
    required: true,
  },
  {
    id: uuidv4(),
    type: 'text',
    question: 'What has been the hardest part for you to stay consistent with in the past?',
    required: false,
  },
  {
    id: uuidv4(),
    type: 'multiple_choice',
    question: 'Do you want a slower, sustainable build-up or do you like to be pushed hard?',
    required: false,
    options: [
      { id: uuidv4(), text: 'Slower, sustainable approach' },
      { id: uuidv4(), text: 'Push me hard' },
      { id: uuidv4(), text: 'Somewhere in between' },
    ],
  },
  // Training & Exercise History
  {
    id: uuidv4(),
    type: 'text',
    question: 'What does your current workout routine look like in a typical week?',
    required: true,
  },
  {
    id: uuidv4(),
    type: 'multiple_choice',
    question: 'Do you go in with a set program or do you just wing it?',
    required: false,
    options: [
      { id: uuidv4(), text: 'I follow a structured program' },
      { id: uuidv4(), text: 'I wing it / go with the flow' },
      { id: uuidv4(), text: 'A mix of both' },
    ],
  },
  {
    id: uuidv4(),
    type: 'multiple_choice',
    question: 'How long do you usually spend in the gym?',
    required: false,
    options: [
      { id: uuidv4(), text: 'Under 30 minutes' },
      { id: uuidv4(), text: '30-45 minutes' },
      { id: uuidv4(), text: '45 minutes - 1 hour' },
      { id: uuidv4(), text: '1-1.5 hours' },
      { id: uuidv4(), text: 'Over 1.5 hours' },
    ],
  },
  {
    id: uuidv4(),
    type: 'multiple_choice',
    question: 'Do you prefer full-body workouts, or do you break things down by muscle groups?',
    required: false,
    options: [
      { id: uuidv4(), text: 'Full-body workouts' },
      { id: uuidv4(), text: 'Split by muscle groups' },
      { id: uuidv4(), text: 'No preference' },
    ],
  },
  {
    id: uuidv4(),
    type: 'text',
    question: 'Are there any exercises you feel confident with, or ones that feel challenging?',
    required: false,
  },
  {
    id: uuidv4(),
    type: 'text',
    question: 'Have you ever worked with a trainer before? What was that experience like?',
    required: false,
  },
  {
    id: uuidv4(),
    type: 'yes_no',
    question: 'Do you currently track your workouts?',
    required: false,
    options: [
      { id: uuidv4(), text: 'Yes' },
      { id: uuidv4(), text: 'No' },
    ],
  },
  // Nutrition & Habits
  {
    id: uuidv4(),
    type: 'text',
    question: 'What does a typical day of eating look like for you (breakfast, lunch, and dinner)?',
    required: true,
  },
  {
    id: uuidv4(),
    type: 'multiple_choice',
    question: 'Do you meal prep, cook on the go, or eat out more often?',
    required: false,
    options: [
      { id: uuidv4(), text: 'I meal prep regularly' },
      { id: uuidv4(), text: 'I cook on the go' },
      { id: uuidv4(), text: 'I eat out more often' },
      { id: uuidv4(), text: 'A mix of all' },
    ],
  },
  {
    id: uuidv4(),
    type: 'text',
    question: 'Are there any foods you avoid (pork, beef, dairy, allergies, etc.)?',
    required: false,
  },
  {
    id: uuidv4(),
    type: 'multiple_choice',
    question: 'Do you drink alcohol? How often?',
    required: false,
    options: [
      { id: uuidv4(), text: 'Never' },
      { id: uuidv4(), text: 'Rarely (special occasions)' },
      { id: uuidv4(), text: 'Occasionally (1-2 times per week)' },
      { id: uuidv4(), text: 'Frequently (3+ times per week)' },
    ],
  },
  {
    id: uuidv4(),
    type: 'multiple_choice',
    question: 'Do you drink caffeine? How often?',
    required: false,
    options: [
      { id: uuidv4(), text: 'Never' },
      { id: uuidv4(), text: '1 cup/serving per day' },
      { id: uuidv4(), text: '2-3 cups/servings per day' },
      { id: uuidv4(), text: '4+ cups/servings per day' },
    ],
  },
  {
    id: uuidv4(),
    type: 'text',
    question: 'Are you currently taking any supplements? If so, which ones?',
    required: false,
  },
  // Lifestyle & Schedule
  {
    id: uuidv4(),
    type: 'text',
    question: "What's your work schedule like? Do you feel it affects your energy levels or gym time?",
    required: false,
  },
  {
    id: uuidv4(),
    type: 'text',
    question: 'What time do you usually wake up and go to bed?',
    required: false,
  },
  {
    id: uuidv4(),
    type: 'multiple_choice',
    question: 'How much sleep are you getting on average?',
    required: false,
    options: [
      { id: uuidv4(), text: 'Less than 5 hours' },
      { id: uuidv4(), text: '5-6 hours' },
      { id: uuidv4(), text: '6-7 hours' },
      { id: uuidv4(), text: '7-8 hours' },
      { id: uuidv4(), text: '8+ hours' },
    ],
  },
  {
    id: uuidv4(),
    type: 'yes_no',
    question: 'Do you usually feel rested when you wake up?',
    required: false,
    options: [
      { id: uuidv4(), text: 'Yes' },
      { id: uuidv4(), text: 'No' },
    ],
  },
  {
    id: uuidv4(),
    type: 'yes_no',
    question: 'How do you feel about tracking your workouts, meals, or progress?',
    required: false,
    options: [
      { id: uuidv4(), text: "I'm open to it" },
      { id: uuidv4(), text: "I'd rather not" },
    ],
  },
];

const SurveyBuilderModal: React.FC<SurveyBuilderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingSurvey,
  isClientQuestionnaire = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (existingSurvey) {
      setTitle(existingSurvey.title);
      setDescription(existingSurvey.description || '');
      setQuestions(existingSurvey.questions || []);
    } else if (isClientQuestionnaire) {
      // Pre-populate with default client intake questions
      setTitle('');
      setDescription('Help me understand your fitness journey so I can create the best program for you.');
      setQuestions(getDefaultClientIntakeQuestions());
    } else {
      setTitle('');
      setDescription('');
      setQuestions([]);
    }
  }, [existingSurvey, isOpen, isClientQuestionnaire]);

  const addQuestion = (type: SurveyQuestionType) => {
    const newQuestion: SurveyQuestion = {
      id: uuidv4(),
      type,
      question: '',
      required: false,
      ...(type === 'multiple_choice' ? { options: [{ id: uuidv4(), text: '' }] } : {}),
      ...(type === 'number' ? { minValue: 1, maxValue: 10 } : {}),
      ...(type === 'yes_no' ? { options: [{ id: uuidv4(), text: 'Yes' }, { id: uuidv4(), text: 'No' }] } : {}),
    };
    setQuestions([...questions, newQuestion]);
    setExpandedQuestionId(newQuestion.id);
  };

  const updateQuestion = (questionId: string, updates: Partial<SurveyQuestion>) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
    if (expandedQuestionId === questionId) {
      setExpandedQuestionId(null);
    }
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options) {
        return {
          ...q,
          options: [...q.options, { id: uuidv4(), text: '' }],
        };
      }
      return q;
    }));
  };

  const updateOption = (questionId: string, optionId: string, text: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options) {
        return {
          ...q,
          options: q.options.map(opt => 
            opt.id === optionId ? { ...opt, text } : opt
          ),
        };
      }
      return q;
    }));
  };

  const removeOption = (questionId: string, optionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options) {
        return {
          ...q,
          options: q.options.filter(opt => opt.id !== optionId),
        };
      }
      return q;
    }));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a survey title');
      return;
    }
    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }
    
    // Validate questions
    for (const q of questions) {
      if (!q.question.trim()) {
        alert('All questions must have text');
        return;
      }
      if (q.type === 'multiple_choice' && (!q.options || q.options.length < 2 || q.options.some(o => !o.text.trim()))) {
        alert('Multiple choice questions need at least 2 options with text');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        id: existingSurvey?.id,
        title: title.trim(),
        description: description.trim(),
        questions,
      });
      onClose();
    } catch (err) {
      console.error('[SurveyBuilder] Failed to save:', err);
      alert('Failed to save survey. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-zinc-700">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {existingSurvey 
              ? (isClientQuestionnaire ? 'Edit Intake Form' : 'Edit Survey')
              : (isClientQuestionnaire ? 'Create Client Intake Form' : 'Create Survey')
            }
          </h2>
          <button 
            onClick={onClose}
            disabled={saving}
            className="text-zinc-400 hover:text-white text-2xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Survey Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-300 mb-2">
                {isClientQuestionnaire ? 'Form Title *' : 'Survey Title *'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isClientQuestionnaire ? "e.g., New Client Questionnaire" : "e.g., Exit Survey"}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:border-[#E0FE10] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-2">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isClientQuestionnaire 
                  ? "Message to show your clients before they start..."
                  : "Brief description of your survey..."
                }
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:border-[#E0FE10] focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Questions</h3>
              <span className="text-sm text-zinc-400">{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Question List */}
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div 
                  key={question.id}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden"
                >
                  {/* Question Header */}
                  <div 
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-750"
                    onClick={() => setExpandedQuestionId(expandedQuestionId === question.id ? null : question.id)}
                  >
                    <span className="text-zinc-400 text-sm font-medium w-8">Q{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">
                        {question.question || <span className="text-zinc-500 italic">Untitled question</span>}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {QUESTION_TYPE_LABELS[question.type]}
                        {question.required && <span className="text-[#E0FE10] ml-2">• Required</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveQuestion(index, 'up'); }}
                        disabled={index === 0}
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveQuestion(index, 'down'); }}
                        disabled={index === questions.length - 1}
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeQuestion(question.id); }}
                        className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg 
                        className={`w-5 h-5 text-zinc-400 transition-transform ${expandedQuestionId === question.id ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Question Editor (Expanded) */}
                  {expandedQuestionId === question.id && (
                    <div className="p-4 pt-0 space-y-4 border-t border-zinc-700">
                      {/* Question Text */}
                      <div>
                        <label className="block text-sm text-zinc-300 mb-2">Question Text *</label>
                        <input
                          type="text"
                          value={question.question}
                          onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                          placeholder="Enter your question..."
                          className="w-full bg-zinc-900 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:border-[#E0FE10] focus:outline-none transition-colors"
                        />
                      </div>

                      {/* Required Toggle */}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div 
                          className={`w-10 h-6 rounded-full transition-colors ${question.required ? 'bg-[#E0FE10]' : 'bg-zinc-600'}`}
                          onClick={() => updateQuestion(question.id, { required: !question.required })}
                        >
                          <div 
                            className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform mt-0.5 ${question.required ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`}
                          />
                        </div>
                        <span className="text-sm text-zinc-300">Required</span>
                      </label>

                      {/* Multiple Choice Options */}
                      {question.type === 'multiple_choice' && (
                        <div>
                          <label className="block text-sm text-zinc-300 mb-2">Options</label>
                          <div className="space-y-2">
                            {question.options?.map((option, optIndex) => (
                              <div key={option.id} className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full border-2 border-zinc-600 flex items-center justify-center text-xs text-zinc-400">
                                  {String.fromCharCode(65 + optIndex)}
                                </span>
                                <input
                                  type="text"
                                  value={option.text}
                                  onChange={(e) => updateOption(question.id, option.id, e.target.value)}
                                  placeholder={`Option ${optIndex + 1}`}
                                  className="flex-1 bg-zinc-900 border border-zinc-600 rounded-lg p-2 text-white placeholder-zinc-400 text-sm focus:border-[#E0FE10] focus:outline-none transition-colors"
                                />
                                {(question.options?.length || 0) > 1 && (
                                  <button
                                    onClick={() => removeOption(question.id, option.id)}
                                    className="p-2 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => addOption(question.id)}
                            className="mt-2 text-sm text-[#E0FE10] hover:text-[#d0ee00] transition-colors flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Option
                          </button>
                        </div>
                      )}

                      {/* Number Range */}
                      {question.type === 'number' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-zinc-300 mb-2">Min Value</label>
                            <input
                              type="number"
                              value={question.minValue || 1}
                              onChange={(e) => updateQuestion(question.id, { minValue: parseInt(e.target.value) || 1 })}
                              className="w-full bg-zinc-900 border border-zinc-600 rounded-lg p-2 text-white text-sm focus:border-[#E0FE10] focus:outline-none transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-zinc-300 mb-2">Max Value</label>
                            <input
                              type="number"
                              value={question.maxValue || 10}
                              onChange={(e) => updateQuestion(question.id, { maxValue: parseInt(e.target.value) || 10 })}
                              className="w-full bg-zinc-900 border border-zinc-600 rounded-lg p-2 text-white text-sm focus:border-[#E0FE10] focus:outline-none transition-colors"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Question Buttons */}
            <div className="mt-4">
              <p className="text-sm text-zinc-400 mb-3">Add a question:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => addQuestion('text')}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-sm text-white hover:bg-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Text Field
                </button>
                <button
                  onClick={() => addQuestion('multiple_choice')}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-sm text-white hover:bg-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Multiple Choice
                </button>
                <button
                  onClick={() => addQuestion('yes_no')}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-sm text-white hover:bg-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                  Yes / No
                </button>
                <button
                  onClick={() => addQuestion('number')}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-sm text-white hover:bg-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  Number Picker
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-zinc-700">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-zinc-700 text-white px-4 py-3 rounded-lg hover:bg-zinc-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#E0FE10] text-black px-4 py-3 rounded-lg hover:bg-[#d0ee00] transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            )}
            {saving 
              ? 'Saving...' 
              : (existingSurvey 
                  ? 'Save Changes' 
                  : (isClientQuestionnaire ? 'Create Intake Form' : 'Create Survey')
                )
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyBuilderModal;


