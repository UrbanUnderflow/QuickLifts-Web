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

  const filteredPartners = useMemo(
    () =>
      typeFilter === "all"
        ? partners
        : partners.filter((p) => p.type === typeFilter),
    [partners, typeFilter]
  );

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
      <section className="border rounded-lg bg-white shadow-sm p-4 space-y-4">
        <header>
          <h2 className="text-lg font-semibold">Partner Records</h2>
          <p className="mt-1 text-xs text-gray-600 max-w-xl">
            Raw partner data loaded from the <code>partners</code> Firestore
            collection. Subsequent steps will layer on table rendering, filtering,
            and time-to-first-round metrics.
          </p>
        </header>

        {isLoading && (
          <p className="text-sm text-gray-600">Loading partner data…</p>
        )}

        {error && !isLoading && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!isLoading && !error && filteredPartners.length === 0 && (
          <p className="text-sm text-gray-600">
            No partners found yet for this filter. Once partners are onboarded into
            the <code>partners</code> collection, they will appear here.
          </p>
        )}

        {!isLoading && !error && filteredPartners.length > 0 && (
          <div className="space-y-3 text-sm text-gray-800">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p>
                Showing <span className="font-semibold">{filteredPartners.length}</span>{" "}
                partners
                {typeFilter !== "all" && (
                  <>
                    {" "}for type <span className="font-semibold">{typeFilter}</span>
                  </>
                )}
                .
              </p>
              <div className="flex items-center gap-2 text-sm">
                <label
                  htmlFor="partner-type-filter"
                  className="text-gray-700 font-medium"
                >
                  Filter by type:
                </label>
                <select
                  id="partner-type-filter"
                  className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as PartnerType | "all")
                  }
                >
                  <option value="all">All</option>
                  <option value="brand">Brand</option>
                  <option value="gym">Gym</option>
                  <option value="runClub">Run Club</option>
                </select>
              </div>
            </div>

            <PartnerOnboardingTable partners={filteredPartners} />
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
