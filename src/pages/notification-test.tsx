import React, { useState } from 'react';

const NotificationTestPage: React.FC = () => {
  const [fcmToken, setFcmToken] = useState('');
  const [title, setTitle] = useState('Test Notification');
  const [body, setBody] = useState('This is a test notification.');
  const [data, setData] = useState('{"type": "test", "key": "value"}');
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sendNotification = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);
  
    try {
      if (!fcmToken.trim()) {
        throw new Error('FCM Token is required');
      }
  
      let parsedData: Record<string, string>;
      try {
        // Parse the custom data
        const rawData = JSON.parse(data);
  
        // Ensure all values in the data are strings
        parsedData = Object.fromEntries(
          Object.entries(rawData).map(([key, value]) => {
            if (typeof value !== 'string') {
              throw new Error(`The value for "${key}" must be a string`);
            }
            return [key, String(value)];
          })
        );
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw new Error('Invalid JSON in custom data field');
        } else {
          throw e;
        }
      }
  
      // Structure the payload to match what the function expects
      const requestBody = {
        fcmToken: fcmToken.trim(),
        payload: {
          notification: {
            title,
            body,
          },
          data: parsedData, // Flattened and validated data
        },
      };
  
      console.log('Sending request with body:', JSON.stringify(requestBody, null, 2)); // Debug log
  
      const response = await fetch('/.netlify/functions/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
  
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text}`);
      }
  
      const result = await response.json();
  
      if (!response.ok) {
        throw new Error(result.message || `Server error: ${response.status}`);
      }
  
      setResponse(JSON.stringify(result, null, 2));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error sending notification:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <h1 className="text-white text-2xl mb-6">Test Notification Function</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendNotification();
        }}
        className="w-full max-w-md bg-zinc-900 p-6 rounded-lg"
      >
        <div className="mb-4">
          <label className="block text-white mb-2">FCM Token:</label>
          <input
            type="text"
            value={fcmToken}
            onChange={(e) => setFcmToken(e.target.value)}
            className="w-full p-2 bg-zinc-800 text-white rounded"
            required
            placeholder="Enter FCM token"
          />
        </div>
        <div className="mb-4">
          <label className="block text-white mb-2">Notification Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 bg-zinc-800 text-white rounded"
            required
            placeholder="Enter notification title"
          />
        </div>
        <div className="mb-4">
          <label className="block text-white mb-2">Notification Body:</label>
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full p-2 bg-zinc-800 text-white rounded"
            required
            placeholder="Enter notification body"
          />
        </div>
        <div className="mb-4">
          <label className="block text-white mb-2">Custom Data (JSON):</label>
          <textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            rows={5}
            className="w-full p-2 bg-zinc-800 text-white rounded"
            placeholder="Enter valid JSON data"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-2 rounded-lg font-bold ${
            isLoading 
              ? 'bg-gray-500 cursor-not-allowed' 
              : 'bg-[#E0FE10] text-black hover:bg-[#d4f00f]'
          }`}
        >
          {isLoading ? 'Sending...' : 'Send Notification'}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-900 text-white w-full max-w-md rounded-lg">
          <h2 className="text-lg font-bold mb-2">Error:</h2>
          <pre className="whitespace-pre-wrap break-words">{error}</pre>
        </div>
      )}

      {response && (
        <div className="mt-6 p-4 bg-green-900 text-white w-full max-w-md rounded-lg">
          <h2 className="text-lg font-bold mb-2">Response:</h2>
          <pre className="whitespace-pre-wrap">{response}</pre>
        </div>
      )}
    </div>
  );
};

export default NotificationTestPage;