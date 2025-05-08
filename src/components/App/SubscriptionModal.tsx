import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { isLocalhost } from '../../utils/stripeKey';

interface SubscriptionModalProps {
    isVisible: boolean;  // Changed from isOpen to isVisible
    onClose: () => void;
  }

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;
  
  const [isLocal, setIsLocal] = useState(false);
  
  useEffect(() => {
    setIsLocal(isLocalhost());
  }, []);

  const openPaymentLink = (url: string) => {
    // If on localhost, use test payment links
    if (isLocal) {
      // These should be your test payment links from Stripe dashboard
      // REPLACE THESE WITH YOUR ACTUAL TEST PAYMENT LINKS FROM STRIPE DASHBOARD
      const testLinks: {[key: string]: string} = {
        'https://buy.stripe.com/9AQaFieX9bv26fSfYY': 'https://buy.stripe.com/test_dR6dTxeUFgDwbJueUV', // Test Monthly Link
        'https://buy.stripe.com/28obJm2an8iQdIk289': 'https://buy.stripe.com/test_fZe9Dh7sdaf86pafYY', // Test Annual Link
      };
      
      const testUrl = testLinks[url] || url;
      console.log(`[SubscriptionModal] Running on localhost, redirecting to test payment link: ${testUrl}`);
      window.open(testUrl, '_blank');
    } else {
      // In production, use the regular payment links
      window.open(url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-900 rounded-xl p-6">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-2">
            Join The Fitness Collective
          </h2>
          <p className="text-zinc-400">First month on us!</p>
          {isLocal && (
            <div className="mt-2 px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full inline-block">
              Test Mode: Using Stripe Test Environment
            </div>
          )}
          
          {isLocal && (
            <div className="mt-4 p-4 bg-yellow-500/10 text-yellow-300 text-sm rounded-lg border border-yellow-500/20">
              <p className="font-semibold mb-2">⚠️ Test mode detected</p>
              <p className="mb-2">You need to create test price IDs in your Stripe Dashboard to properly test subscriptions on localhost.</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Go to the Stripe Dashboard in test mode</li>
                <li>Navigate to Products &gt; Add Product</li>
                <li>Create the same products with the same prices as your live mode</li>
                <li>Copy the test price IDs and update the test links in this component</li>
                <li>Copy the test price IDs to your subscribe.tsx file</li>
              </ol>
            </div>
          )}
        </div>

        {/* Features List */}
        <div className="space-y-4 mb-8">
          {[
            "Quick and easy access to workouts when you need them",
            "Videos from community members for endless exercise selection",
            "Intelligent workout tracking using AI",
            "30 days free trial included"
          ].map((feature, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center bg-[#E0FE10] rounded-full">
                <span className="text-black text-sm">✓</span>
              </div>
              <span className="text-zinc-400">{feature}</span>
            </div>
          ))}
        </div>

        {/* Subscription Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Monthly Plan */}
          <div className="bg-zinc-800 p-6 rounded-xl">
            <div className="text-white text-2xl font-bold mb-2">$4.99/mo</div>
            <p className="text-zinc-400 text-sm mb-4">
              Flexible monthly plan with easy cancellation
            </p>
            <button 
              onClick={() => openPaymentLink('https://buy.stripe.com/9AQaFieX9bv26fSfYY')}
              className="w-full bg-[#E0FE10] text-black py-2 rounded-lg font-semibold hover:bg-[#E0FE10]/90"
            >
              Subscribe Monthly
            </button>
          </div>

          {/* Annual Plan */}
          <div className="bg-zinc-800 p-6 rounded-xl">
            <div className="text-white text-2xl font-bold mb-2">$39.99/yr</div>
            <p className="text-zinc-400 text-sm mb-4">
              Best value with annual commitment
            </p>
            <button 
              onClick={() => openPaymentLink('https://buy.stripe.com/28obJm2an8iQdIk289')}
              className="w-full bg-[#E0FE10] text-black py-2 rounded-lg font-semibold hover:bg-[#E0FE10]/90"
            >
              Subscribe Yearly
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-zinc-500 text-sm">
          By subscribing, you agree to our Terms of Service and Privacy Policy
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;