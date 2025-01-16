import React, { useState, useEffect, useRef } from 'react';
import { GroupMessage, QuickMessage } from '../../types/ChatTypes'; // Replace with the actual path to your types
import { UserChallenge } from '../../types/ChallengeTypes'; // Replace with actual path
import { ImageIcon, SendIcon } from 'lucide-react'; // Replace with desired icons
import MessageBubble from '../../components/Rounds/MessageBubble'; // We'll define this below

interface ChallengeChatViewProps {
  participants: UserChallenge[];
  messages: GroupMessage[];
  onSendMessage: (message: string, image?: File) => void;
  currentUser: { id: string; username: string };
}

const RoundChatView: React.FC<ChallengeChatViewProps> = ({
  participants,
  messages,
  onSendMessage,
  currentUser,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [quickMessage, setQuickMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const QUICK_MESSAGES: QuickMessage[] = [
    QuickMessage.Encourage,
    QuickMessage.Congrats,
    QuickMessage.Support,
    QuickMessage.Thanks,
  ];

  useEffect(() => {
    if (quickMessage) {
      setNewMessage(quickMessage);
      setQuickMessage(null);
    }
  }, [quickMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() || selectedImage) {
      onSendMessage(newMessage.trim(), selectedImage || undefined);
      setNewMessage('');
      setSelectedImage(null);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedImage(file);
  };

  return (
    <div className="bg-zinc-900 text-white rounded-xl flex flex-col h-[400px]">
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-zinc-800 rounded-t-xl">
        <div>
          <h2 className="text-lg font-bold">Round Table</h2>
          <p className="text-sm text-gray-400">{participants.length} active now</p>
        </div>
        <button className="text-gray-400 hover:text-white transition">
          <SendIcon size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSentByCurrentUser={message.sender.id === currentUser.id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-800 rounded-b-xl">
        <div className="flex items-center space-x-4">
          <label className="cursor-pointer">
            <ImageIcon size={24} className="text-gray-400 hover:text-white transition" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-700 rounded-lg p-2 text-sm text-white placeholder-gray-400 focus:outline-none"
          />
          <button
            className={`p-2 rounded-lg ${
              newMessage.trim() || selectedImage
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-gray-500 cursor-not-allowed'
            }`}
            onClick={handleSendMessage}
            disabled={!newMessage.trim() && !selectedImage}
          >
            <SendIcon size={20} className="text-white" />
          </button>
        </div>
        {selectedImage && (
          <div className="mt-2 flex items-center">
            <img
              src={URL.createObjectURL(selectedImage)}
              alt="Selected"
              className="w-16 h-16 rounded-lg object-cover"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        )}
      </div>

    {/* Quick Messages */}
    <div className="flex space-x-2 p-4 bg-zinc-900">
        {QUICK_MESSAGES.map((qm) => (
          <button
            key={qm}
            className="px-4 py-2 bg-zinc-800 rounded-full text-sm text-gray-400 hover:bg-zinc-700 hover:text-white"
            onClick={() => setQuickMessage(qm)}
          >
            {qm}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RoundChatView;