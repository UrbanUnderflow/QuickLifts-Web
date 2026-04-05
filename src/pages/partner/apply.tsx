import React from 'react';
import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import { FaArrowRight, FaBuildingUser, FaEnvelopeOpenText } from 'react-icons/fa6';
import Header, { Section } from '../../components/Header';
import Footer from '../../components/Footer/Footer';
import PageHead from '../../components/PageHead';

const PartnerApplication: NextPage = () => {
  const router = useRouter();
  const [currentSection, setCurrentSection] = React.useState<Section>('home');

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'partner-apply',
          pageTitle: 'Coach-Led Organization Setup - Pulse',
          metaDescription: 'Legacy partner applications are retired. Start from the coach-led organization setup flow.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/partner/apply"
      />

      <div className="min-h-screen bg-black text-white">
        <Header
          onSectionChange={setCurrentSection}
          currentSection={currentSection}
          toggleMobileMenu={() => {}}
          setIsSignInModalVisible={() => {}}
          theme="dark"
        />

        <main className="pt-24 pb-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[32px] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:p-12">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-amber-400/25 bg-amber-400/10 px-5 py-2.5 text-sm font-medium text-amber-100">
                Legacy partner application retired
              </div>

              <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl">
                Coach onboarding now starts through the coach-led organization flow.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
                We no longer create partner profiles or vanity referral codes from this page. New coaches should be provisioned
                as one organization, one team, and one first admin through the PulseCheck org/team model.
              </p>

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                <button
                  onClick={() => void router.push('/PulseCheck/coach')}
                  className="group rounded-3xl border border-[#E0FE10]/30 bg-gradient-to-r from-[#E0FE10] to-lime-400 p-6 text-left text-black transition-all hover:shadow-lg hover:shadow-[#E0FE10]/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-black/10 p-3">
                      <FaBuildingUser className="h-5 w-5" />
                    </div>
                    <FaArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                  <h2 className="mt-6 text-2xl font-bold">Open coach setup</h2>
                  <p className="mt-3 text-sm leading-7 text-black/75">
                    Use the canonical coach-led organization entry point for checkout, provisioning, and admin activation.
                  </p>
                </button>

                <a
                  href="mailto:pulsefitnessapp@gmail.com?subject=Coach-Led%20Organization%20Setup"
                  className="group rounded-3xl border border-zinc-700 bg-zinc-900/70 p-6 text-left transition-colors hover:border-zinc-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-zinc-800 p-3 text-zinc-100">
                      <FaEnvelopeOpenText className="h-5 w-5" />
                    </div>
                    <FaArrowRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
                  </div>
                  <h2 className="mt-6 text-2xl font-bold text-white">Talk to the team</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    Use this if you want a direct admin activation handoff, pricing review, or help configuring a team plan.
                  </p>
                </a>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default PartnerApplication;
