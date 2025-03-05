import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "quicklifts-dd3f1",
        privateKey: (process.env.FIREBASE_SECRET_KEY || '').replace(/\\n/g, '\n'),
        clientEmail: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      })
    });
  } catch (error) {
    console.log('Firebase admin initialization error', error);
  }
}

export default admin; 