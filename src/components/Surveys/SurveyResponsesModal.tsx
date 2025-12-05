import React, { useState, useMemo } from 'react';
import { Survey, SurveyResponse, SurveyQuestion } from '../../api/firebase/creatorPages/service';

interface SurveyResponsesModalProps {
  isOpen: boolean;
  onClose: () => void;
  survey: Survey | null;
  responses: SurveyResponse[];
  loading: boolean;
}

const SurveyResponsesModal: React.FC<SurveyResponsesModalProps> = ({
  isOpen,
  onClose,
  survey,
  responses,
  loading,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'summary'>('list');
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);

  // Calculate summary stats for each question
  const summaryData = useMemo(() => {
    if (!survey || responses.length === 0) return {};
    
    const summary: { [questionId: string]: any } = {};
    
    survey.questions.forEach(question => {
      if (question.type === 'multiple_choice' || question.type === 'yes_no') {
        const counts: { [option: string]: number } = {};
        if (question.type === 'yes_no') {
          counts['Yes'] = 0;
          counts['No'] = 0;
        } else {
          question.options?.forEach(opt => {
            counts[opt.text] = 0;
          });
        }
        
        responses.forEach(response => {
          const answer = response.answers[question.id];
          if (typeof answer === 'string' && counts[answer] !== undefined) {
            counts[answer]++;
          }
        });
        
        summary[question.id] = { type: question.type === 'yes_no' ? 'yes_no' : 'multiple_choice', counts, total: responses.length };
      } else if (question.type === 'number') {
        const values = responses
          .map(r => r.answers[question.id])
          .filter(v => typeof v === 'number') as number[];
        
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          summary[question.id] = {
            type: 'number',
            average: (sum / values.length).toFixed(1),
            min: Math.min(...values),
            max: Math.max(...values),
            count: values.length,
          };
        }
      } else {
        // Text responses - just count
        const textResponses = responses
          .map(r => r.answers[question.id])
          .filter(v => typeof v === 'string' && v.trim());
        summary[question.id] = { type: 'text', count: textResponses.length };
      }
    });
    
    return summary;
  }, [survey, responses]);

  const selectedResponse = selectedResponseId 
    ? responses.find(r => r.id === selectedResponseId) 
    : null;

  const getQuestionById = (questionId: string): SurveyQuestion | undefined => {
    return survey?.questions.find(q => q.id === questionId);
  };

  const formatAnswer = (questionId: string, answer: string | number | string[] | undefined): string => {
    if (answer === undefined || answer === null) return '—';
    if (Array.isArray(answer)) return answer.join(', ');
    return String(answer);
  };

  const exportToCSV = () => {
    if (!survey || responses.length === 0) return;
    
    const headers = ['Respondent Name', 'Email', 'Submitted At', ...survey.questions.map(q => q.question)];
    const rows = responses.map(response => [
      response.respondentName || 'Anonymous',
      response.respondentEmail || '',
      response.createdAt?.toDate ? response.createdAt.toDate().toLocaleString() : 'N/A',
      ...survey.questions.map(q => formatAnswer(q.id, response.answers[q.id])),
    ]);
    
    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${survey.title.replace(/[^a-z0-9]/gi, '_')}_responses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!isOpen || !survey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-zinc-700">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{survey.title}</h2>
            <p className="text-zinc-400 text-sm mt-1">
              {responses.length} response{responses.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {responses.length > 0 && (
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-[#E0FE10] text-black px-3 py-1.5 rounded-lg hover:bg-[#d0ee00] text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white text-2xl transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        {responses.length > 0 && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setViewMode('list'); setSelectedResponseId(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'list' 
                  ? 'bg-[#E0FE10] text-black' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Individual Responses
            </button>
            <button
              onClick={() => { setViewMode('summary'); setSelectedResponseId(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'summary' 
                  ? 'bg-[#E0FE10] text-black' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Summary
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#E0FE10] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="w-16 h-16 text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-zinc-300 mb-2">No responses yet</h3>
              <p className="text-zinc-500 text-sm">Share your survey link to start collecting responses</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="flex gap-4 h-full">
              {/* Response List */}
              <div className={`${selectedResponseId ? 'w-1/3' : 'w-full'} space-y-2 transition-all`}>
                {responses.map((response, index) => (
                  <button
                    key={response.id}
                    onClick={() => setSelectedResponseId(response.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedResponseId === response.id
                        ? 'bg-[#E0FE10]/10 border-[#E0FE10]/30'
                        : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">
                          {response.respondentName || `Response #${index + 1}`}
                        </p>
                        {response.respondentEmail && (
                          <p className="text-zinc-400 text-sm">{response.respondentEmail}</p>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">
                        {response.createdAt?.toDate 
                          ? response.createdAt.toDate().toLocaleDateString() 
                          : 'Just now'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected Response Detail */}
              {selectedResponse && (
                <div className="flex-1 bg-zinc-800 rounded-lg p-4 overflow-y-auto border border-zinc-700">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-700">
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {selectedResponse.respondentName || 'Anonymous'}
                      </h3>
                      {selectedResponse.respondentEmail && (
                        <p className="text-zinc-400 text-sm">{selectedResponse.respondentEmail}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedResponseId(null)}
                      className="text-zinc-400 hover:text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {survey.questions.map((question, index) => (
                      <div key={question.id} className="bg-zinc-900 rounded-lg p-4">
                        <p className="text-sm text-zinc-400 mb-1">Q{index + 1}</p>
                        <p className="text-white font-medium mb-2">{question.question}</p>
                        <p className="text-[#E0FE10]">
                          {formatAnswer(question.id, selectedResponse.answers[question.id])}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Summary View */
            <div className="space-y-6">
              {survey.questions.map((question, index) => {
                const data = summaryData[question.id];
                
                return (
                  <div key={question.id} className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                    <div className="flex items-start gap-3 mb-4">
                      <span className="bg-zinc-700 text-zinc-300 text-xs px-2 py-1 rounded">Q{index + 1}</span>
                      <p className="text-white font-medium flex-1">{question.question}</p>
                    </div>
                    
                    {(question.type === 'multiple_choice' || question.type === 'yes_no') && data && (
                      <div className="space-y-2">
                        {Object.entries(data.counts as { [key: string]: number }).map(([option, count]) => {
                          const percentage = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
                          const isYes = option === 'Yes';
                          const isNo = option === 'No';
                          const barColor = question.type === 'yes_no' 
                            ? (isYes ? 'bg-emerald-500' : isNo ? 'bg-red-500' : 'bg-[#E0FE10]')
                            : 'bg-[#E0FE10]';
                          return (
                            <div key={option}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-zinc-300 flex items-center gap-2">
                                  {question.type === 'yes_no' && isYes && (
                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  {question.type === 'yes_no' && isNo && (
                                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                  {option}
                                </span>
                                <span className="text-zinc-400">{count} ({percentage}%)</span>
                              </div>
                              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${barColor} rounded-full transition-all`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {question.type === 'number' && data && (
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-zinc-900 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-[#E0FE10]">{data.average}</p>
                          <p className="text-xs text-zinc-400">Average</p>
                        </div>
                        <div className="bg-zinc-900 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-white">{data.min}</p>
                          <p className="text-xs text-zinc-400">Min</p>
                        </div>
                        <div className="bg-zinc-900 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-white">{data.max}</p>
                          <p className="text-xs text-zinc-400">Max</p>
                        </div>
                        <div className="bg-zinc-900 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-white">{data.count}</p>
                          <p className="text-xs text-zinc-400">Responses</p>
                        </div>
                      </div>
                    )}
                    
                    {question.type === 'text' && data && (
                      <div className="bg-zinc-900 rounded-lg p-3">
                        <p className="text-zinc-300">
                          <span className="text-[#E0FE10] font-medium">{data.count}</span> text response{data.count !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Switch to Individual Responses view to read each answer
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="w-full bg-zinc-700 text-white px-4 py-3 rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyResponsesModal;


