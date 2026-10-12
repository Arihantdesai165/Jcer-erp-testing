import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  PlusCircle,
  Users,
  Layers,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  X,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Edit3,
  Search,
  Filter,
  Check,
  Settings,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'react-toastify';
import hodService, {
  HodSubjectItem,
  HodDepartmentSchemeData,
  APPLIED_SCIENCE_COURSE_CATEGORIES,
} from '../../services/hod.service';
import usePersistentState from '../../hooks/usePersistentState';
import usePersistentFormState from '../../hooks/usePersistentFormState';

export const HodSubjectsPage: React.FC = () => {
  // Scheme & Department Metadata
  const [schemeData, setSchemeData] = useState<HodDepartmentSchemeData | null>(null);
  const [schemeLoading, setSchemeLoading] = useState<boolean>(true);

  // First-time scheme setup dialog
  const [showFirstTimeSchemeModal, setShowFirstTimeSchemeModal] = useState<boolean>(false);
  const [selectedFirstScheme, setSelectedFirstScheme] = useState<string>('2025');
  const [savingFirstScheme, setSavingFirstScheme] = useState<boolean>(false);

  // Change Scheme controlled modal
  const [showChangeSchemeModal, setShowChangeSchemeModal] = useState<boolean>(false);
  const [newSchemeSelection, setNewSchemeSelection] = useState<string>('2025');
  const [confirmSchemeChange, setConfirmSchemeChange] = useState<boolean>(false);
  const [savingSchemeChange, setSavingSchemeChange] = useState<boolean>(false);

  // Subjects state
  const [subjects, setSubjects] = useState<HodSubjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [schemeError, setSchemeError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // URL Query Params
  const [searchParams, setSearchParams] = useSearchParams();

  // Applied Science 2-level filter states
  const [selectedCycle, setSelectedCycle] = usePersistentState<'P_CYCLE' | 'C_CYCLE'>('hod_subjects_cycle_filter', 'P_CYCLE');
  const [selectedAsSemester, setSelectedAsSemester] = usePersistentState<number>('hod_subjects_as_sem_filter', 1);

  // Non-Applied Science semester filter
  const [selectedStandardSemester, setSelectedStandardSemester] = usePersistentState<string>('hod_subjects_semester_filter', 'ALL');

  // Sync semester filter from URL query parameter (e.g. from Semester Cohort page)
  useEffect(() => {
    const semParam = searchParams.get('semester');
    if (semParam) {
      const parsed = parseInt(semParam, 10);
      if (!isNaN(parsed)) {
        if (parsed === 1 || parsed === 2) {
          setSelectedAsSemester(parsed);
        }
        setSelectedStandardSemester(semParam);
      }
    }
  }, [searchParams]);

  // Add / Edit Master Subject Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<HodSubjectItem | null>(null);

  // Form State
  const {
    formState: subjectForm,
    updateField: updateSubjectField,
    clearDraft: clearSubjectDraft,
  } = usePersistentFormState('hod_create_master_subject_draft', {
    code: '',
    name: '',
    semester: '1',
    cycle: 'P_CYCLE',
    category: 'ASC',
    credits: '4',
  });

  const { code, name, semester, cycle, category, credits } = subjectForm;
  const setCode = (val: string) => updateSubjectField('code', val);
  const setName = (val: string) => updateSubjectField('name', val);
  const setSemester = (val: string) => updateSubjectField('semester', val);
  const setCycle = (val: string) => updateSubjectField('cycle', val);
  const setCategory = (val: string) => updateSubjectField('category', val);
  const setCredits = (val: string) => updateSubjectField('credits', val);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Subject deletion & Dynamic Drive synchronization state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string; name: string } | null>(null);
  const [checkingDeletion, setCheckingDeletion] = useState<boolean>(false);
  const [deletionCheckData, setDeletionCheckData] = useState<{
    hasAttendanceHistory: boolean;
    sessionsCount: number;
    recordsCount: number;
    assignmentsCount: number;
    backupFilesCount: number;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Determine if this is Applied Science department
  const isAppliedScience = Boolean(
    schemeData?.departmentCode === 'AS' ||
    schemeData?.type === 'SEMESTER_HANDLING' ||
    (schemeData?.handlingSemesters && schemeData.handlingSemesters.length > 0 && schemeData.handlingSemesters.every((s) => s <= 2))
  );

  useEffect(() => {
    loadDepartmentSchemeAndSubjects();
  }, []);

  const loadDepartmentSchemeAndSubjects = async () => {
    setSchemeLoading(true);
    setSchemeError(null);
    try {
      const schemeRes = await hodService.getDepartmentScheme();
      setSchemeData(schemeRes);

      // Check if active scheme is not yet configured for Applied Science
      if (!schemeRes.activeSchemeId) {
        setShowFirstTimeSchemeModal(true);
      } else {
        setNewSchemeSelection(schemeRes.activeSchemeId);
      }

      await fetchSubjects(schemeRes.activeSchemeId || undefined);
    } catch (err: any) {
      console.error('Failed to load department scheme info:', err);
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to load academic scheme configuration.';
      setSchemeError(errMsg);
      toast.error(errMsg);
    } finally {
      setSchemeLoading(false);
    }
  };

  const fetchSubjects = async (_currentScheme?: string) => {
    setLoading(true);
    setSubjectsError(null);
    try {
      const data = await hodService.getSubjects();
      setSubjects(data || []);
    } catch (err: any) {
      console.error('Failed to load subjects:', err);
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to load department subjects.';
      setSubjectsError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFirstTimeScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFirstScheme) {
      toast.error('Please select a curriculum scheme.');
      return;
    }
    setSavingFirstScheme(true);
    try {
      const res = await hodService.updateDepartmentScheme(selectedFirstScheme);
      toast.success(res.message || `Active scheme set to ${selectedFirstScheme} Scheme.`);
      setShowFirstTimeSchemeModal(false);
      setSchemeData((prev) => (prev ? { ...prev, activeSchemeId: selectedFirstScheme, activeSchemeName: `${selectedFirstScheme} Scheme` } : null));
      setNewSchemeSelection(selectedFirstScheme);
      fetchSubjects();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to set active scheme.';
      toast.error(msg);
    } finally {
      setSavingFirstScheme(false);
    }
  };

  const handleChangeScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchemeSelection) {
      toast.error('Please select an academic scheme.');
      return;
    }
    if (!confirmSchemeChange) {
      toast.error('Please confirm the scheme change agreement.');
      return;
    }

    setSavingSchemeChange(true);
    try {
      const res = await hodService.updateDepartmentScheme(newSchemeSelection);
      toast.success(res.message || `Active scheme updated to ${newSchemeSelection} Scheme.`);
      setShowChangeSchemeModal(false);
      setConfirmSchemeChange(false);
      setSchemeData((prev) => (prev ? { ...prev, activeSchemeId: newSchemeSelection, activeSchemeName: `${newSchemeSelection} Scheme` } : null));
      fetchSubjects();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to update active scheme.';
      toast.error(msg);
    } finally {
      setSavingSchemeChange(false);
    }
  };

  const openCreateModal = () => {
    setEditingSubject(null);
    setFormError(null);
    if (isAppliedScience) {
      setCycle(selectedCycle);
      setSemester(String(selectedAsSemester));
      setCategory('ASC');
    } else {
      setSemester(selectedStandardSemester !== 'ALL' ? selectedStandardSemester : '3');
      setCategory('IPCC');
    }
    setShowAddModal(true);
  };

  const handleSaveMasterSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setFormError('Course code and course name are required.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const credVal = Number(credits);
      const parsedCredits = !isNaN(credVal) && credVal >= 0 ? credVal : (category === 'NCMC' ? 0 : 4);
      const cleanCat = category.trim().toUpperCase() || 'ASC';

      if (editingSubject) {
        await hodService.updateSubject(editingSubject.id, {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          semester: Number(semester),
          cycle: isAppliedScience ? cycle : undefined,
          type: cleanCat,
          category: cleanCat,
          credits: parsedCredits,
        });
        toast.success('Master subject updated successfully.');
      } else {
        await hodService.createSubject({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          semester: Number(semester),
          cycle: isAppliedScience ? cycle : undefined,
          type: cleanCat,
          category: cleanCat,
          credits: parsedCredits,
        });
        toast.success('Master subject created successfully.');
      }

      setShowAddModal(false);
      setEditingSubject(null);
      clearSubjectDraft();
      setFormError(null);
      fetchSubjects();
    } catch (err: any) {
      console.error('Failed to save master subject:', err);
      const backendError =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to save master subject. Please check the inputs and try again.';
      setFormError(backendError);
      toast.error(backendError);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubject = (sub: HodSubjectItem) => {
    setEditingSubject(sub);
    setCode(sub.code);
    setName(sub.name);
    setSemester(String(sub.semester));
    setCycle(sub.cycle || 'P_CYCLE');
    setCategory(sub.type || 'ASC');
    setCredits(String(sub.credits || 4));
    setFormError(null);
    setShowAddModal(true);
  };

  const handleInitiateDelete = async (sub: HodSubjectItem) => {
    setDeleteTarget({ id: sub.id, code: sub.code, name: sub.name });
    setCheckingDeletion(true);
    setDeletionCheckData(null);
    try {
      const res = await hodService.checkSubjectDeletion(sub.id);
      setDeletionCheckData(res);
    } catch (err) {
      console.error('Failed to check subject deletion readiness:', err);
    } finally {
      setCheckingDeletion(false);
    }
  };

  const handleConfirmDelete = async (shouldDeactivate: boolean) => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeletingId(id);
    try {
      const res = await hodService.deleteSubject(id, { deactivate: shouldDeactivate });
      if (shouldDeactivate) {
        toast.success(res?.message || 'Subject archived successfully. Historical attendance has been preserved.');
      } else {
        toast.success(res?.message || 'Subject deleted successfully. Associated unused attendance backup will be removed from Google Drive.');
      }
      setDeleteTarget(null);
      setDeletionCheckData(null);
      fetchSubjects();
    } catch (err: any) {
      console.error('Failed to delete/archive subject:', err);
      const resData = err?.response?.data;
      if (resData?.code === 'SUBJECT_HAS_ACADEMIC_DATA') {
        setDeletionCheckData({
          hasAttendanceHistory: true,
          sessionsCount: resData.details?.sessions || 1,
          recordsCount: resData.details?.attendanceRecords || 1,
          assignmentsCount: resData.details?.assignments || 0,
          backupFilesCount: 1,
        });
        toast.warn('This subject contains attendance history and must be archived instead of deleted.');
      } else {
        const msg = resData?.message || resData?.error || 'Failed to process subject deletion.';
        toast.error(msg);
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Filter subjects strictly according to cycle, semester, and optional search
  const displayedSubjects = subjects.filter((s) => {
    if (isAppliedScience) {
      // Must match selected cycle
      if (s.cycle && s.cycle !== selectedCycle) return false;
      // Must match selected semester
      if (s.semester !== selectedAsSemester) return false;
    } else {
      if (selectedStandardSemester !== 'ALL' && s.semester !== Number(selectedStandardSemester)) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const codeMatch = (s.code || '').toLowerCase().includes(q);
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const typeMatch = (s.type || '').toLowerCase().includes(q);
      return codeMatch || nameMatch || typeMatch;
    }

    return true;
  });

  const activeSchemeLabel = schemeData?.activeSchemeId ? `${schemeData.activeSchemeId} Scheme` : '2025 Scheme';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans text-neutral-800 dark:text-neutral-100">
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
      
      {/* ── 1. Page Header with Clean Material Styling ──────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            <span>Academic Control</span>
            <span>•</span>
            <span className="text-blue-700 dark:text-blue-400 font-bold">
              {schemeData?.departmentName || 'Applied Science'} ({schemeData?.departmentCode || 'AS'})
            </span>
          </div>
          
          {/* Department Context Badges */}
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60">
              <span className="text-neutral-400 font-normal">Dept:</span>
              <strong className="text-neutral-900 dark:text-white">{schemeData?.departmentCode || 'AS'}</strong>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60">
              <span className="text-neutral-400 font-normal">Academic Year:</span>
              <strong className="text-neutral-900 dark:text-white">2026–27</strong>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shadow-xs">
              <span className="text-blue-500 font-normal">Scheme:</span>
              <strong className="font-bold">{activeSchemeLabel}</strong>
            </span>

            <button
              type="button"
              onClick={() => {
                setConfirmSchemeChange(false);
                setShowChangeSchemeModal(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline px-1.5 py-1 rounded-md transition-colors"
              title="Configure or switch curriculum scheme version"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Change Scheme</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap self-start md:self-auto">
          <button
            onClick={() => fetchSubjects()}
            className="px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shadow-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-xl bg-[#0a1931] hover:bg-[#071224] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 border border-blue-900/30"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Master Subject</span>
          </button>
        </div>
      </div>

      {/* ── 2. Applied Science 2-Level Filter UI ────────────────────────────── */}
      {isAppliedScience ? (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-3">
              {/* Level 1: Curriculum Cycle */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 w-24">
                  Curriculum Cycle:
                </span>
                <div className="inline-flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80">
                  <button
                    type="button"
                    onClick={() => setSelectedCycle('P_CYCLE')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedCycle === 'P_CYCLE'
                        ? 'bg-[#0a1931] text-white shadow-xs dark:bg-blue-600'
                        : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    P Cycle (Physics)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCycle('C_CYCLE')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedCycle === 'C_CYCLE'
                        ? 'bg-[#0a1931] text-white shadow-xs dark:bg-blue-600'
                        : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    C Cycle (Chemistry)
                  </button>
                </div>
              </div>

              {/* Level 2: Semester (Sem 1 / Sem 2) */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 w-24">
                  Semester:
                </span>
                <div className="inline-flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAsSemester(1);
                      const p = new URLSearchParams(searchParams);
                      p.set('semester', '1');
                      setSearchParams(p, { replace: true });
                    }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedAsSemester === 1
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    Semester 1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAsSemester(2);
                      const p = new URLSearchParams(searchParams);
                      p.set('semester', '2');
                      setSearchParams(p, { replace: true });
                    }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedAsSemester === 2
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    Semester 2
                  </button>
                </div>
              </div>
            </div>

            {/* Search Input and Counter */}
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search subjects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-300 shrink-0">
                <span className="text-neutral-900 dark:text-white font-black">{displayedSubjects.length}</span> subjects
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Standard Department Semester Filter */
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mr-2">
              Semester:
            </span>
            <button
              onClick={() => {
                setSelectedStandardSemester('ALL');
                const p = new URLSearchParams(searchParams);
                p.delete('semester');
                setSearchParams(p, { replace: true });
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedStandardSemester === 'ALL'
                  ? 'bg-[#0a1931] text-white shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
              }`}
            >
              All Semesters
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <button
                key={s}
                onClick={() => {
                  const val = String(s);
                  setSelectedStandardSemester(val);
                  const p = new URLSearchParams(searchParams);
                  p.set('semester', val);
                  setSearchParams(p, { replace: true });
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedStandardSemester === String(s)
                    ? 'bg-[#0a1931] text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                }`}
              >
                Sem {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search subjects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-300 shrink-0">
              {displayedSubjects.length} subjects
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Material Table Display ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs overflow-hidden">
        
        {/* Table Header / Context Banner */}
        <div className="px-6 py-4 border-b border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-neutral-200">
              {isAppliedScience ? (
                `${selectedCycle === 'P_CYCLE' ? 'P CYCLE' : 'C CYCLE'} • SEMESTER ${selectedAsSemester}`
              ) : (
                selectedStandardSemester === 'ALL' ? 'ALL SEMESTERS' : `SEMESTER ${selectedStandardSemester}`
              )}
            </h2>
          </div>
          <div className="text-[11px] font-semibold text-neutral-400">
            Scheme: <span className="font-bold text-neutral-700 dark:text-neutral-300">{activeSchemeLabel}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-100/70 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-300 uppercase tracking-wider font-extrabold border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="py-3.5 px-4 text-center w-12">SL</th>
                <th className="py-3.5 px-4 text-center w-32">COURSE CODE</th>
                <th className="py-3.5 px-4 text-center">SUBJECT NAME</th>
                <th className="py-3.5 px-4 text-center w-28">CATEGORY</th>
                <th className="py-3.5 px-4 text-center w-24">CREDITS</th>
                <th className="py-3.5 px-4 text-center w-28">SCHEME</th>
                <th className="py-3.5 px-4 text-center w-40">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-neutral-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                    <p className="mt-2 text-xs font-semibold">Loading master subjects...</p>
                  </td>
                </tr>
              ) : subjectsError ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mx-auto text-rose-600">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                        Unable to load subjects
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {subjectsError}
                      </p>
                      <button
                        type="button"
                        onClick={() => fetchSubjects()}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : displayedSubjects.length > 0 ? (
                displayedSubjects.map((sub, idx) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-blue-50/20 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 text-center font-bold text-neutral-400">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-neutral-900 dark:text-white">
                      {sub.code}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="font-bold text-neutral-900 dark:text-white text-xs text-center">
                        {sub.name}
                      </div>
                      {sub.assignedFaculty && sub.assignedFaculty.length > 0 ? (
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 flex items-center justify-center gap-1.5 flex-wrap text-center">
                          <span className="text-neutral-400">Faculty:</span>
                          {sub.assignedFaculty.map((f, i) => (
                            <span key={i} className="font-semibold text-neutral-700 dark:text-neutral-300">
                              {f.facultyName} (Sec {f.section}){i < sub.assignedFaculty.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1 text-center">
                          Unassigned
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60">
                        {sub.type || 'ASC'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-neutral-800 dark:text-neutral-200">
                      {sub.credits}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200/50">
                        {sub.schemeId || '2025'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditSubject(sub)}
                          className="px-2.5 py-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Edit master subject"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInitiateDelete(sub)}
                          disabled={deletingId === sub.id}
                          className="px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete master subject"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-neutral-800 flex items-center justify-center mx-auto text-blue-600">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                        No master subjects found
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {isAppliedScience ? (
                          `Create the first master subject for ${selectedCycle === 'P_CYCLE' ? 'P Cycle' : 'C Cycle'} • Semester ${selectedAsSemester}`
                        ) : (
                          'Create master subjects for this department curriculum'
                        )}
                      </p>
                      <button
                        onClick={openCreateModal}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+ Add Master Subject</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. First-Time Scheme Setup Dialog ───────────────────────────────── */}
      {showFirstTimeSchemeModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
              <div className="space-y-1">
                <div className="inline-flex p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 mb-2">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Select Academic Scheme
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Select the VTU curriculum scheme applicable to your department.
                </p>
              </div>

              <form onSubmit={handleSaveFirstTimeScheme} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Academic Scheme *
                  </label>
                  <select
                    value={selectedFirstScheme}
                    onChange={(e) => setSelectedFirstScheme(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="2025">2025 Scheme (Current VTU)</option>
                    <option value="2022">2022 Scheme</option>
                    <option value="2027">2027 Scheme</option>
                    <option value="2018">2018 Scheme</option>
                  </select>
                  <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
                    This scheme will be used automatically for all new master subjects created by this department.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="submit"
                    disabled={savingFirstScheme}
                    className="w-full py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                  >
                    {savingFirstScheme ? 'Saving...' : 'Continue'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── 5. Change Scheme Controlled Modal ───────────────────────────────── */}
      {showChangeSchemeModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Change Active Academic Scheme
                  </h3>
                </div>
                <button
                  onClick={() => setShowChangeSchemeModal(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                <p className="font-semibold">
                  Changing the active scheme will affect newly created master subjects. Existing subjects will remain associated with their original scheme.
                </p>
              </div>

              <form onSubmit={handleChangeScheme} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block mb-1 text-neutral-700 dark:text-neutral-300 font-bold">
                    Select New Active Scheme
                  </label>
                  <select
                    value={newSchemeSelection}
                    onChange={(e) => setNewSchemeSelection(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="2025">2025 Scheme</option>
                    <option value="2027">2027 Scheme</option>
                    <option value="2022">2022 Scheme</option>
                    <option value="2018">2018 Scheme</option>
                  </select>
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="confirmSchemeCheckbox"
                    checked={confirmSchemeChange}
                    onChange={(e) => setConfirmSchemeChange(e.target.checked)}
                    className="mt-0.5 rounded-md border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="confirmSchemeCheckbox" className="text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer leading-tight">
                    I understand that existing master subjects will remain preserved in their original schemes and not be overwritten.
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowChangeSchemeModal(false)}
                    className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSchemeChange || !confirmSchemeChange}
                    className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-xs"
                  >
                    {savingSchemeChange ? 'Updating...' : 'Confirm & Update Scheme'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── 6. Create / Edit Master Subject Modal (No Scheme, No Dept inputs!) ── */}
      {showAddModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl p-6 sm:p-7 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    {editingSubject ? 'Edit Master Subject' : 'Create Master Subject'}
                  </h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Applied Scheme: <strong className="text-neutral-700 dark:text-neutral-300">{activeSchemeLabel}</strong> (auto-assigned)
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMasterSubject} className="space-y-3.5 text-xs">
                {/* Cycle (Mandatory for Applied Science) */}
                {isAppliedScience && (
                  <div>
                    <label className="block mb-1 text-neutral-700 dark:text-neutral-300 font-bold">
                      Cycle *
                    </label>
                    <select
                      value={cycle}
                      onChange={(e) => setCycle(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value="P_CYCLE">P Cycle (Physics Cycle)</option>
                      <option value="C_CYCLE">C Cycle (Chemistry Cycle)</option>
                    </select>
                  </div>
                )}

                {/* Semester */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-neutral-700 dark:text-neutral-300 font-bold">
                      Semester *
                    </label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      {isAppliedScience ? (
                        <>
                          <option value="1">Semester 1</option>
                          <option value="2">Semester 2</option>
                        </>
                      ) : (
                        [1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={s}>Semester {s}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-neutral-700 dark:text-neutral-300 font-bold">
                      Credits *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      required
                      value={credits}
                      onChange={(e) => setCredits(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Course Code */}
                <div>
                  <label className="block mb-1 text-neutral-700 dark:text-neutral-300 font-bold">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1BMATS101 or 25MATS11"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                {/* Course Name */}
                <div>
                  <label className="block mb-1 text-neutral-700 dark:text-neutral-300 font-bold">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Calculus and Linear Algebra"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                {/* Course Category */}
                <div>
                  <label className="block mb-1 text-neutral-700 dark:text-neutral-300 font-bold">
                    Course Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setCategory(newCat);
                      if (newCat === 'NCMC' && (credits === '4' || credits === '')) {
                        setCredits('0');
                      } else if (newCat !== 'NCMC' && credits === '0') {
                        setCredits('4');
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    {APPLIED_SCIENCE_COURSE_CATEGORIES.map((cat) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-semibold">
                    {formError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingSubject ? 'Update Master Subject' : 'Create Master Subject'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── 7. Dynamic Subject Delete / Archive Modal ──────────────────────── */}
      {deleteTarget &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    deletionCheckData?.hasAttendanceHistory
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {deletionCheckData?.hasAttendanceHistory ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    {deletionCheckData?.hasAttendanceHistory ? 'Archive Subject' : 'Delete Subject?'}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    {deleteTarget.code} — {deleteTarget.name}
                  </p>
                </div>
              </div>

              {checkingDeletion ? (
                <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  <p className="text-xs text-neutral-500 font-medium">
                    Checking attendance history & Drive backup records...
                  </p>
                </div>
              ) : deletionCheckData?.hasAttendanceHistory ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                    <div className="font-extrabold flex items-center gap-1.5 text-amber-700 dark:text-amber-400 uppercase tracking-wide text-[11px]">
                      <AlertTriangle className="w-4 h-4" />
                      <span>WARNING: Attendance History Exists</span>
                    </div>
                    <p className="leading-relaxed">
                      This subject contains attendance history. The subject will be archived and historical attendance records will be preserved.
                    </p>
                    {(deletionCheckData.sessionsCount > 0 || deletionCheckData.recordsCount > 0) && (
                      <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 font-semibold pt-0.5">
                        • {deletionCheckData.sessionsCount} session(s) and {deletionCheckData.recordsCount} attendance record(s) on file.
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    The historical Google Drive attendance workbook(s) will be securely preserved in the archive.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-700 dark:text-neutral-200 leading-relaxed font-semibold">
                    Delete this subject and its unused attendance backup?
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    No attendance records were found. The unused Google Drive attendance workbook(s) and database records will be removed.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeletionCheckData(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                {deletionCheckData?.hasAttendanceHistory ? (
                  <button
                    type="button"
                    disabled={Boolean(deletingId) || checkingDeletion}
                    onClick={() => handleConfirmDelete(true)}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {deletingId ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{deletingId ? 'Archiving...' : 'Archive & Remove Subject'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(deletingId) || checkingDeletion}
                    onClick={() => handleConfirmDelete(false)}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {deletingId ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{deletingId ? 'Deleting...' : 'Delete Subject'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default HodSubjectsPage;
