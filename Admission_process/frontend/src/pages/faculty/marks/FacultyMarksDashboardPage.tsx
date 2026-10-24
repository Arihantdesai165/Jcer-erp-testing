import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { useAcademicYear } from '../../../context/AcademicYearContext';
import facultyService, { BitwiseSemesterCard } from '../../../services/faculty.service';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export const FacultyMarksDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { academicYear } = useAcademicYear();

  const [semesters, setSemesters] = useState<BitwiseSemesterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const deptName = user?.department?.name || 'Computer Science & Engineering';

  const fetchSemesters = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await facultyService.getBitwiseSemesters(academicYear);
      setSemesters(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load semester marks overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
  }, [academicYear]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Saved':
      case 'Synced':
      case 'Finalized':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'Marks In Progress':
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'Configured':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <FileCheck2 className="w-3.5 h-3.5" />
            Configured
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
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
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Semester Overview
            </h1>
        </div>
      </div>

      {/* ── SEMESTER CARDS ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-64 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 animate-pulse space-y-4"
            >
              <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
              <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-3/4" />
              <div className="space-y-2 pt-4">
                <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded" />
                <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : semesters.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
              No Assigned Teaching Semesters Found
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              You do not have active subject teaching assignments for Academic Year {academicYear}. Please contact your HOD if you believe this is an error.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {semesters.map((sem) => (
            <div
              key={sem.semester}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      {sem.departmentCode} • AY {sem.academicYear}
                    </span>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5">
                      {sem.semesterName}
                    </h2>
                  </div>
                  <span className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 group-hover:bg-blue-50 group-hover:text-blue-600 dark:group-hover:bg-blue-950 dark:group-hover:text-blue-400 transition-colors">
                    <BookOpen className="w-5 h-5" />
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl space-y-1">
                  <div className="flex justify-between text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    <span>Assigned Subjects</span>
                    <span className="font-bold text-neutral-900 dark:text-white">{sem.assignedSubjectsCount}</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    <span>Evaluations Configured</span>
                    <span className="font-bold text-neutral-900 dark:text-white">{sem.configsCompletedCount}</span>
                  </div>
                </div>

                {/* Assessment Statuses */}
                <div className="space-y-2 pt-1 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">CIE-1 Status:</span>
                    {getStatusBadge(sem.cie1Status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">CIE-2 Status:</span>
                    {getStatusBadge(sem.cie2Status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">Assignment:</span>
                    {getStatusBadge(sem.assignmentStatus)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">Final Internal:</span>
                    {getStatusBadge(sem.finalInternalStatus)}
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={() => navigate(`/faculty/marks/semesters/${sem.semester}`)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm hover:shadow transition-all group-hover:gap-3"
                >
                  <span>Open Subject Assessments</span>
                  <ArrowRight className="w-4 h-4 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FacultyMarksDashboardPage;
