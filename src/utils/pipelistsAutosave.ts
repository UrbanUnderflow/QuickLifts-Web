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
