"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  type BrandCampaignBannerRecord,
  listBrandCampaigns,
  pickActiveTierOneBrandCampaign,
  toDate,
  type TimestampLike,
} from "../lib/brandCampaigns";

export type BrandCampaignBannerProps = {
  className?: string;
  emptyState?: React.ReactNode;
  brandName?: string;
  logoUrl?: string;
  campaignTitle?: string;
  ctaText?: string;
  ctaLink?: string;
  activeFrom?: TimestampLike;
  activeTo?: TimestampLike;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatCampaignWindow(activeFrom: Date | null, activeTo: Date | null): string | null {
  if (!activeFrom && !activeTo) return null;

  const format = (value: Date | null) => {
    if (!value) return "";
    return value.toLocaleDateString(undefined, {
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
}

export function BrandCampaignBanner({
  className = "",
  emptyState = null,
  brandName,
  logoUrl,
  campaignTitle,
  ctaText,
  ctaLink,
  activeFrom,
  activeTo,
}: BrandCampaignBannerProps) {
  const providedCampaign = useMemo<BrandCampaignBannerRecord | null>(() => {
    if (!brandName || !campaignTitle || !ctaLink) {
      return null;
    }

    return {
      id: "provided-campaign",
      brandName: normalizeString(brandName),
      logoUrl: normalizeString(logoUrl),
      campaignTitle: normalizeString(campaignTitle),
      ctaText: normalizeString(ctaText) || "Learn more",
      ctaLink: normalizeString(ctaLink),
      activeFrom: toDate(activeFrom),
      activeTo: toDate(activeTo),
    };
  }, [activeFrom, activeTo, brandName, campaignTitle, ctaLink, ctaText, logoUrl]);

  const [campaign, setCampaign] = useState<BrandCampaignBannerRecord | null>(providedCampaign);
  const [isLoading, setIsLoading] = useState(!providedCampaign);

  useEffect(() => {
    if (providedCampaign) {
      setCampaign(providedCampaign);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadCampaign() {
      try {
        setIsLoading(true);

        const campaigns = await listBrandCampaigns();
        if (!isMounted) return;

        setCampaign(pickActiveTierOneBrandCampaign(campaigns));
      } catch (error) {
        console.error("[BrandCampaignBanner] Failed to load brand campaigns", error);
        if (!isMounted) return;
        setCampaign(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCampaign();

    return () => {
      isMounted = false;
    };
  }, [providedCampaign]);

  const activeRangeLabel = useMemo(() => {
    if (!campaign) return null;
    return formatCampaignWindow(campaign.activeFrom, campaign.activeTo);
  }, [campaign]);

  if (isLoading) {
    return null;
  }

  if (!campaign) {
    return <>{emptyState}</>;
  }

  return (
    <section
      className={`mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-4 shadow-md sm:px-6 sm:py-5 ${className}`.trim()}
      aria-label={`${campaign.brandName} brand campaign banner`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          {campaign.logoUrl ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950/80 ring-1 ring-slate-700">
              <img
                src={campaign.logoUrl}
                alt={`${campaign.brandName} logo`}
                className="max-h-10 max-w-10 object-contain"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950/80 text-xs font-semibold uppercase tracking-wide text-slate-100 ring-1 ring-slate-700">
              {campaign.brandName.slice(0, 2)}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>Featured brand campaign</span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Live
              </span>
            </div>
            <h2 className="mt-1 text-sm font-semibold text-slate-50 sm:text-base">
              {campaign.brandName} · {campaign.campaignTitle}
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
            href={campaign.ctaLink}
            className="inline-flex items-center justify-center rounded-md bg-blue-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 sm:text-sm"
          >
            {campaign.ctaText}
          </a>
          <p className="text-[10px] text-slate-400 sm:text-[11px]">
            Pulse turns this campaign into something your community can actually join together.
          </p>
        </div>
      </div>
    </section>
  );
}

export default BrandCampaignBanner;
