"use client";

import React from "react";

export type BrandCampaignBannerProps = {
  brandName: string;
  logoUrl?: string;
  campaignTitle: string;
  ctaLink: string;
  activeFrom?: Date | string;
  activeTo?: Date | string;
};

export function BrandCampaignBanner(props: BrandCampaignBannerProps) {
  const { brandName, logoUrl, campaignTitle, ctaLink, activeFrom, activeTo } = props;

  const activeRangeLabel = (() => {
    if (!activeFrom && !activeTo) return null;

    const format = (value: Date | string | undefined) => {
      if (!value) return "";
      const d = typeof value === "string" ? new Date(value) : value;
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    };

    const fromLabel = format(activeFrom);
    const toLabel = format(activeTo);

    if (fromLabel && toLabel) return `${fromLabel} – ${toLabel}`;
    if (fromLabel) return `From ${fromLabel}`;
    if (toLabel) return `Until ${toLabel}`;
    return null;
  })();

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-4 shadow-md sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          {logoUrl ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950/80 ring-1 ring-slate-700">
              <img
                src={logoUrl}
                alt={`${brandName} logo`}
                className="max-h-10 max-w-10 object-contain"
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950/80 text-xs font-semibold uppercase tracking-wide ring-1 ring-slate-700">
              {brandName.slice(0, 2)}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>Featured brand campaign</span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Live
              </span>
            </div>
            <h2 className="mt-1 truncate text-sm font-semibold text-slate-50 sm:text-base">
              {brandName} · {campaignTitle}
            </h2>
            {activeRangeLabel && (
              <p className="mt-0.5 text-[11px] text-slate-400">
                Campaign window: {activeRangeLabel}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-none flex-col items-stretch gap-1 sm:items-end">
          <a
            href={ctaLink}
            className="inline-flex items-center justify-center rounded-md bg-blue-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 sm:text-sm"
          >
            View challenge details
          </a>
          <p className="text-[10px] text-slate-400 sm:text-[11px]">
            Pulse turns this campaign into a shared challenge your community
            can move through together.
          </p>
        </div>
      </div>
    </section>
  );
}

export default BrandCampaignBanner;
