import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // This assumes you're using react-router-dom

const CompletedOnboarding = () => {
  const location = useLocation();

  useEffect(() => {
    // Function to call the endpoint that updates the onboarding status
    const updateOnboardingStatus = async () => {
      try {
         // Extract the userId from the URL query parameters
        const queryParams = new URLSearchParams(location.search);
        const userId = queryParams.get('userId');

        // Call the function/endpoint to update the onboarding status
        // Replace `yourUpdateFunctionEndpoint` with your actual function's endpoint
        const response = await fetch(`https://your-website.com/.netlify/functions/complete-stripe-onboarding?userId=${userId}`, {
          method: 'GET', // or 'POST', depending on how your endpoint is set up
          headers: {
            'Content-Type': 'application/json',
            // Any other headers your endpoint needs
          },
          // If your endpoint expects a body, include it here
        });

        const data = await response.json();
        console.log('Onboarding status updated:', data);
      } catch (error) {
        console.error('Failed to update onboarding status:', error);
      }
    };

    updateOnboardingStatus();
  }, []);
  return (
    <div className="flex justify-center items-center h-screen bg-[#E0FE10] text-black text-center font-avenir text-2xl">
      You have completed your Stripe Onboarding! 🎉
    </div>
  );
};

export default CompletedOnboarding;