import type { QuerySnapshot, DocumentData } from "firebase/firestore";

import type { PartnerFirestoreData } from "../../../src/types/Partner";
import { PartnerModel } from "../../../src/types/Partner";
import type { PartnerRow } from "../../components/partners/PartnerOnboardingTable";

/**
 * Map a Firestore partners collection snapshot into typed PartnerRow entries.
 *
 * Centralising this logic keeps the page component slimmer and makes it
 * easier to unit test the mapping in isolation from React.
 */
export function mapPartnersSnapshot(
  snapshot: QuerySnapshot<DocumentData>
): PartnerRow[] {
  return snapshot.docs.map((docSnap) => {
    const raw = docSnap.data() as PartnerFirestoreData;
    const model = new PartnerModel(docSnap.id, raw);

    return {
      id: model.id,
      // TODO: Replace `name` with a dedicated partner name field once
      // it is available in the schema; for now, use contactEmail as
      // the display identifier.
      name: model.contactEmail,
      type: model.type,
      onboardingStage: model.onboardingStage,
      invitedAt: model.invitedAt,
      firstRoundCreatedAt: model.firstRoundCreatedAt ?? null,
    };
  });
}
