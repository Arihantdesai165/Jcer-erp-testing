import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Layers,
  Users,
  PlusCircle,
  ArrowLeft,
  ArrowRight,
  UserPlus,
  RefreshCw,
  Building2,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Search,
  CheckSquare,
  Square,
  Sliders,
  UserMinus,
  ChevronDown,
  Check,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { RootState } from '../../store';
import hodService, {
  HodBranchOverviewItem,
  HodSectionItem,
  HodSectionCohortData,
  HodSectionStudentItem,
} from '../../services/hod.service';
import { useAcademicYear } from '../../context/AcademicYearContext';

const ALPHABET_OPTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export const HodStudentsSectionPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { academicYear } = useAcademicYear();
  const deptCode = user?.department?.code || 'AS';
  const deptName = user?.department?.name || 'Applied Science';
  const activeAY = academicYear || '2026-27';

  const isSemesterHandling =
    user?.department?.type === 'SEMESTER_HANDLING' || user?.department?.code === 'AS';

  const [searchParams, setSearchParams] = useSearchParams();
  const initialSem = searchParams.get('semester') ? Number(searchParams.get('semester')) : 1;
  const initialBranch = searchParams.get('branch') || null;
  const initialAction = searchParams.get('action') || null;
  const initialSectionId = searchParams.get('sectionId') || null;

  const [selectedSemester, setSelectedSemester] = useState<number>(
    isSemesterHandling
      ? initialSem === 2 ? 2 : 1
      : initialSem >= 1 && initialSem <= 8 ? initialSem : 1
  );

  const [selectedBranch, setSelectedBranch] = useState<string | null>(initialBranch);
  const [activeView, setActiveView] = useState<'OVERVIEW' | 'MANAGE_BRANCH' | 'ALLOCATE' | 'VIEW_STUDENTS'>('OVERVIEW');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId);

  // Data states
  const [branchesOverview, setBranchesOverview] = useState<HodBranchOverviewItem[]>([]);
  const [branchSections, setBranchSections] = useState<HodSectionItem[]>([]);
  const [activeSection, setActiveSection] = useState<HodSectionItem | null>(null);
  const [cohortData, setCohortData] = useState<HodSectionCohortData | null>(null);
  const [allocatedStudentsList, setAllocatedStudentsList] = useState<HodSectionStudentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [cohortError, setCohortError] = useState<string | null>(null);
  const [allocatedStudentsError, setAllocatedStudentsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const setNotification = (notif: { type: 'success' | 'error'; message: string } | null) => {
    if (!notif) return;
    if (notif.type === 'success') {
      toast.success(notif.message);
    } else {
      toast.error(notif.message);
    }
  };

  // Allocate View states
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rangeFrom, setRangeFrom] = useState<number | string>(1);
  const [rangeTo, setRangeTo] = useState<number | string>(60);
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Create / Edit / Delete Modal states
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [sectionToDelete, setSectionToDelete] = useState<HodSectionItem | null>(null);
  const [studentToRemove, setStudentToRemove] = useState<HodSectionStudentItem | null>(null);
  const [removeStudentModalOpen, setRemoveStudentModalOpen] = useState<boolean>(false);
  const [unallocateAllModalOpen, setUnallocateAllModalOpen] = useState<boolean>(false);
  const [unallocatingAll, setUnallocatingAll] = useState<boolean>(false);
  const [unallocateAllError, setUnallocateAllError] = useState<string | null>(null);

  // View Students pagination and filter states
  const [viewPageSize, setViewPageSize] = useState<number>(50);
  const [viewCurrentPage, setViewCurrentPage] = useState<number>(1);
  const [viewSearchQuery, setViewSearchQuery] = useState<string>('');

  // Form states
  const [selectedAlphabet, setSelectedAlphabet] = useState<string>('A');
  const [alphabetDropdownOpen, setAlphabetDropdownOpen] = useState<boolean>(false);
  const alphabetDropdownRef = useRef<HTMLDivElement>(null);
  const [formName, setFormName] = useState<string>('');
  const [formCapacity, setFormCapacity] = useState<number | string>(60);
  const [formClassroom, setFormClassroom] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Compute alphabets already in use for current branch + semester + AY
  const existingAlphabets = useMemo(() => {
    const set = new Set<string>();
    branchSections.forEach((s) => {
      if (!s || !s.name) return;
      const clean = s.name.replace(/^(Section|Sec|Division|Div)\s*/i, '').trim().toUpperCase();
      if (clean && clean.length === 1 && clean >= 'A' && clean <= 'Z') {
        set.add(clean);
      }
    });
    return set;
  }, [branchSections]);

  const isAlphabetAlreadyUsed = Boolean(selectedAlphabet && existingAlphabets.has(selectedAlphabet));
  const allAlphabetsUsed = existingAlphabets.size >= 26;

  // Close alphabet dropdown on outside click or Escape key
  useEffect(() => {
    if (!alphabetDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (alphabetDropdownRef.current && !alphabetDropdownRef.current.contains(e.target as Node)) {
        setAlphabetDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAlphabetDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [alphabetDropdownOpen]);

  // Sync state from URL query parameters
  useEffect(() => {
    const semParam = searchParams.get('semester');
    const branchParam = searchParams.get('branch');
    const actionParam = searchParams.get('action');
    const secIdParam = searchParams.get('sectionId');

    if (semParam) {
      const s = Number(semParam);
      if (s >= 1 && s <= 8 && s !== selectedSemester) {
        setSelectedSemester(s);
      }
    }

    if (branchParam !== selectedBranch) {
      setSelectedBranch(branchParam || null);
    }

    if (actionParam === 'allocate' && secIdParam) {
      setActiveView('ALLOCATE');
      setActiveSectionId(secIdParam);
    } else if (actionParam === 'view' && secIdParam) {
      setActiveView('VIEW_STUDENTS');
      setActiveSectionId(secIdParam);
    } else if (branchParam) {
      setActiveView('MANAGE_BRANCH');
      setActiveSectionId(null);
    } else {
      setActiveView('OVERVIEW');
      setActiveSectionId(null);
    }
  }, [searchParams]);

  // Update URL query parameters helper
  const updateUrlParams = (newParams: Record<string, string | null>) => {
    const current = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined) {
        current.delete(k);
      } else {
        current.set(k, v);
      }
    });
    setSearchParams(current, { replace: true });
  };

  // 1. Fetch Main Branches Overview for selected semester
  const loadBranchesOverview = async () => {
    setLoading(true);
    setOverviewError(null);
    try {
      const overviewRes = await hodService.getBranchesOverview(selectedSemester, activeAY);
      setBranchesOverview(overviewRes.branches || []);
    } catch (err: any) {
      console.error('Failed to load branches overview:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Unable to load branch overview. Please try again.';
      setOverviewError(errMsg);
      setNotification({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Sections for Selected Branch
  const loadBranchSections = async (branchCode: string) => {
    setLoading(true);
    setSectionsError(null);
    try {
      const sectionsRes = await hodService.getSections(selectedSemester, activeAY, branchCode);
      setBranchSections(sectionsRes || []);
    } catch (err: any) {
      console.error('Failed to load branch sections:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to load sections for branch.';
      setSectionsError(errMsg);
      setNotification({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Allocation Cohort for a Section
  const loadSectionCohort = async (sectionId: string) => {
    setLoading(true);
    setCohortError(null);
    try {
      const cohortRes = await hodService.getSectionCohort(sectionId);
      setCohortData(cohortRes);
      setActiveSection(cohortRes.section);
      setSelectedStudentIds(new Set());
      setSearchQuery('');
      setRangeError(null);

      // Default range values: from 1 to remainingCapacity (or available unallocated count)
      const unallocatedCount = cohortRes.stats?.unallocatedStudents || 0;
      const remCap = cohortRes.stats?.remainingCapacity ?? Math.max(0, (cohortRes.section.capacity || 60) - (cohortRes.stats?.sectionAllocatedCount || 0));
      setRangeFrom(1);
      setRangeTo(Math.min(unallocatedCount > 0 ? unallocatedCount : 60, remCap > 0 ? remCap : 60));
    } catch (err: any) {
      console.error('Failed to load section cohort:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to load students for allocation.';
      setCohortError(errMsg);
      setNotification({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  // 4. Fetch Allocated Students for Viewing
  const loadAllocatedStudents = async (sectionId: string) => {
    setLoading(true);
    setAllocatedStudentsError(null);
    try {
      const res = await hodService.getSectionStudents(sectionId);
      setActiveSection(res.section);
      setAllocatedStudentsList(res.students || []);
    } catch (err: any) {
      console.error('Failed to load allocated students:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to load allocated students.';
      setAllocatedStudentsError(errMsg);
      setNotification({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  // Primary Data Fetch Effect
  useEffect(() => {
    if (activeView === 'OVERVIEW') {
      loadBranchesOverview();
    } else if (activeView === 'MANAGE_BRANCH' && selectedBranch) {
      loadBranchSections(selectedBranch);
    } else if (activeView === 'ALLOCATE' && activeSectionId) {
      loadSectionCohort(activeSectionId);
    } else if (activeView === 'VIEW_STUDENTS' && activeSectionId) {
      loadAllocatedStudents(activeSectionId);
    }
  }, [selectedSemester, selectedBranch, activeView, activeSectionId, activeAY]);

  // Semester Switch
  const handleSelectSemester = (sem: number) => {
    setSelectedSemester(sem);
    updateUrlParams({
      semester: sem.toString(),
      action: null,
      sectionId: null,
    });
  };

  // Navigate to Manage Branch
  const handleManageBranch = (branchCode: string) => {
    setSelectedBranch(branchCode);
    setActiveView('MANAGE_BRANCH');
    updateUrlParams({
      semester: selectedSemester.toString(),
      branch: branchCode,
      action: null,
      sectionId: null,
    });
  };

  // Navigate Back to Branches Overview
  const handleBackToBranches = () => {
    setSelectedBranch(null);
    setActiveView('OVERVIEW');
    updateUrlParams({
      semester: selectedSemester.toString(),
      branch: null,
      action: null,
      sectionId: null,
    });
  };

  // Navigate to Allocate View
  const handleOpenAllocate = (sec: HodSectionItem) => {
    setActiveSection(sec);
    setActiveSectionId(sec.id);
    setActiveView('ALLOCATE');
    updateUrlParams({
      semester: selectedSemester.toString(),
      branch: selectedBranch,
      action: 'allocate',
      sectionId: sec.id,
    });
  };

  // Navigate to View Students
  const handleOpenViewStudents = (sec: HodSectionItem) => {
    setActiveSection(sec);
    setActiveSectionId(sec.id);
    setActiveView('VIEW_STUDENTS');
    updateUrlParams({
      semester: selectedSemester.toString(),
      branch: selectedBranch,
      action: 'view',
      sectionId: sec.id,
    });
  };

  // Navigate Back to Manage Branch Sections
  const handleBackToBranchSections = () => {
    setActiveView('MANAGE_BRANCH');
    setActiveSectionId(null);
    updateUrlParams({
      semester: selectedSemester.toString(),
      branch: selectedBranch,
      action: null,
      sectionId: null,
    });
  };

  // Capacity Input Handlers (Strips leading zeros real-time so 080 becomes 80)
  const handleCapacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setFormCapacity('');
      e.currentTarget.value = '';
      return;
    }
    const digits = raw.replace(/\D/g, '');
    const clean = digits.replace(/^0+/, '');
    e.currentTarget.value = clean;
    setFormCapacity(clean === '' ? '' : parseInt(clean, 10));
  };

  const handleCapacityBlur = (minAllowed: number = 1) => (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = String(formCapacity ?? '').trim();
    const num = parseInt(raw.replace(/^0+/, '') || '0', 10);
    const fallback = Math.max(minAllowed, 60);
    const finalVal = isNaN(num) || num < minAllowed ? fallback : Math.min(200, num);
    e.currentTarget.value = String(finalVal);
    setFormCapacity(finalVal);
  };

  // Open Create Section Modal
  const handleOpenCreateModal = () => {
    setFormError(null);
    setAlphabetDropdownOpen(false);
    const nextAvailable = ALPHABET_OPTIONS.find((letter) => !existingAlphabets.has(letter)) || '';
    setSelectedAlphabet(nextAvailable);
    setFormCapacity(60);
    setFormClassroom('');
    setFormDescription('');
    setCreateModalOpen(true);
  };

  // Submit Create Section (Manual section creation with Section + Alphabet)
  const handleCreateSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allAlphabetsUsed) {
      setFormError('No section names available. All Section A-Z names are already used.');
      return;
    }
    if (!selectedAlphabet) {
      setFormError('Please select a section alphabet.');
      return;
    }
    if (existingAlphabets.has(selectedAlphabet)) {
      setFormError(`Section ${selectedAlphabet} already exists for this semester.`);
      return;
    }

    const finalSectionName = `Section ${selectedAlphabet}`;
    const parsedCapacity = parseInt(String(formCapacity).replace(/^0+/, '') || '0', 10);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0 || !Number.isInteger(parsedCapacity)) {
      setFormError('Section capacity must be a positive integer.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await hodService.createSection({
        name: finalSectionName,
        semester: selectedSemester,
        academicYear: activeAY,
        capacity: parsedCapacity,
        branch: selectedBranch || (isSemesterHandling ? 'CSE' : deptCode),
        classroom: formClassroom.trim() || undefined,
        description: formDescription.trim() || undefined,
      });

      setNotification({
        type: 'success',
        message: `Section "${finalSectionName}" created successfully.`,
      });
      setCreateModalOpen(false);
      if (selectedBranch) {
        loadBranchSections(selectedBranch);
      }
    } catch (err: any) {
      console.error('Create section failed:', err);
      setFormError(err.response?.data?.error || 'Failed to create section.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Section Modal
  const handleOpenEditModal = (sec: HodSectionItem) => {
    setActiveSection(sec);
    setFormName(sec.name);
    const cleanCap = sec.capacity ? parseInt(String(sec.capacity).replace(/^0+/, '') || '60', 10) : 60;
    setFormCapacity(cleanCap || 60);
    setFormClassroom(sec.classroom || '');
    setFormDescription(sec.description || '');
    setFormError(null);
    setEditModalOpen(true);
  };

  // Submit Edit Section
  const handleEditSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSection) return;

    if (!formName.trim()) {
      setFormError('Section name is required.');
      return;
    }
    const parsedCapacity = parseInt(String(formCapacity).replace(/^0+/, '') || '0', 10);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
      setFormError('Section capacity must be greater than zero.');
      return;
    }
    if (parsedCapacity < activeSection.studentCount) {
      setFormError(`Capacity cannot be lower than currently allocated students (${activeSection.studentCount}).`);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await hodService.updateSection(activeSection.id, {
        name: formName.trim(),
        capacity: parsedCapacity,
        classroom: formClassroom.trim() || '',
        description: formDescription.trim() || '',
      });

      setNotification({
        type: 'success',
        message: `Section "${formName.trim()}" updated successfully.`,
      });
      setEditModalOpen(false);
      if (selectedBranch) {
        loadBranchSections(selectedBranch);
      }
    } catch (err: any) {
      console.error('Update section failed:', err);
      setFormError(err.response?.data?.error || 'Failed to update section.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Section
  const handleConfirmDelete = async () => {
    if (!sectionToDelete) return;
    setSubmitting(true);
    try {
      await hodService.deleteSection(sectionToDelete.id);
      setNotification({
        type: 'success',
        message: `Section "${sectionToDelete.name}" removed successfully.`,
      });
      setDeleteModalOpen(false);
      setSectionToDelete(null);
      if (selectedBranch) {
        loadBranchSections(selectedBranch);
      }
    } catch (err: any) {
      console.error('Delete section failed:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to delete section.',
      });
      setDeleteModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Remove Student from Section
  const handleConfirmRemoveStudent = async () => {
    if (!activeSection || !studentToRemove) return;
    setSubmitting(true);
    try {
      await hodService.removeStudentFromSection(activeSection.id, studentToRemove.id);
      setNotification({
        type: 'success',
        message: `Student "${studentToRemove.name}" removed from ${activeSection.name}.`,
      });
      setRemoveStudentModalOpen(false);
      setStudentToRemove(null);
      loadAllocatedStudents(activeSection.id);
    } catch (err: any) {
      console.error('Remove student failed:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to remove student from section.',
      });
      setRemoveStudentModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Unallocate All Students from Section
  const handleConfirmUnallocateAll = async () => {
    if (!activeSection || unallocatingAll) return;
    setUnallocatingAll(true);
    setUnallocateAllError(null);
    try {
      const res = await hodService.unallocateAllStudentsFromSection(activeSection.id);
      const count = res.data?.affectedCount ?? allocatedStudentsList.length;
      setNotification({
        type: 'success',
        message: res.message || `${count} students unallocated successfully from ${activeSection.name}.`,
      });
      setUnallocateAllModalOpen(false);
      await loadAllocatedStudents(activeSection.id);
      if (selectedBranch) {
        loadBranchSections(selectedBranch);
      }
      loadBranchesOverview();
    } catch (err: any) {
      console.error('Unallocate all students failed:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to unallocate students from section.';
      setUnallocateAllError(errMsg);
      setNotification({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setUnallocatingAll(false);
    }
  };

  // ─── Filtered Unallocated Students for Allocation Page ───
  const unallocatedStudents = useMemo(() => {
    if (!cohortData?.students) return [];
    // Only unallocated students
    let list = cohortData.students.filter((s) => s.isUnallocated);

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
  }, [cohortData?.students, searchQuery]);

  const remainingCapacity = useMemo(() => {
    if (!cohortData?.section) return 60;
    const cap = cohortData.section.capacity || 60;
    const allocated =
      cohortData.stats?.thisSectionAllocated ??
      cohortData.stats?.sectionAllocatedCount ??
      cohortData.students?.filter((s) => s.isAllocatedToThisSection).length ??
      0;
    return Math.max(0, cap - allocated);
  }, [cohortData]);

  // ─── Individual Checkbox Toggle ───
  const toggleStudent = (studentId: string) => {
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

  // ─── Select All Helper ───
  const handleSelectAll = () => {
    if (remainingCapacity <= 0) {
      setNotification({
        type: 'error',
        message: 'This section has 0 remaining seats.',
      });
      return;
    }

    // If all visible already selected, unselect all
    const allVisibleIds = unallocatedStudents.map((s) => s.id);
    const areAllVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedStudentIds.has(id));

    if (areAllVisibleSelected) {
      setSelectedStudentIds(new Set());
      return;
    }

    // Select up to remaining capacity
    const toSelect = unallocatedStudents.slice(0, remainingCapacity);
    const next = new Set<string>();
    toSelect.forEach((s) => next.add(s.id));
    setSelectedStudentIds(next);

    if (unallocatedStudents.length > remainingCapacity) {
      setNotification({
        type: 'error',
        message: `Selected first ${toSelect.length} students. Limited by remaining capacity (${remainingCapacity} seats).`,
      });
    }
  };

  // ─── RANGE SELECTION HELPER ───
  // Convenience selection tool only. Does NOT save to database.
  const handleApplyRangeSelection = () => {
    setRangeError(null);

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

    if (unallocatedStudents.length === 0) {
      setRangeError('No unallocated students available to select.');
      return;
    }

    if (fromNum > unallocatedStudents.length) {
      setRangeError(`"From" (${fromNum}) exceeds total available unallocated students (${unallocatedStudents.length}).`);
      return;
    }

    const effectiveTo = Math.min(toNum, unallocatedStudents.length);
    const countToSelect = effectiveTo - fromNum + 1;

    // Capacity Validation:
    if (countToSelect > remainingCapacity) {
      const secName = activeSection?.name || 'Section';
      setRangeError(`${secName} has only ${remainingCapacity} available seats.`);
      return;
    }

    // Select the slice [fromNum - 1, effectiveTo]
    const slice = unallocatedStudents.slice(fromNum - 1, effectiveTo);
    const next = new Set<string>();
    slice.forEach((s) => next.add(s.id));
    setSelectedStudentIds(next);

    setNotification({
      type: 'success',
      message: `Selected students ${fromNum} through ${effectiveTo} (${slice.length} students). Review and click Allocate to confirm.`,
    });
  };

  // ─── CONFIRM ALLOCATION ───
  const handleConfirmAllocation = async () => {
    if (!activeSection || selectedStudentIds.size === 0) return;

    if (selectedStudentIds.size > remainingCapacity) {
      setNotification({
        type: 'error',
        message: `${activeSection.name} has only ${remainingCapacity} seats remaining. You selected ${selectedStudentIds.size} students.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const studentAllocations = Array.from(selectedStudentIds).map((id) => ({
        studentId: id,
      }));

      const res = await hodService.bulkAllocateStudents(activeSection.id, studentAllocations);
      setNotification({
        type: 'success',
        message: res.message || `Successfully allocated ${selectedStudentIds.size} students to ${activeSection.name}.`,
      });

      setSelectedStudentIds(new Set());

      // Refresh cohort data
      await loadSectionCohort(activeSection.id);

      // If 0 remaining capacity, return to manage branch view smoothly
      const updatedRemaining = remainingCapacity - selectedStudentIds.size;
      if (updatedRemaining <= 0) {
        handleBackToBranchSections();
      }
    } catch (err: any) {
      console.error('Allocation failed:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to allocate students. Please check section capacity and unallocated status.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered & Paginated Allocated Students for View Students
  const filteredAllocatedStudents = useMemo(() => {
    if (!allocatedStudentsList) return [];
    if (!viewSearchQuery.trim()) return allocatedStudentsList;
    const q = viewSearchQuery.toLowerCase().trim();
    return allocatedStudentsList.filter((st) => {
      const nameMatch = st.name.toLowerCase().includes(q);
      const enrollMatch = st.enrollmentNumber ? st.enrollmentNumber.toLowerCase().includes(q) : false;
      const usnMatch = st.usn ? st.usn.toLowerCase().includes(q) : false;
      return nameMatch || enrollMatch || usnMatch;
    });
  }, [allocatedStudentsList, viewSearchQuery]);

  const totalViewPages = Math.ceil(filteredAllocatedStudents.length / viewPageSize) || 1;
  const paginatedAllocatedStudents = useMemo(() => {
    const startIndex = (viewCurrentPage - 1) * viewPageSize;
    return filteredAllocatedStudents.slice(startIndex, startIndex + viewPageSize);
  }, [filteredAllocatedStudents, viewCurrentPage, viewPageSize]);

  // Current branch details from overview
  const currentBranchInfo = useMemo(() => {
    return branchesOverview.find((b) => b.branchCode === selectedBranch);
  }, [branchesOverview, selectedBranch]);

  return (
    <div className="space-y-6">

      {/* ── VIEW 1: MAIN SECTION ALLOCATION PAGE (BRANCHES OVERVIEW) ───────────── */}
      {activeView === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* ── Return to Cohort Breadcrumb ────────────────────────────────────── */}
          {searchParams.get('semester') && (
            <div className="flex items-center justify-between pb-1">
              <Link
                to={`/hod/students/semesters/${searchParams.get('semester')}`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 shadow-xs hover:shadow-sm transition-all cursor-pointer group"
              >
                <ArrowLeft className="w-4 h-4 text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back to Semester {searchParams.get('semester')} Cohort</span>
              </Link>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Layers size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight uppercase">
                    Section Allocation
                  </h1>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                    Academic Control • {deptName} (Academic Year: {activeAY})
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                <Building2 size={13} className="text-neutral-500" />
                <span>Dept: {deptCode}</span>
                <span className="text-[10px] text-neutral-400 font-normal">(Locked)</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                <Calendar size={13} className="text-neutral-500" />
                <span>Academic Year: {activeAY}</span>
              </div>

              <Link
                to="/hod/students"
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <Users size={13} className="text-neutral-500" />
                <span>Students Directory</span>
              </Link>

              <button
                onClick={loadBranchesOverview}
                title="Refresh branches overview"
                className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Semester Selector */}
          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Select Semester
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth">
              {(isSemesterHandling ? [1, 2] : [1, 2, 3, 4, 5, 6, 7, 8]).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSelectSemester(s)}
                  className={`px-5 py-2.5 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[120px] h-11 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
                    selectedSemester === s
                      ? 'bg-blue-600 border-blue-700 text-white shadow-blue-500/20 scale-[1.02]'
                      : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
                  }`}
                >
                  <span>Semester {s}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Branch Cards List */}
          {loading ? (
            <div className="p-16 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
              <p className="mt-3 text-xs font-bold text-neutral-500">Loading branch metrics for Semester {selectedSemester}...</p>
            </div>
          ) : overviewError ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mx-auto text-rose-600">
                <AlertTriangle size={24} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-black text-neutral-900 dark:text-white">Unable to load branches</h3>
                <p className="text-xs text-neutral-500">{overviewError}</p>
              </div>
              <button
                type="button"
                onClick={loadBranchesOverview}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : branchesOverview.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
              <Layers size={36} className="text-neutral-400 mx-auto" />
              <h3 className="text-base font-black text-neutral-900 dark:text-white">No Branches Found</h3>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                No active student branches found for Semester {selectedSemester} under your department.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {branchesOverview.map((b) => (
                <div
                  key={b.branchCode}
                  className="p-5 md:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                        {b.branchCode}
                      </span>
                      <span className="text-xs text-neutral-400 font-medium hidden sm:inline">• {b.branchName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold text-neutral-600 dark:text-neutral-400 pt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-neutral-900 dark:text-neutral-200 font-black">
                        <Users size={14} className="text-blue-600 dark:text-blue-400" />
                        {b.totalStudents} Students
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1.5 font-bold text-neutral-700 dark:text-neutral-300">
                        <Layers size={14} className="text-indigo-600 dark:text-indigo-400" />
                        {b.sectionCount} {b.sectionCount === 1 ? 'Section' : 'Sections'}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                        <AlertCircle size={14} />
                        {b.unallocatedStudents} Unallocated
                      </span>
                      {b.allocatedStudents > 0 && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={14} />
                            {b.allocatedStudents} Allocated
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleManageBranch(b.branchCode)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.02] inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                  >
                    <span>Manage {b.branchCode}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: MANAGE BRANCH VIEW ────────────────────────────────────────── */}
      {activeView === 'MANAGE_BRANCH' && selectedBranch && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToBranches}
                className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowLeft size={14} />
                <span>All Branches</span>
              </button>

              <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-700" />

              <div>
                <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>{selectedBranch} • Semester {selectedSemester}</span>
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  Academic Year {activeAY}
                  {currentBranchInfo ? ` • ${currentBranchInfo.totalStudents} Students` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.01] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle size={15} />
                <span>+ Create Section</span>
              </button>

              <button
                onClick={() => loadBranchSections(selectedBranch)}
                title="Refresh sections"
                className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Sections List */}
          {loading ? (
            <div className="p-16 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
              <p className="mt-3 text-xs font-bold text-neutral-500">Loading {selectedBranch} sections...</p>
            </div>
          ) : sectionsError ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mx-auto text-rose-600">
                <AlertTriangle size={24} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-black text-neutral-900 dark:text-white">Unable to load sections</h3>
                <p className="text-xs text-neutral-500">{sectionsError}</p>
              </div>
              <button
                type="button"
                onClick={() => selectedBranch && loadBranchSections(selectedBranch)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : branchSections.length === 0 ? (
            /* No sections created yet state */
            <div className="p-12 md:p-16 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-800 shadow-sm space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                <Layers size={28} />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                  No sections created yet.
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  Create sections to begin allocating {selectedBranch} students for Semester {selectedSemester}.
                </p>
              </div>
              <button
                onClick={handleOpenCreateModal}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.02] inline-flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle size={16} />
                <span>+ Create Section</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Sections ({branchSections.length})
                </h2>
                <span className="text-xs text-neutral-400 font-medium">
                  Manual allocation workflow
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branchSections.map((sec) => {
                  const isFull = sec.availableCapacity <= 0;
                  const hasAllocated = sec.studentCount > 0;

                  return (
                    <div
                      key={sec.id}
                      className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-black text-neutral-900 dark:text-white">
                            {sec.name}
                          </h3>
                          {isFull ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                              Full
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider">
                              {sec.availableCapacity} Available
                            </span>
                          )}
                        </div>

                        {/* Capacity Metrics */}
                        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800 text-center">
                          <div>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase block">Capacity</span>
                            <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">{sec.capacity}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Allocated</span>
                            <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{sec.studentCount}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Remaining</span>
                            <span className="text-sm font-black text-amber-700 dark:text-amber-300">{sec.availableCapacity}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        {hasAllocated ? (
                          <button
                            onClick={() => handleOpenViewStudents(sec)}
                            className="flex-1 py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Users size={13} />
                            <span>View Students</span>
                          </button>
                        ) : null}

                        {!isFull ? (
                          <button
                            onClick={() => handleOpenAllocate(sec)}
                            className={`flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.01] inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                              hasAllocated ? 'flex-1' : 'w-full'
                            }`}
                          >
                            <UserPlus size={13} />
                            <span>Allocate Students</span>
                          </button>
                        ) : null}

                        <button
                          onClick={() => handleOpenEditModal(sec)}
                          title="Edit Capacity"
                          className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>

                        {sec.studentCount === 0 && (
                          <button
                            onClick={() => {
                              setSectionToDelete(sec);
                              setDeleteModalOpen(true);
                            }}
                            title="Delete Section"
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 3: ALLOCATE STUDENTS (WITH RANGE SELECTION) ────────────────────── */}
      {activeView === 'ALLOCATE' && activeSection && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToBranchSections}
                className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowLeft size={14} />
                <span>Back to {selectedBranch}</span>
              </button>

              <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-700" />

              <div>
                <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight uppercase">
                  ALLOCATE STUDENTS — {activeSection.name}
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  {selectedBranch} • Semester {selectedSemester} | Academic Year {activeAY}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => activeSectionId && loadSectionCohort(activeSectionId)}
                title="Refresh student list"
                className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* 5 KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                TOTAL STUDENTS
              </span>
              <span className="text-2xl font-black text-neutral-900 dark:text-white leading-none">
                {cohortData?.stats?.totalDepartmentStudents ?? cohortData?.stats?.totalStudents ?? 0}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                ALLOCATED
              </span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 leading-none">
                {cohortData?.stats?.thisSectionAllocated ?? cohortData?.stats?.sectionAllocatedCount ?? cohortData?.stats?.allocatedStudents ?? 0}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                UNALLOCATED
              </span>
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300 leading-none">
                {cohortData?.stats?.unallocatedStudents ?? 0}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
                SECTION CAPACITY
              </span>
              <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300 leading-none">
                {activeSection?.capacity ?? cohortData?.section?.capacity ?? 60}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                REMAINING CAPACITY
              </span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300 leading-none">
                {remainingCapacity}
              </span>
            </div>
          </div>

          {/* ── RANGE SELECTION HELPER CARD (ABOVE TABLE) ─────────────────────── */}
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
                  max={unallocatedStudents.length || 1}
                  value={rangeFrom}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                    e.currentTarget.value = clean;
                    setRangeFrom(clean === '' ? '' : parseInt(clean, 10));
                    setRangeError(null);
                  }}
                  onBlur={(e) => {
                    if (rangeFrom === '' || Number(rangeFrom) <= 0) {
                      e.currentTarget.value = '1';
                      setRangeFrom(1);
                    }
                  }}
                  className="w-20 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-black text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">To:</label>
                <input
                  type="number"
                  min={1}
                  max={unallocatedStudents.length || 1}
                  value={rangeTo}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                    e.currentTarget.value = clean;
                    setRangeTo(clean === '' ? '' : parseInt(clean, 10));
                    setRangeError(null);
                  }}
                  onBlur={(e) => {
                    if (rangeTo === '' || Number(rangeTo) <= 0) {
                      const fallback = Math.max(1, unallocatedStudents.length || 60);
                      e.currentTarget.value = String(fallback);
                      setRangeTo(fallback);
                    }
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

          {/* Search Bar & Action Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by student name, USN, enrollment number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Live Count & Dynamic Allocate Button */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-black text-neutral-800 dark:text-neutral-200">
                Selected: <span className="text-blue-600 dark:text-blue-400">{selectedStudentIds.size}</span> / {remainingCapacity}
              </div>

              <button
                onClick={handleConfirmAllocation}
                disabled={selectedStudentIds.size === 0 || submitting}
                className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-2 cursor-pointer ${
                  selectedStudentIds.size > 0 && !submitting
                    ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] shadow-blue-500/20'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Allocating...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} />
                    <span>
                      {selectedStudentIds.size > 0
                        ? `Allocate ${selectedStudentIds.size} Students`
                        : 'Allocate Students'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Student Table */}
          {loading ? (
            <div className="p-16 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
              <p className="mt-3 text-xs font-bold text-neutral-500">Loading student table...</p>
            </div>
          ) : unallocatedStudents.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
              <Users size={32} className="text-neutral-400 mx-auto" />
              <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                No Unallocated Students Found
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {searchQuery
                  ? 'No students match your search criteria.'
                  : `All ${selectedBranch} students for Semester ${selectedSemester} are currently allocated.`}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-neutral-100 dark:bg-neutral-800 border-b-2 border-neutral-300 dark:border-neutral-700">
                    <tr className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                      <th className="py-3.5 px-4 w-12 text-center text-neutral-900 dark:text-white font-black">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          title="Toggle Select All (up to remaining capacity)"
                          className="text-neutral-900 dark:text-white hover:text-blue-600 cursor-pointer inline-flex items-center justify-center"
                        >
                          {unallocatedStudents.length > 0 &&
                          unallocatedStudents.every((s) => selectedStudentIds.has(s.id)) ? (
                            <CheckSquare size={16} className="text-blue-600" />
                          ) : (
                            <Square size={16} className="text-neutral-900 dark:text-white" />
                          )}
                        </button>
                      </th>
                      <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">SL NO</th>
                      <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">ROLL NUMBER</th>
                      <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">USN</th>
                      <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">ENROLLMENT NUMBER</th>
                      <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">STUDENT NAME</th>
                      <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">ADMISSION</th>
                      <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">CURRENT SECTION</th>
                      <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
                    {unallocatedStudents.map((st, index) => {
                      const isSelected = selectedStudentIds.has(st.id);

                      return (
                        <tr
                          key={st.id}
                          onClick={() => toggleStudent(st.id)}
                          className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80 dark:bg-blue-950/40' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleStudent(st.id)}
                              className="cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-blue-600" />
                              ) : (
                                <Square size={16} className="text-neutral-400 hover:text-neutral-600" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white text-xs">
                            {index + 1}
                          </td>
                          <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                            {st.rollNumber || '—'}
                          </td>
                          <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white text-xs uppercase tracking-tight">
                            {st.usn || '—'}
                          </td>
                          <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white text-xs">
                            {st.enrollmentNumber || '—'}
                          </td>
                          <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white text-xs">
                            {st.name}
                          </td>
                          <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400 font-semibold uppercase text-[11px]">
                            {st.admissionType || 'KCET'}
                          </td>
                          <td className="py-3 px-4 text-neutral-400 font-semibold">
                            —
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              {st.admissionStatus || 'APPROVED'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 4: VIEW ALLOCATED STUDENTS ────────────────────────────────────── */}
      {activeView === 'VIEW_STUDENTS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {!activeSection && !loading ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
              <AlertCircle size={32} className="text-amber-500 mx-auto" />
              <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                Section information is missing or could not be found.
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Please return to the section allocation dashboard to select a valid section.
              </p>
              <button
                onClick={handleBackToBranchSections}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to {selectedBranch || 'Sections'}</span>
              </button>
            </div>
          ) : activeSection && (
            <>
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBackToBranchSections}
                    className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to {selectedBranch || activeSection.branch || 'Sections'}</span>
                  </button>

                  <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-700" />

                  <div>
                    <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight uppercase">
                      {activeSection.name} — ALLOCATED STUDENTS
                    </h1>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      {selectedBranch || activeSection.branch || 'CSE'} • Semester {selectedSemester || activeSection.semester} | Academic Year {activeAY || activeSection.academicYear} • {allocatedStudentsList.length} / {activeSection.capacity} Students
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeSection.capacity > allocatedStudentsList.length && (
                    <button
                      onClick={() => handleOpenAllocate(activeSection)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.01] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus size={14} />
                      <span>Allocate More ({activeSection.capacity - allocatedStudentsList.length} seats remaining)</span>
                    </button>
                  )}

                  <button
                    onClick={() => activeSectionId && loadAllocatedStudents(activeSectionId)}
                    title="Refresh student list"
                    className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Search and Range Controls Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
                <div className="relative flex-1 max-w-md">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by name, enrollment number, USN..."
                    value={viewSearchQuery}
                    onChange={(e) => {
                      setViewSearchQuery(e.target.value);
                      setViewCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                  {viewSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setViewSearchQuery('');
                        setViewCurrentPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 text-[10px] font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Highlighted Show Students Range Selector & Unallocate All Button */}
                <div className="shrink-0 flex items-center gap-2.5 self-end md:self-auto pl-0 md:pl-3 md:border-l border-neutral-200 dark:border-neutral-700">
                  {/* Unallocate All Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setUnallocateAllError(null);
                      setUnallocateAllModalOpen(true);
                    }}
                    disabled={allocatedStudentsList.length === 0}
                    className={`shrink-0 px-3 py-1.5 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 shadow-xs ${
                      allocatedStudentsList.length > 0
                        ? 'border-rose-300 dark:border-rose-800 bg-rose-50/80 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 cursor-pointer active:scale-95'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-800/40 text-neutral-400 dark:text-neutral-600 cursor-not-allowed opacity-50'
                    }`}
                    title={allocatedStudentsList.length === 0 ? 'No students to unallocate' : `Unallocate all ${allocatedStudentsList.length} students from this section`}
                  >
                    <UserMinus size={14} className="shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>Unallocate All</span>
                  </button>

                  <div className="flex items-center gap-2.5 px-3 py-1.5 bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl shadow-xs transition-all hover:border-blue-300">
                    <label
                      htmlFor="view-students-range-select"
                      className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                    >
                      <Users size={14} className="text-blue-600 dark:text-blue-400" />
                      <span>SHOW STUDENTS</span>
                    </label>
                    <div className="relative">
                      <select
                        id="view-students-range-select"
                        value={viewPageSize}
                        onChange={(e) => {
                          setViewPageSize(Number(e.target.value));
                          setViewCurrentPage(1);
                        }}
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

              {/* Allocated Table */}
              {loading ? (
                <div className="p-16 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                  <p className="mt-3 text-xs font-bold text-neutral-500">Loading allocated students...</p>
                </div>
              ) : allocatedStudentsList.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
                  <Users size={32} className="text-neutral-400 mx-auto" />
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                    No students have been allocated to {activeSection.name} yet.
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    This section currently has 0 / {activeSection.capacity} students allocated.
                  </p>
                  <button
                    onClick={() => handleOpenAllocate(activeSection)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus size={14} />
                    <span>Allocate Students Now</span>
                  </button>
                </div>
              ) : filteredAllocatedStudents.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
                  <Search size={32} className="text-neutral-400 mx-auto" />
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                    No allocated students match your search.
                  </h3>
                  <button
                    onClick={() => setViewSearchQuery('')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-neutral-100 dark:bg-neutral-800 border-b-2 border-neutral-300 dark:border-neutral-700">
                          <tr className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                            <th className="py-3.5 px-4 w-16 text-center text-neutral-900 dark:text-white font-black">SL NO</th>
                            <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">ENROLLMENT NUMBER</th>
                            <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">STUDENT NAME</th>
                            <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">SEMESTER</th>
                            <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black">STATUS</th>
                            <th className="py-3.5 px-4 text-neutral-900 dark:text-white font-black text-center">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
                          {paginatedAllocatedStudents.map((st, index) => {
                            const slNo = (viewCurrentPage - 1) * viewPageSize + index + 1;
                            return (
                              <tr key={st.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                                <td className="py-3 px-4 text-center font-bold text-neutral-900 dark:text-white text-xs">{slNo}</td>
                                <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white text-xs uppercase tracking-tight">{st.enrollmentNumber || '—'}</td>
                                <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white text-xs">{st.name}</td>
                                <td className="py-3 px-4 font-bold text-neutral-700 dark:text-neutral-300">
                                  {st.semester ? `Sem ${st.semester}` : `Sem ${selectedSemester || 1}`}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                    {st.admissionStatus || 'APPROVED'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      setStudentToRemove(st);
                                      setRemoveStudentModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <UserMinus size={12} />
                                    <span>Remove</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  {totalViewPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400">
                      <div className="font-medium">
                        Showing {(viewCurrentPage - 1) * viewPageSize + 1} to {Math.min(viewCurrentPage * viewPageSize, filteredAllocatedStudents.length)} of {filteredAllocatedStudents.length} students (Page {viewCurrentPage} of {totalViewPages})
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={viewCurrentPage === 1}
                          className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-bold transition-colors cursor-pointer"
                        >
                          Previous
                        </button>
                        {Array.from({ length: totalViewPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            onClick={() => setViewCurrentPage(p)}
                            className={`w-8 h-8 rounded-lg font-bold transition-colors cursor-pointer ${
                              p === viewCurrentPage
                                ? 'bg-blue-600 text-white'
                                : 'border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          onClick={() => setViewCurrentPage((p) => Math.min(totalViewPages, p + 1))}
                          disabled={viewCurrentPage === totalViewPages}
                          className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-bold transition-colors cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── CREATE SECTION MODAL (SIMPLE & CLEAR) ─────────────────────────────── */}
      {createModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-visible">
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 rounded-t-3xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <PlusCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">Create Section</h3>
                    <p className="text-xs text-neutral-500 font-medium">Create a new section container.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCreateModalOpen(false);
                    setAlphabetDropdownOpen(false);
                  }}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateSectionSubmit} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Read-Only Context Fields */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">Branch</span>
                    <span className="font-black text-neutral-900 dark:text-white">{selectedBranch || 'CSE'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">Semester</span>
                    <span className="font-black text-neutral-900 dark:text-white">Semester {selectedSemester}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">Academic Year</span>
                    <span className="font-black text-neutral-900 dark:text-white">{activeAY}</span>
                  </div>
                </div>

                {/* Section Name Selector [ Section ] [ A ▼ ] */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
                    Section Name *
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Prefix Badge */}
                    <div className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-black select-none shrink-0 shadow-xs">
                      Section
                    </div>

                    {/* Custom Alphabet Selector Popover */}
                    <div className="relative flex-1" ref={alphabetDropdownRef}>
                      <button
                        type="button"
                        disabled={allAlphabetsUsed}
                        onClick={() => setAlphabetDropdownOpen((prev) => !prev)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-black text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none flex items-center justify-between cursor-pointer disabled:bg-neutral-100 dark:disabled:bg-neutral-800 disabled:cursor-not-allowed shadow-xs transition-colors hover:border-neutral-400"
                        aria-haspopup="listbox"
                        aria-expanded={alphabetDropdownOpen}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                            {selectedAlphabet || '—'}
                          </span>
                          {isAlphabetAlreadyUsed && (
                            <span className="text-[10px] text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                              Already exists
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`text-neutral-400 transition-transform duration-200 ${
                            alphabetDropdownOpen ? 'rotate-180 text-blue-600' : ''
                          }`}
                        />
                      </button>

                      {/* Compact Dropdown Popover */}
                      {alphabetDropdownOpen && !allAlphabetsUsed && (
                        <div
                          role="listbox"
                          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                        >
                          <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 p-1.5 scrollbar-thin">
                            {ALPHABET_OPTIONS.map((letter) => {
                              const isUsed = existingAlphabets.has(letter);
                              const isSelected = selectedAlphabet === letter;

                              return (
                                <button
                                  key={letter}
                                  type="button"
                                  onClick={() => {
                                    setSelectedAlphabet(letter);
                                    setFormError(null);
                                    setAlphabetDropdownOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left rounded-lg text-xs font-bold transition-colors flex items-center justify-between cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-600 text-white'
                                      : isUsed
                                      ? 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                                      : 'text-neutral-800 dark:text-neutral-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span className="font-black text-sm">{letter}</span>
                                    <span className="text-[11px] font-medium opacity-80">
                                      Section {letter}
                                    </span>
                                  </span>

                                  <span className="text-[10px] font-semibold flex items-center gap-1">
                                    {isUsed && (
                                      <span className={isSelected ? 'text-blue-200' : 'text-neutral-400'}>
                                        Existing
                                      </span>
                                    )}
                                    {isSelected && <Check size={14} className="stroke-[3]" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Preview & Validation Messages */}
                  {selectedAlphabet && !isAlphabetAlreadyUsed && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Resulting section name:
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-[11px] border border-blue-200 dark:border-blue-800">
                        Preview: Section {selectedAlphabet}
                      </span>
                    </div>
                  )}

                  {isAlphabetAlreadyUsed && (
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 pt-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>Section {selectedAlphabet} already exists for this semester.</span>
                    </p>
                  )}

                  {allAlphabetsUsed && (
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 pt-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>No section names available. All Section A-Z names are already used.</span>
                    </p>
                  )}
                </div>

                {/* Section Capacity Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
                    Section Capacity *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={200}
                    placeholder="e.g. 60"
                    value={formCapacity}
                    onChange={handleCapacityChange}
                    onBlur={handleCapacityBlur(1)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-black text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateModalOpen(false);
                      setAlphabetDropdownOpen(false);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedAlphabet || isAlphabetAlreadyUsed || allAlphabetsUsed}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black shadow-sm transition-all hover:scale-[1.01] cursor-pointer"
                  >
                    {submitting ? 'Creating...' : 'Create Section'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── EDIT SECTION MODAL ────────────────────────────────────────────────── */}
      {editModalOpen && activeSection &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <Edit2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">Edit Section</h3>
                    <p className="text-xs text-neutral-500 font-medium">Update capacity for {activeSection.name}.</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleEditSectionSubmit} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
                    Section Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-black text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
                    Section Capacity * (Currently allocated: {activeSection.studentCount})
                  </label>
                  <input
                    type="number"
                    required
                    min={activeSection.studentCount || 1}
                    max={200}
                    placeholder="e.g. 60"
                    value={formCapacity}
                    onChange={handleCapacityChange}
                    onBlur={handleCapacityBlur(activeSection.studentCount || 1)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-black text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.01] cursor-pointer"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── DELETE SECTION MODAL ──────────────────────────────────────────────── */}
      {deleteModalOpen && sectionToDelete &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">Delete Section</h3>
                  <p className="text-xs text-neutral-500 font-medium">Are you sure you want to remove "{sectionToDelete.name}"?</p>
                </div>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                This action will delete the empty section container. It cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer"
                >
                  {submitting ? 'Deleting...' : 'Delete Section'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── REMOVE STUDENT CONFIRMATION MODAL ─────────────────────────────────── */}
      {removeStudentModalOpen && studentToRemove && activeSection &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <UserMinus size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">Remove Student</h3>
                  <p className="text-xs text-neutral-500 font-medium">Remove from {activeSection.name}</p>
                </div>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Are you sure you want to remove <span className="font-bold text-neutral-900 dark:text-white">{studentToRemove.name}</span> ({studentToRemove.usn || studentToRemove.enrollmentNumber || 'Student'}) from {activeSection.name}? The student will return to the unallocated pool.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRemoveStudentModalOpen(false);
                    setStudentToRemove(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveStudent}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer"
                >
                  {submitting ? 'Removing...' : 'Confirm Remove'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── UNALLOCATE ALL STUDENTS CONFIRMATION MODAL ───────────────────────── */}
      {unallocateAllModalOpen && activeSection &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                  <UserMinus size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    Unallocate All Students?
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    {activeSection.name}
                  </p>
                </div>
              </div>

              {unallocateAllError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{unallocateAllError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 space-y-2">
                <p className="text-xs text-neutral-700 dark:text-neutral-300">
                  You are about to unallocate all <span className="font-black text-rose-600 dark:text-rose-400">{allocatedStudentsList.length} students</span> currently assigned to <span className="font-bold text-neutral-900 dark:text-white">{activeSection.name}</span>.
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-700/60 text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                  <span>{selectedBranch || activeSection.branch || deptCode}</span>
                  <span>•</span>
                  <span>Semester {selectedSemester || activeSection.semester}</span>
                  <span>•</span>
                  <span>Academic Year {activeAY || activeSection.academicYear}</span>
                </div>
              </div>

              <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1.5 leading-relaxed">
                <p>
                  These students will be removed from this section and returned to the unallocated student pool.
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} className="shrink-0" />
                  <span>Student records and academic history will not be deleted.</span>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    if (!unallocatingAll) {
                      setUnallocateAllModalOpen(false);
                      setUnallocateAllError(null);
                    }
                  }}
                  disabled={unallocatingAll}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnallocateAll}
                  disabled={unallocatingAll}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {unallocatingAll ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Unallocating...</span>
                    </>
                  ) : (
                    <span>Unallocate All</span>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default HodStudentsSectionPage;
