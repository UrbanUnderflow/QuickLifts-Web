import React from "react";
import Head from "next/head";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Layers3 } from "lucide-react";
import AdminRouteGuard from "../../components/auth/AdminRouteGuard";

const PulseCheckDesignSystemPage: React.FC = () => {
  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-[#05070c] text-white">
        <Head>
          <title>PulseCheck Design System | Pulse Admin</title>
        </Head>

        <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
          <header className="rounded-[28px] border border-zinc-800 bg-[#090f1c] p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  System Overview Artifact
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/25 bg-orange-500/10 text-orange-200">
                    <Layers3 className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold md:text-3xl">
                      PulseCheck Design System
                    </h1>
                    <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                      Dedicated reference page for the full Pulse Check visual
                      language, motion system, copy rules, and screen specs.
                      This stays separate from the core handbook so its own
                      navigation and artifacts can breathe.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/admin/systemOverview#system-design-language"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-black/20 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to System Overview
                </Link>
                <a
                  href="/pulsecheck-design-system.html"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-2.5 text-sm font-medium text-orange-100 transition-colors hover:border-orange-300/50 hover:bg-orange-500/15 hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Raw Artifact
                </a>
              </div>
            </div>
          </header>

          <section className="min-h-0 flex-1 overflow-hidden rounded-[32px] border border-zinc-800 bg-[#070711] shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
            <iframe
              src="/pulsecheck-design-system.html"
              title="PulseCheck Design System"
              className="h-[calc(100vh-210px)] min-h-[960px] w-full border-0 bg-[#070711]"
            />
          </section>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckDesignSystemPage;
