import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

type Props = {
  audioSrc: string;
  onSessionActiveChange?: (isActive: boolean) => void;
};

export type NoraBoxBreathingPhoneHandle = {
  start: () => void;
  stop: () => void;
};

const TOTAL_CYCLES = 4;
const BREATHING_PHASES = [
  { label: 'Breathe In', duration: 4, scale: 1.3, holdExpanded: false },
  { label: 'Hold', duration: 4, scale: 1.3, holdExpanded: true },
  { label: 'Breathe Out', duration: 4, scale: 0.8, holdExpanded: false },
  { label: 'Hold', duration: 4, scale: 0.8, holdExpanded: false },
] as const;

const NoraBoxBreathingPhone = React.forwardRef<NoraBoxBreathingPhoneHandle, Props>(({ audioSrc, onSessionActiveChange }, ref) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState<number>(BREATHING_PHASES[0].duration);
  const [cycleCount, setCycleCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const playVoiceover = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => undefined);
  }, []);

  const resetBreathing = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhaseIndex(0);
    setCountdown(BREATHING_PHASES[0].duration);
    setCycleCount(0);
    setIsCompleted(false);
  }, []);

  const startSession = useCallback(() => {
    resetBreathing();
    setIsSessionActive(true);
    playVoiceover();
  }, [playVoiceover, resetBreathing]);

  const closeSession = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    resetBreathing();
    setIsSessionActive(false);
  }, [resetBreathing]);

  useImperativeHandle(ref, () => ({ start: startSession, stop: closeSession }), [closeSession, startSession]);

  useEffect(() => {
    onSessionActiveChange?.(isSessionActive && !isCompleted);
  }, [isCompleted, isSessionActive, onSessionActiveChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    return () => {
      audio.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isSessionActive || isCompleted) return;

    timerRef.current = setInterval(() => {
      setCountdown((current) => {
        if (current > 1) return current - 1;

        setPhaseIndex((currentPhaseIndex) => {
          const nextPhaseIndex = currentPhaseIndex + 1;

          if (nextPhaseIndex >= BREATHING_PHASES.length) {
            setCycleCount((currentCycle) => {
              const nextCycle = currentCycle + 1;
              if (nextCycle >= TOTAL_CYCLES) {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
                setIsCompleted(true);
                return TOTAL_CYCLES;
              }
              return nextCycle;
            });
            return 0;
          }

          return nextPhaseIndex;
        });

        const nextPhaseIndex = phaseIndex + 1 >= BREATHING_PHASES.length ? 0 : phaseIndex + 1;
        return BREATHING_PHASES[nextPhaseIndex].duration;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isSessionActive, isCompleted, phaseIndex]);

  const currentPhase = BREATHING_PHASES[phaseIndex];

  return (
    <div className="nr-bb">
      <audio ref={audioRef} src={audioSrc} preload="none" playsInline />

      <div className="nr-bb-phone">
        <div className="nr-bb-phone-notch" />
        <div className={`nr-bb-phone-screen ${isSessionActive ? 'nr-bb-phone-screen--session' : ''}`}>
          {isSessionActive ? (
            isCompleted ? (
              <div className="nr-bb-complete">
                <div className="nr-bb-complete-orb">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                    <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h4>Well Done</h4>
                  <p>You completed {TOTAL_CYCLES} breathing cycles.</p>
                </div>
                <button type="button" className="nr-bb-session-primary" onClick={closeSession}>
                  Continue
                </button>
              </div>
            ) : (
              <div className="nr-bb-session">
                <div className="nr-bb-session-top">
                  <button type="button" className="nr-bb-session-close" onClick={closeSession} aria-label="Close breathing exercise">
                    ×
                  </button>
                </div>

                <div className="nr-bb-session-main">
                  <div className="nr-bb-cycle-dots" aria-label={`Cycle ${cycleCount + 1} of ${TOTAL_CYCLES}`}>
                    {Array.from({ length: TOTAL_CYCLES }).map((_, index) => (
                      <span
                        key={index}
                        className={index < cycleCount ? 'nr-bb-cycle-dot nr-bb-cycle-dot--done' : 'nr-bb-cycle-dot'}
                      />
                    ))}
                  </div>

                  <div className="nr-bb-session-ring-wrap">
                    <div
                      className="nr-bb-session-ring-outer"
                      style={{
                        transform: `scale(${currentPhase.scale * 1.08})`,
                        opacity: currentPhase.holdExpanded ? 0.8 : 0.45,
                      }}
                    />
                    <div
                      className="nr-bb-session-ring"
                      style={{ transform: `scale(${currentPhase.scale})` }}
                    />
                    <div className="nr-bb-session-center">
                      <span className="nr-bb-session-count">{countdown}</span>
                      <span className="nr-bb-session-label">{currentPhase.label}</span>
                    </div>
                  </div>

                </div>

                <div className="nr-bb-session-bottom">
                  <h4>Box Breathing Exercise</h4>
                  <p>Follow the circle and breathe with the rhythm.</p>
                  <span>Round {Math.min(cycleCount + 1, TOTAL_CYCLES)} of {TOTAL_CYCLES}</span>
                </div>
              </div>
            )
          ) : (
            <>
              <div className="nr-bb-app-header">
                <div className="nr-bb-app-logo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2.5" width="14" height="14" aria-hidden>
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  PulseCheck
                </div>
                <div className="nr-bb-app-live">
                  ● LIVE
                </div>
              </div>

              <div className="nr-bb-chat-bubble nr-bb-chat-nora">
                Hi Tremaine <span aria-hidden>👋</span> Today is game day. How are you feeling?
              </div>

              <div className="nr-bb-chat-bubble nr-bb-chat-user">
                I&apos;m feeling <em>really uneasy</em> about today&apos;s game. Nervous, can&apos;t focus.
              </div>

              <div className="nr-bb-chat-bubble nr-bb-chat-nora">
                <span className="nr-bb-alert">⚠ Elevated cortisol pattern detected.</span> HRV dipped 14%. Let&apos;s reset your nervous system right now.
              </div>

              <div className="nr-bb-chat-bubble nr-bb-chat-nora nr-bb-chat-action">
                <div className="nr-bb-action-title">🫁 Box Breathing · 4 rounds</div>
                <div className="nr-bb-action-copy">
                  Inhale 4s · Hold 4s · Exhale 4s · Hold 4s
                  <br />
                  Used by Navy SEALs to lower acute stress
                </div>
                <button type="button" className="nr-bb-chat-btn" onClick={startSession}>
                  Start Now →
                </button>
              </div>

              <div className="nr-bb-breath-hud">
                <div className="nr-bb-breath-ring-outer">
                  <div className="nr-bb-breath-ring-inner" />
                  <span className="nr-bb-breath-phase">Inhale</span>
                </div>
                <div className="nr-bb-breath-stats">
                  <span className="nr-bb-breath-stat"><span className="nr-bb-purple">HRV</span> recovering</span>
                  <span className="nr-bb-breath-stat"><span className="nr-bb-green">Stress</span> ↓ 18%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .nr-bb.nr-bb {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          padding: 28px 0;
          overflow: visible;
        }

        .nr-bb-phone {
          width: 300px;
          height: 620px;
          background: linear-gradient(180deg, #111214 0%, #0c0d0f 100%);
          border-radius: 44px;
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.04),
            0 40px 80px rgba(0, 0, 0, 0.7),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 0 90px rgba(160, 94, 248, 0.25);
          position: relative;
          overflow: hidden;
          z-index: 2;
        }

        .nr-bb-phone-notch {
          width: 100px;
          height: 28px;
          background: #111214;
          border-radius: 0 0 18px 18px;
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 3;
        }

        .nr-bb .nr-bb-phone-screen {
          position: absolute;
          inset: 12px 8px 8px;
          border-radius: 34px;
          overflow: hidden;
          background: #0a0b0e;
          display: flex;
          flex-direction: column;
          padding: 36px 16px 16px;
          box-sizing: border-box;
          justify-content: flex-end;
        }

        .nr-bb .nr-bb-app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .nr-bb .nr-bb-app-logo {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #fff;
        }

        .nr-bb .nr-bb-app-live {
          font-size: 9px;
          color: #22c55e;
          font-weight: 700;
          letter-spacing: 0.07em;
          animation: nrBbPulseDot 2s ease infinite;
        }

        @keyframes nrBbPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.85); }
        }

        .nr-bb .nr-bb-chat-bubble {
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 11px;
          line-height: 1.5;
          margin-bottom: 8px;
          max-width: 85%;
          box-sizing: border-box;
          letter-spacing: 0.01em;
        }

        .nr-bb .nr-bb-chat-nora {
          background: rgba(106, 154, 250, 0.12);
          color: #c0d0f0;
          border-bottom-left-radius: 4px;
        }

        .nr-bb .nr-bb-chat-user {
          background: rgba(224, 254, 16, 0.1);
          color: #d0f0a0;
          border-bottom-right-radius: 4px;
          align-self: flex-end;
          margin-left: auto;
        }

        .nr-bb .nr-bb-chat-user em {
          font-style: italic;
          color: #edf7bc;
        }

        .nr-bb .nr-bb-alert {
          color: #f97316;
          font-weight: 600;
        }

        .nr-bb .nr-bb-chat-action {
          background: rgba(160, 94, 248, 0.08) !important;
          border: 1px solid rgba(160, 94, 248, 0.2);
          border-radius: 14px !important;
          padding: 10px 13px !important;
          margin-bottom: 8px;
        }

        .nr-bb .nr-bb-action-title {
          font-weight: 700;
          margin-bottom: 4px;
          color: #a05ef8;
        }

        .nr-bb .nr-bb-action-copy {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.6;
        }

        .nr-bb .nr-bb-chat-btn {
          display: inline-block;
          margin-top: 8px;
          background: #a05ef8;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 5px 12px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: transform 0.2s, filter 0.2s;
        }

        .nr-bb .nr-bb-chat-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }

        .nr-bb .nr-bb-breath-hud {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(160, 94, 248, 0.06);
          border: 1px solid rgba(160, 94, 248, 0.18);
          border-radius: 14px;
          padding: 10px 12px;
          margin-top: 4px;
        }

        .nr-bb .nr-bb-breath-ring-outer {
          position: relative;
          width: 46px;
          height: 46px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nr-bb .nr-bb-breath-ring-outer::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 3px solid rgba(160, 94, 248, 0.15);
        }

        .nr-bb .nr-bb-breath-ring-inner {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 3px solid #a05ef8;
          animation: nrBbBreath 4s ease-in-out infinite alternate;
          transform: scale(0.55);
        }

        @keyframes nrBbBreath {
          0% { transform: scale(0.55); opacity: 0.5; border-color: #a05ef8; }
          50% { transform: scale(1); opacity: 1; border-color: #a05ef8; }
          100% { transform: scale(0.55); opacity: 0.5; border-color: #22c55e; }
        }

        .nr-bb .nr-bb-breath-phase {
          position: absolute;
          font-size: 8px;
          font-weight: 700;
          color: #a05ef8;
          letter-spacing: 0.05em;
        }

        .nr-bb .nr-bb-breath-stats {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nr-bb .nr-bb-breath-stat {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.5);
        }

        .nr-bb-purple {
          color: #a05ef8;
        }

        .nr-bb-green {
          color: #22c55e;
        }

        .nr-bb .nr-bb-phone-screen--session {
          padding: 20px 18px 24px;
          justify-content: stretch;
          background:
            linear-gradient(135deg, rgba(9, 10, 15, 0.98), rgba(16, 13, 25, 0.96) 48%, rgba(27, 20, 43, 0.9)),
            #0a0b0e;
        }

        .nr-bb .nr-bb-session {
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }

        .nr-bb .nr-bb-session-top {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          min-height: 32px;
          padding-top: 2px;
        }

        .nr-bb .nr-bb-session-close {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 0;
          background: rgba(255, 255, 255, 0.07);
          color: rgba(255, 255, 255, 0.58);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
        }

        .nr-bb .nr-bb-session-main {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 32px;
          padding: 14px 0 6px;
        }

        .nr-bb .nr-bb-cycle-dots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .nr-bb .nr-bb-cycle-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(160, 94, 248, 0.22);
          transition: background 0.25s, box-shadow 0.25s, transform 0.25s;
        }

        .nr-bb .nr-bb-cycle-dot--done {
          background: #a05ef8;
          box-shadow: 0 0 12px rgba(160, 94, 248, 0.72);
          transform: scale(1.08);
        }

        .nr-bb .nr-bb-session-ring-wrap {
          position: relative;
          width: 216px;
          height: 216px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nr-bb .nr-bb-session-ring-outer {
          position: absolute;
          inset: 18px;
          border-radius: 50%;
          border: 2px solid rgba(160, 94, 248, 0.34);
          background: radial-gradient(circle, rgba(160, 94, 248, 0.1), transparent 64%);
          transition: transform 4s ease-in-out, opacity 4s ease-in-out;
          will-change: transform;
        }

        .nr-bb .nr-bb-session-ring {
          position: absolute;
          width: 166px;
          height: 166px;
          border-radius: 50%;
          background:
            radial-gradient(circle, rgba(160, 94, 248, 0.26), rgba(160, 94, 248, 0.09) 55%, transparent 72%);
          border: 1px solid rgba(160, 94, 248, 0.42);
          box-shadow:
            0 0 38px rgba(160, 94, 248, 0.22),
            inset 0 0 30px rgba(160, 94, 248, 0.1);
          transition: transform 4s ease-in-out;
          will-change: transform;
        }

        .nr-bb .nr-bb-session-center {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-align: center;
        }

        .nr-bb .nr-bb-session-count {
          font-size: 44px;
          line-height: 1;
          font-weight: 300;
          color: #a05ef8;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 0 24px rgba(160, 94, 248, 0.58);
        }

        .nr-bb .nr-bb-session-label {
          font-size: 14px;
          line-height: 1.2;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.88);
          text-align: center;
        }

        .nr-bb .nr-bb-session-bottom {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding-bottom: 4px;
          text-align: center;
        }

        .nr-bb .nr-bb-session-bottom h4,
        .nr-bb .nr-bb-complete h4 {
          font-size: 18px;
          line-height: 1.15;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.95);
        }

        .nr-bb .nr-bb-session-bottom p,
        .nr-bb .nr-bb-complete p {
          font-size: 11px;
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.48);
        }

        .nr-bb .nr-bb-session-bottom span {
          margin-top: 4px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(160, 94, 248, 0.86);
        }

        .nr-bb .nr-bb-complete {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
          text-align: center;
        }

        .nr-bb .nr-bb-complete-orb {
          width: 124px;
          height: 124px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a05ef8;
          background: radial-gradient(circle, rgba(160, 94, 248, 0.24), transparent 72%);
          box-shadow: 0 0 36px rgba(160, 94, 248, 0.28);
        }

        .nr-bb .nr-bb-complete-orb svg {
          width: 54px;
          height: 54px;
        }

        .nr-bb .nr-bb-session-primary {
          width: 100%;
          padding: 13px 16px;
          border: 0;
          border-radius: 16px;
          background: linear-gradient(135deg, #a05ef8, rgba(160, 94, 248, 0.8));
          color: #090a0f;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        @media (max-width: 1000px) {
          .nr-bb-phone {
            width: 280px;
            height: 580px;
          }

          .nr-bb .nr-bb-phone-screen { padding: 36px 16px 16px; }
          .nr-bb .nr-bb-phone-screen--session { padding: 20px 16px 22px; }
          .nr-bb .nr-bb-session-ring-wrap { width: 202px; height: 202px; }
          .nr-bb .nr-bb-session-ring { width: 156px; height: 156px; }
          .nr-bb .nr-bb-session-count { font-size: 40px; }
        }

        @media (max-width: 600px) {
          .nr-bb.nr-bb {
            padding: 18px 0 32px;
          }

          .nr-bb-phone {
            width: 260px;
            height: 540px;
          }

          .nr-bb .nr-bb-phone-screen { padding: 36px 14px 14px; }
          .nr-bb .nr-bb-phone-screen--session { padding: 18px 14px 20px; }

          .nr-bb .nr-bb-chat-bubble {
            font-size: 10px;
            padding: 9px 12px;
          }

          .nr-bb .nr-bb-session-main { gap: 28px; }
          .nr-bb .nr-bb-session-ring-wrap { width: 188px; height: 188px; }
          .nr-bb .nr-bb-session-ring { width: 144px; height: 144px; }
          .nr-bb .nr-bb-session-count { font-size: 36px; }
          .nr-bb .nr-bb-session-bottom h4,
          .nr-bb .nr-bb-complete h4 { font-size: 16px; }
        }
      `}</style>
    </div>
  );
});

NoraBoxBreathingPhone.displayName = 'NoraBoxBreathingPhone';

export default NoraBoxBreathingPhone;
