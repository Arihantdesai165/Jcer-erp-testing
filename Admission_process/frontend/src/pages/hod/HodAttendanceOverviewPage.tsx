import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  Users,
  ChevronRight,
  Clock,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  FileSpreadsheet,
  Cloud,
  ExternalLink,
  Download,
  Layers,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import hodService from '../../services/hod.service';

export const HodAttendanceOverviewPage: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Consolidated Register State
  const [selectedSem, setSelectedSem] = useState<number>(1);
  const [consolidatedData, setConsolidatedData] = useState<any | null>(null);
  const [consolidatedLoading, setConsolidatedLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const fetchAttendance = () => {
    setLoading(true);
    hodService.getAttendanceOverview()
      .then((res) => setData(res))
      .catch((err) => console.error('Failed to load attendance:', err))
      .finally(() => setLoading(false));
  };

  const fetchConsolidatedReport = (sem: number) => {
    setConsolidatedLoading(true);
    setSyncSuccessMessage(null);
    setSyncErrorMessage(null);
    hodService.getConsolidatedAttendanceReport({ semester: sem })
      .then((res) => setConsolidatedData(res))
      .catch((err) => console.error('Failed to load consolidated report:', err))
      .finally(() => setConsolidatedLoading(false));
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncSuccessMessage(null);
    setSyncErrorMessage(null);
    try {
      const res = await hodService.syncConsolidatedAttendance({ semester: selectedSem });
      setSyncSuccessMessage(res.message || 'Synced successfully to Google Drive.');
      // Refresh consolidated data
      fetchConsolidatedReport(selectedSem);
    } catch (err: any) {
      setSyncErrorMessage(
        err?.response?.data?.error || err.message || 'Sync failed — attendance data remains safely stored in PostgreSQL.'
      );
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  useEffect(() => {
    fetchConsolidatedReport(selectedSem);
  }, [selectedSem]);

  return (
    <div className="space-y-6">
      
      {/* ── Page Header (Admin Style) ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-neutral-900 text-white rounded-2xl px-5 py-3 shadow-sm border border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
              Overall Rate
            </span>
            <div className="text-2xl font-black mt-0.5">
              {data?.overallPercentage ?? 0}% <span className="text-xs font-semibold text-neutral-400">average</span>
            </div>
          </div>

         
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              fetchAttendance();
              fetchConsolidatedReport(selectedSem);
            }}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/hod/attendance/defaulters"
            className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>View Defaulters (&lt; 75%)</span>
          </Link>
        </div>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Overall Department Rate</span>
          <h3 className="text-3xl font-black text-neutral-900 dark:text-white mt-2">
            {loading ? '...' : `${data?.overallPercentage ?? 0}%`}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Across all active classrooms</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Total Recorded Sessions</span>
          <h3 className="text-3xl font-black text-neutral-900 dark:text-white mt-2">
            {loading ? '...' : (data?.totalSessions ?? 0)}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Faculty class attendance logs</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Defaulters Risk Group</span>
          <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-2">
            &lt; 75%
          </h3>
          <Link to="/hod/attendance/defaulters" className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline mt-1 block">
            Inspect Defaulter Students →
          </Link>
        </div>
      </div>

      {/* ── CONSOLIDATED SEMESTER ATTENDANCE CARD ─────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                  Consolidated Semester Attendance Register
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Combined multi-section, multi-subject official attendance workbook synchronized in Google Drive.
                </p>
              </div>
            </div>
          </div>

          {/* Semester Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-x-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <button
                key={sem}
                onClick={() => setSelectedSem(sem)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedSem === sem
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                Sem {sem}
              </button>
            ))}
          </div>
        </div>

        {/* Sync feedback alerts */}
        {syncSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccessMessage}</span>
          </div>
        )}

        {syncErrorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-xs font-semibold text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{syncErrorMessage}</span>
          </div>
        )}

        {/* Cohort & File Meta Panel */}
        <div className="bg-neutral-50/70 dark:bg-neutral-800/40 rounded-2xl p-5 sm:p-6 border border-neutral-200/70 dark:border-neutral-700/60 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-neutral-900 text-white text-[11px] font-black uppercase tracking-wider">
                {consolidatedData?.academicYear || '2026-27'}
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[11px] font-bold">
                {consolidatedData?.departmentCode || 'CSE'}
              </span>
              <span className="px-3 py-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-[11px] font-bold">
                Semester {selectedSem}
              </span>
              {consolidatedData?.status === 'SYNCED' ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Synced to Drive
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Pending Sync
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Sections</span>
                <span className="text-sm font-black text-neutral-900 dark:text-white mt-0.5 block">
                  {consolidatedData?.stats?.sectionNames?.length > 0
                    ? consolidatedData.stats.sectionNames.join(', ')
                    : 'A, B'}
                </span>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Enrolled Students</span>
                <span className="text-sm font-black text-neutral-900 dark:text-white mt-0.5 block">
                  {consolidatedLoading ? '...' : (consolidatedData?.stats?.totalStudents ?? 0)}
                </span>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Semester Subjects</span>
                <span className="text-sm font-black text-neutral-900 dark:text-white mt-0.5 block">
                  {consolidatedLoading ? '...' : (consolidatedData?.stats?.totalSubjects ?? 0)}
                </span>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Workbook File</span>
                <span className="text-[11px] font-mono font-bold text-neutral-800 dark:text-neutral-200 truncate block mt-0.5">
                  {consolidatedData?.fileName || `Final_Attendance_Sem${selectedSem}.xlsx`}
                </span>
              </div>
            </div>

            {consolidatedData?.lastSyncedAt && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Last synchronized: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{new Date(consolidatedData.lastSyncedAt).toLocaleString()}</span>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex sm:flex-col items-center justify-end gap-2.5 shrink-0">
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing Drive...' : 'Sync Final Attendance'}</span>
            </button>

            <a
              href={hodService.downloadConsolidatedAttendanceUrl({ semester: selectedSem })}
              download
              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span>Download Excel</span>
            </a>

            {consolidatedData?.googleDriveFileId && (
              <a
                href={`https://drive.google.com/file/d/${consolidatedData.googleDriveFileId}/view`}
                target="_blank"
                rel="noreferrer"
                className="w-full px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                <span>Open in Drive</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Semester Breakdown Grid ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Semester-Wise Attendance Comparison
        </h3>

        {data?.semesterData && data.semesterData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.semesterData.map((sem: any) => (
              <div key={sem.semester} className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Semester {sem.semester}</span>
                  <span className="text-xs font-black text-neutral-900 dark:text-white font-mono">{sem.percentage}%</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-2.5 overflow-hidden">
                  <div
                    className="bg-neutral-900 dark:bg-neutral-100 h-2 rounded-full"
                    style={{ width: `${sem.percentage}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500 font-semibold">
                  <span>{sem.totalSessions} sessions</span>
                  <Link to={`/hod/students?semester=${sem.semester}`} className="text-neutral-900 dark:text-white font-bold hover:underline">
                    View Cohort →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-700">
            <p className="text-xs font-semibold text-neutral-400">No semester attendance records recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodAttendanceOverviewPage;

