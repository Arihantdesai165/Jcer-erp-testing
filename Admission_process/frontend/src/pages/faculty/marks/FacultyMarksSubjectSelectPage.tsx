import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { useAcademicYear } from '../../../context/AcademicYearContext';
import facultyService, { BitwiseSubjectItem } from '../../../services/faculty.service';
import {
  ArrowLeft,
  BookOpen,
  FileSpreadsheet,
  Settings,
  Edit3,
  Award,
  Calendar,
  Building2,
  Download,
  Clock,
  CheckCircle2,
  FileText,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export const FacultyMarksSubjectSelectPage: React.FC = () => {
  const { semester: semParam } = useParams<{ semester: string }>();
  const semester = parseInt(semParam || '1', 10);
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();
  const { user } = useSelector((state: RootState) => state.auth);

  const [subjects, setSubjects] = useState<BitwiseSubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingSubjectId, setDownloadingSubjectId] = useState<string | null>(null);

  const deptCode = user?.department?.code || 'CSE';
  const deptName = user?.department?.name || 'Computer Science & Engineering';

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const data = await facultyService.getBitwiseSubjectsForSemester(semester, academicYear);
      setSubjects(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load semester subjects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [semester, academicYear]);

  const handleExportExcel = async (subjectId: string, subjectCode: string) => {
    try {
      setDownloadingSubjectId(subjectId);
      const blob = await facultyService.downloadMarksExcel(subjectId, semester, academicYear);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${subjectCode}_Bitwise_Marks_Semester_${semester}_${academicYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Bitwise Marks workbook downloaded successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to export Excel workbook.');
    } finally {
      setDownloadingSubjectId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Saved':
      case 'Finalized':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            {status}
          </span>
        );
      case 'Marks In Progress':
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            {status}
          </span>
        );
      case 'Configured':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            Configured
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700">
            Not Configured
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── HEADER ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <button
              onClick={() => navigate('/faculty/marks')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer mb-1"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
              <span>Back to Semesters Overview</span>
            </button>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <BookOpen className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                  Semester {semester} — Assigned Subjects
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Select a subject to configure CIE question patterns or enter internal & assignment marks.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <Building2 className="w-4 h-4 text-neutral-500" />
              <span>Dept: {deptCode}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <Calendar className="w-4 h-4 text-neutral-500" />
              <span>AY: {academicYear}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUBJECT CARDS ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-72 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 animate-pulse space-y-4"
            >
              <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
              <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-2/3" />
              <div className="space-y-2 pt-6">
                <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded" />
                <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
              No Subjects Assigned for Semester {semester}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              You are not currently assigned to any subjects in Semester {semester} for Academic Year {academicYear}.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subjects.map((subj) => (
            <div
              key={subj.subjectId}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-mono text-xs font-bold">
                      {subj.subjectCode}
                    </span>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
                      {subj.subjectName}
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Assigned to: {subj.assignedFaculty} • Department of {subj.departmentName}
                    </p>
                  </div>
                  <button
                    onClick={() => handleExportExcel(subj.subjectId, subj.subjectCode)}
                    disabled={downloadingSubjectId === subj.subjectId}
                    className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
                    title="Download Excel Marks Workbook"
                  >
                    <Download className={`w-4 h-4 ${downloadingSubjectId === subj.subjectId ? 'animate-bounce' : ''}`} />
                  </button>
                </div>

                {/* Grid of 4 Assessment Statuses */}
                <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">CIE-1</span>
                    <div>{getStatusBadge(subj.cie1Status)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">CIE-2</span>
                    <div>{getStatusBadge(subj.cie2Status)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">Assignment</span>
                    <div>{getStatusBadge(subj.assignmentStatus)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">Final Internal</span>
                    <div>{getStatusBadge(subj.finalInternalStatus)}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Matrix */}
              <div className="space-y-2.5 pt-5 mt-4 border-t border-neutral-100 dark:border-neutral-800">
                {/* CIE-1 Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/faculty/marks/config?subjectId=${subj.subjectId}&semester=${semester}&assessmentType=CIE1`
                      )
                    }
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium text-xs transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Config CIE-1</span>
                  </button>
                  <button
                    onClick={() =>
                      navigate(
                        `/faculty/marks/grid?subjectId=${subj.subjectId}&semester=${semester}&assessmentType=CIE1`
                      )
                    }
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold text-xs border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Enter CIE-1 Marks</span>
                  </button>
                </div>

                {/* CIE-2 Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/faculty/marks/config?subjectId=${subj.subjectId}&semester=${semester}&assessmentType=CIE2`
                      )
                    }
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium text-xs transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Config CIE-2</span>
                  </button>
                  <button
                    onClick={() =>
                      navigate(
                        `/faculty/marks/grid?subjectId=${subj.subjectId}&semester=${semester}&assessmentType=CIE2`
                      )
                    }
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Enter CIE-2 Marks</span>
                  </button>
                </div>

                {/* Assignment & Final Internal Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/faculty/marks/assignments/config?subjectId=${subj.subjectId}&semester=${semester}`
                      )
                    }
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium text-xs transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Config Assignment</span>
                  </button>
                  <button
                    onClick={() =>
                      navigate(
                        `/faculty/marks/assignments?subjectId=${subj.subjectId}&semester=${semester}`
                      )
                    }
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold text-xs border border-purple-200 dark:border-purple-800 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Enter Assignment</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() =>
                      navigate(`/faculty/marks/final-internal?subjectId=${subj.subjectId}&semester=${semester}`)
                    }
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-200 dark:border-emerald-800 transition-colors"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Final CIE Sheet</span>
                  </button>
                </div>

                {/* External Exam Option */}
                {['Saved', 'Finalized', 'FINALIZED'].includes(subj.finalInternalStatus) ? (
                  <button
                    onClick={() =>
                      navigate(`/faculty/marks/external?subjectId=${subj.subjectId}&semester=${semester}`)
                    }
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800 transition-all shadow-xs cursor-pointer"
                  >
                    <GraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Enter External VTU Marks (SEE) &rarr;</span>
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      navigate(`/faculty/marks/external?subjectId=${subj.subjectId}&semester=${semester}`)
                    }
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs font-medium transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-neutral-400" />
                    <span>External VTU Examination Marks</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FacultyMarksSubjectSelectPage;
