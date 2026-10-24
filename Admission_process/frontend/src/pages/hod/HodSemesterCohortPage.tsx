import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom'
import { useSelector } from 'react-redux';
import {
  ArrowLeft,
  Calendar,
  Users,
  Layers,
  RefreshCw,
  Search,
  GraduationCap,
  AlertTriangle,
  Loader2,
  Building2,
  X,
  BookOpen,
  UserCheck,
  ChevronRight,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { RootState } from '../../store';
import hodService, {
  HodSemesterCohortPayload,
  HodCohortSubjectItem,
  HodCohortFacultyAssignment,
} from '../../services/hod.service';
import usePersistentState from '../../hooks/usePersistentState';
import { ShowStudentsRangeSelector } from '../../components/common/ShowStudentsRangeSelector';
import { useAcademicYear } from '../../context/AcademicYearContext';

// ─── Cycle helpers ────────────────────────────────────────────────────────────

const CYCLE_LABELS: Record<string, string> = {
  P_CYCLE: 'P Cycle',
  C_CYCLE: 'C Cycle',
};

function CycleBadge({ cycle }: { cycle?: string | null }) {
  if (!cycle) return <span className="text-slate-400">—</span>;
  const label = CYCLE_LABELS[cycle] || cycle;
  const isP = cycle === 'P_CYCLE';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
        isP
          ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
      }`}
    >
      {label}
    </span>
  );
}

function AssignmentBadge({ isAssigned }: { isAssigned: boolean }) {
  return isAssigned ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Assigned
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      Not Assigned
    </span>
  );
}

export const HodSemesterCohortPage: React.FC = () => {
  const { semester } = useParams<{ semester: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { academicYear } = useAcademicYear();

  const semesterNum = parseInt(semester || '1', 10);
  const isValidSemester = !isNaN(semesterNum) && semesterNum >= 1 && semesterNum <= 8;

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<HodSemesterCohortPayload | null>(null);

  // Persisted Filters & Search across tab switches and refreshes
  const [limit, setLimit] = usePersistentState<number>(`hod_cohort_limit_${semesterNum}`, 10);
  const [searchQuery, setSearchQuery] = usePersistentState<string>(`hod_cohort_search_${semesterNum}`, '');
  const [selectedSectionFilter, setSelectedSectionFilter] = usePersistentState<string>(`hod_cohort_sec_filter_${semesterNum}`, 'ALL');
  const [cycleFilter, setCycleFilter] = usePersistentState<string>(`hod_cohort_cycle_${semesterNum}`, 'ALL');

  const activeAY = academicYear || data?.academicYear || '2026-27';
  const deptCode = data?.department?.code || user?.department?.code || 'CSE';
  const deptName = data?.department?.name || user?.department?.name || 'Department';
  const isAppliedScience = data?.department?.type === 'SEMESTER_HANDLING' || deptCode === 'AS';

  // Derive stats — support both new `stats` shape and legacy `summary` shape
  const stats = data?.stats;
  const legacySummary = data?.summary;
  const totalStudents = stats?.totalStudents ?? legacySummary?.totalStudents ?? 0;
  const totalFaculty = stats?.totalFaculty ?? 0;
  const totalSubjects = stats?.totalSubjects ?? data?.subjects?.length ?? 0;
  const totalSections = stats?.totalSections ?? 0;
  const sectionsList = stats?.sectionsList ?? legacySummary?.sectionsList ?? [];
  const sectionsBreakdown = stats?.sectionsBreakdown ?? legacySummary?.sectionsBreakdown ?? data?.sectionsBreakdown ?? [];

  // Fetch Cohort Data
  const fetchCohortData = async () => {
    if (!isValidSemester) return;
    setLoading(true);
    try {
      const cohortRes = await hodService.getSemesterCohort(semesterNum, { academicYear });
      setData(cohortRes);
    } catch (err: any) {
      console.error('Failed to load semester cohort data:', err);
      toast.error('Failed to load semester cohort data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCohortData();
  }, [semesterNum, academicYear]);

  // Clean section helper: handles "Section D" -> "D", hides internal UUID strings
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

  // Filtered students for table
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    let list = data.students;

    if (selectedSectionFilter !== 'ALL') {
      const targetClean = formatSectionDisplay(selectedSectionFilter);
      list = list.filter((s) => {
        const sClean = formatSectionDisplay(s.section);
        return sClean === targetClean || s.section === selectedSectionFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const nameMatch = s.name?.toLowerCase().includes(q);
        const usnMatch = s.usn?.toLowerCase().includes(q);
        const enrollMatch = s.enrollmentNumber?.toLowerCase().includes(q);
        const appMatch = s.applicationNumber?.toLowerCase().includes(q);
        const rollMatch = s.rollNumber?.toLowerCase().includes(q);
        const emailMatch = s.email?.toLowerCase().includes(q);
        return nameMatch || usnMatch || enrollMatch || appMatch || rollMatch || emailMatch;
      });
    }

    // Sort students ascending by USN (with assigned USNs first, then by name)
    return [...list].sort((a, b) => {
      const usnA = (a.usn || a.enrollmentNumber || '').trim();
      const usnB = (b.usn || b.enrollmentNumber || '').trim();
      if (usnA && usnB) {
        return usnA.localeCompare(usnB, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (usnA) return -1;
      if (usnB) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [data?.students, searchQuery, selectedSectionFilter]);

  // Filtered subjects by cycle
  const filteredSubjects = useMemo<HodCohortSubjectItem[]>(() => {
    if (!data?.subjects) return [];
    if (!isAppliedScience || cycleFilter === 'ALL') return data.subjects;
    return data.subjects.filter((s) => s.cycle === cycleFilter);
  }, [data?.subjects, cycleFilter, isAppliedScience]);

  // Faculty assignments from enriched backend response
  const facultyAssignments: HodCohortFacultyAssignment[] = data?.facultyAssignments ?? [];


  if (!isValidSemester) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Invalid Semester Scoping</h2>
        <p className="text-sm text-slate-500">Please select a valid semester between 1 and 8.</p>
        <Link
          to="/hod/students/semesters"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Semester Breakdown
        </Link>
      </div>
    );
  }

  if (isAppliedScience && semesterNum > 2) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mt-8">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Applied Science Scope Restricted</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          The Applied Science Department manages Semesters 1 &amp; 2 only. Semesters 3 to 8 are managed by their respective engineering branch departments.
        </p>
        <Link
          to="/hod/students/semesters"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Semester Breakdown
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER & BREADCRUMB ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/hod/students/semesters"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
              <span>Back to Semesters</span>
            </Link>
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <span>Semester {semesterNum} Cohort</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Departmental student cohort • Semester {semesterNum}
          </p>
        </div>

        {/* Right Header Badges */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold shadow-xs">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Dept: <strong>{deptCode}</strong></span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>AY: <strong>{activeAY}</strong></span>
          </div>

          <button
            onClick={fetchCohortData}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs inline-flex items-center gap-1.5"
            title="Refresh Cohort Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── 4 SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Students */}
        <Link
          to={`/hod/students?semester=${semesterNum}`}
          className="group glass-card rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer block focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
          title={`View student directory for Semester ${semesterNum}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Students
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 group-hover:scale-110 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 transition-all">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : totalStudents}
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            Enrolled students
          </p>
        </Link>

        {/* Faculty */}
        <Link
          to={`/hod/faculty/assignments?semester=${semesterNum}`}
          className="group glass-card rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700/60 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer block focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
          title={`View faculty allocations for Semester ${semesterNum}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Faculty
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60 transition-all">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : totalFaculty}
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            Faculty allocated
          </p>
        </Link>

        {/* Subjects */}
        <Link
          to={`/hod/subjects?semester=${semesterNum}`}
          className="group glass-card rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer block focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
          title={`View master subjects for Semester ${semesterNum}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Subjects
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 group-hover:scale-110 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60 transition-all">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> : totalSubjects}
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            Subjects assigned
          </p>
        </Link>

        {/* Sections */}
        <Link
          to={`/hod/students/sections?semester=${semesterNum}`}
          className="group glass-card rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-xs hover:shadow-md hover:border-rose-300 dark:hover:border-rose-700/60 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer block focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
          title={`View and manage sections for Semester ${semesterNum}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              Sections
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 group-hover:scale-110 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/60 transition-all">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-rose-600" />
              ) : totalSections > 0 ? (
                totalSections
              ) : (
                <span className="text-xl text-slate-400">None</span>
              )}
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
            Sections created
          </p>
          {!loading && sectionsList.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-1.5">
              {Array.from(new Set(sectionsList.map((sec) => formatSectionDisplay(sec)).filter((sec) => sec !== '—'))).map((sec) => (
                <span key={sec} className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                  {sec}
                </span>
              ))}
            </div>
          )}
        </Link>
      </div>

      {/* ── SUBJECT OVERVIEW ── */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200/70 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                Subjects — Semester {semesterNum}
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {loading ? '…' : totalSubjects}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Active subjects offered in Semester {semesterNum} for {deptName}.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isAppliedScience && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                  {(['ALL', 'P_CYCLE', 'C_CYCLE'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCycleFilter(c)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        cycleFilter === c
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {c === 'ALL' ? 'All Cycles' : c === 'P_CYCLE' ? 'P Cycle' : 'C Cycle'}
                    </button>
                  ))}
                </div>
              )}
              <Link
                to={`/hod/subjects?semester=${semesterNum}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
              <tr className="border-b border-neutral-800 text-[10px] font-black uppercase tracking-widest text-white">
                <th className="py-3 px-4 w-10 text-center">#</th>
                <th className="py-3 px-4">Course Code</th>
                <th className="py-3 px-4">Subject Name</th>
                {isAppliedScience && <th className="py-3 px-4">Cycle</th>}
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Credits</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={isAppliedScience ? 7 : 6} className="py-10 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mx-auto" />
                    <p className="text-xs text-slate-500 font-semibold mt-2">Loading subjects…</p>
                  </td>
                </tr>
              ) : filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={isAppliedScience ? 7 : 6} className="py-10 text-center">
                    <BookOpen className="w-9 h-9 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {!isAppliedScience && (semesterNum === 1 || semesterNum === 2)
                        ? 'Handled by Applied Science Department'
                        : 'No subjects found'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                      {!isAppliedScience && (semesterNum === 1 || semesterNum === 2)
                        ? '1st and 2nd Semester subjects and faculty teaching allocations are handled by the Applied Science (AS) Department.'
                        : cycleFilter !== 'ALL'
                        ? `No subjects for ${CYCLE_LABELS[cycleFilter]} in Semester ${semesterNum}.`
                        : `No active subjects configured for Semester ${semesterNum}.`}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((sub, idx) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white text-[11px]">{sub.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">{sub.name}</td>
                    {isAppliedScience && (
                      <td className="py-3 px-4"><CycleBadge cycle={sub.cycle} /></td>
                    )}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {sub.category || sub.type || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">{sub.credits}</td>
                    <td className="py-3 px-4 text-center"><AssignmentBadge isAssigned={!!sub.isAssigned} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FACULTY ASSIGNMENTS ── */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200/70 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                Faculty Assignments — Semester {semesterNum}
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {loading ? '…' : totalFaculty} Faculty
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Distinct faculty members assigned to subjects in Semester {semesterNum}.
              </p>
            </div>
            <Link
              to={`/hod/faculty/assignments?semester=${semesterNum}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
            <p className="text-xs text-slate-500 font-semibold mt-2">Loading faculty assignments…</p>
          </div>
        ) : facultyAssignments.length === 0 ? (
          <div className="py-12 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Faculty Assigned</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              No faculty members have been assigned to subjects for Semester {semesterNum} yet.
            </p>
            <Link
              to={`/hod/faculty/assignments?semester=${semesterNum}`}
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Assign Faculty
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
                <tr className="border-b border-neutral-800 text-[10px] font-black uppercase tracking-widest text-white">
                  <th className="py-3 px-4 w-10 text-center">#</th>
                  <th className="py-3 px-4">Faculty</th>
                  {isAppliedScience && <th className="py-3 px-4">Cycle</th>}
                  <th className="py-3 px-4">Subjects</th>
                  <th className="py-3 px-4 text-center">Sections</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {facultyAssignments.map((fac, idx) => (
                  <tr key={fac.userId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{fac.facultyName}</div>
                      {fac.facultyEmail && (
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{fac.facultyEmail}</div>
                      )}
                    </td>
                    {isAppliedScience && <td className="py-3.5 px-4"><CycleBadge cycle={fac.cycle} /></td>}
                    <td className="py-3.5 px-4">
                      {fac.subjects.length <= 2 ? (
                        <div className="flex flex-wrap gap-1">
                          {fac.subjects.map((s) => (
                            <span
                              key={s.id}
                              title={s.code}
                              className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300"
                            >
                              {s.name.length > 28 ? s.name.slice(0, 27) + '…' : s.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                          {fac.subjects.length} subjects
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {fac.sections.map((sec) => (
                          <span key={sec} className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {sec}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Assigned
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── STUDENT COHORT TABLE ── */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
                <span>Semester {semesterNum} Students</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {filteredStudents.length} Students
                </span>
              </h3>
              <Link
                to={`/hod/students?semester=${semesterNum}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Open in Student Directory <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified students enrolled in Semester {semesterNum} of {deptName}.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[240px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Optional Section Filter inside this Semester */}
            {sectionsList && sectionsList.length > 0 && (
              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Sections</option>
                {Array.from(new Set(sectionsList.map((sec) => formatSectionDisplay(sec)).filter((sec) => sec !== '—'))).map((sec) => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>
            )}

            <ShowStudentsRangeSelector
              value={limit}
              onChange={(newLimit) => setLimit(newLimit)}
            />
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
              <tr className="border-b border-neutral-800 text-[10px] font-black uppercase tracking-widest text-white">
                <th className="py-3.5 px-4 w-12 text-center text-white">#</th>
                <th className="py-3.5 px-4 text-white">USN / Enrollment No</th>
                <th className="py-3.5 px-4 text-white">Student Name</th>
                <th className="py-3.5 px-4 text-white">Department</th>
                <th className="py-3.5 px-4 text-center text-white">Section</th>
                <th className="py-3.5 px-4 text-white">Roll Number</th>
                <th className="py-3.5 px-4 text-white">Academic Year</th>
                <th className="py-3.5 px-4 text-center text-white">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs text-slate-500 font-semibold mt-2">Loading semester cohort students...</p>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No students found for Semester {semesterNum}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery
                        ? 'Try adjusting your search criteria.'
                        : 'No students are currently enrolled in this semester.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStudents.slice(0, limit).map((st, idx) => {
                  const identifier =
                    st.usn ||
                    st.enrollmentNumber ||
                    (st.applicationNumber ? `App: ${st.applicationNumber}` : '—');
                  const isActive =
                    st.status === 'ACTIVE' || st.status === 'ENROLLED' || st.status === 'APPROVED';

                  return (
                    <tr
                      key={st.id || idx}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">{identifier}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{st.name}</div>
                        {st.email && (
                          <div className="text-[11px] text-slate-400 font-normal truncate max-w-[200px]">{st.email}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">{st.department || deptCode}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-md font-extrabold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {formatSectionDisplay(st.section)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">{st.rollNumber || '—'}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{st.academicYear || activeAY}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {st.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HodSemesterCohortPage;
