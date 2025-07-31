import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
  retryCount: number;
}

class ConversationErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ConversationErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // Auto-retry for certain types of errors (network, temporary issues)
    if (this.isRetriableError(error) && this.state.retryCount < 3) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private isRetriableError(error: Error): boolean {
    const retriableMessages = [
      'network',
      'fetch',
      'timeout',
      'connection',
      'firestore'
    ];
    
    return retriableMessages.some(msg => 
      error.message.toLowerCase().includes(msg) ||
      error.name.toLowerCase().includes(msg)
    );
  }

  private scheduleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, this.state.retryCount) * 1000;
    
    this.retryTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }));
    }, delay);
  };

  private handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0
    });
    
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReset = () => {
    // Clear localStorage conversation data if corrupted
    try {
      localStorage.removeItem('conversation_cache');
      localStorage.removeItem('pending_operations');
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0
    });

    if (this.props.onReset) {
      this.props.onReset();
    }

    // Reload the page as last resort
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
          <div className="bg-zinc-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Conversation Error
                </h3>
                <p className="text-sm text-zinc-400">
                  Something went wrong with the conversation system
                </p>
              </div>
            </div>

            {/* Error details */}
            <div className="mb-6 p-3 bg-zinc-900 rounded-lg border border-zinc-700">
              <p className="text-sm text-zinc-300 font-mono">
                {this.state.error?.message || 'Unknown error occurred'}
              </p>
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-2">
                  <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                    Error Details
                  </summary>
                  <pre className="text-xs text-zinc-500 mt-2 overflow-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            {/* Retry information */}
            {this.state.retryCount > 0 && (
              <div className="mb-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-sm text-blue-400">
                  Attempted {this.state.retryCount} automatic retr{this.state.retryCount === 1 ? 'y' : 'ies'}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={this.handleManualRetry}
                className="flex-1 bg-[#E0FE10] hover:bg-[#d4e600] text-black px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Reset
              </button>
            </div>

            {/* Help text */}
            <p className="text-xs text-zinc-500 mt-4 text-center">
              If this error persists, try refreshing the page or clearing your browser cache.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ConversationErrorBoundary; 