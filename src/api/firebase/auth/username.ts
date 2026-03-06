import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';

const FALLBACK_USERNAME = 'pulseuser';

export const USERNAME_PATTERN = /^[a-z0-9_.-]{3,20}$/;

export const normalizeUsername = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .trim()
    .slice(0, 20);
};

export const isValidUsernameFormat = (value: string): boolean => {
  return USERNAME_PATTERN.test(value);
};

export const generateUsernameFromEmail = (email: string): string => {
  const localPart = email.split('@')[0] || '';
  const normalized = normalizeUsername(localPart);

  if (normalized.length >= 3) {
    return normalized;
  }

  const padded = `${normalized}${FALLBACK_USERNAME}`;
  return padded.slice(0, 20);
};

export const isUsernameAvailable = async (
  username: string,
  currentUserId?: string | null
): Promise<boolean> => {
  const normalizedName = normalizeUsername(username);
  if (!isValidUsernameFormat(normalizedName)) {
    return false;
  }

  const usernameRef = doc(db, 'usernames', normalizedName);
  const usernameDoc = await getDoc(usernameRef);

  if (!usernameDoc.exists()) {
    return true;
  }

  const existingUserId = usernameDoc.data()?.userId;
  return !!currentUserId && existingUserId === currentUserId;
};

export const claimUsername = async (userId: string, username: string): Promise<void> => {
  const normalizedName = normalizeUsername(username);
  if (!isValidUsernameFormat(normalizedName)) {
    throw new Error('Invalid username format');
  }

  await runTransaction(db, async (transaction) => {
    const usernameRef = doc(db, 'usernames', normalizedName);
    const usernameDoc = await transaction.get(usernameRef);

    if (usernameDoc.exists()) {
      const existingUserId = usernameDoc.data()?.userId;
      if (existingUserId && existingUserId !== userId) {
        throw new Error('Username already taken');
      }
    }

    transaction.set(usernameRef, {
      userId,
      username: normalizedName,
      createdAt: serverTimestamp(),
    });
  });
};
