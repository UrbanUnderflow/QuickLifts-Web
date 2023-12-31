import React, { FC } from 'react';

const Terms: FC = () => (
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12" style={{color: '#E0FE10', backgroundColor: '#192126'}}>
    <h1 className="text-3xl font-bold mb-6">Terms of Use</h1>
    <p className="mb-4">By using our app you agree to all of <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" rel="noreferrer" target="_blank" style={{color: 'blue', textDecoration: 'underline'}}>Apple's Standard Terms(EULA)</a></p>
    
    <h2 className="text-2xl font-bold mb-4">Apple's Terms</h2>
    <ol className="mb-4">
      <li><strong>Acknowledgement:</strong> You and the End-User must acknowledge that the EULA is concluded between You and the End-User only, and not with Apple, and You, not Apple, are solely responsible for the Licensed Application and the content thereof. The EULA may not provide for usage rules for Licensed Applications that are in conflict with the Apple Media Services Terms and Conditions as of the Effective Date (which You acknowledge You have had the opportunity to review).</li>
      <br/>
      <li><strong>Scope of License:</strong> The license granted to the End-User for the Licensed Application must be limited to a non-transferable license to use the Licensed Application on any Apple-branded Products that the End-User owns or controls and as permitted by the Usage Rules set forth in the Apple Media Services Terms and Conditions, except that such Licensed Application may be accessed and used by other accounts associated with the purchaser via Family Sharing or volume purchasing.</li>
      <br/>
      <li><strong>Maintenance and Support:</strong> You must be solely responsible for providing any maintenance and support services with respect to the Licensed Application, as specified in the EULA, or as required under applicable law. You and the End-User must acknowledge that Apple has no obligation whatsoever to furnish any maintenance and support services with respect to the Licensed Application.</li>
      <br/>
      <li><strong>Warranty:</strong> You must be solely responsible for any product warranties, whether express or implied by law, to the extent not effectively disclaimed. The EULA must provide that, in the event of any failure of the Licensed Application to conform to any applicable warranty, the End-User may notify Apple, and Apple will refund the purchase price for the Licensed Application to that End-User; and that, to the maximum extent permitted by applicable law, Apple will have no other warranty obligation whatsoever with respect to the Licensed Application, and any other claims, losses, liabilities, damages, costs or expenses attributable to any failure to conform to any warranty will be Your sole responsibility.</li>
      <br/>
      <li><strong>Product Claims:</strong> You and the End-User must acknowledge that You, not Apple, are responsible for addressing any claims of the End-User or any third party relating to the Licensed Application or the end- user’s possession and/or use of that Licensed Application, including, but not limited to: (i) product liability claims; (ii) any claim that the Licensed Application fails to conform to any applicable legal or regulatory requirement; and (iii) claims arising under consumer protection, privacy, or similar legislation, including in connection with Your Licensed Application’s use of the HealthKit and HomeKit frameworks. The EULA may not limit Your liability to the End-User beyond what is permitted by applicable law.</li>
      <br/>
      <li><strong>Intellectual Property Rights:</strong> You and the End-User must acknowledge that, in the event of any third party claim that the Licensed Application or the End-User’s possession and use of that Licensed Application infringes that third party’s intellectual property rights, You, not Apple, will be solely responsible for the investigation, defense, settlement and discharge of any such intellectual property infringement claim.</li>
      <br/>
      <li><strong>Legal Compliance:</strong> The End-User must represent and warrant that (i) he/she is not located in a country that is subject to a U.S. Government embargo, or that has been designated by the U.S. Government as a “terrorist supporting” country; and (ii) he/she is not listed on any U.S. Government list of prohibited or restricted parties.</li>
      <br/>
      <li><strong>Developer Name and Address:</strong> You must state in the EULA Your name and address, and the contact information (telephone number; E-mail address) to which any End-User questions, complaints or claims with respect to the Licensed Application should be directed.</li>
      <br/>
      <li><strong>Third Party Terms of Agreement:</strong> You must state in the EULA that the End-User must comply with applicable third party terms of agreement when using Your Application, e.g., if You have a VoIP application, then the End-User must not be in violation of their wireless data service agreement when using Your Application.</li>
      <br/>
      <li><strong>Third Party Beneficiary:</strong> You and the End-User must acknowledge and agree that Apple, and Apple’s subsidiaries, are third party beneficiaries of the EULA, and that, upon the End-User’s acceptance of the terms and conditions of the EULA, Apple will have the right (and will be deemed to have accepted the right) to enforce the EULA against the End-User as a third party beneficiary thereof.</li>
    </ol>
    
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

  </div>
);

export default Terms;
