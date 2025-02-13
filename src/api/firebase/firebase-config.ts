// src/config/firebase-config.ts
export const firebaseConfigs = {
  production: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  },
  development: {
    apiKey: "AIzaSyCP8npdKqy-DvAVSJ2EoqWH72ikt04hfO8",
    projectId: "quicklifts-dev-01",
    storageBucket: "quicklifts-dev-01.appspot.com",
    messagingSenderId: "793216169358",
    appId: "1:793216169358:ios:cecca8dfb08ea5df8aa0df",
    authDomain: "quicklifts-dev-01.firebaseapp.com"
  }
};