import { QuizData } from "../../../types/AuthTypes";
import { 
    UserCredential
} from 'firebase/auth';

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
    signInWithApple: () => Promise<UserCredential>;
  }