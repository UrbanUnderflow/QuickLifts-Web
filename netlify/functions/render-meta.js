const { admin } = require('./config/firebase');

const db = admin.firestore();

// Define routes and their meta tags
const routeMetaTags = {
  checklist: {
    title: 'Getting Started with Pulse | Your Fitness Journey Begins Here',
    description: 'Follow our simple checklist to get started with Pulse. Learn how to create your profile, connect with the fitness community, and begin tracking your workouts.',
    image: 'https://fitwithpulse.ai/GetStarted.png',
    type: 'website'
  },
  home: {
    title: 'Pulse: Fitness Collective',
    description: 'Beat Your Best, Share Your Victory',
    image: 'https://fitwithpulse.ai/preview-image.png',
    type: 'website'
  },
  // Add more routes as needed
};

exports.handler = async (event) => {
  console.log('Processing request for path:', event.path);

  // Extract the path without query parameters
  const path = event.path.split('?')[0];
  const segments = path.split('/').filter(Boolean);
  const firstSegment = segments[0] || 'home';

  // Check if this is a known route
  if (routeMetaTags[firstSegment]) {
    const route = routeMetaTags[firstSegment];
    const metaTags = `
      <title>${route.title}</title>
      <meta property="og:title" content="${route.title}" />
      <meta property="og:description" content="${route.description}" />
      <meta property="og:image" content="${route.image}" />
      <meta property="og:url" content="https://fitwithpulse.ai${path}" />
      <meta property="og:type" content="${route.type}" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${route.title}" />
      <meta name="twitter:description" content="${route.description}" />
      <meta name="twitter:image" content="${route.image}" />
      <link rel="canonical" href="https://fitwithpulse.ai${path}" />
    `;
    return generateHtmlResponse(metaTags);
  }

  // Check if it might be a user profile
  if (segments.length === 1 && firstSegment !== 'favicon.ico') {
    try {
      const snapshot = await db.collection('users')
        .where('username', '==', firstSegment)
        .get();

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        const metaTags = generateProfileMetaTags(userData, firstSegment);
        return generateHtmlResponse(metaTags);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }

  // If we get here, it's a 404
  const notFoundMetaTags = `
    <title>Page Not Found | Pulse</title>
    <meta property="og:title" content="Page Not Found | Pulse" />
    <meta property="og:description" content="The page you are looking for does not exist." />
    <meta property="og:image" content="https://fitwithpulse.ai/default-image.png" />
    <meta property="og:url" content="https://fitwithpulse.ai${path}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
  `;

  return generateHtmlResponse(notFoundMetaTags, 404);
};

function generateProfileMetaTags(userData, username) {
  const imageUrl = userData.profileImage?.profileImageURL || 'https://fitwithpulse.ai/default-profile.png';
  const bio = userData.bio || 'Check out this fitness profile on Pulse';
  
  return `
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
}

function generateHtmlResponse(metaTags, statusCode = 200) {
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
    statusCode,
    headers: {
      'Content-Type': 'text/html',
    },
    body: html,
  };
}
