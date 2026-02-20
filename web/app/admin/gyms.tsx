import React from "react";

import {
  getGymAffiliatesWithStats,
  GymAffiliateStats,
} from "../../lib/db/gymAffiliates";
import { AdminTable, AdminTableColumn } from "../../components/admin/AdminTable";

// Next.js App Router page for internal gym affiliate status view.
// This is a server component that fetches aggregated stats and renders
// a client-side table with filtering controls.

export default async function GymsAdminPage() {
  const gyms: GymAffiliateStats[] = await getGymAffiliatesWithStats();

  return (
    <main className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Gym Affiliates</h1>
        <p className="text-sm text-gray-600 mt-1">
          Internal view of gym affiliate partners, their member signups, rounds created,
          and recent activity.
        </p>
      </header>

      <GymsTableClient gyms={gyms} />
    </main>
  );
}

// Client-side table + filter for inactivity

"use client";

import { useMemo, useState } from "react";

type GymsTableClientProps = {
  gyms: GymAffiliateStats[];
};

function GymsTableClient({ gyms }: GymsTableClientProps) {
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);

  const filteredGyms = useMemo(
    () => (showInactiveOnly ? gyms.filter((g) => g.isInactive) : gyms),
    [gyms, showInactiveOnly]
  );

  const columns: AdminTableColumn<GymAffiliateStats>[] = [
    { key: "name", header: "Gym Name", className: "font-medium" },
    { key: "partnerType", header: "Partner Type" },
    { key: "memberSignupCount", header: "Member Signup Count" },
    { key: "roundsCreated", header: "Rounds Created" },
    {
      key: "lastActivityDate",
      header: "Last Activity Date",
      render: (value, row) => {
        const label =
          value instanceof Date
            ? value.toLocaleDateString()
            : value
            ? String(value)
            : "No rounds yet";
        return (
          <span className={row.isInactive ? "text-red-600 font-medium" : ""}>
            {label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Total gyms:</span> {gyms.length}
          {" · "}
          <span className="font-medium">Inactive (&gt;30 days w/o rounds):</span>{" "}
          {gyms.filter((g) => g.isInactive).length}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={showInactiveOnly}
            onChange={(e) => setShowInactiveOnly(e.target.checked)}
          />
          Show only gyms inactive for &gt;30 days
        </label>
      </div>

      <AdminTable<GymAffiliateStats>
        columns={columns}
        rows={filteredGyms}
        emptyMessage="Gym affiliate data will appear here once getGymAffiliatesWithStats is wired to Firestore."
      />
    </div>
  );
}
