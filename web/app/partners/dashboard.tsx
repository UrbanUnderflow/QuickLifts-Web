import React from "react";

// Admin-only Partner Onboarding Dashboard shell
//
// This page is intended for internal use by the Pulse team to monitor
// partner onboarding and time-to-active metrics. Authentication/authorization
// should be enforced by the shared admin middleware/config for the `web` app
// (similar to other admin-oriented routes).
//
// Subsequent steps will:
// - Query the `partners` Firestore collection
// - Render a table with partner onboarding data
// - Add filters and a simple visualization of time-to-first-round

export default async function PartnerOnboardingDashboardPage() {
  return (
    <main className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Partner Onboarding Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600 max-w-2xl">
          Admin-only view of partner onboarding across brands, gyms, and run clubs.
          Future iterations of this dashboard will show time-to-first-round metrics,
          lane-level performance, and filters for quickly spotting bottlenecks in
          our partnership pipeline.
        </p>
      </header>

      <section className="border rounded-lg bg-white shadow-sm p-4">
        <p className="text-sm text-gray-600">
          Data loading and visualizations will be implemented in subsequent steps.
          For now, this page establishes the admin-only route and layout shell at
          <code className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs">
            /partners/dashboard
          </code>
          .
        </p>
      </section>
    </main>
  );
}
