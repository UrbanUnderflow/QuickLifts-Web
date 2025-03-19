import React, { useState } from 'react';

const NotificationSender = () => {
  const [fcmToken, setFcmToken] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState('');

  const handleSendNotification = async () => {
    // Encode the query parameters to ensure they are URL-safe
    const queryParams = new URLSearchParams({
      fcmToken: fcmToken,
      title: title,
      body: body
    }).toString();
  
    const url = `https://fitwithpulse.ai/.netlify/functions/sendCustomNotification?${queryParams}`;
  
    try {
      const response = await fetch(url, {
        method: 'GET',  // Assuming the server uses GET to retrieve query parameters
        headers: {
          'Content-Type': 'application/json',
        }
      });
  
      const data = await response.json();
      if (response.ok) {
        setResponse('Notification sent successfully!');
      } else {
        throw new Error(data.message || 'Failed to send notification');
      }
    } catch (error) {
      setResponse(`Error: ${error}`);
    }
  };
  

  return (
    <div className="px-20 py-10">
      <h2 className="text-2xl font-bold mb-4">Send Notification</h2>
      <div>
        <input
          type="text"
          value={fcmToken}
          onChange={(e) => setFcmToken(e.target.value)}
          placeholder="Enter FCM Token"
          className="p-2 border rounded mb-4 w-full"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification Title"
          className="p-2 border rounded mb-4 w-full"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Notification Body"
          className="p-2 border rounded mb-4 w-full"
        />
        <button
          onClick={handleSendNotification}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Send Notification
        </button>
        <p className="mt-4">{response}</p>
      </div>
    </div>
  );
};

export default NotificationSender;
