import React, { useState, useEffect } from 'react';
import { useUser } from '../hooks/useUser';
import { adminMethods } from '../api/firebase/admin/methods';
import { useDispatch } from 'react-redux';
import { clearUser } from '../redux/userSlice';
import { signOut } from 'firebase/auth';
import { auth } from '../api/firebase/config';

const DebugAdmin = () => {
  const user = useUser();
  const dispatch = useDispatch();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        console.log('Checking admin status for email:', user.email);
        const result = await adminMethods.isAdmin(user.email);
        console.log('Admin check result:', result);
        setIsAdmin(result);
      } catch (e) {
        console.error('Admin check error:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
        setIsAdmin(false);
      }
      setLoading(false);
    };

    checkAdmin();
  }, [user]);

  const handleClearStorage = async () => {
    try {
      // Sign out from Firebase
      await signOut(auth);
      
      // Clear Redux state
      dispatch(clearUser());
      
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Try to clear IndexedDB
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map(db => {
            if (db.name) {
              return new Promise((resolve, reject) => {
                const deleteReq = indexedDB.deleteDatabase(db.name!);
                deleteReq.onsuccess = () => resolve(undefined);
                deleteReq.onerror = () => reject(deleteReq.error);
              });
            }
          })
        );
      }
      
      alert('Storage cleared! Please refresh the page.');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing storage:', error);
      alert('Error clearing storage. Please manually clear browser data.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Access Debug</h1>
      
      <div className="space-y-4">
        <div>
          <strong>User Status:</strong> {user ? 'Logged In' : 'Not Logged In'}
        </div>
        
        {user && (
          <>
            <div>
              <strong>Email:</strong> {user.email}
            </div>
            <div>
              <strong>Username:</strong> {user.username}
            </div>
            <div>
              <strong>Display Name:</strong> {user.displayName}
            </div>
          </>
        )}
        
        <div>
          <strong>Admin Check Status:</strong> {loading ? 'Loading...' : isAdmin ? '✅ Admin' : '❌ Not Admin'}
        </div>
        
        {error && (
          <div className="text-red-400">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Instructions:</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Make sure you're logged in with your admin email</li>
            <li>Check that your email exists in the Firestore 'admin' collection</li>
            <li>If you're admin, you should see "✅ Admin" above</li>
            <li>If not, your email needs to be added to the admin collection</li>
          </ol>
        </div>
        
        <div className="mt-6 p-4 bg-zinc-800 rounded">
          <h3 className="font-bold mb-4">Actions:</h3>
          <div className="space-y-3">
            <button
              onClick={handleClearStorage}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
            >
              🗑️ Clear All Storage & Sign Out
            </button>
            <p className="text-sm text-gray-400">
              Use this if you're stuck with the wrong account. This will clear all cached data.
            </p>
          </div>
        </div>

        {user && (
          <div className="mt-6 p-4 bg-zinc-800 rounded">
            <h3 className="font-bold mb-2">Next Steps:</h3>
            {isAdmin ? (
              <p className="text-green-400">
                ✅ You have admin access! Try visiting <a href="/admin" className="underline">/admin</a>
              </p>
            ) : (
              <p className="text-yellow-400">
                ⚠️ Your email ({user.email}) needs to be added to the Firestore 'admin' collection
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugAdmin;
