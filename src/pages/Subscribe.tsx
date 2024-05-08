import React from 'react';
import SubscriptionCard from '../components/SubscriptionCard';
import FAQ from '../components/FAQ';


const Subscribe: React.FC = () => {
  const openPaymentLink = (url: string) => {
    window.open(url, '_blank');
  };

  const faqData = [
      {
        question: "What makes Pulse different from other fitness apps?",
        answer: "Pulse offers a unique experience by combining a vast library of workouts and exercises created by our diverse community of content creators with personalized AI-driven recommendations. You'll discover fresh, engaging content tailored to your fitness goals and preferences."
      },
      {
        question: "Can I track my workouts and progress on Pulse?",
        answer: "Absolutely! Pulse provides a comprehensive workout tracking system that allows you to log your sets, reps, and weights. You can also upload progress photos and videos to visually track your fitness journey over time."
      },
      {
        question: "How does Pulse help me discover new workouts and exercises?",
        answer: "Pulse uses advanced AI algorithms to analyze your workout history, preferences, and goals to recommend personalized workouts and exercises. You'll also have access to a vast library of content created by our expert content creators, ensuring you always have fresh and exciting workouts to try."
      },
      {
        question: "Can I follow specific content creators or trainers on Pulse?",
        answer: "Yes! Pulse allows you to follow your favorite content creators and trainers, making it easy to access their latest workouts and content. You can also interact with them and the wider Pulse community through comments, likes, and shares."
      },
      {
        question: "Does Pulse provide guidance on proper form and technique?",
        answer: "Yes, Pulse content creators prioritize demonstrating proper form and technique in their workout videos. Additionally, our AI-powered form tracking feature provides real-time feedback on your form during workouts, helping you stay safe and get the most out of your exercises."
      },
      {
        question: "Can I create custom workouts or save my favorite exercises on Pulse?",
        answer: "Yes, Pulse allows you to create custom workouts by combining your favorite exercises or following pre-designed workouts from our content creators. You can also save individual exercises to your library for quick access during your workouts."
      },
      {
        question: "Is there a community aspect to Pulse where I can connect with other fitness enthusiasts?",
        answer: "Yes, Pulse has a thriving community of fitness enthusiasts. You can connect with other users through comments, likes, and shares on workout posts. We also have community challenges and events to help you stay motivated and engaged with like-minded individuals."
      },
      {
        question: "What does a subscription to Pulse include?",
        answer: "A Pulse subscription gives you unlimited access to our vast library of workouts and exercises, personalized AI recommendations, workout tracking tools, progress tracking features, and community support. You'll also receive regular updates with new content and features to enhance your fitness journey."
      }
    ];

  return (
    <div className="">
      <div className="mb-48 bg-white">
        {/* Title Section */}
        <div className="max-w-[1052.76px] mx-auto text-center my-10 mt-20">
        {/* Title Section */}
        <span className="text-black text-[56px] sm:text-[93.93px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide">Become a member of </span>
        <span className="text-orange-500 text-[56px] sm:text-[93.93px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide">The Fitness Collective</span>
        <br />
        <span className="text-black text-[30px] sm:text-[40px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide">The first month is on us!</span>
      </div>

      {/* Feature List */}
      <div className="flex flex-col space-y-6 max-w-[500px] mx-auto text-left mt-8 mb-40">
        <div className="flex items-center gap-4">
          <span className="text-black text-xl font-medium font-['HK Grotesk'] leading-7">Unlock your potential with:</span>
        </div>
        <div className="flex items-center gap-4">
          <img src="/orange-check.png" alt="Check" className="w-[22px] h-[22px] object-cover" />
          <span className="text-black text-xl font-medium font-['HK Grotesk'] leading-7">Quick and easy access to workouts when you need them.</span>
        </div>

        <div className="flex items-center gap-4">
          <img src="/orange-check.png" alt="Check" className="w-[22px] h-[22px] object-cover" />
          <span className="text-black text-xl font-medium font-['HK Grotesk'] leading-7">Videos from community members that makes your exercies selection, endless.</span>
        </div>

        <div className="flex items-center gap-4">
          <img src="/orange-check.png" alt="Check" className="w-[22px] h-[22px] object-cover" />
          <span className="text-black text-xl font-medium font-['HK Grotesk'] leading-7">Intelligent workout tracking using AI, to create deep insight into your workouts</span>
        </div>

        <div className="flex items-center gap-4">
          <img src="/orange-check.png" alt="Check" className="w-[22px] h-[22px] object-cover" />
          <span className="text-black text-xl font-medium font-['HK Grotesk'] leading-7">You get 30 days free trial on us!</span>
        </div>
      </div>

          
        {/* Subscription Cards */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-gray-100 p-20 sm:p-16 mb-64">
            {/* Subscription Cards */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-8">
              <SubscriptionCard
                price="$4.99"
                period="mo"
                description="Flexible, in case you decide to go it alone after a month."
                titleColor="text-black"
                textColor="text-black"
                backgroundColor="bg-white"
                actionText="Subscribe Now"
                actionBgColor="bg-neutral-800"
                actionTextColor="text-white"
                onActionClick={() => openPaymentLink('https://buy.stripe.com/9AQaFieX9bv26fSfYY')}
              />

              <SubscriptionCard
                price="$39.99"
                period="yr"
                description="Cost Effective, with commitment to your journey."
                titleColor="text-white"
                textColor="text-white"
                backgroundColor="bg-neutral-800"
                actionBgColor="bg-[#E0FE10]"
                actionText="Try now for 30 days"
                actionTextColor="text-zinc-800"
                onActionClick={() => openPaymentLink('https://buy.stripe.com/28obJm2an8iQdIk289')}
              />
            </div>
          </div>
        </div>


        {/* App Features Section */}
        <div className="flex flex-col gap-8 items-center justify-center mb-64">
          {/* Container for Title and Grid */}
          <div className="w-full max-w-[1052.76px] flex flex-col gap-8">
            {/* Section Title */}
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="text-zinc-600 text-3xl sm:text-4xl font-normal font-['Thunder'] uppercase leading-9">Our users are most excited about</div>
              <div className="w-full max-w-[791.1px] text-black text-[40px] sm:text-[64px] font-medium font-['Thunder'] leading-[45px] sm:leading-[79px]">Here are some of the stand out features that Pulse has to offer</div>
            </div>

            {/* Grid for App Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              {/* First Feature */}
              <div className="flex flex-col gap-2">
                <div className="w-5 h-5"></div>
                {/* Feature Image Placeholder */}
                <div className="w-[305px] h-[373.87px] bg-gray-50">
                  <img src="/choose-body-parts-phone.png" alt="Feature 1" />
                </div>
                <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">Body Part Selection</div>
                <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">You can select exactly which body parts you want to workout, and you will instantly be delivered a list of complinetary exercises for your workout.</div>
              </div>

              {/* Second Feature */}
              <div className="flex flex-col gap-2">
                <div className="w-5 h-5"></div>
                {/* Feature Image Placeholder */}
                <div className="w-[305px] h-[373.87px] bg-gray-50">
                  <img src="/discover-exercise-phone.png" alt="Feature 2" />
                </div>
                <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">Exercise Discovery</div>
                <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Find your exercise, and create workouts that compliment each other based off of coole exercise that you discover. In our vast database of community driven exercises, the selection is endless.</div>
              </div>

              {/* Third Feature */}
              <div className="flex flex-col gap-2">
                <div className="w-5 h-5"></div>
                {/* Feature Image Placeholder */}
                <div className="w-[305px] h-[373.87px] bg-gray-50">
                  <img src="/progress-log.png" alt="Feature 3" />
                </div>
                <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">Progress Logs</div>
                <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Logging reps, sets, and weight allows you to view your history of every workout, so you never have to guess your weights again.</div>
              </div>
            </div>

             {/* Grid for App Features */}
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              {/* First Feature */}
              <div className="flex flex-col gap-2">
                <div className="w-5 h-5"></div>
                {/* Feature Image Placeholder */}
                <div className="w-[305px] h-[373.87px] bg-gray-50">
                  <img src="/workout-log-phone.png" alt="workout log" />
                </div>
                <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">Workout Logging</div>
                <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Log your sets, reps, and weight to achieve results through progressive overload. Use your workout score to help you push further each workout.</div>
              </div>

              {/* Second Feature */}
              <div className="flex flex-col gap-2">
                <div className="w-5 h-5"></div>
                {/* Feature Image Placeholder */}
                <div className="w-[305px] h-[373.87px] bg-gray-50">
                  <img src="/record-exercise-phone.png" alt="record exercise" />
                </div>
                <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">Record Your Exercise</div>
                <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Whether it's to track your progress, or inspire others, you can record yourself performing each of your workouts and and then edit the videos for optimal results.</div>
              </div>

              {/* Third Feature */}
              <div className="flex flex-col gap-2">
                <div className="w-5 h-5"></div>
                {/* Feature Image Placeholder */}
                <div className="w-[305px] h-[373.87px] bg-gray-50">
                  <img src="/exercise-vault-phone.png" alt="exercise vault" />
                </div>
                <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">The Exercise Vault</div>
                <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Search accross our database of exercises we call "The Exercise Vault" in order to quickly find the exercises you are looing for.</div>
              </div>
            </div>

            <div>
              <FAQ title="Frequently Asked Questions" items={faqData} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Subscribe;
