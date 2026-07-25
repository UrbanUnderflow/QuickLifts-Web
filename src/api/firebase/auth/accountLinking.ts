import { deleteApp, initializeApp } from 'firebase/app';
import {
  AuthError,
  deleteUser,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  OAuthCredential,
  OAuthProvider,
  getAuth,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
  signOut,
  unlink,
  type AuthProvider,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, getFirebaseModeRequestHeaders } from '../config';

export type LinkableProvider = 'apple.com' | 'google.com';

export type LinkedProvider = {
  providerId: LinkableProvider | 'password' | string;
  email: string | null;
  displayName: string;
};

export class AccountLinkingError extends Error {
  code: string;

  constructor(message: string, code = 'account-linking/failed') {
    super(message);
    this.name = 'AccountLinkingError';
    this.code = code;
  }
}

let pendingConflict: { credential: OAuthCredential; providerId: LinkableProvider } | null = null;

const providerLabel = (providerId: string) => {
  if (providerId === 'apple.com') return 'Apple';
  if (providerId === 'google.com') return 'Google';
  if (providerId === 'password') return 'Email and password';
  return providerId;
};

const createProvider = (providerId: LinkableProvider): AuthProvider => {
  if (providerId === 'google.com') {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  }

  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return provider;
};

const credentialFromLinkError = (
  providerId: LinkableProvider,
  error: AuthError,
): OAuthCredential | null => {
  if (providerId === 'google.com') {
    return GoogleAuthProvider.credentialFromError(error);
  }
  return OAuthProvider.credentialFromError(error);
};

const getSecondaryAuth = () => {
  const appName = `pulse-account-link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const app = initializeApp(auth.app.options, appName);
  return { app, secondaryAuth: getAuth(app) };
};

const syncProviderSummary = async (user: User) => {
  const providers = user.providerData.map((provider) => provider.providerId);
  const signInEmails = Array.from(new Set(
    [user.email, ...user.providerData.map((provider) => provider.email)]
      .map((email) => String(email || '').trim().toLowerCase())
      .filter(Boolean),
  ));
  await setDoc(doc(db, 'users', user.uid), {
    authProviders: providers,
    signInEmails,
    authProvidersUpdatedAt: serverTimestamp(),
  }, { merge: true });
};

const mergeOwnedDuplicate = async (
  canonicalUser: User,
  credential: OAuthCredential,
  providerId: LinkableProvider,
) => {
  const { app, secondaryAuth } = getSecondaryAuth();

  try {
    const duplicateCredential = await signInWithCredential(secondaryAuth, credential);
    const duplicateUser = duplicateCredential.user;

    if (duplicateUser.uid === canonicalUser.uid) {
      return { sourceUid: duplicateUser.uid, mergeId: null };
    }

    const [canonicalIdToken, duplicateIdToken] = await Promise.all([
      canonicalUser.getIdToken(true),
      duplicateUser.getIdToken(true),
    ]);

    const response = await fetch('/.netlify/functions/merge-accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${canonicalIdToken}`,
        ...getFirebaseModeRequestHeaders(),
      },
      body: JSON.stringify({
        action: 'self-service-merge',
        sourceIdToken: duplicateIdToken,
        providerId,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AccountLinkingError(
        payload?.error || 'The two accounts could not be combined.',
        payload?.code || 'account-linking/merge-failed',
      );
    }
    return { sourceUid: duplicateUser.uid, mergeId: payload?.mergeId || null };
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
    await deleteApp(app).catch(() => undefined);
  }
};

export const listLinkedProviders = (user: User): LinkedProvider[] => {
  const providers = user.providerData.map((provider) => ({
    providerId: provider.providerId,
    email: provider.email,
    displayName: providerLabel(provider.providerId),
  }));

  if (user.email && !providers.some((provider) => provider.providerId === 'password')) {
    const hasPassword = user.providerData.some((provider) => provider.providerId === 'password');
    if (hasPassword) {
      providers.unshift({
        providerId: 'password',
        email: user.email,
        displayName: providerLabel('password'),
      });
    }
  }

  return providers;
};

