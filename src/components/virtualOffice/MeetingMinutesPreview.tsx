import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  X, Download, Save, Trash2, FileText,
  Lightbulb, HelpCircle, CheckSquare, MessageSquare,
  Target, Loader2, Sparkles
} from 'lucide-react';
import { meetingMinutesService } from '../../api/firebase/meetingMinutes/service';
import type { MeetingMinutes } from '../../api/firebase/meetingMinutes/types';
import type { GroupChatMessage } from '../../api/firebase/groupChat/types';

interface MeetingMinutesPreviewProps {
  chatId: string;
  messages: GroupChatMessage[];
  participants: string[];
  duration: string;
  onSaveAndClose: () => void;
  onDiscard: () => void;
}

const AGENT_COLORS: Record<string, string> = {
  nora: '#22c55e',
  scout: '#f59e0b',
  solara: '#f43f5e',
  default: '#8b5cf6',
};

export const MeetingMinutesPreview: React.FC<MeetingMinutesPreviewProps> = ({
  chatId,
  messages,
  participants,
  duration,
  onSaveAndClose,
  onDiscard,
}) => {
  const [minutes, setMinutes] = useState<Omit<MeetingMinutes, 'id' | 'createdAt'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    generateMinutes();
  }, []);

  const generateMinutes = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await meetingMinutesService.generate(
        chatId,
        messages as any,
        participants,
        duration
      );
      setMinutes(result);
    } catch (e: any) {
      setError(e.message || 'Failed to generate minutes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!minutes) return;
    setSaving(true);
    try {
      await meetingMinutesService.save(minutes);
      onSaveAndClose();
    } catch (e: any) {
      setError('Failed to save: ' + e.message);
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!minutes) return;
    try {
      setLoading(true);
      const html = meetingMinutesService.toHTML({
        ...minutes,
        createdAt: new Date(),
      } as MeetingMinutes);
      const pdfBlob = await import('../../utils/pdf').then(mod => mod.renderHtmlToPdf(html));
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-minutes-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate PDF minutes:', err);
      setError('Failed to generate PDF minutes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const totalResponses = messages.reduce((acc, msg) =>
    acc + Object.values(msg.responses).filter(r => r.status === 'completed').length, 0
  );

  const modal = (
    <div className="mm-overlay">
      <div className="mm-modal">
        {/* Header */}
        <div className="mm-header">
          <div className="mm-header-left">
            <div className="mm-header-icon">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="mm-title">Meeting Minutes</h2>
              <p className="mm-subtitle">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}{duration}{' · '}{messages.length} messages · {totalResponses} responses
              </p>
            </div>
          </div>
          <div className="mm-header-actions">
            {minutes && (
              <>
                <button className="mm-btn mm-btn-ghost" onClick={handleDownload} title="Download as PDF">
                  <Download className="w-4 h-4" />
                </button>
                <button
                  className="mm-btn mm-btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save to Cabinet'}
                </button>
              </>
            )}
            <button className="mm-btn mm-btn-ghost" onClick={onDiscard} title="Discard">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mm-content">
          {loading && (
            <div className="mm-loading">
              <div className="mm-loading-spinner">
                <Sparkles className="w-8 h-8" />
              </div>
              <p className="mm-loading-text">Generating meeting minutes...</p>
              <p className="mm-loading-sub">Analyzing {messages.length} messages from {participants.length} participants</p>
            </div>
          )}

          {error && !loading && (
            <div className="mm-error">
              <p>{error}</p>
              <button className="mm-btn mm-btn-ghost" onClick={generateMinutes}>Retry</button>
            </div>
          )}

          {minutes && !loading && (
            <div className="mm-sections">
              {/* Participants */}
              <div className="mm-participants">
                {participants.map(p => {
                  const color = AGENT_COLORS[p] || AGENT_COLORS.default;
                  return (
                    <span key={p} className="mm-participant" style={{ borderColor: `${color}40`, color }}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  );
                })}
                <span className="mm-participant" style={{ borderColor: '#6366f140', color: '#6366f1' }}>
                  Tremaine
                </span>
              </div>

              {/* Executive Summary */}
              <section className="mm-section">
                <div className="mm-section-header">
                  <Target className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                  <h3>Executive Summary</h3>
                </div>
                <p className="mm-section-body mm-summary">{minutes.executiveSummary}</p>
              </section>

              {/* Highlights */}
              {(minutes.highlights && minutes.highlights.length > 0) && (
                <section className="mm-section">
                  <div className="mm-section-header">
                    <MessageSquare className="w-4 h-4" style={{ color: '#3b82f6' }} />
                    <h3>Highlights</h3>
                  </div>
                  <ul className="mm-list">
                    {minutes.highlights?.map((highlight, i) => (
                      <li key={i}>
                        <strong>{highlight.speaker}:</strong> {highlight.summary}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Value Insights */}
              {(minutes.valueInsights && minutes.valueInsights.length > 0) && (
                <section className="mm-section">
                  <div className="mm-section-header">
                    <Lightbulb className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    <h3>Value Insights</h3>
                  </div>
                  <div className="mm-topics">
                    {minutes.valueInsights?.map((insight, i) => (
                      <div key={i} className="mm-topic">
                        <h4 className="mm-topic-title">{insight.title}</h4>
                        <p className="mm-topic-summary">{insight.takeaway}</p>
                        <p className="mm-topic-impact">Impact: {insight.impact}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Strategic Decisions */}
              {(minutes.strategicDecisions && minutes.strategicDecisions.length > 0) && (
                <section className="mm-section">
                  <div className="mm-section-header">
                    <CheckSquare className="w-4 h-4" style={{ color: '#22c55e' }} />
                    <h3>Strategic Decisions</h3>
                  </div>
                  <ul className="mm-list mm-decisions">
                    {minutes.strategicDecisions?.map((decision, i) => (
                      <li key={i}>{decision}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Risks / Open Questions */}
              {(minutes.risksOrOpenQuestions && minutes.risksOrOpenQuestions.length > 0) && (
                <section className="mm-section">
                  <div className="mm-section-header">
                    <HelpCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
                    <h3>Risks & Open Questions</h3>
                  </div>
                  <ul className="mm-list mm-questions">
                    {minutes.risksOrOpenQuestions?.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Next Actions */}
              {(minutes.nextActions && minutes.nextActions.length > 0) && (
                <section className="mm-section">
                  <div className="mm-section-header">
                    <Sparkles className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                    <h3>Next Actions</h3>
                  </div>
                  <div className="mm-actions">
                    {minutes.nextActions?.map((item, i) => (
                      <div key={i} className="mm-action-item">
                        <div className="mm-action-checkbox" />
                        <div className="mm-action-content">
                          <span className="mm-action-task">{item.task}</span>
                          <span className="mm-action-owner">{item.owner}{item.due ? (" (Due: " + item.due + ")") : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .mm-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(8px);
          animation: mmFadeIn 0.3s ease-out;
        }
        @keyframes mmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .mm-modal {
          width: 680px;
          max-height: 85vh;
          background: linear-gradient(145deg, #1a1a2e 0%, #16162a 100%);
          border: 1px solid rgba(139,92,246,0.15);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.05);
          animation: mmSlideUp 0.35s ease-out;
        }
        @keyframes mmSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .mm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid rgba(63,63,70,0.2);
        }
        .mm-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .mm-header-icon {
          width: 40px; height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.15));
          border: 1px solid rgba(139,92,246,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
        }
        .mm-title {
          font-size: 16px;
          font-weight: 700;
          color: #e4e4e7;
          margin: 0;
        }
        .mm-subtitle {
          font-size: 11px;
          color: #71717a;
          margin: 2px 0 0;
        }
        .mm-header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .mm-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.15s ease;
        }
        .mm-btn-ghost {
          background: transparent;
          color: #a1a1aa;
          padding: 7px 8px;
        }
        .mm-btn-ghost:hover {
          background: rgba(255,255,255,0.06);
          color: #e4e4e7;
        }
        .mm-btn-primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }
        .mm-btn-primary:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .mm-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .mm-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px 24px;
        }

        /* Loading state */
        .mm-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 0;
          text-align: center;
        }
        .mm-loading-spinner {
          width: 56px; height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.1));
          border: 1px solid rgba(139,92,246,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
          animation: mmPulse 2s ease-in-out infinite;
          margin-bottom: 16px;
        }
        @keyframes mmPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.7; }
        }
        .mm-loading-text {
          font-size: 14px;
          font-weight: 600;
          color: #d4d4d8;
          margin: 0;
        }
        .mm-loading-sub {
          font-size: 12px;
          color: #71717a;
          margin: 4px 0 0;
        }

        .mm-error {
          text-align: center;
          padding: 40px;
          color: #fca5a5;
          font-size: 13px;
        }

        /* Sections */
        .mm-sections {
          animation: mmContentIn 0.4s ease-out;
        }
        @keyframes mmContentIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .mm-participants {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 20px;
        }
        .mm-participant {
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid;
          font-size: 11px;
          font-weight: 600;
        }

        .mm-section {
          margin-bottom: 22px;
        }
        .mm-section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .mm-section-header h3 {
          font-size: 13px;
          font-weight: 700;
          color: #d4d4d8;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .mm-section-body {
          font-size: 13px;
          line-height: 1.6;
          color: #a1a1aa;
          margin: 0;
        }
        .mm-summary {
          padding: 14px 16px;
          background: rgba(139,92,246,0.06);
          border: 1px solid rgba(139,92,246,0.1);
          border-radius: 12px;
          color: #c4b5fd;
        }

        .mm-topics {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mm-topic {
          padding: 12px 14px;
          background: rgba(59,130,246,0.05);
          border: 1px solid rgba(59,130,246,0.08);
          border-radius: 10px;
        }
        .mm-topic-title {
          font-size: 13px;
          font-weight: 600;
          color: #93c5fd;
          margin: 0 0 4px;
        }
        .mm-topic-summary {
          font-size: 12px;
          color: #a1a1aa;
          margin: 0;
          line-height: 1.5;
        }
        .mm-topic-impact {
          font-size: 12px;
          color: #fcd34d;
          margin-top: 4px;
          font-weight: 600;
        }

        .mm-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mm-list li {
          font-size: 12.5px;
          color: #a1a1aa;
          line-height: 1.5;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(63,63,70,0.15);
          position: relative;
          padding-left: 24px;
        }
        .mm-list li::before {
          content: '';
          position: absolute;
          left: 10px;
          top: 14px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #52525b;
        }
        .mm-list.mm-decisions li::before { background: #22c55e; }
        .mm-list.mm-questions li::before { background: #ef4444; }

        .mm-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mm-action-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(139,92,246,0.04);
          border: 1px solid rgba(139,92,246,0.08);
          border-radius: 10px;
        }
        .mm-action-checkbox {
          width: 16px; height: 16px;
          border-radius: 4px;
          border: 2px solid rgba(139,92,246,0.3);
          flex-shrink: 0;
          margin-top: 1px;
        }
        .mm-action-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .mm-action-task {
          font-size: 12.5px;
          color: #d4d4d8;
          line-height: 1.4;
        }
        .mm-action-owner {
          font-size: 10px;
          color: #8b5cf6;
          font-weight: 600;
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};
