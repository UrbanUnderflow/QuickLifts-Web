import type { NextPage } from 'next';
import React, { useState } from 'react';
import {
  FaArrowRight,
  FaBolt,
  FaBuildingUser,
  FaCircleCheck,
  FaCoins,
  FaDiagramProject,
  FaEnvelopeOpenText,
  FaHandshake,
  FaUsers,
} from 'react-icons/fa6';
import Footer from '../../components/Footer/Footer';
import PageHead from '../../components/PageHead';
import PartnerJoinModal from '../../components/PartnerJoinModal';

const PartnerPage: NextPage = () => {
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead pageOgUrl="https://fitwithpulse.ai/PulseCheck/partner" />

      <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-8 py-24 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-blue-950/20 to-zinc-900" />
        <div className="absolute inset-0">
          <div className="absolute left-16 top-16 h-80 w-80 rounded-full bg-[#E0FE10]/10 blur-3xl" />
          <div className="absolute bottom-16 right-24 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#E0FE10]/30 bg-gradient-to-r from-[#E0FE10]/20 to-blue-500/20 px-6 py-3 backdrop-blur-sm">
            <FaHandshake className="h-4 w-4 text-[#E0FE10]" />
            <span className="text-sm font-medium text-[#E0FE10]">Coach-led organization commercial model</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold text-white sm:text-6xl lg:text-7xl">
            One onboarding flow. Two clean commercial modes.
          </h1>
          <p className="mx-auto max-w-3xl text-lg text-zinc-300 sm:text-xl">
            PulseCheck now provisions coaches through the org, team, and admin-activation model. Every coach-led
            organization can run either a team plan that bypasses athlete paywalls, or an athlete-pay model with an
            optional team-level kickback.
          </p>
          <div className="mt-10 inline-flex flex-col items-center gap-4 sm:flex-row">
            <button
              onClick={() => setIsPartnerModalOpen(true)}
              className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#E0FE10] to-lime-400 px-8 py-4 text-lg font-bold text-black transition-all hover:shadow-lg hover:shadow-[#E0FE10]/20"
            >
              Start coach setup
              <FaArrowRight className="h-5 w-5" />
            </button>
            <a
              href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Coach-Led%20Organization%20Setup"
              className="inline-flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/80 px-8 py-4 text-lg font-bold text-white transition-all hover:border-zinc-500"
            >
              <FaEnvelopeOpenText className="h-5 w-5" />
              Talk to the team
            </a>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-16 sm:py-24 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950/50 to-zinc-900" />
        <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#E0FE10]/30 bg-gradient-to-r from-[#E0FE10]/20 to-lime-400/20 px-5 py-2.5">
              <FaBolt className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-sm font-medium text-[#E0FE10]">Commercial options</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-[#E0FE10]/30 bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 p-8">
              <h3 className="text-2xl font-bold text-white">Team plan</h3>
              <p className="mt-3 text-zinc-300">
                The organization or team pays centrally. When the team plan is active, invited athletes bypass the
                paywall and enter directly through their team invite.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                <li className="flex items-start gap-3">
                  <FaCircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E0FE10]" />
                  <span>Best for programs that want one bill, one admin handoff, and no athlete checkout friction.</span>
                </li>
                <li className="flex items-start gap-3">
                  <FaCircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E0FE10]" />
                  <span>Team commercial config controls billing state, invite readiness, and paywall bypass.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-8">
              <h3 className="text-2xl font-bold text-white">Athlete-pay with optional kickback</h3>
              <p className="mt-3 text-zinc-300">
                Athletes subscribe individually after joining through a team invite. Teams can enable a kickback and set
                the revenue recipient at the team level.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                <li className="flex items-start gap-3">
                  <FaCircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-300" />
                  <span>Best when athletes buy individually but the coach or team should still receive attributed revenue.</span>
                </li>
                <li className="flex items-start gap-3">
                  <FaCircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-300" />
                  <span>No separate coach referral code is required; attribution follows the invite token and team config.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-green-950/10 to-zinc-900" />
        <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
          <div className="mb-14 text-center">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#E0FE10]/30 bg-gradient-to-r from-[#E0FE10]/20 to-green-500/20 px-6 py-3 backdrop-blur-sm">
              <FaDiagramProject className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-sm font-medium text-[#E0FE10]">Provisioning flow</span>
            </div>
            <h2 className="text-4xl font-bold text-white lg:text-5xl">How coach setup works now</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
              <FaBuildingUser className="h-8 w-8 text-[#E0FE10]" />
              <h3 className="mt-5 text-xl font-semibold text-white">1. Provision the container</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Every coach is provisioned as one organization and one initial team, even if it is a single-coach business.
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
              <FaUsers className="h-8 w-8 text-blue-300" />
              <h3 className="mt-5 text-xl font-semibold text-white">2. Activate the first admin</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                PulseCheck sends or hands off an admin-activation link so the external coach becomes the real org and team admin.
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
              <FaCoins className="h-8 w-8 text-emerald-300" />
              <h3 className="mt-5 text-xl font-semibold text-white">3. Configure invites and economics</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Team invite links, team-plan bypass, and any athlete-pay kickback settings all live on the team commercial config.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <PartnerJoinModal isOpen={isPartnerModalOpen} closeModal={() => setIsPartnerModalOpen(false)} />
    </div>
  );
};

export default PartnerPage;
