import { GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { loadStripe, PaymentRequest } from '@stripe/stripe-js';
import { Elements, CardElement, PaymentRequestButtonElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe - replace with your publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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

// For Apple Pay button styling
const ApplePayButtonStyle = () => (
  <style jsx global>{`
    .apple-pay-button {
      display: inline-block;
      -webkit-appearance: -apple-pay-button;
      -apple-pay-button-type: buy;
      -apple-pay-button-style: black;
      width: 100%;
      height: 48px;
      margin-bottom: 16px;
    }
  `}</style>
);

interface CheckoutFormProps {
  challengeId: string;
  amount: number;
  currency: string;
  isApplePayAvailable: boolean;
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
      };
    };
  };
}

// Main component
const PaymentPage = ({ challengeData }: PaymentPageProps) => {
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);

  useEffect(() => {
    // Check if Apple Pay is available on supported browsers
    if (typeof window !== 'undefined') {
      if (window.ApplePaySession && ApplePaySession.canMakePayments()) {
        setIsApplePayAvailable(true);
        console.log("Apple Pay is supported on this device");
      } else {
        console.log("Apple Pay is NOT supported on this device");
      }
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

  // Options for the Stripe Elements
  const stripeElementsOptions = {
    appearance,
    paymentRequest: {
      country: 'US',
      currency: pricingInfo.currency.toLowerCase(),
      total: {
        label: challenge.title || 'Round Access',
        amount: amount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    },
  };

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
        
        <Elements stripe={stripePromise} options={stripeElementsOptions}>
          <CheckoutForm 
            challengeId={challenge.id} 
            amount={amount} 
            currency={pricingInfo.currency.toLowerCase()} 
            isApplePayAvailable={isApplePayAvailable}
          />
        </Elements>
        
        <div className="mt-6 space-y-4">
          <p className="text-zinc-400 text-sm text-center">
            Your payment is secure and processed by Stripe.
          </p>
          
          <div className="flex items-center justify-center space-x-4">
            <img src="/visa.svg" alt="Visa" className="h-6" />
            <img src="/mastercard.svg" alt="Mastercard" className="h-6" />
            <img src="/amex.svg" alt="American Express" className="h-6" />
            {isApplePayAvailable && (
              <img src="/apple-pay.svg" alt="Apple Pay" className="h-6" />
            )}
            <img src="/google-pay.svg" alt="Google Pay" className="h-6" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Checkout form component
const CheckoutForm = ({ challengeId, amount, currency, isApplePayAvailable }: CheckoutFormProps) => {
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
        currency: currency,
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
      return;
    }
    
    setProcessing(true);
    
    try {
      // Create payment intent on server
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      
      // Confirm with card
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError('Card element not found');
        setProcessing(false);
        return;
      }
      
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: cardElement,
        }
      });
      
      if (result.error) {
        setError(result.error.message ?? 'Payment failed');
        setProcessing(false);
      } else {
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
      {/* Payment Request Button (Apple Pay / Google Pay) */}
      {paymentRequest && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Quick Payment</label>
          
          <div className="payment-request-button-container">
            <PaymentRequestButtonElement
              options={{
                paymentRequest,
                style: {
                  paymentRequestButton: {
                    type: 'default', // 'default', 'donate', 'buy'
                    theme: 'dark', // 'dark', 'light', 'outline'
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
      
      {/* Fallback Apple Pay Button for Safari */}
      {isApplePayAvailable && !paymentMethodsAvailable.applePay && !paymentRequest && (
        <>
          <ApplePayButtonStyle />
          <button 
            className="apple-pay-button"
            onClick={handleApplePayDirect}
          />
          <div className="mt-4 mb-2 text-center text-sm text-zinc-400">
            Or pay with card
          </div>
        </>
      )}

      {/* Card Element */}
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
        className={`
          w-full py-4 rounded-xl font-semibold text-lg
          ${processing || succeeded ? 'bg-[#E0FE10]/50' : 'bg-[#E0FE10]'} 
          text-black transition-all
        `}
      >
        {processing ? 'Processing...' : succeeded ? 'Payment Successful!' : `Pay ${(amount/100).toFixed(2)} ${currency.toUpperCase()}`}
      </button>
    </form>
    
    {/* Debug Payment Methods */}
    {process.env.NODE_ENV === 'development' && (
      <div className="mt-6 p-4 bg-zinc-900 rounded-lg text-xs">
        <h3 className="text-sm mb-2">Payment Methods Available (Debug):</h3>
        <ul>
          <li>Apple Pay: {paymentMethodsAvailable.applePay ? 'Yes' : 'No'}</li>
          <li>Google Pay: {paymentMethodsAvailable.googlePay ? 'Yes' : 'No'}</li>
          <li>Browser Payment API: {paymentMethodsAvailable.browserPaymentMethods ? 'Yes' : 'No'}</li>
        </ul>
      </div>
    )}
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