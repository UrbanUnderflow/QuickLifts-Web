"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../../../src/api/firebase/config";
import type { PartnerType, PartnerFirestoreData } from "../../../src/types/Partner";
import { PartnerModel } from "../../../src/types/Partner";
import { GymKpiPanel } from "../../components/partners/GymKpiPanel";
import { withAdminAuth } from "../../lib/auth/withAdminAuth";
import { AdminLayout } from "../../components/admin/AdminLayout";

interface PartnerPlaybookSummary {
  type: PartnerType;
  label: string;
  steps: { id: string; label: string; route: string }[];
}

interface PartnerRow {
  id: string;
  name: string;
  type: PartnerType;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt: Date | null;
  playbook: PartnerPlaybookSummary | null;
}

function computeTimeToFirstRoundDays(row: PartnerRow): number | null {
  if (!row.firstRoundCreatedAt) return null;
  const msDiff = row.firstRoundCreatedAt.getTime() - row.invitedAt.getTime();
  if (msDiff <= 0) return 0;
  return msDiff / (1000 * 60 * 60 * 24);
}

const TYPE_FILTER_OPTIONS: { label: string; value: PartnerType | "all" }[] = [
  { label: "All Types", value: "all" },
  { label: "Brands", value: "brand" },
  { label: "Gyms", value: "gym" },
  { label: "Run Clubs", value: "runClub" },
];

/**
 * Partner Onboarding Dashboard
 *
 * Admin-only view of partner onboarding across brands, gyms, and run clubs.
 * This client component is responsible for loading partner data from
 * Firestore and rendering onboarding tables + simple lane-level metrics.
 *
 * It also includes a gym-specific KPI panel which can be wired to a
 * real partner context (current user) once that is available; for now,
 * it is rendered behind a TODO placeholder.
 */
