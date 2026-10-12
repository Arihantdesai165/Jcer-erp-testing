import React, { useState, useEffect } from 'react';
import studentService, { StudentSubjectMarksGroup } from '../../services/student.service';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Info,
} from 'lucide-react';

export const StudentMarksPage: React.FC = () => {
  const [marksData, setMarksData] = useState<{
    semester: number;
    academicYear: string;
    marksBySubject: StudentSubjectMarksGroup[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await studentService.getPublishedMarks();
      setMarksData(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to retrieve published marks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarks();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !marksData) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-sm">
        <div className="size-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-neutral-900 dark:text-white text-base">Unable to Load CIE Marks</h3>
        <p className="text-xs text-neutral-500">{error || 'Published marks could not be fetched.'}</p>
        <button
          onClick={fetchMarks}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const { semester, academicYear, marksBySubject } = marksData;

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER NOTICE ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-extrabold text-neutral-900 dark:text-white">
              Continuous Internal Evaluation (CIE) Marks
            </h2>
          </div>
          <p className="text-xs text-neutral-500">
            Official published marks for Semester {semester} • Academic Year {academicYear}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-extrabold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Official Published Results</span>
          </span>
        </div>
      </div>

      {/* Safety Notice regarding publication */}
      <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-200">
        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          In accordance with institutional examination policy, only marks that have undergone faculty entry, HOD review, and formal publication are displayed here. Draft or unapproved assessments remain in internal processing until formally published.
        </p>
      </div>

      {/* ── SUBJECT-WISE MARKS ACCORDION / ROSTER ── */}
      {marksBySubject.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <Clock className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto" />
          <h3 className="font-extrabold text-neutral-800 dark:text-neutral-200 text-sm">
            Results Are Not Yet Published
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            CIE assessments for this semester are currently being conducted, evaluated by faculty, or undergoing authoritative departmental HOD review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {marksBySubject.map((group) => {
            const hasAssessments = group.assessments.length > 0;
            return (
              <div
                key={group.subjectId}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4"
              >
                {/* Subject Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-neutral-900 dark:text-white">
                        {group.subjectCode}
                      </span>
                      <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        {group.subjectName}
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-400">
                      Semester {group.semester} • AY {group.academicYear}
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-neutral-500 self-start sm:self-auto">
                    {group.assessments.length} Published Assessment{group.assessments.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Published Assessments List for this Subject */}
                {!hasAssessments ? (
                  <div className="py-4 text-center text-xs text-neutral-400">
                    No published CIE assessments for this subject yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.assessments.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-neutral-900 dark:text-white uppercase tracking-wider">
                            {assessment.assessmentName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                            Published
                          </span>
                        </div>

                        {/* Marks Obtained */}
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-xs text-neutral-500 font-medium">Marks Obtained:</span>
                          <div className="text-right">
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                              {assessment.marksObtained !== null ? assessment.marksObtained : '—'}
                            </span>
                            <span className="text-xs text-neutral-400 font-bold ml-1">
                              / {assessment.maximumMarks}
                            </span>
                          </div>
                        </div>

                        {assessment.percentage !== null && (
                          <div className="flex justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-200/60 dark:border-neutral-800">
                            <span>Score Percentage:</span>
                            <span className="font-bold text-neutral-700 dark:text-neutral-300">
                              {assessment.percentage.toFixed(1)}%
                            </span>
                          </div>
                        )}

                        {assessment.publishedAt && (
                          <div className="text-[10px] text-neutral-400 flex items-center gap-1 pt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>
                              Released on {new Date(assessment.publishedAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentMarksPage;
