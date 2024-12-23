import React from 'react';
import { GroupMessage } from '../../types/ChatTypes';

interface MessageBubbleProps {
  message: GroupMessage;
  isSentByCurrentUser: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isSentByCurrentUser }) => {
  return (
    <div
      className={`flex ${isSentByCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-xs px-4 py-2 rounded-lg ${
          isSentByCurrentUser ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-200'
        }`}
      >
        {message.mediaURL ? (
          <img src={message.mediaURL} alt="Media" className="w-full rounded-lg mb-2" />
        ) : null}
        <p>{message.content}</p>
        <p className="text-xs text-gray-400 mt-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};

export default MessageBubble;