# Partner Onboarding Dashboard — Step 1 Route Summary

This file documents the concrete implementation of Step 1 for the Partner Onboarding Dashboard route.

## Requirement

> Create the admin-only route file `web/app/partners/dashboard.tsx` that wraps its contents with `withAdminAuth` and `AdminLayout`, rendering a page titled "Partner Onboarding Dashboard."

## Implementation

**File:** `web/app/partners/dashboard.tsx`

```tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
// Firestore + types imports omitted here for brevity

import { withAdminAuth } from "../../lib/auth/withAdminAuth";
import { AdminLayout } from "../../components/admin/AdminLayout";
// ... other imports

function PartnerOnboardingDashboardPageInner() {
  // Client-side Firestore load, filtering, table, and chart logic
}

const PartnerOnboardingDashboardPage = () => (
  <AdminLayout title="Partner Onboarding Dashboard">
    <PartnerOnboardingDashboardPageInner />
  </AdminLayout>
);

export default withAdminAuth(PartnerOnboardingDashboardPage);
```

This confirms that:

- The route file exists at `web/app/partners/dashboard.tsx`.
- `PartnerOnboardingDashboardPageInner` contains the dashboard implementation.
- The exported page component is wrapped in `AdminLayout` with `title="Partner Onboarding Dashboard"`.
- The default export is guarded by `withAdminAuth`, making the route admin-only.

## Verification References

For runtime checks of this route and guard behavior, see:

- `docs/deliverables/partner-onboarding-dashboard-step1-route-quickcheck.md`

That quickcheck describes how to:

- Hit `/partners/dashboard` as a non-admin/admin.
- Confirm the admin-only guard and layout behavior in a running dev environment.
