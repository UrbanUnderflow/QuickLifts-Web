import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { Activity, Copy, Sparkles } from 'lucide-react';
import SideNav from './Navigation/SideNav';
import CoachProtectedRoute from './CoachProtectedRoute';
import { useUser } from '../hooks/useUser';
import { coachService } from '../api/firebase/coach';
import { CoachModel } from '../types/Coach';

// Floating Orb Component for background ambiance
const FloatingOrb: React.FC<{
  color: string;
  size: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay?: number;
}> = ({ color, size, position, delay = 0 }) => (
  <motion.div
    className={`absolute ${size} rounded-full blur-3xl pointer-events-none`}
    style={{ backgroundColor: color, ...position }}
    animate={{
      scale: [1, 1.2, 1],
      opacity: [0.2, 0.35, 0.2],
    }}
    transition={{
      duration: 8,
      repeat: Infinity,
      delay,
      ease: "easeInOut"
    }}
  />
);

interface Props {
  children: React.ReactNode;
  requiresActiveSubscription?: boolean;
  title?: string;
  subtitle?: string;
  hideHeader?: boolean;
}

const CoachLayout: React.FC<Props> = ({ 
  children, 
  requiresActiveSubscription = true,
  title,
  subtitle,
  hideHeader = false,
}) => {
  const router = useRouter();
  const currentUser = useUser();
  const [coachProfile, setCoachProfile] = useState<CoachModel | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const canSeeEarnings = !!(coachProfile?.earningsAccess === true || coachProfile?.userType === 'partner');

  const navItems = [
    { href: '/coach/dashboard', label: 'Dashboard' },
    { href: '/coach/mental-training', label: 'Mental Training' },
    { href: '/coach/referrals', label: 'Referrals' },
    ...(canSeeEarnings ? [{ href: '/coach/revenue', label: 'Earnings' }] : []),
    { href: '/coach/staff', label: 'Staff' },
    { href: '/coach/inbox', label: 'Inbox' },
    { href: '/coach/profile', label: 'Profile' }
  ];

  useEffect(() => {
    const loadCoachProfile = async () => {
      if (!currentUser?.id) return;
      try {
        const profile = await coachService.getCoachProfile(currentUser.id);
        setCoachProfile(profile);
      } catch (error) {
        console.error('Failed to load coach profile:', error);
      }
    };
    loadCoachProfile();
  }, [currentUser?.id]);

  const handleCopyCode = async () => {
    if (!coachProfile?.referralCode) return;
    try {
      await navigator.clipboard.writeText(coachProfile.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <CoachProtectedRoute requiresActiveSubscription={requiresActiveSubscription}>
      <div className="min-h-screen bg-[#0a0a0b] text-white overflow-x-hidden">
        {/* Side Navigation */}
        <SideNav />
        
        {/* Animated Background */}
        <div className="fixed inset-0 pointer-events-none">
          <FloatingOrb color="#E0FE10" size="w-[600px] h-[600px]" position={{ top: '-20%', left: '-15%' }} />
          <FloatingOrb color="#3B82F6" size="w-[500px] h-[500px]" position={{ top: '30%', right: '-10%' }} delay={2} />
          <FloatingOrb color="#8B5CF6" size="w-[400px] h-[400px]" position={{ bottom: '-10%', left: '30%' }} delay={4} />
          
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
        </div>

        {/* Main Content Area - offset for sidebar */}
        <div className="md:ml-20 lg:ml-64 pb-20 md:pb-0">
          {/* Glassmorphic Header */}
          {!hideHeader && (
            <header className="sticky top-0 z-30 px-4 pt-4">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-7xl mx-auto"
              >
                <div className="rounded-2xl backdrop-blur-xl bg-zinc-900/40 border border-white/10 px-6 py-4">
                  {/* Top Row: Title & Referral Code */}
                  <div className="flex items-center justify-between mb-4">
                    {/* Left: Title & Subtitle */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/5 flex items-center justify-center border border-[#E0FE10]/20">
                        <Activity className="w-5 h-5 text-[#E0FE10]" />
                      </div>
                      <div>
                        <h1 className="text-lg font-bold text-white">{title || 'Coach Portal'}</h1>
                        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
                        {!subtitle && currentUser?.username && (
                          <p className="text-xs text-zinc-500">Welcome back, {currentUser.username}</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Referral Code & Actions */}
                    {coachProfile?.referralCode && (
                      <div className="flex items-center gap-4">
                        {/* Referral Code Badge */}
                        <motion.div 
                          className="flex items-center gap-2"
                          whileHover={{ scale: 1.02 }}
                        >
                          <div className="text-right hidden sm:block">
                            <div className="text-xs text-zinc-500">Referral Code</div>
                            <div className="text-lg font-bold text-[#E0FE10]">{coachProfile.referralCode}</div>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleCopyCode}
                            className="p-2 rounded-lg bg-[#E0FE10]/10 border border-[#E0FE10]/20 text-[#E0FE10] hover:bg-[#E0FE10]/20 transition-colors"
                            title={`Copy: ${coachProfile.referralCode}`}
                          >
                            {copiedCode ? <Sparkles className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </motion.button>
                        </motion.div>
                      </div>
                    )}
                  </div>
                  
                  {/* Navigation Tabs */}
                  <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-2 px-2">
                    {navItems.map((item, index) => {
                      const isActive = router.pathname === item.href;
                      return (
                        <motion.div
                          key={item.href}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Link
                            href={item.href}
                            className={`relative block px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                              isActive 
                                ? 'text-black bg-[#E0FE10]' 
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {item.label}
                          </Link>
                        </motion.div>
                      );
                    })}
                  </nav>
                </div>
              </motion.div>
            </header>
          )}

          {/* Main Content */}
          <main className="relative z-10">
            {children}
          </main>
        </div>
      </div>
    </CoachProtectedRoute>
  );
};

export default CoachLayout;
