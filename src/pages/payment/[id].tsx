import { GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { loadStripe, PaymentRequest } from '@stripe/stripe-js';
import { Elements, CardElement, PaymentRequestButtonElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { userService } from '../../api/firebase/user/service';

// Helper function to check if we're in localhost
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1');

// Initialize Stripe with the appropriate key based on environment
const getStripeKey = () => {
  if (isLocalhost) {
    // In localhost, check localStorage for test mode preference
    const isTestMode = localStorage.getItem('stripeTestMode') === 'true';
    return isTestMode 
      ? process.env.NEXT_PUBLIC_TEST_STRIPE_PUBLISHABLE_KEY
      : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  }
  
  // In production, always use live mode
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
};

// Initialize Stripe promise as null
let stripePromise: Promise<any> | null = null;

// Appearance for Stripe Elements
const appearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#E0FE10',
    colorBackground: '#18181b',
    colorText: '#ffffff',
    colorDanger: '#ff5252',
  },
};

interface CheckoutFormProps {
  challengeId: string;
  amount: number;
  currency: string;
  isApplePayAvailable: boolean;
  challengeData: {
    collection: {
      challenge: {
        id: string;
        title: string;
        ownerId?: string;
        pricingInfo?: {
          isEnabled: boolean;
          amount: number;
          currency: string;
        };
      };
    };
  };
}

interface PaymentPageProps {
  challengeData: {
    collection: {
      challenge: {
        id: string;
        title: string;
        pricingInfo?: {
          isEnabled: boolean;
          amount: number;
          currency: string;
        };
        ownerId?: string;
      };
    };
  };
}

