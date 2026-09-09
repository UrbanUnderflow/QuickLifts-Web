import { FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  initializeAuth,
} from 'firebase/auth';

export const initializeBrowserAuth = (app: FirebaseApp, isRemoteLoginSession: boolean) =>
  initializeAuth(app, {
    // getAuth probes IndexedDB before setPersistence can run. A blocked database
    // leaves auth initialization and every queued sign-in waiting indefinitely.
    // Choose the app's storage directly, retaining tab-only impersonation.
    persistence: isRemoteLoginSession ? browserSessionPersistence : browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
