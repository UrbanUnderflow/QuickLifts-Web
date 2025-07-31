// TEST COMPONENT: Demonstrates the new reliable conversation system
// To use this, import and render it in your app to test the new system

import React from 'react';
import { ConversationProvider, useConversation } from './src/contexts/ConversationContext';
import ConversationErrorBoundary from './src/components/ConversationErrorBoundary';
import NewConversationButton from './src/components/NewConversationButton';

// Test component that shows conversation state
const ConversationSystemTest = () => {
  const { 
    state, 
    isReady, 
    isInitialized, 
    switchToConversation,
    updateCurrentConversation,
    clearError 
  } = useConversation();

  return (
    <div className="p-6 bg-zinc-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">Conversation System Test</h1>
      
      {/* System Status */}
      <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">System Status</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span>Initialized:</span>
            <span className={isInitialized ? 'text-green-400' : 'text-red-400'}>
              {isInitialized ? '✅ Yes' : '❌ No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Ready:</span>
            <span className={isReady ? 'text-green-400' : 'text-yellow-400'}>
              {isReady ? '✅ Yes' : '⏳ Loading...'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Loading:</span>
            <span className={state.isLoading ? 'text-yellow-400' : 'text-green-400'}>
              {state.isLoading ? '⏳ Yes' : '✅ No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Offline:</span>
            <span className={state.isOffline ? 'text-orange-400' : 'text-green-400'}>
              {state.isOffline ? '📱 Yes' : '🌐 No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Conversations:</span>
            <span className="text-blue-400">{state.conversations.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Pending Ops:</span>
            <span className="text-purple-400">{state.pendingOperations.size}</span>
          </div>
        </div>
        
        {state.error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{state.error}</p>
            <button
              onClick={clearError}
              className="mt-2 text-red-400 hover:text-red-300 text-xs underline"
            >
              Clear Error
            </button>
          </div>
        )}
      </div>

      {/* New Conversation Buttons */}
      <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Create New Conversation</h2>
        <div className="flex gap-3">
          <NewConversationButton 
            variant="primary"
            onSuccess={(id) => console.log('✅ Created:', id)}
            onError={(error) => console.error('❌ Error:', error)}
          />
          
          <NewConversationButton 
            variant="secondary"
            size="lg"
          >
            Large Button
          </NewConversationButton>
          
          <NewConversationButton 
            variant="minimal"
            size="sm"
          >
            Small
          </NewConversationButton>
        </div>
        
        <p className="text-xs text-zinc-400 mt-2">
          Try clicking these buttons multiple times quickly - they should work reliably!
        </p>
      </div>

      {/* Current Conversation */}
      {state.currentConversation && (
        <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Current Conversation</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>ID:</span>
              <span className="font-mono text-blue-400">{state.currentConversation.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Title:</span>
              <span>{state.currentConversation.title}</span>
            </div>
            <div className="flex justify-between">
              <span>Messages:</span>
              <span>{state.currentConversation.messages.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Challenge Name:</span>
              <span>{state.currentConversation.challengeData.challengeName || 'Not set'}</span>
            </div>
          </div>
          
          {/* Test updating conversation */}
          <button
            onClick={() => {
              if (state.currentConversation) {
                updateCurrentConversation({
                  challengeData: {
                    ...state.currentConversation.challengeData,
                    challengeName: `Test Challenge ${Date.now()}`
                  }
                });
              }
            }}
            className="mt-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            Update Challenge Name
          </button>
        </div>
      )}

      {/* All Conversations */}
      <div className="p-4 bg-zinc-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">All Conversations ({state.conversations.length})</h2>
        {state.conversations.length === 0 ? (
          <p className="text-zinc-400 text-sm">No conversations yet. Create one above!</p>
        ) : (
          <div className="space-y-2">
            {state.conversations.map((conversation) => (
              <div 
                key={conversation.id}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  conversation.id === state.currentConversationId
                    ? 'border-[#E0FE10] bg-zinc-700'
                    : 'border-zinc-600 hover:bg-zinc-700'
                }`}
                onClick={() => switchToConversation(conversation.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{conversation.title}</h3>
                    <p className="text-sm text-zinc-400">
                      {conversation.messages.length} messages
                    </p>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(conversation.updatedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Main test component with providers
const ConversationSystemTestApp = () => {
  return (
    <ConversationErrorBoundary>
      <ConversationProvider>
        <ConversationSystemTest />
      </ConversationProvider>
    </ConversationErrorBoundary>
  );
};

export default ConversationSystemTestApp;

/*
To test this system:

1. Import this component into your app
2. Render <ConversationSystemTestApp /> 
3. Try clicking the "New Conversation" buttons rapidly
4. Check that they work reliably on the first click
5. Observe the system status indicators
6. Test offline functionality by going offline in dev tools

You should see:
- ✅ System initializes properly
- ✅ Buttons are disabled until ready
- ✅ First click always works
- ✅ Visual feedback for all states
- ✅ Offline/online handling
- ✅ Error recovery

This replaces the old brittle system with a robust, reliable one!
*/ 