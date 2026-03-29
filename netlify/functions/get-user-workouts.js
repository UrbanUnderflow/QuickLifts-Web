// get-user-workouts.js
const { admin } = require('./config/firebase');

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
