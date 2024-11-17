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

  // Default meta tags for the home page
  let metaTags = `
    <title>Pulse: Fitness Collective</title>
    <meta property="og:title" content="Pulse: Fitness Collective" />
    <meta property="og:description" content="Beat Your Best, Share Your Victory" />
    <meta property="og:image" content="https://fitwithpulse.ai/preview-image.png" />
    <meta property="og:url" content="https://fitwithpulse.ai" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
  `;

  // If it's a profile page
  if (username && username !== 'favicon.ico') {
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('username', '==', username).get();

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        const imageUrl = userData.profileImage?.profileImageURL || 'https://fitwithpulse.ai/default-profile.png';
        const bio = userData.bio || 'Check out this fitness profile on Pulse';

        metaTags = `
          <title>${userData.displayName}'s Profile | Pulse</title>
          <meta property="og:title" content="${userData.displayName}'s Profile | Pulse" />
          <meta property="og:description" content="${bio}" />
          <meta property="og:image" content="${imageUrl}" />
          <meta property="og:url" content="https://fitwithpulse.ai/${username}" />
          <meta property="og:type" content="profile" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="${userData.displayName}'s Profile | Pulse" />
          <meta name="twitter:description" content="${bio}" />
          <meta name="twitter:image" content="${imageUrl}" />
          <link rel="canonical" href="https://fitwithpulse.ai/${username}" />
        `;
      } else {
        // User not found, set default or 404 meta tags
        metaTags = `
          <title>Profile Not Found | Pulse</title>
          <meta property="og:title" content="Profile Not Found | Pulse" />
          <meta property="og:description" content="The profile you are looking for does not exist." />
          <meta property="og:image" content="https://fitwithpulse.ai/default-profile.png" />
          <meta property="og:url" content="https://fitwithpulse.ai" />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Profile Not Found | Pulse" />
          <meta name="twitter:description" content="The profile you are looking for does not exist." />
          <meta name="twitter:image" content="https://fitwithpulse.ai/default-profile.png" />
          <link rel="canonical" href="https://fitwithpulse.ai" />
        `;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Optionally, set default or error meta tags
      metaTags = `
        <title>Error | Pulse</title>
        <meta property="og:title" content="Error | Pulse" />
        <meta property="og:description" content="An error occurred while fetching the profile." />
        <meta property="og:image" content="https://fitwithpulse.ai/error-image.png" />
        <meta property="og:url" content="https://fitwithpulse.ai" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Error | Pulse" />
        <meta name="twitter:description" content="An error occurred while fetching the profile." />
        <meta name="twitter:image" content="https://fitwithpulse.ai/error-image.png" />
        <link rel="canonical" href="https://fitwithpulse.ai" />
      `;
    }
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        ${metaTags}
        <meta charset="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <link rel="apple-touch-icon" href="/logo192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link href="/static/css/main.6aecf152.css" rel="stylesheet" />
      </head>
      <body>
        <noscript>You need to enable JavaScript to run this app.</noscript>
        <div id="root"></div>
        <script src="/static/js/main.95d63212.js"></script>
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
