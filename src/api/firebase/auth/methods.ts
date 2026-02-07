import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  OAuthProvider,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { SignUpData, AuthService } from './types';
import { User } from '../../firebase/user';

// Helper function to normalize username
const normalizeUsername = (username: string): string => {
  return username.toLowerCase().replace(/[^a-z0-9_.-]/g, '').trim();
};

// Helper function to claim username in the usernames collection
const claimUsername = async (userId: string, username: string): Promise<void> => {
  const normalizedName = normalizeUsername(username);
  if (normalizedName.length < 3) {
    throw new Error('Username too short');
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
      userId: userId,
      username: normalizedName,
      createdAt: serverTimestamp()
    });
  });
};

export const authMethods: AuthService = {
  async signUpWithEmail({ email, password, username, profileImage, quizData }: SignUpData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const normalizedName = normalizeUsername(username);

      // Claim the username first (will throw if taken)
      if (normalizedName.length >= 3) {
        await claimUsername(userCredential.user.uid, normalizedName);
      }

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        username: normalizedName,
        createdAt: new Date(),
        quizData: quizData || null
      });

      if (profileImage) {
        // TODO: Handle profile image upload
      }

      return userCredential;
    } catch (error) {
      console.error('Error in signUpWithEmail:', error);
      throw error;
    }
  },

  async signInWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  },

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    try {
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      return result;
    } catch (error) {
      console.error('Error in signInWithGoogle:', error);
      throw error;
    }
  },

  async signInWithApple() {
    const provider = new OAuthProvider('apple.com');

    // Add these configurations
    provider.addScope('email');
    provider.addScope('name');

    // Safari mobile fix: Store current path before redirect
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pulse_auth_return_path', window.location.pathname + window.location.search);
        console.log('[AppleSignIn] Saved return path:', window.location.pathname + window.location.search);
      }
    } catch (e) {
      console.error('[AppleSignIn] Error saving return path:', e);
    }

    // Add your service ID
    provider.setCustomParameters({
      client_id: 'com.pulsefitnesscollective.pulse.web', // The Services ID from Apple
      redirect_uri: window.location.origin // Your app's URL
    });

    try {
      return await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error('Error during Apple sign-in redirect:', error);
      throw error;
    }
  },

  async resetPassword(email: string) {
    try {
      // Use our custom Netlify function for branded password reset emails
      const response = await fetch('/.netlify/functions/send-password-reset-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toEmail: email }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // If our custom function fails, fall back to Firebase's default
        console.warn('Custom reset email failed, falling back to Firebase:', result.error);
        await sendPasswordResetEmail(auth, email);
      }

      console.log('Password reset email sent to:', email);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  },

  async addVersion(version: string, changeNotes: string[], isCriticalUpdate: boolean) {
    try {
      // Transform changeNotes array to numbered properties
      const notesObject: { [key: string]: string } = {};
      changeNotes.forEach((note, idx) => {
        notesObject[(idx + 1).toString()] = note;
      });
      await setDoc(doc(db, 'versions', version), {
        ...notesObject,
        isCriticalUpdate,
      });
      return true;
    } catch (error) {
      console.error('Error adding version:', error);
      throw error;
    }
  }
};

// Export signOut function for use in components
export const signOut = () => firebaseSignOut(auth);