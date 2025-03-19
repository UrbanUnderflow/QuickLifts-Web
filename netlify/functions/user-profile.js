const admin = require('firebase-admin');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

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

exports.handler = async (event, context) => {
  // Handle CORS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Get username from path parameter or query parameter
  const username = event.queryStringParameters?.username || event.path.split('/').pop();

  console.log('Processing username:', username);

  try {
    // Query Firestore for user
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    if (snapshot.empty) {
      return {
        statusCode: 404,
        headers,
        body: `<!DOCTYPE html><html><head><title>User Not Found</title></head><body>User not found</body></html>`
      };
    }

    const userData = snapshot.docs[0].data();

    // Return full HTML document with meta tags
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <link rel="icon" href="/favicon.ico" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content="#000000" />
          
          <title>${userData.displayName}'s Profile | Pulse</title>
          
          <!-- OpenGraph Meta Tags -->
          <meta property="og:title" content="${userData.displayName}'s Profile | Pulse" />
          <meta property="og:description" content="${userData.bio || 'Check out this fitness profile on Pulse'}" />
          <meta property="og:image" content="${userData.profileImage?.profileImageURL || 'https://fitwithpulse.ai/default-profile.png'}" />
          <meta property="og:url" content="https://fitwithpulse.ai/${username}" />
          <meta property="og:type" content="profile" />
          
          <!-- Twitter Meta Tags -->
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="${userData.displayName}'s Profile | Pulse" />
          <meta name="twitter:description" content="${userData.bio || 'Check out this fitness profile on Pulse'}" />
          <meta name="twitter:image" content="${userData.profileImage?.profileImageURL || 'https://fitwithpulse.ai/default-profile.png'}" />
          
          <link rel="apple-touch-icon" href="/logo192.png" />
          <link rel="manifest" href="/manifest.json" />
          <link href="/static/css/main.6aecf152.css" rel="stylesheet" />
        </head>
        <body>
          <div id="root"></div>
          <script src="/static/js/main.95d63212.js"></script>
        </body>
      </html>
    `;

    return {
      statusCode: 200,
      headers,
      body: html
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: `<!DOCTYPE html><html><head><title>Error</title></head><body>Server error</body></html>`
    };
  }
};
