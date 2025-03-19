import React from 'react';
import SubscriptionCard from '../components/SubscriptionCard';
import FAQ from '../components/FAQ';
import { useScrollFade } from '../hooks/useScrollFade';

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
    <div className="min-h-screen bg-zinc-900">
      <div className="pt-10 pb-10"> {/* explicit padding instead of margin */}
      {/* Hero Section */}
        <section className="max-w-[1052.76px] mx-auto text-center my-10" ref={useScrollFade()}>
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Membership
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Join The Fitness Collective
          </h1>
          <p className="text-zinc-400 text-xl">
            First month on us!
          </p>
        </section>

        {/* Feature List */}
        <section className="flex flex-col space-y-6 max-w-[500px] mx-auto text-left mt-8 mb-20 px-4 sm:px-0" ref={useScrollFade()}>
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 text-xl font-medium leading-7">Unlock your potential with:</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-[22px] h-[22px] flex items-center justify-center bg-[#E0FE10] rounded-full">
              <span className="text-black">✓</span>
            </div>
            <span className="text-zinc-400 text-xl font-medium leading-7">Quick and easy access to workouts when you need them.</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-[22px] h-[22px] flex items-center justify-center bg-[#E0FE10] rounded-full">
              <span className="text-black">✓</span>
            </div>
            <span className="text-zinc-400 text-xl font-medium leading-7">Videos from community members that makes your exercises selection, endless.</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-[22px] h-[22px] flex items-center justify-center bg-[#E0FE10] rounded-full">
              <span className="text-black">✓</span>
            </div>
            <span className="text-zinc-400 text-xl font-medium leading-7">Intelligent workout tracking using AI, to create deep insight into your workouts</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-[22px] h-[22px] flex items-center justify-center bg-[#E0FE10] rounded-full">
              <span className="text-black">✓</span>
            </div>
            <span className="text-zinc-400 text-xl font-medium leading-7">You get 30 days free trial on us!</span>
          </div>
        </section>

        {/* Subscription Cards */}
        <section className="w-full bg-zinc-800 py-20" ref={useScrollFade()}>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-8 max-w-[1052.76px] mx-auto">
            <SubscriptionCard
              price="$4.99"
              period="mo"
              description="Flexible, in case you decide to go it alone after a month."
              titleColor="text-white"
              textColor="text-zinc-400"
              backgroundColor="bg-zinc-900"
              actionText="Subscribe Now"
              actionBgColor="bg-[#E0FE10]"
              actionTextColor="text-black"
              onActionClick={() => openPaymentLink('https://buy.stripe.com/9AQaFieX9bv26fSfYY')}
            />

            <SubscriptionCard
              price="$39.99"
              period="yr"
              description="Cost Effective, with commitment to your journey."
              titleColor="text-white"
              textColor="text-zinc-400"
              backgroundColor="bg-zinc-900"
              actionBgColor="bg-[#E0FE10]"
              actionText="Try now for 30 days"
              actionTextColor="text-black"
              onActionClick={() => openPaymentLink('https://buy.stripe.com/28obJm2an8iQdIk289')}
            />
          </div>
        </section>

        {/* Features Grid */}
        <section className="max-w-[1052.76px] mx-auto px-4 py-20" ref={useScrollFade()}>
          <div className="flex flex-col gap-4 sm:gap-6 mb-12">
            <div className="text-[#E0FE10] text-3xl sm:text-4xl font-normal uppercase leading-9">
              Our users are most excited about
            </div>
            <div className="text-white text-[40px] sm:text-[64px] font-bold leading-[45px] sm:leading-[79px]">
              Stand out features that Pulse has to offer
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="aspect-[9/11] bg-zinc-900 rounded-lg overflow-hidden">
                <img src="/choose-body-parts-phone.png" alt="Body Part Selection" className="w-full h-full object-cover" />
              </div>
              <div className="text-white text-[22.5px] font-bold leading-loose mt-4">Body Part Selection</div>
              <div className="text-zinc-400 text-base leading-tight">
                Select exactly which body parts you want to workout, with instant access to complementary exercises.
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="aspect-[9/11] bg-zinc-900 rounded-lg overflow-hidden">
                <img src="/discover-exercise-phone.png" alt="Exercise Discovery" className="w-full h-full object-cover" />
              </div>
              <div className="text-white text-[22.5px] font-bold leading-loose mt-4">Exercise Discovery</div>
              <div className="text-zinc-400 text-base leading-tight">
                Find your exercise, and create workouts that complement each other based off of cool exercise that you discover.
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="aspect-[9/11] bg-zinc-900 rounded-lg overflow-hidden">
                <img src="/progress-log.png" alt="Progress Logs" className="w-full h-full object-cover" />
              </div>
              <div className="text-white text-[22.5px] font-bold leading-loose mt-4">Progress Logs</div>
              <div className="text-zinc-400 text-base leading-tight">
                Logging reps, sets, and weight allows you to view your history of every workout.
              </div>
            </div>

            {/* Additional Features */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="aspect-[9/11] bg-zinc-900 rounded-lg overflow-hidden">
                <img src="/workout-log-phone.png" alt="Workout Logging" className="w-full h-full object-cover" />
              </div>
              <div className="text-white text-[22.5px] font-bold leading-loose mt-4">Workout Logging</div>
              <div className="text-zinc-400 text-base leading-tight">
                Log your sets, reps, and weight to achieve results through progressive overload.
              </div>
            </div>

            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="aspect-[9/11] bg-zinc-900 rounded-lg overflow-hidden">
                <img src="/record-exercise-phone.png" alt="Record Exercise" className="w-full h-full object-cover" />
              </div>
              <div className="text-white text-[22.5px] font-bold leading-loose mt-4">Record Your Exercise</div>
              <div className="text-zinc-400 text-base leading-tight">
                Record yourself performing each of your workouts and then edit the videos for optimal results.
              </div>
            </div>

            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="aspect-[9/11] bg-zinc-900 rounded-lg overflow-hidden">
                <img src="/exercise-vault-phone.png" alt="Exercise Vault" className="w-full h-full object-cover" />
              </div>
              <div className="text-white text-[22.5px] font-bold leading-loose mt-4">The Exercise Vault</div>
              <div className="text-zinc-400 text-base leading-tight">
                Search across our database of exercises we call "The Exercise Vault" to quickly find exercises.
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="bg-zinc-800" ref={useScrollFade()}>
          <FAQ title="Frequently Asked Questions" items={faqData} theme="dark" />
        </section>
      </div>

      {/* Call to Action */}
      <section ref={useScrollFade()} className="min-h-[50vh] bg-black flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-white text-5xl sm:text-6xl font-bold mb-6">
          Ready to start recording?
        </h2>
        <p className="text-zinc-400 text-xl max-w-2xl mb-10">
          Join the Pulse community and start building your Move library today.
        </p>
        <a 
          href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
          className="bg-[#E0FE10] text-black px-12 py-4 rounded-full text-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors"
        >
          Download iOS App Now
        </a>

        <a 
          href="https://fitwithpulse.ai"
          className="text-[#E0FE10] px-12 py-4 rounded-full text-lg font-semibold hover:text-[#E0FE10]/90 transition-colors"
        >
          Use Our Web App
        </a>
      </section>
    </div>
  );
};

export default Subscribe;