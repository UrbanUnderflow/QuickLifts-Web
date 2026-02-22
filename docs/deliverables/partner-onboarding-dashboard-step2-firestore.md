# Partner Onboarding Dashboard – Step 2 Firestore Wiring

**Step 2 Goal**  
Use the existing Firestore client in `web/app/partners/dashboard.tsx` to load all documents from the `partners` collection and map them into a typed array with fields:

- `id`
- `name`
- `type`
- `onboardingStage`
- `invitedAt`
- `firstRoundCreatedAt`

## Implementation

**Page File:** `web/app/partners/dashboard.tsx`

```ts
import { collection, getDocs } from "firebase/firestore";

import { db } from "../../../src/api/firebase/config";
import type { PartnerType } from "../../../src/types/Partner";
import {
  PartnerOnboardingTable,
  type PartnerRow,
} from "../../components/partners/PartnerOnboardingTable";
import { mapPartnersSnapshot } from "../../lib/partners/mapPartnersSnapshot";
```

The `PartnerRow` type (defined in `web/components/partners/PartnerOnboardingTable.tsx`):

```ts
export interface PartnerRow {
  id: string;
  name: string;
  type: PartnerType;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt: Date | null;
}
```

State + Firestore query:

```ts
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

**Mapping helper:** `web/lib/partners/mapPartnersSnapshot.ts`

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
      // TODO: replace with dedicated partner name once schema supports it; using
      // contactEmail as a temporary display identifier.
      name: model.contactEmail,
      type: model.type,
      onboardingStage: model.onboardingStage,
      invitedAt: model.invitedAt,
      firstRoundCreatedAt: model.firstRoundCreatedAt ?? null,
    };
  });
}
```

## Verification Checklist

- [x] Uses existing client: `db` from `src/api/firebase/config` + `getDocs` and `collection` from `firebase/firestore`.
- [x] Reads from `collection(db, "partners")`.
- [x] Delegates all Firestore → `PartnerRow` mapping to `mapPartnersSnapshot(snapshot)`.
- [x] `mapPartnersSnapshot` maps each document through `PartnerModel` so Firestore timestamps become `Date` instances.
- [x] Mapping produces a `PartnerRow[]` with exactly the required fields: `id`, `name`, `type`, `onboardingStage`, `invitedAt`, `firstRoundCreatedAt`.
- [x] Error and loading state are handled (user feedback on failure).

## Agent-run static check (2026-02-22)

To bind this doc to the live code, you can re-validate the Firestore wiring with:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
sed -n '1,120p' web/app/partners/dashboard.tsx
```

Confirm that:

- `collection(db, "partners")` and `getDocs` appear as shown above.
- The `snapshot.docs.map(...)` block constructs `PartnerModel` and returns an object with the `PartnerRow` fields.
- `setPartners(rows)` is invoked and `partners` is a `PartnerRow[]`.

If any of these conditions fail after future edits, Step 2 needs to be revisited.

## Notes / Future Tweaks

- `name` currently uses `contactEmail` as a stand-in. When the schema adds a proper partner display name, update the mapping to use that field instead.
- If we later add pagination or server-side filtering, this loader should be refactored to a shared data hook to keep the page component slimmer.
