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

// Helper function to detect iOS devices
const isIOS = () => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

// Function to open the app or App Store
const openIOSApp = (challengeId: string) => {
  // Define your app's URL scheme and App Store URL
  const appScheme = `quicklifts://round/${challengeId}`;
  const appStoreUrl = 'https://apps.apple.com/us/app/quicklifts/id6446042442';
  
  // Try to open the app first
  window.location.href = appScheme;
  
  // Set a timeout to redirect to App Store if app doesn't open
  const timeout = setTimeout(() => {
    window.location.href = appStoreUrl;
  }, 500);
  
  // Clear the timeout if the page is hidden (app opened successfully)
  window.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(timeout);
    }
  });
};

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
        ownerId?: string | string[];
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
        ownerId?: string | string[];
      };
    };
  };
}

// Main component
const PaymentPage = ({ challengeData }: PaymentPageProps) => {
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Initialize Stripe
    const initStripe = async () => {
      console.log('Initializing Stripe...');
      const key = getStripeKey();
      console.log('Got Stripe key:', key ? 'Key present' : 'No key found');
      
      // Get the global promise or create a new one
      if (!stripePromise) {
        stripePromise = loadStripe(key || '');
      }
      
      try {
        await stripePromise;
        setStripeLoaded(true);
      } catch (error) {
        console.error('Error loading Stripe:', error);
      }
    };
    
    // Check for Apple Pay availability
    const checkApplePayAvailability = () => {
      if (window.ApplePaySession && ApplePaySession.canMakePayments()) {
        setIsApplePayAvailable(true);
      }
    };
    
    // Initialize local storage test mode state
    const initTestMode = () => {
      if (isLocalhost) {
        const savedTestMode = localStorage.getItem('stripeTestMode');
        setIsTestMode(savedTestMode === 'true');
      }
    };

    // Check if user has already purchased this challenge
    const checkPurchaseStatus = async () => {
      setIsCheckingPurchase(true);
      const currentUser = userService.currentUser;
      
      if (currentUser && challengeData.collection.challenge.id) {
        try {
          // Use the userService method instead of the Netlify function
          const result = await userService.hasUserPurchasedChallenge(
            currentUser.id, 
            challengeData.collection.challenge.id
          );
          
          setHasPurchased(result.hasPurchased);
          console.log('Purchase check result:', result);
        } catch (error) {
          console.error('Error checking purchase status:', error);
        }
      }
      
      setIsCheckingPurchase(false);
    };
    
    initStripe();
    checkApplePayAvailability();
    initTestMode();
    checkPurchaseStatus();
  }, [challengeData.collection.challenge.id]);
  
  // Calculate fees and total amount
  const challenge = challengeData.collection.challenge;
  const pricingInfo = challenge.pricingInfo;
  
  // The amount from pricingInfo is already in cents, no need to convert
  const baseAmount = pricingInfo?.amount || 0;
  const processingFee = Math.round(baseAmount * 0.029 + 30); // 2.9% + 30¢
  const totalAmount = baseAmount + processingFee;
  
  const currency = pricingInfo?.currency || 'usd';
  
  const stripeElementsOptions = {
    appearance,
    locale: 'en' as const,
  };

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

  // If user has already purchased this challenge, display a message and redirect button
  if (!isCheckingPurchase && hasPurchased) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl shadow-lg overflow-hidden">
          <div className="relative bg-zinc-800 p-6 pb-12">
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="bg-[#E0FE10] p-4 rounded-full shadow-lg animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="p-6 pt-12 flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold mb-2 text-white">You Already Own This Round!</h1>
            <p className="mb-6 text-zinc-400">
              You've already purchased access to <span className="text-[#E0FE10] font-medium">{challenge.title}</span>
            </p>
            
            <div className="grid grid-cols-2 gap-4 w-full mb-6">
              <div className="bg-zinc-800 rounded-xl p-4 flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#E0FE10] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-zinc-300">Start Now</span>
              </div>
              
              <div className="bg-zinc-800 rounded-xl p-4 flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#E0FE10] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm text-zinc-300">Get Moving</span>
              </div>
            </div>
            
            <div className="w-full space-y-3">
              <button 
                onClick={() => router.push(`/round/${challenge.id}`)}
                className="w-full bg-[#E0FE10] text-black py-4 px-6 rounded-xl font-semibold hover:bg-opacity-90 transition-all transform hover:scale-[1.02] flex items-center justify-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span>Go to My Round</span>
              </button>
              
              {isIOS() && (
                <button 
                  onClick={() => openIOSApp(challenge.id)}
                  className="w-full bg-black border border-zinc-700 text-white py-4 px-6 rounded-xl font-semibold hover:bg-zinc-900 transition-all flex items-center justify-center space-x-2"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.0403 12.3792C17.0211 9.57683 19.3328 8.32309 19.4323 8.25709C18.1956 6.46676 16.2302 6.19069 15.5509 6.17543C13.8945 6.00116 12.2944 7.19116 11.4538 7.19116C10.6131 7.19116 9.29943 6.19069 7.91174 6.22123C6.13087 6.25176 4.48897 7.29563 3.58371 8.89069C1.70484 12.1335 3.10724 17.0175 4.9097 19.7895C5.81497 21.149 6.86824 22.6526 8.25593 22.5915C9.61301 22.5305 10.1264 21.7004 11.7827 21.7004C13.4389 21.7004 13.9218 22.5915 15.3401 22.5609C16.7888 22.5305 17.7 21.1796 18.5846 19.8202C19.6379 18.2557 20.0745 16.7217 20.0946 16.6606C20.0543 16.6454 17.0605 15.5863 17.0403 12.3792Z" fill="white"/>
                    <path d="M14.4349 4.25974C15.1756 3.35747 15.6787 2.14162 15.539 0.945923C14.5461 0.995789 13.3265 1.65909 12.5659 2.53601C11.8859 3.30094 11.2809 4.56522 11.4407 5.71574C12.5559 5.80228 13.674 5.16242 14.4349 4.25974Z" fill="white"/>
                  </svg>
                  <span>Open in iOS App</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // If still checking purchase status, show loading state
  if (isCheckingPurchase) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute top-0 left-0 w-full h-full border-4 border-zinc-700 rounded-full"></div>
            <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-[#E0FE10] rounded-full animate-spin"></div>
          </div>
          <p className="text-zinc-300 font-medium">Checking Payment Status...</p>
          <p className="text-zinc-500 text-sm mt-2">Just a moment while we verify your purchase</p>
        </div>
      </div>
    );
  }

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
              currency={currency}
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
                paymentId: result.paymentIntent.id,
                buyerId: userService.currentUser?.id || 'anonymous'
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
      const ownerId = challengeData.collection.challenge.ownerId || '';
      console.log('Creating payment intent for owner:', ownerId);
      
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
          ownerId
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
            buyerId: userService.currentUser?.id || 'anonymous',
            ownerId: ownerId,
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
      
      session.onpaymentauthorized = async (event) => {
        try {
          console.log('Payment authorized with Apple Pay:', event.payment);
          
          // Get the owner ID from the challenge data
          const ownerId = challengeData.collection.challenge.ownerId;
          console.log('Challenge owner ID:', ownerId);
          
          // Create the payment intent
          const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              challengeId,
              amount,
              currency,
              buyerId: userService.currentUser?.id || 'anonymous',
              buyerEmail: userService.currentUser?.email || 'unknown'
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Payment failed');
          }
          
          const data = await response.json();
          console.log('Payment intent created:', data);
          
          // Complete merchant validation
          const session_data = {
            payment_data: JSON.stringify(event.payment.token.paymentData),
            payment_method: {
              displayName: event.payment.token.paymentMethod.displayName,
              network: event.payment.token.paymentMethod.network,
              type: event.payment.token.paymentMethod.type,
            },
            client_secret: data.clientSecret,
            challengeId,
          };
          
          // Record the payment in our system after payment is processed
          try {
            // Record the payment
            console.log('Recording payment with buyer ID:', userService.currentUser?.id || 'anonymous');
            const paymentResponse = await fetch('/.netlify/functions/complete-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                challengeId,
                paymentId: data.clientSecret.split('_secret')[0],
                buyerId: userService.currentUser?.id || 'anonymous',
                ownerId: ownerId,
                amount
              }),
            });
            
            if (!paymentResponse.ok) {
              console.error('Error recording payment:', await paymentResponse.text());
            } else {
              console.log('Payment recorded successfully');
            }
          } catch (recordError) {
            console.error('Error recording payment:', recordError);
          }
          
          session.completePayment(ApplePaySession.STATUS_SUCCESS);
          
          // Redirect after payment
          setTimeout(() => {
            router.push(`/download?challengeId=${challengeId}`);
          }, 1500);
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
          {processing ? 'Processing...' : succeeded ? 'Payment Successful!' : `Pay $${(amount/100).toFixed(2)} ${currency.toUpperCase()}`}
        </button>
      </form>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const id = params?.id as string;
  
  try {
    // Fetch challenge data
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
          destination: `/round/${id}`,
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