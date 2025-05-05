import React, { useState, useEffect } from 'react';
// Import Firebase modules
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from '../../api/firebase/config'; // Updated path to Firebase config

// Initialize Firebase services
const functions = getFunctions(app); // Pass your Firebase app instance
const auth = getAuth(app); // Pass your Firebase app instance

// Get a reference to the Cloud Function
const sendNotificationFunc = httpsCallable(functions, 'sendSingleNotification');

const NotificationSender = () => {
  const [fcmToken, setFcmToken] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      // Add admin role check here if possible based on user claims
      // Example: user?.getIdTokenResult().then(idTokenResult => { setIsAdmin(idTokenResult.claims.admin); });
    });
    return () => unsubscribe(); // Cleanup subscription
  }, []);


  const handleSendNotification = async () => {
    if (!isAuthenticated) {
        setResponse('Error: You must be logged in to send notifications.');
        return;
    }
     // Basic validation
    if (!fcmToken || !title || !body) {
      setResponse('Error: Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    setResponse('Sending...');

    // Structure the data payload according to the Cloud Function's expectation
    const notificationPayload = {
      notification: { 
        title, 
        body 
      },
      // Only include data field if we actually have custom data
      // data: { customKey: 'customValue' } // Add any extra data here if needed
    };
    
    // Direct, simple structure - no unnecessary nesting
    const requestData = { 
      fcmToken, 
      payload: notificationPayload 
    };

    try {
      // Call the Cloud Function
      console.log('Sending notification with data:', requestData);
      const result = await sendNotificationFunc(requestData);
      
      console.log('Notification result:', result);
      // Cloud function returns data in result.data
      const resultData = result.data as { success: boolean; message: string }; // Type assertion

      if (resultData.success) {
        setResponse(`Success: ${resultData.message || 'Notification sent successfully!'}`);
        // Optionally clear fields after success
        // setFcmToken('');
        // setTitle('');
        // setBody('');
      } else {
        setResponse(`Error: ${resultData.message || 'Failed to send notification.'}`);
      }
    } catch (error: any) {
      console.error("Error calling sendSingleNotification function:", error);
       // Handle Firebase HttpsError specifically if needed
       let errorMessage = 'An unexpected error occurred.';
       if (error.code && error.message) {
         // Use the error message provided by Firebase Functions
         errorMessage = error.message; 
       } else if (error instanceof Error) {
         errorMessage = error.message;
       }
      setResponse(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    // Keeping the original Tailwind styling
    <div className="min-h-screen bg-[#111417] text-white py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto bg-[#1a1e24] p-6 sm:p-8 rounded-xl shadow-xl">
             <h2 className="text-2xl font-bold text-center text-[#d7ff00] mb-6">Send Custom Notification</h2>
            <div className="space-y-4">
                 <input
                    type="text"
                    value={fcmToken}
                    onChange={(e) => setFcmToken(e.target.value)}
                    placeholder="Recipient FCM Token"
                    className="w-full p-3 bg-[#262a30] border border-[#40454c] rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#d7ff00]"
                    disabled={isLoading}
                />
                 <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Notification Title"
                    className="w-full p-3 bg-[#262a30] border border-[#40454c] rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#d7ff00]"
                     disabled={isLoading}
                />
                 <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Notification Body"
                    rows={4}
                    className="w-full p-3 bg-[#262a30] border border-[#40454c] rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#d7ff00]"
                    disabled={isLoading}
                />
                <button
                    onClick={handleSendNotification}
                     // Use theme color, disable when loading
                     className={`w-full font-bold py-3 px-4 rounded-md transition duration-300 ease-in-out text-black ${isLoading || !isAuthenticated ? 'bg-gray-500 cursor-not-allowed' : 'bg-[#d7ff00] hover:bg-opacity-80'}`}
                    disabled={isLoading || !isAuthenticated}
                >
                    {isLoading ? 'Sending...' : 'Send Notification'}
                </button>
                {response && (
                    <p className={`mt-4 text-sm p-3 rounded-md ${response.startsWith('Error:') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                        {response}
                    </p>
                 )}
            </div>
        </div>
     </div>
  );
};

export default NotificationSender;
