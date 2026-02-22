# Partner Onboarding Dashboard – Step 1 Route & Admin Guard Verification

**Step 1 Goal**  
Create the admin-only route file `web/app/partners/dashboard.tsx` that wraps its contents with the existing `withAdminAuth` guard and `AdminLayout`, rendering a page titled **"Partner Onboarding Dashboard"**.

---

## Implementation Summary

**File:** `web/app/partners/dashboard.tsx`

```ts
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../../../src/api/firebase/config";
import type { PartnerFirestoreData, PartnerType } from "../../../src/types/Partner";
import { PartnerModel } from "../../../src/types/Partner";
import { withAdminAuth } from "../../lib/auth/withAdminAuth";
import { AdminLayout } from "../../components/admin/AdminLayout";
import {
  PartnerOnboardingTable,
  type PartnerRow,
} from "../../components/partners/PartnerOnboardingTable";
import { BarChart } from "../../components/charts/BarChart";

// ... page inner component omitted for brevity ...

const PartnerOnboardingDashboardPage = () => (
  <AdminLayout title="Partner Onboarding Dashboard">
    <PartnerOnboardingDashboardPageInner />
  </AdminLayout>
);

export default withAdminAuth(PartnerOnboardingDashboardPage);
```

This satisfies the Step 1 requirements:

- Route file lives at `web/app/partners/dashboard.tsx` (App Router → `/partners/dashboard`).
- The main page component is wrapped in `AdminLayout` with `title="Partner Onboarding Dashboard"`.
- The default export is wrapped with `withAdminAuth`, which in turn delegates to the existing `AdminRouteGuard` logic used elsewhere in the admin area.

---

## Agent-run static check (2026-02-22)

To re-validate the Step 1 implementation against the live code, run:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
sed -n '1,80p' web/app/partners/dashboard.tsx
```

Confirm that:

1. The file begins with `"use client";` and imports `withAdminAuth` from `web/lib/auth/withAdminAuth` and `AdminLayout` from `web/components/admin/AdminLayout`.
2. There is a wrapper component:

   ```tsx
   const PartnerOnboardingDashboardPage = () => (
     <AdminLayout title="Partner Onboarding Dashboard">
       <PartnerOnboardingDashboardPageInner />
     </AdminLayout>
   );
   ```

3. The default export is:

   ```tsx
   export default withAdminAuth(PartnerOnboardingDashboardPage);
   ```

If any of these conditions fail after future edits, Step 1 needs to be revisited.

---

## Notes

- `withAdminAuth` ensures this route continues to use the centralized admin guard logic instead of duplicating authorization rules.
- `AdminLayout` provides a simple, focused admin shell for this dashboard without pulling in heavier legacy layouts.
