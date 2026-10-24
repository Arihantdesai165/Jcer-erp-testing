import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  BookOpen,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  Award,
  FileText,
  ShieldCheck,
  Clock,
  Download,
  Eye,
  Loader2,
  CheckCircle2,
  X,
  CalendarCheck,
  AlertTriangle,
  Code2,
  Briefcase,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Building,
  CheckCircle,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import admissionService, { AdmissionApplication } from '../../services/admission.service';
import hodService from '../../services/hod.service';
import API from '../../services/api';
import { toast } from 'react-toastify';
import { getStudentCohort } from '../../utils/batchCohort.util';

// ─── Status Mapping ────────────────────────────────────────────────────────────
const STATUS_COLOR_MAP: Record<string, string> = {
  DRAFT: 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
  SUBMITTED: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50',
  CORRECTION_REQUIRED: 'bg-orange-100 text-orange-850 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30',
  APPROVED: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-900/50',
  PRINCIPAL_APPROVED: 'bg-violet-100 text-violet-850 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-900/50',
  ENROLLED: 'bg-emerald-100 text-emerald-850 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/50',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50',
  CANCELLATION_REQUESTED: 'bg-pink-100 text-pink-850 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-900/50',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Pending Review',
  UNDER_REVIEW: 'In Progress',
  CORRECTION_REQUIRED: 'Correction Required',
  APPROVED: 'Verified',
  PRINCIPAL_APPROVED: 'Principal Approved',
  ENROLLED: 'Admission Confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  CANCELLATION_REQUESTED: 'Cancellation Pending',
};

// ─── Read-Only Form Field Component ─────────────────────────────────────────────
const FormField: React.FC<{ label: string; value?: any }> = ({ label, value }) => (
  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/80 rounded-lg transition-all flex flex-col gap-1.5">
    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none">{label}</p>
    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate leading-tight">
      {value !== null && value !== undefined && value !== '' ? String(value) : '—'}
    </p>
  </div>
);

