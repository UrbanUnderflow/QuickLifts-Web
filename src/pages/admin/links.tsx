import React from 'react';
import Head from 'next/head';

type LinkItem = { name: string; url: string };
type Section = { title: string; items: LinkItem[] };

const sections: Section[] = [
  {
    title: 'Core URLs',
    items: [
      { name: 'Main Site (Prod)', url: 'https://fitwithpulse.ai' },
      { name: 'Admin (Prod)', url: 'https://fitwithpulse.ai/admin' },
      { name: 'Local Dev', url: 'http://localhost:8888' }
    ]
  },
  {
    title: 'Coach & Training',
    items: [
      { name: 'Coach Landing', url: '/coach' },
      { name: 'Coach Sign Up', url: '/coach/sign-up' },
      { name: 'Coach Dashboard', url: '/coach/dashboard' },
      { name: 'Coach Dashboard Demo', url: '/coach/dashboard/demo' },
      { name: 'Coach Invite (referralCode)', url: '/coach-invite/ABC123' },
      { name: 'Coach Onboarding', url: '/coach-onboard' }
    ]
  },
  {
    title: 'Programming',
    items: [
      { name: 'Programming Invite', url: '/programming-invite' },
      { name: 'Programming Main', url: '/programming' }
    ]
  },
  {
    title: 'Winner Prize System',
    items: [
      { name: 'Winner Connect Account', url: '/winner/connect-account?challengeId={id}&placement={placement}' },
      { name: 'Winner Dashboard', url: '/winner/dashboard?complete=true' }
    ]
  },
  {
    title: 'Subscription & Payments',
    items: [
      { name: 'Subscribe', url: '/subscribe' },
      { name: 'Subscription Success', url: '/subscription-success?session_id={id}' },
      { name: 'Payment Page (roundId)', url: '/payment/{id}' }
    ]
  },
  {
    title: 'Challenges',
    items: [
      { name: 'Round Invitation (roundId)', url: '/round-invitation/{roundId}' },
      { name: 'Round Detail (roundId)', url: '/round/{roundId}' },
      { name: 'Round Wrapup (roundId)', url: '/round/{roundId}/wrapup' }
    ]
  },
  {
    title: 'Admin',
    items: [
      { name: 'Admin Home', url: '/admin' },
      { name: 'Coach Invite Links', url: '/admin/coachInvites' },
      { name: 'Manage Meta', url: '/admin/manageMeta' },
      { name: 'Subscriptions', url: '/admin/subscriptions' },
      { name: 'Programming Access', url: '/admin/programmingAccess' },
      { name: 'Project Management', url: '/admin/projectManagement' },
      { name: 'Challenge Status', url: '/admin/challengestatus' },
      { name: 'User Challenge Management', url: '/admin/inactivityCheck' },
      { name: 'Users', url: '/admin/users' },
      { name: 'Send Notifications', url: '/admin/SendNotification' }
    ]
  },
  {
    title: 'Static Pages',
    items: [
      { name: '100 Trainers', url: '/100trainers' },
      { name: 'About', url: '/about' },
      { name: 'Privacy Policy', url: '/privacy' },
      { name: 'Terms of Service', url: '/terms' },
      { name: 'Press Kit', url: '/press' },
      { name: 'Investor', url: '/investor' },
      { name: 'Creator', url: '/creator' },
      { name: 'Connect', url: '/connect' },
      { name: 'One-on-One Guide', url: '/one-on-one' },
      { name: 'Train Your Client', url: '/train-your-client' },
      { name: 'Corporate Partnerships', url: '/corporate-packages' }
    ]
  },
  {
    title: 'Auth & User',
    items: [
      { name: 'Sign Up', url: '/sign-up' },
      { name: 'Sign In', url: '/auth/signin?redirect={returnUrl}' },
      { name: 'Login', url: '/login?redirect={returnUrl}' },
      { name: 'User Profile (username)', url: '/profile/{username}' }
    ]
  },
  {
    title: 'Marketing & Social',
    items: [
      { name: 'Instagram', url: 'https://instagram.com/fitwithpulse' },
      { name: 'Twitter', url: 'https://twitter.com/fitwithpulse' },
      { name: 'YouTube', url: 'https://www.youtube.com/@fitwithpulse' },
      { name: 'LinkedIn', url: 'https://linkedin.com/company/pulseapp' },
      { name: 'TikTok', url: 'https://tiktok.com/@pulseapp' }
    ]
  },
  {
    title: 'App Store & Download',
    items: [
      { name: 'iOS App Store (Primary)', url: 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729' },
      { name: 'iOS App Store (Alt)', url: 'https://apps.apple.com/us/app/pulse-fitness-workout-app/id1626908941' },
      { name: 'Download Page', url: '/download' }
    ]
  }
];

const LinksDirectory: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>Admin Link Directory | Pulse</title>
      </Head>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Link Directory</h1>
          <p className="text-zinc-400 text-sm mt-1">Quick access to internal routes and external resources.</p>
        </div>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {section.items.map((item) => (
                  <div key={`${section.title}-${item.name}-${item.url}`} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-zinc-400 break-all">{item.url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={item.url} target="_blank" rel="noreferrer" className="bg-[#E0FE10] text-black px-3 py-1.5 rounded-lg text-sm hover:bg-lime-400">Open</a>
                      <button
                        onClick={async ()=>{ try { await navigator.clipboard.writeText(item.url); } catch(_){} }}
                        className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-sm hover:bg-zinc-700"
                      >Copy</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LinksDirectory;


