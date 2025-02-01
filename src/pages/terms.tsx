import React from 'react';
import Head from 'next/head';
import { useScrollFade } from '../hooks/useScrollFade';

const Terms = () => {
  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>Terms and Conditions | Pulse</title>
        <meta 
          name="description" 
          content="Terms and conditions for using Pulse fitness app." 
        />
        <meta property="og:title" content="Terms and Conditions | Pulse" />
        <meta property="og:description" content="Terms and conditions for using Pulse fitness app." />
        <meta property="og:type" content="website" />
      </Head>

      {/* Hero Section */}
      <main ref={useScrollFade()} className="max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-[#E0FE10] text-5xl sm:text-6xl font-bold mb-8">
          Terms and Conditions
        </h1>
        
        <p className="text-zinc-400 text-lg mb-12">
          By using Pulse, you are agreeing to the following terms and conditions.
        </p>

        {/* Terms Sections */}
        <div className="space-y-12">
          {/* Usage Responsibilities */}
          <section>
            <h2 className="text-white text-2xl font-bold mb-4">
              Usage Responsibilities
            </h2>
            <p className="text-zinc-400 text-lg">
              You are responsible for your own account and all activity occurring under it. 
              You must use Pulse in compliance with all laws, regulations, and rules.
            </p>
          </section>

          {/* Fitness Disclaimer */}
          <section>
            <h2 className="text-white text-2xl font-bold mb-4">
              Fitness Disclaimer
            </h2>
            <p className="text-zinc-400 text-lg">
              The workouts provided by Pulse are AI generated and we are not physicians. 
              Consult with a healthcare professional before starting any new workout routine.
            </p>
          </section>

          {/* Content Rights */}
          <section>
            <h2 className="text-white text-2xl font-bold mb-4">
              Content Rights
            </h2>
            <p className="text-zinc-400 text-lg">
              Pulse Fitness Collective LLC retains rights to all content uploaded to the app 
              and can use it for improving the service, research, and promotional purposes.
            </p>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-white text-2xl font-bold mb-4">
              Intellectual Property
            </h2>
            <p className="text-zinc-400 text-lg">
              Pulse Fitness Collective LLC owns all intellectual property rights in and to 
              the service, including but not limited to text, graphics, logos, and software. 
              Users are prohibited from copying, distributing, or creating derivative works 
              without the express permission of Pulse Fitness Collective LLC.
            </p>
          </section>
        </div>

      </main>

      {/* Call to Action */}
      <section ref={useScrollFade()} className="min-h-[50vh] bg-black flex flex-col items-center justify-center text-center p-8 mt-20">
        <h2 className="text-white text-5xl sm:text-6xl font-bold mb-6">
          Ready to start your fitness journey?
        </h2>
        <p className="text-zinc-400 text-xl max-w-2xl mb-10">
          Join the Pulse community and start training today.
        </p>
        <a 
          href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
          className="bg-[#E0FE10] text-black px-12 py-4 rounded-full text-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors"
        >
          Download Now
        </a>
      </section>
    </div>
  );
};

export default Terms;