// ─── Document Card Component ───────────────────────────────────────────────────
const DocumentPreviewCard: React.FC<{
  field: string;
  studentId: string;
  label: string;
  hasUrl?: boolean;
  docUrl?: string | null;
  onViewDoc: (url: string, isPdf: boolean, title: string) => void;
}> = ({ field, studentId, label, hasUrl, docUrl, onViewDoc }) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    if (!hasUrl) {
      setLoading(false);
      setImgUrl(null);
      return;
    }
    let active = true;
    let blobUrl: string | null = null;

    const fetchDoc = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const base = API.defaults.baseURL || '/api';
        const cleanPath = `/admin/admissions/${studentId}/documents/${field}`;
        const url = `${base}${cleanPath}`;
        const finalUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;

        const response = await API.get(finalUrl, { responseType: 'blob' });
        if (!active) return;

        blobUrl = URL.createObjectURL(response.data);
        const isPdfFile = response.data.type === 'application/pdf' || !!(docUrl?.toLowerCase().includes('.pdf'));
        setIsPdf(isPdfFile);
        setImgUrl(blobUrl);
        setLoading(false);
        setError(false);
      } catch {
        if (!active) return;
        setError(true);
        setLoading(false);
      }
    };

    fetchDoc();
    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [field, studentId, hasUrl, docUrl]);

  const handleDownload = () => {
    if (!imgUrl) return;
    const link = document.createElement('a');
    link.href = imgUrl;
    link.target = '_blank';
    link.download = `${label.replace(/\s+/g, '_')}${isPdf ? '.pdf' : '.jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 group shadow-xs flex flex-col transition-all duration-300 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800">
      {/* Edge-to-edge Preview Box */}
      <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-950">
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Loading...</span>
          </div>
        ) : error || !hasUrl || !imgUrl ? (
          <div className="flex flex-col items-center gap-2 text-neutral-400 p-4 text-center">
            <FileText size={24} className="opacity-40" />
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">No Document</span>
          </div>
        ) : isPdf ? (
          <div className="flex flex-col items-center justify-center p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 w-full h-full">
            <FileText size={36} className="drop-shadow-xs" />
            <span className="text-[10px] font-black tracking-wider uppercase mt-2 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded">PDF Document</span>
          </div>
        ) : (
          <img
            src={imgUrl}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>

      {/* Bottom overlay with Document Name and actions */}
      <div className="absolute inset-x-0 bottom-0 bg-black/40 backdrop-blur-md border-t border-white/10 py-2.5 px-3 flex flex-col gap-1.5">
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate leading-tight" title={label}>
            {label}
          </p>
          <span className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider">
            {hasUrl ? 'Uploaded' : 'Pending'}
          </span>
        </div>

        {hasUrl && imgUrl && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <button
              type="button"
              onClick={() => onViewDoc(imgUrl, isPdf, label)}
              className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold transition-all border border-white/10 select-none text-center cursor-pointer"
              title="View Document"
            >
              <Eye size={11} />
              <span>View</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-all border border-indigo-500 shadow-xs select-none text-center cursor-pointer"
              title="Download Document"
            >
              <Download size={11} />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Unified Student Profile Page ──────────────────────────────────────────
export const HodStudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  // State
  const [admissionData, setAdmissionData] = useState<AdmissionApplication | null>(null);
  const [hodData, setHodData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: 5 tabs required
  const [activeTab, setActiveTab] = useState<'admission' | 'skills' | 'grading' | 'attendance' | 'feedback'>('admission');

  // Document modal preview
  const [previewDoc, setPreviewDoc] = useState<{ url: string; isPdf: boolean; title: string } | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    // Concurrently load admission full profile and HOD live academic/attendance metrics
    Promise.allSettled([
      admissionService.getApplication(id),
      hodService.getStudentById(id),
    ])
      .then(([admResult, hodResult]) => {
        if (!isMounted) return;

        let foundData = false;

        if (admResult.status === 'fulfilled' && admResult.value) {
          setAdmissionData(admResult.value);
          foundData = true;
        }

        if (hodResult.status === 'fulfilled' && hodResult.value) {
          setHodData(hodResult.value);
          foundData = true;
        }

        if (!foundData) {
          const admErr = admResult.status === 'rejected' ? admResult.reason?.response?.data?.error : null;
          const hodErr = hodResult.status === 'rejected' ? hodResult.reason?.response?.data?.error : null;
          setError(admErr || hodErr || 'Student not found or access restricted to departmental scope.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching student profile:', err);
        setError('Failed to load student details.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">Loading Student Profile...</p>
      </div>
    );
  }

  if (error || (!admissionData && !hodData)) {
    return (
      <div className="p-8 text-center rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 max-w-xl mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-rose-800 dark:text-rose-200 mb-1">Access Denied or Not Found</h3>
        <p className="text-xs text-rose-700 dark:text-rose-300">{error || 'Unable to retrieve student profile.'}</p>
        <div className="mt-5">
          <Link
            to="/hod/students"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Students Directory
          </Link>
        </div>
      </div>
    );
  }

  // Unified data resolution
  const studentHod = hodData?.student;
  const attendance = hodData?.attendance || {
    totalSessions: 0,
    presentSessions: 0,
    percentage: 0,
    isDefaulter: false,
    recentRecords: [],
  };
  const marks = hodData?.marks || [];

  const pd = admissionData?.studentpersonaldetails as any;
  const par = admissionData?.studentparentdetails as any;
  const addr = admissionData?.studentaddress as any;
  const acad = admissionData?.studentacademicdetails as any;
  const docs = (admissionData?.studentdocuments || (admissionData as any)?.documents) as any;

  // Resolved display fields
  const studentName = (
    pd
      ? `${pd.firstName || ''} ${pd.middleName ? pd.middleName + ' ' : ''}${pd.lastName || ''}`.replace(/\s+/g, ' ').trim()
      : studentHod?.name || `${admissionData?.user?.firstName || ''} ${admissionData?.user?.lastName || ''}`.trim()
  ) || 'Student Profile';

  const usn = admissionData?.user?.student?.enrollmentNumber || studentHod?.usn || studentHod?.enrollmentNumber || '—';
  const appNumber = admissionData?.applicationNumber || '—';
  const appStatus = admissionData?.applicationStatus || studentHod?.admissionStatus || 'ENROLLED';
  const branchName = admissionData?.branch?.name || studentHod?.department?.name || 'Department';
  const branchCode = admissionData?.branch?.code || studentHod?.department?.code || '';
  const semester = studentHod?.semester || admissionData?.user?.student?.semester || admissionData?.entrySemester || 1;
  const sectionRaw = studentHod?.section || '';
  const sectionDisplay = sectionRaw && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionRaw)
    ? `Section ${sectionRaw.replace(/^(Section|Sec)\s*/i, '').trim()}`
    : 'Unassigned';

  const cohort = studentHod ? getStudentCohort(studentHod) : (admissionData?.academicYear || '2026-2027');
  const admissionType = admissionData?.admissionType || studentHod?.admissionType || 'REGULAR';
  const isDefaulter = attendance.isDefaulter;

  // Determine Diploma vs PUC
  const q = (admissionData?.qualification || '').toUpperCase();
  const showPUC = q === 'PUC' || (!q && admissionType === 'KCET');
  const showDiploma = q === 'DIPLOMA' || (!q && admissionType === 'DCET');

  const photoUrl = docs?.photoUrl || admissionData?.user?.profileImage || null;

  return (
    <div className="space-y-6 animate-fade-in w-full pb-16">
      
      {/* ── Top Bar: Back to Students ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          to="/hod/students"
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
          <span>Back to Students</span>
        </Link>
      </div>

      {/* ── Student Identity Hero Card ───────────────────────────────────────── */}
      <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-slate-200/80 dark:border-neutral-800/80 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-2xl overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-3xl shadow-sm shrink-0 border border-white/60 dark:border-neutral-700">
              {photoUrl ? (
                <img
                  src={photoUrl.startsWith('http') ? photoUrl : `/api/admin/admissions/${admissionData?.id || id}/documents/photo`}
                  alt={studentName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>{studentName.charAt(0)}</span>
              )}
            </div>

            {/* Core Info & Badges */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {studentName}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${STATUS_COLOR_MAP[appStatus] || STATUS_COLOR_MAP.ENROLLED}`}>
                  {STATUS_LABEL_MAP[appStatus] || appStatus}
                </span>
              </div>

              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-0.5 rounded-md font-mono font-bold bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700">
                  USN: {usn}
                </span>
                {appNumber !== '—' && (
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700">
                    App: {appNumber}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                  Sem {semester} • {sectionDisplay}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                  Batch: {cohort}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  Type: {admissionType}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-neutral-400">
                {branchName} {branchCode ? `(${branchCode})` : ''} • Academic Year: <strong className="text-slate-700 dark:text-neutral-300">{admissionData?.academicYear || '2026-2027'}</strong>
              </p>
            </div>
          </div>

          {/* Quick Attendance KPI */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-neutral-800 pt-4 sm:pt-0 sm:pl-6 shrink-0">
            <div className="text-left sm:text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">Attendance Rate</span>
              <span className={`text-2xl font-black ${isDefaulter ? 'text-rose-600' : 'text-emerald-600'}`}>
                {attendance.percentage !== null && attendance.percentage !== undefined ? `${attendance.percentage}%` : '—'}
              </span>
            </div>
            {isDefaulter && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 mt-1">
                Defaulter (&lt;75%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 5 Horizontal Navigation Tabs ─────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-neutral-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setActiveTab('admission')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'admission'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-neutral-800'
            }`}
          >
            <BookOpen size={14} />
            <span>Admission Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'skills'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-neutral-800'
            }`}
          >
            <Code2 size={14} />
            <span>Skill Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grading')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'grading'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-neutral-800'
            }`}
          >
            <GraduationCap size={14} />
            <span>Graduation / Grading</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-neutral-800'
            }`}
          >
            <CalendarCheck size={14} />
            <span>Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('feedback')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'feedback'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-neutral-800'
            }`}
          >
            <MessageSquare size={14} />
            <span>Feedback</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: ADMISSION DETAILS (Reuses Admin View Sections) ──────────────── */}
      {activeTab === 'admission' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xs">
            
            {/* Section 1: Personal Details */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <User size={14} /> Personal Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <FormField label="First Name" value={pd?.firstName || admissionData?.user?.firstName} />
                <FormField label="Middle Name" value={pd?.middleName} />
                <FormField label="Last Name" value={pd?.lastName || admissionData?.user?.lastName} />
                <FormField label="Date of Birth" value={pd?.dateOfBirth} />
                <FormField label="Gender" value={pd?.gender} />
                <FormField label="Blood Group" value={pd?.bloodGroup} />
                <FormField label="Category" value={pd?.category} />
                <FormField label="Religion" value={pd?.religion} />
                <FormField label="Nationality" value={pd?.nationality || 'Indian'} />
                <FormField label="Primary Phone" value={pd?.phone || admissionData?.user?.phone || studentHod?.phone} />
                <FormField label="Primary Email" value={pd?.email || admissionData?.user?.email || studentHod?.email} />
                <FormField label="Aadhaar Number" value={admissionData?.aadhaar} />
              </div>
            </div>

            <hr className="border-slate-100 dark:border-neutral-800" />

            {/* Section 2: Parent / Guardian Details */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <Phone size={14} /> Parent & Guardian Information
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <FormField label="Father Name" value={par?.fatherName || studentHod?.fatherName} />
                <FormField label="Mother Name" value={par?.motherName || studentHod?.motherName} />
                <FormField label="Father Phone" value={par?.fatherPhone || studentHod?.parentPhone} />
                <FormField label="Mother Phone" value={par?.motherPhone} />
                <FormField label="Parent Email" value={par?.fatherEmail || par?.motherEmail || studentHod?.parentEmail} />
                <FormField label="Father Occupation" value={par?.fatherOccupation} />
                <FormField label="Annual Family Income" value={par?.annualIncome ? `₹${par.annualIncome}` : undefined} />
                <FormField label="Guardian Name" value={par?.guardianName} />
              </div>
            </div>

            <hr className="border-slate-100 dark:border-neutral-800" />

            {/* Section 3: Address Details */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <MapPin size={14} /> Address Details
              </h3>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Residential Address</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div className="col-span-2">
                    <FormField label="Address Line 1" value={addr?.currentAddressLine1 || studentHod?.address} />
                  </div>
                  <FormField label="Address Line 2" value={addr?.currentAddressLine2} />
                  <FormField label="City" value={addr?.currentCity} />
                  <FormField label="State" value={addr?.currentState} />
                  <FormField label="Pincode" value={addr?.currentPincode} />
                </div>

                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2">Permanent Address</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div className="col-span-2">
                    <FormField label="Address Line 1" value={addr?.permanentAddressLine1 || addr?.currentAddressLine1 || studentHod?.address} />
                  </div>
                  <FormField label="Address Line 2" value={addr?.permanentAddressLine2 || addr?.currentAddressLine2} />
                  <FormField label="City" value={addr?.permanentCity || addr?.currentCity} />
                  <FormField label="State" value={addr?.permanentState || addr?.currentState} />
                  <FormField label="Pincode" value={addr?.permanentPincode || addr?.currentPincode} />
                </div>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-neutral-800" />

            {/* Section 4: Previous Education & Marks */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <GraduationCap size={14} /> Previous Education & Qualifying Examination
              </h3>

              <div className="space-y-4">
                {/* 10th / SSLC */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest">10th Standard / SSLC</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    <FormField label="School Name" value={acad?.tenthSchool || acad?.sslcSchool} />
                    <FormField label="Board" value={acad?.tenthBoard || acad?.sslcBoard} />
                    <FormField label="Passing Year" value={acad?.tenthPassingYear || acad?.sslcYear} />
                    <FormField label="Register Number" value={acad?.tenthRegisterNumber || acad?.sslcRegisterNumber} />
                    <FormField label="Marks Obtained" value={acad?.tenthMarksObtained || acad?.sslcMarksObtained} />
                    <FormField label="Maximum Marks" value={acad?.tenthMaxMarks || acad?.sslcMaxMarks} />
                    <FormField label="Percentage" value={acad?.tenthPercentage || acad?.sslcPercentage ? `${acad?.tenthPercentage || acad?.sslcPercentage}%` : undefined} />
                    <FormField label="Attempts" value={acad?.tenthAttempts || acad?.sslcAttempts} />
                  </div>
                </div>

                {/* 12th / PUC */}
                {showPUC && (
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest">12th Standard / PUC</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                      <FormField label="College Name" value={acad?.twelfthSchool || acad?.pucSchool} />
                      <FormField label="Board" value={acad?.twelfthBoard || acad?.pucBoard} />
                      <FormField label="Passing Year" value={acad?.twelfthPassingYear || acad?.pucYear} />
                      <FormField label="Register Number" value={acad?.twelfthRegisterNumber || acad?.pucRegisterNumber} />
                      <FormField label="Stream" value={acad?.twelfthStream || acad?.pucStream} />
                      <FormField label="Physics Marks" value={acad?.physicsMarks} />
                      <FormField label="Maths Marks" value={acad?.mathsMarks} />
                      <FormField label="Chemistry Marks" value={acad?.chemistryMarks} />
                      <FormField label="Total Percentage" value={acad?.twelfthPercentage || acad?.pucPercentage ? `${acad?.twelfthPercentage || acad?.pucPercentage}%` : undefined} />
                      <FormField label="Attempts" value={acad?.twelfthAttempts || acad?.pucAttempts} />
                    </div>
                  </div>
                )}

                {/* Diploma (if applicable) */}
                {showDiploma && (
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Diploma Examination</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                      <FormField label="Polytechnic College" value={acad?.diplomaCollege} />
                      <FormField label="Board" value={acad?.diplomaBoard} />
                      <FormField label="Branch / Stream" value={acad?.diplomaBranch} />
                      <FormField label="Passing Year" value={acad?.diplomaPassingYear} />
                      <FormField label="Register Number" value={acad?.diplomaRegisterNumber} />
                      <FormField label="5th Sem Marks" value={acad?.diplomaSem5Marks} />
                      <FormField label="6th Sem Marks" value={acad?.diplomaSem6Marks} />
                      <FormField label="Diploma Percentage" value={acad?.diplomaPercentage ? `${acad?.diplomaPercentage}%` : undefined} />
                    </div>
                  </div>
                )}

                {/* Entrance Exam */}
                {(admissionData?.cetNumber || admissionData?.dcetNumber || acad?.cetScore || acad?.cetRank) && (
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-3 bg-slate-50/50 dark:bg-neutral-800/30">
                    <p className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Entrance Examination Details</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                      <FormField label="Entrance Roll / Number" value={admissionData?.cetNumber || admissionData?.dcetNumber} />
                      <FormField label="Entrance Score" value={acad?.cetScore} />
                      <FormField label="Entrance Rank" value={acad?.cetRank ? `#${acad.cetRank}` : undefined} />
                      <FormField label="Exam Type" value={admissionType} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-slate-100 dark:border-neutral-800" />

            {/* Section 5: Attached Digital Documents */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <FileText size={14} /> Attached Digital Documents
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Passport Size Photo', field: 'photo', url: docs?.photoUrl },
                  { label: 'Candidate E-Signature', field: 'signature', url: docs?.signatureUrl },
                  { label: 'SSLC / 10th Marks Card', field: 'tenthMarksheet', url: docs?.tenthMarksheetUrl },
                  ...(showDiploma ? [
                    { label: 'Diploma 5th Sem Marks Card', field: 'diplomaSemester5Marksheet', url: docs?.diplomaSemester5MarksheetUrl },
                    { label: 'Diploma 6th Sem Marks Card', field: 'diplomaSemester6Marksheet', url: docs?.diplomaSemester6MarksheetUrl },
                  ] : [
                    { label: 'PUC / 12th Marks Card', field: 'twelfthMarksheet', url: docs?.twelfthMarksheetUrl },
                  ]),
                  { label: 'Entrance Score Card', field: 'cetScoreCard', url: docs?.cetScoreCardUrl },
                  { label: 'Aadhaar Card Copy', field: 'aadhaar', url: docs?.aadhaarUrl },
                  { label: 'College Fees Receipt', field: 'feesPaidReceipt', url: docs?.feesPaidReceiptUrl },
                  { label: 'Admission Form Fee Receipt', field: 'admissionFormFeeReceipt', url: docs?.admissionFormFeeReceiptUrl },
                  { label: 'Caste Certificate', field: 'casteCertificate', url: docs?.casteCertificateUrl },
                  { label: 'Domicile / Study Certificate', field: 'domicileCertificate', url: docs?.domicileCertificateUrl },
                  { label: 'Income / Gap Certificate', field: 'gapCertificate', url: docs?.gapCertificateUrl },
                ]
                  .filter(({ url }) => url !== null && url !== undefined && url !== '')
                  .map((doc) => (
                    <DocumentPreviewCard
                      key={doc.field}
                      field={doc.field}
                      studentId={admissionData?.id || id || ''}
                      label={doc.label}
                      hasUrl={!!doc.url}
                      docUrl={doc.url}
                      onViewDoc={(url, isPdf, title) => setPreviewDoc({ url, isPdf, title })}
                    />
                  ))}
              </div>

              {(!docs || Object.values(docs).filter(Boolean).length === 0) && (
                <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-dashed border-slate-200 dark:border-neutral-700 text-xs text-slate-400">
                  No verified digital documents are attached to this record.
                </div>
              )}
            </div>

            <hr className="border-slate-100 dark:border-neutral-800" />

            {/* Section 6: Verification Status & Remarks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Verification Checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck size={14} className="text-indigo-600" /> Verification Checklist
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-neutral-800/40 border border-slate-200/60 dark:border-neutral-800 rounded-xl">
                    <span className="font-semibold text-slate-700 dark:text-neutral-300">Documents Verification</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${admissionData?.documentsVerified ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                      {admissionData?.documentsVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-neutral-800/40 border border-slate-200/60 dark:border-neutral-800 rounded-xl">
                    <span className="font-semibold text-slate-700 dark:text-neutral-300">Fees Payment Verification</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${admissionData?.feesVerified ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                      {admissionData?.feesVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-neutral-800/40 border border-slate-200/60 dark:border-neutral-800 rounded-xl">
                    <span className="font-semibold text-slate-700 dark:text-neutral-300">Eligibility Verification</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${admissionData?.eligibilityVerified ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                      {admissionData?.eligibilityVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Administrative Remarks */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText size={14} className="text-indigo-600" /> Administrative Remarks
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-neutral-800/40 border border-slate-200/60 dark:border-neutral-800 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Admission Officer Remarks</p>
                    <p className="font-semibold text-slate-700 dark:text-neutral-300 mt-1">
                      {admissionData?.adminRemarks || 'No officer remarks recorded.'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-neutral-800/40 border border-slate-200/60 dark:border-neutral-800 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Principal Remarks</p>
                    <p className="font-semibold text-slate-700 dark:text-neutral-300 mt-1">
                      {admissionData?.approvalRemarks || 'No principal remarks recorded.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── TAB 2: SKILL PROFILE ─────────────────────────────────────────────── */}
      {activeTab === 'skills' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xs">
            
            {/* Technical Skills */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <Code2 size={14} /> Technical Skills & Competencies
              </h3>
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-dashed border-slate-200 dark:border-neutral-700 text-center">
                <Sparkles className="w-8 h-8 text-indigo-500 mx-auto mb-2 opacity-60" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-neutral-300">Technical Skills Repository</h4>
                <p className="text-[11px] text-slate-400 dark:text-neutral-500 max-w-md mx-auto mt-1">
                  Student competencies, verified coding proficiencies, and software domain skills will be tracked here once verified by department mentors.
                </p>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-neutral-800" />

            {/* Certifications & Accreditations */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <Award size={14} /> Professional Certifications & NPTEL / MOOCs
              </h3>
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-dashed border-slate-200 dark:border-neutral-700 text-center">
                <Award className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-60" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-neutral-300">No Certifications Recorded</h4>
                <p className="text-[11px] text-slate-400 dark:text-neutral-500 max-w-md mx-auto mt-1">
                  NPTEL, Coursera, AWS, Google Cloud, or Microsoft certifications submitted by this student will appear here after faculty mentor review.
                </p>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-neutral-800" />

            {/* Internships & Industrial Experience */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <Briefcase size={14} /> Industry Internships & Apprenticeships
              </h3>
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-dashed border-slate-200 dark:border-neutral-700 text-center">
                <Briefcase className="w-8 h-8 text-teal-500 mx-auto mb-2 opacity-60" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-neutral-300">No Internship Records Submitted</h4>
                <p className="text-[11px] text-slate-400 dark:text-neutral-500 max-w-md mx-auto mt-1">
                  Mandatory AICTE / VTU industry internship completion certificates, offer letters, and evaluations will be recorded in this section.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── TAB 3: GRADUATION / GRADING ──────────────────────────────────────── */}
      {activeTab === 'grading' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xs">
            
            {/* Semester-wise Academic Progress */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <TrendingUp size={14} /> Semester-Wise Results & SGPA / CGPA Progression
              </h3>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase font-extrabold border-b border-neutral-800">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-white">
                      <th className="py-3 px-4 text-white">Semester</th>
                      <th className="py-3 px-4 text-white">Academic Year</th>
                      <th className="py-3 px-4 text-white">Credits Registered</th>
                      <th className="py-3 px-4 text-white">Credits Earned</th>
                      <th className="py-3 px-4 text-white">SGPA</th>
                      <th className="py-3 px-4 text-right text-white">Result Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                    <tr>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-neutral-200">Current Semester ({semester})</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-neutral-400">{cohort}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-neutral-400">20</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-neutral-400">In Progress</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">Pending CIE/SEE</td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                          Active Term
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-neutral-800" />

            {/* Assessment & Bit-Wise Marks */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <Award size={14} /> Continuous Internal Evaluation (CIE) & Bit-Wise Marks
              </h3>

              {marks && marks.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase font-extrabold border-b border-neutral-800">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-white">
                        <th className="py-3 px-4 text-white">Assessment</th>
                        <th className="py-3 px-4 text-white">Component</th>
                        <th className="py-3 px-4 text-white">Marks Scored</th>
                        <th className="py-3 px-4 text-white">Maximum Marks</th>
                        <th className="py-3 px-4 text-right text-white">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {marks.map((m: any, idx: number) => {
                        const maxM = m.component?.maxMarks || 10;
                        const pct = maxM ? ((m.marks / maxM) * 100).toFixed(0) : '0';
                        return (
                          <tr key={m.id || idx}>
                            <td className="py-3 px-4 font-semibold text-slate-800 dark:text-neutral-200">{m.assessment?.name || 'IA 1'}</td>
                            <td className="py-3 px-4 font-mono font-bold text-indigo-600">{m.component?.name || 'Bit 1'}</td>
                            <td className="py-3 px-4 font-black text-slate-900 dark:text-white">{m.marks}</td>
                            <td className="py-3 px-4 text-slate-400">{maxM}</td>
                            <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-neutral-300">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-dashed border-slate-200 dark:border-neutral-700 text-xs text-slate-400">
                  No bit-wise assessment components captured for this student in the current academic semester.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── TAB 4: ATTENDANCE ─────────────────────────────────────────────────── */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
            
            {/* Defaulter Alert Banner if < 75% */}
            {isDefaulter && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-3.5 text-rose-800 dark:text-rose-200">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-extrabold uppercase tracking-wide">Critical Attendance Warning</p>
                  <p className="mt-0.5">
                    This student is falling below the mandatory VTU 75% threshold with an overall attendance rate of <strong>{attendance.percentage}%</strong>. Departmental intervention is advised.
                  </p>
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/80 dark:border-neutral-800 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall Percentage</span>
                <span className={`text-2xl font-black mt-1 block ${isDefaulter ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {attendance.percentage !== null && attendance.percentage !== undefined ? `${attendance.percentage}%` : '0%'}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/80 dark:border-neutral-800 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Sessions</span>
                <span className="text-2xl font-black text-slate-800 dark:text-neutral-200 mt-1 block">{attendance.totalSessions || 0}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/80 dark:border-neutral-800 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sessions Present</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">{attendance.presentSessions || 0}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/80 dark:border-neutral-800 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sessions Absent</span>
                <span className="text-2xl font-black text-rose-600 mt-1 block">
                  {Math.max(0, (attendance.totalSessions || 0) - (attendance.presentSessions || 0))}
                </span>
              </div>
            </div>

            {/* Recent Attendance Log Table */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <CalendarCheck size={14} /> Recent Session Attendance Log
              </h3>

              {attendance.recentRecords && attendance.recentRecords.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase font-extrabold border-b border-neutral-800">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-white">
                        <th className="py-3 px-4 text-white">Date</th>
                        <th className="py-3 px-4 text-white">Subject Name</th>
                        <th className="py-3 px-4 text-white">Subject Code</th>
                        <th className="py-3 px-4 text-right text-white">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {attendance.recentRecords.map((r: any, idx: number) => {
                        const isPresent = r.status === 'PRESENT';
                        return (
                          <tr key={r.id || idx}>
                            <td className="py-3 px-4 font-semibold text-slate-800 dark:text-neutral-200">
                              {r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800 dark:text-neutral-200">{r.subject?.name || 'Class Session'}</td>
                            <td className="py-3 px-4 font-mono text-slate-500 dark:text-neutral-400">{r.subject?.code || '—'}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isPresent ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-dashed border-slate-200 dark:border-neutral-700 text-xs text-slate-400">
                  No attendance session records recorded yet for this student.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── TAB 5: FEEDBACK ──────────────────────────────────────────────────── */}
      {activeTab === 'feedback' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
            
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 pl-2.5 flex items-center gap-2">
                <MessageSquare size={14} /> Student Feedback Surveys & Course Evaluations
              </h3>

              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-dashed border-slate-200 dark:border-neutral-700">
                <MessageSquare className="w-8 h-8 text-indigo-500 mx-auto mb-2 opacity-60" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-neutral-300">No Active Feedback Surveys</h4>
                <p className="text-[11px] text-slate-400 dark:text-neutral-500 max-w-md mx-auto mt-1">
                  End-of-semester faculty evaluations, course outcome feedbacks, and facility survey submissions from this student will be consolidated here once published.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Document Preview Modal ───────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-neutral-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                {previewDoc.title}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  download={previewDoc.title}
                  className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold transition-all"
                  title="Download"
                >
                  <Download size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50 dark:bg-neutral-950 min-h-[400px]">
              {previewDoc.isPdf ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.title}
                  className="w-full h-[65vh] rounded-lg border border-slate-200 dark:border-neutral-800"
                />
              ) : (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HodStudentDetailPage;
