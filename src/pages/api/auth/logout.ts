import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { redirect } = req.query;
    
    // Clear any server-side session cookies if you have them
    // For Firebase Auth, most of the auth state is client-side
    
    // Build redirect URL
    let redirectUrl = '/login';
    if (redirect && typeof redirect === 'string') {
      redirectUrl = `/login?redirect=${encodeURIComponent(redirect)}&switchAccount=true`;
    }
    
    // For Firebase Auth, we need to handle logout on the client side
    // So we'll return a page that triggers client-side logout and redirects
    const logoutPageHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Signing Out...</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: #0a0a0a; 
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .container { 
              text-align: center; 
              max-width: 400px;
            }
            .spinner {
              border: 2px solid #333;
              border-top: 2px solid #E0FE10;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Signing Out...</h1>
            <div class="spinner"></div>
            <p>Please wait while we sign you out and redirect you.</p>
          </div>

          <script type="module">
            // Import Firebase Auth
            import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
            import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js';

            // Firebase config (you may need to adjust this)
            const firebaseConfig = {
              apiKey: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'your-api-key'}",
              authDomain: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com'}",
              projectId: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id'}"
            };

            // Initialize Firebase
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);

            // Sign out user
            signOut(auth).then(() => {
              console.log('User signed out successfully');
              // Redirect to login page
              window.location.href = '${redirectUrl}';
            }).catch((error) => {
              console.error('Error signing out:', error);
              // Redirect anyway
              window.location.href = '${redirectUrl}';
            });
          </script>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(logoutPageHtml);

  } catch (error) {
    console.error('Error in logout API:', error);
    
    // Fallback redirect
    const redirectUrl = req.query.redirect 
      ? `/login?redirect=${encodeURIComponent(req.query.redirect as string)}&switchAccount=true`
      : '/login';
      
    return res.redirect(302, redirectUrl);
  }
} 