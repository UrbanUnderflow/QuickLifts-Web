import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaUser, FaPaperPlane, FaSpinner } from 'react-icons/fa';
import { 
  coachAthleteMessagingService, 
  CoachAthleteMessage, 
  CoachAthleteConversation 
} from '../api/firebase/messaging/coachAthleteService';
import { useUser } from '../hooks/useUser';

interface CoachAthleteMessagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
  athleteName: string;
  coachId: string;
  coachName: string;
}

const CoachAthleteMessagingModal: React.FC<CoachAthleteMessagingModalProps> = ({
  isOpen,
  onClose,
  athleteId,
  athleteName,
  coachId,
  coachName
}) => {
  const [conversation, setConversation] = useState<CoachAthleteConversation | null>(null);
  const [messages, setMessages] = useState<CoachAthleteMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const _currentUser = useUser();

  useEffect(() => {
    if (isOpen && athleteId && coachId) {
      initializeConversation();
    }
  }, [isOpen, athleteId, coachId]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    let unsubscribeMessages: (() => void) | null = null;

    if (conversation) {
      // Subscribe to real-time messages
      unsubscribeMessages = coachAthleteMessagingService.subscribeToMessages(
        conversation.id,
        (newMessages) => {
          setMessages(newMessages);
          
          // Mark messages as read when they come in
          if (newMessages.length > 0) {
            coachAthleteMessagingService.markMessagesAsRead(conversation.id, coachId);
          }
        }
      );
    }

    return () => {
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
    };
  }, [conversation, coachId]);

  const initializeConversation = async () => {
    try {
      setLoading(true);
      console.log(`Initializing conversation between coach ${coachId} and athlete ${athleteId}`);
      
      const conv = await coachAthleteMessagingService.getOrCreateConversation(
        coachId,
        athleteId,
        coachName,
        athleteName
      );
      
      setConversation(conv);
      
      // Load initial messages
      const initialMessages = await coachAthleteMessagingService.getMessages(conv.id);
      setMessages(initialMessages);
      
      // Mark messages as read
      if (initialMessages.length > 0) {
        await coachAthleteMessagingService.markMessagesAsRead(conv.id, coachId);
      }
    } catch (error) {
      console.error('Error initializing conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversation || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      await coachAthleteMessagingService.sendMessage(
        conversation.id,
        coachId,
        'coach',
        messageContent
      );
      
      // Message will appear via real-time listener
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message on error
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatMessageDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const dateKey = message.timestamp.toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {} as { [date: string]: CoachAthleteMessage[] });

  if (!isOpen) return null;

  // Use portal to render modal outside of any transformed parent (like AthleteCard with Framer Motion)
  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#E0FE10] rounded-full flex items-center justify-center">
              <FaUser className="text-black text-sm" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {athleteName}
              </h2>
              <p className="text-sm text-zinc-400">
                Direct Message
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-2"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E0FE10]"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500">
              <div className="text-center">
                <FaUser className="text-4xl mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Start the conversation</p>
                <p className="text-sm">Send your first message to {athleteName}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedMessages).map(([dateKey, dayMessages]) => (
                <div key={dateKey}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-zinc-800 px-3 py-1 rounded-full">
                      <span className="text-xs text-zinc-400">
                        {formatMessageDate(new Date(dateKey))}
                      </span>
                    </div>
                  </div>
                  
                  {/* Messages for this date */}
                  <div className="space-y-4">
                    {dayMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.senderType === 'coach' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${message.senderType === 'coach' ? 'items-end' : 'items-start'} flex flex-col`}>
                          {/* Sender label */}
                          <div className={`text-xs text-zinc-400 mb-1 ${message.senderType === 'coach' ? 'text-right' : 'text-left'}`}>
                            {message.senderType === 'coach' ? 'You (Coach)' : athleteName}
                          </div>
                          
                          {/* Message bubble */}
                          <div
                            className={`rounded-lg p-3 ${
                              message.senderType === 'coach'
                                ? 'bg-[#E0FE10] text-black'
                                : 'bg-zinc-700 text-white'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className={`text-xs mt-1 opacity-70 ${
                              message.senderType === 'coach' ? 'text-black' : 'text-zinc-400'
                            }`}>
                              {formatMessageTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="border-t border-zinc-700 p-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message ${athleteName}...`}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#E0FE10] focus:ring-opacity-50"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                newMessage.trim() && !sending
                  ? 'bg-[#E0FE10] text-black hover:bg-[#d0ee00]'
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {sending ? (
                <FaSpinner className="animate-spin" />
              ) : (
                <FaPaperPlane />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render to document.body via portal to escape any transformed parent containers
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  
  return modalContent;
};

export default CoachAthleteMessagingModal;
