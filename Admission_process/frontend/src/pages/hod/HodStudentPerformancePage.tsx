import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  ArrowLeft,
  Search,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  ArrowUpDown,
} from 'lucide-react';
import hodService, { HodPerformanceItem } from '../../services/hod.service';
import { ShowStudentsRangeSelector } from '../../components/common/ShowStudentsRangeSelector';

export const HodStudentPerformancePage: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<HodPerformanceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [limit, setLimit] = useState<number>(10);
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<'averageMarks' | 'attendancePercentage'>('averageMarks');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchPerformance();
  }, [selectedSemester, selectedSection]);

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const data = await hodService.getStudentPerformance({
        semester: selectedSemester,
        section: selectedSection,
      });
      setPerformanceData(data);
    } catch (err) {
      console.error('Failed to load student performance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'averageMarks' | 'attendancePercentage') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSorted = performanceData
    .filter((s) => {
      const q = searchTerm.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.usn.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

  return (
    <div className="space-y-6">
      
      {/* ── Breadcrumb & Back ────────────────────────────────────────────────── */}
      <div>
        <Link
          to="/hod/academics"
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
          <span>Back to Academics Overview</span>
        </Link>
      </div>

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Student Academic Performance Table (Item 7)
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Holistic performance scores: Attendance, Average Marks, Pass/Fail Result, and Bit 1-5 Breakdown.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ─────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-4 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or USN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-semibold"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
          >
            <option value="ALL">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>

          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold"
          >
            <option value="ALL">All Sections</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
          </select>

          <ShowStudentsRangeSelector
            value={limit}
            onChange={(newLimit) => setLimit(newLimit)}
          />
        </div>
      </div>

      {/* ── Performance Table ───────────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl border border-white/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/80 dark:bg-slate-900/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
              <tr className="border-b border-neutral-800 text-[10px] font-black uppercase tracking-widest text-white">
                <th className="py-3.5 px-4 text-white">Student</th>
                <th className="py-3.5 px-4 text-white">USN / Enrollment</th>
                <th className="py-3.5 px-4 text-white">Sem & Sec</th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-300 transition-colors text-white"
                  onClick={() => handleSort('attendancePercentage')}
                >
                  <div className="flex items-center gap-1">
                    <span>Attendance %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-indigo-300 transition-colors text-white"
                  onClick={() => handleSort('averageMarks')}
                >
                  <div className="flex items-center gap-1">
                    <span>Avg Marks %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-white">Pass / Fail</th>
                <th className="py-3.5 px-4 text-white">Bit-Wise Performance (B1 .. B5)</th>
                <th className="py-3.5 px-4 text-center text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
                    <p className="mt-2 text-xs font-bold">Loading student performance data...</p>
                  </td>
                </tr>
              ) : filteredAndSorted.length > 0 ? (
                filteredAndSorted.slice(0, limit).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                      {item.usn}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                      Sem {item.semester} • {item.section}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`font-black ${
                        item.attendancePercentage < 75 ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {item.attendancePercentage}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-black text-indigo-600 text-sm">
                        {item.averageMarks}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                        item.passFail === 'PASS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {item.passFail}
                      </span>
                    </td>

                    {/* Bit-Wise Scores (B1 .. B5) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" title="Bit 1">
                          B1: {item.bitwiseScores.bit1}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" title="Bit 2">
                          B2: {item.bitwiseScores.bit2}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" title="Bit 3">
                          B3: {item.bitwiseScores.bit3}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" title="Bit 4">
                          B4: {item.bitwiseScores.bit4}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" title="Bit 5">
                          B5: {item.bitwiseScores.bit5}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/hod/students/${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-bold text-[11px] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Profile</span>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No student performance records found.
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

export default HodStudentPerformancePage;
