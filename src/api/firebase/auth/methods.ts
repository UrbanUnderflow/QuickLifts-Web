import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect, 
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config';
import { SignUpData, AuthService } from './types';
  
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
      const result = await signInWithPopup(auth, provider);
      
      const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
      
      if (isNewUser) {
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          username: result.user.displayName?.toLowerCase().replace(/\s+/g, '_') || '',
          createdAt: new Date()
        });
      }
  
      return result;
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
  }
  };