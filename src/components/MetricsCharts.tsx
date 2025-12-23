import React from 'react';
import { HeatMapGrid } from 'react-grid-heatmap';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { retentionMatrix, kFactorSeries, unitEconomics } from '../utils/metrics';

/* ---------------------------------
   HeatMap: Monthly → Weekly Retention
---------------------------------- */
export const RetentionHeatmap: React.FC = () => (
  <div className="rounded-xl overflow-hidden bg-zinc-800/30 p-4">
    <HeatMapGrid
      data={retentionMatrix}
      xLabels={['W0','W1','W2','W3','W4','W5','W6','W7']}
      yLabels={['Jan','Feb','Mar','Apr','May']}
      // color scale 0-100 → dark-to-neon
      cellStyle={(_, __, value) => ({
        background: `hsl(74, 100%, ${Math.max(20, 100 - value)}%)`,
        color: value < 40 ? '#fff' : '#000',
        fontSize: '0.75rem',
        fontWeight: 500,
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.1)',
      })}
      cellHeight="2.5rem"
      xLabelsStyle={() => ({
        color: '#a1a1aa',
        fontSize: '0.75rem',
        fontWeight: 500,
      })}
      yLabelsStyle={() => ({
        color: '#a1a1aa',
        fontSize: '0.75rem',
        fontWeight: 500,
      })}
    />
  </div>
);

/* ---------------------------------
   Subscription Overview Pie Chart
---------------------------------- */
const subscriptionData = [
  { name: 'Standard Price', value: 108, percentage: 75, color: '#7DD3FC' },
  { name: 'Introductory Offer', value: 34, percentage: 24, color: '#3B82F6' },
  { name: 'Billing Retry', value: 2, percentage: 1, color: '#0EA5E9' },
];

export const SubscriptionOverview: React.FC = () => (
  <div className="bg-zinc-800/30 rounded-xl p-6">
    <div className="flex justify-center mb-6">
      <div className="relative w-64 h-64">
        <PieChart width={256} height={256}>
          <Pie
            data={subscriptionData}
            cx={128}
            cy={128}
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {subscriptionData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              background: '#27272a', 
              border: 'none', 
              color: '#fafafa',
              borderRadius: '8px'
            }} 
          />
        </PieChart>
      </div>
    </div>
    
    <div className="space-y-3">
      {subscriptionData.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }}
            ></div>
            <span className="text-zinc-300 text-sm">{item.name}</span>
          </div>
          <div className="text-right">
            <span className="text-white font-medium">{item.value}</span>
            <span className="text-zinc-400 text-sm ml-1">({item.percentage}%)</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ---------------------------------
   Retention Rate Line Chart
---------------------------------- */
const retentionData = [
  { month: 'May', rate: 25 },
  { month: 'Jun', rate: 20 },
  { month: 'Jul', rate: 45 },
  { month: 'Aug', rate: 35 },
  { month: 'Sep', rate: 15 },
  { month: 'Oct', rate: 40 },
  { month: 'Nov', rate: 15 },
  { month: 'Dec', rate: 25 },
  { month: 'Jan', rate: 20 },
  { month: 'Feb', rate: 35 },
  { month: 'Mar', rate: 20 },
  { month: 'Apr', rate: 15 },
];

export const RetentionRateChart: React.FC = () => (
  <div className="bg-zinc-800/30 rounded-xl p-6">
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={retentionData}>
          <XAxis 
            dataKey="month" 
            tick={{ fill: '#a1a1aa', fontSize: 12 }} 
            axisLine={{ stroke: '#52525b' }}
            tickLine={{ stroke: '#52525b' }}
          />
          <YAxis 
            tick={{ fill: '#a1a1aa', fontSize: 12 }} 
            domain={[0, 100]}
            axisLine={{ stroke: '#52525b' }}
            tickLine={{ stroke: '#52525b' }}
            tickFormatter={(value) => `${value}%`}
          />
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#7DD3FC"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: '#18181b', stroke: '#7DD3FC' }}
          />
          <Tooltip 
            contentStyle={{ 
              background: '#27272a', 
              border: 'none', 
              color: '#fafafa',
              borderRadius: '8px'
            }}
            formatter={(value) => [`${value}%`, 'Retention Rate']}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ---------------------------------
   Conversion Rate Donut Chart
---------------------------------- */
const conversionData = [
  { name: 'Direct-to-Paid', value: 88, color: '#7DD3FC' },
  { name: 'Introductory Offers', value: 12, color: '#3B82F6' },
];

export const ConversionChart: React.FC = () => (
  <div className="bg-zinc-800/30 rounded-xl p-6">
    <div className="flex justify-center mb-6">
      <div className="relative w-48 h-48">
        <PieChart width={192} height={192}>
          <Pie
            data={conversionData}
            cx={96}
            cy={96}
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {conversionData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              background: '#27272a', 
              border: 'none', 
              color: '#fafafa',
              borderRadius: '8px'
            }} 
          />
        </PieChart>
      </div>
    </div>
    
    <div className="space-y-3">
      {conversionData.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }}
            ></div>
            <span className="text-zinc-300 text-sm">{item.name}</span>
          </div>
          <span className="text-white font-medium">{item.value}%</span>
        </div>
      ))}
    </div>
  </div>
);

