import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  closeModal: () => void;
}

const PartnerJoinModal: React.FC<Props> = ({ isOpen, closeModal }) => {
  const [email, setEmail] = useState<string>('');
  const [redemptionCode, setRedemptionCode] = useState<string>('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (redemptionCode === 'CREATORINVITED01') { // Replace with your actual redemption code
      const url = `https://fitwithpulse.ai/.netlify/functions/add-partner-to-beta?email=${encodeURIComponent(email)}`;
      try {
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();
        console.log('Submission success:', data);
        closeModal();
      } catch (error) {
        console.error('Error submitting partner:', error);
      }
    } else {
      alert('Invalid redemption code');
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
        </div>
        </div>
  );
};

export default PartnerJoinModal;