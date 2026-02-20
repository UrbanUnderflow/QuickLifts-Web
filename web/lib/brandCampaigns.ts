import { BrandCommunityPageProps, BrandKpiStats } from "../components/partners/BrandCommunityPage";

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

// Temporary in-memory campaign definitions for partner demos. In a
// future iteration this will be wired to Firestore or an API, but the
// shape should remain stable so the landing route doesn’t need to
// change.
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
    contactCtaHref: "mailto:partners@pulseapp.com?subject=Gymshark%20community%20challenge",
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

  const { brandName, brandLogoUrl, heroHeadline, heroSubcopy, kpis, contactCtaLabel, contactCtaHref } = campaign;

  const props: BrandCommunityPageProps = {
    brandName,
    brandLogoUrl,
    heroHeadline,
    heroSubcopy,
    kpis,
    contactCtaLabel,
    contactCtaHref,
  };

  return props;
}
