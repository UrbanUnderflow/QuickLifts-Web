import React from 'react';
import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import PageHead from '../../components/PageHead';
import Header, { Section } from '../../components/Header';
import Footer from '../../components/Footer/Footer';
import { FaArrowRight, FaCheckCircle, FaEnvelopeOpenText } from 'react-icons/fa';

const PartnerOnboardingSuccess: NextPage = () => {
  const router = useRouter();
  const [currentSection, setCurrentSection] = React.useState<Section>('home');

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead pageOgUrl="https://fitwithpulse.ai/partner/onboarding-success" />
      <Header
        onSectionChange={setCurrentSection}
        currentSection={currentSection}
        toggleMobileMenu={() => {}}
        setIsSignInModalVisible={() => {}}
        theme="dark"
      />

      <section className="relative flex min-h-[78vh] items-center justify-center overflow-hidden px-8 py-24 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
        <div className="absolute inset-0">
          <div className="absolute left-16 top-16 h-80 w-80 rounded-full bg-[#E0FE10]/10 blur-3xl" />
          <div className="absolute bottom-16 right-24 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-[#E0FE10] to-lime-400">
            <FaCheckCircle className="h-12 w-12 text-black" />
          </div>

          <div className="mx-auto mb-6 inline-flex items-center gap-3 rounded-full border border-amber-400/25 bg-amber-400/10 px-5 py-2.5 text-sm font-medium text-amber-100">
            Legacy partner onboarding retired
          </div>

          <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            Coach setup now continues through the org, team, and admin-activation flow.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
            We no longer complete partner onboarding through the legacy coach referral path. If you need to start or finish
            a coach-led organization setup, use the canonical PulseCheck coach flow below.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => void router.push('/PulseCheck/coach')}
              className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#E0FE10] to-lime-400 px-8 py-4 text-lg font-bold text-black transition-all hover:shadow-lg hover:shadow-[#E0FE10]/20"
            >
              Open coach setup
              <FaArrowRight className="h-5 w-5" />
            </button>
            <a
              href="mailto:pulsefitnessapp@gmail.com?subject=Coach-Led%20Organization%20Setup"
              className="inline-flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/80 px-8 py-4 text-lg font-bold text-white transition-all hover:border-zinc-500"
            >
              <FaEnvelopeOpenText className="h-5 w-5" />
              Contact the team
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PartnerOnboardingSuccess;
