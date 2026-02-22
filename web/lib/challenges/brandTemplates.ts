import {
  BrandChallengeTemplate,
} from "../brandChallengeTemplates";

import templatesJson from "../../../config/brandChallengeTemplates.json";

// Local config shape that matches the JSON file, so callers in the
// challenges namespace can work with the archetype-centric view of
// templates without having to know about brand groups.

type TemplatesConfig = typeof templatesJson;

const config = templatesJson as TemplatesConfig;

/**
 * Return all brand challenge templates that match a given brand archetype.
 *
 * This is the helper used by brand campaign flows where the entry point is
 * an archetype key like `gymshark_strength_streak` or
 * `on_running_recovery_block`, rather than a specific creative variant.
 */
export function getBrandChallengeTemplates(
  brandArchetype: string
): BrandChallengeTemplate[] {
  if (!brandArchetype) return [];

  const normalized = brandArchetype.toLowerCase();

  const allTemplates: BrandChallengeTemplate[] = config.brands.flatMap(
    (brand) => brand.templates as BrandChallengeTemplate[]
  );

  return allTemplates.filter((template) => {
    const templateArchetype = (template as any).brandArchetype;
    return (
      typeof templateArchetype === "string" &&
      templateArchetype.toLowerCase() === normalized
    );
  });
}

export type { BrandChallengeTemplate };
