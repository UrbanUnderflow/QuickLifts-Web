import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { db } from '../../api/firebase/config';
import { collection, query, orderBy, limit, getDocs, getDoc, doc, Timestamp, collectionGroup } from 'firebase/firestore';
import { formatDate, convertFirestoreTimestamp } from '../../utils/formatDate';
import { Loader2, Search, RefreshCw, MessageCircle, Users, ChevronDown, ChevronUp, Eye, Calendar, User as UserIcon, Hash, Clock, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';

// Interface for Group Messages (Challenge chats)
interface GroupMessage {
  id: string;
  challengeId: string;
  sender: {
    id: string;
    username: string;
    displayName?: string;
  };
  content: string;
  checkinId?: string | null;
  timestamp: Timestamp;
  readBy: Record<string, Timestamp>;
  mediaURL?: string | null;
  mediaType: string;
  gymName?: string | null;
}

// Interface for Direct Messages
interface DirectMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Timestamp;
  recipientFcmTokens?: string[];
  workout?: any;
  request?: any;
  senderUsername?: string;
  participants?: {
    id: string;
    username?: string;
  }[];
  participantIds?: string[];
}

// Interface for Chat metadata
interface ChatMetadata {
  id: string;
  participants?: string[];
  createdAt?: Timestamp;
  lastActivity?: Timestamp;
  messageCount?: number;
}

