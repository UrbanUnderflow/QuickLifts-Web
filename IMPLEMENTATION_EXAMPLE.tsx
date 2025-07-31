// IMPLEMENTATION EXAMPLE: How to integrate new conversation system into programming.tsx

import React, { useState } from 'react';
import { ConversationProvider, useConversation } from '../contexts/ConversationContext';
import ConversationErrorBoundary from '../components/ConversationErrorBoundary';
import NewConversationButton from '../components/NewConversationButton';
import { MessageSquare, History, X } from 'lucide-react';

// Simplified conversation panel using new context
const ConversationPanel = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { 
    state: { conversations, currentConversationId, isLoading, error },
    switchToConversation,
    clearError
  } = useConversation();

  return (
    <div className={`fixed top-0 right-0 h-full w-80 bg-zinc-900 border-l border-zinc-700 transform transition-transform duration-300 z-50 ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <History size={20} />
            Conversations
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* New conversation button */}
        <div className="p-4 border-b border-zinc-700">
          <NewConversationButton 
            variant="primary"
            className="w-full"
            onSuccess={() => onClose()} // Close panel when new conversation is created
          />
        </div>
        
        {/* Error display */}
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-300 text-xs mt-1"
            >
              Dismiss
            </button>
          </div>
        )}
        
        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-zinc-500">
              <div className="animate-spin w-6 h-6 border-2 border-zinc-600 border-t-[#E0FE10] rounded-full mx-auto mb-2" />
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-zinc-500">
              <MessageSquare size={48} className="mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm">Start chatting to create your first conversation!</p>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => switchToConversation(conversation.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                    conversation.id === currentConversationId
                      ? 'bg-zinc-800 border-[#E0FE10] text-white'
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">
                        {conversation.title || 'Untitled Session'}
                      </h4>
                      <p className="text-xs text-zinc-500 mt-1">
                        {conversation.messages.length} messages
                      </p>
                      {conversation.challengeData.challengeName && (
                        <p className="text-xs text-zinc-400 mt-1 truncate">
                          Round: {conversation.challengeData.challengeName}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 ml-2">
                      {new Date(conversation.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Simplified main component using new context
const ProgrammingPageContent = () => {
  const [showConversationPanel, setShowConversationPanel] = useState(false);
  
  const { 
    state: { currentConversation, conversations, isLoading, error },
    updateCurrentConversation
  } = useConversation();

  // Handle challenge data updates - now much simpler!
  const handleChallengeDataChange = (newData: any) => {
    updateCurrentConversation({ challengeData: newData });
  };

  // Handle stack selection - now much simpler!
  const handleStackSelection = (stacks: any[]) => {
    updateCurrentConversation({ selectedStacks: stacks });
  };

  return (
    <div className="h-screen bg-[#111417] relative">
      {/* Conversation Toggle Button - Fixed Position */}
      <div className="fixed top-6 right-6 z-10">
        <button
          onClick={() => setShowConversationPanel(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/20 backdrop-blur-sm border border-zinc-800 text-white hover:bg-black/30 transition-colors"
        >
          <MessageSquare size={18} />
          <span className="text-sm font-medium">Conversations</span>
          {conversations.length > 0 && (
            <span className="bg-[#E0FE10] text-black text-xs px-2 py-1 rounded-full">
              {conversations.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex h-full">
        {/* Your existing programming interface */}
        <div className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-white mb-6">
            AI Programming Assistant
          </h1>
          
          {/* Display current conversation info */}
          {currentConversation && (
            <div className="bg-zinc-800 rounded-lg p-4 mb-6">
              <h3 className="text-white font-medium">{currentConversation.title}</h3>
              <p className="text-zinc-400 text-sm">
                {currentConversation.messages.length} messages • 
                Last updated: {new Date(currentConversation.updatedAt).toLocaleString()}
              </p>
            </div>
          )}
          
          {/* Your existing challenge configuration UI */}
          <div className="bg-zinc-800 rounded-lg p-6">
            <h2 className="text-white text-lg mb-4">Challenge Configuration</h2>
            
            {/* Example: Challenge name input */}
            <input
              type="text"
              placeholder="Challenge name..."
              value={currentConversation?.challengeData.challengeName || ''}
              onChange={(e) => handleChallengeDataChange({
                ...currentConversation?.challengeData,
                challengeName: e.target.value
              })}
              className="w-full p-3 bg-zinc-700 text-white rounded-lg border border-zinc-600 focus:border-[#E0FE10] transition-colors"
            />
            
            {/* Show offline/loading states */}
            {isLoading && (
              <div className="mt-4 text-zinc-400 text-sm">
                <div className="inline-block animate-spin w-4 h-4 border-2 border-zinc-600 border-t-[#E0FE10] rounded-full mr-2" />
                Syncing changes...
              </div>
            )}
          </div>
          
          {/* Error display */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Panel */}
      <ConversationPanel 
        isOpen={showConversationPanel}
        onClose={() => setShowConversationPanel(false)}
      />
    </div>
  );
};

// Main wrapped component
const ProgrammingPage = () => {
  return (
    <ConversationErrorBoundary 
      onReset={() => {
        // Optional: Custom reset logic
        console.log('Conversation system reset');
      }}
    >
      <ConversationProvider>
        <ProgrammingPageContent />
      </ConversationProvider>
    </ConversationErrorBoundary>
  );
};

export default ProgrammingPage;

/*
Key differences from old implementation:

1. **Simplified State Management**:
   - No more complex useState for conversation state
   - No more manual useEffect for initialization
   - No more complex error handling logic

2. **Automatic Features**:
   - Optimistic updates (UI updates immediately)
   - Offline support (works without internet)
   - Auto-retry on failures
   - Queue-based operations (no race conditions)

3. **Better Error Handling**:
   - Error boundary catches crashes
   - Context handles operation errors
   - Visual feedback for all states

4. **Improved UX**:
   - Loading states for everything
   - Success animations
   - Offline indicators
   - Pending operation indicators

5. **Cleaner Code**:
   - ~50 lines instead of ~500 lines
   - No setTimeout or manual timing
   - No complex async chains
   - Easy to test and maintain

To integrate this into your existing programming.tsx:

1. Replace your conversation-related useState calls with useConversation()
2. Replace your handleCreateNewConversation with <NewConversationButton />
3. Replace manual auto-save with updateCurrentConversation()
4. Wrap everything in ConversationProvider and ConversationErrorBoundary
5. Remove old error handling and loading states

The new system is much more reliable and provides a better user experience!
*/ 