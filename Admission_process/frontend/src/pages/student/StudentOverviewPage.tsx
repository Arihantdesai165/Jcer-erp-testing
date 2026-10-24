import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import studentService, {
  StudentOverviewData,
  StudentAttendanceHistoryData,
} from '../../services/student.service';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import {
  CalendarCheck,
  Award,
  BookOpen,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  RefreshCw,
  Calendar,
  Search,
  Maximize2,
  ChevronRight,
  Activity,
  Layers,
  Sparkles,
  BarChart3,
  WifiOff,
} from 'lucide-react';

interface ChartPoint {
  id: string;
  label: string;
  subLabel?: string;
  x: number;
  attendance: number;
  marks?: number | null;
  totalSessions?: number;
  attendedSessions?: number;
  status?: string;
}

export const StudentOverviewPage: React.FC = () => {
  const { academicYear } = useAcademicYear();
  const [data, setData] = useState<StudentOverviewData | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<StudentAttendanceHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter for "Select a course"
  const [courseSearch, setCourseSearch] = useState('');

  // Chart view mode: 'subjects' | 'timeline'
  const [chartMode, setChartMode] = useState<'subjects' | 'timeline'>('subjects');

  // Hovered point index for tooltip (null by default so graph starts clean)
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Accessible data breakdown view toggle for screen readers and small screens
  const [showAccessibleTable, setShowAccessibleTable] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overviewRes, historyRes] = await Promise.all([
        studentService.getOverview({ academicYear }),
        studentService.getAttendanceHistory({ academicYear }).catch(() => ({ totalRecords: 0, history: [] })),
      ]);
      setData(overviewRes);
      setAttendanceHistory(historyRes);
    } catch (err: any) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('You are offline. Reconnect to view the latest attendance and academic information.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to load academic overview.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [academicYear]);

  const student = data?.student;
  const attendanceSummary = data?.attendanceSummary;
  const publishedMarksSummary = data?.publishedMarksSummary;
  const overallAtt = attendanceSummary?.overallPercentage ?? 0;
  const isAttShortage = overallAtt < 75 && (attendanceSummary?.totalClasses ?? 0) > 0;

  // Real enrolled subjects from database (STRICTLY NO DUMMY DATA)
  const rawSubjects = attendanceSummary?.subjects || [];

  const filteredCourses = rawSubjects.filter((subj) =>
    subj.subjectName.toLowerCase().includes(courseSearch.toLowerCase()) ||
    subj.subjectCode.toLowerCase().includes(courseSearch.toLowerCase())
  );

  // Real attendance history records from database (STRICTLY NO DUMMY DATA)
  const historyRecords = attendanceHistory?.history || [];

  // Map 0-100 values to SVG Y coordinates (canvas height: 240, top: 25, bottom: 200)
  const getY = (val: number) => {
    const minVal = 0;
    const maxVal = 100;
    const topY = 25;
    const bottomY = 195;
    const clamped = Math.max(0, Math.min(100, val));
    return bottomY - ((clamped - minVal) / (maxVal - minVal)) * (bottomY - topY);
  };

  // Generate clean straight line SVG path from points
  const generateLinePath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    return pts.map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  };

  // Build REAL dynamic chart points based on active mode
  const chartPoints: ChartPoint[] = useMemo(() => {
    if (chartMode === 'subjects') {
      if (rawSubjects.length === 0) return [];

      const count = rawSubjects.length;
      const startX = count === 1 ? 350 : 80;
      const endX = 640;
      const step = count > 1 ? (endX - startX) / (count - 1) : 0;

      return rawSubjects.map((subj, idx) => {
        // Find matching published assessment marks for this subject if any
        const matchingAssessments = publishedMarksSummary?.assessments.filter(
          (a) => a.subjectCode === subj.subjectCode
        ) || [];
        const avgMarks = matchingAssessments.length > 0
          ? matchingAssessments.reduce((acc, a) => acc + (a.percentage || 0), 0) / matchingAssessments.length
          : null;

        return {
          id: subj.subjectId,
          label: subj.subjectCode,
          subLabel: subj.subjectName,
          x: startX + idx * step,
          attendance: Math.round(subj.percentage),
          marks: avgMarks !== null ? Math.round(avgMarks) : null,
          totalSessions: subj.totalSessions,
          attendedSessions: subj.attendedSessions,
          status: subj.status,
        };
      });
    }

    // chartMode === 'timeline': Group real history by unique dates (last 7 recorded dates)
    if (historyRecords.length === 0) return [];

    const dateMap: Record<string, { total: number; attended: number }> = {};
    for (const rec of historyRecords) {
      if (!dateMap[rec.date]) {
        dateMap[rec.date] = { total: 0, attended: 0 };
      }
      dateMap[rec.date].total += 1;
      if (rec.status === 'PRESENT' || rec.status === 'EXCUSED') {
        dateMap[rec.date].attended += 1;
      }
    }

    const uniqueDates = Object.keys(dateMap).sort().slice(-7);
    if (uniqueDates.length === 0) return [];

    const count = uniqueDates.length;
    const startX = count === 1 ? 350 : 80;
    const endX = 640;
    const step = count > 1 ? (endX - startX) / (count - 1) : 0;

    return uniqueDates.map((dateStr, idx) => {
      const stats = dateMap[dateStr];
      const pct = stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0;
      // Format as "MMM d" e.g. "Oct 12"
      const d = new Date(dateStr);
      const formattedDate = isNaN(d.getTime())
        ? dateStr
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        id: dateStr,
        label: formattedDate,
        subLabel: `${stats.attended}/${stats.total} sessions`,
        x: startX + idx * step,
        attendance: pct,
        marks: null,
        totalSessions: stats.total,
        attendedSessions: stats.attended,
        status: pct >= 75 ? 'Present' : 'Absent',
      };
    });
  }, [chartMode, rawSubjects, publishedMarksSummary, historyRecords]);

  // Active point for tooltip on hover
  const activePoint = hoveredPointIndex !== null && chartPoints[hoveredPointIndex] ? chartPoints[hoveredPointIndex] : null;

  // Compute straight line SVG paths from real points
  const attendancePts = useMemo(() => chartPoints.map((p) => ({ x: p.x, y: getY(p.attendance) })), [chartPoints]);
  const attendancePath = useMemo(() => generateLinePath(attendancePts), [attendancePts]);

  const areaPath = useMemo(() => {
    if (chartPoints.length === 0 || attendancePts.length === 0) return '';
    const firstX = chartPoints[0].x;
    const lastX = chartPoints[chartPoints.length - 1].x;
    const bottomY = 195;
    const linePath = generateLinePath(attendancePts);
    if (!linePath) return '';
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [chartPoints, attendancePts]);

  // Points with marks
  const marksPts = useMemo(
    () =>
      chartPoints
        .filter((p) => p.marks !== null && p.marks !== undefined)
        .map((p) => ({ x: p.x, y: getY(p.marks!) })),
    [chartPoints]
  );
  const marksPath = useMemo(() => generateLinePath(marksPts), [marksPts]);

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-28 sm:h-32 bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 sm:h-28 bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-5 h-80 sm:h-96 bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 rounded-3xl animate-pulse" />
          <div className="lg:col-span-7 h-80 sm:h-96 bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    return (
      <div className="bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 max-w-lg mx-auto mt-6 sm:mt-12 shadow-sm">
        <div
          className={`size-12 rounded-2xl flex items-center justify-center mx-auto ${
            isOffline
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
          }`}
        >
          {isOffline ? <WifiOff className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
        </div>
        <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
          {isOffline ? 'You Are Offline' : 'Unable to Load Overview'}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {error ||
            (isOffline
              ? 'Please reconnect to view the latest attendance and academic information.'
              : 'Student academic profile could not be retrieved.')}
        </p>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-neutral-100 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isOffline ? 'Try Reconnecting' : 'Retry'}</span>
        </button>
      </div>
    );
  }

  // Academic status based strictly on real attendance records
  const hasClasses = (attendanceSummary?.totalClasses ?? 0) > 0;
  const academicStatusLabel = !hasClasses
    ? 'Enrolled'
    : isAttShortage
    ? 'Shortage Alert'
    : 'Good Standing';
  const academicStatusDesc = !hasClasses
    ? 'Awaiting session commencement'
    : isAttShortage
    ? `${attendanceSummary?.absentClasses || 0} sessions marked absent`
    : `${attendanceSummary?.attendedClasses || 0}/${attendanceSummary?.totalClasses || 0} classes attended`;

  return (
    <div className="space-y-6">
      {/* ── ADMISSION APPLICATION ACTIVE BANNER (If applicable) ── */}
      {data.isAdmissionApplicant && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 border-2 border-amber-500/40 dark:border-amber-500/30 rounded-3xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm">
                    Admission Application Active
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                    Status: {data.admissionStatus || 'In Progress'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed font-medium">
                  Your identity is registered in the JCER ERP System. Track admission details directly on the Admission Portal.
                </p>
              </div>
            </div>

            <Link
              to={data.admissionDashboardUrl || '/admission/dashboard'}
              className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex-shrink-0"
            >
              <span>Go to Admission Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ── 1. STUDENT COCKPIT WELCOME CARD ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <ProfileAvatar
            name={student?.name || 'Student'}
            size="lg"
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-slate-100 dark:border-neutral-700 shadow-xs flex-shrink-0"
          />
          <div className="space-y-0.5 min-w-0">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500 block">
              STUDENT COCKPIT
            </span>
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              Welcome back, {student?.name || 'Student'}! 👋
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400 font-medium">
              <span className="truncate max-w-[220px]">
                Dept of {student?.department?.name || 'Academic Department'}
              </span>
              <span>•</span>
              <span>Semester {student?.semester || 1}</span>
              {student?.section && (
                <>
                  <span>•</span>
                  <span>Section {student.section}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Today's Date Box */}
        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 self-start sm:self-auto shrink-0">
          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
          <div>
            <span className="block text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400">
              TODAY'S DATE
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. KPI STAT CARDS (STRICTLY REAL DATA, 2-COLUMN ON MOBILE) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Overall Attendance */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 truncate">
              OVERALL ATTENDANCE
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {hasClasses ? `${overallAtt.toFixed(1)}%` : '0.0%'}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-neutral-400 font-medium mt-0.5 flex items-center gap-1 truncate">
              <span
                className={`inline-block size-1.5 rounded-full shrink-0 ${
                  !hasClasses ? 'bg-slate-300' : isAttShortage ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <span className="truncate">
                {!hasClasses
                  ? '0 sessions held'
                  : isAttShortage
                  ? 'Shortage (<75%)'
                  : 'Eligible (≥75%)'}
              </span>
            </p>
          </div>
        </div>

        {/* Card 2: Academic Status */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 truncate">
              ACADEMIC STATUS
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {academicStatusLabel}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-neutral-400 font-medium mt-0.5 truncate">
              {academicStatusDesc}
            </p>
          </div>
        </div>

        {/* Card 3: Current Courses */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 truncate">
              CURRENT COURSES
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {rawSubjects.length} {rawSubjects.length === 1 ? 'Course' : 'Courses'}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-neutral-400 font-medium mt-0.5 truncate">
              Sem {student?.semester || 1} Curriculum
            </p>
          </div>
        </div>

        {/* Card 4: Published CIEs */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 truncate">
              PUBLISHED CIES
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {publishedMarksSummary?.totalAssessmentsPublished || 0} Assessments
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-neutral-400 font-medium mt-0.5 truncate">
              {(publishedMarksSummary?.totalAssessmentsPublished || 0) > 0
                ? 'Approved by Dept HOD'
                : 'No CIEs published'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. LOWER SECTION: Enrolled Courses + Academic Performance Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* LEFT COLUMN: Enrolled Courses (5/12) */}
        <div className="lg:col-span-5 bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Enrolled Courses
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 dark:text-neutral-500">
                Real-time subject attendance records
              </p>
            </div>
            <Link
              to="/student/attendance"
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-neutral-700 flex items-center justify-center transition cursor-pointer"
              title="View full attendance breakdown"
              aria-label="View full attendance breakdown"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Search Input Bar */}
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search by code or course name..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="w-full pl-3.5 pr-11 py-2.5 bg-slate-50 dark:bg-neutral-800/70 border border-slate-200/80 dark:border-neutral-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
            />
            <div className="absolute right-1.5 w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Search className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Courses List (STRICTLY REAL DATA) */}
          <div className="space-y-2.5 sm:space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {rawSubjects.length === 0 ? (
              <div className="py-10 px-4 text-center rounded-2xl bg-slate-50/50 dark:bg-neutral-850/50 border border-dashed border-slate-200 dark:border-neutral-800 space-y-2">
                <BookOpen className="w-8 h-8 text-slate-300 dark:text-neutral-600 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No courses recorded yet
                </p>
                <p className="text-[11px] text-slate-400">
                  Attendance logs for Semester {student?.semester || 1} will appear here once recorded by faculty.
                </p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No courses match "{courseSearch}"
              </div>
            ) : (
              filteredCourses.map((subj) => {
                const isShortage = subj.percentage < 75 && subj.totalSessions > 0;
                return (
                  <div
                    key={subj.subjectId}
                    className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 dark:bg-neutral-800/40 dark:hover:bg-neutral-800/80 border border-slate-200/60 dark:border-neutral-700/60 transition group space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                          {subj.subjectName}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">{subj.subjectCode}</span> • {subj.totalSessions} {subj.totalSessions === 1 ? 'period' : 'periods'} held
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                          subj.totalSessions === 0
                            ? 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-slate-400'
                            : isShortage
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {subj.totalSessions > 0 ? `${subj.percentage.toFixed(0)}% Att.` : 'No sessions'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400 pt-1.5 border-t border-slate-200/40 dark:border-neutral-700/40">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{subj.attendedSessions}/{subj.totalSessions} attended</span>
                      </span>
                      <Link
                        to="/student/attendance"
                        className="min-h-[32px] px-2 py-1 -mr-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACADEMIC PERFORMANCE (STRICTLY REAL DATA) */}
        <div className="lg:col-span-7 bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Academic Performance
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 dark:text-neutral-500">
                Subject-wise attendance and CIE marks
              </p>
            </div>

            {/* Toggle Modes: Subject Breakdown vs Session History */}
            <div className="flex items-center space-x-1.5 self-stretch sm:self-auto bg-slate-100 dark:bg-neutral-800 p-1 rounded-2xl border border-slate-200/60 dark:border-neutral-700/60">
              <button
                type="button"
                onClick={() => {
                  setChartMode('subjects');
                  setHoveredPointIndex(null);
                }}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'subjects'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Subject Breakdown
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartMode('timeline');
                  setHoveredPointIndex(null);
                }}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'timeline'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Session History
              </button>
            </div>
          </div>

          {/* Legend row: Real metrics */}
          <div className="flex items-center flex-wrap gap-5 text-xs font-semibold text-slate-600 dark:text-slate-300 pt-1">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-0.5 bg-indigo-600 rounded-full" />
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 -ml-2" />
              <span>Attendance Rate (%)</span>
            </div>
            {chartMode === 'subjects' && publishedMarksSummary && publishedMarksSummary.totalAssessmentsPublished > 0 && (
              <div className="flex items-center space-x-2">
                <span className="w-3 h-0.5 bg-emerald-500 rounded-full" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 -ml-2" />
                <span>Published CIE Marks (%)</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 font-bold">75% VTU Cutoff</span>
            </div>
          </div>

          {/* SVG Simple Line Graph */}
          <div
            className="relative pt-6 pb-2 w-full select-none min-h-[260px] flex items-center justify-center"
            onMouseLeave={() => setHoveredPointIndex(null)}
          >
            {chartPoints.length === 0 ? (
              <div className="py-14 px-6 text-center rounded-2xl bg-slate-50/50 dark:bg-neutral-850/50 border border-dashed border-slate-200 dark:border-neutral-800 w-full space-y-2.5 animate-in fade-in duration-300">
                <Activity className="w-8 h-8 text-slate-300 dark:text-neutral-600 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No attendance records logged yet
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  As your subject faculties record classroom attendance sessions, your performance line graph will display here.
                </p>
              </div>
            ) : (
              <>
                <svg
                  viewBox="0 0 700 240"
                  className="w-full h-64 overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="attendanceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.10" />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines: 100%, 75% cutoff, 50%, 25%, 0% */}
                  <g className="stroke-slate-200/70 dark:stroke-neutral-800" strokeWidth="1">
                    <line x1="50" y1="25" x2="650" y2="25" strokeDasharray="3 3" />
                    <line x1="50" y1={getY(75)} x2="650" y2={getY(75)} stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.8" />
                    <line x1="50" y1={getY(50)} x2="650" y2={getY(50)} strokeDasharray="3 3" />
                    <line x1="50" y1={getY(25)} x2="650" y2={getY(25)} strokeDasharray="3 3" />
                    <line x1="50" y1="195" x2="650" y2="195" strokeWidth="1.2" className="stroke-slate-300 dark:stroke-neutral-700" />
                  </g>

                  {/* Y-axis Labels on Left: 100%, 75%, 50%, 25%, 0% */}
                  <g className="fill-slate-400 text-[10px] font-medium" textAnchor="end">
                    <text x="42" y="29">100%</text>
                    <text x="42" y={getY(75) + 3} className="fill-amber-500 font-bold">75%</text>
                    <text x="42" y={getY(50) + 3}>50%</text>
                    <text x="42" y={getY(25) + 3}>25%</text>
                    <text x="42" y="199">0%</text>
                  </g>

                  {/* Subtle translucent fill under attendance line */}
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill="url(#attendanceAreaGradient)"
                    />
                  )}

                  {/* Vertical guide line on hovered point */}
                  {activePoint && (
                    <line
                      x1={activePoint.x}
                      y1="25"
                      x2={activePoint.x}
                      y2="195"
                      stroke="#6366F1"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      opacity="0.6"
                    />
                  )}

                  {/* CIE Marks Line (clean straight line) */}
                  {marksPath && (
                    <path
                      d={marksPath}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Attendance Line (clean straight line) */}
                  {attendancePath && (
                    <path
                      d={attendancePath}
                      fill="none"
                      stroke="#4F46E5"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Marks Data Nodes */}
                  {chartPoints.map((p, idx) => {
                    if (p.marks === null || p.marks === undefined) return null;
                    const isHovered = hoveredPointIndex === idx;
                    const ptY = getY(p.marks);
                    return (
                      <circle
                        key={`m-${p.id}`}
                        cx={p.x}
                        cy={ptY}
                        r={isHovered ? 5 : 3.5}
                        fill="#10B981"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="pointer-events-none transition-all duration-150"
                      />
                    );
                  })}

                  {/* Attendance Data Nodes & Direct Value Badges */}
                  {chartPoints.map((p, idx) => {
                    const isHovered = hoveredPointIndex === idx;
                    const ptY = getY(p.attendance);
                    const labelY = p.attendance >= 85 ? ptY + 16 : ptY - 8;

                    return (
                      <g key={p.id}>
                        {/* Attendance Dot Node */}
                        <circle
                          cx={p.x}
                          cy={ptY}
                          r={isHovered ? 6 : 4.5}
                          className="transition-all duration-150"
                          fill={isHovered ? '#4F46E5' : '#ffffff'}
                          stroke="#4F46E5"
                          strokeWidth={isHovered ? 3 : 2}
                        />

                        {/* Direct readable percentage above/below node */}
                        <text
                          x={p.x}
                          y={labelY}
                          textAnchor="middle"
                          className={`text-[10px] select-none pointer-events-none ${
                            isHovered
                              ? 'fill-indigo-600 dark:fill-indigo-400 font-extrabold'
                              : 'fill-slate-600 dark:fill-slate-300 font-semibold'
                          }`}
                        >
                          {p.attendance}%
                        </text>
                      </g>
                    );
                  })}

                  {/* X-axis Labels */}
                  <g className="fill-slate-400 text-[11px] font-semibold" textAnchor="middle">
                    {chartPoints.map((p, idx) => {
                      const isHovered = hoveredPointIndex === idx;
                      return (
                        <text
                          key={p.id}
                          x={p.x}
                          y="218"
                          className={`cursor-pointer transition-colors duration-150 ${
                            isHovered
                              ? 'fill-indigo-600 dark:fill-indigo-400 font-extrabold text-[12px]'
                              : 'fill-slate-600 dark:fill-slate-400 hover:fill-slate-900 dark:hover:fill-white font-medium'
                          }`}
                          onClick={() => setHoveredPointIndex(idx)}
                        >
                          {p.label}
                        </text>
                      );
                    })}
                  </g>

                  {/* Transparent hover hitboxes for effortless interactivity */}
                  {chartPoints.map((p, idx) => (
                    <rect
                      key={p.id}
                      x={p.x - 30}
                      y="15"
                      width="60"
                      height="200"
                      fill="transparent"
                      className="cursor-pointer"
                      onClick={() => setHoveredPointIndex(idx)}
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                    />
                  ))}
                </svg>

                {/* Floating Tooltip Card: only shown when hovering a point */}
                {activePoint && (
                  <div
                    className="absolute bg-white dark:bg-neutral-850 rounded-xl shadow-lg border border-slate-200/90 dark:border-neutral-700 p-3 text-xs pointer-events-none transition-all duration-150 z-20"
                    style={{
                      left: `${(activePoint.x / 700) * 100}%`,
                      top: `${Math.max(6, (getY(activePoint.attendance) / 240) * 100 - 8)}%`,
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="font-extrabold text-slate-900 dark:text-white">
                        {activePoint.label}
                      </p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          activePoint.attendance >= 75
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {activePoint.attendance >= 75 ? 'Eligible' : 'Shortage'}
                      </span>
                    </div>

                    {activePoint.subLabel && (
                      <p className="text-[10px] text-slate-400 truncate max-w-[170px] mb-1.5 font-medium">
                        {activePoint.subLabel}
                      </p>
                    )}

                    <div className="space-y-1 text-[11px] font-medium border-t border-slate-100 dark:border-neutral-750 pt-1.5">
                      <p className="text-slate-600 dark:text-slate-300 flex justify-between gap-3">
                        <span>Attendance:</span>
                        <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                          {activePoint.attendance}%
                        </strong>
                      </p>

                      {activePoint.totalSessions !== undefined && (
                        <p className="text-slate-600 dark:text-slate-300 flex justify-between gap-3 text-[10px]">
                          <span>Classes Attended:</span>
                          <strong>
                            {activePoint.attendedSessions} / {activePoint.totalSessions}
                          </strong>
                        </p>
                      )}

                      {activePoint.marks !== null && activePoint.marks !== undefined && (
                        <p className="text-slate-600 dark:text-slate-300 flex justify-between gap-3">
                          <span>Published CIE:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {activePoint.marks}%
                          </strong>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Accessible Data Breakdown & Text Summary for Mobile and Screen Readers */}
          {chartPoints.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAccessibleTable((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-cyan-400 hover:underline cursor-pointer"
                aria-expanded={showAccessibleTable}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {showAccessibleTable
                    ? 'Hide Performance Data Table'
                    : 'View Performance Data Table'}
                </span>
              </button>

              {showAccessibleTable && (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-850/50 p-2 animate-in fade-in">
                  <table className="w-full text-left text-xs min-w-[280px]">
                    <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200/60 dark:border-neutral-800">
                      <tr>
                        <th className="py-2 px-2.5">
                          {chartMode === 'subjects' ? 'Subject' : 'Session Date'}
                        </th>
                        <th className="py-2 px-2.5">Attendance</th>
                        {chartMode === 'subjects' && <th className="py-2 px-2.5">CIE Marks</th>}
                        <th className="py-2 px-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40 dark:divide-neutral-800/40 font-medium">
                      {chartPoints.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-2.5">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {p.label}
                            </span>
                            {p.subLabel && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                                {p.subLabel}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 font-bold text-indigo-600 dark:text-indigo-400">
                            {p.attendance}%
                            {p.totalSessions !== undefined && (
                              <span className="text-[10px] text-slate-400 font-normal block">
                                ({p.attendedSessions}/{p.totalSessions})
                              </span>
                            )}
                          </td>
                          {chartMode === 'subjects' && (
                            <td className="py-2 px-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                              {p.marks !== null && p.marks !== undefined ? `${p.marks}%` : '—'}
                            </td>
                          )}
                          <td className="py-2 px-2.5">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                p.attendance >= 75
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {p.attendance >= 75 ? 'Eligible' : 'Shortage'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentOverviewPage;
