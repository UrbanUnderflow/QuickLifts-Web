import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

const TestPaymentPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [amount, setAmount] = useState(2999); // $29.99 by default
  const router = useRouter();
  
  // Get user from Redux store
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isLoading = useSelector((state: RootState) => state.user.loading);

  const handleCreateTestPayment = async () => {
    if (!currentUser?.id) {
      setError('You must be logged in to create a test payment');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/.netlify/functions/create-test-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId: currentUser.id,
          amount
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Test payment created successfully! Payment ID: ${data.paymentId}`);
      } else {
        setError(data.error || 'Failed to create test payment');
      }
    } catch (err) {
      console.error('Error creating test payment:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state if Redux is loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10">
      <div className="max-w-md mx-auto px-6">
        <h1 className="text-3xl font-bold mb-4">Create Test Payment</h1>
        <p className="mb-6 text-zinc-400">
          This tool creates a test payment record in the database to help you test the payment functionality.
          No actual money is charged.
        </p>
        
        <div className="bg-zinc-900 p-6 rounded-xl mb-8">
          <div className="mb-4">
            <label htmlFor="amount" className="block text-sm font-medium mb-2">
              Payment Amount (in cents)
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] focus:border-transparent"
            />
            <p className="mt-1 text-sm text-zinc-400">
              ${(amount / 100).toFixed(2)} will be shown in your earnings
            </p>
          </div>
          
          {error && (
            <div className="bg-red-900/30 border border-red-500 text-red-200 p-3 mb-4 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-900/30 border border-green-500 text-green-200 p-3 mb-4 rounded">
              {success}
            </div>
          )}
          
          <button 
            onClick={handleCreateTestPayment}
            disabled={loading}
            className={`
              w-full py-3 px-6 rounded-xl font-semibold
              ${loading ? 'bg-[#E0FE10]/50' : 'bg-[#E0FE10]'} 
              text-black transition-all
            `}
          >
            {loading ? 'Creating...' : 'Create Test Payment'}
          </button>
          
          {success && (
            <button
              onClick={() => router.push('/trainer/dashboard')}
              className="w-full mt-4 py-3 px-6 rounded-xl font-semibold bg-zinc-800 text-white hover:bg-zinc-700 transition-all"
            >
              View Dashboard
            </button>
          )}
        </div>
        
        <div className="text-sm text-zinc-400">
          <h3 className="font-medium text-zinc-300 mb-2">What this does:</h3>
          <ul className="space-y-2">
            <li>• Creates a test payment record in the database</li>
            <li>• Uses your user ID as the trainer ID</li>
            <li>• The payment will appear on your dashboard</li>
            <li>• No actual money is charged</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestPaymentPage; 