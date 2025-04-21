import React from 'react';
import StatCard from './StatCard';
import { Dumbbell, Trophy, ArrowUpRight, Bolt } from 'lucide-react';

interface Props {
  totalVolume: number; // lbs
  totalReps: number;
  heaviestLift: { exercise: string; weight: number } | null;
  personalRecordsCount: number;
  mostImproved?: { exercise: string; improvementPct: number } | null;
}

const formatLargeNumber = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${Math.round(num)}`;
};

const LiftingPerformanceSection: React.FC<Props> = ({
  totalVolume,
  totalReps,
  heaviestLift,
  personalRecordsCount,
  mostImproved,
}) => {
  console.log('[LiftingPerformanceSection] props', {
    totalVolume,
    totalReps,
    heaviestLift,
    personalRecordsCount,
    mostImproved,
  });
  return (
    <div className="mb-12">
      <div className="mb-4 px-4 text-left">
        <h3 className="text-xl font-bold">Top Lifting Performance</h3>
      </div>
      <div className="overflow-x-auto px-4">
        <div className="flex space-x-4">
          {/* Total Load */}
          <StatCard
            icon={<Bolt className="w-5 h-5 text-blue-400" />}
            value={`${formatLargeNumber(totalVolume)} lbs`}
            label="Total Load"
            colorClass="text-blue-400"
          />
          {/* Total Reps */}
          <StatCard
            icon={<Bolt className="w-5 h-5 text-yellow-400" />}
            value={totalReps}
            label="Total Reps"
            colorClass="text-yellow-400"
          />
          {/* Heaviest Lift */}
          {heaviestLift && (
            <StatCard
              icon={<Dumbbell className="w-5 h-5 text-red-400" />}
              value={`${heaviestLift.weight} lbs`}
              label={heaviestLift.exercise}
              colorClass="text-red-400"
            />
          )}
          {/* Personal Records count */}
          <StatCard
            icon={<Trophy className="w-5 h-5 text-purple-400" />}
            value={personalRecordsCount}
            label="PRs"
            colorClass="text-purple-400"
          />
          {/* Most Improved */}
          {mostImproved && mostImproved.improvementPct > 0 && (
            <StatCard
              icon={<ArrowUpRight className="w-5 h-5 text-green-400" />}
              value={`+${Math.round(mostImproved.improvementPct)}%`}
              label={mostImproved.exercise}
              colorClass="text-green-400"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LiftingPerformanceSection; 