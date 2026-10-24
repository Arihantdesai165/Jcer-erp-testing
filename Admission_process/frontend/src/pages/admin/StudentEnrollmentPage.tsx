import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardList, CheckCircle2, XCircle, Clock, Search,
  Eye, X, FileText, User, Phone, MapPin,
  Calendar, BookOpen, Loader2, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight, GraduationCap
} from 'lucide-react';
import Toast from '../../components/common/Toast';
import { CardSkeleton } from '../../components/common/Skeleton';
import { ShowStudentsRangeSelector } from '../../components/common/ShowStudentsRangeSelector';
import admissionService, {
  AdmissionApplication,
  AdmissionStatus,
} from '../../services/admission.service';
import API from '../../services/api';
import { formatDateDDMMYYYY } from '../../utils/date.util';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRANCH_ACCENT: Record<string, { pill: string; accent: string; card: string }> = {
  CSE: { pill: 'bg-amber-100 text-amber-800',  accent: '#d97706', card: 'bg-amber-50/60 border-amber-200/70' },
  ECE: { pill: 'bg-violet-100 text-violet-800', accent: '#7C3AED', card: 'bg-violet-50/60 border-violet-200/70' },
  ME:  { pill: 'bg-emerald-100 text-emerald-800', accent: '#16a34a', card: 'bg-emerald-50/60 border-emerald-200/70' },
  CE:  { pill: 'bg-sky-100 text-sky-800',       accent: '#0284c7', card: 'bg-sky-50/60 border-sky-200/70' },
  'CSE-AIML': { pill: 'bg-rose-100 text-rose-800',     accent: '#e11d48', card: 'bg-rose-50/60 border-rose-200/70' },
};
const DEFAULT_BRANCH = { pill: 'bg-neutral-100 text-neutral-700', accent: '#7C3AED', card: 'bg-neutral-50/60 border-neutral-200/70' };

