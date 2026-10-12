import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAcademicYear } from '../../../context/AcademicYearContext';
import facultyService, {
  FinalInternalMarksWorkspaceData,
} from '../../../services/faculty.service';
import {
  ArrowLeft,
  Award,
  Download,
  CheckCircle2,
  Lock,
  Search,
  ExternalLink,
  Info,
  Layers,
  FileSpreadsheet,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export const FacultyFinalInternalMarksPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();

  const subjectId = searchParams.get('subjectId') || '';
  const semester = parseInt(searchParams.get('semester') || '1', 10);

  const [workspace, setWorkspace] = useState<FinalInternalMarksWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchWorkspace = async () => {
    if (!subjectId) return;
    try {
      setLoading(true);
      const data = await facultyService.getFinalInternalMarksWorkspace(subjectId, semester, academicYear);
      setWorkspace(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load final internal marks statement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [subjectId, semester, academicYear]);

  const filteredStudents = useMemo(() => {
    if (!workspace) return [];
    if (!searchQuery.trim()) return workspace.students;
    const q = searchQuery.toLowerCase();
    return workspace.students.filter(
      (s) => s.studentName.toLowerCase().includes(q) || s.usn.toLowerCase().includes(q)
    );
  }, [workspace, searchQuery]);

  const handleSaveOrFinalize = async (finalize = false) => {
    try {
      setSaving(true);
      const res = await facultyService.saveFinalInternalMarks({
        subjectId,
        semester,
        finalize,
        academicYear,
      });
      toast.success(res.message || 'Marks statement updated.');
      fetchWorkspace();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save final internal marks.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await facultyService.downloadMarksExcel(subjectId, semester, academicYear);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const subjCode = workspace?.metadata.subjectCode || 'SUB';
      const subjName = (workspace?.metadata.subjectName || 'Marks').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${subjCode}_${subjName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Excel workbook downloaded successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to export marks workbook.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-full mx-auto">
        <div className="h-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
        <div className="h-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const isFinalized = workspace?.metadata.isFinalized;

  return (
    <div className="space-y-5 max-w-full mx-auto pb-12">
      {/* ── HEADER ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <button
              onClick={() => navigate(`/faculty/marks/semesters/${semester}`)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer mb-1"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
              <span>Back to Semester {semester} Subjects</span>
            </button>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <Award className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                    {workspace?.metadata.subjectCode} — Final Continuous Internal Evaluation (CIE) Statement
                  </h1>
                  {isFinalized ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs">
                      <Lock className="w-3 h-3" /> Finalized & Locked
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold text-xs">
                      Draft Statement
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {workspace?.metadata.subjectName} • Semester {semester} • Dept: {workspace?.metadata.departmentCode} • AY {academicYear}
                </p>
              </div>
            </div>
          </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>

              {isFinalized ? (
                <button
                  onClick={() => navigate(`/faculty/marks/external?subjectId=${subjectId}&semester=${semester}`)}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Enter External Marks (SEE) &rarr;</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleSaveOrFinalize(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition-colors"
                  >
                    <span>Save Record</span>
                  </button>
                  <button
                    onClick={() => handleSaveOrFinalize(true)}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Finalize & Submit</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Finalized Banner with External Exam Direct Entry */}
          {isFinalized && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-blue-950/40 border border-purple-200 dark:border-purple-800 rounded-xl shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-600 text-white flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                    Continuous Internal Evaluation (CIE) Finalized
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    Internal marks are locked and synced. You can now proceed to enter VTU Semester End Examination (SEE) marks to calculate final Pass/Fail status.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/faculty/marks/external?subjectId=${subjectId}&semester=${semester}`)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all flex-shrink-0 cursor-pointer"
              >
                <span>Proceed to External Marks</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Formula Explainer */}
          <div className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl text-xs text-neutral-600 dark:text-neutral-400">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span>
              <strong>Calculation Policy:</strong> CIE Avg = (CIE-1 + CIE-2) / 2 out of 50M. Scaled Down = CIE Avg / 2 (out of 25M). Final Internal Marks = Scaled Down (25M) + Assignment (25M) = Max 50M.
            </span>
          </div>
      </div>

      {/* ── SEARCH BAR ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search student by USN or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>
      </div>

      {/* ── FINAL INTERNAL MARKS TABLE ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="max-h-[640px] overflow-auto relative marks-grid-scroll">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-30 bg-neutral-900 text-white border-b border-neutral-800 shadow-md">
              <tr>
                <th className="sticky left-0 z-40 bg-neutral-900 text-white px-3 py-3 font-bold border-r border-neutral-700 w-12 min-w-[48px] max-w-[48px] text-center">
                  #
                </th>
                <th className="sticky left-[48px] z-40 bg-neutral-900 text-white px-3 py-3 font-bold border-r border-neutral-700 w-36 min-w-[144px] max-w-[144px]">
                  USN
                </th>
                <th className="sticky left-[192px] z-40 bg-neutral-900 text-white px-4 py-3 font-bold border-r border-neutral-700 w-52 min-w-[208px] max-w-[208px]">
                  Student Name
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 min-w-[90px]">
                  CIE-1 (50M)
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 min-w-[90px]">
                  CIE-2 (50M)
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 bg-neutral-850 text-blue-300 min-w-[110px]">
                  CIE Avg (50M)
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 bg-neutral-850 text-indigo-300 min-w-[125px]">
                  Scaled Down (25M)
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 min-w-[120px]">
                  Assignment (25M)
                </th>
                <th className="px-4 py-2.5 font-bold text-center bg-emerald-600 text-white min-w-[140px]">
                  Final Internal (50M)
                </th>
                <th className="px-3 py-2.5 font-bold text-center min-w-[100px]">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredStudents.map((row, rIdx) => (
                <tr key={row.studentId} className="hover:bg-emerald-50/40 dark:hover:bg-neutral-800/60 transition-colors">
                  <td className="sticky left-0 z-20 bg-white dark:bg-neutral-900 w-12 min-w-[48px] max-w-[48px] px-3 py-2.5 text-center font-bold text-xs text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800">
                    {rIdx + 1}
                  </td>
                  <td className="sticky left-[48px] z-20 bg-white dark:bg-neutral-900 w-36 min-w-[144px] max-w-[144px] px-3 py-2.5 font-bold text-xs text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800 uppercase tracking-tight">
                    {(row.usn || '').toUpperCase()}
                  </td>
                  <td className="sticky left-[192px] z-20 bg-white dark:bg-neutral-900 w-52 min-w-[208px] max-w-[208px] px-4 py-2.5 font-bold text-xs uppercase tracking-tight text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800 truncate">
                    {(row.studentName || '').toUpperCase()}
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold border-r border-neutral-200 dark:border-neutral-800">
                    {row.cie1Marks !== null ? row.cie1Marks : <span className="text-neutral-400">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold border-r border-neutral-200 dark:border-neutral-800">
                    {row.cie2Marks !== null ? row.cie2Marks : <span className="text-neutral-400">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-blue-800 dark:text-blue-300 bg-blue-50/40 dark:bg-blue-950/20 border-r border-neutral-200 dark:border-neutral-800">
                    {row.cieAverageOrPolicyResult !== null ? row.cieAverageOrPolicyResult : <span className="text-neutral-400">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20 border-r border-neutral-200 dark:border-neutral-800">
                    {row.cieScaled25 !== null && row.cieScaled25 !== undefined ? (
                      row.cieScaled25
                    ) : row.cieAverageOrPolicyResult !== null ? (
                      Math.round((row.cieAverageOrPolicyResult / 2) * 100) / 100
                    ) : (
                      <span className="text-neutral-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold border-r border-neutral-200 dark:border-neutral-800">
                    {row.assignmentScaledMarks !== null ? row.assignmentScaledMarks : <span className="text-neutral-400">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center font-bold text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30">
                    {row.finalInternalMarks !== null && row.finalInternalMarks !== undefined ? (
                      Math.round(row.finalInternalMarks)
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-normal">Pending</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {row.status === 'FINALIZED' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-[11px]">
                        Finalized
                      </span>
                    ) : row.status === 'READY' ? (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold text-[11px]">
                        Ready
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold text-[11px]">
                        Incomplete
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FacultyFinalInternalMarksPage;
