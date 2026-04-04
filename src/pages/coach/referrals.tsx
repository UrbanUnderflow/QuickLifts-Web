import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FaCopy, FaExternalLinkAlt, FaLink } from 'react-icons/fa';
import CoachLayout from '../../components/CoachLayout';

const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 backdrop-blur-md ${className}`}>
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E0FE10]/40 to-transparent" />
    {children}
  </div>
);

const ReferralsPage: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState('https://fitwithpulse.ai');
  const [copyState, setCopyState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const coachLedOrgUrl = useMemo(() => `${baseUrl}/PulseCheck/coach`, [baseUrl]);

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(successMessage);
      window.setTimeout(() => setCopyState(null), 2000);
    } catch (_error) {
      setCopyState('Copy failed');
      window.setTimeout(() => setCopyState(null), 2000);
    }
  };

  return (
    <CoachLayout title="Invites" subtitle="PulseCheck now uses team invites and admin activation links" requiresActiveSubscription={false}>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-6">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E0FE10]/20 bg-[#E0FE10]/10">
                <FaLink className="text-[#E0FE10]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Canonical Flow</h3>
                <p className="text-sm text-zinc-400">Legacy coach referral links are retired.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-7 text-zinc-300">
              <p>
                Athlete access now comes from <span className="font-semibold text-white">PulseCheck team invite links</span>,
                and new coach-led organizations should start from the canonical PulseCheck coach entry point or an admin activation link.
              </p>
              <p>
                This keeps onboarding, attribution, team-plan bypass, and referral revenue attached to the same org/team model instead of the old coach referral-code flow.
              </p>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white">Coach-Led Organization Entry</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Use this public entry point for new coach-led organizations. From there, PulseCheck can provision the organization, first team, and admin activation handoff.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <input
                value={coachLedOrgUrl}
                readOnly
                className="flex-1 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-3 text-white"
              />
              <button
                onClick={() => void copyToClipboard(coachLedOrgUrl, 'Coach-led organization link copied')}
                className="flex items-center gap-2 rounded-xl bg-[#E0FE10] px-5 py-3 font-medium text-black transition-all hover:shadow-lg hover:shadow-[#E0FE10]/20"
              >
                <FaCopy className="text-sm" />
                Copy
              </button>
              <a
                href={coachLedOrgUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-zinc-700/50 px-5 py-3 text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
              >
                <FaExternalLinkAlt className="text-sm" />
                Open
              </a>
            </div>

            {copyState ? <p className="mt-3 text-xs text-[#E0FE10]">{copyState}</p> : null}
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white">How invites work now</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">Admin activation</p>
                <p className="mt-2 text-sm text-zinc-400">Creates the first controlling admin for a coach-led organization or program.</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">Team invite links</p>
                <p className="mt-2 text-sm text-zinc-400">Bring coaches, staff, clinicians, and athletes into the right org and team container.</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">Commercial rules</p>
                <p className="mt-2 text-sm text-zinc-400">Team plan bypass and referral revenue now follow the team commercial config instead of coach referral codes.</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </CoachLayout>
  );
};

export default ReferralsPage;
