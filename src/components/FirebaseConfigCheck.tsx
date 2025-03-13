import { useEffect, useState } from 'react';

/**
 * Component to validate Firebase configuration at runtime and show a helpful message if there are issues
 */
export default function FirebaseConfigCheck() {
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') return;

    // Check for Firebase config
    const requiredVars = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      const errorMessage = `Missing required Firebase environment variables: ${missingVars.join(', ')}. 
        Please check your .env.local file and restart the dev server.`;
      setConfigError(errorMessage);
      console.error('[Firebase Config Check]', errorMessage);
    }
  }, []);

  if (!configError) return null;

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#f44336',
        color: 'white',
        padding: '15px',
        zIndex: 9999,
        textAlign: 'center',
        fontFamily: 'system-ui',
      }}
    >
      <h3 style={{ margin: '0 0 10px 0' }}>Firebase Configuration Error</h3>
      <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{configError}</p>
      <p style={{ margin: '10px 0 0 0', fontSize: '0.9em' }}>
        This message is only visible during development.
      </p>
    </div>
  );
} 