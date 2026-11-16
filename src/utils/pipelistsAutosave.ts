// Retry only transient failures. Keep the original base/local pair so a retry
// merges the user's changes with a fresh server snapshot instead of overwriting it.
export async function runPipeListSaveWithRetry(
  save: () => Promise<unknown>,
  isCurrent: () => boolean,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<void> {
  for (let attempt = 0; attempt < 3 && isCurrent(); attempt += 1) {
    try {
      await save();
      return;
    } catch (error) {
      if (!isCurrent()) return;
      const code = String((error as { code?: string })?.code || '').replace(/^firestore\//, '');
      const versionConflict = code === 'failed-precondition' && /stored version.*required base version/i.test(String((error as Error)?.message || ''));
      if (attempt === 2 || (!versionConflict && !['aborted', 'unavailable', 'deadline-exceeded'].includes(code))) throw error;
      await wait(500 * (2 ** attempt));
    }
  }
}

// Rules can reject a stale revision before Firestore reports transaction
// contention. Confirm a newer readable revision before treating it as retryable.
export async function rethrowPipeListTransactionError(
  error: unknown, readRevision: number | undefined, latestRevision: () => Promise<unknown>,
): Promise<never> {
  if ((error as { code?: string })?.code === 'permission-denied' && typeof readRevision === 'number') {
    const latest = await latestRevision();
    if (typeof latest === 'number' && latest > readRevision) {
      throw Object.assign(new Error('The shared list advanced during this save.'), { code: 'aborted' });
    }
  }
  throw error;
}
