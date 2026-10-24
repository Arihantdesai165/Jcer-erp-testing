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

      {/* ── SUBJECT-WISE ATTENDANCE ROSTER (SEMESTER GROUPED) ── */}
      <div className="space-y-6">
        {summary.subjects.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-12 text-center space-y-3 shadow-xs">
            <Clock className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto" />
            <h3 className="font-extrabold text-neutral-800 dark:text-neutral-200 text-sm">
              Attendance Records Are Not Yet Released
            </h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              Attendance records for your cohort are currently undergoing HOD review and have not yet been released. Officially released attendance from the consolidated semester register will appear here once published.
            </p>
          </div>
        ) : (
          (() => {
            const semGroups: Record<number, { semester: number; academicYear?: string; subjects: StudentSubjectAttendance[] }> = {};
            for (const sub of summary.subjects) {
              const sem = sub.semester || 1;
              if (!semGroups[sem]) {
                semGroups[sem] = {
                  semester: sem,
                  academicYear: sub.academicYear,
                  subjects: [],
                };
              }
              semGroups[sem].subjects.push(sub);
            }

            const sortedGroups = Object.values(semGroups).sort((a, b) => a.semester - b.semester);

            return sortedGroups.map((grp) => (
              <div
                key={grp.semester}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xs overflow-hidden"
              >
                {/* Semester Heading Banner */}
                <div className="p-5 sm:px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-neutral-900 dark:text-white">
                        Semester {grp.semester}
                      </h3>
                      <span className="text-[11px] text-neutral-500 font-medium">
                        Academic Year {grp.academicYear || '2026-27'} • {grp.subjects.length} Released Subjects
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 self-start sm:self-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Released by HOD</span>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] uppercase font-bold text-neutral-500 bg-neutral-50/30 dark:bg-neutral-850/30">
                        <th className="py-3.5 px-4 font-extrabold min-w-[200px]">Subject</th>
                        <th className="py-3.5 px-4 text-center font-extrabold">Conducted</th>
                        <th className="py-3.5 px-4 text-center font-extrabold">Attended</th>
                        <th className="py-3.5 px-4 text-center font-extrabold">Absent</th>
                        <th className="py-3.5 px-4 text-center font-extrabold">Percentage</th>
                        <th className="py-3.5 px-4 text-center font-extrabold">Release Status</th>
                        <th className="py-3.5 px-4 text-right font-extrabold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {grp.subjects.map((s) => {
                        const isSubShortage = s.percentage < 85;
                        return (
                          <tr
                            key={s.subjectId}
                            className="hover:bg-neutral-50/60 dark:hover:bg-neutral-850/60 transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <div className="font-extrabold text-neutral-900 dark:text-white">
                                {s.subjectCode}
                              </div>
                              <div className="text-[11px] text-neutral-500">{s.subjectName}</div>
                            </td>
                            <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                              {s.totalSessions || s.conductedClasses || 0}
                            </td>
                            <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                              {s.attendedSessions || s.attendedClasses || 0}
                            </td>
                            <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                              {s.absentSessions || s.absentClasses || 0}
                            </td>
                            <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                              {s.percentage.toFixed(1)}%
                            </td>
                            <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                              Released
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-neutral-900 dark:text-white">
                              {isSubShortage ? 'Shortage' : 'Eligible'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ));
          })()
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
                    <td className="py-3 px-4 text-right font-medium text-neutral-900 dark:text-white">
                      {item.status}
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
