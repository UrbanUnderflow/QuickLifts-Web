import templatesJson from "../../config/brandChallengeTemplates.json";

export type TargetBehavior = {
  key: string;
  label: string;
  sessionsPerWeek: number;
};

export type BrandChallengeTemplate = {
  id: string;
  name: string;
  description: string;
  defaultDurationDays: number;
  targetSessionsPerWeek: number;
  targetBehaviors: TargetBehavior[];
  visualStyleKey: string;
};

export type BrandTemplateGroup = {
  brandType: string;
  displayName: string;
  templates: BrandChallengeTemplate[];
};

export type BrandChallengeTemplatesConfig = {
  brands: BrandTemplateGroup[];
};

// Cast the imported JSON to the strongly-typed config shape. This keeps TS happy
// while still allowing non-TS consumers (and content editors) to work directly
// with a plain JSON file under config/.
const config = templatesJson as BrandChallengeTemplatesConfig;

export function getTemplatesForBrand(brandType: string): BrandChallengeTemplate[] {
  if (!brandType) return [];

  const normalized = brandType.toLowerCase();

  const group = config.brands.find(
    (b) => b.brandType.toLowerCase() === normalized
  );

  return group?.templates ?? [];
}

export function getTemplateById(templateId: string): BrandChallengeTemplate | undefined {
  if (!templateId) return undefined;

  for (const brand of config.brands) {
    const match = brand.templates.find((t) => t.id === templateId);
    if (match) return match;
  }

  return undefined;
}

export function getAllBrandTemplateGroups(): BrandTemplateGroup[] {
  return config.brands;
}
