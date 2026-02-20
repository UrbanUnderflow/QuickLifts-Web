import React from "react";

import BrandCampaignBanner from "../components/BrandCampaignBanner";
import { getActiveTierOneBrandCampaign } from "../lib/brandCampaigns";

// App home surface that can host a co-branded hero for active
// tier-1 brand campaigns.

export default async function HomePage() {
  const activeCampaign = await getActiveTierOneBrandCampaign();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      {activeCampaign && <BrandCampaignBanner {...activeCampaign} />}

      {/* Existing home content will live here. For now we render a simple */}
      {/* placeholder so this route can be wired into the app shell. */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          Pulse Home
        </h1>
        <p className="mt-1 text-sm text-slate-700">
          This is the app home surface. When a tier-1 brand campaign is
          active, you&apos;ll see a co-branded hero above this section.
        </p>
      </section>
    </main>
  );
}
