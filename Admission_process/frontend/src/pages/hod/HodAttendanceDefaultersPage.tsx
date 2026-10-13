import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Mail,
  Phone,
  Download,
  Users,
  Eye,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import hodService, { HodDefaulterItem } from '../../services/hod.service';
import { ShowStudentsRangeSelector } from '../../components/common/ShowStudentsRangeSelector';

export const HodAttendanceDefaultersPage: React.FC = () => {
  const [defaulters, setDefaulters] = useState<HodDefaulterItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [limit, setLimit] = useState<number>(10);
  const [threshold, setThreshold] = useState<number>(85);

  useEffect(() => {
    fetchDefaulters();
  }, [selectedSemester]);

  const fetchDefaulters = async () => {
    setLoading(true);
    try {
      const data = await hodService.getAttendanceDefaulters({
        semester: selectedSemester,
      });
      setDefaulters(data);
      if ((data as any)?.threshold !== undefined) {
        setThreshold(Number((data as any).threshold));
      }
    } catch (err) {
      console.error('Failed to load defaulters:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Student Name', 'USN', 'Semester', 'Section', 'Total Sessions', 'Present Sessions', 'Attendance %', 'Deficit %', 'Parent Phone', 'Parent Email'];
    const rows = defaulters.map((d) => [
      `"${d.name}"`,
      `"${d.usn}"`,
      d.semester,
      `"${d.section}"`,
      d.totalSessions,
      d.presentSessions,
      `${d.attendancePercentage}%`,
      `${d.deficit}%`,
      `"${d.parentPhone}"`,
      `"${d.parentEmail}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Defaulters_${selectedSemester}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* ── Breadcrumb & Back ────────────────────────────────────────────────── */}
      <div>
        <Link
          to="/hod/attendance"
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
          <span>Back to Attendance Overview</span>
        </Link>
      </div>

      {/* ── Page Header (Admin Style) ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-neutral-900 text-white rounded-2xl px-5 py-3 shadow-sm border border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
              Defaulter Count
            </span>
            <div className="text-2xl font-black mt-0.5 text-rose-400">
              {defaulters.length} <span className="text-xs font-semibold text-neutral-400">&lt; {threshold}%</span>
            </div>
          </div>

        
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchDefaulters()}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={defaulters.length === 0}
            className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 dark:text-neutral-300">
          <span>Filter by Semester:</span>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:ring-2 focus:ring-violet-500"
          >
            <option value="ALL">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
            Threshold: &lt; {threshold}%
          </span>
          <ShowStudentsRangeSelector
            value={limit}
            onChange={(newLimit) => setLimit(newLimit)}
          />
        </div>
      </div>

      {/* ── Defaulters Table (Admin Style) ───────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">USN</th>
                <th className="py-3.5 px-4 text-center">Cohort</th>
                <th className="py-3.5 px-4 text-center">Attended / Total</th>
                <th className="py-3.5 px-4 text-center">Attendance %</th>
                <th className="py-3.5 px-4 text-center">Deficit</th>
                <th className="py-3.5 px-4">Parent Contact</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-violet-600 border-t-transparent" />
                    <p className="mt-2 text-xs font-bold">Computing defaulters list...</p>
                  </td>
                </tr>
              ) : defaulters.length > 0 ? (
                defaulters.slice(0, limit).map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-neutral-900 dark:text-white">
                      {item.name}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {item.usn}
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-neutral-700 dark:text-neutral-300">
                      Sem {item.semester} • {item.section}
                    </td>

                    <td className="py-3.5 px-4 text-center font-medium text-neutral-600 dark:text-neutral-400">
                      {item.presentSessions} / {item.totalSessions} sessions
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="font-black text-rose-600 text-sm">
                        {item.attendancePercentage}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[10px]">
                        -{item.deficit}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 text-[11px]">
                        <div className="flex items-center gap-1 font-semibold text-neutral-700 dark:text-neutral-300">
                          <Phone className="w-3 h-3 text-neutral-400" /> {item.parentPhone}
                        </div>
                        <div className="flex items-center gap-1 text-neutral-400">
                          <Mail className="w-3 h-3 text-neutral-400" /> {item.parentEmail}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/hod/students/${item.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-900 hover:text-white dark:bg-neutral-800 dark:hover:bg-neutral-100 dark:hover:text-neutral-900 text-neutral-800 dark:text-neutral-200 font-bold text-[11px] transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Profile</span>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">No Attendance Defaulters</p>
                    <p className="text-xs text-neutral-400 mt-1">All department students meet or exceed the 75% attendance threshold.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HodAttendanceDefaultersPage;
