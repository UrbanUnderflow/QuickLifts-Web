"use client";

import React, { useEffect, useMemo, useState } from "react";

import { getPartnerRetention, PartnerRetentionPoint } from "./api/partnerRetention";
import TimeSeriesChart, {
  TimeSeriesPoint,
} from "../../components/charts/TimeSeriesChart";
import Tooltip from "../../components/ui/Tooltip";

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

  const latestRetention = useMemo(() => {
    if (!retentionSeries || retentionSeries.length === 0) return null;
    return retentionSeries[retentionSeries.length - 1];
  }, [retentionSeries]);

  const latestPercent = latestRetention ? latestRetention.retentionRate * 100 : null;
  const isAboveThreshold = latestPercent !== null && latestPercent >= 40;

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
            <div className="flex items-center gap-2">
              <h2 id="retention-heading" className="text-lg font-medium">
                Retention (30-Day Behavior/Usage)
              </h2>
              <Tooltip label="This is a behavior and app-usage metric only. It does not describe injuries, medical clearance, or health outcomes.">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-600 cursor-help">
                  ?
                </span>
              </Tooltip>
            </div>
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

        {!isLoading && !error && retentionSeries.length > 0 && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="flex-1">
                <TimeSeriesChart
                  data={retentionSeries.map<TimeSeriesPoint>((point) => ({
                    label: point.date,
                    value: point.retentionRate,
                  }))}
                  height={140}
                />
              </div>

              <div className="w-full md:w-48 border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-xs font-medium text-gray-600">
                    Current 30-day retention
                  </p>
                  <Tooltip label="Percentage of users sourced from your partnership who are still active on Pulse over a 30-day window. This reflects behavior and app usage only, not medical status or clinical outcomes.">
                    <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-gray-300 text-[9px] text-gray-600 cursor-help">
                      i
                    </span>
                  </Tooltip>
                </div>
                {latestPercent !== null ? (
                  <p
                    className={
                      "text-2xl font-semibold " +
                      (isAboveThreshold ? "text-green-600" : "text-red-600")
                    }
                  >
                    {latestPercent.toFixed(0)}%
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Not enough data yet.</p>
                )}
                <p className="mt-1 text-[11px] text-gray-600">
                  Target: 
                  <span className="font-semibold"> 40% monthly retention</span> for
                  users sourced through your partnership.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

