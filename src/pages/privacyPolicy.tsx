import React from 'react';
import type { NextPage, GetServerSideProps } from 'next';
import { useScrollFade } from '../hooks/useScrollFade';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface PrivacyPolicyPageProps {
  metaData: SerializablePageMetaData | null;
}

const PrivacyPolicy: NextPage<PrivacyPolicyPageProps> = ({ metaData }) => {
 return (
   <div className="min-h-screen bg-zinc-900">
     <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/privacyPolicy"
      />

     {/* Hero Section */}
     <main ref={useScrollFade()} className="max-w-4xl mx-auto px-4 py-20">
       <h1 className="text-[#E0FE10] text-5xl sm:text-6xl font-bold mb-8">
         Privacy Policy
       </h1>
       
       <p className="text-zinc-400 text-lg mb-12">
         At Pulse, we respect your privacy and take the protection of personal information very seriously. 
         This Privacy Policy outlines how we collect, use, and protect your information.
       </p>

       <p className="text-zinc-400 text-lg mb-12">
         This policy is effective as of January 1, 2024 and was last updated on January 1, 2024.
       </p>

       {/* Privacy Policy Sections */}
       <div className="space-y-12">
         {/* Information We Collect */}
         <section>
           <h2 className="text-white text-2xl font-bold mb-4">
             Information We Collect
           </h2>
           <p className="text-zinc-400 text-lg">
             Information we collect includes both information you knowingly and actively provide us when using 
             or participating in any of our services and promotions, and any information automatically sent 
             by your devices in the course of accessing our products and services.
           </p>
         </section>

         {/* Types of Information */}
         <section>
           <h2 className="text-white text-2xl font-bold mb-4">
             Types of Information
           </h2>
           <ul className="text-zinc-400 text-lg space-y-4">
             <li>• Account information (email, username, profile data)</li>
             <li>• Fitness data (workouts, progress, achievements)</li>
             <li>• Usage data (app interactions, preferences)</li>
             <li>• Device information (device type, operating system)</li>
             <li>• Content you create (videos, comments, posts)</li>
           </ul>
         </section>

         {/* How We Use Information */}
         <section>
           <h2 className="text-white text-2xl font-bold mb-4">
             How We Use Information
           </h2>
           <ul className="text-zinc-400 text-lg space-y-4">
             <li>• Provide and improve our services</li>
             <li>• Personalize your experience</li>
             <li>• Track fitness progress and achievements</li>
             <li>• Enable community features and interactions</li>
             <li>• Analyze app performance and usage patterns</li>
           </ul>
         </section>

         {/* Data Protection */}
         <section>
           <h2 className="text-white text-2xl font-bold mb-4">
             Data Protection
           </h2>
           <p className="text-zinc-400 text-lg">
             We implement appropriate security measures to protect your personal information. 
             Your data is stored securely and accessed only as necessary to provide our services.
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

         {/* Contact Information */}
         <section>
           <h2 className="text-white text-2xl font-bold mb-4">
             Contact Us
           </h2>
           <p className="text-zinc-400 text-lg">
             If you have any questions about our privacy practices, please contact us at:
             <br />
             <a href="mailto:pulsefitnessapp@gmail.com" className="text-[#E0FE10] hover:underline">
               pulsefitnessapp@gmail.com
             </a>
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

export const getServerSideProps: GetServerSideProps<PrivacyPolicyPageProps> = async (context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('privacyPolicy');
  } catch (error) {
    console.error("Error fetching page meta data for privacy policy page:", error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default PrivacyPolicy;