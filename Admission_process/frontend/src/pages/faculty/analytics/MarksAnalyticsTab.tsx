import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  Award,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  PieChart as PieIcon,
  Layers,
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
import { MarksAnalyticsResult } from '../../../services/faculty.service';

interface MarksAnalyticsTabProps {
  data: MarksAnalyticsResult;
  selectedAssessmentType: 'CIE1' | 'CIE2' | 'SEE';
  onAssessmentTypeChange: (type: 'CIE1' | 'CIE2' | 'SEE') => void;
}

export const MarksAnalyticsTab: React.FC<MarksAnalyticsTabProps> = ({
  data,
  selectedAssessmentType,
  onAssessmentTypeChange,
}) => {
  const { kpis, charts, students, availableAssessments, subject } = data;

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [seeFilter, setSeeFilter] = useState<'ALL' | 'PASS' | 'FAIL' | 'PENDING'>('ALL');
  const [passStatusFilter, setPassStatusFilter] = useState<'ALL' | 'PASS' | 'FAIL' | 'PENDING'>('ALL');
  const [selectedScoreBracket, setSelectedScoreBracket] = useState<{ range: string; min: number; max: number } | null>(null);
  const [sortField, setSortField] = useState<'name' | 'usn' | 'marks' | 'score' | 'finalCie' | 'scaledSee' | 'total'>('marks');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const tableRef = useRef<HTMLDivElement>(null);

  // Reset local filters whenever assessment tab changes
  useEffect(() => {
    setSelectedScoreBracket(null);
    setCategoryFilter('ALL');
    setSeeFilter('ALL');
    setPassStatusFilter('ALL');
    setCurrentPage(1);
  }, [selectedAssessmentType]);

  const getPassingStatusFromName = (name: string): 'PASS' | 'FAIL' | 'PENDING' => {
    const lower = name.toLowerCase();
    if (lower.includes('pending')) return 'PENDING';
    if (lower.includes('below') || lower.includes('fail')) return 'FAIL';
    return 'PASS';
  };

  const handleSelectScoreBracket = (bracket: { range: string; min: number; max: number }) => {
    if (selectedScoreBracket?.range === bracket.range) {
      setSelectedScoreBracket(null);
    } else {
      setSelectedScoreBracket(bracket);
      setSeeFilter('ALL');
      setPassStatusFilter('ALL');
      setCategoryFilter('ALL');
      setCurrentPage(1);
      setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  const handleSelectPassingStatus = (status: 'PASS' | 'FAIL' | 'PENDING') => {
    setSelectedScoreBracket(null);
    setCategoryFilter('ALL');
    if (selectedAssessmentType === 'SEE') {
      if (seeFilter === status) {
        setSeeFilter('ALL');
      } else {
        setSeeFilter(status);
        setCurrentPage(1);
        setTimeout(() => {
          tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    } else {
      if (passStatusFilter === status) {
        setPassStatusFilter('ALL');
      } else {
        setPassStatusFilter(status);
        setCurrentPage(1);
        setTimeout(() => {
          tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  };

  // Counts for SEE filter tabs
  const allCount = students.length;
  const passCount = useMemo(() => students.filter((s) => s.vtuStatus === 'PASS').length, [students]);
  const failCount = useMemo(() => students.filter((s) => s.vtuStatus === 'FAIL').length, [students]);
  const pendingCount = useMemo(
    () => students.filter((s) => s.vtuStatus === 'NOT_ENTERED' || s.externalMarks === null || s.externalMarks === undefined).length,
    [students]
  );

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let result = [...students];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (s) => s.studentName.toLowerCase().includes(q) || s.usn.toLowerCase().includes(q)
      );
    }

    if (selectedScoreBracket) {
      result = result.filter((s) => {
        const mark = selectedAssessmentType === 'SEE'
          ? s.externalMarks
          : selectedAssessmentType === 'CIE1'
          ? s.cie1Marks
          : s.cie2Marks;
        if (mark === null || mark === undefined) return false;
        return mark >= selectedScoreBracket.min && mark <= selectedScoreBracket.max;
      });
    } else if (selectedAssessmentType === 'SEE') {
      if (seeFilter === 'PASS') {
        result = result.filter((s) => s.vtuStatus === 'PASS');
      } else if (seeFilter === 'FAIL') {
        result = result.filter((s) => s.vtuStatus === 'FAIL');
      } else if (seeFilter === 'PENDING') {
        result = result.filter((s) => s.vtuStatus === 'NOT_ENTERED' || s.externalMarks === null || s.externalMarks === undefined);
      }
    } else {
      // In CIE mode
      if (passStatusFilter === 'PASS') {
        result = result.filter((s) => {
          const mark = selectedAssessmentType === 'CIE1' ? s.cie1Marks : s.cie2Marks;
          return mark !== null && mark !== undefined && mark >= kpis.passingMarks;
        });
      } else if (passStatusFilter === 'FAIL') {
        result = result.filter((s) => {
          const mark = selectedAssessmentType === 'CIE1' ? s.cie1Marks : s.cie2Marks;
          return mark !== null && mark !== undefined && mark < kpis.passingMarks;
        });
      } else if (passStatusFilter === 'PENDING') {
        result = result.filter((s) => {
          const mark = selectedAssessmentType === 'CIE1' ? s.cie1Marks : s.cie2Marks;
          return mark === null || mark === undefined;
        });
      } else if (categoryFilter !== 'ALL') {
        result = result.filter((s) => s.performanceCategory.includes(categoryFilter));
      }
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.studentName.localeCompare(b.studentName);
      } else if (sortField === 'usn') {
        cmp = a.usn.localeCompare(b.usn);
      } else if (sortField === 'marks') {
        const valA = selectedAssessmentType === 'SEE'
          ? (a.externalMarks ?? -1)
          : selectedAssessmentType === 'CIE1'
          ? (a.cie1Marks ?? -1)
          : (a.cie2Marks ?? -1);
        const valB = selectedAssessmentType === 'SEE'
          ? (b.externalMarks ?? -1)
          : selectedAssessmentType === 'CIE1'
          ? (b.cie1Marks ?? -1)
          : (b.cie2Marks ?? -1);
        cmp = valA - valB;
      } else if (sortField === 'finalCie') {
        cmp = (a.finalCieMarks ?? -1) - (b.finalCieMarks ?? -1);
      } else if (sortField === 'scaledSee') {
        cmp = (a.seeScaledMarks ?? -1) - (b.seeScaledMarks ?? -1);
      } else if (sortField === 'total') {
        cmp = (a.totalMarks ?? -1) - (b.totalMarks ?? -1);
      } else if (sortField === 'score') {
        cmp = (a.finalScore ?? -1) - (b.finalScore ?? -1);
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [students, searchTerm, categoryFilter, seeFilter, passStatusFilter, selectedScoreBracket, sortField, sortAsc, selectedAssessmentType, kpis.passingMarks]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

  const toggleSort = (field: 'name' | 'usn' | 'marks' | 'score' | 'finalCie' | 'scaledSee' | 'total') => {
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
      {/* ── Assessment Selector Pills ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <Award className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
            Assessment Scope:
          </span>
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex-wrap">
            {availableAssessments.map((a) => (
              <button
                key={a.type}
                onClick={() => {
                  setSelectedScoreBracket(null);
                  onAssessmentTypeChange(a.type);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedAssessmentType === a.type
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <span>{a.label}</span>
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-extrabold ${
                    a.isPublished
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : a.status === 'SAVED' || a.status === 'FINALIZED'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {a.isPublished ? 'Published' : a.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Marks KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Enrolled vs Submitted */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Assessed Students</span>
            <Users className="w-4 h-4 text-violet-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white font-mono">
              {kpis.submittedCount}
            </span>
            <span className="text-xs font-semibold text-neutral-400">/ {kpis.enrolledStudents}</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 font-medium">
            {kpis.pendingCount > 0 ? (
              <button
                onClick={() => handleSelectPassingStatus('PENDING')}
                title="Click to view students with pending marks in table"
                className="hover:underline cursor-pointer text-amber-600 dark:text-amber-400 font-semibold"
              >
                {kpis.pendingCount} marks pending entry
              </button>
            ) : (
              'Complete cohort assessed'
            )}
          </p>
        </div>

        {/* KPI 2: Class Average */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {selectedAssessmentType === 'SEE' ? 'SEE Class Average' : 'Class Average'}
            </span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {kpis.classAverage !== null ? kpis.classAverage : 'N/A'}
            <span className="text-sm font-semibold text-neutral-400"> / {kpis.maximumMarks}</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 font-medium">
            Median: {kpis.medianMark !== null ? kpis.medianMark : 'N/A'}
          </p>
        </div>

        {/* KPI 3: Highest / Lowest Score */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {selectedAssessmentType === 'SEE' ? 'SEE Score Range' : 'Score Range'}
            </span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {kpis.highestMark !== null ? kpis.highestMark : 'N/A'}
            </span>
            <span className="text-xs font-semibold text-neutral-400">
              high / {kpis.lowestMark !== null ? kpis.lowestMark : 'N/A'} low
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 font-medium">
            Spread: {charts.summaryStats.scoreSpread !== null ? `${charts.summaryStats.scoreSpread} marks` : 'N/A'}
          </p>
        </div>

        {/* KPI 4: Pass Count and Rate */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {selectedAssessmentType === 'SEE' ? 'VTU Pass Rate (≥40%)' : 'Pass Rate (40%)'}
            </span>
            {kpis.failCount > 0 ? (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {kpis.passPercentage}%
            </span>
            <button
              onClick={() => handleSelectPassingStatus('PASS')}
              title="Click to view passed students in table"
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              ({kpis.passCount} passed)
            </button>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 font-medium">
            {kpis.failCount > 0 ? (
              <button
                onClick={() => handleSelectPassingStatus('FAIL')}
                title="Click to view failed students in table"
                className="hover:underline cursor-pointer text-amber-600 dark:text-amber-400 font-semibold"
              >
                {selectedAssessmentType === 'SEE'
                  ? `${kpis.failCount} failed VTU criteria`
                  : `${kpis.failCount} below passing (${kpis.passingMarks} marks)`}
              </button>
            ) : (
              selectedAssessmentType === 'SEE'
                ? `0 failed VTU criteria`
                : `0 below passing (${kpis.passingMarks} marks)`
            )}
          </p>
        </div>
      </div>

      {/* ── Charts Row 1: Marks Distribution + Pass/Below-Passing Donut ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Student Marks Distribution Bar Chart / Histogram */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-violet-500" />
                  Score Distribution Histogram ({selectedAssessmentType === 'SEE' ? 'Final SEE Marks' : selectedAssessmentType})
                </h3>
                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                  Number of students grouped into mark brackets out of {kpis.maximumMarks}.{' '}
                  <span className="text-violet-600 dark:text-violet-400 font-semibold cursor-pointer">
                    (Click any bar to view students)
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedScoreBracket && (
                  <button
                    onClick={() => setSelectedScoreBracket(null)}
                    className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 hover:bg-violet-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Reset
                  </button>
                )}
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/70 dark:border-neutral-700">
                  Min Pass: {selectedAssessmentType === 'SEE' ? '35/100' : kpis.passingMarks}
                </span>
              </div>
            </div>

            <div className="h-64 sm:h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.distribution} margin={{ top: 15, right: 15, left: -15, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                  <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="p-3 bg-neutral-900 text-white rounded-xl shadow-xl text-xs space-y-1">
                            <p className="font-bold text-violet-300">Score Range: {d.range}</p>
                            <p className="font-semibold">
                              Students: <span className="font-mono text-white">{d.count}</span>
                            </p>
                            <p className="text-neutral-400">Share: {d.percentage}%</p>
                            <p className="text-[10px] text-violet-300 font-semibold pt-1 border-t border-neutral-800">
                              👉 Click to filter {d.count} students in table
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
                        handleSelectScoreBracket({ range: entry.range, min: entry.min, max: entry.max });
                      }
                    }}
                  >
                    {charts.distribution.map((entry, index) => {
                      const isSelected = selectedScoreBracket?.range === entry.range;
                      const baseColor = entry.max < kpis.passingMarks ? '#ef4444' : '#8b5cf6';
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={baseColor}
                          opacity={selectedScoreBracket ? (isSelected ? 1 : 0.35) : 1}
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
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Below Pass Mark
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" /> &ge; Passing Score
            </span>
          </div>
        </div>

        {/* Chart 4: Pass / Below-Passing Donut Chart */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-500" />
              {selectedAssessmentType === 'SEE' ? 'VTU Passing Classification' : 'Passing Classification'}
            </h3>
            <p className="text-xs text-neutral-400 font-medium mt-0.5">
              {selectedAssessmentType === 'SEE'
                ? 'Based on 3-tier VTU compliance (CIE, SEE, Total).'
                : 'Ratio based on standard 40% institutional academic rule.'}
            </p>

            <div className="h-56 sm:h-64 mt-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.passDistribution}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      if (entry && entry.name) {
                        const status = getPassingStatusFromName(entry.name);
                        handleSelectPassingStatus(status);
                      }
                    }}
                  >
                    {charts.passDistribution.map((entry, index) => {
                      const status = getPassingStatusFromName(entry.name);
                      const isSelected = selectedAssessmentType === 'SEE'
                        ? seeFilter === status
                        : passStatusFilter === status;
                      const hasActiveFilter = selectedAssessmentType === 'SEE'
                        ? seeFilter !== 'ALL'
                        : passStatusFilter !== 'ALL';
                      return (
                        <Cell
                          key={`donut-${index}`}
                          fill={entry.color}
                          opacity={hasActiveFilter && !selectedScoreBracket ? (isSelected ? 1 : 0.35) : 1}
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
            {charts.passDistribution.map((st, i) => {
              const status = getPassingStatusFromName(st.name);
              const isSelected = selectedAssessmentType === 'SEE'
                ? seeFilter === status
                : passStatusFilter === status;
              return (
                <div
                  key={i}
                  onClick={() => handleSelectPassingStatus(status)}
                  className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-neutral-100 dark:bg-neutral-800 font-bold ring-1 ring-neutral-300 dark:ring-neutral-700'
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

      {/* ── Charts Row 2: Assessment Comparison Grouped Bar Chart & Trend (Shown ONLY in Final SEE mode) ─────────── */}
      {selectedAssessmentType === 'SEE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 2: Assessment Comparison Grouped Bar Chart */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-500" />
                Internal & External Assessment Comparison
              </h3>
              <p className="text-xs text-neutral-400 font-medium mt-0.5">
                Side-by-side comparison of class metrics across CIE 1, CIE 2, and Final SEE.
              </p>

              <div className="h-60 sm:h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.assessmentComparison} margin={{ top: 15, right: 15, left: -15, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                    <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="p-3 bg-neutral-900 text-white rounded-xl shadow-xl text-xs space-y-1">
                              <p className="font-bold text-violet-300">{d.metric}</p>
                              <p className="text-violet-200 font-mono">
                                CIE 1: {d.cie1Value !== null ? `${d.cie1Value} ${d.unit}` : 'N/A'}
                              </p>
                              <p className="text-blue-200 font-mono">
                                CIE 2: {d.cie2Value !== null ? `${d.cie2Value} ${d.unit}` : 'N/A'}
                              </p>
                              {d.seeValue !== undefined && (
                                <p className="text-emerald-200 font-mono">
                                  Final SEE: {d.seeValue !== null ? `${d.seeValue} ${d.unit}` : 'Pending'}
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="cie1Value" name="CIE 1" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cie2Value" name="CIE 2" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="seeValue" name="Final SEE" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" /> CIE 1
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> CIE 2
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Final SEE
              </span>
            </div>
          </div>

          {/* Chart 3: Marks Performance Trend Line Chart */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Class Performance Progression
              </h3>
              <p className="text-xs text-neutral-400 font-medium mt-0.5">
                Average score progression across consecutive academic assessments.
              </p>

              <div className="h-60 sm:h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.performanceTrend} margin={{ top: 15, right: 15, left: -15, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                    <XAxis dataKey="assessment" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="p-3 bg-neutral-900 text-white rounded-xl shadow-xl text-xs space-y-1">
                              <p className="font-bold text-emerald-400">{d.assessment}</p>
                              <p className="font-mono">
                                Average Mark:{' '}
                                <span className="text-white font-bold">
                                  {d.averageMark !== null ? `${d.averageMark} / ${d.maxMarks}` : 'Pending'}
                                </span>
                              </p>
                              <p className="text-neutral-400">
                                Normalized Percentage: {d.averagePercentage !== null ? `${d.averagePercentage}%` : 'N/A'}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="averagePercentage"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400">
              Chronological performance progression across internal and external evaluations.
            </div>
          </div>
        </div>
      )}

      {/* ── Student-wise Marks Table ─────────────────────────────────────────────── */}
      <div
        ref={tableRef}
        className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-4 scroll-mt-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              {selectedAssessmentType === 'SEE'
                ? 'VTU Final SEE Examination Marksheet'
                : `${selectedAssessmentType === 'CIE1' ? 'CIE 1' : 'CIE 2'} Assessment Marksheet`}
            </h3>
            <p className="text-xs text-neutral-400 font-medium mt-0.5">
              {selectedAssessmentType === 'SEE'
                ? 'Comprehensive evaluation statement with CIE (50M), Raw SEE (100M), Scaled SEE (50M), Total (100M), and VTU passing status.'
                : `Student marks obtained and completion status for ${selectedAssessmentType === 'CIE1' ? 'CIE 1 Assessment' : 'CIE 2 Assessment'}.`}
            </p>
          </div>

          {/* Table Filters & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={selectedAssessmentType === 'SEE' ? 'Search student by USN or Name...' : 'Search student or USN...'}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 w-48 sm:w-60"
              />
            </div>

            {selectedAssessmentType === 'SEE' ? (
              <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                <button
                  onClick={() => {
                    setSelectedScoreBracket(null);
                    setSeeFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    seeFilter === 'ALL' && !selectedScoreBracket
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  All ({allCount})
                </button>
                <button
                  onClick={() => {
                    setSelectedScoreBracket(null);
                    setSeeFilter('PASS');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    seeFilter === 'PASS'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 shadow-xs'
                      : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                  }`}
                >
                  Pass ({passCount})
                </button>
                <button
                  onClick={() => {
                    setSelectedScoreBracket(null);
                    setSeeFilter('FAIL');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    seeFilter === 'FAIL'
                      ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 shadow-xs'
                      : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
                  }`}
                >
                  Fail ({failCount})
                </button>
                <button
                  onClick={() => {
                    setSelectedScoreBracket(null);
                    setSeeFilter('PENDING');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    seeFilter === 'PENDING'
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 shadow-xs'
                      : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                  }`}
                >
                  Pending ({pendingCount})
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <button
                    onClick={() => {
                      setSelectedScoreBracket(null);
                      setCategoryFilter('ALL');
                      setPassStatusFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      passStatusFilter === 'ALL' && categoryFilter === 'ALL' && !selectedScoreBracket
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    All ({students.length})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedScoreBracket(null);
                      setCategoryFilter('ALL');
                      setPassStatusFilter('PASS');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      passStatusFilter === 'PASS'
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 shadow-xs'
                        : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                    }`}
                  >
                    Passed ({kpis.passCount})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedScoreBracket(null);
                      setCategoryFilter('ALL');
                      setPassStatusFilter('FAIL');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      passStatusFilter === 'FAIL'
                        ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 shadow-xs'
                        : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
                    }`}
                  >
                    Below Passing ({kpis.failCount})
                  </button>
                  {kpis.pendingCount > 0 && (
                    <button
                      onClick={() => {
                        setSelectedScoreBracket(null);
                        setCategoryFilter('ALL');
                        setPassStatusFilter('PENDING');
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        passStatusFilter === 'PENDING'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 shadow-xs'
                          : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                      }`}
                    >
                      Pending ({kpis.pendingCount})
                    </button>
                  )}
                </div>

                <select
                  value={
                    selectedScoreBracket
                      ? `BRACKET_${selectedScoreBracket.range}`
                      : passStatusFilter !== 'ALL'
                      ? `STATUS_${passStatusFilter}`
                      : categoryFilter
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('BRACKET_')) {
                      const rangeStr = val.replace('BRACKET_', '');
                      const found = charts.distribution.find((d) => d.range === rangeStr);
                      if (found) {
                        setSelectedScoreBracket({ range: found.range, min: found.min, max: found.max });
                        setCategoryFilter('ALL');
                        setPassStatusFilter('ALL');
                      }
                    } else if (val.startsWith('STATUS_')) {
                      const status = val.replace('STATUS_', '') as 'PASS' | 'FAIL' | 'PENDING';
                      setSelectedScoreBracket(null);
                      setCategoryFilter('ALL');
                      setPassStatusFilter(status);
                    } else {
                      setSelectedScoreBracket(null);
                      setPassStatusFilter('ALL');
                      setCategoryFilter(val);
                    }
                    setCurrentPage(1);
                  }}
                  className="py-1.5 px-3 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-semibold cursor-pointer"
                >
                  <option value="ALL">More Filters...</option>
                  <optgroup label="Score Brackets">
                    {charts.distribution.map((b) => (
                      <option key={b.range} value={`BRACKET_${b.range}`}>
                        Score Range: {b.range} ({b.count} students)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Performance Categories">
                    <option value="Distinction">Distinction (≥75%)</option>
                    <option value="First Class">First Class (60–74%)</option>
                    <option value="Second Class">Second Class (50–59%)</option>
                    <option value="Pass Class">Pass Class (40–49%)</option>
                    <option value="Below Passing">Below Passing (&lt;40%)</option>
                    <option value="Pending">Pending Marks</option>
                  </optgroup>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Banner */}
        {(selectedScoreBracket ||
          (selectedAssessmentType === 'SEE'
            ? seeFilter !== 'ALL'
            : passStatusFilter !== 'ALL' || categoryFilter !== 'ALL')) && (
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-2xl text-xs text-violet-900 dark:text-violet-200">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span className="font-bold">Active Filter:</span>
              <span className="font-medium">
                {selectedScoreBracket
                  ? `Score Bracket "${selectedScoreBracket.range}"`
                  : selectedAssessmentType === 'SEE'
                  ? `VTU Status: ${seeFilter}`
                  : passStatusFilter !== 'ALL'
                  ? passStatusFilter === 'PASS'
                    ? `Passed (≥${kpis.passingMarks} marks)`
                    : passStatusFilter === 'FAIL'
                    ? `Below Passing (<${kpis.passingMarks} marks)`
                    : 'Pending Marks'
                  : `Performance Category: ${categoryFilter}`}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-violet-200/80 dark:bg-violet-900/60 font-mono font-bold text-[11px]">
                {filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedScoreBracket(null);
                setSeeFilter('ALL');
                setPassStatusFilter('ALL');
                setCategoryFilter('ALL');
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
              {selectedAssessmentType === 'SEE' ? (
                /* ── SEE VTU Table Header matching Screenshot 2 ── */
                <tr className="bg-black text-white font-extrabold uppercase text-[10px] tracking-wider border-b border-neutral-800">
                  <th className="py-3.5 px-3 text-neutral-300 text-center w-12">#</th>
                  <th
                    onClick={() => toggleSort('usn')}
                    className="py-3.5 px-4 cursor-pointer hover:text-neutral-300 select-none text-white"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>USN</span>
                      <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('name')}
                    className="py-3.5 px-4 cursor-pointer hover:text-neutral-300 select-none text-white"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student Name</span>
                      <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3 text-white text-center">Sec</th>
                  <th
                    onClick={() => toggleSort('finalCie')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-neutral-300 select-none text-white"
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <span>Final CIE</span>
                        <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                      </div>
                      <span className="text-[9px] text-neutral-400 font-bold lowercase tracking-normal">max 50m</span>
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('marks')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-violet-200 select-none bg-[#20083B] text-white"
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <span>SEE</span>
                        <ArrowUpDown className="w-3 h-3 text-violet-300" />
                      </div>
                      <span className="text-[9px] text-violet-300 font-bold lowercase tracking-normal">max 100</span>
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('scaledSee')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-neutral-300 select-none text-white"
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <span>Scaled SEE</span>
                        <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                      </div>
                      <span className="text-[9px] text-neutral-400 font-bold lowercase tracking-normal">max 50m</span>
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('total')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-neutral-300 select-none text-white"
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <span>Total Marks</span>
                        <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                      </div>
                      <span className="text-[9px] text-neutral-400 font-bold lowercase tracking-normal">max 100m</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center text-white">
                    <div className="flex flex-col items-center">
                      <span>VTU Passing Status</span>
                      <span className="text-[9px] text-neutral-400 font-bold lowercase tracking-normal">evaluation / remarks</span>
                    </div>
                  </th>
                </tr>
              ) : (
                /* ── CIE Table Header (Shows ONLY selected CIE) ── */
                <tr className="bg-black text-white font-extrabold uppercase text-[11px] tracking-wider border-b border-neutral-800">
                  <th className="py-3.5 px-3 text-neutral-300 w-12 text-center">#</th>
                  <th
                    onClick={() => toggleSort('usn')}
                    className="py-3.5 px-4 cursor-pointer hover:text-neutral-300 select-none text-white"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>USN / ID</span>
                      <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('name')}
                    className="py-3.5 px-4 cursor-pointer hover:text-neutral-300 select-none text-white"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student Name</span>
                      <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3 text-white text-center">Section</th>
                  <th
                    onClick={() => toggleSort('marks')}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-neutral-300 select-none text-white"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{selectedAssessmentType === 'CIE1' ? 'CIE 1 Marks' : 'CIE 2 Marks'}</span>
                      <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center text-white">Score %</th>
                  <th className="py-3.5 px-4 text-center text-white">Status</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={selectedAssessmentType === 'SEE' ? 9 : 7} className="py-8 text-center text-neutral-400">
                    No matching student marks records found.
                  </td>
                </tr>
              ) : selectedAssessmentType === 'SEE' ? (
                /* ── SEE Table Rows matching Screenshot 2 ── */
                paginatedStudents.map((s, idx) => {
                  const sl = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={s.studentId}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 text-center text-neutral-400 font-mono text-[11px]">{sl}</td>
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900 dark:text-white text-xs">
                        {s.usn}
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white uppercase tracking-wide text-xs">
                        {s.studentName}
                      </td>
                      <td className="py-3 px-3 text-center text-neutral-600 dark:text-neutral-400 text-xs">
                        {s.section}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-sm text-neutral-900 dark:text-white">
                        {s.finalCieMarks !== null && s.finalCieMarks !== undefined ? (
                          s.finalCieMarks
                        ) : (
                          <span className="text-neutral-400 font-normal italic text-xs">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {s.externalMarks !== null && s.externalMarks !== undefined ? (
                          <div className="inline-flex items-center justify-center px-4 py-1 rounded-xl border border-violet-300 dark:border-violet-700/60 bg-violet-50/40 dark:bg-violet-950/20 font-mono font-black text-sm text-neutral-900 dark:text-white shadow-xs">
                            {s.externalMarks}
                          </div>
                        ) : (
                          <span className="text-neutral-400 font-mono italic text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-sm text-neutral-700 dark:text-neutral-300">
                        {s.seeScaledMarks !== null && s.seeScaledMarks !== undefined ? (
                          s.seeScaledMarks
                        ) : (
                          <span className="text-neutral-400 font-normal italic text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-sm text-neutral-900 dark:text-white">
                        {s.totalMarks !== null && s.totalMarks !== undefined ? (
                          s.totalMarks
                        ) : (
                          <span className="text-neutral-400 font-normal italic text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {s.vtuStatus === 'PASS' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            PASS
                          </span>
                        ) : s.vtuStatus === 'FAIL' ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700 shadow-xs"
                              title={s.vtuReason}
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              FAIL
                            </span>
                            {s.vtuReason && (
                              <span className="text-[10px] text-rose-500 font-medium max-w-[140px] truncate" title={s.vtuReason}>
                                {s.vtuReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            PENDING
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                /* ── CIE Table Rows (Shows ONLY selected CIE) ── */
                paginatedStudents.map((s, idx) => {
                  const sl = (currentPage - 1) * pageSize + idx + 1;
                  const currentMark = selectedAssessmentType === 'CIE1' ? s.cie1Marks : s.cie2Marks;
                  const currentMax = selectedAssessmentType === 'CIE1' ? (s.cie1Max || kpis.maximumMarks) : (s.cie2Max || kpis.maximumMarks);
                  const scorePct = currentMark !== null && currentMax > 0 ? ((currentMark / currentMax) * 100).toFixed(1) : null;
                  const statusVal = selectedAssessmentType === 'CIE1' ? s.cie1Status : s.cie2Status;

                  return (
                    <tr
                      key={s.studentId}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 text-center text-neutral-400 font-mono text-[11px]">{sl}</td>
                      <td className="py-3 px-4 font-mono text-neutral-500 text-xs">{s.usn}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                        {s.studentName}
                      </td>
                      <td className="py-3 px-3 text-neutral-500 text-center">{s.section}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {currentMark !== null ? (
                          <span
                            className={
                              currentMark >= kpis.passingMarks
                                ? (selectedAssessmentType === 'CIE1' ? 'text-violet-600 dark:text-violet-400' : 'text-blue-600 dark:text-blue-400')
                                : 'text-rose-600 dark:text-rose-400 font-bold'
                            }
                          >
                            {currentMark}
                            <span className="text-neutral-400 text-[10px]">/{currentMax}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-neutral-900 dark:text-white">
                        {scorePct !== null ? `${scorePct}%` : <span className="text-neutral-400">N/A</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {currentMark === null ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700">
                            PENDING
                          </span>
                        ) : currentMark >= kpis.passingMarks ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800">
                            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            FAIL
                          </span>
                        )}
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

export default MarksAnalyticsTab;
