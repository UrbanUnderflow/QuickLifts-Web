import { QuizData } from "../../../types/AuthTypes";
import { 
    UserCredential
} from 'firebase/auth';
import { AppVersionMediaItem } from '../../../utils/appVersioning';

export interface SignUpData {
    email: string;
    password: string;
    username: string;
    profileImage?: File;
    quizData?: QuizData;  // You'll need to import or define QuizData type
  }
  
  export interface AuthService {
    signUpWithEmail: (data: SignUpData) => Promise<UserCredential>;
    signInWithEmail: (email: string, password: string) => Promise<UserCredential>;
    signInWithGoogle: () => Promise<UserCredential>;
    signInWithApple: () => Promise<void>;
    resetPassword: (email: string) => Promise<boolean>;
    addVersion: (
      version: string,
      changeNotes: string[],
      isCriticalUpdate: boolean,
      media?: AppVersionMediaItem[]
    ) => Promise<boolean>;
  }
