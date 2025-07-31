import React, { useState } from 'react';
import { Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { useConversation } from '../contexts/ConversationContext';

interface NewConversationButtonProps {
  variant?: 'primary' | 'secondary' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
  onSuccess?: (conversationId: string) => void;
  onError?: (error: Error) => void;
}

const NewConversationButton: React.FC<NewConversationButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  onSuccess,
  onError
}) => {
  const { createNewConversation, state, isReady, isInitialized } = useConversation();
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleCreateConversation = async () => {
    // Prevent clicks if system isn't ready
    if (isCreating || state.isLoading || !isReady) {
      console.log('🚫 Button click ignored - system not ready:', {
        isCreating,
        isLoading: state.isLoading,
        isReady,
        isInitialized
      });
      return;
    }

    setIsCreating(true);
    
    try {
      console.log('🔄 Creating new conversation...');
      const conversationId = await createNewConversation();
      
      // Show success state briefly
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1000);
      
      console.log('✅ Conversation created successfully:', conversationId);
      
      if (onSuccess) {
        onSuccess(conversationId);
      }
    } catch (error) {
      console.error('❌ Failed to create conversation:', error);
      
      if (onError) {
        onError(error as Error);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Base styles
  const baseStyles = "relative overflow-hidden transition-all duration-200 font-medium flex items-center justify-center gap-2 disabled:cursor-not-allowed rounded-lg";
  
  // Variant styles
  const variantStyles = {
    primary: "bg-[#E0FE10] hover:bg-[#d4e600] text-black disabled:opacity-50",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 disabled:opacity-50",
    minimal: "text-zinc-400 hover:text-white hover:bg-zinc-800/50 disabled:opacity-50"
  };
  
  // Size styles
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  const getIcon = () => {
    if (showSuccess) {
      return <CheckCircle2 className="w-4 h-4" />;
    }
    if (isCreating) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    if (!isReady) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    return <Plus className="w-4 h-4" />;
  };

  const getText = () => {
    if (showSuccess) {
      return 'Created!';
    }
    if (isCreating) {
      return 'Loading...';
    }
    if (!isReady) {
      return 'Loading...';
    }
    return children || 'New Conversation';
  };

  const isDisabled = isCreating || state.isLoading || !isReady || showSuccess;

  return (
    <button
      onClick={handleCreateConversation}
      disabled={isDisabled}
      className={combinedStyles}
      aria-label="Create new conversation"
      title={!isReady ? 'Please wait, conversation system is loading...' : 'Create new conversation'}
    >
      {/* Loading/Success background effect */}
      {(isCreating || showSuccess || !isReady) && (
        <div 
          className={`absolute inset-0 ${
            showSuccess 
              ? 'bg-green-500/20' 
              : 'bg-gradient-to-r from-transparent via-white/10 to-transparent'
          } ${(isCreating || !isReady) ? 'animate-pulse' : ''}`}
        />
      )}
      
      {/* Content */}
      <div className="relative flex items-center gap-2">
        {getIcon()}
        <span>{getText()}</span>
      </div>
      
      {/* System not ready indicator */}
      {!isReady && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-zinc-900 animate-pulse" 
             title="System is initializing..." />
      )}
      
      {/* Offline indicator */}
      {state.isOffline && isReady && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-zinc-900" 
             title="You're offline. Conversation will be created when you're back online." />
      )}
      
      {/* Pending operations indicator */}
      {state.pendingOperations.size > 0 && isReady && (
        <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-zinc-900 animate-pulse" 
             title={`${state.pendingOperations.size} operation(s) pending`} />
      )}
    </button>
  );
};

export default NewConversationButton; 