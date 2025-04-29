# Netlify Functions Structure Guidelines

This document outlines the standard structure and best practices for creating Netlify serverless functions within the Pulse project, particularly those interacting with Firebase.

## 1. File Naming

- Use descriptive, kebab-case names (e.g., `delete-user.js`, `verify-subscription.js`).
- Place function files directly within the `netlify/functions/` directory.

## 2. Shared Configuration

- **Utilize `config/firebase.js`:** All functions interacting with Firebase should import necessary instances and configurations from the shared `netlify/functions/config/firebase.js` file. This promotes consistency and simplifies initialization.
- **Expected Exports from `config/firebase.js`:**
    - `admin`: Initialized Firebase Admin SDK instance.
    - `db`: Firestore database instance (`admin.firestore()`).
    - `headers`: Standard response headers (e.g., for CORS).

```javascript
// Example Import
const { admin, db, headers } = require('./config/firebase');

// Get other admin services as needed
const auth = admin.auth();
const messaging = admin.messaging();
// ...etc
```

## 3. Handler Structure

- Use the standard Netlify handler signature: `exports.handler = async (event, context) => { ... };`

## 4. Initial Checks

- **HTTP Method Validation:** Always check `event.httpMethod`. Reject unsupported methods (usually allowing only `POST` for functions performing actions).
- **OPTIONS Preflight:** Handle `OPTIONS` requests for CORS by returning a `200 OK` response with the standard `headers`.

```javascript
exports.handler = async (event, context) => {
  // Handle OPTIONS preflight request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Check for allowed method (e.g., POST)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'POST' },
      body: JSON.stringify({ success: false, message: 'Method Not Allowed' }),
    };
  }

  // ... rest of the function logic
}
```

## 5. Security (CRITICAL)

- **Authentication/Authorization:** For functions performing sensitive actions (like deleting users, granting admin rights), **always** verify the caller's identity and permissions.
    - Extract the Firebase ID token from the `Authorization: Bearer <token>` header (`event.headers.authorization`).
    - Verify the token using `admin.auth().verifyIdToken(idToken)`.
    - Check the decoded token for custom admin claims (`decodedToken.admin === true`) or verify the user's UID against an admin list/role in Firestore.
    - Return `401 Unauthorized` or `403 Forbidden` if verification fails. **Do not skip this step.**

```javascript
  // --- Placeholder - Implement robust check! ---
  const authorizationHeader = event.headers.authorization;
  let isAdmin = false;
  if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
    const idToken = authorizationHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      // Example: Check custom claim
      if (decodedToken.admin === true) {
         console.log(`Admin action performed by: ${decodedToken.email} (UID: ${decodedToken.uid})`);
         isAdmin = true;
      } else {
         console.warn(`Non-admin user attempt: ${decodedToken.email} (UID: ${decodedToken.uid})`);
      }
      // OR: Check against an admin collection in Firestore using decodedToken.uid
    } catch (error) {
      console.error('Error verifying admin token:', error);
    }
  }

  if (!isAdmin) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ success: false, message: 'Forbidden: Admin privileges required.' })
    };
  }
  // --- End Security Check ---
```

## 6. Request Body Parsing

- Safely parse the request body, providing a fallback for empty bodies.

```javascript
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('Error parsing request body:', e);
    return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'Invalid request body.' })
    };
  }
  const { param1, param2 } = body; // Destructure required params

  // Validate required parameters
  if (!param1) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Missing required parameter: param1' })};
  }
```

## 7. Logging

- Implement clear and concise logging using `console.log`, `console.warn`, and `console.error`.
- Include a unique prefix (e.g., `[delete-user]`) for easy identification in Netlify logs.
- Log key events: function invocation, parameters received, major steps, success, and errors.

## 8. Core Logic

- Perform the primary function task (e.g., interacting with Firestore, Auth, external APIs).
- Wrap logic in `try...catch` blocks for robust error handling.

## 9. Response Structure

- Return consistent JSON responses.
- Include the standard `headers` for CORS.
- Use a standard success/error format:
    - **Success:** `statusCode: 200`, `body: JSON.stringify({ success: true, message: '...', ...data })`
    - **Error:** Appropriate `statusCode` (4xx, 5xx), `body: JSON.stringify({ success: false, message: '...' })`

## 10. Error Handling

- Catch errors within the main `try...catch` block.
- Handle specific known errors (e.g., `auth/user-not-found`) gracefully if possible.
- Return a generic `500 Internal Server Error` for unexpected issues. 