// Main component
const PaymentPage = ({ challengeData }: PaymentPageProps) => {
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [stripeLoaded, setStripeLoaded] = useState(false);

  useEffect(() => {
    // Initialize Stripe
    const initStripe = async () => {
      console.log('Initializing Stripe...');
      const key = getStripeKey();
      console.log('Got Stripe key:', key ? 'Key present' : 'No key found');
      
      if (!key) {
        console.error('Failed to initialize Stripe: No valid key found');
        return;
      }

      try {
        console.log('Loading Stripe with key...');
        stripePromise = loadStripe(key, {
          apiVersion: '2023-10-16',
          stripeAccount: undefined,
          betas: undefined,
          locale: undefined
        });
        console.log('Stripe Key Mode:', key.startsWith('pk_test_') ? 'Test Mode' : 'Live Mode');
        setStripeLoaded(true);
        console.log('Stripe loaded successfully');
      } catch (error) {
        console.error('Error initializing Stripe:', error);
      }
    };

    // Check if Apple Pay is available on supported browsers
    if (typeof window !== 'undefined') {
      console.log('Window is defined, initializing...');
      if (window.ApplePaySession && ApplePaySession.canMakePayments()) {
        setIsApplePayAvailable(true);
        console.log("Apple Pay is supported on this device");
      } else {
        console.log("Apple Pay is NOT supported on this device");
      }

      // Initialize test mode from localStorage if in localhost
      if (isLocalhost) {
        const savedTestMode = localStorage.getItem('stripeTestMode') === 'true';
        console.log('Test mode from localStorage:', savedTestMode);
        setIsTestMode(savedTestMode);
      }

      // Initialize Stripe
      initStripe();
    }
  }, []);

  const handleTestModeToggle = (enabled: boolean) => {
    setIsTestMode(enabled);
    localStorage.setItem('stripeTestMode', enabled.toString());
    // Reload the page to reinitialize Stripe with the new key
    window.location.reload();
  };

  if (!challengeData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-white">Loading payment details...</div>
      </div>
    );
  }

  const { challenge } = challengeData.collection;
  const pricingInfo = challenge.pricingInfo || { isEnabled: false, amount: 0, currency: 'USD' };
  // Calculate base amount and fee
  const baseAmount = Math.round(pricingInfo.amount * 100); // Convert to cents for Stripe
  const processingFee = Math.round(baseAmount * 0.035); // 3.5% fee
  const totalAmount = baseAmount + processingFee;

  // Options for the Stripe Elements
  const stripeElementsOptions = {
    appearance,
    paymentRequest: {
      country: 'US',
      currency: pricingInfo.currency.toLowerCase(),
      total: {
        label: challenge.title || 'Round Access',
        amount: totalAmount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    },
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10">
      <div className="max-w-md mx-auto px-6">
        {(isLocalhost || userService.currentUser?.email === "tremaine.grant@gmail.com") && (
          <div className="mb-6 p-4 bg-zinc-900 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Test Mode</span>
              <button
                onClick={() => handleTestModeToggle(!isTestMode)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full
                  ${isTestMode ? 'bg-[#E0FE10]' : 'bg-zinc-700'}
                  transition-colors focus:outline-none
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-black
                    transition-transform
                    ${isTestMode ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              {isTestMode 
                ? 'Using test mode keys. Use test card numbers (e.g., 4242 4242 4242 4242)'
                : 'Using live mode keys. Real payments will be processed'}
            </p>
          </div>
        )}
        
        <h1 className="text-2xl font-bold mb-2">Complete Your Purchase</h1>
        <h2 className="text-xl mb-6">{challenge.title}</h2>
        
        <div className="mb-8 p-4 bg-zinc-900 rounded-lg">
          <div className="flex justify-between mb-4">
            <span>Round Access</span>
            <span>${(baseAmount / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-4">
            <span className="text-zinc-400">Processing Fee</span>
            <span className="text-zinc-400">${(processingFee / 100).toFixed(2)}</span>
          </div>
          <div className="border-t border-zinc-700 pt-4 flex justify-between font-bold">
            <span>Total</span>
            <span>${(totalAmount / 100).toFixed(2)}</span>
          </div>
        </div>
        
        {stripeLoaded && stripePromise ? (
          <Elements stripe={stripePromise} options={stripeElementsOptions}>
            <CheckoutForm 
              challengeId={challenge.id} 
              amount={totalAmount}
              currency={pricingInfo.currency}
              isApplePayAvailable={isApplePayAvailable}
              challengeData={challengeData}
            />
          </Elements>
        ) : (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#E0FE10] mx-auto"></div>
            <p className="mt-2 text-sm text-zinc-400">Loading payment form...</p>
          </div>
        )}
        
        <div className="mt-6 space-y-4">
          <p className="text-zinc-400 text-sm text-center">
            Your payment is secure and processed by Stripe.
          </p>
          
          <div className="flex items-center justify-center space-x-4">
            <img src="/visa.svg" alt="Visa" className="h-6" />
            <img src="/master-card.svg" alt="Mastercard" className="h-6" />
            <img src="/american-express.svg" alt="American Express" className="h-6" />
            <img src="/discover-card.svg" alt="Discover Card" className="h-6" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Checkout form component
const CheckoutForm = ({ challengeId, amount, currency, isApplePayAvailable, challengeData }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [paymentMethodsAvailable, setPaymentMethodsAvailable] = useState({
    applePay: false,
    googlePay: false,
    browserPaymentMethods: false
  });

  useEffect(() => {
    if (!stripe) return;
    
    console.log("Setting up payment request in useEffect");
    
    try {
      // Configure the payment request with all options
      const pr = stripe.paymentRequest({
        country: 'US',
        currency: currency.toLowerCase(),
        total: {
          label: 'Round Access',
          amount: amount,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });
      
      // Check if the browser supports this payment request
      pr.canMakePayment().then(result => {
        console.log("Payment methods result:", result);
        
        if (result) {
          setPaymentRequest(pr);
          
          // Update available payment methods
          setPaymentMethodsAvailable({
            applePay: !!result.applePay,
            googlePay: !!result.googlePay,
            browserPaymentMethods: true
          });
          
          console.log("Payment methods available:", {
            applePay: !!result.applePay,
            googlePay: !!result.googlePay
          });
        } else {
          console.log("No payment methods available through Payment Request API");
        }
      }).catch(err => {
        console.error("Error checking for payment methods:", err);
      });

      // Handle payment method selection
      pr.on('paymentmethod', async (e) => {
        try {
          setProcessing(true);
          console.log("Payment method selected:", e.paymentMethod.type);
          
          if (!stripe || !elements) {
            setError('Payment system not initialized');
            setProcessing(false);
            return;
          }
          
          // Create payment intent on server
          const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              challengeId, 
              amount, 
              currency,
              payment_method_type: e.paymentMethod.type 
            }),
          });

          const data = await response.json();
          
          if (data.error) {
            setError(data.error);
            e.complete('fail');
            setProcessing(false);
            return;
          }

          // Confirm with card
          const cardElement = elements.getElement(CardElement);
          if (!cardElement) {
            setError('Card element not found');
            setProcessing(false);
            return;
          }
          
          const result = await stripe.confirmCardPayment(
            data.clientSecret,
            { payment_method: { card: cardElement } }
          );
          
          if (result.error) {
            e.complete('fail');
            setError(result.error.message ?? 'Payment failed');
            setProcessing(false);
          } else {
            e.complete('success');
            setSucceeded(true);
            
            // Record payment
            await fetch('/api/complete-round-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
          console.error("Payment error:", err);
          e.complete('fail');
          setError('An unexpected error occurred');
          setProcessing(false);
        }
      });
    } catch (err) {
      console.error("Error setting up payment request:", err);
    }
  }, [stripe, amount, currency, challengeId, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      console.error('Stripe or Elements not initialized');
      return;
    }
    
    setProcessing(true);
    
    try {
      const trainerUserId = challengeData.collection.challenge.ownerId || '';
      console.log('Creating payment intent for trainer:', trainerUserId);
      
      // Use the appropriate function based on test mode
      const isTestMode = localStorage.getItem('stripeTestMode') === 'true';
      const functionUrl = isTestMode 
        ? '/.netlify/functions/create-payment-intent-test'
        : '/.netlify/functions/create-payment-intent';
      
      console.log('Using payment intent function:', functionUrl);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          challengeId, 
          amount, 
          currency,
          trainerId: trainerUserId
        }),
      });
      
      console.log('Payment intent response status:', response.status);
      const data = await response.json();
      console.log('Payment intent response data:', data);
      
      if (!data.success || data.error) {
        console.error('Payment intent creation failed:', data.error);
        setError(data.error || 'Failed to create payment intent');
        setProcessing(false);
        return;
      }
      
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        console.error('Card element not found');
        setError('Card element not found');
        setProcessing(false);
        return;
      }
      
      console.log('Confirming card payment with client secret');
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: cardElement,
        },
        // Add return_url for 3D Secure authentication
        return_url: `${window.location.origin}/payment/complete?challengeId=${challengeId}`
      });
      
      console.log('Card payment result:', result);
      
      if (result.error) {
        console.error('Card payment failed:', result.error);
        setError(result.error.message ?? 'Payment failed');
        setProcessing(false);
      } else {
        console.log('Payment successful, recording payment');
        setSucceeded(true);
        
        // Record payment using Netlify function
        const recordResponse = await fetch('/.netlify/functions/complete-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            challengeId,
            paymentId: result.paymentIntent.id,
            userId: localStorage.getItem('userId') || undefined,
            trainerId: trainerUserId,
            amount: amount
          }),
        });
        
        console.log('Payment record response:', recordResponse.status);
        
        setTimeout(() => {
          console.log('Redirecting to download page');
          router.push(`/download?challengeId=${challengeId}`);
        }, 1500);
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Direct Apple Pay implementation for Safari
  const handleApplePayDirect = async () => {
    if (!stripe) return;
    
    try {
      // Set up Apple Pay session
      const session = new ApplePaySession(3, {
        countryCode: 'US',
        currencyCode: currency.toUpperCase(),
        supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
        merchantCapabilities: ['supports3DS'],
        total: { 
          label: 'Round Access', 
          amount: (amount / 100).toString()
        }
      });
      
      session.onvalidatemerchant = async (event) => {
        try {
          const response = await fetch('/api/validate-apple-merchant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              validationURL: event.validationURL
            })
          });
          
          const merchantSession = await response.json();
          session.completeMerchantValidation(merchantSession);
        } catch (err) {
          console.error("Merchant validation failed:", err);
          session.abort();
        }
      };
      
      session.onpaymentauthorized = async (event: ApplePayJS.ApplePayPaymentAuthorizedEvent) => {
        try {
          const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              challengeId, 
              amount, 
              currency,
              payment_data: event.payment.token.paymentData
            }),
          });
          
          const data = await response.json();
          if (data.error) {
            session.completePayment(ApplePaySession.STATUS_FAILURE);
            return;
          }
          
          session.completePayment(ApplePaySession.STATUS_SUCCESS);
        } catch (err) {
          console.error("Payment processing failed:", err);
          session.completePayment(ApplePaySession.STATUS_FAILURE);
        }
      };
      
      session.begin();
    } catch (err) {
      console.error("Apple Pay direct error:", err);
      setError("Could not start Apple Pay session");
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Request Button (Apple Pay / Google Pay / Link) */}
      {paymentRequest && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Quick Payment</label>
          <div className="payment-request-button-container">
            <PaymentRequestButtonElement
              options={{
                paymentRequest,
                style: {
                  paymentRequestButton: {
                    type: 'default',
                    theme: 'dark',
                    height: '48px',
                  },
                },
              }}
            />
          </div>
          <div className="mt-4 mb-2 text-center text-sm text-zinc-400">
            Or pay with card
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card Element */}
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
                    iconColor: '#ffffff',
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
          <div className="text-red-500 text-sm mt-2">{error}</div>
        )}
        
        <button
          type="submit"
          disabled={processing || !stripe}
          onClick={() => console.log('Pay button clicked', { processing, stripe: !!stripe })}
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


export default PaymentPage;