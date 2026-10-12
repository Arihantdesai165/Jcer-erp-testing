import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
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
  Edit2,
  ArrowRightLeft,
  UserMinus,
  Layers,
  Building2,
  Calendar,
  DoorOpen,
} from 'lucide-react';
import { RootState } from '../../store';
import hodService, {
  HodSectionItem,
  HodSectionStudentItem,
} from '../../services/hod.service';

export const HodSectionDetailPage: React.FC = () => {
  const { sectionId } = useParams<{ sectionId: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const deptCode = user?.department?.code || 'ECE';

  const [section, setSection] = useState<HodSectionItem | null>(null);
  const [students, setStudents] = useState<HodSectionStudentItem[]>([]);
  const [siblingSections, setSiblingSections] = useState<HodSectionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<{ message: string; errorCode?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [moveModalOpen, setMoveModalOpen] = useState<boolean>(false);
  const [removeModalOpen, setRemoveModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [targetStudent, setTargetStudent] = useState<HodSectionStudentItem | null>(null);

  // Move Form
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [newRollNumber, setNewRollNumber] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Section Form
  const [editName, setEditName] = useState<string>('');
  const [editCapacity, setEditCapacity] = useState<number>(60);
  const [editClassroom, setEditClassroom] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const isValidUuid = (id: string | undefined): boolean => {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
  };

  const loadData = async () => {
    if (!sectionId || !isValidUuid(sectionId)) {
      setPageError({
        message: 'Invalid section identifier. The URL must contain a valid section UUID.',
        errorCode: 'INVALID_SECTION_ID',
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError(null);

    try {
      const res = await hodService.getSectionStudents(sectionId);
      if (!res || !res.section) {
        setPageError({
          message: 'Section not found.',
          errorCode: 'SECTION_NOT_FOUND',
        });
        return;
      }

      setSection(res.section);
      setStudents(res.students || []);

      // If backend resolved canonical UUID, update the browser URL smoothly
      if (res.section?.id && res.section.id !== sectionId) {
        window.history.replaceState(null, '', `/hod/students/sections/${res.section.id}`);
      }

      // Fetch sibling sections of same semester for move dropdown
      if (res.section?.semester) {
        try {
          const allSections = await hodService.getSections(res.section.semester, res.section.academicYear);
          setSiblingSections((allSections || []).filter((s) => s.id !== (res.section?.id || sectionId)));
        } catch (err) {
          console.warn('Failed to load sibling sections:', err);
        }
      }
    } catch (err: any) {
      console.error('Failed to load section students:', err);
      const backendMsg = err.response?.data?.message || err.response?.data?.error || 'Unable to load section data.';
      const errorCode = err.response?.data?.errorCode;
      setPageError({
        message: backendMsg,
        errorCode,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sectionId]);

  // Filtered Students by search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(q);
      const usnMatch = s.usn ? s.usn.toLowerCase().includes(q) : false;
      const enrollMatch = s.enrollmentNumber ? s.enrollmentNumber.toLowerCase().includes(q) : false;
      const rollMatch = s.rollNumber ? s.rollNumber.toLowerCase().includes(q) : false;
      return nameMatch || usnMatch || enrollMatch || rollMatch;
    });
  }, [students, searchQuery]);

  // Open Move Modal
  const handleOpenMoveModal = (st: HodSectionStudentItem) => {
    setTargetStudent(st);
    setTargetSectionId(siblingSections[0]?.id || '');
    setNewRollNumber(st.rollNumber || '');
    setModalError(null);
    setMoveModalOpen(true);
  };

  // Submit Move
  const handleSubmitMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionId || !targetStudent || !targetSectionId) {
      setModalError('Target section is required.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await hodService.moveStudentSection(
        sectionId,
        targetStudent.id,
        targetSectionId,
        newRollNumber.trim() || undefined
      );

      setNotification({
        type: 'success',
        message: res.message || `Student moved to new section successfully.`,
      });
      setMoveModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Move failed:', err);
      setModalError(err.response?.data?.error || 'Failed to move student.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Remove Modal
  const handleOpenRemoveModal = (st: HodSectionStudentItem) => {
    setTargetStudent(st);
    setRemoveModalOpen(true);
  };

  // Confirm Remove
  const handleConfirmRemove = async () => {
    if (!sectionId || !targetStudent) return;
    setSubmitting(true);
    try {
      const res = await hodService.removeStudentFromSection(sectionId, targetStudent.id);
      setNotification({
        type: 'success',
        message: res.message || `Student removed from ${section?.name}.`,
      });
      setRemoveModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Remove failed:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to remove student from section.',
      });
      setRemoveModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Section Modal
  const handleOpenEditModal = () => {
    if (!section) return;
    setEditName(section.name);
    setEditCapacity(section.capacity || 60);
    setEditClassroom(section.classroom || '');
    setEditDescription(section.description || '');
    setModalError(null);
    setEditModalOpen(true);
  };

  // Submit Edit Section
  const handleSubmitEditSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!section) return;
    if (editCapacity < students.length) {
      setModalError(`Capacity cannot be lower than currently allocated students (${students.length}).`);
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      await hodService.updateSection(section.id, {
        name: editName.trim(),
        capacity: editCapacity,
        classroom: editClassroom.trim() || '',
        description: editDescription.trim() || '',
      });

      setNotification({
        type: 'success',
        message: 'Section details updated successfully.',
      });
      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Update section failed:', err);
      setModalError(err.response?.data?.error || 'Failed to update section.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Loading State (Requirement 21: Show proper loading state, do NOT render broken header or 0 values)
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            to="/hod/students/sections"
            className="text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 inline-flex items-center gap-1 mb-1 transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Back to Section Allocations</span>
          </Link>
        </div>

        <div className="rounded-3xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-16 text-center shadow-sm space-y-4">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent" />
          <h2 className="text-base font-black text-neutral-900 dark:text-white">
            Loading Section Details...
          </h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Resolving section metadata and enrolled student roster from database...
          </p>
        </div>
      </div>
    );
  }

  // 2. Error State (Requirement 21: Show clear error message, do NOT render broken UI)
  if (pageError || !section) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            to="/hod/students/sections"
            className="text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 inline-flex items-center gap-1 mb-1 transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Back to Section Allocations</span>
          </Link>
        </div>

        <div className="rounded-3xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-12 text-center max-w-md mx-auto shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <div>
            <h2 className="text-base font-black text-neutral-900 dark:text-white">
              Unable to Load Section
            </h2>
            <p className="text-xs text-rose-700 dark:text-rose-300 font-semibold mt-1">
              {pageError?.message || 'Section data could not be retrieved.'}
            </p>
            {pageError?.errorCode && (
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-mono text-[10px] font-bold">
                {pageError.errorCode}
              </span>
            )}
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              to="/hod/students/sections"
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold transition-colors"
            >
              Back to Sections
            </Link>
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Guaranteed Valid Section Data
  const sectionCode =
    section.code ||
    (section.name ? section.name.replace(/^(Section|Sec)\s*/i, '').trim() : 'A');
  const displaySectionTitle = section.name.startsWith('Section')
    ? section.name
    : `Section ${sectionCode}`;

  const capacity = section.capacity || 60;
  const allocated = students.length;
  const available = Math.max(0, capacity - allocated);
  const fillRate = capacity > 0 ? Math.min(100, Math.round((allocated / capacity) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* ── NOTIFICATION TOAST ─────────────────────────────────────────────────── */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm transition-all animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="text-xs font-bold">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── HEADER & ACTIONS ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <Link
            to={`/hod/students/sections?semester=${section.semester}`}
            className="text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 inline-flex items-center gap-1 mb-1 transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Back to Section Allocations</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                Section Student Details — {displaySectionTitle}
              </h1>
              <p className="text-xs text-neutral-500 font-medium">
                Department: {deptCode} &nbsp;|&nbsp; Semester {section.semester} &nbsp;|&nbsp; Academic Year {section.academicYear || '2026-27'}
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

          {section?.classroom && (
            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300">
              <DoorOpen size={13} className="text-neutral-500" />
              <span>Room: {section.classroom}</span>
            </div>
          )}

          {section && (
            <Link
              to={`/hod/students/sections/${section.id}/allocate`}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all hover:scale-[1.01] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus size={14} />
              <span>+ Allocate Students</span>
            </Link>
          )}

          <button
            onClick={handleOpenEditModal}
            className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
            title="Edit Section Details"
          >
            <Edit2 size={14} />
          </button>

          <button
            onClick={loadData}
            title="Refresh List"
            className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
            Section Capacity
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-neutral-900 dark:text-white leading-none">
              {capacity}
            </span>
            <span className="text-[10px] font-bold text-neutral-400">total seats</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
            Enrolled Students
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-700 dark:text-blue-300 leading-none">
              {allocated}
            </span>
            <span className="text-[10px] font-bold text-neutral-400">allocated</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
            Available Slots
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 leading-none">
              {available}
            </span>
            <span className="text-[10px] font-bold text-neutral-400">remaining</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
            Fill Percentage
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300 leading-none">
              {fillRate}%
            </span>
            <span className="text-[10px] font-bold text-neutral-400">capacity fill</span>
          </div>
        </div>
      </div>

      {/* ── SEARCH BAR ────────────────────────────────────────────────────────── */}
      <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between gap-3">
        <div className="flex-1 max-w-md flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm">
          <Search size={15} className="text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Search enrolled students by name, USN, roll number..."
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

        <span className="text-xs font-bold text-neutral-500">
          Showing {filteredStudents.length} of {students.length} students
        </span>
      </div>

      {/* ── ALLOCATED STUDENTS TABLE ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-neutral-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-xs font-bold">Loading section students...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-16 text-center text-neutral-400 space-y-3">
            <Users size={36} className="mx-auto text-neutral-300 dark:text-neutral-700" />
            <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
              {searchQuery ? 'No matching students' : 'No students allocated to this section yet'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {searchQuery
                ? 'Try a different search term.'
                : 'Click below to allocate department students into this section.'}
            </p>
            {!searchQuery && section && (
              <Link
                to={`/hod/students/sections/${section.id}/allocate`}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 transition-colors"
              >
                <UserPlus size={14} />
                <span>+ Allocate Students Now</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase font-extrabold border-b border-neutral-800">
                <tr className="border-b border-neutral-800 bg-[#111111] dark:bg-neutral-950 text-[10px] font-black uppercase tracking-wider text-white">
                  <th className="py-3 px-4 w-16 text-center text-white">SL NO</th>
                  <th className="py-3 px-4 text-white">ENROLLMENT NUMBER</th>
                  <th className="py-3 px-4 text-white">STUDENT NAME</th>
                  <th className="py-3 px-4 text-white">SEMESTER</th>
                  <th className="py-3 px-4 text-white">STATUS</th>
                  <th className="py-3 px-4 text-center text-white">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 text-xs">
                {filteredStudents.map((s, index) => (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                    {/* SL NO (Display-only dynamic sequence) */}
                    <td className="py-3 px-4 text-center font-bold text-neutral-500 dark:text-neutral-400">
                      {index + 1}
                    </td>

                    {/* Enrollment Number (authoritative ERP identifier) */}
                    <td className="py-3 px-4 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {s.enrollmentNumber || '—'}
                    </td>

                    {/* Student Name */}
                    <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                      <div>
                        <span>{s.name}</span>
                        <span className="block text-[10px] text-neutral-400 font-normal">{s.email}</span>
                      </div>
                    </td>

                    {/* Semester */}
                    <td className="py-3 px-4 font-bold text-neutral-700 dark:text-neutral-300">
                      {s.semester ? `Sem ${s.semester}` : `Sem ${section?.semester || 1}`}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                        {s.admissionStatus || 'APPROVED'}
                      </span>
                    </td>

                    {/* Actions: Move, Remove */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {siblingSections.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenMoveModal(s)}
                            className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold transition-colors inline-flex items-center gap-1"
                            title="Move to another section"
                          >
                            <ArrowRightLeft size={12} />
                            <span>Move</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenRemoveModal(s)}
                          className="px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold transition-colors inline-flex items-center gap-1"
                          title="Remove student from this section"
                        >
                          <UserMinus size={12} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MOVE STUDENT MODAL ─────────────────────────────────────────────────── */}
      {moveModalOpen && targetStudent &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    Move Student
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Transfer {targetStudent.name} from {section?.name}
                  </p>
                </div>
                <button
                  onClick={() => setMoveModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
                >
                  <X size={16} />
                </button>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitMove} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Destination Section <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {siblingSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name} (Capacity: {sec.studentCount || 0}/{sec.capacity})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    Only active sections in Semester {section?.semester} can receive this student.
                  </span>
                </div>

                {section?.semester === 1 && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Roll Number in Destination Section (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 01, 15 (Optional)"
                      value={newRollNumber}
                      onChange={(e) => setNewRollNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMoveModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting ? 'Transferring...' : 'Transfer Student'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}


      {/* ── REMOVE STUDENT CONFIRMATION MODAL ─────────────────────────────────── */}
      {removeModalOpen && targetStudent &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl max-w-sm w-full p-6 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <UserMinus size={24} />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  Remove from Section?
                </h3>
                <p className="text-xs text-neutral-500">
                  Are you sure you want to remove <strong>{targetStudent.name}</strong> from {section?.name}?
                </p>
                <p className="text-[11px] text-neutral-400 pt-1">
                  The student will become unallocated. Their academic enrollment record will NOT be deleted.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRemoveModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmRemove}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Removing...' : 'Confirm Remove'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}


      {/* ── EDIT SECTION DETAILS MODAL ────────────────────────────────────────── */}
      {editModalOpen && section &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  Edit Section Details
                </h3>
                <p className="text-xs text-neutral-500">
                  Update settings for {section.name}
                </p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitEditSection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Section Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Capacity (Enrolled Students: {students.length})
                </label>
                <input
                  type="number"
                  required
                  min={students.length || 1}
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Classroom / Room
                </label>
                <input
                  type="text"
                  placeholder="e.g. Room 304, LH-1"
                  value={editClassroom}
                  onChange={(e) => setEditClassroom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HodSectionDetailPage;
