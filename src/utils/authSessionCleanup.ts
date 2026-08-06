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

export const clearPulseAuthStorage = async () => {
  if (typeof window === 'undefined') return;

  removeMatchingStorageKeys(window.localStorage);
  removeMatchingStorageKeys(window.sessionStorage);

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
