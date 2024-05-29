import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  closeModal: () => void;
}

const PartnerJoinModal: React.FC<Props> = ({ isOpen, closeModal }) => {
  const [email, setEmail] = useState<string>('');
  const [redemptionCode, setRedemptionCode] = useState<string>('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error' | 'invalid-code'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (redemptionCode === 'CREATORINVITED01') {
      const url = `https://fitwithpulse.ai/.netlify/functions/add-partner-to-beta?email=${encodeURIComponent(email)}`;
      try {
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'An unknown error occurred');
        }
        const data = await response.json();
        console.log('Submission success:', data);
        setSubmissionStatus('success');
      } catch (error) {
        console.error('Error submitting partner:', error);
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('An unknown error occurred');
        }
        setSubmissionStatus('error');
      }
    } else {
      setSubmissionStatus('invalid-code');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="fixed inset-0 bg-black opacity-50"></div>
      <div className="bg-white rounded-lg p-8 w-full max-w-md mx-auto z-10">
        <div className="flex justify-end">
          <button
            onClick={closeModal}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        {submissionStatus === 'success' ? (
          <>
            <h2 className="text-2xl font-bold mb-4">Success!</h2>
            <p className="text-green-600 mb-4">Your request to join as a partner has been submitted successfully.</p>
            <h3 className="text-xl font-bold mb-2">So, What's Next?</h3>
            <ol className="list-decimal list-inside mb-4">
              <li className="mb-2">Use the link below to download the app.</li>
              <li className="mb-2">Create an account and make sure you use the same email you used previously.</li>
              <li>Once you sign up you should be able to access the app without paying the subscription.</li>
            </ol>
            <a
              href="https://download-link-to-app.com"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:bg-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download the App
            </a>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4">Join as a Partner</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-gray-700 font-bold mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="redemptionCode" className="block text-gray-700 font-bold mb-2">
                  Redemption Code
                </label>
                <input
                  type="text"
                  id="redemptionCode"
                  value={redemptionCode}
                  onChange={(e) => setRedemptionCode(e.target.value)}
                  className="w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Enter redemption code"
                  required
                />
                {submissionStatus === 'invalid-code' && (
                  <p className="text-red-600 mt-2">Invalid redemption code. Please try again.</p>
                )}
                {submissionStatus === 'error' && (
                  <p className="text-red-600 mt-2">{errorMessage}</p>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:bg-blue-700"
                >
                  Submit
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default PartnerJoinModal;