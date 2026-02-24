# Partner Onboarding Dashboard — Step 1 Route & Auth Quickcheck

Goal: Confirm that `/partners/dashboard` is wired as an **admin-only route** using `withAdminAuth` and `AdminLayout`, and that the page title is "Partner Onboarding Dashboard".

## 1. Preconditions

- Dev server running:

  ```bash
  cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
  npm run dev:fast
  ```

- You have an **admin-capable** account and know how to sign into the local app.

## 2. Navigate to the dashboard route

1. Open:

   ```text
   http://localhost:3000/partners/dashboard
   ```

2. Expected behavior:
   - If you are **not** signed in or not an admin, you should see the same auth/guard behavior as other admin pages (e.g. redirect to sign-in or an access denied state).
   - If you are an **admin**, the page should load successfully.

This confirms that `withAdminAuth` is being applied to this route.

## 3. Verify layout and title

While viewing `/partners/dashboard` as an admin:

1. Look at the page shell:
   - It should match the general admin layout used elsewhere (navigation, header, etc.), indicating that `AdminLayout` is wrapping the content.

2. Confirm the page title / header text:
   - The main header in the content area should be:

     > `Partner Onboarding Dashboard`

   - The browser tab title (if wired through `AdminLayout`) should also reflect this or an equivalent admin page title.

This confirms that `AdminLayout` is used with `title="Partner Onboarding Dashboard"`.

## 4. Source confirmation (optional)

If you want to cross-check the implementation in code (not required for runtime verification):

- **File:** `web/app/partners/dashboard.tsx`

Look for:

```tsx
const PartnerOnboardingDashboardPage = () => (
  <AdminLayout title="Partner Onboarding Dashboard">
    <PartnerOnboardingDashboardPageInner />
  </AdminLayout>
);

export default withAdminAuth(PartnerOnboardingDashboardPage);
```

This ensures:

- The route file exists at `web/app/partners/dashboard.tsx`.
- The page content is wrapped in `AdminLayout` with the correct title.
- The default export is wrapped with `withAdminAuth`, making the route admin-only.

---

Once the behavior in sections 2 and 3 matches the expectations above, Step 1 (admin-only route + layout + title) is **verified in a real dev environment**, not just by static inspection.