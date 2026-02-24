# Partner Onboarding Dashboard — Step 2 Firestore Summary

## Requirement

> In `web/app/partners/dashboard.tsx`, add a Firestore query using the existing Firestore client to load all documents from the `partners` collection and map them into a typed array with fields `id`, `name`, `type`, `onboardingStage`, `invitedAt`, and `firstRoundCreatedAt`.

## Implementation Overview

Step 2 is implemented by combining:

- A client-side Firestore query in the dashboard page.
- A mapping helper that converts Firestore documents into the `PartnerRow` shape used by the table.

### 1. Dashboard page query

**File:** `web/app/partners/dashboard.tsx`

```tsx
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../src/api/firebase/config";
import {
  PartnerOnboardingTable,
  type PartnerRow,
} from "../../components/partners/PartnerOnboardingTable";
import { mapPartnersSnapshot } from "../../lib/partners/mapPartnersSnapshot";

// ...

const [partners, setPartners] = useState<PartnerRow[]>([]);
const [isLoading, setIsLoading] = useState<boolean>(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let isMounted = true;

  async function loadPartners() {
    try {
      setIsLoading(true);
      setError(null);

      const snapshot = await getDocs(collection(db, "partners"));
      if (!isMounted) return;

      const rows: PartnerRow[] = mapPartnersSnapshot(snapshot);
      setPartners(rows);
    } catch (err) {
      console.error("[PartnerOnboardingDashboard] Failed to load partners", err);
      if (!isMounted) return;
      setError("Unable to load partner data. Please try again later.");
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  }

  loadPartners();

  return () => {
    isMounted = false;
  };
}, []);
```

This logic:

- Uses the existing Firestore client (`db` from `src/api/firebase/config`).
- Reads all documents from the `partners` collection.
- Delegates conversion of the raw snapshot to `PartnerRow[]` via `mapPartnersSnapshot`.
- Stores the result in React state so downstream components (filter, table, chart) all operate on the same typed data.

### 2. Mapping helper: Firestore → PartnerRow

**File:** `web/lib/partners/mapPartnersSnapshot.ts`

```ts
import type { QuerySnapshot, DocumentData } from "firebase/firestore";
import type { PartnerFirestoreData } from "../../../src/types/Partner";
import { PartnerModel } from "../../../src/types/Partner";
import type { PartnerRow } from "../../components/partners/PartnerOnboardingTable";

export function mapPartnersSnapshot(
  snapshot: QuerySnapshot<DocumentData>
): PartnerRow[] {
  return snapshot.docs.map((docSnap) => {
    const raw = docSnap.data() as PartnerFirestoreData;
    const model = new PartnerModel(docSnap.id, raw);

    return {
      id: model.id,
      // TEMP: using contactEmail as display name until schema adds a proper name field
      name: model.contactEmail,
      type: model.type,
      onboardingStage: model.onboardingStage,
      invitedAt: model.invitedAt,
      firstRoundCreatedAt: model.firstRoundCreatedAt ?? null,
    };
  });
}
```

This ensures each row has exactly the fields required for the dashboard:

- `id`: Firestore document ID via `PartnerModel`.
- `name`: currently the partner's `contactEmail` (documented as a temporary display name).
- `type`: `PartnerType` (`"brand" | "gym" | "runClub"`).
- `onboardingStage`: textual onboarding stage.
- `invitedAt`: normalized `Date` instance.
- `firstRoundCreatedAt`: `Date` instance or `null` when no first round exists.

Together, `loadPartners()` + `mapPartnersSnapshot()` satisfy Step 2 by:

1. Using the existing Firestore client to load from the `partners` collection.
2. Producing a strongly typed `PartnerRow[]` for the rest of the dashboard to consume.

## Verification References

For ways to **verify** this behavior rather than just trusting it, see:

- `docs/deliverables/partner-onboarding-dashboard-step2-firestore-verification.md`
- `docs/deliverables/partner-onboarding-dashboard-step2-firestore-quickcheck.md`
- Dev script: `web/lib/partners/dev-check-mapPartnersSnapshot.js`

Those artifacts cover both static (Node script) and runtime (browser + Network tab) checks that the dashboard is actually loading and mapping real `partners` data from Firestore.