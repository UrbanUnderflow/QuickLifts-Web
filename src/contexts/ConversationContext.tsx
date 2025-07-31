import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useEffect, 
  useCallback, 
  ReactNode,
  useRef
} from 'react';
import { 
  ProgrammingConversation, 
  ProgrammingChatMessage,
  programmingConversationService 
} from '../api/firebase/programming';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { generateId } from '../utils/generateId';

// Types
interface ConversationState {
  conversations: ProgrammingConversation[];
  currentConversationId: string | null;
  currentConversation: ProgrammingConversation | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  isReady: boolean; // NEW: Indicates system is ready for operations
  pendingOperations: Set<string>;
  isOffline: boolean;
  operationQueue: QueuedOperation[];
}

interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'addMessage';
  payload: any;
  timestamp: number;
  retryCount: number;
  conversationId?: string;
}

type ConversationAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONVERSATIONS'; payload: ProgrammingConversation[] }
  | { type: 'SET_CURRENT_CONVERSATION'; payload: string | null }
  | { type: 'ADD_CONVERSATION'; payload: ProgrammingConversation }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<ProgrammingConversation> } }
  | { type: 'REMOVE_CONVERSATION'; payload: string }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_READY'; payload: boolean }
  | { type: 'ADD_PENDING_OPERATION'; payload: string }
  | { type: 'REMOVE_PENDING_OPERATION'; payload: string }
  | { type: 'SET_OFFLINE'; payload: boolean }
  | { type: 'ADD_TO_QUEUE'; payload: QueuedOperation }
  | { type: 'REMOVE_FROM_QUEUE'; payload: string }
  | { type: 'CLEAR_QUEUE' };

interface ConversationContextType {
  state: ConversationState;
  
  // Core actions
  createNewConversation: (initialData?: any) => Promise<string>;
  switchToConversation: (conversationId: string) => Promise<void>;
  updateCurrentConversation: (updates: Partial<ProgrammingConversation>) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  addMessage: (conversationId: string, message: ProgrammingChatMessage) => Promise<void>;
  
  // Utility actions
  refreshConversations: () => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;
  retryFailedOperations: () => Promise<void>;
  
  // State helpers
  isReady: boolean;
  isInitialized: boolean;
}

// Initial state
const initialState: ConversationState = {
  conversations: [],
  currentConversationId: null,
  currentConversation: null,
  isLoading: false,
  error: null,
  isInitialized: false,
  isReady: false, // NEW: Start as not ready
  pendingOperations: new Set(),
  isOffline: false,
  operationQueue: []
};

// Reducer
function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload };
      
    case 'SET_CONVERSATIONS':
      return { 
        ...state, 
        conversations: action.payload,
        currentConversation: action.payload.find(c => c.id === state.currentConversationId) || null
      };
      
    case 'SET_CURRENT_CONVERSATION':
      const conversation = state.conversations.find(c => c.id === action.payload) || null;
      return {
        ...state,
        currentConversationId: action.payload,
        currentConversation: conversation
      };
      
    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [action.payload, ...state.conversations]
      };
      
    case 'UPDATE_CONVERSATION':
      const updatedConversations = state.conversations.map(conv => {
        if (conv.id === action.payload.id) {
          // Create a new ProgrammingConversation instance with updated data
          const updatedData = { ...conv, ...action.payload.updates };
          return new ProgrammingConversation(updatedData);
        }
        return conv;
      });
      
      const updatedCurrentConversation = state.currentConversationId === action.payload.id && state.currentConversation
        ? new ProgrammingConversation({ ...state.currentConversation, ...action.payload.updates })
        : state.currentConversation;
        
      return {
        ...state,
        conversations: updatedConversations,
        currentConversation: updatedCurrentConversation
      };
      
    case 'REMOVE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter(c => c.id !== action.payload),
        currentConversationId: state.currentConversationId === action.payload ? null : state.currentConversationId,
        currentConversation: state.currentConversationId === action.payload ? null : state.currentConversation
      };
      
    case 'SET_INITIALIZED':
      return { 
        ...state, 
        isInitialized: action.payload
      };
      
    case 'SET_READY':
      return { ...state, isReady: action.payload };
      
    case 'ADD_PENDING_OPERATION':
      return {
        ...state,
        pendingOperations: new Set([...Array.from(state.pendingOperations), action.payload])
      };
      
    case 'REMOVE_PENDING_OPERATION':
      const newPendingOps = new Set(Array.from(state.pendingOperations));
      newPendingOps.delete(action.payload);
      return {
        ...state,
        pendingOperations: newPendingOps
      };
      
    case 'SET_OFFLINE':
      return { ...state, isOffline: action.payload };
      
    case 'ADD_TO_QUEUE':
      return {
        ...state,
        operationQueue: [...state.operationQueue, action.payload]
      };
      
    case 'REMOVE_FROM_QUEUE':
      return {
        ...state,
        operationQueue: state.operationQueue.filter(op => op.id !== action.payload)
      };
      
    case 'CLEAR_QUEUE':
      return {
        ...state,
        operationQueue: []
      };
      
    default:
      return state;
  }
}

