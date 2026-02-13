import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
    X, FolderOpen, FileText, Download, Trash2,
    ChevronRight, ChevronDown, Calendar, Clock,
    Users, MessageSquare, Target, Lightbulb,
    HelpCircle, CheckSquare, Sparkles, Archive,
} from 'lucide-react';
import { meetingMinutesService } from '../../api/firebase/meetingMinutes/service';
import type { MeetingMinutes } from '../../api/firebase/meetingMinutes/types';

interface FilingCabinetProps {
    onClose: () => void;
}

const AGENT_COLORS: Record<string, string> = {
    nora: '#22c55e',
    scout: '#f59e0b',
    solara: '#f43f5e',
    default: '#8b5cf6',
};

export const FilingCabinet: React.FC<FilingCabinetProps> = ({ onClose }) => {
    const [minutesList, setMinutesList] = useState<MeetingMinutes[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        loadMinutes();
    }, []);

    const loadMinutes = async () => {
        setLoading(true);
        try {
            const list = await meetingMinutesService.getAll();
            setMinutesList(list);
        } catch (e) {
            console.error('Failed to load minutes:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (minutes: MeetingMinutes, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const html = meetingMinutesService.toHTML(minutes);
            const pdfBlob = await import('../../utils/pdf').then(mod => mod.renderHtmlToPdf(html));
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            const date = minutes.createdAt instanceof Date
                ? minutes.createdAt
                : (minutes.createdAt as any)?.toDate?.() || new Date();
            a.download = `meeting-minutes-${date.toISOString().split('T')[0]}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download PDF minutes:', err);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm('Delete these meeting minutes?')) return;
        setDeletingId(id);
        try {
            await meetingMinutesService.delete(id);
            setMinutesList(prev => prev.filter(m => m.id !== id));
            if (expandedId === id) setExpandedId(null);
        } catch (e) {
            console.error('Failed to delete:', e);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (date: any): string => {
        const d = date?.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        });
    };

    const formatTime = (date: any): string => {
        const d = date?.toDate ? date.toDate() : new Date(date);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const panel = (
        <div className="fc-overlay" onClick={onClose}>
            <div className="fc-panel" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="fc-header">
                    <div className="fc-header-left">
                        <div className="fc-header-icon">
                            <Archive className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="fc-title">Filing Cabinet</h2>
                            <p className="fc-subtitle">{minutesList.length} meeting{minutesList.length !== 1 ? 's' : ''} recorded</p>
                        </div>
                    </div>
                    <button className="fc-close" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="fc-content">
                    {loading && (
                        <div className="fc-empty">
                            <div className="fc-loader" />
                            <p>Loading minutes...</p>
                        </div>
                    )}

                    {!loading && minutesList.length === 0 && (
                        <div className="fc-empty">
                            <FolderOpen className="w-10 h-10 fc-empty-icon" />
                            <p className="fc-empty-title">No meeting minutes yet</p>
                            <p className="fc-empty-desc">
                                Finish a Round Table session and save the minutes to see them here.
                            </p>
                        </div>
                    )}

                    {!loading && minutesList.map(minutes => {
                        const isExpanded = expandedId === minutes.id;
                        return (
                            <div
                                key={minutes.id}
                                className={`fc-item ${isExpanded ? 'fc-item-expanded' : ''}`}
                            >
                                {/* Summary row */}
                                <div
                                    className="fc-item-header"
                                    onClick={() => setExpandedId(isExpanded ? null : minutes.id!)}
                                >
                                    <div className="fc-item-chevron">
                                        {isExpanded
                                            ? <ChevronDown className="w-3.5 h-3.5" />
                                            : <ChevronRight className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="fc-item-icon">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="fc-item-info">
                                        <span className="fc-item-date">{formatDate(minutes.createdAt)}</span>
                                        <span className="fc-item-meta">
                                            {minutes.duration} · {minutes.messageCount} msgs · {minutes.participants.length} agents
                                        </span>
                                    </div>
                                    <div className="fc-item-actions">
                                        <button
                                            className="fc-icon-btn"
                                            onClick={(e) => handleDownload(minutes, e)}
                                            title="Download"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            className="fc-icon-btn fc-icon-btn-danger"
                                            onClick={(e) => handleDelete(minutes.id!, e)}
                                            title="Delete"
                                            disabled={deletingId === minutes.id}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="fc-item-body">
                                        {/* Participants */}
                                        <div className="fc-participants">
                                            {minutes.participants.map(p => (
                                                <span key={p} className="fc-badge" style={{
                                                    borderColor: `${AGENT_COLORS[p] || AGENT_COLORS.default}40`,
                                                    color: AGENT_COLORS[p] || AGENT_COLORS.default,
                                                }}>
                                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                                </span>
                                            ))}
                                            <span className="fc-badge" style={{
                                                borderColor: '#6366f140', color: '#6366f1',
                                            }}>Tremaine</span>
                                        </div>

                                        {/* Summary */}
                                        <div className="fc-section">
                                            <h4><Target className="w-3 h-3" /> Executive Summary</h4>
                                            <p>{minutes.executiveSummary}</p>
                                        </div>

                                        {/* Highlights */}
                                        {(minutes.highlights && minutes.highlights.length > 0) && (
                                            <div className="fc-section">
                                                <h4><MessageSquare className="w-3 h-3" /> Highlights</h4>
                                                <ul>{minutes.highlights?.map((h, i) => <li key={i}><strong>{h.speaker}:</strong> {h.summary}</li>)}</ul>
                                            </div>
                                        )}

                                        {/* Value Insights */}
                                        {(minutes.valueInsights && minutes.valueInsights.length > 0) && (
                                            <div className="fc-section">
                                                <h4><Lightbulb className="w-3 h-3" /> Value Insights</h4>
                                                {minutes.valueInsights?.map((insight, i) => (
                                                    <div key={i} className="fc-topic">
                                                        <strong>{insight.title}:</strong> {insight.takeaway}
                                                        <div className="fc-topic-impact">Impact: {insight.impact}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Strategic Decisions */}
                                        {(minutes.strategicDecisions && minutes.strategicDecisions.length > 0) && (
                                            <div className="fc-section">
                                                <h4><CheckSquare className="w-3 h-3" /> Strategic Decisions</h4>
                                                <ul>{minutes.strategicDecisions?.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                            </div>
                                        )}

                                        {/* Risks / Open Questions */}
                                        {(minutes.risksOrOpenQuestions && minutes.risksOrOpenQuestions.length > 0) && (
                                            <div className="fc-section">
                                                <h4><HelpCircle className="w-3 h-3" /> Risks & Open Questions</h4>
                                                <ul>{minutes.risksOrOpenQuestions?.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                            </div>
                                        )}

                                        {/* Next Actions */}
                                        {(minutes.nextActions && minutes.nextActions.length > 0) && (
                                            <div className="fc-section">
                                                <h4><Sparkles className="w-3 h-3" /> Next Actions</h4>
                                                {minutes.nextActions?.map((a, i) => (
                                                    <div key={i} className="fc-action-row">
                                                        <div className="fc-checkbox" />
                                                        <span className="fc-action-text">{a.task}</span>
                                                        <span className="fc-action-owner">{a.owner}{a.due ? (" (Due: " + a.due + ")") : ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <style jsx>{`
        .fc-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          display: flex;
          justify-content: flex-end;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          animation: fcFade 0.2s ease-out;
        }
        @keyframes fcFade { from { opacity: 0; } to { opacity: 1; } }

        .fc-panel {
          width: 440px;
          max-width: 90vw;
          height: 100vh;
          background: linear-gradient(180deg, #1a1a2e 0%, #131325 100%);
          border-left: 1px solid rgba(139,92,246,0.1);
          display: flex;
          flex-direction: column;
          animation: fcSlideIn 0.3s ease-out;
          box-shadow: -10px 0 40px rgba(0,0,0,0.4);
        }
        @keyframes fcSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .fc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 20px 16px;
          border-bottom: 1px solid rgba(63,63,70,0.15);
        }
        .fc-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .fc-header-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(234,179,8,0.1));
          border: 1px solid rgba(245,158,11,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fbbf24;
        }
        .fc-title {
          font-size: 15px;
          font-weight: 700;
          color: #e4e4e7;
          margin: 0;
        }
        .fc-subtitle {
          font-size: 11px;
          color: #71717a;
          margin: 2px 0 0;
        }
        .fc-close {
          width: 30px; height: 30px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #71717a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fc-close:hover { background: rgba(255,255,255,0.06); color: #e4e4e7; }

        .fc-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        /* Empty state */
        .fc-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }
        .fc-empty-icon { color: #3f3f46; margin-bottom: 12px; }
        .fc-empty-title { font-size: 14px; font-weight: 600; color: #52525b; margin: 0; }
        .fc-empty-desc { font-size: 12px; color: #3f3f46; margin: 6px 0 0; max-width: 260px; }
        .fc-loader {
          width: 32px; height: 32px;
          border: 2px solid rgba(139,92,246,0.15);
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: fcSpin 0.8s linear infinite;
          margin-bottom: 12px;
        }
        @keyframes fcSpin { to { transform: rotate(360deg); } }

        /* Item */
        .fc-item {
          border-radius: 12px;
          border: 1px solid rgba(63,63,70,0.12);
          background: rgba(255,255,255,0.015);
          margin-bottom: 8px;
          overflow: hidden;
          transition: border-color 0.15s ease;
        }
        .fc-item:hover { border-color: rgba(139,92,246,0.15); }
        .fc-item-expanded { border-color: rgba(139,92,246,0.2); background: rgba(139,92,246,0.02); }

        .fc-item-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          cursor: pointer;
          user-select: none;
        }
        .fc-item-chevron { color: #52525b; flex-shrink: 0; }
        .fc-item-icon { color: #71717a; flex-shrink: 0; }
        .fc-item-info { flex: 1; min-width: 0; }
        .fc-item-date {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: #d4d4d8;
        }
        .fc-item-meta {
          display: block;
          font-size: 10.5px;
          color: #52525b;
          margin-top: 1px;
        }
        .fc-item-actions { display: flex; gap: 4px; }

        .fc-icon-btn {
          width: 28px; height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #52525b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
        }
        .fc-icon-btn:hover { background: rgba(255,255,255,0.06); color: #a1a1aa; }
        .fc-icon-btn-danger:hover { color: #fca5a5; background: rgba(239,68,68,0.1); }

        /* Expanded body */
        .fc-item-body {
          padding: 0 14px 14px;
          border-top: 1px solid rgba(63,63,70,0.1);
          animation: fcExpand 0.2s ease-out;
        }
        @keyframes fcExpand {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 2000px; }
        }

        .fc-participants {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 10px 0 6px;
        }
        .fc-badge {
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid;
          font-size: 10px;
          font-weight: 600;
        }

        .fc-section {
          margin-top: 12px;
        }
        .fc-section h4 {
          font-size: 11px;
          font-weight: 700;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin: 0 0 6px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .fc-section p {
          font-size: 12px;
          color: #a1a1aa;
          margin: 0;
          line-height: 1.5;
        }
        .fc-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .fc-section li {
          font-size: 11.5px;
          color: #a1a1aa;
          line-height: 1.4;
          padding: 3px 0 3px 14px;
          position: relative;
        }
        .fc-section li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: #52525b;
        }
        .fc-topic {
          font-size: 11.5px;
          color: #a1a1aa;
          margin-bottom: 4px;
          line-height: 1.4;
        }
        .fc-topic strong { color: #93c5fd; }
        .fc-topic-impact {
          display: block;
          font-size: 11px;
          color: #fcd34d;
          margin-top: 2px;
          font-weight: 600;
        }

        .fc-action-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
        }
        .fc-checkbox {
          width: 12px; height: 12px;
          border-radius: 3px;
          border: 1.5px solid rgba(139,92,246,0.3);
          flex-shrink: 0;
        }
        .fc-action-text {
          font-size: 11.5px;
          color: #d4d4d8;
          flex: 1;
        }
        .fc-action-owner {
          font-size: 10px;
          color: #8b5cf6;
          font-weight: 600;
          flex-shrink: 0;
        }
      `}</style>
        </div>
    );

    return ReactDOM.createPortal(panel, document.body);
};