function PartnerOnboardingDashboardPageInner() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<PartnerType | "all">("all");

  useEffect(() => {
    let isMounted = true;

    async function loadPartners() {
      try {
        setIsLoading(true);
        setError(null);

        const snapshot = await getDocs(collection(db, "partners"));
        if (!isMounted) return;

        const rows: PartnerRow[] = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data() as PartnerFirestoreData & {
            playbook?: PartnerPlaybookSummary;
          };
          const model = new PartnerModel(docSnap.id, raw);

          const playbook = raw.playbook ?? null;

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
            playbook,
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

  const filteredPartners = useMemo(
    () =>
      typeFilter === "all"
        ? partners
        : partners.filter((p) => p.type === typeFilter),
    [partners, typeFilter]
  );

  const partnersWithTime = useMemo(
    () =>
      filteredPartners.map((p) => ({
        ...p,
        timeToFirstRoundDays: computeTimeToFirstRoundDays(p),
      })),
    [filteredPartners]
  );

  const laneAverages = useMemo(() => {
    const lanes: { type: PartnerType; label: string }[] = [
      { type: "brand", label: "Brands" },
      { type: "gym", label: "Gyms" },
      { type: "runClub", label: "Run Clubs" },
    ];

    return lanes.map((lane) => {
      const lanePartners = partners
        .filter((p) => p.type === lane.type)
        .map((p) => computeTimeToFirstRoundDays(p))
        .filter((d): d is number => d != null);

      if (lanePartners.length === 0) {
        return { ...lane, avgDays: null };
      }

      const sum = lanePartners.reduce((acc, d) => acc + d, 0);
      return { ...lane, avgDays: sum / lanePartners.length };
    });
  }, [partners]);

  const maxAvg = useMemo(() => {
    const vals = laneAverages
      .map((lane) => lane.avgDays)
      .filter((v): v is number => v != null && !isNaN(v));
    if (vals.length === 0) return 0;
    return Math.max(...vals);
  }, [laneAverages]);

  return (
    <>
      <header className="mb-2">
        <h1 className="text-2xl font-semibold">Partner Onboarding Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600 max-w-2xl">
          Admin-only view of partner onboarding across brands, gyms, and run clubs.
          This dashboard shows time-to-first-round metrics so we can see how
          quickly each partner becomes active on Pulse.
        </p>
      </header>

      {/* Gym-specific activation KPIs */}
      <section className="border rounded-lg bg-white shadow-sm p-4 space-y-3">
        <header>
          <h2 className="text-lg font-semibold">Gym Activation Snapshot</h2>
          <p className="mt-1 text-xs text-gray-600 max-w-xl">
            This panel surfaces gym affiliate activation metrics (rounds created and
            unique participants) for a specific gym. Once the partner dashboard is
            wired to an authenticated gym operator, this section should receive the
            current user's ID and display their gym's KPIs.
          </p>
        </header>

        {/* TODO: Replace hardcoded userId with real partner context (e.g., from auth). */}
        <GymKpiPanel userId={"__REPLACE_WITH_CURRENT_USER_ID__"} />
      </section>

      <section className="border rounded-lg bg-white shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-gray-700">
            <p>
              Loaded <span className="font-semibold">{partners.length}</span> partners
              from Firestore.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="type-filter" className="text-gray-700 font-medium">
              Filter by type:
            </label>
            <select
              id="type-filter"
              className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as PartnerType | "all")}
            >
              {TYPE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && (
          <p className="text-sm text-gray-600">Loading partner data…</p>
        )}

        {error && !isLoading && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!isLoading && !error && partnersWithTime.length === 0 && (
          <p className="text-sm text-gray-600">
            No partners found for the selected type. Once partners are onboarded via
            the /api/partners/onboard endpoint, they will appear here.
          </p>
        )}

        {!isLoading && !error && partnersWithTime.length > 0 && (
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
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                    Playbook
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

                  const playbookPrimaryRoute = row.playbook?.steps[0]?.route ?? null;

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
                      <td className="px-3 py-2 border-b text-sm">
                        {row.playbook ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-800">
                              {row.playbook.label}
                            </span>
                            {playbookPrimaryRoute && (
                              <a
                                href={playbookPrimaryRoute}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Open playbook
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No playbook</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border rounded-lg bg-white shadow-sm p-4 space-y-4">
        <header>
          <h2 className="text-lg font-semibold">Average Time to First Round by Lane</h2>
          <p className="mt-1 text-xs text-gray-600 max-w-xl">
            This view aggregates partners that have created at least one round and
            shows the average number of days from initial invite to the first
            Pulse-powered round for each lane.
          </p>
        </header>

        {laneAverages.every((lane) => lane.avgDays == null) ? (
          <p className="text-sm text-gray-600">
            No time-to-first-round data yet. Once partners reach their first
            Pulse round, lane-level averages will appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {laneAverages.map((lane) => {
              if (lane.avgDays == null || maxAvg === 0) {
                return (
                  <div key={lane.type} className="flex items-center gap-3 text-sm">
                    <div className="w-24 text-gray-700 font-medium">
                      {lane.label}
                    </div>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full" />
                    <div className="w-20 text-right text-gray-500 text-xs">
                      —
                    </div>
                  </div>
                );
              }

              const widthPercent = Math.max(
                4,
                Math.min(100, (lane.avgDays / maxAvg) * 100)
              );

              return (
                <div key={lane.type} className="flex items-center gap-3 text-sm">
                  <div className="w-24 text-gray-700 font-medium">{lane.label}</div>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-3 bg-blue-500 rounded-full"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-gray-700 text-xs">
                    {lane.avgDays.toFixed(1)} d
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

const PartnerOnboardingDashboardPage = () => (
  <AdminLayout title="Partner Onboarding Dashboard">
    <PartnerOnboardingDashboardPageInner />
  </AdminLayout>
);

export default withAdminAuth(PartnerOnboardingDashboardPage);
