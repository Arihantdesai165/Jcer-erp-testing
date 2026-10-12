import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Archive,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Building2,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  RefreshCw,
  User,
  Info
} from 'lucide-react';
import deanService, { FacultyProfileResponse } from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

export const DeanArchiveFacultyPage: React.FC = () => {
  const { id, facultyId } = useParams<{ id?: string; facultyId?: string }>();
  const navigate = useNavigate();
  const targetId = id || facultyId;

  // Profile data state
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<FacultyProfileResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Archive action state
  const [confirmedAcknowledgement, setConfirmedAcknowledgement] = useState<boolean>(false);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchFacultyProfile = async () => {
    if (!targetId) return;
    try {
      setLoading(true);
      setFetchError(null);
      const data = await deanService.getFacultyProfile(targetId);
      setProfile(data);
    } catch (err: any) {
      console.error('Failed to load faculty details for archival:', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load faculty profile record.';
      setFetchError(msg);
      toast.error(msg, { toastId: 'faculty-archive-fetch-err' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyProfile();
  }, [targetId]);

  const handleConfirmArchive = async () => {
    if (!targetId || !confirmedAcknowledgement || isArchiving) return;

    try {
      setIsArchiving(true);
      setActionError(null);

      await deanService.archiveFaculty(targetId);
      toast.success(
        profile?.faculty?.name
          ? `Faculty ${profile.faculty.name} archived successfully.`
          : 'Faculty archived successfully.'
      );

      // Navigate to Archived Faculty directory
      navigate('/dean/faculty/archived', { replace: true });
    } catch (err: any) {
      console.error('Failed to archive faculty:', err);
      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to archive faculty. Please try again.';
      setActionError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 animate-pulse">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-xl" />
          <Skeleton className="w-48 h-6 rounded-lg" />
        </div>
        <Skeleton className="w-full h-44 rounded-3xl" />
        <Skeleton className="w-full h-56 rounded-3xl" />
        <Skeleton className="w-full h-32 rounded-3xl" />
      </div>
    );
  }

  if (fetchError || !profile) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4 my-8">
        <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-neutral-900 dark:text-white">Unable to Load Faculty Record</h2>
        <p className="text-xs text-neutral-500 max-w-md mx-auto">{fetchError || 'Faculty record not found.'}</p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/dean/faculty')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Back to Directory
          </button>
          <button
            onClick={fetchFacultyProfile}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { faculty, teachingAssignments = [] } = profile;
  const isAlreadyArchived = faculty.status === 'ARCHIVED';

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 pb-20 text-neutral-900 dark:text-neutral-100 animate-in fade-in duration-150">
      
      {/* ── TOP BREADCRUMB & BACK ACTION ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200/80 dark:border-neutral-800/80 pb-4">
        <Link
          to="/dean/faculty"
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors group cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span>Back to Faculty Directory</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3" />
            Dean Faculty Archival Protocol
          </span>
        </div>
      </div>

      {/* ── PAGE TITLE BANNER ── */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-rose-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-2 border border-neutral-800 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/10 text-white text-[11px] font-extrabold tracking-wide backdrop-blur-sm border border-white/10">
            <Archive className="w-3.5 h-3.5 text-rose-400" />
            CONFIRMATION REQUIRED
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 text-white">
            Archive Faculty Member
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl font-medium leading-relaxed">
            You are about to archive this faculty member from active college operations. Review their identity, academic assignments, and historical data preservation below.
          </p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-rose-500/10 to-transparent pointer-events-none" />
      </div>

      {/* ── ALREADY ARCHIVED NOTICE ── */}
      {isAlreadyArchived && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              Faculty is Already Archived
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              This faculty member has already been archived. To view archived records or restore this faculty member to the active directory, visit the Archived Faculty page.
            </p>
            <div className="pt-2">
              <Link
                to="/dean/faculty/archived"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Go to Archived Faculty Directory
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION ERROR ALERT ── */}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div className="text-xs space-y-1">
            <p className="font-black uppercase tracking-wider">Archival Failed</p>
            <p className="font-medium">{actionError}</p>
          </div>
        </div>
      )}

      {/* ── FACULTY PROFILE DETAILS CARD ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <h2 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Faculty Profile Information
          </h2>
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              faculty.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60'
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
            }`}
          >
            {faculty.status}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <ProfileAvatar
            name={faculty.name}
            imageUrl={faculty.profileImage}
            size="xl"
            className="ring-4 ring-neutral-100 dark:ring-neutral-800 shadow-md shrink-0"
          />

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-neutral-900 dark:text-white truncate">
                {faculty.name}
              </h3>
              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-[11px] font-black border border-indigo-200/60 dark:border-indigo-900/60">
                {faculty.designation}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-neutral-600 dark:text-neutral-300">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="font-medium truncate">{faculty.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {faculty.coreDepartment?.name} ({faculty.coreDepartment?.code})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>{faculty.phone || 'Phone not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>Joined {faculty.joiningDate ? new Date(faculty.joiningDate).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Identifier row */}
        <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Faculty ID:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-white">
              {faculty.facultyId || faculty.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">User Account ID:</span>
            <span className="font-mono text-neutral-500 text-[11px]">{faculty.userId || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* ── ACADEMIC HISTORY PRESERVATION BOX (CRITICAL REQUIREMENT) ── */}
      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 rounded-3xl border border-emerald-200 dark:border-emerald-900/60 p-6 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
              Academic History &amp; Records Preservation Protocol
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              Archiving is non-destructive. All existing academic work and historical records remain permanently immutable.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-emerald-100 dark:border-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-neutral-900 dark:text-white block">Attendance Sessions &amp; Records</span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                All daily class attendance sessions and student present/absent logs are permanently retained in PostgreSQL and Google Drive backups.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-emerald-100 dark:border-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-neutral-900 dark:text-white block">CIE Marks &amp; Student Evaluations</span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Continuous Internal Evaluation marks, component breakdowns, and test scores recorded by this faculty member remain 100% intact.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-emerald-100 dark:border-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-neutral-900 dark:text-white block">Accreditation &amp; Teaching History</span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Historical teaching assignments and subject load records are preserved for NBA, NAAC, and VTU academic inspection audits.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-emerald-100 dark:border-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-neutral-900 dark:text-white block">Full Dean Audit Log Traceability</span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Archival details, operator identity, IP address, and timestamp are safely committed to system audit logs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TEACHING RESPONSIBILITIES / IMPACT WARNING (IF ANY) ── */}
      {teachingAssignments.length > 0 && (
        <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-3xl border border-amber-200 dark:border-amber-900/60 p-6 sm:p-7 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Active Teaching Responsibilities ({teachingAssignments.length})
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                This faculty member is currently assigned to {teachingAssignments.length} subject section{teachingAssignments.length === 1 ? '' : 's'}. Respective departmental HODs can safely reassign these sections without losing existing student attendance.
              </p>
            </div>
          </div>

          <div className="divide-y divide-amber-200/60 dark:divide-amber-900/40 bg-white dark:bg-neutral-900 rounded-2xl border border-amber-100 dark:border-amber-950 overflow-hidden">
            {teachingAssignments.map((a, idx) => (
              <div key={a.id || idx} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-black text-neutral-900 dark:text-white block">
                    {a.subject} <span className="font-mono text-neutral-400">({a.subjectCode})</span>
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Dept: <span className="font-bold text-neutral-700 dark:text-neutral-300">{a.teachingDepartmentCode}</span> &bull; Sem {a.semester} &bull; Section {a.section}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60">
                  AY {a.academicYear}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONSEQUENCES & EXPLICIT CONFIRMATION SAFEGUARD ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-rose-600" />
            Consequences of Archival
          </h3>
          <ul className="text-xs text-neutral-600 dark:text-neutral-300 space-y-2 list-disc list-inside leading-relaxed font-medium">
            <li>
              The faculty login account (<code className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{faculty.email}</code>) will be immediately <strong className="text-rose-600 dark:text-rose-400">deactivated</strong> (<code className="font-mono text-[11px]">User.status = 'INACTIVE'</code>).
            </li>
            <li>
              The faculty member will be removed from all active Faculty Directory tables and active HOD teaching allocation dropdowns.
            </li>
            <li>
              The record will be moved to the <strong className="text-neutral-900 dark:text-white">Archived Faculty Directory</strong> where it can be inspected or restored at any time by Dean Academics.
            </li>
          </ul>
        </div>

        {/* Confirmation Checkbox Requirement */}
        {!isAlreadyArchived && (
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 cursor-pointer hover:bg-rose-50 transition-colors">
              <input
                type="checkbox"
                checked={confirmedAcknowledgement}
                onChange={(e) => setConfirmedAcknowledgement(e.target.checked)}
                disabled={isArchiving}
                className="mt-0.5 rounded accent-rose-600 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-bold text-rose-900 dark:text-rose-200 leading-snug">
                I confirm that I want to deactivate and archive <strong className="underline">{faculty.name}</strong> from the active faculty directory according to institutional policies.
              </span>
            </label>
          </div>
        )}

        {/* Actions Grid */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/dean/faculty')}
            disabled={isArchiving}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer"
          >
            Cancel &amp; Return to Directory
          </button>

          {!isAlreadyArchived ? (
            <button
              type="button"
              onClick={handleConfirmArchive}
              disabled={!confirmedAcknowledgement || isArchiving}
              className={`w-full sm:w-auto px-7 py-3 rounded-2xl text-xs font-black text-white flex items-center justify-center gap-2 transition-all shadow-lg ${
                confirmedAcknowledgement && !isArchiving
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 active:scale-[0.98] cursor-pointer'
                  : 'bg-neutral-300 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 shadow-none cursor-not-allowed'
              }`}
            >
              {isArchiving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Archiving Faculty...</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  <span>Confirm &amp; Archive Faculty</span>
                </>
              )}
            </button>
          ) : (
            <Link
              to="/dean/faculty/archived"
              className="w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 transition-colors text-center shadow-md cursor-pointer"
            >
              View in Archived Directory
            </Link>
          )}
        </div>
      </div>

    </div>
  );
};

export default DeanArchiveFacultyPage;
