import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaUser, FaRobot, FaCalendar, FaComments } from 'react-icons/fa';
import { coachService, ConversationSession, ConversationMessage } from '../api/firebase/coach/service';

interface ConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
  athleteName: string;
}

const ConversationModal: React.FC<ConversationModalProps> = ({
  isOpen,
  onClose,
  athleteId,
  athleteName
}) => {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ConversationSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && athleteId) {
      loadConversations();
    }
  }, [isOpen, athleteId]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedSession?.messages]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      console.log(`Loading conversations for athlete: ${athleteId}`);
      
      const conversationSessions = await coachService.getAthleteConversations(athleteId);
      setSessions(conversationSessions);
      
      // Auto-select the most recent session
      if (conversationSessions.length > 0) {
        setSelectedSession(conversationSessions[0]);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSessionDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatSessionTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatMessageTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getSessionDuration = (session: ConversationSession): string => {
    const durationMs = session.endTime.getTime() - session.startTime.getTime();
    const minutes = Math.floor(durationMs / (1000 * 60));
    
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center space-x-3">
            <FaComments className="text-[#E0FE10] text-xl" />
            <div>
              <h2 className="text-xl font-semibold text-white">
                Conversations with {athleteName}
              </h2>
              <p className="text-sm text-zinc-400">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} • {' '}
                {sessions.reduce((total, session) => total + session.messages.length, 0)} total messages
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

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sessions Sidebar */}
          <div className="w-80 border-r border-zinc-700 flex flex-col">
            <div className="p-4 border-b border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wide">
                Chat Sessions
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E0FE10] mx-auto mb-2"></div>
                  <span className="text-sm text-zinc-400">Loading conversations...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-center text-zinc-500">
                  <FaComments className="text-3xl mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations found</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`p-4 border-b border-zinc-800 cursor-pointer transition-colors ${
                      selectedSession?.id === session.id
                        ? 'bg-zinc-800 border-l-4 border-l-[#E0FE10]'
                        : 'hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FaCalendar className="text-zinc-400 text-xs" />
                        <span className="text-sm font-medium text-white">
                          {formatSessionDate(session.startTime)}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {formatSessionTime(session.startTime)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{session.messages.length} messages</span>
                      <span>{getSessionDuration(session)}</span>
                    </div>
                    
                    {/* Preview of last message */}
                    {session.messages.length > 0 && (
                      <div className="mt-2 text-xs text-zinc-500 truncate">
                        {session.messages[session.messages.length - 1].content.substring(0, 60)}
                        {session.messages[session.messages.length - 1].content.length > 60 ? '...' : ''}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 flex flex-col">
            {selectedSession ? (
              <>
                {/* Session Header */}
                <div className="p-4 border-b border-zinc-700 bg-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        Session from {formatSessionDate(selectedSession.startTime)}
                      </h3>
                      <p className="text-sm text-zinc-400">
                        {formatSessionTime(selectedSession.startTime)} - {formatSessionTime(selectedSession.endTime)} • {' '}
                        {selectedSession.messages.length} messages • {getSessionDuration(selectedSession)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedSession.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender === 'user'
                            ? 'bg-[#E0FE10] text-black'
                            : message.sender === 'ai'
                            ? 'bg-zinc-700 text-white'
                            : 'bg-zinc-600 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          {message.sender === 'user' ? (
                            <FaUser className="text-xs mt-1 opacity-70" />
                          ) : message.sender === 'ai' ? (
                            <FaRobot className="text-xs mt-1 opacity-70" />
                          ) : null}
                          <div className="flex-1">
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className={`text-xs mt-1 opacity-70 ${
                              message.sender === 'user' ? 'text-black' : 'text-zinc-400'
                            }`}>
                              {formatMessageTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500">
                <div className="text-center">
                  <FaComments className="text-4xl mx-auto mb-4 opacity-50" />
                  <p>Select a session to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationModal;
