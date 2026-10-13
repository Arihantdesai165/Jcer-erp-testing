import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  Send,
  Award,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Undo2,
  Layers,
  ChevronDown,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import hodService, {
  HodReleaseSemesterCard,
  HodReleaseSubjectItem,
} from '../../services/hod.service';
import { useAcademicYear } from '../../context/AcademicYearContext';

const ASSESSMENT_OPTIONS = [
  { type: 'ALL', label: 'All Assessments' },
  { type: 'CIE1', label: 'CIE 1' },
  { type: 'CIE2', label: 'CIE 2' },
  { type: 'ASSIGNMENT', label: 'Assignment' },
  { type: 'FINAL_INTERNAL', label: 'Final Internal' },
  { type: 'EXTERNAL', label: 'External (SEE)' },
];

export const HodPublishAttendanceMarksPage: React.FC = () => {
  const { academicYear } = useAcademicYear();

  // State
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [semesterCards, setSemesterCards] = useState<HodReleaseSemesterCard[]>([]);
  const [subjects, setSubjects] = useState<HodReleaseSubjectItem[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState<boolean>(true);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);

  // Per-subject action loading states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Assessment menu open state per subject: subjectId -> boolean
  const [openMarksMenu, setOpenMarksMenu] = useState<string | null>(null);

  // Bulk actions loading state
  const [bulkAttLoading, setBulkAttLoading] = useState<boolean>(false);
  const [bulkMarksLoading, setBulkMarksLoading] = useState<boolean>(false);
  const [syncAllLoading, setSyncAllLoading] = useState<boolean>(false);

  // 1. Fetch authorized semesters
  const fetchSemesters = async () => {
    setLoadingSemesters(true);
    try {
      const cards = await hodService.getReleaseSemesters({ academicYear });
      setSemesterCards(cards || []);
      // Auto-select first semester if none selected or if previously selected is invalid
      if (cards && cards.length > 0) {
        setSelectedSemester((prev) => (prev && cards.some((c) => c.semester === prev) ? prev : cards[0].semester));
      }
    } catch (err: any) {
      console.error('Failed to load publication semesters:', err);
      toast.error(err.response?.data?.error || 'Failed to load authorized semesters.');
    } finally {
      setLoadingSemesters(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
  }, [academicYear]);

  // 2. Fetch subjects automatically when selectedSemester changes
  const fetchSubjects = async (sem: number) => {
    setLoadingSubjects(true);
    try {
      const list = await hodService.getReleaseSemesterSubjects(sem, { academicYear });
      setSubjects(list || []);
    } catch (err: any) {
      console.error('Failed to load semester subjects:', err);
      toast.error(err.response?.data?.error || `Failed to load subjects for Semester ${sem}.`);
    } finally {
      setLoadingSubjects(false);
    }
  };

  useEffect(() => {
    if (selectedSemester !== null) {
      fetchSubjects(selectedSemester);
    }
  }, [selectedSemester, academicYear]);

  // ─── SUBJECT-LEVEL ATTENDANCE ACTIONS (NO POPUPS) ───────────────────────────
  const handlePublishAttendance = async (sub: HodReleaseSubjectItem) => {
    if (!selectedSemester) return;
    const actionKey = `att_${sub.id}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    try {
      const res = await hodService.confirmAttendanceRelease({
        semester: selectedSemester,
        subjectId: sub.id,
        academicYear,
      });
      toast.success(res.message || `Attendance published for ${sub.code} (${sub.name})!`);
      await fetchSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Failed to publish subject attendance:', err);
      toast.error(err.response?.data?.error || err.message || `Failed to publish attendance for ${sub.code}.`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleRevokeAttendance = async (sub: HodReleaseSubjectItem) => {
    if (!selectedSemester) return;
    const actionKey = `att_revoke_${sub.id}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    try {
      const res = await hodService.revokeAttendanceRelease({
        semester: selectedSemester,
        subjectId: sub.id,
        academicYear,
      });
      toast.success(res.message || `Attendance concealed for ${sub.code}.`);
      await fetchSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Failed to revoke subject attendance:', err);
      toast.error(err.response?.data?.error || err.message || `Failed to revoke attendance for ${sub.code}.`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  // ─── SUBJECT-LEVEL MARKS ACTIONS (INDEPENDENT COMPONENTS, NO POPUPS) ───────
  const handlePublishMarks = async (sub: HodReleaseSubjectItem, assessmentType: string) => {
    if (!selectedSemester) return;
    const actionKey = `marks_${sub.id}_${assessmentType}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    setOpenMarksMenu(null);
    try {
      const res = await hodService.confirmMarksRelease({
        semester: selectedSemester,
        subjectId: sub.id,
        assessmentType,
        academicYear,
      });
      const label = ASSESSMENT_OPTIONS.find((a) => a.type === assessmentType)?.label || assessmentType;
      toast.success(res.message || `${label} published for ${sub.code} (${sub.name})!`);
      await fetchSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Failed to publish marks:', err);
      toast.error(err.response?.data?.error || err.message || `Failed to publish ${assessmentType} marks for ${sub.code}.`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleRevokeMarks = async (sub: HodReleaseSubjectItem, assessmentType: string = 'ALL') => {
    if (!selectedSemester) return;
    const actionKey = `marks_revoke_${sub.id}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    setOpenMarksMenu(null);
    try {
      const res = await hodService.revokeMarksRelease({
        semester: selectedSemester,
        subjectId: sub.id,
        assessmentType,
        academicYear,
      });
      toast.success(res.message || `Marks concealed for ${sub.code}.`);
      await fetchSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Failed to revoke marks:', err);
      toast.error(err.response?.data?.error || err.message || `Failed to revoke marks for ${sub.code}.`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  // ─── OPTIONAL SAFE BULK ACTIONS (PROCESSES SUBJECTS INDEPENDENTLY) ──────────
  const handleBulkPublishAttendance = async () => {
    if (!selectedSemester) return;
    setBulkAttLoading(true);
    try {
      const res = await hodService.confirmSemesterAttendanceRelease({
        semester: selectedSemester,
        academicYear,
      });
      toast.success(res.message || `Attendance published for Semester ${selectedSemester} subjects!`);
      await fetchSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Bulk attendance release failed:', err);
      toast.error(err.response?.data?.error || err.message || 'Bulk attendance publication failed.');
    } finally {
      setBulkAttLoading(false);
    }
  };

  const handleBulkPublishMarks = async () => {
    if (!selectedSemester) return;
    setBulkMarksLoading(true);
    try {
      const res = await hodService.confirmSemesterMarksRelease({
        semester: selectedSemester,
        academicYear,
        assessmentType: 'ALL',
      });
      toast.success(res.message || `Evaluation marks published & synced for Semester ${selectedSemester} subjects!`);
      await fetchSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Bulk marks release failed:', err);
      toast.error(err.response?.data?.error || err.message || 'Bulk marks publication failed.');
    } finally {
      setBulkMarksLoading(false);
    }
  };

  // ─── SYNC ALL (ATTENDANCE + MARKS) WITHOUT CONCEALING ────────────────────────
  const handleSyncAll = async () => {
    if (!selectedSemester) return;
    setSyncAllLoading(true);
    try {
      const [attRes, marksRes] = await Promise.allSettled([
        hodService.confirmSemesterAttendanceRelease({
          semester: selectedSemester,
          academicYear,
        }),
        hodService.confirmSemesterMarksRelease({
          semester: selectedSemester,
          academicYear,
          assessmentType: 'ALL',
        }),
      ]);

      const attSuccess = attRes.status === 'fulfilled';
      const marksSuccess = marksRes.status === 'fulfilled';

      if (attSuccess && marksSuccess) {
        toast.success(`✓ Live attendance and marks synced & updated for Semester ${selectedSemester} students!`);
      } else if (attSuccess) {
        toast.success(`✓ Live attendance synced successfully for Semester ${selectedSemester} students.`);
      } else if (marksSuccess) {
        toast.success(`✓ Live evaluation marks synced successfully for Semester ${selectedSemester} students.`);
      } else {
        const errReason =
          (attRes as PromiseRejectedResult).reason?.response?.data?.error ||
          (attRes as PromiseRejectedResult).reason?.message ||
          'Sync failed.';
        toast.error(`Sync failed: ${errReason}`);
      }

      await fetchSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Sync all failed:', err);
      toast.error(err.response?.data?.error || err.message || 'Sync all failed.');
    } finally {
      setSyncAllLoading(false);
    }
  };

  // Summary counts for active semester
  const totalSubjects = subjects.length;
  const publishedAttCount = subjects.filter((s) => s.attendance?.isReleased).length;
  const fullyPublishedMarksCount = subjects.filter((s) => s.marks?.releasedCount === (s.marks?.totalAssessments || 5)).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* ── CLEAN HEADER & CONTEXT BAR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Publish Student Attendance & Marks
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorize official publication of subject attendance registers and evaluation marks to student portals.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center">
          <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>AY: {academicYear}</span>
          </span>

          <button
            onClick={() => {
              if (selectedSemester) fetchSubjects(selectedSemester);
              fetchSemesters();
            }}
            disabled={loadingSemesters || loadingSubjects}
            title="Refresh Publication Table"
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSemesters || loadingSubjects ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── SEMESTER SELECTION TABS & BULK CONTROLS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Semester Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
            Semester:
          </span>
          {loadingSemesters ? (
            <div className="h-9 w-48 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ) : semesterCards.length === 0 ? (
            <span className="text-xs text-slate-400">No managed semesters found</span>
          ) : (
            semesterCards.map((card) => {
              const isSelected = selectedSemester === card.semester;
              return (
                <button
                  key={card.semester}
                  onClick={() => setSelectedSemester(card.semester)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                  }`}
                >
                  <span>Semester {card.semester}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {card.totalSubjects} Subjects
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Safe Bulk Actions & Live Sync */}
        {selectedSemester && subjects.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            {/* Sync All Button - prominently syncs both attendance and marks live without concealing */}
            <button
              onClick={handleSyncAll}
              disabled={syncAllLoading || bulkAttLoading || bulkMarksLoading}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              title="Sync live attendance and marks from database and send updated data to students immediately without concealing"
            >
              {syncAllLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{syncAllLoading ? 'Syncing Live Data...' : 'Sync All Live Data'}</span>
            </button>

            {/* Bulk Publish / Republish Attendance */}
            <button
              onClick={handleBulkPublishAttendance}
              disabled={syncAllLoading || bulkAttLoading}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Publish or re-sync attendance for all active subjects in this semester"
            >
              {bulkAttLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>
                {publishedAttCount === totalSubjects
                  ? 'Republish All Attendance'
                  : 'Publish All Attendance'}
              </span>
            </button>

            {/* Bulk Publish / Republish Marks */}
            <button
              onClick={handleBulkPublishMarks}
              disabled={syncAllLoading || bulkMarksLoading}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Publish or re-sync all evaluation marks for active subjects in this semester"
            >
              {bulkMarksLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Award className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>
                {fullyPublishedMarksCount === totalSubjects
                  ? 'Republish All Marks'
                  : 'Publish All Marks'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── SIMPLE SUBJECT PUBLICATION TABLE ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
        {loadingSubjects ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
              No Active Subjects in Semester {selectedSemester}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No active subjects mapped to Semester {selectedSemester} for your department in Academic Year {academicYear}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-black text-white">
                <tr className="border-b border-black text-[11px] uppercase font-bold text-white bg-black">
                  <th className="py-4 px-5 min-w-[120px] bg-black text-white font-bold">Subject Code</th>
                  <th className="py-4 px-5 min-w-[220px] bg-black text-white font-bold">Subject Name</th>
                  <th className="py-4 px-5 text-center min-w-[160px] bg-black text-white font-bold">Attendance Status</th>
                  <th className="py-4 px-5 text-center min-w-[200px] bg-black text-white font-bold">Marks Status</th>
                  <th className="py-4 px-5 text-center min-w-[170px] bg-black text-white font-bold">Attendance Action</th>
                  <th className="py-4 px-5 text-center min-w-[200px] bg-black text-white font-bold">Marks Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {subjects.map((sub) => {
                  const attReleased = Boolean(sub.attendance?.isReleased);
                  const attSourceUpdated = Boolean(sub.attendance?.isSourceUpdated);

                  const marksReleasedCount = sub.marks?.releasedCount || 0;
                  const totalAssessments = sub.marks?.totalAssessments || 5;
                  const isAllMarksReleased = marksReleasedCount === totalAssessments;
                  const isMarksPartiallyReleased = marksReleasedCount > 0 && !isAllMarksReleased;

                  const isAttLoading = Boolean(actionLoading[`att_${sub.id}`] || actionLoading[`att_revoke_${sub.id}`]);
                  const isMarksActionLoading = Object.keys(actionLoading).some((k) => k.startsWith(`marks_${sub.id}`) && actionLoading[k]);

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors"
                    >
                      {/* 1. Subject Code */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                            {sub.code}
                          </span>
                          {sub.cycle && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                              {sub.cycle.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Subject Name */}
                      <td className="py-4 px-5">
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                          {sub.name}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {sub.credits} Credits • {sub.type || 'Academic'}
                        </span>
                      </td>

                      {/* 3. Attendance Publication Status */}
                      <td className="py-4 px-5 text-center">
                        {attReleased ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Published</span>
                            </span>
                            {attSourceUpdated && (
                              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                Update Available
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Not Published
                          </span>
                        )}
                      </td>

                      {/* 4. Marks Publication Status */}
                      <td className="py-4 px-5 text-center">
                        <div className="space-y-1.5">
                          {isAllMarksReleased ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Published (5/5)</span>
                            </span>
                          ) : isMarksPartiallyReleased ? (
                            <span className="inline-block text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              Partially Published ({marksReleasedCount}/{totalAssessments})
                            </span>
                          ) : (
                            <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Not Published
                            </span>
                          )}

                          {/* Assessment Pills Breakdown */}
                          {sub.marks?.assessments && (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {['CIE1', 'CIE2', 'ASSIGNMENT', 'FINAL_INTERNAL', 'EXTERNAL'].map((aType) => {
                                const isRel = sub.marks.assessments[aType]?.status === 'RELEASED';
                                const label = aType === 'FINAL_INTERNAL' ? 'Final' : aType === 'ASSIGNMENT' ? 'Asgn' : aType === 'EXTERNAL' ? 'SEE' : aType;
                                return (
                                  <span
                                    key={aType}
                                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                      isRel
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                                    }`}
                                  >
                                    {label} {isRel ? '✓' : ''}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 5. Attendance Action */}
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handlePublishAttendance(sub)}
                            disabled={isAttLoading}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                              attReleased
                                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                : 'bg-slate-900 hover:bg-black text-white shadow-2xs'
                            }`}
                          >
                            {actionLoading[`att_${sub.id}`] ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3 text-emerald-400" />
                            )}
                            <span>{attReleased ? 'Republish' : 'Publish Attendance'}</span>
                          </button>

                          {attReleased && (
                            <button
                              onClick={() => handleRevokeAttendance(sub)}
                              disabled={isAttLoading}
                              title="Conceal attendance for this subject"
                              className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer border border-rose-200 dark:border-rose-800"
                            >
                              {actionLoading[`att_revoke_${sub.id}`] ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Undo2 className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 6. Marks Action (Independent Components) */}
                      <td className="py-4 px-5 text-center">
                        <div className="relative inline-block text-left">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setOpenMarksMenu(openMarksMenu === sub.id ? null : sub.id)}
                              disabled={isMarksActionLoading}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs disabled:opacity-50"
                            >
                              {isMarksActionLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Award className="w-3 h-3 text-amber-300" />
                              )}
                              <span>{isAllMarksReleased ? 'Republish Marks' : marksReleasedCount > 0 ? 'Update Marks' : 'Publish Marks'}</span>
                              <ChevronDown className="w-3 h-3 opacity-70" />
                            </button>

                            {marksReleasedCount > 0 && (
                              <button
                                onClick={() => handleRevokeMarks(sub, 'ALL')}
                                disabled={isMarksActionLoading}
                                title="Conceal all released marks for this subject"
                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer border border-rose-200 dark:border-rose-800"
                              >
                                {actionLoading[`marks_revoke_${sub.id}`] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Undo2 className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Dropdown for Independent Assessment Component Release */}
                          {openMarksMenu === sub.id && (
                            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-30 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                              <span className="block px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                {marksReleasedCount > 0 ? 'Republish / Sync Component:' : 'Release Component:'}
                              </span>
                              {ASSESSMENT_OPTIONS.map((opt) => {
                                const isRel = opt.type !== 'ALL' && sub.marks?.assessments?.[opt.type]?.status === 'RELEASED';
                                const optLabel =
                                  opt.type === 'ALL'
                                    ? (isAllMarksReleased ? 'Republish All Assessments' : 'All Assessments')
                                    : (isRel ? `Republish ${opt.label}` : opt.label);
                                return (
                                  <button
                                    key={opt.type}
                                    onClick={() => handlePublishMarks(sub, opt.type)}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
                                  >
                                    <span>{optLabel}</span>
                                    {isRel && (
                                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                                        Live ✓
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodPublishAttendanceMarksPage;
