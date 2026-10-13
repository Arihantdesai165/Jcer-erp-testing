import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  RefreshCw,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Lock,
  Layers,
  GraduationCap,
  Users,
  Building2,
  Calendar,
  Clock,
  ArrowUpDown,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import facultyService, {
  FacultyAllSubjectCohort,
  FacultyConsolidatedAttendanceData,
  ConsolidatedStudentRow,
} from '../../services/faculty.service';
import { useAcademicYear } from '../../context/AcademicYearContext';

export const FacultyAllSubjectAttendancePage: React.FC = () => {
  const navigate = useNavigate();
  const { academicYear: globalAY, academicYears: allAYs } = useAcademicYear();

  // Cohort Selection State
  const [authorizedCohorts, setAuthorizedCohorts] = useState<FacultyAllSubjectCohort[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(globalAY || '2026-27');
  const [selectedSem, setSelectedSem] = useState<number>(1);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // Register Data State
  const [registerData, setRegisterData] = useState<FacultyConsolidatedAttendanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [eligibilityFilter, setEligibilityFilter] = useState<'ALL' | 'ELIGIBLE' | 'NOT_ELIGIBLE'>('ALL');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(false);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(30);

  // Race condition guard
  const activeRequestIdRef = useRef<number>(0);

  // 1. Fetch authorized cohorts for this faculty member on mount
  useEffect(() => {
    let isMounted = true;
    facultyService
      .getAllSubjectAttendanceCohorts()
      .then((res) => {
        if (!isMounted) return;
        const cohorts = res.cohorts || [];
        setAuthorizedCohorts(cohorts);

        const years = res.academicYears?.length > 0 ? res.academicYears : [globalAY || '2026-27'];
        setAvailableYears(years);

        // Determine default AY
        const defaultAY = years.includes(globalAY) ? globalAY : years[0];
        setSelectedYear(defaultAY);

        // Find matching cohorts for default AY
        const matchingForAY = cohorts.filter((c) => c.academicYear === defaultAY);
        if (matchingForAY.length > 0) {
          const firstCohort = matchingForAY[0];
          setSelectedSem(firstCohort.semester);
          setSelectedDeptId(firstCohort.departmentId);
          // Default to 'ALL' (All Sections) for cohort-wide authorized faculty,
          // or their specific authorized section if restricted
          if (firstCohort.hasCohortAccess !== false) {
            setSelectedSection('ALL');
          } else {
            setSelectedSection(firstCohort.sections[0] || 'ALL');
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load authorized cohorts:', err);
        setError('Failed to resolve authorized teaching cohorts. Please verify your faculty assignments.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [globalAY]);

  // Standard 8 engineering semesters in numerical order (1 through 8)
  const ALL_SEMESTERS = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8], []);
  const availableSemesters = ALL_SEMESTERS;

  // Available departments for currently selected AY
  const availableDepartments = useMemo(() => {
    const list = authorizedCohorts.filter(
      (c) => c.academicYear === selectedYear
    );
    const map = new Map<string, { id: string; name: string; code: string }>();
    list.forEach((c) => {
      if (!map.has(c.departmentId)) {
        map.set(c.departmentId, {
          id: c.departmentId,
          name: c.departmentName,
          code: c.departmentCode,
        });
      }
    });
    return Array.from(map.values());
  }, [authorizedCohorts, selectedYear]);

  // Current cohort record
  const currentCohort = useMemo(() => {
    return authorizedCohorts.find(
      (c) =>
        c.academicYear === selectedYear &&
        c.semester === selectedSem &&
        c.departmentId === selectedDeptId
    );
  }, [authorizedCohorts, selectedYear, selectedSem, selectedDeptId]);

  // Available sections for selector:
  // Supports 'ALL' (All Sections) for cohort-wide authorized faculty + all dynamically configured cohort sections
  const availableSectionOptions = useMemo(() => {
    const cohortSecs = currentCohort?.sections || [];
    const dataSecs = registerData?.sections?.map((s) => s.name) || [];
    const distinctSections = Array.from(new Set([...cohortSecs, ...dataSecs])).filter(Boolean).sort();
    if (currentCohort && currentCohort.hasCohortAccess === false) {
      return distinctSections.length > 0 ? distinctSections : ['A'];
    }
    return ['ALL', ...distinctSections];
  }, [currentCohort, registerData]);

  // Update selected department if current selection becomes invalid
  useEffect(() => {
    if (availableDepartments.length > 0 && !availableDepartments.some((d) => d.id === selectedDeptId)) {
      setSelectedDeptId(availableDepartments[0].id);
    }
  }, [availableDepartments, selectedDeptId]);

  // Update selected section if current selection becomes invalid for active cohort
  useEffect(() => {
    if (!currentCohort) return;
    if (currentCohort.hasCohortAccess === false) {
      if (selectedSection === 'ALL' || !currentCohort.sections.includes(selectedSection)) {
        setSelectedSection(currentCohort.sections[0] || 'ALL');
      }
    } else {
      if (selectedSection !== 'ALL' && currentCohort.sections.length > 0 && !currentCohort.sections.includes(selectedSection)) {
        setSelectedSection('ALL');
      }
    }
  }, [currentCohort, selectedSection]);

  // 2. Fetch Consolidated Attendance Register for the active selection
  const fetchRegister = useCallback(
    async (isBackgroundRefresh = false) => {
      if (!selectedYear || !selectedSem || !selectedDeptId) return;

      const requestId = ++activeRequestIdRef.current;

      if (!isBackgroundRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const data = await facultyService.getAllSubjectAttendanceRegister({
          academicYear: selectedYear,
          semester: selectedSem,
          departmentId: selectedDeptId,
          section: selectedSection,
        });

        // Prevent race conditions where old responses overwrite newer ones
        if (requestId === activeRequestIdRef.current) {
          setRegisterData(data);
          setLastRefreshedAt(new Date());
          setError(null);
        }
      } catch (err: any) {
        if (requestId === activeRequestIdRef.current) {
          console.error('Failed to load consolidated attendance register:', err);
          const msg =
            err.response?.data?.error ||
            err.message ||
            'Failed to load consolidated attendance register for this cohort.';
          setError(msg);
          setRegisterData(null);
        }
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedYear, selectedSem, selectedDeptId, selectedSection]
  );

  // Trigger fetch when scope selectors change
  useEffect(() => {
    if (selectedDeptId) {
      fetchRegister(false);
    }
  }, [fetchRegister, selectedDeptId]);

  // Auto-refresh interval (polling with cleanup)
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    setRefreshCountdown(30);
    const countdownTimer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchRegister(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownTimer);
    };
  }, [autoRefreshEnabled, fetchRegister]);

  // Filter students based on search query and eligibility status
  const filteredStudents = useMemo(() => {
    if (!registerData?.students) return [];

    let list = registerData.students;

    // Search query filter (USN or Student Name)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (st) =>
          st.name.toLowerCase().includes(q) ||
          st.usn.toLowerCase().includes(q) ||
          st.section.toLowerCase().includes(q)
      );
    }

    // Eligibility filter
    if (eligibilityFilter === 'ELIGIBLE') {
      list = list.filter((st) => st.eligibility === 'Eligible');
    } else if (eligibilityFilter === 'NOT_ELIGIBLE') {
      list = list.filter((st) => st.eligibility === 'Not Eligible');
    }

    return list;
  }, [registerData, searchQuery, eligibilityFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    if (!registerData) {
      return {
        totalStudents: 0,
        totalSubjects: 0,
        eligibleCount: 0,
        notEligibleCount: 0,
        averagePercentage: null as number | null,
      };
    }

    const students = registerData.students || [];
    const totalStudents = students.length;
    const totalSubjects = registerData.subjects?.length || 0;
    const eligibleCount = students.filter((s) => s.eligibility === 'Eligible').length;
    const notEligibleCount = students.filter((s) => s.eligibility === 'Not Eligible').length;

    let sumPct = 0;
    let countWithPct = 0;
    students.forEach((s) => {
      if (s.overallPercentage !== null) {
        sumPct += s.overallPercentage;
        countWithPct += 1;
      }
    });

    const averagePercentage = countWithPct > 0 ? Number((sumPct / countWithPct).toFixed(1)) : null;

    return {
      totalStudents,
      totalSubjects,
      eligibleCount,
      notEligibleCount,
      averagePercentage,
    };
  }, [registerData]);

  // Download Excel URL
  const excelDownloadUrl = useMemo(() => {
    if (!selectedDeptId) return '';
    return facultyService.downloadAllSubjectAttendanceExcelUrl({
      academicYear: selectedYear,
      semester: selectedSem,
      departmentId: selectedDeptId,
      section: selectedSection,
    });
  }, [selectedYear, selectedSem, selectedDeptId, selectedSection]);

  const handleBackToMenu = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/faculty/dashboard');
    }
  };

  return (
    <div className="p-3.5 sm:p-5 space-y-3 max-w-full w-full">
      {/* ── TOP BANNER: COMPACT WORKSPACE TOOLBAR & SCOPE CONTROLS ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs relative overflow-hidden space-y-3.5">
        {/* Compact Workspace Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Back to Menu - High Contrast & Prominent */}
            <button
              onClick={handleBackToMenu}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow border border-neutral-800 dark:border-neutral-200 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Return to Faculty Dashboard"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Back to Menu</span>
            </button>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              Strictly Read-Only
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Authorized Cohort View
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {lastRefreshedAt && (
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {lastRefreshedAt.toLocaleTimeString()}
              </span>
            )}

            {/* Auto-Refresh Toggle */}
            <button
              onClick={() => setAutoRefreshEnabled((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                autoRefreshEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700 hover:bg-neutral-100'
              }`}
              title="Automatically poll PostgreSQL for latest saved faculty attendance"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${autoRefreshEnabled ? 'animate-spin' : ''}`}
              />
              <span>Auto-Sync: {autoRefreshEnabled ? `${refreshCountdown}s` : 'Off'}</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchRegister(true)}
              disabled={refreshing || loading}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-black text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Register'}</span>
            </button>

            {/* Download Excel */}
            {excelDownloadUrl && (
              <a
                href={excelDownloadUrl}
                download
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-neutral-500" />
                <span>Export Excel</span>
              </a>
            )}
          </div>
        </div>

        {/* ── SCOPE CONTROLS & SELECTORS BAR — BALANCED 12-COLUMN HORIZONTAL ROW ── */}
        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Academic Year Selector */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
              <span>Academic Year</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setRegisterData(null);
                setError(null);
              }}
              className="w-full h-10 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs cursor-pointer transition-colors"
            >
              {availableYears.map((ay) => (
                <option key={ay} value={ay}>
                  Academic Year {ay}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Selector — All 8 Semesters */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-neutral-500" />
              <span>Semester</span>
            </label>
            <select
              value={selectedSem}
              onChange={(e) => {
                setSelectedSem(Number(e.target.value));
                setRegisterData(null);
                setError(null);
              }}
              className="w-full h-10 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs cursor-pointer transition-colors"
            >
              {availableSemesters.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          {/* Department Selector */}
          <div className="lg:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-neutral-500" />
              <span>Department / Branch</span>
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => {
                setSelectedDeptId(e.target.value);
                setRegisterData(null);
                setError(null);
              }}
              className="w-full h-10 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs cursor-pointer transition-colors"
            >
              {availableDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section Selector */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-neutral-500" />
              <span>Section Roster</span>
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full h-10 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs cursor-pointer transition-colors"
            >
              {availableSectionOptions.map((sec) => (
                <option key={sec} value={sec}>
                  {sec === 'ALL' ? 'All Sections' : `Section ${sec}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
            Cohort Students
          </span>
          <span className="text-xl font-black text-neutral-900 dark:text-white mt-0.5 block">
            {loading ? '...' : metrics.totalStudents}
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
            Cohort Subjects
          </span>
          <span className="text-xl font-black text-neutral-900 dark:text-white mt-0.5 block">
            {loading ? '...' : metrics.totalSubjects}
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
            Eligible (≥ 85%)
          </span>
          <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5 block">
            {loading ? '...' : metrics.eligibleCount}
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
            Defaulters (&lt; 85%)
          </span>
          <span className="text-xl font-black text-rose-700 dark:text-rose-400 mt-0.5 block">
            {loading ? '...' : metrics.notEligibleCount}
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
            Cohort Average
          </span>
          <span className="text-xl font-black text-blue-700 dark:text-blue-400 mt-0.5 block">
            {loading ? '...' : metrics.averagePercentage !== null ? `${metrics.averagePercentage}%` : 'N/A'}
          </span>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-3 sm:p-3.5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search USN or student name..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-xs font-semibold text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Eligibility Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setEligibilityFilter('ALL')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              eligibilityFilter === 'ALL'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            All Students ({registerData?.students?.length || 0})
          </button>
          <button
            onClick={() => setEligibilityFilter('ELIGIBLE')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              eligibilityFilter === 'ELIGIBLE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-500 hover:text-emerald-700 dark:hover:text-emerald-400'
            }`}
          >
            Eligible ({metrics.eligibleCount})
          </button>
          <button
            onClick={() => setEligibilityFilter('NOT_ELIGIBLE')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              eligibilityFilter === 'NOT_ELIGIBLE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-neutral-500 hover:text-rose-700 dark:hover:text-rose-400'
            }`}
          >
            Defaulters ({metrics.notEligibleCount})
          </button>
        </div>
      </div>

      {/* ── ERROR STATE ── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-3 text-xs font-semibold text-rose-800 dark:text-rose-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchRegister(false)}
            className="px-3.5 py-1.5 bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 rounded-xl text-xs font-bold hover:bg-rose-300 dark:hover:bg-rose-800 transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── LOADING SKELETON STATE ── */}
      {loading && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-10 border border-neutral-200/80 dark:border-neutral-800 text-center space-y-3.5 shadow-xs">
          <div className="inline-block p-3.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 animate-spin">
            <RefreshCw className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
            Consolidating Cohort Attendance Records...
          </h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Aggregating teaching allocations, conducted sessions, and attended classes from PostgreSQL authoritative tables.
          </p>
        </div>
      )}

      {/* ── EMPTY STATE (NO STUDENTS IN COHORT) ── */}
      {!loading && !error && registerData && registerData.students.length === 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-10 border border-neutral-200/80 dark:border-neutral-800 text-center space-y-3 shadow-xs">
          <div className="inline-flex p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
            No Attendance Records for Semester {selectedSem}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            No enrolled students or conducted class sessions were found for Semester {selectedSem} in {currentCohort?.departmentName || 'this department'} for Academic Year {selectedYear}. Select another semester or section to view attendance records.
          </p>
        </div>
      )}

      {/* ── EMPTY STATE (PROMPT TO SELECT COHORT) ── */}
      {!loading && !registerData && !error && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-10 border border-neutral-200/80 dark:border-neutral-800 text-center space-y-3 shadow-xs">
          <div className="inline-flex p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
            Select a Cohort to View Consolidated Register
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            Choose an Academic Year, Semester, and Department to load authoritative attendance records.
          </p>
        </div>
      )}

      {/* ── MAIN SPREADSHEET REGISTER TABLE ── */}
      {!loading && registerData && registerData.students.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden flex flex-col">
          {/* Table Container with Horizontal and Vertical Scrolling */}
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-210px)] border-b border-neutral-200 dark:border-neutral-800 select-none">
            <table className="w-full text-xs border-collapse font-sans min-w-[1200px]">
              {/* ── MULTI-LEVEL HEADER ── */}
              <thead className="sticky top-0 z-20 shadow-md">
                {/* ── TOP HEADER ROW (ROW 5 IN EXCEL) ── */}
                <tr className="border-b border-neutral-700 bg-black text-white">
                  {/* Left block: TOTAL NO. OF CLASS across USN, Student Name, Section */}
                  <th
                    colSpan={3}
                    className="py-2.5 px-3 text-center text-[11px] font-black uppercase tracking-wider text-white border-r border-neutral-700 sticky left-0 z-30 bg-black"
                  >
                    TOTAL NO. OF CLASS
                  </th>

                  {/* Conducted counts per subject column */}
                  {registerData.subjects.map((sub) => {
                    const subSummary = registerData.subjectSummaries.find((s) => s.subjectId === sub.id);
                    const cond = subSummary ? subSummary.conductedClasses : 0;
                    return (
                      <th
                        key={`conducted-count-${sub.id}`}
                        className="py-2 px-2 text-center text-xs font-black text-white border-r border-neutral-700 bg-black min-w-[75px]"
                        title={`${sub.code}: ${sub.name}`}
                      >
                        {cond}
                      </th>
                    );
                  })}

                  {/* Percentage Attendance grouped header */}
                  {registerData.subjects.length > 0 && (
                    <th
                      colSpan={registerData.subjects.length}
                      className="py-2.5 px-3 text-center text-[11px] font-black uppercase tracking-wider text-white border-r border-neutral-700 bg-black"
                    >
                      PERCENTAGE ATTENDANCE
                    </th>
                  )}

                  {/* Overall Summary grouped header */}
                  <th
                    colSpan={4}
                    className="py-2.5 px-3 text-center text-[11px] font-black uppercase tracking-wider text-white bg-black"
                  >
                    OVERALL SUMMARY
                  </th>
                </tr>

                {/* ── BOTTOM HEADER ROW (ROW 6 IN EXCEL) — CONTRASTING SLATE-800 ROW ── */}
                <tr className="border-b-2 border-slate-700 bg-slate-800 text-white">
                  {/* Sticky Identification Columns */}
                  <th className="py-2.5 px-3 text-left font-black tracking-wide border-r border-slate-700 sticky left-0 z-30 bg-slate-800 text-white min-w-[140px] max-w-[140px]">
                    USN
                  </th>
                  <th className="py-2.5 px-3 text-left font-black tracking-wide border-r border-slate-700 sticky left-[140px] z-30 bg-slate-800 text-white min-w-[200px] max-w-[220px]">
                    Student Name
                  </th>
                  <th className="py-2.5 px-2 text-center font-black tracking-wide border-r-2 border-slate-700 sticky left-[340px] z-30 bg-slate-800 text-white min-w-[65px] max-w-[65px]">
                    Section
                  </th>

                  {/* Subject Attended Columns (with Codes) */}
                  {registerData.subjects.map((sub) => (
                    <th
                      key={`hdr-att-${sub.id}`}
                      className="py-2.5 px-2 text-center font-black text-[11px] text-white border-r border-slate-700 min-w-[75px] bg-slate-800"
                      title={`${sub.code}: ${sub.name}`}
                    >
                      {sub.code}
                    </th>
                  ))}

                  {/* Subject Percentage Columns (with Codes) */}
                  {registerData.subjects.map((sub) => (
                    <th
                      key={`hdr-pct-${sub.id}`}
                      className="py-2.5 px-2 text-center font-black text-[11px] text-white border-r border-slate-700 min-w-[85px] bg-slate-800"
                      title={`${sub.code}: ${sub.name}`}
                    >
                      {sub.code}
                    </th>
                  ))}

                  {/* Summary Columns */}
                  <th className="py-2.5 px-2 text-center font-black border-r border-slate-700 min-w-[75px] text-white bg-slate-800">
                    Conducted
                  </th>
                  <th className="py-2.5 px-2 text-center font-black border-r border-slate-700 min-w-[75px] text-white bg-slate-800">
                    Attended
                  </th>
                  <th className="py-2.5 px-2 text-center font-black border-r border-slate-700 min-w-[85px] text-white bg-slate-800">
                    Overall %
                  </th>
                  <th className="py-2.5 px-3 text-center font-black min-w-[100px] text-white bg-slate-800">
                    Eligibility
                  </th>
                </tr>
              </thead>

              {/* ── TABLE BODY ── */}
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7 + 2 * registerData.subjects.length}
                      className="py-12 text-center text-neutral-400 text-xs"
                    >
                      No students found matching your criteria in this cohort.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg = isEven
                      ? 'bg-white dark:bg-neutral-900'
                      : 'bg-neutral-50/70 dark:bg-neutral-850/50';

                    const isEligible = st.eligibility === 'Eligible';
                    const isDefaulter = st.eligibility === 'Not Eligible';

                    return (
                      <tr
                        key={st.id}
                        className={`${rowBg} hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors`}
                      >
                        {/* USN (Sticky Left) */}
                        <td
                          className={`py-2 px-3 font-mono font-bold text-[11px] text-neutral-900 dark:text-neutral-100 border-r border-neutral-200 dark:border-neutral-800 sticky left-0 z-10 ${
                            isEven ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50 dark:bg-neutral-850'
                          }`}
                        >
                          {st.usn}
                        </td>

                        {/* Student Name (Sticky Left) */}
                        <td
                          className={`py-2 px-3 font-semibold text-xs text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800 truncate max-w-[220px] sticky left-[140px] z-10 ${
                            isEven ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50 dark:bg-neutral-850'
                          }`}
                          title={st.name}
                        >
                          {st.name}
                        </td>

                        {/* Section (Sticky Left) */}
                        <td
                          className={`py-2 px-2 text-center font-bold text-xs border-r-2 border-neutral-300 dark:border-neutral-700 sticky left-[340px] z-10 ${
                            isEven ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50 dark:bg-neutral-850'
                          }`}
                        >
                          <span className="inline-block px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                            {st.section}
                          </span>
                        </td>

                        {/* Subject Attended Counts */}
                        {registerData.subjects.map((sub) => {
                          const stats = st.subjectStats[sub.id];
                          const att = stats ? stats.attended : 0;
                          return (
                            <td
                              key={`cell-att-${st.id}-${sub.id}`}
                              className="py-2 px-2 text-center font-medium text-xs border-r border-neutral-200 dark:border-neutral-800"
                            >
                              {att}
                            </td>
                          );
                        })}

                        {/* Subject Percentage Attendance */}
                        {registerData.subjects.map((sub) => {
                          const stats = st.subjectStats[sub.id];
                          const pct = stats ? stats.percentage : null;
                          const cond = stats ? stats.conducted : 0;

                          if (cond === 0 || pct === null) {
                            return (
                              <td
                                key={`cell-pct-${st.id}-${sub.id}`}
                                className="py-2 px-2 text-center text-xs text-neutral-400 border-r border-neutral-200 dark:border-neutral-800 font-mono"
                              >
                                —
                              </td>
                            );
                          }

                          const isSubjectEligible = pct >= 85.0;
                          return (
                            <td
                              key={`cell-pct-${st.id}-${sub.id}`}
                              className={`py-2 px-2 text-center font-mono font-bold text-xs border-r border-neutral-200 dark:border-neutral-800 ${
                                isSubjectEligible
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {pct.toFixed(2)}%
                            </td>
                          );
                        })}

                        {/* Total Conducted */}
                        <td className="py-2 px-2 text-center font-bold text-xs border-r border-neutral-200 dark:border-neutral-800">
                          {st.totalConducted}
                        </td>

                        {/* Total Attended */}
                        <td className="py-2 px-2 text-center font-bold text-xs border-r border-neutral-200 dark:border-neutral-800">
                          {st.totalAttended}
                        </td>

                        {/* Overall Percentage */}
                        <td
                          className={`py-2 px-2 text-center font-mono font-extrabold text-xs border-r border-neutral-200 dark:border-neutral-800 ${
                            st.overallPercentage === null
                              ? 'text-neutral-400'
                              : st.overallPercentage >= 85.0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {st.overallPercentage !== null ? `${st.overallPercentage.toFixed(2)}%` : '—'}
                        </td>

                        {/* Eligibility Pill */}
                        <td className="py-2 px-3 text-center">
                          {isEligible ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Eligible
                            </span>
                          ) : isDefaulter ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              Not Eligible
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                              No Records
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* ── TABLE FOOTER: SUBJECT-WISE SUMMARY ROW ── */}
              {registerData.subjectSummaries.length > 0 && (
                <tfoot className="bg-black text-white border-t-2 border-neutral-700 font-bold sticky bottom-0 z-20 shadow-lg">
                  <tr className="bg-black text-white">
                    <td
                      colSpan={3}
                      className="py-2.5 px-3 text-right font-black uppercase text-xs sticky left-0 z-30 bg-black text-white border-r border-neutral-700"
                    >
                      Subject Conducted Classes:
                    </td>
                    {registerData.subjects.map((sub) => {
                      const sum = registerData.subjectSummaries.find((s) => s.subjectId === sub.id);
                      return (
                        <td
                          key={`foot-cond-${sub.id}`}
                          className="py-2 px-2 text-center font-black text-xs border-r border-neutral-700 bg-black text-white"
                        >
                          {sum ? sum.conductedClasses : 0}
                        </td>
                      );
                    })}
                    {registerData.subjects.map((sub) => {
                      const sum = registerData.subjectSummaries.find((s) => s.subjectId === sub.id);
                      return (
                        <td
                          key={`foot-avg-${sub.id}`}
                          className="py-2 px-2 text-center font-mono font-black text-xs border-r border-neutral-700 bg-black text-blue-400"
                        >
                          {sum?.averagePercentage !== null ? `${sum?.averagePercentage}%` : '—'}
                        </td>
                      );
                    })}
                    <td
                      colSpan={4}
                      className="py-2.5 px-3 text-center text-xs font-black uppercase tracking-wider text-neutral-300 bg-black"
                    >
                      Threshold: 85.0%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Section Summaries Breakdown */}
          {registerData.sectionSummaries?.length > 0 && (
            <div className="p-4 bg-neutral-50/80 dark:bg-neutral-850 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider block mb-2">
                Section Performance Summary
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {registerData.sectionSummaries.map((sec) => (
                  <div
                    key={sec.section}
                    className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-extrabold text-neutral-900 dark:text-white block">
                        {sec.section}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {sec.totalStudents} Students
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200 block">
                        Avg: {sec.averagePercentage !== null ? `${sec.averagePercentage}%` : 'N/A'}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600 block">
                        {sec.eligibleCount} Eligible / {sec.notEligibleCount} Defaulter
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FacultyAllSubjectAttendancePage;
