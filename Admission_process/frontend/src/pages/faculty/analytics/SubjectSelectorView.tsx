import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  Award,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { AnalyticsSubjectItem } from '../../../services/faculty.service';

interface SubjectSelectorViewProps {
  semester: number;
  subjects: AnalyticsSubjectItem[];
  loading: boolean;
  onBack: () => void;
  onSelectSubject: (subject: AnalyticsSubjectItem) => void;
}

export const SubjectSelectorView: React.FC<SubjectSelectorViewProps> = ({
  semester,
  subjects,
  loading,
  onBack,
  onSelectSubject,
}) => {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-1/4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 space-y-4"
            >
              <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-1/2" />
              <div className="h-4 bg-neutral-100 dark:bg-neutral-800/60 rounded-md w-1/3" />
              <div className="h-20 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Semester Selection</span>
        </button>

        <div className="p-16 flex flex-col items-center justify-center text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <BookOpen className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-3" />
          <h3 className="text-base font-bold text-neutral-900 dark:text-white">
            No Subjects Found for Semester {semester}
          </h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm">
            You do not currently have any active course allocations for this semester.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Bar with Back Button & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
            title="Back to Semesters"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
              Semester {semester} Courses
            </h2>
            <p className="text-xs text-neutral-500 font-medium">
              Select a course to view detailed session attendance records and CIE marks analysis.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 w-fit">
          {subjects.length} Assigned {subjects.length === 1 ? 'Course' : 'Courses'}
        </span>
      </div>

      {/* Grid of Subject Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((sub) => {
          const isAttGood = sub.averageAttendance >= 85;

          return (
            <div
              key={sub.subjectId}
              onClick={() => onSelectSubject(sub)}
              className="group bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 hover:border-violet-400 dark:hover:border-violet-500 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700">
                      {sub.subjectCode}
                    </span>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors mt-2 leading-snug">
                      {sub.subjectName}
                    </h3>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shrink-0 ${
                      sub.attendanceStatus === 'EXCELLENT'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : sub.attendanceStatus === 'GOOD'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : sub.attendanceStatus === 'NEEDS_ATTENTION'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {sub.attendanceStatus.replace('_', ' ')}
                  </span>
                </div>

                {/* Section tags */}
                <div className="flex items-center gap-1.5 flex-wrap mb-4">
                  {sub.sections.map((sec, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/70 dark:border-neutral-700"
                    >
                      {sec}
                    </span>
                  ))}
                  <span className="text-[11px] text-neutral-400 font-semibold ml-1">
                    • {sub.totalStudents} enrolled
                  </span>
                </div>

                {/* Attendance Performance Bar */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/60 space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-neutral-500 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-neutral-400" />
                      Attendance Rate
                    </span>
                    <span
                      className={`font-black ${
                        isAttGood
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {sub.conductedSessions > 0 ? `${sub.averageAttendance}%` : 'No Classes Recorded'}
                    </span>
                  </div>

                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isAttGood ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${sub.conductedSessions > 0 ? Math.min(sub.averageAttendance, 100) : 0}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                    <span>{sub.conductedSessions} sessions conducted</span>
                    <span>Target: 85%</span>
                  </div>
                </div>

                {/* Marks status badge */}
                <div className="p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <div>
                      <div className="font-bold text-neutral-900 dark:text-white">CIE Marks</div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {sub.marksStatus}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                      sub.marksAvailability === 'AVAILABLE'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : sub.marksAvailability === 'PARTIAL'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {sub.marksAvailability.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-300 group-hover:text-violet-600 dark:group-hover:text-violet-400">
                <span>View Analytics Workspace</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubjectSelectorView;
