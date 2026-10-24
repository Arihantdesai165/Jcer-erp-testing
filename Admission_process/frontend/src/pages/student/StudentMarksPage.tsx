import React, { useState, useEffect } from 'react';
import studentService, {
  StudentPublishedMarksResponse,
  StudentSubjectMarksGroup,
} from '../../services/student.service';
import { useAcademicYear } from '../../context/AcademicYearContext';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Info,
  Layers,
} from 'lucide-react';

export const StudentMarksPage: React.FC = () => {
  const { academicYear } = useAcademicYear();
  const [marksData, setMarksData] = useState<StudentPublishedMarksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const res = await studentService.getPublishedMarks({ academicYear });
      setMarksData(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to retrieve published marks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMarks();
  }, [academicYear]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl animate-pulse" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
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
          onClick={() => fetchMarks()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // Determine semester tables to display
  const semesterTables = marksData.semesters && marksData.semesters.length > 0
    ? marksData.semesters
    : [
        {
          semester: marksData.semester,
          academicYear: marksData.academicYear,
          rows: marksData.marksBySubject || marksData.subjects || [],
          subjects: marksData.marksBySubject || marksData.subjects || [],
        },
      ];

  const totalPublishedRows = semesterTables.reduce(
    (acc, sem) => acc + sem.rows.filter((r) => r.status !== 'NOT_RELEASED').length,
    0
  );

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER BAR ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white">
              Continuous Internal Evaluation (CIE) & External Marks
            </h2>
          </div>
          <p className="text-xs text-neutral-500">
            Official published marks released by authorized Departmental HOD • Academic Year {marksData.academicYear || academicYear}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-extrabold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Official Released Records</span>
          </span>

          <button
            onClick={() => fetchMarks(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 shadow-2xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Safety Notice regarding publication */}
      <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-200">
        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          In strict accordance with academic examination policy, only assessment marks that have undergone faculty entry, validation, and authoritative HOD release are displayed. Unreleased assessments remain strictly hidden until officially published.
        </p>
      </div>

      {/* ── SEMESTER-WISE MARKS TABLES ── */}
      {semesterTables.length === 0 || semesterTables.every((s) => s.rows.length === 0) ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <Clock className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto" />
          <h3 className="font-extrabold text-neutral-800 dark:text-neutral-200 text-sm">
            Results Are Not Yet Released
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            {marksData.statusNotice ||
              'CIE assessments for your semester are currently being conducted, evaluated by faculty, or undergoing authoritative departmental HOD review. Once released, marks will automatically appear in the table below.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {semesterTables.map((semTable) => (
            <div
              key={semTable.semester}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xs overflow-hidden"
            >
              {/* Semester Heading Banner */}
              <div className="p-5 sm:px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-neutral-900 dark:text-white">
                      Semester {semTable.semester}
                    </h3>
                    <span className="text-[11px] text-neutral-500 font-medium">
                      Academic Year {semTable.academicYear} • {semTable.rows.length} Subjects
                    </span>
                  </div>
                </div>

                <span className="text-xs font-bold text-neutral-500 self-start sm:self-center">
                  {semTable.rows.filter((r) => r.status !== 'NOT_RELEASED').length} of {semTable.rows.length} Subjects with Released Marks
                </span>
              </div>

              {/* Exact 7-Column Marks Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-black text-white">
                    <tr className="border-b border-black text-[11px] uppercase font-bold text-white bg-black">
                      <th className="py-3.5 px-4 font-bold min-w-[200px] bg-black text-white">Subject Name</th>
                      <th className="py-3.5 px-4 text-center font-bold min-w-[120px] bg-black text-white">CIE-1 Marks</th>
                      <th className="py-3.5 px-4 text-center font-bold min-w-[120px] bg-black text-white">CIE-2 Marks</th>
                      <th className="py-3.5 px-4 text-center font-bold min-w-[130px] bg-black text-white">Assignment Marks</th>
                      <th className="py-3.5 px-4 text-center font-bold min-w-[140px] bg-black text-white">Final Internal Marks</th>
                      <th className="py-3.5 px-4 text-center font-bold min-w-[130px] bg-black text-white">External Marks</th>
                      <th className="py-3.5 px-4 text-center font-bold min-w-[120px] bg-black text-white">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                    {semTable.rows.map((row) => {
                      const isFullyReleased = row.status === 'FULLY_RELEASED';
                      const isPartiallyReleased = row.status === 'PARTIALLY_RELEASED';

                      return (
                        <tr
                          key={row.subjectId}
                          className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50 transition-colors"
                        >
                          {/* 1. Subject Name */}
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-neutral-900 dark:text-white text-xs">
                              {row.subjectName}
                            </div>
                            <div className="font-mono text-[11px] text-neutral-400 mt-0.5">
                              {row.subjectCode}
                            </div>
                          </td>

                          {/* 2. CIE-1 Marks */}
                          <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                            {row.cie1Marks !== null && row.cie1Marks !== undefined ? (
                              <span>
                                {row.cie1Marks} <span className="text-neutral-400 font-normal">/ {row.cie1?.maximumMarks || 50}</span>
                              </span>
                            ) : (
                              <span className="text-neutral-400 font-normal">
                                Not Released
                              </span>
                            )}
                          </td>

                          {/* 3. CIE-2 Marks */}
                          <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                            {row.cie2Marks !== null && row.cie2Marks !== undefined ? (
                              <span>
                                {row.cie2Marks} <span className="text-neutral-400 font-normal">/ {row.cie2?.maximumMarks || 50}</span>
                              </span>
                            ) : (
                              <span className="text-neutral-400 font-normal">
                                Not Released
                              </span>
                            )}
                          </td>

                          {/* 4. Assignment Marks */}
                          <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                            {row.assignmentMarks !== null && row.assignmentMarks !== undefined ? (
                              <span>
                                {row.assignmentMarks} <span className="text-neutral-400 font-normal">/ 25</span>
                              </span>
                            ) : (
                              <span className="text-neutral-400 font-normal">
                                Not Released
                              </span>
                            )}
                          </td>

                          {/* 5. Final Internal Marks */}
                          <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                            {row.finalInternalMarks !== null && row.finalInternalMarks !== undefined ? (
                              <span>
                                {row.finalInternalMarks} <span className="text-neutral-400 font-normal">/ 50</span>
                              </span>
                            ) : (
                              <span className="text-neutral-400 font-normal">
                                Not Released
                              </span>
                            )}
                          </td>

                          {/* 6. External Marks */}
                          <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                            {row.externalMarks !== null && row.externalMarks !== undefined ? (
                              <span>
                                {row.externalMarks} <span className="text-neutral-400 font-normal">/ 100</span>
                              </span>
                            ) : (
                              <span className="text-neutral-400 font-normal">
                                Not Released
                              </span>
                            )}
                          </td>

                          {/* 7. Status */}
                          <td className="py-3.5 px-4 text-center font-medium text-neutral-900 dark:text-white">
                            {isFullyReleased
                              ? 'Fully Released'
                              : isPartiallyReleased
                              ? 'Partially Released'
                              : 'Not Released'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentMarksPage;
