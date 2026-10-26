import { deleteApp, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence, deleteUser, getAdditionalUserInfo, getAuth,
  inMemoryPersistence, linkWithCredential, PhoneAuthProvider, RecaptchaVerifier,
  setPersistence, signInWithCredential, signInWithEmailLink, signOut, updateCurrentUser, type Auth, type User, type UserCredential,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { auth, getFirebaseModeRequestHeaders } from '../config';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../../../utils/legalAcceptance';
import { clearStalePulseAuthKeys } from '../../../utils/authSessionCleanup';

/** Require a country code; formatting characters are allowed, extensions are not. */
export const normalizeAuthPhone = (value: string): string => {
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error('Enter your phone number with its country code, for example +1 202 555 0123.');
  }
  return phone;
};

export const phoneAuthError = (error: unknown): string => {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-verification-code': return 'That code is incorrect. Check the text message and try again.';
    case 'auth/invalid-verification-id':
    case 'auth/code-expired':
    case 'auth/session-expired': return 'That code expired. Request a new text message.';
    case 'auth/invalid-phone-number': return 'Check the phone number and include its country code.';
    case 'auth/credential-already-in-use': return 'This phone is already connected to another account. Sign in to that account or contact support.';
    case 'auth/provider-already-linked': return 'A phone is already connected. Remove it before connecting a different number.';
    case 'auth/requires-recent-login': return 'Sign out and sign in again before changing your phone.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded': return 'Text messages are temporarily limited. Wait before trying again, or use another sign-in method.';
    case 'auth/captcha-check-failed': return 'The security check expired. Request a new code and complete the check again.';
    case 'auth/operation-not-allowed': return 'Phone sign-in is unavailable right now. Use email, Apple, or Google.';
    case 'auth/network-request-failed': return 'Check your connection and try again.';
    default: return error instanceof Error ? error.message : 'Phone verification failed. Please try again.';
  }
};

/** A separate, memory-only session prevents an unlinked phone creating a primary app session. */
export const createPhoneAuthAttempt = async (container: HTMLElement, mode: 'signin' | 'link') => {
  const owner = mode === 'link' ? auth.currentUser : null;
  if (mode === 'link' && !owner) throw new Error('Sign in again before connecting a phone.');
  const app = mode === 'signin'
    ? initializeApp(auth.app.options, `phone-${crypto.randomUUID()}`)
    : null;
  const verificationAuth: Auth = app ? getAuth(app) : auth;
  if (app) await setPersistence(verificationAuth, inMemoryPersistence);
  const verifier = new RecaptchaVerifier(verificationAuth, container, { size: 'compact' });
  let verificationId: string | undefined;
  let cancelled = false;
  return {
    async send(phone: string) {
      verificationId = await new PhoneAuthProvider(verificationAuth)
        .verifyPhoneNumber(normalizeAuthPhone(phone), verifier);
    },
    async confirm(code: string, institutionalEmail = '', acceptTerms = false): Promise<User> {
      if (cancelled || !verificationId) throw new Error('Request a new code to continue.');
      if (!/^\d{6}$/.test(code.trim())) throw new Error('Enter the six-digit code from your text message.');
      const credential = PhoneAuthProvider.credential(verificationId, code.trim());
      if (owner) {
        if (auth.currentUser?.uid !== owner.uid) throw new Error('Your account changed. Sign in again before connecting a phone.');
        const result = await linkWithCredential(owner, credential);
        await result.user.reload();
        await result.user.getIdToken(true);
        return result.user;
      }
      const result = await signInWithCredential(verificationAuth, credential);
      try {
        const response = await fetch('/.netlify/functions/complete-phone-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await result.user.getIdToken()}`, ...getFirebaseModeRequestHeaders() },
          body: JSON.stringify({ institutionalEmail, acceptTerms, termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, platform: 'web' }),
        });
        const payload = await response.json();
        if (!response.ok) throw Object.assign(new Error(payload.error || 'Account setup could not finish. Try again.'), { code: payload.code });
        if (payload.uid !== result.user.uid) throw new Error('Account verification did not match. Please try again.');
      } catch (error) {
        // A failed first enrollment must not leave a second account blocking a
        // later link. Keep any account whose profile was already committed.
        if (getAdditionalUserInfo(result)?.isNewUser) {
          const profile = await getDoc(doc(getFirestore(app!), 'users', result.user.uid)).catch(() => null);
          if (profile && !profile.exists()) await deleteUser(result.user).catch(() => undefined);
        }
        throw error;
      }
      if (cancelled) throw new Error('Phone sign-in was cancelled.');
      clearStalePulseAuthKeys();
      await setPersistence(auth, browserLocalPersistence);
      if (cancelled || auth.currentUser) throw new Error('Your sign-in changed. Refresh the page to continue.');
      await updateCurrentUser(auth, result.user);
      return auth.currentUser!;
    },
    async dispose() {
      if (cancelled) return;
      cancelled = true;
      verifier.clear();
      if (app) {
        await signOut(verificationAuth).catch(() => undefined);
        await deleteApp(app);
      }
    },
  };
};

/** The one-time migration link can open an existing email credential only.
 * A reference email on a phone account must never create a second app account. */
export const completeExistingEmailLink = async (email: string, url: string): Promise<UserCredential> => {
  const app = initializeApp(auth.app.options, `phone-email-link-${crypto.randomUUID()}`);
  const secondary = getAuth(app);
  try {
    await setPersistence(secondary, inMemoryPersistence);
    const result = await signInWithEmailLink(secondary, email, url);
    if (getAdditionalUserInfo(result)?.isNewUser) {
      await deleteUser(result.user);
      throw new Error('This email is reference information only. Sign in with your connected phone or existing sign-in method.');
    }
    if (!(await getDoc(doc(getFirestore(app), 'users', result.user.uid))).exists()) {
      throw new Error('No existing app account was found for this email sign-in. Use your connected phone or contact support.');
    }
    if (auth.currentUser) throw new Error('Your sign-in changed. Refresh the page to continue.');
    clearStalePulseAuthKeys();
    await setPersistence(auth, browserLocalPersistence);
    await updateCurrentUser(auth, result.user);
    return Object.assign(result, { user: auth.currentUser! });
  } finally {
    await signOut(secondary).catch(() => undefined);
    await deleteApp(app);
  }
};
