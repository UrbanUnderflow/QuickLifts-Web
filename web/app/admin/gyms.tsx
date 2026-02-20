import React from "react";

import { getGymAffiliatesWithStats, GymAffiliateStats } from "../../lib/db/gymAffiliates";
import { AdminTable, AdminTableColumn } from "../../components/admin/AdminTable";

// Next.js App Router page for internal gym affiliate status view.
// This is a server component that fetches aggregated stats and renders
// a consistent admin table.

export default async function GymsAdminPage() {
  const gyms: GymAffiliateStats[] = await getGymAffiliatesWithStats();

  const columns: AdminTableColumn<GymAffiliateStats>[] = [
    { key: "name", header: "Gym Name", className: "font-medium" },
    { key: "partnerType", header: "Partner Type" },
    { key: "memberSignupCount", header: "Member Signup Count" },
    { key: "roundsCreated", header: "Rounds Created" },
    {
      key: "lastActivityDate",
      header: "Last Activity Date",
      render: (value) =>
        value instanceof Date ? value.toLocaleDateString() : "No rounds yet",
    },
  ];

  return (
    <main className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Gym Affiliates</h1>
        <p className="text-sm text-gray-600 mt-1">
          Internal view of gym affiliate partners, their member signups, rounds created,
          and recent activity.
        </p>
      </header>

      <AdminTable<GymAffiliateStats>
        columns={columns}
        rows={gyms}
        emptyMessage="Gym affiliate data will appear here once getGymAffiliatesWithStats is wired to Firestore."
      />
    </main>
  );
}
