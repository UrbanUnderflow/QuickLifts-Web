import { Auth, signOut as firebaseSignOut } from 'firebase/auth';

const AUTH_STORAGE_KEY_PREFIX = 'firebase:authUser:';
const REMOTE_LOGIN_STORAGE_KEYS = [
  'pulse_remote_login_active',
  'pulse_remote_login_target',
  'pulse_remote_login_started_at',
];

const removeMatchingStorageKeys = (storage: Storage | undefined) => {
  if (!storage) return;

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;
      if (key.startsWith(AUTH_STORAGE_KEY_PREFIX) || REMOTE_LOGIN_STORAGE_KEYS.includes(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => storage.removeItem(key));
  } catch (error) {
    console.warn('[authSessionCleanup] Unable to clear browser auth storage:', error);
  }
};

const deleteIndexedDbDatabase = (databaseName: string) =>
  new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve();
      return;
    }

    const request = window.indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });

// Clears leftover auth-related keys from localStorage/sessionStorage only.
// Safe to call immediately before starting a new sign-in (popup/redirect):
// it does NOT touch the `firebaseLocalStorageDb` IndexedDB database that the
// Firebase Auth SDK itself relies on to track in-flight popup/redirect events.
// Deleting that database while the SDK has a live persistence connection open
// (i.e. right before signInWithPopup/signInWithRedirect) corrupts the SDK's
// internal pending-event bookkeeping and causes every subsequent popup sign-in
// on the page (any provider) to fail with "INTERNAL ASSERTION FAILED: Pending
// promise was never set" / "auth/popup-closed-by-user".
export const clearStalePulseAuthKeys = () => {
  if (typeof window === 'undefined') return;

  removeMatchingStorageKeys(window.localStorage);
  removeMatchingStorageKeys(window.sessionStorage);
};

export const clearPulseAuthStorage = async () => {
  if (typeof window === 'undefined') return;

  clearStalePulseAuthKeys();

  await Promise.all([
    deleteIndexedDbDatabase('firebaseLocalStorageDb'),
  ]);
};

export const signOutAndClearPulseAuthState = async (auth: Auth) => {
  try {
    await firebaseSignOut(auth);
  } finally {
    await clearPulseAuthStorage();
  }
};
