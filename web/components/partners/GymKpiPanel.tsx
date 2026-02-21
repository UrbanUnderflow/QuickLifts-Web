"use client";

import React, { useEffect, useState } from "react";
import type { GymKpis } from "../../lib/partners/getGymKpis";
import { getGymKpisForUser } from "../../lib/partners/getGymKpis";

interface GymKpiPanelProps {
  /**
   * The current user's ID. This is used to resolve the associated
   * gym affiliate (via gymAffiliateId or gymInviteCode) and load
   * gym-level KPIs.
   */
  userId: string;
}

export function GymKpiPanel({ userId }: GymKpiPanelProps) {
  const [kpis, setKpis] = useState<GymKpis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await getGymKpisForUser(userId);
        if (!isMounted) return;

        setKpis(data);
      } catch (err) {
        console.error("[GymKpiPanel] Failed to load gym KPIs", err);
        if (!isMounted) return;
        setError("Unable to load gym KPIs. Please try again later.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (userId) {
      load();
    } else {
      setIsLoading(false);
      setKpis(null);
    }

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <section className="border rounded-lg bg-white shadow-sm p-4 space-y-3">
      <header>
        <h2 className="text-lg font-semibold">Gym Activation KPIs</h2>
        <p className="mt-1 text-xs text-gray-600 max-w-xl">
          These metrics show how actively your gym's community is using Pulse.
          Rounds Created counts the total Pulse rounds associated with your gym.
          Unique Participants counts how many distinct members have joined at
          least one of your gym's rounds.
        </p>
      </header>

      {isLoading && (
        <p className="text-sm text-gray-600">Loading gym KPIs…</p>
      )}

      {error && !isLoading && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!isLoading && !error && !kpis && (
        <p className="text-sm text-gray-600">
          No gym affiliate data found for this user yet. Once your gym is
          onboarded as a Pulse affiliate and members start joining rounds via
          your invite code, gym-level KPIs will appear here.
        </p>
      )}

      {!isLoading && !error && kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
          <div className="border rounded-md p-3 bg-gray-50">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Gym
            </div>
            <div className="mt-1 text-base font-semibold text-gray-900">
              {kpis.gymName}
            </div>
          </div>

          <div className="border rounded-md p-3 bg-gray-50">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Rounds Created
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {kpis.roundsCreated}
            </div>
          </div>

          <div className="border rounded-md p-3 bg-gray-50">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Unique Participants
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {kpis.uniqueParticipants}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
