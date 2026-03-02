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
          This policy is effective as of January 1, 2024 and was last updated on March 1, 2026.
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
              <li>• Content you create (exercise videos/moves, comments, posts)</li>
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

          {/* Data Retention & Deletion */}
          <section>
            <h2 className="text-white text-2xl font-bold mb-4">
              Data Retention & Deletion
            </h2>
            <p className="text-zinc-400 text-lg mb-4">
              We retain your personal data only for as long as necessary to provide you with our services
              and as described in this Privacy Policy. When you delete your account or request data deletion,
              we will delete or anonymize your personal information within 30 days, except where we are
              required to retain certain information for legal, security, fraud-prevention, or compliance
              obligations.
            </p>
            <p className="text-zinc-400 text-lg mb-4">
              The following data is deleted when you request account deletion:
            </p>
            <ul className="text-zinc-400 text-lg space-y-3 mb-4">
              <li>• Your user profile and account information</li>
              <li>• Fitness data, workout history, and achievements</li>
              <li>• Uploaded content, including exercise videos (moves) and posts</li>
              <li>• Community interactions, comments, and messages</li>
              <li>• App preferences and settings</li>
            </ul>
            <p className="text-zinc-400 text-lg">
              Some records may be retained beyond account deletion when required by law, including
              subscription and payment records managed by third-party payment processors (e.g., Apple,
              Google, Stripe) in accordance with their own data retention policies.
            </p>
          </section>

          {/* Account Deletion */}
          <section>
            <h2 className="text-white text-2xl font-bold mb-4">
              Account Deletion
            </h2>
            <p className="text-zinc-400 text-lg mb-4">
              You have the right to delete your Pulse account and all associated data at any time.
              Account deletion can be done instantly through the app, or you can contact us for assistance.
            </p>
            <ul className="text-zinc-400 text-lg space-y-3 mb-6">
              <li>
                <strong className="text-white">1. In-App (Instant):</strong>{' '}
                Open the Pulse app and navigate to{' '}
                <span className="text-zinc-200">Settings → Delete Account</span>. Your account and all
                associated data will be deleted immediately.
              </li>
              <li>
                <strong className="text-white">2. Online:</strong>{' '}
                Visit our{' '}
                <a href="/delete-account" className="text-[#E0FE10] hover:underline font-semibold">
                  Account Deletion page
                </a>{' '}
                to submit a deletion request.
              </li>
              <li>
                <strong className="text-white">3. Email:</strong>{' '}
                Send a deletion request to{' '}
                <a href="mailto:info@fitwithpulse.ai" className="text-[#E0FE10] hover:underline">
                  info@fitwithpulse.ai
                </a>{' '}
                from the email address associated with your account.
              </li>
            </ul>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5">
              <p className="text-zinc-300 text-base">
                <strong className="text-white">What happens when you delete your account:</strong> When
                deleted through the app, your account and data are removed instantly. For requests made
                via email or our website, deletion will be processed within 30 days. Once deleted, all
                personal data is permanently removed from our systems. This action is irreversible — you
                will not be able to recover your account or any associated data.
              </p>
            </div>
            <div className="mt-6">
              <a
                href="/delete-account"
                className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Request Account Deletion
              </a>
            </div>
          </section>

          {/* Deleting Video Content (Moves) */}
          <section>
            <h2 className="text-white text-2xl font-bold mb-4">
              Deleting Video Content (Moves)
            </h2>
            <p className="text-zinc-400 text-lg mb-4">
              Pulse allows you to upload exercise videos, referred to as &quot;moves,&quot; to share workout
              demonstrations with the community. You maintain full control over the video content you upload
              and can delete it at any time.
            </p>
            <p className="text-zinc-400 text-lg mb-4">
              <strong className="text-white">To delete specific video content:</strong>
            </p>
            <ul className="text-zinc-400 text-lg space-y-3 mb-4">
              <li>
                <strong className="text-white">1. In-App (Instant):</strong>{' '}
                Open the Pulse app, navigate to your exercise library, select the move you want to remove,
                and delete it. The video and all associated data will be removed immediately.
              </li>
              <li>
                <strong className="text-white">2. Email request:</strong>{' '}
                Alternatively, send an email to{' '}
                <a href="mailto:info@fitwithpulse.ai" className="text-[#E0FE10] hover:underline">
                  info@fitwithpulse.ai
                </a>{' '}
                with the subject line &quot;Video Content Deletion Request.&quot; Include the name or
                description of the move(s) you want removed and the email address associated with your
                account. Email requests are processed within 30 days.
              </li>
              <li>
                <strong className="text-white">3. Full account deletion:</strong>{' '}
                If you delete your account (see above), all uploaded video content, including moves, will
                be permanently removed as part of the account deletion process.
              </li>
            </ul>
            <p className="text-zinc-400 text-lg">
              Once deleted, the video files and associated metadata (title, description, thumbnails) will
              be permanently removed from our servers and will no longer be accessible to other users.
            </p>
          </section>

          {/* Content Rights */}
          <section>
            <h2 className="text-white text-2xl font-bold mb-4">
              Content Rights
            </h2>
            <p className="text-zinc-400 text-lg">
              By uploading content to Pulse, you grant Pulse Intelligence Labs, Inc. a non-exclusive license
              to use that content for improving the service, research, and promotional purposes while your
              account is active. Upon account deletion or content removal request, this license terminates
              and the content will be permanently removed from our systems.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-white text-2xl font-bold mb-4">
              Contact Us
            </h2>
            <p className="text-zinc-400 text-lg">
              If you have any questions about our privacy practices, data deletion, or how to manage
              your content, please contact us at:
              <br />
              <a href="mailto:info@fitwithpulse.ai" className="text-[#E0FE10] hover:underline">
                info@fitwithpulse.ai
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

export const getServerSideProps: GetServerSideProps<PrivacyPolicyPageProps> = async (_context) => {
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