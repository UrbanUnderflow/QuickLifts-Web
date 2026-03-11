import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface InputIntegrityOptions {
  minIntervalMs?: number;
  lockoutMs?: number;
  warningDurationMs?: number;
  spamFlagThreshold?: number;
  spamRoundThreshold?: number;
}

interface RegisterInputOptions {
  blockedMessage?: string;
}

export function useInputIntegrity(options: InputIntegrityOptions = {}) {
  const {
    minIntervalMs = 160,
    lockoutMs = 320,
    warningDurationMs = 900,
    spamFlagThreshold = 3,
    spamRoundThreshold = 1,
  } = options;

  const lastInputAtRef = useRef(0);
  const inputLockoutUntilRef = useRef(0);
  const spamFlagsRef = useRef(0);
  const spamRoundsRef = useRef(0);
  const spamFlaggedThisRoundRef = useRef(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [warningActive, setWarningActive] = useState(false);
  const [warningMessage, setWarningMessage] = useState('Rapid input blocked');

  const dismissWarning = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    setWarningActive(false);
  }, []);

  const showWarning = useCallback((message: string) => {
    dismissWarning();
    setWarningMessage(message);
    setWarningActive(true);
    warningTimerRef.current = setTimeout(() => {
      setWarningActive(false);
      warningTimerRef.current = null;
    }, warningDurationMs);
  }, [dismissWarning, warningDurationMs]);

  const resetRound = useCallback(() => {
    lastInputAtRef.current = 0;
    inputLockoutUntilRef.current = 0;
    spamFlaggedThisRoundRef.current = false;
    dismissWarning();
  }, [dismissWarning]);

  const resetSession = useCallback(() => {
    spamFlagsRef.current = 0;
    spamRoundsRef.current = 0;
    resetRound();
  }, [resetRound]);

  const finalizeRound = useCallback(() => {
    if (spamFlaggedThisRoundRef.current) {
      spamRoundsRef.current += 1;
    }
    spamFlaggedThisRoundRef.current = false;
    lastInputAtRef.current = 0;
    inputLockoutUntilRef.current = 0;
  }, []);

  const registerInputAttempt = useCallback(({ blockedMessage = 'Rapid input blocked' }: RegisterInputOptions = {}) => {
    const now = Date.now();
    if (inputLockoutUntilRef.current > now) {
      return false;
    }

    const sinceLastInput = lastInputAtRef.current > 0 ? now - lastInputAtRef.current : Number.POSITIVE_INFINITY;
    lastInputAtRef.current = now;

    if (sinceLastInput < minIntervalMs) {
      spamFlagsRef.current += 1;
      spamFlaggedThisRoundRef.current = true;
      inputLockoutUntilRef.current = now + lockoutMs;
      showWarning(blockedMessage);
      return false;
    }

    return true;
  }, [lockoutMs, minIntervalMs, showWarning]);

  const spamFlags = spamFlagsRef.current;
  const spamRounds = spamRoundsRef.current;
  const spamDetected = spamFlags >= spamFlagThreshold || spamRounds >= spamRoundThreshold;

  const metrics = useMemo(() => ({
    spamFlags,
    spamRounds,
    spamDetected,
  }), [spamDetected, spamFlags, spamRounds]);

  useEffect(() => () => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
  }, []);

  return {
    warningActive,
    warningMessage,
    registerInputAttempt,
    resetRound,
    resetSession,
    finalizeRound,
    dismissWarning,
    ...metrics,
  };
}
