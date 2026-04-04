import React from 'react';
import { useRouter } from 'next/router';
import { FaArrowRight, FaCheckCircle, FaEnvelope, FaUser } from 'react-icons/fa';
import { useUser } from '../hooks/useUser';

interface Props {
  isOpen: boolean;
  closeModal: () => void;
}

const PartnerJoinModal: React.FC<Props> = ({ isOpen, closeModal }) => {
  const currentUser = useUser();
  const router = useRouter();

  const handleClose = () => {
    closeModal();
  };

  const handleOpenCoachFlow = async () => {
    handleClose();
    await router.push('/PulseCheck/coach');
  };

  const handleContactTeam = () => {
    handleClose();
    window.location.href = 'mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Coach-Led%20Organization%20Setup';
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="z-10 mx-4 w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Coach-Led Organization Setup</h2>
            <p className="mt-2 text-sm text-zinc-400">
              PulseCheck now provisions coaches through the org, team, and admin-activation model.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-400 transition-colors hover:text-white focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {currentUser ? (
          <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
            <div className="flex items-center gap-3">
              {currentUser.profileImage?.profileImageURL ? (
                <img
                  src={currentUser.profileImage.profileImageURL}
                  alt={currentUser.username}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700">
                  <FaUser className="h-4 w-4 text-zinc-400" />
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-white">Signed in as {currentUser.username}</div>
                <div className="text-xs text-zinc-400">{currentUser.email}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-5">
            <h3 className="text-lg font-semibold text-white">What changed</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <FaCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E0FE10]" />
                <span>Legacy coach referral codes and partner vanity codes are retired.</span>
              </li>
              <li className="flex items-start gap-3">
                <FaCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E0FE10]" />
                <span>New coaches enter as coach-led organizations with one organization, one team, and one admin activation handoff.</span>
              </li>
              <li className="flex items-start gap-3">
                <FaCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E0FE10]" />
                <span>Commercial behavior now lives on the team: team-plan bypass, athlete-pay, and optional referral kickback settings.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-5">
            <h3 className="text-lg font-semibold text-white">What to do next</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <button
                onClick={() => void handleOpenCoachFlow()}
                className="flex items-center justify-between rounded-xl bg-gradient-to-r from-[#E0FE10] to-lime-400 px-5 py-4 text-left font-semibold text-black transition-all hover:shadow-lg hover:shadow-[#E0FE10]/20"
              >
                <div>
                  <div>Open coach setup</div>
                  <div className="mt-1 text-sm font-medium text-black/70">Start from the canonical coach-led organization path.</div>
                </div>
                <FaArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={handleContactTeam}
                className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-left font-semibold text-white transition-colors hover:border-zinc-500"
              >
                <div>
                  <div>Talk to the team</div>
                  <div className="mt-1 text-sm font-medium text-zinc-400">Use this if you want a direct admin activation handoff or pricing review.</div>
                </div>
                <FaEnvelope className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerJoinModal;
