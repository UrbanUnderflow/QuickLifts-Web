import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const CompletedOnboarding: React.FC = () => {
  const router = useRouter();
  const { userId } = router.query; // Access query parameters from the router
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!userId) {
      console.error('UserId is missing');
      setLoading(false); // Stop loading if userId is missing
      return;
    }

    const updateOnboardingStatus = async () => {
      try {
        const response = await fetch(`https://fitwithpulse.ai/.netlify/functions/complete-stripe-onboarding?userId=${userId}`, {
          method: 'POST', // Adjust according to your endpoint method
          headers: {
            'Content-Type': 'application/json',
            // Include any other necessary headers
          },
          // If your endpoint requires a body, include it here
        });

        const data = await response.json();
        console.log('Onboarding status updated:', data);

        if (data.success) {
          setSuccess(true); // Set success state based on response
        }
        setLoading(false); // Stop loading after receiving the response
      } catch (error) {
        console.error('Failed to update onboarding status:', error);
        setLoading(false); // Stop loading in case of error
      }
    };

    updateOnboardingStatus();
  }, [userId]);

  if (!loading && !success) {
    return (
      <div className="flex justify-center items-center h-screen bg-white text-black text-center font-avenir text-2xl">
        Page Not Found or Error in Onboarding Process
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-screen bg-[#E0FE10] text-black text-center font-avenir text-2xl">
      {loading ? (
        <div>Loading...</div> // Display this while waiting for the response
      ) : (
        success && <div>You have completed your Stripe Onboarding! 🎉</div> // Display this if the onboarding update was successful
      )}
    </div>
  );
};

export default CompletedOnboarding;
