import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  User,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Edit3,
  Check,
  X,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import facultyService, {
  FacultyStudentSearchResult,
  FacultyStudentAttendanceData,
  FacultyStudentSubjectAttendance,
} from '../../services/faculty.service';
import { useAcademicYear } from '../../context/AcademicYearContext';

export const FacultyStudentAttendancePage: React.FC = () => {
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();
  const activeAY = academicYear || '2026-27';

  // Search & Results State
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [isSearchingStudents, setIsSearchingStudents] = useState<boolean>(false);
  const [studentSearchResults, setStudentSearchResults] = useState<FacultyStudentSearchResult[]>([]);
  const [hasSearchedStudents, setHasSearchedStudents] = useState<boolean>(false);

  // Selected Student & Attendance Details State
  const [selectedLookupStudentId, setSelectedLookupStudentId] = useState<string | null>(null);
  const [studentAttendanceData, setStudentAttendanceData] = useState<FacultyStudentAttendanceData | null>(null);
  const [loadingStudentAttendance, setLoadingStudentAttendance] = useState<boolean>(false);

  // Toast / Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Reset when academic year changes
  useEffect(() => {
    setSelectedLookupStudentId(null);
    setStudentAttendanceData(null);
    setStudentSearchResults([]);
    setStudentSearchQuery('');
    setHasSearchedStudents(false);
  }, [activeAY]);

  // Debounced student search with auto-selection on single result
  useEffect(() => {
    if (!studentSearchQuery.trim()) {
      setStudentSearchResults([]);
      setHasSearchedStudents(false);
      setIsSearchingStudents(false);
      setSelectedLookupStudentId(null);
      setStudentAttendanceData(null);
      return;
    }

    let isSubscribed = true;

    const timer = setTimeout(async () => {
      setIsSearchingStudents(true);
      try {
        const results = await facultyService.searchStudents(studentSearchQuery, activeAY);
        if (!isSubscribed) return;

        const list = results || [];
        setStudentSearchResults(list);
        setHasSearchedStudents(true);

        // Auto-select and immediately load attendance when exactly one student matches
        if (list.length === 1) {
          handleSelectLookupStudent(list[0].id);
        } else {
          // If multiple or zero results, clear previously loaded student unless still relevant
          setSelectedLookupStudentId((prev) => {
            if (prev && list.some((st) => st.id === prev)) {
              return prev;
            }
            setStudentAttendanceData(null);
            return null;
          });
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        console.error('Failed to search students:', err);
        setStudentSearchResults([]);
        setSelectedLookupStudentId(null);
        setStudentAttendanceData(null);
      } finally {
        if (isSubscribed) {
          setIsSearchingStudents(false);
        }
      }
    }, 300);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [studentSearchQuery, activeAY]);

  // Load detailed attendance for selected student
  const handleSelectLookupStudent = async (studentId: string) => {
    setSelectedLookupStudentId(studentId);
    setLoadingStudentAttendance(true);
    try {
      const data = await facultyService.getStudentAttendance(studentId, activeAY);
      setStudentAttendanceData(data);
    } catch (err: any) {
      console.error('Failed to load student attendance details:', err);
      setNotification({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to load student attendance details.',
      });
      setStudentAttendanceData(null);
    } finally {
      setLoadingStudentAttendance(false);
    }
  };

  // Section label normalization helper
  const formatSectionLabel = (sec: string | undefined | null) => {
    if (!sec) return 'Section A';
    const trimmed = sec.trim();
    if (trimmed.toLowerCase().startsWith('section')) {
      return trimmed;
    }
    return `Section ${trimmed}`;
  };

  // Navigate directly to Attendance correction for this subject
  const handleInitiateSubjectCorrection = (subject: FacultyStudentSubjectAttendance) => {
    navigate('/faculty/attendance', {
      state: {
        assignmentId: subject.facultyAssignmentId,
        sem: subject.semester,
        subjectId: subject.subjectId,
        sessionId: subject.latestSessionId,
        usn: studentAttendanceData?.student?.usn,
      },
    });
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-4 pb-8 text-slate-800">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`py-2.5 px-3.5 rounded-lg shadow-sm flex items-center justify-between transition-all duration-300 text-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 text-base leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Compact ERP Page Header */}
      <div className="bg-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Compact Back Button */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/faculty/attendance')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
            title="Return to Attendance Module"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
            <span>Back to Attendance</span>
          </button>

          {/* Center/Main: Title + Muted Subtitle */}
          
        </div>

        {/* Right: Academic Year Badge */}
        <div className="flex items-center space-x-1.5 bg-indigo-50/90 border border-indigo-200 text-indigo-950 rounded-lg px-2.5 py-1 text-xs font-bold shrink-0 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>AY: {activeAY}</span>
        </div>
      </div>

      {/* SEARCH CARD */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Student Attendance Lookup
            </h2>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              Instant search across enrolled students in your assigned sections
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Authorized Teaching Scope Only</span>
          </div>
        </div>

        {/* SEARCH INPUT */}
        <div className="relative pt-1">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              placeholder="Search student by name or USN..."
              className="w-full h-11 pl-11 pr-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 transition focus:outline-none shadow-2xs"
            />
            {studentSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setStudentSearchQuery('');
                  setSelectedLookupStudentId(null);
                  setStudentAttendanceData(null);
                  setStudentSearchResults([]);
                  setHasSearchedStudents(false);
                }}
                className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SEARCHING STATE */}
      {isSearchingStudents && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 text-center shadow-2xs">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-xs text-slate-600 font-medium">Searching authorized rosters...</p>
        </div>
      )}

      {/* NO RESULTS FOUND STATE */}
      {!isSearchingStudents && hasSearchedStudents && studentSearchResults.length === 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 text-center space-y-1.5 shadow-2xs">
          <UserX className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No student found</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No student matching "{studentSearchQuery}" was found in your assigned sections for AY {activeAY}.
          </p>
        </div>
      )}

      {/* MULTIPLE MATCHES LIST (Shown only when > 1 result found, letting faculty click a card to select) */}
      {!isSearchingStudents && studentSearchResults.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Matching Students ({studentSearchResults.length})
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Click a student to view attendance
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {studentSearchResults.map((st) => {
              const isSelected = selectedLookupStudentId === st.id;
              return (
                <div
                  key={st.id}
                  onClick={() => handleSelectLookupStudent(st.id)}
                  className={`p-4 rounded-xl border-2 transition text-left flex flex-col justify-between gap-3 shadow-2xs cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-600 ring-2 ring-blue-100'
                      : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 bg-slate-900 text-white font-mono text-[11px] font-bold rounded-md">
                        {st.usn}
                      </span>
                      {isSelected ? (
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Selected</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          {st.assignedSubjectsCount} Assigned Course{st.assignedSubjectsCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {st.name}
                    </h3>

                    <p className="text-xs text-slate-500 font-medium mt-1">
                      {st.departmentCode} &bull; Semester {st.semester} &bull; {formatSectionLabel(st.section)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SELECTED STUDENT ATTENDANCE REPORT */}
      {loadingStudentAttendance ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-xs text-slate-600 font-medium">Calculating student attendance for assigned subjects...</p>
        </div>
      ) : studentAttendanceData ? (
        <div className="space-y-4">
          {/* STUDENT INFORMATION SUMMARY */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Student Information</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Enrolled cohort details</p>
                </div>
              </div>

              <span className="px-2.5 py-1 bg-slate-900 text-white font-mono text-xs font-bold rounded-md">
                {studentAttendanceData.student.usn}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Name</span>
                <span className="font-bold text-slate-900 text-sm">{studentAttendanceData.student.name}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department</span>
                <span className="font-bold text-slate-900 text-sm">{studentAttendanceData.student.departmentCode}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Semester</span>
                <span className="font-bold text-slate-900 text-sm">Semester {studentAttendanceData.student.semester}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Section</span>
                <span className="font-bold text-slate-900 text-sm">{formatSectionLabel(studentAttendanceData.student.section)}</span>
              </div>
            </div>
          </div>

          {/* ATTENDANCE FOR YOUR ASSIGNED SUBJECTS */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Your Assigned Subjects</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Attendance percentage and class summary strictly for subjects you teach
                </p>
              </div>

              <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md self-start sm:self-auto">
                {studentAttendanceData.subjects.length} Assigned Subject{studentAttendanceData.subjects.length !== 1 ? 's' : ''}
              </span>
            </div>

            {studentAttendanceData.subjects.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No attendance available for your assigned subjects</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  This student is not enrolled in any sections or subjects assigned to your faculty profile in Academic Year {activeAY}.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800 text-[11px]">
                    <tr>
                      <th className="py-3 px-4 text-white font-extrabold">Subject</th>
                      <th className="py-3 px-3 text-white font-extrabold">Code</th>
                      <th className="py-3 px-3 text-white font-extrabold">Section</th>
                      <th className="py-3 px-3 text-center text-white font-extrabold">Classes</th>
                      <th className="py-3 px-3 text-center text-white font-extrabold">Attended</th>
                      <th className="py-3 px-3 text-center text-white font-extrabold">Absent</th>
                      <th className="py-3 px-3 text-center text-white font-extrabold">%</th>
                      <th className="py-3 px-3 text-center text-white font-extrabold">Status</th>
                      <th className="py-3 px-4 text-center text-white font-extrabold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentAttendanceData.subjects.map((sub) => {
                      const isConducted = sub.conductedClasses > 0;
                      const isEligible = sub.eligibilityStatus === 'Eligible';

                      return (
                        <tr key={sub.facultyAssignmentId} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-sm">{sub.subjectName}</div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {sub.type} &bull; {sub.credits} Credits &bull; Sem {sub.semester}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-[11px] font-bold rounded">
                              {sub.subjectCode}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 font-bold rounded text-[11px]">
                              {formatSectionLabel(sub.sectionName)}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                            {sub.conductedClasses}
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-emerald-700">
                            {sub.attendedClasses}
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-rose-700">
                            {sub.absentClasses}
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            {isConducted && sub.attendancePercentage !== null ? (
                              <span className="font-extrabold text-sm text-slate-900">
                                {sub.attendancePercentage}%
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 italic">
                                No attendance recorded
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            {isConducted ? (
                              isEligible ? (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-extrabold text-[11px] inline-flex items-center space-x-1">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Eligible</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full font-extrabold text-[11px] inline-flex items-center space-x-1">
                                  <X className="w-3 h-3 text-rose-600" />
                                  <span>Not Eligible</span>
                                </span>
                              )
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-medium text-[11px]">
                                No attendance recorded
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleInitiateSubjectCorrection(sub)}
                              disabled={!sub.canCorrect}
                              className="h-8 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                              title="Open Attendance Correction for this Subject"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                              <span>Correction</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FacultyStudentAttendancePage;
