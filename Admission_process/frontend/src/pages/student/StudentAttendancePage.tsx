import React, { useState, useEffect } from 'react';
import studentService, {
  StudentSubjectAttendance,
  StudentAttendanceSessionRecord,
} from '../../services/student.service';
import { useAcademicYear } from '../../context/AcademicYearContext';
import {
  CalendarCheck,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Calendar,
  Layers,
} from 'lucide-react';

export const StudentAttendancePage: React.FC = () => {
  const { academicYear } = useAcademicYear();
  const [summary, setSummary] = useState<{
    totalClasses: number;
    attendedClasses: number;
    absentClasses: number;
    excusedClasses: number;
    overallPercentage: number;
    subjects: StudentSubjectAttendance[];
  } | null>(null);

  const [history, setHistory] = useState<StudentAttendanceSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const [summaryRes, historyRes] = await Promise.all([
        studentService.getAttendanceSummary({ academicYear }),
        studentService.getAttendanceHistory({
          subjectId: selectedSubject !== 'ALL' ? selectedSubject : undefined,
          academicYear,
        }),
      ]);

      setSummary(summaryRes);
      setHistory(historyRes.history);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch attendance data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedSubject, academicYear]);

  const filteredHistory = history.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-sm">
        <div className="size-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-neutral-900 dark:text-white text-base">Error Loading Attendance</h3>
        <p className="text-xs text-neutral-500">{error || 'Attendance records could not be retrieved.'}</p>
        <button
          onClick={() => fetchAttendance()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const overallPct = summary.overallPercentage;
  const isShortage = overallPct < 75;

  return (
    <div className="space-y-6">
      {/* ── TOP REFRESH BAR & ATTENDANCE KPI METRICS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-neutral-900 dark:text-white">
            Semester Attendance Summary
          </h2>
          <p className="text-xs text-neutral-500">
            Real-time reflection of faculty attendance entries across subjects
          </p>
        </div>
        <button
          onClick={() => fetchAttendance(true)}
          disabled={refreshing}
          className="self-start sm:self-center flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 shadow-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Records'}</span>
        </button>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Overall Percentage */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
            Overall Attendance
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black ${isShortage ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {overallPct.toFixed(1)}%
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${isShortage ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {isShortage ? 'Shortage (<75%)' : 'Eligible'}
          </span>
        </div>

        {/* Conducted Sessions */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
            Total Sessions
          </span>
          <div className="text-2xl font-black text-neutral-900 dark:text-white">
            {summary.totalClasses}
          </div>
          <span className="text-[11px] text-neutral-400">Class periods held</span>
        </div>

        {/* Present Sessions */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
            Classes Attended
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {summary.attendedClasses}
          </div>
          <span className="text-[11px] text-emerald-500 font-semibold">Marked Present</span>
        </div>

        {/* Absent Sessions */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
            Classes Missed
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {summary.absentClasses}
          </div>
          <span className="text-[11px] text-rose-500 font-semibold">Marked Absent</span>
        </div>
      </div>

      {/* ── SUBJECT-WISE ATTENDANCE ROSTER ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">
              Subject-wise Breakdown
            </h3>
          </div>
          <span className="text-xs text-neutral-500">{summary.subjects.length} Courses</span>
        </div>

        {summary.subjects.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400">
            No subjects with recorded attendance sessions yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] uppercase font-bold text-neutral-500">
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4 text-center">Conducted</th>
                  <th className="py-3 px-4 text-center">Attended</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4 text-center">Percentage</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {summary.subjects.map((s) => {
                  const isSubShortage = s.percentage < 75;
                  return (
                    <tr
                      key={s.subjectId}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-850/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900 dark:text-white">
                          {s.subjectCode}
                        </div>
                        <div className="text-[11px] text-neutral-500">{s.subjectName}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-neutral-700 dark:text-neutral-300">
                        {s.totalSessions}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {s.attendedSessions}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-rose-600 dark:text-rose-400">
                        {s.absentSessions}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-black text-xs px-2.5 py-0.5 rounded-full ${isSubShortage ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>
                          {s.percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`text-[11px] font-bold ${isSubShortage ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {isSubShortage ? '⚠️ Shortage' : '✅ Eligible'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SESSION-BY-SESSION ATTENDANCE LOG / HISTORY ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-600" />
            <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">
              Session-by-Session Attendance History
            </h3>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Subject Select */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Subjects</option>
              {summary.subjects.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.subjectCode} — {s.subjectName}
                </option>
              ))}
            </select>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Records</option>
              <option value="PRESENT">Present Only</option>
              <option value="ABSENT">Absent Only</option>
            </select>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-400 space-y-2">
            <CalendarCheck className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600" />
            <p>No session attendance logs match the selected filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] uppercase font-bold text-neutral-500">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4 text-right">Recorded Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredHistory.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-neutral-50/60 dark:hover:bg-neutral-850/60 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900 dark:text-white">
                      {new Date(item.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                      Period #{item.sessionPeriod}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {item.subjectCode}
                      </span>{' '}
                      <span className="text-neutral-500">• {item.subjectName}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.status === 'PRESENT' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>PRESENT</span>
                        </span>
                      ) : item.status === 'ABSENT' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[11px] font-extrabold">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>ABSENT</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[11px] font-extrabold">
                          <span>EXCUSED</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAttendancePage;
