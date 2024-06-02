import React from 'react';

const Support: React.FC = () => {
  return (
    <div className="px-4 sm:px-8">
      <div className="mb-48 bg-white">
        {/* Title Section */}
        <div className="max-w-[1052.76px] mx-auto text-center my-10 mb-64 mt-20">
          <div>
            <span className="text-black text-[76px] sm:text-[76px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide">Get the Help You Need</span>
          </div>
          <div>
            <span className="text-black text-[46px] sm:text-[46px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide">Explore resources to use the app effectively</span>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {/* Fourth Feature */}
            <a href="https://www.youtube.com/shorts/jZ46ZxA6UJI" target="_blank" rel="noreferrer" className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <div className="w-5 h-5"></div>
                {/* Feature Image Placeholder */}
                <div className="w-[305px] h-[373.87px] bg-gray-50">
                  <img src="/creators-hub-phone.png" alt="creators hub" />
                </div>
                <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">How to create content</div>
                <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Use the creators hub to record videos, create workouts, and add exercises to the exercise vault.</div>
              </div>
            </a>

            {/* Fifth Feature */}      
            <a href="https://www.youtube.com/shorts/57TVY4CIGbI" target="_blank" rel="noreferrer" className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <div className="w-5 h-5"></div>
                {/* Feature Image Placeholder */}
                <div className="w-[305px] h-[373.87px] bg-gray-50">
                  <img src="/discover-exercise-phone.png" alt="record exercise" />
                </div>
                <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">Discover new exercises</div>
                <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Learn how to discover new exercises recorded and added to the Exercise Vault by our members of the collective.</div>
              </div>
            </a>

            {/* Sixth Feature */}
            <a href="https://www.youtube.com/shorts/2ILiNpRCg3c" target="_blank" rel="noreferrer" className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <div className="w-5 h-5"></div>
                {/* Feature Image Placeholder */}
                <div className="w-[305px] h-[373.87px] bg-gray-50">
                  <img src="/workout-log-phone.png" alt="workout log" />
                </div>
                <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">How to start a workout</div>
                <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Starting a workout is as easy as just selecting the body parts you want to workout. Learn how here.</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