// Context
const ConversationContext = createContext<ConversationContextType | null>(null);

// Provider component
interface ConversationProviderProps {
  children: ReactNode;
}

export const ConversationProvider: React.FC<ConversationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  const { currentUser } = useSelector((state: RootState) => state.user);
  const operationQueueRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      dispatch({ type: 'SET_OFFLINE', payload: false });
      retryFailedOperations();
    };
    
    const handleOffline = () => {
      dispatch({ type: 'SET_OFFLINE', payload: true });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    dispatch({ type: 'SET_OFFLINE', payload: !navigator.onLine });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Queue processor
  useEffect(() => {
    if (state.operationQueue.length > 0 && !state.isOffline) {
      processQueue();
    }
  }, [state.operationQueue.length, state.isOffline]);

  const processQueue = useCallback(async () => {
    if (operationQueueRef.current) return; // Already processing
    
    operationQueueRef.current = setTimeout(async () => {
      const operation = state.operationQueue[0];
      if (!operation) {
        operationQueueRef.current = null;
        return;
      }

      try {
        await executeQueuedOperation(operation);
        dispatch({ type: 'REMOVE_FROM_QUEUE', payload: operation.id });
      } catch (error) {
        console.error('Failed to execute queued operation:', error);
        
        // Retry logic
        if (operation.retryCount < 3) {
          const updatedOperation = {
            ...operation,
            retryCount: operation.retryCount + 1,
            timestamp: Date.now()
          };
          
          dispatch({ type: 'REMOVE_FROM_QUEUE', payload: operation.id });
          dispatch({ type: 'ADD_TO_QUEUE', payload: updatedOperation });
        } else {
          // Max retries reached, remove from queue
          dispatch({ type: 'REMOVE_FROM_QUEUE', payload: operation.id });
          dispatch({ type: 'SET_ERROR', payload: `Failed to ${operation.type} conversation after multiple attempts` });
        }
      }
      
      operationQueueRef.current = null;
    }, 100);
  }, [state.operationQueue]);

  const executeQueuedOperation = async (operation: QueuedOperation) => {
    switch (operation.type) {
      case 'create':
        await programmingConversationService.createConversation(
          operation.payload.userId,
          operation.payload.initialData
        );
        break;
        
      case 'update':
        await programmingConversationService.updateConversation(
          operation.conversationId!,
          operation.payload.updates
        );
        break;
        
      case 'delete':
        await programmingConversationService.deleteConversation(operation.conversationId!);
        break;
        
      case 'addMessage':
        await programmingConversationService.addMessage(
          operation.conversationId!,
          operation.payload.message
        );
        break;
    }
  };

  const queueOperation = (operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>) => {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: generateId(),
      timestamp: Date.now(),
      retryCount: 0
    };
    
    dispatch({ type: 'ADD_TO_QUEUE', payload: queuedOp });
  };

  // Initialize conversations with better error handling
  const initialize = useCallback(async () => {
    if (!currentUser?.id) {
      console.log('❌ Cannot initialize: No current user ID');
      return;
    }

    if (state.isInitialized) {
      console.log('✅ Already initialized');
      return;
    }

    // Prevent multiple simultaneous initializations
    if (initializationRef.current) {
      console.log('⏳ Initialization already in progress');
      await initializationRef.current;
      return;
    }

    console.log('🚀 Starting conversation initialization for user:', currentUser.id);
    
    const initPromise = (async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        // Add a small delay to ensure Firestore is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const conversations = await programmingConversationService.fetchUserConversations(currentUser.id);
        console.log('📡 Fetched conversations:', conversations.length);
        
        dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
        dispatch({ type: 'SET_READY', payload: true }); // Mark as ready after conversations loaded
        
        // Set current conversation to the most recent one
        if (conversations.length > 0) {
          dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: conversations[0].id });
          console.log('📂 Set current conversation:', conversations[0].id);
        }
        
        dispatch({ type: 'SET_INITIALIZED', payload: true });
        console.log('✅ Conversation system initialized successfully');
        
      } catch (error) {
        console.error('❌ Failed to initialize conversations:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load conversations. Please refresh to try again.' });
        
        // Still mark as initialized and ready even if failed, so user can try creating new conversation
        dispatch({ type: 'SET_INITIALIZED', payload: true });
        dispatch({ type: 'SET_READY', payload: true });
        dispatch({ type: 'SET_CONVERSATIONS', payload: [] }); // Set empty array
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
        initializationRef.current = null; // Clear the promise reference
      }
    })();

    initializationRef.current = initPromise;
    await initPromise;
  }, [currentUser?.id, state.isInitialized]);

  // Create new conversation with better precondition checks
  const createNewConversation = useCallback(async (initialData?: any): Promise<string> => {
    console.log('🔄 Create conversation called, checking preconditions...');
    
    // Check authentication
    if (!currentUser?.id) {
      const error = new Error('Please log in to create a conversation');
      console.error('❌', error.message);
      throw error;
    }

    // Ensure system is initialized
    if (!state.isInitialized || !state.isReady) {
      console.log('⏳ System not ready, initializing first...');
      await initialize();
      
      // Double-check after initialization
      if (!state.isReady) {
        const error = new Error('Conversation system is not ready. Please wait a moment and try again.');
        console.error('❌', error.message);
        throw error;
      }
    }

    console.log('✅ Preconditions met, creating conversation...');
    
    const tempId = generateId();
    dispatch({ type: 'ADD_PENDING_OPERATION', payload: tempId });

    // Create temporary conversation for immediate UI update
    const tempConversation = new ProgrammingConversation({
      id: tempId,
      userId: currentUser.id,
      title: 'New Programming Session',
      messages: [],
      challengeData: initialData?.challengeData || {
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        challengeName: '',
        challengeDesc: '',
        roundType: 'together',
        pinCode: '',
        challengeType: 'workout'
      },
      selectedStacks: initialData?.selectedStacks || [],
      aiSettings: {
        selectedCreators: [],
        mustIncludeMoves: [],
        useOnlyCreatorExercises: false
      },
      tags: [],
      sessionDuration: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Optimistic update
    dispatch({ type: 'ADD_CONVERSATION', payload: tempConversation });
    dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: tempId });

    try {
      if (state.isOffline) {
        console.log('📱 Offline: Queuing conversation creation');
        // Queue for later if offline
        queueOperation({
          type: 'create',
          payload: { userId: currentUser.id, initialData },
          conversationId: tempId
        });
      } else {
        console.log('🌐 Online: Creating conversation immediately');
        // Create immediately if online
        const realConversationId = await programmingConversationService.createConversation(
          currentUser.id,
          initialData
        );
        
        console.log('✅ Conversation created with ID:', realConversationId);
        
        // Update the temporary conversation with real ID
        dispatch({ 
          type: 'UPDATE_CONVERSATION', 
          payload: { id: tempId, updates: { id: realConversationId } }
        });
        dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: realConversationId });
      }
      
      return tempId;
    } catch (error) {
      console.error('❌ Failed to create conversation:', error);
      // Remove optimistic update on error
      dispatch({ type: 'REMOVE_CONVERSATION', payload: tempId });
      throw error;
    } finally {
      dispatch({ type: 'REMOVE_PENDING_OPERATION', payload: tempId });
    }
  }, [currentUser?.id, state.isInitialized, state.isReady, state.isOffline, initialize]);

  // Switch to conversation
  const switchToConversation = useCallback(async (conversationId: string) => {
    dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: conversationId });
    
    // If conversation is not in memory, fetch it
    const conversation = state.conversations.find(c => c.id === conversationId);
    if (!conversation) {
      try {
        const fetchedConversation = await programmingConversationService.fetchConversation(conversationId);
        if (fetchedConversation) {
          dispatch({ type: 'ADD_CONVERSATION', payload: fetchedConversation });
        }
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load conversation' });
      }
    }
  }, [state.conversations]);

  // Update current conversation
  const updateCurrentConversation = useCallback(async (updates: Partial<ProgrammingConversation>) => {
    if (!state.currentConversationId) return;

    const conversationId = state.currentConversationId;
    
    // Optimistic update
    dispatch({ 
      type: 'UPDATE_CONVERSATION', 
      payload: { id: conversationId, updates: { ...updates, updatedAt: new Date() } }
    });

    try {
      if (state.isOffline) {
        queueOperation({
          type: 'update',
          payload: { updates },
          conversationId
        });
      } else {
        await programmingConversationService.updateConversation(conversationId, updates);
      }
    } catch (error) {
      console.error('Failed to update conversation:', error);
      // Could implement rollback here if needed
    }
  }, [state.currentConversationId, state.isOffline]);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    // Optimistic update
    dispatch({ type: 'REMOVE_CONVERSATION', payload: conversationId });

    try {
      if (state.isOffline) {
        queueOperation({
          type: 'delete',
          payload: {},
          conversationId
        });
      } else {
        await programmingConversationService.deleteConversation(conversationId);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      // Could implement rollback here
    }
  }, [state.isOffline]);

  // Add message
  const addMessage = useCallback(async (conversationId: string, message: ProgrammingChatMessage) => {
    // Optimistic update
    dispatch({
      type: 'UPDATE_CONVERSATION',
      payload: {
        id: conversationId,
        updates: {
          messages: [...(state.currentConversation?.messages || []), message],
          updatedAt: new Date()
        }
      }
    });

    try {
      if (state.isOffline) {
        queueOperation({
          type: 'addMessage',
          payload: { message },
          conversationId
        });
      } else {
        await programmingConversationService.addMessage(conversationId, message);
      }
    } catch (error) {
      console.error('Failed to add message:', error);
    }
  }, [state.currentConversation?.messages, state.isOffline]);

  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      const conversations = await programmingConversationService.fetchUserConversations(currentUser.id);
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
    } catch (error) {
      console.error('Failed to refresh conversations:', error);
    }
  }, [currentUser?.id]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Retry failed operations
  const retryFailedOperations = useCallback(async () => {
    if (state.operationQueue.length > 0) {
      processQueue();
    }
  }, [state.operationQueue.length, processQueue]);

  // Initialize on mount and when user changes
  useEffect(() => {
    if (currentUser?.id) {
      initialize();
    } else {
      // Reset state when user logs out
      dispatch({ type: 'SET_CONVERSATIONS', payload: [] });
      dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: null });
      dispatch({ type: 'SET_INITIALIZED', payload: false });
      dispatch({ type: 'SET_READY', payload: false });
      dispatch({ type: 'SET_ERROR', payload: null });
    }
  }, [currentUser?.id, initialize]);

  const contextValue: ConversationContextType = {
    state,
    createNewConversation,
    switchToConversation,
    updateCurrentConversation,
    deleteConversation,
    addMessage,
    refreshConversations,
    initialize,
    clearError,
    retryFailedOperations,
    isReady: state.isReady,
    isInitialized: state.isInitialized
  };

  return (
    <ConversationContext.Provider value={contextValue}>
      {children}
    </ConversationContext.Provider>
  );
};

// Hook to use conversation context
export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
};

export default ConversationContext; 