type FilterKey = AdmissionStatus | 'ALL';

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  REGISTERED:   { label: 'Registered',   bg: 'bg-slate-100',   text: 'text-slate-700',   icon: User },
  DRAFT:        { label: 'Draft',        bg: 'bg-slate-100',   text: 'text-slate-700',   icon: User },
  SUBMITTED:    { label: 'Submitted',    bg: 'bg-blue-100',    text: 'text-blue-700',    icon: Clock },
  UNDER_REVIEW: { label: 'Under Review', bg: 'bg-amber-100',   text: 'text-amber-700',   icon: Clock },
  APPROVED:     { label: 'Approved',     bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
  REJECTED:     { label: 'Rejected',     bg: 'bg-rose-100',    text: 'text-rose-700',    icon: XCircle },
  ENROLLED:     { label: 'Enrolled',     bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
};

const FILTER_TABS: { key: FilterKey; label: string; activeStyle: string }[] = [
  { key: 'ALL',          label: 'All',          activeStyle: 'bg-[#bae6fd] text-black border-[#7dd3fc]' },
  { key: 'SUBMITTED',    label: 'Submitted',    activeStyle: 'bg-[#fef9c3] text-black border-[#fde047]' },
  { key: 'UNDER_REVIEW', label: 'Under Review', activeStyle: 'bg-[#fed7aa] text-black border-[#fdba74]' },
  { key: 'APPROVED',     label: 'Approved',     activeStyle: 'bg-[#bbf7d0] text-black border-[#6ee7b7]' },
  { key: 'REJECTED',     label: 'Rejected',     activeStyle: 'bg-[#fecaca] text-black border-[#f87171]' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface StudentEnrollmentPageProps {
  /** Optional initial filter. Accepts any AdmissionStatus or 'ALL' | 'QUEUE' | 'RESUBMITTED'. */
  defaultStatus?: string;
}

export const StudentEnrollmentPage: React.FC<StudentEnrollmentPageProps> = ({ defaultStatus }) => {
  // Map caller-supplied defaultStatus to an internal FilterKey
  const resolveDefaultFilter = (): FilterKey => {
    if (!defaultStatus || defaultStatus === 'QUEUE') return 'SUBMITTED';
    if (defaultStatus === 'RESUBMITTED') return 'UNDER_REVIEW';
    const key = defaultStatus as FilterKey;
    return key;
  };
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [total, setTotal]               = useState(0);
  const [totalPages, setTotalPages]     = useState(1);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [filter, setFilter]             = useState<FilterKey>(resolveDefaultFilter());
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [limit, setLimit]               = useState(12);
  const [selected, setSelected]         = useState<AdmissionApplication | null>(null);
  const [remarks, setRemarks]           = useState('');
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Fetch list ──────────────────────────────────────────────────────────────
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await admissionService.listApplications({
        status: filter === 'ALL' ? undefined : filter,
        search: search || undefined,
        page,
        limit,
      });
      setApplications(result.applications);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error('Failed to load applications:', err);
      setToast({ type: 'error', message: 'Failed to load applications from server.' });
    } finally {
      setLoading(false);
    }
  }, [filter, search, page, limit]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Open detail modal ───────────────────────────────────────────────────────
  const openModal = async (app: AdmissionApplication) => {
    if (!app.studentpersonaldetails) {
      // Fetch full details if not loaded yet
      try {
        const full = await admissionService.getApplication(app.id);
        setSelected(full);
        setRemarks(full.adminRemarks || '');
      } catch {
        setSelected(app);
        setRemarks(app.adminRemarks || '');
      }
    } else {
      setSelected(app);
      setRemarks(app.adminRemarks || '');
    }
  };

  // ── Decision handler ────────────────────────────────────────────────────────
  const handleDecision = async (decision: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED') => {
    if (!selected) return;
    if (decision === 'REJECTED' && !remarks.trim()) {
      setToast({ type: 'error', message: 'Please enter rejection remarks before rejecting.' });
      return;
    }
    setSubmitting(true);
    try {
      await admissionService.updateStatus(selected.id, decision, remarks || undefined);
      setToast({
        type: 'success',
        message:
          decision === 'APPROVED'
            ? `✅ ${selected.user?.firstName}'s application APPROVED!`
            : decision === 'REJECTED'
            ? `❌ ${selected.user?.firstName}'s application rejected.`
            : `🔍 Moved to Under Review.`,
      });
      setSelected(null);
      fetchApplications();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.error || 'Failed to update status.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived counts ──────────────────────────────────────────────────────────
  const counts: Record<FilterKey, number> = {
    ALL:          total,
    REGISTERED:   applications.filter(a => a.applicationStatus === 'REGISTERED').length,
    DRAFT:        applications.filter(a => a.applicationStatus === 'DRAFT').length,
    SUBMITTED:    applications.filter(a => a.applicationStatus === 'SUBMITTED').length,
    UNDER_REVIEW: applications.filter(a => a.applicationStatus === 'UNDER_REVIEW').length,
    APPROVED:     applications.filter(a => a.applicationStatus === 'APPROVED').length,
    PRINCIPAL_APPROVED: applications.filter(a => a.applicationStatus === 'PRINCIPAL_APPROVED').length,
    FEE_RECEIPT_UPLOADED: applications.filter(a => a.applicationStatus === 'FEE_RECEIPT_UPLOADED').length,
    FEE_VERIFIED: applications.filter(a => a.applicationStatus === 'FEE_VERIFIED').length,
    REJECTED:     applications.filter(a => a.applicationStatus === 'REJECTED').length,
    CORRECTION_REQUIRED: applications.filter(a => a.applicationStatus === 'CORRECTION_REQUIRED').length,
    RESUBMITTED:  applications.filter(a => a.applicationStatus === 'RESUBMITTED').length,
    ENROLLED:     applications.filter(a => a.applicationStatus === 'ENROLLED').length,
    CANCELLATION_REQUESTED: applications.filter(a => a.applicationStatus === 'CANCELLATION_REQUESTED').length,
    CANCELLED:    applications.filter(a => a.applicationStatus === 'CANCELLED').length,
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getBranchStyle = (code?: string | null) => BRANCH_ACCENT[code || ''] || DEFAULT_BRANCH;
  const getDocUrl = (url?: string | null, appId?: string) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;

    if (!url.startsWith('/uploads') && !url.startsWith('uploads/') && appId) {
      const base = API.defaults.baseURL || '/api';
      const token = localStorage.getItem('token');
      let field = 'photo';
      if (url.toLowerCase().includes('signature')) field = 'signature';
      else if (url.toLowerCase().includes('tenth') || url.toLowerCase().includes('10th')) field = 'tenthMarksheet';
      else if (url.toLowerCase().includes('twelfth') || url.toLowerCase().includes('12th')) field = 'twelfthMarksheet';
      else if (url.toLowerCase().includes('cet')) field = 'cetScoreCard';
      else if (url.toLowerCase().includes('aadhaar')) field = 'aadhaar';
      else if (url.toLowerCase().includes('caste')) field = 'casteCertificate';
      else if (url.toLowerCase().includes('domicile')) field = 'domicileCertificate';
      else if (url.toLowerCase().includes('gap')) field = 'gapCertificate';
      else if (url.toLowerCase().includes('feespaid')) field = 'feesPaidReceipt';
      else if (url.toLowerCase().includes('admissionform')) field = 'admissionFormFeeReceipt';
      
      const streamUrl = `${base}/admin/admissions/${appId}/documents/${field}`;
      return token ? `${streamUrl}?token=${encodeURIComponent(token)}` : streamUrl;
    }

    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const base = API.defaults.baseURL || '/api';
    const host = base.replace(/\/api\/?$/, '');
    const finalUrl = host.startsWith('/') ? cleanPath : `${host}${cleanPath}`;
    const token = localStorage.getItem('token');
    return token ? `${finalUrl}?token=${encodeURIComponent(token)}` : finalUrl;
  };
  const getDocumentList = (app: AdmissionApplication) => {
    const d = app.studentdocuments;
    if (!d) return [];
    const isLateral = app.qualification === 'DIPLOMA' || (!app.qualification && app.admissionType === 'DCET');
    return [
      { label: 'Passport Photo',       field: 'photo',                        url: d.photoUrl },
      { label: 'Signature',            field: 'signature',                    url: d.signatureUrl },
      { label: '10th Marksheet',       field: 'tenthMarksheet',               url: d.tenthMarksheetUrl },
      ...(isLateral ? [
        { label: 'Diploma 5th Sem Marksheet', field: 'diplomaSemester5Marksheet', url: d.diplomaSemester5MarksheetUrl },
        { label: 'Diploma 6th Sem Marksheet', field: 'diplomaSemester6Marksheet', url: d.diplomaSemester6MarksheetUrl },
      ] : [
        { label: '12th Marksheet',     field: 'twelfthMarksheet',             url: d.twelfthMarksheetUrl },
      ]),
      { label: 'CET Score Card',       field: 'cetScoreCard',                 url: d.cetScoreCardUrl },
      { label: 'Aadhaar Card',         field: 'aadhaar',                      url: d.aadhaarUrl },
      { label: 'College Fees Receipt',    field: 'feesPaidReceipt',              url: d.feesPaidReceiptUrl },
      { label: 'Admission Form Fee Receipt', field: 'admissionFormFeeReceipt',      url: d.admissionFormFeeReceiptUrl },
      { label: 'Caste Certificate',    field: 'casteCertificate',             url: d.casteCertificateUrl },
      { label: 'Domicile Certificate', field: 'domicileCertificate',          url: d.domicileCertificateUrl },
      { label: 'Gap Certificate',      field: 'gapCertificate',               url: d.gapCertificateUrl },
    ].filter(d => d.url);
  };

  /**
   * Fetch a short-lived signed R2 URL from the backend (auth required),
   * then open the document in a new browser tab.
   */
  const openDocument = (admissionId: string, field: string) => {
    const token = localStorage.getItem('token') || '';
    const base = API.defaults.baseURL || '/api';
    const url = `${base}/admin/admissions/${admissionId}/documents/${field}?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-6 animate-fade-in">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className="glass-panel rounded-[32px] p-6 shadow-ambient">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">Admission Applications</h2>
              <p className="text-xs text-neutral-400 font-medium">
                {total} total applications · Review and approve/reject student forms
              </p>
            </div>
          </div>
          <button
            onClick={fetchApplications}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-neutral-200 bg-white text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="glass-panel rounded-[32px] p-6 shadow-ambient space-y-4">

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map(({ key, label, activeStyle }) => (
              <button
                key={key}
                onClick={() => { setFilter(key); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                  filter === key
                    ? activeStyle + ' shadow-sm'
                    : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'
                }`}
              >
                {label}
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${filter === key ? 'bg-black/10' : 'bg-neutral-200'}`}>
                  {filter === key ? total : counts[key]}
                </span>
              </button>
            ))}
          </div>

          {/* Search + Range */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <input
                type="text"
                placeholder="Search by name, email, admission no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 pl-9 text-xs outline-none focus:ring-2 text-neutral-800 placeholder:text-neutral-400"
                style={{ '--tw-ring-color': '#7C3AED30' } as React.CSSProperties}
              />
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            </div>
            <ShowStudentsRangeSelector
              value={limit}
              onChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Application Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center space-y-2">
            <ClipboardList className="w-10 h-10 text-neutral-300" />
            <p className="text-sm font-bold text-neutral-400">No applications found</p>
            <p className="text-xs text-neutral-300">Try adjusting your filter or search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {applications.map((app) => {
              const branchCode = app.branch?.code;
              const bs = getBranchStyle(branchCode);
              const ss = STATUS_STYLE[app.applicationStatus] || STATUS_STYLE['SUBMITTED'];
              const StatusIcon = ss.icon;
              const pd = app.studentpersonaldetails;
              const name = pd
                ? `${pd.firstName} ${pd.middleName ? pd.middleName + ' ' : ''}${pd.lastName}`.replace(/\s+/g, ' ').trim()
                : app.user
                  ? `${app.user.firstName} ${app.user.lastName}`
                  : '—';
              const acad = app.studentacademicdetails;
              const initials = (app.user?.firstName?.[0] || '') + (app.user?.lastName?.[0] || '');

              return (
                <div
                  key={app.id}
                  className={`p-5 rounded-[24px] border flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] cursor-pointer ${bs.card}`}
                  onClick={() => openModal(app)}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <img
                          src={getDocUrl(app.studentdocuments?.photoUrl || app.user?.profileImage, app.id) || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}
                          alt={name}
                          className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm bg-neutral-100"
                        />
                        <div>
                          <h3 className="text-xs font-bold text-neutral-800 leading-tight">{name}</h3>
                          <p className="text-[9px] text-neutral-500 font-semibold mt-0.5">
                            {app.studentpersonaldetails?.category || app.admissionType || '—'}
                          </p>
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded mt-0.5 inline-block ${bs.pill}`}>
                            {app.branch?.name || 'No Branch'}
                          </span>
                        </div>
                      </div>
                      <span className={`flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-full ${ss.bg} ${ss.text}`}>
                        <StatusIcon className="w-3 h-3" />
                        {ss.label}
                      </span>
                    </div>

                    {/* Academic Scores */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: '10th', value: acad?.tenthPercentage ? `${acad.tenthPercentage}%` : '—' },
                        { 
                          label: app.qualification === 'DIPLOMA' ? 'Diploma' : '12th', 
                          value: (app.qualification === 'DIPLOMA' ? acad?.diplomaPercentage : acad?.twelfthPercentage) ? `${app.qualification === 'DIPLOMA' ? acad.diplomaPercentage : acad.twelfthPercentage}%` : '—' 
                        },
                        { label: 'CET', value: acad?.cetScore ? `${acad.cetScore}` : '—' },
                      ].map((s) => (
                        <div key={s.label} className="bg-white/70 rounded-xl p-2 text-center border border-white">
                          <p className="text-[8px] text-neutral-400 font-bold uppercase">{s.label}</p>
                          <p className="text-xs font-extrabold text-neutral-800">{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Status indicator bar */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">Admission Type</span>
                        <span className="text-[9px] font-extrabold" style={{ color: bs.accent }}>
                          {app.admissionType || 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-white/60 pt-3">
                    <span className="text-[9px] text-neutral-400 font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('en-IN') : 'Not submitted'}
                    </span>
                    <button
                      className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-xl text-white shadow-sm hover:scale-105 transition-all"
                      style={{ backgroundColor: bs.accent }}
                      onClick={(e) => { e.stopPropagation(); openModal(app); }}
                    >
                      <Eye className="w-3 h-3" /> Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 font-semibold">
              Page {page} of {totalPages} · {total} applications
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      {selected && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(109,40,217,0.04))' }}
            >
              <div className="flex items-center space-x-3">
                <img
                  src={getDocUrl(selected.studentdocuments?.photoUrl || selected.user?.profileImage, selected.id) || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow bg-neutral-100"
                />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    {selected.user?.firstName} {selected.user?.lastName}
                  </h3>
                  <p className="text-[10px] text-neutral-500 font-semibold">
                    {selected.branch?.name || '—'} · {selected.admissionType || '—'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:scale-105 cursor-pointer"
              >
                <X className="w-4 h-4 text-neutral-600" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">

              {/* Personal Info */}
              <Section title="Personal Information">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: User,     label: 'Full Name',    value: selected.studentpersonaldetails ? `${selected.studentpersonaldetails.firstName} ${selected.studentpersonaldetails.middleName ? selected.studentpersonaldetails.middleName + ' ' : ''}${selected.studentpersonaldetails.lastName}`.replace(/\s+/g, ' ').trim() : selected.user ? `${selected.user.firstName} ${selected.user.lastName}` : '' },
                    { icon: Calendar, label: 'Date of Birth', value: formatDateDDMMYYYY(selected.studentpersonaldetails?.dateOfBirth) || '—' },
                    { icon: User,     label: 'Gender',       value: selected.studentpersonaldetails?.gender || '—' },
                    { icon: BookOpen, label: 'Category',     value: selected.studentpersonaldetails?.category || '—' },
                    { icon: Phone,    label: 'Phone',        value: selected.studentpersonaldetails?.phone || selected.user?.phone || '—' },
                    { icon: User,     label: 'Email',        value: selected.studentpersonaldetails?.email || selected.user?.email || '—' },
                  ].map((f) => {
                    const Icon = f.icon;
                    return (
                      <div key={f.label} className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                        <p className="text-[9px] text-neutral-400 font-bold uppercase">{f.label}</p>
                        <p className="text-xs font-bold text-neutral-800 mt-0.5 flex items-center gap-1">
                          <Icon className="w-3 h-3 text-neutral-300 flex-shrink-0" /> {f.value}
                        </p>
                      </div>
                    );
                  })}
                  {selected.studentaddress && (
                    <div className="col-span-2 bg-neutral-50 rounded-xl p-3 border border-neutral-100 flex items-start space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase">Address</p>
                        <p className="text-xs font-bold text-neutral-800 mt-0.5">
                          {[
                            selected.studentaddress.currentAddressLine1,
                            selected.studentaddress.currentCity,
                            selected.studentaddress.currentState,
                            selected.studentaddress.currentPincode,
                          ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              {/* Academic Scores */}
              {selected.studentacademicdetails && (
                <Section title="Academic Scores">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '10th %',  value: selected.studentacademicdetails.tenthPercentage ? `${selected.studentacademicdetails.tenthPercentage}%` : '—', color: '#d97706' },
                      { 
                        label: selected.qualification === 'DIPLOMA' ? 'Diploma %' : '12th %',  
                        value: (selected.qualification === 'DIPLOMA' ? selected.studentacademicdetails.diplomaPercentage : selected.studentacademicdetails.twelfthPercentage) ? `${selected.qualification === 'DIPLOMA' ? selected.studentacademicdetails.diplomaPercentage : selected.studentacademicdetails.twelfthPercentage}%` : '—', 
                        color: '#0284c7' 
                      },
                      { label: 'CET Score', value: selected.studentacademicdetails.cetScore ? `${selected.studentacademicdetails.cetScore}` : '—', color: '#7C3AED' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl p-3 border text-center" style={{ backgroundColor: s.color + '10', borderColor: s.color + '30' }}>
                        <p className="text-[9px] font-bold text-neutral-400 uppercase">{s.label}</p>
                        <p className="text-base font-extrabold mt-0.5" style={{ color: s.color }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Parent Info */}
              {selected.studentparentdetails && (
                <Section title="Parent / Guardian">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                      <p className="text-[9px] text-neutral-400 font-bold uppercase">Father's Name</p>
                      <p className="text-xs font-bold text-neutral-800 mt-0.5">{selected.studentparentdetails.fatherName || '—'}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                      <p className="text-[9px] text-neutral-400 font-bold uppercase">Father's Phone</p>
                      <p className="text-xs font-bold text-neutral-800 mt-0.5">{selected.studentparentdetails.fatherPhone || '—'}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                      <p className="text-[9px] text-neutral-400 font-bold uppercase">Mother's Name</p>
                      <p className="text-xs font-bold text-neutral-800 mt-0.5">{selected.studentparentdetails.motherName || '—'}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                      <p className="text-[9px] text-neutral-400 font-bold uppercase">Annual Income</p>
                      <p className="text-xs font-bold text-neutral-800 mt-0.5">
                        {selected.studentparentdetails.fatherAnnualIncome
                          ? `₹${Number(selected.studentparentdetails.fatherAnnualIncome).toLocaleString('en-IN')}`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </Section>
              )}

              {/* Admission Form Fee payment Details */}
              {selected.studentdocuments && (selected.studentdocuments.admissionFormFeePaymentMode || selected.studentdocuments.admissionFormFeeUtr) && (
                <Section title="Admission Form Fee Details">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                      <p className="text-[9px] text-neutral-400 font-bold uppercase">Payment Mode</p>
                      <p className="text-xs font-bold text-neutral-800 mt-0.5">{selected.studentdocuments.admissionFormFeePaymentMode || '—'}</p>
                    </div>
                    {selected.studentdocuments.admissionFormFeePaymentMode === 'ONLINE' && (
                      <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                        <p className="text-[9px] text-neutral-400 font-bold uppercase">UTR / Transaction ID</p>
                        <p className="text-xs font-bold text-neutral-800 mt-0.5">{selected.studentdocuments.admissionFormFeeUtr || '—'}</p>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Documents */}
              {selected.studentdocuments && (
                <Section title="Uploaded Documents">
                  <div className="space-y-2">
                    {getDocumentList(selected).length === 0 ? (
                      <p className="text-xs text-neutral-400 italic">No documents uploaded yet.</p>
                    ) : (
                      getDocumentList(selected).map((doc) => (
                        <button
                          key={doc.label}
                          onClick={() => openDocument(selected.id, doc.field)}
                          className="w-full flex items-center justify-between p-3 rounded-xl border bg-emerald-50 border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-all text-left"
                        >
                          <div className="flex items-center space-x-2.5">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs font-bold text-neutral-800">{doc.label}</span>
                          </div>
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-100">
                            ✓ View
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </Section>
              )}

              {/* Existing Remarks */}
              {selected.adminRemarks && (
                <div className="p-3 rounded-xl border border-violet-200 bg-violet-50">
                  <p className="text-[9px] font-extrabold text-violet-700 uppercase tracking-widest mb-1">Previous Remarks</p>
                  <p className="text-xs text-neutral-700 font-semibold">{selected.adminRemarks}</p>
                </div>
              )}

              {/* Admin Remarks textarea */}
              <div>
                <label className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-widest block mb-1.5">
                  Admin Remarks / Notes
                  {(selected.applicationStatus === 'SUBMITTED' || selected.applicationStatus === 'UNDER_REVIEW') && (
                    <span className="text-rose-500 ml-0.5">*</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Verification notes, approval justification, or rejection reason..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs outline-none text-neutral-800 focus:ring-2 focus:border-violet-400"
                  style={{ resize: 'none', '--tw-ring-color': '#7C3AED30' } as React.CSSProperties}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-neutral-100 flex items-center gap-3 flex-shrink-0 bg-neutral-50/80">
              {selected.applicationStatus === 'SUBMITTED' ? (
                <>
                  <button
                    onClick={() => handleDecision('UNDER_REVIEW')}
                    disabled={submitting}
                    className="flex-none py-3 px-4 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-700 text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-amber-100 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Clock className="w-4 h-4" />
                    {submitting ? '...' : 'Under Review'}
                  </button>
                  <button
                    onClick={() => handleDecision('REJECTED')}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl border-2 border-rose-300 bg-rose-50 text-rose-700 text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {submitting ? 'Processing...' : 'Reject Application'}
                  </button>
                  <button
                    onClick={() => handleDecision('APPROVED')}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 btn-admin-primary"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? 'Processing...' : 'Approve & Admit'}
                  </button>
                </>
              ) : selected.applicationStatus === 'UNDER_REVIEW' ? (
                <>
                  <button
                    onClick={() => handleDecision('REJECTED')}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl border-2 border-rose-300 bg-rose-50 text-rose-700 text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {submitting ? 'Processing...' : 'Reject Application'}
                  </button>
                  <button
                    onClick={() => handleDecision('APPROVED')}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 btn-admin-primary"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? 'Processing...' : 'Approve & Admit'}
                  </button>
                </>
              ) : (
                <div className={`flex-1 py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 ${
                  selected.applicationStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : selected.applicationStatus === 'REJECTED'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {selected.applicationStatus === 'APPROVED' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  Application {selected.applicationStatus}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ── Sub-component ──────────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-widest mb-2">{title}</p>
    {children}
  </div>
);

export default StudentEnrollmentPage;
