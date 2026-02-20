"use client";

import React, { useEffect, useMemo, useState } from "react";

import { getPartnerRetention, PartnerRetentionPoint } from "./api/partnerRetention";
import TimeSeriesChart, {
  TimeSeriesPoint,
} from "../../components/charts/TimeSeriesChart";

// TODO: Replace with real partner identity source once the partner auth/context
// layer is finalized for the web app.
const MOCK_PARTNER_ID = "demo-partner";

/**
 * PartnerDashboardPage
 *
 * For now this file only wires up the Retention section. Future iterations of
 * the partner dashboard can add additional tabs/sections alongside it.
 */
export default function PartnerDashboardPage() {
  const [retentionSeries, setRetentionSeries] = useState<PartnerRetentionPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRetention() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getPartnerRetention(MOCK_PARTNER_ID);
        if (!isMounted) return;
        setRetentionSeries(data);
      } catch (err) {
        console.error("Failed to load partner retention", err);
        if (!isMounted) return;
        setError("Unable to load retention data. Please try again later.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRetention();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Partner Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          High-level view of how your community is engaging with Pulse. This
          early version focuses on 30-day behavior/usage retention.
        </p>
      </header>

      <section aria-labelledby="retention-heading" className="border rounded-lg p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 id="retention-heading" className="text-lg font-medium">
              Retention (30-Day Behavior/Usage)
            </h2>
            <p className="mt-1 text-xs text-gray-600 max-w-xl">
              This metric shows how consistently users sourced from your
              partnership keep showing up on Pulse over a 30-day window. It
              reflects behavior and app usagenot injuries, medical status, or
              any clinical outcomes.
            </p>
          </div>
        </div>

        {isLoading && (
          <p className="text-sm text-gray-500">Loading retention data</p>
        )}

        {error && !isLoading && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!isLoading && !error && retentionSeries.length === 0 && (
          <p className="text-sm text-gray-500">
            Retention data will appear here once the partnerRetention
            collection is wired and we have at least a few days of activity for
            this partner.
          </p>
        )}

        {/* Placeholder container for the upcoming 30-day trend chart and summary. */}
        {!isLoading && !error && retentionSeries.length > 0 && (
          <div className="mt-4">
            {/*
              Step 3 will render the actual TimeSeriesChart here and add a
              numeric summary with threshold highlighting.
            */}
            <pre className="text-xs bg-gray-50 border rounded p-2 overflow-x-auto">
              {JSON.stringify(retentionSeries, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}

