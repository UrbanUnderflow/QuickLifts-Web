import React, { useState } from 'react';
import { User as UserIcon, Download, Smartphone, ArrowRight } from 'lucide-react';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ChallengeCTA: React.FC<{ challenge: any }> = ({ challenge }) => {
  const [showInstructions, setShowInstructions] = useState(false);
  
  const steps: OnboardingStep[] = [
    {
      title: "Download Pulse",
      description: "Get the Pulse app from the App Store to join this challenge",
      icon: <Download className="w-8 h-8 text-[#E0FE10]" />
    },
    {
      title: "Create Account",
      description: "Sign up for an account to start your fitness journey",
      icon: <UserIcon className="w-8 h-8 text-[#E0FE10]" />
    },
    {
      title: "Return Here",
      description: "Come back to this page and tap 'Join Challenge' to get started",
      icon: <Smartphone className="w-8 h-8 text-[#E0FE10]" />
    }
  ];

  const appStoreUrl = 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729';
  
  // Create the base URL with properly encoded parameters for deep linking
  const baseUrl = `https://www.quickliftsapp.com/?linkType=round&roundId=${challenge.id}`;
  const encodedBaseUrl = encodeURIComponent(baseUrl);
  const deepLinkUrl = `https://quicklifts.page.link/?link=${encodedBaseUrl}&apn=com.pulse.fitnessapp&ibi=Tremaine.QuickLifts&isi=6451497729`;

  // Choose the endpoint based on the environment
  const endpoint =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:8888'
      : 'https://fitwithpulse.ai';

  // Construct the web app URL using dynamic values from challenge.
  // Assumes that challenge.ownerId is an array and uses its first element.
  const webAppUrl = `${endpoint}/round/${challenge.id}`

  const handleJoinChallenge = () => {
    setShowInstructions(true);
  };

  const handleOpenInApp = () => {
    window.location.href = deepLinkUrl;
  };

  const handleWebApp = () => {
    window.location.href = webAppUrl;
  };

  if (showInstructions) {
    return (
      <div className="fixed inset-0 bg-zinc-950 z-50 overflow-y-auto">
        <div className="min-h-screen px-4 text-center">
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="bg-zinc-900 p-6 rounded-2xl max-w-md w-full mx-auto">
              <h2 className="text-2xl font-bold text-white mb-8">
                Join {challenge.title}
              </h2>

              <div className="space-y-8">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0">{step.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {step.title}
                      </h3>
                      <p className="text-zinc-400 mt-1">{step.description}</p>
                    </div>
                    {index < steps.length - 1 && (
                      <ArrowRight className="w-5 h-5 text-zinc-600 transform rotate-90 mt-2" />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8 space-y-4">
                <a
                  href={appStoreUrl}
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-xl text-black bg-[#E0FE10] hover:bg-[#E0FE10]/90"
                >
                  Download iOS App
                </a>
                <button
                  onClick={handleOpenInApp}
                  className="w-full px-8 py-3 text-base font-medium rounded-xl text-white bg-zinc-800 hover:bg-zinc-700"
                >
                  I already have the iOS app
                </button>
                <button
                  onClick={handleWebApp}
                  className="w-full px-8 py-3 text-base font-medium rounded-xl text-white bg-zinc-800 hover:bg-zinc-700"
                >
                  I'm on a laptop or Android Device
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-800">
      <button
        onClick={handleJoinChallenge}
        className="w-full flex items-center justify-center px-8 py-4 text-lg font-medium rounded-xl text-black bg-[#E0FE10] hover:bg-[#E0FE10]/90"
      >
        Join Round
      </button>
    </div>
  );
};

export default ChallengeCTA;
