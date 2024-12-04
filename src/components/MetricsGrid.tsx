import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface Metric {
  label: string;
  currentValue: number;
  previousValue: number;
  isCurrency?: boolean;
}

interface MetricsGridProps {
  metrics: Metric[];
}

const MetricCard: React.FC<Metric> = ({ label, currentValue, previousValue, isCurrency = false }) => {
  const calculatePercentageChange = () => {
    if (previousValue === 0) return 0;
    return ((currentValue - previousValue) / previousValue) * 100;
  };

  const percentageChange = calculatePercentageChange();
  
  const formatValue = (value: number) => {
    if (isCurrency) {
      return `$${value}`;
    }
    return value.toString();
  };

  return (
    <div className="bg-zinc-50 p-6 rounded-lg">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500">{label}</span>
        <div className="flex flex-col items-end">
          <span className={`flex items-center ${percentageChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {percentageChange >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            {Math.abs(percentageChange).toFixed(1)}%
          </span>
          <span className="text-xs text-zinc-400">from {formatValue(previousValue)}</span>
        </div>
      </div>
      <div className="mt-2 text-3xl font-bold">{formatValue(currentValue)}</div>
    </div>
  );
};

const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
};

export default MetricsGrid;