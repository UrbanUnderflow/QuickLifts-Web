// SECURITY NOTE: Remote Login Feature
// 
// This feature allows admins to impersonate any user for debugging purposes.
// Security considerations:
// 1. Tokens expire after 5 minutes
// 2. Tokens can only be used once
// 3. Only verified admins can generate tokens
// 4. All remote logins are logged in Firestore
// 5. Custom tokens include admin impersonation metadata
//
// Usage:
// 1. Admin clicks "Remote Login" button in admin panel
// 2. System generates secure token and stores in Firestore
// 3. Token is consumed to create Firebase custom token
// 4. New tab opens with /remote-login page
// 5. Page authenticates user and redirects to dashboard
//
// Files:
// - netlify/functions/generate-remote-login-token.js
// - netlify/functions/consume-remote-login-token.js  
// - src/pages/remote-login.tsx
// - src/pages/admin/users.tsx (button added)
