import React, { FC } from 'react';

const Terms: FC = () => (
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12" style={{color: '#E0FE10', backgroundColor: '#192126'}}>
    <h1 className="text-3xl font-bold mb-6">Terms and Conditions</h1>
    <p className="mb-4">
      By using QuickLifts, you are agreeing to the following terms and conditions.
    </p>
    <h2 className="text-2xl font-bold mb-4">Usage Responsibilities:</h2>
    <p className="mb-4">
      You are responsible for your own account and all activity occurring under it. You must use QuickLifts in compliance with all laws, regulations, and rules.
    </p>
    <h2 className="text-2xl font-bold mb-4">Fitness Disclaimer:</h2>
    <p className="mb-4">
      The workouts provided by QuickLifts are AI generated and we are not physicians. Consult with a healthcare professional before starting any new workout routine.
    </p>
    <h2 className="text-2xl font-bold mb-4">Content Rights:</h2>
    <p className="mb-4">
      QuickLifts retains rights to all content uploaded to the app and can use it for improving the service, research, and promotional purposes.
    </p>
    <h2 className="text-2xl font-bold mb-4">Intellectual Property:</h2>
    <p className="mb-4">
      QuickLifts owns all intellectual property rights in and to the service, including but not limited to text, graphics, logos, and software. Users are prohibited from copying, distributing, or creating derivative works without the express permission of QuickLifts.
    </p>
    {/* Add more specific terms as required... */}
  </div>
);

export default Terms;
