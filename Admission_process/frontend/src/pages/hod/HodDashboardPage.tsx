import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { RootState } from '../../store';
import { toast } from 'react-toastify';
import {
  Building2,
  Users,
  BookOpen,
  Layers,
  ShieldCheck,
  CalendarCheck,
  Award,
  AlertTriangle,
  ChevronRight,
  Filter,
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  TrendingUp,
  Percent,
  Sparkles,
  Lock,
  ArrowUpRight,
  GraduationCap,
  PlusCircle,
  X,
  Send,
  Info,
  FileText,
  Check,
} from 'lucide-react';
import hodService, {
  HodDashboardData,
  HodTeachingResponsibilitiesData,
  HodAvailableSubject,
  HodTeachingAssignment,
  HodSubjectHandlingRequestItem,
} from '../../services/hod.service';

export const HodDashboardPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [data, setData] = useState<HodDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (AY, Semester, Section, Branch - Department is locked)
  const [academicYear, setAcademicYear] = useState<string>('2026-27');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // ─── Teaching Responsibilities & Subject Handling Request State ───────────
  const [teachingData, setTeachingData] = useState<HodTeachingResponsibilitiesData | null>(null);
  const [loadingTeaching, setLoadingTeaching] = useState<boolean>(true);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [requestSemester, setRequestSemester] = useState<number>(1);
  const [availableSubjects, setAvailableSubjects] = useState<HodAvailableSubject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('');
  const [requestReason, setRequestReason] = useState<string>('');
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const isSemesterHandling =
    data?.department?.type === 'SEMESTER_HANDLING' ||
    user?.department?.type === 'SEMESTER_HANDLING' ||
    user?.department?.code === 'AS';

  useEffect(() => {
    fetchDashboardData();
    fetchTeachingResponsibilities();
  }, [academicYear, selectedSemester, selectedSection, selectedBranch]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hodService.getDashboardData({
        academicYear,
        semester: selectedSemester,
        section: selectedSection,
        branch: selectedBranch !== 'ALL' ? selectedBranch : undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load HOD dashboard:', err);
      setError(err?.response?.data?.error || 'Unable to load HOD dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachingResponsibilities = async () => {
    try {
      setLoadingTeaching(true);
      const res = await hodService.getTeachingResponsibilities();
      setTeachingData(res);
    } catch (err: any) {
      console.error('Failed to load teaching responsibilities:', err);
    } finally {
      setLoadingTeaching(false);
    }
  };

  const fetchSubjectsForSemester = async (sem: number) => {
    try {
      setLoadingSubjects(true);
      setSelectedSubjectId('');
      setSelectedSubjectCode('');
      setRequestError(null);
      const subjects = await hodService.getAvailableSubjectsForHandling(sem);
      setAvailableSubjects(subjects);
      if (subjects.length > 0) {
        // Find first available subject that isn't already assigned or pending
        const firstAvailable = subjects.find((s) => !s.isAlreadyAssigned && !s.hasPendingRequest) || subjects[0];
        setSelectedSubjectId(firstAvailable.id);
        setSelectedSubjectCode(firstAvailable.code);
        if (firstAvailable.isAlreadyAssigned) {
          setRequestError('You are already assigned to this subject for the selected semester and academic year.');
        } else if (firstAvailable.hasPendingRequest) {
          setRequestError('A pending request already exists for this subject. Please wait for Dean approval.');
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch subjects for semester:', err);
      toast.error('Failed to load subjects for the selected semester.');
    } finally {
      setLoadingSubjects(false);
    }
  };

  const openRequestModal = () => {
    setRequestSemester(1);
    setRequestReason('');
    setRequestError(null);
    setIsRequestModalOpen(true);
    fetchSubjectsForSemester(1);
  };

  const handleSemesterChange = (newSem: number) => {
    setRequestSemester(newSem);
    fetchSubjectsForSemester(newSem);
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setSelectedSubjectId(sId);
    setRequestError(null);
    const sub = availableSubjects.find((s) => s.id === sId);
    if (sub) {
      setSelectedSubjectCode(sub.code);
      if (sub.isAlreadyAssigned) {
        setRequestError('You are already assigned to this subject for the selected semester and academic year.');
      } else if (sub.hasPendingRequest) {
        setRequestError('A pending request already exists for this subject, semester, and academic year. Please wait for Dean approval.');
      }
    } else {
      setSelectedSubjectCode('');
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      setRequestError('Please select a subject to handle.');
      return;
    }
    const selectedSub = availableSubjects.find((s) => s.id === selectedSubjectId);
    if (selectedSub?.isAlreadyAssigned) {
      setRequestError('You are already assigned to this subject for the selected semester and academic year.');
      return;
    }
    if (selectedSub?.hasPendingRequest) {
      setRequestError('A pending request already exists for this subject, semester, and academic year. Please wait for Dean approval.');
      return;
    }

    try {
      setSubmittingRequest(true);
      setRequestError(null);
      const res = await hodService.submitSubjectHandlingRequest({
        semester: Number(requestSemester),
        subjectId: selectedSubjectId,
        academicYear,
        reason: requestReason.trim() || undefined,
      });

      toast.success(res.message || 'Subject handling request submitted successfully. Waiting for Dean Academic approval.');
      setIsRequestModalOpen(false);
      fetchTeachingResponsibilities();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to submit subject handling request.';
      setRequestError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const hodName = data?.hod?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.name || 'Head of Department');
  const hodEmail = data?.hod?.email || user?.email || 'hod@jcer.ac.in';
  const deptName = data?.department?.name || user?.department?.name || (isSemesterHandling ? 'Applied Science' : 'Computer Science & Engineering');
  const deptCode = data?.department?.code || user?.department?.code || (isSemesterHandling ? 'AS' : 'CSE');
  const stats = data?.stats;

  const totalStudentsCount = stats?.totalStudents ?? 0;

  return (
    <div className="space-y-6">
      
      {/* ── Welcome Banner (Dark Shiny Navy Blue Style) ───────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] p-6 sm:p-8 text-white border border-[#1e3a8a]/40 shadow-[0_16px_36px_rgba(7,14,34,0.35)]">
        {/* Shiny specular reflections & glass gleam */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 rounded-full bg-gradient-to-br from-cyan-400/20 via-blue-500/15 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -top-16 left-1/4 w-96 h-40 bg-gradient-to-b from-blue-400/15 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome, {hodName} 👋
            </h2>
            <p className="text-sm text-blue-100/90 max-w-2xl font-medium">
              {isSemesterHandling ? (
                <>Academic Control Hub for <span className="font-bold text-white">Applied Science</span>. Managing Semesters 1 & 2 across actual branches.</>
              ) : (
                <>Academic Control Hub for <span className="font-bold text-white">{deptName}</span>. Monitor departmental students, faculty assignments, bit-wise marks, and attendance.</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={openRequestModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 border border-emerald-400/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Request to Handle Subject</span>
            </button>
            <Link
              to="/hod/faculty/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-950/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 border border-blue-400/30"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Faculty</span>
            </Link>
            <Link
              to="/hod/students"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs transition-all backdrop-blur-md"
            >
              <Users className="w-4 h-4" />
              <span>View Students</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Filter Bar (Admin Clean Design) ─────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-black tracking-wider text-neutral-800 dark:text-neutral-200 uppercase">
          <Filter className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span>FILTER ACADEMIC SCOPE</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Locked Department pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
            <Lock className="w-3 h-3 text-neutral-400" />
            <span>Dept: <strong className="text-neutral-900 dark:text-white">{deptCode}</strong></span>
          </div>

          {/* Academic Year Selector */}
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-xs focus:ring-2 focus:ring-violet-500"
          >
            <option value="2026-27">AY 2026-27</option>
            <option value="2025-26">AY 2025-26</option>
            <option value="2024-25">AY 2024-25</option>
          </select>

          {/* Semester Selector */}
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-xs focus:ring-2 focus:ring-violet-500"
          >
            {isSemesterHandling ? (
              <>
                <option value="ALL">Semesters 1 & 2</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </>
            ) : (
              <>
                <option value="ALL">All Semesters</option>
                <option value="1">Semester 1 (AS)</option>
                <option value="2">Semester 2 (AS)</option>
                <option value="3">Semester 3</option>
                <option value="4">Semester 4</option>
                <option value="5">Semester 5</option>
                <option value="6">Semester 6</option>
                <option value="7">Semester 7</option>
                <option value="8">Semester 8</option>
              </>
            )}
          </select>

          {/* Branch Selector for Applied Science */}
          {isSemesterHandling && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-xs focus:ring-2 focus:ring-violet-500"
            >
              <option value="ALL">All Branches</option>
              <option value="CSE">CSE</option>
              <option value="CSE-AIML">CSE-AIML</option>
              <option value="ECE">ECE</option>
              <option value="ME">ME</option>
              <option value="CV">CV</option>
            </select>
          )}

          {/* Section Selector */}
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-xs focus:ring-2 focus:ring-violet-500"
          >
            <option value="ALL">All Sections</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
          </select>
        </div>
      </div>

      {/* ── 8 Core Summary Cards (Admin Card Style) ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Students */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Total Students
            </span>
            <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {loading ? '...' : totalStudentsCount}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Enrolled in {deptCode}</p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Semesters 1-8</span>
            <Link to="/hod/students" className="text-neutral-900 dark:text-white font-bold hover:underline inline-flex items-center gap-0.5">
              Directory <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* KPI 2: Total Faculty */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Total Faculty
            </span>
            <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {loading ? '...' : (stats?.totalFaculty ?? 0)}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Teaching staff in dept</p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Professors & Assts</span>
            <Link to="/hod/faculty" className="text-neutral-900 dark:text-white font-bold hover:underline inline-flex items-center gap-0.5">
              Faculty List <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* KPI 3: Total Subjects */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Total Subjects
            </span>
            <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {loading ? '...' : (stats?.totalSubjects ?? 0)}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Curriculum offerings</p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Theory & Lab</span>
            <Link to="/hod/subjects" className="text-neutral-900 dark:text-white font-bold hover:underline inline-flex items-center gap-0.5">
              Subjects <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* KPI 4: Active Sections */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Active Sections
            </span>
            <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {loading ? '...' : (stats?.activeSections ?? 0)}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Classroom divisions</p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Sections A, B, C</span>
            <Link to="/hod/students/sections" className="text-neutral-900 dark:text-white font-bold hover:underline inline-flex items-center gap-0.5">
              Sections <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* KPI 5: Overall Attendance */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Overall Attendance
            </span>
            <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {loading ? '...' : `${stats?.overallAttendance ?? 0}%`}
            </h3>
            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, stats?.overallAttendance ?? 0)}%` }}
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Department avg</span>
            <Link to="/hod/attendance" className="text-neutral-900 dark:text-white font-bold hover:underline inline-flex items-center gap-0.5">
              Attendance <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* KPI 6: Average Marks */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Average Marks
            </span>
            <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {loading ? '...' : `${stats?.averageMarks ?? 0}%`}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">IA & Assessment avg</p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Bit-wise metrics</span>
            <Link to="/hod/academics" className="text-neutral-900 dark:text-white font-bold hover:underline inline-flex items-center gap-0.5">
              Academics <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* KPI 7: Defaulters (< 75%) */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Defaulters (&lt; 75%)
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
              {loading ? '...' : (stats?.attendanceDefaulters ?? 0)}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Requires follow-up</p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Attendance list</span>
            <Link to="/hod/attendance/defaulters" className="text-rose-600 dark:text-rose-400 font-bold hover:underline inline-flex items-center gap-0.5">
              Defaulters List <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* KPI 8: Pending Faculty Actions */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Pending Actions
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {loading ? '...' : (stats?.pendingFacultyActions ?? 0)}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Awaiting Dean/Principal</p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Approval queue</span>
            <Link to="/hod/faculty" className="text-amber-600 dark:text-amber-400 font-bold hover:underline inline-flex items-center gap-0.5">
              Review Queue <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Branch Breakdown for Applied Science Scope ──────────────────────── */}
      {isSemesterHandling && data?.branchBreakdown && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Actual Branch Distribution (Sem 1 & 2)</span>
              </h3>
              <p className="text-xs text-neutral-400">
                Total students enrolled across parent engineering branches under Applied Science academic handling
              </p>
            </div>
            <Link
              to="/hod/students"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              View Directory <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-4">
            {data.branchBreakdown.map((b) => (
              <div
                key={b.branchCode}
                className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-800 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    {b.branchCode}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                </div>
                <div className="mt-3">
                  <h4 className="text-2xl font-black text-neutral-900 dark:text-white">{b.totalStudents}</h4>
                  <p className="text-[10px] text-neutral-400 font-semibold">
                    Sem 1: {b.sem1Count} • Sem 2: {b.sem2Count}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 📚 TEACHING RESPONSIBILITIES (HOD Subject Handling) ────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0 mt-0.5">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                  Teaching Responsibilities
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {teachingData?.totalSubjectsCount ?? 0} {teachingData?.totalSubjectsCount === 1 ? 'Subject Handled' : 'Subjects Handled'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Subjects directly instructed and handled by you. Activated via Dean Academic approval.
              </p>
            </div>
          </div>

          <button
            onClick={openRequestModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md shadow-emerald-950/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 border border-emerald-400/30 self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Request to Handle Subject</span>
          </button>
        </div>

        {/* Active Teaching Assignments Grid */}
        {loadingTeaching ? (
          <div className="p-8 text-center text-xs text-neutral-400">Loading teaching responsibilities...</div>
        ) : teachingData?.activeAssignments && teachingData.activeAssignments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {teachingData.activeAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/40 via-white to-neutral-50/50 dark:from-emerald-950/20 dark:via-neutral-900 dark:to-neutral-900/60 border border-emerald-200/70 dark:border-emerald-900/40 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                      ACTIVE ASSIGNMENT
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      Sem {assignment.semester} {assignment.section ? `• Sec ${assignment.section}` : ''}
                    </span>
                  </div>

                  <div className="mt-3.5">
                    <h4 className="text-sm font-black text-neutral-900 dark:text-white leading-tight">
                      {assignment.subjectName}
                    </h4>
                    <p className="text-xs font-mono font-bold text-neutral-500 dark:text-neutral-400 mt-1">
                      {assignment.subjectCode}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-900/40 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-500">Academic Year:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">{assignment.academicYear}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-500">Assignment Type:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">HOD Subject Handling</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-neutral-500 font-medium">Sheet Access:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Attendance: ON
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Marks: ON
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-700 mb-6">
            <BookOpen className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No Active Teaching Assignments</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
              You are not currently assigned to handle any subjects. Click <strong className="text-neutral-700 dark:text-neutral-300">"+ Request to Handle Subject"</strong> to submit a subject handling request to Dean Academics.
            </p>
          </div>
        )}

        {/* ── My Subject Handling Requests History Sub-section ── */}
        {teachingData?.myRequests && teachingData.myRequests.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Subject Handling Request History</span>
            </h4>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 uppercase tracking-wider font-extrabold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Subject Code</th>
                    <th className="py-3 px-4">Semester</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Requested Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Review Notes / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {teachingData.myRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                        {req.subjectName}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-300">
                        {req.subjectCode}
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-700 dark:text-neutral-300">
                        Semester {req.semester}
                      </td>
                      <td className="py-3 px-4 font-medium text-neutral-600 dark:text-neutral-400">
                        {req.academicYear}
                      </td>
                      <td className="py-3 px-4 text-neutral-500 text-[11px]">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                          {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                          {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-500 text-[11px]">
                        {req.status === 'REJECTED' && req.rejectionReason ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold" title={req.rejectionReason}>
                            Reason: {req.rejectionReason}
                          </span>
                        ) : req.reason ? (
                          <span className="truncate max-w-xs block" title={req.reason}>
                            {req.reason}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">None provided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Pending Faculty Authorizations Widget (Admin Table Style) ──────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
              <span>Pending Faculty Authorizations</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Awaiting Authority Approval
              </span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Newly created faculty accounts stay <span className="font-bold text-neutral-700 dark:text-neutral-300">PENDING_AUTHORIZATION</span> until approved by Dean Academics or Principal.
            </p>
          </div>
          <Link
            to="/hod/faculty/create"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs transition-colors shadow-sm self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Faculty</span>
          </Link>
        </div>

        {data?.pendingAuthorizationsList && data.pendingAuthorizationsList.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
                <tr>
                  <th className="py-3.5 px-4">Faculty Member</th>
                  <th className="py-3.5 px-4">Assigned Subject</th>
                  <th className="py-3.5 px-4">Sem & Sec</th>
                  <th className="py-3.5 px-4">Dispatched To</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Login Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {data.pendingAuthorizationsList.map((req) => (
                  <tr key={req.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-neutral-900 dark:text-white">{req.facultyName}</div>
                      <div className="text-[11px] text-neutral-400">{req.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-neutral-800 dark:text-neutral-200">
                      <div>{req.subjectName}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{req.subjectCode}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-neutral-700 dark:text-neutral-300">
                      Sem {req.semester} • Sec {req.section}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                        req.authority === 'PRINCIPAL'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}>
                        {req.authority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : req.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                        <Lock className="w-3 h-3" /> Disabled
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-700">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No Pending Faculty Requests</p>
            <p className="text-xs text-neutral-400 mt-1">All faculty accounts in your department are authorized and active.</p>
          </div>
        )}
      </div>

      {/* ── Two-Column Row: Attendance Analytics & Bit-Wise Marks Summary ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card Left: Attendance Analytics Snapshot */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                  <span>Attendance Analytics</span>
                </h3>
                <p className="text-xs text-neutral-400">Semester-wise average percentage</p>
              </div>
              <Link to="/hod/attendance" className="text-xs font-bold text-neutral-900 dark:text-white hover:underline inline-flex items-center gap-1">
                Full Breakdown <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-4 mt-4">
              {data?.attendanceAnalytics?.semesterBreakdown && data.attendanceAnalytics.semesterBreakdown.length > 0 ? (
                data.attendanceAnalytics.semesterBreakdown.map((item) => (
                  <div key={item.semester}>
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="text-neutral-700 dark:text-neutral-300">Semester {item.semester}</span>
                      <span className="text-neutral-900 dark:text-white font-mono">{item.attendance}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-neutral-900 dark:bg-neutral-100 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${item.attendance}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-700">
                  <p className="text-xs font-semibold text-neutral-400">No attendance data recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Right: Bit-Wise Academic Component Snapshot ──── */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                  <span>Bit-Wise Performance Snapshot</span>
                </h3>
                <p className="text-xs text-neutral-400">Normalized Bit 1 to Bit 5 component scores</p>
              </div>
              <Link to="/hod/academics/bitwise" className="text-xs font-bold text-neutral-900 dark:text-white hover:underline inline-flex items-center gap-1">
                Bit Analysis <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 mt-4">
              {data?.marksAnalytics?.bitwiseSummary && data.marksAnalytics.bitwiseSummary.length > 0 ? (
                data.marksAnalytics.bitwiseSummary.map((b) => (
                  <div key={b.name} className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white flex items-center justify-center font-black text-xs">
                        {b.name.replace('Bit ', 'B')}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{b.name}</p>
                        <p className="text-[10px] text-neutral-400">Max Marks: {b.maxMarks}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-neutral-900 dark:text-white">{b.average} / {b.maxMarks}</p>
                      <p className="text-[10px] text-neutral-400 font-medium">{((b.average / b.maxMarks) * 100).toFixed(0)}% achievement</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-700">
                  <p className="text-xs font-semibold text-neutral-400">No bit-wise assessment scores recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Department Faculty Assignments ────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
              <span>Active Department Faculty Assignments</span>
            </h3>
            <p className="text-xs text-neutral-400">Live subjects, sections, and sheet access controls</p>
          </div>
          <Link to="/hod/faculty/assignments" className="text-xs font-bold text-neutral-900 dark:text-white hover:underline inline-flex items-center gap-1">
            View All <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {data?.recentAssignments && data.recentAssignments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.recentAssignments.map((assign) => (
              <div key={assign.id} className="p-4 rounded-2xl bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-200/70 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white">{assign.facultyName}</h4>
                    <p className="text-[11px] text-neutral-400">{assign.email}</p>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                    Sem {assign.semester} • {assign.section}
                  </span>
                </div>

                <div className="mt-3 py-2 px-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 text-xs">
                  <span className="text-neutral-400 font-medium text-[10px] block">Subject:</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">{assign.subjectName}</span>
                  <span className="text-[10px] text-neutral-400 font-mono ml-1.5">({assign.subjectCode})</span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-neutral-500 font-semibold">Sheet Access:</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      assign.attendanceAccess
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}>
                      Attn: {assign.attendanceAccess ? 'ON' : 'OFF'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      assign.marksAccess
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}>
                      Marks: {assign.marksAccess ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-700">
            <Users className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No Faculty Assignments Yet</p>
            <p className="text-xs text-neutral-400 mt-1">Assignments made to department faculty will appear here.</p>
          </div>
        )}
      </div>

      {/* ── 📝 MODAL: Request to Handle Subject ───────────────────────────── */}
      {isRequestModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-xl w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between relative overflow-hidden">
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Request to Handle Subject</h3>
                  <p className="text-xs text-emerald-100/90 font-medium">
                    Submit request for Dean Academic approval to assign teaching responsibilities to yourself
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors relative z-10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleRequestSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              
              {/* Read-Only Profile & Context Section */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-800 space-y-3">
                <div className="flex items-center gap-1.5 text-neutral-500 font-bold uppercase text-[10px] tracking-wider mb-1">
                  <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>HOD Account Information (Auto-populated • Read-only)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                      HOD Name
                    </label>
                    <input
                      type="text"
                      value={hodName}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                      Email
                    </label>
                    <input
                      type="text"
                      value={hodEmail}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-xs cursor-not-allowed truncate"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={`${deptName} (${deptCode})`}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs cursor-not-allowed truncate"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      value={academicYear}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Semester & Subject Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Semester Dropdown */}
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={requestSemester}
                    onChange={(e) => handleSemesterChange(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs focus:ring-2 focus:ring-emerald-500"
                  >
                    {isSemesterHandling ? (
                      <>
                        <option value={1}>Semester 1 (Applied Science)</option>
                        <option value={2}>Semester 2 (Applied Science)</option>
                      </>
                    ) : (
                      <>
                        <option value={1}>Semester 1</option>
                        <option value={2}>Semester 2</option>
                        <option value={3}>Semester 3</option>
                        <option value={4}>Semester 4</option>
                        <option value={5}>Semester 5</option>
                        <option value={6}>Semester 6</option>
                        <option value={7}>Semester 7</option>
                        <option value={8}>Semester 8</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Subject Code (Auto-populated Read-only) */}
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Subject Code <span className="text-neutral-400 font-normal">(Auto-populated)</span>
                  </label>
                  <input
                    type="text"
                    value={selectedSubjectCode || 'Select a subject'}
                    readOnly
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-mono font-bold text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Subject Dropdown (Dynamically filtered) */}
              <div>
                <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Subject <span className="text-rose-500">*</span>
                </label>
                {loadingSubjects ? (
                  <div className="p-3 text-center text-xs text-neutral-400 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700">
                    Loading subjects for Semester {requestSemester}...
                  </div>
                ) : availableSubjects.length === 0 ? (
                  <div className="p-3 text-center text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40 font-semibold">
                    {!isSemesterHandling && (requestSemester === 1 || requestSemester === 2)
                      ? 'Semester 1 and 2 subjects are handled by the Applied Science Department.'
                      : `No active subjects found for Semester ${requestSemester}.`}
                  </div>
                ) : (
                  <select
                    value={selectedSubjectId}
                    onChange={handleSubjectChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Subject from Semester {requestSemester} --</option>
                    {availableSubjects.map((sub) => (
                      <option
                        key={sub.id}
                        value={sub.id}
                        disabled={sub.isAlreadyAssigned || sub.hasPendingRequest}
                      >
                        {sub.code} - {sub.name} ({sub.departmentName})
                        {sub.isAlreadyAssigned ? ' [ALREADY ASSIGNED]' : sub.hasPendingRequest ? ' [PENDING APPROVAL]' : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-neutral-400 mt-1">
                  Filtered exclusively to Semester {requestSemester} subjects belonging to {deptName} or common academic courses.
                </p>
              </div>

              {/* Reason (Optional) */}
              <div>
                <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Reason / Purpose <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={2}
                  placeholder="e.g., Specialized subject matter instruction, direct course coordination, or core theory coverage."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Duplicate Prevention / Error Feedback Box */}
              {requestError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold">{requestError}</span>
                </div>
              )}

              {/* Informative Approval Workflow Notice */}
              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Approval Workflow:</span>
                </div>
                <p className="leading-relaxed">
                  Submitting this form creates a <strong className="font-bold">PENDING</strong> request in Dean Academic's review queue. The teaching assignment becomes <strong className="font-bold">ACTIVE</strong> only after Dean Academic approval. No duplicate faculty accounts will be created.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest || !selectedSubjectId || !!requestError}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold shadow-md shadow-emerald-950/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {submittingRequest ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default HodDashboardPage;

