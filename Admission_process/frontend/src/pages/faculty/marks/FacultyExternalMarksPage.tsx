import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAcademicYear } from '../../../context/AcademicYearContext';
import facultyService, {
  ExternalMarksWorkspaceData,
} from '../../../services/faculty.service';
import {
  ArrowLeft,
  GraduationCap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Download,
  RefreshCw,
  Info,
  ShieldCheck,
  Award,
  Users,
  Check,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface VtuCalcResult {
  seeScaled50: number | null;
  totalMarks: number | null;
  status: 'PASS' | 'FAIL' | 'NOT_ENTERED';
  reason: string;
  ciePassed: boolean;
  seePassed: boolean;
  aggregatePassed: boolean;
}

const computeLiveVtuStatus = (
  cie: number | null,
  rawExt: number | null,
  maxExt: number,
  isLab: boolean
): VtuCalcResult => {
  if (rawExt === null || isNaN(rawExt)) {
    return {
      seeScaled50: null,
      totalMarks: null,
      status: 'NOT_ENTERED',
      reason: 'SEE marks pending entry',
      ciePassed: cie !== null && cie >= 20,
      seePassed: false,
      aggregatePassed: false,
    };
  }

  const cieVal = Number(cie ?? 0);
  const ciePassed = cieVal >= 20;

  const validMax = maxExt > 0 ? maxExt : 100;
  const scaledSee = Math.round((rawExt / validMax) * 50);

  const minSeePercent = isLab ? 40 : 35;
  const minSeeScaled = isLab ? 20 : 18;
  const minRaw = (minSeePercent / 100) * validMax;
  const seePassed = rawExt >= minRaw || scaledSee >= minSeeScaled;

  const total = cieVal + scaledSee;
  const aggregatePassed = total >= 40;

  const failReasons: string[] = [];
  if (!ciePassed) failReasons.push('CIE < 20/50');
  if (!seePassed) failReasons.push(isLab ? 'SEE < 40% (Lab min 20/50)' : 'SEE < 35% (min 18/50)');
  if (!aggregatePassed) failReasons.push('Total < 40/100');

  const passed = ciePassed && seePassed && aggregatePassed;

  return {
    seeScaled50: scaledSee,
    totalMarks: total,
    status: passed ? 'PASS' : 'FAIL',
    reason: passed ? 'All 3 VTU minimum criteria satisfied' : failReasons.join(' • '),
    ciePassed,
    seePassed,
    aggregatePassed,
  };
};

export const FacultyExternalMarksPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();

  const subjectId = searchParams.get('subjectId') || '';
  const semester = parseInt(searchParams.get('semester') || '1', 10);

  const [workspace, setWorkspace] = useState<ExternalMarksWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualSaving, setManualSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const [maximumMarks, setMaximumMarks] = useState(100);
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'FAIL' | 'PENDING'>('ALL');
  const [exporting, setExporting] = useState(false);
  const [showRegulations, setShowRegulations] = useState(false);

  // Debounce ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestCellValuesRef = useRef<Record<string, string>>({});
  const isInitialLoadRef = useRef(true);

  // Keep ref up to date
  useEffect(() => {
    latestCellValuesRef.current = cellValues;
  }, [cellValues]);

  const fetchWorkspace = async () => {
    if (!subjectId) return;
    try {
      setLoading(true);
      const data = await facultyService.getExternalMarksWorkspace(subjectId, semester, academicYear);
      setWorkspace(data);
      setMaximumMarks(data.metadata.defaultMaxMarks || 100);

      const initialMap: Record<string, string> = {};
      for (const s of data.students) {
        initialMap[s.studentId] =
          s.externalMarks !== null && s.externalMarks !== undefined ? String(s.externalMarks) : '';
      }
      setCellValues(initialMap);
      isInitialLoadRef.current = true;
      setSyncStatus('synced');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load external marks statement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [subjectId, semester, academicYear]);

  // Core save function
  const performSave = useCallback(
    async (valuesToSave: Record<string, string>, isSilent = true) => {
      if (!workspace) return;
      try {
        if (!isSilent) setManualSaving(true);
        setSyncStatus('saving');

        const marksPayload = workspace.students.map((s) => {
          const raw = valuesToSave[s.studentId];
          return {
            studentId: s.studentId,
            externalMarks: raw !== undefined && raw.trim() !== '' ? parseFloat(raw) : null,
          };
        });

        await facultyService.saveExternalMarks({
          subjectId,
          semester,
          maximumMarks,
          marks: marksPayload,
          academicYear,
        });

        setSyncStatus('synced');
        if (!isSilent) {
          toast.success('External examination marks saved and synced to Drive.');
        }
      } catch (err: any) {
        setSyncStatus('error');
        if (!isSilent) {
          toast.error(err.response?.data?.error || 'Failed to save external marks.');
        }
      } finally {
        if (!isSilent) setManualSaving(false);
      }
    },
    [workspace, subjectId, semester, maximumMarks, academicYear]
  );

  // Trigger debounced auto-save on change
  const triggerAutoSave = useCallback(
    (newValues: Record<string, string>) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setSyncStatus('saving');
      debounceTimerRef.current = setTimeout(() => {
        performSave(newValues, true);
      }, 1200);
    },
    [performSave]
  );

  const handleCellChange = (studentId: string, val: string) => {
    if (val.trim() !== '') {
      const num = parseFloat(val);
      if (isNaN(num)) {
        toast.error('Please enter a valid numeric mark.');
        return;
      }
      if (num < 0 || num > maximumMarks) {
        toast.error(`Marks must be between 0 and ${maximumMarks}.`);
        return;
      }
    }

    const updated = { ...cellValues, [studentId]: val };
    setCellValues(updated);
    triggerAutoSave(updated);
  };

  const handleCellBlur = () => {
    // Immediate flush on blur if currently pending
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    performSave(latestCellValuesRef.current, true);
  };

  const handleManualSave = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    performSave(cellValues, false);
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const blob = await facultyService.downloadMarksExcel(subjectId, semester, academicYear);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const subjCode = workspace?.metadata.subjectCode || 'SUB';
      const subjName = (workspace?.metadata.subjectName || 'Marks').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${subjCode}_${subjName}_External_VTU.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Excel workbook downloaded successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to export marks workbook.');
    } finally {
      setExporting(false);
    }
  };

  // Subject is lab or practical
  const isLabOrPractical = useMemo(() => {
    if (workspace?.metadata.isLabOrPractical !== undefined) {
      return workspace.metadata.isLabOrPractical;
    }
    const name = workspace?.metadata.subjectName || '';
    const code = workspace?.metadata.subjectCode || '';
    const type = workspace?.metadata.subjectType || '';
    return (
      type.toUpperCase().includes('LAB') ||
      type.toUpperCase().includes('PRACTICAL') ||
      name.toUpperCase().includes('LAB') ||
      name.toUpperCase().includes('PRACTICAL') ||
      code.toUpperCase().includes('L')
    );
  }, [workspace]);

  // Computed student row calculations
  const studentRowsWithVtu = useMemo(() => {
    if (!workspace) return [];
    return workspace.students.map((student) => {
      const rawVal = cellValues[student.studentId];
      const parsedRaw = rawVal !== undefined && rawVal.trim() !== '' ? parseFloat(rawVal) : null;
      const finalCie =
        student.finalInternalMarks !== undefined && student.finalInternalMarks !== null
          ? Number(student.finalInternalMarks)
          : null;

      const vtu = computeLiveVtuStatus(finalCie, parsedRaw, maximumMarks, isLabOrPractical);

      return {
        ...student,
        rawInput: rawVal ?? '',
        parsedRaw,
        finalCie,
        vtu,
      };
    });
  }, [workspace, cellValues, maximumMarks, isLabOrPractical]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = studentRowsWithVtu.length;
    let entered = 0;
    let passed = 0;
    let failed = 0;
    let pending = 0;

    for (const s of studentRowsWithVtu) {
      if (s.parsedRaw !== null) {
        entered++;
        if (s.vtu.status === 'PASS') passed++;
        else if (s.vtu.status === 'FAIL') failed++;
      } else {
        pending++;
      }
    }

    return { total, entered, passed, failed, pending };
  }, [studentRowsWithVtu]);

  // Filtering
  const filteredStudents = useMemo(() => {
    let list = studentRowsWithVtu;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) => s.studentName.toLowerCase().includes(q) || s.usn.toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'PASS') {
      list = list.filter((s) => s.vtu.status === 'PASS');
    } else if (statusFilter === 'FAIL') {
      list = list.filter((s) => s.vtu.status === 'FAIL');
    } else if (statusFilter === 'PENDING') {
      list = list.filter((s) => s.vtu.status === 'NOT_ENTERED');
    }

    return list;
  }, [studentRowsWithVtu, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-full mx-auto">
        <div className="h-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-full mx-auto pb-12">
      {/* ── HEADER ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <button
              onClick={() => navigate(`/faculty/marks/semesters/${semester}`)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer mb-1"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
              <span>Back to Semester {semester} Subjects</span>
            </button>
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                <GraduationCap className="w-6 h-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                    {workspace?.metadata.subjectCode} — VTU External Semester Examination Marks (SEE)
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-xs ${
                      isLabOrPractical
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}
                  >
                    {isLabOrPractical ? 'PRACTICAL / LAB COURSE' : 'THEORY COURSE'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {workspace?.metadata.subjectName} • Semester {semester} • Dept: {workspace?.metadata.departmentCode} • Academic Year: {academicYear}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons & Sync Status */}
          <div className="flex flex-wrap items-center gap-3">


            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />
              <span>Export Excel</span>
            </button>

            {/* Manual Save Button */}
            <button
              onClick={handleManualSave}
              disabled={manualSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save External Marks</span>
            </button>
          </div>
        </div>

        {/* ── VTU STATUTORY PASSING CRITERIA CARD ── */}
        <div className="bg-gradient-to-r from-purple-50/70 via-indigo-50/50 to-blue-50/70 dark:from-purple-950/20 dark:via-indigo-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800/80 rounded-xl p-3.5 transition-all">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>VTU UNDERGRADUATE (B.E. / B.TECH) SCHEME STATUTORY PASSING REGULATIONS</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 hidden sm:inline">
                Must satisfy all 3 minimum conditions simultaneously to PASS
              </span>
              <button
                type="button"
                onClick={() => setShowRegulations(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/50 dark:hover:bg-purple-900/70 dark:text-purple-200 transition-colors shadow-2xs cursor-pointer"
                title={showRegulations ? "Hide Passing Regulations" : "View Passing Regulations"}
              >
                {showRegulations ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Regulations</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Regulations</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {showRegulations && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 mt-3 border-t border-purple-200/70 dark:border-purple-800/60 animate-in fade-in duration-200">
              {/* Rule 1: CIE */}
              <div className="p-3 bg-white/80 dark:bg-neutral-900/80 border border-purple-100 dark:border-purple-900/50 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                    1. CIE Internal (50%)
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                    Min 20 / 50M
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Minimum <strong>40% of CIE maximum</strong> (20 out of 50 marks). Mandatory eligibility threshold to clear CIE.
                </p>
              </div>

              {/* Rule 2: SEE */}
              <div className="p-3 bg-white/80 dark:bg-neutral-900/80 border border-purple-100 dark:border-purple-900/50 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                    2. SEE External (50%)
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                    {isLabOrPractical ? 'Min 20 / 50M (40%)' : 'Min 18 / 50M (35%)'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {isLabOrPractical ? (
                    <>
                      <strong>Practical/Lab Courses:</strong> Min 40% of SEE max (<strong>20 out of 50M</strong>, or 40/100 raw).
                    </>
                  ) : (
                    <>
                      <strong>Theory Courses:</strong> Min 35% of SEE max (<strong>18 out of 50M</strong>, or 35/100 raw).
                    </>
                  )}
                </p>
              </div>

              {/* Rule 3: Combined Aggregate */}
              <div className="p-3 bg-white/80 dark:bg-neutral-900/80 border border-purple-100 dark:border-purple-900/50 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                    3. Total Aggregate
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                    Min 40 / 100M
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Continuous Internal (50M) + Scaled External (50M) must sum to at least <strong>40 out of 100 marks</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── METRIC STAT CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-neutral-900 dark:text-white mt-1">
            {stats.total}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>Marks Entered</span>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {stats.entered} <span className="text-xs text-neutral-400 font-normal">/ {stats.total}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span>Passed (PASS)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.passed}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <span>Failed (FAIL)</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {stats.failed}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 shadow-2xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs">
            <span>Pending Entry</span>
            <RefreshCw className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats.pending}
          </div>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search student by USN or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs self-stretch sm:self-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter('PASS')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'PASS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            Pass ({stats.passed})
          </button>
          <button
            onClick={() => setStatusFilter('FAIL')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'FAIL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            Fail ({stats.failed})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
            }`}
          >
            Pending ({stats.pending})
          </button>
        </div>
      </div>

      {/* ── EXTERNAL MARKS AND VTU PASS/FAIL TABLE ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="max-h-[640px] overflow-auto relative marks-grid-scroll">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-30 bg-neutral-900 text-white border-b border-neutral-800 shadow-md">
              <tr>
                <th className="sticky left-0 z-40 bg-neutral-900 text-white px-3 py-3 font-bold border-r border-neutral-700 w-12 min-w-[48px] max-w-[48px] text-center">
                  #
                </th>
                <th className="sticky left-[48px] z-40 bg-neutral-900 text-white px-3 py-3 font-black text-xs uppercase tracking-wider border-r border-neutral-700 w-36 min-w-[144px] max-w-[144px]">
                  USN
                </th>
                <th className="sticky left-[192px] z-40 bg-neutral-900 text-white px-4 py-3 font-black text-xs uppercase tracking-wider border-r border-neutral-700 w-56 min-w-[220px] max-w-[220px]">
                  Student Name
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 w-20">
                  Sec
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 w-32 bg-neutral-800">
                  <div>Final CIE</div>
                  <div className="text-[10px] text-neutral-400 font-normal">Max 50M</div>
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 w-44 bg-purple-950/80 text-purple-200">
                  <div>SEE</div>
                  <div className="text-[10px] text-purple-300 font-normal">Max {maximumMarks}</div>
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 w-32 bg-neutral-800">
                  <div>Scaled SEE</div>
                  <div className="text-[10px] text-neutral-400 font-normal">Max 50M</div>
                </th>
                <th className="px-3 py-2.5 font-bold text-center border-r border-neutral-700 w-32 bg-neutral-800">
                  <div>Total Marks</div>
                  <div className="text-[10px] text-neutral-400 font-normal">Max 100M</div>
                </th>
                <th className="px-4 py-2.5 font-bold text-center w-48">
                  <div>VTU Passing Status</div>
                  <div className="text-[10px] text-neutral-400 font-normal">Evaluation / Remarks</div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-neutral-500">
                    No students match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((row, rIdx) => {
                  const cie = row.finalCie;
                  const vtu = row.vtu;

                  return (
                    <tr
                      key={row.studentId}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/60 transition-colors"
                    >
                      {/* 1. Sl. No. */}
                      <td className="sticky left-0 z-20 bg-white dark:bg-neutral-900 w-12 min-w-[48px] max-w-[48px] px-3 py-2.5 text-center font-bold text-xs text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800">
                        {rIdx + 1}
                      </td>

                      {/* 2. USN */}
                      <td className="sticky left-[48px] z-20 bg-white dark:bg-neutral-900 w-36 min-w-[144px] max-w-[144px] px-3 py-2.5 font-bold text-xs text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800 uppercase tracking-tight">
                        {(row.usn || '').toUpperCase()}
                      </td>

                      {/* 3. Student Name */}
                      <td className="sticky left-[192px] z-20 bg-white dark:bg-neutral-900 w-56 min-w-[220px] max-w-[220px] px-4 py-2.5 font-bold text-xs uppercase tracking-tight text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800 truncate">
                        {(row.studentName || '').toUpperCase()}
                      </td>

                      {/* 4. Section */}
                      <td className="px-3 py-2 text-center border-r border-neutral-200 dark:border-neutral-800 font-semibold text-neutral-600 dark:text-neutral-300">
                        {row.section || '-'}
                      </td>

                      {/* 5. Final Internal Marks (50M) */}
                      <td className="px-3 py-2 text-center border-r border-neutral-200 dark:border-neutral-800">
                        <span className="font-bold text-sm text-neutral-900 dark:text-white">
                          {cie !== null ? Math.round(cie) : 0}
                        </span>
                      </td>

                      {/* 6. Raw External Input (Live auto-save) */}
                      <td className="px-3 py-2 text-center border-r border-neutral-200 dark:border-neutral-800">
                        <input
                          type="text"
                          value={row.rawInput}
                          onChange={(e) => handleCellChange(row.studentId, e.target.value)}
                          onBlur={handleCellBlur}
                          className={`w-28 h-8 px-3 py-1 text-center rounded-lg font-bold text-xs transition-all shadow-2xs ${
                            row.rawInput.trim() !== ''
                              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border border-purple-300 dark:border-purple-600 ring-1 ring-purple-400/20'
                              : 'bg-neutral-50 dark:bg-neutral-850 text-neutral-400 border border-neutral-200 dark:border-neutral-750 hover:border-purple-300'
                          } focus:bg-white dark:focus:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                          placeholder="Enter marks"
                        />
                      </td>

                      {/* 7. Scaled SEE (50M) */}
                      <td className="px-3 py-2 text-center border-r border-neutral-200 dark:border-neutral-800">
                        <span className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">
                          {vtu.seeScaled50 !== null ? vtu.seeScaled50 : '-'}
                        </span>
                      </td>

                      {/* 8. Total Marks (100M) */}
                      <td className="px-3 py-2 text-center border-r border-neutral-200 dark:border-neutral-800">
                        <span className="font-bold text-sm text-neutral-900 dark:text-white">
                          {vtu.totalMarks !== null ? vtu.totalMarks : '-'}
                        </span>
                      </td>

                      {/* 9. VTU Passing Status */}
                      <td className="px-4 py-2.5 text-center">
                        {vtu.status === 'PASS' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-black text-xs shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>PASS</span>
                          </div>
                        ) : vtu.status === 'FAIL' ? (
                          <div className="inline-flex flex-col items-center justify-center gap-0.5">
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-black text-xs shadow-2xs">
                              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              <span>FAIL</span>
                            </div>
                            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 tracking-tight">
                              {vtu.reason}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-[11px] font-medium">
                            Not Entered
                          </span>
                        )}
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

export default FacultyExternalMarksPage;
