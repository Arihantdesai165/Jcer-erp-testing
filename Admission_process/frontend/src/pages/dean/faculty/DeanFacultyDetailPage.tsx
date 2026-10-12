import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  GraduationCap,
  ShieldCheck,
  KeyRound,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  Clock,
  Layers,
  Copy,
  Check,
  Download,
  RefreshCw,
  Trash2,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  X,
  Printer,
  Search,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import deanService, { FacultyProfileResponse } from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

interface FormFieldProps {
  label: string;
  value?: any;
  onCopy?: () => void;
  copied?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({ label, value, onCopy, copied }) => {
  return (
    <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/80 rounded-lg transition-all flex flex-col gap-1.5 justify-between">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none">
          {label}
        </p>
        {onCopy && value && value !== '—' && (
          <button
            type="button"
            onClick={onCopy}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-0.5 cursor-pointer"
            title={`Copy ${label}`}
          >
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          </button>
        )}
      </div>
      <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate leading-tight">
        {value !== null && value !== undefined && value !== '' ? String(value) : '—'}
      </p>
    </div>
  );
};

export const DeanFacultyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<FacultyProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'details' | 'teaching' | 'attendance' | 'security'>('details');

  // Copy States
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Password Regeneration Modal State
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<boolean>(false);
  const [regenerateInputText, setRegenerateInputText] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [regeneratedCredentials, setRegeneratedCredentials] = useState<{
    facultyName: string;
    loginEmail: string;
    temporaryPassword: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState<boolean>(false);

  // Archive / Soft Delete Modal State
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<boolean>(false);
  const [archiveInputText, setArchiveInputText] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  // Restore State
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Sub-table search filters
  const [attendanceSearch, setAttendanceSearch] = useState<string>('');

  const fetchProfile = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await deanService.getFacultyProfile(id);
      setProfile(data);
    } catch (err: any) {
      console.error('Failed to load faculty details:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to load faculty profile.';
      setError(msg);
      toast.error(msg, { toastId: 'faculty-detail-fetch-error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  // Copy helper
  const handleCopy = (text: string, type: 'email' | 'phone' | 'id') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      toast.success('Email copied to clipboard');
      setTimeout(() => setCopiedEmail(false), 2000);
    } else if (type === 'phone') {
      setCopiedPhone(true);
      toast.success('Phone number copied to clipboard');
      setTimeout(() => setCopiedPhone(false), 2000);
    } else if (type === 'id') {
      setCopiedId(true);
      toast.success('Faculty ID copied');
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Password Regeneration Handlers
  const handleConfirmRegenerate = async () => {
    if (!id || regenerateInputText !== 'REGENERATE') return;

    try {
      setIsRegenerating(true);
      const res = await deanService.regenerateFacultyPassword(id);
      setRegeneratedCredentials(res);
      setShowRegenerateConfirm(false);
      setRegenerateInputText('');
      toast.success('Password regenerated successfully.');
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to regenerate password.';
      toast.error(errMsg);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyPassword = () => {
    if (!regeneratedCredentials?.temporaryPassword) return;
    navigator.clipboard.writeText(regeneratedCredentials.temporaryPassword);
    setCopiedPassword(true);
    toast.success('Temporary password copied to clipboard!');
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const handleDownloadCredentials = () => {
    if (!regeneratedCredentials) return;
    const content =
      `JCER ERP - FACULTY CREDENTIALS\n` +
      `----------------------------------------\n` +
      `Faculty Name: ${regeneratedCredentials.facultyName}\n` +
      `Login Email: ${regeneratedCredentials.loginEmail}\n` +
      `Temporary Password: ${regeneratedCredentials.temporaryPassword}\n` +
      `Generated Date: ${new Date().toLocaleString()}\n` +
      `Security Notice: Faculty must change this temporary password upon first login.\n`;

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

  // Archive / Soft Delete
  const handleConfirmArchive = async () => {
    if (!id || archiveInputText !== 'DELETE') return;

    try {
      setIsArchiving(true);
      await deanService.archiveFaculty(id);
      toast.success('Faculty archived successfully.');
      setShowArchiveConfirm(false);
      setArchiveInputText('');
      await fetchProfile();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to archive faculty.';
      toast.error(errMsg);
    } finally {
      setIsArchiving(false);
    }
  };

  // Restore Faculty
  const handleRestoreFaculty = async () => {
    if (!id) return;
    try {
      setIsRestoring(true);
      await deanService.restoreFaculty(id);
      toast.success('Faculty restored to active directory!');
      await fetchProfile();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to restore faculty.';
      toast.error(errMsg);
    } finally {
      setIsRestoring(false);
    }
  };

  // Calculate Tenure
  const calculateTenure = (joiningDateStr?: string) => {
    if (!joiningDateStr) return '—';
    const join = new Date(joiningDateStr);
    const now = new Date();
    if (isNaN(join.getTime())) return '—';

    let years = now.getFullYear() - join.getFullYear();
    let months = now.getMonth() - join.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years === 0 && months === 0) return 'Recent Joiner';
    if (years === 0) return `${months} month${months > 1 ? 's' : ''}`;
    if (months === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years} yrs, ${months} mo`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest animate-pulse">
          Loading Faculty Profile...
        </p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-10 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-4 shadow-xs max-w-lg mx-auto my-12">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200/60 dark:border-rose-900/40">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Faculty Record Not Found</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {error || 'Unable to retrieve faculty profile details.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/dean/faculty')}
            className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-800 dark:text-neutral-200 font-bold text-xs cursor-pointer"
          >
            Back to Directory
          </button>
          <button
            onClick={fetchProfile}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  const { faculty, account, teachingAssignments, historicalAssignments, attendanceHistory } = profile;
  const isArchived = faculty.status === 'ARCHIVED';

  const filteredAttendance = attendanceHistory.filter((att) => {
    if (!attendanceSearch.trim()) return true;
    const q = attendanceSearch.toLowerCase();
    return (
      att.subject?.toLowerCase().includes(q) ||
      att.subjectCode?.toLowerCase().includes(q) ||
      att.section?.toLowerCase().includes(q) ||
      att.date?.toLowerCase().includes(q)
    );
  });

  // Formatted ID
  const facultyIdFormatted = (faculty as any).facultyId || `JCER-${faculty.coreDepartment?.code || 'FAC'}-${faculty.id ? faculty.id.slice(0, 6).toUpperCase() : '000000'}`;


  // Attendance statistics
  const totalAttendancePresent = attendanceHistory.reduce((sum, a) => sum + (a.present || 0), 0);
  const totalAttendanceAbsent = attendanceHistory.reduce((sum, a) => sum + (a.absent || 0), 0);
  const totalAttendanceRounds = totalAttendancePresent + totalAttendanceAbsent;
  const overallAttendanceRate = totalAttendanceRounds > 0 ? Math.round((totalAttendancePresent / totalAttendanceRounds) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12">

      {/* Back Button & Action Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/dean/faculty')}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-850 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Faculty Directory
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/dean/faculty/assignments?search=${encodeURIComponent(faculty.name)}`)}
            className="px-4 py-2 bg-neutral-850 hover:bg-neutral-900 text-white dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
          >
            <BookOpen size={14} /> Subject Allocations
          </button>

          {!isArchived && (
            <button
              type="button"
              onClick={() => {
                setShowRegenerateConfirm(true);
                setRegenerateInputText('');
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
            >
              <KeyRound size={14} /> Regenerate Password
            </button>
          )}

          {isArchived ? (
            <button
              type="button"
              onClick={handleRestoreFaculty}
              disabled={isRestoring}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
            >
              <RotateCcw size={14} className={isRestoring ? 'animate-spin' : ''} />
              {isRestoring ? 'Restoring...' : 'Restore Faculty'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowArchiveConfirm(true);
                setArchiveInputText('');
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Trash2 size={14} /> Archive Faculty
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Printer size={14} /> Print Dossier
          </button>

          <button
            onClick={fetchProfile}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Refresh Record"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main Faculty Info Header Card (Identical Structure to StudentViewPage) */}
      <div className="bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md border border-neutral-200/50 dark:border-neutral-800/50 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <ProfileAvatar
            imageUrl={faculty.profileImage}
            name={faculty.name}
            size="custom"
            roundedClassName="rounded-2xl"
            fallbackType="icon"
            className="w-36 h-48 border-2 border-neutral-250 dark:border-neutral-750 shadow-sm shrink-0"
          />
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-wide">
                {faculty.name}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                  faculty.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-850 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-450 dark:border-emerald-900/50'
                    : 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/50'
                }`}
              >
                {faculty.status === 'ACTIVE' ? 'FACULTY ACTIVE' : 'ARCHIVED'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-neutral-500 mt-4">
              <span>Faculty ID: <strong className="text-neutral-700 dark:text-neutral-300 font-mono">{facultyIdFormatted}</strong></span>
              <span className="hidden sm:inline">•</span>
              <span>Department: <strong className="text-neutral-700 dark:text-neutral-300">{faculty.coreDepartment.name} ({faculty.coreDepartment.code})</strong></span>
              <span className="hidden sm:inline">•</span>
              <span>Designation: <strong className="text-neutral-700 dark:text-neutral-300">{faculty.designation}</strong></span>
              <span className="hidden sm:inline">•</span>
              <span>Joining Date: <strong className="text-neutral-700 dark:text-neutral-300">{faculty.joiningDate ? new Date(faculty.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</strong></span>
              <span className="hidden sm:inline">•</span>
              <span>Tenure: <strong className="text-neutral-700 dark:text-neutral-300">{calculateTenure(faculty.joiningDate)}</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Stats on the right */}
        <div className="hidden lg:flex items-center gap-6 border-l border-neutral-200/60 dark:border-neutral-800 pl-8 shrink-0">
          <div className="text-center">
            <p className="text-2xl font-black text-neutral-900 dark:text-white">{teachingAssignments.length}</p>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mt-0.5">Active Courses</p>
          </div>
          <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800" />
          <div className="text-center">
            <p className="text-2xl font-black text-neutral-900 dark:text-white">{attendanceHistory.length}</p>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mt-0.5">Sessions Logged</p>
          </div>
        </div>
      </div>

      {/* Tabs Selector slider */}
      <div className="flex justify-center border-b border-neutral-200/60 dark:border-neutral-800 pb-3">
        <div className="flex items-center glass-bar p-1 rounded-full gap-1">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
              activeTab === 'details'
                ? 'nav-pill-active shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            All Details
          </button>
          <button
            onClick={() => setActiveTab('teaching')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
              activeTab === 'teaching'
                ? 'nav-pill-active shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Teaching & Workload
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
              activeTab === 'attendance'
                ? 'nav-pill-active shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Attendance Sessions
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
              activeTab === 'security'
                ? 'nav-pill-active shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Login & Security
          </button>
        </div>
      </div>

      {/* Main Sheet Container mimicking StudentViewPage.tsx form sheet */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xl p-8 md:p-12 space-y-8">

        {/* Tab 1: All Details */}
        {activeTab === 'details' && (
          <div className="space-y-8">

            {/* Personal Details Section */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <User size={14} className="text-violet-500" /> Personal Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <FormField label="First Name" value={faculty.firstName || faculty.name.split(' ')[0] || '—'} />
                <FormField label="Middle Name" value={faculty.middleName || (faculty.name.split(' ').length > 2 ? faculty.name.split(' ').slice(1, -1).join(' ') : '—')} />
                <FormField label="Last Name" value={faculty.lastName || (faculty.name.split(' ').length > 1 ? faculty.name.split(' ').slice(1).join(' ') : '—')} />
                <FormField label="Full Legal Name" value={faculty.name} />
                <FormField label="Gender" value={faculty.gender || '—'} />
                <FormField label="Joining Date" value={faculty.joiningDate ? new Date(faculty.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
                <FormField label="Nationality" value="Indian" />
                <FormField label="Service Tenure" value={calculateTenure(faculty.joiningDate)} />
                <FormField label="Email Address" value={faculty.email} onCopy={() => handleCopy(faculty.email, 'email')} copied={copiedEmail} />
                <FormField label="Mobile Number" value={faculty.phone || '—'} onCopy={faculty.phone ? () => handleCopy(faculty.phone || '', 'phone') : undefined} copied={copiedPhone} />
                <FormField label="System User ID" value={faculty.userId || faculty.id} onCopy={() => handleCopy(faculty.userId || faculty.id, 'id')} copied={copiedId} />
                <FormField label="Profile Photo Status" value={faculty.profileImage ? 'Custom Photo Uploaded' : 'Default Monogram'} />
              </div>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Academic & Appointment Details Section */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <GraduationCap size={14} className="text-violet-500" /> Academic & Appointment Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <FormField label="Faculty ID" value={facultyIdFormatted} onCopy={() => handleCopy(facultyIdFormatted, 'id')} copied={copiedId} />
                <FormField label="Appointment Type" value="Regular Teaching Faculty" />
                <FormField label="Core Department" value={faculty.coreDepartment.name} />
                <FormField label="Department Code" value={faculty.coreDepartment.code} />
                <FormField label="Academic Designation" value={faculty.designation} />
                <FormField label="Faculty Status" value={faculty.status} />
                <FormField label="Primary Curriculum" value="VTU Under-Graduate" />
                <FormField label="Portal Access Role" value="FACULTY_PORTAL" />
                <FormField label="Current Active Subjects" value={teachingAssignments.length} />
                <FormField label="Historical Courses" value={historicalAssignments.length} />
                <FormField label="Total Career Assignments" value={teachingAssignments.length + historicalAssignments.length} />
                <FormField label="Allocated Sections" value={teachingAssignments.map(a => a.section).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '—'} />
              </div>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Account & Security Summary Section */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <ShieldCheck size={14} className="text-violet-500" /> Login & Security Overview
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <FormField label="Login Account Email" value={account.email} onCopy={() => handleCopy(account.email, 'email')} copied={copiedEmail} />
                <FormField label="Account Status" value={account.status} />
                <FormField label="Password Condition" value={account.mustChangePassword ? 'Pending First-Login Reset' : 'Active'} />
                <FormField label="Portal Role" value="FACULTY_PORTAL" />
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Teaching & Workload */}
        {activeTab === 'teaching' && (
          <div className="space-y-8">

            {/* Workload Overview Cards */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <BookOpen size={14} className="text-violet-500" /> Teaching Workload Overview
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Current Semester Allocations */}
                <div className="p-5 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850/40 space-y-4">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                    Current Semester Allocations
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Active Subjects" value={teachingAssignments.length} />
                    <FormField label="Academic Year" value={teachingAssignments[0]?.academicYear || '2026-27'} />
                    <FormField label="Teaching Department" value={teachingAssignments[0]?.teachingDepartment || faculty.coreDepartment.name} />
                    <FormField label="Allocated Sections" value={teachingAssignments.map(a => a.section).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '—'} />
                  </div>
                </div>

                {/* Historical Allocation Overview */}
                <div className="p-5 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850/40 space-y-4">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                    Historical Allocation Overview
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Past Courses Handled" value={historicalAssignments.length} />
                    <FormField label="Total Career Assignments" value={teachingAssignments.length + historicalAssignments.length} />
                    <FormField label="Primary Curriculum" value="VTU Under-Graduate" />
                    <FormField label="Faculty Status" value={faculty.status} />
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Assigned Subjects Register Table */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <Layers size={14} className="text-violet-500" /> Assigned Subjects Register ({[...teachingAssignments, ...historicalAssignments].length})
              </h3>

              <div className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900">
                <div className="overflow-x-auto">
                  {[...teachingAssignments, ...historicalAssignments].length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
                        <tr>
                          <th className="py-3.5 px-4 font-bold text-white">Academic Year</th>
                          <th className="py-3.5 px-4 font-bold text-white">Subject Name & Code</th>
                          <th className="py-3.5 px-4 font-bold text-white">Teaching Dept</th>
                          <th className="py-3.5 px-4 font-bold text-white">Semester</th>
                          <th className="py-3.5 px-4 font-bold text-white text-center">Section</th>
                          <th className="py-3.5 px-4 font-bold text-white text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                        {[...teachingAssignments, ...historicalAssignments].map((a) => (
                          <tr key={a.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                            <td className="py-3 px-4 font-bold text-neutral-800 dark:text-neutral-200">
                              {a.academicYear}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-neutral-900 dark:text-white mr-1.5">{a.subject}</span>
                              <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-mono text-[10px] font-bold">
                                {a.subjectCode}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300 font-medium">
                              {a.teachingDepartmentCode ? (
                                <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-bold mr-1.5">
                                  {a.teachingDepartmentCode}
                                </span>
                              ) : null}
                              <span>{a.teachingDepartment}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                              Semester {a.semester}
                            </td>
                            <td className="py-3 px-4 text-center font-bold">
                              {a.section}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                  a.status === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                }`}
                              >
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-8 text-center text-neutral-400 text-xs">
                      No teaching assignments registered for this faculty member.
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Attendance Sessions */}
        {activeTab === 'attendance' && (
          <div className="space-y-8">

            {/* Attendance Summary Cards */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-violet-500" /> Attendance Sessions Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <FormField label="Total Sessions Logged" value={attendanceHistory.length} />
                <FormField label="Total Student Presents" value={totalAttendancePresent} />
                <FormField label="Total Student Absents" value={totalAttendanceAbsent} />
                <FormField label="Average Attendance Rate" value={`${overallAttendanceRate}%`} />
              </div>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Attendance Log Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                  <Clock size={14} className="text-violet-500" /> Lecture Sessions Log ({filteredAttendance.length})
                </h3>
                <div className="relative min-w-[240px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Filter by subject or section..."
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900">
                <div className="overflow-x-auto">
                  {filteredAttendance.length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
                        <tr>
                          <th className="py-3.5 px-4 font-bold text-white">Date</th>
                          <th className="py-3.5 px-4 font-bold text-white">Subject & Code</th>
                          <th className="py-3.5 px-4 font-bold text-white text-center">Sem / Sec</th>
                          <th className="py-3.5 px-4 font-bold text-white text-center">Period</th>
                          <th className="py-3.5 px-4 font-bold text-white text-center text-emerald-400">Present</th>
                          <th className="py-3.5 px-4 font-bold text-white text-center text-rose-400">Absent</th>
                          <th className="py-3.5 px-4 font-bold text-white text-center">Rate</th>
                          <th className="py-3.5 px-4 font-bold text-white text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                        {filteredAttendance.map((s) => {
                          const total = s.present + s.absent;
                          const pct = total > 0 ? Math.round((s.present / total) * 100) : 0;
                          return (
                            <tr key={s.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                              <td className="py-3 px-4 font-bold text-neutral-800 dark:text-neutral-200">
                                {s.date ? new Date(s.date).toLocaleDateString() : '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-extrabold text-neutral-900 dark:text-white mr-1.5">{s.subject}</span>
                                <span className="text-[10px] font-mono text-neutral-400 font-bold">({s.subjectCode})</span>
                              </td>
                              <td className="py-3 px-4 text-center font-bold">
                                Sem {s.semester} • {s.section}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono font-bold text-[11px]">
                                  P-{s.period}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-emerald-600">
                                {s.present}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-rose-600">
                                {s.absent}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                    pct >= 75
                                      ? 'bg-emerald-500/10 text-emerald-600'
                                      : pct >= 60
                                      ? 'bg-amber-500/10 text-amber-600'
                                      : 'bg-rose-500/10 text-rose-600'
                                  }`}
                                >
                                  {pct}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-8 text-center text-neutral-400 text-xs">
                      No attendance records found.
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Login & Security */}
        {activeTab === 'security' && (
          <div className="space-y-8">

            {/* Authentication Account */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <ShieldCheck size={14} className="text-violet-500" /> Authentication Account Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <FormField label="Login Email" value={account.email} onCopy={() => handleCopy(account.email, 'email')} copied={copiedEmail} />
                <FormField label="Account Status" value={account.status} />
                <FormField label="Password Condition" value={account.mustChangePassword ? 'Pending First-Login Reset' : 'Standard Password Active'} />
                <FormField label="Portal Role Access" value="FACULTY_PORTAL" />
              </div>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Credential Management Protocol */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <KeyRound size={14} className="text-violet-500" /> Credential Management Protocol
              </h3>

              <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-xl">
                  <h4 className="text-sm font-extrabold text-neutral-900 dark:text-white">
                    Regenerate Temporary Login Password
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Generate a new cryptographically randomized temporary password and invalidate previous active login sessions. The faculty member must change this temporary password upon their next login.
                  </p>
                </div>

                {!isArchived ? (
                  <button
                    onClick={() => {
                      setShowRegenerateConfirm(true);
                      setRegenerateInputText('');
                    }}
                    className="inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer shrink-0"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Regenerate Temporary Password</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 text-xs italic text-center">
                    Password regeneration is disabled while faculty is archived.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ── REGENERATE PASSWORD CONFIRMATION MODAL ── */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">Regenerate Password?</h3>
                  <p className="text-xs text-neutral-500">Security credential refresh protocol</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRegenerateConfirm(false);
                  setRegenerateInputText('');
                }}
                disabled={isRegenerating}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
              <p>
                This will invalidate the faculty's current password and generate a new temporary password.
              </p>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 space-y-1">
                <p><strong>Faculty:</strong> {faculty.name}</p>
                <p><strong>Login Email:</strong> {account.email}</p>
              </div>

              <div className="pt-2 space-y-1.5">
                <label className="block text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                  Type <span className="font-extrabold text-amber-600 tracking-wider">REGENERATE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={regenerateInputText}
                  onChange={(e) => setRegenerateInputText(e.target.value)}
                  placeholder="Type REGENERATE to confirm"
                  disabled={isRegenerating}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowRegenerateConfirm(false);
                  setRegenerateInputText('');
                }}
                disabled={isRegenerating}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRegenerate}
                disabled={regenerateInputText !== 'REGENERATE' || isRegenerating}
                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                  regenerateInputText === 'REGENERATE' && !isRegenerating
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 cursor-pointer'
                    : 'bg-neutral-400 dark:bg-neutral-700 opacity-50 cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                <span>{isRegenerating ? 'Regenerating...' : 'Regenerate Password'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REGENERATE PASSWORD RESULT CARD / MODAL ── */}
      {regeneratedCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-emerald-500/30 dark:border-emerald-500/30 shadow-2xl p-6 space-y-5">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">Password Regenerated</h3>
                <p className="text-xs text-neutral-500">New temporary credentials generated</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Faculty Name</span>
                <span className="font-extrabold text-neutral-900 dark:text-white text-sm">{regeneratedCredentials.facultyName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Login Email</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{regeneratedCredentials.loginEmail}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">New Temporary Password</span>
                <div className="mt-1 flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-emerald-500/40">
                  <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider">
                    {regeneratedCredentials.temporaryPassword}
                  </span>
                  <button
                    onClick={handleCopyPassword}
                    className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-neutral-700 hover:text-emerald-600 transition-colors cursor-pointer"
                    title="Copy Password"
                  >
                    {copiedPassword ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Please share these temporary credentials securely with the faculty member. They will be required to change this password on their first login.
            </p>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleDownloadCredentials}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Credentials</span>
              </button>
              <button
                onClick={() => setRegeneratedCredentials(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ARCHIVE CONFIRMATION MODAL ── */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white">Archive Faculty?</h3>
                  <p className="text-xs text-neutral-500">Non-destructive soft-delete & archive protocol</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setArchiveInputText('');
                }}
                disabled={isArchiving}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
              <p>
                You are about to remove <strong className="text-neutral-900 dark:text-white font-bold">{faculty.name}</strong> ({faculty.email}) from the active Faculty Directory.
              </p>
              <p className="text-neutral-500 dark:text-neutral-400">
                This will deactivate login access and exclude them from new curriculum teaching allocations.
              </p>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 space-y-2">
                <div className="flex items-center space-x-1.5 font-bold text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Academic History is Preserved</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                  All teaching assignments, attendance sessions, and CIE evaluation records will remain permanently intact and safe.
                </p>
              </div>

              <div className="pt-2 space-y-2">
                <label className="block text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                  To confirm removal, type <span className="font-extrabold text-rose-600 dark:text-rose-400 tracking-wider">DELETE</span> in the box below:
                </label>
                <input
                  type="text"
                  value={archiveInputText}
                  onChange={(e) => setArchiveInputText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  disabled={isArchiving}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setArchiveInputText('');
                }}
                disabled={isArchiving}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmArchive}
                disabled={archiveInputText !== 'DELETE' || isArchiving}
                className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                  archiveInputText === 'DELETE' && !isArchiving
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 cursor-pointer'
                    : 'bg-neutral-400 dark:bg-neutral-700 opacity-50 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>{isArchiving ? 'Archiving Faculty...' : 'Archive Faculty'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DeanFacultyDetailPage;
