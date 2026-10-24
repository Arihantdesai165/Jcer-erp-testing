import React from 'react';
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface PerformanceChartProps {
  sgpa: number;
  cgpa: number;
  riskLevel: 'AT_RISK' | 'AVERAGE' | 'GOOD' | 'EXCELLENT';
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ sgpa, cgpa, riskLevel }) => {
  const data = [
    {
      name: 'CGPA',
      value: cgpa,
      fill: '#6366f1', // Indigo
    },
    {
      name: 'SGPA',
      value: sgpa,
      fill: '#10b981', // Emerald
    },
  ];

  const getRiskColor = (level: string) => {
    if (level === 'GOOD' || level === 'EXCELLENT') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (level === 'AVERAGE') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const getRiskExplanation = (level: string) => {
    if (level === 'GOOD' || level === 'EXCELLENT') return 'Excellent academic standing. Eligible for honors program.';
    if (level === 'AVERAGE') return 'Average standing. Maintain attendance and score higher in internals.';
    return 'At-risk. Schedule academic counseling. Minimum attendance 75% required.';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
      {/* Radial Chart */}
      <div className="h-[250px] w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="30%"
            outerRadius="90%"
            barSize={14}
            data={data}
            startAngle={180}
            endAngle={-180}
          >
            {/* Angle Axis mapping value from 0 to 10 */}
            <PolarAngleAxis
              type="number"
              domain={[0, 10]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: '#1e293b' }}
              dataKey="value"
              cornerRadius={6}
            />
            <Legend
              iconSize={10}
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      {/* Explanation Details */}
      <div className="space-y-4">
        <div>
          <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Academic Summary</h4>
          <div className="flex space-x-6 mt-2">
            <div>
              <p className="text-2xl font-bold text-white tracking-tight">{cgpa.toFixed(2)}</p>
              <p className="text-slate-500 text-xs">Cumulative GPA</p>
            </div>
            <div className="border-r border-slate-800 h-10"></div>
            <div>
              <p className="text-2xl font-bold text-white tracking-tight">{sgpa.toFixed(2)}</p>
              <p className="text-slate-500 text-xs">Semester GPA</p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Academic Risk Status</h4>
          <span className={`inline-block px-3 py-1 rounded-full border text-xs font-bold ${getRiskColor(riskLevel)}`}>
            {riskLevel}
          </span>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            {getRiskExplanation(riskLevel)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;
