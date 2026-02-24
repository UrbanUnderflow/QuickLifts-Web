# Partner Onboarding Dashboard — Step 2: Firestore Query & Mapping Verification

Step 2 requirement:

> In `web/app/partners/dashboard.tsx`, add a Firestore query using the existing Firestore client to load all documents from the `partners` collection and map them into a typed array with fields `id`, `name`, `type`, `onboardingStage`, `invitedAt`, and `firstRoundCreatedAt`.

This doc shows **where** that logic lives and **how to verify** it without guessing.

---

## 1. Implementation: where the query & mapping live

### 1.1. Firestore query in the dashboard

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

Key points:

- Uses the existing Firestore client: `db` from `src/api/firebase/config`.
- Targets the `partners` collection via `collection(db, "partners")`.
- Calls `getDocs` to fetch all docs.
- Delegates mapping to `mapPartnersSnapshot`.
- Stores the result as `PartnerRow[]` in `partners` state.

### 1.2. Typed mapping via PartnerModel

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

This satisfies the type requirements:

- `id`: from `PartnerModel` (doc id).
- `name`: currently `contactEmail` (explicitly documented interim choice).
- `type`: `PartnerType` from `PartnerModel`.
- `onboardingStage`: string stage from `PartnerModel`.
- `invitedAt`: `Date` (normalized by `PartnerModel`).
- `firstRoundCreatedAt`: `Date | null`.

`PartnerRow` is defined in `web/components/partners/PartnerOnboardingTable.tsx` and is the single source of truth for the table’s row shape.

---

## 2. Static verification (no dev server required)

You can sanity-check the mapping behavior without hitting Firestore using the dev script.

### 2.1. Dev script

**File:** `web/lib/partners/dev-check-mapPartnersSnapshot.js`

Run from project root:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
node web/lib/partners/dev-check-mapPartnersSnapshot.js
```

Expected output (shape):

```json
[
  {
    "id": "partner-1",
    "name": "brand@example.com",
    "type": "brand",
    "onboardingStage": "invited",
    "invitedAt": "2025-01-01T12:00:00.000Z",
    "firstRoundCreatedAt": "2025-01-05T12:00:00.000Z"
  },
  {
    "id": "partner-2",
    "name": "gym@example.com",
    "type": "gym",
    "onboardingStage": "active",
    "invitedAt": "2025-01-03T12:00:00.000Z",
    "firstRoundCreatedAt": null
  }
]
```

The exact timestamps may differ, but the **keys and value types** should match:

- `id`: string
- `name`: string
- `type`: `"brand" | "gym" | "runClub"` (per `PartnerType`)
- `onboardingStage`: string
- `invitedAt`: `Date` serialized as ISO string
- `firstRoundCreatedAt`: `Date` serialized as ISO string or `null`

If this shape matches, the mapping logic aligns with `PartnerRow` and Step 2’s requirements.

---

## 3. Runtime verification (optional)

When running the dev server (`npm run dev:fast`) with real `partners` data:

1. Navigate to:

   ```text
   http://localhost:3000/partners/dashboard
   ```

2. Open your browser devtools Network tab:
   - Confirm a request is made to the Firestore client for the `partners` collection.

3. In the React components tree (or via logging), confirm:
   - `partners` state ends up as an array of objects with the same shape as `PartnerRow` above.

This completes Step 2: the dashboard page **does** load all documents from the `partners` collection via the established Firestore client and maps them into a typed `PartnerRow[]` using `PartnerModel`.