/* -------------------------------
   K-Factor / Virality Curve
-------------------------------- */
export const ViralityChart: React.FC = () => (
  <div className="h-64 bg-zinc-800/30 rounded-xl p-4">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={kFactorSeries}>
        <XAxis 
          dataKey="month" 
          tick={{ fill: '#a1a1aa', fontSize: 12 }} 
          axisLine={{ stroke: '#52525b' }}
          tickLine={{ stroke: '#52525b' }}
        />
        <YAxis 
          tick={{ fill: '#a1a1aa', fontSize: 12 }} 
          domain={[0, 1]} 
          axisLine={{ stroke: '#52525b' }}
          tickLine={{ stroke: '#52525b' }}
        />
        <ReferenceLine y={1} stroke="#e5e7eb" strokeDasharray="4 2" />
        <Line
          type="monotone"
          dataKey="k"
          stroke="#E0FE10"
          strokeWidth={3}
          dot={{ r: 4, strokeWidth: 2, fill: '#18181b', stroke: '#E0FE10' }}
        />
        <Tooltip 
          contentStyle={{ 
            background: '#27272a', 
            border: 'none', 
            color: '#fafafa',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }} 
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

/* -------------------------------
   CAC & Payback Timeline
-------------------------------- */
export const UnitEconChart: React.FC = () => (
  <div className="h-64 bg-zinc-800/30 rounded-xl p-4">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={unitEconomics}>
        <defs>
          <linearGradient id="cac" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E0FE10" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#E0FE10" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="payback" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="month" 
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={{ stroke: '#52525b' }}
          tickLine={{ stroke: '#52525b' }}
        />
        <YAxis 
          yAxisId="left" 
          orientation="left" 
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={{ stroke: '#52525b' }}
          tickLine={{ stroke: '#52525b' }}
        />
        <YAxis 
          yAxisId="right" 
          orientation="right" 
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={{ stroke: '#52525b' }}
          tickLine={{ stroke: '#52525b' }}
        />
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="cac"
          stroke="#E0FE10"
          strokeWidth={3}
          dot={{ r: 4, strokeWidth: 2, fill: '#18181b', stroke: '#E0FE10' }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="payback"
          stroke="#38bdf8"
          strokeWidth={3}
          dot={{ r: 4, strokeWidth: 2, fill: '#18181b', stroke: '#38bdf8' }}
        />
        <Tooltip 
          contentStyle={{ 
            background: '#27272a', 
            border: 'none', 
            color: '#fafafa',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }} 
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

/* ---------------------------------
   User Engagement Analytics
---------------------------------- */
const engagementData = [
  { date: '04', time: 15, sessions: 2.1 },
  { date: '05', time: 12, sessions: 1.8 },
  { date: '06', time: 8, sessions: 1.5 },
  { date: '07', time: 45, sessions: 3.2 },
  { date: '08', time: 38, sessions: 2.9 },
  { date: '09', time: 25, sessions: 2.4 },
  { date: '10', time: 52, sessions: 3.8 },
  { date: '11', time: 68, sessions: 4.2 },
  { date: '12', time: 35, sessions: 2.7 },
  { date: '13', time: 42, sessions: 3.1 },
  { date: '14', time: 58, sessions: 3.9 },
  { date: '15', time: 48, sessions: 3.4 },
  { date: '16', time: 25, sessions: 2.2 },
  { date: '17', time: 18, sessions: 1.9 },
  { date: '18', time: 22, sessions: 2.1 },
  { date: '19', time: 28, sessions: 2.5 },
  { date: '20', time: 35, sessions: 2.8 },
  { date: '21', time: 42, sessions: 3.2 },
  { date: '22', time: 15, sessions: 1.7 },
  { date: '23', time: 8, sessions: 1.2 },
  { date: '24', time: 12, sessions: 1.5 },
  { date: '25', time: 89, sessions: 4.8 },
  { date: '26', time: 35, sessions: 2.9 },
];

export const EngagementChart: React.FC = () => (
  <div className="bg-zinc-800/30 rounded-xl p-6">
    {/* Header with metrics */}
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h5 className="text-blue-400 font-medium text-sm">Average engagement time per active user</h5>
            <div className="w-4 h-4 rounded-full bg-zinc-600 flex items-center justify-center">
              <span className="text-zinc-300 text-xs">?</span>
            </div>
          </div>
          <p className="text-white text-3xl font-bold">1h 29m</p>
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h5 className="text-zinc-400 font-medium text-sm">Engaged sessions per active user</h5>
            <div className="w-4 h-4 rounded-full bg-zinc-600 flex items-center justify-center">
              <span className="text-zinc-300 text-xs">?</span>
            </div>
          </div>
          <p className="text-zinc-400 text-3xl font-bold">4.8</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-zinc-700 rounded">
          <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button className="p-2 hover:bg-zinc-700 rounded">
          <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center ml-2">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    </div>
    
    {/* Chart */}
    <div className="h-64 relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-zinc-400 pr-2">
        <span>2h 13m</span>
        <span>1h 40m</span>
        <span>1h 06m</span>
        <span>33m 20s</span>
        <span>0s</span>
      </div>
      
      <div className="ml-12 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={engagementData}>
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#a1a1aa', fontSize: 12 }} 
              axisLine={{ stroke: '#52525b' }}
              tickLine={{ stroke: '#52525b' }}
              interval={6}
            />
            <YAxis hide domain={[0, 100]} />
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <Line
              type="monotone"
              dataKey="time"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: '#18181b', stroke: '#3B82F6' }}
            />
            <Tooltip 
              contentStyle={{ 
                background: '#27272a', 
                border: 'none', 
                color: '#fafafa',
                borderRadius: '8px'
              }}
              formatter={(value) => [`${value}m`, 'Engagement Time']}
              labelFormatter={(label) => `May ${label}`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
    
    {/* Bottom date label */}
    <div className="text-center mt-2">
      <span className="text-zinc-400 text-sm">May</span>
    </div>
  </div>
); 