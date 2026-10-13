import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Award,
  Send,
  Loader2,
  Undo2,
  Check,
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

interface HodAcademicReleaseModuleProps {
  dedicatedPage?: boolean;
}

export const HodAcademicReleaseModule: React.FC<HodAcademicReleaseModuleProps> = ({
  dedicatedPage = false,
}) => {
  const { academicYear } = useAcademicYear();

  // State
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [semesterCards, setSemesterCards] = useState<HodReleaseSemesterCard[]>([]);
  const [subjects, setSubjects] = useState<HodReleaseSubjectItem[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState<boolean>(true);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);

  // Global Action States (Strictly Zero Popups)
  const [releasingAttendance, setReleasingAttendance] = useState<boolean>(false);
  const [revokingAttendance, setRevokingAttendance] = useState<boolean>(false);
  const [releasingMarks, setReleasingMarks] = useState<boolean>(false);
  const [revokingMarks, setRevokingMarks] = useState<boolean>(false);
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>('ALL');

  // 1. Fetch authorized semesters
  const fetchSemesters = async () => {
    setLoadingSemesters(true);
    try {
      const cards = await hodService.getReleaseSemesters({ academicYear });
      setSemesterCards(cards || []);
    } catch (err: any) {
      console.error('Failed to load release semesters:', err);
      toast.error(err.response?.data?.error || 'Failed to load authorized semesters.');
    } finally {
      setLoadingSemesters(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
    setSelectedSemester(null);
    setSubjects([]);
  }, [academicYear]);

  // 2. Automatically load subjects for selected semester
  const fetchSemesterSubjects = async (sem: number) => {
    setLoadingSubjects(true);
    try {
      const subList = await hodService.getReleaseSemesterSubjects(sem, { academicYear });
      setSubjects(subList || []);
    } catch (err: any) {
      console.error('Failed to load semester subjects:', err);
      toast.error(err.response?.data?.error || `Failed to load subjects for Semester ${sem}.`);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleSelectSemester = (sem: number) => {
    setSelectedSemester(sem);
    fetchSemesterSubjects(sem);
  };

  const handleBackToSemesters = () => {
    setSelectedSemester(null);
    setSubjects([]);
    fetchSemesters();
  };

  // ─── GLOBAL ATTENDANCE ACTIONS (ZERO POPUPS) ───────────────────────────────
  const handleGlobalReleaseAttendance = async () => {
    if (!selectedSemester) return;
    setReleasingAttendance(true);
    try {
      const res = await hodService.confirmSemesterAttendanceRelease({
        semester: selectedSemester,
        academicYear,
      });
      toast.success(res.message || `Attendance published for all Semester ${selectedSemester} subjects!`);
      await fetchSemesterSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Failed to release semester attendance:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to release attendance.');
    } finally {
      setReleasingAttendance(false);
    }
  };

  const handleGlobalRevokeAttendance = async () => {
    if (!selectedSemester) return;
    setRevokingAttendance(true);
    try {
      const res = await hodService.revokeSemesterAttendanceRelease({
        semester: selectedSemester,
        academicYear,
      });
      toast.success(res.message || `Attendance concealed for Semester ${selectedSemester}.`);
      await fetchSemesterSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Failed to revoke semester attendance:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to revoke attendance.');
    } finally {
      setRevokingAttendance(false);
    }
  };

  // ─── GLOBAL MARKS ACTIONS (ZERO POPUPS) ────────────────────────────────────
  const handleGlobalReleaseMarks = async () => {
    if (!selectedSemester) return;
    setReleasingMarks(true);
    try {
      const res = await hodService.confirmSemesterMarksRelease({
        semester: selectedSemester,
        academicYear,
        assessmentType: selectedAssessmentType,
      });
      const activeLabel = ASSESSMENT_OPTIONS.find((o) => o.type === selectedAssessmentType)?.label || 'Marks';
      toast.success(res.message || `${activeLabel} published for Semester ${selectedSemester} subjects!`);
      await fetchSemesterSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Failed to release semester marks:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to release marks.');
    } finally {
      setReleasingMarks(false);
    }
  };

  const handleGlobalRevokeMarks = async () => {
    if (!selectedSemester) return;
    setRevokingMarks(true);
    try {
      const res = await hodService.revokeSemesterMarksRelease({
        semester: selectedSemester,
        academicYear,
        assessmentType: selectedAssessmentType,
      });
      toast.success(res.message || `Marks concealed for Semester ${selectedSemester}.`);
      await fetchSemesterSubjects(selectedSemester);
      fetchSemesters();
    } catch (err: any) {
      console.error('Failed to revoke semester marks:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to revoke marks.');
    } finally {
      setRevokingMarks(false);
    }
  };

  // Computed summary metrics for active semester
  const attPublishedCount = subjects.filter((s) => s.attendance?.isReleased).length;
  const isAllAttendancePublished = subjects.length > 0 && attPublishedCount === subjects.length;

  const totalPossibleMarks = subjects.length * 5; // 5 supported assessments
  const totalReleasedMarks = subjects.reduce((sum, s) => sum + (s.marks?.releasedCount || 0), 0);
  const isAllMarksPublished = subjects.length > 0 && totalReleasedMarks === totalPossibleMarks;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ── CLEAN, MINIMAL HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Official Academic Publication
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Publish consolidated attendance registers and evaluation marks to student portals.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>AY: {academicYear}</span>
          </span>
          <button
            onClick={() => {
              if (selectedSemester) fetchSemesterSubjects(selectedSemester);
              fetchSemesters();
            }}
            title="Refresh"
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSemesters || loadingSubjects ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── WORKFLOW VIEWS ─────────────────────────────────────────────────── */}
      {!selectedSemester ? (
        /* ═══════════════════════════════════════════════════════════════════════
           STEP 1 — CLEAN SEMESTER SELECTION
        ═══════════════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Step 1
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Select Authorized Semester
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {semesterCards.length} Managed Semester{semesterCards.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loadingSemesters ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : semesterCards.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">No Authorized Semesters</h4>
              <p className="text-xs text-slate-500">No active semester mapping found for your department scope.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {semesterCards.map((card) => {
                const attPct = card.attendanceRelease?.percentage || 0;
                const marksPct = card.marksRelease?.percentage || 0;
                const isFullyDone = attPct === 100 && marksPct === 100;

                return (
                  <div
                    key={card.semester}
                    onClick={() => handleSelectSemester(card.semester)}
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {card.departmentScope || 'Department Scope'}
                        </span>
                        <h4 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                          Semester {card.semester}
                        </h4>
                        <span className="inline-block mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {card.totalSubjects} Active Subject{card.totalSubjects !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isFullyDone
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}>
                        {isFullyDone ? <CheckCircle2 className="w-5 h-5" /> : `Sem ${card.semester}`}
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex justify-between items-center text-[11px] mb-1">
                          <span className="text-slate-500 font-medium">Attendance</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {card.attendanceRelease?.released || 0}/{card.attendanceRelease?.total || 0} ({attPct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${attPct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${attPct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-[11px] mb-1">
                          <span className="text-slate-500 font-medium">Marks</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {card.marksRelease?.releasedAssessments || 0}/{card.marksRelease?.totalAssessments || 0} ({marksPct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${marksPct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${marksPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform pt-1">
                      <span>Open Semester</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════════
           STEP 2 — DEDICATED SEMESTER WORKSPACE WITH GLOBAL CONTROLS ONLY
        ═══════════════════════════════════════════════════════════════════════ */
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Top Bar Navigation & Quick Semester Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToSemesters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Semesters</span>
              </button>

              {/* Quick Semester Switcher Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                {semesterCards.map((c) => (
                  <button
                    key={c.semester}
                    onClick={() => handleSelectSemester(c.semester)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedSemester === c.semester
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    Sem {c.semester}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">
                {subjects.length} Active Subject{subjects.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => fetchSemesterSubjects(selectedSemester)}
                disabled={loadingSubjects}
                title="Refresh Subjects"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSubjects ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* ── GLOBAL ACTION CONTROLS PANEL (ZERO POPUPS) ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Global Attendance Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      Attendance Publication
                    </h4>
                    <span className="text-xs text-slate-400">
                      {attPublishedCount} of {subjects.length} Subjects Published
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    isAllAttendancePublished
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : attPublishedCount > 0
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {isAllAttendancePublished ? 'All Published' : attPublishedCount > 0 ? 'Partially Published' : 'Pending'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleGlobalReleaseAttendance}
                  disabled={releasingAttendance || revokingAttendance || subjects.length === 0}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {releasingAttendance ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Releasing Attendance...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isAllAttendancePublished ? 'Re-publish All Attendance' : 'Release All Attendance'}</span>
                    </>
                  )}
                </button>

                {attPublishedCount > 0 && (
                  <button
                    onClick={handleGlobalRevokeAttendance}
                    disabled={revokingAttendance || releasingAttendance}
                    title="Conceal attendance from student portals"
                    className="px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-bold transition-colors cursor-pointer border border-rose-200 dark:border-rose-800 flex items-center gap-1.5"
                  >
                    {revokingAttendance ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="w-3.5 h-3.5" />
                    )}
                    <span>Revoke</span>
                  </button>
                )}
              </div>
            </div>

            {/* Global Marks Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      Evaluation Marks Publication
                    </h4>
                    <span className="text-xs text-slate-400">
                      {totalReleasedMarks} of {totalPossibleMarks} Marks Published
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    isAllMarksPublished
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : totalReleasedMarks > 0
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {isAllMarksPublished ? 'All Released' : totalReleasedMarks > 0 ? 'Partially Released' : 'Pending'}
                </span>
              </div>

              {/* Assessment Selector Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {ASSESSMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => setSelectedAssessmentType(opt.type)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      selectedAssessmentType === opt.type
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleGlobalReleaseMarks}
                  disabled={releasingMarks || revokingMarks || subjects.length === 0}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {releasingMarks ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Releasing Marks...</span>
                    </>
                  ) : (
                    <>
                      <Award className="w-3.5 h-3.5 text-amber-300" />
                      <span>Release {ASSESSMENT_OPTIONS.find((o) => o.type === selectedAssessmentType)?.label || 'Marks'}</span>
                    </>
                  )}
                </button>

                {totalReleasedMarks > 0 && (
                  <button
                    onClick={handleGlobalRevokeMarks}
                    disabled={revokingMarks || releasingMarks}
                    title="Conceal marks from student portals"
                    className="px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-bold transition-colors cursor-pointer border border-rose-200 dark:border-rose-800 flex items-center gap-1.5"
                  >
                    {revokingMarks ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="w-3.5 h-3.5" />
                    )}
                    <span>Revoke</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── AUTOMATICALLY LOADED SUBJECTS LIST (NO INDIVIDUAL BUTTONS) ─── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Semester {selectedSemester} Subjects Status
              </h4>
              <span className="text-[11px] text-slate-400 font-medium">
                Statuses update automatically upon global release
              </span>
            </div>

            {loadingSubjects ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
                ))}
              </div>
            ) : subjects.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs">No Active Subjects Found</h5>
                <p className="text-[11px] text-slate-400">No active subjects mapped to Semester {selectedSemester}.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {subjects.map((sub) => {
                  const attReleased = sub.attendance?.isReleased;
                  const marksReleasedCount = sub.marks?.releasedCount || 0;
                  const totalAssessments = sub.marks?.totalAssessments || 5;

                  return (
                    <div
                      key={sub.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all space-y-3"
                    >
                      {/* Subject Info */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                              {sub.code}
                            </span>
                            {sub.cycle && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                {sub.cycle.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <h5 className="font-extrabold text-slate-900 dark:text-white text-xs mt-1.5 line-clamp-1">
                            {sub.name}
                          </h5>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                          {sub.credits} Credits
                        </span>
                      </div>

                      {/* Status Row */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                        {/* Attendance Status */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 font-medium text-[10px]">Attendance</span>
                          <span
                            className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${
                              attReleased
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {attReleased ? 'Published' : 'Pending'}
                          </span>
                        </div>

                        {/* Marks Status */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 font-medium text-[10px]">Marks</span>
                          <span
                            className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${
                              marksReleasedCount === totalAssessments
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : marksReleasedCount > 0
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {marksReleasedCount === totalAssessments
                              ? 'All Released'
                              : marksReleasedCount > 0
                              ? `${marksReleasedCount}/${totalAssessments}`
                              : 'Pending'}
                          </span>
                        </div>
                      </div>

                      {/* Assessment Badges */}
                      {sub.marks?.assessments && (
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          {['CIE1', 'CIE2', 'ASSIGNMENT', 'FINAL_INTERNAL', 'EXTERNAL'].map((aType) => {
                            const isRel = sub.marks.assessments[aType]?.status === 'RELEASED';
                            const shortLabel = aType === 'FINAL_INTERNAL' ? 'FINAL' : aType === 'ASSIGNMENT' ? 'ASGN' : aType;
                            return (
                              <span
                                key={aType}
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                  isRel
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60'
                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                                }`}
                              >
                                {shortLabel} {isRel ? '✓' : ''}
                              </span>
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
        </div>
      )}
    </div>
  );
};

export default HodAcademicReleaseModule;
