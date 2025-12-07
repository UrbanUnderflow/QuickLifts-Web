import React from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useUser } from '../hooks/useUser';

interface SettingRowProps {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  destructive?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({ title, subtitle, onClick, destructive }) => {
  const isButton = !!onClick;

  const content = (
    <div
      className="w-full flex items-center justify-between px-4 py-4 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:bg-zinc-800/80 transition-colors"
    >
      <div className="flex flex-col gap-1 text-left">
        <span className={`text-sm font-semibold ${destructive ? 'text-red-400' : 'text-white'}`}>
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-zinc-400">
            {subtitle}
          </span>
        )}
      </div>
      {isButton && (
        <span className={`text-zinc-500 text-xs ml-3 ${destructive ? 'text-red-400' : ''}`}>
          &gt;
        </span>
      )}
    </div>
  );

  if (!isButton) {
    return <div className="w-full">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left focus:outline-none"
    >
      {content}
    </button>
  );
};

const SettingsPage: NextPage = () => {
  const router = useRouter();
  const user = useUser();

  const username = user?.username ?? '';
  const email = user?.email ?? 'No email available';
  const subscriptionLabel =
    user?.subscriptionType ? user.subscriptionType.toString().charAt(0).toUpperCase() + user.subscriptionType.toString().slice(1) : 'Trial';

  const supportEmail = 'quickliftsapp@gmail.com';

  const handleSubscription = () => {
    router.push('/subscribe');
  };

  const handleTrainerBadge = () => {
    router.push('/partner/apply');
  };

  const handleTutorial = () => {
    // For now, route to Programming tutorial page; can be replaced with a dedicated tutorial modal later.
    router.push('/programming?web=1');
  };

  const handleHelpSupport = () => {
    window.location.href = `mailto:${supportEmail}?subject=Support%20from%20${encodeURIComponent(username || 'Pulse%20user')}`;
  };

  const handleLogout = async () => {
    try {
      const { signOut } = await import('../api/firebase/auth/methods');
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const handleDeleteAccount = () => {
    window.location.href = `mailto:${supportEmail}?subject=Delete%20Account%20Request%20-%20${encodeURIComponent(username || 'Pulse%20user')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-white">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-xs text-zinc-500 mt-1">v. 4.2</p>
        </div>

        <div className="space-y-4">
          {/* Subscription Plan */}
          <SettingRow
            title="Subscription Plan"
            subtitle={`Current Plan: ${subscriptionLabel}`}
            onClick={handleSubscription}
          />

          {/* Account Email */}
          <SettingRow
            title="Account Email"
            subtitle={email}
          />

          {/* Request Personal Trainer Badge */}
          <SettingRow
            title="Request Personal Trainer Badge"
            subtitle=""
            onClick={handleTrainerBadge}
          />

          {/* Show Tutorial Modal */}
          <SettingRow
            title="Show Tutorial Modal"
            subtitle="Learn about the fundamental building blocks of Pulse"
            onClick={handleTutorial}
          />

          {/* Privacy Policy */}
          <SettingRow
            title="Privacy Policy"
            onClick={() => router.push('/privacyPolicy')}
          />

          {/* Terms and Conditions */}
          <SettingRow
            title="Terms and Conditions"
            onClick={() => router.push('/terms')}
          />

          {/* Help & Support */}
          <SettingRow
            title="Help & Support"
            subtitle="Send a message to our support team"
            onClick={handleHelpSupport}
          />

          {/* About */}
          <SettingRow
            title="About"
            subtitle="Learn more about Pulse"
            onClick={() => router.push('/about')}
          />

          {/* Sources & Citations */}
          <SettingRow
            title="Sources & Citations"
            subtitle="View nutrition information sources"
            onClick={() => router.push('/privacyPolicy')}
          />

          {/* Delete Account */}
          <SettingRow
            title="Delete Account"
            subtitle="We hate to see you go!"
            onClick={handleDeleteAccount}
            destructive
          />

          {/* Log out */}
          <SettingRow
            title="Log out"
            onClick={handleLogout}
            destructive
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;





