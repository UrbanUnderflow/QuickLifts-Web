import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class RouterErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Router Error Boundary caught an error:', error, errorInfo);
    
    // Log additional info for debugging Android issues
    if (typeof window !== 'undefined') {
      console.error('User Agent:', navigator.userAgent);
      console.error('Current URL:', window.location.href);
      console.error('Referrer:', document.referrer);
    }
  }

  handleRetry = () => {
    // Try to recover by reloading the page
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    // Navigate to home page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="mb-8">
              <img src="/pulse-logo-white.svg" alt="Pulse" className="h-12 mx-auto mb-6" />
              <h1 className="text-2xl font-bold mb-4">Oops! Something went wrong</h1>
              <p className="text-zinc-400 mb-6">
                We're having trouble loading this page. This might be a temporary issue.
              </p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={this.handleRetry}
                className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#c8e60e] transition-colors"
              >
                Try Again
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full bg-zinc-800 text-white font-semibold py-3 px-4 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Go to Home
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-zinc-400 hover:text-white">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 p-4 bg-zinc-800 rounded text-xs overflow-auto text-red-400">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouterErrorBoundary; 