import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect, 
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  OAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config';
import { SignUpData, AuthService } from './types';
import { User } from '../../firebase/user';
  
  export const authMethods: AuthService = {
    async signUpWithEmail({ email, password, username, profileImage, quizData }: SignUpData) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email,
          username,
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
      await sendPasswordResetEmail(auth, email);
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