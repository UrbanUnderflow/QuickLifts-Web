const { admin } = require('./config/firebase');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

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
    // Query Firestore for user - case insensitive
    const usersRef = db.collection('users');
    const normalizedUsername = username.toLowerCase().trim();
    console.log(`Looking up username: "${username}" (normalized: "${normalizedUsername}")`);
    
    // First try exact match with normalized username
    let snapshot = await usersRef.where('username', '==', normalizedUsername).get();
    
    // If no exact match found, try case-insensitive search
    if (snapshot.empty) {
      console.log('No exact match found, trying case-insensitive search...');
      const allUsersSnapshot = await usersRef.get();
      const matchingDocs = allUsersSnapshot.docs.filter(doc => {
        const userData = doc.data();
        return userData.username && userData.username.toLowerCase().trim() === normalizedUsername;
      });
      
      if (matchingDocs.length > 0) {
        console.log(`Found case-insensitive match: "${matchingDocs[0].data().username}"`);
        // Create a fake snapshot object for consistency
        snapshot = {
          empty: false,
          docs: matchingDocs
        };
      }
    }

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
