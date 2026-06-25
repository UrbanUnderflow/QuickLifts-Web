import { collection, getDocs, query, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";

import { db } from "../../src/api/firebase/config";
import { BrandCampaignBannerProps } from "../components/BrandCampaignBanner";
import { BrandCommunityPageProps, BrandKpiStats } from "../components/partners/BrandCommunityPage";

const BRAND_CAMPAIGNS_COLLECTION = "brandCampaigns";
const TIER_ONE_BRANDS = new Set(["nike", "gymshark", "oner active", "on running"]);

export type TimestampLike =
  | Date
  | string
  | number
  | { toDate?: () => Date }
  | { seconds?: number; nanoseconds?: number }
  | null
  | undefined;

export type BrandCampaign = {
  slug: string;
  brandName: string;
  brandLogoUrl?: string;
  heroHeadline: string;
  heroSubcopy: string;
  kpis?: BrandKpiStats;
  contactCtaLabel: string;
  contactCtaHref: string;
};

export type BrandCampaignBannerRecord = {
  id: string;
  brandName: string;
  logoUrl: string;
  campaignTitle: string;
  ctaText: string;
  ctaLink: string;
  activeFrom: Date | null;
  activeTo: Date | null;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBrandKey(value: string): string {
  return normalizeString(value).toLowerCase().replace(/\s+/g, " ");
}

export function toDate(value: TimestampLike): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    const timestampCandidate = value as {
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };

    if (typeof timestampCandidate.toDate === "function") {
      const parsed = timestampCandidate.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }

    if (typeof timestampCandidate.seconds === "number") {
      const millis =
        timestampCandidate.seconds * 1000 +
        Math.floor((timestampCandidate.nanoseconds || 0) / 1_000_000);
      const parsed = new Date(millis);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

export function isTierOneBrand(brandName: string): boolean {
  return TIER_ONE_BRANDS.has(normalizeBrandKey(brandName));
}

export function isActiveWithinWindow(input: {
  activeFrom: Date | null;
  activeTo: Date | null;
  now?: Date;
}): boolean {
  const now = input.now || new Date();
  const startsOnOrBeforeNow = !input.activeFrom || input.activeFrom.getTime() <= now.getTime();
  const endsOnOrAfterNow = !input.activeTo || input.activeTo.getTime() >= now.getTime();

  return startsOnOrBeforeNow && endsOnOrAfterNow;
}

export function mapBrandCampaignSnapshot(
  snapshot: QueryDocumentSnapshot<DocumentData>
): BrandCampaignBannerRecord | null {
  const data = snapshot.data() || {};
  const brandName = normalizeString(data.brandName);
  const campaignTitle = normalizeString(data.campaignTitle);
  const ctaText = normalizeString(data.ctaText);
  const ctaLink = normalizeString(data.ctaLink);
  const logoUrl = normalizeString(data.logoUrl);
  const activeFrom = toDate(data.activeFrom);
  const activeTo = toDate(data.activeTo);

  if (!brandName || !campaignTitle || !ctaText || !ctaLink) {
    return null;
  }

  return {
    id: snapshot.id,
    brandName,
    logoUrl,
    campaignTitle,
    ctaText,
    ctaLink,
    activeFrom,
    activeTo,
  };
}

export function pickActiveTierOneBrandCampaign(
  campaigns: BrandCampaignBannerRecord[],
  now: Date = new Date()
): BrandCampaignBannerRecord | null {
  const activeTierOneCampaigns = campaigns
    .filter((campaign) => isTierOneBrand(campaign.brandName))
    .filter((campaign) =>
      isActiveWithinWindow({
        activeFrom: campaign.activeFrom,
        activeTo: campaign.activeTo,
        now,
      })
    )
    .sort((left, right) => {
      const leftStart = left.activeFrom?.getTime() ?? 0;
      const rightStart = right.activeFrom?.getTime() ?? 0;
      return rightStart - leftStart;
    });

  return activeTierOneCampaigns[0] || null;
}

export async function listBrandCampaigns(): Promise<BrandCampaignBannerRecord[]> {
  const snapshot = await getDocs(query(collection(db, BRAND_CAMPAIGNS_COLLECTION)));

  return snapshot.docs
    .map((docSnapshot) => mapBrandCampaignSnapshot(docSnapshot))
    .filter((entry): entry is BrandCampaignBannerRecord => Boolean(entry));
}

export async function getActiveTierOneBrandCampaign(): Promise<BrandCampaignBannerProps | null> {
  const campaigns = await listBrandCampaigns();
  const activeCampaign = pickActiveTierOneBrandCampaign(campaigns);

  if (!activeCampaign) {
    return null;
  }

  return {
    brandName: activeCampaign.brandName,
    logoUrl: activeCampaign.logoUrl,
    campaignTitle: activeCampaign.campaignTitle,
    ctaText: activeCampaign.ctaText,
    ctaLink: activeCampaign.ctaLink,
    activeFrom: activeCampaign.activeFrom,
    activeTo: activeCampaign.activeTo,
  };
}

// Temporary in-memory campaign definitions for partner demos. These remain
// separate from the home-feed campaign banner so partner landing pages can
// keep their narrative copy while the in-app surface reads real campaign
// windows from Firestore.
const mockBrandCampaigns: BrandCampaign[] = [
  {
    slug: "gymshark",
    brandName: "Gymshark",
    brandLogoUrl:
      "https://assets.pulse-app.example/cobranded/gymshark-logo-light.png",
    heroHeadline: "Turn Gymshark drops into train-together challenge seasons.",
    heroSubcopy:
      "Pulse gives your athletes and community leaders a place to run 30-day strength streaks, photo-ready blocks, and upper / lower seasons that your customers can actually finish together.",
    kpis: {
      challengeJoins: 18340,
      streakWeeks: 72,
      creatorLedChallenges: 18,
      communityRetentionRate: 47,
    },
    contactCtaLabel: "Talk to Pulse about a Gymshark challenge season",
    contactCtaHref:
      "mailto:partners@pulseapp.com?subject=Gymshark%20community%20challenge",
  },
  {
    slug: "on-running",
    brandName: "On Running",
    brandLogoUrl:
      "https://assets.pulse-app.example/cobranded/on-running-logo-light.png",
    heroHeadline: "Host recovery resets and race builds your runners can feel.",
    heroSubcopy:
      "From 21-day recovery resets to 5K build blocks, Pulse turns your base of On runners into cohorts moving through clear seasons with your captains and creators.",
    kpis: {
      challengeJoins: 9640,
      streakWeeks: 54,
      creatorLedChallenges: 11,
      communityRetentionRate: 52,
    },
    contactCtaLabel: "Plan an On Running race-ready season",
    contactCtaHref:
      "mailto:partners@pulseapp.com?subject=On%20Running%20Pulse%20season",
  },
  {
    slug: "oner-active",
    brandName: "Oner Active",
    brandLogoUrl:
      "https://assets.pulse-app.example/cobranded/oner-active-logo-light.png",
    heroHeadline: "Give your glute days and reset seasons a shared home.",
    heroSubcopy:
      "Pulse lets Oner creators host glute blocks, confidence seasons, and mind-body resets that their communities can follow in sync instead of screenshotting workouts.",
    kpis: {
      challengeJoins: 7420,
      streakWeeks: 38,
      creatorLedChallenges: 9,
      communityRetentionRate: 49,
    },
    contactCtaLabel: "Design an Oner Active community block",
    contactCtaHref:
      "mailto:partners@pulseapp.com?subject=Oner%20Active%20community%20block",
  },
];

export async function getBrandCampaignBySlug(
  brandSlug: string
): Promise<BrandCommunityPageProps | null> {
  const normalized = brandSlug.toLowerCase();
  const campaign = mockBrandCampaigns.find((c) => c.slug === normalized);

  if (!campaign) return null;

  const {
    brandName,
    brandLogoUrl,
    heroHeadline,
    heroSubcopy,
    kpis,
    contactCtaLabel,
    contactCtaHref,
  } = campaign;

  return {
    brandName,
    brandLogoUrl,
    heroHeadline,
    heroSubcopy,
    kpis,
    contactCtaLabel,
    contactCtaHref,
  };
}
