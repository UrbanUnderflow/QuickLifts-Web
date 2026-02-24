import templatesJson from "../../../config/brandChallengeTemplates.json";

// Types that mirror the structure of config/brandChallengeTemplates.json.

export type TargetBehavior = {
  key: string;
  label: string;
  sessionsPerWeek: number;
};

export type BrandChallengeTemplate = {
  // Core identity and campaign wiring
  id: string;
  brandArchetype: string;

  // User-facing copy and schedule settings
  title: string;
  description: string;
  durationDays: number;
  sessionsPerWeek: number;
  brandStyleKey: string;

  // Optional / legacy fields that are still present in the JSON and
  // useful for some surfaces. Callers can ignore these if they only
  // care about the core campaign contract above.
  name?: string;
  defaultDurationDays?: number;
  targetSessionsPerWeek?: number;
  targetBehaviors?: TargetBehavior[];
  visualStyleKey?: string;
};

export type BrandTemplateGroup = {
  brandType: string;
  displayName: string;
  templates: BrandChallengeTemplate[];
};

export type BrandChallengeTemplatesConfig = {
  brands: BrandTemplateGroup[];
};

const config = templatesJson as BrandChallengeTemplatesConfig;

/**
 * Look up a single brand challenge template by campaign id.
 *
 * In the current JSON, `id` is the canonical campaign identifier used
 * for wiring links like `?brandCampaignId=gymshark-30-day-strength-streak`.
 */
export function getBrandChallengeTemplateByCampaignId(
  brandCampaignId: string
): BrandChallengeTemplate | undefined {
  if (!brandCampaignId) return undefined;

  const normalized = brandCampaignId.toLowerCase();

  for (const brand of config.brands) {
    const match = brand.templates.find(
      (t) => t.id.toLowerCase() === normalized
    );
    if (match) return match;
  }

  return undefined;
}

/**
 * Convenience helper used when the entry point is an archetype key
 * (e.g., `gymshark_strength_streak`) instead of a specific campaign id.
 * This remains available for flows that think in terms of archetypes
 * rather than individual campaigns.
 */
export function getBrandChallengeTemplatesByArchetype(
  brandArchetype: string
): BrandChallengeTemplate[] {
  if (!brandArchetype) return [];

  const normalized = brandArchetype.toLowerCase();

  const allTemplates: BrandChallengeTemplate[] = config.brands.flatMap(
    (brand) => brand.templates
  );

  return allTemplates.filter((template) => {
    const templateArchetype = template.brandArchetype;
    return (
      typeof templateArchetype === "string" &&
      templateArchetype.toLowerCase() === normalized
    );
  });
}
