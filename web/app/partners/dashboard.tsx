"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../../../src/api/firebase/config";
import type { PartnerType, PartnerFirestoreData } from "../../../src/types/Partner";
import { PartnerModel } from "../../../src/types/Partner";

interface PartnerRow {
  id: string;
  name: string;
  type: PartnerType;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt: Date | null;
}

function computeTimeToFirstRoundDays(row: PartnerRow): number | null {
  if (!row.firstRoundCreatedAt) return null;
  const msDiff = row.firstRoundCreatedAt.getTime() - row.invitedAt.getTime();
  if (msDiff <= 0) return 0;
  return msDiff / (1000 * 60 * 60 * 24);
}

/**
 * Partner Onboarding Dashboard
 *
 * Admin-only view of partner onboarding across brands, gyms, and run clubs.
 * This client component is responsible for loading partner data from
 * Firestore and rendering a basic onboarding table. Subsequent steps will
 * add filters and charts on top of the loaded `partners` state.
 */
export default function PartnerOnboardingDashboardPage() {
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

        const rows: PartnerRow[] = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data() as PartnerFirestoreData;
          const model = new PartnerModel(docSnap.id, raw);

          return {
            id: model.id,
            // TODO: Replace `name` with a dedicated partner name field
            // once it is available in the schema; for now, use contactEmail
            // as the display identifier.
            name: model.contactEmail,
            type: model.type,
            onboardingStage: model.onboardingStage,
            invitedAt: model.invitedAt,
            firstRoundCreatedAt: model.firstRoundCreatedAt ?? null,
          };
        });

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

  const partnersWithTime = useMemo(
    () =>
      partners.map((p) => ({
        ...p,
        timeToFirstRoundDays: computeTimeToFirstRoundDays(p),
      })),
    [partners]
  );

  return (
    <main className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Partner Onboarding Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600 max-w-2xl">
          Admin-only view of partner onboarding across brands, gyms, and run clubs.
          This dashboard shows time-to-first-round metrics so we can see how
          quickly each partner becomes active on Pulse.
        </p>
      </header>

      <section className="border rounded-lg bg-white shadow-sm p-4">
        {isLoading && (
          <p className="text-sm text-gray-600">Loading partner data…</p>
        )}

        {error && !isLoading && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!isLoading && !error && partnersWithTime.length === 0 && (
          <p className="text-sm text-gray-600">
            No partners found yet. Once partners are onboarded via the
            /api/partners/onboard endpoint, they will appear here.
          </p>
        )}

        {!isLoading && !error && partnersWithTime.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              <p>
                Loaded <span className="font-semibold">{partnersWithTime.length}</span>{" "}
                partners from Firestore.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                      Partner
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                      Type
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                      Onboarding Stage
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                      Invited At
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                      First Round Created At
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                      Time to First Round (days)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {partnersWithTime.map((row) => {
                    const invitedLabel = row.invitedAt.toLocaleString();
                    const firstRoundLabel = row.firstRoundCreatedAt
                      ? row.firstRoundCreatedAt.toLocaleString()
                      : "—";
                    const timeLabel =
                      row.timeToFirstRoundDays != null
                        ? row.timeToFirstRoundDays.toFixed(1)
                        : "—";

                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 border-b font-medium text-gray-900">
                          {row.name}
                        </td>
                        <td className="px-3 py-2 border-b capitalize">
                          {row.type}
                        </td>
                        <td className="px-3 py-2 border-b">
                          {row.onboardingStage}
                        </td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">
                          {invitedLabel}
                        </td>
                        <td className="px-3 py-2 border-b whitespace-nowrap">
                          {firstRoundLabel}
                        </td>
                        <td className="px-3 py-2 border-b text-right">
                          {timeLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
