import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { AlertTriangle, RefreshCw, ArrowLeft, Mail } from 'lucide-react';

const SubscriptionErrorPage: React.FC = () => {
  const router = useRouter();
  const [errorDetails, setErrorDetails] = useState<{
    message?: string;
    error?: string;
    details?: string;
  }>({});

  useEffect(() => {
    // Get error details from query parameters
    const { message, error, details } = router.query;
    setErrorDetails({
      message: message as string,
      error: error as string,
      details: details as string,
    });
  }, [router.query]);

  const handleRetrySubscription = () => {
    router.push('/subscribe');
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const handleContactSupport = () => {
    const subject = encodeURIComponent('Subscription Error - Need Help');
    const body = encodeURIComponent(
      `Hi Pulse Support,\n\nI encountered an error while trying to subscribe:\n\n` +
      `Error: ${errorDetails.message || 'Unknown error'}\n` +
      `Error Code: ${errorDetails.error || 'N/A'}\n` +
      `Details: ${errorDetails.details || 'N/A'}\n\n` +
      `Please help me resolve this issue.\n\nThanks!`
    );
    window.open(`mailto:support@fitwithpulse.ai?subject=${subject}&body=${body}`);
  };

  return (
    <>
      <Head>
        <title>Subscription Error - Pulse</title>
        <meta name="description" content="There was an error processing your subscription. Please try again or contact support." />
      </Head>
      
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        {/* Background gradient effects */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-red-500/10 blur-[150px] rounded-full transform -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-1/4 w-1/2 h-1/2 bg-red-500/10 blur-[150px] rounded-full transform translate-y-1/2"></div>
        </div>

        <div className="relative z-10 max-w-md w-full">
          {/* Error Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
          </div>

          {/* Error Content */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-4">
              Subscription Error
            </h1>
            <p className="text-zinc-400 text-lg mb-6">
              We encountered an issue processing your subscription. Don't worry - no payment has been charged.
            </p>

            {/* Error Details */}
            {errorDetails.message && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-red-400 font-semibold mb-2">Error Details:</h3>
                <p className="text-red-300 text-sm mb-2">{errorDetails.message}</p>
                {errorDetails.error && (
                  <p className="text-red-400 text-xs">Code: {errorDetails.error}</p>
                )}
                {errorDetails.details && (
                  <details className="mt-2">
                    <summary className="text-red-400 text-xs cursor-pointer hover:text-red-300">
                      Technical Details
                    </summary>
                    <p className="text-red-300 text-xs mt-1 font-mono bg-black/20 p-2 rounded">
                      {errorDetails.details}
                    </p>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={handleRetrySubscription}
              className="w-full bg-[#E0FE10] hover:bg-[#d4e900] text-black font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>

            <button
              onClick={handleContactSupport}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="w-5 h-5" />
              Contact Support
            </button>

            <button
              onClick={handleGoHome}
              className="w-full bg-transparent hover:bg-zinc-800/50 text-zinc-400 hover:text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Home
            </button>
          </div>

          {/* Support Info */}
          <div className="mt-8 text-center">
            <p className="text-zinc-500 text-sm">
              Need immediate help? Email us at{' '}
              <a 
                href="mailto:support@fitwithpulse.ai" 
                className="text-[#E0FE10] hover:text-[#d4e900] transition-colors"
              >
                support@fitwithpulse.ai
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SubscriptionErrorPage;

