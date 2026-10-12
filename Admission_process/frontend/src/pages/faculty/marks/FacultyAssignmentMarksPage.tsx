import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAcademicYear } from '../../../context/AcademicYearContext';
import facultyService, {
  AssignmentWorkspaceData,
  AssignmentComponentDef,
} from '../../../services/faculty.service';
import {
  ArrowLeft,
  Settings,
  Save,
  Download,
  CheckCircle2,
  FileText,
  Search,
  Layers,
  RefreshCw,
  AlertTriangle,
  Clock,
  Cloud,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export const FacultyAssignmentMarksPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();

  const subjectId = searchParams.get('subjectId') || '';
  const semester = parseInt(searchParams.get('semester') || '1', 10);

  const [workspace, setWorkspace] = useState<AssignmentWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Cell values state: key `${studentId}___${componentId}` => value string
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const [dirtyCellKeys, setDirtyCellKeys] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Background Auto-Save Refs
  const cellValuesRef = useRef<Record<string, string>>({});
  const dirtyCellKeysRef = useRef<Set<string>>(new Set());
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const workspaceRef = useRef<AssignmentWorkspaceData | null>(null);

  useEffect(() => {
    cellValuesRef.current = cellValues;
  }, [cellValues]);

  useEffect(() => {
    dirtyCellKeysRef.current = dirtyCellKeys;
  }, [dirtyCellKeys]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyCellKeysRef.current.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const fetchWorkspace = async (silent: boolean = false) => {
    if (!subjectId) return;
    try {
      if (!silent) setLoading(true);
      const data = await facultyService.getAssignmentWorkspace(subjectId, semester, academicYear);
      setWorkspace(data);
      workspaceRef.current = data;

      if (!data.isConfigured || !data.configuration || data.configuration.components.length === 0) {
        // Redirect directly to the dedicated assignment configuration page
        navigate(`/faculty/marks/assignments/config?subjectId=${subjectId}&semester=${semester}`, {
          replace: true,
        });
        return;
      }

      if (!silent) {
        const initialMap: Record<string, string> = {};
        for (const s of data.students) {
          for (const [cId, val] of Object.entries(s.marks)) {
            const fullKey = `${s.studentId}___${cId}`;
            initialMap[fullKey] = val !== null && val !== undefined ? String(val) : '';
          }
        }
        setCellValues(initialMap);
        cellValuesRef.current = initialMap;
        setDirtyCellKeys(new Set());
        dirtyCellKeysRef.current = new Set();
        setLastSavedAt(new Date());
      }
    } catch (err: any) {
      if (!silent) {
        toast.error(err.response?.data?.error || 'Failed to load assignment marks.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [subjectId, semester, academicYear]);

  const activeComponents: AssignmentComponentDef[] = useMemo(() => {
    if (workspace?.isConfigured && workspace.configuration?.components) {
      return workspace.configuration.components;
    }
    return [];
  }, [workspace]);

  // Background Auto-Save execution for assignments
  const performAutoSave = async () => {
    const ws = workspaceRef.current;
    if (!ws || !ws.isConfigured || activeComponents.length === 0 || dirtyCellKeysRef.current.size === 0) {
      return;
    }

    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setAutoSaveStatus('saving');

    const keysBeingSaved = new Set(dirtyCellKeysRef.current);
    const snapshotValues = { ...cellValuesRef.current };

    try {
      const marksPayload: Array<{
        studentId: string;
        componentId: string;
        marksObtained: number | null;
      }> = [];

      for (const student of ws.students) {
        for (const comp of activeComponents) {
          const fullKey = `${student.studentId}___${comp.id}`;
          const rawVal = snapshotValues[fullKey];
          const parsed = rawVal !== undefined && rawVal.trim() !== '' ? parseFloat(rawVal) : null;
          marksPayload.push({
            studentId: student.studentId,
            componentId: comp.id,
            marksObtained: parsed,
          });
        }
      }

      await facultyService.saveAssignmentMarks({
        subjectId,
        semester,
        maximumMarks: 25,
        components: activeComponents,
        marks: marksPayload,
        isDraft: false,
        academicYear,
      });

      setDirtyCellKeys((prev) => {
        const next = new Set<string>();
        for (const k of prev) {
          if (!keysBeingSaved.has(k)) {
            next.add(k);
          }
        }
        dirtyCellKeysRef.current = next;
        return next;
      });

      setLastSavedAt(new Date());
      setAutoSaveStatus('saved');
    } catch (err: any) {
      console.error('Auto-save assignment marks failed:', err);
      setAutoSaveStatus('error');
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        performAutoSave();
      }
    }
  };

  const scheduleAutoSave = () => {
    setAutoSaveStatus('saving');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 1000);
  };

  const handleCellBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (dirtyCellKeysRef.current.size > 0) {
      performAutoSave();
    }
  };

  // Handle cell value change
  const handleCellChange = (studentId: string, compId: string, val: string, maxMarks: number) => {
    if (val.trim() !== '') {
      const num = parseFloat(val);
      if (isNaN(num)) {
        toast.error('Please enter a valid numeric mark.');
        return;
      }
      if (num < 0) {
        toast.error('Marks cannot be negative.');
        return;
      }
      if (num > maxMarks) {
        toast.error(`Marks cannot exceed maximum component marks (${maxMarks}M).`);
        return;
      }
    }
    const fullKey = `${studentId}___${compId}`;
    setCellValues((prev) => {
      const next = { ...prev, [fullKey]: val };
      cellValuesRef.current = next;
      return next;
    });
    setDirtyCellKeys((prev) => {
      const next = new Set(prev);
      next.add(fullKey);
      dirtyCellKeysRef.current = next;
      return next;
    });
    scheduleAutoSave();
  };

  // Keyboard navigation between table inputs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
      e.preventDefault();
      let targetRow = rowIdx;
      let targetCol = colIdx;

      if (e.key === 'ArrowUp') targetRow = Math.max(0, rowIdx - 1);
      if (e.key === 'ArrowDown' || e.key === 'Enter') targetRow = rowIdx + 1;
      if (e.key === 'ArrowLeft') targetCol = Math.max(0, colIdx - 1);
      if (e.key === 'ArrowRight') targetCol = colIdx + 1;

      const nextInput = document.getElementById(`assign_cell_${targetRow}_${targetCol}`);
      if (nextInput) {
        nextInput.focus();
        (nextInput as HTMLInputElement).select();
      }
    }
  };

  // Live row calculations
  const calculatedRows = useMemo(() => {
    if (!workspace) return [];

    return workspace.students.map((student) => {
      let rawSum = 0;
      let anyEntered = false;

      for (const c of activeComponents) {
        const fullKey = `${student.studentId}___${c.id}`;
        const rawVal = cellValues[fullKey];
        if (rawVal !== undefined && rawVal.trim() !== '') {
          const num = parseFloat(rawVal);
          if (!isNaN(num)) {
            rawSum += num;
            anyEntered = true;
          }
        }
      }

      const roundedRaw = Math.round(rawSum * 100) / 100;
      const displayTotal = anyEntered
        ? Number.isInteger(roundedRaw)
          ? Math.round(roundedRaw)
          : roundedRaw
        : '-';

      return {
        ...student,
        calculatedRawTotal: roundedRaw,
        calculatedScaledTotal: Math.min(roundedRaw, 25),
        displayTotal,
        anyEntered,
      };
    });
  }, [workspace, cellValues, activeComponents]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return calculatedRows;
    const q = searchQuery.toLowerCase();
    return calculatedRows.filter(
      (r) => r.studentName.toLowerCase().includes(q) || r.usn.toLowerCase().includes(q)
    );
  }, [calculatedRows, searchQuery]);

  // Save Assignment Marks
  const handleSaveMarks = async () => {
    if (!workspace) return;
    if (!workspace.isConfigured || activeComponents.length === 0) {
      toast.error('Please configure assignment pattern before saving marks.');
      navigate(`/faculty/marks/assignments/config?subjectId=${subjectId}&semester=${semester}`);
      return;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    try {
      setSaving(true);
      const marksPayload: Array<{
        studentId: string;
        componentId: string;
        marksObtained: number | null;
      }> = [];

      for (const student of workspace.students) {
        for (const comp of activeComponents) {
          const fullKey = `${student.studentId}___${comp.id}`;
          const rawVal = cellValues[fullKey];
          const parsed =
            rawVal !== undefined && rawVal.trim() !== '' ? parseFloat(rawVal) : null;
          marksPayload.push({
            studentId: student.studentId,
            componentId: comp.id,
            marksObtained: parsed,
          });
        }
      }

      const res = await facultyService.saveAssignmentMarks({
        subjectId,
        semester,
        maximumMarks: 25,
        components: activeComponents,
        marks: marksPayload,
        isDraft: false,
        academicYear,
      });

      toast.success(res.message || 'Assignment marks saved & synchronized to Dashboard and Drive.');
      setDirtyCellKeys(new Set());
      dirtyCellKeysRef.current = new Set();
      setLastSavedAt(new Date());
      setAutoSaveStatus('saved');
      await fetchWorkspace(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save assignment marks.');
    } finally {
      setSaving(false);
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const blob = await facultyService.downloadMarksExcel(subjectId, semester, academicYear);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const subjCode = workspace?.configuration?.subjectCode || 'SUB';
      const subjName = (workspace?.configuration?.subjectName || workspace?.subject?.name || 'Assignment').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${subjCode}_${subjName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Excel workbook exported successfully.');
    } catch (err: any) {
      toast.error('Failed to export marks workbook.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-neutral-100 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-neutral-600 dark:text-neutral-400 font-bold text-sm tracking-wide">
          Loading Assignment Marks Workspace...
        </p>
      </div>
    );
  }

  const subjectInfo = workspace?.configuration || {
    subjectName: workspace?.subject?.name || 'Subject',
    subjectCode: workspace?.subject?.code || 'SUB',
    departmentName: workspace?.department?.name || 'Department of Computer Science & Engineering',
  };

  return (
    <div className="h-screen w-screen max-w-full overflow-hidden flex flex-col justify-between bg-slate-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 select-none">
      {/* ── TOP NAV / TOOLBAR ── */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 py-2.5 sm:px-6 flex items-center justify-between shadow-xs flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
              }
              if (dirtyCellKeysRef.current.size > 0) {
                await performAutoSave();
              }
              navigate(`/faculty/marks/semesters/${semester}`);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Back to Semester Subjects"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 font-mono font-bold text-xs">
                {subjectInfo.subjectCode}
              </span>
              <h1 className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-white">
                {subjectInfo.subjectName} — Assignment Marks Register
              </h1>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
              Semester {semester} • Academic Year {academicYear} • Total Maximum: <strong>25 Marks</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
              }
              if (dirtyCellKeysRef.current.size > 0) {
                await performAutoSave();
              }
              navigate(`/faculty/marks/assignments/config?subjectId=${subjectId}&semester=${semester}`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 text-neutral-800 dark:text-neutral-200 font-bold text-xs shadow-xs transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-purple-600" />
            <span>Configure Components</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 text-neutral-800 dark:text-neutral-200 font-bold text-xs shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <button
            onClick={handleSaveMarks}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? 'Saving...' : 'Save Marks'}</span>
          </button>
        </div>
      </header>

      {/* ── SEARCH & FILTER BAR ── */}
      <div className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search student by USN or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
          />
        </div>

        {/* Status, Counters & Live Sync Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="font-medium">
            Pattern:{' '}
            <strong className="text-purple-700 dark:text-purple-300">
              {activeComponents.length === 1
                ? 'Single Assignment (25M)'
                : activeComponents.length > 1
                ? `Divided (${activeComponents.length} Components = 25M)`
                : 'Not Configured'}
            </strong>
          </span>

          <span className="text-neutral-300 dark:text-neutral-700">•</span>
          <span>
            Students: <strong>{workspace?.students.length || 0}</strong>
          </span>

          {/* Real-time Auto-save Badge */}
          {autoSaveStatus === 'saving' || dirtyCellKeys.size > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
              <span>Auto-saving to Dashboard & Drive...</span>
            </span>
          ) : autoSaveStatus === 'saved' || dirtyCellKeys.size === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Saved to Dashboard & Drive</span>
            </span>
          ) : autoSaveStatus === 'error' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Auto-save issue • Click Save Marks</span>
            </span>
          ) : null}

          {lastSavedAt && (
            <span className="text-neutral-400 text-[11px] hidden md:inline">
              Last saved: {lastSavedAt.toLocaleTimeString()}
            </span>
          )}

          <div className="flex items-center gap-1 pl-2 border-l border-neutral-300 dark:border-neutral-700">
            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">Drive Synced</span>
          </div>
        </div>
      </div>

      {/* ── ASSIGNMENT MARKS DATA ENTRY TABLE ── */}
      <div className="flex-1 w-full overflow-auto bg-white dark:bg-neutral-900 relative marks-grid-scroll">
        {!workspace?.isConfigured || activeComponents.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shadow-inner">
              <Layers className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1">
              <h2 className="font-black text-base text-neutral-900 dark:text-white">
                Assignment Marks Not Configured
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Please configure whether this subject uses a Single Assignment (25M) or Divided Components (summing to 25M).
              </p>
            </div>
            <button
              onClick={() =>
                navigate(`/faculty/marks/assignments/config?subjectId=${subjectId}&semester=${semester}`)
              }
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              <span>Configure Assignment Pattern</span>
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs min-w-full">
            <thead className="sticky top-0 z-30 bg-neutral-900 text-white border-b border-neutral-800 shadow-md">
              <tr>
                <th className="sticky left-0 z-40 bg-neutral-900 text-white px-3 py-3 font-bold border-r border-neutral-700 w-12 min-w-[48px] max-w-[48px] text-center">
                  #
                </th>
                <th className="sticky left-[48px] z-40 bg-neutral-900 text-white px-3 py-3 font-black text-sm uppercase tracking-wider border-r border-neutral-700 w-40 min-w-[160px] max-w-[160px]">
                  USN
                </th>
                <th className="sticky left-[208px] z-40 bg-neutral-900 text-white px-4 py-3 font-black text-sm uppercase tracking-wider border-r border-neutral-700 w-60 min-w-[240px] max-w-[240px]">
                  Student Name
                </th>

                {/* Dynamic Component Columns */}
                {activeComponents.map((comp) => (
                  <th
                    key={comp.id}
                    className="px-4 py-2.5 font-bold text-center border-r border-neutral-700 min-w-[120px] bg-neutral-850 text-neutral-100"
                  >
                    <div className="uppercase tracking-wide font-extrabold">{comp.label}</div>
                    <div className="text-[10px] font-normal text-purple-300">Max: {comp.maxMarks}M</div>
                  </th>
                ))}

                {/* Read-only Assignment Total Column */}
                <th className="px-4 py-2.5 font-black text-center bg-purple-700 text-white min-w-[140px]">
                  ASSIGNMENT TOTAL
                  <div className="text-[10px] font-normal opacity-90">Max: 25M</div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredRows.map((row, rIdx) => (
                <tr
                  key={row.studentId}
                  className="hover:bg-purple-50/40 dark:hover:bg-neutral-800/60 transition-colors"
                >
                  {/* Sl No */}
                  <td className="sticky left-0 z-20 bg-white dark:bg-neutral-900 w-12 min-w-[48px] max-w-[48px] px-3 py-2 text-center font-bold text-xs text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800">
                    {rIdx + 1}
                  </td>

                  {/* USN */}
                  <td className="sticky left-[48px] z-20 bg-white dark:bg-neutral-900 w-40 min-w-[160px] max-w-[160px] px-3 py-2 font-bold text-xs uppercase tracking-tight text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800">
                    {(row.usn || '').toUpperCase()}
                  </td>

                  {/* Student Name */}
                  <td className="sticky left-[208px] z-20 bg-white dark:bg-neutral-900 w-60 min-w-[240px] max-w-[240px] px-4 py-2 font-bold text-xs uppercase tracking-tight text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800 truncate">
                    {(row.studentName || '').toUpperCase()}
                  </td>

                  {/* Editable Dynamic Components */}
                  {activeComponents.map((comp, cIdx) => {
                    const fullKey = `${row.studentId}___${comp.id}`;
                    const rawVal = cellValues[fullKey] || '';
                    const isDirty = dirtyCellKeys.has(fullKey);

                    return (
                      <td
                        key={fullKey}
                        className="px-2 py-1.5 text-center border-r border-neutral-200 dark:border-neutral-800"
                      >
                        <input
                          id={`assign_cell_${rIdx}_${cIdx}`}
                          type="text"
                          value={rawVal}
                          onChange={(e) =>
                            handleCellChange(row.studentId, comp.id, e.target.value, comp.maxMarks)
                          }
                          onBlur={handleCellBlur}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                          className={`w-20 h-8 px-2 py-1 text-center rounded-lg font-bold text-xs transition-all shadow-xs ${
                            isDirty
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-400 ring-1 ring-amber-400'
                              : rawVal !== ''
                              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-600'
                              : 'bg-neutral-50 dark:bg-neutral-850 text-neutral-400 border border-neutral-200 dark:border-neutral-750 hover:border-neutral-300'
                          } focus:bg-white dark:focus:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                          placeholder="-"
                        />
                      </td>
                    );
                  })}
                  {/* Read-only Scaled Total */}
                  <td className="px-4 py-1.5 text-center font-black text-sm text-purple-900 dark:text-purple-200 bg-purple-50/70 dark:bg-purple-950/40">
                    {row.displayTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── FOOTER HELPER BAR ── */}
      <footer className="bg-neutral-100 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 px-4 py-1.5 sm:px-6 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 flex-shrink-0">
        <span>Use <strong>Arrow Keys</strong>, <strong>Tab</strong>, or <strong>Enter</strong> to navigate between student marks cells.</span>
        <span>Consolidated Continuous Roster • <strong>{workspace?.students.length || 0}</strong> Students</span>
      </footer>
    </div>
  );
};

export default FacultyAssignmentMarksPage;
