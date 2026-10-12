import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  GraduationCap,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Calendar,
  Layers,
  RefreshCw,
  User,
  Clock,
  BookOpen,
  ClipboardList,
  ArrowLeft,
} from 'lucide-react';
import { RootState } from '../../store';
import hodService, { HodStudentItem } from '../../services/hod.service';
import usePersistentState from '../../hooks/usePersistentState';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { getStudentCohort, formatBatchCohort } from '../../utils/batchCohort.util';

export const HodStudentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state: RootState) => state.auth);
  const { academicYear } = useAcademicYear();

  const deptCode = user?.department?.code || 'ECE';

  const initialSem = searchParams.get('semester') || 'ALL';
  const initialSec = searchParams.get('section') || 'ALL';

  const [students, setStudents] = useState<HodStudentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [availableSections, setAvailableSections] = useState<string[]>(['A', 'B', 'C']);

  // Applied Filters State (Persisted across tabs & refreshes)
  const isSemesterHandling =
    user?.department?.type === 'SEMESTER_HANDLING' || user?.department?.code === 'AS';

  const [search, setSearch] = usePersistentState<string>('hod_students_search', '');
  const [selectedSemester, setSelectedSemester] = usePersistentState<string>('hod_students_semester', initialSem);
  const [selectedSection, setSelectedSection] = usePersistentState<string>('hod_students_section', initialSec);
  const [selectedBranch, setSelectedBranch] = usePersistentState<string>('hod_students_branch', 'ALL');
  const [status, setStatus] = usePersistentState<string>('hod_students_status', 'ALL');
  const [admissionType, setAdmissionType] = usePersistentState<string>('hod_students_adm_type', 'ALL');
  const [qualification, setQualification] = useState<string>('ALL');
  const [gender, setGender] = useState<string>('ALL');
  const [category, setCategory] = useState<string>('ALL');
  const [district, setDistrict] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('usn');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Pending Filters State (applied when user clicks "Apply Filters")
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const [pendingSemester, setPendingSemester] = useState<string>(initialSem);
  const [pendingSection, setPendingSection] = useState<string>(initialSec);
  const [pendingBranch, setPendingBranch] = useState<string>('ALL');
  const [pendingStatus, setPendingStatus] = useState<string>('ALL');
  const [pendingAdmissionType, setPendingAdmissionType] = useState<string>('ALL');
  const [pendingQualification, setPendingQualification] = useState<string>('ALL');
  const [pendingGender, setPendingGender] = useState<string>('ALL');
  const [pendingCategory, setPendingCategory] = useState<string>('ALL');
  const [pendingDistrict, setPendingDistrict] = useState<string>('');
  const [pendingStartDate, setPendingStartDate] = useState<string>('');
  const [pendingEndDate, setPendingEndDate] = useState<string>('');
  const [pendingSortBy, setPendingSortBy] = useState<string>('usn');
  const [pendingSortOrder, setPendingSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Pagination
  const [page, setPage] = useState<number>(1);
  const initialLimitParam = Number(searchParams.get('limit')) || Number(searchParams.get('pageSize'));
  const validLimits = [10, 50, 100, 500];
  const defaultLimit = validLimits.includes(initialLimitParam) ? initialLimitParam : 10;
  const [limit, setLimit] = usePersistentState<number>('hod_students_limit', defaultLimit);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalStudents, setTotalStudents] = useState<number>(0);

  const handleLimitChange = (newLimit: number) => {
    const valid = [10, 50, 100, 500].includes(newLimit) ? newLimit : 10;
    setLimit(valid);
    setPage(1);

    const newParams = new URLSearchParams(searchParams);
    if (valid === 10) {
      newParams.delete('limit');
      newParams.delete('pageSize');
    } else {
      newParams.set('limit', valid.toString());
    }
    setSearchParams(newParams, { replace: true });
  };

  // Sync URL query params with state (e.g. from HOD Semester Breakdown "View Cohort")
  useEffect(() => {
    const urlSem = searchParams.get('semester') || 'ALL';
    const urlSec = searchParams.get('section') || 'ALL';
    const urlBranch = searchParams.get('branch') || 'ALL';
    const urlLimitStr = searchParams.get('limit') || searchParams.get('pageSize');
    if (urlSem !== selectedSemester) {
      setSelectedSemester(urlSem);
      setPendingSemester(urlSem);
      setPage(1);
    }
    if (urlSec !== selectedSection) {
      setSelectedSection(urlSec);
      setPendingSection(urlSec);
      setPage(1);
    }
    if (urlBranch !== selectedBranch) {
      setSelectedBranch(urlBranch);
      setPendingBranch(urlBranch);
      setPage(1);
    }
    if (urlLimitStr) {
      const urlLimit = Number(urlLimitStr);
      if ([10, 50, 100, 500].includes(urlLimit) && urlLimit !== limit) {
        setLimit(urlLimit);
        setPage(1);
      }
    }
    // If arriving scoped to a specific semester via URL and no search param was specified, clear any lingering search
    if (searchParams.get('semester') && !searchParams.get('search') && search) {
      setSearch('');
      setPendingSearch('');
    }
  }, [searchParams]);

  // Load available sections dynamically for HOD's department and selected academic year
  useEffect(() => {
    hodService
      .getStudentSections(selectedSemester === 'ALL' ? undefined : selectedSemester, academicYear)
      .then((secData) => {
        if (Array.isArray(secData) && secData.length > 0) {
          const uniqueNames = Array.from(new Set(secData.map((s) => s.name).filter(Boolean)));
          if (uniqueNames.length > 0) {
            uniqueNames.sort();
            setAvailableSections(uniqueNames);
          } else {
            setAvailableSections([]);
          }
        } else {
          setAvailableSections([]);
        }
      })
      .catch((err) => {
        console.warn('Could not load department sections:', err);
        setAvailableSections([]);
      });
  }, [academicYear, selectedSemester]);

  // Reset section filter if not valid in current academic year
  useEffect(() => {
    if (selectedSection !== 'ALL' && availableSections.length > 0) {
      const cleanSel = formatSectionDisplay(selectedSection);
      const exists = availableSections.some(
        (s) => formatSectionDisplay(s) === cleanSel || s === selectedSection
      );
      if (!exists) {
        setSelectedSection('ALL');
        setPendingSection('ALL');
      }
    } else if (selectedSection !== 'ALL' && availableSections.length === 0) {
      setSelectedSection('ALL');
      setPendingSection('ALL');
    }
  }, [academicYear, availableSections]);

  // Fetch student data whenever active filter/page states change
  useEffect(() => {
    fetchStudents();
  }, [
    page,
    limit,
    selectedSemester,
    selectedSection,
    selectedBranch,
    academicYear,
    status,
    admissionType,
    qualification,
    gender,
    category,
    district,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    search,
  ]);

  // Debounced auto-search when user types in search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pendingSearch.trim() !== search) {
        setSearch(pendingSearch.trim());
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [pendingSearch]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await hodService.getStudents({
        page,
        limit,
        semester: selectedSemester === 'ALL' ? undefined : selectedSemester,
        section: selectedSection === 'ALL' ? undefined : selectedSection,
        branch: selectedBranch === 'ALL' ? undefined : selectedBranch,
        status: status === 'ALL' ? undefined : status,
        academicYear: academicYear === 'ALL' ? undefined : academicYear,
        admissionType: admissionType === 'ALL' ? undefined : admissionType,
        qualification: qualification === 'ALL' ? undefined : qualification,
        gender: gender === 'ALL' ? undefined : gender,
        category: category === 'ALL' ? undefined : category,
        district: district.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search.trim() || undefined,
        sortBy,
        sortOrder,
      });

      setStudents(res.students || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalStudents(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load department students:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick Filter Semester Selection
  const handleSelectSemester = (sem: string) => {
    setSelectedSemester(sem);
    setPendingSemester(sem);
    setPage(1);

    const newParams = new URLSearchParams(searchParams);
    if (sem === 'ALL') {
      newParams.delete('semester');
    } else {
      newParams.set('semester', sem);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Quick Filter Section Selection
  const handleSelectSection = (sec: string) => {
    setSelectedSection(sec);
    setPendingSection(sec);
    setPage(1);

    const newParams = new URLSearchParams(searchParams);
    if (sec === 'ALL') {
      newParams.delete('section');
    } else {
      newParams.set('section', sec);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Quick Filter Branch Selection
  const handleSelectBranch = (b: string) => {
    setSelectedBranch(b);
    setPendingBranch(b);
    setPage(1);

    const newParams = new URLSearchParams(searchParams);
    if (b === 'ALL') {
      newParams.delete('branch');
    } else {
      newParams.set('branch', b);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Explicit Search Execution
  const handleExecuteSearch = () => {
    setSearch(pendingSearch.trim());
    setSelectedSemester(pendingSemester);
    setSelectedSection(pendingSection);
    setSelectedBranch(pendingBranch);
    setStatus(pendingStatus);
    setAdmissionType(pendingAdmissionType);
    setQualification(pendingQualification);
    setGender(pendingGender);
    setCategory(pendingCategory);
    setDistrict(pendingDistrict);
    setStartDate(pendingStartDate);
    setEndDate(pendingEndDate);
    setSortBy(pendingSortBy);
    setSortOrder(pendingSortOrder);
    setPage(1);

    const newParams = new URLSearchParams(searchParams);
    if (pendingSemester !== 'ALL') newParams.set('semester', pendingSemester);
    else newParams.delete('semester');
    if (pendingSection !== 'ALL') newParams.set('section', pendingSection);
    else newParams.delete('section');
    if (pendingBranch !== 'ALL') newParams.set('branch', pendingBranch);
    else newParams.delete('branch');
    setSearchParams(newParams, { replace: true });
  };

  // Reset Filters
  const handleResetFilters = () => {
    setPendingSearch('');
    setPendingSemester('ALL');
    setPendingSection('ALL');
    setPendingBranch('ALL');
    setPendingStatus('ALL');
    setPendingAdmissionType('ALL');
    setPendingQualification('ALL');
    setPendingGender('ALL');
    setPendingCategory('ALL');
    setPendingDistrict('');
    setPendingStartDate('');
    setPendingEndDate('');
    setPendingSortBy('usn');
    setPendingSortOrder('ASC');

    setSearch('');
    setSelectedSemester('ALL');
    setSelectedSection('ALL');
    setSelectedBranch('ALL');
    setStatus('ALL');
    setAdmissionType('ALL');
    setQualification('ALL');
    setGender('ALL');
    setCategory('ALL');
    setDistrict('');
    setStartDate('');
    setEndDate('');
    setSortBy('usn');
    setSortOrder('ASC');
    setLimit(10);
    setPage(1);

    const newParams = new URLSearchParams();
    setSearchParams(newParams, { replace: true });
  };

  const handleRefresh = () => {
    fetchStudents();
  };

  // Status mapping for badge colors
  const STATUS_COLOR_MAP: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    ENROLLED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    APPROVED: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800',
    VALIDATED: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800',
    SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
  };

  // Helper to format section cleanly as "A", "B", etc. without "Sec " or UUID strings
  const formatSectionDisplay = (sec: string | null | undefined): string => {
    if (!sec) return '—';
    const trimmed = String(sec).trim();
    if (!trimmed || trimmed === '—') return '—';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return '—';
    }
    const clean = trimmed.replace(/^(Section|Sec)\s*/i, '').trim();
    return clean || '—';
  };

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12">
      {/* ── Return to Cohort Breadcrumb ────────────────────────────────────── */}
      {searchParams.get('semester') && searchParams.get('semester') !== 'ALL' && (
        <div className="flex items-center justify-between">
          <Link
            to={`/hod/students/semesters/${searchParams.get('semester')}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 shadow-xs hover:shadow-sm transition-all cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Semester {searchParams.get('semester')} Cohort</span>
          </Link>
        </div>
      )}

      {/* ── Top Row: KPI Card & Actions (Admin Style) ────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Total Department Students KPI Card */}
        <div className="p-3.5 rounded-2xl border text-left transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col justify-between h-20 w-56 bg-neutral-900 border-neutral-950 text-white dark:bg-neutral-950 dark:border-neutral-900">
          <div className="flex justify-between items-start w-full">
            <span className="text-[10px] font-black uppercase tracking-wider leading-none opacity-75">
              Total Department Students
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-auto">
            <span className="text-xl font-black leading-none">{totalStudents}</span>
            <span className="text-[9px] font-bold opacity-60">students</span>
          </div>
        </div>

        {/* Right Actions: Breakdown, Allocations, Refresh */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <Link
            to="/hod/students/semesters"
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm flex items-center gap-2"
          >
            <Calendar size={14} className="text-violet-600 dark:text-violet-400" />
            <span>Semester Breakdown</span>
          </Link>

          <Link
            to="/hod/students/sections"
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm flex items-center gap-2"
          >
            <Layers size={14} className="text-violet-600 dark:text-violet-400" />
            <span>Section Allocations</span>
          </Link>

          <button
            onClick={handleRefresh}
            className="p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300 cursor-pointer"
            title="Refresh student list"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Quick Filter by Semester ────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
          Quick Filter by Semester
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth">
          <button
            onClick={() => handleSelectSemester('ALL')}
            className={`px-3 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[75px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
              selectedSemester === 'ALL'
                ? 'bg-blue-600 border-blue-700 text-white'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">{isSemesterHandling ? 'SEM 1 & 2' : 'ALL SEM'}</span>
          </button>

          {(isSemesterHandling ? [1, 2] : [1, 2, 3, 4, 5, 6, 7, 8]).map((s) => (
            <button
              key={s}
              onClick={() => handleSelectSemester(s.toString())}
              className={`px-3 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[75px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
                selectedSemester === s.toString()
                  ? 'bg-blue-600 border-blue-700 text-white'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
              }`}
            >
              <span className="w-full text-center leading-none">Sem {s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick Filter by Branch (Applied Science Multi-Branch Scope) ──────── */}
      {isSemesterHandling && (
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
            Quick Filter by Actual Branch
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth">
            {['ALL', 'CSE', 'CSE-AIML', 'ECE', 'ME', 'CV'].map((b) => (
              <button
                key={b}
                onClick={() => handleSelectBranch(b)}
                className={`px-3 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
                  selectedBranch === b
                    ? 'bg-indigo-600 border-indigo-700 text-white'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
                }`}
              >
                <span className="w-full text-center leading-none">{b === 'ALL' ? 'All Branches' : b}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Filter by Section ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
          Quick Filter by Section
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth">
          <button
            onClick={() => handleSelectSection('ALL')}
            className={`px-3 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
              selectedSection === 'ALL'
                ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">All Sections</span>
          </button>

          {availableSections.map((sec) => {
            const cleanLabel = formatSectionDisplay(sec);
            const isSecActive =
              selectedSection === sec ||
              (cleanLabel !== '—' && formatSectionDisplay(selectedSection) === cleanLabel);
            return (
              <button
                key={sec}
                onClick={() => handleSelectSection(sec)}
                className={`px-3 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
                  isSecActive
                    ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
                }`}
              >
                <span className="w-full text-center leading-none">
                  Section {cleanLabel !== '—' ? cleanLabel : sec}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search & Advanced Filters Panel (Admin Style) ────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-800">
        {/* Search Input Row & Show Students Range Selector */}
        <div className="px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-400 transition-all">
              <Search className="shrink-0 text-neutral-400" size={16} />
              <input
                type="text"
                placeholder="Search by name, USN, enrollment number, email..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleExecuteSearch();
                  }
                }}
                className="flex-1 bg-transparent text-sm text-neutral-800 dark:text-white placeholder:text-neutral-400 outline-none font-medium"
              />
              {pendingSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingSearch('');
                    setSearch('');
                    setPage(1);
                  }}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 transition-colors text-xs font-bold cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleExecuteSearch}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Search size={14} />
              <span>Search</span>
            </button>
          </div>

          {/* Highlighted Show Students Range Selector */}
          <div className="shrink-0 flex items-center gap-2.5 self-end md:self-auto pl-0 md:pl-3 md:border-l border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl shadow-xs transition-all hover:border-blue-300">
              <label
                htmlFor="show-students-range-select"
                className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              >
                <Users size={14} className="text-blue-600 dark:text-blue-400" />
                <span>SHOW STUDENTS</span>
              </label>
              <div className="relative">
                <select
                  id="show-students-range-select"
                  value={limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                  className="bg-white dark:bg-neutral-900 border border-blue-300 dark:border-blue-700 rounded-lg pl-3 pr-7 py-1 text-xs font-black text-blue-950 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs appearance-none font-mono"
                >
                  <option value={10}>1–10</option>
                  <option value={50}>1–50</option>
                  <option value={100}>1–100</option>
                  <option value={500}>1–500</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                  ▼
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Filters Grid */}
        <div className="px-5 pt-4 pb-5 space-y-4">
          {/* Row 1: 5 Primary Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3.5 gap-y-3">

            {/* Semester */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Semester
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                  <GraduationCap size={12} />
                </span>
                <select
                  value={pendingSemester}
                  onChange={(e) => setPendingSemester(e.target.value)}
                  className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="ALL">All Semesters</option>
                  <option value="1">1st Semester</option>
                  <option value="2">2nd Semester</option>
                  {!isSemesterHandling && (
                    <>
                      <option value="3">3rd Semester</option>
                      <option value="4">4th Semester</option>
                      <option value="5">5th Semester</option>
                      <option value="6">6th Semester</option>
                      <option value="7">7th Semester</option>
                      <option value="8">8th Semester</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Status
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                  <Clock size={12} />
                </span>
                <select
                  value={pendingStatus}
                  onChange={(e) => setPendingStatus(e.target.value)}
                  className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ENROLLED">Admission Confirmed</option>
                  <option value="APPROVED">Verified (Admin)</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Admission Type */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Admission Type
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                  <BookOpen size={12} />
                </span>
                <select
                  value={pendingAdmissionType}
                  onChange={(e) => setPendingAdmissionType(e.target.value)}
                  className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  <option value="KCET">KCET</option>
                  <option value="DCET">DCET (Lateral)</option>
                  <option value="MANAGEMENT">Management</option>
                  <option value="COMEDK">COMEDK</option>
                  <option value="EXISTING">Existing</option>
                </select>
              </div>
            </div>

            {/* Qualification */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Qualification
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                  <BookOpen size={12} />
                </span>
                <select
                  value={pendingQualification}
                  onChange={(e) => setPendingQualification(e.target.value)}
                  className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="ALL">All Qualifications</option>
                  <option value="PUC">PUC / 12th</option>
                  <option value="DIPLOMA">Diploma</option>
                </select>
              </div>
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Gender
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                  <User size={12} />
                </span>
                <select
                  value={pendingGender}
                  onChange={(e) => setPendingGender(e.target.value)}
                  className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="ALL">All Genders</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 2: Category, District, Sort By, Actions */}
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            {/* Category */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                Category
              </label>
              <select
                value={pendingCategory}
                onChange={(e) => setPendingCategory(e.target.value)}
                className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer min-w-[130px] h-[36px]"
              >
                <option value="ALL">All Categories</option>
                <option value="GM">GM (General Merit)</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="2A">2A</option>
                <option value="2B">2B</option>
                <option value="3A">3A</option>
                <option value="3B">3B</option>
                <option value="C1">C1</option>
              </select>
            </div>

            {/* District */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                District
              </label>
              <input
                type="text"
                placeholder="e.g. Belagavi"
                value={pendingDistrict}
                onChange={(e) => setPendingDistrict(e.target.value)}
                className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 w-32 placeholder:text-neutral-400 h-[36px]"
              />
            </div>

            {/* Sort By */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Sort By
              </label>
              <div className="flex items-center gap-2 h-[36px]">
                <select
                  value={pendingSortBy}
                  onChange={(e) => setPendingSortBy(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer h-full"
                >
                  <option value="usn">USN</option>
                  <option value="name">Student Name</option>
                  <option value="rank">Enrollment Number</option>
                  <option value="date">Date Submitted</option>
                  <option value="updatedAt">Last Updated</option>
                </select>
                <button
                  type="button"
                  onClick={() => setPendingSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))}
                  className="flex items-center gap-1 px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 transition-colors whitespace-nowrap h-full cursor-pointer"
                >
                  {pendingSortBy === 'date' || pendingSortBy === 'updatedAt'
                    ? pendingSortOrder === 'DESC'
                      ? '↓ Newest'
                      : '↑ Oldest'
                    : pendingSortOrder === 'DESC'
                      ? '↓ Descending'
                      : '↑ Ascending'}
                </button>
              </div>
            </div>

            {/* Bottom Actions: Reset & Apply Filters */}
            <div className="flex items-center gap-3 ml-auto pt-1">
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-neutral-900 text-rose-500 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={handleExecuteSearch}
                className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Student Table (Admin Style) ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent" />
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">
              {academicYear ? `Loading students for AY ${academicYear}...` : 'Loading department students...'}
            </p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-20 text-center space-y-3">
            <ClipboardList className="mx-auto text-neutral-300 dark:text-neutral-700" size={48} />
            <h3 className="text-base font-extrabold text-neutral-800 dark:text-white">
              No Students Found
            </h3>
            <p className="text-xs font-semibold text-neutral-500 max-w-md mx-auto">
              {search || selectedSemester !== 'ALL' || selectedSection !== 'ALL' || status !== 'ALL'
                ? 'Try adjusting your filters or search terms.'
                : `No students found for Academic Year ${academicYear || 'selected'}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
                <tr className="border-b border-neutral-800 text-[10px] font-black uppercase tracking-widest text-white">
                  {isSemesterHandling && <th className="py-4 px-4 text-white text-center w-16">Sl No</th>}
                  <th
                    className="py-4 px-4 text-white text-center cursor-pointer hover:text-blue-400 transition-colors select-none"
                    onClick={() => {
                      if (sortBy === 'name') {
                        const newOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
                        setSortOrder(newOrder);
                        setPendingSortOrder(newOrder);
                      } else {
                        setSortBy('name');
                        setPendingSortBy('name');
                        setSortOrder('ASC');
                        setPendingSortOrder('ASC');
                      }
                    }}
                    title="Sort by Student Name"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Student</span>
                      {sortBy === 'name' && (
                        <span className="text-blue-400 text-xs">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  {isSemesterHandling ? (
                    <>
                      <th className="py-4 px-4 text-center text-white">Actual Branch</th>
                      <th
                        className="py-4 px-4 text-white text-center cursor-pointer hover:text-blue-400 transition-colors select-none"
                        onClick={() => {
                          if (sortBy === 'usn') {
                            const newOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
                            setSortOrder(newOrder);
                            setPendingSortOrder(newOrder);
                          } else {
                            setSortBy('usn');
                            setPendingSortBy('usn');
                            setSortOrder('ASC');
                            setPendingSortOrder('ASC');
                          }
                        }}
                        title="Sort by USN"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>USN / App ID</span>
                          {sortBy === 'usn' && (
                            <span className="text-blue-400 text-xs">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                    </>
                  ) : (
                    <th
                      className="py-4 px-4 text-white text-center cursor-pointer hover:text-blue-400 transition-colors select-none"
                      onClick={() => {
                        if (sortBy === 'usn') {
                          const newOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
                          setSortOrder(newOrder);
                          setPendingSortOrder(newOrder);
                        } else {
                          setSortBy('usn');
                          setPendingSortBy('usn');
                          setSortOrder('ASC');
                          setPendingSortOrder('ASC');
                        }
                      }}
                      title="Sort by USN"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>USN / Enrollment</span>
                        {sortBy === 'usn' && (
                          <span className="text-blue-400 text-xs">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  )}
                  <th className="py-4 px-4 text-center text-white">Semester</th>
                  <th className="py-4 px-4 text-center text-white">Section</th>
                  {!isSemesterHandling && <th className="py-4 px-4 text-center text-white">Batch</th>}
                  <th className="py-4 px-4 text-center text-white">Status</th>
                  <th className="py-4 px-4 text-center text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/40 text-xs font-semibold">
                {students.map((student, idx) => {
                  const displayIdentifier =
                    student.usn || student.enrollmentNumber || student.applicationNumber || '—';
                  const slNo = student.slNo || idx + 1 + (page - 1) * limit;

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors"
                    >
                      {/* Sl No for Applied Science */}
                      {isSemesterHandling && (
                        <td className="py-4 px-4 text-center font-bold text-neutral-900 dark:text-white text-xs">
                          {slNo}
                        </td>
                      )}

                      {/* Student info */}
                      <td className="py-4 px-4">
                        <div>
                          <button
                            onClick={() => navigate(`/hod/students/${student.id}`)}
                            className="font-bold text-neutral-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left text-xs"
                          >
                            {student.name}
                          </button>
                        </div>
                      </td>

                      {/* Actual Branch for Applied Science */}
                      {isSemesterHandling && (
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-extrabold text-[11px] border border-blue-200 dark:border-blue-800">
                            {student.actualBranch || student.department?.code || student.branch || '—'}
                          </span>
                        </td>
                      )}

                      {/* USN / Enrollment / App ID */}
                      <td className="py-4 px-4 font-bold text-neutral-900 dark:text-white whitespace-nowrap text-xs">
                        <button
                          onClick={() => navigate(`/hod/students/${student.id}`)}
                          className="hover:underline text-left text-xs font-bold tracking-tight text-neutral-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 transition-colors cursor-pointer uppercase"
                        >
                          {student.usn ? (
                            <span className="text-neutral-900 dark:text-white">{student.usn}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-bold text-xs text-neutral-600 dark:text-neutral-300">
                              <span>{student.applicationNumber || student.enrollmentNumber || '—'}</span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 text-[10px] font-bold">
                                Pre-USN
                              </span>
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Semester */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {student.semester ? (
                          <span className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 text-[11px] font-black border border-indigo-100 dark:border-indigo-900">
                            Sem {student.semester}
                          </span>
                        ) : (
                          <span className="text-neutral-400 font-semibold">—</span>
                        )}
                      </td>

                      {/* Section */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {formatSectionDisplay(student.section) !== '—' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 font-bold text-neutral-800 dark:text-neutral-200">
                            {formatSectionDisplay(student.section)}
                          </span>
                        ) : (
                          <span className="text-neutral-400 font-semibold">—</span>
                        )}
                      </td>

                      {/* Batch (for standard HOD) */}
                      {!isSemesterHandling && (
                        <td className="py-4 px-4 text-center text-neutral-600 dark:text-neutral-300 font-semibold whitespace-nowrap">
                          {getStudentCohort(student)}
                        </td>
                      )}

                      {/* Status */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            STATUS_COLOR_MAP[student.admissionStatus] ||
                            STATUS_COLOR_MAP.ACTIVE
                          }`}
                        >
                          <CheckCircle2 size={12} />
                          {student.admissionStatus || 'ACTIVE'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/hod/students/${student.id}`)}
                          className="p-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                          title="View Student"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Footer (Admin Style) ─────────────────────────────────── */}
        <div className="px-5 py-3.5 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-neutral-500 font-medium">
            Showing Page <strong className="text-neutral-900 dark:text-white">{page}</strong> of{' '}
            <strong className="text-neutral-900 dark:text-white">{totalPages || 1}</strong> ({totalStudents} total
            students)
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-neutral-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const pNum = i + 1;
              if (
                totalPages > 6 &&
                pNum !== 1 &&
                pNum !== totalPages &&
                Math.abs(pNum - page) > 1
              ) {
                if (pNum === 2 || pNum === totalPages - 1) {
                  return (
                    <span key={pNum} className="px-2 text-neutral-400">
                      …
                    </span>
                  );
                }
                return null;
              }

              return (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    page === pNum
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-neutral-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HodStudentsPage;
