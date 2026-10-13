import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  PieChart as PieIcon,
  Layers,
  Calendar,
  Filter,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { AttendanceAnalyticsResult } from '../../../services/faculty.service';

interface AttendanceAnalyticsTabProps {
  data: AttendanceAnalyticsResult;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

export const AttendanceAnalyticsTab: React.FC<AttendanceAnalyticsTabProps> = ({
  data,
  dateRange,
  onDateRangeChange,
}) => {
  const { kpis, charts, students, defaulters } = data;

  // Search, filter, sorting, and pagination state for student table
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'SHORTAGE'>('ALL');
  const [selectedBracket, setSelectedBracket] = useState<{ range: string; min: number; max: number } | null>(null);
  const [sortField, setSortField] = useState<'name' | 'usn' | 'percentage' | 'absent'>('percentage');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const tableRef = useRef<HTMLDivElement>(null);

  const handleSelectBracket = (bracket: { range: string; min: number; max: number }) => {
    if (selectedBracket?.range === bracket.range) {
      setSelectedBracket(null);
    } else {
      setSelectedBracket(bracket);
      setStatusFilter('ALL');
      setCurrentPage(1);
      setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  const handleSelectStatus = (status: 'ELIGIBLE' | 'SHORTAGE') => {
    if (statusFilter === status && !selectedBracket) {
      setStatusFilter('ALL');
    } else {
      setSelectedBracket(null);
      setStatusFilter(status);
      setCurrentPage(1);
      setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  // Filtered and sorted students
  const filteredStudents = useMemo(() => {
    let result = [...students];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (s) => s.studentName.toLowerCase().includes(q) || s.usn.toLowerCase().includes(q)
      );
    }

    if (selectedBracket) {
      result = result.filter(
        (s) => s.attendancePercentage >= selectedBracket.min && s.attendancePercentage <= selectedBracket.max
      );
    } else if (statusFilter !== 'ALL') {
      result = result.filter((s) => s.status === statusFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.studentName.localeCompare(b.studentName);
      } else if (sortField === 'usn') {
        cmp = a.usn.localeCompare(b.usn);
      } else if (sortField === 'percentage') {
        cmp = a.attendancePercentage - b.attendancePercentage;
      } else if (sortField === 'absent') {
        cmp = a.absentCount - b.absentCount;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [students, searchTerm, statusFilter, selectedBracket, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

  const toggleSort = (field: 'name' | 'usn' | 'percentage' | 'absent') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name' || field === 'usn');
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* ── KPI Cards Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Enrolled Students */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Enrolled Students</span>
            <Users className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
            {kpis.enrolledStudents}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 font-medium">
            Active roster count for cohort
          </p>
        </div>

        {/* KPI 2: Conducted Sessions */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Sessions Conducted</span>
            <CalendarCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
            {kpis.conductedSessions}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 font-medium">
            {kpis.totalAttendanceRecords} individual student records
          </p>
        </div>

        {/* KPI 3: Average Attendance % */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Average Attendance</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div
            className={`text-2xl sm:text-3xl font-black ${
              kpis.averageAttendance >= kpis.threshold
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {kpis.averageAttendance}%
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 font-medium">
            Threshold: &ge; {kpis.threshold}%
          </p>
        </div>

        {/* KPI 4: Threshold Compliance */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Threshold Status</span>
            {kpis.belowThresholdCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <button
              onClick={() => handleSelectStatus('ELIGIBLE')}
              title="Click to view eligible students in table"
              className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              {kpis.meetingThresholdCount}
            </button>
            <span className="text-xs font-semibold text-neutral-400">eligible</span>
            {kpis.belowThresholdCount > 0 && (
              <button
                onClick={() => handleSelectStatus('SHORTAGE')}
                title="Click to view shortage students in table"
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                / {kpis.belowThresholdCount} shortage
              </button>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 font-medium">
            Latest: {kpis.latestRecordedDate || 'N/A'}
          </p>
        </div>
      </div>

      {/* ── Schedule Note Alert if Timetable not configured ──────────────────────── */}
      <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>
            <strong>Scheduled Class Integration:</strong> {kpis.unrecordedSessionsNote}. Conducted class
            count strictly reflects authorized faculty attendance submissions.
          </span>
        </div>
        <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">
          Last Class: {kpis.latestRecordedDate || 'None'}
        </span>
      </div>

      {/* ── Charts Row 1: Attendance Distribution Bar Chart + Status Donut Chart ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Attendance Distribution (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-violet-500" />
                  Student Attendance Distribution
                </h3>
                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                  Number and percentage of enrolled students across attendance percentage brackets.{' '}
                  <span className="text-violet-600 dark:text-violet-400 font-semibold cursor-pointer">
                    (Click any bar to view students)
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedBracket && (
                  <button
                    onClick={() => setSelectedBracket(null)}
                    className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 hover:bg-violet-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Reset
                  </button>
                )}
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/70 dark:border-neutral-700">
                  Threshold: {kpis.threshold}%
                </span>
              </div>
            </div>

            <div className="h-64 sm:h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.distribution} margin={{ top: 15, right: 15, left: -15, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(139, 92, 246, 0.06)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="p-3 bg-neutral-900 text-white rounded-xl shadow-xl border border-neutral-800 text-xs space-y-1">
                            <p className="font-bold text-violet-300">{d.range}</p>
                            <p className="font-semibold">
                              Students: <span className="text-white font-mono">{d.count}</span>
                            </p>
                            <p className="text-neutral-400 font-medium">
                              Share of Cohort: <span className="text-violet-200">{d.percentage}%</span>
                            </p>
                            <p className="text-[10px] text-violet-300 font-semibold pt-1 border-t border-neutral-800">
                              👉 Click bar to filter {d.count} students below
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[6, 6, 0, 0]}
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      if (entry && entry.range) {
                        handleSelectBracket({ range: entry.range, min: entry.min, max: entry.max });
                      }
                    }}
                  >
                    {charts.distribution.map((entry, index) => {
                      const isSelected = selectedBracket?.range === entry.range;
                      const baseColor = entry.max < kpis.threshold ? '#f59e0b' : '#8b5cf6';
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={baseColor}
                          opacity={selectedBracket ? (isSelected ? 1 : 0.35) : 1}
                          stroke={isSelected ? '#000000' : 'none'}
                          strokeWidth={isSelected ? 2.5 : 0}
                          className="cursor-pointer transition-all"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Below {kpis.threshold}% Shortage
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" /> &ge; {kpis.threshold}% Eligible
            </span>
          </div>
        </div>

        {/* Chart 2: Status Donut Chart (1 col) */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-500" />
              Attendance Status Ratio
            </h3>
            <p className="text-xs text-neutral-400 font-medium mt-0.5">
              Students meeting institutional threshold requirement.
            </p>

            <div className="h-56 sm:h-64 mt-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.statusDistribution}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      if (entry && entry.name) {
                        const isShortage = entry.name.toLowerCase().includes('below');
                        handleSelectStatus(isShortage ? 'SHORTAGE' : 'ELIGIBLE');
                      }
                    }}
                  >
                    {charts.statusDistribution.map((entry, index) => {
                      const isShortage = entry.name.toLowerCase().includes('below');
                      const isSelected = !selectedBracket && statusFilter === (isShortage ? 'SHORTAGE' : 'ELIGIBLE');
                      return (
                        <Cell
                          key={`donut-${index}`}
                          fill={entry.color}
                          opacity={statusFilter !== 'ALL' && !selectedBracket ? (isSelected ? 1 : 0.35) : 1}
                          stroke={isSelected ? '#000000' : 'none'}
                          strokeWidth={isSelected ? 2.5 : 0}
                          className="cursor-pointer transition-all"
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="p-3 bg-neutral-900 text-white rounded-xl shadow-xl text-xs space-y-1">
                            <p className="font-bold">{d.name}</p>
                            <p className="font-mono text-white">
                              {d.value} students ({d.percentage}%)
                            </p>
                            <p className="text-[10px] text-emerald-300 font-semibold pt-1 border-t border-neutral-800">
                              👉 Click to filter students in table
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs">
            {charts.statusDistribution.map((st, i) => {
              const isShortage = st.name.toLowerCase().includes('below');
              const isSelected = !selectedBracket && statusFilter === (isShortage ? 'SHORTAGE' : 'ELIGIBLE');
              return (
                <div
                  key={i}
                  onClick={() => handleSelectStatus(isShortage ? 'SHORTAGE' : 'ELIGIBLE')}
                  className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-neutral-100 dark:bg-neutral-800 font-bold'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                    {st.name}
                  </span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-white">
                    {st.value} ({st.percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Charts Row 2: Attendance Trend Line Chart & Session-wise Bars ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Attendance Trend Line Chart */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Chronological Attendance Trend
                </h3>
                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                  Attendance performance across conducted class sessions.
                </p>
              </div>

              {/* Date range filter pills */}
              <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-fit">
                {(['ALL', '30_DAYS', '15_DAYS'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => onDateRangeChange(r)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      dateRange === r
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    {r === 'ALL' ? 'All Sessions' : r === '30_DAYS' ? 'Last 30D' : 'Last 15D'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 sm:h-72 mt-2">
              {charts.trend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                  No attendance session records available for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.trend} margin={{ top: 15, right: 15, left: -15, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      angle={-40}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 9.5, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="p-3 bg-neutral-900 text-white rounded-xl shadow-xl text-xs space-y-1">
                              <p className="font-bold text-blue-400">{d.label}</p>
                              <p className="font-mono">
                                Attendance: <span className="font-bold text-white">{d.attendancePercentage}%</span>
                              </p>
                              <p className="text-neutral-400">
                                Present: {d.presentCount} / {d.totalStudents} students
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="attendancePercentage"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#3b82f6' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400">
            Chronological date order based on actual recorded session submissions.
          </div>
        </div>

        {/* Chart 4: Session-wise Attendance (Present vs Absent) */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              Session-wise Attendance Volumes
            </h3>
            <p className="text-xs text-neutral-400 font-medium mt-0.5">
              Breakdown of students present versus absent for each class.
            </p>

            <div className="h-64 sm:h-72 mt-4">
              {charts.sessionWise.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                  No session volume data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.sessionWise} margin={{ top: 15, right: 15, left: -15, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      angle={-40}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 9.5, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="p-3 bg-neutral-900 text-white rounded-xl shadow-xl text-xs space-y-1">
                              <p className="font-bold text-emerald-400">{d.label}</p>
                              <p className="text-emerald-300 font-mono">Present: {d.presentCount}</p>
                              <p className="text-amber-300 font-mono">Absent: {d.absentCount}</p>
                              <p className="text-white font-bold font-mono">Rate: {d.attendancePercentage}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="presentCount" name="Present" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="absentCount" name="Absent" fill="#f59e0b" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Present Count
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Absent Count
            </span>
          </div>
        </div>
      </div>

      {/* ── Optional Chart 5: Section Comparison (if multi-section) ──────────────── */}
      {charts.sectionComparison && charts.sectionComparison.length > 1 && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-500" />
            Assigned Section Comparison
          </h3>
          <p className="text-xs text-neutral-400 font-medium mt-0.5">
            Attendance comparison across your assigned sections for this subject.
          </p>

          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.sectionComparison} margin={{ top: 15, right: 15, left: -15, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                <XAxis dataKey="section" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 bg-neutral-900 text-white rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-violet-300">{d.section}</p>
                          <p className="font-mono">Attendance: {d.averageAttendance}%</p>
                          <p className="text-neutral-400">Students: {d.studentCount}</p>
                          <p className="text-neutral-400">Sessions: {d.sessionsCount}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="averageAttendance" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Attendance Shortage Alerts Section ───────────────────────────────────── */}
      {defaulters.length > 0 && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-3xl p-6 border border-amber-200/80 dark:border-amber-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-950 dark:text-amber-200">
                  Attendance Shortage Alerts ({defaulters.length} Students Below {kpis.threshold}%)
                </h3>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 font-medium">
                  The following enrolled students require academic remediation or counseling.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800">
              Immediate Action Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {defaulters.map((d) => (
              <div
                key={d.studentId}
                className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-amber-200/70 dark:border-amber-900/50 flex flex-col justify-between space-y-2 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-neutral-900 dark:text-white truncate">
                      {d.studentName}
                    </span>
                    <span className="text-xs font-black font-mono text-amber-600 dark:text-amber-400">
                      {d.attendancePercentage}%
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
                    {d.usn} • {d.section}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-neutral-100 dark:border-neutral-800 text-neutral-500">
                  <span>
                    {d.presentCount}/{d.totalSessions} classes attended
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    -{d.shortageDelta}% from target
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Student-wise Attendance Table ────────────────────────────────────────── */}
      <div
        ref={tableRef}
        className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-4 scroll-mt-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              Student Attendance Register
            </h3>
            <p className="text-xs text-neutral-400 font-medium mt-0.5">
              Comprehensive student session counts, attendance percentages, and threshold statuses.
            </p>
          </div>

          {/* Table Filters & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or USN..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 w-48 sm:w-56"
              />
            </div>

            {/* Status / Bracket Filter Dropdown */}
            <select
              value={selectedBracket ? `BRACKET_${selectedBracket.range}` : statusFilter}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('BRACKET_')) {
                  const rangeStr = val.replace('BRACKET_', '');
                  const found = charts.distribution.find((d) => d.range === rangeStr);
                  if (found) {
                    setSelectedBracket({ range: found.range, min: found.min, max: found.max });
                    setStatusFilter('ALL');
                  }
                } else {
                  setSelectedBracket(null);
                  setStatusFilter(val as any);
                }
                setCurrentPage(1);
              }}
              className="py-1.5 px-3 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-semibold cursor-pointer"
            >
              <option value="ALL">All Statuses ({students.length})</option>
              <option value="ELIGIBLE">Eligible (&ge;{kpis.threshold}%)</option>
              <option value="SHORTAGE">Shortage (&lt;{kpis.threshold}%)</option>
              <optgroup label="Attendance Brackets">
                {charts.distribution.map((b) => (
                  <option key={b.range} value={`BRACKET_${b.range}`}>
                    Bracket: {b.range} ({b.count} students)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Active Filter Banner */}
        {(selectedBracket || statusFilter !== 'ALL') && (
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-2xl text-xs text-violet-900 dark:text-violet-200">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span className="font-bold">Active Filter:</span>
              <span className="font-medium">
                {selectedBracket
                  ? `Attendance Bracket "${selectedBracket.range}"`
                  : statusFilter === 'SHORTAGE'
                  ? `Shortage (<${kpis.threshold}%)`
                  : `Eligible (≥${kpis.threshold}%)`}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-violet-200/80 dark:bg-violet-900/60 font-mono font-bold text-[11px]">
                {filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedBracket(null);
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1 font-bold text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-white px-2.5 py-1 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors cursor-pointer text-xs"
            >
              <X className="w-3.5 h-3.5" />
              Clear Filter (Show All {students.length})
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-black text-white font-extrabold uppercase text-[11px] tracking-wider border-b border-neutral-800">
                <th className="py-3.5 px-4 text-neutral-300">#</th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3.5 px-4 cursor-pointer hover:text-neutral-300 select-none text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Student Name</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('usn')}
                  className="py-3.5 px-4 cursor-pointer hover:text-neutral-300 select-none text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>USN / ID</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-white">Section</th>
                <th className="py-3.5 px-4 text-center text-white">Conducted</th>
                <th className="py-3.5 px-4 text-center text-white">Present</th>
                <th
                  onClick={() => toggleSort('absent')}
                  className="py-3.5 px-4 text-center cursor-pointer hover:text-neutral-300 select-none text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Absent</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('percentage')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-neutral-300 select-none text-white"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Attendance %</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center text-white">Status</th>
                <th className="py-3.5 px-4 text-right text-white">Last Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-neutral-400">
                    No matching student attendance records found.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s, idx) => {
                  const sl = (currentPage - 1) * pageSize + idx + 1;
                  const isShortage = s.status === 'SHORTAGE';

                  return (
                    <tr
                      key={s.studentId}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-neutral-400 font-mono text-[11px]">{sl}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                        {s.studentName}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-500">{s.usn}</td>
                      <td className="py-3 px-4 text-neutral-500">{s.section}</td>
                      <td className="py-3 px-4 text-center font-mono">{s.totalSessions}</td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {s.presentCount}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-amber-600 dark:text-amber-400 font-bold">
                        {s.absentCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={`${
                            isShortage
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {s.attendancePercentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            isShortage
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {isShortage ? 'Shortage' : 'Eligible'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-neutral-400 text-[11px]">
                        {s.lastRecordedDate || 'N/A'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-2">
          <span>
            Showing {filteredStudents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceAnalyticsTab;
