import type { PartnerType } from "../../../src/types/Partner";
import type { PartnerRow } from "../../components/partners/PartnerOnboardingTable";

// Filter type used by the Partner Onboarding dashboard. Keeping this
// centralised ensures that helpers and components agree on the set of
// allowed filter values.
export type PartnerTypeFilter = PartnerType | "all";

export function filterPartnersByType(
  partners: PartnerRow[],
  filter: PartnerTypeFilter
): PartnerRow[] {
  if (filter === "all") return partners;
  return partners.filter((p) => p.type === filter);
}
