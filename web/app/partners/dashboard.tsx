"use client";

import React, { useEffect, useState } from "react";
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

/**
 * Partner Onboarding Dashboard
 *
 * Admin-only view of partner onboarding across brands, gyms, and run clubs.
 * This client component is responsible for loading partner data from
 * Firestore; subsequent steps will add tables, filters, and charts on top
 * of the loaded `partners` state.
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

  return (
    <main className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Partner Onboarding Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600 max-w-2xl">
          Admin-only view of partner onboarding across brands, gyms, and run clubs.
          This dashboard will show time-to-first-round metrics, lane-level
          performance, and filters for quickly spotting bottlenecks in our
          partnership pipeline.
        </p>
      </header>

      <section className="border rounded-lg bg-white shadow-sm p-4">
        {isLoading && (
          <p className="text-sm text-gray-600">Loading partner data</p>
        )}

        {error && !isLoading && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!isLoading && !error && partners.length === 0 && (
          <p className="text-sm text-gray-600">
            No partners found yet. Once partners are onboarded via the
            /api/partners/onboard endpoint, they will appear here.
          </p>
        )}

        {!isLoading && !error && partners.length > 0 && (
          <div className="text-sm text-gray-700">
            <p>
              Loaded <span className="font-semibold">{partners.length}</span>{" "}
              partners from Firestore. Subsequent steps will render this data
              in a table with filters and time-to-first-round metrics.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
