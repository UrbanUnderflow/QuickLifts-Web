import React from "react";
import type { PartnerType } from "../../../src/types/Partner";

export interface PartnerRow {
  id: string;
  name: string;
  type: PartnerType;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt: Date | null;
}

interface PartnerOnboardingTableProps {
  partners: PartnerRow[];
}

function computeTimeToFirstRoundDays(row: PartnerRow): number | null {
  if (!row.firstRoundCreatedAt) return null;
  const msDiff = row.firstRoundCreatedAt.getTime() - row.invitedAt.getTime();
  if (msDiff <= 0) return 0;
  return msDiff / (1000 * 60 * 60 * 24);
}

export const PartnerOnboardingTable: React.FC<PartnerOnboardingTableProps> = ({
  partners,
}) => {
  if (partners.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        No partners found. Once partners are onboarded into the
        <code> partners </code>
        collection, they will appear here.
      </p>
    );
  }

  return (
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
          {partners.map((row) => {
            const invitedLabel = row.invitedAt.toLocaleString();
            const firstRoundLabel = row.firstRoundCreatedAt
              ? row.firstRoundCreatedAt.toLocaleString()
              : "—";
            const timeToFirstRound = computeTimeToFirstRoundDays(row);
            const timeLabel =
              timeToFirstRound != null ? timeToFirstRound.toFixed(1) : "—";

            return (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 border-b font-medium text-gray-900">
                  {row.name}
                </td>
                <td className="px-3 py-2 border-b capitalize">{row.type}</td>
                <td className="px-3 py-2 border-b">{row.onboardingStage}</td>
                <td className="px-3 py-2 border-b whitespace-nowrap">
                  {invitedLabel}
                </td>
                <td className="px-3 py-2 border-b whitespace-nowrap">
                  {firstRoundLabel}
                </td>
                <td className="px-3 py-2 border-b text-right">{timeLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
