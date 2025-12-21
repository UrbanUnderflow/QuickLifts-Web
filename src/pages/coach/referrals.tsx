import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { FaCopy, FaQrcode, FaLink, FaBars, FaTimes } from 'react-icons/fa';

const ReferralsPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [inviteLink, setInviteLink] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [coachInviteLink, setCoachInviteLink] = useState('');
  const [connectedCoaches, setConnectedCoaches] = useState<Array<{ userId: string; username: string; email: string; connectedAt?: number }>>([]);
  const [coachConnectStatus, setCoachConnectStatus] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [canSeeEarnings, setCanSeeEarnings] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!currentUser?.id) return;
      try {
        const profile = await coachService.getCoachProfile(currentUser.id);
        if (!profile) return;
        setCanSeeEarnings(!!(profile.earningsAccess === true || profile.userType === 'partner'));
        const baseUrl = window.location.origin;
        
        // Simple direct link for athlete connections (browser-based flow)
        const athleteUrl = `${baseUrl}/connect/${profile.referralCode}`;
        setInviteLink(athleteUrl);
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(athleteUrl)}`);
        
        try {
          const cc = await coachService.getConnectedCoachesForCoach(profile.id);
          setConnectedCoaches(cc);
        } catch (_) {}
        
        // Build coach-to-coach invite link (rich preview)
        setCoachInviteLink(`${baseUrl}/coach-invite/${profile.referralCode}`);
      } catch (e) {
        // noop
      }
    };
    init();
  }, [currentUser?.id]);
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Coach Referrals</h1>
            <p className="text-zinc-400">Invite and track connected coaches.</p>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            {[
              { href: '/coach/dashboard', label: 'Dashboard' },
              { href: '/coach/referrals', label: 'Referrals' },
              ...(canSeeEarnings ? [{ href: '/coach/revenue', label: 'Earnings' }] : []),
              { href: '/coach/staff', label: 'Staff' },
              { href: '/coach/inbox', label: 'Inbox' },
              { href: '/coach/profile', label: 'Profile' }
            ].map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
          >
            <FaBars />
          </button>
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute top-0 right-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 shadow-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="text-lg font-semibold text-white">Menu</div>
                <button
                  aria-label="Close navigation"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { href: '/coach/dashboard', label: 'Dashboard' },
                  { href: '/coach/referrals', label: 'Referrals' },
                  ...(canSeeEarnings ? [{ href: '/coach/revenue', label: 'Earnings' }] : []),
                  { href: '/coach/staff', label: 'Staff' },
                  { href: '/coach/inbox', label: 'Inbox' },
                  { href: '/coach/profile', label: 'Profile' }
                ].map((item) => {
                  const isActive = router.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
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
                <button
                  onClick={() => { setMobileNavOpen(false); router.push('/api/auth/signout'); }}
                  className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Athletes/Coaches combined referrals */}
        <div className="space-y-8">
          {/* Invite Athletes */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <div className="flex items-center space-x-3 mb-4">
              <FaLink className="text-[#E0FE10] text-xl" />
              <h3 className="text-lg font-semibold">Invite Athletes</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Invite Link</label>
                <div className="flex items-center gap-2">
                  <input value={inviteLink} readOnly className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700" />
                  <button
                    onClick={async ()=>{ try { await navigator.clipboard.writeText(inviteLink); setCopySuccess(true); setTimeout(()=>setCopySuccess(false),2000);} catch(e){} }}
                    className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg hover:bg-lime-400 transition-colors flex items-center gap-2"
                  >
                    <FaCopy className="text-sm"/>
                    <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Athletes can click this link to automatically connect to you</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-zinc-300">QR Code</label>
                  <button onClick={()=>setShowQrCode(!showQrCode)} className="text-[#E0FE10] hover:text-lime-400 transition-colors flex items-center gap-1 text-sm">
                    <FaQrcode /> <span>{showQrCode ? 'Hide' : 'Show'} QR Code</span>
                  </button>
                </div>
                {showQrCode && qrCodeUrl && (
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img src={qrCodeUrl} alt="Invite QR" className="w-48 h-48" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invite Coaches */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <div className="flex items-center space-x-3 mb-4">
              <FaLink className="text-[#E0FE10] text-xl" />
              <h3 className="text-lg font-semibold">Invite Coaches</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-4">Send this link to another coach. When they sign up, they’ll be connected to you automatically.</p>
            <div className="flex items-center gap-3 mb-4">
              <input value={coachInviteLink} readOnly className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700" />
              <button
                onClick={async ()=>{ try { await navigator.clipboard.writeText(coachInviteLink); setCoachConnectStatus('Link copied'); setTimeout(()=>setCoachConnectStatus(null), 2000);} catch(_){} }}
                className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg hover:bg-lime-400 transition-colors flex items-center gap-2"
              >
                <FaCopy className="text-sm" />
                Copy
              </button>
            </div>
            {coachConnectStatus && <div className="text-xs text-zinc-400 mb-2">{coachConnectStatus}</div>}
            <div>
              <div className="text-sm text-zinc-300 mb-2">Connected Coaches</div>
              {connectedCoaches.length === 0 ? (
                <div className="text-zinc-500 text-sm">No connected coaches yet.</div>
              ) : (
                <div className="space-y-2">
                  {connectedCoaches.map((c)=> (
                    <div key={c.userId} className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2">
                      <div>
                        <div className="font-medium">{c.username || c.email || c.userId}</div>
                        <div className="text-xs text-zinc-500">{c.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralsPage;


