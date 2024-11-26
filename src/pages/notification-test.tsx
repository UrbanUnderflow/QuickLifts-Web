import React, { useState } from 'react';

const NotificationTestPage: React.FC = () => {
  const [fcmToken, setFcmToken] = useState('');
  const [title, setTitle] = useState('Test Notification');
  const [body, setBody] = useState('This is a test notification.');
  const [data, setData] = useState('{"type": "test", "key": "value"}');
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendNotification = async () => {
    try {
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch {
        throw new Error("Invalid JSON in custom data field.");
      }

      const response = await fetch('/.netlify/functions/send-custom-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fcmToken,
          title,
          body,
          data: parsedData
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setResponse(JSON.stringify(result, null, 2));
        setError(null);
      } else {
        throw new Error(result.message || 'Failed to send notification');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unexpected error occurred.";
      setError(errorMessage);
      console.error(errorMessage);
      setResponse(null);
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
          />
        </div>
        <div className="mb-4">
          <label className="block text-white mb-2">Notification Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 bg-zinc-800 text-white rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block text-white mb-2">Notification Body:</label>
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full p-2 bg-zinc-800 text-white rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block text-white mb-2">Custom Data (JSON):</label>
          <textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            rows={5}
            className="w-full p-2 bg-zinc-800 text-white rounded"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-[#E0FE10] text-black py-2 rounded-lg font-bold"
        >
          Send Notification
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