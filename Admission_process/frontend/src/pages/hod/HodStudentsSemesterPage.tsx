import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { GraduationCap, Calendar, Users, ChevronRight, Layers, ArrowUpRight, Sparkles } from 'lucide-react';
import { RootState } from '../../store';
import hodService from '../../services/hod.service';
import { useAcademicYear } from '../../context/AcademicYearContext';

export const HodStudentsSemesterPage: React.FC = () => {
  const { academicYear } = useAcademicYear();
  const { user } = useSelector((state: RootState) => state.auth);
  const [semesterStats, setSemesterStats] = useState<Array<{ semester: number; totalStudents: number; assignedSectionsCount: number }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const isAppliedScience =
    user?.department?.type === 'SEMESTER_HANDLING' ||
    user?.department?.code === 'AS' ||
    user?.department?.name?.toLowerCase().includes('applied');

  useEffect(() => {
    setLoading(true);
    hodService.getStudentSemesters(academicYear)
      .then((data) => {
        if (Array.isArray(data)) {
          setSemesterStats(data);
        }
      })
      .catch((err) => console.error('Failed to load semester stats:', err))
      .finally(() => setLoading(false));
  }, [academicYear]);

  // For Applied Science department, scope strictly to Semesters 1 and 2
  const semestersToDisplay = useMemo(() => {
    if (isAppliedScience) {
      return [1, 2];
    }
    if (semesterStats && semesterStats.length > 0) {
      return semesterStats.map((s) => s.semester).sort((a, b) => a - b);
    }
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }, [isAppliedScience, semesterStats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {isAppliedScience && (
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Applied Science Scope • Semesters 1 &amp; 2 Only
            </span>
          )}
        </div>

        <Link
          to="/hod/students"
          className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-xs inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Users className="w-3.5 h-3.5 text-indigo-600" />
          <span>All Students Directory</span>
        </Link>
      </div>

      {/* Grid of Semesters */}
      <div className={`grid gap-5 ${
        semestersToDisplay.length <= 2 
          ? 'grid-cols-1 sm:grid-cols-2 max-w-4xl' 
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      }`}>
        {semestersToDisplay.map((sem) => {
          const stat = semesterStats.find((s) => s.semester === sem) || {
            semester: sem,
            totalStudents: 0,
            assignedSectionsCount: 0,
          };

          const isOdd = sem % 2 === 1;
          const isCurrentActive = isOdd; // Typically odd or even semester active

          return (
            <div
              key={sem}
              className={`glass-card rounded-3xl p-5 border transition-all hover:shadow-md bg-white/80 dark:bg-slate-900/80 ${
                isCurrentActive ? 'border-indigo-200/80 dark:border-indigo-900/50' : 'border-slate-200/60 dark:border-slate-800/60 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Semester</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isCurrentActive ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-100 text-slate-500'
                }`}>
                  {isCurrentActive ? 'CURRENT SESSION' : 'OFF SESSION'}
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">
                  Sem {sem}
                </h3>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Enrolled Students:</span>
                  <strong className="text-slate-900 dark:text-white">{loading ? '...' : stat.totalStudents}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Sections Allocated:</span>
                  <strong className="text-slate-900 dark:text-white">{stat.assignedSectionsCount > 0 ? 'Section A, B' : 'None'}</strong>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">Academic Cohort</span>
                <Link
                  to={`/hod/students/semesters/${sem}`}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  View Cohort <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HodStudentsSemesterPage;
