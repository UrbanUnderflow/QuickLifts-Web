import React, { useEffect, useState } from 'react';
import { useUser } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { FaCopy, FaQrcode, FaLink } from 'react-icons/fa';
import { motion } from 'framer-motion';
import CoachLayout from '../../components/CoachLayout';

// Glass Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`relative rounded-2xl backdrop-blur-md bg-zinc-900/60 border border-white/10 overflow-hidden ${className}`}>
    {/* Top reflection line */}
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E0FE10]/40 to-transparent" />
    {children}
  </div>
);

const ReferralsPage: React.FC = () => {
  const currentUser = useUser();
  const [inviteLink, setInviteLink] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [coachInviteLink, setCoachInviteLink] = useState('');
  const [connectedCoaches, setConnectedCoaches] = useState<Array<{ userId: string; username: string; email: string; connectedAt?: number }>>([]);
  const [coachConnectStatus, setCoachConnectStatus] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!currentUser?.id) return;
      try {
        const profile = await coachService.getCoachProfile(currentUser.id);
        if (!profile) return;
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
    <CoachLayout title="Coach Referrals" subtitle="Invite and track connected coaches" requiresActiveSubscription={false}>
      <div className="space-y-8">
        {/* Invite Athletes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center">
                <FaLink className="text-[#E0FE10]" />
              </div>
              <h3 className="text-lg font-semibold">Invite Athletes</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Invite Link</label>
                <div className="flex items-center gap-2">
                  <input 
                    value={inviteLink} 
                    readOnly 
                    className="flex-1 bg-zinc-800/50 text-white px-4 py-3 rounded-xl border border-zinc-700/50 focus:border-[#E0FE10]/50 focus:outline-none transition-colors" 
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => { 
                      try { 
                        await navigator.clipboard.writeText(inviteLink); 
                        setCopySuccess(true); 
                        setTimeout(() => setCopySuccess(false), 2000);
                      } catch(e) {} 
                    }}
                    className="bg-[#E0FE10] text-black px-5 py-3 rounded-xl font-medium hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all flex items-center gap-2"
                  >
                    <FaCopy className="text-sm"/>
                    <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                  </motion.button>
                </div>
                <p className="text-xs text-zinc-500 mt-2">Athletes can click this link to automatically connect to you</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-zinc-400">QR Code</label>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowQrCode(!showQrCode)} 
                    className="text-[#E0FE10] hover:text-[#E0FE10]/80 transition-colors flex items-center gap-2 text-sm font-medium"
                  >
                    <FaQrcode /> <span>{showQrCode ? 'Hide' : 'Show'} QR Code</span>
                  </motion.button>
                </div>
                {showQrCode && qrCodeUrl && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-4 rounded-xl inline-block"
                  >
                    <img src={qrCodeUrl} alt="Invite QR" className="w-48 h-48" />
                  </motion.div>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Invite Coaches */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center">
                <FaLink className="text-[#E0FE10]" />
              </div>
              <h3 className="text-lg font-semibold">Invite Coaches</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-4">Send this link to another coach. When they sign up, they'll be connected to you automatically.</p>
            <div className="flex items-center gap-3 mb-6">
              <input 
                value={coachInviteLink} 
                readOnly 
                className="flex-1 bg-zinc-800/50 text-white px-4 py-3 rounded-xl border border-zinc-700/50 focus:border-[#E0FE10]/50 focus:outline-none transition-colors" 
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => { 
                  try { 
                    await navigator.clipboard.writeText(coachInviteLink); 
                    setCoachConnectStatus('Link copied'); 
                    setTimeout(() => setCoachConnectStatus(null), 2000);
                  } catch(_) {} 
                }}
                className="bg-[#E0FE10] text-black px-5 py-3 rounded-xl font-medium hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all flex items-center gap-2"
              >
                <FaCopy className="text-sm" />
                Copy
              </motion.button>
            </div>
            {coachConnectStatus && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-[#E0FE10] mb-4"
              >
                {coachConnectStatus}
              </motion.div>
            )}
            <div>
              <div className="text-sm text-zinc-400 mb-3">Connected Coaches</div>
              {connectedCoaches.length === 0 ? (
                <div className="text-zinc-500 text-sm py-4 text-center border border-dashed border-zinc-700/50 rounded-xl">
                  No connected coaches yet
                </div>
              ) : (
                <div className="space-y-2">
                  {connectedCoaches.map((c) => (
                    <motion.div 
                      key={c.userId} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-4 py-3 hover:bg-zinc-800/60 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-white">{c.username || c.email || c.userId}</div>
                        <div className="text-xs text-zinc-500">{c.email}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </CoachLayout>
  );
};

export default ReferralsPage;
