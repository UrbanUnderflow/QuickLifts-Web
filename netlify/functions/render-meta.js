// netlify/functions/render-meta.js
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

exports.handler = async (event) => {
    const username = event.queryStringParameters.username;
  
    // Default meta tags
    let metaTags = `
      <title>Pulse: Fitness Collective</title>
      <!-- Default meta tags -->
    `;
  
    // If it's a profile page
    if (username && username !== 'favicon.ico') {
      try {
        // Fetch user data from Firestore
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', username).get();
  
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          const imageUrl = userData.profileImage?.profileImageURL || 'https://fitwithpulse.ai/default-profile.png';
  
          metaTags = `
            <title>${userData.displayName}'s Profile | Pulse</title>
            <meta property="og:title" content="${userData.displayName}'s Profile | Pulse" />
            <meta property="og:description" content="${userData.bio || 'Check out this fitness profile on Pulse'}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="og:url" content="https://fitwithpulse.ai/${username}" />
            <meta property="og:type" content="profile" />
          `;
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        ${metaTags}
        <link rel="apple-touch-icon" href="/logo192.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  `;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body: html,
  };
};