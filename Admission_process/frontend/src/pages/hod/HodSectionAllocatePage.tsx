import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ChevronLeft,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  UserPlus,
  RefreshCw,
  Hash,
  Scale,
  ShieldCheck,
  CheckSquare,
  Square,
  Layers,
  Building2,
  Calendar,
  UserMinus,
  Check,
  Sliders,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { RootState } from '../../store';
import hodService, {
  HodSectionCohortData,
  HodSectionStudentItem,
  HodSectionItem,
} from '../../services/hod.service';
import usePersistentState from '../../hooks/usePersistentState';

// Helper to safely extract clean section letter/code, guaranteeing UUIDs are never displayed
const getDisplaySectionCode = (student: HodSectionStudentItem): string => {
  if (student.isUnallocated) return '—';
  const sec = student.section as any;
  if (sec && typeof sec === 'object' && sec.code) {
    return sec.code;
  }
  if (student.currentSectionCode && student.currentSectionCode !== '—') {
    return student.currentSectionCode;
  }
  if (student.currentSection) {
    const raw = String(student.currentSection).trim();
    // Detect if raw is an internal UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
      return '—';
    }
    return raw.replace(/^(Section|Sec|Division|Div)\s*/i, '').trim() || raw;
  }
  return '—';
};

export const HodSectionAllocatePage: React.FC = () => {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const deptCode = user?.department?.code || 'ECE';

  const [cohortData, setCohortData] = useState<HodSectionCohortData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const setNotification = (notif: { type: 'success' | 'error'; message: string } | null) => {
    if (!notif) return;
    if (notif.type === 'success') {
      toast.success(notif.message);
    } else {
      toast.error(notif.message);
    }
  };

  // Active Tab: Strict 3-tab segregation
  // 1. UNALLOCATED (Default workspace - only unallocated students appear)
  // 2. THIS_SECTION (Students already placed in this section)
  // 3. OTHER (Read-only view of students placed in sibling sections)
  const [activeTab, setActiveTab] = usePersistentState<'UNALLOCATED' | 'THIS_SECTION' | 'OTHER'>(
    `hod_sec_alloc_tab_${sectionId}`,
    'UNALLOCATED'
  );
  const [searchQuery, setSearchQuery] = usePersistentState<string>(`hod_sec_alloc_search_${sectionId}`, '');

  // Selected Students: studentId -> rollNumber
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [rollNumberMap, setRollNumberMap] = useState<Record<string, string>>({});

  // In-Page Allocation Confirmation Area state (not a popup)
  const [confirmAllocationOpen, setConfirmAllocationOpen] = useState<boolean>(false);

  // Equal Distribution Tool Modals
  const [equalDistModalOpen, setEqualDistModalOpen] = useState<boolean>(false);
  const [distPreview, setDistPreview] = useState<
    Array<{ sectionId: string; sectionName: string; sectionCode: string; current: number; toAdd: number; final: number; capacity: number }>
  >([]);
  const [rollPrefix, setRollPrefix] = usePersistentState<string>(`hod_sec_alloc_prefix_${sectionId}`, '');
  const [rollStartNumber, setRollStartNumber] = usePersistentState<number>(`hod_sec_alloc_startnum_${sectionId}`, 1);

  // Range Selection Helper
  const [rangeFrom, setRangeFrom] = useState<number | string>(1);
  const [rangeTo, setRangeTo] = useState<number | string>(60);
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Load Cohort authoritative data from backend
  const loadCohort = async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const data = await hodService.getSectionCohort(sectionId);
      setCohortData(data);
      setSelectedStudentIds(new Set());
      setRollNumberMap({});
      setConfirmAllocationOpen(false);
    } catch (err: any) {
      console.error('Failed to load section cohort:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to load student cohort.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCohort();
  }, [sectionId]);

  const section: HodSectionItem | undefined = cohortData?.section;
  const sectionCode = section?.code || (section?.name ? section.name.replace(/^(Section|Sec)\s*/i, '') : 'A');
  const stats = cohortData?.stats;
  const siblingSections = cohortData?.siblingSections || [];

  // Filter students strictly based on active tab and search query
  const filteredStudents = useMemo(() => {
    if (!cohortData?.students) return [];

    let list = cohortData.students;

    // Strict Tab filtering:
    // UNALLOCATED: only students where isUnallocated is true
    // THIS_SECTION: only students where isAllocatedToThisSection is true
    // OTHER: only students where isAllocatedToOtherSection is true
    if (activeTab === 'UNALLOCATED') {
      list = list.filter((s) => s.isUnallocated);
    } else if (activeTab === 'THIS_SECTION') {
      list = list.filter((s) => s.isAllocatedToThisSection);
    } else if (activeTab === 'OTHER') {
      list = list.filter((s) => s.isAllocatedToOtherSection);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const nameMatch = s.name.toLowerCase().includes(q);
        const usnMatch = s.usn ? s.usn.toLowerCase().includes(q) : false;
        const enrollMatch = s.enrollmentNumber ? s.enrollmentNumber.toLowerCase().includes(q) : false;
        const rollMatch = s.rollNumber ? s.rollNumber.toLowerCase().includes(q) : false;
        return nameMatch || usnMatch || enrollMatch || rollMatch;
      });
    }

    return list;
  }, [cohortData?.students, activeTab, searchQuery]);

  // Tab Counts for badges
  const unallocatedCount = useMemo(() => {
    return cohortData?.students?.filter((s) => s.isUnallocated).length || 0;
  }, [cohortData?.students]);

  const thisSectionCount = useMemo(() => {
    return cohortData?.students?.filter((s) => s.isAllocatedToThisSection).length || 0;
  }, [cohortData?.students]);

  const otherSectionsCount = useMemo(() => {
    return cohortData?.students?.filter((s) => s.isAllocatedToOtherSection).length || 0;
  }, [cohortData?.students]);

  const remainingCapacity = stats?.remainingCapacity ?? Math.max(0, (section?.capacity || 15) - thisSectionCount);

  // Toggle selection for a student (Strictly allowed ONLY on UNALLOCATED tab)
  const toggleStudentSelection = (studentId: string) => {
    if (activeTab !== 'UNALLOCATED') return;
    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      if (next.size >= remainingCapacity) {
        setNotification({
          type: 'error',
          message: `Cannot select more than remaining section capacity (${remainingCapacity} seats).`,
        });
        return;
      }
      next.add(studentId);
    }
    setSelectedStudentIds(next);
  };

  // Select all visible students (Strictly bounded by remaining section capacity)
  const selectAllVisible = () => {
    if (activeTab !== 'UNALLOCATED') return;
    if (remainingCapacity <= 0) {
      setNotification({
        type: 'error',
        message: 'This section is already at maximum capacity.',
      });
      return;
    }
    const next = new Set<string>();
    const eligibleStudents = filteredStudents.filter((s) => s.isUnallocated);
    const toSelect = eligibleStudents.slice(0, remainingCapacity);
    toSelect.forEach((s) => next.add(s.id));
    setSelectedStudentIds(next);

    if (eligibleStudents.length > remainingCapacity) {
      setNotification({
        type: 'success',
        message: `Selected ${toSelect.length} students (automatically limited to the ${remainingCapacity} remaining seats).`,
      });
    }
  };

  // Clear all selection
  const clearSelection = () => {
    setSelectedStudentIds(new Set());
    setConfirmAllocationOpen(false);
  };

  // Update roll number for an individual student
  const handleRollNumberChange = (studentId: string, val: string) => {
    setRollNumberMap((prev) => ({
      ...prev,
      [studentId]: val,
    }));
  };

  // Auto-generate roll numbers for selected students
  const handleAutoNumberSelected = () => {
    let currentNumber = rollStartNumber;
    const newMap = { ...rollNumberMap };
    filteredStudents.forEach((s) => {
      if (selectedStudentIds.has(s.id)) {
        const padded = currentNumber.toString().padStart(2, '0');
        newMap[s.id] = rollPrefix ? `${rollPrefix}${padded}` : currentNumber.toString();
        currentNumber++;
      }
    });
    setRollNumberMap(newMap);
    setNotification({
      type: 'success',
      message: `Assigned sequential roll numbers to ${selectedStudentIds.size} selected students.`,
    });
  };

  // Range Selection Helper
  const handleApplyRangeSelection = () => {
    setRangeError(null);
    if (activeTab !== 'UNALLOCATED') return;

    const fromNum = Number(rangeFrom);
    const toNum = Number(rangeTo);

    if (isNaN(fromNum) || isNaN(toNum) || fromNum <= 0 || toNum <= 0) {
      setRangeError('Please enter valid positive numbers for From and To.');
      return;
    }

    if (fromNum > toNum) {
      setRangeError('"From" value cannot be greater than "To" value.');
      return;
    }

    const eligible = filteredStudents.filter((s) => s.isUnallocated);
    if (eligible.length === 0) {
      setRangeError('No unallocated students available to select.');
      return;
    }

    if (fromNum > eligible.length) {
      setRangeError(`"From" (${fromNum}) exceeds total available unallocated students (${eligible.length}).`);
      return;
    }

    const effectiveTo = Math.min(toNum, eligible.length);
    const countToSelect = effectiveTo - fromNum + 1;

    if (countToSelect > remainingCapacity) {
      setRangeError(`Section ${sectionCode} has only ${remainingCapacity} available seats.`);
      return;
    }

    const slice = eligible.slice(fromNum - 1, effectiveTo);
    const next = new Set<string>();
    slice.forEach((s) => next.add(s.id));
    setSelectedStudentIds(next);

    setNotification({
      type: 'success',
      message: `Selected students ${fromNum} through ${effectiveTo} (${slice.length} students). Review before confirming allocation.`,
    });
  };

  // Initiate Allocation: Opens the in-page confirmation area
  const handleInitiateAllocation = () => {
    if (!section || selectedStudentIds.size === 0) return;

    if (selectedStudentIds.size > remainingCapacity) {
      setNotification({
        type: 'error',
        message: `Section ${sectionCode} has only ${remainingCapacity} seats remaining. You selected ${selectedStudentIds.size} students.`,
      });
      return;
    }

    setConfirmAllocationOpen(true);
  };

  // Confirm Allocation: Executes the transactional bulk allocation API
  const handleConfirmAllocation = async () => {
    if (!section || selectedStudentIds.size === 0) return;

    setSaving(true);
    try {
      const isSem1 = Number(section.semester) === 1;
      const studentAllocations = Array.from(selectedStudentIds).map((id) => ({
        studentId: id,
        rollNumber: isSem1 && rollNumberMap[id] ? rollNumberMap[id].trim() : undefined,
      }));

      const res = await hodService.bulkAllocateStudents(section.id, studentAllocations);
      setNotification({
        type: 'success',
        message: res.message || `Allocation successful. ${selectedStudentIds.size} students assigned to Section ${sectionCode}.`,
      });
      setSelectedStudentIds(new Set());
      setRollNumberMap({});
      setConfirmAllocationOpen(false);
      // Authoritative refresh from database
      await loadCohort();
    } catch (err: any) {
      console.error('Allocation failed:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to allocate students.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Unallocate student from Section A back to unallocated pool
  const handleUnallocateStudent = async (studentId: string, studentName: string) => {
    if (!section) return;
    setSaving(true);
    try {
      await hodService.unallocateStudents(section.id, [studentId]);
      setNotification({
        type: 'success',
        message: `Student "${studentName}" unallocated from Section ${sectionCode}.`,
      });
      await loadCohort();
    } catch (err: any) {
      console.error('Unallocate failed:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to unallocate student.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Prepare Equal Distribution Preview based exclusively on unallocated students
  const handleOpenEqualDistribution = () => {
    if (!cohortData) return;

    const unallocated = cohortData.students.filter((s) => s.isUnallocated);
    if (unallocated.length === 0) {
      setNotification({
        type: 'error',
        message: 'No unallocated students available for distribution.',
      });
      return;
    }

    const allSections: Array<{ id: string; name: string; capacity: number; code?: string }> =
      siblingSections.length > 0
        ? (siblingSections as any[])
        : section
        ? [{ id: section.id, name: section.name, capacity: section.capacity, code: section.code }]
        : [];

    if (allSections.length === 0) {
      setNotification({
        type: 'error',
        message: 'No active sections available for distribution.',
      });
      return;
    }

    const countPerSection = Math.floor(unallocated.length / allSections.length);
    let remainder = unallocated.length % allSections.length;

    const preview = allSections.map((sec, idx) => {
      const cleanCode = sec.code || sec.name.replace(/^(Section|Sec)\s*/i, '');
      const current = cohortData.students.filter((s) => {
        const sSec = s.section as any;
        const sSecId = sSec && typeof sSec === 'object' ? sSec.id : s.currentSectionId;
        const sSecCode = sSec && typeof sSec === 'object' ? sSec.code : s.currentSectionCode;
        return sSecId === sec.id || sSecCode === cleanCode;
      }).length;
      const toAdd = countPerSection + (idx < remainder ? 1 : 0);
      return {
        sectionId: sec.id,
        sectionName: sec.name,
        sectionCode: cleanCode,
        current,
        toAdd,
        final: current + toAdd,
        capacity: sec.capacity || 15,
      };
    });

    setDistPreview(preview);
    setEqualDistModalOpen(true);
  };

  // Execute Equal Distribution
  const handleConfirmEqualDistribution = async () => {
    if (!cohortData) return;
    setSaving(true);
    try {
      const unallocated = cohortData.students.filter((s) => s.isUnallocated);
      const distributions: Array<{ sectionId: string; studentIds: string[] }> = [];

      let studentIdx = 0;
      for (const dist of distPreview) {
        const slice = unallocated.slice(studentIdx, studentIdx + dist.toAdd);
        studentIdx += dist.toAdd;
        distributions.push({
          sectionId: dist.sectionId,
          studentIds: slice.map((s) => s.id),
        });
      }

      await hodService.bulkDistributeStudents(distributions);
      setNotification({
        type: 'success',
        message: `Distributed ${unallocated.length} students across ${distPreview.length} sections.`,
      });
      setEqualDistModalOpen(false);
      await loadCohort();
    } catch (err: any) {
      console.error('Equal distribution failed:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to distribute students.',
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedStudentIds.size;
  const isOverCapacity = selectedCount > remainingCapacity;

  return (
    <div className="space-y-6 pb-36 sm:pb-44">
      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <Link
            to={section ? `/hod/students/sections?semester=${section.semester}` : '/hod/students/sections'}
            className="text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 inline-flex items-center gap-1 mb-1 transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Back to Section Allocations</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <UserPlus size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                Allocate Students — Section {sectionCode}
              </h1>
              <p className="text-xs text-neutral-500 font-medium">
                Department: {deptCode} &nbsp;|&nbsp; Academic Year: {section?.academicYear || '2026-27'} &nbsp;|&nbsp; Semester: {section?.semester || 3}
              </p>
            </div>
          </div>
        </div>

        {/* Badges & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300">
            <Building2 size={13} className="text-neutral-500" />
            <span>Dept: {deptCode}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300">
            <Calendar size={13} className="text-neutral-500" />
            <span>AY: {section?.academicYear || '2026-27'}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300">
            <Layers size={13} />
            <span>Sem {section?.semester}</span>
          </div>

          <button
            onClick={loadCohort}
            title="Refresh Cohort"
            className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── KPI STATISTICS SUMMARY CARDS (Strictly Consistent Calculations) ────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
            Total Students
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-neutral-900 dark:text-white leading-none">
              {stats?.totalStudents ?? 0}
            </span>
            <span className="text-[10px] font-bold text-neutral-400">semester</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
            Allocated
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 leading-none">
              {stats?.allocatedStudents ?? 0}
            </span>
            <span className="text-[10px] font-bold text-neutral-400">placed</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
            Unallocated
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-300 leading-none">
              {stats?.unallocatedStudents ?? 0}
            </span>
            <span className="text-[10px] font-bold text-neutral-400">waiting</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
            Section Capacity
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300 leading-none">
              {stats?.sectionCapacity ?? 15}
            </span>
            <span className="text-[10px] font-bold text-neutral-400">seats</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
            Remaining Capacity
          </span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-black leading-none ${
                remainingCapacity === 0 ? 'text-rose-600' : 'text-blue-700 dark:text-blue-300'
              }`}
            >
              {remainingCapacity}
            </span>
            <span className="text-[10px] font-bold text-neutral-400">available</span>
          </div>
        </div>
      </div>

      {/* ── IN-PAGE CONFIRMATION CARD (Requirement 17) ────────────────────────── */}
      {confirmAllocationOpen && section && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-950 text-white border border-blue-500/30 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">
                Action Confirmation
              </span>
              <h3 className="text-lg font-black text-white mt-0.5">
                Allocate {selectedCount} {selectedCount === 1 ? 'student' : 'students'} to Section {sectionCode}?
              </h3>
            </div>
            <button
              onClick={() => setConfirmAllocationOpen(false)}
              className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-black/20 p-3.5 rounded-xl border border-white/10">
            <div>
              <span className="text-white/60 block text-[10px] uppercase font-bold">Target Section</span>
              <span className="text-white font-black text-sm">Section {sectionCode}</span>
            </div>
            <div>
              <span className="text-white/60 block text-[10px] uppercase font-bold">Capacity</span>
              <span className="text-white font-bold">{stats?.sectionCapacity ?? 15} seats</span>
            </div>
            <div>
              <span className="text-white/60 block text-[10px] uppercase font-bold">Currently Allocated</span>
              <span className="text-white font-bold">{thisSectionCount} students</span>
            </div>
            <div>
              <span className="text-white/60 block text-[10px] uppercase font-bold">Selected</span>
              <span className="text-blue-300 font-extrabold">{selectedCount} students</span>
            </div>
            <div>
              <span className="text-white/60 block text-[10px] uppercase font-bold">Remaining After</span>
              <span className="text-emerald-300 font-extrabold">{Math.max(0, remainingCapacity - selectedCount)} seats</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setConfirmAllocationOpen(false)}
              className="px-4 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || isOverCapacity}
              onClick={handleConfirmAllocation}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] text-white text-xs font-black shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Allocating...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Confirm Allocation ({selectedCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── TOOLBAR: TABS, SEARCH, AND BULK TOOLS ──────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Strict 3-Tab Segregation (Requirement 11) */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 self-start">
            <button
              onClick={() => {
                setActiveTab('UNALLOCATED');
                clearSelection();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'UNALLOCATED'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Unallocated Students ({unallocatedCount})
            </button>

            <button
              onClick={() => {
                setActiveTab('THIS_SECTION');
                clearSelection();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'THIS_SECTION'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Allocated to Section {sectionCode} ({thisSectionCount})
            </button>

            <button
              onClick={() => {
                setActiveTab('OTHER');
                clearSelection();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'OTHER'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Allocated to Other Sections ({otherSectionsCount})
            </button>
          </div>

          {/* Allocation Strategy Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            {siblingSections.length > 1 && (
              <button
                type="button"
                onClick={handleOpenEqualDistribution}
                className="px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-100 transition-colors inline-flex items-center gap-1.5"
              >
                <Scale size={13} />
                <span>Equal Distribution Preview</span>
              </button>
            )}

            {selectedCount > 0 && section?.semester === 1 && activeTab === 'UNALLOCATED' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Roll Prefix (opt)"
                  value={rollPrefix}
                  onChange={(e) => setRollPrefix(e.target.value)}
                  className="w-24 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-medium"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Start #"
                  value={rollStartNumber}
                  onChange={(e) => setRollStartNumber(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={handleAutoNumberSelected}
                  className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors inline-flex items-center gap-1"
                >
                  <Hash size={12} />
                  <span>Number Selected</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search & Bulk Select Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex-1 max-w-md flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm">
            <Search size={15} className="text-neutral-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by student name, USN, enrollment number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-neutral-800 dark:text-white placeholder:text-neutral-400 outline-none font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-neutral-400 hover:text-neutral-600">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {activeTab === 'UNALLOCATED' && (
              <>
                <button
                  onClick={selectAllVisible}
                  disabled={remainingCapacity <= 0 || filteredStudents.length === 0}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {remainingCapacity <= 0
                    ? 'Section is Full'
                    : `Select Available (${Math.min(filteredStudents.length, remainingCapacity)} of ${filteredStudents.length})`}
                </button>
                {selectedCount > 0 && (
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}
              </>
            )}

            {activeTab !== 'UNALLOCATED' && (
              <span className="text-neutral-400 font-semibold text-[11px]">
                {activeTab === 'THIS_SECTION'
                  ? `${filteredStudents.length} students currently in Section ${sectionCode}`
                  : `${filteredStudents.length} students assigned to other sections (Read-only)`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── RANGE SELECTION HELPER CARD (ABOVE TABLE) ─────────────────────── */}
      {activeTab === 'UNALLOCATED' && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-blue-50/70 dark:from-blue-950/40 dark:via-neutral-900 dark:to-blue-950/40 border border-blue-200 dark:border-blue-900/60 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Sliders size={15} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">
                Range Selection Helper
              </h3>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                Enter a row range to quickly check students in the table below. (Selection helper only — does not save until you click Allocate).
              </p>
            </div>
          </div>

          {rangeError && (
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{rangeError}</span>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">From:</label>
              <input
                type="number"
                min={1}
                max={unallocatedCount || 1}
                value={rangeFrom}
                onChange={(e) => {
                  setRangeFrom(e.target.value);
                  setRangeError(null);
                }}
                className="w-20 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-black text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">To:</label>
              <input
                type="number"
                min={1}
                max={unallocatedCount || 1}
                value={rangeTo}
                onChange={(e) => {
                  setRangeTo(e.target.value);
                  setRangeError(null);
                }}
                className="w-20 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-black text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleApplyRangeSelection}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.01] cursor-pointer"
            >
              Select Range
            </button>

            <button
              onClick={() => {
                setSelectedStudentIds(new Set());
                setRangeError(null);
              }}
              className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* ── STUDENT ALLOCATION TABLE ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-neutral-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-xs font-bold">Loading department cohort...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-16 text-center text-neutral-400 space-y-2">
            <Users size={32} className="mx-auto text-neutral-300 dark:text-neutral-700" />
            <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
              No students found
            </p>
            <p className="text-xs text-neutral-400">
              {searchQuery
                ? 'Try modifying your search criteria.'
                : activeTab === 'UNALLOCATED'
                ? 'All department students in this semester are already allocated to sections.'
                : activeTab === 'THIS_SECTION'
                ? `No students have been allocated to Section ${sectionCode} yet.`
                : 'No students are allocated to other sections.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
                <tr className="border-b border-neutral-800 text-[10px] font-black uppercase tracking-wider text-white">
                  {/* Checkbox column only active on UNALLOCATED tab */}
                  <th className="py-3 px-4 w-10 text-center">
                    {activeTab === 'UNALLOCATED' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected =
                            filteredStudents.length > 0 &&
                            filteredStudents.every((s) => selectedStudentIds.has(s.id));
                          if (allSelected) clearSelection();
                          else selectAllVisible();
                        }}
                        className="p-1 text-white/80 hover:text-white"
                      >
                        {filteredStudents.length > 0 &&
                        filteredStudents.every((s) => selectedStudentIds.has(s.id)) ? (
                          <CheckSquare size={16} className="text-white" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </th>
                  <th className="py-3 px-3 w-12 text-center text-white">SL NO</th>
                  {section?.semester === 1 && (
                    <th className="py-3 px-3 w-28 text-white">Roll Number</th>
                  )}
                  <th className="py-3 px-3 text-white">USN</th>
                  <th className="py-3 px-3 text-white">Enrollment Number</th>
                  <th className="py-3 px-4 text-white">Student Name</th>
                  <th className="py-3 px-3 text-white">Admission</th>
                  <th className="py-3 px-3 text-center text-white">Current Section</th>
                  <th className="py-3 px-3 text-center text-white">Status</th>
                  {activeTab === 'THIS_SECTION' && (
                    <th className="py-3 px-3 text-center text-white">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 text-xs">
                {filteredStudents.map((s, index) => {
                  const isSelected = selectedStudentIds.has(s.id);
                  const isUnallocTab = activeTab === 'UNALLOCATED';
                  const displayCode = getDisplaySectionCode(s);

                  return (
                    <tr
                      key={s.id}
                      onClick={() => isUnallocTab && toggleStudentSelection(s.id)}
                      className={`transition-colors ${
                        isUnallocTab ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40' : ''
                      } ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : s.isAllocatedToThisSection
                          ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                          : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {isUnallocTab ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudentSelection(s.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                          />
                        ) : (
                          <span className="text-neutral-300 dark:text-neutral-700 text-xs">—</span>
                        )}
                      </td>

                      {/* SL NO */}
                      <td className="py-3 px-3 text-center font-bold text-neutral-400">
                        {index + 1}
                      </td>

                      {/* Roll Number (editable inline ONLY for Semester 1 in UNALLOCATED tab) */}
                      {section?.semester === 1 && (
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          {isUnallocTab ? (
                            <input
                              type="text"
                              placeholder="—"
                              value={rollNumberMap[s.id] !== undefined ? rollNumberMap[s.id] : s.rollNumber || ''}
                              onChange={(e) => handleRollNumberChange(s.id, e.target.value)}
                              className="w-20 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="font-mono font-bold text-neutral-600 dark:text-neutral-300">
                              {s.rollNumber || '—'}
                            </span>
                          )}
                        </td>
                      )}

                      {/* USN */}
                      <td className="py-3 px-3 font-bold text-neutral-900 dark:text-white uppercase tracking-tight">
                        {s.usn || <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                      </td>

                      {/* Enrollment Number */}
                      <td className="py-3 px-3 font-mono text-[11px] font-bold text-blue-700 dark:text-blue-400">
                        {s.enrollmentNumber || '—'}
                      </td>

                      {/* Student Name */}
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                        <div>
                          <span>{s.name}</span>
                          <span className="block text-[10px] text-neutral-400 font-normal">{s.email}</span>
                        </div>
                      </td>

                      {/* Admission Type */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px] font-bold">
                          {s.admissionType}
                        </span>
                      </td>

                      {/* Current Section (Requirements 13 & 14: Never UUID!) */}
                      <td className="py-3 px-3 text-center">
                        {s.isUnallocated ? (
                          <span className="font-mono text-neutral-400 font-bold">—</span>
                        ) : (
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md font-mono font-black text-xs bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {displayCode}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                            s.admissionStatus === 'APPROVED' || s.admissionStatus === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800'
                          }`}
                        >
                          {s.admissionStatus}
                        </span>
                      </td>

                      {/* Action (Unallocate button when viewing Allocated to This Section) */}
                      {activeTab === 'THIS_SECTION' && (
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleUnallocateStudent(s.id, s.name)}
                            disabled={saving}
                            title={`Remove ${s.name} from Section ${sectionCode}`}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                          >
                            <UserMinus size={13} />
                            <span>Unallocate</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── BUFFER WHEN ALLOCATION DOCK IS VISIBLE ──────────────────────────── */}
      {selectedCount > 0 && <div className="h-16 w-full pointer-events-none" aria-hidden="true" />}

      {/* ── FLOATING SELECTION & ALLOCATION DOCK ─────────────────────────────── */}
      {selectedCount > 0 && section && activeTab === 'UNALLOCATED' && (
        <div className="fixed bottom-6 left-6 right-6 lg:left-[324px] lg:right-10 z-40 pointer-events-none flex justify-center">
          <div className="pointer-events-auto w-full max-w-4xl bg-neutral-900/95 dark:bg-neutral-950/95 text-white backdrop-blur-xl px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl shadow-2xl border border-neutral-700/60 ring-1 ring-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md shrink-0 ring-2 ring-blue-400/20">
                {selectedCount}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-black tracking-tight text-white">
                    {selectedCount} {selectedCount === 1 ? 'student' : 'students'} selected
                  </p>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-neutral-200 text-[11px] font-bold">
                    Target: Section {sectionCode}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Remaining section capacity:{' '}
                  <strong className={remainingCapacity < selectedCount ? 'text-rose-400 font-extrabold' : 'text-emerald-400 font-extrabold'}>
                    {remainingCapacity} {remainingCapacity === 1 ? 'seat' : 'seats'}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              {isOverCapacity && (
                <div className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/60 text-rose-300 text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <AlertCircle size={14} />
                  <span>Exceeds capacity by {selectedCount - remainingCapacity}!</span>
                </div>
              )}

              <button
                type="button"
                onClick={clearSelection}
                className="px-4 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isOverCapacity || saving}
                onClick={handleInitiateAllocation}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-black shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <UserPlus size={15} />
                <span>Allocate to Section {sectionCode}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EQUAL DISTRIBUTION MODAL ─────────────────────────────────────────── */}
      {equalDistModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl max-w-lg w-full p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                    <Scale size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      Equal Student Distribution Preview
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Preview how {unallocatedCount} unallocated students will be divided across active sections.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEqualDistModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase font-extrabold border-b border-neutral-800">
                    <tr className="bg-[#111111] dark:bg-neutral-950 border-b border-neutral-800 font-black text-white uppercase text-[10px]">
                      <th className="py-2.5 px-3 text-white">Section</th>
                      <th className="py-2.5 px-3 text-center text-white">Current</th>
                      <th className="py-2.5 px-3 text-center text-white">+ To Allocate</th>
                      <th className="py-2.5 px-3 text-center text-white">Final Count</th>
                      <th className="py-2.5 px-3 text-right text-white">Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {distPreview.map((d) => (
                      <tr key={d.sectionId}>
                        <td className="py-2.5 px-3 font-bold text-neutral-900 dark:text-white">
                          Section {d.sectionCode}
                        </td>
                        <td className="py-2.5 px-3 text-center text-neutral-500">{d.current}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-purple-600 dark:text-purple-400">
                          +{d.toAdd}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-neutral-900 dark:text-white">
                          {d.final}
                        </td>
                        <td className="py-2.5 px-3 text-right text-neutral-500">{d.capacity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/40 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <ShieldCheck size={14} className="inline mr-1 text-emerald-600" />
                This is a preview. Allocations will only be committed upon clicking <strong>Confirm & Allocate</strong> below.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEqualDistModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmEqualDistribution}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? 'Processing...' : 'Confirm & Allocate'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
};

export default HodSectionAllocatePage;
