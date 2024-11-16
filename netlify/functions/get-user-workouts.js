// get-user-workouts.js
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
 admin.initializeApp({
   credential: admin.credential.cert({
     "type": "service_account",
     "project_id": "quicklifts-dd3f1",
     "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
     "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
     "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
     "client_id": "111494077667496751062",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com"
   })
 });
}

const db = admin.firestore();

async function fetchUserWorkouts(userId) {
 try {
   const workoutsRef = db.collection('users').doc(userId).collection('MyCreatedWorkouts');
   const snapshot = await workoutsRef.get();

   const workouts = [];
   
   for (const doc of snapshot.docs) {
     const workoutData = doc.data();
     const workout = { id: doc.id, ...workoutData };

     // Fetch logs for this workout
     const logsSnapshot = await doc.ref.collection('logs').get();
     const logs = logsSnapshot.docs.map(logDoc => ({
       id: logDoc.id,
       ...logDoc.data()
     }));

     workout.logs = logs;
     workouts.push(workout);
   }

   return workouts;
 } catch (error) {
   throw error;
 }
}

exports.handler = async (event) => {
 const headers = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'Content-Type',
   'Access-Control-Allow-Methods': 'GET, OPTIONS'
 };

 if (event.httpMethod === 'OPTIONS') {
   return { statusCode: 200, headers, body: '' };
 }

 try {
   const userId = event.queryStringParameters.userId;
   if (!userId) {
     return {
       statusCode: 400,
       headers,
       body: JSON.stringify({ success: false, error: 'userId is required' })
     };
   }

   const workouts = await fetchUserWorkouts(userId);
   
   return {
     statusCode: 200,
     headers,
     body: JSON.stringify({ success: true, workouts })
   };
 } catch (error) {
   return {
     statusCode: 500,
     headers,
     body: JSON.stringify({ success: false, error: error.message })
   };
 }
};