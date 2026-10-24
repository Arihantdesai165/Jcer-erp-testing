import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Layers,
  UserCheck,
  Building2,
  X,
  Lock,
  Edit2,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronRight,
  Info,
  ArrowRightLeft,
  History,
  Calendar,
  ArrowLeft,
  UserX,
  ArrowRight,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { RootState } from '../../store';
import hodService, {
  HodSubjectItem,
  HodFacultyItem,
  HodSectionItem,
  HodBranchOverviewItem,
} from '../../services/hod.service';
import { useAcademicYear } from '../../context/AcademicYearContext';

export interface HodFacultyAssignmentItem {
  id: string;
  facultyUserId: string;
  facultyName: string;
  facultyEmail?: string;
  subjectId: string;
  subjectName?: string;
  subjectCode?: string;
  subjectCycle?: string;
  subjectType?: string;
  credits?: number;
  semester: number;
  section: string;
  sectionId?: string | null;
  branch?: string;
  departmentId?: string;
  departmentCode?: string;
  departmentName?: string;
  academicYear: string;
  attendanceAccess?: boolean;
  marksAccess?: boolean;
  status: string;
}

export interface HodDepartmentItem {
  id: string;
  code: string;
  name: string;
  type?: string;
}

const FALLBACK_DEPARTMENTS: HodDepartmentItem[] = [
  { id: 'CSE', code: 'CSE', name: 'Computer Science & Engineering' },
  { id: 'CSE-AIML', code: 'CSE-AIML', name: 'Computer Science & Engineering (AIML)' },
  { id: 'ECE', code: 'ECE', name: 'Electronics & Comm Engg' },
  { id: 'ME', code: 'ME', name: 'Mechanical Engineering' },
  { id: 'CV', code: 'CV', name: 'Civil Engineering' },
  { id: 'AS', code: 'AS', name: 'Applied Science & Humanities' },
];

export const HodFacultyAssignmentsPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { academicYear } = useAcademicYear();

  const activeAY = academicYear || '2026-27';
  const deptCode = user?.department?.code || 'AS';
  const deptName = user?.department?.name || 'Applied Science';
  const isAppliedScience =
    user?.department?.type === 'SEMESTER_HANDLING' || deptCode === 'AS';

  // Branch Selection State (Main view)
  const [branchesList, setBranchesList] = useState<HodBranchOverviewItem[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(isAppliedScience ? 'CSE' : (deptCode || 'CSE'));

  const currentBranchCode = isAppliedScience ? selectedBranch : deptCode;

  useEffect(() => {
    if (!isAppliedScience && deptCode) {
      setSelectedBranch(deptCode);
    }
  }, [deptCode, isAppliedScience]);

  // URL Query Parameters Sync
  const [searchParams, setSearchParams] = useSearchParams();
  const semQuery = searchParams.get('semester');
  const initialSemester = semQuery ? parseInt(semQuery, 10) : 1;

  // Filters & Tabs State
  const [selectedSemester, setSelectedSemester] = useState<number>(
    !isNaN(initialSemester) && initialSemester >= 1 && initialSemester <= 8 ? initialSemester : 1
  );
  const [selectedCycle, setSelectedCycle] = useState<'P_CYCLE' | 'C_CYCLE'>('P_CYCLE');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Sync selectedSemester with URL search params changes
  useEffect(() => {
    const semParam = searchParams.get('semester');
    if (semParam) {
      const parsed = parseInt(semParam, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 8 && parsed !== selectedSemester) {
        setSelectedSemester(parsed);
      }
    }
  }, [searchParams]);

  // Core Data States
  const [subjects, setSubjects] = useState<HodSubjectItem[]>([]);
  const [facultyList, setFacultyList] = useState<HodFacultyItem[]>([]);
  const [assignments, setAssignments] = useState<HodFacultyAssignmentItem[]>([]);
  const [departmentSectionsMap, setDepartmentSectionsMap] = useState<Record<string, HodSectionItem[]>>({});
  const [departmentsList, setDepartmentsList] = useState<HodDepartmentItem[]>(FALLBACK_DEPARTMENTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [activeModalSubject, setActiveModalSubject] = useState<HodSubjectItem | null>(null);

  // Modal Workflow States:
  // Step 1: Teaching Departments (Checkbox Set) - UNCHECKED BY DEFAULT (REQUIREMENT 3)
  const [selectedTeachingDepts, setSelectedTeachingDepts] = useState<Set<string>>(new Set());

  // Step 2: Faculty Core Department (ID or Code)
  const [selectedCoreDeptId, setSelectedCoreDeptId] = useState<string>('');

  // Step 3: Faculty Member (ID)
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');

  // Step 4: Selected Sections Set ("DEPT_CODE:SECTION_NAME")
  const [selectedSectionKeys, setSelectedSectionKeys] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState<boolean>(false);

  // Transfer Faculty Modal State
  const [transferTarget, setTransferTarget] = useState<{
    allocation: HodFacultyAssignmentItem;
    subject: HodSubjectItem;
  } | null>(null);
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transferCoreDeptId, setTransferCoreDeptId] = useState<string>('');
  const [transferFacultyId, setTransferFacultyId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('WORKLOAD_REBALANCING');
  const [transferSubmitting, setTransferSubmitting] = useState<boolean>(false);

  // Faculty History Modal State
  const [historyTarget, setHistoryTarget] = useState<{
    allocation: HodFacultyAssignmentItem;
    subject: HodSubjectItem;
  } | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Safe Unallocation Modal State
  const [unallocateTarget, setUnallocateTarget] = useState<{
    allocation: HodFacultyAssignmentItem;
    subject: HodSubjectItem;
    teachingDepartment?: string;
  } | null>(null);
  const [unallocating, setUnallocating] = useState<boolean>(false);

  // Auto-dismiss notification timer
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load Departments List
  useEffect(() => {
    hodService
      .getDepartments()
      .then((res) => {
        if (res && res.length > 0) {
          setDepartmentsList(res);
        }
      })
      .catch(() => {});
  }, []);

  // Load Branch Overview for AS / Multi-branch HOD
  useEffect(() => {
    if (isAppliedScience) {
      hodService
        .getBranchesOverview(selectedSemester, activeAY)
        .then((res) => {
          const bList = res?.branches || [];
          setBranchesList(bList);
          if (bList.length > 0 && !bList.some((b) => b.branchCode === selectedBranch)) {
            setSelectedBranch(bList[0].branchCode);
          }
        })
        .catch(() => {});
    }
  }, [selectedSemester, activeAY, isAppliedScience]);

  // Main Data Fetching
  const loadData = async () => {
    setLoading(true);
    try {
      const [subjectsRes, facultyRes, assignmentsRes] = await Promise.all([
        hodService.getSubjects({
          semester: selectedSemester,
          status: 'ACTIVE',
          branch: isAppliedScience ? selectedBranch : undefined,
        }),
        hodService.getFacultyList(),
        hodService.getFacultyAssignments({
          semester: selectedSemester,
          academicYear: activeAY,
        }),
      ]);

      setSubjects(subjectsRes || []);
      setFacultyList(facultyRes || []);
      setAssignments(assignmentsRes || []);

      // Fetch Sections for all relevant departments for this semester & AY
      const baseCodes = isAppliedScience
        ? (departmentsList.length > 0
            ? departmentsList.filter((d) => d.code !== 'AS').map((d) => d.code)
            : ['CSE', 'CSE-AIML', 'ME', 'ECE', 'CV'])
        : [deptCode];

      const deptsToFetch = Array.from(new Set(baseCodes));
      if (isAppliedScience && !deptsToFetch.includes('CSE-AIML')) {
        deptsToFetch.push('CSE-AIML');
      }

      const secMap: Record<string, HodSectionItem[]> = {};
      await Promise.all(
        deptsToFetch.map(async (dCode) => {
          try {
            const secList = await hodService.getSections(selectedSemester, activeAY, dCode);
            secMap[dCode] = secList || [];
            if (dCode === 'CSE-AIML') {
              secMap['AIML'] = secList || [];
            } else if (dCode === 'AIML') {
              secMap['CSE-AIML'] = secList || [];
            }
          } catch {
            secMap[dCode] = [];
          }
        })
      );

      setDepartmentSectionsMap(secMap);
    } catch (err: any) {
      console.error('Failed to load teaching allocation data:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to load teaching allocation data.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSemester, selectedBranch, activeAY]);

  // Filter subjects based on Applied Science cycle, search, and type
  const filteredSubjects = useMemo(() => {
    return subjects.filter((subj) => {
      // Semester match
      if (Number(subj.semester) !== Number(selectedSemester)) return false;

      // Applied Science Cycle Filter
      if (isAppliedScience && (selectedSemester === 1 || selectedSemester === 2)) {
        if (subj.cycle && subj.cycle !== selectedCycle) {
          return false;
        }
      }

      // Subject Type filter
      if (typeFilter !== 'ALL' && subj.type !== typeFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = subj.name.toLowerCase().includes(q);
        const matchCode = subj.code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }

      return true;
    });
  }, [subjects, selectedSemester, selectedCycle, typeFilter, searchQuery, isAppliedScience]);

  // Map of Subject ID / Subject Code -> List of active FacultyAssignments (across all teaching departments)
  const subjectAssignmentsMap = useMemo(() => {
    const map: Record<string, HodFacultyAssignmentItem[]> = {};
    assignments.forEach((a) => {
      if (a.status === 'ACTIVE' || !a.status) {
        // Map by subjectId
        if (a.subjectId) {
          if (!map[a.subjectId]) map[a.subjectId] = [];
          if (!map[a.subjectId].some((item) => item.id === a.id)) {
            map[a.subjectId].push(a);
          }
        }

        // Map by subjectCode (normalized)
        if (a.subjectCode) {
          const codeKey = `code:${a.subjectCode.trim().toUpperCase()}`;
          if (!map[codeKey]) map[codeKey] = [];
          if (!map[codeKey].some((item) => item.id === a.id)) {
            map[codeKey].push(a);
          }
        }
      }
    });
    return map;
  }, [assignments]);

  // Helper to get allocations for a given subject (by ID first, fallback to code)
  const getSubjectAllocations = (subj: HodSubjectItem): HodFacultyAssignmentItem[] => {
    if (!subj) return [];
    if (subjectAssignmentsMap[subj.id] && subjectAssignmentsMap[subj.id].length > 0) {
      return subjectAssignmentsMap[subj.id];
    }
    if (subj.code) {
      const codeKey = `code:${subj.code.trim().toUpperCase()}`;
      if (subjectAssignmentsMap[codeKey] && subjectAssignmentsMap[codeKey].length > 0) {
        return subjectAssignmentsMap[codeKey];
      }
    }
    return [];
  };

  // Open allocation modal (REQUIREMENT 3: ALL UNCHECKED BY DEFAULT!)
  const handleOpenModal = (subj: HodSubjectItem) => {
    setActiveModalSubject(subj);
    setSelectedTeachingDepts(new Set()); // REQUIREMENT 3: ALL INITIALLY UNCHECKED!
    setSelectedCoreDeptId(''); // REQUIREMENT 6: CLEAR CORE DEPT!
    setSelectedFacultyId(''); // REQUIREMENT 6: CLEAR FACULTY!
    setSelectedSectionKeys(new Set()); // REQUIREMENT 23: RESET SECTIONS!
  };

  // Close allocation modal
  const handleCloseModal = () => {
    setActiveModalSubject(null);
    setSelectedTeachingDepts(new Set());
    setSelectedCoreDeptId('');
    setSelectedFacultyId('');
    setSelectedSectionKeys(new Set());
  };

  // Toggle Teaching Department checkbox in modal
  const toggleTeachingDept = (dCode: string) => {
    setSelectedTeachingDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dCode)) {
        next.delete(dCode);
        // Clear selected sections belonging to the unchecked department (REQUIREMENT 23)
        setSelectedSectionKeys((secPrev) => {
          const secNext = new Set(secPrev);
          secNext.forEach((key) => {
            if (key.startsWith(`${dCode}:`)) secNext.delete(key);
          });
          return secNext;
        });
      } else {
        next.add(dCode);
      }
      return next;
    });
  };

  // Handle Core Department selection change (REQUIREMENT 5 & 6)
  const handleCoreDeptChange = (newCoreId: string) => {
    setSelectedCoreDeptId(newCoreId);
    setSelectedFacultyId(''); // REQUIREMENT 6: IMMEDIATELY RESET FACULTY WHEN CORE DEPT CHANGES!
  };

  const getFacultyDisplayRole = (fac: any) => {
    if (fac.role === 'HOD') return 'HOD';
    if (fac.role === 'DEAN') return 'Dean Academic';
    if (fac.role === 'PRINCIPAL') return 'Principal';
    return 'Faculty';
  };

  // Filter Faculty list dynamically based on Selected Core Department (REQUIREMENT 5, 8, 21)
  const eligibleFacultyList = useMemo(() => {
    if (!selectedCoreDeptId) return [];

    // Find selected department object to get both UUID and code
    const targetDeptObj = departmentsList.find(
      (d) => d.id === selectedCoreDeptId || d.code === selectedCoreDeptId
    );
    const targetId = targetDeptObj?.id || selectedCoreDeptId;
    const targetCode = targetDeptObj?.code || selectedCoreDeptId;

    return facultyList.filter((fac) => {
      // REQUIREMENT 8: Exclude inactive, rejected, or unapproved faculty
      const isAuthorized =
        fac.accountStatus === 'ACTIVE' ||
        fac.authorizationStatus === 'FULLY_APPROVED' ||
        (fac as any).overallStatus === 'AUTHORIZED';
      if (!isAuthorized) return false;
      if (
        fac.accountStatus === 'INACTIVE' ||
        fac.accountStatus === 'DEACTIVATED' ||
        fac.authorizationStatus === 'REJECTED'
      ) {
        return false;
      }

      // REQUIREMENT 5 & 21: Match strictly by faculty's actual core department
      const facCoreId = fac.coreDepartmentId || fac.departmentId;
      const facCoreCode = fac.coreDepartmentCode || fac.departmentCode || fac.department;

      const matchesId = facCoreId && targetId && facCoreId === targetId;
      const matchesCode =
        facCoreCode && targetCode && facCoreCode.toUpperCase() === targetCode.toUpperCase();

      return Boolean(matchesId || matchesCode);
    });
  }, [facultyList, selectedCoreDeptId, departmentsList]);

  // Handle section key toggle ("DEPT_CODE:SECTION_NAME")
  const toggleSectionKey = (key: string) => {
    setSelectedSectionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Submission handler for Subject Allocation
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalSubject) return;

    if (selectedTeachingDepts.size === 0) {
      setNotification({ type: 'error', message: 'Please select at least one Teaching Department.' });
      return;
    }

    if (!selectedCoreDeptId) {
      setNotification({ type: 'error', message: 'Please select a Faculty Core Department.' });
      return;
    }

    if (!selectedFacultyId) {
      setNotification({ type: 'error', message: 'Please select a Faculty Member.' });
      return;
    }

    if (selectedSectionKeys.size === 0) {
      setNotification({ type: 'error', message: 'Please select at least one section to assign.' });
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let lastError = '';

    try {
      const targetDeptObj = departmentsList.find(
        (d) => d.id === selectedCoreDeptId || d.code === selectedCoreDeptId
      );

      const keysArr = Array.from(selectedSectionKeys);
      for (const key of keysArr) {
        const [dCode, secCode] = key.split(':');
        const teachDeptObj = departmentsList.find((d) => d.code === dCode);

        try {
          await hodService.assignFacultySubject(selectedFacultyId, {
            subjectId: activeModalSubject.id,
            semester: selectedSemester,
            section: secCode,
            academicYear: activeAY,
            cycle: isAppliedScience ? selectedCycle : undefined,
            coreDepartmentId: targetDeptObj?.id,
            coreDepartmentCode: targetDeptObj?.code,
            teachingDepartmentId: teachDeptObj?.id,
            teachingDepartmentCode: dCode,
            attendanceAccess: true,
            marksAccess: true,
          });
          successCount++;
        } catch (err: any) {
          lastError = err.response?.data?.error || `Failed to assign ${dCode} Section ${secCode}`;
        }
      }

      if (successCount > 0) {
        setNotification({
          type: 'success',
          message: `Successfully created ${successCount} teaching allocation(s) for ${activeModalSubject.name}.`,
        });
        handleCloseModal();
        await loadData(); // REQUIREMENT 25: Refresh page without browser reload
      } else {
        setNotification({
          type: 'error',
          message: lastError || 'Failed to assign faculty. Please verify your selections.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'An unexpected error occurred during allocation.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Safe Unallocation Handlers
  const handleOpenUnallocateModal = (
    alloc: HodFacultyAssignmentItem,
    subject: HodSubjectItem,
    teachingDepartment?: string
  ) => {
    setUnallocateTarget({ allocation: alloc, subject, teachingDepartment });
  };

  const handleCloseUnallocateModal = () => {
    if (unallocating) return; // Prevent closing while processing
    setUnallocateTarget(null);
  };

  const handleConfirmUnallocate = async () => {
    if (!unallocateTarget || unallocating) return;
    setUnallocating(true);
    try {
      const res = await hodService.unallocateFacultyAssignment(unallocateTarget.allocation.id);
      setNotification({
        type: 'success',
        message:
          res?.message ||
          `Faculty ${unallocateTarget.allocation.facultyName} unallocated from Section ${unallocateTarget.allocation.section || 'A'}.`,
      });
      setUnallocateTarget(null);
      await loadData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message:
          err.response?.data?.error ||
          err.message ||
          'Failed to unallocate faculty member.',
      });
    } finally {
      setUnallocating(false);
    }
  };

  // Keyboard shortcut to close unallocation modal on Escape without confirming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && unallocateTarget && !unallocating) {
        handleCloseUnallocateModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [unallocateTarget, unallocating]);

  // Transfer Modal Handlers & Computed Lists
  const handleOpenTransferModal = (alloc: HodFacultyAssignmentItem, subject: HodSubjectItem) => {
    setTransferTarget({ allocation: alloc, subject });
    setTransferDate(new Date().toISOString().split('T')[0]);
    // Pre-populate core department from current faculty if known
    const currentDeptObj = departmentsList.find(
      (d) => d.id === alloc.departmentId || d.code === alloc.departmentCode
    );
    setTransferCoreDeptId(currentDeptObj?.id || '');
    setTransferFacultyId('');
    setTransferReason('WORKLOAD_REBALANCING');
  };

  const handleCloseTransferModal = () => {
    setTransferTarget(null);
    setTransferSubmitting(false);
  };

  const handleTransferCoreDeptChange = (newCoreId: string) => {
    setTransferCoreDeptId(newCoreId);
    setTransferFacultyId(''); // Immediately reset faculty dropdown when core dept changes
  };

  const transferTargetDeptObj = useMemo(() => {
    if (!transferCoreDeptId) return null;
    return departmentsList.find((d) => d.id === transferCoreDeptId || d.code === transferCoreDeptId);
  }, [transferCoreDeptId, departmentsList]);

  const transferEligibleFacultyList = useMemo(() => {
    if (!transferCoreDeptId) return [];

    const targetDeptObj = departmentsList.find(
      (d) => d.id === transferCoreDeptId || d.code === transferCoreDeptId
    );
    const targetId = targetDeptObj?.id || transferCoreDeptId;
    const targetCode = targetDeptObj?.code || transferCoreDeptId;

    return facultyList.filter((fac) => {
      // Exclude inactive / deactivated
      const isAuthorized =
        fac.accountStatus === 'ACTIVE' ||
        fac.authorizationStatus === 'FULLY_APPROVED' ||
        (fac as any).overallStatus === 'AUTHORIZED';
      if (!isAuthorized) return false;
      if (
        fac.accountStatus === 'INACTIVE' ||
        fac.accountStatus === 'DEACTIVATED' ||
        fac.authorizationStatus === 'REJECTED'
      ) {
        return false;
      }

      // Match strictly by core department ID or Code (never treat CSE-AIML as CSE)
      const facCoreId = fac.coreDepartmentId || fac.departmentId;
      const facCoreCode = fac.coreDepartmentCode || fac.departmentCode || fac.department;

      const matchesId = facCoreId && targetId && facCoreId === targetId;
      const matchesCode =
        facCoreCode && targetCode && facCoreCode.toUpperCase() === targetCode.toUpperCase();

      if (!matchesId && !matchesCode) return false;

      // Prevent selecting the same current faculty
      if (
        transferTarget?.allocation &&
        (fac.id === transferTarget.allocation.facultyUserId ||
          fac.userId === transferTarget.allocation.facultyUserId)
      ) {
        return false;
      }

      return true;
    });
  }, [facultyList, transferCoreDeptId, departmentsList, transferTarget]);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;

    if (!transferCoreDeptId) {
      setNotification({ type: 'error', message: 'Please select a New Faculty Core Department.' });
      return;
    }

    if (!transferFacultyId) {
      setNotification({ type: 'error', message: 'Please select a New Faculty Member.' });
      return;
    }

    if (!transferDate) {
      setNotification({ type: 'error', message: 'Please select a Transfer Date.' });
      return;
    }

    setTransferSubmitting(true);
    try {
      const coreDeptObj = departmentsList.find(
        (d) => d.id === transferCoreDeptId || d.code === transferCoreDeptId
      );

      const res = await hodService.transferFacultyAssignment(transferTarget.allocation.id, {
        newFacultyCoreDepartmentId: coreDeptObj?.id || transferCoreDeptId,
        newFacultyCoreDepartmentCode: coreDeptObj?.code || transferCoreDeptId,
        newFacultyId: transferFacultyId,
        transferDate: transferDate,
        reason: transferReason,
      });

      setNotification({
        type: 'success',
        message: res.message || `Successfully transferred Section ${transferTarget.allocation.section} faculty.`,
      });
      handleCloseTransferModal();
      await loadData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to transfer faculty assignment.',
      });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleOpenHistoryModal = async (alloc: HodFacultyAssignmentItem, subject: HodSubjectItem) => {
    setHistoryTarget({ allocation: alloc, subject });
    setHistoryLoading(true);
    try {
      const records = await hodService.getFacultyAssignmentHistory(alloc.id);
      setHistoryRecords(records || []);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to load faculty history.',
      });
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseHistoryModal = () => {
    setHistoryTarget(null);
    setHistoryRecords([]);
  };


  // Calculate Statistics Overview with accurate coverage
  const totalSubjectsCount = filteredSubjects.length;
  const { assignedSubjectsCount, partialSubjectsCount, unassignedSubjectsCount } = useMemo(() => {
    let full = 0;
    let partial = 0;
    let unassigned = 0;

    const currentBranchSections = departmentSectionsMap[currentBranchCode] || departmentSectionsMap[selectedBranch] || [];
    const requiredSectionsCount = currentBranchSections.length;

    filteredSubjects.forEach((subj) => {
      const allocs = getSubjectAllocations(subj);
      if (allocs.length === 0) {
        unassigned++;
      } else if (requiredSectionsCount > 0 && allocs.length < requiredSectionsCount) {
        partial++;
      } else {
        full++;
      }
    });

    return {
      assignedSubjectsCount: full,
      partialSubjectsCount: partial,
      unassignedSubjectsCount: unassigned,
    };
  }, [filteredSubjects, subjectAssignmentsMap, departmentSectionsMap, currentBranchCode, selectedBranch]);

  // Selected Core Department Display Name
  const selectedCoreDeptObj = useMemo(() => {
    if (!selectedCoreDeptId) return null;
    return departmentsList.find((d) => d.id === selectedCoreDeptId || d.code === selectedCoreDeptId);
  }, [selectedCoreDeptId, departmentsList]);

  // Selected Faculty Object
  const selectedFacultyObj = useMemo(() => {
    if (!selectedFacultyId) return null;
    return facultyList.find((f) => f.id === selectedFacultyId || f.userId === selectedFacultyId);
  }, [selectedFacultyId, facultyList]);

  // Available Teaching Departments List (excluding AS as teaching dept if applicable)
  const availableTeachingDepts = useMemo(() => {
    const list = departmentsList.filter((d) => d.code !== 'AS');
    if (list.length === 0) {
      return FALLBACK_DEPARTMENTS.filter((d) => d.code !== 'AS');
    }
    return list;
  }, [departmentsList]);

  // Check if Assign button should be enabled (REQUIREMENT 24)
  const isAssignEnabled =
    selectedTeachingDepts.size > 0 &&
    Boolean(selectedCoreDeptId) &&
    Boolean(selectedFacultyId) &&
    selectedSectionKeys.size > 0 &&
    !submitting;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* ── Return to Cohort Breadcrumb ────────────────────────────────────── */}
      {searchParams.get('semester') && (
        <div className="flex items-center justify-between">
          <Link
            to={`/hod/students/semesters/${searchParams.get('semester')}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-xs hover:shadow-sm transition-all cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-blue-600 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Semester {searchParams.get('semester')} Cohort</span>
          </Link>
        </div>
      )}

      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl shadow-md flex items-center justify-between transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <p className="font-medium text-sm">{notification.message}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Header & Department/Branch Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 mt-0.5">
                Subject-to-Faculty allocation workflow • <span className="font-semibold text-indigo-600">{deptName}</span> ({activeAY})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <Building2 className="w-4 h-4 text-slate-500 ml-2" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Branch:</span>
            {isAppliedScience ? (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                {branchesList.length > 0 ? (
                  branchesList.map((b) => (
                    <option key={b.branchCode} value={b.branchCode}>
                      {b.branchCode} - {b.branchName}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="CSE">CSE - Computer Science & Engineering</option>
                    <option value="CSE-AIML">CSE-AIML - Computer Science & Engineering (AIML)</option>
                    <option value="ME">ME - Mechanical Engineering</option>
                    <option value="ECE">ECE - Electronics & Communication</option>
                    <option value="CV">CV - Civil Engineering</option>
                  </>
                )}
              </select>
            ) : (
              <span className="px-3 py-1 bg-white text-indigo-950 font-bold text-xs rounded-lg border border-slate-200">
                {deptCode}
              </span>
            )}
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center space-x-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Applied Science Cycle Switcher (If AS Dept) */}
      {isAppliedScience && (selectedSemester === 1 || selectedSemester === 2) && (
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-900 p-4 rounded-2xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Layers className="w-6 h-6 text-indigo-400" />
            <div>
              <h3 className="font-bold text-base">Applied Science Curriculum Cycle</h3>
              <p className="text-xs text-indigo-200">
                Filter subjects and sections for Physics Cycle or Chemistry Cycle
              </p>
            </div>
          </div>
          <div className="flex bg-white/10 p-1.5 rounded-xl backdrop-blur-md border border-white/10">
            <button
              onClick={() => setSelectedCycle('P_CYCLE')}
              className={`px-5 py-2 rounded-lg font-semibold text-xs transition cursor-pointer ${
                selectedCycle === 'P_CYCLE'
                  ? 'bg-white text-indigo-950 shadow-md'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              PHYSICS CYCLE (P-CYCLE)
            </button>
            <button
              onClick={() => setSelectedCycle('C_CYCLE')}
              className={`px-5 py-2 rounded-lg font-semibold text-xs transition cursor-pointer ${
                selectedCycle === 'C_CYCLE'
                  ? 'bg-white text-indigo-950 shadow-md'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              CHEMISTRY CYCLE (C-CYCLE)
            </button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Subjects</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {!isAppliedScience && (selectedSemester === 1 || selectedSemester === 2) ? '0' : totalSubjectsCount}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {!isAppliedScience && (selectedSemester === 1 || selectedSemester === 2)
                ? 'Handled by Applied Science'
                : `Semester ${selectedSemester} (${currentBranchCode})`}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Assigned Subjects</p>
            <h3 className="text-2xl font-extrabold text-emerald-950 mt-1">
              {!isAppliedScience && (selectedSemester === 1 || selectedSemester === 2) ? '0' : assignedSubjectsCount}
            </h3>
            <p className="text-xs text-emerald-600 mt-0.5">
              {!isAppliedScience && (selectedSemester === 1 || selectedSemester === 2)
                ? 'Handled by AS Dept'
                : 'Active teaching allocations'}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Partially Covered</p>
            <h3 className="text-2xl font-extrabold text-amber-950 mt-1">
              {!isAppliedScience && (selectedSemester === 1 || selectedSemester === 2) ? '0' : partialSubjectsCount}
            </h3>
            <p className="text-xs text-amber-600 mt-0.5">
              {!isAppliedScience && (selectedSemester === 1 || selectedSemester === 2)
                ? 'Handled by AS Dept'
                : 'Some sections allocated'}
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Unassigned</p>
            <h3 className="text-2xl font-extrabold text-rose-950 mt-1">
              {!isAppliedScience && (selectedSemester === 1 || selectedSemester === 2) ? '0' : unassignedSubjectsCount}
            </h3>
            <p className="text-xs text-rose-600 mt-0.5">
              {!isAppliedScience && (selectedSemester === 1 || selectedSemester === 2)
                ? 'Handled by AS Dept'
                : 'Needs faculty allocation'}
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Semester Navigation Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex space-x-2 min-w-max">
          {(isAppliedScience ? [1, 2] : [1, 2, 3, 4, 5, 6, 7, 8]).map((sem) => {
            const isActive = selectedSemester === sem;
            const isAsManaged = !isAppliedScience && (sem === 1 || sem === 2);
            return (
              <button
                key={sem}
                onClick={() => {
                  setSelectedSemester(sem);
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('semester', sem.toString());
                  setSearchParams(newParams, { replace: true });
                }}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition flex items-center space-x-2 cursor-pointer ${
                  isActive
                    ? 'bg-[#111111] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>Semester {sem}</span>
                {isAsManaged && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    AS
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search subject title or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Subject Types</option>
              <option value="THEORY">Theory Only</option>
              <option value="LAB">Lab / Practical</option>
              <option value="PROJECT">Project / Seminar</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium px-3 py-2 bg-slate-100 rounded-xl">
            Showing <span className="font-bold text-slate-900">{!isAppliedScience && (selectedSemester === 1 || selectedSemester === 2) ? 0 : totalSubjectsCount}</span> subjects
          </div>
        </div>
      </div>

      {/* Main Subject Cards List (REQUIREMENT 15) */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-slate-600 font-medium text-sm">Loading master subjects and section allocations...</p>
        </div>
      ) : !isAppliedScience && (selectedSemester === 1 || selectedSemester === 2) ? (
        <div className="bg-white p-12 md:p-16 rounded-2xl border border-indigo-100 shadow-xs text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100/80 shadow-xs">
            <Building2 className="w-8 h-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Applied Science Department
          </span>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Handled by Applied Science Department
          </h3>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-lg mx-auto">
            1st and 2nd Semester subjects and teaching allocations for <strong>{deptName} ({currentBranchCode})</strong> are handled by the <strong>Applied Science (AS) Department</strong>.
          </p>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No Subjects Found</h3>
          <p className="text-sm text-slate-500 mt-1">
            No active master subjects configured for Semester {selectedSemester} ({currentBranchCode})
            {isAppliedScience ? ` • ${selectedCycle === 'P_CYCLE' ? 'P Cycle' : 'C Cycle'}` : ''}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubjects.map((subject) => {
            const subjectAllocations = getSubjectAllocations(subject);
            const isAssigned = subjectAllocations.length > 0;

            return (
              <div
                key={subject.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition p-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Subject Details */}
                  <div className="space-y-2 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-1 bg-slate-900 text-white font-mono text-xs font-bold rounded-lg tracking-wider">
                        {subject.code}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          subject.type === 'LAB'
                            ? 'bg-purple-100 text-purple-700'
                            : subject.type === 'PROJECT'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {subject.type || 'THEORY'}
                      </span>
                      {subject.credits && (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                          {subject.credits} Credits
                        </span>
                      )}
                      {subject.cycle && (
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                          {subject.cycle === 'P_CYCLE' ? 'P-Cycle' : 'C-Cycle'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">{subject.name}</h3>

                    {/* Coverage Status Badge */}
                    <div className="flex items-center space-x-2 pt-1">
                      {subjectAllocations.length === 0 ? (
                        <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Unassigned (Needs Faculty)</span>
                        </span>
                      ) : ((departmentSectionsMap[currentBranchCode] || departmentSectionsMap[selectedBranch])?.length > 0 && subjectAllocations.length < (departmentSectionsMap[currentBranchCode] || departmentSectionsMap[selectedBranch])?.length) ? (
                        <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Partially Covered ({subjectAllocations.length}/{(departmentSectionsMap[currentBranchCode] || departmentSectionsMap[selectedBranch])?.length} Sections)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Assigned ({subjectAllocations.length} Section Allocations)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Section Allocations Preview Badges across all teaching departments */}
                  <div className="flex-1 lg:max-w-md bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                      <span>Assigned Sections & Faculty</span>
                      <span className="text-indigo-600 font-bold">{subjectAllocations.length} Assigned</span>
                    </h4>

                    {subjectAllocations.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No faculty assigned to any section yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {(() => {
                          // Group allocations by teaching department / branch
                          const grouped: Record<string, HodFacultyAssignmentItem[]> = {};
                          subjectAllocations.forEach((alloc) => {
                            const deptKey = (alloc.branch || alloc.departmentCode || 'General').toUpperCase();
                            if (!grouped[deptKey]) grouped[deptKey] = [];
                            grouped[deptKey].push(alloc);
                          });

                          const deptKeys = Object.keys(grouped);
                          const hasMultipleDepts = deptKeys.length > 1;

                          return deptKeys.map((deptKey) => (
                            <div key={deptKey} className="space-y-1">
                              {hasMultipleDepts && (
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-1">
                                  {deptKey}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {grouped[deptKey].map((alloc) => (
                                  <div
                                    key={alloc.id}
                                    className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium flex items-center justify-between space-x-2 shadow-xs"
                                  >
                                    <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">
                                      {!hasMultipleDepts && alloc.branch && alloc.branch !== 'AS' ? (
                                        <span className="mr-1 text-indigo-500 font-black">{alloc.branch}</span>
                                      ) : null}
                                      Sec {alloc.section || 'A'}
                                    </span>
                                    <span className="text-slate-800 font-semibold">{alloc.facultyName}</span>
                                    <div className="flex items-center space-x-1.5 ml-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenTransferModal(alloc, subject)}
                                        className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer border border-indigo-200/80 flex items-center space-x-1"
                                        title={`Change Faculty for ${alloc.branch || ''} Section ${alloc.section}`}
                                      >
                                        <ArrowRightLeft className="w-3 h-3" />
                                        <span>Change Faculty</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenHistoryModal(alloc, subject)}
                                        className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer flex items-center space-x-0.5"
                                        title={`View History for ${alloc.branch || ''} Section ${alloc.section}`}
                                      >
                                        <History className="w-3 h-3" />
                                        <span>History</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenUnallocateModal(alloc, subject, deptKey)}
                                        className="text-slate-400 hover:text-rose-600 p-0.5 hover:bg-rose-50 rounded transition cursor-pointer flex items-center justify-center"
                                        title={`Unallocate ${alloc.facultyName} from ${deptKey || alloc.branch || ''} Section ${alloc.section}`}
                                        aria-label={`Unallocate faculty from section ${alloc.section}`}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => handleOpenModal(subject)}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white font-medium text-sm rounded-xl hover:opacity-95 transition shadow-sm flex items-center space-x-2 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Manage Allocation</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ALLOCATION MODAL (REQUIREMENTS 1, 2, 3, 4, 5, 6, 9, 13, 14, 24) */}
      {activeModalSubject &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-indigo-500 text-white font-mono text-xs font-bold rounded">
                      {activeModalSubject.code}
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">• {activeModalSubject.credits || 4} Credits</span>
                    <span className="text-xs text-slate-300 font-semibold">• Semester {selectedSemester}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1.5">{activeModalSubject.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Academic Year {activeAY}</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body (REQUIREMENT 1 & 14: NO CURRENT SECTION ALLOCATIONS SUMMARY BLOCK HERE!) */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
                <form onSubmit={handleAssignSubmit} className="space-y-6">
                  {/* STEP 1: TEACHING DEPARTMENT (REQUIREMENTS 3 & 4) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
                            1
                          </span>
                          <span>TEACHING DEPARTMENT *</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Select where this subject will be taught. (Check at least one)
                        </p>
                      </div>
                      {selectedTeachingDepts.size > 0 && (
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          {selectedTeachingDepts.size} Selected
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {availableTeachingDepts.map((dept) => {
                        const isChecked = selectedTeachingDepts.has(dept.code);
                        return (
                          <div
                            key={dept.code}
                            onClick={() => toggleTeachingDept(dept.code)}
                            className={`p-3.5 rounded-xl border transition flex items-center space-x-3 cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-50/90 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-500/20'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300 flex-shrink-0" />
                            )}
                            <div>
                              <span className="font-extrabold text-xs block text-slate-900">
                                {dept.code}
                              </span>
                              <span className="text-[11px] text-slate-500 block font-normal">
                                {dept.name}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 2: FACULTY CORE DEPARTMENT (REQUIREMENTS 5, 6, 20, 22) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div>
                      <h3 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
                          2
                        </span>
                        <span>FACULTY CORE DEPARTMENT *</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select the faculty's permanent/core department.
                      </p>
                    </div>

                    <select
                      value={selectedCoreDeptId}
                      onChange={(e) => handleCoreDeptChange(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">-- Select Core Department --</option>
                      {departmentsList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code} — {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* STEP 3: FACULTY MEMBER (REQUIREMENTS 5, 6, 8, 21) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div>
                      <h3 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
                          3
                        </span>
                        <span>FACULTY MEMBER *</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Only active faculty belonging to the selected core department will appear.
                      </p>
                    </div>

                    <select
                      value={selectedFacultyId}
                      onChange={(e) => setSelectedFacultyId(e.target.value)}
                      disabled={!selectedCoreDeptId}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                    >
                      {!selectedCoreDeptId ? (
                        <option value="">-- Select Core Department First --</option>
                      ) : eligibleFacultyList.length === 0 ? (
                        <option value="">
                          -- No active {selectedCoreDeptObj?.code || ''} faculty available --
                        </option>
                      ) : (
                        <>
                          <option value="">-- Select Faculty Member --</option>
                          {eligibleFacultyList.map((fac) => (
                            <option key={fac.id} value={fac.id}>
                              {fac.name} ({getFacultyDisplayRole(fac)})
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  {/* STEP 4: SECTIONS GROUPED BY TEACHING DEPARTMENT (REQUIREMENTS 9, 10, 11, 12) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div>
                      <h3 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
                          4
                        </span>
                        <span>SECTIONS *</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select the actual sections where this faculty will teach.
                      </p>
                    </div>

                    {selectedTeachingDepts.size === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2">
                        <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>Please select at least one Teaching Department in STEP 1 to view sections.</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Array.from(selectedTeachingDepts).map((dCode) => {
                          const rawSecList =
                            departmentSectionsMap[dCode] ||
                            (dCode === 'CSE-AIML' ? departmentSectionsMap['AIML'] : undefined) ||
                            (dCode === 'AIML' ? departmentSectionsMap['CSE-AIML'] : undefined) ||
                            [];
                          
                          // Deduplicate sections by clean code (e.g. 'Section A' and 'A' -> single 'Section A')
                          const seenCodes = new Set<string>();
                          const secList: HodSectionItem[] = [];
                          rawSecList.forEach((s) => {
                            let clean = s.name.replace(/^(Section|Sec|Division|Div)\s*/i, '').trim().toUpperCase();
                            if (!clean) clean = s.name.trim().toUpperCase();
                            if (!seenCodes.has(clean)) {
                              seenCodes.add(clean);
                              secList.push({
                                ...s,
                                name: `Section ${clean}`,
                              });
                            }
                          });

                          const currentAllocations = activeModalSubject ? getSubjectAllocations(activeModalSubject) : [];

                          return (
                            <div key={dCode} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center space-x-2">
                                  <span>{dCode} Sections</span>
                                </h4>
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {secList.length} {secList.length === 1 ? 'Section' : 'Sections'} Found
                                </span>
                              </div>

                              {secList.length === 0 ? (
                                <p className="text-xs text-amber-700 italic py-1">
                                  No sections created for {dCode} in Section Allocation.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                  {secList.map((sec) => {
                                    let cleanCode = sec.name.replace(/^(Section|Sec|Division|Div)\s*/i, '').trim().toUpperCase();
                                    if (!cleanCode) cleanCode = sec.name;

                                    const key = `${dCode}:${cleanCode}`;

                                    // Match against existing active allocations for this subject
                                    const matchingAlloc = currentAllocations.find((a) => {
                                      // 1. Exact canonical sectionId match
                                      if (a.sectionId && sec.id && a.sectionId === sec.id) {
                                        return true;
                                      }
                                      // 2. Matching Teaching Department + Section code
                                      const aDeptCode = (a.branch || a.departmentCode || '').trim().toUpperCase();
                                      const targetDCode = dCode.trim().toUpperCase();
                                      const deptMatch =
                                        aDeptCode === targetDCode ||
                                        (targetDCode === 'CSE-AIML' && aDeptCode === 'AIML') ||
                                        (targetDCode === 'AIML' && aDeptCode === 'CSE-AIML');

                                      if (!deptMatch) return false;

                                      const aSecCode = (a.section || '').replace(/^(Section|Sec|Division|Div)\s*/i, '').trim().toUpperCase();
                                      return aSecCode === cleanCode;
                                    });

                                    const isAssigned = Boolean(matchingAlloc);
                                    const assignedFac = matchingAlloc?.facultyName;
                                    const isChecked = selectedSectionKeys.has(key);

                                    if (isAssigned) {
                                      return (
                                        <div
                                          key={sec.id}
                                          className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500 opacity-90"
                                        >
                                          <div className="flex items-center space-x-2">
                                            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            <div>
                                              <span className="font-bold text-slate-700">{sec.name}</span>
                                              <span className="text-[11px] text-slate-400 block">{sec.studentCount || 40} Students</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-[11px] font-medium text-slate-500 italic">
                                              Assigned to {assignedFac}
                                            </span>
                                            {matchingAlloc && (
                                              <div className="flex items-center space-x-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    handleCloseModal();
                                                    handleOpenTransferModal(matchingAlloc, activeModalSubject);
                                                  }}
                                                  className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer border border-indigo-200/80 flex items-center space-x-1"
                                                  title={`Change Faculty for ${sec.name}`}
                                                >
                                                  <ArrowRightLeft className="w-3 h-3" />
                                                  <span>Change Faculty</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    handleCloseModal();
                                                    handleOpenUnallocateModal(matchingAlloc, activeModalSubject, dCode);
                                                  }}
                                                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer border border-rose-200/80 flex items-center space-x-1"
                                                  title={`Unallocate Faculty for ${sec.name}`}
                                                >
                                                  <UserX className="w-3 h-3" />
                                                  <span>Unallocate</span>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <label
                                        key={sec.id}
                                        onClick={() => toggleSectionKey(key)}
                                        className={`p-3 rounded-xl border transition flex items-center justify-between cursor-pointer text-xs font-semibold ${
                                          isChecked
                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}
                                      >
                                        <div className="flex items-center space-x-3">
                                          {isChecked ? (
                                            <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                          ) : (
                                            <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                          )}
                                          <div>
                                            <span className="font-bold text-slate-900">{sec.name}</span>
                                            <span className="text-[11px] text-slate-500 block font-normal">{sec.studentCount || 40} Students</span>
                                          </div>
                                        </div>
                                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                          Available
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* STEP 5: ASSIGNMENT SUMMARY PREVIEW */}
                  {(selectedFacultyObj || selectedSectionKeys.size > 0) && (
                    <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 text-xs space-y-2">
                      <h4 className="font-bold text-indigo-950 uppercase tracking-wider text-[11px]">
                        Assignment Summary
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Faculty</span>
                          <span className="font-bold text-slate-900">
                            {selectedFacultyObj?.name || 'Not selected'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Core Dept</span>
                          <span className="font-bold text-slate-900">
                            {selectedCoreDeptObj?.code || 'Not selected'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Teaching Depts</span>
                          <span className="font-bold text-slate-900">
                            {Array.from(selectedTeachingDepts).join(', ') || 'None'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Sections</span>
                          <span className="font-bold text-indigo-700">
                            {selectedSectionKeys.size} Selected
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modal Footer / Actions (REQUIREMENT 13 & 24) */}
                  <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-200 sticky bottom-0 bg-slate-50/50 pb-2">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-sm font-semibold hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isAssignEnabled}
                      className="px-6 py-2.5 bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white text-sm font-bold rounded-xl hover:opacity-95 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Assigning Faculty...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>
                            {selectedSectionKeys.size > 0
                              ? `Assign Faculty (${selectedSectionKeys.size} ${
                                  selectedSectionKeys.size === 1 ? 'Section' : 'Sections'
                                })`
                              : 'Assign Faculty'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* CHANGE FACULTY MODAL */}
      {transferTarget &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
                    <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                    <span>CHANGE FACULTY</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Transfer teaching allocation to another faculty</p>
                </div>
                <button
                  onClick={handleCloseTransferModal}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleTransferSubmit} className="p-6 space-y-4 bg-slate-50/50">
                {/* Subject & Section Info */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Subject:
                    </label>
                    <p className="text-sm font-bold text-slate-900">{transferTarget.subject.name}</p>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      {transferTarget.subject.code} • Semester {selectedSemester}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Section:
                      </label>
                      <span className="inline-block mt-0.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200/60">
                        Section {transferTarget.allocation.section || 'A'}
                        {transferTarget.allocation.branch ? ` (${transferTarget.allocation.branch})` : ''}
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Current Faculty:
                      </label>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {transferTarget.allocation.facultyName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transfer Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Transfer Date: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">
                    Previous faculty allocation ends on the day before. New faculty assignment begins on this date.
                  </p>
                </div>

                {/* New Faculty Core Department */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    New Faculty Core Department: <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={transferCoreDeptId}
                    onChange={(e) => handleTransferCoreDeptChange(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Select Core Department --</option>
                    {departmentsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* New Faculty */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    New Faculty: <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={transferFacultyId}
                    onChange={(e) => setTransferFacultyId(e.target.value)}
                    disabled={!transferCoreDeptId}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                  >
                    {!transferCoreDeptId ? (
                      <option value="">-- Select Core Department First --</option>
                    ) : transferEligibleFacultyList.length === 0 ? (
                      <option value="">
                        -- No active {transferTargetDeptObj?.code || ''} faculty available --
                      </option>
                    ) : (
                      <>
                        <option value="">-- Select Faculty --</option>
                        {transferEligibleFacultyList.map((fac) => (
                          <option key={fac.id} value={fac.id}>
                            {fac.name} ({getFacultyDisplayRole(fac)})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Reason: <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="WORKLOAD_REBALANCING">Workload Rebalancing</option>
                    <option value="FACULTY_LEFT">Faculty Left / Resigned</option>
                    <option value="LEAVE_OF_ABSENCE">Medical / Extended Leave of Absence</option>
                    <option value="DEPARTMENT_TRANSFER">Department Reassignment</option>
                    <option value="OTHER">Other Administrative Reason</option>
                  </select>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleCloseTransferModal}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!transferCoreDeptId || !transferFacultyId || !transferDate || transferSubmitting}
                    className="px-5 py-2 bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white text-xs font-bold rounded-xl hover:opacity-95 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2 cursor-pointer"
                  >
                    {transferSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Transferring...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Transfer Faculty</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* FACULTY ALLOCATION HISTORY MODAL */}
      {historyTarget &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
                    <History className="w-5 h-5 text-indigo-400" />
                    <span>FACULTY HISTORY</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {historyTarget.subject.name} • Section {historyTarget.allocation.section || 'A'}
                  </p>
                </div>
                <button
                  onClick={handleCloseHistoryModal}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 bg-slate-50/50 max-h-[70vh] overflow-y-auto">
                {historyLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Loading allocation history...</p>
                  </div>
                ) : historyRecords.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">
                    No historical assignments recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyRecords.map((item, idx) => {
                      const isActive = item.status === 'ACTIVE';
                      const startStr = item.startDate ? item.startDate.split('T')[0] : (item.createdAt ? item.createdAt.split('T')[0] : 'Start');
                      const endStr = item.endDate ? item.endDate.split('T')[0] : (isActive ? 'Present' : 'Ended');
                      return (
                        <div
                          key={item.id || idx}
                          className={`p-3.5 rounded-xl border ${
                            isActive
                              ? 'bg-emerald-50/80 border-emerald-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">{item.facultyName}</span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-1 flex items-center space-x-1.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{startStr} → {endStr}</span>
                          </div>
                          {item.transferReason && (
                            <div className="text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-100">
                              <span className="font-bold text-slate-500 uppercase text-[10px]">Reason: </span>
                              <span>{item.transferReason.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
                <button
                  onClick={handleCloseHistoryModal}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* SAFE UNALLOCATE FACULTY CONFIRMATION MODAL */}
      {unallocateTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={handleCloseUnallocateModal}
          >
            <div
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
                    <UserX className="w-5 h-5 text-rose-400" />
                    <span>UNALLOCATE FACULTY</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Safe faculty unallocation from teaching section
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseUnallocateModal}
                  disabled={unallocating}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 bg-slate-50/50">
                {/* Details Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Subject
                    </label>
                    <p className="text-sm font-bold text-slate-900">
                      {unallocateTarget.subject.name}
                    </p>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      {unallocateTarget.subject.code} • Semester {selectedSemester}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Teaching Department
                      </label>
                      <span className="inline-block mt-0.5 px-2.5 py-1 bg-slate-100 text-slate-800 font-bold text-xs rounded-lg border border-slate-200">
                        {unallocateTarget.teachingDepartment ||
                          unallocateTarget.allocation.branch ||
                          unallocateTarget.allocation.departmentCode ||
                          deptCode}
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Section
                      </label>
                      <span className="inline-block mt-0.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200/60">
                        Section {unallocateTarget.allocation.section || 'A'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Currently Assigned Faculty
                    </label>
                    <p className="text-xs font-bold text-slate-800 mt-1 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      <span>{unallocateTarget.allocation.facultyName}</span>
                    </p>
                  </div>
                </div>

                {/* Safe Preservation Notice / Warning */}
                <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-900">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold leading-relaxed">
                      Are you sure you want to unallocate this faculty member from this section?
                      The section will become available for reassignment. Existing student attendance,
                      marks, and historical records will be preserved.
                    </p>
                    <p className="text-[11px] text-amber-700 font-medium">
                      Warning: The active faculty assignment will be ended. Students and attendance records will not be deleted.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseUnallocateModal}
                  disabled={unallocating}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnallocate}
                  disabled={unallocating}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {unallocating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Unallocating...</span>
                    </>
                  ) : (
                    <>
                      <UserX className="w-3.5 h-3.5" />
                      <span>Confirm Unallocation</span>
                    </>
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

export default HodFacultyAssignmentsPage;
