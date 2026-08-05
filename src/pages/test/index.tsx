import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

type TestToolCardProps = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
};

function TestToolCard({ title, description, href, icon }: TestToolCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl bg-[#1a1e24] p-6 shadow-xl"
    >
      <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]" />
      <div className="absolute bottom-0 left-0 top-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]" />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-[#d7ff00]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative mb-4 flex items-center">
        <div className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#262a30] text-[#d7ff00] transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <p className="relative flex-grow leading-6 text-gray-400 transition-colors group-hover:text-gray-300">{description}</p>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-[#40c9ff] to-[#d7ff00] transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
}

const TestHomePage: React.FC = () => {
  return (
    <AdminRouteGuard>
      <Head>
        <title>Pulse Test Tools</title>
      </Head>

      <main className="min-h-screen bg-[#111417] px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#262a30] text-[#d7ff00]">
                <FlaskConical className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold">Test Tools</h1>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Protected tools for testing Pulse connections with synthetic data. Keep real athlete details out of every test.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <TestToolCard
              title="EDNA Integration Test"
              description="Run synthetic chat scenarios through the production escalation classifier and call each configured EDNA endpoint from one test harness."
              href="/test/edna-integration"
              icon={<FlaskConical className="h-5 w-5" />}
            />
          </div>
        </div>
      </main>
    </AdminRouteGuard>
  );
};

export default TestHomePage;
