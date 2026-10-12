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
  MoreVertical,
  Plus,
  Eye,
  Ban,
} from 'lucide-react';
import facultyService, {
  FacultyAssignmentItem,
  FacultyAttendanceWorkspaceData,
  RecordedSessionItem,
  AttendanceHistoryData,
  AttendanceSessionDetailData,
  CorrectionStudentRow,
  AttendanceCorrectionLogItem,
  CompleteAttendanceData,
  ScheduledSessionItem,
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
  const selectedPeriod = 1;
  const [showPreviousDetails, setShowPreviousDetails] = useState<boolean>(true);

  // Workspace Sub-Tab: 'TAKE' | 'COMPLETE_HISTORY' | 'CORRECTION' | 'HISTORY'
  const [workspaceTab, setWorkspaceTab] = useState<'TAKE' | 'COMPLETE_HISTORY' | 'CORRECTION' | 'HISTORY'>('TAKE');

  // Complete Attendance States
  const [completeHistoryData, setCompleteHistoryData] = useState<CompleteAttendanceData | null>(null);
  const [loadingCompleteHistory, setLoadingCompleteHistory] = useState<boolean>(false);
  const [completeHistoryFilter, setCompleteHistoryFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [activeActionMenuSessionId, setActiveActionMenuSessionId] = useState<string | null>(null);

  // View Attendance Modal
  const [isViewSessionModalOpen, setIsViewSessionModalOpen] = useState<boolean>(false);
  const [viewSessionModalData, setViewSessionModalData] = useState<AttendanceSessionDetailData | null>(null);
  const [loadingViewSessionModal, setLoadingViewSessionModal] = useState<boolean>(false);
  const [viewSessionSearchQuery, setViewSessionSearchQuery] = useState<string>('');

  // Schedule Session Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [scheduleDate, setScheduleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [scheduleStartTime, setScheduleStartTime] = useState<string>('10:35 AM');
  const [scheduleEndTime, setScheduleEndTime] = useState<string>('11:30 AM');
  const [scheduleClassroom, setScheduleClassroom] = useState<string>('');
  const [isSchedulingSession, setIsSchedulingSession] = useState<boolean>(false);

  // Cancel Session Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelTargetSession, setCancelTargetSession] = useState<ScheduledSessionItem | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [isCancellingSession, setIsCancellingSession] = useState<boolean>(false);

  // Cancellation Details Modal
  const [isCancellationDetailModalOpen, setIsCancellationDetailModalOpen] = useState<boolean>(false);
  const [cancellationDetailSession, setCancellationDetailSession] = useState<ScheduledSessionItem | null>(null);

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
  }, [workspaceData, selectedDate]);

  const formatDateLong = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const day = Number(parts[2]);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const loadCompleteAttendanceHistory = useCallback(async (assignmentId: string) => {
    setLoadingCompleteHistory(true);
    try {
      const data = await facultyService.getCompleteAttendanceHistory(assignmentId);
      setCompleteHistoryData(data);
    } catch (err: any) {
      console.error('Failed to load complete attendance history:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to load complete attendance history.',
      });
    } finally {
      setLoadingCompleteHistory(false);
    }
  }, []);

  // Handle Tab Switch inside Workspace
  const handleTabChange = (newTab: 'TAKE' | 'COMPLETE_HISTORY' | 'CORRECTION' | 'HISTORY') => {
    setWorkspaceTab(newTab);
    setSelectedStudentIdsForCorrection([]);
    setActiveActionMenuSessionId(null);
    if (selectedAssignmentId) {
      if (newTab === 'COMPLETE_HISTORY') {
        loadCompleteAttendanceHistory(selectedAssignmentId);
      } else if (newTab === 'CORRECTION') {
        loadAttendanceHistory(selectedAssignmentId);
      } else if (newTab === 'HISTORY') {
        loadAttendanceHistory(selectedAssignmentId);
        loadAssignmentCorrections(selectedAssignmentId);
      }
    }
  };

  // Filtered complete attendance sessions
  const filteredSessions = useMemo(() => {
    if (!completeHistoryData || !completeHistoryData.sessions) return [];
    if (completeHistoryFilter === 'PENDING') {
      return completeHistoryData.sessions.filter((s) => s.status === 'Pending');
    }
    if (completeHistoryFilter === 'COMPLETED') {
      return completeHistoryData.sessions.filter((s) => s.status === 'Completed');
    }
    if (completeHistoryFilter === 'CANCELLED') {
      return completeHistoryData.sessions.filter((s) => s.status === 'Cancelled');
    }
    return completeHistoryData.sessions;
  }, [completeHistoryData, completeHistoryFilter]);

  // Action: Take Attendance for pending session
  const handleActionTakeAttendance = (sessionDate: string) => {
    setSelectedDate(sessionDate);
    setActiveActionMenuSessionId(null);
    handleTabChange('TAKE');
  };

  // Action: View Attendance for completed session
  const handleActionViewAttendance = async (sessionId: string) => {
    setActiveActionMenuSessionId(null);
    setIsViewSessionModalOpen(true);
    setLoadingViewSessionModal(true);
    setViewSessionSearchQuery('');
    try {
      const data = await facultyService.getAttendanceSessionDetail(sessionId);
      setViewSessionModalData(data);
    } catch (err: any) {
      console.error('Failed to load session attendance detail:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to load session attendance detail.',
      });
      setIsViewSessionModalOpen(false);
    } finally {
      setLoadingViewSessionModal(false);
    }
  };

  // Action: Request Correction for completed session
  const handleActionRequestCorrection = (sessionId: string) => {
    setActiveActionMenuSessionId(null);
    handleSelectSessionForCorrection(sessionId);
    handleTabChange('CORRECTION');
  };

  // Action: Open Cancel modal
  const handleOpenCancelModal = (session: ScheduledSessionItem) => {
    setActiveActionMenuSessionId(null);
    setCancelTargetSession(session);
    setCancelReasonInput('');
    setIsCancelModalOpen(true);
  };

  // Action: Open Cancellation details modal
  const handleOpenCancellationDetailModal = (session: ScheduledSessionItem) => {
    setActiveActionMenuSessionId(null);
    setCancellationDetailSession(session);
    setIsCancellationDetailModalOpen(true);
  };

  // Action: Open Schedule modal
  const handleOpenScheduleModal = () => {
    setScheduleDate(new Date().toISOString().split('T')[0]);
    setScheduleStartTime('10:35 AM');
    setScheduleEndTime('11:30 AM');
    setScheduleClassroom(completeHistoryData?.assignment.classroom || 'B-403');
    setIsScheduleModalOpen(true);
  };

  // Submit Schedule Session
  const handleScheduleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentId || !scheduleDate) return;
    setIsSchedulingSession(true);
    try {
      await facultyService.scheduleClassSession(selectedAssignmentId, {
        date: scheduleDate,
        startTime: scheduleStartTime,
        endTime: scheduleEndTime,
        classroom: scheduleClassroom.trim() || undefined,
      });
      setNotification({
        type: 'success',
        message: `Class session scheduled successfully for ${scheduleDate}.`,
      });
      setIsScheduleModalOpen(false);
      await loadCompleteAttendanceHistory(selectedAssignmentId);
    } catch (err: any) {
      console.error('Failed to schedule session:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to schedule class session.',
      });
    } finally {
      setIsSchedulingSession(false);
    }
  };

  // Submit Cancel Session
  const handleCancelSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTargetSession) return;
    setIsCancellingSession(true);
    try {
      await facultyService.cancelClassSession(cancelTargetSession.id, cancelReasonInput.trim() || 'Class cancelled by faculty');
      setNotification({
        type: 'success',
        message: `Class session for ${cancelTargetSession.date} marked as cancelled.`,
      });
      setIsCancelModalOpen(false);
      setCancelTargetSession(null);
      if (selectedAssignmentId) {
        await loadCompleteAttendanceHistory(selectedAssignmentId);
      }
    } catch (err: any) {
      console.error('Failed to cancel session:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to cancel class session.',
      });
    } finally {
      setIsCancellingSession(false);
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

  // Find existing session info for selected date
  const existingSession: RecordedSessionItem | undefined = useMemo(() => {
    if (!workspaceData || !workspaceData.recordedSessions) return undefined;
    return workspaceData.recordedSessions.find(
      (s) => s.date === selectedDate
    );
  }, [workspaceData, selectedDate]);

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
        message: `Attendance saved successfully for ${selectedDate}.`,
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
              {/* Left Action Group (Take Attendance, View Complete Attendance, Correction, History) */}
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
                  onClick={() => handleTabChange('COMPLETE_HISTORY')}
                  className={`h-[42px] px-3.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition shrink-0 cursor-pointer ${
                    workspaceTab === 'COMPLETE_HISTORY'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>View Complete Attendance</span>
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
                      ? 'bg-purple-700 hover:bg-purple-800 text-white shadow-xs'
                      : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
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

          {/* TAB: COMPLETE ATTENDANCE HISTORY (MATCHING SCREENSHOT 1) */}
          {workspaceTab === 'COMPLETE_HISTORY' && (
            <div className="space-y-4">
              {/* Backdrop for closing 3-dot action menu */}
              {activeActionMenuSessionId && (
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setActiveActionMenuSessionId(null)}
                />
              )}

              {/* Header Card: Back button + Subject title + Meta chips */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => handleTabChange('TAKE')}
                    className="p-2 -ml-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition cursor-pointer shrink-0"
                    title="Back to Take Attendance"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-800" />
                  </button>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      {selectedSubject?.name || completeHistoryData?.assignment.subjectName || 'Course Attendance'}
                    </h2>
                    <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-700">
                        {selectedSubject?.code || completeHistoryData?.assignment.subjectCode}
                      </span>
                      <span>•</span>
                      <span>{selectedSubject?.department || completeHistoryData?.assignment.department || 'CSE'}</span>
                      <span>•</span>
                      <span>Semester {selectedSemNum || completeHistoryData?.assignment.semester}</span>
                      <span>•</span>
                      <span>{formatSectionLabel(selectedSubject?.section || completeHistoryData?.assignment.section)}</span>
                      {(completeHistoryData?.assignment.academicYear || activeAY) && (
                        <>
                          <span>•</span>
                          <span>AY: {completeHistoryData?.assignment.academicYear || activeAY}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions on header right: Schedule Class & Refresh */}
                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleOpenScheduleModal}
                    className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                    title="Schedule a new class session"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule Class</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedAssignmentId && loadCompleteAttendanceHistory(selectedAssignmentId)}
                    disabled={loadingCompleteHistory}
                    className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-60"
                    title="Refresh attendance records"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingCompleteHistory ? 'animate-spin text-blue-600' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Filter Pills Toolbar */}
              <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left: 4 Filter Pills (All, Pending, Completed, Cancelled) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompleteHistoryFilter('ALL')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      completeHistoryFilter === 'ALL'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {completeHistoryFilter === 'ALL' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    <span>All ({completeHistoryData?.summary.totalSessions ?? 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompleteHistoryFilter('PENDING')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      completeHistoryFilter === 'PENDING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {completeHistoryFilter === 'PENDING' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    <span>Pending ({completeHistoryData?.summary.pendingCount ?? 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompleteHistoryFilter('COMPLETED')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      completeHistoryFilter === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {completeHistoryFilter === 'COMPLETED' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    <span>Completed ({completeHistoryData?.summary.completedCount ?? 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompleteHistoryFilter('CANCELLED')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      completeHistoryFilter === 'CANCELLED'
                        ? 'bg-slate-200 text-slate-800 border border-slate-400 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {completeHistoryFilter === 'CANCELLED' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    <span>Cancelled ({completeHistoryData?.summary.cancelledCount ?? 0})</span>
                  </button>
                </div>

                {/* Right: Classes held indicator + Plus button */}
                <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto">
                  <span className="text-xs font-bold text-slate-600">
                    <span className="text-slate-900 font-extrabold">{completeHistoryData?.summary.classesHeld ?? 0}</span> classes held
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenScheduleModal}
                    className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
                    title="Schedule a new class"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* Date-Wise Attendance List */}
              {loadingCompleteHistory ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                  <RefreshCw className="w-7 h-7 animate-spin text-blue-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-600">Loading complete attendance history...</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">No Class Sessions Found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {completeHistoryFilter === 'ALL'
                      ? 'No scheduled or conducted classes recorded yet for this subject and section.'
                      : `No sessions found with "${completeHistoryFilter.toLowerCase()}" status.`}
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenScheduleModal}
                    className="inline-flex items-center space-x-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule Class Session</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-visible">
                  {filteredSessions.map((session) => {
                    const isCompleted = session.status === 'Completed';
                    const isPending = session.status === 'Pending';
                    const isCancelled = session.status === 'Cancelled';

                    return (
                      <div
                        key={session.id}
                        className="p-4 sm:px-5 sm:py-4 flex items-center justify-between hover:bg-slate-50/80 transition relative"
                      >
                        {/* Left: Square Status Box + Class Info */}
                        <div className="flex items-center space-x-4 min-w-0">
                          {/* Square indicator matching Reference Screenshot 1 */}
                          {isCompleted && (
                            <div
                              className="w-11 h-11 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs"
                              title="Completed: Attendance Saved"
                            >
                              <Check className="w-6 h-6 stroke-[3]" />
                            </div>
                          )}
                          {isPending && (
                            <div
                              className="w-11 h-11 rounded-lg bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0 shadow-xs"
                              title="Pending: Attendance Not Recorded"
                            >
                              <span className="text-xl font-black leading-none">!</span>
                            </div>
                          )}
                          {isCancelled && (
                            <div
                              className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-300 text-slate-500 flex items-center justify-center shrink-0 shadow-xs"
                              title="Cancelled Class"
                            >
                              <X className="w-5 h-5 stroke-[2.5]" />
                            </div>
                          )}

                          {/* Info Column */}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                                {formatDateLong(session.date)}
                                {session.classroom && (
                                  <span className="text-slate-600 font-semibold ml-1.5">
                                    - ( {session.classroom} )
                                  </span>
                                )}
                              </h4>
                              {/* Accessible Status Label */}
                              {isCompleted && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Completed
                                </span>
                              )}
                              {isPending && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                  Pending
                                </span>
                              )}
                              {isCancelled && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                  Cancelled
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-slate-600 font-semibold">
                                {session.timeSlot || '10:35 AM – 11:30 AM'}
                              </span>
                              {isCompleted && session.summary && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-bold">
                                    {session.summary.presentCount} Present
                                  </span>
                                  <span>•</span>
                                  <span className="text-rose-600 font-bold">
                                    {session.summary.absentCount} Absent
                                  </span>
                                  <span>•</span>
                                  <span className="text-blue-700 font-extrabold">
                                    {session.summary.attendanceRate}% Rate
                                  </span>
                                </>
                              )}
                              {isCancelled && session.cancellationReason && (
                                <>
                                  <span>•</span>
                                  <span className="text-rose-600 italic">
                                    Reason: {session.cancellationReason}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Three-Dot Menu */}
                        <div className="relative shrink-0 ml-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuSessionId(
                                activeActionMenuSessionId === session.id ? null : session.id
                              );
                            }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                            title="Class Actions"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {/* Menu Dropdown */}
                          {activeActionMenuSessionId === session.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-10 z-30 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-100"
                            >
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleActionTakeAttendance(session.date)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-blue-700 hover:bg-blue-50 flex items-center space-x-2 transition cursor-pointer"
                                  >
                                    <CalendarCheck className="w-4 h-4 text-blue-600" />
                                    <span>Take Attendance</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCancelModal(session)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition cursor-pointer"
                                  >
                                    <Ban className="w-4 h-4 text-rose-500" />
                                    <span>Cancel Class</span>
                                  </button>
                                </>
                              )}

                              {isCompleted && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleActionViewAttendance(session.id)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center space-x-2 transition cursor-pointer"
                                  >
                                    <Eye className="w-4 h-4 text-blue-600" />
                                    <span>View Attendance</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleActionRequestCorrection(session.id)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-amber-700 hover:bg-amber-50 flex items-center space-x-2 transition cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4 text-amber-600" />
                                    <span>Request Correction</span>
                                  </button>
                                </>
                              )}

                              {isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCancellationDetailModal(session)}
                                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center space-x-2 transition cursor-pointer"
                                >
                                  <Info className="w-4 h-4 text-slate-500" />
                                  <span>View Cancellation Details</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
                                  <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-white text-xs text-center">
                                    {String(idx + 1).padStart(2, '0')}
                                  </td>

                                  <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-tight">
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
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              {isLocked ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                                  <Lock className="w-3 h-3" />
                                  <span>Locked</span>
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
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg transition shadow-2xs flex items-center space-x-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Correct Session &rarr;</span>
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
                        {correctionSessionData.session.isLocked && (
                          <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[11px] font-bold rounded-full flex items-center space-x-1">
                            <Lock className="w-3 h-3" />
                            <span>Session Locked</span>
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-bold rounded-full">
                          Correction Mode
                        </span>
                      </div>
                    </div>

                    {/* Compact Summary Tiles in One Horizontal Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                      <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Session Date</span>
                        <span className="text-xs font-extrabold text-slate-900 mt-0.5 block">
                          {correctionSessionData.session.date}
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
                        disabled={selectedStudentIdsForCorrection.length === 0 || correctionSessionData.session.isLocked}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Present ({selectedStudentIdsForCorrection.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateBulkCorrection('ABSENT')}
                        disabled={selectedStudentIdsForCorrection.length === 0 || correctionSessionData.session.isLocked}
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
                            <th className="py-2.5 px-4 w-[160px] text-center">CORRECTION ACTION</th>
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

                                <td className="py-2 px-3 font-bold text-slate-900 dark:text-white text-xs text-center">
                                  {String(idx + 1).padStart(2, '0')}
                                </td>

                                <td className="py-2 px-3 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-tight">
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
                                  {isPresent ? (
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
                          <th className="py-2 px-3 text-white font-extrabold">Present / Total</th>
                          <th className="py-2 px-3 text-white font-extrabold">Absent</th>
                          <th className="py-2 px-3 text-white font-extrabold">Rate</th>
                          <th className="py-2 px-3 text-white font-extrabold">Status</th>
                          <th className="py-2 px-3 text-center text-white font-extrabold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historyData.sessions.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{s.date}</td>
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
                              Class Date: {log.date || 'N/A'}
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
                  <span className="text-slate-500 font-bold">Class Date:</span>
                  <span className="font-extrabold text-slate-900">
                    {correctionSessionData.session.date}
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

      {/* MODAL 1: VIEW ATTENDANCE MODAL */}
      {isViewSessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Class Attendance Details
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {viewSessionModalData
                    ? `${formatDateLong(viewSessionModalData.session.date)} • ${viewSessionModalData.session.classroom || 'Classroom'} • ${viewSessionModalData.session.startTime || ''} - ${viewSessionModalData.session.endTime || ''}`
                    : 'Loading attendance record...'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsViewSessionModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {loadingViewSessionModal ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-7 h-7 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Loading student attendance...</p>
                </div>
              ) : viewSessionModalData ? (
                <>
                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</div>
                      <div className="text-base font-black text-slate-900">{viewSessionModalData.summary.total}</div>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Present</div>
                      <div className="text-base font-black text-emerald-800">{viewSessionModalData.summary.present}</div>
                    </div>
                    <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Absent</div>
                      <div className="text-base font-black text-rose-800">{viewSessionModalData.summary.absent}</div>
                    </div>
                    <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Rate</div>
                      <div className="text-base font-black text-blue-800">{viewSessionModalData.summary.rate}%</div>
                    </div>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search student name or USN..."
                      value={viewSessionSearchQuery}
                      onChange={(e) => setViewSessionSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Student Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3 text-center w-12">#</th>
                          <th className="py-2 px-3">USN</th>
                          <th className="py-2 px-3">Student Name</th>
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewSessionModalData.students
                          .filter((st) => {
                            if (!viewSessionSearchQuery.trim()) return true;
                            const q = viewSessionSearchQuery.toLowerCase();
                            return (
                              st.usn.toLowerCase().includes(q) ||
                              st.name.toLowerCase().includes(q)
                            );
                          })
                          .map((st, idx) => (
                            <tr key={st.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-800">{st.usn}</td>
                              <td className="py-2 px-3 font-semibold text-slate-900">{st.name}</td>
                              <td className="py-2 px-3 text-right">
                                {st.status === 'PRESENT' ? (
                                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-md inline-flex items-center space-x-1">
                                    <Check className="w-3 h-3 stroke-[2.5]" />
                                    <span>Present</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[11px] font-black rounded-md inline-flex items-center space-x-1">
                                    <X className="w-3 h-3 stroke-[2.5]" />
                                    <span>Absent</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              {viewSessionModalData && (
                <button
                  type="button"
                  onClick={() => {
                    const sid = viewSessionModalData.session.id;
                    setIsViewSessionModalOpen(false);
                    handleActionRequestCorrection(sid);
                  }}
                  className="px-3 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Request Correction</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsViewSessionModalOpen(false)}
                className="ml-auto px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE CLASS SESSION MODAL */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Schedule Class Session
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {selectedSubject?.name || 'Class Session'} • {formatSectionLabel(selectedSubject?.section)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleSessionSubmit} className="p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Class Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    Start Time
                  </label>
                  <input
                    type="text"
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                    placeholder="e.g. 10:35 AM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    End Time
                  </label>
                  <input
                    type="text"
                    value={scheduleEndTime}
                    onChange={(e) => setScheduleEndTime(e.target.value)}
                    placeholder="e.g. 11:30 AM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Classroom / Hall Number
                </label>
                <input
                  type="text"
                  value={scheduleClassroom}
                  onChange={(e) => setScheduleClassroom(e.target.value)}
                  placeholder="e.g. B-403"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  disabled={isSchedulingSession}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSchedulingSession}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
                >
                  {isSchedulingSession ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Schedule Class</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CANCEL SESSION MODAL */}
      {isCancelModalOpen && cancelTargetSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Cancel Scheduled Class
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {formatDateLong(cancelTargetSession.date)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCancelSessionSubmit} className="p-5 space-y-3.5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                <div className="font-bold">Notice:</div>
                <p>
                  Marking this session as cancelled distinguishes it from pending classes where attendance was forgotten.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Quick Cancellation Reason
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Faculty on Leave / OD',
                    'College Holiday / Event',
                    'Session Rescheduled',
                    'Technical Issue',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCancelReasonInput(preset)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition cursor-pointer ${
                        cancelReasonInput === preset
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Reason / Remarks
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Provide brief reason for cancellation..."
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  disabled={isCancellingSession}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Keep Class
                </button>
                <button
                  type="submit"
                  disabled={isCancellingSession}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
                >
                  {isCancellingSession ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Confirm Cancellation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CANCELLATION DETAILS MODAL */}
      {isCancellationDetailModalOpen && cancellationDetailSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Class Cancellation Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCancellationDetailModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Date:</span>
                  <span className="font-bold text-slate-900">{formatDateLong(cancellationDetailSession.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Time:</span>
                  <span className="font-bold text-slate-900">{cancellationDetailSession.timeSlot || '10:35 AM - 11:30 AM'}</span>
                </div>
                {cancellationDetailSession.classroom && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Classroom:</span>
                    <span className="font-bold text-slate-900">{cancellationDetailSession.classroom}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800">
                    Cancelled
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Cancellation Reason:
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 font-semibold">
                  {cancellationDetailSession.cancellationReason || 'Class cancelled by faculty.'}
                </div>
              </div>

              {cancellationDetailSession.cancelledAt && (
                <div className="text-[11px] text-slate-400 italic">
                  Cancelled on: {new Date(cancellationDetailSession.cancelledAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsCancellationDetailModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyAttendancePage;
