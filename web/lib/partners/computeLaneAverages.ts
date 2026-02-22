import type { PartnerType } from "../../../src/types/Partner";
import type { PartnerRow } from "../../components/partners/PartnerOnboardingTable";

export type LaneAverageDatum = {
  label: string;
  value: number | null;
};

/**
 * Compute average time-to-first-round (in days) per partner type for a
 * given set of partners.
 *
 * - Partners without `firstRoundCreatedAt` are ignored for averaging.
 * - Negative / zero diffs are clamped to 0 days.
 */
export function computeLaneAverages(
  partners: PartnerRow[],
  lanes: { type: PartnerType; label: string }[]
): LaneAverageDatum[] {
  return lanes.map((lane) => {
    const lanePartners = partners
      .filter((p) => p.type === lane.type)
      .map((p) => {
        if (!p.firstRoundCreatedAt) return null;
        const msDiff = p.firstRoundCreatedAt.getTime() - p.invitedAt.getTime();
        if (msDiff <= 0) return 0;
        return msDiff / (1000 * 60 * 60 * 24);
      })
      .filter((v): v is number => v != null && !isNaN(v));

    if (lanePartners.length === 0) {
      return { label: lane.label, value: null };
    }

    const sum = lanePartners.reduce((acc, d) => acc + d, 0);
    return { label: lane.label, value: sum / lanePartners.length };
  });
}