const ChatManagementPage: React.FC = () => {
  // Group Messages State
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [isLoadingGroupMessages, setIsLoadingGroupMessages] = useState(false);
  const [groupMessageLimit, setGroupMessageLimit] = useState(50);
  const [groupMessageSearchQuery, setGroupMessageSearchQuery] = useState('');
  const [filteredGroupMessages, setFilteredGroupMessages] = useState<GroupMessage[]>([]);
  const [expandedGroupMessage, setExpandedGroupMessage] = useState<string | null>(null);

  // Direct Messages State
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [isLoadingDirectMessages, setIsLoadingDirectMessages] = useState(false);
  const [directMessageLimit, setDirectMessageLimit] = useState(50);
  const [directMessageSearchQuery, setDirectMessageSearchQuery] = useState('');
  const [filteredDirectMessages, setFilteredDirectMessages] = useState<DirectMessage[]>([]);
  const [expandedDirectMessage, setExpandedDirectMessage] = useState<string | null>(null);

  // Chat Metadata State
  const [chatMetadata, setChatMetadata] = useState<ChatMetadata[]>([]);
  const [isLoadingChatMetadata, setIsLoadingChatMetadata] = useState(false);

  // General State
  const [activeTab, setActiveTab] = useState<'group' | 'direct' | 'metadata'>('group');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Format timestamp for display using the project's conversion utility
  const formatTimestamp = (timestamp: Timestamp | undefined | null): string => {
    if (!timestamp) return 'N/A';
    try {
      // Use the project's convertFirestoreTimestamp utility
      const convertedDate = convertFirestoreTimestamp(timestamp);
      return convertedDate.toLocaleString();
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid timestamp';
    }
  };

  // Fetch Group Messages (Challenge messages from sweatlist-collection/{id}/messages)
  const fetchGroupMessages = async () => {
    setIsLoadingGroupMessages(true);
    setErrorMessage(null);
    try {
      console.log('[Chat Management] Fetching group messages from sweatlist-collection subcollections...');
      
      // Use collectionGroup to query all messages subcollections across all challenges
      const messagesQuery = query(
        collectionGroup(db, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(groupMessageLimit)
      );
      
      const querySnapshot = await getDocs(messagesQuery);
      
      const messages: GroupMessage[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Extract challengeId from the document reference path
        const pathParts = doc.ref.path.split('/');
        const challengeId = pathParts[1]; // sweatlist-collection/{challengeId}/messages/{messageId}
        
        return {
          id: doc.id,
          challengeId,
          sender: data.sender || { id: 'unknown', username: 'Unknown' },
          content: data.content || '',
          checkinId: data.checkinId || null,
          timestamp: data.timestamp,
          readBy: data.readBy || {},
          mediaURL: data.mediaURL || null,
          mediaType: data.mediaType || 'none',
          gymName: data.gymName || null,
        };
      });
      
      setGroupMessages(messages);
      setFilteredGroupMessages(messages);
      console.log(`[Chat Management] ${messages.length} group messages fetched.`);
      setSuccessMessage(`Successfully loaded ${messages.length} group messages.`);
      
    } catch (error) {
      console.error('[Chat Management] Error fetching group messages:', error);
      setErrorMessage('Failed to fetch group messages from Firestore.');
    } finally {
      setIsLoadingGroupMessages(false);
    }
  };

  // Fetch Direct Messages (from chats/{chatId}/messages) - FIXED
  const fetchDirectMessages = async () => {
    setIsLoadingDirectMessages(true);
    setErrorMessage(null);
    try {
      console.log('[Chat Management] Fetching direct messages from chats subcollections...');
      
      // First, get all chat documents to understand the structure
      const chatsRef = collection(db, 'chats');
      const chatsSnapshot = await getDocs(chatsRef);
      
      const allDirectMessages: DirectMessage[] = [];
      
      // For each chat, fetch its messages and participant info
      for (const chatDoc of chatsSnapshot.docs) {
        const chatId = chatDoc.id;
        const chatData = chatDoc.data();
        const participantIds = chatData.participants || [];
        
        // Fetch usernames for participants
        const participants: { id: string; username?: string }[] = [];
        if (participantIds.length > 0) {
          try {
            // Fetch individual user documents for participants
            for (const participantItem of participantIds) {
              try {
                // Handle cases where participant might be an object or a string
                let participantId: string;
                
                if (typeof participantItem === 'string') {
                  participantId = participantItem;
                } else if (typeof participantItem === 'object' && participantItem !== null) {
                  // If it's an object, try to extract the ID
                  participantId = participantItem.id || participantItem.userId || String(participantItem);
                  console.log(`[Chat Management] Participant is object:`, participantItem, `extracted ID: ${participantId}`);
                } else {
                  console.warn(`[Chat Management] Unexpected participant type:`, typeof participantItem, participantItem);
                  continue; // Skip this participant
                }
                
                if (!participantId || participantId === '[object Object]') {
                  console.warn(`[Chat Management] Invalid participant ID:`, participantItem);
                  participants.push({
                    id: 'invalid',
                    username: 'Invalid Participant'
                  });
                  continue;
                }
                
                // Fetch individual user document by ID
                const userDocRef = doc(db, 'users', participantId);
                const userDocSnapshot = await getDoc(userDocRef);
                
                if (userDocSnapshot.exists()) {
                  const userData = userDocSnapshot.data();
                  participants.push({
                    id: participantId,
                    username: userData.username || userData.displayName || 'Unknown'
                  });
                  console.log(`[Chat Management] Found user ${participantId}: ${userData.username || userData.displayName}`);
                } else {
                  participants.push({
                    id: participantId,
                    username: 'User Not Found'
                  });
                  console.warn(`[Chat Management] User document ${participantId} does not exist`);
                }
              } catch (userError) {
                console.warn(`[Chat Management] Could not fetch user ${participantItem}:`, userError);
                participants.push({
                  id: String(participantItem),
                  username: 'Fetch Error'
                });
              }
            }
          } catch (participantError) {
            console.warn(`[Chat Management] Error fetching participants for chat ${chatId}:`, participantError);
          }
        }
        
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(20)); // Limit per chat
        
        const messagesSnapshot = await getDocs(messagesQuery);
        
        messagesSnapshot.docs.forEach(messageDoc => {
          const data = messageDoc.data();
          allDirectMessages.push({
            id: messageDoc.id,
            chatId,
            senderId: data.senderId || 'unknown',
            content: data.content || '',
            timestamp: data.timestamp,
            recipientFcmTokens: data.recipientFcmTokens || [],
            workout: data.workout || null,
            request: data.request || null,
            senderUsername: data.senderUsername || null,
            participants: participants,
            participantIds: participantIds,
          });
        });
      }
      
      // Sort all messages by timestamp using the project's conversion utility
      allDirectMessages.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        try {
          // Use convertFirestoreTimestamp to handle different timestamp formats
          const dateA = convertFirestoreTimestamp(a.timestamp);
          const dateB = convertFirestoreTimestamp(b.timestamp);
          return dateB.getTime() - dateA.getTime(); // Sort descending (newest first)
        } catch (error) {
          console.error('Error sorting timestamps:', error);
          return 0;
        }
      });
      
      // Limit to the specified amount
      const limitedMessages = allDirectMessages.slice(0, directMessageLimit);
      
      setDirectMessages(limitedMessages);
      setFilteredDirectMessages(limitedMessages);
      console.log(`[Chat Management] ${limitedMessages.length} direct messages fetched from ${chatsSnapshot.docs.length} chats.`);
      setSuccessMessage(`Successfully loaded ${limitedMessages.length} direct messages from ${chatsSnapshot.docs.length} chats.`);
      
    } catch (error) {
      console.error('[Chat Management] Error fetching direct messages:', error);
      setErrorMessage('Failed to fetch direct messages from Firestore.');
    } finally {
      setIsLoadingDirectMessages(false);
    }
  };

  // Fetch Chat Metadata
  const fetchChatMetadata = async () => {
    setIsLoadingChatMetadata(true);
    setErrorMessage(null);
    try {
      console.log('[Chat Management] Fetching chat metadata...');
      
      const chatsRef = collection(db, 'chats');
      const chatsSnapshot = await getDocs(chatsRef);
      
      const metadata: ChatMetadata[] = [];
      
      for (const chatDoc of chatsSnapshot.docs) {
        const data = chatDoc.data();
        const chatId = chatDoc.id;
        
        // Get message count for this chat
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        
        metadata.push({
          id: chatId,
          participants: data.participants || [],
          createdAt: data.createdAt || null,
          lastActivity: data.lastActivity || null,
          messageCount: messagesSnapshot.size,
        });
      }
      
      setChatMetadata(metadata);
      console.log(`[Chat Management] ${metadata.length} chat metadata entries fetched.`);
      setSuccessMessage(`Successfully loaded metadata for ${metadata.length} chats.`);
      
    } catch (error) {
      console.error('[Chat Management] Error fetching chat metadata:', error);
      setErrorMessage('Failed to fetch chat metadata from Firestore.');
    } finally {
      setIsLoadingChatMetadata(false);
    }
  };

  // Filter Group Messages based on search query
  useEffect(() => {
    if (!groupMessageSearchQuery.trim()) {
      setFilteredGroupMessages(groupMessages);
      return;
    }
    
    const lowerCaseQuery = groupMessageSearchQuery.toLowerCase();
    const filtered = groupMessages.filter(message => 
      message.id.toLowerCase().includes(lowerCaseQuery) ||
      message.challengeId.toLowerCase().includes(lowerCaseQuery) ||
      message.content.toLowerCase().includes(lowerCaseQuery) ||
      message.sender?.username?.toLowerCase().includes(lowerCaseQuery) ||
      message.gymName?.toLowerCase().includes(lowerCaseQuery)
    );
    
    setFilteredGroupMessages(filtered);
  }, [groupMessageSearchQuery, groupMessages]);

  // Filter Direct Messages based on search query
  useEffect(() => {
    if (!directMessageSearchQuery.trim()) {
      setFilteredDirectMessages(directMessages);
      return;
    }
    
    const lowerCaseQuery = directMessageSearchQuery.toLowerCase();
    const filtered = directMessages.filter(message => 
      message.id.toLowerCase().includes(lowerCaseQuery) ||
      message.chatId.toLowerCase().includes(lowerCaseQuery) ||
      message.content.toLowerCase().includes(lowerCaseQuery) ||
      message.senderId.toLowerCase().includes(lowerCaseQuery) ||
      message.senderUsername?.toLowerCase().includes(lowerCaseQuery)
    );
    
    setFilteredDirectMessages(filtered);
  }, [directMessageSearchQuery, directMessages]);

  // Toggle expanded view for group messages
  const toggleExpandedGroupMessage = (messageId: string) => {
    setExpandedGroupMessage(expandedGroupMessage === messageId ? null : messageId);
  };

  // Toggle expanded view for direct messages
  const toggleExpandedDirectMessage = (messageId: string) => {
    setExpandedDirectMessage(expandedDirectMessage === messageId ? null : messageId);
  };

  // Clear messages when timeout occurs
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Initial load based on active tab
  useEffect(() => {
    if (activeTab === 'group') {
      fetchGroupMessages();
    } else if (activeTab === 'direct') {
      fetchDirectMessages();
    } else if (activeTab === 'metadata') {
      fetchChatMetadata();
    }
  }, [activeTab, groupMessageLimit, directMessageLimit]);

  return (
    <AdminRouteGuard>
      <Head>
        <title>Chat Management | Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-[#d7ff00] flex items-center">
              <MessageCircle className="w-7 h-7 mr-2" />
              Chat Management
            </h1>
            
            <button
              onClick={() => {
                if (activeTab === 'group') fetchGroupMessages();
                else if (activeTab === 'direct') fetchDirectMessages();
                else if (activeTab === 'metadata') fetchChatMetadata();
              }}
              disabled={isLoadingGroupMessages || isLoadingDirectMessages || isLoadingChatMetadata}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-[#262a30] text-[#d7ff00] hover:bg-[#31363c] border border-gray-700 transition disabled:opacity-70"
            >
              {(isLoadingGroupMessages || isLoadingDirectMessages || isLoadingChatMetadata) ? 
                <Loader2 className="animate-spin h-4 w-4 mr-2" /> : 
                <RefreshCw size={16} className="mr-2"/>
              }
              Refresh Data
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl">
            <div className="flex space-x-1 p-1 bg-[#262a30] rounded-lg mb-6">
              <button
                onClick={() => setActiveTab('group')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center ${
                  activeTab === 'group'
                    ? 'bg-[#d7ff00] text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Users size={16} className="mr-2" />
                Group Messages ({filteredGroupMessages.length})
              </button>
              <button
                onClick={() => setActiveTab('direct')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center ${
                  activeTab === 'direct'
                    ? 'bg-[#d7ff00] text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageCircle size={16} className="mr-2" />
                Direct Messages ({filteredDirectMessages.length})
              </button>
              <button
                onClick={() => setActiveTab('metadata')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center ${
                  activeTab === 'metadata'
                    ? 'bg-[#d7ff00] text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Hash size={16} className="mr-2" />
                Chat Metadata ({chatMetadata.length})
              </button>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-900/30 text-green-400 border border-green-700 rounded-lg flex items-center animate-fadeIn">
                <CheckCircle size={20} className="mr-2" />
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-900/30 text-red-400 border border-red-700 rounded-lg flex items-center animate-fadeIn">
                <AlertTriangle size={20} className="mr-2" />
                {errorMessage}
              </div>
            )}

            {/* Group Messages Tab */}
            {activeTab === 'group' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-[#d7ff00]">Group Messages (Challenge Chats)</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 mr-2">
                      <input
                        type="text"
                        value={groupMessageSearchQuery}
                        onChange={(e) => setGroupMessageSearchQuery(e.target.value)}
                        placeholder="Search group messages..."
                        className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                      />
                      <Search size={16} className="absolute right-3 top-3 text-gray-500" />
                    </div>
                    <select 
                      value={groupMessageLimit}
                      onChange={(e) => setGroupMessageLimit(Number(e.target.value))}
                      className="bg-[#262a30] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white"
                    >
                      <option value={25}>25 messages</option>
                      <option value={50}>50 messages</option>
                      <option value={100}>100 messages</option>
                      <option value={200}>200 messages</option>
                    </select>
                  </div>
                </div>
                
                {isLoadingGroupMessages ? (
                  <div className="flex justify-center p-10">
                    <Loader2 size={30} className="animate-spin text-[#d7ff00]" />
                  </div>
                ) : filteredGroupMessages.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-700 text-left text-gray-400 text-sm">
                          <th className="p-3"></th>
                          <th className="p-3">Message ID</th>
                          <th className="p-3">Challenge ID</th>
                          <th className="p-3">Sender</th>
                          <th className="p-3">Content</th>
                          <th className="p-3">Timestamp</th>
                          <th className="p-3">Media</th>
                          <th className="p-3">Reads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGroupMessages.map((message) => (
                          <React.Fragment key={message.id}>
                            <tr 
                              className={`border-b border-gray-800 hover:bg-[#262a30] ${expandedGroupMessage === message.id ? 'bg-[#262a30]' : ''}`}
                            >
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => toggleExpandedGroupMessage(message.id)}
                                  className="text-gray-500 hover:text-[#d7ff00] transition"
                                >
                                  {expandedGroupMessage === message.id ? (
                                    <ChevronUp size={16} className="text-[#d7ff00]" />
                                  ) : (
                                    <ChevronDown size={16} />
                                  )}
                                </button>
                              </td>
                              <td className="p-3 font-mono text-sm text-gray-300">{message.id.substring(0, 10)}...</td>
                              <td className="p-3 font-mono text-sm text-gray-300">{message.challengeId.substring(0, 8)}...</td>
                              <td className="p-3">{message.sender?.username || 'Unknown'}</td>
                              <td className="p-3 max-w-xs">
                                <div className="truncate">{message.content || 'No content'}</div>
                              </td>
                              <td className="p-3 text-sm text-gray-300">{formatTimestamp(message.timestamp)}</td>
                              <td className="p-3">
                                {message.mediaURL ? (
                                  <CheckCircle size={16} className="text-green-500" />
                                ) : (
                                  <span className="text-gray-500">None</span>
                                )}
                              </td>
                              <td className="p-3 text-sm">{Object.keys(message.readBy).length}</td>
                            </tr>
                            {expandedGroupMessage === message.id && (
                              <tr className="bg-[#262a30]">
                                <td colSpan={8} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="text-[#d7ff00] font-medium mb-2">Message Details</h4>
                                      <div className="space-y-2 text-sm">
                                        <div><span className="text-gray-400">Full ID:</span> {message.id}</div>
                                        <div><span className="text-gray-400">Challenge ID:</span> {message.challengeId}</div>
                                        <div><span className="text-gray-400">Content:</span> {message.content || 'None'}</div>
                                        <div><span className="text-gray-400">Check-in ID:</span> {message.checkinId || 'None'}</div>
                                        <div><span className="text-gray-400">Media Type:</span> {message.mediaType}</div>
                                        <div><span className="text-gray-400">Gym:</span> {message.gymName || 'None'}</div>
                                        {message.mediaURL && (
                                          <div><span className="text-gray-400">Media URL:</span> <a href={message.mediaURL} target="_blank" rel="noopener noreferrer" className="text-[#d7ff00] hover:underline">View Media</a></div>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="text-[#d7ff00] font-medium mb-2">Sender & Reads</h4>
                                      <div className="space-y-2 text-sm">
                                        <div><span className="text-gray-400">Sender ID:</span> {message.sender?.id || 'Unknown'}</div>
                                        <div><span className="text-gray-400">Sender Username:</span> {message.sender?.username || 'Unknown'}</div>
                                        <div><span className="text-gray-400">Display Name:</span> {message.sender?.displayName || 'None'}</div>
                                        <div><span className="text-gray-400">Read Count:</span> {Object.keys(message.readBy).length}</div>
                                        {Object.keys(message.readBy).length > 0 && (
                                          <div>
                                            <span className="text-gray-400">Read By:</span>
                                            <div className="ml-2 mt-1 max-h-20 overflow-y-auto">
                                              {Object.entries(message.readBy).map(([userId, timestamp]) => (
                                                <div key={userId} className="text-xs text-gray-500">
                                                  {userId}: {formatTimestamp(timestamp as Timestamp)}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    {groupMessageSearchQuery ? (
                      <>No group messages match your search query "<span className="text-white">{groupMessageSearchQuery}</span>".</>
                    ) : (
                      <>No group messages found. Try refreshing or checking if there are any challenge chats.</>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Direct Messages Tab */}
            {activeTab === 'direct' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-[#d7ff00]">Direct Messages</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 mr-2">
                      <input
                        type="text"
                        value={directMessageSearchQuery}
                        onChange={(e) => setDirectMessageSearchQuery(e.target.value)}
                        placeholder="Search direct messages..."
                        className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                      />
                      <Search size={16} className="absolute right-3 top-3 text-gray-500" />
                    </div>
                    <select 
                      value={directMessageLimit}
                      onChange={(e) => setDirectMessageLimit(Number(e.target.value))}
                      className="bg-[#262a30] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white"
                    >
                      <option value={25}>25 messages</option>
                      <option value={50}>50 messages</option>
                      <option value={100}>100 messages</option>
                      <option value={200}>200 messages</option>
                    </select>
                  </div>
                </div>
                
                {isLoadingDirectMessages ? (
                  <div className="flex justify-center p-10">
                    <Loader2 size={30} className="animate-spin text-[#d7ff00]" />
                  </div>
                ) : filteredDirectMessages.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-700 text-left text-gray-400 text-sm">
                          <th className="p-3"></th>
                          <th className="p-3">Message ID</th>
                          <th className="p-3">Chat ID</th>
                          <th className="p-3">Participants</th>
                          <th className="p-3">Sender</th>
                          <th className="p-3">Content</th>
                          <th className="p-3">Timestamp</th>
                          <th className="p-3">Recipients</th>
                          <th className="p-3">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDirectMessages.map((message) => (
                          <React.Fragment key={`${message.chatId}-${message.id}`}>
                            <tr 
                              className={`border-b border-gray-800 hover:bg-[#262a30] ${expandedDirectMessage === message.id ? 'bg-[#262a30]' : ''}`}
                            >
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => toggleExpandedDirectMessage(message.id)}
                                  className="text-gray-500 hover:text-[#d7ff00] transition"
                                >
                                  {expandedDirectMessage === message.id ? (
                                    <ChevronUp size={16} className="text-[#d7ff00]" />
                                  ) : (
                                    <ChevronDown size={16} />
                                  )}
                                </button>
                              </td>
                              <td className="p-3 font-mono text-sm text-gray-300">{message.id.substring(0, 10)}...</td>
                              <td className="p-3 font-mono text-sm text-gray-300">{message.chatId.substring(0, 8)}...</td>
                              <td className="p-3 max-w-xs">
                                {message.participants && message.participants.length > 0 ? (
                                  <div className="truncate">
                                    {message.participants.map(p => p.username).join(', ')}
                                  </div>
                                ) : (
                                  <span className="text-gray-500">{message.participantIds?.length || 0} users</span>
                                )}
                              </td>
                              <td className="p-3">{message.senderUsername || message.senderId.substring(0, 8) + '...'}</td>
                              <td className="p-3 max-w-xs">
                                <div className="truncate">{message.content || 'No content'}</div>
                              </td>
                              <td className="p-3 text-sm text-gray-300">{formatTimestamp(message.timestamp)}</td>
                              <td className="p-3 text-sm">{message.recipientFcmTokens?.length || 0}</td>
                              <td className="p-3 text-sm">
                                {message.workout ? 'Workout' : message.request ? 'Request' : 'Text'}
                              </td>
                            </tr>
                            {expandedDirectMessage === message.id && (
                              <tr className="bg-[#262a30]">
                                <td colSpan={9} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="text-[#d7ff00] font-medium mb-2">Message Details</h4>
                                      <div className="space-y-2 text-sm">
                                        <div><span className="text-gray-400">Full Message ID:</span> {message.id}</div>
                                        <div><span className="text-gray-400">Full Chat ID:</span> {message.chatId}</div>
                                        <div><span className="text-gray-400">Sender ID:</span> {message.senderId}</div>
                                        <div><span className="text-gray-400">Sender Username:</span> {message.senderUsername || 'Not set'}</div>
                                        <div><span className="text-gray-400">Content:</span> {message.content || 'None'}</div>
                                        <div><span className="text-gray-400">Timestamp:</span> {formatTimestamp(message.timestamp)}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="text-[#d7ff00] font-medium mb-2">Participants & Recipients</h4>
                                      <div className="space-y-2 text-sm">
                                        <div>
                                          <span className="text-gray-400">Participants ({message.participants?.length || 0}):</span>
                                          {message.participants && message.participants.length > 0 ? (
                                            <div className="ml-2 mt-1 max-h-16 overflow-y-auto">
                                              {message.participants.map((participant, index) => (
                                                <div key={index} className="text-xs">
                                                  <span className="text-gray-300">{participant.username}</span>
                                                  <span className="text-gray-500 ml-1">({participant.id ? String(participant.id).substring(0, 8) + '...' : 'No ID'})</span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="ml-1 text-gray-500">No participant data</span>
                                          )}
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Participant IDs:</span>
                                          {message.participantIds && message.participantIds.length > 0 ? (
                                            <div className="ml-2 mt-1 max-h-12 overflow-y-auto">
                                              {message.participantIds.map((id, index) => (
                                                <div key={index} className="text-xs text-gray-500 font-mono">
                                                  {id}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="ml-1 text-gray-500">None</span>
                                          )}
                                        </div>
                                        <div><span className="text-gray-400">FCM Token Count:</span> {message.recipientFcmTokens?.length || 0}</div>
                                        {message.recipientFcmTokens && message.recipientFcmTokens.length > 0 && (
                                          <div>
                                            <span className="text-gray-400">FCM Tokens:</span>
                                            <div className="ml-2 mt-1 max-h-20 overflow-y-auto">
                                              {message.recipientFcmTokens.map((token, index) => (
                                                <div key={index} className="text-xs text-gray-500 font-mono">
                                                  {token.substring(0, 20)}...
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        <div><span className="text-gray-400">Has Workout:</span> {message.workout ? 'Yes' : 'No'}</div>
                                        <div><span className="text-gray-400">Has Request:</span> {message.request ? 'Yes' : 'No'}</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Enhanced Raw Data Section */}
                                  <div className="mt-6 border-t border-gray-700 pt-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                      {/* Message Raw Data */}
                                      <div>
                                        <details className="text-sm">
                                          <summary className="cursor-pointer text-gray-400 hover:text-white focus:outline-none py-2 bg-[#1f2327] rounded px-3 border border-gray-600">
                                            <span className="flex items-center">
                                              <ChevronRight size={16} className="mr-2" />
                                              <Eye size={16} className="mr-1" />
                                              View Message Raw Data
                                            </span>
                                          </summary>
                                          <pre className="mt-2 p-3 bg-[#1f2327] rounded overflow-x-auto text-xs text-gray-300 border border-gray-600 max-h-80">
                                            {JSON.stringify(message, null, 2)}
                                          </pre>
                                        </details>
                                      </div>
                                      
                                      {/* Chat Document Raw Data */}
                                      <div>
                                        <details className="text-sm">
                                          <summary className="cursor-pointer text-gray-400 hover:text-white focus:outline-none py-2 bg-[#1f2327] rounded px-3 border border-gray-600">
                                            <span className="flex items-center">
                                              <ChevronRight size={16} className="mr-2" />
                                              <Hash size={16} className="mr-1" />
                                              View Chat Metadata
                                            </span>
                                          </summary>
                                          <div className="mt-2 p-3 bg-[#1f2327] rounded border border-gray-600">
                                            <div className="text-xs text-gray-300 space-y-1">
                                              <div><span className="text-gray-400">Chat ID:</span> {message.chatId}</div>
                                              <div><span className="text-gray-400">Participants:</span> {message.participantIds?.length || 0}</div>
                                              <div><span className="text-gray-400">Participant IDs:</span></div>
                                              {message.participantIds?.map((id, index) => (
                                                <div key={index} className="ml-2 font-mono text-xs">{id}</div>
                                              ))}
                                            </div>
                                          </div>
                                        </details>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    {directMessageSearchQuery ? (
                      <>No direct messages match your search query "<span className="text-white">{directMessageSearchQuery}</span>".</>
                    ) : (
                      <>No direct messages found. Try refreshing or check if there are any direct chats.</>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Chat Metadata Tab */}
            {activeTab === 'metadata' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-[#d7ff00]">Chat Metadata</h2>
                </div>
                
                {isLoadingChatMetadata ? (
                  <div className="flex justify-center p-10">
                    <Loader2 size={30} className="animate-spin text-[#d7ff00]" />
                  </div>
                ) : chatMetadata.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-700 text-left text-gray-400 text-sm">
                          <th className="p-3">Chat ID</th>
                          <th className="p-3">Participants</th>
                          <th className="p-3">Message Count</th>
                          <th className="p-3">Created At</th>
                          <th className="p-3">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chatMetadata.map((chat) => (
                          <tr key={chat.id} className="border-b border-gray-800 hover:bg-[#262a30]">
                            <td className="p-3 font-mono text-sm text-gray-300">{chat.id}</td>
                            <td className="p-3">{chat.participants?.length || 0}</td>
                            <td className="p-3">{chat.messageCount || 0}</td>
                            <td className="p-3 text-sm text-gray-300">{formatTimestamp(chat.createdAt)}</td>
                            <td className="p-3 text-sm text-gray-300">{formatTimestamp(chat.lastActivity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No chat metadata found. Try refreshing or check if there are any chats in the system.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AdminRouteGuard>
  );
};

export default ChatManagementPage; 