import React from 'react';
import { User as UserIcon, Download, Smartphone, ArrowRight } from 'lucide-react';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ChallengeCTA: React.FC<{ challenge: any }> = ({ challenge }) => {
  const steps: OnboardingStep[] = [
    {
      title: "Download Pulse",
      description: "Get the Pulse app from the App Store to join this challenge",
      icon: <Download className="w-8 h-8 text-[#E0FE10]" />
    },
    {
      title: "Create Account",
      description: "Sign up for a free account to start your fitness journey",
      icon: <UserIcon className="w-8 h-8 text-[#E0FE10]" />
    },
    {
      title: "Open App",
      description: "Open the Pulse app and join the challenge from there",
      icon: <Smartphone className="w-8 h-8 text-[#E0FE10]" />
    }
  ];

  const appStoreUrl = 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729';

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
                  <div className="flex-shrink-0">
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="text-zinc-400 mt-1">
                      {step.description}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-zinc-600 transform rotate-90 mt-2" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8">
              <a
                href={appStoreUrl}
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-xl text-black bg-[#E0FE10] hover:bg-[#E0FE10]/90"
              >
                Download App
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeCTA;