import { GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, PaymentRequestButtonElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe - replace with your publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutFormProps {
  challengeId: string;
  amount: number;
  currency: string;
}

interface PaymentPageProps {
  challengeData: any;
}

// The checkout form component - note it's defined INSIDE the main component
// This ensures it has access to the Elements context
const PaymentPage = ({ challengeData }: PaymentPageProps) => {
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);

  useEffect(() => {
    // Check if Apple Pay is available on mount (client-side only)
    if (typeof window !== 'undefined' && window.ApplePaySession && ApplePaySession.canMakePayments()) {
      setIsApplePayAvailable(true);
    }
  }, []);

  if (!challengeData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-white">Loading payment details...</div>
      </div>
    );
  }

  const { challenge } = challengeData.collection;
  const pricingInfo = challenge.pricingInfo || { isEnabled: false, amount: 0, currency: 'USD' };
  const amount = Math.round(pricingInfo.amount * 100); // Convert to cents for Stripe

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10">
      <div className="max-w-md mx-auto px-6">
        <h1 className="text-2xl font-bold mb-2">Complete Your Purchase</h1>
        <h2 className="text-xl mb-6">{challenge.title}</h2>
        
        <div className="mb-8 p-4 bg-zinc-900 rounded-lg">
          <div className="flex justify-between mb-4">
            <span>Round Access</span>
            <span>{(pricingInfo.amount).toFixed(2)} {pricingInfo.currency.toUpperCase()}</span>
          </div>
          <div className="border-t border-zinc-800 pt-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>{(pricingInfo.amount).toFixed(2)} {pricingInfo.currency.toUpperCase()}</span>
          </div>
        </div>
        
        <Elements stripe={stripePromise}>
          <CheckoutForm 
            challengeId={challenge.id} 
            amount={amount} 
            currency={pricingInfo.currency.toLowerCase()} 
            setIsApplePayAvailable={setIsApplePayAvailable}
          />
        </Elements>
        
        <div className="mt-6 space-y-4">
          <p className="text-zinc-400 text-sm text-center">
            Your payment is secure and processed by Stripe.
          </p>
          
          {isApplePayAvailable && (
            <p className="text-zinc-400 text-sm text-center">
              Apple Pay is available for this purchase.
            </p>
          )}
          
          <div className="flex items-center justify-center space-x-4">
            <img src="/visa.svg" alt="Visa" className="h-6" />
            <img src="/mastercard.svg" alt="Mastercard" className="h-6" />
            <img src="/amex.svg" alt="American Express" className="h-6" />
            {isApplePayAvailable && (
              <img src="/apple-pay.svg" alt="Apple Pay" className="h-6" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Inside component definition for CheckoutForm
const CheckoutForm = ({ 
  challengeId, 
  amount, 
  currency, 
  setIsApplePayAvailable 
}: CheckoutFormProps & { 
  setIsApplePayAvailable: (available: boolean) => void 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<any>(null);
  const [paymentMethodAvailable, setPaymentMethodAvailable] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: 'US',
      currency: currency.toLowerCase(),
      total: {
        label: 'Round Access',
        amount: amount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: false,
      disableWallets: ['link'],
    });

    // Enhanced payment method detection
    pr.canMakePayment().then(result => {
      console.log("Payment methods available:", result);
      if (result) {
        setPaymentRequest(pr);
        // Explicitly log and handle Apple Pay
        if (result.applePay) {
          console.log("Apple Pay is available!");
          setIsApplePayAvailable(true);
        }
      }
    });

    // Handle payment completion via Apple Pay/Google Pay
    pr.on('paymentmethod', async (e) => {
      try {
        setProcessing(true);
        
        // Create payment intent on server
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId, amount, currency }),
        });

        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
          e.complete('fail');
          setProcessing(false);
          return;
        }

        // Confirm payment with the payment method from Apple Pay
        const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(
          data.clientSecret,
          { payment_method: e.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          e.complete('fail');
          setError(confirmError.message ?? null);
          setProcessing(false);
        } else {
          e.complete('success');
          setSucceeded(true);
          
          // Record payment completion
          await fetch('/api/complete-round-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              challengeId,
              paymentId: paymentIntent.id
            }),
          });

          // Redirect after payment
          setTimeout(() => {
            router.push(`/download?challengeId=${challengeId}`);
          }, 1500);
        }
      } catch (err) {
        console.error('Payment error:', err);
        e.complete('fail');
        setError('An unexpected error occurred');
        setProcessing(false);
      }
    });
  }, [stripe, currency, amount, challengeId, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }
    
    setProcessing(true);
    
    try {
      // Create payment intent on server
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          challengeId,
          amount,
          currency
        }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setProcessing(false);
        return;
      }
      
      // Confirm the payment with the card element
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) return;
      
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: cardElement,
        }
      });
      
      if (result.error) {
        setError(result.error.message ?? null);
        setProcessing(false);
      } else {
        setSucceeded(true);
        
        // Record payment completion
        await fetch('/api/complete-round-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            challengeId,
            paymentId: result.paymentIntent.id
          }),
        });
        
        // Redirect after payment
        setTimeout(() => {
          router.push(`/download?challengeId=${challengeId}`);
        }, 1500);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {paymentRequest && (
        <div className="mb-8" style={{display: 'block', width: '100%'}}>
          <label className="block text-sm font-medium mb-2">Quick Payment</label>
          <PaymentRequestButtonElement
            className="ApplePayButton"
            options={{
              paymentRequest,
              style: {
                paymentRequestButton: {
                  type: 'buy', // Valid types: default, buy, donate, etc.
                  theme: 'dark',
                  height: '48px',
                },
              },
            }}
          />
          <style jsx>{`
            .ApplePayButton {
              display: block !important;
              width: 100% !important;
              min-height: 48px !important;
              visibility: visible !important;
            }
          `}</style>
          <div className="mt-4 text-center text-sm text-zinc-400">
            Or pay with card
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Card Details</label>
          <div className="p-4 border border-zinc-800 rounded-lg">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#ffffff',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#fa755a',
                    iconColor: '#fa755a',
                  },
                },
                hidePostalCode: true,
              }}
            />
          </div>
        </div>
      
        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
        
        <button
          type="submit"
          disabled={processing || !stripe}
          className={`
            w-full py-4 rounded-xl font-semibold text-lg
            ${processing || succeeded ? 'bg-[#E0FE10]/50' : 'bg-[#E0FE10]'} 
            text-black transition-all
          `}
        >
          {processing ? 'Processing...' : succeeded ? 'Payment Successful!' : `Pay ${(amount/100).toFixed(2)} ${currency.toUpperCase()}`}
        </button>
      </form>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = params?.id as string;
  
  try {
    const response = await fetch(
      `https://fitwithpulse.ai/.netlify/functions/get-challenge-by-id?id=${id}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch challenge');
    }
    
    const data = await response.json();
    
    if (!data.success || !data.collection || !data.collection.challenge) {
      return { notFound: true };
    }
    
    // If challenge is not a paid challenge, redirect to the challenge page
    if (!data.collection.challenge.pricingInfo?.isEnabled) {
      return {
        redirect: {
          destination: `/challenge/${id}`,
          permanent: false,
        },
      };
    }
    
    return {
      props: {
        challengeData: data
      }
    };
  } catch (error) {
    console.error('Error fetching challenge for payment:', error);
    return { notFound: true };
  }
};

// Import useRouter
import { useRouter } from 'next/router';

export default PaymentPage;