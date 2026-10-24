import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../../../services/api';
import toast from 'react-hot-toast';
import { 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Loader2, 
  Layers,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  FileText,
  X,
  UserCheck,
  User,
  Hash,
  GraduationCap,
  Calendar,
  Mail,
  Phone
} from 'lucide-react';
import { ShowStudentsRangeSelector } from '../../../components/common/ShowStudentsRangeSelector';

const getOrdinal = (n: number | string): string => {
  const num = Number(n);
  if (isNaN(num)) return `${n}`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const AdminProvisionalAdmissionsPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filters
  const [limit, setLimit] = useState<number>(10);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');       // Raw input (not yet applied)
  const [appliedSearch, setAppliedSearch] = useState<string>('');    // Applied search (triggers fetch)

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState<boolean>(false);
  const [bulkReport, setBulkReport] = useState<{ approved: string[]; failed: string[] } | null>(null);

  // Review Drawer / Modal
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [reviewData, setReviewData] = useState<any | null>(null);
  const [loadingReview, setLoadingReview] = useState<boolean>(false);
  const [actionRemarks, setActionRemarks] = useState<string>('');
  const [processingAction, setProcessingAction] = useState<boolean>(false);

  // Document verification modal states
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [docRemarks, setDocRemarks] = useState<string>('');

  // Document verification remarks auto-copy effect
  useEffect(() => {
    if (!reviewData?.documents) return;
    
    const getDocName = (doc: any) => {
      return doc.documentType === 'FEE_RECEIPT' ? 'College Fee Receipt' : `Semester ${doc.semesterNumber} Marks Card`;
    };
    
    const lines: string[] = [];
    reviewData.documents.forEach((doc: any) => {
      if (verifyingDocId === doc.id) {
        if (docRemarks.trim()) {
          lines.push(`[${getDocName(doc)}]: ${docRemarks}`);
        }
      } else if (doc.verificationStatus === 'REJECTED' && doc.verificationRemarks) {
        lines.push(`[${getDocName(doc)}]: ${doc.verificationRemarks}`);
      }
    });
    
    setActionRemarks(lines.join('\n'));
  }, [docRemarks, verifyingDocId, reviewData?.documents]);

  const handleStartRejection = (doc: any) => {
    setVerifyingDocId(doc.id);
    setDocRemarks(doc.verificationRemarks || '');
  };

  // Load review details when id is in the URL
  useEffect(() => {
    if (id) {
      loadReviewDetails(id);
    } else {
      setSelectedApp(null);
      setReviewData(null);
    }
  }, [id]);

  const loadReviewDetails = async (appId: string) => {
    setLoadingReview(true);
    setReviewData(null);
    try {
      const res = await API.get(`/provisional/acknowledgement/${appId}`);
      if (res.data?.success) {
        const data = res.data.data;
        // Use allSemesterDocuments if available (populated by backend for cumulative view)
        if (data.allSemesterDocuments && data.allSemesterDocuments.length > 0) {
          data._displayDocuments = data.allSemesterDocuments;
        } else {
          data._displayDocuments = data.documents || [];
        }
        setReviewData(data);
        setSelectedApp(data.application);
      }
    } catch (err: any) {
      toast.error('Failed to load application details.');
    } finally {
      setLoadingReview(false);
    }
  };

  const getDocUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;

    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const base = API.defaults.baseURL || '/api';
    const host = base.replace(/\/api\/?$/, '');
    const finalUrl = host.startsWith('/') ? cleanPath : `${host}${cleanPath}`;
    const token = localStorage.getItem('token');
    return token ? `${finalUrl}?token=${encodeURIComponent(token)}` : finalUrl;
  };

  useEffect(() => {
    fetchBranches();
    fetchApplications();
  }, [selectedBranch, selectedSemester, selectedStatus, appliedSearch, limit]);

  const fetchBranches = async () => {
    try {
      const res = await API.get('/system/branches');
      if (res.data?.success) {
        setBranches(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch branches', err);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedBranch) params.branchId = selectedBranch;
      if (selectedSemester) params.semester = Number(selectedSemester);
      if (selectedStatus) params.status = selectedStatus;
      if (appliedSearch) params.search = appliedSearch;
      if (limit) params.limit = limit;

      const res = await API.get('/provisional/admin/list', { params });
      if (res.data?.success) {
        setApplications(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch provisional applications');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchQuery); // Commits search into filter state, triggering useEffect
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setAppliedSearch('');
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const toggleSelectAll = () => {
    const eligibleApps = applications.filter(app => ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(app.status));
    if (selectedIds.length === eligibleApps.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleApps.map(app => app.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBulkApproving(true);
      setBulkReport(null);
      const res = await API.post('/provisional/admin/bulk-approve', { ids: selectedIds });
      if (res.data?.success) {
        setBulkReport(res.data.data);
        setSelectedIds([]);
        fetchApplications();
        window.dispatchEvent(new CustomEvent('admissions-updated'));
        toast.success('Bulk approval processing complete.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Bulk approval failed.');
    } finally {
      setBulkApproving(false);
    }
  };

  // Open Review Details Page
  const handleOpenReview = (app: any) => {
    navigate(`/admin/admissions/provisional/${app.id}`);
  };

  // Verify / Reject Single Document
  const handleVerifyDocument = async (docId: string, status: 'VERIFIED' | 'REJECTED', remarks: string = '') => {
    try {
      const res = await API.post(`/provisional/admin/${selectedApp.id}/verify-doc`, {
        documentId: docId,
        status,
        remarks
      });
      if (res.data?.success) {
        toast.success(status === 'VERIFIED' ? 'Document verified.' : 'Document rejected.');
        setVerifyingDocId(null);
        setDocRemarks('');
        // Refresh review data
        const refreshRes = await API.get(`/provisional/acknowledgement/${selectedApp.id}`);
        if (refreshRes.data?.success) {
          setReviewData(refreshRes.data.data);
        }
        window.dispatchEvent(new CustomEvent('admissions-updated'));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Document status update failed.');
    }
  };

  // Process Overall Action (APPROVE, CORRECTION_REQUIRED, REJECT)
  const handleProcessAction = async (action: 'APPROVE' | 'CORRECTION_REQUIRED' | 'REJECT') => {
    if ((action === 'CORRECTION_REQUIRED' || action === 'REJECT') && !actionRemarks.trim()) {
      toast.error('Remarks/Reasons are required for corrections or rejections.');
      return;
    }

    try {
      setProcessingAction(true);
      const res = await API.post(`/provisional/admin/${selectedApp.id}/action`, {
        action,
        remarks: actionRemarks
      });
      if (res.data?.success) {
        toast.success(`Application updated: ${action}`);
        setSelectedApp(null);
        setReviewData(null);
        setActionRemarks('');
        fetchApplications();
        window.dispatchEvent(new CustomEvent('admissions-updated'));
        navigate('/admin/admissions/provisional');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed.');
    } finally {
      setProcessingAction(false);
    }
  };

  if (id) {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto animate-fade-in">
        {/* Back Button & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-700/60 shadow-sm transition-all duration-300">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/admin/admissions/provisional')}
              className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 rounded-xl transition-all duration-200 shadow-sm cursor-pointer hover:scale-105 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">Review Provisional Application</h1>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {reviewData ? `${reviewData.application?.provisionalAdmissionNumber} — Verification Console` : 'Loading application details...'}
              </p>
            </div>
          </div>
          {reviewData?.application?.status && (
            <div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm ${
                reviewData.application.status === 'APPROVED' ? 'bg-emerald-55/80 text-emerald-700 border-emerald-200' :
                reviewData.application.status === 'SUBMITTED' || reviewData.application.status === 'RESUBMITTED' ? 'bg-blue-55/80 text-blue-700 border-blue-200' :
                reviewData.application.status === 'CORRECTION_REQUIRED' ? 'bg-amber-55/80 text-amber-705 border-amber-200' :
                'bg-slate-55/80 text-slate-700 border-slate-200'
              }`}>
                {reviewData.application.status}
              </span>
            </div>
          )}
        </div>

        {/* Loading / Details view */}
        {loadingReview ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-650 mb-2" />
            <p className="text-sm font-semibold text-slate-500">Loading student files...</p>
          </div>
        ) : reviewData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Column - Student Profile & Academic History */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-700/60 shadow-sm space-y-6 transition-all duration-300">
                <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="relative mb-3 group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                    <img 
                      src={getDocUrl(reviewData.student?.photoUrl) || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} 
                      alt="Student" 
                      className="relative w-28 h-28 rounded-3xl object-cover border-2 border-white dark:border-slate-850 shadow-md transform group-hover:scale-[1.02] transition-transform duration-300" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
                      }}
                    />
                  </div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-wide">{reviewData.student?.name}</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{reviewData.student?.branch || '—'}</p>
                </div>

                <div className="space-y-4">
                  {/* USN */}
                  <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Hash className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">University Seat Number (USN)</span>
                      <span className="text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 uppercase">{reviewData.student?.usn || '—'}</span>
                    </div>
                  </div>

                  {/* Target Semester */}
                  <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Target Semester</span>
                      <span className="text-xs font-extrabold text-indigo-755 dark:text-indigo-400">{reviewData.application?.semester}th Semester</span>
                    </div>
                  </div>

                  {/* Academic Year */}
                  <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Academic Year</span>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{reviewData.application?.academicYear}</span>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Phone Number</span>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{reviewData.student?.phone || '—'}</span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Email Address</span>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block truncate">{reviewData.student?.email || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic History Table Card */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-700/60 shadow-sm space-y-4 transition-all duration-300">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                  <h3 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">Academic History</h3>
                </div>
                <div className="overflow-hidden border border-slate-150 dark:border-slate-700 rounded-2xl shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 dark:bg-slate-950 border-b border-slate-800">
                        <th className="py-3 px-4 font-bold text-white uppercase tracking-wider text-[10px]">Semester</th>
                        <th className="py-3 px-4 font-bold text-white uppercase tracking-wider text-[10px] text-center">Passed</th>
                        <th className="py-3 px-4 font-bold text-white uppercase tracking-wider text-[10px] text-center">Failed</th>
                        <th className="py-3 px-4 font-bold text-white uppercase tracking-wider text-[10px]">Codes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewData.semesterRecords?.map((r: any) => (
                        <tr key={r.id} className="border-b border-slate-100 dark:border-slate-750 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors duration-150">
                          <td className="py-3.5 px-4 font-black text-slate-805 dark:text-slate-200">Sem {r.semesterNumber}</td>
                          <td className="py-3.5 px-4 text-emerald-600 font-extrabold text-center bg-emerald-50/10">{r.subjectsPassed}</td>
                          <td className="py-3.5 px-4 text-rose-600 font-black text-center bg-rose-50/10">{r.subjectsFailed}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-500 text-xs">{(r.failedSubjectCodes || []).join(', ') || 'NIL'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right Column - Document Verification & Final Action */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Document verification Console */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-700/60 shadow-sm space-y-5 transition-all duration-300">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
                  <h3 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">Uploaded Documents Verification</h3>
                  <span className="text-[10px] bg-slate-105 dark:bg-slate-900 text-slate-550 dark:text-slate-400 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {(reviewData._displayDocuments || reviewData.documents || []).length} Files
                  </span>
                </div>

                <div className="space-y-4">
                  {(reviewData._displayDocuments || reviewData.documents || [])?.map((doc: any) => {
                    const isVerified = doc.verificationStatus === 'VERIFIED';
                    const isRejected = doc.verificationStatus === 'REJECTED';
                    const isPending = doc.verificationStatus === 'PENDING';
                    const isAppResubmitted = reviewData?.application?.status === 'RESUBMITTED';
                    const isCorrected = isPending && doc.verificationRemarks === 'CORRECTED';
                    // Historical docs come from a different application — admin can view but not verify via this form
                    const isHistorical = doc._source === 'historical';
                    
                    const statusText = isAppResubmitted && isVerified ? 'APPROVED (PREV)' : 
                                     isAppResubmitted && isCorrected ? 'CORRECTED BY STUDENT' : 
                                     doc.verificationStatus;
                    
                    const badgeClass = isAppResubmitted && isVerified 
                      ? 'bg-emerald-100 text-emerald-805 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/60 font-black' 
                      : isAppResubmitted && isCorrected
                        ? 'bg-amber-100 text-amber-850 border-amber-250 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/60 font-black animate-pulse'
                        : isVerified
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : isRejected
                            ? 'bg-rose-100 text-rose-805 border-rose-200'
                            : 'bg-amber-100 text-amber-805 border-amber-200';

                    const rowBgClass = isHistorical
                      ? 'border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/10 dark:bg-indigo-950/5'
                      : isAppResubmitted && isCorrected 
                        ? 'border-2 border-amber-400 dark:border-amber-900 bg-amber-50/10 dark:bg-amber-950/5 shadow-sm shadow-amber-105/20 dark:shadow-none' 
                        : 'border border-slate-200/80 dark:border-slate-700 bg-slate-50/20 dark:bg-slate-900/20';

                    const iconContainerClass = isHistorical
                      ? 'bg-indigo-50 text-indigo-500 border-indigo-200'
                      : isAppResubmitted && isCorrected
                        ? 'bg-amber-50 text-amber-605 border-amber-200'
                        : isVerified
                          ? 'bg-emerald-50 text-emerald-605 border-emerald-200'
                          : isRejected
                            ? 'bg-rose-50 text-rose-605 border-rose-200'
                            : 'bg-indigo-50 text-indigo-650 border-indigo-200';

                    return (
                      <div key={doc.id} className={`rounded-2xl p-5 space-y-4 transition-all duration-205 shadow-sm ${rowBgClass}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start space-x-3">
                            <div className={`p-2.5 rounded-xl border flex-shrink-0 ${iconContainerClass}`}>
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-black uppercase text-slate-805 dark:text-slate-200">
                                  {doc.documentType === 'FEE_RECEIPT' ? 'College Fee Receipt' : `Semester ${doc.semesterNumber} Marks Card`}
                                </h4>
                                {isHistorical && (
                                  <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-full uppercase tracking-wide">
                                    From Prior Application
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-450 font-extrabold font-mono mt-0.5 max-w-sm truncate">{doc.originalFileName}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-wider shadow-sm ${badgeClass}`}>
                              {statusText}
                            </span>
                            <a
                              href={(() => {
                                const token = localStorage.getItem('token') || '';
                                if (!doc.url) return '#';
                                const base = API.defaults.baseURL || '/api';
                                const cleanPath = doc.url.startsWith('/') ? doc.url : `/${doc.url}`;
                                const fullUrl = doc.url.startsWith('http') ? doc.url : `${base.replace(/\/api\/?$/, '')}${cleanPath}`;
                                return token ? `${fullUrl}?token=${encodeURIComponent(token)}` : fullUrl;
                              })()}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-155 flex items-center gap-1.5 shadow-sm cursor-pointer hover:scale-103 active:scale-97"
                            >
                              <Eye className="w-4 h-4 text-slate-450" /> View Document
                            </a>
                          </div>
                        </div>

                        {/* Document inline verification buttons — only for current application docs */}
                        {!isHistorical && (
                          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => handleVerifyDocument(doc.id, 'VERIFIED')}
                              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200 text-emerald-750 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all duration-150 cursor-pointer shadow-sm active:scale-95"
                            >
                              <CheckCircle className="w-4 h-4" /> Mark Verified
                            </button>
                            
                            <button
                              onClick={() => handleStartRejection(doc)}
                              className="px-4 py-2 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all duration-150 cursor-pointer shadow-sm active:scale-95"
                            >
                              <XCircle className="w-4 h-4" /> Reject File
                            </button>
                          </div>
                        )}

                        {isHistorical && (
                          <div className="flex items-center gap-2 pt-3 border-t border-indigo-100 dark:border-indigo-900/40">
                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold">
                              This document was verified during a previous semester application — verified status inherited.
                            </span>
                          </div>
                        )}

                        {/* Inline rejection remarks text field */}
                        {verifyingDocId === doc.id && (
                          <div className="mt-3 space-y-2 p-4 bg-rose-50/50 border border-rose-150 rounded-2xl animate-fade-in">
                            <label className="text-[10px] font-black text-rose-800 uppercase block tracking-wider">Rejection Remarks</label>
                            <textarea
                              rows={2}
                              value={docRemarks}
                              onChange={e => setDocRemarks(e.target.value)}
                              placeholder="Describe why this document is invalid or blurry..."
                              className="w-full px-3 py-2 text-xs border border-rose-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setVerifyingDocId(null)} className="px-3 py-1.5 bg-slate-150 text-slate-655 rounded-lg text-[10px] font-bold cursor-pointer transition active:scale-95">Cancel</button>
                              <button onClick={() => handleVerifyDocument(doc.id, 'REJECTED', docRemarks)} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold cursor-pointer transition active:scale-95 shadow-md hover:bg-rose-750">Confirm Reject</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overall Action Form */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-700/60 shadow-sm space-y-4 transition-all duration-300">
                <div className="pb-2 border-b border-slate-100 dark:border-slate-700/60">
                  <label className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider block">Decision Remarks / Corrections Notes</label>
                </div>
                <textarea
                  rows={3}
                  value={actionRemarks}
                  onChange={e => setActionRemarks(e.target.value)}
                  placeholder="Provide detailed logs or required correction descriptions. Necessary for requesting correction or rejection."
                  className="w-full px-4 py-3 border border-slate-250 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 outline-none text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white"
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={processingAction}
                    onClick={() => handleProcessAction('APPROVE')}
                    className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-705 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    Approve & Promote Semester
                  </button>
                  <button
                    type="button"
                    disabled={processingAction}
                    onClick={() => handleProcessAction('CORRECTION_REQUIRED')}
                    className="px-5 py-3.5 bg-amber-600 hover:bg-amber-705 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    Request Correction
                  </button>
                  <button
                    type="button"
                    disabled={processingAction}
                    onClick={() => handleProcessAction('REJECT')}
                    className="px-5 py-3.5 bg-rose-600 hover:bg-rose-705 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    Reject Application
                  </button>
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="py-20 text-center text-rose-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm">
            <p className="font-bold">Provisional application details could not be loaded.</p>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Provisional Admissions Verification Workspace</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Verify lower semester marks cards, fee receipts, and promotive semester assignments.</p>
          </div>
        </div>
      </div>

      {/* Bulk Approval report overlay */}
      {bulkReport && (
        <div className="p-5 bg-white dark:bg-slate-800 border-2 border-slate-200 rounded-2xl space-y-3">
          <div className="flex justify-between items-center pb-2 border-b">
            <h3 className="text-sm font-black text-indigo-750 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-5 h-5" /> Bulk Approval Processing Summary
            </h3>
            <button onClick={() => setBulkReport(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl">
              <span className="font-bold text-emerald-800 dark:text-emerald-450 block mb-1">Approved ({bulkReport.approved.length}):</span>
              {bulkReport.approved.length > 0 ? (
                <ul className="list-disc pl-4 space-y-0.5">
                  {bulkReport.approved.map(num => <li key={num} className="font-semibold text-emerald-700">{num}</li>)}
                </ul>
              ) : <p className="text-slate-400">None</p>}
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-xl">
              <span className="font-bold text-rose-800 dark:text-rose-450 block mb-1">Failed / Skipped ({bulkReport.failed.length}):</span>
              {bulkReport.failed.length > 0 ? (
                <ul className="list-disc pl-4 space-y-0.5">
                  {bulkReport.failed.map((reason, idx) => <li key={idx} className="font-semibold text-rose-700">{reason}</li>)}
                </ul>
              ) : <p className="text-slate-400">None</p>}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-6 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 items-end">
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 flex-grow w-full text-xs font-bold">
            <div className="space-y-1">
              <label className="text-slate-500">Branch</label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-350 dark:border-slate-700 outline-none"
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-500">Semester</label>
              <select
                value={selectedSemester}
                onChange={e => setSelectedSemester(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-350 dark:border-slate-700 outline-none"
              >
                <option value="">All Semesters</option>
                <option value="3">3rd Semester</option>
                <option value="5">5th Semester</option>
                <option value="7">7th Semester</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-500">Verification Status</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-350 dark:border-slate-700 outline-none"
              >
                <option value="">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="RESUBMITTED">Resubmitted</option>
                <option value="CORRECTION_REQUIRED">Correction Requested</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-500">Global Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="USN or Name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-350 dark:border-slate-700 outline-none"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto flex-shrink-0 items-center">
            <button
              type="submit"
              className="px-5 py-2 bg-[#0F4C81] hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wide rounded-lg flex items-center justify-center gap-1.5 w-full md:w-auto"
            >
              Search
            </button>
            {selectedIds.length > 0 && (
              <button
                type="button"
                disabled={bulkApproving}
                onClick={handleBulkApprove}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-lg flex items-center justify-center gap-1.5 w-full md:w-auto whitespace-nowrap"
              >
                {bulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Bulk Approve ({selectedIds.length})
              </button>
            )}
            <ShowStudentsRangeSelector
              value={limit}
              onChange={(newLimit) => setLimit(newLimit)}
            />
          </div>
        </form>
      </div>

      {/* Main List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-sm font-semibold text-slate-500">Loading Provisional Queue...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <p className="font-bold">No provisional applications found matching the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="bg-black border-b border-slate-800 text-white">
                  <th className="p-4 w-14 text-center font-black uppercase tracking-wider text-white">SL NO.</th>
                  <th className="p-4 font-black uppercase tracking-wider text-white">PA Number</th>
                  <th className="p-4 font-black uppercase tracking-wider text-white">Student</th>
                  <th className="p-4 font-black uppercase tracking-wider text-white">USN</th>
                  <th className="p-4 font-black uppercase tracking-wider text-white text-center">Target Sem</th>
                  <th className="p-4 font-black uppercase tracking-wider text-white">Academic Year</th>
                  <th className="p-4 font-black uppercase tracking-wider text-white">Status</th>
                  <th className="p-4 font-black uppercase tracking-wider text-white text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.slice(0, limit).map((app, idx) => {
                  return (
                    <tr key={app.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="p-4 text-center font-bold text-slate-500 dark:text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="p-4 font-bold font-mono text-indigo-650">{app.provisionalAdmissionNumber}</td>
                      <td className="p-4 font-bold">{app.studentNameSnapshot}</td>
                      <td className="p-4 font-mono font-bold text-slate-600 dark:text-slate-350 uppercase">{app.usnSnapshot || '—'}</td>
                      <td className="p-4 font-bold text-center">{getOrdinal(app.semester)}</td>
                      <td className="p-4 font-semibold">{app.academicYear}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                          app.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          app.status === 'SUBMITTED' || app.status === 'RESUBMITTED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          app.status === 'CORRECTION_REQUIRED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenReview(app)}
                          className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shadow-sm float-right"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" /> Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Review Drawer / Modal removed in favor of dedicated details route */}
    </div>
  );
};
