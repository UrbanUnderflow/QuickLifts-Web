import React, { FC } from 'react';

const PrivacyPolicy: FC = () => (
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12" style={{color: '#E0FE10', backgroundColor: '#192126'}}>
    <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
    <p className="mb-4">
      At QuickLifts, we respect your privacy and take the protection of personal information very seriously. This Privacy Policy outlines how we collect, use, and protect your information. It is QuickLifts' policy to comply with any applicable law and regulation regarding any personal information we may collect about you, including across our website, https://www.quicklifts.com, and other sites we own and operate.
    </p>
    <p className="mb-4">
      This policy is effective as of 10 June 2023 and was last updated on 10 June 2023.
    </p>
    <h2 className="text-2xl font-bold mb-4">Information We Collect</h2>
    <p className="mb-4">
      Information we collect includes both information you knowingly and actively provide us when using or participating in any of our services and promotions, and any information automatically sent by your devices in the course of accessing our products and services.
    </p>
    {/* Add the details of the information you collect here... */}
    
    <h2 className="text-2xl font-bold mb-4">How We Use Information</h2>
    <p className="mb-4">
      {/* Describe how you use the data here... */}
    </p>
    
    <h2 className="text-2xl font-bold mb-4">QuickLifts Rights</h2>
    <p className="mb-4">
      QuickLifts retains rights to all content uploaded to the app and can use it for improving the service, research, and promotional purposes.
    </p>
  </div>
);

export default PrivacyPolicy;
