import React, { useState } from 'react';

interface EmailMismatchModalProps {
  isOpen: boolean;
  userEmail: string;
  mismatchDetails: {
    accountType: 'creator' | 'winner';
    stripeEmail: string;
    stripeAccountId: string;
  }[];
  onFixComplete: () => void;
  userId: string;
}

const EmailMismatchModal: React.FC<EmailMismatchModalProps> = ({
  isOpen,
  userEmail,
  mismatchDetails,
  onFixComplete,
  userId
}) => {
  const [isFixing, setIsFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleFixMismatch = async () => {
    setIsFixing(true);
    setError('');
    setFixProgress('Analyzing accounts...');

    try {
      // Call the fix function
      setFixProgress('Creating new Stripe accounts with correct email...');
      
      const response = await fetch('/.netlify/functions/fix-email-mismatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          fixMethod: 'create_new_account'
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fix email mismatch');
      }

      setFixProgress('Successfully fixed! Setting up onboarding...');
      
      // Wait a moment for the fix to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setFixProgress('Complete! Redirecting you to complete account setup...');
      
      // Wait a bit more then trigger completion
      setTimeout(() => {
        onFixComplete();
      }, 1500);

    } catch (err) {
      console.error('Error fixing email mismatch:', err);
      setError(err instanceof Error ? err.message : 'Failed to fix email mismatch');
      setIsFixing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 rounded-t-lg">
          <div className="flex items-center">
            <div className="bg-white bg-opacity-20 rounded-full p-2 mr-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Account Email Mismatch Detected</h2>
              <p className="text-red-100 text-sm">Action required to access your earnings</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isFixing ? (
            <>
              {/* Problem Description */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">What's the issue?</h3>
                <p className="text-gray-700 mb-4">
                  We've detected that your Stripe payout account email doesn't match your Pulse profile email. 
                  This prevents us from safely transferring earnings to your account.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Email Details:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <span className="font-medium text-green-600 mr-2">✓ Your Pulse Email:</span>
                      <span className="font-mono bg-green-50 px-2 py-1 rounded">{userEmail}</span>
                    </div>
                    {mismatchDetails.map((detail, index) => (
                      <div key={index} className="flex items-center">
                        <span className="font-medium text-red-600 mr-2">✗ {detail.accountType === 'creator' ? 'Trainer' : 'Winner'} Account:</span>
                        <span className="font-mono bg-red-50 px-2 py-1 rounded">{detail.stripeEmail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Solution */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">How we'll fix this:</h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="bg-blue-100 rounded-full p-1 mr-3 mt-0.5">
                      <span className="text-blue-600 font-bold text-xs">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Create new payout account</p>
                      <p className="text-gray-600 text-sm">We'll create a fresh Stripe account using your correct Pulse email</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-blue-100 rounded-full p-1 mr-3 mt-0.5">
                      <span className="text-blue-600 font-bold text-xs">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Complete account setup</p>
                      <p className="text-gray-600 text-sm">You'll need to verify your information and banking details again</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-blue-100 rounded-full p-1 mr-3 mt-0.5">
                      <span className="text-blue-600 font-bold text-xs">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Clean up old account</p>
                      <p className="text-gray-600 text-sm">We'll safely remove the old account with the incorrect email</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleFixMismatch}
                  className="flex-1 bg-gradient-to-r from-[#E0FE10] to-[#a8d100] text-black font-semibold py-3 px-6 rounded-lg hover:from-[#d0f000] hover:to-[#98c100] transition-all duration-300 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Fix Email Mismatch Now
                </button>
              </div>

              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-yellow-800 font-medium text-sm">Important Note</p>
                    <p className="text-yellow-700 text-sm">
                      This process is safe and won't affect your existing earnings. You'll just need to complete 
                      the Stripe onboarding process again with the correct email.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Fixing Progress */
            <div className="text-center py-8">
              <div className="mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#E0FE10] mx-auto"></div>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Fixing Email Mismatch</h3>
              <p className="text-gray-600 mb-4">{fixProgress}</p>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              
              <div className="bg-gray-100 rounded-full h-2 mb-4">
                <div className="bg-gradient-to-r from-[#E0FE10] to-[#a8d100] h-2 rounded-full transition-all duration-1000"
                     style={{ width: fixProgress.includes('Complete') ? '100%' : fixProgress.includes('Setting up') ? '80%' : fixProgress.includes('Creating') ? '60%' : '20%' }}>
                </div>
              </div>
              
              <p className="text-sm text-gray-500">
                Please don't close this window while we fix your account...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailMismatchModal;