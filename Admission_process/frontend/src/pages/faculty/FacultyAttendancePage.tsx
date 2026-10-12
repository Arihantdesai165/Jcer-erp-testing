import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CalendarCheck,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
  Search,
  Calendar,
  Clock,
  Save,
  ChevronRight,
  ArrowLeft,
  Info,
  Users,
  History,
  ChevronDown,
  ChevronUp,
  Edit3,
  ShieldCheck,
  Check,
  X,
  Lock,
  FileSpreadsheet,
  UserX,
  UserCheck,
  User,
} from 'lucide-react';
import facultyService, {
  FacultyAssignmentItem,
  FacultyAttendanceWorkspaceData,
  RecordedSessionItem,
  AttendanceHistoryData,
  AttendanceSessionDetailData,
  CorrectionStudentRow,
  AttendanceCorrectionLogItem,
} from '../../services/faculty.service';
import { useAcademicYear } from '../../context/AcademicYearContext';

export const FacultyAttendancePage: React.FC = () => {
  const location = useLocation();
  const { academicYear, setAcademicYear, academicYears } = useAcademicYear();
  const activeAY = academicYear || '2026-27';

  // Available academic year options
  const availableYearOptions = useMemo(() => {
    const list = [...academicYears];
    if (!list.some((y) => y.year === activeAY)) {
      list.unshift({ id: `ay-${activeAY}`, year: activeAY });
    }
    return list;
  }, [academicYears, activeAY]);

  const handleAcademicYearChange = (newYear: string) => {
    if (newYear === activeAY) return;
    setAcademicYear(newYear);
    setSelectedAssignmentId(null);
    setSelectedSubjectId(null);
    setSelectedSemNum(null);
    setWorkspaceData(null);
    setCurrentView('SEMESTERS');
  };

  // Reset view when active academic year changes
  useEffect(() => {
    setSelectedAssignmentId(null);
    setSelectedSubjectId(null);
    setSelectedSemNum(null);
    setWorkspaceData(null);
    setCurrentView('SEMESTERS');
  }, [activeAY]);

  // Navigation View State: 'SEMESTERS' | 'SUBJECTS' | 'SECTIONS' | 'WORKSPACE'
  const [currentView, setCurrentView] = useState<'SEMESTERS' | 'SUBJECTS' | 'SECTIONS' | 'WORKSPACE'>('SEMESTERS');

  // Selected Scope States
  const [selectedSemNum, setSelectedSemNum] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Core Data States
  const [courses, setCourses] = useState<FacultyAssignmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Workspace Data & Date/Period State
  const [workspaceData, setWorkspaceData] = useState<FacultyAttendanceWorkspaceData | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [showPreviousDetails, setShowPreviousDetails] = useState<boolean>(true);

  // Workspace Sub-Tab: 'TAKE' | 'CORRECTION' | 'HISTORY'
  const [workspaceTab, setWorkspaceTab] = useState<'TAKE' | 'CORRECTION' | 'HISTORY'>('TAKE');

  // Correction Mode States
  const [historyData, setHistoryData] = useState<AttendanceHistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [selectedCorrectionSessionId, setSelectedCorrectionSessionId] = useState<string | null>(null);
  const [correctionSessionData, setCorrectionSessionData] = useState<AttendanceSessionDetailData | null>(null);
  const [loadingCorrectionSession, setLoadingCorrectionSession] = useState<boolean>(false);
  const [correctionSearchQuery, setCorrectionSearchQuery] = useState<string>('');

  // Bulk / Single Correction Selection & Modal
  const [selectedStudentIdsForCorrection, setSelectedStudentIdsForCorrection] = useState<string[]>([]);
  const [targetCorrectionStatus, setTargetCorrectionStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [studentsToConfirm, setStudentsToConfirm] = useState<Array<{ id: string; usn: string; name: string; oldStatus: string }>>([]);
  const [correctionReason, setCorrectionReason] = useState<string>('Approved Attendance Permission');
  const [correctionRemarks, setCorrectionRemarks] = useState<string>('');
  const [submittingCorrection, setSubmittingCorrection] = useState<boolean>(false);

  // Audit Logs
  const [assignmentCorrections, setAssignmentCorrections] = useState<AttendanceCorrectionLogItem[]>([]);
  const [loadingAssignmentCorrections, setLoadingAssignmentCorrections] = useState<boolean>(false);

  // Active Session Map: { [studentId]: 'PRESENT' | 'ABSENT' | 'EXCUSED' }
  const [sessionAttendance, setSessionAttendance] = useState<{ [studentId: string]: 'PRESENT' | 'ABSENT' | 'EXCUSED' }>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Section label normalization helper (prevents "Section Section A")
  const formatSectionLabel = (sec: string | undefined | null) => {
    if (!sec) return 'Section A';
    const trimmed = sec.trim();
    if (trimmed.toLowerCase().startsWith('section')) {
      return trimmed;
    }
    return `Section ${trimmed}`;
  };

  // Load all attendance courses for active AY
  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const list = await facultyService.getAttendanceCourses(undefined, activeAY);
      setCourses(list || []);
    } catch (err: any) {
      console.error('Failed to load attendance courses:', err);
      const errMsg = err.response?.data?.error || 'Unable to load attendance data. Please refresh and try again.';
      setNotification({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setLoading(false);
    }
  }, [activeAY]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Load Workspace details for a selected assignment
  const loadWorkspace = useCallback(async (assignmentId: string) => {
    setLoadingWorkspace(true);
    try {
      const data = await facultyService.getAttendanceWorkspace(assignmentId);
      setWorkspaceData(data);
    } catch (err: any) {
      console.error('Failed to load workspace:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to load section attendance workspace.',
      });
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  // Load Attendance Session History for Assignment
  const loadAttendanceHistory = useCallback(async (assignmentId: string) => {
    setLoadingHistory(true);
    try {
      const data = await facultyService.getAttendanceHistory(assignmentId);
      setHistoryData(data);
    } catch (err: any) {
      console.error('Failed to load attendance history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load Session Detail for Correction
  const loadCorrectionSessionDetail = useCallback(async (sessionId: string) => {
    setLoadingCorrectionSession(true);
    setSelectedStudentIdsForCorrection([]);
    try {
      const data = await facultyService.getAttendanceSessionDetail(sessionId);
      setCorrectionSessionData(data);
    } catch (err: any) {
      console.error('Failed to load correction session details:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Failed to load session details for correction.',
      });
    } finally {
      setLoadingCorrectionSession(false);
    }
  }, []);

  // Load Full Assignment Correction Audit Logs
  const loadAssignmentCorrections = useCallback(async (assignmentId: string) => {
    setLoadingAssignmentCorrections(true);
    try {
      const logs = await facultyService.getAttendanceCorrections(assignmentId);
      setAssignmentCorrections(logs);
    } catch (err: any) {
      console.error('Failed to load assignment corrections:', err);
    } finally {
      setLoadingAssignmentCorrections(false);
    }
  }, []);

  // Handle direct transition into correction if navigated with location.state
  useEffect(() => {
    if (location.state?.assignmentId) {
      const { assignmentId, sem, subjectId, sessionId, usn } = location.state;
      setSelectedAssignmentId(assignmentId);
      if (sem) setSelectedSemNum(sem);
      if (subjectId) setSelectedSubjectId(subjectId);
      setCurrentView('WORKSPACE');
      setWorkspaceTab('CORRECTION');
      loadWorkspace(assignmentId);
      loadAttendanceHistory(assignmentId);
      if (sessionId) {
        handleSelectSessionForCorrection(sessionId);
      }
      if (usn) {
        setCorrectionSearchQuery(usn);
      }
    }
  }, [location.state, loadWorkspace, loadAttendanceHistory]);

  // Synchronize initial session attendance map whenever workspaceData, date, or period changes
  useEffect(() => {
    if (!workspaceData || !workspaceData.students) return;

    const initialMap: { [studentId: string]: 'PRESENT' | 'ABSENT' | 'EXCUSED' } = {};

    workspaceData.students.forEach((st) => {
      const recorded = st.sessions ? st.sessions[selectedDate] : undefined;
      if (recorded && recorded !== 'UNRECORDED') {
        initialMap[st.id] = recorded;
      } else {
        initialMap[st.id] = 'PRESENT';
      }
    });

    setSessionAttendance(initialMap);
  }, [workspaceData, selectedDate, selectedPeriod]);

  // Handle Tab Switch inside Workspace
  const handleTabChange = (newTab: 'TAKE' | 'CORRECTION' | 'HISTORY') => {
    setWorkspaceTab(newTab);
    setSelectedStudentIdsForCorrection([]);
    if (selectedAssignmentId) {
      if (newTab === 'CORRECTION') {
        loadAttendanceHistory(selectedAssignmentId);
      } else if (newTab === 'HISTORY') {
        loadAttendanceHistory(selectedAssignmentId);
        loadAssignmentCorrections(selectedAssignmentId);
      }
    }
  };

  // Open Correction Workspace for a specific session ID
  const handleSelectSessionForCorrection = (sessionId: string) => {
    setSelectedCorrectionSessionId(sessionId);
    loadCorrectionSessionDetail(sessionId);
  };

  // Back from Session Correction Workspace to Session List
  const handleBackToSessionsList = () => {
    setSelectedCorrectionSessionId(null);
    setCorrectionSessionData(null);
    setSelectedStudentIdsForCorrection([]);
    if (selectedAssignmentId) {
      loadAttendanceHistory(selectedAssignmentId);
    }
  };

  // Find existing session info for selected date & period
  const existingSession: RecordedSessionItem | undefined = useMemo(() => {
    if (!workspaceData || !workspaceData.recordedSessions) return undefined;
    return workspaceData.recordedSessions.find(
      (s) => s.date === selectedDate && s.sessionPeriod === selectedPeriod
    );
  }, [workspaceData, selectedDate, selectedPeriod]);

  // Previous class session
  const previousClassInfo = useMemo(() => {
    if (!workspaceData) return null;
    return workspaceData.previousClass || null;
  }, [workspaceData]);

  // Distinct Semesters
  const distinctSemesters = useMemo(() => {
    const sems = new Set<number>();
    courses.forEach((c) => {
      if (typeof c.semester === 'number') sems.add(c.semester);
    });
    return Array.from(sems).sort((a, b) => a - b);
  }, [courses]);

  // Subjects for selected semester
  const subjectsForSelectedSem = useMemo(() => {
    if (selectedSemNum === null) return [];
    const map = new Map<string, { subjectId: string; subjectName: string; subjectCode: string; count: number; credits?: number; type?: string }>();
    courses
      .filter((c) => c.semester === selectedSemNum)
      .forEach((c) => {
        if (!map.has(c.subjectId)) {
          map.set(c.subjectId, {
            subjectId: c.subjectId,
            subjectName: c.subjectName,
            subjectCode: c.subjectCode,
            count: 0,
            credits: c.credits,
            type: c.type,
          });
        }
        map.get(c.subjectId)!.count += 1;
      });
    return Array.from(map.values());
  }, [courses, selectedSemNum]);

  // Sections for selected subject & semester
  const sectionsForSelectedSubject = useMemo(() => {
    if (selectedSemNum === null || !selectedSubjectId) return [];
    return courses.filter(
      (c) => c.semester === selectedSemNum && c.subjectId === selectedSubjectId
    );
  }, [courses, selectedSemNum, selectedSubjectId]);

  // Selected assignment item details
  const selectedAssignmentItem = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return courses.find((c) => c.id === selectedAssignmentId) || null;
  }, [courses, selectedAssignmentId]);

  // Navigation handlers
  const handleSelectSemester = (sem: number) => {
    setSelectedSemNum(sem);
    setSelectedSubjectId(null);
    setSelectedAssignmentId(null);
    setWorkspaceData(null);
    setCurrentView('SUBJECTS');
  };

  const handleSelectSubject = (subjId: string) => {
    setSelectedSubjectId(subjId);
    setSelectedAssignmentId(null);
    setWorkspaceData(null);
    setCurrentView('SECTIONS');
  };

  const handleSelectAssignment = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setCurrentView('WORKSPACE');
    setWorkspaceTab('TAKE');
    setSelectedCorrectionSessionId(null);
    setCorrectionSessionData(null);
    loadWorkspace(assignmentId);
  };

  const handleBackToSemesters = () => {
    setSelectedSemNum(null);
    setSelectedSubjectId(null);
    setSelectedAssignmentId(null);
    setWorkspaceData(null);
    setCurrentView('SEMESTERS');
  };

  const handleBackToSubjects = () => {
    setSelectedSubjectId(null);
    setSelectedAssignmentId(null);
    setWorkspaceData(null);
    setCurrentView('SUBJECTS');
  };

  const handleBackToSections = () => {
    setSelectedAssignmentId(null);
    setWorkspaceData(null);
    setCurrentView('SECTIONS');
  };

  // Quick toggle single student status in Normal Take Workspace
  const handleToggleStudent = (studentId: string) => {
    setSessionAttendance((prev) => {
      const current = prev[studentId] || 'PRESENT';
      const nextStatus = current === 'PRESENT' ? 'ABSENT' : 'PRESENT';
      return { ...prev, [studentId]: nextStatus };
    });
  };

  // Mark all students present or absent
  const handleMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    if (!workspaceData || !workspaceData.students) return;
    const updated: { [studentId: string]: 'PRESENT' | 'ABSENT' | 'EXCUSED' } = {};
    workspaceData.students.forEach((st) => {
      updated[st.id] = status;
    });
    setSessionAttendance(updated);
  };

  // Save attendance session submission
  const handleSaveAttendance = async () => {
    if (!selectedAssignmentId) return;

    const records = Object.entries(sessionAttendance).map(([studentId, status]) => ({
      studentId,
      status,
    }));

    if (records.length === 0) {
      setNotification({
        type: 'error',
        message: 'No student records to save.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const updatedWorkspace = await facultyService.saveAttendance(selectedAssignmentId, {
        date: selectedDate,
        sessionPeriod: selectedPeriod,
        records,
      });
      setWorkspaceData(updatedWorkspace);
      setNotification({
        type: 'success',
        message: `Attendance saved successfully for ${selectedDate} (Period ${selectedPeriod}).`,
      });
      await loadCourses();
    } catch (err: any) {
      console.error('Failed to save attendance:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Failed to save attendance records.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Excel Attendance Register Export
  const handleExportExcel = async () => {
    if (!selectedAssignmentId) {
      setNotification({
        type: 'error',
        message: 'No active teaching assignment selected for export.',
      });
      return;
    }

    try {
      setIsExportingExcel(true);
      await facultyService.exportAttendanceExcel(selectedAssignmentId);
      setNotification({
        type: 'success',
        message: 'Attendance Register Excel exported successfully.',
      });
    } catch (err: any) {
      console.error('Export failed:', err);
      setNotification({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to export Attendance Register Excel.',
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Live Summary Calculations for Take Workspace
  const currentPresentCount = useMemo(() => {
    return Object.values(sessionAttendance).filter((s) => s === 'PRESENT').length;
  }, [sessionAttendance]);

  const currentAbsentCount = useMemo(() => {
    return Object.values(sessionAttendance).filter((s) => s === 'ABSENT').length;
  }, [sessionAttendance]);

  const currentTotalCount = useMemo(() => {
    return workspaceData?.students ? workspaceData.students.length : 0;
  }, [workspaceData]);

  const currentAttendancePct = useMemo(() => {
    if (currentTotalCount === 0) return 0;
    return Number(((currentPresentCount / currentTotalCount) * 100).toFixed(1));
  }, [currentPresentCount, currentTotalCount]);

  // Filtered Students for Take Workspace
  const filteredWorkspaceStudents = useMemo(() => {
    if (!workspaceData || !workspaceData.students) return [];
    let list = workspaceData.students;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((st) => {
        const matchName = st.studentName.toLowerCase().includes(q);
        const matchUsn = st.usn.toLowerCase().includes(q);
        return matchName || matchUsn;
      });
    }
    const isSem1 = Number(selectedAssignmentItem?.semester ?? workspaceData.assignment?.semester) === 1;
    return [...list].sort((a, b) => {
      if (isSem1) {
        const nameA = (a.studentName || '').trim().toLowerCase();
        const nameB = (b.studentName || '').trim().toLowerCase();
        const cmp = nameA.localeCompare(nameB);
        if (cmp !== 0) return cmp;
        return (a.usn || '').trim().toLowerCase().localeCompare((b.usn || '').trim().toLowerCase());
      } else {
        const usnA = (a.usn || '').trim().toLowerCase();
        const usnB = (b.usn || '').trim().toLowerCase();
        const cmp = usnA.localeCompare(usnB);
        if (cmp !== 0) return cmp;
        return (a.studentName || '').trim().toLowerCase().localeCompare((b.studentName || '').trim().toLowerCase());
      }
    });
  }, [workspaceData, searchQuery, selectedAssignmentItem]);

  // Filtered Students for Correction Workspace
  const filteredCorrectionStudents = useMemo(() => {
    if (!correctionSessionData || !correctionSessionData.students) return [];
    let list = correctionSessionData.students;
    if (correctionSearchQuery.trim()) {
      const q = correctionSearchQuery.toLowerCase().trim();
      list = list.filter((st) => {
        const matchName = st.studentName.toLowerCase().includes(q);
        const matchUsn = st.usn.toLowerCase().includes(q);
        return matchName || matchUsn;
      });
    }
    const isSem1 = Number(correctionSessionData.assignment?.semester ?? selectedAssignmentItem?.semester) === 1;
    return [...list].sort((a, b) => {
      if (isSem1) {
        const nameA = (a.studentName || '').trim().toLowerCase();
        const nameB = (b.studentName || '').trim().toLowerCase();
        const cmp = nameA.localeCompare(nameB);
        if (cmp !== 0) return cmp;
        return (a.usn || '').trim().toLowerCase().localeCompare((b.usn || '').trim().toLowerCase());
      } else {
        const usnA = (a.usn || '').trim().toLowerCase();
        const usnB = (b.usn || '').trim().toLowerCase();
        const cmp = usnA.localeCompare(usnB);
        if (cmp !== 0) return cmp;
        return (a.studentName || '').trim().toLowerCase().localeCompare((b.studentName || '').trim().toLowerCase());
      }
    });
  }, [correctionSessionData, correctionSearchQuery, selectedAssignmentItem]);

  // Toggle selection for a single student in Correction Workspace
  const handleToggleCorrectionStudentSelect = (studentId: string) => {
    setSelectedStudentIdsForCorrection((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Select all absent students in Correction Workspace
  const handleSelectAllAbsentForCorrection = () => {
    if (!correctionSessionData) return;
    const absentIds = correctionSessionData.students
      .filter((st) => st.currentStatus === 'ABSENT')
      .map((st) => st.studentId);
    setSelectedStudentIdsForCorrection(absentIds);
  };

  // Clear correction selection
  const handleClearCorrectionSelection = () => {
    setSelectedStudentIdsForCorrection([]);
  };

  // Trigger Confirmation Modal for Single Student
  const handleInitiateSingleCorrection = (student: CorrectionStudentRow, targetStatus: 'PRESENT' | 'ABSENT') => {
    if (correctionSessionData?.session?.isLocked) {
      setNotification({
        type: 'error',
        message: 'This attendance session is locked and cannot be modified.',
      });
      return;
    }
    setTargetCorrectionStatus(targetStatus);
    setStudentsToConfirm([
      {
        id: student.studentId,
        usn: student.usn,
        name: student.studentName,
        oldStatus: student.currentStatus,
      },
    ]);
    setCorrectionReason('Approved Attendance Permission');
    setCorrectionRemarks('');
    setIsConfirmModalOpen(true);
  };

  // Trigger Confirmation Modal for Bulk Selection
  const handleInitiateBulkCorrection = (targetStatus: 'PRESENT' | 'ABSENT') => {
    if (correctionSessionData?.session?.isLocked) {
      setNotification({
        type: 'error',
        message: 'This attendance session is locked and cannot be modified.',
      });
      return;
    }
    if (selectedStudentIdsForCorrection.length === 0) {
      setNotification({
        type: 'error',
        message: 'Please select at least one student to correct.',
      });
      return;
    }

    if (!correctionSessionData) return;

    const studentMap = new Map(correctionSessionData.students.map((s) => [s.studentId, s]));
    const list: Array<{ id: string; usn: string; name: string; oldStatus: string }> = [];

    selectedStudentIdsForCorrection.forEach((id) => {
      const st = studentMap.get(id);
      if (st) {
        list.push({
          id: st.studentId,
          usn: st.usn,
          name: st.studentName,
          oldStatus: st.currentStatus,
        });
      }
    });

    setTargetCorrectionStatus(targetStatus);
    setStudentsToConfirm(list);
    setCorrectionReason('Approved Attendance Permission');
    setCorrectionRemarks('');
    setIsConfirmModalOpen(true);
  };

  // Execute Correction Submission
  const handleConfirmCorrectionSubmit = async () => {
    if (!selectedCorrectionSessionId || studentsToConfirm.length === 0) return;

    if (correctionReason === 'Other' && !correctionRemarks.trim()) {
      setNotification({
        type: 'error',
        message: 'Remarks are required when reason is "Other".',
      });
      return;
    }

    setSubmittingCorrection(true);
    try {
      const changes = studentsToConfirm.map((st) => ({
        studentId: st.id,
        newStatus: targetCorrectionStatus,
        reason: correctionReason,
        remarks: correctionRemarks.trim() || undefined,
      }));

      const updatedDetail = await facultyService.correctAttendance(selectedCorrectionSessionId, { changes });
      setCorrectionSessionData(updatedDetail);
      setSelectedStudentIdsForCorrection([]);
      setIsConfirmModalOpen(false);

      if (selectedAssignmentId) {
        loadWorkspace(selectedAssignmentId);
        loadAttendanceHistory(selectedAssignmentId);
      }

      setNotification({
        type: 'success',
        message: `Attendance corrected successfully for ${changes.length} student(s) (${targetCorrectionStatus}).`,
      });
    } catch (err: any) {
      console.error('Correction submission failed:', err);
      setNotification({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to update attendance records.',
      });
    } finally {
      setSubmittingCorrection(false);
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-3.5 pb-8 text-slate-800">
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
            className="text-slate-400 hover:text-slate-600 p-0.5 text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* COMPACT HEADER (SELECTION SCREENS ONLY) */}
      {currentView !== 'WORKSPACE' && (
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Students Attendance Entry
            </h1>
            
          </div>

          <div className="flex items-center space-x-2 bg-indigo-50/90 border border-indigo-200 rounded-lg px-2.5 py-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-indigo-950">AY: {activeAY}</span>
          </div>
        </div>
      )}

      {/* LEVEL 1: SEMESTER CARDS */}
      {currentView === 'SEMESTERS' && (
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">SELECT SEMESTER</h2>
            <span className="text-xs font-semibold text-slate-500">
              {distinctSemesters.length} Assigned Semester{distinctSemesters.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="bg-white p-8 rounded-2xl border-[2.5px] border-black text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-800 mx-auto mb-2" />
              <p className="text-slate-600 font-medium text-xs">Loading assigned semesters...</p>
            </div>
          ) : distinctSemesters.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border-[2.5px] border-black text-center space-y-2">
              <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Teaching Assignments Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                You do not have any active teaching courses assigned for Academic Year {activeAY}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
              {distinctSemesters.map((sem) => {
                const count = courses.filter((c) => c.semester === sem).length;
                return (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => handleSelectSemester(sem)}
                    className="bg-white p-5 sm:p-6 rounded-[14px] border-[3.5px] border-black shadow-sm hover:border-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-160 text-left group flex flex-col justify-between min-h-[170px] cursor-pointer w-full"
                  >
                    <div>
                      {/* TOP ROW: SEM BADGE + ARROW */}
                      <div className="flex items-center justify-between mb-3.5">
                        <span className="px-3 py-1 bg-slate-100 text-slate-900 text-[12px] font-extrabold rounded-[7px] border border-slate-300">
                          SEM {sem}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-black group-hover:translate-x-1 transition-all" />
                      </div>

                      {/* SEMESTER TITLE */}
                      <h3 className="text-[20px] font-bold text-[#111827] group-hover:text-black transition-colors leading-snug">
                        Semester {sem}
                      </h3>
                      <p className="text-[13px] text-[#64748b] font-medium mt-1">
                        Academic Attendance
                      </p>
                    </div>

                    {/* FOOTER */}
                    <div className="pt-3.5 mt-4 border-t border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5 text-slate-700 font-semibold">
                        <Users className="w-3.5 h-3.5 text-slate-600" />
                        <span>{count} Section{count !== 1 ? 's' : ''} Assigned</span>
                      </div>
                      <span className="font-extrabold text-slate-900 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                        <span>OPEN</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 2: SUBJECT CARDS */}
      {currentView === 'SUBJECTS' && (
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between px-0.5">
            <button
              type="button"
              onClick={handleBackToSemesters}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border-[2.5px] border-black rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
              <span>Back to Semesters</span>
            </button>
            <span className="text-xs font-bold text-slate-500">
              Semester {selectedSemNum} &bull; {subjectsForSelectedSem.length} Subject{subjectsForSelectedSem.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
            {subjectsForSelectedSem.map((subj) => (
              <button
                key={subj.subjectId}
                type="button"
                onClick={() => handleSelectSubject(subj.subjectId)}
                className="bg-white p-5 sm:p-6 rounded-[14px] border-[3.5px] border-black shadow-sm hover:border-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-160 text-left group flex flex-col justify-between min-h-[175px] cursor-pointer w-full"
              >
                <div>
                  {/* TOP ROW: Subject Code Badge (Never clipped, explicitly white text) + Section Count Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <span
                      style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                      className="badge-dark text-[12px] font-extrabold tracking-[0.4px] px-3 py-1.5 rounded-[7px] whitespace-nowrap shrink-0 font-mono shadow-xs border border-slate-900"
                    >
                      {subj.subjectCode}
                    </span>
                    <span className="bg-slate-100 border border-slate-300 text-slate-800 rounded-full px-3 py-1 text-[12px] font-bold flex items-center gap-1.5 shrink-0">
                      <Users className="w-3.5 h-3.5 text-slate-700" />
                      <span>{subj.count} Section{subj.count !== 1 ? 's' : ''}</span>
                    </span>
                  </div>

                  {/* SUBJECT NAME: Main title, preserving database casing */}
                  <h3 className="text-[20px] font-bold text-[#111827] group-hover:text-black transition-colors leading-snug">
                    {subj.subjectName}
                  </h3>

                  {/* METADATA: Semester & Credits */}
                  <p className="text-[13px] text-[#64748b] font-medium mt-1">
                    Semester {selectedSemNum} &bull; {subj.credits || 4} Credits
                  </p>
                </div>

                {/* FOOTER */}
                <div className="pt-3.5 mt-4 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Sections available</span>
                  <span className="font-extrabold text-slate-900 flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                    <span>SELECT SECTIONS</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LEVEL 3: SECTION CARDS */}
      {currentView === 'SECTIONS' && (
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between px-0.5">
            <button
              type="button"
              onClick={handleBackToSubjects}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border-[2.5px] border-black rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
              <span>Back to Subjects</span>
            </button>
            <span className="text-xs font-bold text-slate-500">
              {sectionsForSelectedSubject.length} Section{sectionsForSelectedSubject.length !== 1 ? 's' : ''} Available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
            {sectionsForSelectedSubject.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectAssignment(item.id)}
                className="bg-white p-5 sm:p-6 rounded-[14px] border-[3.5px] border-black shadow-sm hover:border-black hover:shadow-md hover:-translate-y-0.5 transition-all duration-160 text-left group flex flex-col justify-between min-h-[170px] cursor-pointer w-full"
              >
                <div>
                  {/* TOP ROW: SECTION BADGE on left, DEPARTMENT BADGE on right */}
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <span className="bg-slate-100 text-slate-900 border border-slate-300 text-[12px] font-bold px-2.5 py-1 rounded-[6px] uppercase tracking-wide">
                      {formatSectionLabel(item.section).toUpperCase()}
                    </span>
                    <span className="bg-slate-100 border border-slate-300 text-slate-800 text-[12px] font-bold px-2.5 py-1 rounded-[6px]">
                      {item.departmentCode || 'CSE'}
                    </span>
                  </div>

                  {/* SUBJECT NAME */}
                  <h3 className="text-[20px] font-bold text-[#111827] group-hover:text-black transition-colors leading-snug">
                    {item.subjectName}
                  </h3>

                  {/* SECTION SUBJECT CODE: Explicitly white text */}
                  <div className="mt-2.5">
                    <span
                      style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                      className="badge-dark inline-block text-[12px] font-extrabold tracking-[0.4px] px-3 py-1 rounded-[6px] font-mono shadow-xs border border-slate-900"
                    >
                      {item.subjectCode}
                    </span>
                  </div>
                </div>

                {/* SECTION CARD FOOTER */}
                <div className="pt-3.5 mt-4 border-t border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-700 font-semibold">
                    <Users className="w-3.5 h-3.5 text-slate-600" />
                    <span>{item.totalStudents} Students</span>
                  </div>
                  <span className="font-extrabold text-slate-900 flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                    <span>OPEN WORKSPACE</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}


      {/* LEVEL 4: WORKSPACE (TAKE ATTENDANCE | ATTENDANCE CORRECTION | HISTORY & AUDIT) */}
      {currentView === 'WORKSPACE' && selectedAssignmentItem && (
        <div className="space-y-3.5">
          {/* 1. SEPARATE BACK BUTTON ABOVE THE SUBJECT CARD */}
          <div>
            <button
              type="button"
              onClick={handleBackToSections}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
              <span>Back to Sections</span>
            </button>
          </div>

          {/* 2. STRUCTURED SUBJECT CARD */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
            {/* TOP ROW: Subject Name on LEFT, Academic Year on RIGHT */}
            <div className="flex flex-row items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                {selectedAssignmentItem.subjectName}
              </h2>

              <div className="flex items-center space-x-1.5 bg-indigo-50/90 border border-indigo-200 text-indigo-950 rounded-lg px-2.5 py-1 text-xs font-bold shrink-0">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Academic Year: {activeAY}</span>
              </div>
            </div>

            {/* SUBJECT METADATA BADGES */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-slate-900 text-white font-mono text-xs font-bold rounded-md tracking-wide shadow-2xs">
                {selectedAssignmentItem.subjectCode}
              </span>

              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-md">
                {selectedAssignmentItem.type || 'IPCC'}
              </span>

              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium rounded-md">
                {selectedAssignmentItem.credits || 4} Credits
              </span>

              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-md">
                {formatSectionLabel(selectedAssignmentItem.section)}
              </span>

              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-md">
                Semester {selectedAssignmentItem.semester}
              </span>

              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium rounded-md inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentTotalCount} Students</span>
              </span>
            </div>

            {/* ACTION ROW: ALL ACTIONS ON HORIZONTAL ROW */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Left Action Group (Take Attendance, Student Attendance, Correction, History) */}
              <div className="flex flex-row items-center gap-2.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handleTabChange('TAKE')}
                  className={`h-[42px] px-3.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition shrink-0 cursor-pointer ${
                    workspaceTab === 'TAKE'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4 shrink-0" />
                  <span>Take Attendance</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('CORRECTION')}
                  className={`h-[42px] px-3.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition shrink-0 cursor-pointer ${
                    workspaceTab === 'CORRECTION'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <Edit3 className="w-4 h-4 shrink-0" />
                  <span>Correction</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('HISTORY')}
                  className={`h-[42px] px-3.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition shrink-0 cursor-pointer ${
                    workspaceTab === 'HISTORY'
                      ? 'bg-indigo-700 hover:bg-indigo-800 text-white shadow-xs'
                      : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <History className="w-4 h-4 shrink-0" />
                  <span>History & Audit</span>
                </button>
              </div>

              {/* Right Action: Export Excel */}
              <div className="shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className="h-[42px] px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 transition shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Export Section Attendance Register (Excel)"
                >
                  {isExportingExcel ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <Download className="w-3.5 h-3.5" />
                    </>
                  )}
                  <span>{isExportingExcel ? 'Exporting...' : 'Export Excel'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* TAB 1: NORMAL TAKE ATTENDANCE (TWO-COLUMN PRODUCTIVITY LAYOUT) */}
          {workspaceTab === 'TAKE' && (
            <div className="space-y-3.5">
              {/* STICKY COMPACT ATTENDANCE TOOLBAR (DATE, PERIOD, METRICS & SAVE) */}
              <div className="sticky top-2 z-30 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Left: Date + Period Controls + Session Status Badge */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Date Input */}
                  <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-9">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500">Date:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Period Input */}
                  <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-9">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500">Period:</span>
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                      className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer pr-1"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                        <option key={p} value={p}>
                          Period {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Session Status Chip */}
                  {existingSession ? (
                    <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Recorded</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                      <span>New Session</span>
                    </span>
                  )}
                </div>

                {/* Right: Inline Counter Badges + Primary Save Button */}
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 w-full md:w-auto">
                  {/* Total Chip */}
                  <span className="px-2.5 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold">
                    {currentTotalCount} Total
                  </span>

                  {/* Present Chip */}
                  <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{currentPresentCount} Present</span>
                  </span>

                  {/* Absent Chip */}
                  <span className="px-2.5 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold flex items-center space-x-1">
                    <X className="w-3.5 h-3.5 text-rose-600" />
                    <span>{currentAbsentCount} Absent</span>
                  </span>

                  {/* Percentage Chip */}
                  <span className="px-2.5 py-1.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-extrabold">
                    {currentAttendancePct}%
                  </span>

                  {/* Primary Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={submitting || loadingWorkspace}
                    className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer shrink-0"
                    title="Save Attendance"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>SAVE ATTENDANCE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* TWO-COLUMN PRODUCTIVITY GRID (70% ATTENDANCE ROSTER / 30% PREVIOUS CLASS REFERENCE) */}
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(290px,3fr)] gap-[18px] items-start">
                {/* LEFT PANEL (70%): TODAY'S ATTENDANCE ROSTER */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 space-y-3">
                  {/* Left Panel Title & Header Strip */}
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                        Today's Attendance
                      </h3>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-semibold">
                        {filteredWorkspaceStudents.length} Students
                      </span>
                    </div>
                  </div>

                  {/* Search & Bulk Actions Bar INSIDE the Attendance Panel */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    {/* Search Box */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search student or USN..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                      />
                    </div>

                    {/* Bulk Actions Buttons */}
                    <div className="flex items-center space-x-2 w-full sm:w-auto justify-end shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMarkAll('PRESENT')}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-semibold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>All Present</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkAll('ABSENT')}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-[11px] font-semibold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <X className="w-3 h-3 text-rose-600" />
                        <span>All Absent</span>
                      </button>
                    </div>
                  </div>

                  {/* Student Table Roster */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    {loadingWorkspace ? (
                      <div className="p-8 text-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                        <p className="text-slate-600 font-medium text-xs">Loading student roster...</p>
                      </div>
                    ) : filteredWorkspaceStudents.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No students found matching your search.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[calc(100vh-270px)] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3 w-14 text-center">SL NO</th>
                              <th className="py-2.5 px-3 w-36 font-mono">USN</th>
                              <th className="py-2.5 px-3">STUDENT NAME</th>
                              <th className="py-2.5 px-3 w-32 text-center">ATTENDANCE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredWorkspaceStudents.map((st, idx) => {
                              const isPresent = (sessionAttendance[st.id] || 'PRESENT') === 'PRESENT';

                              return (
                                <tr
                                  key={st.id}
                                  className={`transition-colors h-11 ${
                                    isPresent
                                      ? 'hover:bg-slate-50/70'
                                      : 'bg-rose-50/20 hover:bg-rose-50/40'
                                  }`}
                                >
                                  <td className="py-1.5 px-3 font-mono font-bold text-slate-400 text-center">
                                    {String(idx + 1).padStart(2, '0')}
                                  </td>

                                  <td className="py-1.5 px-3 font-mono font-semibold text-slate-800">
                                    {st.usn}
                                  </td>

                                  <td className="py-1.5 px-3">
                                    <span className="font-bold text-slate-900 block text-xs">
                                      {st.studentName}
                                    </span>
                                    {st.rollNumber && st.rollNumber !== 'N/A' && st.rollNumber !== '' && (
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        Roll: {st.rollNumber}
                                      </span>
                                    )}
                                  </td>

                                  {/* Compact Attendance Toggle Switch (Centered) */}
                                  <td className="py-1.5 px-3 text-center">
                                    <div className="flex items-center justify-center space-x-2">
                                      <span
                                        className={`text-[11px] font-bold select-none w-12 text-right ${
                                          isPresent ? 'text-emerald-700' : 'text-rose-600'
                                        }`}
                                      >
                                        {isPresent ? 'Present' : 'Absent'}
                                      </span>
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isPresent}
                                        onClick={() => handleToggleStudent(st.id)}
                                        title={isPresent ? 'Click to Mark Absent' : 'Click to Mark Present'}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                                          isPresent ? 'bg-emerald-600' : 'bg-slate-300'
                                        }`}
                                      >
                                        <span
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                            isPresent ? 'translate-x-4' : 'translate-x-0'
                                          }`}
                                        />
                                      </button>
                                    </div>
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

                {/* RIGHT PANEL (30%): PREVIOUS CLASS REFERENCE PANEL */}
                <div className="bg-slate-50/80 rounded-xl border border-slate-200/90 shadow-2xs p-3.5 space-y-3 sticky top-18">
                  {/* Right Panel Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                    <div className="flex items-center space-x-2">
                      <History className="w-4 h-4 text-amber-700 shrink-0" />
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Previous Class
                      </h3>
                    </div>
                    {previousClassInfo && previousClassInfo.absentStudents && previousClassInfo.absentStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPreviousDetails((prev) => !prev)}
                        className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center space-x-0.5 cursor-pointer"
                      >
                        <span>{showPreviousDetails ? 'Hide' : 'Show'}</span>
                        {showPreviousDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Previous Class Stats & Details */}
                  {previousClassInfo ? (
                    <div className="space-y-3">
                      {/* Date & Period Badge */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900">
                            {previousClassInfo.date}
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded">
                            Period {previousClassInfo.sessionPeriod}
                          </span>
                        </div>

                        {/* Metric Chips */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                          <div className="bg-emerald-50/80 border border-emerald-200 rounded p-1">
                            <span className="text-[10px] text-emerald-800 font-semibold block">Present</span>
                            <span className="text-xs font-extrabold text-emerald-700">
                              {previousClassInfo.presentCount}
                            </span>
                          </div>

                          <div className="bg-rose-50/80 border border-rose-200 rounded p-1">
                            <span className="text-[10px] text-rose-800 font-semibold block">Absent</span>
                            <span className="text-xs font-extrabold text-rose-700">
                              {previousClassInfo.absentCount}
                            </span>
                          </div>

                          <div className="bg-blue-50/80 border border-blue-200 rounded p-1">
                            <span className="text-[10px] text-blue-800 font-semibold block">Rate</span>
                            <span className="text-xs font-extrabold text-blue-700">
                              {previousClassInfo.percentage}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Absent Students Roster inside Right Card */}
                      {previousClassInfo.absentStudents && previousClassInfo.absentStudents.length > 0 ? (
                        showPreviousDetails && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                              <span className="flex items-center space-x-1 text-rose-800">
                                <UserX className="w-3.5 h-3.5 text-rose-600" />
                                <span>Absent Students ({previousClassInfo.absentStudents.length})</span>
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-0.5">
                              {previousClassInfo.absentStudents.map((abs) => (
                                <div
                                  key={abs.id}
                                  className="p-2 bg-white hover:bg-rose-50/40 border border-rose-200/80 rounded-lg text-xs transition shadow-2xs"
                                >
                                  <div className="font-mono font-bold text-indigo-950 text-[11px]">
                                    {abs.usn}
                                  </div>
                                  <div className="text-slate-800 font-medium text-[11px] truncate">
                                    {abs.studentName || 'Student Name'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-xs text-emerald-800 font-semibold">
                          ✓ All students were present in the previous class!
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-white border border-slate-200 rounded-lg text-center text-xs text-slate-500 font-medium space-y-1">
                      <Info className="w-4 h-4 text-slate-400 mx-auto" />
                      <p>No previous attendance recorded for this section.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE CORRECTION */}
          {workspaceTab === 'CORRECTION' && (
            <div className="space-y-3">
              {/* SUB-VIEW A: SELECT CONDUCTED SESSION */}
              {!selectedCorrectionSessionId && (
                <div className="space-y-3">
                  <div className="bg-amber-50/70 border border-amber-200 px-3.5 py-2.5 rounded-xl flex items-start space-x-2.5 text-xs">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-950">Attendance Correction Workspace</h4>
                      <p className="text-amber-800 mt-0.5 text-[11px]">
                        Select a conducted class from the database below to correct student attendance with complete audit logs.
                      </p>
                    </div>
                  </div>

                  {loadingHistory ? (
                    <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-600 mx-auto mb-2" />
                      <p className="text-slate-600 font-medium text-xs">Loading conducted sessions...</p>
                    </div>
                  ) : !historyData || historyData.sessions.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
                      <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                        <History className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">No Recorded Sessions Available</h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        No attendance sessions have been saved yet for this section.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {historyData.sessions.map((s) => {
                        const isLocked = s.status === 'LOCKED';
                        return (
                          <div
                            key={s.id}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs hover:border-amber-300 transition flex flex-col justify-between space-y-3"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-[11px] font-bold rounded">
                                  {s.date}
                                </span>
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[11px] rounded-full border border-indigo-100">
                                  Period {s.sessionPeriod}
                                </span>
                              </div>
                              <div className="pt-1 flex items-center justify-between text-xs">
                                <div className="text-slate-600 font-medium">
                                  <strong className="text-emerald-700">{s.presentCount} Present</strong> &bull;{' '}
                                  <strong className="text-rose-600">{s.absentCount} Absent</strong>
                                </div>
                                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                  {s.percentage}%
                                </span>
                              </div>
                              {s.submittedByFacultyName && (
                                <div className="text-[10px] text-slate-500 font-medium pt-0.5">
                                  Recorded by: <span className="font-semibold text-slate-700">{s.submittedByFacultyName}</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              {isLocked ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                                  <Lock className="w-3 h-3" />
                                  <span>Locked</span>
                                </span>
                              ) : s.canEdit === false ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">
                                  <Lock className="w-3 h-3" />
                                  <span>Read-Only</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Editable</span>
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleSelectSessionForCorrection(s.id)}
                                className={`px-3 py-1 text-white text-[11px] font-bold rounded-lg transition shadow-2xs flex items-center space-x-1 cursor-pointer ${
                                  s.canEdit === false ? 'bg-slate-700 hover:bg-slate-800' : 'bg-amber-500 hover:bg-amber-600'
                                }`}
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>{s.canEdit === false ? 'View Session \u2192' : 'Correct Session \u2192'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-VIEW B: ACTIVE CORRECTION WORKSPACE FOR CHOSEN SESSION */}
              {selectedCorrectionSessionId && correctionSessionData && (
                <div className="space-y-3">
                  {/* Session Header Card with Compact Horizontal Summary Tiles */}
                  <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleBackToSessionsList}
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-amber-700 transition cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Conducted Sessions</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        {correctionSessionData.session.isLocked ? (
                          <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[11px] font-bold rounded-full flex items-center space-x-1">
                            <Lock className="w-3 h-3" />
                            <span>Session Locked</span>
                          </span>
                        ) : correctionSessionData.session.canEdit === false ? (
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full flex items-center space-x-1">
                            <Lock className="w-3 h-3" />
                            <span>Read-Only ({correctionSessionData.session.submittedByFacultyName || 'Previous Faculty'})</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-bold rounded-full">
                            Correction Mode
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Compact Summary Tiles in One Horizontal Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                      <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Session Date & Period</span>
                        <span className="text-xs font-extrabold text-slate-900 mt-0.5 block">
                          {correctionSessionData.session.date} · Period {correctionSessionData.session.sessionPeriod}
                        </span>
                      </div>

                      <div className="bg-emerald-50/60 px-3 py-2 rounded-lg border border-emerald-200/80">
                        <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">Present</span>
                        <span className="text-xs font-extrabold text-emerald-800 mt-0.5 block">
                          {correctionSessionData.session.presentCount} / {correctionSessionData.session.totalStudents}
                        </span>
                      </div>

                      <div className="bg-rose-50/60 px-3 py-2 rounded-lg border border-rose-200/80">
                        <span className="text-[10px] text-rose-800 font-bold uppercase tracking-wider block">Absent</span>
                        <span className="text-xs font-extrabold text-rose-700 mt-0.5 block">
                          {correctionSessionData.session.absentCount}
                        </span>
                      </div>

                      <div className="bg-blue-50/60 px-3 py-2 rounded-lg border border-blue-200/80">
                        <span className="text-[10px] text-blue-800 font-bold uppercase tracking-wider block">Rate</span>
                        <span className="text-xs font-extrabold text-blue-800 mt-0.5 block">
                          {correctionSessionData.session.percentage}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Correction Search (380-450px wide) + Bulk Actions Toolbar */}
                  <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-2.5">
                    {/* Wider Search Bar: 420px on desktop */}
                    <div className="relative w-full md:w-[420px] shrink-0">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by USN or student name..."
                        value={correctionSearchQuery}
                        onChange={(e) => setCorrectionSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition"
                      />
                    </div>

                    {/* Bulk Action Buttons aligned to the right */}
                    <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-end">
                      <button
                        type="button"
                        onClick={handleSelectAllAbsentForCorrection}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Select Absent ({correctionSessionData.session.absentCount})
                      </button>

                      {selectedStudentIdsForCorrection.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearCorrectionSelection}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          Clear ({selectedStudentIdsForCorrection.length})
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleInitiateBulkCorrection('PRESENT')}
                        disabled={selectedStudentIdsForCorrection.length === 0 || correctionSessionData.session.isLocked || correctionSessionData.session.canEdit === false}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Present ({selectedStudentIdsForCorrection.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateBulkCorrection('ABSENT')}
                        disabled={selectedStudentIdsForCorrection.length === 0 || correctionSessionData.session.isLocked || correctionSessionData.session.canEdit === false}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer flex items-center space-x-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Mark Absent ({selectedStudentIdsForCorrection.length})</span>
                      </button>
                    </div>
                  </div>

                  {/* Correction Roster Table with Proper Proportions & Compact Row Height */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3 w-[50px] text-center">
                              <span className="sr-only">Select</span>
                            </th>
                            <th className="py-2.5 px-3 w-[65px] text-center">SL NO</th>
                            <th className="py-2.5 px-3 w-[160px] font-mono">USN</th>
                            <th className="py-2.5 px-3 min-w-[260px]">STUDENT NAME</th>
                            <th className="py-2.5 px-3 w-[130px] text-center">CURRENT STATUS</th>
                            <th className="py-2.5 px-4 w-[160px] text-right">CORRECTION ACTION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredCorrectionStudents.map((st, idx) => {
                            const isPresent = st.currentStatus === 'PRESENT';
                            const isSelected = selectedStudentIdsForCorrection.includes(st.studentId);

                            return (
                              <tr
                                key={st.studentId}
                                className={`transition-colors h-[58px] ${
                                  isSelected
                                    ? 'bg-amber-50/50'
                                    : isPresent
                                    ? 'hover:bg-slate-50/70'
                                    : 'bg-rose-50/20 hover:bg-rose-50/40'
                                }`}
                              >
                                <td className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleCorrectionStudentSelect(st.studentId)}
                                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                  />
                                </td>

                                <td className="py-2 px-3 font-mono font-bold text-slate-400 text-center">
                                  {String(idx + 1).padStart(2, '0')}
                                </td>

                                <td className="py-2 px-3 font-mono font-bold text-slate-900 text-xs">
                                  {st.usn}
                                </td>

                                {/* Clean Student Name Without Repetitive "Section A" */}
                                <td className="py-2 px-3">
                                  <span className="font-bold text-slate-900 block text-xs">
                                    {st.studentName}
                                  </span>
                                </td>

                                {/* Compact Status Badge */}
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`inline-block px-3 py-1 text-xs font-extrabold rounded-full ${
                                      isPresent
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {st.currentStatus}
                                  </span>
                                </td>

                                {/* Correction Action Button */}
                                <td className="py-2 px-4 text-right">
                                  {correctionSessionData.session.canEdit === false ? (
                                    <span className="text-[11px] font-semibold text-slate-400 italic">
                                      Read-Only
                                    </span>
                                  ) : isPresent ? (
                                    <button
                                      type="button"
                                      onClick={() => handleInitiateSingleCorrection(st, 'ABSENT')}
                                      disabled={correctionSessionData.session.isLocked}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                                    >
                                      Mark Absent
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleInitiateSingleCorrection(st, 'PRESENT')}
                                      disabled={correctionSessionData.session.isLocked}
                                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                    >
                                      Mark Present
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Session Correction Audit History */}
                  {correctionSessionData.corrections && correctionSessionData.corrections.length > 0 && (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-bold text-slate-900">Session Correction Audit History</h4>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {correctionSessionData.corrections.map((log) => (
                          <div
                            key={log.id}
                            className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                          >
                            <div>
                              <span className="font-extrabold text-slate-900 text-xs">
                                {log.studentUsn} - {log.studentName}
                              </span>
                              <div className="text-slate-600 text-[11px] mt-0.5">
                                <span className="font-bold text-rose-600">{log.oldStatus}</span> &rarr;{' '}
                                <span className="font-bold text-emerald-600">{log.newStatus}</span> &bull; Reason:{' '}
                                <span className="font-semibold">{log.reason}</span>
                                {log.remarks && <span className="italic text-slate-500"> ({log.remarks})</span>}
                              </div>
                            </div>
                            <div className="text-slate-400 font-medium text-right shrink-0 text-[10px]">
                              <div>By {log.correctedByFacultyName}</div>
                              <div>{new Date(log.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ATTENDANCE HISTORY & AUDIT LOGS */}
          {workspaceTab === 'HISTORY' && (
            <div className="space-y-3">
              {/* Conducted Sessions Overview Table */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <History className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">All Conducted Attendance Sessions</h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    {historyData?.sessions.length || 0} Total Sessions Conducted
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="p-6 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-600" />
                    <span className="text-xs">Loading history...</span>
                  </div>
                ) : !historyData || historyData.sessions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-2">No attendance sessions recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#111111] dark:bg-neutral-950 text-white font-extrabold uppercase text-[10px] border-b border-neutral-800">
                        <tr>
                          <th className="py-2 px-3 text-white font-extrabold">Date</th>
                          <th className="py-2 px-3 text-white font-extrabold">Period</th>
                          <th className="py-2 px-3 text-white font-extrabold">Present / Total</th>
                          <th className="py-2 px-3 text-white font-extrabold">Absent</th>
                          <th className="py-2 px-3 text-white font-extrabold">Rate</th>
                          <th className="py-2 px-3 text-white font-extrabold">Status</th>
                          <th className="py-2 px-3 text-right text-white font-extrabold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historyData.sessions.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{s.date}</td>
                            <td className="py-2 px-3 font-bold text-indigo-900">Period {s.sessionPeriod}</td>
                            <td className="py-2 px-3 font-bold text-emerald-700">
                              {s.presentCount} / {s.totalStudents}
                            </td>
                            <td className="py-2 px-3 font-bold text-rose-600">{s.absentCount}</td>
                            <td className="py-2 px-3 font-bold text-blue-700">{s.percentage}%</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                  s.status === 'LOCKED' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setWorkspaceTab('CORRECTION');
                                  handleSelectSessionForCorrection(s.id);
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold transition cursor-pointer"
                              >
                                Correct
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Assignment-wide Correction Audit Log */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Immutable Attendance Correction Audit History</h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    {assignmentCorrections.length} Audit Event(s)
                  </span>
                </div>

                {loadingAssignmentCorrections ? (
                  <div className="p-6 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-600" />
                    <span className="text-xs">Loading audit log...</span>
                  </div>
                ) : assignmentCorrections.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-2">No attendance corrections have been made for this assignment.</p>
                ) : (
                  <div className="space-y-2">
                    {assignmentCorrections.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-extrabold text-slate-900 text-xs">
                              {log.studentUsn} &bull; {log.studentName}
                            </span>
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold rounded">
                              Class: {log.date || 'N/A'} (P{log.sessionPeriod || 1})
                            </span>
                          </div>
                          <div className="text-slate-600 text-[11px]">
                            Status changed:{' '}
                            <span className="font-bold text-rose-600">{log.oldStatus}</span> &rarr;{' '}
                            <span className="font-bold text-emerald-600">{log.newStatus}</span> &bull; Reason:{' '}
                            <span className="font-semibold text-slate-800">{log.reason}</span>
                            {log.remarks && (
                              <span className="italic text-slate-500"> &bull; Remarks: "{log.remarks}"</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-slate-400 font-medium shrink-0 text-[10px]">
                          <div>Changed by: <strong className="text-slate-700">{log.correctedByFacultyName}</strong></div>
                          <div>{new Date(log.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ATTENDANCE CORRECTION CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-xl border border-slate-200 space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Confirm Attendance Correction</h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Updates database and records an immutable audit log.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submittingCorrection}
                className="text-slate-400 hover:text-slate-600 p-1 text-base leading-none"
              >
                &times;
              </button>
            </div>

            {/* Target Session Details */}
            {correctionSessionData && (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Class:</span>
                  <span className="font-extrabold text-slate-900">
                    {correctionSessionData.session.date} • Period {correctionSessionData.session.sessionPeriod}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Subject:</span>
                  <span className="font-bold text-slate-900">
                    {correctionSessionData.assignment.subjectName} ({correctionSessionData.assignment.subjectCode})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Section:</span>
                  <span className="font-bold text-slate-900">
                    {formatSectionLabel(correctionSessionData.assignment.section)} (Sem {correctionSessionData.assignment.semester})
                  </span>
                </div>
              </div>
            )}

            {/* Affected Students List Preview */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Affected Student(s) ({studentsToConfirm.length}):
              </span>
              <div className="max-h-32 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg p-1.5 bg-slate-50/50 text-xs">
                {studentsToConfirm.map((st) => (
                  <div key={st.id} className="py-1 px-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-indigo-950 font-mono text-[11px]">{st.usn}</span>
                      <span className="text-slate-700 ml-1.5 font-medium">{st.name}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 font-bold shrink-0 text-[11px]">
                      <span className={st.oldStatus === 'PRESENT' ? 'text-emerald-700' : 'text-rose-600'}>
                        {st.oldStatus}
                      </span>
                      <span>&rarr;</span>
                      <span className={targetCorrectionStatus === 'PRESENT' ? 'text-emerald-700' : 'text-rose-600'}>
                        {targetCorrectionStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reason Selection Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                Reason for Correction <span className="text-rose-500">*</span>
              </label>
              <select
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="Approved Attendance Permission">Approved Attendance Permission</option>
                <option value="Faculty Entry Correction">Faculty Entry Correction</option>
                <option value="Medical / Official Permission">Medical / Official Permission</option>
                <option value="Administrative Correction">Administrative Correction</option>
                <option value="Other">Other (Requires Remarks)</option>
              </select>
            </div>

            {/* Remarks Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                Remarks {correctionReason === 'Other' ? <span className="text-rose-500">*</span> : <span className="text-slate-400 text-[10px] lowercase">(optional)</span>}
              </label>
              <textarea
                rows={2}
                placeholder={
                  correctionReason === 'Other'
                    ? 'Enter detailed justification for this correction...'
                    : 'e.g. Student presented approved permission slip before exam'
                }
                value={correctionRemarks}
                onChange={(e) => setCorrectionRemarks(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submittingCorrection}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCorrectionSubmit}
                disabled={submittingCorrection}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-extrabold transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
              >
                {submittingCorrection ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyAttendancePage;
