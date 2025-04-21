import React from 'react';
import HorizontalBarGraph from './HorizontalBarGraph';

interface Props {
  muscleByReps: Record<string, number>;
  muscleByLoad: Record<string, number>;
  averageLoadPerRep: Record<string, number>;
}

const MuscleBalanceSection: React.FC<Props> = ({ muscleByReps, muscleByLoad, averageLoadPerRep }) => {
  const repsData = Object.entries(muscleByReps).map(([label, value]) => ({ label, value }));
  const loadData = Object.entries(muscleByLoad).map(([label, value]) => ({ label, value }));
  const avgData = Object.entries(averageLoadPerRep).map(([label, value]) => ({ label, value }));

  console.log('[MuscleBalanceSection] render', { muscleByReps, muscleByLoad, averageLoadPerRep });

  if (!repsData.length) return null;
  return (
    <div className="mb-12 px-4">
      <h3 className="text-xl font-bold mb-6">Muscle Group Balance</h3>

      {/* Reps distribution */}
      <div className="mb-6 bg-zinc-800 p-4 rounded-lg">
        <h4 className="text-sm text-gray-400 mb-3">Reps Distribution</h4>
        <HorizontalBarGraph data={repsData} valueSuffix="" barColorClass="bg-primaryGreen" />
      </div>

      {/* Load distribution */}
      {loadData.length > 0 && (
        <div className="mb-6 bg-zinc-800 p-4 rounded-lg">
          <h4 className="text-sm text-gray-400 mb-3">Load Distribution (lbs)</h4>
          <HorizontalBarGraph data={loadData} valueSuffix="lbs" barColorClass="bg-teal-400" />
        </div>
      )}

      {/* Avg load per rep */}
      {avgData.length > 0 && (
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h4 className="text-sm text-gray-400 mb-3">Avg Load / Rep</h4>
          <HorizontalBarGraph data={avgData} valueSuffix="lbs" barColorClass="bg-purple-400" />
        </div>
      )}
    </div>
  );
};

export default MuscleBalanceSection; 