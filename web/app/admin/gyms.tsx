import React from "react";

// Data-access helpers (to be implemented/expanded in subsequent steps)
import { getGymAffiliatesWithStats } from "../../lib/db/gymAffiliates";
import { getRoundsForGym } from "../../lib/db/rounds";

// Basic Next.js App Router page component for internal admin gym affiliate view
// NOTE: This is an initial placeholder that wires up imports and table structure.

export default async function GymsAdminPage() {
  // TODO (Step 2/3): Replace placeholder data with real data from getGymAffiliatesWithStats()
  const gyms: Array<{
    id: string;
    name: string;
    partnerType: string;
    memberSignupCount: number;
    roundsCreated: number;
    lastActivityDate: string | null;
  }> = [];

  return (
    <main className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Gym Affiliates</h1>
        <p className="text-sm text-gray-600 mt-1">
          Internal view of gym affiliate partners, their member signups, rounds created, and
          recent activity. Data is currently placeholder and will be wired to Firestore in
          subsequent steps.
        </p>
      </header>

      <section className="overflow-x-auto border rounded-lg bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">Gym Name</th>
              <th className="px-4 py-3">Partner Type</th>
              <th className="px-4 py-3">Member Signup Count</th>
              <th className="px-4 py-3">Rounds Created</th>
              <th className="px-4 py-3">Last Activity Date</th>
            </tr>
          </thead>
          <tbody>
            {gyms.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  Gym affiliate data will appear here once getGymAffiliatesWithStats() is
                  implemented.
                </td>
              </tr>
            ) : (
              gyms.map((gym) => (
                <tr key={gym.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{gym.name}</td>
                  <td className="px-4 py-3">{gym.partnerType}</td>
                  <td className="px-4 py-3">{gym.memberSignupCount}</td>
                  <td className="px-4 py-3">{gym.roundsCreated}</td>
                  <td className="px-4 py-3">
                    {gym.lastActivityDate ?? "No rounds yet"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
