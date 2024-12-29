import React from 'react';
import { UserCircle2, Users } from 'lucide-react';

// Types
interface User {
  id: string;
  username: string;
  profileImage?: {
    profileImageURL: string;
  };
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: Date;
  read: boolean;
}

interface DirectMessage {
  id: string;
  participants: User[];
  lastMessage: string;
  lastMessageTimestamp: Date;
  messages: Message[];
  unreadCount?: number;
}

interface EmptyStateCardProps {
  onShare: () => void;
}

interface MessageListItemProps {
  message: DirectMessage;
  currentUserId: string;
  onSelect: (message: DirectMessage) => void;
}

// Empty State Component
const EmptyStateCard: React.FC<EmptyStateCardProps> = ({ onShare }) => (
  <div 
    className="bg-zinc-800 rounded-lg p-6 mx-4 mb-6 cursor-pointer shadow-lg transition-colors hover:bg-zinc-700/80" 
    onClick={onShare}
  >
    <div className="flex flex-col items-center text-center">
      <div className="bg-zinc-700 p-4 rounded-full mb-4">
        <Users className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        Pulse is even better with friends
      </h3>
      <p className="text-zinc-400 text-sm">
        Find your tribe, or invite your friends to join you sweat. 
        Tap here to send out an invite link.
      </p>
    </div>
  </div>
);

// Message List Item Component
const MessageListItem: React.FC<MessageListItemProps> = ({ 
  message, 
  currentUserId, 
  onSelect 
}) => {
  const otherUser = message.participants.find(p => p.id !== currentUserId);
  
  if (!otherUser) return null;

  const formattedTime = new Date(message.lastMessageTimestamp).toLocaleDateString();
  
  return (
    <div 
      className="flex items-center gap-4 p-4 hover:bg-zinc-800 cursor-pointer transition-colors"
      onClick={() => onSelect(message)}
    >
      {otherUser.profileImage?.profileImageURL ? (
        <img 
          src={otherUser.profileImage.profileImageURL} 
          alt={otherUser.username}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 bg-zinc-700 rounded-full flex items-center justify-center">
          <UserCircle2 className="w-8 h-8 text-zinc-400" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h3 className="text-white font-medium truncate">
            @{otherUser.username}
          </h3>
          <span className="text-xs text-zinc-400 flex-shrink-0">
            {formattedTime}
          </span>
        </div>
        <p className={`text-sm truncate ${
          message.unreadCount ? 'text-white font-medium' : 'text-zinc-400'
        }`}>
          {message.lastMessage}
        </p>
      </div>
    </div>
  );
};

// Main Messages Component
const Messages: React.FC = () => {
  const [messages, setMessages] = React.useState<DirectMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // In a real app, this would come from your auth context
  const currentUser: User = {
    id: 'current-user-id',
    username: 'currentuser'
  };

  React.useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        // In real implementation, replace with actual API call
        const response = await fetch('/api/messages');
        const data = await response.json();
        setMessages(data.messages);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, []);

  const handleShare = async () => {
    const shareData = {
      title: 'Join me on Pulse',
      text: "Hey! Let's workout together using Pulse.",
      url: 'https://fitwithpulse.ai'
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Implement fallback sharing mechanism
        console.log('Share not supported');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleSelectMessage = (message: DirectMessage) => {
    // Implement navigation to message thread
    console.log('Selected message:', message);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="px-4 py-4 flex justify-center relative">
          <h1 className="text-lg font-semibold text-white">Direct Messages</h1>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        <EmptyStateCard onShare={handleShare} />
        
        {messages.length > 0 && (
          <div className="divide-y divide-zinc-800">
            {messages.map(message => (
              <MessageListItem
                key={message.id}
                message={message}
                currentUserId={currentUser.id}
                onSelect={handleSelectMessage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;