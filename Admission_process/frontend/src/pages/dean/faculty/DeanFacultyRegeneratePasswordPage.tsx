import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  RefreshCw,
  Loader2,
  Lock,
  ChevronRight,
  User,
  Building2,
  Mail,
  BadgeCheck,
  AlertTriangle
} from 'lucide-react';
import deanService, { FacultyProfileResponse } from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

export const DeanFacultyRegeneratePasswordPage: React.FC = () => {
  const { id, facultyId } = useParams<{ id?: string; facultyId?: string }>();
  const navigate = useNavigate();
  const targetId = id || facultyId;

  // Profile data state
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<FacultyProfileResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form & Action state
  const [identityVerified, setIdentityVerified] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Credential result state (stored only in component memory for one-time display)
  const [regeneratedCredentials, setRegeneratedCredentials] = useState<{
    facultyName: string;
    loginEmail: string;
    temporaryPassword: string;
  } | null>(null);

  // Copy feedback states
  const [copiedPassword, setCopiedPassword] = useState<boolean>(false);
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  // Fetch real faculty profile
  const fetchFacultyProfile = async () => {
    if (!targetId) return;
    try {
      setLoading(true);
      setFetchError(null);
      const data = await deanService.getFacultyProfile(targetId);
      setProfile(data);
    } catch (err: any) {
      console.error('Failed to load faculty details for password regeneration:', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load faculty profile record.';
      setFetchError(msg);
      toast.error(msg, { toastId: 'faculty-fetch-err' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyProfile();
  }, [targetId]);

  // Submission handler
  const handleRegeneratePassword = async () => {
    if (!targetId || !identityVerified || isRegenerating) return;

    try {
      setIsRegenerating(true);
      setActionError(null);

      const res = await deanService.regenerateFacultyPassword(targetId);
      setRegeneratedCredentials(res);
      toast.success('Temporary password generated successfully.');
    } catch (err: any) {
      console.error('Password regeneration failed:', err);
      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to regenerate faculty password. Please try again.';
      setActionError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Copy temporary password
  const handleCopyPassword = () => {
    if (!regeneratedCredentials?.temporaryPassword) return;
    navigator.clipboard.writeText(regeneratedCredentials.temporaryPassword);
    setCopiedPassword(true);
    toast.success('Temporary password copied to clipboard');
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Copy email
  const handleCopyEmail = (emailStr: string) => {
    if (!emailStr) return;
    navigator.clipboard.writeText(emailStr);
    setCopiedEmail(true);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Download credentials securely as txt file
  const handleDownloadCredentials = () => {
    if (!regeneratedCredentials) return;
    const content =
      `JCER ERP - FACULTY CREDENTIALS\n` +
      `----------------------------------------\n` +
      `Faculty Name:       ${regeneratedCredentials.facultyName}\n` +
      `Login Email:        ${regeneratedCredentials.loginEmail}\n` +
      `Temporary Password: ${regeneratedCredentials.temporaryPassword}\n` +
      `Generated Date:     ${new Date().toLocaleString()}\n` +
      `----------------------------------------\n` +
      `SECURITY NOTICE:\n` +
      `- The faculty member must change this temporary password upon first login.\n` +
      `- Share these credentials only through authorized, secure channels.\n` +
      `- Do not distribute plain text credentials via insecure public chat or paper notes.\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Credentials_${regeneratedCredentials.loginEmail.split('@')[0]}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Credentials downloaded successfully.');
  };

  // Loading Skeleton View
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-fade-in">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32 rounded-lg" />
          <Skeleton className="h-4 w-4 rounded-lg" />
          <Skeleton className="h-4 w-28 rounded-lg" />
          <Skeleton className="h-4 w-4 rounded-lg" />
          <Skeleton className="h-4 w-40 rounded-lg" />
        </div>
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-52 w-full rounded-3xl" />
      </div>
    );
  }

  // Error State View (Record not found or failed to load)
  if (fetchError || !profile) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-5 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200/60 dark:border-rose-900/40">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-neutral-900 dark:text-white">
            Unable to Load Faculty Record
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {fetchError || 'The requested faculty profile could not be retrieved from the server.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/dean/faculty')}
            className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Faculty Directory
          </button>
          <button
            type="button"
            onClick={fetchFacultyProfile}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition-colors cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  const { faculty, account } = profile;
  const isArchived = faculty.status === 'ARCHIVED';
  const facultyIdFormatted =
    (faculty as any).facultyId ||
    `JCER-${faculty.coreDepartment?.code || 'FAC'}-${faculty.id ? faculty.id.slice(0, 6).toUpperCase() : '000000'}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* ── BREADCRUMB & BACK ACTION ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center flex-wrap gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400"
        >
          <Link
            to="/dean/faculty"
            className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            Faculty Management
          </Link>
          <ChevronRight size={14} className="text-neutral-400 dark:text-neutral-600 shrink-0" />
          <Link
            to="/dean/faculty"
            className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            Faculty List
          </Link>
          <ChevronRight size={14} className="text-neutral-400 dark:text-neutral-600 shrink-0" />
          <Link
            to={`/dean/faculty/${targetId}`}
            className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            Faculty Details
          </Link>
          <ChevronRight size={14} className="text-neutral-400 dark:text-neutral-600 shrink-0" />
          <span className="font-bold text-neutral-900 dark:text-white">Regenerate Password</span>
        </nav>

        <button
          type="button"
          onClick={() => navigate(`/dean/faculty/${targetId}`)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <ArrowLeft size={14} />
          <span>Back to Faculty Details</span>
        </button>
      </div>

      {/* ── PAGE HEADER ── */}
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-xs shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                Regenerate Faculty Password
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Securely reset login credentials for a faculty account
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                faculty.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60'
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60'
              }`}
            >
              {faculty.status === 'ACTIVE' ? 'Active Account' : 'Archived Account'}
            </span>
          </div>
        </div>
      </div>

      {/* ── FACULTY IDENTITY CARD ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-7 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-4">
          <h2 className="text-xs uppercase font-black tracking-widest text-neutral-400 dark:text-neutral-500 flex items-center gap-2">
            <User size={14} className="text-violet-500" />
            Faculty Account Details
          </h2>
          <span className="text-[11px] font-mono font-bold text-neutral-400 dark:text-neutral-500">
            ID: {facultyIdFormatted}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <ProfileAvatar
            imageUrl={faculty.profileImage}
            name={faculty.name}
            size="custom"
            roundedClassName="rounded-2xl"
            fallbackType="icon"
            className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-neutral-200 dark:border-neutral-700 shadow-xs shrink-0"
          />

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {/* Faculty Full Name */}
            <div className="p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/70">
              <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 block mb-1">
                Faculty Full Name
              </span>
              <p className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wide">
                {faculty.name}
              </p>
            </div>

            {/* Department */}
            <div className="p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/70">
              <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 block mb-1">
                Department
              </span>
              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                {faculty.coreDepartment?.name || 'Department'} ({faculty.coreDepartment?.code || '—'})
              </p>
            </div>

            {/* Designation */}
            <div className="p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/70">
              <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 block mb-1">
                Designation
              </span>
              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                {faculty.designation || 'Faculty Member'}
              </p>
            </div>

            {/* Login Email */}
            <div className="p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 block mb-1">
                  Login Email
                </span>
                <p className="text-xs font-mono font-bold text-neutral-900 dark:text-white truncate max-w-[220px]">
                  {account?.email || faculty.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyEmail(account?.email || faculty.email)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer"
                title="Copy Email"
              >
                {copiedEmail ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* ── ARCHIVED STATUS WARNING (IF APPLICABLE) ── */}
      {isArchived && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-black uppercase text-rose-900 dark:text-rose-200">
              Password Regeneration Disabled
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-300">
              This faculty account is currently archived. Password regeneration is blocked for archived accounts to safeguard institutional records. Please restore the account from the faculty detail page before resetting credentials.
            </p>
          </div>
        </div>
      )}

      {/* ── INLINE ERROR ALERT (IF SUBMISSION FAILED) ── */}
      {actionError && !regeneratedCredentials && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-rose-900 dark:text-rose-200">
                Password Regeneration Request Failed
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                {actionError}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── SUCCESS RESULT STATE (ONE-TIME DISPLAY) ── */}
      {regeneratedCredentials ? (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md space-y-6 animate-fade-in">
          <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-900/60">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900 dark:text-white">
                Temporary Password Generated Successfully
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Institutional audit record logged. Provide the credential below to the faculty member.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-50/80 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/80 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 block mb-0.5">
                  Faculty Name
                </span>
                <span className="text-sm font-black text-neutral-900 dark:text-white">
                  {regeneratedCredentials.facultyName}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 block mb-0.5">
                  Login Email
                </span>
                <span className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200">
                  {regeneratedCredentials.loginEmail}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 block mb-1.5">
                New Temporary Password (One-Time Display)
              </span>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-neutral-900 border-2 border-emerald-500/50 shadow-xs">
                <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400 tracking-wider">
                  {regeneratedCredentials.temporaryPassword}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition-colors cursor-pointer"
                  title="Copy Temporary Password"
                >
                  {copiedPassword ? (
                    <>
                      <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 text-neutral-600 dark:text-neutral-400 text-xs space-y-1">
            <p className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <Lock size={13} className="text-amber-500" />
              Confidential Delivery Advisory
            </p>
            <p className="text-[11px] leading-relaxed">
              For security compliance, this credential will not be stored in unencrypted browser storage or shown again once you navigate away from this page. Provide these credentials securely to the faculty member.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadCredentials}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Download Credentials (.txt)</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/dean/faculty/${targetId}`)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Return to Faculty Details</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── CONFIRMATION SECTION ── */
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <BadgeCheck size={16} className="text-violet-500" />
              Confirm Password Regeneration
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Confirm your administrative authorization to regenerate temporary login credentials for this faculty member.
            </p>
          </div>

          {/* Verification Checkbox */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/80">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={identityVerified}
                onChange={(e) => setIdentityVerified(e.target.checked)}
                disabled={isRegenerating || isArchived}
                className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500/30 border-neutral-300 dark:border-neutral-700 cursor-pointer"
              />
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 leading-relaxed">
                I have verified this faculty member's identity and understand the impact.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(`/dean/faculty/${targetId}`)}
              disabled={isRegenerating}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleRegeneratePassword}
              disabled={!identityVerified || isRegenerating || isArchived}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                identityVerified && !isRegenerating && !isArchived
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 cursor-pointer active:scale-98'
                  : 'bg-neutral-400 dark:bg-neutral-700 opacity-50 cursor-not-allowed shadow-none'
              }`}
            >
              {isRegenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Regenerating Temporary Password...</span>
                </>
              ) : (
                <>
                  <KeyRound size={14} />
                  <span>Regenerate Temporary Password</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanFacultyRegeneratePasswordPage;
