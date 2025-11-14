import React, { useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminRouteGuard from '../components/auth/AdminRouteGuard';

interface LinkItem {
  label: string;
  path: string;
  description?: string;
  external?: boolean;
}

interface LinkSection {
  title: string;
  icon: string;
  links: LinkItem[];
}

const Directory: NextPage = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const sections: LinkSection[] = [
    {
      title: 'Core Application',
      icon: '🌐',
      links: [
        { label: 'Main Site', path: '/', description: 'Home page' },
        { label: 'Admin Panel', path: '/admin', description: 'Administrative dashboard' },
        { label: 'Programming Platform', path: '/programming', description: 'Training programs' },
      ],
    },
    {
      title: 'Downloads & Apps',
      icon: '📱',
      links: [
        { label: 'Download Page', path: '/download', description: 'Get the mobile app' },
        { label: 'iOS App Store', path: 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729', external: true, description: 'Download on iOS' },
      ],
    },
    {
      title: 'User Flows',
      icon: '🎯',
      links: [
        { label: 'Programming Invite', path: '/programming-invite', description: 'Auto-grant programming access' },
        { label: 'Have You Paid', path: '/HaveYouPaid', description: 'Anderson Family Reunion tool' },
      ],
    },
    {
      title: 'Challenge System',
      icon: '🏆',
      links: [
        { label: 'Morning Mobility Challenge', path: '/morning-mobility-challenge', description: 'Challenge landing page' },
        { label: 'Mobility', path: '/mobility', description: 'Mobility challenge' },
        { label: 'Move and Fuel ATL', path: '/MoveAndFuelATL', description: 'Atlanta event' },
      ],
    },
    {
      title: 'Coach & Training',
      icon: '💪',
      links: [
        { label: 'Coach Landing Page', path: '/coach', description: 'Information for coaches' },
        { label: 'Coach Sign Up', path: '/coach/sign-up', description: 'Create coach account' },
        { label: 'Coach Dashboard', path: '/coach/dashboard', description: 'Manage athletes' },
        { label: 'Coach Earnings', path: '/coach/revenue', description: 'Revenue & payouts' },
        { label: 'Coach Onboarding', path: '/coach-onboard', description: 'Personal coach invitation' },
        { label: 'One-on-One Guide', path: '/one-on-one', description: 'Personal training guide' },
        { label: 'Train Your Client', path: '/train-your-client', description: 'Client training guide' },
      ],
    },
    {
      title: 'Winner & Earnings',
      icon: '💰',
      links: [
        { label: 'Winner Dashboard', path: '/winner/dashboard', description: 'Prize history & setup' },
        { label: 'Trainer Dashboard', path: '/trainer/dashboard', description: 'Trainer earnings' },
      ],
    },
    {
      title: 'Admin Tools',
      icon: '🔧',
      links: [
        { label: 'Beta Users', path: '/admin/betausers', description: 'Manage beta access' },
        { label: 'Programming Access', path: '/admin/programmingAccess', description: 'Grant program access' },
        { label: 'University Prospects', path: '/admin/universityProspects', description: 'University CRM' },
        { label: 'Project Management', path: '/admin/projectManagement', description: 'Manage projects' },
        { label: 'Metrics', path: '/admin/metrics', description: 'Analytics dashboard' },
        { label: 'Challenge Management', path: '/admin/challengestatus', description: 'Manage challenges' },
        { label: 'Inactivity Check', path: '/admin/inactivityCheck', description: 'User challenge activity' },
        { label: 'Add Points', path: '/admin/addpoints', description: 'Award user points' },
        { label: 'Referral Awards', path: '/admin/referralAward', description: 'Manage referrals' },
        { label: 'Press Releases', path: '/admin/pressReleases', description: 'Manage press' },
        { label: 'Send Notifications', path: '/admin/SendNotification', description: 'Push notifications' },
        { label: 'User Management', path: '/admin/users', description: 'Manage users' },
        { label: 'Subscriptions', path: '/admin/subscriptions', description: 'Subscription admin' },
        { label: 'Move Management', path: '/admin/MoveManagement', description: 'Exercise library' },
        { label: 'Meta Data Management', path: '/admin/manageMeta', description: 'SEO & metadata' },
        { label: 'Daily Reflection', path: '/admin/dailyReflection', description: 'Reflection prompts' },
        { label: 'Notification Logs', path: '/admin/NotificationLogs', description: 'Notification history' },
        { label: 'Chat Management', path: '/admin/chatManagement', description: 'Manage conversations' },
        { label: 'Workout Summaries', path: '/admin/workoutSummaries', description: 'View all workouts' },
        { label: 'Generate Meal Macros', path: '/admin/generateMealMacros', description: 'Nutrition planning' },
        { label: 'Meal Logs', path: '/admin/mealLogs', description: 'User meal tracking' },
        { label: 'VC Database', path: '/admin/vcDatabase', description: 'Investor CRM' },
        { label: 'Prize Test Setup', path: '/admin/prize-test-setup', description: 'Test prize system' },
        { label: 'Add User to Challenge', path: '/admin/addUserToChallenge', description: 'Manual challenge enrollment' },
        { label: 'Debug User Challenge', path: '/admin/debugUserChallenge', description: 'Challenge debugging' },
      ],
    },
    {
      title: 'Subscription & Payment',
      icon: '💳',
      links: [
        { label: 'Subscribe', path: '/subscribe', description: 'Subscription plans' },
        { label: 'Monthly (Live)', path: 'https://buy.stripe.com/9AQaFieX9bv26fSfYY', external: true, description: 'Stripe monthly link' },
        { label: 'Annual (Live)', path: 'https://buy.stripe.com/28obJm2an8iQdIk289', external: true, description: 'Stripe annual link' },
        { label: 'Creator Subscription', path: 'https://buy.stripe.com/6oE5kY2anbv25bO5km', external: true, description: 'Creator plan' },
      ],
    },
    {
      title: 'Legal & Info',
      icon: '📄',
      links: [
        { label: 'About', path: '/about', description: 'About Pulse' },
        { label: 'Privacy Policy', path: '/privacy', description: 'Privacy policy' },
        { label: 'Terms of Service', path: '/terms', description: 'Terms & conditions' },
        { label: 'Press Kit', path: '/press', description: 'Media resources' },
      ],
    },
    {
      title: 'Special Pages',
      icon: '✨',
      links: [
        { label: 'Investor', path: '/investor', description: 'Investor information' },
        { label: 'Creator', path: '/creator', description: 'Creator program' },
        { label: 'Get In Touch', path: '/GetInTouch', description: 'Contact form' },
        { label: 'Corporate Packages', path: '/corporate-packages', description: 'Enterprise solutions' },
        { label: 'Build Your Round', path: '/build-your-round', description: 'Create custom workout rounds' },
      ],
    },
    {
      title: 'Social Media',
      icon: '🔗',
      links: [
        { label: 'Instagram', path: 'https://instagram.com/fitwithpulse', external: true },
        { label: 'Twitter', path: 'https://twitter.com/fitwithpulse', external: true },
        { label: 'YouTube', path: 'https://www.youtube.com/@fitwithpulse', external: true },
        { label: 'LinkedIn', path: 'https://linkedin.com/company/pulseapp', external: true },
        { label: 'TikTok', path: 'https://tiktok.com/@pulseapp', external: true },
      ],
    },
  ];

  const filteredSections = sections
    .map((section) => ({
      ...section,
      links: section.links.filter(
        (link) =>
          link.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          link.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          link.path.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter((section) => section.links.length > 0);

  const handleLinkClick = (link: LinkItem) => {
    if (link.external) {
      window.open(link.path, '_blank', 'noopener,noreferrer');
    } else {
      router.push(link.path);
    }
  };

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-black text-white">
        <Head>
          <title>Site Directory - Pulse</title>
          <meta name="description" content="Complete directory of Pulse application pages and links" />
        </Head>

      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-lime-500/5 via-transparent to-purple-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(224,254,16,0.08),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-5xl sm:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-lime-200 to-lime-400 bg-clip-text text-transparent">
              Site Directory
            </h1>
            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
              Navigate every corner of the Pulse ecosystem. All links, routes, and pages in one stunning directory.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search pages, routes, or descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-900/80 backdrop-blur border border-zinc-700 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 transition-all"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {filteredSections.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-zinc-400 text-lg">No pages found matching "{searchTerm}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredSections.map((section, idx) => (
              <div
                key={idx}
                className="group relative bg-gradient-to-br from-zinc-900/50 to-zinc-900/30 backdrop-blur border border-zinc-800 rounded-2xl p-6 hover:border-lime-400/30 transition-all duration-300"
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-lime-400/0 to-purple-500/0 group-hover:from-lime-400/5 group-hover:to-purple-500/5 rounded-2xl transition-all duration-300" />
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{section.icon}</span>
                    <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                  </div>
                  
                  <div className="space-y-2">
                    {section.links.map((link, linkIdx) => (
                      <button
                        key={linkIdx}
                        onClick={() => handleLinkClick(link)}
                        className="w-full text-left group/link flex items-center justify-between bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/50 hover:border-lime-400/40 rounded-lg px-4 py-3 transition-all duration-200"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white group-hover/link:text-lime-400 transition-colors">
                              {link.label}
                            </span>
                            {link.external && (
                              <svg className="w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            )}
                          </div>
                          {link.description && (
                            <p className="text-sm text-zinc-500 mt-1 truncate">{link.description}</p>
                          )}
                          <p className="text-xs text-zinc-600 mt-1 font-mono truncate">{link.path}</p>
                        </div>
                        <svg 
                          className="w-5 h-5 text-zinc-600 group-hover/link:text-lime-400 group-hover/link:translate-x-1 transition-all flex-shrink-0 ml-3" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="border-t border-zinc-800 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-lime-400">{sections.length}</div>
              <div className="text-sm text-zinc-500">Categories</div>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div>
              <div className="text-3xl font-bold text-lime-400">
                {sections.reduce((acc, s) => acc + s.links.length, 0)}
              </div>
              <div className="text-sm text-zinc-500">Total Links</div>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div>
              <div className="text-3xl font-bold text-lime-400">{filteredSections.length}</div>
              <div className="text-sm text-zinc-500">Showing</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </AdminRouteGuard>
  );
};

export default Directory;

