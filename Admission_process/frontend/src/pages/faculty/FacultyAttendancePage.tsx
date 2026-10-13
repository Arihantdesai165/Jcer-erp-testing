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
  ChevronLeft,
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

const isAssignedUsn = (val: string | null | undefined): boolean => {
  if (!val) return false;
  const clean = val.trim().toUpperCase();
  if (
    clean === '' ||
    clean === 'N/A' ||
    clean === 'NA' ||
    clean === '-' ||
    clean === '—' ||
    clean.startsWith('JCER-') ||
    clean.startsWith('APP-') ||
    clean.startsWith('TEMP')
  ) {
    return false;
  }
  return true;
};

const compareStudentsByUsnOrName = (
  usnAVal: string | null | undefined,
  usnBVal: string | null | undefined,
  nameAVal: string | null | undefined,
  nameBVal: string | null | undefined,
  rollAVal?: string | null | undefined,
  rollBVal?: string | null | undefined
): number => {
  const hasUsnA = isAssignedUsn(usnAVal);
  const hasUsnB = isAssignedUsn(usnBVal);

  if (hasUsnA && hasUsnB) {
    const cmp = (usnAVal || '').trim().localeCompare((usnBVal || '').trim(), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (cmp !== 0) return cmp;
    const nCmp = (nameAVal || '').trim().localeCompare((nameBVal || '').trim(), undefined, {
      sensitivity: 'base',
    });
    if (nCmp !== 0) return nCmp;
    return (rollAVal || '').trim().localeCompare((rollBVal || '').trim(), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  if (hasUsnA && !hasUsnB) return -1;
  if (!hasUsnA && hasUsnB) return 1;

  // Fallback: Student Name A-Z
  const nCmp = (nameAVal || '').trim().localeCompare((nameBVal || '').trim(), undefined, {
    sensitivity: 'base',
  });
  if (nCmp !== 0) return nCmp;

  return (rollAVal || '').trim().localeCompare((rollBVal || '').trim(), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

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

  // Attendance Calendar Workspace States
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

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
        loadCompleteAttendanceHistory(selectedAssignmentId);
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

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calendar Navigation Handlers
  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((prev) => prev - 1);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((prev) => prev + 1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setSelectedCalendarDate(todayStr);
  };

  // Map all sessions by date for the calendar
  const sessionsByDate = useMemo(() => {
    const map: { [dateStr: string]: ScheduledSessionItem[] } = {};
    if (completeHistoryData?.sessions) {
      completeHistoryData.sessions.forEach((s) => {
        if (!map[s.date]) {
          map[s.date] = [];
        }
        map[s.date].push(s);
      });
    }
    return map;
  }, [completeHistoryData]);

  // Calendar cells calculation
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInCurrentMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNumber = daysInPrevMonth - i;
      const prevYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      const prevMonth = calendarMonth === 0 ? 12 : calendarMonth;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Trailing days to fill 7-column rows
    const totalSlots = Math.ceil(cells.length / 7) * 7;
    const trailingCount = totalSlots - cells.length;
    for (let d = 1; d <= trailingCount; d++) {
      const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
      const nextMonth = calendarMonth === 11 ? 1 : calendarMonth + 2;
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [calendarYear, calendarMonth]);

  // Selected date sessions
  const selectedDateSessions = useMemo(() => {
    return sessionsByDate[selectedCalendarDate] || [];
  }, [sessionsByDate, selectedCalendarDate]);

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
    setScheduleClassroom(completeHistoryData?.assignment?.classroom || '');
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
    setCorrectionSessionData(null);
    loadCorrectionSessionDetail(sessionId);
  };

  // Directly open correction when clicking a date cell on the Correction Calendar
  const handleCalendarDateClick = (cellDateStr: string) => {
    setSelectedCalendarDate(cellDateStr);
    const cellSessions = sessionsByDate[cellDateStr] || [];
    const completedSession = cellSessions.find((s) => s.status === 'Completed');

    if (completedSession) {
      handleSelectSessionForCorrection(completedSession.id);
    } else if (cellSessions.length > 0 && cellSessions[0].status === 'Pending') {
      handleActionTakeAttendance(cellSessions[0].date);
    } else {
      setNotification({
        type: 'error',
        message: `No recorded class session on ${formatDateLong(cellDateStr)} to correct.`,
      });
    }
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

  // Selected subject details derived from selected assignment item or courses
  const selectedSubject = useMemo(() => {
    if (selectedAssignmentItem) {
      return {
        id: selectedAssignmentItem.subjectId,
        name: selectedAssignmentItem.subjectName,
        code: selectedAssignmentItem.subjectCode,
        department: selectedAssignmentItem.departmentCode,
        semester: selectedAssignmentItem.semester,
        section: selectedAssignmentItem.section,
        credits: selectedAssignmentItem.credits,
        type: selectedAssignmentItem.type,
      };
    }
    if (selectedSubjectId) {
      const found = courses.find((c) => c.subjectId === selectedSubjectId);
      if (found) {
        return {
          id: found.subjectId,
          name: found.subjectName,
          code: found.subjectCode,
          department: found.departmentCode,
          semester: found.semester,
          section: found.section,
          credits: found.credits,
          type: found.type,
        };
      }
    }
    return null;
  }, [selectedAssignmentItem, selectedSubjectId, courses]);

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

  // Filtered Students for Take Workspace (Sorted by USN ASC when assigned, fallback to Name A-Z)
  const filteredWorkspaceStudents = useMemo(() => {
    if (!workspaceData || !workspaceData.students) return [];
    let list = workspaceData.students;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((st) => {
        const matchName = (st.studentName || '').toLowerCase().includes(q);
        const matchUsn = (st.usn || '').toLowerCase().includes(q);
        return matchName || matchUsn;
      });
    }
    return [...list].sort((a, b) =>
      compareStudentsByUsnOrName(a.usn, b.usn, a.studentName, b.studentName, a.rollNumber, b.rollNumber)
    );
  }, [workspaceData, searchQuery]);

  // Filtered Students for Correction Workspace (Sorted by USN ASC when assigned, fallback to Name A-Z)
  const filteredCorrectionStudents = useMemo(() => {
    if (!correctionSessionData || !correctionSessionData.students) return [];
    let list = correctionSessionData.students;
    if (correctionSearchQuery.trim()) {
      const q = correctionSearchQuery.toLowerCase().trim();
      list = list.filter((st) => {
        const matchName = (st.studentName || '').toLowerCase().includes(q);
        const matchUsn = (st.usn || '').toLowerCase().includes(q);
        return matchName || matchUsn;
      });
    }
    return [...list].sort((a, b) =>
      compareStudentsByUsnOrName(a.usn, b.usn, a.studentName, b.studentName, a.rollNumber, b.rollNumber)
    );
  }, [correctionSessionData, correctionSearchQuery]);

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

      {/* ── BREADCRUMB FLOW VIEW (MATCHING FACULTY ANALYTICS STYLE) ── */}
      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold flex-wrap px-0.5 text-slate-500">
        {currentView === 'SEMESTERS' ? (
          <span className="font-bold text-slate-900"></span>
        ) : (
          <button
            type="button"
            onClick={handleBackToSemesters}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            
          </button>
        )}

        {selectedSemNum !== null && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {currentView === 'SUBJECTS' ? (
              <span className="font-bold text-slate-900">
                Semester {selectedSemNum}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleBackToSubjects}
                className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Semester {selectedSemNum}
              </button>
            )}
          </>
        )}

        {selectedSubject && (currentView === 'SECTIONS' || currentView === 'WORKSPACE') && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {currentView === 'SECTIONS' ? (
              <span className="font-bold text-slate-900">
                {selectedSubject.name} ({selectedSubject.code})
              </span>
            ) : (
              <button
                type="button"
                onClick={handleBackToSections}
                className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                {selectedSubject.name} ({selectedSubject.code})
              </button>
            )}
          </>
        )}

        {currentView === 'WORKSPACE' && selectedAssignmentItem && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-bold text-slate-900">
              {formatSectionLabel(selectedAssignmentItem.section)}
            </span>
          </>
        )}
      </div>

  

      {/* LEVEL 1: SEMESTER CARDS */}
      {currentView === 'SEMESTERS' && (
        <div className="w-full space-y-3.5">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">
            SELECT SEMESTER
          </h2>

          {loading ? (
            <div className="bg-white p-8 rounded-[22px] border-2 border-black text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-800 mx-auto mb-2" />
              <p className="text-slate-600 font-medium text-xs">Loading assigned semesters...</p>
            </div>
          ) : distinctSemesters.length === 0 ? (
            <div className="bg-white p-8 rounded-[22px] border-2 border-black text-center space-y-2">
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
                  <div
                    key={sem}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectSemester(sem)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectSemester(sem);
                      }
                    }}
                    className="bg-white p-6 rounded-[22px] border-2 border-black shadow-xs hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-all duration-150 text-left flex flex-col justify-between min-h-[175px] cursor-pointer group w-full"
                  >
                    <div>
                      {/* TOP ROW: SEM BADGE + RIGHT ARROW */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg tracking-wide">
                          SEM {sem}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-800 group-hover:translate-x-0.5 transition-transform" />
                      </div>

                      {/* SEMESTER TITLE */}
                      <h3 className="text-2xl font-bold text-slate-900 leading-snug">
                        Semester {sem}
                      </h3>
                      <p className="text-sm text-slate-600 font-medium mt-0.5">
                        Academic Attendance
                      </p>
                    </div>

                    {/* DIVIDER & FOOTER */}
                    <div>
                      <div className="border-t border-slate-100 my-4" />
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center space-x-2 text-slate-700 font-medium">
                          <Users className="w-4 h-4 text-slate-700" />
                          <span>{count} Section{count !== 1 ? 's' : ''} Assigned</span>
                        </div>
                        <span className="font-extrabold text-xs tracking-wider text-slate-900 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                          <span>OPEN</span>
                          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 2: SUBJECT CARDS */}
      {currentView === 'SUBJECTS' && (
        <div className="w-full space-y-4">
          {/* BACK TO SEMESTERS BUTTON */}
          <div>
            <button
              type="button"
              onClick={handleBackToSemesters}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 border-2 border-black rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4 text-slate-900 stroke-[2.5]" />
              <span>Back to Semesters</span>
            </button>
          </div>

          {subjectsForSelectedSem.length === 0 ? (
            <div className="bg-white p-8 rounded-[22px] border-2 border-black text-center space-y-2">
              <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Subjects Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No subjects assigned for Semester {selectedSemNum} in Academic Year {activeAY}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
              {subjectsForSelectedSem.map((subj) => (
                <div
                  key={subj.subjectId}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectSubject(subj.subjectId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectSubject(subj.subjectId);
                    }
                  }}
                  className="bg-white p-6 rounded-[22px] border-2 border-black shadow-xs hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-all duration-150 text-left flex flex-col justify-between min-h-[175px] cursor-pointer group w-full"
                >
                  <div>
                    {/* TOP ROW: Subject Code Badge on LEFT, Section Count Badge on RIGHT */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="bg-[#0f172a] text-white font-mono font-bold text-xs px-3.5 py-1.5 rounded-lg tracking-wide shrink-0">
                        {subj.subjectCode}
                      </span>
                      <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-3 py-1 rounded-full flex items-center space-x-1.5 shrink-0">
                        <Users className="w-3.5 h-3.5 text-slate-700" />
                        <span>{subj.count} Section{subj.count !== 1 ? 's' : ''}</span>
                      </span>
                    </div>

                    {/* SUBJECT NAME */}
                    <h3 className="text-2xl font-bold text-slate-900 leading-snug">
                      {subj.subjectName}
                    </h3>

                    {/* METADATA: Semester & Credits */}
                    <p className="text-sm text-slate-600 font-medium mt-1">
                      Semester {selectedSemNum} &bull; {subj.credits || 4} Credits
                    </p>
                  </div>

                  {/* DIVIDER & FOOTER */}
                  <div>
                    <div className="border-t border-slate-100 my-4" />
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-slate-600 font-medium">Sections available</span>
                      <span className="font-extrabold text-xs tracking-wider text-slate-900 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                        <span>SELECT SECTIONS</span>
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 3: SECTION CARDS */}
      {currentView === 'SECTIONS' && (
        <div className="w-full space-y-4">
          {/* BACK TO SUBJECTS BUTTON */}
          <div>
            <button
              type="button"
              onClick={handleBackToSubjects}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 border-2 border-black rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4 text-slate-900 stroke-[2.5]" />
              <span>Back to Subjects</span>
            </button>
          </div>

          {sectionsForSelectedSubject.length === 0 ? (
            <div className="bg-white p-8 rounded-[22px] border-2 border-black text-center space-y-2">
              <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Sections Available</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No sections assigned for this subject in Semester {selectedSemNum}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
              {sectionsForSelectedSubject.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectAssignment(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectAssignment(item.id);
                    }
                  }}
                  className="bg-white p-6 rounded-[22px] border-2 border-black shadow-xs hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-all duration-150 text-left flex flex-col justify-between min-h-[175px] cursor-pointer group w-full"
                >
                  <div>
                    {/* TOP ROW: SECTION BADGE on left, DEPARTMENT BADGE on right */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="bg-slate-100 border border-slate-200 text-slate-900 text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wide">
                        {formatSectionLabel(item.section).toUpperCase()}
                      </span>
                      <span className="border border-slate-200 bg-white text-slate-800 text-xs font-bold px-3 py-1 rounded-lg uppercase">
                        {item.departmentCode || 'CV'}
                      </span>
                    </div>

                    {/* SUBJECT NAME */}
                    <h3 className="text-2xl font-bold text-slate-900 leading-snug">
                      {item.subjectName}
                    </h3>

                    {/* SECTION SUBJECT CODE BADGE */}
                    <div className="mt-2.5">
                      <span className="bg-[#0f172a] text-white font-mono font-bold text-xs px-3.5 py-1.5 rounded-lg tracking-wide inline-block">
                        {item.subjectCode}
                      </span>
                    </div>
                  </div>

                  {/* DIVIDER & FOOTER */}
                  <div>
                    <div className="border-t border-slate-100 my-4" />
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center space-x-2 text-slate-700 font-medium">
                        <Users className="w-4 h-4 text-slate-700" />
                        <span>{item.totalStudents ?? 0} Students</span>
                      </div>
                      <span className="font-extrabold text-xs tracking-wider text-slate-900 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                        <span>OPEN WORKSPACE</span>
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 4: WORKSPACE (TAKE ATTENDANCE | ATTENDANCE CORRECTION | HISTORY & AUDIT) */}
      {currentView === 'WORKSPACE' && selectedAssignmentItem && (
        <div className="space-y-4">
          {/* BACK TO SECTIONS BUTTON */}
          <div>
            <button
              type="button"
              onClick={handleBackToSections}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 border-2 border-black rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4 text-slate-900 stroke-[2.5]" />
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
                      {selectedSubject?.name || completeHistoryData?.assignment?.subjectName || selectedAssignmentItem?.subjectName || 'Course Attendance'}
                    </h2>
                    <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-700">
                        {selectedSubject?.code || completeHistoryData?.assignment?.subjectCode || selectedAssignmentItem?.subjectCode}
                      </span>
                      <span>•</span>
                      <span>{(selectedSubject as any)?.department || completeHistoryData?.assignment?.departmentName || selectedAssignmentItem?.departmentCode || 'CSE'}</span>
                      <span>•</span>
                      <span>Semester {selectedSemNum || completeHistoryData?.assignment?.semester || selectedAssignmentItem?.semester}</span>
                      <span>•</span>
                      <span>{formatSectionLabel(selectedSubject?.section || completeHistoryData?.assignment?.section || selectedAssignmentItem?.section)}</span>
                      {(completeHistoryData?.assignment?.academicYear || selectedAssignmentItem?.academicYear || activeAY) && (
                        <>
                          <span>•</span>
                          <span>AY: {completeHistoryData?.assignment?.academicYear || selectedAssignmentItem?.academicYear || activeAY}</span>
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
                    <span>All ({completeHistoryData?.summary?.totalScheduled ?? (completeHistoryData?.summary as any)?.totalSessions ?? completeHistoryData?.sessions?.length ?? 0})</span>
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
                    <span>Pending ({completeHistoryData?.summary?.pendingCount ?? 0})</span>
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
                    <span>Completed ({(completeHistoryData?.summary as any)?.completedCount ?? completeHistoryData?.summary?.classesHeld ?? 0})</span>
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
                    <span>Cancelled ({completeHistoryData?.summary?.cancelledCount ?? 0})</span>
                  </button>
                </div>

                {/* Right: Classes held indicator + Plus button */}
                <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto">
                  <span className="text-xs font-bold text-slate-600">
                    <span className="text-slate-900 font-extrabold">{completeHistoryData?.summary?.classesHeld ?? 0}</span> classes held
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
                              {isCompleted && session.summary && (
                                <>
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
                              {isPending && (
                                <span className="text-amber-700 font-semibold">
                                  Attendance not taken yet
                                </span>
                              )}
                              {isCancelled && session.cancellationReason && (
                                <span className="text-rose-600 italic">
                                  Reason: {session.cancellationReason}
                                </span>
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
              {/* SUB-VIEW A: MONTHLY ATTENDANCE CALENDAR INTERFACE */}
              {!selectedCorrectionSessionId && (
                <div className="space-y-4">
                  {/* Top Workspace Header: Attendance Calendar + Subject Meta + Nav Controls */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                          Attendance Calendar
                        </h2>
                        <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800">
                            {selectedSubject?.name || completeHistoryData?.assignment?.subjectName || selectedAssignmentItem?.subjectName} ({selectedSubject?.code || completeHistoryData?.assignment?.subjectCode || selectedAssignmentItem?.subjectCode})
                          </span>
                          <span>•</span>
                          <span>{(selectedSubject as any)?.department || completeHistoryData?.assignment?.departmentName || selectedAssignmentItem?.departmentCode || 'CSE'}</span>
                          <span>•</span>
                          <span>Semester {selectedSemNum || completeHistoryData?.assignment?.semester || selectedAssignmentItem?.semester}</span>
                          <span>•</span>
                          <span>{formatSectionLabel(selectedSubject?.section || completeHistoryData?.assignment?.section || selectedAssignmentItem?.section)}</span>
                          {(completeHistoryData?.assignment?.academicYear || selectedAssignmentItem?.academicYear || activeAY) && (
                            <>
                              <span>•</span>
                              <span>AY: {completeHistoryData?.assignment?.academicYear || selectedAssignmentItem?.academicYear || activeAY}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Navigation Controls: Today, Month/Year selector, Arrows & Refresh */}
                    <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                      {/* Today Button */}
                      <button
                        type="button"
                        onClick={handleGoToToday}
                        className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                        title="Return to Today"
                      >
                        Today
                      </button>

                      {/* Previous Month Arrow */}
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="w-9 h-9 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center justify-center transition cursor-pointer shadow-2xs"
                        title="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Month Selector */}
                      <select
                        value={calendarMonth}
                        onChange={(e) => setCalendarMonth(Number(e.target.value))}
                        className="h-9 px-2.5 bg-white border border-slate-200 text-slate-900 font-bold text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                      >
                        {MONTH_NAMES.map((name, idx) => (
                          <option key={name} value={idx}>
                            {name}
                          </option>
                        ))}
                      </select>

                      {/* Year Selector */}
                      <select
                        value={calendarYear}
                        onChange={(e) => setCalendarYear(Number(e.target.value))}
                        className="h-9 px-2.5 bg-white border border-slate-200 text-slate-900 font-bold text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                      >
                        {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                      </select>

                      {/* Next Month Arrow */}
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="w-9 h-9 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center justify-center transition cursor-pointer shadow-2xs"
                        title="Next Month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Refresh Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedAssignmentId) {
                            loadAttendanceHistory(selectedAssignmentId);
                            loadCompleteAttendanceHistory(selectedAssignmentId);
                          }
                        }}
                        disabled={loadingCompleteHistory || loadingHistory}
                        className="w-9 h-9 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center justify-center transition cursor-pointer disabled:opacity-60 shadow-2xs"
                        title="Refresh attendance records"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${(loadingCompleteHistory || loadingHistory) ? 'animate-spin text-amber-600' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Legend Bar */}
                  <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">
                        Legend:
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-400 ring-1 ring-emerald-200" />
                        <span className="font-semibold text-slate-700 text-xs">Attendance Recorded</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-200" />
                        <span className="font-semibold text-slate-700 text-xs">Pending Attendance</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-200" />
                        <span className="font-semibold text-slate-700 text-xs">Cancelled Class</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 bg-amber-100" />
                        <span className="font-semibold text-slate-700 text-xs">Selected Date</span>
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-500">
                      Viewing: <span className="text-slate-800 font-extrabold">{MONTH_NAMES[calendarMonth]} {calendarYear}</span>
                    </div>
                  </div>

                  {/* Monthly Attendance Calendar Grid */}
                  <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                      {/* Days of Week Header */}
                      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100 text-center text-xs font-black text-slate-700 uppercase tracking-wider py-2.5">
                        {DAY_NAMES.map((day, idx) => (
                          <div key={day} className="truncate px-1">
                            <span className="hidden sm:inline">{day}</span>
                            <span className="inline sm:hidden">{SHORT_DAY_NAMES[idx]}</span>
                          </div>
                        ))}
                      </div>

                      {/* Calendar Cells Grid */}
                      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 flex-1">
                        {calendarCells.map((cell) => {
                          const cellSessions = sessionsByDate[cell.dateStr] || [];
                          const completedSessions = cellSessions.filter((s) => s.status === 'Completed');
                          const hasCompleted = completedSessions.length > 0;
                          const hasPending = cellSessions.some((s) => s.status === 'Pending');
                          const hasCancelled = cellSessions.some((s) => s.status === 'Cancelled');
                          const isSelected = selectedCalendarDate === cell.dateStr;

                          // Compute total attendance percentage for recorded session(s)
                          let completedRate: number | null = null;
                          if (hasCompleted) {
                            const totalPresent = completedSessions.reduce((sum, s) => sum + (s.presentCount || 0), 0);
                            const totalStudents = completedSessions.reduce((sum, s) => sum + (s.totalStudents || 0), 0);
                            if (totalStudents > 0) {
                              completedRate = Math.round((totalPresent / totalStudents) * 1000) / 10;
                            } else if (completedSessions[0]?.percentage !== undefined && completedSessions[0]?.percentage !== null) {
                              completedRate = Number(completedSessions[0].percentage);
                            }
                          }

                          // Dynamic cell background & bright hover styling
                          const getCellStyles = () => {
                            if (!cell.isCurrentMonth) {
                              return 'bg-slate-50/50 text-slate-400 hover:bg-slate-100/90 hover:ring-1 hover:ring-slate-300';
                            }
                            if (hasCompleted) {
                              return 'bg-emerald-100/85 text-emerald-950 hover:bg-emerald-200 hover:ring-2 hover:ring-emerald-500 hover:shadow-md hover:z-10';
                            }
                            if (hasPending) {
                              return 'bg-amber-50 text-amber-900 hover:bg-amber-100 hover:ring-2 hover:ring-amber-400 hover:shadow-md hover:z-10';
                            }
                            return 'bg-white text-slate-800 hover:bg-amber-100/90 hover:ring-2 hover:ring-amber-400 hover:shadow-md hover:z-10';
                          };

                          return (
                            <button
                              key={cell.dateStr}
                              type="button"
                              onClick={() => handleCalendarDateClick(cell.dateStr)}
                              title={
                                hasCompleted && completedRate !== null
                                  ? `Attendance: ${completedRate}% (${completedSessions[0]?.presentCount || 0} Present, ${completedSessions[0]?.absentCount || 0} Absent) — Click to correct attendance for ${formatDateLong(cell.dateStr)}`
                                  : hasPending
                                  ? `Click to take attendance for ${formatDateLong(cell.dateStr)}`
                                  : formatDateLong(cell.dateStr)
                              }
                              className={`min-h-[78px] sm:min-h-[92px] p-2 text-left flex flex-col justify-between transition-all duration-150 relative cursor-pointer outline-none ${getCellStyles()} ${
                                isSelected
                                  ? 'ring-2 ring-amber-500 ring-inset shadow-xs z-20'
                                  : ''
                              }`}
                            >
                              {/* Top row: Day number + Today pill */}
                              <div className="flex items-center justify-between w-full">
                                <span
                                  className={`text-xs sm:text-sm font-black rounded-md px-1.5 py-0.5 ${
                                    cell.isToday
                                      ? 'bg-blue-600 text-white shadow-2xs'
                                      : isSelected
                                      ? 'text-amber-800 font-black'
                                      : hasCompleted
                                      ? 'text-emerald-950 font-black'
                                      : cell.isCurrentMonth
                                      ? 'text-slate-800'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {cell.dayNumber}
                                </span>

                                {cell.isToday && (
                                  <span className="hidden sm:inline text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-1 rounded">
                                    Today
                                  </span>
                                )}
                              </div>

                              {/* Bottom area: Glass Attendance Percentage Bar or Pending/Cancelled status */}
                              <div className="w-full mt-auto pt-1 space-y-1">
                                {hasCompleted && completedRate !== null ? (
                                  <div className="w-full space-y-1">
                                    <div className="flex items-baseline justify-between leading-none">
                                      <span className="text-xs sm:text-[13px] font-black text-slate-800 tracking-tight">
                                        {completedRate}%
                                      </span>
                                      {cellSessions.length > 1 && (
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                          {cellSessions.length} classes
                                        </span>
                                      )}
                                    </div>

                                    {/* Glowing Glass Capsule Pill Bar */}
                                    <div className="relative w-full h-2.5 sm:h-3 rounded-full bg-slate-900/15 backdrop-blur-xs p-[1.5px] border border-white/60 shadow-inner overflow-hidden flex items-center">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-lime-400 via-emerald-400 to-cyan-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] transition-all duration-300"
                                        style={{ width: `${Math.min(100, Math.max(0, completedRate))}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    {hasPending && !hasCompleted && (
                                      <div className="text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded truncate text-center">
                                        Pending
                                      </div>
                                    )}
                                    {hasCancelled && !hasCompleted && !hasPending && (
                                      <div className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded truncate text-center">
                                        Cancelled
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Calendar Footer Tip */}
                      <div className="py-2.5 px-4 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>Click any recorded date on the calendar to directly open attendance correction.</span>
                      </div>
                    </div>
                </div>
              )}

              {/* SUB-VIEW B: ACTIVE CORRECTION WORKSPACE FOR CHOSEN SESSION */}
              {selectedCorrectionSessionId && loadingCorrectionSession && (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Opening Attendance Correction Workspace...</p>
                  <p className="text-xs text-slate-500 font-medium">Loading student roster and attendance records...</p>
                </div>
              )}

              {selectedCorrectionSessionId && !loadingCorrectionSession && correctionSessionData && (
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
                        <span>Back to Attendance Calendar</span>
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
                    {historyData?.sessions?.length || 0} Total Sessions Conducted
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="p-6 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-600" />
                    <span className="text-xs">Loading history...</span>
                  </div>
                ) : !historyData || !historyData.sessions || historyData.sessions.length === 0 ? (
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
                        {(historyData?.sessions || []).map((s) => (
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
                  {viewSessionModalData?.session?.date
                    ? formatDateLong(viewSessionModalData.session.date)
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
                (() => {
                  const totalStudents = viewSessionModalData.session?.totalStudents ?? viewSessionModalData.summary?.total ?? viewSessionModalData.students?.length ?? 0;
                  const presentCount = viewSessionModalData.session?.presentCount ?? viewSessionModalData.summary?.present ?? viewSessionModalData.students?.filter((s) => (s.currentStatus || (s as any).status) === 'PRESENT').length ?? 0;
                  const absentCount = viewSessionModalData.session?.absentCount ?? viewSessionModalData.summary?.absent ?? viewSessionModalData.students?.filter((s) => (s.currentStatus || (s as any).status) === 'ABSENT').length ?? 0;
                  const rate = viewSessionModalData.session?.percentage ?? viewSessionModalData.summary?.rate ?? (totalStudents > 0 ? Number(((presentCount / totalStudents) * 100).toFixed(1)) : 100);

                  return (
                    <>
                      {/* Summary Metric Chips */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</div>
                          <div className="text-base font-black text-slate-900">{totalStudents}</div>
                        </div>
                        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Present</div>
                          <div className="text-base font-black text-emerald-800">{presentCount}</div>
                        </div>
                        <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Absent</div>
                          <div className="text-base font-black text-rose-800">{absentCount}</div>
                        </div>
                        <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Rate</div>
                          <div className="text-base font-black text-blue-800">{rate}%</div>
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
                          <thead className="bg-black text-[11px] font-black text-white uppercase tracking-wider border-b border-neutral-800 sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3 text-center w-12 text-neutral-300">#</th>
                              <th className="py-2.5 px-3 text-white">USN</th>
                              <th className="py-2.5 px-3 text-white">Student Name</th>
                              <th className="py-2.5 px-3 text-right text-white">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(viewSessionModalData.students || [])
                              .filter((st) => {
                                if (!viewSessionSearchQuery.trim()) return true;
                                const q = viewSessionSearchQuery.toLowerCase();
                                const usn = (st.usn || '').toLowerCase();
                                const name = (st.studentName || (st as any).name || '').toLowerCase();
                                return usn.includes(q) || name.includes(q);
                              })
                              .sort((a, b) =>
                                compareStudentsByUsnOrName(
                                  a.usn,
                                  b.usn,
                                  a.studentName || (a as any).name,
                                  b.studentName || (b as any).name
                                )
                              )
                              .map((st, idx) => {
                                const isPresent = (st.currentStatus || (st as any).status) === 'PRESENT';
                                return (
                                  <tr key={st.studentId || (st as any).id || idx} className="hover:bg-slate-50/70 transition">
                                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                      {String(idx + 1).padStart(2, '0')}
                                    </td>
                                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{st.usn}</td>
                                    <td className="py-2 px-3 font-semibold text-slate-900">{st.studentName || (st as any).name}</td>
                                    <td className="py-2 px-3 text-right">
                                      {isPresent ? (
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
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              {viewSessionModalData && (
                <button
                  type="button"
                  onClick={() => {
                    const sid = viewSessionModalData?.session?.id;
                    setIsViewSessionModalOpen(false);
                    if (sid) handleActionRequestCorrection(sid);
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
                  {selectedSubject?.name || selectedAssignmentItem?.subjectName || 'Class Session'} • {formatSectionLabel(selectedSubject?.section || selectedAssignmentItem?.section)}
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
                  placeholder="Optional (e.g. Room 101)"
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
