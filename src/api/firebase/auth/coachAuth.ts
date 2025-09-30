import { auth } from '../../firebase/config';
import { 
  GoogleAuthProvider, 
  OAuthProvider, 
  signInWithPopup,
  browserPopupRedirectResolver,
  UserCredential
} from 'firebase/auth';

export const coachAuth = {
  async signInWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  },

  async signInWithApple(): Promise<UserCredential> {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    // For popup, custom parameters are not strictly required beyond scopes.
    return await signInWithPopup(auth, provider);
  }
};

export default coachAuth;


