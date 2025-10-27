import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../hooks/useUser';
import { auth, db } from '../api/firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { FaBars, FaTimes } from 'react-icons/fa';

const CoachTopNav: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [referralCode, setReferralCode] = useState<string>('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (!currentUser?.id) return;
        const snap = await getDoc(doc(db, 'coaches', currentUser.id));
        if (snap.exists()) {
          const data: any = snap.data();
          setReferralCode(data?.referralCode || '');
        }
      } catch (_) {}
    };
    load();
  }, [currentUser?.id]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (_) {}
  };

  const items = [
    { href: '/coach/dashboard', label: 'Dashboard' },
    { href: '/coach/referrals', label: 'Referrals' },
    { href: '/coach/revenue', label: 'Earnings' },
    { href: '/coach/staff', label: 'Staff' },
    { href: '/coach/inbox', label: 'Inbox' },
    { href: '/coach/profile', label: 'Profile' }
  ];

  return (
    <div className="w-full border-b border-zinc-800 bg-black/80 sticky top-0 z-40">
      <div className="container mx-auto px-6 py-4 flex items-center">
        <nav className="hidden md:flex items-center gap-2 ml-auto">
          {items.map((item) => {
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-4 hidden md:block text-right">
          <div className="text-xs text-zinc-400">Referral Code</div>
          <div className="text-lg font-bold text-[#E0FE10]">{referralCode || '—'}</div>
        </div>

        <button
          onClick={handleSignOut}
          className="ml-4 hidden md:inline-flex bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors"
        >
          Sign Out
        </button>

        <button
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="ml-2 md:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
        >
          <FaBars />
        </button>
      </div>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 shadow-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="text-lg font-semibold text-white">Menu</div>
              <button
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
              >
                <FaTimes />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const isActive = router.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-auto pt-6 border-t border-zinc-800">
              <div className="text-xs text-zinc-400 mb-2">Referral Code</div>
              <div className="text-lg font-bold text-[#E0FE10] mb-4">{referralCode || '—'}</div>
              <button
                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachTopNav;


