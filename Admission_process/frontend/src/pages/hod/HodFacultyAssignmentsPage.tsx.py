import os

code = '''import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import {
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Award,
  Layers,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Building2,
  X,
  Lock,
  Edit2,
  CheckSquare,
  Square,
  AlertTriangle,
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
  branch?: string;
  departmentId?: string;
  academicYear: string;
  attendanceAccess?: boolean;
  marksAccess?: boolean;
  status: string;
}

interface DepartmentOption {
  code: string;
  name: string;
}

const ALL_DEPARTMENTS: DepartmentOption[] = [
  { code: 'CSE', name: 'Computer Science & Engineering' },
  { code: 'AIML', name: 'AI & Machine Learning' },
  { code: 'ECE', name: 'Electronics & Comm Engg' },
  { code: 'ME', name: 'Mechanical Engineering' },
  { code: 'CV', name: 'Civil Engineering' },
  { code: 'AS', name: 'Applied Science' },
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
  const [selectedBranch, setSelectedBranch] = useState<string>('CSE');

  // Filters & Tabs State
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [selectedCycle, setSelectedCycle] = useState<'P_CYCLE' | 'C_CYCLE'>('P_CYCLE');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Core Data States
  const [subjects, setSubjects] = useState<HodSubjectItem[]>([]);
  const [facultyList, setFacultyList] = useState<HodFacultyItem[]>([]);
  const [assignments, setAssignments] = useState<HodFacultyAssignmentItem[]>([]);
  const [departmentSectionsMap, setDepartmentSectionsMap] = useState<Record<string, HodSectionItem[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [activeModalSubject, setActiveModalSubject] = useState<HodSubjectItem | null>(null);

  // Modal Workflow State: Teaching Departments & Mode
  const [selectedTeachingDepts, setSelectedTeachingDepts] = useState<Set<string>>(new Set(['CSE']));
  const [assignmentMode, setAssignmentMode] = useState<'SAME_FACULTY' | 'DIFFERENT_FACULTY'>('SAME_FACULTY');

  // CASE 1: Same Faculty State
  const [sameCoreDept, setSameCoreDept] = useState<string>('AS');
  const [sameFacultyId, setSameFacultyId] = useState<string>('');
  const [selectedSectionKeys, setSelectedSectionKeys] = useState<Set<string>>(new Set()); // "DEPT:SEC_CODE"

  // CASE 2: Different Faculty by Department State
  // { [deptCode]: { coreDept: string, facultyId: string, sectionCodes: Set<string> } }
  const [diffDeptAssignments, setDiffDeptAssignments] = useState<
    Record<string, { coreDept: string; facultyId: string; sectionCodes: Set<string> }>
  >({});

  const [submitting, setSubmitting] = useState<boolean>(false);

  // Change Faculty Inline State (per section assignment)
  const [changingFacultySection, setChangingFacultySection] = useState<string | null>(null);
  const [newFacultyForSection, setNewFacultyForSection] = useState<string>('');
  const [reassigning, setReassigning] = useState<boolean>(false);

  // Auto-dismiss notification timer
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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
      const activeBranchParam = isAppliedScience ? selectedBranch : undefined;

      const [subjectsRes, facultyRes, assignmentsRes] = await Promise.all([
        hodService.getSubjects({ semester: selectedSemester, status: 'ACTIVE' }),
        hodService.getFacultyList(),
        hodService.getFacultyAssignments(undefined, activeAY),
      ]);

      setSubjects(subjectsRes || []);
      setFacultyList(facultyRes || []);
      setAssignments(assignmentsRes || []);

      // Fetch Sections for all relevant departments for this semester & AY
      const deptsToFetch = isAppliedScience
        ? ['CSE', 'AIML', 'ME', 'ECE', 'CV']
        : [deptCode];

      const secMap: Record<string, HodSectionItem[]> = {};
      await Promise.all(
        deptsToFetch.map(async (dCode) => {
          try {
            const secList = await hodService.getSections(selectedSemester, activeAY, dCode);
            secMap[dCode] = secList || [];
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

  // Map of Subject ID -> List of active FacultyAssignments
  const subjectAssignmentsMap = useMemo(() => {
    const map: Record<string, HodFacultyAssignmentItem[]> = {};
    assignments.forEach((a) => {
      if (a.status === 'ACTIVE' || !a.status) {
        if (!map[a.subjectId]) map[a.subjectId] = [];
        map[a.subjectId].push(a);
      }
    });
    return map;
  }, [assignments]);

  // Open allocation modal
  const handleOpenModal = (subj: HodSubjectItem) => {
    setActiveModalSubject(subj);
    setSelectedTeachingDepts(new Set([selectedBranch || 'CSE']));
    setAssignmentMode('SAME_FACULTY');
    setSameCoreDept(isAppliedScience ? 'AS' : deptCode);
    setSameFacultyId('');
    setSelectedSectionKeys(new Set());
    setDiffDeptAssignments({});
    setChangingFacultySection(null);
    setNewFacultyForSection('');
  };

  // Close allocation modal
  const handleCloseModal = () => {
    setActiveModalSubject(null);
    setSelectedSectionKeys(new Set());
    setDiffDeptAssignments({});
    setChangingFacultySection(null);
    setNewFacultyForSection('');
  };

  // Toggle Teaching Department checkbox in modal
  const toggleTeachingDept = (dCode: string) => {
    setSelectedTeachingDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dCode)) {
        if (next.size > 1) next.delete(dCode);
      } else {
        next.add(dCode);
      }
      return next;
    });
  };

  // Faculty filtering based on Core Department
  const getFacultyForCoreDept = (coreCode: string) => {
    if (!coreCode) return facultyList;
    return facultyList.filter((fac) => {
      const facDeptCode = fac.departmentCode || fac.departmentName || '';
      return (
        facDeptCode.toLowerCase().includes(coreCode.toLowerCase()) ||
        coreCode.toLowerCase().includes(facDeptCode.toLowerCase()) ||
        fac.departmentId === coreCode
      );
    });
  };

  // Handle section key toggle for Case 1 (Same Faculty)
  const toggleSameSectionKey = (key: string) => {
    setSelectedSectionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Handle section toggle for Case 2 (Different Faculty)
  const toggleDiffSectionKey = (dCode: string, secCode: string) => {
    setDiffDeptAssignments((prev) => {
      const deptObj = prev[dCode] || { coreDept: 'AS', facultyId: '', sectionCodes: new Set<string>() };
      const nextSecs = new Set(deptObj.sectionCodes);
      if (nextSecs.has(secCode)) nextSecs.delete(secCode);
      else nextSecs.add(secCode);

      return {
        ...prev,
        [dCode]: {
          ...deptObj,
          sectionCodes: nextSecs,
        },
      };
    });
  };

  // Update Core Dept for Case 2
  const setDiffCoreDept = (dCode: string, coreCode: string) => {
    setDiffDeptAssignments((prev) => ({
      ...prev,
      [dCode]: {
        ...(prev[dCode] || { facultyId: '', sectionCodes: new Set<string>() }),
        coreDept: coreCode,
        facultyId: '', // Reset faculty selection when core dept changes
      },
    }));
  };

  // Update Faculty ID for Case 2
  const setDiffFacultyId = (dCode: string, facId: string) => {
    setDiffDeptAssignments((prev) => ({
      ...prev,
      [dCode]: {
        ...(prev[dCode] || { coreDept: 'AS', sectionCodes: new Set<string>() }),
        facultyId: facId,
      },
    }));
  };

  // Submission handler for both Case 1 and Case 2
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalSubject) return;

    setSubmitting(true);
    let successCount = 0;
    let lastError = '';

    try {
      if (assignmentMode === 'SAME_FACULTY') {
        if (!sameFacultyId) {
          setNotification({ type: 'error', message: 'Please select a faculty member.' });
          setSubmitting(false);
          return;
        }
        if (selectedSectionKeys.size === 0) {
          setNotification({ type: 'error', message: 'Please select at least one section to assign.' });
          setSubmitting(false);
          return;
        }

        // Selected keys format: "DEPT_CODE:SECTION_CODE"
        const keysArr = Array.from(selectedSectionKeys);
        for (const key of keysArr) {
          const [dCode, secCode] = key.split(':');
          try {
            await hodService.assignFacultySubject(sameFacultyId, {
              subjectId: activeModalSubject.id,
              semester: selectedSemester,
              section: secCode,
              academicYear: activeAY,
              cycle: isAppliedScience ? selectedCycle : undefined,
              attendanceAccess: true,
              marksAccess: true,
            });
            successCount++;
          } catch (err: any) {
            lastError = err.response?.data?.error || `Failed to assign ${dCode} Section ${secCode}`;
          }
        }
      } else {
        // CASE 2: Different Faculty by Department
        const deptsArr = Array.from(selectedTeachingDepts);
        for (const dCode of deptsArr) {
          const deptData = diffDeptAssignments[dCode];
          if (deptData && deptData.facultyId && deptData.sectionCodes.size > 0) {
            const secCodesArr = Array.from(deptData.sectionCodes);
            for (const secCode of secCodesArr) {
              try {
                await hodService.assignFacultySubject(deptData.facultyId, {
                  subjectId: activeModalSubject.id,
                  semester: selectedSemester,
                  section: secCode,
                  academicYear: activeAY,
                  cycle: isAppliedScience ? selectedCycle : undefined,
                  attendanceAccess: true,
                  marksAccess: true,
                });
                successCount++;
              } catch (err: any) {
                lastError = err.response?.data?.error || `Failed to assign ${dCode} Section ${secCode}`;
              }
            }
          }
        }
      }

      if (successCount > 0) {
        setNotification({
          type: 'success',
          message: `Successfully created ${successCount} teaching allocation(s) for ${activeModalSubject.name}. Attendance & Marks permissions granted automatically.`,
        });
        await loadData();
        setSelectedSectionKeys(new Set());
        setSameFacultyId('');
        setDiffDeptAssignments({});
      } else {
        setNotification({
          type: 'error',
          message: lastError || 'Failed to assign faculty. Please verify your selections.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'An unexpected error occurred.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle unassigning a section allocation
  const handleUnassignSection = async (assignmentId: string, sectionCode: string) => {
    if (!window.confirm(`Are you sure you want to unassign Section ${sectionCode}?`)) return;

    try {
      await hodService.deleteFacultyAssignment(assignmentId);
      setNotification({
        type: 'success',
        message: `Section ${sectionCode} allocation removed successfully.`,
      });
      await loadData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to remove allocation.',
      });
    }
  };

  // Handle changing faculty for an assigned section
  const handleChangeFacultySubmit = async (sectionCode: string, oldAssignmentId: string) => {
    if (!activeModalSubject || !newFacultyForSection) {
      setNotification({ type: 'error', message: 'Please select a new faculty member.' });
      return;
    }

    setReassigning(true);
    try {
      await hodService.deleteFacultyAssignment(oldAssignmentId);
      await hodService.assignFacultySubject(newFacultyForSection, {
        subjectId: activeModalSubject.id,
        semester: selectedSemester,
        section: sectionCode,
        academicYear: activeAY,
        cycle: isAppliedScience ? selectedCycle : undefined,
        attendanceAccess: true,
        marksAccess: true,
      });

      setNotification({
        type: 'success',
        message: `Reassigned Section ${sectionCode} successfully.`,
      });
      setChangingFacultySection(null);
      setNewFacultyForSection('');
      await loadData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to reassign section.',
      });
    } finally {
      setReassigning(false);
    }
  };

  // Calculate Coverage Statistics
  const totalSubjectsCount = filteredSubjects.length;
  const { assignedSubjectsCount, partialSubjectsCount, unassignedSubjectsCount } = useMemo(() => {
    let full = 0;
    let partial = 0;
    let unassigned = 0;

    filteredSubjects.forEach((subj) => {
      const allocs = subjectAssignmentsMap[subj.id] || [];
      if (allocs.length === 0) {
        unassigned++;
      } else {
        full++;
      }
    });

    return {
      assignedSubjectsCount: full,
      partialSubjectsCount: partial,
      unassignedSubjectsCount: unassigned,
    };
  }, [filteredSubjects, subjectAssignmentsMap]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
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
            className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
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
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teaching Allocation</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Assign subjects to faculty section-by-section • <span className="font-semibold text-indigo-600">{deptName}</span> ({activeAY})
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
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {branchesList.length > 0 ? (
                  branchesList.map((b) => (
                    <option key={b.branchCode} value={b.branchCode}>
                      {b.branchCode} - {b.branchName}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="CSE">CSE - Computer Science</option>
                    <option value="AIML">AIML - AI & Machine Learning</option>
                    <option value="ME">ME - Mechanical Engg</option>
                    <option value="ECE">ECE - Electronics & Comm</option>
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
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center space-x-2"
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
              className={`px-5 py-2 rounded-lg font-semibold text-xs transition ${
                selectedCycle === 'P_CYCLE'
                  ? 'bg-white text-indigo-950 shadow-md'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              PHYSICS CYCLE (P-CYCLE)
            </button>
            <button
              onClick={() => setSelectedCycle('C_CYCLE')}
              className={`px-5 py-2 rounded-lg font-semibold text-xs transition ${
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

      {/* 4 Statistics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Subjects</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{totalSubjectsCount}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Semester {selectedSemester} ({selectedBranch})</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Assigned Subjects</p>
            <h3 className="text-2xl font-extrabold text-emerald-950 mt-1">{assignedSubjectsCount}</h3>
            <p className="text-xs text-emerald-600 mt-0.5">Active teaching allocations</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Partially Covered</p>
            <h3 className="text-2xl font-extrabold text-amber-950 mt-1">{partialSubjectsCount}</h3>
            <p className="text-xs text-amber-600 mt-0.5">Some sections allocated</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Unassigned</p>
            <h3 className="text-2xl font-extrabold text-rose-950 mt-1">{unassignedSubjectsCount}</h3>
            <p className="text-xs text-rose-600 mt-0.5">Needs faculty allocation</p>
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
            return (
              <button
                key={sem}
                onClick={() => setSelectedSemester(sem)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition flex items-center space-x-2 ${
                  isActive
                    ? 'bg-[#111111] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>Semester {sem}</span>
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
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Subject Types</option>
              <option value="THEORY">Theory Only</option>
              <option value="LAB">Lab / Practical</option>
              <option value="PROJECT">Project / Seminar</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium px-3 py-2 bg-slate-100 rounded-xl">
            Showing <span className="font-bold text-slate-900">{totalSubjectsCount}</span> subjects
          </div>
        </div>
      </div>

      {/* Main Content Area: Subject Cards / Table */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-slate-600 font-medium text-sm">Loading master subjects and section allocations...</p>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No Subjects Found</h3>
          <p className="text-sm text-slate-500 mt-1">
            No active master subjects configured for Semester {selectedSemester} ({selectedBranch})
            {isAppliedScience ? ` • ${selectedCycle === 'P_CYCLE' ? 'P Cycle' : 'C Cycle'}` : ''}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubjects.map((subject) => {
            const subjectAllocations = subjectAssignmentsMap[subject.id] || [];
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

                    {/* Coverage Status Indicator */}
                    <div className="flex items-center space-x-2 pt-1">
                      {isAssigned ? (
                        <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Assigned ({subjectAllocations.length} Section Allocations)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Unassigned (Needs Faculty)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Section Allocations Preview Badges */}
                  <div className="flex-1 lg:max-w-md bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                      <span>Active Section Allocations</span>
                      <span className="text-indigo-600">{subjectAllocations.length} Assigned</span>
                    </h4>

                    {subjectAllocations.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No faculty assigned to any section yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {subjectAllocations.map((alloc) => (
                          <div
                            key={alloc.id}
                            className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium flex items-center space-x-2 shadow-xs"
                          >
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                              Sec {alloc.section || 'A'}
                            </span>
                            <span className="text-slate-800 font-semibold">{alloc.facultyName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => handleOpenModal(subject)}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white font-medium text-sm rounded-xl hover:opacity-95 transition shadow-sm flex items-center space-x-2"
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

      {/* ALLOCATION MODAL (Subject -> Teaching Departments -> Core Dept -> Faculty -> Sections) */}
      {activeModalSubject &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
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
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* 1. CURRENT SECTION ALLOCATIONS TABLE */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                    <span>Current Section Allocations</span>
                    <span className="text-xs text-slate-500 font-normal">
                      {(subjectAssignmentsMap[activeModalSubject.id] || []).length} assigned
                    </span>
                  </h3>

                  {(subjectAssignmentsMap[activeModalSubject.id] || []).length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                      No faculty assigned to any section for this subject yet.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="p-3">Section</th>
                            <th className="p-3">Assigned Faculty</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {(subjectAssignmentsMap[activeModalSubject.id] || []).map((alloc) => {
                            const secCode = alloc.section || 'A';
                            const isChanging = changingFacultySection === secCode;

                            return (
                              <tr key={alloc.id} className="hover:bg-slate-50/80 transition">
                                <td className="p-3 font-bold text-indigo-700">
                                  Section {secCode}
                                </td>
                                <td className="p-3">
                                  {isChanging ? (
                                    <div className="flex items-center space-x-2">
                                      <select
                                        value={newFacultyForSection}
                                        onChange={(e) => setNewFacultyForSection(e.target.value)}
                                        className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                                      >
                                        <option value="">Select New Faculty...</option>
                                        {facultyList.map((fac) => (
                                          <option key={fac.id} value={fac.id}>
                                            {fac.name} ({fac.departmentName || 'Faculty'})
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => handleChangeFacultySubmit(secCode, alloc.id)}
                                        disabled={reassigning || !newFacultyForSection}
                                        className="px-2.5 py-1 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                                      >
                                        {reassigning ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setChangingFacultySection(null);
                                          setNewFacultyForSection('');
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-600"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="font-semibold text-slate-900">{alloc.facultyName}</span>
                                      {alloc.facultyEmail && (
                                        <span className="text-slate-400 block text-[11px]">{alloc.facultyEmail}</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                                    ACTIVE
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  {!isChanging && (
                                    <div className="flex items-center justify-end space-x-2">
                                      <button
                                        onClick={() => {
                                          setChangingFacultySection(secCode);
                                          setNewFacultyForSection('');
                                        }}
                                        className="px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition font-medium text-xs flex items-center space-x-1"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        <span>Change Faculty</span>
                                      </button>
                                      <button
                                        onClick={() => handleUnassignSection(alloc.id, secCode)}
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                        title="Unassign section"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <hr className="border-slate-200" />

                {/* 2. NEW ASSIGNMENT FORM */}
                <form onSubmit={handleAssignSubmit} className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">
                      Assign Faculty to Sections
                    </h3>
                    <p className="text-xs text-slate-500">
                      Select teaching departments, faculty core department, and actual sections to assign.
                    </p>
                  </div>

                  {/* 1. TEACHING DEPARTMENTS CHECKBOXES */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      TEACHING DEPARTMENTS *
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {ALL_DEPARTMENTS.filter((d) => d.code !== 'AS').map((dept) => {
                        const isChecked = selectedTeachingDepts.has(dept.code);
                        return (
                          <label
                            key={dept.code}
                            onClick={() => toggleTeachingDept(dept.code)}
                            className={`px-4 py-2.5 rounded-xl border transition flex items-center space-x-2 cursor-pointer text-xs font-bold ${
                              isChecked
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                            )}
                            <span>{dept.code} ({dept.name})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. FACULTY ASSIGNMENT MODE */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      FACULTY ASSIGNMENT MODE
                    </label>
                    <div className="flex items-center space-x-6 text-xs font-semibold">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="assignmentMode"
                          checked={assignmentMode === 'SAME_FACULTY'}
                          onChange={() => setAssignmentMode('SAME_FACULTY')}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Same Faculty for Selected Departments</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="assignmentMode"
                          checked={assignmentMode === 'DIFFERENT_FACULTY'}
                          onChange={() => setAssignmentMode('DIFFERENT_FACULTY')}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Different Faculty by Department</span>
                      </label>
                    </div>
                  </div>

                  {/* MODE 1: SAME FACULTY FOR SELECTED DEPARTMENTS */}
                  {assignmentMode === 'SAME_FACULTY' && (
                    <div className="space-y-5 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Faculty Core Dept */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            FACULTY CORE DEPARTMENT *
                          </label>
                          <select
                            value={sameCoreDept}
                            onChange={(e) => {
                              setSameCoreDept(e.target.value);
                              setSameFacultyId('');
                            }}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            <option value="AS">Applied Science (AS)</option>
                            <option value="CSE">Computer Science & Engg (CSE)</option>
                            <option value="AIML">AI & Machine Learning (AIML)</option>
                            <option value="ECE">Electronics & Comm Engg (ECE)</option>
                            <option value="ME">Mechanical Engineering (ME)</option>
                            <option value="CV">Civil Engineering (CV)</option>
                          </select>
                        </div>

                        {/* Faculty Member */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            FACULTY MEMBER *
                          </label>
                          <select
                            value={sameFacultyId}
                            onChange={(e) => setSameFacultyId(e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            <option value="">-- Choose Faculty --</option>
                            {getFacultyForCoreDept(sameCoreDept).map((fac) => (
                              <option key={fac.id} value={fac.id}>
                                {fac.name} ({fac.departmentName || sameCoreDept})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Sections Grouped by Teaching Department */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          ACTUAL SECTIONS GROUPED BY DEPARTMENT
                        </label>

                        <div className="space-y-4">
                          {Array.from(selectedTeachingDepts).map((dCode) => {
                            const secList = departmentSectionsMap[dCode] || [];
                            const currentAllocations = subjectAssignmentsMap[activeModalSubject.id] || [];
                            const allocatedMap = new Map<string, string>();
                            currentAllocations.forEach((a) => {
                              if (a.section) allocatedMap.set(a.section.toUpperCase(), a.facultyName);
                            });

                            return (
                              <div key={dCode} className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center justify-between">
                                  <span>{dCode} Department Sections</span>
                                  <span className="text-slate-400 font-normal">{secList.length} sections found</span>
                                </h4>

                                {secList.length === 0 ? (
                                  <p className="text-xs text-amber-600 italic">No sections created for {dCode} in Section Allocation.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    {secList.map((sec) => {
                                      let cleanCode = sec.name.replace(/^(Section|Sec|Division|Div)\s*/i, '').trim().toUpperCase();
                                      if (!cleanCode) cleanCode = sec.name;

                                      const key = `${dCode}:${cleanCode}`;
                                      const isAssigned = allocatedMap.has(cleanCode);
                                      const assignedFac = allocatedMap.get(cleanCode);
                                      const isChecked = selectedSectionKeys.has(key);

                                      if (isAssigned) {
                                        return (
                                          <div
                                            key={sec.id}
                                            className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500 cursor-not-allowed opacity-80"
                                          >
                                            <div className="flex items-center space-x-2">
                                              <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                              <div>
                                                <span className="font-bold text-slate-700">{sec.name}</span>
                                                <span className="text-[11px] text-slate-400 block">{sec.studentCount || 40} Students</span>
                                              </div>
                                            </div>
                                            <span className="text-[11px] font-medium text-slate-500 italic">
                                              Assigned to {assignedFac}
                                            </span>
                                          </div>
                                        );
                                      }

                                      return (
                                        <label
                                          key={sec.id}
                                          onClick={() => toggleSameSectionKey(key)}
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
                      </div>
                    </div>
                  )}

                  {/* MODE 2: DIFFERENT FACULTY BY DEPARTMENT */}
                  {assignmentMode === 'DIFFERENT_FACULTY' && (
                    <div className="space-y-4">
                      {Array.from(selectedTeachingDepts).map((dCode) => {
                        const deptObj = diffDeptAssignments[dCode] || { coreDept: 'AS', facultyId: '', sectionCodes: new Set<string>() };
                        const secList = departmentSectionsMap[dCode] || [];
                        const currentAllocations = subjectAssignmentsMap[activeModalSubject.id] || [];
                        const allocatedMap = new Map<string, string>();
                        currentAllocations.forEach((a) => {
                          if (a.section) allocatedMap.set(a.section.toUpperCase(), a.facultyName);
                        });

                        return (
                          <div key={dCode} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <h4 className="font-extrabold text-sm text-indigo-950 uppercase tracking-wider">
                                {dCode} Department Allocation
                              </h4>
                              <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                                {dCode} Scope
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Core Dept */}
                              <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                  Faculty Core Department ({dCode}) *
                                </label>
                                <select
                                  value={deptObj.coreDept}
                                  onChange={(e) => setDiffCoreDept(dCode, e.target.value)}
                                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                  <option value="AS">Applied Science (AS)</option>
                                  <option value="CSE">Computer Science & Engg (CSE)</option>
                                  <option value="AIML">AI & Machine Learning (AIML)</option>
                                  <option value="ECE">Electronics & Comm Engg (ECE)</option>
                                  <option value="ME">Mechanical Engineering (ME)</option>
                                  <option value="CV">Civil Engineering (CV)</option>
                                </select>
                              </div>

                              {/* Faculty Member */}
                              <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                  Faculty Member ({dCode}) *
                                </label>
                                <select
                                  value={deptObj.facultyId}
                                  onChange={(e) => setDiffFacultyId(dCode, e.target.value)}
                                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                  <option value="">-- Choose {dCode} Faculty --</option>
                                  {getFacultyForCoreDept(deptObj.coreDept).map((fac) => (
                                    <option key={fac.id} value={fac.id}>
                                      {fac.name} ({fac.departmentName || deptObj.coreDept})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Section Checkboxes */}
                            <div>
                              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                {dCode} Sections
                              </label>
                              {secList.length === 0 ? (
                                <p className="text-xs text-amber-600 italic">No sections created for {dCode} in Section Allocation.</p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {secList.map((sec) => {
                                    let cleanCode = sec.name.replace(/^(Section|Sec|Division|Div)\s*/i, '').trim().toUpperCase();
                                    if (!cleanCode) cleanCode = sec.name;

                                    const isAssigned = allocatedMap.has(cleanCode);
                                    const assignedFac = allocatedMap.get(cleanCode);
                                    const isChecked = deptObj.sectionCodes.has(cleanCode);

                                    if (isAssigned) {
                                      return (
                                        <div
                                          key={sec.id}
                                          className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-500 cursor-not-allowed opacity-80"
                                        >
                                          <div className="flex items-center space-x-2">
                                            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            <div>
                                              <span className="font-bold text-slate-700">{sec.name}</span>
                                              <span className="text-[11px] text-slate-400 block">{sec.studentCount || 40} Students</span>
                                            </div>
                                          </div>
                                          <span className="text-[11px] font-medium text-slate-500 italic">
                                            Assigned to {assignedFac}
                                          </span>
                                        </div>
                                      );
                                    }

                                    return (
                                      <label
                                        key={sec.id}
                                        onClick={() => toggleDiffSectionKey(dCode, cleanCode)}
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
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Modal Footer / Actions */}
                  <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white text-sm font-bold rounded-xl hover:opacity-95 transition shadow-sm disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Assigning Faculty...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>Assign Faculty</span>
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
    </div>
  );
};

export default HodFacultyAssignmentsPage;
'''

target_file = r"e:\JCER-ERP-SYSTEM\Admission_process\frontend\src\pages\hod\HodFacultyAssignmentsPage.tsx"
with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print(f"Successfully wrote {len(code)} characters to {target_file}")
