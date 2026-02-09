import React from 'react';
import Head from 'next/head';

const supportEmail = 'info@fitwithpulse.ai';
const deleteAccountSubject = encodeURIComponent('Delete Account Request');
const deleteAccountBody = encodeURIComponent(
  [
    'Hi Pulse Support,',
    '',
    'I want to delete my Pulse account and associated data.',
    '',
    'Account email:',
    'Username (if known):',
    '',
    'Thanks,',
  ].join('\n')
);

const DeleteAccountPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <Head>
        <title>Delete Account | Pulse</title>
        <meta
          name="description"
          content="Request deletion of your Pulse account and associated data."
        />
        <meta property="og:title" content="Delete Account | Pulse" />
        <meta
          property="og:description"
          content="Use this page to request deletion of your Pulse account and associated data."
        />
      </Head>

      <main className="max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-[#E0FE10] text-5xl sm:text-6xl font-bold mb-8">
          Delete Account
        </h1>

        <p className="text-zinc-300 text-lg mb-8">
          If you want to delete your Pulse account and associated data, submit a request to our
          support team.
        </p>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">How to request deletion</h2>
          <ol className="list-decimal list-inside space-y-3 text-zinc-300">
            <li>Send your request from the email address connected to your Pulse account.</li>
            <li>Include your username (if available) so we can identify the account quickly.</li>
            <li>Our team will confirm receipt and process the request.</li>
          </ol>

          <a
            href={`mailto:${supportEmail}?subject=${deleteAccountSubject}&body=${deleteAccountBody}`}
            className="inline-block mt-6 bg-[#E0FE10] text-black font-semibold px-6 py-3 rounded-lg hover:bg-lime-400 transition-colors"
          >
            Email Support to Delete Account
          </a>

          <p className="text-zinc-400 text-sm mt-4">
            Support email: <a href={`mailto:${supportEmail}`} className="text-[#E0FE10] hover:underline">{supportEmail}</a>
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-semibold mb-4">Data handling details</h2>
          <ul className="list-disc list-inside space-y-3 text-zinc-300">
            <li>We delete or anonymize account data associated with your user profile after validation.</li>
            <li>Some records may be retained when required for legal, security, fraud-prevention, or compliance obligations.</li>
            <li>Subscription and payment records may be retained by payment processors as required by law and provider policy.</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default DeleteAccountPage;