export const linkProviderToCurrentAccount = async (providerId: LinkableProvider) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new AccountLinkingError(
      'Sign in to your existing Pulse account before connecting another sign-in method.',
      'account-linking/sign-in-required',
    );
  }

  if (currentUser.providerData.some((provider) => provider.providerId === providerId)) {
    return currentUser;
  }

  const provider = createProvider(providerId);

  try {
    await linkWithPopup(currentUser, provider);
    await currentUser.reload();
    await syncProviderSummary(currentUser);
    return currentUser;
  } catch (unknownError) {
    const error = unknownError as AuthError;
    const canMergeOwnedDuplicate =
      error.code === 'auth/credential-already-in-use'
      || error.code === 'auth/account-exists-with-different-credential';

    if (!canMergeOwnedDuplicate) {
      throw error;
    }

    const credential = credentialFromLinkError(providerId, error);
    if (!credential) {
      throw new AccountLinkingError(
        `${providerLabel(providerId)} is connected to another Pulse account. Sign in with that method once, then try again.`,
        'account-linking/credential-unavailable',
      );
    }

    const mergeResult = await mergeOwnedDuplicate(currentUser, credential, providerId);
    await linkWithCredential(currentUser, credential);
    await currentUser.reload();
    await currentUser.getIdToken(true);
    await syncProviderSummary(currentUser);
    if (mergeResult?.sourceUid && mergeResult.sourceUid !== currentUser.uid) {
      const token = await currentUser.getIdToken();
      await fetch('/.netlify/functions/merge-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...getFirebaseModeRequestHeaders(),
        },
        body: JSON.stringify({
          action: 'finalize-provider-link',
          sourceUid: mergeResult.sourceUid,
          mergeId: mergeResult.mergeId,
          providerId,
        }),
      }).catch(() => undefined);
    }
    return currentUser;
  }
};

export const getProviderLabel = providerLabel;

export const unlinkProviderFromCurrentAccount = async (providerId: LinkableProvider) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new AccountLinkingError('Sign in again to change your sign-in methods.');
  }
  if (!currentUser.providerData.some((provider) => provider.providerId === providerId)) {
    return currentUser;
  }
  if (currentUser.providerData.length < 2) {
    throw new AccountLinkingError('Connect another sign-in method before removing this one.');
  }
  await unlink(currentUser, providerId);
  await currentUser.reload();
  await currentUser.getIdToken(true);
  await syncProviderSummary(currentUser);
  return currentUser;
};

export const rememberProviderCredentialFromError = (
  providerId: LinkableProvider,
  unknownError: unknown,
) => {
  const credential = credentialFromLinkError(providerId, unknownError as AuthError);
  if (!credential) return false;
  pendingConflict = { credential, providerId };
  return true;
};

export const linkRememberedProviderCredential = async (user: User) => {
  if (!pendingConflict) return null;
  const remembered = pendingConflict;
  await linkWithCredential(user, remembered.credential);
  pendingConflict = null;
  await user.reload();
  await user.getIdToken(true);
  await syncProviderSummary(user);
  return remembered.providerId;
};

export const rejectAccidentalNewSocialLogin = async (credential: UserCredential) => {
  if (!getAdditionalUserInfo(credential)?.isNewUser) return false;
  await deleteUser(credential.user);
  await signOut(auth).catch(() => undefined);
  return true;
};

export const assertAccountIsCanonical = async (user: User) => {
  const token = await user.getIdToken();
  const response = await fetch('/.netlify/functions/merge-accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...getFirebaseModeRequestHeaders(),
    },
    body: JSON.stringify({ action: 'resolve-current-alias' }),
  });
  if (!response.ok) return;
  const payload = await response.json().catch(() => ({}));
  if (!payload?.alias) return;

  await signOut(auth).catch(() => undefined);
  const destination = payload.canonicalEmail
    ? ` Sign in with ${payload.canonicalEmail}, then connect this method in Settings.`
    : ' Sign in to the account you kept, then connect this method in Settings.';
  throw new AccountLinkingError(
    `This sign-in belongs to an account that was combined.${destination}`,
    'account-linking/merged-alias',
  );
};
