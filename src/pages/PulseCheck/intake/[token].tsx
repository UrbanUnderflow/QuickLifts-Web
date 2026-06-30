import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import type { PulseCheckIntakeResponses, SurveyQuestion } from '../../../api/firebase/pulsecheckProvisioning/types';

interface IntakeLinkPayload {
  token: string;
  status: string;
  teamName: string;
  targetEmail: string;
  intakeFormVersion: string;
  questions: SurveyQuestion[];
  responses: PulseCheckIntakeResponses;
}

const isAnswered = (value: PulseCheckIntakeResponses[string] | undefined) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim().length > 0;
};

const readInputValue = (question: SurveyQuestion, answers: PulseCheckIntakeResponses) => {
  const value = answers[question.id];
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

export default function PulseCheckCoachIntakeDraftPage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [payload, setPayload] = useState<IntakeLinkPayload | null>(null);
  const [answers, setAnswers] = useState<PulseCheckIntakeResponses>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`/api/pulsecheck/intake/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Unable to load this intake link.');
        return body as IntakeLinkPayload;
      })
      .then((body) => {
        if (cancelled) return;
        setPayload(body);
        setAnswers(body.responses || {});
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load this intake link.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const questions = payload?.questions || [];
  const activeQuestion = questions[activeIndex] || null;
  const progress = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.round(((activeIndex + (complete ? 1 : 0)) / questions.length) * 100);
  }, [activeIndex, complete, questions.length]);

  const setAnswer = (questionId: string, value: PulseCheckIntakeResponses[string] | undefined) => {
    setAnswers((current) => {
      const next = { ...current };
      if (value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)) {
        delete next[questionId];
      } else {
        next[questionId] = value;
      }
      return next;
    });
  };

  const saveAnswers = async (nextAnswers = answers) => {
    if (!token || !payload) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/pulsecheck/intake/${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: nextAnswers,
          intakeFormVersion: payload.intakeFormVersion,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to save this answer.');
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this answer.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (!activeQuestion) return;
    if (activeQuestion.required && !isAnswered(answers[activeQuestion.id])) {
      setError('This answer is required before moving on.');
      return;
    }
    await saveAnswers();
    if (activeIndex >= questions.length - 1) {
      setComplete(true);
      return;
    }
    setActiveIndex((current) => current + 1);
  };

  const handleBack = async () => {
    if (activeIndex <= 0) return;
    await saveAnswers();
    setActiveIndex((current) => Math.max(0, current - 1));
  };

  const renderInput = () => {
    if (!activeQuestion) return null;
    const value = readInputValue(activeQuestion, answers);
    if (activeQuestion.type === 'yes_no') {
      return (
        <div className="pci-choiceGrid">
          {['Yes', 'No'].map((label) => (
            <button
              key={label}
              type="button"
              className={`pci-choice ${value === label ? 'is-selected' : ''}`}
              onClick={() => setAnswer(activeQuestion.id, label)}
            >
              {label}
            </button>
          ))}
        </div>
      );
    }
    if (activeQuestion.type === 'multiple_choice') {
      return (
        <div className="pci-choiceGrid">
          {(activeQuestion.options || []).map((option) => (
            <button
              key={option.id}
              type="button"
              className={`pci-choice ${value === option.text ? 'is-selected' : ''}`}
              onClick={() => setAnswer(activeQuestion.id, option.text)}
            >
              {option.text}
            </button>
          ))}
        </div>
      );
    }
    if (activeQuestion.type === 'number') {
      return (
        <input
          className="pci-input"
          type="number"
          min={activeQuestion.minValue}
          max={activeQuestion.maxValue}
          value={value}
          autoFocus
          onChange={(event) => {
            const raw = event.target.value;
            setAnswer(activeQuestion.id, raw === '' ? undefined : Number(raw));
          }}
        />
      );
    }
    return (
      <textarea
        className="pci-textarea"
        value={value}
        autoFocus
        rows={5}
        onChange={(event) => setAnswer(activeQuestion.id, event.target.value)}
        placeholder="Type the coach's answer here..."
      />
    );
  };

  return (
    <>
      <Head>
        <title>Coach Intake | PulseCheck</title>
      </Head>
      <main className="pci-page">
        <section className="pci-shell">
          <div className="pci-topbar">
            <div>
              <div className="pci-brand">PulseCheck coach intake</div>
              <div className="pci-meta">{payload ? `${payload.teamName} · ${payload.targetEmail}` : 'Loading intake link'}</div>
            </div>
            <div className="pci-saveState">
              {saving ? <Loader2 className="pci-spin" /> : <Check />}
              <span>{saving ? 'Saving' : savedAt ? 'Saved' : 'Ready'}</span>
            </div>
          </div>

          <div className="pci-progress">
            <span style={{ width: `${progress}%` }} />
          </div>

          {loading ? (
            <div className="pci-status"><Loader2 className="pci-spin" /> Loading intake...</div>
          ) : error && !payload ? (
            <div className="pci-error">{error}</div>
          ) : complete ? (
            <div className="pci-card">
              <div className="pci-doneIcon"><Check /></div>
              <h1>Coach intake saved.</h1>
              <p>The answers are attached to this coach email. When the coach uses their activation link, these answers will already be filled in.</p>
            </div>
          ) : activeQuestion ? (
            <div className="pci-card">
              <div className="pci-questionNumber">Question {activeIndex + 1} of {questions.length}</div>
              <h1>{activeQuestion.question}</h1>
              {activeQuestion.required ? <div className="pci-required">Required</div> : null}
              <div className="pci-answer">{renderInput()}</div>
              {error ? <div className="pci-inlineError">{error}</div> : null}
              <div className="pci-actions">
                <button type="button" className="pci-secondary" disabled={activeIndex === 0 || saving} onClick={() => void handleBack()}>
                  <ArrowLeft /> Back
                </button>
                <button type="button" className="pci-primary" disabled={saving} onClick={() => void handleNext()}>
                  {activeIndex >= questions.length - 1 ? 'Save intake' : 'Save & next'} {saving ? <Loader2 className="pci-spin" /> : <ArrowRight />}
                </button>
              </div>
            </div>
          ) : (
            <div className="pci-card">
              <h1>No coach questions yet.</h1>
              <p>Add coach intake questions in the provisioning dashboard, then generate this link again.</p>
            </div>
          )}
        </section>
      </main>
      <style jsx>{`
        .pci-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 18% 18%, rgba(147, 51, 234, 0.28), transparent 34%),
            linear-gradient(145deg, #09070f 0%, #100b1e 48%, #050509 100%);
          color: #fff;
          padding: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .pci-shell {
          width: min(920px, 100%);
        }
        .pci-topbar {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          margin-bottom: 18px;
        }
        .pci-brand {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #c4b5fd;
        }
        .pci-meta {
          margin-top: 7px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 14px;
        }
        .pci-saveState {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 14px;
          border-radius: 999px;
          color: #ddd6fe;
          background: rgba(167, 139, 250, 0.11);
          border: 1px solid rgba(196, 181, 253, 0.26);
          font-size: 13px;
          font-weight: 700;
        }
        .pci-saveState :global(svg) {
          width: 16px;
          height: 16px;
        }
        .pci-progress {
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
          margin-bottom: 42px;
        }
        .pci-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #8b5cf6, #ec4899);
          transition: width 0.25s ease;
        }
        .pci-card {
          min-height: 430px;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(14, 12, 22, 0.78);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.42);
          padding: clamp(28px, 7vw, 68px);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .pci-questionNumber,
        .pci-required {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #a78bfa;
        }
        .pci-card h1 {
          margin: 14px 0 0;
          max-width: 760px;
          font-size: clamp(32px, 5vw, 58px);
          line-height: 1.05;
          letter-spacing: 0;
        }
        .pci-card p {
          max-width: 640px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 19px;
          line-height: 1.65;
        }
        .pci-required {
          margin-top: 14px;
          color: rgba(255, 255, 255, 0.48);
        }
        .pci-answer {
          margin-top: 34px;
          width: 100%;
        }
        .pci-textarea,
        .pci-input {
          width: 100%;
          display: block;
          box-sizing: border-box;
          outline: none;
          color: #fff;
          background-color: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(196, 181, 253, 0.24);
          border-radius: 18px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 18px 42px rgba(0, 0, 0, 0.18);
          font-size: clamp(22px, 3vw, 32px);
          line-height: 1.38;
          padding: 20px 22px;
          resize: vertical;
          color-scheme: dark;
          transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
        }
        .pci-textarea {
          min-height: 170px;
        }
        .pci-input {
          min-height: 78px;
        }
        .pci-textarea:focus,
        .pci-input:focus {
          background-color: rgba(255, 255, 255, 0.075);
          border-color: rgba(216, 180, 254, 0.7);
          box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.16), 0 20px 48px rgba(0, 0, 0, 0.24);
        }
        .pci-textarea::placeholder {
          color: rgba(221, 214, 254, 0.45);
        }
        .pci-choiceGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .pci-choice {
          min-height: 74px;
          padding: 18px 20px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.055);
          color: #fff;
          font-size: 19px;
          font-weight: 800;
          text-align: left;
          cursor: pointer;
        }
        .pci-choice.is-selected {
          border-color: rgba(196, 181, 253, 0.92);
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.72), rgba(219, 39, 119, 0.5));
        }
        .pci-actions {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          margin-top: 48px;
        }
        .pci-primary,
        .pci-secondary {
          min-height: 54px;
          border-radius: 999px;
          padding: 0 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }
        .pci-primary {
          border: 0;
          color: #fff;
          background: linear-gradient(135deg, #7c3aed, #db2777);
        }
        .pci-secondary {
          color: rgba(255, 255, 255, 0.72);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .pci-primary:disabled,
        .pci-secondary:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .pci-primary :global(svg),
        .pci-secondary :global(svg) {
          width: 18px;
          height: 18px;
        }
        .pci-inlineError,
        .pci-error,
        .pci-status {
          color: #fecdd3;
          background: rgba(190, 18, 60, 0.16);
          border: 1px solid rgba(251, 113, 133, 0.3);
          border-radius: 16px;
          padding: 16px 18px;
          margin-top: 22px;
        }
        .pci-status {
          color: #ddd6fe;
          background: rgba(124, 58, 237, 0.12);
          border-color: rgba(196, 181, 253, 0.26);
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .pci-doneIcon {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(135deg, #7c3aed, #db2777);
        }
        .pci-doneIcon :global(svg) {
          width: 28px;
          height: 28px;
        }
        .pci-spin {
          animation: pci-spin 0.9s linear infinite;
        }
        @keyframes pci-spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 720px) {
          .pci-page {
            padding: 18px;
            align-items: stretch;
          }
          .pci-topbar,
          .pci-actions {
            align-items: stretch;
            flex-direction: column;
          }
          .pci-choiceGrid {
            grid-template-columns: 1fr;
          }
          .pci-card {
            min-height: 520px;
          }
        }
      `}</style>
    </>
  );
}
