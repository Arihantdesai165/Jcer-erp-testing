import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';
import { AnalyticsSemesterItem } from '../../../services/faculty.service';

interface SemesterSelectorViewProps {
  semesters: AnalyticsSemesterItem[];
  loading: boolean;
  onSelectSemester: (semester: number) => void;
}

export const SemesterSelectorView: React.FC<SemesterSelectorViewProps> = ({
  semesters,
  loading,
  onSelectSemester,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-4"
          >
            <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-1/3" />
            <div className="h-4 bg-neutral-100 dark:bg-neutral-800/60 rounded-md w-1/2" />
            <div className="grid grid-cols-2 gap-3 pt-3">
              <div className="h-14 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl" />
              <div className="h-14 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl" />
            </div>
            <div className="h-10 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (semesters.length === 0) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
          No Teaching Assignments Found
        </h3>
        <p className="text-sm text-neutral-500 max-w-md mt-1">
          You do not have any active course or section assignments for this academic year. Please
          contact your HOD if courses need to be allocated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
            Assigned Teaching Semesters
          </h2>
          <p className="text-xs text-neutral-500 font-medium mt-0.5">
            Select a semester below to inspect subject-level attendance and academic marks performance.
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
          {semesters.length} Assigned {semesters.length === 1 ? 'Semester' : 'Semesters'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {semesters.map((sem) => {
          const avgAtt = sem.attendanceSummary.averageAttendance;
          const isAttGood = avgAtt >= (sem.attendanceSummary.threshold || 85);

          return (
            <div
              key={sem.semester}
              onClick={() => onSelectSemester(sem.semester)}
              className="group relative bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 hover:border-violet-400 dark:hover:border-violet-500 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-black text-sm shadow-sm">
                      S{sem.semester}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-neutral-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {sem.semesterName}
                      </h3>
                      <span className="text-[11px] font-semibold text-neutral-400">
                        AY {sem.academicYear}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700">
                    {sem.assignedSections.join(', ') || 'Assigned'}
                  </span>
                </div>

                {/* Scope Stats */}
                <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/60 mb-4">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">
                      Subjects
                    </span>
                    <span className="text-base font-black text-neutral-900 dark:text-white">
                      {sem.assignedSubjectsCount}
                    </span>
                  </div>
                  <div className="text-center border-x border-neutral-200 dark:border-neutral-700/80">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">
                      Sections
                    </span>
                    <span className="text-base font-black text-neutral-900 dark:text-white">
                      {sem.assignedSectionsCount}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">
                      Students
                    </span>
                    <span className="text-base font-black text-violet-600 dark:text-violet-400">
                      {sem.totalStudentsCovered}
                    </span>
                  </div>
                </div>

                {/* Attendance Summary */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-neutral-500 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-neutral-400" />
                      Class Attendance
                    </span>
                    <span
                      className={`font-black ${
                        isAttGood
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {sem.attendanceSummary.sessionsConducted > 0 ? `${avgAtt}%` : 'No Sessions'}
                    </span>
                  </div>

                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isAttGood ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${sem.attendanceSummary.sessionsConducted > 0 ? Math.min(avgAtt, 100) : 0}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                    <span>{sem.attendanceSummary.sessionsConducted} sessions conducted</span>
                    {sem.attendanceSummary.defaultersCount > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {sem.attendanceSummary.defaultersCount} shortage
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Eligible cohort
                      </span>
                    )}
                  </div>
                </div>

                {/* Marks Summary */}
                <div className="p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <div>
                      <div className="font-bold text-neutral-900 dark:text-white">
                        CIE Assessments
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {sem.marksSummary.statusText}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white dark:bg-neutral-900 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800">
                    {sem.marksSummary.hasMarksData ? 'Active' : 'Pending'}
                  </span>
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-300 group-hover:text-violet-600 dark:group-hover:text-violet-400">
                <span>Open Subject Analytics</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SemesterSelectorView;
